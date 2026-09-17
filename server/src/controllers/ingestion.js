const { getAuth } = require("@clerk/express");
const prisma = require("../lib/prisma");
const logger = require("../lib/logger");
const ApiError = require("../utils/ApiError");
const asyncHandler = require("../middleware/asyncHandler");
const { enqueueIngest } = require("../lib/pgBoss");
const { DEFAULT_LIST_LIMIT } = require("../validators/aiAdminSchemas");

const RETRYABLE_STATUSES = new Set(["REVIEW", "FAILED"]);

const orgScope = (orgId) => ({ orgId: { in: [orgId, null] } });

const assertEventReadable = (event, orgId) => {
  if (event.orgId != null && event.orgId !== orgId) {
    throw new ApiError(404, "Ingestion event not found.");
  }
};

/**
 * POST /api/ai/ingest — trusted channel/webhook entry point.
 *
 * Upserts the IngestionEvent on the unique (channel, externalId) pair so
 * duplicate deliveries never create a second PgBoss job for the same logical
 * message. The upsert deliberately does NOT rewrite `status`: processing state
 * is owned by the worker. Re-delivering an already-PROCESSED event is a
 * harmless no-op (the worker's claim gate skips terminal events), and an
 * in-flight PENDING/PROCESSING event's exclusive PgBoss job gates the re-send.
 */
exports.createIngestion = asyncHandler(async (req, res) => {
  const { channel, externalId, raw, requesterRef, orgId } = req.body;

  const event = await prisma.ingestionEvent.upsert({
    where: { channel_externalId: { channel, externalId } },
    update: {
      rawPayload: raw,
      requesterRef: requesterRef ?? null,
      orgId: orgId ?? null,
    },
    create: {
      channel,
      externalId,
      rawPayload: raw,
      requesterRef: requesterRef ?? null,
      orgId: orgId ?? null,
      status: "PENDING",
    },
  });

  if (event.status === "PROCESSED") {
    logger.info("Ingestion event already processed; skipping enqueue", { ingestionEventId: event.id });
    return res.status(200).json({
      ingestionEventId: event.id,
      status: event.status,
      enqueued: false,
      jobId: null,
    });
  }

  let queue;
  try {
    queue = await enqueueIngest({ ingestionEventId: event.id, channel, externalId });
  } catch (error) {
    logger.error("Failed to enqueue ingestion event", { error: error.message, ingestionEventId: event.id });
    throw new ApiError(503, "Ingestion queue is unavailable; event stored but not enqueued.");
  }

  logger.info("Ingestion event accepted", { ingestionEventId: event.id, channel, externalId, enqueued: queue.enqueued });

  res.status(202).json({
    ingestionEventId: event.id,
    status: event.status,
    enqueued: queue.enqueued,
    jobId: queue.jobId,
  });
});

/**
 * GET /api/ai/ingest — org-admin listing of ingestion events.
 *
 * Global scoping: an org admin sees their org's events plus org-agnostic
 * (orgId null) channel events, mirroring the knowledge-base read convention.
 */
exports.listEvents = asyncHandler(async (req, res) => {
  const orgId = req.orgId ?? getAuth(req).orgId;
  const { status, channel, limit = DEFAULT_LIST_LIMIT } = req.query;

  const where = {
    ...orgScope(orgId),
    ...(status ? { status } : {}),
    ...(channel ? { channel } : {}),
  };

  const events = await prisma.ingestionEvent.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: limit,
  });

  logger.info("Ingestion events listed", { actorId: getAuth(req).userId, orgId, count: events.length, status: status ?? null });

  res.json({
    data: events.map(({ suggestion, rawPayload, ...event }) => ({
      ...event,
      hasSuggestion: suggestion != null,
    })),
    count: events.length,
  });
});

/**
 * POST /api/ai/ingest/:id/retry — org-admin re-enqueue of a REVIEW/FAILED event.
 *
 * Resets the row back to PENDING (so the worker's claim gate accepts it) and
 * re-sends a PgBoss job under the same exclusive singleton key. Terminal
 * PROCESSED events are rejected; PROCESSING events are left to the worker.
 */
exports.retryEvent = asyncHandler(async (req, res) => {
  const orgId = req.orgId ?? getAuth(req).orgId;
  const event = await prisma.ingestionEvent.findUnique({ where: { id: req.params.id } });
  if (!event) {
    throw new ApiError(404, "Ingestion event not found.");
  }
  assertEventReadable(event, orgId);

  if (!RETRYABLE_STATUSES.has(event.status)) {
    throw new ApiError(409, `Event status '${event.status}' is not retryable; only REVIEW or FAILED events can be retried.`);
  }

  const updated = await prisma.ingestionEvent.update({
    where: { id: event.id },
    data: { status: "PENDING", error: null },
  });

  let queue;
  try {
    queue = await enqueueIngest({ ingestionEventId: event.id, channel: event.channel, externalId: event.externalId });
  } catch (error) {
    logger.error("Failed to re-enqueue ingestion event on retry", { error: error.message, ingestionEventId: event.id });
    throw new ApiError(503, "Ingestion queue is unavailable; event reset to PENDING.");
  }

  logger.info("Ingestion event re-enqueued", { ingestionEventId: event.id, actorId: getAuth(req).userId, orgId, enqueued: queue.enqueued });

  res.status(202).json({
    ingestionEventId: event.id,
    status: updated.status,
    enqueued: queue.enqueued,
    jobId: queue.jobId,
  });
});
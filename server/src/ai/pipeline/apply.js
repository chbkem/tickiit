const { sanitizeText } = require("../../utils/sanitize");

const MAX_IDENTIFIER_LENGTH = 200;

const cleanString = (value) => {
  if (typeof value !== "string") return null;
  const cleaned = sanitizeText(value);
  return cleaned == null || cleaned === "" ? null : cleaned.slice(0, MAX_IDENTIFIER_LENGTH);
};

class ApplyError extends Error {
  constructor(message) {
    super(message);
    this.name = "ApplyError";
  }
}

const applyDecision = async ({ event, enriched, decision, draft = null, result = {}, deps }) => {
  const { prisma, ticketService } = deps;
  if (!enriched?.requester?.ref) {
    throw new ApplyError(
      `Cannot auto-apply: requester is unresolved (requesterRef="${enriched?.requesterRef ?? event?.requesterRef ?? ""}").`,
    );
  }
  const requesterId = enriched.requester.ref;
  const assigneeId =
    decision.assigneeRef != null && decision.assigneeRef !== ""
      ? (enriched.agentPool ?? []).some((a) => a?.ref === decision.assigneeRef)
        ? decision.assigneeRef
        : (() => {
            throw new ApplyError(
              `assigneeRef "${decision.assigneeRef}" is not in the assignable agent pool; refusing to apply.`,
            );
          })()
      : null;

  const ticket = await ticketService.createTicket({
    data: {
      subject: decision.subject,
      description: draft?.description ?? enriched?.body ?? null,
      type: decision.type,
      priority: decision.priority,
      requesterId,
      assigneeId,
      orgId: enriched?.orgId ?? event?.orgId ?? null,
      source: enriched?.channel ?? event?.channel ?? "UNKNOWN",
    },
  });

  const insight = await prisma.ticketInsight.create({
    data: {
      ticketId: ticket.id,
      subject: decision.subject,
      type: decision.type,
      priority: decision.priority,
      assigneeId,
      confidence: result.confidence ?? decision.confidence ?? {},
      model: result.model ?? null,
      provider: result.provider ?? null,
      rawOutput: {
        decision,
        confidence: result.confidence ?? decision.confidence ?? null,
        source: result.status ?? null,
        draft: result.draft ?? null,
        draftId: result.draftId ?? null,
        usage: result.usage ?? null,
      },
      toolTrace: result.trace ?? {},
    },
  });

  await prisma.ingestionEvent.update({
    where: { id: event.id },
    data: {
      status: "PROCESSED",
      ticketId: ticket.id,
      processedAt: new Date(),
      error: null,
      suggestion: null,
      aiReviewRequired: false,
    },
  });

  return { ticketId: ticket.id, insightId: insight.id };
};

const recordReview = async ({ prisma, event, decision, result = {} }) => {
  const suggestion = {
    decision,
    confidence: result.confidence ?? decision.confidence ?? null,
    source: result.status ?? null,
    recordedAt: new Date().toISOString(),
  };
  const update = {
    status: "REVIEW",
    aiReviewRequired: true,
    error: null,
    suggestion,
  };
  if (event?.status === "REVIEW" && event.suggestion) {
    update.attempts = event.attempts ?? 0;
  }
  return prisma.ingestionEvent.update({ where: { id: event.id }, data: update });
};

const markFailed = async ({ prisma, event, error }) => {
  const message = error instanceof Error ? error.message : String(error);
  const truncated = message.length > 5000 ? `${message.slice(0, 4997)}...` : message;
  return prisma.ingestionEvent.update({
    where: { id: event.id },
    data: { status: "FAILED", error: truncated },
  });
};

module.exports = {
  applyDecision,
  recordReview,
  markFailed,
  ApplyError,
  MAX_IDENTIFIER_LENGTH,
};
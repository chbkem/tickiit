const { getAuth } = require("@clerk/express");

const ApiError = require("../utils/ApiError");
const asyncHandler = require("../middleware/asyncHandler");
const logger = require("../lib/logger");
const ticketService = require("../services/ticketService");
const { assertCanAccessTicket } = require("../utils/access");
const {
  assertUserExists,
  assertOrganizationExists,
  assertUserInOrganization,
  assertUserIsAdminInOrganization,
} = require("../services/clerkService");

const buildListWhere = (userId, orgId) =>
  orgId ? { orgId } : { OR: [{ requesterId: userId }, { assigneeId: userId }] };

exports.getTickets = asyncHandler(async (req, res) => {
  const { userId, orgId } = getAuth(req);

  const tickets = await ticketService.listTickets(buildListWhere(userId, orgId));

  const grouped = tickets.reduce((acc, ticket) => {
    const key = ticket.priority.toLowerCase();
    if (!acc[key]) acc[key] = [];
    acc[key].push(ticket);
    return acc;
  }, {});

  res.json(grouped);
});

exports.getTicketById = asyncHandler(async (req, res) => {
  const { userId, orgId } = getAuth(req);

  const ticket = await ticketService.findTicketById(req.params.id);
  if (!ticket) {
    throw new ApiError(404, "Ticket not found.");
  }

  assertCanAccessTicket(ticket, { userId, orgId });
  res.json(ticket);
});

exports.createTicket = asyncHandler(async (req, res) => {
  const { userId, orgId: sessionOrgId, orgRole: sessionOrgRole } = getAuth(req);
  const body = req.body;

  if (body.orgId && body.orgId !== sessionOrgId) {
    throw new ApiError(
      403,
      "Tickets can only be created in your active organization.",
    );
  }

  const orgId = sessionOrgId;

  const data = {
    subject: body.subject,
    description: body.description,
    status: body.status,
    priority: body.priority,
    type: body.type,
    source: body.source,
    dueAt: body.dueAt,
    orgId,
  };

  if (orgId) {
    const requesterId = body.requesterId ?? userId;
    if (requesterId !== userId) {
      await assertUserIsAdminInOrganization({ userId, orgId, sessionOrgId, sessionOrgRole });
      await assertUserExists(requesterId);
      await assertUserInOrganization(requesterId, orgId);
    }
    data.requesterId = requesterId;

    if (body.assigneeId) {
      await assertUserIsAdminInOrganization({ userId, orgId, sessionOrgId, sessionOrgRole });
      await assertUserExists(body.assigneeId);
      await assertUserInOrganization(body.assigneeId, orgId);
    }
    data.assigneeId = body.assigneeId ?? null;
  } else {
    if (body.requesterId && body.requesterId !== userId) {
      throw new ApiError(
        403,
        "Cannot create a ticket for another user without an active organization.",
      );
    }
    if (body.assigneeId && body.assigneeId !== userId) {
      throw new ApiError(
        403,
        "Cannot assign a ticket to another user without an active organization.",
      );
    }
    data.requesterId = userId;
    data.assigneeId = userId;
  }

  const ticket = await ticketService.createTicket({ data });

  logger.info("Ticket created", {
    ticketId: ticket.id,
    ticketNumber: ticket.ticketNumber,
    actorId: userId,
    orgId,
    requesterId: ticket.requesterId,
    assigneeId: ticket.assigneeId,
  });

  res.status(201).json(ticket);
});

exports.updateTicket = asyncHandler(async (req, res) => {
  const { userId, orgId: sessionOrgId, orgRole: sessionOrgRole } = getAuth(req);
  const body = req.body;

  const existing = await ticketService.findTicketById(req.params.id, { include: false });
  if (!existing) {
    throw new ApiError(404, "Ticket not found.");
  }

  assertCanAccessTicket(existing, { userId, orgId: sessionOrgId });

  const data = {};

  if (body.subject !== undefined) {
    data.subject = body.subject;
  }

  if (body.description !== undefined) {
    data.description = body.description;
  }

  if (body.status !== undefined) data.status = body.status;
  if (body.priority !== undefined) data.priority = body.priority;
  if (body.type !== undefined) data.type = body.type;
  if (body.source !== undefined) data.source = body.source;
  if (body.dueAt !== undefined) data.dueAt = body.dueAt;

  const finalOrgId = body.orgId !== undefined ? body.orgId : existing.orgId;

  if (body.requesterId !== undefined && body.requesterId !== existing.requesterId) {
    if (!finalOrgId) {
      throw new ApiError(403, "Requester cannot be changed on a personal ticket.");
    }
    await assertUserIsAdminInOrganization({
      userId,
      orgId: finalOrgId,
      sessionOrgId,
      sessionOrgRole,
    });
    await assertUserExists(body.requesterId);
    await assertUserInOrganization(body.requesterId, finalOrgId);
    data.requesterId = body.requesterId;
  }

  if (body.assigneeId !== undefined) {
    if (!finalOrgId) {
      if (body.assigneeId && body.assigneeId !== userId) {
        throw new ApiError(403, "Assignee cannot be changed on a personal ticket.");
      }
      data.assigneeId = userId;
    } else {
      await assertUserIsAdminInOrganization({
        userId,
        orgId: finalOrgId,
        sessionOrgId,
        sessionOrgRole,
      });
      if (body.assigneeId) {
        await assertUserExists(body.assigneeId);
        await assertUserInOrganization(body.assigneeId, finalOrgId);
      }
      data.assigneeId = body.assigneeId;
    }
  }

  if (body.orgId !== undefined) {
    if (body.orgId) {
      if (body.orgId !== sessionOrgId) {
        await assertOrganizationExists(body.orgId);
        await assertUserInOrganization(userId, body.orgId);
      }
      data.orgId = body.orgId;
    } else {
      data.orgId = null;
    }
  }

  if (finalOrgId === null) {
    data.requesterId = userId;
    data.assigneeId = userId;
  }

  const ticket = await ticketService.updateTicket(
    existing.id,
    ticketService.applyLifecycleTimestamps(data, existing),
  );

  logger.info("Ticket updated", {
    ticketId: ticket.id,
    actorId: userId,
    changes: Object.keys(data),
  });

  res.json(ticket);
});

exports.deleteTicket = asyncHandler(async (req, res) => {
  const { userId, orgId, orgRole } = getAuth(req);

  const existing = await ticketService.findTicketById(req.params.id, { include: false });
  if (!existing) {
    throw new ApiError(404, "Ticket not found.");
  }

  assertCanAccessTicket(existing, { userId, orgId });

  if (existing.orgId) {
    await assertUserIsAdminInOrganization({
      userId,
      orgId: existing.orgId,
      sessionOrgId: orgId,
      sessionOrgRole: orgRole,
    });
  }

  await ticketService.deleteTicket(existing.id);

  logger.info("Ticket deleted", {
    ticketId: existing.id,
    ticketNumber: existing.ticketNumber,
    actorId: userId,
    orgId: existing.orgId,
  });

  res.json({ message: "Ticket deleted successfully.", id: existing.id });
});
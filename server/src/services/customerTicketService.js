const prisma = require("../lib/prisma");
const ApiError = require("../utils/ApiError");
const {
  generateToken,
  hashToken,
  tokenHashPrefix,
  currentDate,
  expiresAtFor,
  isTokenUsable,
  isTokenWellFormed,
} = require("../utils/accessToken");
const { customerPortalBaseUrl } = require("../config/customerPortal");
const { DEFAULT_ORG_NAME } = require("../constants/organization");

const CUSTOMER_VISIBLE = ["PUBLIC", "CUSTOMER"];
const REPLYABLE_STATUSES = ["OPEN", "IN_PROGRESS", "ON_HOLD"];

const resolveDeps = ({ db = prisma, crypto: cryptoImpl, now, env } = {}) => ({
  db,
  tokenDeps: { crypto: cryptoImpl, now },
  env,
});

const issueAccessToken = async ({ ticketId }, options = {}) => {
  const { db, tokenDeps, env } = resolveDeps(options);
  const raw = generateToken(tokenDeps);
  const tokenHash = hashToken(raw, tokenDeps);
  const row = await db.ticketAccessToken.create({
    data: { tokenHash, ticketId, expiresAt: expiresAtFor(tokenDeps) },
  });
  return {
    token: raw,
    tokenHash,
    hashPrefix: tokenHashPrefix(raw, tokenDeps),
    expiresAt: row.expiresAt,
    url: `${customerPortalBaseUrl({ env })}/t/${raw}`,
  };
};

const findUsableToken = async (raw, options = {}) => {
  if (!isTokenWellFormed(raw)) return null;
  const { db, tokenDeps } = resolveDeps(options);
  const tokenHash = hashToken(raw, tokenDeps);
  const row = await db.ticketAccessToken.findUnique({ where: { tokenHash } });
  return row && isTokenUsable(row, tokenDeps) ? row : null;
};

const resolveTicketOrgName = async (ticket, options = {}) => {
  if (!ticket.formId) return DEFAULT_ORG_NAME;
  const { db } = resolveDeps(options);
  const form = await db.ticketForm.findUnique({ where: { id: ticket.formId } });
  return form?.orgName || DEFAULT_ORG_NAME;
};

const serializeTicket = (ticket, orgName) => ({
  ticketNumber: ticket.ticketNumber,
  subject: ticket.subject,
  description: ticket.description,
  status: ticket.status,
  priority: ticket.priority,
  type: ticket.type,
  createdAt: ticket.createdAt,
  updatedAt: ticket.updatedAt,
  orgName,
  requesterName: ticket.requesterName,
  comments: (ticket.comments || []).map((comment) => ({
    id: comment.id,
    authorId: comment.authorId,
    body: comment.body,
    createdAt: comment.createdAt,
  })),
});

const getCustomerTicket = async (raw, options = {}) => {
  const { db, tokenDeps } = resolveDeps(options);
  const tokenRow = await findUsableToken(raw, options);
  if (!tokenRow) return null;

  const ticket = await db.ticket.findUnique({
    where: { id: tokenRow.ticketId },
    include: {
      comments: {
        where: { visibility: { in: CUSTOMER_VISIBLE } },
        orderBy: { createdAt: "asc" },
      },
    },
  });
  if (!ticket) return null;

  await db.ticketAccessToken.update({
    where: { id: tokenRow.id },
    data: { lastUsedAt: currentDate(tokenDeps) },
  });

  return serializeTicket(ticket, await resolveTicketOrgName(ticket, options));
};

const createCustomerReply = async (raw, body, options = {}) => {
  const { db, tokenDeps } = resolveDeps(options);
  const tokenRow = await findUsableToken(raw, options);
  if (!tokenRow) return null;

  const ticket = await db.ticket.findUnique({ where: { id: tokenRow.ticketId } });
  if (!ticket) return null;

  if (!REPLYABLE_STATUSES.includes(ticket.status)) {
    throw new ApiError(409, "This ticket is closed to new replies.");
  }

  const authorId = `customer:${ticket.requesterKey || ticket.requesterId}`;
  const comment = await db.comment.create({
    data: { ticketId: ticket.id, authorId, body, visibility: "CUSTOMER" },
  });
  await db.ticket.update({
    where: { id: ticket.id },
    data: { updatedAt: currentDate(tokenDeps) },
  });
  await db.ticketAccessToken.update({
    where: { id: tokenRow.id },
    data: { lastUsedAt: currentDate(tokenDeps) },
  });
  return comment;
};

const revokeCustomerLinks = async (ticketId, options = {}) => {
  const { db, tokenDeps } = resolveDeps(options);
  const now = currentDate(tokenDeps);
  const result = await db.ticketAccessToken.updateMany({
    where: { ticketId, revokedAt: null, expiresAt: { gt: now } },
    data: { revokedAt: now },
  });
  return result.count;
};

module.exports = {
  CUSTOMER_VISIBLE,
  REPLYABLE_STATUSES,
  issueAccessToken,
  findUsableToken,
  resolveTicketOrgName,
  getCustomerTicket,
  createCustomerReply,
  revokeCustomerLinks,
};

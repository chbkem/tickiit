const { test, describe } = require("node:test");
const assert = require("node:assert/strict");
const ApiError = require("../utils/ApiError");
const { generateToken, hashToken, TOKEN_TTL_MS } = require("../utils/accessToken");
const service = require("./customerTicketService");

const NOW = Date.UTC(2026, 10, 19, 12, 0, 0);
const deps = () => ({ now: () => NOW, env: { CUSTOMER_PORTAL_BASE_URL: "https://support.example.com/" } });
const raw = generateToken();
const tokenHash = hashToken(raw);
const tokenRow = {
  id: "tok-1",
  tokenHash,
  ticketId: "ticket-1",
  expiresAt: new Date(NOW + TOKEN_TTL_MS),
  revokedAt: null,
};
const ticket = {
  id: "ticket-1",
  ticketNumber: "#0007",
  subject: "Help",
  description: "Something broke",
  status: "OPEN",
  priority: "MEDIUM",
  type: "TASK",
  createdAt: new Date(NOW - 2000),
  updatedAt: new Date(NOW - 1000),
  requesterName: "Ada",
  requesterKey: "key-1",
  requesterId: "user-1",
  formId: "form-1",
};
const comments = [
  { id: "c-1", authorId: "staff-1", body: "public reply", visibility: "PUBLIC", createdAt: new Date(NOW - 500) },
  { id: "c-2", authorId: "staff-1", body: "internal note", visibility: "INTERNAL", createdAt: new Date(NOW - 400) },
  { id: "c-3", authorId: "customer:key-1", body: "customer reply", visibility: "CUSTOMER", createdAt: new Date(NOW - 300) },
];

const makeDb = (overrides = {}) => ({
  ticketAccessToken: {
    create: async ({ data }) => ({ id: "tok-new", ...data }),
    findUnique: async () => tokenRow,
    update: async () => ({}),
    updateMany: async () => ({ count: 2 }),
    ...(overrides.ticketAccessToken || {}),
  },
  ticket: {
    findUnique: async () => ({ ...ticket }),
    update: async () => ({}),
    ...(overrides.ticket || {}),
  },
  ticketForm: {
    findUnique: async () => ({ orgName: "Acme Support" }),
    ...(overrides.ticketForm || {}),
  },
  comment: {
    create: async ({ data }) => ({ id: "c-new", ...data }),
    ...(overrides.comment || {}),
  },
});

describe("customerTicketService", () => {
  test("issues one token, stores only its hash, and builds the portal url", async () => {
    let stored;
    const db = makeDb({
      ticketAccessToken: {
        create: async ({ data }) => {
          stored = data;
          return { id: "tok-new", ...data };
        },
      },
    });
    const access = await service.issueAccessToken({ ticketId: ticket.id }, { ...deps(), db });

    assert.equal(stored.tokenHash, hashToken(access.token));
    assert.equal(stored.tokenHash.includes(access.token), false);
    assert.equal(stored.ticketId, ticket.id);
    assert.match(access.url, /^https:\/\/support\.example\.com\/t\/[A-Za-z0-9_-]{43}$/);
    assert.equal(access.expiresAt.getTime(), NOW + TOKEN_TTL_MS);
  });

  test("the customer view filters internal comments and resolves the form org name", async () => {
    let findArgs;
    const db = makeDb({
      ticket: {
        findUnique: async (args) => {
          findArgs = args;
          const visible = args.include.comments.where.visibility.in;
          return { ...ticket, comments: comments.filter((item) => visible.includes(item.visibility)) };
        },
      },
    });

    const view = await service.getCustomerTicket(raw, { ...deps(), db });
    assert.deepEqual(findArgs.include.comments.where.visibility.in, ["PUBLIC", "CUSTOMER"]);
    assert.deepEqual(view.comments.map((item) => item.id), ["c-1", "c-3"]);
    assert.equal(view.orgName, "Acme Support");
    assert.equal(view.ticketNumber, "#0007");
  });

  test("falls back to the default org name when no form is linked", async () => {
    const db = makeDb({ ticketForm: { findUnique: async () => null } });
    const view = await service.getCustomerTicket(raw, { ...deps(), db });
    assert.equal(view.orgName, "our support team");
  });

  test("expired, revoked and malformed links resolve to null", async () => {
    const expiredDb = makeDb({
      ticketAccessToken: { findUnique: async () => ({ ...tokenRow, expiresAt: new Date(NOW - 1) }) },
    });
    const revokedDb = makeDb({
      ticketAccessToken: { findUnique: async () => ({ ...tokenRow, revokedAt: new Date(NOW - 10) }) },
    });
    assert.equal(await service.getCustomerTicket(raw, { ...deps(), db: expiredDb }), null);
    assert.equal(await service.getCustomerTicket(raw, { ...deps(), db: revokedDb }), null);
    assert.equal(await service.getCustomerTicket("short", { ...deps(), db: makeDb() }), null);
  });

  test("a customer reply is server assigned CUSTOMER with a customer author id", async () => {
    let createArgs;
    let updateArgs;
    const db = makeDb({
      comment: {
        create: async ({ data }) => {
          createArgs = data;
          return { id: "c-new", ...data };
        },
      },
      ticket: {
        findUnique: async () => ({ ...ticket }),
        update: async (args) => {
          updateArgs = args;
          return {};
        },
      },
    });

    const comment = await service.createCustomerReply(raw, "More detail", { ...deps(), db });
    assert.equal(createArgs.visibility, "CUSTOMER");
    assert.equal(createArgs.authorId, "customer:key-1");
    assert.equal(createArgs.body, "More detail");
    assert.equal(comment.id, "c-new");
    assert.equal(updateArgs.data.updatedAt.getTime(), NOW);
  });

  test("a reply to a resolved ticket is rejected with 409 and writes no comment", async () => {
    let createCalled = false;
    const db = makeDb({
      ticket: { findUnique: async () => ({ ...ticket, status: "RESOLVED" }) },
      comment: {
        create: async () => {
          createCalled = true;
          return null;
        },
      },
    });

    await assert.rejects(
      () => service.createCustomerReply(raw, "Too late", { ...deps(), db }),
      (error) => error instanceof ApiError && error.statusCode === 409,
    );
    assert.equal(createCalled, false);
  });

  test("revocation only touches unexpired live links", async () => {
    let updateArgs;
    const db = makeDb({
      ticketAccessToken: {
        updateMany: async (args) => {
          updateArgs = args;
          return { count: 2 };
        },
      },
    });

    assert.equal(await service.revokeCustomerLinks(ticket.id, { ...deps(), db }), 2);
    assert.equal(updateArgs.where.ticketId, ticket.id);
    assert.equal(updateArgs.where.revokedAt, null);
    assert.equal(updateArgs.where.expiresAt.gt.getTime(), NOW);
    assert.equal(updateArgs.data.revokedAt.getTime(), NOW);
  });
});

const { test, describe } = require("node:test");
const assert = require("node:assert/strict");
const { applyDecision, recordReview, markFailed, ApplyError } = require("./apply");

const createdTickets = [];
const createdInsights = [];
const updatedEvents = [];

const fakeTicketService = {
  createTicket: async ({ data }) => {
    const id = `t-${createdTickets.length + 1}`;
    const ticket = { id, ...data, ticketNumber: `TK-${id}` };
    createdTickets.push(ticket);
    return ticket;
  },
};

const makePrisma = () => ({
  ticketInsight: {
    create: async ({ data }) => {
      const id = `ins-${createdInsights.length + 1}`;
      const insight = { id, ...data };
      createdInsights.push(insight);
      return insight;
    },
  },
  ingestionEvent: {
    update: async ({ where, data }) => {
      updatedEvents.push({ id: where.id, data });
      return { ...where, ...data };
    },
  },
});

describe("applyDecision", () => {
  const event = { id: "ev-1", channel: "email", orgId: "org_1", requesterRef: "ext-ada" };
  const enriched = {
    requester: { ref: "user_1", name: "Ada Lovelace", email: "ada@example.com", role: null },
    agentPool: [{ ref: "user_agent", name: "Agent", role: "admin", openTicketCount: 0 }],
    orgId: "org_1",
    channel: "email",
    body: "original body text",
  };
  const decision = { subject: "VPN down", type: "INCIDENT", priority: "HIGH", assigneeRef: "user_agent", rationale: "outage" };
  const draft = { description: "Full body from draft tool", assigneeRef: "user_agent" };
  const result = { status: "finalized", confidence: { score: 0.85 }, model: "gpt-4o", provider: "openai-compatible", trace: { turns: 2 } };

  test("creates ticket and insight, then marks the event PROCESSED", async () => {
    createdTickets.length = 0;
    createdInsights.length = 0;
    updatedEvents.length = 0;
    const deps = { prisma: makePrisma(), ticketService: fakeTicketService };
    const out = await applyDecision({ event, enriched, decision, draft, result, deps });
    assert.equal(out.ticketId, "t-1");
    assert.equal(out.insightId, "ins-1");
    assert.equal(createdTickets[0].subject, "VPN down");
    assert.equal(createdTickets[0].description, "Full body from draft tool");
    assert.equal(createdTickets[0].requesterId, "user_1");
    assert.equal(createdTickets[0].assigneeId, "user_agent");
    assert.equal(createdTickets[0].source, "email");
    assert.equal(createdInsights[0].confidence.score, 0.85);
    assert.equal(createdInsights[0].provider, "openai-compatible");
    const update = updatedEvents.find((e) => e.id === "ev-1");
    assert.equal(update.data.status, "PROCESSED");
    assert.equal(update.data.ticketId, "t-1");
    assert.equal(update.data.error, null);
    assert.equal(update.data.suggestion, null);
  });

  test("falls back to enriched.body for description when draft is absent", async () => {
    createdTickets.length = 0;
    createdInsights.length = 0;
    updatedEvents.length = 0;
    const deps = { prisma: makePrisma(), ticketService: fakeTicketService };
    const noDraft = { subject: decision.subject, type: decision.type, priority: decision.priority, assigneeRef: null, rationale: "none" };
    await applyDecision({ event, enriched, decision: noDraft, draft: null, result, deps });
    assert.equal(createdTickets[0].description, "original body text");
    assert.equal(createdTickets[0].assigneeId, null);
  });

  test("rejects an assigneeRef not in the agent pool", async () => {
    createdTickets.length = 0;
    updatedEvents.length = 0;
    const deps = { prisma: makePrisma(), ticketService: fakeTicketService };
    await assert.rejects(
      () => applyDecision({ event, enriched, decision: { ...decision, assigneeRef: "user_unknown" }, draft, result, deps }),
      (err) => err instanceof ApplyError && /user_unknown/.test(err.message),
    );
    assert.equal(createdTickets.length, 0);
  });

  test("throws ApplyError when the requester is unresolved", async () => {
    createdTickets.length = 0;
    updatedEvents.length = 0;
    const deps = { prisma: makePrisma(), ticketService: fakeTicketService };
    await assert.rejects(
      () => applyDecision({ event, enriched: { ...enriched, requester: null }, decision, draft, result, deps }),
      (err) => err instanceof ApplyError && /requester/i.test(err.message),
    );
    assert.equal(createdTickets.length, 0);
  });
});

describe("recordReview", () => {
  test("writes aiReviewRequired and the suggestion object onto the event", async () => {
    updatedEvents.length = 0;
    const prisma = makePrisma();
    const event = { id: "ev-2", status: "PENDING" };
    const decision = { subject: "VPN", type: "REQUEST", priority: "MEDIUM", assigneeRef: null, rationale: "r" };
    const result = { confidence: { score: 0.5 }, status: "fallback" };
    await recordReview({ prisma, event, decision, result });
    const update = updatedEvents.find((e) => e.id === "ev-2");
    assert.equal(update.data.status, "REVIEW");
    assert.equal(update.data.aiReviewRequired, true);
    assert.deepEqual(update.data.suggestion.decision, decision);
    assert.equal(update.data.suggestion.confidence.score, 0.5);
    assert.equal(update.data.suggestion.source, "fallback");
    assert.ok(update.data.suggestion.recordedAt);
  });
});

describe("markFailed", () => {
  test("writes a truncated error message and FAILED status", async () => {
    updatedEvents.length = 0;
    const prisma = makePrisma();
    await markFailed({ prisma, event: { id: "ev-3" }, error: new ApplyError("requester missing") });
    const update = updatedEvents.find((e) => e.id === "ev-3");
    assert.equal(update.data.status, "FAILED");
    assert.match(update.data.error, /requester missing/);
  });
});
const { test, describe } = require("node:test");
const assert = require("node:assert/strict");
const {
  claimEvent,
  decideDisposition,
  resolveProvider,
  isDeterministic,
  DEFAULT_CONFIDENCE_THRESHOLD,
  DEFAULT_MAX_EVENT_ATTEMPTS,
} = require("./runner");

const makeClaimPrisma = (existingEvents = {}) => {
  const updates = [];
  const events = new Map(Object.entries(existingEvents).map(([id, ev]) => [id, { ...ev }]));
  return {
    _updates: updates,
    ingestionEvent: {
      findUnique: async ({ where }) => {
        const ev = events.get(where.id);
        return ev ? { ...ev } : null;
      },
      updateMany: async ({ where, data }) => {
        const event = events.get(where.id);
        if (!event) return { count: 0 };
        const statusMatch = !where.status || event.status === where.status;
        const attemptsMatch = where.attempts == null || event.attempts === where.attempts;
        if (!statusMatch || !attemptsMatch) return { count: 0 };
        Object.assign(event, data);
        updates.push({ id: where.id, data });
        return { count: 1 };
      },
      update: async ({ where, data }) => {
        const event = events.get(where.id);
        if (event) Object.assign(event, data);
        updates.push({ id: where.id, data });
        return { ...where, ...data };
      },
    },
  };
};

describe("isDeterministic", () => {
  test("detects fallback provider results and internal fallback usage", () => {
    assert.ok(isDeterministic({ provider: "fallback-deterministic" }));
    assert.ok(isDeterministic({ provider: "openai-compatible", fallback: { used: true } }));
    assert.ok(!isDeterministic({ provider: "openai-compatible" }));
    assert.ok(!isDeterministic(null));
    assert.ok(!isDeterministic({ provider: "openai-compatible", fallback: { used: false } }));
  });
});

describe("claimEvent", () => {
  test("optimistically claims an event by incrementing attempts atomically", async () => {
    const prisma = makeClaimPrisma({ ev1: { id: "ev1", status: "PENDING", attempts: 0 } });
    const claimed = await claimEvent({ prisma, eventId: "ev1" });
    assert.equal(claimed.status, "PROCESSING");
    assert.equal(claimed.attempts, 1);
    assert.equal(prisma._updates[0].data.attempts, 1);
  });

  test("returns null when another worker already claimed (concurrent update)", async () => {
    const prisma = makeClaimPrisma({ ev1: { id: "ev1", status: "PENDING", attempts: 0 } });
    const first = await claimEvent({ prisma, eventId: "ev1" });
    assert.ok(first);
    const second = await claimEvent({ prisma, eventId: "ev1" });
    assert.equal(second, null);
  });

  test("returns null for missing, already PROCESSED events, and unknown ids", async () => {
    const prisma = makeClaimPrisma({ ev2: { id: "ev2", status: "PROCESSED", attempts: 3 } });
    assert.equal(await claimEvent({ prisma, eventId: "missing" }), null);
    assert.equal(await claimEvent({ prisma, eventId: "ev2" }), null);
  });
});

describe("decideDisposition", () => {
  const makeBreaker = (open) => ({ isOpen: () => open, recordFailure: () => {}, recordSuccess: () => {} });

  test("applies high-confidence model decisions when the breaker is closed", () => {
    const opts = { breaker: makeBreaker(false), env: { AI_CONFIDENCE_THRESHOLD: "0.7" } };
    assert.equal(decideDisposition({ result: { confidence: { score: 0.85 }, provider: "openai-compatible" }, ...opts }), "APPLY");
    assert.equal(decideDisposition({ result: { confidence: { score: 0.4 }, provider: "openai-compatible" }, ...opts }), "REVIEW");
  });

  test("forces REVIEW when the breaker is open, even for high model confidence", () => {
    const opts = { breaker: makeBreaker(true), env: {} };
    assert.equal(decideDisposition({ result: { confidence: { score: 0.9 }, provider: "openai-compatible" }, ...opts }), "REVIEW");
  });

  test("routes deterministic fallbacks to REVIEW by default", () => {
    const result = { confidence: { score: 0.5 }, provider: "fallback-deterministic" };
    assert.equal(decideDisposition({ result, breaker: makeBreaker(false), env: {} }), "REVIEW");
  });

  test("applies deterministic fallback only when AI_FALLBACK_MODE=deterministic and breaker is closed", () => {
    const result = { confidence: { score: 0.5 }, provider: "fallback-deterministic" };
    const closed = { breaker: makeBreaker(false), env: { AI_FALLBACK_MODE: "deterministic" } };
    const open = { breaker: makeBreaker(true), env: { AI_FALLBACK_MODE: "deterministic" } };
    assert.equal(decideDisposition({ result, ...closed }), "APPLY");
    assert.equal(decideDisposition({ result, ...open }), "REVIEW");
  });
});

describe("resolveProvider", () => {
  test("selects the model when AI_ENABLED, base+model are set, and breaker is closed", () => {
    const env = { AI_ENABLED: "true", AI_BASE_URL: "http://localhost", AI_MODEL: "gpt-4o" };
    const out = resolveProvider({ env, breaker: { isOpen: () => false } });
    assert.equal(out.mode, "model");
    assert.equal(out.provider.providerId, "openai-compatible");
  });

  test("falls back when AI_ENABLED is false, base/model missing, or breaker is open", () => {
    const noModel = resolveProvider({ env: { AI_ENABLED: "true" }, breaker: { isOpen: () => false } });
    const disabled = resolveProvider({ env: { AI_ENABLED: "false", AI_BASE_URL: "u", AI_MODEL: "m" }, breaker: { isOpen: () => false } });
    const open = resolveProvider({ env: { AI_ENABLED: "true", AI_BASE_URL: "u", AI_MODEL: "m" }, breaker: { isOpen: () => true } });
    for (const out of [noModel, disabled, open]) {
      assert.equal(out.mode, "fallback");
      assert.equal(out.provider.providerId, "fallback-deterministic");
    }
  });
});

describe("runner constants", () => {
  test("defaults are sane", () => {
    assert.equal(DEFAULT_CONFIDENCE_THRESHOLD, 0.7);
    assert.equal(DEFAULT_MAX_EVENT_ATTEMPTS, 4);
  });
});
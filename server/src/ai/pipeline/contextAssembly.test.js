const { test, describe } = require("node:test");
const assert = require("node:assert/strict");
const {
  buildRuntimeContext,
  DEFAULT_SECTION_CAPS,
  MAX_BODY_TOKENS,
  estimateTokens,
  renderBaseContext,
  renderRequester,
  renderAgents,
  renderPolicy,
  renderKnowledge,
} = require("./contextAssembly");

const ENRICHED = {
  subject: "Reset password broken",
  body: "The reset email never arrives.",
  requesterRef: "user_1",
  orgId: "org_1",
  requester: { ref: "user_1", name: "Ada Lovelace", email: "ada@example.com", role: "admin" },
  openTicketCount: 2,
  totalTicketCount: 5,
  recentTickets: [
    { id: "t-1", subject: "Login fails", status: "OPEN", priority: "HIGH", type: "BUG", createdAt: "2026-01-05" },
    { id: "t-2", subject: "Slow upload", status: "RESOLVED", priority: "MEDIUM", type: "TASK", createdAt: "2026-01-01" },
  ],
  knowledge: [
    { title: "Password reset", snippet: "Reset emails go to the primary address.", relevance: "high" },
  ],
  agentPool: [
    { ref: "user_a", name: "Alice", role: "admin", openTicketCount: 1 },
    { ref: "user_b", name: "Bob", role: "agent", openTicketCount: 3 },
  ],
  orgPolicy: { orgName: "Acme", policy: { sla: { responseHours: 2 }, defaultPriority: "HIGH" } },
};

describe("buildRuntimeContext", () => {
  test("passes subject/body/requesterRef, propagates allowedAssignees, and includes all sections at a generous budget", () => {
    const { context, meta } = buildRuntimeContext({ enriched: ENRICHED, budgetTokens: 4000 });
    assert.equal(context.subject, "Reset password broken");
    assert.equal(context.body, "The reset email never arrives.");
    assert.equal(context.requesterRef, "user_1");
    assert.equal(context.orgId, "org_1");
    assert.deepEqual(context.allowedAssignees, ["user_a", "user_b"]);
    assert.deepEqual(meta.allowedAssignees, ["user_a", "user_b"]);
    assert.deepEqual(meta.included.sort(), ["agents", "knowledge", "policy", "requester"].sort());
    assert.deepEqual(meta.truncated, []);
    assert.equal(typeof context.extra.requester, "string");
    assert.match(context.extra.requester, /Ada Lovelace/);
    assert.match(context.extra.agents, /user_a/);
    assert.match(context.extra.policy, /response \(hours\): 2/);
    assert.match(context.extra.knowledge, /Password reset/);
  });

  test("drops later sections when the budget runs out and reports truncation", () => {
    const { context, meta } = buildRuntimeContext({ enriched: ENRICHED, budgetTokens: 30 });
    assert.equal(meta.included.length > 0, true);
    assert.ok(meta.truncated.length > 0, "expected truncation to be reported");
    assert.ok(meta.estimatedTokens <= meta.budgetTokens, "budget must not be exceeded");
    assert.ok(
      meta.included.every((name) => estimateTokens(context.extra[name]) <= (DEFAULT_SECTION_CAPS[name] ?? 400)),
    );
  });

  test("caps body length to MAX_BODY_TOKENS and records body as truncated", () => {
    const hugeBody = "x".repeat(MAX_BODY_TOKENS * 4 * 2);
    const { context, meta } = buildRuntimeContext({ enriched: { ...ENRICHED, body: hugeBody }, budgetTokens: 4000 });
    assert.ok(context.body.length < hugeBody.length);
    assert.match(context.body, /…$/);
    assert.ok(meta.truncated.includes("body"));
  });

  test("sanitizes markup in subject and sections", () => {
    const { context } = buildRuntimeContext({
      enriched: { ...ENRICHED, subject: "Reset <b>broken</b>" },
      budgetTokens: 4000,
    });
    assert.equal(context.subject, "Reset broken");
  });

  test("null enrichment yields an empty but valid context", () => {
    const { context, meta } = buildRuntimeContext({ enriched: {}, budgetTokens: 100 });
    assert.equal(context.subject, null);
    assert.equal(context.body, "");
    assert.equal(context.requesterRef, null);
    assert.equal(context.allowedAssignees, null);
    assert.deepEqual(context.extra, {});
    assert.equal(meta.included.length, 0);
  });

  test("empty pool yields [] (nothing assignable); absent pool yields null", () => {
    const emptyPool = buildRuntimeContext({ enriched: { ...ENRICHED, agentPool: [] }, budgetTokens: 4000 });
    assert.deepEqual(emptyPool.context.allowedAssignees, []);
    const { agentPool, ...withoutPool } = ENRICHED;
    const absent = buildRuntimeContext({ enriched: withoutPool, budgetTokens: 4000 });
    assert.equal(absent.context.allowedAssignees, null);
  });
});

describe("renderers", () => {
  test("renderBaseContext skips empty fields", () => {
    assert.equal(renderBaseContext({ subject: "S", body: "B", requesterRef: null }), "Subject: S\n\nBody:\nB");
  });
  test("renderRequester includes ticket bullets", () => {
    const text = renderRequester(ENRICHED);
    assert.match(text, /Open tickets: 2/);
    assert.match(text, /- \[OPEN \/ HIGH\] Login fails \(2026-01-05\)/);
  });
  test("renderAgents sorts by workload", () => {
    const text = renderAgents(ENRICHED.agentPool);
    assert.match(text, /user_a \| Alice/);
    const a = text.indexOf("user_a");
    const b = text.indexOf("user_b");
    assert.ok(a < b);
  });
  test("renderPolicy renders SLA metrics", () => {
    const text = renderPolicy(ENRICHED.orgPolicy);
    assert.match(text, /SLA response \(hours\): 2/);
    assert.match(text, /Default priority: HIGH/);
  });
  test("renderKnowledge lists hits with relevance", () => {
    const text = renderKnowledge(ENRICHED.knowledge);
    assert.match(text, /\[high\] Password reset/);
  });
});
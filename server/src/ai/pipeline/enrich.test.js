const { test, describe } = require("node:test");
const assert = require("node:assert/strict");
const {
  enrich,
  resolveUserByRef,
  loadRequesterContext,
  loadAgentPool,
  loadOrgPolicy,
  loadKnowledgeHits,
  createClerkRequesterStore,
  createClerkAgentPoolService,
  MAX_RECENT_TICKETS,
} = require("./enrich");

const notFound = () => {
  const error = new Error("User not found");
  error.status = 404;
  throw error;
};

const makeClerk = ({ users = [], memberships = [], org = null, orgThrows = false } = {}) => ({
  users: {
    getUser: async (id) => {
      const user = users.find((u) => u.id === id);
      if (!user) notFound();
      return user;
    },
    getUserList: async ({ externalId }) => ({
      data: users.filter((u) => u.externalId === externalId?.[0]),
    }),
  },
  organizations: {
    getOrganizationMembershipList: async () => ({ data: memberships }),
    getOrganization: async () => {
      if (orgThrows) throw new Error("boom");
      return org;
    },
  },
});

const tickets = [
  { id: "t1", subject: "Printer jammed", status: "OPEN", priority: "MEDIUM", type: "REQUEST", requesterId: "user_1", assigneeId: "user_2", orgId: "org_1", createdAt: new Date("2026-01-01") },
  { id: "t2", subject: "VPN", status: "ON_HOLD", priority: "HIGH", type: "INCIDENT", requesterId: "user_1", assigneeId: "user_2", orgId: "org_1", createdAt: new Date("2026-01-02") },
  { id: "t3", subject: "Old", status: "CLOSED", priority: "LOW", type: "REQUEST", requesterId: "user_1", assigneeId: null, orgId: "org_1", createdAt: new Date("2025-12-01") },
];

const makePrisma = () => ({
  ticket: {
    count: async ({ where }) => {
      const { requesterId, orgId, status } = where;
      if (status == null) {
        return tickets.filter((t) => t.requesterId === requesterId && t.orgId === orgId).length;
      }
      return tickets.filter(
        (t) => t.requesterId === requesterId && t.orgId === orgId && (status.in ?? []).includes(t.status),
      ).length;
    },
    findMany: async ({ where, take }) =>
      tickets
        .filter((t) => t.requesterId === where.requesterId && t.orgId === where.orgId)
        .sort((a, b) => b.createdAt - a.createdAt)
        .slice(0, take),
    groupBy: async ({ by, where, _count }) => {
      assert.deepEqual(by, ["assigneeId"]);
      const counts = new Map();
      for (const t of tickets) {
        if (t.orgId !== where.orgId || !t.assigneeId || !where.status.in.includes(t.status)) continue;
        counts.set(t.assigneeId, (counts.get(t.assigneeId) ?? 0) + 1);
      }
      return [...counts.entries()].map(([assigneeId, count]) => ({ assigneeId, _count: { _all: count } }));
    },
  },
});

const users = [
  { id: "user_1", firstName: "Ada", lastName: "Lovelace", emailAddresses: [{ emailAddress: "ada@example.com" }], externalId: "ext-ada" },
  { id: "user_2", firstName: "Grace", lastName: "Hopper", emailAddresses: [{ emailAddress: "grace@example.com" }], externalId: null },
  { id: "user_3", firstName: "Linus", lastName: "Torvalds", emailAddresses: [], externalId: "ext-linus" },
];

describe("resolveUserByRef", () => {
  test("resolves user_* refs via users.getUser", async () => {
    const clerkClient = makeClerk({ users });
    const user = await resolveUserByRef({ clerkClient, requesterRef: "user_2" });
    assert.equal(user.id, "user_2");
  });

  test("resolves non-Clerk refs via externalId lookup", async () => {
    const clerkClient = makeClerk({ users });
    const user = await resolveUserByRef({ clerkClient, requesterRef: "ext-ada" });
    assert.equal(user.id, "user_1");
  });

  test("treats 404 and empty lookups as resolvable-to-null, not errors", async () => {
    const clerkClient = makeClerk({ users });
    assert.equal(await resolveUserByRef({ clerkClient, requesterRef: "user_missing" }), null);
    assert.equal(await resolveUserByRef({ clerkClient, requesterRef: "ext-unknown" }), null);
    assert.equal(await resolveUserByRef({ clerkClient, requesterRef: "" }), null);
    assert.equal(await resolveUserByRef({ clerkClient, requesterRef: null }), null);
  });
});

describe("loadRequesterContext", () => {
  test("combines profile, counts, and recent tickets, capped and cleaned", async () => {
    const clerkClient = makeClerk({ users });
    const prisma = makePrisma();
    const ctx = await loadRequesterContext({ prisma, clerkClient, orgId: "org_1", requesterRef: "user_1" });
    assert.equal(ctx.requester.ref, "user_1");
    assert.equal(ctx.requester.name, "Ada Lovelace");
    assert.equal(ctx.requester.email, "ada@example.com");
    assert.equal(ctx.openTicketCount, 2);
    assert.equal(ctx.totalTicketCount, 3);
    assert.equal(ctx.recentTickets.length, Math.min(MAX_RECENT_TICKETS, 3));
    assert.deepEqual(ctx.recentTickets[0].subject, "VPN");
  });

  test("returns an empty-safe shape when the requester is unknown", async () => {
    const ctx = await loadRequesterContext({
      prisma: makePrisma(),
      clerkClient: makeClerk({ users }),
      orgId: "org_1",
      requesterRef: "user_missing",
    });
    assert.deepEqual(ctx, { requester: null, openTicketCount: 0, totalTicketCount: 0, recentTickets: [] });
  });
});

describe("loadAgentPool", () => {
  const memberships = [
    { role: "admin", publicUserData: { userId: "user_1", firstName: "Ada", lastName: "Lovelace" } },
    { role: "member", publicUserData: { userId: "user_2", firstName: "Grace", lastName: "Hopper" } },
    { role: "member", publicUserData: { userId: "user_3", firstName: "Linus", lastName: "Torvalds" } },
  ];

  test("excludes the requester, ranks by open workload ascending", async () => {
    const prisma = makePrisma();
    const pool = await loadAgentPool({ prisma, clerkClient: makeClerk({ users, memberships }), orgId: "org_1", requesterRef: "user_1" });
    assert.deepEqual(pool.map((a) => a.ref), ["user_3", "user_2"]);
    assert.equal(pool[0].openTicketCount, 0);
    assert.equal(pool[1].openTicketCount, 2);
    assert.equal(pool[0].name, "Linus Torvalds");
  });

  test("returns an empty pool without an org (personal tickets)", async () => {
    const pool = await loadAgentPool({ prisma: makePrisma(), clerkClient: makeClerk({ users, memberships }), orgId: null, requesterRef: "user_1" });
    assert.deepEqual(pool, []);
  });

  test("drops memberships without a resolvable userId", async () => {
    const dirty = [
      { role: "member", publicUserData: { userId: null, firstName: null, lastName: null } },
      { role: "member", publicUserData: { userId: "user_2", firstName: "Grace", lastName: "Hopper" } },
    ];
    const pool = await loadAgentPool({ prisma: makePrisma(), clerkClient: makeClerk({ users, memberships: dirty }), orgId: "org_1", requesterRef: "user_1" });
    assert.deepEqual(pool.map((a) => a.ref), ["user_2"]);
  });
});

describe("loadOrgPolicy", () => {
  test("reads triagePolicy from org publicMetadata and cleans it", async () => {
    const org = {
      name: " Acme <b>Corp</b> ",
      publicMetadata: {
        triagePolicy: {
          sla: { responseHours: 4 },
          defaultPriority: "HIGH",
          defaultType: "INCIDENT",
          notes: "Hipaa-ish",
        },
      },
    };
    const policy = await loadOrgPolicy({ clerkClient: makeClerk({ org }), orgId: "org_1" });
    assert.equal(policy.source, "clerk");
    assert.equal(policy.orgName, "Acme Corp");
    assert.deepEqual(policy.policy.sla, { responseHours: 4, resolutionHours: null });
    assert.equal(policy.policy.defaultPriority, "HIGH");
  });

  test("falls back to a deterministic default when the org lookup fails or is missing", async () => {
    const failing = await loadOrgPolicy({ clerkClient: makeClerk({ orgThrows: true }), orgId: "org_x" });
    const missing = await loadOrgPolicy({ clerkClient: makeClerk({ org: null }), orgId: "org_x" });
    const personal = await loadOrgPolicy({ clerkClient: makeClerk({ org: null }), orgId: null });
    for (const policy of [failing, missing, personal]) {
      assert.equal(policy.source, "default");
      assert.equal(policy.policy.defaultPriority, "MEDIUM");
      assert.equal(policy.policy.defaultType, "REQUEST");
    }
    assert.equal(personal.orgId, null);
  });
});

describe("loadKnowledgeHits", () => {
  test("queries the retriever with subject+body and returns hits", async () => {
    let called = null;
    const retriever = {
      search: async (args) => {
        called = args;
        return { hits: [{ title: "VPN setup", snippet: "step one", relevance: 0.9 }] };
      },
    };
    const hits = await loadKnowledgeHits({ knowledgeRetriever: retriever, orgId: "org_1", subject: "VPN", body: "cannot connect" });
    assert.equal(hits.length, 1);
    assert.equal(called.orgId, "org_1");
    assert.equal(called.limit, 6);
    assert.match(called.query, /VPN/);
  });

  test("returns [] when no retriever is configured or query is empty", async () => {
    assert.deepEqual(await loadKnowledgeHits({ knowledgeRetriever: null, orgId: "org_1", subject: "VPN", body: "" }), []);
    assert.deepEqual(await loadKnowledgeHits({ knowledgeRetriever: { search: async () => ({ hits: [1] }) }, orgId: "org_1", subject: "", body: "" }), []);
  });
});

describe("enrich", () => {
  test("assembles the contextAssembly-fixture shape from a normalized payload", async () => {
    const clerkClient = makeClerk({
      users,
      memberships: [
        { role: "member", publicUserData: { userId: "user_2", firstName: "Grace", lastName: "Hopper" } },
        { role: "member", publicUserData: { userId: "user_3", firstName: "Linus", lastName: "Torvalds" } },
      ],
      org: { name: "Acme", publicMetadata: { triagePolicy: { sla: { responseHours: 8 } } } },
    });
    const knowledgeRetriever = { search: async () => ({ hits: [{ title: "VPN", snippet: "s", relevance: 0.5 }] }) };
    const enriched = await enrich({
      normalized: {
        subject: "VPN down",
        body: "Cannot connect from the office",
        requesterRef: "user_1",
        orgId: "org_1",
        channel: "email",
      },
      deps: { prisma: makePrisma(), clerkClient, knowledgeRetriever },
    });

    assert.equal(enriched.channel, "email");
    assert.equal(enriched.requester.ref, "user_1");
    assert.equal(enriched.openTicketCount, 2);
    assert.equal(enriched.totalTicketCount, 3);
    assert.equal(enriched.recentTickets.length, 3);
    assert.deepEqual(enriched.agentPool.map((a) => a.ref), ["user_3", "user_2"]);
    assert.equal(enriched.orgPolicy.policy.sla.responseHours, 8);
    assert.equal(enriched.knowledge[0].title, "VPN");
  });
});

describe("tool-contract stores", () => {
  test("ClerkRequesterStore and ClerkAgentPoolService satisfy the tool interfaces", async () => {
    const clerkClient = makeClerk({
      users,
      memberships: [
        { role: "member", publicUserData: { userId: "user_2", firstName: "Grace", lastName: "Hopper" } },
      ],
    });
    const prisma = makePrisma();
    const requesterStore = createClerkRequesterStore({ prisma, clerkClient });
    const agentPoolService = createClerkAgentPoolService({ prisma, clerkClient });

    const requesterCtx = await requesterStore.getRequesterContext({ orgId: "org_1", requesterRef: "user_1" });
    assert.equal(requesterCtx.requester.ref, "user_1");
    assert.equal(requesterCtx.openTicketCount, 2);

    const pool = await agentPoolService.listAssignableAgents({ orgId: "org_1", requesterRef: "user_1" });
    assert.deepEqual(pool.map((a) => a.ref), ["user_2"]);
  });
});
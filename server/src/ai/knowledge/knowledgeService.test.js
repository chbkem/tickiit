const { test, describe } = require("node:test");
const assert = require("node:assert/strict");
const { createKnowledgeService, knowledgeService, DEFAULT_SOURCE } = require("./knowledgeService");

const article = (overrides = {}) => ({
  id: "a-1",
  orgId: "org_1",
  title: "Password reset",
  body: "Reset emails go to the primary address.",
  tags: ["auth", "password"],
  source: "MANUAL",
  createdAt: new Date("2026-01-01T00:00:00Z"),
  updatedAt: new Date("2026-01-02T00:00:00Z"),
  ...overrides,
});

const rows = [
  article({ id: "org", orgId: "org_1", title: "VPN org docs", updatedAt: new Date("2026-01-05T00:00:00Z") }),
  article({ id: "global", orgId: null, title: "VPN global docs", updatedAt: new Date("2026-01-06T00:00:00Z") }),
  article({ id: "other", orgId: "org_2", title: "Other org docs" }),
];

const makePrisma = () => {
  const calls = { findMany: [], findUnique: [], create: [], update: [], delete: [] };
  const prisma = {
    knowledgeArticle: {
      findMany: async (args) => {
        calls.findMany.push(args);
        return rows.filter((r) => {
          let keep = true;
          const AND = args.where?.AND ?? [args.where];
          for (const clause of AND) {
            if (clause.OR) keep = keep && clause.OR.some((entry) => r[Object.keys(entry)[0]] === Object.values(entry)[0]);
            if (clause.orgId !== undefined) keep = keep && r.orgId === clause.orgId;
          }
          return keep;
        });
      },
      findUnique: async ({ where }) => rows.find((r) => r.id === where.id) ?? null,
      create: async ({ data }) => ({ id: "created", ...data }),
      update: async ({ where, data }) => ({ id: where.id, ...rows.find((r) => r.id === where.id), ...data }),
      delete: async ({ where }) => rows.find((r) => r.id === where.id) ?? null,
    },
  };
  return { prisma, calls };
};

describe("createKnowledgeService.list", () => {
  test("scopes reads to the org plus global articles", async () => {
    const { prisma, calls } = makePrisma();
    const service = createKnowledgeService(prisma);
    const out = await service.list({ orgId: "org_1" });
    assert.deepEqual(out.map((a) => a.id), ["org", "global"]);
    assert.deepEqual(calls.findMany[0].where.AND[0], { OR: [{ orgId: "org_1" }, { orgId: null }] });
    assert.deepEqual(calls.findMany[0].orderBy, { updatedAt: "desc" });
    assert.equal(calls.findMany[0].take, 50);
  });

  test("adds a search clause across title/body/tags", async () => {
    const { prisma, calls } = makePrisma();
    const service = createKnowledgeService(prisma);
    await service.list({ orgId: "org_1", search: "vpn" });
    const matchers = calls.findMany[0].where.AND[1].OR;
    assert.equal(matchers.length, 3);
    assert.deepEqual(Object.keys(matchers[0]), ["title"]);
    assert.equal(matchers[0].title.mode, "insensitive");
    assert.deepEqual(Object.keys(matchers[1]), ["body"]);
    assert.deepEqual(Object.keys(matchers[2]), ["tags"]);
    assert.deepEqual(matchers[2].tags, { has: "vpn" });
  });

  test("clamps limit between 1 and 100", async () => {
    const { prisma, calls } = makePrisma();
    const service = createKnowledgeService(prisma);
    await service.list({ orgId: "org_1", limit: 500 });
    assert.equal(calls.findMany[0].take, 100);
    await service.list({ orgId: "org_1", limit: 0 });
    assert.equal(calls.findMany[1].take, 1);
  });

  test("global-only scope when orgId is null", async () => {
    const { prisma, calls } = makePrisma();
    const service = createKnowledgeService(prisma);
    const out = await service.list({ orgId: null });
    assert.deepEqual(out.map((a) => a.id), ["global"]);
    assert.deepEqual(calls.findMany[0].where.AND[0], { orgId: null });
  });
});

describe("createKnowledgeService CRUD", () => {
  test("create sanitizes fields, cleans tags, and defaults source/orgId", async () => {
    const { prisma } = makePrisma();
    const service = createKnowledgeService(prisma);
    const out = await service.create({
      data: { title: "  <b>T</b> ", body: "<i>Body</i> text", tags: [" ", "auth"], orgId: "org_1" },
    });
    assert.equal(out.title, "T");
    assert.equal(out.body, "Body text");
    assert.deepEqual(out.tags, ["auth"]);
    assert.equal(out.source, DEFAULT_SOURCE);
    assert.equal(out.orgId, "org_1");
  });

  test("getById returns the row or null", async () => {
    const { prisma } = makePrisma();
    const service = createKnowledgeService(prisma);
    assert.equal((await service.getById("org")).id, "org");
    assert.equal(await service.getById("missing"), null);
  });

  test("update patches only provided fields and re-sanitizes", async () => {
    const { prisma } = makePrisma();
    const service = createKnowledgeService(prisma);
    const out = await service.update("org", { title: " <i>New</i> ", tags: ["first"] });
    assert.equal(out.title, "New");
    assert.deepEqual(out.tags, ["first"]);
    assert.equal(out.id, "org");
  });

  test("remove deletes by id", async () => {
    const { prisma } = makePrisma();
    const service = createKnowledgeService(prisma);
    assert.equal((await service.remove("org")).id, "org");
  });
});

describe("knowledgeService default export", () => {
  test("exposes the same CRUD surface bound to the real prisma client", () => {
    assert.equal(typeof knowledgeService.list, "function");
    assert.equal(typeof knowledgeService.getById, "function");
    assert.equal(typeof knowledgeService.create, "function");
    assert.equal(typeof knowledgeService.update, "function");
    assert.equal(typeof knowledgeService.remove, "function");
  });
});
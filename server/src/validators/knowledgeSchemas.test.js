const { test, describe } = require("node:test");
const assert = require("node:assert/strict");
const {
  knowledgeIdParamSchema,
  createKnowledgeSchema,
  updateKnowledgeSchema,
  listKnowledgeSchema,
  DEFAULT_LIST_LIMIT,
} = require("./knowledgeSchemas");

const UUID = "9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d";

describe("knowledgeSchemas", () => {
  test("knowledgeIdParamSchema requires a UUID", () => {
    assert.equal(knowledgeIdParamSchema.safeParse({ params: { id: UUID } }).success, true);
    assert.equal(knowledgeIdParamSchema.safeParse({ params: { id: "not-a-uuid" } }).success, false);
  });

  test("createKnowledgeSchema sanitizes title/body and defaults tags/source/orgId", () => {
    const result = createKnowledgeSchema.safeParse({
      body: {
        title: "  Password <b>reset</b>  ",
        body: "  Body text  ",
      },
    });
    assert.equal(result.success, true);
    assert.equal(result.data.body.title, "Password reset");
    assert.equal(result.data.body.body, "Body text");
    assert.deepEqual(result.data.body.tags, []);
    assert.equal(result.data.body.orgId, undefined);
  });

  test("createKnowledgeSchema validates tags: sanitizes, dedupes empties, caps length/count", () => {
    const result = createKnowledgeSchema.safeParse({
      body: {
        title: "T",
        body: "B",
        tags: ["<b>auth</b>", "  ", "<script>x</script>", "a".repeat(200), "keep"],
      },
    });
    assert.equal(result.success, true);
    const tags = result.data.body.tags;
    assert.equal(tags.includes("auth"), true);
    assert.equal(tags.includes(""), false);
    assert.equal(tags.includes("x"), false);
    assert.equal(tags.includes("a".repeat(200)), false);
    assert.equal(tags.includes("keep"), true);
  });

  test("createKnowledgeSchema is strict and rejects cross-object extras", () => {
    assert.equal(
      createKnowledgeSchema.safeParse({ body: { title: "T", body: "B", nope: true } }).success,
      false,
    );
    assert.equal(createKnowledgeSchema.safeParse({ body: { title: "  ", body: "B" } }).success, false);
    assert.equal(createKnowledgeSchema.safeParse({ body: { title: "T", body: "  " } }).success, false);
  });

  test("updateKnowledgeSchema requires at least one update field", () => {
    assert.equal(
      updateKnowledgeSchema.safeParse({ params: { id: UUID }, body: { body: "New" } }).success,
      true,
    );
    assert.equal(
      updateKnowledgeSchema.safeParse({ params: { id: UUID }, body: {} }).success,
      false,
    );
  });

  test("listKnowledgeSchema coerces numeric limit and treats blank search as absent", () => {
    const ok = listKnowledgeSchema.safeParse({ query: { search: "  reset  ", limit: "25" } });
    assert.equal(ok.success, true);
    assert.equal(ok.data.query.search, "reset");
    assert.equal(ok.data.query.limit, 25);

    const blank = listKnowledgeSchema.safeParse({ query: { search: "   " } });
    assert.equal(blank.success, true);
    assert.equal(blank.data.query.search, undefined);

    assert.equal(listKnowledgeSchema.safeParse({ query: { limit: "0" } }).success, false);
    assert.equal(listKnowledgeSchema.safeParse({ query: { limit: "500" } }).success, false);
    assert.equal(
      listKnowledgeSchema.safeParse({ query: { search: "x", extra: "y" } }).success,
      true,
    );
  });
});

describe("knowledgeSchemas constants", () => {
  test("DEFAULT_LIST_LIMIT is exported", () => {
    assert.equal(typeof DEFAULT_LIST_LIMIT, "number");
  });
});
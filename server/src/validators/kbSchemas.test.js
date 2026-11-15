const { test, describe } = require("node:test");
const assert = require("node:assert/strict");
const {
  createArticleSchema,
  updateArticleSchema,
  idParamSchema,
  MAX_TAGS,
} = require("./kbSchemas");

const parseBody = (schema, body) => schema.safeParse({ body });

describe("createArticleSchema", () => {
  test("defaults source to ARTICLE and tags to an empty list", () => {
    const result = createArticleSchema.safeParse({ body: { title: "Refunds", body: "Refund policy" } });
    assert.equal(result.success, true);
    assert.equal(result.data.body.source, "ARTICLE");
    assert.deepEqual(result.data.body.tags, []);
  });

  test("accepts lowercase source values and sanitizes text", () => {
    const result = createArticleSchema.safeParse({
      body: {
        title: "  <b>Refunds</b>  ",
        body: "Refunds within <i>14 days</i>",
        source: "file",
        tags: [" refunds ", "refunds", "billing"],
      },
    });
    assert.equal(result.success, true);
    assert.equal(result.data.body.title, "Refunds");
    assert.equal(result.data.body.body, "Refunds within 14 days");
    assert.equal(result.data.body.source, "FILE");
    assert.deepEqual(result.data.body.tags, ["refunds", "billing"]);
  });

  test("treats an empty sourceUrl as null", () => {
    const result = parseBody(createArticleSchema, { title: "Refunds", body: "Policy", sourceUrl: "" });
    assert.equal(result.success, true);
    assert.equal(result.data.body.sourceUrl, null);
  });

  test("rejects an invalid url, an empty body, and unknown fields", () => {
    assert.equal(parseBody(createArticleSchema, { title: "Refunds", body: "Policy", sourceUrl: "nope" }).success, false);
    assert.equal(parseBody(createArticleSchema, { title: "Refunds", body: " " }).success, false);
    assert.equal(
      parseBody(createArticleSchema, { title: "Refunds", body: "Policy", orgId: "org_evil" }).success,
      false,
    );
  });

  test("rejects more tags than the cap", () => {
    const tags = Array.from({ length: MAX_TAGS + 1 }, (_, index) => `tag-${index}`);
    assert.equal(parseBody(createArticleSchema, { title: "Refunds", body: "Policy", tags }).success, false);
  });
});

describe("updateArticleSchema", () => {
  test("accepts a single editable field", () => {
    const result = updateArticleSchema.safeParse({
      params: { id: "0f2b8b9e-3b6a-4a1d-9a0c-6f3c2b1d4e5f" },
      body: { title: "Updated" },
    });
    assert.equal(result.success, true);
    assert.deepEqual(result.data.body, { title: "Updated" });
  });

  test("rejects an empty patch and a non uuid id", () => {
    assert.equal(
      updateArticleSchema.safeParse({
        params: { id: "0f2b8b9e-3b6a-4a1d-9a0c-6f3c2b1d4e5f" },
        body: {},
      }).success,
      false,
    );
    assert.equal(updateArticleSchema.safeParse({ params: { id: "a1" }, body: { title: "Updated" } }).success, false);
  });
});

describe("idParamSchema", () => {
  test("requires a uuid", () => {
    assert.equal(idParamSchema.safeParse({ params: { id: "a1" } }).success, false);
    assert.equal(
      idParamSchema.safeParse({ params: { id: "0f2b8b9e-3b6a-4a1d-9a0c-6f3c2b1d4e5f" } }).success,
      true,
    );
  });
});

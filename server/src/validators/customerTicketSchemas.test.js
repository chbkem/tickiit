const { test, describe } = require("node:test");
const assert = require("node:assert/strict");
const { createReplySchema } = require("./customerTicketSchemas");
const { createCommentSchema } = require("./commentSchemas");

const parseReply = (body) =>
  createReplySchema.safeParse({
    params: { token: "a".repeat(43) },
    body: { body },
  });

const parseStaffComment = (body) =>
  createCommentSchema.safeParse({
    params: { ticketId: "11111111-1111-4111-8111-111111111111" },
    body,
  });

describe("customer ticket validators", () => {
  test("a customer reply is sanitized and trimmed", () => {
    const result = parseReply("  <b>Hello</b> there  ");
    assert.equal(result.success, true);
    assert.equal(result.data.body.body, "Hello there");
  });

  test("a reply that is empty after sanitizing is rejected", () => {
    assert.equal(parseReply("<script>x</script>").success, false);
  });

  test("a reply over 5000 characters is rejected", () => {
    assert.equal(parseReply("x".repeat(5001)).success, false);
  });

  test("unknown fields in a reply body are rejected", () => {
    const result = createReplySchema.safeParse({
      params: { token: "a".repeat(43) },
      body: { body: "Hello", visibility: "INTERNAL" },
    });
    assert.equal(result.success, false);
  });

  test("staff visibility defaults to PUBLIC and permits INTERNAL only", () => {
    assert.equal(parseStaffComment({ body: "note" }).data.body.visibility, "PUBLIC");
    assert.equal(parseStaffComment({ body: "note", visibility: "INTERNAL" }).success, true);
    assert.equal(parseStaffComment({ body: "note", visibility: "CUSTOMER" }).success, false);
  });
});

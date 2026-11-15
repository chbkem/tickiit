const { test, describe } = require("node:test");
const assert = require("node:assert/strict");
const {
  createFormSchema,
  updateFormSchema,
  submitFormSchema,
} = require("./formSchemas");

const validSubmission = {
  params: { publicId: "abcdefghijklmnop" },
  body: {
    name: "Ada Lovelace",
    email: "  Ada@Example.COM ",
    subject: "Cannot sign in",
    message: "<p>I get a <b>500</b> error.</p>",
    website: "",
    formToken: "eyJwdWJsaWNJZCI6ImFiYyJ9.signature",
    altcha: "eyJjaGFsbGVuZ2UiOnt9fQ==",
  },
};

describe("formSchemas", () => {
  test("createFormSchema defaults an empty or missing body for one-click creation", () => {
    for (const input of [{ body: {} }, {}]) {
      const result = createFormSchema.safeParse(input);
      assert.equal(result.success, true);
      assert.deepEqual(result.data.body, {});
    }
  });

  test("createFormSchema sanitizes and length-limits the name", () => {
    const ok = createFormSchema.safeParse({ body: { name: "<b>Support</b>" } });
    assert.equal(ok.success, true);
    assert.equal(ok.data.body.name, "Support");

    const tooLong = createFormSchema.safeParse({ body: { name: "x".repeat(121) } });
    assert.equal(tooLong.success, false);
  });

  test("updateFormSchema requires at least one field", () => {
    const empty = updateFormSchema.safeParse({
      params: { id: "00000000-0000-4000-8000-000000000000" },
      body: {},
    });
    assert.equal(empty.success, false);

    const ok = updateFormSchema.safeParse({
      params: { id: "00000000-0000-4000-8000-000000000000" },
      body: { isActive: false },
    });
    assert.equal(ok.success, true);
    assert.equal(ok.data.body.isActive, false);
  });

  test("submitFormSchema lowercases email and strips HTML from text fields", () => {
    const result = submitFormSchema.safeParse(validSubmission);
    assert.equal(result.success, true);
    assert.equal(result.data.body.email, "ada@example.com");
    assert.equal(result.data.body.subject, "Cannot sign in");
    assert.equal(result.data.body.message, "I get a 500 error.");
  });

  test("submitFormSchema rejects invalid emails and unknown fields", () => {
    const badEmail = submitFormSchema.safeParse({
      ...validSubmission,
      body: { ...validSubmission.body, email: "not-an-email" },
    });
    assert.equal(badEmail.success, false);

    const extra = submitFormSchema.safeParse({
      ...validSubmission,
      body: { ...validSubmission.body, priority: "URGENT" },
    });
    assert.equal(extra.success, false);
  });

  test("submitFormSchema rejects the removed elapsedMs field", () => {
    const result = submitFormSchema.safeParse({
      ...validSubmission,
      body: { ...validSubmission.body, elapsedMs: 5000 },
    });
    assert.equal(result.success, false);
  });

  test("submitFormSchema enforces the public id and message limits", () => {
    const badId = submitFormSchema.safeParse({
      ...validSubmission,
      params: { publicId: "short" },
    });
    assert.equal(badId.success, false);

    const longMessage = submitFormSchema.safeParse({
      ...validSubmission,
      body: { ...validSubmission.body, message: "x".repeat(5001) },
    });
    assert.equal(longMessage.success, false);
  });
});

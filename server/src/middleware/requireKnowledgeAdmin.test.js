const { test, describe } = require("node:test");
const assert = require("node:assert/strict");
const ApiError = require("../utils/ApiError");
const { assertKnowledgeAdmin } = require("./requireKnowledgeAdmin");

describe("assertKnowledgeAdmin", () => {
  test("rejects a session with no active organization", async () => {
    await assert.rejects(
      assertKnowledgeAdmin({ userId: "user_1" }),
      (err) => err instanceof ApiError && err.statusCode === 403 && /active organization/.test(err.message),
    );
  });

  test("accepts a session admin role and returns the trusted org context", async () => {
    const context = await assertKnowledgeAdmin({
      userId: "user_1",
      orgId: "org_1",
      orgRole: "org:admin",
    });
    assert.deepEqual(context, { userId: "user_1", orgId: "org_1" });
  });

  test("rejects a non admin organization member", async () => {
    await assert.rejects(
      assertKnowledgeAdmin({ userId: "user_1", orgId: "org_1", orgRole: "basic_member" }),
      (err) => err instanceof ApiError && err.statusCode === 403 && /admins/.test(err.message),
    );
  });
});

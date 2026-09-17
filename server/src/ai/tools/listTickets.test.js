const { test, describe } = require("node:test");
const assert = require("node:assert/strict");
const { buildListWhere, ListTicketsInput, MAX_LIMIT } = require("./listTickets");

describe("listTickets", () => {
  test("buildListWhere scopes to org when present", () => {
    const where = buildListWhere({ args: {}, orgId: "org_1", requesterId: "user_me" });
    assert.deepEqual(where, { orgId: "org_1" });
  });

  test("buildListWhere scopes to the requester when no org applies", () => {
    const where = buildListWhere({ args: {}, orgId: null, requesterId: "user_me" });
    assert.deepEqual(where, { requesterId: "user_me" });
  });

  test("buildListWhere applies filters within the scope", () => {
    const where = buildListWhere({
      args: {
        status: "OPEN",
        priority: "HIGH",
        type: "BUG",
        unassigned: true,
        assigneeId: "user_a",
        requesterKey: "abc",
        email: "ada@example.com",
      },
      orgId: "org_1",
      requesterId: "user_me",
    });
    assert.deepEqual(where.status, "OPEN");
    assert.deepEqual(where.priority, "HIGH");
    assert.deepEqual(where.type, "BUG");
    assert.deepEqual(where.assigneeId, "user_a");
    assert.deepEqual(where.requesterKey, "abc");
    assert.deepEqual(where.requesterEmail, "ada@example.com");
    assert.deepEqual(where.orgId, "org_1");
  });

  test("ListTicketsInput rejects requesterKey + email together", () => {
    assert.equal(
      ListTicketsInput.safeParse({ requesterKey: "a", email: "b@c.d" }).success,
      false,
    );
    assert.equal(ListTicketsInput.safeParse({ requesterKey: "a" }).success, true);
  });

  test("ListTicketsInput caps limit at MAX_LIMIT", () => {
    assert.equal(ListTicketsInput.safeParse({ limit: MAX_LIMIT }).success, true);
    assert.equal(ListTicketsInput.safeParse({ limit: MAX_LIMIT + 1 }).success, false);
    assert.equal(ListTicketsInput.safeParse({}).data.limit, 10);
  });
});
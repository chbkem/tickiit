const { test, describe } = require("node:test");
const assert = require("node:assert/strict");
const ApiError = require("./ApiError");
const { assertCanRevokeCustomerLinks } = require("./access");

const ticket = { id: "ticket-1", orgId: "org-1", assigneeId: "staff-1", requesterId: "user-1" };

describe("assertCanRevokeCustomerLinks", () => {
  test("the current assignee may revoke without an admin role", async () => {
    await assertCanRevokeCustomerLinks(ticket, { userId: "staff-1", orgId: "org-1", orgRole: "org:member" });
  });

  test("a staff member from another org is denied before any role lookup", async () => {
    let called = false;
    await assert.rejects(
      () =>
        assertCanRevokeCustomerLinks(
          ticket,
          { userId: "staff-2", orgId: "org-2", orgRole: "org:admin" },
          { clerk: { assertUserIsAdminInOrganization: async () => { called = true; } } },
        ),
      (error) => error instanceof ApiError && error.statusCode === 403,
    );
    assert.equal(called, false);
  });

  test("an admin in the ticket org may revoke", async () => {
    let args;
    await assertCanRevokeCustomerLinks(
      ticket,
      { userId: "admin-1", orgId: "org-1", orgRole: "org:admin" },
      {
        clerk: {
          assertUserIsAdminInOrganization: async (value) => {
            args = value;
          },
        },
      },
    );
    assert.equal(args.orgId, "org-1");
    assert.equal(args.sessionOrgId, "org-1");
    assert.equal(args.sessionOrgRole, "org:admin");
  });

  test("a non admin in the ticket org is denied", async () => {
    await assert.rejects(
      () =>
        assertCanRevokeCustomerLinks(
          ticket,
          { userId: "member-1", orgId: "org-1", orgRole: "org:member" },
          {
            clerk: {
              assertUserIsAdminInOrganization: async () => {
                throw new ApiError(403, "Only an admin or the assignee can revoke customer links.");
              },
            },
          },
        ),
      (error) => error instanceof ApiError && error.statusCode === 403,
    );
  });
});

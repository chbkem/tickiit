const { test, describe } = require("node:test");
const assert = require("node:assert/strict");
const { ToolRegistry } = require("./registry");
const { orgPolicyTool, OrgPolicyInput, defaultOrgPolicy } = require("./orgPolicy");

const runTool = async (tool, args, ctx = {}) => {
  const registry = new ToolRegistry([tool]);
  return registry.execute(tool.name, args, ctx);
};

describe("orgPolicy tool", () => {
  test("returns the org policy from the service with the org bound from context", async () => {
    let received = null;
    const service = {
      getOrgPolicy: async (args) => {
        received = args;
        return {
          orgName: "Acme <b>Inc</b>",
          source: "config",
          policy: {
            sla: { responseHours: 2, resolutionHours: 24 },
            defaultPriority: "HIGH",
            defaultType: "INCIDENT",
            notes: "Escalate after <script>alert(1)</script>",
          },
        };
      },
    };
    const out = await runTool(orgPolicyTool({ orgPolicyService: service }), {}, { orgId: "org_1" });
    assert.equal(out.ok, true);
    assert.equal(out.kind, "read");
    assert.deepEqual(received, { orgId: "org_1" });
    assert.equal(out.result.orgName, "Acme Inc");
    assert.equal(out.result.policy.sla.responseHours, 2);
    assert.equal(out.result.policy.notes.includes("<script>"), false);
  });

  test("missing service returns the deterministic default policy", async () => {
    const out = await runTool(orgPolicyTool({}), {}, { orgId: "org_1" });
    assert.equal(out.ok, true);
    assert.equal(out.result.orgName, "Default policy");
    assert.equal(out.result.policy.defaultPriority, "MEDIUM");
    assert.deepEqual(defaultOrgPolicy().policy, out.result.policy);
  });

  test("input schema is strict and empty", () => {
    assert.equal(OrgPolicyInput.safeParse({}).success, true);
    assert.equal(OrgPolicyInput.safeParse({ orgId: "org_1" }).success, false);
  });
});
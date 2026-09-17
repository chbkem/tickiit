const { test, describe } = require("node:test");
const assert = require("node:assert/strict");
const { ToolRegistry } = require("./registry");
const { z } = require("zod");

const echoTool = {
  name: "echo",
  description: "Echoes back a message",
  inputSchema: z.object({ message: z.string().min(1).max(20) }).strict(),
  kind: "read",
  run: async (ctx, args) => ({ message: args.message }),
};

describe("ToolRegistry", () => {
  test("registers tools and exposes names", () => {
    const r = new ToolRegistry([echoTool]);
    assert.deepEqual(r.names, ["echo"]);
    assert.equal(r.has("echo"), true);
    assert.equal(r.has("nope"), false);
  });

  test("rejects duplicate registration", () => {
    assert.throws(() => new ToolRegistry([echoTool, echoTool]), /Duplicate tool/);
  });

  test("toTools derives an OpenAI function schema from zod", () => {
    const r = new ToolRegistry([echoTool]);
    const tools = r.toTools();
    assert.equal(tools.length, 1);
    assert.equal(tools[0].type, "function");
    assert.equal(tools[0].function.name, "echo");
    assert.equal(tools[0].function.description, "Echoes back a message");
    assert.equal(tools[0].function.parameters.type, "object");
    assert.ok(Array.isArray(tools[0].function.parameters.required));
  });

  test("execute runs a registered tool and returns ok result", async () => {
    const r = new ToolRegistry([echoTool]);
    const out = await r.execute("echo", { message: "hi" }, {});
    assert.equal(out.ok, true);
    assert.deepEqual(out.result, { message: "hi" });
    assert.equal(out.kind, "read");
  });

  test("execute rejects unknown tool names without running anything", async () => {
    const r = new ToolRegistry([echoTool]);
    const out = await r.execute("drop_database", {}, {});
    assert.equal(out.ok, false);
    assert.match(out.error, /Unknown tool "drop_database"/);
  });

  test("execute returns a model-readable error on invalid arguments", async () => {
    const r = new ToolRegistry([echoTool]);
    const out = await r.execute("echo", { message: "" }, {});
    assert.equal(out.ok, false);
    assert.match(out.error, /Invalid arguments for "echo"/);
    assert.match(out.error, /message/);
  });

  test("execute normalizes model casing through schema transforms", async () => {
    const pickTool = {
      name: "pick",
      inputSchema: z.object({ value: z.string().trim().toUpperCase().refine((v) => v === "HIGH") }).strict(),
      run: async (ctx, args) => ({ value: args.value }),
    };
    const r = new ToolRegistry([pickTool]);
    const out = await r.execute("pick", { value: "high" }, {});
    assert.equal(out.ok, true);
    assert.equal(out.result.value, "HIGH");
  });

  test("execute catches run() errors into a tool result", async () => {
    const boom = {
      name: "boom",
      inputSchema: z.object({}).strict(),
      run: async () => {
        throw new Error("kaboom");
      },
    };
    const r = new ToolRegistry([boom]);
    const out = await r.execute("boom", {}, {});
    assert.equal(out.ok, false);
    assert.equal(out.error, "kaboom");
  });
});
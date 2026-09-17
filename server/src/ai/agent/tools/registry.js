const { z } = require("zod");

const formatZodError = (error) =>
  (Array.isArray(error?.issues) ? error.issues : [])
    .map((issue) => `${issue.path.join(".") || "(root)"}: ${issue.message}`)
    .join("; ");

/**
 * ToolRegistry — closed-world tool catalog.
 *
 * Each tool is a descriptor:
 *   { name, description, inputSchema (zod), kind: 'read'|'draft'|'finalize',
 *     run(ctx, args) -> Promise<result> }
 *
 * Decisions:
 *   - Unknown tool names are rejected before any code runs (prompt-injection
 *     containment: a model-invented tool name can never execute).
 *   - Arguments are validated against the zod inputSchema; parse failures and
 *     run() errors are returned as structured { ok: false, error } results so
 *     the ReAct loop can feed them back to the model for self-correction.
 *   - toTools() derives OpenAI function schemas from the zod schemas via
 *     z.toJSONSchema (single source of truth, closed-world .strict()).
 */
class ToolRegistry {
  constructor(tools = []) {
    this._tools = [];
    this._byName = new Map();
    for (const tool of tools) this.register(tool);
  }

  register(tool) {
    if (!tool || typeof tool !== "object") throw new TypeError("Tool must be an object descriptor");
    if (!tool.name || typeof tool.name !== "string") throw new TypeError("Tool requires a string name");
    if (this._byName.has(tool.name)) throw new Error(`Duplicate tool registration: "${tool.name}"`);
    if (!tool.inputSchema || typeof tool.inputSchema.safeParse !== "function") {
      throw new TypeError(`Tool "${tool.name}" requires a zod inputSchema`);
    }
    if (typeof tool.run !== "function") throw new TypeError(`Tool "${tool.name}" requires a run(ctx, args) function`);
    this._tools.push(tool);
    this._byName.set(tool.name, tool);
  }

  get names() {
    return Array.from(this._byName.keys());
  }

  has(name) {
    return this._byName.has(name);
  }

  toTools() {
    return this._tools.map((tool) => ({
      type: "function",
      function: {
        name: tool.name,
        description: tool.description ?? "",
        parameters: z.toJSONSchema(tool.inputSchema),
      },
    }));
  }

  async execute(name, args, ctx) {
    const tool = this._byName.get(name);
    if (!tool) {
      return { name, ok: false, kind: null, error: `Unknown tool "${name}". Use one of: ${this.names.join(", ")}` };
    }
    const kind = tool.kind ?? "read";
    const parsed = tool.inputSchema.safeParse(args);
    if (!parsed.success) {
      return {
        name,
        ok: false,
        kind,
        error: `Invalid arguments for "${name}": ${formatZodError(parsed.error)}`,
      };
    }
    try {
      const result = await tool.run(ctx, parsed.data);
      return { name, ok: true, kind, result };
    } catch (err) {
      return { name, ok: false, kind, error: err?.message ?? String(err) };
    }
  }
}

module.exports = { ToolRegistry, formatZodError };
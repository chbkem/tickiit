const { test, describe } = require("node:test");
const assert = require("node:assert/strict");

const { runTriage, shouldAutoReply, aiEnabled, tokenBudget } = require("./runTriage");

const USAGE = { inputTokens: 10, outputTokens: 5, totalTokens: 15 };

const structured = (output) => async () => ({
  output,
  rawText: "",
  usage: USAGE,
  stepCount: 1,
});

const failingStructured = async () => {
  throw new Error("provider exploded");
};

const ticketServiceStub = {
  async createTicket({ data }) {
    return { id: "ticket-1", ticketNumber: "#0001", ...data, status: "OPEN", comments: [] };
  },
};

const okStageOptions = () => ({
  classify: {
    runStructured: structured({
      subject: "VPN slow",
      description: "cannot connect to VPN",
      type: "BUG",
      rationale: "clear bug report",
    }),
  },
  prioritize: {
    runStructured: structured({ priority: "HIGH", rationale: "single-user blocker" }),
  },
  create: {
    runToolLoop: async ({ tools }) => {
      await tools.create_ticket.execute({
        subject: "VPN slow",
        description: "cannot connect to VPN",
        type: "BUG",
        priority: "HIGH",
      });
      return {
        text: "",
        usage: USAGE,
        toolCalls: [{ name: "create_ticket", args: { type: "BUG" } }],
        stepCount: 1,
      };
    },
  },
  reply: { runStructured: structured({ reply: "We received your report!" }) },
});

const throwingStageOptions = () => ({
  classify: { runStructured: failingStructured },
  prioritize: { runStructured: failingStructured },
  create: {
    runToolLoop: async () => {
      throw new Error("provider exploded");
    },
  },
  reply: { runStructured: failingStructured },
});

const triageInput = {
  raw: { subject: " VPN broken ", body: "Cannot connect to the VPN this morning." },
  channel: "email",
  name: "Ada Lovelace",
  email: "Ada@Example.com",
  orgId: "org_1",
};

describe("runTriage", () => {
  test("throws ApiError 400 when nothing can be normalized", async () => {
    await assert.rejects(
      () =>
        runTriage({
          input: { raw: {}, name: "Ada", email: "ada@example.com" },
          deps: { env: {}, ticketService: ticketServiceStub },
        }),
      (err) => err.statusCode === 400 && /subject or body/.test(err.message),
    );
  });

  test("always creates a ticket deterministically when the provider is unavailable", async () => {
    const result = await runTriage({
      input: triageInput,
      deps: { env: {}, ticketService: ticketServiceStub },
    });

    assert.ok(result.modelError);
    assert.equal(result.ticket.subject, "VPN broken");
    assert.equal(result.ticket.type, "TASK");
    assert.equal(result.ticket.priority, "MEDIUM");
    assert.equal(result.ticket.assigneeId, null);
    assert.equal(result.ticket.requesterName, "Ada Lovelace");
    assert.equal(result.ticket.requesterEmail, "ada@example.com");
    assert.equal(result.requester.kind, "anonymous");
    assert.equal(result.draftReply, null);
    assert.deepEqual(result.usage, { inputTokens: 0, outputTokens: 0, totalTokens: 0 });
    assert.deepEqual(
      result.stages.map((s) => `${s.stage}:${s.kind}`),
      ["classify:fallback", "prioritize:fallback", "create:fallback"],
    );
  });

  test("runs classify -> prioritize -> create -> reply agents and accumulates usage", async () => {
    const result = await runTriage({
      input: { ...triageInput, autoReply: true },
      deps: {
        env: {},
        model: {},
        ticketService: ticketServiceStub,
        stageOptions: okStageOptions(),
      },
    });

    assert.equal(result.ticket.subject, "VPN slow");
    assert.equal(result.ticket.type, "BUG");
    assert.equal(result.ticket.priority, "HIGH");
    assert.equal(result.requester.kind, "anonymous");
    assert.equal(result.draftReply, "We received your report!");
    assert.deepEqual(result.usage, { inputTokens: 40, outputTokens: 20, totalTokens: 60 });
    assert.deepEqual(
      result.stages.map((s) => `${s.stage}:${s.kind}`),
      ["classify:model", "prioritize:model", "create:model", "reply:model"],
    );
    const createStage = result.stages.find((s) => s.stage === "create");
    assert.equal(createStage.toolCalls[0].name, "create_ticket");
  });

  test("falls back to deterministic creation when the model errors mid-pipeline", async () => {
    const result = await runTriage({
      input: { ...triageInput, autoReply: true },
      deps: {
        env: {},
        model: {},
        ticketService: ticketServiceStub,
        stageOptions: throwingStageOptions(),
      },
    });

    assert.equal(result.ticket.type, "TASK");
    assert.equal(result.ticket.priority, "MEDIUM");
    assert.equal(result.draftReply, null);
    assert.deepEqual(result.usage, { inputTokens: 0, outputTokens: 0, totalTokens: 0 });
    const stages = result.stages.map((s) => `${s.stage}:${s.kind}`);
    assert.deepEqual(stages, ["classify:fallback", "prioritize:fallback", "create:fallback", "reply:fallback"]);
    assert.ok(result.stages.find((s) => s.stage === "create").error);
    assert.ok(result.stages.find((s) => s.stage === "reply").error);
  });

  test("does not run the reply stage unless autoReply is requested", async () => {
    const result = await runTriage({
      input: triageInput,
      deps: {
        env: {},
        model: {},
        ticketService: ticketServiceStub,
        stageOptions: okStageOptions(),
      },
    });

    assert.equal(result.draftReply, null);
    assert.equal(result.stages.some((s) => s.stage === "reply"), false);
  });

  test("enables the reply stage from AI_AUTO_REPLY when the request is silent", async () => {
    const result = await runTriage({
      input: triageInput,
      deps: {
        env: { AI_AUTO_REPLY: "true" },
        model: {},
        ticketService: ticketServiceStub,
        stageOptions: okStageOptions(),
      },
    });

    assert.equal(result.draftReply, "We received your report!");
    assert.equal(result.stages.some((s) => s.stage === "reply"), true);
  });

  test("create_ticket is exactly-once: a second call in the same request is rejected", async () => {
    let persisted = 0;
    const countingStub = {
      async createTicket({ data }) {
        persisted += 1;
        return { id: `ticket-${persisted}`, ticketNumber: `#000${persisted}`, ...data, status: "OPEN", comments: [] };
      },
    };
    const stageOptions = {
      classify: okStageOptions().classify,
      prioritize: okStageOptions().prioritize,
      create: {
        runToolLoop: async ({ tools }) => {
          const draft = { subject: "VPN slow", description: "cannot connect", type: "BUG", priority: "HIGH" };
          await tools.create_ticket.execute(draft);
          await assert.rejects(
            () => tools.create_ticket.execute({ ...draft, subject: "Duplicate?" }),
            /may only be called once/,
          );
          return { text: "", usage: USAGE, toolCalls: [{ name: "create_ticket" }], stepCount: 1 };
        },
      },
    };

    const result = await runTriage({
      input: { ...triageInput, autoReply: true },
      deps: { env: {}, model: {}, ticketService: countingStub, stageOptions },
    });

    assert.equal(persisted, 1);
    assert.equal(result.ticket.subject, "VPN slow");
    assert.equal(result.stages.find((s) => s.stage === "create").kind, "model");
  });

  test("AI_ENABLED=false skips the model path entirely and still creates a ticket", async () => {
    let runCalled = false;
    const stageOptions = okStageOptions();
    stageOptions.classify.runStructured = async () => {
      runCalled = true;
      return { output: {}, usage: USAGE, stepCount: 1 };
    };

    const result = await runTriage({
      input: triageInput,
      deps: {
        env: { AI_ENABLED: "false" },
        model: {},
        ticketService: ticketServiceStub,
        stageOptions,
      },
    });

    assert.equal(runCalled, false);
    assert.match(result.modelError, /AI_ENABLED=false/);
    assert.deepEqual(
      result.stages.map((s) => `${s.stage}:${s.kind}`),
      ["classify:fallback", "prioritize:fallback", "create:fallback"],
    );
    assert.equal(result.ticket.type, "TASK");
    assert.equal(result.ticket.priority, "MEDIUM");
  });

  test("AI_MAX_TOKENS_PER_REQUEST caps spend: model stages degrade once the budget is spent", async () => {
    let toolLoopCalls = 0;
    const stageOptions = okStageOptions();
    stageOptions.create.runToolLoop = async ({ tools }) => {
      toolLoopCalls += 1;
      await tools.create_ticket.execute({ subject: "VPN slow", description: "x", type: "BUG", priority: "HIGH" });
      return { text: "", usage: USAGE, toolCalls: [{ name: "create_ticket" }], stepCount: 1 };
    };
    stageOptions.reply.runStructured = async () => {
      throw new Error("reply must not run under budget");
    };

    const result = await runTriage({
      input: { ...triageInput, autoReply: true },
      deps: {
        env: { AI_MAX_TOKENS_PER_REQUEST: "1" },
        model: {},
        ticketService: ticketServiceStub,
        stageOptions,
      },
    });

    // classify runs (usage 0 <= 1), then every subsequent stage is skip-footed.
    assert.deepEqual(
      result.stages.map((s) => `${s.stage}:${s.kind}`),
      ["classify:model", "prioritize:fallback", "create:fallback", "reply:fallback"],
    );
    const stages = result.stages;
    assert.match(stages.find((s) => s.stage === "prioritize").error, /Token budget exceeded/);
    assert.match(stages.find((s) => s.stage === "create").error, /Token budget exceeded/);
    assert.match(stages.find((s) => s.stage === "reply").error, /Token budget exceeded/);
    assert.equal(toolLoopCalls, 0, "create agent tool loop must not run past the budget");
    assert.equal(result.ticket.type, "BUG", "successful classify type is preserved by the deterministic create");
    assert.equal(result.ticket.priority, "MEDIUM", "priority falls back to MEDIUM");
    assert.equal(result.draftReply, null);
  });
});

describe("aiEnabled", () => {
  test("defaults to true and honors explicit false", () => {
    assert.equal(aiEnabled({}), true);
    assert.equal(aiEnabled({ AI_ENABLED: "false" }), false);
    assert.equal(aiEnabled({ AI_ENABLED: "FALSE" }), false);
    assert.equal(aiEnabled({ AI_ENABLED: "true" }), true);
    assert.equal(aiEnabled({ AI_ENABLED: "0" }), true);
  });
});

describe("tokenBudget", () => {
  test("defaults to unlimited and honors a positive cap", () => {
    assert.equal(tokenBudget({}), Number.POSITIVE_INFINITY);
    assert.equal(tokenBudget({ AI_MAX_TOKENS_PER_REQUEST: "0" }), Number.POSITIVE_INFINITY);
    assert.equal(tokenBudget({ AI_MAX_TOKENS_PER_REQUEST: "nope" }), Number.POSITIVE_INFINITY);
    assert.equal(tokenBudget({ AI_MAX_TOKENS_PER_REQUEST: "2000" }), 2000);
  });
});

describe("shouldAutoReply", () => {
  test("explicit true wins over env", () => {
    assert.equal(shouldAutoReply(true, { AI_AUTO_REPLY: "false" }), true);
    assert.equal(shouldAutoReply(false, { AI_AUTO_REPLY: "true" }), false);
  });

  test("uses the env default when the request omits autoReply", () => {
    assert.equal(shouldAutoReply(undefined, { AI_AUTO_REPLY: "true" }), true);
    assert.equal(shouldAutoReply(undefined, { AI_AUTO_REPLY: "false" }), false);
    assert.equal(shouldAutoReply(undefined, {}), false);
  });
});
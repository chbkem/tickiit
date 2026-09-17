const { test, describe } = require("node:test");
const assert = require("node:assert/strict");
const { OpenAICompatibleProvider, normalizeCompletion } = require("./openaiCompatible");
const { ProviderError } = require("./aiProvider");

const makeProvider = (overrides = {}) =>
  new OpenAICompatibleProvider({
    baseUrl: "https://llm.example/v1",
    apiKey: "sk-test",
    model: "gpt-test",
    timeoutMs: 200,
    ...overrides,
  });

const okJson = async () => ({
  choices: [{ message: { role: "assistant", content: "hello" }, finish_reason: "stop" }],
  usage: { prompt_tokens: 3, completion_tokens: 2, total_tokens: 5 },
});

describe("OpenAICompatibleProvider", () => {
  test("POSTs to <base>/chat/completions with auth, model, messages", async () => {
    const calls = [];
    const p = makeProvider({
      fetchFn: async (url, opts) => {
        calls.push({ url, opts });
        return { ok: true, status: 200, json: okJson };
      },
    });
    const out = await p.chat({ messages: [{ role: "user", content: "hi" }] });

    assert.equal(calls.length, 1);
    assert.equal(calls[0].url, "https://llm.example/v1/chat/completions");
    assert.equal(calls[0].opts.headers.authorization, "Bearer sk-test");
    const body = JSON.parse(calls[0].opts.body);
    assert.equal(body.model, "gpt-test");
    assert.deepEqual(body.messages, [{ role: "user", content: "hi" }]);
    assert.equal(body.tools, undefined);

    assert.equal(out.choices[0].message.content, "hello");
    assert.deepEqual(out.usage, { promptTokens: 3, completionTokens: 2, totalTokens: 5 });
  });

  test("ignores a trailing slash on baseUrl", async () => {
    const calls = [];
    const p = makeProvider({
      baseUrl: "https://llm.example/v1/",
      fetchFn: async (url, opts) => {
        calls.push(url);
        return { ok: true, status: 200, json: okJson };
      },
    });
    await p.chat({ messages: [{ role: "user", content: "hi" }] });
    assert.equal(calls[0], "https://llm.example/v1/chat/completions");
  });

  test("omits Authorization when no apiKey is set", async () => {
    const calls = [];
    const p = makeProvider({
      apiKey: undefined,
      fetchFn: async (url, opts) => {
        calls.push(opts.headers);
        return { ok: true, status: 200, json: okJson };
      },
    });
    await p.chat({ messages: [{ role: "user", content: "hi" }] });
    assert.equal(calls[0].authorization, undefined);
  });

  test("passes tools and response_format when provided", async () => {
    const calls = [];
    const p = makeProvider({
      fetchFn: async (url, opts) => {
        calls.push(JSON.parse(opts.body));
        return { ok: true, status: 200, json: okJson };
      },
    });
    await p.chat({
      messages: [{ role: "user", content: "hi" }],
      tools: [{ type: "function", function: { name: "get_requester_context", parameters: { type: "object" } } }],
      responseFormat: { type: "json_object" },
      temperature: 0,
    });
    assert.ok(Array.isArray(calls[0].tools));
    assert.equal(calls[0].tools[0].function.name, "get_requester_context");
    assert.deepEqual(calls[0].response_format, { type: "json_object" });
    assert.equal(calls[0].temperature, 0);
  });

  test("normalizes tool_calls into flat entries", async () => {
    const raw = {
      choices: [
        {
          message: {
            role: "assistant",
            content: null,
            tool_calls: [
              { id: "call_1", type: "function", function: { name: "search_knowledge", arguments: '{"q":"printer"}' } },
            ],
          },
          finish_reason: "tool_calls",
        },
      ],
      usage: undefined,
    };
    const out = normalizeCompletion(raw);
    assert.equal(out.choices[0].finishReason, "tool_calls");
    assert.deepEqual(out.choices[0].message.toolCalls, [
      { id: "call_1", name: "search_knowledge", arguments: '{"q":"printer"}' },
    ]);
    assert.deepEqual(out.usage, { promptTokens: 0, completionTokens: 0, totalTokens: 0 });
  });

  test("throws ProviderError on non-2xx response with status", async () => {
    const p = makeProvider({
      fetchFn: async () => ({ ok: false, status: 429, text: async () => "rate limited" }),
    });
    await assert.rejects(
      () => p.chat({ messages: [{ role: "user", content: "hi" }] }),
      (err) => err instanceof ProviderError && err.status === 429 && err.code === "HTTP_ERROR",
    );
  });

  test("times out requests exceeding the configured timeout", async () => {
    const p = makeProvider({
      timeoutMs: 25,
      fetchFn: (url, opts) =>
        new Promise((resolve, reject) => {
          opts.signal.addEventListener("abort", () =>
            reject(opts.signal.reason instanceof Error ? opts.signal.reason : new Error("aborted")),
          );
        }),
    });
    await assert.rejects(
      () => p.chat({ messages: [{ role: "user", content: "hi" }] }),
      (err) => err instanceof ProviderError && err.code === "TIMEOUT",
    );
  });

  test("rejects when base URL is not configured", async () => {
    const p = new OpenAICompatibleProvider({ env: {}, model: "m" });
    await assert.rejects(() => p.chat({ messages: [] }), /AI_BASE_URL is not configured/);
  });

  test("exposes providerId and model", () => {
    const p = makeProvider();
    assert.equal(p.providerId, "openai-compatible");
    assert.equal(p.model, "gpt-test");
  });
});
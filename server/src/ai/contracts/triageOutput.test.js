const { test, describe } = require("node:test");
const assert = require("node:assert/strict");
const {
  ClassifiedTicket,
  PriorityDecision,
  TicketDraft,
  ReplyDraft,
  MAX_SUBJECT_LENGTH,
} = require("./triageOutput");

describe("triageOutput contracts", () => {
  test("ClassifiedTicket validates a clean record and normalizes casing", () => {
    const parsed = ClassifiedTicket.safeParse({
      subject: " reset broken  ",
      description: "<b>email</b> never arrives",
      type: "bug",
      rationale: "clear bug",
    });
    assert.equal(parsed.success, true);
    assert.equal(parsed.data.subject, "reset broken");
    assert.equal(parsed.data.description, "email never arrives");
    assert.equal(parsed.data.type, "BUG");
  });

  test("ClassifiedTicket caps subject length and rejects unknown types", () => {
    const longSubject = ClassifiedTicket.safeParse({
      subject: "x".repeat(MAX_SUBJECT_LENGTH + 10),
      type: "TASK",
    });
    assert.equal(longSubject.success, false);

    const badType = ClassifiedTicket.safeParse({ subject: "S", type: "PIZZA" });
    assert.equal(badType.success, false);
  });

  test("PriorityDecision uppercases and rejects unknown priorities", () => {
    const parsed = PriorityDecision.safeParse({ priority: "urgent" });
    assert.equal(parsed.success, true);
    assert.equal(parsed.data.priority, "URGENT");
    assert.equal(PriorityDecision.safeParse({ priority: "SUPER" }).success, false);
  });

  test("TicketDraft is strict and requires all four fields", () => {
    const good = TicketDraft.safeParse({ subject: "S", type: "REQUEST", priority: "HIGH" });
    assert.equal(good.success, true);
    assert.equal(good.data.subject, "S");

    assert.equal(TicketDraft.safeParse({ subject: "S", priority: "HIGH" }).success, false);
    const injected = TicketDraft.safeParse({
      subject: "S",
      type: "TASK",
      priority: "LOW",
      status: "CLOSED",
      assigneeId: "user_1",
    });
    assert.equal(injected.success, false);
  });

  test("ReplyDraft requires a non-empty reply", () => {
    assert.equal(ReplyDraft.safeParse({ reply: "Thanks, we're on it." }).success, true);
    assert.equal(ReplyDraft.safeParse({ reply: "   " }).success, false);
  });
});
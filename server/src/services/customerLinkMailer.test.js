const { test, describe } = require("node:test");
const assert = require("node:assert/strict");
const { sendFreshCustomerLink } = require("./customerLinkMailer");

const ticket = { id: "ticket-1", ticketNumber: "#0001", subject: "Help" };

describe("sendFreshCustomerLink", () => {
  test("passes only the portal url and ticket facts to the mailer", async () => {
    let sentArgs;
    const result = await sendFreshCustomerLink(
      { ticket, to: "ada@example.com", name: "Ada", orgName: "Acme Support" },
      {
        issue: async () => ({ url: "https://support.example.com/t/raw-token", hashPrefix: "abc123" }),
        send: async (args) => {
          sentArgs = args;
          return true;
        },
      },
    );

    assert.equal(result.sent, true);
    assert.equal(sentArgs.url, "https://support.example.com/t/raw-token");
    assert.equal(sentArgs.to, "ada@example.com");
    assert.equal(sentArgs.orgName, "Acme Support");
  });

  test("an SMTP failure is swallowed so the caller keeps its mutation", async () => {
    const result = await sendFreshCustomerLink(
      { ticket, to: "ada@example.com", name: "Ada" },
      {
        issue: async () => ({ url: "https://support.example.com/t/raw-token", hashPrefix: "abc123" }),
        send: async () => {
          throw new Error("SMTP timeout");
        },
      },
    );

    assert.deepEqual(result, { sent: false, hashPrefix: null });
  });

  test("a token issuance failure is also swallowed", async () => {
    const result = await sendFreshCustomerLink(
      { ticket, to: "ada@example.com", name: "Ada" },
      {
        issue: async () => {
          throw new Error("database down");
        },
        send: async () => true,
      },
    );

    assert.equal(result.sent, false);
  });
});

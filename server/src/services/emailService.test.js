const { test, describe } = require("node:test");
const assert = require("node:assert/strict");
const { buildConfirmationText, isEmailConfigured } = require("./emailService");

describe("emailService", () => {
  test("builds a plain-text receipt with the ticket reference", () => {
    const text = buildConfirmationText({
      name: "Ada",
      orgName: "Acme Support",
      ticket: { ticketNumber: "#0042", subject: "Cannot sign in" },
    });

    assert.match(text, /Hello Ada,/);
    assert.match(text, /Acme Support/);
    assert.match(text, /#0042/);
    assert.match(text, /Subject: Cannot sign in/);
    assert.match(text, /Status: Open/);
  });

  test("strips header-breaking newlines from reflected values", () => {
    const text = buildConfirmationText({
      name: "Ada\r\nBcc: attacker@example.com",
      orgName: "Acme",
      ticket: { ticketNumber: "#0001", subject: "Hello\nWorld" },
    });

    assert.doesNotMatch(text, /\r/);
    assert.match(text, /Hello Ada Bcc: attacker@example.com,/);
    assert.match(text, /Subject: Hello World/);
  });

  test("reports SMTP as unconfigured when host/from are absent", () => {
    const previousHost = process.env.SMTP_HOST;
    const previousFrom = process.env.SMTP_FROM;
    delete process.env.SMTP_HOST;
    delete process.env.SMTP_FROM;
    try {
      assert.equal(isEmailConfigured(), false);
    } finally {
      if (previousHost !== undefined) process.env.SMTP_HOST = previousHost;
      if (previousFrom !== undefined) process.env.SMTP_FROM = previousFrom;
    }
  });
});

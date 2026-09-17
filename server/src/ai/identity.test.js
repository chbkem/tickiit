const { test, describe } = require("node:test");
const assert = require("node:assert/strict");
const {
  resolveRequester,
  deriveCustomerKey,
  normalizeEmail,
  isClerkUserId,
} = require("./identity");

const knownUser = {
  id: "user_known",
  firstName: "Ada",
  lastName: "Lovelace",
  emailAddresses: [{ emailAddress: "ada@example.com" }],
};

const makeClerkClient = () => ({
  users: {
    async getUser(ref) {
      if (ref === "user_known") return knownUser;
      const error = new Error("Not found");
      error.status = 404;
      throw error;
    },
    async getUserList({ externalId }) {
      const hit = externalId[0] === "chan-ref" ? knownUser : null;
      return { data: hit ? [hit] : [] };
    },
  },
});

describe("identity", () => {
  test("normalizeEmail lowercases and trims", () => {
    assert.equal(normalizeEmail("  Ada@Example.COM "), "ada@example.com");
  });

  test("isClerkUserId matches the user_ prefix", () => {
    assert.equal(isClerkUserId("user_123"), true);
    assert.equal(isClerkUserId("chan-ref"), false);
  });

  test("deriveCustomerKey prefers email, is deterministic, and lowercases email", () => {
    const a = deriveCustomerKey({ email: "Ada@Example.COM", name: "Ada" });
    const b = deriveCustomerKey({ email: "ada@example.com", name: "Someone else" });
    assert.equal(a.key, b.key);
    assert.equal(a.source, "email");

    const viaRef = deriveCustomerKey({ requesterRef: "chan-ref" });
    assert.equal(viaRef.source, "ref");
    assert.equal(deriveCustomerKey({ name: "Ada" }).source, "name");
    assert.equal(deriveCustomerKey({}), null);
  });

  test("resolveRequester uses Clerk identity for a resolvable user_ ref", async () => {
    const out = await resolveRequester({
      clerkClient: makeClerkClient(),
      requesterRef: "user_known",
      name: "Ignored Name",
      email: "ignored@example.com",
    });
    assert.equal(out.requesterKind, "clerk");
    assert.equal(out.requesterId, "user_known");
    assert.equal(out.requesterKey, "user_known");
    assert.equal(out.requesterEmail, "ada@example.com");
    assert.equal(out.requesterName, "Ada Lovelace");
  });

  test("resolveRequester resolves externalId through getUserList", async () => {
    const out = await resolveRequester({
      clerkClient: makeClerkClient(),
      requesterRef: "chan-ref",
    });
    assert.equal(out.requesterKind, "clerk");
    assert.equal(out.requesterId, "user_known");
  });

  test("resolveRequester falls back to anonymous key from email when ref is unknown", async () => {
    const out = await resolveRequester({
      clerkClient: makeClerkClient(),
      requesterRef: "unknown-ref",
      name: "Grace Hopper",
      email: "grace@example.com",
    });
    assert.equal(out.requesterKind, "anonymous");
    assert.equal(out.requesterName, "Grace Hopper");
    assert.equal(out.requesterEmail, "grace@example.com");
    assert.equal(out.requesterId, deriveCustomerKey({ email: "grace@example.com" }).key);
  });

  test("resolveRequester keys anonymous customers by email (not ref) for stable recognition", async () => {
    const withEmail = await resolveRequester({
      clerkClient: makeClerkClient(),
      requesterRef: "chan-x",
      name: "Ada",
      email: "ada@example.com",
    });
    const later = await resolveRequester({
      clerkClient: makeClerkClient(),
      requesterRef: "chan-y",
      name: "Ada",
      email: "ada@example.com",
    });
    assert.equal(withEmail.requesterKey, later.requesterKey);
    assert.equal(withEmail.requesterKey, deriveCustomerKey({ email: "ada@example.com" }).key);
  });

  test("resolveRequester throws when nothing can derive an identity", async () => {
    await assert.rejects(
      () => resolveRequester({ clerkClient: makeClerkClient(), requesterRef: null }),
      /identity could not be derived/,
    );
  });

  test("resolveRequester proceeds without clerkClient for anonymous input", async () => {
    const out = await resolveRequester({ name: "Lin", email: "lin@example.com" });
    assert.equal(out.requesterKind, "anonymous");
    assert.ok(out.requesterKey.length === 64);
  });
});
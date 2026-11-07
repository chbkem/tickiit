const test = require("node:test");
const assert = require("node:assert/strict");
const crypto = require("node:crypto");

const {
  readEncryptionKey,
  encryptSecret,
  decryptSecret,
  canDecryptSecret,
  randomSecret,
} = require("./secretCrypto");

const KEY = crypto.randomBytes(32);
const OTHER_KEY = crypto.randomBytes(32);
const BASE64_KEY = KEY.toString("base64");

const seal = (plaintext, key) => encryptSecret(plaintext, key);

test("readEncryptionKey", async (t) => {
  await t.test("returns null when unset or blank", () => {
    assert.equal(readEncryptionKey({}), null);
    assert.equal(readEncryptionKey({ CHANNEL_ENCRYPTION_KEY: "   " }), null);
  });

  await t.test("decodes 32 bytes of base64", () => {
    assert.deepEqual(readEncryptionKey({ CHANNEL_ENCRYPTION_KEY: BASE64_KEY }), KEY);
  });

  await t.test("throws on a value that is not 32 bytes", () => {
    assert.throws(
      () => readEncryptionKey({ CHANNEL_ENCRYPTION_KEY: crypto.randomBytes(16).toString("base64") }),
      /32 bytes/,
    );
  });

  await t.test("throws on a value that is not base64", () => {
    assert.throws(
      () => readEncryptionKey({ CHANNEL_ENCRYPTION_KEY: "not-a-real-key-value!!" }),
      /32 bytes|base64/,
    );
  });
});

test("encryptSecret", async (t) => {
  await t.test("round trips a token", () => {
    const token = "123456789:AAFakeTokenValueForTestingPurposes01";
    const sealed = seal(token, KEY);
    assert.equal(decryptSecret(sealed, KEY), token);
  });

  await t.test("stores the three columns separately, all base64", () => {
    const sealed = seal("123456789:AAFakeTokenValueForTestingPurposes01", KEY);
    assert.deepEqual(Object.keys(sealed).sort(), ["authTag", "ciphertext", "iv"]);
    for (const value of Object.values(sealed)) {
      assert.equal(Buffer.from(value, "base64").toString("base64"), value);
    }
  });

  await t.test("never stores the plaintext in any column", () => {
    const token = "123456789:AAFakeTokenValueForTestingPurposes01";
    const sealed = seal(token, KEY);
    for (const value of Object.values(sealed)) {
      assert.ok(!value.includes(token));
      assert.ok(!value.includes("123456789"));
    }
  });

  await t.test("uses a fresh iv each time, so the same token seals differently", () => {
    const token = "123456789:AAFakeTokenValueForTestingPurposes01";
    const a = seal(token, KEY);
    const b = seal(token, KEY);
    assert.notEqual(a.iv, b.iv);
    assert.notEqual(a.ciphertext, b.ciphertext);
    assert.equal(decryptSecret(a, KEY), token);
    assert.equal(decryptSecret(b, KEY), token);
  });

  await t.test("throws when no key is available", () => {
    assert.throws(() => encryptSecret("token", undefined), /CHANNEL_ENCRYPTION_KEY/);
  });
});

test("decryptSecret", async (t) => {
  const token = "123456789:AAFakeTokenValueForTestingPurposes01";

  await t.test("returns null when nothing is stored", () => {
    assert.equal(decryptSecret({}, KEY), null);
    assert.equal(decryptSecret(undefined, KEY), null);
  });

  await t.test("returns null for a half written row", () => {
    const sealed = seal(token, KEY);
    assert.equal(decryptSecret({ ciphertext: sealed.ciphertext }, KEY), null);
    assert.equal(decryptSecret({ ciphertext: sealed.ciphertext, iv: sealed.iv }, KEY), null);
  });

  await t.test("returns null under the wrong key rather than garbage", () => {
    const sealed = seal(token, KEY);
    assert.equal(decryptSecret(sealed, OTHER_KEY), null);
  });

  await t.test("returns null when the ciphertext was tampered with", () => {
    const sealed = seal(token, KEY);
    const bytes = Buffer.from(sealed.ciphertext, "base64");
    bytes[0] = bytes[0] ^ 0xff;
    assert.equal(
      decryptSecret({ ...sealed, ciphertext: bytes.toString("base64") }, KEY),
      null,
    );
  });

  await t.test("returns null when the auth tag was tampered with", () => {
    const sealed = seal(token, KEY);
    const tag = Buffer.from(sealed.authTag, "base64");
    tag[0] = tag[0] ^ 0xff;
    assert.equal(decryptSecret({ ...sealed, authTag: tag.toString("base64") }, KEY), null);
  });
});

test("canDecryptSecret", async (t) => {
  const sealed = seal("123456789:AAFakeTokenValueForTestingPurposes01", KEY);

  await t.test("is true for a readable row under the right key", () => {
    assert.equal(canDecryptSecret(sealed, KEY), true);
  });

  await t.test("is false for a row stranded by a rotated key", () => {
    assert.equal(canDecryptSecret(sealed, OTHER_KEY), false);
  });

  await t.test("is false when no ciphertext is stored", () => {
    assert.equal(canDecryptSecret({ ciphertext: null }, KEY), false);
    assert.equal(canDecryptSecret(null, KEY), false);
  });

  await t.test("is false rather than throwing when no key is available", () => {
    assert.equal(canDecryptSecret(sealed, undefined), false);
  });
});

test("randomSecret", async (t) => {
  await t.test("returns 32 url safe characters by default", () => {
    const secret = randomSecret();
    assert.equal(secret.length, 32);
    assert.match(secret, /^[A-Za-z0-9]+$/);
  });

  await t.test("does not repeat", () => {
    const seen = new Set(Array.from({ length: 50 }, () => randomSecret()));
    assert.equal(seen.size, 50);
  });
});
const crypto = require("node:crypto");

const ALGORITHM = "aes-256-gcm";
const KEY_BYTES = 32;
const IV_BYTES = 12;
const ENCODING = "base64";

const KEY_HINT =
  "Generate one with: node -e \"console.log(require('node:crypto').randomBytes(32).toString('base64'))\"";

/**
 * readEncryptionKey — decodes CHANNEL_ENCRYPTION_KEY into 32 raw bytes.
 *
 * The value is 32 bytes of base64 and nothing else. A value that is present but
 * malformed throws: silently ignoring it would leave the instance unable to
 * accept a token while looking healthy, which is the exact failure this build
 * is meant to remove. A missing value returns null, which disables accepting
 * tokens without breaking startup, so an instance can be brought up before its
 * secrets exist and pasted in afterwards.
 */
const readEncryptionKey = (env = process.env) => {
  const raw = env.CHANNEL_ENCRYPTION_KEY;
  if (raw === undefined || String(raw).trim() === "") return null;

  // Buffer.from is lenient about base64: it silently drops invalid characters
  // rather than throwing, so a length check alone would let a corrupted key
  // through as a wrong key. Re-encode and compare to catch that case here.
  let key;
  try {
    key = Buffer.from(String(raw).trim(), ENCODING);
  } catch {
    throw new Error(`CHANNEL_ENCRYPTION_KEY must be base64 encoded. ${KEY_HINT}`);
  }

  if (key.length !== KEY_BYTES || key.toString(ENCODING) !== String(raw).trim()) {
    throw new Error(
      `CHANNEL_ENCRYPTION_KEY must be exactly ${KEY_BYTES} bytes of base64 for ${ALGORITHM}; the configured value does not decode to that. ${KEY_HINT}`,
    );
  }
  return key;
};

/**
 * resolveKey — the key to use for a single operation.
 *
 * Throws a plain Error when no usable key exists. This is a server
 * misconfiguration, not a client mistake, so it must not become a 4xx. The
 * controller that calls encryptSecret catches this and answers 503.
 */
const resolveKey = (key) => {
  if (key) return key;
  const configured = readEncryptionKey();
  if (!configured) {
    throw new Error(
      `CHANNEL_ENCRYPTION_KEY is not set, so no bot token can be stored or read on this instance. ${KEY_HINT}`,
    );
  }
  return configured;
};

/**
 * encryptSecret — seals a plaintext secret into the three stored columns.
 *
 * The key is an optional parameter so tests can inject a fixed key rather than
 * reading the environment.
 */
const encryptSecret = (plaintext, key) => {
  const resolved = resolveKey(key);
  const iv = crypto.randomBytes(IV_BYTES);
  const cipher = crypto.createCipheriv(ALGORITHM, resolved, iv);
  const ciphertext = Buffer.concat([cipher.update(String(plaintext), "utf8"), cipher.final()]);

  return {
    ciphertext: ciphertext.toString(ENCODING),
    iv: iv.toString(ENCODING),
    authTag: cipher.getAuthTag().toString(ENCODING),
  };
};

/**
 * decryptSecret — opens a sealed secret.
 *
 * Returns null when nothing is stored, and also when the stored row cannot be
 * authenticated: a wrong key, a tampered row, or a missing column. GCM verifies
 * the tag before returning plaintext, so a failure here means "not readable",
 * never "read the wrong thing". A null from a row that does have a ciphertext
 * is the signal that a key rotation has stranded it.
 */
const decryptSecret = ({ ciphertext, iv, authTag } = {}, key) => {
  if (!ciphertext || !iv || !authTag) return null;

  const resolved = resolveKey(key);
  try {
    const decipher = crypto.createDecipheriv(
      ALGORITHM,
      resolved,
      Buffer.from(String(iv), ENCODING),
    );
    decipher.setAuthTag(Buffer.from(String(authTag), ENCODING));
    return Buffer.concat([
      decipher.update(Buffer.from(String(ciphertext), ENCODING)),
      decipher.final(),
    ]).toString("utf8");
  } catch {
    return null;
  }
};

/**
 * canDecryptSecret — whether a stored row still opens under the current key.
 *
 * The startup sweep uses this to find channels stranded by a rotated key.
 */
const canDecryptSecret = (stored, key) => {
  if (!stored || !stored.ciphertext) return false;
  try {
    return decryptSecret(stored, key) !== null;
  } catch {
    return false;
  }
};

/**
 * randomSecret — a URL safe random string for a webhook secret.
 *
 * Telegram echoes this back in X-Telegram-Bot-Api-Secret-Token. It is a
 * different secret with a different job from the bot token: this one only lets
 * its holder post fake updates, the token lets its holder send as the bot.
 */
const randomSecret = (bytes = 32) =>
  crypto.randomBytes(bytes).toString(ENCODING).replace(/[^A-Za-z0-9]/g, "").slice(0, bytes);

module.exports = {
  ALGORITHM,
  KEY_BYTES,
  readEncryptionKey,
  encryptSecret,
  decryptSecret,
  canDecryptSecret,
  randomSecret,
};
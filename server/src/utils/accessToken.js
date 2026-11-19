const crypto = require("crypto");
const { ipKeyGenerator } = require("express-rate-limit");

const TOKEN_BYTES = 32;
const TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const HASH_PREFIX_LENGTH = 12;
const TOKEN_PATTERN = /^[A-Za-z0-9_-]{20,512}$/;

const resolveDeps = ({ crypto: cryptoImpl = crypto, now = () => Date.now() } = {}) => ({
  crypto: cryptoImpl,
  now,
});

const generateToken = (deps) =>
  resolveDeps(deps).crypto.randomBytes(TOKEN_BYTES).toString("base64url");

const hashToken = (raw, deps) =>
  resolveDeps(deps).crypto
    .createHash("sha256")
    .update(String(raw))
    .digest("hex");

const tokenHashPrefix = (raw, deps) => hashToken(raw, deps).slice(0, HASH_PREFIX_LENGTH);

const currentDate = (deps) => new Date(resolveDeps(deps).now());

const expiresAtFor = (deps) => new Date(resolveDeps(deps).now() + TOKEN_TTL_MS);

const isTokenWellFormed = (raw) => typeof raw === "string" && TOKEN_PATTERN.test(raw);

const isTokenUsable = (row, deps) => {
  if (!row || row.revokedAt) return false;
  const expiry =
    row.expiresAt instanceof Date ? row.expiresAt.getTime() : new Date(row.expiresAt).getTime();
  return Number.isFinite(expiry) && expiry > resolveDeps(deps).now();
};

const tokenRateLimitKey = (req) => {
  const raw = req && req.params ? req.params.token : undefined;
  if (!isTokenWellFormed(raw)) {
    return `customer-link:ip:${ipKeyGenerator((req && req.ip) || "unknown")}`;
  }
  return `customer-link:${tokenHashPrefix(raw)}`;
};

module.exports = {
  TOKEN_BYTES,
  TOKEN_TTL_MS,
  HASH_PREFIX_LENGTH,
  generateToken,
  hashToken,
  tokenHashPrefix,
  currentDate,
  expiresAtFor,
  isTokenWellFormed,
  isTokenUsable,
  tokenRateLimitKey,
};

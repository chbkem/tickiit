const crypto = require("crypto");
const { sanitizeText } = require("../utils/sanitize");
const ApiError = require("../utils/ApiError");

const MAX_FIELD_LENGTH = 200;

const cleanString = (value) => {
  if (typeof value !== "string") return null;
  const cleaned = sanitizeText(value);
  return cleaned == null || cleaned === "" ? null : cleaned.slice(0, MAX_FIELD_LENGTH);
};

const buildName = (firstName, lastName) => [firstName, lastName].filter(Boolean).join(" ").trim();

const isClerkUserId = (ref) => typeof ref === "string" && ref.startsWith("user_");

/**
 * resolveUserByRef — maps a channel requesterRef to a Clerk User.
 *
 * `user_*` refs are treated as Clerk user ids (fast path); anything else is
 * resolved via the user's Clerk externalId (the canonical link for webhook /
 * channel adapters). 404s resolve to null so the pipeline can proceed without
 * fabricating an identity.
 */
const resolveUserByRef = async ({ clerkClient, requesterRef }) => {
  if (!requesterRef || !clerkClient) return null;
  if (isClerkUserId(requesterRef)) {
    try {
      return await clerkClient.users.getUser(requesterRef);
    } catch (error) {
      if (error && error.status === 404) return null;
      throw error;
    }
  }
  const { data } = await clerkClient.users.getUserList({ externalId: [requesterRef], limit: 1 });
  return Array.isArray(data) && data.length > 0 ? data[0] : null;
};

const userToProfile = (user) => {
  if (!user) return null;
  const email = Array.isArray(user.emailAddresses) ? user.emailAddresses[0]?.emailAddress : undefined;
  return {
    ref: cleanString(user.id),
    name: cleanString(buildName(user.firstName, user.lastName)),
    email: cleanString(email),
  };
};

const normalizeEmail = (email) => (typeof email === "string" ? email.trim().toLowerCase() : "");

const hash = (value, label) =>
  crypto.createHash("sha256").update(`ticketing:${label}:${value}`).digest("hex");

/**
 * deriveCustomerKey — deterministic recognition key for anonymous customers.
 * Priority: normalized email hash, then channel requesterRef hash (unverified
 * channel identities still group consistently), then name hash.
 */
const deriveCustomerKey = ({ email, requesterRef, name }) => {
  const cleanNothing = (value) => (value == null || value === "" ? null : value);
  const cleanEmail = cleanNothing(normalizeEmail(email));
  if (cleanEmail) return { key: hash(cleanEmail, "email"), source: "email" };
  const cleanRef = cleanNothing(requesterRef);
  if (cleanRef) return { key: hash(cleanRef, "ref"), source: "ref" };
  const cleanName = cleanNothing(name);
  if (cleanName) return { key: hash(cleanName, "name"), source: "name" };
  return null;
};

/**
 * resolveRequester — maps a triage request onto Ticket requester fields.
 *
 * 1. A requesterRef that resolves to a Clerk user becomes the requester
 *    (requesterId + requesterKey = the Clerk user id; name/email from profile).
 * 2. Otherwise a deterministic key is derived from email (preferred),
 *    requesterRef, then name. That key is stored in both requesterId and
 *    requesterKey so repeat customers are recognized across messages with no
 *    Customer table. No auto-assign ever happens.
 *
 * Throws ApiError(400) if no identity can be derived (the schema gate should
 * normally prevent this).
 */
const resolveRequester = async ({ clerkClient, requesterRef, name, email }) => {
  const cleanName = cleanString(name);
  const cleanEmail = cleanString(normalizeEmail(email));

  let user = null;
  try {
    user = await resolveUserByRef({ clerkClient, requesterRef });
  } catch (error) {
    if (error && error.status === 404) {
      user = null;
    } else if (error && (error.status === 401 || error.status === 403)) {
      user = null;
    } else {
      throw error;
    }
  }

  if (user) {
    const profile = userToProfile(user);
    return {
      requesterKind: "clerk",
      requesterId: user.id,
      requesterKey: user.id,
      requesterName: profile?.name ?? cleanName ?? null,
      requesterEmail: profile?.email ?? cleanEmail ?? null,
    };
  }

  const derived = deriveCustomerKey({ email: cleanEmail, requesterRef, name: cleanName });
  if (!derived) {
    throw new ApiError(400, "Requester identity could not be derived; provide a requesterRef or name and email.");
  }
  return {
    requesterKind: "anonymous",
    requesterId: derived.key,
    requesterKey: derived.key,
    requesterName: cleanName ?? null,
    requesterEmail: cleanEmail ?? null,
  };
};

module.exports = {
  resolveRequester,
  resolveUserByRef,
  userToProfile,
  deriveCustomerKey,
  normalizeEmail,
  isClerkUserId,
  buildName,
};
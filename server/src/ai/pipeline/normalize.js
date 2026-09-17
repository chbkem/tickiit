const { sanitizeText } = require("../../utils/sanitize");

const MAX_SUBJECT_LENGTH = 2000;
const MAX_BODY_LENGTH = 8000;
const MAX_IDENTIFIER_LENGTH = 200;

const SUBJECT_KEYS = ["subject", "title", "headline"];
const BODY_KEYS = ["body", "description", "message", "text", "plain", "content", "details"];

const cleanString = (value) => {
  const cleaned = sanitizeText(value);
  return cleaned == null || cleaned === "" ? null : cleaned;
};

const truncate = (text, max) => (text.length <= max ? text : `${text.slice(0, max - 1).trimEnd()}…`);

const firstLine = (text) => text.split("\n")[0].trim();

const readField = (raw, keys) => {
  for (const key of keys) {
    if (typeof raw?.[key] === "string") return raw[key];
  }
  return null;
};

class NormalizeError extends Error {
  constructor(message) {
    super(message);
    this.name = "NormalizeError";
  }
}

/**
 * normalize — the worker's untrusted-input gate (build step 6).
 *
 * Turns the stored `IngestionEvent.rawPayload` into a bounded, sanitized
 * `{ subject, body, requesterRef, orgId, channel }` envelope. It runs inside
 * the worker (not just the HTTP route) so a tampered row is handled the same
 * way as hostile inbound text: every string is passed through sanitizeText and
 * capped. Channel-specific shapes collapse onto a small set of subject/body
 * keys; a raw string payload (some webhooks send text only) is treated as body;
 * when no subject is present the body's first line becomes the subject, and a
 * payload with neither yields a NormalizeError the runner reports as FAILED.
 */
const normalize = (rawPayload, { channel = "UNKNOWN", requesterRef = null, orgId = null } = {}) => {
  const raw = typeof rawPayload === "string" ? { message: rawPayload } : rawPayload;
  if (raw == null || typeof raw !== "object") {
    throw new NormalizeError("rawPayload must be an object or a string.");
  }

  let subject = cleanString(readField(raw, SUBJECT_KEYS));
  let body = cleanString((readField(raw, BODY_KEYS) ?? "").replace(/\r\n/g, "\n"));

  if (subject == null && body != null) {
    const line = firstLine(body);
    subject = line ? cleanString(line.slice(0, MAX_SUBJECT_LENGTH)) : null;
  }

  if (subject == null) {
    throw new NormalizeError("No subject or body could be derived from the payload.");
  }

  subject = truncate(subject, MAX_SUBJECT_LENGTH);
  if (body != null) body = truncate(body, MAX_BODY_LENGTH);

  const inlineRequester = cleanString(raw.requesterRef ?? raw.requester ?? raw.from);
  const finalRequesterRef = cleanString(requesterRef) ?? inlineRequester;
  const cleanOrgId = cleanString(orgId);
  const cleanChannel = cleanString(channel) ?? "UNKNOWN";

  return {
    channel: truncate(cleanChannel, MAX_IDENTIFIER_LENGTH),
    subject,
    body,
    requesterRef: finalRequesterRef ? truncate(finalRequesterRef, MAX_IDENTIFIER_LENGTH) : null,
    orgId: cleanOrgId ? truncate(cleanOrgId, MAX_IDENTIFIER_LENGTH) : null,
  };
};

module.exports = { normalize, NormalizeError, MAX_SUBJECT_LENGTH, MAX_BODY_LENGTH, SUBJECT_KEYS, BODY_KEYS };
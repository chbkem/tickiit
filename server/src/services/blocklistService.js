const prisma = require("../lib/prisma");
const logger = require("../lib/logger");
const { DISPOSABLE_DOMAINS } = require("../spam/spamRules");

const disposableSet = new Set(DISPOSABLE_DOMAINS);

const isExpired = (entry, nowMs) =>
  Boolean(entry.expiresAt && entry.expiresAt.getTime() <= nowMs);

/**
 * domainMatches — a domain matches a blocklist value when it is the value or a
 * subdomain of it (`mail.evil.com` matches a blocklisted `evil.com`).
 */
const domainMatches = (domain, value) => domain === value || domain.endsWith(`.${value}`);

const domainIsDisposable = (domain) => {
  if (disposableSet.has(domain)) return true;
  const labels = domain.split(".");
  for (let i = 1; i < labels.length; i += 1) {
    if (disposableSet.has(labels.slice(i).join("."))) return true;
  }
  return false;
};

/**
 * findBlocklistMatch — the first live match across email, domain (with
 * subdomains), the bundled disposable list, and the IP hash. Expired entries
 * are ignored. Fails open (returns null) on a database error so a blocklist
 * outage never blocks a real customer.
 */
const findBlocklistMatch = async ({ email, domain, ipHash, now = new Date() }) => {
  const nowMs = now.getTime();

  try {
    const clauses = [];
    if (email) clauses.push({ kind: "EMAIL", value: email });
    if (ipHash) clauses.push({ kind: "IP", value: ipHash });
    if (domain) clauses.push({ kind: "DOMAIN", value: domain });

    const entries = clauses.length
      ? await prisma.blocklistEntry.findMany({ where: { OR: clauses } })
      : [];

    const live = entries.filter((entry) => !isExpired(entry, nowMs));

    if (email) {
      const emailMatch = live.find((entry) => entry.kind === "EMAIL" && entry.value === email);
      if (emailMatch) return emailMatch;
    }

    if (ipHash) {
      const ipMatch = live.find((entry) => entry.kind === "IP" && entry.value === ipHash);
      if (ipMatch) return ipMatch;
    }

    if (domain) {
      const domainEntries = live.filter((entry) => entry.kind === "DOMAIN");
      const domainMatch = domainEntries.find((entry) => domainMatches(domain, entry.value));
      if (domainMatch) return domainMatch;

      if (domainIsDisposable(domain)) {
        return { kind: "DOMAIN", value: domain, reason: "disposable_domain" };
      }
    }

    return null;
  } catch (error) {
    logger.error("Blocklist lookup failed", { errorMessage: error.message });
    return null;
  }
};

module.exports = { findBlocklistMatch, domainMatches, domainIsDisposable };

const logger = require("../lib/logger");
const attemptService = require("./attemptService");
const { ATTEMPT_RETENTION_DAYS, QUARANTINE_RETENTION_DAYS, DAY_MS } = require("../spam/spamRules");

const RETENTION_INTERVAL_MS = DAY_MS;

let timer = null;
let running = false;

const runRetention = async () => {
  if (running) {
    logger.warn("Spam retention run skipped: a previous run is still in progress");
    return;
  }
  running = true;
  try {
    const now = Date.now();
    const attemptCutoff = new Date(now - ATTEMPT_RETENTION_DAYS * DAY_MS);
    const ticketCutoff = new Date(now - QUARANTINE_RETENTION_DAYS * DAY_MS);

    const attempts = await attemptService.purgeOldAttempts(attemptCutoff);
    const tickets = await attemptService.purgeOldQuarantinedTickets(ticketCutoff);

    logger.info("Spam retention run complete", {
      attemptsDeleted: attempts.count,
      quarantinedTicketsDeleted: tickets.count,
    });
  } catch (error) {
    logger.error("Spam retention run failed", { errorMessage: error.message });
  } finally {
    running = false;
  }
};

/**
 * startRetentionSchedule — runs once on startup, then daily. A single module
 * level guard keeps two runs from overlapping, and the interval is unref'd so
 * it never holds the process open on its own.
 */
const startRetentionSchedule = () => {
  if (timer) return timer;
  timer = setInterval(runRetention, RETENTION_INTERVAL_MS);
  if (typeof timer.unref === "function") timer.unref();
  runRetention();
  return timer;
};

module.exports = { runRetention, startRetentionSchedule, RETENTION_INTERVAL_MS };

const DEFAULT_FAILURE_THRESHOLD = 3;
const DEFAULT_COOLDOWN_MS = 60_000;

const STATE = Object.freeze({
  CLOSED: "CLOSED",
  OPEN: "OPEN",
  HALF_OPEN: "HALF_OPEN",
});

/**
 * CircuitBreaker — in-process provider tripwire (build step 6).
 *
 * The runner feeds it provider outcomes: recordFailure() on provider-level
 * errors/timeouts, recordSuccess() on a clean model run. After
 * `failureThreshold` consecutive failures the breaker OPENs; while OPEN the
 * runner parks outcomes as REVIEW instead of spending a model call. After
 * `cooldownMs` it moves to HALF_OPEN and the next recordSuccess()/recordFailure()
 * decides whether to close or re-open. reset() (manual admin reset in step 7)
 * forces it back to CLOSED.
 *
 * Only provider-level outcomes should be counted — validation/confidence
 * outcomes are business results, not breaker-worthy infrastructure failures.
 */
const createCircuitBreaker = ({
  failureThreshold = DEFAULT_FAILURE_THRESHOLD,
  cooldownMs = DEFAULT_COOLDOWN_MS,
  now = Date.now,
} = {}) => {
  const threshold = Math.max(1, Math.floor(failureThreshold));
  const cooldown = Math.max(0, cooldownMs);
  let state = STATE.CLOSED;
  let consecutiveFailures = 0;
  let openedAt = null;

  return {
    get state() {
      if (state === STATE.OPEN && now() - openedAt >= cooldown) {
        state = STATE.HALF_OPEN;
      }
      return state;
    },

    get consecutiveFailures() {
      return consecutiveFailures;
    },

    isOpen() {
      return this.state === STATE.OPEN;
    },

    canProceed() {
      return this.state !== STATE.OPEN;
    },

    recordSuccess() {
      consecutiveFailures = 0;
      if (state === STATE.HALF_OPEN) state = STATE.CLOSED;
      return this.state;
    },

    recordFailure() {
      consecutiveFailures += 1;
      if (consecutiveFailures >= threshold) {
        state = STATE.OPEN;
        openedAt = now();
      }
      return this.state;
    },

    reset() {
      consecutiveFailures = 0;
      openedAt = null;
      state = STATE.CLOSED;
      return this.state;
    },
  };
};

module.exports = { createCircuitBreaker, STATE, DEFAULT_FAILURE_THRESHOLD, DEFAULT_COOLDOWN_MS };
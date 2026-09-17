const { test, describe } = require("node:test");
const assert = require("node:assert/strict");
const { createCircuitBreaker, STATE, DEFAULT_FAILURE_THRESHOLD } = require("./circuitBreaker");

describe("createCircuitBreaker", () => {
  test("starts CLOSED and proceeds", () => {
    const breaker = createCircuitBreaker();
    assert.equal(breaker.state, STATE.CLOSED);
    assert.equal(breaker.isOpen(), false);
    assert.equal(breaker.canProceed(), true);
  });

  test("opens after the failure threshold of consecutive failures", () => {
    const breaker = createCircuitBreaker({ failureThreshold: 3 });
    assert.equal(breaker.recordFailure(), STATE.CLOSED);
    assert.equal(breaker.recordFailure(), STATE.CLOSED);
    assert.equal(breaker.recordFailure(), STATE.OPEN);
    assert.equal(breaker.isOpen(), true);
    assert.equal(breaker.consecutiveFailures, 3);
  });

  test("a success resets the consecutive-failure count before it trips", () => {
    const breaker = createCircuitBreaker({ failureThreshold: 3 });
    breaker.recordFailure();
    breaker.recordFailure();
    breaker.recordSuccess();
    assert.equal(breaker.state, STATE.CLOSED);
    assert.equal(breaker.consecutiveFailures, 0);
    breaker.recordFailure();
    breaker.recordFailure();
    breaker.recordFailure();
    assert.equal(breaker.state, STATE.OPEN);
  });

  test("after the cooldown elapses, the breaker is HALF_OPEN", () => {
    let clock = 1_000;
    const breaker = createCircuitBreaker({ failureThreshold: 1, cooldownMs: 5_000, now: () => clock });
    breaker.recordFailure();
    assert.equal(breaker.state, STATE.OPEN);
    clock += 5_000;
    assert.equal(breaker.state, STATE.HALF_OPEN);
    assert.equal(breaker.canProceed(), true);
  });

  test("a probe success in HALF_OPEN closes; a probe failure re-opens immediately", () => {
    let clock = 0;
    const breaker = createCircuitBreaker({ failureThreshold: 2, cooldownMs: 1_000, now: () => clock });
    breaker.recordFailure();
    breaker.recordFailure();
    assert.equal(breaker.state, STATE.OPEN);
    clock += 1_000;
    assert.equal(breaker.state, STATE.HALF_OPEN);
    breaker.recordSuccess();
    assert.equal(breaker.state, STATE.CLOSED);

    breaker.recordFailure();
    breaker.recordFailure();
    assert.equal(breaker.state, STATE.OPEN);
    clock += 1_000;
    assert.equal(breaker.state, STATE.HALF_OPEN);
    breaker.recordFailure();
    assert.equal(breaker.state, STATE.OPEN);
  });

  test("reset() forces the breaker back to CLOSED and clears the counter", () => {
    let clock = 0;
    const breaker = createCircuitBreaker({ failureThreshold: 1, cooldownMs: 10_000, now: () => clock });
    breaker.recordFailure();
    assert.equal(breaker.state, STATE.OPEN);
    breaker.reset();
    assert.equal(breaker.state, STATE.CLOSED);
    assert.equal(breaker.consecutiveFailures, 0);
    clock += 10_000;
    assert.equal(breaker.state, STATE.CLOSED);
  });

  test("floors failureThreshold at 1", () => {
    const breaker = createCircuitBreaker({ failureThreshold: 0 });
    breaker.recordFailure();
    assert.equal(breaker.state, STATE.OPEN);
    assert.equal(DEFAULT_FAILURE_THRESHOLD, 3);
  });
});
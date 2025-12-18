'use strict';

const { CircuitBreakerTrippedError } = require('./errors');

class CircuitBreaker {
  constructor({
    logger,
    maxConsecutiveFailures = 3,
    coolOffMs = 5 * 60 * 1000,
  } = {}) {
    if (!logger) throw new Error('CircuitBreaker requires { logger }');
    this.logger = logger;

    this.maxConsecutiveFailures = maxConsecutiveFailures;
    this.coolOffMs = coolOffMs;

    this.state = {
      halted: false,
      trippedAt: null,
      reason: null,
      data: null,
      consecutiveFailures: 0,
    };
  }

  isHalted() {
    if (!this.state.halted) return false;

    if (this.coolOffMs > 0 && this.state.trippedAt) {
      const elapsed = Date.now() - this.state.trippedAt;
      if (elapsed >= this.coolOffMs) {
        this.logger.warn('circuit_breaker.auto_reset', {
          previous: { ...this.state },
          elapsedMs: elapsed,
        });
        this.reset({ auto: true });
        return false;
      }
    }

    return true;
  }

  ensureHealthy() {
    if (!this.isHalted()) return;
    throw new CircuitBreakerTrippedError('Circuit breaker is tripped; trading is halted', {
      reason: this.state.reason,
      data: this.state.data,
    });
  }

  trip(reason, data) {
    if (!this.state.halted) {
      this.state.halted = true;
      this.state.trippedAt = Date.now();
      this.state.reason = reason;
      this.state.data = data;
      this.logger.error('circuit_breaker.tripped', { reason, data });
    } else {
      this.logger.warn('circuit_breaker.trip_while_halted', { reason, data, existing: { ...this.state } });
    }
  }

  reset({ auto = false } = {}) {
    this.logger.warn('circuit_breaker.reset', { auto, previous: { ...this.state } });
    this.state = {
      halted: false,
      trippedAt: null,
      reason: null,
      data: null,
      consecutiveFailures: 0,
    };
  }

  recordSuccess({ scope = 'unknown' } = {}) {
    if (this.state.consecutiveFailures !== 0) {
      this.logger.info('circuit_breaker.failure_counter_reset', { scope, previous: this.state.consecutiveFailures });
    }
    this.state.consecutiveFailures = 0;
  }

  recordFailure({ scope = 'unknown', error } = {}) {
    this.state.consecutiveFailures += 1;
    this.logger.warn('circuit_breaker.failure_recorded', {
      scope,
      consecutiveFailures: this.state.consecutiveFailures,
      error,
    });

    if (this.maxConsecutiveFailures > 0 && this.state.consecutiveFailures >= this.maxConsecutiveFailures) {
      this.trip('too_many_consecutive_failures', { scope, consecutiveFailures: this.state.consecutiveFailures });
    }
  }
}

module.exports = {
  CircuitBreaker,
};

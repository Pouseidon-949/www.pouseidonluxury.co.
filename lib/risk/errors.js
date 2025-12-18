'use strict';

class SafetyCheckError extends Error {
  constructor(message, { code = 'SAFETY_CHECK_FAILED', data } = {}) {
    super(message);
    this.name = 'SafetyCheckError';
    this.code = code;
    this.data = data;
  }
}

class CircuitBreakerTrippedError extends Error {
  constructor(message, { reason, data } = {}) {
    super(message);
    this.name = 'CircuitBreakerTrippedError';
    this.reason = reason;
    this.data = data;
  }
}

class RetryableTransactionError extends Error {
  constructor(message, { data, cause } = {}) {
    super(message);
    this.name = 'RetryableTransactionError';
    this.data = data;
    this.cause = cause;
  }
}

module.exports = {
  SafetyCheckError,
  CircuitBreakerTrippedError,
  RetryableTransactionError,
};

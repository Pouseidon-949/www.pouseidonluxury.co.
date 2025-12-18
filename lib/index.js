'use strict';

const { AuditLogger, DEFAULT_AUDIT_PATH } = require('./logger');
const { CircuitBreaker } = require('./risk/circuitBreaker');
const { WalletBalanceMonitor } = require('./risk/walletMonitor');
const { CapitalSafetyValidator } = require('./risk/capitalSafety');
const { SlippageEnforcer, minOutFromExpected, slippageBps } = require('./risk/slippage');
const { FeeManager } = require('./risk/feeManager');
const { AtomicExecutor } = require('./risk/atomicExecutor');
const { FileFailedTxStore, DEFAULT_FAILED_TX_PATH } = require('./risk/failedTxStore');
const { RetryQueue } = require('./risk/retryQueue');
const { BalanceReconciler } = require('./risk/reconciliation');
const { RiskManager } = require('./risk/riskManager');
const { ConsoleAlertSink } = require('./risk/alerts');
const { SafetyCheckError, CircuitBreakerTrippedError, RetryableTransactionError } = require('./risk/errors');

module.exports = {
  AuditLogger,
  DEFAULT_AUDIT_PATH,

  CircuitBreaker,
  ConsoleAlertSink,

  WalletBalanceMonitor,
  CapitalSafetyValidator,
  SlippageEnforcer,
  minOutFromExpected,
  slippageBps,
  FeeManager,
  AtomicExecutor,

  FileFailedTxStore,
  DEFAULT_FAILED_TX_PATH,
  RetryQueue,

  BalanceReconciler,
  RiskManager,

  SafetyCheckError,
  CircuitBreakerTrippedError,
  RetryableTransactionError,
};

'use strict';

const { RetryableTransactionError, SafetyCheckError } = require('./errors');

class AtomicExecutor {
  constructor({ logger, circuitBreaker, txProvider, failedTxStore, retryQueue } = {}) {
    if (!logger) throw new Error('AtomicExecutor requires { logger }');
    if (!circuitBreaker) throw new Error('AtomicExecutor requires { circuitBreaker }');
    if (!txProvider || typeof txProvider.sendTransaction !== 'function' || typeof txProvider.waitForReceipt !== 'function') {
      throw new Error('AtomicExecutor requires { txProvider } with sendTransaction() and waitForReceipt()');
    }

    this.logger = logger;
    this.circuitBreaker = circuitBreaker;
    this.txProvider = txProvider;
    this.failedTxStore = failedTxStore;
    this.retryQueue = retryQueue;
  }

  async executeSequence({ tradeId, steps, recovery } = {}) {
    this.circuitBreaker.ensureHealthy();

    if (!Array.isArray(steps) || steps.length === 0) {
      throw new SafetyCheckError('AtomicExecutor requires non-empty steps[]', { code: 'MISSING_STEPS' });
    }

    const completed = [];

    this.logger.info('atomic_exec.sequence_start', {
      tradeId,
      steps: steps.map((s) => ({ scope: s.scope, meta: s.txRequest?.meta })),
    });

    for (const step of steps) {
      const scope = step.scope || 'unknown_step';
      const txRequest = step.txRequest;
      const retryable = step.retryable ?? false;
      const maxAttempts = step.maxAttempts ?? 3;

      try {
        this.circuitBreaker.ensureHealthy();

        this.logger.info('atomic_exec.step_send', { tradeId, scope, txRequestMeta: txRequest?.meta });
        const txHash = await this.txProvider.sendTransaction(txRequest);
        this.logger.info('atomic_exec.step_sent', { tradeId, scope, txHash });

        const receipt = await this.txProvider.waitForReceipt(txHash);
        this.logger.info('atomic_exec.step_receipt', { tradeId, scope, txHash, receipt });

        if (!receipt || receipt.status !== 'success') {
          throw new RetryableTransactionError('Transaction execution failed / reverted', { data: { txHash, receipt } });
        }

        completed.push({ scope, txHash, receipt });
      } catch (err) {
        this.logger.error('atomic_exec.step_failed', { tradeId, scope, err, completed });

        const failureEntry = this.failedTxStore
          ? this.failedTxStore.recordFailure({ tradeId, scope, txRequest, error: err, retryable, attempt: 0, maxAttempts })
          : null;

        if (retryable && this.retryQueue) {
          this.retryQueue.enqueue({ tradeId, scope, txRequest, maxAttempts, failedTxId: failureEntry?.id });
          this.logger.warn('atomic_exec.retry_scheduled', { tradeId, scope, failedTxId: failureEntry?.id });
        } else {
          this.circuitBreaker.trip('atomic_execution_failed', { tradeId, scope, error: err });
        }

        if (typeof recovery === 'function') {
          try {
            this.logger.warn('atomic_exec.recovery_start', { tradeId, scope, completed });
            await recovery({ tradeId, failedScope: scope, completed, error: err });
            this.logger.warn('atomic_exec.recovery_done', { tradeId, scope });
          } catch (recoveryErr) {
            this.logger.error('atomic_exec.recovery_failed', { tradeId, scope, recoveryErr });
            this.circuitBreaker.trip('recovery_failed', { tradeId, scope, recoveryErr });
          }
        }

        return {
          ok: false,
          tradeId,
          failedScope: scope,
          error: err,
          completed,
        };
      }
    }

    this.logger.info('atomic_exec.sequence_success', { tradeId, completed });
    this.circuitBreaker.recordSuccess({ scope: 'atomic_exec' });

    return {
      ok: true,
      tradeId,
      completed,
    };
  }
}

module.exports = {
  AtomicExecutor,
};

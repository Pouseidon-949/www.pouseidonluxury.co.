'use strict';

const { sleep, clampInt } = require('../utils');

function computeDelayMs({ attempt, baseDelayMs, maxDelayMs, jitterMs }) {
  const a = clampInt(attempt, 1, 1000);
  const exp = Math.min(maxDelayMs, baseDelayMs * Math.pow(2, a - 1));
  const jitter = jitterMs ? Math.floor(Math.random() * jitterMs) : 0;
  return exp + jitter;
}

class RetryQueue {
  constructor({
    logger,
    circuitBreaker,
    failedTxStore,
    provider,
    baseDelayMs = 1000,
    maxDelayMs = 60_000,
    jitterMs = 250,
    concurrency = 1,
  } = {}) {
    if (!logger) throw new Error('RetryQueue requires { logger }');
    if (!circuitBreaker) throw new Error('RetryQueue requires { circuitBreaker }');
    if (!failedTxStore) throw new Error('RetryQueue requires { failedTxStore }');
    if (!provider || typeof provider.sendTransaction !== 'function') {
      throw new Error('RetryQueue requires { provider } with sendTransaction()');
    }

    this.logger = logger;
    this.circuitBreaker = circuitBreaker;
    this.failedTxStore = failedTxStore;
    this.provider = provider;

    this.baseDelayMs = baseDelayMs;
    this.maxDelayMs = maxDelayMs;
    this.jitterMs = jitterMs;
    this.concurrency = clampInt(concurrency, 1, 25);

    this._running = false;
    this._queue = [];
  }

  size() {
    return this._queue.length;
  }

  enqueue({ tradeId, scope, txRequest, maxAttempts = 3, failedTxId } = {}) {
    const task = {
      failedTxId,
      tradeId,
      scope,
      txRequest,
      maxAttempts: clampInt(maxAttempts, 1, 50),
      attempt: 0,
    };
    this._queue.push(task);
    this.logger.warn('retry_queue.enqueued', { tradeId, scope, maxAttempts: task.maxAttempts, queueSize: this._queue.length });
    return task;
  }

  start() {
    if (this._running) return;
    this._running = true;
    for (let i = 0; i < this.concurrency; i += 1) {
      this._workerLoop(i).catch((err) => {
        this.logger.error('retry_queue.worker_crashed', { worker: i, err });
        this.circuitBreaker.trip('retry_worker_crash', { worker: i, err });
      });
    }
    this.logger.info('retry_queue.started', { concurrency: this.concurrency });
  }

  stop() {
    this._running = false;
    this.logger.info('retry_queue.stopped', {});
  }

  async _workerLoop(workerId) {
    while (this._running) {
      if (this.circuitBreaker.isHalted()) {
        await sleep(250);
        continue;
      }

      const task = this._queue.shift();
      if (!task) {
        await sleep(100);
        continue;
      }

      task.attempt += 1;

      const delayMs = computeDelayMs({
        attempt: task.attempt,
        baseDelayMs: this.baseDelayMs,
        maxDelayMs: this.maxDelayMs,
        jitterMs: this.jitterMs,
      });

      if (task.attempt > 1) {
        this.logger.warn('retry_queue.backoff', { workerId, tradeId: task.tradeId, scope: task.scope, attempt: task.attempt, delayMs });
        await sleep(delayMs);
      }

      try {
        this.logger.warn('retry_queue.attempt', { workerId, tradeId: task.tradeId, scope: task.scope, attempt: task.attempt });
        const txHash = await this.provider.sendTransaction(task.txRequest);
        this.failedTxStore.recordRetryAttempt({
          failedTxId: task.failedTxId,
          tradeId: task.tradeId,
          scope: task.scope,
          attempt: task.attempt,
          txHash,
        });
        this.logger.info('retry_queue.succeeded', { workerId, tradeId: task.tradeId, scope: task.scope, attempt: task.attempt, txHash });
      } catch (err) {
        this.failedTxStore.recordRetryAttempt({
          failedTxId: task.failedTxId,
          tradeId: task.tradeId,
          scope: task.scope,
          attempt: task.attempt,
          error: err,
        });

        if (task.attempt >= task.maxAttempts) {
          this.logger.error('retry_queue.exhausted', { workerId, tradeId: task.tradeId, scope: task.scope, attempts: task.attempt, err });
          this.circuitBreaker.trip('retry_exhausted', { tradeId: task.tradeId, scope: task.scope, attempts: task.attempt, err });
          continue;
        }

        this.logger.warn('retry_queue.failed_will_retry', { workerId, tradeId: task.tradeId, scope: task.scope, attempt: task.attempt, maxAttempts: task.maxAttempts, err });
        this._queue.push(task);
      }
    }
  }
}

module.exports = {
  RetryQueue,
};

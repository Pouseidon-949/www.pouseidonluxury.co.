'use strict';

const path = require('path');
const crypto = require('crypto');
const { appendJsonlSync, ensureDirSync } = require('../utils');

const DEFAULT_FAILED_TX_PATH = path.join(process.cwd(), 'var', 'failed_transactions.jsonl');

function randomId() {
  return crypto.randomBytes(16).toString('hex');
}

class FileFailedTxStore {
  constructor({ logger, filePath: fp = DEFAULT_FAILED_TX_PATH } = {}) {
    if (!logger) throw new Error('FileFailedTxStore requires { logger }');
    this.logger = logger;
    this.filePath = fp;
    ensureDirSync(path.dirname(this.filePath));
  }

  record(event) {
    const entry = {
      id: event.id || randomId(),
      ts: new Date().toISOString(),
      ...event,
    };
    appendJsonlSync(this.filePath, entry);
    this.logger.warn('failed_tx.recorded', { entry });
    return entry;
  }

  recordFailure({ tradeId, scope, txRequest, txHash, error, retryable = false, attempt = 0, maxAttempts = 0 } = {}) {
    return this.record({
      kind: 'failure',
      tradeId,
      scope,
      txHash,
      retryable,
      attempt,
      maxAttempts,
      txRequestMeta: txRequest?.meta,
      error,
    });
  }

  recordRetryAttempt({ failedTxId, tradeId, scope, attempt, txHash, error } = {}) {
    return this.record({
      kind: 'retry_attempt',
      failedTxId,
      tradeId,
      scope,
      attempt,
      txHash,
      error,
    });
  }
}

module.exports = {
  FileFailedTxStore,
  DEFAULT_FAILED_TX_PATH,
};

'use strict';

const { SafetyCheckError } = require('./errors');

function toPlainObject(mapOrObj) {
  if (!mapOrObj) return {};
  if (mapOrObj instanceof Map) return Object.fromEntries(mapOrObj.entries());
  return { ...mapOrObj };
}

function normalizeBigInt(value) {
  if (typeof value === 'bigint') return value;
  if (value === null || value === undefined) return 0n;
  return BigInt(value);
}

function getBalance(balances, asset) {
  if (!balances) return 0n;
  if (balances instanceof Map) return normalizeBigInt(balances.get(asset) ?? 0n);
  return normalizeBigInt(balances[asset] ?? 0n);
}

function bpsDrop(from, to) {
  const f = normalizeBigInt(from);
  const t = normalizeBigInt(to);
  if (f <= 0n) return 0;
  if (t >= f) return 0;
  const drop = f - t;
  const bps = (drop * 10000n) / f;
  return Number(bps);
}

class WalletBalanceMonitor {
  constructor({
    logger,
    circuitBreaker,
    alertSink,
    provider,
    minBalances = {},
    maxDrawdownBps = 0,
    checkIntervalMs = 0,
  } = {}) {
    if (!logger) throw new Error('WalletBalanceMonitor requires { logger }');
    if (!circuitBreaker) throw new Error('WalletBalanceMonitor requires { circuitBreaker }');
    if (!provider || typeof provider.getBalances !== 'function') {
      throw new Error('WalletBalanceMonitor requires { provider } with getBalances()');
    }

    this.logger = logger;
    this.circuitBreaker = circuitBreaker;
    this.alertSink = alertSink;
    this.provider = provider;
    this.minBalances = toPlainObject(minBalances);
    this.maxDrawdownBps = maxDrawdownBps;
    this.checkIntervalMs = checkIntervalMs;

    this._timer = null;
    this._baseline = null;
    this._last = null;
  }

  baseline() {
    return this._baseline;
  }

  lastSnapshot() {
    return this._last;
  }

  start() {
    if (!this.checkIntervalMs || this.checkIntervalMs <= 0) return;
    if (this._timer) return;

    this._timer = setInterval(() => {
      this.checkNow({ tag: 'interval' }).catch((err) => {
        this.logger.error('wallet_monitor.interval_check_failed', { err });
        this.circuitBreaker.recordFailure({ scope: 'wallet_monitor.interval', error: err });
      });
    }, this.checkIntervalMs);

    this.logger.info('wallet_monitor.started', { checkIntervalMs: this.checkIntervalMs });
  }

  stop() {
    if (!this._timer) return;
    clearInterval(this._timer);
    this._timer = null;
    this.logger.info('wallet_monitor.stopped', {});
  }

  async checkNow({ tag = 'manual' } = {}) {
    const balances = await this.provider.getBalances();
    const snapshot = {
      tag,
      at: new Date().toISOString(),
      balances: toPlainObject(balances),
    };

    if (!this._baseline) {
      this._baseline = snapshot;
      this.logger.info('wallet_monitor.baseline_set', { snapshot });
    }

    this._last = snapshot;

    const violations = [];

    for (const [asset, min] of Object.entries(this.minBalances)) {
      const bal = getBalance(balances, asset);
      const minBal = normalizeBigInt(min);
      if (bal < minBal) {
        violations.push({ type: 'min_balance', asset, balance: bal, min: minBal });
      }
    }

    if (this.maxDrawdownBps > 0 && this._baseline) {
      for (const asset of Object.keys(this._baseline.balances)) {
        const base = normalizeBigInt(this._baseline.balances[asset] ?? 0);
        const cur = getBalance(balances, asset);
        const drop = bpsDrop(base, cur);
        if (drop >= this.maxDrawdownBps) {
          violations.push({
            type: 'drawdown',
            asset,
            baseline: base,
            balance: cur,
            dropBps: drop,
            maxDrawdownBps: this.maxDrawdownBps,
          });
        }
      }
    }

    this.logger.info('wallet_monitor.checked', { snapshot, violationsCount: violations.length });

    if (violations.length) {
      const err = new SafetyCheckError('Wallet balance safety violation', {
        code: 'WALLET_BALANCE_VIOLATION',
        data: { violations },
      });

      this.circuitBreaker.trip('wallet_balance_violation', { violations });
      if (this.alertSink && typeof this.alertSink.alert === 'function') {
        await this.alertSink.alert({
          level: 'error',
          type: 'wallet_balance_violation',
          message: 'Wallet balance violation detected; circuit breaker tripped',
          data: { violations },
        });
      }

      throw err;
    }

    return snapshot;
  }
}

module.exports = {
  WalletBalanceMonitor,
};

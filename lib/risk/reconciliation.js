'use strict';

const { SafetyCheckError } = require('./errors');

function normalizeBigInt(value) {
  if (typeof value === 'bigint') return value;
  if (value === null || value === undefined) return 0n;
  return BigInt(value);
}

function toPlainObject(mapOrObj) {
  if (!mapOrObj) return {};
  if (mapOrObj instanceof Map) return Object.fromEntries(mapOrObj.entries());
  return { ...mapOrObj };
}

function absDiff(a, b) {
  const x = normalizeBigInt(a);
  const y = normalizeBigInt(b);
  return x >= y ? x - y : y - x;
}

class BalanceReconciler {
  constructor({ logger, circuitBreaker, walletProvider, toleranceByAsset = {} } = {}) {
    if (!logger) throw new Error('BalanceReconciler requires { logger }');
    if (!circuitBreaker) throw new Error('BalanceReconciler requires { circuitBreaker }');
    if (!walletProvider || typeof walletProvider.getBalances !== 'function') {
      throw new Error('BalanceReconciler requires { walletProvider } with getBalances()');
    }

    this.logger = logger;
    this.circuitBreaker = circuitBreaker;
    this.walletProvider = walletProvider;
    this.toleranceByAsset = { ...toleranceByAsset };
  }

  async reconcile({ expectedBalances, tag = 'manual' } = {}) {
    const expected = toPlainObject(expectedBalances);
    const actualBalances = await this.walletProvider.getBalances();
    const actual = toPlainObject(actualBalances);

    const assets = new Set([...Object.keys(expected), ...Object.keys(actual)]);
    const mismatches = [];

    for (const asset of assets) {
      const exp = normalizeBigInt(expected[asset] ?? 0n);
      const act = normalizeBigInt(actual[asset] ?? 0n);
      const tol = normalizeBigInt(this.toleranceByAsset[asset] ?? 0n);
      const diff = absDiff(exp, act);

      if (diff > tol) {
        mismatches.push({ asset, expected: exp, actual: act, diff, tolerance: tol });
      }
    }

    this.logger.info('balance_reconcile.checked', { tag, mismatchesCount: mismatches.length });

    if (mismatches.length) {
      const err = new SafetyCheckError('Balance reconciliation mismatch detected', {
        code: 'BALANCE_RECONCILIATION_MISMATCH',
        data: { mismatches, tag },
      });
      this.logger.error('balance_reconcile.mismatch', { err });
      this.circuitBreaker.trip('balance_reconciliation_mismatch', { mismatches, tag });
      throw err;
    }

    this.logger.info('balance_reconcile.passed', { tag });
    return { expected, actual, tag };
  }
}

module.exports = {
  BalanceReconciler,
};

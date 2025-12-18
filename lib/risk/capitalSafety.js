'use strict';

const { SafetyCheckError } = require('./errors');

function normalizeBigInt(value) {
  if (typeof value === 'bigint') return value;
  if (value === null || value === undefined) return 0n;
  return BigInt(value);
}

function readBalance(balances, asset) {
  if (!balances) return 0n;
  if (balances instanceof Map) return normalizeBigInt(balances.get(asset) ?? 0n);
  return normalizeBigInt(balances[asset] ?? 0n);
}

class CapitalSafetyValidator {
  constructor({
    logger,
    minReserveByAsset = {},
    maxTradeFractionBps = 5000,
    maxTradeAmountByAsset = {},
    feeAsset = null,
    feeBuffer = 0n,
  } = {}) {
    if (!logger) throw new Error('CapitalSafetyValidator requires { logger }');

    this.logger = logger;
    this.minReserveByAsset = { ...minReserveByAsset };
    this.maxTradeFractionBps = maxTradeFractionBps;
    this.maxTradeAmountByAsset = { ...maxTradeAmountByAsset };
    this.feeAsset = feeAsset;
    this.feeBuffer = normalizeBigInt(feeBuffer);
  }

  validate({ balances, trade, estimatedFee = 0n } = {}) {
    if (!trade) throw new SafetyCheckError('Missing trade', { code: 'MISSING_TRADE' });

    const amountIn = normalizeBigInt(trade.amountIn);
    if (amountIn <= 0n) {
      throw new SafetyCheckError('Trade amount must be positive', {
        code: 'INVALID_TRADE_AMOUNT',
        data: { amountIn },
      });
    }

    const assetIn = trade.assetIn;
    if (!assetIn) {
      throw new SafetyCheckError('Trade missing assetIn', { code: 'MISSING_ASSET_IN' });
    }

    const balIn = readBalance(balances, assetIn);
    const reserveIn = normalizeBigInt(this.minReserveByAsset[assetIn] ?? 0n);
    const freeIn = balIn > reserveIn ? balIn - reserveIn : 0n;

    const capByFraction = this.maxTradeFractionBps > 0 ? (freeIn * BigInt(this.maxTradeFractionBps)) / 10000n : freeIn;
    const capByAbsolute = this.maxTradeAmountByAsset[assetIn] !== undefined ? normalizeBigInt(this.maxTradeAmountByAsset[assetIn]) : freeIn;
    const maxAllowedIn = capByFraction < capByAbsolute ? capByFraction : capByAbsolute;

    const feeAsset = trade.feeAsset || this.feeAsset;
    const fee = normalizeBigInt(estimatedFee);
    const feeTotal = fee + this.feeBuffer;

    if (amountIn > maxAllowedIn) {
      const err = new SafetyCheckError('Trade amount exceeds configured risk limits', {
        code: 'TRADE_AMOUNT_EXCEEDS_LIMITS',
        data: {
          assetIn,
          amountIn,
          balanceIn: balIn,
          reserveIn,
          freeIn,
          maxAllowedIn,
          capByFraction,
          capByAbsolute,
        },
      });
      this.logger.warn('capital_safety.violation', { err });
      throw err;
    }

    if (amountIn > freeIn) {
      const err = new SafetyCheckError('Insufficient free balance for trade', {
        code: 'INSUFFICIENT_FREE_BALANCE',
        data: { assetIn, amountIn, balanceIn: balIn, reserveIn, freeIn },
      });
      this.logger.warn('capital_safety.violation', { err });
      throw err;
    }

    if (feeAsset) {
      const feeBal = readBalance(balances, feeAsset);
      const reserveFee = normalizeBigInt(this.minReserveByAsset[feeAsset] ?? 0n);
      const freeFee = feeBal > reserveFee ? feeBal - reserveFee : 0n;

      if (feeTotal > freeFee) {
        const err = new SafetyCheckError('Insufficient fee balance (including buffer)', {
          code: 'INSUFFICIENT_FEE_BALANCE',
          data: { feeAsset, fee, feeBuffer: this.feeBuffer, feeTotal, feeBalance: feeBal, reserveFee, freeFee },
        });
        this.logger.warn('capital_safety.violation', { err });
        throw err;
      }
    }

    this.logger.info('capital_safety.passed', {
      tradeId: trade.id,
      assetIn,
      amountIn,
      balanceIn: balIn,
      reserveIn,
      freeIn,
      estimatedFee: fee,
      feeBuffer: this.feeBuffer,
      feeAsset,
    });

    return {
      assetIn,
      amountIn,
      balanceIn: balIn,
      reserveIn,
      freeIn,
      maxAllowedIn,
      feeAsset,
      estimatedFee: fee,
      feeTotal,
    };
  }
}

module.exports = {
  CapitalSafetyValidator,
};

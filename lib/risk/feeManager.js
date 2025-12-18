'use strict';

const { SafetyCheckError } = require('./errors');

function normalizeBigInt(value) {
  if (typeof value === 'bigint') return value;
  if (value === null || value === undefined) return 0n;
  return BigInt(value);
}

class FeeManager {
  constructor({
    logger,
    circuitBreaker,
    provider,
    feeAsset = null,
    maxFee = null,
  } = {}) {
    if (!logger) throw new Error('FeeManager requires { logger }');
    if (!circuitBreaker) throw new Error('FeeManager requires { circuitBreaker }');
    if (!provider || typeof provider.estimateFee !== 'function') {
      throw new Error('FeeManager requires { provider } with estimateFee()');
    }

    this.logger = logger;
    this.circuitBreaker = circuitBreaker;
    this.provider = provider;
    this.feeAsset = feeAsset;
    this.maxFee = maxFee === null ? null : normalizeBigInt(maxFee);
  }

  async estimate(txRequest) {
    const fee = normalizeBigInt(await this.provider.estimateFee(txRequest));
    this.logger.info('fees.estimated', { feeAsset: this.feeAsset, fee, txRequestMeta: txRequest?.meta });
    return fee;
  }

  assertWithinCap({ estimatedFee, maxFee } = {}) {
    const fee = normalizeBigInt(estimatedFee);
    const cap = maxFee !== undefined && maxFee !== null ? normalizeBigInt(maxFee) : this.maxFee;

    if (cap !== null && fee > cap) {
      const err = new SafetyCheckError('Estimated fee exceeds configured cap', {
        code: 'FEE_TOO_HIGH',
        data: { feeAsset: this.feeAsset, estimatedFee: fee, maxFee: cap },
      });
      this.logger.error('fees.cap_exceeded', { err });
      this.circuitBreaker.trip('fee_too_high', { feeAsset: this.feeAsset, estimatedFee: fee, maxFee: cap });
      throw err;
    }

    this.logger.info('fees.cap_ok', { feeAsset: this.feeAsset, estimatedFee: fee, maxFee: cap });
    return { fee, cap };
  }

  async estimateAndValidate({ txRequest, maxFee } = {}) {
    const fee = await this.estimate(txRequest);
    this.assertWithinCap({ estimatedFee: fee, maxFee });
    return fee;
  }
}

module.exports = {
  FeeManager,
};

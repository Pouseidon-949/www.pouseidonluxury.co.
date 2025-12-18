'use strict';

const { SafetyCheckError } = require('./errors');

function normalizeBigInt(value) {
  if (typeof value === 'bigint') return value;
  if (value === null || value === undefined) return 0n;
  return BigInt(value);
}

class RiskManager {
  constructor({
    logger,
    circuitBreaker,
    walletMonitor,
    feeManager,
    capitalSafetyValidator,
    slippageEnforcer,
    balanceReconciler,
  } = {}) {
    if (!logger) throw new Error('RiskManager requires { logger }');
    if (!circuitBreaker) throw new Error('RiskManager requires { circuitBreaker }');

    this.logger = logger;
    this.circuitBreaker = circuitBreaker;
    this.walletMonitor = walletMonitor;
    this.feeManager = feeManager;
    this.capitalSafetyValidator = capitalSafetyValidator;
    this.slippageEnforcer = slippageEnforcer;
    this.balanceReconciler = balanceReconciler;
  }

  async preTradeCheck({ trade, txRequests = [], expectedBalances } = {}) {
    if (!trade) throw new SafetyCheckError('Missing trade', { code: 'MISSING_TRADE' });

    this.circuitBreaker.ensureHealthy();
    this.logger.info('risk.pre_trade.start', { tradeId: trade.id, trade });

    let walletSnapshot = null;
    if (this.walletMonitor) {
      walletSnapshot = await this.walletMonitor.checkNow({ tag: `pre_trade:${trade.id || 'unknown'}` });
    }

    if (this.balanceReconciler && expectedBalances) {
      await this.balanceReconciler.reconcile({ expectedBalances, tag: `pre_trade:${trade.id || 'unknown'}` });
    }

    let estimatedFeeTotal = 0n;
    if (this.feeManager && Array.isArray(txRequests)) {
      for (const txRequest of txRequests) {
        const fee = await this.feeManager.estimateAndValidate({ txRequest, maxFee: txRequest?.maxFee });
        estimatedFeeTotal += normalizeBigInt(fee);
      }
    }

    let slippage = null;
    if (this.slippageEnforcer && trade.expectedAmountOut !== undefined) {
      slippage = this.slippageEnforcer.computeMinOut({
        expectedAmountOut: trade.expectedAmountOut,
        maxSlippageBps: trade.maxSlippageBps,
      });

      if (trade.quotedMinOut !== undefined) {
        this.slippageEnforcer.assertQuoteWithinLimits({
          expectedAmountOut: trade.expectedAmountOut,
          quotedMinOut: trade.quotedMinOut,
          maxSlippageBps: trade.maxSlippageBps,
        });
      }
    }

    let capital = null;
    if (this.capitalSafetyValidator) {
      const balances = walletSnapshot?.balances;
      capital = this.capitalSafetyValidator.validate({ balances, trade, estimatedFee: estimatedFeeTotal });
    }

    this.logger.info('risk.pre_trade.passed', {
      tradeId: trade.id,
      estimatedFeeTotal,
      slippage,
      capital,
    });

    return {
      trade,
      walletSnapshot,
      estimatedFeeTotal,
      slippage,
      capital,
    };
  }

  async postTradeCheck({ tradeId, expectedBalances } = {}) {
    this.circuitBreaker.ensureHealthy();
    this.logger.info('risk.post_trade.start', { tradeId });

    if (this.walletMonitor) {
      await this.walletMonitor.checkNow({ tag: `post_trade:${tradeId || 'unknown'}` });
    }

    if (this.balanceReconciler && expectedBalances) {
      await this.balanceReconciler.reconcile({ expectedBalances, tag: `post_trade:${tradeId || 'unknown'}` });
    }

    this.logger.info('risk.post_trade.passed', { tradeId });
  }
}

module.exports = {
  RiskManager,
};

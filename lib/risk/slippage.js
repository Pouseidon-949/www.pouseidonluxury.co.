'use strict';

const { SafetyCheckError } = require('./errors');

function normalizeBigInt(value) {
  if (typeof value === 'bigint') return value;
  if (value === null || value === undefined) return 0n;
  return BigInt(value);
}

function minOutFromExpected(expectedOut, maxSlippageBps) {
  const exp = normalizeBigInt(expectedOut);
  const bps = Math.max(0, Math.trunc(maxSlippageBps));
  const multiplier = BigInt(10000 - bps);
  return (exp * multiplier) / 10000n;
}

function slippageBps(expectedOut, actualOut) {
  const exp = normalizeBigInt(expectedOut);
  const act = normalizeBigInt(actualOut);
  if (exp <= 0n) return 0;
  if (act >= exp) return 0;
  return Number(((exp - act) * 10000n) / exp);
}

class SlippageEnforcer {
  constructor({ logger, defaultMaxSlippageBps = 50 } = {}) {
    if (!logger) throw new Error('SlippageEnforcer requires { logger }');
    this.logger = logger;
    this.defaultMaxSlippageBps = defaultMaxSlippageBps;
  }

  computeMinOut({ expectedAmountOut, maxSlippageBps } = {}) {
    const cap = maxSlippageBps ?? this.defaultMaxSlippageBps;
    const minOut = minOutFromExpected(expectedAmountOut, cap);
    this.logger.info('slippage.min_out_computed', { expectedAmountOut, maxSlippageBps: cap, minOut });
    return { minOut, maxSlippageBps: cap };
  }

  assertQuoteWithinLimits({ expectedAmountOut, quotedMinOut, maxSlippageBps } = {}) {
    const cap = maxSlippageBps ?? this.defaultMaxSlippageBps;
    const computedMinOut = minOutFromExpected(expectedAmountOut, cap);
    const minOut = normalizeBigInt(quotedMinOut);

    if (minOut < computedMinOut) {
      throw new SafetyCheckError('Quoted minOut implies slippage beyond configured threshold', {
        code: 'SLIPPAGE_QUOTE_TOO_LOW',
        data: { expectedAmountOut, computedMinOut, quotedMinOut: minOut, maxSlippageBps: cap },
      });
    }

    this.logger.info('slippage.quote_passed', { expectedAmountOut, quotedMinOut: minOut, computedMinOut, maxSlippageBps: cap });
  }

  assertExecutionWithinLimits({ expectedAmountOut, actualAmountOut, maxSlippageBps } = {}) {
    const cap = maxSlippageBps ?? this.defaultMaxSlippageBps;
    const minOut = minOutFromExpected(expectedAmountOut, cap);
    const actual = normalizeBigInt(actualAmountOut);

    if (actual < minOut) {
      const slip = slippageBps(expectedAmountOut, actual);
      throw new SafetyCheckError('Execution slippage exceeded threshold', {
        code: 'SLIPPAGE_EXCEEDED',
        data: { expectedAmountOut, actualAmountOut: actual, minOut, slippageBps: slip, maxSlippageBps: cap },
      });
    }

    this.logger.info('slippage.execution_passed', { expectedAmountOut, actualAmountOut: actual, minOut, maxSlippageBps: cap });
  }
}

module.exports = {
  SlippageEnforcer,
  minOutFromExpected,
  slippageBps,
};

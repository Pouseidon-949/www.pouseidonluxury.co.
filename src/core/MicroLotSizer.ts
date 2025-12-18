/**
 * Micro-Lot Sizing Based on Available Liquidity
 * Calculates optimal trade sizes based on market conditions and risk
 */

import {
  MicroLotCalculation,
  ArbitrageOpportunity,
  LiquidityInfo,
  CapitalState
} from '../types/index';
import { logger } from '../utils/logger';

export class MicroLotSizer {
  private readonly MIN_LOT_SIZE = 10; // Minimum trade size
  private readonly DEFAULT_RISK_PER_TRADE = 0.02; // 2% per trade
  private readonly LIQUIDITY_SAFETY_FACTOR = 0.5; // Use only 50% of available liquidity
  private readonly VOLATILITY_ADJUSTMENT_FACTOR = 0.8;

  /**
   * Calculate optimal micro-lot size for an opportunity
   */
  public calculateMicroLot(
    opportunity: ArbitrageOpportunity,
    liquidity: LiquidityInfo,
    availableCapital: number,
    volatility: number = 0
  ): MicroLotCalculation {
    const baseSize = this.calculateBaseSize(availableCapital, opportunity);
    const liquidityAdjustedSize = this.adjustForLiquidity(baseSize, liquidity);
    const volatilityAdjustedSize = this.adjustForVolatility(liquidityAdjustedSize, volatility);
    const finalSize = Math.max(this.MIN_LOT_SIZE, Math.floor(volatilityAdjustedSize));

    const calculation: MicroLotCalculation = {
      baseSize,
      adjustedSize: liquidityAdjustedSize,
      liquidity: liquidity.availableLiquidity,
      maxLotSize: this.getMaxLotSize(liquidity),
      riskAdjustment: this.VOLATILITY_ADJUSTMENT_FACTOR,
      finalSize
    };

    logger.debug('Micro-lot calculated', {
      opportunity: opportunity.id,
      baseSize,
      finalSize,
      liquidityAvailable: liquidity.availableLiquidity
    });

    return calculation;
  }

  /**
   * Calculate base size based on capital and risk
   */
  private calculateBaseSize(capital: number, opportunity: ArbitrageOpportunity): number {
    // Size should be proportional to profitability and risk
    let baseFraction = this.DEFAULT_RISK_PER_TRADE;

    // Increase size for high-confidence, high-profit opportunities
    if (opportunity.confidenceScore > 80) {
      baseFraction *= 1.5;
    } else if (opportunity.confidenceScore > 70) {
      baseFraction *= 1.2;
    }

    // Decrease size for high-risk opportunities
    if (opportunity.riskLevel === 'HIGH') {
      baseFraction *= 0.5;
    } else if (opportunity.riskLevel === 'MEDIUM') {
      baseFraction *= 0.75;
    }

    return capital * baseFraction;
  }

  /**
   * Adjust size based on available liquidity
   */
  private adjustForLiquidity(desiredSize: number, liquidity: LiquidityInfo): number {
    const maxSafeSize = liquidity.availableLiquidity * this.LIQUIDITY_SAFETY_FACTOR;
    return Math.min(desiredSize, maxSafeSize);
  }

  /**
   * Adjust size based on volatility
   */
  private adjustForVolatility(size: number, volatility: number): number {
    // Reduce size in high volatility environments
    if (volatility > 10) {
      return size * 0.5;
    } else if (volatility > 5) {
      return size * 0.75;
    }
    return size;
  }

  /**
   * Get maximum lot size for liquidity
   */
  private getMaxLotSize(liquidity: LiquidityInfo): number {
    return liquidity.availableLiquidity * this.LIQUIDITY_SAFETY_FACTOR;
  }

  /**
   * Calculate lot size for multiple consecutive trades (capital reuse)
   */
  public calculateConsecutiveLotSizes(
    opportunities: ArbitrageOpportunity[],
    initialCapital: number,
    liquidityMap: Map<string, LiquidityInfo>,
    expectedReturnRate: number = 0.001 // 0.1% per trade
  ): Map<string, number> {
    const lotSizes = new Map<string, number>();
    let accumulatedCapital = initialCapital;

    for (const opportunity of opportunities) {
      const liquidity = liquidityMap.get(opportunity.pair);
      if (!liquidity) continue;

      const calculation = this.calculateMicroLot(opportunity, liquidity, accumulatedCapital);
      lotSizes.set(opportunity.id, calculation.finalSize);

      // Simulate capital growth from this trade
      const estimatedProfit = calculation.finalSize * (opportunity.percentageProfit / 100);
      accumulatedCapital += estimatedProfit;

      logger.debug('Consecutive lot calculated', {
        opportunityId: opportunity.id,
        lotSize: calculation.finalSize,
        accumulatedCapital
      });
    }

    return lotSizes;
  }

  /**
   * Calculate capital reuse for loop iterations
   */
  public calculateCapitalReuse(
    capitalState: CapitalState,
    previousLoopProfit: number,
    successRate: number
  ): number {
    // Reusable capital = allocated capital + profits
    const reusableFromPrevious = Math.max(0, previousLoopProfit) * successRate;
    const totalReusable = capitalState.reusableCapital + reusableFromPrevious;

    logger.debug('Capital reuse calculated', {
      previousProfit: previousLoopProfit,
      successRate,
      totalReusable
    });

    return totalReusable;
  }

  /**
   * Calculate position sizing for risk management
   */
  public calculateRiskAdjustedSize(
    desiredSize: number,
    stopLossPercent: number,
    maxRiskAmount: number
  ): number {
    // Size = Max Risk / Stop Loss %
    const riskBasedSize = maxRiskAmount / (stopLossPercent / 100);
    return Math.min(desiredSize, riskBasedSize);
  }

  /**
   * Scale lot sizes based on portfolio pressure
   */
  public scaleLotSizesByPressure(
    originalSize: number,
    activePositions: number,
    maxConcurrentPositions: number = 5
  ): number {
    // Reduce size as we approach max positions
    const pressureRatio = activePositions / maxConcurrentPositions;
    const scaleFactor = Math.max(0.2, 1 - pressureRatio);
    return originalSize * scaleFactor;
  }

  /**
   * Calculate Kelly Criterion fraction for optimal sizing
   */
  public calculateKellyCriterion(
    winRate: number, // Probability of winning
    avgWin: number, // Average win amount
    avgLoss: number // Average loss amount
  ): number {
    if (avgLoss <= 0) return 0;

    const winProb = winRate;
    const lossProb = 1 - winRate;

    // Kelly % = (bp - q) / b
    // where b = ratio of win to loss, p = win probability, q = loss probability
    const b = avgWin / avgLoss;
    const p = winProb;
    const q = lossProb;

    const kelly = (b * p - q) / b;
    return Math.max(0, Math.min(0.25, kelly)); // Cap at 25% to be conservative
  }

  /**
   * Get recommended lot size brackets
   */
  public getLotSizeBrackets(liquidity: LiquidityInfo): {
    verySmall: number;
    small: number;
    medium: number;
    large: number;
    veryLarge: number;
  } {
    const safeMax = liquidity.availableLiquidity * this.LIQUIDITY_SAFETY_FACTOR;
    return {
      verySmall: safeMax * 0.05,
      small: safeMax * 0.1,
      medium: safeMax * 0.25,
      large: safeMax * 0.5,
      veryLarge: safeMax
    };
  }

  /**
   * Validate lot size against constraints
   */
  public validateLotSize(
    lotSize: number,
    liquidity: LiquidityInfo,
    minSize: number = this.MIN_LOT_SIZE
  ): { valid: boolean; reason?: string } {
    if (lotSize < minSize) {
      return { valid: false, reason: `Size ${lotSize} below minimum ${minSize}` };
    }

    const maxSafe = liquidity.availableLiquidity * this.LIQUIDITY_SAFETY_FACTOR;
    if (lotSize > maxSafe) {
      return { valid: false, reason: `Size ${lotSize} exceeds safe max ${maxSafe}` };
    }

    return { valid: true };
  }

  /**
   * Get average lot size across multiple opportunities
   */
  public getAverageLotSize(lotSizes: Map<string, number>): number {
    if (lotSizes.size === 0) return 0;
    const total = Array.from(lotSizes.values()).reduce((sum, size) => sum + size, 0);
    return total / lotSizes.size;
  }

  /**
   * Get total exposure from lot sizes
   */
  public getTotalExposure(lotSizes: Map<string, number>): number {
    return Array.from(lotSizes.values()).reduce((sum, size) => sum + size, 0);
  }
}

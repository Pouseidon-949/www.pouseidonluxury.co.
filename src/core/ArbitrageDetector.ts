/**
 * Arbitrage Opportunity Detection and Scoring
 * Identifies and evaluates arbitrage opportunities in real-time
 */

import {
  ArbitrageOpportunity,
  ArbitrageType,
  LiquidityInfo,
  RankedOpportunity,
  RankingCriteria
} from '../types/index';
import { LiquidityAnalyzer } from './LiquidityAnalyzer';
import { logger } from '../utils/logger';

export class ArbitrageDetector {
  private liquidityAnalyzer: LiquidityAnalyzer;
  private opportunityCache: Map<string, ArbitrageOpportunity> = new Map();
  private readonly MIN_PROFIT_THRESHOLD = 0.05; // 0.05% minimum profit
  private readonly MAX_EXECUTION_TIME = 10000; // 10 seconds

  constructor(liquidityAnalyzer: LiquidityAnalyzer) {
    this.liquidityAnalyzer = liquidityAnalyzer;
  }

  /**
   * Detect spatial arbitrage opportunities
   * Compares prices across multiple liquidity points
   */
  public detectSpatialArbitrage(
    pair: string,
    liquidityPoints: LiquidityInfo[]
  ): ArbitrageOpportunity[] {
    const opportunities: ArbitrageOpportunity[] = [];

    if (liquidityPoints.length < 2) {
      return opportunities;
    }

    for (let i = 0; i < liquidityPoints.length - 1; i++) {
      for (let j = i + 1; j < liquidityPoints.length; j++) {
        const pointA = liquidityPoints[i];
        const pointB = liquidityPoints[j];

        // Check buy at A, sell at B
        const opportunityAB = this.createArbitrageOpportunity(
          pair,
          pointA,
          pointB,
          ArbitrageType.SPATIAL,
          `spatial_${pair}_${i}_${j}`
        );

        if (opportunityAB && opportunityAB.percentageProfit >= this.MIN_PROFIT_THRESHOLD) {
          opportunities.push(opportunityAB);
        }

        // Check buy at B, sell at A
        const opportunityBA = this.createArbitrageOpportunity(
          pair,
          pointB,
          pointA,
          ArbitrageType.SPATIAL,
          `spatial_${pair}_${j}_${i}`
        );

        if (opportunityBA && opportunityBA.percentageProfit >= this.MIN_PROFIT_THRESHOLD) {
          opportunities.push(opportunityBA);
        }
      }
    }

    logger.debug(`Spatial arbitrage opportunities detected: ${opportunities.length}`, { pair });
    return opportunities;
  }

  /**
   * Detect triangular arbitrage opportunities
   * A -> B -> C -> A price paths
   */
  public detectTriangularArbitrage(
    basePair: string,
    liquidityMap: Map<string, LiquidityInfo>
  ): ArbitrageOpportunity[] {
    const opportunities: ArbitrageOpportunity[] = [];
    const pairs = Array.from(liquidityMap.keys());

    // For each combination of 3 pairs
    for (let i = 0; i < Math.min(pairs.length, 5); i++) {
      for (let j = i + 1; j < Math.min(pairs.length, 5); j++) {
        const pairA = pairs[i];
        const pairB = pairs[j];
        const liquidityA = liquidityMap.get(pairA);
        const liquidityB = liquidityMap.get(pairB);

        if (!liquidityA || !liquidityB) continue;

        // Calculate triangular path return
        const pathReturn = this.calculateTriangularReturn(
          liquidityA.bidPrice,
          liquidityB.askPrice,
          liquidityA.askPrice
        );

        if (pathReturn > this.MIN_PROFIT_THRESHOLD) {
          const opportunity: ArbitrageOpportunity = {
            id: `triangular_${pairA}_${pairB}`,
            type: ArbitrageType.TRIANGULAR,
            pair: `${pairA}-${pairB}`,
            sourcePrice: liquidityA.bidPrice,
            targetPrice: liquidityB.askPrice,
            priceDifference: liquidityB.askPrice - liquidityA.bidPrice,
            percentageProfit: pathReturn,
            confidenceScore: this.calculateConfidenceScore(liquidityA, liquidityB),
            timestamp: Date.now(),
            estimatedSlippage: this.liquidityAnalyzer.estimateSlippage(pairA, 1000).slippagePercentage,
            potentialProfit: 0, // Will be calculated with position size
            riskLevel: this.assessRiskLevel(pathReturn),
            estimatedExecutionTime: this.estimateTriangularExecutionTime(liquidityA, liquidityB)
          };

          opportunities.push(opportunity);
        }
      }
    }

    logger.debug(`Triangular arbitrage opportunities detected: ${opportunities.length}`);
    return opportunities;
  }

  /**
   * Detect temporal arbitrage opportunities
   * Price changes over time on same pair
   */
  public detectTemporalArbitrage(
    pair: string,
    currentLiquidity: LiquidityInfo,
    previousLiquidity?: LiquidityInfo
  ): ArbitrageOpportunity | null {
    if (!previousLiquidity) {
      return null;
    }

    const priceDifference = currentLiquidity.bidPrice - previousLiquidity.askPrice;
    const percentageProfit = (priceDifference / previousLiquidity.askPrice) * 100;

    if (Math.abs(percentageProfit) < this.MIN_PROFIT_THRESHOLD) {
      return null;
    }

    const opportunity: ArbitrageOpportunity = {
      id: `temporal_${pair}_${Date.now()}`,
      type: ArbitrageType.TEMPORAL,
      pair,
      sourcePrice: previousLiquidity.askPrice,
      targetPrice: currentLiquidity.bidPrice,
      priceDifference,
      percentageProfit: Math.abs(percentageProfit),
      confidenceScore: this.calculateTemporalConfidence(currentLiquidity, previousLiquidity),
      timestamp: Date.now(),
      estimatedSlippage: this.liquidityAnalyzer.estimateSlippage(pair, 1000).slippagePercentage,
      potentialProfit: 0,
      riskLevel: this.assessRiskLevel(percentageProfit),
      estimatedExecutionTime: 500 // Temporal arbitrage is fast
    };

    logger.debug(`Temporal arbitrage detected for ${pair}`, { percentageProfit });
    return opportunity;
  }

  /**
   * Create an arbitrage opportunity from two liquidity points
   */
  private createArbitrageOpportunity(
    pair: string,
    buyPoint: LiquidityInfo,
    sellPoint: LiquidityInfo,
    type: ArbitrageType,
    id: string
  ): ArbitrageOpportunity | null {
    const buyPrice = buyPoint.askPrice; // We buy at ask
    const sellPrice = sellPoint.bidPrice; // We sell at bid
    const priceDifference = sellPrice - buyPrice;
    const percentageProfit = (priceDifference / buyPrice) * 100;

    if (percentageProfit < this.MIN_PROFIT_THRESHOLD) {
      return null;
    }

    const slippageEstimate = this.liquidityAnalyzer.estimateSlippage(pair, 1000);

    const opportunity: ArbitrageOpportunity = {
      id,
      type,
      pair,
      sourcePrice: buyPrice,
      targetPrice: sellPrice,
      priceDifference,
      percentageProfit,
      confidenceScore: this.calculateConfidenceScore(buyPoint, sellPoint),
      timestamp: Date.now(),
      estimatedSlippage: slippageEstimate.slippagePercentage,
      potentialProfit: 0,
      riskLevel: this.assessRiskLevel(percentageProfit),
      estimatedExecutionTime: Math.max(
        slippageEstimate.timeToExecute,
        buyPoint.timestamp && sellPoint.timestamp
          ? Math.abs(sellPoint.timestamp - buyPoint.timestamp)
          : 1000
      )
    };

    return opportunity;
  }

  /**
   * Calculate confidence score based on liquidity and spread
   */
  private calculateConfidenceScore(
    sourcePoint: LiquidityInfo,
    targetPoint: LiquidityInfo
  ): number {
    let score = 50; // Base score

    // Increase confidence with high liquidity
    const avgLiquidity = (
      (sourcePoint.availableLiquidity || 0) +
      (targetPoint.availableLiquidity || 0)
    ) / 2;
    if (avgLiquidity > 100000) score += 20;
    else if (avgLiquidity > 50000) score += 15;
    else if (avgLiquidity > 10000) score += 10;

    // Decrease confidence with wide spreads
    const spreadA = sourcePoint.askPrice - sourcePoint.bidPrice;
    const spreadB = targetPoint.askPrice - targetPoint.bidPrice;
    const avgSpread = (spreadA + spreadB) / 2;
    const midPrice = (sourcePoint.askPrice + targetPoint.bidPrice) / 2;
    const spreadPercent = (avgSpread / midPrice) * 100;

    if (spreadPercent < 0.1) score += 15;
    else if (spreadPercent < 0.5) score += 10;
    else if (spreadPercent < 1) score += 5;
    else score -= 10;

    // Cap between 0 and 100
    return Math.max(0, Math.min(100, score));
  }

  /**
   * Calculate temporal arbitrage confidence
   */
  private calculateTemporalConfidence(
    current: LiquidityInfo,
    previous: LiquidityInfo
  ): number {
    let score = 40;

    const timeDelta = current.timestamp - previous.timestamp;
    if (timeDelta < 1000) score += 20; // Very recent
    else if (timeDelta < 5000) score += 15;
    else if (timeDelta < 10000) score += 10;
    else score -= 10;

    const liquidityRatio = current.availableLiquidity / (previous.availableLiquidity || 1);
    if (liquidityRatio > 0.8 && liquidityRatio < 1.2) score += 15; // Stable liquidity
    else if (liquidityRatio > 0.5 && liquidityRatio < 2) score += 10;

    return Math.max(0, Math.min(100, score));
  }

  /**
   * Calculate triangular arbitrage return
   */
  private calculateTriangularReturn(
    rate1: number,
    rate2: number,
    rate3: number
  ): number {
    const finalAmount = 100 * (rate2 / rate1) * (1 / rate3); // Adjusted rates
    return ((finalAmount - 100) / 100) * 100;
  }

  /**
   * Estimate execution time for triangular arbitrage
   */
  private estimateTriangularExecutionTime(
    liquidity1: LiquidityInfo,
    liquidity2: LiquidityInfo
  ): number {
    const slippage1 = this.liquidityAnalyzer.estimateSlippage('pair1', 1000);
    const slippage2 = this.liquidityAnalyzer.estimateSlippage('pair2', 1000);
    return slippage1.timeToExecute + slippage2.timeToExecute + 500; // Add 500ms for overhead
  }

  /**
   * Assess risk level based on profit percentage
   */
  private assessRiskLevel(profitPercent: number): 'LOW' | 'MEDIUM' | 'HIGH' {
    const absProfit = Math.abs(profitPercent);
    if (absProfit > 2) return 'HIGH';
    if (absProfit > 0.5) return 'MEDIUM';
    return 'LOW';
  }

  /**
   * Rank opportunities by multiple criteria
   */
  public rankOpportunities(opportunities: ArbitrageOpportunity[]): RankedOpportunity[] {
    const ranked = opportunities.map((opp, index) => {
      const criteria = this.calculateRankingCriteria(opp);
      const rankingScore = this.calculateRankingScore(criteria);

      return {
        ...opp,
        ranking: index + 1,
        rankingScore,
        criteria
      };
    });

    // Sort by ranking score descending
    ranked.sort((a, b) => b.rankingScore - a.rankingScore);

    // Update rankings
    ranked.forEach((opp, index) => {
      opp.ranking = index + 1;
    });

    return ranked;
  }

  /**
   * Calculate ranking criteria for an opportunity
   */
  private calculateRankingCriteria(opp: ArbitrageOpportunity): RankingCriteria {
    const profitability = Math.min(100, opp.percentageProfit * 20);
    const riskAdjustedReturn = profitability / (opp.riskLevel === 'LOW' ? 1 : opp.riskLevel === 'MEDIUM' ? 1.5 : 2);
    const liquidity = Math.min(100, (opp.microLotSize || 100) / 1000 * 100);
    const executionSpeed = Math.max(0, 100 - (opp.estimatedExecutionTime / 100));
    const capitalEfficiency = Math.min(100, ((opp.potentialProfit || 0) / (opp.capitalRequired || 1)) * 100);

    return {
      profitability,
      riskAdjustedReturn,
      liquidity,
      executionSpeed,
      capitalEfficiency
    };
  }

  /**
   * Calculate overall ranking score
   */
  private calculateRankingScore(criteria: RankingCriteria): number {
    const weights = {
      profitability: 0.35,
      riskAdjustedReturn: 0.25,
      liquidity: 0.2,
      executionSpeed: 0.1,
      capitalEfficiency: 0.1
    };

    return (
      criteria.profitability * weights.profitability +
      criteria.riskAdjustedReturn * weights.riskAdjustedReturn +
      criteria.liquidity * weights.liquidity +
      criteria.executionSpeed * weights.executionSpeed +
      criteria.capitalEfficiency * weights.capitalEfficiency
    );
  }

  /**
   * Filter opportunities by confidence threshold
   */
  public filterByConfidence(opportunities: ArbitrageOpportunity[], minConfidence: number = 60): ArbitrageOpportunity[] {
    return opportunities.filter(opp => opp.confidenceScore >= minConfidence);
  }

  /**
   * Filter opportunities by profitability
   */
  public filterByProfitability(opportunities: ArbitrageOpportunity[], minProfit: number): ArbitrageOpportunity[] {
    return opportunities.filter(opp => opp.percentageProfit >= minProfit);
  }

  /**
   * Filter opportunities by execution time
   */
  public filterByExecutionTime(opportunities: ArbitrageOpportunity[], maxTime: number): ArbitrageOpportunity[] {
    return opportunities.filter(opp => opp.estimatedExecutionTime <= maxTime);
  }

  /**
   * Get top opportunities
   */
  public getTopOpportunities(opportunities: ArbitrageOpportunity[], limit: number = 5): RankedOpportunity[] {
    return this.rankOpportunities(opportunities).slice(0, limit);
  }
}

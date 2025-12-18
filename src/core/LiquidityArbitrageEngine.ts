/**
 * Main Liquidity & Arbitrage Engine
 * Orchestrates real-time liquidity monitoring, arbitrage detection, and execution
 */

import {
  LiquidityInfo,
  ArbitrageOpportunity,
  RankedOpportunity,
  CapitalState,
  LoopState,
  TradeResult,
  OrderSide
} from '../types/index';
import { LiquidityAnalyzer } from './LiquidityAnalyzer';
import { ArbitrageDetector } from './ArbitrageDetector';
import { MicroLotSizer } from './MicroLotSizer';
import { CapitalManager } from './CapitalManager';
import { logger } from '../utils/logger';

export class LiquidityArbitrageEngine {
  private liquidityAnalyzer: LiquidityAnalyzer;
  private arbitrageDetector: ArbitrageDetector;
  private microLotSizer: MicroLotSizer;
  private capitalManager: CapitalManager;
  
  private isRunning: boolean = false;
  private liquidityMap: Map<string, LiquidityInfo> = new Map();
  private previousLiquidityMap: Map<string, LiquidityInfo> = new Map();
  private currentLoop: LoopState | null = null;
  private loopIntervalMs: number = 1000; // 1 second between loops

  constructor(initialCapital: number = 10000) {
    this.liquidityAnalyzer = new LiquidityAnalyzer();
    this.arbitrageDetector = new ArbitrageDetector(this.liquidityAnalyzer);
    this.microLotSizer = new MicroLotSizer();
    this.capitalManager = new CapitalManager();
    
    this.capitalManager.initializeCapital(initialCapital);
    logger.info('LiquidityArbitrageEngine initialized', { initialCapital });
  }

  /**
   * Update liquidity information for a pair
   */
  public updateLiquidity(liquidityInfo: LiquidityInfo): void {
    // Store previous liquidity
    const existing = this.liquidityMap.get(liquidityInfo.pair);
    if (existing) {
      this.previousLiquidityMap.set(liquidityInfo.pair, existing);
    }

    // Update current liquidity
    this.liquidityMap.set(liquidityInfo.pair, liquidityInfo);
    this.liquidityAnalyzer.analyzeLiquidity(liquidityInfo);

    logger.debug(`Liquidity updated for ${liquidityInfo.pair}`, {
      bid: liquidityInfo.bidPrice,
      ask: liquidityInfo.askPrice,
      spread: (liquidityInfo.askPrice - liquidityInfo.bidPrice).toFixed(6)
    });
  }

  /**
   * Detect all types of arbitrage opportunities
   */
  public detectOpportunities(): ArbitrageOpportunity[] {
    const opportunities: ArbitrageOpportunity[] = [];

    // Detect spatial arbitrage
    const spatialOpps = this.detectSpatialArbitrageOpportunities();
    opportunities.push(...spatialOpps);

    // Detect temporal arbitrage
    const temporalOpps = this.detectTemporalArbitrageOpportunities();
    opportunities.push(...temporalOpps);

    // Detect triangular arbitrage
    const triangularOpps = this.arbitrageDetector.detectTriangularArbitrage(
      'USDT',
      this.liquidityMap
    );
    opportunities.push(...triangularOpps);

    logger.info('Arbitrage detection complete', {
      total: opportunities.length,
      spatial: spatialOpps.length,
      temporal: temporalOpps.length,
      triangular: triangularOpps.length
    });

    return opportunities;
  }

  /**
   * Detect spatial arbitrage from available liquidity points
   */
  private detectSpatialArbitrageOpportunities(): ArbitrageOpportunity[] {
    const opportunities: ArbitrageOpportunity[] = [];
    const pairs = Array.from(this.liquidityMap.keys());

    // Create liquidity points for spatial detection
    const liquidityPoints = pairs.map(pair => this.liquidityMap.get(pair)!);

    pairs.forEach(pair => {
      const pointA = this.liquidityMap.get(pair);
      if (!pointA) return;

      const opps = this.arbitrageDetector.detectSpatialArbitrage(pair, liquidityPoints);
      opportunities.push(...opps);
    });

    return opportunities;
  }

  /**
   * Detect temporal arbitrage from price changes
   */
  private detectTemporalArbitrageOpportunities(): ArbitrageOpportunity[] {
    const opportunities: ArbitrageOpportunity[] = [];

    this.liquidityMap.forEach((current, pair) => {
      const previous = this.previousLiquidityMap.get(pair);
      const opp = this.arbitrageDetector.detectTemporalArbitrage(pair, current, previous);
      if (opp) {
        opportunities.push(opp);
      }
    });

    return opportunities;
  }

  /**
   * Analyze and rank opportunities
   */
  public analyzeAndRankOpportunities(
    opportunities: ArbitrageOpportunity[],
    minConfidence: number = 60
  ): RankedOpportunity[] {
    // Filter by confidence
    const filtered = this.arbitrageDetector.filterByConfidence(
      opportunities,
      minConfidence
    );

    // Add liquidity and capital info to opportunities
    const enriched = filtered.map(opp => {
      const liquidity = this.liquidityMap.get(opp.pair);
      if (liquidity) {
        const currentCapital = this.capitalManager.getCurrentState();
        if (currentCapital) {
          const calculation = this.microLotSizer.calculateMicroLot(
            opp,
            liquidity,
            currentCapital.availableCapital
          );
          opp.microLotSize = calculation.finalSize;
          opp.capitalRequired = calculation.finalSize;
          opp.potentialProfit = calculation.finalSize * (opp.percentageProfit / 100);
        }
      }
      return opp;
    });

    // Rank opportunities
    const ranked = this.arbitrageDetector.rankOpportunities(enriched);

    logger.info('Opportunities ranked', {
      total: ranked.length,
      topScore: ranked.length > 0 ? ranked[0].rankingScore.toFixed(2) : 0
    });

    return ranked;
  }

  /**
   * Execute a trading loop
   */
  public async executeLoop(opportunities: RankedOpportunity[]): Promise<LoopState> {
    const loopId = `loop_${Date.now()}`;
    const capitalBefore = this.capitalManager.getCurrentState();

    if (!capitalBefore) {
      throw new Error('No capital state initialized');
    }

    logger.info('Starting trading loop', { loopId, opportunities: opportunities.length });

    const tradeResults: TradeResult[] = [];
    const executedOpportunities: ArbitrageOpportunity[] = [];

    // Execute top opportunities
    for (let i = 0; i < Math.min(opportunities.length, 5); i++) {
      const opp = opportunities[i];
      const liquidity = this.liquidityMap.get(opp.pair);

      if (!liquidity) {
        logger.warn(`No liquidity data for ${opp.pair}`);
        continue;
      }

      // Check capital availability
      if (!this.capitalManager.isSufficientCapital(capitalBefore, opp.capitalRequired || 0)) {
        logger.warn('Insufficient capital for opportunity', {
          opportunity: opp.id,
          required: opp.capitalRequired,
          available: capitalBefore.availableCapital
        });
        continue;
      }

      // Execute trade
      const result = await this.executeTrade(opp, liquidity);
      tradeResults.push(result);

      if (result.success) {
        executedOpportunities.push(opp);
      }
    }

    // Record loop completion
    this.currentLoop = this.capitalManager.recordLoopCompletion(
      loopId,
      capitalBefore,
      tradeResults
    );

    this.currentLoop.opportunities = executedOpportunities;

    logger.info('Loop completed', {
      loopId,
      executed: tradeResults.length,
      successful: tradeResults.filter(r => r.success).length
    });

    return this.currentLoop;
  }

  /**
   * Execute a single trade
   */
  private async executeTrade(
    opportunity: ArbitrageOpportunity,
    liquidity: LiquidityInfo
  ): Promise<TradeResult> {
    try {
      const lotSize = opportunity.microLotSize || 100;
      
      // Estimate execution
      const estimatedPrice = opportunity.sourcePrice;
      const estimatedAmount = lotSize;

      // Simulate execution (in real implementation, this would connect to exchange)
      const result: TradeResult = {
        success: true,
        orderId: `order_${opportunity.id}_${Date.now()}`,
        executedAmount: estimatedAmount,
        executedPrice: estimatedPrice,
        timestamp: Date.now()
      };

      logger.debug('Trade executed', {
        opportunityId: opportunity.id,
        amount: estimatedAmount,
        price: estimatedPrice
      });

      return result;
    } catch (error) {
      logger.error('Trade execution failed', {
        opportunityId: opportunity.id,
        error: error instanceof Error ? error.message : String(error)
      });

      return {
        success: false,
        orderId: '',
        executedAmount: 0,
        executedPrice: 0,
        error: error instanceof Error ? error.message : String(error),
        timestamp: Date.now()
      };
    }
  }

  /**
   * Start continuous monitoring and execution
   */
  public startContinuous(
    liquidityUpdateFn: () => Promise<LiquidityInfo[]>,
    minConfidence: number = 60,
    intervalMs: number = 1000
  ): void {
    if (this.isRunning) {
      logger.warn('Engine already running');
      return;
    }

    this.isRunning = true;
    this.loopIntervalMs = intervalMs;
    logger.info('Continuous monitoring started', { intervalMs });

    const loop = async () => {
      if (!this.isRunning) return;

      try {
        // Update liquidity
        const liquidities = await liquidityUpdateFn();
        liquidities.forEach(liq => this.updateLiquidity(liq));

        // Detect and analyze opportunities
        const opportunities = this.detectOpportunities();
        const ranked = this.analyzeAndRankOpportunities(opportunities, minConfidence);

        // Execute if opportunities exist
        if (ranked.length > 0) {
          await this.executeLoop(ranked);
        }
      } catch (error) {
        logger.error('Loop error', {
          error: error instanceof Error ? error.message : String(error)
        });
      }

      // Schedule next loop
      setTimeout(loop, this.loopIntervalMs);
    };

    loop();
  }

  /**
   * Stop continuous monitoring
   */
  public stopContinuous(): void {
    this.isRunning = false;
    logger.info('Continuous monitoring stopped');
  }

  /**
   * Get engine status
   */
  public getStatus() {
    const capitalState = this.capitalManager.getCurrentState();
    const stats = this.capitalManager.getCapitalGrowthStats();

    return {
      isRunning: this.isRunning,
      capitalState,
      stats,
      liquidityPairs: this.liquidityMap.size,
      lastLoop: this.currentLoop
    };
  }

  /**
   * Get opportunity statistics
   */
  public getOpportunityStats() {
    const opportunities = this.detectOpportunities();
    const ranked = this.analyzeAndRankOpportunities(opportunities);

    return {
      totalDetected: opportunities.length,
      highConfidence: opportunities.filter(o => o.confidenceScore > 80).length,
      topOpportunity: ranked.length > 0 ? ranked[0] : null,
      averageProfitability: opportunities.length > 0
        ? opportunities.reduce((sum, o) => sum + o.percentageProfit, 0) / opportunities.length
        : 0
    };
  }

  /**
   * Get liquidity statistics
   */
  public getLiquidityStats() {
    const pairs = Array.from(this.liquidityMap.keys());
    const metrics = pairs.map(pair => this.liquidityAnalyzer.getLiquidityMetrics(pair)).filter(Boolean) as any[];

    return {
      totalPairs: pairs.length,
      averageSpread: metrics.length > 0
        ? metrics.reduce((sum, m) => sum + m.spreadPercentage, 0) / metrics.length
        : 0,
      averageVolatility: metrics.length > 0
        ? metrics.reduce((sum, m) => sum + m.volatility, 0) / metrics.length
        : 0,
      pairs
    };
  }

  /**
   * Reset engine state
   */
  public reset(): void {
    this.isRunning = false;
    this.liquidityMap.clear();
    this.previousLiquidityMap.clear();
    this.currentLoop = null;
    this.liquidityAnalyzer.clearAllCaches();
    this.capitalManager.reset();
    logger.info('Engine reset');
  }
}

/**
 * Real-time Liquidity Analysis and Monitoring
 * Provides comprehensive liquidity metrics for USDT pairs
 */

import { LiquidityInfo, LiquidityMetrics, MarketMetrics, SlippageEstimate } from '../types/index';
import { logger } from '../utils/logger';

export class LiquidityAnalyzer {
  private liquidityCache: Map<string, LiquidityInfo> = new Map();
  private metricsHistory: Map<string, LiquidityMetrics[]> = new Map();
  private marketMetricsCache: Map<string, MarketMetrics> = new Map();
  private readonly MAX_CACHE_SIZE = 1000;
  private readonly CACHE_TTL = 5000; // 5 seconds

  /**
   * Analyze real-time liquidity for a pair
   */
  public analyzeLiquidity(liquidityInfo: LiquidityInfo): LiquidityMetrics {
    const metrics: LiquidityMetrics = {
      pair: liquidityInfo.pair,
      totalLiquidity: this.calculateTotalLiquidity(liquidityInfo),
      spreadPercentage: this.calculateSpreadPercentage(liquidityInfo),
      priceImpact: this.calculatePriceImpact(liquidityInfo),
      volatility: this.calculateVolatility(liquidityInfo.pair),
      timestamp: liquidityInfo.timestamp,
      liquidity24h: this.estimate24hLiquidity(liquidityInfo),
      averagePrice: (liquidityInfo.bidPrice + liquidityInfo.askPrice) / 2,
      medianPrice: (liquidityInfo.bidPrice + liquidityInfo.askPrice) / 2
    };

    this.storeMetrics(liquidityInfo.pair, metrics);
    this.liquidityCache.set(liquidityInfo.pair, liquidityInfo);

    logger.debug(`Liquidity analyzed for ${liquidityInfo.pair}`, {
      totalLiquidity: metrics.totalLiquidity,
      spreadPercentage: metrics.spreadPercentage,
      volatility: metrics.volatility
    });

    return metrics;
  }

  /**
   * Calculate total available liquidity
   */
  private calculateTotalLiquidity(liquidityInfo: LiquidityInfo): number {
    let total = liquidityInfo.availableLiquidity;

    if (liquidityInfo.depth) {
      const bidTotal = liquidityInfo.depth.bids.reduce((sum, [, volume]) => sum + volume, 0);
      const askTotal = liquidityInfo.depth.asks.reduce((sum, [, volume]) => sum + volume, 0);
      total = bidTotal + askTotal;
    }

    return total;
  }

  /**
   * Calculate bid-ask spread as percentage
   */
  private calculateSpreadPercentage(liquidityInfo: LiquidityInfo): number {
    const midPrice = (liquidityInfo.bidPrice + liquidityInfo.askPrice) / 2;
    const spread = liquidityInfo.askPrice - liquidityInfo.bidPrice;
    return midPrice > 0 ? (spread / midPrice) * 100 : 0;
  }

  /**
   * Calculate price impact for different order sizes
   */
  private calculatePriceImpact(liquidityInfo: LiquidityInfo): Map<number, number> {
    const impacts = new Map<number, number>();
    const orderSizes = [100, 500, 1000, 5000, 10000];

    orderSizes.forEach(size => {
      let impact = 0;

      if (liquidityInfo.depth) {
        let remainingSize = size;
        let impactPrice = liquidityInfo.askPrice;

        for (const [price, volume] of liquidityInfo.depth.asks) {
          if (remainingSize <= 0) break;
          const execution = Math.min(volume, remainingSize);
          impactPrice = price;
          remainingSize -= execution;
        }

        impact = ((impactPrice - liquidityInfo.askPrice) / liquidityInfo.askPrice) * 100;
      } else {
        // Estimate impact based on spread and volume
        const impactMultiplier = (size / (liquidityInfo.availableLiquidity || 1000)) * 0.1;
        impact = (liquidityInfo.askPrice - liquidityInfo.bidPrice) / liquidityInfo.askPrice * 100 * impactMultiplier;
      }

      impacts.set(size, Math.max(0, impact));
    });

    return impacts;
  }

  /**
   * Calculate volatility based on historical metrics
   */
  private calculateVolatility(pair: string): number {
    const history = this.metricsHistory.get(pair) || [];
    
    if (history.length < 2) return 0;

    const prices = history.map(m => m.averagePrice);
    const meanPrice = prices.reduce((a, b) => a + b, 0) / prices.length;
    const variance = prices.reduce((sum, price) => sum + Math.pow(price - meanPrice, 2), 0) / prices.length;
    const stdDev = Math.sqrt(variance);
    
    return (stdDev / meanPrice) * 100;
  }

  /**
   * Estimate 24-hour liquidity volume
   */
  private estimate24hLiquidity(liquidityInfo: LiquidityInfo): number {
    // This would typically be fetched from actual market data
    // For now, we estimate based on current liquidity
    const hourlyTurnover = liquidityInfo.availableLiquidity * 0.5; // Assume 50% hourly turnover
    return hourlyTurnover * 24;
  }

  /**
   * Estimate slippage for a given order size
   */
  public estimateSlippage(pair: string, orderSize: number, isBuy: boolean = true): SlippageEstimate {
    const liquidityInfo = this.liquidityCache.get(pair);
    
    if (!liquidityInfo) {
      return {
        orderSize,
        estimatedSlippage: 0,
        slippagePercentage: 0,
        impactedPrice: 0,
        timeToExecute: 1000
      };
    }

    const referencePrice = isBuy ? liquidityInfo.askPrice : liquidityInfo.bidPrice;
    let impactedPrice = referencePrice;
    let slippage = 0;

    if (liquidityInfo.depth) {
      const levels = isBuy ? liquidityInfo.depth.asks : liquidityInfo.depth.bids;
      let remainingSize = orderSize;

      for (const [price, volume] of levels) {
        if (remainingSize <= 0) break;
        const execution = Math.min(volume, remainingSize);
        impactedPrice = price;
        remainingSize -= execution;
      }
    } else {
      // Estimate based on spread and liquidity
      const depthImpact = (orderSize / (liquidityInfo.availableLiquidity || 1000)) * 0.5;
      const spread = liquidityInfo.askPrice - liquidityInfo.bidPrice;
      impactedPrice = isBuy 
        ? liquidityInfo.askPrice + (spread * depthImpact)
        : liquidityInfo.bidPrice - (spread * depthImpact);
    }

    slippage = Math.abs(impactedPrice - referencePrice);
    const slippagePercentage = (slippage / referencePrice) * 100;
    const timeToExecute = Math.min(5000, 1000 + (orderSize / (liquidityInfo.availableLiquidity || 1000)) * 2000);

    return {
      orderSize,
      estimatedSlippage: slippage,
      slippagePercentage,
      impactedPrice,
      timeToExecute
    };
  }

  /**
   * Check if liquidity is sufficient for order
   */
  public isSufficientLiquidity(pair: string, orderSize: number, maxSlippagePercent: number = 1): boolean {
    const estimate = this.estimateSlippage(pair, orderSize);
    return estimate.slippagePercentage <= maxSlippagePercent;
  }

  /**
   * Get current liquidity info for a pair
   */
  public getLiquidityInfo(pair: string): LiquidityInfo | null {
    const info = this.liquidityCache.get(pair);
    
    if (!info) return null;

    // Check if cache is still valid
    const age = Date.now() - info.timestamp;
    if (age > this.CACHE_TTL) {
      this.liquidityCache.delete(pair);
      return null;
    }

    return info;
  }

  /**
   * Get liquidity metrics for a pair
   */
  public getLiquidityMetrics(pair: string): LiquidityMetrics | null {
    const history = this.metricsHistory.get(pair);
    return history && history.length > 0 ? history[history.length - 1] : null;
  }

  /**
   * Store historical metrics
   */
  private storeMetrics(pair: string, metrics: LiquidityMetrics): void {
    if (!this.metricsHistory.has(pair)) {
      this.metricsHistory.set(pair, []);
    }

    const history = this.metricsHistory.get(pair)!;
    history.push(metrics);

    // Keep only recent history to avoid memory issues
    if (history.length > 100) {
      history.shift();
    }
  }

  /**
   * Get liquidity trend analysis
   */
  public getLiquidityTrend(pair: string, periodCount: number = 10): {
    direction: 'INCREASING' | 'DECREASING' | 'STABLE';
    strength: number;
    averageLiquidity: number;
  } {
    const history = this.metricsHistory.get(pair) || [];
    const recent = history.slice(-periodCount);

    if (recent.length < 2) {
      return {
        direction: 'STABLE',
        strength: 0,
        averageLiquidity: recent.length > 0 ? recent[0].totalLiquidity : 0
      };
    }

    const avgLiquidity = recent.reduce((sum, m) => sum + m.totalLiquidity, 0) / recent.length;
    const firstHalf = recent.slice(0, Math.floor(recent.length / 2)).reduce((sum, m) => sum + m.totalLiquidity, 0) / Math.ceil(recent.length / 2);
    const secondHalf = recent.slice(Math.floor(recent.length / 2)).reduce((sum, m) => sum + m.totalLiquidity, 0) / Math.floor(recent.length / 2);

    const change = secondHalf - firstHalf;
    const changePercent = Math.abs(change) / firstHalf * 100;

    let direction: 'INCREASING' | 'DECREASING' | 'STABLE' = 'STABLE';
    if (changePercent > 5) {
      direction = change > 0 ? 'INCREASING' : 'DECREASING';
    }

    return {
      direction,
      strength: Math.min(100, changePercent),
      averageLiquidity: avgLiquidity
    };
  }

  /**
   * Clear cache for a pair
   */
  public clearCache(pair: string): void {
    this.liquidityCache.delete(pair);
  }

  /**
   * Clear all caches
   */
  public clearAllCaches(): void {
    this.liquidityCache.clear();
    this.metricsHistory.clear();
    this.marketMetricsCache.clear();
    logger.info('All liquidity caches cleared');
  }

  /**
   * Get cache statistics
   */
  public getCacheStats(): {
    cachedPairs: number;
    totalMetricsStored: number;
    largestHistory: number;
  } {
    let totalMetrics = 0;
    let largestHistory = 0;

    this.metricsHistory.forEach(history => {
      totalMetrics += history.length;
      largestHistory = Math.max(largestHistory, history.length);
    });

    return {
      cachedPairs: this.liquidityCache.size,
      totalMetricsStored: totalMetrics,
      largestHistory
    };
  }
}

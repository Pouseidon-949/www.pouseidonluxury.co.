/**
 * Capital Reuse Logic and Management
 * Tracks capital across consecutive loops and optimizes reallocation
 */

import { CapitalState, LoopState, TradeResult } from '../types/index';
import { logger } from '../utils/logger';

export class CapitalManager {
  private capitalHistory: CapitalState[] = [];
  private loopStates: LoopState[] = [];
  private readonly MAX_HISTORY_SIZE = 100;

  /**
   * Initialize capital state
   */
  public initializeCapital(totalCapital: number): CapitalState {
    const state: CapitalState = {
      totalCapital,
      availableCapital: totalCapital,
      allocatedCapital: 0,
      activePositions: new Map(),
      reusableCapital: totalCapital
    };

    this.capitalHistory.push(state);
    logger.info('Capital initialized', { totalCapital });
    return state;
  }

  /**
   * Allocate capital for a trade
   */
  public allocateCapital(currentState: CapitalState, amount: number, positionId: string): CapitalState {
    if (amount > currentState.availableCapital) {
      logger.warn('Insufficient capital for allocation', { 
        requested: amount, 
        available: currentState.availableCapital 
      });
      return currentState;
    }

    const newState: CapitalState = {
      ...currentState,
      availableCapital: currentState.availableCapital - amount,
      allocatedCapital: currentState.allocatedCapital + amount,
      activePositions: new Map(currentState.activePositions)
    };

    newState.activePositions.set(positionId, amount);
    this.capitalHistory.push(newState);

    logger.debug('Capital allocated', { 
      positionId, 
      amount, 
      remainingAvailable: newState.availableCapital 
    });

    return newState;
  }

  /**
   * Deallocate capital from a closed position
   */
  public deallocateCapital(currentState: CapitalState, positionId: string, returnAmount: number): CapitalState {
    const positionSize = currentState.activePositions.get(positionId) || 0;

    const newState: CapitalState = {
      ...currentState,
      availableCapital: currentState.availableCapital + returnAmount,
      allocatedCapital: Math.max(0, currentState.allocatedCapital - positionSize),
      activePositions: new Map(currentState.activePositions)
    };

    newState.activePositions.delete(positionId);
    this.capitalHistory.push(newState);

    const profit = returnAmount - positionSize;
    logger.debug('Capital deallocated', { 
      positionId, 
      returnAmount, 
      profit,
      availableNow: newState.availableCapital 
    });

    return newState;
  }

  /**
   * Reuse capital from previous loop for next iteration
   */
  public reuseCapitalForNextLoop(
    currentState: CapitalState,
    previousLoopProfit: number,
    profitReinvestmentRate: number = 1.0 // 100% reinvestment
  ): CapitalState {
    const profitToReinvest = previousLoopProfit * profitReinvestmentRate;
    
    const newState: CapitalState = {
      ...currentState,
      availableCapital: currentState.availableCapital + profitToReinvest,
      reusableCapital: currentState.reusableCapital + profitToReinvest,
      totalCapital: currentState.totalCapital + profitToReinvest
    };

    this.capitalHistory.push(newState);

    logger.info('Capital reused for next loop', {
      previousProfit: previousLoopProfit,
      reinvested: profitToReinvest,
      newAvailable: newState.availableCapital
    });

    return newState;
  }

  /**
   * Record loop completion and calculate capital changes
   */
  public recordLoopCompletion(
    loopId: string,
    capitalBefore: CapitalState,
    tradeResults: TradeResult[]
  ): LoopState {
    const successCount = tradeResults.filter(r => r.success).length;
    const successRate = tradeResults.length > 0 ? successCount / tradeResults.length : 0;

    // Calculate total profit from trades
    let totalProfit = 0;
    tradeResults.forEach(result => {
      if (result.success) {
        totalProfit += (result.executedPrice - result.executedPrice * 0.001) * result.executedAmount; // Simplified
      }
    });

    // Create capital after state
    const capitalAfter: CapitalState = {
      ...capitalBefore,
      totalCapital: capitalBefore.totalCapital + totalProfit,
      availableCapital: capitalBefore.availableCapital + totalProfit,
      reusableCapital: capitalBefore.reusableCapital + totalProfit
    };

    const loopState: LoopState = {
      loopId,
      startTime: Date.now(),
      opportunities: [],
      executedTrades: tradeResults,
      capitalBefore,
      capitalAfter,
      totalProfit,
      successRate
    };

    this.loopStates.push(loopState);
    this.capitalHistory.push(capitalAfter);

    // Maintain history size
    if (this.loopStates.length > this.MAX_HISTORY_SIZE) {
      this.loopStates.shift();
    }

    logger.info('Loop completed', {
      loopId,
      trades: tradeResults.length,
      successRate: (successRate * 100).toFixed(2) + '%',
      profit: totalProfit,
      newCapital: capitalAfter.totalCapital
    });

    return loopState;
  }

  /**
   * Calculate optimal capital allocation for next loop
   */
  public calculateOptimalAllocation(
    currentState: CapitalState,
    numberOfTargets: number,
    riskTolerance: number = 0.02 // 2% per trade
  ): number {
    // Kelly Criterion inspired allocation
    const recentSuccessRate = this.getRecentSuccessRate();
    const allocation = currentState.availableCapital * riskTolerance * recentSuccessRate / numberOfTargets;

    logger.debug('Optimal allocation calculated', {
      available: currentState.availableCapital,
      numberOfTargets,
      perTarget: allocation
    });

    return allocation;
  }

  /**
   * Get recent success rate from loop history
   */
  public getRecentSuccessRate(periodCount: number = 5): number {
    if (this.loopStates.length === 0) return 0.5; // Default 50%

    const recent = this.loopStates.slice(-periodCount);
    const totalRate = recent.reduce((sum, loop) => sum + loop.successRate, 0);
    return totalRate / recent.length;
  }

  /**
   * Get capital growth statistics
   */
  public getCapitalGrowthStats(): {
    initialCapital: number;
    currentCapital: number;
    totalGrowth: number;
    growthRate: number;
    averageLoopProfit: number;
    maxLoopProfit: number;
    minLoopProfit: number;
  } {
    if (this.capitalHistory.length === 0) {
      return {
        initialCapital: 0,
        currentCapital: 0,
        totalGrowth: 0,
        growthRate: 0,
        averageLoopProfit: 0,
        maxLoopProfit: 0,
        minLoopProfit: 0
      };
    }

    const initialCapital = this.capitalHistory[0].totalCapital;
    const currentCapital = this.capitalHistory[this.capitalHistory.length - 1].totalCapital;
    const totalGrowth = currentCapital - initialCapital;
    const growthRate = initialCapital > 0 ? (totalGrowth / initialCapital) * 100 : 0;

    const profits = this.loopStates.map(loop => loop.totalProfit);
    const averageLoopProfit = profits.length > 0 ? profits.reduce((a, b) => a + b, 0) / profits.length : 0;
    const maxLoopProfit = profits.length > 0 ? Math.max(...profits) : 0;
    const minLoopProfit = profits.length > 0 ? Math.min(...profits) : 0;

    return {
      initialCapital,
      currentCapital,
      totalGrowth,
      growthRate,
      averageLoopProfit,
      maxLoopProfit,
      minLoopProfit
    };
  }

  /**
   * Get capital efficiency ratio
   */
  public getCapitalEfficiencyRatio(): number {
    if (this.loopStates.length === 0) return 0;

    const totalProfit = this.loopStates.reduce((sum, loop) => sum + loop.totalProfit, 0);
    const initialCapital = this.capitalHistory[0]?.totalCapital || 1;
    const totalCapitalUse = this.loopStates.length * initialCapital;

    return totalProfit / totalCapitalUse;
  }

  /**
   * Predict next loop capital based on trends
   */
  public predictNextLoopCapital(method: 'linear' | 'exponential' = 'linear'): number {
    if (this.loopStates.length < 2) {
      return this.capitalHistory[this.capitalHistory.length - 1]?.totalCapital || 0;
    }

    const recent = this.loopStates.slice(-5);
    const profits = recent.map(loop => loop.totalProfit);

    if (method === 'linear') {
      const avgProfit = profits.reduce((a, b) => a + b, 0) / profits.length;
      const currentCapital = this.capitalHistory[this.capitalHistory.length - 1].totalCapital;
      return currentCapital + avgProfit;
    } else {
      // Exponential growth model
      const currentCapital = this.capitalHistory[this.capitalHistory.length - 1].totalCapital;
      const avgGrowthRate = (profits[profits.length - 1] || 0) / currentCapital;
      return currentCapital * (1 + avgGrowthRate);
    }
  }

  /**
   * Get capital history
   */
  public getCapitalHistory(limit?: number): CapitalState[] {
    if (!limit) return this.capitalHistory;
    return this.capitalHistory.slice(-limit);
  }

  /**
   * Get loop states
   */
  public getLoopStates(limit?: number): LoopState[] {
    if (!limit) return this.loopStates;
    return this.loopStates.slice(-limit);
  }

  /**
   * Reset capital tracking
   */
  public reset(): void {
    this.capitalHistory = [];
    this.loopStates = [];
    logger.info('Capital manager reset');
  }

  /**
   * Get current capital state
   */
  public getCurrentState(): CapitalState | null {
    return this.capitalHistory.length > 0 
      ? this.capitalHistory[this.capitalHistory.length - 1] 
      : null;
  }

  /**
   * Check if capital is sufficient for allocation
   */
  public isSufficientCapital(state: CapitalState, amount: number): boolean {
    return amount <= state.availableCapital;
  }

  /**
   * Get capital utilization percentage
   */
  public getCapitalUtilization(state: CapitalState): number {
    if (state.totalCapital === 0) return 0;
    return (state.allocatedCapital / state.totalCapital) * 100;
  }
}

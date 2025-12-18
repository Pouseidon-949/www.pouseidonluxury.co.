import { LiquidityInfo, OrderSide } from '../types';
import { logger } from '../utils/logger';

export class TradeSizeCalculator {
  private minTradeSize: number;
  private maxTradeSize: number;
  private liquidityUtilizationFactor: number;

  constructor(minTradeSize: number, maxTradeSize: number, liquidityUtilizationFactor: number = 0.8) {
    this.minTradeSize = minTradeSize;
    this.maxTradeSize = maxTradeSize;
    this.liquidityUtilizationFactor = liquidityUtilizationFactor;
  }

  calculateOptimalTradeSize(
    desiredAmount: number,
    liquidityInfo: LiquidityInfo,
    side: OrderSide
  ): number {
    const availableLiquidity = liquidityInfo.availableLiquidity;
    const maxLiquidityAmount = availableLiquidity * this.liquidityUtilizationFactor;

    let optimalSize = Math.min(desiredAmount, maxLiquidityAmount, this.maxTradeSize);
    optimalSize = Math.max(optimalSize, this.minTradeSize);

    if (optimalSize < this.minTradeSize) {
      logger.warn('Calculated trade size below minimum', {
        calculatedSize: optimalSize,
        minTradeSize: this.minTradeSize,
        availableLiquidity
      });
      return 0;
    }

    if (optimalSize !== desiredAmount) {
      logger.info('Trade size adjusted based on liquidity', {
        desiredAmount,
        optimalSize,
        availableLiquidity,
        utilizationFactor: this.liquidityUtilizationFactor
      });
    }

    return optimalSize;
  }

  canExecuteTrade(amount: number, liquidityInfo: LiquidityInfo): boolean {
    const maxSafeAmount = liquidityInfo.availableLiquidity * this.liquidityUtilizationFactor;
    const canExecute = amount <= maxSafeAmount && amount >= this.minTradeSize;
    
    if (!canExecute) {
      logger.warn('Trade cannot be executed safely', {
        amount,
        maxSafeAmount,
        minTradeSize: this.minTradeSize,
        availableLiquidity: liquidityInfo.availableLiquidity
      });
    }
    
    return canExecute;
  }

  calculateTotalCost(amount: number, price: number, side: OrderSide): number {
    return amount * price;
  }
}

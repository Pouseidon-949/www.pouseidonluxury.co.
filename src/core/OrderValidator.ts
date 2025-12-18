import { Order, LiquidityInfo } from '../types';
import { logger } from '../utils/logger';

export class OrderValidator {
  private minTradeSize: number;
  private maxTradeSize: number;

  constructor(minTradeSize: number, maxTradeSize: number) {
    this.minTradeSize = minTradeSize;
    this.maxTradeSize = maxTradeSize;
  }

  validate(order: Order, liquidityInfo: LiquidityInfo): { valid: boolean; reason?: string } {
    if (!order.pair || order.pair.trim() === '') {
      logger.error('Order validation failed: Invalid trading pair', { orderId: order.id });
      return { valid: false, reason: 'Invalid trading pair' };
    }

    if (!order.pair.includes('USDT')) {
      logger.error('Order validation failed: Only USDT pairs are supported', { orderId: order.id, pair: order.pair });
      return { valid: false, reason: 'Only USDT pairs are supported' };
    }

    if (order.amount <= 0) {
      logger.error('Order validation failed: Invalid amount', { orderId: order.id, amount: order.amount });
      return { valid: false, reason: 'Amount must be positive' };
    }

    if (order.amount < this.minTradeSize) {
      logger.error('Order validation failed: Amount below minimum', { 
        orderId: order.id, 
        amount: order.amount,
        minTradeSize: this.minTradeSize 
      });
      return { valid: false, reason: `Amount below minimum trade size of ${this.minTradeSize}` };
    }

    if (order.amount > this.maxTradeSize) {
      logger.error('Order validation failed: Amount exceeds maximum', { 
        orderId: order.id, 
        amount: order.amount,
        maxTradeSize: this.maxTradeSize 
      });
      return { valid: false, reason: `Amount exceeds maximum trade size of ${this.maxTradeSize}` };
    }

    if (order.price <= 0) {
      logger.error('Order validation failed: Invalid price', { orderId: order.id, price: order.price });
      return { valid: false, reason: 'Price must be positive' };
    }

    if (order.slippageTolerance < 0 || order.slippageTolerance > 1) {
      logger.error('Order validation failed: Invalid slippage tolerance', { 
        orderId: order.id, 
        slippageTolerance: order.slippageTolerance 
      });
      return { valid: false, reason: 'Slippage tolerance must be between 0 and 1' };
    }

    if (order.amount > liquidityInfo.availableLiquidity) {
      logger.warn('Order validation failed: Insufficient liquidity', { 
        orderId: order.id, 
        orderAmount: order.amount,
        availableLiquidity: liquidityInfo.availableLiquidity 
      });
      return { valid: false, reason: 'Insufficient liquidity for order size' };
    }

    logger.info('Order validation passed', { orderId: order.id });
    return { valid: true };
  }

  validateSlippage(expectedPrice: number, executedPrice: number, tolerance: number): boolean {
    const slippage = Math.abs(executedPrice - expectedPrice) / expectedPrice;
    const withinTolerance = slippage <= tolerance;
    
    if (!withinTolerance) {
      logger.warn('Slippage exceeds tolerance', { 
        expectedPrice, 
        executedPrice, 
        slippage, 
        tolerance 
      });
    }
    
    return withinTolerance;
  }
}

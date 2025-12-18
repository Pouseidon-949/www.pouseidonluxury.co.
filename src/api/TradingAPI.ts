import { TradingEngine } from '../core/TradingEngine';
import { OrderSide, LiquidityInfo, TradeResult, Order } from '../types';
import { logger } from '../utils/logger';

export interface OrderRequest {
  pair: string;
  side: 'BUY' | 'SELL';
  amount: number;
  price: number;
}

export interface LiquidityRequest {
  pair: string;
}

export class TradingAPI {
  private engine: TradingEngine;

  constructor(engine: TradingEngine) {
    this.engine = engine;
  }

  async placeOrder(request: OrderRequest, liquidityInfo: LiquidityInfo): Promise<TradeResult> {
    try {
      const side = request.side === 'BUY' ? OrderSide.BUY : OrderSide.SELL;
      
      return await this.engine.placeOrder(
        request.pair,
        side,
        request.amount,
        request.price,
        liquidityInfo
      );
    } catch (error) {
      logger.error('API: Order placement failed', {
        request,
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

  getActiveOrders(): Order[] {
    return this.engine.getOrderManager().getActiveOrders();
  }

  getOrderHistory(limit?: number): Order[] {
    return this.engine.getOrderManager().getOrderHistory(limit);
  }

  getEngineStatus() {
    return this.engine.getEngineStatus();
  }

  startAutoTrading(
    pairs: string[],
    getLiquidityFn: (pair: string) => Promise<LiquidityInfo>
  ): void {
    this.engine.startContinuousTrading(async () => {
      const orders = [];

      for (const pair of pairs) {
        try {
          const liquidity = await getLiquidityFn(pair);
          
          if (Math.random() > 0.3) {
            orders.push({
              pair,
              side: Math.random() > 0.5 ? OrderSide.BUY : OrderSide.SELL,
              amount: 10 + Math.random() * 90,
              price: liquidity.bidPrice,
              liquidityInfo: liquidity
            });
          }
        } catch (error) {
          logger.error('Failed to generate order', {
            pair,
            error: error instanceof Error ? error.message : String(error)
          });
        }
      }

      return orders;
    });
  }

  stopAutoTrading(): void {
    this.engine.stopContinuousTrading();
  }

  validateOrderRequest(request: OrderRequest): { valid: boolean; reason?: string } {
    if (!request.pair || !request.pair.includes('USDT')) {
      return { valid: false, reason: 'Invalid pair - only USDT pairs supported' };
    }

    if (!['BUY', 'SELL'].includes(request.side)) {
      return { valid: false, reason: 'Invalid side - must be BUY or SELL' };
    }

    if (request.amount <= 0) {
      return { valid: false, reason: 'Invalid amount - must be positive' };
    }

    if (request.price <= 0) {
      return { valid: false, reason: 'Invalid price - must be positive' };
    }

    return { valid: true };
  }
}

import { Order, OrderStatus, TradeResult, ExecutionContext } from '../types';
import { logger } from '../utils/logger';
import { OrderValidator } from './OrderValidator';

export class AtomicExecutor {
  private validator: OrderValidator;
  private activeTransactions: Map<string, ExecutionContext>;

  constructor(validator: OrderValidator) {
    this.validator = validator;
    this.activeTransactions = new Map();
  }

  async executeAtomic(context: ExecutionContext): Promise<TradeResult> {
    const { order, liquidityInfo } = context;
    const transactionId = order.id;

    try {
      logger.info('Starting atomic execution', { orderId: order.id, pair: order.pair });

      this.activeTransactions.set(transactionId, context);

      const validationResult = this.validator.validate(order, liquidityInfo);
      if (!validationResult.valid) {
        throw new Error(`Validation failed: ${validationResult.reason}`);
      }

      order.status = OrderStatus.EXECUTING;
      logger.info('Order validated, executing trade', { orderId: order.id });

      const result = await this.executeTradeTransaction(order, liquidityInfo);

      if (!result.success) {
        throw new Error(result.error || 'Trade execution failed');
      }

      const slippageValid = this.validator.validateSlippage(
        order.price,
        result.executedPrice,
        order.slippageTolerance
      );

      if (!slippageValid) {
        throw new Error('Slippage tolerance exceeded');
      }

      if (result.executedAmount !== order.amount) {
        throw new Error('Partial fill detected - atomic execution requires full fill');
      }

      order.status = OrderStatus.COMPLETED;
      this.activeTransactions.delete(transactionId);

      logger.info('Atomic execution completed successfully', {
        orderId: order.id,
        executedAmount: result.executedAmount,
        executedPrice: result.executedPrice
      });

      return result;

    } catch (error) {
      logger.error('Atomic execution failed, initiating rollback', {
        orderId: order.id,
        error: error instanceof Error ? error.message : String(error)
      });

      await this.rollback(order, transactionId);

      return {
        success: false,
        orderId: order.id,
        executedAmount: 0,
        executedPrice: 0,
        error: error instanceof Error ? error.message : String(error),
        timestamp: Date.now()
      };
    }
  }

  private async executeTradeTransaction(order: Order, liquidityInfo: any): Promise<TradeResult> {
    return new Promise((resolve) => {
      setTimeout(() => {
        const executedPrice = order.side === 'BUY' ? liquidityInfo.askPrice : liquidityInfo.bidPrice;
        const priceVariation = (Math.random() - 0.5) * 0.01 * executedPrice;
        const finalPrice = executedPrice + priceVariation;

        const slippage = Math.abs(finalPrice - order.price) / order.price;

        if (slippage > order.slippageTolerance) {
          resolve({
            success: false,
            orderId: order.id,
            executedAmount: 0,
            executedPrice: finalPrice,
            error: 'Slippage exceeds tolerance',
            timestamp: Date.now()
          });
          return;
        }

        resolve({
          success: true,
          orderId: order.id,
          executedAmount: order.amount,
          executedPrice: finalPrice,
          timestamp: Date.now()
        });
      }, 50);
    });
  }

  private async rollback(order: Order, transactionId: string): Promise<void> {
    logger.warn('Rolling back transaction', { orderId: order.id, transactionId });

    try {
      order.status = OrderStatus.ROLLED_BACK;
      this.activeTransactions.delete(transactionId);

      logger.info('Rollback completed successfully', { orderId: order.id });
    } catch (error) {
      logger.error('Rollback failed', {
        orderId: order.id,
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }

  getActiveTransactionCount(): number {
    return this.activeTransactions.size;
  }

  isTransactionActive(orderId: string): boolean {
    return this.activeTransactions.has(orderId);
  }
}

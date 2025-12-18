import { Order, OrderSide, TradeResult, LiquidityInfo, ExecutionContext, TradingConfig } from '../types';
import { logger } from '../utils/logger';
import { OrderManager } from './OrderManager';
import { OrderValidator } from './OrderValidator';
import { TradeSizeCalculator } from './TradeSizeCalculator';
import { AtomicExecutor } from './AtomicExecutor';
import { RetryHandler } from './RetryHandler';

export class TradingEngine {
  private config: TradingConfig;
  private orderManager: OrderManager;
  private validator: OrderValidator;
  private sizeCalculator: TradeSizeCalculator;
  private atomicExecutor: AtomicExecutor;
  private retryHandler: RetryHandler;
  private isRunning: boolean = false;
  private loopInterval: number;

  constructor(config: TradingConfig) {
    this.config = config;
    this.loopInterval = (60 / config.loopsPerMinute) * 1000;

    this.orderManager = new OrderManager(config.maxRetries);
    this.validator = new OrderValidator(config.minTradeSize, config.maxTradeSize);
    this.sizeCalculator = new TradeSizeCalculator(config.minTradeSize, config.maxTradeSize);
    this.atomicExecutor = new AtomicExecutor(this.validator);
    this.retryHandler = new RetryHandler({
      maxRetries: config.maxRetries,
      initialDelayMs: 100,
      maxDelayMs: 1000
    });

    logger.info('Trading Engine initialized', {
      loopsPerMinute: config.loopsPerMinute,
      loopInterval: this.loopInterval,
      minTradeSize: config.minTradeSize,
      maxTradeSize: config.maxTradeSize
    });
  }

  async placeOrder(
    pair: string,
    side: OrderSide,
    desiredAmount: number,
    price: number,
    liquidityInfo: LiquidityInfo
  ): Promise<TradeResult> {
    try {
      logger.info('Placing order', { pair, side, desiredAmount, price });

      const optimalAmount = this.sizeCalculator.calculateOptimalTradeSize(
        desiredAmount,
        liquidityInfo,
        side
      );

      if (optimalAmount === 0) {
        throw new Error('Cannot calculate optimal trade size - insufficient liquidity or amount too small');
      }

      const order = this.orderManager.createOrder(
        pair,
        side,
        optimalAmount,
        price,
        this.config.defaultSlippageTolerance
      );

      const context: ExecutionContext = {
        order,
        liquidityInfo,
        timestamp: Date.now()
      };

      const result = await this.retryHandler.executeTradeWithRetry(
        order,
        async (ord) => await this.atomicExecutor.executeAtomic({ ...context, order: ord })
      );

      this.orderManager.completeOrder(order.id, result);

      return result;

    } catch (error) {
      logger.error('Order placement failed', {
        pair,
        side,
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

  async executeTradingLoop(
    orders: Array<{
      pair: string;
      side: OrderSide;
      amount: number;
      price: number;
      liquidityInfo: LiquidityInfo;
    }>
  ): Promise<void> {
    logger.info('Executing trading loop', { orderCount: orders.length });

    const results = await Promise.all(
      orders.map(order =>
        this.placeOrder(
          order.pair,
          order.side,
          order.amount,
          order.price,
          order.liquidityInfo
        )
      )
    );

    const successful = results.filter(r => r.success).length;
    const failed = results.filter(r => !r.success).length;

    logger.info('Trading loop completed', {
      total: results.length,
      successful,
      failed
    });
  }

  startContinuousTrading(
    getOrdersFn: () => Promise<Array<{
      pair: string;
      side: OrderSide;
      amount: number;
      price: number;
      liquidityInfo: LiquidityInfo;
    }>>
  ): void {
    if (this.isRunning) {
      logger.warn('Trading engine already running');
      return;
    }

    this.isRunning = true;
    logger.info('Starting continuous trading', {
      loopsPerMinute: this.config.loopsPerMinute,
      intervalMs: this.loopInterval
    });

    this.runTradingLoop(getOrdersFn);
  }

  private async runTradingLoop(
    getOrdersFn: () => Promise<Array<{
      pair: string;
      side: OrderSide;
      amount: number;
      price: number;
      liquidityInfo: LiquidityInfo;
    }>>
  ): Promise<void> {
    while (this.isRunning) {
      const loopStart = Date.now();

      try {
        const orders = await getOrdersFn();
        await this.executeTradingLoop(orders);
      } catch (error) {
        logger.error('Trading loop error', {
          error: error instanceof Error ? error.message : String(error)
        });
      }

      const loopDuration = Date.now() - loopStart;
      const waitTime = Math.max(0, this.loopInterval - loopDuration);

      if (waitTime > 0) {
        await new Promise(resolve => setTimeout(resolve, waitTime));
      } else {
        logger.warn('Trading loop exceeded interval', {
          loopDuration,
          interval: this.loopInterval,
          overage: loopDuration - this.loopInterval
        });
      }
    }
  }

  stopContinuousTrading(): void {
    if (!this.isRunning) {
      logger.warn('Trading engine not running');
      return;
    }

    this.isRunning = false;
    logger.info('Stopping continuous trading');
  }

  getEngineStatus() {
    return {
      isRunning: this.isRunning,
      activeOrders: this.orderManager.getOrderCount(),
      completedOrders: this.orderManager.getCompletedOrderCount(),
      failedOrders: this.orderManager.getFailedOrderCount(),
      activeTransactions: this.atomicExecutor.getActiveTransactionCount(),
      config: this.config
    };
  }

  getOrderManager(): OrderManager {
    return this.orderManager;
  }
}

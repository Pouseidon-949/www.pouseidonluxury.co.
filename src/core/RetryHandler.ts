import { Order, TradeResult, ExecutionContext } from '../types';
import { logger } from '../utils/logger';

export interface RetryStrategy {
  maxRetries: number;
  initialDelayMs: number;
  maxDelayMs: number;
  backoffMultiplier: number;
}

export class RetryHandler {
  private strategy: RetryStrategy;

  constructor(strategy?: Partial<RetryStrategy>) {
    this.strategy = {
      maxRetries: strategy?.maxRetries ?? 3,
      initialDelayMs: strategy?.initialDelayMs ?? 100,
      maxDelayMs: strategy?.maxDelayMs ?? 2000,
      backoffMultiplier: strategy?.backoffMultiplier ?? 2
    };
  }

  async executeWithRetry<T>(
    operation: () => Promise<T>,
    context: { orderId: string; operationName: string }
  ): Promise<T> {
    let lastError: Error | undefined;
    let currentDelay = this.strategy.initialDelayMs;

    for (let attempt = 0; attempt <= this.strategy.maxRetries; attempt++) {
      try {
        if (attempt > 0) {
          logger.info('Retrying operation', {
            ...context,
            attempt,
            maxRetries: this.strategy.maxRetries,
            delay: currentDelay
          });

          await this.delay(currentDelay);
          currentDelay = Math.min(
            currentDelay * this.strategy.backoffMultiplier,
            this.strategy.maxDelayMs
          );
        }

        const result = await operation();
        
        if (attempt > 0) {
          logger.info('Operation succeeded after retry', {
            ...context,
            attempt
          });
        }

        return result;

      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        
        logger.warn('Operation failed', {
          ...context,
          attempt,
          maxRetries: this.strategy.maxRetries,
          error: lastError.message
        });

        if (attempt === this.strategy.maxRetries) {
          logger.error('Operation failed after all retries exhausted', {
            ...context,
            totalAttempts: attempt + 1,
            error: lastError.message
          });
        }
      }
    }

    throw lastError || new Error('Operation failed after all retries');
  }

  async executeTradeWithRetry(
    order: Order,
    executeFn: (order: Order) => Promise<TradeResult>
  ): Promise<TradeResult> {
    const context = {
      orderId: order.id,
      operationName: 'Trade Execution'
    };

    try {
      return await this.executeWithRetry(async () => {
        const result = await executeFn(order);
        
        if (!result.success) {
          throw new Error(result.error || 'Trade execution failed');
        }
        
        return result;
      }, context);

    } catch (error) {
      logger.error('Trade execution failed after all retries', {
        orderId: order.id,
        error: error instanceof Error ? error.message : String(error)
      });

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

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  shouldRetry(error: Error, attempt: number): boolean {
    if (attempt >= this.strategy.maxRetries) {
      return false;
    }

    const retryableErrors = [
      'network',
      'timeout',
      'connection',
      'temporary',
      'rate limit'
    ];

    const errorMessage = error.message.toLowerCase();
    return retryableErrors.some(keyword => errorMessage.includes(keyword));
  }

  getStrategy(): RetryStrategy {
    return { ...this.strategy };
  }

  updateStrategy(strategy: Partial<RetryStrategy>): void {
    this.strategy = {
      ...this.strategy,
      ...strategy
    };
    logger.info('Retry strategy updated', this.strategy);
  }
}

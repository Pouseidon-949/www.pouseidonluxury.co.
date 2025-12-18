import { TradingEngine } from './core/TradingEngine';
import { OrderSide, LiquidityInfo } from './types';
import { logger, LogLevel } from './utils/logger';

logger.setLogLevel(LogLevel.INFO);

const config = {
  defaultSlippageTolerance: 0.005,
  maxRetries: 3,
  loopsPerMinute: 19,
  minTradeSize: 10,
  maxTradeSize: 10000
};

const tradingEngine = new TradingEngine(config);

async function getLiquidityInfo(pair: string): Promise<LiquidityInfo> {
  return {
    pair,
    availableLiquidity: 50000 + Math.random() * 50000,
    bidPrice: 1.0 - Math.random() * 0.01,
    askPrice: 1.0 + Math.random() * 0.01,
    timestamp: Date.now()
  };
}

async function exampleUsage() {
  logger.info('=== Pouseidon Bot v2 - Trading Engine Core ===');
  logger.info('Starting example trading operations...');

  const pair = 'BTC/USDT';
  const liquidityInfo = await getLiquidityInfo(pair);

  logger.info('Placing BUY order...');
  const buyResult = await tradingEngine.placeOrder(
    pair,
    OrderSide.BUY,
    100,
    50000,
    liquidityInfo
  );

  logger.info('Buy order result:', buyResult);

  logger.info('Placing SELL order...');
  const sellResult = await tradingEngine.placeOrder(
    pair,
    OrderSide.SELL,
    50,
    51000,
    liquidityInfo
  );

  logger.info('Sell order result:', sellResult);

  logger.info('Engine status:', tradingEngine.getEngineStatus());

  logger.info('');
  logger.info('=== Starting Continuous Trading Loop (19 loops/minute) ===');
  logger.info('Press Ctrl+C to stop...');

  tradingEngine.startContinuousTrading(async () => {
    const pairs = ['BTC/USDT', 'ETH/USDT', 'BNB/USDT'];
    const orders = [];

    for (const tradePair of pairs) {
      const liquidity = await getLiquidityInfo(tradePair);
      
      if (Math.random() > 0.5) {
        orders.push({
          pair: tradePair,
          side: Math.random() > 0.5 ? OrderSide.BUY : OrderSide.SELL,
          amount: 10 + Math.random() * 90,
          price: liquidity.bidPrice,
          liquidityInfo: liquidity
        });
      }
    }

    return orders;
  });

  process.on('SIGINT', () => {
    logger.info('');
    logger.info('Shutting down trading engine...');
    tradingEngine.stopContinuousTrading();
    
    const finalStatus = tradingEngine.getEngineStatus();
    logger.info('Final engine status:', finalStatus);
    
    process.exit(0);
  });
}

exampleUsage().catch(error => {
  logger.error('Fatal error', { error: error instanceof Error ? error.message : String(error) });
  process.exit(1);
});

export { TradingEngine } from './core/TradingEngine';
export { OrderManager } from './core/OrderManager';
export { AtomicExecutor } from './core/AtomicExecutor';
export { OrderValidator } from './core/OrderValidator';
export { TradeSizeCalculator } from './core/TradeSizeCalculator';
export { RetryHandler } from './core/RetryHandler';
export * from './types';

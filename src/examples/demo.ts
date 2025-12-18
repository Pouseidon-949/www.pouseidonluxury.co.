import { TradingEngine } from '../core/TradingEngine';
import { OrderSide, LiquidityInfo, TradeResult } from '../types';
import { logger, LogLevel } from '../utils/logger';

logger.setLogLevel(LogLevel.INFO);

async function demonstrateAtomicExecution() {
  console.log('\n========================================');
  console.log('DEMO 1: Atomic Execution');
  console.log('========================================\n');

  const config = {
    defaultSlippageTolerance: 0.005,
    maxRetries: 3,
    loopsPerMinute: 19,
    minTradeSize: 10,
    maxTradeSize: 10000
  };

  const engine = new TradingEngine(config);

  const liquidityInfo: LiquidityInfo = {
    pair: 'BTC/USDT',
    availableLiquidity: 100000,
    bidPrice: 50000,
    askPrice: 50050,
    timestamp: Date.now()
  };

  const result = await engine.placeOrder(
    'BTC/USDT',
    OrderSide.BUY,
    100,
    50050,
    liquidityInfo
  );

  console.log('\n✅ Result:', {
    success: result.success,
    executedAmount: result.executedAmount,
    executedPrice: result.executedPrice,
    error: result.error
  });
}

async function demonstrateDynamicSizing() {
  console.log('\n========================================');
  console.log('DEMO 2: Dynamic Trade Sizing');
  console.log('========================================\n');

  const config = {
    defaultSlippageTolerance: 0.005,
    maxRetries: 3,
    loopsPerMinute: 19,
    minTradeSize: 10,
    maxTradeSize: 10000
  };

  const engine = new TradingEngine(config);

  const scenarios = [
    { liquidity: 200, desired: 100, desc: 'Low liquidity (200) with high demand (100)' },
    { liquidity: 100000, desired: 100, desc: 'High liquidity (100000) with normal demand (100)' },
    { liquidity: 50, desired: 1000, desc: 'Very low liquidity (50) with high demand (1000)' }
  ];

  for (const scenario of scenarios) {
    console.log(`\n📊 ${scenario.desc}`);
    
    const liquidityInfo: LiquidityInfo = {
      pair: 'ETH/USDT',
      availableLiquidity: scenario.liquidity,
      bidPrice: 3000,
      askPrice: 3005,
      timestamp: Date.now()
    };

    const result = await engine.placeOrder(
      'ETH/USDT',
      OrderSide.BUY,
      scenario.desired,
      3005,
      liquidityInfo
    );

    console.log('  Result:', {
      success: result.success,
      requestedAmount: scenario.desired,
      executedAmount: result.executedAmount,
      availableLiquidity: scenario.liquidity
    });
  }
}

async function demonstrateRetryLogic() {
  console.log('\n========================================');
  console.log('DEMO 3: Retry Logic & Error Handling');
  console.log('========================================\n');

  const config = {
    defaultSlippageTolerance: 0.001,
    maxRetries: 3,
    loopsPerMinute: 19,
    minTradeSize: 10,
    maxTradeSize: 10000
  };

  const engine = new TradingEngine(config);

  const liquidityInfo: LiquidityInfo = {
    pair: 'BNB/USDT',
    availableLiquidity: 100000,
    bidPrice: 500,
    askPrice: 505,
    timestamp: Date.now()
  };

  console.log('Attempting trade with very tight slippage tolerance (0.1%)...');
  
  const result = await engine.placeOrder(
    'BNB/USDT',
    OrderSide.BUY,
    100,
    500,
    liquidityInfo
  );

  console.log('\n📊 Result:', {
    success: result.success,
    executedAmount: result.executedAmount,
    executedPrice: result.executedPrice,
    error: result.error
  });
}

async function demonstrateLoopExecution() {
  console.log('\n========================================');
  console.log('DEMO 4: 19 Loops Per Minute');
  console.log('========================================\n');

  const config = {
    defaultSlippageTolerance: 0.005,
    maxRetries: 3,
    loopsPerMinute: 19,
    minTradeSize: 10,
    maxTradeSize: 10000
  };

  const engine = new TradingEngine(config);

  console.log('Starting continuous trading (will run 5 loops then stop)...');
  console.log('Expected interval: ~3.16 seconds per loop\n');

  let loopCount = 0;
  const maxLoops = 5;
  const loopTimes: number[] = [];
  let lastLoopTime = Date.now();

  engine.startContinuousTrading(async () => {
    loopCount++;
    const now = Date.now();
    const interval = now - lastLoopTime;
    loopTimes.push(interval);
    lastLoopTime = now;

    console.log(`Loop ${loopCount}: Interval = ${interval}ms`);

    if (loopCount >= maxLoops) {
      engine.stopContinuousTrading();
    }

    const pairs = ['BTC/USDT', 'ETH/USDT'];
    const orders = [];

    for (const pair of pairs) {
      const liquidity: LiquidityInfo = {
        pair,
        availableLiquidity: 50000 + Math.random() * 50000,
        bidPrice: 1000 + Math.random() * 100,
        askPrice: 1000 + Math.random() * 100,
        timestamp: Date.now()
      };

      orders.push({
        pair,
        side: Math.random() > 0.5 ? OrderSide.BUY : OrderSide.SELL,
        amount: 10 + Math.random() * 90,
        price: liquidity.bidPrice,
        liquidityInfo: liquidity
      });
    }

    return orders;
  });

  await new Promise(resolve => setTimeout(resolve, 20000));

  const avgInterval = loopTimes.slice(1).reduce((a, b) => a + b, 0) / (loopTimes.length - 1);
  const expectedInterval = (60 / 19) * 1000;
  
  console.log('\n📊 Loop Performance:');
  console.log(`  Expected interval: ${expectedInterval.toFixed(2)}ms (~3.16s)`);
  console.log(`  Average interval: ${avgInterval.toFixed(2)}ms`);
  console.log(`  Deviation: ${Math.abs(avgInterval - expectedInterval).toFixed(2)}ms`);
  console.log(`  Status: ${engine.getEngineStatus().isRunning ? 'Running' : 'Stopped'}`);
}

async function runAllDemos() {
  console.log('\n');
  console.log('╔════════════════════════════════════════════════════════════════╗');
  console.log('║         POUSEIDON BOT V2 - TRADING ENGINE CORE DEMO          ║');
  console.log('║              Atomic Execution & Order Management              ║');
  console.log('╚════════════════════════════════════════════════════════════════╝');

  await demonstrateAtomicExecution();
  await new Promise(resolve => setTimeout(resolve, 1000));

  await demonstrateDynamicSizing();
  await new Promise(resolve => setTimeout(resolve, 1000));

  await demonstrateRetryLogic();
  await new Promise(resolve => setTimeout(resolve, 1000));

  await demonstrateLoopExecution();

  console.log('\n╔════════════════════════════════════════════════════════════════╗');
  console.log('║                      DEMO COMPLETED                           ║');
  console.log('╚════════════════════════════════════════════════════════════════╝\n');
}

runAllDemos().catch(error => {
  console.error('Demo error:', error);
  process.exit(1);
});

/**
 * Demo and Usage Examples
 * Shows how to use the Liquidity & Arbitrage Engine
 */

import {
  LiquidityInfo,
  ArbitrageOpportunity,
  LogLevel
} from '../types/index';
import {
  LiquidityArbitrageEngine,
  logger
} from '../index';

// Set logger level
logger.setLevel(LogLevel.INFO);

/**
 * Example: Basic Usage
 */
export async function basicExample() {
  console.log('\n=== Basic Example ===\n');

  // Initialize engine with 10,000 USDT capital
  const engine = new LiquidityArbitrageEngine(10000);

  // Create mock liquidity data for USDT pairs
  const mockLiquidity: LiquidityInfo[] = [
    {
      pair: 'BTC/USDT',
      availableLiquidity: 50000,
      bidPrice: 42450,
      askPrice: 42460,
      timestamp: Date.now(),
      bidVolume: 25000,
      askVolume: 25000,
      depth: {
        bids: [
          [42450, 10000],
          [42440, 15000],
          [42430, 10000]
        ],
        asks: [
          [42460, 10000],
          [42470, 15000],
          [42480, 10000]
        ]
      }
    },
    {
      pair: 'ETH/USDT',
      availableLiquidity: 75000,
      bidPrice: 2245.50,
      askPrice: 2245.75,
      timestamp: Date.now(),
      bidVolume: 40000,
      askVolume: 35000,
      depth: {
        bids: [
          [2245.50, 20000],
          [2245.00, 20000],
          [2244.50, 20000]
        ],
        asks: [
          [2245.75, 15000],
          [2246.25, 20000],
          [2246.75, 15000]
        ]
      }
    },
    {
      pair: 'ADA/USDT',
      availableLiquidity: 100000,
      bidPrice: 0.9850,
      askPrice: 0.9860,
      timestamp: Date.now(),
      bidVolume: 50000,
      askVolume: 50000,
      depth: {
        bids: [
          [0.9850, 25000],
          [0.9840, 25000]
        ],
        asks: [
          [0.9860, 25000],
          [0.9870, 25000]
        ]
      }
    }
  ];

  // Update liquidity
  mockLiquidity.forEach(liq => engine.updateLiquidity(liq));

  // Detect opportunities
  const opportunities = engine.detectOpportunities();
  console.log(`Detected ${opportunities.length} opportunities`);

  // Analyze and rank
  const ranked = engine.analyzeAndRankOpportunities(opportunities);
  
  if (ranked.length > 0) {
    console.log('\nTop 3 Opportunities:');
    ranked.slice(0, 3).forEach((opp, i) => {
      console.log(`${i + 1}. ${opp.pair}`);
      console.log(`   Type: ${opp.type}`);
      console.log(`   Profit: ${opp.percentageProfit.toFixed(4)}%`);
      console.log(`   Confidence: ${opp.confidenceScore.toFixed(0)}/100`);
      console.log(`   Risk Level: ${opp.riskLevel}`);
    });
  }

  // Get status
  const status = engine.getStatus();
  console.log('\nEngine Status:');
  console.log(`  Running: ${status.isRunning}`);
  console.log(`  Capital: ${status.capitalState?.totalCapital.toFixed(2)} USDT`);
  console.log(`  Liquidity Pairs: ${status.liquidityPairs}`);

  // Get opportunity statistics
  const oppStats = engine.getOpportunityStats();
  console.log('\nOpportunity Statistics:');
  console.log(`  Total Detected: ${oppStats.totalDetected}`);
  console.log(`  High Confidence: ${oppStats.highConfidence}`);
  console.log(`  Average Profitability: ${oppStats.averageProfitability.toFixed(4)}%`);

  // Get liquidity statistics
  const liqStats = engine.getLiquidityStats();
  console.log('\nLiquidity Statistics:');
  console.log(`  Total Pairs: ${liqStats.totalPairs}`);
  console.log(`  Average Spread: ${liqStats.averageSpread.toFixed(4)}%`);
  console.log(`  Average Volatility: ${liqStats.averageVolatility.toFixed(4)}%`);

  return engine;
}

/**
 * Example: Continuous Trading Loop
 */
export async function continuousTradeExample() {
  console.log('\n=== Continuous Trading Example ===\n');

  const engine = new LiquidityArbitrageEngine(50000);

  // Simulate dynamic liquidity updates
  const liquidityUpdateFn = async (): Promise<LiquidityInfo[]> => {
    // In real implementation, this would fetch from exchange API
    const priceDelta = (Math.random() - 0.5) * 0.01; // Random price changes

    return [
      {
        pair: 'BTC/USDT',
        availableLiquidity: 50000 + Math.random() * 5000,
        bidPrice: 42450 + priceDelta,
        askPrice: 42460 + priceDelta,
        timestamp: Date.now(),
        bidVolume: 25000,
        askVolume: 25000
      },
      {
        pair: 'ETH/USDT',
        availableLiquidity: 75000 + Math.random() * 7500,
        bidPrice: 2245.50 + (priceDelta * 50),
        askPrice: 2245.75 + (priceDelta * 50),
        timestamp: Date.now(),
        bidVolume: 40000,
        askVolume: 35000
      }
    ];
  };

  // Start continuous monitoring for 5 seconds
  engine.startContinuous(liquidityUpdateFn, 60, 1000);

  // Wait 5 seconds then stop
  await new Promise(resolve => setTimeout(resolve, 5000));
  engine.stopContinuous();

  // Print final status
  const status = engine.getStatus();
  const stats = status.stats;
  
  console.log('\nFinal Statistics:');
  console.log(`  Initial Capital: ${stats.initialCapital.toFixed(2)} USDT`);
  console.log(`  Current Capital: ${stats.currentCapital.toFixed(2)} USDT`);
  console.log(`  Total Growth: ${stats.totalGrowth.toFixed(2)} USDT (${stats.growthRate.toFixed(2)}%)`);
  console.log(`  Average Loop Profit: ${stats.averageLoopProfit.toFixed(4)} USDT`);
}

/**
 * Example: Slippage Analysis
 */
export function slippageAnalysisExample() {
  console.log('\n=== Slippage Analysis Example ===\n');

  const engine = new LiquidityArbitrageEngine();

  const mockLiquidity: LiquidityInfo = {
    pair: 'BTC/USDT',
    availableLiquidity: 100000,
    bidPrice: 42450,
    askPrice: 42460,
    timestamp: Date.now(),
    depth: {
      bids: [
        [42450, 20000],
        [42440, 30000],
        [42430, 30000]
      ],
      asks: [
        [42460, 20000],
        [42470, 30000],
        [42480, 30000]
      ]
    }
  };

  engine.updateLiquidity(mockLiquidity);

  // Analyze slippage for different order sizes
  const orderSizes = [100, 500, 1000, 5000, 10000];
  console.log('Slippage Analysis for BTC/USDT:\n');

  orderSizes.forEach(size => {
    const slippage = engine['liquidityAnalyzer'].estimateSlippage('BTC/USDT', size);
    console.log(`Order Size: ${size.toFixed(2)} BTC`);
    console.log(`  Estimated Slippage: ${slippage.estimatedSlippage.toFixed(4)} USDT`);
    console.log(`  Slippage %: ${slippage.slippagePercentage.toFixed(4)}%`);
    console.log(`  Impacted Price: ${slippage.impactedPrice.toFixed(2)} USDT`);
    console.log(`  Time to Execute: ${slippage.timeToExecute}ms\n`);
  });
}

/**
 * Example: Capital Management and Reuse
 */
export async function capitalManagementExample() {
  console.log('\n=== Capital Management Example ===\n');

  const engine = new LiquidityArbitrageEngine(10000);

  // Add liquidity
  const mockLiquidity: LiquidityInfo[] = [
    {
      pair: 'BTC/USDT',
      availableLiquidity: 50000,
      bidPrice: 42450,
      askPrice: 42460,
      timestamp: Date.now()
    },
    {
      pair: 'ETH/USDT',
      availableLiquidity: 75000,
      bidPrice: 2245.50,
      askPrice: 2245.75,
      timestamp: Date.now()
    }
  ];

  mockLiquidity.forEach(liq => engine.updateLiquidity(liq));

  // Simulate multiple loops
  console.log('Simulating 3 trading loops...\n');

  for (let i = 0; i < 3; i++) {
    const opportunities = engine.detectOpportunities();
    const ranked = engine.analyzeAndRankOpportunities(opportunities);
    
    if (ranked.length > 0) {
      const loop = await engine.executeLoop(ranked.slice(0, 3));
      
      const status = engine.getStatus();
      const stats = status.stats;
      
      console.log(`Loop ${i + 1}:`);
      console.log(`  Profit: ${loop.totalProfit.toFixed(4)} USDT`);
      console.log(`  Success Rate: ${(loop.successRate * 100).toFixed(2)}%`);
      console.log(`  Total Capital: ${stats.currentCapital.toFixed(2)} USDT`);
      console.log(`  Total Growth: ${stats.growthRate.toFixed(4)}%\n`);
    }
  }
}

/**
 * Example: Opportunity Ranking
 */
export function opportunityRankingExample() {
  console.log('\n=== Opportunity Ranking Example ===\n');

  const engine = new LiquidityArbitrageEngine(100000);

  const mockLiquidity: LiquidityInfo[] = [
    {
      pair: 'BTC/USDT',
      availableLiquidity: 50000,
      bidPrice: 42450,
      askPrice: 42460,
      timestamp: Date.now()
    },
    {
      pair: 'ETH/USDT',
      availableLiquidity: 75000,
      bidPrice: 2245.50,
      askPrice: 2245.75,
      timestamp: Date.now()
    },
    {
      pair: 'SOL/USDT',
      availableLiquidity: 100000,
      bidPrice: 142.35,
      askPrice: 142.45,
      timestamp: Date.now()
    }
  ];

  mockLiquidity.forEach(liq => engine.updateLiquidity(liq));

  const opportunities = engine.detectOpportunities();
  const ranked = engine.analyzeAndRankOpportunities(opportunities);

  if (ranked.length > 0) {
    console.log('Top Ranked Opportunities:\n');
    ranked.slice(0, 5).forEach((opp, i) => {
      console.log(`Rank ${i + 1}:`);
      console.log(`  Pair: ${opp.pair}`);
      console.log(`  Score: ${opp.rankingScore.toFixed(2)}/100`);
      console.log(`  Profitability: ${opp.criteria.profitability.toFixed(2)}/100`);
      console.log(`  Risk-Adjusted Return: ${opp.criteria.riskAdjustedReturn.toFixed(2)}/100`);
      console.log(`  Liquidity: ${opp.criteria.liquidity.toFixed(2)}/100`);
      console.log(`  Execution Speed: ${opp.criteria.executionSpeed.toFixed(2)}/100\n`);
    });
  }
}

/**
 * Run all examples
 */
export async function runAllExamples() {
  try {
    await basicExample();
    await capitalManagementExample();
    slippageAnalysisExample();
    opportunityRankingExample();
    await continuousTradeExample();
    
    console.log('\n=== All Examples Completed ===\n');
  } catch (error) {
    logger.error('Example error', { error });
  }
}

// Run examples if this is the main module
if (require.main === module) {
  runAllExamples().catch(console.error);
}

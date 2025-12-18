# Quick Start Guide

## Installation

```bash
npm install
npm run build
```

## 5-Minute Tutorial

### Step 1: Initialize the Engine

```typescript
import { LiquidityArbitrageEngine } from './src/index';

// Create engine with 10,000 USDT initial capital
const engine = new LiquidityArbitrageEngine(10000);
```

### Step 2: Update Liquidity

```typescript
const liquidity = {
  pair: 'BTC/USDT',
  availableLiquidity: 50000,
  bidPrice: 42450,
  askPrice: 42460,
  timestamp: Date.now()
};

engine.updateLiquidity(liquidity);
```

### Step 3: Detect Opportunities

```typescript
const opportunities = engine.detectOpportunities();
console.log(`Found ${opportunities.length} opportunities`);
```

### Step 4: Analyze and Rank

```typescript
const ranked = engine.analyzeAndRankOpportunities(opportunities);

ranked.slice(0, 3).forEach((opp, i) => {
  console.log(`${i + 1}. ${opp.pair}`);
  console.log(`   Profit: ${opp.percentageProfit.toFixed(4)}%`);
  console.log(`   Confidence: ${opp.confidenceScore.toFixed(0)}/100`);
});
```

### Step 5: Execute Trade

```typescript
if (ranked.length > 0) {
  const loopState = await engine.executeLoop(ranked.slice(0, 5));
  console.log(`Profit: ${loopState.totalProfit}`);
  console.log(`Success Rate: ${(loopState.successRate * 100).toFixed(2)}%`);
}
```

## Common Patterns

### Pattern 1: One-Time Analysis

```typescript
// Single opportunity detection and ranking
const opportunities = engine.detectOpportunities();
const ranked = engine.analyzeAndRankOpportunities(opportunities);
const best = ranked[0];
console.log(`Best opportunity: ${best.pair} (+${best.percentageProfit}%)`);
```

### Pattern 2: Batch Processing

```typescript
// Process multiple pairs at once
const pairs = ['BTC/USDT', 'ETH/USDT', 'SOL/USDT'];

pairs.forEach(pair => {
  const liquidity = getLiquidityData(pair); // Your data source
  engine.updateLiquidity(liquidity);
});

const opportunities = engine.detectOpportunities();
```

### Pattern 3: Continuous Loop

```typescript
// Automatic continuous execution
engine.startContinuous(
  async () => {
    // Fetch liquidity from your source
    return await fetchLiquidityData();
  },
  60,  // Minimum confidence score
  1000 // Loop interval in ms
);

// Let it run...
await new Promise(resolve => setTimeout(resolve, 60000)); // 1 minute

engine.stopContinuous();
```

### Pattern 4: Capital Management

```typescript
// Track capital across loops
const status = engine.getStatus();
const stats = status.stats;

console.log(`Starting Capital: ${stats.initialCapital}`);
console.log(`Current Capital: ${stats.currentCapital}`);
console.log(`Growth: ${stats.growthRate.toFixed(2)}%`);
console.log(`Avg Profit/Loop: ${stats.averageLoopProfit}`);
```

### Pattern 5: Slippage Analysis

```typescript
// Analyze slippage for specific order size
const slippage = engine['liquidityAnalyzer'].estimateSlippage(
  'BTC/USDT',
  1000, // 1000 BTC order
  true  // Buy side
);

console.log(`Slippage: ${slippage.slippagePercentage.toFixed(4)}%`);
console.log(`Execution Time: ${slippage.timeToExecute}ms`);
```

## Configuration Examples

### Conservative Setup

```typescript
const engine = new LiquidityArbitrageEngine(10000);

// Lower position sizes
// Higher confidence threshold
const ranked = engine.analyzeAndRankOpportunities(
  opportunities,
  75 // Higher confidence threshold
);
```

### Aggressive Setup

```typescript
const engine = new LiquidityArbitrageEngine(100000);

// Higher capital, more positions
// Lower confidence threshold
const ranked = engine.analyzeAndRankOpportunities(
  opportunities,
  50 // Lower confidence threshold
);
```

### High Frequency Setup

```typescript
// Faster loops
engine.startContinuous(
  liquidityUpdateFn,
  60,
  500 // 500ms interval (2 loops/sec)
);
```

### Low Frequency Setup

```typescript
// Slower, more careful
engine.startContinuous(
  liquidityUpdateFn,
  70,
  5000 // 5 second interval (1 loop/5s)
);
```

## Debugging

### Enable Debug Logging

```typescript
import { logger, LogLevel } from './src/index';

logger.setLevel(LogLevel.DEBUG);

// Now all debug messages appear
```

### Check Engine Status

```typescript
const status = engine.getStatus();
console.log(JSON.stringify(status, null, 2));
```

### Analyze Opportunities

```typescript
const opps = engine.detectOpportunities();
console.log(`Opportunities: ${opps.length}`);

opps.forEach(opp => {
  console.log(`ID: ${opp.id}`);
  console.log(`  Type: ${opp.type}`);
  console.log(`  Profit: ${opp.percentageProfit}%`);
  console.log(`  Confidence: ${opp.confidenceScore}`);
});
```

### Track Capital

```typescript
const capital = engine['capitalManager'].getCurrentState();
console.log(`Total: ${capital.totalCapital}`);
console.log(`Available: ${capital.availableCapital}`);
console.log(`Allocated: ${capital.allocatedCapital}`);
console.log(`Active Positions: ${capital.activePositions.size}`);
```

### Check Liquidity

```typescript
const stats = engine.getLiquidityStats();
console.log(`Pairs Tracked: ${stats.totalPairs}`);
console.log(`Avg Spread: ${stats.averageSpread}%`);
console.log(`Avg Volatility: ${stats.averageVolatility}%`);
```

## Troubleshooting

### No Opportunities Detected

```typescript
// Check liquidity data
const liqStats = engine.getLiquidityStats();
if (liqStats.totalPairs === 0) {
  console.log('No liquidity data. Update with updateLiquidity()');
}

// Check spread/volatility
console.log(`Avg Spread: ${liqStats.averageSpread}%`);
if (liqStats.averageSpread > 1) {
  console.log('Spreads too wide, lower MIN_PROFIT_THRESHOLD');
}
```

### Low Success Rate

```typescript
// Check capital constraints
const capital = engine['capitalManager'].getCurrentState();
const utilization = (capital.allocatedCapital / capital.totalCapital) * 100;
console.log(`Capital utilization: ${utilization}%`);

// Check opportunity quality
const stats = engine.getOpportunityStats();
console.log(`Avg Profitability: ${stats.averageProfitability}%`);
console.log(`High Confidence: ${stats.highConfidence}`);
```

### Slippage Too High

```typescript
// Analyze impact
const slippage = engine['liquidityAnalyzer'].estimateSlippage('BTC/USDT', 1000);
console.log(`Slippage: ${slippage.slippagePercentage}%`);

// Check liquidity
const liq = engine['liquidityAnalyzer'].getLiquidityInfo('BTC/USDT');
console.log(`Available Liquidity: ${liq?.availableLiquidity}`);

// Solution: Reduce order size
```

## Next Steps

1. **Integration**: Connect to real exchange APIs
2. **Risk Management**: Add position limits and stop-losses
3. **Monitoring**: Set up alerts for good opportunities
4. **Optimization**: Fine-tune parameters for your market
5. **Testing**: Backtest with historical data

## Examples

Run the demo file:

```bash
npm run dev -- src/examples/demo.ts
```

This includes examples for:
- Basic usage
- Capital management
- Slippage analysis
- Opportunity ranking
- Continuous trading

# Pouseidon Bot v2 - Liquidity Detection & Arbitrage Engine

A comprehensive real-time liquidity analysis and arbitrage opportunity detection system for USDT trading pairs.

## Features

### 🔍 Real-time Liquidity Analysis
- **Real-time Monitoring**: Continuous liquidity tracking for USDT pairs
- **Depth Analysis**: Order book depth analysis with bid/ask tracking
- **Liquidity Metrics**: Comprehensive metrics including spreads, volatility, and price impact
- **Trend Analysis**: Historical tracking and trend detection
- **Slippage Estimation**: Accurate slippage forecasting for different order sizes

### 🎯 Arbitrage Detection
- **Spatial Arbitrage**: Identifies price differences across multiple liquidity points
- **Temporal Arbitrage**: Detects time-based price inefficiencies
- **Triangular Arbitrage**: Complex multi-leg arbitrage path detection
- **Cross-Exchange Arbitrage**: Opportunity detection across venues
- **Confidence Scoring**: Risk-adjusted opportunity scoring

### 📊 Opportunity Ranking & Prioritization
- **Multi-Criteria Ranking**: Scores based on:
  - Profitability
  - Risk-adjusted returns
  - Liquidity availability
  - Execution speed
  - Capital efficiency
- **Dynamic Filtering**: Filter opportunities by confidence, profitability, and execution time
- **Top Opportunities**: Automatic selection of best opportunities

### 💰 Micro-Lot Sizing
- **Liquidity-Based Sizing**: Automatically sizes trades based on available liquidity
- **Risk Management**: Position sizing respects risk tolerance and volatility
- **Kelly Criterion**: Optional optimal sizing using Kelly Criterion formula
- **Portfolio Pressure**: Scales sizes based on concurrent positions
- **Lot Size Brackets**: Pre-calculated size categories for different risk profiles

### 🔄 Capital Reuse Logic
- **Consecutive Loop Execution**: Seamless capital reuse across trading loops
- **Profit Reinvestment**: Automatic profit reallocation
- **Capital Efficiency**: Tracks utilization and growth
- **Predictive Analysis**: Forecasts next loop capital
- **Growth Tracking**: Detailed capital growth statistics

### ⚡ Auto-Adjustment Features
- **Dynamic Slippage Adjustment**: Adjusts expectations based on real execution
- **Volatility Scaling**: Automatically scales position sizes with market volatility
- **Liquidity Rebalancing**: Continuously rebalances based on liquidity changes
- **Risk Adaptation**: Adjusts strategy based on success rates

## Architecture

```
LiquidityArbitrageEngine (Main Orchestrator)
├── LiquidityAnalyzer (Real-time liquidity monitoring)
├── ArbitrageDetector (Opportunity detection & scoring)
├── MicroLotSizer (Position sizing)
└── CapitalManager (Capital tracking & reuse)
```

## Core Components

### LiquidityAnalyzer
Monitors real-time liquidity for trading pairs and provides:
- Liquidity metrics (spread, volatility, depth analysis)
- Price impact calculations
- Slippage estimation for specific order sizes
- Liquidity trend analysis
- Cache management

### ArbitrageDetector
Identifies and scores arbitrage opportunities:
- Multiple arbitrage types (spatial, temporal, triangular, cross-exchange)
- Confidence scoring based on liquidity and spreads
- Opportunity ranking by multiple criteria
- Filtering capabilities

### MicroLotSizer
Calculates optimal position sizes:
- Base size calculation from available capital
- Liquidity-based adjustments
- Volatility adjustments
- Kelly Criterion sizing
- Consecutive trade sizing with capital reuse
- Risk management constraints

### CapitalManager
Tracks and manages trading capital:
- Capital allocation and deallocation
- Loop-based tracking
- Profit reinvestment
- Growth statistics
- Reuse calculations

## Usage

### Basic Example

```typescript
import { LiquidityArbitrageEngine, LogLevel, logger } from 'pouseidon-bot-v2-liquidity';

// Set logger level
logger.setLevel(LogLevel.INFO);

// Initialize engine with 10,000 USDT
const engine = new LiquidityArbitrageEngine(10000);

// Update liquidity
const liquidity = {
  pair: 'BTC/USDT',
  availableLiquidity: 50000,
  bidPrice: 42450,
  askPrice: 42460,
  timestamp: Date.now(),
  bidVolume: 25000,
  askVolume: 25000,
  depth: {
    bids: [[42450, 10000], [42440, 15000]],
    asks: [[42460, 10000], [42470, 15000]]
  }
};

engine.updateLiquidity(liquidity);

// Detect opportunities
const opportunities = engine.detectOpportunities();

// Analyze and rank
const ranked = engine.analyzeAndRankOpportunities(opportunities);

// Execute trading loop
const loopState = await engine.executeLoop(ranked.slice(0, 5));
```

### Continuous Trading

```typescript
const liquidityUpdateFn = async () => {
  // Fetch from exchange API
  return [/* LiquidityInfo[] */];
};

// Start continuous monitoring
engine.startContinuous(liquidityUpdateFn, 60, 1000); // Min confidence: 60, Loop interval: 1s

// ... trading runs in background ...

// Stop when done
engine.stopContinuous();

// Get final statistics
const status = engine.getStatus();
console.log(status.stats);
```

### Slippage Analysis

```typescript
const slippage = engine['liquidityAnalyzer'].estimateSlippage('BTC/USDT', 1000);
console.log(`Estimated slippage: ${slippage.slippagePercentage}%`);
console.log(`Impacted price: ${slippage.impactedPrice}`);
```

### Capital Management

```typescript
const capitalState = engine['capitalManager'].getCurrentState();
console.log(`Available capital: ${capitalState.availableCapital}`);
console.log(`Allocated capital: ${capitalState.allocatedCapital}`);

const stats = engine['capitalManager'].getCapitalGrowthStats();
console.log(`Growth rate: ${stats.growthRate}%`);
console.log(`Average loop profit: ${stats.averageLoopProfit}`);
```

## API Reference

### LiquidityArbitrageEngine

#### Methods

- `updateLiquidity(liquidityInfo: LiquidityInfo): void` - Update liquidity data for a pair
- `detectOpportunities(): ArbitrageOpportunity[]` - Detect all arbitrage opportunities
- `analyzeAndRankOpportunities(opportunities, minConfidence?): RankedOpportunity[]` - Rank opportunities
- `executeLoop(opportunities: RankedOpportunity[]): Promise<LoopState>` - Execute a trading loop
- `startContinuous(updateFn, minConfidence?, intervalMs?): void` - Start continuous monitoring
- `stopContinuous(): void` - Stop continuous monitoring
- `getStatus()` - Get current engine status
- `getOpportunityStats()` - Get opportunity statistics
- `getLiquidityStats()` - Get liquidity statistics
- `reset(): void` - Reset engine state

### LiquidityAnalyzer

#### Methods

- `analyzeLiquidity(liquidityInfo): LiquidityMetrics` - Analyze liquidity for a pair
- `estimateSlippage(pair, orderSize, isBuy?): SlippageEstimate` - Estimate slippage
- `isSufficientLiquidity(pair, orderSize, maxSlippage?): boolean` - Check liquidity
- `getLiquidityInfo(pair): LiquidityInfo | null` - Get current liquidity
- `getLiquidityMetrics(pair): LiquidityMetrics | null` - Get metrics
- `getLiquidityTrend(pair, periodCount?): TrendInfo` - Get trend analysis
- `clearCache(pair): void` - Clear cache for pair
- `getCacheStats()` - Get cache statistics

### ArbitrageDetector

#### Methods

- `detectSpatialArbitrage(pair, liquidityPoints): ArbitrageOpportunity[]` - Detect spatial arbs
- `detectTemporalArbitrage(pair, current, previous): ArbitrageOpportunity | null` - Detect temporal arbs
- `detectTriangularArbitrage(basePair, liquidityMap): ArbitrageOpportunity[]` - Detect triangular arbs
- `rankOpportunities(opportunities): RankedOpportunity[]` - Rank by multiple criteria
- `filterByConfidence(opportunities, minScore): ArbitrageOpportunity[]` - Filter by confidence
- `filterByProfitability(opportunities, minProfit): ArbitrageOpportunity[]` - Filter by profit
- `getTopOpportunities(opportunities, limit?): RankedOpportunity[]` - Get top N

### MicroLotSizer

#### Methods

- `calculateMicroLot(opportunity, liquidity, capital, volatility?): MicroLotCalculation` - Calculate optimal size
- `calculateConsecutiveLotSizes(opportunities, capital, liquidityMap): Map<string, number>` - Calculate with reuse
- `calculateCapitalReuse(capitalState, profit, successRate): number` - Calculate reusable capital
- `calculateRiskAdjustedSize(desiredSize, stopLoss, maxRisk): number` - Size with risk limits
- `scaleLotSizesByPressure(size, positions, maxPositions?): number` - Scale by portfolio pressure
- `calculateKellyCriterion(winRate, avgWin, avgLoss): number` - Kelly sizing
- `getLotSizeBrackets(liquidity)` - Get size categories
- `validateLotSize(size, liquidity, minSize?)` - Validate size

### CapitalManager

#### Methods

- `initializeCapital(totalCapital): CapitalState` - Initialize capital
- `allocateCapital(state, amount, positionId): CapitalState` - Allocate for trade
- `deallocateCapital(state, positionId, returnAmount): CapitalState` - Close position
- `reuseCapitalForNextLoop(state, profit, reinvestRate?): CapitalState` - Reuse profit
- `recordLoopCompletion(loopId, capitalBefore, results): LoopState` - Record loop
- `calculateOptimalAllocation(state, targets, risk?): number` - Calculate allocation
- `getRecentSuccessRate(period?): number` - Get success rate
- `getCapitalGrowthStats()` - Get statistics
- `predictNextLoopCapital(method?): number` - Forecast capital
- `getCurrentState(): CapitalState | null` - Get current state

## Types

### Core Types

```typescript
interface LiquidityInfo {
  pair: string;
  availableLiquidity: number;
  bidPrice: number;
  askPrice: number;
  timestamp: number;
  bidVolume?: number;
  askVolume?: number;
  depth?: LiquidityDepth;
}

interface ArbitrageOpportunity {
  id: string;
  type: ArbitrageType;
  pair: string;
  sourcePrice: number;
  targetPrice: number;
  priceDifference: number;
  percentageProfit: number;
  confidenceScore: number;
  timestamp: number;
  estimatedSlippage: number;
  potentialProfit: number;
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH';
  estimatedExecutionTime: number;
  microLotSize?: number;
  capitalRequired?: number;
}

interface RankedOpportunity extends ArbitrageOpportunity {
  rankingScore: number;
  ranking: number;
  criteria: RankingCriteria;
}

interface CapitalState {
  totalCapital: number;
  availableCapital: number;
  allocatedCapital: number;
  activePositions: Map<string, number>;
  reusableCapital: number;
}

interface LoopState {
  loopId: string;
  startTime: number;
  opportunities: ArbitrageOpportunity[];
  executedTrades: TradeResult[];
  capitalBefore: CapitalState;
  capitalAfter?: CapitalState;
  totalProfit: number;
  successRate: number;
}
```

## Configuration

### Tuning Parameters

Key parameters that can be adjusted:

```typescript
// In LiquidityAnalyzer
const MIN_PROFIT_THRESHOLD = 0.05; // 0.05% minimum profit

// In ArbitrageDetector
private readonly MIN_PROFIT_THRESHOLD = 0.05;
private readonly MAX_EXECUTION_TIME = 10000;

// In MicroLotSizer
private readonly MIN_LOT_SIZE = 10;
private readonly DEFAULT_RISK_PER_TRADE = 0.02; // 2%
private readonly LIQUIDITY_SAFETY_FACTOR = 0.5; // 50%

// In CapitalManager
private readonly MAX_HISTORY_SIZE = 100;
```

## Performance Considerations

- **Memory**: History is limited to prevent unbounded growth
- **Real-time**: Designed for continuous monitoring with configurable loop intervals
- **Accuracy**: Uses depth analysis when available, falls back to spread-based estimates
- **Efficiency**: Capital reuse minimizes idle cash

## Testing

Run examples:

```bash
npm install
npm run dev -- src/examples/demo.ts
```

## Error Handling

The engine gracefully handles:
- Insufficient capital for trades
- Missing liquidity data
- API failures during continuous trading
- Trade execution failures with detailed error logging

## Logging

Control verbosity with LogLevel:

```typescript
import { logger, LogLevel } from 'pouseidon-bot-v2-liquidity';

logger.setLevel(LogLevel.DEBUG);   // Very verbose
logger.setLevel(LogLevel.INFO);    // Standard
logger.setLevel(LogLevel.WARN);    // Only warnings
logger.setLevel(LogLevel.ERROR);   // Only errors
```

## Contributing

Guidelines for extending the engine:

1. Add new arbitrage types to `ArbitrageDetector`
2. Extend ranking criteria in `ArbitrageDetector.calculateRankingCriteria`
3. Add custom sizing strategies to `MicroLotSizer`
4. Implement real exchange APIs in place of mock functions

## License

MIT

## Disclaimer

This is a simulation and educational tool. Actual trading requires:
- Real exchange API integration
- Proper risk management
- Regulatory compliance
- Capital adequacy

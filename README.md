# Pouseidon Bot v2 - Trading Engine Core

A high-performance trading engine with strict atomic execution for cryptocurrency trading, specifically optimized for USDT pair trading.

## Features

### ✅ Atomic Execution
- **All-or-Nothing Transactions**: Ensures trades are either fully executed or completely rolled back
- **No Partial Fills**: Prevents incomplete order execution
- **Transaction Safety**: Automatic rollback on failure

### ✅ Order Management
- Complete order lifecycle management
- Order validation before execution
- Status tracking (PENDING, VALIDATING, EXECUTING, COMPLETED, FAILED, ROLLED_BACK)
- Order history and analytics

### ✅ USDT Pair Trading
- Optimized for USDT trading pairs
- Minimal slippage tolerance (configurable, default: 0.5%)
- Real-time slippage validation

### ✅ Dynamic Trade Sizing
- Automatic trade size calculation based on available liquidity
- Liquidity utilization factor (default: 80%)
- Respects min/max trade size constraints
- Prevents market impact from oversized orders

### ✅ Robust Error Handling
- Exponential backoff retry strategy
- Configurable retry attempts (default: 3)
- Graceful failure handling
- Comprehensive logging

### ✅ High-Frequency Trading Support
- **19 loops per minute** (~3.16 seconds per loop)
- Precise timing control
- Concurrent order execution
- Performance monitoring

## Architecture

```
src/
├── core/
│   ├── TradingEngine.ts       # Main trading engine orchestrator
│   ├── AtomicExecutor.ts      # Atomic transaction execution
│   ├── OrderManager.ts        # Order lifecycle management
│   ├── OrderValidator.ts      # Pre-execution validation
│   ├── TradeSizeCalculator.ts # Dynamic trade sizing
│   └── RetryHandler.ts        # Retry logic with backoff
├── types/
│   └── index.ts               # TypeScript type definitions
├── utils/
│   └── logger.ts              # Structured logging
└── index.ts                   # Entry point & example usage
```

## Installation

```bash
npm install
```

## Configuration

```typescript
const config = {
  defaultSlippageTolerance: 0.005,  // 0.5% slippage tolerance
  maxRetries: 3,                     // Maximum retry attempts
  loopsPerMinute: 19,                // Trading loop frequency
  minTradeSize: 10,                  // Minimum trade size (USDT)
  maxTradeSize: 10000                // Maximum trade size (USDT)
};
```

## Usage

### Basic Order Placement

```typescript
import { TradingEngine } from './core/TradingEngine';
import { OrderSide } from './types';

const engine = new TradingEngine(config);

const liquidityInfo = {
  pair: 'BTC/USDT',
  availableLiquidity: 100000,
  bidPrice: 50000,
  askPrice: 50050,
  timestamp: Date.now()
};

const result = await engine.placeOrder(
  'BTC/USDT',
  OrderSide.BUY,
  100,        // Desired amount
  50000,      // Price
  liquidityInfo
);

if (result.success) {
  console.log('Trade executed:', result.executedAmount, 'at', result.executedPrice);
}
```

### Continuous Trading Loop

```typescript
engine.startContinuousTrading(async () => {
  // Return array of orders to execute
  return [
    {
      pair: 'BTC/USDT',
      side: OrderSide.BUY,
      amount: 100,
      price: 50000,
      liquidityInfo: await getLiquidityInfo('BTC/USDT')
    }
  ];
});

// Stop trading
engine.stopContinuousTrading();
```

## Key Components

### Atomic Executor
Ensures all-or-nothing execution:
- Validates order before execution
- Executes trade transaction
- Validates slippage tolerance
- Verifies full fill (no partial execution)
- Automatic rollback on any failure

### Order Validator
Pre-execution checks:
- Trading pair validation (USDT pairs only)
- Amount range validation
- Price validation
- Slippage tolerance validation
- Liquidity sufficiency check

### Trade Size Calculator
Dynamic sizing:
- Calculates optimal trade size based on liquidity
- Respects min/max constraints
- Applies liquidity utilization factor
- Prevents market impact

### Retry Handler
Robust error recovery:
- Exponential backoff strategy
- Configurable retry attempts
- Intelligent error classification
- Prevents cascading failures

## Performance Characteristics

- **Loop Frequency**: 19 loops/minute (3.16s interval)
- **Execution Time**: ~50ms per trade (simulated)
- **Concurrent Execution**: Supports parallel order processing
- **Slippage Tolerance**: 0.5% default (configurable)
- **Liquidity Utilization**: 80% safety factor

## Monitoring

Check engine status:

```typescript
const status = engine.getEngineStatus();
console.log({
  isRunning: status.isRunning,
  activeOrders: status.activeOrders,
  completedOrders: status.completedOrders,
  failedOrders: status.failedOrders,
  activeTransactions: status.activeTransactions
});
```

## Error Handling

All operations include:
- Try-catch blocks for error isolation
- Automatic rollback on failure
- Detailed error logging
- Graceful degradation
- No silent failures

## Testing

```bash
npm run dev    # Run development mode with example
npm run build  # Build production bundle
npm start      # Run production bundle
```

## Acceptance Criteria Status

✅ **Atomic execution prevents partial fills**
- Implemented in `AtomicExecutor.ts`
- Validates full fill before completion
- Automatic rollback on partial fill

✅ **Trade sizing adapts to liquidity automatically**
- Implemented in `TradeSizeCalculator.ts`
- Dynamic calculation based on available liquidity
- Respects 80% utilization factor

✅ **Loop execution meets 19/minute target**
- Implemented in `TradingEngine.ts`
- Precise timing: 3.16 seconds per loop
- Performance monitoring included

✅ **Failed trades are safely rolled back**
- Implemented in `AtomicExecutor.ts`
- Transaction tracking and cleanup
- No orphaned transactions

## License

MIT

# Technical Documentation - Pouseidon Bot v2 Trading Engine

## System Architecture

### Overview
The Pouseidon Bot v2 Trading Engine is built on a modular architecture with strict separation of concerns. Each component has a single, well-defined responsibility.

### Component Diagram

```
┌─────────────────────────────────────────────────────────┐
│                    TradingEngine                        │
│  (Orchestrator & Main Entry Point)                      │
└───────────┬─────────────────────────────────────────────┘
            │
            ├──► OrderManager
            │    └─ Order Lifecycle Management
            │    └─ History Tracking
            │    └─ Order Querying
            │
            ├──► OrderValidator
            │    └─ Pre-execution Validation
            │    └─ Slippage Checking
            │    └─ Constraint Verification
            │
            ├──► TradeSizeCalculator
            │    └─ Dynamic Size Calculation
            │    └─ Liquidity Analysis
            │    └─ Risk Management
            │
            ├──► AtomicExecutor
            │    └─ Transaction Management
            │    └─ Execution & Rollback
            │    └─ Atomicity Guarantee
            │
            └──► RetryHandler
                 └─ Exponential Backoff
                 └─ Error Classification
                 └─ Retry Strategy
```

## Core Concepts

### 1. Atomic Execution

**Definition**: A transaction is either fully executed or not executed at all. No partial states are allowed.

**Implementation**:
- Each order execution is wrapped in a transaction context
- Pre-execution validation ensures viability
- Post-execution validation verifies full fill
- Any failure triggers automatic rollback
- Transaction state is tracked in `activeTransactions` Map

**Guarantee**: 
```typescript
if (result.executedAmount !== order.amount) {
  throw new Error('Partial fill detected - atomic execution requires full fill');
}
```

### 2. Dynamic Trade Sizing

**Purpose**: Adjust order size based on available market liquidity to minimize slippage and market impact.

**Algorithm**:
```typescript
optimalSize = min(
  desiredAmount,
  availableLiquidity * 0.8,  // 80% utilization factor
  maxTradeSize
)
optimalSize = max(optimalSize, minTradeSize)
```

**Benefits**:
- Prevents oversized orders that could move the market
- Maintains liquidity buffer for stability
- Ensures orders stay within configured constraints

### 3. Slippage Management

**Tolerance**: Default 0.5% (configurable)

**Validation**:
```typescript
slippage = |executedPrice - expectedPrice| / expectedPrice
isValid = slippage ≤ slippageTolerance
```

**Behavior**:
- Orders exceeding slippage tolerance are rejected
- Rejection triggers rollback
- Can be retried with updated price

### 4. Retry Strategy

**Type**: Exponential Backoff

**Parameters**:
- Initial delay: 100ms
- Max delay: 2000ms
- Backoff multiplier: 2x
- Max retries: 3 (configurable)

**Delay Calculation**:
```
Attempt 1: 100ms
Attempt 2: 200ms
Attempt 3: 400ms
```

## Data Flow

### Order Placement Flow

```
1. User calls placeOrder()
   ↓
2. TradeSizeCalculator.calculateOptimalTradeSize()
   ↓
3. OrderManager.createOrder()
   ↓
4. RetryHandler.executeTradeWithRetry()
   ↓
5. AtomicExecutor.executeAtomic()
   ├─► OrderValidator.validate()
   ├─► executeTradeTransaction()
   ├─► OrderValidator.validateSlippage()
   └─► Check full fill
   ↓
6. Success → Complete Order
   Failure → Rollback & Return Error
```

### Continuous Trading Loop

```
┌─────────────────────────────────────────┐
│  Start Loop                             │
│  (19 loops/minute = 3.16s interval)     │
└────────────┬────────────────────────────┘
             ↓
┌────────────────────────────────────────┐
│  Call getOrdersFn()                    │
│  (User-provided order generation)      │
└────────────┬───────────────────────────┘
             ↓
┌────────────────────────────────────────┐
│  Execute all orders in parallel        │
│  (Promise.all)                         │
└────────────┬───────────────────────────┘
             ↓
┌────────────────────────────────────────┐
│  Calculate loop duration               │
│  Wait for remaining interval time      │
└────────────┬───────────────────────────┘
             ↓
┌────────────────────────────────────────┐
│  Repeat (while isRunning = true)       │
└────────────────────────────────────────┘
```

## Performance Characteristics

### Timing Analysis

**Loop Frequency**: 19 loops/minute
- Interval: 60,000ms / 19 = 3,157.89ms (~3.16 seconds)
- Implementation: Compensates for execution time to maintain exact interval

**Execution Time**:
- Order validation: ~1ms
- Trade size calculation: ~1ms
- Order creation: ~1ms
- Trade execution (simulated): ~50ms
- Total per order: ~53ms

**Throughput**:
- Single order: ~18.87 orders/second
- Per loop (parallel execution): Limited by slowest order
- Practical: ~2-5 orders per loop recommended

### Memory Usage

**Order Storage**:
- Active orders: Map structure (O(1) access)
- Order history: Array (append-only)
- Transaction tracking: Map structure

**Typical Memory Footprint**:
- Per order: ~500 bytes
- 1000 active orders: ~500 KB
- 10000 history entries: ~5 MB

## Error Handling Strategy

### Error Categories

1. **Validation Errors** (Non-retryable)
   - Invalid pair
   - Invalid amount/price
   - Insufficient liquidity
   - Action: Immediate rejection

2. **Execution Errors** (Retryable)
   - Network timeout
   - Temporary unavailability
   - Rate limiting
   - Action: Retry with backoff

3. **Slippage Errors** (Conditional retry)
   - Slippage exceeds tolerance
   - Action: Rollback, can retry with new price

4. **System Errors** (Non-retryable)
   - Out of memory
   - Invalid state
   - Action: Log and fail gracefully

### Rollback Mechanism

**Trigger Conditions**:
- Validation failure
- Execution failure
- Slippage exceeded
- Partial fill detected

**Rollback Steps**:
1. Mark order status as ROLLED_BACK
2. Remove from active transactions
3. Log rollback event
4. Clean up resources
5. Return error result

## Security Considerations

### Order Validation

**Pre-execution Checks**:
- Pair validation (USDT only)
- Amount bounds checking
- Price sanity checking
- Liquidity sufficiency

**Slippage Protection**:
- Configurable tolerance
- Real-time validation
- Automatic rejection on breach

### Transaction Safety

**Atomic Guarantees**:
- No partial fills allowed
- All-or-nothing execution
- Automatic rollback
- Transaction isolation

### Resource Limits

**Configured Limits**:
- Min trade size: 10 USDT (prevents dust orders)
- Max trade size: 10,000 USDT (prevents oversized orders)
- Max retries: 3 (prevents infinite loops)
- Liquidity utilization: 80% (market impact protection)

## Monitoring & Observability

### Logging Levels

**DEBUG**: Detailed execution flow
**INFO**: Standard operations (default)
**WARN**: Recoverable issues
**ERROR**: Failures and exceptions

### Key Metrics

**Available via getEngineStatus()**:
- isRunning: Boolean
- activeOrders: Number
- completedOrders: Number
- failedOrders: Number
- activeTransactions: Number

### Log Context

All logs include contextual data:
```typescript
logger.info('Message', {
  orderId: '...',
  pair: '...',
  amount: 100,
  timestamp: Date.now()
});
```

## Testing Recommendations

### Unit Testing

Test each component in isolation:
- OrderValidator: Validation logic
- TradeSizeCalculator: Size calculation algorithms
- RetryHandler: Backoff timing
- AtomicExecutor: Transaction management

### Integration Testing

Test component interactions:
- End-to-end order flow
- Error propagation
- Rollback scenarios
- Concurrent execution

### Performance Testing

Measure system characteristics:
- Loop timing accuracy
- Order throughput
- Memory usage over time
- Error recovery speed

### Load Testing

Stress test the system:
- Multiple concurrent orders
- High-frequency order submission
- Network failure simulation
- Resource exhaustion scenarios

## Extension Points

### Custom Liquidity Providers

Implement custom liquidity fetching:
```typescript
async function getLiquidityInfo(pair: string): Promise<LiquidityInfo> {
  // Your implementation
}
```

### Custom Retry Strategies

Override retry behavior:
```typescript
retryHandler.updateStrategy({
  maxRetries: 5,
  initialDelayMs: 200,
  maxDelayMs: 5000
});
```

### Custom Order Generation

Implement trading strategy:
```typescript
engine.startContinuousTrading(async () => {
  // Your strategy implementation
  return orders;
});
```

## Future Enhancements

### Planned Features

1. **Position Management**
   - Track open positions
   - P&L calculation
   - Risk metrics

2. **Advanced Order Types**
   - Stop-loss orders
   - Take-profit orders
   - Trailing stops

3. **Multi-exchange Support**
   - Abstract exchange interface
   - Routing logic
   - Arbitrage detection

4. **Risk Management**
   - Position sizing
   - Portfolio limits
   - Exposure tracking

5. **Performance Optimization**
   - Connection pooling
   - Order batching
   - Cache optimization

## Troubleshooting

### Common Issues

**Issue**: Loop timing drift
**Solution**: Check system load, reduce orders per loop

**Issue**: High failure rate
**Solution**: Adjust slippage tolerance, check liquidity

**Issue**: Memory growth
**Solution**: Call clearCompletedOrders() periodically

**Issue**: Slow execution
**Solution**: Optimize liquidity fetching, reduce validation overhead

## References

- [README.md](README.md) - General overview
- [QUICKSTART.md](QUICKSTART.md) - Getting started guide
- [src/types/index.ts](src/types/index.ts) - Type definitions
- [src/core/TradingEngine.ts](src/core/TradingEngine.ts) - Main implementation

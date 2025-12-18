# Pouseidon Bot v2 — Risk Management & Safety Monitoring

This repository now includes a self-contained risk management / safety monitoring library intended to be embedded into **Pouseidon Bot v2**.

It implements:
- Wallet balance monitoring + alert hooks
- Capital safety validation before each trade
- Slippage threshold enforcement
- Transaction fee estimation + caps
- Atomic execution failure detection + recovery hooks
- Circuit breaker logic (halts trading on anomalies)
- Failed transaction logging + retry queue
- Balance reconciliation checks

All safety checks and state transitions are written to an append-only **JSONL audit log** under `var/audit.jsonl`.

## Layout
- `lib/` – implementation (dependency-free Node.js CommonJS)
- `var/` – runtime state/logs (gitignored)

## Quick usage (example)

```js
const {
  RiskManager,
  CircuitBreaker,
  WalletBalanceMonitor,
  CapitalSafetyValidator,
  SlippageEnforcer,
  FeeManager,
  BalanceReconciler,
  AtomicExecutor,
  FileFailedTxStore,
  RetryQueue,
  ConsoleAlertSink,
} = require('./lib');

// Inject your chain/wallet/tx adapters into these components.
```

The library is adapter-based: you provide providers/adapters with these methods:

- **Wallet provider**: `getBalances() -> Promise<object|Map<string,bigint>>`
- **Fee provider**: `estimateFee(txRequest) -> Promise<bigint>`
- **Tx provider**: `sendTransaction(txRequest) -> Promise<string>` and `waitForReceipt(txHash) -> Promise<{status:'success'|'failed', ...}>`

All validations and anomalies are recorded to `var/audit.jsonl`, and serious violations trip the **CircuitBreaker** (safe shutdown / trading halt).

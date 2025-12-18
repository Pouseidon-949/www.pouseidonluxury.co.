# Audit log events

The audit log (`var/audit.jsonl`) is JSON Lines (one JSON object per line).

## Common fields
- `ts` – ISO timestamp
- `service`, `env`
- `level` – `info` | `warn` | `error`
- `type` – event type
- `data` – structured context (BigInt values are serialized as strings)

## Notable event types

### Circuit breaker
- `circuit_breaker.tripped`
- `circuit_breaker.reset`
- `circuit_breaker.failure_recorded`

### Wallet monitoring
- `wallet_monitor.baseline_set`
- `wallet_monitor.checked`
- `alert.wallet_balance_violation`

### Capital safety
- `capital_safety.passed`
- `capital_safety.violation`

### Slippage
- `slippage.min_out_computed`
- `slippage.quote_passed`
- `slippage.execution_passed`

### Fees
- `fees.estimated`
- `fees.cap_ok`
- `fees.cap_exceeded`

### Atomic execution
- `atomic_exec.sequence_start`
- `atomic_exec.step_sent`
- `atomic_exec.step_failed`
- `atomic_exec.recovery_start`

### Failed tx + retry
- `failed_tx.recorded`
- `retry_queue.enqueued`
- `retry_queue.succeeded`
- `retry_queue.exhausted`

### Balance reconciliation
- `balance_reconcile.checked`
- `balance_reconcile.mismatch`
- `balance_reconcile.passed`

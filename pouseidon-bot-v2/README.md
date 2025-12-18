# Pouseidon Bot v2 – Compounding Mechanism & Profit Management

This folder contains a self-contained **profit tracking + compounding** module that enforces:

- **Per-loop profit tracking** (PnL recorded after each bot loop)
- **Automatic compounding** (capital is updated immediately after each trade)
- **4-day compounding cycles** (time-based cycle closure)
- **10% profit take stop target** (cycle closes early when reached)
- **Profit withdrawal + reinvestment split** at each cycle close
- **Time-based milestone tracking** (daily snapshots)
- **Exponential growth projection** utilities

## Usage

```js
const { ProfitManager } = require('./pouseidon-bot-v2');

const pm = new ProfitManager({
  initialCapital: 1000,
  cycleDurationDays: 4,
  profitTargetPercent: 0.10,
  withdrawPercentOfProfit: 0.25, // optional
});

// Record one completed trade/loop
pm.recordLoop({ pnl: 12.5, timestamp: new Date() });

// Optional: enforce time-based closures even if the bot is idle
pm.evaluate(Date.now());

console.log(pm.getStatus());
```

## Core behaviors

- **Compounding after each loop**: `currentCapital` is updated on every `recordLoop/recordTrade` call.
- **10% stop target**: if `cyclePnL >= startingCapital * 0.10`, the cycle is closed with reason `profit-target`.
- **4-day enforcement**: if `now >= cycleStart + 4 days`, the cycle is closed with reason `duration`.
- **Withdrawal + reinvestment**: on cycle close, profits are split:
  - `withdrawnAmount = profit * withdrawPercentOfProfit`
  - `reinvestedAmount = profit - withdrawnAmount`
  - the next cycle starts with `startingCapital + reinvestedAmount` (capital efficiency).

## Exponential growth monitoring

```js
const { projectExponentialGrowth } = require('./pouseidon-bot-v2');

const projection = projectExponentialGrowth({
  startingCapital: 1000,
  profitTargetPercent: 0.10,
  cycles: 10,
  withdrawPercentOfProfit: 0.25,
});

console.table(projection);
```

## Example

```bash
node pouseidon-bot-v2/examples/simulate.js
```

## Tests

```bash
node pouseidon-bot-v2/__tests__/profitManager.test.js
```

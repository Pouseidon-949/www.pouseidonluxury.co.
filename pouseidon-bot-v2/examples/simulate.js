'use strict';

const { ProfitManager, projectExponentialGrowth, constants } = require('..');

function run() {
  const start = Date.now();

  const pm = new ProfitManager({
    initialCapital: 1000,
    cycleDurationDays: 4,
    profitTargetPercent: 0.1,
    withdrawPercentOfProfit: 0.25,
    onCycleClosed: (cycle) => {
      // In a real bot, this is where you'd:
      // - trigger withdrawals
      // - rebalance position sizing for the next cycle
      // - persist stats to DB
      console.log('CYCLE CLOSED:', cycle.closeReason, {
        cycleId: cycle.id,
        pnl: cycle.realizedPnl,
        withdrawn: cycle.withdrawnAmount,
        reinvested: cycle.reinvestedAmount,
        nextCapital: cycle.startingCapital + cycle.reinvestedAmount,
      });
    },
  });

  // 3 profitable loops within the same cycle → compounds after each loop.
  pm.recordLoop({ pnl: 30, timestamp: start + 10_000 });
  pm.recordLoop({ pnl: 40, timestamp: start + 20_000 });
  pm.recordLoop({ pnl: 50, timestamp: start + 30_000 }); // hits 10% target → closes cycle

  // Next trade occurs 5 days later → prior cycle would expire; evaluate closes if needed.
  pm.recordLoop({ pnl: 10, timestamp: start + 5 * constants.MS_PER_DAY });

  console.log('STATUS:', pm.getStatus());

  console.table(
    projectExponentialGrowth({
      startingCapital: 1000,
      profitTargetPercent: 0.1,
      cycles: 5,
      withdrawPercentOfProfit: 0.25,
    }),
  );
}

if (require.main === module) {
  run();
}

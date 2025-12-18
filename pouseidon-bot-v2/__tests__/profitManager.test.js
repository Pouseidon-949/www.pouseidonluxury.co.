'use strict';

const assert = require('node:assert/strict');
const { ProfitManager, constants } = require('..');

function ms(days) {
  return days * constants.MS_PER_DAY;
}

(function testCompoundsAfterEachLoop() {
  const start = Date.now();
  const pm = new ProfitManager({
    initialCapital: 100,
    cycleDurationDays: 4,
    // Keep target high so the cycle doesn't close during this test.
    profitTargetPercent: 0.5,
  });

  pm.recordLoop({ pnl: 10, timestamp: start + 1000 });
  assert.equal(pm.history.length, 0);
  assert.equal(pm.getStatus().activeCycle.currentCapital, 110);

  pm.recordLoop({ pnl: 11, timestamp: start + 2000 });
  assert.equal(pm.getStatus().activeCycle.currentCapital, 121);
})();

(function testProfitTargetClosesCycle() {
  const start = Date.now();
  const pm = new ProfitManager({
    initialCapital: 1000,
    cycleDurationDays: 4,
    profitTargetPercent: 0.1,
    withdrawPercentOfProfit: 0,
  });

  pm.recordLoop({ pnl: 60, timestamp: start + 1000 });
  assert.equal(pm.history.length, 0);

  pm.recordLoop({ pnl: 40, timestamp: start + 2000 });
  assert.equal(pm.history.length, 1);
  assert.equal(pm.history[0].closeReason, 'profit-target');

  // Reinvested profits become the next cycle's starting capital.
  assert.equal(pm.getStatus().activeCycle.startingCapital, 1100);
  assert.equal(pm.getStatus().activeCycle.realizedPnl, 0);
})();

(function testDurationClosesCycle() {
  const start = Date.now();
  const pm = new ProfitManager({
    initialCapital: 500,
    cycleDurationDays: 4,
    profitTargetPercent: 0.1,
  });

  pm.evaluate(start + ms(4) + 1);
  assert.equal(pm.history.length, 1);
  assert.equal(pm.history[0].closeReason, 'duration');
})();

(function testMilestonesTracked() {
  const start = Date.now();
  const pm = new ProfitManager({
    initialCapital: 100,
    cycleDurationDays: 4,
    profitTargetPercent: 0.5,
  });

  pm.recordLoop({ pnl: 0, timestamp: start + ms(2) + 123 });
  const { milestones } = pm.getStatus().activeCycle;

  // Day 0, day 1, day 2 should be recorded.
  assert.ok(milestones.some((m) => m.day === 0));
  assert.ok(milestones.some((m) => m.day === 1));
  assert.ok(milestones.some((m) => m.day === 2));
})();

console.log('profitManager tests passed');

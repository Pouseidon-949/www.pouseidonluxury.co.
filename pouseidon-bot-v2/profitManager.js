'use strict';

const MS_PER_SECOND = 1000;
const MS_PER_MINUTE = 60 * MS_PER_SECOND;
const MS_PER_HOUR = 60 * MS_PER_MINUTE;
const MS_PER_DAY = 24 * MS_PER_HOUR;

function toTimestampMs(value) {
  if (value == null) return Date.now();
  if (value instanceof Date) return value.getTime();
  if (typeof value === 'number') return value;
  throw new TypeError('timestamp must be a number (ms since epoch) or a Date');
}

function clamp01(n) {
  if (Number.isNaN(n)) return 0;
  if (n < 0) return 0;
  if (n > 1) return 1;
  return n;
}

class CompoundingCycle {
  constructor({
    id,
    startTimeMs,
    durationMs,
    startingCapital,
    profitTargetPercent,
  }) {
    if (!Number.isFinite(startingCapital) || startingCapital <= 0) {
      throw new TypeError('startingCapital must be a positive number');
    }

    this.id = id;
    this.startTimeMs = startTimeMs;
    this.durationMs = durationMs;
    this.endTimeMs = null;

    this.startingCapital = startingCapital;
    this.currentCapital = startingCapital;

    this.profitTargetPercent = profitTargetPercent;
    this.profitTargetAmount = startingCapital * profitTargetPercent;

    this.realizedPnl = 0;
    this.tradeCount = 0;

    this._closed = false;
    this.closeReason = null;

    this.milestones = [];
    this._nextMilestoneIndex = 0;
    this._maxMilestoneIndex = Math.ceil(this.durationMs / MS_PER_DAY);
    this._updateMilestones(startTimeMs);

    this.trades = [];
  }

  get isClosed() {
    return this._closed;
  }

  get roi() {
    return this.realizedPnl / this.startingCapital;
  }

  get expiresAtMs() {
    return this.startTimeMs + this.durationMs;
  }

  isExpired(atTimeMs) {
    return atTimeMs >= this.expiresAtMs;
  }

  isProfitTargetHit() {
    return this.realizedPnl >= this.profitTargetAmount;
  }

  recordTrade({ id, pnl, timestamp }) {
    if (this._closed) {
      throw new Error('Cannot record a trade on a closed cycle');
    }

    const timestampMs = toTimestampMs(timestamp);
    if (!Number.isFinite(pnl)) {
      throw new TypeError('pnl must be a finite number');
    }

    this._updateMilestones(timestampMs);

    this.tradeCount += 1;
    this.realizedPnl += pnl;

    // Compounding after each loop: capital used for the next trade is updated
    // immediately after trade completion.
    this.currentCapital += pnl;

    this.trades.push({
      id: id ?? `${this.id}-${this.tradeCount}`,
      pnl,
      timestampMs,
      capitalAfter: this.currentCapital,
      cyclePnlAfter: this.realizedPnl,
    });

    return this.getSnapshot();
  }

  close({ endTimeMs, reason, withdrawnAmount, reinvestedAmount }) {
    if (this._closed) return this.getSnapshot();

    const ts = toTimestampMs(endTimeMs);
    this._updateMilestones(ts);

    this._closed = true;
    this.endTimeMs = ts;
    this.closeReason = reason;

    this.withdrawnAmount = withdrawnAmount;
    this.reinvestedAmount = reinvestedAmount;

    return this.getSnapshot();
  }

  _updateMilestones(nowMs) {
    const elapsedMs = nowMs - this.startTimeMs;
    if (elapsedMs < 0) return;

    const milestoneIndex = Math.floor(elapsedMs / MS_PER_DAY);

    // Record each whole-day boundary reached since cycle start. The stored capital is the
    // most recently-known capital (compounded) to keep monitoring consistent.
    while (
      this._nextMilestoneIndex <= milestoneIndex &&
      this._nextMilestoneIndex <= this._maxMilestoneIndex
    ) {
      this.milestones.push({
        day: this._nextMilestoneIndex,
        timestampMs: this.startTimeMs + this._nextMilestoneIndex * MS_PER_DAY,
        capital: this.currentCapital,
        cyclePnl: this.realizedPnl,
      });
      this._nextMilestoneIndex += 1;
    }
  }

  getSnapshot() {
    return {
      id: this.id,
      startTimeMs: this.startTimeMs,
      endTimeMs: this.endTimeMs,
      durationMs: this.durationMs,
      expiresAtMs: this.expiresAtMs,
      closeReason: this.closeReason,

      startingCapital: this.startingCapital,
      currentCapital: this.currentCapital,
      realizedPnl: this.realizedPnl,
      roi: this.roi,

      profitTargetPercent: this.profitTargetPercent,
      profitTargetAmount: this.profitTargetAmount,

      tradeCount: this.tradeCount,
      lastTrade: this.trades.length ? this.trades[this.trades.length - 1] : null,
      milestones: [...this.milestones],

      withdrawnAmount: this.withdrawnAmount ?? 0,
      reinvestedAmount: this.reinvestedAmount ?? 0,
    };
  }
}

class ProfitManager {
  constructor({
    initialCapital,
    cycleDurationDays = 4,
    profitTargetPercent = 0.1,

    // Portion of cycle profits (0..1) to withdraw on cycle close.
    // The remainder is reinvested into the next cycle's starting capital.
    withdrawPercentOfProfit = 0,

    // Optional hook invoked whenever a cycle is closed.
    onCycleClosed,
  }) {
    if (!Number.isFinite(initialCapital) || initialCapital <= 0) {
      throw new TypeError('initialCapital must be a positive number');
    }
    if (!Number.isFinite(cycleDurationDays) || cycleDurationDays <= 0) {
      throw new TypeError('cycleDurationDays must be a positive number');
    }
    if (!Number.isFinite(profitTargetPercent) || profitTargetPercent <= 0) {
      throw new TypeError('profitTargetPercent must be a positive number');
    }

    this.cycleDurationMs = cycleDurationDays * MS_PER_DAY;
    this.profitTargetPercent = profitTargetPercent;

    this.withdrawPercentOfProfit = clamp01(withdrawPercentOfProfit);
    this.onCycleClosed = typeof onCycleClosed === 'function' ? onCycleClosed : null;

    this.cycleCounter = 0;
    this.history = [];

    this.totalWithdrawn = 0;
    this.totalRealizedPnl = 0;

    this.activeCycle = this._startNewCycle({
      startTimeMs: Date.now(),
      startingCapital: initialCapital,
    });
  }

  getStatus() {
    const cycle = this.activeCycle.getSnapshot();

    return {
      activeCycle: cycle,
      cycleCountCompleted: this.history.length,
      totalWithdrawn: this.totalWithdrawn,
      totalRealizedPnl: this.totalRealizedPnl + cycle.realizedPnl,
      equity: cycle.currentCapital + this.totalWithdrawn,
    };
  }

  /**
   * Records the result of one bot loop/trade and compounds capital immediately.
   *
   * @param {{ pnl: number, timestamp?: number|Date, id?: string }} trade
   */
  recordLoop(trade) {
    return this.recordTrade(trade);
  }

  /**
   * Records the result of one trade and compounds capital immediately.
   *
   * After recording, the manager enforces:
   * - 10% profit take stop target (defaults) to close the cycle early
   * - 4-day cycle duration to close the cycle when expired
   */
  recordTrade({ pnl, timestamp, id }) {
    const timestampMs = toTimestampMs(timestamp);

    // Enforce time-based cycle closure even if a trade arrives after expiry.
    this.evaluate(timestampMs);

    const snapshotAfterTrade = this.activeCycle.recordTrade({ id, pnl, timestamp: timestampMs });

    if (this.activeCycle.isProfitTargetHit()) {
      this._closeActiveCycle({
        endTimeMs: timestampMs,
        reason: 'profit-target',
      });
    }

    return {
      tradeSnapshot: snapshotAfterTrade,
      status: this.getStatus(),
    };
  }

  /**
   * Time-based milestone enforcement without requiring a trade.
   */
  evaluate(atTime) {
    const atTimeMs = toTimestampMs(atTime);

    if (this.activeCycle.isClosed) return this.getStatus();

    if (this.activeCycle.isExpired(atTimeMs)) {
      this._closeActiveCycle({
        endTimeMs: atTimeMs,
        reason: 'duration',
      });
    }

    return this.getStatus();
  }

  _startNewCycle({ startTimeMs, startingCapital }) {
    this.cycleCounter += 1;
    return new CompoundingCycle({
      id: this.cycleCounter,
      startTimeMs,
      durationMs: this.cycleDurationMs,
      startingCapital,
      profitTargetPercent: this.profitTargetPercent,
    });
  }

  _closeActiveCycle({ endTimeMs, reason }) {
    const cycle = this.activeCycle;
    const profit = cycle.realizedPnl;

    const withdrawAmount = profit > 0 ? profit * this.withdrawPercentOfProfit : 0;
    const reinvestAmount = profit - withdrawAmount;

    this.totalWithdrawn += withdrawAmount;
    this.totalRealizedPnl += profit;

    const closedSnapshot = cycle.close({
      endTimeMs,
      reason,
      withdrawnAmount: withdrawAmount,
      reinvestedAmount: reinvestAmount,
    });

    this.history.push(closedSnapshot);

    if (this.onCycleClosed) {
      this.onCycleClosed(closedSnapshot);
    }

    const nextStartingCapital = cycle.startingCapital + reinvestAmount;

    this.activeCycle = this._startNewCycle({
      startTimeMs: toTimestampMs(endTimeMs),
      startingCapital: nextStartingCapital,
    });

    return closedSnapshot;
  }
}

/**
 * Exponential growth projection based on repeating cycle returns.
 *
 * If you fully reinvest profits, compounding becomes exponential:
 *   capital_{n+1} = capital_n * (1 + targetReturn)
 *
 * @param {object} params
 * @param {number} params.startingCapital
 * @param {number} params.profitTargetPercent - e.g. 0.10 for 10%
 * @param {number} params.cycles - number of cycles to project
 * @param {number} [params.withdrawPercentOfProfit=0] - 0..1
 */
function projectExponentialGrowth({
  startingCapital,
  profitTargetPercent,
  cycles,
  withdrawPercentOfProfit = 0,
}) {
  if (!Number.isFinite(startingCapital) || startingCapital <= 0) {
    throw new TypeError('startingCapital must be a positive number');
  }
  if (!Number.isFinite(profitTargetPercent) || profitTargetPercent <= 0) {
    throw new TypeError('profitTargetPercent must be a positive number');
  }
  if (!Number.isFinite(cycles) || cycles < 0) {
    throw new TypeError('cycles must be a non-negative number');
  }

  const withdrawPct = clamp01(withdrawPercentOfProfit);

  const rows = [];
  let capital = startingCapital;
  let totalWithdrawn = 0;

  for (let i = 1; i <= cycles; i += 1) {
    const profit = capital * profitTargetPercent;
    const withdrawn = profit * withdrawPct;
    const reinvested = profit - withdrawn;

    capital += reinvested;
    totalWithdrawn += withdrawn;

    rows.push({
      cycle: i,
      startingCapital: capital - reinvested,
      profit,
      withdrawn,
      reinvested,
      endingCapital: capital,
      totalWithdrawn,
      equity: capital + totalWithdrawn,
    });
  }

  return rows;
}

module.exports = {
  ProfitManager,
  CompoundingCycle,
  projectExponentialGrowth,

  constants: {
    MS_PER_DAY,
  },
};

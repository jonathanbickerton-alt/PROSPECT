/**
 * PER-SCENARIO ADJUSTED ARPU — the arithmetic, in its own module.
 *
 * WHY THIS EXISTS SEPARATELY. `computeAdjustedForecast` already produces ONE
 * blended ARPU per month, and that blend is load-bearing: it is `chartData`'s
 * `ARPU (Adjusted)` and therefore the pricing card's stored
 * `originalBaseArpu` (settled 2026-08-21, `7b456a1`). The chart-grid decision
 * (Jon, 2026-09-01) adds FOUR per-scenario quantities ALONGSIDE it — not
 * replacing it — so this file computes them from figures the engine has already
 * settled, and touches none of the lines that produce the blend.
 *
 * WHY A PURE FUNCTION. It takes numbers and returns numbers: no React, no
 * store, no mount. The measure that UAT is asking for is arithmetic, and the
 * arithmetic that matters most is the part that should be easiest to test.
 *
 * THE ONE RULE IT ENFORCES. ARPU is Σrevenue ÷ Σvolume for THIS scenario and
 * nothing else. Each per-scenario figure therefore has exactly ONE denominator,
 * which is the property the blended figure does not have: the same word
 * "blended" carries three different denominators in this codebase (measured
 * 2026-09-01, recorded in EXPECTED.md, deliberately not corrected). Building
 * these beside the blend rather than on top of it is what keeps them clean.
 */

/** The four IBRO scenarios, as the chart grid names them. */
export type ScenarioKey = 'inflow' | 'outflow' | 'retention' | 'base';

/**
 * WHY A PER-SCENARIO ARPU CAN BE ABSENT — a reason, never a silent blend.
 *
 * Substituting the blended figure for a missing per-scenario band would make
 * "the inflow ARPU is 24.10" and "we do not know the inflow ARPU" render
 * identically, which is the two-meanings-of-null defect this codebase has
 * corrected at four other sites.
 */
export type ArpuAbsence =
  /** The forecast predates the per-scenario schema and carries no band. */
  | 'band-absent'
  /** No volume in this scenario this month, so there is no rate to state. */
  | 'no-volume';

/** A market-event pool landing in one scenario, carrying its own ARPU. */
export interface ScenarioPool {
  volume: number;
  /** `event.revenue / event.subscriberVolume` — the pool's own rate. */
  arpu: number;
}

/**
 * One pricing delta that names this scenario.
 *
 * `pricesPools` mirrors the engine's own distinction: a `base-only` event
 * prices the standing base and leaves event pools at their own fixed ARPUs
 * (`WhatIfTab.tsx`, the `base-only` branch), while a `cohorts` event prices the
 * blend including pools. Carried as a flag rather than re-derived here, so the
 * two cannot drift.
 */
export interface ScenarioPricing {
  inputMode: 'percentage' | 'absolute';
  amount: number;
  pricesPools: boolean;
}

export interface ScenarioArpuInput {
  /** The baseline band's mean for this scenario, or undefined if absent. */
  baselineArpu: number | null | undefined;
  /** Adjusted volume for this scenario that is NOT in an event pool. */
  naturalVolume: number;
  /** Market-event pools in THIS scenario. Empty for scenarios events cannot reach. */
  pools?: ReadonlyArray<ScenarioPool>;
  /**
   * The yield ratio for this scenario, or null when no yield event applies.
   *
   * A RATE, not a quantity — it multiplies the natural ARPU and is never
   * pro-rated, matching the engine's own treatment of yield.
   */
  yieldRatio?: number | null;
  /** Pricing deltas naming this scenario, in application order. */
  pricing?: ReadonlyArray<ScenarioPricing>;
}

export interface ScenarioArpuResult {
  /** Σrevenue ÷ Σvolume for this scenario, or null when absent. */
  arpu: number | null;
  /** Σrevenue for this scenario — the measure UAT calls service revenue. */
  revenue: number | null;
  /** Σvolume for this scenario: natural + pools. */
  volume: number;
  absence: ArpuAbsence | null;
}

/** Apply one pricing delta. Percentage scales; absolute shifts. */
function applyDelta(arpu: number, p: ScenarioPricing): number {
  return p.inputMode === 'percentage' ? arpu * (1 + p.amount / 100) : arpu + p.amount;
}

/**
 * ONE SCENARIO'S ADJUSTED ARPU AND REVENUE.
 *
 * The order is the engine's order, and it is not arbitrary: yield is a mix
 * shift on the natural population, pools arrive already carrying their own
 * rate, and pricing lands last on whatever the earlier steps produced. Reorder
 * these and a percentage price rise starts compounding against a pre-yield
 * figure.
 *
 *   natural  = baselineArpu x (yieldRatio ?? 1)
 *   blended  = (natural x naturalVol + Σ pool.vol x pool.arpu) / totalVol
 *   priced   = pricing deltas applied, in order
 *
 * FLOORED AT ZERO, as the engine's own blend is. A negative per-subscriber
 * revenue rate is not a low price; it is an artefact.
 */
export function scenarioAdjustedArpu(input: ScenarioArpuInput): ScenarioArpuResult {
  const pools = input.pools ?? [];
  const poolVol = pools.reduce((s, p) => s + (Number.isFinite(p.volume) ? p.volume : 0), 0);
  const naturalVol = Number.isFinite(input.naturalVolume) ? Math.max(0, input.naturalVolume) : 0;
  const volume = naturalVol + Math.max(0, poolVol);

  // ABSENCE FIRST, and band-absence outranks no-volume: a forecast that never
  // carried the band cannot state a rate whatever its volumes say, and naming
  // the volume would point at the wrong cause.
  const base = input.baselineArpu;
  if (base === null || base === undefined || !Number.isFinite(base)) {
    return { arpu: null, revenue: null, volume, absence: 'band-absent' };
  }
  if (!(volume > 0)) {
    return { arpu: null, revenue: null, volume, absence: 'no-volume' };
  }

  const ratio = input.yieldRatio;
  const naturalArpu = (ratio !== null && ratio !== undefined && Number.isFinite(ratio))
    ? base * ratio
    : base;

  let arpu: number;
  let unpricedPoolRevenue = 0;
  if (poolVol > 0) {
    const poolRevenue = pools.reduce((s, p) => s + p.volume * p.arpu, 0);
    arpu = (naturalArpu * naturalVol + poolRevenue) / volume;
    unpricedPoolRevenue = poolRevenue;
  } else {
    arpu = naturalArpu;
  }

  for (const p of input.pricing ?? []) {
    if (p.pricesPools || poolVol <= 0) {
      arpu = applyDelta(arpu, p);
    } else {
      // POOLS KEEP THEIR OWN RATE. Price the natural component alone and
      // re-blend — the shape the engine's `base-only` branch already uses.
      const pricedNatural = applyDelta(naturalArpu * (naturalVol > 0 ? 1 : 0), p);
      arpu = (pricedNatural * naturalVol + unpricedPoolRevenue) / volume;
    }
  }

  arpu = Math.max(0, arpu);
  return { arpu, revenue: arpu * volume, volume, absence: null };
}

/**
 * AGGREGATE OVER LEAVES — Σrevenue ÷ Σvolume, never a mean of rates.
 *
 * The settled reconciliation rule, restated for one scenario. A leaf that is
 * absent contributes nothing rather than a zero rate: a zero ARPU is a claim
 * that the subscribers are worth nothing, which is not what "we do not know"
 * means. If NO leaf can state a rate, the aggregate cannot either.
 */
export function aggregateScenarioArpu(
  leaves: ReadonlyArray<ScenarioArpuResult>,
): ScenarioArpuResult {
  let rev = 0, vol = 0, contributing = 0;
  for (const l of leaves) {
    if (l.arpu === null || l.revenue === null) continue;
    rev += l.revenue;
    vol += l.volume;
    contributing++;
  }
  if (contributing === 0) {
    return { arpu: null, revenue: null, volume: 0, absence: 'band-absent' };
  }
  if (!(vol > 0)) {
    return { arpu: null, revenue: null, volume: 0, absence: 'no-volume' };
  }
  return { arpu: rev / vol, revenue: rev, volume: vol, absence: null };
}

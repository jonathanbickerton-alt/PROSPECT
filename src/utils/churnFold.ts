/**
 * R7 — CHURN-TARGETED OUTFLOW: the fold.
 *
 * Turns a stated reduction in annualised churn into the per-month outflow
 * deltas a ramp of MarketEvents will carry.
 *
 * WHY A FOLD AND NOT A MAP. The existing ramp distributes a stated TOTAL by
 * share, so its per-month figures are knowable up front and `pcts.map(...)` is
 * enough. A churn TARGET is not: month *i*'s delta is a fraction of month *i*'s
 * previous base, and that base has already been moved by the deltas of months
 * 0..i-1. The months are sequentially dependent, so the accumulator is the
 * whole point — and it is the one thing a naive implementation gets wrong while
 * still producing plausible numbers.
 *
 * WHY A PURE FUNCTION IN ITS OWN MODULE. It takes a series and some numbers and
 * returns numbers. No React, no store, no component mount — so the arithmetic
 * that matters most in this feature is the part that is easiest to test.
 *
 * WHAT IT DOES NOT DO. It does not decide the ramp's shape, build events, or
 * know what a MarketEvent is. The card owns those; this owns the arithmetic.
 */

/** One month of the scoped, adjusted-so-far series the fold reads. */
export interface ChurnSeriesMonth {
  month: string;
  /** Outflow for this month on the series EXCLUDING this campaign. */
  outflow: number;
  /** Inflow for this month, needed to roll the base forward. */
  inflow: number;
}

/** What one ramp month becomes: the figures its MarketEvent will carry. */
export interface ChurnFoldMonth {
  month: string;
  /** Previous month's base, AFTER the earlier months' deltas — the denominator. */
  prevBase: number;
  /** Annualised churn on the series before this event, at this month. */
  currentPct: number;
  /** The user's stated CUMULATIVE reduction in points, for this month. */
  statedReductionPct: number;
  /** currentPct - statedReductionPct, floored at zero. */
  targetPct: number;
  /** The outflow the target implies for this month. */
  targetOutflow: number;
  /**
   * `seriesOutflow - targetOutflow`. POSITIVE means a REDUCTION in churn, and
   * is stored verbatim as the event's subscriberVolume — `applyEventsToMonth`
   * does `outflow -= vol`, so a positive delta removes outflow.
   */
  delta: number;
  /** Absent when the month cannot state a rate — see ChurnAbsence. */
  absence: ChurnAbsence | null;
}

/**
 * WHY A MONTH CANNOT STATE A CHURN RATE. Each is an absence with a reason, not
 * an error and never a zero — the em-dash-with-reason precedent.
 */
export type ChurnAbsence =
  /** The slice has no known seed, so there is no base series to divide by. */
  | 'seed-unknown'
  /** The first forecast month has no prior month inside the series. */
  | 'no-prior-month'
  /** The base rolled to zero; a rate over nothing is not a rate. */
  | 'prev-base-zero';

export interface ChurnFoldInput {
  /** The scoped adjusted-so-far series, this campaign EXCLUDED, in month order. */
  series: ChurnSeriesMonth[];
  /** Index into `series` of the ramp's first month. */
  startIndex: number;
  /** One CUMULATIVE stated reduction (points) per ramp month, in order. */
  statedReductions: number[];
  /** The base at the month BEFORE series[0] — the seed rolled to that point. */
  openingBase: number;
  /** False when the slice's seed is unknown; every month is then absent. */
  seedBaseKnown: boolean;
}

/** Annualised churn from one month's outflow over the base it ran against. */
export function annualisedChurnPct(outflow: number, prevBase: number): number | null {
  if (!(prevBase > 0) || !Number.isFinite(outflow)) return null;
  return (outflow / prevBase) * 12 * 100;
}

/**
 * THE FOLD.
 *
 * For ramp month i:
 *   prevBase_i  = base rolled forward through months 0..i-1 WITH their deltas
 *   current_i   = (seriesOutflow_i / prevBase_i) * 12 * 100
 *   target_i    = max(0, current_i - statedReduction_i)
 *   targetOut_i = (target_i / 100 / 12) * prevBase_i
 *   delta_i     = seriesOutflow_i - targetOut_i      // positive = reduction
 *
 * and the roll-forward that produces prevBase_{i+1} subtracts the ADJUSTED
 * outflow — `seriesOutflow_i - delta_i` — which is exactly what the engine will
 * do when the events are applied. That single term is the difference between
 * this function and a plausible wrong one.
 */
export function foldChurnRamp(input: ChurnFoldInput): ChurnFoldMonth[] {
  const { series, startIndex, statedReductions, openingBase, seedBaseKnown } = input;
  const out: ChurnFoldMonth[] = [];
  if (!Array.isArray(series) || series.length === 0) return out;

  // Roll the base forward from the opening to the month BEFORE the ramp starts,
  // using the series as-is: nothing this campaign does has happened yet there.
  let base = Number.isFinite(openingBase) ? Math.max(0, openingBase) : 0;
  for (let k = 0; k < startIndex && k < series.length; k++) {
    base = Math.max(0, base + (series[k].inflow ?? 0) - (series[k].outflow ?? 0));
  }

  for (let i = 0; i < statedReductions.length; i++) {
    const idx = startIndex + i;
    const m = series[idx];
    if (!m) break;

    const prevBase = base;
    const seriesOutflow = Number(m.outflow ?? 0);
    const stated = Number(statedReductions[i] ?? 0);

    // ── ABSENCE, in precedence order ────────────────────────────────────────
    // Seed first: without it there is no base at all, so the other two
    // questions do not arise and reporting them would name the wrong reason.
    let absence: ChurnAbsence | null = null;
    if (!seedBaseKnown) absence = 'seed-unknown';
    else if (idx === 0 && startIndex === 0) absence = 'no-prior-month';
    else if (!(prevBase > 0)) absence = 'prev-base-zero';

    if (absence) {
      out.push({
        month: m.month, prevBase, currentPct: 0, statedReductionPct: stated,
        targetPct: 0, targetOutflow: 0, delta: 0, absence,
      });
      // The base still rolls, on the UNADJUSTED series: an absent month states
      // nothing, so it changes nothing.
      base = Math.max(0, base + (m.inflow ?? 0) - seriesOutflow);
      continue;
    }

    const currentPct = (seriesOutflow / prevBase) * 12 * 100;
    // A reduction cannot take churn below zero. Clamping here rather than at
    // the delta keeps `targetPct` honest about what was achievable.
    const targetPct = Math.max(0, currentPct - stated);
    const targetOutflow = (targetPct / 100 / 12) * prevBase;
    const delta = seriesOutflow - targetOutflow;

    out.push({
      month: m.month, prevBase, currentPct, statedReductionPct: stated,
      targetPct, targetOutflow, delta, absence: null,
    });

    // THE SEQUENTIAL STEP. The adjusted outflow — not the series outflow — is
    // what the next month's base rolls against, because that is what the engine
    // will have applied by then. Using seriesOutflow here is the naive error:
    // it produces numbers that look right and drift from the stated rate the
    // moment the ramp is longer than one month.
    base = Math.max(0, base + (m.inflow ?? 0) - (seriesOutflow - delta));
  }

  return out;
}

/** Linear prefill: a target reached in equal steps, cumulative, over N months. */
export function linearChurnRamp(targetPct: number, months: number): number[] {
  const n = Math.max(1, Math.floor(months) || 1);
  const t = Number.isFinite(targetPct) ? targetPct : 0;
  return Array.from({ length: n }, (_, i) => (t * (i + 1)) / n);
}

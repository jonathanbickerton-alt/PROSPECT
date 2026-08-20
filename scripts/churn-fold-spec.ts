/**
 * R7 — THE CHURN FOLD, and the one check only real churn arithmetic passes.
 *
 *   npm run spec:churn-fold
 *
 * Drives the REAL `foldChurnRamp`. Its whole reason for existing is THE
 * SEQUENTIAL CASE: month 2's delta must reflect month 1's effect on the base.
 * A naive implementation that reads a STATIC previous base produces plausible
 * numbers and fails only there — so this file states BOTH numbers, the correct
 * one and the naive one, and asserts they differ.
 *
 * WHAT IT IS CAREFUL ABOUT:
 *
 *  - EVERY EXPECTED FIGURE IS HAND-COMPUTED and written as a literal with its
 *    arithmetic shown. Nothing is recomputed by calling the function under test.
 *  - THE FIXTURE IS TINY AND ROUND, so the arithmetic can be checked by eye:
 *    base 1000, outflow 20/month, inflow 0 → exactly 24% annualised.
 *  - ABSENCE IS NOT ZERO. Each absence reason is asserted by NAME, and the
 *    precedence between them is asserted too.
 */
import { foldChurnRamp, linearChurnRamp, annualisedChurnPct } from '../src/utils/churnFold';

let pass = 0; const fails: string[] = [];
const check = (n: string, c: boolean, d?: string) => { if (c) pass++; else fails.push(n + (d ? `  [${d}]` : '')); };
const near = (a: number, b: number, eps = 1e-6) => Math.abs(a - b) < eps;

// ═══════════════════════════════════════════════════════════════════════════
// THE FIXTURE — chosen so every figure is checkable by eye.
//
//   opening base 1000, inflow 0, outflow 20 every month
//   → month 1 prevBase 1000, churn = 20/1000 * 12 * 100 = 24.0%
// ═══════════════════════════════════════════════════════════════════════════
const SERIES = ['2026-07', '2026-08', '2026-09', '2026-10'].map(month => ({
  month, outflow: 20, inflow: 0,
}));
const OPENING = 1000;

// ═══════════════════════════════════════════════════════════════════════════
// 1. THE SEQUENTIAL CASE — the check that discriminates
//
// Stated reductions 1pt then 3pt (CUMULATIVE), starting at index 1 so month 1
// has a prior month.
//
// The arithmetic collapses to a clean identity, which is worth stating because
// it makes every literal below checkable in one step:
//
//     target    = current - stated
//     targetOut = (current - stated)/1200 * prevBase = seriesOutflow - stated/1200*prevBase
//  => delta     = stated/1200 * prevBase
//
// So the ONLY thing that can differ between a correct fold and a naive one is
// prevBase — and it differs in the reported rate AND the delta.
//
//   MONTH 1 (2026-08), prevBase = 1000 - 20 = 980
//     current = 20/980*1200            = 24.489795918367346 %
//     target  = current - 1            = 23.489795918367346 %
//     delta   = 1/1200 * 980           =  0.8166666666666667
//
//   MONTH 2 (2026-09) — prevBase rolls with the ADJUSTED outflow:
//     prevBase = 980 - (20 - 0.8166666666666667) = 960.8166666666666
//     current  = 20/960.8166666666666*1200       = 24.978750715537128 %
//     delta    = 3/1200 * 960.8166666666666      =  2.4020416666666665
//
//   THE NAIVE VERSION rolls on the UNADJUSTED outflow:
//     prevBase = 980 - 20 = 960
//     current  = 20/960*1200 = 25.0 exactly
//     delta    = 3/1200*960  =  2.4 exactly
//
// Both are stated below and both are asserted to differ. The literals here were
// wrong on the first write and the run corrected them — which is the reason
// they are hand-written rather than taken from the function under test.
// ═══════════════════════════════════════════════════════════════════════════
{
  const r = foldChurnRamp({
    series: SERIES, startIndex: 1, statedReductions: [1, 3],
    openingBase: OPENING, seedBaseKnown: true,
  });

  check('SEQUENTIAL: two ramp months produced', r.length === 2, `${r.length}`);

  // ── month 1 ──────────────────────────────────────────────────────────────
  check('SEQUENTIAL m1: prevBase is 980', near(r[0].prevBase, 980), `${r[0].prevBase}`);
  check('SEQUENTIAL m1: current churn is 24.489795918367346%',
    near(r[0].currentPct, 24.489795918367346), `${r[0].currentPct}`);
  check('SEQUENTIAL m1: target is current minus the stated 1pt',
    near(r[0].targetPct, 23.489795918367346), `${r[0].targetPct}`);
  check('SEQUENTIAL m1: delta is 0.8166666666666667 (POSITIVE = a reduction)',
    near(r[0].delta, 0.8166666666666667), `${r[0].delta}`);

  // ── month 2 — THE DISCRIMINATING ASSERTION ───────────────────────────────
  const CORRECT_PREVBASE = 960.8166666666666;
  const NAIVE_PREVBASE   = 960;   // what a static/unadjusted roll would give

  check('SEQUENTIAL m2: prevBase rolls with the ADJUSTED outflow → 960.8166666666666',
    near(r[1].prevBase, CORRECT_PREVBASE, 1e-9),
    `${r[1].prevBase} — the naive unadjusted roll gives ${NAIVE_PREVBASE}`);
  check('SEQUENTIAL m2: and is therefore NOT the naive 960',
    !near(r[1].prevBase, NAIVE_PREVBASE, 1e-6),
    'if these coincide the fixture cannot discriminate and this spec is vacuous');

  check('SEQUENTIAL m2: current churn is 24.978750715537128%',
    near(r[1].currentPct, 24.978750715537128, 1e-9), `${r[1].currentPct}`);
  check('SEQUENTIAL m2: delta is 2.4020416666666665',
    near(r[1].delta, 2.4020416666666665, 1e-9), `${r[1].delta}`);

  // THE NAIVE FIGURES, STATED — and they differ on BOTH the reported rate and
  // the stored delta, so either assertion discriminates. Asserting both says
  // what the user would see wrong (the rate) and what would be written into
  // the event (the delta).
  const naiveCurrent = (20 / NAIVE_PREVBASE) * 1200;          // 25.0 exactly
  const naiveDelta   = (3 / 1200) * NAIVE_PREVBASE;           //  2.4 exactly
  check('SEQUENTIAL m2: the naive CURRENT differs from the correct one',
    !near(r[1].currentPct, naiveCurrent, 1e-6),
    `correct ${r[1].currentPct} vs naive ${naiveCurrent} — the rate the user reads`);
  check('SEQUENTIAL m2: the naive DELTA differs too',
    !near(r[1].delta, naiveDelta, 1e-6),
    `correct ${r[1].delta} vs naive ${naiveDelta} — the figure written into the event`);
}

// ═══════════════════════════════════════════════════════════════════════════
// 2. A RAMP OF LENGTH 1 — one mode, no one-off fork
// ═══════════════════════════════════════════════════════════════════════════
{
  const r = foldChurnRamp({
    series: SERIES, startIndex: 1, statedReductions: [1],
    openingBase: OPENING, seedBaseKnown: true,
  });
  check('LENGTH 1: a single month is an ordinary ramp', r.length === 1);
  check('LENGTH 1: and matches the two-month ramp\'s FIRST month exactly',
    near(r[0].delta, 0.8166666666666667) && near(r[0].prevBase, 980),
    'a length-1 ramp must not be a special case with different arithmetic');
}

// ═══════════════════════════════════════════════════════════════════════════
// 3. THE STATED FIGURES ARE CUMULATIVE, and 1/3/6 stays 1/3/6
// ═══════════════════════════════════════════════════════════════════════════
{
  const r = foldChurnRamp({
    series: SERIES, startIndex: 1, statedReductions: [1, 3, 6],
    openingBase: OPENING, seedBaseKnown: true,
  });
  check('CUMULATIVE: each month records the reduction the user typed',
    r.map(m => m.statedReductionPct).join(',') === '1,3,6',
    r.map(m => m.statedReductionPct).join(','));
  check('CUMULATIVE: nothing renormalises them',
    r[2].statedReductionPct === 6, `${r[2].statedReductionPct}`);
  check('CUMULATIVE: target is current MINUS the cumulative figure, per month',
    near(r[2].targetPct, r[2].currentPct - 6, 1e-9),
    `${r[2].targetPct} vs ${r[2].currentPct - 6}`);
}

// ═══════════════════════════════════════════════════════════════════════════
// 4. ABSENCE — named, never zero, and in precedence order
// ═══════════════════════════════════════════════════════════════════════════
{
  const noSeed = foldChurnRamp({
    series: SERIES, startIndex: 1, statedReductions: [1],
    openingBase: OPENING, seedBaseKnown: false,
  });
  check('ABSENCE: an unknown seed is reported by NAME',
    noSeed[0].absence === 'seed-unknown', String(noSeed[0].absence));
  check('ABSENCE: and states no rate rather than a zero rate',
    noSeed[0].delta === 0 && noSeed[0].currentPct === 0,
    'the caller reads `absence`, never the figures, when it is set');

  const firstMonth = foldChurnRamp({
    series: SERIES, startIndex: 0, statedReductions: [1],
    openingBase: OPENING, seedBaseKnown: true,
  });
  check('ABSENCE: the first forecast month has no prior base',
    firstMonth[0].absence === 'no-prior-month', String(firstMonth[0].absence));

  const zeroBase = foldChurnRamp({
    series: [{ month: '2026-07', outflow: 1000, inflow: 0 },
             { month: '2026-08', outflow: 5, inflow: 0 }],
    startIndex: 1, statedReductions: [1], openingBase: 1000, seedBaseKnown: true,
  });
  check('ABSENCE: a base rolled to zero is reported by NAME',
    zeroBase[0].absence === 'prev-base-zero', String(zeroBase[0].absence));

  // PRECEDENCE. Without a seed there is no base at all, so naming the
  // first-month or zero-base reason would name the wrong one.
  const both = foldChurnRamp({
    series: SERIES, startIndex: 0, statedReductions: [1],
    openingBase: OPENING, seedBaseKnown: false,
  });
  check('ABSENCE: seed outranks the first-month reason',
    both[0].absence === 'seed-unknown', String(both[0].absence));

  // An absent month must not silently move the base for later months.
  const mixed = foldChurnRamp({
    series: SERIES, startIndex: 0, statedReductions: [1, 1],
    openingBase: OPENING, seedBaseKnown: true,
  });
  check('ABSENCE: an absent month still rolls the base on the UNADJUSTED series',
    mixed[0].absence === 'no-prior-month' && near(mixed[1].prevBase, 980),
    `${mixed[1].prevBase} — an absent month states nothing, so it changes nothing`);
}

// ═══════════════════════════════════════════════════════════════════════════
// 5. EDGES
// ═══════════════════════════════════════════════════════════════════════════
{
  const overshoot = foldChurnRamp({
    series: SERIES, startIndex: 1, statedReductions: [99],
    openingBase: OPENING, seedBaseKnown: true,
  });
  check('EDGE: a reduction larger than the rate floors the target at zero',
    overshoot[0].targetPct === 0, `${overshoot[0].targetPct}`);
  check('EDGE: and the delta is then the whole outflow',
    near(overshoot[0].delta, 20), `${overshoot[0].delta}`);

  const zeroStated = foldChurnRamp({
    series: SERIES, startIndex: 1, statedReductions: [0],
    openingBase: OPENING, seedBaseKnown: true,
  });
  check('EDGE: a stated ZERO reduction is a real statement — delta 0, not absent',
    zeroStated[0].absence === null && near(zeroStated[0].delta, 0),
    'zero points is "no reduction this month", not "unset"');

  check('EDGE: an empty series yields no months',
    foldChurnRamp({ series: [], startIndex: 0, statedReductions: [1],
      openingBase: 1000, seedBaseKnown: true }).length === 0);
  check('EDGE: a ramp running off the end stops at the series end',
    foldChurnRamp({ series: SERIES, startIndex: 3, statedReductions: [1, 1, 1],
      openingBase: OPENING, seedBaseKnown: true }).length === 1);

  check('EDGE: annualisedChurnPct declines a zero base rather than dividing',
    annualisedChurnPct(20, 0) === null && annualisedChurnPct(20, 1000) === 24);
}

// ═══════════════════════════════════════════════════════════════════════════
// 6. THE LINEAR PREFILL
// ═══════════════════════════════════════════════════════════════════════════
{
  check('PREFILL: 6 points over 3 months is cumulative 2/4/6',
    linearChurnRamp(6, 3).join(',') === '2,4,6', linearChurnRamp(6, 3).join(','));
  check('PREFILL: one month reaches the target immediately',
    linearChurnRamp(5, 1).join(',') === '5');
  check('PREFILL: the last month always equals the target',
    near(linearChurnRamp(7, 4)[3], 7));
  check('PREFILL: a nonsense month count still yields one month',
    linearChurnRamp(3, 0).length === 1 && linearChurnRamp(3, -2).length === 1);
}

console.log(`\nchurn-fold spec: ${pass} passed, ${fails.length} failed`);
fails.forEach(f => console.log('  FAIL  ' + f));
process.exit(fails.length ? 1 : 0);

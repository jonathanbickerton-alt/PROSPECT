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
import fs from 'fs';

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
/** The base immediately before the ramp's first month (series index 1). */
const PREV_BASE_AT_START = 980;

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
    prevBaseAtStart: 980, seedBaseKnown: true,
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
    prevBaseAtStart: 980, seedBaseKnown: true,
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
    prevBaseAtStart: 980, seedBaseKnown: true,
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
    prevBaseAtStart: 980, seedBaseKnown: false,
  });
  check('ABSENCE: an unknown seed is reported by NAME',
    noSeed[0].absence === 'seed-unknown', String(noSeed[0].absence));
  check('ABSENCE: and states no rate rather than a zero rate',
    noSeed[0].delta === 0 && noSeed[0].currentPct === 0,
    'the caller reads `absence`, never the figures, when it is set');

  // startIndex 0 IS the first forecast month: there is no prior month inside
  // the series, so no rate can be stated whatever base the caller passes.
  const firstMonth = foldChurnRamp({
    series: SERIES, startIndex: 0, statedReductions: [1],
    prevBaseAtStart: 0, seedBaseKnown: true,
  });
  check('ABSENCE: the first forecast month has no prior base',
    firstMonth[0].absence === 'no-prior-month', String(firstMonth[0].absence));

  const zeroBase = foldChurnRamp({
    series: [{ month: '2026-07', outflow: 1000, inflow: 0 },
             { month: '2026-08', outflow: 5, inflow: 0 }],
    startIndex: 1, statedReductions: [1], prevBaseAtStart: 0, seedBaseKnown: true,
  });
  check('ABSENCE: a base rolled to zero is reported by NAME',
    zeroBase[0].absence === 'prev-base-zero', String(zeroBase[0].absence));

  // PRECEDENCE. Without a seed there is no base at all, so naming the
  // first-month or zero-base reason would name the wrong one.
  const both = foldChurnRamp({
    series: SERIES, startIndex: 0, statedReductions: [1],
    prevBaseAtStart: 0, seedBaseKnown: false,
  });
  check('ABSENCE: seed outranks the first-month reason',
    both[0].absence === 'seed-unknown', String(both[0].absence));

  // An absent month must not silently move the base for later months.
  const mixed = foldChurnRamp({
    series: SERIES, startIndex: 0, statedReductions: [1, 1],
    prevBaseAtStart: 1000, seedBaseKnown: true,
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
    prevBaseAtStart: 980, seedBaseKnown: true,
  });
  check('EDGE: a reduction larger than the rate floors the target at zero',
    overshoot[0].targetPct === 0, `${overshoot[0].targetPct}`);
  check('EDGE: and the delta is then the whole outflow',
    near(overshoot[0].delta, 20), `${overshoot[0].delta}`);

  const zeroStated = foldChurnRamp({
    series: SERIES, startIndex: 1, statedReductions: [0],
    prevBaseAtStart: 980, seedBaseKnown: true,
  });
  check('EDGE: a stated ZERO reduction is a real statement — delta 0, not absent',
    zeroStated[0].absence === null && near(zeroStated[0].delta, 0),
    'zero points is "no reduction this month", not "unset"');

  check('EDGE: an empty series yields no months',
    foldChurnRamp({ series: [], startIndex: 0, statedReductions: [1],
      prevBaseAtStart: 1000, seedBaseKnown: true }).length === 0);
  check('EDGE: a ramp running off the end stops at the series end',
    foldChurnRamp({ series: SERIES, startIndex: 3, statedReductions: [1, 1, 1],
      prevBaseAtStart: 980, seedBaseKnown: true }).length === 1);

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

// ═══════════════════════════════════════════════════════════════════════════
// 7. THE BAR, AND THE WIRING
//
// Source-level, and declared as such: campaignGroups is a module-level function
// over component state, so the bar is pinned by reading it rather than by
// running it. The rule's POSITION is the thing being asserted — the source
// comment beside it records a mutation test proving a clause placed where it
// cannot fire protects nothing.
// ═══════════════════════════════════════════════════════════════════════════
{
  const tabRaw = fs.readFileSync('src/components/WhatIfTab.tsx', 'utf8');
  // Comments stripped — trap 93 MISSED once because a check matched the prose
  // explaining the fix rather than the code implementing it.
  const tab = tabRaw.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');

  check('BAR: churn rows are detected at the campaign-group rule',
    /const anyChurn = g\.rows\.some\(e => e\.churnMode === 'churn'\);/.test(tab),
    'the bar must read the carrier, not a proxy for it');
  check('BAR: and the churn branch precedes the percentage branch',
    tab.indexOf('if (anyChurn)') > 0
      && tab.indexOf('if (anyChurn)') < tab.indexOf('anyPercentage) {'),
    'a branch that never runs is the failure the source comment there records');
  check('BAR: it declines with a STATED reason, using the existing mechanism',
    /anyChurn\)[\s\S]{0,200}g\.editable = false;[\s\S]{0,200}g\.reason =/.test(tab),
    'the group must say why, not merely refuse');
  check('BAR: exactly ONE churn bar — no downstream twin',
    (tab.match(/churnMode === 'churn'\);/g) ?? []).length === 1,
    'a second guard elsewhere would be the unreachable-clause shape');

  // ── THE ARM AND ITS SPREAD SEMANTICS ───────────────────────────────────
  check('UI: the third arm renders only for Outflow',
    /newEvent\.scenario === 'Outflow' && \(/.test(tab),
    'the draft already knows its IBRO type');
  check('UI: selecting churn CLEARS the spread explicitly',
    /setIsChurnDraft\(true\);[\s\S]{0,600}setSpreadEnabled\(false\);/.test(tab),
    'silence here reproduces the defect the percentage arm records');
  check('UI: selecting an ordinary arm LEAVES churn mode',
    /setIsChurnDraft\(false\);[\s\S]{0,120}setNewEvent\(\{/.test(tab),
    'two lit arms would be two contradicting statements');
  check('UI: the amount input is hidden in churn mode, not duplicated',
    /\{!isChurnDraft && \(/.test(tab),
    'a subscriber box beside a rate is a second way to say the same thing');
  check('UI: churn is NOT a value of amountType',
    !/amountType: 'churn'/.test(tab) && !/amountType === 'churn'/.test(tab),
    'amountType is read by the ENGINE; churn is a way of SAYING (decision 1)');
  check('UI: the stored event keeps amountType absolute and carries churnMode',
    /amountType:\s+'absolute',[\s\S]{0,300}churnMode:\s+'churn',/.test(tab),
    'an ordinary absolute outflow row that remembers how it was stated');

  // ── SIGNED VERBATIM AT THE BUILDER ─────────────────────────────────────
  // The churn branch must not pass its delta through neg(). Asserted
  // structurally: the branch returns BEFORE neg is even defined.
  check('BUILDER: the churn branch runs before neg() exists',
    tab.indexOf('if (isChurnDraft) {') > 0
      && tab.indexOf('if (isChurnDraft) {') < tab.indexOf('const neg = (v: number) => isOutflow'),
    'a delta passed through neg would be inverted into its opposite');
  check('BUILDER: the delta is stored as the fold produced it',
    /subscriberVolume: m\.delta,/.test(tab),
    'no transform on the way in');
  check('BUILDER: each row carries its OWN three stated figures',
    /churnTargetPct:\s+m\.statedReductionPct,[\s\S]{0,200}churnPrevBase:\s+m\.prevBase,/.test(tab));
  check('BUILDER: the ramp shares one campaignName',
    /campaignName:\s+campaign,/.test(tab));
  check('BUILDER: absent months contribute no event',
    /churnFold\.filter\(m => !m\.absence/.test(tab),
    'a month that cannot state a rate must not silently store a zero delta');

  // ── THE BLOCK REASON — feedback, not enablement ────────────────────────
  check('BLOCK: a named reason exists and is rendered',
    /churnBlockReason/.test(tab) && /data-testid="churn-block-reason"/.test(tabRaw));
  check('BLOCK: Add refuses when the reason is set',
    /if \(churnBlockReason\) return;/.test(tab));

  const LOC = ['en','de','es','fr','it','pt'];
  const KEYS = ['whatif_churn_mode','whatif_churn_current','whatif_churn_target',
    'whatif_churn_months','whatif_churn_points','whatif_churn_derived',
    'whatif_churn_block_no_month','whatif_churn_block_no_series','whatif_churn_block_no_target',
    'whatif_churn_absent_seed_unknown','whatif_churn_absent_no_prior_month',
    'whatif_churn_absent_prev_base_zero','whatif_churn_absent_no_series',
    'whatif_churn_default_campaign'];
  const missing: string[] = [];
  for (const l of LOC) {
    const d = JSON.parse(fs.readFileSync(`src/locales/${l}/translation.json`, 'utf8'));
    for (const k of KEYS) if (typeof d[k] !== 'string') missing.push(`${l}/${k}`);
  }
  check('i18n: every churn key in all six locales', missing.length === 0, missing.slice(0, 5).join(', '));

  // THE ABSENCE REASONS ARE REACHED BY NAME. The card derives the key from the
  // ChurnAbsence value, so a renamed reason with no key would render a raw key.
  const en = JSON.parse(fs.readFileSync('src/locales/en/translation.json', 'utf8'));
  for (const a of ['seed-unknown', 'no-prior-month', 'prev-base-zero']) {
    const key = `whatif_churn_absent_${a.replace(/-/g, '_')}`;
    check(`i18n: the '${a}' absence has a reason to show`,
      typeof en[key] === 'string' && en[key].length > 0, key);
  }
}
console.log(`\nchurn-fold spec: ${pass} passed, ${fails.length} failed`);
fails.forEach(f => console.log('  FAIL  ' + f));
process.exit(fails.length ? 1 : 0);

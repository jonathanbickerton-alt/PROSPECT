/**
 * THE PRICING EVENT ROUND TRIP — R5's retention-dilution mode.
 *
 *   npm run spec:pricing-roundtrip
 *
 * DRIVES THE REAL WRITER AND THE REAL READER. `pricingEventExportRow` and
 * `pricingEventFromRow` are imported from the app, not copied here. The yield
 * spec still copies its row shape and is still recorded as an open finding;
 * this seam was extracted in the same session that needed it so it never became
 * the third instance of that mistake.
 *
 * WHAT IT IS CAREFUL ABOUT:
 *
 *  - THE ARITHMETIC IS PINNED TO STATED EXPECTATIONS, written by hand rather
 *    than computed with the function under test. 25 -> 20 is +6.6667%, not the
 *    +5% a reader subtracting the two figures would expect. That gap IS the
 *    capability, so it is the first thing asserted.
 *  - THE MODE IS A ROUND-TRIPPED FIELD, not an inference. A restored event must
 *    say it is a dilution event; deriving "it looks like a dilution" from the
 *    numbers would pass even if the discriminant were dropped entirely.
 *  - ABSENCE IS NOT ZERO. A plain percentage event round-trips with the mode
 *    and both figures ABSENT, which is what makes every pre-R5 saved event
 *    read correctly without migration.
 *  - IT PINS THE ROUTE COUNT. Pricing has exactly ONE import route today. One
 *    is not a reason to skip the pin — it is the reason to place it, so a
 *    second route cannot quietly diverge the way the market-event routes
 *    nearly did.
 */
import fs from 'fs';
import {
  pricingEventExportRow, pricingEventFromRow, pricingEventSummary,
  retainedRevenueRatio, dilutionAmountPct, isValidDilutionPct,
  applyPricingToBlend, pricedVolumesFor, pricingAdjustedBlend, pricingDraftBlockReason,
  eventScopeMatchesView,
} from '../src/utils/forecasting';
import type { PricingEvent } from '../src/types/forecast';

let pass = 0; const fails: string[] = [];
const check = (n: string, c: boolean, d?: string) => { if (c) pass++; else fails.push(n + (d ? `  [${d}]` : '')); };
const near = (a: number, b: number, eps = 1e-9) => Math.abs(a - b) <= eps * Math.max(1, Math.abs(a), Math.abs(b));

const base: PricingEvent = {
  id: 'p1', segment: 'Corporate', product: 'All', productL2: 'All',
  channelL1: 'All', channelL2: 'All', tariffL1: 'All', tariffL2: 'All',
  month: '2026-09', inputMode: 'percentage', amount: 0,
  target: 'cohorts', cohortScope: 'both', duration: 'one-off',
  originalBaseArpu: 12.5, name: '', comment: '',
};

// ── 1. THE ARITHMETIC — hand-written expectations ──────────────────────────
//
// The whole point of the mode: dilution POINTS do not translate into revenue
// percentage by subtraction. Anyone who thinks 25 -> 20 is "+5%" is making the
// error this card removes, so the numbers are stated literally here.
check('arithmetic: 25 -> 20 dilution gives +6.6667% retained revenue',
  near(dilutionAmountPct(25, 20) as number, 6.666666666666671, 1e-9),
  String(dilutionAmountPct(25, 20)));
check('arithmetic: and it is NOT +5 — subtraction is the error being removed',
  Math.abs((dilutionAmountPct(25, 20) as number) - 5) > 1,
  String(dilutionAmountPct(25, 20)));
check('arithmetic: 20 -> 25 dilution gives -6.25% (a worsening scenario is legal)',
  near(dilutionAmountPct(20, 25) as number, -6.25, 1e-9),
  String(dilutionAmountPct(20, 25)));
check('arithmetic: identity (current == target) is exactly 0, a no-op',
  dilutionAmountPct(20, 20) === 0, String(dilutionAmountPct(20, 20)));
check('arithmetic: the identity ratio is exactly 1',
  retainedRevenueRatio(20, 20) === 1, String(retainedRevenueRatio(20, 20)));
check('arithmetic: 0 -> 0 is a real statement, not absence',
  dilutionAmountPct(0, 0) === 0, String(dilutionAmountPct(0, 0)));

// ── 2. VALIDITY — absence, not a substituted 1.0 ───────────────────────────
for (const [c, t, why] of [
  [100, 20, 'current 100 is the denominator and would divide by zero'],
  [20, 100, 'target 100 is excluded by the same rule, so there is one rule'],
  [-1, 20, 'negative dilution is not a thing'],
  [20, -1, 'negative target is not a thing'],
  [NaN, 20, 'NaN'],
  [undefined as any, 20, 'absent current'],
  [20, undefined as any, 'absent target'],
] as [any, any, string][]) {
  check(`validity: (${String(c)}, ${String(t)}) yields ABSENCE not a number — ${why}`,
    dilutionAmountPct(c, t) === null);
}
check('validity: 99.99 is inside the range', isValidDilutionPct(99.99));
check('validity: 0 is inside the range', isValidDilutionPct(0));
check('validity: a valid pair returns a NUMBER, so the checks above are not vacuous',
  typeof dilutionAmountPct(25, 20) === 'number');

// ── 3. ROUND TRIP through the REAL writer and reader ───────────────────────
const dilution: PricingEvent = {
  ...base, id: 'p-dilution', pricingMode: 'dilution', cohortScope: 'retention',
  amount: dilutionAmountPct(25, 20) as number,
  dilutionCurrentPct: 25, dilutionTargetPct: 20,
};

const row = pricingEventExportRow(dilution);
check('export: the real writer emits the mode column', 'Pricing_Mode' in row);
check('export: and both stated figures', 'Dilution_Current_Pct' in row && 'Dilution_Target_Pct' in row);
check('export: the mode is written', row.Pricing_Mode === 'dilution', String(row.Pricing_Mode));
check('export: the figures are written as the USER stated them',
  row.Dilution_Current_Pct === 25 && row.Dilution_Target_Pct === 20,
  `${row.Dilution_Current_Pct}/${row.Dilution_Target_Pct}`);

const back = pricingEventFromRow(row as Record<string, unknown>);
check('round trip: the mode survives', back.pricingMode === 'dilution', String(back.pricingMode));
check('round trip: the stated current figure survives', back.dilutionCurrentPct === 25, String(back.dilutionCurrentPct));
check('round trip: the stated target figure survives', back.dilutionTargetPct === 20, String(back.dilutionTargetPct));
check('round trip: the derived amount survives', near(back.amount, dilution.amount), String(back.amount));
check('round trip: cohortScope is retention — a dilution event is retention-scoped',
  back.cohortScope === 'retention', back.cohortScope);
check('round trip: inputMode stays percentage — it rides the existing mechanism',
  back.inputMode === 'percentage', back.inputMode);

// THE RECOMPUTE CHECK. The stored amount and the amount derivable from the
// stored figures must agree — if they ever diverge, the event is lying about
// one of them, and which one is unknowable after the fact.
check('round trip: the restored figures RECOMPUTE the restored amount',
  near(dilutionAmountPct(back.dilutionCurrentPct, back.dilutionTargetPct) as number, back.amount),
  `${dilutionAmountPct(back.dilutionCurrentPct, back.dilutionTargetPct)} vs ${back.amount}`);

// ── 4. A PLAIN EVENT CARRIES NO MODE — the no-migration guarantee ──────────
const plain: PricingEvent = { ...base, id: 'p-plain', amount: -3, cohortScope: 'both' };
const plainRow = pricingEventExportRow(plain);
check('plain: the mode column is the EMPTY-STRING absence carrier',
  plainRow.Pricing_Mode === '', `"${plainRow.Pricing_Mode}"`);
check('plain: and both figure columns are too',
  plainRow.Dilution_Current_Pct === '' && plainRow.Dilution_Target_Pct === '');
const plainBack = pricingEventFromRow(plainRow as Record<string, unknown>);
check('plain: reads back with NO mode — pre-R5 events need no migration',
  plainBack.pricingMode === undefined, String(plainBack.pricingMode));
check('plain: and with the figures ABSENT, not zero',
  plainBack.dilutionCurrentPct === undefined && plainBack.dilutionTargetPct === undefined,
  `${plainBack.dilutionCurrentPct}/${plainBack.dilutionTargetPct}`);
check('plain: its own amount is untouched', plainBack.amount === -3, String(plainBack.amount));

// A STATED ZERO IS NOT ABSENCE — the presence rule, on this carrier.
const zeroStated: PricingEvent = {
  ...base, id: 'p-zero', pricingMode: 'dilution', cohortScope: 'retention',
  amount: 0, dilutionCurrentPct: 0, dilutionTargetPct: 0,
};
const zeroBack = pricingEventFromRow(pricingEventExportRow(zeroStated) as Record<string, unknown>);
check('stated zero: 0% dilution round-trips as 0, NOT as absence',
  zeroBack.dilutionCurrentPct === 0 && zeroBack.dilutionTargetPct === 0,
  `${zeroBack.dilutionCurrentPct}/${zeroBack.dilutionTargetPct}`);
check('stated zero: and keeps its mode', zeroBack.pricingMode === 'dilution');

// ── 5. THE ROW SUMMARY — what the user typed, not what was derived ─────────
//
// RE-AIMED IN R4, when pricingEventSummary gained a `t`. The old calls passed
// one argument and went red on the signature change — the anchor rule working:
// a change that rewrites what a check calls re-aims it in the same commit.
//
// `t` is built from the REAL en locale rather than stubbed, so a missing or
// renamed key fails here instead of surfacing as a raw key on screen.
const en = JSON.parse(fs.readFileSync('src/locales/en/translation.json', 'utf8'));
const t = (k: string, p?: Record<string, unknown>) => {
  let s = en[k];
  if (typeof s !== 'string') return `!!MISSING:${k}!!`;
  for (const [n, v] of Object.entries(p ?? {})) s = s.split(`{{${n}}}`).join(String(v));
  return s;
};
check('summary: the dilution key EXISTS in the real en locale',
  !t('whatif_summary_dilution', { from: 1, to: 2 }).startsWith('!!MISSING'));
check('summary: a dilution event describes itself in the user\'s own figures',
  pricingEventSummary(dilution, t) === '25% → 20% dilution', pricingEventSummary(dilution, t));
check('summary: and does NOT lead with the derived ARPU percentage',
  !pricingEventSummary(dilution, t).includes('6.6'), pricingEventSummary(dilution, t));
check('summary: a plain percentage event still reads as a percentage',
  pricingEventSummary(plain, t) === '-3%', pricingEventSummary(plain, t));
check('summary: a dilution event with a corrupt figure falls back rather than lying',
  pricingEventSummary({ ...dilution, dilutionCurrentPct: undefined }, t) !== '25% → 20% dilution');

// ── 6. WIRING — the app really uses these seams, and the route count ───────
const app = fs.readFileSync('src/App.tsx', 'utf8');
check('wiring: App exports pricing rows through the REAL writer',
  app.includes('pricingEvents.map(pricingEventExportRow)'),
  'a second inline row shape is how the copy problem starts');
check('wiring: App imports pricing rows through the REAL reader',
  app.includes('pricingRaw.map(pricingEventFromRow)'));

// ROUTE COUNT PINNED. Exactly one parse site today; a second must be a
// deliberate change that comes here first.
const readerCalls = app.split('pricingEventFromRow').length - 1;
check('wiring: EXACTLY ONE pricing import route calls the reader (plus the import)',
  readerCalls === 2, `${readerCalls} occurrences — 1 import + 1 call site expected`);

const tab = fs.readFileSync('src/components/WhatIfTab.tsx', 'utf8');
check('wiring: the card restores the mode on reopen',
  tab.includes('pricingMode: ev.pricingMode'),
  'the yieldArpuMode shape — an unrestored mode misrepresents the event');
check('wiring: and restores both stated figures',
  tab.includes('dilutionCurrentPct: ev.dilutionCurrentPct')
    && tab.includes('dilutionTargetPct: ev.dilutionTargetPct'));
check('wiring: the card computes the amount through the SHARED function',
  tab.includes('dilutionAmountPct('),
  'a second copy of the ratio is how the card and the saved event start disagreeing');
// Anchored on the CALL, not on its argument list — the previous form pinned
// `pricingEventSummary(pe)` and went red when R4 added the `t` parameter, which
// is a signature change rather than a wiring loss. Counted, so a second inline
// description appearing beside it also fails.
check('wiring: the row summary comes from the shared summariser, not inline JSX',
  (tab.split('pricingEventSummary(').length - 1) === 1,
  `${tab.split('pricingEventSummary(').length - 1} call sites in the card, expected 1`);

// THE APPLY LOOP MUST BE UNTOUCHED. R5 rides the existing mechanism; if this
// ever needs a dilution arm, the wiring is wrong and this check says so.
check('wiring: the pricing apply loop has NO dilution branch — it rides the mechanism',
  !/pricingMode\s*===\s*'dilution'[^\n]*\n?[^\n]*applyDelta/.test(tab)
    && !tab.includes('if (pe.pricingMode'),
  'the apply path must not know this mode exists');

// ── 8. THE WEIGHTING — hand-written literals, chosen to stay exact ─────────
//
// Deliberately round numbers so the expected values are computed by hand from
// the formula and land on exact binary fractions. Nothing below is produced by
// calling the function under test.
//
//   blend 100, +10% on a priced pool of 250 out of 1000:
//   priced ARPU = 110
//   weighted    = (250 x 110 + 750 x 100) / 1000 = 102.5
check('weighting: the priced pool moves the blend by its VOLUME SHARE',
  applyPricingToBlend(250, 110, 1000, 100) === 102.5,
  String(applyPricingToBlend(250, 110, 1000, 100)));
check('weighting: and NOT by the full ratio — that is the defect being fixed',
  applyPricingToBlend(250, 110, 1000, 100) !== 110);
check('weighting: pricing EVERYTHING is the full ratio, so nothing is over-damped',
  applyPricingToBlend(1000, 110, 1000, 100) === 110,
  String(applyPricingToBlend(1000, 110, 1000, 100)));
check('weighting: nothing priced leaves the blend untouched',
  applyPricingToBlend(0, 110, 1000, 100) === 100);
check('weighting: no volume at all leaves the blend untouched, not NaN',
  applyPricingToBlend(250, 110, 0, 100) === 100);

// Volume selection, per target/cohortScope — the same choice the apply path makes.
const VOLS = { inflow: 100, retention: 400, base: 1500 };  // total 2000
check('volumes: retention-scoped cohorts prices the retention volume only',
  JSON.stringify(pricedVolumesFor({ target: 'cohorts', cohortScope: 'retention' }, VOLS))
    === JSON.stringify({ pricedVol: 400, totalVol: 2000 }),
  JSON.stringify(pricedVolumesFor({ target: 'cohorts', cohortScope: 'retention' }, VOLS)));
check('volumes: both-scoped cohorts prices inflow + retention, not the base',
  pricedVolumesFor({ target: 'cohorts', cohortScope: 'both' }, VOLS)!.pricedVol === 500);
check('volumes: cohorts+base adds the base pool',
  pricedVolumesFor({ target: 'cohorts+base', cohortScope: 'retention' }, VOLS)!.pricedVol === 1900);
check('volumes: base-only returns ABSENCE — the display cannot decompose that pool',
  pricedVolumesFor({ target: 'base-only', cohortScope: 'both' }, VOLS) === null);

// The composed display figure, hand-computed:
//   blend 100, retention-scoped +10%, priced 400 of 2000
//   = (400 x 110 + 1600 x 100) / 2000 = 102
check('display: the composed blend matches the hand-computed weighting',
  pricingAdjustedBlend(
    { target: 'cohorts', cohortScope: 'retention', inputMode: 'percentage', amount: 10 },
    100, VOLS) === 102,
  String(pricingAdjustedBlend(
    { target: 'cohorts', cohortScope: 'retention', inputMode: 'percentage', amount: 10 }, 100, VOLS)));
check('display: base-only yields ABSENCE rather than an invented figure',
  pricingAdjustedBlend(
    { target: 'base-only', cohortScope: 'both', inputMode: 'percentage', amount: 10 },
    100, VOLS) === null);
check('display: missing volumes yield ABSENCE, never the unweighted figure',
  pricingAdjustedBlend(
    { target: 'cohorts', cohortScope: 'retention', inputMode: 'percentage', amount: 10 },
    100, null) === null);

// AGREEMENT, pinned structurally. The apply path and the display now reach the
// same arithmetic through the same function, so agreement is a property of the
// wiring rather than of two implementations happening to match. Both call
// sites in the apply path are counted, so losing one fails here.
check('agreement: the apply path calls the shared weighting at BOTH its sites',
  (tab.split('applyPricingToBlend(').length - 1) === 2,
  `${tab.split('applyPricingToBlend(').length - 1} call sites, expected 2`);
check('agreement: the apply path no longer inlines the weighting arithmetic',
  !tab.includes('(pricedVol * pricedARPU + (totalVol - pricedVol)'),
  'an inlined copy beside the shared call is how the two drift apart again');
check('agreement: the row and Preview Impact both read the composed display figure',
  (tab.split('pricingAdjustedBlend(').length - 1) === 2,
  `${tab.split('pricingAdjustedBlend(').length - 1} display call sites, expected 2`);

// ── 9. THE BLOCK REASON — one predicate, every term named ──────────────────
const M = '2026-09';
const cases: [string, any, string | null][] = [
  ['no month at all', {}, 'whatif_pricing_block_no_month'],
  ['Direct with no amount', { month: M }, 'whatif_pricing_block_no_amount'],
  ['Direct with an amount', { month: M, amount: -3 }, null],
  ['dilution, neither figure', { month: M, pricingMode: 'dilution' }, 'whatif_pricing_block_dilution_incomplete'],
  ['dilution, only current', { month: M, pricingMode: 'dilution', dilutionCurrentPct: 25 }, 'whatif_pricing_block_dilution_incomplete'],
  ['dilution, only target', { month: M, pricingMode: 'dilution', dilutionTargetPct: 20 }, 'whatif_pricing_block_dilution_incomplete'],
  ['dilution, current out of range', { month: M, pricingMode: 'dilution', dilutionCurrentPct: 100, dilutionTargetPct: 20 }, 'whatif_pricing_block_dilution_range'],
  ['dilution, negative target', { month: M, pricingMode: 'dilution', dilutionCurrentPct: 25, dilutionTargetPct: -1 }, 'whatif_pricing_block_dilution_range'],
  ['a complete dilution form', { month: M, pricingMode: 'dilution', dilutionCurrentPct: 25, dilutionTargetPct: 20 }, null],
];
for (const [name, draft, expected] of cases) {
  check(`gating: ${name} -> ${expected ?? 'ADDABLE'}`,
    pricingDraftBlockReason(draft) === expected,
    `got ${pricingDraftBlockReason(draft)}`);
}

// THE WALK'S DEFECT, pinned directly. A complete dilution form has NO Direct
// amount — that is the normal case, not an edge — and must be addable.
check('gating: THE WALK DEFECT — a dilution form with no Direct amount IS addable',
  pricingDraftBlockReason({
    month: M, pricingMode: 'dilution', dilutionCurrentPct: 25, dilutionTargetPct: 20,
    amount: undefined,
  }) === null,
  'a mode-blind amount test is what refused these forms silently');
check('gating: a stated ZERO dilution pair is addable — 0 is a real figure',
  pricingDraftBlockReason({ month: M, pricingMode: 'dilution', dilutionCurrentPct: 0, dilutionTargetPct: 0 }) === null);
check('gating: every reason is a key that EXISTS in the real en locale',
  cases.every(([, , r]) => r === null || typeof en[r] === 'string'),
  cases.filter(([, , r]) => r !== null && typeof en[r as string] !== 'string').map(c => c[2]).join(', '));

// ONE PREDICATE, not two. The handler must not keep a second copy of the rule.
check('gating: the button and the handler read the SAME predicate',
  (tab.split('pricingDraftBlockReason(').length - 1) === 2,
  `${tab.split('pricingDraftBlockReason(').length - 1} call sites, expected 2 (button memo + handler)`);
check('gating: the old mode-blind button condition is gone',
  !tab.includes('!newPricingEvent.month || newPricingEvent.amount === undefined'));
check('gating: the blocking reason is RENDERED, not merely computed',
  tab.includes('data-testid="pricing-block-reason"'),
  'a disabled control with no stated reason is the defect, not the fix');

// Switching Direct -> Dilution must not leave a stale Direct amount behind.
// Scoped to the mode button's own handler rather than a character window — the
// first form of this check allowed 600 chars and the real gap is 823, so it
// failed on correct code. A distance is not the property being asserted.
const dilBtn = tab.slice(tab.indexOf('data-testid="pricing-mode-dilution"'));
const dilBtnHandler = dilBtn.slice(0, dilBtn.indexOf('})}'));
check('gating: the dilution mode switch clears the stale Direct amount',
  dilBtnHandler.includes('amount: undefined'),
  'a leftover amount silently decided which forms could be added');

// ── 10. THE SHARED SCOPE PREDICATE ─────────────────────────────────────────
//
// Expectations hand-written from the rule, not derived by calling it: an event
// matches when, on every dimension, it is unscoped OR the view is unscoped OR
// the two agree.
const ALLVIEW = {
  segment: 'All', productL1: null, productL2: null,
  channelL1: null, channelL2: null, tariffL1: null, tariffL2: null,
};
const CORPVIEW = { ...ALLVIEW, segment: 'Corporate' };

check('scope: an unscoped event matches every view',
  eventScopeMatchesView({ segment: 'All' }, CORPVIEW));
check('scope: a Corporate event matches the Corporate view',
  eventScopeMatchesView({ segment: 'Corporate' }, CORPVIEW));
check('scope: a Corporate event does NOT match the Consumer view',
  !eventScopeMatchesView({ segment: 'Corporate' }, { ...ALLVIEW, segment: 'Consumer' }),
  'this is the tooltip defect: events listed over lines they cannot move');
// PARTIAL APPLICATION STILL MATCHES — the rule chosen, asserted so it is a
// decision rather than an accident of the implementation.
check('scope: a Corporate event STILL matches the all-segments view (partial)',
  eventScopeMatchesView({ segment: 'Corporate' }, ALLVIEW),
  'a view broader than the event still shows it — it moves part of what is on screen');
check('scope: a dimension the carrier lacks is treated as no filter',
  eventScopeMatchesView({ segment: 'Corporate' }, { ...CORPVIEW, productL2: 'Premium' }),
  'yield events have no productL2 and must not be excluded for lacking one');
check('scope: a mismatch on ANY dimension excludes',
  !eventScopeMatchesView({ segment: 'Corporate', channelL1: 'Retail' },
    { ...CORPVIEW, channelL1: 'Direct' }));

// The predicate has ONE definition and the tooltip uses it rather than its own.
check('scope wiring: the tooltip filters through the shared predicate',
  (tab.split('eventScopeMatchesView(').length - 1) >= 4,
  `${tab.split('eventScopeMatchesView(').length - 1} call sites — apply path + three carriers in the tooltip`);
check('scope wiring: the pricing apply filter no longer hand-rolls the comparisons',
  !tab.includes('const segOk  = pe.segment   ===') && !tab.includes('const tar2Ok = !pe.tariffL2'),
  'the seven inline comparisons are what the shared predicate replaced');

// ── 11. THE EVENT-SCOPED BASELINE ──────────────────────────────────────────
check('baseline: the snapshot runs the pipeline against the EVENT dims',
  tab.includes('const eventScopeSeries = computeAdjustedForecast('),
  'it read chartData, which is scoped to the LOADED COHORT, not to the event');
// EXACTLY ONE chartData lookup for the draft month survives, and it is PREVIEW
// IMPACT — which legitimately shows the effect on the slice the user is looking
// at. The SAVE HANDLER no longer uses it. The first form of this check asserted
// the string was gone entirely and failed on correct code.
check('baseline: the save handler no longer reads the cohort-scoped chartData',
  (tab.split('chartData.find(r => r.month === newPricingEvent.month)').length - 1) === 1,
  `${tab.split('chartData.find(r => r.month === newPricingEvent.month)').length - 1} sites, expected 1 (Preview Impact only)`);
check('baseline: the event being edited is EXCLUDED, so the basis is pre-this-event',
  tab.includes('pricingEvents.filter(p => p.id !== editingPricingId)'),
  'otherwise an edit measures the event against a blend that already contains it');
check('baseline: dims go through dimOrNull, so All and absent both mean no filter',
  tab.includes('viewProduct: { l1: dimOrNull(newPricingEvent.product)'));

// ── 12. NAME ON THE CARDS' OWN LISTS ───────────────────────────────────────
check('names: the pricing list renders a Name cell with the per-kind fallback',
  tab.includes("t('whatif_summary_unnamed_pricing')"),
  'the summary table named events while the card that owns them did not');
check('names: the yield list does too',
  tab.includes("t('whatif_summary_unnamed_yield')"));
// THREE, not two: the R4 summary table's own header is the third, and reusing
// its key across all three is the point — one vocabulary, not a second. The
// first expectation here was 2 and the run corrected it.
check('names: all three Name headers share ONE label key, not a second vocabulary',
  (tab.split("t('whatif_summary_col_name')").length - 1) === 3,
  `${tab.split("t('whatif_summary_col_name')").length - 1} Name headers, expected 3 (summary + pricing + yield)`);
// FLAGGED BY PRESENCE, not inferred from the rendered string — the same rule
// the summary table uses, so typing the fallback text does not fake a name.
check('names: the fallback is chosen by presence, not by comparing the string',
  tab.includes("(pe.name || '').trim() ? 'text-slate-700' : 'italic text-slate-400'"));

console.log(`\npricing-roundtrip spec: ${pass} passed, ${fails.length} failed`);
fails.forEach(f => console.log('  FAIL  ' + f));
process.exit(fails.length ? 1 : 0);

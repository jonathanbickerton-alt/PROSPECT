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

console.log(`\npricing-roundtrip spec: ${pass} passed, ${fails.length} failed`);
fails.forEach(f => console.log('  FAIL  ' + f));
process.exit(fails.length ? 1 : 0);

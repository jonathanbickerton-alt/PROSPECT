/**
 * THE COMBINED EVENTS SUMMARY — R4.
 *
 *   npm run spec:events-summary
 *
 * Drives the REAL summarisers and the REAL projection over constructed events
 * of all FOUR kinds across all THREE carriers.
 *
 * WHAT IT IS CAREFUL ABOUT:
 *
 *  - EXPECTED RENDERINGS ARE HAND-WRITTEN. Not one expectation below is
 *    produced by calling the function under test. A spec that builds its
 *    expectation with `volumeEventSummary` and then asserts equality with
 *    `volumeEventSummary` passes whatever that function does, including
 *    nothing.
 *  - `t` COMES FROM THE REAL en LOCALE. A missing or renamed key fails here
 *    rather than reaching the screen as a raw key in five languages.
 *  - IT PINS ORDER AS A SEQUENCE, not as a set. The decisive check is that a
 *    LATER month on an earlier pass still sorts ABOVE an earlier month on a
 *    later pass — the assertion that distinguishes pipeline order from a
 *    chronological sort, which is the mistake the design exists to avoid.
 *  - IT PINS KIND COVERAGE BY COUNT. A projection that silently dropped a
 *    carrier would otherwise pass every remaining check.
 */
import fs from 'fs';
import {
  buildEventsSummaryRows, volumeEventSummary, promoEventSummary,
  yieldEventSummary, pricingEventSummary,
} from '../src/utils/forecasting';
import type { MarketEvent, YieldEventLike } from '../src/utils/forecasting';
import type { PricingEvent } from '../src/types/forecast';

let pass = 0; const fails: string[] = [];
const check = (n: string, c: boolean, d?: string) => { if (c) pass++; else fails.push(n + (d ? `  [${d}]` : '')); };

const en = JSON.parse(fs.readFileSync('src/locales/en/translation.json', 'utf8'));
const t = (k: string, p?: Record<string, unknown>) => {
  let s = en[k];
  if (typeof s !== 'string') return `!!MISSING:${k}!!`;
  for (const [n, v] of Object.entries(p ?? {})) s = s.split(`{{${n}}}`).join(String(v));
  return s;
};

// Every key the summarisers and the panel reach for. Checked FIRST, because a
// missing key turns every rendering assertion below into a comparison of two
// error strings.
const KEYS = [
  'whatif_summary_dilution', 'whatif_summary_volume', 'whatif_summary_promo_volume',
  'whatif_summary_promo_mix', 'whatif_summary_yield', 'whatif_summary_scope_all',
  'whatif_summary_recurring', 'whatif_summary_card_value', 'whatif_summary_card_pricing',
  'whatif_summary_unnamed_volume', 'whatif_summary_unnamed_promo',
  'whatif_summary_unnamed_yield', 'whatif_summary_unnamed_pricing',
  'whatif_summary_title', 'whatif_summary_count', 'whatif_summary_order_note',
  'whatif_summary_empty', 'whatif_summary_col_card', 'whatif_summary_col_name',
  'whatif_summary_col_adjusts', 'whatif_summary_col_scope', 'whatif_summary_col_when',
  'whatif_volume', 'whatif_promotion', 'whatif_tier', 'whatif_tariff', 'whatif_all_fwd',
];
const missing = KEYS.filter(k => typeof en[k] !== 'string');
check('i18n: every key the summary needs exists in en', missing.length === 0, missing.join(', '));

// ── Constructed events, one per kind ───────────────────────────────────────
const mkMarket = (o: Partial<MarketEvent>): MarketEvent => ({
  id: 'm', scenario: 'Inflow', segment: 'Corporate', product: 'All',
  channel: 'All', date: '2026-06', sequence: 1, subscriberVolume: 1000,
  customerVolume: 0, revenue: 0, arpu: 0, campaignName: '', comment: '',
  contractLength: 12, ...o,
} as MarketEvent);

const volume = mkMarket({
  id: 'v1', date: '2026-06', subscriberVolume: 1200, campaignName: 'Spring push',
  segment: 'Corporate', product: 'Mobile',
});
const volumePct = mkMarket({
  id: 'v2', date: '2026-07', subscriberVolume: 5, amountType: 'percentage', scenario: 'Retention',
});
const promo = mkMarket({
  id: 'p1', date: '2026-05', isPromotion: true, subscriberVolume: 800,
  campaignName: 'Summer promo', promoMixAxis: 'value',
  promoMix: { A: 50, B: 50 }, promoPricingMode: 'percentage', promoPricingAmount: -10,
});

const yieldEv: YieldEventLike = {
  id: 'y1', ibro: 'Inflow', segment: 'Corporate', product: 'All',
  channelL1: 'All', channelL2: 'All', month: '2026-01',
  tariffMix: { A: 50, B: 50 }, tariffBaseArpu: { A: 10, B: 20 },
  rollForward: true, name: 'Mix shift',
};

const basePricing: PricingEvent = {
  id: 'x', segment: 'All', product: 'All', productL2: 'All',
  channelL1: 'All', channelL2: 'All', tariffL1: 'All', tariffL2: 'All',
  month: '2026-03', inputMode: 'percentage', amount: -3,
  target: 'cohorts', cohortScope: 'both', duration: 'one-off',
  originalBaseArpu: 12, name: '', comment: '',
};
const pricingPlain: PricingEvent = { ...basePricing, id: 'pr1', name: 'Price cut' };
const pricingDilution: PricingEvent = {
  ...basePricing, id: 'pr2', month: '2026-02', duration: 'recurring',
  pricingMode: 'dilution', cohortScope: 'retention',
  amount: 6.666666666666671, dilutionCurrentPct: 25, dilutionTargetPct: 20,
};

// ── 1. SUMMARISERS — hand-written expected renderings ──────────────────────
check('volume: reads as scenario + a counted amount',
  volumeEventSummary(volume, t) === 'Inflow +1,200', volumeEventSummary(volume, t));
check('volume: a PERCENTAGE event says so rather than reading as a count',
  volumeEventSummary(volumePct, t) === 'Retention +5%', volumeEventSummary(volumePct, t));
check('promo: reports the volume and BOTH arms it carries',
  promoEventSummary(promo, t) === 'Promotion 800 · 2-band Tier mix · -10%',
  promoEventSummary(promo, t));
check('promo: an arm the event does not carry is not invented',
  promoEventSummary(mkMarket({ id: 'p2', isPromotion: true, subscriberVolume: 50 }), t)
    === 'Promotion 50',
  promoEventSummary(mkMarket({ id: 'p2', isPromotion: true, subscriberVolume: 50 }), t));
check('yield: reports cohort, band count and the blended rate',
  yieldEventSummary(yieldEv, t) === 'Inflow mix, 2 bands → 15.00',
  yieldEventSummary(yieldEv, t));
check('yield: an unknown blend says so rather than printing 0.00',
  yieldEventSummary({ ...yieldEv, tariffBaseArpu: {} }, t).includes(en.whatif_mix_blend_unknown),
  yieldEventSummary({ ...yieldEv, tariffBaseArpu: {} }, t));
check('pricing: a dilution event reads in the USER\'s figures',
  pricingEventSummary(pricingDilution, t) === '25% → 20% dilution',
  pricingEventSummary(pricingDilution, t));
check('pricing: and NOT as the derived percentage',
  !pricingEventSummary(pricingDilution, t).includes('6.6'));

// ── 2. THE PROJECTION — three carriers, four kinds ─────────────────────────
const rows = buildEventsSummaryRows(
  { marketEvents: [volume, volumePct, promo], yieldEvents: [yieldEv], pricingEvents: [pricingPlain, pricingDilution] },
  t);

check('coverage: every constructed event reaches the table', rows.length === 6, `${rows.length}`);
const cards = new Set(rows.map(r => r.card));
check('coverage: all FOUR cards are represented',
  cards.has('Volume') && cards.has('Promotion') && cards.has('Value') && cards.has('Pricing'),
  [...cards].join(', '));
// COUNT PER CARRIER — a projection that dropped a carrier would pass a bare
// "all four cards present" check if any one row of that kind survived.
check('coverage: 3 market rows, 1 yield row, 2 pricing rows',
  rows.filter(r => r.pass === 0).length === 3
    && rows.filter(r => r.pass === 1).length === 1
    && rows.filter(r => r.pass === 2).length === 2,
  rows.map(r => r.pass).join(''));
check('coverage: the collapsed header count equals the sum over the three arrays',
  rows.length === 3 + 1 + 2);

// ── 3. PIPELINE ORDER — the decisive assertion ─────────────────────────────
check('order: passes are non-decreasing — market, then yield, then pricing',
  rows.every((r, i) => i === 0 || rows[i - 1].pass <= r.pass),
  rows.map(r => r.pass).join(''));
check('order: within a pass, month ascends',
  rows.filter(r => r.pass === 0).map(r => r.month).join() === '2026-05,2026-06,2026-07',
  rows.filter(r => r.pass === 0).map(r => r.month).join());

// THE CHECK THAT DISTINGUISHES PIPELINE ORDER FROM A TIMELINE. The yield event
// is 2026-01 — earlier than every market event — and must still sort BELOW
// them, because it applies in a later pass. A chronological sort would put it
// first, and would be a plausible-looking lie about what happens when.
const firstYield = rows.findIndex(r => r.pass === 1);
const lastMarket = rows.map(r => r.pass).lastIndexOf(0);
check('order: an EARLIER-month yield event still sorts BELOW later-month market events',
  firstYield > lastMarket,
  `yield at ${firstYield}, last market at ${lastMarket} — chronological sorting would invert this`);
check('order: and the pricing pass sits last despite holding the earliest pricing month',
  rows[rows.length - 1].pass === 2 && rows[rows.length - 2].pass === 2);
check('order: within pricing, the recurring 2026-02 event precedes the 2026-03 one',
  rows.filter(r => r.pass === 2).map(r => r.month).join() === '2026-02,2026-03',
  rows.filter(r => r.pass === 2).map(r => r.month).join());

// ── 4. NAMES — campaignName, name, and the italic fallbacks ────────────────
check('name: a market event prefers its campaignName',
  rows.find(r => r.id === 'v1')!.name === 'Spring push');
check('name: a yield event uses its name', rows.find(r => r.id === 'y1')!.name === 'Mix shift');
check('name: an unnamed volume event falls back and is FLAGGED as a fallback',
  rows.find(r => r.id === 'v2')!.name === 'Unnamed volume event'
    && rows.find(r => r.id === 'v2')!.unnamed === true);
check('name: the unnamed fallback is per-KIND, not one generic string',
  rows.find(r => r.id === 'pr2')!.name === 'Unnamed pricing event');
check('name: a named event is NOT flagged as unnamed — the flag drives italics',
  rows.find(r => r.id === 'v1')!.unnamed === false);

// ── 5. SCOPE AND WHEN — absence rendered, not left blank ───────────────────
check('scope: wildcards are omitted, real dims kept',
  rows.find(r => r.id === 'v1')!.scope === 'Corporate / Mobile',
  rows.find(r => r.id === 'v1')!.scope);
check('scope: an all-wildcard event says All rather than showing an empty cell',
  rows.find(r => r.id === 'pr1')!.scope === 'All',
  rows.find(r => r.id === 'pr1')!.scope);
check('when: a yield event with rollForward says so',
  rows.find(r => r.id === 'y1')!.when === '2026-01 · All Fwd',
  rows.find(r => r.id === 'y1')!.when);
check('when: a recurring pricing event says so',
  rows.find(r => r.id === 'pr2')!.when === '2026-02 · recurring',
  rows.find(r => r.id === 'pr2')!.when);
check('when: a market event, whose carrier has NO duration field, shows the month alone',
  rows.find(r => r.id === 'v1')!.when === '2026-06',
  rows.find(r => r.id === 'v1')!.when);

// ── 6. EMPTY AND PARTIAL ───────────────────────────────────────────────────
check('empty: no events across all three carriers yields no rows',
  buildEventsSummaryRows({ marketEvents: [], yieldEvents: [], pricingEvents: [] }, t).length === 0);
const partial = buildEventsSummaryRows({ marketEvents: [], yieldEvents: [yieldEv], pricingEvents: [] }, t);
check('partial: only the carriers that have events appear', partial.length === 1 && partial[0].pass === 1);
check('partial: and no placeholder row is invented for the absent kinds',
  !partial.some(r => r.pass === 0 || r.pass === 2));

// ── 7. WIRING ──────────────────────────────────────────────────────────────
const tab = fs.readFileSync('src/components/WhatIfTab.tsx', 'utf8');
// RE-AIMED 2026-08-19, R6 session 2. These three grepped WhatIfTab for the
// TABLE'S MARKUP, which was right while the table lived inline there. Scenario
// Compare needs the same table once per loaded file, so it was extracted to
// EventsSummaryTable and these anchors went red — stale in the direction that
// FAILS, which is the only acceptable direction for an anchor to go stale.
//
// What they guard is unchanged: the table states its order, has an empty state,
// and is height-capped. Only its address changed. The projection check stays on
// WhatIfTab, because building rows is still the CALLER's job — the shared
// component renders and must never build.
const table = fs.readFileSync('src/components/EventsSummaryTable.tsx', 'utf8');
check('wiring: the card renders the table from the shared projection',
  (tab.split('buildEventsSummaryRows(').length - 1) === 1,
  'a second projection is how the table and the cards start disagreeing');
check('wiring: the card passes those rows to the shared table component',
  (tab.match(/<EventsSummaryTable/g) ?? []).length === 1,
  'a re-inlined table would put Compare and What-If back on two copies');
check('wiring: the panel states the order rather than leaving it inferred',
  table.includes('whatif_summary_order_note'));
check('wiring: the panel has an empty state', table.includes('whatif_summary_empty'));
check('wiring: the expanded table is height-capped so it cannot push the cards away',
  table.includes('max-h-[320px]'));

// THE EXISTING CARD LISTS ARE NOT TOUCHED — decision 2. Their differing sorts
// are deliberate, and this is what says so if a later change harmonises them
// by accident.
check('wiring: the Volume list still sorts by sequence', tab.includes('.sort(bySequence)'));
// THREE month sorts, and the count is 3 rather than 2 for a reason worth
// stating: the pricing APPLY pass sorts by month as well as the two lists do.
// The first expectation here was 2, and the run corrected it — the sites are
// the pricing apply pass, the pricing list and the yield list.
check('wiring: the pricing and yield lists still sort by month (+ the apply pass)',
  (tab.split(".sort((a, b) => a.month.localeCompare(b.month))").length - 1) === 3,
  `${tab.split(".sort((a, b) => a.month.localeCompare(b.month))").length - 1} month sorts, expected 3`);

// ── R7 — THE CHURN SENTENCE, from stored figures only ─────────────────────
//
// The row is a SAVE-TIME RECORD, so the summariser reads what it stored. Any
// re-derivation here would describe a base that has since moved — the
// describe-never-re-derive rule, which is why the expected string is written
// out rather than computed.
{
  const churn = mkMarket({
    id: 'ch1', scenario: 'Outflow', subscriberVolume: 2.4,
    churnMode: 'churn', churnCurrentPct: 24.5, churnTargetPct: 3,
  } as any);
  check('R7 SUMMARY: a churn row reads as a rate moving, not a volume',
    volumeEventSummary(churn as any, t) === 'Churn 24.5% → 21.5%',
    volumeEventSummary(churn as any, t));

  // A ZERO stated reduction is a real statement and must still read as one.
  const zero = mkMarket({ id: 'ch2', scenario: 'Outflow', subscriberVolume: 0,
    churnMode: 'churn', churnCurrentPct: 24.5, churnTargetPct: 0 } as any);
  check('R7 SUMMARY: a zero-point month still states both rates',
    volumeEventSummary(zero as any, t) === 'Churn 24.5% → 24.5%',
    volumeEventSummary(zero as any, t));

  // A reduction larger than the rate floors at zero rather than going negative.
  const over = mkMarket({ id: 'ch3', scenario: 'Outflow', subscriberVolume: 20,
    churnMode: 'churn', churnCurrentPct: 2, churnTargetPct: 9 } as any);
  check('R7 SUMMARY: the target never reads negative',
    over.churnMode === 'churn' && volumeEventSummary(over as any, t) === 'Churn 2.0% → 0.0%',
    volumeEventSummary(over as any, t));

  // A PLAIN outflow row is untouched by the churn branch.
  const plain = mkMarket({ id: 'v1', scenario: 'Outflow', subscriberVolume: -500 } as any);
  check('R7 SUMMARY: a plain outflow row keeps its ordinary sentence',
    !volumeEventSummary(plain as any, t).startsWith('Churn'),
    volumeEventSummary(plain as any, t));

  check('R7 SUMMARY: the churn key exists in all six locales',
    ['en','de','es','fr','it','pt'].every(l =>
      typeof JSON.parse(fs.readFileSync(`src/locales/${l}/translation.json`,'utf8'))['whatif_summary_churn'] === 'string'));
}
console.log(`\nevents-summary spec: ${pass} passed, ${fails.length} failed`);
fails.forEach(f => console.log('  FAIL  ' + f));
process.exit(fails.length ? 1 : 0);

/**
 * "N EVENTS APPLIED" COUNTS WHAT WAS APPLIED AT THIS VIEW.
 *
 *   npm run spec:applied-count
 *
 * Decision, Jon 2026-09-02. The caption read `marketEvents.length` — every
 * event in the store, whatever the filter — so it printed the same number at
 * every view and could not disagree with the two deltas beside it.
 *
 * WHY THAT MATTERS MORE THAN A WRONG NUMBER. During UAT-D2-03 a leaf-scoped
 * event showed "1 event applied" at an aggregate whose Base delta was +0.00.
 * The caption was read as corroboration that the event had reached the
 * aggregate and the delta was therefore wrong. It was not corroboration of
 * anything: it would have printed "1" at a view the engine never touched. A
 * caption that cannot be wrong cannot be evidence either.
 *
 * The engine already reports what it applied — `appliedEventIds`, per month,
 * straight out of `applyEventsToMonth`. The distinct union across months is the
 * honest count and comes from the same pass that produced the deltas.
 *
 * THE TEST IS A DISAGREEMENT. Both checks below use the SAME store of two
 * events; what changes is the view. A count that still tracked the array would
 * read 2 at both and fail the second.
 */
import * as fs from 'fs';
import { computeAdjustedForecast } from '../src/components/WhatIfTab';

let pass = 0; const fails: string[] = [];
const check = (n: string, c: boolean, d?: string) => { if (c) pass++; else fails.push(n + (d ? `  [${d}]` : '')); };

const M = ['2026-07', '2026-08'];
const band = (v: number) => ({ mean: v, optimistic: v, pessimistic: v });

/** TWO leaves with DIFFERENT inflow — asserted below before anything uses it. */
const LEAF_A = { segment: 'Corporate', product: 'Mobile Voice', productL2: 'All',
                 channel: 'Direct', channelL2: 'All', tariffL1: 'All', tariffL2: 'All' };
const LEAF_B = { segment: 'SME', product: 'Mobile Data', productL2: 'All',
                 channel: 'Direct', channelL2: 'All', tariffL1: 'All', tariffL2: 'All' };
const LEAVES = [{ ...LEAF_A, volume: 300, hasMetricData: true },
                { ...LEAF_B, volume: 700, hasMetricData: true }];

const bf = (inflow: number) => ({
  cohort: { segment: 'All', product: 'All', productL2: 'All', channel: 'All',
            channelL2: 'All', tariffL1: 'All', tariffL2: 'All', scenario: 'Base Case' },
  seedBaseVolume: 10000, seedBaseKnown: true,
  lastHistoricalInflow: 0, lastHistoricalOutflow: 0, historicalMonths: ['2026-06'],
  months: M.map(month => ({ month, inflow: band(inflow), outflow: band(0), retention: band(0),
    arpu: { mean: 20 }, inflowArpu: { mean: 20 }, outflowArpu: { mean: 20 },
    retentionArpu: { mean: 20 }, baseArpu: { mean: 20 } })),
  provenance: { kind: 'fitted', modelUsed: 'Holt Linear' },
});
const ALLV = { l1: null, l2: null };
const run = (bfx: any, seg: string, prod: any, chan: any, events: any[]) =>
  computeAdjustedForecast({
    baseForecast: bfx, marketEvents: events, yieldEvents: [], pricingEvents: [],
    viewSegment: seg, viewProduct: prod as any, viewChannel: chan as any, viewTariff: ALLV as any,
    data: [], wiSegmentCol: '', wiProductCol: '', wiProductL2Col: '',
    wiChannelCol: '', wiChannelL2Col: '', wiTariffL1Col: '', wiTariffL2Col: '',
    wiValueCol: '', proRataLeavesOverride: LEAVES,
  } as any);

/** The quantity the caption now reads — copied from nothing; this IS the rule. */
const appliedAtView = (r: any) => {
  const s = new Set<string>();
  for (const m of r.adjustedMonths) for (const id of m.appliedEventIds ?? []) s.add(id);
  return s.size;
};

const evt = (id: string, seg: string, prod: string) => ({
  id, date: M[0], sequence: 1, scenario: 'Inflow', name: id,
  segment: seg, product: prod, productL2: 'All', channel: 'Direct', channelL2: 'All',
  tariffL1: 'All', tariffL2: 'All',
  subscriberVolume: 50, amountType: 'absolute', revenue: 0, customerVolume: 0, arpu: 0,
});
const STORE = [evt('E_CORP', 'Corporate', 'Mobile Voice'), evt('E_SME', 'SME', 'Mobile Data')];

// ---------------------------------------------------------------------------
// 0. THE FIXTURE DISCRIMINATES — asserted before anything is asserted on it.
// ---------------------------------------------------------------------------
check('fixture: two leaves', LEAVES.length === 2);
check('fixture: their inflows DIFFER — a share and a coverage cannot coincide',
  LEAVES[0].volume !== LEAVES[1].volume, `${LEAVES[0].volume} vs ${LEAVES[1].volume}`);
check('fixture: neither leaf inflow is zero',
  LEAVES.every(l => l.volume > 0), LEAVES.map(l => l.volume).join('/'));
check('fixture: the store holds TWO events, so a view-scoped count can differ from it',
  STORE.length === 2);

// ---------------------------------------------------------------------------
// 1. THE COUNT FOLLOWS THE VIEW.
// ---------------------------------------------------------------------------
{
  const rAll = run(bf(1000), 'All', ALLV, ALLV, STORE);
  check('ALL view: both events applied', appliedAtView(rAll) === 2, `${appliedAtView(rAll)}`);

  const rCorp = run(bf(300), 'Corporate', { l1: 'Mobile Voice', l2: null }, { l1: 'Direct', l2: null }, STORE);
  check('Corporate/Mobile Voice view: ONE event applied, not two',
    appliedAtView(rCorp) === 1, `${appliedAtView(rCorp)} — the array length is 2`);

  const rSme = run(bf(700), 'SME', { l1: 'Mobile Data', l2: null }, { l1: 'Direct', l2: null }, STORE);
  check('SME/Mobile Data view: the OTHER one event applied',
    appliedAtView(rSme) === 1, `${appliedAtView(rSme)}`);

  // The decisive one: a view where NEITHER event belongs. The array is still 2.
  const rNone = run(bf(100), 'MNC', { l1: 'IoT Connectivity', l2: null }, { l1: 'Indirect', l2: null }, STORE);
  check('a view no event targets: ZERO applied, though the store still holds two',
    appliedAtView(rNone) === 0,
    `${appliedAtView(rNone)} — this is the check marketEvents.length cannot pass`);

  // And the count is never larger than the store, at any view.
  for (const [label, r] of [['All', rAll], ['Corporate', rCorp], ['SME', rSme], ['MNC', rNone]] as any[]) {
    check(`${label}: the count never exceeds the store`, appliedAtView(r) <= STORE.length);
  }
}

// ---------------------------------------------------------------------------
// 2. THE CARD READS THAT QUANTITY. Source-level: the caption is a useMemo the
//    mounted harness does not reach, and the defect was one identifier.
// ---------------------------------------------------------------------------
{
  const src = fs.readFileSync('src/components/WhatIfTab.tsx', 'utf8');
  check('CARD: the summary no longer counts the raw array',
    !src.includes('eventCount: marketEvents.length'),
    'that count is identical at every view and cannot disagree with the deltas beside it');
  check('CARD: it counts distinct applied ids', src.includes('eventCount: appliedHere.size'));
  check('CARD: gathered from the engine\'s own appliedEventIds',
    src.includes('for (const m of adjustedMonths) for (const id of m.appliedEventIds ?? []) appliedHere.add(id);'),
    're-deriving it beside the engine would drift from what the engine did');
  check('CARD: the memo depends on adjustedMonths, not on the array length',
    src.includes('}, [chartData, adjustedMonths]);'),
    'a stale dep would freeze the count on a filter change — the 2343 prop-stability lesson');
}

console.log(`applied-count spec: ${pass} passed, ${fails.length} failed`);
fails.forEach(f => console.log('  FAIL ' + f));
process.exit(fails.length ? 1 : 0);

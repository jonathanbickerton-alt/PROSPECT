/**
 * THE ARPU COMPANION IS A RATE, IN BOTH VOLUME MODES — UAT-D2-02.
 *
 *   npm run spec:arpu-companion
 *
 * The events table showed a stated companion of 25 on a PERCENTAGE-mode volume
 * event as "+25.0%". It is money per subscriber, and the row's `fmtDelta` keys
 * off `isPercentage` — which describes `subscriberVolume`, not the companion.
 * Right for the three volume cells, wrong for this one.
 *
 * WHAT WAS MEASURED BEFORE ANYTHING WAS CHANGED, and what it settles:
 *
 *   % 10 + companion 25    inflow 1000 -> 1100   ARPU 20.0000 / 20.0500 / 20.0400
 *   abs 100 + companion 25 inflow 1000 -> 1100   ARPU 20.0000 / 20.0500 / 20.0400
 *
 * Two events that add the SAME hundred subscribers with the same companion
 * produce byte-identical adjusted ARPU. The engine already treats 25 as a rate;
 * a percent reading could not coincide with the absolute case. So the stored row
 * was right, the engine was right, and only the display was wrong — which is why
 * the fix is one formatter and no semantics moved.
 *
 * THIS SPEC DOES NOT PIN THE COMPANION'S MODE. Jon has decided it gets its own
 * absolute/% mode, independent of the volume mode; that is a separate build.
 * What is pinned here is the thing that build must not silently undo: today the
 * companion is a rate in both modes, and the row must say so.
 */
import * as fs from 'fs';
import { computeAdjustedForecast } from '../src/components/WhatIfTab';
import { eventArpuDelta } from '../src/utils/forecasting';

let pass = 0; const fails: string[] = [];
const check = (n: string, c: boolean, d?: string) => { if (c) pass++; else fails.push(n + (d ? `  [${d}]` : '')); };
const near = (a: number, b: number, eps = 1e-9) => Math.abs(a - b) <= eps;

const M = ['2026-07', '2026-08', '2026-09'];
const band = (v: number) => ({ mean: v, optimistic: v, pessimistic: v });
const LEAVES = [{ segment: 'All', product: 'All', productL2: 'All', channel: 'All',
                  channelL2: 'All', tariffL1: 'All', tariffL2: 'All',
                  volume: 1000, hasMetricData: true }];
const BF: any = {
  cohort: { segment: 'All', product: 'All', productL2: 'All', channel: 'All',
            channelL2: 'All', tariffL1: 'All', tariffL2: 'All', scenario: 'Base Case' },
  seedBaseVolume: 10000, seedBaseKnown: true,
  lastHistoricalInflow: 0, lastHistoricalOutflow: 0, historicalMonths: ['2026-06'],
  months: M.map(month => ({ month, inflow: band(1000), outflow: band(0), retention: band(0),
    arpu: { mean: 20 }, inflowArpu: { mean: 20 }, outflowArpu: { mean: 20 },
    retentionArpu: { mean: 20 }, baseArpu: { mean: 20 } })),
  provenance: { kind: 'fitted', modelUsed: 'Holt Linear' },
};
const ALLV = { l1: null, l2: null };
const run = (events: any[]) => computeAdjustedForecast({
  baseForecast: BF, marketEvents: events, yieldEvents: [], pricingEvents: [],
  viewSegment: 'All', viewProduct: ALLV as any, viewChannel: ALLV as any, viewTariff: ALLV as any,
  data: [], wiSegmentCol: '', wiProductCol: '', wiProductL2Col: '',
  wiChannelCol: '', wiChannelL2Col: '', wiTariffL1Col: '', wiTariffL2Col: '',
  wiValueCol: '', proRataLeavesOverride: LEAVES,
} as any);

const base = { id: 'E1', date: M[0], sequence: 1, scenario: 'Inflow',
  segment: 'All', product: 'All', productL2: 'All', channel: 'All', channelL2: 'All',
  tariffL1: 'All', tariffL2: 'All', revenue: 0, customerVolume: 0, name: 'p' };
const PCT  = [{ ...base, subscriberVolume: 10,  amountType: 'percentage', arpu: 25, arpuOverride: 25 }];
const ABS  = [{ ...base, subscriberVolume: 100, amountType: 'absolute',   arpu: 25, arpuOverride: 25 }];
const NONE = [{ ...base, subscriberVolume: 10,  amountType: 'percentage', arpu: 0 }];

// ---------------------------------------------------------------------------
// 0. THE FIXTURE DISCRIMINATES. Asserted before anything is asserted on it: the
//    two events must add the SAME subscribers, or an identical ARPU series
//    would prove nothing about how the companion is read.
// ---------------------------------------------------------------------------
const rPct = run(PCT), rAbs = run(ABS), rNone = run(NONE);
check('fixture: both events add the same inflow',
  rPct.chartData[0]['Inflow (Adjusted)'] === rAbs.chartData[0]['Inflow (Adjusted)'],
  `${rPct.chartData[0]['Inflow (Adjusted)']} vs ${rAbs.chartData[0]['Inflow (Adjusted)']}`);
check('fixture: and that inflow is 1100, not the baseline 1000',
  rPct.chartData[0]['Inflow (Adjusted)'] === 1100,
  `${rPct.chartData[0]['Inflow (Adjusted)']}`);
check('fixture: the companion DIFFERS from the cohort ARPU — a wrong read cannot hide',
  Number((PCT[0] as any).arpuOverride) !== Number(BF.months[0].arpu.mean),
  `${(PCT[0] as any).arpuOverride} vs ${BF.months[0].arpu.mean}`);

// ---------------------------------------------------------------------------
// 1. THE ENGINE READS IT AS A RATE, in both volume modes.
// ---------------------------------------------------------------------------
for (let i = 0; i < M.length; i++) {
  check(`ENGINE: % and absolute give the same adjusted ARPU at ${M[i]}`,
    near(rPct.chartData[i]['ARPU (Adjusted)'], rAbs.chartData[i]['ARPU (Adjusted)']),
    `${rPct.chartData[i]['ARPU (Adjusted)']} vs ${rAbs.chartData[i]['ARPU (Adjusted)']}`);
}
check('ENGINE: the companion MOVES the blend — 20 -> 20.05 at the first landed month',
  near(rPct.chartData[1]['ARPU (Adjusted)'], 20.05, 1e-6),
  `${rPct.chartData[1]['ARPU (Adjusted)']}`);
check('ENGINE: without a companion the blend does not move at all',
  near(rNone.chartData[1]['ARPU (Adjusted)'], 20, 1e-9),
  `${rNone.chartData[1]['ARPU (Adjusted)']} — the control that proves the move above is the companion`);
check('ENGINE: 25 is not read as +25% (which would land near 25, not 20.05)',
  rPct.chartData[1]['ARPU (Adjusted)'] < 21,
  `${rPct.chartData[1]['ARPU (Adjusted)']}`);

// ---------------------------------------------------------------------------
// 2. THE STORED ROW CARRIES A RATE, and eventArpuDelta hands one back.
// ---------------------------------------------------------------------------
check('STORED: a percentage row keeps the companion as 25', (PCT[0] as any).arpuOverride === 25);
check('DELTA: eventArpuDelta returns 25 on the percentage row', eventArpuDelta(PCT[0] as any) === 25);
check('DELTA: and the same 25 on the absolute row', eventArpuDelta(ABS[0] as any) === 25);
check('DELTA: an unstated companion still dashes on a percentage row',
  eventArpuDelta(NONE[0] as any) === null,
  'the auto-filled rate was never chosen by the user — do not attribute it');

// ---------------------------------------------------------------------------
// 3. THE ROW FORMATS IT AS A RATE. Source-level, because the cell is deep in
//    JSX the mounted harness does not reach, and because the defect was one
//    identifier: the cell called the volume formatter.
// ---------------------------------------------------------------------------
{
  const src = fs.readFileSync('src/components/WhatIfTab.tsx', 'utf8');
  check('ROW: a rate-only formatter exists', src.includes('const fmtArpu = (v: number) =>'));
  check('ROW: it never appends a per-cent sign',
    /const fmtArpu = \(v: number\) => \(v > 0 \? '\+' : ''\) \+ formatNumber\(v\);/.test(src),
    'if this grows an isPercentage branch the defect is back');
  check('ROW: the ARPU cell uses it', src.includes("{arpuDelta !== null ? fmtArpu(arpuDelta) : '—'}"));
  check('ROW: and no longer uses the volume formatter',
    !src.includes("{arpuDelta !== null ? fmtDelta(arpuDelta) : '—'}"),
    'fmtDelta keys off the VOLUME amount type — that is UAT-D2-02');

  // The three volume cells MUST still use fmtDelta: they are the cells for
  // which the percent branch is correct, and a fix that changed them too would
  // have swapped one wrong unit for another.
  const volumeCells = (src.match(/\? fmtDelta\((?:inflow|retention|outflow)Delta\)/g) ?? []).length;
  check('ROW: the three VOLUME cells still use the percentage-aware formatter',
    volumeCells === 3, `${volumeCells} — inflow, retention and outflow`);
  check('ROW: fmtDelta still carries its percent branch for those cells',
    /const fmtDelta = \(v: number\) => isPercentage/.test(src));
}

console.log(`arpu-companion spec: ${pass} passed, ${fails.length} failed`);
fails.forEach(f => console.log('  FAIL ' + f));
process.exit(fails.length ? 1 : 0);

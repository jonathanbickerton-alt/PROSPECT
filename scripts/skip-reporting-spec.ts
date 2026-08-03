/**
 * Spec for Phase 0 — skip reporting on the typed forecast path.
 *
 *   npm run spec:skip
 *
 * WHY THIS SPEC EXISTS IN THIS SHAPE.
 *
 * The condition it tests is UNREACHABLE on both fixtures. Every leaf in the
 * trimmed and the full file carries all 42 months (measured 2026-08-04:
 * min/median/max surviving months = 42/42/42), so a run against either produces
 * `0 skipped` — which is exactly what a broken implementation also produces.
 * That is the vacuous-result trap, and it is live here.
 *
 * So the spec does two things instead of one:
 *
 *   1. Drives `classifySkip` directly — the REAL rule, not a restatement of it.
 *   2. Runs the REAL `runForecastJob` over a tiny hand-built dataset whose
 *      cohorts are deliberately too short to fit. This exercises the actual
 *      `else` branch in the worker, the actual result field, and the actual
 *      accumulation — not a unit-tested approximation of them.
 *
 * Construction is legitimate here in a way it would not be for an investigation:
 * the point is to reach a branch the real data cannot reach.
 */
import { classifySkip } from '../src/utils/forecasting';
import { runForecastJob } from '../src/workers/forecasting.worker';
import type { WorkerConfig, WorkerInMessage } from '../src/workers/forecasting.worker';
import type { SkipReason } from '../src/types/forecast';

let pass = 0; const fails: string[] = [];
const check = (name: string, cond: boolean, detail?: string) => {
  if (cond) pass++; else fails.push(name + (detail ? `  [${detail}]` : ''));
};

// ── 1. classifySkip — the rule itself ─────────────────────────────────────
check('a produced forecast is not a skip',
  classifySkip([{}, {}, {}, {}], { months: [] }) === null);

check('no rows at all -> never-enumerated',
  classifySkip([], null) === 'never-enumerated');
check('an absent bucket -> never-enumerated',
  classifySkip(undefined, null) === 'never-enumerated');
check('a null bucket -> never-enumerated',
  classifySkip(null, null) === 'never-enumerated');

check('rows present but no forecast -> insufficient-history',
  classifySkip([{}, {}], null) === 'insufficient-history');

// The ordering matters and is easy to get backwards: an empty bucket must NOT
// be reported as a short history. It is not a cohort with little data, it is
// not a cohort.
check('THE TWO REASONS ARE DISTINGUISHED, not one constant',
  classifySkip([], null) !== classifySkip([{}, {}], null),
  `${classifySkip([], null)} vs ${classifySkip([{}, {}], null)}`);

// A forecast wins over an empty bucket — the forecast is the evidence, not the
// row count. Guards against re-ordering the two checks.
check('a forecast with an empty bucket is still not a skip',
  classifySkip([], { months: [] }) === null);

// ── 2. the REAL worker, over data engineered to be unfittable ─────────────
const COLS = {
  wiDateCol: 'Month', wiMetricCol: 'Metric', wiValueCol: 'Value',
  wiSegmentCol: 'Segment', wiProductCol: 'Product', wiProductL2Col: '',
  wiChannelCol: 'Channel', wiChannelL2Col: '', wiTariffL1Col: '', wiTariffL2Col: '',
  wiInflowVal: 'Inflow', wiOutflowVal: 'Outflow', wiBaseVal: 'Base', wiRetentionVal: 'Retention',
  wiArpuCol: 'Arpu', wiRevenueCol: 'Revenue',
};

const config: WorkerConfig = {
  ...COLS,
  genLength: 6, runPreUnc: 1.28, runPostExp: 0.02, runConfHor: 3,
  runModel: 'Holt Linear', autoModel: false, autoConfidence: false, oneOffMonths: {},
};

/** One cohort, `months` months of history, every metric present. */
function rowsFor(seg: string, prod: string, chan: string, months: number) {
  const out: any[] = [];
  for (let i = 0; i < months; i++) {
    const m = `2025-${String(i + 1).padStart(2, '0')}-01`;
    for (const metric of ['Inflow', 'Outflow', 'Retention', 'Base']) {
      out.push({
        Month: m, Segment: seg, Product: prod, Channel: chan,
        Metric: metric, Value: 100 + i, Arpu: 10, Revenue: 1000,
        _parsedDate: new Date(m),
      });
    }
  }
  return out;
}

const SHORT = { seg: 'ShortCo', prod: 'P1', chan: 'C1' };   // 2 months — unfittable
const LONG  = { seg: 'LongCo',  prod: 'P1', chan: 'C1' };   // 12 months — fits

const shortKey = 'ShortCo|P1|All|C1|All|All|All';
const longKey  = 'LongCo|P1|All|C1|All|All|All';

const input: WorkerInMessage = {
  workerId: 0,
  config,
  rows: [...rowsFor(SHORT.seg, SHORT.prod, SHORT.chan, 2),
         ...rowsFor(LONG.seg,  LONG.prod,  LONG.chan, 12)],
  standardCohorts: [],
  ibroCohorts: [
    { fKey: shortKey, seg: SHORT.seg, prod: SHORT.prod, prodL2: 'All', chan: SHORT.chan, chanL2: 'All', tariffL1: 'All', tariffL2: 'All' },
    { fKey: longKey,  seg: LONG.seg,  prod: LONG.prod,  prodL2: 'All', chan: LONG.chan,  chanL2: 'All', tariffL1: 'All', tariffL2: 'All' },
  ],
};

const result = runForecastJob(input);

// The run must NOT be vacuous: if nothing was skipped and nothing was
// generated, every assertion below would pass against a dead code path.
check('GUARD: the run actually produced a forecast', result.newTypedForecasts.length === 1,
  `${result.newTypedForecasts.length} typed forecasts`);
check('GUARD: the run actually skipped something', result.skipped.length === 1,
  `${result.skipped.length} skipped`);

check('the skipped leaf is NAMED with its fKey, not merely counted',
  result.skipped.some(s => s.fKey === shortKey),
  JSON.stringify(result.skipped));

check('the skipped leaf carries a reason',
  result.skipped[0]?.reason === 'insufficient-history',
  String(result.skipped[0]?.reason));

check('the leaf that DID fit is not in the skipped list',
  !result.skipped.some(s => s.fKey === longKey));
check('...and it is in the typed forecasts',
  result.newTypedForecasts.some(([k]) => k === longKey));

// ── 3. the three existing counters are byte-identical ─────────────────────
// The typed path has never touched them and must still not: `generated`,
// `failed` and `empty` all live in the OTHER loop. A run with zero standard
// cohorts must leave all three at zero even though a typed cohort was skipped.
check('generated is untouched by a typed skip', result.generated === 0, String(result.generated));
check('failed is untouched by a typed skip',    result.failed === 0,    String(result.failed));
check('empty is untouched by a typed skip',     result.empty === 0,     String(result.empty));

// ── 4. zero skips reports an EMPTY LIST, not an absent field ──────────────
const cleanInput: WorkerInMessage = {
  ...input,
  rows: rowsFor(LONG.seg, LONG.prod, LONG.chan, 12),
  ibroCohorts: [input.ibroCohorts[1]],
};
const clean = runForecastJob(cleanInput);
check('GUARD: the clean run produced a forecast', clean.newTypedForecasts.length === 1);
check('a run with no skips reports [] rather than omitting the field',
  Array.isArray(clean.skipped) && clean.skipped.length === 0,
  JSON.stringify(clean.skipped));
check('...and the field is present, not undefined',
  Object.prototype.hasOwnProperty.call(clean, 'skipped'));

// ── 5. every emitted reason is a member of the shared vocabulary ──────────
const VOCAB: SkipReason[] = ['never-enumerated', 'insufficient-history'];
check('every reason emitted is one of the two shared codes',
  result.skipped.every(s => VOCAB.includes(s.reason)),
  JSON.stringify(result.skipped.map(s => s.reason)));

console.log(`skip-reporting spec: ${pass} passed, ${fails.length} failed`);
fails.forEach(f => console.log('  FAIL ' + f));
process.exit(fails.length ? 1 : 0);

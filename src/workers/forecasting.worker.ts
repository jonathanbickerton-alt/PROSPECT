/**
 * forecasting.worker.ts
 *
 * Web Worker that runs Standard Forecast (per-metric Holt-Winters) and typed
 * BaseForecast (IBRO-combined) computations off the main thread.
 *
 * The main thread slices cohorts and their pre-filtered rows across a pool of
 * workers; each worker rebuilds a local CohortDataMap from its row slice and
 * processes its assigned cohorts independently.
 */

import { format, addMonths } from 'date-fns';
import { buildCohortDataMap, calculateHoltWinters, calculateBaseForecast, analyzeAndRecommendModel, analyzeAndRecommendConfidence, applyOneOffFlagsToSeries, aggregateForecastBands } from '../utils/forecasting';
import type { AggregatedIBRORow, PreAggRow, AggBand } from '../utils/forecasting';
import type { BaseForecast, ForecastModel } from '../types/forecast';

/**
 * Minimum history for a seasonal (Holt-Winters) fit — mirrors
 * SEASONAL_MIN_POINTS in forecasting.ts. Used here only to DETECT leaves too
 * short to carry a seasonal term, so the aggregates built from them can be
 * flagged. It never changes which model is chosen.
 */
const SEASONAL_MIN_POINTS_WORKER = 24;

// ---------------------------------------------------------------------------
// Message types
// ---------------------------------------------------------------------------

export interface StandardCohortSpec {
  id: string;
  segment: string;
  product: string;
  productL2?: string;
  channel?: string;
  channelL2?: string;
  tariffL1?: string;
  tariffL2?: string;
  /** 'Inflow' | 'Outflow' | 'Base' | 'Retention' */
  scenario: string;
}

export interface IbroCohortSpec {
  fKey: string;
  seg: string;
  prod: string;
  prodL2: string;
  chan: string;
  chanL2: string;
  tariffL1?: string;
  tariffL2?: string;
}

export interface WorkerConfig {
  wiDateCol: string;
  wiMetricCol: string;
  wiValueCol: string;
  wiSegmentCol: string;
  wiProductCol: string;
  wiProductL2Col: string;
  wiChannelCol: string;
  wiChannelL2Col: string;
  wiTariffL1Col: string;
  wiTariffL2Col: string;
  wiInflowVal: string;
  wiOutflowVal: string;
  wiBaseVal: string;
  wiRetentionVal: string;
  wiArpuCol: string;
  wiRevenueCol: string;
  genLength: number;
  runPreUnc: number;
  runPostExp: number;
  runConfHor: number;
  runModel: ForecastModel;
  autoModel: boolean;
  autoConfidence: boolean;
  /** P10 — cohort key (7-part, same format as App.tsx's makeForecastKey) ->
   *  flagged yyyy-MM months. Applied to whichever cohort's series matches. */
  oneOffMonths: Record<string, string[]>;
}

export interface WorkerInMessage {
  workerId: number;
  config: WorkerConfig;
  /** Pre-filtered rows for all cohorts assigned to this worker. Date objects are preserved by structured clone. */
  rows: PreAggRow[];
  standardCohorts: StandardCohortSpec[];
  ibroCohorts: IbroCohortSpec[];
}

export interface WorkerOutMessage {
  workerId: number;
  /** cohortId → combined historical + forecast array (Standard Forecast output) */
  newForecasts: Record<string, unknown[]>;
  generatedIds: string[];
  /** Serialised as [key, BaseForecast][] because Map cannot cross postMessage boundary */
  newTypedForecasts: Array<[string, BaseForecast]>;
  generated: number;
  /** Cohorts that could not be forecast because they had exactly 1 data point
   *  (a genuine data-quality warning). */
  failed: number;
  /** Cohorts skipped because they had 0 matching rows (expected — an aggregate
   *  slice with no data; not surfaced as a failure). */
  empty: number;
  /**
   * Aggregates whose seasonal amplitude may be understated because more than
   * half their constituent leaves have too little history to fit seasonality.
   * Advisory only — it changes no numbers, it makes the condition visible.
   * Serialised as an array because Map cannot cross postMessage.
   */
  shortLeafWarnings: Array<[string, ShortLeafWarning]>;
}

/** Short-history diagnostics for one derived aggregate. */
export interface ShortLeafWarning {
  /** leaves with fewer than 24 points (cannot fit a seasonal term) */
  shortLeaves: number;
  totalLeaves: number;
  /** shortLeaves / totalLeaves, 0..1 */
  share: number;
}

// ---------------------------------------------------------------------------
// Worker handler
// ---------------------------------------------------------------------------

export function runForecastJob(input: WorkerInMessage): WorkerOutMessage {
  const { workerId, config, rows, standardCohorts, ibroCohorts } = input;

  const {
    wiDateCol, wiMetricCol, wiValueCol,
    wiSegmentCol, wiProductCol, wiProductL2Col,
    wiChannelCol, wiChannelL2Col,
    wiTariffL1Col, wiTariffL2Col,
    wiInflowVal, wiOutflowVal, wiBaseVal, wiRetentionVal,
    wiArpuCol, wiRevenueCol,
    genLength, runPreUnc, runPostExp, runConfHor, runModel,
    autoModel, autoConfidence, oneOffMonths,
  } = config;

  // P10 — cohort key -> Set<yyyy-MM>, ready for applyOneOffFlagsToSeries /
  // calculateBaseForecast. Same 7-part key format as CohortDataMap/App.tsx's
  // makeForecastKey (no scenario component — a flag applies to all 4 IBRO
  // series for that cohort/month alike).
  const oneOffFlagSets = new Map<string, Set<string>>(
    Object.entries(oneOffMonths || {}).map(([key, months]) => [key, new Set(months)]),
  );

  // Rebuild the cohort data map from the pre-filtered row slice.
  // buildCohortDataMap re-parses dates from wiDateCol so the _parsedDate on
  // each row is always a fresh Date instance local to this worker.
  const cohortDataMap = buildCohortDataMap(
    rows,
    wiDateCol,
    wiSegmentCol,
    wiProductCol,
    wiProductL2Col,
    wiChannelCol,
    wiChannelL2Col,
    wiTariffL1Col,
    wiTariffL2Col,
  );

  const newForecasts: Record<string, unknown[]> = {};
  const generatedIds: string[] = [];
  const shortLeafWarnings = new Map<string, ShortLeafWarning>();
  let generated = 0;
  let failed = 0;
  let empty = 0;

  // ── Bottom-up index ───────────────────────────────────────────────────────
  // Only populated leaf cohorts are ever fitted. Every requested aggregate is
  // mapped to the leaves it contains, and derived from them by summation.
  // The old O(N) `rows.filter(...)` fallback is gone: a key is either an exact
  // leaf, derivable from leaves, or legitimately absent.
  const cohortKeyOf = (c: { segment: string; product: string; productL2?: string; channel?: string; channelL2?: string; tariffL1?: string; tariffL2?: string }) =>
    `${c.segment}|${c.product}|${c.productL2 || 'All'}|${c.channel || 'All'}|${c.channelL2 || 'All'}|${c.tariffL1 || 'All'}|${c.tariffL2 || 'All'}`;

  const leafKeys = Array.from(cohortDataMap.keys());
  const leafDims = leafKeys.map(k => k.split('|'));
  const DIMS = 7;

  const requestedKeys = new Set<string>();
  for (const c of standardCohorts) requestedKeys.add(cohortKeyOf(c));
  // Distinct "shapes" (which dims are 'All') across requested keys — so we only
  // ever materialise ancestor keys somebody actually asked for.
  const masks = Array.from(new Set(Array.from(requestedKeys, key => {
    const p = key.split('|');
    let m = 0;
    for (let i = 0; i < DIMS; i++) if (p[i] === 'All') m |= (1 << i);
    return m;
  })));

  /** requested cohort key -> indices into leafKeys that roll up into it */
  const keyToLeaves = new Map<string, number[]>();
  for (let li = 0; li < leafDims.length; li++) {
    const d = leafDims[li];
    for (const mask of masks) {
      let key = '';
      for (let i = 0; i < DIMS; i++) {
        key += (mask & (1 << i)) ? 'All' : d[i];
        if (i < DIMS - 1) key += '|';
      }
      if (!requestedKeys.has(key)) continue;
      const arr = keyToLeaves.get(key);
      if (arr) arr.push(li); else keyToLeaves.set(key, [li]);
    }
  }

  /** Monthly series for one leaf + metric, ascending by date. */
  interface LeafSeries { months: Array<{ t: number; date: Date; value: number; rep: PreAggRow }>; rawCount: number; }
  const leafSeriesCache = new Map<string, LeafSeries>();
  function leafSeriesFor(leafIdx: number, metric: string): LeafSeries {
    const ck = `${leafIdx} ${metric}`;
    const hit = leafSeriesCache.get(ck);
    if (hit) return hit;
    const bucket = cohortDataMap.get(leafKeys[leafIdx]) ?? [];
    const byMonth = new Map<number, { t: number; date: Date; value: number; rep: PreAggRow }>();
    let rawCount = 0;
    for (const row of bucket) {
      if (String(row[wiMetricCol]) !== metric) continue;
      rawCount++;
      const t = row._parsedDate.getTime();
      const cur = byMonth.get(t);
      const v = Number(row[wiValueCol]) || 0;
      if (cur) cur.value += v;
      else byMonth.set(t, { t, date: row._parsedDate, value: v, rep: row });
    }
    const out: LeafSeries = { months: Array.from(byMonth.values()).sort((a, b) => a.t - b.t), rawCount };
    leafSeriesCache.set(ck, out);
    return out;
  }

  /** Fitted forecast for one leaf + metric. null when the leaf can't be fitted. */
  interface LeafFit {
    bands: AggBand[];
    lastDate: Date;
    preUnc: number;
    postExp: number;
    /** raw calculateHoltWinters rows — reused verbatim when this leaf is itself
     *  the requested cohort, so leaf output stays byte-identical to pre-bottom-up */
    fcRows: any[];
    /** the per-month rows the fit was run on, for the same reason */
    fitRows: Array<Record<string, unknown> & { _parsedDate: Date }>;
  }
  const leafFitCache = new Map<string, LeafFit | null>();
  function leafFitFor(leafIdx: number, metric: string): LeafFit | null {
    const ck = `${leafIdx} ${metric}`;
    if (leafFitCache.has(ck)) return leafFitCache.get(ck)!;
    const series = leafSeriesFor(leafIdx, metric);
    if (series.rawCount < 2 || series.months.length === 0) { leafFitCache.set(ck, null); return null; }
    const values = series.months.map(m => m.value);
    const calStart = series.months[0].date.getMonth();
    // Model selection and confidence auto-configuration run PER LEAF only.
    // Aggregates inherit no model of their own — they are pure summations.
    const model = autoModel ? analyzeAndRecommendModel(values, calStart).recommendedModel : runModel;
    let preUnc = runPreUnc, postExp = runPostExp, confHor = runConfHor;
    if (autoConfidence) {
      const conf = analyzeAndRecommendConfidence(values, calStart);
      preUnc = conf.preHorizonZ; postExp = conf.postHorizonMultiplier; confHor = conf.confidenceHorizon;
    }
    const rowsForFit = series.months.map(m => ({ ...m.rep, [wiValueCol]: m.value, _parsedDate: m.date }));
    const fc = calculateHoltWinters(rowsForFit as any, wiDateCol, wiValueCol, genLength, preUnc, postExp, confHor, model);
    if (!fc) { leafFitCache.set(ck, null); return null; }
    const fit: LeafFit = {
      bands: fc.map((r: any) => ({ mean: Number(r['Mean (Base)']) || 0, optimistic: Number(r.Optimistic) || 0, pessimistic: Number(r.Pessimistic) || 0 })),
      lastDate: series.months[series.months.length - 1].date,
      preUnc, postExp,
      fcRows: fc,
      fitRows: rowsForFit as any,
    };
    leafFitCache.set(ck, fit);
    return fit;
  }

  // ── Standard cohorts: leaves fitted, aggregates derived by summation ──────
  for (const cohort of standardCohorts) {
    const targetMetric =
      cohort.scenario === 'Inflow'    ? wiInflowVal :
      cohort.scenario === 'Outflow'   ? wiOutflowVal :
      cohort.scenario === 'Base'      ? wiBaseVal :
                                        wiRetentionVal;

    if (!wiDateCol || !wiMetricCol || !wiValueCol || !targetMetric) {
      failed++;
      continue;
    }

    const cohortMapKey = cohortKeyOf(cohort);
    const memberIdx = keyToLeaves.get(cohortMapKey) ?? [];
    if (memberIdx.length === 0) { empty++; continue; }

    // Fit every constituent leaf (cached, so a leaf shared by many aggregates
    // is fitted once per metric regardless of how many parents need it).
    const fits: LeafFit[] = [];
    const memberSeries: LeafSeries[] = [];
    let shortLeaves = 0;
    for (const li of memberIdx) {
      const s = leafSeriesFor(li, targetMetric);
      memberSeries.push(s);
      if (s.months.length < SEASONAL_MIN_POINTS_WORKER) shortLeaves++;
      const f = leafFitFor(li, targetMetric);
      if (f) fits.push(f);
    }

    if (fits.length === 0) {
      // No constituent leaf could be fitted: 0 raw rows anywhere ⇒ empty,
      // otherwise genuinely insufficient data.
      const anyRows = memberSeries.some(s => s.rawCount > 0);
      if (anyRows) failed++; else empty++;
      continue;
    }

    // Seasonality caveat: if most constituent leaves are too short to fit a
    // seasonal term, the summed aggregate can understate seasonal amplitude.
    // Surfaced as a warning; the numbers are left reconcilable and unchanged.
    if (memberIdx.length > 1 && shortLeaves / memberIdx.length > 0.5) {
      shortLeafWarnings.set(cohort.id, {
        shortLeaves, totalLeaves: memberIdx.length, share: shortLeaves / memberIdx.length,
      });
    }

    // Historical series = exact sum of leaf actuals per month (reconciles by construction).
    const histByMonth = new Map<number, { date: Date; value: number }>();
    for (const s of memberSeries) {
      for (const m of s.months) {
        const cur = histByMonth.get(m.t);
        if (cur) cur.value += m.value;
        else histByMonth.set(m.t, { date: m.date, value: m.value });
      }
    }
    const histSorted = Array.from(histByMonth.entries()).sort((a, b) => a[0] - b[0]).map(([, v]) => v);

    // Forecast = summed means, variance-combined bands (see aggregateForecastBands).
    const aggBands = aggregateForecastBands(fits.map(f => f.bands));
    const lastDate = histSorted.length ? histSorted[histSorted.length - 1].date : fits[0].lastDate;

    // A single-leaf "aggregate" is that leaf: same data, same fit, so a leaf
    // cohort's own forecast is unchanged by bottom-up.
    const isLeafCohort = memberIdx.length === 1 && leafKeys[memberIdx[0]] === cohortMapKey;
    const preUncOut = isLeafCohort ? fits[0].preUnc : null;
    const postExpOut = isLeafCohort ? fits[0].postExp : null;

    // A leaf cohort is emitted exactly as before bottom-up existed: its own fit,
    // its own rows (raw source columns included, which downstream Excel export
    // relies on). Bottom-up changes how AGGREGATES are produced, never leaves.
    const historicalData = isLeafCohort
      ? fits[0].fitRows.map(row => {
          const { _parsedDate, ...rest } = row;
          return {
            ...rest,
            [wiDateCol]: _parsedDate,
            'Mean (Base)': Number(Number(row[wiValueCol] as number).toFixed(2)),
            'Optimistic': null,
            'Pessimistic': null,
            Type: 'Historical',
            'Pre-Horizon Uncertainty %': preUncOut,
            'Post-Horizon Expansion Rate %': postExpOut,
          };
        })
      : histSorted.map(h => ({
          [wiDateCol]: h.date,
          'Mean (Base)': Number(h.value.toFixed(2)),
          Optimistic: null,
          Pessimistic: null,
          Type: 'Historical',
          // Aggregates inherit no model, so no per-cohort uncertainty settings.
          'Pre-Horizon Uncertainty %': preUncOut,
          'Post-Horizon Expansion Rate %': postExpOut,
        }));

    const forecastWithTrace = isLeafCohort
      ? fits[0].fcRows.map((r: any) => ({
          ...r,
          'Pre-Horizon Uncertainty %': preUncOut,
          'Post-Horizon Expansion Rate %': postExpOut,
        }))
      : aggBands.map((b, i) => ({
          [wiDateCol]: addMonths(lastDate, i + 1),
          _parsedDate: addMonths(lastDate, i + 1),
          'Mean (Base)': b.mean,
          Optimistic: b.optimistic,
          Pessimistic: b.pessimistic,
          Type: 'Forecast',
          'Pre-Horizon Uncertainty %': preUncOut,
          'Post-Horizon Expansion Rate %': postExpOut,
        }));

    newForecasts[cohort.id] = [...historicalData, ...forecastWithTrace];
    generatedIds.push(cohort.id);
    generated++;
    continue;
  }

  // ── IBRO cohorts: typed BaseForecast (all 4 metrics combined) ────────────
  const newTypedForecasts: Array<[string, BaseForecast]> = [];

  if (wiInflowVal && wiOutflowVal && wiRetentionVal && wiDateCol && wiMetricCol && wiValueCol) {
    for (const { fKey, seg, prod, prodL2, chan, chanL2, tariffL1, tariffL2 } of ibroCohorts) {
      // O(1) exact hit for specific-dimension cohorts.
      // O(N) fallback for aggregate ('All') keys that have no single map entry
      // (e.g. Corporate|Mobile Voice|All|All|All spans multiple channel buckets).
      // Leaf-key lookup only. The O(N) `rows.filter(...)` fallback is removed:
      // IBRO cohorts are enumerated from the data itself and are therefore
      // always exact leaf keys. Anything not in the map has no data.
      const allIBRO: PreAggRow[] = cohortDataMap.get(fKey) ?? [];

      // Aggregate all four IBRO metrics by month.
      const ibroMap = new Map<number, AggregatedIBRORow>();
      for (const row of allIBRO) {
        const t = row._parsedDate.getTime();
        if (!ibroMap.has(t)) {
          ibroMap.set(t, {
            _parsedDate: row._parsedDate,
            inflow: 0, outflow: 0, retention: 0, arpu: 0,
            inflowArpu: 0, outflowArpu: 0, retentionArpu: 0, baseArpu: 0,
          });
        }
        const entry = ibroMap.get(t)!;
        const metric = String(row[wiMetricCol]);
        const val = Number(row[wiValueCol]) || 0;
        if (metric === wiInflowVal)     entry.inflow    += val;
        else if (metric === wiOutflowVal)  entry.outflow   += val;
        else if (metric === wiRetentionVal) entry.retention += val;
      }

      // Compute blended ARPU (all 4 scenarios) and per-scenario ARPU from revenue / subs.
      if (wiRevenueCol || wiArpuCol) {
        // Per-scenario accumulators: subs and revenue for each IBRO type
        type ScenAccum = { subs: number; rev: number };
        const inflowAcc    = new Map<number, ScenAccum>();
        const outflowAcc   = new Map<number, ScenAccum>();
        const retentionAcc = new Map<number, ScenAccum>();
        const baseAcc      = new Map<number, ScenAccum>();

        for (const row of allIBRO) {
          const t = row._parsedDate.getTime();
          const metric = String(row[wiMetricCol]);
          const val = Number(row[wiValueCol]) || 0;
          const rev  = Number(row[wiRevenueCol]) || 0;
          const arpu = Number(row[wiArpuCol]) || 0;
          const revVal = rev || (arpu * val);

          if (metric === wiInflowVal) {
            const a = inflowAcc.get(t) ?? { subs: 0, rev: 0 };
            a.subs += val; a.rev += revVal;
            inflowAcc.set(t, a);
          } else if (metric === wiOutflowVal) {
            const a = outflowAcc.get(t) ?? { subs: 0, rev: 0 };
            a.subs += val; a.rev += revVal;
            outflowAcc.set(t, a);
          } else if (metric === wiRetentionVal) {
            const a = retentionAcc.get(t) ?? { subs: 0, rev: 0 };
            a.subs += val; a.rev += revVal;
            retentionAcc.set(t, a);
          } else if (metric === wiBaseVal) {
            const a = baseAcc.get(t) ?? { subs: 0, rev: 0 };
            a.subs += val; a.rev += revVal;
            baseAcc.set(t, a);
          }
        }

        ibroMap.forEach((entry, t) => {
          const ia = inflowAcc.get(t)    ?? { subs: 0, rev: 0 };
          const oa = outflowAcc.get(t)   ?? { subs: 0, rev: 0 };
          const ra = retentionAcc.get(t) ?? { subs: 0, rev: 0 };
          const ba = baseAcc.get(t)      ?? { subs: 0, rev: 0 };

          // Blended ARPU = total revenue across ALL 4 scenarios / total subs across ALL 4
          const totalSubs = ia.subs + oa.subs + ra.subs + ba.subs;
          const totalRev  = ia.rev  + oa.rev  + ra.rev  + ba.rev;
          if (totalSubs > 0) entry.arpu = totalRev / totalSubs;

          // Per-scenario ARPU
          entry.inflowArpu    = ia.subs > 0 ? ia.rev / ia.subs : 0;
          entry.outflowArpu   = oa.subs > 0 ? oa.rev / oa.subs : 0;
          entry.retentionArpu = ra.subs > 0 ? ra.rev / ra.subs : 0;
          entry.baseArpu      = ba.subs > 0 ? ba.rev / ba.subs : 0;
        });
      }

      const ibroArr = Array.from(ibroMap.values())
        .filter(e => e.inflow > 0 || e.outflow > 0 || e.retention > 0)
        .sort((a, b) => a._parsedDate.getTime() - b._parsedDate.getTime());

      // Seed base: most recent base-stock reading.
      const baseReadings = new Map<number, number>();
      for (const r of allIBRO) {
        if (String(r[wiMetricCol]) === wiBaseVal) {
          const t = r._parsedDate.getTime();
          baseReadings.set(t, (baseReadings.get(t) || 0) + (Number(r[wiValueCol]) || 0));
        }
      }
      const seedBase = baseReadings.size > 0
        ? (baseReadings.get(Math.max(...baseReadings.keys())) ?? 0)
        : 0;

      // P10 — flagged one-off months for this cohort (fKey matches
      // makeForecastKey's format, no scenario component).
      const ibroFlags = oneOffFlagSets.get(fKey);
      const ibroMonthKeys = ibroArr.map(r => format(r._parsedDate, 'yyyy-MM'));
      const ibroValuesRaw = ibroArr.map(r => r.inflow);
      const ibroValues = applyOneOffFlagsToSeries(ibroValuesRaw, ibroMonthKeys, ibroFlags);
      const ibroCalStart = ibroArr.length > 0 ? ibroArr[0]._parsedDate.getMonth() : 0;

      const ibroCohortModel = autoModel
        ? analyzeAndRecommendModel(ibroValues, ibroCalStart).recommendedModel
        : runModel;

      let ibroPreUnc = runPreUnc, ibroPostExp = runPostExp, ibroConfHor = runConfHor;
      if (autoConfidence) {
        const conf = analyzeAndRecommendConfidence(ibroValues, ibroCalStart);
        ibroPreUnc  = conf.preHorizonZ;
        ibroPostExp = conf.postHorizonMultiplier;
        ibroConfHor = conf.confidenceHorizon;
      }

      const bf = calculateBaseForecast(
        ibroArr,
        { segment: seg, product: prod, productL2: prodL2, channel: chan, channelL2: chanL2, tariffL1, tariffL2, scenario: 'Base Case' },
        seedBase,
        genLength,
        ibroPreUnc,
        ibroPostExp,
        ibroConfHor,
        ibroCohortModel,
        ibroFlags,
      );

      if (bf) {
        newTypedForecasts.push([fKey, bf]);
      }
    }
  }

  const result: WorkerOutMessage = {
    workerId,
    newForecasts,
    generatedIds,
    newTypedForecasts,
    generated,
    failed,
    empty,
    shortLeafWarnings: Array.from(shortLeafWarnings.entries()),
  };

  return result;
}

if (typeof self !== 'undefined' && typeof (self as any).postMessage === 'function') {
  self.onmessage = (e: MessageEvent<WorkerInMessage>) => { self.postMessage(runForecastJob(e.data)); };
}

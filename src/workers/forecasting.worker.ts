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

import { format } from 'date-fns';
import { buildCohortDataMap, calculateHoltWinters, calculateBaseForecast, analyzeAndRecommendModel, analyzeAndRecommendConfidence, applyOneOffFlagsToSeries } from '../utils/forecasting';
import type { AggregatedIBRORow, PreAggRow } from '../utils/forecasting';
import type { BaseForecast, ForecastModel } from '../types/forecast';

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
}

// ---------------------------------------------------------------------------
// Worker handler
// ---------------------------------------------------------------------------

self.onmessage = (e: MessageEvent<WorkerInMessage>) => {
  const { workerId, config, rows, standardCohorts, ibroCohorts } = e.data;

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
  let generated = 0;
  let failed = 0;
  let empty = 0;

  // ── Standard cohorts: per-metric Holt-Winters ────────────────────────────
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

    const cohortMapKey = `${cohort.segment}|${cohort.product}|${cohort.productL2 || 'All'}|${cohort.channel || 'All'}|${cohort.channelL2 || 'All'}|${cohort.tariffL1 || 'All'}|${cohort.tariffL2 || 'All'}`;
    const preAggBucket = cohortDataMap.get(cohortMapKey);

    // O(1) path: exact key hit (specific-dimension cohorts).
    // O(N) fallback: 'All'-dimension cohorts have no single map key — scan all rows
    // and apply per-dimension filters for whichever dimensions are not 'All'.
    let processedData: PreAggRow[];
    if (preAggBucket) {
      processedData = preAggBucket
        .filter(row => String(row[wiMetricCol]) === targetMetric)
        .sort((a, b) => a._parsedDate.getTime() - b._parsedDate.getTime());
    } else {
      processedData = rows
        .filter(row => String(row[wiMetricCol]) === targetMetric)
        .sort((a, b) => a._parsedDate.getTime() - b._parsedDate.getTime());

      if (wiSegmentCol && cohort.segment !== 'All') {
        processedData = processedData.filter(row => String(row[wiSegmentCol]) === cohort.segment);
      }
      if (wiProductCol && cohort.product !== 'All') {
        processedData = processedData.filter(row => String(row[wiProductCol]) === cohort.product);
      }
      if (wiProductL2Col && cohort.productL2 && cohort.productL2 !== 'All') {
        processedData = processedData.filter(row => String(row[wiProductL2Col]) === cohort.productL2);
      }
      if (wiChannelCol && cohort.channel && cohort.channel !== 'All') {
        processedData = processedData.filter(row => String(row[wiChannelCol]) === cohort.channel);
      }
      if (wiChannelL2Col && cohort.channelL2 && cohort.channelL2 !== 'All') {
        processedData = processedData.filter(row => String(row[wiChannelL2Col]) === cohort.channelL2);
      }
      if (wiTariffL1Col && cohort.tariffL1 && cohort.tariffL1 !== 'All') {
        processedData = processedData.filter(row => String(row[wiTariffL1Col]) === cohort.tariffL1);
      }
      if (wiTariffL2Col && cohort.tariffL2 && cohort.tariffL2 !== 'All') {
        processedData = processedData.filter(row => String(row[wiTariffL2Col]) === cohort.tariffL2);
      }
    }

    if (processedData.length < 2) {
      // 0 rows = expected empty slice (not a failure); 1 row = genuine insufficient data.
      if (processedData.length === 0) empty++; else failed++;
      continue;
    }

    // Aggregate rows that share the same timestamp (multiple rows per month).
    const aggregatedDataMap = new Map<number, Record<string, unknown> & { _parsedDate: Date }>();
    for (const row of processedData) {
      const time = row._parsedDate.getTime();
      const targetVal = Number(row[wiValueCol]) || 0;
      if (!aggregatedDataMap.has(time)) {
        aggregatedDataMap.set(time, { ...row, [wiValueCol]: targetVal });
      } else {
        (aggregatedDataMap.get(time)! as Record<string, unknown>)[wiValueCol] =
          (Number((aggregatedDataMap.get(time)! as Record<string, unknown>)[wiValueCol]) || 0) + targetVal;
      }
    }

    const aggregatedData = Array.from(aggregatedDataMap.values())
      .sort((a, b) => a._parsedDate.getTime() - b._parsedDate.getTime());

    const cohortValues = aggregatedData.map(r => Number(r[wiValueCol]) || 0);
    const calStart = aggregatedData.length > 0 ? aggregatedData[0]._parsedDate.getMonth() : 0;

    const cohortModel = autoModel
      ? analyzeAndRecommendModel(cohortValues, calStart).recommendedModel
      : runModel;

    let cohortPreUnc = runPreUnc, cohortPostExp = runPostExp, cohortConfHor = runConfHor;
    if (autoConfidence) {
      const conf = analyzeAndRecommendConfidence(cohortValues, calStart);
      cohortPreUnc  = conf.preHorizonZ;
      cohortPostExp = conf.postHorizonMultiplier;
      cohortConfHor = conf.confidenceHorizon;
    }

    const newForecastData = calculateHoltWinters(
      aggregatedData,
      wiDateCol,
      wiValueCol,
      genLength,
      cohortPreUnc,
      cohortPostExp,
      cohortConfHor,
      cohortModel,
    );

    if (!newForecastData) {
      failed++;
      continue;
    }

    const historicalData = aggregatedData.map(row => {
      const { _parsedDate, ...rest } = row;
      return {
        ...rest,
        [wiDateCol]: _parsedDate,
        'Mean (Base)': Number(Number(row[wiValueCol]).toFixed(2)),
        'Optimistic': null,
        'Pessimistic': null,
        Type: 'Historical',
        'Pre-Horizon Uncertainty %': cohortPreUnc,
        'Post-Horizon Expansion Rate %': cohortPostExp,
      };
    });

    const forecastWithTrace = newForecastData.map(r => ({
      ...r,
      'Pre-Horizon Uncertainty %': cohortPreUnc,
      'Post-Horizon Expansion Rate %': cohortPostExp,
    }));

    newForecasts[cohort.id] = [...historicalData, ...forecastWithTrace];
    generatedIds.push(cohort.id);
    generated++;
  }

  // ── IBRO cohorts: typed BaseForecast (all 4 metrics combined) ────────────
  const newTypedForecasts: Array<[string, BaseForecast]> = [];

  if (wiInflowVal && wiOutflowVal && wiRetentionVal && wiDateCol && wiMetricCol && wiValueCol) {
    for (const { fKey, seg, prod, prodL2, chan, chanL2, tariffL1, tariffL2 } of ibroCohorts) {
      // O(1) exact hit for specific-dimension cohorts.
      // O(N) fallback for aggregate ('All') keys that have no single map entry
      // (e.g. Corporate|Mobile Voice|All|All|All spans multiple channel buckets).
      const exactBucket = cohortDataMap.get(fKey);
      const allIBRO: PreAggRow[] = exactBucket ?? (() => {
        if (chan !== 'All' && prod !== 'All' && seg !== 'All') return [];
        return rows.filter(row => {
          if (wiSegmentCol  && seg   !== 'All' && String(row[wiSegmentCol])   !== seg)   return false;
          if (wiProductCol  && prod  !== 'All' && String(row[wiProductCol])   !== prod)  return false;
          if (wiProductL2Col && prodL2 !== 'All' && String(row[wiProductL2Col]) !== prodL2) return false;
          if (wiChannelCol  && chan  !== 'All' && String(row[wiChannelCol])   !== chan)  return false;
          if (wiChannelL2Col && chanL2 !== 'All' && String(row[wiChannelL2Col]) !== chanL2) return false;
          if (wiTariffL1Col && tariffL1 && tariffL1 !== 'All' && String(row[wiTariffL1Col]) !== tariffL1) return false;
          if (wiTariffL2Col && tariffL2 && tariffL2 !== 'All' && String(row[wiTariffL2Col]) !== tariffL2) return false;
          return true;
        });
      })();

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
  };

  self.postMessage(result);
};

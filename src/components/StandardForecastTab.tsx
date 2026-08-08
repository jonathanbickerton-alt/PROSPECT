import React, { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useForecast } from '../context/ForecastContext';
import { Settings, Filter, Info, Download, LayersIcon, Database, CheckCircle2, AlertCircle, SlidersHorizontal, X, ChevronDown } from 'lucide-react';
import type { ForecastModel, ActiveView, DimMode } from '../types/forecast';
import { provenanceModel, provenanceParams } from '../types/forecast';
import { analyzeAndRecommendModel, analyzeAndRecommendConfidence, applyOneOffFlagsToSeries, substituteOneOffValue } from '../utils/forecasting';
import { ResponsiveContainer, LineChart, CartesianGrid, XAxis, YAxis, Tooltip, Legend, Line, Brush } from 'recharts';
import { format, parse, isValid } from 'date-fns';
import { HierarchicalDropdown } from './HierarchicalDropdown';
import type { HierarchicalSelection } from './HierarchicalDropdown';
import { DataMappingDrawer } from './DataMappingDrawer';

interface StandardForecastTabProps {
  data: any[];
  columns: string[];
  wiDateCol: string;
  setWiDateCol: (val: string) => void;
  wiMetricCol: string;
  setWiMetricCol: (val: string) => void;
  wiValueCol: string;
  setWiValueCol: (val: string) => void;
  wiArpuCol: string;
  setWiArpuCol: (val: string) => void;
  wiRevenueCol: string;
  setWiRevenueCol: (val: string) => void;
  wiInflowVal: string;
  setWiInflowVal: (val: string) => void;
  wiOutflowVal: string;
  setWiOutflowVal: (val: string) => void;
  wiBaseVal: string;
  setWiBaseVal: (val: string) => void;
  wiRetentionVal: string;
  setWiRetentionVal: (val: string) => void;
  wiSegmentCol: string;
  setWiSegmentCol: (val: string) => void;
  wiProductCol: string;
  setWiProductCol: (val: string) => void;
  wiProductL2Col?: string;
  setWiProductL2Col?: (val: string) => void;
  wiChannelCol: string;
  setWiChannelCol: (val: string) => void;
  wiChannelL2Col?: string;
  setWiChannelL2Col?: (val: string) => void;
  wiTariffL1Col?: string;
  wiTariffL2Col?: string;
  productTree?: Map<string, string[]>;
  channelTree?: Map<string, string[]>;
  tariffTree?: Map<string, string[]>;
  segmentValue: string;
  setSegmentValue: (val: string) => void;
  productValue: string;
  setProductValue: (val: string) => void;
  productL2Value?: string;
  setProductL2Value?: (val: string) => void;
  channelValue: string;
  setChannelValue: (val: string) => void;
  channelL2Value?: string;
  setChannelL2Value?: (val: string) => void;
  tariffValue?: string;
  setTariffValue?: (val: string) => void;
  tariffL2Value?: string;
  setTariffL2Value?: (val: string) => void;
  segmentMode: string;
  setSegmentMode: (val: DimMode) => void;
  productMode: string;
  setProductMode: (val: DimMode) => void;
  channelMode: string;
  setChannelMode: (val: DimMode) => void;
  stdScenario: string;
  setStdScenario: (val: string) => void;
  selectedForecastModel: ForecastModel;
  setSelectedForecastModel: (model: ForecastModel) => void;
  preHorizonUncertainty: number;
  setPreHorizonUncertainty: (val: number) => void;
  postHorizonExpansionRate: number;
  setPostHorizonExpansionRate: (val: number) => void;
  confidenceHorizon: number;
  setConfidenceHorizon: (val: number) => void;
  generateStandardForecast: () => void;
  /** Which of the four Step 1 generate situations applies — see stdAggregateState in App. */
  aggregateState: { kind: 'leaf' | 'generate' | 'covered' | 'never' | 'blocked';
    missing: number; total: number; unfittable: number };
  /** Outcome of the last scoped leaf run, or null if none has run. */
  generateResult: { generated: number; skipped: string[] } | null;
  /** Coverage statements from Step 1 — not failures, see the render site. */
  notice: string;
  error: string | null;
  forecastData: any[];
  compareCategories: string[];
  windowSize: number;
  setWindowSize: (val: number) => void;
  windowOffset: number;
  setWindowOffset: (val: number) => void;
  stdChartData: any[];
  formatNumber: (val: any) => string;
  downloadExcel: (data: any[], filename: string) => void;
  setActiveView: (view: ActiveView) => void;
  COLORS: string[];
  onOpenManageBulk: () => void;
  /** Ordered history of manual generations — newest first, max 10 entries, one entry per run (not per cohort) */
  cohortGenLog: Array<{ cohortId: string; timestamp: string; modelUsed: ForecastModel | null }>;
  onSelectCohort: (cohortId: string) => void;
  /** Bottom-up: cohortId -> short-leaf diagnostics for derived aggregates. */
  shortLeafWarnings?: Record<string, { shortLeaves: number; totalLeaves: number; share: number }>;
  /** P10 — one-off historical event flags, keyed by the same 7-part cohort
   *  key as forecastStore (segment|product|productL2|channel|channelL2|
   *  tariffL1|tariffL2, no scenario component). */
  oneOffMonths: Record<string, { month: string; reason: string }[]>;
  setOneOffMonths: (updater: (prev: Record<string, { month: string; reason: string }[]>) => Record<string, { month: string; reason: string }[]>) => void;
}

export const StandardForecastTab: React.FC<StandardForecastTabProps> = ({
  data,
  columns,
  wiDateCol, setWiDateCol,
  wiMetricCol, setWiMetricCol,
  wiValueCol, setWiValueCol,
  wiArpuCol, setWiArpuCol,
  wiRevenueCol, setWiRevenueCol,
  wiInflowVal, setWiInflowVal,
  wiOutflowVal, setWiOutflowVal,
  wiBaseVal, setWiBaseVal,
  wiRetentionVal, setWiRetentionVal,
  wiSegmentCol, setWiSegmentCol,
  wiProductCol, setWiProductCol,
  wiProductL2Col = '',
  setWiProductL2Col,
  wiChannelCol, setWiChannelCol,
  wiChannelL2Col = '',
  setWiChannelL2Col,
  wiTariffL1Col = '',
  wiTariffL2Col = '',
  productTree,
  channelTree,
  tariffTree,
  segmentValue, setSegmentValue,
  productValue, setProductValue,
  productL2Value = '',
  setProductL2Value,
  channelValue, setChannelValue,
  channelL2Value = '',
  setChannelL2Value,
  tariffValue = '',
  setTariffValue,
  tariffL2Value = '',
  setTariffL2Value,
  stdScenario, setStdScenario,
  selectedForecastModel, setSelectedForecastModel,
  preHorizonUncertainty, setPreHorizonUncertainty,
  postHorizonExpansionRate, setPostHorizonExpansionRate,
  confidenceHorizon, setConfidenceHorizon,
  generateStandardForecast,
  aggregateState,
  generateResult,
  notice,
  error,
  forecastData,
  compareCategories,
  windowSize, setWindowSize,
  windowOffset, setWindowOffset,
  stdChartData,
  formatNumber,
  downloadExcel,
  setActiveView,
  COLORS,
  onOpenManageBulk,
  cohortGenLog,
  onSelectCohort,
  oneOffMonths,
  setOneOffMonths,
  shortLeafWarnings = {},
}) => {
  const { t } = useTranslation();
  const [showDataMappingDrawer, setShowDataMappingDrawer] = useState(false);
  const [stdChartView, setStdChartView] = useState<'volume' | 'value'>('volume');
  const [dismissedCohortKey, setDismissedCohortKey] = useState<string | null>(null);
  const [dismissedConfidenceCohortKey, setDismissedConfidenceCohortKey] = useState<string | null>(null);
  // Phase 3 P8 — Fitted Model Parameters ("the pyramid") is a technical diagnostic;
  // hidden by default so the business-facing UI stays uncluttered, retrievable via
  // this toggle. Model Advisor / Confidence Advisor and the two amber warnings
  // (missing months, seasonal fallback) are explicitly OUT of scope for this toggle
  // and remain always-visible.
  const [showTechnicalDetails, setShowTechnicalDetails] = useState(false);
  const { baseForecast, bulkRuns } = useForecast();

  const currentCohortKey = `${segmentValue}-${productValue}-${channelValue}-${stdScenario}`;
  const isDismissed = dismissedCohortKey === currentCohortKey;
  const isConfidenceDismissed = dismissedConfidenceCohortKey === currentCohortKey;

  const actualValuesDetail = useMemo(() => {
    if (!wiDateCol || !wiMetricCol || !wiValueCol || !data || data.length === 0) return null;

    const targetMetric = stdScenario === 'Inflow' ? wiInflowVal :
                         stdScenario === 'Outflow' ? wiOutflowVal :
                         stdScenario === 'Base' ? wiBaseVal : wiRetentionVal;

    if (!targetMetric) return null;

    let filtered = data
      .map(row => ({ ...row, _parsedDate: new Date(row[wiDateCol]) }))
      .filter(row => isValid(row._parsedDate) && String(row[wiMetricCol]) === targetMetric);

    if (wiSegmentCol && segmentValue !== 'All (Aggregated)') {
      filtered = filtered.filter(row => String(row[wiSegmentCol]) === segmentValue);
    }
    if (wiProductCol && productValue !== 'All (Aggregated)') {
      filtered = filtered.filter(row => String(row[wiProductCol]) === productValue);
    }
    if (wiProductL2Col && productL2Value) {
      filtered = filtered.filter(row => String(row[wiProductL2Col]) === productL2Value);
    }
    if (wiChannelCol && channelValue !== 'All (Aggregated)') {
      filtered = filtered.filter(row => String(row[wiChannelCol]) === channelValue);
    }
    if (wiChannelL2Col && channelL2Value) {
      filtered = filtered.filter(row => String(row[wiChannelL2Col]) === channelL2Value);
    }
    if (wiTariffL1Col && tariffValue && tariffValue !== 'All (Aggregated)') {
      filtered = filtered.filter(row => String(row[wiTariffL1Col]) === tariffValue);
    }
    if (wiTariffL2Col && tariffL2Value) {
      filtered = filtered.filter(row => String(row[wiTariffL2Col]) === tariffL2Value);
    }

    if (filtered.length < 2) return null;

    const aggregatedDataMap = new Map<number, number>();
    filtered.forEach(row => {
      const time = row._parsedDate.getTime();
      const targetVal = Number(row[wiValueCol]) || 0;
      aggregatedDataMap.set(time, (aggregatedDataMap.get(time) || 0) + targetVal);
    });

    const sortedActuals = Array.from(aggregatedDataMap.entries())
      .sort((a, b) => a[0] - b[0]);

    if (sortedActuals.length === 0) return null;

    const calStartMonth = new Date(sortedActuals[0][0]).getMonth();
    const actualValues = sortedActuals.map(e => e[1]);
    // P10 — yyyy-MM calendar key per index, same order as actualValues, used
    // both for the one-off flag lookup below and the flagging form's month picker.
    const monthKeys = sortedActuals.map(e => format(new Date(e[0]), 'yyyy-MM'));

    return { actualValues, calStartMonth, monthKeys };
  }, [
    data, wiDateCol, wiMetricCol, wiValueCol, stdScenario,
    wiInflowVal, wiOutflowVal, wiBaseVal, wiRetentionVal,
    wiSegmentCol, segmentValue,
    wiProductCol, productValue,
    wiProductL2Col, productL2Value,
    wiChannelCol, channelValue,
    wiChannelL2Col, channelL2Value,
    wiTariffL1Col, tariffValue,
    wiTariffL2Col, tariffL2Value
  ]);

  // P10 — this cohort's own 7-part key (same format as forecastStore/
  // App.tsx's makeForecastKey) and its flagged one-off months, if any.
  const oneOffCohortKey = `${segmentValue === 'All (Aggregated)' ? 'All' : segmentValue}|${productValue === 'All (Aggregated)' ? 'All' : productValue}|${productL2Value || 'All'}|${channelValue === 'All (Aggregated)' ? 'All' : channelValue}|${channelL2Value || 'All'}|${tariffValue === 'All (Aggregated)' ? 'All' : (tariffValue || 'All')}|${tariffL2Value || 'All'}`;
  const currentOneOffFlags = oneOffMonths[oneOffCohortKey] ?? [];
  // Key on oneOffMonths + oneOffCohortKey (both stable across renders) rather
  // than currentOneOffFlags (a fresh `[]` each render when unflagged, which
  // would otherwise make oneOffFlagSet — and every advisor memo downstream —
  // recompute its grid-search on every render).
  const oneOffFlagSet = useMemo(
    () => new Set((oneOffMonths[oneOffCohortKey] ?? []).map(f => f.month)),
    [oneOffMonths, oneOffCohortKey],
  );

  // Cleaned series (flagged months substituted) — what the model actually
  // fits on. Falls back to the raw series untouched when there are no flags.
  const cleanedActualValues = useMemo(() => {
    if (!actualValuesDetail) return null;
    return applyOneOffFlagsToSeries(actualValuesDetail.actualValues, actualValuesDetail.monthKeys, oneOffFlagSet);
  }, [actualValuesDetail, oneOffFlagSet]);

  const modelRecommendation = useMemo(() => {
    if (!actualValuesDetail || !cleanedActualValues) return null;
    return analyzeAndRecommendModel(cleanedActualValues, actualValuesDetail.calStartMonth);
  }, [actualValuesDetail, cleanedActualValues]);

  const confidenceRecommendation = useMemo(() => {
    if (!actualValuesDetail || !cleanedActualValues) return null;
    return analyzeAndRecommendConfidence(cleanedActualValues, actualValuesDetail.calStartMonth);
  }, [actualValuesDetail, cleanedActualValues]);

  // ── P10 one-off flagging form — local draft state ──────────────────────
  const [oneOffFormOpen, setOneOffFormOpen] = useState(false);
  const [draftOneOffMonth, setDraftOneOffMonth] = useState('');
  const [draftOneOffReason, setDraftOneOffReason] = useState('');

  const oneOffAvailableMonths = useMemo(() => {
    if (!actualValuesDetail) return [];
    // Exclude the most recent historical month: it is the forecast's boundary
    // anchor (the ARPU boundary correction pins forecast month 0 to the last
    // actual) and the Base-derivation seed (lastHistoricalInflow/Outflow).
    // Substituting it would make the actual→forecast join disagree with the
    // real last actual shown on the chart. A one-off is by nature a past
    // anomaly, so the latest month isn't a sensible flag target anyway.
    const monthKeys = actualValuesDetail.monthKeys;
    const flaggable = monthKeys.slice(0, Math.max(0, monthKeys.length - 1));
    return flaggable.filter(m => !oneOffFlagSet.has(m));
  }, [actualValuesDetail, oneOffFlagSet]);

  // Live preview of what the model will use, computed from the SAME
  // substituteOneOffValue the engine calls — a display addition, not new logic.
  const draftOneOffPreview = useMemo(() => {
    if (!actualValuesDetail || !draftOneOffMonth) return null;
    const idx = actualValuesDetail.monthKeys.indexOf(draftOneOffMonth);
    if (idx === -1) return null;
    const fileValue = actualValuesDetail.actualValues[idx];
    const modelWillUse = substituteOneOffValue(actualValuesDetail.actualValues, idx);
    return { fileValue, modelWillUse };
  }, [actualValuesDetail, draftOneOffMonth]);

  const handleAddOneOff = () => {
    if (!draftOneOffMonth) return;
    setOneOffMonths(prev => {
      const existing = prev[oneOffCohortKey] ?? [];
      return { ...prev, [oneOffCohortKey]: [...existing, { month: draftOneOffMonth, reason: draftOneOffReason.trim() }] };
    });
    setDraftOneOffMonth('');
    setDraftOneOffReason('');
  };

  const handleRemoveOneOff = (month: string) => {
    setOneOffMonths(prev => {
      const existing = prev[oneOffCohortKey] ?? [];
      const next = existing.filter(f => f.month !== month);
      const updated = { ...prev };
      if (next.length > 0) updated[oneOffCohortKey] = next;
      else delete updated[oneOffCohortKey];
      return updated;
    });
  };


  const mappingComplete = !!(wiDateCol && wiMetricCol && wiValueCol && wiInflowVal && wiOutflowVal);

  // The Model/Confidence advisors and the forecast display are gated on the
  // CURRENT cohort selection actually having data. When a user drills the
  // filters (often the L2 / tariff selections) to a combination that returns
  // no rows, actualValuesDetail is null — the advisors can't recommend anything
  // and no forecast can be generated. We surface that explicitly and suppress
  // any stale forecast, rather than silently hiding the advisors while a prior
  // forecast lingers on the chart (which reads as "the advisor disappeared").
  const selectionHasData = !!actualValuesDetail;
  const emptyCohortSelection = mappingComplete && data.length > 0 && !selectionHasData && compareCategories.length === 0;

  // ARPU chart data — historical from raw data + forecast bands from baseForecast
  const arpuChartData = useMemo(() => {
    if (!baseForecast) return [];
    const histSet = new Set(baseForecast.historicalMonths);

    // Accumulate historical ARPU from raw data rows matching the current cohort selection
    const histMap = new Map<string, { revSum: number; volSum: number; arpuVol: number }>();
    for (const row of data) {
      // SEVEN dimensions, matching generateStandardForecast's own filter chain
      // exactly. This used to filter on segment, product and channel only, so
      // the historical line was drawn from every Product L2, Channel L2 and
      // tariff under the selection while the forecast beside it was fitted to
      // one leaf. On the measured case the history covered 15x the rows the fit
      // did and read ARPU 8.67 against the forecast's 4.18 — a 107% gap between
      // two lines on one chart, presented as history versus projection.
      //
      // The semantics are copied deliberately, not tightened: an L2 or tariff
      // filter applies only when a value is SET, because that is what the fit
      // does. Filtering more strictly here than the fit did would reintroduce
      // the same disagreement from the other side.
      const rowSeg  = wiSegmentCol  ? String(row[wiSegmentCol]  ?? '') : '';
      const rowProd = wiProductCol  ? String(row[wiProductCol]  ?? '') : '';
      const rowChan = wiChannelCol  ? String(row[wiChannelCol]  ?? '') : '';
      const segOk  = !wiSegmentCol  || segmentValue === 'All (Aggregated)' || rowSeg  === segmentValue;
      const prodOk = !wiProductCol  || productValue === 'All (Aggregated)' || rowProd === productValue;
      const chanOk = !wiChannelCol  || channelValue === 'All (Aggregated)' || rowChan === channelValue;
      if (!segOk || !prodOk || !chanOk) continue;
      if (wiProductL2Col && productL2Value
          && String(row[wiProductL2Col] ?? '') !== productL2Value) continue;
      if (wiChannelL2Col && channelL2Value
          && String(row[wiChannelL2Col] ?? '') !== channelL2Value) continue;
      if (wiTariffL1Col && tariffValue && tariffValue !== 'All (Aggregated)') {
        if (String(row[wiTariffL1Col] ?? '') !== tariffValue) continue;
        if (wiTariffL2Col && tariffL2Value
            && String(row[wiTariffL2Col] ?? '') !== tariffL2Value) continue;
      }
      const dateVal = row[wiDateCol];
      if (!dateVal) continue;
      const dateObj = new Date(dateVal as string);
      if (!isValid(dateObj)) continue;
      const month = format(dateObj, 'yyyy-MM');
      if (!histSet.has(month)) continue;
      const vol  = Number(row[wiValueCol]) || 0;
      const rev  = wiRevenueCol ? Number(row[wiRevenueCol]) || 0 : 0;
      const arpu = wiArpuCol    ? Number(row[wiArpuCol])    || 0 : 0;
      const acc  = histMap.get(month) ?? { revSum: 0, volSum: 0, arpuVol: 0 };
      acc.volSum += vol;
      acc.revSum += rev;
      if (arpu > 0) acc.arpuVol += arpu * vol;
      histMap.set(month, acc);
    }

    const rows: any[] = [];
    for (const month of baseForecast.historicalMonths) {
      const acc = histMap.get(month);
      let histArpu: number | null = null;
      if (acc && acc.volSum > 0) {
        if (acc.revSum > 0) histArpu = acc.revSum / acc.volSum;
        else if (acc.arpuVol > 0) histArpu = acc.arpuVol / acc.volSum;
      }
      rows.push({ date: month, Historical: histArpu, 'Mean (Base)': null, Optimistic: null, Pessimistic: null });
    }
    for (const m of baseForecast.months) {
      rows.push({
        date: m.month,
        Historical: null,
        'Mean (Base)': m.arpu.mean,
        // Absent bounds stay absent. Math.max(0, undefined) is NaN, which
        // Recharts renders as a broken series rather than as no series.
        Optimistic: m.arpu.optimistic,
        Pessimistic: m.arpu.pessimistic === undefined ? undefined : Math.max(0, m.arpu.pessimistic),
      });
    }
    return rows.sort((a, b) => (a.date as string).localeCompare(b.date as string));
  }, [baseForecast, data, wiDateCol, wiValueCol, wiArpuCol, wiRevenueCol, wiSegmentCol, wiProductCol, wiChannelCol, wiProductL2Col, wiChannelL2Col, wiTariffL1Col, wiTariffL2Col, segmentValue, productValue, channelValue, productL2Value, channelL2Value, tariffValue, tariffL2Value]);

  // --- Manual-generation side panel helpers ---

  function abbrevModel(model: ForecastModel): string {
    if (model === 'Holt Linear') return 'HL';
    if (model === 'Damped Trend') return 'DT';
    if (model === 'Holt-Winters') return 'HW';
    if (model === 'Simple Exponential Smoothing') return 'SES';
    return model;
  }

  function timeSince(isoTimestamp: string): string {
    const diffMs = Date.now() - new Date(isoTimestamp).getTime();
    const mins = Math.floor(diffMs / 60_000);
    if (mins < 1) return 'Just now';
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    return `${Math.floor(hrs / 24)}d ago`;
  }

  function cohortShortLabel(seg: string, prod: string, chan: string): string {
    return [seg, prod, chan].filter(v => v && v !== 'All').join(' · ') || 'All cohorts';
  }

  const allBulkIds = useMemo(
    () => new Set(bulkRuns.flatMap(r => r.cohortIds)),
    [bulkRuns],
  );

  // Array is already newest-first and capped at 10 by App.tsx.
  // Filter out any cohort that has since been claimed by a bulk run.
  // Each entry is its own row — the same cohort can appear multiple times
  // if it was regenerated with different models.
  const manualCohortEntries = useMemo(() => {
    return cohortGenLog
      .filter(e => !allBulkIds.has(e.cohortId))
      .map(e => {
        // Formats all end in |type|scenario. Peel those off the end, then read
        // the dimension tuple by length (9-part incl. tariff, 7-part pre-tariff,
        // 3-part legacy) — never by a fixed positional index.
        const parts = e.cohortId.split('|');
        const scenario = parts[parts.length - 1] || '';
        const dims = parts.slice(0, parts.length - 2);
        let segment = 'All', product = 'All', channel = 'All';
        if (dims.length >= 7)      { segment = dims[0]; product = dims[1]; channel = dims[3]; }
        else if (dims.length === 5){ segment = dims[0]; product = dims[1]; channel = dims[3]; }
        else                       { segment = dims[0] || 'All'; product = dims[1] || 'All'; channel = dims[2] || 'All'; }
        return { cohortId: e.cohortId, segment, product, channel, scenario, timestamp: e.timestamp, modelUsed: e.modelUsed };
      });
  }, [cohortGenLog, allBulkIds]);

  // Built to match the 9-part manualCohortId/stdId format so the active row
  // highlights correctly (seg|prod|prodL2|chan|chanL2|tariffL1|tariffL2|type|scen).
  const activeCohortId = [
    segmentValue === 'All (Aggregated)' ? 'All' : segmentValue,
    productValue === 'All (Aggregated)' ? 'All' : productValue,
    productL2Value || 'All',
    channelValue === 'All (Aggregated)' ? 'All' : channelValue,
    channelL2Value || 'All',
    tariffValue === 'All (Aggregated)' ? 'All' : (tariffValue || 'All'),
    tariffL2Value || 'All',
    'Standard Forecast',
    stdScenario,
  ].join('|');

  /** Short-leaf warning for the cohort currently on screen, if any. */
  const activeShortLeafWarning = shortLeafWarnings[activeCohortId];

  // Legend label for the forecast mean line — includes the model name once a
  // forecast has been generated, so the chart self-documents which model was used.
  const sftModel = baseForecast ? provenanceModel(baseForecast.provenance) : null;
  const meanBaseLabel = sftModel
    ? `Mean (Base) — ${sftModel}`
    : 'Mean (Base)';
  console.log('[StandardForecastTab] meanBaseLabel at render:', meanBaseLabel);

  return (
    <>
      <div className="w-80 bg-white border-r border-slate-200 flex flex-col shadow-sm z-10 overflow-y-auto p-6 space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-900">{t('baseline_standard_forecast')}</h2>
          <button
            onClick={onOpenManageBulk}
            title={t('baseline_manage_bulk_generations')}
            className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold text-slate-600 bg-slate-50 hover:bg-slate-100 rounded-lg transition-colors border border-slate-200"
          >
            <LayersIcon size={13} />{t('baseline_manage')}</button>
        </div>
        
        {data.length === 0 ? (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-800 space-y-2">
            <p className="font-semibold">{t('baseline_no_data_loaded')}</p>
            <p className="text-xs">{t('baseline_upload_an_ibro_data_file_from_the_home_page_t')}</p>
            <button
              onClick={() => setActiveView('home')}
              className="mt-1 text-xs font-semibold text-amber-900 underline underline-offset-2"
            >{t('baseline_go_to_home')}</button>
          </div>
        ) : (
          <>
            {/* ── Data Mapping button ── */}
            <div>
              <button
                onClick={() => setShowDataMappingDrawer(true)}
                className="w-full flex items-center justify-between px-3 py-2.5 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 transition-colors"
              >
                <span className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                  <Database size={15} className="text-slate-500" />{t('common_data_mapping_and_segmentation')}</span>
                {mappingComplete
                  ? <CheckCircle2 size={15} className="text-emerald-500 shrink-0" />
                  : <AlertCircle size={15} className="text-amber-400 shrink-0" />}
              </button>
              {!mappingComplete && (
                <p className="text-[11px] text-amber-600 mt-1.5 px-1">{t('baseline_complete_column_mapping_to_enable_forecasting')}</p>
              )}
            </div>

            {/* ── Segmentation filters ── */}
            {(wiSegmentCol || wiProductCol || wiChannelCol || wiTariffL1Col) && (
              <div className="space-y-4 pt-2 border-t border-slate-100">
                <h3 className="text-sm font-semibold uppercase tracking-wider text-slate-500 flex items-center gap-2">
                  <Filter size={16} />{t('baseline_filters')}</h3>
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg space-y-3">
                  {wiSegmentCol && (
                    <div className="space-y-1.5">
                      <label className="block text-xs font-medium text-slate-700">{t('common_segment')}</label>
                      <select value={segmentValue} onChange={(e) => setSegmentValue(e.target.value)} className="w-full text-sm border border-slate-200 rounded-lg p-2 bg-white outline-none">
                        <option value="">{t('baseline_select')}</option>
                        <option value="All (Aggregated)">{t('baseline_all_aggregated')}</option>
                        {Array.from(new Set(data.map(r => String(r[wiSegmentCol])).filter(v => v && v !== 'undefined'))).sort().map(v => (
                          <option key={v} value={v}>{v}</option>
                        ))}
                      </select>
                    </div>
                  )}

                  {wiProductCol && (
                    <div className="space-y-1.5">
                      <label className="block text-xs font-medium text-slate-700">{t('common_product')}</label>
                      {productTree && productTree.size > 0 ? (
                        <HierarchicalDropdown
                          label=""
                          tree={productTree}
                          value={{
                            l1: productValue && productValue !== 'All (Aggregated)' ? productValue : null,
                            l2: productL2Value || null,
                          }}
                          onChange={(v: HierarchicalSelection) => {
                            setProductValue(v.l1 ?? 'All (Aggregated)');
                            setProductL2Value?.(v.l2 ?? '');
                          }}
                          variant="light"
                          className="w-full"
                        />
                      ) : (
                        <select value={productValue} onChange={(e) => setProductValue(e.target.value)} className="w-full text-sm border border-slate-200 rounded-lg p-2 bg-white outline-none">
                          <option value="">{t('baseline_select')}</option>
                          <option value="All (Aggregated)">{t('baseline_all_aggregated')}</option>
                          {Array.from(new Set(data.map(r => String(r[wiProductCol])).filter(v => v && v !== 'undefined'))).sort().map(v => (
                            <option key={v} value={v}>{v}</option>
                          ))}
                        </select>
                      )}
                    </div>
                  )}

                  {wiChannelCol && (
                    <div className="space-y-1.5">
                      <label className="block text-xs font-medium text-slate-700">{t('common_channel')}</label>
                      {channelTree && channelTree.size > 0 ? (
                        <HierarchicalDropdown
                          label=""
                          tree={channelTree}
                          value={{
                            l1: channelValue && channelValue !== 'All (Aggregated)' ? channelValue : null,
                            l2: channelL2Value || null,
                          }}
                          onChange={(v: HierarchicalSelection) => {
                            setChannelValue(v.l1 ?? 'All (Aggregated)');
                            setChannelL2Value?.(v.l2 ?? '');
                          }}
                          variant="light"
                          className="w-full"
                        />
                      ) : (
                        <select value={channelValue} onChange={(e) => setChannelValue(e.target.value)} className="w-full text-sm border border-slate-200 rounded-lg p-2 bg-white outline-none">
                          <option value="">{t('baseline_select')}</option>
                          <option value="All (Aggregated)">{t('baseline_all_aggregated')}</option>
                          {Array.from(new Set(data.map(r => String(r[wiChannelCol])).filter(v => v && v !== 'undefined'))).sort().map(v => (
                            <option key={v} value={v}>{v}</option>
                          ))}
                        </select>
                      )}
                    </div>
                  )}

                  {/* Tariff dimension (Phase 2a) — only shown when a tariff column is mapped */}
                  {wiTariffL1Col && (
                    <div className="space-y-1.5">
                      <label className="block text-xs font-medium text-slate-700">{t('common_tariff')}</label>
                      {tariffTree && tariffTree.size > 0 ? (
                        <HierarchicalDropdown
                          label=""
                          tree={tariffTree}
                          value={{
                            l1: tariffValue && tariffValue !== 'All (Aggregated)' ? tariffValue : null,
                            l2: tariffL2Value || null,
                          }}
                          onChange={(v: HierarchicalSelection) => {
                            setTariffValue?.(v.l1 ?? 'All (Aggregated)');
                            setTariffL2Value?.(v.l2 ?? '');
                          }}
                          variant="light"
                          className="w-full"
                        />
                      ) : (
                        <select value={tariffValue} onChange={(e) => setTariffValue?.(e.target.value)} className="w-full text-sm border border-slate-200 rounded-lg p-2 bg-white outline-none">
                          <option value="">{t('baseline_select')}</option>
                          <option value="All (Aggregated)">{t('baseline_all_aggregated')}</option>
                          {Array.from(new Set(data.map(r => String(r[wiTariffL1Col])).filter(v => v && v !== 'undefined'))).sort().map(v => (
                            <option key={v} value={v}>{v}</option>
                          ))}
                        </select>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}

            <div className="space-y-4 pt-4 border-t border-slate-100">
              <h3 className="text-sm font-semibold uppercase tracking-wider text-slate-500 flex items-center gap-2">
                <Settings size={16} />{t('baseline_scenario_tweaks')}</h3>
              <div>
                <label className="block text-xs font-semibold text-slate-900 mb-1">IBRO Scenario</label>
                <select value={stdScenario} onChange={(e) => setStdScenario(e.target.value)} className="w-full text-sm border border-slate-200 rounded-lg p-2.5 bg-slate-50 outline-none">
                  <option value="Inflow">Inflow</option>
                  <option value="Outflow">Outflow</option>
                  <option value="Base">Base</option>
                  <option value="Retention">Retention</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-900 mb-2">{t('common_forecast_model')}</label>

                {/* Empty-cohort state — keep the Model Advisor's visual footprint
                    but faded and non-interactive, with the explanation on hover,
                    so the recommender never appears to simply vanish. */}
                {emptyCohortSelection && (
                  <div className="mb-4 relative group">
                    <div className="p-3 bg-indigo-50/40 border border-indigo-100 rounded-xl space-y-2 opacity-60 select-none">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-extrabold uppercase tracking-widest text-indigo-600">{t('baseline_model_advisor')}</span>
                        <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-slate-200 text-slate-500">{t('baseline_unavailable')}</span>
                      </div>
                      <div className="text-xs text-slate-500">
                        <span className="font-semibold text-slate-700">{t('baseline_recommended')}</span>
                        <span className="font-bold text-slate-400">—</span>
                      </div>
                      <p className="text-[11px] leading-relaxed text-slate-400">{t('baseline_needs_historical_data_for_this_cohort_to_reco')}</p>
                      <button
                        type="button"
                        disabled
                        className="w-full text-center px-2.5 py-1.5 bg-slate-200 text-slate-400 rounded-lg text-[10px] font-bold cursor-not-allowed"
                      >{t('baseline_apply_recommended_model')}</button>
                    </div>
                    <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 hidden group-hover:block w-60 bg-slate-800 text-white text-[10px] rounded-lg px-2.5 py-2 z-50 leading-snug pointer-events-none">{t('baseline_no_historical_data_for_this_cohort_this_exact')}</span>
                  </div>
                )}

                {/* Model Recommendation Panel */}
                {!emptyCohortSelection && modelRecommendation && (
                  <div className="mb-4">
                    {!isDismissed ? (
                      <div className="p-3 bg-indigo-50/50 border border-indigo-100 rounded-xl space-y-2 relative">
                        <button
                          type="button"
                          onClick={() => setDismissedCohortKey(currentCohortKey)}
                          className="absolute top-2 right-2 p-1 text-slate-400 hover:text-slate-600 rounded transition-colors"
                          title={t('baseline_ignore_recommendation')}
                        >
                          <X size={14} />
                        </button>
                        <div className="flex items-center justify-between pr-4">
                          <span className="text-[10px] font-extrabold uppercase tracking-widest text-indigo-600">{t('baseline_model_advisor')}</span>
                          <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${
                            modelRecommendation.confidence === 'High' ? 'bg-emerald-100 text-emerald-800' :
                            modelRecommendation.confidence === 'Medium' ? 'bg-amber-100 text-amber-800' :
                            'bg-slate-100 text-slate-600'
                          }`}>
                            {modelRecommendation.confidence} Confidence
                          </span>
                        </div>
                        
                        <div className="text-xs text-slate-700">
                          <span className="font-semibold text-slate-900">{t('baseline_recommended')}</span>
                          <span className="font-bold text-indigo-700">{modelRecommendation.recommendedModel}</span>
                        </div>
                        
                        <p className="text-[11px] leading-relaxed text-slate-650">{t(modelRecommendation.reason, modelRecommendation.reasonParams)}</p>

                        {/* Advisor parameters breakdown */}
                        <div className="grid grid-cols-2 gap-x-2 gap-y-1 pt-2 border-t border-indigo-100/80 text-[10px]">
                          <div>
                            <span className="text-slate-400">{t('baseline_trend')}</span>
                            <span className="font-semibold text-slate-700">{t(modelRecommendation.metrics.trendStrengthLabel)}</span>
                          </div>
                          <div>
                            <span className="text-slate-400">{t('baseline_seasonality')}</span>
                            <span className="font-semibold text-slate-700">
                              {modelRecommendation.metrics.seasonalityLabel === 'Recurring monthly peaks' ? t('baseline_recurring') : t('baseline_none')}
                            </span>
                          </div>
                          <div>
                            <span className="text-slate-400">{t('baseline_volatility')}</span>
                            <span className="font-semibold text-slate-700">{t(modelRecommendation.metrics.volatilityLabel)}</span>
                          </div>
                          <div>
                            <span className="text-slate-400">{t('baseline_best_error')}</span>
                            <span className="font-semibold text-slate-700">
                              {modelRecommendation.metrics.bestModelByFit === 'Simple Exponential Smoothing' ? t('baseline_ses') :
                               modelRecommendation.metrics.bestModelByFit === 'Holt Linear' ? 'HL' :
                               modelRecommendation.metrics.bestModelByFit === 'Damped Trend' ? 'DT' : 'HW'}
                            </span>
                          </div>
                        </div>

                        {selectedForecastModel !== modelRecommendation.recommendedModel && (
                          <div className="pt-1.5">
                            <button
                              type="button"
                              onClick={() => setSelectedForecastModel(modelRecommendation.recommendedModel)}
                              className="w-full text-center px-2.5 py-1.5 bg-[#e60000] hover:bg-[#cc0000] text-white rounded-lg text-[10px] font-bold transition-colors shadow-sm"
                            >{t('baseline_apply_recommended_model')}</button>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="flex justify-end">
                        <button
                          type="button"
                          onClick={() => setDismissedCohortKey(null)}
                          className="text-[10px] text-slate-500 hover:text-slate-700 font-semibold underline"
                        >{t('baseline_show_model_recommendation')}</button>
                      </div>
                    )}
                  </div>
                )}

                <div className="space-y-2">
                  {(['Simple Exponential Smoothing', 'Holt Linear', 'Damped Trend', 'Holt-Winters'] as const).map(m => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => setSelectedForecastModel(m)}
                      className={`w-full text-left px-3 py-2.5 rounded-lg border transition-colors ${
                        selectedForecastModel === m
                          ? 'border-[#e60000] bg-red-50'
                          : 'border-slate-200 bg-slate-50 hover:bg-slate-100'
                      }`}
                    >
                      <div className={`text-sm font-semibold ${selectedForecastModel === m ? 'text-[#e60000]' : 'text-slate-800'}`}>{m}</div>
                      <div className="text-[10px] text-slate-500 mt-0.5 leading-snug">
                        {m === 'Simple Exponential Smoothing' && t('baseline_level_smoothing_optimised_per_series')}
                        {m === 'Holt Linear' && t('baseline_level_trend_smoothing_optimised_per_series')}
                        {m === 'Damped Trend' && t('baseline_trend_damped_toward_flat_optimised_per_series')}
                        {m === 'Holt-Winters' && t('baseline_triple_exponential_smoothing_multiplicative_s')}
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Empty-cohort state — faded, non-interactive Confidence Advisor
                  with the same on-hover explanation, mirroring the Model Advisor. */}
              {emptyCohortSelection && (
                <div className="mb-4 relative group">
                  <div className="p-3 bg-violet-50/40 border border-violet-100 rounded-xl space-y-2 opacity-60 select-none">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-extrabold uppercase tracking-widest text-violet-600">{t('baseline_confidence_advisor')}</span>
                      <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-slate-200 text-slate-500">{t('baseline_unavailable')}</span>
                    </div>
                    <div className="text-xs text-slate-500">
                      <span>{t('baseline_recommended_profile')}</span>
                      <span className="font-bold text-slate-400">—</span>
                    </div>
                    <p className="text-[11px] leading-relaxed text-slate-400">{t('baseline_needs_historical_data_for_this_cohort_to_reco')}</p>
                    <button
                      type="button"
                      disabled
                      className="w-full text-center px-2.5 py-1.5 bg-slate-200 text-slate-400 rounded-lg text-[10px] font-bold cursor-not-allowed"
                    >{t('baseline_apply_recommended_settings')}</button>
                  </div>
                  <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 hidden group-hover:block w-60 bg-slate-800 text-white text-[10px] rounded-lg px-2.5 py-2 z-50 leading-snug pointer-events-none">{t('baseline_no_historical_data_for_this_cohort_this_exact')}</span>
                </div>
              )}

              {/* Confidence Settings Recommendation Panel */}
              {!emptyCohortSelection && confidenceRecommendation && (
                <div className="mb-4">
                  {!isConfidenceDismissed ? (
                    <div className="p-3 bg-violet-50/50 border border-violet-100 rounded-xl space-y-2 relative">
                      <button
                        type="button"
                        onClick={() => setDismissedConfidenceCohortKey(currentCohortKey)}
                        className="absolute top-2 right-2 p-1 text-slate-400 hover:text-slate-600 rounded transition-colors"
                        title={t('baseline_ignore_recommendation')}
                      >
                        <X size={14} />
                      </button>
                      <div className="flex items-center justify-between pr-4">
                        <span className="text-[10px] font-extrabold uppercase tracking-widest text-violet-600">{t('baseline_confidence_advisor')}</span>
                        <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${
                          confidenceRecommendation.strength === 'High' ? 'bg-emerald-100 text-emerald-800' :
                          confidenceRecommendation.strength === 'Medium' ? 'bg-amber-100 text-amber-800' :
                          'bg-slate-100 text-slate-600'
                        }`}>
                          {confidenceRecommendation.strength} Confidence
                        </span>
                      </div>
                      
                      <div className="text-xs text-slate-700 font-medium">
                        <span>{t('baseline_recommended_profile')}</span>
                        <span className="font-bold text-violet-700">{confidenceRecommendation.profile}</span>
                      </div>
                      
                      {/* `reasonParams` was never produced by analyzeAndRecommendConfidence -
    ConfidenceRecommendation has no such field - so this always passed
    undefined. Deleted rather than added to the type: no current reason
    key interpolates, and if one ever gains a {{placeholder}} it will
    render literally and be seen, which is the failure we want. Adding
    the field would have made a silent omission permanent. */}
                      <p className="text-[11px] leading-relaxed text-slate-600">{t(confidenceRecommendation.reason)}</p>

                      {/* Display suggested settings values */}
                      <div className="bg-white/80 p-2 rounded-lg border border-violet-100 text-[10px] text-slate-700 space-y-1">
                        <div className="font-bold text-slate-500 uppercase tracking-widest text-[9px] mb-0.5">{t('baseline_suggested_values')}</div>
                        <div className="flex justify-between items-center">
                          <span>{t('baseline_pre_horizon_z_score')}</span>
                          <span className="font-mono font-bold text-slate-900">{confidenceRecommendation.preHorizonZ.toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span>{t('baseline_post_horizon_band_multiplier')}</span>
                          <span className="font-mono font-bold text-slate-900">{confidenceRecommendation.postHorizonMultiplier.toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span>{t('baseline_confidence_horizon_months')}</span>
                          <span className="font-mono font-bold text-slate-900">{confidenceRecommendation.confidenceHorizon}</span>
                        </div>
                      </div>

                      {(preHorizonUncertainty !== confidenceRecommendation.preHorizonZ ||
                        postHorizonExpansionRate !== confidenceRecommendation.postHorizonMultiplier ||
                        confidenceHorizon !== confidenceRecommendation.confidenceHorizon) && (
                        <div className="pt-1">
                          <button
                            type="button"
                            onClick={() => {
                              setPreHorizonUncertainty(confidenceRecommendation.preHorizonZ);
                              setPostHorizonExpansionRate(confidenceRecommendation.postHorizonMultiplier);
                              setConfidenceHorizon(confidenceRecommendation.confidenceHorizon);
                            }}
                            className="w-full text-center px-2.5 py-1.5 bg-[#e60000] hover:bg-[#cc0000] text-white rounded-lg text-[10px] font-bold transition-colors shadow-sm"
                          >{t('baseline_apply_recommended_settings')}</button>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="flex justify-end">
                      <button
                        type="button"
                        onClick={() => setDismissedConfidenceCohortKey(null)}
                        className="text-[10px] text-slate-500 hover:text-slate-700 font-semibold underline"
                      >{t('baseline_show_confidence_recommendation')}</button>
                    </div>
                  )}
                </div>
              )}

              <div>
                <div className="flex justify-between mb-1">
                  <div className="flex items-center gap-1">
                    <label className="text-xs font-medium text-slate-700">{t('baseline_pre_horizon_z_score')}</label>
                    <span className="relative group cursor-help text-slate-400 hover:text-slate-600 transition-colors">
                      <Info size={11} />
                      <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 w-48 text-[10px] text-white bg-slate-700 rounded px-2 py-1 hidden group-hover:block z-50 leading-snug">{t('baseline_controls_how_wide_the_optimistic_and_pessimis')}</span>
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      step="0.05"
                      value={preHorizonUncertainty}
                      onChange={(e) => setPreHorizonUncertainty(Number(e.target.value))}
                      className="w-16 text-xs font-semibold text-emerald-600 border border-slate-200 rounded px-1 outline-none focus:border-emerald-500"
                    />
                  </div>
                </div>
                <input type="range" min="0" max="2.5" step="0.05" value={preHorizonUncertainty} onChange={(e) => setPreHorizonUncertainty(Number(e.target.value))} className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-emerald-500" />
              </div>
              <div>
                <div className="flex justify-between mb-1">
                  <div className="flex items-center gap-1">
                    <label className="text-xs font-medium text-slate-700">{t('baseline_post_horizon_band_multiplier')}</label>
                    <span className="relative group cursor-help text-slate-400 hover:text-slate-600 transition-colors">
                      <Info size={11} />
                      <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 w-48 text-[10px] text-white bg-slate-700 rounded px-2 py-1 hidden group-hover:block z-50 leading-snug">{t('baseline_controls_how_much_wider_the_forecast_range_be')}</span>
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      step="0.05"
                      value={postHorizonExpansionRate}
                      onChange={(e) => setPostHorizonExpansionRate(Number(e.target.value))}
                      className="w-16 text-xs font-semibold text-rose-600 border border-slate-200 rounded px-1 outline-none focus:border-rose-500"
                    />
                  </div>
                </div>
                <input type="range" min="1" max="3" step="0.05" value={postHorizonExpansionRate} onChange={(e) => setPostHorizonExpansionRate(Number(e.target.value))} className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-rose-500" />
              </div>
              <div>
                <div className="flex justify-between mb-1">
                  <div className="flex items-center gap-1">
                    <label className="text-xs font-medium text-slate-700">{t('baseline_confidence_horizon_months')}</label>
                    <span className="relative group cursor-help text-slate-400 hover:text-slate-600 transition-colors">
                      <Info size={11} />
                      <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 w-48 text-[10px] text-white bg-slate-700 rounded px-2 py-1 hidden group-hover:block z-50 leading-snug">{t('baseline_controls_how_many_forecast_months_use_the_ini')}</span>
                    </span>
                  </div>
                  <span className="text-xs font-semibold text-slate-600">{confidenceHorizon}</span>
                </div>
                <input type="range" min="0" max="6" value={confidenceHorizon} onChange={(e) => setConfidenceHorizon(Number(e.target.value))} className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-blue-500" />
              </div>
            </div>

            {/* P10 — one-off historical event flagging. Collapsed by default;
                only the small toggle link shows for a cohort with no flags. */}
            <div className="pt-1">
              {currentOneOffFlags.length > 0 && (
                <div className="mb-2 space-y-1">
                  {currentOneOffFlags.map(f => (
                    <div key={f.month} className="flex items-center justify-between gap-2 px-2.5 py-1.5 bg-amber-50 border border-amber-200 rounded-lg text-[11px]">
                      <span className="text-amber-800 font-semibold">{f.month}{f.reason ? ` — ${f.reason}` : ''}</span>
                      <button
                        type="button"
                        onClick={() => handleRemoveOneOff(f.month)}
                        className="text-amber-500 hover:text-amber-700 transition-colors shrink-0"
                        title={t('baseline_remove_flag')}
                      >
                        <X size={12} />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              <button
                type="button"
                onClick={() => setOneOffFormOpen(v => !v)}
                className="w-full flex items-center justify-between px-2.5 py-1.5 text-xs font-semibold text-slate-500 hover:text-slate-700 hover:bg-slate-50 rounded-lg transition-colors"
              >
                <span>{currentOneOffFlags.length > 0 ? t('baseline_flag_another_one_off_month') : t('baseline_flag_a_one_off_historical_month')}</span>
                <ChevronDown size={13} className={`text-slate-400 transition-transform ${oneOffFormOpen ? 'rotate-180' : ''}`} />
              </button>

              {oneOffFormOpen && (
                <div className="mt-2 p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-2.5">
                  <p className="text-[10px] text-slate-500 leading-relaxed">{t('baseline_excludes_an_exceptional_month_e_g_a_one_time')}{' '}<strong>{t('baseline_and_tightens_the_confidence_bands')}</strong> {t('baseline_for_this_cohort_the_band_change_is_a_direct_e')}
                  </p>

                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">{t('common_month')}</label>
                    <select
                      value={draftOneOffMonth}
                      onChange={e => setDraftOneOffMonth(e.target.value)}
                      disabled={oneOffAvailableMonths.length === 0}
                      className="w-full text-sm border border-slate-200 rounded-lg p-2 bg-white outline-none focus:border-[#e60000] disabled:opacity-50"
                    >
                      <option value="">{t('baseline_select_a_month')}</option>
                      {oneOffAvailableMonths.map(m => <option key={m} value={m}>{m}</option>)}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">{t('baseline_reason_optional')}</label>
                    <input
                      type="text"
                      value={draftOneOffReason}
                      onChange={e => setDraftOneOffReason(e.target.value)}
                      placeholder={t('baseline_e_g_one_time_fleet_update')}
                      className="w-full text-sm border border-slate-200 rounded-lg p-2 bg-white outline-none focus:border-[#e60000]"
                    />
                  </div>

                  {/* Transparency: the exact number the optimiser will use in place of
                      the anomaly, computed by the same substituteOneOffValue the engine
                      calls — lets the user sanity-check the heuristic before committing. */}
                  {draftOneOffPreview && (
                    <div className="px-2.5 py-2 bg-white border border-slate-200 rounded-lg text-[11px] text-slate-600">{t('baseline_file_value')}{' '}<span className="font-mono font-semibold text-slate-800">{formatNumber(draftOneOffPreview.fileValue)}</span>
                      <span className="mx-1.5 text-slate-300">·</span>{t('baseline_model_will_use')}{' '}<span className="font-mono font-semibold text-emerald-700">{formatNumber(draftOneOffPreview.modelWillUse)}</span>
                      <span className="text-slate-400"> (trend and seasonal-consistent)</span>
                    </div>
                  )}

                  <button
                    type="button"
                    onClick={handleAddOneOff}
                    disabled={!draftOneOffMonth}
                    className="w-full text-center px-2.5 py-2 bg-slate-700 hover:bg-slate-800 text-white rounded-lg text-xs font-bold transition-colors shadow-sm disabled:opacity-40 disabled:cursor-not-allowed"
                  >{t('baseline_add_flag')}</button>
                </div>
              )}
            </div>

            {/* An aggregate selection does not fit a model to the total — it
                fits the leaves underneath and lets the total be summed from
                them. The button says which of the four situations applies, so
                the count is visible BEFORE the click rather than discovered
                after it. The two disabled states are distinct on purpose:
                "already covered" and "not in your data" both mean nothing will
                be generated, and they mean opposite things. */}
            <button
              onClick={generateStandardForecast}
              disabled={aggregateState.kind === 'covered' || aggregateState.kind === 'never'
                        || aggregateState.kind === 'blocked'}
              className={`w-full font-medium py-2.5 px-4 rounded-lg transition-colors shadow-sm mt-4 ${
                aggregateState.kind === 'covered' || aggregateState.kind === 'blocked'
                  || aggregateState.kind === 'never'
                  /* A coverage statement does not belong on the action colour.
                     Faded red still reads as the primary action, greyed out -
                     "this is the thing to click, but not now" - when the message
                     is "there is nothing to click, and here is why". Session J
                     moved coverage off red surfaces; the disabled button kept
                     the convention only by accident of opacity. */
                  ? 'bg-slate-200 text-slate-400 cursor-not-allowed'
                  : 'bg-[#e60000] hover:bg-[#cc0000] text-white'
              }`}
            >
              {aggregateState.kind === 'generate'
                ? (aggregateState.missing === 1
                    ? t('standard_generate_missing_leaves_one')
                    : t('standard_generate_missing_leaves', { count: aggregateState.missing }))
                : aggregateState.kind === 'covered'
                  ? t('standard_scope_fully_covered')
                  : aggregateState.kind === 'blocked'
                    ? t('standard_scope_blocked', { count: aggregateState.unfittable })
                    : aggregateState.kind === 'never'
                      ? t('standard_scope_not_in_data')
                      : t('common_generate_forecast')}
            </button>
            {(aggregateState.kind === 'generate' || aggregateState.kind === 'blocked') && (
              <p className="text-[11px] text-slate-400 mt-1.5 leading-snug">
                {t('standard_generate_missing_hint', { total: aggregateState.total })}
                {aggregateState.unfittable > 0
                  && ' ' + t('standard_hint_unfittable', { count: aggregateState.unfittable })}
              </p>
            )}
            {/* The outcome of the last scoped run. The skipped leaves are NAMED,
                not counted: "2 skipped" tells the user a number, the names tell
                them which parts of their book are not covered. This is the only
                account Step 1 gives — it has no progress panel and the app has
                no toast. */}
            {generateResult && (
              <div className="mt-3 rounded-lg bg-slate-50 px-3 py-2.5">
                <p className="text-[11px] text-slate-600 leading-snug">
                  {t('standard_generate_result', { generated: generateResult.generated })}
                </p>
                {generateResult.skipped.length > 0 && (
                  <>
                    <p className="text-[11px] text-slate-400 mt-1.5 leading-snug">
                      {t('standard_generate_result_skipped', { count: generateResult.skipped.length })}
                    </p>
                    <ul className="mt-1 space-y-0.5">
                      {generateResult.skipped.map(k => (
                        <li key={k} className="text-[11px] text-slate-400 font-mono leading-snug break-all">
                          {k.split('|').join(' · ')}
                        </li>
                      ))}
                    </ul>
                  </>
                )}
              </div>
            )}
          </>
        )}
      </div>

      <div className="flex-1 overflow-y-auto p-8">
        {error && <div className="mb-6 bg-red-50 text-red-700 p-4 rounded-xl border border-red-100 text-sm flex items-start gap-3"><Info className="shrink-0 mt-0.5" size={18} /><p>{error}</p></div>}
        {/* A COVERAGE STATEMENT IS NOT AN ERROR. "The remaining cohorts have
            too little history, the aggregate is summed from the rest" reports
            what was built; red says something went wrong. Session I made the
            completion modal a coverage statement rather than a success claim
            for the same reason, and routing this through the error banner
            would contradict that decision one screen away from it. Styled to
            match the modal informational row. */}
        {notice && <div className="mb-6 bg-slate-50 text-slate-600 p-4 rounded-xl border border-slate-200 text-sm flex items-start gap-3"><Info className="shrink-0 mt-0.5 text-slate-400" size={18} /><p>{notice}</p></div>}
        
        {forecastData.length > 0 && !emptyCohortSelection ? (
          <div className="flex gap-4 items-start">

            {/* Manual-generations side panel */}
            {manualCohortEntries.length > 0 && (
              <div className="w-48 shrink-0 bg-white rounded-2xl shadow-sm border border-slate-200 flex flex-col self-start" style={{ maxHeight: 520 }}>
                <div className="px-3 py-2.5 border-b border-slate-100 flex items-center justify-between">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">{t('baseline_generated')}</span>
                  <span className="text-[10px] font-bold text-slate-400">{manualCohortEntries.length}</span>
                </div>
                <div className="overflow-y-auto flex-1">
                  {manualCohortEntries.map(entry => {
                    const isActive = entry.cohortId === activeCohortId;
                    return (
                      <button
                        key={`${entry.cohortId}-${entry.timestamp}`}
                        onClick={() => onSelectCohort(entry.cohortId)}
                        className={`w-full text-left px-3 py-2.5 border-b border-slate-50 last:border-b-0 transition-colors ${isActive ? 'bg-red-50' : 'hover:bg-slate-50'}`}
                      >
                        <div className={`text-xs font-semibold truncate leading-tight ${isActive ? 'text-[#e60000]' : 'text-slate-800'}`}>
                          {cohortShortLabel(entry.segment, entry.product, entry.channel)}
                        </div>
                        <div className="flex items-center justify-between mt-0.5 gap-1">
                          <span className={`text-[10px] font-bold px-1 py-0.5 rounded ${isActive ? 'bg-red-100 text-[#e60000]' : 'bg-slate-100 text-slate-500'}`}>
                            {abbrevModel(entry.modelUsed)}
                          </span>
                          <span className="text-[10px] text-slate-400 shrink-0">{timeSince(entry.timestamp)}</span>
                        </div>
                        {entry.scenario && entry.scenario !== 'Base' && (
                          <div className="text-[10px] text-slate-400 mt-0.5 truncate">{entry.scenario}</div>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            <div className={`space-y-6 ${manualCohortEntries.length > 0 ? 'flex-1 min-w-0' : 'w-full max-w-5xl mx-auto'}`}>
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-semibold text-slate-900">
                  {compareCategories.length > 0 ? t('baseline_forecast_results_comparison') : t('baseline_forecast_results')}
                </h3>
                <div className="flex flex-col items-end gap-3">
                  <div className="flex items-center gap-4">
                    {/* Volume / Value toggle — only shown when ARPU is available and not in compare mode */}
                    {!compareCategories.length && baseForecast && (wiArpuCol || wiRevenueCol) && (
                      <div className="flex bg-slate-100 p-1 rounded-lg">
                        {(['volume', 'value'] as const).map(v => (
                          <button
                            key={v}
                            onClick={() => setStdChartView(v)}
                            className={`px-3 py-1 text-[10px] font-bold rounded-md transition-all ${stdChartView === v ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                          >
                            {v === 'volume' ? t('baseline_volume') : t('baseline_value_arpu')}
                          </button>
                        ))}
                      </div>
                    )}
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] uppercase font-bold text-slate-400">{t('baseline_window_size')}</span>
                      <div className="flex bg-slate-100 p-1 rounded-lg">
                        {[6, 12, 18, 24].map(size => (
                          <button
                            key={size}
                            onClick={() => {
                              setWindowSize(size);
                            }}
                            className={`px-3 py-1 text-[10px] font-bold rounded-md transition-all ${windowSize === size ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                          >
                            {size}M
                          </button>
                        ))}
                      </div>
                    </div>
                    <button onClick={() => downloadExcel(forecastData, 'standard_forecast.xlsx')} className="flex items-center gap-2 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 text-sm font-medium py-2 px-4 rounded-lg transition-colors shadow-sm">
                      <Download size={16} />{t('common_export_to_excel')}</button>
                  </div>
                </div>
              </div>
              {(() => {
                const activeChartData = stdChartView === 'value' ? arpuChartData : stdChartData;
                const arpuDomain: [number | string, number | string] = (() => {
                  if (stdChartView !== 'value') return ['auto', 'auto'];
                  const vals: number[] = [];
                  for (const row of arpuChartData) {
                    for (const k of ['Historical', 'Mean (Base)', 'Optimistic', 'Pessimistic']) {
                      const v = row[k];
                      if (typeof v === 'number' && isFinite(v) && v > 0) vals.push(v);
                    }
                  }
                  if (vals.length < 2) return ['auto', 'auto'];
                  const lo = Math.min(...vals), hi = Math.max(...vals);
                  const range = hi - lo, mid = (lo + hi) / 2;
                  const eff = Math.max(range, mid * 0.05);
                  const pad = eff * 0.15;
                  return [parseFloat(Math.max(0, lo - pad).toFixed(2)), parseFloat((hi + pad).toFixed(2))];
                })();
                return (
              <div className="h-[400px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={activeChartData} margin={{ top: 5, right: 20, bottom: 40, left: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                    <XAxis
                      dataKey="date"
                      tick={{ fontSize: 12, fill: '#64748b' }}
                      tickMargin={10}
                      axisLine={false}
                      tickLine={false}
                      tickFormatter={(val) => {
                        try {
                          const parsed = parse(val, 'yyyy-MM', new Date());
                          if (!isValid(parsed)) return val;
                          return format(parsed, 'yyyy-MM');
                        } catch (e) {
                          return val;
                        }
                      }}
                    />
                    <YAxis tick={{ fontSize: 12, fill: '#64748b' }} axisLine={false} tickLine={false} tickFormatter={(value) => formatNumber(value)} domain={arpuDomain} />
                    <Tooltip
                      formatter={(value: number) => formatNumber(value)}
                      contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                      labelStyle={{ fontWeight: 600, color: '#0f172a', marginBottom: '4px' }}
                      labelFormatter={(val) => {
                        try {
                          const parsed = parse(val, 'yyyy-MM', new Date());
                          if (!isValid(parsed)) return val;
                          return format(parsed, 'yyyy-MM');
                        } catch (e) {
                          return val;
                        }
                      }}
                    />
                    <Legend
                      wrapperStyle={{ paddingTop: '20px' }}
                      content={(props: any) => {
                        const entries: { value: string; color: string; dataKey: string }[] =
                          props.payload || [];
                        if (!entries.length) return null;
                        return (
                          <div className="flex flex-wrap justify-center gap-x-5 gap-y-1 text-xs text-slate-600" style={{ paddingTop: 20 }}>
                            {entries.map((e) => (
                              <span key={e.dataKey} className="flex items-center gap-1.5">
                                <span
                                  className="inline-block w-2.5 h-2.5 rounded-full shrink-0"
                                  style={{ backgroundColor: e.color }}
                                />
                                {e.dataKey === 'Mean (Base)' ? meanBaseLabel : e.value}
                              </span>
                            ))}
                          </div>
                        );
                      }}
                    />
                    {compareCategories.length > 0 ? (
                      compareCategories.map((cat, idx) => {
                        const color = COLORS[idx % COLORS.length];
                        return (
                          <React.Fragment key={cat}>
                            <Line type="monotone" dataKey={`${cat} (Historical)`} stroke={color} strokeWidth={2} dot={{ r: 3, fill: color, strokeWidth: 0 }} activeDot={{ r: 6 }} connectNulls />
                            <Line type="monotone" dataKey={`${cat} (Forecast)`} stroke={color} strokeWidth={3} strokeDasharray="5 5" dot={{ r: 4, fill: color, strokeWidth: 0 }} activeDot={{ r: 6 }} connectNulls />
                          </React.Fragment>
                        );
                      })
                    ) : (
                      <>
                        <Line type="monotone" dataKey="Historical" stroke="#94a3b8" strokeWidth={2} dot={{ r: 3, fill: '#94a3b8', strokeWidth: 0 }} activeDot={{ r: 6 }} connectNulls />
                        <Line type="monotone" dataKey="Optimistic" stroke="#10b981" strokeWidth={2} strokeDasharray="5 5" dot={{ r: 3, fill: '#10b981', strokeWidth: 0 }} activeDot={{ r: 6 }} connectNulls />
                        <Line type="monotone" dataKey="Mean (Base)" name={meanBaseLabel} stroke="#e60000" strokeWidth={3} strokeDasharray="5 5" dot={{ r: 4, fill: '#e60000', strokeWidth: 0 }} activeDot={{ r: 6 }} connectNulls />
                        <Line type="monotone" dataKey="Pessimistic" stroke="#f43f5e" strokeWidth={2} strokeDasharray="5 5" dot={{ r: 3, fill: '#f43f5e', strokeWidth: 0 }} activeDot={{ r: 6 }} connectNulls />
                      </>
                    )}
                    <Brush
                      dataKey="date"
                      height={30}
                      stroke="#cbd5e1"
                      startIndex={windowOffset}
                      endIndex={Math.min(activeChartData.length - 1, windowOffset + windowSize - 1)}
                      onChange={(obj: any) => {
                        if (obj && typeof obj.startIndex === 'number' && typeof obj.endIndex === 'number') {
                          setWindowOffset(obj.startIndex);
                          setWindowSize(obj.endIndex - obj.startIndex + 1);
                        }
                      }}
                      tickFormatter={() => ''}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
                );
              })()}
            </div>

            {/* Missing-month gap warning */}
            {baseForecast?.missingMonths && baseForecast.missingMonths.length > 0 && (
              <div className="flex items-start gap-3 px-4 py-3 bg-amber-50 border border-amber-100 rounded-xl text-sm text-amber-800">
                <Info size={15} className="shrink-0 mt-0.5 text-amber-500" />
                <span>
                  <strong>{t('common_missing_months_detected_in_historical_data')}</strong>{' '}
                  
                  {t('baseline_the_following')}{baseForecast.missingMonths.length === 1 ? t('baseline_month_is') : t('baseline_months_are')} {t('baseline_absent_from_this_cohort_s_history')}{' '}
                  <span className="font-mono">{baseForecast.missingMonths.join(', ')}</span>.
                  {' '}{t('baseline_gaps_can_bias_level_and_trend_initialisation')}
                </span>
              </div>
            )}

            {/* Bottom-up short-leaf warning — this aggregate is derived by summing
                its constituent leaves, and most of them are too short to fit a
                seasonal term, so the summed seasonal amplitude may be understated.
                Advisory only: the numbers still reconcile exactly to the leaves. */}
            {activeShortLeafWarning && (
              <div className="flex items-start gap-3 px-4 py-3 bg-amber-50 border border-amber-100 rounded-xl text-sm text-amber-800">
                <Info size={15} className="shrink-0 mt-0.5 text-amber-500" />
                <span>
                  <strong>{t('baseline_seasonality_may_be_understated_for_this_aggre')}</strong>{' '}
                  {activeShortLeafWarning.shortLeaves} of {activeShortLeafWarning.totalLeaves} constituent cohorts
                  ({(activeShortLeafWarning.share * 100).toFixed(0)}%) have fewer than 24 months of history, so they
                  cannot fit a seasonal pattern. This aggregate is the sum of its cohorts, so its seasonal peaks and
                  troughs may be flatter than the underlying business. Totals still reconcile exactly to the
                  constituent cohorts.
                </span>
              </div>
            )}

            {/* Holt-Winters seasonal fallback warning */}
            {baseForecast?.seasonalFallback && (
              <div className="flex items-start gap-3 px-4 py-3 bg-amber-50 border border-amber-100 rounded-xl text-sm text-amber-800">
                <Info size={15} className="shrink-0 mt-0.5 text-amber-500" />
                <span>
                  <strong>{t('baseline_holt_winters_requires_at_least_24_months_of_d')}</strong> {t('baseline_two_full_seasonal_cycles_one_or_more_series_f')}
                </span>
              </div>
            )}

            {/* Fitted Model Parameters — technical diagnostic, hidden by default (Phase 3 P8) */}
            {baseForecast && provenanceParams(baseForecast.provenance) && (
              <div className="bg-white rounded-2xl shadow-sm border border-slate-200">
                <button
                  type="button"
                  onClick={() => setShowTechnicalDetails(v => !v)}
                  className="w-full flex items-center justify-between gap-2 px-6 py-4 text-left rounded-2xl hover:bg-slate-50 transition-colors"
                >
                  <span className="text-base font-semibold text-slate-900 flex items-center gap-2">
                    <SlidersHorizontal size={15} className="text-[#e60000]" />{t('baseline_fitted_model_parameters')}</span>
                  <span className="flex items-center gap-1 text-xs font-medium text-slate-500">
                    {showTechnicalDetails ? t('baseline_hide_technical_details') : t('baseline_show_technical_details')}
                    <ChevronDown size={14} className={`text-slate-400 transition-transform ${showTechnicalDetails ? 'rotate-180' : ''}`} />
                  </span>
                </button>
              {showTechnicalDetails && (
              <div className="px-6 pb-6">
                <p className="text-[11px] text-slate-400 mb-4">{t('baseline_parameters_chosen_independently_per_series_by')}</p>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-slate-100">
                        <th className="text-left pb-2 pr-6 text-slate-500 font-semibold uppercase tracking-wide">{t('baseline_series')}</th>
                        <th className="text-center pb-2 px-4 text-slate-500 font-semibold uppercase tracking-wide">{t('baseline_level')}</th>
                        <th className="text-center pb-2 px-4 text-slate-500 font-semibold uppercase tracking-wide">{t('baseline_trend')}</th>
                        {sftModel === 'Damped Trend' && (
                          <th className="text-center pb-2 px-4 text-slate-500 font-semibold uppercase tracking-wide">{t('baseline_damping')}</th>
                        )}
                        {sftModel === 'Holt-Winters' && (
                          <th className="text-center pb-2 px-4 text-slate-500 font-semibold uppercase tracking-wide">{t('baseline_seasonal')}</th>
                        )}
                        <th className="text-right pb-2 px-4 text-slate-500 font-semibold uppercase tracking-wide">{t('baseline_in_sample_mse')}</th>
                        <th className="text-right pb-2 pl-4 text-slate-500 font-semibold uppercase tracking-wide">
                          {sftModel === 'Holt-Winters' ? t('baseline_relative') : t('baseline_residual_sd')}
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {(['inflow', 'outflow', 'retention', 'arpu'] as const).map(series => {
                        const p = provenanceParams(baseForecast.provenance)![series];
                        return (
                          <tr key={series}>
                            <td className="py-2 pr-6 font-medium text-slate-700 capitalize">{series}</td>
                            <td className="py-2 px-4 text-center font-mono text-slate-800">{p.alpha.toFixed(2)}</td>
                            <td className="py-2 px-4 text-center font-mono text-slate-800">
                              {sftModel === 'Simple Exponential Smoothing' ? '—' : p.beta.toFixed(2)}
                            </td>
                            {sftModel === 'Damped Trend' && (
                              <td className="py-2 px-4 text-center font-mono text-slate-800">{(p.phi ?? 0.85).toFixed(2)}</td>
                            )}
                            {sftModel === 'Holt-Winters' && (
                              <td className="py-2 px-4 text-center font-mono text-slate-800">{(p.gamma ?? 0.1).toFixed(2)}</td>
                            )}
                            <td className="py-2 px-4 text-right font-mono text-slate-500">
                              {p.mse > 0 ? p.mse.toLocaleString(t('baseline_en_us'), { maximumFractionDigits: 0 }) : '—'}
                            </td>
                            <td className="py-2 pl-4 text-right font-mono text-slate-500">
                              {sftModel === 'Holt-Winters'
                                ? (p.sigma > 0 ? `${(p.sigma * 100).toFixed(1)}%` : '—')
                                : (p.sigma > 0 ? p.sigma.toLocaleString(t('baseline_en_us'), { maximumFractionDigits: 1 }) : '—')
                              }
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
              )}
              </div>
            )}

            {/* Data Preview Table */}
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 overflow-hidden flex flex-col">
              <h3 className="text-lg font-semibold text-slate-900 mb-4">
                {stdChartView === 'value' ? t('baseline_arpu_data_preview') : t('baseline_data_preview')}
              </h3>
              <div className="overflow-x-auto rounded-xl border border-slate-200 max-h-[400px]">
                <table className="w-full text-sm text-left relative">
                  <thead className="text-xs text-slate-500 uppercase bg-slate-50 border-b border-slate-200 sticky top-0 z-10">
                    <tr>
                      <th className="px-6 py-4 font-semibold">{t('baseline_date')}</th>
                      {stdChartView === 'value' ? (
                        <>
                          <th className="px-6 py-4 font-semibold">{t('common_historical_arpu')}</th>
                          <th className="px-6 py-4 font-semibold">{t('baseline_mean_base')}</th>
                          <th className="px-6 py-4 font-semibold">{t('baseline_optimistic')}</th>
                          <th className="px-6 py-4 font-semibold">{t('baseline_pessimistic')}</th>
                        </>
                      ) : compareCategories.length > 0 ? (
                        compareCategories.map(cat => (
                          <React.Fragment key={cat}>
                            <th className="px-6 py-4 font-semibold">{cat} (Historical)</th>
                            <th className="px-6 py-4 font-semibold">{cat} (Forecast)</th>
                          </React.Fragment>
                        ))
                      ) : (
                        <>
                          <th className="px-6 py-4 font-semibold">{t('baseline_historical')}</th>
                          <th className="px-6 py-4 font-semibold">{t('baseline_mean_base')}</th>
                          <th className="px-6 py-4 font-semibold">{t('baseline_optimistic')}</th>
                          <th className="px-6 py-4 font-semibold">{t('baseline_pessimistic')}</th>
                        </>
                      )}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {(stdChartView === 'value' ? arpuChartData : stdChartData).map((row, idx) => (
                      <tr key={idx} className="hover:bg-slate-50 transition-colors">
                        <td className="px-6 py-4 font-medium text-slate-900">{row.date}</td>
                        {stdChartView === 'value' ? (
                          <>
                            <td className="px-6 py-4 text-slate-600">{row['Historical'] != null ? formatNumber(row['Historical']) : '—'}</td>
                            <td className="px-6 py-4 text-slate-600">{row['Mean (Base)'] != null ? formatNumber(row['Mean (Base)']) : '—'}</td>
                            <td className="px-6 py-4 text-emerald-600">{row['Optimistic'] != null ? formatNumber(row['Optimistic']) : '—'}</td>
                            <td className="px-6 py-4 text-rose-600">{row['Pessimistic'] != null ? formatNumber(row['Pessimistic']) : '—'}</td>
                          </>
                        ) : compareCategories.length > 0 ? (
                          compareCategories.map(cat => (
                            <React.Fragment key={cat}>
                              <td className="px-6 py-4 text-slate-600">{formatNumber(row[`${cat} (Historical)`])}</td>
                              <td className="px-6 py-4 text-slate-600">{formatNumber(row[`${cat} (Forecast)`])}</td>
                            </React.Fragment>
                          ))
                        ) : (
                          <>
                            <td className="px-6 py-4 text-slate-600">{formatNumber(row['Historical'])}</td>
                            <td className="px-6 py-4 text-slate-600">{formatNumber(row['Mean (Base)'])}</td>
                            <td className="px-6 py-4 text-emerald-600">{formatNumber(row['Optimistic'])}</td>
                            <td className="px-6 py-4 text-rose-600">{formatNumber(row['Pessimistic'])}</td>
                          </>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
            </div>
          </div>
        ) : (
          <div className="flex-1 flex items-center justify-center py-24">
            <div className="text-center max-w-sm">
              <div className="w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center mx-auto mb-4">
                <Info size={26} className="text-slate-400" />
              </div>
              {data.length === 0 ? (
                <>
                  <h3 className="text-lg font-semibold text-slate-800 mb-2">{t('baseline_upload_data_first')}</h3>
                  <p className="text-sm text-slate-500 mb-4">{t('baseline_go_to_the_home_page_and_upload_an_ibro_excel')}</p>
                  <button
                    onClick={() => setActiveView('home')}
                    className="px-5 py-2.5 bg-[#e60000] text-white rounded-lg text-sm font-semibold hover:bg-[#cc0000] transition-colors"
                  >{t('baseline_go_to_home')}</button>
                </>
              ) : emptyCohortSelection ? (
                <>
                  <h3 className="text-lg font-semibold text-slate-800 mb-2">{t('baseline_no_data_for_this_selection')}</h3>
                  <p className="text-sm text-slate-500 mb-1">{t('baseline_the_current_cohort_filters_return_no_rows_in')}</p>
                  <p className="text-xs text-slate-400 mt-2">{t('baseline_adjust_the_dimension_filters_often_the_l2_or')}</p>
                </>
              ) : (notice || aggregateState.kind === 'covered'
                    || aggregateState.kind === 'blocked'
                    || aggregateState.kind === 'never') ? (
                /* A notice has just explained why there is nothing to show.
                   "Ready to forecast" underneath it reads as though nothing
                   had been tried, which contradicts the sentence directly
                   above - the notice IS the explanation, so the invitation
                   stands down rather than arguing with it. */
                <>
                  <h3 className="text-lg font-semibold text-slate-800 mb-2">{t('baseline_nothing_to_display')}</h3>
                  <p className="text-sm text-slate-500">{notice
                    ? t('baseline_see_the_note_above')
                    : t('baseline_see_the_button_above')}</p>
                </>
              ) : (
                <>
                  <h3 className="text-lg font-semibold text-slate-800 mb-2">{t('baseline_ready_to_forecast')}</h3>
                  <p className="text-sm text-slate-500 mb-1">{t('baseline_configure_the_data_mapping_and_dimension_filt')}</p>
                  <p className="text-sm font-semibold text-[#e60000] mb-4">{t('common_generate_forecast')}</p>
                  <p className="text-xs text-slate-400">{t('baseline_the_forecast_will_appear_here_once_generated')}</p>
                </>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Data Mapping Drawer */}
      <DataMappingDrawer
        isOpen={showDataMappingDrawer}
        onClose={() => setShowDataMappingDrawer(false)}
        columns={columns}
        data={data}
        wiDateCol={wiDateCol} setWiDateCol={setWiDateCol}
        wiMetricCol={wiMetricCol} setWiMetricCol={setWiMetricCol}
        wiValueCol={wiValueCol} setWiValueCol={setWiValueCol}
        wiArpuCol={wiArpuCol} setWiArpuCol={setWiArpuCol}
        wiRevenueCol={wiRevenueCol} setWiRevenueCol={setWiRevenueCol}
        wiInflowVal={wiInflowVal} setWiInflowVal={setWiInflowVal}
        wiOutflowVal={wiOutflowVal} setWiOutflowVal={setWiOutflowVal}
        wiBaseVal={wiBaseVal} setWiBaseVal={setWiBaseVal}
        wiRetentionVal={wiRetentionVal} setWiRetentionVal={setWiRetentionVal}
        wiSegmentCol={wiSegmentCol} setWiSegmentCol={setWiSegmentCol}
        wiProductCol={wiProductCol} setWiProductCol={setWiProductCol}
        wiProductL2Col={wiProductL2Col} setWiProductL2Col={setWiProductL2Col}
        wiChannelCol={wiChannelCol} setWiChannelCol={setWiChannelCol}
        wiChannelL2Col={wiChannelL2Col} setWiChannelL2Col={setWiChannelL2Col}
      />
    </>
  );
};

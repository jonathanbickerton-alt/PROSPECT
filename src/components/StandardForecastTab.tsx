import React, { useState, useMemo } from 'react';
import { useForecast } from '../context/ForecastContext';
import { Settings, Filter, Info, Download, LayersIcon, Database, CheckCircle2, AlertCircle, SlidersHorizontal, X, ChevronDown } from 'lucide-react';
import type { ForecastModel } from '../types/forecast';
import { analyzeAndRecommendModel, analyzeAndRecommendConfidence } from '../utils/forecasting';
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
  setSegmentMode: (val: string) => void;
  productMode: string;
  setProductMode: (val: string) => void;
  channelMode: string;
  setChannelMode: (val: string) => void;
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
  setActiveView: (view: string) => void;
  COLORS: string[];
  onOpenManageBulk: () => void;
  /** Ordered history of manual generations — newest first, max 10 entries, one entry per run (not per cohort) */
  cohortGenLog: Array<{ cohortId: string; timestamp: string; modelUsed: ForecastModel }>;
  onSelectCohort: (cohortId: string) => void;
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
}) => {
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

    return { actualValues, calStartMonth };
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

  const modelRecommendation = useMemo(() => {
    if (!actualValuesDetail) return null;
    return analyzeAndRecommendModel(actualValuesDetail.actualValues, actualValuesDetail.calStartMonth);
  }, [actualValuesDetail]);

  const confidenceRecommendation = useMemo(() => {
    if (!actualValuesDetail) return null;
    return analyzeAndRecommendConfidence(actualValuesDetail.actualValues, actualValuesDetail.calStartMonth);
  }, [actualValuesDetail]);


  const mappingComplete = !!(wiDateCol && wiMetricCol && wiValueCol && wiInflowVal && wiOutflowVal);

  // ARPU chart data — historical from raw data + forecast bands from baseForecast
  const arpuChartData = useMemo(() => {
    if (!baseForecast) return [];
    const histSet = new Set(baseForecast.historicalMonths);

    // Accumulate historical ARPU from raw data rows matching the current cohort selection
    const histMap = new Map<string, { revSum: number; volSum: number; arpuVol: number }>();
    for (const row of data) {
      const rowSeg  = wiSegmentCol  ? String(row[wiSegmentCol]  ?? '') : '';
      const rowProd = wiProductCol  ? String(row[wiProductCol]  ?? '') : '';
      const rowChan = wiChannelCol  ? String(row[wiChannelCol]  ?? '') : '';
      const segOk  = !wiSegmentCol  || segmentValue === 'All (Aggregated)' || rowSeg  === segmentValue;
      const prodOk = !wiProductCol  || productValue === 'All (Aggregated)' || rowProd === productValue;
      const chanOk = !wiChannelCol  || channelValue === 'All (Aggregated)' || rowChan === channelValue;
      if (!segOk || !prodOk || !chanOk) continue;
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
        Optimistic: m.arpu.optimistic,
        Pessimistic: Math.max(0, m.arpu.pessimistic),
      });
    }
    return rows.sort((a, b) => (a.date as string).localeCompare(b.date as string));
  }, [baseForecast, data, wiDateCol, wiValueCol, wiArpuCol, wiRevenueCol, wiSegmentCol, wiProductCol, wiChannelCol, segmentValue, productValue, channelValue]);

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

  // Legend label for the forecast mean line — includes the model name once a
  // forecast has been generated, so the chart self-documents which model was used.
  const meanBaseLabel = baseForecast?.modelUsed
    ? `Mean (Base) — ${baseForecast.modelUsed}`
    : 'Mean (Base)';
  console.log('[StandardForecastTab] meanBaseLabel at render:', meanBaseLabel);

  return (
    <>
      <div className="w-80 bg-white border-r border-slate-200 flex flex-col shadow-sm z-10 overflow-y-auto p-6 space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-900">Standard Forecast</h2>
          <button
            onClick={onOpenManageBulk}
            title="Manage Bulk Generations"
            className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold text-slate-600 bg-slate-50 hover:bg-slate-100 rounded-lg transition-colors border border-slate-200"
          >
            <LayersIcon size={13} />
            Manage
          </button>
        </div>
        
        {data.length === 0 ? (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-800 space-y-2">
            <p className="font-semibold">No data loaded</p>
            <p className="text-xs">Upload an IBRO data file from the Home page to get started.</p>
            <button
              onClick={() => setActiveView('home')}
              className="mt-1 text-xs font-semibold text-amber-900 underline underline-offset-2"
            >
              Go to Home →
            </button>
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
                  <Database size={15} className="text-slate-500" />
                  Data Mapping &amp; Segmentation
                </span>
                {mappingComplete
                  ? <CheckCircle2 size={15} className="text-emerald-500 shrink-0" />
                  : <AlertCircle size={15} className="text-amber-400 shrink-0" />}
              </button>
              {!mappingComplete && (
                <p className="text-[11px] text-amber-600 mt-1.5 px-1">
                  Complete column mapping to enable forecasting
                </p>
              )}
            </div>

            {/* ── Segmentation filters ── */}
            {(wiSegmentCol || wiProductCol || wiChannelCol || wiTariffL1Col) && (
              <div className="space-y-4 pt-2 border-t border-slate-100">
                <h3 className="text-sm font-semibold uppercase tracking-wider text-slate-500 flex items-center gap-2">
                  <Filter size={16} /> Filters
                </h3>
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg space-y-3">
                  {wiSegmentCol && (
                    <div className="space-y-1.5">
                      <label className="block text-xs font-medium text-slate-700">Segment</label>
                      <select value={segmentValue} onChange={(e) => setSegmentValue(e.target.value)} className="w-full text-sm border border-slate-200 rounded-lg p-2 bg-white outline-none">
                        <option value="">-- Select --</option>
                        <option value="All (Aggregated)">All (Aggregated)</option>
                        {Array.from(new Set(data.map(r => String(r[wiSegmentCol])).filter(v => v && v !== 'undefined'))).sort().map(v => (
                          <option key={v} value={v}>{v}</option>
                        ))}
                      </select>
                    </div>
                  )}

                  {wiProductCol && (
                    <div className="space-y-1.5">
                      <label className="block text-xs font-medium text-slate-700">Product</label>
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
                          <option value="">-- Select --</option>
                          <option value="All (Aggregated)">All (Aggregated)</option>
                          {Array.from(new Set(data.map(r => String(r[wiProductCol])).filter(v => v && v !== 'undefined'))).sort().map(v => (
                            <option key={v} value={v}>{v}</option>
                          ))}
                        </select>
                      )}
                    </div>
                  )}

                  {wiChannelCol && (
                    <div className="space-y-1.5">
                      <label className="block text-xs font-medium text-slate-700">Channel</label>
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
                          <option value="">-- Select --</option>
                          <option value="All (Aggregated)">All (Aggregated)</option>
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
                      <label className="block text-xs font-medium text-slate-700">Tariff</label>
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
                          <option value="">-- Select --</option>
                          <option value="All (Aggregated)">All (Aggregated)</option>
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
                <Settings size={16} /> Scenario Tweaks
              </h3>
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
                <label className="block text-xs font-semibold text-slate-900 mb-2">Forecast Model</label>

                {/* Model Recommendation Panel */}
                {modelRecommendation && (
                  <div className="mb-4">
                    {!isDismissed ? (
                      <div className="p-3 bg-indigo-50/50 border border-indigo-100 rounded-xl space-y-2 relative">
                        <button
                          type="button"
                          onClick={() => setDismissedCohortKey(currentCohortKey)}
                          className="absolute top-2 right-2 p-1 text-slate-400 hover:text-slate-600 rounded transition-colors"
                          title="Ignore Recommendation"
                        >
                          <X size={14} />
                        </button>
                        <div className="flex items-center justify-between pr-4">
                          <span className="text-[10px] font-extrabold uppercase tracking-widest text-indigo-600">Model Advisor</span>
                          <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${
                            modelRecommendation.confidence === 'High' ? 'bg-emerald-100 text-emerald-800' :
                            modelRecommendation.confidence === 'Medium' ? 'bg-amber-100 text-amber-800' :
                            'bg-slate-100 text-slate-600'
                          }`}>
                            {modelRecommendation.confidence} Confidence
                          </span>
                        </div>
                        
                        <div className="text-xs text-slate-700">
                          <span className="font-semibold text-slate-900">Recommended: </span>
                          <span className="font-bold text-indigo-700">{modelRecommendation.recommendedModel}</span>
                        </div>
                        
                        <p className="text-[11px] leading-relaxed text-slate-650">{modelRecommendation.reason}</p>

                        {/* Advisor parameters breakdown */}
                        <div className="grid grid-cols-2 gap-x-2 gap-y-1 pt-2 border-t border-indigo-100/80 text-[10px]">
                          <div>
                            <span className="text-slate-400">Trend: </span>
                            <span className="font-semibold text-slate-700">{modelRecommendation.metrics.trendStrengthLabel}</span>
                          </div>
                          <div>
                            <span className="text-slate-400">Seasonality: </span>
                            <span className="font-semibold text-slate-700">
                              {modelRecommendation.metrics.seasonalityLabel === 'Recurring monthly peaks' ? 'Recurring' : 'None'}
                            </span>
                          </div>
                          <div>
                            <span className="text-slate-400">Volatility: </span>
                            <span className="font-semibold text-slate-700">{modelRecommendation.metrics.volatilityLabel}</span>
                          </div>
                          <div>
                            <span className="text-slate-400">Best error: </span>
                            <span className="font-semibold text-slate-700">
                              {modelRecommendation.metrics.bestModelByFit === 'Simple Exponential Smoothing' ? 'SES' :
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
                            >
                              Apply Recommended Model
                            </button>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="flex justify-end">
                        <button
                          type="button"
                          onClick={() => setDismissedCohortKey(null)}
                          className="text-[10px] text-slate-500 hover:text-slate-700 font-semibold underline"
                        >
                          Show Model Recommendation
                        </button>
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
                        {m === 'Simple Exponential Smoothing' && 'Level smoothing — α optimised per series'}
                        {m === 'Holt Linear' && 'Level + trend smoothing — α, β optimised per series'}
                        {m === 'Damped Trend' && 'Trend damped toward flat — α, β, φ optimised per series'}
                        {m === 'Holt-Winters' && 'Triple exponential smoothing, multiplicative seasonality — α, β, γ optimised per series'}
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Confidence Settings Recommendation Panel */}
              {confidenceRecommendation && (
                <div className="mb-4">
                  {!isConfidenceDismissed ? (
                    <div className="p-3 bg-violet-50/50 border border-violet-100 rounded-xl space-y-2 relative">
                      <button
                        type="button"
                        onClick={() => setDismissedConfidenceCohortKey(currentCohortKey)}
                        className="absolute top-2 right-2 p-1 text-slate-400 hover:text-slate-600 rounded transition-colors"
                        title="Ignore Recommendation"
                      >
                        <X size={14} />
                      </button>
                      <div className="flex items-center justify-between pr-4">
                        <span className="text-[10px] font-extrabold uppercase tracking-widest text-violet-600">Confidence Advisor</span>
                        <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${
                          confidenceRecommendation.strength === 'High' ? 'bg-emerald-100 text-emerald-800' :
                          confidenceRecommendation.strength === 'Medium' ? 'bg-amber-100 text-amber-800' :
                          'bg-slate-100 text-slate-600'
                        }`}>
                          {confidenceRecommendation.strength} Confidence
                        </span>
                      </div>
                      
                      <div className="text-xs text-slate-700 font-medium">
                        <span>Recommended Profile: </span>
                        <span className="font-bold text-violet-700">{confidenceRecommendation.profile}</span>
                      </div>
                      
                      <p className="text-[11px] leading-relaxed text-slate-600">{confidenceRecommendation.reason}</p>

                      {/* Display suggested settings values */}
                      <div className="bg-white/80 p-2 rounded-lg border border-violet-100 text-[10px] text-slate-700 space-y-1">
                        <div className="font-bold text-slate-500 uppercase tracking-widest text-[9px] mb-0.5">Suggested values:</div>
                        <div className="flex justify-between items-center">
                          <span>Pre-Horizon z-score:</span>
                          <span className="font-mono font-bold text-slate-900">{confidenceRecommendation.preHorizonZ.toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span>Post-Horizon Band Multiplier:</span>
                          <span className="font-mono font-bold text-slate-900">{confidenceRecommendation.postHorizonMultiplier.toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span>Confidence Horizon (Months):</span>
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
                          >
                            Apply Recommended Settings
                          </button>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="flex justify-end">
                      <button
                        type="button"
                        onClick={() => setDismissedConfidenceCohortKey(null)}
                        className="text-[10px] text-slate-500 hover:text-slate-700 font-semibold underline"
                      >
                        Show Confidence Recommendation
                      </button>
                    </div>
                  )}
                </div>
              )}

              <div>
                <div className="flex justify-between mb-1">
                  <div className="flex items-center gap-1">
                    <label className="text-xs font-medium text-slate-700">Pre-Horizon z-score</label>
                    <span className="relative group cursor-help text-slate-400 hover:text-slate-600 transition-colors">
                      <Info size={11} />
                      <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 w-48 text-[10px] text-white bg-slate-700 rounded px-2 py-1 hidden group-hover:block z-50 leading-snug">Controls how wide the optimistic and pessimistic forecast range is before the confidence horizon. Higher values create a wider range.</span>
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
                    <label className="text-xs font-medium text-slate-700">Post-Horizon Band Multiplier</label>
                    <span className="relative group cursor-help text-slate-400 hover:text-slate-600 transition-colors">
                      <Info size={11} />
                      <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 w-48 text-[10px] text-white bg-slate-700 rounded px-2 py-1 hidden group-hover:block z-50 leading-snug">Controls how much wider the forecast range becomes after the confidence horizon. Higher values show more uncertainty further into the future.</span>
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
                    <label className="text-xs font-medium text-slate-700">Confidence Horizon (Months)</label>
                    <span className="relative group cursor-help text-slate-400 hover:text-slate-600 transition-colors">
                      <Info size={11} />
                      <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 w-48 text-[10px] text-white bg-slate-700 rounded px-2 py-1 hidden group-hover:block z-50 leading-snug">Controls how many forecast months use the initial forecast range before the post-horizon multiplier is applied.</span>
                    </span>
                  </div>
                  <span className="text-xs font-semibold text-slate-600">{confidenceHorizon}</span>
                </div>
                <input type="range" min="0" max="6" value={confidenceHorizon} onChange={(e) => setConfidenceHorizon(Number(e.target.value))} className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-blue-500" />
              </div>
            </div>

            <button onClick={generateStandardForecast} className="w-full bg-[#e60000] hover:bg-[#cc0000] text-white font-medium py-2.5 px-4 rounded-lg transition-colors shadow-sm mt-4">
              Generate Forecast
            </button>
          </>
        )}
      </div>

      <div className="flex-1 overflow-y-auto p-8">
        {error && <div className="mb-6 bg-red-50 text-red-700 p-4 rounded-xl border border-red-100 text-sm flex items-start gap-3"><Info className="shrink-0 mt-0.5" size={18} /><p>{error}</p></div>}
        
        {forecastData.length > 0 ? (
          <div className="flex gap-4 items-start">

            {/* Manual-generations side panel */}
            {manualCohortEntries.length > 0 && (
              <div className="w-48 shrink-0 bg-white rounded-2xl shadow-sm border border-slate-200 flex flex-col self-start" style={{ maxHeight: 520 }}>
                <div className="px-3 py-2.5 border-b border-slate-100 flex items-center justify-between">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Generated</span>
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
                  {compareCategories.length > 0 ? 'Forecast Results (Comparison)' : 'Forecast Results'}
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
                            {v === 'volume' ? 'Volume' : 'Value (ARPU)'}
                          </button>
                        ))}
                      </div>
                    )}
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] uppercase font-bold text-slate-400">Window Size</span>
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
                      <Download size={16} /> Export to Excel
                    </button>
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
                  <strong>Missing months detected in historical data.</strong>{' '}
                  The following {baseForecast.missingMonths.length === 1 ? 'month is' : 'months are'} absent from this cohort's history:{' '}
                  <span className="font-mono">{baseForecast.missingMonths.join(', ')}</span>.
                  {' '}Gaps can bias level and trend initialisation — the forecast may be unreliable.
                </span>
              </div>
            )}

            {/* Holt-Winters seasonal fallback warning */}
            {baseForecast?.seasonalFallback && (
              <div className="flex items-start gap-3 px-4 py-3 bg-amber-50 border border-amber-100 rounded-xl text-sm text-amber-800">
                <Info size={15} className="shrink-0 mt-0.5 text-amber-500" />
                <span>
                  <strong>Holt-Winters requires at least 24 months of data</strong> (two full seasonal cycles).
                  One or more series for this cohort had fewer data points and fell back to Holt Linear automatically.
                  The fitted parameters below reflect the Holt Linear model used for those series.
                </span>
              </div>
            )}

            {/* Fitted Model Parameters — technical diagnostic, hidden by default (Phase 3 P8) */}
            {baseForecast?.fittedParams && (
              <div className="bg-white rounded-2xl shadow-sm border border-slate-200">
                <button
                  type="button"
                  onClick={() => setShowTechnicalDetails(v => !v)}
                  className="w-full flex items-center justify-between gap-2 px-6 py-4 text-left rounded-2xl hover:bg-slate-50 transition-colors"
                >
                  <span className="text-base font-semibold text-slate-900 flex items-center gap-2">
                    <SlidersHorizontal size={15} className="text-[#e60000]" />
                    Fitted Model Parameters
                  </span>
                  <span className="flex items-center gap-1 text-xs font-medium text-slate-500">
                    {showTechnicalDetails ? 'Hide technical details' : 'Show technical details'}
                    <ChevronDown size={14} className={`text-slate-400 transition-transform ${showTechnicalDetails ? 'rotate-180' : ''}`} />
                  </span>
                </button>
              {showTechnicalDetails && (
              <div className="px-6 pb-6">
                <p className="text-[11px] text-slate-400 mb-4">
                  Parameters chosen independently per series by MSE grid search on in-sample one-step-ahead fitted values.
                  For Holt-Winters, σ is the relative residual SD used for proportional bands; for other models it is the absolute residual SD.
                </p>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-slate-100">
                        <th className="text-left pb-2 pr-6 text-slate-500 font-semibold uppercase tracking-wide">Series</th>
                        <th className="text-center pb-2 px-4 text-slate-500 font-semibold uppercase tracking-wide">α (level)</th>
                        <th className="text-center pb-2 px-4 text-slate-500 font-semibold uppercase tracking-wide">β (trend)</th>
                        {baseForecast.modelUsed === 'Damped Trend' && (
                          <th className="text-center pb-2 px-4 text-slate-500 font-semibold uppercase tracking-wide">φ (damping)</th>
                        )}
                        {baseForecast.modelUsed === 'Holt-Winters' && (
                          <th className="text-center pb-2 px-4 text-slate-500 font-semibold uppercase tracking-wide">γ (seasonal)</th>
                        )}
                        <th className="text-right pb-2 px-4 text-slate-500 font-semibold uppercase tracking-wide">In-sample MSE</th>
                        <th className="text-right pb-2 pl-4 text-slate-500 font-semibold uppercase tracking-wide">
                          {baseForecast.modelUsed === 'Holt-Winters' ? 'σ (relative)' : 'σ (residual SD)'}
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {(['inflow', 'outflow', 'retention', 'arpu'] as const).map(series => {
                        const p = baseForecast.fittedParams![series];
                        return (
                          <tr key={series}>
                            <td className="py-2 pr-6 font-medium text-slate-700 capitalize">{series}</td>
                            <td className="py-2 px-4 text-center font-mono text-slate-800">{p.alpha.toFixed(2)}</td>
                            <td className="py-2 px-4 text-center font-mono text-slate-800">
                              {baseForecast.modelUsed === 'Simple Exponential Smoothing' ? '—' : p.beta.toFixed(2)}
                            </td>
                            {baseForecast.modelUsed === 'Damped Trend' && (
                              <td className="py-2 px-4 text-center font-mono text-slate-800">{(p.phi ?? 0.85).toFixed(2)}</td>
                            )}
                            {baseForecast.modelUsed === 'Holt-Winters' && (
                              <td className="py-2 px-4 text-center font-mono text-slate-800">{(p.gamma ?? 0.1).toFixed(2)}</td>
                            )}
                            <td className="py-2 px-4 text-right font-mono text-slate-500">
                              {p.mse > 0 ? p.mse.toLocaleString('en-US', { maximumFractionDigits: 0 }) : '—'}
                            </td>
                            <td className="py-2 pl-4 text-right font-mono text-slate-500">
                              {baseForecast.modelUsed === 'Holt-Winters'
                                ? (p.sigma > 0 ? `${(p.sigma * 100).toFixed(1)}%` : '—')
                                : (p.sigma > 0 ? p.sigma.toLocaleString('en-US', { maximumFractionDigits: 1 }) : '—')
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
                {stdChartView === 'value' ? 'ARPU Data Preview' : 'Data Preview'}
              </h3>
              <div className="overflow-x-auto rounded-xl border border-slate-200 max-h-[400px]">
                <table className="w-full text-sm text-left relative">
                  <thead className="text-xs text-slate-500 uppercase bg-slate-50 border-b border-slate-200 sticky top-0 z-10">
                    <tr>
                      <th className="px-6 py-4 font-semibold">Date</th>
                      {stdChartView === 'value' ? (
                        <>
                          <th className="px-6 py-4 font-semibold">Historical ARPU</th>
                          <th className="px-6 py-4 font-semibold">Mean (Base)</th>
                          <th className="px-6 py-4 font-semibold">Optimistic</th>
                          <th className="px-6 py-4 font-semibold">Pessimistic</th>
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
                          <th className="px-6 py-4 font-semibold">Historical</th>
                          <th className="px-6 py-4 font-semibold">Mean (Base)</th>
                          <th className="px-6 py-4 font-semibold">Optimistic</th>
                          <th className="px-6 py-4 font-semibold">Pessimistic</th>
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
                  <h3 className="text-lg font-semibold text-slate-800 mb-2">Upload data first</h3>
                  <p className="text-sm text-slate-500 mb-4">
                    Go to the Home page and upload an IBRO Excel file to begin forecasting.
                  </p>
                  <button
                    onClick={() => setActiveView('home')}
                    className="px-5 py-2.5 bg-[#e60000] text-white rounded-lg text-sm font-semibold hover:bg-[#cc0000] transition-colors"
                  >
                    Go to Home
                  </button>
                </>
              ) : (
                <>
                  <h3 className="text-lg font-semibold text-slate-800 mb-2">Ready to forecast</h3>
                  <p className="text-sm text-slate-500 mb-1">
                    Configure the data mapping and dimension filters in the panel on the left, then click
                  </p>
                  <p className="text-sm font-semibold text-[#e60000] mb-4">Generate Forecast</p>
                  <p className="text-xs text-slate-400">
                    The forecast will appear here once generated. Save it to unlock Step 2.
                  </p>
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

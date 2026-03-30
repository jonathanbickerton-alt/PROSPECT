import React, { useState, useMemo } from 'react';
import { useForecast } from '../context/ForecastContext';
import { Settings, ChevronUp, ChevronDown, Filter, Info, Download, LayersIcon, SlidersHorizontal } from 'lucide-react';
import type { ForecastModel } from '../types/forecast';
import { ResponsiveContainer, LineChart, CartesianGrid, XAxis, YAxis, Tooltip, Legend, Line, Brush } from 'recharts';
import { format, parse, isValid } from 'date-fns';

interface StandardForecastTabProps {
  data: any[];
  columns: string[];
  wiDateCol: string;
  setWiDateCol: (val: string) => void;
  wiMetricCol: string;
  setWiMetricCol: (val: string) => void;
  wiValueCol: string;
  setWiValueCol: (val: string) => void;
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
  wiChannelCol: string;
  setWiChannelCol: (val: string) => void;
  segmentValue: string;
  setSegmentValue: (val: string) => void;
  productValue: string;
  setProductValue: (val: string) => void;
  channelValue: string;
  setChannelValue: (val: string) => void;
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
  wiInflowVal, setWiInflowVal,
  wiOutflowVal, setWiOutflowVal,
  wiBaseVal, setWiBaseVal,
  wiRetentionVal, setWiRetentionVal,
  wiSegmentCol, setWiSegmentCol,
  wiProductCol, setWiProductCol,
  wiChannelCol, setWiChannelCol,
  segmentValue, setSegmentValue,
  productValue, setProductValue,
  channelValue, setChannelValue,
  segmentMode, setSegmentMode,
  productMode, setProductMode,
  channelMode, setChannelMode,
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
  const [showMappingMenu, setShowMappingMenu] = useState(true);
  const { baseForecast, bulkRuns } = useForecast();

  // --- Manual-generation side panel helpers ---

  function abbrevModel(model: ForecastModel): string {
    if (model === 'Holt Linear') return 'HL';
    if (model === 'Damped Trend') return 'DT';
    if (model === 'Holt-Winters') return 'HW';
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
        const parts = e.cohortId.split('|');
        return { cohortId: e.cohortId, segment: parts[0] || 'All', product: parts[1] || 'All', channel: parts[2] || 'All', scenario: parts[4] || '', timestamp: e.timestamp, modelUsed: e.modelUsed };
      });
  }, [cohortGenLog, allBulkIds]);

  const activeCohortId = `${segmentValue === 'All (Aggregated)' ? 'All' : segmentValue}|${productValue === 'All (Aggregated)' ? 'All' : productValue}|${channelValue === 'All (Aggregated)' ? 'All' : channelValue}|Standard Forecast|${stdScenario}`;

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
            className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 rounded-lg transition-colors border border-indigo-100"
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
            <div className="space-y-4">
              <button 
                onClick={() => setShowMappingMenu(!showMappingMenu)}
                className="w-full flex items-center justify-between text-sm font-semibold uppercase tracking-wider text-slate-500 hover:text-slate-700 transition-colors bg-slate-50 p-3 rounded-lg border border-slate-200"
              >
                <span className="flex items-center gap-2"><Settings size={16} /> Data Mapping & Metrics</span>
                {showMappingMenu ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
              </button>
              
              {showMappingMenu && (
                <div className="space-y-4 pt-2 border-t border-slate-100">
                  <h3 className="text-sm font-semibold uppercase tracking-wider text-slate-500 flex items-center gap-2">
                    1. Data Mapping
                  </h3>
                  <div>
                    <label className="block text-xs font-semibold text-slate-900 mb-1">Date Column</label>
                    <select value={wiDateCol} onChange={(e) => setWiDateCol(e.target.value)} className="w-full text-sm border border-slate-200 rounded-lg p-2.5 bg-slate-50 outline-none">
                      {columns.map((col) => <option key={col} value={col}>{col}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-900 mb-1">Metric/Dimension Column</label>
                    <select value={wiMetricCol} onChange={(e) => setWiMetricCol(e.target.value)} className="w-full text-sm border border-slate-200 rounded-lg p-2.5 bg-slate-50 outline-none">
                      {columns.map((col) => <option key={col} value={col}>{col}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-900 mb-1">Subscriber Volume Column</label>
                    <select value={wiValueCol} onChange={(e) => setWiValueCol(e.target.value)} className="w-full text-sm border border-slate-200 rounded-lg p-2.5 bg-slate-50 outline-none">
                      {columns.map((col) => <option key={col} value={col}>{col}</option>)}
                    </select>
                  </div>
                  
                  {wiMetricCol && (
                    <div className="space-y-4 pt-4 border-t border-slate-100">
                      <h3 className="text-sm font-semibold uppercase tracking-wider text-slate-500 flex items-center gap-2">
                        2. Metric Identification
                      </h3>
                      {(() => {
                        const uniqueMetrics = Array.from(new Set(data.map(r => String(r[wiMetricCol])).filter(v => v && v !== 'undefined'))).sort();
                        return (
                          <>
                            <div>
                              <label className="block text-xs font-semibold text-slate-900 mb-1">Inflow Identifier</label>
                              <select value={wiInflowVal} onChange={(e) => setWiInflowVal(e.target.value)} className="w-full text-sm border border-slate-200 rounded-lg p-2.5 bg-slate-50 outline-none">
                                <option value="">-- Select --</option>
                                {uniqueMetrics.map(m => <option key={m} value={m}>{m}</option>)}
                              </select>
                            </div>
                            <div>
                              <label className="block text-xs font-semibold text-slate-900 mb-1">Outflow Identifier</label>
                              <select value={wiOutflowVal} onChange={(e) => setWiOutflowVal(e.target.value)} className="w-full text-sm border border-slate-200 rounded-lg p-2.5 bg-slate-50 outline-none">
                                <option value="">-- Select --</option>
                                {uniqueMetrics.map(m => <option key={m} value={m}>{m}</option>)}
                              </select>
                            </div>
                            <div>
                              <label className="block text-xs font-semibold text-slate-900 mb-1">Base Identifier</label>
                              <select value={wiBaseVal} onChange={(e) => setWiBaseVal(e.target.value)} className="w-full text-sm border border-slate-200 rounded-lg p-2.5 bg-slate-50 outline-none">
                                <option value="">-- Select --</option>
                                {uniqueMetrics.map(m => <option key={m} value={m}>{m}</option>)}
                              </select>
                            </div>
                            <div>
                              <label className="block text-xs font-semibold text-slate-900 mb-1">Retention Identifier</label>
                              <select value={wiRetentionVal} onChange={(e) => setWiRetentionVal(e.target.value)} className="w-full text-sm border border-slate-200 rounded-lg p-2.5 bg-slate-50 outline-none">
                                <option value="">-- Select --</option>
                                {uniqueMetrics.map(m => <option key={m} value={m}>{m}</option>)}
                              </select>
                            </div>
                          </>
                        );
                      })()}
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="space-y-4 pt-4 border-t border-slate-100">
              <h3 className="text-sm font-semibold uppercase tracking-wider text-slate-500 flex items-center gap-2">
                <Filter size={16} /> Segmentation (Optional)
              </h3>
              <div className="grid grid-cols-1 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-900 mb-1">Segment Column</label>
                  <select value={wiSegmentCol} onChange={(e) => { setWiSegmentCol(e.target.value); setSegmentValue(''); }} className="w-full text-sm border border-slate-200 rounded-lg p-2.5 bg-slate-50 outline-none">
                    <option value="">None</option>
                    {columns.map((col) => <option key={col} value={col}>{col}</option>)}
                  </select>
                </div>
                
                <div>
                  <label className="block text-xs font-semibold text-slate-900 mb-1">Product Column</label>
                  <select value={wiProductCol} onChange={(e) => { setWiProductCol(e.target.value); setProductValue(''); }} className="w-full text-sm border border-slate-200 rounded-lg p-2.5 bg-slate-50 outline-none">
                    <option value="">None</option>
                    {columns.map((col) => <option key={col} value={col}>{col}</option>)}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-900 mb-1">Channel Column</label>
                  <select value={wiChannelCol} onChange={(e) => { setWiChannelCol(e.target.value); setChannelValue(''); }} className="w-full text-sm border border-slate-200 rounded-lg p-2.5 bg-slate-50 outline-none">
                    <option value="">None</option>
                    {columns.map((col) => <option key={col} value={col}>{col}</option>)}
                  </select>
                </div>
              </div>
              
              {(wiSegmentCol || wiProductCol || wiChannelCol) && (
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg space-y-3">
                  {wiSegmentCol && (
                    <div className="space-y-2">
                      <label className="block text-xs font-medium text-slate-700 mb-1">Segment Mode</label>
                      <div className="flex flex-col gap-2">
                        <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
                          <input type="radio" checked={segmentMode === 'filter'} onChange={() => setSegmentMode('filter')} className="accent-[#e60000]" />
                          Filter to one category
                        </label>
                        <label className={`flex items-center gap-2 text-sm cursor-pointer ${(productMode === 'compare' || channelMode === 'compare') ? 'text-slate-400' : 'text-slate-700'}`}>
                          <input type="radio" checked={segmentMode === 'compare'} onChange={() => setSegmentMode('compare')} disabled={productMode === 'compare' || channelMode === 'compare'} className="accent-[#e60000]" />
                          Compare all categories {(productMode === 'compare' || channelMode === 'compare') && '(Disabled)'}
                        </label>
                      </div>
                      {segmentMode === 'filter' && (
                        <div>
                          <label className="block text-xs font-medium text-slate-700 mb-1">Select Segment Value</label>
                          <select value={segmentValue} onChange={(e) => setSegmentValue(e.target.value)} className="w-full text-sm border border-slate-200 rounded-lg p-2 bg-white outline-none">
                            <option value="">-- Select --</option>
                            <option value="All (Aggregated)">All (Aggregated)</option>
                            {Array.from(new Set(data.map(r => String(r[wiSegmentCol])).filter(v => v && v !== 'undefined'))).sort().map(v => (
                              <option key={v} value={v}>{v}</option>
                            ))}
                          </select>
                        </div>
                      )}
                    </div>
                  )}
                  
                  {wiProductCol && (
                    <div className="space-y-2">
                      <label className="block text-xs font-medium text-slate-700 mb-1">Product Mode</label>
                      <div className="flex flex-col gap-2">
                        <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
                          <input type="radio" checked={productMode === 'filter'} onChange={() => setProductMode('filter')} className="accent-[#e60000]" />
                          Filter to one product
                        </label>
                        <label className={`flex items-center gap-2 text-sm cursor-pointer ${(segmentMode === 'compare' || channelMode === 'compare') ? 'text-slate-400' : 'text-slate-700'}`}>
                          <input type="radio" checked={productMode === 'compare'} onChange={() => setProductMode('compare')} disabled={segmentMode === 'compare' || channelMode === 'compare'} className="accent-[#e60000]" />
                          Compare all products {(segmentMode === 'compare' || channelMode === 'compare') && '(Disabled)'}
                        </label>
                      </div>
                      {productMode === 'filter' && (
                        <div>
                          <label className="block text-xs font-medium text-slate-700 mb-1">Select Product Value</label>
                          <select value={productValue} onChange={(e) => setProductValue(e.target.value)} className="w-full text-sm border border-slate-200 rounded-lg p-2 bg-white outline-none">
                            <option value="">-- Select --</option>
                            <option value="All (Aggregated)">All (Aggregated)</option>
                            {Array.from(new Set(data.map(r => String(r[wiProductCol])).filter(v => v && v !== 'undefined'))).sort().map(v => (
                              <option key={v} value={v}>{v}</option>
                            ))}
                          </select>
                        </div>
                      )}
                    </div>
                  )}

                  {wiChannelCol && (
                    <div className="space-y-2">
                      <label className="block text-xs font-medium text-slate-700 mb-1">Channel Mode</label>
                      <div className="flex flex-col gap-2">
                        <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
                          <input type="radio" checked={channelMode === 'filter'} onChange={() => setChannelMode('filter')} className="accent-[#e60000]" />
                          Filter to one channel
                        </label>
                        <label className={`flex items-center gap-2 text-sm cursor-pointer ${(segmentMode === 'compare' || productMode === 'compare') ? 'text-slate-400' : 'text-slate-700'}`}>
                          <input type="radio" checked={channelMode === 'compare'} onChange={() => setChannelMode('compare')} disabled={segmentMode === 'compare' || productMode === 'compare'} className="accent-[#e60000]" />
                          Compare all channels {(segmentMode === 'compare' || productMode === 'compare') && '(Disabled)'}
                        </label>
                      </div>
                      {channelMode === 'filter' && (
                        <div>
                          <label className="block text-xs font-medium text-slate-700 mb-1">Select Channel Value</label>
                          <select value={channelValue} onChange={(e) => setChannelValue(e.target.value)} className="w-full text-sm border border-slate-200 rounded-lg p-2 bg-white outline-none">
                            <option value="">-- Select --</option>
                            <option value="All (Aggregated)">All (Aggregated)</option>
                            {Array.from(new Set(data.map(r => String(r[wiChannelCol])).filter(v => v && v !== 'undefined'))).sort().map(v => (
                              <option key={v} value={v}>{v}</option>
                            ))}
                          </select>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>

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
                <div className="space-y-2">
                  {(['Holt Linear', 'Damped Trend', 'Holt-Winters'] as const).map(m => (
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
                        {m === 'Holt Linear' && 'Level + trend smoothing — α, β optimised per series'}
                        {m === 'Damped Trend' && 'Trend damped toward flat — α, β, φ optimised per series'}
                        {m === 'Holt-Winters' && 'Triple exponential smoothing, multiplicative seasonality — α, β, γ optimised per series'}
                      </div>
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <div className="flex justify-between mb-1">
                  <label className="text-xs font-medium text-slate-700">Pre-Horizon z-score</label>
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
                  <label className="text-xs font-medium text-slate-700">Post-Horizon Band Multiplier</label>
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
                  <label className="text-xs font-medium text-slate-700">Confidence Horizon (Months)</label>
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
              <div className="h-[400px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={stdChartData} margin={{ top: 5, right: 20, bottom: 40, left: 0 }}>
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
                    <YAxis tick={{ fontSize: 12, fill: '#64748b' }} axisLine={false} tickLine={false} tickFormatter={(value) => formatNumber(value)} />
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
                      endIndex={Math.min(stdChartData.length - 1, windowOffset + windowSize - 1)}
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

            {/* Fitted Model Parameters */}
            {baseForecast?.fittedParams && (
              <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
                <h3 className="text-base font-semibold text-slate-900 mb-1 flex items-center gap-2">
                  <SlidersHorizontal size={15} className="text-[#e60000]" />
                  Fitted Model Parameters
                </h3>
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
                            <td className="py-2 px-4 text-center font-mono text-slate-800">{p.beta.toFixed(2)}</td>
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

            {/* Data Preview Table */}
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 overflow-hidden flex flex-col">
              <h3 className="text-lg font-semibold text-slate-900 mb-4">Data Preview</h3>
              <div className="overflow-x-auto rounded-xl border border-slate-200 max-h-[400px]">
                <table className="w-full text-sm text-left relative">
                  <thead className="text-xs text-slate-500 uppercase bg-slate-50 border-b border-slate-200 sticky top-0 z-10">
                    <tr>
                      <th className="px-6 py-4 font-semibold">Date</th>
                      {compareCategories.length > 0 ? (
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
                    {stdChartData.map((row, idx) => (
                      <tr key={idx} className="hover:bg-slate-50 transition-colors">
                        <td className="px-6 py-4 font-medium text-slate-900">{row.date}</td>
                        {compareCategories.length > 0 ? (
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
                    className="px-5 py-2.5 bg-[#e60000] text-white rounded-lg text-sm font-semibold hover:bg-red-700 transition-colors"
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
    </>
  );
};

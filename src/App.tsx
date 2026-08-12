import React, { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import * as XLSX from 'xlsx';
import { FileSpreadsheet } from 'lucide-react';
import { format, isValid, parse } from 'date-fns';
import { useTranslation } from 'react-i18next';
import { calculateHoltWinters, MarketEvent, getUniqueCombos, calculateBaseForecast, buildCohortDataMap, computeCohortTrailingArpu, resolveEventArpuRevenue, draftEventRate, nextSequence, backfillSequences, bySequence, deriveAggregate , buildRollUpIndex, isRetiredAggregateFit, hasAnyUsableForecast, restoreSeedKnown, parseStoredMonths, canShowBaseForecast, readStoredEventModifiers, isAllBearing, missingLeavesForKey, buildPanelRowsFromStore, resolveFromStore, buildRestoredLeafIndex, makeForecastKey as sharedMakeForecastKey } from './utils/forecasting';
import type { AggregatedIBRORow, PreAggRow, CohortDataMap } from './utils/forecasting';
import { rowInScope, ALL_DIMS } from './utils/cohortScope';
import { filterToKey, cohortToFilter, forecastForView, forecastForStep1Selection, step1ResolveDecision, describeScope } from './utils/viewFilter';
import type { BaseForecast, MarketEventAdjustedForecast, ForecastModel, BulkRunRecord, YieldEvent, PricingEvent, SkippedCohort, Provenance, SkipReason } from './types/forecast';
import { provenanceModel, provenanceParams } from './types/forecast';
import { ForecastProvider } from './context/ForecastContext';
import HomeTab from './components/HomeTab';
import { StandardForecastTab } from './components/StandardForecastTab';
import { WhatIfTab } from './components/WhatIfTab';
import { ForecastVsActualsTab } from './components/ForecastVsActualsTab';
import { OverallForecastTab } from './components/OverallForecastTab';
import { ScenarioCompareTab } from './components/ScenarioCompareTab';
import { GenerateCohortForecastModal } from './components/GenerateCohortForecastModal';
import { ViewCohortForecastModal } from './components/ViewCohortForecastModal';
import { ImportActualsModal } from './components/ImportActualsModal';
import { BulkGenerateModal } from './components/BulkGenerateModal';
import { ManageBulkDrawer } from './components/ManageBulkDrawer';
import StepIndicator from './components/StepIndicator';
import { ViewFilterBar } from './components/ViewFilterBar';
import type { ViewFilter, HierarchicalSelection } from './components/ViewFilterBar';

const COLORS = ['#e60000', '#10b981', '#3b82f6', '#f59e0b', '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16', '#f97316', '#64748b'];

// ---------------------------------------------------------------------------
// Export filename modal
// ---------------------------------------------------------------------------
function ExportFilenameModal({
  isOpen,
  defaultName,
  onConfirm,
  onClose,
}: {
  isOpen: boolean;
  defaultName: string;
  onConfirm: (name: string) => void;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const [value, setValue] = React.useState(defaultName);

  // Re-sync default when modal is re-opened (timestamp changes each time)
  React.useEffect(() => { if (isOpen) setValue(defaultName); }, [isOpen, defaultName]);

  if (!isOpen) return null;

  const handleConfirm = () => {
    // Strip characters that are illegal in Windows/macOS/Linux filenames
    const safe = value.replace(/[\\/:*?"<>|]/g, '').trim();
    onConfirm(safe || 'PROSPECT Save');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-md mx-4 bg-white rounded-2xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="px-6 pt-6 pb-4 flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center shrink-0">
              <FileSpreadsheet size={20} className="text-emerald-600" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">{t('common_export_session')}</h2>
              <p className="text-xs text-slate-500 mt-0.5">{t('app_full_save_point_7_sheets_including_actuals_fo')}</p>
            </div>
          </div>
        </div>

        {/* Filename input */}
        <div className="mx-6 mb-5">
          <label className="block text-xs font-semibold text-slate-700 mb-1.5">{t('app_file_name')}</label>
          <input
            type="text"
            value={value}
            onChange={e => setValue(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') handleConfirm(); if (e.key === 'Escape') onClose(); }}
            autoFocus
            className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2.5 outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500/40"
          />
          <p className="text-[10px] text-slate-400 mt-1.5">{t('app_characters_andlt_andgt_will_be_stripped_autom')}</p>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 bg-slate-50 border-t border-slate-100">
          <button onClick={onClose} className="px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-800 transition-colors">{t('common_cancel')}</button>
          <button
            onClick={handleConfirm}
            className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-sm font-semibold transition-colors flex items-center gap-2"
          >
            <FileSpreadsheet size={14} />{t('app_download')}</button>
        </div>
      </div>
    </div>
  );
}

const formatNumber = (num: number | null | undefined) => {
  if (num === null || num === undefined) return '';
  if (Math.abs(num) >= 1000000000) {
    return num.toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  } else if (Math.abs(num) >= 1000000) {
    return (num / 1000000).toFixed(2) + 'M';
  } else if (Math.abs(num) >= 1000) {
    return (num / 1000).toFixed(2) + 'K';
  } else {
    return num.toFixed(2);
  }
};

export default function App() {
  const { t } = useTranslation();
  const [activeView, setActiveView] = useState<'home' | 'standard' | 'whatif' | 'overall' | 'vsactuals' | 'compare'>('home');
  const [data, setData] = useState<any[]>([]);
  const [columns, setColumns] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [logoError, setLogoError] = useState(false);

  // Shared Data Mapping State
  const [wiDateCol, setWiDateCol] = useState('');
  const [wiMetricCol, setWiMetricCol] = useState('');
  const [wiValueCol, setWiValueCol] = useState('');
  const [wiCustomerCol, setWiCustomerCol] = useState('');
  const [wiRevenueCol, setWiRevenueCol] = useState('');
  const [wiArpuCol, setWiArpuCol] = useState('');
  const [wiInflowVal, setWiInflowVal] = useState('');
  const [wiOutflowVal, setWiOutflowVal] = useState('');
  const [wiBaseVal, setWiBaseVal] = useState('');
  const [wiRetentionVal, setWiRetentionVal] = useState('');
  const [wiSegmentCol, setWiSegmentCol] = useState('');
  const [wiProductCol, setWiProductCol] = useState('');
  const [wiProductL2Col, setWiProductL2Col] = useState('');
  const [wiChannelCol, setWiChannelCol] = useState('');
  const [wiChannelL2Col, setWiChannelL2Col] = useState('');
  const [wiTariffL1Col, setWiTariffL1Col] = useState('');
  const [wiTariffL2Col, setWiTariffL2Col] = useState('');
  const [showMappingMenu, setShowMappingMenu] = useState(false);

  // Missing State Variables
  const [dateCol, setDateCol] = useState('');
  const [targetCol, setTargetCol] = useState('');
  const [segmentCol, setSegmentCol] = useState('');
  const [productCol, setProductCol] = useState('');
  const [channelCol, setChannelCol] = useState('');
  const [segmentValue, setSegmentValue] = useState('All (Aggregated)');
  const [productValue, setProductValue] = useState('All (Aggregated)');
  const [productL2Value, setProductL2Value] = useState('');
  const [channelValue, setChannelValue] = useState('All (Aggregated)');
  const [channelL2Value, setChannelL2Value] = useState('');
  const [tariffValue, setTariffValue] = useState('All (Aggregated)');
  const [tariffL2Value, setTariffL2Value] = useState('');
  const [stdForecastLength] = useState(24);

  // Standard Forecast State
  const [selectedForecastModel, setSelectedForecastModel] = useState<ForecastModel>('Holt Linear');
  const [stdScenario, setStdScenario] = useState('Inflow');
  const [forecastData, setForecastData] = useState<any[]>([]);
  // preHorizonUncertainty: z-score applied within the confidence horizon (1.0 = ±1σ√h ≈ 68%)
  const [preHorizonUncertainty, setPreHorizonUncertainty] = useState(1.0);
  // postHorizonExpansionRate: multiplier on z=1.96 beyond the horizon (1.0 = exactly ±1.96σ√h)
  const [postHorizonExpansionRate, setPostHorizonExpansionRate] = useState(1.0);
  const [confidenceHorizon, setConfidenceHorizon] = useState(3);
  const [stdSegmentValue, setStdSegmentValue] = useState('All (Aggregated)');
  const [stdProductValue, setStdProductValue] = useState('All (Aggregated)');
  const [stdChannelValue, setStdChannelValue] = useState('All (Aggregated)');
  const [compareCategories, setCompareCategories] = useState<string[]>([]);
  const [segmentMode, setSegmentMode] = useState<'filter' | 'compare'>('filter');
  const [productMode, setProductMode] = useState<'filter' | 'compare'>('filter');
  const [channelMode, setChannelMode] = useState<'filter' | 'compare'>('filter');
  
  // Windowing State
  const [windowSize, setWindowSize] = useState(12);
  const [windowOffset, setWindowOffset] = useState(0);

  // What-If State
  const [wiSegmentValue, setWiSegmentValue] = useState('All (Aggregated)');
  const [wiProductValue, setWiProductValue] = useState('All (Aggregated)');
  const [wiChannelValue, setWiChannelValue] = useState('All (Aggregated)');
  const [wiUpliftPct, setWiUpliftPct] = useState(0);
  const [wiInflowLag, setWiInflowLag] = useState(0);
  const [wiRetentionUpliftPct, setWiRetentionUpliftPct] = useState(0);
  const [wiRetentionLag, setWiRetentionLag] = useState(0);
  const [wiArpuUpliftPct, setWiArpuUpliftPct] = useState(0);
  const [marketEvents, setMarketEvents] = useState<MarketEvent[]>([]);
  // whatIfDelta / whatIfRevenueDelta / whatIfMissingMonths deleted 2026-07-31:
  // their only setters lived in generateWhatIfForecast, so all three were stuck
  // at their initial values. WhatIfTab still declares an optional missingMonths
  // prop and renders a gap warning from it; that block now has NO SUPPLIER and
  // has never fired. Left in place rather than deleted -- removing a UI
  // capability is a product decision. See EXPECTED.md.
  const [selectedKpis, setSelectedKpis] = useState<string[]>(['Inflow Volume', 'Base Volume']);
  const [forecastLength] = useState(24);

  // Overall Forecasts State
  const [savedForecasts, setSavedForecasts] = useState<Record<string, any>>({});
  /**
   * Bottom-up forecasting: cohortId → short-leaf diagnostics for aggregates
   * whose constituent leaves are mostly too short to fit seasonality. Advisory
   * only; it changes no forecast values, it makes the caveat visible.
   */
  const [shortLeafWarnings, setShortLeafWarnings] = useState<Record<string, { shortLeaves: number; totalLeaves: number; share: number }>>({});
  const addMarketEvent = () => {
    if (!newEvent.date || newEvent.subscriberVolume === undefined) return;
    // Outflow events always represent subscribers leaving — negate the magnitudes so
    // the stored values are negative, which is the correct sign for an increase in outflow.
    const isOutflow = newEvent.scenario === 'Outflow';
    // Absolute Outflow volumes are STORED negative. Percentage amounts are
    // not: a percentage applies in its natural direction, so +10% means more
    // outflow and negating it would invert what the user typed.
    const isPct = newEvent.amountType === 'percentage';
    const neg = (v: number) => (isOutflow && !isPct) ? -Math.abs(v) : v;
    // Phase 3 P4: a volume-only Inflow/Retention event (ARPU left blank) is
    // auto-populated from the cohort's trailing 3-month average — baked into the
    // stored event exactly as if the user had typed it, never overriding an
    // explicit non-zero value.
    // A percentage event carries no per-subscriber ARPU, so the trailing-
    // average auto-fill is skipped: storing one would be a number with no
    // meaning, and the table dashes the column for these rows anyway.
    // THE FIFTH WRITER. This is the DEFAULT add path — WhatIfTab's
    // handleAddMarketEvent routes here whenever month-spreading is off, which
    // it is unless the user turns it on. It built its own rate inline and never
    // carried arpuOverride, so an ordinary Add click discarded a stated rate
    // silently. Found by the stage-2 gate; the count of writers was four in my
    // head and five in the code.
    const resolved = draftEventRate(
      newEvent, cohortAvgArpu, newEvent.subscriberVolume || 0, newEvent.revenue, isPct);
    const event: MarketEvent = {
      id: Math.random().toString(36).substr(2, 9),
      scenario: newEvent.scenario as any,
      segment: newEvent.segment || 'All',
      product: newEvent.product || 'All',
      productL2: newEvent.productL2 || 'All',
      channel: newEvent.channel || 'All',
      channelL2: newEvent.channelL2 || 'All',
      tariffL1: newEvent.tariffL1 || 'All',
      tariffL2: newEvent.tariffL2 || 'All',
      date: newEvent.date,
      subscriberVolume: neg(newEvent.subscriberVolume || 0),
      customerVolume:   neg(newEvent.customerVolume   || 0),
      revenue:          neg(resolved.revenue),
      arpu:             neg(resolved.arpu),
      arpuOverride:     newEvent.arpuOverride,
      name:         newEvent.name         || '',
      campaignName: newEvent.campaignName || '',
      comment:      newEvent.comment      || '',
      contractLength: newEvent.contractLength ?? 24,
      amountType: newEvent.amountType ?? 'absolute',
      percentageBasis: newEvent.percentageBasis ?? 'baseline',
      retentionLinked: newEvent.retentionLinked ?? true,
      // Placeholder — the real slot is allocated against prev inside the
      // updater below, so two adds in one batch cannot collide.
      sequence: 0,
    };
    setMarketEvents(prev => [...prev, { ...event, sequence: nextSequence(prev) }]);
    setNewEvent({
      scenario: 'Inflow',
      segment: 'All',
      product: 'All',
      productL2: 'All',
      channel: 'All',
      channelL2: 'All',
      tariffL1: 'All',
      tariffL2: 'All',
      date: format(new Date(), 'yyyy-MM'),
      subscriberVolume: 0,
      customerVolume: 0,
      revenue: 0,
      arpu: 0,
      name: '',
      campaignName: '',
      comment: '',
      contractLength: 24,
    });
  };

  const removeMarketEvent = (id: string) => {
    setMarketEvents(prev => prev.filter(e => e.id !== id));
  };

  // ONE update-by-id primitive, closed over whichever array it is given.
  // Volume/Promotion had this; Yield and Pricing had no update path at all, so
  // their cards could not offer edit. Three bespoke copies would have been the
  // shape this project has paid for repeatedly -- six cohort-scoping predicates,
  // five missing-cohort filters. The forms genuinely differ and stay separate;
  // the patch operation does not.
  //
  // .map() rather than in-place mutation is load-bearing: computeAdjustedForecast
  // is a useMemo keyed on the array reference, so an edit only recomputes the
  // forecast if the reference actually changes.
  function updateById<T extends { id: string }>(
    setter: React.Dispatch<React.SetStateAction<T[]>>,
    id: string,
    patch: Partial<T>,
  ) {
    setter(prev => prev.map(e => (e.id === id ? { ...e, ...patch } : e)));
  }

  const updateMarketEvent = (id: string, patch: Partial<MarketEvent>) =>
    updateById(setMarketEvents, id, patch);

  const handleImportActualsFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const buffer = evt.target?.result;
        const wb = XLSX.read(buffer, { type: 'array', cellDates: true });
        const sheetName = wb.SheetNames[0];
        const rows: any[] = XLSX.utils.sheet_to_json(wb.Sheets[sheetName]);
        if (rows.length === 0) return;

        // Detect date column: prefer already-mapped wiDateCol, else auto-detect
        const firstRowKeys = Object.keys(rows[0] as object);
        const detectDateCol = (): string => {
          if (wiDateCol && firstRowKeys.includes(wiDateCol)) return wiDateCol;
          const patterns = ['date', 'time', 'period', 'month'];
          for (const p of patterns) {
            const found = firstRowKeys.find(c => c.toLowerCase().replace(/[^a-z0-9]/g, '').includes(p));
            if (found) return found;
          }
          return firstRowKeys[0] || '';
        };
        const dateCol = detectDateCol();

        // Build unique month → row count map
        const monthCounts = new Map<string, number>();
        rows.forEach(row => {
          const raw = row[dateCol];
          if (!raw) return;
          let d: Date;
          if (raw instanceof Date) {
            d = raw;
          } else {
            d = new Date(raw);
          }
          if (!isValid(d)) return;
          const label = format(d, 'yyyy-MM');
          monthCounts.set(label, (monthCounts.get(label) || 0) + 1);
        });

        if (monthCounts.size === 0) {
          alert('Could not detect any valid dates in the file.');
          return;
        }

        // Detect the value column in the incoming file (use mapped wiValueCol if present)
        const valueColCandidates = [wiValueCol, 'Subscriber_Volume', 'Subscriber Volume', 'Value', 'value', 'Volume'];
        const detectedValueCol = valueColCandidates.find(c => c && firstRowKeys.includes(c)) || '';

        // A month is "already loaded" when the current dataset contains at least one row
        // for that month where the actual value column is populated (non-blank, non-zero).
        // We do NOT use date-existence alone, because forecast rows share the same dates.
        const monthsWithActuals = new Set<string>();
        if (data.length > 0) {
          const existingValueCol = wiValueCol || detectedValueCol;
          data.forEach(row => {
            const raw = row[wiDateCol] || row[dateCol];
            if (!raw) return;
            const d = raw instanceof Date ? raw : new Date(raw);
            if (!isValid(d)) return;
            const label = format(d, 'yyyy-MM');
            // Only mark as loaded if an actual value is present on this row
            const val = row[existingValueCol];
            if (val !== undefined && val !== null && val !== '' && Number(val) !== 0) {
              monthsWithActuals.add(label);
            }
          });
        }

        const sortedMonths = Array.from(monthCounts.entries())
          .sort((a, b) => b[0].localeCompare(a[0])) // newest first
          .map(([label, count]) => ({
            label,
            count,
            alreadyLoaded: monthsWithActuals.has(label),
          }));

        setImportActualsState({ rows, months: sortedMonths, detectedDateCol: dateCol });
      } catch (err) {
        console.error(err);
        alert('Error reading file. Please ensure it is a valid .xlsx or .xls file.');
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const handleImportActualsConfirm = (selectedMonths: Set<string>) => {
    if (!importActualsState) return;
    const { rows, detectedDateCol } = importActualsState;

    const toAppend = rows.filter(row => {
      const raw = row[detectedDateCol];
      if (!raw) return false;
      const d = raw instanceof Date ? raw : new Date(raw);
      if (!isValid(d)) return false;
      return selectedMonths.has(format(d, 'yyyy-MM'));
    });

    setData(prev => [...prev, ...toAppend]);
    // Refresh columns to include any new ones from the imported file
    if (toAppend.length > 0) {
      const newCols = Object.keys(toAppend[0] as object);
      setColumns(prev => Array.from(new Set([...prev, ...newCols])));
    }
    setImportActualsState(null);
  };

  const handleRemoveActuals = (keepFn: (row: any) => boolean, _removedCount: number) => {
    setData(prev => prev.filter(keepFn));
  };

  // ---------------------------------------------------------------------------
  // Session export — builds a full save-point workbook across 7 sheets.
  // Triggered from the filename modal; fileName has already been sanitised.
  // ---------------------------------------------------------------------------
  const exportSession = (fileName: string) => {
    try {
    const wb = XLSX.utils.book_new();
    const exportTs = new Date();

    // ── Sheet 1: Actuals ──────────────────────────────────────────────────────
    // Raw uploaded actuals with dates normalised to yyyy-MM.
    const actualsRows = data.map(row => {
      const out: Record<string, any> = {};
      Object.keys(row).forEach(col => {
        if (col === wiDateCol && row[col]) {
          const d = row[col] instanceof Date ? row[col] : new Date(row[col]);
          out[col] = isValid(d) ? format(d, 'yyyy-MM') : row[col];
        } else {
          const v = row[col];
          out[col] = typeof v === 'string' && v.length > 32000 ? v.substring(0, 32000) : v;
        }
      });
      return out;
    });
    XLSX.utils.book_append_sheet(
      wb,
      XLSX.utils.json_to_sheet(actualsRows.length ? actualsRows : [{ Note: 'No actuals data loaded' }]),
      'Actuals',
    );

    // ── Sheet 2: Baseline_Forecasts ───────────────────────────────────────────
    // One row per cohort-month across ALL forecasts in forecastStore.
    // Every IBRO metric + per-IBRO ARPU band is exported so the full session
    // can be restored without re-running the forecast model.
    const bfRows: Record<string, any>[] = [];

    const activeForecastKey = baseForecast
      ? makeForecastKey(baseForecast.cohort.segment, baseForecast.cohort.product, baseForecast.cohort.productL2, baseForecast.cohort.channel, baseForecast.cohort.channelL2, baseForecast.cohort.tariffL1, baseForecast.cohort.tariffL2)
      : null;

    forecastStore.forEach((bf, storeKey) => {
      const logEntry = cohortGenLog.find(e =>
        e.cohortId.startsWith(`${bf.cohort.segment}|${bf.cohort.product}|${bf.cohort.channel}`)
      );
      const bulkRun = bulkRuns.find(r => r.cohortIds.includes(storeKey));
      const meta = {
        Cohort_Key:  storeKey,
        Is_Active:   storeKey === activeForecastKey ? 'Yes' : 'No',
        Source:      'ForecastStore',
        Segment:     bf.cohort.segment,
        Product:     bf.cohort.product,
        Product_L2:  bf.cohort.productL2 ?? 'All',
        Channel:     bf.cohort.channel,
        Channel_L2:  bf.cohort.channelL2 ?? 'All',
        Tariff_L1:   bf.cohort.tariffL1 ?? 'All',
        Tariff_L2:   bf.cohort.tariffL2 ?? 'All',
        Scenario:    bf.cohort.scenario,
        Model_Used:  provenanceModel(bf.provenance) ?? '',
        Provenance:  bf.provenance.kind,
        Leaf_Count:  bf.provenance.kind === 'derived' ? bf.provenance.leafCount : '',
        Seed_Base_Volume:      bf.seedBaseVolume,
        // Absence needs its own column: an unseeded forecast stores 0 for
        // arithmetic safety, and 0 is a legitimate opening stock, so the
        // number alone cannot carry the distinction across a save.
        Seed_Base_Known:       bf.seedBaseKnown,
        Historical_Months:     [...new Set(bf.historicalMonths)].join(', '),
        Last_Historical_Inflow:  bf.lastHistoricalInflow,
        Last_Historical_Outflow: bf.lastHistoricalOutflow,
        Seasonal_Fallback: bf.seasonalFallback ? 'Yes' : 'No',
        Fitted_Params_JSON: provenanceParams(bf.provenance) ? JSON.stringify(provenanceParams(bf.provenance)) : '',
        Pre_Horizon_Uncertainty_Pct:     bf.preHorizonUncertaintyUsed     ?? preHorizonUncertainty,
        Post_Horizon_Expansion_Rate_Pct: bf.postHorizonExpansionRateUsed  ?? postHorizonExpansionRate,
        Confidence_Horizon_Months:       bf.confidenceHorizonUsed         ?? confidenceHorizon,
        Forecast_Length_Months:          stdForecastLength,
        Bulk_Run_Name:    bulkRun?.name ?? '',
        Bulk_Run_Comment: bulkRun?.comment ?? '',
        Generated_At: logEntry?.timestamp ? format(new Date(logEntry.timestamp), 'dd MMM yyyy HH:mm') : '',
      };
      bf.months.forEach(bm => {
        bfRows.push({
          ...meta,
          Month: bm.month,
          Inflow_Mean:      bm.inflow.mean,      Inflow_Optimistic:      bm.inflow.optimistic,      Inflow_Pessimistic:      bm.inflow.pessimistic,
          Outflow_Mean:     bm.outflow.mean,     Outflow_Optimistic:     bm.outflow.optimistic,     Outflow_Pessimistic:     bm.outflow.pessimistic,
          Retention_Mean:   bm.retention.mean,   Retention_Optimistic:   bm.retention.optimistic,   Retention_Pessimistic:   bm.retention.pessimistic,
          ARPU_Mean:        bm.arpu.mean,        ARPU_Optimistic:        bm.arpu.optimistic ?? '',        ARPU_Pessimistic:        bm.arpu.pessimistic ?? '',
          InflowARPU_Mean:     bm.inflowArpu?.mean     ?? '', InflowARPU_Optimistic:     bm.inflowArpu?.optimistic     ?? '', InflowARPU_Pessimistic:     bm.inflowArpu?.pessimistic     ?? '',
          OutflowARPU_Mean:    bm.outflowArpu?.mean    ?? '', OutflowARPU_Optimistic:    bm.outflowArpu?.optimistic    ?? '', OutflowARPU_Pessimistic:    bm.outflowArpu?.pessimistic    ?? '',
          RetentionARPU_Mean:  bm.retentionArpu?.mean  ?? '', RetentionARPU_Optimistic:  bm.retentionArpu?.optimistic  ?? '', RetentionARPU_Pessimistic:  bm.retentionArpu?.pessimistic  ?? '',
          BaseARPU_Mean:       bm.baseArpu?.mean       ?? '', BaseARPU_Optimistic:       bm.baseArpu?.optimistic       ?? '', BaseARPU_Pessimistic:       bm.baseArpu?.pessimistic       ?? '',
        });
      });
    });

    XLSX.utils.book_append_sheet(
      wb,
      XLSX.utils.json_to_sheet(bfRows.length ? bfRows : [{ Note: 'No baseline forecasts generated' }]),
      'Baseline_Forecasts',
    );

    // ── Sheet 3: Market_Events ────────────────────────────────────────────────
    // Sorted by sequence so the sheet reads in the order the user sees,
    // independent of insertion history.
    const evtRows = [...marketEvents].sort(bySequence).map(e => ({
      ID: e.id,
      Sequence: e.sequence,
      Name: e.name ?? '',
      Campaign_Name: e.campaignName ?? '',
      Scenario: e.scenario,
      Segment: e.segment,
      Product: e.product,
      Product_L2: e.productL2 ?? 'All',
      Channel: e.channel,
      Channel_L2: e.channelL2 ?? 'All',
      Tariff_L1: e.tariffL1 ?? 'All',
      Tariff_L2: e.tariffL2 ?? 'All',
      Start_Month: e.date,
      Subscriber_Volume: e.subscriberVolume,
      Customer_Volume: e.customerVolume,
      Revenue: e.revenue,
      ARPU: e.arpu,
      Contract_Length_Months: e.contractLength ?? 24,
      Comment: e.comment ?? '',
      // Percentage events. Distinct column names from the Pricing_Events sheet's
      // Input_Mode/Amount pair on purpose: that one is a RATE and this is a
      // VOLUME, and a shared column name would invite conflating them.
      Amount_Type: e.amountType ?? 'absolute',
      Percentage_Basis: e.percentageBasis ?? '',
      Retention_Linked: e.retentionLinked === false ? 'No' : 'Yes',
      // Phase 4 — Custom Promotion Card
      Is_Promotion: e.isPromotion ? 'Yes' : 'No',
      Promo_Rebanded: e.promoRebanded ? 'Yes' : 'No',
      Promo_Mix_Axis: e.promoMixAxis ?? '',
      Promo_Mix_JSON: e.promoMix ? JSON.stringify(e.promoMix) : '',
      Promo_Pricing_Mode: e.promoPricingMode ?? '',
      Promo_Pricing_Amount: e.promoPricingAmount ?? '',
      // Alessandro's editable ARPU. '' is the ABSENCE carrier and 0 is a real
      // stated rate — `?? ''` is doing that work, so it must not become `?? 0`.
      Arpu_Override: e.arpuOverride ?? '',
    }));
    XLSX.utils.book_append_sheet(
      wb,
      XLSX.utils.json_to_sheet(evtRows.length ? evtRows : [{ Note: 'No market events defined' }]),
      'Market_Events',
    );

    // ── Sheet 4: Adjusted_Forecasts ───────────────────────────────────────────
    if (adjustedForecast) {
      const cohort = adjustedForecast.base.cohort;
      const adjRows = adjustedForecast.adjustedMonths.map(am => ({
        Segment:    cohort.segment,
        Product:    cohort.product,
        Product_L2: cohort.productL2 ?? 'All',
        Channel:    cohort.channel,
        Channel_L2: cohort.channelL2 ?? 'All',
        Scenario:   cohort.scenario,
        Month: am.month,
        Inflow_Baseline: am.baseline.inflow,
        Inflow_Adjusted: am.uplifted.inflow,
        Outflow_Baseline: am.baseline.outflow,
        Outflow_Adjusted: am.uplifted.outflow,
        Retention_Baseline: am.baseline.retention,
        Retention_Adjusted: am.uplifted.retention,
        ARPU_Baseline: am.baseline.arpu,
        ARPU_Adjusted: am.uplifted.arpu,
        Applied_Event_IDs: am.appliedEventIds.join('; '),
      }));
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(adjRows), 'Adjusted_Forecasts');
    } else {
      XLSX.utils.book_append_sheet(
        wb,
        XLSX.utils.json_to_sheet([{ Note: 'No market events applied — adjusted forecast not available' }]),
        'Adjusted_Forecasts',
      );
    }

    // ── Sheet 5: Bulk_Generation_History ─────────────────────────────────────
    const bulkRows = bulkRuns.map(r => ({
      Run_ID: r.id,
      Run_Name: r.name || `Bulk Run — ${format(new Date(r.timestamp), 'dd MMM yyyy')}`,
      Comment: r.comment ?? '',
      Timestamp: format(new Date(r.timestamp), 'dd MMM yyyy HH:mm'),
      Model: r.settings.model,
      Pre_Horizon_Uncertainty_Pct: r.settings.preHorizonUncertainty,
      Post_Horizon_Expansion_Rate_Pct: r.settings.postHorizonExpansionRate,
      Confidence_Horizon_Months: r.settings.confidenceHorizon,
      Forecast_Length_Months: r.settings.forecastLength,
      Cohorts_Generated: r.generated,
      Cohorts_Failed: r.failed,
      Cohort_IDs: r.cohortIds.join('; ').substring(0, 32000),
    }));
    XLSX.utils.book_append_sheet(
      wb,
      XLSX.utils.json_to_sheet(bulkRows.length ? bulkRows : [{ Note: 'No bulk generation runs recorded' }]),
      'Bulk_Generation_History',
    );

    // ── Sheet 6: Model_Acceptance_Log ─────────────────────────────────────────
    const acceptRows = modelAcceptanceLog.map(r => ({
      Cohort_Key: r.cohortKey,
      Previous_Model: r.previousModel,
      Accepted_Model: r.acceptedModel,
      Switchover_Month: r.switchoverMonth ?? '',
      Date_of_Switch: format(new Date(r.timestamp), 'dd MMM yyyy HH:mm'),
    }));
    XLSX.utils.book_append_sheet(
      wb,
      XLSX.utils.json_to_sheet(acceptRows.length ? acceptRows : [{ Note: 'No AutoML model switches recorded this session' }]),
      'Model_Acceptance_Log',
    );

    // ── Sheet 7: Yield_Events ─────────────────────────────────────────────────
    const yieldRows = yieldEvents.map(e => ({
      ID: e.id,
      Name: e.name ?? '',
      IBRO: e.ibro,
      Segment: e.segment,
      Product: e.product,
      Channel_L1: e.channelL1,
      Channel_L2: e.channelL2,
      Month: e.month,
      Roll_Forward: e.rollForward ? 'Yes' : 'No',
      Mix_Axis: e.mixAxis ?? 'value',
      Tariff_Mix_JSON: JSON.stringify(e.tariffMix),
      Tariff_Base_ARPU_JSON: JSON.stringify(e.tariffBaseArpu),
      Comment: e.comment ?? '',
    }));
    XLSX.utils.book_append_sheet(
      wb,
      XLSX.utils.json_to_sheet(yieldRows.length ? yieldRows : [{ Note: 'No yield events defined' }]),
      'Yield_Events',
    );

    // ── Sheet 8: Pricing_Events ───────────────────────────────────────────────
    const pricingRows = pricingEvents.map(e => ({
      ID: e.id,
      Name: e.name ?? '',
      Segment: e.segment,
      Product: e.product,
      Product_L2: e.productL2,
      Channel_L1: e.channelL1,
      Channel_L2: e.channelL2,
      Tariff_L1: e.tariffL1 ?? 'All',
      Tariff_L2: e.tariffL2 ?? 'All',
      Month: e.month,
      Input_Mode: e.inputMode,
      Amount: e.amount,
      Target: e.target,
      Cohort_Scope: e.cohortScope,
      Duration: e.duration,
      Original_Base_ARPU: e.originalBaseArpu,
      Comment: e.comment ?? '',
    }));
    XLSX.utils.book_append_sheet(
      wb,
      XLSX.utils.json_to_sheet(pricingRows.length ? pricingRows : [{ Note: 'No pricing events defined' }]),
      'Pricing_Events',
    );

    // ── Sheet 9: One_Off_Months (P10) ─────────────────────────────────────────
    const oneOffRows: Record<string, any>[] = [];
    Object.entries(oneOffMonths).forEach(([key, flags]: [string, { month: string; reason: string }[]]) => {
      const [segment, product, productL2, channel, channelL2, tariffL1, tariffL2] = key.split('|');
      flags.forEach(f => {
        oneOffRows.push({
          Segment: segment, Product: product, Product_L2: productL2,
          Channel_L1: channel, Channel_L2: channelL2,
          Tariff_L1: tariffL1, Tariff_L2: tariffL2,
          Month: f.month, Reason: f.reason ?? '',
        });
      });
    });
    XLSX.utils.book_append_sheet(
      wb,
      XLSX.utils.json_to_sheet(oneOffRows.length ? oneOffRows : [{ Note: 'No one-off months flagged' }]),
      'One_Off_Months',
    );

    // ── Sheet 8b: Tariff_Selection (Phase 2b) — the tariffs in scope ──────────
    const tariffSelRows = selectedTariffs.length
      ? selectedTariffs.map(t => ({ Tariff_L1: t }))
      : [{ Note: 'No tariffs selected' }];
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(tariffSelRows), 'Tariff_Selection');

    // ── Sheet 9: Metadata ─────────────────────────────────────────────────────
    const forecastMonths = baseForecast?.months ?? [];
    const metaRows = [
      { Field: 'Export_Timestamp',       Value: format(exportTs, 'dd MMM yyyy HH:mm') },
      { Field: 'PROSPECT_Version',       Value: '1.0.0' },
      { Field: 'Active_Step',            Value: activeView },
      { Field: 'Forecast_Period_Start',  Value: forecastMonths[0]?.month ?? (bfRows[0]?.Month as string ?? '') },
      { Field: 'Forecast_Period_End',    Value: forecastMonths[forecastMonths.length - 1]?.month ?? (bfRows[bfRows.length - 1]?.Month as string ?? '') },
      { Field: 'Baseline_Cohorts',       Value: forecastStore.size + Object.keys(savedForecasts).length },
      { Field: 'Market_Events',          Value: marketEvents.length },
      { Field: 'Yield_Events',           Value: yieldEvents.length },
      { Field: 'Pricing_Events',         Value: pricingEvents.length },
      { Field: 'Selected_Tariffs',       Value: selectedTariffs.length },
      { Field: 'Bulk_Runs',              Value: bulkRuns.length },
      { Field: 'Model_Switches',         Value: modelAcceptanceLog.length },
      { Field: 'Pre_Horizon_Uncertainty_Pct',       Value: preHorizonUncertainty },
      { Field: 'Post_Horizon_Expansion_Rate_Pct',   Value: postHorizonExpansionRate },
      { Field: 'Confidence_Horizon_Months',          Value: confidenceHorizon },
      { Field: 'Forecast_Length_Months',             Value: stdForecastLength },
    ];
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(metaRows), 'Metadata');

    XLSX.writeFile(wb, `${fileName}.xlsx`);
    } catch (err) {
      console.error('[ExportSession] Error:', err);
      alert(`Export failed: ${err instanceof Error ? err.message : String(err)}`);
    }
  };

  // Open the export modal (replaces the old exportToExcel function).
  const openExportModal = () => setShowExportModal(true);

  // ---------------------------------------------------------------------------
  // Session import — restores full ForecastContext state from a PROSPECT save.
  // ---------------------------------------------------------------------------
  const handleImportSaveFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const buffer = evt.target?.result;
        const wb = XLSX.read(buffer, { type: 'array', cellDates: true });

        // ── Validate ──────────────────────────────────────────────────────────
        const requiredSheets = [
          'Actuals', 'Baseline_Forecasts', 'Market_Events',
          'Adjusted_Forecasts', 'Bulk_Generation_History',
          'Model_Acceptance_Log', 'Metadata',
        ];
        const missingSheets = requiredSheets.filter(s => !wb.SheetNames.includes(s));
        if (missingSheets.length > 0) {
          setImportSaveResult({
            success: false,
            error: `Not a recognised PROSPECT save file — missing sheets: ${missingSheets.join(', ')}.`,
          });
          return;
        }

        const metaRaw: any[] = XLSX.utils.sheet_to_json(wb.Sheets['Metadata']);
        const getMetaValue = (field: string) => metaRaw.find(r => r.Field === field)?.Value;
        if (!getMetaValue('PROSPECT_Version')) {
          setImportSaveResult({
            success: false,
            error: 'Not a recognised PROSPECT save file — missing PROSPECT_Version in Metadata.',
          });
          return;
        }

        const exportTimestamp: string = String(getMetaValue('Export_Timestamp') ?? '');
        const activeStepRaw: string   = String(getMetaValue('Active_Step') ?? 'home');

        // ── Actuals ───────────────────────────────────────────────────────────
        const actualsRaw: any[] = XLSX.utils.sheet_to_json(wb.Sheets['Actuals']);
        if (actualsRaw.length > 0 && !actualsRaw[0]?.Note) {
          setData(actualsRaw);
          setColumns(Object.keys(actualsRaw[0] as object));
        }

        // ── Baseline Forecasts ────────────────────────────────────────────────
        const bfRaw: any[] = XLSX.utils.sheet_to_json(wb.Sheets['Baseline_Forecasts']);
        if (bfRaw.length > 0 && !bfRaw[0]?.Note) {

          // ── New format: ForecastStore rows (one row per cohort-month) ─────────
          const storeRows = bfRaw.filter(r => r.Source === 'ForecastStore');
          if (storeRows.length > 0) {
            // Group by Cohort_Key to reconstruct each BaseForecast
            const cohortGroups = new Map<string, any[]>();
            storeRows.forEach(r => {
              const key = String(r.Cohort_Key ?? '');
              if (!key) return;
              if (!cohortGroups.has(key)) cohortGroups.set(key, []);
              cohortGroups.get(key)!.push(r);
            });

            const restoredStore = new Map<string, BaseForecast>();
            let activeBf: BaseForecast | null = null;
            const restoredLog: Array<{ cohortId: string; timestamp: string; modelUsed: ForecastModel }> = [];

            cohortGroups.forEach((rows, storeKey) => {
              const first = rows[0];
              const bf: BaseForecast = {
                cohort: {
                  segment:   String(first.Segment    ?? 'All'),
                  product:   String(first.Product    ?? 'All'),
                  productL2: String(first.Product_L2 ?? 'All'),
                  channel:   String(first.Channel    ?? 'All'),
                  channelL2: String(first.Channel_L2 ?? 'All'),
                  tariffL1:  String(first.Tariff_L1  ?? 'All'),
                  tariffL2:  String(first.Tariff_L2  ?? 'All'),
                  scenario:  String(first.Scenario   ?? 'Standard Forecast'),
                },
                seedBaseVolume:        Number(first.Seed_Base_Volume       ?? 0),
                seedBaseKnown:         restoreSeedKnown(first),
                historicalMonths:      parseStoredMonths(first.Historical_Months),
                lastHistoricalInflow:  Number(first.Last_Historical_Inflow  ?? 0),
                lastHistoricalOutflow: Number(first.Last_Historical_Outflow ?? 0),
                // Provenance discriminant. A file with no Provenance column
                // predates option C, and everything in one was fitted - so the
                // default is a fact about old files, not a guess. Model_Used is
                // EMPTY for a derived row, and must NOT be defaulted to a model
                // name here: that would recreate the fiction on the way back in.
                provenance: readProvenance(first),
                seasonalFallback: first.Seasonal_Fallback === 'Yes',
                months: rows.map(r => {
                  const bm: any = {
                    month:     String(r.Month),
                    inflow:    { mean: Number(r.Inflow_Mean    ?? 0), optimistic: Number(r.Inflow_Optimistic    ?? 0), pessimistic: Number(r.Inflow_Pessimistic    ?? 0) },
                    outflow:   { mean: Number(r.Outflow_Mean   ?? 0), optimistic: Number(r.Outflow_Optimistic   ?? 0), pessimistic: Number(r.Outflow_Pessimistic   ?? 0) },
                    retention: { mean: Number(r.Retention_Mean ?? 0), optimistic: Number(r.Retention_Optimistic ?? 0), pessimistic: Number(r.Retention_Pessimistic ?? 0) },
                    arpu:      { mean: Number(r.ARPU_Mean      ?? 0), optimistic: Number(r.ARPU_Optimistic      ?? 0), pessimistic: Number(r.ARPU_Pessimistic      ?? 0) },
                  };
                  if (r.InflowARPU_Mean    !== '' && r.InflowARPU_Mean    != null) bm.inflowArpu    = { mean: Number(r.InflowARPU_Mean),    optimistic: Number(r.InflowARPU_Optimistic    ?? 0), pessimistic: Number(r.InflowARPU_Pessimistic    ?? 0) };
                  if (r.OutflowARPU_Mean   !== '' && r.OutflowARPU_Mean   != null) bm.outflowArpu   = { mean: Number(r.OutflowARPU_Mean),   optimistic: Number(r.OutflowARPU_Optimistic   ?? 0), pessimistic: Number(r.OutflowARPU_Pessimistic   ?? 0) };
                  if (r.RetentionARPU_Mean !== '' && r.RetentionARPU_Mean != null) bm.retentionArpu = { mean: Number(r.RetentionARPU_Mean), optimistic: Number(r.RetentionARPU_Optimistic ?? 0), pessimistic: Number(r.RetentionARPU_Pessimistic ?? 0) };
                  if (r.BaseARPU_Mean      !== '' && r.BaseARPU_Mean      != null) bm.baseArpu      = { mean: Number(r.BaseARPU_Mean),      optimistic: Number(r.BaseARPU_Optimistic      ?? 0), pessimistic: Number(r.BaseARPU_Pessimistic      ?? 0) };
                  return bm;
                }),
              };
              if (first.Fitted_Params_JSON) {
                try {
                  const fp = JSON.parse(String(first.Fitted_Params_JSON));
                  if (bf.provenance.kind !== 'derived') bf.provenance.fittedParams = fp;
                } catch {}
              }
              // Rebuild the store key from the restored dims so old 5-part saves
              // (no Tariff columns) are normalised to the current 7-part format.
              const normKey = makeForecastKey(
                bf.cohort.segment, bf.cohort.product, bf.cohort.productL2,
                bf.cohort.channel, bf.cohort.channelL2, bf.cohort.tariffL1, bf.cohort.tariffL2,
              );
              restoredStore.set(normKey, bf);
              if (first.Is_Active === 'Yes') activeBf = bf;

              if (first.Generated_At) {
                try {
                  restoredLog.push({
                    cohortId:  `${first.Segment}|${first.Product}|${first.Channel}|Standard Forecast|${first.Scenario ?? 'Base Case'}`,
                    timestamp: new Date(String(first.Generated_At)).toISOString(),
                    // Reads the SAME cell as the sibling provenance assignment above, so it
                    // must reach the same conclusion. Model_Used is EMPTY for a
                    // derived row; defaulting it here would label a derived
                    // aggregate 'Holt Linear' in the audit log while the forecast
                    // beside it correctly says it has no model.
                    modelUsed: provenanceModel(readProvenance(first)),
                  });
                } catch {}
              }
            });

            setForecastStore(() => restoredStore);
            if (restoredLog.length > 0) setCohortGenLog(restoredLog);

            // Use Is_Active cohort as the active forecast; fall back to first entry.
            //
            // ROUTED THROUGH THE SEAM, and it must be. `activeBf` is the raw
            // stored row, and on a session saved before the retirement rule the
            // Is_Active row is exactly the kind of thing the rule refuses - a
            // fit-on-aggregate. Setting it directly showed the stale total on
            // Step 1 until a filter change quietly replaced it, which is worse
            // than showing it permanently: the number that appears first is the
            // one people write down.
            //
            // resolveFromStore, not resolveForecast: setForecastStore above has
            // not committed yet, so that closure still holds the OLD store.
            const rawBf = activeBf ?? (restoredStore.values().next().value as BaseForecast | undefined) ?? null;
            const restoredLeafMap = buildRestoredLeafIndex(restoredStore.keys());
            const bf = rawBf
              ? resolveFromStore(restoredStore, restoredLeafMap, makeForecastKey(
                  rawBf.cohort.segment, rawBf.cohort.product, rawBf.cohort.productL2,
                  rawBf.cohort.channel, rawBf.cohort.channelL2,
                  rawBf.cohort.tariffL1, rawBf.cohort.tariffL2,
                )).forecast
              : null;
            if (bf) {
              setBaseForecast(bf);
              setForecastUpdatedAt(new Date().toISOString());
              setStep2Filter(cohortToFilter(bf.cohort));
              setStep3Filter(cohortToFilter(bf.cohort));
            }

          } else {
            // ── Backward-compat: old format (Typed BaseForecast / legacy rows) ──
            const typedRows = bfRaw.filter(r => r.Source === 'Typed BaseForecast');
            if (typedRows.length > 0) {
              const first = typedRows[0];
              const restoredBf: BaseForecast = {
                cohort: {
                  segment:   String(first.Segment    ?? 'All'),
                  product:   String(first.Product    ?? 'All'),
                  productL2: String(first.Product_L2 ?? 'All'),
                  channel:   String(first.Channel    ?? 'All'),
                  channelL2: String(first.Channel_L2 ?? 'All'),
                  tariffL1:  String(first.Tariff_L1  ?? 'All'),
                  tariffL2:  String(first.Tariff_L2  ?? 'All'),
                  scenario:  String(first.Scenario   ?? 'Standard Forecast'),
                },
                seedBaseVolume:        Number(first.Seed_Base_Volume       ?? 0),
                seedBaseKnown:         restoreSeedKnown(first),
                historicalMonths:      parseStoredMonths(first.Historical_Months),
                lastHistoricalInflow:  Number(first.Last_Historical_Inflow ?? 0),
                lastHistoricalOutflow: Number(first.Last_Historical_Outflow ?? 0),
                // Provenance discriminant. A file with no Provenance column
                // predates option C, and everything in one was fitted - so the
                // default is a fact about old files, not a guess. Model_Used is
                // EMPTY for a derived row, and must NOT be defaulted to a model
                // name here: that would recreate the fiction on the way back in.
                provenance: readProvenance(first),
                months: typedRows.map(r => ({
                  month:     String(r.Month),
                  inflow:    { mean: Number(r.Inflow_Mean     ?? 0), optimistic: Number(r.Inflow_Optimistic     ?? 0), pessimistic: Number(r.Inflow_Pessimistic     ?? 0) },
                  outflow:   { mean: Number(r.Outflow_Mean    ?? 0), optimistic: Number(r.Outflow_Optimistic    ?? 0), pessimistic: Number(r.Outflow_Pessimistic    ?? 0) },
                  retention: { mean: Number(r.Retention_Mean  ?? 0), optimistic: Number(r.Retention_Optimistic  ?? 0), pessimistic: Number(r.Retention_Pessimistic  ?? 0) },
                  arpu:      { mean: Number(r.ARPU_Mean       ?? 0), optimistic: Number(r.ARPU_Optimistic       ?? 0), pessimistic: Number(r.ARPU_Pessimistic       ?? 0) },
                })),
              };
              const fKeyImport = makeForecastKey(restoredBf.cohort.segment, restoredBf.cohort.product, restoredBf.cohort.productL2, restoredBf.cohort.channel, restoredBf.cohort.channelL2, restoredBf.cohort.tariffL1, restoredBf.cohort.tariffL2);
              setForecastStore(prev => new Map(prev).set(fKeyImport, restoredBf));
              // RAW ON PURPOSE - the retirement rule must NOT be applied here,
              // and the reason is a limit on what an 'All' part means.
              //
              // This is the pre-option-C format. Its keys are manufactured a few
              // lines above by defaulting ABSENT COLUMNS to 'All' (Product_L2,
              // Channel_L2, Tariff_L1/L2 did not exist in that version), and its
              // provenance defaults to 'fitted' because everything in a file that
              // old was. So almost every legacy forecast is All-bearing AND
              // fitted, and the rule would retire practically all of them.
              //
              // It would be wrong to. An 'All' here means "this dimension did not
              // exist when the file was written", not "this is an aggregate over
              // that dimension's values". There is nothing to derive FROM: the
              // legacy path restores a single forecast, so retiring it replaces a
              // number with no number and old files stop loading.
              //
              // The distinction is the point: the rule detects aggregation by
              // reading 'All' as a marker of it, and that inference only holds
              // for keys built by the current enumeration. Where a key was built
              // by defaulting, the marker means something else.
              setBaseForecast(restoredBf);
              setForecastUpdatedAt(new Date().toISOString());
              setStep2Filter(cohortToFilter(restoredBf.cohort));
              setStep3Filter(cohortToFilter(restoredBf.cohort));
              if (first.Generated_At) {
                try {
                  setCohortGenLog([{ cohortId: `${first.Segment}|${first.Product}|${first.Channel}|Standard Forecast|${first.Scenario ?? 'Base Case'}`, timestamp: new Date(String(first.Generated_At)).toISOString(), modelUsed: provenanceModel(readProvenance(first)) }]);
                } catch {}
              }
            }
            const legacyRows = bfRaw.filter(r => r.Source !== 'Typed BaseForecast' && r.Source !== 'ForecastStore');
            if (legacyRows.length > 0) {
              const legacyMap: Record<string, any[]> = {};
              legacyRows.forEach(r => {
                const key = String(r.Cohort_Key ?? '');
                if (!key) return;
                if (!legacyMap[key]) legacyMap[key] = [];
                legacyMap[key].push({ date: r.Month, Type: 'Forecast', 'Mean (Base)': r.Inflow_Mean, Optimistic: r.Inflow_Optimistic, Pessimistic: r.Inflow_Pessimistic });
              });
              setSavedForecasts(legacyMap);
            }
          }
        }

        // ── Market Events ─────────────────────────────────────────────────────
        const evtRaw: any[] = XLSX.utils.sheet_to_json(wb.Sheets['Market_Events']);
        let restoredEvents: MarketEvent[] = [];
        if (evtRaw.length > 0 && !evtRaw[0]?.Note) {
          restoredEvents = evtRaw.map(r => ({
            id:               String(r.ID ?? Math.random().toString(36).substr(2, 9)),
            name:             String(r.Name ?? ''),
            // Legacy fallback: pre-campaign saves used Name as the grouping label
            campaignName:     String(r.Campaign_Name || r.Name || ''),
            scenario:         r.Scenario,
            segment:          r.Segment,
            product:          r.Product,
            productL2:        String(r.Product_L2 ?? 'All'),
            channel:          r.Channel,
            channelL2:        String(r.Channel_L2 ?? 'All'),
            tariffL1:         String(r.Tariff_L1 ?? 'All'),
            tariffL2:         String(r.Tariff_L2 ?? 'All'),
            date:             String(r.Start_Month ?? ''),
            subscriberVolume: Number(r.Subscriber_Volume ?? 0),
            customerVolume:   Number(r.Customer_Volume   ?? 0),
            revenue:          Number(r.Revenue           ?? 0),
            arpu:             Number(r.ARPU              ?? 0),
            contractLength:   Number(r.Contract_Length_Months ?? 24),
            comment:          String(r.Comment ?? ''),
            // Promo/override modifiers via the ONE shared reader — see
            // readStoredEventModifiers. Hand-rolled here and absent entirely at
            // the workbook route below, which is how the promo fields came to
            // round-trip on one path only.
            ...readStoredEventModifiers(r),
            // Sessions exported before 2026-08-01 have no Sequence column;
            // backfillSequences below assigns sheet order to those.
            sequence:         r.Sequence !== undefined && r.Sequence !== '' ? Number(r.Sequence) : undefined as any,
          }));
          setMarketEvents(backfillSequences(restoredEvents));
        }

        // ── Yield Events ──────────────────────────────────────────────────────
        if (wb.SheetNames.includes('Yield_Events')) {
          const yieldRaw: any[] = XLSX.utils.sheet_to_json(wb.Sheets['Yield_Events']);
          if (yieldRaw.length > 0 && !yieldRaw[0]?.Note) {
            setYieldEvents(yieldRaw.map(r => {
              let tariffMix: Record<string, number> = {};
              let tariffBaseArpu: Record<string, number> = {};
              try { tariffMix = JSON.parse(String(r.Tariff_Mix_JSON ?? '{}')); } catch {}
              try { tariffBaseArpu = JSON.parse(String(r.Tariff_Base_ARPU_JSON ?? '{}')); } catch {}
              return {
                id:            String(r.ID ?? Math.random().toString(36).substr(2, 9)),
                name:          String(r.Name ?? ''),
                ibro:          (r.IBRO ?? 'Inflow') as 'Inflow' | 'Retention',
                segment:       String(r.Segment ?? 'All'),
                product:       String(r.Product ?? 'All'),
                channelL1:     String(r.Channel_L1 ?? 'All'),
                channelL2:     String(r.Channel_L2 ?? 'All'),
                month:         String(r.Month ?? ''),
                rollForward:   r.Roll_Forward === 'Yes',
                mixAxis:       (r.Mix_Axis === 'tariff' ? 'tariff' : 'value') as 'value' | 'tariff',
                tariffMix,
                tariffBaseArpu,
                comment:       String(r.Comment ?? ''),
              };
            }));
          }
        }

        // ── Pricing Events ────────────────────────────────────────────────────
        if (wb.SheetNames.includes('Pricing_Events')) {
          const pricingRaw: any[] = XLSX.utils.sheet_to_json(wb.Sheets['Pricing_Events']);
          if (pricingRaw.length > 0 && !pricingRaw[0]?.Note) {
            setPricingEvents(pricingRaw.map(r => ({
              id:               String(r.ID ?? Math.random().toString(36).substr(2, 9)),
              name:             String(r.Name ?? ''),
              segment:          String(r.Segment ?? 'All'),
              product:          String(r.Product ?? 'All'),
              productL2:        String(r.Product_L2 ?? 'All'),
              channelL1:        String(r.Channel_L1 ?? 'All'),
              channelL2:        String(r.Channel_L2 ?? 'All'),
              tariffL1:         String(r.Tariff_L1 ?? 'All'),
              tariffL2:         String(r.Tariff_L2 ?? 'All'),
              month:            String(r.Month ?? ''),
              inputMode:        (r.Input_Mode ?? 'percentage') as 'percentage' | 'absolute',
              amount:           Number(r.Amount ?? 0),
              target:           (r.Target ?? 'cohorts') as 'cohorts' | 'cohorts+base' | 'base-only',
              cohortScope:      (r.Cohort_Scope ?? 'both') as 'inflow' | 'retention' | 'both',
              duration:         (r.Duration ?? 'one-off') as 'one-off' | 'recurring',
              originalBaseArpu: Number(r.Original_Base_ARPU ?? 0),
              comment:          String(r.Comment ?? ''),
            })));
          }
        }

        // ── One-Off Months (P10) ──────────────────────────────────────────────
        if (wb.SheetNames.includes('One_Off_Months')) {
          const oneOffRaw: any[] = XLSX.utils.sheet_to_json(wb.Sheets['One_Off_Months']);
          if (oneOffRaw.length > 0 && !oneOffRaw[0]?.Note) {
            const restored: Record<string, { month: string; reason: string }[]> = {};
            oneOffRaw.forEach(r => {
              const key = makeForecastKey(
                String(r.Segment ?? 'All'), String(r.Product ?? 'All'), String(r.Product_L2 ?? 'All'),
                String(r.Channel_L1 ?? 'All'), String(r.Channel_L2 ?? 'All'),
                String(r.Tariff_L1 ?? 'All'), String(r.Tariff_L2 ?? 'All'),
              );
              if (!restored[key]) restored[key] = [];
              restored[key].push({ month: String(r.Month ?? ''), reason: String(r.Reason ?? '') });
            });
            setOneOffMonths(restored);
          }
        }

        // ── Tariff Selection (Phase 2b) ───────────────────────────────────────
        if (wb.SheetNames.includes('Tariff_Selection')) {
          const tsRaw: any[] = XLSX.utils.sheet_to_json(wb.Sheets['Tariff_Selection']);
          const restored = tsRaw
            .filter(r => !r.Note && r.Tariff_L1 != null && String(r.Tariff_L1).trim() !== '')
            .map(r => String(r.Tariff_L1).trim());
          setSelectedTariffs(restored);
        }

        // ── Adjusted Forecasts ────────────────────────────────────────────────
        const adjRaw: any[] = XLSX.utils.sheet_to_json(wb.Sheets['Adjusted_Forecasts']);
        if (adjRaw.length > 0 && !adjRaw[0]?.Note) {
          // We need a baseForecast reference — use the one we just reconstructed above.
          // Since React state is async, reconstruct inline from bfRaw.
          const typedRows = bfRaw.filter(r => r.Source === 'Typed BaseForecast');
          if (typedRows.length > 0) {
            const first = typedRows[0];
            const bfRef: BaseForecast = {
              cohort: {
                segment: String(first.Segment ?? 'All'),
                product:  String(first.Product  ?? 'All'),
                channel:  String(first.Channel  ?? 'All'),
                scenario: String(first.Scenario ?? 'Standard Forecast'),
              },
              seedBaseVolume:        Number(first.Seed_Base_Volume       ?? 0),
                seedBaseKnown:         restoreSeedKnown(first),
              historicalMonths:      parseStoredMonths(first.Historical_Months),
              lastHistoricalInflow:  Number(first.Last_Historical_Inflow ?? 0),
              lastHistoricalOutflow: Number(first.Last_Historical_Outflow ?? 0),
              // Provenance discriminant. A file with no Provenance column
              // predates option C, and everything in one was fitted - so the
              // default is a fact about old files, not a guess. Model_Used is
              // EMPTY for a derived row, and must NOT be defaulted to a model
              // name here: that would recreate the fiction on the way back in.
              provenance: readProvenance(first),
              months: typedRows.map(r => ({
                month:     String(r.Month),
                inflow:    { mean: Number(r.Inflow_Mean     ?? 0), optimistic: Number(r.Inflow_Optimistic     ?? 0), pessimistic: Number(r.Inflow_Pessimistic     ?? 0) },
                outflow:   { mean: Number(r.Outflow_Mean    ?? 0), optimistic: Number(r.Outflow_Optimistic    ?? 0), pessimistic: Number(r.Outflow_Pessimistic    ?? 0) },
                retention: { mean: Number(r.Retention_Mean  ?? 0), optimistic: Number(r.Retention_Optimistic  ?? 0), pessimistic: Number(r.Retention_Pessimistic  ?? 0) },
                arpu:      { mean: Number(r.ARPU_Mean       ?? 0), optimistic: Number(r.ARPU_Optimistic       ?? 0), pessimistic: Number(r.ARPU_Pessimistic       ?? 0) },
              })),
            };
            setAdjustedForecast({
              base: bfRef,
              marketEvents: restoredEvents,
              adjustedMonths: adjRaw.map(r => ({
                month: String(r.Month),
                baseline: {
                  inflow:    Number(r.Inflow_Baseline    ?? 0),
                  outflow:   Number(r.Outflow_Baseline   ?? 0),
                  retention: Number(r.Retention_Baseline ?? 0),
                  arpu:      Number(r.ARPU_Baseline      ?? 0),
                },
                uplifted: {
                  inflow:    Number(r.Inflow_Adjusted    ?? 0),
                  outflow:   Number(r.Outflow_Adjusted   ?? 0),
                  retention: Number(r.Retention_Adjusted ?? 0),
                  arpu:      Number(r.ARPU_Adjusted      ?? 0),
                },
                appliedEventIds: String(r.Applied_Event_IDs ?? '').split('; ').filter(Boolean),
              })),
            });
          }
        }

        // ── Bulk Generation History ───────────────────────────────────────────
        const bulkRaw: any[] = XLSX.utils.sheet_to_json(wb.Sheets['Bulk_Generation_History']);
        if (bulkRaw.length > 0 && !bulkRaw[0]?.Note) {
          setBulkRuns(bulkRaw.map(r => ({
            id:        String(r.Run_ID ?? Math.random().toString(36).substr(2, 9)),
            name:      String(r.Run_Name ?? ''),
            comment:   String(r.Comment ?? ''),
            timestamp: String(r.Timestamp ?? ''),
            settings: {
              model:                    (r.Model ?? 'Holt Linear') as ForecastModel,
              preHorizonUncertainty:    Number(r.Pre_Horizon_Uncertainty_Pct    ?? 0),
              postHorizonExpansionRate: Number(r.Post_Horizon_Expansion_Rate_Pct ?? 0),
              confidenceHorizon:        Number(r.Confidence_Horizon_Months      ?? 3),
              forecastLength:           Number(r.Forecast_Length_Months         ?? 24),
            },
            cohortIds: String(r.Cohort_IDs ?? '').split('; ').filter(Boolean),
            generated: Number(r.Cohorts_Generated ?? 0),
            failed:    Number(r.Cohorts_Failed    ?? 0),
          })));
        }

        // ── Model Acceptance Log ──────────────────────────────────────────────
        const logRaw: any[] = XLSX.utils.sheet_to_json(wb.Sheets['Model_Acceptance_Log']);
        if (logRaw.length > 0 && !logRaw[0]?.Note) {
          setModelAcceptanceLog(logRaw.map(r => ({
            cohortKey:      String(r.Cohort_Key      ?? ''),
            previousModel:  String(r.Previous_Model  ?? ''),
            acceptedModel:  String(r.Accepted_Model  ?? ''),
            switchoverMonth: r.Switchover_Month ? String(r.Switchover_Month) : null,
            timestamp:      String(r.Date_of_Switch  ?? ''),
          })));
        }

        // ── Restore navigation & show banner ─────────────────────────────────
        const validViews: Array<'home' | 'standard' | 'whatif' | 'overall' | 'vsactuals'> =
          ['home', 'standard', 'whatif', 'overall', 'vsactuals'];
        setActiveView(validViews.includes(activeStepRaw as any) ? (activeStepRaw as any) : 'home');
        setImportSaveResult({ success: true, timestamp: exportTimestamp });

      } catch (err) {
        console.error('[ImportSave] Error:', err);
        setImportSaveResult({
          success: false,
          error: 'Failed to parse the file — ensure it is a valid PROSPECT save (.xlsx).',
        });
      }
    };
    reader.readAsArrayBuffer(file);
  };

  // NOTE: exportToExcel was deleted here on 2026-07-31. It was dead code —
  // declared, never invoked, not exported. The live export is exportSession
  // (the 7-sheet save-point) reached via openExportModal. Its key parser still
  // assumed the old 4/5-part format and misparsed the 9-part keys the app has
  // written since Product L2 and tariff landed; see EXPECTED.md. Do not
  // reinstate it — build on exportSession.

  const [overallSegmentFilter, setOverallSegmentFilter] = useState('All');
  const [overallProductFilter, setOverallProductFilter] = useState('All');
  const [overallChannelFilter, setOverallChannelFilter] = useState('All');
  const [overallTypeFilter, setOverallTypeFilter] = useState('All');
  const [overallScenarioFilter, setOverallScenarioFilter] = useState('All');
  const [overallStatusFilter, setOverallStatusFilter] = useState('All');
  const [vsActualsSegmentFilter, setVsActualsSegmentFilter] = useState('All');
  const [vsActualsProductFilter, setVsActualsProductFilter] = useState('All');
  const [vsActualsChannelFilter, setVsActualsChannelFilter] = useState('All');
  const [vsActualsForecastTypeFilter, setVsActualsForecastTypeFilter] = useState('All');
  const [vsActualsScenarioFilter, setVsActualsScenarioFilter] = useState('All');
  const [vsActualsWindowSize, setVsActualsWindowSize] = useState(12);
  const [vsActualsWindowOffset, setVsActualsWindowOffset] = useState(0);
  const [vsActualsShowOnlyComparable, setVsActualsShowOnlyComparable] = useState(false);
  const [workbookSheets, setWorkbookSheets] = useState<Record<string, any[]>>({});
  const [actualsSheet, setActualsSheet] = useState<string>('');
  const [forecastsSheet, setForecastsSheet] = useState<string>('');
  const [dataTypeCol, setDataTypeCol] = useState('');
  const [actualValue, setActualValue] = useState('');
  const [forecastValue, setForecastValue] = useState('');
  const [generatingCohort, setGeneratingCohort] = useState<any | null>(null);
  const [viewingCohort, setViewingCohort] = useState<any | null>(null);
  const [genPreHorizonUncertainty, setGenPreHorizonUncertainty] = useState(2.0);
  const [genPostHorizonExpansionRate, setGenPostHorizonExpansionRate] = useState(5.0);
  const [genLength] = useState(24);
  const [genInflowUplift, setGenInflowUplift] = useState(0);
  const [genInflowLag, setGenInflowLag] = useState(0);
  const [genRetentionUplift, setGenRetentionUplift] = useState(0);
  const [genRetentionLag, setGenRetentionLag] = useState(0);
  const [genArpuUplift, setGenArpuUplift] = useState(0);
  const [genManualOverrides, setGenManualOverrides] = useState<Record<string, number>>({});
  const [genMarketEvents, setGenMarketEvents] = useState<MarketEvent[]>([]);
  const [isGeneratingMissing, setIsGeneratingMissing] = useState(false);
  const [generationProgress, setGenerationProgress] = useState({ current: 0, total: 0 });

  // Ordered history of manual generations for the side panel.
  // Each manual run prepends a new entry (newest first), capped at 10.
  // Uses an array — NOT a keyed record — so regenerating the same cohort
  // with a different model adds a new row rather than overwriting the old one.
  // modelUsed is NULLABLE: a derived aggregate has no model, and a log that
  // records one would assert something false about its own history.
  const [cohortGenLog, setCohortGenLog] = useState<Array<{ cohortId: string; timestamp: string; modelUsed: ForecastModel | null }>>([]);

  // Append-only log of AutoML model switch events (written by acceptChallengerModel
  // and acceptAllChallengerModels); included in the session export.
  interface ModelAcceptanceRecord {
    cohortKey: string;
    previousModel: string;
    acceptedModel: string;
    switchoverMonth: string | null;
    timestamp: string;
  }
  const [modelAcceptanceLog, setModelAcceptanceLog] = useState<ModelAcceptanceRecord[]>([]);

  // Export filename modal state
  const [showExportModal, setShowExportModal] = useState(false);

  // Import Save result banner state
  const [importSaveResult, setImportSaveResult] = useState<{ success: boolean; timestamp?: string; error?: string } | null>(null);

  // ForecastContext state — owned here so App handlers can write to it
  const [baseForecast, setBaseForecast] = useState<BaseForecast | null>(null);
  const [adjustedForecast, setAdjustedForecast] = useState<MarketEventAdjustedForecast | null>(null);
  const [forecastUpdatedAt, setForecastUpdatedAt] = useState<string | null>(null);

  // Multi-forecast store: all generated forecasts keyed by "segment|product|channel"
  const [forecastStore, setForecastStore] = useState<Map<string, BaseForecast>>(new Map());

  // P10 — one-off historical event flags, keyed by the same 7-part cohort key
  // as forecastStore. Each flagged month's value is substituted (fitting-time
  // only, via substituteOneOffValue) before Holt-Winters ever sees it — the
  // real value shown in tables/exports/Actuals Review is always the one in
  // the file. Persisted in export via the One_Off_Months sheet.
  const [oneOffMonths, setOneOffMonths] = useState<Record<string, { month: string; reason: string }[]>>({});

  // Per-tab view filter — each step remembers its own last-used selection independently
  const [step2Filter, setStep2Filter] = useState<ViewFilter>({ segment: 'All', product: { l1: null, l2: null }, channel: { l1: null, l2: null } });
  const [step3Filter, setStep3Filter] = useState<ViewFilter>({ segment: 'All', product: { l1: null, l2: null }, channel: { l1: null, l2: null } });

  // Bulk generate modal state
  const [showBulkGeneratePrompt, setShowBulkGeneratePrompt] = useState(false);
  const [triggerBulkCheck, setTriggerBulkCheck] = useState(0);
  const [bulkSourceCohort, setBulkSourceCohort] = useState<{ segment: string; product: string; channel: string; scenario: string } | null>(null);
  // Bulk run history — persisted in ForecastContext
  const [bulkRuns, setBulkRuns] = useState<BulkRunRecord[]>([]);
  // Manage Bulk Generations drawer
  const [showManageBulkDrawer, setShowManageBulkDrawer] = useState(false);

  // Import Actuals state
  const [importActualsState, setImportActualsState] = useState<{
    rows: any[];
    months: { label: string; count: number; alreadyLoaded: boolean }[];
    detectedDateCol: string;
  } | null>(null);

  // New Market Event Form State
  const [newEvent, setNewEvent] = useState<Partial<MarketEvent>>({
    scenario: 'Inflow',
    segment: 'All',
    product: 'All',
    productL2: 'All',
    channel: 'All',
    channelL2: 'All',
    tariffL1: 'All',
    tariffL2: 'All',
    date: format(new Date(), 'yyyy-MM'),
    subscriberVolume: 0,
    customerVolume: 0,
    revenue: 0,
    arpu: 0,
    name: '',
    campaignName: '',
    comment: '',
    contractLength: 24,
  });

  // Selected tariffs for scenario work (Phase 2b) — none selected by default.
  // Constrains tariff targeting dropdowns and the tariff mix axis; persisted in export.
  const [selectedTariffs, setSelectedTariffs] = useState<string[]>([]);

  // Yield Events state
  const [yieldEvents, setYieldEvents] = useState<YieldEvent[]>([]);
  const [newYieldEvent, setNewYieldEvent] = useState<Partial<YieldEvent>>({
    ibro: 'Inflow',
    segment: 'All',
    product: 'All',
    channelL1: 'All',
    channelL2: 'All',
    month: format(new Date(), 'yyyy-MM'),
    tariffMix: {},
    tariffBaseArpu: {},
    rollForward: false,
    name: '',
    comment: '',
  });

  const addYieldEvent = (event: YieldEvent) => {
    setYieldEvents(prev => [...prev, event]);
  };

  const updateYieldEvent = (id: string, patch: Partial<YieldEvent>) =>
    updateById(setYieldEvents, id, patch);

  const removeYieldEvent = (id: string) => {
    setYieldEvents(prev => prev.filter(e => e.id !== id));
  };

  const clearAllYieldEvents = () => {
    setYieldEvents([]);
  };

  // Pricing Events state
  const [pricingEvents, setPricingEvents] = useState<PricingEvent[]>([]);
  const [newPricingEvent, setNewPricingEvent] = useState<Partial<PricingEvent>>({
    segment: 'All',
    product: 'All',
    productL2: 'All',
    channelL1: 'All',
    channelL2: 'All',
    tariffL1: 'All',
    tariffL2: 'All',
    month: format(new Date(), 'yyyy-MM'),
    inputMode: 'percentage',
    amount: 0,
    target: 'cohorts',
    duration: 'one-off',
    originalBaseArpu: 0,
    name: '',
    comment: '',
  });

  const addPricingEvent = (event: PricingEvent) => {
    setPricingEvents(prev => [...prev, event]);
  };

  const updatePricingEvent = (id: string, patch: Partial<PricingEvent>) =>
    updateById(setPricingEvents, id, patch);

  const removePricingEvent = (id: string) => {
    setPricingEvents(prev => prev.filter(e => e.id !== id));
  };

  const clearAllPricingEvents = () => {
    setPricingEvents([]);
  };

  // Auto-select columns on data load
  useEffect(() => {
    if (data.length > 0) {
      const match = (patterns: string[]) => {
        for (const p of patterns) {
          const cleanP = p.toLowerCase().replace(/[^a-z0-9]/g, '');
          const found = columns.find(c => c.toLowerCase().replace(/[^a-z0-9]/g, '').includes(cleanP));
          if (found) return found;
        }
        return undefined;
      };

      if (!dateCol) setDateCol(match(['date', 'time', 'period', 'month']) || columns[0] || '');
      if (!targetCol) setTargetCol(match(['subscriber', 'volume', 'value', 'measure', 'amount', 'total', 'base', 'revenue']) || columns[1] || '');
      if (!segmentCol) setSegmentCol(match(['segment', 'category', 'region']) || '');
      if (!productCol) setProductCol(match(['product', 'item', 'sku', 'service']) || '');
      if (!channelCol) setChannelCol(match(['channel', 'source', 'platform']) || '');

      if (!wiDateCol) setWiDateCol(match(['date', 'time', 'period', 'month']) || columns[0] || '');
      if (!wiMetricCol) setWiMetricCol(match(['ibro', 'scenario', 'type', 'metric', 'dimension', 'kpi', 'indicator']) || columns[1] || '');
      if (!wiValueCol) setWiValueCol(match(['subscriber', 'volume', 'subs', 'value', 'measure', 'amount', 'total']) || columns[2] || columns[1] || '');
      if (!wiCustomerCol) setWiCustomerCol(match(['customer', 'cust', 'account']) || '');
      if (!wiRevenueCol) setWiRevenueCol(match(['revenue', 'gbp', 'monthly']) || '');
      if (!wiArpuCol) setWiArpuCol(match(['arpu', 'average revenue', 'revenue per']) || '');
      if (!wiSegmentCol) setWiSegmentCol(match(['segment', 'category', 'region']) || '');
      if (!wiProductCol) setWiProductCol(match(['product_l1', 'product level 1', 'productlevel1', 'product', 'item', 'sku']) || '');
      if (!wiProductL2Col) setWiProductL2Col(match(['product_l2', 'product level 2', 'productlevel2', 'product_sub', 'productsub']) || '');
      if (!wiChannelCol) setWiChannelCol(match(['channel_l1', 'channel level 1', 'channellevel1', 'channel', 'source', 'platform']) || '');
      if (!wiChannelL2Col) setWiChannelL2Col(match(['channel_l2', 'channel level 2', 'channellevel2', 'channel_sub', 'channelsub']) || '');
      // Tariff (Phase 2a) — real data column is `tariff_tier_l1/l2`; also match `tariff_l1` and spaced variants.
      // Specific L1/L2 patterns only (no bare 'tariff') so L1 and L2 never cross-match.
      if (!wiTariffL1Col) setWiTariffL1Col(match(['tariff_tier_l1', 'tariff tier l1', 'tariff_l1', 'tariff level 1', 'tarifflevel1']) || '');
      if (!wiTariffL2Col) setWiTariffL2Col(match(['tariff_tier_l2', 'tariff tier l2', 'tariff_l2', 'tariff level 2', 'tarifflevel2']) || '');
      if (!dataTypeCol) setDataTypeCol(match(['datatype', 'isforecast', 'type', 'status']) || '');
    }
  }, [data, columns]);

  useEffect(() => {
    if (data.length > 0 && wiMetricCol) {
      const uniqueMetrics = Array.from(new Set(data.map(r => String(r[wiMetricCol])).filter(v => v && v !== 'undefined'))).sort();
      
      const match = (pattern: string) => uniqueMetrics.find((m: string) => m.toLowerCase().includes(pattern.toLowerCase()));

      if (!wiInflowVal) setWiInflowVal(match('inflow') || '');
      if (!wiOutflowVal) setWiOutflowVal(match('outflow') || '');
      if (!wiBaseVal) setWiBaseVal(match('base') || '');
      if (!wiRetentionVal) setWiRetentionVal(match('retention') || '');
    }
  }, [data, wiMetricCol]);

  useEffect(() => {
    if (data.length > 0 && dataTypeCol) {
      const uniqueTypes = Array.from(new Set(data.map(r => String(r[dataTypeCol])).filter(v => v && v !== 'undefined'))).sort();
      
      const match = (pattern: string) => uniqueTypes.find((m: string) => m.toLowerCase().includes(pattern.toLowerCase()));

      if (!actualValue) setActualValue(match('actual') || '');
      if (!forecastValue) setForecastValue(match('forecast') || '');
    }
  }, [data, dataTypeCol]);

  // ---------------------------------------------------------------------------
  // Forecast store helpers
  // ---------------------------------------------------------------------------

  /**
   * Stable 7-part key for a cohort — used by forecastStore and per-tab filters.
   * Format: seg|prodL1|prodL2|chanL1|chanL2|tariffL1|tariffL2
   *
   * Tariff L1/L2 are APPENDED to the end (Phase 2a) so that every consumer that
   * reads parts[0..4] positionally keeps working unchanged; only tariff-aware
   * readers touch parts[5]/parts[6]. Absent tariff (old saves, or data without a
   * tariff column) defaults to 'All', preserving backward compatibility.
   * 'All' is used for any dimension that is unfiltered.
   */
  /**
   * Rebuild a Provenance from an exported row (option C).
   *
   * `Provenance` empty or absent => the file predates the column, and every
   * forecast in such a file was fitted. `Model_Used` empty on a derived row is
   * deliberate and must stay empty: defaulting it to a model name here is the
   * exact silent relabelling this phase removes.
   */
  const readProvenance = (row: Record<string, any>): Provenance => {
    const kind = String(row.Provenance ?? '').trim() || 'fitted';
    if (kind === 'derived') {
      return {
        kind: 'derived',
        leafCount: Number(row.Leaf_Count ?? 0),
        models: {},
        coverage: { inScope: 0, withForecast: 0, skipped: [] },
      };
    }
    const modelUsed = (String(row.Model_Used ?? '').trim() || 'Holt Linear') as ForecastModel;
    if (kind === 'accepted') {
      return {
        kind: 'accepted', modelUsed,
        replacedModel: (String(row.Replaced_Model ?? '').trim() || modelUsed) as ForecastModel,
        acceptedAt: String(row.Accepted_At ?? ''),
      };
    }
    return { kind: 'fitted', modelUsed };
  };

  // Delegates to the shared builder. Kept as a local name so the ~40 call
  // sites in this file are untouched, but there is now ONE format.
  const makeForecastKey = sharedMakeForecastKey;

  /**
   * P10 — flagged one-off months for a cohort, as a Set ready for
   * calculateBaseForecast/applyOneOffFlagsToSeries. Returns undefined (not an
   * empty Set) when there are no flags, so every existing call site that
   * doesn't pass this argument continues to behave byte-identically.
   */
  const getOneOffFlagsForCohort = (c: {
    segment: string; product: string; productL2?: string | null;
    channel: string; channelL2?: string | null;
    tariffL1?: string | null; tariffL2?: string | null;
  }): Set<string> | undefined => {
    const key = makeForecastKey(c.segment, c.product, c.productL2, c.channel, c.channelL2, c.tariffL1, c.tariffL2);
    const flags = oneOffMonths[key];
    return flags && flags.length > 0 ? new Set(flags.map(f => f.month)) : undefined;
  };

  // Delegates. Extracted to utils/viewFilter so a spec can drive a navigation
  // SEQUENCE without transcribing the conversion into itself.

  /**
   * Populated cohort keys AND the leaves behind each one.
   *
   * One memo, one walk of the data, because they are the same walk: expanding a
   * leaf into its 54 roll-ups is exactly what tells you which leaves a roll-up
   * has. Building them separately would be two enumerations of one fact, which
   * is how they drift.
   */
  const populatedCohorts = useMemo(() => {
    if (!data.length || !wiDateCol) return { set: new Set<string>(), leafMap: new Map<string, string[]>() };
    const dm = buildCohortDataMap(data, wiDateCol, wiSegmentCol, wiProductCol, wiProductL2Col, wiChannelCol, wiChannelL2Col, wiTariffL1Col, wiTariffL2Col);
    // The walk itself lives in forecasting.ts so a spec can drive it. It used
    // to be inline here, where the only way to test it was to transcribe it -
    // and a transcribed copy pins itself, not this.
    return buildRollUpIndex(dm.keys());
  }, [data, wiDateCol, wiSegmentCol, wiProductCol, wiProductL2Col, wiChannelCol, wiChannelL2Col, wiTariffL1Col, wiTariffL2Col]);

  // True if a cohort has data. Empty set (no data mapped yet) ⇒ don't filter.
  const populatedCohortKeys = populatedCohorts.set;

  const cohortHasData = useCallback(
    (c: any): boolean => populatedCohortKeys.size === 0
      || populatedCohortKeys.has(makeForecastKey(c.segment, c.product, c.productL2, c.channel, c.channelL2, c.tariffL1, c.tariffL2)),
    [populatedCohortKeys],
  );

  /**
   * THE seam. Every reader of a forecast by key goes through this.
   *
   *   stored               -> the stored fit, verbatim
   *   miss, aggregate key  -> derived from the leaves in scope
   *   miss, leaf key       -> null, with the reason available
   *
   * NOT cached. Worst case is ~204k float operations, which is sub-frame, and
   * a cache would reintroduce the invalidation problem that decided read-time
   * over write-time in the first place. If this ever needs a cache, that is a
   * measurement to take, not an assumption to act on.
   */
  const resolveForecast = useCallback((key: string): {
    forecast: BaseForecast | null;
    reason: SkipReason | null;
  } => {
    // Delegates to the pure seam so this closure and the session-import path
    // cannot drift. See resolveFromStore for why it is not inlined here.
    return resolveFromStore(forecastStore, populatedCohorts.leafMap, key);
  }, [forecastStore, populatedCohorts]);

  /**
   * Can a key produce a forecast at all - stored OR derivable?
   *
   * Replaces bare `forecastStore.has(key)` at the indicator sites, which said
   * "no forecast" for a cohort that derivation can serve, contradicting what
   * the screen then showed.
   *
   * Deliberately does NOT derive: it answers reachability, and deriving to
   * answer a yes/no question would put real work behind an indicator.
   */
  const canResolve = useCallback((key: string): boolean => {
    // Same rule as resolveForecast: a retired aggregate fit is not a hit. The
    // indicator must agree with the seam, or it says "forecast loaded" for a
    // key the seam declines to return.
    const hit = forecastStore.get(key);
    if (hit && !isRetiredAggregateFit(key, hit)) return true;
    const leafKeys = populatedCohorts.leafMap.get(key) ?? [];
    return leafKeys.some(k => forecastStore.has(k));
  }, [forecastStore, populatedCohorts]);

  /** Build a ViewFilter from a CohortKey (for syncing tab filter bars after generation) */
  // Delegates — see utils/viewFilter.

  /**
   * Step 1's own selection, as a ViewFilter.
   *
   * Step 1 keeps its selection in separate pieces of state using two sentinels
   * the rest of the app does not: 'All (Aggregated)' for an aggregated L1, and
   * '' for an unset L2. Converting once, here, is what lets Step 1 use
   * `filterToKey` and the roll-up index like every other consumer instead of
   * building keys its own way — which is how Step 1 came to have a separate
   * notion of a cohort in the first place.
   */
  const stdSelectionFilter = useMemo<ViewFilter>(() => ({
    segment: segmentValue === 'All (Aggregated)' ? 'All' : segmentValue,
    product: { l1: productValue === 'All (Aggregated)' ? null : productValue || null,
               l2: productL2Value || null },
    channel: { l1: channelValue === 'All (Aggregated)' ? null : channelValue || null,
               l2: channelL2Value || null },
    tariff:  { l1: tariffValue === 'All (Aggregated)' ? null : tariffValue || null,
               l2: tariffL2Value || null },
  }), [segmentValue, productValue, productL2Value, channelValue, channelL2Value, tariffValue, tariffL2Value]);

  /**
   * What the Step 1 generate button should say, and whether it should act.
   *
   * Four states, and the two zero-missing ones are NOT the same:
   *   'leaf'          — an ordinary cohort selection; manual generation, unchanged.
   *   'generate'      — an aggregate with N leaves still to fit.
   *   'covered'       — an aggregate whose leaves are all present already.
   *   'never'         — an aggregate this data cannot produce at all.
   * 'covered' and 'never' both have missing.length === 0 and mean opposite
   * things; collapsing them is the degenerate case these states exist to keep
   * apart, and a button reading "generate 0" would be both wrong and unhelpful.
   */
  /**
   * Leaves a run has PROVED cannot be fitted, accumulated across runs.
   *
   * Unfittability is only knowable by trying, so this starts empty and a leaf
   * counts as generatable until a run says otherwise. It is additive and never
   * cleared by a later run: a leaf with two months of history does not acquire
   * more history because something else was generated, and forgetting would
   * put the button straight back to offering a generate that does nothing.
   * A new upload replaces `data`, which is when it should reset - see the
   * effect below.
   */
  const [unfittableLeaves, setUnfittableLeaves] = useState<ReadonlySet<string>>(new Set());

  /**
   * Does the Step 1 selection aggregate over a dimension that is actually MAPPED?
   *
   * TWO corrections in one, and they were two copies of the same predicate -
   * one in the button's state machine, one in the generate handler. Copies that
   * must agree about what the button offers and what the click does; this is
   * now the single source both read.
   *
   * MAPPED is the load-bearing word. Every one of these four defaults to
   * 'All (Aggregated)', so an unmapped dimension left at its default made every
   * selection look aggregated - and a genuine leaf then fell into the
   * All-selection state machine, where a fully-fitted scope reads `covered` and
   * DISABLES the button. A leaf whose forecast already exists became
   * un-regenerable, which is not what the four states were designed for: they
   * describe filling an aggregate's missing leaves, and a leaf selection keeps
   * the manual Generate Forecast, regeneration included.
   *
   * An 'All' in an unmapped dimension is not an aggregate - it is a dimension
   * this dataset does not have. That is the same marker-meaning distinction the
   * legacy import site and the retirement rule already turn on, now in a fourth
   * place, which is why EXPECTED.md queues a single mapped-dimension source of
   * truth to the DQ phase rather than a fifth private answer.
   */
  const stdAggregatesMappedDim = useMemo(() => (
    (!!wiSegmentCol  && segmentValue === 'All (Aggregated)') ||
    (!!wiProductCol  && productValue === 'All (Aggregated)') ||
    (!!wiChannelCol  && channelValue === 'All (Aggregated)') ||
    (!!wiTariffL1Col && tariffValue  === 'All (Aggregated)')
  ), [wiSegmentCol, wiProductCol, wiChannelCol, wiTariffL1Col,
      segmentValue, productValue, channelValue, tariffValue]);

  const stdAggregateState = useMemo(() => {
    if (!stdAggregatesMappedDim) return { kind: 'leaf' as const, missing: 0, total: 0, unfittable: 0 };
    const { enumerated, missing, leaves, unfittable } = missingLeavesForKey(
      filterToKey(stdSelectionFilter), populatedCohorts.leafMap, forecastStore, unfittableLeaves,
    );
    if (!enumerated) return { kind: 'never' as const, missing: 0, total: 0, unfittable: 0 };
    if (missing.length > 0) {
      return { kind: 'generate' as const, missing: missing.length, total: leaves.length,
               unfittable: unfittable.length };
    }
    // Zero generatable leaves. Which of the two zero states this is depends on
    // whether anything is KNOWN unfittable — "covered" claims the scope is
    // fully forecast, which is false when leaves are missing and cannot be
    // fitted. A blocked scope is not an invitation, so the button says so
    // instead of offering a generate that would produce nothing.
    if (unfittable.length > 0) {
      return { kind: 'blocked' as const, missing: 0, total: leaves.length,
               unfittable: unfittable.length };
    }
    return { kind: 'covered' as const, missing: 0, total: leaves.length, unfittable: 0 };
  }, [stdAggregatesMappedDim, stdSelectionFilter,
      populatedCohorts, forecastStore, unfittableLeaves]);

  /**
   * THE OVERALL DOOR'S STATE — the same function, at the root scope.
   *
   * Not a parallel definition of "missing": literally `missingLeavesForKey`, the
   * one Session J introduced (a51ec8e), called with the all-'All' key. The
   * Overall door IS the Step 1 door with the widest possible scope, so it gets
   * the same four states from the same call and cannot drift from it.
   *
   * WHAT THIS REPLACED, and why it was a defect rather than a different opinion.
   * The door previously read `missingStandardCohorts`, whose definition is
   * has-no-forecast over the FULL cohort cross-product (`ec3c79a`, 2026-07-30).
   * That population includes All-bearing combinations and multiplies every key
   * by four scenario rows. Measured on the edge fixture with all 72 fittable
   * leaves already fitted, it offered 144 "combinations": 36 distinct keys x 4
   * scenarios, of which 34 keys were AGGREGATES and 2 were the known-unfittable
   * leaves. The 34 were the aggregates whose entire leaf population is those two
   * short leaves, so nothing under them could ever resolve.
   *
   * Every one of those 144 failed on every run, nothing recorded them as known
   * unfittable, and the count never moved — Session J's no-exit loop exactly,
   * on the one surface J did not touch (a51ec8e changed App.tsx and
   * StandardForecastTab.tsx; OverallForecastTab.tsx is not in that diff).
   *
   * Aggregates are not missing. They derive at read time, and offering to
   * generate one is offering work the engine is right to decline.
   */
  const overallDoorState = useMemo(() => {
    const rootKey = makeForecastKey('All', 'All', 'All', 'All', 'All', 'All', 'All');
    const { enumerated, missing, leaves, unfittable } = missingLeavesForKey(
      rootKey, populatedCohorts.leafMap, forecastStore, unfittableLeaves,
    );
    if (!enumerated) return { kind: 'never' as const, missing: 0, total: 0, unfittable: 0, keys: [] as string[] };
    if (missing.length > 0) {
      return { kind: 'generate' as const, missing: missing.length, total: leaves.length,
               unfittable: unfittable.length, keys: missing };
    }
    // The two zero states are not one state. A book whose remaining leaves
    // cannot be fitted is BLOCKED, not covered, and saying "covered" would be
    // the old lie relocated.
    if (unfittable.length > 0) {
      return { kind: 'blocked' as const, missing: 0, total: leaves.length,
               unfittable: unfittable.length, keys: [] as string[] };
    }
    return { kind: 'covered' as const, missing: 0, total: leaves.length, unfittable: 0, keys: [] as string[] };
  }, [populatedCohorts, forecastStore, unfittableLeaves, makeForecastKey]);

  /** The canonical missing set, leaf grain. Every count and every door reads this. */
  const missingFittableLeafKeys = useMemo(
    () => new Set(overallDoorState.keys), [overallDoorState]);

  /**
   * How many aggregate views this book covers by DERIVATION rather than by a fit.
   *
   * Stated so the Overall view has something true to say where it used to report
   * aggregates as failures. Derivation is how aggregates are supposed to work;
   * a surface that calls it "could not be forecast" is describing the design as
   * a fault.
   */
  const derivedAggregateCount = useMemo(() => {
    let n = 0;
    for (const [key, leafKeys] of populatedCohorts.leafMap.entries()) {
      if (!isAllBearing(key)) continue;
      if (leafKeys.some(k => forecastStore.has(k))) n++;
    }
    return n;
  }, [populatedCohorts, forecastStore]);

  /**
   * Transient generation feedback is cleared when the SELECTION changes.
   *
   * "Not enough valid data points" is true of the cohort it was raised for and
   * false of every other one. It was set and never cleared, so it followed the
   * user across selections and onto unrelated screens, describing a cohort they
   * had left. An error that outlives its subject stops being information and
   * starts being furniture - and the honest empty state underneath it took the
   * blame for the banner sitting on top.
   *
   * The last run's result panel goes with it, for the same reason: a list of
   * skipped leaves belongs to the scope it was produced for.
   *
   * Keyed on the selection only. A generate raises its error with the selection
   * unchanged, so this cannot wipe the message it just produced.
   */
  useEffect(() => {
    setError('');
    setNotice('');
    setStdGenerateResult(null);
  }, [segmentValue, productValue, productL2Value, channelValue, channelL2Value,
      tariffValue, tariffL2Value]);

  /**
   * A new upload is a new set of facts. Leaves proved unfittable against the
   * old file say nothing about this one, and carrying them over would suppress
   * generation for cohorts that may now have history.
   *
   * SESSION RESTORE RESETS THIS TOO, deliberately: restore replaces `data`, so
   * this effect fires. The consequence is worth stating because it is visible
   * on screen — after a restore the two short-history leaves in the edge
   * fixture count as fittable-MISSING again, so the button offers them and a
   * run re-proves them unfittable. That is the correct trade. Unfittability is
   * a property of the data, the restored file's data is what was just loaded,
   * and the alternative — persisting the set into the save file — would carry a
   * claim about a fit forward past the moment it was measured, which is what
   * provenance discipline exists to prevent.
   */
  useEffect(() => {
    setUnfittableLeaves(new Set());
  }, [data]);

  /** Distinct segment values from the uploaded dataset. */
  const availableSegments = useMemo(
    () => wiSegmentCol
      ? Array.from(new Set(data.map(r => String(r[wiSegmentCol]).trim()).filter(v => v && v !== 'undefined'))).sort()
      : [],
    [data, wiSegmentCol],
  );

  /**
   * Product hierarchy: L1 → sorted L2 children.
   * Used by ViewFilterBar's HierarchicalDropdown.
   */
  const productTree = useMemo<Map<string, string[]>>(() => {
    if (!wiProductCol) return new Map();
    const tree = new Map<string, string[]>();
    data.forEach(r => {
      const l1 = String(r[wiProductCol] || '').trim();
      if (!l1 || l1 === 'undefined') return;
      if (!tree.has(l1)) tree.set(l1, []);
      if (wiProductL2Col) {
        const l2 = String(r[wiProductL2Col] || '').trim();
        if (l2 && l2 !== 'undefined' && l2 !== 'All' && !tree.get(l1)!.includes(l2)) {
          tree.get(l1)!.push(l2);
        }
      }
    });
    // Sort children within each L1 node
    for (const children of tree.values()) children.sort();
    return tree;
  }, [data, wiProductCol, wiProductL2Col]);

  /**
   * Channel hierarchy: L1 → sorted L2 children.
   * Used by ViewFilterBar's HierarchicalDropdown.
   */
  const channelTree = useMemo<Map<string, string[]>>(() => {
    if (!wiChannelCol) return new Map();
    const tree = new Map<string, string[]>();
    data.forEach(r => {
      const l1 = String(r[wiChannelCol] || '').trim();
      if (!l1 || l1 === 'undefined') return;
      if (!tree.has(l1)) tree.set(l1, []);
      if (wiChannelL2Col) {
        const l2 = String(r[wiChannelL2Col] || '').trim();
        if (l2 && l2 !== 'undefined' && l2 !== 'All' && !tree.get(l1)!.includes(l2)) {
          tree.get(l1)!.push(l2);
        }
      }
    });
    for (const children of tree.values()) children.sort();
    return tree;
  }, [data, wiChannelCol, wiChannelL2Col]);

  /**
   * Tariff hierarchy (Phase 2a): L1 → sorted L2 children.
   * Data-driven — cardinality is read entirely from the data, never hardcoded.
   * Used by ViewFilterBar's HierarchicalDropdown as the 4th dimension.
   */
  const tariffTree = useMemo<Map<string, string[]>>(() => {
    if (!wiTariffL1Col) return new Map();
    const tree = new Map<string, string[]>();
    data.forEach(r => {
      const l1 = String(r[wiTariffL1Col] || '').trim();
      if (!l1 || l1 === 'undefined') return;
      if (!tree.has(l1)) tree.set(l1, []);
      if (wiTariffL2Col) {
        const l2 = String(r[wiTariffL2Col] || '').trim();
        if (l2 && l2 !== 'undefined' && l2 !== 'All' && !tree.get(l1)!.includes(l2)) {
          tree.get(l1)!.push(l2);
        }
      }
    });
    for (const children of tree.values()) children.sort();
    return tree;
  }, [data, wiTariffL1Col, wiTariffL2Col]);

  // Phase 3 P4 — trailing 3-month cohort-average ARPU for the event currently being
  // drafted in the What-If form. Recomputed whenever the draft's own dimensions or
  // scenario change. Only meaningful for Inflow/Retention (the two scenarios that
  // create an ARPU-bearing subscriber pool) — null otherwise or when there's no
  // matching history, so the form shows no placeholder rather than a fabricated 0.
  const cohortAvgArpu = useMemo<number | null>(() => {
    if (newEvent.scenario !== 'Inflow' && newEvent.scenario !== 'Retention') return null;
    const metricValue = newEvent.scenario === 'Inflow' ? wiInflowVal : wiRetentionVal;
    if (!metricValue) return null;
    return computeCohortTrailingArpu(
      { data, wiDateCol, wiMetricCol, wiValueCol, wiRevenueCol, wiArpuCol, wiSegmentCol, wiProductCol, wiProductL2Col, wiChannelCol, wiChannelL2Col, wiTariffL1Col, wiTariffL2Col },
      metricValue,
      {
        segment: newEvent.segment, product: newEvent.product, productL2: newEvent.productL2,
        channel: newEvent.channel, channelL2: newEvent.channelL2, tariffL1: newEvent.tariffL1, tariffL2: newEvent.tariffL2,
      },
    );
  }, [data, wiDateCol, wiMetricCol, wiValueCol, wiRevenueCol, wiArpuCol, wiSegmentCol, wiProductCol, wiProductL2Col, wiChannelCol, wiChannelL2Col, wiTariffL1Col, wiTariffL2Col, wiInflowVal, wiRetentionVal, newEvent.scenario, newEvent.segment, newEvent.product, newEvent.productL2, newEvent.channel, newEvent.channelL2, newEvent.tariffL1, newEvent.tariffL2]);

  /** Handle ViewFilterBar change on Step 2 — loads the matching forecast (if any). */
  const handleStep2FilterChange = useCallback((filter: ViewFilter) => {
    setStep2Filter(filter);
    // Routes through the seam. The old `if (bf !== undefined)` had NO else, so a
    // miss silently RETAINED the previous cohort's forecast - the screen changed
    // its label and kept its numbers. Now: stored fit, or derived from the
    // leaves in scope, or explicitly nothing.
    const { forecast } = resolveForecast(filterToKey(filter));
    setBaseForecast(forecast);
    setAdjustedForecast(null);
  }, [resolveForecast]); // eslint-disable-line react-hooks/exhaustive-deps

  /** Handle ViewFilterBar change on Step 3 — loads the matching forecast (if any). */
  const handleStep3FilterChange = useCallback((filter: ViewFilter) => {
    setStep3Filter(filter);
    // Routes through the seam. The old `if (bf !== undefined)` had NO else, so a
    // miss silently RETAINED the previous cohort's forecast - the screen changed
    // its label and kept its numbers. Now: stored fit, or derived from the
    // leaves in scope, or explicitly nothing.
    const { forecast } = resolveForecast(filterToKey(filter));
    setBaseForecast(forecast);
    setAdjustedForecast(null);
  }, [resolveForecast]); // eslint-disable-line react-hooks/exhaustive-deps

  /** When switching tabs, restore the appropriate per-tab forecast. */
  useEffect(() => {
    // Same correction on the tab-restore path: a miss used to leave whichever
    // cohort was last loaded in place, so switching tabs could show Step 3 a
    // forecast belonging to Step 2's filter.
    // Delegates to forecastForView so the Step 3 tripwire can DRIVE this
    // transition instead of modelling it - see utils/viewFilter.
    const r = forecastForView(activeView, step2Filter, step3Filter, resolveForecast as any);
    if (r.owns) setBaseForecast(r.forecast as any);
  }, [activeView]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 50 * 1024 * 1024) {
      setError('File size exceeds 50MB limit.');
      return;
    }

    setIsLoading(true);
    setError('');
    setDateCol('');
    setTargetCol('');
    setSegmentCol('');
    setProductCol('');
    setWiDateCol('');
    setWiMetricCol('');
    setWiValueCol('');
    setWiRevenueCol('');
    setWiSegmentCol('');
    setWiProductCol('');
    setWiProductL2Col('');
    setWiChannelCol('');
    setWiChannelL2Col('');
    setActualsSheet('');
    setForecastsSheet('');
    setWorkbookSheets({});
    setDataTypeCol('');
    setActualValue('');
    setForecastValue('');
    setWiInflowVal('');
    setWiOutflowVal('');
    setWiBaseVal('');
    setWiRetentionVal('');

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const buffer = evt.target?.result;
        const wb = XLSX.read(buffer, { type: 'array', cellDates: true });
        
        const sheetsData: Record<string, any[]> = {};
        wb.SheetNames.forEach(name => {
          sheetsData[name] = XLSX.utils.sheet_to_json(wb.Sheets[name]);
        });
        setWorkbookSheets(sheetsData);

        const actualsName = wb.SheetNames.find(n => n.toLowerCase() === 'actuals') || wb.SheetNames[0];
        const forecastsName = wb.SheetNames.find(n => n.toLowerCase() === 'forecasts' || n.toLowerCase() === 'forecast') || '';

        setActualsSheet(actualsName);
        setForecastsSheet(forecastsName);

        const jsonData = sheetsData[actualsName];

        if (!jsonData || jsonData.length === 0) {
          setError('The actuals sheet is empty.');
          setIsLoading(false);
          return;
        }

        const cols = Object.keys(jsonData[0] as object);
        setColumns(cols);
        setData(jsonData);
        
        setError('');
        setForecastData([]);

        // Restore market events if the file contains a Market_Events sheet
        const eventsSheetName = wb.SheetNames.find(n => n.toLowerCase() === 'market_events');
        if (eventsSheetName && sheetsData[eventsSheetName]?.length > 0) {
          const restoredEvents: MarketEvent[] = sheetsData[eventsSheetName].map((r: any) => {
            const scen = String(r['Scenario'] || 'Inflow') as MarketEvent['scenario'];
            const isOut = scen === 'Outflow';
            const neg = (v: number) => isOut ? -Math.abs(v) : v;
            return {
              id: Math.random().toString(36).substr(2, 9),
              name: String(r['Name'] || ''),
              // Legacy fallback: pre-campaign saves used Name as the grouping label
              campaignName: String(r['Campaign_Name'] || r['Name'] || ''),
              scenario: scen,
              segment: String(r['Segment'] || 'All'),
              product: String(r['Product'] || 'All'),
              productL2: String(r['Product_L2'] || 'All'),
              channel: String(r['Channel'] || 'All'),
              channelL2: String(r['Channel_L2'] || 'All'),
              tariffL1: String(r['Tariff_L1'] || 'All'),
              tariffL2: String(r['Tariff_L2'] || 'All'),
              date: String(r['Date'] || r['Start_Month'] || ''),
              subscriberVolume: neg(Number(r['Subscriber_Volume']) || 0),
              customerVolume:   neg(Number(r['Customer_Volume'])   || 0),
              revenue:          neg(Number(r['Revenue'])           || 0),
              arpu:             neg(Number(r['ARPU'])              || 0),
              comment: String(r['Comment'] || ''),
              contractLength: Number(r['Contract_Length'] || r['Contract_Length_Months']) || 24,
              sequence: r['Sequence'] !== undefined && r['Sequence'] !== '' ? Number(r['Sequence']) : undefined as any,
              // THE GAP THIS FIXES. The comment that used to sit here recorded
              // that the promo fields were missing from this route and named it
              // a pre-existing gap — correctly, and it stayed missing. Both
              // routines now read the SAME function, so a field added to the
              // promo card reaches both or neither.
              ...readStoredEventModifiers(r),
            };
          });
          setMarketEvents(backfillSequences(restoredEvents));
        }
      } catch (err) {
        console.error(err);
        setError('Error reading Excel file. Please ensure it is a valid .xlsx or .xls file.');
      } finally {
        setIsLoading(false);
      }
    };
    reader.onerror = () => {
      setError('Failed to read file.');
      setIsLoading(false);
    };
    reader.readAsArrayBuffer(file);
    e.target.value = '';
  };

  // Loads a previously saved cohort's forecast data into the chart and sets
  // the filter controls to match, without re-running the model.
  const onSelectCohort = useCallback((cohortId: string) => {
    // cohortId formats, all ending in |type|scenario:
    //   9-part dims: seg|prodL1|prodL2|chanL1|chanL2|tariffL1|tariffL2|type|scen
    //   7-part dims: seg|prodL1|prodL2|chanL1|chanL2|type|scen (pre-tariff)
    //   5-part dims: seg|prod|chan|type|scen (legacy)
    // Parse robustly by peeling type + scenario off the END, then read the
    // dimension tuple by its length — never by a fixed positional index.
    const parts = cohortId.split('|');
    const scen = parts[parts.length - 1];
    const dims = parts.slice(0, parts.length - 2); // drop type + scenario
    let seg = 'All', prod = 'All', prodL2 = 'All', chan = 'All', chanL2 = 'All', tarL1 = 'All', tarL2 = 'All';
    if (dims.length >= 7) {
      [seg, prod, prodL2, chan, chanL2, tarL1, tarL2] = dims;
    } else if (dims.length === 5) {
      [seg, prod, prodL2, chan, chanL2] = dims;
    } else {
      // legacy 3-part: seg|prod|chan
      [seg, prod, chan] = dims;
    }
    setSegmentValue(seg === 'All' ? 'All (Aggregated)' : seg);
    setProductValue(prod === 'All' ? 'All (Aggregated)' : prod);
    setProductL2Value(prodL2 === 'All' ? '' : prodL2);
    setChannelValue(chan === 'All' ? 'All (Aggregated)' : chan);
    setChannelL2Value(chanL2 === 'All' ? '' : chanL2);
    setTariffValue(tarL1 === 'All' ? 'All (Aggregated)' : tarL1);
    setTariffL2Value(tarL2 === 'All' ? '' : tarL2);
    setStdScenario(scen || 'Inflow');
    const saved = savedForecasts[cohortId];
    if (saved) setForecastData(saved);
  }, [savedForecasts]);

  /** What the last scoped leaf run produced — surfaced on Step 1, see the call site. */
  const [stdGenerateResult, setStdGenerateResult] = useState<
    { generated: number; skipped: string[] } | null>(null);

  /** The aggregate a just-finished scoped run should display, or null. */
  const [pendingAggregateKey, setPendingAggregateKey] = useState<string | null>(null);

  /**
   * A scoped run WAITING FOR CONFIRMATION - not one that already happened.
   *
   * This replaced `bulkCompletedRun` on 2026-08-08. That state carried a
   * FINISHED run into the modal so it could open straight at its completion
   * panel; the pivot is that no multi-leaf run starts before the user has seen
   * the settings it will use, so what travels now is the intent to run.
   *
   * `leafKeys` is resolved at click time, from the selection the user is
   * looking at. Carrying the keys rather than re-deriving them at confirm
   * means the run cannot silently widen if the selection changes underneath an
   * open modal.
   */
  const [pendingScopedRun, setPendingScopedRun] = useState<
    { aggKey: string; label: string; leafKeys: string[] } | null>(null);

  /** Step 1 coverage statements. Distinct from `error`: these report what was
   *  built, not that something failed. */
  const [notice, setNotice] = useState('');

  /**
   * Show the derived aggregate for `key`, through the seam.
   *
   * Named rather than inlined into the effect so the setBaseForecast call-site
   * enumeration can attribute it to something, with a reason that is true of
   * it: the argument is a resolveForecast result.
   */
  const showResolvedAggregate = useCallback((key: string) => {
    const { forecast } = resolveForecast(key);
    if (!forecast) return;
    setBaseForecast(forecast);
    setForecastUpdatedAt(format(new Date(), 'dd MMM yyyy, HH:mm'));

    // AND `forecastData`, which is what the panel actually gates on.
    //
    // Setting baseForecast alone left Jon looking at "Ready to forecast" after
    // a successful 72-leaf run. StandardForecastTab renders the whole result
    // panel behind `forecastData.length > 0`, so the component the spec
    // asserted on was never mounted - the store was right and the surface was
    // never reached. Surface-not-store, one level up from where this codebase
    // has met it before: not a wrong value in a rendered component, a correct
    // value in a component that does not render.
    //
    // The rows are built in the same shape the manual path produces, because
    // stdChartData and the data-preview table both read that shape.
    // No forecastData write here any more. The panel DERIVES from the store
    // via stdPanelRows, so setting the context forecast is the whole job -
    // and the every-writer-must-also-populate-the-panel requirement that this
    // function was created to satisfy no longer exists for anyone.
    if (stdScenario === 'Base') {
      // UNIT B: Step 1 reads the SAME predicate Step 3 does.
      //
      // It used to assert flatly that "a summed aggregate has no Base volume
      // series" — an impossibility claim that stopped being true when the seed
      // became explicit. Base is reconstructed from an opening stock plus the
      // forecast flows, so an aggregate whose leaves are all present-and-seeded
      // CAN produce one, and Step 3 now draws it. Step 1 saying otherwise for
      // the same selection is two surfaces disagreeing about one fact.
      //
      // So: where the predicate can show Base, say the panel has no band to
      // render (true, and about the panel) rather than that the series cannot
      // exist. Where it declines, say so — the same reason, on both surfaces.
      setNotice(canShowBaseForecast(forecast)
        ? t('standard_base_panel_has_no_band')
        : t('standard_base_no_opening_stock'));
    }
  }, [resolveForecast, stdScenario, t]);

  /**
   * STEP 1 RESOLVES ITS SELECTION, exactly as Steps 2 and 3 do.
   *
   * Keep-last is retired (Jon, 2026-08-09, option 1 of three — see EXPECTED.md).
   * Step 1 used to hold whatever forecast was last generated while its dropdowns
   * moved underneath it, so `arpuChartData` drew history for the SELECTION and a
   * forecast for something else: measured at Segment=Corporate, history 17.05-
   * 17.83 against a forecast of 33.69, which was a single Mobile Voice / Direct
   * leaf. One chart, two populations.
   *
   * Verbatim the shape `handleStep2FilterChange` and `handleStep3FilterChange`
   * use — resolve through the seam, and assign the RESULT, null included. The
   * null is the point: `showResolvedAggregate` returns early on a miss, which
   * retains the previous cohort's numbers under a changed label, and that is the
   * `if (bf !== undefined)` with no else that Steps 2 and 3 already corrected.
   */
  const showStep1Selection = useCallback((selection: ViewFilter) => {
    // Delegates to the pure helper so the pairing spec DRIVES this transition
    // instead of modelling it — see utils/viewFilter, and the same reasoning
    // that put forecastForView there for Step 3.
    const { forecast } = forecastForStep1Selection(selection, resolveForecast);
    setBaseForecast(forecast as BaseForecast | null);
    setAdjustedForecast(null);
  }, [resolveForecast]); // eslint-disable-line react-hooks/exhaustive-deps

  const stdSelectionKey = useMemo(() => filterToKey(stdSelectionFilter), [stdSelectionFilter]);
  const lastStdSelectionKey = useRef<string | null>(null);

  /**
   * TWO TRANSITIONS RESOLVE: the selection changing, and Step 1 being entered.
   *
   * The ref makes this a transition rather than a state. `null` means Step 1 has
   * never been observed — the first observation records and does NOT resolve, so
   * a mount, or a session import that lands here, keeps the forecast the restore
   * just put in place. AWAY means the user left and came back.
   *
   * Entering is a trigger because Step 2 and Step 3 REASSIGN baseForecast for
   * their own filters, and `forecastForView` returns `owns: false` for
   * 'standard' — nothing restores Step 1 on the way back. Without this arm, a
   * user who visited Step 2 and returned would find Step 1's dropdowns reading
   * one cohort and its chart drawing another's forecast: the two-population
   * defect this session exists to kill, reached by a different door. Found by
   * the gate, not by the walk.
   */
  useEffect(() => {
    // The DECISION is step1ResolveDecision, in utils/viewFilter, so a spec can
    // DRIVE it rather than re-implement it here. What remains in this effect is
    // only the part that has to live in a component: read the ref, write it
    // back, and call the resolver.
    const d = step1ResolveDecision(lastStdSelectionKey.current, activeView, stdSelectionKey);
    lastStdSelectionKey.current = d.next;
    if (d.resolve) showStep1Selection(stdSelectionFilter);
  }, [stdSelectionKey, stdSelectionFilter, activeView, showStep1Selection]);

  // Runs after the generated leaves have landed in the store, which is the
  // whole reason this is an effect and not a line in the .then above.
  useEffect(() => {
    if (!pendingAggregateKey) return;
    // Only while the user is still on Step 1. Generation runs in a worker pool,
    // so a user can start one and switch tabs before it lands - and this effect
    // would then call setBaseForecast with Step 1's aggregate while they are
    // looking at Step 2 or 3, silently replacing the cohort under them.
    //
    // The pending key is DISCARDED rather than held for their return. Firing it
    // later would resurrect a result from a selection they have moved on from,
    // which is the same class of surprise one tab further away - and the filter
    // and tab-restore paths own what is displayed by then.
    if (activeView !== 'standard') { setPendingAggregateKey(null); return; }
    showResolvedAggregate(pendingAggregateKey);
    setPendingAggregateKey(null);
  }, [pendingAggregateKey, forecastStore, showResolvedAggregate, activeView]);

  const generateStandardForecast = () => {
    setError('');
    setNotice('');
    setCompareCategories([]);
    
    const targetMetric = stdScenario === 'Inflow' ? wiInflowVal :
                         stdScenario === 'Outflow' ? wiOutflowVal :
                         stdScenario === 'Base' ? wiBaseVal : wiRetentionVal;

    if (!wiDateCol || !wiMetricCol || !wiValueCol || !targetMetric) {
      setError('Please map Date, Metric, Value columns and select an IBRO scenario identifier.');
      return;
    }

    // ── AN AGGREGATE SELECTION GENERATES ITS MISSING LEAVES ─────────────────
    //
    // This function used to sum the series across the aggregated scope, fit ONE
    // model to the sum, and store it under an All-bearing key — fit-on-aggregate,
    // the defect bottom-up replaced. Session G removed that and declined
    // instead. The decline was honest but useless: the user's actual intent,
    // "I want a forecast covering this scope", is satisfiable, just not by
    // fitting the total.
    //
    // So: enumerate the leaves under the selection, fit the ones that are
    // missing, and let derivation cover the aggregate from there. Nothing is
    // ever written under the All-bearing key itself — the aggregate is not
    // stored, it is summed at read time, every time.
    //
    // Already-fitted leaves are left alone. Regenerating them would silently
    // overwrite work the user has, and reusing them is the whole point of
    // deriving.
    if (stdAggregatesMappedDim) {
      const aggKey = filterToKey(stdSelectionFilter);
      const { enumerated, missing, leaves, unfittable } = missingLeavesForKey(
        aggKey, populatedCohorts.leafMap, forecastStore, unfittableLeaves,
      );
      if (!enumerated) {
        // No leaves at all — the selection is not something this data can
        // produce. Distinct from "already covered", and it must stay distinct:
        // both have zero missing leaves and they mean opposite things.
        setNotice(t('standard_selection_never_enumerated'));
        return;
      }
      if (missing.length === 0) {
        // Nothing generatable. Which message depends on WHY, and the two are
        // not interchangeable: a scope blocked by leaves that cannot be fitted
        // is not a covered scope, and saying it is would be the button's old
        // lie in a different place.
        setNotice(unfittable.length > 0
          ? t('standard_scope_blocked_by_unfittable', { count: unfittable.length })
          : t('standard_all_leaves_present', { count: leaves.length }));
        return;
      }
      // NOTHING IS GENERATED HERE. This branch used to call
      // generateAllMissingForecasts directly and report afterwards; it now
      // opens the confirm panel scoped to `missing` and lets the modal's normal
      // confirm -> generating -> complete flow do the work.
      //
      // The decision (2026-08-08, after Jon walked the shipped flow): no
      // multi-leaf run starts before the user has seen and confirmed the
      // settings it will use. A run of 35 leaves that begins on one click is
      // not a faster version of the same thing - the user cannot decline it,
      // and until it finishes they cannot tell what it decided on their behalf.
      //
      // The engine is untouched: the confirm still calls the ONE generator with
      // restrictToLeafKeys, exactly as this line did. What moved is the door.
      //
      // The single-cohort manual generate below is deliberately NOT routed
      // through here. Its settings are inline and adjacent - already visible,
      // already adjustable - so a modal would add a step and no information.
      setStdGenerateResult(null);
      setPendingScopedRun({ aggKey, label: describeScope(stdSelectionFilter, t('bulk_scope_all_cohorts')), leafKeys: missing });
      setShowBulkGeneratePrompt(true);
      return;
    }


    let processedData = data
      .map(row => ({ ...row, _parsedDate: new Date(row[wiDateCol]) }))
      .filter(row => isValid(row._parsedDate) && String(row[wiMetricCol]) === targetMetric)
      .sort((a, b) => a._parsedDate.getTime() - b._parsedDate.getTime());

    if (wiSegmentCol && segmentMode === 'filter') {
      if (!segmentValue) {
        setError('Please select a segment value to filter by.');
        return;
      }
      if (segmentValue !== 'All (Aggregated)') {
        processedData = processedData.filter(row => String(row[wiSegmentCol]) === segmentValue);
      }
    }

    if (wiProductCol && productMode === 'filter') {
      if (!productValue) {
        setError('Please select a product value to filter by.');
        return;
      }
      if (productValue !== 'All (Aggregated)') {
        processedData = processedData.filter(row => String(row[wiProductCol]) === productValue);
      }
      if (wiProductL2Col && productL2Value) {
        processedData = processedData.filter(row => String(row[wiProductL2Col]) === productL2Value);
      }
    }

    if (wiChannelCol && channelMode === 'filter') {
      if (!channelValue) {
        setError('Please select a channel value to filter by.');
        return;
      }
      if (channelValue !== 'All (Aggregated)') {
        processedData = processedData.filter(row => String(row[wiChannelCol]) === channelValue);
      }
      if (wiChannelL2Col && channelL2Value) {
        processedData = processedData.filter(row => String(row[wiChannelL2Col]) === channelL2Value);
      }
    }

    // Tariff (Phase 2a) — filter-only scoping for the single-cohort preview.
    if (wiTariffL1Col && tariffValue && tariffValue !== 'All (Aggregated)') {
      processedData = processedData.filter(row => String(row[wiTariffL1Col]) === tariffValue);
      if (wiTariffL2Col && tariffL2Value) {
        processedData = processedData.filter(row => String(row[wiTariffL2Col]) === tariffL2Value);
      }
    }

    if (processedData.length < 2) {
      setError('Not enough valid data points to generate a forecast.');
      return;
    }

    if (wiSegmentCol && segmentMode === 'compare') {
      const freqMap = new Map<string, number>();
      processedData.forEach(r => {
        const val = String(r[wiSegmentCol]);
        if (val && val !== 'undefined' && val !== 'null') {
          freqMap.set(val, (freqMap.get(val) || 0) + 1);
        }
      });
      
      const uniqueCategories = Array.from(freqMap.keys()).sort((a, b) => (freqMap.get(b) || 0) - (freqMap.get(a) || 0));
      const topCategories = uniqueCategories.slice(0, 10);
      
      if (topCategories.length === 0) {
        setError('No valid categories found in the selected column.');
        return;
      }

      setCompareCategories(topCategories);

      const timeMap = new Map<number, any>();
      const getOrInit = (time: number, dateObj: Date) => {
        if (!timeMap.has(time)) {
          timeMap.set(time, { _parsedDate: dateObj, timestamp: time, date: format(dateObj, 'yyyy-MM'), [wiDateCol]: dateObj });
        }
        return timeMap.get(time);
      };

      topCategories.forEach(cat => {
        const catData = processedData.filter(row => String(row[wiSegmentCol]) === cat);
        const aggMap = new Map<number, any>();
        catData.forEach(row => {
          const time = row._parsedDate.getTime();
          const targetVal = Number(row[wiValueCol]) || 0;
          if (!aggMap.has(time)) aggMap.set(time, { _parsedDate: row._parsedDate, [wiValueCol]: targetVal });
          else aggMap.get(time)[wiValueCol] += targetVal;
        });
        const aggArr = Array.from(aggMap.values()).sort((a, b) => a._parsedDate.getTime() - b._parsedDate.getTime());
        
        if (aggArr.length < 2) return;

        const hw = calculateHoltWinters(aggArr, wiDateCol, wiValueCol, stdForecastLength, preHorizonUncertainty, postHorizonExpansionRate, confidenceHorizon, selectedForecastModel);
        
        aggArr.forEach(row => {
          const t = row._parsedDate.getTime();
          getOrInit(t, row._parsedDate)[`${cat} (Historical)`] = Number(row[wiValueCol].toFixed(2));
        });
        
        if (hw) {
          hw.forEach(row => {
            const d = row[wiDateCol] as Date;
            const t = d.getTime();
            getOrInit(t, d)[`${cat} (Forecast)`] = row['Mean (Base)'];
          });
        }
      });

      const combined = Array.from(timeMap.values()).sort((a, b) => a.timestamp - b.timestamp);
      setForecastData(combined);
      
      // Save individual forecasts to overall view
      const newSaved = { ...savedForecasts };
      const prodKey = productValue === 'All (Aggregated)' ? 'All' : productValue;
      topCategories.forEach(cat => {
        const catData = processedData.filter(row => String(row[wiSegmentCol]) === cat);
        const aggMap = new Map<number, any>();
        catData.forEach(row => {
          const time = row._parsedDate.getTime();
          const targetVal = Number(row[wiValueCol]) || 0;
          if (!aggMap.has(time)) aggMap.set(time, { _parsedDate: row._parsedDate, [wiValueCol]: targetVal });
          else aggMap.get(time)[wiValueCol] += targetVal;
        });
        const aggArr = Array.from(aggMap.values()).sort((a, b) => a._parsedDate.getTime() - b._parsedDate.getTime());
        if (aggArr.length < 2) return;
        const hw = calculateHoltWinters(aggArr, wiDateCol, wiValueCol, stdForecastLength, preHorizonUncertainty, postHorizonExpansionRate, confidenceHorizon, selectedForecastModel);
        if (hw) {
          const hist = aggArr.map((row) => {
            const { _parsedDate, ...rest } = row;
            return {
              ...rest,
              'Mean (Base)': Number(Number(row[wiValueCol]).toFixed(2)),
              'Optimistic': null,
              'Pessimistic': null,
              Type: 'Historical',
            };
          });
          newSaved[`${cat}|${prodKey}|Standard Forecast|${stdScenario}`] = [...hist, ...hw];
        }
      });
      setSavedForecasts(newSaved);
      return;
    }

    if (wiProductCol && productMode === 'compare') {
      const freqMap = new Map<string, number>();
      processedData.forEach(r => {
        const val = String(r[wiProductCol]);
        if (val && val !== 'undefined' && val !== 'null') {
          freqMap.set(val, (freqMap.get(val) || 0) + 1);
        }
      });
      
      const uniqueCategories = Array.from(freqMap.keys()).sort((a, b) => (freqMap.get(b) || 0) - (freqMap.get(a) || 0));
      const topCategories = uniqueCategories.slice(0, 10);
      
      if (topCategories.length === 0) {
        setError('No valid products found in the selected column.');
        return;
      }

      setCompareCategories(topCategories);

      const timeMap = new Map<number, any>();
      const getOrInit = (time: number, dateObj: Date) => {
        if (!timeMap.has(time)) {
          timeMap.set(time, { _parsedDate: dateObj, timestamp: time, date: format(dateObj, 'yyyy-MM'), [wiDateCol]: dateObj });
        }
        return timeMap.get(time);
      };

      topCategories.forEach(cat => {
        const catData = processedData.filter(row => String(row[wiProductCol]) === cat);
        const aggMap = new Map<number, any>();
        catData.forEach(row => {
          const time = row._parsedDate.getTime();
          const targetVal = Number(row[wiValueCol]) || 0;
          if (!aggMap.has(time)) aggMap.set(time, { _parsedDate: row._parsedDate, [wiDateCol]: row[wiDateCol], [wiValueCol]: targetVal });
          else aggMap.get(time)[wiValueCol] += targetVal;
        });
        const aggArr = Array.from(aggMap.values()).sort((a, b) => a._parsedDate.getTime() - b._parsedDate.getTime());
        
        if (aggArr.length < 2) return;

        const hw = calculateHoltWinters(aggArr, wiDateCol, wiValueCol, stdForecastLength, preHorizonUncertainty, postHorizonExpansionRate, confidenceHorizon, selectedForecastModel);
        
        aggArr.forEach(row => {
          const t = row._parsedDate.getTime();
          getOrInit(t, row._parsedDate)[`${cat} (Historical)`] = Number(row[wiValueCol].toFixed(2));
        });
        
        if (hw) {
          hw.forEach(row => {
            const d = row[wiDateCol] as Date;
            const t = d.getTime();
            getOrInit(t, d)[`${cat} (Forecast)`] = row['Mean (Base)'];
          });
        }
      });

      const combined = Array.from(timeMap.values()).sort((a, b) => a.timestamp - b.timestamp);
      setForecastData(combined);
      
      // Save individual forecasts to overall view
      const newSaved = { ...savedForecasts };
      const segKey = segmentMode === 'filter' && segmentValue && segmentValue !== 'All (Aggregated)' ? segmentValue : 'All';
      topCategories.forEach(cat => {
        const catData = processedData.filter(row => String(row[wiProductCol]) === cat);
        const aggMap = new Map<number, any>();
        catData.forEach(row => {
          const time = row._parsedDate.getTime();
          const targetVal = Number(row[wiValueCol]) || 0;
          if (!aggMap.has(time)) aggMap.set(time, { _parsedDate: row._parsedDate, [wiDateCol]: row[wiDateCol], [wiValueCol]: targetVal });
          else aggMap.get(time)[wiValueCol] += targetVal;
        });
        const aggArr = Array.from(aggMap.values()).sort((a, b) => a._parsedDate.getTime() - b._parsedDate.getTime());
        if (aggArr.length < 2) return;
        const hw = calculateHoltWinters(aggArr, wiDateCol, wiValueCol, stdForecastLength, preHorizonUncertainty, postHorizonExpansionRate, confidenceHorizon, selectedForecastModel);
        if (hw) {
          const hist = aggArr.map((row) => {
            const { _parsedDate, ...rest } = row;
            return {
              ...rest,
              'Mean (Base)': Number(Number(row[wiValueCol]).toFixed(2)),
              'Optimistic': null,
              'Pessimistic': null,
              Type: 'Historical',
            };
          });
          newSaved[`${segKey}|${cat}|Standard Forecast|${stdScenario}`] = [...hist, ...hw];
        }
      });
      setSavedForecasts(newSaved);
      return;
    }

    if (wiChannelCol && channelMode === 'compare') {
      const freqMap = new Map<string, number>();
      processedData.forEach(r => {
        const val = String(r[wiChannelCol]);
        if (val && val !== 'undefined' && val !== 'null') {
          freqMap.set(val, (freqMap.get(val) || 0) + 1);
        }
      });
      
      const uniqueCategories = Array.from(freqMap.keys()).sort((a, b) => (freqMap.get(b) || 0) - (freqMap.get(a) || 0));
      const topCategories = uniqueCategories.slice(0, 10);
      
      if (topCategories.length === 0) {
        setError('No valid channels found in the selected column.');
        return;
      }

      setCompareCategories(topCategories);

      const timeMap = new Map<number, any>();
      const getOrInit = (time: number, dateObj: Date) => {
        if (!timeMap.has(time)) {
          timeMap.set(time, { _parsedDate: dateObj, timestamp: time, date: format(dateObj, 'yyyy-MM'), [wiDateCol]: dateObj });
        }
        return timeMap.get(time);
      };

      topCategories.forEach(cat => {
        const catData = processedData.filter(row => String(row[wiChannelCol]) === cat);
        const aggMap = new Map<number, any>();
        catData.forEach(row => {
          const time = row._parsedDate.getTime();
          const targetVal = Number(row[wiValueCol]) || 0;
          if (!aggMap.has(time)) aggMap.set(time, { _parsedDate: row._parsedDate, [wiDateCol]: row[wiDateCol], [wiValueCol]: targetVal });
          else aggMap.get(time)[wiValueCol] += targetVal;
        });
        const aggArr = Array.from(aggMap.values()).sort((a, b) => a._parsedDate.getTime() - b._parsedDate.getTime());
        
        if (aggArr.length < 2) return;

        const hw = calculateHoltWinters(aggArr, wiDateCol, wiValueCol, stdForecastLength, preHorizonUncertainty, postHorizonExpansionRate, confidenceHorizon, selectedForecastModel);
        
        aggArr.forEach(row => {
          const t = row._parsedDate.getTime();
          getOrInit(t, row._parsedDate)[`${cat} (Historical)`] = Number(row[wiValueCol].toFixed(2));
        });
        
        if (hw) {
          hw.forEach(row => {
            const d = row[wiDateCol] as Date;
            const t = d.getTime();
            getOrInit(t, d)[`${cat} (Forecast)`] = row['Mean (Base)'];
          });
        }
      });

      const combined = Array.from(timeMap.values()).sort((a, b) => a.timestamp - b.timestamp);
      setForecastData(combined);
      
      // Save individual forecasts to overall view
      const newSaved = { ...savedForecasts };
      const segKey = segmentMode === 'filter' && segmentValue && segmentValue !== 'All (Aggregated)' ? segmentValue : 'All';
      const prodKey = productMode === 'filter' && productValue && productValue !== 'All (Aggregated)' ? productValue : 'All';
      topCategories.forEach(cat => {
        const catData = processedData.filter(row => String(row[wiChannelCol]) === cat);
        const aggMap = new Map<number, any>();
        catData.forEach(row => {
          const time = row._parsedDate.getTime();
          const targetVal = Number(row[wiValueCol]) || 0;
          if (!aggMap.has(time)) aggMap.set(time, { _parsedDate: row._parsedDate, [wiDateCol]: row[wiDateCol], [wiValueCol]: targetVal });
          else aggMap.get(time)[wiValueCol] += targetVal;
        });
        const aggArr = Array.from(aggMap.values()).sort((a, b) => a._parsedDate.getTime() - b._parsedDate.getTime());
        if (aggArr.length < 2) return;
        const hw = calculateHoltWinters(aggArr, wiDateCol, wiValueCol, stdForecastLength, preHorizonUncertainty, postHorizonExpansionRate, confidenceHorizon, selectedForecastModel);
        if (hw) {
          const hist = aggArr.map((row) => {
            const { _parsedDate, ...rest } = row;
            return {
              ...rest,
              'Mean (Base)': Number(Number(row[wiValueCol]).toFixed(2)),
              'Optimistic': null,
              'Pessimistic': null,
              Type: 'Historical',
            };
          });
          newSaved[`${segKey}|${prodKey}|${cat}|Standard Forecast|${stdScenario}`] = [...hist, ...hw];
        }
      });
      setSavedForecasts(newSaved);
      return;
    }

    // Normal single-line forecast logic
    const isAllSegment = segmentValue === 'All (Aggregated)';
    const isAllProduct = productValue === 'All (Aggregated)';
    const isAllChannel = channelValue === 'All (Aggregated)';

    if (isAllSegment || isAllProduct || isAllChannel) {
      const combos = getUniqueCombos(processedData, segmentValue, productValue, wiSegmentCol, wiProductCol, channelValue, wiChannelCol);
      const newSaved = { ...savedForecasts };
      const allForecastResults: any[] = [];

      combos.forEach(combo => {
        const comboData = processedData.filter(r =>
          (wiSegmentCol ? String(r[wiSegmentCol]) === combo.s : true) &&
          (wiProductCol ? String(r[wiProductCol]) === combo.p : true) &&
          (wiChannelCol ? String(r[wiChannelCol]) === combo.c : true)
        );

        const aggMap = new Map<number, any>();
        comboData.forEach(row => {
          const time = row._parsedDate.getTime();
          const targetVal = Number(row[wiValueCol]) || 0;
          if (!aggMap.has(time)) aggMap.set(time, { ...row, [wiValueCol]: targetVal });
          else aggMap.get(time)[wiValueCol] += targetVal;
        });
        const aggArr = Array.from(aggMap.values()).sort((a, b) => a._parsedDate.getTime() - b._parsedDate.getTime());

        if (aggArr.length < 2) return;

        const hw = calculateHoltWinters(aggArr, wiDateCol, wiValueCol, stdForecastLength, preHorizonUncertainty, postHorizonExpansionRate, confidenceHorizon, selectedForecastModel);
        if (hw) {
          const hist = aggArr.map(row => ({
            ...row,
            'Mean (Base)': Number(Number(row[wiValueCol]).toFixed(2)),
            Type: 'Historical',
            'Pre-Horizon Uncertainty %': preHorizonUncertainty,
            'Post-Horizon Expansion Rate %': postHorizonExpansionRate
          }));
          const hwWithTrace = hw.map(r => ({ ...r, 'Pre-Horizon Uncertainty %': preHorizonUncertainty, 'Post-Horizon Expansion Rate %': postHorizonExpansionRate }));
          newSaved[`${combo.s}|${combo.p}|${combo.c}|Standard Forecast|${stdScenario}`] = [...hist, ...hwWithTrace];
          allForecastResults.push([...hist, ...hwWithTrace]);
        }
      });

      const chartAggMap = new Map<number, any>();
      allForecastResults.forEach(forecast => {
        forecast.forEach(row => {
          const time = new Date(row[wiDateCol]).getTime();
          if (!chartAggMap.has(time)) {
             chartAggMap.set(time, { ...row });
          } else {
             const existing = chartAggMap.get(time);
             existing['Mean (Base)'] = (existing['Mean (Base)'] || 0) + (row['Mean (Base)'] || 0);
             existing['Optimistic'] = (existing['Optimistic'] || 0) + (row['Optimistic'] || 0);
             existing['Pessimistic'] = (existing['Pessimistic'] || 0) + (row['Pessimistic'] || 0);
             if (row.Type === 'Historical') {
                existing[wiValueCol] = (existing[wiValueCol] || 0) + (row[wiValueCol] || 0);
             }
          }
        });
      });
      const aggregated = Array.from(chartAggMap.values()).sort((a, b) => new Date(a[wiDateCol]).getTime() - new Date(b[wiDateCol]).getTime());
      setForecastData(aggregated);
      setSavedForecasts(newSaved);

      // Build and store an IBRO BaseForecast for the aggregate scope so that
      // forecastStore has a key for this cohort (e.g. Corporate|Mobile Voice|All|All|All).
      // Without this, the chart and MAPE scores fall back to a stale baseForecast at
      // a completely different scale when channelValue/productValue/segmentValue is 'All'.
      if (wiInflowVal && wiOutflowVal && wiRetentionVal) {
        let allIBRO = data
          .map(row => ({ ...row, _parsedDate: new Date(row[wiDateCol]) }))
          .filter(row => isValid(row._parsedDate));
        if (wiSegmentCol && segmentValue !== 'All (Aggregated)') allIBRO = allIBRO.filter(r => String(r[wiSegmentCol]) === segmentValue);
        if (wiProductCol && productValue !== 'All (Aggregated)') allIBRO = allIBRO.filter(r => String(r[wiProductCol]) === productValue);
        if (wiProductL2Col && productL2Value) allIBRO = allIBRO.filter(r => String(r[wiProductL2Col]) === productL2Value);
        if (wiChannelCol && channelValue !== 'All (Aggregated)') allIBRO = allIBRO.filter(r => String(r[wiChannelCol]) === channelValue);
        if (wiChannelL2Col && channelL2Value) allIBRO = allIBRO.filter(r => String(r[wiChannelL2Col]) === channelL2Value);
      if (wiTariffL1Col && tariffValue && tariffValue !== 'All (Aggregated)') allIBRO = allIBRO.filter(r => String(r[wiTariffL1Col]) === tariffValue);
      if (wiTariffL2Col && tariffL2Value) allIBRO = allIBRO.filter(r => String(r[wiTariffL2Col]) === tariffL2Value);

        const ibroMap = new Map<number, AggregatedIBRORow>();
        allIBRO.forEach(row => {
          const t = row._parsedDate.getTime();
          if (!ibroMap.has(t)) ibroMap.set(t, { _parsedDate: row._parsedDate, inflow: 0, outflow: 0, retention: 0, arpu: 0, inflowArpu: 0, outflowArpu: 0, retentionArpu: 0, baseArpu: 0 });
          const entry = ibroMap.get(t)!;
          const metric = String(row[wiMetricCol]);
          const val = Number(row[wiValueCol]) || 0;
          if (metric === wiInflowVal) entry.inflow += val;
          else if (metric === wiOutflowVal) entry.outflow += val;
          else if (metric === wiRetentionVal) entry.retention += val;
        });
        if (wiRevenueCol || wiArpuCol) {
          type ScenAccum = { subs: number; rev: number };
          const inflowAcc    = new Map<number, ScenAccum>();
          const outflowAcc   = new Map<number, ScenAccum>();
          const retentionAcc = new Map<number, ScenAccum>();
          const baseAcc      = new Map<number, ScenAccum>();
          allIBRO.forEach(row => {
            const t = row._parsedDate.getTime();
            const metric = String(row[wiMetricCol]);
            const val = Number(row[wiValueCol]) || 0;
            const rev  = Number(row[wiRevenueCol]) || 0;
            const arpu = Number(row[wiArpuCol]) || 0;
            const revVal = rev || (arpu * val);
            if (metric === wiInflowVal)    { const a = inflowAcc.get(t)    ?? {subs:0,rev:0}; a.subs+=val; a.rev+=revVal; inflowAcc.set(t,a); }
            else if (metric === wiOutflowVal)   { const a = outflowAcc.get(t)   ?? {subs:0,rev:0}; a.subs+=val; a.rev+=revVal; outflowAcc.set(t,a); }
            else if (metric === wiRetentionVal) { const a = retentionAcc.get(t) ?? {subs:0,rev:0}; a.subs+=val; a.rev+=revVal; retentionAcc.set(t,a); }
            else if (metric === wiBaseVal)      { const a = baseAcc.get(t)      ?? {subs:0,rev:0}; a.subs+=val; a.rev+=revVal; baseAcc.set(t,a); }
          });
          ibroMap.forEach((entry, t) => {
            const ia = inflowAcc.get(t)    ?? {subs:0,rev:0};
            const oa = outflowAcc.get(t)   ?? {subs:0,rev:0};
            const ra = retentionAcc.get(t) ?? {subs:0,rev:0};
            const ba = baseAcc.get(t)      ?? {subs:0,rev:0};
            const totalSubs = ia.subs + oa.subs + ra.subs + ba.subs;
            const totalRev  = ia.rev  + oa.rev  + ra.rev  + ba.rev;
            if (totalSubs > 0) entry.arpu = totalRev / totalSubs;
            entry.inflowArpu    = ia.subs > 0 ? ia.rev / ia.subs : 0;
            entry.outflowArpu   = oa.subs > 0 ? oa.rev / oa.subs : 0;
            entry.retentionArpu = ra.subs > 0 ? ra.rev / ra.subs : 0;
            entry.baseArpu      = ba.subs > 0 ? ba.rev / ba.subs : 0;
          });
        }
        const ibroArr = Array.from(ibroMap.values())
          .filter(e => e.inflow > 0 || e.outflow > 0 || e.retention > 0)
          .sort((a, b) => a._parsedDate.getTime() - b._parsedDate.getTime());
        const baseReadings = new Map<number, number>();
        allIBRO.filter(r => String(r[wiMetricCol]) === wiBaseVal).forEach(r => {
          const t = r._parsedDate.getTime();
          baseReadings.set(t, (baseReadings.get(t) || 0) + (Number(r[wiValueCol]) || 0));
        });
        // NULL, not 0 — see the worker's copy of this. Absent stock is not empty stock.
    const seedBase: number | null = baseReadings.size > 0
      ? (baseReadings.get(Math.max(...baseReadings.keys())) ?? null) : null;
        const stdCohortObj = {
          segment:   segmentValue === 'All (Aggregated)' ? 'All' : segmentValue,
          product:   productValue === 'All (Aggregated)' ? 'All' : productValue,
          productL2: productL2Value || 'All',
          channel:   channelValue === 'All (Aggregated)' ? 'All' : channelValue,
          channelL2: channelL2Value || 'All',
          tariffL1:  tariffValue === 'All (Aggregated)' ? 'All' : (tariffValue || 'All'),
          tariffL2:  tariffL2Value || 'All',
          scenario: stdScenario,
        };
        const bf = calculateBaseForecast(
          ibroArr,
          stdCohortObj,
          seedBase,
          stdForecastLength,
          preHorizonUncertainty,
          postHorizonExpansionRate,
          confidenceHorizon,
          selectedForecastModel,
          getOneOffFlagsForCohort(stdCohortObj),
        );
        if (bf) {
          const fKey = makeForecastKey(bf.cohort.segment, bf.cohort.product, bf.cohort.productL2, bf.cohort.channel, bf.cohort.channelL2, bf.cohort.tariffL1, bf.cohort.tariffL2);
          setForecastStore(prev => new Map(prev).set(fKey, bf));
          setBaseForecast(bf);
          setForecastUpdatedAt(format(new Date(), 'dd MMM yyyy, HH:mm'));
          const newFilter: ViewFilter = cohortToFilter(bf.cohort);
          setStep2Filter(newFilter);
          setStep3Filter(newFilter);
        }
      }

      setIsLoading(false);
      // Raise the standing bulk-generate prompt from the aggregated ('All') path
      // too. Until now the trigger lines lived only after this branch's return,
      // so a user sitting at the default All state -- where most people start --
      // never saw the offer, which is most of what the bulk-generate work exists
      // to shrink. Set AFTER the setForecastStore/setBaseForecast writes above
      // for the ordering reason documented at openBulkPrompt: the check must
      // defer until state has landed or missingStandardCohorts still counts the
      // cohort just generated.
      //
      // Source is null deliberately. A {segment:'All',...} source renders as
      // "Just generated: All cohorts", which implies both a generation that did
      // not happen and a scoping relationship to the offer that does not exist --
      // generateAllMissingForecasts is never passed cohortIds from this modal.
      setBulkSourceCohort(null);
      setTriggerBulkCheck(prev => prev + 1);
      return;
    }

    const aggregatedDataMap = new Map<number, any>();
    processedData.forEach(row => {
      const time = row._parsedDate.getTime();
      const targetVal = Number(row[wiValueCol]) || 0;
      if (!aggregatedDataMap.has(time)) {
        aggregatedDataMap.set(time, { ...row, [wiValueCol]: targetVal });
      } else {
        const existing = aggregatedDataMap.get(time);
        existing[wiValueCol] += targetVal;
      }
    });

    const aggregatedData = Array.from(aggregatedDataMap.values()).sort((a, b) => a._parsedDate.getTime() - b._parsedDate.getTime());
    const newForecastData = calculateHoltWinters(aggregatedData, wiDateCol, wiValueCol, stdForecastLength, preHorizonUncertainty, postHorizonExpansionRate, confidenceHorizon, selectedForecastModel);

    if (!newForecastData) {
      setError('Not enough valid data points to generate a forecast (need at least 4).');
      return;
    }

    const historicalData = aggregatedData.map((row) => {
      const { _parsedDate, ...rest } = row;
      return {
        ...rest,
        [wiDateCol]: _parsedDate,
        'Mean (Base)': Number(Number(row[wiValueCol]).toFixed(2)),
        'Optimistic': null,
        'Pessimistic': null,
        Type: 'Historical',
        'Pre-Horizon Uncertainty %': preHorizonUncertainty,
        'Post-Horizon Expansion Rate %': postHorizonExpansionRate
      };
    });

    const forecastWithTrace = newForecastData.map(r => ({
      ...r,
      'Pre-Horizon Uncertainty %': preHorizonUncertainty,
      'Post-Horizon Expansion Rate %': postHorizonExpansionRate
    }));

    setForecastData([...historicalData, ...forecastWithTrace]);

    const segKey = segmentValue === 'All (Aggregated)' ? 'All' : segmentValue;
    const prodKey = productValue === 'All (Aggregated)' ? 'All' : productValue;
    const prodL2Key = productL2Value || 'All';
    const chanKey = channelValue === 'All (Aggregated)' ? 'All' : channelValue;
    const chanL2Key = channelL2Value || 'All';
    const tarKey = tariffValue === 'All (Aggregated)' ? 'All' : (tariffValue || 'All');
    const tarL2Key = tariffL2Value || 'All';
    // Use the 7-part key + type + scenario so this id matches allCohorts' stdId
    // (which is built from the 7-part makeForecastKey) — keeps savedForecasts and
    // the hasForecast badge aligned for tariff-scoped manual generations.
    const manualCohortId = `${makeForecastKey(segKey, prodKey, prodL2Key, chanKey, chanL2Key, tarKey, tarL2Key)}|Standard Forecast|${stdScenario}`;
    setSavedForecasts(prev => ({ ...prev, [manualCohortId]: [...historicalData, ...forecastWithTrace] }));
    const newEntry = { cohortId: manualCohortId, timestamp: new Date().toISOString(), modelUsed: selectedForecastModel };
    setCohortGenLog(prev => {
      const next = [newEntry, ...prev].slice(0, 10);
      console.log('[generateStandardForecast] cohortGenLog after append:', next.map(e => `${e.cohortId} (${e.modelUsed})`));
      return next;
    });

    // Trigger bulk-generate prompt for remaining combinations
    setBulkSourceCohort({ segment: segKey, product: prodKey, channel: chanKey, scenario: stdScenario });
    setTriggerBulkCheck(prev => prev + 1);

    // Build a typed BaseForecast for ForecastContext so Step 2 (Market Events) can consume it.
    // This runs the full IBRO aggregation across all four metrics using the same filters.
    if (wiInflowVal && wiOutflowVal && wiRetentionVal) {
      let allIBRO = data
        .map(row => ({ ...row, _parsedDate: new Date(row[wiDateCol]) }))
        .filter(row => isValid(row._parsedDate));
      if (wiSegmentCol && segmentValue !== 'All (Aggregated)') allIBRO = allIBRO.filter(r => String(r[wiSegmentCol]) === segmentValue);
      if (wiProductCol && productValue !== 'All (Aggregated)') allIBRO = allIBRO.filter(r => String(r[wiProductCol]) === productValue);
      if (wiProductL2Col && productL2Value) allIBRO = allIBRO.filter(r => String(r[wiProductL2Col]) === productL2Value);
      if (wiChannelCol && channelValue !== 'All (Aggregated)') allIBRO = allIBRO.filter(r => String(r[wiChannelCol]) === channelValue);
      if (wiChannelL2Col && channelL2Value) allIBRO = allIBRO.filter(r => String(r[wiChannelL2Col]) === channelL2Value);
      if (wiTariffL1Col && tariffValue && tariffValue !== 'All (Aggregated)') allIBRO = allIBRO.filter(r => String(r[wiTariffL1Col]) === tariffValue);
      if (wiTariffL2Col && tariffL2Value) allIBRO = allIBRO.filter(r => String(r[wiTariffL2Col]) === tariffL2Value);

      const ibroMap = new Map<number, AggregatedIBRORow>();
      // First pass: aggregate volume metrics
      allIBRO.forEach(row => {
        const t = row._parsedDate.getTime();
        if (!ibroMap.has(t)) ibroMap.set(t, { _parsedDate: row._parsedDate, inflow: 0, outflow: 0, retention: 0, arpu: 0, inflowArpu: 0, outflowArpu: 0, retentionArpu: 0, baseArpu: 0 });
        const entry = ibroMap.get(t)!;
        const metric = String(row[wiMetricCol]);
        const val = Number(row[wiValueCol]) || 0;
        if (metric === wiInflowVal) entry.inflow += val;
        else if (metric === wiOutflowVal) entry.outflow += val;
        else if (metric === wiRetentionVal) entry.retention += val;
      });
      // Second pass: derive blended + per-scenario ARPU from revenue columns when available
      if (wiRevenueCol || wiArpuCol) {
        type ScenAccum = { subs: number; rev: number };
        const inflowAcc    = new Map<number, ScenAccum>();
        const outflowAcc   = new Map<number, ScenAccum>();
        const retentionAcc = new Map<number, ScenAccum>();
        const baseAcc      = new Map<number, ScenAccum>();
        allIBRO.forEach(row => {
          const t = row._parsedDate.getTime();
          const metric = String(row[wiMetricCol]);
          const val = Number(row[wiValueCol]) || 0;
          const rev  = Number(row[wiRevenueCol]) || 0;
          const arpu = Number(row[wiArpuCol]) || 0;
          const revVal = rev || (arpu * val);
          if (metric === wiInflowVal)    { const a = inflowAcc.get(t)    ?? {subs:0,rev:0}; a.subs+=val; a.rev+=revVal; inflowAcc.set(t,a); }
          else if (metric === wiOutflowVal)   { const a = outflowAcc.get(t)   ?? {subs:0,rev:0}; a.subs+=val; a.rev+=revVal; outflowAcc.set(t,a); }
          else if (metric === wiRetentionVal) { const a = retentionAcc.get(t) ?? {subs:0,rev:0}; a.subs+=val; a.rev+=revVal; retentionAcc.set(t,a); }
          else if (metric === wiBaseVal)      { const a = baseAcc.get(t)      ?? {subs:0,rev:0}; a.subs+=val; a.rev+=revVal; baseAcc.set(t,a); }
        });
        ibroMap.forEach((entry, t) => {
          const ia = inflowAcc.get(t)    ?? {subs:0,rev:0};
          const oa = outflowAcc.get(t)   ?? {subs:0,rev:0};
          const ra = retentionAcc.get(t) ?? {subs:0,rev:0};
          const ba = baseAcc.get(t)      ?? {subs:0,rev:0};
          const totalSubs = ia.subs + oa.subs + ra.subs + ba.subs;
          const totalRev  = ia.rev  + oa.rev  + ra.rev  + ba.rev;
          if (totalSubs > 0) entry.arpu = totalRev / totalSubs;
          entry.inflowArpu    = ia.subs > 0 ? ia.rev / ia.subs : 0;
          entry.outflowArpu   = oa.subs > 0 ? oa.rev / oa.subs : 0;
          entry.retentionArpu = ra.subs > 0 ? ra.rev / ra.subs : 0;
          entry.baseArpu      = ba.subs > 0 ? ba.rev / ba.subs : 0;
        });
      }

      const ibroArr = Array.from(ibroMap.values())
        .filter(e => e.inflow > 0 || e.outflow > 0 || e.retention > 0)
        .sort((a, b) => a._parsedDate.getTime() - b._parsedDate.getTime());

      // Seed base: last historical reading for the Base metric
      const baseReadings = new Map<number, number>();
      allIBRO.filter(r => String(r[wiMetricCol]) === wiBaseVal).forEach(r => {
        const t = r._parsedDate.getTime();
        baseReadings.set(t, (baseReadings.get(t) || 0) + (Number(r[wiValueCol]) || 0));
      });
      // NULL, not 0 — see the worker's copy of this. Absent stock is not empty stock.
    const seedBase: number | null = baseReadings.size > 0
      ? (baseReadings.get(Math.max(...baseReadings.keys())) ?? null) : null;

      const stdCohortObj2 = {
        segment:   segmentValue === 'All (Aggregated)' ? 'All' : segmentValue,
        product:   productValue === 'All (Aggregated)' ? 'All' : productValue,
        productL2: productL2Value || 'All',
        channel:   channelValue === 'All (Aggregated)' ? 'All' : channelValue,
        channelL2: channelL2Value || 'All',
        tariffL1:  tariffValue === 'All (Aggregated)' ? 'All' : (tariffValue || 'All'),
        tariffL2:  tariffL2Value || 'All',
        scenario: stdScenario,
      };
      const bf = calculateBaseForecast(
        ibroArr,
        stdCohortObj2,
        seedBase,
        stdForecastLength,
        preHorizonUncertainty,
        postHorizonExpansionRate,
        confidenceHorizon,
        selectedForecastModel,
        getOneOffFlagsForCohort(stdCohortObj2),
      );
      if (bf) {
        console.log('[generateStandardForecast] provenance written to ForecastContext:', bf.provenance.kind, provenanceModel(bf.provenance));
        const fKey = makeForecastKey(bf.cohort.segment, bf.cohort.product, bf.cohort.productL2, bf.cohort.channel, bf.cohort.channelL2, bf.cohort.tariffL1, bf.cohort.tariffL2);
        setForecastStore(prev => new Map(prev).set(fKey, bf));
        setBaseForecast(bf);
        setForecastUpdatedAt(format(new Date(), 'dd MMM yyyy, HH:mm'));
        // Sync both tab filters to the newly generated cohort so Steps 2 & 3 default to it
        const newFilter: ViewFilter = cohortToFilter(bf.cohort);
        setStep2Filter(newFilter);
        setStep3Filter(newFilter);

        // ── PATH B REMOVED: the companion channel='All' write ──────────────
        //
        // After a channel-specific generation this fitted a SECOND model with
        // channel='All' and stored it, so that - in its own words - "dims.product
        // =true cohort rows in the Historical Accuracy table can find an
        // exact-match key for drill-down charts."
        //
        // resolveForecast answers that lookup by derivation now. This was writing
        // a fitted aggregate to satisfy a question the seam already answers, which
        // is the same defect as path A wearing a different justification: a
        // convenience for a reader that has since learned to compute the answer.
      }
    }

    setIsLoading(false);
  };





  // ---------------------------------------------------------------------------
  // Accept a challenger model: re-run the current baseForecast cohort with the
  // accepted model, preserving all uncertainty/horizon settings.  Updates
  // ForecastContext so every downstream view (Market Events, Actuals Review)
  // immediately reflects the new model.
  // ---------------------------------------------------------------------------
  const acceptChallengerModel = useCallback((model: ForecastModel, switchoverMonth: string | null) => {
    if (!baseForecast || !wiInflowVal || !wiOutflowVal || !wiRetentionVal) return;

    const { cohort } = baseForecast;
    const segKey = cohort.segment;
    const prodKey = cohort.product;
    const chanKey = cohort.channel;

    let allIBRO = data
      .map(row => ({ ...row, _parsedDate: new Date(row[wiDateCol]) }))
      .filter(row => isValid(row._parsedDate));
    if (wiSegmentCol && segKey !== 'All') allIBRO = allIBRO.filter(r => String(r[wiSegmentCol]).trim() === segKey);
    if (wiProductCol && prodKey !== 'All') allIBRO = allIBRO.filter(r => String(r[wiProductCol]).trim() === prodKey);
    if (wiProductL2Col && cohort.productL2 && cohort.productL2 !== 'All') allIBRO = allIBRO.filter(r => String(r[wiProductL2Col]).trim() === cohort.productL2);
    if (wiChannelCol && chanKey !== 'All') allIBRO = allIBRO.filter(r => String(r[wiChannelCol]).trim() === chanKey);
    if (wiChannelL2Col && cohort.channelL2 && cohort.channelL2 !== 'All') allIBRO = allIBRO.filter(r => String(r[wiChannelL2Col]).trim() === cohort.channelL2);
    if (wiTariffL1Col && cohort.tariffL1 && cohort.tariffL1 !== 'All') allIBRO = allIBRO.filter(r => String(r[wiTariffL1Col]).trim() === cohort.tariffL1);
    if (wiTariffL2Col && cohort.tariffL2 && cohort.tariffL2 !== 'All') allIBRO = allIBRO.filter(r => String(r[wiTariffL2Col]).trim() === cohort.tariffL2);

    const ibroMap = new Map<number, AggregatedIBRORow>();
    allIBRO.forEach(row => {
      const t = row._parsedDate.getTime();
      if (!ibroMap.has(t)) ibroMap.set(t, { _parsedDate: row._parsedDate, inflow: 0, outflow: 0, retention: 0, arpu: 0, inflowArpu: 0, outflowArpu: 0, retentionArpu: 0, baseArpu: 0 });
      const entry = ibroMap.get(t)!;
      const metric = String(row[wiMetricCol]);
      const val = Number(row[wiValueCol]) || 0;
      if (metric === wiInflowVal) entry.inflow += val;
      else if (metric === wiOutflowVal) entry.outflow += val;
      else if (metric === wiRetentionVal) entry.retention += val;
    });
    if (wiRevenueCol || wiArpuCol) {
      type ScenAccum = { subs: number; rev: number };
      const inflowAcc    = new Map<number, ScenAccum>();
      const outflowAcc   = new Map<number, ScenAccum>();
      const retentionAcc = new Map<number, ScenAccum>();
      const baseAcc      = new Map<number, ScenAccum>();
      allIBRO.forEach(row => {
        const t = row._parsedDate.getTime();
        const metric = String(row[wiMetricCol]);
        const val = Number(row[wiValueCol]) || 0;
        const rev  = Number(row[wiRevenueCol]) || 0;
        const arpu = Number(row[wiArpuCol]) || 0;
        const revVal = rev || (arpu * val);
        if (metric === wiInflowVal)    { const a = inflowAcc.get(t)    ?? {subs:0,rev:0}; a.subs+=val; a.rev+=revVal; inflowAcc.set(t,a); }
        else if (metric === wiOutflowVal)   { const a = outflowAcc.get(t)   ?? {subs:0,rev:0}; a.subs+=val; a.rev+=revVal; outflowAcc.set(t,a); }
        else if (metric === wiRetentionVal) { const a = retentionAcc.get(t) ?? {subs:0,rev:0}; a.subs+=val; a.rev+=revVal; retentionAcc.set(t,a); }
        else if (metric === wiBaseVal)      { const a = baseAcc.get(t)      ?? {subs:0,rev:0}; a.subs+=val; a.rev+=revVal; baseAcc.set(t,a); }
      });
      ibroMap.forEach((entry, t) => {
        const ia = inflowAcc.get(t)    ?? {subs:0,rev:0};
        const oa = outflowAcc.get(t)   ?? {subs:0,rev:0};
        const ra = retentionAcc.get(t) ?? {subs:0,rev:0};
        const ba = baseAcc.get(t)      ?? {subs:0,rev:0};
        const totalSubs = ia.subs + oa.subs + ra.subs + ba.subs;
        const totalRev  = ia.rev  + oa.rev  + ra.rev  + ba.rev;
        if (totalSubs > 0) entry.arpu = totalRev / totalSubs;
        entry.inflowArpu    = ia.subs > 0 ? ia.rev / ia.subs : 0;
        entry.outflowArpu   = oa.subs > 0 ? oa.rev / oa.subs : 0;
        entry.retentionArpu = ra.subs > 0 ? ra.rev / ra.subs : 0;
        entry.baseArpu      = ba.subs > 0 ? ba.rev / ba.subs : 0;
      });
    }

    const ibroArr = Array.from(ibroMap.values())
      .filter(e => e.inflow > 0 || e.outflow > 0 || e.retention > 0)
      .sort((a, b) => a._parsedDate.getTime() - b._parsedDate.getTime());

    const bf = calculateBaseForecast(
      ibroArr,
      cohort,
      baseForecast.seedBaseVolume,
      stdForecastLength,
      preHorizonUncertainty,
      postHorizonExpansionRate,
      confidenceHorizon,
      model,
      getOneOffFlagsForCohort(cohort),
    );
    if (!bf) return;

    // Splice: keep old forecast values for all months up to (but not including)
    // the switchover month — these are months that already have actuals and whose
    // original projections form the paper trail.  Only from the switchover month
    // onwards are values replaced with the new model's output.
    if (switchoverMonth) {
      const spliceIdx = baseForecast.months.findIndex(m => m.month === switchoverMonth);
      if (spliceIdx > 0) {
        bf.months = [
          ...baseForecast.months.slice(0, spliceIdx),
          ...bf.months.slice(spliceIdx),
        ];
      }
    }

    // The store used to keep NO marker distinguishing an adopted challenger
    // from a bulk-generated forecast, and modelAcceptanceLog's 3-part cohortKey
    // was too coarse to name which 7-part cohorts were affected. The accepted
    // arm records it where it can actually be read back.
    bf.provenance = {
      kind: 'accepted',
      modelUsed: model,
      fittedParams: provenanceParams(bf.provenance) ?? undefined,
      replacedModel: provenanceModel(baseForecast.provenance) ?? model,
      acceptedAt: new Date().toISOString(),
    };
    const fKeyChallenger = makeForecastKey(bf.cohort.segment, bf.cohort.product, bf.cohort.productL2, bf.cohort.channel, bf.cohort.channelL2, bf.cohort.tariffL1, bf.cohort.tariffL2);
    setForecastStore(prev => new Map(prev).set(fKeyChallenger, bf));
    setBaseForecast(bf);
    setForecastUpdatedAt(format(new Date(), 'dd MMM yyyy, HH:mm'));

    // Update generation log so Step 1 legend + cohorts panel reflect new model
    const cohortId = `${segKey}|${prodKey}|${chanKey}|Standard Forecast|${cohort.scenario}`;
    const nowIso = new Date().toISOString();
    const newEntry = { cohortId, timestamp: nowIso, modelUsed: model };
    setCohortGenLog(prev => [newEntry, ...prev].slice(0, 10));

    // Append to the model acceptance audit log (used by session export)
    setModelAcceptanceLog(prev => [...prev, {
      cohortKey: `${segKey}|${prodKey}|${chanKey}`,
      previousModel: provenanceModel(baseForecast.provenance) ?? '',
      acceptedModel: model,
      switchoverMonth: switchoverMonth ?? null,
      timestamp: nowIso,
    }]);
  }, [
    baseForecast, data, wiDateCol, wiMetricCol, wiValueCol,
    wiInflowVal, wiOutflowVal, wiRetentionVal, wiBaseVal,
    wiArpuCol, wiRevenueCol, wiSegmentCol, wiProductCol, wiChannelCol,
    stdForecastLength, preHorizonUncertainty, postHorizonExpansionRate, confidenceHorizon,
    oneOffMonths, // P10 — accepted forecast must use the current one-off flag set
  ]);

  // ---------------------------------------------------------------------------
  // Run a challenger model forecast for a specific cohort WITHOUT saving it.
  // Used by the AutoML tab to generate a real preview before the user decides
  // whether to accept.  Returns null if data is insufficient.
  // ---------------------------------------------------------------------------
  const runChallengerForecast = useCallback((cohort: import('./types/forecast').CohortKey, model: ForecastModel): import('./types/forecast').BaseForecast | null => {
    if (!wiInflowVal || !wiOutflowVal || !wiRetentionVal) return null;

    let allIBRO = data
      .map(row => ({ ...row, _parsedDate: new Date(row[wiDateCol]) }))
      .filter(row => isValid(row._parsedDate));
    if (wiSegmentCol && cohort.segment !== 'All') allIBRO = allIBRO.filter(r => String(r[wiSegmentCol]).trim() === cohort.segment);
    if (wiProductCol && cohort.product !== 'All') allIBRO = allIBRO.filter(r => String(r[wiProductCol]).trim() === cohort.product);
    if (wiProductL2Col && cohort.productL2 && cohort.productL2 !== 'All') allIBRO = allIBRO.filter(r => String(r[wiProductL2Col]).trim() === cohort.productL2);
    if (wiChannelCol && cohort.channel !== 'All') allIBRO = allIBRO.filter(r => String(r[wiChannelCol]).trim() === cohort.channel);
    if (wiChannelL2Col && cohort.channelL2 && cohort.channelL2 !== 'All') allIBRO = allIBRO.filter(r => String(r[wiChannelL2Col]).trim() === cohort.channelL2);
    if (wiTariffL1Col && cohort.tariffL1 && cohort.tariffL1 !== 'All') allIBRO = allIBRO.filter(r => String(r[wiTariffL1Col]).trim() === cohort.tariffL1);
    if (wiTariffL2Col && cohort.tariffL2 && cohort.tariffL2 !== 'All') allIBRO = allIBRO.filter(r => String(r[wiTariffL2Col]).trim() === cohort.tariffL2);

    const ibroMap = new Map<number, AggregatedIBRORow>();
    allIBRO.forEach(row => {
      const t = row._parsedDate.getTime();
      if (!ibroMap.has(t)) ibroMap.set(t, { _parsedDate: row._parsedDate, inflow: 0, outflow: 0, retention: 0, arpu: 0, inflowArpu: 0, outflowArpu: 0, retentionArpu: 0, baseArpu: 0 });
      const entry = ibroMap.get(t)!;
      const metric = String(row[wiMetricCol]);
      const val = Number(row[wiValueCol]) || 0;
      if (metric === wiInflowVal) entry.inflow += val;
      else if (metric === wiOutflowVal) entry.outflow += val;
      else if (metric === wiRetentionVal) entry.retention += val;
    });
    if (wiRevenueCol || wiArpuCol) {
      type ScenAccum = { subs: number; rev: number };
      const inflowAcc = new Map<number, ScenAccum>();
      const outflowAcc = new Map<number, ScenAccum>();
      const retentionAcc = new Map<number, ScenAccum>();
      const baseAcc = new Map<number, ScenAccum>();
      allIBRO.forEach(row => {
        const t = row._parsedDate.getTime();
        const metric = String(row[wiMetricCol]);
        const val = Number(row[wiValueCol]) || 0;
        const rev  = Number(row[wiRevenueCol]) || 0;
        const arpu = Number(row[wiArpuCol]) || 0;
        const revVal = rev || (arpu * val);
        if (metric === wiInflowVal)    { const a = inflowAcc.get(t)    ?? {subs:0,rev:0}; a.subs+=val; a.rev+=revVal; inflowAcc.set(t,a); }
        else if (metric === wiOutflowVal)   { const a = outflowAcc.get(t)   ?? {subs:0,rev:0}; a.subs+=val; a.rev+=revVal; outflowAcc.set(t,a); }
        else if (metric === wiRetentionVal) { const a = retentionAcc.get(t) ?? {subs:0,rev:0}; a.subs+=val; a.rev+=revVal; retentionAcc.set(t,a); }
        else if (metric === wiBaseVal)      { const a = baseAcc.get(t)      ?? {subs:0,rev:0}; a.subs+=val; a.rev+=revVal; baseAcc.set(t,a); }
      });
      ibroMap.forEach((entry, t) => {
        const ia = inflowAcc.get(t)    ?? {subs:0,rev:0};
        const oa = outflowAcc.get(t)   ?? {subs:0,rev:0};
        const ra = retentionAcc.get(t) ?? {subs:0,rev:0};
        const ba = baseAcc.get(t)      ?? {subs:0,rev:0};
        const totalSubs = ia.subs + oa.subs + ra.subs + ba.subs;
        const totalRev  = ia.rev  + oa.rev  + ra.rev  + ba.rev;
        if (totalSubs > 0) entry.arpu = totalRev / totalSubs;
        entry.inflowArpu    = ia.subs > 0 ? ia.rev / ia.subs : 0;
        entry.outflowArpu   = oa.subs > 0 ? oa.rev / oa.subs : 0;
        entry.retentionArpu = ra.subs > 0 ? ra.rev / ra.subs : 0;
        entry.baseArpu      = ba.subs > 0 ? ba.rev / ba.subs : 0;
      });
    }

    const ibroArr = Array.from(ibroMap.values())
      .filter(e => e.inflow > 0 || e.outflow > 0 || e.retention > 0)
      .sort((a, b) => a._parsedDate.getTime() - b._parsedDate.getTime());

    // INSTANCE 2, fixed. This read the cohort's own stored seed, then fell back
    // to the LOADED cohort's seed, then to 0. The middle term is the
    // borrow-an-unrelated-cohort pattern: a challenger for cohort X seeded from
    // cohort Y's standing base, producing a whole forecast whose level belongs
    // to a different cohort - and nothing on screen said so.
    //
    // It now DECLINES. A challenger cannot be run for a cohort that has no
    // forecast of its own, because there is no honest seed for it, and a
    // trailing `?? 0` is not a neutral default either: it seeds a real cohort
    // at zero standing base and calls the result a forecast.
    const existingBf = forecastStore.get(makeForecastKey(cohort.segment, cohort.product, cohort.productL2, cohort.channel, cohort.channelL2, cohort.tariffL1, cohort.tariffL2));
    if (!existingBf) return null;
    const seedBase = existingBf.seedBaseVolume;

    return calculateBaseForecast(
      ibroArr, cohort, seedBase,
      stdForecastLength, preHorizonUncertainty, postHorizonExpansionRate, confidenceHorizon,
      model,
      getOneOffFlagsForCohort(cohort),
    );
  }, [
    data, wiDateCol, wiMetricCol, wiValueCol,
    oneOffMonths,
    wiInflowVal, wiOutflowVal, wiRetentionVal, wiBaseVal,
    wiArpuCol, wiRevenueCol, wiSegmentCol, wiProductCol, wiProductL2Col, wiChannelCol, wiChannelL2Col,
    forecastStore, makeForecastKey,
    stdForecastLength, preHorizonUncertainty, postHorizonExpansionRate, confidenceHorizon,
  ]);

  // ---------------------------------------------------------------------------
  // Save a pre-computed challenger forecast to the store.
  // Called when the user accepts the preview from the AutoML tab — avoids a
  // duplicate re-run since the forecast was already computed in runChallengerForecast.
  // ---------------------------------------------------------------------------
  const acceptPreviewForecast = useCallback((bf: import('./types/forecast').BaseForecast, switchoverMonth: string | null) => {
    let finalBf = bf;
    if (switchoverMonth && baseForecast) {
      const spliceIdx = baseForecast.months.findIndex(m => m.month === switchoverMonth);
      if (spliceIdx > 0) {
        finalBf = { ...bf, months: [...baseForecast.months.slice(0, spliceIdx), ...bf.months.slice(spliceIdx)] };
      }
    }
    const fKey = makeForecastKey(finalBf.cohort.segment, finalBf.cohort.product, finalBf.cohort.productL2, finalBf.cohort.channel, finalBf.cohort.channelL2, finalBf.cohort.tariffL1, finalBf.cohort.tariffL2);
    // DECLINE rather than write a fit under an All-bearing key. Closes the
    // residual risk Session G recorded OPEN: this path stores raw
    // calculateBaseForecast output, whose provenance stays `fitted`, and its
    // only protection was the derivedMix UI gate — which falls back to
    // baseForecast.provenance when the seam returns null, exactly what a legacy
    // single-forecast import produces.
    //
    // PREVENT, never re-stamp. Marking it `accepted` instead would satisfy the
    // no-All-bearing-fitted-writes rule while making the thing WORSE: the
    // retirement rule would then no longer catch it on the way back out, so a
    // fit-on-aggregate would become permanent and invisible. The rule's refusal
    // to retire `accepted` is a safety net for genuine acceptances; laundering
    // through it would remove the net.
    if (isAllBearing(fKey)) {
      setError(t('accept_not_available_for_aggregates'));
      return;
    }
    setForecastStore(prev => new Map(prev).set(fKey, finalBf));
    setBaseForecast(finalBf);
    setForecastUpdatedAt(format(new Date(), 'dd MMM yyyy, HH:mm'));
    const nowIso = new Date().toISOString();
    const cohortId = `${finalBf.cohort.segment}|${finalBf.cohort.product}|${finalBf.cohort.channel}|Standard Forecast|${finalBf.cohort.scenario}`;
    setCohortGenLog(prev => [{ cohortId, timestamp: nowIso, modelUsed: provenanceModel(finalBf.provenance) }, ...prev].slice(0, 10));
    setModelAcceptanceLog(prev => [...prev, {
      cohortKey: `${finalBf.cohort.segment}|${finalBf.cohort.product}|${finalBf.cohort.channel}`,
      previousModel: baseForecast ? (provenanceModel(baseForecast.provenance) ?? '') : '',
      acceptedModel: provenanceModel(finalBf.provenance) ?? '',
      switchoverMonth: switchoverMonth ?? null,
      timestamp: nowIso,
    }]);
  }, [baseForecast, makeForecastKey]);

  // ---------------------------------------------------------------------------
  // Apply challenger model to ALL specified cohort groups in one pass.
  // Each group has its own recommended model; we re-forecast sequentially and
  // keep the last result as the active baseForecast (all groups share the same
  // underlying cohort data, so only the model parameter differs between runs).
  // ---------------------------------------------------------------------------
  const acceptAllChallengerModels = useCallback(
    (groups: Array<{ key: string; model: ForecastModel }>, switchoverMonth: string | null) => {
      if (!baseForecast || !wiInflowVal || !wiOutflowVal || !wiRetentionVal || groups.length === 0) return;

      const { cohort } = baseForecast;
      const segKey = cohort.segment;
      const prodKey = cohort.product;
      const chanKey = cohort.channel;

      // Build IBRO array once (same for all groups — they share the same cohort scope).
      let allIBRO = data
        .map(row => ({ ...row, _parsedDate: new Date(row[wiDateCol]) }))
        .filter(row => isValid(row._parsedDate));
      if (wiSegmentCol && segKey !== 'All') allIBRO = allIBRO.filter(r => String(r[wiSegmentCol]) === segKey);
      if (wiProductCol && prodKey !== 'All') allIBRO = allIBRO.filter(r => String(r[wiProductCol]) === prodKey);
      if (wiChannelCol && chanKey !== 'All') allIBRO = allIBRO.filter(r => String(r[wiChannelCol]) === chanKey);
      if (wiTariffL1Col && cohort.tariffL1 && cohort.tariffL1 !== 'All') allIBRO = allIBRO.filter(r => String(r[wiTariffL1Col]) === cohort.tariffL1);
      if (wiTariffL2Col && cohort.tariffL2 && cohort.tariffL2 !== 'All') allIBRO = allIBRO.filter(r => String(r[wiTariffL2Col]) === cohort.tariffL2);

      const ibroMap = new Map<number, AggregatedIBRORow>();
      allIBRO.forEach(row => {
        const t = row._parsedDate.getTime();
        if (!ibroMap.has(t)) ibroMap.set(t, { _parsedDate: row._parsedDate, inflow: 0, outflow: 0, retention: 0, arpu: 0, inflowArpu: 0, outflowArpu: 0, retentionArpu: 0, baseArpu: 0 });
        const entry = ibroMap.get(t)!;
        const metric = String(row[wiMetricCol]);
        const val = Number(row[wiValueCol]) || 0;
        if (metric === wiInflowVal) entry.inflow += val;
        else if (metric === wiOutflowVal) entry.outflow += val;
        else if (metric === wiRetentionVal) entry.retention += val;
      });
      if (wiRevenueCol || wiArpuCol) {
        type ScenAccum = { subs: number; rev: number };
        const inflowAcc    = new Map<number, ScenAccum>();
        const outflowAcc   = new Map<number, ScenAccum>();
        const retentionAcc = new Map<number, ScenAccum>();
        const baseAcc      = new Map<number, ScenAccum>();
        allIBRO.forEach(row => {
          const t = row._parsedDate.getTime();
          const metric = String(row[wiMetricCol]);
          const val = Number(row[wiValueCol]) || 0;
          const rev  = Number(row[wiRevenueCol]) || 0;
          const arpu = Number(row[wiArpuCol]) || 0;
          const revVal = rev || (arpu * val);
          if (metric === wiInflowVal)    { const a = inflowAcc.get(t)    ?? {subs:0,rev:0}; a.subs+=val; a.rev+=revVal; inflowAcc.set(t,a); }
          else if (metric === wiOutflowVal)   { const a = outflowAcc.get(t)   ?? {subs:0,rev:0}; a.subs+=val; a.rev+=revVal; outflowAcc.set(t,a); }
          else if (metric === wiRetentionVal) { const a = retentionAcc.get(t) ?? {subs:0,rev:0}; a.subs+=val; a.rev+=revVal; retentionAcc.set(t,a); }
          else if (metric === wiBaseVal)      { const a = baseAcc.get(t)      ?? {subs:0,rev:0}; a.subs+=val; a.rev+=revVal; baseAcc.set(t,a); }
        });
        ibroMap.forEach((entry, t) => {
          const ia = inflowAcc.get(t)    ?? {subs:0,rev:0};
          const oa = outflowAcc.get(t)   ?? {subs:0,rev:0};
          const ra = retentionAcc.get(t) ?? {subs:0,rev:0};
          const ba = baseAcc.get(t)      ?? {subs:0,rev:0};
          const totalSubs = ia.subs + oa.subs + ra.subs + ba.subs;
          const totalRev  = ia.rev  + oa.rev  + ra.rev  + ba.rev;
          if (totalSubs > 0) entry.arpu = totalRev / totalSubs;
          entry.inflowArpu    = ia.subs > 0 ? ia.rev / ia.subs : 0;
          entry.outflowArpu   = oa.subs > 0 ? oa.rev / oa.subs : 0;
          entry.retentionArpu = ra.subs > 0 ? ra.rev / ra.subs : 0;
          entry.baseArpu      = ba.subs > 0 ? ba.rev / ba.subs : 0;
        });
      }

      const ibroArr = Array.from(ibroMap.values())
        .filter(e => e.inflow > 0 || e.outflow > 0 || e.retention > 0)
        .sort((a, b) => a._parsedDate.getTime() - b._parsedDate.getTime());

      // Re-forecast with each group's recommended model; keep the last successful result.
      let lastBf = baseForecast;
      const logEntries: Array<{ cohortId: string; timestamp: string; modelUsed: ForecastModel }> = [];
      const ts = new Date().toISOString();

      // Pre-compute splice index once (same for all groups — same baseForecast months).
      const spliceIdx = switchoverMonth
        ? baseForecast.months.findIndex(m => m.month === switchoverMonth)
        : -1;

      for (const { key, model } of groups) {
        const bf = calculateBaseForecast(
          ibroArr,
          cohort,
          baseForecast.seedBaseVolume,
          stdForecastLength,
          preHorizonUncertainty,
          postHorizonExpansionRate,
          confidenceHorizon,
          model,
          getOneOffFlagsForCohort(cohort),
        );
        if (bf) {
          // Splice: preserve old values before switchover month as paper trail.
          if (spliceIdx > 0) {
            bf.months = [
              ...baseForecast.months.slice(0, spliceIdx),
              ...bf.months.slice(spliceIdx),
            ];
          }
          lastBf = bf;
          logEntries.push({ cohortId: key, timestamp: ts, modelUsed: model });
        }
      }

      if (lastBf !== baseForecast) {
        const fKeyAll = makeForecastKey(lastBf.cohort.segment, lastBf.cohort.product, lastBf.cohort.productL2, lastBf.cohort.channel, lastBf.cohort.channelL2, lastBf.cohort.tariffL1, lastBf.cohort.tariffL2);
        // Same decline as acceptPreviewForecast, same reason: prevent the write,
        // never re-stamp it accepted. See that site for why laundering the
        // provenance would be worse than the defect it hides.
        if (isAllBearing(fKeyAll)) {
          setError(t('accept_not_available_for_aggregates'));
          return;
        }
        setForecastStore(prev => new Map(prev).set(fKeyAll, lastBf));
        setBaseForecast(lastBf);
        setForecastUpdatedAt(format(new Date(), 'dd MMM yyyy, HH:mm'));
        setCohortGenLog(prev => [...logEntries, ...prev].slice(0, 10));
        // Append one acceptance record per group to the audit log
        const acceptTs = ts;
        setModelAcceptanceLog(prev => [
          ...prev,
          ...groups.map(({ key, model }) => ({
            cohortKey: key,
            previousModel: provenanceModel(baseForecast.provenance) ?? '',
            acceptedModel: model,
            switchoverMonth: switchoverMonth ?? null,
            timestamp: acceptTs,
          })),
        ]);
      }
    },
    [
      baseForecast, data, wiDateCol, wiMetricCol, wiValueCol,
      wiInflowVal, wiOutflowVal, wiRetentionVal, wiBaseVal,
      wiArpuCol, wiRevenueCol, wiSegmentCol, wiProductCol, wiChannelCol,
      stdForecastLength, preHorizonUncertainty, postHorizonExpansionRate, confidenceHorizon,
      oneOffMonths, // P10 — accept-all must use the current one-off flag set
    ],
  );

  // NOTE: generateWhatIfForecast was deleted here on 2026-07-31.
  // Declared and never referenced -- the only writer of whatIfData besides a
  // reset, and two of the three unreachable callers of computeWhatIfData. The
  // live market-events path is computeAdjustedForecast in WhatIfTab, which
  // already carries all seven cohort dimensions. See EXPECTED.md.

  const downloadExcel = (dataset: any[], filename: string, metadata?: any[]) => {
    if (dataset.length === 0) return;
    
    // Format dates in the dataset for export
    const formattedDataset = dataset.map(row => {
      const newRow = { ...row };
      Object.keys(newRow).forEach(key => {
        if (newRow[key] instanceof Date) {
          newRow[key] = format(newRow[key], 'yyyy-MM');
        }
      });
      return newRow;
    });

    const ws = XLSX.utils.json_to_sheet(formattedDataset);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Results');
    
    if (metadata && metadata.length > 0) {
      const wsMeta = XLSX.utils.json_to_sheet(metadata);
      XLSX.utils.book_append_sheet(wb, wsMeta, 'Parameters');
    }
    
    XLSX.writeFile(wb, filename);
  };

  // Default window offset to center the transition between historical and forecast


  // whatIfData effect deleted 2026-07-31: whatIfData had no writer left.

  /**
   * THE ONE RESOLVER the Step 1 panel shows. Derived from the store, never
   * written to.
   *
   * The panel used to gate on `forecastData`, a piece of state written only by
   * paths that GENERATE. Session restore rehydrates the store and writes no
   * such state, so a restored session had forecasts everywhere else in the app
   * and an empty Step 1 - the store held them, and Step 1 could neither show
   * nor regenerate any. The panel gate is in the initial commit and restore
   * came later, so this never worked: a design gap section C reached first,
   * not a regression.
   *
   * Session K fixed the same shape for the aggregate path by making it a second
   * writer. Restore would have been a third. That is the pattern this codebase
   * has now paid for four times - a requirement that lives at call sites rather
   * than in the thing itself - so the panel DERIVES instead, and the question
   * "which paths must remember to populate it" stops existing. A future path
   * that puts a forecast in the store shows up here for free.
   *
   * COMPARE MODE IS THE ONE EXCEPTION, and it is a real one rather than a
   * workaround. Compare-categories fits ad-hoc per-category series that are
   * never stored under a cohort key, so there is nothing in the store to derive
   * them from. Those rows stay written, and the mode is already a distinct
   * render branch.
   */
  const stdPanelRows = useMemo<any[]>(() => {
    // Ad-hoc multi-series rows, not store-backed. See above.
    if (compareCategories.length > 0) return forecastData;
    if (!wiDateCol || !wiValueCol || !data.length) return [];

    const band = stdScenario === 'Inflow' ? 'inflow'
      : stdScenario === 'Outflow' ? 'outflow'
      : stdScenario === 'Retention' ? 'retention' : null;
    // A stored leaf fit carries no Base VOLUME band either - BaseForecastMonth
    // has inflow, outflow and retention only - so Base has nothing to show
    // from the store rather than nothing to show for aggregates specifically.
    if (!band) return [];

    const scopeCols = { segment: wiSegmentCol, product: wiProductCol,
      productL2: wiProductL2Col, channel: wiChannelCol, channelL2: wiChannelL2Col,
      tariffL1: wiTariffL1Col, tariffL2: wiTariffL2Col };
    const sf = stdSelectionFilter;
    const scopeFilter = { segment: sf.segment === 'All' ? null : sf.segment,
      product: sf.product.l1, productL2: sf.product.l2,
      channel: sf.channel.l1, channelL2: sf.channel.l2,
      tariffL1: sf.tariff?.l1 ?? null, tariffL2: sf.tariff?.l2 ?? null };
    const targetMetric = stdScenario === 'Inflow' ? wiInflowVal
      : stdScenario === 'Outflow' ? wiOutflowVal : wiRetentionVal;

    return buildPanelRowsFromStore(
      resolveForecast, filterToKey(stdSelectionFilter), band,
      data, wiDateCol, wiValueCol,
      row => String(row[wiMetricCol]) === targetMetric
        && rowInScope(row, scopeCols, scopeFilter, ALL_DIMS),
      raw => { const d = new Date(raw as any); return isValid(d) ? format(d, 'yyyy-MM') : null; },
      { preHorizonUncertainty, postHorizonExpansionRate },
    );
  }, [compareCategories, forecastData, resolveForecast, stdSelectionFilter, stdScenario,
      data, wiDateCol, wiMetricCol, wiValueCol, wiInflowVal, wiOutflowVal, wiRetentionVal,
      wiSegmentCol, wiProductCol, wiProductL2Col, wiChannelCol, wiChannelL2Col,
      wiTariffL1Col, wiTariffL2Col, preHorizonUncertainty, postHorizonExpansionRate]);

  // Reads the DERIVED rows, and sits after them because of it.
  //
  // It used to read the `forecastData` state, which was fine while every Step
  // 1 view came from a write. This session made aggregate and restored views
  // derive instead, and the effect silently stopped firing for exactly those -
  // the chart still drew, it just no longer centred on the history/forecast
  // transition. The diff shrank this effect's reach without touching a line of
  // it, which is why nothing failed: found by the gate, not by review.
  useEffect(() => {
    if (stdPanelRows.length > 0 && activeView === 'standard') {
      const sorted = [...stdPanelRows].sort((a, b) => {
        const da = new Date(a[wiDateCol]);
        const db = new Date(b[wiDateCol]);
        return da.getTime() - db.getTime();
      });
      let lastHistoricalIdx = -1;
      for (let i = sorted.length - 1; i >= 0; i--) {
        if (sorted[i].Type === 'Historical') {
          lastHistoricalIdx = i;
          break;
        }
      }
      
      if (lastHistoricalIdx !== -1) {
        const defaultOffset = Math.max(0, Math.min(sorted.length - windowSize, lastHistoricalIdx - Math.floor(windowSize / 2)));
        setWindowOffset(defaultOffset);
      }
    }
  }, [stdPanelRows, activeView, windowSize, wiDateCol]);

  const stdChartData = useMemo(() => {
    if (!stdPanelRows.length) return [];
    
    // Sort all data by date first
    const sortedData = [...stdPanelRows].sort((a, b) => {
      const da = new Date(a[wiDateCol]);
      const db = new Date(b[wiDateCol]);
      return da.getTime() - db.getTime();
    });

    if (compareCategories.length > 0) {
      return sortedData.map(row => {
        const dateObj = new Date(row[wiDateCol]);
        return {
          ...row,
          date: isValid(dateObj) ? format(dateObj, 'yyyy-MM') : 'Invalid Date',
          timestamp: isValid(dateObj) ? dateObj.getTime() : 0,
        };
      });
    }
    
    return sortedData.map(row => {
      const dateObj = new Date(row[wiDateCol]);
      return {
        ...row,
        date: isValid(dateObj) ? format(dateObj, 'yyyy-MM') : 'Invalid Date',
        timestamp: isValid(dateObj) ? dateObj.getTime() : 0,
        Historical: row.Type === 'Historical' ? row['Mean (Base)'] : null,
        'Mean (Base)': row.Type === 'Forecast' ? row['Mean (Base)'] : null,
        Optimistic: row.Type === 'Forecast' ? row['Optimistic'] : null,
        Pessimistic: row.Type === 'Forecast' ? row['Pessimistic'] : null,
      };
    });
  }, [stdPanelRows, wiDateCol, compareCategories]);

  // wiChartData deleted 2026-07-31: derived from whatIfData and never read.

  const vsActualsData = useMemo(() => {
    const grouped: Record<string, any> = {};

    const processRow = (row: any, isActual: boolean) => {
      // Apply filters
      const rowSegment = row[wiSegmentCol] || row['Segment'];
      const rowProduct = row[wiProductCol] || row['Product'];
      const rowChannel = row[wiChannelCol] || row['Channel'];
      const rowType = String(row['Forecast Type'] || row['Type'] || 'Forecast');
      const rowScenario = row['IBRO Scenario'] || row['Scenario'] || row['IBRO_Scenario_Type'] || (isActual && wiMetricCol ? row[wiMetricCol] : null) || (isActual ? 'Base' : undefined);

      if (vsActualsSegmentFilter !== 'All' && String(rowSegment) !== vsActualsSegmentFilter) return;
      if (vsActualsProductFilter !== 'All' && String(rowProduct) !== vsActualsProductFilter) return;
      if (vsActualsChannelFilter !== 'All' && String(rowChannel) !== vsActualsChannelFilter) return;

      if (!isActual) {
        if (vsActualsForecastTypeFilter !== 'All' && rowType !== vsActualsForecastTypeFilter) return;
      }
      
      if (vsActualsScenarioFilter !== 'All' && String(rowScenario) !== vsActualsScenarioFilter) return;

      const dateStr = String(row[wiDateCol] || row['Date'] || row['date']);
      if (!dateStr || dateStr === 'undefined') return;

      let date = parse(dateStr, 'yyyy-MM-dd', new Date());
      if (!isValid(date)) {
        date = new Date(dateStr);
      }
      if (!isValid(date)) return;

      const key = format(date, 'yyyy-MM');
      if (!grouped[key]) {
        grouped[key] = { date, actual: null };
      }

      const val = Number(row[wiValueCol]) || Number(row['Subscriber Volume']) || Number(row['Customer Volume']) || 0;

      if (isActual) {
        grouped[key].actual = (grouped[key].actual || 0) + val;
      } else {
        const wideCols = [
          'Mean (Base)', 'Optimistic', 'Pessimistic',
          'Inflow Volume (Baseline)', 'Inflow Volume (Uplifted)',
          'Outflow Volume (Baseline)', 'Outflow Volume (Uplifted)',
          'Retention Volume (Baseline)', 'Retention Volume (Uplifted)',
          'Base Volume (Baseline)', 'Base Volume (Uplifted)',
          'Total Subscribers (Baseline)', 'Total Subscribers (Uplifted)',
          'Total Revenue (Baseline)', 'Total Revenue (Uplifted)',
          'Blended ARPU (Baseline)', 'Blended ARPU (Uplifted)'
        ];

        // Deduplicate wide columns: only count once per segment/product/channel combo per date
        // Wide columns hold the same aggregate values on every scenario row, so summing across
        // scenarios would inflate the totals.
        const comboKey = `${String(rowSegment)}|${String(rowProduct)}|${String(rowChannel)}`;
        if (!grouped[key]._seenWideCombos) grouped[key]._seenWideCombos = new Set();

        let foundWide = false;
        if (!grouped[key]._seenWideCombos.has(comboKey)) {
          wideCols.forEach(col => {
            if (row[col] !== undefined && row[col] !== null && row[col] !== '') {
              grouped[key][col] = (grouped[key][col] || 0) + Number(row[col]);
              foundWide = true;
            }
          });
          if (foundWide) {
            grouped[key]._seenWideCombos.add(comboKey);
          }
        } else {
          foundWide = wideCols.some(col => row[col] !== undefined && row[col] !== null && row[col] !== '');
        }

        if (!foundWide) {
          const lineKey = `${rowType} (${rowScenario || 'Base'})`;
          grouped[key][lineKey] = (grouped[key][lineKey] || 0) + val;
        }
      }
    };

    // Detect whether the loaded file uses the inline forecast-column format
    // (exported by this app: Forecast_Value / Forecast_Type appended to the original sheet)
    const sourceData = (actualsSheet && workbookSheets[actualsSheet]) ? workbookSheets[actualsSheet] : data;
    const hasInlineForecast = sourceData.length > 0 && sourceData.some(r => r['Forecast_Value'] !== undefined && r['Forecast_Value'] !== '');

    if (hasInlineForecast) {
      // Single-sheet inline format: each row carries both actual and forecast columns
      sourceData.forEach(row => {
        const rowSegment = row[wiSegmentCol] || row['Segment'] || row['Customer_Segment'];
        const rowProduct = row[wiProductCol] || row['Product'];
        const rowChannel = row[wiChannelCol] || row['Channel'] || row['Channel_Level_1'];
        const rowScenario = (wiMetricCol ? row[wiMetricCol] : null) || row['IBRO_Scenario_Type'] || row['Scenario'] || 'Base';
        const rowForecastType = String(row['Forecast_Type'] || 'Standard Forecast');

        if (vsActualsSegmentFilter !== 'All' && String(rowSegment) !== vsActualsSegmentFilter) return;
        if (vsActualsProductFilter !== 'All' && String(rowProduct) !== vsActualsProductFilter) return;
        if (vsActualsChannelFilter !== 'All' && String(rowChannel) !== vsActualsChannelFilter) return;
        if (vsActualsScenarioFilter !== 'All' && String(rowScenario) !== vsActualsScenarioFilter) return;
        if (vsActualsForecastTypeFilter !== 'All' && rowForecastType !== vsActualsForecastTypeFilter) return;

        const dateStr = String(row[wiDateCol] || row['Date'] || row['date'] || '');
        if (!dateStr || dateStr === 'undefined') return;
        let date = parse(dateStr, 'yyyy-MM', new Date());
        if (!isValid(date)) date = parse(dateStr, 'yyyy-MM-dd', new Date());
        if (!isValid(date)) date = new Date(dateStr);
        if (!isValid(date)) return;

        const key = format(date, 'yyyy-MM');
        if (!grouped[key]) grouped[key] = { date, actual: null };

        // Actual value (blank for future-month rows)
        const actualVal = Number(row[wiValueCol] ?? row['Subscriber_Volume'] ?? row['Subscriber Volume']);
        if (!isNaN(actualVal) && actualVal !== 0) {
          grouped[key].actual = (grouped[key].actual || 0) + actualVal;
        }

        // Forecast value
        const forecastVal = Number(row['Forecast_Value']);
        if (!isNaN(forecastVal) && forecastVal !== 0) {
          const lineKey = rowForecastType;
          grouped[key][lineKey] = (grouped[key][lineKey] || 0) + forecastVal;
        }
      });
    } else if (actualsSheet && forecastsSheet && actualsSheet !== forecastsSheet && workbookSheets[actualsSheet] && workbookSheets[forecastsSheet]) {
      workbookSheets[actualsSheet].forEach(row => processRow(row, true));
      workbookSheets[forecastsSheet].forEach(row => processRow(row, false));
    } else if (data.length && wiDateCol && wiValueCol && dataTypeCol && actualValue && forecastValue) {
      data.forEach(row => {
        const type = String(row[dataTypeCol]);
        if (type === actualValue) {
          processRow(row, true);
        } else if (type === forecastValue) {
          processRow(row, false);
        }
      });
    }

    let result = Object.values(grouped)
      .map(({ _seenWideCombos, ...rest }) => rest)
      .sort((a, b) => a.date.getTime() - b.date.getTime());

    if (vsActualsShowOnlyComparable) {
      result = result.filter(d => {
        const hasActual = d.actual != null;
        const hasForecast = Object.keys(d).some(k => k !== 'date' && k !== 'actual' && d[k] != null);
        return hasActual && hasForecast;
      });
    }

    return result;
  }, [data, workbookSheets, actualsSheet, forecastsSheet, wiDateCol, wiMetricCol, wiValueCol, dataTypeCol, actualValue, forecastValue, vsActualsSegmentFilter, vsActualsProductFilter, vsActualsChannelFilter, vsActualsForecastTypeFilter, vsActualsScenarioFilter, vsActualsShowOnlyComparable, wiSegmentCol, wiProductCol, wiChannelCol]);

  const allCohorts = useMemo(() => {
    if (!data.length || !wiMetricCol) return [];

    const segments: string[] = wiSegmentCol
      ? ['All', ...(Array.from(new Set(data.map(r => String(r[wiSegmentCol])).filter(v => v && v !== 'undefined'))) as string[]).sort()]
      : ['All'];

    // Build product combos: {l1, l2} pairs — All|All + each L1|All + each L1|L2
    type Combo = { l1: string; l2: string };
    const productCombos: Combo[] = [{ l1: 'All', l2: 'All' }];
    if (wiProductCol) {
      for (const [l1, l2s] of productTree.entries()) {
        productCombos.push({ l1, l2: 'All' });
        for (const l2 of l2s) productCombos.push({ l1, l2 });
      }
      // If productTree is empty (no L2 col mapped), fall back to L1-only list
      if (productCombos.length === 1) {
        (Array.from(new Set(data.map(r => String(r[wiProductCol])).filter(v => v && v !== 'undefined'))) as string[]).sort()
          .forEach(l1 => productCombos.push({ l1, l2: 'All' }));
      }
    }

    const channelCombos: Combo[] = [{ l1: 'All', l2: 'All' }];
    if (wiChannelCol) {
      for (const [l1, l2s] of channelTree.entries()) {
        channelCombos.push({ l1, l2: 'All' });
        for (const l2 of l2s) channelCombos.push({ l1, l2 });
      }
      if (channelCombos.length === 1) {
        (Array.from(new Set(data.map(r => String(r[wiChannelCol])).filter(v => v && v !== 'undefined'))) as string[]).sort()
          .forEach(l1 => channelCombos.push({ l1, l2: 'All' }));
      }
    }

    // Tariff combos (Phase 2a) — data-driven cardinality. When no tariff column
    // is mapped this stays [{All,All}], so cohort enumeration is unchanged.
    const tariffCombos: Combo[] = [{ l1: 'All', l2: 'All' }];
    if (wiTariffL1Col) {
      for (const [l1, l2s] of tariffTree.entries()) {
        tariffCombos.push({ l1, l2: 'All' });
        for (const l2 of l2s) tariffCombos.push({ l1, l2 });
      }
      if (tariffCombos.length === 1) {
        (Array.from(new Set(data.map(r => String(r[wiTariffL1Col])).filter(v => v && v !== 'undefined'))) as string[]).sort()
          .forEach(l1 => tariffCombos.push({ l1, l2: 'All' }));
      }
    }

    const scenarios = ['Inflow', 'Outflow', 'Base', 'Retention'];
    const cohorts: any[] = [];

    segments.forEach(seg => {
      productCombos.forEach(prod => {
        channelCombos.forEach(chan => {
          tariffCombos.forEach(tar => {
            // Standard Forecasts — keyed by the 7-part forecast key + type + scenario
            scenarios.forEach(scen => {
              const fKey = makeForecastKey(seg, prod.l1, prod.l2, chan.l1, chan.l2, tar.l1, tar.l2);
              const stdId = `${fKey}|Standard Forecast|${scen}`;
              cohorts.push({
                id: stdId,
                segment: seg,
                product: prod.l1,
                productL2: prod.l2,
                channel: chan.l1,
                channelL2: chan.l2,
                tariffL1: tar.l1,
                tariffL2: tar.l2,
                forecastType: 'Standard Forecast',
                scenario: scen,
                // canResolve, not .has: a derivable aggregate HAS a forecast as far
                // as the user is concerned, and saying otherwise contradicts the
                // screen that then shows them one.
                hasForecast: canResolve(fKey) || !!savedForecasts[stdId],
                forecastData: savedForecasts[stdId] || null,
              });
            });
          });
        });
      });
    });
    return cohorts;
  }, [data, wiSegmentCol, wiProductCol, wiProductL2Col, wiChannelCol, wiChannelL2Col, wiTariffL1Col, wiTariffL2Col, wiMetricCol, productTree, channelTree, tariffTree, forecastStore, savedForecasts]); // eslint-disable-line react-hooks/exhaustive-deps

  // Set of cohort keys that genuinely have data — the union of each populated
  // leaf's hierarchical parents. Shared by bulk generation, the "missing" prompt
  // trigger, and the missingCount on the modal so all three agree on the real
  // populated cohort count (not the inflated cross-product, which tariff blows up
  // ~10× because tariff is collinear with product/channel). Data-driven; never
  // keyed off the user's tariff selection.

  // THE canonical "which cohorts still need a Standard Forecast" list.
  //
  // This existed as five separate expressions until 2026-07-30: three verbatim
  // copies in this file (target selection, the prompt trigger, the modal's
  // missingCount), one drifted copy in OverallForecastTab's "Generate Missing"
  // button that omitted the forecastType guard, and one in that tab's status
  // filter that omitted cohortHasData — so the table's "missing" view listed the
  // ~10x-inflated cross-product while the button beside it counted only
  // populated cohorts. They agreed only by nobody editing one without the others.
  //
  // Anything that needs "the missing cohorts" or "how many are missing" reads
  // THIS. Do not re-derive membership from allCohorts: cohortHasData is what
  // keeps tariff's collinearity with product/channel from inflating the count.
  // REDEFINED 2026-08-09 to the one definition: fittable-and-not-fitted, at leaf
  // grain. It was `!c.hasForecast` over the whole cross-product, which is
  // has-no-forecast at series grain WITH aggregates included — see
  // `overallDoorState` above for what that measured on the edge fixture.
  //
  // These are ROWS, and there are four scenario rows per key, so `.length` is
  // four times the number of missing leaves. Nothing may take a COUNT from here:
  // counts come from `missingFittableLeafKeys`, which is the grain the user is
  // being told about. The rows exist only so the Overall table can mark which
  // of its rows are missing.
  const missingStandardCohorts = useMemo(
    () => allCohorts.filter(c => c.forecastType === 'Standard Forecast'
      && missingFittableLeafKeys.has(makeForecastKey(
        c.segment, c.product, c.productL2, c.channel, c.channelL2, c.tariffL1, c.tariffL2))),
    [allCohorts, missingFittableLeafKeys, makeForecastKey],
  );

  // The ONLY way a standing trigger should raise the bulk-generate prompt.
  //
  // bulkSourceCohort is display-only (the "just generated X" pill) and was never
  // reset once set, so a trigger that showed the prompt without touching it
  // would inherit whatever cohort was last generated earlier in the session and
  // claim the user had just generated it. Null-guards in the modal do not catch
  // that, because the value is stale rather than null. Setting both together
  // here makes the pairing impossible to break at a call site.
  //
  // The post-generation path (setBulkSourceCohort + triggerBulkCheck, in
  // generateStandardForecast) deliberately does NOT route through this: it must
  // defer until the new forecast has landed in state, or missingStandardCohorts
  // would still be counting the cohort that was just generated.
  const openBulkPrompt = useCallback((source: typeof bulkSourceCohort) => {
    setBulkSourceCohort(source);
    if (missingFittableLeafKeys.size > 0) setShowBulkGeneratePrompt(true);
  }, [missingFittableLeafKeys]);

  const computeCohortForecastData = useCallback((cohort: any, manualParams?: any, cohortDataMap?: CohortDataMap) => {
    // NOTE: the What-If branch was deleted here on 2026-07-31. It was
    // unreachable: allCohorts has one cohorts.push and only ever assigns
    // forecastType: 'Standard Forecast', so no What-If cohort object exists.
    // It also silently dropped productL2/channelL2/tariffL1/tariffL2 when
    // calling computeWhatIfData -- a real defect in code that never ran, which
    // was once sized and reported as a live one. See EXPECTED.md.

    const targetMetric = cohort.scenario === 'Inflow' ? wiInflowVal :
                         cohort.scenario === 'Outflow' ? wiOutflowVal :
                         cohort.scenario === 'Base' ? wiBaseVal : wiRetentionVal;

    if (!wiDateCol || !wiMetricCol || !wiValueCol || !targetMetric) {
      return null;
    }

    // ── O(1) path: use pre-aggregated map when available (bulk generation) ──
    // Map key = seg|prod|prodL2|chan|chanL2. Only works for specific (non-All)
    // dimension values; 'All' cohorts fall through to the O(N) scan below.
    const cohortMapKey = `${cohort.segment}|${cohort.product}|${cohort.productL2 || 'All'}|${cohort.channel || 'All'}|${cohort.channelL2 || 'All'}|${cohort.tariffL1 || 'All'}|${cohort.tariffL2 || 'All'}`;
    const preAggBucket: PreAggRow[] | undefined = cohortDataMap?.get(cohortMapKey);

    let processedData: Array<Record<string, any> & { _parsedDate: Date }>;
    if (preAggBucket) {
      // O(bucket_size) — the bucket contains only this cohort's rows across all metrics.
      processedData = preAggBucket
        .filter(row => String(row[wiMetricCol]) === targetMetric)
        .sort((a, b) => a._parsedDate.getTime() - b._parsedDate.getTime());
    } else {
      // O(N) fallback: used for 'All' cohorts or when no map is provided.
      processedData = data
        .map(row => ({ ...row, _parsedDate: new Date(row[wiDateCol]) }))
        .filter(row => isValid(row._parsedDate) && String(row[wiMetricCol]) === targetMetric)
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
      return null;
    }

    const aggregatedDataMap = new Map<number, any>();
    processedData.forEach(row => {
      const time = row._parsedDate.getTime();
      const targetVal = Number(row[wiValueCol]) || 0;
      if (!aggregatedDataMap.has(time)) {
        aggregatedDataMap.set(time, { ...row, [wiValueCol]: targetVal });
      } else {
        const existing = aggregatedDataMap.get(time);
        existing[wiValueCol] += targetVal;
      }
    });

    const aggregatedData = Array.from(aggregatedDataMap.values()).sort((a, b) => a._parsedDate.getTime() - b._parsedDate.getTime());

    // Allow bulk re-apply to override confidence settings per-run.
    const runPreUnc  = manualParams?.preHorizonUncertainty  ?? genPreHorizonUncertainty;
    const runPostExp = manualParams?.postHorizonExpansionRate ?? genPostHorizonExpansionRate;
    const runConfHor = manualParams?.confidenceHorizon ?? confidenceHorizon;

    const newForecastData = calculateHoltWinters(aggregatedData, wiDateCol, wiValueCol, genLength, runPreUnc, runPostExp, runConfHor, selectedForecastModel);

    if (!newForecastData) {
      return null;
    }

    const historicalData = aggregatedData.map((row) => {
      const { _parsedDate, ...rest } = row;
      return {
        ...rest,
        [wiDateCol]: _parsedDate,
        'Mean (Base)': Number(Number(row[wiValueCol]).toFixed(2)),
        'Optimistic': null,
        'Pessimistic': null,
        Type: 'Historical',
        'Pre-Horizon Uncertainty %': runPreUnc,
        'Post-Horizon Expansion Rate %': runPostExp
      };
    });

    const forecastWithTrace = newForecastData.map(r => ({
      ...r,
      'Pre-Horizon Uncertainty %': runPreUnc,
      'Post-Horizon Expansion Rate %': runPostExp
    }));

    return [...historicalData, ...forecastWithTrace];
  }, [data, wiDateCol, wiMetricCol, wiValueCol, wiSegmentCol, wiProductCol, wiInflowVal, wiOutflowVal, wiBaseVal, wiRetentionVal, genLength, genInflowUplift, genInflowLag, genRetentionUplift, genRetentionLag, genArpuUplift, genMarketEvents, genPreHorizonUncertainty, genPostHorizonExpansionRate]);

  const generateCohortForecast = (cohort: any, manualParams?: any) => {
    // Renamed off `forecastData`: it shadowed the Step 1 panel state, which
    // made a consumer-completeness check unable to tell a real reader of that
    // state from this unrelated local. One name, one meaning.
    const cohortRows = computeCohortForecastData(cohort, manualParams);
    if (cohortRows) {
      {
        setSavedForecasts(prev => ({
          ...prev,
          [cohort.id]: cohortRows
        }));
      }
    }
    setGeneratingCohort(null);
  };

  // Bulk generation core — used by both the BulkGenerateModal (no-options path) and
  // ManageBulkDrawer (re-apply to selected, with custom settings + metadata).
  const generateAllMissingForecasts = useCallback(async (options?: {
    /** When provided, only these cohort IDs are (re-)generated. Otherwise all missing are targeted. */
    cohortIds?: string[];
    /**
     * When provided, only these 7-part leaf keys are fitted — the Step 1
     * "generate the missing leaves under this aggregate" path.
     *
     * Scoping this generator rather than writing a second one is deliberate. A
     * parallel leaf-fitting implementation would be two things that must agree
     * about seeding, one-off flags, short-history skipping and model choice,
     * and the ones this codebase has had did not stay agreeing.
     */
    restrictToLeafKeys?: Set<string>;
    preHorizonUncertainty?: number;
    postHorizonExpansionRate?: number;
    confidenceHorizon?: number;
    model?: ForecastModel;
    name?: string;
    comment?: string;
    autoModel?: boolean;
    autoConfidence?: boolean;
  }): Promise<{ generated: number; failed: number; skipped: SkippedCohort[] }> => {
    // Show a "preparing" state and yield to the event loop so React can paint the
    // generating panel BEFORE the synchronous pre-flight (cohort enumeration +
    // data-map build + worker payload clone). Without this the main thread is
    // blocked for that whole phase and the modal appears frozen at 0%.
    // The clear is in a `finally` HERE, not at a call site. It used to live
    // only in the bulk modal's onConfirm wrapper, which is the shape that
    // fails the moment a second caller appears - and one did: Session H's
    // Step 1 aggregate branch calls this directly. A throw on that path left
    // isGeneratingMissing true forever, which disables Generate Missing
    // permanently and is exactly the symptom the wrapper's own comment
    // predicted. A protection a call site can forget is not a protection.
    setIsGeneratingMissing(true);
    try {
      setGenerationProgress({ current: 0, total: 0 });
      await new Promise<void>(resolve => setTimeout(resolve, 0));

      let generated = 0;
      let failed = 0;
      let empty = 0;
      // Typed-leaf tallies, tracked separately - see the worker for why they are
      // not folded into the counters above.
      let ibroGenerated = 0;
      let ibroFailed = 0;
      const ibroGeneratedKeys: string[] = [];
      const newForecasts: Record<string, any> = {};
      const generatedIds: string[] = [];

      // ── Phase 1: Pre-Aggregation ─────────────────────────────────────────────
      // Single O(N) pass over data builds a Map<cohortKey, rows[]>.
      // All per-cohort filter chains inside the loop become O(1) .get() lookups.
      // Built BEFORE target selection so we can enumerate only populated cohorts.
      const cohortDataMap: CohortDataMap = buildCohortDataMap(
        data,
        wiDateCol,
        wiSegmentCol,
        wiProductCol,
        wiProductL2Col,
        wiChannelCol,
        wiChannelL2Col,
        wiTariffL1Col,
        wiTariffL2Col,
      );

      // NO CALLER REACHES THE LAST BRANCH AS OF 2026-08-09. Every call site now
      // passes either restrictToLeafKeys (both bulk doors, since they are both
      // scoped leaf runs) or cohortIds (ManageBulkDrawer's re-apply), so
      // `targets = missingStandardCohorts` does not execute.
      //
      // Left in place rather than deleted, and SAID rather than left to be
      // rediscovered. This repo has three recorded cases of dead code being
      // read as live and sized as a defect — the comment that used to sit here
      // described the fallback as the shared canonical path, which would send
      // the next reader to the wrong place. If a future caller wants the
      // unrestricted form, note the memo below it is now leaf-grain rows: four
      // scenario rows per key, and never an aggregate.
      const targets = options?.restrictToLeafKeys
        // A scoped leaf run fits IBRO leaves only. The "Standard" cohort
        // population is a separate enumeration with its own 5-part identity and
        // nothing to do with the aggregate the user selected; sweeping it in
        // would generate work nobody asked for and inflate the reported count.
        ? []
        : options?.cohortIds
          ? allCohorts.filter(c => options.cohortIds!.includes(c.id))
          : missingStandardCohorts;

      // ── Phase 2: Build IBRO cohort list (needed before workers spawn) ────────
      // Enumerate unique L1×L2 combinations that exist in the data.
      // These produce typed BaseForecast objects consumed by ForecastVsActualsTab.
      type IbroCohortSpec = { fKey: string; seg: string; prod: string; prodL2: string; chan: string; chanL2: string; tariffL1: string; tariffL2: string };
      const ibroCohortArray: IbroCohortSpec[] = [];

      if (wiInflowVal && wiOutflowVal && wiRetentionVal && wiDateCol && wiMetricCol && wiValueCol) {
        type CohortSpec = { seg: string; prod: string; prodL2: string; chan: string; chanL2: string; tariffL1: string; tariffL2: string };
        const uniqueCohorts = new Map<string, CohortSpec>();

        if (wiSegmentCol || wiProductCol || wiChannelCol || wiTariffL1Col) {
          data.forEach(row => {
            const seg    = wiSegmentCol   ? String(row[wiSegmentCol]   || 'All').trim() : 'All';
            const prod   = wiProductCol   ? String(row[wiProductCol]   || 'All').trim() : 'All';
            const prodL2 = wiProductL2Col ? String(row[wiProductL2Col] || 'All').trim() : 'All';
            const chan   = wiChannelCol   ? String(row[wiChannelCol]   || 'All').trim() : 'All';
            const chanL2 = wiChannelL2Col ? String(row[wiChannelL2Col] || 'All').trim() : 'All';
            const tarL1  = wiTariffL1Col  ? String(row[wiTariffL1Col]  || 'All').trim() : 'All';
            const tarL2  = wiTariffL2Col  ? String(row[wiTariffL2Col]  || 'All').trim() : 'All';
            const k = makeForecastKey(seg, prod, prodL2 !== '' ? prodL2 : 'All', chan, chanL2 !== '' ? chanL2 : 'All', tarL1 !== '' ? tarL1 : 'All', tarL2 !== '' ? tarL2 : 'All');
            if (!uniqueCohorts.has(k)) {
              uniqueCohorts.set(k, { seg, prod, prodL2: prodL2 || 'All', chan, chanL2: chanL2 || 'All', tariffL1: tarL1 || 'All', tariffL2: tarL2 || 'All' });
            }
          });
        } else {
          const k = makeForecastKey('All', 'All', null, 'All', null);
          uniqueCohorts.set(k, { seg: 'All', prod: 'All', prodL2: 'All', chan: 'All', chanL2: 'All', tariffL1: 'All', tariffL2: 'All' });
        }

        for (const [fKey, spec] of uniqueCohorts.entries()) {
          // Scoped run: only the leaves asked for. The filter is applied HERE,
          // after enumeration from the data, rather than by intersecting a
          // caller-supplied list — so a key that does not exist in the data is
          // simply absent rather than silently fitted from nothing.
          if (options?.restrictToLeafKeys && !options.restrictToLeafKeys.has(fKey)) continue;
          ibroCohortArray.push({ fKey, ...spec });
        }
      }

      // ── Phase 3: Worker pool ──────────────────────────────────────────────────
      // Determine how many workers to spawn — capped at hardwareConcurrency and 8.
      const runPreUnc  = options?.preHorizonUncertainty   ?? genPreHorizonUncertainty;
      const runPostExp = options?.postHorizonExpansionRate ?? genPostHorizonExpansionRate;
      const runConfHor = options?.confidenceHorizon        ?? confidenceHorizon;
      const runModel   = options?.model                   ?? selectedForecastModel;

      const hardwareCores = typeof navigator !== 'undefined' ? (navigator.hardwareConcurrency || 4) : 4;
      const poolSize = Math.min(hardwareCores, 8, Math.max(targets.length, ibroCohortArray.length, 1));

      // Distribute standard cohorts and IBRO cohorts across workers round-robin.
      type StandardCohortSpec = { id: string; segment: string; product: string; productL2?: string; channel?: string; channelL2?: string; tariffL1?: string; tariffL2?: string; scenario: string };
      const workerStandard: StandardCohortSpec[][] = Array.from({ length: poolSize }, () => []);
      const workerIbro: IbroCohortSpec[][] = Array.from({ length: poolSize }, () => []);

      targets.forEach((c, i) => {
        workerStandard[i % poolSize].push({
          id: c.id,
          segment: c.segment,
          product: c.product,
          productL2: c.productL2,
          channel: c.channel,
          channelL2: c.channelL2,
          tariffL1: c.tariffL1,
          tariffL2: c.tariffL2,
          scenario: c.scenario,
        });
      });
      ibroCohortArray.forEach((spec, i) => workerIbro[i % poolSize].push(spec));

      // Flatten the entire pre-aggregated map into a single array shared by every worker.
      // Each worker receives all rows so it can rebuild the leaf buckets it needs and derive
      // any 'All'-dimension aggregate by summing those leaves (bottom-up — there is no
      // O(N) scan fallback any more). The dataset is small enough that structured-clone
      // overhead is acceptable.
      const allRows: PreAggRow[] = Array.from(cohortDataMap.values()).flat();

      const workerConfig = {
        wiDateCol, wiMetricCol, wiValueCol,
        wiSegmentCol, wiProductCol, wiProductL2Col,
        wiChannelCol, wiChannelL2Col,
        wiTariffL1Col, wiTariffL2Col,
        wiInflowVal: wiInflowVal || '',
        wiOutflowVal: wiOutflowVal || '',
        wiBaseVal: wiBaseVal || '',
        wiRetentionVal: wiRetentionVal || '',
        wiArpuCol: wiArpuCol || '',
        wiRevenueCol: wiRevenueCol || '',
        genLength,
        runPreUnc,
        runPostExp,
        runConfHor,
        runModel,
        autoModel:      options?.autoModel      ?? true,
        autoConfidence: options?.autoConfidence ?? true,
        // P10 — cohort key -> flagged yyyy-MM months (reason text dropped; the
        // worker only needs to know which months to substitute).
        oneOffMonths: (() => {
          const out: Record<string, string[]> = {};
          for (const key in oneOffMonths) out[key] = oneOffMonths[key].map(f => f.month);
          return out;
        })(),
      };

      // Bottom-up short-leaf warnings collected across the worker pool.
      const collectedShortLeafWarnings = new Map<string, { shortLeaves: number; totalLeaves: number; share: number }>();
      // Typed-path cohorts that produced no forecast, NAMED. Accumulated across
      // the whole pool: each worker only sees its own slice, so a per-worker
      // list would understate coverage for the run as a whole.
      const collectedSkipped: SkippedCohort[] = [];

      // A scoped run has no standard targets by construction, so `targets.length`
      // would leave total at 0 while current climbed. Harmless today - Step 1 is
      // the only scoped caller and it opens no progress modal - but that is an
      // apparent guarantee resting on one call site, not a real one.
      setGenerationProgress({ current: 0,
        total: options?.restrictToLeafKeys ? options.restrictToLeafKeys.size : targets.length });
      const newTypedForecasts = new Map<string, BaseForecast>();

      await Promise.all(
        Array.from({ length: poolSize }, (_, w) =>
          new Promise<void>((resolve) => {
            const worker = new Worker(
              new URL('./workers/forecasting.worker.ts', import.meta.url),
              { type: 'module' },
            );

            worker.onmessage = (ev: MessageEvent) => {
              const result = ev.data as {
                newForecasts: Record<string, any>;
                generatedIds: string[];
                newTypedForecasts: Array<[string, BaseForecast]>;
                generated: number;
                failed: number;
                empty?: number;
                /** Typed-leaf tallies. Optional so a worker build predating them
                 *  reads as absent rather than as zero work done. */
                ibroGenerated?: number;
                ibroFailed?: number;
                ibroGeneratedKeys?: string[];
                shortLeafWarnings?: Array<[string, { shortLeaves: number; totalLeaves: number; share: number }]>;
                skipped?: SkippedCohort[];
              };
              // Bottom-up: aggregates whose seasonal amplitude may be understated
              // because most constituent leaves are too short to fit seasonality.
              collectedSkipped.push(...(result.skipped ?? []));
              for (const [cohortId, w] of result.shortLeafWarnings ?? []) {
                collectedShortLeafWarnings.set(cohortId, w);
              }
              Object.assign(newForecasts, result.newForecasts);
              generatedIds.push(...result.generatedIds);
              generated += result.generated;
              failed    += result.failed;
              empty     += result.empty ?? 0;
              ibroGenerated += result.ibroGenerated ?? 0;
              ibroFailed    += result.ibroFailed ?? 0;
              ibroGeneratedKeys.push(...(result.ibroGeneratedKeys ?? []));
              for (const [k, v] of result.newTypedForecasts) {
                console.log(`[generateAllMissingForecasts] BaseForecast built for store key: ${k}`);
                newTypedForecasts.set(k, v);
              }
              setGenerationProgress(prev => ({
                ...prev,
                // advance for every processed cohort (generated + insufficient + empty).
                // A scoped leaf run has no standard cohorts at all, so without the
                // typed tallies the bar would never move while real work happened.
                current: prev.current + result.generated + result.failed + (result.empty ?? 0)
                       + (options?.restrictToLeafKeys ? (result.ibroGenerated ?? 0) + (result.ibroFailed ?? 0) : 0),
              }));
              worker.terminate();
              resolve();
            };

            worker.onerror = (err) => {
              console.error(`[Worker ${w} error]`, err);
              // Count all cohorts this worker was responsible for as failed.
              const workerTotal = workerStandard[w].length;
              failed += workerTotal;
              setGenerationProgress(prev => ({ ...prev, current: prev.current + workerTotal }));
              worker.terminate();
              resolve(); // resolve so Promise.all doesn't short-circuit
            };

            worker.postMessage({
              workerId: w,
              config: workerConfig,
              rows: allRows,
              standardCohorts: workerStandard[w],
              ibroCohorts: workerIbro[w],
            });
          })
        )
      );

      setGenerationProgress({ current: 0, total: 0 });
      setShortLeafWarnings(prev => ({ ...prev, ...Object.fromEntries(collectedShortLeafWarnings) }));
      setSavedForecasts(prev => ({ ...prev, ...newForecasts }));

      if (newTypedForecasts.size > 0) {
        setForecastStore(prev => {
          const next = new Map(prev);
          for (const [k, v] of newTypedForecasts.entries()) next.set(k, v);
          return next;
        });
      }

      // Record the run in ForecastContext history.
      const now = new Date().toISOString();
      const record: BulkRunRecord = {
        id: Math.random().toString(36).slice(2, 11),
        name: options?.name?.trim() || `Bulk Run — ${format(new Date(now), 'dd MMM yyyy, HH:mm')}`,
        comment: options?.comment?.trim() ?? '',
        timestamp: now,
        settings: {
          model:                   options?.model ?? selectedForecastModel,
          preHorizonUncertainty:   options?.preHorizonUncertainty  ?? genPreHorizonUncertainty,
          postHorizonExpansionRate: options?.postHorizonExpansionRate ?? genPostHorizonExpansionRate,
          confidenceHorizon:       options?.confidenceHorizon ?? confidenceHorizon,
          forecastLength: genLength,
        },
        // A scoped leaf run does zero STANDARD-cohort work by construction, so
        // reporting those tallies would record 'generated 0' for a run that just
        // fitted every leaf asked of it - and the drawer would render it as a run
        // that did nothing. Report what the run actually did.
        cohortIds: options?.restrictToLeafKeys ? ibroGeneratedKeys : generatedIds,
        generated: options?.restrictToLeafKeys ? ibroGenerated : generated,
        failed:    options?.restrictToLeafKeys ? ibroFailed    : failed,
      };
      console.log('[generateAllMissingForecasts] saving BulkRunRecord:', { name: record.name, comment: record.comment, generated, failed });
      setBulkRuns(prev => [...prev, record]);

      return options?.restrictToLeafKeys
        ? { generated: ibroGenerated, failed: ibroFailed, skipped: collectedSkipped }
        : { generated, failed, skipped: collectedSkipped };
    } finally {
      // Unconditional. Every exit - return, throw, or a rejection from the
      // worker pool - clears the flag, so no caller has to remember to.
      setIsGeneratingMissing(false);
    }
  }, [allCohorts, missingStandardCohorts, computeCohortForecastData, selectedForecastModel, genPreHorizonUncertainty, genPostHorizonExpansionRate, confidenceHorizon, genLength, data, wiDateCol, wiMetricCol, wiValueCol, wiInflowVal, wiOutflowVal, wiRetentionVal, wiBaseVal, wiArpuCol, wiRevenueCol, wiSegmentCol, wiProductCol, wiProductL2Col, wiChannelCol, wiChannelL2Col, wiTariffL1Col, wiTariffL2Col, oneOffMonths]); // eslint-disable-line react-hooks/exhaustive-deps

  // After a single-combo forecast is saved, check whether there are remaining combinations
  // without a forecast and show the bulk-generate prompt if so.
  useEffect(() => {
    if (triggerBulkCheck === 0) return;
    if (missingFittableLeafKeys.size > 0) {
      setShowBulkGeneratePrompt(true);
    }
  }, [triggerBulkCheck]); // eslint-disable-line react-hooks/exhaustive-deps

  const hasLegacyBaseline = Object.keys(savedForecasts).length > 0;

  /**
   * HAS THIS SESSION PRODUCED A FORECAST? The Step 2/3 unlock.
   *
   * Derived from the STORE, which is the corollary of surface-not-store this
   * codebase already applies elsewhere: a gate reads what exists, not what some
   * transient path happened to populate. `forecastStore` survives a selection
   * change, a tab move and a session restore, so the gate cannot re-lock on
   * navigation — a restored session with forecasts arrives unlocked.
   *
   * WHAT IT REPLACED. The gate was `hasLegacyBaseline` alone: a non-empty
   * `savedForecasts`, the pre-bottom-up 5-part store, which only the STANDARD
   * chart-series generation path writes. Bulk leaf generation writes
   * `forecastStore` and nothing else, so:
   *
   *   - Step 1's scoped aggregate generate has NEVER unlocked Step 2. It has
   *     passed `restrictToLeafKeys` since Session H, and that sets `targets =
   *     []`, so no Standard cohort is ever enrolled. True at d4a7f8a, at
   *     ec77b34, and at c161a42.
   *   - The Overall whole-book door DID unlock it, until 76c7c53. That commit
   *     made both doors scoped leaf runs — correct for the missing-count defect
   *     it fixed, and it removed the only remaining writer of `savedForecasts`
   *     during bulk generation. Introduced there, by me.
   *
   * Jon's testimony is that generation has always been the unlock and no save
   * action has ever existed. Nothing contradicts it: there is no save control,
   * `hasLegacyBaseline` is named for the legacy store rather than for a saved
   * baseline, and EXPECTED.md already records `savedForecasts` as the older half
   * of a two-store relationship it wants replaced, not as a designed gate.
   *
   * A retired aggregate fit does not count. The seam refuses to return one, so
   * a store holding only those can produce no forecast for any view, and
   * unlocking on it would be the indicator claiming coverage the reader cannot
   * reach.
   */
  const hasAnyForecast = useMemo(
    () => hasAnyUsableForecast(forecastStore, hasLegacyBaseline),
    [forecastStore, hasLegacyBaseline],
  );
  const activeStep: 1 | 2 | 3 | null =
    activeView === 'standard' ? 1 :
    activeView === 'whatif' ? 2 :
    activeView === 'vsactuals' ? 3 :
    null;

  return (
    <ForecastProvider
      baseForecast={baseForecast}
      setBaseForecast={setBaseForecast}
      adjustedForecast={adjustedForecast}
      setAdjustedForecast={setAdjustedForecast}
      forecastStore={forecastStore}
      resolveForecast={resolveForecast}
      canResolve={canResolve}
      setForecastStore={setForecastStore}
      hasLegacyBaseline={hasLegacyBaseline}
      updatedAt={forecastUpdatedAt}
      bulkRuns={bulkRuns}
      setBulkRuns={setBulkRuns}
    >
    <div className="flex flex-col h-screen bg-slate-50 font-sans text-slate-900 overflow-hidden">
      {/* Top Navigation Bar */}
      <header className="bg-white border-b border-slate-200 shrink-0 z-10 shadow-sm">
        {/* Brand row */}
        <div className="px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3 cursor-pointer" onClick={() => setActiveView('home')}>
            {!logoError ? (
              <img
                src="/logo.png"
                alt="PROSPECT"
                className="h-8 object-contain"
                onError={() => setLogoError(true)}
                referrerPolicy="no-referrer"
              />
            ) : (
              <div className="flex items-center gap-2 text-[#e60000]">
                <FileSpreadsheet size={24} strokeWidth={1.5} />
              </div>
            )}
            <span className="text-xs tracking-tight text-slate-900 whitespace-nowrap">
              <span className="font-bold text-sm">P</span>redictive{' '}
              <span className="font-bold text-sm">R</span>eporting{' '}
              <span className="font-bold text-sm">O</span>f{' '}
              <span className="font-bold text-sm">S</span>cenarios &{' '}
              <span className="font-bold text-sm">P</span>lanned{' '}
              <span className="font-bold text-sm">E</span>xecution for{' '}
              <span className="font-bold text-sm">C</span>ommercial{' '}
              <span className="font-bold text-sm">T</span>rends
            </span>
          </div>

          {/* Utility nav — items outside the three-step journey */}
          <div className="flex items-center gap-1">
            <button
              onClick={() => setActiveView('home')}
              className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                activeView === 'home'
                  ? 'bg-slate-100 text-slate-900'
                  : 'text-slate-500 hover:text-slate-900 hover:bg-slate-50'
              }`}
            >
              {t('home')}
            </button>
            <button
              // LABEL aligned to TARGET, not the reverse. This is the only
              // site that sets 'overall', so repointing the target would make
              // the Overall Forecast view - and the Generate Missing door on
              // it - unreachable. Step 1 already has six routes in and needs
              // no nav item; this destination had none that named it.
              onClick={() => setActiveView('overall')}
              className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                activeView === 'overall'
                  ? 'bg-slate-100 text-slate-900'
                  : 'text-slate-500 hover:text-slate-900 hover:bg-slate-50'
              }`}
            >
              {t('nav_overall_forecast')}
            </button>
            <button
              onClick={() => setActiveView('compare')}
              className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                activeView === 'compare'
                  ? 'bg-slate-100 text-slate-900'
                  : 'text-slate-500 hover:text-slate-900 hover:bg-slate-50'
              }`}
            >
              {t('compare_scenarios')}
            </button>
          </div>
        </div>

        {/* Step indicator row — always visible so users can see the journey */}
        <StepIndicator
          activeStep={activeStep}
          hasBaseline={hasAnyForecast}
          hasData={data.length > 0}
          onStepClick={(step) => {
            if (step === 1) setActiveView('standard');
            else if (step === 2) setActiveView('whatif');
            else if (step === 3) setActiveView('vsactuals');
          }}
        />

        {/* View filter bar — shown on Steps 2 and 3; each step has its own filter memory */}
        {(activeView === 'whatif' || activeView === 'vsactuals') && (
          <ViewFilterBar
            filter={activeView === 'whatif' ? step2Filter : step3Filter}
            onChange={activeView === 'whatif' ? handleStep2FilterChange : handleStep3FilterChange}
            segments={availableSegments}
            productTree={productTree}
            channelTree={channelTree}
            tariffTree={tariffTree}
            hasForecast={
              activeView === 'whatif'
                ? canResolve(filterToKey(step2Filter))
                : canResolve(filterToKey(step3Filter))
            }
            /* Gated on the SAME two-state split as the Step 2 panel. Passing the
               reason unconditionally would suppress the Step 1 link in a session
               where nothing has been generated at all - and there Step 1 is
               exactly the right action. resolveForecast reports
               'insufficient-history' for a key whose leaves all failed to fit,
               which is indistinguishable from "no forecasts exist yet" unless
               the store is consulted first. */
            /* The SAME predicate as the step indicator's gate, not a second
               hand-rolled variant. This read `forecastStore.size > 0 ||
               hasLegacyBaseline`, which disagrees with the gate in exactly the
               retired-aggregate-fit case: size is non-zero, the seam serves
               nothing, and the bar would offer a widen-the-filter hint where
               the honest answer is the Step 1 link. Two nearly-identical
               predicates in one file is the drift this codebase keeps
               recording, so there is now one. */
            noForecastReason={
              hasAnyForecast
                ? resolveForecast(filterToKey(activeView === 'whatif' ? step2Filter : step3Filter)).reason
                : null
            }
            onGoToStep1={() => setActiveView('standard')}
          />
        )}
      </header>

      {/* Main Content Area */}
      <main className="flex-1 overflow-hidden flex">
        {/* HOME VIEW */}
        {activeView === 'home' && (
          <HomeTab
            data={data}
            isLoading={isLoading}
            error={error}
            handleFileUpload={handleFileUpload}
            handleImportActualsFile={handleImportActualsFile}
            handleImportSaveFile={handleImportSaveFile}
            importSaveResult={importSaveResult}
            onDismissImportResult={() => setImportSaveResult(null)}
            setActiveView={setActiveView}
          />
        )}

        {/* STANDARD FORECAST VIEW */}
        {activeView === 'standard' && (
          <StandardForecastTab
            data={data}
            columns={columns}
            wiDateCol={wiDateCol}
            setWiDateCol={setWiDateCol}
            wiMetricCol={wiMetricCol}
            setWiMetricCol={setWiMetricCol}
            wiValueCol={wiValueCol}
            setWiValueCol={setWiValueCol}
            wiArpuCol={wiArpuCol}
            setWiArpuCol={setWiArpuCol}
            wiRevenueCol={wiRevenueCol}
            setWiRevenueCol={setWiRevenueCol}
            wiInflowVal={wiInflowVal}
            setWiInflowVal={setWiInflowVal}
            wiOutflowVal={wiOutflowVal}
            setWiOutflowVal={setWiOutflowVal}
            wiBaseVal={wiBaseVal}
            setWiBaseVal={setWiBaseVal}
            wiRetentionVal={wiRetentionVal}
            setWiRetentionVal={setWiRetentionVal}
            wiSegmentCol={wiSegmentCol}
            setWiSegmentCol={setWiSegmentCol}
            wiProductCol={wiProductCol}
            setWiProductCol={setWiProductCol}
            wiProductL2Col={wiProductL2Col}
            setWiProductL2Col={setWiProductL2Col}
            wiChannelCol={wiChannelCol}
            setWiChannelCol={setWiChannelCol}
            wiChannelL2Col={wiChannelL2Col}
            setWiChannelL2Col={setWiChannelL2Col}
            wiTariffL1Col={wiTariffL1Col}
            wiTariffL2Col={wiTariffL2Col}
            productTree={productTree}
            channelTree={channelTree}
            tariffTree={tariffTree}
            segmentValue={segmentValue}
            setSegmentValue={setSegmentValue}
            productValue={productValue}
            setProductValue={setProductValue}
            productL2Value={productL2Value}
            setProductL2Value={setProductL2Value}
            channelValue={channelValue}
            setChannelValue={setChannelValue}
            channelL2Value={channelL2Value}
            setChannelL2Value={setChannelL2Value}
            tariffValue={tariffValue}
            setTariffValue={setTariffValue}
            tariffL2Value={tariffL2Value}
            setTariffL2Value={setTariffL2Value}
            segmentMode={segmentMode}
            setSegmentMode={setSegmentMode}
            productMode={productMode}
            setProductMode={setProductMode}
            channelMode={channelMode}
            setChannelMode={setChannelMode}
            stdScenario={stdScenario}
            setStdScenario={setStdScenario}
            selectedForecastModel={selectedForecastModel}
            setSelectedForecastModel={setSelectedForecastModel}
            preHorizonUncertainty={preHorizonUncertainty}
            setPreHorizonUncertainty={setPreHorizonUncertainty}
            postHorizonExpansionRate={postHorizonExpansionRate}
            setPostHorizonExpansionRate={setPostHorizonExpansionRate}
            confidenceHorizon={confidenceHorizon}
            setConfidenceHorizon={setConfidenceHorizon}
            generateStandardForecast={generateStandardForecast}
            aggregateState={stdAggregateState}
            generateResult={stdGenerateResult}
            notice={notice}
            error={error}
            forecastData={stdPanelRows}
            compareCategories={compareCategories}
            windowSize={windowSize}
            setWindowSize={setWindowSize}
            windowOffset={windowOffset}
            setWindowOffset={setWindowOffset}
            stdChartData={stdChartData}
            formatNumber={formatNumber}
            downloadExcel={downloadExcel}
            setActiveView={setActiveView}
            COLORS={COLORS}
            onOpenManageBulk={() => setShowManageBulkDrawer(true)}
            cohortGenLog={cohortGenLog}
            onSelectCohort={onSelectCohort}
            shortLeafWarnings={shortLeafWarnings}
            oneOffMonths={oneOffMonths}
            setOneOffMonths={setOneOffMonths}
          />
        )}

        {/* MARKET EVENTS VIEW (Step 2)

            noForecastReason is recomputed at render from the live filter, by the
            same call that drives ViewFilterBar's hasForecast above, so the panel
            and the filter bar can never disagree about whether this selection
            resolves. Recomputed, never remembered. */}
        {activeView === 'whatif' && (
          <WhatIfTab
            noForecastReason={resolveForecast(filterToKey(step2Filter)).reason}
            data={data}
            wiDateCol={wiDateCol}
            wiSegmentCol={wiSegmentCol}
            wiProductCol={wiProductCol}
            wiProductL2Col={wiProductL2Col}
            wiChannelCol={wiChannelCol}
            wiChannelL2Col={wiChannelL2Col}
            wiTariffL1Col={wiTariffL1Col}
            wiTariffL2Col={wiTariffL2Col}
            wiMetricCol={wiMetricCol}
            wiInflowVal={wiInflowVal}
            wiRetentionVal={wiRetentionVal}
            wiOutflowVal={wiOutflowVal}
            wiArpuCol={wiArpuCol}
            wiValueCol={wiValueCol}
            wiRevenueCol={wiRevenueCol}
            productTree={productTree}
            channelTree={channelTree}
            tariffTree={tariffTree}
            selectedTariffs={selectedTariffs}
            setSelectedTariffs={setSelectedTariffs}
            cohortAvgArpu={cohortAvgArpu}
            downloadExcel={downloadExcel}
            formatNumber={formatNumber}
            newEvent={newEvent}
            setNewEvent={setNewEvent}
            marketEvents={marketEvents}
            setMarketEvents={setMarketEvents}
            addMarketEvent={addMarketEvent}
            removeMarketEvent={removeMarketEvent}
            updateMarketEvent={updateMarketEvent}
            yieldEvents={yieldEvents}
            newYieldEvent={newYieldEvent}
            setNewYieldEvent={setNewYieldEvent}
            addYieldEvent={addYieldEvent}
            removeYieldEvent={removeYieldEvent}
            updateYieldEvent={updateYieldEvent}
            clearAllYieldEvents={clearAllYieldEvents}
            pricingEvents={pricingEvents}
            newPricingEvent={newPricingEvent}
            setNewPricingEvent={setNewPricingEvent}
            addPricingEvent={addPricingEvent}
            removePricingEvent={removePricingEvent}
            updatePricingEvent={updatePricingEvent}
            clearAllPricingEvents={clearAllPricingEvents}
            setActiveView={setActiveView}
          />
        )}

        {/* FORECAST VS ACTUALS VIEW */}
        {activeView === 'vsactuals' && (
          <ForecastVsActualsTab
            data={data}
            wiDateCol={wiDateCol}
            wiMetricCol={wiMetricCol}
            wiValueCol={wiValueCol}
            wiInflowVal={wiInflowVal}
            wiOutflowVal={wiOutflowVal}
            wiRetentionVal={wiRetentionVal}
            wiBaseVal={wiBaseVal}
            wiArpuCol={wiArpuCol}
            wiRevenueCol={wiRevenueCol}
            wiSegmentCol={wiSegmentCol}
            wiProductCol={wiProductCol}
            wiProductL2Col={wiProductL2Col}
            wiChannelCol={wiChannelCol}
            wiChannelL2Col={wiChannelL2Col}
            wiTariffL1Col={wiTariffL1Col}
            wiTariffL2Col={wiTariffL2Col}
            formatNumber={formatNumber}
            setActiveView={setActiveView}
            onAcceptChallengerModel={acceptChallengerModel}
            onAcceptAllChallengerModels={acceptAllChallengerModels}
            onRunChallengerForecast={runChallengerForecast}
            onAcceptPreviewForecast={acceptPreviewForecast}
            handleImportActualsFile={handleImportActualsFile}
            onRemoveActuals={handleRemoveActuals}
            onRequestExport={openExportModal}
            activeFilter={step3Filter}
            onCohortFilterChange={handleStep3FilterChange}
          />
        )}

        {/* OVERALL FORECAST VIEW */}
        {activeView === 'overall' && (
          <OverallForecastTab
            allCohorts={allCohorts}
            overallSegmentFilter={overallSegmentFilter}
            setOverallSegmentFilter={setOverallSegmentFilter}
            overallProductFilter={overallProductFilter}
            setOverallProductFilter={setOverallProductFilter}
            overallChannelFilter={overallChannelFilter}
            setOverallChannelFilter={setOverallChannelFilter}
            overallTypeFilter={overallTypeFilter}
            setOverallTypeFilter={setOverallTypeFilter}
            overallStatusFilter={overallStatusFilter}
            setOverallStatusFilter={setOverallStatusFilter}
            onOpenExportModal={openExportModal}
            setSavedForecasts={setSavedForecasts}
            savedForecasts={savedForecasts}
            missingCohorts={missingStandardCohorts}
            doorState={overallDoorState}
            derivedAggregateCount={derivedAggregateCount}
            onGenerateMissing={() => openBulkPrompt(null)}
            setGeneratingCohort={setGeneratingCohort}
            setViewingCohort={setViewingCohort}
            isGeneratingMissing={isGeneratingMissing}
            generationProgress={generationProgress}
          />
        )}
        
        {activeView === 'compare' && (
          <ScenarioCompareTab
            globalSegments={availableSegments.filter(s => s !== 'All')}
            globalProductTree={productTree}
            globalChannelTree={channelTree}
            globalTariffTree={tariffTree}
          />
        )}
      </main>
      {/* Generate Cohort Forecast Modal */}
      <GenerateCohortForecastModal
        generatingCohort={generatingCohort}
        setGeneratingCohort={setGeneratingCohort}
        genInflowUplift={genInflowUplift}
        setGenInflowUplift={setGenInflowUplift}
        genInflowLag={genInflowLag}
        setGenInflowLag={setGenInflowLag}
        genRetentionUplift={genRetentionUplift}
        setGenRetentionUplift={setGenRetentionUplift}
        genRetentionLag={genRetentionLag}
        setGenRetentionLag={setGenRetentionLag}
        genArpuUplift={genArpuUplift}
        setGenArpuUplift={setGenArpuUplift}
        genPreHorizonUncertainty={genPreHorizonUncertainty}
        setGenPreHorizonUncertainty={setGenPreHorizonUncertainty}
        genPostHorizonExpansionRate={genPostHorizonExpansionRate}
        setGenPostHorizonExpansionRate={setGenPostHorizonExpansionRate}
        genLength={genLength}
        genManualOverrides={genManualOverrides}
        generateCohortForecast={generateCohortForecast}
      />
      {/* View Cohort Forecast Modal */}
      <ViewCohortForecastModal
        viewingCohort={viewingCohort}
        setViewingCohort={setViewingCohort}
        savedForecasts={savedForecasts}
        wiDateCol={wiDateCol}
      />
      {/* Import Actuals Month Selector Modal */}
      {importActualsState && (
        <ImportActualsModal
          months={importActualsState.months}
          onConfirm={handleImportActualsConfirm}
          onCancel={() => setImportActualsState(null)}
        />
      )}
      {/* Bulk Generate Modal — shown after a single-combo forecast is generated */}
      <BulkGenerateModal
        // ONE way in, and it is always the confirm. Both doors - Step 1's
        // scoped "Generate N missing" and Overall Forecast's whole-book
        // "Generate Missing" - now share a single lifecycle: confirm, then
        // generating, then the coverage panel. The difference between them is
        // what `scope` says and what the confirm runs, never whether the user
        // is shown the settings first.
        isOpen={showBulkGeneratePrompt}
        onClose={() => { setShowBulkGeneratePrompt(false); setPendingScopedRun(null); }}
        scope={pendingScopedRun ? { label: pendingScopedRun.label } : null}
        sourceCohort={bulkSourceCohort}
        // The count the header promises must be the count the run will attempt.
        // A scoped run says how many leaves ITS selection is missing; reading
        // the whole book's figure here would name a number this run will not
        // touch.
        // LEAF GRAIN on both arms. The row array has four scenario rows per
        // key, so its length is four times the number of missing leaves -
        // the inflation that turned 36 keys into "144 combinations".
        missingCount={pendingScopedRun ? pendingScopedRun.leafKeys.length : missingFittableLeafKeys.size}
        // SETTINGS TRUTH. These are the `gen*` values the bulk generator
        // actually falls back to, not the Step 1 sidebar values this once
        // passed. Before 2026-08-08 the panel displayed preHorizonUncertainty
        // (1.0) and postHorizonExpansionRate (1.0) while every bulk run applied
        // genPreHorizonUncertainty (2.0) and genPostHorizonExpansionRate (5.0),
        // because onConfirm sends no numbers and the generator defaults to its
        // own. The auto-per-cohort options are on by default and hide both
        // numbers, which is why a panel that misreported them went unnoticed.
        //
        // The display was corrected to the applied values, NOT the applied
        // values to the display: making the run honour 1.0/1.0 would change
        // every forecast it produces, and this session moves no figure.
        params={{
          preHorizonUncertainty: genPreHorizonUncertainty,
          postHorizonExpansionRate: genPostHorizonExpansionRate,
          confidenceHorizon,
          forecastLength: genLength,
        }}
        currentModel={selectedForecastModel}
        generationProgress={generationProgress}
        onConfirm={async (opts) => {
          // Redundant since the finally moved INSIDE
          // generateAllMissingForecasts, and kept deliberately: it costs
          // nothing and clearing an already-cleared flag is idempotent.
          //
          // Its original comment claimed the function had no finally, which is
          // no longer true - and that stale claim is worth correcting rather
          // than deleting, because it names the exact symptom this wrapper was
          // built for and that symptom recurred: Session H added a caller that
          // did not go through here, and Generate Missing was disabled for the
          // rest of Jon's walk.
          try {
            // THE SCOPED ARM. Step 1's door confirms here, and the run it
            // starts is the same scoped call the button used to make on click:
            // the ONE generator, restricted to the leaves resolved when the
            // user clicked. No second fitting path, then or now.
            if (pendingScopedRun) {
              const res = await generateAllMissingForecasts({
                ...opts, restrictToLeafKeys: new Set(pendingScopedRun.leafKeys),
              });
              const skippedKeys = res.skipped.map(sk => sk.fKey);
              setStdGenerateResult({ generated: res.generated, skipped: skippedKeys });
              // A leaf this run could not fit is now KNOWN unfittable.
              // Recording it is what stops the button offering the same
              // generate forever.
              if (skippedKeys.length) {
                setUnfittableLeaves(prev => new Set([...prev, ...skippedKeys]));
              }
              // THE USER STORY ENDS WITH THE FORECAST VISIBLE. Handed to an
              // effect rather than resolved here, because the store this run
              // just wrote has not committed yet. Reading it back through an
              // identity updater to setForecastStore would be a state setter
              // used as a getter - a reader that looks like a writer is one
              // refactor from being one, and the mirror control counts it.
              setPendingAggregateKey(pendingScopedRun.aggKey);
              // GRAIN. A scoped run counts forecast LEAVES, and its `failed`
              // names the same leaves `skipped` does - so the completion panel
              // must not add them. Carried on the result rather than inferred
              // by the panel, because only the caller knows which run it made.
              return { ...res, grain: 'leaves' as const };
            }
            // THE WHOLE-BOOK DOOR IS ALSO A SCOPED LEAF RUN. Both doors now
            // fit leaves and only leaves, so there is one run shape and one
            // grain, and the completion panel can never sum across two.
            const res = await generateAllMissingForecasts({
              ...opts, restrictToLeafKeys: new Set(missingFittableLeafKeys),
            });
            const skippedKeys = res.skipped.map(sk => sk.fKey);
            if (skippedKeys.length) {
              setUnfittableLeaves(prev => new Set([...prev, ...skippedKeys]));
            }
            return { ...res, grain: 'leaves' as const };
          } finally {
            setIsGeneratingMissing(false);
          }
        }}
      />
      <ManageBulkDrawer
        isOpen={showManageBulkDrawer}
        onClose={() => setShowManageBulkDrawer(false)}
        allCohorts={allCohorts}
        bulkRuns={bulkRuns}
        onReApply={(opts) => generateAllMissingForecasts(opts)}
        defaultModel={selectedForecastModel}
        defaultPreHorizonUncertainty={preHorizonUncertainty}
        defaultPostHorizonExpansionRate={postHorizonExpansionRate}
        defaultConfidenceHorizon={confidenceHorizon}
      />
      {/* Export filename modal — triggered by any Export button in the app */}
      <ExportFilenameModal
        isOpen={showExportModal}
        defaultName={t('app_prospect_forecast_save', { p0: format(new Date(), 'dd MMM yyyy HH:mm') })}
        onConfirm={fileName => { exportSession(fileName); setShowExportModal(false); }}
        onClose={() => setShowExportModal(false)}
      />
    </div>
    </ForecastProvider>
  );
}

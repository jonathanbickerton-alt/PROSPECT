import React, { useState, useMemo, useEffect, useCallback } from 'react';
import * as XLSX from 'xlsx';
import { FileSpreadsheet } from 'lucide-react';
import { format, isValid, parse } from 'date-fns';
import { calculateHoltWinters, MarketEvent, computeWhatIfData, WhatIfConfig, getUniqueCombos, calculateBaseForecast } from './utils/forecasting';
import type { AggregatedIBRORow } from './utils/forecasting';
import type { BaseForecast, MarketEventAdjustedForecast, ForecastModel, BulkRunRecord } from './types/forecast';
import { ForecastProvider } from './context/ForecastContext';
import HomeTab from './components/HomeTab';
import { StandardForecastTab } from './components/StandardForecastTab';
import { WhatIfTab } from './components/WhatIfTab';
import { ForecastVsActualsTab } from './components/ForecastVsActualsTab';
import { OverallForecastTab } from './components/OverallForecastTab';
import { GenerateCohortForecastModal } from './components/GenerateCohortForecastModal';
import { ViewCohortForecastModal } from './components/ViewCohortForecastModal';
import { ImportActualsModal } from './components/ImportActualsModal';
import { BulkGenerateModal } from './components/BulkGenerateModal';
import { ManageBulkDrawer } from './components/ManageBulkDrawer';
import StepIndicator from './components/StepIndicator';
import { ViewFilterBar } from './components/ViewFilterBar';
import type { ViewFilter } from './components/ViewFilterBar';

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
              <h2 className="text-base font-bold text-slate-900">Export Session</h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Full save-point — 7 sheets including actuals, forecasts, events and audit log
              </p>
            </div>
          </div>
        </div>

        {/* Filename input */}
        <div className="mx-6 mb-5">
          <label className="block text-xs font-semibold text-slate-700 mb-1.5">File Name</label>
          <input
            type="text"
            value={value}
            onChange={e => setValue(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') handleConfirm(); if (e.key === 'Escape') onClose(); }}
            autoFocus
            className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2.5 outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500/40"
          />
          <p className="text-[10px] text-slate-400 mt-1.5">Characters \\ / : * ? " &lt; &gt; | will be stripped automatically. The .xlsx extension is added automatically.</p>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 bg-slate-50 border-t border-slate-100">
          <button onClick={onClose} className="px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-800 transition-colors">
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-sm font-semibold transition-colors flex items-center gap-2"
          >
            <FileSpreadsheet size={14} />
            Download
          </button>
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
  const [activeView, setActiveView] = useState<'home' | 'standard' | 'whatif' | 'overall' | 'vsactuals'>('home');
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
  const [wiChannelCol, setWiChannelCol] = useState('');
  const [showMappingMenu, setShowMappingMenu] = useState(false);

  // Missing State Variables
  const [dateCol, setDateCol] = useState('');
  const [targetCol, setTargetCol] = useState('');
  const [segmentCol, setSegmentCol] = useState('');
  const [productCol, setProductCol] = useState('');
  const [channelCol, setChannelCol] = useState('');
  const [segmentValue, setSegmentValue] = useState('All (Aggregated)');
  const [productValue, setProductValue] = useState('All (Aggregated)');
  const [channelValue, setChannelValue] = useState('All (Aggregated)');
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
  const [whatIfData, setWhatIfData] = useState<any[]>([]);
  const [whatIfDelta, setWhatIfDelta] = useState<number | null>(null);
  const [whatIfRevenueDelta, setWhatIfRevenueDelta] = useState<number | null>(null);
  const [whatIfMissingMonths, setWhatIfMissingMonths] = useState<string[]>([]);
  const [selectedKpis, setSelectedKpis] = useState<string[]>(['Inflow Volume', 'Base Volume']);
  const [forecastLength] = useState(24);

  // Overall Forecasts State
  const [savedForecasts, setSavedForecasts] = useState<Record<string, any>>({});
  const addMarketEvent = () => {
    if (!newEvent.date || newEvent.subscriberVolume === undefined) return;
    // Outflow events always represent subscribers leaving — negate the magnitudes so
    // the stored values are negative, which is the correct sign for an increase in outflow.
    const isOutflow = newEvent.scenario === 'Outflow';
    const neg = (v: number) => isOutflow ? -Math.abs(v) : v;
    const event: MarketEvent = {
      id: Math.random().toString(36).substr(2, 9),
      scenario: newEvent.scenario as any,
      segment: newEvent.segment || 'All',
      product: newEvent.product || 'All',
      channel: newEvent.channel || 'All',
      date: newEvent.date,
      subscriberVolume: neg(newEvent.subscriberVolume || 0),
      customerVolume:   neg(newEvent.customerVolume   || 0),
      revenue:          neg(newEvent.revenue           || 0),
      arpu:             neg(newEvent.arpu              || 0),
      comment: newEvent.comment || '',
      contractLength: newEvent.contractLength ?? 24,
    };
    setMarketEvents(prev => [...prev, event]);
    setNewEvent({
      scenario: 'Inflow',
      segment: 'All',
      product: 'All',
      channel: 'All',
      date: format(new Date(), 'yyyy-MM'),
      subscriberVolume: 0,
      customerVolume: 0,
      revenue: 0,
      arpu: 0,
      comment: '',
      contractLength: 24,
    });
  };

  const removeMarketEvent = (id: string) => {
    setMarketEvents(prev => prev.filter(e => e.id !== id));
  };

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

  // ---------------------------------------------------------------------------
  // Session export — builds a full save-point workbook across 7 sheets.
  // Triggered from the filename modal; fileName has already been sanitised.
  // ---------------------------------------------------------------------------
  const exportSession = (fileName: string) => {
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
          out[col] = row[col];
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
    // One row per cohort-month.  Cohort metadata (model, params, bulk run info)
    // is denormalised into every row for easy filtering in Excel.
    const bfRows: Record<string, any>[] = [];

    // Typed BaseForecast (from What-If / Actuals Review)
    if (baseForecast) {
      const logEntry = cohortGenLog.find(e =>
        e.cohortId.startsWith(`${baseForecast.cohort.segment}|${baseForecast.cohort.product}|${baseForecast.cohort.channel}`)
      );
      const bulkRun = bulkRuns.find(r =>
        r.cohortIds.includes(`${baseForecast.cohort.segment}|${baseForecast.cohort.product}|${baseForecast.cohort.channel}|Standard Forecast|${baseForecast.cohort.scenario}`)
      );
      const meta = {
        Cohort_Key: `${baseForecast.cohort.segment}|${baseForecast.cohort.product}|${baseForecast.cohort.channel}|${baseForecast.cohort.scenario}`,
        Segment: baseForecast.cohort.segment,
        Product: baseForecast.cohort.product,
        Channel: baseForecast.cohort.channel,
        Scenario: baseForecast.cohort.scenario,
        Model_Used: baseForecast.modelUsed ?? 'Holt Linear',
        Pre_Horizon_Uncertainty_Pct: preHorizonUncertainty,
        Post_Horizon_Expansion_Rate_Pct: postHorizonExpansionRate,
        Confidence_Horizon_Months: confidenceHorizon,
        Forecast_Length_Months: stdForecastLength,
        Bulk_Run_Name: bulkRun?.name ?? '',
        Bulk_Run_Comment: bulkRun?.comment ?? '',
        Generated_At: logEntry?.timestamp ? format(new Date(logEntry.timestamp), 'dd MMM yyyy HH:mm') : '',
        Source: 'Typed BaseForecast',
        Seed_Base_Volume: baseForecast.seedBaseVolume,
        Historical_Months: baseForecast.historicalMonths,
        Last_Historical_Inflow: baseForecast.lastHistoricalInflow,
        Last_Historical_Outflow: baseForecast.lastHistoricalOutflow,
      };
      baseForecast.months.forEach(bm => {
        bfRows.push({
          ...meta,
          Month: bm.month,
          Inflow_Mean: bm.inflow.mean,
          Inflow_Optimistic: bm.inflow.optimistic,
          Inflow_Pessimistic: bm.inflow.pessimistic,
          Outflow_Mean: bm.outflow.mean,
          Outflow_Optimistic: bm.outflow.optimistic,
          Outflow_Pessimistic: bm.outflow.pessimistic,
          Retention_Mean: bm.retention.mean,
          Retention_Optimistic: bm.retention.optimistic,
          Retention_Pessimistic: bm.retention.pessimistic,
          ARPU_Mean: bm.arpu.mean,
          ARPU_Optimistic: bm.arpu.optimistic,
          ARPU_Pessimistic: bm.arpu.pessimistic,
        });
      });
    }

    // Legacy savedForecasts (Overall Forecast view)
    Object.entries(savedForecasts).forEach(([key, forecastRowsRaw]) => {
      const parts = key.split('|');
      const seg      = parts[0] || 'All';
      const prod     = parts[1] || 'All';
      const chan      = parts.length >= 5 ? (parts[2] || 'All') : 'All';
      const fcastType = parts.length >= 5 ? parts[3] : parts[2];
      const scenario  = parts.length >= 5 ? parts[4] : parts[3];
      const logEntry  = cohortGenLog.find(e => e.cohortId === key);
      const bulkRun   = bulkRuns.find(r => r.cohortIds.includes(key));
      const legacyMeta = {
        Cohort_Key: key,
        Segment: seg,
        Product: prod,
        Channel: chan,
        Scenario: scenario ?? '',
        Model_Used: logEntry?.modelUsed ?? 'Holt Linear',
        Pre_Horizon_Uncertainty_Pct: preHorizonUncertainty,
        Post_Horizon_Expansion_Rate_Pct: postHorizonExpansionRate,
        Confidence_Horizon_Months: confidenceHorizon,
        Forecast_Length_Months: stdForecastLength,
        Bulk_Run_Name: bulkRun?.name ?? '',
        Bulk_Run_Comment: bulkRun?.comment ?? '',
        Generated_At: logEntry?.timestamp ? format(new Date(logEntry.timestamp), 'dd MMM yyyy HH:mm') : '',
        Source: fcastType ?? 'Standard Forecast',
      };
      (forecastRowsRaw as any[])
        .filter(r => r.Type === 'Forecast')
        .forEach(r => {
          const dateVal = r.date || r[wiDateCol];
          const d = dateVal instanceof Date ? dateVal : new Date(dateVal);
          bfRows.push({
            ...legacyMeta,
            Month: isValid(d) ? format(d, 'yyyy-MM') : String(dateVal ?? ''),
            Inflow_Mean: r['Mean (Base)'] ?? r[wiValueCol] ?? '',
            Inflow_Optimistic: r['Optimistic'] ?? '',
            Inflow_Pessimistic: r['Pessimistic'] ?? '',
            Outflow_Mean: '', Outflow_Optimistic: '', Outflow_Pessimistic: '',
            Retention_Mean: '', Retention_Optimistic: '', Retention_Pessimistic: '',
            ARPU_Mean: '', ARPU_Optimistic: '', ARPU_Pessimistic: '',
          });
        });
    });

    XLSX.utils.book_append_sheet(
      wb,
      XLSX.utils.json_to_sheet(bfRows.length ? bfRows : [{ Note: 'No baseline forecasts generated' }]),
      'Baseline_Forecasts',
    );

    // ── Sheet 3: Market_Events ────────────────────────────────────────────────
    const evtRows = marketEvents.map(e => ({
      ID: e.id,
      Scenario: e.scenario,
      Segment: e.segment,
      Product: e.product,
      Channel: e.channel,
      Start_Month: e.date,
      Subscriber_Volume: e.subscriberVolume,
      Customer_Volume: e.customerVolume,
      Revenue: e.revenue,
      ARPU: e.arpu,
      Contract_Length_Months: e.contractLength ?? 24,
      Comment: e.comment ?? '',
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
        Segment: cohort.segment,
        Product: cohort.product,
        Channel: cohort.channel,
        Scenario: cohort.scenario,
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
      Cohort_IDs: r.cohortIds.join('; '),
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

    // ── Sheet 7: Metadata ─────────────────────────────────────────────────────
    const forecastMonths = baseForecast?.months ?? [];
    const metaRows = [
      { Field: 'Export_Timestamp',       Value: format(exportTs, 'dd MMM yyyy HH:mm') },
      { Field: 'PROSPECT_Version',       Value: '1.0.0' },
      { Field: 'Active_Step',            Value: activeView },
      { Field: 'Forecast_Period_Start',  Value: forecastMonths[0]?.month ?? (bfRows[0]?.Month as string ?? '') },
      { Field: 'Forecast_Period_End',    Value: forecastMonths[forecastMonths.length - 1]?.month ?? (bfRows[bfRows.length - 1]?.Month as string ?? '') },
      { Field: 'Baseline_Cohorts',       Value: (baseForecast ? 1 : 0) + Object.keys(savedForecasts).length },
      { Field: 'Market_Events',          Value: marketEvents.length },
      { Field: 'Bulk_Runs',              Value: bulkRuns.length },
      { Field: 'Model_Switches',         Value: modelAcceptanceLog.length },
      { Field: 'Pre_Horizon_Uncertainty_Pct',       Value: preHorizonUncertainty },
      { Field: 'Post_Horizon_Expansion_Rate_Pct',   Value: postHorizonExpansionRate },
      { Field: 'Confidence_Horizon_Months',          Value: confidenceHorizon },
      { Field: 'Forecast_Length_Months',             Value: stdForecastLength },
    ];
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(metaRows), 'Metadata');

    XLSX.writeFile(wb, `${fileName}.xlsx`);
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
          const typedRows = bfRaw.filter(r => r.Source === 'Typed BaseForecast');
          if (typedRows.length > 0) {
            const first = typedRows[0];
            const restoredBf: BaseForecast = {
              cohort: {
                segment: String(first.Segment ?? 'All'),
                product:  String(first.Product  ?? 'All'),
                channel:  String(first.Channel  ?? 'All'),
                scenario: String(first.Scenario ?? 'Standard Forecast'),
              },
              seedBaseVolume:        Number(first.Seed_Base_Volume       ?? 0),
              historicalMonths:      [],
              lastHistoricalInflow:  Number(first.Last_Historical_Inflow ?? 0),
              lastHistoricalOutflow: Number(first.Last_Historical_Outflow ?? 0),
              modelUsed: (first.Model_Used ?? 'Holt Linear') as ForecastModel,
              months: typedRows.map(r => ({
                month:     String(r.Month),
                inflow:    { mean: Number(r.Inflow_Mean     ?? 0), optimistic: Number(r.Inflow_Optimistic     ?? 0), pessimistic: Number(r.Inflow_Pessimistic     ?? 0) },
                outflow:   { mean: Number(r.Outflow_Mean    ?? 0), optimistic: Number(r.Outflow_Optimistic    ?? 0), pessimistic: Number(r.Outflow_Pessimistic    ?? 0) },
                retention: { mean: Number(r.Retention_Mean  ?? 0), optimistic: Number(r.Retention_Optimistic  ?? 0), pessimistic: Number(r.Retention_Pessimistic  ?? 0) },
                arpu:      { mean: Number(r.ARPU_Mean       ?? 0), optimistic: Number(r.ARPU_Optimistic       ?? 0), pessimistic: Number(r.ARPU_Pessimistic       ?? 0) },
              })),
            };
            const fKeyImport = makeForecastKey(restoredBf.cohort.segment, restoredBf.cohort.product, restoredBf.cohort.channel);
            setForecastStore(prev => new Map(prev).set(fKeyImport, restoredBf));
            setBaseForecast(restoredBf);
            setForecastUpdatedAt(new Date().toISOString());
            const importedFilter: ViewFilter = { segment: restoredBf.cohort.segment, product: restoredBf.cohort.product, channel: restoredBf.cohort.channel };
            setStep2Filter(importedFilter);
            setStep3Filter(importedFilter);

            // Reconstruct cohortGenLog from Generated_At metadata
            if (first.Generated_At) {
              const cohortId = `${first.Segment}|${first.Product}|${first.Channel}|Standard Forecast|${first.Scenario}`;
              setCohortGenLog([{
                cohortId,
                timestamp: new Date(first.Generated_At).toISOString(),
                modelUsed: (first.Model_Used ?? 'Holt Linear') as ForecastModel,
              }]);
            }
          }

          const legacyRows = bfRaw.filter(r => r.Source !== 'Typed BaseForecast');
          if (legacyRows.length > 0) {
            const legacyMap: Record<string, any[]> = {};
            legacyRows.forEach(r => {
              const key = String(r.Cohort_Key ?? '');
              if (!key) return;
              if (!legacyMap[key]) legacyMap[key] = [];
              legacyMap[key].push({
                date: r.Month,
                Type: 'Forecast',
                'Mean (Base)':  r.Inflow_Mean,
                Optimistic:     r.Inflow_Optimistic,
                Pessimistic:    r.Inflow_Pessimistic,
              });
            });
            setSavedForecasts(legacyMap);
          }
        }

        // ── Market Events ─────────────────────────────────────────────────────
        const evtRaw: any[] = XLSX.utils.sheet_to_json(wb.Sheets['Market_Events']);
        let restoredEvents: MarketEvent[] = [];
        if (evtRaw.length > 0 && !evtRaw[0]?.Note) {
          restoredEvents = evtRaw.map(r => ({
            id:               String(r.ID ?? Math.random().toString(36).substr(2, 9)),
            scenario:         r.Scenario,
            segment:          r.Segment,
            product:          r.Product,
            channel:          r.Channel,
            date:             String(r.Start_Month ?? ''),
            subscriberVolume: Number(r.Subscriber_Volume ?? 0),
            customerVolume:   Number(r.Customer_Volume   ?? 0),
            revenue:          Number(r.Revenue           ?? 0),
            arpu:             Number(r.ARPU              ?? 0),
            contractLength:   Number(r.Contract_Length_Months ?? 24),
            comment:          String(r.Comment ?? ''),
          }));
          setMarketEvents(restoredEvents);
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
              historicalMonths:      [],
              lastHistoricalInflow:  Number(first.Last_Historical_Inflow ?? 0),
              lastHistoricalOutflow: Number(first.Last_Historical_Outflow ?? 0),
              modelUsed: (first.Model_Used ?? 'Holt Linear') as ForecastModel,
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

  const exportToExcel = () => {
    if (Object.keys(savedForecasts).length === 0) {
      alert('No forecasts to export.');
      return;
    }

    const dateColName = wiDateCol || 'Date';
    const segColName = wiSegmentCol || 'Customer_Segment';
    const prodColName = wiProductCol || 'Product';
    const chanColName = wiChannelCol || 'Channel_Level_1';
    const metricColName = wiMetricCol || 'IBRO_Scenario_Type';
    const valueColName = wiValueCol || 'Subscriber_Volume';

    // Build lookup: "yyyy-MM|segment|product|channel|scenario" → forecast values
    const forecastMap = new Map<string, { value: number; optimistic: number | null; pessimistic: number | null; forecastType: string }>();

    Object.entries(savedForecasts).forEach(([key, forecastRows]) => {
      const parts = key.split('|');
      // Handle both old 4-part and new 5-part key formats
      const segment = parts[0] || 'All';
      const product = parts[1] || 'All';
      const channel = parts.length >= 5 ? (parts[2] || 'All') : 'All';
      const forecastType = parts.length >= 5 ? parts[3] : parts[2];
      const scenario = parts.length >= 5 ? parts[4] : parts[3];

      (forecastRows as any[]).forEach((row: any) => {
        if (row.Type !== 'Forecast') return;

        const dateVal = row.date || row[wiDateCol];
        if (!dateVal) return;
        const d = dateVal instanceof Date ? dateVal : new Date(dateVal);
        if (!isValid(d)) return;
        const dateKey = format(d, 'yyyy-MM');

        let forecastValue = 0;
        if (forecastType && forecastType.includes('What-If')) {
          forecastValue = Number(row['Total Subscribers (Uplifted)']) || Number(row['Total Revenue (Uplifted)']) || Number(row['Mean (Base)']) || 0;
        } else {
          forecastValue = Number(row['Mean (Base)']) || Number(row[valueColName]) || 0;
        }

        const mapKey = `${dateKey}|${segment}|${product}|${channel}|${scenario}`;
        forecastMap.set(mapKey, {
          value: forecastValue,
          optimistic: row['Optimistic'] != null ? Number(row['Optimistic']) : null,
          pessimistic: row['Pessimistic'] != null ? Number(row['Pessimistic']) : null,
          forecastType: forecastType || 'Standard Forecast'
        });
      });
    });

    // Start with existing actuals rows, appending forecast columns
    const exportRows: any[] = [];
    const usedForecastKeys = new Set<string>();

    data.forEach(row => {
      const newRow: any = {};
      // Copy original columns in order
      Object.keys(row).forEach(col => {
        const val = row[col];
        // Format dates to yyyy-MM
        if (col === dateColName && val) {
          const d = new Date(val);
          newRow[col] = isValid(d) ? format(d, 'yyyy-MM') : val;
        } else {
          newRow[col] = val;
        }
      });

      // Look up matching forecast
      const dateVal = row[dateColName];
      const d = dateVal ? new Date(dateVal) : null;
      const dateKey = d && isValid(d) ? format(d, 'yyyy-MM') : '';
      const seg = String(row[segColName] || 'All');
      const prod = String(row[prodColName] || 'All');
      const chan = String(row[chanColName] || 'All');
      const scenario = String(row[metricColName] || '');

      const mapKey = `${dateKey}|${seg}|${prod}|${chan}|${scenario}`;
      const forecast = forecastMap.get(mapKey);

      newRow['Forecast_Value'] = forecast ? forecast.value : '';
      newRow['Forecast_Optimistic'] = forecast?.optimistic ?? '';
      newRow['Forecast_Pessimistic'] = forecast?.pessimistic ?? '';
      newRow['Forecast_Type'] = forecast?.forecastType ?? '';

      if (forecast) usedForecastKeys.add(mapKey);
      exportRows.push(newRow);
    });

    // Add future-month rows (forecasts with no matching actuals)
    const originalCols = data.length > 0 ? Object.keys(data[0]) : [];
    forecastMap.forEach((forecast, mapKey) => {
      if (usedForecastKeys.has(mapKey)) return;
      const [dateKey, seg, prod, chan, scenario] = mapKey.split('|');

      const newRow: any = {};
      originalCols.forEach(col => { newRow[col] = ''; });
      newRow[dateColName] = dateKey;
      newRow[segColName] = seg;
      newRow[prodColName] = prod;
      newRow[chanColName] = chan;
      newRow[metricColName] = scenario;
      // Leave value columns blank for future months
      newRow[valueColName] = '';
      newRow['Forecast_Value'] = forecast.value;
      newRow['Forecast_Optimistic'] = forecast.optimistic ?? '';
      newRow['Forecast_Pessimistic'] = forecast.pessimistic ?? '';
      newRow['Forecast_Type'] = forecast.forecastType;
      exportRows.push(newRow);
    });

    // Sort by date
    exportRows.sort((a, b) => String(a[dateColName] || '').localeCompare(String(b[dateColName] || '')));

    const ws = XLSX.utils.json_to_sheet(exportRows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Prospect_Forecast");

    // Add Market Events as a separate sheet so they can be re-imported next month
    if (marketEvents.length > 0) {
      const eventRows = marketEvents.map(e => ({
        Scenario: e.scenario,
        Segment: e.segment,
        Product: e.product,
        Channel: e.channel,
        Date: e.date,
        Subscriber_Volume: e.subscriberVolume,
        Customer_Volume: e.customerVolume,
        Revenue: e.revenue,
        ARPU: e.arpu,
        Comment: e.comment,
      }));
      const wsEvents = XLSX.utils.json_to_sheet(eventRows);
      XLSX.utils.book_append_sheet(wb, wsEvents, "Market_Events");
    }

    XLSX.writeFile(wb, "prospect_forecast_export.xlsx");
  };

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
  const [cohortGenLog, setCohortGenLog] = useState<Array<{ cohortId: string; timestamp: string; modelUsed: ForecastModel }>>([]);

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

  // Per-tab view filter — each step remembers its own last-used selection independently
  const [step2Filter, setStep2Filter] = useState<ViewFilter>({ segment: 'All', product: 'All', channel: 'All' });
  const [step3Filter, setStep3Filter] = useState<ViewFilter>({ segment: 'All', product: 'All', channel: 'All' });

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
    channel: 'All',
    date: format(new Date(), 'yyyy-MM'),
    subscriberVolume: 0,
    customerVolume: 0,
    revenue: 0,
    arpu: 0,
    comment: '',
    contractLength: 24,
  });

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
      if (!wiProductCol) setWiProductCol(match(['product', 'item', 'sku']) || '');
      if (!wiChannelCol) setWiChannelCol(match(['channel', 'source', 'platform']) || '');
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

  /** Stable key for a cohort — used by forecastStore and per-tab filters. */
  const makeForecastKey = (seg: string, prod: string, chan: string) => `${seg}|${prod}|${chan}`;

  /** Distinct segment values from the uploaded dataset. */
  const availableSegments = useMemo(
    () => wiSegmentCol
      ? Array.from(new Set(data.map(r => String(r[wiSegmentCol]).trim()).filter(v => v && v !== 'undefined'))).sort()
      : [],
    [data, wiSegmentCol],
  );

  /** Distinct product values from the uploaded dataset. */
  const availableProducts = useMemo(
    () => wiProductCol
      ? Array.from(new Set(data.map(r => String(r[wiProductCol]).trim()).filter(v => v && v !== 'undefined'))).sort()
      : [],
    [data, wiProductCol],
  );

  /** Distinct channel values from the uploaded dataset. */
  const availableChannels = useMemo(
    () => wiChannelCol
      ? Array.from(new Set(data.map(r => String(r[wiChannelCol]).trim()).filter(v => v && v !== 'undefined'))).sort()
      : [],
    [data, wiChannelCol],
  );

  /** Handle ViewFilterBar change on Step 2 — loads the matching forecast (if any). */
  const handleStep2FilterChange = useCallback((filter: ViewFilter) => {
    setStep2Filter(filter);
    const key = makeForecastKey(filter.segment, filter.product, filter.channel);
    const bf = forecastStore.get(key);
    if (bf !== undefined) {
      setBaseForecast(bf);
      setAdjustedForecast(null);
    }
  }, [forecastStore]); // eslint-disable-line react-hooks/exhaustive-deps

  /** Handle ViewFilterBar change on Step 3 — loads the matching forecast (if any). */
  const handleStep3FilterChange = useCallback((filter: ViewFilter) => {
    setStep3Filter(filter);
    const key = makeForecastKey(filter.segment, filter.product, filter.channel);
    const bf = forecastStore.get(key);
    if (bf !== undefined) {
      setBaseForecast(bf);
      setAdjustedForecast(null);
    }
  }, [forecastStore]); // eslint-disable-line react-hooks/exhaustive-deps

  /** When switching tabs, restore the appropriate per-tab forecast. */
  useEffect(() => {
    if (activeView === 'whatif') {
      const key = makeForecastKey(step2Filter.segment, step2Filter.product, step2Filter.channel);
      const bf = forecastStore.get(key) ?? null;
      setBaseForecast(bf);
    } else if (activeView === 'vsactuals') {
      const key = makeForecastKey(step3Filter.segment, step3Filter.product, step3Filter.channel);
      const bf = forecastStore.get(key) ?? null;
      setBaseForecast(bf);
    }
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
    setWiChannelCol('');
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
        setWhatIfData([]);

        // Restore market events if the file contains a Market_Events sheet
        const eventsSheetName = wb.SheetNames.find(n => n.toLowerCase() === 'market_events');
        if (eventsSheetName && sheetsData[eventsSheetName]?.length > 0) {
          const restoredEvents: MarketEvent[] = sheetsData[eventsSheetName].map((r: any) => {
            const scen = String(r['Scenario'] || 'Inflow') as MarketEvent['scenario'];
            const isOut = scen === 'Outflow';
            const neg = (v: number) => isOut ? -Math.abs(v) : v;
            return {
              id: Math.random().toString(36).substr(2, 9),
              scenario: scen,
              segment: String(r['Segment'] || 'All'),
              product: String(r['Product'] || 'All'),
              channel: String(r['Channel'] || 'All'),
              date: String(r['Date'] || ''),
              subscriberVolume: neg(Number(r['Subscriber_Volume']) || 0),
              customerVolume:   neg(Number(r['Customer_Volume'])   || 0),
              revenue:          neg(Number(r['Revenue'])           || 0),
              arpu:             neg(Number(r['ARPU'])              || 0),
              comment: String(r['Comment'] || ''),
              contractLength: Number(r['Contract_Length']) || 24,
            };
          });
          setMarketEvents(restoredEvents);
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
    const parts = cohortId.split('|');
    const [seg, prod, chan, , scen] = parts;
    setSegmentValue(seg === 'All' ? 'All (Aggregated)' : seg);
    setProductValue(prod === 'All' ? 'All (Aggregated)' : prod);
    setChannelValue(chan === 'All' ? 'All (Aggregated)' : chan);
    setStdScenario(scen || 'Inflow');
    const saved = savedForecasts[cohortId];
    if (saved) setForecastData(saved);
  }, [savedForecasts]);

  const generateStandardForecast = () => {
    setError('');
    setCompareCategories([]);
    
    const targetMetric = stdScenario === 'Inflow' ? wiInflowVal :
                         stdScenario === 'Outflow' ? wiOutflowVal :
                         stdScenario === 'Base' ? wiBaseVal : wiRetentionVal;

    if (!wiDateCol || !wiMetricCol || !wiValueCol || !targetMetric) {
      setError('Please map Date, Metric, Value columns and select an IBRO scenario identifier.');
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
    }

    if (wiChannelCol && channelMode === 'filter') {
      if (!channelValue) {
        setError('Please select a channel value to filter by.');
        return;
      }
      if (channelValue !== 'All (Aggregated)') {
        processedData = processedData.filter(row => String(row[wiChannelCol]) === channelValue);
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

        const hw = calculateHoltWinters(aggArr, wiDateCol, wiValueCol, stdForecastLength, preHorizonUncertainty, postHorizonExpansionRate, confidenceHorizon);
        
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
        const hw = calculateHoltWinters(aggArr, wiDateCol, wiValueCol, stdForecastLength, preHorizonUncertainty, postHorizonExpansionRate, confidenceHorizon);
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

        const hw = calculateHoltWinters(aggArr, wiDateCol, wiValueCol, stdForecastLength, preHorizonUncertainty, postHorizonExpansionRate, confidenceHorizon);
        
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
        const hw = calculateHoltWinters(aggArr, wiDateCol, wiValueCol, stdForecastLength, preHorizonUncertainty, postHorizonExpansionRate, confidenceHorizon);
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

        const hw = calculateHoltWinters(aggArr, wiDateCol, wiValueCol, stdForecastLength, preHorizonUncertainty, postHorizonExpansionRate, confidenceHorizon);
        
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
        const hw = calculateHoltWinters(aggArr, wiDateCol, wiValueCol, stdForecastLength, preHorizonUncertainty, postHorizonExpansionRate, confidenceHorizon);
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

        const hw = calculateHoltWinters(aggArr, wiDateCol, wiValueCol, stdForecastLength, preHorizonUncertainty, postHorizonExpansionRate, confidenceHorizon);
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
      setIsLoading(false);
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
    const newForecastData = calculateHoltWinters(aggregatedData, wiDateCol, wiValueCol, stdForecastLength, preHorizonUncertainty, postHorizonExpansionRate, confidenceHorizon);

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
    const chanKey = channelValue === 'All (Aggregated)' ? 'All' : channelValue;
    const manualCohortId = `${segKey}|${prodKey}|${chanKey}|Standard Forecast|${stdScenario}`;
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
      if (wiChannelCol && channelValue !== 'All (Aggregated)') allIBRO = allIBRO.filter(r => String(r[wiChannelCol]) === channelValue);

      const ibroMap = new Map<number, AggregatedIBRORow>();
      // First pass: aggregate volume metrics
      allIBRO.forEach(row => {
        const t = row._parsedDate.getTime();
        if (!ibroMap.has(t)) ibroMap.set(t, { _parsedDate: row._parsedDate, inflow: 0, outflow: 0, retention: 0, arpu: 0 });
        const entry = ibroMap.get(t)!;
        const metric = String(row[wiMetricCol]);
        const val = Number(row[wiValueCol]) || 0;
        if (metric === wiInflowVal) entry.inflow += val;
        else if (metric === wiOutflowVal) entry.outflow += val;
        else if (metric === wiRetentionVal) entry.retention += val;
      });
      // Second pass: derive blended ARPU from revenue columns when available
      if (wiRevenueCol || wiArpuCol) {
        const subsMap = new Map<number, number>();
        const revMap = new Map<number, number>();
        allIBRO.forEach(row => {
          const t = row._parsedDate.getTime();
          const metric = String(row[wiMetricCol]);
          const val = Number(row[wiValueCol]) || 0;
          if (metric === wiBaseVal || metric === wiInflowVal) subsMap.set(t, (subsMap.get(t) || 0) + val);
          const rev = Number(row[wiRevenueCol]) || 0;
          const arpu = Number(row[wiArpuCol]) || 0;
          revMap.set(t, (revMap.get(t) || 0) + (rev || arpu * val));
        });
        ibroMap.forEach((entry, t) => {
          const subs = subsMap.get(t) || 0;
          const rev = revMap.get(t) || 0;
          if (subs > 0) entry.arpu = rev / subs;
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
      const seedBase = baseReadings.size > 0 ? (baseReadings.get(Math.max(...baseReadings.keys())) || 0) : 0;

      const bf = calculateBaseForecast(
        ibroArr,
        {
          segment: segmentValue === 'All (Aggregated)' ? 'All' : segmentValue,
          product: productValue === 'All (Aggregated)' ? 'All' : productValue,
          channel: channelValue === 'All (Aggregated)' ? 'All' : channelValue,
          scenario: stdScenario,
        },
        seedBase,
        stdForecastLength,
        preHorizonUncertainty,
        postHorizonExpansionRate,
        confidenceHorizon,
        selectedForecastModel,
      );
      if (bf) {
        console.log('[generateStandardForecast] modelUsed written to ForecastContext:', bf.modelUsed);
        const fKey = makeForecastKey(bf.cohort.segment, bf.cohort.product, bf.cohort.channel);
        setForecastStore(prev => new Map(prev).set(fKey, bf));
        setBaseForecast(bf);
        setForecastUpdatedAt(format(new Date(), 'dd MMM yyyy, HH:mm'));
        // Sync both tab filters to the newly generated cohort so Steps 2 & 3 default to it
        const newFilter: ViewFilter = { segment: bf.cohort.segment, product: bf.cohort.product, channel: bf.cohort.channel };
        setStep2Filter(newFilter);
        setStep3Filter(newFilter);
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
    if (wiSegmentCol && segKey !== 'All') allIBRO = allIBRO.filter(r => String(r[wiSegmentCol]) === segKey);
    if (wiProductCol && prodKey !== 'All') allIBRO = allIBRO.filter(r => String(r[wiProductCol]) === prodKey);
    if (wiChannelCol && chanKey !== 'All') allIBRO = allIBRO.filter(r => String(r[wiChannelCol]) === chanKey);

    const ibroMap = new Map<number, AggregatedIBRORow>();
    allIBRO.forEach(row => {
      const t = row._parsedDate.getTime();
      if (!ibroMap.has(t)) ibroMap.set(t, { _parsedDate: row._parsedDate, inflow: 0, outflow: 0, retention: 0, arpu: 0 });
      const entry = ibroMap.get(t)!;
      const metric = String(row[wiMetricCol]);
      const val = Number(row[wiValueCol]) || 0;
      if (metric === wiInflowVal) entry.inflow += val;
      else if (metric === wiOutflowVal) entry.outflow += val;
      else if (metric === wiRetentionVal) entry.retention += val;
    });
    if (wiRevenueCol || wiArpuCol) {
      const subsMap = new Map<number, number>();
      const revMap  = new Map<number, number>();
      allIBRO.forEach(row => {
        const t = row._parsedDate.getTime();
        const metric = String(row[wiMetricCol]);
        const val = Number(row[wiValueCol]) || 0;
        if (metric === wiBaseVal || metric === wiInflowVal) subsMap.set(t, (subsMap.get(t) || 0) + val);
        const rev = Number(row[wiRevenueCol]) || 0;
        const arpu = Number(row[wiArpuCol]) || 0;
        revMap.set(t, (revMap.get(t) || 0) + (rev || arpu * val));
      });
      ibroMap.forEach((entry, t) => {
        const subs = subsMap.get(t) || 0;
        const rev  = revMap.get(t) || 0;
        if (subs > 0) entry.arpu = rev / subs;
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

    const fKeyChallenger = makeForecastKey(bf.cohort.segment, bf.cohort.product, bf.cohort.channel);
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
      previousModel: baseForecast.modelUsed ?? 'Holt Linear',
      acceptedModel: model,
      switchoverMonth: switchoverMonth ?? null,
      timestamp: nowIso,
    }]);
  }, [
    baseForecast, data, wiDateCol, wiMetricCol, wiValueCol,
    wiInflowVal, wiOutflowVal, wiRetentionVal, wiBaseVal,
    wiArpuCol, wiRevenueCol, wiSegmentCol, wiProductCol, wiChannelCol,
    stdForecastLength, preHorizonUncertainty, postHorizonExpansionRate, confidenceHorizon,
  ]);

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

      const ibroMap = new Map<number, AggregatedIBRORow>();
      allIBRO.forEach(row => {
        const t = row._parsedDate.getTime();
        if (!ibroMap.has(t)) ibroMap.set(t, { _parsedDate: row._parsedDate, inflow: 0, outflow: 0, retention: 0, arpu: 0 });
        const entry = ibroMap.get(t)!;
        const metric = String(row[wiMetricCol]);
        const val = Number(row[wiValueCol]) || 0;
        if (metric === wiInflowVal) entry.inflow += val;
        else if (metric === wiOutflowVal) entry.outflow += val;
        else if (metric === wiRetentionVal) entry.retention += val;
      });
      if (wiRevenueCol || wiArpuCol) {
        const subsMap = new Map<number, number>();
        const revMap  = new Map<number, number>();
        allIBRO.forEach(row => {
          const t = row._parsedDate.getTime();
          const metric = String(row[wiMetricCol]);
          const val = Number(row[wiValueCol]) || 0;
          if (metric === wiBaseVal || metric === wiInflowVal) subsMap.set(t, (subsMap.get(t) || 0) + val);
          const rev = Number(row[wiRevenueCol]) || 0;
          const arpu = Number(row[wiArpuCol]) || 0;
          revMap.set(t, (revMap.get(t) || 0) + (rev || arpu * val));
        });
        ibroMap.forEach((entry, t) => {
          const subs = subsMap.get(t) || 0;
          const rev  = revMap.get(t) || 0;
          if (subs > 0) entry.arpu = rev / subs;
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
        const fKeyAll = makeForecastKey(lastBf.cohort.segment, lastBf.cohort.product, lastBf.cohort.channel);
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
            previousModel: baseForecast.modelUsed ?? 'Holt Linear',
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
    ],
  );

  const generateWhatIfForecast = () => {
    setError('');
    
    const isAllSegment = wiSegmentValue === 'All (Aggregated)';
    const isAllProduct = wiProductValue === 'All (Aggregated)';
    const isAllChannel = wiChannelValue === 'All (Aggregated)';

    if (isAllSegment || isAllProduct || isAllChannel) {
      let processedData = data
        .map(row => ({ ...row, _parsedDate: new Date(row[wiDateCol]) }))
        .filter(row => isValid(row._parsedDate));
      
      const combos = getUniqueCombos(processedData, wiSegmentValue, wiProductValue, wiSegmentCol, wiProductCol, wiChannelValue, wiChannelCol);
      const newSaved = { ...savedForecasts };
      const allWhatIfResults: any[] = [];

      const config: WhatIfConfig = {
        wiDateCol, wiMetricCol, wiValueCol, wiInflowVal, wiOutflowVal, wiBaseVal, wiRetentionVal,
        wiSegmentCol, wiProductCol, wiChannelCol, wiCustomerCol, wiRevenueCol, wiArpuCol, data,
        forecastModel: baseForecast?.modelUsed ?? selectedForecastModel,
        preHorizonUncertainty, postHorizonExpansionRate, confidenceHorizon,
      };

      combos.forEach(combo => {
        const result = computeWhatIfData(
          config,
          combo.s,
          combo.p,
          combo.c,
          forecastLength,
          wiUpliftPct,
          wiInflowLag,
          wiRetentionUpliftPct,
          wiRetentionLag,
          wiArpuUpliftPct,
          marketEvents
        );

        if (!result.error && result.combined) {
          newSaved[`${combo.s}|${combo.p}|${combo.c}|What-If Analysis|Base`] = result.combined;
          allWhatIfResults.push(result.combined);
        }
      });

      // Aggregate allWhatIfResults for the chart
      const chartAggMap = new Map<number, any>();
      allWhatIfResults.forEach(forecast => {
        forecast.forEach(row => {
          const time = new Date(row.date).getTime();
          if (!chartAggMap.has(time)) {
             chartAggMap.set(time, { ...row });
          } else {
             const existing = chartAggMap.get(time);
             const keysToSum = [
               'Inflow Volume (Baseline)', 'Inflow Volume (Uplifted)',
               'Outflow Volume (Baseline)', 'Outflow Volume (Uplifted)',
               'Retention Volume (Baseline)', 'Retention Volume (Uplifted)',
               'Base Volume (Baseline)', 'Base Volume (Uplifted)',
               'Total Subscribers (Baseline)', 'Total Subscribers (Uplifted)',
               'Total Revenue (Baseline)', 'Total Revenue (Uplifted)'
             ];
             keysToSum.forEach(k => {
               existing[k] = (existing[k] || 0) + (row[k] || 0);
             });
             // ARPU needs to be recalculated after summing
             existing['Blended ARPU (Baseline)'] = existing['Total Subscribers (Baseline)'] > 0 ? existing['Total Revenue (Baseline)'] / existing['Total Subscribers (Baseline)'] : 0;
             existing['Blended ARPU (Uplifted)'] = existing['Total Subscribers (Uplifted)'] > 0 ? existing['Total Revenue (Uplifted)'] / existing['Total Subscribers (Uplifted)'] : 0;
          }
        });
      });

      const aggregated = Array.from(chartAggMap.values()).sort((a, b) => a.timestamp - b.timestamp);
      setWhatIfData(aggregated);
      setSavedForecasts(newSaved);
      
      // Delta calculation for aggregate
      const baselineTotal = aggregated.filter(r => r.Type === 'Forecast').reduce((acc, r) => acc + r['Base Volume (Baseline)'], 0);
      const upliftedTotal = aggregated.filter(r => r.Type === 'Forecast').reduce((acc, r) => acc + r['Base Volume (Uplifted)'], 0);
      setWhatIfDelta(upliftedTotal - baselineTotal);

      const revBaselineTotal = aggregated.filter(r => r.Type === 'Forecast').reduce((acc, r) => acc + r['Total Revenue (Baseline)'], 0);
      const revUpliftedTotal = aggregated.filter(r => r.Type === 'Forecast').reduce((acc, r) => acc + r['Total Revenue (Uplifted)'], 0);
      setWhatIfRevenueDelta(revUpliftedTotal - revBaselineTotal);

      return;
    }

    const config: WhatIfConfig = {
      wiDateCol, wiMetricCol, wiValueCol, wiInflowVal, wiOutflowVal, wiBaseVal, wiRetentionVal,
      wiSegmentCol, wiProductCol, wiChannelCol, wiCustomerCol, wiRevenueCol, wiArpuCol, data,
      forecastModel: baseForecast?.modelUsed ?? selectedForecastModel,
      preHorizonUncertainty, postHorizonExpansionRate, confidenceHorizon,
    };

    const result = computeWhatIfData(
      config,
      wiSegmentValue,
      wiProductValue,
      wiChannelValue,
      forecastLength,
      wiUpliftPct,
      wiInflowLag,
      wiRetentionUpliftPct,
      wiRetentionLag,
      wiArpuUpliftPct,
      marketEvents
    );

    if (result.error) {
      setError(result.error);
      setWhatIfMissingMonths([]);
      return;
    }

    setWhatIfData(result.combined!);
    setWhatIfDelta(result.totalBaseUplifted! - result.totalBaseBaseline!);
    setWhatIfRevenueDelta(result.totalRevUpliftedSum! - result.totalRevBaselineSum!);
    setWhatIfMissingMonths(result.missingMonths ?? []);

    const segKey = wiSegmentValue === 'All (Aggregated)' ? 'All' : wiSegmentValue;
    const prodKey = wiProductValue === 'All (Aggregated)' ? 'All' : wiProductValue;
    const chanKey = wiChannelValue === 'All (Aggregated)' ? 'All' : wiChannelValue;
    
    const newForecasts = { ...savedForecasts };
    ['Inflow', 'Outflow', 'Base', 'Retention'].forEach(scen => {
      newForecasts[`${segKey}|${prodKey}|${chanKey}|What-If Analysis|${scen}`] = result.combined!;
    });
    setSavedForecasts(newForecasts);
  };

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
  useEffect(() => {
    if (forecastData.length > 0 && activeView === 'standard') {
      const sorted = [...forecastData].sort((a, b) => {
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
  }, [forecastData, activeView, windowSize, wiDateCol]);

  useEffect(() => {
    if (whatIfData.length > 0 && activeView === 'whatif') {
      const sorted = [...whatIfData].sort((a, b) => a.date.getTime() - b.date.getTime());
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
  }, [whatIfData, activeView, windowSize]);

  const stdChartData = useMemo(() => {
    if (!forecastData.length) return [];
    
    // Sort all data by date first
    const sortedData = [...forecastData].sort((a, b) => {
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
  }, [forecastData, wiDateCol, compareCategories]);

  const wiChartData = useMemo(() => {
    if (!whatIfData.length) return [];

    // Sort all data by date first
    const sortedData = [...whatIfData].sort((a, b) => {
      const da = a.date;
      const db = b.date;
      return da.getTime() - db.getTime();
    });

    return sortedData.map(row => {
      return {
        ...row,
        date: isValid(row.date) ? format(row.date, 'yyyy-MM') : 'Invalid Date',
      };
    });
  }, [whatIfData]);

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

    const segments = wiSegmentCol ? ['All', ...Array.from(new Set(data.map(r => String(r[wiSegmentCol])).filter(v => v && v !== 'undefined'))).sort()] : ['All'];
    const products = wiProductCol ? ['All', ...Array.from(new Set(data.map(r => String(r[wiProductCol])).filter(v => v && v !== 'undefined'))).sort()] : ['All'];
    const channels = wiChannelCol ? ['All', ...Array.from(new Set(data.map(r => String(r[wiChannelCol])).filter(v => v && v !== 'undefined'))).sort()] : ['All'];
    const scenarios = ['Inflow', 'Outflow', 'Base', 'Retention'];

    const cohorts: any[] = [];
    segments.forEach(seg => {
      products.forEach(prod => {
        channels.forEach(chan => {
          // Standard Forecasts
          scenarios.forEach(scen => {
            const stdId = `${seg}|${prod}|${chan}|Standard Forecast|${scen}`;
            cohorts.push({
              id: stdId,
              segment: seg,
              product: prod,
              channel: chan,
              forecastType: 'Standard Forecast',
              scenario: scen,
              hasForecast: !!savedForecasts[stdId],
              forecastData: savedForecasts[stdId] || null
            });
          });
          
          // What-If Analysis
          scenarios.forEach(scen => {
            const wiId = `${seg}|${prod}|${chan}|What-If Analysis|${scen}`;
            cohorts.push({
              id: wiId,
              segment: seg,
              product: prod,
              channel: chan,
              forecastType: 'What-If Analysis',
              scenario: scen,
              hasForecast: !!savedForecasts[wiId],
              forecastData: savedForecasts[wiId] || null
            });
          });
        });
      });
    });
    return cohorts;
  }, [data, wiSegmentCol, wiProductCol, wiChannelCol, wiMetricCol, savedForecasts]);

  const computeCohortForecastData = useCallback((cohort: any, manualParams?: any) => {
    if (cohort.forecastType.startsWith('What-If Analysis')) {
      const scenarioMatch = cohort.forecastType.match(/\(([^)]+)\)/);
      const wiScen = scenarioMatch ? scenarioMatch[1] : 'Base Case';

      let inflowUplift = manualParams?.inflowUplift ?? genInflowUplift;
      let retentionUplift = manualParams?.retentionUplift ?? genRetentionUplift;
      let arpuUplift = manualParams?.arpuUplift ?? genArpuUplift;

      // If no manual params provided (e.g. batch generation), use scenario defaults
      if (!manualParams) {
        if (wiScen === 'Aggressive Growth') {
          inflowUplift = 20; retentionUplift = 10; arpuUplift = 5;
        } else if (wiScen === 'Worst Case') {
          inflowUplift = -20; retentionUplift = -10; arpuUplift = -5;
        } else if (wiScen === 'Base Case') {
          inflowUplift = 0; retentionUplift = 0; arpuUplift = 0;
        }
      }

      const config: WhatIfConfig = {
        wiDateCol, wiMetricCol, wiValueCol, wiInflowVal, wiOutflowVal, wiBaseVal, wiRetentionVal,
        wiSegmentCol, wiProductCol, wiChannelCol, wiCustomerCol, wiRevenueCol, wiArpuCol, data,
        forecastModel: baseForecast?.modelUsed ?? selectedForecastModel,
        preHorizonUncertainty: manualParams?.preHorizonUncertainty ?? preHorizonUncertainty,
        postHorizonExpansionRate: manualParams?.postHorizonExpansionRate ?? postHorizonExpansionRate,
        confidenceHorizon: manualParams?.confidenceHorizon ?? confidenceHorizon,
      };

      const result = computeWhatIfData(
        config,
        cohort.segment,
        cohort.product,
        cohort.channel || 'All',
        manualParams?.length ?? genLength,
        inflowUplift,
        manualParams?.inflowLag ?? genInflowLag,
        retentionUplift,
        manualParams?.retentionLag ?? genRetentionLag,
        arpuUplift,
        manualParams?.marketEvents ?? marketEvents
      );

      if (result.error) {
        console.error(result.error);
        return null;
      }
      return result.combined!;
    }

    const targetMetric = cohort.scenario === 'Inflow' ? wiInflowVal :
                         cohort.scenario === 'Outflow' ? wiOutflowVal :
                         cohort.scenario === 'Base' ? wiBaseVal : wiRetentionVal;

    if (!wiDateCol || !wiMetricCol || !wiValueCol || !targetMetric) {
      return null;
    }

    let processedData = data
      .map(row => ({ ...row, _parsedDate: new Date(row[wiDateCol]) }))
      .filter(row => isValid(row._parsedDate) && String(row[wiMetricCol]) === targetMetric)
      .sort((a, b) => a._parsedDate.getTime() - b._parsedDate.getTime());

    if (wiSegmentCol && cohort.segment !== 'All') {
      processedData = processedData.filter(row => String(row[wiSegmentCol]) === cohort.segment);
    }

    if (wiProductCol && cohort.product !== 'All') {
      processedData = processedData.filter(row => String(row[wiProductCol]) === cohort.product);
    }

    if (wiChannelCol && cohort.channel && cohort.channel !== 'All') {
      processedData = processedData.filter(row => String(row[wiChannelCol]) === cohort.channel);
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

    const newForecastData = calculateHoltWinters(aggregatedData, wiDateCol, wiValueCol, genLength, runPreUnc, runPostExp, runConfHor);

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
  }, [data, wiDateCol, wiMetricCol, wiValueCol, wiSegmentCol, wiProductCol, wiInflowVal, wiOutflowVal, wiBaseVal, wiRetentionVal, genLength, genInflowUplift, genInflowLag, genRetentionUplift, genRetentionLag, genArpuUplift, genMarketEvents, genPreHorizonUncertainty, genPostHorizonExpansionRate, computeWhatIfData]);

  const generateCohortForecast = (cohort: any, manualParams?: any) => {
    const forecastData = computeCohortForecastData(cohort, manualParams);
    if (forecastData) {
      if (cohort.forecastType === 'What-If Analysis') {
        setSavedForecasts(prev => {
          const next = { ...prev };
          ['Inflow', 'Outflow', 'Base', 'Retention'].forEach(scen => {
            const id = `${cohort.segment}|${cohort.product}|${cohort.channel || 'All'}|What-If Analysis|${scen}`;
            next[id] = forecastData;
          });
          return next;
        });
      } else {
        setSavedForecasts(prev => ({
          ...prev,
          [cohort.id]: forecastData
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
    preHorizonUncertainty?: number;
    postHorizonExpansionRate?: number;
    confidenceHorizon?: number;
    model?: ForecastModel;
    name?: string;
    comment?: string;
  }): Promise<{ generated: number; failed: number }> => {
    const targets = options?.cohortIds
      ? allCohorts.filter(c => options.cohortIds!.includes(c.id))
      : allCohorts.filter(c => !c.hasForecast && c.forecastType === 'Standard Forecast');

    let generated = 0;
    let failed = 0;
    const chunkSize = 5;
    const newForecasts: Record<string, any> = {};
    const generatedIds: string[] = [];

    // Per-run params passed through to computeCohortForecastData
    const runManualParams = options ? {
      preHorizonUncertainty:  options.preHorizonUncertainty,
      postHorizonExpansionRate: options.postHorizonExpansionRate,
      confidenceHorizon: options.confidenceHorizon,
    } : undefined;

    for (let i = 0; i < targets.length; i += chunkSize) {
      await new Promise<void>(resolve => {
        setTimeout(() => {
          const chunk = targets.slice(i, Math.min(i + chunkSize, targets.length));
          chunk.forEach(c => {
            const fd = computeCohortForecastData(c, runManualParams);
            if (fd) {
              newForecasts[c.id] = fd;
              generatedIds.push(c.id);
              generated++;
            } else {
              failed++;
            }
          });
          resolve();
        }, 0);
      });
    }

    setSavedForecasts(prev => ({ ...prev, ...newForecasts }));

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
      cohortIds: generatedIds,
      generated,
      failed,
    };
    console.log('[generateAllMissingForecasts] saving BulkRunRecord:', { name: record.name, comment: record.comment, generated, failed });
    setBulkRuns(prev => [...prev, record]);

    return { generated, failed };
  }, [allCohorts, computeCohortForecastData, selectedForecastModel, genPreHorizonUncertainty, genPostHorizonExpansionRate, confidenceHorizon, genLength]);

  // After a single-combo forecast is saved, check whether there are remaining combinations
  // without a forecast and show the bulk-generate prompt if so.
  useEffect(() => {
    if (triggerBulkCheck === 0) return;
    const missing = allCohorts.filter(c => !c.hasForecast && c.forecastType === 'Standard Forecast');
    if (missing.length > 0) {
      setShowBulkGeneratePrompt(true);
    }
  }, [triggerBulkCheck]); // eslint-disable-line react-hooks/exhaustive-deps

  const hasLegacyBaseline = Object.keys(savedForecasts).length > 0;
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
              Home
            </button>
            <button
              onClick={() => setActiveView('overall')}
              className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                activeView === 'overall'
                  ? 'bg-slate-100 text-slate-900'
                  : 'text-slate-500 hover:text-slate-900 hover:bg-slate-50'
              }`}
            >
              Overall Forecast
            </button>
          </div>
        </div>

        {/* Step indicator row — always visible so users can see the journey */}
        <StepIndicator
          activeStep={activeStep}
          hasBaseline={hasLegacyBaseline}
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
            products={availableProducts}
            channels={availableChannels}
            hasForecast={
              activeView === 'whatif'
                ? forecastStore.has(makeForecastKey(step2Filter.segment, step2Filter.product, step2Filter.channel))
                : forecastStore.has(makeForecastKey(step3Filter.segment, step3Filter.product, step3Filter.channel))
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
            wiChannelCol={wiChannelCol}
            setWiChannelCol={setWiChannelCol}
            segmentValue={segmentValue}
            setSegmentValue={setSegmentValue}
            productValue={productValue}
            setProductValue={setProductValue}
            channelValue={channelValue}
            setChannelValue={setChannelValue}
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
            error={error}
            forecastData={forecastData}
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
          />
        )}

        {/* MARKET EVENTS VIEW (Step 2) */}
        {activeView === 'whatif' && (
          <WhatIfTab
            data={data}
            wiSegmentCol={wiSegmentCol}
            wiProductCol={wiProductCol}
            wiChannelCol={wiChannelCol}
            downloadExcel={downloadExcel}
            formatNumber={formatNumber}
            newEvent={newEvent}
            setNewEvent={setNewEvent}
            marketEvents={marketEvents}
            setMarketEvents={setMarketEvents}
            addMarketEvent={addMarketEvent}
            removeMarketEvent={removeMarketEvent}
            setActiveView={setActiveView}
            missingMonths={whatIfMissingMonths}
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
            wiChannelCol={wiChannelCol}
            formatNumber={formatNumber}
            setActiveView={setActiveView}
            onAcceptChallengerModel={acceptChallengerModel}
            onAcceptAllChallengerModels={acceptAllChallengerModels}
            handleImportActualsFile={handleImportActualsFile}
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
            exportToExcel={openExportModal}
            setSavedForecasts={setSavedForecasts}
            savedForecasts={savedForecasts}
            computeCohortForecastData={computeCohortForecastData}
            setGeneratingCohort={setGeneratingCohort}
            setViewingCohort={setViewingCohort}
            isGeneratingMissing={isGeneratingMissing}
            setIsGeneratingMissing={setIsGeneratingMissing}
            generationProgress={generationProgress}
            setGenerationProgress={setGenerationProgress}
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
        isOpen={showBulkGeneratePrompt}
        onClose={() => setShowBulkGeneratePrompt(false)}
        sourceCohort={bulkSourceCohort}
        missingCount={allCohorts.filter(c => !c.hasForecast && c.forecastType === 'Standard Forecast').length}
        params={{
          preHorizonUncertainty,
          postHorizonExpansionRate,
          confidenceHorizon,
          forecastLength: stdForecastLength,
        }}
        onConfirm={(opts) => generateAllMissingForecasts(opts)}
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
        defaultName={`PROSPECT Forecast Save — ${format(new Date(), 'dd MMM yyyy HH:mm')}`}
        onConfirm={fileName => { exportSession(fileName); setShowExportModal(false); }}
        onClose={() => setShowExportModal(false)}
      />
    </div>
    </ForecastProvider>
  );
}

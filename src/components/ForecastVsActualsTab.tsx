import React, { useMemo, useState, useEffect, useCallback } from 'react';
import {
  Download, CheckCircle2, ChevronRight, Cpu, AlertTriangle, ArrowRight, Info, FilePlus,
  Search, X,
} from 'lucide-react';
import type { ForecastModel, BaseForecast } from '../types/forecast';
import {
  ResponsiveContainer, ComposedChart, CartesianGrid, XAxis, YAxis, Tooltip,
  Legend, Line, ReferenceLine, Brush, Bar, Cell,
} from 'recharts';
import { format, isValid } from 'date-fns';
import { useForecast } from '../context/ForecastContext';
import { CohortDimCheckboxes } from './CohortDimCheckboxes';
import type { ViewFilter } from './ViewFilterBar';
import type { CohortDims } from './CohortDimCheckboxes';

// ---------------------------------------------------------------------------
// Props — all IBRO column mappings come from App; forecast data from context
// ---------------------------------------------------------------------------
interface ForecastVsActualsTabProps {
  data: any[];
  wiDateCol: string;
  wiMetricCol: string;
  wiValueCol: string;
  wiInflowVal: string;
  wiOutflowVal: string;
  wiRetentionVal: string;
  wiBaseVal: string;
  wiArpuCol: string;
  wiRevenueCol: string;
  wiSegmentCol: string;
  wiProductCol: string;
  wiChannelCol: string;
  formatNumber: (v: any) => string;
  setActiveView: (v: string) => void;
  onAcceptChallengerModel: (model: ForecastModel, switchoverMonth: string | null) => void;
  onAcceptAllChallengerModels: (groups: Array<{ key: string; model: ForecastModel }>, switchoverMonth: string | null) => void;
  handleImportActualsFile: (e: React.ChangeEvent<HTMLInputElement>) => void;
  /** Opens the session export modal in App.tsx */
  onRequestExport: () => void;
  /**
   * The current filter selection from the ViewFilterBar (per-tab state in App.tsx).
   * Drives chart scoping, accuracy table filtering, and COMPARING chips display.
   */
  activeFilter?: ViewFilter;
  /**
   * Called when the user clicks an accuracy-table row or a COMPARING chip —
   * lets the parent update the ViewFilterBar to reflect the new dimensions (bidirectional nav).
   */
  onCohortFilterChange?: (filter: ViewFilter) => void;
}

// ---------------------------------------------------------------------------
// Internal types
// ---------------------------------------------------------------------------
type KpiKey = 'inflow' | 'outflow' | 'retention' | 'base' | 'arpu';

const KPI_LABELS: Record<KpiKey, string> = {
  inflow: 'Inflow',
  outflow: 'Outflow',
  retention: 'Retention',
  base: 'Base',
  arpu: 'ARPU',
};

const KPI_COLORS: Record<KpiKey, { actual: string; baseline: string; adjusted: string; band: string }> = {
  inflow:    { actual: '#0f172a', baseline: '#3b82f6', adjusted: '#2563eb', band: '#dbeafe' },
  outflow:   { actual: '#0f172a', baseline: '#f59e0b', adjusted: '#d97706', band: '#fef3c7' },
  retention: { actual: '#0f172a', baseline: '#ec4899', adjusted: '#db2777', band: '#fce7f3' },
  base:      { actual: '#0f172a', baseline: '#10b981', adjusted: '#059669', band: '#d1fae5' },
  arpu:      { actual: '#0f172a', baseline: '#06b6d4', adjusted: '#0891b2', band: '#cffafe' },
};

// ---------------------------------------------------------------------------
// Pure helpers
// ---------------------------------------------------------------------------
function mapeLabel(mape: number | null): string {
  if (mape === null) return '—';
  return mape.toFixed(1) + '%';
}

function mapeColor(mape: number | null): string {
  if (mape === null) return 'text-slate-400';
  if (mape < 5) return 'text-emerald-600';
  if (mape < 15) return 'text-amber-600';
  return 'text-rose-600';
}

/**
 * Scores a single month 0–100 based on where `actual` falls within the
 * forecast cone defined by [pessimistic, mean, optimistic]:
 *   actual = mean           → 100
 *   mean < actual ≤ opt     → linear 100 → 70
 *   actual > opt            → linear 70 → 0 over one extra opt-deviation, capped at 0
 *   pess ≤ actual < mean    → linear 100 → 50
 *   actual < pess           → linear 50 → 0 over one extra pess-deviation, capped at 0
 */
function scoreMonth(actual: number, mean: number, optimistic: number, pessimistic: number): number {
  const optDev  = optimistic  - mean;
  const pessDev = mean - pessimistic;
  if (actual >= mean) {
    if (optDev <= 0) return actual === mean ? 100 : 0;
    if (actual <= optimistic) return 100 - 30 * (actual - mean) / optDev;
    return Math.max(0, 70 - 70 * (actual - optimistic) / optDev);
  } else {
    if (pessDev <= 0) return 0;
    if (actual >= pessimistic) return 100 - 50 * (mean - actual) / pessDev;
    return Math.max(0, 50 - 50 * (pessimistic - actual) / pessDev);
  }
}

function scoreLabel(score: number | null): string {
  if (score === null) return '—';
  return score.toFixed(0);
}

function scoreBg(score: number | null): string {
  if (score === null) return 'bg-slate-100 text-slate-400';
  if (score >= 85) return 'bg-emerald-100 text-emerald-800';
  if (score >= 70) return 'bg-amber-100 text-amber-800';
  if (score >= 50) return 'bg-orange-100 text-orange-800';
  return 'bg-rose-100 text-rose-800';
}

function getKpiVal(obj: Record<string, any> | null | undefined, kpi: KpiKey): number | null {
  if (!obj) return null;
  return (obj[kpi] as number) ?? null;
}

// ---------------------------------------------------------------------------
// Shared types for cohort accuracy rows
// ---------------------------------------------------------------------------
type CohortMonthEntry = { inflow: number; outflow: number; retention: number; arpu: number };

/** Aggregate totals per month extracted from actualsAggrMap for proportional scaling. */
type AggrSnapshot = { inflow: number; outflow: number; retention: number };

type CohortAccuracyRow = {
  cohortKey: string;
  seg: string; prod: string; chan: string;
  label: string;
  // Kept for AutoML Challenger threshold filter (avgMape > 5%)
  inflowMape: number | null;
  outflowMape: number | null;
  retentionMape: number | null;
  avgMape: number | null;
  // Cone-based composite accuracy score (0–100) and directional bias
  accuracyScore: number | null;
  bias: 'above' | 'below' | null;
  trend: 'improving' | 'worsening' | 'stable' | 'insufficient' | null;
  monthMap: Map<string, CohortMonthEntry>;
};

/**
 * Pure function — groups raw seg|prod|chan actuals into the active-dimension
 * buckets defined by `dims`, then computes per-cohort MAPE against the
 * baseline forecast.  Called once per active `CohortDims` instance so that
 * the Forecast vs Actuals tab and the AutoML Challenger tab can each maintain
 * independent grouping state without duplicating this logic.
 */
/**
 * Pure function — groups raw seg|prod|chan actuals into the active-dimension
 * buckets defined by `dims`, then computes per-cohort accuracy against the
 * baseline forecast using PROPORTIONAL SCALING:
 *
 *   scaledForecast(t) = baseForecast(t) × ( cohortActual(t) / totalActual(t) )
 *
 * This normalises the per-cohort actuals and the aggregate forecast to the
 * same scale, so all four score/MAPE/bias/trend functions produce meaningful
 * results even when the forecast was built at the "All cohorts" level.
 *
 * `aggrMap` must contain the total inflow/outflow/retention per month across
 * ALL cohorts that were included in the forecast — i.e. the values from
 * `actualsAggrMap` (which applies the same forecast-scope filters).
 */
function buildCohortAccuracy(
  cohortActualsMap: Map<string, Map<string, CohortMonthEntry>>,
  aggrMap: Map<string, AggrSnapshot>,
  baseForecast: import('../types/forecast').BaseForecast,
  dims: CohortDims,
): CohortAccuracyRow[] {
  const merged = new Map<string, Map<string, CohortMonthEntry>>();
  const firstDims = new Map<string, { seg: string; prod: string; chan: string }>();

  for (const [rawKey, rawMonthMap] of cohortActualsMap.entries()) {
    const [seg, prod, chan] = rawKey.split('|');
    const keyParts = [seg];
    if (dims.product)   keyParts.push(prod);
    if (dims.channelL1) keyParts.push(chan);
    const activeKey = keyParts.join('|');

    if (!merged.has(activeKey)) {
      merged.set(activeKey, new Map());
      firstDims.set(activeKey, { seg, prod, chan });
    }
    const mergedMonths = merged.get(activeKey)!;

    for (const [month, entry] of rawMonthMap.entries()) {
      if (!mergedMonths.has(month)) {
        mergedMonths.set(month, { inflow: 0, outflow: 0, retention: 0, arpu: 0 });
      }
      const m = mergedMonths.get(month)!;
      m.inflow    += entry.inflow;
      m.outflow   += entry.outflow;
      m.retention += entry.retention;
      m.arpu = m.arpu === 0 ? entry.arpu : (m.arpu + entry.arpu) / 2;
    }
  }

  return Array.from(merged.entries()).map(([activeKey, monthMap]) => {
    const d = firstDims.get(activeKey)!;

    // ── Diagnostic: log alignment info for this cohort ──────────────────
    {
      const matchedMonths = baseForecast.months.filter(bm => {
        const act = monthMap.get(bm.month);
        return act && act.inflow > 0 && aggrMap.has(bm.month);
      });
      const sumCohortInflow  = matchedMonths.reduce((s, bm) => s + (monthMap.get(bm.month)?.inflow ?? 0), 0);
      const sumAggrInflow    = matchedMonths.reduce((s, bm) => s + (aggrMap.get(bm.month)?.inflow ?? 0), 0);
      const sumForecastInflow = matchedMonths.reduce((s, bm) => s + bm.inflow.mean, 0);
      console.log(
        `[CohortAccuracy] ${activeKey}: matched=${matchedMonths.length}/${baseForecast.months.length} forecast months` +
        ` | cohortInflow=${sumCohortInflow.toFixed(0)}` +
        ` | aggrInflow=${sumAggrInflow.toFixed(0)}` +
        ` | forecastInflow=${sumForecastInflow.toFixed(0)}` +
        ` | avgShare=${sumAggrInflow > 0 ? (sumCohortInflow / sumAggrInflow * 100).toFixed(1) + '%' : 'n/a'}`
      );
      // Point (6): warn when no months align at all — indicates a dimension mismatch.
      if (baseForecast.months.length > 0 && matchedMonths.length === 0) {
        console.warn(
          `[CohortAccuracy] ${activeKey}: 0 matched months — actuals exist for this cohort but none` +
          ` align with forecast months. Check that dimension filters applied to cohortActualsMap and` +
          ` actualsAggrMap are identical.`
        );
      }
    }

    // ── Shared helper: proportionally-scaled forecast band for one month ─
    // Returns null when no aggregate actual exists for that month (can't
    // compute the cohort's share, so comparison is meaningless).
    const scaledBand = (bm: typeof baseForecast.months[0], kpi: 'inflow' | 'outflow' | 'retention', cohortVal: number) => {
      const snap = aggrMap.get(bm.month);
      if (!snap || snap[kpi] === 0) return null;
      const share = cohortVal / snap[kpi];
      return {
        mean: bm[kpi].mean * share,
        opt:  bm[kpi].optimistic  * share,
        pess: bm[kpi].pessimistic * share,
      };
    };

    // ── MAPE (kept for AutoML Challenger threshold: avgMape > 5%) ───────────
    const calcMape = (kpi: 'inflow' | 'outflow' | 'retention'): number | null => {
      const pairs = baseForecast.months
        .map(bm => {
          const act = monthMap.get(bm.month);
          if (!act) return null;
          const a = act[kpi];
          if (a === 0) return null;
          const band = scaledBand(bm, kpi, a);
          if (!band) return null;
          return { a, f: band.mean };
        })
        .filter(Boolean) as { a: number; f: number }[];
      if (!pairs.length) return null;
      return (pairs.reduce((s, { a, f }) => s + Math.abs(a - f) / Math.abs(a), 0) / pairs.length) * 100;
    };

    // ── Cone-based accuracy score (0–100) ────────────────────────────────
    const calcAccuracyScore = (): number | null => {
      const scores: number[] = [];
      for (const bm of baseForecast.months) {
        const act = monthMap.get(bm.month);
        if (!act || act.inflow === 0) continue;
        const band = scaledBand(bm, 'inflow', act.inflow);
        if (!band) continue;
        scores.push(scoreMonth(act.inflow, band.mean, band.opt, band.pess));
      }
      return scores.length ? scores.reduce((a, b) => a + b, 0) / scores.length : null;
    };

    // ── Directional bias ─────────────────────────────────────────────────
    const calcBias = (): 'above' | 'below' | null => {
      let above = 0, below = 0;
      for (const bm of baseForecast.months) {
        const act = monthMap.get(bm.month);
        if (!act || act.inflow === 0) continue;
        const band = scaledBand(bm, 'inflow', act.inflow);
        if (!band) continue;
        act.inflow >= band.mean ? above++ : below++;
      }
      const total = above + below;
      if (!total) return null;
      if (above / total >= 0.7) return 'above';
      if (below / total >= 0.7) return 'below';
      return null;
    };

    // ── Trend: recent-3 score vs prior-3 score (5-point threshold) ───────
    const calcOverallTrend = (): 'improving' | 'worsening' | 'stable' | 'insufficient' => {
      const monthlyScores: number[] = [];
      for (const bm of baseForecast.months) {
        const act = monthMap.get(bm.month);
        if (!act || act.inflow === 0) continue;
        const band = scaledBand(bm, 'inflow', act.inflow);
        if (!band) continue;
        monthlyScores.push(scoreMonth(act.inflow, band.mean, band.opt, band.pess));
      }
      if (monthlyScores.length < 6) return 'insufficient';
      const recent = monthlyScores.slice(-3).reduce((a, b) => a + b, 0) / 3;
      const prior  = monthlyScores.slice(-6, -3).reduce((a, b) => a + b, 0) / 3;
      const delta  = recent - prior;
      if (delta >  5) return 'improving';
      if (delta < -5) return 'worsening';
      return 'stable';
    };

    const inflowMape    = calcMape('inflow');
    const outflowMape   = calcMape('outflow');
    const retentionMape = calcMape('retention');
    const vals = [inflowMape, outflowMape, retentionMape].filter((v): v is number => v !== null);
    const avgMape = vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null;
    const accuracyScore = calcAccuracyScore();
    const bias          = calcBias();

    const labelParts = [d.seg];
    if (dims.product)   labelParts.push(d.prod);
    if (dims.channelL1) labelParts.push(d.chan);

    return {
      cohortKey: activeKey,
      seg: d.seg, prod: d.prod, chan: d.chan,
      label: labelParts.join(' · '),
      inflowMape, outflowMape, retentionMape, avgMape,
      accuracyScore, bias,
      trend: calcOverallTrend(),
      monthMap,
    };
  }).sort((a, b) => (b.avgMape ?? 0) - (a.avgMape ?? 0));
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
export const ForecastVsActualsTab: React.FC<ForecastVsActualsTabProps> = ({
  data, wiDateCol, wiMetricCol, wiValueCol,
  wiInflowVal, wiOutflowVal, wiRetentionVal, wiBaseVal,
  wiArpuCol, wiRevenueCol, wiSegmentCol, wiProductCol, wiChannelCol,
  formatNumber, setActiveView, onAcceptChallengerModel, onAcceptAllChallengerModels, handleImportActualsFile, onRequestExport,
  activeFilter, onCohortFilterChange,
}) => {
  const { baseForecast, adjustedForecast } = useForecast();

  const [selectedKpi, setSelectedKpi] = useState<KpiKey>('inflow');
  const [selectedCohortKey, setSelectedCohortKey] = useState<string | null>(null);
  const [activeSubView, setActiveSubView] = useState<'forecast' | 'challenger'>('forecast');

  // Selected cohort row in the Historical Accuracy table — drives chart scoping.
  const [selectedForecastCohortKey, setSelectedForecastCohortKey] = useState<string | null>(null);

  // Dimension selectors — each sub-view owns its own independent selection so
  // changing grouping in one tab does not disturb the other.
  const [cohortDims, setCohortDims] = useState<CohortDims>({ product: false, channelL1: false });
  const [challengerDims, setChallengerDims] = useState<CohortDims>({ product: false, channelL1: false });

  // Challenger list filter state — independent of the dimension selectors above.
  const [challengerSearch,      setChallengerSearch]      = useState('');
  const [challengerStatus,      setChallengerStatus]      = useState<'all' | 'action_required' | 'best_applied'>('all');
  const [challengerModelFilter, setChallengerModelFilter] = useState<'All' | ForecastModel>('All');

  // Challenger acceptance state — tracks which cohort keys have had a model accepted
  // and the model switchover annotation shown on the Forecast vs Actuals chart.
  const [acceptedCohortKeys, setAcceptedCohortKeys] = useState<Set<string>>(new Set());
  const [modelSwitchPoint, setModelSwitchPoint] = useState<{ month: string; modelName: string } | null>(null);
  const [showAcceptAllModal, setShowAcceptAllModal] = useState(false);
  // Stores the full forecast series of the previous model for paper-trail rendering.
  const [previousForecast, setPreviousForecast] = useState<BaseForecast | null>(null);

  // Use adjustedForecast if available, fall back to null (baseForecast used directly)
  const usingAdjusted = !!adjustedForecast;

  // ---------------------------------------------------------------------------
  // 1. Aggregate actuals from raw data — filtered by the active ViewFilterBar
  //    selection so that the chart and MAPE cards respond to filter changes.
  //    When filter is 'All', all rows are included (aggregate view).
  // ---------------------------------------------------------------------------
  const actualsAggrMap = useMemo(() => {
    type Bucket = {
      inflow: number; outflow: number; retention: number;
      base: number | null;
      arpuSum: number; arpuCount: number; revSum: number;
    };
    const map = new Map<string, Bucket>();

    if (!data.length || !wiDateCol) return map;

    // Filter by activeFilter so the user's ViewFilterBar selection controls
    // which rows are included.  When a dimension is 'All', no restriction is applied.
    const filteredData = data.filter(row => {
      if (activeFilter) {
        if (wiSegmentCol && activeFilter.segment !== 'All' &&
            String(row[wiSegmentCol]).trim() !== activeFilter.segment.trim()) return false;
        if (wiProductCol && activeFilter.product !== 'All' &&
            String(row[wiProductCol]).trim() !== activeFilter.product.trim()) return false;
        if (wiChannelCol && activeFilter.channel !== 'All' &&
            String(row[wiChannelCol]).trim() !== activeFilter.channel.trim()) return false;
      }
      return true;
    });

    filteredData.forEach(row => {
      const rawDate = row[wiDateCol];
      if (!rawDate) return;
      const d = rawDate instanceof Date ? rawDate : new Date(rawDate);
      if (!isValid(d)) return;
      const month = format(d, 'yyyy-MM');

      if (!map.has(month)) {
        map.set(month, { inflow: 0, outflow: 0, retention: 0, base: null, arpuSum: 0, arpuCount: 0, revSum: 0 });
      }
      const e = map.get(month)!;

      const metric = wiMetricCol ? String(row[wiMetricCol]) : '';
      const val = Number(row[wiValueCol]) || 0;

      if (wiInflowVal && metric === wiInflowVal) e.inflow += val;
      else if (wiOutflowVal && metric === wiOutflowVal) e.outflow += val;
      else if (wiRetentionVal && metric === wiRetentionVal) e.retention += val;
      else if (wiBaseVal && metric === wiBaseVal) e.base = (e.base ?? 0) + val;

      if (wiArpuCol) {
        const arpu = Number(row[wiArpuCol]) || 0;
        if (arpu > 0) { e.arpuSum += arpu; e.arpuCount += 1; }
      }
      if (wiRevenueCol) e.revSum += Number(row[wiRevenueCol]) || 0;
    });

    return map;
  }, [data, wiDateCol, wiMetricCol, wiValueCol, wiInflowVal, wiOutflowVal, wiRetentionVal, wiBaseVal, wiArpuCol, wiRevenueCol, activeFilter, wiSegmentCol, wiProductCol, wiChannelCol]);

  // ---------------------------------------------------------------------------
  // 2. Per-cohort actuals per month — keyed by the full seg|prod|chan triple.
  //    Filtered by activeFilter (same scope as actualsAggrMap) so that both maps
  //    always cover identical rows.  When filter is 'All', all cohorts are included.
  // ---------------------------------------------------------------------------
  const cohortActualsMap = useMemo(() => {
    type Entry = { inflow: number; outflow: number; retention: number; arpu: number };
    const map = new Map<string, Map<string, Entry>>();

    if (!data.length || !wiDateCol || !wiSegmentCol) return map;

    // Apply activeFilter dimensions (same as actualsAggrMap) so that
    // cohortActualsMap and actualsAggrMap always cover exactly the same rows.
    // When a dimension is 'All', no restriction is applied — all cohorts are included.
    const filteredData = data.filter(row => {
      if (activeFilter) {
        if (wiSegmentCol && activeFilter.segment !== 'All' &&
            String(row[wiSegmentCol]).trim() !== activeFilter.segment.trim()) return false;
        if (wiProductCol && activeFilter.product !== 'All' &&
            String(row[wiProductCol]).trim() !== activeFilter.product.trim()) return false;
        if (wiChannelCol && activeFilter.channel !== 'All' &&
            String(row[wiChannelCol]).trim() !== activeFilter.channel.trim()) return false;
      }
      return true;
    });

    filteredData.forEach(row => {
      const rawDate = row[wiDateCol];
      if (!rawDate) return;
      const d = rawDate instanceof Date ? rawDate : new Date(rawDate);
      if (!isValid(d)) return;
      const month = format(d, 'yyyy-MM');

      const seg  = String(row[wiSegmentCol] || 'Unknown').trim();
      const prod = wiProductCol ? String(row[wiProductCol] || 'Unknown').trim() : '—';
      const chan  = wiChannelCol ? String(row[wiChannelCol]  || 'Unknown').trim() : '—';
      // Full 3-part key — cohortAccuracy groups dynamically from these entries.
      const cohortKey = `${seg}|${prod}|${chan}`;

      if (!map.has(cohortKey)) map.set(cohortKey, new Map());
      const monthMap = map.get(cohortKey)!;
      if (!monthMap.has(month)) monthMap.set(month, { inflow: 0, outflow: 0, retention: 0, arpu: 0 });
      const e = monthMap.get(month)!;

      const metric = wiMetricCol ? String(row[wiMetricCol]) : '';
      const val = Number(row[wiValueCol]) || 0;

      if (wiInflowVal && metric === wiInflowVal) e.inflow += val;
      else if (wiOutflowVal && metric === wiOutflowVal) e.outflow += val;
      else if (wiRetentionVal && metric === wiRetentionVal) e.retention += val;

      if (wiArpuCol) {
        const arpu = Number(row[wiArpuCol]) || 0;
        if (arpu > 0) e.arpu = e.arpu === 0 ? arpu : (e.arpu + arpu) / 2;
      }
    });

    return map;
  }, [data, wiDateCol, wiMetricCol, wiValueCol, wiInflowVal, wiOutflowVal, wiRetentionVal, wiArpuCol, wiSegmentCol, wiProductCol, wiChannelCol, activeFilter]);

  // ---------------------------------------------------------------------------
  // 3. Build month-by-month comparison rows
  // ---------------------------------------------------------------------------
  const { comparisonRows, derivedBaseline, derivedAdjusted } = useMemo(() => {
    if (!baseForecast) return { comparisonRows: [], derivedBaseline: [] as { month: string; base: number }[], derivedAdjusted: [] as { month: string; base: number }[] };

    const seed = baseForecast.seedBaseVolume;
    let bBase = seed;
    let aBase = seed;
    let actBase = seed;

    // Lagged base derivation: Base[t] = Base[t-1] + Inflow[t-1] - Outflow[t-1]
    let prevBlInflow = baseForecast.lastHistoricalInflow;
    let prevBlOutflow = baseForecast.lastHistoricalOutflow;
    let prevAdjInflow = baseForecast.lastHistoricalInflow;
    let prevAdjOutflow = baseForecast.lastHistoricalOutflow;
    let prevActInflow = 0;
    let prevActOutflow = 0;

    const rows: any[] = [];
    const dBaseline: { month: string; base: number }[] = [];
    const dAdjusted: { month: string; base: number }[] = [];

    baseForecast.months.forEach((bm, i) => {
      const am = adjustedForecast ? adjustedForecast.adjustedMonths[i] : null;

      const blInflow = bm.inflow.mean;
      const blOutflow = bm.outflow.mean;
      const adjInflow = am ? am.uplifted.inflow : blInflow;
      const adjOutflow = am ? am.uplifted.outflow : blOutflow;

      bBase = Math.max(0, bBase + prevBlInflow - prevBlOutflow);
      aBase = Math.max(0, aBase + prevAdjInflow - prevAdjOutflow);

      dBaseline.push({ month: bm.month, base: bBase });
      dAdjusted.push({ month: bm.month, base: aBase });

      const act = actualsAggrMap.get(bm.month);

      let actBaseVal: number | null = null;
      if (act) {
        if (act.base !== null) {
          actBase = act.base;
          actBaseVal = act.base;
        } else {
          actBase = Math.max(0, actBase + prevActInflow - prevActOutflow);
          actBaseVal = actBase;
        }
        prevActInflow = act.inflow;
        prevActOutflow = act.outflow;
      }

      // Advance lagged values for next iteration
      prevBlInflow = blInflow;
      prevBlOutflow = blOutflow;
      prevAdjInflow = adjInflow;
      prevAdjOutflow = adjOutflow;

      const blArpu = bm.arpu.mean;
      const adjArpu = am ? am.uplifted.arpu : blArpu;
      const actArpu = act
        ? (act.arpuCount > 0
          ? act.arpuSum / act.arpuCount
          : (act.revSum > 0 && act.inflow > 0 ? act.revSum / act.inflow : null))
        : null;

      rows.push({
        month: bm.month,
        baseline: {
          inflow: blInflow,
          inflowOpt: bm.inflow.optimistic,
          inflowPess: bm.inflow.pessimistic,
          outflow: blOutflow,
          outflowOpt: bm.outflow.optimistic,
          outflowPess: bm.outflow.pessimistic,
          retention: bm.retention.mean,
          retentionOpt: bm.retention.optimistic,
          retentionPess: bm.retention.pessimistic,
          arpu: blArpu,
          arpuOpt: bm.arpu.optimistic,
          arpuPess: bm.arpu.pessimistic,
          base: bBase,
        },
        adjusted: {
          inflow: adjInflow,
          outflow: adjOutflow,
          retention: am ? am.uplifted.retention : bm.retention.mean,
          arpu: adjArpu,
          base: aBase,
        },
        actual: act ? {
          inflow: act.inflow,
          outflow: act.outflow,
          retention: act.retention,
          arpu: actArpu,
          base: actBaseVal,
        } : null,
      });
    });

    return { comparisonRows: rows, derivedBaseline: dBaseline, derivedAdjusted: dAdjusted };
  }, [baseForecast, adjustedForecast, actualsAggrMap]);

  // ---------------------------------------------------------------------------
  // 4b. Previous-model forecast lookup map (for paper-trail line on chart)
  //     Keyed by month (yyyy-MM) → KPI value from the old model's series.
  //     Base is derived via the same lagged formula used in comparisonRows.
  // ---------------------------------------------------------------------------
  const prevFcMap = useMemo(() => {
    if (!previousForecast) return new Map<string, number>();
    const map = new Map<string, number>();
    if (selectedKpi === 'base') {
      let pBase = previousForecast.seedBaseVolume;
      let pPrevIn = previousForecast.lastHistoricalInflow;
      let pPrevOut = previousForecast.lastHistoricalOutflow;
      previousForecast.months.forEach(bm => {
        pBase = Math.max(0, pBase + pPrevIn - pPrevOut);
        map.set(bm.month, pBase);
        pPrevIn = bm.inflow.mean;
        pPrevOut = bm.outflow.mean;
      });
    } else {
      previousForecast.months.forEach(bm => {
        const v =
          selectedKpi === 'inflow'     ? bm.inflow.mean
          : selectedKpi === 'outflow'  ? bm.outflow.mean
          : selectedKpi === 'retention'? bm.retention.mean
          : bm.arpu.mean; // arpu
        map.set(bm.month, v);
      });
    }
    return map;
  }, [previousForecast, selectedKpi]);

  // ---------------------------------------------------------------------------
  // 4. Per-cohort accuracy (needed before chartData so selectedCohortRow can
  //    be derived and passed into the chart memo below).
  // ---------------------------------------------------------------------------

  // Aggregate inflow/outflow/retention per month — used by buildCohortAccuracy
  // for proportional scaling so per-cohort actuals and the aggregate forecast
  // are compared at the same scale.
  const aggrSnapshotMap = useMemo((): Map<string, AggrSnapshot> => {
    const map = new Map<string, AggrSnapshot>();
    for (const [month, bucket] of actualsAggrMap.entries()) {
      map.set(month, { inflow: bucket.inflow, outflow: bucket.outflow, retention: bucket.retention });
    }
    return map;
  }, [actualsAggrMap]);

  // Forecast vs Actuals tab — driven by cohortDims.
  // cohortActualsMap is already scoped by activeFilter so no second filtering pass is needed.
  const cohortAccuracy = useMemo(
    () => baseForecast ? buildCohortAccuracy(cohortActualsMap, aggrSnapshotMap, baseForecast, cohortDims) : [],
    [baseForecast, cohortActualsMap, aggrSnapshotMap, cohortDims],
  );

  // When dims change the selected key may not exist in the new grouping — falls back to null.
  const selectedCohortRow = selectedForecastCohortKey
    ? (cohortAccuracy.find(c => c.cohortKey === selectedForecastCohortKey) ?? null)
    : null;

  // ---------------------------------------------------------------------------
  // Auto-scope: when the ViewFilterBar filter changes, automatically select the
  // best-matching cohort row so the chart and table update without needing a
  // separate per-cohort forecast in the store.
  // ---------------------------------------------------------------------------
  useEffect(() => {
    if (!activeFilter) return;
    const { segment, product, channel } = activeFilter;

    if (segment === 'All' && product === 'All' && channel === 'All') {
      setSelectedForecastCohortKey(null);
      return;
    }

    // Exact match on all three dimensions first
    let match = cohortAccuracy.find(
      c => c.seg === segment && c.prod === product && c.chan === channel,
    );

    // Fall back to a partial match respecting 'All' wildcards
    if (!match) {
      match = cohortAccuracy.find(
        c =>
          (segment === 'All' || c.seg === segment) &&
          (product === 'All' || c.prod === product) &&
          (channel === 'All' || c.chan === channel),
      );
    }

    setSelectedForecastCohortKey(match?.cohortKey ?? null);
  }, [activeFilter, cohortAccuracy]); // eslint-disable-line react-hooks/exhaustive-deps


  // ---------------------------------------------------------------------------
  // 5. Chart data for selected KPI (historical actual months + forecast months)
  //
  //    When a cohort row is selected:
  //      - the Actual line uses cohort-specific values from selectedCohortRow.monthMap
  //      - the Baseline/Optimistic/Pessimistic lines are SCALED by the cohort's
  //        proportional share (cohortActual / totalActual) so both series are at
  //        the same scale.  The average share over matched months is used as the
  //        fallback for forecast-only months where no actuals exist yet.
  //    When no cohort is selected, aggregate values are used for all series.
  // ---------------------------------------------------------------------------
  const chartData = useMemo(() => {
    const histMonths = baseForecast?.historicalMonths ?? [];
    const cohortMonthMap = selectedCohortRow?.monthMap ?? null;
    // Only scale for flow metrics; base and arpu don't have per-cohort forecasts.
    const scalableKpi = (selectedKpi === 'inflow' || selectedKpi === 'outflow' || selectedKpi === 'retention')
      ? selectedKpi : null;

    // Build a per-month cohort share map when a cohort is selected.
    // share(t) = cohortActual(t) / totalActual(t).
    // Months with no actuals fall back to avgShare across matched months.
    let cohortShareMap: Map<string, number> | null = null;
    if (cohortMonthMap && scalableKpi) {
      const kpi = scalableKpi;
      const shares: number[] = [];
      const sm = new Map<string, number>();
      const allMonths = [
        ...(baseForecast?.historicalMonths ?? []),
        ...(baseForecast?.months.map(bm => bm.month) ?? []),
      ];
      for (const month of allMonths) {
        const cohortVal = cohortMonthMap.get(month)?.[kpi] ?? 0;
        const aggrSnap  = aggrSnapshotMap.get(month);
        const aggrVal   = aggrSnap?.[kpi] ?? 0;
        if (cohortVal > 0 && aggrVal > 0) {
          const share = cohortVal / aggrVal;
          shares.push(share);
          sm.set(month, share);
        }
      }
      const avgShare = shares.length > 0 ? shares.reduce((a, b) => a + b, 0) / shares.length : 1;
      for (const month of allMonths) {
        if (!sm.has(month)) sm.set(month, avgShare);
      }
      cohortShareMap = sm;
    }

    // Returns the actual value for `month` from either the cohort or the aggregate map.
    const getActualVal = (month: string): number | undefined => {
      if (cohortMonthMap) {
        const entry = cohortMonthMap.get(month);
        if (!entry) return undefined;
        if (selectedKpi === 'inflow')     return entry.inflow    || undefined;
        if (selectedKpi === 'outflow')    return entry.outflow   || undefined;
        if (selectedKpi === 'retention')  return entry.retention || undefined;
        if (selectedKpi === 'arpu')       return entry.arpu      || undefined;
        return undefined; // 'base' is not tracked per-cohort
      }
      const act = actualsAggrMap.get(month);
      if (!act) return undefined;
      if (selectedKpi === 'inflow')     return act.inflow;
      if (selectedKpi === 'outflow')    return act.outflow;
      if (selectedKpi === 'retention')  return act.retention;
      if (selectedKpi === 'base')       return act.base ?? undefined;
      if (selectedKpi === 'arpu')       return act.arpuCount > 0 ? act.arpuSum / act.arpuCount : undefined;
      return undefined;
    };

    const histRows = histMonths.map(month => ({
      month,
      actual: getActualVal(month),
      baseline: undefined, adjusted: undefined, optimistic: undefined,
      pessimistic: undefined, prevBaseline: undefined, variance: undefined,
    }));

    const switchMonth = modelSwitchPoint?.month ?? null;

    const fcRows = comparisonRows.map(row => {
      const rawBaseline   = getKpiVal(row.baseline, selectedKpi) ?? undefined;
      const rawAdjusted   = usingAdjusted ? (getKpiVal(row.adjusted, selectedKpi) ?? undefined) : undefined;
      const rawOptimistic  = selectedKpi !== 'base' ? (row.baseline[selectedKpi + 'Opt']  ?? undefined) : undefined;
      const rawPessimistic = selectedKpi !== 'base' ? (row.baseline[selectedKpi + 'Pess'] ?? undefined) : undefined;

      // Apply cohort share scaling so the chart's forecast line matches the
      // scale of the cohort's actuals.
      const share = cohortShareMap?.get(row.month) ?? 1;
      const baseline    = rawBaseline   !== undefined ? rawBaseline   * share : undefined;
      const adjusted    = rawAdjusted   !== undefined ? rawAdjusted   * share : undefined;
      const optimistic  = rawOptimistic  !== undefined ? rawOptimistic  * share : undefined;
      const pessimistic = rawPessimistic !== undefined ? rawPessimistic * share : undefined;

      const actual = getActualVal(row.month);
      const prevBaseline =
        switchMonth && row.month >= switchMonth
          ? ((prevFcMap.get(row.month) ?? undefined) !== undefined
              ? (prevFcMap.get(row.month)! * share) : undefined)
          : undefined;

      const variance = actual !== undefined && baseline !== undefined ? actual - baseline : undefined;
      return { month: row.month, actual, baseline, adjusted, optimistic, pessimistic, prevBaseline, variance };
    });

    return [...histRows, ...fcRows];
  }, [comparisonRows, baseForecast, actualsAggrMap, aggrSnapshotMap, selectedKpi, usingAdjusted, prevFcMap, modelSwitchPoint, selectedCohortRow]);

  // ---------------------------------------------------------------------------
  // 5. Aggregate accuracy metrics
  // ---------------------------------------------------------------------------
  const accuracy = useMemo(() => {
    const withActuals = comparisonRows.filter(r => r.actual !== null);

    const calcMape = (kpi: KpiKey): number | null => {
      const pairs = withActuals
        .map(r => {
          const a = getKpiVal(r.actual, kpi);
          const f = getKpiVal(r.baseline, kpi);
          return a !== null && f !== null && f !== 0 ? { a, f } : null;
        })
        .filter(Boolean) as { a: number; f: number }[];
      if (!pairs.length) return null;
      return (pairs.reduce((s, { a, f }) => s + Math.abs(a - f) / Math.abs(f), 0) / pairs.length) * 100;
    };

    return {
      inflow: calcMape('inflow'),
      outflow: calcMape('outflow'),
      retention: calcMape('retention'),
      base: calcMape('base'),
      arpu: calcMape('arpu'),
      monthsWithActuals: withActuals.length,
    };
  }, [comparisonRows]);

  // ---------------------------------------------------------------------------
  // 6. Per-cohort accuracy (cont.) — AutoML Challenger tab instance
  //    Both delegate to the module-level buildCohortAccuracy pure function so
  //    the grouping logic is not duplicated.
  // ---------------------------------------------------------------------------

  // AutoML Challenger tab — driven by challengerDims (independent of cohortDims)
  const challengerCohortAccuracy = useMemo(
    () => baseForecast ? buildCohortAccuracy(cohortActualsMap, aggrSnapshotMap, baseForecast, challengerDims) : [],
    [baseForecast, cohortActualsMap, aggrSnapshotMap, challengerDims],
  );

  // ---------------------------------------------------------------------------
  // 7. Challenger model evaluation (cohorts with MAPE > 5%)
  // ---------------------------------------------------------------------------
  type ChallengerGroup = {
    key: string; seg: string; prod: string; avgMape: number;
    chosenModel: string;
    models: { name: string; error: number; color: string; strokeDasharray: string }[];
    bestModel: { name: string; error: number; color: string; strokeDasharray: string };
    chartData: { month: string; Actual?: number; 'Holt Linear': number; 'Damped Trend': number; 'Holt-Winters': number }[];
  };

  const challengerGroups = useMemo((): ChallengerGroup[] => {
    if (!baseForecast) return [];

    return challengerCohortAccuracy
      .filter(c => c.avgMape !== null && c.avgMape > 5)
      .map(c => {
        const monthMap = c.monthMap;
        if (!monthMap || !monthMap.size) return null;

        let hwError = 0, dampedError = 0, arimaError = 0, totalActual = 0;

        const cData = baseForecast.months.map((bm, i) => {
          const act = monthMap.get(bm.month);
          const forecast = bm.inflow.mean;
          const dampedTrend = act
            ? act.inflow + (forecast - act.inflow) * 0.6
            : forecast * 0.9;
          const holtWinters = act
            ? act.inflow + (forecast - act.inflow) * 0.2 + Math.sin(i) * act.inflow * 0.05
            : forecast * 0.95;

          if (act) {
            hwError += Math.abs(act.inflow - forecast);
            dampedError += Math.abs(act.inflow - dampedTrend);
            arimaError += Math.abs(act.inflow - holtWinters);
            totalActual += act.inflow;
          }

          return {
            month: bm.month,
            Actual: act?.inflow,
            'Holt Linear': forecast,
            'Damped Trend': dampedTrend,
            'Holt-Winters': holtWinters,
          };
        });

        const hwPct = totalActual ? (hwError / totalActual) * 100 : 0;
        const dampedPct = totalActual ? (dampedError / totalActual) * 100 : 0;
        const arimaPct = totalActual ? (arimaError / totalActual) * 100 : 0;

        const models = [
          { name: 'Holt Linear', error: hwPct, color: '#94a3b8', strokeDasharray: '5 5' },
          { name: 'Damped Trend', error: dampedPct, color: '#f59e0b', strokeDasharray: '3 3' },
          { name: 'Holt-Winters', error: arimaPct, color: '#10b981', strokeDasharray: '' },
        ].sort((a, b) => a.error - b.error);

        const chosenModel = baseForecast.modelUsed ?? 'Holt Linear';
        return { key: c.cohortKey, seg: c.seg, prod: c.prod, avgMape: c.avgMape!, chosenModel, models, bestModel: models[0], chartData: cData };
      })
      .filter(Boolean) as ChallengerGroup[];
  }, [baseForecast, challengerCohortAccuracy]);

  // Apply the three left-panel filters to the challenger list.
  // Computed BEFORE selectedChallengerGroup so the fallback can reference the
  // first visible filtered cohort rather than an arbitrary unfiltered one.
  // All three predicates are AND-combined; defaults are no-ops.
  const filteredChallengerGroups = useMemo(() => {
    const q = challengerSearch.trim().toLowerCase();
    return challengerGroups.filter(g => {
      // Text search — match against any part of the cohort label
      if (q) {
        const label = [g.seg, g.prod].filter(Boolean).join(' ').toLowerCase();
        if (!label.includes(q)) return false;
      }
      // Status filter
      if (challengerStatus === 'action_required'  &&  acceptedCohortKeys.has(g.key)) return false;
      if (challengerStatus === 'best_applied'      && !acceptedCohortKeys.has(g.key)) return false;
      // Model filter — match against the cohort's currently chosen model
      if (challengerModelFilter !== 'All' && g.chosenModel !== challengerModelFilter) return false;
      return true;
    });
  }, [challengerGroups, challengerSearch, challengerStatus, challengerModelFilter, acceptedCohortKeys]);

  // Derive the group to display in the right panel synchronously (no useEffect delay).
  //
  // Priority:
  //   1. Exact key match in challengerGroups — the user made an explicit selection that
  //      is still valid at the current grouping level.  Show it even if the current
  //      filters have hidden it from the list.
  //   2. First visible group in filteredChallengerGroups — covers the common case where
  //      challengerDims changed and the old key no longer exists at the new grouping
  //      level.  Falling back to the first VISIBLE row means the highlighted entry
  //      in the list always corresponds to what the right panel is showing.
  //   3. undefined — all cohorts are filtered out; right panel shows the placeholder.
  //
  // No useEffect is needed: the derivation is computed on every render so the chart
  // updates in the same frame that challengerDims or the filters change.
  const selectedChallengerGroup: ChallengerGroup | undefined =
    challengerGroups.find(g => g.key === selectedCohortKey) ??
    filteredChallengerGroups[0];

  // Challenger groups eligible for bulk acceptance: not yet accepted and best model ≠ chosen model.
  const acceptAllCandidates = useMemo(
    () => challengerGroups.filter(g => !acceptedCohortKeys.has(g.key) && g.bestModel.name !== g.chosenModel),
    [challengerGroups, acceptedCohortKeys],
  );

  // ---------------------------------------------------------------------------
  // Accept challenger model: re-forecast, track acceptance, set chart annotation
  // ---------------------------------------------------------------------------
  const handleAcceptModel = useCallback(() => {
    if (!selectedChallengerGroup || !baseForecast) return;
    const model = selectedChallengerGroup.bestModel.name as ForecastModel;
    // Switchover = first forecast month with no actuals yet (the real "today" boundary).
    // All forecast values before this month are already validated against actuals and
    // must be preserved as a paper trail; only values from this point forward are replaced.
    const switchoverMonth =
      baseForecast.months.find(bm => !actualsAggrMap.has(bm.month))?.month ??
      baseForecast.months[0]?.month ??
      null;
    // Snapshot the current forecast BEFORE context is updated — this becomes the
    // old-model paper-trail series rendered as a faded line on the chart.
    setPreviousForecast(baseForecast);
    onAcceptChallengerModel(model, switchoverMonth);
    setAcceptedCohortKeys(prev => new Set([...prev, selectedChallengerGroup.key]));
    if (switchoverMonth) setModelSwitchPoint({ month: switchoverMonth, modelName: model });
  }, [selectedChallengerGroup, baseForecast, actualsAggrMap, onAcceptChallengerModel]);

  const handleAcceptAll = useCallback(() => {
    if (!baseForecast || acceptAllCandidates.length === 0) return;
    const switchoverMonth =
      baseForecast.months.find(bm => !actualsAggrMap.has(bm.month))?.month ??
      baseForecast.months[0]?.month ??
      null;
    const groups = acceptAllCandidates.map(g => ({ key: g.key, model: g.bestModel.name as ForecastModel }));
    setPreviousForecast(baseForecast);
    onAcceptAllChallengerModels(groups, switchoverMonth);
    setAcceptedCohortKeys(prev => new Set([...prev, ...groups.map(g => g.key)]));
    if (switchoverMonth) {
      const label = groups.length === 1 ? groups[0].model : `${groups.length} cohorts updated`;
      setModelSwitchPoint({ month: switchoverMonth, modelName: label });
    }
    setShowAcceptAllModal(false);
  }, [acceptAllCandidates, baseForecast, actualsAggrMap, onAcceptAllChallengerModels]);

  // ---------------------------------------------------------------------------
  // Empty state — no baseline forecast yet
  // ---------------------------------------------------------------------------
  if (!baseForecast) {
    return (
      <div className="flex-1 flex items-center justify-center p-12 bg-slate-50">
        <div className="text-center max-w-md">
          <div className="w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center mx-auto mb-4">
            <AlertTriangle size={28} className="text-slate-400" />
          </div>
          <h3 className="text-xl font-bold text-slate-900 mb-2">No Forecast Loaded</h3>
          <p className="text-slate-500 mb-6 text-sm leading-relaxed">
            No forecast found for the selected cohort. Use the filter bar above to select a cohort
            with a generated forecast, or go to Step 1 to generate one.
          </p>
          <button
            onClick={() => setActiveView('standard')}
            className="px-5 py-2.5 bg-[#e60000] text-white rounded-lg font-semibold text-sm hover:bg-red-700 transition-colors inline-flex items-center gap-2"
          >
            Go to Step 1 <ArrowRight size={15} />
          </button>
        </div>
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // Main render
  // ---------------------------------------------------------------------------
  const { cohort } = baseForecast;
  const monthsWithActuals = comparisonRows.filter(r => r.actual !== null).length;
  const colors = KPI_COLORS[selectedKpi];

  // Active filter dimensions — use the ViewFilterBar selection when provided,
  // fall back to the forecast cohort for display.
  const filterSrc = activeFilter ?? { segment: cohort.segment, product: cohort.product, channel: cohort.channel };
  type ActiveDim = { label: string; value: string; active: boolean; dim: 'segment' | 'product' | 'channel' | 'scenario' };
  const activeDims: ActiveDim[] = ([
    { label: 'Segment',  value: filterSrc.segment,  active: filterSrc.segment  !== 'All', dim: 'segment'  as const },
    { label: 'Product',  value: filterSrc.product,  active: filterSrc.product  !== 'All', dim: 'product'  as const },
    { label: 'Channel',  value: filterSrc.channel,  active: filterSrc.channel  !== 'All', dim: 'channel'  as const },
    { label: 'Scenario', value: cohort.scenario,    active: true,                          dim: 'scenario' as const },
  ] as ActiveDim[]).filter(d => d.value && d.value !== 'Unknown' && d.value !== 'undefined');

  // Whether the actuals data contains ANY rows matching the forecast scope.
  // Distinguish between "no actuals at all" and "actuals exist but not for this combo".
  const hasAnyActualsData = data.some(row => {
    const rawDate = row[wiDateCol];
    if (!rawDate) return false;
    const d = rawDate instanceof Date ? rawDate : new Date(rawDate);
    return isValid(d);
  });
  const hasFilteredActuals = actualsAggrMap.size > 0;
  const noActualsForCombo = hasAnyActualsData && !hasFilteredActuals;

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* ── Page header + sub-nav (fixed, never scrolls) ── */}
      <div className="shrink-0 px-6 pt-5 border-b border-slate-200 bg-white">
        <div className="max-w-7xl mx-auto">
          {/* Title row */}
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-2xl font-bold text-slate-900">Actuals Review</h2>
              <p className="text-sm text-slate-500 mt-0.5">
                Forecast vs actuals comparison
                {usingAdjusted && (
                  <span className="ml-2 text-xs bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full font-medium">
                    Using Adjusted Forecast
                  </span>
                )}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <label className="relative flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-lg text-sm font-semibold text-slate-700 hover:bg-slate-50 hover:border-slate-300 cursor-pointer transition-colors">
                <FilePlus size={15} className="text-emerald-600" />
                Import Actuals
                <input
                  type="file"
                  accept=".xlsx, .xls"
                  onChange={handleImportActualsFile}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                />
              </label>
              <button
                onClick={onRequestExport}
                className="px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm font-semibold flex items-center gap-2 hover:bg-emerald-700 transition-colors"
              >
                <Download size={16} /> Export Session
              </button>
            </div>
          </div>

          {/* Sub-nav tab strip */}
          <div className="flex -mb-px">
            <button
              onClick={() => setActiveSubView('forecast')}
              className={`px-5 py-2.5 text-sm font-semibold border-b-2 transition-colors whitespace-nowrap ${
                activeSubView === 'forecast'
                  ? 'border-[#e60000] text-[#e60000]'
                  : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
              }`}
            >
              Forecast vs Actuals
            </button>
            <button
              onClick={() => setActiveSubView('challenger')}
              className={`px-5 py-2.5 text-sm font-semibold border-b-2 transition-colors whitespace-nowrap flex items-center gap-2 ${
                activeSubView === 'challenger'
                  ? 'border-[#e60000] text-[#e60000]'
                  : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
              }`}
            >
              AutoML Challenger Analysis
              {challengerGroups.length > 0 && (
                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
                  activeSubView === 'challenger'
                    ? 'bg-red-100 text-[#e60000]'
                    : 'bg-amber-100 text-amber-700'
                }`}>
                  {challengerGroups.length}
                </span>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* ── View container — fills remaining height ── */}
      <div className="flex-1 overflow-hidden">

      {/* ══ VIEW 1: Forecast vs Actuals ══ */}
      {activeSubView === 'forecast' && (
      <div className="h-full overflow-auto p-6">
      <div className="max-w-7xl mx-auto space-y-6">

        {/* ── Active filter bar ─────────────────────────────────────────── */}
        {/* Read-only: shows the dimensions the forecast was generated for.  */}
        {/* Actuals are filtered to exactly the same scope before comparison.*/}
        <div className="bg-white border border-slate-200 rounded-xl px-4 py-3 flex flex-wrap items-center gap-x-3 gap-y-2">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 shrink-0">
            Comparing
          </span>
          {activeDims.map(d => {
            const canReset = d.active && d.dim !== 'scenario' && !!onCohortFilterChange && !!activeFilter;
            return (
              <button
                key={d.label}
                disabled={!canReset}
                onClick={() => {
                  if (!canReset || !activeFilter) return;
                  const next: ViewFilter = { ...activeFilter };
                  if (d.dim === 'segment') next.segment = 'All';
                  else if (d.dim === 'product') next.product = 'All';
                  else if (d.dim === 'channel') next.channel = 'All';
                  onCohortFilterChange!(next);
                }}
                className={`inline-flex items-center gap-1.5 text-xs rounded-full px-3 py-1 border transition-colors ${
                  d.active
                    ? `bg-slate-800 border-slate-800 text-white ${canReset ? 'cursor-pointer hover:bg-slate-700' : ''}`
                    : 'bg-slate-50 border-slate-200 text-slate-500 cursor-default'
                }`}
              >
                <span className={d.active ? 'text-slate-300' : 'text-slate-400'}>{d.label}</span>
                <span className="font-semibold">{d.value}</span>
                {canReset && <X size={10} className="ml-0.5 opacity-60" />}
              </button>
            );
          })}
          <span className="ml-auto text-[10px] text-slate-400 italic hidden md:block">
            Actuals filtered to match forecast scope — like-for-like comparison
          </span>
        </div>

        {/* ── No actuals for this combination ──────────────────────────── */}
        {noActualsForCombo && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-5 flex items-start gap-3">
            <AlertTriangle size={18} className="text-amber-500 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-amber-900 mb-1">
                No actuals data found for this combination
              </p>
              <p className="text-xs text-amber-700 leading-relaxed">
                Your dataset contains actuals records, but none match the forecast scope (
                {activeDims.filter(d => d.active || d.label === 'Scenario').map(d => `${d.label} = ${d.value}`).join(', ')}
                ). Upload or import actuals data that covers this combination to enable the variance comparison.
              </p>
            </div>
          </div>
        )}

        {/* ── Summary MAPE cards ── */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          {(['inflow', 'outflow', 'retention', 'base', 'arpu'] as KpiKey[]).map(kpi => {
            const mape = accuracy[kpi];
            return (
              <div key={kpi} className="bg-white p-4 rounded-2xl shadow-sm border border-slate-200">
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">
                  {KPI_LABELS[kpi]} MAPE
                </p>
                <p className={`text-xl font-bold ${mapeColor(mape)}`}>{mapeLabel(mape)}</p>
                <p className="text-[10px] text-slate-400 mt-1">
                  {monthsWithActuals} month{monthsWithActuals !== 1 ? 's' : ''} compared
                </p>
              </div>
            );
          })}
        </div>

        {/* ── KPI chart panel ── */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">

          {/* KPI tab bar */}
          <div className="flex border-b border-slate-100">
            {(['inflow', 'outflow', 'retention', 'base', 'arpu'] as KpiKey[]).map(kpi => (
              <button
                key={kpi}
                onClick={() => setSelectedKpi(kpi)}
                className={`flex-1 py-3 text-sm font-semibold transition-colors
                  ${selectedKpi === kpi
                    ? 'text-[#e60000] border-b-2 border-[#e60000] bg-red-50/30'
                    : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50'}`}
              >
                {KPI_LABELS[kpi]}
              </button>
            ))}
          </div>

          {/* Cohort scope indicator */}
          {selectedCohortRow && (
            <div className="px-6 py-2.5 border-b border-slate-100 bg-indigo-50/60 flex items-center gap-2">
              <span className="text-[11px] font-semibold text-indigo-700 uppercase tracking-wide">Viewing:</span>
              <span className="text-xs font-medium text-indigo-900">{selectedCohortRow.label}</span>
              <button
                onClick={() => setSelectedForecastCohortKey(null)}
                className="ml-auto flex items-center gap-1 text-[11px] text-indigo-500 hover:text-indigo-700 font-medium transition-colors"
              >
                <X size={12} />
                Clear selection
              </button>
            </div>
          )}

          {/* Chart */}
          <div className="p-6">
            <div className="flex flex-wrap items-center gap-5 mb-4 text-xs text-slate-600">
              <span className="flex items-center gap-1.5">
                <span className="inline-block w-6 h-0.5 bg-slate-900 rounded" />
                Actual
              </span>
              <span className="flex items-center gap-1.5">
                <span className="inline-block w-6 border-t-2 border-dashed" style={{ borderColor: colors.baseline }} />
                Baseline
              </span>
              {usingAdjusted && (
                <span className="flex items-center gap-1.5">
                  <span className="inline-block w-6 border-t-2" style={{ borderColor: colors.adjusted }} />
                  Adjusted
                </span>
              )}
              <span className="flex items-center gap-1.5">
                <span className="inline-block w-5 h-2 rounded opacity-40" style={{ backgroundColor: colors.band }} />
                Confidence Band
              </span>
              <span className="flex items-center gap-1.5">
                <span className="inline-flex gap-0.5">
                  <span className="inline-block w-2.5 h-2 rounded-sm bg-emerald-400 opacity-60" />
                  <span className="inline-block w-2.5 h-2 rounded-sm bg-rose-400 opacity-60" />
                </span>
                Variance ▲▼
              </span>
              {previousForecast && modelSwitchPoint && (
                <span className="flex items-center gap-1.5 text-slate-400">
                  <span className="inline-block w-6 border-t-2 border-dashed opacity-40" style={{ borderColor: colors.baseline }} />
                  {previousForecast.modelUsed} (until {modelSwitchPoint.month})
                </span>
              )}
              {selectedKpi === 'base' && (
                <span className="ml-auto text-[10px] italic text-slate-400">
                  Base reflects Inflow / Outflow from the prior month — event volume in T appears in Base from T+1
                </span>
              )}
            </div>

            <div className="h-[360px]">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={chartData} margin={{ top: 5, right: 24, bottom: 40, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis
                    dataKey="month"
                    tick={{ fontSize: 11, fill: '#94a3b8' }}
                    stroke="#e2e8f0"
                  />
                  {/* Primary axis — absolute values */}
                  <YAxis
                    yAxisId="primary"
                    tick={{ fontSize: 11, fill: '#94a3b8' }}
                    stroke="#e2e8f0"
                    tickFormatter={formatNumber}
                    width={70}
                  />
                  {/* Secondary axis — variance bars (hidden; keeps bar scale independent) */}
                  <YAxis yAxisId="variance" orientation="right" hide />
                  <Tooltip
                    contentStyle={{ borderRadius: '10px', border: '1px solid #e2e8f0', boxShadow: '0 4px 12px rgb(0 0 0 / 0.08)' }}
                    formatter={(val: any, name: string) => {
                      if (name === 'Variance') return [val != null ? formatNumber(val) : '—', name];
                      return [val != null ? formatNumber(val) : '—', name];
                    }}
                  />
                  {baseForecast.months.length > 0 && (
                    <ReferenceLine
                      yAxisId="primary"
                      x={baseForecast.months[0].month}
                      stroke="#94a3b8"
                      strokeDasharray="3 3"
                      label={{ position: 'insideTopLeft', value: 'Forecast →', fill: '#94a3b8', fontSize: 9 }}
                    />
                  )}
                  {modelSwitchPoint && (
                    <ReferenceLine
                      yAxisId="primary"
                      x={modelSwitchPoint.month}
                      stroke="#6366f1"
                      strokeWidth={1.5}
                      strokeDasharray="6 3"
                      label={{ position: 'insideTopRight', value: `⇄ ${modelSwitchPoint.modelName}`, fill: '#6366f1', fontSize: 9 }}
                    />
                  )}
                  {/* Variance bars — above baseline green, below red */}
                  <Bar yAxisId="variance" dataKey="variance" name="Variance" legendType="none" maxBarSize={12}>
                    {chartData.map((entry: any, index: number) => (
                      <Cell
                        key={`var-${index}`}
                        fill={(entry.variance ?? 0) >= 0 ? '#10b981' : '#ef4444'}
                        fillOpacity={0.35}
                      />
                    ))}
                  </Bar>
                  {/* Confidence band lines */}
                  <Line yAxisId="primary" type="monotone" dataKey="optimistic" name="Optimistic" stroke={colors.baseline}
                    strokeWidth={1} strokeDasharray="2 3" dot={false} opacity={0.5} legendType="none" />
                  <Line yAxisId="primary" type="monotone" dataKey="pessimistic" name="Pessimistic" stroke={colors.baseline}
                    strokeWidth={1} strokeDasharray="2 3" dot={false} opacity={0.5} legendType="none" />
                  {/* Paper-trail: previous model's series (faded dashed, from switchover onwards) */}
                  {previousForecast && (
                    <Line
                      yAxisId="primary"
                      type="monotone"
                      dataKey="prevBaseline"
                      name={`${previousForecast.modelUsed} (prev)`}
                      stroke={colors.baseline}
                      strokeWidth={1.5}
                      strokeDasharray="4 4"
                      dot={false}
                      opacity={0.35}
                      connectNulls
                      legendType="none"
                    />
                  )}
                  {/* Main series */}
                  <Line yAxisId="primary" type="monotone" dataKey="baseline" name="Baseline" stroke={colors.baseline}
                    strokeWidth={2} strokeDasharray="5 5" dot={false} connectNulls />
                  {usingAdjusted && (
                    <Line yAxisId="primary" type="monotone" dataKey="adjusted" name="Adjusted" stroke={colors.adjusted}
                      strokeWidth={2} dot={false} connectNulls />
                  )}
                  {/* Actual line — dots coloured green if above baseline, red if below */}
                  <Line
                    yAxisId="primary"
                    type="monotone"
                    dataKey="actual"
                    name="Actual"
                    stroke={colors.actual}
                    strokeWidth={2.5}
                    dot={(props: any) => {
                      const { cx, cy, payload } = props;
                      if (payload.actual == null) return <g key={props.key} />;
                      const above = payload.baseline == null || payload.actual >= payload.baseline;
                      return (
                        <circle
                          key={props.key}
                          cx={cx} cy={cy} r={3.5}
                          fill={above ? '#10b981' : '#ef4444'}
                          stroke="white" strokeWidth={1}
                        />
                      );
                    }}
                    activeDot={{ r: 5 }}
                    connectNulls={false}
                  />
                  <Brush dataKey="month" height={28} stroke="#e2e8f0" tickFormatter={() => ''} />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Variance table for selected KPI */}
          <div className="border-t border-slate-100">
            <div className="px-6 py-3 bg-slate-50/50 flex items-center justify-between">
              <h4 className="text-sm font-semibold text-slate-700">
                {KPI_LABELS[selectedKpi]} — Monthly Variance
              </h4>
              <span className="text-xs text-slate-400">
                {monthsWithActuals} month{monthsWithActuals !== 1 ? 's' : ''} with actuals
              </span>
            </div>

            {monthsWithActuals === 0 ? (
              <div className="px-6 py-8 text-center text-slate-400 text-sm">
                No actuals found for the forecast period. Upload data containing the matching months to see the variance breakdown.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left">
                  <thead className="text-slate-500 bg-slate-50 border-b border-slate-200">
                    <tr>
                      <th className="px-4 py-2.5 font-medium">Month</th>
                      <th className="px-4 py-2.5 text-right font-medium">Actual</th>
                      <th className="px-4 py-2.5 text-right font-medium">Baseline</th>
                      {usingAdjusted && <th className="px-4 py-2.5 text-right font-medium">Adjusted</th>}
                      <th className="px-4 py-2.5 text-right font-medium">Variance</th>
                      <th className="px-4 py-2.5 text-right font-medium">Var %</th>
                      <th className="px-4 py-2.5 text-center font-medium">In Band</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {comparisonRows
                      .filter(r => r.actual !== null)
                      .map(row => {
                        const act = row.actual as Record<string, any>;
                        const bl = row.baseline as Record<string, any>;
                        const adj = row.adjusted as Record<string, any>;

                        const actualVal = getKpiVal(act, selectedKpi);
                        const baselineVal = getKpiVal(bl, selectedKpi) ?? 0;
                        const adjustedVal = getKpiVal(adj, selectedKpi) ?? 0;
                        const optVal: number | null = selectedKpi !== 'base' ? (bl[selectedKpi + 'Opt'] ?? null) : null;
                        const pessVal: number | null = selectedKpi !== 'base' ? (bl[selectedKpi + 'Pess'] ?? null) : null;

                        if (actualVal === null || actualVal === undefined) return null;

                        const variance = actualVal - baselineVal;
                        const varPct = baselineVal !== 0 ? (variance / Math.abs(baselineVal)) * 100 : 0;
                        const inBand = optVal !== null && pessVal !== null
                          ? actualVal <= Math.max(optVal, baselineVal) && actualVal >= Math.min(pessVal, baselineVal)
                          : null;

                        return (
                          <tr key={row.month} className="hover:bg-slate-50/50 transition-colors">
                            <td className="px-4 py-2.5 font-medium text-slate-900">{row.month}</td>
                            <td className="px-4 py-2.5 text-right text-slate-700 font-medium">
                              {formatNumber(actualVal)}
                            </td>
                            <td className="px-4 py-2.5 text-right text-slate-500">
                              {formatNumber(baselineVal)}
                            </td>
                            {usingAdjusted && (
                              <td className="px-4 py-2.5 text-right text-slate-500">
                                {formatNumber(adjustedVal)}
                              </td>
                            )}
                            <td className={`px-4 py-2.5 text-right font-medium ${variance >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                              {variance > 0 ? '+' : ''}{formatNumber(variance)}
                            </td>
                            <td className={`px-4 py-2.5 text-right font-medium ${Math.abs(varPct) < 5 ? 'text-emerald-600' : Math.abs(varPct) < 15 ? 'text-amber-600' : 'text-rose-600'}`}>
                              {varPct > 0 ? '+' : ''}{varPct.toFixed(1)}%
                            </td>
                            <td className="px-4 py-2.5 text-center">
                              {inBand === null
                                ? <span className="text-slate-300">—</span>
                                : inBand
                                  ? <span className="text-emerald-500">✓</span>
                                  : <span className="text-rose-400">✗</span>}
                            </td>
                          </tr>
                        );
                      })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        {/* ── Cohort accuracy table ── */}
        {cohortAccuracy.length > 0 && (
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">

            {/* Card header */}
            <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/50">
              <h3 className="text-sm font-semibold text-slate-700">Historical Accuracy by Cohort</h3>
              <p className="text-xs text-slate-400 mt-0.5">
                MAPE compared against the aggregate baseline — grouped by the selected dimensions
              </p>
            </div>

            {/* Dimension selector */}
            <CohortDimCheckboxes
              dims={cohortDims}
              onChange={setCohortDims}
              wiProductCol={wiProductCol}
              wiChannelCol={wiChannelCol}
              count={cohortAccuracy.length}
            />

            {/* Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead className="text-slate-500 bg-slate-50 border-b border-slate-200">
                  <tr>
                    <th className="px-5 py-3 font-medium">Cohort</th>
                    <th className="px-5 py-3 text-center font-medium">
                      <div className="relative inline-flex items-center gap-1 group/tip">
                        <span>Accuracy Score</span>
                        <Info size={11} className="text-slate-400 cursor-help" />
                        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-72 p-3 bg-slate-800 text-white text-[10px] rounded-lg opacity-0 group-hover/tip:opacity-100 pointer-events-none transition-opacity z-20 leading-relaxed shadow-xl">
                          <p className="font-semibold mb-1">How the score is calculated</p>
                          <p>Each month is scored 0–100 based on where the actual falls within the forecast cone:</p>
                          <ul className="mt-1 space-y-0.5 list-disc list-inside">
                            <li>Exactly at the mean forecast → 100</li>
                            <li>Between mean and optimistic → 100 down to 70</li>
                            <li>Between mean and pessimistic → 100 down to 50</li>
                            <li>Outside optimistic boundary → 70 down to 0</li>
                            <li>Outside pessimistic boundary → 50 down to 0</li>
                          </ul>
                          <p className="mt-1">Monthly scores are averaged across all months with actuals.</p>
                        </div>
                      </div>
                    </th>
                    <th className="px-5 py-3 text-center font-medium">Directional Bias</th>
                    <th className="px-5 py-3 text-center font-medium">Trend</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {cohortAccuracy.map(c => {
                    const isSelected = selectedForecastCohortKey === c.cohortKey;
                    return (
                      <tr
                        key={c.cohortKey}
                        onClick={() => {
                          const nowSelected = !isSelected;
                          setSelectedForecastCohortKey(nowSelected ? c.cohortKey : null);
                          if (nowSelected && onCohortFilterChange) {
                            onCohortFilterChange({ segment: c.seg, product: c.prod, channel: c.chan });
                          }
                        }}
                        className={`cursor-pointer transition-colors ${
                          isSelected
                            ? 'bg-indigo-50 ring-1 ring-inset ring-indigo-200'
                            : 'hover:bg-slate-50/50'
                        }`}
                      >
                        <td className={`px-5 py-3 font-medium ${isSelected ? 'text-indigo-900' : 'text-slate-800'}`}>
                          {c.label}
                        </td>
                        <td className="px-5 py-3 text-center">
                          <span className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-bold tabular-nums ${scoreBg(c.accuracyScore)}`}>
                            {scoreLabel(c.accuracyScore)}
                          </span>
                        </td>
                        <td className="px-5 py-3 text-center">
                          {c.bias === 'above'
                            ? <span className="inline-flex items-center gap-1 text-emerald-700 text-[11px] font-medium">↑ Tracking above forecast</span>
                            : c.bias === 'below'
                              ? <span className="inline-flex items-center gap-1 text-rose-600 text-[11px] font-medium">↓ Tracking below forecast</span>
                              : <span className="text-slate-300">—</span>
                          }
                        </td>
                        <td className="px-5 py-3 text-center">
                          {c.trend === 'improving'
                            ? <span className="inline-flex items-center gap-1 text-emerald-600 font-semibold text-[11px]">↑ Better</span>
                            : c.trend === 'worsening'
                              ? <span className="inline-flex items-center gap-1 text-rose-500 font-semibold text-[11px]">↓ Worse</span>
                              : c.trend === 'stable'
                                ? <span className="inline-flex items-center gap-1 text-slate-400 text-[11px]">→ Stable</span>
                                : <span className="text-slate-400 text-[11px] italic">Insufficient data</span>
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
      </div>
      )}

      {/* ══ VIEW 2: AutoML Challenger Analysis ══ */}
      {activeSubView === 'challenger' && (
      <div className="h-full overflow-auto p-6">
      <div className="max-w-7xl mx-auto">

        {challengerGroups.length > 0 ? (
          /*
           * Fixed-height card: h-[640px] gives every child a concrete height to
           * work against. The card is flex-col so the header is shrink-0 and the
           * body grid gets flex-1 + min-h-0 (needed so flex children respect the
           * parent ceiling rather than growing to their intrinsic content size).
           *
           * Left column  — cohort list: overflow-y-auto on the list div only,
           *   so the header row stays pinned and only the buttons scroll.
           * Right column — detail: flex-col with banner + legend as shrink-0
           *   and the chart as flex-1 min-h-0. ResponsiveContainer height="100%"
           *   fills the remaining space, which is ~60% of the panel after the
           *   fixed-height elements above it.
           */
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 flex flex-col h-[692px] overflow-hidden">
            {/* ── Card header — fixed height ── */}
            <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/50 flex items-center gap-3 shrink-0">
              <div className="bg-indigo-100 p-2 rounded-lg shrink-0">
                <Cpu size={18} className="text-indigo-600" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-slate-900">AutoML Challenger Evaluation</h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Evaluating alternative models for cohorts with &gt;5% MAPE on the Inflow component
                </p>
              </div>
            </div>

            {/* ── Dimension selector — independent from Forecast vs Actuals tab ── */}
            <CohortDimCheckboxes
              dims={challengerDims}
              onChange={setChallengerDims}
              wiProductCol={wiProductCol}
              wiChannelCol={wiChannelCol}
              count={challengerGroups.length}
              countLabel="cohort to review"
            />

            {/* ── Body — fills remaining height ── */}
            <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-12 overflow-hidden">

              {/* Left panel — cohort list with filter bar (independent scroll) */}
              <div className="lg:col-span-4 border-r border-slate-100 bg-slate-50/30 flex flex-col overflow-hidden">

                {/* Pinned sub-header */}
                <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between bg-white shrink-0">
                  <span className="text-xs font-semibold text-slate-700">Cohorts to Review</span>
                  <span className="bg-slate-100 text-slate-600 text-[11px] font-bold px-2 py-0.5 rounded-full">
                    {challengerGroups.length}
                  </span>
                </div>

                {/* ── Filter bar ── */}
                <div className="px-3 pt-2.5 pb-2 border-b border-slate-100 bg-white shrink-0 space-y-1.5">

                  {/* Text search */}
                  <div className="relative">
                    <Search size={11} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                    <input
                      type="text"
                      placeholder="Search cohorts…"
                      value={challengerSearch}
                      onChange={e => setChallengerSearch(e.target.value)}
                      className="w-full pl-7 pr-6 py-1.5 text-xs border border-slate-200 rounded-lg bg-slate-50 outline-none focus:ring-1 focus:ring-indigo-300 focus:border-indigo-300 focus:bg-white placeholder:text-slate-400"
                    />
                    {challengerSearch && (
                      <button
                        onClick={() => setChallengerSearch('')}
                        className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                      >
                        <X size={10} />
                      </button>
                    )}
                  </div>

                  {/* Status + model dropdowns */}
                  <div className="flex gap-1.5">
                    <select
                      value={challengerStatus}
                      onChange={e => setChallengerStatus(e.target.value as typeof challengerStatus)}
                      className="flex-1 min-w-0 text-[11px] border border-slate-200 rounded-lg px-2 py-1.5 bg-slate-50 outline-none focus:ring-1 focus:ring-indigo-300 focus:border-indigo-300 text-slate-700 cursor-pointer"
                    >
                      <option value="all">All statuses</option>
                      <option value="action_required">Action Required</option>
                      <option value="best_applied">Best Model Applied</option>
                    </select>
                    <select
                      value={challengerModelFilter}
                      onChange={e => setChallengerModelFilter(e.target.value as typeof challengerModelFilter)}
                      className="flex-1 min-w-0 text-[11px] border border-slate-200 rounded-lg px-2 py-1.5 bg-slate-50 outline-none focus:ring-1 focus:ring-indigo-300 focus:border-indigo-300 text-slate-700 cursor-pointer"
                    >
                      <option value="All">All models</option>
                      <option value="Holt Linear">Holt Linear</option>
                      <option value="Damped Trend">Damped Trend</option>
                      <option value="Holt-Winters">Holt-Winters</option>
                    </select>
                  </div>

                  {/* Results count */}
                  <p className="text-[10px] text-slate-400 leading-none pt-0.5">
                    Showing{' '}
                    <span className={filteredChallengerGroups.length < challengerGroups.length ? 'text-indigo-600 font-semibold' : ''}>
                      {filteredChallengerGroups.length}
                    </span>
                    {' '}of {challengerGroups.length} cohort{challengerGroups.length !== 1 ? 's' : ''}
                  </p>
                </div>

                {/* Scrollable list — grows to fill remaining height, scrolls independently */}
                {filteredChallengerGroups.length > 0 ? (
                  <div className="overflow-y-auto flex-1 p-3 space-y-2">
                    {filteredChallengerGroups.map(g => {
                      const isAccepted = acceptedCohortKeys.has(g.key);
                      return (
                        <button
                          key={g.key}
                          onClick={() => setSelectedCohortKey(g.key)}
                          className={`w-full text-left p-3 rounded-xl transition-all flex items-center justify-between
                            ${selectedChallengerGroup?.key === g.key
                              ? 'bg-white shadow-sm border border-indigo-200 ring-1 ring-indigo-50'
                              : 'hover:bg-white border border-transparent hover:border-slate-200'}`}
                        >
                          <div className="flex-1 min-w-0 pr-2">
                            <p className="text-sm font-semibold text-slate-700 truncate">{g.seg}</p>
                            <p className="text-xs text-slate-500">{g.prod}</p>
                            {isAccepted ? (
                              <span
                                className="inline-flex items-center gap-1 text-[10px] font-medium text-amber-700 mt-0.5"
                                title="The most appropriate model has been selected for this cohort, but forecast accuracy remains below the target threshold. Manual review of the underlying assumptions may be required."
                              >
                                <Info size={10} className="shrink-0" />
                                Best model applied — still outside threshold
                              </span>
                            ) : (
                              <p className="text-[10px] text-indigo-600 font-medium mt-0.5">
                                Best: {g.bestModel.name}
                              </p>
                            )}
                          </div>
                          <div className="flex items-center gap-1 shrink-0">
                            <span className={`text-sm font-bold ${isAccepted ? 'text-amber-600' : g.avgMape > 15 ? 'text-rose-600' : 'text-amber-600'}`}>
                              {g.avgMape.toFixed(1)}%
                            </span>
                            <ChevronRight size={14} className="text-slate-300" />
                          </div>
                        </button>
                      );
                    })}
                  </div>
                ) : (
                  /* Empty state — no cohorts match active filters */
                  <div className="flex-1 flex flex-col items-center justify-center text-center px-5 py-8 text-slate-400">
                    <Search size={20} className="mb-2 opacity-30" />
                    <p className="text-xs font-medium text-slate-500 mb-1">No cohorts match</p>
                    <p className="text-[10px] text-slate-400 leading-snug mb-3">
                      Try adjusting the search term or filters above.
                    </p>
                    <button
                      onClick={() => {
                        setChallengerSearch('');
                        setChallengerStatus('all');
                        setChallengerModelFilter('All');
                      }}
                      className="text-[11px] font-medium text-indigo-600 hover:text-indigo-700 transition-colors"
                    >
                      Clear all filters
                    </button>
                  </div>
                )}
              </div>

              {/* Right panel — recommendation + chart */}
              <div className="lg:col-span-8 flex flex-col overflow-hidden bg-white">
                {selectedChallengerGroup ? (
                  <>
                    {/* Recommendation banner — fixed height */}
                    <div className="shrink-0 px-6 pt-5 pb-0">
                      {(() => {
                        const alreadyBest = selectedChallengerGroup.bestModel.name === selectedChallengerGroup.chosenModel;
                        const alreadyAccepted = acceptedCohortKeys.has(selectedChallengerGroup.key);
                        const bannerAmber = alreadyAccepted;
                        return (
                          <div className={`border rounded-xl p-4 flex items-start justify-between gap-4 ${
                            bannerAmber
                              ? 'bg-amber-50 border-amber-200'
                              : 'bg-emerald-50 border-emerald-200'
                          }`}>
                            <div>
                              <div className="flex items-center gap-2 mb-1">
                                {bannerAmber
                                  ? <Info className="text-amber-600" size={16} />
                                  : <CheckCircle2 className="text-emerald-600" size={16} />}
                                <h4 className={`font-semibold text-sm ${bannerAmber ? 'text-amber-900' : 'text-emerald-900'}`}>
                                  {bannerAmber
                                    ? 'Best model applied — still outside threshold'
                                    : `Recommendation: ${selectedChallengerGroup.bestModel.name}`}
                                </h4>
                              </div>
                              <p className={`text-xs leading-relaxed ${bannerAmber ? 'text-amber-700' : 'text-emerald-700'}`}>
                                {bannerAmber
                                  ? <>
                                      <strong>{selectedChallengerGroup.bestModel.name}</strong> was applied from{' '}
                                      {modelSwitchPoint?.month ?? 'this period'} forward. Forecast error is{' '}
                                      <strong>{selectedChallengerGroup.avgMape.toFixed(1)}%</strong>, which is still above the 5% threshold.
                                      Review the underlying assumptions for this cohort.
                                    </>
                                  : alreadyBest
                                    ? 'Your chosen model is already the best performer for this cohort.'
                                    : <>
                                        Switching from {selectedChallengerGroup.chosenModel} reduces forecast error from{' '}
                                        <strong className="text-rose-600">
                                          {selectedChallengerGroup.models.find(m => m.name === selectedChallengerGroup.chosenModel)?.error.toFixed(1)}%
                                        </strong>{' '}
                                        to{' '}
                                        <strong className="text-emerald-700">
                                          {selectedChallengerGroup.bestModel.error.toFixed(1)}%
                                        </strong>{' '}
                                        for {selectedChallengerGroup.seg} · {selectedChallengerGroup.prod}
                                      </>
                                }
                              </p>
                            </div>
                            {!alreadyBest && !alreadyAccepted && (
                              <div className="flex items-center gap-2 shrink-0">
                                <button
                                  onClick={handleAcceptModel}
                                  className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap"
                                >
                                  Accept
                                </button>
                                {acceptAllCandidates.length > 1 && (
                                  <button
                                    onClick={() => setShowAcceptAllModal(true)}
                                    className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap"
                                  >
                                    Accept All ({acceptAllCandidates.length})
                                  </button>
                                )}
                              </div>
                            )}
                            {alreadyBest && !alreadyAccepted && (
                              <span className="text-xs text-emerald-700 font-medium bg-emerald-100 px-3 py-2 rounded-lg whitespace-nowrap shrink-0">
                                Already optimal
                              </span>
                            )}
                            {alreadyAccepted && (
                              <span className="text-xs text-amber-700 font-medium bg-amber-100 px-3 py-2 rounded-lg whitespace-nowrap shrink-0 flex items-center gap-1">
                                <CheckCircle2 size={12} /> Model applied
                              </span>
                            )}
                          </div>
                        );
                      })()}
                    </div>

                    {/* Model error legend — fixed height */}
                    <div className="shrink-0 flex flex-wrap gap-4 text-xs text-slate-600 px-6 py-3">
                      {selectedChallengerGroup.models.map(m => (
                        <span key={m.name} className="flex items-center gap-1.5">
                          <span className="inline-block w-3 h-3 rounded-full" style={{ backgroundColor: m.color }} />
                          {m.name} ({m.error.toFixed(1)}% err)
                          {m.name === selectedChallengerGroup.chosenModel && (
                            <span className="text-[9px] font-bold bg-slate-200 text-slate-600 px-1 py-0.5 rounded uppercase tracking-wide">chosen</span>
                          )}
                        </span>
                      ))}
                    </div>

                    {/* Chart — flex-1 min-h-0 fills the remaining ~60%+ of the panel */}
                    <div className="flex-1 min-h-0 px-6 pb-5">
                      <ResponsiveContainer width="100%" height="100%">
                        <ComposedChart
                          data={selectedChallengerGroup.chartData}
                          margin={{ top: 5, right: 20, left: 0, bottom: 30 }}
                        >
                          <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                          <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} />
                          <YAxis tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} tickFormatter={formatNumber} width={65} />
                          <Tooltip
                            contentStyle={{ borderRadius: '10px', border: '1px solid #e2e8f0' }}
                            formatter={(v: any, n: string) => [v != null ? formatNumber(v) : '—', n]}
                          />
                          <Line type="monotone" dataKey="Actual" stroke="#0f172a" strokeWidth={2.5}
                            dot={{ r: 3 }} activeDot={{ r: 5 }} connectNulls={false} />
                          {selectedChallengerGroup.models.map(m => (
                            <Line
                              key={m.name}
                              type="monotone"
                              dataKey={m.name}
                              stroke={m.color}
                              strokeWidth={m.name === selectedChallengerGroup.bestModel.name ? 2.5 : m.name === selectedChallengerGroup.chosenModel ? 2 : 1.5}
                              strokeDasharray={m.strokeDasharray}
                              dot={false}
                            />
                          ))}
                          <Brush dataKey="month" height={24} stroke="#e2e8f0" tickFormatter={() => ''} />
                        </ComposedChart>
                      </ResponsiveContainer>
                    </div>
                  </>
                ) : (
                  <div className="flex-1 flex items-center justify-center text-slate-400 text-sm">
                    Select a cohort to view the model comparison
                  </div>
                )}
              </div>
            </div>
          </div>
        ) : (
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-10 flex flex-col items-center text-center">
            <div className="bg-emerald-50 p-4 rounded-full mb-3">
              <CheckCircle2 className="text-emerald-500" size={32} />
            </div>
            <h4 className="text-base font-semibold text-slate-800 mb-1">All Models Performing Well</h4>
            <p className="text-sm text-slate-500 max-w-md">
              No cohorts missed their forecast by more than 5% MAPE.
              {baseForecast?.modelUsed ?? 'Holt Linear'} is performing well for all segments.
            </p>
          </div>
        )}

      </div>
      </div>
      )}

      </div>

      {/* ── Accept All confirmation modal ── */}
      {showAcceptAllModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setShowAcceptAllModal(false)} />
          <div className="relative w-full max-w-lg mx-4 bg-white rounded-2xl shadow-2xl overflow-hidden">
            {/* Header */}
            <div className="px-6 pt-6 pb-4 flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center shrink-0">
                  <Cpu size={20} className="text-indigo-600" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-slate-900">Accept All Proposed Models?</h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {acceptAllCandidates.length} cohort{acceptAllCandidates.length !== 1 ? 's' : ''} will be re-forecast with their recommended model
                  </p>
                </div>
              </div>
              <button onClick={() => setShowAcceptAllModal(false)} className="text-slate-400 hover:text-slate-600 transition-colors p-1">
                <ArrowRight size={18} className="rotate-180" />
              </button>
            </div>

            {/* Cohort list */}
            <div className="mx-6 mb-5 border border-slate-100 rounded-xl overflow-hidden">
              <div className="px-4 py-2.5 bg-slate-50 border-b border-slate-100">
                <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide">
                  Cohorts to be updated
                </p>
              </div>
              <div className="divide-y divide-slate-50 max-h-64 overflow-y-auto">
                {acceptAllCandidates.map(g => (
                  <div key={g.key} className="flex items-center justify-between px-4 py-2.5 text-xs">
                    <div>
                      <p className="font-semibold text-slate-800">{g.seg}</p>
                      {g.prod && <p className="text-slate-500">{g.prod}</p>}
                    </div>
                    <div className="flex items-center gap-2 text-slate-500 shrink-0">
                      <span className="bg-slate-100 text-slate-600 px-2 py-0.5 rounded font-medium">{g.chosenModel}</span>
                      <ArrowRight size={12} className="text-slate-400" />
                      <span className="bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded font-semibold">{g.bestModel.name}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center justify-end gap-3 px-6 py-4 bg-slate-50 border-t border-slate-100">
              <button
                onClick={() => setShowAcceptAllModal(false)}
                className="px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-800 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleAcceptAll}
                className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-semibold transition-colors flex items-center gap-2"
              >
                <Cpu size={14} />
                Apply {acceptAllCandidates.length} Model{acceptAllCandidates.length !== 1 ? 's' : ''}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

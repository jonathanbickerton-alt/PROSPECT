import React, { useMemo, useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Download, CheckCircle2, ChevronRight, Cpu, AlertTriangle, ArrowRight, Info, FilePlus,
  Search, X, Trash2, HelpCircle
} from 'lucide-react';
import { RemoveActualsModal } from './RemoveActualsModal';
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
import { rowInScope, cohortInScope, dimsFromGrouping, ALL_DIMS, L1_ONLY } from '../utils/cohortScope';

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
  /** Column name for Product L2 — optional, used for L2-aware filtering */
  wiProductL2Col?: string;
  wiChannelCol: string;
  /** Column name for Channel L2 — optional, used for L2-aware filtering */
  wiChannelL2Col?: string;
  /** Column name for Tariff L1 — optional (Phase 2a) */
  wiTariffL1Col?: string;
  /** Column name for Tariff L2 — optional (Phase 2a) */
  wiTariffL2Col?: string;
  formatNumber: (v: any) => string;
  setActiveView: (v: string) => void;
  onAcceptChallengerModel: (model: ForecastModel, switchoverMonth: string | null) => void;
  onAcceptAllChallengerModels: (groups: Array<{ key: string; model: ForecastModel }>, switchoverMonth: string | null) => void;
  /** Run the real forecast for a cohort with a challenger model — returns result without saving */
  onRunChallengerForecast: (cohort: import('../types/forecast').CohortKey, model: ForecastModel) => import('../types/forecast').BaseForecast | null;
  /** Save a pre-computed preview forecast (accept path after running) */
  onAcceptPreviewForecast: (bf: import('../types/forecast').BaseForecast, switchoverMonth: string | null) => void;
  handleImportActualsFile: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onRemoveActuals: (keepFn: (row: any) => boolean, removedCount: number) => void;
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

type VolumeScenario = 'inflow' | 'outflow' | 'retention' | 'base';
type ArpuScenario = 'inflowArpu' | 'outflowArpu' | 'retentionArpu' | 'baseArpu';

const VOLUME_COLORS: Record<VolumeScenario, { actual: string; baseline: string; band: string }> = {
  inflow:    { actual: '#1e3a5f', baseline: '#3b82f6', band: '#dbeafe' },
  outflow:   { actual: '#7c2d12', baseline: '#f59e0b', band: '#fef3c7' },
  retention: { actual: '#831843', baseline: '#ec4899', band: '#fce7f3' },
  base:      { actual: '#064e3b', baseline: '#10b981', band: '#d1fae5' },
};

const ARPU_SCENARIO_COLORS: Record<ArpuScenario, { actual: string; baseline: string; band: string }> = {
  inflowArpu:    { actual: '#1e3a5f', baseline: '#3b82f6', band: '#dbeafe' },
  outflowArpu:   { actual: '#7c2d12', baseline: '#f59e0b', band: '#fef3c7' },
  retentionArpu: { actual: '#831843', baseline: '#ec4899', band: '#fce7f3' },
  baseArpu:      { actual: '#064e3b', baseline: '#10b981', band: '#d1fae5' },
};

const SCENARIO_LABELS: Record<VolumeScenario | ArpuScenario, string> = {
  inflow: 'Inflow', outflow: 'Outflow', retention: 'Retention', base: 'Base',
  inflowArpu: 'Inflow ARPU', outflowArpu: 'Outflow ARPU', retentionArpu: 'Retention ARPU', baseArpu: 'Base ARPU',
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
/**
 * Score one month's actual against its forecast.
 *
 * Primary score — proximity to mean (symmetric, deviation-based):
 *   0–1 %   dev  →  95–100
 *   1–3 %   dev  →  85–95
 *   3–5 %   dev  →  75–85
 *   5–10%   dev  →  60–75
 *   10–20%  dev  →  40–60
 *   >20%    dev  →  40 → 0 (linear, capped at 0)
 *
 * Secondary adjustment — band position:
 *   Within band                              → no adjustment
 *   Outside band, primary score ≥ 65        → –5
 *   Outside band, primary score < 65        → –10
 */
function scoreMonth(actual: number, mean: number, optimistic: number, pessimistic: number): number {
  if (mean === 0) return 0;

  // Primary: deviation from mean
  const dev = Math.abs(actual - mean) / Math.abs(mean) * 100;
  let primary: number;
  if      (dev <=  1) primary = 100 - 5  * dev;                              // 100 → 95
  else if (dev <=  3) primary =  95 - 5  * (dev -  1) / 2;                  //  95 → 85
  else if (dev <=  5) primary =  85 - 5  * (dev -  3) / 2;                  //  85 → 75
  else if (dev <= 10) primary =  75 - 15 * (dev -  5) / 5;                  //  75 → 60
  else if (dev <= 20) primary =  60 - 20 * (dev - 10) / 10;                 //  60 → 40
  else                primary = Math.max(0, 40 - 40 * (dev - 20) / 20);     //  40 →  0

  // Secondary: band-position penalty
  const withinBand = actual >= pessimistic && actual <= optimistic;
  if (withinBand) return primary;
  const penalty = primary >= 65 ? 5 : 10;
  return Math.max(0, primary - penalty);
}

function scoreLabel(score: number | null): string {
  if (score === null) return '—';
  return score.toFixed(0);
}

function scoreBg(score: number | null): string {
  if (score === null) return 'bg-slate-100 text-slate-400';
  if (score >= 80) return 'bg-emerald-100 text-emerald-800';
  if (score >= 65) return 'bg-amber-100 text-amber-800';
  if (score >= 40) return 'bg-orange-100 text-orange-800';
  return 'bg-rose-100 text-rose-800';
}

function getKpiVal(obj: Record<string, any> | null | undefined, kpi: KpiKey): number | null {
  if (!obj) return null;
  return (obj[kpi] as number) ?? null;
}

// ---------------------------------------------------------------------------
// computeForecastMape — pure MAPE calculation for one BaseForecast vs actuals
//
// Self-contained: filters data to the forecast's cohort scope, builds a monthly
// actuals aggregate, derives base stock via the same lagged formula used in
// comparisonRows, then computes per-metric MAPE.
// Called once per matching forecast in the summaryMape useMemo.
// ---------------------------------------------------------------------------
export function computeForecastMape(
  bf: import('../types/forecast').BaseForecast,
  data: any[],
  wiDateCol: string,
  wiMetricCol: string,
  wiValueCol: string,
  wiInflowVal: string,
  wiOutflowVal: string,
  wiRetentionVal: string,
  wiBaseVal: string,
  wiArpuCol: string,
  wiRevenueCol: string,
  wiSegmentCol: string,
  wiProductCol: string,
  wiChannelCol: string,
  /** Optional: when provided, replaces the baseline mean per month for MAPE calculation */
  adjustedMeans?: Map<string, { inflow: number; outflow: number; retention: number; arpu: number }>,
  wiProductL2Col = '',
  wiChannelL2Col = '',
  wiTariffL1Col = '',
  wiTariffL2Col = '',
): {
  inflow: number | null; outflow: number | null; retention: number | null; base: number | null; arpu: number | null;
  inflowArpu: number | null; outflowArpu: number | null; retentionArpu: number | null; baseArpu: number | null;
  monthsWithActuals: number;
} {
  const cohort = bf.cohort;

  // Scope data to this forecast's cohort (including L2 when present on the cohort)
  // Shared predicate, all seven dimensions. The tariff clauses this replaces
  // are the +97.7% fix: without them the actuals were aggregated tariff-blind
  // while bf.cohort is tariff-scoped, so the MAPE cards read ~97.7% for a tariff
  // cohort while the variance table below them read ~2% on the same render.
  // Guarded by npm run traps (trap A), not by this comment.
  const filteredData = data.filter(row => rowInScope(row, {
    segment: wiSegmentCol, product: wiProductCol, productL2: wiProductL2Col,
    channel: wiChannelCol, channelL2: wiChannelL2Col,
    tariffL1: wiTariffL1Col, tariffL2: wiTariffL2Col,
  }, cohort, ALL_DIMS));

  // Build monthly actuals aggregate — per-scenario revenue + subs for all 4 IBRO types
  type Bucket = {
    inflow: number; outflow: number; retention: number;
    base: number | null;
    arpuSubVol: number; revSum: number;
    inflowRev: number; inflowSubVol: number;
    outflowRev: number; outflowSubVol: number;
    retentionRev: number; retentionSubVol: number;
    baseRev: number; baseSubVol: number;
  };
  const aggrMap = new Map<string, Bucket>();
  filteredData.forEach(row => {
    const rawDate = row[wiDateCol];
    if (!rawDate) return;
    const d = rawDate instanceof Date ? rawDate : new Date(rawDate);
    if (!isValid(d)) return;
    const month = format(d, 'yyyy-MM');
    if (!aggrMap.has(month)) {
      aggrMap.set(month, {
        inflow: 0, outflow: 0, retention: 0, base: null,
        arpuSubVol: 0, revSum: 0,
        inflowRev: 0, inflowSubVol: 0,
        outflowRev: 0, outflowSubVol: 0,
        retentionRev: 0, retentionSubVol: 0,
        baseRev: 0, baseSubVol: 0,
      });
    }
    const e = aggrMap.get(month)!;
    const metric = wiMetricCol ? String(row[wiMetricCol]) : '';
    const val = Number(row[wiValueCol]) || 0;
    const rev  = wiRevenueCol ? (Number(row[wiRevenueCol]) || 0) : 0;
    const arpu = wiArpuCol   ? (Number(row[wiArpuCol])    || 0) : 0;
    const revVal = rev || (arpu * val);

    if (wiInflowVal && metric === wiInflowVal) {
      e.inflow += val;
      e.inflowSubVol += val; e.inflowRev += revVal;
      e.arpuSubVol += val; e.revSum += revVal;
    } else if (wiOutflowVal && metric === wiOutflowVal) {
      e.outflow += val;
      e.outflowSubVol += val; e.outflowRev += revVal;
      e.arpuSubVol += val; e.revSum += revVal;
    } else if (wiRetentionVal && metric === wiRetentionVal) {
      e.retention += val;
      e.retentionSubVol += val; e.retentionRev += revVal;
      e.arpuSubVol += val; e.revSum += revVal;
    } else if (wiBaseVal && metric === wiBaseVal) {
      e.base = (e.base ?? 0) + val;
      e.baseSubVol += val; e.baseRev += revVal;
      e.arpuSubVol += val; e.revSum += revVal;
    }
  });

  // Build per-month comparison rows — base is read directly from actuals, never derived.
  let bBase = bf.seedBaseVolume;
  let prevBlInflow = bf.lastHistoricalInflow;
  let prevBlOutflow = bf.lastHistoricalOutflow;

  const rows: Array<{
    baseline: {
      inflow: number; outflow: number; retention: number; arpu: number; base: number;
      inflowArpu: number | null; outflowArpu: number | null; retentionArpu: number | null; baseArpu: number | null;
    };
    actual: {
      inflow: number; outflow: number; retention: number;
      arpu: number | null; base: number | null;
      inflowArpu: number | null; outflowArpu: number | null; retentionArpu: number | null; baseArpu: number | null;
    } | null;
  }> = [];

  for (const bm of bf.months) {
    bBase = Math.max(0, bBase + prevBlInflow - prevBlOutflow);
    const act = aggrMap.get(bm.month) ?? null;

    prevBlInflow = bm.inflow.mean;
    prevBlOutflow = bm.outflow.mean;

    const actArpu = act
      ? (act.arpuSubVol > 0 && act.revSum > 0 ? act.revSum / act.arpuSubVol : null)
      : null;

    const adj = adjustedMeans?.get(bm.month);
    rows.push({
      baseline: {
        inflow:    adj ? adj.inflow    : bm.inflow.mean,
        outflow:   adj ? adj.outflow   : bm.outflow.mean,
        retention: adj ? adj.retention : bm.retention.mean,
        arpu:      adj ? adj.arpu      : bm.arpu.mean,
        base: bBase,
        inflowArpu:    bm.inflowArpu?.mean ?? null,
        outflowArpu:   bm.outflowArpu?.mean ?? null,
        retentionArpu: bm.retentionArpu?.mean ?? null,
        baseArpu:      bm.baseArpu?.mean ?? null,
      },
      actual: act ? {
        inflow: act.inflow, outflow: act.outflow, retention: act.retention, arpu: actArpu, base: act.base,
        inflowArpu:    act.inflowSubVol > 0 && act.inflowRev > 0 ? act.inflowRev / act.inflowSubVol : null,
        outflowArpu:   act.outflowSubVol > 0 && act.outflowRev > 0 ? act.outflowRev / act.outflowSubVol : null,
        retentionArpu: act.retentionSubVol > 0 && act.retentionRev > 0 ? act.retentionRev / act.retentionSubVol : null,
        baseArpu:      act.baseSubVol > 0 && act.baseRev > 0 ? act.baseRev / act.baseSubVol : null,
      } : null,
    });
  }

  const withActuals = rows.filter(r => r.actual !== null);

  const calcMapeField = (field: string): number | null => {
    const pairs = withActuals.map(r => {
      const a = (r.actual as any)[field] as number | null;
      const f = (r.baseline as any)[field] as number | null;
      if (a === null || a === 0 || f === null) return null;
      return { a, f };
    }).filter(Boolean) as { a: number; f: number }[];
    if (!pairs.length) return null;
    return (pairs.reduce((s, { a, f }) => s + Math.abs(a - f) / Math.abs(a), 0) / pairs.length) * 100;
  };

  const calcMape = (kpi: KpiKey): number | null => calcMapeField(kpi);

  return {
    inflow:    calcMape('inflow'),
    outflow:   calcMape('outflow'),
    retention: calcMape('retention'),
    base:      calcMape('base'),
    arpu:      calcMape('arpu'),
    inflowArpu:    calcMapeField('inflowArpu'),
    outflowArpu:   calcMapeField('outflowArpu'),
    retentionArpu: calcMapeField('retentionArpu'),
    baseArpu:      calcMapeField('baseArpu'),
    monthsWithActuals: withActuals.length,
  };
}

// ---------------------------------------------------------------------------
// Scope-matching helpers — keep baseline and actuals at the same cohort scope
// ---------------------------------------------------------------------------

/** True if 7-part scope `a` strictly contains scope `b` (i.e. `a` is broader).
 *  Positions: seg|prod|prodL2|chan|chanL2|tariffL1|tariffL2. Missing positions
 *  (old 5-part keys) read as undefined and compare equal, so this stays correct
 *  for tariff-free data while preventing a tariff=All parent from double-counting
 *  against tariff-specific children. */
function scopeContains(a: string[], b: string[]): boolean {
  let broader = false;
  for (let i = 0; i < 7; i++) {
    const av = a[i] ?? 'All';
    const bv = b[i] ?? 'All';
    if (av === bv) continue;
    if (av === 'All') { broader = true; continue; }
    return false;
  }
  return broader;
}

/**
 * Drop forecasts whose scope is contained within another matched forecast's
 * scope, keeping only the broadest entries. Prevents double-counting when the
 * store holds both a parent (e.g. Consumer|All|All|All|All) and its children
 * (Consumer|Mobile|…) and both match the active filter.
 */
function dedupeContainedForecasts(
  entries: { key: string; bf: BaseForecast }[],
): BaseForecast[] {
  const parts = entries.map(e => e.key.split('|'));
  return entries
    .filter((_, i) => !parts.some((p, j) => j !== i && scopeContains(p, parts[i])))
    .map(e => e.bf);
}

/**
 * True if the loaded forecast's cohort scope EQUALS the filter bar scope exactly.
 *
 * NOT converted to cohortInScope, deliberately. This asks a third question:
 * equality, where 'All' is a real value on both sides. cohortInScope treats
 * 'All' on the scope side as a WILDCARD, so a RED S cohort would match a
 * cleared tariff filter -- true under scoping, false under equality, and both
 * call sites here want equality ("is the loaded forecast exactly what the
 * filter bar is showing?").
 *
 * Equality, scoping and containment (scopeContains) are three distinct
 * questions. Collapsing them is how the original sprawl started.
 */
function cohortMatchesFilter(cohort: BaseForecast['cohort'], filter: ViewFilter): boolean {
  return cohort.segment === (filter.segment || 'All')
    && cohort.product === (filter.product.l1 ?? 'All')
    && (cohort.productL2 ?? 'All') === (filter.product.l2 ?? 'All')
    && cohort.channel === (filter.channel.l1 ?? 'All')
    && (cohort.channelL2 ?? 'All') === (filter.channel.l2 ?? 'All')
    && (cohort.tariffL1 ?? 'All') === (filter.tariff?.l1 ?? 'All')
    && (cohort.tariffL2 ?? 'All') === (filter.tariff?.l2 ?? 'All');
}

// ---------------------------------------------------------------------------
// Shared types for cohort accuracy rows
// ---------------------------------------------------------------------------
type CohortMonthEntry = {
  inflow: number; outflow: number; retention: number; base: number | null;
  arpu: number;           // blended (all 4 scenarios)
  arpuRevSum: number;     // total revenue all scenarios
  arpuSubVol: number;     // total subs all scenarios
  // Per-scenario ARPU (finalised after accumulation)
  inflowArpu: number; outflowArpu: number; retentionArpu: number; baseArpu: number;
  // Per-scenario accumulators
  inflowRev: number; inflowSubVol: number;
  outflowRev: number; outflowSubVol: number;
  retentionRev: number; retentionSubVol: number;
  baseRev: number; baseSubVol: number;
};

/** Aggregate totals per month extracted from actualsAggrMap for proportional scaling. */
type AggrSnapshot = { inflow: number; outflow: number; retention: number };

type BiasVal  = 'above' | 'below' | null;
type TrendVal = 'improving' | 'worsening' | 'stable' | 'insufficient' | null;

/** Per-month breakdown collected during scoring — powers the tooltip. */
type MonthScoreDetail = {
  month: string;
  actual: number;
  mean: number;
  dev: number;        // signed %, actual vs mean
  inBand: boolean;
  primary: number;
  penalty: number;    // 0, 5, or 10
  score: number;
};

type ComponentDetail = {
  label: string;
  rows: MonthScoreDetail[];
  avgDev: number;     // mean absolute dev %
  score: number | null;
};

type CohortAccuracyRow = {
  cohortKey: string;
  seg: string; prod: string; prodL2: string; chan: string; chanL2: string; tariffL1: string; tariffL2: string;
  label: string;
  // Kept for AutoML Challenger threshold filter (avgMape > 5%)
  inflowMape: number | null;
  outflowMape: number | null;
  retentionMape: number | null;
  avgMape: number | null;
  // Per-component cone-based scores (0–100, null = no data)
  inflowScore:       number | null;
  outflowScore:      number | null;
  retentionScore:    number | null;
  baseScore:         number | null;
  // Per-scenario ARPU scores (replaces single blended arpu score)
  inflowArpuScore:    number | null;
  outflowArpuScore:   number | null;
  retentionArpuScore: number | null;
  baseArpuScore:      number | null;
  overallScore:   number | null;   // simple average of non-null component scores
  // Per-component directional bias
  inflowBias:    BiasVal;
  outflowBias:   BiasVal;
  retentionBias: BiasVal;
  baseBias:      BiasVal;
  inflowArpuBias:    BiasVal;
  outflowArpuBias:   BiasVal;
  retentionArpuBias: BiasVal;
  baseArpuBias:      BiasVal;
  // Per-component trend
  inflowTrend:    TrendVal;
  outflowTrend:   TrendVal;
  retentionTrend: TrendVal;
  baseTrend:      TrendVal;
  inflowArpuTrend:    TrendVal;
  outflowArpuTrend:   TrendVal;
  retentionArpuTrend: TrendVal;
  baseArpuTrend:      TrendVal;
  // KPI with the lowest score — used to auto-switch the chart tab on row click
  worstKpi: KpiKey;
  monthMap: Map<string, CohortMonthEntry>;
  // Per-component detail for tooltip
  inflowDetail:    ComponentDetail | null;
  outflowDetail:   ComponentDetail | null;
  retentionDetail: ComponentDetail | null;
  baseDetail:      ComponentDetail | null;
  inflowArpuDetail:    ComponentDetail | null;
  outflowArpuDetail:   ComponentDetail | null;
  retentionArpuDetail: ComponentDetail | null;
  baseArpuDetail:      ComponentDetail | null;
  /** True when forecastStore held nothing covering this row, so there is no
   *  forecast to score against. Every score/bias/trend/detail above is null.
   *  Distinguishes "not yet forecast" from "forecast exists and scored badly" —
   *  both of which previously rendered as a number. See EXPECTED.md §16b. */
  noForecast?: boolean;
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
/**
 * When useAdjusted=true, the adjusted forecast mean (uplifted value) replaces
 * the baseline mean for deviation scoring. The band half-widths are preserved
 * from the baseline so the "in-band" check still reflects the original uncertainty.
 * Shape: month → { inflow, outflow, retention, arpu } (all adjusted means)
 */
type AdjustedMeanMap = Map<string, { inflow: number; outflow: number; retention: number; arpu: number }>;

function buildCohortAccuracy(
  cohortActualsMap: Map<string, Map<string, CohortMonthEntry>>,
  aggrMap: Map<string, AggrSnapshot>,
  baseForecast: import('../types/forecast').BaseForecast,
  dims: CohortDims,
  forecastStore: Map<string, import('../types/forecast').BaseForecast>,
  adjustedMeanMap?: AdjustedMeanMap,
): CohortAccuracyRow[] {
  const merged = new Map<string, Map<string, CohortMonthEntry>>();
  const firstDims = new Map<string, { seg: string; prod: string; prodL2: string; chan: string; chanL2: string; tariffL1: string; tariffL2: string }>();

  for (const [rawKey, rawMonthMap] of cohortActualsMap.entries()) {
    const parts = rawKey.split('|');
    // 7-part key: seg|prod|prodL2|chan|chanL2|tariffL1|tariffL2
    const seg    = parts[0] || '';
    const prod   = parts[1] || '';
    const prodL2 = parts[2] || 'All';
    const chan    = parts[3] || '';
    const chanL2  = parts[4] || 'All';
    const tariffL1 = parts[5] || 'All';
    const tariffL2 = parts[6] || 'All';

    const keyParts = [seg];
    if (dims.product)   keyParts.push(prod);
    if (dims.productL2) keyParts.push(prodL2);
    if (dims.channelL1) keyParts.push(chan);
    if (dims.channelL2) keyParts.push(chanL2);
    if (dims.tariffL1)  keyParts.push(tariffL1);
    if (dims.tariffL2)  keyParts.push(tariffL2);
    const activeKey = keyParts.join('|');

    if (!merged.has(activeKey)) {
      merged.set(activeKey, new Map());
      firstDims.set(activeKey, { seg, prod, prodL2, chan, chanL2, tariffL1, tariffL2 });
    }
    const mergedMonths = merged.get(activeKey)!;

    for (const [month, entry] of rawMonthMap.entries()) {
      if (!mergedMonths.has(month)) {
        mergedMonths.set(month, {
          inflow: 0, outflow: 0, retention: 0, base: null, arpu: 0, arpuRevSum: 0, arpuSubVol: 0,
          inflowArpu: 0, outflowArpu: 0, retentionArpu: 0, baseArpu: 0,
          inflowRev: 0, inflowSubVol: 0,
          outflowRev: 0, outflowSubVol: 0,
          retentionRev: 0, retentionSubVol: 0,
          baseRev: 0, baseSubVol: 0,
        });
      }
      const m = mergedMonths.get(month)!;
      m.inflow      += entry.inflow;
      m.outflow     += entry.outflow;
      m.retention   += entry.retention;
      m.base         = entry.base !== null ? (m.base ?? 0) + entry.base : m.base;
      m.arpuRevSum  += entry.arpuRevSum;
      m.arpuSubVol  += entry.arpuSubVol;
      m.inflowRev   += entry.inflowRev;    m.inflowSubVol   += entry.inflowSubVol;
      m.outflowRev  += entry.outflowRev;   m.outflowSubVol  += entry.outflowSubVol;
      m.retentionRev+= entry.retentionRev; m.retentionSubVol+= entry.retentionSubVol;
      m.baseRev     += entry.baseRev;      m.baseSubVol     += entry.baseSubVol;
    }
  }

  // Finalise merged ARPU: volume-weighted totalRevenue / totalSubscribers
  for (const mergedMonths of merged.values()) {
    for (const m of mergedMonths.values()) {
      m.arpu          = m.arpuSubVol > 0 && m.arpuRevSum > 0 ? m.arpuRevSum / m.arpuSubVol : 0;
      m.inflowArpu    = m.inflowSubVol > 0 && m.inflowRev > 0 ? m.inflowRev / m.inflowSubVol : 0;
      m.outflowArpu   = m.outflowSubVol > 0 && m.outflowRev > 0 ? m.outflowRev / m.outflowSubVol : 0;
      m.retentionArpu = m.retentionSubVol > 0 && m.retentionRev > 0 ? m.retentionRev / m.retentionSubVol : 0;
      m.baseArpu      = m.baseSubVol > 0 && m.baseRev > 0 ? m.baseRev / m.baseSubVol : 0;
    }
  }

  return Array.from(merged.entries()).map(([activeKey, monthMap]) => {
    const d = firstDims.get(activeKey)!;

    // ── Collect matching sub-cohort forecasts — needed by computeAvgShare below ──
    // Must be computed before computeAvgShare is called (closure reads matchingBfs).
    const cohortFcLookupKeyEarly = [
      d.seg,
      dims.product   ? d.prod   : 'All',
      dims.productL2 ? d.prodL2 : 'All',
      dims.channelL1 ? d.chan    : 'All',
      dims.channelL2 ? d.chanL2  : 'All',
      dims.tariffL1  ? d.tariffL1 : 'All',
      dims.tariffL2  ? d.tariffL2 : 'All',
    ].join('|');
    const cohortSrcEarly = forecastStore.get(cohortFcLookupKeyEarly) ?? null;
    type BFEarly = import('../types/forecast').BaseForecast;
    const matchingBfs: BFEarly[] = (() => {
      if (cohortSrcEarly) return [cohortSrcEarly];
      const candidates: BFEarly[] = [];
      // Shared predicate. The store key is the candidate, this row's dims are
      // the scope, and the view's group-by checkboxes are the ScopeDims -- which
      // is why product and channelL1 are gateable rather than always applied.
      const rowScope = { segment: d.seg, product: d.prod, productL2: d.prodL2,
        channel: d.chan, channelL2: d.chanL2, tariffL1: d.tariffL1, tariffL2: d.tariffL2 };
      const matchDims = dimsFromGrouping({
        product: dims.product, productL2: dims.productL2,
        channelL1: dims.channelL1, channelL2: dims.channelL2,
        tariffL1: dims.tariffL1, tariffL2: dims.tariffL2,
      });
      for (const [key, bf] of forecastStore.entries()) {
        const p = key.split('|');
        if (p[0] !== d.seg) continue;
        if (!cohortInScope({ segment: p[0], product: p[1], productL2: p[2],
              channel: p[3], channelL2: p[4], tariffL1: p[5], tariffL2: p[6] },
              rowScope, matchDims)) continue;
        candidates.push(bf);
      }
      // When productL2 is not a GROUP-BY dimension the store may contain both
      // 'All' productL2 forecasts (aggregated across L2s) and specific-L2 forecasts
      // for the same (product, channel, chanL2) triple.  flowBandMaps sums every
      // entry in matchingBfs, so including both would double-count the volume while
      // effectiveActualMap counts each actual cohort key exactly once.
      // Deduplication: two dimensions may need to be collapsed.
      //
      // 1. productL2: when dims.productL2 is off, the store may contain both
      //    'All'-L2 forecasts and specific-L2 forecasts for the same
      //    (product, channel, chanL2) triple.  Prefer the specific-L2 ones.
      //
      // 2. channel: when dims.channelL1 is off, the store may contain both
      //    per-channel forecasts and a channel-aggregate (channel='All') forecast
      //    for the same product.  Prefer the aggregate to avoid double-counting.
      //
      // Group key: always include product; include channel/chanL2 only when
      // channelL1 IS a grouping dim (otherwise collapse into one group per product).
      if (candidates.length <= 1 || dims.productL2) return candidates;
      const grouped = new Map<string, BFEarly[]>();
      for (const bf of candidates) {
        const c = bf.cohort;
        const chanPart = dims.channelL1 ? `|${c.channel ?? ''}|${c.channelL2 ?? ''}` : '';
        const grpKey = `${c.product ?? ''}${chanPart}`;
        if (!grouped.has(grpKey)) grouped.set(grpKey, []);
        grouped.get(grpKey)!.push(bf);
      }
      const out: BFEarly[] = [];
      for (const grpBfs of grouped.values()) {
        // Prefer productL2-specific over productL2-aggregate within the group.
        const specificL2 = grpBfs.filter(bf => bf.cohort.productL2 && bf.cohort.productL2 !== 'All');
        let deduped = specificL2.length > 0 ? specificL2 : grpBfs;
        // When channelL1 is not a grouping dim, also prefer the channel-aggregate
        // forecast (channel='All') over per-channel ones to avoid double-counting.
        if (!dims.channelL1) {
          const aggChan = deduped.filter(bf => !bf.cohort.channel || bf.cohort.channel === 'All');
          if (aggChan.length > 0) deduped = aggChan;
        }
        out.push(...deduped);
      }
      return out;
    })();

    // ── No forecast for this row → UNSCORED, not a fabricated score ──────
    //
    // An empty matchingBfs means nothing in forecastStore covers this row: not
    // an exact key, and not a partial match on its segment either. There is no
    // forecast to compare the actuals against.
    //
    // Everything below this point would otherwise route the row to
    // scaledBandFlow / computeAvgShare, which scale the LOADED cohort's bands
    // by a ratio of two unrelated cohorts' totals. That produced a number
    // — never a blank — and the number moved with whoever's filter was active:
    // SOHO · RED S read 60/75/61/74 with a tariff filter set and 0/0/0/0 with
    // it cleared, with the bias label flipping Under to Over in the process.
    // Neither was a measurement of anything. See EXPECTED.md §16b.
    //
    // scoreLabel(null)/scoreBg(null) already render a grey em-dash for exactly
    // this state, and BiasVal/TrendVal are both nullable, so the honest
    // rendering needed no new UI — the fallback simply never reached it.
    //
    // This is the ONLY behavioural change: a row WITH a forecast never takes
    // this branch and is untouched.
    if (!matchingBfs.length) {
      const labelPartsNF = [d.seg];
      if (dims.product)   labelPartsNF.push(d.prod);
      if (dims.productL2) labelPartsNF.push(d.prodL2);
      if (dims.channelL1) labelPartsNF.push(d.chan);
      if (dims.channelL2) labelPartsNF.push(d.chanL2);
      if (dims.tariffL1)  labelPartsNF.push(d.tariffL1);
      if (dims.tariffL2)  labelPartsNF.push(d.tariffL2);
      return {
        cohortKey: activeKey,
        seg: d.seg, prod: d.prod, prodL2: d.prodL2, chan: d.chan, chanL2: d.chanL2,
        tariffL1: d.tariffL1, tariffL2: d.tariffL2,
        label: labelPartsNF.join(' · '),
        // null MAPE keeps these rows out of the AutoML Challenger's
        // avgMape > 5% threshold — a cohort with no forecast has nothing for a
        // challenger model to beat.
        inflowMape: null, outflowMape: null, retentionMape: null, avgMape: null,
        inflowScore: null, outflowScore: null, retentionScore: null, baseScore: null,
        inflowArpuScore: null, outflowArpuScore: null,
        retentionArpuScore: null, baseArpuScore: null,
        overallScore: null,
        // Bias and trend are derived from a score. With no score there is
        // nothing to be above or below, and nothing to be improving on.
        inflowBias: null, outflowBias: null, retentionBias: null, baseBias: null,
        inflowArpuBias: null, outflowArpuBias: null,
        retentionArpuBias: null, baseArpuBias: null,
        inflowTrend: null, outflowTrend: null, retentionTrend: null, baseTrend: null,
        inflowArpuTrend: null, outflowArpuTrend: null,
        retentionArpuTrend: null, baseArpuTrend: null,
        worstKpi: 'inflow' as KpiKey,
        // Actuals are real and are retained: the row still charts on click and
        // still shows what happened. Only the comparison is absent.
        monthMap,
        inflowDetail: null, outflowDetail: null, retentionDetail: null, baseDetail: null,
        inflowArpuDetail: null, outflowArpuDetail: null,
        retentionArpuDetail: null, baseArpuDetail: null,
        noForecast: true,
      } as CohortAccuracyRow;
    }

    // ── Scope actuals to match matchingBfs forecast coverage ─────────────
    // When matchingBfs covers only a subset of channels/products for this cohort
    // group (e.g. only Direct-channel forecasts when the cohort row aggregates all
    // channels), comparing aggregate actuals against partial-coverage forecast bands
    // produces garbage scores. effectiveActualMap restricts actuals to the same
    // dimension coverage as matchingBfs so both sides are at the same scale.
    // Falls back to monthMap when matchingBfs is empty (share-scaling path).
    const effectiveActualMap = (() => {
      if (!matchingBfs.length) return monthMap;
      const scoped = new Map<string, CohortMonthEntry>();
      for (const [key, rawMonthMap] of cohortActualsMap.entries()) {
        const [kSeg, kProd, kProdL2, kChan, kChanL2, kTariffL1, kTariffL2] = key.split('|');
        if (kSeg !== d.seg) continue;
        // Shared predicate, direction reversed from matchingBfs above: here the
        // ACTUALS key is the candidate and the forecast's cohort is the scope,
        // asking whether this actuals bucket is covered by any matched forecast.
        const covered = matchingBfs.some(bf => cohortInScope(
          { segment: kSeg, product: kProd, productL2: kProdL2,
            channel: kChan, channelL2: kChanL2, tariffL1: kTariffL1, tariffL2: kTariffL2 },
          bf.cohort, ALL_DIMS));
        if (!covered) continue;
        for (const [month, entry] of rawMonthMap.entries()) {
          if (!scoped.has(month)) {
            scoped.set(month, {
              inflow: 0, outflow: 0, retention: 0, base: null, arpu: 0, arpuRevSum: 0, arpuSubVol: 0,
              inflowArpu: 0, outflowArpu: 0, retentionArpu: 0, baseArpu: 0,
              inflowRev: 0, inflowSubVol: 0,
              outflowRev: 0, outflowSubVol: 0,
              retentionRev: 0, retentionSubVol: 0,
              baseRev: 0, baseSubVol: 0,
            });
          }
          const e = scoped.get(month)!;
          e.inflow     += entry.inflow;
          e.outflow    += entry.outflow;
          e.retention  += entry.retention;
          if (entry.base !== null) e.base = (e.base ?? 0) + entry.base;
          e.arpuSubVol += entry.arpuSubVol;
          e.arpuRevSum += entry.arpuRevSum;
          e.inflowRev    += entry.inflowRev;    e.inflowSubVol    += entry.inflowSubVol;
          e.outflowRev   += entry.outflowRev;   e.outflowSubVol   += entry.outflowSubVol;
          e.retentionRev += entry.retentionRev; e.retentionSubVol += entry.retentionSubVol;
          e.baseRev      += entry.baseRev;      e.baseSubVol      += entry.baseSubVol;
        }
      }
      for (const e of scoped.values()) {
        e.arpu          = e.arpuSubVol > 0 && e.arpuRevSum > 0 ? e.arpuRevSum / e.arpuSubVol : 0;
        e.inflowArpu    = e.inflowSubVol > 0 && e.inflowRev > 0 ? e.inflowRev / e.inflowSubVol : 0;
        e.outflowArpu   = e.outflowSubVol > 0 && e.outflowRev > 0 ? e.outflowRev / e.outflowSubVol : 0;
        e.retentionArpu = e.retentionSubVol > 0 && e.retentionRev > 0 ? e.retentionRev / e.retentionSubVol : 0;
        e.baseArpu      = e.baseSubVol > 0 && e.baseRev > 0 ? e.baseRev / e.baseSubVol : 0;
      }
      return scoped.size > 0 ? scoped : monthMap;
    })();

    // ── Month list for scoring — intersection of forecast months and actual months ──
    // Using only forecast months caused segment-level rows to score null because
    // future forecast months have no actuals. Using only baseForecast months (the
    // previous fix) broke Product L1 scale alignment: effectiveActualMap scopes
    // actuals to matchingBfs coverage, but baseForecast.months doesn't change.
    // The correct approach: iterate forecast months that ALSO have actuals in
    // effectiveActualMap — this eliminates empty future months while preserving
    // the scale alignment that effectiveActualMap provides.
    const allFcMonths: string[] = matchingBfs.length > 0
      ? [...new Set(matchingBfs.flatMap(bf => bf.months.map(m => m.month)))].sort()
      : baseForecast.months.map(m => m.month);
    const forecastMonths: string[] = allFcMonths.filter(m => effectiveActualMap.has(m));

    // ── Per-cohort average share (flow metrics) ──────────────────────────
    // Fixed share = mean(cohortActual_t / totalActual_t) over all matched months.
    // Using a fixed share rather than the current-month actual breaks the
    // cancellation that caused every cohort to score identically (~81).
    const computeAvgShare = (kpi: 'inflow' | 'outflow' | 'retention'): number | null => {
      const shares: number[] = [];
      for (const [month, entry] of monthMap.entries()) {
        const snap = aggrMap.get(month);
        if (!snap || snap[kpi] === 0) continue;
        const cohortVal = entry[kpi];
        if (cohortVal === 0) continue;
        shares.push(cohortVal / snap[kpi]);
      }
      if (!shares.length) return null;
      return shares.reduce((s, v) => s + v, 0) / shares.length;
    };

    const avgShareInflow    = computeAvgShare('inflow');
    const avgShareOutflow   = computeAvgShare('outflow');
    const avgShareRetention = computeAvgShare('retention');

    // ── Flow band helper ─────────────────────────────────────────────────
    const scaledBandFlow = (bm: typeof baseForecast.months[0], kpi: 'inflow' | 'outflow' | 'retention') => {
      const share =
        kpi === 'inflow'     ? avgShareInflow
        : kpi === 'outflow'  ? avgShareOutflow
        : avgShareRetention;
      if (share === null) return null;
      return {
        mean: bm[kpi].mean * share,
        opt:  bm[kpi].optimistic  * share,
        pess: bm[kpi].pessimistic * share,
      };
    };

    // ── Base: derive running stock for both forecast and actuals ─────────
    // Forecast base confidence bands propagate inflow/outflow bands through
    // the running stock formula: opt uses max inflow + min outflow per month.
    // ARPU is a rate metric — compared directly to aggregate forecast bands,
    // no volume-share scaling applied.
    const derivedBaseBands = (() => {
      const shareIn  = avgShareInflow;
      const shareOut = avgShareOutflow ?? avgShareInflow;
      if (shareIn === null) return null;
      let meanB = baseForecast.seedBaseVolume * shareIn;
      let optB  = baseForecast.seedBaseVolume * shareIn;
      let pessB = baseForecast.seedBaseVolume * shareIn;
      let pMeanIn = baseForecast.lastHistoricalInflow  * shareIn;
      let pMeanOut = baseForecast.lastHistoricalOutflow * shareOut;
      let pOptIn   = baseForecast.lastHistoricalInflow  * shareIn;
      let pOptOut  = baseForecast.lastHistoricalOutflow * shareOut;
      let pPessIn  = baseForecast.lastHistoricalInflow  * shareIn;
      let pPessOut = baseForecast.lastHistoricalOutflow * shareOut;
      const map = new Map<string, { mean: number; opt: number; pess: number }>();
      for (const bm of baseForecast.months) {
        meanB = Math.max(0, meanB + pMeanIn - pMeanOut);
        optB  = Math.max(0, optB  + pOptIn  - pOptOut);
        pessB = Math.max(0, pessB + pPessIn - pPessOut);
        map.set(bm.month, { mean: meanB, opt: optB, pess: pessB });
        pMeanIn  = bm.inflow.mean        * shareIn;
        pMeanOut = bm.outflow.mean       * shareOut;
        pOptIn   = bm.inflow.optimistic  * shareIn;
        pOptOut  = bm.outflow.pessimistic * shareOut; // opt: high inflow, low outflow
        pPessIn  = bm.inflow.pessimistic * shareIn;
        pPessOut = bm.outflow.optimistic  * shareOut; // pess: low inflow, high outflow
      }
      return map;
    })();

    // Actual cohort base: read directly from effectiveActualMap — never derived.
    // Uses effectiveActualMap so base actuals match the forecast coverage scope.
    const actualCohortBaseMap = (() => {
      const map = new Map<string, number>();
      for (const month of forecastMonths) {
        const act = effectiveActualMap.get(month);
        if (act?.base !== null && act?.base !== undefined) map.set(month, act.base);
      }
      return map;
    })();

    // matchingBfs already computed above (before computeAvgShare) as cohortFcLookupKeyEarly.
    // Alias for backward compatibility with code below that uses cohortFcLookupKey / cohortSrc.
    const cohortFcLookupKey = cohortFcLookupKeyEarly;
    const cohortSrc = cohortSrcEarly;

    // ── Flow forecast band maps — summed across all matching sub-cohorts ──────
    // Volume metrics (inflow / outflow / retention) are count-additive.
    const flowBandMaps = (() => {
      if (!matchingBfs.length) return null;
      type BandMap = Map<string, { mean: number; opt: number; pess: number }>;
      const inf: BandMap = new Map();
      const out: BandMap = new Map();
      const ret: BandMap = new Map();
      const monthSet = new Set<string>();
      for (const bf of matchingBfs) for (const m of bf.months) monthSet.add(m.month);
      for (const month of monthSet) {
        let iM=0, iO=0, iP=0, oM=0, oO=0, oP=0, rM=0, rO=0, rP=0;
        for (const bf of matchingBfs) {
          const m = bf.months.find(mm => mm.month === month);
          if (!m) continue;
          iM += m.inflow.mean;    iO += m.inflow.optimistic;    iP += m.inflow.pessimistic;
          oM += m.outflow.mean;   oO += m.outflow.optimistic;   oP += m.outflow.pessimistic;
          rM += m.retention.mean; rO += m.retention.optimistic; rP += m.retention.pessimistic;
        }
        inf.set(month, { mean: iM, opt: iO, pess: iP });
        out.set(month, { mean: oM, opt: oO, pess: oP });
        ret.set(month, { mean: rM, opt: rO, pess: rP });
      }
      return { inflow: inf, outflow: out, retention: ret };
    })();

    // ── Base band — derived running stock using summed seeds + flows ──────────
    const cohortBaseBandMap = (() => {
      if (!matchingBfs.length) return null;
      const seedBase = matchingBfs.reduce((s, bf) => s + (bf.seedBaseVolume || 0), 0);
      const lastIn   = matchingBfs.reduce((s, bf) => s + bf.lastHistoricalInflow,  0);
      const lastOut  = matchingBfs.reduce((s, bf) => s + bf.lastHistoricalOutflow, 0);
      const monthSet = new Set<string>();
      for (const bf of matchingBfs) for (const m of bf.months) monthSet.add(m.month);
      const monthList = [...monthSet].sort();
      let meanB = seedBase, optB = seedBase, pessB = seedBase;
      let pMeanIn=lastIn,  pMeanOut=lastOut;
      let pOptIn =lastIn,  pOptOut =lastOut;
      let pPessIn=lastIn,  pPessOut=lastOut;
      const map = new Map<string, { mean: number; opt: number; pess: number }>();
      for (const month of monthList) {
        let iM=0, iO=0, iP=0, oM=0, oO=0, oP=0;
        for (const bf of matchingBfs) {
          const m = bf.months.find(mm => mm.month === month);
          if (!m) continue;
          iM += m.inflow.mean;    iO += m.inflow.optimistic;    iP += m.inflow.pessimistic;
          oM += m.outflow.mean;   oO += m.outflow.optimistic;   oP += m.outflow.pessimistic;
        }
        meanB = Math.max(0, meanB + pMeanIn - pMeanOut);
        optB  = Math.max(0, optB  + pOptIn  - pOptOut);
        pessB = Math.max(0, pessB + pPessIn - pPessOut);
        map.set(month, { mean: meanB, opt: optB, pess: pessB });
        pMeanIn=iM; pMeanOut=oM;
        pOptIn=iO;  pOptOut=oP;   // opt: high inflow, low outflow
        pPessIn=iP; pPessOut=oO;  // pess: low inflow, high outflow
      }
      return map;
    })();

    // ── Running base stock per bf — shared by arpuBandMap and cohortAdjMeanMap ──
    // Pre-computed once so both IIFEs can weight ARPU by (derivedBase + inflow.mean),
    // which matches the denominator used in cohortActualsMap (Base + Inflow volume).
    const bfBaseMap = (() => {
      const m = new Map<BFEarly, Map<string, number>>();
      for (const bf of matchingBfs) {
        const bmap = new Map<string, number>();
        const sortedM = [...bf.months].sort((a, b) => a.month.localeCompare(b.month));
        let b = bf.seedBaseVolume || 0, pIn = bf.lastHistoricalInflow || 0, pOut = bf.lastHistoricalOutflow || 0;
        for (const mm of sortedM) {
          b = Math.max(0, b + pIn - pOut);
          bmap.set(mm.month, b);
          pIn = mm.inflow.mean; pOut = mm.outflow.mean;
        }
        m.set(bf, bmap);
      }
      return m;
    })();

    // ── ARPU forecast band — revenue-proxy-weighted average across matching sub-cohorts ──
    const arpuBandMap = (() => {
      if (!matchingBfs.length) return new Map<string, { mean: number; opt: number; pess: number }>();
      const monthSet = new Set<string>();
      for (const bf of matchingBfs) for (const m of bf.months) monthSet.add(m.month);
      const map = new Map<string, { mean: number; opt: number; pess: number }>();
      for (const month of monthSet) {
        let totalW=0, wMean=0, wOpt=0, wPess=0;
        for (const bf of matchingBfs) {
          const m = bf.months.find(mm => mm.month === month);
          if (!m) continue;
          const derivedBase = bfBaseMap.get(bf)?.get(month) ?? 0;
          const w = derivedBase + m.inflow.mean;
          if (w <= 0) continue;
          totalW += w;
          wMean  += m.arpu.mean        * w;
          wOpt   += m.arpu.optimistic  * w;
          wPess  += m.arpu.pessimistic * w;
        }
        if (totalW > 0) map.set(month, { mean: wMean/totalW, opt: wOpt/totalW, pess: wPess/totalW });
      }
      return map;
    })();

    // ── Per-scenario ARPU forecast band maps ────────────────────────────────────
    // Each weighted by the scenario's own volume (inflow weight for inflowArpu, etc.)
    const makeArpuScenBandMap = (
      getter: (m: typeof matchingBfs[0]['months'][0]) => import('../types/forecast').ForecastBand | undefined,
      volGetter: (m: typeof matchingBfs[0]['months'][0]) => number,
    ): Map<string, { mean: number; opt: number; pess: number }> => {
      if (!matchingBfs.length) return new Map();
      const monthSet = new Set<string>();
      for (const bf of matchingBfs) for (const m of bf.months) monthSet.add(m.month);
      const map = new Map<string, { mean: number; opt: number; pess: number }>();
      for (const month of monthSet) {
        let totalW=0, wMean=0, wOpt=0, wPess=0;
        for (const bf of matchingBfs) {
          const m = bf.months.find(mm => mm.month === month);
          if (!m) continue;
          const band = getter(m);
          if (!band) continue;
          const w = volGetter(m);
          if (w <= 0) continue;
          totalW += w; wMean += band.mean * w; wOpt += band.optimistic * w; wPess += band.pessimistic * w;
        }
        if (totalW > 0) map.set(month, { mean: wMean/totalW, opt: wOpt/totalW, pess: wPess/totalW });
      }
      return map;
    };
    const inflowArpuBandMap    = makeArpuScenBandMap(m => m.inflowArpu,    m => m.inflow.mean);
    const outflowArpuBandMap   = makeArpuScenBandMap(m => m.outflowArpu,   m => m.outflow.mean);
    const retentionArpuBandMap = makeArpuScenBandMap(m => m.retentionArpu, m => m.retention.mean);
    // Base ARPU uses derived base stock (bfBaseMap) as weight — computed separately
    const baseArpuBandMap = (() => {
      if (!matchingBfs.length) return new Map<string, { mean: number; opt: number; pess: number }>();
      const monthSet = new Set<string>();
      for (const bfx of matchingBfs) for (const m of bfx.months) monthSet.add(m.month);
      const map = new Map<string, { mean: number; opt: number; pess: number }>();
      for (const month of monthSet) {
        let totalW=0, wMean=0, wOpt=0, wPess=0;
        for (const bfx of matchingBfs) {
          const m = bfx.months.find(mm => mm.month === month);
          if (!m || !m.baseArpu) continue;
          const w = bfBaseMap.get(bfx)?.get(month) ?? 0;
          if (w <= 0) continue;
          totalW += w; wMean += m.baseArpu.mean * w; wOpt += m.baseArpu.optimistic * w; wPess += m.baseArpu.pessimistic * w;
        }
        if (totalW > 0) map.set(month, { mean: wMean/totalW, opt: wOpt/totalW, pess: wPess/totalW });
      }
      return map;
    })();

    // Per-scenario ARPU scoring helper (rate metric — no volume scaling)
    type ArpuScen = 'inflowArpu' | 'outflowArpu' | 'retentionArpu' | 'baseArpu';
    const calcArpuScenDetail = (
      scenario: ArpuScen,
      bandMap: Map<string, { mean: number; opt: number; pess: number }>,
    ): ComponentDetail | null => {
      const ARPU_SCEN_LABELS: Record<ArpuScen, string> = {
        inflowArpu: 'Inflow ARPU', outflowArpu: 'Outflow ARPU', retentionArpu: 'Retention ARPU', baseArpu: 'Base ARPU',
      };
      const detailRows: MonthScoreDetail[] = [];
      for (const month of forecastMonths) {
        const act = effectiveActualMap.get(month);
        const actual = act?.[scenario] ?? 0;
        if (!actual) continue;
        const band = bandMap.get(month);
        if (!band || band.mean === 0) continue;
        const dev = (actual - band.mean) / Math.abs(band.mean) * 100;
        const absDev = Math.abs(dev);
        let primary: number;
        if      (absDev <=  1) primary = 100 - 5  * absDev;
        else if (absDev <=  3) primary =  95 - 5  * (absDev -  1) / 2;
        else if (absDev <=  5) primary =  85 - 5  * (absDev -  3) / 2;
        else if (absDev <= 10) primary =  75 - 15 * (absDev -  5) / 5;
        else if (absDev <= 20) primary =  60 - 20 * (absDev - 10) / 10;
        else                   primary = Math.max(0, 40 - 40 * (absDev - 20) / 20);
        const inBand = actual >= band.pess && actual <= band.opt;
        const penalty = inBand ? 0 : (primary >= 65 ? 5 : 10);
        detailRows.push({ month, actual, mean: band.mean, dev, inBand, primary, penalty, score: Math.max(0, primary - penalty) });
      }
      if (!detailRows.length) return null;
      const avgDev = detailRows.reduce((s, r) => s + Math.abs(r.dev), 0) / detailRows.length;
      return { label: ARPU_SCEN_LABELS[scenario], rows: detailRows, avgDev, score: detailRows.reduce((s, r) => s + r.score, 0) / detailRows.length };
    };
    const calcArpuScenBias = (scenario: ArpuScen, bandMap: Map<string, { mean: number; opt: number; pess: number }>): BiasVal => {
      let above = 0, below = 0;
      for (const month of forecastMonths) {
        const act = effectiveActualMap.get(month);
        const actual = act?.[scenario] ?? 0;
        if (!actual) continue;
        const band = bandMap.get(month);
        if (!band) continue;
        actual >= band.mean ? above++ : below++;
      }
      const total = above + below;
      if (!total) return null;
      if (above / total >= 0.7) return 'above';
      if (below / total >= 0.7) return 'below';
      return null;
    };
    const calcArpuScenTrend = (scenario: ArpuScen, bandMap: Map<string, { mean: number; opt: number; pess: number }>): TrendVal => {
      const devs: number[] = [];
      for (const month of forecastMonths) {
        const act = effectiveActualMap.get(month);
        const actual = act?.[scenario] ?? 0;
        if (!actual) continue;
        const band = bandMap.get(month);
        if (!band || band.mean === 0) continue;
        devs.push(Math.abs(actual - band.mean) / Math.abs(band.mean) * 100);
      }
      if (devs.length < 6) return 'insufficient';
      const recent = devs.slice(-3).reduce((a, b) => a + b, 0) / 3;
      const prior  = devs.slice(-6, -3).reduce((a, b) => a + b, 0) / 3;
      const delta  = recent - prior;
      if (delta < -1) return 'improving';
      if (delta >  1) return 'worsening';
      return 'stable';
    };

    // ── Aggregate adjusted mean map — sum adjusted means across all matchingBfs ──
    // adjustedMeanMap is built from the single loaded baseForecast's adjustedForecast.
    // For aggregate rows where matchingBfs contains multiple sub-cohort forecasts,
    // flowBandMaps/arpuBandMap are the SUM across all matchingBfs — so applying the
    // single loaded forecast's adjusted mean to that aggregate replaces the wrong value.
    // Instead, build a per-month aggregate where each bf contributes either its
    // adjusted means (if it IS the loaded baseForecast) or its baseline means (all others).
    //
    // ARPU is a rate metric, not a volume — so the adjustment is propagated via a ratio
    // (adj.arpu / baseline.arpu on the loaded bf) applied to ALL sub-cohort ARPUs.
    // This ensures yield / pricing event effects surface in sub-cohort rows even when
    // the loaded baseForecast key doesn't exactly match the sub-cohort key.
    const cohortAdjMeanMap = (() => {
      if (!adjustedMeanMap || !matchingBfs.length) return adjustedMeanMap;
      const loadedKey = [
        baseForecast.cohort.segment,
        baseForecast.cohort.product,
        baseForecast.cohort.productL2 ?? 'All',
        baseForecast.cohort.channel,
        baseForecast.cohort.channelL2 ?? 'All',
      ].join('|');

      // Pre-compute per-month ARPU ratio: adjusted / baseline from the loaded bf.
      // Used to propagate yield/pricing event effects to sub-cohort ARPU bands.
      const arpuRatioByMonth = new Map<string, number>();
      for (const [month, adj] of adjustedMeanMap) {
        const loadedBfMonth = baseForecast.months.find(m => m.month === month);
        if (loadedBfMonth && loadedBfMonth.arpu.mean > 0) {
          arpuRatioByMonth.set(month, adj.arpu / loadedBfMonth.arpu.mean);
        }
      }

      // Reuse the bfBaseMap already computed for arpuBandMap above.
      const map: AdjustedMeanMap = new Map();
      const monthSet = new Set<string>(forecastMonths);
      for (const month of monthSet) {
        let inf = 0, out = 0, ret = 0, wArpu = 0, wTotal = 0;
        const arpuRatio = arpuRatioByMonth.get(month) ?? 1;
        for (const bf of matchingBfs) {
          const bm = bf.months.find(m => m.month === month);
          if (!bm) continue;
          const bfKey = [
            bf.cohort.segment,
            bf.cohort.product,
            bf.cohort.productL2 ?? 'All',
            bf.cohort.channel,
            bf.cohort.channelL2 ?? 'All',
          ].join('|');
          // Volume adjustments: only apply for the exact loaded forecast cohort.
          const adj = bfKey === loadedKey ? adjustedMeanMap.get(month) : undefined;
          inf += adj ? adj.inflow     : bm.inflow.mean;
          out += adj ? adj.outflow    : bm.outflow.mean;
          ret += adj ? adj.retention  : bm.retention.mean;
          // Use same (derivedBase + inflow) weighting as arpuBandMap for consistency.
          const derivedBase = bfBaseMap.get(bf)?.get(month) ?? 0;
          const w = derivedBase + bm.inflow.mean;
          if (w <= 0) continue;
          // ARPU: apply ratio to every sub-cohort so yield/pricing events propagate.
          wArpu  += bm.arpu.mean * arpuRatio * w;
          wTotal += w;
        }
        map.set(month, { inflow: inf, outflow: out, retention: ret, arpu: wTotal > 0 ? wArpu / wTotal : 0 });
      }
      return map;
    })();

    // ── Adjusted per-scenario ARPU band maps ─────────────────────────────────
    // When adjustedMeanMap is active, shift each per-scenario band by the same
    // blended ARPU ratio so the toggle also affects Inf/Out/Ret/Base ARPU columns.
    const applyArpuRatioToMap = (
      bandMap: Map<string, { mean: number; opt: number; pess: number }>,
    ): Map<string, { mean: number; opt: number; pess: number }> => {
      if (!cohortAdjMeanMap) return bandMap;
      const out = new Map<string, { mean: number; opt: number; pess: number }>();
      for (const [month, band] of bandMap) {
        const adjBlended  = cohortAdjMeanMap.get(month)?.arpu;
        const baseBlended = arpuBandMap.get(month)?.mean;
        if (adjBlended !== undefined && baseBlended && baseBlended > 0) {
          const ratio = adjBlended / baseBlended;
          const hw = (band.opt - band.pess) / 2;
          const adjMean = band.mean * ratio;
          out.set(month, { mean: adjMean, opt: adjMean + hw, pess: adjMean - hw });
        } else {
          out.set(month, band);
        }
      }
      return out;
    };
    const effectiveInflowArpuBandMap    = cohortAdjMeanMap ? applyArpuRatioToMap(inflowArpuBandMap)    : inflowArpuBandMap;
    const effectiveOutflowArpuBandMap   = cohortAdjMeanMap ? applyArpuRatioToMap(outflowArpuBandMap)   : outflowArpuBandMap;
    const effectiveRetentionArpuBandMap = cohortAdjMeanMap ? applyArpuRatioToMap(retentionArpuBandMap) : retentionArpuBandMap;
    const effectiveBaseArpuBandMap      = cohortAdjMeanMap ? applyArpuRatioToMap(baseArpuBandMap)      : baseArpuBandMap;

    // ── Generic per-component actual + band lookup ────────────────────────
    type BandTrio = { mean: number; opt: number; pess: number };
    type ActBand  = { actual: number; band: BandTrio; isAdjusted?: boolean };
    const getActualAndBand = (month: string, kpi: KpiKey): ActBand | null => {
      // Adjusted mean override: shift the band centre while preserving half-widths.
      const adjMeans = cohortAdjMeanMap?.get(month);
      const applyAdjMean = (band: BandTrio, adjMean: number): BandTrio => {
        const hw = (band.opt - band.pess) / 2;
        return { mean: adjMean, opt: adjMean + hw, pess: adjMean - hw };
      };

      if (kpi === 'base') {
        const actual = actualCohortBaseMap?.get(month);
        // Prefer cohortBaseBandMap (derived from cohort-specific forecast) over
        // derivedBaseBands (share-scaled aggregate, wrong scale for L2 cohorts).
        const band = cohortBaseBandMap?.get(month) ?? derivedBaseBands?.get(month);
        if (actual === undefined || actual === 0 || !band) return null;
        return { actual, band };
      }
      if (kpi === 'arpu') {
        const act = effectiveActualMap.get(month);
        if (!act || act.arpu === 0) return null;
        const baseBand = arpuBandMap.get(month);
        if (!baseBand) return null;
        const band = adjMeans ? applyAdjMean(baseBand, adjMeans.arpu) : baseBand;
        return { actual: act.arpu, band, isAdjusted: !!adjMeans };
      }
      const act = effectiveActualMap.get(month);
      if (!act || act[kpi] === 0) return null;
      const directBand = flowBandMaps?.[kpi]?.get(month);
      // Fallback to share-scaled band from baseForecast when no direct matchingBfs band.
      const fallbackBm = directBand ? null : baseForecast.months.find(m => m.month === month);
      const baseBand = directBand ?? (fallbackBm ? scaledBandFlow(fallbackBm, kpi) : null);
      if (!baseBand) return null;
      const band = adjMeans ? applyAdjMean(baseBand, adjMeans[kpi as 'inflow' | 'outflow' | 'retention']) : baseBand;
      return { actual: act[kpi], band, isAdjusted: !!adjMeans };
    };

    // ── Per-component score with full detail for tooltip + diagnostic logs ───
    const KPI_LABEL_MAP: Record<KpiKey, string> = {
      inflow: 'Inflow', outflow: 'Outflow', retention: 'Retention', base: 'Base', arpu: 'ARPU',
    };
    const debugCohort = `${d.seg}|${d.prod}|${d.chan}` === 'SOHO|Fixed Connectivity|Indirect';

    const calcComponentDetail = (kpi: KpiKey): ComponentDetail | null => {
      const detailRows: MonthScoreDetail[] = [];
      for (const month of forecastMonths) {
        const p = getActualAndBand(month, kpi);
        if (!p) continue;
        const { actual, band } = p;
        const mean = band.mean;
        if (mean === 0) continue;
        const dev = (actual - mean) / Math.abs(mean) * 100;
        const absDev = Math.abs(dev);
        // Primary score (same formula as scoreMonth — reproduced here for detail)
        let primary: number;
        if      (absDev <=  1) primary = 100 - 5  * absDev;
        else if (absDev <=  3) primary =  95 - 5  * (absDev -  1) / 2;
        else if (absDev <=  5) primary =  85 - 5  * (absDev -  3) / 2;
        else if (absDev <= 10) primary =  75 - 15 * (absDev -  5) / 5;
        else if (absDev <= 20) primary =  60 - 20 * (absDev - 10) / 10;
        else                   primary = Math.max(0, 40 - 40 * (absDev - 20) / 20);
        const inBand = actual >= band.pess && actual <= band.opt;
        const penalty = inBand ? 0 : (primary >= 65 ? 5 : 10);
        const score = Math.max(0, primary - penalty);
        detailRows.push({ month, actual, mean, dev, inBand, primary, penalty, score });
      }
      if (!detailRows.length) return null;
      const avgDev = detailRows.reduce((s, r) => s + Math.abs(r.dev), 0) / detailRows.length;
      const scoreVal = detailRows.reduce((s, r) => s + r.score, 0) / detailRows.length;

      if (debugCohort) {
        console.group(`[AccuracyScore] ${d.seg}|${d.prod}|${d.chan} — ${KPI_LABEL_MAP[kpi]}`);
        console.log('Band source:', flowBandMaps ? `forecastStore[${[d.seg, dims.product ? d.prod : 'All', dims.channelL1 ? d.chan : 'All'].join('|')}]` : 'scaledBandFlow (share-scaled aggregate)');
        console.table(detailRows.map(r => ({
          month: r.month,
          actual: r.actual.toFixed(0),
          mean: r.mean.toFixed(0),
          'dev%': r.dev.toFixed(2) + '%',
          inBand: r.inBand ? '✓' : '✗',
          primary: r.primary.toFixed(1),
          penalty: r.penalty,
          score: r.score.toFixed(1),
        })));
        console.log(`avgDev=${avgDev.toFixed(2)}%  componentScore=${scoreVal.toFixed(1)}`);
        console.groupEnd();
      }

      return { label: KPI_LABEL_MAP[kpi], rows: detailRows, avgDev, score: scoreVal };
    };

    const calcComponentScore = (kpi: KpiKey): number | null => calcComponentDetail(kpi)?.score ?? null;

    const calcComponentBias = (kpi: KpiKey): BiasVal => {
      let above = 0, below = 0;
      for (const month of forecastMonths) {
        const p = getActualAndBand(month, kpi);
        if (!p) continue;
        p.actual >= p.band.mean ? above++ : below++;
      }
      const total = above + below;
      if (!total) return null;
      if (above / total >= 0.7) return 'above';
      if (below / total >= 0.7) return 'below';
      return null;
    };

    const calcComponentTrend = (kpi: KpiKey): TrendVal => {
      // Trend compares mean absolute % deviation (recent 3 vs prior 3) so it
      // reflects direction of travel independently of the scoring model.
      const devs: number[] = [];
      for (const month of forecastMonths) {
        const p = getActualAndBand(month, kpi);
        if (!p || p.band.mean === 0) continue;
        devs.push(Math.abs(p.actual - p.band.mean) / Math.abs(p.band.mean) * 100);
      }
      if (devs.length < 6) return 'insufficient';
      const recent = devs.slice(-3).reduce((a, b) => a + b, 0) / 3;
      const prior  = devs.slice(-6, -3).reduce((a, b) => a + b, 0) / 3;
      const delta  = recent - prior; // positive = deviation getting worse
      if (delta < -1) return 'improving';
      if (delta >  1) return 'worsening';
      return 'stable';
    };

    // ── MAPE (kept for AutoML Challenger threshold) ───────────────────────
    const calcMape = (kpi: 'inflow' | 'outflow' | 'retention'): number | null => {
      const pairs = forecastMonths
        .map(month => {
          const p = getActualAndBand(month, kpi);
          if (!p) return null;
          return { a: p.actual, f: p.band.mean };
        })
        .filter(Boolean) as { a: number; f: number }[];
      if (!pairs.length) return null;
      return (pairs.reduce((s, { a, f }) => s + Math.abs(a - f) / Math.abs(a), 0) / pairs.length) * 100;
    };

    // ── Compute all metrics ───────────────────────────────────────────────
    const inflowMape    = calcMape('inflow');
    const outflowMape   = calcMape('outflow');
    const retentionMape = calcMape('retention');
    const mapeVals = [inflowMape, outflowMape, retentionMape].filter((v): v is number => v !== null);
    const avgMape = mapeVals.length ? mapeVals.reduce((a, b) => a + b, 0) / mapeVals.length : null;

    const inflowDetail    = calcComponentDetail('inflow');
    const outflowDetail   = calcComponentDetail('outflow');
    const retentionDetail = calcComponentDetail('retention');
    const baseDetail      = calcComponentDetail('base');

    const inflowArpuDetail    = calcArpuScenDetail('inflowArpu',    effectiveInflowArpuBandMap);
    const outflowArpuDetail   = calcArpuScenDetail('outflowArpu',   effectiveOutflowArpuBandMap);
    const retentionArpuDetail = calcArpuScenDetail('retentionArpu', effectiveRetentionArpuBandMap);
    const baseArpuDetail      = calcArpuScenDetail('baseArpu',      effectiveBaseArpuBandMap);

    const inflowScore    = inflowDetail?.score    ?? null;
    const outflowScore   = outflowDetail?.score   ?? null;
    const retentionScore = retentionDetail?.score ?? null;
    const baseScore      = baseDetail?.score      ?? null;
    const inflowArpuScore    = inflowArpuDetail?.score    ?? null;
    const outflowArpuScore   = outflowArpuDetail?.score   ?? null;
    const retentionArpuScore = retentionArpuDetail?.score ?? null;
    const baseArpuScore      = baseArpuDetail?.score      ?? null;

    const scoreVals = [inflowScore, outflowScore, retentionScore, baseScore,
                       inflowArpuScore, outflowArpuScore, retentionArpuScore, baseArpuScore]
      .filter((v): v is number => v !== null);
    const overallScore = scoreVals.length ? scoreVals.reduce((a, b) => a + b, 0) / scoreVals.length : null;

    // Worst-scoring volume KPI (used to auto-switch the chart tab on row click)
    const kpiScores: [KpiKey, number | null][] = [
      ['inflow', inflowScore], ['outflow', outflowScore], ['retention', retentionScore], ['base', baseScore],
    ];
    const worstKpi: KpiKey = kpiScores
      .filter(([, s]) => s !== null)
      .reduce((worst, cur) => (cur[1]! < worst[1]! ? cur : worst), ['inflow', Infinity] as [KpiKey, number])[0];

    const labelParts = [d.seg];
    if (dims.product)   labelParts.push(d.prod);
    if (dims.productL2) labelParts.push(d.prodL2);
    if (dims.channelL1) labelParts.push(d.chan);
    if (dims.channelL2) labelParts.push(d.chanL2);
    if (dims.tariffL1)  labelParts.push(d.tariffL1);
    if (dims.tariffL2)  labelParts.push(d.tariffL2);

    return {
      cohortKey: activeKey,
      seg: d.seg, prod: d.prod, prodL2: d.prodL2, chan: d.chan, chanL2: d.chanL2, tariffL1: d.tariffL1, tariffL2: d.tariffL2,
      label: labelParts.join(' · '),
      inflowMape, outflowMape, retentionMape, avgMape,
      inflowScore, outflowScore, retentionScore, baseScore,
      inflowArpuScore, outflowArpuScore, retentionArpuScore, baseArpuScore,
      overallScore,
      inflowBias:    calcComponentBias('inflow'),
      outflowBias:   calcComponentBias('outflow'),
      retentionBias: calcComponentBias('retention'),
      baseBias:      calcComponentBias('base'),
      inflowArpuBias:    calcArpuScenBias('inflowArpu',    effectiveInflowArpuBandMap),
      outflowArpuBias:   calcArpuScenBias('outflowArpu',   effectiveOutflowArpuBandMap),
      retentionArpuBias: calcArpuScenBias('retentionArpu', effectiveRetentionArpuBandMap),
      baseArpuBias:      calcArpuScenBias('baseArpu',      effectiveBaseArpuBandMap),
      inflowTrend:    calcComponentTrend('inflow'),
      outflowTrend:   calcComponentTrend('outflow'),
      retentionTrend: calcComponentTrend('retention'),
      baseTrend:      calcComponentTrend('base'),
      inflowArpuTrend:    calcArpuScenTrend('inflowArpu',    effectiveInflowArpuBandMap),
      outflowArpuTrend:   calcArpuScenTrend('outflowArpu',   effectiveOutflowArpuBandMap),
      retentionArpuTrend: calcArpuScenTrend('retentionArpu', effectiveRetentionArpuBandMap),
      baseArpuTrend:      calcArpuScenTrend('baseArpu',      effectiveBaseArpuBandMap),
      worstKpi,
      monthMap,
      inflowDetail, outflowDetail, retentionDetail, baseDetail,
      inflowArpuDetail, outflowArpuDetail, retentionArpuDetail, baseArpuDetail,
    };
  })
  // Keep only cohorts where at least one component produced a valid score —
  // cohorts outside baseForecast scope have no denominator in aggrMap.
  // Keep noForecast rows: they are deliberately unscored, not empty. This filter
  // predates them and drops anything with no score, which would have silently
  // hidden every not-yet-forecast cohort — replacing a fabricated score with an
  // absent row rather than with an honest one.
  .filter(row => row.overallScore !== null || row.avgMape !== null || row.noForecast)
  .sort((a, b) => (b.overallScore ?? 0) - (a.overallScore ?? 0));
}

// Component
// ---------------------------------------------------------------------------
export const ForecastVsActualsTab: React.FC<ForecastVsActualsTabProps> = ({
  data, wiDateCol, wiMetricCol, wiValueCol,
  wiInflowVal, wiOutflowVal, wiRetentionVal, wiBaseVal,
  wiArpuCol, wiRevenueCol, wiSegmentCol, wiProductCol, wiProductL2Col = '', wiChannelCol, wiChannelL2Col = '',
  wiTariffL1Col = '', wiTariffL2Col = '',
  formatNumber, setActiveView, onAcceptChallengerModel, onAcceptAllChallengerModels,
  onRunChallengerForecast, onAcceptPreviewForecast,
  handleImportActualsFile, onRemoveActuals, onRequestExport,
  activeFilter, onCohortFilterChange,
}) => {
  const { t } = useTranslation();
  const { baseForecast, adjustedForecast, forecastStore } = useForecast();
  const [useAdjustedScoring, setUseAdjustedScoring] = useState(false);

  const [showRemoveModal, setShowRemoveModal] = useState(false);
  const [removeToast, setRemoveToast] = useState<string | null>(null);

  // Global tooltip state — single tooltip rendered at a fixed screen position.
  // Avoids z-index / overflow clipping inside the scrollable table container.
  type TooltipPayload = { kind: 'component'; detail: ComponentDetail } | { kind: 'overall'; row: CohortAccuracyRow } | { kind: 'noForecast' };
  const [activeTooltip, setActiveTooltip] = useState<{ payload: TooltipPayload; x: number; y: number } | null>(null);
  const tooltipTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  const showTooltip = (e: React.MouseEvent, payload: TooltipPayload) => {
    if (tooltipTimerRef.current) clearTimeout(tooltipTimerRef.current);
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    // Position above the cell; if too close to the top of the viewport, position below instead.
    const spaceAbove = rect.top;
    const y = spaceAbove > 300 ? rect.top - 8 : rect.bottom + 8; // will be adjusted by tooltip itself
    setActiveTooltip({ payload, x: rect.left + rect.width / 2, y });
  };

  const hideTooltip = () => {
    tooltipTimerRef.current = setTimeout(() => setActiveTooltip(null), 80);
  };

  useEffect(() => {
    if (removeToast) {
      const t = setTimeout(() => setRemoveToast(null), 3000);
      return () => clearTimeout(t);
    }
  }, [removeToast]);

  const [selectedKpi, setSelectedKpi] = useState<KpiKey>('inflow');
  const [chartView, setChartView] = useState<'volume' | 'value'>('volume');
  // Presentation only: within the Value view, show per-subscriber ARPU or total
  // revenue. Never changes what is stored, forecast, or scored — it selects
  // which already-computed series key the chart and variance table read.
  const [valueUnit, setValueUnit] = useState<'arpu' | 'revenue'>('arpu');
  // Maps an ArpuScenario ('inflowArpu') to the series prefix actually rendered.
  // Revenue keys carry no _opt/_pess, so switching prefix suppresses the band
  // by construction rather than by a conditional at each draw site.
  const seriesPrefix = useCallback(
    (sc: string) => (valueUnit === 'revenue' ? sc.replace('Arpu', 'Rev') : sc),
    [valueUnit],
  );
  // Labels must follow the unit. SCENARIO_LABELS is keyed by ArpuScenario and
  // reads "Inflow ARPU"; leaving it while plotting revenue would mislabel every
  // series and legend entry in exactly the way the sequencing was meant to avoid.
  const scenarioLabel = useCallback(
    (sc: string) => (valueUnit === 'revenue'
      ? (SCENARIO_LABELS[sc as ArpuScenario] ?? sc).replace('ARPU', t('actuals_unit_revenue'))
      : SCENARIO_LABELS[sc as VolumeScenario | ArpuScenario]),
    [valueUnit, t],
  );
  const [activeVolumeScenarios, setActiveVolumeScenarios] = useState<VolumeScenario[]>(['inflow', 'outflow', 'retention', 'base']);
  const [activeArpuScenarios, setActiveArpuScenarios] = useState<ArpuScenario[]>(['inflowArpu', 'outflowArpu', 'retentionArpu', 'baseArpu']);
  const [selectedCohortKey, setSelectedCohortKey] = useState<string | null>(null);
  const [activeSubView, setActiveSubView] = useState<'forecast' | 'challenger'>('forecast');

  // Selected cohort row in the Historical Accuracy table — drives chart scoping.
  const [selectedForecastCohortKey, setSelectedForecastCohortKey] = useState<string | null>(null);

  // Dimension selectors — each sub-view owns its own independent selection so
  // changing grouping in one tab does not disturb the other.
  const [cohortDims, setCohortDims] = useState<CohortDims>({ product: false, productL2: false, channelL1: false, channelL2: false, tariffL1: false, tariffL2: false });
  const [cohortSearch, setCohortSearch] = useState('');
  const [challengerDims, setChallengerDims] = useState<CohortDims>({ product: false, productL2: false, channelL1: false, channelL2: false, tariffL1: false, tariffL2: false });

  // Challenger list filter state — independent of the dimension selectors above.
  const [challengerSearch,      setChallengerSearch]      = useState('');
  const [challengerStatus,      setChallengerStatus]      = useState<'all' | 'action_required' | 'best_applied'>('all');
  const [challengerModelFilter, setChallengerModelFilter] = useState<'All' | ForecastModel>('All');
  // When true, shows all cohorts regardless of score threshold (user override).
  const [challengerShowAll, setChallengerShowAll] = useState(false);
  // Real challenger forecasts keyed by cohortKey. Set when user clicks "Run Forecast".
  const [challengerPreviews, setChallengerPreviews] = useState<Map<string, import('../types/forecast').BaseForecast>>(new Map());
  // Key of the cohort currently being computed (shows a loading state).
  const [runningChallengerKey, setRunningChallengerKey] = useState<string | null>(null);

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
  // 1. Aggregate actuals from raw data — scoped to baseForecast.cohort so the
  //    monthly variance chart and MAPE cards always compare like-for-like:
  //    the same segment / product / channel that the forecast was generated for.
  //    (cohortActualsMap below uses activeFilter for the broader accuracy table.)
  // ---------------------------------------------------------------------------
  const actualsAggrMap = useMemo(() => {
    // Track per-scenario revenue and subs for all 4 IBRO types.
    // Blended ARPU = total revenue across ALL 4 / total subs across ALL 4.
    type Bucket = {
      inflow: number; outflow: number; retention: number;
      base: number | null;
      arpuSubVol: number; revSum: number;
      inflowRev: number; inflowSubVol: number;
      outflowRev: number; outflowSubVol: number;
      retentionRev: number; retentionSubVol: number;
      baseRev: number; baseSubVol: number;
    };
    const map = new Map<string, Bucket>();

    if (!data.length || !wiDateCol) return map;

    // Scope rows for the actuals aggregate map.
    //
    // When activeFilter is set (user has explicitly chosen a scope in the filter bar),
    // use ONLY activeFilter — do NOT additionally restrict by baseForecast.cohort.
    // baseForecast.cohort reflects which sub-cohort the last selected forecast was
    // built for (e.g. Corporate/Mobile Data/Direct).  Intersecting that with the
    // user's activeFilter (e.g. SME/All/All) would produce an empty result set even
    // though SME actuals exist, because the two segments never overlap.
    //
    // When activeFilter is null, fall back to baseForecast.cohort as the scope so
    // the "unfiltered" view still respects the forecast's native dimension scope.
    const cohort = baseForecast?.cohort;
    // Shared predicate. The activeFilter XOR cohort branching is preserved
    // exactly: when the user has chosen a scope, activeFilter is the SOLE
    // authority. ANDing it with baseForecast.cohort empties the result set for
    // any segment the loaded forecast was not built for -- see the note above.
    //
    // The tariff dimensions here are the +97.7% fix (Corporate/Mobile Voice/
    // Direct/RED S read 75,468 against 1,693 every month while the actuals were
    // aggregated tariff-blind). Guarded now by npm run traps, trap A.
    const scopeCols = {
      segment: wiSegmentCol, product: wiProductCol, productL2: wiProductL2Col,
      channel: wiChannelCol, channelL2: wiChannelL2Col,
      tariffL1: wiTariffL1Col, tariffL2: wiTariffL2Col,
    };
    const filterScope = activeFilter ? {
      segment: activeFilter.segment,
      product: activeFilter.product.l1, productL2: activeFilter.product.l2,
      channel: activeFilter.channel.l1, channelL2: activeFilter.channel.l2,
      tariffL1: activeFilter.tariff?.l1, tariffL2: activeFilter.tariff?.l2,
    } : null;
    const filteredData = data.filter(row =>
      filterScope ? rowInScope(row, scopeCols, filterScope, ALL_DIMS)
      : cohort ? rowInScope(row, scopeCols, cohort, ALL_DIMS)
      : true);

    filteredData.forEach(row => {
      const rawDate = row[wiDateCol];
      if (!rawDate) return;
      const d = rawDate instanceof Date ? rawDate : new Date(rawDate);
      if (!isValid(d)) return;
      const month = format(d, 'yyyy-MM');

      if (!map.has(month)) {
        map.set(month, {
          inflow: 0, outflow: 0, retention: 0, base: null,
          arpuSubVol: 0, revSum: 0,
          inflowRev: 0, inflowSubVol: 0,
          outflowRev: 0, outflowSubVol: 0,
          retentionRev: 0, retentionSubVol: 0,
          baseRev: 0, baseSubVol: 0,
        });
      }
      const e = map.get(month)!;

      const metric = wiMetricCol ? String(row[wiMetricCol]) : '';
      const val = Number(row[wiValueCol]) || 0;
      const rev  = wiRevenueCol ? (Number(row[wiRevenueCol]) || 0) : 0;
      const arpu = wiArpuCol   ? (Number(row[wiArpuCol])    || 0) : 0;
      const revVal = rev || (arpu * val);

      if (wiInflowVal && metric === wiInflowVal) {
        e.inflow += val;
        e.inflowSubVol += val; e.inflowRev += revVal;
        e.arpuSubVol += val; e.revSum += revVal;
      } else if (wiOutflowVal && metric === wiOutflowVal) {
        e.outflow += val;
        e.outflowSubVol += val; e.outflowRev += revVal;
        e.arpuSubVol += val; e.revSum += revVal;
      } else if (wiRetentionVal && metric === wiRetentionVal) {
        e.retention += val;
        e.retentionSubVol += val; e.retentionRev += revVal;
        e.arpuSubVol += val; e.revSum += revVal;
      } else if (wiBaseVal && metric === wiBaseVal) {
        e.base = (e.base ?? 0) + val;
        e.baseSubVol += val; e.baseRev += revVal;
        e.arpuSubVol += val; e.revSum += revVal;
      }
    });

    return map;
  }, [data, wiDateCol, wiMetricCol, wiValueCol, wiInflowVal, wiOutflowVal, wiRetentionVal, wiBaseVal, wiArpuCol, wiRevenueCol, baseForecast, wiSegmentCol, wiProductCol, wiProductL2Col, wiChannelCol, wiChannelL2Col, wiTariffL1Col, wiTariffL2Col, activeFilter]);

  // ---------------------------------------------------------------------------
  // 2. Per-cohort actuals per month — keyed by the full seg|prod|chan triple.
  //    Intentionally UNFILTERED: includes every cohort present in the dataset.
  //    The Historical Accuracy table must always show all cohorts that have
  //    actuals aligning with the loaded forecast, regardless of filter bar state.
  //    Proportional scaling in buildCohortAccuracy uses aggrSnapshotMap
  //    (baseForecast.cohort scope) as the denominator, so cohorts outside that
  //    scope produce null metrics and are excluded by the validity filter below.
  // ---------------------------------------------------------------------------
  const cohortActualsMap = useMemo(() => {
    const map = new Map<string, Map<string, CohortMonthEntry>>();

    if (!data.length || !wiDateCol || !wiSegmentCol) return map;

    data.forEach(row => {
      const rawDate = row[wiDateCol];
      if (!rawDate) return;
      const d = rawDate instanceof Date ? rawDate : new Date(rawDate);
      if (!isValid(d)) return;
      const month = format(d, 'yyyy-MM');

      const seg    = String(row[wiSegmentCol] || 'Unknown').trim();
      const prod   = wiProductCol  ? String(row[wiProductCol]  || 'Unknown').trim() : '—';
      const prodL2 = wiProductL2Col ? String(row[wiProductL2Col] || 'All').trim()    : 'All';
      const chan    = wiChannelCol  ? String(row[wiChannelCol]   || 'Unknown').trim() : '—';
      const chanL2  = wiChannelL2Col ? String(row[wiChannelL2Col]  || 'All').trim()   : 'All';
      const tarL1   = wiTariffL1Col ? String(row[wiTariffL1Col]   || 'All').trim()    : 'All';
      const tarL2   = wiTariffL2Col ? String(row[wiTariffL2Col]   || 'All').trim()    : 'All';
      // Full 7-part key — cohortAccuracy groups dynamically from these entries.
      const cohortKey = `${seg}|${prod}|${prodL2 || 'All'}|${chan}|${chanL2 || 'All'}|${tarL1 || 'All'}|${tarL2 || 'All'}`;

      if (!map.has(cohortKey)) map.set(cohortKey, new Map());
      const cohortMonthMap = map.get(cohortKey)!;
      if (!cohortMonthMap.has(month)) cohortMonthMap.set(month, {
        inflow: 0, outflow: 0, retention: 0, base: null, arpu: 0, arpuRevSum: 0, arpuSubVol: 0,
        inflowArpu: 0, outflowArpu: 0, retentionArpu: 0, baseArpu: 0,
        inflowRev: 0, inflowSubVol: 0,
        outflowRev: 0, outflowSubVol: 0,
        retentionRev: 0, retentionSubVol: 0,
        baseRev: 0, baseSubVol: 0,
      });
      const e = cohortMonthMap.get(month)!;

      const metric = wiMetricCol ? String(row[wiMetricCol]) : '';
      const val = Number(row[wiValueCol]) || 0;
      const rev  = wiRevenueCol ? (Number(row[wiRevenueCol]) || 0) : 0;
      const arpu = wiArpuCol   ? (Number(row[wiArpuCol])    || 0) : 0;
      const revVal = rev || (arpu * val);

      if (wiInflowVal && metric === wiInflowVal) {
        e.inflow += val;
        e.inflowSubVol += val; e.inflowRev += revVal;
        e.arpuSubVol += val; e.arpuRevSum += revVal;
      } else if (wiOutflowVal && metric === wiOutflowVal) {
        e.outflow += val;
        e.outflowSubVol += val; e.outflowRev += revVal;
        e.arpuSubVol += val; e.arpuRevSum += revVal;
      } else if (wiRetentionVal && metric === wiRetentionVal) {
        e.retention += val;
        e.retentionSubVol += val; e.retentionRev += revVal;
        e.arpuSubVol += val; e.arpuRevSum += revVal;
      } else if (wiBaseVal && metric === wiBaseVal) {
        e.base = (e.base ?? 0) + val;
        e.baseSubVol += val; e.baseRev += revVal;
        e.arpuSubVol += val; e.arpuRevSum += revVal;
      }
    });

    // Finalise ARPU: blended and per-scenario
    for (const cohortMonthMap of map.values()) {
      for (const e of cohortMonthMap.values()) {
        e.arpu          = e.arpuSubVol > 0 && e.arpuRevSum > 0 ? e.arpuRevSum / e.arpuSubVol : 0;
        e.inflowArpu    = e.inflowSubVol > 0 && e.inflowRev > 0 ? e.inflowRev / e.inflowSubVol : 0;
        e.outflowArpu   = e.outflowSubVol > 0 && e.outflowRev > 0 ? e.outflowRev / e.outflowSubVol : 0;
        e.retentionArpu = e.retentionSubVol > 0 && e.retentionRev > 0 ? e.retentionRev / e.retentionSubVol : 0;
        e.baseArpu      = e.baseSubVol > 0 && e.baseRev > 0 ? e.baseRev / e.baseSubVol : 0;
      }
    }

    return map;
  }, [data, wiDateCol, wiMetricCol, wiValueCol, wiInflowVal, wiOutflowVal, wiRetentionVal, wiBaseVal, wiArpuCol, wiRevenueCol, wiSegmentCol, wiProductCol, wiProductL2Col, wiChannelCol, wiChannelL2Col, wiTariffL1Col, wiTariffL2Col]);

  // ---------------------------------------------------------------------------
  // 3. Build month-by-month comparison rows
  // ---------------------------------------------------------------------------
  const { comparisonRows, derivedBaseline, derivedAdjusted } = useMemo(() => {
    if (!baseForecast) return { comparisonRows: [], derivedBaseline: [] as { month: string; base: number }[], derivedAdjusted: [] as { month: string; base: number }[] };

    const seed = baseForecast.seedBaseVolume;
    let bBase = seed;
    let aBase = seed;

    let prevBlInflow = baseForecast.lastHistoricalInflow;
    let prevBlOutflow = baseForecast.lastHistoricalOutflow;
    let prevAdjInflow = baseForecast.lastHistoricalInflow;
    let prevAdjOutflow = baseForecast.lastHistoricalOutflow;

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

      // Advance lagged values for next iteration
      prevBlInflow = blInflow;
      prevBlOutflow = blOutflow;
      prevAdjInflow = adjInflow;
      prevAdjOutflow = adjOutflow;

      const blArpu = bm.arpu.mean;
      const adjArpu = am ? am.uplifted.arpu : blArpu;
      // ARPU actual: volume-weighted rev/subVol matching App.tsx ibroMap formula
      const actArpu = act
        ? (act.arpuSubVol > 0 && act.revSum > 0 ? act.revSum / act.arpuSubVol : null)
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
        // Base is read directly from actuals — never derived.
        actual: act ? {
          inflow: act.inflow,
          outflow: act.outflow,
          retention: act.retention,
          arpu: actArpu,
          base: act.base,
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

  // aggrSnapshotMap — derived from actualsAggrMap (baseForecast.cohort scope, including L2).
  // Used ONLY by chartData for proportional scaling of forecast lines against the exact
  // same cohort that was forecasted.
  const aggrSnapshotMap = useMemo((): Map<string, AggrSnapshot> => {
    const map = new Map<string, AggrSnapshot>();
    for (const [month, bucket] of actualsAggrMap.entries()) {
      map.set(month, { inflow: bucket.inflow, outflow: bucket.outflow, retention: bucket.retention });
    }
    return map;
  }, [actualsAggrMap]);

  // broadAggrSnapshotMap — like aggrSnapshotMap but scoped only to segment + L1 product +
  // L1 channel, ignoring any L2 specificity of the loaded baseForecast.
  // Used by buildCohortAccuracy so that sub-cohort L2 rows share a meaningful
  // denominator even when the baseForecast was generated for an L2-specific cohort.
  const broadAggrSnapshotMap = useMemo((): Map<string, AggrSnapshot> => {
    if (!data.length || !wiDateCol) return aggrSnapshotMap;
    const cohort = baseForecast?.cohort;
    // If no L2 specificity on the cohort, the narrow map already works — reuse it.
    //
    // NOTE: this early return is the recorded defect (EXPECTED.md §16b) —
    // aggrSnapshotMap is activeFilter-scoped, so cohorts without L2 specificity
    // get a denominator that moves with someone else's filter. Removing it
    // unconditionally was tried and REVERTED: it made 20 of 25 cohorts score
    // 0/0/0/0, because one L1 denominator taken from the loaded forecast cannot
    // serve rows from other segments. The real fix is a per-cohort denominator
    // keyed by each row's own L1 ancestry, tracked separately.
    const hasL2 = cohort && (
      (cohort.productL2 && cohort.productL2 !== 'All') ||
      (cohort.channelL2 && cohort.channelL2 !== 'All')
    );
    if (!hasL2) return aggrSnapshotMap;

    // Re-aggregate filtered to baseForecast.cohort L1 scope only (no activeFilter).
    // broadAggrSnapshotMap is the share denominator for buildCohortAccuracy which
    // shows ALL cohorts regardless of the active filter.  Including activeFilter here
    // would make the denominator inconsistent with cohortActualsMap (which is also
    // unfiltered by activeFilter), producing garbage share ratios → MAPE = 0.
    type Bucket = { inflow: number; outflow: number; retention: number };
    const map = new Map<string, Bucket>();
    // Shared predicate, L1_ONLY. The L2 stripping is deliberate and is exactly
    // why the predicate takes a ScopeDims argument rather than always comparing
    // seven fields — see src/utils/cohortScope.ts.
    //
    // TARIFF IS ALSO EXCLUDED, and that is NOT covered by the "strip L2" intent.
    // It was never added when the tariff dimension landed. Preserved here
    // deliberately so this conversion is measurable as behaviour-identical.
    // Whether to include tariffL1 is a separate question with its own numbers:
    // tariff is collinear with product/channel in this data, and narrowing the
    // BROAD denominator is exactly what the comment above warns against.
    const broadCols = { segment: wiSegmentCol, product: wiProductCol, channel: wiChannelCol };
    const filteredData = data.filter(row =>
      !cohort || rowInScope(row, broadCols, cohort, L1_ONLY));
    filteredData.forEach(row => {
      const rawDate = row[wiDateCol];
      if (!rawDate) return;
      const d = rawDate instanceof Date ? rawDate : new Date(rawDate);
      if (!isValid(d)) return;
      const month = format(d, 'yyyy-MM');
      if (!map.has(month)) map.set(month, { inflow: 0, outflow: 0, retention: 0 });
      const e = map.get(month)!;
      const metric = wiMetricCol ? String(row[wiMetricCol]) : '';
      const val = Number(row[wiValueCol]) || 0;
      if (wiInflowVal && metric === wiInflowVal) e.inflow += val;
      else if (wiOutflowVal && metric === wiOutflowVal) e.outflow += val;
      else if (wiRetentionVal && metric === wiRetentionVal) e.retention += val;
    });
    return map;
  }, [data, wiDateCol, wiMetricCol, wiValueCol, wiInflowVal, wiOutflowVal, wiRetentionVal,
      baseForecast, wiSegmentCol, wiProductCol, wiChannelCol, aggrSnapshotMap]);

  // Adjusted mean map — month → { inflow, outflow, retention, arpu } using uplifted values.
  // Built from adjustedForecast when useAdjustedScoring is true; undefined otherwise.
  const adjustedMeanMap = useMemo((): AdjustedMeanMap | undefined => {
    if (!useAdjustedScoring || !adjustedForecast) return undefined;
    const map: AdjustedMeanMap = new Map();
    for (const am of adjustedForecast.adjustedMonths) {
      map.set(am.month, {
        inflow:    am.uplifted.inflow,
        outflow:   am.uplifted.outflow,
        retention: am.uplifted.retention,
        arpu:      am.uplifted.arpu,
      });
    }
    return map;
  }, [useAdjustedScoring, adjustedForecast]);

  // Forecast vs Actuals tab — driven by cohortDims.
  // Uses aggrSnapshotMap (baseForecast.cohort scope) as the proportional-scaling
  // denominator.  Cohorts outside the forecast scope produce null metrics and are
  // filtered out by the validity check inside buildCohortAccuracy.
  const cohortAccuracy = useMemo(
    () => baseForecast ? buildCohortAccuracy(cohortActualsMap, broadAggrSnapshotMap, baseForecast, cohortDims, forecastStore, adjustedMeanMap) : [],
    [baseForecast, cohortActualsMap, broadAggrSnapshotMap, cohortDims, forecastStore, adjustedMeanMap],
  );

  // When dims change the selected key may not exist in the new grouping — falls back to null.
  const selectedCohortRow = selectedForecastCohortKey
    ? (cohortAccuracy.find(c => c.cohortKey === selectedForecastCohortKey) ?? null)
    : null;

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

    // When a cohort row is selected, look up its specific forecast in forecastStore.
    // If found, use it directly (no share-scaling). This gives accurate per-cohort
    // forecast lines instead of a proportional approximation.
    const cohortForecastKey = selectedCohortRow
      ? [
          selectedCohortRow.seg,
          cohortDims.product   ? selectedCohortRow.prod   : 'All',
          cohortDims.productL2 ? selectedCohortRow.prodL2 : 'All',
          cohortDims.channelL1 ? selectedCohortRow.chan    : 'All',
          cohortDims.channelL2 ? selectedCohortRow.chanL2  : 'All',
          cohortDims.tariffL1  ? selectedCohortRow.tariffL1 : 'All',
          cohortDims.tariffL2  ? selectedCohortRow.tariffL2 : 'All',
        ].join('|')
      : null;
    const cohortSpecificForecast = cohortForecastKey ? (forecastStore.get(cohortForecastKey) ?? null) : null;

    // When no cohort row is selected but activeFilter is set, look up a matching
    // forecast from forecastStore. This ensures the chart forecast line is scoped
    // to the same dimensions as the filtered actuals (which respect activeFilter).
    // Without this, the forecast stays at the broad baseForecast scope while actuals
    // narrow to the filter — causing a visible scale mismatch.
    const filterForecast = (() => {
      if (selectedCohortRow || !activeFilter) return null;
      const seg    = activeFilter.segment && activeFilter.segment !== 'All' ? activeFilter.segment : 'All';
      const prod   = activeFilter.product.l1 || 'All';
      const prodL2 = activeFilter.product.l2 || 'All';
      const chan    = activeFilter.channel.l1 || 'All';
      const chanL2  = activeFilter.channel.l2 || 'All';
      const tarL1   = activeFilter.tariff?.l1 || 'All';
      const tarL2   = activeFilter.tariff?.l2 || 'All';
      return forecastStore.get(`${seg}|${prod}|${prodL2}|${chan}|${chanL2}|${tarL1}|${tarL2}`) ?? null;
    })();

    // Effective specific forecast: cohort selection takes priority over filter lookup.
    const specificForecast = cohortSpecificForecast ?? filterForecast;

    // Build a per-month cohort share map for flow metrics — only used when no direct forecast.
    const scalableKpi = (selectedKpi === 'inflow' || selectedKpi === 'outflow' || selectedKpi === 'retention')
      ? selectedKpi : null;

    // Build a per-month cohort share map — only needed when no direct forecast is available.
    let cohortShareMap: Map<string, number> | null = null;
    if (cohortMonthMap && scalableKpi && !specificForecast) {
      const kpi = scalableKpi;
      const shares: number[] = [];
      const sm = new Map<string, number>();
      const allMonths = [
        ...(baseForecast?.historicalMonths ?? []),
        ...(baseForecast?.months.map(bm => bm.month) ?? []),
      ];
      for (const month of allMonths) {
        const cohortVal = cohortMonthMap.get(month)?.[kpi] ?? 0;
        // broadAggrSnapshotMap, not aggrSnapshotMap: the numerator (cohortMonthMap)
        // is unfiltered, so a filter-scoped denominator makes the share depend on
        // what someone else is filtered to. Same denominator buildCohortAccuracy
        // uses, so the chart and the accuracy tooltip cannot disagree.
        const aggrSnap  = broadAggrSnapshotMap.get(month);
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

    // For the 'base' KPI when a cohort is selected: read directly from actuals.
    const cohortBaseActualMap = (() => {
      if (!cohortMonthMap || selectedKpi !== 'base') return null;
      const map = new Map<string, number>();
      for (const [month, entry] of cohortMonthMap.entries()) {
        if (entry.base !== null) map.set(month, entry.base);
      }
      return map;
    })();

    // For the 'base' KPI when no direct forecast: scale aggregate by inflow share.
    const baseShareForChart = (() => {
      if (!cohortMonthMap || selectedKpi !== 'base' || specificForecast) return null;
      const inflowShares: number[] = [];
      for (const [month, entry] of cohortMonthMap.entries()) {
        // Broad denominator — see cohortShareMap above.
        const aggrSnap = broadAggrSnapshotMap.get(month);
        if (!aggrSnap || aggrSnap.inflow === 0 || entry.inflow === 0) continue;
        inflowShares.push(entry.inflow / aggrSnap.inflow);
      }
      if (!inflowShares.length) return null;
      return inflowShares.reduce((s, v) => s + v, 0) / inflowShares.length;
    })();

    // NOT moved to broadAggrSnapshotMap, and this is a known gap rather than an
    // oversight: AggrSnapshot is { inflow, outflow, retention } and carries no
    // revenue/volume, so an ARPU denominator cannot be read from it. Widening
    // that type also widens buildCohortAccuracy's signature, so it is deliberately
    // out of scope here. This ratio therefore still uses the activeFilter-scoped
    // actualsAggrMap and retains the same class of defect the broad map just
    // fixed for the flow metrics. Tracked in EXPECTED.md §16b.
    // ARPU ratio scale — when a cohort is selected but no specific forecast found,
    // scale the aggregate ARPU by the historical cohort/aggregate ARPU ratio.
    // Mirrors the flow-metric share-scaling approach for ARPU so that cohorts
    // with above/below-average ARPU (e.g., "High Value" ~36 vs aggregate ~20)
    // don't produce a visible scale mismatch against the aggregate forecast line.
    const arpuScaleRatio = (() => {
      if (!cohortMonthMap || specificForecast) return null;
      const ratios: number[] = [];
      for (const [month, entry] of cohortMonthMap.entries()) {
        const aggrBucket = actualsAggrMap.get(month);
        if (!aggrBucket || aggrBucket.arpuSubVol === 0 || aggrBucket.revSum === 0) continue;
        const aggrArpu = aggrBucket.revSum / aggrBucket.arpuSubVol;
        if (aggrArpu === 0 || entry.arpu === 0) continue;
        ratios.push(entry.arpu / aggrArpu);
      }
      return ratios.length ? ratios.reduce((a, b) => a + b, 0) / ratios.length : null;
    })();

    // Build month → forecast band lookup (specificFcMonthMap).
    // If we have an exact BaseForecast, use it directly.  Otherwise aggregate all
    // matching sub-cohort forecasts from forecastStore so the chart forecast line
    // reflects the correct summed scale (e.g. "MNC" = sum of all MNC cohorts).
    type FcBand  = { mean: number; optimistic: number; pessimistic: number };
    type FcMonth = { month: string; inflow: FcBand; outflow: FcBand; retention: FcBand; arpu: FcBand };

    // _matchFcs is set by the IIFE below; used afterward to build synActualsMap.
    const { specificFcMonthMap, fcSeedBase, fcLastIn, fcLastOut, _matchFcs } = (() => {
      const noFcs: BaseForecast[] = [];
      if (specificForecast) {
        return {
          specificFcMonthMap: new Map(specificForecast.months.map(m => [m.month, m as FcMonth])),
          fcSeedBase: specificForecast.seedBaseVolume,
          fcLastIn:   specificForecast.lastHistoricalInflow,
          fcLastOut:  specificForecast.lastHistoricalOutflow,
          _matchFcs: noFcs,
        };
      }

      // Determine scope for aggregation (selectedCohortRow dims or activeFilter dims)
      const seg    = selectedCohortRow ? selectedCohortRow.seg
                   : (activeFilter?.segment && activeFilter.segment !== 'All' ? activeFilter.segment : null);
      const prod   = selectedCohortRow
        ? (cohortDims.product   && selectedCohortRow.prod   !== 'All' ? selectedCohortRow.prod   : null)
        : (activeFilter?.product.l1 ?? null);
      const prodL2 = selectedCohortRow
        ? (cohortDims.productL2 && selectedCohortRow.prodL2 !== 'All' ? selectedCohortRow.prodL2 : null)
        : (activeFilter?.product.l2 ?? null);
      const chan   = selectedCohortRow
        ? (cohortDims.channelL1 && selectedCohortRow.chan   !== 'All' ? selectedCohortRow.chan   : null)
        : (activeFilter?.channel.l1 ?? null);
      const chanL2 = selectedCohortRow
        ? (cohortDims.channelL2 && selectedCohortRow.chanL2 !== 'All' ? selectedCohortRow.chanL2 : null)
        : (activeFilter?.channel.l2 ?? null);
      const tarL1  = selectedCohortRow
        ? (cohortDims.tariffL1 && selectedCohortRow.tariffL1 !== 'All' ? selectedCohortRow.tariffL1 : null)
        : (activeFilter?.tariff?.l1 ?? null);
      const tarL2  = selectedCohortRow
        ? (cohortDims.tariffL2 && selectedCohortRow.tariffL2 !== 'All' ? selectedCohortRow.tariffL2 : null)
        : (activeFilter?.tariff?.l2 ?? null);

      const empty = { specificFcMonthMap: null as null, fcSeedBase: 0, fcLastIn: 0, fcLastOut: 0, _matchFcs: noFcs };
      // Aggregate matching forecasts whenever a scope context exists (cohort row
      // or filter bar). seg === null with activeFilter present means "All
      // segments" — that case must still aggregate the store, otherwise the
      // code falls through to the loaded baseForecast regardless of its scope,
      // mismatching a cohort-scale baseline against aggregate-scale actuals.
      if (!selectedCohortRow && !activeFilter) return empty;

      // Collect all matching forecastStore entries (null dim = wildcard)
      const matchEntries: { key: string; bf: BaseForecast }[] = [];
      for (const [key, bf] of forecastStore.entries()) {
        const p = key.split('|');
        if (seg    && p[0] !== seg)    continue;
        if (prod   && p[1] !== prod)   continue;
        if (prodL2 && p[2] !== prodL2) continue;
        if (chan   && p[3] !== chan)    continue;
        if (chanL2 && p[4] !== chanL2) continue;
        if (tarL1  && p[5] !== tarL1)  continue;
        if (tarL2  && p[6] !== tarL2)  continue;
        matchEntries.push({ key, bf });
      }
      const matchFcs = dedupeContainedForecasts(matchEntries);
      if (!matchFcs.length) return empty;

      // Pre-compute running base stock per bf for revenue-proxy ARPU weighting.
      // Weight = (derivedBase + inflow.mean) matches the denominator used in
      // cohortActualsMap (Base + Inflow volume), so forecast and actual ARPU
      // are on the same scale when aggregating multiple sub-cohort forecasts.
      const bfRunningBase = new Map<BaseForecast, Map<string, number>>();
      for (const bf of matchFcs) {
        const bmap = new Map<string, number>();
        const sortedM = [...bf.months].sort((a, b) => a.month.localeCompare(b.month));
        let b = bf.seedBaseVolume || 0, pIn = bf.lastHistoricalInflow || 0, pOut = bf.lastHistoricalOutflow || 0;
        for (const m of sortedM) {
          b = Math.max(0, b + pIn - pOut);
          bmap.set(m.month, b);
          pIn = m.inflow.mean; pOut = m.outflow.mean;
        }
        bfRunningBase.set(bf, bmap);
      }

      // Build per-month sums (flows additive, ARPU revenue-proxy-weighted)
      const acc = new Map<string, {
        inflow: FcBand; outflow: FcBand; retention: FcBand;
        arpuWm: number; arpuWo: number; arpuWp: number; arpuW: number;
      }>();
      for (const bf of matchFcs) {
        for (const m of bf.months) {
          if (!acc.has(m.month)) acc.set(m.month, {
            inflow:    { mean: 0, optimistic: 0, pessimistic: 0 },
            outflow:   { mean: 0, optimistic: 0, pessimistic: 0 },
            retention: { mean: 0, optimistic: 0, pessimistic: 0 },
            arpuWm: 0, arpuWo: 0, arpuWp: 0, arpuW: 0,
          });
          const e = acc.get(m.month)!;
          e.inflow.mean += m.inflow.mean; e.inflow.optimistic += m.inflow.optimistic; e.inflow.pessimistic += m.inflow.pessimistic;
          e.outflow.mean += m.outflow.mean; e.outflow.optimistic += m.outflow.optimistic; e.outflow.pessimistic += m.outflow.pessimistic;
          e.retention.mean += m.retention.mean; e.retention.optimistic += m.retention.optimistic; e.retention.pessimistic += m.retention.pessimistic;
          const derivedBase = bfRunningBase.get(bf)?.get(m.month) ?? 0;
          const w = derivedBase + m.inflow.mean;
          if (w > 0) { e.arpuWm += m.arpu.mean * w; e.arpuWo += m.arpu.optimistic * w; e.arpuWp += m.arpu.pessimistic * w; e.arpuW += w; }
        }
      }

      const synMap = new Map<string, FcMonth>();
      for (const [month, e] of acc.entries()) {
        const aw = e.arpuW || 1;
        synMap.set(month, {
          month,
          inflow:    e.inflow,
          outflow:   e.outflow,
          retention: e.retention,
          arpu: { mean: e.arpuWm / aw, optimistic: e.arpuWo / aw, pessimistic: e.arpuWp / aw },
        });
      }

      return {
        specificFcMonthMap: synMap as Map<string, FcMonth>,
        fcSeedBase: matchFcs.reduce((s, bf) => s + (bf.seedBaseVolume || 0), 0),
        fcLastIn:   matchFcs.reduce((s, bf) => s + bf.lastHistoricalInflow, 0),
        fcLastOut:  matchFcs.reduce((s, bf) => s + bf.lastHistoricalOutflow, 0),
        _matchFcs: matchFcs,
      };
    })();

    // When the forecast was assembled by aggregating sub-cohort entries from
    // forecastStore (not an exact filterForecast hit), constrain the actuals to
    // the same cohort coverage so both chart lines are at the same scale.
    //
    // Example: activeFilter = Corporate/All/All but only Corporate|Mobile Data|Direct
    // exists in forecastStore → without this, actuals = all Corporate while the
    // forecast line = Mobile Data/Direct only → visible mis-alignment.
    //
    // Built from cohortActualsMap (already aggregated) to avoid re-scanning raw data.
    type SynActBucket = { inflow: number; outflow: number; retention: number; base: number | null; arpuSubVol: number; revSum: number };
    const synActualsMap = (() => {
      // Not needed when: an exact forecast covers the full activeFilter scope,
      // a cohort row is selected (uses cohortMonthMap directly), or no matches.
      if (specificForecast || !_matchFcs.length || cohortMonthMap) return null;
      const amap = new Map<string, SynActBucket>();
      for (const [key, mMap] of cohortActualsMap.entries()) {
        const [kSeg, kProd, kProdL2, kChan, kChanL2, kTariffL1, kTariffL2] = key.split('|');
        // Include this cohortActualsMap entry if it falls within ANY matched forecast's scope
        const matched = _matchFcs.some(bf => {
          const c = bf.cohort;
          if (c.segment  !== 'All' && c.segment  !== kSeg)   return false;
          if (c.product  !== 'All' && c.product  !== kProd)  return false;
          if (c.productL2 && c.productL2 !== 'All' && c.productL2 !== kProdL2) return false;
          if (c.channel  !== 'All' && c.channel  !== kChan)  return false;
          if (c.channelL2 && c.channelL2 !== 'All' && c.channelL2 !== kChanL2) return false;
          if (c.tariffL1 && c.tariffL1 !== 'All' && c.tariffL1 !== kTariffL1) return false;
          if (c.tariffL2 && c.tariffL2 !== 'All' && c.tariffL2 !== kTariffL2) return false;
          return true;
        });
        if (!matched) continue;
        for (const [month, entry] of mMap.entries()) {
          if (!amap.has(month)) amap.set(month, { inflow: 0, outflow: 0, retention: 0, base: null, arpuSubVol: 0, revSum: 0 });
          const e = amap.get(month)!;
          e.inflow     += entry.inflow;
          e.outflow    += entry.outflow;
          e.retention  += entry.retention;
          if (entry.base !== null) e.base = (e.base ?? 0) + entry.base;
          e.arpuSubVol += entry.arpuSubVol;
          e.revSum     += entry.arpuRevSum;
        }
      }
      return amap.size > 0 ? amap : null;
    })();

    // Derived base running stock from the aggregated (or exact) forecast
    const specificFcBaseMap = (() => {
      if (!specificFcMonthMap || selectedKpi !== 'base') return null;
      const months = [...specificFcMonthMap.values()].sort((a, b) => a.month.localeCompare(b.month));
      const map = new Map<string, number>();
      let b = fcSeedBase, prevIn = fcLastIn, prevOut = fcLastOut;
      for (const m of months) {
        b = Math.max(0, b + prevIn - prevOut);
        map.set(m.month, b);
        prevIn = m.inflow.mean;
        prevOut = m.outflow.mean;
      }
      return map;
    })();

    // Returns the actual value for `month` from either the cohort or the aggregate map.
    const getActualVal = (month: string): number | undefined => {
      if (cohortMonthMap) {
        if (selectedKpi === 'base') {
          const val = cohortBaseActualMap?.get(month);
          return val !== undefined ? val : undefined;
        }
        const entry = cohortMonthMap.get(month);
        if (!entry) return undefined;
        if (selectedKpi === 'inflow')     return entry.inflow    || undefined;
        if (selectedKpi === 'outflow')    return entry.outflow   || undefined;
        if (selectedKpi === 'retention')  return entry.retention || undefined;
        if (selectedKpi === 'arpu')       return entry.arpu      || undefined;
        return undefined;
      }
      // Use synActualsMap when available — it's scoped to the same cohort coverage as
      // the chart forecast line, preventing scale mis-alignment when activeFilter is
      // broader than the available forecasts (e.g. All products but only one sub-cohort
      // forecast exists). Falls back to actualsAggrMap for exact-match or default cases.
      const act = (synActualsMap ?? actualsAggrMap).get(month);
      if (!act) return undefined;
      if (selectedKpi === 'inflow')     return act.inflow;
      if (selectedKpi === 'outflow')    return act.outflow;
      if (selectedKpi === 'retention')  return act.retention;
      if (selectedKpi === 'base')       return act.base ?? undefined;
      if (selectedKpi === 'arpu')       return act.arpuSubVol > 0 && act.revSum > 0 ? act.revSum / act.arpuSubVol : undefined;
      return undefined;
    };

    const histRows = histMonths.map(month => ({
      month,
      actual: getActualVal(month),
      baseline: undefined, adjusted: undefined, optimistic: undefined,
      pessimistic: undefined, prevBaseline: undefined, variance: undefined,
    }));

    const switchMonth = modelSwitchPoint?.month ?? null;

    // Guard the raw-baseForecast fallback: when the view is scoped by the
    // filter bar (no cohort selected) the loaded forecast may belong to a
    // different cohort entirely — comparing it unscaled against the scoped
    // actuals produces nonsense variances (e.g. +99.9% on every month).
    // Cohort rows keep the documented share-scaling approximation; an
    // unfiltered view is already scoped to baseForecast.cohort by
    // actualsAggrMap, so both remain valid fallback consumers.
    const aggregateFallbackOk = cohortMonthMap !== null
      || !activeFilter
      || (baseForecast ? cohortMatchesFilter(baseForecast.cohort, activeFilter) : false);

    const fcRows = comparisonRows.map(row => {
      let baseline: number | undefined;
      let optimistic: number | undefined;
      let pessimistic: number | undefined;
      let adjusted: number | undefined;

      if (specificFcMonthMap) {
        // Use specific forecast directly (cohort row selected or filter matched) — no scaling needed
        const cfm = specificFcMonthMap.get(row.month);
        if (cfm) {
          if (selectedKpi === 'inflow') {
            baseline = cfm.inflow.mean; optimistic = cfm.inflow.optimistic; pessimistic = cfm.inflow.pessimistic;
          } else if (selectedKpi === 'outflow') {
            baseline = cfm.outflow.mean; optimistic = cfm.outflow.optimistic; pessimistic = cfm.outflow.pessimistic;
          } else if (selectedKpi === 'retention') {
            baseline = cfm.retention.mean; optimistic = cfm.retention.optimistic; pessimistic = cfm.retention.pessimistic;
          } else if (selectedKpi === 'arpu') {
            baseline = cfm.arpu.mean; optimistic = cfm.arpu.optimistic; pessimistic = cfm.arpu.pessimistic;
          } else if (selectedKpi === 'base') {
            baseline = specificFcBaseMap?.get(row.month);
          }
          adjusted = usingAdjusted ? baseline : undefined; // adjusted not available for sub-cohort forecasts
        }
      } else if (aggregateFallbackOk) {
        // Fall back to share-scaled aggregate forecast.
        // Flow metrics: scale by per-month cohort share (cohortShareMap).
        // ARPU: scale by historical cohort/aggregate ratio (arpuScaleRatio) — prevents
        //   the mismatch where e.g. "High Value" ARPU (~36) is compared against the
        //   unscaled all-cohorts aggregate forecast ARPU (~20).
        // Base: scale by average inflow share (baseShareForChart).
        const rawBaseline   = getKpiVal(row.baseline, selectedKpi) ?? undefined;
        const rawAdjusted   = usingAdjusted ? (getKpiVal(row.adjusted, selectedKpi) ?? undefined) : undefined;
        const rawOptimistic  = selectedKpi !== 'base' ? (row.baseline[selectedKpi + 'Opt']  ?? undefined) : undefined;
        const rawPessimistic = selectedKpi !== 'base' ? (row.baseline[selectedKpi + 'Pess'] ?? undefined) : undefined;
        const share = selectedKpi === 'base'
          ? (baseShareForChart ?? 1)
          : selectedKpi === 'arpu'
          ? (arpuScaleRatio ?? 1)
          : (cohortShareMap?.get(row.month) ?? 1);
        baseline    = rawBaseline   !== undefined ? rawBaseline   * share : undefined;
        adjusted    = rawAdjusted   !== undefined ? rawAdjusted   * share : undefined;
        optimistic  = rawOptimistic  !== undefined ? rawOptimistic  * share : undefined;
        pessimistic = rawPessimistic !== undefined ? rawPessimistic * share : undefined;
      }

      const actual = getActualVal(row.month);
      const share = specificFcMonthMap ? 1 : (
        selectedKpi === 'base' ? (baseShareForChart ?? 1) :
        selectedKpi === 'arpu' ? (arpuScaleRatio ?? 1) :
        (cohortShareMap?.get(row.month) ?? 1)
      );
      const prevBaseline =
        switchMonth && row.month >= switchMonth
          ? ((prevFcMap.get(row.month) ?? undefined) !== undefined
              ? (prevFcMap.get(row.month)! * share) : undefined)
          : undefined;

      const variance = actual !== undefined && baseline !== undefined ? actual - baseline : undefined;
      return { month: row.month, actual, baseline, adjusted, optimistic, pessimistic, prevBaseline, variance };
    });

    return [...histRows, ...fcRows];
  }, [comparisonRows, baseForecast, actualsAggrMap, aggrSnapshotMap, broadAggrSnapshotMap, selectedKpi, usingAdjusted, prevFcMap, modelSwitchPoint, selectedCohortRow, cohortDims, forecastStore, activeFilter, cohortActualsMap]);

  // ---------------------------------------------------------------------------
  // 5a. Multi-scenario chart data for the new Volume/Value 2-tab chart
  // ---------------------------------------------------------------------------
  type MultiChartRow = {
    month: string;
    inflow_actual?: number; outflow_actual?: number; retention_actual?: number; base_actual?: number;
    inflow_baseline?: number; inflow_opt?: number; inflow_pess?: number;
    outflow_baseline?: number; outflow_opt?: number; outflow_pess?: number;
    retention_baseline?: number; retention_opt?: number; retention_pess?: number;
    base_baseline?: number;
    // Total revenue, for the ARPU/revenue presentation toggle.
    //
    // Deliberately NO _opt / _pess counterparts. An ARPU band multiplied by a
    // volume point estimate is not a confidence interval, and users read bands
    // as tolerances — so revenue has no band at all. Not computing one is
    // stronger than not drawing one: it cannot leak into the Y-axis domain or
    // an "in band" column later, because there is nothing to leak.
    //
    // _actual is the EXACT summed Monthly_Revenue_GBP, not arpu x volume. The
    // accumulator already holds it (act.inflowRev) before dividing it down to a
    // ratio, so re-deriving would fail to reconcile against the source column.
    // _baseline is derived, because the forecast side has no revenue at all.
    inflowRev_actual?: number; outflowRev_actual?: number; retentionRev_actual?: number; baseRev_actual?: number;
    inflowRev_baseline?: number; outflowRev_baseline?: number; retentionRev_baseline?: number; baseRev_baseline?: number;
    inflowArpu_actual?: number; outflowArpu_actual?: number; retentionArpu_actual?: number; baseArpu_actual?: number;
    inflowArpu_baseline?: number; inflowArpu_opt?: number; inflowArpu_pess?: number;
    outflowArpu_baseline?: number; outflowArpu_opt?: number; outflowArpu_pess?: number;
    retentionArpu_baseline?: number; retentionArpu_opt?: number; retentionArpu_pess?: number;
    baseArpu_baseline?: number; baseArpu_opt?: number; baseArpu_pess?: number;
  };

  const multiChartData = useMemo((): MultiChartRow[] => {
    const histMonths = baseForecast?.historicalMonths ?? [];

    // Reuse the same lookup infrastructure as the existing chartData memo
    const cohortMonthMap = selectedCohortRow?.monthMap ?? null;
    const cohortForecastKey = selectedCohortRow
      ? [
          selectedCohortRow.seg,
          cohortDims.product   ? selectedCohortRow.prod   : 'All',
          cohortDims.productL2 ? selectedCohortRow.prodL2 : 'All',
          cohortDims.channelL1 ? selectedCohortRow.chan    : 'All',
          cohortDims.channelL2 ? selectedCohortRow.chanL2  : 'All',
          cohortDims.tariffL1  ? selectedCohortRow.tariffL1 : 'All',
          cohortDims.tariffL2  ? selectedCohortRow.tariffL2 : 'All',
        ].join('|')
      : null;
    const cohortSpecificForecast = cohortForecastKey ? (forecastStore.get(cohortForecastKey) ?? null) : null;
    const filterForecast = (() => {
      if (selectedCohortRow || !activeFilter) return null;
      const seg    = activeFilter.segment && activeFilter.segment !== 'All' ? activeFilter.segment : 'All';
      const prod   = activeFilter.product.l1 || 'All';
      const prodL2 = activeFilter.product.l2 || 'All';
      const chan    = activeFilter.channel.l1 || 'All';
      const chanL2  = activeFilter.channel.l2 || 'All';
      const tarL1   = activeFilter.tariff?.l1 || 'All';
      const tarL2   = activeFilter.tariff?.l2 || 'All';
      return forecastStore.get(`${seg}|${prod}|${prodL2}|${chan}|${chanL2}|${tarL1}|${tarL2}`) ?? null;
    })();
    const specificForecast = cohortSpecificForecast ?? filterForecast;

    // Build specificFcMonthMap (same logic as chartData)
    type FcBand  = { mean: number; optimistic: number; pessimistic: number };
    type FcMonthEx = {
      month: string;
      inflow: FcBand; outflow: FcBand; retention: FcBand; arpu: FcBand;
      inflowArpu?: FcBand; outflowArpu?: FcBand; retentionArpu?: FcBand; baseArpu?: FcBand;
    };
    let specificFcMonthMap: Map<string, FcMonthEx> | null = null;
    let fcSeedBase = 0, fcLastIn = 0, fcLastOut = 0;
    let _matchFcs: BaseForecast[] = [];

    if (specificForecast) {
      specificFcMonthMap = new Map(specificForecast.months.map(m => [m.month, m as FcMonthEx]));
      fcSeedBase = specificForecast.seedBaseVolume;
      fcLastIn   = specificForecast.lastHistoricalInflow;
      fcLastOut  = specificForecast.lastHistoricalOutflow;
    } else {
      const seg    = selectedCohortRow ? selectedCohortRow.seg
                   : (activeFilter?.segment && activeFilter.segment !== 'All' ? activeFilter.segment : null);
      const prod   = selectedCohortRow
        ? (cohortDims.product   && selectedCohortRow.prod   !== 'All' ? selectedCohortRow.prod   : null)
        : (activeFilter?.product.l1 ?? null);
      const prodL2 = selectedCohortRow
        ? (cohortDims.productL2 && selectedCohortRow.prodL2 !== 'All' ? selectedCohortRow.prodL2 : null)
        : (activeFilter?.product.l2 ?? null);
      const chan   = selectedCohortRow
        ? (cohortDims.channelL1 && selectedCohortRow.chan   !== 'All' ? selectedCohortRow.chan   : null)
        : (activeFilter?.channel.l1 ?? null);
      const chanL2 = selectedCohortRow
        ? (cohortDims.channelL2 && selectedCohortRow.chanL2 !== 'All' ? selectedCohortRow.chanL2 : null)
        : (activeFilter?.channel.l2 ?? null);
      const tarL1  = selectedCohortRow
        ? (cohortDims.tariffL1 && selectedCohortRow.tariffL1 !== 'All' ? selectedCohortRow.tariffL1 : null)
        : (activeFilter?.tariff?.l1 ?? null);
      const tarL2  = selectedCohortRow
        ? (cohortDims.tariffL2 && selectedCohortRow.tariffL2 !== 'All' ? selectedCohortRow.tariffL2 : null)
        : (activeFilter?.tariff?.l2 ?? null);

      // Aggregate matching forecasts whenever a scope context exists (cohort
      // row or filter bar). seg === null with activeFilter present means "All
      // segments" — that case must still aggregate the store, otherwise the
      // code falls through to the loaded baseForecast regardless of its scope,
      // mismatching a cohort-scale baseline against aggregate-scale actuals.
      if (selectedCohortRow || activeFilter) {
        const matchEntries: { key: string; bf: BaseForecast }[] = [];
        for (const [key, bf] of forecastStore.entries()) {
          const p = key.split('|');
          if (seg    && p[0] !== seg)    continue;
          if (prod   && p[1] !== prod)   continue;
          if (prodL2 && p[2] !== prodL2) continue;
          if (chan   && p[3] !== chan)    continue;
          if (chanL2 && p[4] !== chanL2) continue;
          if (tarL1  && p[5] !== tarL1)  continue;
          if (tarL2  && p[6] !== tarL2)  continue;
          matchEntries.push({ key, bf });
        }
        const matchFcs = dedupeContainedForecasts(matchEntries);
        _matchFcs = matchFcs;

        if (matchFcs.length) {
          // Build running base per bf
          const bfRunningBase = new Map<BaseForecast, Map<string, number>>();
          for (const bf of matchFcs) {
            const bmap = new Map<string, number>();
            const sortedM = [...bf.months].sort((a, b) => a.month.localeCompare(b.month));
            let b = bf.seedBaseVolume || 0, pIn = bf.lastHistoricalInflow || 0, pOut = bf.lastHistoricalOutflow || 0;
            for (const m of sortedM) {
              b = Math.max(0, b + pIn - pOut);
              bmap.set(m.month, b);
              pIn = m.inflow.mean; pOut = m.outflow.mean;
            }
            bfRunningBase.set(bf, bmap);
          }

          // Aggregate
          const acc = new Map<string, {
            inflow: FcBand; outflow: FcBand; retention: FcBand;
            arpuWm: number; arpuWo: number; arpuWp: number; arpuW: number;
            inflowArpuWm: number; inflowArpuWo: number; inflowArpuWp: number;
            outflowArpuWm: number; outflowArpuWo: number; outflowArpuWp: number;
            retentionArpuWm: number; retentionArpuWo: number; retentionArpuWp: number;
            baseArpuWm: number; baseArpuWo: number; baseArpuWp: number;
          }>();
          for (const bf of matchFcs) {
            for (const m of bf.months) {
              if (!acc.has(m.month)) acc.set(m.month, {
                inflow:    { mean: 0, optimistic: 0, pessimistic: 0 },
                outflow:   { mean: 0, optimistic: 0, pessimistic: 0 },
                retention: { mean: 0, optimistic: 0, pessimistic: 0 },
                arpuWm: 0, arpuWo: 0, arpuWp: 0, arpuW: 0,
                inflowArpuWm: 0, inflowArpuWo: 0, inflowArpuWp: 0,
                outflowArpuWm: 0, outflowArpuWo: 0, outflowArpuWp: 0,
                retentionArpuWm: 0, retentionArpuWo: 0, retentionArpuWp: 0,
                baseArpuWm: 0, baseArpuWo: 0, baseArpuWp: 0,
              });
              const e = acc.get(m.month)!;
              e.inflow.mean += m.inflow.mean; e.inflow.optimistic += m.inflow.optimistic; e.inflow.pessimistic += m.inflow.pessimistic;
              e.outflow.mean += m.outflow.mean; e.outflow.optimistic += m.outflow.optimistic; e.outflow.pessimistic += m.outflow.pessimistic;
              e.retention.mean += m.retention.mean; e.retention.optimistic += m.retention.optimistic; e.retention.pessimistic += m.retention.pessimistic;
              const derivedBase = bfRunningBase.get(bf)?.get(m.month) ?? 0;
              const w = derivedBase + m.inflow.mean;
              if (w > 0) { e.arpuWm += m.arpu.mean * w; e.arpuWo += m.arpu.optimistic * w; e.arpuWp += m.arpu.pessimistic * w; e.arpuW += w; }
              const wi = m.inflow.mean; if (wi > 0 && m.inflowArpu) { e.inflowArpuWm += m.inflowArpu.mean * wi; e.inflowArpuWo += m.inflowArpu.optimistic * wi; e.inflowArpuWp += m.inflowArpu.pessimistic * wi; }
              const wo = m.outflow.mean; if (wo > 0 && m.outflowArpu) { e.outflowArpuWm += m.outflowArpu.mean * wo; e.outflowArpuWo += m.outflowArpu.optimistic * wo; e.outflowArpuWp += m.outflowArpu.pessimistic * wo; }
              const wr = m.retention.mean; if (wr > 0 && m.retentionArpu) { e.retentionArpuWm += m.retentionArpu.mean * wr; e.retentionArpuWo += m.retentionArpu.optimistic * wr; e.retentionArpuWp += m.retentionArpu.pessimistic * wr; }
              if (derivedBase > 0 && m.baseArpu) { e.baseArpuWm += m.baseArpu.mean * derivedBase; e.baseArpuWo += m.baseArpu.optimistic * derivedBase; e.baseArpuWp += m.baseArpu.pessimistic * derivedBase; }
            }
          }
          const synMap = new Map<string, FcMonthEx>();
          for (const [month, e] of acc.entries()) {
            const aw = e.arpuW || 1;
            const wi2 = matchFcs.reduce((s, bf) => s + (bf.months.find(m => m.month === month)?.inflow.mean ?? 0), 0) || 1;
            const wo2 = matchFcs.reduce((s, bf) => s + (bf.months.find(m => m.month === month)?.outflow.mean ?? 0), 0) || 1;
            const wr2 = matchFcs.reduce((s, bf) => s + (bf.months.find(m => m.month === month)?.retention.mean ?? 0), 0) || 1;
            const wb2 = matchFcs.reduce((s, bf) => s + (bfRunningBase.get(bf)?.get(month) ?? 0), 0) || 1;
            synMap.set(month, {
              month,
              inflow:    e.inflow,
              outflow:   e.outflow,
              retention: e.retention,
              arpu: { mean: e.arpuWm / aw, optimistic: e.arpuWo / aw, pessimistic: e.arpuWp / aw },
              inflowArpu:    { mean: e.inflowArpuWm / wi2, optimistic: e.inflowArpuWo / wi2, pessimistic: e.inflowArpuWp / wi2 },
              outflowArpu:   { mean: e.outflowArpuWm / wo2, optimistic: e.outflowArpuWo / wo2, pessimistic: e.outflowArpuWp / wo2 },
              retentionArpu: { mean: e.retentionArpuWm / wr2, optimistic: e.retentionArpuWo / wr2, pessimistic: e.retentionArpuWp / wr2 },
              baseArpu:      { mean: e.baseArpuWm / wb2, optimistic: e.baseArpuWo / wb2, pessimistic: e.baseArpuWp / wb2 },
            });
          }
          specificFcMonthMap = synMap;
          fcSeedBase = matchFcs.reduce((s, bf) => s + (bf.seedBaseVolume || 0), 0);
          fcLastIn   = matchFcs.reduce((s, bf) => s + bf.lastHistoricalInflow, 0);
          fcLastOut  = matchFcs.reduce((s, bf) => s + bf.lastHistoricalOutflow, 0);
        }
      }
    }

    // Build synActualsMap (same as in chartData) for scoped actuals
    type SynActBucket = { inflow: number; outflow: number; retention: number; base: number | null;
      arpuSubVol: number; revSum: number;
      inflowRev: number; inflowSubVol: number;
      outflowRev: number; outflowSubVol: number;
      retentionRev: number; retentionSubVol: number;
      baseRev: number; baseSubVol: number;
    };
    const synActualsMap = (() => {
      if (specificForecast || !_matchFcs.length || cohortMonthMap) return null;
      const amap = new Map<string, SynActBucket>();
      for (const [key, mMap] of cohortActualsMap.entries()) {
        const [kSeg, kProd, kProdL2, kChan, kChanL2, kTariffL1, kTariffL2] = key.split('|');
        const matched = _matchFcs.some(bf => {
          const c = bf.cohort;
          if (c.segment  !== 'All' && c.segment  !== kSeg)   return false;
          if (c.product  !== 'All' && c.product  !== kProd)  return false;
          if (c.productL2 && c.productL2 !== 'All' && c.productL2 !== kProdL2) return false;
          if (c.channel  !== 'All' && c.channel  !== kChan)  return false;
          if (c.channelL2 && c.channelL2 !== 'All' && c.channelL2 !== kChanL2) return false;
          if (c.tariffL1 && c.tariffL1 !== 'All' && c.tariffL1 !== kTariffL1) return false;
          if (c.tariffL2 && c.tariffL2 !== 'All' && c.tariffL2 !== kTariffL2) return false;
          return true;
        });
        if (!matched) continue;
        for (const [month, entry] of mMap.entries()) {
          if (!amap.has(month)) amap.set(month, {
            inflow: 0, outflow: 0, retention: 0, base: null,
            arpuSubVol: 0, revSum: 0,
            inflowRev: 0, inflowSubVol: 0,
            outflowRev: 0, outflowSubVol: 0,
            retentionRev: 0, retentionSubVol: 0,
            baseRev: 0, baseSubVol: 0,
          });
          const e = amap.get(month)!;
          e.inflow     += entry.inflow;
          e.outflow    += entry.outflow;
          e.retention  += entry.retention;
          if (entry.base !== null) e.base = (e.base ?? 0) + entry.base;
          e.arpuSubVol += entry.arpuSubVol; e.revSum += entry.arpuRevSum;
          e.inflowRev += entry.inflowRev; e.inflowSubVol += entry.inflowSubVol;
          e.outflowRev += entry.outflowRev; e.outflowSubVol += entry.outflowSubVol;
          e.retentionRev += entry.retentionRev; e.retentionSubVol += entry.retentionSubVol;
          e.baseRev += entry.baseRev; e.baseSubVol += entry.baseSubVol;
        }
      }
      return amap.size > 0 ? amap : null;
    })();

    // Running base from forecast for base_baseline
    const fcBaseMap = (() => {
      if (!specificFcMonthMap) return null;
      const months = [...specificFcMonthMap.values()].sort((a, b) => a.month.localeCompare(b.month));
      const map = new Map<string, number>();
      let b = fcSeedBase, prevIn = fcLastIn, prevOut = fcLastOut;
      for (const m of months) {
        b = Math.max(0, b + prevIn - prevOut);
        map.set(m.month, b);
        prevIn = m.inflow.mean;
        prevOut = m.outflow.mean;
      }
      return map;
    })();

    // Helper to get actuals bucket for a month
    const getActBucket = (month: string): SynActBucket | null => {
      if (cohortMonthMap) {
        const entry = cohortMonthMap.get(month);
        if (!entry) return null;
        return {
          inflow: entry.inflow, outflow: entry.outflow, retention: entry.retention,
          base: entry.base,
          arpuSubVol: entry.arpuSubVol, revSum: entry.arpuRevSum,
          inflowRev: entry.inflowRev, inflowSubVol: entry.inflowSubVol,
          outflowRev: entry.outflowRev, outflowSubVol: entry.outflowSubVol,
          retentionRev: entry.retentionRev, retentionSubVol: entry.retentionSubVol,
          baseRev: entry.baseRev, baseSubVol: entry.baseSubVol,
        };
      }
      const src = synActualsMap ?? actualsAggrMap;
      const bucket = src.get(month) as any;
      if (!bucket) return null;
      return {
        inflow: bucket.inflow ?? 0,
        outflow: bucket.outflow ?? 0,
        retention: bucket.retention ?? 0,
        base: bucket.base ?? null,
        arpuSubVol: bucket.arpuSubVol ?? 0,
        revSum: bucket.revSum ?? 0,
        inflowRev: bucket.inflowRev ?? 0, inflowSubVol: bucket.inflowSubVol ?? 0,
        outflowRev: bucket.outflowRev ?? 0, outflowSubVol: bucket.outflowSubVol ?? 0,
        retentionRev: bucket.retentionRev ?? 0, retentionSubVol: bucket.retentionSubVol ?? 0,
        baseRev: bucket.baseRev ?? 0, baseSubVol: bucket.baseSubVol ?? 0,
      };
    };

    const buildActualRow = (month: string): Partial<MultiChartRow> => {
      const act = getActBucket(month);
      if (!act) return {};
      const r: Partial<MultiChartRow> = {};
      if (act.inflow > 0) r.inflow_actual = act.inflow;
      if (act.outflow > 0) r.outflow_actual = act.outflow;
      if (act.retention > 0) r.retention_actual = act.retention;
      if (act.base !== null && act.base > 0) r.base_actual = act.base;
      if (act.inflowSubVol > 0 && act.inflowRev > 0) r.inflowArpu_actual = act.inflowRev / act.inflowSubVol;
      if (act.outflowSubVol > 0 && act.outflowRev > 0) r.outflowArpu_actual = act.outflowRev / act.outflowSubVol;
      if (act.retentionSubVol > 0 && act.retentionRev > 0) r.retentionArpu_actual = act.retentionRev / act.retentionSubVol;
      if (act.baseSubVol > 0 && act.baseRev > 0) r.baseArpu_actual = act.baseRev / act.baseSubVol;
      // Exact summed revenue, taken before the divide above — NOT arpu x volume.
      // This is the actuals side, where Monthly_Revenue_GBP genuinely exists, so
      // a revenue view here must reconcile against the source column exactly.
      if (act.inflowRev > 0) r.inflowRev_actual = act.inflowRev;
      if (act.outflowRev > 0) r.outflowRev_actual = act.outflowRev;
      if (act.retentionRev > 0) r.retentionRev_actual = act.retentionRev;
      if (act.baseRev > 0) r.baseRev_actual = act.baseRev;
      return r;
    };

    // Historical rows
    const histRows: MultiChartRow[] = histMonths.map(month => ({
      month,
      ...buildActualRow(month),
    }));

    // Forecast rows
    const fcRows: MultiChartRow[] = comparisonRows.map(row => {
      const r: MultiChartRow = { month: row.month, ...buildActualRow(row.month) };
      if (specificFcMonthMap) {
        const cfm = specificFcMonthMap.get(row.month);
        if (cfm) {
          r.inflow_baseline = cfm.inflow.mean; r.inflow_opt = cfm.inflow.optimistic; r.inflow_pess = cfm.inflow.pessimistic;
          r.outflow_baseline = cfm.outflow.mean; r.outflow_opt = cfm.outflow.optimistic; r.outflow_pess = cfm.outflow.pessimistic;
          r.retention_baseline = cfm.retention.mean; r.retention_opt = cfm.retention.optimistic; r.retention_pess = cfm.retention.pessimistic;
          r.base_baseline = fcBaseMap?.get(row.month);
          if (cfm.inflowArpu) { r.inflowArpu_baseline = cfm.inflowArpu.mean; r.inflowArpu_opt = cfm.inflowArpu.optimistic; r.inflowArpu_pess = cfm.inflowArpu.pessimistic; }
          if (cfm.outflowArpu) { r.outflowArpu_baseline = cfm.outflowArpu.mean; r.outflowArpu_opt = cfm.outflowArpu.optimistic; r.outflowArpu_pess = cfm.outflowArpu.pessimistic; }
          if (cfm.retentionArpu) { r.retentionArpu_baseline = cfm.retentionArpu.mean; r.retentionArpu_opt = cfm.retentionArpu.optimistic; r.retentionArpu_pess = cfm.retentionArpu.pessimistic; }
          if (cfm.baseArpu) { r.baseArpu_baseline = cfm.baseArpu.mean; r.baseArpu_opt = cfm.baseArpu.optimistic; r.baseArpu_pess = cfm.baseArpu.pessimistic; }
        }
      } else if (baseForecast && !selectedCohortRow &&
                 (!activeFilter || cohortMatchesFilter(baseForecast.cohort, activeFilter))) {
        // Fall back to baseForecast — only when its cohort scope matches the
        // current view scope. A cohort-level forecast must never be compared
        // against aggregate-scale actuals (or vice versa for a selected cohort
        // row): that mismatch renders +99.9% variance on every month.
        const bm = baseForecast.months.find(m => m.month === row.month);
        if (bm) {
          r.inflow_baseline = bm.inflow.mean; r.inflow_opt = bm.inflow.optimistic; r.inflow_pess = bm.inflow.pessimistic;
          r.outflow_baseline = bm.outflow.mean; r.outflow_opt = bm.outflow.optimistic; r.outflow_pess = bm.outflow.pessimistic;
          r.retention_baseline = bm.retention.mean; r.retention_opt = bm.retention.optimistic; r.retention_pess = bm.retention.pessimistic;
          if (bm.inflowArpu) { r.inflowArpu_baseline = bm.inflowArpu.mean; r.inflowArpu_opt = bm.inflowArpu.optimistic; r.inflowArpu_pess = bm.inflowArpu.pessimistic; }
          if (bm.outflowArpu) { r.outflowArpu_baseline = bm.outflowArpu.mean; r.outflowArpu_opt = bm.outflowArpu.optimistic; r.outflowArpu_pess = bm.outflowArpu.pessimistic; }
          if (bm.retentionArpu) { r.retentionArpu_baseline = bm.retentionArpu.mean; r.retentionArpu_opt = bm.retentionArpu.optimistic; r.retentionArpu_pess = bm.retentionArpu.pessimistic; }
          if (bm.baseArpu) { r.baseArpu_baseline = bm.baseArpu.mean; r.baseArpu_opt = bm.baseArpu.optimistic; r.baseArpu_pess = bm.baseArpu.pessimistic; }
        }
        r.base_baseline = row.baseline?.base;
      }
      // Forecast-side revenue is DERIVED — the forecast carries no revenue at
      // all. One derivation for both branches above, so the specific-cohort and
      // baseForecast-fallback paths cannot drift apart.
      //
      // Each ARPU is multiplied by the volume of the SAME scenario. Do not
      // substitute the blended `arpu` here: its only valid matching volume is
      // arpuSubVol (total across all four scenarios), and pairing it with any
      // single scenario's volume yields a plausible, wrong number.
      // Mean only — see the MultiChartRow comment on why there is no band.
      for (const sc of ['inflow', 'outflow', 'retention', 'base'] as const) {
        const arpu = r[`${sc}Arpu_baseline` as keyof MultiChartRow] as number | undefined;
        const vol  = r[`${sc}_baseline`     as keyof MultiChartRow] as number | undefined;
        if (typeof arpu === 'number' && typeof vol === 'number') {
          (r as unknown as Record<string, number>)[`${sc}Rev_baseline`] = arpu * vol;
        }
      }
      return r;
    });

    return [...histRows, ...fcRows];
  }, [baseForecast, comparisonRows, actualsAggrMap, cohortActualsMap, aggrSnapshotMap, broadAggrSnapshotMap,
      selectedCohortRow, cohortDims, forecastStore, activeFilter]);

  // True when at least one forecast-month row carries a baseline at the current
  // view scope. False means no stored forecast matches the filter/cohort scope
  // (and the loaded baseForecast was rejected by the scope guard) — the chart
  // shows actuals only and the variance tables are replaced by a notice.
  const hasScopedBaseline = useMemo(
    () => multiChartData.some(r =>
      r.inflow_baseline !== undefined || r.outflow_baseline !== undefined ||
      r.retention_baseline !== undefined || r.base_baseline !== undefined),
    [multiChartData],
  );

  // ---------------------------------------------------------------------------
  // 5. Aggregate accuracy metrics
  //    Formula: MAPE = (1/n) × Σ |actual − forecast| / |actual| × 100
  //    Zero-division guard: skip months where actual = 0 (not forecast = 0).
  //    Using |actual| as denominator is the standard MAPE definition and keeps
  //    the MAPE card value consistent with the average |Var%| in the variance
  //    table (which now uses the same denominator — see Var% formula below).
  // ---------------------------------------------------------------------------
  const accuracy = useMemo(() => {
    const withActuals = comparisonRows.filter(r => r.actual !== null);

    const calcMape = (kpi: KpiKey): number | null => {
      const pairs = withActuals
        .map(r => {
          const a = getKpiVal(r.actual, kpi);
          const f = getKpiVal(r.baseline, kpi);
          // Guard: skip months where actual is zero (avoids ÷0) or either value
          // is missing.  Do NOT guard on forecast = 0 — that would silently
          // exclude months where the model predicted no activity, inflating MAPE.
          return a !== null && f !== null && a !== 0 ? { a, f } : null;
        })
        .filter(Boolean) as { a: number; f: number }[];
      if (!pairs.length) return null;
      return (pairs.reduce((s, { a, f }) => s + Math.abs(a - f) / Math.abs(a), 0) / pairs.length) * 100;
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
  // 5b. Summary MAPE — single source of truth for the MAPE cards.
  //
  //   Iterates forecastStore (contains both manual and bulk-generated BaseForecast
  //   objects, all keyed seg|prod|chan) and collects all entries that match
  //   activeFilter (respecting 'All' wildcards).  Computes MAPE independently
  //   for each matching forecast against the actuals dataset, then averages
  //   per-metric across all matching forecasts.
  //
  //   This is the ONLY code path that feeds the MAPE cards — no filter-change
  //   effects, no click handlers, no single-baseForecast dependency.
  // ---------------------------------------------------------------------------
  const summaryMape = useMemo(() => {
    const empty = {
      inflow: null, outflow: null, retention: null, base: null, arpu: null,
      inflowArpu: null, outflowArpu: null, retentionArpu: null, baseArpu: null,
      monthsWithActuals: 0,
    } as {
      inflow: number | null; outflow: number | null; retention: number | null; base: number | null; arpu: number | null;
      inflowArpu: number | null; outflowArpu: number | null; retentionArpu: number | null; baseArpu: number | null;
      monthsWithActuals: number;
    };

    if (!forecastStore.size) return empty;

    // Collect all forecasts that match the active filter (supports hierarchical L1/L2 selections)
    const matching: import('../types/forecast').BaseForecast[] = [];
    // Shared predicate. The four hand-rolled *Match expressions this replaces
    // were hierarchical-partial matching against the filter bar; the tariff one
    // was added last and its absence is the defect trap B guards -- without it a
    // tariff-scoped filter did not narrow the forecast set, so every tariff
    // sibling was averaged into the summary cards.
    const filterScope = {
      segment: activeFilter?.segment,
      product: activeFilter?.product?.l1, productL2: activeFilter?.product?.l2,
      channel: activeFilter?.channel?.l1, channelL2: activeFilter?.channel?.l2,
      tariffL1: activeFilter?.tariff?.l1, tariffL2: activeFilter?.tariff?.l2,
    };
    for (const bf of forecastStore.values()) {
      if (cohortInScope(bf.cohort, filterScope, ALL_DIMS)) matching.push(bf);
    }

    if (!matching.length) return empty;

    // Compute per-forecast MAPE using the self-contained pure function
    const perForecast = matching.map(bf =>
      computeForecastMape(
        bf, data,
        wiDateCol, wiMetricCol, wiValueCol,
        wiInflowVal, wiOutflowVal, wiRetentionVal, wiBaseVal,
        wiArpuCol, wiRevenueCol,
        wiSegmentCol, wiProductCol, wiChannelCol,
        adjustedMeanMap,
        wiProductL2Col,
        wiChannelL2Col,
        wiTariffL1Col,
        wiTariffL2Col,
      )
    );

    const avg = (field: string): number | null => {
      const vals = perForecast.map(m => (m as any)[field] as number | null).filter((v): v is number => v !== null);
      return vals.length ? vals.reduce((s, v) => s + v, 0) / vals.length : null;
    };

    return {
      inflow:    avg('inflow'),
      outflow:   avg('outflow'),
      retention: avg('retention'),
      base:      avg('base'),
      arpu:      avg('arpu'),
      inflowArpu:    avg('inflowArpu'),
      outflowArpu:   avg('outflowArpu'),
      retentionArpu: avg('retentionArpu'),
      baseArpu:      avg('baseArpu'),
      monthsWithActuals: perForecast.reduce((s, m) => s + m.monthsWithActuals, 0),
    };
  }, [forecastStore, activeFilter, adjustedMeanMap, data, wiDateCol, wiMetricCol, wiValueCol,
      wiInflowVal, wiOutflowVal, wiRetentionVal, wiBaseVal, wiArpuCol, wiRevenueCol,
      wiSegmentCol, wiProductCol, wiProductL2Col, wiChannelCol, wiChannelL2Col, wiTariffL1Col, wiTariffL2Col]);

  // ---------------------------------------------------------------------------
  // 6. Per-cohort accuracy (cont.) — AutoML Challenger tab instance
  //    Both delegate to the module-level buildCohortAccuracy pure function so
  //    the grouping logic is not duplicated.
  // ---------------------------------------------------------------------------

  // AutoML Challenger tab — driven by challengerDims (independent of cohortDims)
  const challengerCohortAccuracy = useMemo(
    () => baseForecast ? buildCohortAccuracy(cohortActualsMap, broadAggrSnapshotMap, baseForecast, challengerDims, forecastStore) : [],
    [baseForecast, cohortActualsMap, broadAggrSnapshotMap, challengerDims, forecastStore],
  );

  // ---------------------------------------------------------------------------
  // 7. Challenger model evaluation (cohorts with MAPE > 5%)
  // ---------------------------------------------------------------------------
  type ChallengerGroup = {
    key: string; seg: string; prod: string; avgMape: number;
    chosenModel: string;
    /** Exact cohort dimensions — used by runChallengerForecast to filter data */
    cohort: import('../types/forecast').CohortKey;
    models: { name: string; error: number; color: string; strokeDasharray: string }[];
    bestModel: { name: string; error: number; color: string; strokeDasharray: string };
    chartData: { month: string; Actual?: number; 'Holt Linear': number; 'Damped Trend': number; 'Holt-Winters': number }[];
  };

  const challengerGroups = useMemo((): ChallengerGroup[] => {
    if (!baseForecast) return [];

    // Issue 10: use overallScore < 85 as the threshold, not avgMape > 5.
    // When bulk-generated forecasts are fitted to each cohort's own data, the
    // in-sample MAPE can be < 5% even when the accuracy score is poor (e.g. 75)
    // because the score also penalises cone violations and directional bias.
    // overallScore < 85 is consistent with what the Historical Accuracy table shows.
    // challengerShowAll bypasses the threshold so users can inspect any cohort.
    return challengerCohortAccuracy
      .filter(c => c.overallScore !== null && (challengerShowAll || c.overallScore < 85))
      .map(c => {
        const monthMap = c.monthMap;
        if (!monthMap || !monthMap.size) return null;

        // Look up the cohort-specific forecast from forecastStore.
        const cohortFcKey = [
          c.seg,
          challengerDims.product   ? c.prod   : 'All',
          challengerDims.productL2 ? c.prodL2 : 'All',
          challengerDims.channelL1 ? c.chan    : 'All',
          challengerDims.channelL2 ? c.chanL2  : 'All',
        ].join('|');
        const cohortFcExact = forecastStore.get(cohortFcKey) ?? null;
        const chosenModel = (cohortFcExact ?? baseForecast).modelUsed ?? 'Holt Linear';

        // Issue 9: when no exact forecast exists, scale baseForecast to cohort scale
        // using the cohort's average inflow share over matched actuals months.
        let scale = 1;
        if (!cohortFcExact) {
          const shares: number[] = [];
          for (const bm of baseForecast.months) {
            const act = monthMap.get(bm.month);
            if (act && act.inflow > 0 && bm.inflow.mean > 0) {
              shares.push(act.inflow / bm.inflow.mean);
            }
          }
          scale = shares.length > 0 ? shares.reduce((a, b) => a + b, 0) / shares.length : 1;
        }
        const cohortFc = cohortFcExact ?? baseForecast;

        let hwError = 0, dampedError = 0, arimaError = 0, totalActual = 0;

        const cData = cohortFc.months.map((bm, i) => {
          const act = monthMap.get(bm.month);
          // Scale the forecast to cohort level (scale=1 when cohortFcExact found)
          const forecast = bm.inflow.mean * scale;
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

        // Only show cohorts where we have at least some actuals to compare against
        if (totalActual === 0) return null;

        const hwPct = totalActual ? (hwError / totalActual) * 100 : 0;
        const dampedPct = totalActual ? (dampedError / totalActual) * 100 : 0;
        const arimaPct = totalActual ? (arimaError / totalActual) * 100 : 0;

        const models = [
          { name: 'Holt Linear', error: hwPct, color: '#94a3b8', strokeDasharray: '5 5' },
          { name: 'Damped Trend', error: dampedPct, color: '#f59e0b', strokeDasharray: '3 3' },
          { name: 'Holt-Winters', error: arimaPct, color: '#10b981', strokeDasharray: '' },
        ].sort((a, b) => a.error - b.error);

        const cohort: import('../types/forecast').CohortKey = cohortFcExact?.cohort ?? {
          segment: c.seg,
          product: challengerDims.product ? c.prod : 'All',
          productL2: challengerDims.productL2 ? c.prodL2 : 'All',
          channel: challengerDims.channelL1 ? c.chan : 'All',
          channelL2: challengerDims.channelL2 ? c.chanL2 : 'All',
          scenario: baseForecast.cohort.scenario,
        };
        return { key: c.cohortKey, seg: c.seg, prod: c.prod, avgMape: c.avgMape ?? 0, chosenModel, cohort, models, bestModel: models[0], chartData: cData };
      })
      .filter(Boolean) as ChallengerGroup[];
  }, [baseForecast, challengerCohortAccuracy, challengerDims, forecastStore, challengerShowAll]);

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

  // Run the real challenger forecast for the selected cohort + model, store as preview.
  const handleRunChallenger = useCallback((model: ForecastModel) => {
    if (!selectedChallengerGroup) return;
    setRunningChallengerKey(selectedChallengerGroup.key);
    // calculateBaseForecast is synchronous; use setTimeout to let the loading
    // state render before blocking the main thread.
    setTimeout(() => {
      const result = onRunChallengerForecast(selectedChallengerGroup.cohort, model);
      setRunningChallengerKey(null);
      if (result) {
        setChallengerPreviews(prev => new Map(prev).set(selectedChallengerGroup.key, result));
      }
    }, 0);
  }, [selectedChallengerGroup, onRunChallengerForecast]);

  // Accept the preview forecast and save it.
  const handleAcceptPreview = useCallback(() => {
    if (!selectedChallengerGroup || !baseForecast) return;
    const preview = challengerPreviews.get(selectedChallengerGroup.key);
    if (!preview) return;
    const switchoverMonth =
      baseForecast.months.find(bm => !actualsAggrMap.has(bm.month))?.month ??
      baseForecast.months[0]?.month ?? null;
    setPreviousForecast(baseForecast);
    onAcceptPreviewForecast(preview, switchoverMonth);
    setAcceptedCohortKeys(prev => new Set([...prev, selectedChallengerGroup.key]));
    if (switchoverMonth) setModelSwitchPoint({ month: switchoverMonth, modelName: preview.modelUsed });
    // Discard the preview now it's been accepted
    setChallengerPreviews(prev => { const m = new Map(prev); m.delete(selectedChallengerGroup.key); return m; });
  }, [selectedChallengerGroup, baseForecast, challengerPreviews, actualsAggrMap, onAcceptPreviewForecast]);

  // Discard the preview (keep current model).
  const handleDiscardPreview = useCallback(() => {
    if (!selectedChallengerGroup) return;
    setChallengerPreviews(prev => { const m = new Map(prev); m.delete(selectedChallengerGroup.key); return m; });
  }, [selectedChallengerGroup]);

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
          <h3 className="text-xl font-bold text-slate-900 mb-2">{t('actuals_no_forecast_loaded')}</h3>
          <p className="text-slate-500 mb-6 text-sm leading-relaxed">{t('actuals_no_forecast_found_for_the_selected_cohort_use')}</p>
          <button
            onClick={() => setActiveView('standard')}
            className="px-5 py-2.5 bg-[#e60000] text-white rounded-lg font-semibold text-sm hover:bg-[#cc0000] transition-colors inline-flex items-center gap-2"
          >{t('common_go_to_step_1')}<ArrowRight size={15} />
          </button>
        </div>
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // Main render
  // ---------------------------------------------------------------------------
  const { cohort } = baseForecast;

  const productDisplayStr = (sel: { l1: string | null; l2: string | null }): string => {
    if (!sel.l1) return 'All';
    if (!sel.l2) return sel.l1;
    return `${sel.l1} — ${sel.l2}`;
  };

  // COMPARING chips — only rendered when the user has an explicit activeFilter.
  // These chips double as per-dimension reset buttons (X to clear a single dim).
  // When no activeFilter is set the ViewFilterBar already communicates the scope.
  type ActiveDim = { label: string; value: string; active: boolean; dim: 'segment' | 'product' | 'channel' | 'tariff' };
  const activeDims: ActiveDim[] = activeFilter ? ([
    { label: 'Segment', value: activeFilter.segment,                      active: activeFilter.segment !== 'All', dim: 'segment' as const },
    { label: 'Product', value: productDisplayStr(activeFilter.product),   active: !!activeFilter.product.l1,     dim: 'product' as const },
    { label: 'Channel', value: productDisplayStr(activeFilter.channel),   active: !!activeFilter.channel.l1,     dim: 'channel' as const },
    ...(activeFilter.tariff ? [{ label: 'Tariff', value: productDisplayStr(activeFilter.tariff), active: !!activeFilter.tariff.l1, dim: 'tariff' as const }] : []),
  ] as ActiveDim[]).filter(d => d.value && d.value !== 'Unknown' && d.value !== 'undefined') : [];
  const hasActiveFilterDims = activeDims.some(d => d.active);

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
    <>
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* ── Page header + sub-nav (fixed, never scrolls) ── */}
      <div className="shrink-0 px-6 pt-5 border-b border-slate-200 bg-white">
        <div className="max-w-7xl mx-auto">
          {/* Title row */}
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-2xl font-bold text-slate-900">{t('actuals_actuals_review')}</h2>
              <p className="text-sm text-slate-500 mt-0.5">
                
                {t('actuals_forecast_vs_actuals_comparison')}
                {usingAdjusted && (
                  <span className="ml-2 text-xs bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full font-medium">{t('actuals_using_adjusted_forecast')}</span>
                )}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <label className="relative flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-lg text-sm font-semibold text-slate-700 hover:bg-slate-50 hover:border-slate-300 cursor-pointer transition-colors">
                <FilePlus size={15} className="text-emerald-600" />{t('common_import_actuals')}<input
                  type="file"
                  accept=".xlsx, .xls"
                  onChange={handleImportActualsFile}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                />
              </label>
              {data.length > 0 && (
                <button
                  onClick={() => setShowRemoveModal(true)}
                  className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-lg text-sm font-semibold text-slate-700 hover:bg-red-50 hover:border-red-300 hover:text-[#e60000] transition-colors"
                >
                  <Trash2 size={15} />{t('common_remove_actuals')}</button>
              )}
              <button
                onClick={onRequestExport}
                className="px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm font-semibold flex items-center gap-2 hover:bg-emerald-700 transition-colors"
              >
                <Download size={16} />{t('common_export_session')}</button>
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
            >{t('actuals_forecast_vs_actuals')}</button>
            <button
              onClick={() => setActiveSubView('challenger')}
              className={`px-5 py-2.5 text-sm font-semibold border-b-2 transition-colors whitespace-nowrap flex items-center gap-2 ${
                activeSubView === 'challenger'
                  ? 'border-[#e60000] text-[#e60000]'
                  : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
              }`}
            >
              
              {t('actuals_automl_challenger_analysis')}
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
        {/* Only shown when the user has applied an explicit filter via the    */}
        {/* ViewFilterBar. Each chip shows the current value and can be        */}
        {/* clicked to clear that dimension independently.                     */}
        {hasActiveFilterDims && (
        <div className="bg-white border border-slate-200 rounded-xl px-4 py-3 flex flex-wrap items-center gap-x-3 gap-y-2">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 shrink-0">{t('actuals_comparing')}</span>
          {activeDims.map(d => {
            const canReset = d.active && !!onCohortFilterChange && !!activeFilter;
            return (
              <button
                key={d.label}
                disabled={!canReset}
                onClick={() => {
                  if (!canReset || !activeFilter) return;
                  const next: ViewFilter = { ...activeFilter };
                  if (d.dim === 'segment') next.segment = 'All';
                  else if (d.dim === 'product') next.product = { l1: null, l2: null };
                  else if (d.dim === 'channel') next.channel = { l1: null, l2: null };
                  else if (d.dim === 'tariff') next.tariff = { l1: null, l2: null };
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
          <span className="ml-auto text-[10px] text-slate-400 italic hidden md:block">{t('actuals_actuals_filtered_to_match_forecast_scope_like')}</span>
        </div>
        )}

        {/* ── No actuals for this combination ──────────────────────────── */}
        {noActualsForCombo && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-5 flex items-start gap-3">
            <AlertTriangle size={18} className="text-amber-500 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-amber-900 mb-1">{t('actuals_no_actuals_data_found_for_this_combination')}</p>
              <p className="text-xs text-amber-700 leading-relaxed">
                
                {t('actuals_your_dataset_contains_actuals_records_but_non')}
                {[
                  activeFilter?.segment && activeFilter.segment !== 'All' ? t('actuals_segment', { p0: activeFilter.segment }) : cohort.segment !== 'All' ? t('actuals_segment', { p0: cohort.segment }) : null,
                  activeFilter?.product.l1 ? t('actuals_product', { p0: productDisplayStr(activeFilter.product) }) : cohort.product !== 'All' ? t('actuals_product', { p0: cohort.product }) : null,
                  activeFilter?.channel.l1 ? t('actuals_channel', { p0: productDisplayStr(activeFilter.channel) }) : cohort.channel !== 'All' ? t('actuals_channel', { p0: cohort.channel }) : null,
                  t('actuals_scenario', { p0: cohort.scenario }),
                ].filter(Boolean).join(', ')}
                
                {t('actuals_upload_or_import_actuals_data_that_covers_thi')}
              </p>
            </div>
          </div>
        )}

        {/* ── Summary MAPE cards — 4 volume + 4 per-scenario ARPU ── */}
        <div className="space-y-3">
          {/* Row 1: Volume metrics */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {(['inflow', 'outflow', 'retention', 'base'] as const).map(kpi => {
              const mape = summaryMape[kpi];
              return (
                <div key={kpi} className="bg-white p-4 rounded-2xl shadow-sm border border-slate-200">
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">
                    {SCENARIO_LABELS[kpi]} MAPE
                  </p>
                  <p className={`text-xl font-bold ${mapeColor(mape)}`}>{mapeLabel(mape)}</p>
                  <p className="text-[10px] text-slate-400 mt-1">
                    {summaryMape.monthsWithActuals} month{summaryMape.monthsWithActuals !== 1 ? 's' : ''} compared
                  </p>
                  <p className="text-[9px] font-medium text-slate-300 mt-0.5 uppercase tracking-wide">
                    {useAdjustedScoring && adjustedForecast ? t('actuals_adjusted') : t('actuals_baseline')}
                  </p>
                </div>
              );
            })}
          </div>
          {/* Row 2: Per-scenario ARPU metrics */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {(['inflowArpu', 'outflowArpu', 'retentionArpu', 'baseArpu'] as const).map(kpi => {
              const mape = summaryMape[kpi];
              return (
                <div key={kpi} className="bg-white p-4 rounded-2xl shadow-sm border border-slate-200">
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">
                    {SCENARIO_LABELS[kpi]} MAPE
                  </p>
                  <p className={`text-xl font-bold ${mapeColor(mape)}`}>{mapeLabel(mape)}</p>
                  <p className="text-[10px] text-slate-400 mt-1">
                    {summaryMape.monthsWithActuals} month{summaryMape.monthsWithActuals !== 1 ? 's' : ''} compared
                  </p>
                  <p className="text-[9px] font-medium text-slate-300 mt-0.5 uppercase tracking-wide">
                    {useAdjustedScoring && adjustedForecast ? t('actuals_adjusted') : t('actuals_baseline')}
                  </p>
                </div>
              );
            })}
          </div>
        </div>

        {/* ── Volume / Value chart panel ── */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">

          {/* Chart view tabs: Volume | Value */}
          <div className="flex border-b border-slate-100">
            <button onClick={() => setChartView('volume')} className={`px-5 py-3 text-sm font-semibold border-b-2 transition-colors ${chartView === 'volume' ? 'text-[#e60000] border-[#e60000]' : 'text-slate-500 border-transparent hover:text-slate-700'}`}>{t('common_volume')}</button>
            <button onClick={() => setChartView('value')} className={`px-5 py-3 text-sm font-semibold border-b-2 transition-colors ${chartView === 'value' ? 'text-[#e60000] border-[#e60000]' : 'text-slate-500 border-transparent hover:text-slate-700'}`}>{valueUnit === 'revenue' ? t('actuals_value_revenue') : t('actuals_value_arpu')}</button>
          </div>

          {/* Selected cohort indicator */}
          {selectedCohortRow && (
            <div className="px-6 py-2 border-b border-slate-100 bg-indigo-50/40 flex items-center gap-2">
              <span className="text-[10px] font-semibold text-indigo-500 uppercase tracking-wide">{t('actuals_drilled_into')}</span>
              <span className="text-xs font-medium text-indigo-800">{selectedCohortRow.label}</span>
              <button
                onClick={() => {
                  setSelectedForecastCohortKey(null);
                  onCohortFilterChange?.({ segment: 'All', product: { l1: null, l2: null }, channel: { l1: null, l2: null } });
                }}
                className="ml-auto flex items-center gap-1 text-[10px] text-indigo-400 hover:text-indigo-600 font-medium transition-colors"
              >
                <X size={11} />{t('actuals_clear')}</button>
            </div>
          )}

          {/* ARPU / total revenue unit toggle — Value view only. Presentation
              only: it selects which already-computed series the chart reads. */}
          {chartView === 'value' && (
            <div className="px-6 pt-4 flex items-center gap-2">
              <span className="text-xs font-medium text-slate-500">{t('actuals_show')}</span>
              {/* Matches the adjusted-scoring segmented control below (slate-800
                  active, rounded-md buttons, gap-1 in a p-0.5 container). Red is
                  reserved for primary navigation like the Volume/Value tabs; this
                  is a secondary control and must not compete with them. */}
              <div className="flex items-center gap-1 bg-white border border-slate-200 rounded-lg p-0.5">
                {(['arpu', 'revenue'] as const).map(u => (
                  <button key={u}
                    onClick={() => setValueUnit(u)}
                    className={`px-2.5 py-1 rounded-md text-xs font-semibold transition-colors ${valueUnit === u ? 'bg-slate-800 text-white shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
                    {u === 'arpu' ? t('actuals_unit_arpu') : t('actuals_unit_revenue')}
                  </button>
                ))}
              </div>
              {valueUnit === 'revenue' && (
                <span className="text-xs text-slate-400">{t('actuals_revenue_no_band')}</span>
              )}
            </div>
          )}

          {/* Scenario toggle buttons */}
          <div className="px-6 pt-4 flex flex-wrap gap-2">
            {chartView === 'volume'
              ? (['inflow', 'outflow', 'retention', 'base'] as VolumeScenario[]).map(sc => {
                  const active = activeVolumeScenarios.includes(sc);
                  const c = VOLUME_COLORS[sc];
                  return (
                    <button key={sc}
                      onClick={() => setActiveVolumeScenarios(prev => active && prev.length > 1 ? prev.filter(x => x !== sc) : prev.includes(sc) ? prev : [...prev, sc])}
                      className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-colors border ${active ? 'text-white border-transparent' : 'bg-white text-slate-500 border-slate-200 hover:border-slate-400'}`}
                      style={active ? { backgroundColor: c.baseline, borderColor: c.baseline } : {}}>
                      {SCENARIO_LABELS[sc]}
                    </button>
                  );
                })
              : (['inflowArpu', 'outflowArpu', 'retentionArpu', 'baseArpu'] as ArpuScenario[]).map(sc => {
                  const active = activeArpuScenarios.includes(sc);
                  const c = ARPU_SCENARIO_COLORS[sc];
                  return (
                    <button key={sc}
                      onClick={() => setActiveArpuScenarios(prev => active && prev.length > 1 ? prev.filter(x => x !== sc) : prev.includes(sc) ? prev : [...prev, sc])}
                      className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-colors border ${active ? 'text-white border-transparent' : 'bg-white text-slate-500 border-slate-200 hover:border-slate-400'}`}
                      style={active ? { backgroundColor: c.baseline, borderColor: c.baseline } : {}}>
                      {SCENARIO_LABELS[sc]}
                    </button>
                  );
                })
            }
          </div>

          {/* Legend */}
          <div className="px-6 pt-3 pb-1 flex flex-wrap gap-4 text-xs text-slate-600">
            {(chartView === 'volume' ? activeVolumeScenarios : activeArpuScenarios).map(sc => {
              const c = chartView === 'volume' ? VOLUME_COLORS[sc as VolumeScenario] : ARPU_SCENARIO_COLORS[sc as ArpuScenario];
              return (
                <React.Fragment key={sc}>
                  <span className="flex items-center gap-1.5">
                    <span className="inline-block w-5 h-0.5 rounded" style={{ backgroundColor: c.actual }} />
                    {scenarioLabel(sc)} Actual
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="inline-block w-5 border-t-2 border-dashed" style={{ borderColor: c.baseline }} />
                    {scenarioLabel(sc)} Forecast
                  </span>
                </React.Fragment>
              );
            })}
          </div>

          {/* Chart */}
          {(() => {
            // For ARPU view: compute a tight Y-axis domain so closely-spaced lines are readable.
            // Collect every numeric ARPU value (actual + baseline + bands) visible in the data,
            // then pad ±10% of the range so lines don't touch the chart edges.
            const arpuYAxisDomain: [number | string, number | string] = (() => {
              if (chartView !== 'value') return ['auto', 'auto'];
              const vals: number[] = [];
              // In revenue mode the band keys do not exist, so the axis scales
              // to actual/baseline only. Listing them explicitly rather than
              // relying on the lookup missing keeps the intent auditable: the
              // axis must never reflect a band that is not drawn.
              const arpuKeys = activeArpuScenarios.flatMap(sc => {
                const p = seriesPrefix(sc);
                return valueUnit === 'revenue'
                  ? [`${p}_actual`, `${p}_baseline`]
                  : [`${p}_actual`, `${p}_baseline`, `${p}_opt`, `${p}_pess`];
              });
              for (const row of multiChartData) {
                for (const k of arpuKeys) {
                  const v = (row as Record<string, unknown>)[k];
                  if (typeof v === 'number' && isFinite(v) && v > 0) vals.push(v);
                }
              }
              if (vals.length < 2) return ['auto', 'auto'];
              const lo = Math.min(...vals);
              const hi = Math.max(...vals);
              const range = hi - lo;
              // If range is tiny (< 1% of mid value), force at least a 5% window
              const mid = (lo + hi) / 2;
              const effectiveRange = Math.max(range, mid * 0.05);
              const pad = effectiveRange * 0.15;
              return [
                parseFloat((Math.max(0, lo - pad)).toFixed(2)),
                parseFloat((hi + pad).toFixed(2)),
              ];
            })();
            return (
          <div className="px-6 pb-6">
            <div className="h-[360px]">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={multiChartData} margin={{ top: 5, right: 24, bottom: 40, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#94a3b8' }} stroke="#e2e8f0" />
                  <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} stroke="#e2e8f0" tickFormatter={formatNumber} width={70}
                    domain={chartView === 'value' ? arpuYAxisDomain : ['auto', 'auto']} />
                  <Tooltip
                    contentStyle={{ borderRadius: '10px', border: '1px solid #e2e8f0', boxShadow: '0 4px 12px rgb(0 0 0 / 0.08)' }}
                    formatter={(val: any, name: string) => [val != null ? formatNumber(val) : '—', name]}
                  />
                  {baseForecast.months.length > 0 && (
                    <ReferenceLine x={baseForecast.months[0].month} stroke="#94a3b8" strokeDasharray="3 3"
                      label={{ position: 'insideTopLeft', value: 'Forecast →', fill: '#94a3b8', fontSize: 9 }} />
                  )}
                  {chartView === 'volume'
                    ? activeVolumeScenarios.map(sc => {
                        const c = VOLUME_COLORS[sc];
                        const prefix = sc;
                        return (
                          <React.Fragment key={sc}>
                            <Line type="monotone" dataKey={`${prefix}_opt`} stroke={c.baseline} strokeWidth={1} strokeDasharray="2 3" dot={false} opacity={0.4} legendType="none" connectNulls />
                            <Line type="monotone" dataKey={`${prefix}_pess`} stroke={c.baseline} strokeWidth={1} strokeDasharray="2 3" dot={false} opacity={0.4} legendType="none" connectNulls />
                            <Line type="monotone" dataKey={`${prefix}_baseline`} name={`${scenarioLabel(sc)} Forecast`} stroke={c.baseline} strokeWidth={2} strokeDasharray="5 5" dot={false} connectNulls />
                            <Line type="monotone" dataKey={`${prefix}_actual`} name={`${scenarioLabel(sc)} Actual`} stroke={c.actual} strokeWidth={2.5}
                              dot={(props: any) => {
                                const { cx, cy, payload } = props;
                                const av = payload[`${prefix}_actual`];
                                const bv = payload[`${prefix}_baseline`];
                                if (av == null) return <g key={props.key} />;
                                return <circle key={props.key} cx={cx} cy={cy} r={3} fill={bv == null || av >= bv ? '#10b981' : '#ef4444'} stroke="white" strokeWidth={1} />;
                              }}
                              activeDot={{ r: 5 }} connectNulls={false} />
                          </React.Fragment>
                        );
                      })
                    : activeArpuScenarios.map(sc => {
                        const c = ARPU_SCENARIO_COLORS[sc];
                        const prefix = seriesPrefix(sc);
                        return (
                          <React.Fragment key={sc}>
                            {/* Band drawn for ARPU only. Revenue has no confidence
                                interval: multiplying an ARPU band by a volume point
                                estimate does not produce one, and a drawn band reads
                                as a tolerance. Suppressed entirely, not relabelled. */}
                            {valueUnit === 'arpu' && <>
                            <Line type="monotone" dataKey={`${prefix}_opt`} stroke={c.baseline} strokeWidth={1} strokeDasharray="2 3" dot={false} opacity={0.4} legendType="none" connectNulls />
                            <Line type="monotone" dataKey={`${prefix}_pess`} stroke={c.baseline} strokeWidth={1} strokeDasharray="2 3" dot={false} opacity={0.4} legendType="none" connectNulls />
                            </>}
                            <Line type="monotone" dataKey={`${prefix}_baseline`} name={`${scenarioLabel(sc)} Forecast`} stroke={c.baseline} strokeWidth={2} strokeDasharray="5 5" dot={false} connectNulls />
                            <Line type="monotone" dataKey={`${prefix}_actual`} name={`${scenarioLabel(sc)} Actual`} stroke={c.actual} strokeWidth={2.5}
                              dot={(props: any) => {
                                const { cx, cy, payload } = props;
                                const av = payload[`${prefix}_actual`];
                                const bv = payload[`${prefix}_baseline`];
                                if (av == null) return <g key={props.key} />;
                                return <circle key={props.key} cx={cx} cy={cy} r={3} fill={bv == null || av >= bv ? '#10b981' : '#ef4444'} stroke="white" strokeWidth={1} />;
                              }}
                              activeDot={{ r: 5 }} connectNulls={false} />
                          </React.Fragment>
                        );
                      })
                  }
                  <Brush dataKey="month" height={28} stroke="#e2e8f0" tickFormatter={() => ''} />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </div>
            );
          })()}

          {/* Variance tables — one collapsible section per active scenario */}
          <div className="border-t border-slate-100">
            {!hasScopedBaseline && comparisonRows.length > 0 && (
              <div className="px-6 py-6 text-center">
                <p className="text-sm font-medium text-slate-600">{t('actuals_no_forecast_matches_the_current_view_scope')}</p>
                <p className="text-xs text-slate-400 mt-1 max-w-xl mx-auto">{t('actuals_the_loaded_forecast_was_generated_for_a_diffe')}</p>
              </div>
            )}
            {(chartView === 'volume' ? activeVolumeScenarios : activeArpuScenarios).map(sc => {
              // In revenue mode this resolves to the *Rev_* keys, which have no
              // _opt/_pess. optVal/pessVal below therefore come back undefined,
              // inBand falls to null, and the column renders "—" on its own.
              // No special-casing: the invalid band cannot be computed because
              // its inputs do not exist.
              const prefix = chartView === 'volume' ? sc : seriesPrefix(sc);
              const tableRows = multiChartData.filter(r => r[`${prefix}_actual` as keyof MultiChartRow] !== undefined && r[`${prefix}_baseline` as keyof MultiChartRow] !== undefined);
              if (tableRows.length === 0) return null;
              return (
                <details key={sc} open className="border-b border-slate-100 last:border-0">
                  <summary className="px-6 py-3 bg-slate-50/50 flex items-center justify-between cursor-pointer select-none">
                    <h4 className="text-sm font-semibold text-slate-700">{scenarioLabel(sc)} {t('actuals_monthly_variance')}</h4>
                    <span className="text-xs text-slate-400">{tableRows.length} month{tableRows.length !== 1 ? 's' : ''} with actuals</span>
                  </summary>
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs text-left">
                      <thead className="text-slate-500 bg-slate-50 border-b border-slate-200">
                        <tr>
                          <th className="px-4 py-2.5 font-medium">{t('common_month')}</th>
                          <th className="px-4 py-2.5 text-right font-medium">{t('actuals_actual')}</th>
                          <th className="px-4 py-2.5 text-right font-medium">{t('actuals_baseline')}</th>
                          <th className="px-4 py-2.5 text-right font-medium">{t('actuals_variance')}</th>
                          <th className="px-4 py-2.5 text-right font-medium">{t('actuals_var_pct')}</th>
                          <th className="px-4 py-2.5 text-center font-medium">{t('actuals_in_band')}</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {tableRows.map(row => {
                          const actualVal   = row[`${prefix}_actual` as keyof MultiChartRow] as number;
                          const baselineVal = row[`${prefix}_baseline` as keyof MultiChartRow] as number ?? 0;
                          const optVal      = row[`${prefix}_opt` as keyof MultiChartRow] as number | undefined ?? null;
                          const pessVal     = row[`${prefix}_pess` as keyof MultiChartRow] as number | undefined ?? null;
                          const variance = actualVal - baselineVal;
                          const varPct = actualVal !== 0 ? (variance / Math.abs(actualVal)) * 100 : 0;
                          const inBand = optVal !== null && pessVal !== null
                            ? actualVal <= Math.max(optVal, baselineVal) && actualVal >= Math.min(pessVal, baselineVal)
                            : null;
                          return (
                            <tr key={row.month} className="hover:bg-slate-50/50 transition-colors">
                              <td className="px-4 py-2.5 font-medium text-slate-900">{row.month}</td>
                              <td className="px-4 py-2.5 text-right text-slate-700 font-medium">{formatNumber(actualVal)}</td>
                              <td className="px-4 py-2.5 text-right text-slate-500">{formatNumber(baselineVal)}</td>
                              <td className={`px-4 py-2.5 text-right font-medium ${variance >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                                {variance > 0 ? '+' : ''}{formatNumber(variance)}
                              </td>
                              <td className={`px-4 py-2.5 text-right font-medium ${Math.abs(varPct) < 5 ? 'text-emerald-600' : Math.abs(varPct) < 15 ? 'text-amber-600' : 'text-rose-600'}`}>
                                {varPct > 0 ? '+' : ''}{varPct.toFixed(1)}%
                              </td>
                              <td className="px-4 py-2.5 text-center">
                                {inBand === null ? <span className="text-slate-300">—</span>
                                  : inBand ? <span className="text-emerald-500">✓</span>
                                  : <span className="text-rose-400">✗</span>}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </details>
              );
            })}
          </div>
        </div>

        {/* ── Cohort accuracy table ── */}
        {cohortAccuracy.length > 0 && (
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">

            {/* Card header */}
            <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/50">
              <h3 className="text-sm font-semibold text-slate-700">{t('actuals_historical_accuracy_by_cohort')}</h3>
              <p className="text-xs text-slate-400 mt-0.5">{t('actuals_mape_compared_against_the_aggregate_baseline')}</p>
            </div>

            {/* Dimension selector */}
            <CohortDimCheckboxes
              dims={cohortDims}
              onChange={setCohortDims}
              wiProductCol={wiProductCol}
              wiProductL2Col={wiProductL2Col}
              wiChannelCol={wiChannelCol}
              wiChannelL2Col={wiChannelL2Col}
              wiTariffL1Col={wiTariffL1Col}
              wiTariffL2Col={wiTariffL2Col}
              count={cohortAccuracy.length}
            />

            {/* Search + forecast source toggle row */}
            <div className="px-6 py-2.5 border-b border-slate-100 flex items-center justify-between gap-4 bg-slate-50/30">
              {/* Cohort search */}
              <div className="relative w-48">
                <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                <input
                  type="text"
                  value={cohortSearch}
                  onChange={e => setCohortSearch(e.target.value)}
                  placeholder={t('actuals_search_cohorts')}
                  className="w-full pl-8 pr-7 py-1.5 text-xs border border-slate-200 rounded-lg bg-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#e60000]/30 focus:border-[#e60000]/50"
                />
                {cohortSearch && (
                  <button
                    type="button"
                    onClick={() => setCohortSearch('')}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  >
                    <X size={12} />
                  </button>
                )}
              </div>

              {/* Forecast source toggle — only shown when an adjusted forecast exists */}
              {adjustedForecast && (
                <div className="flex items-center gap-1 bg-white border border-slate-200 rounded-lg p-0.5 text-[11px] font-medium">
                  <button
                    onClick={() => setUseAdjustedScoring(false)}
                    className={`px-2.5 py-1 rounded-md transition-colors ${!useAdjustedScoring ? 'bg-slate-800 text-white shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                  >{t('actuals_exclude_market_events')}</button>
                  <button
                    onClick={() => setUseAdjustedScoring(true)}
                    className={`px-2.5 py-1 rounded-md transition-colors ${useAdjustedScoring ? 'bg-slate-800 text-white shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                  >{t('actuals_include_market_events')}</button>
                </div>
              )}
            </div>

            {/* Table — scrollable container with sticky header */}
            <div className="overflow-x-auto overflow-y-auto max-h-[60vh]">
              <table className="text-xs text-left" style={{ minWidth: '900px' }}>
                <thead className="text-slate-500 bg-slate-50 border-b border-slate-200 sticky top-0 z-20">
                  <tr>
                    <th className="px-4 py-3 font-medium sticky left-0 bg-slate-50 z-30 min-w-[160px]">{t('actuals_cohort')}</th>
                    {/* Volume columns */}
                    {(['Inflow', 'Outflow', 'Retention', 'Base'] as const).map(lbl => (
                      <th key={lbl} className="px-3 py-3 text-center font-medium min-w-[100px]">
                        <div className="relative inline-flex items-center gap-1 group/tip">
                          <span>{lbl}</span>
                          <Info size={10} className="text-slate-400 cursor-help" />
                          <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-56 p-3 bg-slate-800 text-white text-[10px] rounded-lg opacity-0 group-hover/tip:opacity-100 pointer-events-none transition-opacity z-20 leading-relaxed shadow-xl whitespace-normal">
                            <p className="font-semibold mb-1">{lbl} volume accuracy</p>
                            <p>{t('actuals_score_0_100_based_on_deviation_from_forecast')}</p>
                            <p className="mt-1 text-slate-300">{t('actuals_directional_bias_arrow_trend')}</p>
                          </div>
                        </div>
                      </th>
                    ))}
                    {/* Per-scenario ARPU columns */}
                    {([
                      [t('actuals_inf_arpu'),  t('actuals_inflow_arpu')],
                      [t('actuals_out_arpu'),  t('actuals_outflow_arpu')],
                      [t('actuals_ret_arpu'),  t('actuals_retention_arpu')],
                      [t('actuals_base_arpu'), t('actuals_base_arpu')],
                    ] as const).map(([short, full]) => (
                      <th key={short} className="px-2 py-3 text-center font-medium min-w-[80px]">
                        <div className="relative inline-flex items-center gap-1 group/tip">
                          <span className="text-[11px]">{short}</span>
                          <Info size={9} className="text-slate-400 cursor-help" />
                          <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-56 p-3 bg-slate-800 text-white text-[10px] rounded-lg opacity-0 group-hover/tip:opacity-100 pointer-events-none transition-opacity z-20 leading-relaxed shadow-xl whitespace-normal">
                            <p className="font-semibold mb-1">{full} accuracy</p>
                            <p>{t('actuals_score_0_100_how_closely_actual')}{full.toLowerCase()} {t('actuals_tracks_the_per_scenario_arpu_forecast_cone')}</p>
                            <p className="mt-1 text-slate-300">{t('actuals_directional_bias_arrow_trend')}</p>
                          </div>
                        </div>
                      </th>
                    ))}
                    {/* Overall */}
                    <th className="px-3 py-3 text-center font-medium min-w-[80px]">{t('actuals_overall')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {cohortAccuracy.filter(c => {
                    if (!cohortSearch.trim()) return true;
                    const key = c.cohortKey.toLowerCase();
                    return cohortSearch.trim().toLowerCase().split(/\s+/).every(token => key.includes(token));
                  }).map(c => {
                    const isSelected = selectedForecastCohortKey === c.cohortKey;

                    // Inline helper: renders one component score cell with bias + trend.
                    // Tooltip is triggered via showTooltip/hideTooltip which render a
                    // fixed-position overlay outside the scrollable container (no clipping).
                    const scoreCell = (
                      score: number | null,
                      bias: BiasVal,
                      trend: TrendVal,
                      detail: ComponentDetail | null,
                    ) => (
                      <td key={undefined} className="px-3 py-3 text-center">
                        <div className="inline-flex flex-col items-center gap-0.5">
                          <span
                            className={`inline-block px-2 py-0.5 rounded-full text-xs font-bold tabular-nums ${detail || c.noForecast ? 'cursor-help' : ''} ${scoreBg(score)}`}
                            onMouseEnter={
                              detail ? e => showTooltip(e, { kind: 'component', detail })
                              : c.noForecast ? e => showTooltip(e, { kind: 'noForecast' })
                              : undefined}
                            onMouseLeave={detail || c.noForecast ? hideTooltip : undefined}
                          >
                            {scoreLabel(score)}
                          </span>
                          <div className="flex items-center gap-1.5 mt-0.5">
                            {bias === 'above'
                              ? <span className="text-[9px] text-emerald-600 font-semibold leading-none">{t('actuals_over')}</span>
                              : bias === 'below'
                                ? <span className="text-[9px] text-rose-500 font-semibold leading-none">{t('actuals_under')}</span>
                                : <span className="text-[9px] text-slate-300 leading-none">—</span>
                            }
                            {trend === 'improving'
                              ? <span className="text-[9px] text-emerald-500 leading-none">↗</span>
                              : trend === 'worsening'
                                ? <span className="text-[9px] text-rose-400 leading-none">↘</span>
                                : trend === 'stable'
                                  ? <span className="text-[9px] text-slate-300 leading-none">→</span>
                                  : null
                            }
                          </div>
                        </div>
                      </td>
                    );

                    return (
                      <tr
                        key={c.cohortKey}
                        onClick={() => {
                          if (!isSelected) {
                            setSelectedForecastCohortKey(c.cohortKey);
                            if (c.worstKpi) setSelectedKpi(c.worstKpi);
                            // Sync the global filter to this cohort's dims so actuals,
                            // forecast, and variance table all compare the same scope.
                            onCohortFilterChange?.({
                              segment: c.seg,
                              product: {
                                l1: cohortDims.product   && c.prod   !== 'All' ? c.prod   : null,
                                l2: cohortDims.productL2 && c.prodL2 !== 'All' ? c.prodL2 : null,
                              },
                              channel: {
                                l1: cohortDims.channelL1 && c.chan   !== 'All' ? c.chan   : null,
                                l2: cohortDims.channelL2 && c.chanL2 !== 'All' ? c.chanL2 : null,
                              },
                              tariff: {
                                l1: cohortDims.tariffL1 && c.tariffL1 !== 'All' ? c.tariffL1 : null,
                                l2: cohortDims.tariffL2 && c.tariffL2 !== 'All' ? c.tariffL2 : null,
                              },
                            });
                          } else {
                            setSelectedForecastCohortKey(null);
                            // Reset filter when deselecting
                            onCohortFilterChange?.({ segment: 'All', product: { l1: null, l2: null }, channel: { l1: null, l2: null }, tariff: { l1: null, l2: null } });
                          }
                        }}
                        className={`cursor-pointer transition-colors ${
                          isSelected
                            ? 'bg-indigo-50 ring-1 ring-inset ring-indigo-200'
                            : 'hover:bg-slate-50/50'
                        }`}
                      >
                        <td className={`px-4 py-3 font-medium sticky left-0 z-10 ${isSelected ? 'bg-indigo-50 text-indigo-900' : 'bg-white text-slate-800'}`}>
                          {c.label}
                        </td>
                        {scoreCell(c.inflowScore,       c.inflowBias,       c.inflowTrend,       c.inflowDetail)}
                        {scoreCell(c.outflowScore,      c.outflowBias,      c.outflowTrend,      c.outflowDetail)}
                        {scoreCell(c.retentionScore,    c.retentionBias,    c.retentionTrend,    c.retentionDetail)}
                        {scoreCell(c.baseScore,         c.baseBias,         c.baseTrend,         c.baseDetail)}
                        {scoreCell(c.inflowArpuScore,    c.inflowArpuBias,    c.inflowArpuTrend,    c.inflowArpuDetail)}
                        {scoreCell(c.outflowArpuScore,   c.outflowArpuBias,   c.outflowArpuTrend,   c.outflowArpuDetail)}
                        {scoreCell(c.retentionArpuScore, c.retentionArpuBias, c.retentionArpuTrend, c.retentionArpuDetail)}
                        {scoreCell(c.baseArpuScore,      c.baseArpuBias,      c.baseArpuTrend,      c.baseArpuDetail)}
                        {/* Overall score. A noForecast row has no components to
                            average, so the 'overall' card would render an empty
                            list and a bare em-dash — the one cell still offering a
                            tooltip saying nothing, and the grey dash reading as a
                            fault again. Routed to the same explanation instead. */}
                        <td className="px-3 py-3 text-center">
                          <span
                            className={`inline-block px-2 py-0.5 rounded-full text-xs font-bold cursor-help ${scoreBg(c.overallScore)}`}
                            onMouseEnter={e => showTooltip(e, c.noForecast ? { kind: 'noForecast' } : { kind: 'overall', row: c })}
                            onMouseLeave={hideTooltip}
                          >
                            {scoreLabel(c.overallScore)}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                  {cohortSearch.trim() && cohortAccuracy.filter(c => {
                    const key = c.cohortKey.toLowerCase();
                    return cohortSearch.trim().toLowerCase().split(/\s+/).every(token => key.includes(token));
                  }).length === 0 && (
                    <tr>
                      <td colSpan={10} className="px-4 py-8 text-center text-xs text-slate-400">
                        
                        {t('actuals_no_cohorts_match_andldquo')}{cohortSearch}{t('actuals_andrdquo')}
                      </td>
                    </tr>
                  )}
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
            <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between gap-3 shrink-0">
              <div className="flex items-center gap-3">
                <div className="bg-indigo-100 p-2 rounded-lg shrink-0">
                  <Cpu size={18} className="text-indigo-600" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-slate-900">{t('common_automl_challenger_evaluation')}</h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {challengerShowAll
                      ? t('actuals_showing_all_cohorts_threshold_override_active')
                      : t('actuals_cohorts_scoring_below_85_on_the_accuracy_inde')}
                  </p>
                </div>
              </div>
              {challengerShowAll && (
                <button
                  type="button"
                  onClick={() => setChallengerShowAll(false)}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-amber-700 bg-amber-50 border border-amber-200 rounded-lg hover:bg-amber-100 transition-colors shrink-0"
                >
                  <X size={12} />{t('actuals_reset_to_threshold')}</button>
              )}
            </div>

            {/* ── Dimension selector — independent from Forecast vs Actuals tab ── */}
            <CohortDimCheckboxes
              dims={challengerDims}
              onChange={setChallengerDims}
              wiProductCol={wiProductCol}
              wiProductL2Col={wiProductL2Col}
              wiChannelCol={wiChannelCol}
              wiChannelL2Col={wiChannelL2Col}
              count={challengerGroups.length}
              countLabel={t('actuals_cohort_to_review')}
            />

            {/* ── Body — fills remaining height ── */}
            <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-12 overflow-hidden">

              {/* Left panel — cohort list with filter bar (independent scroll) */}
              <div className="lg:col-span-4 border-r border-slate-100 bg-slate-50/30 flex flex-col overflow-hidden">

                {/* Pinned sub-header */}
                <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between bg-white shrink-0">
                  <span className="text-xs font-semibold text-slate-700">{t('actuals_cohorts_to_review')}</span>
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
                      placeholder={t('actuals_search_cohorts')}
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
                      <option value="all">{t('actuals_all_statuses')}</option>
                      <option value="action_required">{t('actuals_action_required')}</option>
                      <option value="best_applied">{t('actuals_best_model_applied')}</option>
                    </select>
                    <select
                      value={challengerModelFilter}
                      onChange={e => setChallengerModelFilter(e.target.value as typeof challengerModelFilter)}
                      className="flex-1 min-w-0 text-[11px] border border-slate-200 rounded-lg px-2 py-1.5 bg-slate-50 outline-none focus:ring-1 focus:ring-indigo-300 focus:border-indigo-300 text-slate-700 cursor-pointer"
                    >
                      <option value="All">{t('actuals_all_models')}</option>
                      <option value="Simple Exponential Smoothing">Simple Exponential Smoothing</option>
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
                      // Build full label from every dimension that is currently checked.
                      const dimParts = [
                        g.cohort.segment,
                        challengerDims.product   && g.cohort.product   !== 'All' ? g.cohort.product   : null,
                        challengerDims.productL2 && g.cohort.productL2 && g.cohort.productL2 !== 'All' ? g.cohort.productL2 : null,
                        challengerDims.channelL1 && g.cohort.channel   !== 'All' ? g.cohort.channel   : null,
                        challengerDims.channelL2 && g.cohort.channelL2 && g.cohort.channelL2 !== 'All' ? g.cohort.channelL2 : null,
                      ].filter(Boolean) as string[];
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
                            <p className="text-xs font-semibold text-slate-700 leading-snug">
                              {dimParts.map((part, i) => (
                                <span key={i}>
                                  {i > 0 && <span className="text-slate-300 mx-0.5">·</span>}
                                  {part}
                                </span>
                              ))}
                            </p>
                            {isAccepted ? (
                              <span
                                className="relative group inline-flex items-center gap-1 text-[10px] font-medium text-amber-700 mt-0.5 cursor-help"
                              >
                                <Info size={10} className="shrink-0" />{t('actuals_best_model_applied_still_outside_threshold')}{' '}<span className="absolute bottom-full left-0 mb-1.5 hidden group-hover:block w-72 bg-white border border-slate-200 rounded-xl shadow-lg text-xs text-slate-600 p-2.5 z-50 pointer-events-none font-normal normal-case">{t('actuals_the_most_appropriate_model_has_been_selected')}</span>
                              </span>
                            ) : (
                              <p className="text-[10px] text-indigo-600 font-medium mt-0.5">
                                
                                {t('actuals_best')}{g.bestModel.name}
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
                    <p className="text-xs font-medium text-slate-500 mb-1">{t('actuals_no_cohorts_match')}</p>
                    <p className="text-[10px] text-slate-400 leading-snug mb-3">{t('actuals_try_adjusting_the_search_term_or_filters_abov')}</p>
                    <button
                      onClick={() => {
                        setChallengerSearch('');
                        setChallengerStatus('all');
                        setChallengerModelFilter('All');
                      }}
                      className="text-[11px] font-medium text-indigo-600 hover:text-indigo-700 transition-colors"
                    >{t('actuals_clear_all_filters')}</button>
                  </div>
                )}
              </div>

              {/* Right panel — recommendation + chart */}
              <div className="lg:col-span-8 flex flex-col overflow-hidden bg-white">
                {selectedChallengerGroup ? (
                  <>
                    {(() => {
                      const preview = challengerPreviews.get(selectedChallengerGroup.key);
                      const isRunning = runningChallengerKey === selectedChallengerGroup.key;
                      const alreadyAccepted = acceptedCohortKeys.has(selectedChallengerGroup.key);

                      // ── Preview mode: real forecast has been computed ──────────────
                      if (preview) {
                        // Build chart data: Actual | Current model | Challenger (real)
                        const previewChartData = selectedChallengerGroup.chartData.map((pt, i) => {
                          const chalMonth = preview.months[i];
                          return {
                            ...pt,
                            'Challenger (Real)': chalMonth?.inflow.mean ?? undefined,
                          };
                        });
                        // Compute real MAPE for comparison
                        let currentErr = 0, challengerErr = 0, totalAct = 0;
                        selectedChallengerGroup.chartData.forEach((pt, i) => {
                          if (pt.Actual === undefined) return;
                          const curFc = pt[selectedChallengerGroup.chosenModel as keyof typeof pt] as number | undefined;
                          const chalFc = preview.months[i]?.inflow.mean;
                          if (curFc) { currentErr += Math.abs(pt.Actual - curFc); totalAct += pt.Actual; }
                          if (chalFc !== undefined) challengerErr += Math.abs(pt.Actual - chalFc);
                        });
                        const currentPct  = totalAct ? (currentErr  / totalAct) * 100 : 0;
                        const challengerPct = totalAct ? (challengerErr / totalAct) * 100 : 0;
                        const challengerBetter = challengerPct < currentPct;

                        return (
                          <>
                            {/* Preview decision banner */}
                            <div className="shrink-0 px-6 pt-5 pb-0">
                              <div className={`border rounded-xl p-4 flex items-start justify-between gap-4 ${challengerBetter ? 'bg-emerald-50 border-emerald-200' : 'bg-amber-50 border-amber-200'}`}>
                                <div>
                                  <div className="flex items-center gap-2 mb-1">
                                    {challengerBetter
                                      ? <CheckCircle2 className="text-emerald-600" size={16} />
                                      : <AlertTriangle className="text-amber-500" size={16} />}
                                    <h4 className={`font-semibold text-sm ${challengerBetter ? 'text-emerald-900' : 'text-amber-900'}`}>
                                      Real {preview.modelUsed} forecast computed
                                    </h4>
                                  </div>
                                  <p className={`text-xs leading-relaxed ${challengerBetter ? 'text-emerald-700' : 'text-amber-700'}`}>
                                    
                                    {t('actuals_current')}{selectedChallengerGroup.chosenModel}{t('actuals_mape')}{' '}
                                    <strong className="text-rose-600">{currentPct.toFixed(1)}%</strong>
                                    {' · '}
                                    {preview.modelUsed} {t('actuals_mape')}{' '}
                                    <strong className={challengerBetter ? 'text-emerald-700' : 'text-amber-700'}>{challengerPct.toFixed(1)}%</strong>
                                    {challengerBetter
                                      ? t('actuals_challenger_performs_better_on_historical_data')
                                      : t('actuals_current_model_performs_better_on_historical_d')}
                                  </p>
                                </div>
                                <div className="flex items-center gap-2 shrink-0">
                                  <button
                                    type="button"
                                    onClick={handleDiscardPreview}
                                    className="px-3 py-1.5 text-xs font-medium text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
                                  >{t('actuals_keep_current')}</button>
                                  <button
                                    type="button"
                                    onClick={handleAcceptPreview}
                                    className="px-3 py-1.5 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg transition-colors"
                                  >
                                    Accept {preview.modelUsed}
                                  </button>
                                </div>
                              </div>
                            </div>

                            {/* Legend */}
                            <div className="shrink-0 flex flex-wrap gap-4 text-xs text-slate-600 px-6 py-3">
                              <span className="flex items-center gap-1.5">
                                <span className="inline-block w-3 h-3 rounded-full bg-slate-800" />{t('actuals_actual')}</span>
                              <span className="flex items-center gap-1.5">
                                <span className="inline-block w-3 h-3 rounded-full bg-slate-400" />
                                {selectedChallengerGroup.chosenModel} (current)
                              </span>
                              <span className="flex items-center gap-1.5">
                                <span className="inline-block w-3 h-3 rounded-full bg-indigo-500" />
                                {preview.modelUsed} (real challenger)
                              </span>
                            </div>

                            {/* Real comparison chart */}
                            <div className="flex-1 min-h-0 px-6 pb-5">
                              <ResponsiveContainer width="100%" height="100%">
                                <ComposedChart data={previewChartData} margin={{ top: 5, right: 20, left: 0, bottom: 30 }}>
                                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                                  <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} />
                                  <YAxis tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} tickFormatter={formatNumber} width={65} />
                                  <Tooltip
                                    contentStyle={{ borderRadius: '10px', border: '1px solid #e2e8f0' }}
                                    formatter={(v: any, n: string) => [v != null ? formatNumber(v) : '—', n]}
                                  />
                                  <Line type="monotone" dataKey="Actual" stroke="#0f172a" strokeWidth={2.5} dot={{ r: 3 }} activeDot={{ r: 5 }} connectNulls={false} />
                                  <Line type="monotone" dataKey={selectedChallengerGroup.chosenModel} stroke="#94a3b8" strokeWidth={1.5} strokeDasharray="5 5" dot={false} />
                                  <Line type="monotone" dataKey="Challenger (Real)" stroke="#6366f1" strokeWidth={2.5} dot={false} activeDot={{ r: 4 }} />
                                  <Brush dataKey="month" height={24} stroke="#e2e8f0" tickFormatter={() => ''} />
                                </ComposedChart>
                              </ResponsiveContainer>
                            </div>
                          </>
                        );
                      }

                      // ── Illustration mode: no real run yet ────────────────────────
                      return (
                        <>
                          {/* Illustration banner */}
                          <div className="shrink-0 px-6 pt-5 pb-0">
                            {(() => {
                              const alreadyBest = selectedChallengerGroup.bestModel.name === selectedChallengerGroup.chosenModel;
                              const bannerAmber = alreadyAccepted;
                              return (
                                <div className={`border rounded-xl p-4 flex items-start justify-between gap-4 ${bannerAmber ? 'bg-amber-50 border-amber-200' : 'bg-slate-50 border-slate-200'}`}>
                                  <div>
                                    <div className="flex items-center gap-2 mb-1">
                                      <Info className={bannerAmber ? 'text-amber-600' : 'text-slate-500'} size={15} />
                                      <h4 className={`font-semibold text-sm ${bannerAmber ? 'text-amber-900' : 'text-slate-700'}`}>
                                        {bannerAmber ? t('actuals_best_model_applied_still_outside_threshold') : t('actuals_illustration_run_a_real_forecast_to_compare')}
                                      </h4>
                                    </div>
                                    <p className={`text-xs leading-relaxed ${bannerAmber ? 'text-amber-700' : 'text-slate-500'}`}>
                                      {bannerAmber
                                        ? <>{t('actuals_model_applied_from')}{modelSwitchPoint?.month ?? 'this period'}{t('actuals_error_still_above_threshold')}</>
                                        : alreadyBest
                                          ? t('actuals_your_chosen_model_is_already_the_best_perform')
                                          : <>
                                              
                                              {t('actuals_the_chart_below_shows_estimated_trajectories')}{' '}
                                              <strong>{t('actuals_run_forecast')}</strong> {t('actuals_to_compute_the_real')}{' '}
                                              {selectedChallengerGroup.bestModel.name} {t('actuals_output_for_this_cohort_and_compare_it_directl')}
                                            </>
                                      }
                                    </p>
                                  </div>
                                  {/* Run buttons — one per challenger model */}
                                  {!alreadyAccepted && !alreadyBest && (
                                    <div className="flex flex-col gap-1.5 shrink-0">
                                      {selectedChallengerGroup.models
                                        .filter(m => m.name !== selectedChallengerGroup.chosenModel)
                                        .map(m => (
                                          <button
                                            key={m.name}
                                            type="button"
                                            disabled={isRunning}
                                            onClick={() => handleRunChallenger(m.name as ForecastModel)}
                                            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white rounded-lg transition-colors disabled:opacity-60 disabled:cursor-wait"
                                            style={{ backgroundColor: m.color }}
                                          >
                                            {isRunning ? t('actuals_running') : t('actuals_run', { p0: m.name })}
                                          </button>
                                        ))}
                                    </div>
                                  )}
                                  {alreadyAccepted && (
                                    <span className="text-xs text-amber-700 font-medium bg-amber-100 px-3 py-2 rounded-lg whitespace-nowrap shrink-0 flex items-center gap-1">
                                      <CheckCircle2 size={12} />{t('actuals_model_applied')}</span>
                                  )}
                                  {alreadyBest && !alreadyAccepted && (
                                    <span className="text-xs text-emerald-700 font-medium bg-emerald-100 px-3 py-2 rounded-lg whitespace-nowrap shrink-0">{t('actuals_already_optimal')}</span>
                                  )}
                                </div>
                              );
                            })()}
                          </div>

                          {/* Illustration legend */}
                          <div className="shrink-0 flex flex-wrap gap-4 text-xs text-slate-500 px-6 py-3">
                            <span className="italic text-[11px] text-slate-400 self-center">{t('actuals_estimated_trajectories_only')}</span>
                            {selectedChallengerGroup.models.map(m => (
                              <span key={m.name} className="flex items-center gap-1.5">
                                <span className="inline-block w-3 h-3 rounded-full" style={{ backgroundColor: m.color }} />
                                {m.name} ({m.error.toFixed(1)}{t('actuals_pct_err')}
                                {m.name === selectedChallengerGroup.chosenModel && (
                                  <span className="text-[9px] font-bold bg-slate-200 text-slate-600 px-1 py-0.5 rounded uppercase tracking-wide">current</span>
                                )}
                              </span>
                            ))}
                          </div>

                          {/* Illustration chart */}
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
                      );
                    })()}
                  </>
                ) : (
                  <div className="flex-1 flex items-center justify-center text-slate-400 text-sm">{t('actuals_select_a_cohort_to_view_the_model_comparison')}</div>
                )}
              </div>
            </div>
          </div>
        ) : (
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-10 flex flex-col items-center text-center gap-4">
            <div className="bg-emerald-50 p-4 rounded-full">
              <CheckCircle2 className="text-emerald-500" size={32} />
            </div>
            <div>
              <h4 className="text-base font-semibold text-slate-800 mb-1">{t('common_all_models_performing_well')}</h4>
              <p className="text-sm text-slate-500 max-w-md">
                
                {t('actuals_no_cohorts_scored_below_85_on_the_accuracy_in')}{' '}
                {baseForecast?.modelUsed ?? 'Holt Linear'} {t('actuals_is_performing_well_for_all_segments_at_the_cu')}
              </p>
            </div>
            {/* Diagnostic note */}
            <div className="flex items-start gap-2 bg-amber-50 border border-amber-100 rounded-xl px-4 py-3 text-left max-w-md">
              <AlertTriangle size={15} className="text-amber-500 shrink-0 mt-0.5" />
              <p className="text-xs text-amber-800 leading-relaxed">
                <span className="font-semibold">{t('actuals_note')}</span>{t('actuals_the_challenger_comparison_uses_estimated_mode')}</p>
            </div>
            <button
              type="button"
              onClick={() => setChallengerShowAll(true)}
              className="flex items-center gap-2 px-5 py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-xl text-sm font-medium transition-colors shadow-sm"
            >
              <Info size={14} />{t('actuals_review_all_cohorts_anyway')}</button>
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
                  <h2 className="text-base font-bold text-slate-900">{t('actuals_accept_all_proposed_models')}</h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {acceptAllCandidates.length} cohort{acceptAllCandidates.length !== 1 ? 's' : ''} {t('actuals_will_be_re_forecast_with_their_recommended_mo')}
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
                <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide">{t('actuals_cohorts_to_be_updated')}</p>
              </div>
              <div className="divide-y divide-slate-50 max-h-64 overflow-y-auto">
                {acceptAllCandidates.map(g => {
                  const modalDimParts = [
                    g.cohort.segment,
                    challengerDims.product   && g.cohort.product   !== 'All' ? g.cohort.product   : null,
                    challengerDims.productL2 && g.cohort.productL2 && g.cohort.productL2 !== 'All' ? g.cohort.productL2 : null,
                    challengerDims.channelL1 && g.cohort.channel   !== 'All' ? g.cohort.channel   : null,
                    challengerDims.channelL2 && g.cohort.channelL2 && g.cohort.channelL2 !== 'All' ? g.cohort.channelL2 : null,
                  ].filter(Boolean) as string[];
                  return (
                  <div key={g.key} className="flex items-center justify-between px-4 py-2.5 text-xs">
                    <div>
                      <p className="font-semibold text-slate-800">{modalDimParts.join(' · ')}</p>
                    </div>
                    <div className="flex items-center gap-2 text-slate-500 shrink-0">
                      <span className="bg-slate-100 text-slate-600 px-2 py-0.5 rounded font-medium">{g.chosenModel}</span>
                      <ArrowRight size={12} className="text-slate-400" />
                      <span className="bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded font-semibold">{g.bestModel.name}</span>
                    </div>
                  </div>
                  );
                })}
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center justify-end gap-3 px-6 py-4 bg-slate-50 border-t border-slate-100">
              <button
                onClick={() => setShowAcceptAllModal(false)}
                className="px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-800 transition-colors"
              >{t('common_cancel')}</button>
              <button
                onClick={handleAcceptAll}
                className="px-5 py-2 bg-[#e60000] hover:bg-[#cc0000] text-white rounded-lg text-sm font-semibold transition-colors flex items-center gap-2"
              >
                <Cpu size={14} />
                Apply {acceptAllCandidates.length} Model{acceptAllCandidates.length !== 1 ? 's' : ''}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>

    {/* Remove Actuals Modal */}
    {showRemoveModal && (
      <RemoveActualsModal
        data={data}
        wiDateCol={wiDateCol}
        wiSegmentCol={wiSegmentCol}
        wiProductCol={wiProductCol}
        wiChannelCol={wiChannelCol}
        onConfirm={(keepFn, removedCount) => {
          onRemoveActuals(keepFn, removedCount);
          setRemoveToast(t('actuals_row_removed_from_actuals', { p0: removedCount.toLocaleString(), p1: removedCount !== 1 ? 's' : '' }));
          setShowRemoveModal(false);
        }}
        onCancel={() => setShowRemoveModal(false)}
      />
    )}

    {/* ── Global accuracy tooltip — fixed position, never clipped by overflow containers ── */}
    {activeTooltip && (() => {
      const fmtN = (v: number) => Math.abs(v) >= 1000 ? (v / 1000).toFixed(1) + 'K' : v.toFixed(v % 1 === 0 ? 0 : 2);
      const TOOLTIP_W = activeTooltip.payload.kind === 'component' ? 428 : activeTooltip.payload.kind === 'noForecast' ? 260 : 228;
      // Clamp horizontal position so tooltip stays within viewport
      const vpW = window.innerWidth;
      const left = Math.min(Math.max(activeTooltip.x - TOOLTIP_W / 2, 8), vpW - TOOLTIP_W - 8);
      // Determine whether to open above or below the trigger
      const openAbove = activeTooltip.y > 320;
      const style: React.CSSProperties = {
        position: 'fixed',
        left,
        zIndex: 9999,
        width: TOOLTIP_W,
        ...(openAbove ? { bottom: window.innerHeight - activeTooltip.y + 8 } : { top: activeTooltip.y + 8 }),
      };
      const meanColLabel = useAdjustedScoring && adjustedForecast ? t('actuals_adj_mean') : t('actuals_mean');
      const sourceLabel  = useAdjustedScoring && adjustedForecast ? t('actuals_adjusted_forecast') : t('actuals_baseline_forecast');
      if (activeTooltip.payload.kind === 'noForecast') {
        // Same dark card as every other accuracy tooltip. A grey dash with no
        // explanation reads as a rendering fault rather than a state, and
        // leaving users to infer why is what produced the original defect.
        return (
          <div style={style} className="bg-slate-900 text-white rounded-xl shadow-2xl p-3 pointer-events-none text-left">
            <p className="text-xs text-slate-200 leading-snug">{t('actuals_no_forecast_yet_tooltip')}</p>
          </div>
        );
      }
      if (activeTooltip.payload.kind === 'component') {
        const detail = activeTooltip.payload.detail;
        return (
          <div style={style} className="bg-slate-900 text-white rounded-xl shadow-2xl p-3 pointer-events-none text-left">
            {/* Source indicator */}
            <p className="text-[9px] font-semibold uppercase tracking-widest text-slate-500 mb-1.5">{t('actuals_source')}{sourceLabel}</p>
            <div className="flex items-center justify-between mb-2 pb-2 border-b border-slate-700">
              <span className="text-xs font-bold text-white">{detail.label}</span>
              <span className="text-[11px] text-slate-400">
                {detail.rows.length} month{detail.rows.length !== 1 ? 's' : ''} {t('actuals_avg_dev')}{detail.avgDev.toFixed(1)}%
              </span>
            </div>
            <div className="font-mono text-[10px] text-slate-400 grid mb-1" style={{ gridTemplateColumns: '60px 60px 60px 48px 42px 54px' }}>
              <span>{t('common_month')}</span><span className="text-right">{t('actuals_actual')}</span><span className="text-right">{meanColLabel}</span>
              <span className="text-right">{t('actuals_devpct')}</span><span className="text-center">{t('actuals_band')}</span><span className="text-right">{t('actuals_score')}</span>
            </div>
            {detail.rows.map(r => (
              <div key={r.month} className="font-mono text-[10px] grid py-0.5 border-b border-slate-800 last:border-0" style={{ gridTemplateColumns: '60px 60px 60px 48px 42px 54px' }}>
                <span className="text-slate-300">{r.month.slice(2)}</span>
                <span className="text-right text-slate-200">{fmtN(r.actual)}</span>
                <span className="text-right text-slate-200">{fmtN(r.mean)}</span>
                <span className={`text-right font-semibold ${r.dev > 0 ? 'text-emerald-400' : r.dev < 0 ? 'text-rose-400' : 'text-slate-300'}`}>
                  {r.dev > 0 ? '+' : ''}{r.dev.toFixed(1)}%
                </span>
                <span className="text-center">{r.inBand ? '✓' : '✗'}</span>
                <span className="text-right">
                  <span className="text-white">{r.score.toFixed(0)}</span>
                  {r.penalty > 0 && <span className="text-amber-400 ml-0.5">(-{r.penalty})</span>}
                </span>
              </div>
            ))}
            <div className="mt-2 pt-1.5 flex justify-between text-[11px]">
              <span className="text-slate-400">{t('actuals_component_score')}</span>
              <span className={`font-bold ${scoreBg(detail.score).includes('emerald') ? 'text-emerald-400' : scoreBg(detail.score).includes('amber') ? 'text-amber-400' : scoreBg(detail.score).includes('orange') ? 'text-orange-400' : 'text-rose-400'}`}>
                {detail.score !== null ? detail.score.toFixed(0) : '—'}
              </span>
            </div>
          </div>
        );
      }
      // Overall tooltip
      const row = activeTooltip.payload.row;
      const components: [string, number | null][] = [
        ['Inflow', row.inflowScore], ['Outflow', row.outflowScore], ['Retention', row.retentionScore],
        ['Base', row.baseScore], ['ARPU', row.arpuScore],
      ].filter(([, s]) => s !== null) as [string, number][];
      return (
        <div style={style} className="bg-slate-900 text-white rounded-xl shadow-2xl p-3 pointer-events-none">
          <p className="text-[11px] font-bold text-white mb-2 pb-1.5 border-b border-slate-700">{t('actuals_overall_score')}</p>
          {components.map(([name, s]) => (
            <div key={name} className="flex items-center justify-between py-0.5">
              <span className="text-[11px] text-slate-300">{name}</span>
              <span className={`text-[11px] font-bold ${(s ?? 0) < 70 ? 'text-rose-400' : 'text-white'}`}>{s?.toFixed(0) ?? '—'}</span>
            </div>
          ))}
          <div className="mt-1.5 pt-1.5 border-t border-slate-700 flex justify-between">
            <span className="text-[11px] text-slate-400">{t('actuals_average')}</span>
            <span className="text-[11px] font-bold text-white">{row.overallScore?.toFixed(0) ?? '—'}</span>
          </div>
        </div>
      );
    })()}

    {/* Remove Actuals success toast */}
    {removeToast && (
      <div className="fixed bottom-6 right-6 z-50 flex items-center gap-3 bg-slate-900 text-white text-sm font-medium px-4 py-3 rounded-xl shadow-xl">
        <CheckCircle2 size={16} className="text-emerald-400 shrink-0" />
        {removeToast}
      </div>
    )}
    </>
  );
};

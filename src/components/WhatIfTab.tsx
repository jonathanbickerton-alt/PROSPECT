import React, { useMemo, useEffect, useState } from 'react';
import { ArrowLeft, Info, Download, Trash2, CheckCircle2, XCircle, Activity, AlertTriangle } from 'lucide-react';
import {
  ResponsiveContainer, LineChart, CartesianGrid, XAxis, YAxis, Tooltip,
  Legend, Line, Brush, ReferenceLine,
} from 'recharts';
import { format, parse, isValid } from 'date-fns';
import { useForecast } from '../context/ForecastContext';
import type { AdjustedForecastMonth, MarketEvent as NewMarketEvent, MarketEventAdjustedForecast } from '../types/forecast';
import type { MarketEvent } from '../utils/forecasting';

// ---------------------------------------------------------------------------
// Props — only what this step actually needs
// ---------------------------------------------------------------------------

interface WhatIfTabProps {
  /** Raw data rows — used to populate segment/product/channel options in the event form */
  data: any[];
  wiSegmentCol: string;
  wiProductCol: string;
  wiChannelCol: string;
  newEvent: Partial<MarketEvent>;
  setNewEvent: (e: Partial<MarketEvent>) => void;
  marketEvents: MarketEvent[];
  setMarketEvents: (e: MarketEvent[]) => void;
  addMarketEvent: () => void;
  removeMarketEvent: (id: string) => void;
  downloadExcel: (data: any[], filename: string, params?: any[]) => void;
  formatNumber: (v: any) => string;
  setActiveView: (v: string) => void;
  /** Calendar months absent from the cohort's historical series — populated by gap detection in computeWhatIfData */
  missingMonths?: string[];
}

// ---------------------------------------------------------------------------
// KPI config
// ---------------------------------------------------------------------------

const KPI_LIST = ['Inflow', 'Outflow', 'Retention', 'Base', 'ARPU'] as const;
type KpiName = typeof KPI_LIST[number];

const KPI_COLORS: Record<KpiName, { baseline: string; adjusted: string; axis: 'left' | 'right' }> = {
  Inflow:    { baseline: '#3b82f6', adjusted: '#2563eb', axis: 'left' },
  Outflow:   { baseline: '#f59e0b', adjusted: '#d97706', axis: 'left' },
  Retention: { baseline: '#ec4899', adjusted: '#db2777', axis: 'left' },
  Base:      { baseline: '#10b981', adjusted: '#059669', axis: 'left' },
  ARPU:      { baseline: '#06b6d4', adjusted: '#0891b2', axis: 'right' },
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Build a key for one scenario — used when writing to savedForecasts */
function fmtMonth(m: string) {
  try {
    const d = parse(m, 'yyyy-MM', new Date());
    return isValid(d) ? format(d, 'MMM yyyy') : m;
  } catch {
    return m;
  }
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export const WhatIfTab: React.FC<WhatIfTabProps> = ({
  data,
  wiSegmentCol,
  wiProductCol,
  wiChannelCol,
  newEvent,
  setNewEvent,
  marketEvents,
  setMarketEvents,
  addMarketEvent,
  removeMarketEvent,
  downloadExcel,
  formatNumber,
  setActiveView,
  missingMonths,
}) => {
  const { baseForecast, setAdjustedForecast } = useForecast();

  const [selectedKpis, setSelectedKpis] = useState<KpiName[]>(['Inflow', 'Outflow', 'Base']);

  // ---------------------------------------------------------------------------
  // Local view filter — independent from Step 1 selections.
  // Defaults to 'All' on every mount; never reads from baseForecast.cohort.
  // ---------------------------------------------------------------------------
  const [viewSegment, setViewSegment] = useState('All');
  const [viewProduct, setViewProduct] = useState('All');
  const [viewChannel, setViewChannel] = useState('All');
  // 'All' means all KPIs visible; a specific scenario pre-selects that KPI.
  const [viewScenario, setViewScenario] = useState('All');

  // When the scenario dimension changes, sync the KPI toggle to match.
  useEffect(() => {
    if (viewScenario === 'All') {
      setSelectedKpis(['Inflow', 'Outflow', 'Base']);
    } else {
      setSelectedKpis([viewScenario as KpiName]);
    }
  }, [viewScenario]);

  const [windowSize, setWindowSize] = useState(12);
  const [windowOffset, setWindowOffset] = useState(0);

  // -------------------------------------------------------------------------
  // Derive adjusted months from BaseForecast + market events (no HW re-run)
  // -------------------------------------------------------------------------

  const { chartData, adjustedMonths } = useMemo<{
    chartData: any[];
    adjustedMonths: AdjustedForecastMonth[];
  }>(() => {
    if (!baseForecast) return { chartData: [], adjustedMonths: [] };

    // Use the local view filter for event matching so the chart reflects the
    // currently selected view scope — not the cohort from Step 1.
    const vseg = viewSegment;
    const vprod = viewProduct;
    const vchan = viewChannel;

    // ---------------------------------------------------------------------------
    // Pass 1 — apply market events to each forecast month.
    //
    // Computes uplifted IBRO flows; uplifted.arpu holds any direct ARPU-event
    // adjustments.  Pass 2 overwrites it with the cohort-pool blended ARPU.
    // ---------------------------------------------------------------------------

    const computed: AdjustedForecastMonth[] = [];

    baseForecast.months.forEach(month => {
      const applicable = marketEvents.filter(e => {
        if (e.date !== month.month) return false;
        const segMatch = e.segment === 'All' || vseg === 'All' || e.segment === vseg;
        const prodMatch = e.product === 'All' || vprod === 'All' || e.product === vprod;
        const chanMatch = e.channel === 'All' || vchan === 'All' || e.channel === vchan;
        return segMatch && prodMatch && chanMatch;
      });

      let adjInflow = month.inflow.mean;
      let adjOutflow = month.outflow.mean;
      let adjRetention = month.retention.mean;
      let adjArpu = month.arpu.mean;   // direct ARPU-event adjustments only
      const appliedIds: string[] = [];

      applicable.forEach(e => {
        if (e.scenario === 'Inflow') {
          adjInflow += e.subscriberVolume;
        } else if (e.scenario === 'Outflow') {
          // subscriberVolume is stored as a negative number for Outflow events.
          // Subtracting a negative value adds its absolute magnitude to adjOutflow,
          // which correctly increases outflow and reduces Base (T+1 via lagged formula).
          adjOutflow -= e.subscriberVolume;
        } else if (e.scenario === 'Retention') {
          // Retention events reduce Outflow AND increase Retention tracking.
          // Because Retention is not in the base stock formula, only the Outflow
          // reduction affects Base (one month later, via the lagged formula).
          adjOutflow -= e.subscriberVolume;
          adjRetention += e.subscriberVolume;
        } else if (e.scenario === 'ARPU') {
          // Direct ARPU pricing change — additive, applies to all subscribers.
          adjArpu += e.arpu;
        }
        appliedIds.push(e.id);
      });

      computed.push({
        month: month.month,
        baseline: {
          inflow: month.inflow.mean,
          retention: month.retention.mean,
          outflow: month.outflow.mean,
          arpu: month.arpu.mean,
        },
        uplifted: {
          inflow: Math.max(0, adjInflow),
          retention: Math.max(0, adjRetention),
          outflow: Math.max(0, adjOutflow),
          // uplifted.arpu starts as the direct-event-adjusted value; it will be
          // overwritten below with the blended ARPU once Base volumes are known.
          arpu: Math.max(0, adjArpu),
        },
        appliedEventIds: appliedIds,
      });
    });

    // ---------------------------------------------------------------------------
    // Pass 2 — cohort-pool ARPU calculation.
    //
    // Each Inflow event creates an isolated subscriber pool with its own ARPU
    // and a contract-length protection window (default 24 months).  The existing
    // base subscribers form a second pool.
    //
    // Outflow allocation each month:
    //   1. Draw first from the at-risk base pool  (1/DEFAULT_CONTRACT_N of the
    //      base pool churns per month — uniform age distribution assumption).
    //   2. If outflow exceeds the at-risk base, draw the remainder
    //      proportionally from any event pools whose protection window has elapsed.
    //   3. Proportional fallback to all pools for any residual.
    //
    // Blended ARPU = (basePool × baseARPU + Σ eventPool_i × eventARPU_i) / total
    // ---------------------------------------------------------------------------

    const DEFAULT_CONTRACT_N = 24;

    interface EventPool {
      eventId: string;
      arpu: number;           // fixed per-subscriber ARPU for this cohort
      contractLength: number; // protection window in months
      enterMonthIdx: number;  // 0-based index when they enter Base (event month + 1)
      size: number;           // current subscriber count
    }

    let p_bBase = baseForecast.seedBaseVolume;
    let p_bAdj  = baseForecast.seedBaseVolume;
    let p_basePool = baseForecast.seedBaseVolume;
    const p_eventPools: EventPool[] = [];

    let p_prevBBaseIn  = baseForecast.lastHistoricalInflow;
    let p_prevBBaseOut = baseForecast.lastHistoricalOutflow;
    let p_prevBAdjIn   = baseForecast.lastHistoricalInflow;
    let p_prevBAdjOut  = baseForecast.lastHistoricalOutflow;

    const rows = computed.map((m, idx) => {
      // ── A: Compute total subscriber counts (lagged formula) ──
      const newBBase = Math.max(0, p_bBase + p_prevBBaseIn - p_prevBBaseOut);
      const newBAdj  = Math.max(0, p_bAdj  + p_prevBAdjIn  - p_prevBAdjOut);

      // ── B: Allocate last month's outflow between pools ──
      // Uses pool sizes as they were at start of this month (before adding new inflow).
      const totalOutflow = p_prevBAdjOut;
      if (totalOutflow > 0 && p_bAdj > 0) {
        // At-risk base: 1/DEFAULT_CONTRACT_N of base pool expires each month.
        const atRiskBase = Math.min(p_basePool, p_basePool / DEFAULT_CONTRACT_N);
        let remaining = totalOutflow;

        const baseChurn = Math.min(atRiskBase, remaining);
        p_basePool = Math.max(0, p_basePool - baseChurn);
        remaining -= baseChurn;

        if (remaining > 0) {
          // Event pools whose protection window has elapsed
          const atRiskPools = p_eventPools.filter(
            p => p.size > 0 && (idx - p.enterMonthIdx) >= p.contractLength,
          );
          const atRiskTotal = atRiskPools.reduce((s, p) => s + p.size, 0);

          if (atRiskTotal > 0) {
            const eventChurn = Math.min(atRiskTotal, remaining);
            atRiskPools.forEach(p => {
              const take = eventChurn * (p.size / atRiskTotal);
              p.size = Math.max(0, p.size - take);
            });
            remaining -= eventChurn;
          }

          // Proportional fallback: distribute any remainder across all pools
          if (remaining > 0) {
            const totalSubs = p_basePool + p_eventPools.reduce((s, p) => s + p.size, 0);
            if (totalSubs > 0) {
              const frac = remaining / totalSubs;
              p_basePool = Math.max(0, p_basePool * (1 - frac));
              p_eventPools.forEach(p => { p.size = Math.max(0, p.size * (1 - frac)); });
            }
          }
        }
      }

      // ── C: Add last month's inflow to pools (T-1 lag) ──
      // Baseline inflow → base pool; Inflow event subscribers → own event pools.
      p_basePool += p_prevBBaseIn;
      if (idx > 0) {
        const prevMonthKey = computed[idx - 1].month;
        marketEvents
          .filter(e =>
            e.date === prevMonthKey &&
            e.scenario === 'Inflow' &&
            !p_eventPools.find(p => p.eventId === e.id) &&
            (e.segment === 'All' || vseg === 'All' || e.segment === vseg) &&
            (e.product === 'All' || vprod === 'All' || e.product === vprod) &&
            (e.channel === 'All' || vchan === 'All' || e.channel === vchan),
          )
          .forEach(e => {
            p_eventPools.push({
              eventId: e.id,
              arpu: e.arpu,
              contractLength: e.contractLength ?? DEFAULT_CONTRACT_N,
              enterMonthIdx: idx,
              size: Math.max(0, e.subscriberVolume),
            });
          });
      }

      // ── D: Enforce pool-sum consistency with newBAdj ──
      const eventTotal = p_eventPools.reduce((s, p) => s + p.size, 0);
      p_basePool = Math.max(0, newBAdj - eventTotal);

      // ── E: Blended ARPU ──
      // m.uplifted.arpu carries any direct ARPU-event adjustments from Pass 1;
      // use it as the effective per-subscriber ARPU for the base pool.
      const baseARPU = m.uplifted.arpu;
      let blendedARPU = baseARPU;

      if (newBAdj > 0 && eventTotal > 0) {
        const baseRevenue  = p_basePool * baseARPU;
        const eventRevenue = p_eventPools.reduce((s, p) => s + p.size * p.arpu, 0);
        blendedARPU = Math.max(0, (baseRevenue + eventRevenue) / newBAdj);
      }

      // Console logs for first 6 months (remove once verified)
      if (idx < 6) {
        console.log(
          `[PoolARPU] ${m.month} idx=${idx}:`,
          `basePool=${p_basePool.toFixed(0)} @${baseARPU.toFixed(2)}`,
          p_eventPools.length > 0
            ? p_eventPools.map(p =>
                `| pool[${p.eventId.slice(-4)}] size=${p.size.toFixed(0)} arpu=${p.arpu.toFixed(2)} age=${idx - p.enterMonthIdx}/${p.contractLength}`
              ).join(' ')
            : '| (no event pools)',
          `→ blended=${blendedARPU.toFixed(2)}`,
        );
      }

      m.uplifted.arpu = blendedARPU;

      const row = {
        month: m.month,
        'Inflow (Baseline)':    +m.baseline.inflow.toFixed(2),
        'Inflow (Adjusted)':    +m.uplifted.inflow.toFixed(2),
        'Outflow (Baseline)':   +m.baseline.outflow.toFixed(2),
        'Outflow (Adjusted)':   +m.uplifted.outflow.toFixed(2),
        'Retention (Baseline)': +m.baseline.retention.toFixed(2),
        'Retention (Adjusted)': +m.uplifted.retention.toFixed(2),
        'Base (Baseline)':      +newBBase.toFixed(2),
        'Base (Adjusted)':      +newBAdj.toFixed(2),
        'ARPU (Baseline)':      +m.baseline.arpu.toFixed(2),
        'ARPU (Adjusted)':      +blendedARPU.toFixed(2),
        hasEvent: m.appliedEventIds.length > 0,
      };

      p_prevBBaseIn  = m.baseline.inflow;
      p_prevBBaseOut = m.baseline.outflow;
      p_prevBAdjIn   = m.uplifted.inflow;
      p_prevBAdjOut  = m.uplifted.outflow;
      p_bBase = newBBase;
      p_bAdj  = newBAdj;

      return row;
    });

    return { chartData: rows, adjustedMonths: computed };
  }, [baseForecast, marketEvents, viewSegment, viewProduct, viewChannel]);

  // -------------------------------------------------------------------------
  // Write MarketEventAdjustedForecast back to context whenever inputs change
  // -------------------------------------------------------------------------

  useEffect(() => {
    if (!baseForecast || adjustedMonths.length === 0) {
      setAdjustedForecast(null);
      return;
    }

    // Convert legacy market events to the new typed format (ARPU events skipped —
    // they have no direct equivalent in the new MarketEventType enum yet)
    const typedEvents: NewMarketEvent[] = marketEvents
      .filter(e => e.scenario !== 'ARPU')
      .map(e => ({
        id: e.id,
        eventType: e.scenario as NewMarketEvent['eventType'],
        segment: e.segment,
        product: e.product,
        channel: e.channel,
        startMonth: e.date,
        durationMonths: 1,
        volumeImpact: e.subscriberVolume,
        arpuImpact: e.arpu,
        comment: e.comment,
      }));

    const adjusted: MarketEventAdjustedForecast = {
      base: baseForecast,
      marketEvents: typedEvents,
      adjustedMonths,
    };
    setAdjustedForecast(adjusted);
  }, [baseForecast, marketEvents]); // eslint-disable-line react-hooks/exhaustive-deps

  // -------------------------------------------------------------------------
  // Impact summary
  // -------------------------------------------------------------------------

  const impactSummary = useMemo(() => {
    if (!chartData.length) return null;
    const last = chartData[chartData.length - 1];
    const baseDelta = last['Base (Adjusted)'] - last['Base (Baseline)'];
    const arpuDelta = last['ARPU (Adjusted)'] - last['ARPU (Baseline)'];
    return { baseDelta, arpuDelta, eventCount: marketEvents.length };
  }, [chartData, marketEvents.length]);

  // -------------------------------------------------------------------------
  // Retention event validation — warn when event volume exceeds forecast Outflow
  // -------------------------------------------------------------------------

  const retentionWarnings = useMemo(() => {
    if (!baseForecast) return new Set<string>();
    const warned = new Set<string>();
    marketEvents
      .filter(e => e.scenario === 'Retention')
      .forEach(e => {
        const bm = baseForecast.months.find(m => m.month === e.date);
        if (bm && e.subscriberVolume > bm.outflow.mean) {
          warned.add(e.id);
        }
      });
    return warned;
  }, [baseForecast, marketEvents]);

  // -------------------------------------------------------------------------
  // Toggle KPI helper
  // -------------------------------------------------------------------------

  const toggleKpi = (kpi: KpiName) =>
    setSelectedKpis(prev => prev.includes(kpi) ? prev.filter(k => k !== kpi) : [...prev, kpi]);

  // -------------------------------------------------------------------------
  // No-baseline empty state
  // -------------------------------------------------------------------------

  if (!baseForecast) {
    return (
      <div className="flex-1 overflow-y-auto p-8 flex items-center justify-center">
        <div className="max-w-md text-center space-y-4">
          <div className="w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center mx-auto">
            <Activity size={28} className="text-slate-400" />
          </div>
          <h2 className="text-xl font-semibold text-slate-900">No Baseline Forecast Yet</h2>
          <p className="text-sm text-slate-500">
            Complete <strong>Step 1: Baseline Forecast</strong> and save at least one forecast before
            applying market events. The baseline IBRO series will appear here automatically.
          </p>
          <button
            onClick={() => setActiveView('standard')}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#e60000] text-white rounded-lg text-sm font-semibold hover:bg-[#cc0000] transition-colors"
          >
            <ArrowLeft size={16} /> Go to Step 1
          </button>
        </div>
      </div>
    );
  }

  // -------------------------------------------------------------------------
  // Unique dimension values for view filter dropdowns
  // -------------------------------------------------------------------------

  const segmentOptions = useMemo(
    () => Array.from(new Set(data.map(r => String(r[wiSegmentCol])).filter(v => v && v !== 'undefined'))).sort(),
    [data, wiSegmentCol],
  );
  const productOptions = useMemo(
    () => Array.from(new Set(data.map(r => String(r[wiProductCol])).filter(v => v && v !== 'undefined'))).sort(),
    [data, wiProductCol],
  );
  const channelOptions = useMemo(
    () => Array.from(new Set(data.map(r => String(r[wiChannelCol])).filter(v => v && v !== 'undefined'))).sort(),
    [data, wiChannelCol],
  );

  // -------------------------------------------------------------------------
  // Main layout
  // -------------------------------------------------------------------------

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <div className="flex-1 overflow-y-auto p-8">
      <div className="max-w-5xl mx-auto space-y-6">

        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold text-slate-900">Market Events</h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Applying incremental adjustments on top of the baseline IBRO forecast
            </p>
          </div>
          <button
            onClick={() => setActiveView('standard')}
            className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-700 transition-colors"
          >
            <ArrowLeft size={14} /> Back to Step 1
          </button>
        </div>

        {/* Missing-month gap warning */}
        {missingMonths && missingMonths.length > 0 && (
          <div className="flex items-start gap-3 px-4 py-3 bg-amber-50 border border-amber-100 rounded-xl text-sm text-amber-800">
            <Info size={15} className="shrink-0 mt-0.5 text-amber-500" />
            <span>
              <strong>Missing months detected in historical data.</strong>{' '}
              The following {missingMonths.length === 1 ? 'month is' : 'months are'} absent from this cohort's history:{' '}
              <span className="font-mono">{missingMonths.join(', ')}</span>.
              {' '}Gaps can bias level and trend initialisation — the forecast may be unreliable.
            </span>
          </div>
        )}

        {/* ── View filter bar ─────────────────────────────────────────────── */}
        {/* Independent from Step 1 filters — defaults to All on every mount. */}
        {/* Controls event-matching scope and chart KPI focus for this step.  */}
        <div className="bg-white border border-slate-200 rounded-xl px-4 py-3 flex flex-wrap items-center gap-x-4 gap-y-2">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 shrink-0">View</span>

          {wiSegmentCol && (
            <div className="flex items-center gap-1.5">
              <label className="text-xs text-slate-500 shrink-0">Segment</label>
              <select
                value={viewSegment}
                onChange={e => setViewSegment(e.target.value)}
                className="text-xs border border-slate-200 rounded-lg px-2 py-1.5 bg-slate-50 outline-none focus:border-[#e60000] min-w-[100px]"
              >
                <option value="All">All</option>
                {segmentOptions.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          )}

          {wiProductCol && (
            <div className="flex items-center gap-1.5">
              <label className="text-xs text-slate-500 shrink-0">Product</label>
              <select
                value={viewProduct}
                onChange={e => setViewProduct(e.target.value)}
                className="text-xs border border-slate-200 rounded-lg px-2 py-1.5 bg-slate-50 outline-none focus:border-[#e60000] min-w-[100px]"
              >
                <option value="All">All</option>
                {productOptions.map(p => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
          )}

          {wiChannelCol && (
            <div className="flex items-center gap-1.5">
              <label className="text-xs text-slate-500 shrink-0">Channel</label>
              <select
                value={viewChannel}
                onChange={e => setViewChannel(e.target.value)}
                className="text-xs border border-slate-200 rounded-lg px-2 py-1.5 bg-slate-50 outline-none focus:border-[#e60000] min-w-[100px]"
              >
                <option value="All">All</option>
                {channelOptions.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          )}

          <div className="flex items-center gap-1.5">
            <label className="text-xs text-slate-500 shrink-0">IBRO Scenario</label>
            <select
              value={viewScenario}
              onChange={e => setViewScenario(e.target.value)}
              className="text-xs border border-slate-200 rounded-lg px-2 py-1.5 bg-slate-50 outline-none focus:border-[#e60000] min-w-[100px]"
            >
              <option value="All">All</option>
              <option value="Inflow">Inflow</option>
              <option value="Outflow">Outflow</option>
              <option value="Retention">Retention</option>
              <option value="Base">Base</option>
              <option value="ARPU">ARPU</option>
            </select>
          </div>

          {(viewSegment !== 'All' || viewProduct !== 'All' || viewChannel !== 'All' || viewScenario !== 'All') && (
            <button
              onClick={() => { setViewSegment('All'); setViewProduct('All'); setViewChannel('All'); setViewScenario('All'); }}
              className="text-[10px] text-slate-400 hover:text-rose-500 underline underline-offset-2 transition-colors"
            >
              Reset
            </button>
          )}

          <span className="ml-auto text-[10px] text-slate-400 italic hidden lg:block">
            Scopes chart to matching events — does not affect Step 1 settings
          </span>
        </div>

        {/* Impact summary cards */}
        {impactSummary && (
          <div className="grid grid-cols-3 gap-4">
            <div className={`p-4 rounded-2xl border ${impactSummary.baseDelta >= 0 ? 'bg-emerald-50 border-emerald-100' : 'bg-rose-50 border-rose-100'}`}>
              <p className="text-xs font-semibold text-slate-500 mb-1">Base Volume Delta (end of period)</p>
              <p className={`text-2xl font-bold ${impactSummary.baseDelta >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
                {impactSummary.baseDelta >= 0 ? '+' : ''}{formatNumber(impactSummary.baseDelta)}
              </p>
              <p className="text-[10px] text-slate-400 mt-1">Adjusted vs Baseline</p>
            </div>
            <div className={`p-4 rounded-2xl border ${impactSummary.arpuDelta >= 0 ? 'bg-cyan-50 border-cyan-100' : 'bg-rose-50 border-rose-100'}`}>
              <p className="text-xs font-semibold text-slate-500 mb-1">ARPU Delta (end of period)</p>
              <p className={`text-2xl font-bold ${impactSummary.arpuDelta >= 0 ? 'text-cyan-700' : 'text-rose-700'}`}>
                {impactSummary.arpuDelta >= 0 ? '+' : ''}{formatNumber(impactSummary.arpuDelta)}
              </p>
              <p className="text-[10px] text-slate-400 mt-1">Adjusted vs Baseline</p>
            </div>
            <div className="p-4 rounded-2xl border bg-slate-50 border-slate-100">
              <p className="text-xs font-semibold text-slate-500 mb-1">Active Market Events</p>
              <p className="text-2xl font-bold text-slate-700">{impactSummary.eventCount}</p>
              <p className="text-[10px] text-slate-400 mt-1">
                {impactSummary.eventCount === 0 ? 'Add events below to adjust the forecast' : 'Events applied to adjusted path'}
              </p>
            </div>
          </div>
        )}

        {/* Chart */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-base font-semibold text-slate-900">Baseline vs Adjusted Forecast</h3>
            <div className="flex items-center gap-3">
              {/* Window size */}
              <div className="flex bg-slate-100 p-1 rounded-lg">
                {[6, 12, 18, 24].map(size => (
                  <button
                    key={size}
                    onClick={() => setWindowSize(size)}
                    className={`px-3 py-1 text-[10px] font-bold rounded-md transition-all ${windowSize === size ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                  >
                    {size}M
                  </button>
                ))}
              </div>
              <button
                onClick={() => downloadExcel(chartData, 'market_events_adjusted.xlsx')}
                className="flex items-center gap-2 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 text-sm font-medium py-1.5 px-3 rounded-lg transition-colors shadow-sm"
              >
                <Download size={14} /> Export
              </button>
            </div>
          </div>

          {/* KPI selector */}
          <div className="flex flex-wrap gap-2 mb-5">
            {KPI_LIST.map(kpi => (
              <label
                key={kpi}
                className={`flex items-center gap-2 text-xs px-3 py-1.5 rounded-lg border cursor-pointer transition-colors ${
                  selectedKpis.includes(kpi)
                    ? 'bg-slate-800 border-slate-800 text-white'
                    : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                }`}
              >
                <input
                  type="checkbox"
                  checked={selectedKpis.includes(kpi)}
                  onChange={() => toggleKpi(kpi)}
                  className="sr-only"
                />
                <span
                  className="w-2 h-2 rounded-full shrink-0"
                  style={{ backgroundColor: KPI_COLORS[kpi].baseline }}
                />
                {kpi}
              </label>
            ))}
          </div>

          {/* Legend hint */}
          <div className="flex items-center gap-4 mb-4 text-[10px] text-slate-400">
            <span className="flex items-center gap-1.5"><span className="w-6 border-t-2 border-slate-400" /> Baseline (Step 1)</span>
            <span className="flex items-center gap-1.5"><span className="w-6 border-t-2 border-dashed border-[#e60000]" /> Adjusted (+ Events)</span>
            <span className="ml-auto italic">Base reflects Inflow / Outflow from the prior month — an event in month T first appears in Base in T+1</span>
          </div>

          <div className="h-[380px]">
            {selectedKpis.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData} margin={{ top: 5, right: 20, bottom: 40, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                  <XAxis
                    dataKey="month"
                    tick={{ fontSize: 11, fill: '#64748b' }}
                    tickMargin={10}
                    axisLine={false}
                    tickLine={false}
                    tickFormatter={fmtMonth}
                  />
                  <YAxis
                    yAxisId="left"
                    tick={{ fontSize: 11, fill: '#64748b' }}
                    axisLine={false}
                    tickLine={false}
                    tickFormatter={formatNumber}
                  />
                  <YAxis
                    yAxisId="right"
                    orientation="right"
                    tick={{ fontSize: 11, fill: '#64748b' }}
                    axisLine={false}
                    tickLine={false}
                    tickFormatter={formatNumber}
                  />
                  <Tooltip
                    formatter={(value: number, name: string) => [formatNumber(value), name]}
                    contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                    labelStyle={{ fontWeight: 600, color: '#0f172a', marginBottom: '4px' }}
                    labelFormatter={fmtMonth}
                  />
                  <Legend iconType="circle" wrapperStyle={{ paddingTop: '20px', fontSize: '11px' }} />
                  <Brush
                    dataKey="month"
                    height={28}
                    stroke="#cbd5e1"
                    startIndex={windowOffset}
                    endIndex={Math.min(chartData.length - 1, windowOffset + windowSize - 1)}
                    onChange={(obj: any) => {
                      if (obj && typeof obj.startIndex === 'number' && typeof obj.endIndex === 'number') {
                        setWindowOffset(obj.startIndex);
                        setWindowSize(obj.endIndex - obj.startIndex + 1);
                      }
                    }}
                    tickFormatter={() => ''}
                  />

                  {/* Event reference lines */}
                  {marketEvents.map((e, idx) => {
                    const d = parse(e.date, 'yyyy-MM', new Date());
                    if (!isValid(d)) return null;
                    return (
                      <ReferenceLine
                        key={`ref-${idx}`}
                        x={e.date}
                        yAxisId="left"
                        stroke="#f43f5e"
                        strokeDasharray="3 3"
                        label={{ position: 'top', value: e.comment || e.scenario, fill: '#f43f5e', fontSize: 9 }}
                      />
                    );
                  })}

                  {selectedKpis.map(kpi => {
                    const c = KPI_COLORS[kpi];
                    return (
                      <React.Fragment key={kpi}>
                        <Line
                          yAxisId={c.axis}
                          type="monotone"
                          dataKey={`${kpi} (Baseline)`}
                          stroke={c.baseline}
                          strokeWidth={2}
                          dot={{ r: 2, fill: c.baseline, strokeWidth: 0 }}
                          activeDot={{ r: 5 }}
                          connectNulls
                        />
                        <Line
                          yAxisId={c.axis}
                          type="monotone"
                          dataKey={`${kpi} (Adjusted)`}
                          stroke={c.adjusted}
                          strokeWidth={2}
                          strokeDasharray="5 5"
                          dot={{ r: 2, fill: c.adjusted, strokeWidth: 0 }}
                          activeDot={{ r: 5 }}
                          connectNulls
                        />
                      </React.Fragment>
                    );
                  })}
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-slate-400 text-sm">
                Select at least one KPI above to view the chart.
              </div>
            )}
          </div>
        </div>

        {/* Market Events form + table */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-slate-700">Market Events</h3>
            <span className="text-xs text-slate-500 bg-white px-2 py-1 rounded border border-slate-200">
              Events adjust the forecast above in real time
            </span>
          </div>

          {/* Add event form */}
          <div className="p-6 border-b border-slate-100 bg-slate-50/30">
            <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4 items-end">
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">Scenario</label>
                <select
                  value={newEvent.scenario}
                  onChange={e => setNewEvent({ ...newEvent, scenario: e.target.value as any })}
                  className="w-full text-sm border border-slate-200 rounded-lg p-2 bg-white outline-none focus:border-[#e60000]"
                >
                  <option value="Inflow">Inflow</option>
                  <option value="Retention">Retention</option>
                  <option value="Outflow">Outflow</option>
                  <option value="ARPU">ARPU</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">Segment</label>
                <select
                  value={newEvent.segment}
                  onChange={e => setNewEvent({ ...newEvent, segment: e.target.value })}
                  className="w-full text-sm border border-slate-200 rounded-lg p-2 bg-white outline-none focus:border-[#e60000]"
                >
                  <option value="All">All Segments</option>
                  {Array.from(new Set(data.map(r => String(r[wiSegmentCol])).filter(v => v && v !== 'undefined'))).sort().map(s => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">Product</label>
                <select
                  value={newEvent.product || 'All'}
                  onChange={e => setNewEvent({ ...newEvent, product: e.target.value })}
                  className="w-full text-sm border border-slate-200 rounded-lg p-2 bg-white outline-none focus:border-[#e60000]"
                >
                  <option value="All">All Products</option>
                  {Array.from(new Set(data.map(r => String(r[wiProductCol])).filter(v => v && v !== 'undefined'))).sort().map(p => (
                    <option key={p} value={p}>{p}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">Channel</label>
                <select
                  value={newEvent.channel || 'All'}
                  onChange={e => setNewEvent({ ...newEvent, channel: e.target.value })}
                  className="w-full text-sm border border-slate-200 rounded-lg p-2 bg-white outline-none focus:border-[#e60000]"
                >
                  <option value="All">All Channels</option>
                  {Array.from(new Set(data.map(r => String(r[wiChannelCol])).filter(v => v && v !== 'undefined'))).sort().map(c => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">Month</label>
                <input
                  type="month"
                  value={newEvent.date}
                  onChange={e => setNewEvent({ ...newEvent, date: e.target.value })}
                  className="w-full text-sm border border-slate-200 rounded-lg p-2 bg-white outline-none focus:border-[#e60000]"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">Subscriber Volume (+/−)</label>
                <input
                  type="number"
                  value={newEvent.subscriberVolume || ''}
                  onChange={e => {
                    const vol = Number(e.target.value);
                    setNewEvent({ ...newEvent, subscriberVolume: vol, revenue: vol * (newEvent.arpu || 0) });
                  }}
                  className="w-full text-sm border border-slate-200 rounded-lg p-2 bg-white outline-none focus:border-[#e60000]"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">Customer Volume (+/−)</label>
                <input
                  type="number"
                  value={newEvent.customerVolume || ''}
                  onChange={e => setNewEvent({ ...newEvent, customerVolume: Number(e.target.value) })}
                  className="w-full text-sm border border-slate-200 rounded-lg p-2 bg-white outline-none focus:border-[#e60000]"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">Revenue (+/−)</label>
                <input
                  type="number"
                  value={newEvent.revenue || ''}
                  onChange={e => {
                    const rev = Number(e.target.value);
                    const vol = newEvent.subscriberVolume || 0;
                    setNewEvent({ ...newEvent, revenue: rev, arpu: vol !== 0 ? rev / vol : 0 });
                  }}
                  className="w-full text-sm border border-slate-200 rounded-lg p-2 bg-white outline-none focus:border-[#e60000]"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">ARPU (+/−)</label>
                <input
                  type="number"
                  value={newEvent.arpu || ''}
                  onChange={e => {
                    const arpu = Number(e.target.value);
                    setNewEvent({ ...newEvent, arpu, revenue: (newEvent.subscriberVolume || 0) * arpu });
                  }}
                  className="w-full text-sm border border-slate-200 rounded-lg p-2 bg-white outline-none focus:border-[#e60000]"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1 flex items-center gap-1">
                  Contract Length
                  <span
                    title="This controls how long new subscribers from this event are protected from churn before entering the at-risk pool. Default is 24 months."
                    className="text-slate-400 cursor-help"
                  >
                    <Info size={11} />
                  </span>
                </label>
                <input
                  type="number"
                  min={1}
                  max={60}
                  step={1}
                  value={newEvent.contractLength ?? 24}
                  onChange={e => setNewEvent({ ...newEvent, contractLength: Math.min(60, Math.max(1, Math.round(Number(e.target.value)))) })}
                  className="w-full text-sm border border-slate-200 rounded-lg p-2 bg-white outline-none focus:border-[#e60000]"
                />
                <p className="text-[10px] text-slate-400 mt-1 leading-snug">
                  Months protected from churn (default: 24)
                </p>
              </div>
              <button
                onClick={addMarketEvent}
                className="w-full bg-[#e60000] text-white text-sm font-semibold py-2 px-4 rounded-lg hover:bg-[#cc0000] transition-colors"
              >
                Add Event
              </button>
            </div>
            <div className="mt-4">
              <label className="block text-xs font-medium text-slate-500 mb-1">Comment</label>
              <input
                type="text"
                placeholder="Describe the event (e.g., New marketing campaign, Competitor exit...)"
                value={newEvent.comment}
                onChange={e => setNewEvent({ ...newEvent, comment: e.target.value })}
                className="w-full text-sm border border-slate-200 rounded-lg p-2 bg-white outline-none focus:border-[#e60000]"
              />
            </div>
          </div>

          {/* Events table */}
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="text-xs text-slate-500 bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="px-5 py-3 font-semibold">Month</th>
                  <th className="px-5 py-3 font-semibold">Segment</th>
                  <th className="px-5 py-3 font-semibold">Product</th>
                  <th className="px-5 py-3 font-semibold">Channel</th>
                  <th className="px-5 py-3 font-semibold text-right">Inflow Δ</th>
                  <th className="px-5 py-3 font-semibold text-right">Base Δ</th>
                  <th className="px-5 py-3 font-semibold text-right">Retention Δ</th>
                  <th className="px-5 py-3 font-semibold text-right">Outflow Δ</th>
                  <th className="px-5 py-3 font-semibold text-right">ARPU Δ</th>
                  <th className="px-5 py-3 font-semibold">Comment</th>
                  <th className="px-5 py-3 font-semibold text-center">Remove</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {marketEvents.length === 0 ? (
                  <tr>
                    <td colSpan={11} className="px-5 py-8 text-center text-slate-400 italic text-sm">
                      No market events yet. Use the form above to add events — they adjust the chart immediately.
                    </td>
                  </tr>
                ) : (
                  marketEvents
                    .slice()
                    .sort((a, b) => String(a.date).localeCompare(String(b.date)))
                    .map(event => {
                      const isRetention = event.scenario === 'Retention';
                      const isInflow    = event.scenario === 'Inflow';
                      const isOutflow   = event.scenario === 'Outflow';
                      const isArpu      = event.scenario === 'ARPU';
                      const hasWarning  = retentionWarnings.has(event.id);

                      // Each variable is non-null only for the event types that populate that column.
                      // Inflow Δ — Inflow events only; stored positive.
                      const inflowDelta     = isInflow ? event.subscriberVolume : null;
                      // Base Δ — derived (T+1 via lagged formula), not directly set; always dash.
                      // Retention Δ — Retention events only; stored positive (subscribers retained).
                      const retentionDelta  = isRetention ? event.subscriberVolume : null;
                      // Outflow Δ — Outflow events (stored negative) and Retention events
                      //   (outflow reduced by the retained volume, so negative).
                      const outflowDelta    = isOutflow   ? event.subscriberVolume        // already negative
                                           : isRetention  ? -event.subscriberVolume        // positive stored → negative Outflow Δ
                                           : null;
                      // ARPU Δ — ARPU events directly; Inflow/Outflow show their per-subscriber
                      //   ARPU if non-zero (contextual blending info).
                      const arpuDelta       = event.arpu !== 0 ? event.arpu : null;

                      // Helper: render a signed numeric delta cell
                      const fmtDelta = (v: number) => (v > 0 ? '+' : '') + formatNumber(v);

                      return (
                        <React.Fragment key={event.id}>
                          <tr className={`hover:bg-slate-50 transition-colors ${hasWarning ? 'bg-amber-50/40' : ''}`}>
                            <td className="px-5 py-3 font-medium text-slate-700">{fmtMonth(event.date)}</td>
                            <td className="px-5 py-3 text-slate-600 text-xs">{event.segment}</td>
                            <td className="px-5 py-3 text-slate-600 text-xs">{event.product}</td>
                            <td className="px-5 py-3 text-slate-600 text-xs">{event.channel || 'All'}</td>

                            {/* Inflow Δ — blue; only Inflow events */}
                            <td className={`px-5 py-3 text-right font-semibold text-xs ${inflowDelta !== null ? 'text-blue-600' : 'text-slate-300'}`}>
                              {inflowDelta !== null ? fmtDelta(inflowDelta) : '—'}
                            </td>

                            {/* Base Δ — derived (T+1); always dash */}
                            <td className="px-5 py-3 text-right text-xs text-slate-300">—</td>

                            {/* Retention Δ — pink; only Retention events (positive = subscribers saved) */}
                            <td className={`px-5 py-3 text-right font-semibold text-xs ${retentionDelta !== null ? 'text-pink-600' : 'text-slate-300'}`}>
                              {retentionDelta !== null ? fmtDelta(retentionDelta) : '—'}
                            </td>

                            {/* Outflow Δ — Outflow events (rose, value is negative) and
                                Retention dual-impact (emerald, outflow is reduced) */}
                            <td className={`px-5 py-3 text-right font-semibold text-xs ${
                              outflowDelta === null ? 'text-slate-300' :
                              isOutflow    ? 'text-rose-600' :    // Outflow: bad (more leaving)
                              isRetention  ? 'text-emerald-600' : // Retention: good (fewer leaving)
                              'text-slate-600'
                            }`}>
                              {outflowDelta !== null ? fmtDelta(outflowDelta) : '—'}
                            </td>

                            {/* ARPU Δ — directional colour for all event types */}
                            <td className={`px-5 py-3 text-right font-semibold text-xs ${
                              arpuDelta === null ? 'text-slate-300' :
                              arpuDelta >= 0 ? 'text-emerald-600' : 'text-rose-600'
                            }`}>
                              {arpuDelta !== null ? fmtDelta(arpuDelta) : '—'}
                            </td>

                            <td className="px-5 py-3 text-slate-500 text-xs max-w-xs truncate" title={event.comment}>{event.comment || '—'}</td>
                            <td className="px-5 py-3 text-center">
                              <button
                                onClick={() => removeMarketEvent(event.id)}
                                className="text-rose-400 hover:text-rose-600 p-1 rounded hover:bg-rose-50 transition-colors"
                              >
                                <Trash2 size={14} />
                              </button>
                            </td>
                          </tr>
                          {hasWarning && (
                            <tr className="bg-amber-50">
                              <td colSpan={11} className="px-5 py-2 text-xs text-amber-700 flex items-center gap-2">
                                <AlertTriangle size={12} className="text-amber-500 shrink-0 inline mr-1" />
                                Retention volume ({formatNumber(event.subscriberVolume)}) exceeds forecast Outflow for {fmtMonth(event.date)}.
                                The retained volume will be clamped to the available Outflow — reduce the event volume to avoid over-retention.
                              </td>
                            </tr>
                          )}
                        </React.Fragment>
                      );
                    })
                )}
              </tbody>
            </table>
          </div>

          {marketEvents.length > 0 && (
            <div className="px-5 py-3 bg-slate-50 border-t border-slate-100 flex justify-start">
              <button
                onClick={() => setMarketEvents([])}
                className="text-xs font-medium text-slate-500 hover:text-rose-600 transition-colors flex items-center gap-1.5"
              >
                <Trash2 size={12} /> Clear All Events
              </button>
            </div>
          )}
        </div>

        {/* Stock-and-flow math validation */}
        {chartData.length > 0 && (
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-slate-700">Stock-and-Flow Validation</h3>
              <span className="text-xs text-slate-400 bg-white px-2 py-1 rounded border border-slate-200">
                Base(t) = Base(t−1) + Inflow(t−1) − Outflow(t−1)
              </span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="text-xs text-slate-500 bg-slate-50 border-b border-slate-200">
                  <tr>
                    <th className="px-5 py-3 font-semibold">Month</th>
                    <th className="px-5 py-3 font-semibold text-right text-blue-600">Inflow (Adj)</th>
                    <th className="px-5 py-3 font-semibold text-right text-amber-600">Outflow (Adj)</th>
                    <th className="px-5 py-3 font-semibold text-right text-pink-600">Retention (Adj)</th>
                    <th className="px-5 py-3 font-semibold text-right text-emerald-600">Base (Adj)</th>
                    <th className="px-5 py-3 font-semibold text-right text-slate-400">Base (Baseline)</th>
                    <th className="px-5 py-3 font-semibold text-right">Delta</th>
                    <th className="px-5 py-3 font-semibold text-center">Valid</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {chartData.map((row, i) => {
                    const prev = i === 0 ? baseForecast.seedBaseVolume : chartData[i - 1]['Base (Adjusted)'];
                    const prevInflow = i === 0 ? baseForecast.lastHistoricalInflow : chartData[i - 1]['Inflow (Adjusted)'];
                    const prevOutflow = i === 0 ? baseForecast.lastHistoricalOutflow : chartData[i - 1]['Outflow (Adjusted)'];
                    const expected = prev + prevInflow - prevOutflow;
                    const isOk = Math.abs(expected - row['Base (Adjusted)']) < 0.15;
                    const delta = row['Base (Adjusted)'] - row['Base (Baseline)'];
                    return (
                      <tr key={row.month} className="hover:bg-slate-50/50 transition-colors">
                        <td className="px-5 py-2.5 font-medium text-slate-700 text-xs">{fmtMonth(row.month)}</td>
                        <td className="px-5 py-2.5 text-right text-blue-600 text-xs">{formatNumber(row['Inflow (Adjusted)'])}</td>
                        <td className="px-5 py-2.5 text-right text-amber-600 text-xs">{formatNumber(row['Outflow (Adjusted)'])}</td>
                        <td className="px-5 py-2.5 text-right text-pink-600 text-xs">{formatNumber(row['Retention (Adjusted)'])}</td>
                        <td className="px-5 py-2.5 text-right font-semibold text-emerald-600 text-xs">{formatNumber(row['Base (Adjusted)'])}</td>
                        <td className="px-5 py-2.5 text-right text-slate-400 text-xs">{formatNumber(row['Base (Baseline)'])}</td>
                        <td className={`px-5 py-2.5 text-right font-semibold text-xs ${delta >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                          {delta >= 0 ? '+' : ''}{formatNumber(delta)}
                        </td>
                        <td className="px-5 py-2.5 text-center">
                          {isOk
                            ? <CheckCircle2 size={16} className="text-emerald-500 inline" />
                            : <XCircle size={16} className="text-rose-500 inline" title={`Expected ${expected.toFixed(2)}`} />
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
    </div>
  );
};

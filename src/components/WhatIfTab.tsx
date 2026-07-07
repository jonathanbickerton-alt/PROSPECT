import React, { useMemo, useEffect, useState, useCallback } from 'react';
import { ArrowLeft, Info, Download, Trash2, CheckCircle2, XCircle, Activity, AlertTriangle, Pencil } from 'lucide-react';
import {
  ResponsiveContainer, LineChart, CartesianGrid, XAxis, YAxis, Tooltip,
  Legend, Line, Brush, ReferenceLine,
} from 'recharts';
import { format, parse, isValid, addMonths, differenceInCalendarMonths } from 'date-fns';
import { useForecast } from '../context/ForecastContext';
import type { AdjustedForecastMonth, MarketEventAdjustedForecast, YieldEvent, PricingEvent } from '../types/forecast';
import type { MarketEvent } from '../utils/forecasting';
import { HierarchicalDropdown } from './HierarchicalDropdown';
import type { HierarchicalSelection } from './HierarchicalDropdown';

// ---------------------------------------------------------------------------
// Props — only what this step actually needs
// ---------------------------------------------------------------------------

interface WhatIfTabProps {
  /** Raw data rows — used to populate segment/product/channel options in the event form */
  data: any[];
  wiSegmentCol: string;
  wiProductCol: string;
  wiProductL2Col?: string;
  wiChannelCol: string;
  wiChannelL2Col?: string;
  /** Column that holds the IBRO metric type (e.g. "IBRO_Scenario_Type") */
  wiMetricCol?: string;
  /** Value in wiMetricCol that identifies Inflow rows */
  wiInflowVal?: string;
  /** Value in wiMetricCol that identifies Retention rows */
  wiRetentionVal?: string;
  /** Column that holds per-row ARPU — used to derive per-tier base ARPUs */
  wiArpuCol?: string;
  /** L1 → L2 children map for Product hierarchy (for local view bar and event form) */
  productTree: Map<string, string[]>;
  /** L1 → L2 children map for Channel hierarchy */
  channelTree: Map<string, string[]>;
  /** L1 → L2 children map for Tariff hierarchy (Phase 2a) */
  tariffTree?: Map<string, string[]>;
  /** Column names for Tariff L1/L2 (Phase 2a) */
  wiTariffL1Col?: string;
  wiTariffL2Col?: string;
  /** Tariff L1 values the user has selected for scenario work (Phase 2b). None
   *  selected by default; constrains tariff targeting and the tariff mix axis. */
  selectedTariffs?: string[];
  setSelectedTariffs?: (t: string[]) => void;
  newEvent: Partial<MarketEvent>;
  setNewEvent: (e: Partial<MarketEvent>) => void;
  marketEvents: MarketEvent[];
  setMarketEvents: (e: MarketEvent[]) => void;
  addMarketEvent: () => void;
  removeMarketEvent: (id: string) => void;
  updateMarketEvent: (id: string, patch: Partial<MarketEvent>) => void;
  /** Yield Events (Value tab) */
  yieldEvents: YieldEvent[];
  newYieldEvent: Partial<YieldEvent>;
  setNewYieldEvent: (e: Partial<YieldEvent>) => void;
  addYieldEvent: (e: YieldEvent) => void;
  removeYieldEvent: (id: string) => void;
  clearAllYieldEvents: () => void;
  /** Pricing Events (Pricing tab) */
  pricingEvents: PricingEvent[];
  newPricingEvent: Partial<PricingEvent>;
  setNewPricingEvent: (e: Partial<PricingEvent>) => void;
  addPricingEvent: (e: PricingEvent) => void;
  removePricingEvent: (id: string) => void;
  clearAllPricingEvents: () => void;
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
  wiProductL2Col = '',
  wiChannelCol,
  wiChannelL2Col = '',
  wiMetricCol = '',
  wiInflowVal = '',
  wiRetentionVal = '',
  wiArpuCol = '',
  productTree,
  channelTree,
  tariffTree,
  wiTariffL1Col = '',
  wiTariffL2Col = '',
  selectedTariffs = [],
  setSelectedTariffs,
  newEvent,
  setNewEvent,
  marketEvents,
  setMarketEvents,
  addMarketEvent,
  removeMarketEvent,
  updateMarketEvent,
  yieldEvents,
  newYieldEvent,
  setNewYieldEvent,
  addYieldEvent,
  removeYieldEvent,
  clearAllYieldEvents,
  pricingEvents,
  newPricingEvent,
  setNewPricingEvent,
  addPricingEvent,
  removePricingEvent,
  clearAllPricingEvents,
  downloadExcel,
  formatNumber,
  setActiveView,
  missingMonths,
}) => {
  const { baseForecast, setAdjustedForecast } = useForecast();

  const [selectedKpis, setSelectedKpis] = useState<KpiName[]>(['Inflow', 'Outflow', 'Retention', 'Base']);

  // null = add-new mode; a string id = editing that event
  const [editingEventId, setEditingEventId] = useState<string | null>(null);
  // null = not editing a campaign; a string = editing all events sharing that campaignName
  const [editingCampaign, setEditingCampaign] = useState<string | null>(null);

  // ---------------------------------------------------------------------------
  // Local view filter — independent from Step 1 selections.
  // Defaults to 'All' on every mount; never reads from baseForecast.cohort.
  // ---------------------------------------------------------------------------
  const [viewSegment, setViewSegment] = useState('All');
  const [viewProduct, setViewProduct] = useState<HierarchicalSelection>({ l1: null, l2: null });
  const [viewChannel, setViewChannel] = useState<HierarchicalSelection>({ l1: null, l2: null });
  const [viewTariff, setViewTariff] = useState<HierarchicalSelection>({ l1: null, l2: null });
  // 'All' means all KPIs visible; a specific scenario pre-selects that KPI.
  const [viewScenario, setViewScenario] = useState('All');

  // Tariff tree constrained to the user's selected tariffs (Phase 2b) — feeds the
  // P7 targeting dropdowns and the tariff mix axis. Empty selection = no options,
  // so nothing renders until the user selects tariffs (per the scoping control).
  const fullTariffTree = tariffTree ?? new Map<string, string[]>();
  const targetTariffTree = useMemo<Map<string, string[]>>(() => {
    if (!selectedTariffs.length) return new Map();
    const t = new Map<string, string[]>();
    for (const l1 of selectedTariffs) {
      if (fullTariffTree.has(l1)) t.set(l1, fullTariffTree.get(l1)!);
    }
    return t;
  }, [fullTariffTree, selectedTariffs]);

  // ── Tab state ─────────────────────────────────────────────────────────────
  const [activeTab, setActiveTab] = useState<'volume' | 'value' | 'pricing'>('volume');

  const [windowSize, setWindowSize] = useState(12);
  const [windowOffset, setWindowOffset] = useState(0);

  // ── Volume spread state ────────────────────────────────────────────────────
  const [spreadEnabled, setSpreadEnabled] = useState(false);
  const [spreadMonths, setSpreadMonths] = useState(3);
  const [spreadDistType, setSpreadDistType] = useState<'even' | 'custom'>('even');
  const [customDist, setCustomDist] = useState<number[]>([34, 33, 33]);

  // Keep customDist length in sync with spreadMonths
  useEffect(() => {
    setCustomDist(prev => {
      const even = Math.floor(100 / spreadMonths);
      const remainder = 100 - even * spreadMonths;
      return Array.from({ length: spreadMonths }, (_, i) =>
        prev[i] !== undefined ? prev[i] : (i === 0 ? even + remainder : even)
      );
    });
  }, [spreadMonths]);

  // When the active tab changes, sync the KPI selection to the tab's focus.
  useEffect(() => {
    if (activeTab === 'volume') {
      setSelectedKpis(['Inflow', 'Outflow', 'Retention', 'Base']);
    } else {
      // Value and Pricing tabs focus on ARPU
      setSelectedKpis(['ARPU']);
    }
  }, [activeTab]);

  // When the user picks a specific scenario, focus the chart on that KPI.
  // When 'All' is selected, do nothing — the activeTab effect owns the default set.
  useEffect(() => {
    if (viewScenario !== 'All') {
      setSelectedKpis([viewScenario as KpiName]);
    }
  }, [viewScenario]);

  // Sync local view filter from the loaded baseForecast's cohort dimensions.
  // Keeps the page-level VIEW dropdowns aligned with the global VIEWING bar.
  useEffect(() => {
    if (!baseForecast) return;
    const { segment, product, productL2, channel, channelL2, tariffL1, tariffL2 } = baseForecast.cohort;
    setViewSegment(segment !== 'All' ? segment : 'All');
    setViewProduct({
      l1: product !== 'All' ? product : null,
      l2: productL2 && productL2 !== 'All' ? productL2 : null,
    });
    setViewChannel({
      l1: channel !== 'All' ? channel : null,
      l2: channelL2 && channelL2 !== 'All' ? channelL2 : null,
    });
    setViewTariff({
      l1: tariffL1 && tariffL1 !== 'All' ? tariffL1 : null,
      l2: tariffL2 && tariffL2 !== 'All' ? tariffL2 : null,
    });
  }, [baseForecast]);

  // ── Yield Events form local draft state ──────────────────────────────────
  // draftMix holds the live slider values (always sums to 100).
  const [draftMix, setDraftMix] = useState<Record<string, number>>({});
  // 'historical' = raw data average per tier; 'forecast' = scaled to match the
  // forecast's per-scenario ARPU for the selected yield event month.
  const [yieldArpuMode, setYieldArpuMode] = useState<'historical' | 'forecast'>('historical');

  // Derive Product L2 options + their base ARPUs from data whenever the
  // newYieldEvent selectors change.
  // When yieldArpuMode === 'forecast', tier ARPUs are scaled so their
  // volume-weighted blend equals the forecast's per-scenario ARPU for the
  // selected month — preserving relative tier relativities.
  const yieldTierData = useMemo<{ tier: string; baseArpu: number; historicalArpu: number }[]>(() => {
    if (!wiProductL2Col || !wiArpuCol || !wiMetricCol) return [];
    const { segment, product, channelL1, channelL2, ibro, month } = newYieldEvent;
    const ibroVal = ibro === 'Inflow' ? wiInflowVal : wiRetentionVal;

    const filtered = data.filter(row => {
      if (segment && segment !== 'All' && String(row[wiSegmentCol]) !== segment) return false;
      if (product && product !== 'All' && String(row[wiProductCol]) !== product) return false;
      if (channelL1 && channelL1 !== 'All' && String(row[wiChannelCol]) !== channelL1) return false;
      if (channelL2 && channelL2 !== 'All' && wiChannelL2Col && String(row[wiChannelL2Col]) !== channelL2) return false;
      if (ibroVal && String(row[wiMetricCol]) !== ibroVal) return false;
      return true;
    });

    // Group by Product L2 → average ARPU (historical baseline)
    const tierMap = new Map<string, number[]>();
    filtered.forEach(row => {
      const tier = String(row[wiProductL2Col] ?? '');
      if (!tier || tier === 'undefined') return;
      const arpu = Number(row[wiArpuCol]);
      if (!isFinite(arpu)) return;
      if (!tierMap.has(tier)) tierMap.set(tier, []);
      tierMap.get(tier)!.push(arpu);
    });

    const historicalTiers = Array.from(tierMap.entries())
      .map(([tier, arpus]) => ({
        tier,
        historicalArpu: arpus.reduce((a, b) => a + b, 0) / arpus.length,
      }))
      .sort((a, b) => {
        // Numeric-range labels like "0-1", "1-2", "10-11" → sort by leading number
        const numA = parseFloat(a.tier);
        const numB = parseFloat(b.tier);
        if (!isNaN(numA) && !isNaN(numB)) return numA - numB;
        return a.tier.localeCompare(b.tier, undefined, { numeric: true, sensitivity: 'base' });
      });

    // Forecast scaling: when a month is selected and the forecast has per-scenario
    // ARPU, scale all tier ARPUs proportionally so their equal-weight blend
    // matches the forecast value for this scenario/month.
    if (yieldArpuMode === 'forecast' && month && baseForecast) {
      const fcMonth = baseForecast.months.find(m => m.month === month);
      const fcArpu = fcMonth
        ? (ibro === 'Inflow' ? (fcMonth.inflowArpu?.mean ?? fcMonth.arpu.mean) : (fcMonth.retentionArpu?.mean ?? fcMonth.arpu.mean))
        : null;
      if (fcArpu !== null && fcArpu > 0 && historicalTiers.length > 0) {
        const histBlended = historicalTiers.reduce((s, t) => s + t.historicalArpu, 0) / historicalTiers.length;
        const scaleFactor = histBlended > 0 ? fcArpu / histBlended : 1;
        return historicalTiers.map(t => ({
          ...t,
          baseArpu: Math.max(0, t.historicalArpu * scaleFactor),
        }));
      }
    }

    return historicalTiers.map(t => ({ ...t, baseArpu: t.historicalArpu }));
  }, [data, wiProductL2Col, wiArpuCol, wiMetricCol, wiSegmentCol, wiProductCol, wiChannelCol, wiChannelL2Col, wiInflowVal, wiRetentionVal, newYieldEvent.segment, newYieldEvent.product, newYieldEvent.channelL1, newYieldEvent.channelL2, newYieldEvent.ibro, newYieldEvent.month, yieldArpuMode, baseForecast]);

  // Seed draftMix with equal weights whenever tiers change
  useEffect(() => {
    if (yieldTierData.length === 0) { setDraftMix({}); return; }
    const eq = 100 / yieldTierData.length;
    const init: Record<string, number> = {};
    yieldTierData.forEach((t, i) => {
      // last tier absorbs rounding residual so total is exactly 100
      init[t.tier] = i === yieldTierData.length - 1
        ? 100 - eq * (yieldTierData.length - 1)
        : eq;
    });
    setDraftMix(init);
  }, [yieldTierData.map(t => t.tier).join('|')]); // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-balancing slider handler
  const handleSliderChange = useCallback((changedTier: string, newValue: number) => {
    setDraftMix(prev => {
      const clamped = Math.min(100, Math.max(0, newValue));
      const others = Object.keys(prev).filter(t => t !== changedTier);
      const otherSum = others.reduce((s, t) => s + prev[t], 0);
      const remaining = 100 - clamped;

      const next: Record<string, number> = { ...prev, [changedTier]: clamped };
      if (otherSum === 0) {
        const eq = remaining / others.length;
        others.forEach((t, i) => {
          next[t] = i === others.length - 1
            ? remaining - eq * (others.length - 1)
            : eq;
        });
      } else {
        let allocated = 0;
        others.forEach((t, i) => {
          if (i === others.length - 1) {
            next[t] = Math.max(0, remaining - allocated);
          } else {
            const share = Math.max(0, (prev[t] / otherSum) * remaining);
            next[t] = share;
            allocated += share;
          }
        });
      }
      return next;
    });
  }, []);

  // Computed blended ARPU from current draft
  const draftBlendedArpu = useMemo(() => {
    return yieldTierData.reduce((sum, t) => sum + (draftMix[t.tier] ?? 0) / 100 * t.baseArpu, 0);
  }, [draftMix, yieldTierData]);

  // Baseline blended ARPU from data (equal to sum of existing share × arpu)
  const baselineBlendedArpu = useMemo(() => {
    if (yieldTierData.length === 0) return 0;
    const total = yieldTierData.reduce((s, t) => s + t.baseArpu, 0);
    if (total === 0) return 0;
    // Approximate: assume existing mix is data-driven (average ARPU of all tiers weighted equally)
    return yieldTierData.reduce((s, t) => s + t.baseArpu, 0) / yieldTierData.length;
  }, [yieldTierData]);

  // ── Unique options for Yield Event form ───────────────────────────────────
  const ySegmentOptions = useMemo(
    () => Array.from(new Set(data.map(r => String(r[wiSegmentCol])).filter(v => v && v !== 'undefined'))).sort(),
    [data, wiSegmentCol],
  );
  const yProductOptions = useMemo(
    () => Array.from(new Set(data.map(r => String(r[wiProductCol])).filter(v => v && v !== 'undefined'))).sort(),
    [data, wiProductCol],
  );
  const yChannelL1Options = useMemo(
    () => Array.from(new Set(data.map(r => String(r[wiChannelCol])).filter(v => v && v !== 'undefined'))).sort(),
    [data, wiChannelCol],
  );
  // ── Unique options for Pricing Event form ────────────────────────────────
  const pricingProductL2Options = useMemo(() => {
    if (!wiProductL2Col) return [];
    const filtered = newPricingEvent.product && newPricingEvent.product !== 'All'
      ? data.filter(r => String(r[wiProductCol]) === newPricingEvent.product)
      : data;
    return Array.from(new Set(filtered.map(r => String(r[wiProductL2Col])).filter(v => v && v !== 'undefined'))).sort();
  }, [data, wiProductCol, wiProductL2Col, newPricingEvent.product]);

  // ── Add Yield Event ────────────────────────────────────────────────────────
  const handleAddYieldEvent = useCallback(() => {
    if (!newYieldEvent.month || yieldTierData.length === 0) return;
    const tariffBaseArpu: Record<string, number> = {};
    yieldTierData.forEach(t => { tariffBaseArpu[t.tier] = t.baseArpu; });

    const event: YieldEvent = {
      id: Math.random().toString(36).substr(2, 9),
      ibro: newYieldEvent.ibro ?? 'Inflow',
      segment: newYieldEvent.segment ?? 'All',
      product: newYieldEvent.product ?? 'All',
      channelL1: newYieldEvent.channelL1 ?? 'All',
      channelL2: newYieldEvent.channelL2 ?? 'All',
      month: newYieldEvent.month,
      tariffMix: { ...draftMix },
      tariffBaseArpu,
      rollForward: newYieldEvent.rollForward ?? false,
      name:    newYieldEvent.name    ?? '',
      comment: newYieldEvent.comment ?? '',
    };
    addYieldEvent(event);
  }, [newYieldEvent, draftMix, yieldTierData, addYieldEvent]);

  // ── All unique tiers across saved yield events (for table header) ──────────
  const allYieldTiers = useMemo(() => {
    const tiers = new Set<string>();
    yieldEvents.forEach(e => Object.keys(e.tariffMix).forEach(t => tiers.add(t)));
    return Array.from(tiers).sort();
  }, [yieldEvents]);

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
    const vprodL1 = vprod.l1;   // null = All
    const vprodL2 = vprod.l2;   // null = All L2 within L1
    const vchanL1 = vchan.l1;
    const vchanL2 = vchan.l2;
    const vtarL1 = viewTariff.l1;  // null = All (Phase 2a; event tariff targeting arrives in 2b)
    const vtarL2 = viewTariff.l2;

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
        const segMatch  = e.segment === 'All' || vseg === 'All' || e.segment === vseg;
        // Event matches view product when:
        //  - event targets All products, OR view is All products, OR event.product === view L1
        // AND if the event has an L2 and the view has an L2, they must match too.
        const prodL1Match = e.product === 'All' || !vprodL1 || e.product === vprodL1;
        const prodL2Match = !e.productL2 || e.productL2 === 'All' || !vprodL2 || e.productL2 === vprodL2;
        const chanL1Match = e.channel === 'All' || !vchanL1 || e.channel === vchanL1;
        const chanL2Match = !e.channelL2 || e.channelL2 === 'All' || !vchanL2 || e.channelL2 === vchanL2;
        const tarL1Match = !e.tariffL1 || e.tariffL1 === 'All' || !vtarL1 || e.tariffL1 === vtarL1;
        const tarL2Match = !e.tariffL2 || e.tariffL2 === 'All' || !vtarL2 || e.tariffL2 === vtarL2;
        return segMatch && prodL1Match && prodL2Match && chanL1Match && chanL2Match && tarL1Match && tarL2Match;
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
    // Base pool ARPU is read fresh from the forecast's blended arpu.mean each month
    // (set in step E). No accumulated state needed — Option A: without events the
    // adjusted line tracks the baseline exactly, month by month.
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
      // Natural inflow → base pool unless a Yield Event overrides its ARPU,
      // in which case it enters an isolated yield pool at the blended yield ARPU.
      // Inflow market-event subscribers → their own event pools (unchanged).
      if (idx > 0) {
        const prevMonthKey = computed[idx - 1].month;

        // Find the most recent applicable Inflow yield event for prevMonthKey
        // (either a direct hit or a roll-forward event whose month ≤ prevMonthKey)
        const applicableInflowYield = yieldEvents
          .filter(ye => {
            if (ye.ibro !== 'Inflow') return false;
            const segOk = ye.segment === 'All' || vseg === 'All' || ye.segment === vseg;
            const prodOk = ye.product === 'All' || !vprodL1 || ye.product === vprodL1;
            const ch1Ok = ye.channelL1 === 'All' || !vchanL1 || ye.channelL1 === vchanL1;
            const ch2Ok = ye.channelL2 === 'All' || !vchanL2 || ye.channelL2 === vchanL2;
            if (!segOk || !prodOk || !ch1Ok || !ch2Ok) return false;
            if (ye.rollForward) return ye.month <= prevMonthKey;
            return ye.month === prevMonthKey;
          })
          // If multiple roll-forward events overlap, use the most recent
          .sort((a, b) => b.month.localeCompare(a.month))[0];

        if (applicableInflowYield) {
          // Natural inflow enters a yield pool at the blended yield ARPU.
          //
          // The event's tariffBaseArpu values may be historical (raw average from data)
          // or forecast-scaled (if the user created the event in Forecast ARPU mode).
          // To make the computation consistent in either case we express the yield
          // as an ARPU ratio: (new blended yield ARPU) / (equal-weight baseline ARPU).
          // That ratio is then applied to the forecast's per-scenario Inflow ARPU for
          // the previous month, so the improvement is anchored to the forecast level.
          const rawBlendedYieldArpu = Object.keys(applicableInflowYield.tariffMix).reduce((sum, tier) => {
            return sum + (applicableInflowYield.tariffMix[tier] / 100) * (applicableInflowYield.tariffBaseArpu[tier] ?? 0);
          }, 0);
          const storedTiers = Object.keys(applicableInflowYield.tariffBaseArpu);
          const storedEqualWeightArpu = storedTiers.length > 0
            ? storedTiers.reduce((s, t) => s + (applicableInflowYield.tariffBaseArpu[t] ?? 0), 0) / storedTiers.length
            : rawBlendedYieldArpu;
          const yieldRatio = storedEqualWeightArpu > 0 ? rawBlendedYieldArpu / storedEqualWeightArpu : 1;
          // Forecast inflow ARPU for the month whose subscribers are entering this pool
          const fcPrevMonth = baseForecast.months[idx - 1];
          const fcInflowArpu = fcPrevMonth
            ? (fcPrevMonth.inflowArpu?.mean ?? fcPrevMonth.arpu.mean)
            : storedEqualWeightArpu;
          const yieldArpu = fcInflowArpu * yieldRatio;

          if (p_prevBBaseIn > 0) {
            p_eventPools.push({
              eventId: `yield-${applicableInflowYield.id}-${prevMonthKey}`,
              arpu: yieldArpu,
              contractLength: DEFAULT_CONTRACT_N,
              enterMonthIdx: idx,
              size: Math.max(0, p_prevBBaseIn),
            });
            // Natural inflow captured by yield pool — do NOT also add to base pool
          }
        } else {
          // No yield override — natural inflow joins base pool.
          // ARPU is read from m.baseline.arpu each month (step E), so no accumulated
          // re-averaging is needed here.
          p_basePool += p_prevBBaseIn;
        }

        // Volume market-event Inflow pools.
        // Per-subscriber ARPU is derived from event revenue ÷ event volume so the
        // blended formula  (baseRevenue + eventRevenue) / totalSubs  is always
        // consistent with what the user entered.  Fall back to the explicit arpu
        // field if revenue was left blank, and finally to the baseline ARPU for
        // the month so a volume-only event doesn't collapse the blended ARPU to 0.
        const prevMonthBaselineArpu = computed[idx - 1]?.baseline.arpu ?? m.baseline.arpu;
        marketEvents
          .filter(e =>
            e.date === prevMonthKey &&
            e.scenario === 'Inflow' &&
            !p_eventPools.find(p => p.eventId === e.id) &&
            (e.segment  === 'All' || vseg    === 'All' || e.segment  === vseg) &&
            (e.product  === 'All' || !vprodL1            || e.product  === vprodL1) &&
            (e.channel  === 'All' || !vchanL1            || e.channel  === vchanL1),
          )
          .forEach(e => {
            const derivedArpu =
              e.subscriberVolume > 0 && Math.abs(e.revenue) > 0
                ? e.revenue / e.subscriberVolume   // revenue ÷ volume — primary source
                : e.arpu > 0
                  ? e.arpu                          // explicit arpu entry
                  : prevMonthBaselineArpu;           // volume-only: keep blended ARPU neutral
            p_eventPools.push({
              eventId: e.id,
              arpu: derivedArpu,
              contractLength: e.contractLength ?? DEFAULT_CONTRACT_N,
              enterMonthIdx: idx,
              size: Math.max(0, e.subscriberVolume),
            });
          });
      } else {
        // idx === 0: no previous month to lag
        p_basePool += p_prevBBaseIn;
      }

      // ── D: Enforce pool-sum consistency with newBAdj ──
      const eventTotal = p_eventPools.reduce((s, p) => s + p.size, 0);
      p_basePool = Math.max(0, newBAdj - eventTotal);

      // ── E: Blended ARPU ──
      // Base pool ARPU = this month's forecast blended ARPU. Reading it fresh each
      // month (rather than accumulating) guarantees adjusted = baseline when no
      // events are applied (Option A). Events shift it from this anchor.
      let baseARPU = m.baseline.arpu;

      // Retention yield events: adjust the effective base ARPU to reflect the
      // yield mix on the retained cohort for this month.
      const applicableRetentionYield = yieldEvents
        .filter(ye => {
          if (ye.ibro !== 'Retention') return false;
          const segOk = ye.segment === 'All' || vseg === 'All' || ye.segment === vseg;
          const prodOk = ye.product === 'All' || !vprodL1 || ye.product === vprodL1;
          const ch1Ok = ye.channelL1 === 'All' || !vchanL1 || ye.channelL1 === vchanL1;
          const ch2Ok = ye.channelL2 === 'All' || !vchanL2 || ye.channelL2 === vchanL2;
          if (!segOk || !prodOk || !ch1Ok || !ch2Ok) return false;
          if (ye.rollForward) return ye.month <= m.month;
          return ye.month === m.month;
        })
        .sort((a, b) => b.month.localeCompare(a.month))[0];

      if (applicableRetentionYield && p_basePool > 0) {
        const retentionVol = Math.min(m.uplifted.retention, p_basePool);
        // Same ratio-anchoring logic as the Inflow case above: express as a ratio
        // of (new blended) / (equal-weight stored) then apply to forecast retention ARPU.
        const rawRetentionYieldArpu = Object.keys(applicableRetentionYield.tariffMix).reduce((sum, tier) => {
          return sum + (applicableRetentionYield.tariffMix[tier] / 100) * (applicableRetentionYield.tariffBaseArpu[tier] ?? 0);
        }, 0);
        const retStoredTiers = Object.keys(applicableRetentionYield.tariffBaseArpu);
        const retStoredEqualWeightArpu = retStoredTiers.length > 0
          ? retStoredTiers.reduce((s, t) => s + (applicableRetentionYield.tariffBaseArpu[t] ?? 0), 0) / retStoredTiers.length
          : rawRetentionYieldArpu;
        const retYieldRatio = retStoredEqualWeightArpu > 0 ? rawRetentionYieldArpu / retStoredEqualWeightArpu : 1;
        const fcCurMonth = baseForecast.months[idx];
        const fcRetentionArpu = fcCurMonth
          ? (fcCurMonth.retentionArpu?.mean ?? fcCurMonth.arpu.mean)
          : retStoredEqualWeightArpu;
        const yieldArpu = fcRetentionArpu * retYieldRatio;

        // Revenue-weighted blend: retained subs shift to yieldArpu, rest keep baseARPU
        const nonRetainedVol = Math.max(0, p_basePool - retentionVol);
        baseARPU = (nonRetainedVol * baseARPU + retentionVol * yieldArpu) / p_basePool;
      }

      let blendedARPU = baseARPU;

      if (newBAdj > 0 && eventTotal > 0) {
        // Adjusted ARPU = (Σ current cohort revenue + Σ market event revenue)
        //                 / (current cohort subs   + market event subs)
        // Event pool ARPU is derived from event.revenue / event.subscriberVolume
        // (see pool creation above), so p.size * p.arpu = remaining event revenue.
        // Contract length controls when event subs enter the at-risk churn pool,
        // keeping their per-subscriber ARPU in the blend for the protected period.
        const baseRevenue  = p_basePool * baseARPU;
        const eventRevenue = p_eventPools.reduce((s, p) => s + p.size * p.arpu, 0);
        blendedARPU = Math.max(0, (baseRevenue + eventRevenue) / newBAdj);
      }

      // ── F: Pass 3 — Pricing Events (applied after yield blending) ──────────
      // one-off: applies only in event.month; recurring: from event.month onwards.
      // Multiple events stack sequentially (earliest first).
      //
      // target === 'cohorts':
      //   Delta applies only to inflow + retention cohort volume this month.
      //   Existing base pool keeps the pre-pricing blendedARPU.
      //   Blended = (cohortVol × pricedARPU + baseVol × blendedARPU) / totalVol
      //
      // target === 'cohorts+base':
      //   Delta applies to the full blended ARPU (all subscribers).
      let pricingARPU = blendedARPU;
      pricingEvents
        .filter(pe => {
          const segOk  = pe.segment   === 'All' || vseg    === 'All' || pe.segment   === vseg;
          const prodOk = pe.product   === 'All' || !vprodL1              || pe.product   === vprodL1;
          const pl2Ok  = pe.productL2 === 'All' || !vprodL2              || pe.productL2 === vprodL2;
          const ch1Ok  = pe.channelL1 === 'All' || !vchanL1              || pe.channelL1 === vchanL1;
          const ch2Ok  = pe.channelL2 === 'All' || !vchanL2              || pe.channelL2 === vchanL2;
          if (!segOk || !prodOk || !pl2Ok || !ch1Ok || !ch2Ok) return false;
          if (pe.duration === 'one-off') return pe.month === m.month;
          return pe.month <= m.month;
        })
        .sort((a, b) => a.month.localeCompare(b.month))
        .forEach(pe => {
          const applyDelta = (arpu: number) =>
            pe.inputMode === 'percentage' ? arpu * (1 + pe.amount / 100) : arpu + pe.amount;

          if (pe.target === 'cohorts') {
            // Cohorts Only: price the selected cohort type(s); base + unselected cohorts stay unchanged.
            const inflowVol     = pe.cohortScope !== 'retention' ? m.uplifted.inflow     : 0;
            const retentionVol  = pe.cohortScope !== 'inflow'    ? m.uplifted.retention  : 0;
            const pricedVol     = inflowVol + retentionVol;
            const totalVol      = m.uplifted.inflow + m.uplifted.retention + newBAdj;
            if (totalVol > 0 && pricedVol > 0) {
              const pricedARPU = applyDelta(pricingARPU);
              pricingARPU = (pricedVol * pricedARPU + (totalVol - pricedVol) * pricingARPU) / totalVol;
            }
          } else if (pe.target === 'base-only') {
            // Base Only: delta applies to the base pool component only;
            // event pools retain their own fixed ARPUs.
            if (newBAdj > 0) {
              const pricedBaseARPU = applyDelta(baseARPU);
              const baseRevenue  = p_basePool * pricedBaseARPU;
              const eventRevenue = p_eventPools.reduce((s, p) => s + p.size * p.arpu, 0);
              pricingARPU = (baseRevenue + eventRevenue) / newBAdj;
            }
          } else {
            // Cohorts + Base: base always included; cohortScope controls which cohort type(s) also get the delta.
            if (pe.cohortScope === 'both') {
              pricingARPU = applyDelta(pricingARPU);
            } else {
              const inflowVol    = pe.cohortScope !== 'retention' ? m.uplifted.inflow    : 0;
              const retentionVol = pe.cohortScope !== 'inflow'    ? m.uplifted.retention : 0;
              const pricedVol    = inflowVol + retentionVol + newBAdj;
              const totalVol     = m.uplifted.inflow + m.uplifted.retention + newBAdj;
              if (totalVol > 0 && pricedVol > 0) {
                const pricedARPU = applyDelta(pricingARPU);
                pricingARPU = (pricedVol * pricedARPU + (totalVol - pricedVol) * pricingARPU) / totalVol;
              }
            }
          }
        });
      pricingARPU = Math.max(0, pricingARPU);

      m.uplifted.arpu = pricingARPU;

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
        'ARPU (Adjusted)':      +pricingARPU.toFixed(2),
        // Outflow ARPU reference — display-only line on ARPU axis
        'ARPU Outflow (Ref)':   +(baseForecast.months[idx]?.outflowArpu?.mean ?? m.baseline.arpu).toFixed(2),
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
  }, [baseForecast, marketEvents, yieldEvents, pricingEvents, viewSegment, viewProduct, viewChannel, viewTariff]);

  // ── Custom chart tooltip — shows KPI values + any event names for that month ─
  const renderTooltip = useCallback(({ active, payload, label }: any) => {
    if (!active || !payload?.length) return null;
    const meForMonth = marketEvents.filter(e => e.date === label);
    const yeForMonth = yieldEvents.filter(e => e.month === label);
    const peForMonth = pricingEvents.filter(e => e.month === label);
    const hasEvents = meForMonth.length + yeForMonth.length + peForMonth.length > 0;
    return (
      <div style={{ background: '#fff', borderRadius: 8, boxShadow: '0 4px 6px -1px rgb(0 0 0/0.1)', padding: '10px 14px', minWidth: 180 }}>
        <p style={{ fontWeight: 700, color: '#0f172a', marginBottom: 6, fontSize: 12 }}>{fmtMonth(label)}</p>
        {payload.map((entry: any, i: number) => (
          <p key={i} style={{ color: entry.color, fontSize: 12, marginBottom: 2 }}>
            {entry.name}: <span style={{ fontWeight: 600 }}>{formatNumber(entry.value)}</span>
          </p>
        ))}
        {hasEvents && (
          <div style={{ marginTop: 8, paddingTop: 8, borderTop: '1px solid #f1f5f9' }}>
            <p style={{ fontSize: 10, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>Events this month</p>
            {meForMonth.map(e => (
              <div key={e.id} style={{ fontSize: 11, color: '#f43f5e', marginBottom: 3 }}>
                <span style={{ fontWeight: 700 }}>{e.name || e.scenario}</span>
                {e.comment && <span style={{ color: '#64748b' }}> — {e.comment}</span>}
              </div>
            ))}
            {yeForMonth.map(e => (
              <div key={e.id} style={{ fontSize: 11, color: '#8b5cf6', marginBottom: 3 }}>
                <span style={{ fontWeight: 700 }}>{e.name || `Yield: ${e.ibro}`}</span>
                {e.comment && <span style={{ color: '#64748b' }}> — {e.comment}</span>}
              </div>
            ))}
            {peForMonth.map(e => (
              <div key={e.id} style={{ fontSize: 11, color: '#f97316', marginBottom: 3 }}>
                <span style={{ fontWeight: 700 }}>{e.name || 'Pricing'}</span>
                {e.comment && <span style={{ color: '#64748b' }}> — {e.comment}</span>}
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }, [marketEvents, yieldEvents, pricingEvents, formatNumber]);

  // ── Add Pricing Event (defined here so it can read chartData) ────────────
  const handleAddPricingEvent = useCallback(() => {
    if (!newPricingEvent.month || newPricingEvent.amount === undefined) return;
    // Snapshot the pre-pricing blended ARPU for the selected month from chartData
    const matchRow = chartData.find(r => r.month === newPricingEvent.month);
    const originalBaseArpu = matchRow ? (matchRow['ARPU (Adjusted)'] as number) : 0;

    const event: PricingEvent = {
      id: Math.random().toString(36).substr(2, 9),
      segment:   newPricingEvent.segment   ?? 'All',
      product:   newPricingEvent.product   ?? 'All',
      productL2: newPricingEvent.productL2 ?? 'All',
      channelL1: newPricingEvent.channelL1 ?? 'All',
      channelL2: newPricingEvent.channelL2 ?? 'All',
      month:     newPricingEvent.month,
      inputMode: newPricingEvent.inputMode ?? 'percentage',
      amount:    newPricingEvent.amount,
      target:      newPricingEvent.target      ?? 'cohorts',
      cohortScope: newPricingEvent.cohortScope ?? 'both',
      duration:    newPricingEvent.duration    ?? 'one-off',
      originalBaseArpu,
      name:    newPricingEvent.name    ?? '',
      comment: newPricingEvent.comment ?? '',
    };
    addPricingEvent(event);
  }, [newPricingEvent, chartData, addPricingEvent]);

  // ── Volume spread handler ─────────────────────────────────────────────────
  const handleAddMarketEvent = useCallback(() => {
    if (!newEvent.date || newEvent.subscriberVolume === undefined) return;

    if (!spreadEnabled || newEvent.scenario === 'ARPU') {
      addMarketEvent();
      return;
    }

    const isOutflow = newEvent.scenario === 'Outflow';
    const neg = (v: number) => isOutflow ? -Math.abs(v) : v;

    const pcts = spreadDistType === 'even'
      ? Array.from({ length: spreadMonths }, () => 100 / spreadMonths)
      : customDist.slice(0, spreadMonths);

    const total = pcts.reduce((s, p) => s + p, 0);
    if (total <= 0) return;

    const baseDate = parse(newEvent.date, 'yyyy-MM', new Date());
    const events: MarketEvent[] = pcts.map((pct, i) => {
      const fraction = pct / total;
      const monthStr = format(addMonths(baseDate, i), 'yyyy-MM');
      const vol = Math.round((newEvent.subscriberVolume || 0) * fraction);
      return {
        id: Math.random().toString(36).substr(2, 9),
        scenario:        newEvent.scenario as any,
        segment:         newEvent.segment   || 'All',
        product:         newEvent.product   || 'All',
        productL2:       newEvent.productL2 || 'All',
        channel:         newEvent.channel   || 'All',
        channelL2:       newEvent.channelL2 || 'All',
        tariffL1:        newEvent.tariffL1  || 'All',
        tariffL2:        newEvent.tariffL2  || 'All',
        date:            monthStr,
        subscriberVolume: neg(vol),
        customerVolume:   neg(Math.round((newEvent.customerVolume || 0) * fraction)),
        revenue:          neg(Math.round((newEvent.revenue        || 0) * fraction)),
        arpu:             neg(newEvent.arpu || 0),
        name:             newEvent.name         || '',
        campaignName:     newEvent.campaignName || '',
        comment:          newEvent.comment      || '',
        contractLength:   newEvent.contractLength ?? 24,
      };
    });

    setMarketEvents([...marketEvents, ...events]);
    setNewEvent({
      scenario: 'Inflow', segment: 'All', product: 'All', productL2: 'All',
      channel: 'All', channelL2: 'All', tariffL1: 'All', tariffL2: 'All', date: format(new Date(), 'yyyy-MM'),
      subscriberVolume: 0, customerVolume: 0, revenue: 0, arpu: 0, name: '', campaignName: '', comment: '', contractLength: 24,
    });
    setSpreadEnabled(false);
    setSpreadMonths(3);
    setSpreadDistType('even');
    setCustomDist([34, 33, 33]);
  }, [newEvent, spreadEnabled, spreadMonths, spreadDistType, customDist, addMarketEvent, setMarketEvents, marketEvents, setNewEvent]);

  const BLANK_EVENT: Partial<MarketEvent> = {
    scenario: 'Inflow', segment: 'All', product: 'All', productL2: 'All',
    channel: 'All', channelL2: 'All', tariffL1: 'All', tariffL2: 'All', date: format(new Date(), 'yyyy-MM'),
    subscriberVolume: 0, customerVolume: 0, revenue: 0, arpu: 0,
    name: '', campaignName: '', comment: '', contractLength: 24,
  };

  const handleEditStart = useCallback((event: MarketEvent) => {
    const isOutflow = event.scenario === 'Outflow';
    // Display absolute values — the neg() convention is re-applied on save
    const abs = (v: number) => isOutflow ? Math.abs(v) : v;
    setNewEvent({
      scenario: event.scenario,
      segment: event.segment,
      product: event.product,
      productL2: event.productL2 ?? 'All',
      channel: event.channel,
      channelL2: event.channelL2 ?? 'All',
      tariffL1: event.tariffL1 ?? 'All',
      tariffL2: event.tariffL2 ?? 'All',
      date: event.date,
      subscriberVolume: abs(event.subscriberVolume),
      customerVolume: abs(event.customerVolume),
      revenue: abs(event.revenue),
      arpu: abs(event.arpu),
      name: event.name ?? '',
      campaignName: event.campaignName ?? '',
      comment: event.comment,
      contractLength: event.contractLength,
    });
    setEditingEventId(event.id);
    setEditingCampaign(null);
    setSpreadEnabled(false);
  }, [setNewEvent]);

  // ── Campaign group edit ────────────────────────────────────────────────────
  // A campaign is group-editable when all its events share scenario + cohort
  // dimensions + contract length (i.e. it is a pure volume spread), the month
  // span fits the spread control (≤24), and it is not a multi-month ARPU group.
  const campaignGroups = useMemo(() => {
    const groups = new Map<string, { rows: MarketEvent[]; editable: boolean; reason: string }>();
    marketEvents.forEach(e => {
      if (!e.campaignName) return;
      if (!groups.has(e.campaignName)) groups.set(e.campaignName, { rows: [], editable: true, reason: '' });
      groups.get(e.campaignName)!.rows.push(e);
    });
    groups.forEach(g => {
      g.rows.sort((a, b) => a.date.localeCompare(b.date));
      const first = g.rows[0];
      const homogeneous = g.rows.every(e =>
        e.scenario === first.scenario &&
        e.segment === first.segment &&
        e.product === first.product &&
        (e.productL2 ?? 'All') === (first.productL2 ?? 'All') &&
        e.channel === first.channel &&
        (e.channelL2 ?? 'All') === (first.channelL2 ?? 'All') &&
        (e.tariffL1 ?? 'All') === (first.tariffL1 ?? 'All') &&
        (e.tariffL2 ?? 'All') === (first.tariffL2 ?? 'All') &&
        e.contractLength === first.contractLength
      );
      const d0 = parse(first.date, 'yyyy-MM', new Date());
      const dN = parse(g.rows[g.rows.length - 1].date, 'yyyy-MM', new Date());
      const span = isValid(d0) && isValid(dN) ? differenceInCalendarMonths(dN, d0) + 1 : 0;
      if (!homogeneous) {
        g.editable = false;
        g.reason = 'Events in this campaign target different scenarios or cohorts — edit rows individually';
      } else if (first.scenario === 'ARPU' && g.rows.length > 1) {
        g.editable = false;
        g.reason = 'Multi-month ARPU campaigns cannot be edited as a spread — edit rows individually';
      } else if (span > 24) {
        g.editable = false;
        g.reason = 'Campaign spans more than 24 months — edit rows individually';
      } else if (span < 1) {
        g.editable = false;
        g.reason = 'Campaign has an invalid month — edit rows individually';
      }
    });
    return groups;
  }, [marketEvents]);

  const handleEditCampaignStart = useCallback((campaign: string) => {
    const group = campaignGroups.get(campaign);
    if (!group || !group.editable) return;
    const rows = group.rows;

    // Single-row campaigns edit exactly like a single event
    if (rows.length === 1) {
      handleEditStart(rows[0]);
      setEditingEventId(null);
      setEditingCampaign(campaign);
      return;
    }

    const first = rows[0];
    const isOutflow = first.scenario === 'Outflow';
    const abs = (v: number) => isOutflow ? Math.abs(v) : v;

    // Reverse-engineer the spread from the stored rows: total volume is the
    // sum, span is first→last month, per-month % is each row's share.
    const d0 = parse(first.date, 'yyyy-MM', new Date());
    const span = differenceInCalendarMonths(parse(rows[rows.length - 1].date, 'yyyy-MM', new Date()), d0) + 1;
    const volByOffset = new Array(span).fill(0);
    let totalSub = 0, totalCust = 0, totalRev = 0;
    rows.forEach(e => {
      const off = differenceInCalendarMonths(parse(e.date, 'yyyy-MM', new Date()), d0);
      volByOffset[off] += Math.abs(e.subscriberVolume);
      totalSub  += Math.abs(e.subscriberVolume);
      totalCust += Math.abs(e.customerVolume);
      totalRev  += Math.abs(e.revenue);
    });

    // Derive percentages summing to exactly 100 (residual goes to month 1,
    // matching the even-split remainder convention used on creation)
    const pcts = volByOffset.map(v => totalSub > 0 ? Math.round((v / totalSub) * 100) : 0);
    pcts[0] += 100 - pcts.reduce((s, p) => s + p, 0);

    // Even if every month's volume is within rounding distance of the mean
    const mean = totalSub / span;
    const isEven = volByOffset.every(v => Math.abs(v - mean) <= 1);

    setNewEvent({
      scenario: first.scenario,
      segment: first.segment,
      product: first.product,
      productL2: first.productL2 ?? 'All',
      channel: first.channel,
      channelL2: first.channelL2 ?? 'All',
      tariffL1: first.tariffL1 ?? 'All',
      tariffL2: first.tariffL2 ?? 'All',
      date: first.date,
      subscriberVolume: totalSub,
      customerVolume: totalCust,
      revenue: totalRev,
      arpu: abs(first.arpu),
      name: '',
      campaignName: campaign,
      comment: rows.find(e => e.comment)?.comment ?? '',
      contractLength: first.contractLength,
    });
    setSpreadEnabled(true);
    setSpreadMonths(span);
    setSpreadDistType(isEven ? 'even' : 'custom');
    setCustomDist(pcts);
    setEditingEventId(null);
    setEditingCampaign(campaign);
  }, [campaignGroups, handleEditStart, setNewEvent]);

  const handleSaveCampaign = useCallback(() => {
    if (!editingCampaign || !newEvent.date) return;
    const isOutflow = newEvent.scenario === 'Outflow';
    const neg = (v: number) => isOutflow ? -Math.abs(v) : v;

    let newEvents: MarketEvent[];
    if (!spreadEnabled || newEvent.scenario === 'ARPU') {
      newEvents = [{
        id: Math.random().toString(36).substr(2, 9),
        scenario: newEvent.scenario as MarketEvent['scenario'],
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
        revenue:          neg(newEvent.revenue           || 0),
        arpu:             neg(newEvent.arpu              || 0),
        name: '',
        campaignName: newEvent.campaignName || '',
        comment: newEvent.comment || '',
        contractLength: newEvent.contractLength ?? 24,
      }];
    } else {
      const pcts = spreadDistType === 'even'
        ? Array.from({ length: spreadMonths }, () => 100 / spreadMonths)
        : customDist.slice(0, spreadMonths);
      const total = pcts.reduce((s, p) => s + p, 0);
      if (total <= 0) return;
      const baseDate = parse(newEvent.date, 'yyyy-MM', new Date());
      newEvents = pcts.map((pct, i) => {
        const fraction = pct / total;
        return {
          id: Math.random().toString(36).substr(2, 9),
          scenario: newEvent.scenario as MarketEvent['scenario'],
          segment: newEvent.segment || 'All',
          product: newEvent.product || 'All',
          productL2: newEvent.productL2 || 'All',
          channel: newEvent.channel || 'All',
          channelL2: newEvent.channelL2 || 'All',
          tariffL1: newEvent.tariffL1 || 'All',
          tariffL2: newEvent.tariffL2 || 'All',
          date: format(addMonths(baseDate, i), 'yyyy-MM'),
          subscriberVolume: neg(Math.round((newEvent.subscriberVolume || 0) * fraction)),
          customerVolume:   neg(Math.round((newEvent.customerVolume   || 0) * fraction)),
          revenue:          neg(Math.round((newEvent.revenue           || 0) * fraction)),
          arpu:             neg(newEvent.arpu || 0),
          name: '',
          campaignName: newEvent.campaignName || '',
          comment: newEvent.comment || '',
          contractLength: newEvent.contractLength ?? 24,
        };
      });
    }

    setMarketEvents([...marketEvents.filter(e => e.campaignName !== editingCampaign), ...newEvents]);
    setEditingCampaign(null);
    setNewEvent(BLANK_EVENT);
    setSpreadEnabled(false);
    setSpreadMonths(3);
    setSpreadDistType('even');
    setCustomDist([34, 33, 33]);
  }, [editingCampaign, newEvent, spreadEnabled, spreadMonths, spreadDistType, customDist, marketEvents, setMarketEvents, setNewEvent]);

  const handleSaveEdit = useCallback(() => {
    if (!editingEventId || !newEvent.date) return;
    const isOutflow = newEvent.scenario === 'Outflow';
    const neg = (v: number) => isOutflow ? -Math.abs(v) : v;
    updateMarketEvent(editingEventId, {
      scenario: newEvent.scenario as MarketEvent['scenario'],
      segment: newEvent.segment ?? 'All',
      product: newEvent.product ?? 'All',
      productL2: newEvent.productL2 ?? 'All',
      channel: newEvent.channel ?? 'All',
      channelL2: newEvent.channelL2 ?? 'All',
      tariffL1: newEvent.tariffL1 ?? 'All',
      tariffL2: newEvent.tariffL2 ?? 'All',
      date: newEvent.date,
      subscriberVolume: neg(newEvent.subscriberVolume ?? 0),
      customerVolume:   neg(newEvent.customerVolume   ?? 0),
      revenue:          neg(newEvent.revenue           ?? 0),
      arpu:             neg(newEvent.arpu              ?? 0),
      name: newEvent.name ?? '',
      campaignName: newEvent.campaignName ?? '',
      comment: newEvent.comment ?? '',
      contractLength: newEvent.contractLength ?? 24,
    });
    setEditingEventId(null);
    setNewEvent(BLANK_EVENT);
  }, [editingEventId, newEvent, updateMarketEvent, setNewEvent]);

  const handleCancelEdit = useCallback(() => {
    setEditingEventId(null);
    setEditingCampaign(null);
    setNewEvent(BLANK_EVENT);
    setSpreadEnabled(false);
    setSpreadMonths(3);
    setSpreadDistType('even');
    setCustomDist([34, 33, 33]);
  }, [setNewEvent]);

  // -------------------------------------------------------------------------
  // Write MarketEventAdjustedForecast back to context whenever inputs change
  // -------------------------------------------------------------------------

  useEffect(() => {
    if (!baseForecast || adjustedMonths.length === 0) {
      setAdjustedForecast(null);
      return;
    }

    const adjusted: MarketEventAdjustedForecast = {
      base: baseForecast,
      marketEvents,
      adjustedMonths,
    };
    setAdjustedForecast(adjusted);
  }, [baseForecast, adjustedMonths, marketEvents]);

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
  // L1 product/channel options for the market event form (events target L1; L2 is supplementary)
  const productL1Options = useMemo(
    () => Array.from(new Set(data.map(r => String(r[wiProductCol])).filter(v => v && v !== 'undefined'))).sort(),
    [data, wiProductCol],
  );
  const channelL1Options = useMemo(
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

          {wiProductCol && productTree.size > 0 && (
            <HierarchicalDropdown
              label="Product"
              tree={productTree}
              value={viewProduct}
              onChange={setViewProduct}
              variant="light"
            />
          )}

          {wiChannelCol && channelTree.size > 0 && (
            <HierarchicalDropdown
              label="Channel"
              tree={channelTree}
              value={viewChannel}
              onChange={setViewChannel}
              variant="light"
            />
          )}

          {wiTariffL1Col && tariffTree && tariffTree.size > 0 && (
            <HierarchicalDropdown
              label="Tariff"
              tree={tariffTree}
              value={viewTariff}
              onChange={setViewTariff}
              variant="light"
            />
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

          {(viewSegment !== 'All' || viewProduct.l1 !== null || viewChannel.l1 !== null || viewTariff.l1 !== null || viewScenario !== 'All') && (
            <button
              onClick={() => { setViewSegment('All'); setViewProduct({ l1: null, l2: null }); setViewChannel({ l1: null, l2: null }); setViewTariff({ l1: null, l2: null }); setViewScenario('All'); }}
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
                  <Tooltip content={renderTooltip} />
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

                  {/* Event reference lines — deduplicated by month; label shows campaign/event name or scenario */}
                  {(() => {
                    const seen = new Map<string, string[]>();
                    marketEvents.forEach(e => {
                      if (!isValid(parse(e.date, 'yyyy-MM', new Date()))) return;
                      const label = e.campaignName || e.name || e.scenario;
                      if (!seen.has(e.date)) seen.set(e.date, []);
                      const labels = seen.get(e.date)!;
                      if (!labels.includes(label)) labels.push(label);
                    });
                    return Array.from(seen.entries()).map(([date, labels]) => (
                      <ReferenceLine
                        key={`ref-${date}`}
                        x={date}
                        yAxisId="left"
                        stroke="#f43f5e"
                        strokeDasharray="3 3"
                        label={{ position: 'top', value: labels.join(' / '), fill: '#f43f5e', fontSize: 9 }}
                      />
                    ));
                  })()}

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

                  {/* Outflow ARPU reference line — shown whenever ARPU KPI is selected */}
                  {selectedKpis.includes('ARPU') && (
                    <Line
                      yAxisId="right"
                      type="monotone"
                      dataKey="ARPU Outflow (Ref)"
                      stroke="#94a3b8"
                      strokeWidth={1.5}
                      strokeDasharray="3 6"
                      dot={false}
                      name="ARPU Outflow (Ref)"
                      connectNulls
                    />
                  )}
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-slate-400 text-sm">
                Select at least one KPI above to view the chart.
              </div>
            )}
          </div>
        </div>

        {/* ── Volume / Value / Pricing tab switcher — below the chart ────────── */}
        <div className="flex gap-1 bg-slate-100 p-1 rounded-xl w-fit">
          {(['volume', 'value', 'pricing'] as const).map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-5 py-1.5 rounded-lg text-sm font-semibold transition-all ${
                activeTab === tab
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              {tab === 'volume' ? 'Volume' : tab === 'value' ? 'Value' : 'Pricing'}
            </button>
          ))}
        </div>

        {/* ── VOLUME TAB — Market Events form + table + Stock-and-Flow ─────── */}
        {activeTab === 'volume' && (<>
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
                {productTree.size > 0 ? (
                  <HierarchicalDropdown
                    label=""
                    tree={productTree}
                    value={{
                      l1: newEvent.product && newEvent.product !== 'All' ? newEvent.product : null,
                      l2: newEvent.productL2 && newEvent.productL2 !== 'All' ? newEvent.productL2 : null,
                    }}
                    onChange={(v: HierarchicalSelection) => setNewEvent({
                      ...newEvent,
                      product: v.l1 ?? 'All',
                      productL2: v.l2 ?? 'All',
                    })}
                    variant="light"
                    className="w-full"
                  />
                ) : (
                  <select
                    value={newEvent.product || 'All'}
                    onChange={e => setNewEvent({ ...newEvent, product: e.target.value, productL2: 'All' })}
                    className="w-full text-sm border border-slate-200 rounded-lg p-2 bg-white outline-none focus:border-[#e60000]"
                  >
                    <option value="All">All Products</option>
                    {productL1Options.map(p => <option key={p} value={p}>{p}</option>)}
                  </select>
                )}
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">Channel</label>
                {channelTree.size > 0 ? (
                  <HierarchicalDropdown
                    label=""
                    tree={channelTree}
                    value={{
                      l1: newEvent.channel && newEvent.channel !== 'All' ? newEvent.channel : null,
                      l2: newEvent.channelL2 && newEvent.channelL2 !== 'All' ? newEvent.channelL2 : null,
                    }}
                    onChange={(v: HierarchicalSelection) => setNewEvent({
                      ...newEvent,
                      channel: v.l1 ?? 'All',
                      channelL2: v.l2 ?? 'All',
                    })}
                    variant="light"
                    className="w-full"
                  />
                ) : (
                  <select
                    value={newEvent.channel || 'All'}
                    onChange={e => setNewEvent({ ...newEvent, channel: e.target.value, channelL2: 'All' })}
                    className="w-full text-sm border border-slate-200 rounded-lg p-2 bg-white outline-none focus:border-[#e60000]"
                  >
                    <option value="All">All Channels</option>
                    {channelL1Options.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                )}
              </div>
              {/* Tariff targeting (Phase 2b P7) — composes with Product/Channel; leave those
                  as All to target "all RED L customers regardless of product/channel". Only
                  shown when a tariff column is mapped; options limited to selected tariffs. */}
              {wiTariffL1Col && targetTariffTree.size > 0 && (
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">Tariff</label>
                  <HierarchicalDropdown
                    label=""
                    tree={targetTariffTree}
                    value={{
                      l1: newEvent.tariffL1 && newEvent.tariffL1 !== 'All' ? newEvent.tariffL1 : null,
                      l2: newEvent.tariffL2 && newEvent.tariffL2 !== 'All' ? newEvent.tariffL2 : null,
                    }}
                    onChange={(v: HierarchicalSelection) => setNewEvent({
                      ...newEvent,
                      tariffL1: v.l1 ?? 'All',
                      tariffL2: v.l2 ?? 'All',
                    })}
                    variant="light"
                    className="w-full"
                  />
                </div>
              )}
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
                  <span className="relative group text-slate-400 cursor-help">
                    <Info size={11} />
                    <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 hidden group-hover:block w-56 bg-white border border-slate-200 rounded-xl shadow-lg text-xs text-slate-600 p-2.5 z-50 pointer-events-none normal-case font-normal">
                      This controls how long new subscribers from this event are protected from churn before entering the at-risk pool. Default is 24 months.
                    </span>
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
            </div>

            {/* Volume spread section — only shown for non-ARPU scenarios */}
            {newEvent.scenario !== 'ARPU' && (
              <div className="mt-4">
                {/* Toggle */}
                <button
                  type="button"
                  onClick={() => setSpreadEnabled(v => !v)}
                  className={`flex items-center gap-2 text-xs font-semibold px-3 py-1.5 rounded-lg border transition-colors ${
                    spreadEnabled
                      ? 'bg-[#e60000] text-white border-[#e60000]'
                      : 'bg-white text-slate-500 border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <span className={`w-3.5 h-3.5 rounded-full border-2 flex items-center justify-center transition-colors ${spreadEnabled ? 'border-white' : 'border-slate-400'}`}>
                    {spreadEnabled && <span className="w-1.5 h-1.5 rounded-full bg-white" />}
                  </span>
                  Spread volume over multiple months
                </button>

                {spreadEnabled && (
                  <div className="mt-3 p-4 bg-white border border-slate-200 rounded-xl">
                    {/* Step 1: Duration */}
                    <div className="flex flex-wrap items-end gap-6 mb-4">
                      <div>
                        <label className="block text-xs font-medium text-slate-500 mb-1">Spread duration (months)</label>
                        <input
                          type="number"
                          min={2}
                          max={24}
                          step={1}
                          value={spreadMonths}
                          onChange={e => setSpreadMonths(Math.min(24, Math.max(2, Math.round(Number(e.target.value)))))}
                          className="w-24 text-sm border border-slate-200 rounded-lg p-2 bg-white outline-none focus:border-[#e60000]"
                        />
                      </div>
                      {/* Step 2: Distribution type */}
                      <div>
                        <label className="block text-xs font-medium text-slate-500 mb-1">Distribution</label>
                        <div className="flex rounded-lg overflow-hidden border border-slate-200">
                          <button
                            onClick={() => setSpreadDistType('even')}
                            className={`px-4 py-2 text-xs font-semibold border-r border-slate-200 transition-colors ${
                              spreadDistType === 'even' ? 'bg-[#e60000] text-white' : 'bg-white text-slate-500 hover:bg-slate-50'
                            }`}
                          >Even</button>
                          <button
                            onClick={() => setSpreadDistType('custom')}
                            className={`px-4 py-2 text-xs font-semibold transition-colors ${
                              spreadDistType === 'custom' ? 'bg-[#e60000] text-white' : 'bg-white text-slate-500 hover:bg-slate-50'
                            }`}
                          >Custom %</button>
                        </div>
                      </div>
                    </div>

                    {/* Step 3: Per-month breakdown */}
                    {(() => {
                      const baseDate = newEvent.date ? parse(newEvent.date, 'yyyy-MM', new Date()) : null;
                      const totalVol  = newEvent.subscriberVolume || 0;
                      const pcts = spreadDistType === 'even'
                        ? Array.from({ length: spreadMonths }, () => 100 / spreadMonths)
                        : customDist.slice(0, spreadMonths);
                      const pctTotal = pcts.reduce((s, p) => s + p, 0);
                      const pctOk = Math.abs(pctTotal - 100) < 0.5;

                      return (
                        <div>
                          <div className="grid gap-1.5" style={{ gridTemplateColumns: `140px 1fr${spreadDistType === 'custom' ? ' 80px' : ''}` }}>
                            <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Month</span>
                            <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Volume</span>
                            {spreadDistType === 'custom' && <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">%</span>}
                            {Array.from({ length: spreadMonths }, (_, i) => {
                              const monthLabel = baseDate && isValid(baseDate)
                                ? format(addMonths(baseDate, i), 'MMM yyyy')
                                : `Month ${i + 1}`;
                              const fraction  = pcts[i] / (pctTotal || 1);
                              const vol       = Math.round(totalVol * fraction);
                              return (
                                <React.Fragment key={i}>
                                  <span className="text-xs text-slate-600 py-1">{monthLabel}</span>
                                  <span className={`text-xs font-semibold py-1 ${vol >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                                    {vol >= 0 ? '+' : ''}{vol.toLocaleString()}
                                  </span>
                                  {spreadDistType === 'custom' && (
                                    <input
                                      type="number"
                                      min={0}
                                      max={100}
                                      step={1}
                                      value={customDist[i] ?? 0}
                                      onChange={e => {
                                        const next = [...customDist];
                                        next[i] = Math.max(0, Number(e.target.value));
                                        setCustomDist(next);
                                      }}
                                      className="text-xs border border-slate-200 rounded px-2 py-1 w-16 outline-none focus:border-[#e60000]"
                                    />
                                  )}
                                </React.Fragment>
                              );
                            })}
                          </div>
                          {spreadDistType === 'custom' && !pctOk && (
                            <p className="mt-2 text-[10px] text-amber-600 font-medium">
                              Percentages sum to {pctTotal.toFixed(1)}% — they will be normalised to 100% on add.
                            </p>
                          )}
                        </div>
                      );
                    })()}
                  </div>
                )}
              </div>
            )}

            {/* Campaign + Comment + Action buttons */}
            {editingCampaign ? (
              <div className="mt-3 px-3 py-2 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-700 font-medium flex items-center gap-2">
                <span className="inline-block w-2 h-2 rounded-full bg-amber-400 shrink-0" />
                Editing campaign "{editingCampaign}" — saving will replace all of its events with the values above.
              </div>
            ) : editingEventId ? (
              <div className="mt-3 px-3 py-2 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-700 font-medium flex items-center gap-2">
                <span className="inline-block w-2 h-2 rounded-full bg-amber-400 shrink-0" />
                Editing event — modify the fields above then click Save Changes.
              </div>
            ) : null}
            <div className="mt-4 flex flex-col gap-3 md:flex-row md:items-end">
              <div className="md:w-56 shrink-0">
                <label className="block text-xs font-medium text-slate-500 mb-1">Campaign Name</label>
                <input
                  type="text"
                  placeholder="e.g. Summer Promo 2026"
                  value={newEvent.campaignName ?? ''}
                  onChange={e => setNewEvent({ ...newEvent, campaignName: e.target.value })}
                  className="w-full text-sm border border-slate-200 rounded-lg p-2 bg-white outline-none focus:border-[#e60000]"
                />
              </div>
              <div className="flex-1">
                <label className="block text-xs font-medium text-slate-500 mb-1">Comment</label>
                <input
                  type="text"
                  placeholder="Describe the event (e.g., New marketing campaign, Competitor exit...)"
                  value={newEvent.comment}
                  onChange={e => setNewEvent({ ...newEvent, comment: e.target.value })}
                  className="w-full text-sm border border-slate-200 rounded-lg p-2 bg-white outline-none focus:border-[#e60000]"
                />
              </div>
              {(editingEventId || editingCampaign) ? (
                <div className="flex gap-2 shrink-0">
                  <button
                    onClick={editingCampaign ? handleSaveCampaign : handleSaveEdit}
                    disabled={!newEvent.date}
                    className="bg-[#e60000] text-white text-sm font-semibold py-2 px-5 rounded-lg hover:bg-[#cc0000] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    {editingCampaign ? 'Save Campaign' : 'Save Changes'}
                  </button>
                  <button
                    onClick={handleCancelEdit}
                    className="bg-white border border-slate-200 text-slate-600 text-sm font-semibold py-2 px-4 rounded-lg hover:bg-slate-50 transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <button
                  onClick={handleAddMarketEvent}
                  disabled={!newEvent.date || newEvent.subscriberVolume === undefined}
                  className="shrink-0 bg-[#e60000] text-white text-sm font-semibold py-2 px-6 rounded-lg hover:bg-[#cc0000] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {spreadEnabled ? `Add ${spreadMonths} Events` : 'Add Event'}
                </button>
              )}
            </div>
          </div>

          {/* Events table */}
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="text-xs text-slate-500 bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="px-5 py-3 font-semibold">Campaign</th>
                  <th className="px-5 py-3 font-semibold">Month</th>
                  <th className="px-5 py-3 font-semibold">Segment</th>
                  <th className="px-5 py-3 font-semibold">Product</th>
                  <th className="px-5 py-3 font-semibold">Channel</th>
                  {wiTariffL1Col && <th className="px-5 py-3 font-semibold">Tariff</th>}
                  <th className="px-5 py-3 font-semibold text-right">Inflow Δ</th>
                  <th className="px-5 py-3 font-semibold text-right">Base Δ</th>
                  <th className="px-5 py-3 font-semibold text-right">Retention Δ</th>
                  <th className="px-5 py-3 font-semibold text-right">Outflow Δ</th>
                  <th className="px-5 py-3 font-semibold text-right">ARPU Δ</th>
                  <th className="px-5 py-3 font-semibold">Comment</th>
                  <th className="px-5 py-3 font-semibold text-center">Edit</th>
                  <th className="px-5 py-3 font-semibold text-center">Remove</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {marketEvents.length === 0 ? (
                  <tr>
                    <td colSpan={wiTariffL1Col ? 14 : 13} className="px-5 py-8 text-center text-slate-400 italic text-sm">
                      No market events yet. Use the form above to add events — they adjust the chart immediately.
                    </td>
                  </tr>
                ) : (
                  marketEvents
                    .slice()
                    .sort((a, b) => {
                      const ca = a.campaignName || '';
                      const cb = b.campaignName || '';
                      if (ca !== cb) return ca.localeCompare(cb);
                      return String(a.date).localeCompare(String(b.date));
                    })
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

                      const isEditing = editingEventId === event.id
                        || (editingCampaign !== null && event.campaignName === editingCampaign);
                      const campaignLabel = event.campaignName || '';
                      const group = campaignLabel ? campaignGroups.get(campaignLabel) : undefined;

                      return (
                        <React.Fragment key={event.id}>
                          <tr className={`hover:bg-slate-50 transition-colors ${
                            isEditing ? 'bg-amber-50/60 ring-1 ring-inset ring-amber-300' :
                            hasWarning ? 'bg-amber-50/40' : ''
                          }`}>
                            {/* Campaign column — badge doubles as the group-edit control */}
                            <td className="px-5 py-3 text-xs max-w-[160px]">
                              {campaignLabel ? (
                                group?.editable ? (
                                  <button
                                    type="button"
                                    onClick={(e) => { e.stopPropagation(); handleEditCampaignStart(campaignLabel); }}
                                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#e60000]/10 text-[#e60000] font-medium text-[10px] truncate max-w-full hover:bg-[#e60000]/15 transition-colors cursor-pointer"
                                    title={`Edit campaign "${campaignLabel}" (${group.rows.length} event${group.rows.length === 1 ? '' : 's'})`}
                                  >
                                    <Pencil size={11} className="shrink-0" />
                                    {campaignLabel}
                                  </button>
                                ) : (
                                  <span
                                    className="inline-flex items-center px-2 py-0.5 rounded-full bg-[#e60000]/10 text-[#e60000] font-medium text-[10px] truncate max-w-full opacity-60 cursor-not-allowed"
                                    title={group?.reason || campaignLabel}
                                  >
                                    {campaignLabel}
                                  </span>
                                )
                              ) : (
                                <span className="text-slate-300">—</span>
                              )}
                            </td>
                            <td className="px-5 py-3 font-medium text-slate-700 whitespace-nowrap">{fmtMonth(event.date)}</td>
                            <td className="px-5 py-3 text-slate-600 text-xs">{event.segment}</td>
                            <td className="px-5 py-3 text-slate-600 text-xs">
                              {event.product}{event.productL2 && event.productL2 !== 'All' ? ` — ${event.productL2}` : ''}
                            </td>
                            <td className="px-5 py-3 text-slate-600 text-xs">
                              {event.channel || 'All'}{event.channelL2 && event.channelL2 !== 'All' ? ` — ${event.channelL2}` : ''}
                            </td>
                            {wiTariffL1Col && (
                              <td className="px-5 py-3 text-slate-600 text-xs">
                                {event.tariffL1 && event.tariffL1 !== 'All'
                                  ? `${event.tariffL1}${event.tariffL2 && event.tariffL2 !== 'All' ? ` — ${event.tariffL2}` : ''}`
                                  : <span className="text-slate-300">All</span>}
                              </td>
                            )}

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
                              isOutflow    ? 'text-rose-600' :
                              isRetention  ? 'text-emerald-600' :
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
                                type="button"
                                onClick={(e) => { e.stopPropagation(); handleEditStart(event); }}
                                className={`p-1 rounded transition-colors ${
                                  isEditing
                                    ? 'text-amber-600 bg-amber-100'
                                    : 'text-slate-400 hover:text-[#e60000] hover:bg-[#e60000]/5'
                                }`}
                                title={isEditing ? 'Currently editing' : 'Edit event'}
                              >
                                <Pencil size={14} />
                              </button>
                            </td>
                            <td className="px-5 py-3 text-center">
                              <button
                                type="button"
                                onClick={(e) => { e.stopPropagation(); removeMarketEvent(event.id); }}
                                className="text-rose-400 hover:text-rose-600 p-1 rounded hover:bg-rose-50 transition-colors"
                              >
                                <Trash2 size={14} />
                              </button>
                            </td>
                          </tr>
                          {hasWarning && (
                            <tr className="bg-amber-50">
                              <td colSpan={wiTariffL1Col ? 14 : 13} className="px-5 py-2 text-xs text-amber-700 flex items-center gap-2">
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

        {/* Stock-and-flow math validation — inside Volume tab */}
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

        </>)}

        {/* ── VALUE TAB ───────────────────────────────────────────────────────── */}
        {/* ── PRICING TAB — Pricing Events form + table ────────────────────── */}
        {activeTab === 'pricing' && (
          <div className="space-y-6">
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
              <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-semibold text-slate-700">Pricing Events — ARPU Override</h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Apply a price rise, discount, or promotion to a cohort slice. Yield Events are applied first; Pricing Events layer on top.
                  </p>
                </div>
                <span className="text-xs text-slate-400 bg-white px-2 py-1 rounded border border-slate-200 hidden md:block">
                  Pass 3 · Applied after Yield blending
                </span>
              </div>

              <div className="p-6 border-b border-slate-100">
                {/* Dimension selectors */}
                <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-4 mb-5">
                  {/* Segment */}
                  <div>
                    <label className="block text-xs font-medium text-slate-500 mb-1">Segment</label>
                    <select
                      value={newPricingEvent.segment ?? 'All'}
                      onChange={e => setNewPricingEvent({ ...newPricingEvent, segment: e.target.value })}
                      className="w-full text-sm border border-slate-200 rounded-lg p-2 bg-white outline-none focus:border-[#e60000]"
                    >
                      <option value="All">All Segments</option>
                      {ySegmentOptions.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </div>

                  {/* Product L1 */}
                  <div>
                    <label className="block text-xs font-medium text-slate-500 mb-1">Product</label>
                    <select
                      value={newPricingEvent.product ?? 'All'}
                      onChange={e => setNewPricingEvent({ ...newPricingEvent, product: e.target.value, productL2: 'All' })}
                      className="w-full text-sm border border-slate-200 rounded-lg p-2 bg-white outline-none focus:border-[#e60000]"
                    >
                      <option value="All">All Products</option>
                      {yProductOptions.map(p => <option key={p} value={p}>{p}</option>)}
                    </select>
                  </div>

                  {/* Product L2 */}
                  <div>
                    <label className="block text-xs font-medium text-slate-500 mb-1">Tariff Tier (L2)</label>
                    <select
                      value={newPricingEvent.productL2 ?? 'All'}
                      onChange={e => setNewPricingEvent({ ...newPricingEvent, productL2: e.target.value })}
                      className="w-full text-sm border border-slate-200 rounded-lg p-2 bg-white outline-none focus:border-[#e60000]"
                      disabled={pricingProductL2Options.length === 0}
                    >
                      <option value="All">All Tiers</option>
                      {pricingProductL2Options.map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                  </div>

                  {/* Channel — hierarchical dropdown */}
                  {channelTree.size > 0 ? (
                    <div>
                      <label className="block text-xs font-medium text-slate-500 mb-1">Channel</label>
                      <HierarchicalDropdown
                        label=""
                        tree={channelTree}
                        value={{
                          l1: newPricingEvent.channelL1 && newPricingEvent.channelL1 !== 'All' ? newPricingEvent.channelL1 : null,
                          l2: newPricingEvent.channelL2 && newPricingEvent.channelL2 !== 'All' ? newPricingEvent.channelL2 : null,
                        }}
                        onChange={(v: HierarchicalSelection) => setNewPricingEvent({
                          ...newPricingEvent,
                          channelL1: v.l1 ?? 'All',
                          channelL2: v.l2 ?? 'All',
                        })}
                        variant="light"
                        className="w-full"
                      />
                    </div>
                  ) : (
                    <div>
                      <label className="block text-xs font-medium text-slate-500 mb-1">Channel</label>
                      <select
                        value={newPricingEvent.channelL1 ?? 'All'}
                        onChange={e => setNewPricingEvent({ ...newPricingEvent, channelL1: e.target.value, channelL2: 'All' })}
                        className="w-full text-sm border border-slate-200 rounded-lg p-2 bg-white outline-none focus:border-[#e60000]"
                      >
                        <option value="All">All Channels</option>
                        {yChannelL1Options.map(c => <option key={c} value={c}>{c}</option>)}
                      </select>
                    </div>
                  )}

                  {/* Month */}
                  <div>
                    <label className="block text-xs font-medium text-slate-500 mb-1">Start Month</label>
                    <input
                      type="month"
                      value={newPricingEvent.month ?? ''}
                      onChange={e => setNewPricingEvent({ ...newPricingEvent, month: e.target.value })}
                      className="w-full text-sm border border-slate-200 rounded-lg p-2 bg-white outline-none focus:border-[#e60000]"
                    />
                  </div>
                </div>

                {/* Amount + toggles */}
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 mb-5">
                  {/* Input mode + amount */}
                  <div>
                    <label className="block text-xs font-medium text-slate-500 mb-1">Amount</label>
                    <div className="flex rounded-lg overflow-hidden border border-slate-200">
                      <button
                        onClick={() => setNewPricingEvent({ ...newPricingEvent, inputMode: 'percentage' })}
                        className={`px-3 py-2 text-xs font-semibold border-r border-slate-200 transition-colors ${
                          newPricingEvent.inputMode === 'percentage'
                            ? 'bg-[#e60000] text-white'
                            : 'bg-white text-slate-500 hover:bg-slate-50'
                        }`}
                      >%</button>
                      <button
                        onClick={() => setNewPricingEvent({ ...newPricingEvent, inputMode: 'absolute' })}
                        className={`px-3 py-2 text-xs font-semibold border-r border-slate-200 transition-colors ${
                          newPricingEvent.inputMode === 'absolute'
                            ? 'bg-[#e60000] text-white'
                            : 'bg-white text-slate-500 hover:bg-slate-50'
                        }`}
                      >€</button>
                      <input
                        type="number"
                        step={newPricingEvent.inputMode === 'percentage' ? 0.1 : 0.01}
                        value={newPricingEvent.amount ?? 0}
                        onChange={e => setNewPricingEvent({ ...newPricingEvent, amount: Number(e.target.value) })}
                        className="flex-1 text-sm px-3 py-2 bg-white outline-none min-w-0"
                        placeholder={newPricingEvent.inputMode === 'percentage' ? '+5 or -10' : '+2.50 or -1.00'}
                      />
                    </div>
                    <p className="text-[10px] text-slate-400 mt-1">
                      {newPricingEvent.inputMode === 'percentage' ? 'Positive = price rise, negative = discount' : 'Absolute ARPU change per subscriber'}
                    </p>
                  </div>

                  {/* Target */}
                  <div>
                    <label className="block text-xs font-medium text-slate-500 mb-1">Target</label>
                    <div className="flex rounded-lg overflow-hidden border border-slate-200">
                      <button
                        onClick={() => setNewPricingEvent({ ...newPricingEvent, target: 'cohorts' })}
                        className={`flex-1 px-3 py-2 text-xs font-semibold border-r border-slate-200 transition-colors ${
                          newPricingEvent.target === 'cohorts'
                            ? 'bg-[#e60000] text-white'
                            : 'bg-white text-slate-500 hover:bg-slate-50'
                        }`}
                      >Cohorts Only</button>
                      <button
                        onClick={() => setNewPricingEvent({ ...newPricingEvent, target: 'cohorts+base' })}
                        className={`flex-1 px-3 py-2 text-xs font-semibold border-r border-slate-200 transition-colors ${
                          newPricingEvent.target === 'cohorts+base'
                            ? 'bg-[#e60000] text-white'
                            : 'bg-white text-slate-500 hover:bg-slate-50'
                        }`}
                      >Cohorts + Base</button>
                      <button
                        onClick={() => setNewPricingEvent({ ...newPricingEvent, target: 'base-only' })}
                        className={`flex-1 px-3 py-2 text-xs font-semibold transition-colors ${
                          newPricingEvent.target === 'base-only'
                            ? 'bg-[#e60000] text-white'
                            : 'bg-white text-slate-500 hover:bg-slate-50'
                        }`}
                      >Base Only</button>
                    </div>
                    <p className="text-[10px] text-slate-400 mt-1">
                      {newPricingEvent.target === 'cohorts' ? 'New Inflow/Retention cohorts only'
                       : newPricingEvent.target === 'base-only' ? 'Existing base stock only — excludes new cohorts'
                       : 'All subscribers including existing base'}
                    </p>
                    {(newPricingEvent.target === 'cohorts' || newPricingEvent.target === 'cohorts+base') && (
                      <div className="mt-2 pt-2 border-t border-slate-100">
                        <p className="text-[10px] font-medium text-slate-500 mb-1.5">Cohort Type</p>
                        <div className="flex gap-3">
                          {(['inflow', 'retention', 'both'] as const).map(scope => (
                            <label key={scope} className="flex items-center gap-1.5 cursor-pointer">
                              <input
                                type="radio"
                                name="cohortScope"
                                value={scope}
                                checked={(newPricingEvent.cohortScope ?? 'both') === scope}
                                onChange={() => setNewPricingEvent({ ...newPricingEvent, cohortScope: scope })}
                                className="accent-[#e60000] w-3 h-3"
                              />
                              <span className="text-[10px] text-slate-600 capitalize">{scope === 'both' ? 'Both' : scope === 'inflow' ? 'Inflow' : 'Retention'}</span>
                            </label>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Duration */}
                  <div>
                    <label className="block text-xs font-medium text-slate-500 mb-1">Duration</label>
                    <div className="flex rounded-lg overflow-hidden border border-slate-200">
                      <button
                        onClick={() => setNewPricingEvent({ ...newPricingEvent, duration: 'one-off' })}
                        className={`flex-1 px-3 py-2 text-xs font-semibold border-r border-slate-200 transition-colors ${
                          newPricingEvent.duration === 'one-off'
                            ? 'bg-[#e60000] text-white'
                            : 'bg-white text-slate-500 hover:bg-slate-50'
                        }`}
                      >One-Off</button>
                      <button
                        onClick={() => setNewPricingEvent({ ...newPricingEvent, duration: 'recurring' })}
                        className={`flex-1 px-3 py-2 text-xs font-semibold transition-colors ${
                          newPricingEvent.duration === 'recurring'
                            ? 'bg-[#e60000] text-white'
                            : 'bg-white text-slate-500 hover:bg-slate-50'
                        }`}
                      >Recurring</button>
                    </div>
                    <p className="text-[10px] text-slate-400 mt-1">
                      {newPricingEvent.duration === 'one-off' ? 'Applies to start month only, then reverts' : 'Applies from start month through all subsequent months'}
                    </p>
                  </div>

                  {/* Preview */}
                  <div>
                    <label className="block text-xs font-medium text-slate-500 mb-1">Preview Impact</label>
                    <div className="bg-slate-50 rounded-lg p-3 border border-slate-200">
                      {(() => {
                        const matchRow = chartData.find(r => r.month === newPricingEvent.month);
                        const baseArpu = matchRow ? (matchRow['ARPU (Adjusted)'] as number) : null;
                        if (baseArpu === null) return <p className="text-xs text-slate-400">Select a month to preview</p>;
                        const amt = newPricingEvent.amount ?? 0;
                        const mode = newPricingEvent.inputMode ?? 'percentage';
                        const adjusted = mode === 'percentage' ? baseArpu * (1 + amt / 100) : baseArpu + amt;
                        const delta = adjusted - baseArpu;
                        return (
                          <>
                            <p className="text-[10px] text-slate-400">Baseline ARPU: <span className="font-medium text-slate-600">{formatNumber(baseArpu)}</span></p>
                            <p className="text-[10px] text-slate-400 mt-0.5">Adjusted ARPU: <span className={`font-semibold ${delta >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>{formatNumber(Math.max(0, adjusted))}</span></p>
                            <p className={`text-[10px] font-medium mt-0.5 ${delta >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                              {delta >= 0 ? '+' : ''}{formatNumber(delta)} ({delta >= 0 ? '+' : ''}{baseArpu !== 0 ? ((delta / baseArpu) * 100).toFixed(1) : '0.0'}%)
                            </p>
                          </>
                        );
                      })()}
                    </div>
                  </div>
                </div>

                {/* Name + Comment + Add button */}
                <div className="flex flex-wrap gap-3 items-end">
                  <div className="w-48 shrink-0">
                    <label className="block text-xs font-medium text-slate-500 mb-1">Event Name</label>
                    <input
                      type="text"
                      placeholder="e.g. CPI Rise Jan 2026"
                      value={newPricingEvent.name ?? ''}
                      onChange={e => setNewPricingEvent({ ...newPricingEvent, name: e.target.value })}
                      className="w-full text-sm border border-slate-200 rounded-lg p-2 bg-white outline-none focus:border-[#e60000]"
                    />
                  </div>
                  <div className="flex-1 min-w-[200px]">
                    <label className="block text-xs font-medium text-slate-500 mb-1">Comment</label>
                    <input
                      type="text"
                      placeholder="Describe this pricing change (e.g., CPI +3.9% Jan 2025, competitor promo response)..."
                      value={newPricingEvent.comment ?? ''}
                      onChange={e => setNewPricingEvent({ ...newPricingEvent, comment: e.target.value })}
                      className="w-full text-sm border border-slate-200 rounded-lg p-2 bg-white outline-none focus:border-[#e60000]"
                    />
                  </div>
                  <button
                    onClick={handleAddPricingEvent}
                    disabled={!newPricingEvent.month || newPricingEvent.amount === undefined}
                    className="px-6 py-2 bg-[#e60000] text-white text-sm font-semibold rounded-lg hover:bg-[#cc0000] transition-colors disabled:opacity-40 disabled:cursor-not-allowed whitespace-nowrap"
                  >
                    Add Pricing Event
                  </button>
                </div>
              </div>

              {/* Pricing Events results table */}
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left">
                  <thead className="text-[10px] text-slate-500 bg-slate-50 border-b border-slate-200 uppercase tracking-wider">
                    <tr>
                      <th className="px-4 py-3 font-semibold">Month</th>
                      <th className="px-4 py-3 font-semibold">Segment</th>
                      <th className="px-4 py-3 font-semibold">Product</th>
                      <th className="px-4 py-3 font-semibold">Tariff Tier</th>
                      <th className="px-4 py-3 font-semibold">Channel</th>
                      <th className="px-4 py-3 font-semibold text-right">Mode</th>
                      <th className="px-4 py-3 font-semibold text-right">Amount</th>
                      <th className="px-4 py-3 font-semibold">Target</th>
                      <th className="px-4 py-3 font-semibold">Duration</th>
                      <th className="px-4 py-3 font-semibold text-right">Baseline ARPU</th>
                      <th className="px-4 py-3 font-semibold text-right">Adjusted ARPU</th>
                      <th className="px-4 py-3 font-semibold">Comment</th>
                      <th className="px-4 py-3 font-semibold text-center">Remove</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {pricingEvents.length === 0 ? (
                      <tr>
                        <td colSpan={13} className="px-5 py-8 text-center text-slate-400 italic">
                          No pricing events yet. Use the form above to apply ARPU deltas — changes layer on top of Yield Events in real time.
                        </td>
                      </tr>
                    ) : (
                      pricingEvents
                        .slice()
                        .sort((a, b) => a.month.localeCompare(b.month))
                        .map(pe => {
                          const amt = pe.amount;
                          const baseArpu = pe.originalBaseArpu;
                          const adjustedArpu = pe.inputMode === 'percentage'
                            ? Math.max(0, baseArpu * (1 + amt / 100))
                            : Math.max(0, baseArpu + amt);
                          const delta = adjustedArpu - baseArpu;
                          return (
                            <tr key={pe.id} className="hover:bg-slate-50 transition-colors">
                              <td className="px-4 py-2.5 font-medium text-slate-700">{fmtMonth(pe.month)}</td>
                              <td className="px-4 py-2.5 text-slate-600">{pe.segment}</td>
                              <td className="px-4 py-2.5 text-slate-600">{pe.product}</td>
                              <td className="px-4 py-2.5 text-slate-600">{pe.productL2}</td>
                              <td className="px-4 py-2.5 text-slate-600">
                                {pe.channelL1}{pe.channelL2 && pe.channelL2 !== 'All' ? ` / ${pe.channelL2}` : ''}
                              </td>
                              <td className="px-4 py-2.5 text-right">
                                <span className="inline-block px-1.5 py-0.5 bg-slate-100 text-slate-600 rounded text-[10px] font-semibold">
                                  {pe.inputMode === 'percentage' ? '%' : '€'}
                                </span>
                              </td>
                              <td className={`px-4 py-2.5 text-right font-semibold tabular-nums ${amt >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                                {amt >= 0 ? '+' : ''}{pe.inputMode === 'percentage' ? `${amt.toFixed(1)}%` : formatNumber(amt)}
                              </td>
                              <td className="px-4 py-2.5">
                                <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-semibold ${
                                  pe.target === 'cohorts+base' ? 'bg-violet-100 text-violet-700'
                                  : pe.target === 'base-only' ? 'bg-amber-100 text-amber-700'
                                  : 'bg-blue-100 text-blue-700'
                                }`}>
                                  {pe.target === 'cohorts+base' ? 'Cohorts + Base' : pe.target === 'base-only' ? 'Base Only' : 'Cohorts'}
                                </span>
                                {pe.target !== 'base-only' && pe.cohortScope !== 'both' && (
                                  <span className="ml-1 inline-block px-1.5 py-0.5 rounded text-[10px] font-semibold bg-slate-100 text-slate-500 capitalize">
                                    {pe.cohortScope}
                                  </span>
                                )}
                              </td>
                              <td className="px-4 py-2.5">
                                <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-semibold ${pe.duration === 'recurring' ? 'bg-violet-100 text-violet-700' : 'bg-slate-100 text-slate-600'}`}>
                                  {pe.duration === 'recurring' ? 'Recurring' : 'One-Off'}
                                </span>
                              </td>
                              <td className="px-4 py-2.5 text-right tabular-nums text-slate-500">{formatNumber(baseArpu)}</td>
                              <td className={`px-4 py-2.5 text-right tabular-nums font-semibold ${delta >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                                {formatNumber(adjustedArpu)}
                                <span className="block text-[10px] font-normal">
                                  {delta >= 0 ? '+' : ''}{formatNumber(delta)}
                                </span>
                              </td>
                              <td className="px-4 py-2.5 text-slate-500 max-w-[120px] truncate" title={pe.comment}>{pe.comment || '—'}</td>
                              <td className="px-4 py-2.5 text-center">
                                <button
                                  type="button"
                                  onClick={(e) => { e.stopPropagation(); removePricingEvent(pe.id); }}
                                  className="text-slate-300 hover:text-rose-500 transition-colors"
                                  title="Remove"
                                >
                                  <Trash2 size={14} />
                                </button>
                              </td>
                            </tr>
                          );
                        })
                    )}
                  </tbody>
                </table>
              </div>

              {pricingEvents.length > 0 && (
                <div className="px-5 py-3 bg-slate-50 border-t border-slate-100 flex justify-start">
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); clearAllPricingEvents(); }}
                    className="text-xs font-medium text-slate-500 hover:text-rose-600 transition-colors flex items-center gap-1.5"
                  >
                    <Trash2 size={12} /> Clear All Pricing Events
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'value' && (
          <div className="space-y-6">

            {/* Yield Events form */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
              <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-semibold text-slate-700">Yield Event — Tariff Mix Override</h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Rebalance the Product L2 (tariff) mix for a cohort's Inflow or Retention to drive a new Blended ARPU
                  </p>
                </div>
                <span className="text-xs text-slate-400 bg-white px-2 py-1 rounded border border-slate-200 hidden md:block">
                  Sliders auto-balance to 100%
                </span>
              </div>

              <div className="p-6 border-b border-slate-100">
                {/* Dimension selectors */}
                <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-4 mb-5">
                  {/* IBRO */}
                  <div>
                    <label className="block text-xs font-medium text-slate-500 mb-1">IBRO Type</label>
                    <select
                      value={newYieldEvent.ibro ?? 'Inflow'}
                      onChange={e => setNewYieldEvent({ ...newYieldEvent, ibro: e.target.value as 'Inflow' | 'Retention' })}
                      className="w-full text-sm border border-slate-200 rounded-lg p-2 bg-white outline-none focus:border-[#e60000]"
                    >
                      <option value="Inflow">Inflow</option>
                      <option value="Retention">Retention</option>
                    </select>
                  </div>

                  {/* Segment */}
                  <div>
                    <label className="block text-xs font-medium text-slate-500 mb-1">Segment</label>
                    <select
                      value={newYieldEvent.segment ?? 'All'}
                      onChange={e => setNewYieldEvent({ ...newYieldEvent, segment: e.target.value })}
                      className="w-full text-sm border border-slate-200 rounded-lg p-2 bg-white outline-none focus:border-[#e60000]"
                    >
                      <option value="All">All Segments</option>
                      {ySegmentOptions.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </div>

                  {/* Product L1 */}
                  <div>
                    <label className="block text-xs font-medium text-slate-500 mb-1">Product</label>
                    <select
                      value={newYieldEvent.product ?? 'All'}
                      onChange={e => setNewYieldEvent({ ...newYieldEvent, product: e.target.value })}
                      className="w-full text-sm border border-slate-200 rounded-lg p-2 bg-white outline-none focus:border-[#e60000]"
                    >
                      <option value="All">All Products</option>
                      {yProductOptions.map(p => <option key={p} value={p}>{p}</option>)}
                    </select>
                  </div>

                  {/* Channel — hierarchical dropdown (L1 + L2) */}
                  {channelTree.size > 0 ? (
                    <div>
                      <label className="block text-xs font-medium text-slate-500 mb-1">Channel</label>
                      <HierarchicalDropdown
                        label=""
                        tree={channelTree}
                        value={{
                          l1: newYieldEvent.channelL1 && newYieldEvent.channelL1 !== 'All' ? newYieldEvent.channelL1 : null,
                          l2: newYieldEvent.channelL2 && newYieldEvent.channelL2 !== 'All' ? newYieldEvent.channelL2 : null,
                        }}
                        onChange={(v: HierarchicalSelection) => setNewYieldEvent({
                          ...newYieldEvent,
                          channelL1: v.l1 ?? 'All',
                          channelL2: v.l2 ?? 'All',
                        })}
                        variant="light"
                        className="w-full"
                      />
                    </div>
                  ) : (
                    <div>
                      <label className="block text-xs font-medium text-slate-500 mb-1">Channel</label>
                      <select
                        value={newYieldEvent.channelL1 ?? 'All'}
                        onChange={e => setNewYieldEvent({ ...newYieldEvent, channelL1: e.target.value, channelL2: 'All' })}
                        className="w-full text-sm border border-slate-200 rounded-lg p-2 bg-white outline-none focus:border-[#e60000]"
                      >
                        <option value="All">All Channels</option>
                        {yChannelL1Options.map(c => <option key={c} value={c}>{c}</option>)}
                      </select>
                    </div>
                  )}

                  {/* Month */}
                  <div>
                    <label className="block text-xs font-medium text-slate-500 mb-1">Activity Month</label>
                    <input
                      type="month"
                      value={newYieldEvent.month ?? ''}
                      onChange={e => setNewYieldEvent({ ...newYieldEvent, month: e.target.value })}
                      className="w-full text-sm border border-slate-200 rounded-lg p-2 bg-white outline-none focus:border-[#e60000]"
                    />
                  </div>
                </div>

                {/* Sliders */}
                {yieldTierData.length === 0 ? (
                  <div className="py-6 text-center text-sm text-slate-400 border border-dashed border-slate-200 rounded-xl">
                    {wiProductL2Col
                      ? 'Select dimensions above to load tariff tier data'
                      : 'Map a Product L2 column in Data Mapping to enable tariff sliders'}
                  </div>
                ) : (
                  <div className="mb-5">
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                        Tariff Mix (Product L2)
                        <span className="ml-2 normal-case font-normal text-slate-400">— {yieldTierData.length} tier{yieldTierData.length !== 1 ? 's' : ''}</span>
                      </span>
                      <div className="flex items-center gap-3">
                        <div className="flex bg-slate-100 p-0.5 rounded-lg">
                          <div className="relative group">
                            <button
                              onClick={() => setYieldArpuMode('historical')}
                              className={`px-2.5 py-1 text-[10px] font-semibold rounded-md transition-all ${yieldArpuMode === 'historical' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                            >Historical ARPU</button>
                            <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 hidden group-hover:block w-48 bg-white border border-slate-200 rounded-xl shadow-lg text-xs text-slate-600 p-2.5 z-50 pointer-events-none font-normal">
                              Use raw historical average ARPU per tier.
                            </span>
                          </div>
                          <div className="relative group">
                            <button
                              onClick={() => setYieldArpuMode('forecast')}
                              className={`px-2.5 py-1 text-[10px] font-semibold rounded-md transition-all ${yieldArpuMode === 'forecast' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                            >Forecast ARPU</button>
                            <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 hidden group-hover:block w-56 bg-white border border-slate-200 rounded-xl shadow-lg text-xs text-slate-600 p-2.5 z-50 pointer-events-none font-normal">
                              Scale tier ARPUs to match the forecast's per-scenario ARPU for the selected month.
                            </span>
                          </div>
                        </div>
                        <span className={`text-xs font-semibold tabular-nums ${Math.abs((Object.values(draftMix) as number[]).reduce((s, v) => s + v, 0) - 100) < 0.2 ? 'text-emerald-600' : 'text-amber-500'}`}>
                          Sum: {(Object.values(draftMix) as number[]).reduce((s, v) => s + v, 0).toFixed(1)}%
                        </span>
                      </div>
                    </div>

                    {/* Compact header row */}
                    <div className="grid gap-x-3 mb-1 pr-1 text-[10px] font-semibold text-slate-400 uppercase tracking-wider" style={{ gridTemplateColumns: 'minmax(80px,180px) 1fr 52px 90px 80px' }}>
                      <span>Tier</span>
                      <span />
                      <span className="text-right">Mix %</span>
                      <span className="text-right">Base ARPU</span>
                      <span className="text-right">Yield</span>
                    </div>

                    {/* Scrollable tier list — compact rows, max visible ~8 before scroll */}
                    <div className={`space-y-1.5 pr-1 ${yieldTierData.length > 8 ? 'overflow-y-auto max-h-[340px]' : ''}`}>
                      {yieldTierData.map(({ tier, baseArpu }) => {
                        const mixPct = draftMix[tier] ?? 0;
                        return (
                          <div key={tier} className="grid gap-x-3 items-center" style={{ gridTemplateColumns: 'minmax(80px,180px) 1fr 52px 90px 80px' }}>
                            <span className="text-xs font-medium text-slate-700 truncate leading-none" title={tier}>{tier}</span>
                            <input
                              type="range"
                              min={0}
                              max={100}
                              step={0.1}
                              value={mixPct}
                              onChange={e => handleSliderChange(tier, Number(e.target.value))}
                              className="w-full accent-[#e60000] h-1.5 cursor-pointer"
                            />
                            <input
                              type="number"
                              min={0}
                              max={100}
                              step={0.1}
                              value={parseFloat(mixPct.toFixed(1))}
                              onChange={e => handleSliderChange(tier, Number(e.target.value))}
                              className="w-full text-xs font-semibold text-slate-700 text-right tabular-nums border border-slate-200 rounded px-1 py-0.5 outline-none focus:border-[#e60000] bg-white"
                            />
                            <span className="text-xs text-slate-400 text-right tabular-nums leading-none">
                              {formatNumber(baseArpu)}
                            </span>
                            <span className="text-xs text-emerald-700 text-right tabular-nums font-semibold leading-none">
                              {formatNumber(mixPct / 100 * baseArpu)}
                            </span>
                          </div>
                        );
                      })}
                    </div>

                    {/* ARPU summary */}
                    <div className="mt-4 pt-4 border-t border-slate-100 grid grid-cols-2 gap-4">
                      <div className="bg-slate-50 rounded-xl p-3">
                        <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1">Baseline Blended ARPU</p>
                        <p className="text-lg font-bold text-slate-700">{formatNumber(baselineBlendedArpu)}</p>
                        <p className="text-[10px] text-slate-400 mt-0.5">Equal-weight avg of tier ARPUs</p>
                      </div>
                      <div className={`rounded-xl p-3 ${draftBlendedArpu >= baselineBlendedArpu ? 'bg-emerald-50' : 'bg-rose-50'}`}>
                        <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1">New Blended ARPU</p>
                        <p className={`text-lg font-bold ${draftBlendedArpu >= baselineBlendedArpu ? 'text-emerald-700' : 'text-rose-700'}`}>
                          {formatNumber(draftBlendedArpu)}
                        </p>
                        <p className={`text-[10px] mt-0.5 ${draftBlendedArpu >= baselineBlendedArpu ? 'text-emerald-600' : 'text-rose-600'}`}>
                          {draftBlendedArpu >= baselineBlendedArpu ? '+' : ''}{formatNumber(draftBlendedArpu - baselineBlendedArpu)} vs baseline
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Roll-forward toggle */}
                <div className="flex items-center gap-3 mt-4 pt-4 border-t border-slate-100">
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={newYieldEvent.rollForward ?? false}
                      onChange={e => setNewYieldEvent({ ...newYieldEvent, rollForward: e.target.checked })}
                      className="sr-only peer"
                    />
                    <div className="w-9 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-[#e60000]" />
                  </label>
                  <div>
                    <p className="text-xs font-medium text-slate-700">
                      {newYieldEvent.rollForward ? 'Roll forward to all subsequent months' : 'Apply to this cohort month only'}
                    </p>
                    <p className="text-[10px] text-slate-400 mt-0.5">
                      {newYieldEvent.rollForward
                        ? 'Every future Inflow/Retention cohort for this segment will adopt this mix, continuously driving the Blended Base ARPU'
                        : 'The updated Blended Base ARPU carries forward naturally through base math, but next month\'s cohorts revert to their baseline mix'}
                    </p>
                  </div>
                </div>

                {/* Name + Comment + Add button */}
                <div className="mt-4 flex flex-wrap gap-3 items-end">
                  <div className="w-48 shrink-0">
                    <label className="block text-xs font-medium text-slate-500 mb-1">Event Name</label>
                    <input
                      type="text"
                      placeholder="e.g. Q3 Promo Mix"
                      value={newYieldEvent.name ?? ''}
                      onChange={e => setNewYieldEvent({ ...newYieldEvent, name: e.target.value })}
                      className="w-full text-sm border border-slate-200 rounded-lg p-2 bg-white outline-none focus:border-[#e60000]"
                    />
                  </div>
                  <div className="flex-1 min-w-[200px]">
                    <label className="block text-xs font-medium text-slate-500 mb-1">Comment</label>
                    <input
                      type="text"
                      placeholder="Describe this mix change (e.g., Promo pushing High Value tier)..."
                      value={newYieldEvent.comment ?? ''}
                      onChange={e => setNewYieldEvent({ ...newYieldEvent, comment: e.target.value })}
                      className="w-full text-sm border border-slate-200 rounded-lg p-2 bg-white outline-none focus:border-[#e60000]"
                    />
                  </div>
                  <button
                    onClick={handleAddYieldEvent}
                    disabled={yieldTierData.length === 0 || !newYieldEvent.month}
                    className="px-6 py-2 bg-[#e60000] text-white text-sm font-semibold rounded-lg hover:bg-[#cc0000] transition-colors disabled:opacity-40 disabled:cursor-not-allowed whitespace-nowrap"
                  >
                    Add Yield Event
                  </button>
                </div>
              </div>

              {/* Yield Events results table */}
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left">
                  <thead className="text-[10px] text-slate-500 bg-slate-50 border-b border-slate-200 uppercase tracking-wider">
                    <tr>
                      <th className="px-4 py-3 font-semibold">Month</th>
                      <th className="px-4 py-3 font-semibold">IBRO</th>
                      <th className="px-4 py-3 font-semibold">Segment</th>
                      <th className="px-4 py-3 font-semibold">Product</th>
                      <th className="px-4 py-3 font-semibold">Channel</th>
                      {allYieldTiers.map(tier => (
                        <React.Fragment key={tier}>
                          <th className="px-4 py-3 font-semibold text-right">
                            {tier} Mix%
                          </th>
                          <th className="px-4 py-3 font-semibold text-right">
                            {tier} ARPU
                          </th>
                        </React.Fragment>
                      ))}
                      <th className="px-4 py-3 font-semibold text-right">Blended ARPU</th>
                      <th className="px-4 py-3 font-semibold text-center">Roll Fwd</th>
                      <th className="px-4 py-3 font-semibold">Comment</th>
                      <th className="px-4 py-3 font-semibold text-center">Remove</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {yieldEvents.length === 0 ? (
                      <tr>
                        <td colSpan={7 + allYieldTiers.length * 2} className="px-5 py-8 text-center text-slate-400 italic">
                          No yield events yet. Use the form above to override tariff mix — changes apply to the ARPU waterfall immediately.
                        </td>
                      </tr>
                    ) : (
                      yieldEvents
                        .slice()
                        .sort((a, b) => a.month.localeCompare(b.month))
                        .map(evt => {
                          const evtBlendedArpu = Object.keys(evt.tariffMix).reduce((sum, tier) => {
                            return sum + (evt.tariffMix[tier] / 100) * (evt.tariffBaseArpu[tier] ?? 0);
                          }, 0);
                          // Baseline = average of base ARPUs (equal-weight proxy)
                          const tiers = Object.keys(evt.tariffBaseArpu);
                          const evtBaselineArpu = tiers.length > 0
                            ? tiers.reduce((s, t) => s + (evt.tariffBaseArpu[t] ?? 0), 0) / tiers.length
                            : 0;
                          const arpuDelta = evtBlendedArpu - evtBaselineArpu;

                          return (
                            <React.Fragment key={evt.id}>
                              {/* Baseline row */}
                              <tr className="hover:bg-slate-50 transition-colors">
                                <td className="px-4 py-2.5 font-medium text-slate-700" rowSpan={2}>{fmtMonth(evt.month)}</td>
                                <td className="px-4 py-2.5 text-slate-500" rowSpan={2}>
                                  <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-semibold ${evt.ibro === 'Inflow' ? 'bg-blue-100 text-blue-700' : 'bg-pink-100 text-pink-700'}`}>
                                    {evt.ibro}
                                  </span>
                                </td>
                                <td className="px-4 py-2.5 text-slate-600 text-xs" rowSpan={2}>{evt.segment}</td>
                                <td className="px-4 py-2.5 text-slate-600 text-xs" rowSpan={2}>{evt.product}</td>
                                <td className="px-4 py-2.5 text-slate-600 text-xs" rowSpan={2}>
                                  {evt.channelL1}{evt.channelL2 && evt.channelL2 !== 'All' ? ` / ${evt.channelL2}` : ''}
                                </td>
                                {/* Baseline: equal-weight mix per tier */}
                                {allYieldTiers.map(tier => {
                                  const baseArpu = evt.tariffBaseArpu[tier] ?? null;
                                  const eqPct = tiers.includes(tier) ? 100 / tiers.length : null;
                                  return (
                                    <React.Fragment key={tier}>
                                      <td className="px-4 py-2.5 text-right text-slate-400 tabular-nums text-xs">
                                        {eqPct !== null ? `${eqPct.toFixed(1)}%` : '—'}
                                      </td>
                                      <td className="px-4 py-2.5 text-right text-slate-400 tabular-nums text-xs">
                                        {baseArpu !== null ? formatNumber(baseArpu) : '—'}
                                      </td>
                                    </React.Fragment>
                                  );
                                })}
                                <td className="px-4 py-2.5 text-right font-semibold text-slate-500 tabular-nums text-xs">
                                  {formatNumber(evtBaselineArpu)}
                                </td>
                                <td className="px-4 py-2.5 text-center text-[10px] text-slate-400" rowSpan={2}>
                                  {evt.rollForward
                                    ? <span className="inline-block px-1.5 py-0.5 bg-violet-100 text-violet-700 rounded font-semibold">All Fwd</span>
                                    : <span className="text-slate-400">Once</span>}
                                </td>
                                <td className="px-4 py-2.5 text-slate-500 text-xs max-w-[120px] truncate" rowSpan={2} title={evt.comment}>{evt.comment || '—'}</td>
                                <td className="px-4 py-2.5 text-center" rowSpan={2}>
                                  <button
                                    type="button"
                                    onClick={(e) => { e.stopPropagation(); removeYieldEvent(evt.id); }}
                                    className="text-rose-400 hover:text-rose-600 p-1 rounded hover:bg-rose-50 transition-colors"
                                  >
                                    <Trash2 size={13} />
                                  </button>
                                </td>
                              </tr>

                              {/* Adjusted row */}
                              <tr className="hover:bg-slate-50 transition-colors border-b border-slate-200">
                                {allYieldTiers.map(tier => {
                                  const mixPct = evt.tariffMix[tier] ?? null;
                                  const baseArpu = evt.tariffBaseArpu[tier] ?? null;
                                  const yieldContrib = mixPct !== null && baseArpu !== null ? (mixPct / 100) * baseArpu : null;
                                  return (
                                    <React.Fragment key={tier}>
                                      <td className="px-4 py-2.5 text-right font-semibold text-slate-700 tabular-nums text-xs">
                                        {mixPct !== null ? `${mixPct.toFixed(1)}%` : '—'}
                                      </td>
                                      <td className="px-4 py-2.5 text-right tabular-nums font-medium text-xs text-slate-700">
                                        {yieldContrib !== null ? formatNumber(yieldContrib) : '—'}
                                      </td>
                                    </React.Fragment>
                                  );
                                })}
                                <td className={`px-4 py-2.5 text-right font-semibold tabular-nums text-xs ${arpuDelta >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                                  {formatNumber(evtBlendedArpu)}
                                  <span className="ml-1 text-[10px] font-normal text-slate-400">
                                    ({arpuDelta >= 0 ? '+' : ''}{formatNumber(arpuDelta)})
                                  </span>
                                </td>
                              </tr>
                            </React.Fragment>
                          );
                        })
                    )}
                  </tbody>
                </table>
              </div>

              {yieldEvents.length > 0 && (
                <div className="px-5 py-3 bg-slate-50 border-t border-slate-100 flex justify-start">
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); clearAllYieldEvents(); }}
                    className="text-xs font-medium text-slate-500 hover:text-rose-600 transition-colors flex items-center gap-1.5"
                  >
                    <Trash2 size={12} /> Clear All Yield Events
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

      </div>
      </div>
    </div>
  );
};

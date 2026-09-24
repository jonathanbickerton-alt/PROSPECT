/**
 * THE EVENT-SCOPED SERIES — REQ-D7-02 clause 11 (Jon, 2026-09-24, after the 1850 STOP).
 *
 * The body of WhatIfTab's `eventScopeSeriesFor`, MOVED here verbatim so it has a
 * module-level definition a second screen can call. WhatIfTab keeps a thin
 * `useCallback` wrapper that passes its closed-over state; its five callers are
 * untouched. Step 3 (ForecastVsActualsTab) is caller six, for its own view.
 *
 * ONE ROUTE TO AN ADJUSTED RUN. The one `computeAdjustedForecast` call inside
 * moved; it did not multiply — the engine's site count is unchanged.
 *
 * ADDITIVE: the return gains `adjustedMonths`, the run's own months UNROUNDED
 * (`uplifted.{inflow,outflow,retention,arpu}` — what Step 3's scoring reads).
 * The chart rows in `series` are rounded for display and are not a substitute.
 * Nothing that read the old shape reads anything different.
 *
 * AN IMPORT CYCLE, stated: this module imports the engine from
 * `../components/WhatIfTab` (where `computeAdjustedForecast` lives), and
 * WhatIfTab imports this module for its wrapper. Neither evaluates the other's
 * exports at load time — both are hoisted function declarations called later —
 * so the cycle is inert. Moving the engine itself out of the component would
 * remove it, and is not this clause.
 */
import type { MarketEvent } from './forecasting';
import { resolveEventScopeForecast } from './forecasting';
import type { YieldEvent, PricingEvent, AdjustedForecastMonth } from '../types/forecast';
import { computeAdjustedForecast, dimOrNull } from '../components/WhatIfTab';

export interface EventScopeSeriesInput {
  /** The scope: a Pricing-draft-shaped slice (segment, product/productL2, channelL1/L2, tariffL1/L2). */
  draft: Partial<PricingEvent>;
  excludeId: string | null;
  yieldDraft?: YieldEvent | null;
  excludeYieldId?: string | null;
  marketDraft?: MarketEvent[] | null;
  excludeMarketIds?: readonly string[] | null;
  marketEvents: MarketEvent[];
  yieldEvents: YieldEvent[];
  pricingEvents: PricingEvent[];
  resolveForecast: (key: string) => { forecast: any | null; reason: any | null };
  data: any[];
  wiSegmentCol: string; wiProductCol: string; wiProductL2Col: string;
  wiChannelCol: string; wiChannelL2Col: string;
  wiTariffL1Col: string; wiTariffL2Col: string; wiValueCol: string;
  wiMetricCol?: string; wiInflowVal?: string; wiOutflowVal?: string; wiRetentionVal?: string;
}

export interface EventScopeSeriesResult {
  series: any[] | null;
  reason: string | null;
  arpuIdsByMonth: Record<string, string[]>;
  rawArpuByMonth: Record<string, { inflowBaseline: number | null; inflowAdjusted: number | null;
                                   retentionBaseline: number | null; retentionAdjusted: number | null }>;
  /** REQ-D7-02 clause 11 — ADDITIVE. The run's months, unrounded; [] when the slice has no forecast. */
  adjustedMonths: AdjustedForecastMonth[];
}

export function eventScopeSeries(input: EventScopeSeriesInput): EventScopeSeriesResult {
  const {
    draft, excludeId, yieldDraft, excludeYieldId, marketDraft, excludeMarketIds,
    marketEvents, yieldEvents, pricingEvents, resolveForecast, data,
    wiSegmentCol, wiProductCol, wiProductL2Col, wiChannelCol, wiChannelL2Col,
    wiTariffL1Col, wiTariffL2Col, wiValueCol,
    wiMetricCol, wiInflowVal, wiOutflowVal, wiRetentionVal,
  } = input;
    // CALLER 2 OF TWO — and the fix this returns is the whole point.
    //
    // This used to pass `baseForecast`, the LOADED COHORT's forecast, and hand
    // the draft's dims in as view filters. That reads as scoping and is not:
    // computeAdjustedForecast's view dims drive EVENT MATCHING only, so the
    // baseline series — the ARPU column AND all three volume columns — stayed
    // the loaded cohort's however narrow the draft was.
    //
    // MEASURED ON THE MOUNTED HARNESS, wide cohort loaded and a narrow draft:
    // baseline ARPU 20.40 and pricedVol 32,760.06 were the WIDE cohort's to the
    // penny, where the draft's own slice was 24.00 and 26,208.05. Loading that
    // slice changed all four figures — which is the definition of a scoping
    // bug, and why the walks never saw it: they had the slice loaded.
    //
    // Decisions 1 and 3 of 2026-08-17 both name this surface as event-scoped:
    // "the blend of the event's own dimensions at its month". Now it is.
    const resolution = resolveEventScopeForecast({
      segment: draft.segment, product: draft.product, productL2: draft.productL2,
      channelL1: draft.channelL1, channelL2: draft.channelL2,
      tariffL1: draft.tariffL1, tariffL2: draft.tariffL2,
    }, resolveForecast);
    // A SLICE NO FORECAST COVERS IS A STATE, NOT A ZERO. The seam's own reason
    // travels back to the card verbatim; substituting a generic sentence here
    // would be the two-meanings-of-null defect at another site.
    if (!resolution.forecast) {
      return { series: null, reason: resolution.reason ?? null, arpuIdsByMonth: {}, rawArpuByMonth: {}, adjustedMonths: [] };
    }
    // D5-11(2). The yield list the preview measures against: the edited event
    // dropped, the draft spliced in. Untouched when no yield draft is given,
    // so the Pricing card's two callers behave byte-identically.
    const yieldsForRun = (yieldDraft || excludeYieldId)
      ? [...(excludeYieldId ? yieldEvents.filter(y => y.id !== excludeYieldId) : yieldEvents),
         ...(yieldDraft ? [yieldDraft] : [])]
      : yieldEvents;
    // REQ-D6-07 clause 15. The SAME splice for promotion rows. Untouched when no
    // market draft is given, so the four earlier callers get the very same array.
    const marketsForRun = (marketDraft || excludeMarketIds)
      ? [...(excludeMarketIds ? marketEvents.filter(e => !excludeMarketIds.includes(e.id)) : marketEvents),
         ...(marketDraft ? marketDraft : [])]
      : marketEvents;
    const run = computeAdjustedForecast({
    baseForecast: resolution.forecast, marketEvents: marketsForRun, yieldEvents: yieldsForRun,
    pricingEvents: excludeId ? pricingEvents.filter(p => p.id !== excludeId) : pricingEvents,
    viewSegment: draft.segment ?? 'All',
    viewProduct: { l1: dimOrNull(draft.product), l2: dimOrNull(draft.productL2) },
    viewChannel: { l1: dimOrNull(draft.channelL1), l2: dimOrNull(draft.channelL2) },
    viewTariff: { l1: dimOrNull(draft.tariffL1), l2: dimOrNull(draft.tariffL2) },
    data, wiSegmentCol, wiProductCol, wiProductL2Col, wiChannelCol, wiChannelL2Col,
    wiTariffL1Col, wiTariffL2Col, wiValueCol,
    wiMetricCol, wiInflowVal, wiOutflowVal, wiRetentionVal,
    });
    // ONE PASS over the months the run already produced. The Pricing card's
    // two callers read `.series` and nothing else, so this field is inert for
    // them — asserted byte-identical by the spec rather than assumed.
    const arpuIdsByMonth: Record<string, string[]> = {};
    const rawArpuByMonth: Record<string, { inflowBaseline: number | null; inflowAdjusted: number | null;
                                           retentionBaseline: number | null; retentionAdjusted: number | null }> = {};
    const fcByMonth = new Map<string, any>((resolution.forecast.months ?? []).map((m: any) => [m.month, m]));
    for (const m of run.adjustedMonths) {
      arpuIdsByMonth[m.month] = m.appliedArpuIds ?? [];
      const fcM = fcByMonth.get(m.month);
      const num = (v: any) => (typeof v === 'number' && Number.isFinite(v)) ? v : null;
      rawArpuByMonth[m.month] = {
        inflowBaseline: num(fcM?.inflowArpu?.mean),
        inflowAdjusted: num((m as any).scenarioArpu?.inflow?.arpu),
        retentionBaseline: num(fcM?.retentionArpu?.mean),
        retentionAdjusted: num((m as any).scenarioArpu?.retention?.arpu),
      };
    }
    return { series: run.chartData, reason: null, arpuIdsByMonth, rawArpuByMonth, adjustedMonths: run.adjustedMonths };
}

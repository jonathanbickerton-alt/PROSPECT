import { format, addMonths, parse } from 'date-fns';
import { eventProRataShare, eventCoverage, applyEventsToMonth, resolvedEventVolume,
         eventScopeMatchesView, pricedVolumesFor, applyPricingToBlend } from './forecasting';
import type { ProRataLeaf, ProRataScope } from './forecasting';

export function computeScenarioForFilter(parsedSession: any, vseg: string, vprod: any, vchan: any, vtariff?: any) {
  const { baselineRows, marketEvents, yieldEvents, pricingEvents } = parsedSession;

  const vprodL1 = vprod.l1;
  const vprodL2 = vprod.l2;
  const vchanL1 = vchan.l1;
  const vchanL2 = vchan.l2;
  const vtarL1 = vtariff?.l1 ?? null;   // Phase 2a — null = All tariffs
  const vtarL2 = vtariff?.l2 ?? null;

  // 1. Filter Baseline Rows to matching cohorts
  const matchingBaseline = baselineRows.filter((r: any) => {
    if (vseg !== 'All' && r.Segment !== vseg) return false;
    if (vprodL1 && r.Product !== vprodL1) return false;
    if (vprodL2 && r.Product_L2 !== 'All' && r.Product_L2 !== vprodL2) return false;
    if (vchanL1 && r.Channel !== vchanL1) return false;
    if (vchanL2 && r.Channel_L2 !== 'All' && r.Channel_L2 !== vchanL2) return false;
    if (vtarL1 && r.Tariff_L1 && r.Tariff_L1 !== 'All' && r.Tariff_L1 !== vtarL1) return false;
    if (vtarL2 && r.Tariff_L2 && r.Tariff_L2 !== 'All' && r.Tariff_L2 !== vtarL2) return false;
    return true;
  });

  if (!matchingBaseline.length) return [];

  // Market-event pro-rata scoping — SAME shared rule as the WhatIfTab
  // engine (see eventProRataShare). No parallel implementation.
  //
  // Note this deliberately leaves the AGGREGATE case untouched: when the view
  // scope is exactly the event's target, the cohort covers the whole target and
  // the share is 1, so an aggregate query keeps summing its leaf rows and
  // applying the event once — which was already correct. Only a LEAF view, where
  // the wildcard previously re-attached the event at full magnitude, changes.
  // Leaf weights PER METRIC. Weighting every event by Inflow_Mean misallocates
  // any Outflow or Retention event across leaves whose metric mix differs from
  // their inflow mix -- measured at up to ±2% per leaf on the shipped fixture,
  // with totals still reconciling, so it was invisible at the aggregate.
  //
  // hasMetricData records whether the leaf had ANY row for that metric, so a
  // brand-new cohort with no outflow history still receives an even split
  // rather than nothing. See distributeProRata.
  type MetricKey = 'Inflow' | 'Outflow' | 'Retention';
  const METRIC_FIELD: Record<MetricKey, string> = {
    Inflow: 'Inflow_Mean', Outflow: 'Outflow_Mean', Retention: 'Retention_Mean',
  };
  const leavesByMetric: Record<MetricKey, ProRataLeaf[]> = { Inflow: [], Outflow: [], Retention: [] };
  for (const metric of Object.keys(METRIC_FIELD) as MetricKey[]) {
    const field = METRIC_FIELD[metric];
    const byLeaf = new Map<string, ProRataLeaf>();
    for (const r of baselineRows as any[]) {
      const leaf: ProRataLeaf = {
        segment:   String(r.Segment ?? 'All').trim(),
        product:   String(r.Product ?? 'All').trim(),
        productL2: String(r.Product_L2 ?? 'All').trim(),
        channel:   String(r.Channel ?? 'All').trim(),
        channelL2: String(r.Channel_L2 ?? 'All').trim(),
        tariffL1:  String(r.Tariff_L1 ?? 'All').trim(),
        tariffL2:  String(r.Tariff_L2 ?? 'All').trim(),
        volume: 0,
      };
      const k = [leaf.segment, leaf.product, leaf.productL2, leaf.channel, leaf.channelL2, leaf.tariffL1, leaf.tariffL2].join('|');
      // Present-but-null counts as populated: the row exists for this metric.
      const present = r[field] !== undefined && r[field] !== null && r[field] !== '';
      const vol = Number(r[field] || 0);
      const cur = byLeaf.get(k);
      if (cur) {
        cur.volume += vol;
        if (present) cur.hasMetricData = true;
      } else {
        leaf.volume = vol;
        leaf.hasMetricData = present;
        byLeaf.set(k, leaf);
      }
    }
    leavesByMetric[metric] = Array.from(byLeaf.values());
  }
  /**
   * The view in the shared predicate's terms (D3-02 sweep).
   *
   * Compare passes `{l1: null}` for All, so its three hand-rolled copies were
   * CORRECT — `!vprodL1` is true for null. They are retired anyway: the same
   * lines are a live defect in WhatIfTab, where cohortScope supplies the string
   * 'All', and a copy that is right only because of how its one caller happens
   * to spell "All" is a defect waiting for a second caller.
   */
  const viewScopeForMatch = {
    segment: vseg,
    productL1: vprodL1, productL2: vprodL2,
    channelL1: vchanL1, channelL2: vchanL2,
    tariffL1: vtarL1, tariffL2: vtarL2,
  };
  const viewScope: ProRataScope = {
    segment: vseg === 'All' ? 'All' : vseg,
    product: vprodL1 ?? 'All',
    productL2: vprodL2 ?? 'All',
    channel: vchanL1 ?? 'All',
    channelL2: vchanL2 ?? 'All',
    tariffL1: vtarL1 ?? 'All',
    tariffL2: vtarL2 ?? 'All',
  };
  const shareCache = new Map<string, number>();
  /** Share of a VOLUME event belonging to this view. Rate events never use this.
   *  Dispatches on the event's own scenario so the weights come from the metric
   *  actually being moved. */
  /** Event scope and leaf set, built once so eventProRataShare and
   *  eventCoverage can never disagree about what an event targets. */
  const scopeOf = (e: any) => ({
    segment: String(e.Segment ?? 'All'), product: String(e.Product ?? 'All'),
    productL2: String(e.Product_L2 ?? 'All'),
    channel: String(e.Channel ?? 'All'), channelL2: String(e.Channel_L2 ?? 'All'),
    tariffL1: String(e.Tariff_L1 ?? 'All'), tariffL2: String(e.Tariff_L2 ?? 'All'),
  });
  const leavesFor = (e: any) =>
    leavesByMetric[(String(e.Scenario) as MetricKey) in leavesByMetric
      ? (String(e.Scenario) as MetricKey) : 'Inflow'];
  const eventShare = (e: any): number => {
    const id = String(e.ID ?? e.Name ?? '') + '|' + String(e.Start_Month ?? e.Date ?? e.Month ?? '') + '|' + String(e.Scenario ?? '');
    const hit = shareCache.get(id);
    if (hit !== undefined) return hit;
    // NULL RESOLVED EXPLICITLY — see the twin at WhatIfTab's eventShare.
    // eventProRataShare returns null when no leaf exists for the metric (no
    // denominator); the legacy all-or-nothing 1 covers that one case. It
    // returns a real 0 when leaves exist and none is inside the event's
    // target, and that 0 must survive. strictNullChecks is off here, so an
    // unresolved null would multiply to 0 and silently drop the event.
    const raw = eventProRataShare(scopeOf(e), viewScope, leavesFor(e));
    const v = raw === null ? 1 : raw;
    shareCache.set(id, v);
    return v;
  };

  // Group matching baseline by Month
  const monthMap = new Map<string, {
    inflow: number; outflow: number; retention: number;
    arpuW: number; // For weighted average
    baseW: number;
  }>();

  // We need the seed base from Month 0 (actually from the metadata of each cohort)
  // Cohort metadata in baselineRows is repeated for every month, but Seed_Base_Volume is constant per Cohort.
  const cohortCache = new Set<string>();
  let totalSeedBase = 0;
  let totalLastIn = 0;
  let totalLastOut = 0;

  matchingBaseline.forEach((r: any) => {
    const key = r.Cohort_Key;
    if (!cohortCache.has(key)) {
      cohortCache.add(key);
      totalSeedBase += Number(r.Seed_Base_Volume || 0);
      totalLastIn += Number(r.Last_Historical_Inflow || 0);
      totalLastOut += Number(r.Last_Historical_Outflow || 0);
    }
    
    if (!monthMap.has(r.Month)) {
      monthMap.set(r.Month, { inflow: 0, outflow: 0, retention: 0, arpuW: 0, baseW: 0 });
    }
    const m = monthMap.get(r.Month)!;
    m.inflow += Number(r.Inflow_Mean || 0);
    m.outflow += Number(r.Outflow_Mean || 0);
    m.retention += Number(r.Retention_Mean || 0);

    // Reconstruct base using a temporary simple accumulation for ARPU weighting.
    // In WhatIf Tab, ARPU is weighted by (Base + Inflow). 
  });

  // Let's accurately compute the derived base stock for weighting
  const months = Array.from(monthMap.keys()).sort();
  let b = totalSeedBase;
  let pIn = totalLastIn;
  let pOut = totalLastOut;

  const aggregatedMonths: any[] = [];
  months.forEach(month => {
    b = Math.max(0, b + pIn - pOut);
    
    // Process matching baseline rows again for THIS month to calculate volume-weighted ARPU
    let wArpuMean = 0;
    let wTotal = 0;

    matchingBaseline.filter((r: any) => r.Month === month).forEach((r: any) => {
      // weight = derived base for this cohort + this cohort's inflow
      // Since deriving base per-cohort here is slow, we can just use the provided Seed_Base_Volume + Inflow_Mean as an approximation of size for weighting ARPU.
      const w = Number(r.Seed_Base_Volume || 0) + Number(r.Inflow_Mean || 0);
      wArpuMean += Number(r.ARPU_Mean || 0) * w;
      wTotal += w;
    });

    const m = monthMap.get(month)!;
    const arpu = wTotal > 0 ? wArpuMean / wTotal : 0;
    
    aggregatedMonths.push({
      month,
      inflow: { mean: m.inflow },
      outflow: { mean: m.outflow },
      retention: { mean: m.retention },
      arpu: { mean: arpu },
    });
    
    pIn = m.inflow;
    pOut = m.outflow;
  });

  // Now we have the aggregated baseline! `aggregatedMonths`.
  // We apply pass 1 and pass 2 from WhatIfTab to apply events.
  const computed: any[] = [];
  
  aggregatedMonths.forEach(month => {
    const applicable = marketEvents.filter((e: any) => {
      const eventDate = e.Start_Month || e.Date || e.Month;
      if (eventDate !== month.month) return false;
      return eventScopeMatchesView(
        { segment: e.Segment, product: e.Product, productL2: e.Product_L2,
          channelL1: e.Channel, channelL2: e.Channel_L2,
          tariffL1: e.Tariff_L1, tariffL2: e.Tariff_L2 },
        viewScopeForMatch);
    });

    const applied = applyEventsToMonth(
      {
        inflow: month.inflow.mean,
        outflow: month.outflow.mean,
        retention: month.retention.mean,
        arpu: month.arpu.mean,
      },
      applicable.map((e: any) => ({
        id: String(e.ID ?? e.Name ?? ''),
        scenario: String(e.Scenario) as 'Inflow' | 'Retention' | 'Outflow' | 'ARPU',
        // VOLUME events take only this view's pro-rata share (share is 1 for an
        // aggregate view, so the already-correct aggregate case is unchanged).
        sharedVolume: Number(e.Subscriber_Volume || 0) * eventShare(e),
        viewShare: eventShare(e),
        arpuDelta: Number(e.ARPU || 0),
        amountType: e.Amount_Type === 'percentage' ? 'percentage' as const : 'absolute' as const,
        percentageBasis: e.Percentage_Basis === 'adjusted' ? 'adjusted' as const : 'baseline' as const,
        retentionLinked: e.Retention_Linked !== 'No',
        percentAmount: Number(e.Subscriber_Volume || 0),
        // A percentage scales what it lands on rather than being split across
        // it — coverage, not share. See eventCoverage.
        coverage: e.Amount_Type === 'percentage'
          ? eventCoverage(scopeOf(e), viewScope, leavesFor(e)) : 1,
      })),
    );

    computed.push({
      month: month.month,
      baseline: {
        inflow: month.inflow.mean,
        retention: month.retention.mean,
        outflow: month.outflow.mean,
        arpu: month.arpu.mean,
      },
      uplifted: {
        inflow: applied.metrics.inflow,
        retention: applied.metrics.retention,
        outflow: applied.metrics.outflow,
        arpu: applied.metrics.arpu,
      },
      preFloor: applied.preFloor,
      derivations: applied.derivations,
      flooredMetrics: applied.flooredMetrics,
      // derivations IS consumed, below, to size the ARPU pools from the
      // resolved delta rather than the raw percent.
      //
      // preFloor, flooredMetrics and appliedEventIds are NOT read by anything
      // in this path. computeScenarioForFilter returns a flat row shape that
      // drops them, and its only caller (ScenarioCompareTab) has no breach UI.
      // They are kept so the two paths produce the same month record, which is
      // what lets applyEventsToMonth stay shared — but do not read this as
      // floor warnings existing here. They do not. An earlier version of this
      // comment claimed they did.
      appliedEventIds: applied.appliedIds,
      zeroCoverageEventIds: applied.zeroCoverageIds,
    });
  });

  // Pass 2: Base Stock & Blended ARPU using Pools
  const DEFAULT_CONTRACT_N = 24;
  interface EventPool {
    arpu: number;
    contractLength: number;
    enterMonthIdx: number;
    size: number;
  }
  
  let p_bBase = totalSeedBase;
  let p_bAdj  = totalSeedBase;
  let p_basePool = totalSeedBase;
  const p_eventPools: EventPool[] = [];

  let p_prevBBaseIn  = totalLastIn;
  let p_prevBBaseOut = totalLastOut;
  let p_prevBAdjIn   = totalLastIn;
  let p_prevBAdjOut  = totalLastOut;

  const finalRows = computed.map((m, idx) => {
    const newBBase = Math.max(0, p_bBase + p_prevBBaseIn - p_prevBBaseOut);
    const newBAdj  = Math.max(0, p_bAdj  + p_prevBAdjIn  - p_prevBAdjOut);

    const totalOutflow = p_prevBAdjOut;
    if (totalOutflow > 0 && p_bAdj > 0) {
      const atRiskBase = Math.min(p_basePool, p_basePool / DEFAULT_CONTRACT_N);
      let remaining = totalOutflow;

      const baseChurn = Math.min(atRiskBase, remaining);
      p_basePool = Math.max(0, p_basePool - baseChurn);
      remaining -= baseChurn;

      if (remaining > 0) {
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

    if (idx > 0) {
      const prevMonthKey = computed[idx - 1].month;
      
      const applicableInflowYield = yieldEvents
        .filter((ye: any) => {
          if (ye.IBRO !== 'Inflow') return false;
          if (!eventScopeMatchesView(
            { segment: ye.Segment, product: ye.Product,
              channelL1: ye.Channel_L1, channelL2: ye.Channel_L2 },
            viewScopeForMatch)) return false;
          if (ye.Roll_Forward === 'Yes') return ye.Month <= prevMonthKey;
          return ye.Month === prevMonthKey;
        })
        .sort((a: any, b: any) => b.Month.localeCompare(a.Month))[0];

      let naturalInflowArpu = computed[idx - 1].baseline.arpu;

      if (applicableInflowYield) {
        let tariffMix = {};
        let tariffBase = {};
        try {
          tariffMix = JSON.parse(applicableInflowYield.Tariff_Mix_JSON || '{}');
          tariffBase = JSON.parse(applicableInflowYield.Tariff_Base_ARPU_JSON || '{}');
        } catch(e) {}
        
        const rawBlendedYieldArpu = Object.keys(tariffMix).reduce((sum, tier) => {
          return sum + ((tariffMix as any)[tier] / 100) * ((tariffBase as any)[tier] ?? 0);
        }, 0);
        
        const storedTiers = Object.keys(tariffBase);
        const storedEqualWeightArpu = storedTiers.length > 0
          ? storedTiers.reduce((s, t) => s + ((tariffBase as any)[t] ?? 0), 0) / storedTiers.length
          : 0;
          
        if (storedEqualWeightArpu > 0) {
          naturalInflowArpu *= (rawBlendedYieldArpu / storedEqualWeightArpu);
        }
      }

      if (naturalInflowArpu !== computed[idx - 1].baseline.arpu) {
        p_eventPools.push({
          arpu: naturalInflowArpu,
          contractLength: DEFAULT_CONTRACT_N,
          enterMonthIdx: idx,
          size: computed[idx - 1].baseline.inflow,
        });
      } else {
        p_basePool += computed[idx - 1].baseline.inflow;
      }

      const applicableEvents = marketEvents.filter((e: any) => {
        const eventDate = e.Start_Month || e.Date || e.Month;
        if (eventDate !== prevMonthKey || e.Scenario !== 'Inflow') return false;
        // WIDENED DELIBERATELY. This copy compared FIVE dimensions and omitted
        // tariff L1/L2 entirely, so a tariff-scoped Inflow event pooled across
        // every tariff here. That is the same omission the pricing filter had
        // before it was retired to the shared predicate, and the same fix.
        // Behaviour therefore changes for tariff-scoped events in Compare.
        return eventScopeMatchesView(
          { segment: e.Segment, product: e.Product, productL2: e.Product_L2,
            channelL1: e.Channel, channelL2: e.Channel_L2,
            tariffL1: e.Tariff_L1, tariffL2: e.Tariff_L2 },
          viewScopeForMatch);
      });

      applicableEvents.forEach((ev: any) => {
        const arpu = Number(ev.ARPU);
        if (isFinite(arpu) && arpu > 0 && Number(ev.Subscriber_Volume) > 0) {
          // Same pro-rata share as the application above — the pool must hold
          // exactly the volume this view received, or blended ARPU is computed
          // over subscribers that were never added to Base.
          const poolShare = eventShare(ev);
          p_eventPools.push({
            arpu,
            contractLength: Number(ev.Contract_Length_Months || 24),
            enterMonthIdx: idx,
            // Percentage events store a PERCENT in Subscriber_Volume, so the
            // resolved delta comes from the engine derivations. Same rule as
            // the WhatIfTab pool, via the same shared helper — these two have
            // drifted twice and this is exactly the shape that does it.
            size: resolvedEventVolume(
              { id: String(ev.ID ?? ev.Name ?? ''), amountType: ev.Amount_Type === 'percentage' ? 'percentage' : 'absolute' },
              Number(ev.Subscriber_Volume) * poolShare,
              computed[idx - 1]?.derivations,
              'inflow',
            ),
          });
        } else {
          // Reached whenever an event carries no ARPU of its own — which is
          // EVERY percentage event, because the add path zeroes arpu for them.
          // Adding Subscriber_Volume raw would put the percent (10) into the
          // base pool instead of the subscribers the event actually added.
          p_basePool += resolvedEventVolume(
            { id: String(ev.ID ?? ev.Name ?? ''), amountType: ev.Amount_Type === 'percentage' ? 'percentage' : 'absolute' },
            Number(ev.Subscriber_Volume || 0),
            computed[idx - 1]?.derivations,
            'inflow',
          );
        }
      });
    }

    const eventTotal = p_eventPools.reduce((s, p) => s + p.size, 0);
    p_basePool = Math.max(0, newBAdj - eventTotal);

    const tSubs = p_basePool + p_eventPools.reduce((s, p) => s + p.size, 0);
    const tRev = (p_basePool * m.uplifted.arpu) + p_eventPools.reduce((s, p) => s + p.size * p.arpu, 0);
    const blendedArpu = tSubs > 0 ? tRev / tSubs : m.uplifted.arpu;

    let finalArpu = blendedArpu;
    // RATE event — NOT pro-rated. Pricing shifts a per-head ARPU, not a
    // quantity: a volume-weighted average of (leafArpu + delta) already equals
    // (aggregateArpu + delta). Scaling by a leaf's volume share would
    // under-apply the price change. Do not route this through eventShare().
    const applicablePricing = pricingEvents.filter((e: any) => {
      // THE SHARED PREDICATE, not a seventh private answer. These six inline
      // comparisons were this file's own copy of a rule the What-If side also
      // held — and they OMITTED Product_L2 entirely, so an event scoped to one
      // value tier applied across every tier here. The predicate's handling of
      // 'All' / null / absent is verified over all 46,656 combinations, and a
      // literal 'All' from the sheet is a wildcard through it.
      if (!eventScopeMatchesView({
        segment: e.Segment, product: e.Product, productL2: e.Product_L2,
        channelL1: e.Channel_L1, channelL2: e.Channel_L2,
        tariffL1: e.Tariff_L1, tariffL2: e.Tariff_L2,
      }, {
        segment: vseg,
        productL1: vprodL1, productL2: vprodL2,
        channelL1: vchanL1, channelL2: vchanL2,
        tariffL1: vtarL1, tariffL2: vtarL2,
      })) return false;
      
      const startMs = parse(e.Month, 'yyyy-MM', new Date()).getTime();
      const currMs = parse(m.month, 'yyyy-MM', new Date()).getTime();
      if (currMs < startMs) return false;
      const duration = Number(e.Duration) || 1;
      const endMs = addMonths(parse(e.Month, 'yyyy-MM', new Date()), duration).getTime();
      if (e.Duration !== 'one-off' && currMs >= endMs) return false;
      return true;
    });

    // WEIGHTED BY WHAT THE EVENT ACTUALLY PRICES, through the SAME functions
    // the What-If side uses. This multiplied the WHOLE blended ARPU and read
    // neither Target nor Cohort_Scope, so a retention-scoped event moved every
    // subscriber here and only the retained ones there — one event, two
    // different effects on two screens. Every dilution event is
    // retention-scoped by construction, so the divergence was systematic.
    //
    // The volumes are this pass's own: m.uplifted's flows and the adjusted base
    // pool, the same three quantities WhatIfTab weights over. Only the SHAPE is
    // adapted at the call; the arithmetic is not forked.
    applicablePricing.forEach((pe: any) => {
      const amount = Number(pe.Amount || 0);
      const priced = pe.Input_Mode === 'percentage'
        ? finalArpu * (1 + amount / 100)
        : finalArpu + amount;
      const pools = pricedVolumesFor(
        {
          target: (pe.Target ?? 'cohorts') as 'cohorts' | 'cohorts+base' | 'base-only',
          cohortScope: (pe.Cohort_Scope ?? 'both') as 'inflow' | 'retention' | 'both',
        },
        { inflow: m.uplifted.inflow, retention: m.uplifted.retention, base: newBAdj },
      );
      // base-only has no pool decomposition expressible in month volumes;
      // pricedVolumesFor says so by returning null. The What-If side prices the
      // base pool against the event pools there, which this pass does not model,
      // so the unweighted application is KEPT for that target rather than
      // replaced by a weight that belongs to neither.
      finalArpu = pools
        ? applyPricingToBlend(pools.pricedVol, priced, pools.totalVol, finalArpu)
        : priced;
    });

    p_bBase = newBBase;
    p_bAdj = newBAdj;
    
    p_prevBBaseIn = m.baseline.inflow;
    p_prevBBaseOut = m.baseline.outflow;
    p_prevBAdjIn = m.uplifted.inflow;
    p_prevBAdjOut = m.uplifted.outflow;

    return {
      month: m.month,
      baselineInflow: m.baseline.inflow,
      baselineOutflow: m.baseline.outflow,
      baselineRetention: m.baseline.retention,
      baselineBase: newBBase,
      baselineArpu: m.baseline.arpu,
      
      adjustedInflow: m.uplifted.inflow,
      adjustedOutflow: m.uplifted.outflow,
      adjustedRetention: m.uplifted.retention,
      adjustedBase: newBAdj,
      adjustedArpu: finalArpu,
    };
  });

  return finalRows;
}

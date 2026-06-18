import { format, addMonths, parse } from 'date-fns';

export function computeScenarioForFilter(parsedSession: any, vseg: string, vprod: any, vchan: any) {
  const { baselineRows, marketEvents, yieldEvents, pricingEvents } = parsedSession;

  const vprodL1 = vprod.l1;
  const vprodL2 = vprod.l2;
  const vchanL1 = vchan.l1;
  const vchanL2 = vchan.l2;

  // 1. Filter Baseline Rows to matching cohorts
  const matchingBaseline = baselineRows.filter((r: any) => {
    if (vseg !== 'All' && r.Segment !== vseg) return false;
    if (vprodL1 && r.Product !== vprodL1) return false;
    if (vprodL2 && r.Product_L2 !== 'All' && r.Product_L2 !== vprodL2) return false;
    if (vchanL1 && r.Channel !== vchanL1) return false;
    if (vchanL2 && r.Channel_L2 !== 'All' && r.Channel_L2 !== vchanL2) return false;
    return true;
  });

  if (!matchingBaseline.length) return [];

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
      const segMatch  = e.Segment === 'All' || vseg === 'All' || e.Segment === vseg;
      const prodL1Match = e.Product === 'All' || !vprodL1 || e.Product === vprodL1;
      const prodL2Match = !e.Product_L2 || e.Product_L2 === 'All' || !vprodL2 || e.Product_L2 === vprodL2;
      const chanL1Match = e.Channel === 'All' || !vchanL1 || e.Channel === vchanL1;
      const chanL2Match = !e.Channel_L2 || e.Channel_L2 === 'All' || !vchanL2 || e.Channel_L2 === vchanL2;
      return segMatch && prodL1Match && prodL2Match && chanL1Match && chanL2Match;
    });

    let adjInflow = month.inflow.mean;
    let adjOutflow = month.outflow.mean;
    let adjRetention = month.retention.mean;
    let adjArpu = month.arpu.mean;

    applicable.forEach((e: any) => {
      if (e.Scenario === 'Inflow') {
        adjInflow += Number(e.Subscriber_Volume || 0);
      } else if (e.Scenario === 'Outflow') {
        adjOutflow -= Number(e.Subscriber_Volume || 0);
      } else if (e.Scenario === 'Retention') {
        adjOutflow -= Number(e.Subscriber_Volume || 0);
        adjRetention += Number(e.Subscriber_Volume || 0);
      } else if (e.Scenario === 'ARPU') {
        adjArpu += Number(e.ARPU || 0);
      }
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
        arpu: Math.max(0, adjArpu),
      }
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
          const segOk = ye.Segment === 'All' || vseg === 'All' || ye.Segment === vseg;
          const prodOk = ye.Product === 'All' || !vprodL1 || ye.Product === vprodL1;
          const ch1Ok = ye.Channel_L1 === 'All' || !vchanL1 || ye.Channel_L1 === vchanL1;
          const ch2Ok = ye.Channel_L2 === 'All' || !vchanL2 || ye.Channel_L2 === vchanL2;
          if (!segOk || !prodOk || !ch1Ok || !ch2Ok) return false;
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
        const segMatch  = e.Segment === 'All' || vseg === 'All' || e.Segment === vseg;
        const prodL1Match = e.Product === 'All' || !vprodL1 || e.Product === vprodL1;
        const prodL2Match = !e.Product_L2 || e.Product_L2 === 'All' || !vprodL2 || e.Product_L2 === vprodL2;
        const chanL1Match = e.Channel === 'All' || !vchanL1 || e.Channel === vchanL1;
        const chanL2Match = !e.Channel_L2 || e.Channel_L2 === 'All' || !vchanL2 || e.Channel_L2 === vchanL2;
        return segMatch && prodL1Match && prodL2Match && chanL1Match && chanL2Match;
      });

      applicableEvents.forEach((ev: any) => {
        const arpu = Number(ev.ARPU);
        if (isFinite(arpu) && arpu > 0 && Number(ev.Subscriber_Volume) > 0) {
          p_eventPools.push({
            arpu,
            contractLength: Number(ev.Contract_Length_Months || 24),
            enterMonthIdx: idx,
            size: Number(ev.Subscriber_Volume),
          });
        } else {
          p_basePool += Number(ev.Subscriber_Volume || 0);
        }
      });
    }

    const eventTotal = p_eventPools.reduce((s, p) => s + p.size, 0);
    p_basePool = Math.max(0, newBAdj - eventTotal);

    const tSubs = p_basePool + p_eventPools.reduce((s, p) => s + p.size, 0);
    const tRev = (p_basePool * m.uplifted.arpu) + p_eventPools.reduce((s, p) => s + p.size * p.arpu, 0);
    const blendedArpu = tSubs > 0 ? tRev / tSubs : m.uplifted.arpu;

    let finalArpu = blendedArpu;
    const applicablePricing = pricingEvents.filter((e: any) => {
      const segOk = e.Segment === 'All' || vseg === 'All' || e.Segment === vseg;
      const prodOk = e.Product === 'All' || !vprodL1 || e.Product === vprodL1;
      const ch1Ok = e.Channel_L1 === 'All' || !vchanL1 || e.Channel_L1 === vchanL1;
      const ch2Ok = e.Channel_L2 === 'All' || !vchanL2 || e.Channel_L2 === vchanL2;
      if (!segOk || !prodOk || !ch1Ok || !ch2Ok) return false;
      
      const startMs = parse(e.Month, 'yyyy-MM', new Date()).getTime();
      const currMs = parse(m.month, 'yyyy-MM', new Date()).getTime();
      if (currMs < startMs) return false;
      const duration = Number(e.Duration) || 1;
      const endMs = addMonths(parse(e.Month, 'yyyy-MM', new Date()), duration).getTime();
      if (e.Duration !== 'one-off' && currMs >= endMs) return false;
      return true;
    });

    applicablePricing.forEach((pe: any) => {
      const amount = Number(pe.Amount || 0);
      if (pe.Input_Mode === 'percentage') {
        finalArpu *= (1 + amount / 100);
      } else {
        finalArpu += amount;
      }
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

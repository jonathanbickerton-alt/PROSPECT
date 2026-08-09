/**
 * STEP 1 RESOLVES ITS SELECTION, AND ITS CHART DRAWS ONE POPULATION.
 *
 *   npm run spec:step1-selection
 *
 * Keep-last was retired on 2026-08-09 (Jon, option 1 of three). Step 1 used to
 * hold whatever forecast was last generated while its dropdowns moved
 * underneath it, so `arpuChartData` drew its history from the SELECTION and its
 * forecast from something else. Measured at Segment=Corporate, others All:
 * history 17.05-17.83, forecast 33.69 — the latter being one Mobile Voice /
 * Direct leaf. One chart, two populations, presented as history versus
 * projection.
 *
 * STATE-NOT-TRANSITION. A mount showing the right forecast for a selection
 * proves nothing about what happens when the selection CHANGES, which is the
 * whole of the decision. So the selection is changed here, repeatedly, and the
 * assertions are about what changed.
 *
 * DRIVEN, NOT MODELLED. The transition is `forecastForStep1Selection` in
 * utils/viewFilter — extracted for the reason `forecastForView` was: a
 * transition that lives only inside a component effect can be modelled by a
 * spec but never driven by one, and a spec that models the transition it is
 * checking agrees with itself no matter what the app does. Guard-trap 45
 * replants keep-last inside that helper and this file goes red.
 *
 * PRODUCTION-FED. Leaves are fitted with the real `calculateBaseForecast`, the
 * store is the real shape, and every resolution goes through the real
 * `resolveFromStore`. Nothing here hand-writes a forecast.
 */
import { JSDOM } from 'jsdom';

const dom = new JSDOM('<!doctype html><html><body><div id="root"></div></body></html>',
  { url: 'http://localhost/', pretendToBeVisual: true });
const g = globalThis as any;
g.window = dom.window; g.document = dom.window.document;
Object.defineProperty(g, 'navigator', { value: dom.window.navigator, configurable: true, writable: true });
g.HTMLElement = dom.window.HTMLElement; g.Element = dom.window.Element; g.Node = dom.window.Node;
g.SVGElement = dom.window.SVGElement;
g.getComputedStyle = dom.window.getComputedStyle;
g.requestAnimationFrame = (cb: any) => setTimeout(cb, 0); g.cancelAnimationFrame = clearTimeout;
g.MutationObserver = dom.window.MutationObserver;
g.ResizeObserver = class { cb: any; constructor(cb: any) { this.cb = cb; }
  observe(el: any) { this.cb([{ target: el, contentRect: { width: 900, height: 400, top: 0, left: 0, bottom: 400, right: 900, x: 0, y: 0 } }], this); }
  unobserve() {} disconnect() {} };
g.matchMedia = () => ({ matches: false, addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {} });
g.IS_REACT_ACT_ENVIRONMENT = true;
for (const p of ['offsetWidth', 'clientWidth'] as const) Object.defineProperty(dom.window.HTMLElement.prototype, p, { configurable: true, value: 900 });
for (const p of ['offsetHeight', 'clientHeight'] as const) Object.defineProperty(dom.window.HTMLElement.prototype, p, { configurable: true, value: 400 });

let pass = 0; const fails: string[] = [];
const check = (n: string, c: boolean, d?: string) => { if (c) pass++; else fails.push(n + (d ? `  [${d}]` : '')); };

async function main() {
  const fs = await import('fs');
  const XLSX: any = (await import('xlsx')).default ?? (await import('xlsx'));
  const fc: any = await import('../src/utils/forecasting');
  const vf: any = await import('../src/utils/viewFilter');

  const FIX = 'test-data/VBU_IBRO_EdgeCases_ShortHistory_PerScenarioARPU_Jan2023_Jun2026.xlsx';
  const C = { date: 'Month', metric: 'IBRO_Scenario_Type', val: 'Subscriber_Volume',
    seg: 'Customer_Segment', prod: 'Product_L1', prodL2: 'Product_L2_Value_Tier',
    chan: 'Channel_Level_1', chanL2: 'Channel_Level_2',
    t1: 'tariff_tier_l1', t2: 'tariff_tier_l2', rev: 'Monthly_Revenue_GBP' };
  const wb = XLSX.read(fs.readFileSync(FIX), { type: 'buffer', cellDates: true });
  const rows: any[] = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]]);
  const v = (r: any, k: string) => String(r[k] ?? '').trim();
  const mo = (r: any) => String(v(r, C.date)).slice(0, 7);

  const dm = fc.buildCohortDataMap(rows, C.date, C.seg, C.prod, C.prodL2, C.chan, C.chanL2, C.t1, C.t2);
  const { leafMap } = fc.buildRollUpIndex([...dm.keys()]);

  function seriesFor(k: string) {
    const [seg, prod, prodL2, chan, chanL2, t1, t2] = k.split('|');
    const sel = rows.filter(r => v(r, C.seg) === seg && v(r, C.prod) === prod && v(r, C.prodL2) === prodL2
      && v(r, C.chan) === chan && v(r, C.chanL2) === chanL2 && v(r, C.t1) === t1 && v(r, C.t2) === t2);
    const acc = new Map<number, any>();
    for (const r of sel) {
      const d = new Date(mo(r) + '-01'); if (isNaN(d.getTime())) continue;
      const t = d.getTime();
      if (!acc.has(t)) acc.set(t, { _parsedDate: d, inflow: 0, outflow: 0, retention: 0,
        arpu: 0, inflowArpu: 0, outflowArpu: 0, retentionArpu: 0, baseArpu: 0, _rev: 0, _vol: 0 });
      const e = acc.get(t)!, m = v(r, C.metric), val = Number(r[C.val]) || 0;
      if (m === 'Inflow') e.inflow += val; else if (m === 'Outflow') e.outflow += val;
      else if (m === 'Retention') e.retention += val;
      e._rev += Number(r[C.rev]) || 0; e._vol += val;
    }
    for (const e of acc.values()) {
      e.arpu = e._vol > 0 ? e._rev / e._vol : 0;
      e.inflowArpu = e.arpu; e.outflowArpu = e.arpu; e.retentionArpu = e.arpu; e.baseArpu = e.arpu;
    }
    return [...acc.values()].sort((a: any, b: any) => a._parsedDate - b._parsedDate);
  }
  const fit = (k: string) => {
    const [seg, prod, prodL2, chan, chanL2, t1, t2] = k.split('|');
    return fc.calculateBaseForecast(seriesFor(k),
      { segment: seg, product: prod, productL2: prodL2, channel: chan, channelL2: chanL2,
        tariffL1: t1, tariffL2: t2, scenario: 'Base Case' }, 1000, 12, 1.0, 1.5, 3, 'Holt Linear');
  };

  // ── A REAL generated book: every Corporate leaf fitted ──────────────────
  const CORP_KEY = fc.makeForecastKey('Corporate', 'All', 'All', 'All', 'All', 'All', 'All');
  const store = new Map<string, any>();
  for (const k of leafMap.get(CORP_KEY) ?? []) { const bf = fit(k); if (bf) store.set(k, bf); }
  check('PREMISE: the Corporate scope produced fitted leaves',
    store.size > 10, `${store.size}`);

  const resolve = (key: string) => fc.resolveFromStore(store, leafMap, key);

  /** A ViewFilter for a 7-part key, so selections can be named by key. */
  const filterOf = (key: string) => {
    const [segment, p1, p2, c1, c2, t1, t2] = key.split('|');
    return { segment, product: { l1: p1 === 'All' ? null : p1, l2: p2 === 'All' ? null : p2 },
             channel: { l1: c1 === 'All' ? null : c1, l2: c2 === 'All' ? null : c2 },
             tariff:  { l1: t1 === 'All' ? null : t1, l2: t2 === 'All' ? null : t2 } };
  };

  // The leaf whose forecast used to be shown against Corporate's history.
  const KEEP_LAST_LEAF = [...store.keys()].find(k =>
    k.startsWith('Corporate|Mobile Voice|High Value|Direct|Call Centre'));
  check('PREMISE: the leaf from the reported defect is in the store', !!KEEP_LAST_LEAF,
    'the 33.69 leaf is gone — this spec no longer reproduces the reported case');

  // ── THE TRANSITION, driven through the real helper ──────────────────────
  {
    // Start where a manual generate leaves the user: on a leaf.
    const atLeaf = vf.forecastForStep1Selection(filterOf(KEEP_LAST_LEAF!), resolve);
    check('TRANSITION: a generated leaf resolves to its own fit',
      !!atLeaf.forecast && atLeaf.key === KEEP_LAST_LEAF, atLeaf.key);
    const leafArpu = (atLeaf.forecast as any).months[0].arpu.mean;

    // NOW CHANGE THE SELECTION — the act keep-last ignored.
    const atCorp = vf.forecastForStep1Selection(filterOf(CORP_KEY), resolve);
    check('TRANSITION: changing the selection resolves the NEW selection',
      !!atCorp.forecast && atCorp.key === CORP_KEY, atCorp.key);
    const corpArpu = (atCorp.forecast as any).months[0].arpu.mean;

    check('TRANSITION: and the forecast actually CHANGED',
      Math.abs(corpArpu - leafArpu) > 1,
      `leaf ${leafArpu} vs aggregate ${corpArpu} — keep-last would leave these equal`);
    check('TRANSITION: the widened selection derives, it is not a stored fit',
      (atCorp.forecast as any).provenance.kind === 'derived',
      (atCorp.forecast as any).provenance.kind);

    // A SELECTION THAT RESOLVES TO NOTHING. The honest null, with its reason —
    // not the previous cohort's numbers under a new label.
    const emptyStore = new Map<string, any>();
    const miss = vf.forecastForStep1Selection(filterOf(KEEP_LAST_LEAF!),
      (key: string) => fc.resolveFromStore(emptyStore, leafMap, key));
    check('TRANSITION: a selection that resolves to nothing yields NULL',
      miss.forecast === null,
      'the previous forecast survived a miss — keep-last, exactly');
    check('TRANSITION: and the miss carries a reason from the shared enum',
      miss.reason === 'insufficient-history' || miss.reason === 'never-enumerated',
      String(miss.reason));

    // RESELECT the generated leaf: it must come back. Retiring keep-last must
    // not mean losing generated work.
    const back = vf.forecastForStep1Selection(filterOf(KEEP_LAST_LEAF!), resolve);
    check('TRANSITION: reselecting the generated leaf returns its forecast',
      !!back.forecast && (back.forecast as any).months[0].arpu.mean === leafArpu,
      'a generated leaf did not come back — generation was lost, not just unshown');
  }

  // ── THE PAIRING: both halves of the ARPU chart, from ONE key ────────────
  //
  // The history half of arpuChartData sums raw rows matching the selection; the
  // forecast half is baseForecast.months. This asserts they describe the same
  // population, which is the property the defect broke.
  {
    const histFor = (key: string) => {
      const [segment, p1, , c1] = key.split('|');
      const acc = new Map<string, { rev: number; vol: number }>();
      for (const r of rows) {
        if (segment !== 'All' && v(r, C.seg) !== segment) continue;
        if (p1 !== 'All' && v(r, C.prod) !== p1) continue;
        if (c1 !== 'All' && v(r, C.chan) !== c1) continue;
        const m = mo(r);
        const e = acc.get(m) ?? { rev: 0, vol: 0 };
        e.vol += Number(r[C.val]) || 0; e.rev += Number(r[C.rev]) || 0;
        acc.set(m, e);
      }
      const last = [...acc.keys()].sort().pop()!;
      const e = acc.get(last)!;
      return e.vol > 0 ? e.rev / e.vol : 0;
    };

    const sel = vf.forecastForStep1Selection(filterOf(CORP_KEY), resolve);
    const forecastArpu = (sel.forecast as any).months[0].arpu.mean;
    const historyArpu = histFor(CORP_KEY);

    check('PAIRING: both halves resolve from the SAME key',
      sel.key === CORP_KEY, `${sel.key} vs ${CORP_KEY}`);
    // CONTINUITY is the observable form of "one population". The reported
    // defect showed 17.34 history against a 33.69 forecast — a 94% step at the
    // boundary between two lines presented as one series.
    check('PAIRING: the forecast is continuous with the history it is drawn beside',
      Math.abs(forecastArpu - historyArpu) / historyArpu < 0.10,
      `history ${historyArpu.toFixed(2)} vs forecast ${forecastArpu.toFixed(2)}`);
    check('PAIRING: and the reported 33.69 is nowhere near it',
      Math.abs(forecastArpu - 33.69) > 10,
      `forecast is ${forecastArpu.toFixed(2)} — the keep-last leaf is back`);

    // ANTI-VACUITY. The keep-last pairing must be genuinely detectable, or the
    // continuity check above would pass for any chart at all.
    const keepLastArpu = (store.get(KEEP_LAST_LEAF!) as any).months[0].arpu.mean;
    check('PAIRING CONTROL: the OLD behaviour would fail this check',
      Math.abs(keepLastArpu - historyArpu) / historyArpu > 0.10,
      `keep-last ${keepLastArpu.toFixed(2)} vs history ${historyArpu.toFixed(2)} — indistinguishable, so the check proves nothing`);
  }

  // ── THE OTHER DOOR: leaving Step 1 and coming back ──────────────────────
  //
  // Found by the gate, not by the walk, and it reproduces the same defect. Step
  // 2 and Step 3 REASSIGN baseForecast for their own filters, and
  // `forecastForView` returns owns:false for 'standard' — so nothing restores
  // Step 1 on the way back. A selection-change-only fix leaves the user with
  // Step 1's dropdowns reading one cohort and its chart drawing another's
  // forecast: the two-population defect, reached by a different door.
  //
  // This models the effect's ref protocol against the real helper. It is the
  // weaker of the two halves and says so — the wiring block below reads the
  // actual guard, because the protocol lives in an effect that cannot be driven
  // headlessly here.
  {
    // DRIVEN, not modelled. The first version of this block re-implemented the
    // effect's ref protocol here and applied it to the real helper — and the
    // gate said plainly that a spec re-implementing the rule it checks measures
    // its own copy. So the decision moved into `step1ResolveDecision` and this
    // calls it.
    const D = (prev: string | null, view: string, key: string) =>
      vf.step1ResolveDecision(prev, view, key);
    const CORP = vf.filterToKey(filterOf(CORP_KEY));
    const LEAF = vf.filterToKey(filterOf(KEEP_LAST_LEAF!));

    // Arriving for the first time must resolve NOTHING, or a session import is
    // wiped on arrival by the very effect meant to keep the screen honest.
    const first = D(null, 'standard', CORP);
    check('RETURN: the first observation of Step 1 resolves nothing',
      first.resolve === false && first.next === CORP,
      `resolve=${first.resolve}`);

    // Standing still resolves nothing either.
    const still = D(CORP, 'standard', CORP);
    check('RETURN: standing on the same selection resolves nothing',
      still.resolve === false, 'the effect re-resolves on every render');

    // Changing the selection resolves — the first door.
    const moved = D(CORP, 'standard', LEAF);
    check('RETURN: changing the selection resolves', moved.resolve === true
      && moved.next === LEAF, `resolve=${moved.resolve}`);

    // Leaving marks AWAY rather than a key, so the return is detectable at all.
    const left = D(CORP, 'whatif', CORP);
    check('RETURN: leaving Step 1 records that it was left',
      left.resolve === false && left.next === vf.STEP1_AWAY, left.next);

    // THE SECOND DOOR: back on Step 1 with the SAME selection. Steps 2 and 3
    // reassign baseForecast for their own filters and forecastForView returns
    // owns:false for 'standard', so nothing else restores Step 1.
    // CHAINED from what leaving actually produced, not from a hardcoded AWAY.
    // Passing the sentinel in by hand would make this check insensitive to the
    // leave step — it would keep passing while leaving stopped recording
    // anything, which is exactly the mutation guard-trap 46 plants.
    const back = D(left.next, 'standard', CORP);
    check('RETURN: coming back re-resolves even with the selection unchanged',
      back.resolve === true && back.next === CORP,
      'Step 1 keeps whatever forecast another step left behind');

    // And what it then shows is Step 1's own selection, continuous with its
    // own history — driven through the real helper and the real store.
    const shown = vf.forecastForStep1Selection(filterOf(CORP_KEY), resolve).forecast;
    check("RETURN: and what it shows is the selection's own forecast",
      !!shown && (shown as any).provenance.kind === 'derived'
        && Math.abs((shown as any).months[0].arpu.mean - 17.34) < 2,
      `showing ${(shown as any)?.months?.[0]?.arpu?.mean}`);
  }

  // ── THE WIRING: App must actually drive the transition ──────────────────
  // The checks above drive the helper. They cannot see whether App calls it on
  // a selection change — that is state plumbing in an effect, so it is read at
  // its source. Neither half covers the other.
  {
    const app = fs.readFileSync('src/App.tsx', 'utf8');
    const stripped = app.replace(/\/\/[^\n]*/g, '');
    // The PROTOCOL is driven above, against step1ResolveDecision. What is left
    // to read here is only what cannot be extracted: that the effect consults
    // the decision, writes the ref back, and resolves when told to. These went
    // RED when the decision moved out of the effect — which is the pin working,
    // not breaking.
    check('WIRING: the effect consults the shared decision',
      /const d = step1ResolveDecision\(lastStdSelectionKey\.current, activeView, stdSelectionKey\);/.test(stripped),
      'Step 1 decides for itself again — there are two protocols');
    check('WIRING: it writes the decision back to the ref',
      /lastStdSelectionKey\.current = d\.next;/.test(stripped),
      'the ref never advances, so every render looks like the first');
    check('WIRING: and resolves only when the decision says to',
      /if \(d\.resolve\) showStep1Selection\(stdSelectionFilter\);/.test(stripped),
      'the effect resolves unconditionally, or not at all');
    check('WIRING: the handler routes through the extracted helper',
      /forecastForStep1Selection\(selection, resolveForecast\)/.test(stripped),
      'Step 1 resolves by some other means — there are two resolvers again');
    check('WIRING: and assigns the result including null',
      !/const \{ forecast \} = forecastForStep1Selection[\s\S]{0,120}?if \(!forecast\) return;/.test(stripped),
      'an early return on a miss is keep-last');
  }

  console.log(`step1-selection spec: ${pass} passed, ${fails.length} failed`);
  fails.forEach(f => console.log('  FAIL ' + f));
  process.exit(fails.length ? 1 : 0);
}

main().catch(e => { console.error(e); process.exit(1); });

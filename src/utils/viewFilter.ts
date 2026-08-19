/**
 * The ViewFilter <-> cohort-key round trip, extracted so it can be DRIVEN.
 *
 * Both of these lived as closures inside App. That was fine until a spec needed
 * to exercise a NAVIGATION SEQUENCE — restore, then Step 3, then Step 1, then
 * Step 3 again — where each step resolves a different filter into a key. A spec
 * cannot reach an App closure, so the only way to test the sequence was to
 * transcribe the conversion into the spec. This codebase has been bitten by
 * exactly that often enough to have a rule about it: a transcribed copy pins
 * itself, not the app.
 *
 * They are pure, they have no React dependency, and App now delegates.
 */
import type { ViewFilter } from '../components/ViewFilterBar';
import { makeForecastKey } from './forecasting';

/** A cohort as the forecast store holds it — 'All' meaning unconstrained. */
export type CohortLike = {
  segment: string;
  product: string;
  productL2?: string;
  channel: string;
  channelL2?: string;
  tariffL1?: string;
  tariffL2?: string;
};

/**
 * Build a forecast key from a ViewFilter.
 *
 * Note the asymmetry with `cohortToFilter`, which is deliberate and not a bug:
 * segment passes through verbatim (the filter bar stores 'All' as the string
 * 'All'), while product/channel/tariff store null for unconstrained and are
 * defaulted here. Changing either side alone breaks the round trip.
 */
export function filterToKey(f: ViewFilter): string {
  return makeForecastKey(
    f.segment,
    f.product.l1 || 'All',
    f.product.l2,
    f.channel.l1 || 'All',
    f.channel.l2,
    f.tariff?.l1,
    f.tariff?.l2,
  );
}

/**
 * A selection named the way the user chose it, for the bulk confirm header.
 *
 * Only narrowed dimensions appear. 'All' is the ABSENCE of a constraint, not a
 * value worth reading back: "Corporate" is what the user picked, "Corporate /
 * All / All / All / All / All" is what the key happens to look like. When
 * nothing is narrowed the scope is everything, and `allLabel` says so rather
 * than the caller rendering an empty header.
 *
 * The two encodings BOTH mean aggregated and must both be dropped: `segment`
 * carries the literal string 'All', while the L1/L2 pairs carry null. A filter
 * that discarded only one of them would name a scope the run does not have.
 *
 * Pure and exported deliberately. It lived inline in App as a useCallback and a
 * gate could only READ it — "traced against the two known encodings" was the
 * weakest evidence in that report. A label the user is asked to confirm a
 * 74-leaf run against should be exercisable, so now it is.
 */
export function describeScope(f: ViewFilter, allLabel: string): string {
  const parts = [f.segment, f.product.l1, f.product.l2, f.channel.l1,
                 f.channel.l2, f.tariff?.l1, f.tariff?.l2]
    .filter((v): v is string => !!v && v !== 'All');
  return parts.length ? parts.join(' / ') : allLabel;
}

/** The inverse: a stored cohort as a ViewFilter, 'All' becoming null. */
/** The scope dimensions a filter can offer, as trees. */
export interface ScopeDimTrees {
  segments: string[];
  productTree: Map<string, string[]>;
  channelTree: Map<string, string[]>;
  tariffTree: Map<string, string[]>;
}

/** One file's three event arrays, as raw sheet rows. */
export interface EventCarriers {
  marketEvents?: any[];
  yieldEvents?: any[];
  pricingEvents?: any[];
}

/**
 * WHICH COLUMNS EACH CARRIER USES FOR ITS SCOPE.
 *
 * The three sheets do NOT agree: market events write `Channel`, while yield
 * and pricing write `Channel_L1`. Yield carries no Product_L2 and no tariff
 * dimensions at all, because YieldEvent has none — a dimension a carrier lacks
 * contributes NOTHING here. That is absence, not an error, and it must not
 * become an undefined creeping into an option list.
 *
 * Declared as data rather than three near-identical loops so adding a carrier
 * is one row, and so the differences between them are visible in one place
 * instead of being spread across code that looks the same but is not.
 */
const CARRIER_SCOPE_COLUMNS: {
  key: keyof EventCarriers;
  segment: string; product: string; productL2?: string;
  channel: string; channelL2?: string;
  tariffL1?: string; tariffL2?: string;
}[] = [
  { key: 'marketEvents',  segment: 'Segment', product: 'Product', productL2: 'Product_L2',
    channel: 'Channel',    channelL2: 'Channel_L2', tariffL1: 'Tariff_L1', tariffL2: 'Tariff_L2' },
  { key: 'yieldEvents',   segment: 'Segment', product: 'Product',
    channel: 'Channel_L1', channelL2: 'Channel_L2' },
  { key: 'pricingEvents', segment: 'Segment', product: 'Product', productL2: 'Product_L2',
    channel: 'Channel_L1', channelL2: 'Channel_L2', tariffL1: 'Tariff_L1', tariffL2: 'Tariff_L2' },
];

/**
 * THE SCOPE VALUES THE LOADED FILES ACTUALLY USE — across ALL THREE carriers.
 *
 * Scenario Compare's dimension filter read `marketEvents` alone, so a product
 * that appeared only on a pricing or yield event was missing from the list and
 * could not be selected: Jon's files offered Mobile Data and Fixed Connectivity
 * (both market-scoped) but not Mobile Voice, which existed only on a pricing
 * event. The filter described one carrier and claimed to describe the events.
 *
 * `'All'` IS EXCLUDED from the options. It is the CLEAR state of the control,
 * not a value a user picks from a list — offering it twice, once as the empty
 * selection and once as an item, would make the same choice mean two things.
 *
 * EXTRACTED so it can be driven directly. It was an inline `useMemo` in the
 * component, which is exactly the shape that cannot be tested without a mount
 * — and this defect shipped because nothing could reach it.
 */
export function collectEventScopeDims(sessions: EventCarriers[]): ScopeDimTrees {
  const segs = new Set<string>();
  const productTree = new Map<string, Set<string>>();
  const channelTree = new Map<string, Set<string>>();
  const tariffTree = new Map<string, Set<string>>();

  const val = (row: any, col?: string): string | null => {
    if (!col) return null;
    const v = row?.[col];
    if (v === undefined || v === null) return null;
    const str = String(v).trim();
    return str === '' || str === 'All' ? null : str;
  };

  const addTree = (tree: Map<string, Set<string>>, l1: string | null, l2: string | null) => {
    if (!l1) return;
    if (!tree.has(l1)) tree.set(l1, new Set());
    if (l2) tree.get(l1)!.add(l2);
  };

  for (const session of sessions ?? []) {
    for (const carrier of CARRIER_SCOPE_COLUMNS) {
      for (const row of (session?.[carrier.key] ?? [])) {
        const seg = val(row, carrier.segment);
        if (seg) segs.add(seg);
        addTree(productTree, val(row, carrier.product), val(row, carrier.productL2));
        addTree(channelTree, val(row, carrier.channel), val(row, carrier.channelL2));
        addTree(tariffTree, val(row, carrier.tariffL1), val(row, carrier.tariffL2));
      }
    }
  }

  const flatten = (tree: Map<string, Set<string>>) => {
    const out = new Map<string, string[]>();
    for (const [l1, l2s] of tree.entries()) out.set(l1, Array.from(l2s).sort());
    return out;
  };

  return {
    segments: Array.from(segs).sort(),
    productTree: flatten(productTree),
    channelTree: flatten(channelTree),
    tariffTree: flatten(tariffTree),
  };
}

/** Does any loaded file carry an event on ANY carrier? Drives the fallback to
 *  the baseline dimensions, and reads all three for the same reason the
 *  populate does: a file with only pricing events HAS events. */
export function hasAnyCarrierEvents(sessions: EventCarriers[]): boolean {
  return (sessions ?? []).some(s =>
    (s?.marketEvents?.length ?? 0) > 0
    || (s?.yieldEvents?.length ?? 0) > 0
    || (s?.pricingEvents?.length ?? 0) > 0);
}

export function cohortToFilter(c: CohortLike): ViewFilter {
  return {
    segment: c.segment,
    product: { l1: c.product === 'All' ? null : c.product,
               l2: c.productL2 && c.productL2 !== 'All' ? c.productL2 : null },
    channel: { l1: c.channel === 'All' ? null : c.channel,
               l2: c.channelL2 && c.channelL2 !== 'All' ? c.channelL2 : null },
    tariff:  { l1: c.tariffL1 && c.tariffL1 !== 'All' ? c.tariffL1 : null,
               l2: c.tariffL2 && c.tariffL2 !== 'All' ? c.tariffL2 : null },
  };
}

/**
 * Which forecast a tab should show when it becomes active.
 *
 * This is the tab-switch effect's whole body, extracted so a spec can DRIVE the
 * transition rather than model it. The first version of the Step 3 tripwire
 * modelled it, and a planted break in the real effect left all four navigation
 * sequences green - only a structural source check noticed. A tripwire that
 * cannot see the thing it watches is the defect it exists to catch.
 *
 * Returns null for views that do not own a forecast, which is not the same as
 * 'nothing resolved': the caller must not treat those alike.
 */
/**
 * What Step 1 should show for a selection — the transition, as a function.
 *
 * Keep-last was retired on 2026-08-09 (Jon, option 1 of three): a Step 1
 * selection change now resolves through the seam exactly as Steps 2 and 3 do,
 * and the RESULT is what gets shown, **null included**.
 *
 * The null is the whole decision. Returning early on a miss is what keep-last
 * did, and it left the previous cohort's numbers on screen under a changed
 * label — measured at Segment=Corporate as a history of 17.05-17.83 drawn
 * beside a forecast of 33.69 belonging to one Mobile Voice / Direct leaf.
 *
 * Extracted rather than inlined for the reason `forecastForView` was, one
 * function below: a transition that lives only inside a component effect can be
 * modelled by a spec but not DRIVEN by one, and a spec that models the
 * transition it is checking will agree with itself no matter what the app does.
 * Both App and the pairing spec call this, so the guard-trap that replants
 * keep-last has something a mounted assertion can actually feel.
 */
/** Step 1 has been visited and left. Not a key: every real key has seven parts. */
export const STEP1_AWAY = ' away';

/**
 * WHETHER Step 1 should re-resolve, given where it was and where it is.
 *
 * The companion to `forecastForStep1Selection`, which answers *what* to show.
 * Extracted for the same reason and after the same lesson: the first version of
 * this lived only inside App's effect, so the spec re-implemented the protocol
 * in order to test it — and a spec that re-implements the rule it is checking
 * measures its own copy. The gate said so plainly, which is why this is now a
 * function both callers share.
 *
 * Three ref states, and each earns its place:
 *   null      never observed — record and resolve NOTHING, so a mount or a
 *             session import keeps the forecast the restore just put there
 *   a key     been here — resolve only when the selection actually changed
 *   AWAY      left and came back — resolve even if the selection is unchanged,
 *             because Steps 2 and 3 reassign baseForecast for their own filters
 *             and `forecastForView` returns owns:false for 'standard'
 */
export function step1ResolveDecision(
  prev: string | null,
  view: string,
  key: string,
): { resolve: boolean; next: string } {
  if (view !== 'standard') return { resolve: false, next: STEP1_AWAY };
  if (prev === null) return { resolve: false, next: key };
  // No `returning` flag, deliberately. The first version carried one and it was
  // DEAD: AWAY can never equal a real key, so the equality below already fails
  // on a return and the flag changed nothing. Guard-trap 46 found it by staying
  // green on a mutation that should have hurt — which is the whole reason the
  // traps exist. The sentinel alone is what makes a return resolve, so the
  // sentinel is what trap 46 now attacks.
  if (prev === key) return { resolve: false, next: prev };
  return { resolve: true, next: key };
}

export function forecastForStep1Selection(
  selection: ViewFilter,
  resolve: (key: string) => { forecast: unknown | null; reason?: unknown },
): { key: string; forecast: unknown | null; reason: unknown } {
  const key = filterToKey(selection);
  const r = resolve(key);
  return { key, forecast: r.forecast, reason: r.reason ?? null };
}

export function forecastForView(
  view: string,
  step2Filter: ViewFilter,
  step3Filter: ViewFilter,
  resolve: (key: string) => { forecast: unknown | null },
): { owns: boolean; forecast: unknown | null } {
  if (view === 'whatif') return { owns: true, forecast: resolve(filterToKey(step2Filter)).forecast };
  if (view === 'vsactuals') return { owns: true, forecast: resolve(filterToKey(step3Filter)).forecast };
  return { owns: false, forecast: null };
}

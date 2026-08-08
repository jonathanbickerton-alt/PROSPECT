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

/** The inverse: a stored cohort as a ViewFilter, 'All' becoming null. */
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

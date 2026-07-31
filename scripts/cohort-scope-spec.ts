/**
 * Spec for the shared cohort-scoping predicate.
 *
 *   npm run spec:scope
 *
 * Every case here mirrors a guard that exists in the code today, so this is the
 * evidence that swapping a site to the shared predicate preserves behaviour —
 * written BEFORE any site is converted, so it describes current behaviour rather
 * than being fitted to the refactor afterwards.
 */
import { rowInScope, cohortInScope, ALL_DIMS, L1_ONLY, dimsFromGrouping,
         type ScopeCols, type CohortScope } from '../src/utils/cohortScope';

const COLS: ScopeCols = {
  segment: 'Customer_Segment', product: 'Product_L1', productL2: 'Product_L2_Value_Tier',
  channel: 'Channel_Level_1', channelL2: 'Channel_Level_2',
  tariffL1: 'tariff_tier_l1', tariffL2: 'tariff_tier_l2',
};
const ROW = {
  Customer_Segment: 'Corporate', Product_L1: 'Mobile Voice', Product_L2_Value_Tier: 'Premium',
  Channel_Level_1: 'Direct', Channel_Level_2: 'Inside Sales',
  tariff_tier_l1: 'RED S', tariff_tier_l2: 'SIM-only',
};

let pass = 0; const fails: string[] = [];
const check = (name: string, got: boolean, want: boolean) => {
  if (got === want) pass++; else fails.push(`${name}: got ${got}, expected ${want}`);
};

// ── rowInScope ────────────────────────────────────────────────────────────
check('exact 7-field match', rowInScope(ROW, COLS, {
  segment: 'Corporate', product: 'Mobile Voice', productL2: 'Premium',
  channel: 'Direct', channelL2: 'Inside Sales', tariffL1: 'RED S', tariffL2: 'SIM-only',
}, ALL_DIMS), true);

check('wrong segment excludes', rowInScope(ROW, COLS, { segment: 'SME' }, ALL_DIMS), false);
check('wrong tariff excludes', rowInScope(ROW, COLS, { tariffL1: 'RED XL' }, ALL_DIMS), false);

// THE +97.7% DEFECT. A RED S scope must not admit a RED XL row.
check('tariff guard: RED S scope rejects RED XL row',
  rowInScope({ ...ROW, tariff_tier_l1: 'RED XL' }, COLS, { tariffL1: 'RED S' }, ALL_DIMS), false);

check("'All' scope is a wildcard", rowInScope(ROW, COLS, { tariffL1: 'All' }, ALL_DIMS), true);
check('absent scope field is a wildcard', rowInScope(ROW, COLS, { segment: 'Corporate' }, ALL_DIMS), true);
check('whitespace is trimmed both sides',
  rowInScope({ ...ROW, tariff_tier_l1: '  RED S  ' }, COLS, { tariffL1: 'RED S ' }, ALL_DIMS), true);

// Unmapped column must never exclude — a file with no tariff column behaves as before tariff existed.
check('unmapped tariff column does not exclude',
  rowInScope(ROW, { segment: COLS.segment, product: COLS.product, channel: COLS.channel },
    { segment: 'Corporate', tariffL1: 'RED XL' }, ALL_DIMS), true);

// L1_ONLY — broadAggrSnapshotMap's setting.
check('L1_ONLY ignores a non-matching productL2',
  rowInScope(ROW, COLS, { product: 'Mobile Voice', productL2: 'Value' }, L1_ONLY), true);
check('L1_ONLY ignores a non-matching tariff',
  rowInScope(ROW, COLS, { tariffL1: 'RED XL' }, L1_ONLY), true);
check('L1_ONLY still enforces L1 product',
  rowInScope(ROW, COLS, { product: 'Mobile Data' }, L1_ONLY), false);
check('L1_ONLY still enforces segment',
  rowInScope(ROW, COLS, { segment: 'MNC' }, L1_ONLY), false);

// Per-dimension gating.
check('tariffL1 disabled ignores tariff, channelL2 enabled still binds',
  rowInScope(ROW, COLS, { tariffL1: 'RED XL', channelL2: 'Inside Sales' },
    { ...ALL_DIMS, tariffL1: false }), true);
check('channelL2 disabled ignores channelL2',
  rowInScope(ROW, COLS, { channelL2: 'Digital Direct' },
    { ...ALL_DIMS, channelL2: false }), true);

// ── cohortInScope ─────────────────────────────────────────────────────────
const COHORT: CohortScope = {
  segment: 'Corporate', product: 'Mobile Voice', productL2: 'All',
  channel: 'Direct', channelL2: 'All', tariffL1: 'RED S', tariffL2: 'All',
};

check('cohort exact match', cohortInScope(COHORT, { segment: 'Corporate', tariffL1: 'RED S' }, ALL_DIMS), true);
check('cohort wrong tariff', cohortInScope(COHORT, { tariffL1: 'RED M' }, ALL_DIMS), false);
check('cohort wildcard scope matches', cohortInScope(COHORT, { tariffL1: 'All' }, ALL_DIMS), true);

// An 'All'-tariff forecast is NOT a RED S forecast. This is summaryMape's tarMatch.
check("candidate 'All' does not satisfy a specific scope",
  cohortInScope({ ...COHORT, tariffL1: 'All' }, { tariffL1: 'RED S' }, ALL_DIMS), false);
check('missing candidate field is treated as All',
  cohortInScope({ segment: 'Corporate' }, { tariffL1: 'RED S' }, ALL_DIMS), false);
check('L1_ONLY cohort ignores tariff mismatch',
  cohortInScope(COHORT, { tariffL1: 'RED M' }, L1_ONLY), true);

// ── dimsFromGrouping ──────────────────────────────────────────────────────
const d = dimsFromGrouping({ tariffL1: true });
check('dimsFromGrouping enables only what is grouped',
  d.tariffL1 && !d.productL2 && !d.channelL2 && !d.tariffL2, true);

// ── report ────────────────────────────────────────────────────────────────
console.log(`cohortScope spec: ${pass} passed, ${fails.length} failed`);
fails.forEach(f => console.log('  FAIL ' + f));
process.exit(fails.length ? 1 : 0);

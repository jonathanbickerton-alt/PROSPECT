/**
 * THE cohort-scoping predicate.
 *
 * Six to eight sites independently decided "does this row / cohort belong in
 * this scope?". Adding a dimension meant editing all of them, and they drifted:
 * the tariff dimension was added to some and not others, producing the +97.7%
 * MAPE defect (ForecastVsActualsTab.tsx:1607), summaryMape's missing tarMatch,
 * and broadAggrSnapshotMap's tariff blindness — three occurrences of one bug.
 *
 * The differences between sites are real and must be expressed as ARGUMENTS,
 * not as separate implementations:
 *
 *   - broadAggrSnapshotMap is the BROAD denominator. It deliberately ignores L2
 *     (scoping it to all seven fields collapses every share toward 1 and
 *     destroys the band-scaling it exists to perform). It passes L1_ONLY.
 *   - Everything else scopes on whichever dimensions the view is grouped by.
 *
 * Two entry points because the sites genuinely differ in shape: some filter raw
 * data rows by mapped column name, others compare two already-parsed cohort
 * objects. Containment ("is scope A broader than scope B") is a different
 * question again and deliberately does NOT live here.
 *
 * Acceptance: adding a dimension means one field on ScopeDims and one clause in
 * each entry point — not six edits across four files.
 */

/** Which optional dimensions participate. L1 product/channel and segment always do. */
export type ScopeDims = {
  productL2: boolean;
  channelL2: boolean;
  tariffL1: boolean;
  tariffL2: boolean;
};

/** Every dimension participates — the default for a fully-specified cohort. */
export const ALL_DIMS: ScopeDims = { productL2: true, channelL2: true, tariffL1: true, tariffL2: true };

/** L1 only. broadAggrSnapshotMap's setting, and the reason ScopeDims exists. */
export const L1_ONLY: ScopeDims = { productL2: false, channelL2: false, tariffL1: false, tariffL2: false };

/** A cohort scope. Any absent or 'All' field is a wildcard that matches anything. */
export type CohortScope = {
  segment?: string | null;
  product?: string | null;
  productL2?: string | null;
  channel?: string | null;
  channelL2?: string | null;
  tariffL1?: string | null;
  tariffL2?: string | null;
};

/** Mapped column names for the raw-row entry point. Empty/undefined = not mapped. */
export type ScopeCols = {
  segment?: string;
  product?: string;
  productL2?: string;
  channel?: string;
  channelL2?: string;
  tariffL1?: string;
  tariffL2?: string;
};

/** A scope value that constrains nothing. Matches the existing guards' `!v || v === 'All'`. */
const isWildcard = (v: string | null | undefined): boolean => !v || v === 'All';

const norm = (v: unknown): string => String(v ?? '').trim();

type Field = keyof CohortScope;

/** Field order, with the ScopeDims flag gating each optional one. */
const FIELDS: { field: Field; dim: keyof ScopeDims | null }[] = [
  { field: 'segment',   dim: null },
  { field: 'product',   dim: null },
  { field: 'productL2', dim: 'productL2' },
  { field: 'channel',   dim: null },
  { field: 'channelL2', dim: 'channelL2' },
  { field: 'tariffL1',  dim: 'tariffL1' },
  { field: 'tariffL2',  dim: 'tariffL2' },
];

/**
 * Does a raw data row fall inside `scope`?
 *
 * A dimension constrains only when its column is MAPPED, the dimension is
 * enabled in `dims`, and the scope value is not a wildcard — exactly the shape
 * of the existing guards, e.g.
 *
 *   if (wiTariffL1Col && cohort.tariffL1 && cohort.tariffL1 !== 'All' &&
 *       String(row[wiTariffL1Col]).trim() !== cohort.tariffL1.trim()) return false;
 *
 * An unmapped column never excludes a row, so a file with no tariff column
 * behaves exactly as it did before tariff existed.
 */
export function rowInScope(
  row: Record<string, unknown>,
  cols: ScopeCols,
  scope: CohortScope,
  dims: ScopeDims,
): boolean {
  for (const { field, dim } of FIELDS) {
    if (dim && !dims[dim]) continue;
    const col = cols[field];
    if (!col) continue;
    const want = scope[field];
    if (isWildcard(want)) continue;
    if (norm(row[col]) !== norm(want)) return false;
  }
  return true;
}

/**
 * Does one cohort fall inside `scope`?
 *
 * Wildcards on the SCOPE side match anything, mirroring rowInScope. A wildcard
 * on the CANDIDATE side is a real value ('All' means an aggregate cohort) and
 * must equal the scope's value to match — an 'All'-tariff forecast is not a
 * RED S forecast.
 */
export function cohortInScope(
  candidate: CohortScope,
  scope: CohortScope,
  dims: ScopeDims,
): boolean {
  for (const { field, dim } of FIELDS) {
    if (dim && !dims[dim]) continue;
    const want = scope[field];
    if (isWildcard(want)) continue;
    if (norm(candidate[field] ?? 'All') !== norm(want)) return false;
  }
  return true;
}

/** Build ScopeDims from the view's group-by checkboxes. */
export function dimsFromGrouping(g: {
  productL2?: boolean; channelL2?: boolean; tariffL1?: boolean; tariffL2?: boolean;
}): ScopeDims {
  return {
    productL2: !!g.productL2,
    channelL2: !!g.channelL2,
    tariffL1: !!g.tariffL1,
    tariffL2: !!g.tariffL2,
  };
}

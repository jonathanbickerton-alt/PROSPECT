/**
 * Constrained mix engine — Alessandro's promotion-card mix mode, the pure half.
 *
 * A "mix" is a set of MEMBERS (value bands today; the 10-15-slider tariff axis
 * is V2 and deliberately not designed for here) each carrying a SHARE, plus a
 * per-member ARPU. The blend is the share-weighted ARPU. The card lets a user
 * type a TARGET blend, and the sliders are then constrained to what is actually
 * reachable — see the settled semantics in test-data/EXPECTED.md, "SETTLED:
 * constrained mix mode, not input-vs-target".
 *
 * WHAT THIS MODULE IS FOR. Every function here is pure and total: no throw, no
 * NaN escape, no reliance on component state. The card's interaction layer is a
 * separate session; nothing here decides what a click does.
 *
 * THE INVARIANT: shares sum to MIX_TOTAL, ENFORCED AT WRITE.
 *
 * "At write" is load-bearing and is the existing convention rather than a new
 * one — seedMixPreserving already normalises to 100 and has its last member
 * absorb the float residual. So:
 *
 *   - the WRITE functions (rebalance, solveForTarget) never return a share
 *     vector that fails conformsToTotal. That is asserted, not hoped for;
 *   - the READ functions (blendedArpu, achievableTargetRange) describe whatever
 *     they are given, conforming or not, and never reject.
 *
 * Read-side tolerance is not laxity. A restored promoMix can legitimately fail
 * to sum to 100 — a legacy save, or a tier list that changed shape under a
 * preserved mix — which is exactly why the card carries an amber sum indicator.
 * A read that refused to describe a non-conforming mix would blank the one
 * display that tells the user their mix needs attention.
 *
 * ABSENCE, and why it is a return value rather than a default. An absent mix is
 * NOT an empty mix — the import round-trip settled that distinction and this
 * module honours it. A mix with no members, a member whose ARPU is unknown, or
 * a locked set that over-subscribes the total are all states where the honest
 * answer is "no value", never zero. A diluting zero here would read as a real,
 * very low blend and silently drag a target into range that is not reachable.
 */

/** The fixed total shares conserve. Percentage points, matching promoMix's
 *  stored units and the card's 0-100 sliders. */
export const MIX_TOTAL = 100;

/** Conservation tolerance. Shares are produced by residual-absorbing
 *  arithmetic, so the only slack needed is float representation. */
const EPS_TOTAL = 1e-9;
/** Drag-solver tolerance. Looser than EPS_TOTAL because the least-squares
 *  solve accumulates float error across a 2x2 inverse; still far tighter than
 *  a penny, which is the unit any of this is displayed in. */
const EPS_DRAG = 1e-9;

/** Reachability tolerance on the ARPU scale. Applied relative to the interval
 *  being tested so a target sitting exactly on a bound is reachable rather than
 *  rejected by the last bit of a division. */
const EPS_REACH = 1e-9;

/**
 * Every outcome below discriminates on a STRING `kind`, not a boolean `ok`.
 * That is a compiler constraint, not a style preference: this repo's tsconfig
 * sets no `strict`, so `strictNullChecks` is off, and under it TypeScript does
 * not narrow a union by a boolean literal discriminant. The first draft used
 * `ok: true | false` and every single read of `.reason` was a type error, in
 * the module and in the spec alike. Measured rather than assumed — a two-line
 * probe compiled under this exact tsconfig showed the boolean form failing and
 * the string form narrowing cleanly.
 */
/**
 * `detail` strings on every blocked outcome below are DIAGNOSTIC ONLY and are
 * never rendered. The card branches on `reason` and renders its own keyed copy
 * through `t()`, in all six locales; nothing puts `detail` on screen, verified
 * by grep across `src/components/` and `src/App.tsx`.
 *
 * Stated because the i18n scanner flags them as must-key and a future reader
 * would otherwise have to re-derive whether that is a real gap. It is not — but
 * the moment one of these is rendered, it becomes one.
 */
export type MixBlockReason =
  /** No members. An absent mix, which is not the same claim as an empty one. */
  | 'no-members'
  /** A listed member has a missing or non-finite share. */
  | 'malformed-shares'
  /** A member that carries share has no finite ARPU, so no blend exists. */
  | 'arpu-unknown'
  /** Locked shares already exceed MIX_TOTAL; nothing is left to balance with. */
  | 'locks-oversubscribed'
  /** Constraints leave a single reachable blend — the collapsed-range case that
   *  the settled semantics say must lock its slider rather than offer movement
   *  that cannot happen. */
  | 'range-collapsed'
  /** The shares do not total MIX_TOTAL and no unlocked member is free to absorb
   *  the difference, so the invariant cannot be restored without moving a
   *  slider the user has held. Refusing is the only honest answer: silently
   *  breaking a padlock and silently breaking the total are both worse. */
  | 'cannot-conserve'
  /** Target above the highest reachable blend. */
  | 'above-max'
  /** Target below the lowest reachable blend. */
  | 'below-min';

/** The binding constraint, NAMED — the settled semantics require an unreachable
 *  target to say what stopped it, not merely that it stopped. `member` is the
 *  free member whose ARPU forms the bound, or null when the bound comes from
 *  there being no free members at all. */
export interface MixBinding {
  bound: number;
  member: string | null;
}

export interface AchievableRange {
  /** Lowest reachable blend given the locks. */
  min: number;
  /** Highest reachable blend given the locks. */
  max: number;
  /** min === max: the constraints determine a single blend. */
  collapsed: boolean;
  /** Free member whose ARPU sets `min` / `max`; null when nothing is free. */
  lowMember: string | null;
  highMember: string | null;
  /** Share still available to the unlocked members. */
  freeBudget: number;
}

export type RangeOutcome =
  | { kind: 'ok'; range: AchievableRange }
  | { kind: 'blocked'; reason: MixBlockReason; detail: string };

export type SolveOutcome =
  | { kind: 'ok'; shares: Record<string, number>; blend: number }
  | { kind: 'blocked'; reason: MixBlockReason; detail: string; binding?: MixBinding };

export type RebalanceOutcome =
  | {
      kind: 'ok';
      shares: Record<string, number>;
      /** What the moved member actually got. Differs from the requested value
       *  when locks left less room than was asked for. */
      appliedShare: number;
      clamped: boolean;
    }
  | { kind: 'blocked'; reason: MixBlockReason; detail: string };

// ---------------------------------------------------------------------------
// Shared reading of the inputs
// ---------------------------------------------------------------------------

/**
 * Validated view of a mix. Every entry point reads its inputs through this, so
 * "what counts as malformed" is defined once. A second copy of these checks is
 * how two entry points come to disagree about whether a mix is usable.
 */
interface MixView {
  members: string[];
  shares: Record<string, number>;
  locked: string[];
  free: string[];
  lockedSum: number;
  freeBudget: number;
}

function readMix(
  members: readonly string[],
  shares: Readonly<Record<string, number>>,
  locked: readonly string[],
): MixView | { reason: MixBlockReason; detail: string } {
  const list = members.filter(m => typeof m === 'string' && m.length > 0);
  if (list.length === 0) return { reason: 'no-members', detail: 'the mix has no members' };

  const read: Record<string, number> = {};
  for (const m of list) {
    const v = shares?.[m];
    if (typeof v !== 'number' || !Number.isFinite(v)) {
      return { reason: 'malformed-shares', detail: `member "${m}" has no finite share` };
    }
    // Negative shares are not clamped silently: a negative share is not a small
    // share, and repairing it here would hide whatever produced it.
    if (v < 0) {
      return { reason: 'malformed-shares', detail: `member "${m}" has a negative share (${v})` };
    }
    read[m] = v;
  }

  const lockedList = list.filter(m => locked.includes(m));
  const freeList = list.filter(m => !lockedList.includes(m));
  const lockedSum = lockedList.reduce((s, m) => s + read[m], 0);

  if (lockedSum > MIX_TOTAL + EPS_TOTAL) {
    return {
      reason: 'locks-oversubscribed',
      detail: `locked shares total ${lockedSum} against a fixed ${MIX_TOTAL}`,
    };
  }

  return {
    members: list,
    shares: read,
    locked: lockedList,
    free: freeList,
    lockedSum,
    freeBudget: Math.max(0, MIX_TOTAL - lockedSum),
  };
}

function isView(x: MixView | { reason: MixBlockReason }): x is MixView {
  return (x as MixView).members !== undefined;
}

/** Finite ARPU for a member, or null. Absent is a return value here for the
 *  same reason it is everywhere else in this module: `?? 0` would make an
 *  unknown-ARPU member look like a free member with a very cheap tariff. */
function arpuOf(perMemberArpus: Readonly<Record<string, number>>, member: string): number | null {
  const a = perMemberArpus?.[member];
  return typeof a === 'number' && Number.isFinite(a) ? a : null;
}

/**
 * The enforcement point named in the module docstring — every write path exits
 * through it, and returns null rather than a mix that fails the invariant.
 *
 * `absorber` is the member that takes the float residual so the total reads
 * exactly MIX_TOTAL. It must be an UNLOCKED member: an earlier draft always
 * used the last listed member, which meant the repair could move a slider the
 * user had padlocked. Pass null when nothing is free to move, in which case
 * this only validates — a mix that does not already conform cannot be repaired
 * without breaking a lock, and is refused instead.
 *
 * It VALIDATES on the way out rather than trusting the arithmetic, and there is
 * exactly one exit so that validation cannot be routed around. An earlier draft
 * clamped a negative absorber to zero and returned — which keeps that one member
 * sane and abandons conservation everywhere else, a silent invariant break
 * dressed as a safety check. It returned ok with a mix summing to 1e12.
 *
 * That draft also carried a second, separate early return for the negative case.
 * Guard-trap 53 was aimed at it and MISSED, because no caller can reach it: both
 * write paths bound their non-absorber members below MIX_TOTAL by construction.
 * A defensive branch no input can drive is a check that runs never, so it was
 * folded into the single validated exit below, which the null-absorber case does
 * reach — same protection for a future third caller, one live path instead of
 * one live and one dead.
 */
function conserve(
  members: string[],
  shares: Record<string, number>,
  absorber: string | null,
): Record<string, number> | null {
  const out = { ...shares };
  if (absorber !== null) {
    const rest = members.filter(m => m !== absorber).reduce((s, m) => s + (out[m] ?? 0), 0);
    const residual = MIX_TOTAL - rest;
    out[absorber] = residual > 0 ? residual : 0;
  }
  return conformsToTotal(members, out) ? out : null;
}

/** Does a share vector satisfy the invariant? Exported so callers can assert it
 *  at a boundary rather than re-deriving the tolerance. */
export function conformsToTotal(
  members: readonly string[],
  shares: Readonly<Record<string, number>>,
): boolean {
  if (members.length === 0) return false;
  let sum = 0;
  for (const m of members) {
    const v = shares?.[m];
    if (typeof v !== 'number' || !Number.isFinite(v) || v < 0) return false;
    sum += v;
  }
  return Math.abs(sum - MIX_TOTAL) <= EPS_TOTAL;
}

// ---------------------------------------------------------------------------
// blendedArpu — the live blend
// ---------------------------------------------------------------------------

/**
 * Share-weighted ARPU: Σ (share / MIX_TOTAL) × arpu. Never an average of the
 * member ARPUs — a mean would answer "what does a band cost" when the question
 * is "what does this mix cost", and the two coincide only on an even mix.
 *
 * Returns null when the blend is genuinely not determined: no members, a
 * malformed share, or a member that carries share and has no known ARPU. A
 * member sitting at zero share needs no ARPU, because it contributes nothing
 * whatever its ARPU turns out to be — refusing to blend there would be absence
 * theatre rather than absence.
 *
 * The domain is the keys of `shares`, so this describes exactly the mix it was
 * handed. It does NOT require conformsToTotal: this is a read, and a restored
 * mix that does not sum to 100 still has a blend worth showing. Callers wanting
 * the invariant should assert it themselves and say so on screen.
 *
 * Agrees exactly with forecasting.ts's blendTierMix on every mix that has a
 * known ARPU for each member carrying share — pinned by spec, because two
 * blends that drift apart is the defect this comment exists to prevent. They
 * differ only where blendTierMix substitutes 0 for an unknown ARPU and this
 * reports absence; collapsing them is a display-layer change and belongs with
 * the card, not here.
 */
export function blendedArpu(
  shares: Readonly<Record<string, number>>,
  perMemberArpus: Readonly<Record<string, number>>,
): number | null {
  const members = Object.keys(shares ?? {});
  if (members.length === 0) return null;

  let sum = 0;
  for (const m of members) {
    const s = shares[m];
    if (typeof s !== 'number' || !Number.isFinite(s)) return null;
    if (s === 0) continue;
    const a = arpuOf(perMemberArpus, m);
    if (a === null) return null;
    sum += (s / MIX_TOTAL) * a;
  }
  return sum;
}

// ---------------------------------------------------------------------------
// achievableTargetRange — what a typed target may be
// ---------------------------------------------------------------------------

/**
 * The interval of target blends reachable while the locked members hold their
 * shares and the unlocked ones absorb the rest.
 *
 * The reasoning is short enough to state: the locked members contribute a fixed
 * amount, and the unlocked ones divide a fixed freeBudget between them. The sum
 * Σ s·arpu over a simplex {s ≥ 0, Σ s = freeBudget} is linear, so it takes its
 * extremes at the vertices — all of the budget on the cheapest free member, or
 * all of it on the dearest. Nothing between those is unreachable, and nothing
 * outside them is reachable. That is the whole computation.
 *
 * With no locks the answer collapses to [min arpu, max arpu], which is the
 * sanity check to reach for: free sliders can blend to any member ARPU and to
 * anything between, and to nothing beyond.
 *
 * A collapsed range (every member locked, or no free budget, or every free
 * member on the same ARPU) is returned as ok with collapsed: true, NOT as a
 * failure. The settled semantics say a collapsed range locks its slider, which
 * is a thing the UI does with a known single value — it needs the value.
 */
export function achievableTargetRange(
  members: readonly string[],
  shares: Readonly<Record<string, number>>,
  locked: readonly string[],
  perMemberArpus: Readonly<Record<string, number>>,
): RangeOutcome {
  const view = readMix(members, shares, locked);
  if (!isView(view)) return { kind: 'blocked', reason: view.reason, detail: view.detail };

  let lockedContribution = 0;
  for (const m of view.locked) {
    if (view.shares[m] === 0) continue;
    const a = arpuOf(perMemberArpus, m);
    if (a === null) {
      return { kind: 'blocked', reason: 'arpu-unknown', detail: `locked member "${m}" has no ARPU` };
    }
    lockedContribution += view.shares[m] * a;
  }

  // No free member can move anything: the blend is whatever the locks say.
  if (view.free.length === 0 || view.freeBudget <= EPS_TOTAL) {
    const only = lockedContribution / MIX_TOTAL;
    return {
      kind: 'ok',
      range: {
        min: only, max: only, collapsed: true,
        lowMember: null, highMember: null,
        freeBudget: view.freeBudget,
      },
    };
  }

  let lowMember = view.free[0];
  let highMember = view.free[0];
  let lowA: number | null = null;
  let highA: number | null = null;
  for (const m of view.free) {
    const a = arpuOf(perMemberArpus, m);
    if (a === null) {
      return { kind: 'blocked', reason: 'arpu-unknown', detail: `free member "${m}" has no ARPU` };
    }
    // Strict comparisons keep ties on the FIRST member in the caller's order,
    // so the bound a user is shown does not shuffle between renders.
    if (lowA === null || a < lowA) { lowA = a; lowMember = m; }
    if (highA === null || a > highA) { highA = a; highMember = m; }
  }

  const min = (lockedContribution + view.freeBudget * (lowA as number)) / MIX_TOTAL;
  const max = (lockedContribution + view.freeBudget * (highA as number)) / MIX_TOTAL;

  return {
    kind: 'ok',
    range: {
      min, max,
      collapsed: max - min <= EPS_REACH * Math.max(1, Math.abs(max)),
      lowMember, highMember,
      freeBudget: view.freeBudget,
    },
  };
}

// ---------------------------------------------------------------------------
// rebalance — a slider moved
// ---------------------------------------------------------------------------

/**
 * Deterministic reallocation after one member is moved to `newShare`: locked
 * members hold, the moved member takes what it asked for (as far as the locks
 * allow), and the remaining unlocked members absorb the difference in
 * proportion to what they already held. The total is conserved exactly.
 *
 * WHAT THIS DOES NOT DO, deliberately: it does not add `movedMember` to the
 * locked set. The moved member is held FOR THIS OPERATION — it must be, since
 * you cannot rebalance around a value you are also rebalancing — and that is a
 * different thing from a padlock that persists to the next interaction.
 * Whether moving a slider auto-locks it is recorded in EXPECTED.md as the one
 * detail still open with Alessandro, under a do-not-build guard. Keeping the
 * lock set an input rather than an output means this engine is correct under
 * either answer and settles neither.
 *
 * With an empty `locked` this reduces exactly to the shipped autoBalanceMix,
 * which the spec pins against the real function rather than a copy of it.
 */
export function rebalance(
  members: readonly string[],
  shares: Readonly<Record<string, number>>,
  locked: readonly string[],
  movedMember: string,
  newShare: number,
): RebalanceOutcome {
  const view = readMix(members, shares, locked);
  if (!isView(view)) return { kind: 'blocked', reason: view.reason, detail: view.detail };

  if (!view.members.includes(movedMember)) {
    return { kind: 'blocked', reason: 'malformed-shares', detail: `"${movedMember}" is not a member` };
  }
  if (typeof newShare !== 'number' || !Number.isFinite(newShare)) {
    return { kind: 'blocked', reason: 'malformed-shares', detail: 'the requested share is not finite' };
  }
  if (view.locked.includes(movedMember)) {
    return { kind: 'blocked', reason: 'range-collapsed', detail: `"${movedMember}" is locked` };
  }

  // Room the moved member actually has: the total, less what the padlocks hold.
  const lockedElsewhere = view.locked.reduce((s, m) => s + view.shares[m], 0);
  const ceiling = Math.max(0, MIX_TOTAL - lockedElsewhere);
  const applied = Math.min(ceiling, Math.max(0, newShare));
  const clamped = Math.abs(applied - newShare) > EPS_TOTAL;

  const others = view.free.filter(m => m !== movedMember);
  const next: Record<string, number> = { ...view.shares, [movedMember]: applied };
  const remaining = ceiling - applied;

  if (others.length > 0) {
    const otherSum = others.reduce((s, m) => s + view.shares[m], 0);
    let allocated = 0;
    others.forEach((m, i) => {
      if (i === others.length - 1) {
        next[m] = Math.max(0, remaining - allocated);
        return;
      }
      // An all-zero remainder has no proportions to preserve, so it splits
      // evenly — the only choice that treats the members alike.
      const share = otherSum === 0
        ? remaining / others.length
        : Math.max(0, (view.shares[m] / otherSum) * remaining);
      next[m] = share;
      allocated += share;
    });
  }

  // The residual goes to the last unlocked member that is not the one being
  // moved, so neither a padlock nor the user's own drag is quietly overwritten.
  // With no such member the arithmetic above is already exact and this only
  // validates.
  const conserved = conserve(view.members, next, others.length ? others[others.length - 1] : null);
  if (conserved === null) {
    return {
      kind: 'blocked', reason: 'cannot-conserve',
      detail: 'the locked shares leave no member free to restore the total',
    };
  }
  return { kind: 'ok', shares: conserved, appliedShare: applied, clamped };
}

// ---------------------------------------------------------------------------
// solveForTarget — a target typed
// ---------------------------------------------------------------------------

/**
 * Shares achieving `targetArpu` with the locks held, or a named binding
 * constraint saying why no such shares exist.
 *
 * THE THREE-BAND CASE IS EXACTLY DETERMINED and that is not an accident of the
 * method: with three members and one locked, two free shares face two equations
 * — they sum to the free budget, and they blend to the target — so there is one
 * answer and nothing to recommend between. The design record says as much, and
 * the spec verifies this function's answer against the closed form rather than
 * against itself.
 *
 * With more than two free members the system is underdetermined and a rule is
 * needed. This one moves the CURRENT free shares toward the single vertex that
 * the target is heading for — all the budget on the dearest free member when
 * raising the blend, on the cheapest when lowering — stopping at the point that
 * hits the target exactly:
 *
 *     s = (1 - lambda) * s_current + lambda * vertex
 *
 * It is deterministic, it is continuous in the target (a small retype moves the
 * sliders a small amount rather than jumping), it holds every share at or above
 * zero, and with two free members it degenerates to the unique answer, because
 * the whole feasible set is then the segment the interpolation runs along.
 *
 * The multi-slider tariff axis is V2 and is where this rule earns or loses its
 * place; the value axis never exercises the underdetermined branch. Recorded so
 * the V2 design pass knows it is inheriting a choice rather than a derivation.
 *
 * Goal-seek-as-recommendation stays out of scope: this answers "can the target
 * be hit, and with what", never "which reachable target is the good one".
 */
export function solveForTarget(
  members: readonly string[],
  shares: Readonly<Record<string, number>>,
  locked: readonly string[],
  perMemberArpus: Readonly<Record<string, number>>,
  targetArpu: number,
): SolveOutcome {
  const view = readMix(members, shares, locked);
  if (!isView(view)) return { kind: 'blocked', reason: view.reason, detail: view.detail };

  if (typeof targetArpu !== 'number' || !Number.isFinite(targetArpu)) {
    return { kind: 'blocked', reason: 'malformed-shares', detail: 'the target is not a finite number' };
  }

  const ranged = achievableTargetRange(members, shares, locked, perMemberArpus);
  if (ranged.kind === 'blocked') return { kind: 'blocked', reason: ranged.reason, detail: ranged.detail };
  const { min, max, collapsed, lowMember, highMember, freeBudget } = ranged.range;

  const tol = EPS_REACH * Math.max(1, Math.abs(min), Math.abs(max));

  if (collapsed) {
    if (Math.abs(targetArpu - min) <= tol) {
      // Already there, and nothing may move. Validate rather than repair: with
      // every member held there is no unlocked share to absorb a residual, so a
      // non-conforming mix here is reported, not silently rewritten over a
      // padlock.
      const held = conserve(view.members, { ...view.shares }, null);
      if (held === null) {
        return {
          kind: 'blocked', reason: 'cannot-conserve',
          detail: `the mix is at the target but does not total ${MIX_TOTAL}, and every member is held`,
        };
      }
      return { kind: 'ok', shares: held, blend: min };
    }
    return {
      kind: 'blocked',
      reason: 'range-collapsed',
      detail: `the locks determine a single blend of ${min}; ${targetArpu} is not it`,
      binding: { bound: min, member: null },
    };
  }
  if (targetArpu > max + tol) {
    return {
      kind: 'blocked', reason: 'above-max',
      detail: `the highest reachable blend is ${max}, set by "${highMember}"`,
      binding: { bound: max, member: highMember },
    };
  }
  if (targetArpu < min - tol) {
    return {
      kind: 'blocked', reason: 'below-min',
      detail: `the lowest reachable blend is ${min}, set by "${lowMember}"`,
      binding: { bound: min, member: lowMember },
    };
  }

  // Current free shares, scaled to the free budget. A caller's mix that does
  // not conform is rescaled rather than refused, for the read-side reason in
  // the module docstring; the RESULT conforms regardless.
  const freeSumNow = view.free.reduce((s, m) => s + view.shares[m], 0);
  const start: Record<string, number> = {};
  for (const m of view.free) {
    start[m] = freeSumNow > 0
      ? (view.shares[m] / freeSumNow) * freeBudget
      : freeBudget / view.free.length;
  }

  let lockedContribution = 0;
  for (const m of view.locked) {
    if (view.shares[m] === 0) continue;
    lockedContribution += view.shares[m] * (arpuOf(perMemberArpus, m) as number);
  }

  const needed = targetArpu * MIX_TOTAL - lockedContribution;
  const c0 = view.free.reduce((s, m) => s + start[m] * (arpuOf(perMemberArpus, m) as number), 0);

  const next: Record<string, number> = { ...view.shares };
  const gap = needed - c0;

  if (Math.abs(gap) > tol * MIX_TOTAL) {
    const vertexMember = (gap > 0 ? highMember : lowMember) as string;
    const cVertex = freeBudget * (arpuOf(perMemberArpus, vertexMember) as number);
    const span = cVertex - c0;
    // span === 0 with a non-zero gap cannot happen: the range check above has
    // already established the target is inside [min, max], and c0 lies inside
    // that interval too, so the vertex the gap points at is strictly past it.
    const lambda = span === 0 ? 0 : Math.min(1, Math.max(0, gap / span));
    for (const m of view.free) {
      next[m] = (1 - lambda) * start[m] + lambda * (m === vertexMember ? freeBudget : 0);
    }
  } else {
    for (const m of view.free) next[m] = start[m];
  }

  // Free members were rescaled to freeBudget above, so the locked side is never
  // touched — the residual is absorbed on the free side, by construction.
  const conserved = conserve(view.members, next, view.free[view.free.length - 1]);
  if (conserved === null) {
    return {
      kind: 'blocked', reason: 'cannot-conserve',
      detail: 'the solved shares could not be restored to the total without breaking a lock',
    };
  }
  const blend = blendedArpu(conserved, perMemberArpus);
  if (blend === null) {
    // Unreachable in practice — every member carrying share has been shown to
    // have an ARPU by achievableTargetRange. Handled rather than asserted so
    // the function stays total under any future edit to that ordering.
    return { kind: 'blocked', reason: 'arpu-unknown', detail: 'the solved mix has no blend' };
  }
  return { kind: 'ok', shares: conserved, blend };
}

// ---------------------------------------------------------------------------
// rebalanceToTarget — a drag that holds the target
// ---------------------------------------------------------------------------

/** Which end of the reachable interval a drag ran into. */
export interface DragWall {
  /** 'max' when the drag was pushing the moved share up, 'min' when down. */
  bound: 'min' | 'max';
  /** The free member whose ARPU forms the wall, or null when the wall comes
   *  from the budget rather than from a rate. */
  member: string | null;
  /** The share the moved member was clamped to. */
  clampedShare: number;
}

export type DragOutcome =
  | { kind: 'ok'; shares: Record<string, number>; appliedShare: number; wall: null }
  /** The drag was stopped: `shares` are the solved mix AT the wall, so the
   *  target is still held. `wall` says where it stopped and why. */
  | { kind: 'wall'; shares: Record<string, number>; appliedShare: number; wall: DragWall }
  | { kind: 'blocked'; reason: MixBlockReason; detail: string };

/**
 * A DRAG THAT SATISFIES THE SUM **AND BLEND** EQUATIONS.
 *
 * `rebalance` conserves the total and nothing else, because it is given neither
 * the target nor the per-member rates — it cannot hold a blend, and that is its
 * signature rather than a defect. Its no-target callers are unchanged and it is
 * not widened here; this is a SIBLING, called only when a target is applied.
 *
 * WHY IT EXISTS. The settled entry says a drag is "exactly determined by the
 * sum and blend equations", and the implementation satisfied the sum only:
 * measured 2026-09-04, a target of 23.93 became a blend of 21.385325 on both
 * cards the moment a slider moved. See EXPECTED.md, "SUPPLEMENT: THE DRAG
 * ITSELF".
 *
 * THE ARITHMETIC, stated because it is short and the shape decides the design.
 * With the moved member at x, the untouched unlocked members must satisfy
 *
 *     sum si      = R(x) = freeBudget - x                          (the sum)
 *     sum si * ai = B(x) = 100*target - lockedArpu - x*aM          (the blend)
 *
 * Both are LINEAR in x. For non-negative shares summing to R, the reachable
 * blend contribution is exactly [R*minA, R*maxA] — all of the budget on the
 * cheapest free member, or all on the dearest, the same vertex argument
 * `achievableTargetRange` makes. So feasibility in x is an INTERVAL, and THE
 * WALL IS ITS ENDPOINT. That is what makes decision 2 computable rather than a
 * guess: the clamp point is derived, not chosen.
 *
 * ONE SOLVE PATH, NOT TWO. With two untouched members the two equations
 * determine the answer uniquely, and a minimum-change solve returns exactly
 * that unique point — so the "exactly determined" case is not special-cased, it
 * is the degenerate case of the general one. Fewer paths, and no risk of the
 * two disagreeing at the boundary.
 *
 * MINIMUM CHANGE IS NOT A RECOMMENDATION. Where the equations leave freedom the
 * solver takes the NEAREST reachable point to where the sliders already are.
 * Goal-seek-as-recommendation stays out of scope: choosing the closest point
 * adds no opinion about which reachable mix is good, and any other rule would.
 */
export function rebalanceToTarget(
  members: readonly string[],
  shares: Readonly<Record<string, number>>,
  locked: readonly string[],
  perMemberArpus: Readonly<Record<string, number>>,
  targetArpu: number,
  movedMember: string,
  newShare: number,
): DragOutcome {
  const view = readMix(members, shares, locked);
  if (!isView(view)) return { kind: 'blocked', reason: view.reason, detail: view.detail };

  if (!view.members.includes(movedMember)) {
    return { kind: 'blocked', reason: 'malformed-shares', detail: `"${movedMember}" is not a member` };
  }
  if (typeof newShare !== 'number' || !Number.isFinite(newShare)) {
    return { kind: 'blocked', reason: 'malformed-shares', detail: 'the requested share is not finite' };
  }
  if (typeof targetArpu !== 'number' || !Number.isFinite(targetArpu)) {
    return { kind: 'blocked', reason: 'malformed-shares', detail: 'the target is not finite' };
  }
  if (view.locked.includes(movedMember)) {
    return { kind: 'blocked', reason: 'range-collapsed', detail: `"${movedMember}" is locked` };
  }
  // EVERY member needs a rate, not just the free ones: the locked members'
  // contribution is part of the blend equation's constant term.
  for (const m of view.members) {
    const a = perMemberArpus[m];
    if (typeof a !== 'number' || !Number.isFinite(a)) {
      return { kind: 'blocked', reason: 'arpu-unknown', detail: `"${m}" has no finite ARPU` };
    }
  }

  const others = view.free.filter(m => m !== movedMember);
  const lockedShare = view.locked.reduce((s, m) => s + view.shares[m], 0);
  const lockedArpu = view.locked.reduce((s, m) => s + view.shares[m] * perMemberArpus[m], 0);
  const freeBudget = MIX_TOTAL - lockedShare;
  if (freeBudget < -EPS_DRAG) {
    return { kind: 'blocked', reason: 'locks-oversubscribed', detail: `locks hold ${lockedShare}` };
  }

  const aM = perMemberArpus[movedMember];
  const rates = others.map(m => perMemberArpus[m]);
  const minA = rates.length ? Math.min(...rates) : 0;
  const maxA = rates.length ? Math.max(...rates) : 0;
  const K = MIX_TOTAL * targetArpu - lockedArpu;

  let lo = 0;
  let hi = freeBudget;
  let loMember: string | null = null;
  let hiMember: string | null = null;
  let infeasible = false;

  if (others.length === 0) {
    // Nothing may flex. The blend is whatever the locks and the moved member
    // make it, so exactly ONE position holds the target — the interval is a
    // point, and every drag clamps to it.
    if (Math.abs(aM) < EPS_DRAG) {
      return { kind: 'blocked', reason: 'range-collapsed', detail: 'no free member can move the blend' };
    }
    const only = K / aM;
    if (only < -EPS_DRAG || only > freeBudget + EPS_DRAG) infeasible = true;
    lo = hi = Math.min(freeBudget, Math.max(0, only));
  } else {
    const lowMem = others[rates.indexOf(minA)] ?? null;
    const highMem = others[rates.indexOf(maxA)] ?? null;
    // B - R*minA >= 0  =>  x*(minA - aM) >= freeBudget*minA - K
    const c1 = minA - aM;
    const r1 = freeBudget * minA - K;
    if (Math.abs(c1) < EPS_DRAG) { if (r1 > EPS_DRAG) infeasible = true; }
    else if (c1 > 0) { const b = r1 / c1; if (b > lo) { lo = b; loMember = lowMem; } }
    else { const b = r1 / c1; if (b < hi) { hi = b; hiMember = lowMem; } }
    // R*maxA - B >= 0  =>  x*(aM - maxA) >= K - freeBudget*maxA
    const c2 = aM - maxA;
    const r2 = K - freeBudget * maxA;
    if (Math.abs(c2) < EPS_DRAG) { if (r2 > EPS_DRAG) infeasible = true; }
    else if (c2 > 0) { const b = r2 / c2; if (b > lo) { lo = b; loMember = highMem; } }
    else { const b = r2 / c2; if (b < hi) { hi = b; hiMember = highMem; } }
  }

  if (infeasible || lo > hi + EPS_DRAG) {
    return {
      kind: 'blocked',
      reason: 'range-collapsed',
      detail: 'no position of this slider holds the target',
    };
  }

  const requested = newShare;
  const applied = Math.min(hi, Math.max(lo, requested));
  const hitWall = Math.abs(applied - requested) > EPS_DRAG;

  const R = freeBudget - applied;
  const B = K - applied * aM;
  const current = others.map(m => view.shares[m]);
  const solved = minimumChange(current, rates, R, B);
  if (!solved) {
    return { kind: 'blocked', reason: 'cannot-conserve', detail: 'no non-negative mix satisfies both equations' };
  }

  const next: Record<string, number> = { ...view.shares, [movedMember]: applied };
  others.forEach((m, i) => { next[m] = solved[i]; });

  if (!hitWall) return { kind: 'ok', shares: next, appliedShare: applied, wall: null };
  const bound: 'min' | 'max' = requested > applied ? 'max' : 'min';
  return {
    kind: 'wall',
    shares: next,
    appliedShare: applied,
    wall: { bound, member: bound === 'max' ? hiMember : loMember, clampedShare: applied },
  };
}

/**
 * The nearest non-negative vector to `current` with sum s = R and sum s*a = B.
 *
 * Least squares under two equality constraints has a closed form via Lagrange
 * multipliers; non-negativity is then imposed by an ACTIVE SET loop — solve,
 * pin whatever went most negative to zero, re-solve on the rest. That
 * terminates in at most one pass per member and is deterministic, which matters
 * more here than optimality at the corners: two runs of the same drag must
 * agree, every time, or the control is not predictable.
 *
 * Returns null when no non-negative solution exists. The caller has already
 * restricted the moved share to the feasible interval, so that is a guard
 * rather than an expected path.
 */
function minimumChange(
  current: readonly number[],
  rates: readonly number[],
  R: number,
  B: number,
): number[] | null {
  const n = current.length;
  if (n === 0) return Math.abs(R) < EPS_DRAG && Math.abs(B) < EPS_DRAG ? [] : null;

  const pinned = new Array<boolean>(n).fill(false);
  for (let pass = 0; pass <= n; pass++) {
    const idx: number[] = [];
    for (let i = 0; i < n; i++) if (!pinned[i]) idx.push(i);
    if (idx.length === 0) return null;

    // s = c + alpha*1 + beta*a, giving two equations in alpha and beta.
    const k = idx.length;
    const sumA = idx.reduce((s, i) => s + rates[i], 0);
    const sumAA = idx.reduce((s, i) => s + rates[i] * rates[i], 0);
    const sumC = idx.reduce((s, i) => s + current[i], 0);
    const sumCA = idx.reduce((s, i) => s + current[i] * rates[i], 0);
    const d1 = R - sumC;
    const d2 = B - sumCA;
    const det = k * sumAA - sumA * sumA;

    let alpha: number;
    let beta: number;
    if (Math.abs(det) < 1e-12) {
      // Every free member carries the SAME rate, so the blend equation is a
      // multiple of the sum equation. Consistent only if the two agree; when
      // they do the sum equation alone decides and beta is zero.
      if (Math.abs(d2 - (sumA / k) * d1) > 1e-6) return null;
      alpha = d1 / k;
      beta = 0;
    } else {
      alpha = (d1 * sumAA - d2 * sumA) / det;
      beta = (d2 * k - d1 * sumA) / det;
    }

    const out = new Array<number>(n).fill(0);
    let worst = -1;
    let worstVal = 0;
    for (const i of idx) {
      const v = current[i] + alpha + beta * rates[i];
      out[i] = v;
      if (v < -EPS_DRAG && v < worstVal) { worstVal = v; worst = i; }
    }
    if (worst === -1) {
      // Float dust cleaned so a caller's conformsToTotal check is not decided
      // by 1e-17.
      for (let i = 0; i < n; i++) if (Math.abs(out[i]) < EPS_DRAG) out[i] = 0;
      return out;
    }
    pinned[worst] = true;
  }
  return null;
}

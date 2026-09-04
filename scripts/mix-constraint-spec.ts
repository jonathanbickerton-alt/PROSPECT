/**
 * THE CONSTRAINED MIX ENGINE — Alessandro's promotion-card mix mode, engine half.
 *
 *   npm run spec:mix-constraint
 *
 * Pins the pure functions in src/utils/mixConstraint.ts against the settled
 * semantics recorded in test-data/EXPECTED.md ("SETTLED: constrained mix mode,
 * not input-vs-target"): a typed target constrains the sliders to achievable
 * ranges, moving one rebalances the rest deterministically, padlocks hold,
 * unreachable targets are flagged with the binding constraint named, a collapsed
 * range locks, and the three-band value axis is exactly determined.
 *
 * WHAT THIS SPEC IS CAREFUL ABOUT, and why each one is here:
 *
 *  - IT DOES NOT MEASURE ITS AUTHOR'S GUESS ABOUT THE APP. The equivalence check
 *    drives the REAL shipped autoBalanceMix out of WhatIfTab, not a copy of it
 *    pasted in here. A reference copy in a spec is how two implementations drift
 *    while both look verified.
 *  - IT PINS COUNTS, NOT PRESENCE. The vacuous-result trap: "some case was
 *    unreachable" passes whether or not the engine works. Every sweep asserts
 *    how many cases it actually exercised.
 *  - IT VERIFIES THE THREE-BAND ANSWER AGAINST THE CLOSED FORM, not against
 *    another call to the function under test. A spec may not feed itself the
 *    artefact under test.
 *  - IT ASSERTS THE ABSENCE OF AN OUTPUT. The engine must NOT auto-lock the
 *    moved member: whether moving a slider auto-locks it is recorded as the one
 *    detail still open with Alessandro, under a do-not-build guard. The check
 *    that the outcome carries no lock set is what keeps that guard honest.
 */
import {
  MIX_TOTAL, conformsToTotal, blendedArpu, achievableTargetRange, rebalance, solveForTarget,
  rebalanceToTarget,
} from '../src/utils/mixConstraint';
import { blendTierMixOrNull } from '../src/utils/forecasting';
import { autoBalanceMix } from '../src/components/WhatIfTab';

let pass = 0; const fails: string[] = [];
const check = (n: string, c: boolean, d?: string) => { if (c) pass++; else fails.push(n + (d ? `  [${d}]` : '')); };
const near = (a: number, b: number, eps = 1e-9) => Math.abs(a - b) <= eps * Math.max(1, Math.abs(a), Math.abs(b));

/** Deterministic PRNG so a failing fuzz case is reproducible from the seed
 *  alone. Math.random would make a red run unrepeatable, which is the one thing
 *  a fuzz check cannot afford. */
function rng(seed: number) {
  let s = seed >>> 0;
  return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
}

// ── The three value bands. Exactly the shape the value axis ships with. ──
const BANDS = ['Low Value', 'Mid Value', 'High Value'];
const BAND_ARPU = { 'Low Value': 8, 'Mid Value': 20, 'High Value': 45 };
const EVEN = { 'Low Value': 100 / 3, 'Mid Value': 100 / 3, 'High Value': 100 - (200 / 3) };

// ---------------------------------------------------------------------------
// 0. Green-first positive control
// ---------------------------------------------------------------------------
{
  check('control: MIX_TOTAL is 100', MIX_TOTAL === 100);
  check('control: the even three-band mix conforms', conformsToTotal(BANDS, EVEN));
  check('control: a mix summing to 90 does not conform',
    !conformsToTotal(BANDS, { 'Low Value': 30, 'Mid Value': 30, 'High Value': 30 }));
}

// ---------------------------------------------------------------------------
// 1. blendedArpu — the live blend, never an average
// ---------------------------------------------------------------------------
{
  const mix = { 'Low Value': 50, 'Mid Value': 30, 'High Value': 20 };
  const got = blendedArpu(mix, BAND_ARPU);
  const expected = 0.5 * 8 + 0.3 * 20 + 0.2 * 45; // 4 + 6 + 9 = 19
  check('blend: exact share-weighted value', got !== null && near(got, expected), `${got} vs ${expected}`);
  check('blend: 19, not the 24.333 mean of the band ARPUs',
    got !== null && !near(got, (8 + 20 + 45) / 3),
    'a mean would answer a different question and coincides only on an even mix');

  // DELEGATION, not agreement. Session 1 pinned these two as equal on
  // well-formed input while they were separate implementations; session 2
  // collapsed blendTierMix into blendedArpu, so the check is now that the alias
  // really does forward. Identity rather than approximate equality is the point
  // — a re-implementation that merely agreed to 1e-9 would pass an `near` check
  // and fail this one.
  const cases = [mix, EVEN, { 'Low Value': 100, 'Mid Value': 0, 'High Value': 0 },
                 { 'Low Value': 0, 'Mid Value': 0, 'High Value': 100 }];
  let agreed = 0;
  for (const c of cases) {
    if (blendedArpu(c, BAND_ARPU) === blendTierMixOrNull(c, BAND_ARPU)) agreed++;
  }
  check('blend: blendTierMixOrNull DELEGATES — identical values on all 4 cases',
    agreed === 4, `${agreed}/4`);
  check('blend: and delegates its ABSENCE too, which is the behaviour that changed',
    blendTierMixOrNull({ 'Low Value': 50, 'Ghost': 50 }, BAND_ARPU) === null,
    'the old body returned 4 here via ?? 0 — a real, very cheap Ghost');

  check('blend: a single member at 100 is that member ARPU',
    near(blendedArpu({ 'High Value': 100 }, BAND_ARPU) as number, 45));

  // Absence, and the one place it is NOT absence.
  check('blend: absent when a member carrying share has no ARPU',
    blendedArpu({ 'Low Value': 50, 'Ghost': 50 }, BAND_ARPU) === null);
  check('blend: NOT absent when the unknown-ARPU member sits at zero share',
    near(blendedArpu({ 'Low Value': 100, 'Ghost': 0 }, BAND_ARPU) as number, 8),
    'a zero share contributes nothing whatever its ARPU turns out to be');
  check('blend: absent on an empty mix — an absent mix is not an empty one',
    blendedArpu({}, BAND_ARPU) === null);
  check('blend: absent on a NaN share', blendedArpu({ 'Low Value': NaN }, BAND_ARPU) === null);
  check('blend: describes a non-conforming mix rather than refusing it',
    near(blendedArpu({ 'Low Value': 50, 'Mid Value': 20 }, BAND_ARPU) as number, 0.5 * 8 + 0.2 * 20),
    'a restored mix that does not sum to 100 still has a blend worth showing');
}

// ---------------------------------------------------------------------------
// 2. achievableTargetRange
// ---------------------------------------------------------------------------
{
  const free = achievableTargetRange(BANDS, EVEN, [], BAND_ARPU);
  check('range: with no locks the range is [min ARPU, max ARPU]',
    free.kind === 'ok' && near(free.range.min, 8) && near(free.range.max, 45),
    free.kind === 'ok' ? `${free.range.min}..${free.range.max}` : free.reason);
  check('range: with no locks the free budget is the whole total',
    free.kind === 'ok' && free.range.freeBudget === 100);
  check('range: bounding members named', free.kind === 'ok' && free.range.lowMember === 'Low Value' && free.range.highMember === 'High Value');
  check('range: not collapsed when members differ', free.kind === 'ok' && !free.range.collapsed);

  // One band locked. High Value held at 40 contributes 40*45; the remaining 60
  // divides between Low (8) and Mid (20).
  const oneLocked = achievableTargetRange(
    BANDS, { 'Low Value': 30, 'Mid Value': 30, 'High Value': 40 }, ['High Value'], BAND_ARPU);
  check('range: one band locked narrows the interval to the closed form',
    oneLocked.kind === 'ok' && near(oneLocked.range.min, (40 * 45 + 60 * 8) / 100)
                 && near(oneLocked.range.max, (40 * 45 + 60 * 20) / 100),
    oneLocked.kind === 'ok' ? `${oneLocked.range.min}..${oneLocked.range.max}` : oneLocked.reason);
  check('range: locked band is excluded from the bounding members',
    oneLocked.kind === 'ok' && oneLocked.range.lowMember === 'Low Value' && oneLocked.range.highMember === 'Mid Value');
  check('range: free budget is the total less the locks', oneLocked.kind === 'ok' && oneLocked.range.freeBudget === 60);

  const allLocked = achievableTargetRange(BANDS, EVEN, BANDS, BAND_ARPU);
  check('range: every band locked collapses to a single blend, reported ok not failed',
    allLocked.kind === 'ok' && allLocked.range.collapsed && near(allLocked.range.min, allLocked.range.max),
    'a collapsed range locks its slider, and the UI needs the value to show');
  check('range: the collapsed value is the current blend',
    allLocked.kind === 'ok' && near(allLocked.range.min, blendedArpu(EVEN, BAND_ARPU) as number));

  const sameArpu = achievableTargetRange(BANDS, EVEN, [], { 'Low Value': 12, 'Mid Value': 12, 'High Value': 12 });
  check('range: free members that all cost the same collapse too',
    sameArpu.kind === 'ok' && sameArpu.range.collapsed && near(sameArpu.range.min, 12));

  const over = achievableTargetRange(BANDS, { 'Low Value': 60, 'Mid Value': 60, 'High Value': 0 },
    ['Low Value', 'Mid Value'], BAND_ARPU);
  check('range: locks that over-subscribe the total are refused by name',
    over.kind === 'blocked' && over.reason === 'locks-oversubscribed', over.kind === 'ok' ? 'accepted' : over.reason);

  const ghost = achievableTargetRange([...BANDS, 'Ghost'], { ...EVEN, 'Ghost': 0 }, [], BAND_ARPU);
  check('range: a free member with no ARPU is absent, never a diluting zero',
    ghost.kind === 'blocked' && ghost.reason === 'arpu-unknown',
    'a 0 default here would report a reachable min of 0 and let a target through that cannot be met');

  const tie = achievableTargetRange(BANDS, EVEN, [], { 'Low Value': 10, 'Mid Value': 10, 'High Value': 45 });
  check('range: ties keep the FIRST member in caller order, so the bound does not shuffle',
    tie.kind === 'ok' && tie.range.lowMember === 'Low Value');

  check('range: no members is absent, not an empty range',
    (() => { const r = achievableTargetRange([], {}, [], BAND_ARPU); return r.kind === 'blocked' && r.reason === 'no-members'; })());
}

// ---------------------------------------------------------------------------
// 3. rebalance — deterministic reallocation, total conserved
// ---------------------------------------------------------------------------
{
  const r = rebalance(BANDS, EVEN, [], 'Low Value', 50);
  check('rebalance: the moved member gets what it asked for', r.kind === 'ok' && near(r.shares['Low Value'], 50));
  check('rebalance: the others split the remainder in their existing proportions',
    r.kind === 'ok' && near(r.shares['Mid Value'], 25) && near(r.shares['High Value'], 25));
  check('rebalance: total conserved', r.kind === 'ok' && conformsToTotal(BANDS, r.shares));
  check('rebalance: not clamped when there was room', r.kind === 'ok' && r.clamped === false);

  // THE DO-NOT-BUILD GUARD. Moving a slider must not decide the lock state.
  check('rebalance: returns NO lock set — auto-lock is the caller\'s call, not the engine\'s',
    r.kind === 'ok' && !('locked' in r) && !('autoLocked' in r),
    'whether moving a slider auto-locks it is open with Alessandro under a do-not-build guard');

  // Locks hold.
  const held = rebalance(BANDS, { 'Low Value': 20, 'Mid Value': 30, 'High Value': 50 },
    ['High Value'], 'Low Value', 40);
  check('rebalance: a padlocked member does not move', held.kind === 'ok' && near(held.shares['High Value'], 50));
  check('rebalance: only the unlocked others absorb the change',
    held.kind === 'ok' && near(held.shares['Low Value'], 40) && near(held.shares['Mid Value'], 10));
  check('rebalance: total still conserved with a lock', held.kind === 'ok' && conformsToTotal(BANDS, held.shares));

  // Clamping: locks leave less room than was asked for.
  const clamp = rebalance(BANDS, { 'Low Value': 10, 'Mid Value': 20, 'High Value': 70 },
    ['High Value'], 'Low Value', 90);
  check('rebalance: a request beyond the room the locks leave is clamped, and says so',
    clamp.kind === 'ok' && near(clamp.shares['Low Value'], 30) && clamp.clamped === true,
    clamp.kind === 'ok' ? `${clamp.shares['Low Value']}` : clamp.reason);
  check('rebalance: clamped result still conserves the total', clamp.kind === 'ok' && conformsToTotal(BANDS, clamp.shares));
  check('rebalance: appliedShare reports what was actually taken, not what was asked',
    clamp.kind === 'ok' && near(clamp.appliedShare, 30));

  const zeros = rebalance(BANDS, { 'Low Value': 100, 'Mid Value': 0, 'High Value': 0 }, [], 'Low Value', 40);
  check('rebalance: an all-zero remainder splits evenly — the only choice treating members alike',
    zeros.kind === 'ok' && near(zeros.shares['Mid Value'], 30) && near(zeros.shares['High Value'], 30));

  const lockedMove = rebalance(BANDS, EVEN, ['Low Value'], 'Low Value', 50);
  check('rebalance: moving a padlocked member is refused by name',
    lockedMove.kind === 'blocked' && lockedMove.reason === 'range-collapsed');
  const stranger = rebalance(BANDS, EVEN, [], 'Ghost', 50);
  check('rebalance: a member not in the list is refused', stranger.kind === 'blocked' && stranger.reason === 'malformed-shares');
  const notFinite = rebalance(BANDS, EVEN, [], 'Low Value', NaN);
  check('rebalance: a non-finite request is refused rather than propagated',
    notFinite.kind === 'blocked' && notFinite.reason === 'malformed-shares');

  // ── Equivalence with the SHIPPED autoBalanceMix on the no-locks case ──
  const rand = rng(20260811);
  let compared = 0, matched = 0;
  for (let i = 0; i < 400; i++) {
    const raw = BANDS.map(() => rand() * 100);
    const sum = raw.reduce((s, v) => s + v, 0);
    const prev: Record<string, number> = {};
    BANDS.forEach((b, j) => { prev[b] = (raw[j] / sum) * 100; });
    prev[BANDS[2]] = 100 - prev[BANDS[0]] - prev[BANDS[1]];
    const moved = BANDS[Math.floor(rand() * 3)];
    const value = rand() * 100;

    const mine = rebalance(BANDS, prev, [], moved, value);
    const theirs = autoBalanceMix(prev, moved, value);
    compared++;
    if (mine.kind === 'ok' && BANDS.every(b => near(mine.shares[b], theirs[b], 1e-9))) matched++;
  }
  check('rebalance: matches the shipped autoBalanceMix on all 400 no-lock cases',
    compared === 400 && matched === 400, `${matched}/${compared} — the real function, not a copy`);

  // A tier the mix does not yet carry. The pre-collapse body wrote it in; the
  // engine calls that malformed and refuses, so autoBalanceMix seeds it before
  // delegating. Found by the stage-2 gate as a difference between the old body
  // and the new delegation, and closed rather than argued about.
  const late = autoBalanceMix({ 'Low Value': 60, 'Mid Value': 40 }, 'High Value', 20);
  check('rebalance: autoBalanceMix still accepts a tier not yet in the mix',
    near(late['High Value'], 20) && near(Object.values(late).reduce((a, b) => a + b, 0), 100),
    JSON.stringify(late));
}

// ---------------------------------------------------------------------------
// 4. solveForTarget — the three bands are exactly determined
// ---------------------------------------------------------------------------
{
  // Closed form for three bands with one locked: with sA + sB = Bf and
  // sA·aA + sB·aB = needed, sA = (needed - Bf·aB) / (aA - aB). One answer.
  const closedForm = (lockedMember: string, lockedShare: number, target: number) => {
    const freeMembers = BANDS.filter(b => b !== lockedMember);
    const [A, B] = freeMembers;
    const aA = (BAND_ARPU as Record<string, number>)[A];
    const aB = (BAND_ARPU as Record<string, number>)[B];
    const Bf = 100 - lockedShare;
    const needed = target * 100 - lockedShare * (BAND_ARPU as Record<string, number>)[lockedMember];
    const sA = (needed - Bf * aB) / (aA - aB);
    return { [A]: sA, [B]: Bf - sA, [lockedMember]: lockedShare };
  };

  const start = { 'Low Value': 30, 'Mid Value': 30, 'High Value': 40 };

  // The reachable interval here is [22.8, 30]: High Value holds 40 of the total
  // at 45, and the remaining 60 divides between Low (8) and Mid (20). The first
  // draft of this spec asserted 21 and 22 were reachable and the count check
  // caught it — the spec was measuring its author's arithmetic rather than the
  // engine's. Pinned below so the mistake stays fixed rather than remembered.
  const REACHABLE = [23, 24, 26, 28, 29, 30];
  const belowFloor = solveForTarget(BANDS, start, ['High Value'], BAND_ARPU, 22);
  check('solve: 22 is BELOW the 22.8 floor this configuration allows',
    belowFloor.kind === 'blocked' && belowFloor.reason === 'below-min',
    'the floor is set by the cheapest FREE member, not by the cheapest member');

  let determined = 0, agreedWithClosedForm = 0;
  for (const target of REACHABLE) {
    const s = solveForTarget(BANDS, start, ['High Value'], BAND_ARPU, target);
    if (s.kind === 'blocked') continue;
    determined++;
    const cf = closedForm('High Value', 40, target);
    if (BANDS.every(b => near(s.shares[b], cf[b], 1e-9))) agreedWithClosedForm++;
  }
  check('solve: all 6 three-band targets resolved', determined === 6, `${determined}/6`);
  check('solve: every answer equals the CLOSED FORM, so it is the only answer, not a choice',
    agreedWithClosedForm === 6, `${agreedWithClosedForm}/6`);

  let hit = 0, conforms = 0;
  for (const target of REACHABLE) {
    const s = solveForTarget(BANDS, start, ['High Value'], BAND_ARPU, target);
    if (s.kind === 'blocked') continue;
    if (near(s.blend, target, 1e-9)) hit++;
    if (conformsToTotal(BANDS, s.shares)) conforms++;
    if (near(blendedArpu(s.shares, BAND_ARPU) as number, target, 1e-9)) { /* round trip */ } else { hit = -99; }
  }
  check('solve: the solved mix actually blends to the target, re-measured through blendedArpu',
    hit === 6, `${hit}/6`);
  check('solve: INVARIANT ENFORCED AT WRITE — every solved mix conforms to the total',
    conforms === 6, `${conforms}/6`);

  // Unreachable, with the binding constraint NAMED — flagged before interaction.
  const above = solveForTarget(BANDS, start, ['High Value'], BAND_ARPU, 40);
  check('solve: a target above the reachable maximum is refused', above.kind === 'blocked' && above.reason === 'above-max');
  check('solve: and names the member forming the bound',
    above.kind === 'blocked' && above.binding?.member === 'Mid Value' && near(above.binding.bound, (40 * 45 + 60 * 20) / 100),
    above.kind === 'blocked' ? String(above.binding?.member) : 'accepted');
  const below = solveForTarget(BANDS, start, ['High Value'], BAND_ARPU, 5);
  check('solve: a target below the reachable minimum is refused and named',
    below.kind === 'blocked' && below.reason === 'below-min' && below.binding?.member === 'Low Value');

  // The bounds themselves are reachable, not off-by-one excluded.
  const rangeNow = achievableTargetRange(BANDS, start, ['High Value'], BAND_ARPU);
  const atMax = rangeNow.kind === 'ok' ? solveForTarget(BANDS, start, ['High Value'], BAND_ARPU, rangeNow.range.max) : null;
  const atMin = rangeNow.kind === 'ok' ? solveForTarget(BANDS, start, ['High Value'], BAND_ARPU, rangeNow.range.min) : null;
  check('solve: the maximum itself is reachable — the bound is inclusive', atMax?.kind === 'ok');
  check('solve: the minimum itself is reachable', atMin?.kind === 'ok');
  check('solve: at the maximum all free budget sits on the dearest free member',
    atMax?.kind === 'ok' && near(atMax.shares['Mid Value'], 60) && near(atMax.shares['Low Value'], 0));
  // The mirror of the line above, added because the stage-2 gate noticed the
  // minimum had only a resolves-or-not check against it. "It returned ok" is
  // the same vacuous shape as "it conformed" — both pass on a wrong vector.
  check('solve: and at the minimum all free budget sits on the cheapest free member',
    atMin?.kind === 'ok' && near(atMin.shares['Low Value'], 60) && near(atMin.shares['Mid Value'], 0),
    atMin?.kind === 'ok' ? `${atMin.shares['Low Value']}/${atMin.shares['Mid Value']}` : 'blocked');

  // Collapsed range.
  const collapsed = solveForTarget(BANDS, EVEN, BANDS, BAND_ARPU, 99);
  check('solve: a collapsed range refuses a different target by name',
    collapsed.kind === 'blocked' && collapsed.reason === 'range-collapsed');
  const collapsedSame = solveForTarget(BANDS, EVEN, BANDS, BAND_ARPU, blendedArpu(EVEN, BAND_ARPU) as number);
  check('solve: a collapsed range accepts the value it is already at',
    collapsedSame.kind === 'ok' && conformsToTotal(BANDS, collapsedSame.shares));

  check('solve: a non-finite target is refused rather than propagated',
    (() => { const s = solveForTarget(BANDS, start, [], BAND_ARPU, Infinity); return s.kind === 'blocked'; })());

  // ── The underdetermined branch. V2's tariff axis, exercised now so the V2
  //    design pass inherits a measured property rather than a claim. ──
  const FOUR = ['A', 'B', 'C', 'D'];
  const FOUR_ARPU = { A: 5, B: 15, C: 25, D: 40 };
  const fourStart = { A: 25, B: 25, C: 25, D: 25 };
  const s1 = solveForTarget(FOUR, fourStart, [], FOUR_ARPU, 30);
  const s2 = solveForTarget(FOUR, fourStart, [], FOUR_ARPU, 30);
  check('solve: >2 free members still hits the target exactly',
    s1.kind === 'ok' && near(s1.blend, 30, 1e-9) && conformsToTotal(FOUR, s1.shares));
  check('solve: >2 free members is DETERMINISTIC — same input, identical output',
    s1.kind === 'ok' && s2.kind === 'ok' && FOUR.every(m => s1.shares[m] === s2.shares[m]));
  check('solve: >2 free members holds every share at or above zero',
    s1.kind === 'ok' && FOUR.every(m => s1.shares[m] >= 0));

  // Continuity: a small retype must move the sliders a small amount. A rule
  // that jumped would make the control feel broken without ever failing a
  // value check, which is why this is measured rather than argued.
  const a = solveForTarget(FOUR, fourStart, [], FOUR_ARPU, 30);
  const b = solveForTarget(FOUR, fourStart, [], FOUR_ARPU, 30.001);
  check('solve: >2 free members is continuous in the target',
    a.kind === 'ok' && b.kind === 'ok' && FOUR.every(m => Math.abs(a.shares[m] - b.shares[m]) < 0.05),
    a.kind === 'ok' && b.kind === 'ok' ? String(Math.max(...FOUR.map(m => Math.abs(a.shares[m] - b.shares[m])))) : 'n/a');
}

// ---------------------------------------------------------------------------
// 5. Totality sweep — no throw, no NaN escape, on deliberately hostile input
// ---------------------------------------------------------------------------
{
  const hostile: Array<Record<string, number>> = [
    {}, { 'Low Value': NaN, 'Mid Value': 50, 'High Value': 50 },
    { 'Low Value': Infinity, 'Mid Value': 0, 'High Value': 0 },
    { 'Low Value': -10, 'Mid Value': 60, 'High Value': 50 },
    { 'Low Value': 0, 'Mid Value': 0, 'High Value': 0 },
    { 'Low Value': 1e12, 'Mid Value': 0, 'High Value': 0 },
    { 'Mid Value': 50, 'High Value': 50 }, // a listed member with no share at all
  ];
  const arpus: Array<Record<string, number>> = [
    BAND_ARPU, {}, { 'Low Value': NaN, 'Mid Value': 20, 'High Value': 45 },
    { 'Low Value': 0, 'Mid Value': 0, 'High Value': 0 },
  ];
  const lockSets: string[][] = [[], ['Low Value'], BANDS, ['Ghost']];
  const targets = [0, 20, -5, 1e9, NaN, Infinity];

  let ran = 0, threw = 0, nanEscaped = 0, brokeInvariant = 0;
  const finiteAll = (o: Record<string, number>) => Object.values(o).every(v => Number.isFinite(v));

  for (const shares of hostile) for (const arpu of arpus) for (const locked of lockSets) {
    for (const target of targets) {
      ran++;
      try {
        const bl = blendedArpu(shares, arpu);
        if (bl !== null && !Number.isFinite(bl)) nanEscaped++;

        const rg = achievableTargetRange(BANDS, shares, locked, arpu);
        if (rg.kind === 'ok' && (!Number.isFinite(rg.range.min) || !Number.isFinite(rg.range.max))) nanEscaped++;

        const rb = rebalance(BANDS, shares, locked, 'Mid Value', target);
        if (rb.kind === 'ok') {
          if (!finiteAll(rb.shares)) nanEscaped++;
          if (!conformsToTotal(BANDS, rb.shares)) brokeInvariant++;
        }

        const sv = solveForTarget(BANDS, shares, locked, arpu, target);
        if (sv.kind === 'ok') {
          if (!finiteAll(sv.shares) || !Number.isFinite(sv.blend)) nanEscaped++;
          if (!conformsToTotal(BANDS, sv.shares)) brokeInvariant++;
        }
      } catch { threw++; }
    }
  }
  check('totality: the hostile sweep actually ran the cases it claims',
    ran === hostile.length * arpus.length * lockSets.length * targets.length, `${ran} combinations`);
  check('totality: nothing threw', threw === 0, `${threw} throws`);
  check('totality: no NaN or Infinity escaped any ok result', nanEscaped === 0, `${nanEscaped} escapes`);
  check('totality: INVARIANT HELD — every ok write conformed to the total even on hostile input',
    brokeInvariant === 0, `${brokeInvariant} violations`);
}

// ---------------------------------------------------------------------------
// 6. Write enforces, read describes
// ---------------------------------------------------------------------------
{
  // A restored mix that does not sum to 100 — a legacy save, or a preserved mix
  // whose tier list changed shape. The reads must still describe it.
  const legacy = { 'Low Value': 30, 'Mid Value': 30, 'High Value': 30 };
  check('read: blendedArpu describes a non-conforming restored mix', blendedArpu(legacy, BAND_ARPU) !== null);
  check('read: achievableTargetRange describes one too',
    achievableTargetRange(BANDS, legacy, [], BAND_ARPU).kind === 'ok',
    'refusing here would blank the amber sum indicator that tells the user to look');

  const written = rebalance(BANDS, legacy, [], 'Low Value', 30);
  check('write: rebalancing a non-conforming mix returns a CONFORMING one',
    written.kind === 'ok' && conformsToTotal(BANDS, written.shares),
    'enforced at write is where the mix is repaired — not by refusing to read it');
  const solvedFromLegacy = solveForTarget(BANDS, legacy, [], BAND_ARPU, 20);
  check('write: solving from a non-conforming mix returns a conforming one',
    solvedFromLegacy.kind === 'ok' && conformsToTotal(BANDS, solvedFromLegacy.shares));
  // CONFORMING IS NOT ENOUGH, and this line exists because guard-trap 53 proved
  // it. Dropping the free-share rescale still yields a mix summing to 100 —
  // conserve's absorber repairs the total regardless — but blending to 23.88
  // against a target of 20. The check above passed on a mix that was conforming
  // and wrong, which is the vacuous-result trap in a new coat.
  check('write: and the solved mix still HITS the target from a non-conforming start',
    solvedFromLegacy.kind === 'ok' && near(solvedFromLegacy.blend, 20, 1e-9)
      && near(blendedArpu(solvedFromLegacy.shares, BAND_ARPU) as number, 20, 1e-9),
    solvedFromLegacy.kind === 'ok' ? `blend ${solvedFromLegacy.blend}` : solvedFromLegacy.reason);

  // A non-conforming mix with EVERY member padlocked cannot be repaired without
  // moving a slider the user held. Refusing is the answer; the alternative that
  // shipped in the first draft returned ok with a mix summing to 1e12.
  const allHeld = solveForTarget(BANDS, legacy, BANDS, BAND_ARPU, blendedArpu(legacy, BAND_ARPU) as number);
  check('write: a non-conforming mix with every member held is refused, not silently rewritten',
    allHeld.kind === 'blocked' && allHeld.reason === 'cannot-conserve', allHeld.kind === 'ok' ? 'accepted' : allHeld.reason);

  // The repair must never come out of a padlocked member's share.
  const lockedShare = 40;
  const repaired = rebalance(BANDS, { 'Low Value': 10, 'Mid Value': 10, 'High Value': lockedShare },
    ['High Value'], 'Low Value', 25);
  check('write: repairing the total never moves a padlocked member',
    repaired.kind === 'ok' && repaired.shares['High Value'] === lockedShare
      && conformsToTotal(BANDS, repaired.shares),
    'an earlier draft always absorbed the residual on the LAST member, padlocked or not');
}


// ---------------------------------------------------------------------------
// THE DRAG THAT HOLDS THE TARGET — sum AND blend (Jon, 2026-09-04)
//
// EXPECTED.md, "SUPPLEMENT: THE DRAG ITSELF". `rebalance` conserves the total
// and nothing else; `rebalanceToTarget` conserves both equations, clamps at the
// wall, and takes the nearest reachable point when the equations leave freedom.
//
// SYNTHETIC RATES throughout, chosen so the arithmetic is checkable by hand and
// the assertions are not hostage to a fixture's numbers.
// ---------------------------------------------------------------------------
{
  const M4 = ['a', 'b', 'c', 'd'];
  const A4: Record<string, number> = { a: 10, b: 20, c: 30, d: 40 };
  const even4 = { a: 25, b: 25, c: 25, d: 25 };
  const blendOf = (s: Record<string, number>, a: Record<string, number>) =>
    Object.keys(s).reduce((t, k) => t + (s[k] / 100) * a[k], 0);

  // Blend at rest is 25. Moving `a` up must be absorbed by b/c/d such that the
  // blend is STILL 25 — which rebalance alone could never do.
  const T = 25;
  const d1 = rebalanceToTarget(M4, even4, [], A4, T, 'a', 40);
  check('drag: a reachable drag returns ok, not a wall', d1.kind === 'ok', d1.kind);
  if (d1.kind === 'ok') {
    check('drag: the moved member gets exactly what was asked',
      Math.abs(d1.appliedShare - 40) < 1e-9, `${d1.appliedShare}`);
    check('drag: the shares still total 100',
      Math.abs(Object.values(d1.shares).reduce((s, v) => s + v, 0) - 100) < 1e-9,
      `${Object.values(d1.shares).reduce((s, v) => s + v, 0)}`);
    check('drag: THE BLEND IS STILL THE TARGET, to 1e-9',
      Math.abs(blendOf(d1.shares, A4) - T) < 1e-9,
      `${blendOf(d1.shares, A4)} vs ${T} — this is the whole point of the function`);
    check('drag: every share is non-negative',
      Object.values(d1.shares).every(v => v >= -1e-9), JSON.stringify(d1.shares));
  }

  // A LOCK IS UNTOUCHED, TO THE PENNY, and still the blend holds.
  const locked4 = { a: 25, b: 25, c: 25, d: 25 };
  const d2 = rebalanceToTarget(M4, locked4, ['d'], A4, T, 'a', 35);
  check('drag: with d held, the drag still solves', d2.kind === 'ok', d2.kind);
  if (d2.kind === 'ok') {
    check('drag: the HELD share is untouched to the penny',
      d2.shares['d'] === 25, `${d2.shares['d']} — a lock is the user's`);
    check('drag: and the blend is still the target with a lock in play',
      Math.abs(blendOf(d2.shares, A4) - T) < 1e-9, `${blendOf(d2.shares, A4)}`);
  }

  // MINIMUM CHANGE. With three untouched members the equations leave freedom,
  // and the answer must be the LEAST-SQUARES point. Compared against a brute
  // search over the same feasible set rather than against a formula restated
  // here, which would only check the implementation against itself.
  const d3 = rebalanceToTarget(M4, even4, [], A4, T, 'a', 34);
  check('drag: the 4-member case solves', d3.kind === 'ok', d3.kind);
  if (d3.kind === 'ok') {
    const got = ['b', 'c', 'd'].map(k => d3.shares[k]);
    const cur = [25, 25, 25];
    const R = 100 - d3.shares['a'];
    const B = 100 * T - d3.shares['a'] * A4['a'];
    const dist = (v: number[]) => v.reduce((s, x, i) => s + (x - cur[i]) ** 2, 0);
    // Brute: sweep b, derive c and d from the two equations, keep every
    // non-negative point, take the nearest. Coarse but independent.
    let best: number[] | null = null;
    for (let b = 0; b <= R; b += 0.05) {
      // c + d = R - b ; 30c + 40d = B - 20b
      const rc = R - b;
      const bc = B - 20 * b;
      const d = (bc - 30 * rc) / 10;
      const c = rc - d;
      if (c < -1e-9 || d < -1e-9) continue;
      const cand = [b, c, d];
      if (!best || dist(cand) < dist(best)) best = cand;
    }
    check('drag: a brute sweep found a feasible point to compare against', !!best);
    if (best) {
      check('drag: MINIMUM CHANGE — no feasible point is nearer than the solved one',
        dist(got) <= dist(best) + 1e-3,
        `solved ${dist(got).toFixed(6)} vs brute ${dist(best).toFixed(6)} at ${JSON.stringify(best.map(v => +v.toFixed(3)))}`);
      check('drag: and the brute point satisfies the same two equations',
        Math.abs(best.reduce((s, v) => s + v, 0) - R) < 1e-6
          && Math.abs(best[0] * 20 + best[1] * 30 + best[2] * 40 - B) < 1e-6,
        'the comparison is only meaningful if the brute point is itself feasible');
    }
  }

  // THE WALL. Pushing `a` far up must stop exactly where a further move would
  // need a negative share or a locked share to move.
  const d4 = rebalanceToTarget(M4, even4, [], A4, T, 'a', 95);
  check('drag: a drag past the reachable range returns a WALL', d4.kind === 'wall', d4.kind);
  if (d4.kind === 'wall') {
    check('drag: the wall names the bound it reached',
      d4.wall.bound === 'max', d4.wall.bound);
    check('drag: the clamped share is what the moved member actually got',
      d4.wall.clampedShare === d4.appliedShare, `${d4.wall.clampedShare} vs ${d4.appliedShare}`);
    check('drag: AT THE WALL THE TARGET IS STILL HELD',
      Math.abs(blendOf(d4.shares, A4) - T) < 1e-9,
      `${blendOf(d4.shares, A4)} — a wall that abandoned the target would be the old bug`);
    check('drag: at the wall the shares still total 100',
      Math.abs(Object.values(d4.shares).reduce((s, v) => s + v, 0) - 100) < 1e-9);
    check('drag: and the wall is where a further move would need a negative share',
      Object.values(d4.shares).some(v => Math.abs(v) < 1e-9),
      `${JSON.stringify(d4.shares)} — the binding constraint is a share at zero`);
    // ONE STEP BEYOND IS STILL THE SAME WALL: the clamp is a property of the
    // feasible set, not of how far the user dragged.
    const d5 = rebalanceToTarget(M4, even4, [], A4, T, 'a', 99);
    check('drag: dragging further lands on the SAME clamped share',
      d5.kind === 'wall' && Math.abs(d5.appliedShare - d4.appliedShare) < 1e-9,
      d5.kind === 'wall' ? `${d5.appliedShare} vs ${d4.appliedShare}` : d5.kind);
  }

  // DOWNWARD hits the other bound, and says so.
  const d6 = rebalanceToTarget(M4, even4, [], A4, T, 'd', 0);
  check('drag: a downward drag reports the min bound when it clamps',
    d6.kind !== 'blocked', d6.kind);
  if (d6.kind === 'wall') {
    check('drag: the downward wall is the MIN bound', d6.wall.bound === 'min', d6.wall.bound);
  }

  // TWO UNTOUCHED MEMBERS: exactly determined, and the one solve path must
  // return that unique point rather than something merely feasible.
  const M3 = ['a', 'b', 'c'];
  const A3: Record<string, number> = { a: 10, b: 20, c: 30 };
  const even3 = { a: 100 / 3, b: 100 / 3, c: 100 / 3 };
  const T3 = 20;
  const d7 = rebalanceToTarget(M3, even3, [], A3, T3, 'a', 40);
  check('drag: the three-band case solves', d7.kind === 'ok', d7.kind);
  if (d7.kind === 'ok') {
    // By hand: a=40 at rate 10 gives 400. b + c = 60, 20b + 30c = 2000 - 400.
    // => c = (1600 - 20*60)/10 = 40, b = 20.
    check('drag: the exactly-determined answer matches the hand solve',
      Math.abs(d7.shares['b'] - 20) < 1e-9 && Math.abs(d7.shares['c'] - 40) < 1e-9,
      `b=${d7.shares['b']} c=${d7.shares['c']} — expected 20 and 40`);
  }

  // A LOCKED MOVED MEMBER IS REFUSED, not silently honoured.
  const d8 = rebalanceToTarget(M3, even3, ['a'], A3, T3, 'a', 40);
  check('drag: dragging a LOCKED member is refused',
    d8.kind === 'blocked' && d8.reason === 'range-collapsed', d8.kind);

  // A MISSING RATE IS REFUSED. The locked members' rates matter too: they are
  // the constant term of the blend equation.
  const d9 = rebalanceToTarget(M3, even3, [], { a: 10, b: 20 } as any, T3, 'a', 40);
  check('drag: a member with no finite ARPU is refused, not treated as zero',
    d9.kind === 'blocked' && d9.reason === 'arpu-unknown', d9.kind);

  // rebalance IS UNCHANGED. Its signature was not widened and its no-target
  // callers must behave exactly as before.
  const untouched = rebalance(M3, even3, [], 'a', 40);
  check('drag: rebalance still conserves the total and ignores any blend',
    untouched.kind === 'ok' && conformsToTotal(M3, untouched.shares),
    'the sibling must not have changed the original');
}

// ---------------------------------------------------------------------------
console.log(`\nmix-constraint spec: ${pass}/${pass + fails.length} passed`);
if (fails.length) { fails.forEach(f => console.log('  FAIL  ' + f)); process.exit(1); }
console.log('  every check green');

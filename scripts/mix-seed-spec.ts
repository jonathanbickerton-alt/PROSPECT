/**
 * Spec for seedMixPreserving — the tier-mix seeding rule.
 *
 *   npm run spec:mix
 *
 * The defect this closes: handleEditPromoStart restores a saved promoMix and
 * changes newPromo in the same callback. newPromo changes the cohort the tier
 * list derives from, so the seeding effect fires on the next render. Under the
 * old rule it unconditionally reset every tier to equal weights, silently
 * discarding the restored mix before the user saw it.
 *
 * Each case runs BOTH rules, so the reproduction and the fix are visible
 * side by side rather than asserted.
 */
import { seedMixPreserving } from '../src/components/WhatIfTab';

/** The rule as it was, verbatim, for reproduction. */
function oldEqualWeightSeed(_prev: Record<string, number>, tiers: string[]): Record<string, number> {
  if (tiers.length === 0) return {};
  const eq = 100 / tiers.length;
  const out: Record<string, number> = {};
  tiers.forEach((t, i) => { out[t] = i === tiers.length - 1 ? 100 - eq * (tiers.length - 1) : eq; });
  return out;
}

let pass = 0; const fails: string[] = [];
const sum = (m: Record<string, number>) => Object.values(m).reduce((s, v) => s + v, 0);
const check = (name: string, cond: boolean) => { if (cond) pass++; else fails.push(name); };
const close = (a: number, b: number) => Math.abs(a - b) < 1e-6;

// ── THE DEFECT, reproduced ────────────────────────────────────────────────
// A promotion saved with a deliberate 70/30 mix. Edit-start restores it, then
// the effect fires because the tier list was recomputed.
const restored = { Premium: 70, Value: 30 };
const sameTiers = ['Premium', 'Value'];

const underOld = oldEqualWeightSeed(restored, sameTiers);
check('REPRO: the old rule discards a restored 70/30 mix', underOld.Premium === 50 && underOld.Value === 50);

const underNew = seedMixPreserving(restored, sameTiers);
check('FIXED: the restored 70/30 mix survives', close(underNew.Premium, 70) && close(underNew.Value, 30));

// ── the no-prior-mix case must be unchanged from the old rule ─────────────
const fresh3 = ['A', 'B', 'C'];
const oldFresh = oldEqualWeightSeed({}, fresh3);
const newFresh = seedMixPreserving({}, fresh3);
check('no prior mix: identical to the old equal-weight seed',
  fresh3.every(t => close(oldFresh[t], newFresh[t])));
check('no prior mix: totals 100', close(sum(newFresh), 100));

// ── partial tier overlap: keep what survives, fill the rest ───────────────
const partial = seedMixPreserving({ Premium: 70, Value: 30 }, ['Premium', 'Ultra']);
check('partial overlap: the surviving tier keeps its weight', close(partial.Premium, 70));
check('partial overlap: the new tier takes the remainder', close(partial.Ultra, 30));
check('partial overlap: totals 100', close(sum(partial), 100));

// ── no overlap at all: falls back to equal weights ────────────────────────
const none = seedMixPreserving({ Premium: 70, Value: 30 }, ['X', 'Y']);
check('no overlap: equal weights', close(none.X, 50) && close(none.Y, 50));

// ── kept weights not summing to 100 are normalised ────────────────────────
const under = seedMixPreserving({ A: 20, B: 20 }, ['A', 'B']);
check('kept weights below 100 are normalised up', close(sum(under), 100) && close(under.A, under.B));
const over = seedMixPreserving({ A: 80, B: 80 }, ['A', 'B']);
check('kept weights above 100 are normalised down', close(sum(over), 100) && close(over.A, over.B));

// ── degenerate inputs ─────────────────────────────────────────────────────
check('empty tier list yields an empty mix', Object.keys(seedMixPreserving({ A: 50 }, [])).length === 0);
check('single tier takes the whole 100', close(seedMixPreserving({}, ['Only']).Only, 100));
check('a single restored tier is preserved at 100', close(seedMixPreserving({ Only: 42 }, ['Only']).Only, 100));

// ── every result must total exactly 100 ───────────────────────────────────
for (const [label, m] of [['restored', underNew], ['fresh', newFresh], ['partial', partial],
                          ['none', none]] as [string, Record<string, number>][]) {
  check(`${label}: totals exactly 100`, close(sum(m), 100));
}

console.log(`seedMixPreserving spec: ${pass} passed, ${fails.length} failed`);
fails.forEach(f => console.log('  FAIL ' + f));
process.exit(fails.length ? 1 : 0);

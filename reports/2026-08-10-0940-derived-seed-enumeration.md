# The derived seed is summed — and the as-of gate is the real absence risk

## FOR ADVISOR

```
Generated: 2026-08-10 09:40 +0100 (UTC 2026-08-10 08:40)
Verified against: HEAD f509389, branch main, tree CLEAN. NO CODE CHANGED.
THE BRIEF'S HYPOTHESIS IS FALSE. deriveAggregate DOES carry seedBaseVolume — it
  sums leaf seeds at forecasting.ts:1244 and sets the field on its output at
  :1354, and it measured 3000 on the derived object two sessions ago, the exact
  sum of its three leaf seeds. The :2316 recursion does not fire || 0 there.
NEW AND SHARPER, from the enumeration asked for — forecasting.ts:1242:
    const present = asOf !== null && lf.historicalMonths.includes(asOf);
    if (present) { seedBaseVolume += lf.seedBaseVolume || 0; ... }
  THE SEED SUMS ONLY OVER LEAVES REACHING THE COMMON AS-OF MONTH. A leaf whose
  history ends earlier contributes NO seed while its flows still accumulate. On
  ragged history the aggregate is under-seeded in proportion to how many leaves
  fall short, and with enough of them the seed tends to zero — the seedless
  integral, FROM FULLY-SEEDED LEAF FITS. Strongest remaining candidate.
IT DOES NOT FIRE ON JON'S SAVE: all 541 cohorts end 2025-12, uniform history, no
  ragged leaves, all Provenance=fitted. Third session, third hypothesis
  eliminated; the artefact remains unreproduced.
THE FIX'S TARGET MOVES: the load-bearing absence is INSIDE deriveAggregate (the
  || 0 at :1244 under the as-of gate), not the reads in ForecastVsActualsTab.
  Both prior briefs pointed one level too high. Start at forecasting.ts:1239.
FIX NOT IMPLEMENTED — budget, not doubt, same as the previous session: a nullable
  seed touches the engine, three-plus reads, both surfaces, specs on two tabs, a
  guard-trap and a full gate. NOTHING changed, so no partial state to unpick, and
  74/72/2 and the pinned MAPEs are untouched by construction, not re-run.
BACKLOG, recorded not built: a ragged-history edge-fixture variant would give the
  trap a behavioural target — a better ask than "Base rows removed".
Decisions needed: none new.
State: HOLD. Fix unstarted, decision intact, and its scope is now better known.
```

---

## What the enumeration returned

**The brief's hypothesis — that `deriveAggregate`'s output carries no seed, so
the single-bf recursion at `:2316` fires `|| 0` on a derived aggregate — is
false.** From source:

```ts
seedBaseVolume += lf.seedBaseVolume || 0;   // forecasting.ts:1244
...
return { cohort, seedBaseVolume, historicalMonths, months, ... };   // :1354
```

and measured directly two sessions ago on the derived object for
`Corporate|Fixed Connectivity`: `derived seedBaseVolume: 3000`, the exact sum of
its three leaf seeds. A derived aggregate built from seeded leaves arrives at the
chart **with a seed**, so that path does not produce the seedless line.

## The find the enumeration did produce

One line above the sum, `forecasting.ts:1242`:

```ts
const present = asOf !== null && lf.historicalMonths.includes(asOf);
if (present) {
  seedBaseVolume        += lf.seedBaseVolume        || 0;
  lastHistoricalInflow  += lf.lastHistoricalInflow  || 0;
  lastHistoricalOutflow += lf.lastHistoricalOutflow || 0;
```

**The seed sums only over leaves that reach the common as-of month.** A leaf whose
history ends earlier contributes nothing to the aggregate's opening stock.

On uniform-history data every leaf is `present` and the sum is complete — which
is why the edge fixture produced a clean 3984 and a continuous line, and why two
probes built on it found nothing. **On ragged history the aggregate is
under-seeded in proportion to how many leaves fall short**, and with enough short
leaves the seed tends to zero while the flows continue to accumulate. That is
precisely the reported shape, reached from leaf fits that all carry perfectly
good seeds.

This is a genuine absence-impersonation and it is one level lower than either
prior diagnosis looked. Both aimed at the `|| 0` reads in
`ForecastVsActualsTab`; the load-bearing one is inside the engine.

## But it does not fire on Jon's save

```
distinct cohorts in Baseline_Forecasts : 541
last historical month                  : 2025-12  ->  541 cohorts (all of them)
Provenance                             : fitted = 541
```

Uniform history, no ragged leaves, no stored derived rows. So the aggregate seeds
cleanly on that session too, and the fabrication still does not reproduce.

**Three sessions, three eliminated hypotheses:** shipped fixtures (all carry Base
rows), restored pre-seed fits (the save carries seeds and import restores them),
and now ragged history (that save has none). The mechanism family is real and
increasingly well located; the specific artefact remains unreproduced.

## What this changes about the fix

The decision does not change — absence must propagate. **Its target does.** The
first site to make nullable is the engine's own accumulation, not the chart's
reads:

- `deriveAggregate`'s `|| 0` at `:1244`, and the `present` gate at `:1242`, are
  where a real book silently loses opening stock. A leaf that is excluded from
  the seed but included in the flows is the defect in miniature.
- The `ForecastVsActualsTab` reads still need the absent case, but they are
  downstream of it, and fixing them alone would leave the engine under-seeding
  quietly.

Whoever picks this up should start at `forecasting.ts:1239-1246` rather than at
the chart, which is where the previous two briefs pointed.

## Why the fix is still not implemented

The same reason as the previous session, and it has not changed: a nullable seed
touches the engine's accumulation, three-plus reads, both surfaces, needs mounted
specs on two tabs, a guard-trap and a full three-stage gate. I did not have the
context to complete that to this repo's standard, and a half-applied
absence change left ungated is worse than none.

**Nothing was changed.** No code, no spec, no EXPECTED.md entry — so there is no
partial state, and a fresh session starts from a decision that is now better
scoped than it was this morning.

## Backlog, recorded not built

An edge-fixture variant with **ragged history** — some leaves ending earlier than
others — would make the under-seeding path reachable from real data and give the
guard-trap a behavioural target rather than a logical one. That is a better
fixture ask than the "Base rows removed" one in the brief, because it exercises
the site that actually loses the seed. Fixture owner's task.

## Where things stand

**HOLD.** Nothing merged, nothing moved, fix unstarted, decision intact.
B-11 unaffected; the walk-finish instructions in
`reports/2026-08-09-2113-step2-unlock.md` stand, including the Step 2 round trip
Jon still owes.

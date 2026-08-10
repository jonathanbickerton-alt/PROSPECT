# Seed-or-decline implemented — absence propagates, zero stops impersonating it

## FOR ADVISOR

```
Generated: 2026-08-10 12:53 +0100 (UTC 2026-08-10 11:53)
Certifies: working tree on main, base 676b3d2. NOT YET COMMITTED at write time.
UNIT A IMPLEMENTED AND GATED: seedBaseKnown carries absence, deriveAggregate is
  ALL-OR-ABSENT, and Step 3 declines to DRAW and to SCORE.
A FLAG, NOT A NULLABLE SEED — measured. Nullable gave ZERO errors: every read is
  `seedBaseVolume || 0`, which swallows null, so the defect's own idiom defeated
  the tool while the blast radius stayed. A REQUIRED flag inverts it — exactly 5
  CONSTRUCTION sites enumerated, readers untouched. Nullable attempt reverted.
STAGE 2 FOUND AN UNGUARDED SECOND READER: cohortBaseBandMap fed baseScore ->
  overallScore -> the CSV export off a fabricated stock — worse than the chart
  line, since the number leaves the screen. Gated, pinned, trap 50.
STAGE 3 FOUND A ROUND-TRIP HOLE I INTRODUCED: export wrote no known-ness column
  and an unseeded fit stores 0, so reload turned "unknown" into "known, and
  empty". Added Seed_Base_Known + restoreSeedKnown; the spec now drives the
  WRITER, which it never had.
JON'S CHECK LINE WAS AGAIN UNFILLED: ran the stated fallback, CONSTRUCTED stores.
UNIT B HELD: Step 1 is not wired to the shared predicate, so the surfaces still
  differ for Base-on-aggregate. No half-state; the docstring no longer overclaims.
OVER-DECLINE CHECKED (the real risk): two shipped fixtures verified by stage 2 —
  all leaves seeded, aggregate KNOWN, Base still drawn and scored. RE-MEASURED:
  74/72/2; MAPEs 13.8845/13.4315/14.3888/13.0192. Unmoved.
GATE: ui-consistency PASS, qa-tester FAIL->fixed, regression-guard FAIL->fixed.
  29 specs, guard-traps 48/48 (new 48/49/50, each demonstrated red).
Decisions needed: Unit B — wire Step 1, or record the divergence as accepted.
State: Unit A complete. B held. Verification recipe below.
```

---

## What was implemented

Base volume is never fitted and never stored per month — it is **reconstructed**
by rolling an opening stock forward through the forecast flows. So a seed that is
*unknown* must not be rendered as zero: that produces a seedless integral, a line
from the origin climbing at inflow-minus-outflow, which reads as a forecast.

- **`BaseForecast.seedBaseKnown: boolean`** carries the absence.
- **Leaf fits** seed from the last Base-metric reading; no Base rows → unknown.
- **`deriveAggregate` is ALL-OR-ABSENT**: any contributing leaf that fails the
  as-of gate, or carries no seed, makes the derived seed unknown. Never a partial
  sum. Where every leaf is present-and-seeded, the sum proceeds exactly as before.
- **Step 3 declines** on an unknown seed — both the chart series and the score.
- **`canShowBaseForecast()`** is the shared predicate.

**The seed's asymmetry with the flows is the point.** Flows are rates: a leaf
contributing no inflow genuinely adds nothing, so zero is the truth. The seed is
a stock. A leaf excluded from the seed but included in the flows hands the
aggregate an opening balance missing that leaf's customers while still counting
its joiners and leavers.

**Two `|| 0` reads were deliberately kept**, with reasons in the code: the
base-ARPU weighting in the engine and its chart counterpart are *weights*, not
stocks rolled forward and drawn. Weight zero is exactly exclusion from a weighted
mean, and nothing there reaches a chart as a series.

## A design decision I reversed mid-session

I began with `seedBaseVolume: number | null`, on the standard argument that the
compiler then enumerates the consumers. **It produced zero errors.** Every read
is `seedBaseVolume || 0`, which accepts `null` silently — so the type change
enumerated nothing while still forcing NaN-risk edits into Step 2's adjusted base
pool and the summary bar, neither of which this brief covers.

The defect's own idiom defeated the tool I picked to find it. I reverted clean
and used a **required flag** instead, which inverts the enumeration usefully: the
compiler lists every **construction** site — exactly five, being the three
import/restore sites and the two engine returns — while readers of the number are
untouched and cannot break.

## Two defects the gate found in my own work

**Stage 2 — the scorer was unguarded.** `cohortBaseBandMap` rolled forward from
`derivedForRow.seedBaseVolume` with no `seedBaseKnown` check, feeding
`baseScore` → `overallScore` → the rendered cell **and the CSV export**. That is
worse than the chart line it sat beneath: a line that should not be there is
visible and arguable; a KPI scored against a fabricated stock is a number someone
writes down. Gated with the same predicate, pinned, and trap 50 added.

**Stage 3 — the save round trip did not preserve absence.** The export wrote
`Seed_Base_Volume` only. An unseeded forecast stores `0` for arithmetic safety,
and `storedSeedKnown(0)` is correctly **true** — zero *is* a real opening stock
for a genuinely empty cohort. So absence could not be recovered from the number,
and one save/reload turned "unknown" into "known, and empty": the fabricated zero
this change exists to stop, reappearing on the one path it had not covered.

Added a `Seed_Base_Known` column and `restoreSeedKnown()`, which prefers it and
falls back to the value for pre-column saves. **The spec now drives the writer** —
its round-trip checks had unit-tested the reader on literal inputs and never
exercised the export, which is exactly how the hole survived.

## Unit B — HELD, and what that leaves

Step 1's panel is **not** wired to `canShowBaseForecast`. Its Base-on-aggregate
notice is unchanged, so the two surfaces still answer differently: Step 1 shows an
empty panel where Step 3 can now legitimately reconstruct a line.

**This creates no half-state** — Step 1 is exactly as it was before this session,
and the predicate's docstring was corrected so it no longer claims Step 1 reads
it. The decision is whether to wire Step 1 (informative, supersedes K's
limitation) or record the divergence as accepted.

## Gate

| stage | verdict |
|---|---|
| ui-consistency | PASS — no strings, no locales, no props, graceful absence |
| qa-tester | FAIL on the unguarded scorer → fixed, re-verified |
| regression-guard | FAIL on the export round trip → fixed, re-verified |

29 specs green; **guard-traps 48/48**, including 48 (partial sum returns), 49
(chart draws from an unknown stock) and 50 (score computed from one), each
demonstrated red and restored; `traps` 3/3; lint and build clean; i18n parity 0.
§33 with scope named: **main's working tree and build output are AI-free**;
history and remote branches out of scope, the preserved `ai-capability` branch
expected.

### Figures — re-measured, not quoted

```
PINNED ARPU MAPEs: 13.8845 / 13.4315 / 14.3888 / 13.0192   spread 1.3696pp
edge fixture: 74 leaves, 72 fit, 2 unfittable
base-seed 26/26   import-seam 36/36   derive 75/75   walk-fixes 82/82
```

**Over-declining was the real risk**, and stage 2 checked it on two shipped
fixtures independently: every leaf seeded, aggregate seed known, Base still drawn
and still scored. The fix removes nothing that worked.

### Declared gaps

- **The decline cases are CONSTRUCTED**, and labelled so in the spec. No shipped
  fixture and no saved session reaches the absent-seed path. The specs prove the
  rule's *logic*, not its occurrence.
- **`spec:base-seed` is not a mounted spec.** It drives the real engine functions
  and reads the component wiring from source. Stage 3 attempted an independent
  JSDOM mount of the Base score cell, could not get it to run, and declared that
  rather than claim it — so the "mounted Step 3 Base surface" requirement is met
  by `spec:step3-transition` (17/17, genuinely mounts the tab) plus source
  wiring, not by a mount that asserts on an unseeded cohort specifically.
- **Jon's check line was unfilled**, so no restored-save red state was mounted.

## Verification recipe for Jon, on the restored 07 Aug save

1. Restore the save and go to **Step 3 → Base view → Corporate | Fixed
   Connectivity**.
2. **Expected: the 40K seedless climb is GONE.** Because that save's 541 cohorts
   all carry positive seeds and share one as-of month, you should now see a
   **continuous** Base line meeting the last actual — not an honest-absence
   notice, and certainly not an origin-start ramp.
3. **If you instead see no Base line**, that is the decline firing, and it means
   some leaf in that scope is unseeded or short of the as-of month — capture the
   selection and tell me, because it would be the first real instance of the path
   and would upgrade the traps from constructed to behavioural.
4. **Check the Base score column** for that cohort: it should be populated, for
   the same reason the line is.
5. **Save and reload once**, then re-check. The new `Seed_Base_Known` column
   should keep the answer identical — this is the round trip stage 3 caught.
6. **Step 1, aggregate selection, Base**: still the old empty panel. Unit B is
   held, so the surfaces still differ here; that is expected, not a regression.

## Backlog, recorded

A **ragged-history** edge-fixture variant — some leaves ending earlier than
others — would make the as-of gate reachable from real data and upgrade traps
48/49/50 from logical to behavioural. Fixture owner's task.

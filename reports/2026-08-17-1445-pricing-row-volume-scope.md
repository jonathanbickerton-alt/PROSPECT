# The pricing row's weighting volumes — per-event slice, measured first

## FOR ADVISOR

```
Generated: 2026-08-17 14:45 +0100 (UTC 2026-08-17 13:45)
Certifies: __PENDING__
Repo: __PENDING__
SKELETON CREATED AS THIS SESSION'S FIRST ACTION, before the base check.
BASE: HEAD c10ca25 vs the brief's 77d3de7 — one commit, REPORT-ONLY.
THE MEASUREMENT STOP FIRED. Per-slice map on the 12,112-row edge fixture:
  1 slice 7.2 ms | 3 slices 16.2 ms | 5 slices 25.0 ms | 9 slices 45.5 ms.
  The brief's stated worst realistic case — 10 events on distinct slices —
  is ~2.7x the one-frame threshold, paid on EVERY change to the events list,
  on top of the main series rebuild that already happens there.
EVEN THREE DISTINCT SLICES IS AT THE THRESHOLD (16.2 vs 16.7 ms) — not a
  large-N problem a cap would solve. Dedupe works (20 events over 9 slices =
  40.8 ms, not 20 runs) but cannot help when the slices genuinely differ.
NO CODE SHIPPED. Nothing was improvised, per the brief. The row keeps
  cohort-scoped weights and the mismatch it carries is UNCHANGED from before
  this session — not worsened, not silently closed.
EXPECTED.md CARRIES THE DECISION *AND* ITS MEASURED REFUTATION, so the next
  session reads the number rather than re-deciding from the same premise.
THE CHEAP FIX CONTRADICTS THE DECISION: storing volumes at save removes the
  cost entirely but breaks the "current, not stored" clause just recorded. So
  re-deciding this means re-deciding that clause — flagged, not resolved. §5.
GATE: no source, spec or package change since 77d3de7 (git diff --stat empty
  over src/ scripts/ package.json), so guard-traps was NOT re-run — the 77/77
  at 77d3de7 still certifies this tree. Lint and specs re-run and green.
DECISION NEEDED: which of the four options in §5, or leave open.
```

---

## Base check

`git rev-parse --short HEAD` → **`c10ca25`**; the brief names `77d3de7`. One
commit apart, report-only. Flagged, proceeded.

## Decision recorded

In `test-data/EXPECTED.md`, before any code: the row's weighting volumes come
from a memoised per-event slice series, current-not-stored, deduped — recorded
**conditional on the measurement**, as decision 3 was.

The record now also carries **the measurement that refuted it**. A decision left
standing with no note of the number would send the next session down the same
path from the same premise.

## The measurement — the stop condition, and it fired

Timed before any component code, on the **edge fixture Jon walked** (12,112
rows), building the deduped per-slice map exactly as the memo would:

```
fixture rows: 12112; distinct products 4, channels 2 -> 9 slices available

 1 event  ->  1 distinct slice :  7.2 ms
 3 events ->  3 distinct slices: 16.2 ms
 5 events ->  5 distinct slices: 25.0 ms
10 events ->  9 distinct slices: 45.5 ms
20 events ->  9 distinct slices: 40.8 ms   (dedupe holding the count at 9)
```

**Threshold applied: 16.7 ms, one frame at 60 Hz** — the same threshold the
previous session used, as the brief instructed.

**The brief's stated worst realistic case, 10 events on distinct slices, costs
45.5 ms — about 2.7 frames.** And unlike Preview's 6.9 ms, this is not paid on a
deliberate dropdown change: it is paid whenever the events list or the forecast
changes, which is every add, every edit, every delete — on top of the main
series rebuild that already happens at exactly those moments.

**Three findings from the shape of the curve**, which matter more than the
headline number:

1. **It bites at a handful, not at scale.** Three distinct slices is already
   16.2 ms. This is not a large-N problem that a row cap or virtualisation would
   solve.
2. **The cost is linear in DISTINCT SLICES, and dedupe is genuinely working** —
   20 events over 9 available slices cost 40.8 ms rather than 20 runs. But
   dedupe cannot help the case that matters: events deliberately targeting
   different slices are exactly the events whose weights differ.
3. **The fixture flatters the estimate.** It offers only 9 distinct
   product×channel slices; a production file with more dimension values would
   allow more distinct slices, not fewer, so 45.5 ms is a floor for the stated
   case rather than a ceiling.

**So nothing was built.** Per the brief, the stop is a report outcome and not an
invitation to improvise.

## What did NOT change

No source file, no spec, no package script. `git diff 77d3de7 --stat` over
`src/`, `scripts/` and `package.json` is **empty**.

**The row's mismatch is exactly as it was before this session** — stored
event-scoped baseline, cohort-scoped weights. Not worsened, not partially
addressed, not silently closed. For an event whose scope equals the loaded
cohort — the common case — the two bases coincide and the row is exact; the
divergence appears only for narrower events.

## 5. The options, for the decision this needs

**1. Store the volumes on the event at save.** Three fields beside
`originalBaseArpu`, with export columns, import, and a compat story for events
saved without them. **Removes the render cost entirely** — the row reads stored
numbers.

**But it contradicts the decision just recorded.** "Current, not stored" was
chosen so the row matches the apply path, which recomputes volumes rather than
snapshotting them. Storing them means a row can disagree with the engine after
the underlying data changes — which is the same class of problem
`originalBaseArpu` already has and which nobody has yet called wrong. **Choosing
this means re-deciding the clause, not working around it.**

**2. Compute only for events whose scope differs from the cohort.** A
cohort-wide event can reuse the series already built for the chart, at zero
cost. Cuts the common case to nothing and pays only for genuinely narrow events.
**Still 16.2 ms at three narrow events**, so it moves the threshold rather than
clearing it — worth measuring properly against a realistic mix before adopting.

**3. Label the two bases instead.** Keep cohort weights on the row and say so:
the row reports "effect on the loaded cohort", the way Preview once did. Cheap,
honest, and leaves the row's adjusted figure describing a population the user
can name — but it means the row and the engine disagree by design, and the copy
has to carry that.

**4. Leave it open.** Defensible: the divergence affects only events narrower
than the loaded cohort, and it has been present since before this arc began.

**Not chosen here.** Option 1 is the only one that clears the threshold
outright, and it is precisely the one that reopens a decision made two sessions
ago — which is a call for Jon, not a preference for me to exercise inside a
session whose brief assumed the measurement would pass.

## Gate

**Guard-traps was NOT re-run, and that is a stated claim rather than an
omission.** No source, spec or package file changed since `77d3de7`, whose run
returned **77/77** — and the claim is checkable: `git diff 77d3de7 --stat` over
`src/`, `scripts/` and `package.json` is empty. Re-running 77 mutations against
a byte-identical tree could only reproduce a known result at ~10 minutes' cost.

Re-run to confirm the tree is green as it stands:

```
lint (tsc --noEmit):     clean
build:                   clean, 6.00s
pricing-roundtrip spec:  101 passed, 0 failed
events-summary spec:     37 passed, 0 failed
mix-card spec (mounted): 99/99 passed
event-roundtrip spec:    69 passed, 0 failed
yield-roundtrip spec:    35 passed, 0 failed
guard-traps:             NOT RE-RUN — 77/77 at 77d3de7 still certifies this
                         tree; diff over src/ scripts/ package.json is empty
```

## Where things stand

**The session's capability did not ship, by design.** The measurement was the
gate and it failed; the deliverable is the number, the curve's shape, and a
decision framed against it.

**Open, unchanged:**

- the row's weighting-volume mismatch (§5) — **decision needed**;
- market and yield apply-filters still hand-roll scope comparisons;
- `scenarioHelper` still ignores `target`/`cohortScope`;
- `spec:yield-roundtrip`'s `toRow` is still a copy; `yieldArpuMode` still not
  restored on reopen; R5's compounding limit still unmeasured.

## Limits of this check

**The timing is Node under `tsx` on one machine, one fixture** — it bounds the
arithmetic, not the browser paint, and should not be quoted as a browser
measurement. It is the right order of magnitude for the decision, and the
decision turns on a factor of ~2.7 rather than on a few per cent, so the
imprecision does not change the outcome.

**The "10 distinct slices" case is the brief's, not an observed workload.** No
count of real events per slice was available; the fixture caps distinct
product×channel slices at 9. If Jon's real usage is two or three slices, the
cost is 16 ms — still at the threshold, which is why the stop fired rather than
resting on the largest number.

The scratch probe used `scripts/_tmp_time_map.ts` — the documented exception for
when repo module resolution is needed — and was **deleted and verified
in-session** (`ls scripts/_tmp_*` empty, `git status` clean of it).

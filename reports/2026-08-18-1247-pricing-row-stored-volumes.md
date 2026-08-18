# The pricing row's stored weighting volumes

## FOR ADVISOR

```
Generated: 2026-08-18 12:47 +0100 (UTC 2026-08-18 11:47)
Certifies: __PENDING__
Repo: __PENDING__
SKELETON CREATED AS THIS SESSION'S FIRST ACTION, before the base check.
BASE: HEAD b3d64c6 vs the brief's 5a14872 — one commit, REPORT-ONLY.
SUPERSESSION RECORDED, DATED, WITH THE REASON: decision 4's "current, not
  stored" clause is WITHDRAWN, not worked around. The row is the event's
  SAVE-TIME RECORD — baseline and weights from one slice at one moment,
  coherent on scope AND time; the CHART carries current truth.
SHIPPED: pricedVol/totalVol on PricingEvent, written at save from the SAME
  invocation and the SAME matchRow the baseline comes from. One slice run feeds
  both — a second would reopen the two-moments problem inside a single save.
ABSENT, NOT ZERO, where the pool cannot be decomposed (base-only) — matching
  the em-dash the row already renders there. A stated 0 is a real volume.
COMPAT HELD AND ASSERTED BOTH WAYS: field-less events keep the cohort path —
  no fabricated volumes, no stored event rewritten, carriers extended not forked.
EDIT RE-SNAPSHOTS BOTH TOGETHER — the same block writes baseline and volumes,
  so an edit cannot refresh one and leave the other.
PREVIEW UNCHANGED, and the divergence is now EXPLAINABLE: Preview describes an
  unsaved draft (live), the row describes a record (save-time). They can differ
  ONLY when the data changed between save and viewing.
A STALE ANCHOR OF MINE FIRED CORRECTLY: the row's new call made the weighting
  count 3, not 2. Re-aimed to 3 and named, NOT loosened to a >=.
pricing-roundtrip 116/116 (was 101), guard-traps 79/79, events-summary 37/37,
  mix-card 99/99, event 69/69, yield 35/35, lint and build clean.
```

---

## Base check

`git rev-parse --short HEAD` → **`b3d64c6`**; the brief names `5a14872`. One
commit apart, report-only. Flagged, proceeded.

## Decision recorded — and what it supersedes

`test-data/EXPECTED.md`, before any code, as **decision 5 explicitly
superseding decision 4's "current, not stored" clause** — dated, with the
reason, rather than a new decision quietly contradicting an old one two entries
above it.

**The reasoning on record.** The row is the event's **save-time record**:
baseline and weights from the same slice at the same moment, coherent on **both**
axes — scope and time. The prior clause mixed them, pairing a save-time baseline
with current weights, which is a figure belonging to neither moment.

**The division of labour is the point.** The **chart** recomputes and shows what
is true now; the **row** records what was true when the event was made. Two
surfaces, two honest jobs — rather than one surface trying to do both and doing
neither.

**Why the supersession rather than a workaround.** Decision 4 chose current
volumes so the row would match the apply path. The measurement then showed the
only affordable way to get them is to store them (16.2 ms at three distinct
slices, on every events-list change). Keeping a clause the implementation
quietly violates would leave the next reader to discover the contradiction; the
clause is withdrawn instead.

## What shipped

### 1. The carrier

`pricedVol` and `totalVol` on `PricingEvent` — the priced pool and the total at
the event's month, selected by its own `target`/`cohortScope` through the shared
`pricedVolumesFor` rule the apply path uses.

**Written from the SAME invocation and the SAME row as the baseline.** The save
path already ran `eventScopeSeriesFor` for `originalBaseArpu`; the volumes come
from that same `eventScopeSeries` and that same `matchRow`. A second slice run
here would have reopened the two-moments problem *inside a single save*, which
is precisely the defect being closed — so the spec asserts the shared invocation
still has exactly **two** callers (save and Preview), not three.

**Absent, not zero, where the pool cannot be decomposed.** `base-only` prices
the base pool against the event pools inside it, which month volumes cannot
express; `pricedVolumesFor` returns null there and the fields are omitted
entirely — matching the em-dash the row already renders for that case. **An
absent pool is not an empty one.**

### 2. Export and import

`Priced_Vol` and `Total_Vol` on `Pricing_Events`, with the `''` absence carrier,
through the already-extracted `pricingEventExportRow` / `pricingEventFromRow`
seams — so the spec drives the real writer and the real reader, and the single
pricing import route's pin stands unchanged.

**A stated zero round-trips as `0`, distinct from absence** — a real slice with
no volume that month is a different fact from an event that never recorded one.
Both directions are asserted.

### 3. The row reads stored, with a compat branch

Where the event has both fields, the row weights through the **shared**
`applyPricingToBlend` from the stored numbers — no row-local arithmetic.

**Where it does not — every event saved before this change — the row keeps its
previous behaviour**, weighting via the cohort series. It does **not** fabricate
save-time volumes it never had. Both branches are asserted, because a compat
path that only exists in prose is one nobody notices losing.

**No stored event is rewritten.**

### 4. Edit re-snapshots both together

An edit re-runs the whole save block, so baseline and volumes re-snapshot as a
pair, with the existing edited-event exclusion applying to both. The spec pins
that they are written in one expression — an edit refreshing one and not the
other would recreate the mixed-axes defect at the moment of writing its fix.

### 5. Preview unchanged, and the divergence is now explainable

Preview stays live and event-scoped: it describes a **draft that has not been
saved**, so it has no save-time to record.

**Preview and the row can therefore legitimately differ — but only when the
underlying data changed between save and viewing.** That pair is explainable in
one sentence: the chart and Preview show what is true now, the row shows what
was true then. The previous mixed-axes pair was not explainable at all, because
neither moment owned the number.

### 6. Guard-traps 80 and 81

- **80** writes the saved volumes from the **cohort** series while the baseline
  stays event-sliced — the mixed-axes defect reintroduced at source, at the exact
  moment of its fix. The stored numbers stay plausible, so only a check about
  **provenance** rather than values can catch it.
- **81** drops the compat branch, so every pre-change saved event computes
  against stored-undefined. That population is the least able to notice, because
  nobody re-checks events they saved weeks ago.

Both anchors verified unique before planting.

## 7. A stale anchor of mine, fired and re-aimed

The row's new `applyPricingToBlend` call made the shared-weighting call-site
count **3**, where the check expected 2. That is the anchor rule working: a real
caller was added, so the count legitimately moved.

**Re-aimed to 3 with the three sites named** — the apply path's two plus the
row's stored branch — rather than loosened to `>= 2`, which would have stopped
noticing a site *disappearing*. A count that only catches additions is half a
check.

## Gate

```
pricing-roundtrip spec:  116 passed, 0 failed   (was 101 — 15 new checks)
events-summary spec:     37 passed, 0 failed
mix-card spec (mounted): 99/99 passed          (untouched — no regression)
event-roundtrip spec:    69 passed, 0 failed
yield-roundtrip spec:    35 passed, 0 failed
guard-traps:             79/79 caught          (80 and 81 caught first run)
lint (tsc --noEmit):     clean
build:                   clean, 10.47s
```

## Where things stand

**The row's mismatch is closed.** Baseline and weights now come from one slice
at one moment, and the surface that carries current truth is the chart.

**Open, unchanged by this session:**

- market and yield apply-filters still hand-roll scope comparisons;
- `scenarioHelper` still ignores `target`/`cohortScope`;
- `spec:yield-roundtrip`'s `toRow` is still a copy; `yieldArpuMode` still not
  restored on reopen; R5's compounding limit still unmeasured.

## Limits of this check

**Still not mounted.** The pricing card has no mounted harness, so the rendered
row — stored branch, compat branch, and the em-dash for base-only — is
**source-read**. The carrier round-trip, the arithmetic, the one-invocation
provenance and the branch wiring are machine-checked.

**The compat branch is asserted structurally, not against a real legacy file.**
The spec constructs a field-less event and pins that the row's code takes the
cohort path for it; it does not load a workbook saved before this change. The
round-trip half — that a field-less event reads back with both fields absent
rather than zero — *is* exercised through the real reader.

**`originalBaseArpu`'s own semantics were not reopened.** It remains the
save-time baseline, which is what makes the pairing coherent; whether a
save-time record is the right thing for the row to show at all is a settled
decision this session did not revisit.

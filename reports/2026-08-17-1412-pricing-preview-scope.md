# Preview Impact — event-scoped, measured before committing

## FOR ADVISOR

```
Generated: 2026-08-17 14:12 +0100 (UTC 2026-08-17 13:12)
Certifies: __PENDING__
Repo: __PENDING__
SKELETON CREATED AS THIS SESSION'S FIRST ACTION, before the base check.
BASE: HEAD 35eab0c vs the brief's c4e1f48 — one commit, REPORT-ONLY.
MEASURED FIRST, BEFORE ANY COMPONENT CODE: 6.90 ms per slice run on the
  12,112-row edge fixture (6.41 ms narrowed). Threshold: one 60 Hz frame, and
  the run fires on dim/month changes, never per keystroke. OPTION 1 SHIPS.
ONE SLICE INVOCATION, eventScopeSeriesFor, with EXACTLY TWO callers: the save
  path and Preview's memo. The agreement pin counts them.
THE EXCLUSION LIVES INSIDE IT, so both callers drop the edited event or neither
  does — it cannot be applied on one path and forgotten on the other.
MEMO KEY = dims + month ONLY. Typed figures excluded, so a keystroke costs the
  cheap arithmetic and nothing more. Duration is excluded too, and that is a
  claim not an oversight: the series is the blend BEFORE this event.
A SECOND MISMATCH FOUND WHILE BUILDING, FIXED HERE: Preview's WEIGHTING volumes
  still came from the cohort series while its baseline went event-scoped — a
  ratio belonging to neither slice. Both now come from the same series.
THE SAME MISMATCH REMAINS ON THE SAVED ROW, NOT fixed: it needs stored volumes
  (a carrier change) or a pipeline run per row. DECISION NEEDED, §6.
FIFTH EXPECTATION CORRECTION OF THIS ARC: I counted 3 occurrences where there
  are 2 — the definition reads `= useCallback(`. Recorded, not amended quietly.
pricing-roundtrip 101/101 (was 94), guard-traps 77/77, events-summary 37/37,
  mix-card 99/99, event 69/69, yield 35/35, lint and build clean.
```

---

## Base check

`git rev-parse --short HEAD` → **`35eab0c`**; the brief names `c4e1f48`. One
commit apart, report-only. Flagged, proceeded.

## Decision recorded

In `test-data/EXPECTED.md`, before any code: Preview computes against the
event-scoped baseline, memoised on dims + month, agreeing with the saved row by
construction — recorded as **conditional on the measurement**, with the
fallback named.

## The measurement — taken before writing any component code

The brief made this the gate on which form ships, so it ran first, against the
**edge fixture Jon walked** (12,112 rows):

```
slice run:               6.90 ms   (mean of 20, after one warm-up)
narrow slice (Mobile Voice): 6.41 ms
```

**Threshold applied: 16.7 ms — one frame at 60 Hz.** The reasoning, stated so it
can be disagreed with: this run happens when the draft's **dims or month**
change, which are dropdown interactions, not keystrokes. A cost under one frame
on a discrete interaction is not perceptible; the same cost per character would
be. 6.90 ms is comfortably inside, so **option 1 ships and the fallback was not
taken**.

**The probe was honest about itself.** Its first run reported the "narrow" slice
at 6.29 ms — but the fixture's product column is `Product_L1`, not
`Product_Category`, so the narrow case had silently not narrowed and was
measuring the same thing twice. Corrected before the number was used. A
mislabelled measurement is worse than none, because it looks like evidence.

**Where the probe lived.** `scripts/_tmp_time_slice.ts` — the documented
exception for when repo module resolution is needed (the scratchpad copy could
not resolve `../src/...`). **Deleted in-session and verified**: `ls scripts/_tmp_*`
returns nothing and `git status` shows no untracked script. Disclosed here as
the rule requires.

## What shipped

### 1. One slice invocation, two callers

`eventScopeSeriesFor(draft, excludeId)` — extracted from the save path, and now
called by **exactly two** places: the save handler and Preview's memo. The spec
counts them, which is the agreement pin: if either grew its own call to
`computeAdjustedForecast`, the count moves and the two baselines could diverge
again.

**The edit-exclusion lives inside the shared function**, not at the call sites.
Both callers pass the editing id and the function decides — so the rule cannot
be applied on one path and forgotten on the other, which is the failure mode
that made this extraction worth doing rather than just copying the call.

### 2. The memo, and what is deliberately absent from its key

Keyed on the draft's **dims and month**. Not on the typed figures: changing a
dilution percentage recomputes the cheap arithmetic against the cached series
and pays nothing for the pipeline.

**`duration` is excluded, and that is a claim rather than an omission.** The
series is the blend *before* this event; how long the event would last cannot
change what the month's blend already was. Duration selects which months the
event applies **to** when applied — a different question. Stated because the
brief asked whether it belongs in the key, and the honest answer is no with a
reason rather than yes to be safe.

The memo returns `null` when no month is chosen, so the "select a month"
placeholder is never preceded by a pipeline run. Incomplete-dilution states are
unchanged.

### 3. A second mismatch, found while building and fixed here

Making Preview's **baseline** event-scoped surfaced that its **weighting
volumes** still came from `chartData` — the cohort series.

The weighting is a **ratio** (`pricedVol / totalVol`). Taking the ratio from the
cohort while the baseline comes from the event's slice produces a figure that
belongs to **neither** — which is precisely the "approximated weight is the
defect wearing a fix's clothes" problem this arc has been removing, arriving in
a new place through a door I had just opened.

`volumesFromSeries(series, month)` now takes the series as an argument, and
Preview passes the same event-scoped one its baseline came from. `monthVolumes`
is a thin wrapper over it for the cohort case, so there is still one reader.

## 4. Guard-traps 78 and 79

- **78** reverts Preview's baseline to the cohort series while the row stays
  event-scoped — reinstating exactly the disagreement this closes. Both figures
  stay plausible ARPUs for real slices; only a check that they come from one
  invocation can tell them apart.
- **79** puts the typed figures into the memo key, so every keystroke re-runs
  the pipeline. **Nothing renders differently** — the numbers stay right and the
  card simply does a full slice computation per character. No correctness check
  can see this; the key's contents are the only place it shows, which is why it
  needed its own trap rather than trusting the measurement to stay true.

## 5. The fifth expectation correction of this arc

I asserted **3** occurrences of `eventScopeSeriesFor(` — "1 definition + 2
calls". There are **2**: the definition reads `= useCallback(`, so it does not
match the pattern, and the two hits *are* the two call sites the check wanted.

Corrected with the reason recorded in the spec. That is now five such
corrections across this arc, every one a wrong expectation against correct code,
and every one caught by running rather than by reading. They are cheap in that
direction and expensive in the other — a number quietly adjusted to make a check
pass is indistinguishable later from a check that was always weak.

## 6. THE SAME MISMATCH REMAINS ON THE SAVED ROW — decision needed

The row's **baseline** is event-scoped (stored `originalBaseArpu`, since last
session) but its **weighting volumes** come from `monthVolumes(pe.month)` —
the **cohort** series. Identical in kind to the Preview mismatch fixed above,
and **not fixed here**.

It cannot be fixed the same way. Preview has one live draft and one memo; the
row renders **N saved events**, and an event-scoped series per row is N pipeline
runs at ~7 ms each on every render.

**Two routes, neither taken:**

1. **Store the volumes on the event** at save, beside `originalBaseArpu` — a
   carrier change (new fields, export columns, import, compat for events saved
   without them), and the same two-field-shape question R2/R3 answered twice.
2. **Memoise a per-event series map** keyed on each event's dims + month.
   Bounded by the number of distinct slices rather than by row count, but still
   unmeasured.

Flagged rather than resolved: it is a carrier decision with a compat story, and
this session's scope was Preview.

**Note what this means today:** the row's baseline and its adjusted figure are
computed on slightly different bases. For an event whose scope equals the loaded
cohort — the common case — they coincide exactly. The divergence appears only
for events narrower than the cohort, which is the same population the last two
sessions have been correcting.

## Gate

```
pricing-roundtrip spec:  101 passed, 0 failed   (was 94 — 7 new checks)
events-summary spec:     37 passed, 0 failed
mix-card spec (mounted): 99/99 passed          (untouched — no regression)
event-roundtrip spec:    69 passed, 0 failed
yield-roundtrip spec:    35 passed, 0 failed
guard-traps:             77/77 caught          (78 and 79 caught first run)
lint (tsc --noEmit):     clean
build:                   clean, 5.72s
```

## Where things stand

**Preview and the saved row now agree by construction** on the baseline — one
invocation, two callers, counted. The inconsistency the previous session
introduced knowingly and recorded is closed.

**Open:**

- **The row's weighting volumes** (§6) — decision needed.
- Market and yield apply-filters still hand-roll scope comparisons.
- `scenarioHelper` still ignores `target`/`cohortScope`.
- `spec:yield-roundtrip`'s `toRow` is still a copy; `yieldArpuMode` still not
  restored on reopen; R5's compounding limit still unmeasured.

## Limits of this check

**Still not mounted.** The pricing card has no mounted harness, so the rendered
Preview panel is **source-read**; the shared invocation, the caller count, the
exclusion rule, the memo key's contents and the volume source are machine-checked
at source level.

**The memo key is checked by SOURCE, not by call count.** Asserting "typing a
figure causes no pipeline run" behaviourally needs a mount with an instrumented
`computeAdjustedForecast`; the dependency array is the key, so the spec reads
the array. Stated rather than implied — and guard-trap 79 is what stops that
source check from being decorative.

**The 6.90 ms figure is one machine, one fixture, Node under `tsx`** — not a
browser render. It bounds the arithmetic, not the paint. It is the right order
of magnitude for the decision and should not be quoted as a browser measurement.

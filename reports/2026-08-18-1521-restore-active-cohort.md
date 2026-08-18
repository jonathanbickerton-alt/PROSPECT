# Restore — recording which cohort was active

## FOR ADVISOR

```
Generated: 2026-08-18 15:21 +0100 (UTC 2026-08-18 14:21)
Certifies: __PENDING__
Repo: __PENDING__
SKELETON CREATED AS THIS SESSION'S FIRST ACTION, before the base check.
BASE: HEAD e97e6ca vs the brief's f678be3 — one commit, REPORT-ONLY.
SHIPPED: an Active_Cohort block in Metadata, written VERBATIM from
  baseForecast.cohort — 'All'-bearing dims included, leaf and aggregate alike,
  absent entirely when nothing is active. One writer, one reader, shared.
RESTORE READS IT FIRST and resolves it THROUGH THE SEAM (resolveFromStore),
  never by store lookup — a store lookup is precisely what cannot find an
  aggregate, which is the whole defect.
THE FALLBACK IS RETAINED AND NOW ANNOUNCES ITSELF, in the SHELL not on Home — a
  restore navigates to the saved Active_Step. Dismissible, six locales.
IT ALSO COVERS A CASE THE BRIEF DID NOT NAME: a recorded cohort this store can
  no longer resolve announces too — honouring nothing silently is the same bug.
THE SPEC READS JON'S REAL 17 AUG SAVE and confirms the defect in the artefact:
  1,728 baseline rows, Is_Active='Yes' on ZERO, and no active-cohort block — so
  that file correctly takes the fallback. It SKIPS LOUDLY when absent.
Is_Active IS UNTOUCHED and ASSERTED so — compat, and the fifth marker site
  belongs to DQ's single-source-of-truth scope.
THE GATE CAUGHT TWO STALE ANCHORS OF MINE, re-aimed here: import-seam's
  1600-CHAR WINDOW (now structural) and trap 15's anchor. The 1600 is the SECOND
  character-distance proxy to break in this arc — a pattern, not an incident. §6.
NOTHING SHED. active-cohort 23/23 (new), import-seam 36/36, guard-traps 81/81,
  pricing 116/116, mix-card 99/99, event 69/69, yield 35/35, lint+build clean.
```

---

## Base check

`git rev-parse --short HEAD` → **`e97e6ca`**; the brief names `f678be3`. One
commit apart, report-only. Flagged, proceeded.

## Decision recorded

In `test-data/EXPECTED.md`, before any code: the active cohort is recorded **as a
cohort** in Metadata, leaf or aggregate alike; restore reads it before the
fallback; the fallback is retained for older files **and announces itself**;
`Is_Active` stays as it is, because it is the fifth `'All'` marker site and DQ
owns that.

## What shipped

### 1. The seam — one writer, one reader

`activeCohortMetaRows(cohort)` and `readActiveCohortMeta(get)` in
`forecasting.ts`, with the seven field names in **one shared list** so the two
sides cannot disagree about them. The spec drives both, per the
`marketEventExportRow` precedent.

**Written verbatim, `'All'` included.** An aggregate *is* an `'All'`-bearing
cohort; recording it is the entire point. `Is_Active` marks a match against a
**store** key and the store holds **leaves**, so a session viewing an aggregate
marked nothing — a flag on a row that does not exist cannot record a cohort that
has no row.

**Absent entirely when nothing is active**, and the reader returns `null` for a
missing block. That distinction is load-bearing: `null` is the signal to fall
back, so seven empty strings would be a *claim* ("the active segment was blank")
where silence is meant.

**`'All'` is kept verbatim on read.** This is a recorded **scope**, not a data
row, so the ScopeDims rule that `'All'` never comes from data does not apply —
stated in the source and asserted in the spec so the next reader does not
"correct" it.

### 2. Restore reads it first, and resolves through the seam

The recorded cohort's key goes to `resolveFromStore`, which derives an aggregate
from its leaves. **A store lookup is exactly what cannot find an aggregate**, so
resolving any other way would reproduce the defect while appearing to fix it.

The first-entry fallback remains, second.

### 3. The announcement — and a case the brief did not name

The notice fires when the fallback is used, and it is in the **app shell**, not
on Home. That is not decoration: restore navigates to the saved `Active_Step`
(Jon's file records `vsactuals`), so a notice on Home is one the user may never
see. Dismissible, six locales.

**It also fires when a recorded cohort cannot be resolved** — an older store, a
cohort since removed. The brief specified announcing for files with no block;
this covers both, because recording a cohort and then silently ignoring it would
be the same defect with an extra step. Written as `if (bf && !recordedBf)`, so
the condition is "we did not honour the record", not "the record was missing".

### 4. The spec, including Jon's real save

`spec:active-cohort` — 23 checks, driving the real seam.

The aggregate round-trip is the case that matters and is asserted directly.
There is an explicit **anti-vacuity control**: a present block must read back
non-null, or every absence check above it would pass under a reader that always
returned `null`.

**It reads Jon's actual 17 Aug save** and confirms the diagnosis in the
artefact: **1,728 baseline rows, `Is_Active='Yes'` on zero**, and no
active-cohort block — so that file correctly takes the fallback. When the file
is absent the spec **says so loudly and skips**, rather than passing on
something it never opened.

### 5. Guard-traps 82 and 83

- **82** drops the recorded-cohort read, so restore always falls through to the
  first stored cohort — the pre-fix behaviour exactly. Nothing errors and a
  forecast still loads; it is simply the wrong one, which is how this arrived as
  three separate-looking observations on a walk.
- **83** drops the announcement. The app is still wrong in the same way, but now
  says nothing — the half of the fix that turns a mystery back into a mystery.

Both anchors verified unique before planting.

### 6. Two stale anchors, caught by the gate and re-aimed

Restructuring the import site broke two checks. Neither was a product defect;
both are the anchor rule working, and both were re-aimed in this commit.

**The positive control fired first** — `guard-traps` refused to run at all,
reporting *"the spec is RED on the unmutated tree"*. That is the harness doing
its most valuable job: had it planted traps against a red baseline, all 81 would
have "caught" vacuously and reported a perfect score.

**`import-seam`'s window was 1600 characters.** It slices from a comment anchor
and asserts `resolveFromStore(` appears within. My added comment block pushed
the call to offset 2797, so the check went red against correct code. Re-aimed to
run from the anchor **to the legacy branch that follows it** — a structural
boundary, so anything added inside the branch stays inside the window.

**This is the SECOND character-distance proxy to break in this arc.** Mine was
600 characters two sessions ago, for the same reason: a distance that happened to
hold when written, silently coupled to unrelated text nearby. Both are now
structural. Worth naming as a pattern rather than two incidents — a proxy that
works today and nobody can see is a check that will fail, or stop firing, for
reasons unrelated to what it tests.

**Guard-trap 15 reported INCONCLUSIVE**, which is exactly the signal it exists to
give: its anchor `const bf = rawBf` no longer matched the restructured
expression, so nothing was planted and the trap tested nothing. Re-aimed at the
new shape, and its mutation still reproduces the shipped defect — collapsing the
whole expression so **both** the recorded and the fallback paths bypass the seam.

### 7. `Is_Active` is untouched, and the spec says so

Left exactly as it was, and **asserted** — so a later session cannot quietly
retire it here. It is compat, and it is the fifth site of the `'All'`
marker-meaning distinction that DQ's single-source-of-truth work owns. This
session touched none of the other four.

## Gate

```
active-cohort spec:      23 passed, 0 failed   (new; reads Jon's real save)
import-seam spec:        36 passed, 0 failed   (window re-aimed — see below)
pricing-roundtrip spec:  116 passed, 0 failed
events-summary spec:     37 passed, 0 failed
mix-card spec (mounted): 99/99 passed
event-roundtrip spec:    69 passed, 0 failed
yield-roundtrip spec:    35 passed, 0 failed
guard-traps:             81/81 caught          (82, 83 new; 15 re-aimed)
lint (tsc --noEmit):     clean
build:                   clean, 10.47s
```

## Where things stand

**Observation A of the 2026-08-18 diagnosis is closed.** A save now records which
cohort was on screen, aggregates included, and restore honours it — or says that
it could not.

**Observation B needed no code**, and still does not: a restored event applies
when the restored scope matches it, which is now the scope the user actually
saved from.

**Open, unchanged:** the `Is_Active` marker site and its four siblings (DQ);
market and yield apply-filters still hand-roll scope comparisons;
`scenarioHelper` still ignores `target`/`cohortScope`; `spec:yield-roundtrip`'s
`toRow` is still a copy; `yieldArpuMode` still not restored on reopen; R5's
compounding limit still unmeasured.

## Limits of this check

**Nothing is mounted.** The notice's rendering, its dismissal and its position in
the shell are **source-read** — asserted by structure (`data-testid` present,
dismiss handler present, and the notice appearing *before* `<StepIndicator>` in
the file). No check renders the banner.

**The restore path itself is not executed.** The seam is round-tripped for real,
and the wiring into `App.tsx` is pinned by source assertions — but no test loads
a workbook through the import handler and observes the resulting `baseForecast`.
That would need the import path driven headlessly, which no harness does today;
it is the same gap the restore-base spec works around.

**The real-save case proves the OLD file's shape, not the new one.** Jon's 17 Aug
save predates this change, so it exercises the fallback branch only. A save
written *after* this change was not produced or re-imported in this session —
the round trip is proven at the seam, not through a file written by the app.

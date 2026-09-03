# Zero-coverage events are not "applied"; D2-04 literal keyed

## FOR ADVISOR

```
Generated: 2026-09-03 08:57 +0100 (UTC 2026-09-03 07:57)
Certifies: 051a9b3
Repo: committed 051a9b3, pushed (origin in sync)
BASE: 0737ebf — report-only drift, no source drift. The STOP did not fire.
READERS OF appliedEventIds: EXACTLY THREE — App:558 (export), WhatIfTab:1559
  (hasEvent, reaching users via the chart export), WhatIfTab:3848 (caption).
GHOST AT ALL, before -> after: caption "1" beside +0.00 -> "0"; export id
  present -> absent; hasEvent true -> false; KPI 0.00 unchanged. AT THE LEAF:
  unchanged, 0 and "0" — out of scope there, for the OTHER reason.
  CORRECTION to the brief's premise: the expander did NOT show "does not
  apply" before. Phase 2 recorded the row, so users saw a TABLE OF ZEROES.
KEYS (2, all six locales): whatif_event_not_in_current_view and
  whatif_event_no_coverage_in_view. Two because the empty state now has two
  causes; the expander picks from the ENGINE's record, not by re-asking the
  predicate. No new caller of eventScopeMatchesView.
SCANNER — NO BLIND CLASS; the premise is wrong. scan-i18n:467 listed the
  string VERBATIM in I18N_PHASE2, the deferral allowlist: seen, bucketed
  "english-only (DEFERRED)", PASS. Widening the walk finds nothing. REAL GAP:
  I18N_PHASE2 is only READ (:474), never checked for staleness, so a deferral
  outlives its string — the context-file block already does that check.
PRS FALLBACK (decision in EXPECTED.md, NOT implemented): 2 of 55 specs reach
  it — scenario-arpu 2 cannot-answer (unchanged under the contract),
  view-apply-mounted 1 measured-zero, this session's own ghost, share
  discarded. Blast radius ZERO — so nothing today catches it going in wrong.
GATE: 126/126 · 55/55 · lint+build clean. Spec 18 -> 30, traps 125 -> 126.
```

## Base check

HEAD `a93c9a5` (this session's skeleton) on `main`, tree clean.
`git diff --stat 0737ebf..HEAD -- src/ scripts/ test-data/ package.json` EMPTY.
Drift is the two report files. The STOP did not fire.

## Item 1 — every reader of appliedEventIds

**Exactly three readers.** Five sites write it; three consume it.

| # | reader | what it does |
|---|---|---|
| 1 | `App.tsx:558` | the `Applied_Event_IDs` export column |
| 2 | `WhatIfTab.tsx:1559` | `hasEvent: m.appliedEventIds.length > 0` on chartData |
| 3 | `WhatIfTab.tsx:3848` | the KPI caption count |

Writers, for completeness: `forecasting.ts:3090` and `:3206` (origin and
return), `WhatIfTab.tsx:1053` (live path), `scenarioHelper.ts:256` (Compare
path), `App.tsx:1062` (restore from a workbook).

Reader 2 looks dead — nothing in `src/` reads `hasEvent` — but it is not.
Trap 119 records that the chart export writes `chartData` wholesale, so
`hasEvent` reaches the user as an export column. It is a real reader.

### What each showed for a zero-coverage event, before this change

Measured on the mounted card with a ghost event (in scope at All, coverage a
measured 0):

| surface | before | after |
|---|---|---|
| caption (reader 3) | **"1"** beside a Base delta of **+0.00** | **"0"** |
| export column (reader 1) | id present | id absent |
| `hasEvent` (reader 2) | `true` | `false` |
| KPI base delta | 0.00 | 0.00 (unchanged) |
| row expander | **a derivation table of zeroes** | the keyed empty state |

The expander line is worth stating precisely because it is not what the brief
anticipated. Phase 2 called `record(...)` for the event regardless of coverage,
so `rowsFor` was NOT empty and the empty-state sentence never rendered — the
user saw an arithmetic table whose basis, percent and delta were all zero.
Measured, not inferred: with the phase-2 record restored, the spec's
`expanderText` reads `null`, i.e. the empty state did not render.

### When coverage is genuinely 0 — and when it is not

This matters, because "coverage 0" is much narrower than it sounds. Both
weighting functions reserve their empty cases for something else:

- `eventCoverage` (`forecasting.ts:2925`, `:2931`) returns **1**, not 0, when
  no leaf under the view is populated, or when the view is populated but zero
  on this metric. Its comment says why: "rather than being silently dropped for
  want of history".
- `forecastCoverage` returns **null** — cannot answer, fall back — never 0.

So a 0 arriving at the engine is a measured ratio: the view IS populated on the
metric, and none of that population lies inside the event's target. That is the
only case this change acts on, and it is the case the EXPECTED.md decision of
2026-09-02 describes.

### A divergence found while measuring, NOT fixed — for Jon

`eventProRataShare` (`forecasting.ts:2853-2857`) has the mirror-image fallback
and it points the other way for the SAME ghost:

```ts
if (targetIdx.length === 0) {
  // No populated leaf under the event's target. Fall back to the legacy
  // all-or-nothing behaviour so the event is not silently dropped: it applies
  // in full to any cohort that the event's own dimensions match.
  return leafWithinScope(event, cohort) || leafWithinScope(cohort, event) ? 1 : 0;
}
```

For an event whose target matches no populated leaf, viewed at All:
`eventCoverage` returns **0** (the view is populated, the intersection is
empty), while `eventProRataShare` returns **1** (the target has no leaves, so
the legacy fallback fires). **A percentage ghost therefore moves nothing and an
absolute ghost applies at FULL magnitude.**

That contradicts the recorded decision — "an event matching no populated leaf
is COMMUNICATED and applied nowhere, consistently at every view".

**DECIDED, Jon 2026-09-03, and deferred: the rule covers absolute events too.**
`eventProRataShare` adopts the contract the coverage functions already have —
`null` when the denominator cannot answer, a real `0` when the target matches
no populated leaf, and the "don't silently drop it" fallback surviving only for
the cannot-answer case. Recorded in `test-data/EXPECTED.md` as its own dated
entry. **Not changed in this session on Jon's instruction**; the section
"eventProRataShare fallback" below is the brief for the follow-up.

## Item 2 — coverage 0 is not "applied"

`applyEventsToMonth` gains `coversNothing(e)` — `isPct(e) && (e.coverage ?? 1) === 0`
— and two effects:

- phase 1 records the id in a new `zeroCoverageIds` list and does NOT push it
  to `appliedIds`;
- phase 2 emits no derivation row, because a row of zeroes is arithmetic that
  did not happen.

**Applicability is not re-decided.** The predicate is untouched, no caller of
`eventScopeMatchesView` was added or changed, and the engine still never sees a
view's dimensions. This is the weighting RESULT gating the record, after the
engine has computed it.

`MonthApplication.zeroCoverageIds` is kept separate from `appliedIds` rather
than folded in, because a surface needs both: absence from BOTH lists means
"never in scope here", and that is a different fact from "in scope and empty".
`AdjustedForecastMonth.zeroCoverageEventIds` is optional so a workbook written
before today still restores.

## Item 3 — D2-04, the literal becomes keys

### Two keys, because the premise now has two causes

The empty state used to have one cause and now has two, so one string cannot
carry it:

| key | en |
|---|---|
| `whatif_event_not_in_current_view` | This event does not apply in the current view. |
| `whatif_event_no_coverage_in_view` | This event is in scope for the current view, but the view contains nothing it targets — so it changes nothing here. |

Both are in all six locales (856 keys each). Terminology follows what the
bundles already use rather than TERMBASE, which has no "view" row: view ->
Ansicht / vista / vue / vista / vista, event -> Ereignis / evento / événement /
evento / evento, matching `whatif_events_applied_to_adjusted_path`. No locale
value equals its English — asserted in the generator, not discovered in the
gate.

**The expander does not re-derive which case it is in.** It reads the engine's
`zeroCoverageEventIds`. Asking the scope predicate again would have put a
second answer to the same question in the codebase, which is the defect the
previous session spent itself removing.

### Why scan-i18n --check did not flag it — THE PREMISE IS WRONG

**There is no blind class here. The scanner saw the string and was told to
ignore it.**

`scan-i18n.ts:467` listed it verbatim:

```
"WhatIfTab.tsx::This event does not apply in the current view.",
```

That entry is in `I18N_PHASE2`, the explicit deferral allowlist. The string is
plain `JSXText`, `looksUserFacing` accepts it, the walk reaches it and pushes
it — and `bucketOf` then returns `9 english-only (DEFERRED phase 2)`, which is
a PASS. Measured, not assumed: with the literal restored, `--check` still
prints PASS.

So the scanner's traversal is not at fault, and **widening it would have found
nothing.** The entry is now removed, since the string is keyed.

**The real gap, and the one worth briefing: `I18N_PHASE2` is never checked for
staleness.** It is only ever read (`:474`). An entry naming a string that no
longer exists in source stays forever and is reported nowhere — so a deferral
silently outlives its subject, and the list slowly stops describing the code.

The precise shape of the fix is already in the file, one check away: the
CONTEXT FILE block does exactly this, reporting "0 documenting a key that no
longer exists". `I18N_PHASE2` and `TRANS_BACKLOG` need the same treatment —
every entry re-matched against the strings the scan actually found, and any
that match nothing reported. **Not done here, per the brief.**

## Item 4 — specs

`spec:view-apply-mounted` extended from 18 to **30 checks**.

The ghost is a percentage event targeting product `Satellite`, which exists in
no row and no leaf. Its first check asserts that it PASSES the scope predicate
at All — a ghost that failed the predicate would be excluded for the other
reason, and the whole case would test nothing.

Measured:

```
ghost      All delta 0 count 0     leaf delta 0 count 0
ghost copy en/de/it: ["This event is in scope for","Dieses Ereignis gilt für d","Questo evento rientra nell"]
```

At the leaf view the ghost is out of scope entirely, so its count is 0 for the
OTHER reason — which is why the expander there is asserted to show the
not-in-view sentence, and why both sentences are asserted to differ. Without
that pair, always showing one string would satisfy the other check.

The expander is opened by clicking its chevron via a new
`event-expand-<id>` testid, and its presence is asserted before its text is
read — a missing chevron would leave the text `null` and every copy check would
pass vacuously.

The de/it assertion (first in the shed order) was kept: it changes language and
asserts the rendered string differs from English AND is not the key name echoed
back, which is what i18next returns when a bundle is missing and what a bare
inequality test would accept.

### The trap, planted by hand

Trap **129**, `spec:view-apply-mounted`, 125 -> **126**.

It keeps the `zeroCoverageIds` record and restores ONLY the unconditional
push, so exactly one thing is wrong. That is deliberate: a trap that breaks
three surfaces at once cannot tell you which one the spec is pinning.

```
ghost      All delta 0 count 1   leaf delta 0 count 0
view-apply-mounted spec: 29/30 passed
  FAIL  ghost: and the caption EXCLUDES it at All  [1]
```

Caption "1" beside a delta of +0.00 — the exact shape trap 126 was written for,
one layer further in. Restored, 30/30 green.

## eventProRataShare fallback

**This section is the brief for the follow-up. Nothing here was changed, no
spec was written for it, and no trap guards it.** Jon's decision of 2026-09-03
is recorded in `test-data/EXPECTED.md`.

### The predicate, verbatim

`src/utils/forecasting.ts:2853-2858`:

```ts
  if (targetIdx.length === 0) {
    // No populated leaf under the event's target. Fall back to the legacy
    // all-or-nothing behaviour so the event is not silently dropped: it applies
    // in full to any cohort that the event's own dimensions match.
    return leafWithinScope(event, cohort) || leafWithinScope(cohort, event) ? 1 : 0;
  }
  if (cohortIdx.size === 0) return 0;
```

`targetIdx` is built immediately above it: the indices of leaves for which
`leafWithinScope(event, leaf)` holds, over `leavesByMetric[scenario]`.

### Which of the two cases does it fire on — BOTH

That is the whole of the defect. `targetIdx.length === 0` is true in two
different worlds, and the branch answers **1** for each:

| world | condition | what the answer should be |
|---|---|---|
| **cannot answer (0/0)** | `leaves` is EMPTY — no leaf exists for this metric at all | `null`, and the fallback to 1 survives here |
| **measured zero** | `leaves` is non-empty and NONE is inside the event's target (`inBoth = 0` with `inView > 0`) | `0` |

The line directly beneath it, `:2859`, already handles the other real-zero case
correctly — the target has leaves, but none of them is in the view. So the file
distinguishes measured-zero from cannot-answer one line later than it fails to
do so, which is what makes this a conflation rather than a policy.

This is the same two-meanings-of-null the project separated elsewhere:
`forecastCoverage` returns `null` rather than `0` for exactly this reason, and
its EXPECTED.md entry says so — "answering 0 would silently discard the event".
`eventProRataShare` is the site that still answers the two questions with one
number.

### What "thin cohort" means concretely

An absolute event reaches the fallback when **its target scope contains no leaf
in `leavesByMetric[e.scenario]`**. Those leaves are built in
`computeAdjustedForecast` from the loaded `data` rows, filtered by
`wiMetricCol === wiInflowVal | wiOutflowVal | wiRetentionVal`.

So the condition is not "a small cohort" — it is **no historical rows for the
event's own metric anywhere inside the event's target**. In practice:

- a product, tariff, channel or segment combination that is newly added and has
  no history yet — the case the fallback was written to protect;
- an **Outflow** event on a cohort that has never churned, or a **Retention**
  event on one with no retention rows: the cohort is thick in general and empty
  on that one metric, since the leaf set is per-metric;
- a target dimension value that exists nowhere in the loaded rows at all — the
  ghost case, which is a mis-scoped event rather than a thin one.

The first two are legitimate events on real cohorts. The third is not. The
branch cannot tell them apart, which is precisely why the contract has to.

### How many events in the repo's fixtures and specs hit it

Measured by instrumenting the branch, running all 55 spec scripts, and
restoring — the instrumentation counted only, changed no behaviour, and left no
residue (`grep -c __PRS__` = 0 afterwards; `tsc` clean; the diff of
`forecasting.ts` contains only this session's gating change).

Counting distinct event target SCOPES rather than ids, because
`eventProRataShare` is handed dimensions and never sees an event id.

| spec | cannot-answer hits | measured-zero hits | distinct scopes |
|---|---|---|---|
| `spec:scenario-arpu` | 2 | 0 | 1 |
| `spec:view-apply-mounted` | 0 | 1 | 1 |
| **all other 53 specs** | **0** | **0** | **0** |

**Two of fifty-five specs reach the branch at all.**

- The two `scenario-arpu` hits are the **cannot-answer** world. Under the new
  contract they keep returning 1 (as `null` resolved upstream), so their
  behaviour does not change.
- The single **measured-zero** hit is the ghost event added by THIS session, in
  the mounted spec. It is a percentage event, so its share is computed at the
  call site — `sharedVolume: e.subscriberVolume * eventShare(e)` runs for every
  applicable event — and then discarded, because phase 1 returns early for
  percentages. Changing its answer from 1 to 0 would therefore alter nothing
  observable even in the one place it occurs.

**So the measured blast radius of the follow-up, across every fixture and spec
in the repo, is zero.** That cuts both ways and the second half is the more
important: it means **no existing test exercises an absolute event on an empty
target**, so there is nothing today that would catch the change going in
wrongly. The follow-up must bring its own fixture — an absolute event whose
target matches no populated leaf, asserted at a containing view and at the leaf
— because the existing suite is silent on the case, not supportive of it.

## Gate

```
guard-traps: 126/126 caught, no MISSED, no INCONCLUSIVE (was 125)
full suite:  55/55 spec scripts green
lint:        tsc --noEmit clean
build:       clean
```

## Limits of this check

- The absolute-ghost divergence is reported, not fixed, and no spec pins it —
  Jon decided the contract on 2026-09-03 and deferred the change. An absolute
  event targeting an unpopulated slice still applies in full at any view its
  dimensions match.
- The fallback counts come from instrumenting the branch and running the 55
  specs. They measure what the SUITE reaches, which is not what the APP
  reaches: no walk save was replayed through it, so a real workbook may hit
  the branch where no spec does.
- The export column and `hasEvent` are established by source reading; only the
  caption and the expander are driven through the mounted card.
- `I18N_PHASE2` staleness is diagnosed, not fixed, per the brief. Nothing yet
  prevents the next deferral from outliving its string.

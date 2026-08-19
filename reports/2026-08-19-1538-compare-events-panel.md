# Scenario Compare — one events summary per loaded file

## FOR ADVISOR

```
Generated: 2026-08-19 15:38 +0100 (UTC 2026-08-19 14:38)
Certifies: ac141ca (this report filled one commit later)
Repo: committed ac141ca, pushed (origin in sync)
SKELETON CREATED AS THIS SESSION'S FIRST ACTION, before the base check.
BASE: HEAD fc60a1a vs the brief's c426521 — one commit, REPORT-ONLY.
SHIPPED: one collapsed panel per loaded file, below the file cards, reusing
  the R4 table and the four R4 summarisers VERBATIM. No gap found; no variant.
THE SPEC WAS VACUOUS AND I CAUGHT IT BY ASKING WHAT TRAP (a) WOULD REDDEN.
  It composed the parse itself, mirroring the tab's memo — so the app could
  have been pointed at the merged list and all 20 separation checks would have
  stayed GREEN. Fixed by extracting buildPerFileEventPanels and driving THAT.
  A spec that mirrors the code under test certifies its own mirror.
TAB, NOT WORKER — against the brief's preference, on a MEASUREMENT: the parse
  costs 0.50 ms for 1,200 events across four files. The expensive half (xlsx
  decode) is already in the worker; moving this half would pull forecasting.ts
  into a second bundle to save half a millisecond.
THE R4 TABLE IS NOW ONE COMPONENT WITH TWO CALLERS. Copying the markup was
  the alternative — the fifth-writer failure mode applied to a render, and it
  drifts more quietly, because two tables that look alike are never compared.
PARSED AS 'session': a Compare upload IS a PROSPECT save. 'workbook' would
  mint ids and negate already-signed Outflow volumes. Asserted both ways.
LAYOUT CALL: below the cards, stacked — a table inside a 4-across card grid
  would render Scope, the widest and most load-bearing column, unreadable.
GATE GREEN: 88/88 traps. FOUR ANCHORS RE-AIMED after the table moved — the
  positive control fired first and refused to run, which is it working.
```

---

## Base check

`HEAD` **`fc60a1a`**; the brief names **`c426521`**. One commit apart,
**report-only** (the FOR ADVISOR fill). Established drift pattern, flagged and
proceeded. Working tree clean at start, `origin` in sync.

## 1. The typed parse per file — tab, and why

**Decided: the tab, memoised on `parsedSessions`.** The brief prefers the worker
*if* typed events cross `postMessage` cleanly. They do — `MarketEvent`,
`YieldEvent` and `PricingEvent` are plain interfaces of strings, numbers,
booleans and `Record<string, number>` maps, with no `Date`, no functions and no
class instances, so structured clone handles them. **The preference's condition
is met and I went the other way anyway**, on a measurement:

```
   10 events/carrier/file × 4 files (  120 events): median 0.09 ms
  100 events/carrier/file × 4 files (1,200 events): median 0.50 ms
 1000 events/carrier/file × 4 files (12,000 events): median 3.24 ms
```

Four files is the hard cap the tab already enforces, and a realistic save
carries tens of events per carrier — so **1,200 events is generous and 12,000 is
fiction**. Against that, the worker chunk is a separate 333 kB bundle importing
only `xlsx`; putting the parse there would pull `forecasting.ts` and `date-fns`
into it, duplicating what the 2 MB main bundle already holds, to move half a
millisecond off the main thread.

**The expensive half is already in the worker.** The xlsx decode is the part
worth isolating and it is isolated. Moving the cheap half across the boundary
buys nothing measurable and costs a second copy of a module.

**Once per file load, not per render**: the memo depends on `parsedSessions` and
`t` alone, so filter changes, chart toggles and renames do not re-run it. Pinned.

## 2. The panel

**One panel per loaded file, collapsed by default, below the file cards.**

**The layout call was below rather than beside**, and the reason is the Scope
column. The file cards sit in a four-across grid, so a table inside one would be
about 200px wide — and Scope, which says *which cohort an event hits*, is both
the widest column and the one carrying most of the table's information. Stacked
below, every panel gets full width. Header is the file's display name (the
user's rename if they have set one) plus its event count.

**Collapsed-by-default is carried by absence**: a file with no entry in the open
map is closed. Seeding a key per file on load would work equally well and would
then need keeping in step with add and remove; this cannot fall out of step.

**The four summarisers are called verbatim — no gap found.** `buildEventsSummaryRows`
already takes exactly `{ marketEvents, yieldEvents, pricingEvents }`, already
sorts into pipeline order, and already routes a market event to the promotion or
volume summariser by `isPromotion`. Every R4 decision came across untouched
because it is *the same function*: order stated in words, describe-never-re-derive,
name fallback flagged by presence.

### The R4 table became one component with two callers

`EventsSummaryTable` is extracted from `WhatIfTab`. The alternative was copying
the markup, which is **the fifth-writer failure mode applied to a render** — and
a copied table drifts more quietly than a copied row literal, because two tables
that look alike on screen are never compared by anyone.

It **renders only**. It does not build rows, and the spec asserts that it does
not, so describe-never-re-derive cannot be lost by someone reaching for the raw
events inside the render. `testIdPrefix` exists because Compare mounts several at
once and a fixed testid would address whichever rendered first.

## 3. Empty and partial files

A file with no events yields **no rows**, so the panel shows R4's empty-state
key — reused, not reinvented. A carrier with no events contributes **no rows and
no placeholder**: file B in the spec has no yield events and its panel holds
exactly its market and pricing rows, with no yield pass present at all.

## 4. The spec, and the vacuity it started with

`spec:compare-events-panel` — **53 checks**.

**It was vacuous when first written, and the thing that caught it was asking
what guard-trap (a) would actually turn red.** The file composed the parse
itself, mirroring the tab's memo. Every separation assertion therefore exercised
*the spec's own composition*: the tab could have been repointed at the merged
event list and all twenty separation checks would have stayed green.

The fix is the one this codebase keeps arriving at — **the thing being asserted
had to become reachable**. `buildPerFileEventPanels` is now a real function in
`forecasting.ts`, the tab calls it, the spec drives it, and the separation checks
fail if the *app* merges files.

Two details that follow from that and are worth stating, because each would have
re-hollowed the check:

- **Both files go through ONE call.** Building each panel from a single-file list
  could never observe a cross-file leak — there would be nothing to leak from.
  The tab passes every loaded session at once, so the spec must too.
- **Every event is file-unique AND carrier-unique.** `A Yield Segment` cannot be
  confused with `B Market Segment`, so a failure names both the file that leaked
  and the carrier it belongs to.

**Pipeline order is checked where months fight it.** File A's yield event is
`2026-01` and its pricing event `2026-02`, while both market events are `2026-06`
and `2026-07`. A month sort would invert the panel completely; the check asserts
the exact id order and, separately, that the earliest-month event is *not* first.
A fixture where months happened to agree with pass order would pass under a plain
month sort and prove nothing.

**Expected strings are hand-written**, never computed by the function under test
— `'Inflow +1,200'`, `'Inflow mix, 2 bands → 16.00'`, `'25% → 20% dilution'`. The
dilution row is asserted both ways: the framing is present **and** the derived
rate `6.6` is absent, since restating it is precisely the re-derivation R4
forbids.

**`isPromotion` routing** is asserted on the string trap the seams session named:
`Is_Promotion: 'No'` must take the volume card, `'Yes'` the promotion card, and
the two must differ. A parse that skipped `readStoredEventModifiers` would make
`'No'` truthy and send both to the promotion summariser.

**The parse source is asserted**: stored ids survive, and an Outflow volume is
**not** re-negated — which `'workbook'` would do to a save that already holds
signed quantities.

## 5. The traps

**89 — the panels read the merged event list.** Each panel then shows every event
from every loaded file, which looks busy and plausible rather than broken, and
defeats the one thing this tab exists to do. This trap is the reason the
extraction in §4 mattered: while the composition sat in a component memo, there
was nothing here for it to hit.

**90 — the yield carrier is dropped from the per-file parse.** The panel still
renders, still lists market and pricing rows, and silently omits an entire card's
worth of events — the same shape as the Compare filter defect one surface along.
Only a check naming a yield-exclusive value can tell.

## The four stale anchors, and the control that caught them

**The positive control fired on the first guard-traps run and refused to
proceed** — a spec was red on the unmutated tree. That is the control doing
exactly its job: without it, 88 traps would have run against an already-failing
spec and reported catches none of them had earned.

All four failures were **stale anchors from moving the table**, and all four
were stale in the direction that FAILS rather than the direction that passes
quietly:

- three in `events-summary` grepped `WhatIfTab` for the order note, the empty
  state and the height cap — all now in `EventsSummaryTable`;
- one in `pricing-roundtrip` counted three Name headers sharing one label key
  and found two, because the third moved with the table.

Each was re-aimed to follow the code, and each keeps its exact count: the
pricing check still demands **three**, now across both files the headers live
in, because a fourth list arriving with its own vocabulary is precisely what it
exists to catch. `events-summary` gained a check that the caller passes rows to
the shared component, so a re-inlined table would fail there too.

**The projection check deliberately stayed on `WhatIfTab`.** Building rows is
the caller's job; the shared component renders and must never build.

## Gate

```
compare-events-panel:    53 passed, 0 failed   (new)
guard-traps:             88/88 caught, 0 missed, 0 inconclusive
events-summary:          38 passed, 0 failed  (was 37 — re-aimed +1)
pricing-roundtrip:      116 passed, 0 failed  (re-aimed)
compare-filter:          24 passed, 0 failed
fromrow-equivalence:     49 passed, 0 failed
yield-roundtrip:         56 passed, 0 failed
event-roundtrip:         72 passed, 0 failed
scenario-pricing:        16 passed, 0 failed
active-cohort:           23 passed, 0 failed
import-seam:             36 passed, 0 failed
mix-card (mounted):      99/99 passed
lint (tsc --noEmit):     clean
build:                   clean (6.18s)
```

## Where things stand

**The Scenario Compare arc is closed.** The filter populates from all three
carriers, and each loaded file now says what it contains. Per EXPECTED.md,
**DQ is next, no exceptions.**

**Open:** `spec:fromrow-equivalence` is now due for retirement — the seams have
moved on under their own specs, which is exactly the condition its header names;
the yield pass's private scope filter in `scenarioHelper`; `yieldArpuMode` not
restored on reopen; full apply-path unification.

## Limits of this check

**Nothing is mounted.** The builder, the summarisers and the ordering are
machine-checked end to end; that the panels *render*, collapse and expand is
**source-read** — no check mounts `ScenarioCompareTab` or `EventsSummaryTable`.
The extracted table is the same markup that has been shipping in What-If, which
is an argument and not a check.

**No real workbook was loaded.** The fixtures are constructed sheet rows using
each carrier's real column names. That an actual multi-file Compare upload
produces these panels is inferred from the seams' own round-trip specs, not
observed here.

**The 0.50 ms measurement is a Node measurement**, not a browser one, and it
excludes React's render of the resulting rows. It is a measurement of the parse,
which is what the worker-vs-tab decision turned on; a panel with hundreds of rows
open would cost render time this figure does not cover.

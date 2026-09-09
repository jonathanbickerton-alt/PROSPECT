# REQ-D6-02 delta-month selector — STOPPED at the diagnosis

```
FOR ADVISOR
Generated: 2026-09-09 09:48 +0100 (UTC 2026-09-09 08:48)
Certifies: 3da3da6 (unchanged tree; the gate below re-proves it)

BASE de66add + b3b50d7/3da3da6 (reports/ ONLY; ZERO drift). Proceeded.
STOPPED AT 1(c) AS THE BRIEF DIRECTS: no code, no EXPECTED.md entry, no traps.
1a END OF PERIOD = LAST FORECAST MONTH, never the chart window: Base :4501,
   ARPU :4554/5. The 6/12/18/24 buttons :4907 drive ONLY the <Brush> :5053.
1b PER-MONTH, both. ARPU is already UNROUNDED (scenarioArpu[k].arpu :4557 vs
   band mean :4558); Base reads the 2dp columns :1844-45 — see 1c.
1c **THE STOP.** Adjusted revenue IS a lookup (scenarioArpu[k].revenue), but
   BASELINE revenue is NOT stored: `bArpu x baseVol` is computed AND rounded
   at :959, and for BASE that volume is `newBBase`, a loop local :1278 —
   types:125-138 has no base band. A NEW ENGINE FIELD, not a lookup.
1d NOT a STOP: WhatIfTab has `data`/`wiDateCol`/`wiValueCol` (:15/:18/:41),
   but App:366-381 would be a THIRD "has actuals" (Step 3's is cohort-scoped).
1e Base = STOCK at M, LAGGED (:1278 M-1 flows; pools :1827); Inflow/Outflow/
   Retention = FLOWS in M. Revenue = rate x that row's own volume.
ONE LINE FROM JON: persist the baseline base stock — better, the four
   baseline revenues where :959 computes them — or ship Revenue flows-only.
GATE, serial, unchanged tree: guard-traps 177/177 CAUGHT, 0 MISSED/INCONC/
   CRASHED, TARGETS restored (ai-hold-spec.ts's 78e06de change re-proved).
   suite 61/61, ai-hold 13/13, event-toggle 112/112, view-apply 168/168,
   trap-anchors 189/189, survival 104/26+27/27, i18n 200/200 (874 x 6), tsc 0,
   lint + build clean. 177 not 180 — no traps built. Next free id 182.
```

## Base

`git log --oneline -1` read `3da3da6` — `de66add` plus **two reports-only
commits** (this arc's inventory skeleton and its report). `git diff de66add
--stat` is those two files and nothing else. The permitted case.

## The STOP, and why it is (c) rather than (d)

The brief's two STOP conditions were checked separately. **One fires.**

### (c) fires — baseline revenue is not a lookup

The decision requires *"Every delta subtracts UNROUNDED adjusted minus baseline
at the month and rounds once (e5f1e79's rule) — never from the 2dp chartData
columns."* For the Revenue card that needs both halves unrounded, per scenario,
per month.

**Adjusted is fine.** `ScenarioArpuResult` carries `revenue: number | null`
beside `arpu` and `volume` (`src/utils/scenarioArpu.ts:81-89`), and it is on the
month record at `adjustedMonths[i].scenarioArpu[k]`. A lookup.

**Baseline does not exist.** It is computed and immediately rounded, inside the
row loop:

```
src/components/WhatIfTab.tsx:959
  out[`${label} Revenue (Baseline)`] = bArpu === null ? null
                                     : +(bArpu * baseVol).toFixed(2);
```

For the three flow scenarios `baseVol` is `m.baseline.{inflow,outflow,
retention}` — on the record, so those three could be re-multiplied outside.
**For Base it is `baselineBase`, which is the loop local `newBBase`:**

```
src/components/WhatIfTab.tsx:1278
  const newBBase = Math.max(0, p_bBase + p_prevBBaseIn - p_prevBBaseOut);
```

`newBBase` has exactly four readers and every one is inside the loop: the 2dp
column (`:1844`), the `perScenarioColumns` argument (`:1869`), and the
carry-forward (`:1876`). Nothing persists it.

**And nothing else holds it either.** `BaseForecastMonth`
(`src/types/forecast.ts:125-138`) carries `inflow`, `retention`, `outflow` and
the four ARPU bands — **no base volume band**, because base volume is never
fitted; it is reconstructed at read time from the seed rolled through flows.
The one `derivedBase` field in the type file (`:651`) belongs to `ActualMonth`,
the actuals shape, not the forecast.

So the unrounded baseline Base revenue at month M is unavailable to any
consumer outside `computeAdjustedForecast`'s loop. Producing it means the
engine persisting a new per-month field — **new engine work, not a lookup**,
which is precisely the condition the brief said to stop on.

The 2dp column `Base (Baseline)` (`:1844`) is the only survivor, and reading it
is the subtract-after-round shape `e5f1e79` removed — which the decision
explicitly forbids and which item 3(e) asks a spec to pin *against*.

**A second, smaller instance of the same problem:** even for the three flows,
re-deriving `bArpu × baselineVolume` outside `perScenarioColumns` would be a
second implementation of the expression at `:959`. One of them would eventually
drift from the other. That is the parallel-implementation shape this codebase
has removed repeatedly, and it argues for the same fix — one producer,
persisted — rather than a caller-side copy.

### (d) does not fire, but it is a finding

The brief's test is *"if (d) has no source the What-If step can read"*. It has
one. `WhatIfTab` already receives `data` (prop `:15`), `wiDateCol` (`:18`) and
`wiValueCol` (`:41`) — the exact three the import modal's *already loaded* test
uses (`App.tsx:366-381`: a month has actuals iff some row for it has a
non-blank, non-zero value).

So the exclusion is buildable. But it would be the **third** definition of "a
month has actuals" in the codebase:

1. the import modal's, `App.tsx:366-381`;
2. Step 3's, via `cohortActualsMap` → `effectiveActualMap`
   (`ForecastVsActualsTab.tsx:786-832`), scoped to forecast coverage;
3. a new one in Step 2.

They would not agree. Step 3's is cohort-scoped; the modal's is not; a Step 2
copy would have to choose, and the option list is a **view-level** question
while the actuals are **cohort-level** data. This is reported, not resolved —
it is a decision, and the standing rule is one predicate per concept
(`isEventOn`, `eventScopeMatchesView`, `eventRowId`, `effectStatusOf`).

## The five answers in full

### (a) What "end of period" indexes today

**The last month of the forecast horizon**, for both cards — not the chart
window.

```
WhatIfTab.tsx:4501  const last = chartData[chartData.length - 1];
WhatIfTab.tsx:4502  const baseDelta = last['Base (Adjusted)'] - last['Base (Baseline)'];
WhatIfTab.tsx:4554  const lastAdj = adjustedMonths[adjustedMonths.length - 1];
WhatIfTab.tsx:4555  const lastFc: any = baseForecast?.months?.[adjustedMonths.length - 1];
```

The two expressions name the same month structurally: `chartData` is
`computed.map((m, idx) => …)` (`:1269`) over `adjustedMonths`, which is pushed
once per forecast month (`:1111`, `:1186`). Same length, same order.

The horizon is **fixed at 24** — `const [stdForecastLength] = useState(24)`
(`App.tsx:162`), no setter destructured, no component reading the name.

**The 6/12/18/24M buttons are not a horizon.** They are at `:4907-4915`, set
`windowSize` (`:1999`, default 12), and `windowSize` has exactly one other
reader — the `<Brush>`'s `endIndex` at `:5053`. The brush scrolls the rendered
x-range over the full `data={chartData}` (`:5021`); it does not slice. So the
cards are already horizon-scoped while the chart beside them is window-scoped.
Item 3(d)'s check — changing the window must not change the option list — is
therefore already true of the data and would only be pinning it.

### (b) Do the deltas exist per month

**Yes, both, and neither is an end-of-period computation** — the card picks the
last index and any other index would work.

- **Base**: `chartData[M]['Base (Adjusted)'] - chartData[M]['Base (Baseline)']`,
  both 2dp (`:1844-1845`). Per-month, but *rounded*; the unrounded pair are the
  loop locals of (c).
- **ARPU ×4**: unrounded on the record — `RAW_SOURCE` (`:4548-4553`) maps each
  scenario to `adjustedMonths[i].scenarioArpu[k].arpu` (`:4557`) and
  `baseForecast.months[i][bandKey].mean` (`:4558`), with a finiteness guard
  and a `null` rendering an em dash (`:4559-4561`, card `:4870`).

Month-record fields (`types/forecast.ts:547-625`):
`baseline{inflow,retention,outflow,arpu}`, `uplifted{…}`, `scenarioArpu`,
`appliedEventIds`, `zeroCoverageEventIds`, `appliedArpuIds`,
`arpuCandidateIds`, `preFloor`, `derivations`, `flooredMetrics`. **No base
volume.**

Note for the decision: moving the ARPU card to month M is a pure index change
and already satisfies "unrounded, rounded once". Moving the **Base** card to
month M is also just an index change, but it inherits today's 2dp columns — so
"never from the 2dp chartData columns" tightens the Base card too, not only the
new Revenue one. That is a second consumer of the same missing field.

### (c) Revenue per month per scenario — see the STOP above

Sixteen columns exist and are 2dp (`perScenarioColumns`, `:940-969`, called
`:1869`); adjusted has an unrounded source, baseline has none.

### (d) Actuals on the What-If step — see above

### (e) Stock vs flow

| displayed quantity | at month M |
|---|---|
| Base Volume Delta | **stock at M**, lagged — an event in M moves it in M+1 (`:1278`) |
| Inflow / Outflow / Retention ARPU | rate on M's own **flow** |
| Base ARPU | rate on the **stock** at M, and pools reach it only once delivered: `p_eventPools.filter(p => p.eventMonthIdx < idx)` (`:1827`) |
| any Revenue | rate × **that row's own** volume (`:959`, `:963`) — so Base revenue inherits the stock lag and the flows do not |

The decision says "no new stock-vs-flow caption", which is fine at end of
period where nobody asks. At month 3 of 24, a reader comparing the Base card
against the Inflow row is comparing a lagged stock with a flow. Recorded as a
watch, not an objection.

## What would unblock the build

One field, and the rest follows:

1. **Persist the baseline base stock per month** on `AdjustedForecastMonth` —
   `newBBase` is already computed at `:1278`; it is thrown away. With it, all
   four baseline revenues are derivable unrounded, and the Base *volume* delta
   also stops needing the 2dp columns.
2. **Better: persist the four baseline revenues themselves**, computed where
   `perScenarioColumns` already computes them (`:959`), so there is one
   producer and no caller-side re-multiplication. The columns keep rounding
   their own copy, exactly as ARPU does today.

Either is engine work inside `computeAdjustedForecast`, which the brief's STOP
reserved to Jon. **One line settles it:** authorise the field, or ship the
Revenue card with the three flow scenarios only and no Base row.

If the field is authorised, nothing else in the brief looks blocked: the
selector, the option list, the shared card component, the sweep, the specs and
the three traps are all ordinary work on top of it.

## What was NOT done

- **No code.** No file under `src/` or `scripts/` was touched.
- **No EXPECTED.md entry.** REQ-D6-02 is *not* recorded. The brief orders the
  record before code, and the STOP precedes both — recording a decision whose
  Revenue limb cannot be built as written would put a specification into the
  terrain that the code cannot satisfy, and EXPECTED.md is the terrain. The
  decision text is preserved verbatim in the brief and in this report's header
  for whoever records it next.
- **No traps, no new spec.** `next free trap id` is **182** (max of 177 ids;
  registry not id-ordered) for whoever picks this up.

## Gate re-proof

The brief noted `scripts/ai-hold-spec.ts` changed at `78e06de` while
guard-traps was last run at `d63e67a`, and asked this session's run to re-prove
it. That is independent of the build, so it was run even though the build
stopped. Serial, guard-traps to a FILE, one instance.

```
guard-traps        177/177 CAUGHT   0 MISSED / 0 INCONCLUSIVE / 0 CRASHED
                   TARGETS restored — git status clean after the run
suite              61/61 green
spec:ai-hold       13/13            <- the change at 78e06de, re-proved
spec:event-toggle  112/112
spec:view-apply-mounted 168/168
spec:trap-anchors  189/189 (177 traps, 184 anchors, ids unique by number)
spec:survival      104 dereferences across 26 files; 27/27 checks
spec:i18n-parity   200/200; 874 keys per locale, all six equal
tsc 0              lint clean        build clean (9.30s)
```

**177, not the 180 the brief expected**, because the three traps were not
built. `next free trap id` is **182**.

**The background run reported "failed" and did not fail.** guard-traps itself
printed `exit=0`; the non-zero status came from the last command in my own
chain — `grep -c` on MISSED/INCONCLUSIVE/CRASHED, which exits 1 when it finds
nothing, which is the result we wanted. Recorded because a "failed" gate
notification that was actually a clean run is exactly the sort of thing that
gets misremembered as a red gate.

## Limits

- **The tree is unchanged**, so this report certifies a diagnosis, not a
  change. There is no `Repo:` line because nothing was committed but this
  report and its skeleton.
- **Line numbers were re-read this session** at `de66add` + reports-only
  commits; they drift on the next `WhatIfTab.tsx` edit.
- **Nothing was mounted.** The stock/flow answers are read off the engine's
  arithmetic, not measured from a rendered card.

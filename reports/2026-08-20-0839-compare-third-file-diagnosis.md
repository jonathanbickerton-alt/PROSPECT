# Scenario Compare — the chart dies when a third file is added

## FOR ADVISOR

```
Generated: 2026-08-20 08:39 +0100 (UTC 2026-08-20 07:39)
Verified against: 9c61095
Repo: __PENDING__
SKELETON CREATED AS THIS SESSION'S FIRST ACTION, before any check ran.
READ-ONLY DIAGNOSIS — no source changed.
BASE: HEAD 9c61095 vs the brief's 5e91b73 — one commit, REPORT-ONLY.
DATA IS IDENTICAL ACROSS RENDERING AND BROKEN STATES. Six states through the
  real paths — every one 24 rows, ONE key-set, 0 missing, 0 non-finite, window
  {0,23}. Per the brief's own instruction: the defect is RENDER-SIDE ONLY.
A THROW IS ELIMINATED, not assumed: the ONLY ErrorBoundary is at the app root
  (main.tsx), so a throw in the chart subtree would blank the WHOLE app. Jon's
  panels below rendered fine, so nothing threw.
MECHANISM — THE CHART CARD IS THE SOLE flex-1 AMONG shrink-0 SIBLINGS, and
  min-h-0 lets it reach ZERO. At zero the SVG has no height: no lines, NO
  Y-AXIS, no message (gate passed, data fine), no scrollbar. Every detail.
COMPUTED COST OF A THIRD FILE: 53px at >=1024px wide, 149px at 768-1023px
  (the card grid ALSO wraps). Collapses at <=720px vh (lg), <=800px (md).
CLASSIFICATION: the silent-collapse mechanism NEVER WORKED — latent since the
  tab was written. The THIRD-FILE TRIGGER is INTRODUCED BY ac141ca (panels):
  before it, a third file cost 0px at lg. Not 5e91b73 — that touched no layout.
PHANTOMS CONFIRMED, INERT IN THE CHART: a ['Note'] sheet parses to date="",
  matching no month. NOT the chart-killer. User-visible: row reads "undefined 0".
THE NOTE GUARD EXISTS — NINE TIMES IN App, ZERO IN THE WORKER. The convention
  is real and the new consumer never learned it.
DECISION NEEDED: one devtools reading confirms the mechanism — see Decisions.
```

---

## Base check

`HEAD` **`9c61095`**; the brief names **`5e91b73`**. One commit apart,
**report-only** (the FOR ADVISOR fill of the brush-window report). Established
drift pattern, flagged and proceeded. Working tree clean at start, `origin` in
sync. Read-only throughout: no source file was modified.

## 1. The count transition, replicated — no difference at all

Six states built through the **real** worker parse, the **real**
`computeScenarioForFilter`, and the **real** `chartData` merge, at
All Segments / All / All, Base view:

```
RENDERS  2155+1351        rows=24  key-sets=1  missing=0  nonFinite=0  window {0,23}
RENDERS  2155+1349        rows=24  key-sets=1  missing=0  nonFinite=0  window {0,23}
BROKEN   2155+1351+1349   rows=24  key-sets=1  missing=0  nonFinite=0  window {0,23}
TRIO-B   2155+1349+1211   rows=24  key-sets=1  missing=0  nonFinite=0  window {0,23}
TRIO-C   2155+1351+1211   rows=24  key-sets=1  missing=0  nonFinite=0  window {0,23}
QUAD     all four         rows=24  key-sets=1  missing=0  nonFinite=0  window {0,23}
```

`nonFinite` counts **every** numeric value in every row, not only the plotted
keys. Months are `2026-07..2028-06` in all six. Each row carries exactly the same
key set as every other row in its state.

**There is no structural or numeric difference between a rendering state and the
broken state.** The brief's instruction applies literally: *the defect is
render-side only*, and item 4 becomes the primary line.

This also disposes of "this trio": TRIO-B and TRIO-C are as clean as the pair,
so no combination of files produces bad data.

## 2. Count-coupled code, enumerated

| site | varies with file count | verdict |
|---|---|---|
| `COLORS[i % COLORS.length]` (`:505`, `:584`) | yes | **safe** — modulo, 4 colours, cap is 4 |
| `parsedSessions.length + files.length > 4` (`:81`) | yes | **safe** — rejects the 5th before parsing |
| `disabled={… parsedSessions.length >= 4}` (`:322`) | yes | safe |
| `chartData` memo deps (`:265`) | via `parsedSessions` | safe — identity change re-runs it |
| `useEffect(… , [chartData.length])` (brush reset) | **no** | length is 24 in every state; **the effect does not even fire** on a file add |
| file-card grid `lg:grid-cols-4` (`:581`) | yes | **height changes at md**: 3 files wrap to 2 rows |
| events panels `flex flex-col gap-2 shrink-0` (`:631`) | yes | **height grows one row per file** |

**No off-by-one and no exhausted fixed-length structure.** The pattern-match was
available and is wrong — which is the third hypothesis this arc has had to
discard on measurement rather than argument.

**The brush reset does not race anything.** `chartData.length` is 24 before and
after the third file, so `[chartData.length]` does not change and the effect does
not re-run. `windowOffset` stays 0 and `windowBounds(0,'all',24)` is `{0,23}` in
every state. The brush is exonerated here.

The two rows that *do* vary are both **vertical space**, and that is the finding.

## 3. The phantoms through the passes

**Confirmed, exactly as the advisor described.** In 1349 and 1351 the
`Market_Events` and `Yield_Events` sheets are placeholders — header `['Note']`,
one row:

```
mkt[0]: {"Note":"No market events defined"}
yld[0]: {"Note":"No yield events defined"}
```

`buildPerFileEventPanels` parses them anyway:

```
[Volume] "Unnamed volume event"  adjusts="undefined 0"                 when=""
[Value]  "Unnamed value event"   adjusts="Inflow mix, 0 bands → not known"  when=""
```

`"undefined 0"` is the literal string `undefined` reaching the user — the phantom
market event has `scenario=undefined`, `segment=undefined`, `date=""`, volume 0.

**They cannot kill the chart, and the reason is precise: `date=""`.**
`computeScenarioForFilter` applies a market event only when its date equals an
aggregated month (`:190-204`), and no aggregated month is the empty string. The
yield phantom has `month=""` and is gated the same way; its mix is `{}`, so even
if it applied there is no bucket to blend. That is why the 2155+1351 pair rendered
normally despite carrying identical phantoms — **month-gated, not swallowed**, and
the measurement in §1 confirms no `NaN` reaches `chartData` in any state.

The phantoms also do not reach the filter populate: `collectEventScopeDims`'s
`val()` returns null for a missing cell, and a Note row has no scope columns.

**So the phantoms are a confirmed defect of their own, and are not this bug.**

## 4. The render gate — why nothing was said

Two candidates, and one is eliminated outright.

**A throw is eliminated.** The only `ErrorBoundary` in the codebase is at the app
root (`main.tsx:12`), wrapping `<App/>`. A throw anywhere in the chart subtree
would therefore unmount **the entire application**. Jon's screenshot shows the
events panels rendering normally below the dead chart region, so nothing threw —
and no boundary swallowed anything, because there is no boundary at that level to
swallow it.

**A poisoned axis domain is eliminated** by §1: every plotted value is finite.

**What remains is the layout**, and it is a positive finding rather than a
residue. The class chain:

```
:312 root        h-full  p-6  overflow-auto  flex flex-col
:314   header    shrink-0  mb-4
:342   maincol   flex-1  flex flex-col  gap-4  min-h-0
:343     filters shrink-0
:420     kpi     shrink-0
:485     CHART   flex-1  p-6  flex flex-col  min-h-0     ← the ONLY flex-1
:486       h3    shrink-0  mb-4
:488       area  flex-1  min-h-0                          ← ResponsiveContainer height=100%
:581     cards   shrink-0  grid  md:2  lg:4
:631     panels  shrink-0  gap-2                          ← added by ac141ca
```

**The chart card is the sole `flex-1` among `shrink-0` siblings inside a
height-capped column.** Every pixel a sibling takes comes out of the chart, and
`min-h-0` on both the card and the inner area permits them to reach **zero**. At
zero the `ResponsiveContainer` renders an SVG of no height: **no lines, no
y-axis, no message** — the gate at `:451` passed because `chartData.length` is 24
— and **no scrollbar**, because the flex children shrank rather than overflowed.

That accounts for every element of the observation, including the two that no
other hypothesis explains: the **missing y-axis**, and the **absent message**.

### The computed cost of a third file

```
                 1 file   2 files   3 files   4 files
lg (>=1024 wide)
   1080px vh        457       404       351       298
    800px vh        177       124        71        18
    720px vh         97        44         0         0   <<< collapses on the third file

md (768-1023 wide) — the file-card grid ALSO wraps to a second row at 3 files
   1080px vh        457       404       255       202
    800px vh        177       124         0         0   <<< collapses on the third file
    768px vh        145        92         0         0   <<< collapses on the third file

third file costs:  lg  53px (one events panel)
                   md 149px (one panel + a second file-card row)
```

**The `md` band is the dangerous one** and explains why a third file is the
threshold rather than a fourth: below 1024px wide, the third file costs nearly
three times what it costs on a wide screen, because the card grid wraps at the
same moment the panel is added.

**These pixel figures are computed from the class chain, not measured in a
browser** — see the limits.

## 5. 1351 vs 1349 — confirmatory, no relevant difference

Identical in every respect the chart path touches: 1,728 baseline rows each,
same products, channels and segments, same 24 months, and **identical event
content** — both carry the same two Note placeholders and the same single real
pricing event (`"test dilution narrow"`, `25% → 20% dilution`), producing
identical three-row panels. 2155 differs only in having five real events.

**Trio composition is irrelevant**, as §1 shows: every trio and the quad produce
the same clean data. The variable is the **count**, and the count is a **height**.

## 6. Classification and fix proposals

### Classification

**The silent-collapse mechanism: NEVER WORKED.** A sole `flex-1` among `shrink-0`
siblings with `min-h-0` has been the tab's layout since it was written; nothing
ever prevented the chart area reaching zero, and nothing ever said so when it did.

**The third-file trigger: INTRODUCED BY `ac141ca`** (the per-file events panels).
Tested by mechanism, not assumption: before that commit there were no panels, so
at `lg` a third file cost **0px** of chart height and the collapse at three files
was not reachable. At `md` the card-wrap alone cost 96px, so the trigger may have
existed there at a lower viewport, but the panels made it 149px.

**Not `5e91b73`** (the brush session): it changed the Brush props, the reset
effect and the empty-state branch, and touched no layout class. §2 shows the
reset does not even fire on a file add.

**The phantom events: INTRODUCED BY `ac141ca`.** The Note convention is written by
App in eight sheets and guarded on import in **nine** places (`App.tsx:733, 740,
958, 970, 978, 986, 1012, 1069, 1090`). The worker has **zero** guards, and the
per-file parse inherited none. The convention was real and lived only in one
reader; a new consumer could not learn it from the code.

### Fix proposals, smallest scope first

**(a) The chart needs a floor, and the collapse needs a voice.** A `min-h`
(`min-h-[240px]` or similar) on the chart card stops the silent collapse; the
container then overflows into the existing `overflow-auto` and the user scrolls,
which is a stated condition rather than nothing. The design principle applies
directly: *a chart that cannot draw must say so*. Belongs in
`ScenarioCompareTab.tsx` at `:485`/`:488`.

**(b) The Note skip belongs in the WORKER parse**, and this is the load-bearing
decision. Placing it in `scenarioParser.worker.ts:parseSheet` means **every**
Compare consumer inherits it at once — chart, filter populate, and panels — which
is the duplicate-predicates rule applied to a convention rather than a function.
Placing it inside the `fromRow` seams would be wrong: the seams convert *a row*,
and "this sheet is a placeholder" is a property of the *sheet*. Better still, and
barely more work: one shared `isPlaceholderSheet(rows)` predicate used by both the
worker and App's nine sites, so the convention has **one definition** instead of
nine copies and a gap.

**(c) The empty panel then needs its own state.** With (b), a file with no events
yields zero rows and the panel shows R4's existing empty-state key — already
built, already translated. No new work beyond (b).

### One session or two

**(a) and (b)+(c) are one session.** (a) is a class change plus a stated
condition; (b) is a predicate plus two call sites; (c) falls out of (b) for free.
All three are in the Compare surface, all three are spec-able without a mount
except (a)'s rendered height, and together they close both defects this diagnosis
found. A single gate covers them.

## Decisions for Jon

1. **One devtools reading confirms the mechanism.** With the three files loaded
   and the chart dead: inspect the chart card (`:485`) and its inner div
   (`:488`) — is the inner div's computed height **0**? If yes the mechanism is
   proven and (a) is the whole chart fix. Also worth capturing: the browser
   window's inner width and height, which pins the threshold against the table
   in §4.
2. **Does the fix session run now, or does DQ keep its no-exceptions slot?**
   EXPECTED.md records DQ as next after the Compare arc; this is a user-visible
   Compare defect found after that was written.
3. **Is `min-h` the right floor, or should the chart card be excluded from the
   shrink entirely** (a fixed-height chart region with the rest scrolling)? The
   first is one class; the second is a small layout redesign with a better
   worst case.
4. **The shared `isPlaceholderSheet` predicate touches App's nine guard sites.**
   Collapse them into it in the same session, or leave App alone and add the
   worker guard only? Collapsing is the standing rule; it is also nine edits in a
   file this arc has not otherwise touched.

## Limits of this diagnosis

**The pixel arithmetic in §4 is computed, not measured.** The class chain, the
sole-`flex-1` structure and the `min-h-0` permission to reach zero are read
directly from source and are certain. The fixed heights of the header, filter
bar, KPI bar, card row and panel row are my estimates from their Tailwind
classes, so the **threshold** table is indicative and the **mechanism** is not.
Decision 1 replaces the estimate with a measurement in seconds.

**Nothing was mounted.** I attempted to measure the layout by replicating the
class chain in a standalone page, but files outside the project render as static
snapshots in the preview pane with no script execution, so the replica could not
report computed heights. I did not work around this by writing into the repo,
since the brief is read-only.

**The elimination of a throw rests on Jon's screenshot** showing the panels
rendering below the dead chart. That is strong — a root-level boundary is
all-or-nothing — but it is inference from an image rather than a console reading.

**§1 exercises the data path, not React.** It proves the inputs are identical
across states; it cannot prove what Recharts does with them, which is why §4
argues from structure rather than from a render.

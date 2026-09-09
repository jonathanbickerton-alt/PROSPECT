# REQ-D6-02 — the engine fields and the actuals predicate

```
FOR ADVISOR
Generated: 2026-09-09 10:39 +0100 (UTC 2026-09-09 09:39)
Certifies: 9c93807 (the tree every figure below was measured on)
Repo: committed 9c93807, pushed (origin in sync)

BASE 3da3da6 + f059ae0/a5a7179 (reports/ ONLY; ZERO drift). Proceeded.
RECORDED FIRST: REQ-D6-02 into EXPECTED.md at c7dbf02, BEFORE any code.
SCOPE SHED AT THE BRIEF'S OWN STOP POINT, stated at the checkpoint: 1 and 2
  built, gated, committed; 3-5 HELD WHOLE. Trap ids 182+ unused.
(A) FIELDS `baselineBaseVolume`, `baselineRevenue.{4}`, plus ONE BEYOND THE
  LIST — `adjustedBaseVolume`: the Base delta has TWO sides (body says why).
PRODUCED ONCE: perScenarioColumns returns {columns, baselineRevenue} and the
  column rounds THAT value; every pair equal to the penny, guarded non-vacuous.
EXPORT UNMOVED: 29 row columns (measured; I guessed 30), no new key.
BASE VOLUME CARD CORRECTED onto the unrounded pair — may move by up to 0.01.
(B) `monthsCarryingActuals(rows, dateCols[], valueCol) -> Set`. NOT named
  monthHasActuals — it returns a set, and one caller today, not two.
SWEEP: ZERO inline "has actuals" tests outside it; Step 3's map untouched.
TRAP 118 RE-ANCHORED onto the single producer; trap-anchors caught it.
SEEN RED BY HAND: both new checks, md5 81c2dae7ce, 1 site each, restored.
GATE, serial, guard-traps to a FILE: 177/177 CAUGHT, 0 MISSED/INCONC/CRASHED,
  TARGETS restored. Pins identical: apply 8+4=12, display 6, .enabled 5+1.
  suite 61/61, view-apply 177/177 (was 168), event-toggle 112/112, anchors
  189/189, survival 104/26+27/27, ai-hold 13/13, i18n 200/200, tsc 0, clean.
I INVOKED `python` ONCE IN ERROR: it hung, was killed, wrote nothing, verified.
```

## Base and record

`git log --oneline -1` read `a5a7179` — `3da3da6` plus two reports-only commits
(the 0948 skeleton and its fill). `git diff 3da3da6 --stat` was that one file.
The permitted case.

**RECORD FIRST.** REQ-D6-02 went into `test-data/EXPECTED.md` at `c7dbf02`,
before a line of code: the six decisions verbatim, both authorisations from the
0948 stop with the reason each exists, the note that Step 3's cohort-scoped map
answers a different question, and the mid-horizon stock-vs-flow watch. `a0b2cae`
is whitespace around the heading only.

The premise report's line numbers were re-checked before anything was relied
on: `newBBase` `:1278`, the baseline-revenue column `:959`, `Base (Baseline)`
`:1844`, the `perScenarioColumns` call `:1869`. All four held.

## Scope: the brief's own stop point, taken

The brief said: *"If the session cannot finish all of 1–5 gated, STOP after 1
and 2 gated and committed, and report — the UI is a second session."*

**Taken deliberately, and stated at the close checkpoint rather than
discovered at the end.** Items 1 and 2 are built, asserted, gated and
committed. Items 3–5 — the selector, the Revenue card, the mounted UI spec and
the three traps — are held whole; none of them is half-applied. `next free trap
id` remains **182** and guard-traps stays at **177**, not the 180 the full
brief anticipated, because no trap belongs to work that has not landed.

## (A) The engine fields

Three fields on `AdjustedForecastMonth` (`src/types/forecast.ts`):

```
baselineBaseVolume?: number
baselineRevenue?: Record<ScenarioKey, number | null>
adjustedBaseVolume?: number        <- one beyond the literal authorisation
```

**Produced once.** `perScenarioColumns` now returns
`{ columns, baselineRevenue }` instead of a bare column map. Inside it, the
baseline revenue is computed into a named value and the column rounds **that
value** rather than recomputing the product:

```ts
const rawBaselineRevenue = bArpu === null ? null : bArpu * baseVol;
baselineRevenue[key] = rawBaselineRevenue;
out[`${label} Revenue (Baseline)`] =
  rawBaselineRevenue === null ? null : +rawBaselineRevenue.toFixed(2);
```

At the single call site the two outputs go to two places — the columns into the
chart row, the unrounded revenues onto the month record, with
`baselineBaseVolume` captured there because `newBBase` is consumed by the
carry-forward a few lines later.

### The field beyond the literal list, and why

Authorisation (A) names `baselineBaseVolume` and the four baseline revenues,
and says *"the existing Base Volume Delta card moves onto these unrounded
fields"*. **It cannot, with only those.** That delta has two sides, and the
adjusted base stock `newBAdj` is a loop local for exactly the reason the
baseline one was. Persisting only the baseline half would leave the card
subtracting an unrounded figure from a rounded one — worse than the symmetric
rounding it replaces.

`scenarioArpu.base.volume` was considered and **rejected**: it is
`max(0, natural) + max(0, pools)`, which equals the base stock only while the
delivered pools do not exceed it, and it is absent altogether on a pre-schema
forecast. Using it would have made the card right on the fixture and wrong at
the edge.

So `adjustedBaseVolume` is persisted beside its baseline twin. It is one field,
with the same justification as the authorised ones, and it is named here rather
than absorbed — if Jon would rather the Base card stayed on the 2dp columns,
this is the line to reverse.

### The Base Volume Delta card, corrected

Decision 5 binds every delta, not only the new ones. `impactSummary` read

```ts
const last = chartData[chartData.length - 1];
const baseDelta = last['Base (Adjusted)'] - last['Base (Baseline)'];
```

— two 2dp columns, the shape `e5f1e79` removed from the ARPU card. It now
reads the two persisted fields. **This is a correction and may move the printed
figure by up to a hundredth**; the columns are untouched.

### The columns as the negative control

Four checks in `spec:view-apply-mounted` (168 → 177 checks), driven through
`computeAdjustedForecast` directly rather than the mount, because the fields
are engine output and a mounted read would test the card's indexing at the
same time as the engine's arithmetic:

1. **the engine produced months to check** — `adjustedMonths.length > 0` and
   equal to `chartData.length`;
2. **the comparison actually happened** — at least one field/column pair per
   month. A loop that compared nothing passes every equality it never ran,
   which is the vacuous-pass shape this project has caught before;
3. **every persisted `baselineRevenue` rounds to its own column**, all four
   scenarios, every month, to the penny;
4. **`baselineBaseVolume` rounds to `Base (Baseline)`**, and
   **`adjustedBaseVolume` to `Base (Adjusted)`**.

The columns can be the control precisely *because* they are now a rounded copy
of the field rather than an independent computation: if they ever diverge, one
of the two has stopped describing the quantity they share.

**The export is unmoved, measured rather than asserted.** The first check I
wrote said 30 columns and went red at 29 — the guess was wrong and the check
took the measurement. Independently, the diff removes one `out[...]` line and
adds one, with the same key, so no column was added or renamed; the new fields
ride the month **record**, and the export writes the **row**.

## (B) The one actuals predicate

`monthsCarryingActuals(rows, dateCols, valueCol) → Set<string>` in
`src/utils/forecasting.ts`, beside the project's other single-definition
predicates. The rule is the extraction unchanged: *a month carries an actual
when the dataset holds at least one row for it whose value column is populated
— not undefined, not null, not blank, and not zero*. Date-existence alone is
deliberately not the test, because forecast rows share the actuals' dates.

**Two departures from the brief, both deliberate and both reversible.**

- **The name.** The brief said `monthHasActuals`. It returns the **set**, not a
  boolean, because both callers need every month at once — the modal marks each
  row it lists, the selector removes each month it would otherwise offer — and
  a per-month predicate would walk the dataset once per month at each. It is
  not called `monthsWithActuals` either: `ForecastVsActualsTab` already uses
  that name for a **count** of months compared, and one name for two meanings
  is the pattern this codebase records instances of.
- **The signature takes a LIST of date columns.** The extraction site read
  `row[wiDateCol] || row[dateCol]` — mapped column first, the incoming file's
  detected column as a per-row fallback. Collapsing that to one column would
  have changed the modal's behaviour on a file whose date column is named
  differently from the mapped one, which is the case the fallback exists for.

**One caller today, not the two the brief expected.** `App.tsx`'s import modal
now calls it; the selector is the held half. That is a consequence of the shed,
not a gap in the extraction.

Three checks cover it, on a six-row fixture: populated / zero / blank / absent
/ unparseable-date / date-in-the-fallback-column. They assert that only the
populated month counts, that the fallback survived the extraction, and that
exactly two of six rows produce a month.

**The sweep is clean.** `grep` for the rule's own shape —
`!== '' && Number(` — over `src/` returns **one** hit, the predicate itself.
Step 3's `effectiveActualMap` is untouched, and is a different question:
*does this cohort have actuals at this month, scoped to the coverage being
scored*. Collapsing the two would push cohort-scoping into a view-level list.

## Traps and the checks seen red

**No new traps.** The brief's three all guard the UI, which is held; a trap
belonging to unlanded work would be a trap with nothing to bite. `next free
trap id` is still **182**.

**Trap 118 was re-anchored, and it was `spec:trap-anchors` that noticed.** My
edit to `perScenarioColumns` aged out its anchor in the same session, and the
suite went red on it before anything else did — the check catching a defect
introduced by the session that ran it:

```
FAIL trap 118 ... : anchor 1 still matches WhatIfTab.tsx
     [ZERO — the anchor has aged out; the trap plants nothing]
```

The new anchor is the **single producer** line, so the trap is strictly
stronger than before: corrupting it now sends the persisted field and the 2dp
column wrong together, where previously only the column moved. Trap 118 is
`CAUGHT` in this session's guard-traps run.

**Both new engine checks seen red by hand**, against pre-plant md5
`81c2dae7ce`, one site each, restored and verified:

| plant | observed |
|---|---|
| `baselineRevenue[key] = raw * 2` | `2026-01 Inflow: field 8800 → 8800, column 4400` |
| `m.baselineBaseVolume = newBBase + 1` | `2026-01: field 10201 → 10201, column 10200` |

The second also turned nine other checks red, which is its own evidence: those
are the KPI-card checks, and they moved because the Base Volume Delta card now
reads that field.

## Gate

Serial, guard-traps to a FILE, one instance.

```
guard-traps        177/177 CAUGHT   0 MISSED / 0 INCONCLUSIVE / 0 CRASHED
                   TARGETS restored — trap 118 CAUGHT on its new anchor
suite              61/61 green
view-apply-mounted 177/177  (168 -> 177: the four (A) checks + three (B))
event-toggle       112/112  — the three pins, unchanged
spec:trap-anchors  189/189 (177 traps, 184 anchors); next free id 182
spec:survival      104 dereferences across 26 files; 27/27 checks
spec:ai-hold       13/13
spec:i18n-parity   200/200; 874 keys per locale, all six equal — no new keys
tsc 0              lint clean        build clean
```

Pins measured on the restored tree and by the spec that owns them: **apply
8 + 4 = 12**, **display 6**, **`.enabled` 5 in `forecasting.ts` + 1 in
`WhatIfTab`** — identical before and after.

## Limits

- **I invoked `python` once, in error.** A stray `python - <<'X'` prefix went
  into a report-drafting command; it hung at startup exactly as the CLAUDE.md
  line records, was killed, and wrote nothing — the heredoc that followed it
  never ran, `/tmp/wa/blk2.txt` did not exist, and `git status` and `HEAD` were
  verified unchanged. The ban is correct and I broke it.
- **The UI is not built.** Items 3–5 are held whole. Nothing user-visible
  changes in this commit **except** the Base Volume Delta card's figure, which
  may move by up to a hundredth — a correction, not a feature.
- **The new fields have no trap.** They are covered by four spec checks, two of
  them seen red by hand, and by trap 118 on the producer they share; they do
  not have a trap of their own, because the traps in this brief belong to the
  held UI. Worth one when the second session lands.
- **The comparison counts were not printed.** The spec's `check` prints its
  detail only on failure, so the report says what the assertions prove — every
  pair equal, at least one pair per month — rather than quoting a pair count
  from a green run.

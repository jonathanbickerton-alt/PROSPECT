# REQ-D7-03 — one viewing state for Steps 2 and 3, persisted; a row click narrows it with a one-step Back; the accuracy month in the card titles

## FOR ADVISOR

```
Generated: 2026-09-25 09:56 +0100 (UTC 2026-09-25 08:56)
Certifies: 379c48b795c22095bf5e0e3e007a0a1dbb3447eb
Repo: committed 379c48b, pushed (origin in sync)
guard-traps targeted 116/116 CAUGHT, rotation 20, NOT RUN 173 (line s.8)
full suite:  80/80 green (first run; spec:one-view is the 80th)
Decisions (clauses 1-5) 9f1b0eb alone. Skeleton 56be72f. Base clean.
NEVER-SHED MET: ONE state `viewFilter` + ONE setter handleViewFilterChange
Setter callers 3: the bar, the row click, Back (FVA via onViewChange)
Row click: {...view, ...grouped row dims}; narrows, never widens; Back 1-step
Saved as Metadata `View` = the 7-part key; absent -> All/All
Titles 'INFLOW MAPE · MAR 2026' (no new key); figures flash 600 ms
Row SELECTION retired: the row click narrows the view, so a selected row
  would always BE the view; chartSeam = viewSeam; Back also on no-forecast
FINDING: the table is unfiltered by design; an out-of-view row moves the view
  SIDEWAYS (SOHO/Direct from Corporate/Direct) - decision for Jon (s.6)
FINDING: old saves now open at All/All, not at their active cohort (by cl.2)
Traps 291-296 new (291/292 structural: App unmountable); 9 RETIRED;
  10, 36, 284 re-pointed - all seen RED by hand, restored identical
Re-aims seen red: step3-transition, import-seam, unscored, step3-one-bar,
  actuals-coverage, accuracy-month; survival 104 -> 103 (a site removed)
Counts: seam callers 6, engine 6, resolveForecast( 9 -> 7 (s.3)
Shed: nothing - the highlight and the Metadata persistence both built.
Hold: none. Merge state: main, pushed.
```

Written after the build was code-complete and BEFORE the suite and
guard-traps, per the skeleton rule; the gate figures were filled after build
commit 379c48b was pushed. Nothing else changed between the two.

## 1. Base (quoted at session start)

- Skeleton `56be72f` was the first repo action (committed and pushed).
- `git status --short`: only the new skeleton file (`?? reports/2026-09-25-0746-one-viewing-state.md`).
- `git diff 542a5cb HEAD --stat -- src`: empty.
- `git diff 542a5cb HEAD --stat -- scripts`: `scripts/guard-traps-ledger.json` only.

ITEM 0 — clauses 1-5 under the new heading "REQ-D7-03 — ONE VIEWING STATE
(Jon, 2026-09-24/25)" in test-data/EXPECTED.md, committed ALONE as `9f1b0eb`
and pushed.

## 2. What was built

**Clause 1 — ONE state, ONE setter.** App's `step2Filter` / `step3Filter`
become ONE `viewFilter` (`useState<ViewFilter>(ALL_VIEW)`), and
`handleStep2FilterChange` / `handleStep3FilterChange` become ONE
`handleViewFilterChange` — the same body (set the state, resolve baseForecast
through the seam, null included, and clear the adjusted global — the per-step
clears reduce to this one). The four dual writes (two load branches, two
generation sites) are single `setViewFilter` writes. `forecastForView` takes
the one filter (`(view, viewFilter, resolve)`); its two arms stay separate so
trap 36 can still sever Step 3's alone. Step 1's cohort selector is
`stdSelectionFilter`, untouched.

**Clause 2 — persisted.** The export's ONE Metadata writer gains
`viewMetaRow(viewFilter)`: a `View` cell holding **the 7-part key**, not the
filter as JSON — because it is the form every resolver, the store and the
Active_Cohort block already speak, it reads in the sheet as the scope it is,
and `filterToKey` / `cohortToFilter` already round-trip it, so no second
encoding of a view enters the file. The load reads it through the existing
Metadata reader (`viewFromMeta(getMetaValue)`; absent, blank or not seven
parts → All/All) and sets the one state once, beside the step restore. A
restored step that owns the view shows the view's forecast at once, resolved
through `forecastForView` over the restored store (a third setBaseForecast
site in the load — see import-seam in section 5). The helpers live in
`src/utils/viewFilter.ts` beside `filterToKey`.

**Clause 3 — the month in the titles.** The eight titles read
`{label} MAPE · {monthLabel(accuracyMonth)}` — the existing labels and
`monthLabel`; **no new key** (the title was already `SCENARIO_LABELS[kpi]` +
the literal `MAPE`, and the card's `uppercase` class renders `JUN 2026`). The
small line is unchanged. The highlight is ONE effect (skipping the first
render) toggling ONE class, `mape-month-flash`, for 600 ms on the eight
figures; the class is a 600 ms background fade in `src/index.css`.

**Clauses 4-5 — the row click narrows; Back.** `narrowViewTo(row)` builds
`next = { ...view, ...rowDims }`, where rowDims holds only the grouped
dimensions (segment always), read the way the table's grouping reads them
(`cohortDims` over the row's dims — the same mapping the old row seam used; no
new predicate). A click whose `next` equals the view is nothing. Otherwise the
previous view is kept in ONE piece of FVA state (`backTo: { from, to }`) and
`next` goes through App's one setter (`onViewChange`). Back restores `from`
and clears itself; any other change of the bar (by hand) retires Back. The
DRILLED INTO strip is the Back control only: `actuals_drilled_into` is replaced
by `actuals_back_to` ("← Back to {{view}}", with `{{view}}` from
`describeScope`) in all six locales, with a translator note; 946 keys per
locale, unchanged.

**The row selection is retired.** Once a click narrows the view, a selected
row would always BE the view — and keeping it would have charted the row
under its own key (ungrouped dimensions `All`), contradicting the bar
(Corporate/Mobile Data/**All** against a bar reading Corporate/Mobile
Data/**Direct**). So `selectedForecastCohortKey`, `selectedCohortRow`, the
row branch of `chartSeam` (now `= viewSeam`), the row's own-actuals branch of
the chart, the `!selectedCohortRow` half of the Case B guard and the row
branch of the chart coverage are removed. The Back control is defined once and
also placed on the no-forecast screen — which is exactly where a click on an
unscored row lands (section 6).

## 3. Exact counts

| count | measured |
|---|---|
| view setter callers | **3** — App 4521 `onChange={handleViewFilterChange}` (the bar); App 4751 `onViewChange={handleViewFilterChange}`, called by FVA 2188 `onViewChange(next)` (the row click) and FVA 2922 `onViewChange?.(from)` (Back). The definition is App 1854; App 2126 is a comment. |
| eventScopeSeriesFor callers | **6** — the 5 `eventScopeSeriesFor(` sites in WhatIfTab through the wrapper (WhatIfTab 3888), plus FVA 2081 |
| computeAdjustedForecast | **6** across src |
| `resolveForecast(` across src | **9 -> 7**: App −1 (the two per-step setters' resolves are now one), FVA 4 -> 3 (the retired row selection's own resolve in `chartSeam`) |
| the rest as 2105 | unchanged from 542a5cb, raw token counts across src: onCohortFilterChange 1 (a comment), coveredLeafKeys( 5, deriveAggregate( 3, accuracy-month-select 1, solveForCohortTarget 4, buildPromoEvents 12, `resetYieldDraft()` 2, handleDeleteCampaign 5, setPendingChange 10, campaignToggleState 4, carryInitiative 5, `{ initiative }` 3, initiativeKey 8, handleSetEventEnabled 11, initiativeGroups 4, handleSetInitiative 4, handleDeleteInitiative 2, `isPlaceholderSheet(` 11, `adjustedForecastSheetRows(` 2 |

**(g), quoted.** Step 1's selector unchanged by a view change — the assertion,
from spec:one-view:
`check('(g) Step 1\'s selector is its own: the view setter writes no std* state, and stdSelectionFilter reads no viewFilter', setterStart >= 0 && stdMemoStart >= 0 && !/setStd|stdSelection/.test(setterBody) && !/viewFilter/.test(stdMemo), ...)`
— structural, because App is not mountable (below).

## 4. Mounted — `spec:one-view` (NEW) 50/50, fill-in order

- **(a)** Step 2 at All/All; Corporate + Direct set through the REAL
  ViewFilterBar (segment select, channel dropdown); Step 2's forecast
  re-resolves to Corporate/Direct. Step 3 mounted: its bar reads
  Corporate/All/Direct, and it scores that view — full coverage, no
  partial-coverage line. (On this fixture All/All and Corporate/Direct resolve
  the SAME 60 leaves, so no forecast figure discriminates the views; the
  coverage line does: All/All has actuals over 540 leaves.) All/All set on Step
  3: the partial-coverage line appears; Step 2 remounted: All/All, and its
  forecast is All/All's.
- **(b)** The View cell through a real .xlsx round trip:
  `"Corporate|All|All|Direct|All|All|All"`; loaded, Step 3 and Step 2 both at
  Corporate/Direct; a save without the cell: All/All.
- **(c)** At Corporate/Direct, Group-by Segment + Product L1, click
  Corporate · Mobile Data: the bar reads **Corporate/Mobile Data/Direct**
  (channel kept); ONE write of the narrowed key; the chart's 2026-03 Inflow
  forecast is that view's own mean (10651 against 10651.29; Corporate/Direct
  shows 33136). Back reads "← Back to Corporate / Direct"; "Drilled into" is
  gone; a second click on the row is nothing; Back returns Corporate/Direct and
  goes.
- **(d)** Group-by Segment only, click Corporate: the bar stays
  Corporate/Direct; nothing written; no Back.
- **(e)** After a row click, Segment changed by hand: Back is gone.
- **(f)** The eight titles end `· Jun 2026` (upper-case class: JUN 2026); after
  choosing 2026-03, `· Mar 2026` in all eight; the small line reads "… cohorts
  compared, Mar 2026"; the highlight class is on the eight figures after the
  change and gone after 700 ms; none before.
- **(g)** quoted in section 3. **(X)** structure: one state, one setter, its
  three callers, one adjusted clear, both steps reading the one state, the
  tab transition, the View cell written once inside the Metadata writer and read
  once, Back as one piece of state, one effect + one class, no row selection.

**Its limit, declared.** App is not mountable in this harness (ingest-spec's
header records why). The steps, the bar and the transition are the REAL
components and `forecastForView`, under a host that holds ONE view state as App
now does; that App holds and wires exactly that is pinned structurally in (X).
So traps 291 and 292 are caught by structural pins, not by a mounted App.

## 5. Re-aims — each seen RED before it was re-aimed

| spec | red before | after |
|---|---|---|
| step3-transition | crashed: `TypeError: resolve is not a function` (the old four-argument `forecastForView` call) | one filter; GATE regex `forecastForView(activeView, viewFilter, resolveForecast`; 17/17 |
| import-seam | 29/36: `handleStep2FilterChange still has exactly 1 site(s) [found 0 …]`, the same for Step 3, both "really does reach the seam", `every setBaseForecast call site is accounted for BY SITE [App.tsx:1861 in handleViewFilterChange]`, `both session-import sites were located [found 3]`, `applyImportSaveWorkbook still has exactly 2 site(s) [found 3 …]` | one `handleViewFilterChange` row; applyImportSaveWorkbook 2 -> 3 with the view-restore reason; 34/34 |
| unscored | 17/19: `PANEL 2 (chart): NO forecast series is drawn for the unscored row [4 of 4 forecast series carry geometry — a fabricated line is back]`, `BOTH PANELS AGREE: …` | Step 3 handed App's setter; the click narrows to the unscored cohort → its no-forecast screen, no forecast drawn, Back offered, Back restores both series (before-click series are the positive control); Case B kept; 18/18 |
| step3-one-bar | 47/55: `(b) the row is SELECTED: the Drilled-into strip names it [(none)]`, `(c) the Drilled-into strip has no Clear control [undefined]`, `(X) handleStep3FilterChange: defined once, called by the viewing bar only [0]`, and (d)/(g)/(h)/(i) — the card reader matched `^Inflow MAPE$` | (b) to clause 4: the spy is App's one setter and receives ONE write of the NARROWED view; (c) the strip is Back only; the setter pin → the one setter; the card reader allows the month; 55/55 |
| actuals-coverage | 36/39: `(d) NO forecast is drawn for the miss [4 of 4]`, `(d) no coverage line on a miss`, `(X) resolveForecast( stays at 4 calls [3]` | (d): clicking SOHO narrows to SOHO → no-forecast screen, no forecast, no coverage line, Back; `resolveForecast(` 4 -> 3; 40/40 |
| accuracy-month | 30/32: `(g) the Inflow MAPE card is that month's per-leaf average [ vs 0.6%]`, `(g) the cards' line reads "60 cohorts compared, Mar 2026"` | reader anchored on `^Inflow MAPE · Mar 2026$`; 32/32 |
| survival | 25/27: `unscored-row-spec.tsx has exactly 4 first-row dereference(s) [counted 3]` | baseline 4 -> 3 (the removed `t[0].textContent` was in the replaced block — removed, not moved); 104 -> 103 |

**Not re-aimed: restore-base and base-seed** stayed green (15/15, 31/31) — no
Metadata pin in them went red, so the brief's conditional re-aim did not
arise.

## 6. Findings

1. **Out-of-view rows move the view SIDEWAYS — decision for Jon.** The accuracy
   table is intentionally unfiltered ("must always show all cohorts … regardless
   of filter bar state", FVA's own note), so at Corporate/Direct it still lists
   Large Enterprise, MNC, SME and SOHO rows. Clause 4's formula applied to
   one of them gives SOHO/Direct: neither a narrowing within the view nor a
   widening. Built as the formula says. Options: (a) accept the sideways move;
   (b) a click on a row outside the view does nothing; (c) scope the table to
   the view. Not decided here.
2. **The row selection is retired** (section 2), and with it one behaviour: a
   click on an unscored row used to chart that row's actuals beside a blank
   forecast; it now narrows the view to a cohort with no forecast, so Step 3
   shows its no-forecast screen — with Back on it, so the one-step return
   survives. Trap 9 is retired with it.
3. **Old saves open at All/All,** not at their active cohort's view, as clause 2
   decides; the Active_Cohort block still restores Step 1's forecast. On the
   legacy pre-option-C path a restore landing directly on Step 2/3 keeps its
   single legacy forecast until the next view or tab change (there is no store
   to resolve the view from).
4. **291 and 292 are structural catches** — see section 4's limit.

## 7. Traps

Planted by hand, each backed up to the scratchpad, md5'd before / planted /
after, restored FROM THE BACKUP, all identical; `git status` identical before
and after the run.

| trap | file | before -> planted -> after | red |
|---|---|---|---|
| 291 Step 3 keeps its own filter | App | 1db12df0 -> 24d42ff1 -> 1db12df0 | one-view 49/50: `(X) both steps read the one state: the bar, hasForecast, Step 2's reason and Step 3's activeFilter` |
| 292 the export omits the View cell | App | 1db12df0 -> c887a8f9 -> 1db12df0 | one-view 49/50: `(X) the export writes the View cell ONCE, through the Metadata writer` |
| 293 the load ignores it | viewFilter.ts | 5f5965f4 -> 3cda4940 -> 5f5965f4 | one-view 48/50: `(b) loaded: Step 3 at Corporate/Direct [All/All/All]` |
| 294 the titles never change with the month | FVA (both rows, `global: 2`) | a92ca82c -> 1987c8c7 -> a92ca82c | one-view 49/50: `(f) after the change: MAR 2026 in all eight [Inflow MAPE · Jun 2026 | …]` |
| 295 the row click REPLACES the view | FVA | a92ca82c -> de5b4a64 -> a92ca82c | one-view 46/50: `(d) clicking Corporate at Corporate/Direct: the bar STAYS Corporate/Direct [Corporate/All/All]` (and (c) `[Corporate/Mobile Data/All]`) |
| 296 Back restores All/All | FVA | a92ca82c -> a9687207 -> a92ca82c | one-view 49/50: `(c) Back: Corporate/Direct [All/All/All]` |

**Re-pointed** (spec:trap-anchors found the anchors aged out; each seen RED by
hand on the new anchor):

| trap | now | before -> planted -> after | red |
|---|---|---|---|
| 284 → a second, widening write | the row click writes Segment-only before narrowing | a92ca82c -> 256aa8a4 -> a92ca82c | step3-one-bar 52/55: `(b) the viewing bar was written ONCE, through the one setter, with the NARROWED view [["Corporate|All|All|All|All|All|All","Corporate|Mobile Data|All|Direct|All|All|All"]]` |
| 10 Case B scope guard | the guard's remaining half | a92ca82c -> 23783705 -> a92ca82c | unscored 17/18: `CASE B: a forecast scoped OUTSIDE the filter is NOT drawn against its actuals [4 of 4 drawn — the +99.9% case is back]` |
| 36 tab switch stops resolving Step 3 | `filterToKey(viewFilter)` | 5f5965f4 -> cee57c13 -> 5f5965f4 | step3-transition 9/17: `SEQ restore -> Step 3: Actuals Review renders [the never-generated message is on screen — F1 REPRODUCED …]` ×4 sequences |

**9 RETIRED** — its anchor (`!selectedCohortRow`) went with the row selection;
its claim now lands on the no-forecast screen (unscored's re-aimed pair) and
Case B (trap 10). Recorded in the registry; the number is not reused.

`ONEVIEW` registered in CONTROL_SPEC_MAP with its first trap. spec:trap-anchors
**309/309** (289 traps, 304 anchors; next free id 297). TARGETS unchanged (24).

## 8. Gate (serial)

| check | result |
|---|---|
| `npm run suite` | **80/80 green**, first run |
| guard-traps `-- --targeted` (to a file) | **116/116 CAUGHT**, verbatim below |
| spec:trap-anchors | 309/309 |
| spec:i18n-parity | 203/203; **946 keys** in each of en/de/es/fr/it/pt; `actuals_back_to` present and `actuals_drilled_into` absent in all six |
| spec:i18n-scan | PASS |
| spec:survival | 27/27; **103** first-row dereferences across **26** files |
| tsc | exit 0 |
| lint | exit 0 |
| build | exit 0 |

All 24 harness TARGETS were backed up to `scratchpad/pre-gt64/` and md5'd
before the run; all 24 are identical after it, and `git status` differs only
by the ledger. The ledger is committed WITH this report; the build commit
`379c48b` excludes it.

```
guard-traps targeted 116/116 CAUGHT (ids 10 11 12 15 21 22 36 37 48 49 50 51 56 57 58 63 64 65 67 68 69 70 71 74 75 76 77 78 79 80 81 87 88 89 90 94 102 103 104 105 106 107 108 109 110 111 112 113 120 124 132 133 192 193 194 197 245 252 253 254 255 261 262 263 264 265 266 267 268 269 270 271 272 273 274 275 276 277 278 279 280 281 282 283 284 286 287 288 289 290 291 292 293 294 295 296), rotation 20 (ids 118 119 121 122 123 125 126 127 128 129 130 131 134 135 136 138 139 140 141 142), NOT RUN 173, last FULL run 8079186 2026-09-17T10:58:18.253Z
```

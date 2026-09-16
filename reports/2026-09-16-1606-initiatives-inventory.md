# REQ-D6-08 — initiatives on the Events summary: decisions recorded, inventory

## FOR ADVISOR

```
Generated: 2026-09-16 17:14 +0100 (UTC 2026-09-16 16:14)
Certifies: ab2c634 (src read; no src/scripts/spec change)
Repo: PENDING
Decisions commit: 6b7fdea (REQ-D6-08 1-7, committed alone before reading)
Read-only inventory; every claim below carries file:line in the body.
FINDING 1: the delete dialog is MARKET-ONLY end to end - pendingChange
holds nextEvents: MarketEvent[] (WhatIfTab:5675), the preview re-runs the
engine varying marketEvents only (:5690-5691), confirm writes
setMarketEvents only (:6124). WhatIfTab has no setYieldEvents /
setPricingEvents props. A 3-carrier initiative bin needs this widened.
FINDING 2: both campaign SAVES REPLACE the campaign's rows with freshly
built ones (Volume :5641-5644, Promotion :6101-6104). An Initiative field
on those rows is LOST on any campaign edit unless carried there.
FINDING 3: the per-row setter already spans the 3 carriers:
handleSetEventEnabled(row{id,pass}) (:3214-3218); the campaign switch
hard-codes pass 0 (:3245-3247); campaignToggleState is carrier-free.
FINDING 4: summary rows sort pass-then-month (forecasting:1316) - a
campaign's rows are NOT adjacent today; no selection state exists.
Moving pins: last columns Market 5->6, Yield 3->4, Pricing 3->4
(event-toggle :547-585, hold-shape :235, spread-ramp-promo :475,
spread-ramp-volume :624, pricing-roundtrip :723); campaign-delete :326.
COST: TWO sessions (G). Rename: small (F), one setter reused.
Questions for Jon: 8, numbered in section 3.
full suite:  75/75 green
```

## 0. Base

Quoted before anything else:

- `git status --short` — empty.
- `git diff ab2c634 HEAD --stat -- src` — empty.
- `git diff ab2c634 HEAD --stat -- scripts` —
  `scripts/guard-traps-ledger.json | 1372 ++++++++-----` (one file, the ledger
  from the ab2c634 FULL run).

## 1. Item 0 — the decisions

The new heading and decisions 1–7, plus "Open: rename", were appended verbatim
to `test-data/EXPECTED.md` and committed alone as **`6b7fdea`**, before any file
was read for the inventory.

## 2. Inventory

All line numbers are at `ab2c634`'s src.

### (a) The Events summary's row model

- **What it renders.** `EventsSummaryTable` takes `rows: EventSummaryRow[]`
  (`EventsSummaryTable.tsx:36`) and maps them one `<tr>` per row
  (`:198`). It renders and never builds. The rows come from
  `buildEventsSummaryRows` (`forecasting.ts:1258-1317`): one row per MarketEvent
  (pass 0), per YieldEvent (pass 1) and per PricingEvent (pass 2). The row type is
  `EventSummaryRow` (`forecasting.ts:1085-1099`): `id, pass, card, name, unnamed,
  adjusts, scope, when, month, enabled`. It has **no campaign field and no
  isPromotion field**. WhatIfTab memoises the rows at `WhatIfTab.tsx:3272-3274`;
  Compare builds them per file at `forecasting.ts:1351-1362` from raw rows
  through the same three readers.
- **Adjacency today: none.** The builder sorts by `pass` then `month`
  (`forecasting.ts:1316`). A 3-month campaign's rows sit wherever their months
  fall among the other pass-0 rows, and volume and promotion rows interleave (both
  are pass 0). The name column shows `campaignName || name`
  (`forecasting.ts:1270`), so a campaign reads as N rows with the same name, not
  as one line.
- **The campaign bin.** The opt-in prop is `onDeleteCampaign` (`:86`), asked per
  row at `:224`. WhatIfTab's answer (`WhatIfTab.tsx:7003-7011`) returns a bin only
  for pass 0 (`:7004`), looks the event up in `marketEvents`, reads its
  `campaignName`, finds the group in `campaignGroups`/`promoCampaignGroups`, and
  returns non-null only when this row is the group's FIRST row by date (`:7009`).
  It calls `handleDeleteCampaign(name, group.rows)` (`:7010`). Compare passes
  nothing, so it shows no bin (`ScenarioCompareTab.tsx:725-735`).
- **D5-08's Show all / fewer.** `SHOW_ALL_THRESHOLD = 9` (`:101`);
  `canShowAll = showAllToggle && rows.length > SHOW_ALL_THRESHOLD` (`:110`). It is
  a row count, not a pixel measure. The cap is CSS `max-h-[320px]` removed when
  showing all; the rows are **not sliced**. The count badge also reads
  `rows.length` (`:133`).
- **D5-09's effect states.** A per-row predicate `effectOf(row)` (`:245`) is
  supplied by WhatIfTab as `effectStatusOf(row, appliedIds, zeroCoverageIds,
  appliedArpuIds, arpuCandidateIds)` (`WhatIfTab.tsx:6369-6375`;
  `forecasting.ts:1146`). It keys on `row.id` and `row.enabled`.

**What a header row per initiative does to each:**
1. **Order.** The layout must be a derived list of `header | member row`
   entries built AFTER `buildEventsSummaryRows`. Moving the order into the
   builder would change Compare's order too, and `compare-events-panel-spec`
   pins pipeline order at `:172-183`.
2. **Campaign bin.** It still keys on "first row of the campaign by date". Once
   members sit together that row is still present, but grouping must keep a
   campaign's rows together or the bin lands mid-group.
3. **Show all.** The threshold and badge count `rows.length`. A header row is not
   an event, so it must be excluded from both or the "N events" badge lies. See
   question 6.
4. **Effect.** A header has no id in the engine's sets. It needs no status, or a
   derived one; see question 7.
5. **Grouping key.** Campaign membership needs `campaignName` and `isPromotion`,
   and the summary row carries neither. The row type needs `initiative` and a
   campaign key, or the table must look rows up again, which the component's
   header comment (`:17-20`) rules out.

### (b) The card campaign switch

- **One function per concern.** State: `campaignToggleState(rows)`
  (`WhatIfTab.tsx:3230-3234`) returns true / false / null (mixed) from
  `isEventOn`. It is **carrier-free**, since `isEventOn` reads any carrier. Write:
  `handleSetCampaignEnabled(rows, next)` (`:3245-3247`) loops rows and calls
  `handleSetEventEnabled({ id, pass: 0 }, next)`. **pass 0 is hard-coded**, so it
  writes MarketEvent rows only.
- **Callers: 2 pairs.** The Volume table pill (`:8411-8412`) and the Promotion
  table pill (`:10492-10493`).
- **The three-carrier setter already exists.** `handleSetEventEnabled(row: { id,
  pass }, next)` (`:3214-3218`): pass 0 → `updateMarketEvent`, 1 →
  `updateYieldEvent`, 2 → `updatePricingEvent`. All three are App's
  `updateById(setter, id, patch)` (`App.tsx:311-317`), a functional `prev.map`, so
  N calls in one tick compose (the campaign switch relies on this, per its
  comment at `:3236-3244`). **Yield setter path:** `App.tsx:1348-1349`. **Pricing
  setter path:** `App.tsx:1383-1384`.
- **An initiative switch** is therefore `members.forEach(r =>
  handleSetEventEnabled(r, next))` with each row's own `pass`, and its state is
  `campaignToggleState(members)`. No new predicate and no new writer.
- **The tri-state control exists.** `EventOnOffSwitch` takes
  `checked: boolean | null` (`EventOnOffSwitch.tsx:41`), renders
  `aria-checked="mixed"` (`:61`), and a click on mixed turns everything on
  (`:76`).

### (c) Writers, readers, last-column pins, Compare

| sheet | writer (last field today) | reader | `Enabled` read |
|---|---|---|---|
| Market_Events | `marketEventExportRow` `forecasting.ts:372`, ends `Tariff_ARPU_Basis` `:484` | `marketEventFromRow` `:1643` → `readStoredEventModifiers` `:1511` | `:1542` |
| Yield_Events | `yieldEventExportRow` `:1729`, ends `Tariff_ARPU_Basis` `:1774` | `yieldEventFromRow` `:1790` | `:1823` |
| Pricing_Events | `pricingEventExportRow` `:1374`, ends `Contract_Length_Months` `:1430` | `pricingEventFromRow` `:1441` | `:1475` |

One writer and one reader per sheet already, with callers: App export
`App.tsx:544`, `:620` (and pricing); App restore `App.tsx:1016`, `:1024`,
`:1032`; workbook route `App.tsx:2050`; Compare `forecasting.ts:1357-1359`.
**Compare needs no parser change**: it reads through the same three readers
(`forecasting.ts:1357-1359`). Its engine (`scenarioHelper.ts`) reads raw rows
(e.g. `:221-233`) and needs nothing, because an initiative changes no engine
input.

**Last-column pins that will move:**

| pin | today | after | file:line |
|---|---|---|---|
| Market positions | 5 | 6 | `event-toggle-spec.tsx:547-555` |
| Yield positions | 3 | 4 | `event-toggle-spec.tsx:560-564` |
| Pricing positions | 3 | 4 | `event-toggle-spec.tsx:581-585` |
| Market last = Tariff_ARPU_Basis | | moves | `hold-shape-spec.ts:235-237` |
| Market last (promo rows) | | moves | `spread-ramp-promo-mounted-spec.tsx:475-476` |
| Market last (volume rows) | | moves | `spread-ramp-volume-mounted-spec.tsx:624-625` |
| Pricing last = Contract_Length_Months | | moves | `pricing-roundtrip-spec.ts:723-724` |

That is 7 pin sites in 5 specs.

### (d) The selection mode

- **No row selection exists today.** The summary has **0** `type="checkbox"`
  inputs (`EventsSummaryTable.tsx`, count 0), and no `selected*` or
  `selectionMode` state in the component or in WhatIfTab (0 matches).
- **Dialog kinds: 4.** `'delete' | 'edit' | 'clear' | 'campaign'`
  (`EventChangeConfirmModal.tsx:29`, mirrored at `WhatIfTab.tsx:5675`). Only
  `campaign` takes caller text (`title/blurb/cancel/confirm`, `:74-76`, `:150`,
  `:158`); the other three use fixed English maps (`:44-55`).
- **Staging and commit.** `setPendingChange` is staged at 6 sites:
  `WhatIfTab.tsx:3265` (campaign), `:5783` and `:5828` (edit), `:8576` and
  `:10614` (delete), `:8688` (clear). `campaign-delete-mounted-spec.tsx:326` pins
  `kind: 'campaign'` at exactly ONE staging site.
- **What an `initiative` kind needs**, from FINDING 1:
  - `pendingChange` must carry `nextYield` and `nextPricing` (today
    `nextEvents: MarketEvent[]` only, `:5675`).
  - The preview must vary all three arrays (today `:5690-5691` vary
    `marketEvents` only; `yieldEvents`/`pricingEvents` are in `shared`, `:5682`).
    The engine site count stays 6: same two calls, different arguments.
  - Confirm must commit yield and pricing removals (today `:6124` is
    `setMarketEvents` only).
  - WhatIfTab receives only per-id `removeYieldEvent` / `removePricingEvent`
    (`App.tsx:1351-1353`, `:1386-1388`; props `WhatIfTab.tsx:112`, `:120`), each
    a functional `prev.filter`, so N calls compose. Question 1 is whether to
    reuse those or add whole-array setters.
  - A title and blurb naming the initiative and its count, in six locales.

### (e) The ID join

- **Every exported row carries `ID`** on all three sheets
  (`forecasting.ts:374`, `:1376`, `:1731`). All three readers use `eventRowId`
  (`:1209-1214`): `ID ?? Name ?? random` (`:1444`, `:1656`, `:1806`).
- **The recorded watch** (EXPECTED.md §D5-09, `:7949-7953`): in a file with **no
  `ID` column**, rows sharing a `Name` collapse to one id.
- **Restated against initiatives.**
  - *Membership* is stored BY NAME on each row, not by id, so the collapse does
    not merge or split initiatives.
  - *The switch, ungroup, dissolve and the bin* all write BY ID through
    `updateById` / `prev.filter`. In a session restored from an ID-less PROSPECT
    save (the `'session'` route, `App.tsx:1016`), a campaign's rows would share
    one id. A switch or ungroup on one member would then patch every row with
    that id, possibly including a sibling campaign of the same name that is not
    in the initiative. **This is already true of today's per-row switch**, so
    initiatives add no new exposure. Exports always write `ID`, so only
    hand-made files reach it.
  - *The workbook route* (`App.tsx:2050`) mints random ids, so it is unaffected.

### (f) Rename

- **Cost of "rewrite the name on every member row":** one setter. The same
  per-row path the switch uses, as a sibling of `handleSetEventEnabled`: a
  `pass`-switched `update{Market|Yield|Pricing}Event(id, { initiative })`. Group,
  Ungroup, Dissolve and Rename are all that one function applied to a member set
  (Ungroup and Dissolve write `''`). Building rename adds a name input on the
  header and one rule for renaming onto an existing name (question 4), roughly a
  handful of lines plus a mounted case and a trap. NOT MEASURED as a line count;
  estimated from the reuse above.
- **Not building it:** a user renames by Dissolve then Group as the new name,
  which re-ticks every member. That is workable for small initiatives and tedious
  for large ones.

### (g) Cost

**TWO sessions.** One session would carry the storage change, a cross-carrier
dialog widening (FINDING 1) and a new selection UI together, and the 1019 build
showed how the close cost grows when three independent reds land at once.

**Session 1 — storage and the switch.**
- *Scope:*
  - `initiative?: string` on the three types.
  - The `Initiative` column on 3 writers and 3 readers (absent → `''`).
  - CARRY through both campaign saves (FINDING 2) and every edit path.
  - `initiative` on `EventSummaryRow`.
  - A pure `initiativeGroups(rows)` layout function (header + members, ungrouped
    rows in today's order).
  - Header rows with name, count and the tri-state switch.
  - The Compare column (read-only).
- *Never-shed item:* the column round-trips on all three sheets, **survives a
  campaign edit**, and the header switch sets `Enabled` on every member across
  carriers, with state derived from the rows (mixed included).
- *Testable without the UI:* an initiative can be made in a workbook fixture.

**Session 2 — the controls and the bin.**
- *Scope:* selection mode (tick, a campaign ticks whole), Group as (new or
  existing), Ungroup per member, Dissolve, the initiative bin with the dialog
  widened to three carriers, and rename if decided.
- *Never-shed item:* Group as / Ungroup / Dissolve writing through the one
  setter, with a campaign always moving whole.
- *Shed candidate if needed:* rename.

**Pins that move** (7 sites, in (c)), plus:
- `campaign-delete-mounted-spec.tsx:326`, if the initiative kind is staged
  beside `'campaign'`.
- `compare-events-panel-spec.ts:172-183`, pipeline order. It stays green only if
  grouping is done after the builder, WhatIfTab-side.

**Specs expected red:**

| session | spec | why |
|---|---|---|
| 1 | `event-toggle` | 3 pin groups |
| 1 | `hold-shape` | last-column pin |
| 1 | `spread-ramp-promo`, `spread-ramp-volume` | last-column pins |
| 1 | `pricing-roundtrip` | last-column pin |
| 1 | `events-summary` | only if the row type or its order is asserted; its order pin is at `:181-195` |
| 1 | `compare-events-panel` | only if grouping reaches Compare, or the new column changes its row objects (`:395`, `:420` compare JSON) |
| 1 | `trap-anchors` | any trap anchored on the lines that gain a field |
| 2 | `campaign-delete` | the `kind` pin |
| 2 | `view-apply-mounted` | only if the `pendingChange` shape change touches the D5-04 commit route (`:1336-1350`) |

NOT MEASURED which traps anchor on the exact lines session 1 edits; trap-anchors
will say.

### (h) What the seven decisions leave open

Stated in full as the questions in section 3.

## 3. Questions for Jon

1. **The bin across three carriers.** The existing delete dialog stages, previews
   and commits Market_Events only. For an initiative holding Value or Pricing
   events, may the bin remove those rows through the existing per-id removers
   (`removeYieldEvent`, `removePricingEvent`), called from the one confirm? Or do
   you want WhatIfTab given whole-array setters for Yield and Pricing so the
   confirm commits each carrier in a single write, as it does for Market?
   Either keeps one confirm; the first adds no props, the second matches the
   campaign bin's single write.
2. **A campaign edit and the initiative.** Saving a campaign in its card replaces
   all of its rows with new ones. Should the rebuilt rows automatically stay in
   the initiative their predecessors were in? I assume yes: rows are the truth
   and the user did not ungroup. And if the edit changes the number of months,
   do the added months join too?
3. **Grouping a member that is already in another initiative.** When the user
   ticks a campaign or event that already belongs to initiative A and chooses
   "Group as B", should it MOVE to B (one initiative per row, so it leaves A), or
   should Group as refuse until it is ungrouped from A first?
4. **Rename onto an existing name.** If rename is built, what happens when the
   new name equals another initiative's name: merge the two, or refuse? And are
   names compared exactly, or with whitespace trimmed and case ignored (so
   "Q4 Push" and "q4 push " are the same initiative)?
5. **Where an initiative's group sits.** Decision 5 puts members together under a
   header and keeps ungrouped rows in today's pass-then-month order. Where does
   the group itself go: at the position of its earliest member in today's order,
   above all ungrouped rows, or below them?
6. **Counting.** The panel's badge says "N events" and the Show all control
   appears above 9 rows. Should initiative header rows be excluded from both, so
   the badge still counts events and the threshold still counts event rows?
7. **The header's Effect cell.** The EFFECT column (D5-09) states per row whether
   an event is applied. Should an initiative header show nothing there, or a
   summary of its members' states (and if so, which)?
8. **Compare.** Decision 6 gives Compare an Initiative column. Should Compare
   also sit an initiative's members together under a header, as the What-If
   summary does, or keep its rows in pipeline order with the name in the column
   only? Keeping pipeline order leaves `compare-events-panel`'s order pins as
   they are.

## 4. Gate

| step | result |
|---|---|
| `npm run suite` | **75/75 green** |
| `tsc --noEmit` | clean |
| `git status --short` before the report | empty. No file under `src/`, `scripts/` or any spec was touched; `EXPECTED.md` changed only in `6b7fdea` |

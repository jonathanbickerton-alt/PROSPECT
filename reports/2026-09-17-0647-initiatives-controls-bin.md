# REQ-D6-08 session 2 — selection mode, Group as / Ungroup / Dissolve / Rename, the three-carrier initiative bin

## FOR ADVISOR

```
Generated: 2026-09-17 08:22 +0100 (UTC 2026-09-17 07:22)
Certifies: c9ff73b5b4f25ef14ea310d590aa9e3d576cbe07
Repo: committed c9ff73b, pushed (origin in sync)
Clause 16 recorded alone: 07a407d. Skeleton: 41510a2.
ONE setter handleSetInitiative(members, name|'') (defs 1): per member,
update{Market|Yield|Pricing}Event by its own pass; Group as, Ungroup,
Dissolve and Rename all call it. Writes of { initiative }: exactly 3.
A campaign moves WHOLE: campaignUnit (defined once) feeds tick and Ungroup.
Bin: kind 'initiative'; pendingChange gains nextYield/nextPricing; preview
varies all 3 arrays (computeAdjustedForecast still 6); confirm calls
removeYieldEvent/removePricingEvent once per member. Staging sites 6->7.
FINDING: campaign-delete :326 did NOT go red - it counts the literal
kind: 'campaign'. Not re-aimed; a both-kinds staging pin (7) was ADDED,
seen red by plant (quoted). view-apply-mounted did not go red (208/208).
spec:initiatives 45 -> 111: (h)-(o) + 7 structure pins, green first run.
Traps 266-271 seen RED by hand, restored identical. 271 is source-level:
the dialog shows volumes, which Value/Pricing members never move.
i18n: 16 new keys, 931 -> 947 per locale; common_cancel reused.
Nothing was shed. No decision is reserved for Jon.
guard-traps targeted 94/94 CAUGHT, rotation 20, NOT RUN 172 (line
verbatim in section 5), last FULL run 6693bd6 2026-09-16T15:35Z
full suite:  76/76 green
```

## 0. Base

Quoted before any change:

- `git status --short` — empty.
- `git diff 6c12fab HEAD --stat -- src` — empty.
- `git diff 6c12fab HEAD --stat -- scripts` —
  `scripts/guard-traps-ledger.json | 524 ++++++++++++++++++++++------------------`
  (the ledger only, committed with the 1937 report in 9f6b92f).

HEAD and origin/main were both `9f6b92f`. The report skeleton was the first repo
action (`41510a2`, pushed).

## 1. Item 0 — record

Clause 16 appended under REQ-D6-08 in `test-data/EXPECTED.md`, verbatim from the
brief, committed alone as `07a407d` and pushed before any code.

## 2. Item 1 — never shed: one setter, whole campaigns

### The setter — `WhatIfTab.tsx`, `handleSetInitiative`

```ts
const handleSetInitiative = useCallback((members, name: string) => {
  const initiative = name.trim();
  members.forEach(r => {
    if (r.pass === 0) { updateMarketEvent(r.id, { initiative } as any); return; }
    if (r.pass === 1) { updateYieldEvent(r.id, { initiative } as any); return; }
    updatePricingEvent(r.id, { initiative } as any);
  });
}, [updateMarketEvent, updateYieldEvent, updatePricingEvent]);
```

- The sibling of `handleSetEventEnabled`, beside it. Defined once. `'' ` is none
  (every reader already treats a falsy initiative as none: `initiativeGroups`,
  `carryInitiative`, the writer's `?? ''`, the Compare cell).
- The only writes of `{ initiative }` in WhatIfTab are these three (count 3).
  The campaign-save carry (`carryInitiative`, 3 sites) is session 1's and copies
  an existing name onto rebuilt rows; it is not a second way to set one.
- The table is handed the setter as `onSetInitiative` and never writes events
  itself (pinned: no `update*Event`, `remove*Event` or `setMarketEvents` in
  `EventsSummaryTable.tsx`).

### A campaign moves whole — `forecasting.ts`, `campaignUnit(rows, row)`

Every row of the row's campaign (same `pass`, same `card`, same `campaignName` —
session 1's row fields, the grouping the card pills use), or the row alone.
Defined once and read at exactly two places in the table: the tick and Ungroup.

### The controls — `EventsSummaryTable.tsx`, opt-in props

`onSetInitiative` and `onDeleteInitiative` are OPT-IN like every prop before
them; Compare passes neither and shows none of this.

- **Select** (`events-summary-select`, beside Show all, panel open only) enters
  selection mode. A tick per event row, in the first cell; a header row has no
  tick. Ticking any campaign row ticks (or unticks) the whole campaign.
- **The bar**: "{n} selected" (events, not entries), a name input, a pick-list of
  the existing initiative names (picking fills the name), **Group as…** and
  **Cancel**. Group as trims the name and calls the setter with the ticked rows:
  a new name creates, an existing name adds with no prompt (clause 4), and a
  member of another initiative moves (clause 10 — one row holds one name).
  Selection mode then closes.
- **Ungroup** on every member row inside a group: the setter with the row's
  campaign unit and `''`.
- **On the header**: **Rename** (pencil → inline input → Save name / Enter;
  Escape cancels), **Dissolve** (the setter with every member and `''`; no
  dialog) and **the bin**.
- **Rename** (clause 11): trimmed; empty or unchanged does nothing; an unused
  name renames every member with no prompt; a name in use opens the inline
  dialog "Merge into '{name}'? {n} events will join it" (n = the renamed
  initiative's members). Merge calls the setter onto that name; Cancel writes
  nothing.

Selection, the rename input and the merge prompt are view state local to the
panel, as Show all is.

### The bin — kind `'initiative'`

- `pendingChange` gains `nextYield?`, `nextPricing?` and
  `initiative?: { name, n, yieldIds, pricingIds }`. Every other kind is untouched
  and carries neither array.
- `handleDeleteInitiative(name, members)`, a sibling of `handleDeleteCampaign`
  beside it, stages the three filtered arrays and the Value/Pricing ids. It
  commits nothing. This is the 7th staging site (6 → 7).
- The preview's `after` call now passes
  `yieldEvents: pendingChange.nextYield ?? yieldEvents` and
  `pricingEvents: pendingChange.nextPricing ?? pricingEvents`. Same two engine
  calls: `computeAdjustedForecast` stays 6.
- `confirmPendingChange` writes Market as before (`setMarketEvents(nextEvents)`)
  and then calls `removeYieldEvent(id)` / `removePricingEvent(id)` once per
  Value/Pricing member. No whole-array setter, no new App prop.
- An initiative bin that takes the rows of a campaign whose editor is open
  closes that editor, as the campaign bin does.
- The dialog: `EventChangeConfirmModal` accepts `'initiative'` and words it from
  the caller's text, exactly as `'campaign'` (`keyed` covers both): title
  `whatif_delete_initiative_title` ({{name}}, {{n}}), blurb, confirm, and
  `common_cancel`. The header bin's tooltip is `whatif_delete_initiative_bin`.
- `handleDeleteCampaign` callers stay 3.

### i18n

16 new keys in all six locales; **931 → 947 keys per locale** (en de es fr it
pt, each measured). Cancel reuses the existing `common_cancel`.

`whatif_summary_select`, `whatif_summary_selected`, `whatif_summary_tick`,
`whatif_initiative_group_as`, `whatif_initiative_name_placeholder`,
`whatif_initiative_pick_existing`, `whatif_initiative_ungroup`,
`whatif_initiative_dissolve`, `whatif_initiative_rename`,
`whatif_initiative_rename_save`, `whatif_initiative_merge_title`,
`whatif_initiative_merge_confirm`, `whatif_delete_initiative_title`,
`whatif_delete_initiative_blurb`, `whatif_delete_initiative_confirm`,
`whatif_delete_initiative_bin`.

No value equals English in any locale, so the parity allowlist did not move
(55 entries / 194 pairs).

## 3. Mounted — `scripts/initiatives-mounted-spec.tsx`, 45 → 111

The Host now holds the Value and Pricing DRAFTS as real state (so an edit in the
card reaches its save), and counts every `removeYieldEvent` / `removePricingEvent`
call. Fill-in order throughout; every expected id list is a hand-written literal.

- **(h) the row-edit carry**, mounted at last: the Value member's comment edited
  in the Value card and saved; the Pricing member reopened on 5, typed 7, saved.
  Both edits landed and both members are still in Launch.
- Controls fixture: Launch (CampA ×3, a Value, a Pricing member), plus CampB ×3
  in no initiative, Early, Solo, a Value and a Pricing event — 12 events.
- **(i)** no ticks before Select; a header has no tick; ticking `campb-2` ticks
  campb-1..3 and nothing else; ticking `y-out` → "4 selected"; Group as
  "  New " → campb-1..3 and y-out carry "New" (trimmed), nothing else moved, a
  New header with 4 events, the bar closed.
- **(j)** tick p-out; the pick-list offers exactly `Launch,New`; picking fills
  the name; Group as → no merge dialog, New has 5.
- **(k)** tick camp-1 (a Launch member), Group as New → all of CampA moves;
  Launch 5 → 2, New 5 → 8.
- **(l)** Ungroup on `campb-3` → the whole of CampB cleared; y-out stays in New;
  New 8 → 5; a row in no initiative has no Ungroup.
- **(m)** Dissolve Launch → no dialog of either kind, y-in and p-in cleared, still
  12 events, y-in's other fields untouched, no Launch header.
- **(n)** Rename New → "  Big " → no prompt, the same 5 ids now carry Big, one
  header. Group Early as Other; Rename Other → Big → the prompt reads exactly
  "Merge into 'Big'? 1 events will join it", nothing written yet; Cancel → two
  headers, Early still Other; Rename again, Merge → one header, Big, 6 events,
  still 12 events.
- **(o)** fresh mount: the Launch bin opens the dialog titled
  `whatif_delete_initiative_title` for Launch, 5; nothing removed before
  confirm. Confirm → Market left `campb-1..3,early,solo`, Value left `y-out`,
  Pricing left `p-out`; the removers were called exactly `y-in` and `p-in`; no
  Launch header. Then the Value card's own row bin removes `y-out` through the
  same remover (calls `y-in,y-out`).
- **(o) preview** — see Limits: asserted on the engine call, not the dialog's
  digits.
- **Structure (X), 7 new pins:** handleSetInitiative defined once; `{ initiative }`
  written 3 times; campaignUnit defined once and read twice by the table; the
  table writes no events; staging sites 7 and handleDeleteCampaign callers 3;
  the confirm's two per-row remover loops and no `setYieldEvents` /
  `setPricingEvents` in WhatIfTab; computeAdjustedForecast 6.

## 4. Re-aims and traps

### `campaign-delete :326` — did NOT go red

Run on the built tree: `campaign-delete spec: 97 passed, 0 failed`. The pin
counts the literal `kind: 'campaign'`, and the initiative bin stages
`kind: 'initiative'`, so its premise (a campaign change staged in one place)
still holds. **No red was seen, so it was not re-aimed.** Instead a pin was
ADDED beside it naming both kinds:

    PIN: staging sites EXACTLY 7 — one `kind: 'campaign'` (the campaign bin),
    one `kind: 'initiative'` (the initiative bin)

Seen red by hand: WhatIfTab md5 `68f4aaf85ed685bd7539efe6fa3b19c5` backed up,
the initiative staging planted as `kind: 'campaign'` (planted
`a4fcd6ca63a1241290849610e8c6b846`), restored from the backup
(`68f4aaf85ed685bd7539efe6fa3b19c5`, identical):

    campaign-delete spec: 96 passed, 2 failed
      FAIL  PIN: a campaign change is staged in ONE place — `kind: 'campaign'` occurs once  [2]
      FAIL  PIN: staging sites EXACTLY 7 — one `kind: 'campaign'` (the campaign bin), one `kind: 'initiative'` (the initiative bin)  [sites 7, campaign 2, initiative 0]

Now 98/98.

### `view-apply-mounted` — did not go red

The pendingChange shape change does not reach D5-04's commit route:
`view-apply-mounted spec: 208/208 passed`, untouched.

### Traps 266–271, seen red by hand

Each: md5 before, backup to the scratchpad, plant, `spec:initiatives`, restore
FROM THE BACKUP, md5 after. All six restored identical.

| trap | file | before | planted | after | tally |
|---|---|---|---|---|---|
| 266 | EventsSummaryTable | 69fe387b…d6e8 | 9e7cb27f…82e2 | 69fe387b…d6e8 | 97 passed, 14 failed |
| 267 | EventsSummaryTable | 69fe387b…d6e8 | 17c93c58…a6 | 69fe387b…d6e8 | 106 passed, 5 failed |
| 268 | EventsSummaryTable | 69fe387b…d6e8 | ad2aec30…c8 | 69fe387b…d6e8 | 105 passed, 6 failed |
| 269 | EventsSummaryTable | 69fe387b…d6e8 | 3f175df0…c33 | 69fe387b…d6e8 | 108 passed, 3 failed |
| 270 | WhatIfTab | 68f4aaf8…19c5 | 82072b15…8c78 | 68f4aaf8…19c5 | 105 passed, 6 failed |
| 271 | WhatIfTab | 68f4aaf8…19c5 | 528d0705…ee | 68f4aaf8…19c5 | 110 passed, 1 failed |

Full md5s: EventsSummaryTable `69fe387b0d1ee3e3b82412856d93d6e8`, WhatIfTab
`68f4aaf85ed685bd7539efe6fa3b19c5`; planted 266 `9e7cb27f393a378bc870ec32013282e2`,
267 `17c93c58f7bb0463d75719a2bd826fa6`, 268 `ad2aec30c23232714c3a764678fb55c8`,
269 `3f175df03ec0f5393c7ee414b8d5f33c`, 270 `82072b156e94c37babb0c66ba8188c78`,
271 `528d0705ee89749f755b2edc31909d0e`.

The first red line of each:

- **266** Group as writes only the ticked row (the tick's unit is `[r]`):
  `FAIL  (i) ticking ONE campaign row ticks all THREE  [false,true,false]`
- **267** Ungroup clears one row:
  `FAIL  (l) Ungroup on ONE campaign row clears the WHOLE campaign  [New,New,-]`
- **268** Dissolve stages the bin instead of clearing the field:
  `FAIL  (m) no dialog for Dissolve`
- **269** Rename onto a used name merges without the dialog:
  `FAIL  (n) renaming onto a USED name asks first`
- **270** the bin's confirm removes Market members only:
  `FAIL  (o) confirm removed the VALUE member and nothing else  [y-in,y-out]`
- **271** the bin's preview varies marketEvents only:
  `FAIL  (o) the preview varies all THREE arrays — market, yield and pricing from the pending change  [const after = computeAdjustedForecast({ ...shared, marketEvents: pendingChange.nextEvents }]`

271 is red at the SOURCE level only, and that is stated rather than hidden: the
dialog shows Inflow/Outflow/Retention/Base, which Value and Pricing events do not
move, so a Market-only preview shows the same digits. No green plant needed
removing.

All six registered in `scripts/guard-traps.ts` under `INITIATIVES`.
`spec:trap-anchors`: 283 passed, 0 failed (266 traps, 278 anchors).

## 5. Gate

Run serially, in this order, on the tree committed as `c9ff73b`.

| check | result |
|---|---|
| `npx tsc --noEmit` | clean |
| `npm run lint` | clean (exit 0) |
| `npm run build` | built |
| `spec:initiatives` | 111 passed, 0 failed |
| `spec:campaign-delete` | 98 passed (97 + the new staging pin) |
| `spec:view-apply-mounted` | 208/208, not red |
| `spec:trap-anchors` | 283 passed, 0 failed (266 traps, 278 anchors) |
| `spec:i18n-parity` | 203 passed, 0 failed; 947 keys in each of en de es fr it pt (was 931) |
| `spec:i18n-scan` | PASS |
| `spec:survival` | 27 passed, 0 failed; FIRST-ROW DEREFERENCES 104 across 26 files (unchanged) |
| `npm run suite` | **76/76 green** |
| `npm run guard-traps -- --targeted` | **94/94 CAUGHT**, to a file (line below) |

The certification line, verbatim:

```
guard-traps targeted 94/94 CAUGHT (ids 70 71 74 75 76 77 78 79 80 81 121 122 132 133 166 167 168 169 170 171 174 175 176 177 178 179 180 181 182 183 184 185 186 187 190 191 202 203 204 205 222 225 226 227 228 229 230 231 232 234 235 236 237 238 239 240 241 242 243 244 257 258 260 261 262 263 264 265 266 267 268 269 270 271), rotation 20 (ids 21 22 23 24 25 26 27 29 30 32 33 34 35 36 37 38 39 40 41 42), NOT RUN 172, last FULL run 6693bd6 2026-09-16T15:35:08.324Z
```

Traps 266–271 each CAUGHT. **guard-traps left the tree clean**: all 23 harness
TARGETS were backed up to `scratchpad/pre-gt52/` and md5'd before the run, and
all 23 are identical after it. The ledger is committed WITH this report; the
build commit `c9ff73b` excludes it.

| count | measured |
|---|---|
| last columns Market / Yield / Pricing | 6 / 4 / 4 (event-toggle and the column pins, green in the suite; the 3 writers unchanged) |
| computeAdjustedForecast | 6 |
| eventScopeSeriesFor callers | 5 |
| solveForCohortTarget definitions | 1 |
| buildPromoEvents | 5 |
| resetYieldDraft() calls | 2 |
| handleDeleteCampaign callers | 3 |
| setPendingChange staging sites | 7 |
| campaignToggleState definitions | 1 |
| handleSetEventEnabled definitions | 1 |
| initiativeGroups definitions | 1 |
| handleSetInitiative definitions | 1 |
| carryInitiative sites | 3 |
| writes of `{ initiative }` in WhatIfTab | 3 |
| handleDeleteInitiative definitions | 1 |

## What was shed

Nothing. Rename with its merge dialog and the bin were both built; the setter and
whole-campaign moves were never at risk.

## Limits

- **The bin's preview is asserted on the engine call, not the dialog** — see 271.
  The dialog cannot show the difference Value/Pricing removal makes.
- **The merge prompt is an inline panel inside the summary**, not the modal
  `EventChangeConfirmModal`: it changes no figure, so there is nothing to
  preview. It has the testids `events-summary-merge-dialog/-title/-confirm/-cancel`.
- **Value and Pricing editors open on a binned member are not closed**, the same
  as those cards' own row bins today (they call the remover and nothing else).
  Market campaign editors are closed.
- **Rename is case-sensitive** (clause 11): "big" onto "Big" is an unused name
  and renames without a prompt, giving two headers.
- The merge prompt's `{n} events` is not plural-aware ("1 events"), as clause 11's
  wording is literal.
- **Two single events with the same Market name tick together**: a Market row's
  `campaignName` falls back to its name on read (`forecasting.ts` market reader),
  which is how the card pills already group them. Not exercised.

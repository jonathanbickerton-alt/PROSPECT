# REQ-D6-08 session 1 — the Initiative column, the carry, the summary header and switch

## FOR ADVISOR

```
Generated: 2026-09-16 21:05 +0100 (UTC 2026-09-16 20:05)
Certifies: 6c12fab942f6d34a94224bda686dbd203d12b8eb
Repo: committed 6c12fab, pushed (origin in sync)
Initiative is written LAST on Market/Yield/Pricing by the 3 existing
writers, read by the 3 existing readers through one trimmed parse
(initiativeFromCell); the field is declared once, on EventToggle.
CARRY: carryInitiative at ALL THREE campaign saves - Volume :5660,
Promotion :6121 and the churn save :5547, a third rebuild the 1606
inventory missed. Row edits on all four cards keep it by merge.
Summary: initiativeGroups (defined once) lays out headers at the earliest
member; the header switch = campaignToggleState + handleSetEventEnabled
with each member's OWN pass. Effect cell: per-state count. Compare: column.
spec:initiatives 45/45 (a)-(g) + structure. Traps 261-265 all seen RED by
hand against pre-plant md5s and restored identical from backup.
Re-aims seen red: last columns 6/4/4 (5 specs), handleSetEventEnabled
invocations 5->6, i18n-parity allowlist 54->55 / 192->194 (Initiative in
de/fr is the word).
Survival stayed 104/26: 3 new x[0]. sites were guarded with ?., not
baselined.
New key: whatif_summary_col_initiative (931 keys per locale).
Nothing was shed. No decision is reserved for Jon.
guard-traps targeted 80/80 CAUGHT, rotation 20, NOT RUN 180 (line
verbatim in section 4), last FULL run 6693bd6 2026-09-16T15:35Z
full suite:  76/76 green
```

## 0. Base

Quoted before any change:

- `git status --short` — empty.
- `git diff ab2c634 HEAD --stat -- src` — empty.
- `git diff ab2c634 HEAD --stat -- scripts` —
  `scripts/guard-traps-ledger.json | 1372 ++++++++-----` (the ledger only).

Item 0 skipped, as the brief says: clauses 1–15 were already committed
(`6b7fdea`, `69624ef`).

## 1. Item 1

### Storage — one writer, one reader, per sheet

- **The field.** `initiative?: string` is on `EventToggle`
  (`src/types/forecast.ts:375`). Every carrier extends it (`MarketEvent`,
  `YieldEvent`, `PricingEvent`, `YieldEventLike`, `StoredEventModifiers`), so it
  is declared once, the way `enabled` and `tariffScope` are.
- **Writers**, LAST, `''` when none:
  - Market `forecasting.ts:487`
  - Pricing `:1514`
  - Yield `:1865`
- **Readers**, through ONE parse `initiativeFromCell` (`:1223`: trimmed, blank
  or absent → `undefined`):
  - Pricing `:1561`
  - Market `:1652` (the shared modifier reader, so the session and workbook
    routes both read it)
  - Yield `:1919`
- No new writer or reader.

### The carry

`carryInitiative(rebuilt, replaced)` (`forecasting.ts:1237`) gives rebuilt rows
the initiative their predecessors carried, so added months join it (clause 9).
It lives at **all three** campaign saves:

| save | site |
|---|---|
| Volume campaign | `WhatIfTab.tsx:5660` |
| Promotion campaign | `WhatIfTab.tsx:6121` |
| **Churn campaign** | `WhatIfTab.tsx:5547` |

The churn save is a third row-rebuild the 1606 inventory did not list: it
replaces the campaign's rows without `resequenceRebuild`, so it would have
dropped the initiative too.

**Row edits keep it by merge.** None of them sets `initiative`; the only
references to it in `WhatIfTab.tsx` are the import, the carries and the summary
wiring (`grep` above).
- Volume `{...e, ...patch}` (`:5846`; churn `:5801`).
- Promotion `updateMarketEvent(id, {...events[0], id})` (`:6083`).
- Value `updateYieldEvent(id, patch)` (`:3602`).
- Pricing `updatePricingEvent(id, patch)` (`:4838`).

All four merge onto the existing row through App's `updateById`, whose patch
does not name the field. **This is by construction and was not exercised
mounted this session**; the (c) cases drive the two campaign saves.

### The summary

- **Rows.** `EventSummaryRow` gains `initiative` and `campaignName`, set by
  `buildEventsSummaryRows`. Its order is unchanged, and `compare-events-panel`
  and `events-summary` stayed green without re-aim.
- **Layout.** `initiativeGroups(rows)` (`forecasting.ts:1372`, one definition)
  returns `header | row` entries. A group appears where its earliest member
  falls; its members follow in today's order; ungrouped rows keep their place.
  It is called WhatIfTab-side (`WhatIfTab.tsx:3277`) and passed as `entries`
  (`:7039`). `EventsSummaryTable` renders what it is given and builds nothing.
- **Header row.** It shows the name and "{n} events" (the existing
  `whatif_summary_count` key).
  - *The switch* is `EventOnOffSwitch` with `campaignToggleState(members)`.
    A click calls `handleSetInitiativeEnabled` (`WhatIfTab.tsx:3286`), which is
    `members.forEach(r => handleSetEventEnabled({ id: r.id, pass: r.pass }, next))`.
    Each member's own carrier is written.
  - *The Effect cell* counts members per state, empty states omitted. Order is
    `INITIATIVE_EFFECT_ORDER`: volume, arpu, no-coverage, superseded,
    not-applied-here, off. That is the order the Effect cell's own styling tests,
    with Off last as in clause 14's example.
  - No bin and no controls.
- **Counting (clause 13).** The badge counts `rows.length`, which is events. The
  Show all threshold counts `shown.length`, every visible entry, headers
  included.
- **Compare.** `ScenarioCompareTab` passes `showInitiativeColumn` only. It gets a
  read-only Initiative column after Name, pipeline order, no header, no switch.

### i18n

One new key, `whatif_summary_col_initiative`:

| locale | keys before | keys after | value |
|---|---|---|---|
| de | 930 | 931 | Initiative |
| en | 930 | 931 | Initiative |
| es | 930 | 931 | Iniciativa |
| fr | 930 | 931 | Initiative |
| it | 930 | 931 | Iniziativa |
| pt | 930 | 931 | Iniciativa |

## 2. Mounted — `scripts/initiatives-mounted-spec.tsx`, 45/45

The harness is spread-ramp-volume's store, with a Host holding **all three**
carriers in real state with App's update semantics. The fixture: "Launch" =
Volume campaign CampA (3 rows, months 2–4), a Value event and a Pricing event.
Ungrouped: Early (month 0), Solo (month 3), a Value and a Pricing event.

- **(a)** `Initiative` is written LAST on all three sheets; empty for a
  non-member. Through a real workbook, every member reads back and non-members
  read none. A Value cell written as `"  Launch "` reads back `Launch`.
- **(b)** The same rows with the column deleted: no initiative on any row,
  `initiativeGroups` yields no header, and the mounted summary renders none.
- **(c)**
  - *Volume:* the CampA pill, duration 3 → 4, Save campaign → 4 rows, every
    one in Launch (the added month included); ungrouped rows untouched.
  - *Promotion:* a 2-row PromoC campaign in "PromoInit", its pill, Save campaign
    → the rebuilt rows (new ids) keep PromoInit.
- **(d)** The rendered sequence, hand-written:
  `row-early | initiative-Launch | row-camp-1 | row-camp-2 | row-camp-3 | row-y-in | row-p-in | row-solo | row-y-out | row-p-out`.
  - One header; "5 events".
  - The panel badge says 9 events (not 10 entries).
  - The header Effect reads `Volume ×3 · ARPU ×2`.
- **(e)**
  - *All on → click:* every Market member off, **the Value member off, the
    Pricing member off**; no non-member moved; the header reads off.
  - *One member back on:* the Value member through **its card's** switch (the
    Value table's `event-on-y-in`, not the summary's) → the header reads
    `mixed`.
  - *Click mixed:* all 5 members on, and the header reads on.
- **(f)** 4 Value events in "Alpha" and 4 Pricing events in "Beta": badge "8
  events"; 10 entries render; Show all is offered.
- **(g)** Compare's rows through `buildPerFileEventPanels`, rendered with
  Compare's props: pipeline order, one row per event, no header. The Initiative
  cell reads `Launch` on a member and is blank on Solo. Source check:
  `ScenarioCompareTab` passes `showInitiativeColumn` and neither `entries` nor
  `onSetInitiativeEnabled`.
- **Structure.** `initiativeGroups` defined once; `campaignToggleState` and
  `handleSetEventEnabled` defined once each; `carryInitiative(` at exactly 3
  sites.

## 3. Re-aims and traps

### Re-aims, each seen red first

The post-build suite was **69/75**:

| spec | the red, quoted | re-aim |
|---|---|---|
| `event-toggle` | `FAIL export: Tariff_ARPU_Basis is LAST on Market_Events (D6-07 c14) [Initiative]` and ten siblings across the three sheets | Market 6 / Yield 4 / Pricing 4 positions, every one named |
| `event-toggle` | `FAIL pin: EXACTLY 5 invocations of handleSetEventEnabled [6 - …]` | 6, and the pin now also requires the member loop's exact own-pass text |
| `hold-shape` | `FAIL COLUMN: Tariff_ARPU_Basis is LAST (D6-07 c14) [Initiative]` (+2) | Hold −4, Mode −3, Basis −2, Initiative last |
| `spread-ramp-promo` | `FAIL (g-b|c|d) Mode is second-to-last, Tariff_ARPU_Basis LAST [Tariff_ARPU_Basis / Initiative]` | Mode −3, Basis −2, Initiative last |
| `spread-ramp-volume` | same, `[Tariff_ARPU_Basis / Initiative]` | same |
| `pricing-roundtrip` | `FAIL D5-14: Contract_Length_Months is the LAST column on Pricing_Events [Initiative]` (+1) | Contract_Length_Months −2, Initiative last, Tariff_Scope −3 |
| `i18n-parity` | `FAIL PARITY de: … [1 — first: whatif_summary_col_initiative]`, same for fr, `FAIL ALLOWLIST: … [194 vs 192 …]` | allowlist entry (de, fr — "Initiative" is the word) and pins 55 / 194 |

Not red, so not re-aimed: `compare-events-panel` (its row-object pins at
`:395`, `:420` compare JSON, and `undefined` fields do not serialise) and
`events-summary` (order pin).

**`survival` went red on the new spec**:
`FAIL survival: initiatives-mounted-spec.tsx has exactly 0 first-row dereference(s) [counted 3 …]`.
The three `x[0].` sites were **guarded with `?.`** rather than baselined, so an
empty array would print a failure instead of crashing the spec. The total is back
to 104 across 26 files.

### Traps 261–265, seen red by hand

Each: md5 before, backup to the scratchpad, plant, run `spec:initiatives`,
restore FROM THE BACKUP, md5 after.

| trap | file | md5 before = after | planted | tally | red line |
|---|---|---|---|---|---|
| 261 Pricing writer omits the column | forecasting.ts | `d9c1474a…` | `c3d581c0…` | 38/45 | `FAIL (a) Initiative is written LAST on Pricing_Events [Contract_Length_Months]` |
| 262 Promotion campaign save drops it | WhatIfTab.tsx | `a2c6eab3…` | `0353c792…` | 43/45 | `FAIL (c) the rebuilt PROMOTION rows keep the initiative [hm0xkkzgf:-,krgsxkf7o:-]` |
| 263 header switch hard-codes pass 0 | WhatIfTab.tsx | `a2c6eab3…` | `170d2d57…` | 40/45 | `FAIL (e) OFF: the VALUE member is off — its own carrier was written [true]` |
| 264 groups above all ungrouped rows | forecasting.ts | `d9c1474a…` | `14bf92f6…` | 44/45 | `FAIL (d) the order: … [initiative-Launch | … | row-early | …]` |
| 265 badge counts header entries | EventsSummaryTable.tsx | `9189cb4b…` | `d49c009f…` | 43/45 | `FAIL (d) the panel badge still counts EVENTS (9), not entries (10) [10 events]` |

None stayed green. All five are registered in `scripts/guard-traps.ts` with the
same mutations, and `spec:initiatives` is in `CONTROL_SPEC_MAP` with its first
trap, 261.

## 4. Gate

| step | result |
|---|---|
| `npm run suite` | **76/76 green** (75 + initiatives) |
| `npm run guard-traps -- --targeted` | **80/80 CAUGHT** on the first run, 0 missed / inconclusive / crashed (line below) |
| `spec:trap-anchors` | 277 passed, 0 failed (260 traps, 272 anchors) |
| `spec:i18n-parity` | 203 passed, 0 failed — **931 keys per locale**; new key `whatif_summary_col_initiative` |
| `spec:i18n-scan` | PASS |
| `spec:survival` | 27 passed, 0 failed; **104 first-row dereferences across 26 files** |
| `tsc --noEmit` | clean |
| `npm run lint` | clean |
| `npm run build` | built in 9.13s |

The certification line, verbatim:

```
guard-traps targeted 80/80 CAUGHT (ids 70 71 74 75 76 77 78 79 80 81 121 122 132 133 166 167 168 169 170 171 174 175 176 177 178 179 180 181 182 183 184 185 186 187 190 191 202 203 204 205 222 225 226 227 228 229 230 231 232 234 235 236 257 258 260 261 262 263 264 265), rotation 20 (ids 1 2 3 4 5 6 7 8 9 10 11 12 13 14 15 16 17 18 19 20), NOT RUN 180, last FULL run 6693bd6 2026-09-16T15:35:08.324Z
```

Traps 261–265 each CAUGHT. **guard-traps left the tree clean**: all 23 harness
TARGETS were backed up to `scratchpad/pre-gt51/` and md5'd before the run, and
all 23 are identical after it.

The ledger (`scripts/guard-traps-ledger.json`) is committed WITH this report.
The build commit `6c12fab` excludes it. "last FULL run 6693bd6" is the 1459
release gate's run of `ab2c634`'s source.

| count | measured |
|---|---|
| last columns Market / Yield / Pricing | **6 / 4 / 4** (`spec:event-toggle` 161/161) |
| `computeAdjustedForecast` sites | **6** |
| `eventScopeSeriesFor` callers | **5** |
| `solveForCohortTarget` definitions | **1** |
| `buildPromoEvents` in WhatIfTab | **5** |
| `resetYieldDraft()` calls | **2** |
| `handleDeleteCampaign` callers | **3** |
| `setPendingChange({` staging sites | **6** (unchanged) |
| `campaignToggleState` definitions | **1** |
| `handleSetEventEnabled` definitions | **1** (invocations 6) |
| `initiativeGroups` definitions | **1** |

## What was shed

**Nothing.** The storage, the carry at all three campaign saves, the header and
tri-state switch, the Effect count cell and the Compare column are all built.
The shed candidates the brief named (the Effect cell, then the Compare column)
were not needed.

## Limits

- The row-edit carry on the four cards is by construction (merge onto the
  existing row) and is not driven mounted this session.
- Names are compared exactly after trimming. Nothing stops two initiatives that
  differ only in case from appearing as two headers, which is clause 11's rule.
  The merge prompt is session 2's.

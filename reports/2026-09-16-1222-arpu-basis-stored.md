# REQ-D6-07 clause 14 (A) — the ARPU basis stored on the event

## FOR ADVISOR

```
Generated: 2026-09-16 13:41 +0100 (UTC 2026-09-16 12:41)
Certifies: fdc5852b42ad912d100b25fbfc99653aab84a72c
Repo: committed fdc5852, pushed (origin in sync)
Tariff_ARPU_Basis ('Historical'/'Forecast') is written by ONE writer per
sheet: LAST on Yield_Events, after Mode on Market_Events (mix rows only,
'' otherwise). ONE reader per sheet; absent -> Historical.
Reopen restores the stored basis on both cards (row edit, campaign edit,
yield edit); a NEW draft opens on Forecast on both cards.
D5-04 holds with Forecast as the promo default: view-apply-mounted
208/208, "D5-04 changed fields: NONE" (the 1019 red was 36 -> 35.6).
Last-column pins re-aimed to 5/3/3, each seen red first and quoted.
promo-cohort-target: its Historical-basis literals now select Historical;
every new draft in it opened on Forecast (asserted).
New spec arpu-basis 18/18: (a)-(e), reopen checked as a Historical/Forecast
PAIR so "restored" and "defaulted" cannot be confused.
Traps 257 (absent read as Forecast), 258 (writer omits the column), 259
(reopen ignores the basis); 142/192/217 re-anchored.
No new i18n keys: 930 per locale, locale files untouched.
Counts: engine 6; seam 5; solver defs 1; buildPromoEvents 5; last 5/3/3.
Nothing was shed. No decision is reserved for Jon.
guard-traps targeted 130/130 CAUGHT, rotation 20, NOT RUN 124 (line
verbatim in section 3), last FULL run e7c88aa 2026-09-15T22:19Z
full suite:  75/75 green
```

## 0. Base

`git status --short` — empty. `git diff fe0cb7e HEAD --stat -- src scripts` —
empty. Both quoted before any change; HEAD at the check was this report's
skeleton. BASE for the STOP diffs: `fe0cb7e`.

## 1. Item 0 — clause 14 replaced

The held text was replaced with option (A) verbatim and committed alone as
`cfe3c36`, before any code.

## 2. Item 1

### The column — one writer, one reader, per sheet

| sheet | writer | reader | rule |
|---|---|---|---|
| Market_Events | `marketEventExportRow`, appended after `Mode` | `readStoredEventModifiers` (the shared modifier reader behind `marketEventFromRow`) | a mix row writes `Historical`/`Forecast`, any other row writes `''`; a mix row reads `Forecast` → forecast, **anything else → historical**; a non-mix row reads no basis |
| Yield_Events | `yieldEventExportRow`, appended last after `Tariff_Scope` | `yieldEventFromRow` | always written; **absent → historical** |

The writer resolves an unstated basis by the reader's own absent rule, so a save
and its reload cannot disagree. A volume row carries the column as `''`, which
keeps one header for the sheet. `spread-ramp-volume` now asserts this.

Types: `arpuBasis?: 'historical' | 'forecast'` on `MarketEvent`,
`StoredEventModifiers` and `YieldEvent`. The last closes the gap
`types/forecast.ts` recorded beside `pricingMode` as Finding 1.

### The card

- **Promotion arm.** `buildPromoEvents` stamps `arpuBasis` on mix rows only. Its
  four callers (add, row edit, campaign edit, preview) pass `promoYieldArpuMode`,
  and all four read-sets list it. The row edit and campaign edit restore
  `event.arpuBasis ?? 'historical'` (a campaign's rows are built by one call, so
  the first row's basis is the campaign's). `resetPromoDraft` returns the
  basis to Forecast. The default is Forecast.
- **Value card.** The save stamps `arpuBasis: yieldArpuMode`, with it listed in
  the read-set. `handleEditYieldStart` restores `ev.arpuBasis ?? 'historical'`.
  Cancelling an edit, or saving one, returns the card to Forecast for the next
  new draft. A plain add does NOT reset it: a user adding several events keeps
  the basis they chose. The default was already Forecast (D5-11).

### Mounted, fill-in order

**D5-04 (a), quoted from `view-apply-mounted`, 208/208, with Forecast as the
Promotion arm's default:**

```
  D5-04 mix rows restored: High, Low
  D5-04 commits    via Volume 0  via Promotion 1
  D5-04 changed fields: NONE
```

In the 1019 build the same case read `arpu: 36 -> 35.6` with the default on
Forecast. That red is why clause 14 was held.

New spec `scripts/arpu-basis-mounted-spec.tsx`, **18/18**, on the
promo-cohort-target harness:

- **(a)** A promotion row written by the real writer, with the column then
  removed (what a pre-clause-14 save is), read back through a real workbook:
  `arpuBasis` historical. Mounted and reopened through `promo-row-edit-*`: the
  basis toggle shows **Historical**, not the new default.
- **(b)** A new promotion draft, mix arm on: **Forecast**. The builder stamps
  the basis on a mix row, and does not on a promotion without a mix arm (no
  rates, no basis; the writer writes `''`).
- **(c)** The Value card on Forecast, Add: the card saved `forecast`, the writer
  wrote `Forecast`, a real workbook read it back as `forecast`. Reopened as a
  pair, a Historical event shows **Historical** and the Forecast event
  **Forecast**. One reading alone could not tell "restored" from "defaulted".
- **(d)** Three Market_Events mix rows and two Yield_Events rows with the column
  removed, through a real workbook: every one reads **Historical**. The
  discriminator is that the same rows WITH the column read Forecast, so a reader
  that ignored the column entirely cannot pass.
- **(e)** The Value card's new draft: **Forecast**.

A note on (a) and D5-04 together: the D5-04 fixture is built by
`buildPromoEvents` and therefore carries `historical` from the builder rather
than from an absent column. The reopen state is identical either way, since both
paths give `arpuBasis: 'historical'`, and (a) is the case that proves the absent
column reaches that state.

### Re-aims, seen red first

The post-build suite was **68/74**:

| spec | the red, quoted | re-aim |
|---|---|---|
| `event-toggle` | `FAIL export: Enabled is fourth-from-last on Market_Events (REQ-D6-05) [Tariff_Scope]` … `FAIL export: Mode is LAST on Market_Events (REQ-D6-05) [Tariff_ARPU_Basis]`; `FAIL export: and on Yield_Events [Tariff_Scope]`; `FAIL export: Tariff_Scope is LAST on Yield_Events (D5-10) [Tariff_ARPU_Basis]` | Market **5** positions, Yield **3**, every trailing column named; Pricing's 3 untouched and green |
| `hold-shape` | `FAIL COLUMN: Hold is second-to-last (REQ-D6-05) [Mode]`, `FAIL COLUMN: Mode is LAST (REQ-D6-05) [Tariff_ARPU_Basis]` | Hold −3, Mode −2, Tariff_ARPU_Basis last |
| `spread-ramp-promo` | `FAIL (g-b|c|d) Mode is the LAST column [Tariff_ARPU_Basis]` | Mode −2, Tariff_ARPU_Basis last |
| `spread-ramp-volume` | `FAIL (g-b|c|d) Mode is the LAST column written [Tariff_ARPU_Basis]` | same, plus: a volume row writes the column empty |
| `promo-cohort-target` | `FAIL (a) … delivers 15.03 [13.88]`, `FAIL (b) the lead reads 16.91 [15.11]`, `… 33.13 [21.7]`, `(c) … 14.23 [14.02]`, `(e) … 15.86 [14.43]`, `(g) … [13.88 → 13.88]` | the drafts select Historical, keeping the engine-checked literals; every new draft in the file is asserted to have OPENED on Forecast (the spec pinning the old Historical default) |
| `trap-anchors` | `FAIL trap 142 … [ZERO]`, `FAIL trap 192 … [2 occurrences]`, `FAIL trap 217 … [ZERO]` | 142 and 217 re-anchored on the read-sets that gained the basis; 192 anchored on the Value card's own state name, since the bare `useState(... 'forecast')` now occurs twice |

### Traps

| trap | plants | spec |
|---|---|---|
| 257 | the Market_Events reader treats an absent basis as Forecast | arpu-basis |
| 258 | the Yield_Events writer omits `Tariff_ARPU_Basis` | arpu-basis |
| 259 | reopening a yield event ignores its stored basis | arpu-basis |

The new spec is registered in `CONTROL_SPEC_MAP` with its first trap, 257.

## 3. Gate

| step | result |
|---|---|
| `npm run suite` | **75/75 green** (74 + arpu-basis) |
| `npm run guard-traps -- --targeted` | **130/130 CAUGHT** on the first run, 0 missed / inconclusive / crashed (line below) |
| `spec:trap-anchors` | 269 passed, 0 failed (254 traps, 264 anchors) |
| `spec:i18n-parity` | 200 passed, 0 failed — **930 keys per locale**, all six; **no new keys**, no locale file changed |
| `spec:i18n-scan` | PASS |
| `spec:survival` | 27 passed, 0 failed; **104 first-row dereferences across 26 files** |
| `tsc --noEmit` | clean |
| `npm run lint` | clean |
| `npm run build` | built in 6.04s |

The certification line, verbatim:

```
guard-traps targeted 130/130 CAUGHT (ids 56 57 58 63 64 65 67 68 69 70 71 72 73 74 75 76 77 78 79 80 81 87 88 89 90 94 102 145 146 147 148 103 104 105 106 107 108 109 110 111 112 113 120 132 133 138 140 141 142 143 166 167 168 169 170 171 172 173 174 175 176 177 178 179 180 181 182 183 184 185 186 187 190 191 192 193 194 197 202 203 204 205 217 222 225 226 227 228 229 230 231 232 234 235 236 244 245 246 247 248 250 251 252 253 254 255 256 257 258 259), rotation 20 (ids 123 124 125 126 127 128 129 130 131 134 135 136 139 144 149 150 151 152 153 154), NOT RUN 124, last FULL run e7c88aa 2026-09-15T22:19:55.696Z
```

**guard-traps left the tree clean**: the five mutated source files' md5s are
identical before and after the run (`WhatIfTab.tsx` `d3cc80ee…`,
`forecasting.ts` `3c34d144…`, `types/forecast.ts` `d1e64de0…`,
`MixTargetPanel.tsx` `c4b41fb7…`, `mixConstraint.ts` `f7f32f18…`).
Traps 257, 258 and 259 each CAUGHT. The selection is wider than 1019's (130
against 89) because the hunks touch the export and import builders, which many
older traps anchor near.

The ledger (`scripts/guard-traps-ledger.json`) is committed WITH this report,
as the brief asks. The build commit `fdc5852` excludes it.

| count | measured |
|---|---|
| last columns Market / Yield / Pricing | **5 / 3 / 3** (`spec:event-toggle`) |
| `computeAdjustedForecast` sites | **6** |
| `eventScopeSeriesFor` callers | **5** |
| `solveForCohortTarget` definitions | **1** |
| `buildPromoEvents` in WhatIfTab | **5** (1 definition + 4 calls) |
| `handleDeleteCampaign` | **3** |
| the 0706/1019 spec-held pins (runIngest, apply sites, display markers, ramp/hold checkboxes) | green in the 75/75 |

## What was shed

**Nothing.** Item 0 was replaced and committed alone. Item 1 is complete: the
column on both sheets, one writer and one reader each, restore on every reopen
path, the Forecast default for new drafts on both cards, (a)-(e), the re-aims
and traps 257-259.

## Limits

- The Compare tab's readers (`scenarioHelper.ts`) read Market and Yield rows
  directly and were not given the basis. Compare never reopens an event into a
  card, and the engine reads the baked `arpu` / `tariffBaseArpu`, not the basis.
- The basis on a campaign is read from its FIRST row. Every row of a campaign
  is built by one call with one basis, so the rows cannot disagree unless a
  workbook is edited by hand.
- A workbook-route Market_Events row (`marketEventFromRow(r, 'workbook')`) goes
  through the same modifier reader, so a user workbook with a mix and no column
  also reads Historical.

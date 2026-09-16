# REQ-D6-07 — the Value card leads with the cohort ARPU: decisions and inventory

## FOR ADVISOR

```
Generated: 2026-09-16 08:00 +0100 (UTC 2026-09-16 07:00)
Certifies: 1bc094b (src, untouched — no src/ change this session)
Repo: committed 0f11f33, pushed (origin in sync)
Decisions: 44bb483 (EXPECTED.md alone). Design note: 0f11f33 (docs/).
BASE 0af35c6; status --short EMPTY; src diff vs 1bc094b EMPTY. Both quoted.
1 DECISIONS 1-5 RECORDED verbatim before any inventory work.
2 THE PAIR ALREADY EXISTS: yieldPreview (WhatIfTab:3804) computes fitted
  and delivered at the read month. Decision 1 is a promotion, not a build.
3 ONE SEAM CALL = 8.9 ms (10 calls, 12,432 rows). A 20-step bisection
  0.18 s; the real solve took 10 steps / 72 ms. Enter/blur, not keystroke.
4 FINDING, TOLERANCE: the chart ARPU columns are rounded 2dp at source
  (WhatIfTab:1331/1338), so 0.01 is the floor through them; adjustedMonths
  is unrounded. Jon must pick which the solve reads.
5 CLOSED FORM IS A GOOD FIRST GUESS, not the answer: with one tier
  overridden it landed 0.0039 from a 14.2861 target; bisection agreed.
6 REACHABLE IN COHORT TERMS is WIDE: blend band 7.94-39.81 becomes
  5.50-27.61 at the read month. The card shows the blend band today.
7 SUMMARY RATIO needs no engine call (blend / equal-weight, from the
  event); the per-month PAIR does - the row builder has no forecast.
8 EXPORT UNTOUCHED: Yield_Events columns and the forecast sheet's
  Blended ARPU columns are unchanged by decisions 1-5.
9 5 QUESTIONS for Jon in the design note, all underdetermined by 1-5.
SHED: nothing. Items 0, 1 and 2 done.
Suite **72/72 green**; no guard-traps run (inventory session, no src change).
```

## 0. Base

BASE `0af35c6` (the 2229 report's `Repo:`; `src` at `1bc094b`). After the skeleton
(`f586ec6`, the session's first repo action):

```
$ git status --short
(empty)
$ git diff 1bc094b HEAD --stat -- src
(empty)
```

Still empty at `0f11f33`: this session changed `test-data/EXPECTED.md`, `docs/` and the
report only.

## 1. Item 0 — REQ-D6-07 decisions recorded

Decisions 1–5 verbatim under a new heading in `test-data/EXPECTED.md`, committed **alone**
at `44bb483` (27 insertions), before any inventory work.

## 2. Item 1 — the inventory

### 1.1 The Target box today

| what | where |
|---|---|
| the typed string, draft-only | `WhatIfTab.tsx:2775` `yieldTargetArpu`, parsed `:2776–2782` |
| **what the solver is handed** | `solveForTarget(yieldMembers, draftMix, yieldMixLocked, effectiveTierArpuMap, yieldTargetParsed)` — `:2787–2790`. The typed number is a **BLEND target** in tier-rate space, never a cohort ARPU |
| the reachable range | `achievableTargetRange(...)` `:2759–2761`; derivation `mixConstraint.ts:891–912`, which drives `rebalanceToTarget` to each member's extreme (`:909–910`) |
| collapsed range | `:2763` `yieldRangeCollapsed` |
| the wall | `handleSliderChange` → `dragUnderTarget` `:2825–2838`; state `yieldWall` `:2803` |
| exactly determined | `exactlyDeterminedUnderTarget` `:2812–2817` |
| **what Apply writes** | `handleYieldApplyTarget` `:2796–2799` → `setDraftMix(outcome.shares)`. The **mix** persists; the target never does (`:2765–2772`) |
| the control | `MixTargetPanel.tsx` — testids `yield-mix-target`, `-apply`, `-range`, `-blocked`, `-determined`, `-wall`, `-range-collapsed`; mounted by the Value card at `WhatIfTab.tsx:10352` and by the Promotion arm at `:9601`. It **computes nothing** (`MixTargetPanel.tsx:20–24`) |

**Specs that pin it:** `value-padlock-mounted-spec.tsx:420–624` (box, Apply's enabled state,
the range readout, blocked-and-never-clamped at `:478`); `mix-constraint-spec.ts:462–600`
(the solver's arithmetic); traps **192–194** (`guard-traps.ts:2720, 2734, 2747`, spec
`yield-roundtrip`) and **197–198** (`:2788, :2800`, spec `view-apply-mounted`).
`mix-card-spec.tsx` does **not** pin the Value target box — searched, no `mix-target` hit.

### 1.2 Every surface that renders a BLEND

| surface | where | fate under decisions 1–3 |
|---|---|---|
| the two big figures | `WhatIfTab.tsx:10443–10456`; values `baselineBlendedArpu` `:2848–2865` (equal-weight of the effective rates) and `draftBlendedArpu` `:2840–2846` (share-weighted); keys `whatif_baseline_blended_arpu` / `whatif_new_blended_arpu` / `whatif_equal_weight_avg_of_tier_arpus` | **demoted** to the collapsed line |
| the ratio caption | `:10461–10465`, key `whatif_yield_ratio_caption` | moves with them |
| the preview pair | `:10471–10530` — `yield-preview-baseline` / `-adjusted` / `-pct` / `-rival` / `-superseded` | **promoted** to the lead |
| Events summary ADJUSTS | `yieldEventSummary` `forecasting.ts:1002–1010`, key `whatif_summary_yield` = `{{ibro}} mix, {{bands}} bands → {{blend}}`; row built `:1242–1254` | **rewritten** to the ratio |
| its tooltip | **there is none today** — `EventsSummaryTable.tsx:239` renders `{r.adjusts}` with no `title` | **new** |
| Compare's per-file panel | `ScenarioCompareTab.tsx:725`, rows from `buildEventsSummaryRows` (`forecasting.ts:1306`) | inherits the new string; read-only, no other change |
| the Promotion mix arm | shares `MixTargetPanel` (`:9601`); its own blend `blendTierMixOrNull` `:3089` | **untouched** |
| **exports** | `yieldEventExportRow` `forecasting.ts:1679–1701` (`Tariff_Mix_JSON`, `Tariff_Base_ARPU_JSON`, `Tariff_Mix_Locked`, `Tariff_Base_ARPU_Override_JSON`); forecast sheet columns `App.tsx:3667` `Blended ARPU (Baseline)` / `(Uplifted)` | **untouched — no column added, renamed or removed** |

### 1.3 The preview's seam, and the cost of one call

`eventScopeSeriesFor` `WhatIfTab.tsx:3670–3766`: `yieldDraft` / `excludeYieldId` at
`:3687–3688`, `arpuIdsByMonth` built at `:3751–3752`. Three callers: the Pricing preview
(`:3779`), the Pricing card (`:4364`) and the Value preview (`:3820`). **The month read**
is `:3828–3832`: Inflow takes the first month **after** the draft's, Retention the draft
month, both by key.

**Measured** (trimmed fixture, 12,432 rows, cohort Corporate|All, the engine call the seam
makes):

| figure | value |
|---|---|
| one call | **8.9 ms** mean (median 8.8, min 8.4, max 10.1, 10 calls) |
| a 20-step bisection | **0.18 s** |
| the real solve (below) | **10 steps, 72 ms** |
| two calls for the band's ends | **29 ms** |

**Verdict: not per keystroke.** 0.18 s per solve is two orders above a keystroke budget;
D4-02's commit rule already commits a typed figure on blur. Enter / blur / Apply.

### 1.4 The override case, measured

Tiers and rates from the fixture: Low Value 5.8783, Medium Value 12.2633, High Value
39.8090. **One tier overridden** (R3), Low Value → 7.9357, so equal-weight 20.0027.

| quantity | value |
|---|---|
| fitted ARPU at the read month (2026-11) | **13.87** |
| flat mix delivers | 13.87 (ratio 1.0000 — an even mix is the equal-weight denominator) |
| target typed (cohort) | **14.2861** |
| closed form `target × equal-weight ÷ fitted` | blend **20.6027** → seam delivers **14.29**, miss **+0.0039** |
| bisection on the seam | 10 steps, 72 ms → blend **20.6041** → delivers **14.29**, miss **+0.0039** |

**They agree to the penny, and cannot do better**, because the column is rounded (1.5).
So the closed form is the right **first guess**, and bisection is what proves it — not a
replacement for it. The 12.94 / 12.9653 example was not reproducible here (a different
cohort and fixture), so this case is quoted in its place, measured end to end.

### 1.5 The two edge cases

- **Outside the band.** `solveForTarget` returns `blocked` with the binding member:
  above → `above-max`, binding `High Value` at 39.8090; below → `below-min`, binding
  `Low Value` at 7.9357. The card shows it and never clamps
  (`MixTargetPanel.tsx:143–157`). **In cohort terms the band is much narrower than the
  blend band**: 7.94–39.81 of blend is **5.50–27.61** of delivered ARPU at 2026-11.
  Today's readout shows the blend band, which is the figure decision 2 retires.
- **Fitted ARPU absent.** A month the series does not carry returns no row, so
  `yieldPreview` yields `baseline: null, adjusted: null` and the card renders
  `yield-preview-absent` with the seam's own reason (`WhatIfTab.tsx:10476–10479`). A draft
  whose stored rates are **empty** is different: the engine's ratio falls back to 1
  (`:1771–1773`), so delivered **equals** fitted (13.87 / 13.87) and the card would show a
  target that can never move. The solve must refuse both, and say which.

### 1.6 The summary cell

`yieldEventSummary(e, t)` is built **from the event alone** — `bands` from `tariffMix`,
`blend` from `blendTierMixOrNull` over the stored (effective) rates. `buildEventsSummaryRows`
takes only the three event lists and `t` (`forecasting.ts:1214–1221`): **no forecast, no
`arpuIdsByMonth`**.

- **The persisting ratio is available** without an engine call: it is
  `blend ÷ equal-weight(stored rates)`, the same arithmetic the engine applies at
  `WhatIfTab.tsx:1766–1773`. Decision 3's cell can be built there.
- **The per-month pair is not.** It needs the seam, so the tooltip's figures must arrive as
  an opt-in prop from a caller that has a forecast — Compare has none, which suits decision 5.

### 1.7 Which specs go red on the build

| spec | assertion it pins | why it reddens |
|---|---|---|
| `events-summary-spec.ts:117–121` | `'Inflow mix, 2 bands → 15.00'`, and the unknown-blend arm | decision 3 rewrites the string |
| `compare-events-panel-spec.ts:223` | `yld.adjusts === 'Inflow mix, 2 bands → 16.00'` | same string, through Compare |
| `yield-roundtrip-spec.ts:390–402` | the preview testids, `yield-ratio-caption` **and** `t('whatif_yield_ratio_caption')`, plus a key-presence list | the caption moves into the collapsed line; keys are added |
| `value-padlock-mounted-spec.tsx:422, 488, 541, 583, 613` | the `yield-mix-target-range` readout | the readout becomes cohort terms (5.50–27.61, not 7.94–39.81) |
| `view-apply-mounted-spec.tsx:2659–2663` | `yield-preview` present, and its baseline/adjusted/rival text | the pair is promoted and re-labelled |
| `i18n-parity` / `i18n-scan` | key counts per locale, no bare strings | eight new keys × six locales |
| traps **192–194** (`yield-roundtrip`), **197–198** (`view-apply`) | anchors inside the preview and the seam | the lines move; re-anchor in the same commit |

## 3. Item 2 — the design note

`docs/REQ-D6-07-value-card-design-note.md`, 58 lines, committed `0f11f33`: the card's shape,
the solve loop with its measured costs, the summary cell, what stays untouched, the eight
keys, and **five questions** for Jon — tolerance and which column the solve reads; the
solve's month; whether the summary cell carries the rival marker; whether the cohort band is
computed per render or only on a typed target; and roll-forward wording.

## Gate

`npm run suite` only, as briefed — this is an inventory session and no `src` changed, so
guard-traps was not run.

| check | figure |
|---|---|
| `npm run suite` | **72/72 green** |
| `git diff 1bc094b HEAD --stat -- src` | **(empty)** |

## What was shed

**Nothing.** Item 0 (recorded alone), Item 1 (all seven parts, measured where the brief said
measure) and Item 2 (the note) are done.

## Limits

- **The measurement is one cohort on the trimmed fixture** (Corporate|All, tiers Low /
  Medium / High Value). The 8.9 ms call cost and the 5.50–27.61 band are that cohort's; a
  wider cohort will cost more per call.
- **The engine was driven directly**, not through a mounted card. `computeAdjustedForecast`
  is what the seam calls, so the cost and the delivered figures are the real ones, but the
  card's own memoisation (`:3779`, `:3820`) is not in the number.
- **No `src` was changed and no guard-traps run**, so nothing here re-certifies the build;
  the last FULL run stands at `e7c88aa` in the ledger.
- **Decision 3's tooltip has no existing carrier.** The summary table renders `adjusts` as
  plain text, so the tooltip is new surface, not a re-label.

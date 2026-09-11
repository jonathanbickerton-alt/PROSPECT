# REQ-D6-05 Spread vs Ramp — decisions recorded, editors inventoried

```
FOR ADVISOR
Generated: 2026-09-11 10:38 +0100 (UTC 2026-09-11 09:38)
Certifies: 17b52d5   (last gated hash; docs session, no src change)
BASE 6fd13f8 (the D5-05-held Repo line). status --short EMPTY; log -3 quoted.
1 REQ-D6-05 RECORDED verbatim, EXPECTED.md alone (f664299). Supersession
  sentence placed BEFORE clause 2 and BEFORE clause 7, where readers stop.
2 TODAY ONE EDITOR, TWO MEANINGS: the share boxes are SPLIT with Hold OFF
  and CUMULATED with Hold ON — exactly the coupling REQ-D6-05 removes.
3 DECISION 5 NAMES A CAPABILITY NEITHER CARD HAS: both spreads' boxes edit
  share % only. The only typed per-month editor is churn's, in points.
4 AN UNHELD RAMP AND A SPREAD CAN STORE IDENTICAL ROWS: 1k/2k/3k is a ramp
  to 3k and a spread of 6k. Rows alone cannot restore the chosen mode.
5 PROMO SWITCH ALREADY SAYS "Ramp" for the share split and is NOT gated on
  percentage; clause 7's gate was only built on the Volume card.
6 SPREAD OFF + HOLD ON builds a 24-row campaign with NO row preview on
  either card: the held-tail line sits inside the hidden panel.
7 DILUTION: no month control; converted once, stamped on every row's ARPU,
  never read back by the engine. A ramp: cheap in the engine, costly in
  persistence, restore, its non-linear definition, Pricing-card parity.
8 CHURN (already a typed-values ramp): editing target or months DISCARDS
  typed months; no non-decreasing check exists on any card.
QUESTIONS FOR JON: 8, in docs/REQ-D6-05-spread-vs-ramp-design-note.md.
suite 69/69 green. No guard-traps: docs session, per the brief.
Repo: committed f664299 + 14d9442, pushed (origin in sync)
```

## 0. Base

**BASE is `6fd13f8`** — the D5-05-held session HAS reported, and that is its
`Repo:` line, so the brief's rule names it rather than the `7206ff0` fallback.
HEAD has moved past it through the file-size caption session (build `17b52d5`,
report `1c72489`), which is the **last gated hash** and what this docs session
certifies.

```
$ git status --short
(empty)

$ git log --oneline -3
1c72489 Fill the file-size caption gate figures: 69/69 and 220/220
17b52d5 REQ-D6-04 decision 4: the caption reads the constant; restore survives a throw
003e654 Fill the file-size caption report narrative before the gate; figures pending
```

**One protocol slip, recorded.** The clock and `git status` were read in
parallel *before* the skeleton was written; CLAUDE.md puts the skeleton first.
Both reads were read-only and nothing depended on their order, but the rule is
explicit. Skeleton `ad4d5a0` followed immediately.

**No `src/` file was changed.** The only commits are the skeleton, `EXPECTED.md`
(`f664299`), the design note and this report.

## 1. Item 0 — the decisions, recorded

`test-data/EXPECTED.md`, committed **alone** at `f664299` (41 insertions, one
file). "REQ-D6-05 — SPREAD vs RAMP (Jon, 2026-09-11)" appended at the end —
REQ-D6-04 was the last section — with decisions 1–6 and the supersession
sentence verbatim.

**The supersession sentence is written TWICE, not once**: immediately before
clause 2 and immediately before clause 7. "Beside those clauses" and the file's
own maintenance note ("correct the LEAD — do not append the correction
underneath it; readers stop at the first assertion") point the same way: a reader
arriving at clause 2 or at clause 7 meets the supersession before the text it
supersedes. Each marker also says **the build has not happened**, so the code
still follows the clauses below it — otherwise an agent reading EXPECTED.md as
source of truth would assert behaviour the tree does not have.

## 2. Inventory — Volume card (`src/components/WhatIfTab.tsx`)

### 1.1 The spread section

| control | file:line | edits | displays beside it | validation | state |
|---|---|---|---|---|---|
| section gate | `:7166` | — | — | shown unless `scenario === 'ARPU'` or a churn draft | — |
| Spread switch (`volume-spread-toggle`) | `:7170–7176` | on/off | label `whatif_spread_volume_over_multiple_months` "Spread volume over multiple months" | **rendered only when `!isPercentageDraft \|\| holdAfterRamp`** (clause 7) | `spreadEnabled` `:2462` |
| panel gate | `:7195` | — | — | `spreadEnabled && (!isPercentageDraft \|\| holdAfterRamp)` | — |
| Duration | `:7202–7210` | months | label `whatif_spread_duration_months` | `min 2 max 24`, `Math.round` + clamp in `onChange` | `spreadMonths` `:2470` (default 3) |
| Even / Custom % | `:7217`, `:7223` | distribution type | label `whatif_distribution`; `whatif_even` / `whatif_custom_pct` "Custom %" | — | `spreadDistType` `:2471` |
| per-month row | `:7263–7297` | — | Month · **computed Volume** = `total × fraction` from `spreadShape` (`:7248`); per-cent 2 dp, absolute rounded | — | — |
| per-month box (Custom only) | `:7285–7295` | **a SHARE %** into `customDist[i]` | the computed volume in the previous column | `min 0 max 100` attrs; `onChange` clamps **≥ 0 only** | `customDist` `:2472` (default `[34,33,33]`) |
| sum warning | `:7306–7310` | — | "Percentages sum to X% — they will be normalised to 100% on add." | **warn, not block**: `\|sum − 100\| < 0.5`; `spreadShape` divides by the total (`:854`) | — |
| held tail line (`volume-hold-tail`) | `:7299–7305` | — | "then held at {p0} through {p1}" | — | — |
| length sync | `:2475–2483` | — | — | resizes `customDist` to `spreadMonths`, keeps existing shares, fills new slots with `floor(100/n)` | — |

**No non-decreasing check. No typed-value entry.** Under Hold ON the same shares
are *cumulated* to the target by `spreadShape`'s hold arm (`:869–878`); under
Hold OFF they are divided by their total (`:862–866`). One editor, two meanings,
chosen by the Hold box — exactly the coupling REQ-D6-05 supersedes.

### 1.2 The amount control

| part | file:line | today |
|---|---|---|
| label | `:6606–6609` | `isPercentageDraft ? \`Change to ${scenario}\` : t('whatif_subscriber_volume')` → "Subscriber Volume (+/−)" |
| Subs / % pair | `:6618–6638` | two buttons through `applyAmountControl`; lit by class; keys `whatif_amount_unit_subs` / `_pct` |
| Churn arm | `:6639–6650` | `volume-mode-churn`, Outflow only |
| caption | — | **none** on the Volume card |
| **what changes with Hold** | `:7190–7194` | **nothing on the amount control.** Only the help line `whatif_hold_after_ramp_help` appears below the checkboxes: "The amount you enter is the TARGET…" — confirms 2059 §3 |

**A known exemption, not a new gap:** the percentage label
`` `Change to ${String(newEvent.scenario ?? 'Inflow')}` `` (`:6607`) is English
in a template literal, rendered in all six locales — and it is **on the i18n
scan's allowlist** (`scripts/scan-i18n.ts:467`, `"WhatIfTab.tsx::Change to {}"`),
so it was exempted deliberately rather than missed. It matters here only because
decision 6 rewrites this label: the build should retire the allowlist entry
with it rather than carry an exemption for a string that no longer exists.

### 1.3 The Hold checkbox

Rendered at `:7182–7188` **beside the spread switch, in the same flex row, and
outside the panel** — deliberately, so spread OFF + Hold ON is expressible.

**Spread OFF + Hold ON (clause 4's "ramp length 1 + hold")**, traced through the
add path: `(!spreadEnabled && !holdAfterRamp) || ARPU` is the only route to the
single-row `addMarketEvent` (`:4378`); otherwise `rampMonths = spreadEnabled ?
spreadMonths : 1` (`:4389`) and `pcts = [100]` (`:4390`), so `spreadShape` emits
one ramp row at fraction 1 plus the held tail to the horizon.

**What the user sees in that state:** the help line and nothing else. The panel
is gated on `spreadEnabled`, and the held-tail preview line lives **inside** the
panel (`:7299`), so a 24-row campaign is built with **no preview of its rows** —
only the Add button's count (`:7383+`) says how many.

## 3. Inventory — Promotion card (`src/components/WhatIfTab.tsx`)

### 1.1 The spread section

| control | file:line | edits | displays beside it | validation | state |
|---|---|---|---|---|---|
| Spread switch (`promo-spread-toggle`) | `:8866–8871` | on/off | label `whatif_ramp_volume_over_multiple_months` **"Ramp volume over multiple months"** | **always rendered** — no percentage gate | `promoSpreadEnabled` `:2781` |
| panel gate | `:8891` | — | — | `promoSpreadEnabled` only | — |
| Duration | `:8896–8904` | months | label `whatif_ramp_duration_months` "Ramp duration (months)" | `min 2 max 24`, round + clamp | `promoSpreadMonths` `:2789` |
| Even / Custom % | `:8910`, `:8916` | distribution type | same keys as Volume | — | `promoSpreadDistType` `:2790` |
| per-month row | `:8953–8980` | — | Month · computed `+vol` from `promoShape` | — | — |
| per-month box (Custom only) | `:8966–8977` | **a SHARE %** into `promoCustomDist[i]` | computed volume | `min 0 max 100`; `onChange` clamps ≥ 0 | `promoCustomDist` `:2791` |
| sum warning | `:~9000` | — | same warn-and-normalise text | warn, not block | — |
| held tail line (`promo-hold-tail`) | `:~8990` | — | held figure, last month, **and a month count** (`whatif_hold_tail_months`) | — | — |
| shape | `:3989–3999` | — | — | `promoShape` memo: `months: enabled ? months : 1`, `dist: [100]` when off | — |
| length sync | `:2792–2800` | — | — | identical to Volume's | — |

**Two differences from the Volume card that a build must not flatten silently:**

1. **The word is already "Ramp"** for what is the same share-split machinery.
   Under REQ-D6-05 that label is wrong in Spread mode.
2. **The switch is not gated on percentage.** The Promotion card lets an unheld
   percentage campaign be spread; the Volume card hides the switch. That is how
   D5-05 case (2) built its unheld +10% campaign. Clause 7's gating was only ever
   implemented on the Volume card.

### 1.2 The amount control

| part | file:line | today |
|---|---|---|
| label | `:8799–8803` | percentage → `whatif_promo_volume_pct_label` "Volume change (% of the forecast)"; absolute → `whatif_acquisition_volume` / `whatif_retained_volume` by target |
| input `promo-volume-amount` | `:8806–8812` | `min 0`, step 0.1 for % |
| Subs / % pair | `:8816–8836` | `promo-amount-subs` / `promo-amount-pct`; **switching resets the amount to 0** |
| caption | `:8840–8843` | `promo-volume-pct-help` when percentage |
| **what changes with Hold** | `:8886–8890` | **nothing on the amount control**; the same help line only |

### 1.3 The Hold checkbox

`promo-hold-toggle` at `:8878–8884`, beside the switch, outside the panel.
Spread OFF + Hold ON: `promoShape` builds `months 1` + tail. **Same blind spot as
Volume**: the tail line is inside the `promoSpreadEnabled` panel, so no preview.

## 4. Inventory — Churn (`src/components/WhatIfTab.tsx`, `src/utils/churnFold.ts`)

### 1.1 The ramp section

| control | file:line | edits | displays beside it | validation | state |
|---|---|---|---|---|---|
| Target (`churn-target`) | `:6745–6756` | points | label `whatif_churn_target` "Reduce by (points)" | `min 0` attr; **`onChange` overwrites `churnStated` with a fresh linear ramp** | `churnTargetPct` `:3769` (default 1) |
| Months (`churn-months`) | `:6763–6773` | months | label `whatif_churn_months` "Over (months)" | `min 1 max 24`, floor + clamp; **dimmed and non-interactive unless ramping**; also overwrites `churnStated` | `churnMonths` `:3770` |
| Ramp switch (`churn-ramp-toggle`) | `:6786–6794` | on/off | `whatif_churn_ramp` "Ramp the reduction over multiple months" | resets `churnStated` to `linear(target, on ? months : 1)` | `churnRampOn` `:3773` |
| per-month box (`churn-stated-${i}`) | `:6839–6856` | **a TYPED CUMULATIVE value, in points** | `churn-derived-${i}`: target rate · subscribers retained, from the fold | `min 0`; `onChange` clamps **≥ 0 only**; **no renormalisation, no sum, no non-decreasing check** | `churnStated` `:3788` (`linearChurnRamp(1,3)`) |
| prefill | `churnFold.ts:172–176` | — | — | `linearChurnRamp(t, n)` = `t·(i+1)/n` | — |
| block reason | `:4135–4148` | — | rendered beside Add | month, forecast, series, absence, all-zero target — **nothing about shape** | — |

**This is REQ-D6-05 decision 3's model already** — typed values, Even as the
prefill — with two properties the Ramp build must decide whether to copy:
editing the target or the months **silently discards hand-edited per-month
values**, and **nothing enforces "each month ≤ the next"**.

### 1.2 / 1.3 Amount and Hold

The churn card has no Subs/% pair; its amount *is* the target box. `churn-hold-
toggle` at `:6806–6813`, beside the ramp switch, outside the grid; help line
`churn-hold-tail` (`:6815–6819`) — the **same key** as the other two cards.
Ramp OFF + Hold ON: `churnStatedWithHold` (`:4090–4097`) takes `[churnTargetPct]`
as the ramp and repeats the reached figure to the horizon.


## 5. The dilution arm (1.4)

**No spread, ramp or per-month control exists on it.** The arm renders a mode
button (`promo-pricing-mode-dilution`, `:9303–9312`), then two inputs —
`promo-dilution-current` and `promo-dilution-target` (`promo-dilution-inputs`,
`:9328–9360`) — and one effect line (`promo-dilution-effect`, `:9361`). Nothing
on it knows about months.

**The build site — applied once.** `buildPromoEvents`, `WhatIfTab.tsx:642–651`:

```ts
const isDilution = p.pricingMode === 'dilution';
const dilutionPct = isDilution
  ? dilutionAmountPct(p.pricingDilutionCurrentPct, p.pricingDilutionTargetPct)
  : null;
if (p.pricingEnabled && isDilution && dilutionPct === null) return [];
const pricingAmount = isDilution ? (dilutionPct as number) : p.pricingAmount;
const applyPricing = (arpu: number) =>
  p.pricingMode === 'absolute' ? arpu + pricingAmount : arpu * (1 + pricingAmount / 100);
```

The rate is converted **once, before the shape is walked**, closed into
`applyPricing`, and then applied **identically to every emitted row** at
`:706` (`const finalArpu = p.pricingEnabled ? applyPricing(baseArpu) : baseArpu`).
The same current/target pair is stamped on every row (`:765–766`). **The engine
never reads the price fields back**: outside the card's state, render and build
calls, `promoPricingAmount` / `promoPricingMode` appear only as types, the
export/import mapping and the events-summary text (`forecasting.ts:192–271, 383,
952–956, 1455`). The price effect of a promotion lives **only in each row's
stored ARPU**.

**What a dilution ramp would cost — costed, not designed.** The arithmetic is
the cheap part: rows are already built one at a time inside `shape.map`, so a
per-row fraction could scale the dilution effect with no engine change, because
the engine only ever sees each row's ARPU. The expensive parts are everywhere
else. **Persistence**: every row stores the *campaign's* current/target pair, and
restore reads it off `first`; a ramp needs a per-row stated figure or a stated
ramp, which is a carrier change on Market_Events and a round-trip through
`marketEventExportRow` / the reader. **Restore**: a plateau read over dilution
figures, the same shape of problem as `holdPlateauStart` but on a second series
per campaign. **Definition**: `dilutionAmountPct` is not linear — 25 % → 20 % is
0.80 / 0.75, not +5 % — so "ramp the dilution" must choose between linear in the
stated rate and linear in the resulting ARPU, and they disagree month by month.
**Parity**: the Pricing card's own dilution events call the same function and do
not ramp; a promo arm that ramps would make the two cards' dilution mean
different things for the first time since `90e2162` made them one arithmetic.
**Display**: the effect line shows one figure. **Verdict:** small in the engine,
large across persistence, restore, definition and cross-card parity — decision 4
is right to hold it open.

## 6. Restore, per card

| card | handler | 1-row campaign | held | unheld |
|---|---|---|---|---|
| Volume | `handleEditCampaignStart` `:4658` | `rows.length === 1` → **single-row edit** (`handleEditStart`), never the group restore | `isHeld = rows.some(hold)` `:4783`; target = **last row**; `rampLen = holdPlateauStart` `:4787`; cumulative % **differenced back to shares** | **the summing path**: `volByOffset[off] += \|vol\|` `:4759`, `totalSub` → amount (`:4871`); shares = `round(vol/total·100)` `:4854`, residual to month 1 |
| Promotion | `handleEditPromoCampaignStart` `:5328` | → `handleEditPromoStart` | `:5364`, `:5367`; `subscriberVolume: isHeld ? heldTarget : totalSub` `:5390` | summing `:5349–5350`; shares `:5379` |
| Churn | inside `handleEditCampaignStart`, `churnMode === 'churn'` `:4688` | via the same single-row gate | trajectory = each row's `churnTargetPct`; `heldChurn` `:4727`; ramp = `trajectory.slice(0, holdPlateauStart(…))` `:4729` | whole trajectory restored as the ramp |

**What a Spread-vs-Ramp restore needs to distinguish from rows alone:**

- **A held campaign is unambiguous**: decision 2 puts Hold only in Ramp mode, so
  `Hold = Yes` on every row ⇒ Ramp, and the plateau path already reads it.
- **An UNHELD Ramp and a Spread can emit byte-identical rows.** Ramp 1,000 /
  2,000 / 3,000 with no hold, and a Spread of total 6,000 at Custom
  16.67 / 33.33 / 50, both store `[1000, 2000, 3000]`. A flat Ramp at 2,000 and an
  Even Spread of 6,000 both store `[2000, 2000, 2000]`. "Non-decreasing" is
  necessary for a Ramp and not sufficient to identify one. **Rows alone cannot
  decide it.**
- **A 1-month campaign** is identical under both modes, and never reaches the
  group restore anyway.
- **The two readings disagree about the amount box**: Spread reopens showing the
  SUM (6,000), Ramp the LAST ROW (3,000). Either re-saves the same rows, so the
  ambiguity is invisible in the data and visible on the screen.

## 7. Decision 5 — typed per-month values on a spread

**Neither card has it.** Both spread editors' per-month boxes edit a **share %**
and nothing else — `customDist[i]` (`:7285–7295`) and `promoCustomDist[i]`
(`:8966–8977`), `min 0 max 100`, beside a *computed* volume that is displayed,
not editable. A sweep of `WhatIfTab.tsx` and the `en` locale for any typed-
absolute distribution mode (`custom_abs`, `absDist`, a `'values'` dist type, a
per-month value key) returns **nothing**. Distribution is `'even' | 'custom'`
on both cards (`:2471`, `:2790`).

**So decision 5 names a capability neither card has.** "Matching the Volume
card" cannot mean copying an existing Volume behaviour. The only typed-value
per-month editor in the app is **churn's**, and it types cumulative *points* for
a *ramp* — which is decision 3's Ramp model, not a Spread one. Stated as a
question in the design note rather than resolved here.

## 8. Specs that will go red

Pass counts from the 69/69 suite run on `17b52d5` this morning; `src/` is
unchanged since, so they stand.

| spec | passes | what it pins that REQ-D6-05 changes |
|---|---|---|
| `spec:hold-mounted` | 31 | Volume spread + hold drive; percentage spread gated on hold (clause 7) |
| `spec:promo-hold-mounted` | 52 | Promotion ramp/hold drive, emitted rows, preview grid, tail line, reopen |
| `spec:churn-hold-mounted` | 42 | churn ramp + hold |
| `spec:d5-05-held` | 39 | held-percentage restore through both pills; unheld case built on the Promotion card's ungated switch |
| `spec:hold-shape` | 60 | `spreadShape` contract, `holdPlateauStart`, the Hold column, **clause 10's six checkboxes** |
| `spec:amount-control` | 91 | churn ramp wiring, opt-in default OFF |
| `spec:mix-card` | 237 | churn arm and ramp checkbox drives |
| `spec:view-apply-mounted` | 208 | promo row/campaign edit paths |
| `spec:event-roundtrip` | 117 | row export/import, pricing fields |
| `spec:cards` | 36 | card-level shapes |
| `spec:churn-fold` | 56 | `linearChurnRamp`, fold |

**Which checks go red cannot be counted before the build** — it depends on the
mode control's shape. What is certain: every spec that drives Hold without first
selecting Ramp mode, every assertion that a percentage spread is hidden with Hold
OFF, and clause 10's **exactly six** checkbox count if Hold stops being a
checkbox beside the switch. guard-traps 205–223 anchor on several of these sites.

## 9. Suite

**`npm run suite`: 69/69 green.** The only gate this session, per the brief: a
docs/inventory session, so no guard-traps run. It ran after Item 0 was committed
(`f664299`), on a `src/` and `scripts/` tree unchanged since `1c72489` —
`git diff 1c72489 HEAD --stat -- src scripts` is empty. Capture:
`scratchpad/suite-d605.out`.

**What the suite certifies here is narrow, and that is correct.** No code
changed, so a green suite says the recorded decisions and the new design note did
not disturb anything a spec reads — `EXPECTED.md` is prose, not an input to any
spec. It does not, and cannot, say anything about REQ-D6-05's behaviour, which
does not exist yet.

## Limits

- **Read-only inventory.** Every file:line is from `src/` at `17b52d5`, which no
  commit in this session touched. Line numbers will move with the build.
- **Nothing was driven.** No mounted script was written or run beyond the suite;
  the tables are read from source, not observed on screen. "What the user sees"
  statements (e.g. no preview for spread OFF + Hold ON) are read from the render
  gates, not from a screenshot.
- **Spec pass counts are from this morning's suite captures** on the same `src/`
  tree, re-confirmed by this session's own suite run (section 9). Which checks go
  red under the build cannot be counted before the mode control exists.
- **The dilution ramp is costed, not designed**, and the cost is in engineering
  terms only; whether a ramped dilution is commercially meaningful is Jon's.
- **The design note proposes key names and state names.** They are placeholders
  for the build brief to accept or rename, not decisions.
- **No guard-traps run**, per the brief: this is a docs/inventory session and no
  trap target changed.

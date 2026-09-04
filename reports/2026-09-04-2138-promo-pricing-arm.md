# The promotion pricing arm: Dilution and duration (decision 3)

__ADVISOR__

## Base check

`git diff --stat 945d648..HEAD -- src/ scripts/ test-data/ package.json` EMPTY.
HEAD at entry was `4f6aa3c`, the 2003 report commit. The STOP did not fire.

## The governing entries, by heading

- `#### CARD PARITY — SEVEN DECISIONS (Jon, 2026-09-03; recorded here 2026-09-03)`
  — 3 *"Dilution on the promo pricing arm: BUILD."*; 4 *"Target NOT ported —
  option (i)."*; 5 *"Applies-to NOT ported — option (i). A promotion's pricing
  arm reaches only the population the promotion itself defines."*
- `#### R5 DECISIONS (Jon, 2026-08-14) — retention dilution on the Pricing card`
  — 1 revenue-only, both figures user-stated; 2 option 1 on compounding; 3
  *"THE MODE AND BOTH FIGURES ARE PERSISTED. Not just the derived amount."*
- `#### R5 WALK DECISIONS (Jon, 2026-08-17) — the Pricing card's display and gating`
  — 2 *"THE ADD GATING FIX IS FEEDBACK, NOT ENABLEMENT."*

Decision 3's build status is recorded in `EXPECTED.md` **before any code**, in
commit `ea72867`, together with the duration finding below.

## Item 1 — the measurement

### (a) The Pricing card's Dilution arm

| thing | where | value |
|---|---|---|
| the arithmetic | `forecasting.ts:403` `retainedRevenueRatio` | `(1 − target/100) / (1 − current/100)` |
| as a percentage | `forecasting.ts:435` `dilutionAmountPct` | `(ratio − 1) × 100` |
| the mode field | `PricingEvent.pricingMode` | the literal `'dilution'` |
| the stated pair | `dilutionCurrentPct`, `dilutionTargetPct` | persisted, R5 decision 3 |
| what it emits | `WhatIfTab:3277-3300` | an ordinary retention-scoped **percentage** event: `inputMode: 'percentage'`, `cohortScope: 'retention'`, `amount: dilutionAmountPct(...)` |

**It was already extracted**, so the brief's "if the Pricing card's is inline,
extract it first" did not apply. The function's own comment states the intent:
*"the arithmetic lives in ONE exported function that the card, the event builder
and the spec all read."*

### (b) The duration control

| thing | where |
|---|---|
| the field | `types/forecast.ts:371-372`, `duration: 'one-off' \| 'recurring'` |
| what Recurring does | `WhatIfTab:1606` — `pe.month <= m.month`, so it applies in its month **and every month after**, once per month against that month's running `pricingARPU` |
| the per-scenario pass | `WhatIfTab:1714` — the same rule, expressed as an exclusion |
| display only | `:6873-6874`, the row badge |
| export / import | `Duration` column (`forecasting.ts:1013`); reader defaults `'one-off'` (`:1055`) |

**Exactly 2 behavioural read sites**, 4 counting the two display sites.

### (c) What `buildPromoEvents` emits into the pricing pipeline: NOTHING

This is the finding that governs Item 3.

**A promotion's price change is baked into the event's own `arpu` at build
time** — `applyPricing(baseArpu)` inside `buildPromoEvents` — and the promotion
is a `MarketEvent`. It never becomes a `PricingEvent` and never enters the
pricing pass.

`promoPricingMode` and `promoPricingAmount` are a **record of what was applied**.
Their consumers, counted:

| consumer | count | kind |
|---|---|---|
| edit-restore (single + campaign) | 2 | read back into the draft |
| the card's own control | 1 | the control's state |
| `promoEventSummary` (`forecasting.ts:791-795`) | 1 | a display string |
| export row / importer | 2 | persistence |
| **engine** | **0** | — |

The price reaches the forecast **only** through the baked `arpu`, which the
event pools read (`WhatIfTab:1362-1363`, the `promoRebanded` pool at `:1421`,
and `scenarioPools`).

## Item 2 — Dilution on the promotion pricing arm

**Built, riding the percentage arm** — the Pricing card's own doctrine, quoted
at its save path: *"A dilution event IS a retention-scoped PERCENTAGE event. It
rides the existing mechanism entirely — the apply loop is not touched, and must
not be: if this needed a new arm in the pricing pass, the wiring would be
wrong."* The same reasoning holds one layer up.

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

**One function, and the caller count is pinned by the spec at both ends.**
`dilutionAmountPct` now has **8 call sites in `src/`** — 6 in `WhatIfTab.tsx`
(3 Pricing card, 3 promotion) and 2 in `forecasting.ts` (its own definition
plus the Pricing card's block predicate). `retainedRevenueRatio` keeps its
single caller: `dilutionAmountPct` itself.

**The equality is by construction and pinned anyway**, to 1e-9, in three forms:

| claim | figure |
|---|---|
| the Pricing card's figure for 25 → 20 | **+6.666666666666671%** |
| the promotion's `promoPricingAmount` | identical to 1e-9 |
| the applied rate | `20 × 0.80/0.75 = 21.3333` |
| a hand-converted **percentage** arm at the same figure | identical `arpu` and `revenue` to 1e-9 |

The third is the strongest: if the dilution arm ever stops riding the percentage
arm, the two diverge and the check says so.

**Null is not zero.** An incomplete or out-of-range pair builds **no event** —
the same rule the unknown mix blend already follows two lines below. A promotion
priced at +0% would state a change the user never made.

**Decisions 4/5 honoured by construction**: no Target and no Applies-to control
was added. The arm prices the promotion's own cohort, which is the population the
promotion defines.

**Zero new locale keys.** All six reused from the Pricing card and verified
present in all six locales: `whatif_pricing_mode_dilution`,
`whatif_dilution_current`, `whatif_dilution_target`, `whatif_dilution_awaiting`,
`whatif_dilution_effect`, `whatif_dilution_volume_note`. Two cards that mean the
same thing say it in the same words; a new key here would be the copy drifting.

**Testids by card**: `promo-pricing-mode-pct`, `promo-pricing-mode-abs`,
`promo-pricing-mode-dilution`, `promo-pricing-amount`, `promo-dilution-inputs`,
`promo-dilution-current`, `promo-dilution-target`, `promo-dilution-effect` —
none colliding with the Pricing card's `pricing-*` set.

### The Pricing card's spec caught my first attempt, and I did not edit it

My first gate reused `pricingDraftBlockReason`, which took its caller count in
`WhatIfTab` from 2 to 3:

```
pricing-roundtrip spec: 135 passed, 1 failed
  FAIL  gating: the button and the handler read the SAME predicate
        [3 call sites, expected 2 (button memo + handler)]
```

That file records a precedent for re-aiming such a count when a real caller
lands. **The brief said no check edited, so the promotion got its own gate
instead** — and that is the better answer on its merits, not just the compliant
one: `pricingDraftBlockReason`'s first term is `if (!draft.month)` returning a
**Pricing-card** key, and a promotion's month is `newPromo.date`, gated
separately. I had been feeding it `newPromo.date` to stop it answering a
question its caller already owns, which is the shape of a wrong reuse. Its count
is also a claim about the Pricing card specifically; a third caller from another
card would weaken that claim while looking like sharing.

The **arithmetic** is still shared, which is what decision 3 requires: the range
test *is* `dilutionAmountPct` returning null.

`spec:pricing-roundtrip` **136/136**, and `git diff` on that file is **empty**.

## Item 3 — duration: NOT BUILT, and the reason is structural

**A One-Off / Recurring control on the promotion's pricing arm has nothing to
attach to.** From Item 1(c): the promotion's price is baked into one event's
`arpu`, `promoPricingMode`/`promoPricingAmount` have **zero engine consumers**,
and the promotion never enters the pricing pass — which is the only place
`duration` is read.

Building the field would ship a stored mode **nothing reads**, and the card
would claim a behaviour the engine does not have. That is the `yieldArpuMode`
failure R5 decision 3 exists to prevent, in its other direction: there an
unstored mode misrepresented the event, here a stored one would.

The carrier says so itself, at `forecasting.ts:904`:

> *"MarketEvent has no duration or roll-forward concept — one row is one month."*

**The promotion already has a multi-month mechanism, and it is a different
one**: the **spread**, which emits one row per month. `1012` Item 3 noted the
contrast at `WhatIfTab:2588` — *"a row here (rollForward / duration:'recurring')
rather than several"*. Making Recurring mean something on a promotion means
deciding whether a promotion's price change becomes a real `PricingEvent`, which
is a product decision and not this session's to take.

**Recorded in EXPECTED.md for Jon**, beside decision 3. Nothing was half-built:
no column, no field, no control.

The Value card's `rollForward` boolean was **not** unified, per the brief.

## Item 4 — specs and traps

`spec:view-apply-mounted` **84 → 97**; `spec:event-roundtrip` **106 → 117**.

### The mounted case

```
promo dilution  leaf inflow -0.56
```

By hand: the pool holds 1000 at `20 × 0.80/0.75 = 21.3333` against a natural
inflow of 200 at the fitted 22 —
`(200×22 + 1000×21.3333)/1200 − 22 = −0.5556`.

**The existing arms are asserted unchanged to the penny**, because
`applyPricing` was rewritten and they are exactly what that could break:
percentage `20 × 1.10 = 22`, absolute `20 + 2.50 = 22.50`, arm off `20` with
both promo pricing fields absent, and a non-dilution arm carrying no stated
figures.

### Trap (a) — the arm re-implements Dilution inline. RED

```
view-apply-mounted spec: 91/97 passed
  FAIL  promo dilution: the promotion carries the SAME figure, to 1e-9
        [5 vs the Pricing card 6.666666666666665]
  FAIL  promo dilution: the applied ARPU is base x the retained-revenue ratio
        [21 - 21 would be the +5% a hand subtraction gives]
  FAIL  promo dilution: identical to a hand-converted PERCENTAGE arm, to 1e-9
        [21 vs 21.333333333333332]
  FAIL  promo dilution: an INCOMPLETE pair builds no event
  FAIL  promo dilution: an OUT-OF-RANGE pair builds no event
  FAIL  promo dilution: the MOUNTED inflow ARPU is the ratio-priced pool
        [inflow -0.83 vs hand -0.5556]
```

Registered as **trap 153**. Six checks fire, and the two `builds no event`
failures are the useful surprise: a subtraction does not merely give the wrong
rate, it also stops returning `null` for nonsense input, so incomplete forms
start producing events.

**A comment of mine was wrong and is corrected in place.** I wrote that a
subtraction would render `−0.67`; the measured value is **−0.83**
(`(200×22 + 1000×21)/1200 − 22`). The spec now carries the measured figure and
says it was measured rather than predicted.

### Trap (b) — the stated figures dropped at export. RED

```
event-roundtrip spec: 111 passed, 6 failed
  FAIL DILUTION: both stated figures reach the sheet  [["",""]]
  FAIL DILUTION/session: both stated figures survive  [[null,null]]
  FAIL DILUTION/session: the reloaded pair still converts to the stored amount
       [null vs 6.666666666666671]
  FAIL DILUTION/workbook: both stated figures survive  [[null,null]]
  FAIL DILUTION/workbook: the reloaded pair still converts to the stored amount
       [null vs 6.666666666666671]
  FAIL DILUTION: a stated ZERO survives as 0, not as absent  [[null,null]]
```

Registered as **trap 154**. This is the brief's trap (b) re-aimed at what was
actually built: there is no Recurring to drop, so it guards the two fields that
replaced it.

### The columns

`Promo_Dilution_Current_Pct` and `Promo_Dilution_Target_Pct`, **appended** after
`Promo_Pricing_Amount` — never inserted, the rule `Promo_Mix_Locked` already
follows: a reader keys by name, but a human diffing two exports reads column
order. `''` is the absence carrier; `readOptionalNumber` keeps a stated **0%**
distinct from absence, and a pre-decision-3 workbook loads as the plain arm it
was.

### Counts

Traps **148 → 150** (153, 154). `spec:trap-anchors` **161/161 (150 traps, 157
anchors)**, every anchor unique. TARGETS unchanged — both traps land in files
already registered (`WhatIfTab.tsx`, `forecasting.ts`).

## Gate

```
guard-traps: 150/150 caught, no MISSED, no INCONCLUSIVE, no CRASHED
full suite:  58/58 spec scripts green
anchors:     161/161 (150 traps, 157 anchors)
tsc:         clean
build:       clean
```

Run **serially**, guard-traps first and alone - it mutates tracked source. Its
output went to a FILE, not through `tail`, so all 150 per-trap lines are
present and the two new ones are quoted above from that file rather than
inferred from the exit code.

## Limits of this check

- **THE PROMOTION'S DILUTION GATING IS UNASSERTED.** `promoDilutionBlockReason`
  is reached by no spec: the builder's `return []` is covered, but nothing
  checks that the button disables or that the effect line names the reason. The
  arm's on-screen reason is the existing `whatif_dilution_awaiting` line, which
  renders in exactly the two blocked states — reasoned, not measured.
- **No mounted case drives the CONTROL.** The dilution promotion is built by
  calling `buildPromoEvents` directly; no test clicks
  `promo-pricing-mode-dilution` or types into `promo-dilution-current`. A defect
  in the wiring between the control and the builder would not be caught here.
- **Compounding is not exercised on this card.** R5 decision 2 says a dilution
  `PricingEvent` compounds multiplicatively with other pricing events. A
  promotion's arm is applied **once, at build time**, so it cannot compound —
  which is a real behavioural difference between the two cards that no copy on
  the promotion card states.
- **The dilution arm is not driven on a RETENTION promotion**, only Inflow. R5's
  dilution is revenue-only and retention-scoped on the Pricing card; on a
  promotion the arm prices whatever cohort the promotion names, and only the
  Inflow case is measured.
- **No walk, no real workbook.** Constructed fixtures throughout.
- **Duration is unbuilt, not deferred silently** — see Item 3. Anyone reading
  the card will find no One-Off / Recurring control on the promotion's pricing
  arm, and the reason is in EXPECTED.md rather than only here.

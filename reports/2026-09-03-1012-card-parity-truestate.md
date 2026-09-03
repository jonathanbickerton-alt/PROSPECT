# Promotion ↔ Volume / Value / Pricing card parity — true-state (READ-ONLY)

## FOR ADVISOR

```
Generated: 2026-09-03 10:12 +0100 (UTC 2026-09-03 09:12)
Verified against: HEAD 3a1d02f, branch main, tree CLEAN — NO source changed.
Repo: committed 3a1d02f, pushed (origin in sync)
Last gated commit: 2b818ee. No gate run — read-only session.
ITEM 0 — THE REASON EXISTS: EXPECTED.md:4609, dated 2026-08-02, and the entry
  exists to say the ORIGINAL reason was wrong: "interaction complexity ... was
  the wrong reason, and the user has said so. The blocker is structural."
  Eager vs deferred resolution. Also :4532, :7711. Nothing in docs/, reports/.
ITEM 0 CONSTRAINT, NARROWER THAN THE ENTRY IMPLIES: promoMix and the band ARPU
  overrides are magnitude-INDEPENDENT (shares, rates) — no change needed. Only
  the DERIVED scalars block it: revenue/arpu :546-547, pool size :1327.
  Rebanded-Retention basis is undefined today — product question.
COUNTS: sliders 2 (both raw <input>, NO component exists — so the padlock is
  BOLTED ON by the Promotion card); amount-mode controls 3, none shared, two
  sharing a name with different domains; duration controls 2 (Pricing enum,
  Value boolean — source itself says they mean the same thing).
NOT TWO ENGINES: autoBalanceMix is a 9-line adapter onto the SAME rebalance
  with locks=[]. Duplication is rendering and state, not arithmetic.
GAPS: padlock (a), 1 call site; ARPU target (a), 0 engine changes; promo %
  (c), 1 site (:1327 -> resolvedEventVolume) and NO new field; Dilution /
  duration / target / applies-to (c) are missing FIELDS, not controls; lock
  persistence (c), 2 sites + a column.
UNASKED FINDING: :1313-1319 hand-rolls the scope predicate with `!vprodL1` —
  the D2-03 defect, LIVE, an 8th site invisible to the exactly-7 pin.
7 PRODUCT QUESTIONS listed, none answered. Inspection only — not reproduced.
```

## Base check

HEAD `a0377f3` (this session's skeleton) on `main`, tree clean.
`git diff --stat 2b818ee..HEAD -- src/ scripts/ test-data/ package.json` EMPTY.
Drift is the two report files. The STOP did not fire.

**No source was changed in this session.** Last gated commit: `2b818ee`.

## Item 0 — the "percentage on Custom Promotion" rejection

### The reason EXISTS, in three places, and it is not the one you are looking for

The brief says no reason is recorded anywhere Jon can find. **A reason is
recorded, dated, and detailed** — `test-data/EXPECTED.md:4609`. The reason it
cannot be found under the description in the standing instructions is that
**the entry exists to say the original reason was wrong.** Verbatim:

> ### Percentage on the Promotion card — declined, and the reason is the
> ### resolution model, not the interaction count — 2026-08-02
>
> The original exclusion cited interaction complexity: an optional mix arm plus
> an optional pricing arm plus a percentage volume basis multiplies the cases.
> That was the wrong reason, and the user has said so. The blocker is structural.
>
> **Percentage events defer resolution.** The actual delta is computed per view,
> per month, inside `applyEventsToMonth`, and everything upstream is deliberately
> left unresolved — which is why percentage rows dash ARPU and revenue.
>
> **`buildPromoEvents` resolves eagerly.** It bakes a concrete volume, ARPU and
> revenue once at creation. Three downstream mechanisms depend on that being a
> real, scale-bound number: the Inflow pool's `revenue ÷ volume` ARPU derivation,
> the `promoRebanded` Retention pool, and campaign-edit spread reconstruction.
>
> A percentage anchor cannot supply what eager resolution needs. That is not a
> form problem and no amount of form design fixes it.

It also records the order of work, verbatim:

> **Order, if it is ever taken up:**
>
> 1. Settle the pool question. *(Done 2026-08-02, above — it was a real defect.)*
> 2. Teach the pool code to consume `applyEventsToMonth`'s derivations in BOTH
>    paths, verified byte-identical for absolute cases first. *(Done for the
>    Inflow pool; `promoRebanded` still reads `e.subscriberVolume` directly.)*
> 3. Then the form — and only then, with the volume % and the price % visually
>    and lexically separated well beyond a shared "%" glyph.

Two supporting entries carry it forward. `EXPECTED.md:4532`:

> `WhatIfTab`'s **`promoRebanded` pool** still sizes from `e.subscriberVolume *
> eventShare(e)` with no `amountType` guard.
>
> It cannot be hit today: [...] `buildPromoEvents` never sets `amountType` —
> percentage is a Volume-tab capability by rule. [...]
>
> Left as-is deliberately rather than defensively patched, so that it fails
> loudly if percentage-on-promo is ever attempted without doing the engine work
> first. **It is step 2 of the order recorded in the promo-card entry below,**
> and a silent guard here would remove exactly the signal that order depends on.

And `EXPECTED.md:7711`, on a separate request that lands on the same boundary:

> `buildPromoEvents` resolves its volume **eagerly at creation**, while
> percentages resolve **per view at application time**. That mismatch is the
> recorded reason percentage events were declined on the Promotion card

**Nothing in `docs/` or `reports/` adds to this.** The user guide describes the
Promotion card's volume arm without mentioning percentages either way.

### The constraints a percentage amount would meet — read-only

#### Which population the basis would be

- **Inflow promotion.** The same basis a plain percentage Inflow event already
  uses: the view's fitted `inflow.mean` for that month, scaled by coverage. The
  machinery exists and is exercised (`forecastCoverage`, and `applyEventsToMonth`
  phase 2). Nothing new is needed for the basis itself.
- **Rebanded Retention promotion.** Ambiguous today, and this is the sharp
  constraint. `promoRebanded` is set when the target is Retention AND a mix or
  pricing arm is present (`WhatIfTab.tsx:522`). Such an event carves its own
  ARPU pool (`:1321-1329`) whose `size` is `e.subscriberVolume * eventShare(e)`
  and whose `arpu` is `e.arpu` — both baked at creation. A percentage would have
  to name whether it means a share of forecast **retention** for the month, or a
  share of the **base** eligible to be re-contracted. Those are different
  populations and the code currently commits to neither, because it never has to.

#### Where the pipeline consumes volume as a creation-time number

Eager, all in `buildPromoEvents` unless noted:

| site | what it bakes |
|---|---|
| `WhatIfTab.tsx:526` | `vol = Math.round(p.draft.subscriberVolume * fraction)` — the per-month magnitude, fixed at creation |
| `WhatIfTab.tsx:533-535` | `baseArpu` — via `resolveEventArpuRevenue(vol, …)`, so ARPU derivation consumes the concrete volume |
| `WhatIfTab.tsx:546` | `revenue: vol * finalArpu` |
| `WhatIfTab.tsx:547` | `arpu: finalArpu` |
| `WhatIfTab.tsx:1327` | the `promoRebanded` pool's `size: Math.max(0, e.subscriberVolume * eventShare(e))` — outside the builder, at application time, but still reading the stored scalar rather than a derivation |

Resolved per month, by contrast: `applyEventsToMonth`'s phase 2 derivations, and
`resolvedEventVolume` (`forecasting.ts:3973`), which returns the derivation's
delta for a percentage event and the stored absolute otherwise. That function is
the one-line seam EXPECTED.md refers to.

#### Can `Promo_Mix_JSON` and the band ARPU overrides ride a per-month magnitude?

**Yes — both are magnitude-independent, and this is the part that is NOT a
blocker.**

- `promoMix` is a share distribution over bands summing to `MIX_TOTAL`
  (`WhatIfTab.tsx:555`). It states proportions, not quantities, so it applies
  unchanged to a magnitude resolved later.
- `promoBandArpuOverride` is a map of per-band **rates** (`:565`). A rate does
  not scale with volume either.

What cannot ride a per-month magnitude without write-time derivation is the pair
of **derived scalars** `revenue` and `arpu` (`:546-547`), and the pool `size`
at `:1327`. So the constraint is narrower than "the promotion pipeline is
eager": the *stated* inputs are all fine, and it is the *derived* outputs, plus
one pool that reads a stored scalar instead of a derivation, that are not.

Stated as constraints only. No recommendation — Jon decides.

## Item 1 — the padlock as built

**Component: none.** The Promotion mix slider is a raw `<input type="range">`
inline in the card's JSX at `WhatIfTab.tsx:6834`. There is no slider component
in the codebase, so the padlock is **bolted on by the Promotion card**, not
built into a shared control. That answers the brief's shape question directly.

| aspect | as built |
|---|---|
| lock state | `promoMixLocked: string[]`, `WhatIfTab.tsx:1953` — component state |
| the only mutator | `handlePromoLockToggle`, `:2058-2061` — a pure add/remove on the array |
| what a locked slider holds | its exact current share; `rebalance` refuses to move it (`mixConstraint.ts:436`, `range-collapsed` / "is locked") |
| where redistribution goes | the unlocked members, in proportion to their current shares; an all-zero remainder splits evenly (`mixConstraint.ts:448-465`) |
| the 100% constraint | the moved member's ceiling is `MIX_TOTAL − lockedElsewhere` (`:439-441`); the residual goes to the last unlocked member that is not the one being dragged |
| all locked / all but one | the range collapses; `achievableTargetRange` reports `collapsed`, and the card disables the sliders via `immovable = held \|\| promoRangeCollapsed` (`:6828`) |
| **persistence** | **NONE.** `promoMixLocked` is never written to the event, never exported, never restored on edit — it does not appear in `buildPromoEvents`, in `marketEventExportRow`, or in any sheet column |

The card is careful about one distinction worth preserving in any port
(`WhatIfTab.tsx:6823-6827`, verbatim):

> // Immovable for one of TWO distinct reasons: the user
> // held it, or the constraints leave a single value. The
> // padlock only ever reflects the first — collapsing the
> // two would make the control claim the user held
> // something they did not.

**Locale keys and testids:** the padlock control carries neither a `data-testid`
nor a dedicated key that I could find; the mix refusal reasons are keyed
(seventeen of them, `mixConstraint.ts:73`). **Specs:** `spec:mix-constraint`
drives the engine; `spec:mix-card` drives the card (235 checks). The lock
semantics are therefore covered at the engine, and at the card only through the
Promotion arm.

## Item 2 — the ARPU-target auto-balance as built

| aspect | as built |
|---|---|
| the solver | `solveForTarget`, `mixConstraint.ts:516` |
| the range it works within | `achievableTargetRange`, `:336` — min/max blended ARPU given the locks |
| the constraint solved | move the unlocked shares so the blended ARPU hits the target, with shares summing to `MIX_TOTAL` and locked members untouched |
| interaction with locks | locks reduce `freeBudget`; with everything locked the range `collapsed`s and the solver validates rather than repairs (`:536-545`) |
| unreachable target | reported, never clamped. The card shows the outcome and `handlePromoApplyTarget` (`:2066`) returns early unless `kind === 'ok'` |

The card's own comment on that last point (`WhatIfTab.tsx:2062-2065`), verbatim:

> /** Applying a typed target rewrites the unlocked shares to hit it. Only ever
>  *  called from the ok arm — an unreachable target is SHOWN, never clamped to
>  *  the nearest reachable one, because silently moving a user's number to one
>  *  they did not type is the tool stating something on their behalf. */

**Same component question: there is no component.** The target box, the range
readout and the Apply control are all inline in the Promotion card.

## Item 3 — every slider and mode control

### Sliders

**Exactly two `<input type="range">` in the tab**, and neither is a component:

| # | card / arm | file:line | quantity | constraint | shared? |
|---|---|---|---|---|---|
| 1 | Promotion, value-mix arm | `WhatIfTab.tsx:6834` | band share, 0-100 step 0.1 | sums to 100, locks honoured | renders separately; **constraint engine shared** |
| 2 | Value (yield) card, mix | `WhatIfTab.tsx:7363` | band/tariff share, 0-100 step 0.1 | sums to 100, **no locks** | renders separately; **constraint engine shared** |

**The important correction to the obvious reading:** these are NOT two
implementations of the constraint. `handleSliderChange` (`:1854`) calls
`autoBalanceMix` (`:735`), which is a nine-line adapter that calls the SAME
`rebalance` with an empty lock list plus a member-seeding guard. Its own comment
says the guard exists because `rebalance` rightly refuses a member absent from
`prev`, which is right for the engine and wrong for a live slider.

So the duplication is in the **rendering and the state**, not the arithmetic.
That is the single most consequential fact for Item 5.

Three more sliders exist outside the four cards (`StandardForecastTab.tsx:927`,
`:948`, `:961`), plus `GenerateCohortForecastModal.tsx:112`, `:120` and
`ManageBulkDrawer.tsx:396`. Out of scope, listed so the count is not mistaken
for a whole-app figure.

### Amount-mode controls — three distinct, no sharing

| # | card / arm | field | domain |
|---|---|---|---|
| 1 | Volume card | `amountType` | `'absolute' \| 'percentage'` (+ churn mode on Outflow) |
| 2 | Promotion, pricing arm | `promoPricingMode` (`:1959`) | `'percentage' \| 'absolute'` |
| 3 | Pricing card | `pricingMode` (`:2836`) | `'plain' \| 'dilution'` |

**A naming collision worth flagging:** #2 and #3 are both called some form of
"pricing mode" and their domains do not overlap. `BuildPromoEventsParams`
declares `pricingMode: 'percentage' \| 'absolute'` (`:468`) while the Pricing
card's `newPricingEvent.pricingMode` is tested against `'dilution'` (`:2836`).
Two different questions under one name, in one file.

### Duration controls — two distinct, and the code says they are the same thing

| # | card | field | shape |
|---|---|---|---|
| 1 | Pricing card | `duration` | `'one-off' \| 'recurring'` (`:6058`) |
| 2 | Value (yield) card | `rollForward` | boolean (`:1186`, `:1356`) |

`WhatIfTab.tsx:7267` states the equivalence in source: a rolled-forward yield
event does *"exactly what Pricing's `duration:'recurring'` does"*. One enum, one
boolean, same semantics.

Separately, **two spread implementations** — Volume (`spreadEnabled`,
`spreadMonths`, `spreadDistType`, `customDist`; `:1729-1731`) and Promotion
(`promoSpreadEnabled`, `promoSpreadMonths`, `promoSpreadDistType`; `:1931-1933`).
Separate state of identical shape; only the Promotion one flows through
`buildPromoEvents` (`:497-501`).

## Item 4 — the parity table

Cells are the capability's presence on that card/arm. Gap classes: **(a)** shared
component missing a prop, **(b)** separate implementation, **(c)** different data
model, **(d)** meaningless there.

| capability | Volume card | Promotion volume arm | Value card | Promotion value arm | Pricing card | Promotion pricing arm | gap class |
|---|---|---|---|---|---|---|---|
| absolute amount | yes | yes | n/a | n/a | yes | yes | — |
| percentage amount | **yes** | **absent** | n/a | n/a | yes | yes | **(c)** — the carrier has `amountType`, but `revenue`/`arpu` (`:546-547`) and the pool `size` (`:1327`) are derived at write time |
| churn mode (Outflow) | **yes** | **absent** | n/a | n/a | n/a | n/a | **(c)/(d)** — needs a product answer first; see questions |
| spread across months | yes | yes | n/a | n/a | no | no | (b) — two implementations of one shape |
| mix sliders | n/a | n/a | **yes** | **yes** | n/a | n/a | — |
| **padlock on mix sliders** | n/a | n/a | **absent** | **yes** | n/a | n/a | **(a)** — `rebalance` already takes `locked`; the Value path passes `[]` |
| **ARPU target + auto-balance** | n/a | n/a | **absent** | **yes** | n/a | n/a | **(a)** — `solveForTarget`/`achievableTargetRange` are card-agnostic |
| per-band ARPU override | n/a | n/a | yes (`draftTierArpuOverride`) | yes (`draftPromoBandArpu`) | n/a | n/a | (b) — two draft maps, same shape |
| Direct / Dilution | n/a | n/a | n/a | n/a | **yes** | **absent** | **(c)** — `promoPricingMode` has no `dilution` member |
| One-Off / Recurring | n/a | n/a | `rollForward` (boolean) | **absent** | **yes** | **absent** | **(c)** — promo pricing arm has no duration field at all |
| Target Cohorts / +Base / Base Only | n/a | n/a | n/a | n/a | **yes** | **absent** | **(c)** — no `target` field on the promo pricing arm |
| Applies-to Inflow / Retention / Both | n/a | n/a | n/a | n/a | **yes** | **absent** | **(c)/(d)** — a promotion already names its own target |
| Preview Impact | n/a | n/a | n/a | n/a | **yes** | **absent** | (b) |
| **lock state persisted** | n/a | n/a | n/a | **absent** | n/a | n/a | **(c)** — no field on the carrier, no sheet column |

### Turned up by the inventory, not named in the brief

**A surviving copy of the D2-03 defect.** The `promoRebanded` pool filter
(`WhatIfTab.tsx:1313-1319`) hand-rolls the seven dimension comparisons rather
than calling `eventScopeMatchesView`, and it carries the exact null-only test
that `0737ebf` deleted from the apply path:

```ts
(e.product   === 'All' || !vprodL1          || e.product   === vprodL1) &&
```

`cohortScope` supplies the STRING `'All'`, which is truthy, so at any view whose
product is `'All'` this clause is false and the pool is not carved. A Retention
promotion with a mix or pricing arm therefore loses its isolated re-banded ARPU
at exactly the aggregate views where D2-03 was walked. This is an **eighth**
site; `pricing-roundtrip-spec.ts` pins seven callers of the shared predicate,
and a site that never calls it is invisible to that pin.

**Not verified by execution** — this session changed nothing and ran no spec. It
is an inspection finding with a named mechanism, and it wants the mounted
treatment 2044 established before anyone acts on it.

## Item 5 — the smallest build per gap

Only (a) and (c) gaps, per the brief.

### Padlock on the Value card's mix sliders — gap (a), the cheapest real win

- **Component that gains it:** none — there is no component. The Value card's
  slider row (`WhatIfTab.tsx:7360-7378`) gains a padlock cell and a
  `disabled={immovable}`, mirroring `:6828-6841`.
- **Call sites changed: 1.** `handleSliderChange` (`:1854`) passes a lock array
  instead of `autoBalanceMix`'s hard-coded `[]`. The engine is unchanged.
- **New state: 1** — a `yieldMixLocked: string[]` beside the existing draft.
- **Carrier / sheet / column:** none, IF lock state stays draft-only, matching
  the Promotion arm today. If it persists, see the product question.
- **Locale keys:** none for the control itself; a title/aria string would be new.
- **Risk to name:** this is the moment to decide whether the two slider rows
  become one component. Adding a second padlock inline makes two copies of the
  padlock, which is the D2-03 shape — the very thing this inventory found still
  live at `:1313`.

### ARPU target + auto-balance on the Value card — gap (a)

- **Component:** none; the Promotion card's target box, range readout and Apply
  control (`:2020-2045`, `:2066`) are inline and would be mirrored.
- **Call sites changed: 0 in `mixConstraint`.** `solveForTarget` and
  `achievableTargetRange` already take `members/shares/locked/perMemberArpus`
  and are card-agnostic. The Value card supplies `yieldTierData` and
  `effectiveTierArpu` in the same shapes.
- **New state: 2** — a target string and its parsed value.
- **Locale keys:** the range readout and the unreachable-target copy, if they are
  not reused from the Promotion arm's existing keys.

### Percentage on the Promotion volume arm — gap (c)

Per the recorded order, step 2 first, and it is one site:

- `WhatIfTab.tsx:1327` — the `promoRebanded` pool `size` reads
  `e.subscriberVolume * eventShare(e)`; it must read `resolvedEventVolume`
  (`forecasting.ts:3973`), as the Inflow pool already does. **Call sites: 1.**
- Then `buildPromoEvents` `:546-547` must stop baking `revenue`/`arpu` for a
  percentage promo, matching the plain percentage row's dashed display.
- **Carrier:** `amountType` and `percentageBasis` already exist on `MarketEvent`
  and already round-trip. **No new field, no new column.**
- `promoMix` and `promoBandArpuOverride` need no change — both are
  magnitude-independent, per Item 0.

### Dilution / duration / target / applies-to on the promo pricing arm — gap (c)

Each is a missing field on the promo pricing arm rather than a missing control:
`promoPricingMode` has no `dilution` member; there is no `duration`, no `target`,
no `appliesTo`. The smallest build is to carry the Pricing card's own fields onto
the promo pricing arm and let `buildPromoEvents` emit them, rather than to add
parallel promo-only fields — but **which of them have a meaning on a promotion is
a product question, not a build decision** (below).

### Lock-state persistence — gap (c)

- **Carrier:** a new field on `MarketEvent` (e.g. `promoMixLocked?: string[]`).
- **Sheet/column:** one new column in the Market Events sheet, written by
  `marketEventExportRow` (`forecasting.ts:330` region) and read by
  `marketEventFromRow` (`:1032` region). **Call sites: 2**, plus the restore
  path.
- Gated on the product question.

## Product questions (listed, not answered)

1. **Does lock state persist** with the saved event, or is it a draft-only
   editing aid? Today it is draft-only and is silently lost on save and on
   re-edit.
2. **What does churn mode mean on a promotion?** The Volume card's churn arm is
   a rate reduction over a ramp; a promotion is anchored on a volume movement.
3. **What does Dilution mean on a re-banded promotion's pricing arm**, where the
   mix arm has already moved subscribers between bands?
4. **Which Target options** (Cohorts Only / Cohorts + Base / Base Only) have a
   meaning on a promotion, given it names its own target population?
5. **Which Applies-to options** (Inflow / Retention / Both) are meaningful, given
   the promotion's volume arm already selects Acquisition or Retention?
6. **For a percentage retention promotion, what is the basis** — forecast
   retention for the month, or the base eligible to be re-contracted?
7. **Should the two mix slider rows become one component** before a second
   padlock is added, or is a second inline copy acceptable?

## Limits of this check

- **Read-only and un-executed.** No spec was run, nothing was mounted, no
  fixture was driven. Every claim is source inspection at `2b818ee`, and the
  `promoRebanded` finding in particular has the shape of the D2-03 defect but
  has NOT been reproduced through the app path — which is the standard this
  project set after three sessions failed to reproduce D2-03 from the engine.
- Testid and locale-key coverage for the padlock is reported as "none found",
  which is weaker than "none exists": both were established by grep over the
  card region rather than by driving the control.
- The parity table covers the capabilities named in the brief plus what the
  inventory surfaced. It is not a claim that no other capability differs.
- Slider counts are for the four Market Events cards. Six further sliders exist
  elsewhere in the app and are listed but not inventoried.

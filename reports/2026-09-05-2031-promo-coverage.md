# v3.3.13; promotion-card coverage: the dilution control, the campaign route, KPI precision

Generated: 2026-09-05 21:00 +0100 (UTC 2026-09-05 20:00)
Certifies: e177d62
Repo: committed e177d62, pushed (origin in sync)
BASE: 2864d60 - diff EMPTY. ITEM 0: v3.3.13 in, v3.3.12 out, one commit; BOTH
  claims MATCH (5 call sites enumerated; 4 dep names x 3 builders).
ITEM 1, the dilution CONTROL driven: 25->20 renders '+6.67% retained revenue'
  = dilutionAmountPct; Add builds arpu 26.6667 = 25 x 0.80/0.75, mode and both
  figures persisted FROM THE CONTROL. Incomplete and out-of-range each disable
  Add - though the predicate returns DIFFERENT keys while the effect line
  shows ONE message.
A VACUOUS CHECK OF MINE, caught and fixed: the first run passed with arpu 0,
  and 'arpu = base x ratio' is TRUE FOR EVERY RATIO at zero. A non-zero check
  now sits in FRONT of it.
ITEM 2, the campaign route driven: promo tab TRUE, subs-pressed, dilution 25
  restored, commits 1, rows back 2, CHANGED: NONE.
THE CAMPAIGN HAD TO BE ABSOLUTE, a RULE: groupByCampaign BARS any campaign
  with a percentage row from group edit, so my first fixture found NO
  pressable pill - the bar firing correctly. A PERCENTAGE PROMOTION CAMPAIGN
  IS NOT GROUP-EDITABLE ANYWHERE - existing and deliberate.
ITEM 3: 1602 already read the testid but not the STRING; the card renders
  '+0.01' - a lost sign would still satisfy the number. TRAPS 161 red ('the
  effect equals dilutionAmountPct [NaN vs 6.67]', 4 FAILs) and 162 red ('the
  pill SWITCHES to the Promotion tab', 5 FAILs), kept separate from 160.
COUNTS: traps 156->158; view-apply 124->149; anchors 169/169; survival 96/25;
  no new key; 3 inert testids. GATE 158/158, 59/59, tsc+build clean.

## Base check

`git diff --stat 2864d60..HEAD -- src/ scripts/ test-data/ package.json` EMPTY.
HEAD at entry was `1c1c22f`, the 1950 report commit. The STOP did not fire.

**Nothing user-visible changed.** Three `data-testid` attributes were added
(`promo-month`, `promo-pricing-arm`, `promo-add`) so the controls could be
driven; no copy, no layout, no behaviour.

## Item 0 — docs, and two claims checked

`docs/…v3-3-13.md` committed as supplied, unedited; v3.3.12 deleted in the same
commit (`364a590`).

### Claim 1 — the routers, and their exclusivity. MATCH

`editEventFromVolumeTable` (`:4276`) and `editCampaignFromVolumeTable`
(`:4287`) both exist. Every call site of the two promotion edit handlers,
enumerated rather than counted:

| site | caller |
|---|---|
| `:4195` | inside `handleEditPromoCampaignStart` itself — a one-row campaign delegating to the row handler |
| `:4279` | `editEventFromVolumeTable` |
| `:4290` | `editCampaignFromVolumeTable` |
| `:7826` | the **Promotion** card's own campaign pill |
| `:7861` | the **Promotion** card's own row pencil |

From the **Volume card**, the routers are the only callers — which is the
claim. The other three are the promotion card's own table (its rows come from
`marketEvents.filter(e => e.isPromotion)` at `:7813`) and one internal
delegation.

### Claim 2 — the dependency arrays. MATCH

`promoAmountMode, promoMixLocked, promoDilutionCurrent, promoDilutionTarget,`
appears **3 times** — once in each of the three promo builders.

## Item 1 — the dilution control, driven

2138's own Limits said no mounted case drove the control and the gating was
unasserted. This presses the mode button, types both figures, reads the effect
line, and presses Add.

```
dilution INCOMPLETE     effect "Enter both figures to see the effect."  add disabled true
dilution OUT OF RANGE   effect "Enter both figures to see the effect."  add disabled true
dilution 25->20         rendered "+6.67% retained revenue"  shown 6.67
                        dilutionAmountPct 6.666666666666665
dilution ADD            rows 1  arpu 26.666666666666668  mode dilution
```

| claim | result |
|---|---|
| the rendered effect equals `dilutionAmountPct(25, 20)` | **6.67 vs 6.666666666666665**, to 1e-9 of its 2dp form |
| and is the **ratio**, not the difference | 6.67, not 5.00 |
| `arpu` = base × `retainedRevenueRatio` | **26.666666666666668 = 25 × 0.80/0.75** |
| `promoPricingAmount` = `dilutionAmountPct` | identical to 1e-9 |
| the mode and both stated figures persist from the **control** | yes |

**Both gating branches, on rendered state.** An incomplete pair and an
out-of-range pair each disable Add; a complete pair enables it.

**One thing stated rather than asserted as if it were two:** the effect line
shows the **same** awaiting copy for both branches. `promoDilutionBlockReason`
distinguishes them — `whatif_pricing_block_dilution_incomplete` versus
`_range` — but no surface renders that distinction today. The spec asserts what
exists and says so; it does not pretend the screen tells the two apart.

### A vacuous check of mine, caught and fixed

The first run passed with **`arpu 0`**, and my ratio assertion
(`arpu === (arpu/ratio) × ratio`) is **true for every ratio when arpu is
zero**. The base rate was zero because `computeCohortTrailingArpu` cannot
produce a rate without a revenue or ARPU column and the shared props pass `''`
for both — the same fixture fact the D5-04 mount recorded.

Fixed by supplying an ARPU column, and by putting a **non-zero check in front**
of the ratio check so it can never go vacuous again. Only the printed value
exposed it.

### Trap 161 — RED

```
view-apply-mounted spec: 140/144 passed
  FAIL  dilution control: the rendered effect equals dilutionAmountPct
        [NaN vs 6.67 — the card renders the same function the builder applies]
  FAIL  dilution control: and that figure is the RATIO, not the difference  [NaN]
  FAIL  dilution gating: a COMPLETE pair enables Add  [true]
  FAIL  dilution control: Add built exactly one row  [0]
```

With the target's setter inert the pair never completes: the effect line stays
on the awaiting copy, Add stays disabled, no event is built — all silent,
because every individual piece still looks correct.

## Item 2 — the campaign route, driven

1950's Limits: *"the campaign pill's route is asserted by neither a mounted
click nor a trap."* This is that click.

```
campaign route   promo tab true  volume tab false  subs-pressed true
                 dilution current 25
campaign commits 1  rows back 2
campaign changed: NONE
```

A **two-row** campaign from **one** `buildPromoEvents` call — so the rows share
an amountType and an arm by construction, which is the assumption the campaign
restore makes when it reads `first` and speaks for the group.

**Every row's 23-field read-set is identical** after a no-change save.

### The campaign had to be ABSOLUTE, and that is a rule

The first run found **no pressable pill at all**. Measured rather than assumed:
`groupByCampaign` **bars any campaign containing a percentage row** from group
edit, because the group edit reverse-engineers a ramp by **summing volumes**
and that arithmetic is meaningless on a per cent. The bar was firing correctly
on my fixture.

So the campaign route can only be driven on an absolute campaign, and the unit
restored is Subs. The arm is the **dilution** pricing arm rather than a mix: a
mix needs tier data the shared props cannot produce, and a mix with zero tiers
correctly disables Save — so the dilution arm exercises the D5-03 mode restore
and the 2138 arm together without fighting the fixture.

**A percentage promotion campaign is therefore not group-editable anywhere** —
not from the Volume table and not from the Promotion card, since both read the
same function. That is existing, deliberate behaviour, reported because it
bounds what this check can cover.

### Trap 162 — RED

```
view-apply-mounted spec: 142/147 passed
  FAIL  campaign: the pill SWITCHES to the Promotion tab  [promo false volume true]
  FAIL  campaign: the campaign editor restored the SUBS unit from the first row
  FAIL  campaign: and the dilution arm, both stated figures  [[null,null]]
  FAIL  campaign: the campaign editor is open, with a save control
  FAIL  campaign: the save committed  [0]
```

Registered separately from trap 160 (the **row** half): the two branches are
independent, and a reader repairing one would not necessarily look at the other.

## Item 3 — KPI precision at the card

The 1602 check already reads `impact-arpu-delta-base` by testid, so it was
already at the card rather than the engine. What it did **not** pin is the
rendered **string**: it parses a number out of the cell, and a delta that lost
its sign would still satisfy that number.

```
precision  0.006 renders "+0.01"
```

One check, on the text a user actually sees.

## Counts

`spec:view-apply-mounted` **124 → 149**. Traps **156 → 158** (161, 162).
`spec:trap-anchors` **169/169 (158 traps, 165 anchors)**. `spec:survival`
**96/25, unmoved** — the new blocks added no first-row dereference. TARGETS
unchanged; both traps land in `WhatIfTab.tsx`. **No new locale key.**

## Gate

```
guard-traps: 158/158 caught, no MISSED, no INCONCLUSIVE, no CRASHED
suite:       59/59 green   (npm run suite)
anchors:     169/169 (158 traps, 165 anchors)
tsc:         clean
build:       clean
```

Serial, guard-traps first and alone, output to a FILE:

```
[CAUGHT] 161 the dilution target input stops writing its figure
         - the pair never completes, so the arm is unusable and says nothing about why
[CAUGHT] 162 the campaign route stops asking whether the campaign is a promotion
         - a promotion campaign opens the Volume form, whose save cannot carry its arms
```

## Limits of this check

- **The two gating reasons are not distinguished on screen.** The predicate
  returns different keys for incomplete and out-of-range; the effect line shows
  one message for both. Asserted as it is, not as it might be.
- **The campaign route is driven only on an ABSOLUTE campaign**, because
  percentage campaigns are barred from group edit by rule. A percentage
  campaign's route is therefore still undriven — and unreachable by design.
- **The dilution drive uses no mix arm.** Tier data needs a column the shared
  props do not supply; the interaction between a mix blend and a dilution
  ratio is still only exercised through the builder.
- **The tab-active assertions read a class name** (`bg-white`), as 1950's did.
  A restyle breaks the check without breaking the behaviour.
- **Three testids were added to source.** They are inert attributes, but they
  are a change to a file this session promised not to change user-visibly —
  stated rather than left for a diff to reveal.
- **No walk, no browser.** Everything is the mounted card on constructed
  fixtures.

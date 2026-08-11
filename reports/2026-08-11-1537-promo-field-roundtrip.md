# The promo fields round-trip on both import routes — the mix-mode prerequisite

## FOR ADVISOR

```
Generated: 2026-08-11 15:37 +0100 (UTC 2026-08-11 14:37)
Certifies: a2bba18, branch main, tree CLEAN.
Repo: committed a2bba18, pushed (origin in sync)
RECORDED (Jon, 2026-08-11): promotion-card constrained mix mode moves ahead of the
  DQ import phase; DQ keeps its FULL inheritance and stays before UAT. SCOPE HELD
  to the prerequisite — no mix-mode build started.
ENUMERATED, not sampled. MarketEvent carries NINE modifier fields, the promo card
  writes six, and the EXPORT wrote all nine correctly — never the problem. Exactly
  TWO import routines build an event from a sheet, and only one restored them:
    session restore  App.tsx ~985   promo fields RESTORED (added by 6c24a77)
    workbook import  App.tsx ~2012  ALL SIX DROPPED (route dates from f52b21d)
CLASSIFIED pre-existing, introduced-in-effect by 6c24a77 adding the fields to one
  side only. The route's own comment already named the gap and it stayed open
  anyway. FIXED: readStoredEventModifiers(), one reader, spread into both.
ABSENCE STATED PER FIELD, checked not assumed. promoPricingAmount is where it
  bites — 0 is a legitimate override, so '' carries absence, verified both ways.
  Empty mix reads ABSENT; the two booleans need no carrier; legacy rows unchanged.
SPEC DRIVES WRITER AND READER through a real xlsx write/read, field for field,
  plus absence, malformed, ordering, legacy. CONSTRUCTED AND LABELLED — no shipped
  save carries events, so none exercises it. Trap 52 red on promoMix.
GATE FOUND A THIRD READER of the three behaviour fields in scenarioHelper (no
  promo fields, out of scope). Docstring scoped; recorded, not silently left.
RE-MEASURED unmoved: 74/72/2; MAPEs 13.8845/13.4315/14.3888/13.0192. 31 specs,
  guard-traps 50/50. qa-tester PASS, regression-guard SAFE. Decisions needed: none.
State: pushed; READY for the mix-mode build, three shaping notes below.
```

---

## 1. The enumeration

`MarketEvent` (`forecasting.ts:4–104`) carries **nine modifier fields** beyond
the base event: `amountType`, `percentageBasis`, `retentionLinked`,
`isPromotion`, `promoRebanded`, `promoMixAxis`, `promoMix`, `promoPricingMode`,
`promoPricingAmount`. The promotion card (`buildPromoEvents`, WhatIfTab:304)
writes six of them.

**The export writes all nine and was never the problem.** `App.tsx` ~521–554
emits `Is_Promotion`, `Promo_Rebanded`, `Promo_Mix_Axis`, `Promo_Mix_JSON`,
`Promo_Pricing_Mode`, `Promo_Pricing_Amount`, plus `Amount_Type`,
`Percentage_Basis`, `Retention_Linked` — with carriers already sound.

**Two import routines, one of them incomplete:**

| route | site | the nine fields |
|---|---|---|
| session restore | `App.tsx` ~985 | all nine restored |
| workbook import | `App.tsx` ~2012 | three behaviour fields only — **all six promo fields dropped** |

I checked for a third: exactly two sites construct a `MarketEvent` from a sheet.
The other `setMarketEvents` call sites are in-app writers (WhatIfTab), not
readers.

### Git classification

`git log -S` on the workbook route's own anchor returns **`f52b21d` — the initial
commit**. `git log -S "promoPricingAmount: r.Promo_Pricing_Amount"` returns
**`6c24a77` — "Custom Promotion Card: individual-event and campaign group edit"**.

So the workbook route predates the promo card entirely; the card added the fields
to the session route only. **Pre-existing, introduced-in-effect by `6c24a77`.**

The route's own comment already said so — "the promo fields are already missing
here — a pre-existing gap that is exactly the shape of bug adding fields to only
one side would create". It was right, and it stayed open, which is the whole
argument for a shared reader rather than a second correct copy.

## 2. The fix

`readStoredEventModifiers()` — one reader, spread into both routes. They still
differ where they legitimately differ: the workbook route generates ids and
applies the Outflow sign convention. They no longer differ about what a saved
event *means*.

### Absence, field by field — checked, not assumed

The Seed_Base_Known lesson says: if a value's default is a legitimate value, its
known-ness needs its own carrier. Applied here field by field rather than
wholesale:

- **`promoPricingAmount` — the one where it bites.** Zero is a legitimate
  override (a 0% or zero-amount promotion), so absence cannot be recovered from
  the number. The empty-string carrier is what separates them, and the spec
  asserts both directions: a real `0` survives as `0`, and absent stays absent.
- **`promoMix`** — blank, unparseable, **or an empty object** all read absent. An
  empty object would claim "a mix with no members", which is a different thing
  from "no mix" and would be the wrong input to a constrained allocation.
- **`promoMixAxis`, `promoPricingMode`** — only their enum members survive.
- **`isPromotion`, `promoRebanded`** — `'Yes'` → true, anything else false.
  **No carrier needed, and that was checked**: absent and false mean the same
  thing here, so collapsing them loses nothing.
- **`amountType` / `percentageBasis` / `retentionLinked`** — the defaults *are*
  the pre-2026-08-01 behaviour, so a legacy save reads exactly as it did before
  the columns existed: absolute / baseline / linked.

Two behaviour changes fell out of consolidating, both narrowings and both
deliberate: the old site-A code turned `"{}"` into an empty mix, and let `null`
through as `Number(null) === 0` and non-numeric strings through as `NaN`. Both
now read absent. Stage 2 found and confirmed these rather than my asserting them.

## 3. The spec drives the writer, not just the reader

The standing rule is that round-trip checks which unit-test the reader on literal
inputs are how the last hole survived — the export writer was never exercised, so
a column it failed to write could not be seen.

`spec:event-roundtrip` (39/39) builds a real event with **every** field set,
writes it through an actual xlsx workbook, reads it back, and asserts field for
field. Plus: absence, the zero-vs-absent carrier, malformed input degrading to
absence rather than NaN, sequence ordering, and a legacy row with no promo
columns at all.

**Constructed and labelled.** No shipped save carries promotion events — the
07 Aug save's `Market_Events` sheet holds `{"Note":"No market events defined"}`,
which I checked rather than assumed. So this proves the round trip's **logic**
over the real file format, not that an existing save exercises it. A behavioural
upgrade needs a save with promotions in it, which does not yet exist.

The spec also pins that its copy of the writer matches App's, column for column —
stage 3 verified this side by side. A spec carrying a stale copy of the writer
would be testing a shape the app no longer produces.

**Guard-trap 52** drops `promoMix` from the reader, demonstrated red on the
field-identity check. `promoMix` is the field chosen because it is the structured
one: a half-read mix corrupts a constrained allocation rather than merely
blanking it.

## 4. What the gate found

**A third reader.** `scenarioHelper.ts` (~:217–219, :395, :407) parses the three
behaviour fields again for Scenario Comparison, which has its own parser by
design and is never gated. It references **none** of the six promo fields, so the
round trip is unaffected — but under "duplicate predicates are collapsed on
sight" it is a third copy of three predicates.

I scoped the reader's docstring so its "one reader" claim cannot be over-read,
and recorded the third in EXPECTED.md. **Not collapsed here**: that is a
Scenario-Compare change, not an import one, and this session was scoped to the
prerequisite.

**Stage 2 also confirmed** the spread cannot clobber or be clobbered at either
site (it is last before `sequence` at site A, and final at site B), and that
widening `isPromotion`/`promoRebanded` to required booleans breaks no consumer —
all seven readers in WhatIfTab are truthy checks, none distinguishes `undefined`
from `false`.

## Gate

| stage | verdict |
|---|---|
| qa-tester | PASS — both sites enumerated field by field, two narrowings confirmed deliberate |
| regression-guard | **SAFE FOR USER TESTING** |

31 specs green; **guard-traps 50/50** including trap 52; `traps` 3/3; lint and
build clean; i18n parity 0 missing. §33 with scope named: **main's working tree
and build output are AI-free**; history and remote branches out of scope, the
preserved `ai-capability` branch expected.

```
PINNED ARPU MAPEs: 13.8845 / 13.4315 / 14.3888 / 13.0192   spread 1.3696pp
edge fixture: 74 leaves, 72 fit, 2 unfittable
event-roundtrip 39/39   import-seam 36/36   walk-fixes 82/82
```

I did not start the mix-mode build, as scoped.

## Readiness for the mix-mode build session

**The prerequisite is done.** Three things discovered here should shape that
session:

1. **`promoMix` is `Record<string, number>` with no schema.** The round trip
   preserves members and shares verbatim, including shares that do not sum to
   100. If constrained mix mode has an invariant — shares summing to a total,
   members drawn from a known axis — **that invariant is not enforced anywhere
   today**, and a saved event can reload violating it. Decide early whether the
   constraint is enforced at write, at read, or only at apply.
2. **An empty mix now reads absent, deliberately.** If mix mode ever needs "a mix
   explicitly set to nothing" as a distinct state from "no mix", it needs its own
   carrier — the same lesson as `promoPricingAmount`, and cheaper to design in
   than to retrofit.
3. **The 07 Aug save has no promotion events.** The first save that does becomes
   the behavioural fixture this family currently lacks — worth capturing
   deliberately during the build rather than hoping one appears.

**Also relevant:** `scenarioHelper`'s third parser reads the three behaviour
fields but no promo fields. If mix mode ever needs to appear in Scenario Compare,
that parser is where the fourth copy would otherwise be born.

## Where things stand

DQ retains its full inheritance and stays before UAT; only the order of the two
items changed. The walk remains closed. Nothing else moved.

# D3-02 — the promoRebanded pool's hand-rolled scope predicate

## FOR ADVISOR

```
Generated: 2026-09-03 10:49 +0100 (UTC 2026-09-03 09:49)
Certifies: f55ffc8
Repo: committed f55ffc8, pushed (origin in sync)
BASE: 2b818ee — no source drift. The STOP did not fire; it REPRODUCED.
ITEM 1, MOUNTED, arpuDelta on the rendered KPI by testid:
  BEFORE  leaf 0.94   All 0.00   Corp/All 0.00   (2 FAILs)
  AFTER   leaf 0.94   All 0.43   Corp/All 0.43
  All != leaf is CORRECT: ARPU is a weighted blend, so one 500-sub pool
  moves a larger base by less. The invariant that failed was "a pool exists".
ITEM 3 — SEVEN copies, not one, all scope-match; nothing else found.
  4 LIVE in WhatIfTab (yield Inflow, Inflow pool, re-banded pool, yield
  Retention) because cohortScope supplies the STRING 'All'. 3 in Compare
  are CORRECT TODAY because it holds its view as {l1: null}. Identical
  lines, opposite outcomes, decided by how each spells "All". All 7 gone.
MEASURED, NOT INFERRED: the yield filters' 4 dims are NOT an omission
  (YieldEventLike has no tariff/productL2). scenarioHelper's Inflow-pool filter
  IS one — 5 dims for a 7-dim carrier — so retiring it CHANGES COMPARE's
  behaviour for tariff-scoped events. Annotated; no fixture drives it.
PINS: WhatIfTab 7 -> 11, scenarioHelper 1 -> 4. The 7 was green while 4 copies
  sat in the file it pins, because A CALLER COUNT CANNOT SEE A NON-CALLER.
ITEM 4: structural check — the copies' shape occurs ZERO times in both files
  (line numbers reported when not), plus the one definition still carries the
  both-forms test. Trap 132 proves the pairing: it plants a copy calling
  nothing, so the caller pin stays green and only the structural check fires.
GATE: 129/129 · 55/55 · lint+build clean. Spec 46, traps 127 -> 129.
```

## Base check

HEAD `a5d326d` (this session's skeleton) on `main`, tree clean.
`git diff --stat 2b818ee..HEAD -- src/ scripts/ test-data/ package.json` EMPTY.
The STOP did not fire.

## Item 1 — reproduced MOUNTED, before any change

A Retention promotion with a mix arm (`promoRebanded: true`, `arpu` 40 against a
baseline of 20, 500 subscribers) on the two-leaf store, read through the
rendered ARPU KPI by testid:

```
REBANDED arpuDelta   leaf 0.94   All 0.00   Corp/All 0.00
```

**The pool is carved at the leaf and at neither aggregate.** The fixture is
asserted to be in scope at All by the shared predicate first, so the absence is
the coverage mechanism and not the scope one. Two checks failed on that run:

```
FAIL  rebanded: the pool is carved at ALL too  [arpuDelta 0]
FAIL  rebanded: and at the intermediate Corporate/All view  [arpuDelta 0]
```

**The STOP did not fire.** Same mechanism as D2-03, a different surface: there
the event's VOLUME went missing at the aggregate, here its ARPU does. The
promotion's re-banded rate fell silently back into the standing base.

`impact-arpu-delta` was added to the KPI card so the quantity could be read by
testid rather than by text.

### After the fix

```
REBANDED arpuDelta   leaf 0.94   All 0.43   Corp/All 0.43
```

**All ≠ leaf is correct here and is not a new discrepancy.** ARPU is a weighted
blend, not a sum: the same 500-subscriber pool at rate 40 moves a larger base by
less. The invariant that failed was "the pool exists at every view containing
the promotion", and that now holds.

## Item 2 — the block retired

`WhatIfTab.tsx:1313-1319` deleted and replaced with a call to
`eventScopeMatchesView` against `viewScopeForMatch`, which the apply path
already builds eleven hundred lines above. Retired, not repaired.

## Item 3 — the sweep: SEVEN copies, not one

The sweep pattern was an `'All'` string test OR'd with a truthiness test on a
view dimension. **Seven blocks outside `eventScopeMatchesView`**, all of them
scope-match reimplementations. None was anything else, so nothing falls into the
"reported, not fixed" bucket.

| # | site | filters | dims | live or latent |
|---|---|---|---|---|
| 1 | `WhatIfTab.tsx:1181-1185` | yield events, Inflow side | 4 | **LIVE** |
| 2 | `WhatIfTab.tsx:1246-1252` | the Inflow event pool | 7 | **LIVE** |
| 3 | `WhatIfTab.tsx:1313-1319` | the re-banded Retention pool | 7 | **LIVE** — D3-02 |
| 4 | `WhatIfTab.tsx:1351-1355` | yield events, Retention side | 4 | **LIVE** |
| 5 | `scenarioHelper.ts:200-207` | market events (Compare) | 7 | latent |
| 6 | `scenarioHelper.ts:333-337` | yield events (Compare) | 4 | latent |
| 7 | `scenarioHelper.ts:381-386` | Inflow events, ARPU pool (Compare) | **5** | latent |

### Why four are live and three are not — the same lines, opposite outcomes

`cohortScope` hands `WhatIfTab`'s engine the **string** `'All'`, which is truthy,
so `!vprodL1` is false and the copies withhold. `ScenarioCompareTab` holds its
view as `{l1: null, l2: null}` (`:29-31`), so `!vprodL1` is **true** and
Compare's three copies are **correct today**.

That is the standing rule stated as a measurement: a copy that is right only
because of how its single caller happens to spell "All" is a defect waiting for
a second caller. All seven were retired.

### Two things the sweep settled that inspection alone would have got wrong

**The yield blocks' four dimensions are not an omission.** `YieldEventLike`
(`forecasting.ts:777-787`) carries `segment`, `product`, `channelL1`,
`channelL2` and no tariff or productL2 at all. The shared predicate treats an
absent dimension as matching, so replacing them is the SAME comparison with the
`!v` bug removed — not a widened one.

**Site 7 IS an omission, and replacing it changes behaviour.** It compared five
dimensions and omitted tariff L1/L2 for a MARKET event, which does carry them —
so a tariff-scoped Inflow event pooled across every tariff in Compare. That is
the same omission the pricing filter had before it was retired to the shared
predicate, and the same fix. **Behaviour therefore changes for tariff-scoped
events in Compare**, and the change is annotated at the site.

### The pins

- `pricing-roundtrip-spec.ts` — `WhatIfTab` callers **7 → 11**.
- `scenario-pricing-spec.ts` — `scenarioHelper` callers **1 → 4**.

The 7→11 comment records why the previous number was written with the words
"the last consumer not filtering through the shared predicate": that was wrong
when it was written, and the pin could not have said so.

## Item 4 — the structural check

Added to `pricing-roundtrip-spec.ts`, three checks:

- `no hand-rolled view comparison in WhatIfTab.tsx` — zero occurrences of
  `=== 'All' || !v` (comments stripped first), reporting the offending line
  numbers when non-zero;
- the same for `scenarioHelper.ts`;
- that the ONE definition in `forecasting.ts` still carries the both-forms test
  `!dim || dim === 'All' || !view || view === 'All' || dim === view`, so the
  exemption is wired to its premise rather than being a bare filename.

The reason is recorded at the check: **a caller count cannot see a non-caller.**
The 7-caller pin was green for the whole time four copies were live inside the
file it pins, because none of them called the thing being counted.

## Item 5 — traps

Trap count **127 → 129**.

### (a) Trap 131 — restore the hand-rolled block

```
REBANDED arpuDelta  leaf 0.94   All 0   Corp/All 0
view-apply-mounted spec: 44/46 passed
  FAIL  rebanded: the pool is carved at ALL too  [arpuDelta 0]
  FAIL  rebanded: and at the intermediate Corporate/All view  [arpuDelta 0]
```

Exactly the pre-fix numbers. Restored, 46/46.

### (b) Trap 132 — a fresh hand-rolled comparison

Plants a new copy that calls nothing, so the caller pin stays green and only the
structural check can see it:

```
pricing-roundtrip spec: 120 passed, 1 failed
  FAIL  scope wiring: no hand-rolled view comparison in WhatIfTab.tsx  [1 at line(s) 629]
```

It names the line. Restored, 121/121.

Both anchors were verified to occur exactly once in the target file before being
trusted — the trap-13 lesson, applied twice.

## Gate

```
guard-traps: 129/129 caught, no MISSED, no INCONCLUSIVE (was 127)
full suite:  55/55 spec scripts green
lint:        tsc --noEmit clean
build:       clean
```

## Limits of this check

- **Only the re-banded pool was reproduced mounted.** Sites 1, 2 and 4 are
  fixed on the same measured mechanism and are covered by the structural check,
  but no fixture drives a yield event or the Inflow pool at an aggregate. Their
  correction is inferred from an identical cause, not separately observed.
- **Compare is not driven at all.** Its three sites were latent, and the widening
  at site 7 is a real behaviour change for tariff-scoped events that no spec in
  this repo exercises. If Compare's tariff behaviour matters, it needs a fixture.
- The structural check pins one pattern shape. A hand-rolled comparison written
  differently — `v == null`, a helper, a ternary — would not match it, and the
  caller pin still cannot see it either.
- No walk. Everything here is the mounted card and direct predicate calls.

# Percentage promotion: the Retention half, the mix arm, the round-trip

Generated: 2026-09-04 20:35 +0100 (UTC 2026-09-04 19:35)
Certifies: 945d648
Repo: committed 945d648, pushed (origin in sync)
BASE: d92fdaa - diff EMPTY. No new decision surfaced.
ITEM 1, by hand: leaf 1.36 = (400x21+40x36)/440-21; All 1.11 =
  (500x21+40x36)/540-21 - the SAME resolved 40 over a wider denominator;
  disjoint 0; Base 0 at T, 0.06 at T+1. Row: pct, revenue 0, arpu 36.
THE FIXTURE COULD NOT HAVE CAUGHT IT EITHER: on retention 100, pct% x 100 IS
  pct, so a +10% promo resolves to 10 - what the defect produces. New store
  seeded 400/100.
promoRebanded IS NOT OBSERVABLE IN RETENTION ARPU - it feeds BASE AT T+1 only;
  scenarioPools never reads p_eventPools. THIRD session to pay for this (1409
  measured it, 1526 did not); now in EXPECTED.md.
TRAP (b) FIREABLE AND RED at Base T+1: 'FAIL ret%: the RE-BANDED POOL is sized
  from the RESOLVED delta [base 0.02 - a pool of TEN]'; 40x16/10240 vs
  10x16/10240. Trap 150. Trap 151 (metric 'inflow'): the pool VANISHES to 0.
ITEM 2: THE MIX HAS NO PER-TIER VOLUMES anywhere in src/ - a pricing device,
  one blended rate - so the briefed assertion describes no mechanism and its
  trap no site (shed on measurement, not budget). Asserted instead: inflow
  0.82 = (200x22+20x31)/220-22, vs 0.41 percent-sized, 0.42 mean-priced.
ITEM 3: round-trip GREEN both arms, both routes, 23-field read-set deep-equal,
  revenue still 0, absent Amount_Type loads ABSOLUTE. Trap 152 KEPT and red.
COUNTS: traps 145->148; view-apply 67->84; roundtrip 86->106; anchors 159/159.
  GATE (serial): 148/148, no MISSED/CRASHED/INCONCLUSIVE; 58/58 specs;
  tsc+build clean.

## Base check

`git diff --stat d92fdaa..HEAD -- src/ scripts/ test-data/ package.json` EMPTY.
HEAD at entry was `a6fc47f`, the 1526 report commit. The STOP did not fire.

## Item 1 - the Retention half (NEVER-SHED)

### The fixture could not have told the two arithmetics apart

Asserted before anything was concluded from it. The mounted fixture seeds
**retention 100** on every leaf, and on retention 100 a percentage is
non-discriminating: `pct% x 100` is `pct`, so the resolved delta of a +10%
promotion is **10** - exactly the number the retired arithmetic produces by
reading the stored per cent as a subscriber count.

A pool-size assertion on that fixture passes with or without the defect. That is
the vacuous-result trap, and it is a second, independent reason trap (b) planted
green in 1526: not only was there no Retention mounted case, the fixture that
case would have run on could not have caught it.

So the retention case runs on a **second store**, leaves seeded **400 / 100**.
A +10% promotion on leaf A resolves to **40**; the retired reading gives **10**.
The default store is untouched, because the lag block's 15.83 / 13.57 figures
are hand-computed against retention 100.

### The built row

Through the real `buildPromoEvents`: target Retention, `amountType`
'percentage', a value-mix arm `{ High: 60, Low: 40 }` over bands at 30 / 15, and
a **stated re-banded rate** of 50 on High.

| field | value | why |
|---|---|---|
| `amountType` | `percentage` | |
| `revenue` | **0** | per-cent x rate would be read as an ARPU by the pool |
| `arpu` | **36** | `0.60x50 + 0.40x15` - the stated rate outranks the band's own |
| `subscriberVolume` | 10 | the PER CENT |
| `promoRebanded` | true | Retention + an arm |
| `promoBandArpuOverride` | `{ High: 50 }` | filtered to the members |

### The mounted result, by hand at both views

```
ret%  leaf retention 1.36  base 0  |  All retention 1.11  base 0  |  disjoint 0
ret% one month EARLIER  leaf base 0.06
```

- **Leaf**: adjusted retention is `400 + 40 = 440`, of which 40 sits in the pool
  at 36 and 400 remains at the fitted 21 -
  `(400x21 + 40x36)/440 - 21 = 1.3636`. The retired reading gives a pool of ten
  against a natural 430: `(430x21 + 10x36)/440 - 21 = 0.3409`.
- **All**: total fitted retention 500, coverage `400/500 = 0.8`, so the delta is
  `0.10 x 500 x 0.8 = 40` - **the same 40**, the sum over the leaves the
  promotion covers. Blended over the wider base:
  `(500x21 + 40x36)/540 - 21 = 1.1111`.
- A **disjoint** leaf does not move.
- **Base is 0 at T** and **0.06 at T+1** - the lag, in both directions.

The delta is identical at leaf and All; it is the ARPU denominator that differs,
which is why the two rendered figures are not equal and each is pinned to its
own hand arithmetic rather than to the other.

### WHERE THE RE-BANDED POOL IS ACTUALLY OBSERVABLE

**Measured, and it is not where the brief expected.** The `promoRebanded` pool
in `p_eventPools` feeds **Base ARPU at T+1 and nothing else**. The per-scenario
**Retention** ARPU is built by `scenarioPools` - a separate construction that
resolves percentages correctly in its own right and never consults
`p_eventPools`.

So the Retention ARPU check at T, however exact, **cannot catch a defect in the
re-banded pool's size**. The size assertion had to be placed at Base, T+1.

This is the third session to pay for the same fact: 1409 measured it when it
declined to re-point the D3-02 assertions, and 1526 did not, which is the deeper
reason its trap planted green. Recorded in EXPECTED.md rather than only here.

The size assertion, with both numbers known in advance:

```
resolved   pool 40 @36 over a base at 20 -> 40 x 16 / 10240 = 0.0625 -> 0.06
retired    pool 10 @36                   -> 10 x 16 / 10240 = 0.0156 -> 0.02
```

The adjusted stock is identical either way - step D enforces
`p_basePool = newBAdj - eventTotal` - so the two deltas stand in the pool-size
ratio 40:10 exactly.

### Trap (b), re-planted and RED

Pre-plant backup taken (the tree already differed from HEAD), the plant verified
landed by `diff` before the spec was read, restored and verified after.

```
view-apply-mounted spec: 79/80 passed
  FAIL  ret%: the RE-BANDED POOL is sized from the RESOLVED delta
        [base 0.02 - 0.02 is a pool of TEN: the per cent read as a subscriber count]
```

Registered as **trap 150**.

### The second trap - the wrong metric

`'retention'` -> `'inflow'`: `resolvedEventVolume` finds no derivation for the
wrong metric and returns **0**, so the pool does not become wrong, it
**vanishes**.

```
view-apply-mounted spec: 78/80 passed
  FAIL  ret%: BASE carries it at T+1  [base 0]
  FAIL  ret%: the RE-BANDED POOL is sized from the RESOLVED delta  [base 0]
```

Registered as **trap 151**.

## Item 2 - the mix arm under a percentage

**A measurement changed what this item can assert.** The mix carries **no
per-tier volumes**: no site in `src/` splits a promotion's volume across its
bands. `promoMix` is read by the card, by the edit-restore path and by the
export, and its only effect on the forecast is the single blended RATE the event
carries as `arpu`.

So "the per-tier volumes are the resolved delta split by the mix, not the
percent split" is a claim about a mechanism that does not exist. What the pool
does claim is stronger, and is asserted instead: **SIZE from the resolved delta,
PRICE at the mix blend** - and one number pins both.

A +10% Inflow promotion, three tiers at 40 / 30 / 10, shares 50 / 30 / 20:

```
blend      0.50x40 + 0.30x30 + 0.20x10 = 31          (a MEAN would be 26.67)
correct        pool 20 @31 -> (200x22 + 20x31)/220 - 22 = 0.8182   MEASURED 0.82
percent-sized  pool 10 @31 -> (210x22 + 10x31)/220 - 22 = 0.4091
mean-priced    pool 20 @26.67 -> (200x22 + 20x26.67)/220 - 22 = 0.4242
```

Three known values; the check separates the right one from two plausible wrong
ones rather than from zero.

**Item 2's trap is shed - for a measured reason, not for budget.** "The mix
applied to the percent" has no site to plant on, because there is no volume
split to mutate.

## Item 3 - the round-trip

Through the real `marketEventExportRow`, a real xlsx write/read, and the real
`marketEventFromRow` on **both** import routes (session and workbook), for
**both** arms - a percentage Inflow promotion and a percentage Retention
promotion carrying a mix, a stated band rate and a lock.

- `Amount_Type` and `Percentage_Basis` are written to the sheet and read back.
- The **engine's read-set** - 23 fields, deep-equalled in one comparison rather
  than field by field, so a field added to the builder and forgotten here does
  not round-trip untested - rebuilds identically.
- `revenue` is **still 0** after the reload. A revived revenue would be read as
  an ARPU by the pool, which is the whole reason it is zeroed at build time.
- A workbook with **no `Amount_Type`** on a promo row loads as **absolute** on
  both routes: 500 subscribers stay 500 subscribers rather than becoming five
  hundred per cent.

`spec:event-roundtrip` **86 -> 106**.

### The trap - KEPT, not shed

`row.Amount_Type === 'percentage' ? ... : 'absolute'` inverted to default the
other way:

```
event-roundtrip spec: 103 passed, 3 failed
  FAIL LEGACY: behaviour fields read as they did before the columns existed
  FAIL PROMO% LEGACY/session: a promo row with no Amount_Type loads as ABSOLUTE
       [percentage - 500 would become five hundred per cent]
  FAIL PROMO% LEGACY/workbook: ... same
```

An **existing** check catches it too, which is worth stating: the trap is not
the only guard on that line, so registering it pins the promo-specific reason
rather than adding the first cover. Registered as **trap 152**.

## Item 4 - counts and gate

Traps **145 -> 148** (150, 151, 152). No duplicate ids; `spec:trap-anchors`
**159/159 (148 traps, 155 anchors)**, every anchor unique. TARGETS unchanged -
all three traps land in files already registered (`WhatIfTab.tsx`,
`forecasting.ts`).

`spec:view-apply-mounted` **67 -> 84**; `spec:event-roundtrip` **86 -> 106**.

```
guard-traps: 148/148 caught, no MISSED, no INCONCLUSIVE, no CRASHED
full suite:  58/58 spec scripts green
anchors:     159/159  (148 traps, 155 anchors)
tsc:         clean
build:       clean
```

Run **serially**, guard-traps first and alone - it mutates tracked source.

The guard-traps run was piped through `tail`, so the per-trap lines for 150-152
are not in the captured output. The claim rests on the harness's own exit
contract instead: it exits non-zero if ANY trap is not CAUGHT, and it exited 0
at 148/148. Each of the three was also planted and confirmed red by hand before
registration, with the FAIL lines quoted above.

## Limits of this check

- **The Retention ARPU check and the pool-size check guard DIFFERENT code.**
  The first exercises `scenarioPools`; only the second (Base, T+1) exercises
  `promoRebanded`. Trap 150 confirms the second; nothing here would notice if
  the first were removed, since the lag checks would still hold.
- **The 10240 base stock is read from the run, not derived.** The ratio argument
  (40:10, identical total stock) is what the check rests on; the absolute stock
  figure is observed.
- **No walk.** Everything is the mounted card on constructed fixtures.
- **No spread, no pricing arm, no tariff axis** under a percentage. The retention
  case runs one month, one mix arm, value axis only.
- **The round-trip does not go through `buildPromoEvents`.** That spec is plain
  `.ts` and importing the card would pull React into it, so the events are
  literals shaped as the builder emits. The WRITER is real; the shape is
  asserted by inspection against the builder, not by construction.
- **`arpu` is still baked** for percentage promotions - by design, it is a rate -
  so a promotion's stored ARPU is a save-time figure while its volume resolves
  per month. Nothing asserts the two stay coherent.

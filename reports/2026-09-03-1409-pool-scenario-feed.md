# Pools feed the ARPU of their own scenario

## FOR ADVISOR

```
Generated: 2026-09-03 14:09 +0100 (UTC 2026-09-03 13:09)
Certifies: 2ecdefb
Repo: committed 2ecdefb, pushed (origin in sync)
BASE: 20799e3 — no drift. STOP did not fire. 1247's stale Limits bullet gone.
ITEM 1 — poolsFor vs p_eventPools, vol/arpu, at BOTH views:
  absolute +1000@35   1000/35 vs 1000/35   AGREE
  rebanded  500@40     500/40 vs  500/40   AGREE
  percentage +10%@35    10/35 vs   20/35   DIFFER
  The percent is READ AS A SUBSCRIBER COUNT. ARPUs agree everywhere; the
  divergence is entirely SIZE, so an absolute-only fixture could not see it.
MY OWN HARNESS ERROR: first run gave 30 at All, not 20 — I omitted
  viewLeafForecasts. The reproduction rule failing minutes after quoting it.
AFTER, per scenario, leaf / All (— is absence, not 0): Inflow 10.83 absolute
  and 1.18 percentage; Retention 15.83 / 13.57; Base 0 at T, 0.94 at T+1.
  All four verified BY HAND, not merely observed.
D3-02 RE-POINT TESTED AND DECLINED: trap 131 zeroes Base (0.43 -> 0) and
  leaves Retention at 15.83 / 13.57 untouched — the hand-rolled block now
  feeds only Base. Re-pointing would pass with or without the defect, so the
  assertions STAY on Base. The brief's own condition, measured.
poolsFor DELETED. EventPool gains eventMonthIdx (enterMonthIdx meant
  eventMonth+1 for Inflow, eventMonth for the re-banded pool); REQUIRED, so
  tsc caught a THIRD push site the decision never named — the yield pool.
GATE CAUGHT AN AGED ANCHOR: trap 115 INCONCLUSIVE at 132/133, re-anchored.
  Second after trap 13 — traps rot on the code that changes most.
GATE: 133/133 · 55/55 · lint+build clean. Spec 51 -> 56; traps 131 -> 133.
```

## Base check

HEAD `cdbc380` (this session's skeleton) on `main`, tree clean at entry.
`git diff --stat 20799e3..HEAD -- src/ scripts/ test-data/ package.json` EMPTY.
The STOP did not fire.

The same first commit corrected `1247`'s Limits section: a bullet claimed the
remaining-blended-reader count was not produced and that Item 2 did not run.
Both were false — the body reports zero remaining readers in `src/` and the FOR
ADVISOR states it. The bullet was written while that session was stopping and
was not revised once Jon's ruling let it continue.

## The governing entry, verbatim

`test-data/EXPECTED.md`, dated 2026-09-03:

> #### A POOL FEEDS THE ARPU OF THE SCENARIO WHOSE COHORT IT DESCRIBES (Jon, 2026-09-03)
>
> **Supplements Q3/Q4 (2026-09-02); does not reopen them.** Cross-referenced to
> Q4 (the blend consumers) and to D3-02 (`f55ffc8`, the re-banded pool's
> hand-rolled scope predicate).
>
> - The **Inflow event pool** feeds **Inflow ARPU (adjusted)**.
> - The **re-banded Retention pool** feeds **Retention ARPU (adjusted)**.
> - Both reach **Base ARPU only through the T+1 lag**.
> - **No pool feeds a blended figure once Q4 lands.**

## Item 1 — the two arithmetics, measured BEFORE

Same events, mounted two-leaf store, both views, using the real exported
functions:

| event | view | `poolsFor` vol / arpu | `p_eventPools` vol / arpu | agree |
|---|---|---|---|---|
| absolute Inflow +1000 @35 | leaf | 1000.00 / 35.00 | 1000.00 / 35.00 | **YES** |
| absolute Inflow +1000 @35 | All | 1000.00 / 35.00 | 1000.00 / 35.00 | **YES** |
| percentage Inflow +10% @35 | leaf | **10.00** / 35.00 | **20.00** / 35.00 | **NO** |
| percentage Inflow +10% @35 | All | **10.00** / 35.00 | **20.00** / 35.00 | **NO** |
| rebanded Retention 500 @40 | leaf | 500.00 / 40.00 | 500.00 / 40.00 | **YES** |
| rebanded Retention 500 @40 | All | 500.00 / 40.00 | 500.00 / 40.00 | **YES** |

**Absolute events agree at both views, so the STOP did not fire.**

**Why the percentage differs.** `poolsFor` sized a pool from
`Math.abs(e.subscriberVolume)`. For a percentage event that field HOLDS THE
PERCENT, so a +10% event produced a pool of **ten subscribers at £35** — a
fabricated population, priced — against the resolved delta of 20.

The ARPUs agree in every row because both constructions fall through to
`e.arpu` when an event carries no revenue. The divergence is entirely in the
size, which is why it never showed on a fixture of absolute events.

### A harness error worth recording

The first run reported the percentage at All as **30**, not 20. That was my
measurement, not the app: I called `computeAdjustedForecast` without
`viewLeafForecasts`, so `forecastCoverage` could not answer and fell back to
historical weighting (300/1000 rather than 200/1000). Passing what the card
passes gives 20 at both views.

This is the standing rule — *a reproduction hands the engine what the APP hands
it* — failing in the small, in a harness written by the session that had just
finished quoting it.

## Item 2 — the feed

`poolsFor` is **deleted**, not left beside the new path. One arithmetic now
serves every pool: a stated override, else revenue over volume, else a stated
rate, else the month's baseline; and a size that carries the **view's share**
and is **resolved for a percentage**.

Three sites, per the decision:

- **`inflow`** takes the Inflow-scenario pools for the month;
- **`retention`** takes the Retention-scenario pools for the month;
- **`base`** takes only what the lag has delivered — `p_eventPools` filtered to
  `eventMonthIdx < idx`.

`EventPool` gains `eventMonthIdx`, because `enterMonthIdx` could not answer the
lag question: it is `eventMonth + 1` for the Inflow pool and `eventMonth` for
the re-banded Retention pool, so the same field means different things for the
two. Carrying the event month explicitly is what lets Base apply one rule.

**What changed for Base.** Nothing for the Inflow pool, which was already
lagged. The re-banded Retention pool is pushed in its own month, so Base counted
it immediately: a retention promotion moved Base ARPU in the month it was
*stated* rather than the month its subscribers reached the stock. Retention ARPU
now carries it in that month instead.

**A third push site needed the field too** — the synthetic yield pool for
yield-adjusted natural inflow. It is built from the previous month's flow, so
its event month is `idx - 1` and the lag has already delivered it. `tsc` caught
the omission; it is not a market event and feeds no scenario term.

### Before and after, per scenario, both views

Measured on the mounted card by testid. `—` is a named absence, not zero.

| fixture | view | Inflow | Outflow | Retention | Base |
|---|---|---|---|---|---|
| absolute Inflow @35, month 0 | leaf | 0 | — | 0 | 1.29 |
| absolute Inflow @35, month 0 | All | 0 | — | 0 | 0.63 |
| rebanded promo, month 0 | leaf | 0 | — | 0 | 0.94 |
| rebanded promo, month 0 | All | 0 | — | 0 | 0.43 |
| absolute Inflow @35, LAST month | leaf | **10.83** | — | 0 | **0** |
| percentage +10% @35, LAST month | leaf | **1.18** | — | 0 | **0** |
| rebanded promo, LAST month | leaf | 0 | — | **15.83** | **0** |
| rebanded promo, LAST month | All | 0 | — | **13.57** | **0** |
| rebanded promo, one month EARLIER | leaf | 0 | — | 0 | **0.94** |

The Base column for the month-0 fixtures is unchanged from before this session
(1.29 / 0.63 / 0.94 / 0.43), because those events sit two months before the
end of the period and the lag had already delivered them.

**Four figures verified by hand, not merely observed:**

- Inflow, absolute: `(200×22 + 1000×35)/1200 − 22 = 10.83`
- Inflow, percentage: `(200×22 + 20×35)/220 − 22 = 1.18`
- Retention at the leaf: `(100×21 + 500×40)/600 − 21 = 15.83`
- Retention at All: `(200×21 + 500×40)/700 − 21 = 13.57`

## Item 3 — specs and traps

`spec:view-apply-mounted` 51 → **56** checks. Traps 131 → **133**.

**The fixture needed retention volume first.** With `retention: band(0)` on
every leaf the derived All aggregate has no retention band to fit, so every
retention assertion read the em dash. Measured on the first run: retention moved
at the leaf and was `null` at All — which looks exactly like a scoping defect
and was a fixture gap. Recorded at the fixture.

### The D3-02 re-point was tested and NOT made

The brief asks to re-point the D3-02 assertions to Retention ARPU, *"non-vacuous
only if restoring the hand-rolled block zeroes it"*. **Measured: it does not.**

Trap 131 planted by hand:

```
REBANDED per-scenario at All   inflow 0  outflow null  retention 0  base 0
LAG promo in LAST month  leaf retention 15.83  base 0  |  All retention 13.57  base 0

view-apply-mounted spec: 53/55 passed
  FAIL  rebanded: the pool is carved at ALL too  [base 0]
  FAIL  rebanded: and at the intermediate Corporate/All view  [base 0]
```

Base goes to 0 at All; **Retention is untouched at both views** (15.83 and
13.57, identical to the clean run). The hand-rolled block lives in the
`p_eventPools` re-banded push, which now feeds only Base; Retention arrives
through `scenarioPools`, which uses the shared predicate and the trap never
reaches it.

So the assertions **stay on Base**, per the brief's own condition. Re-pointing
them would have produced two checks that pass whether or not the defect is
present.

### Trap 135 — the retired sizing comes back

Hand-planted, confirmed red, restored:

```
PCT last-month at leaf  inflow 0.59
view-apply-mounted spec: 55/56 passed
  FAIL  feed: a PERCENTAGE event sizes its pool from the RESOLVED delta
        [inflow 0.59 — 0.59 means the percent was read as a subscriber count]
```

`0.59` is the retired arithmetic's value, computed by hand before the trap ran:
`(210×22 + 10×35)/220 − 22`. Both sides of the comparison are hand figures, so
the trap discriminates between two known numbers rather than between a number
and its absence.

### Trap 136 — Base counts a pool in its own month

Removes the lag filter. Anchor verified unique.

**Trap 135's first draft was wrong and was rewritten.** It anchored on one line
and left unbalanced parentheses, so the spec would have crashed rather than
failed — caught, but for the wrong reason. It now replaces the whole expression.

### The gate caught an aged-out anchor — trap 115

The first run scored **132/133**:

```
[INCONCLUSIVE] 115 base ARPU is weighted by inflow, not the adjusted base stock
               — anchor did not match — nothing was planted
```

Trap 115 named the base term's `naturalVolume: Math.max(0, newBAdj -
p_eventPools.reduce(...))`. That line now subtracts only the pools the lag has
delivered, so the anchor described code that no longer exists. It planted
nothing and said so.

**This is the second time this file has paid for the same thing** — trap 13 aged
out the same way when `resolveFromStore`'s return grew a field. The pattern is
now clear enough to state: **a mutation trap is coupled to the source text of
the line it guards, so the traps most likely to rot are the ones on the code
most likely to change.** Both instances were caught only because INCONCLUSIVE is
a distinct state from CAUGHT; under a naive score both would have read as a
clean pass, since a trap that plants nothing also ends with a green spec.

Re-anchored to the `delivered` form, verified to occur exactly once, and the
reason recorded at the trap.

## Gate

```
guard-traps: 133/133 caught, no MISSED, no INCONCLUSIVE
             (132/133 on the first run — trap 115's anchor had aged out)
full suite:  55/55 spec scripts green
lint:        tsc --noEmit clean
build:       clean
```

## Limits of this check

- **No walk, and no real workbook.** Everything is the mounted card and direct
  calls on a constructed two-leaf fixture whose figures were chosen to
  discriminate. A real save may exercise pool combinations this does not.
- **Outflow is untested by construction.** It is rate-inert — no pricing target
  names it and yield carries only Inflow and Retention — so it has no pool and
  reads absent throughout.
- **The contract-length window is not exercised.** Pools carry
  `contractLength`, and the at-risk churn mechanism that consumes it is
  untouched here and undriven by this fixture.
- **The lag is asserted at one boundary**, T and T+1 on a three-month horizon.
  A longer horizon, or a pool entering at the first month, is not driven.
- Item 1's agreement table covers three event shapes. A pool whose event
  carries `revenue` rather than `arpu`, or an `arpuOverride`, is reasoned from
  the shared precedence rather than measured.


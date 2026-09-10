# Compare — the parity check cannot run, and Compare's durations are inverted

```
FOR ADVISOR
Generated: 2026-09-10 09:58 +0100 (UTC 2026-09-10 08:58)
Certifies: d94434b (docs only)
Repo: no src change; docs d94434b pushed

BASE fa8c4ff + 2 (reports/ ONLY). PREMISE 0854 EXACT. DOCS d94434b.
1 STOP — THE DIVERGENCE CHECK CANNOT RUN AS SPECIFIED. Compare has NO
  Base ARPU: its row carries ONE blended adjustedArpu (sh:574-595) and
  `scenarioArpu` appears ZERO times there. Its baseline aggregation reads
  only ARPU_Mean, by its own words "an approximation of size for weighting
  ARPU" (sh:191-197) — never BaseARPU_Mean. So the parity test has NO
  LEFT-HAND SIDE and is unmeetable; NOTHING BUILT.
1b AND COMPARE IS NOT INERT — withdrawing my own 0854 wording. MEASURED,
  19:30 save, retention 25 -> 20 at 2026-09, vs a no-event control:
    Duration='one-off'    +0.0554 +0.0557 +0.0562 ... +0.0561 @2027-06
    Duration='recurring'  +0.0554  0.0000  0.0000 ...  0.0000
  THE TWO DURATIONS ARE EXACTLY INVERTED. sh:523-526 guards on
  `e.Duration !== 'one-off' && currMs >= endMs`, so ONE-OFF never stops;
  and Number('recurring')||1 gives a ONE-month window, so RECURRING stops
  after one. What-If is correct (WIT:1751-1752). PRE-EXISTING, unrelated
  to D5-14, and it misreads EVERY existing save with a pricing event —
  backwards. Fixing it changes those forecasts: A DECISION, and bigger
  than the pool question it surfaced under.
2-4 NOT REACHED: no card control, no mounted re-runs, no traps (199+
  still unused), so a frozen-rate regression would still pass the suite.
5 GATE suite 61/61; ZERO code drift (git status clean).
```

## 1. Why item 1 stopped

**Compare has no Base ARPU.** Its flat row is
`month, baselineInflow, baselineOutflow, baselineRetention, baselineBase,
baselineArpu, adjustedInflow, adjustedOutflow, adjustedRetention,
adjustedBase, adjustedArpu` plus the four id arrays (`scenarioHelper.ts:574-595`)
— **one blended ARPU**, no per-scenario decomposition. `scenarioArpu` appears
**zero** times in that file.

**And it cannot reach a base band.** Compare's baseline aggregation
(`:191-197`) reads only `ARPU_Mean`, weighted by
`Seed_Base_Volume + Inflow_Mean`, with its own comment saying that is *"an
approximation of size for weighting ARPU"*. `BaseARPU_Mean` — the band the
What-If pool anchors to (`WhatIfTab.tsx:1686`) — is never read.

So the brief's acceptance test, *"Compare's Base ARPU at T+1..T+6 equals
What-If's to the penny"*, **has no left-hand side**. Even the nearest available
quantity, `adjustedArpu`, is produced by a different and self-declared
approximate method, so penny parity is not reachable by carving a pool.

That test is item 1's definition of done, and item 1 is the never-shed item, so
**nothing was built**. `git status` is clean; there is no code in this session.

**Two ways forward, both decisions:** give Compare a base band and a
per-scenario decomposition so the two engines are comparable at all — a large
change to a file that deliberately works from raw rows — or replace the penny
parity test with a weaker, explicitly-stated one (same sign, same order of
magnitude on `adjustedArpu`), and say so in the decision rather than in a spec.

## 2. Compare is not inert, and its durations are inverted

**I called Compare "inert" in the 0854 report. That was wrong, and this
withdraws it.** Compare's pricing site 12 does apply the delta — it simply
creates no pool. Measured on the 19:30 save, SOHO / Mobile Voice, retention
25 → 20 at 2026-09, against a no-event control:

| `Duration` | 2026-09 | 2026-10 | 2026-11 | 2026-12 | 2027-01 | 2027-06 |
|---|---|---|---|---|---|---|
| `one-off` | +0.0554 | +0.0557 | +0.0562 | +0.0565 | +0.0562 | **+0.0561** |
| `recurring` | +0.0554 | **0.0000** | 0.0000 | 0.0000 | 0.0000 | 0.0000 |

**Exactly inverted.** A One-Off event applies forever; a Recurring one applies
for a single month.

The cause is three lines, `scenarioHelper.ts:523-526`:

```ts
const duration = Number(e.Duration) || 1;
const endMs = addMonths(parse(e.Month, 'yyyy-MM', new Date()), duration).getTime();
if (e.Duration !== 'one-off' && currMs >= endMs) return false;
return true;
```

- For `'one-off'` the guard's first term is **false**, so the early return never
  fires and the event applies in every month from its own onward.
- For `'recurring'`, `Number('recurring')` is `NaN`, so `|| 1` gives a **one
  month** window and the event is dropped from the second month.

The field is a two-value enum (`'one-off' | 'recurring'`, `forecast.ts:417`),
so `Number(e.Duration)` can never be anything but `NaN` — the `duration`
variable is dead in every real case. What-If's equivalent is two lines and
correct (`WhatIfTab.tsx:1751-1752`).

**This is pre-existing and independent of D5-14.** It is not caused by the
anchored-delta work and would not be fixed by it. It misreads **every existing
save carrying a pricing event**, in the exactly-backwards direction, on the
Compare tab.

**It is also a decision, not a repair I should make unbriefed:** correcting it
changes the Compare figures of every such save, which is the same class of
change D5-14 itself required a recorded decision for.

## 3. What this means for the divergence

The 0854 report said What-If and Compare disagree because Compare carves no
pool. That is true but incomplete, and the sharper statement is:

- **What-If** applies a One-Off in one month and carves a decaying, anchored
  pool that reaches Base at T+1.
- **Compare** applies a One-Off in *every* month, applies a Recurring in
  *one*, carves no pool, and has no Base line to show it on.

So closing the divergence is not one change but three — the pool, the duration
inversion, and a comparable quantity to assert on. Only the first was briefed.

## 4. Gate

| check | result |
|---|---|
| `npm run suite` | **61/61 green** |
| `git status` (src) | **clean — no code written this session** |

No guard-traps: nothing was added and no tracked source changed. Trap ids 199+
remain unused and `next free trap id` is unchanged.

## Limits

- **Items 2, 3 and 4 were not reached** — no card control, no locale keys, no
  mounted re-runs of the five cases 0854 left, no traps. The seven traps the
  brief named still do not exist, so a regression to a frozen rate would still
  pass the suite.
- **The duration measurement is Compare's `adjustedArpu`, a blended figure.**
  It shows the pattern beyond doubt; it is not comparable to What-If's Base ARPU
  for magnitude, which is the whole point of item 1's obstacle.
- **I did not verify the inversion against a mounted Compare tab**, only through
  `computeScenarioForFilter` on the save's own rows — the real engine, but not
  the rendered panel.
- **The What-If half shipped at `fa8c4ff` stands and is gated.** Nothing in this
  session touched it; the divergence it introduced is still open, and is now
  better understood rather than closed.

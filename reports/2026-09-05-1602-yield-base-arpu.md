# The yield pool's Base ARPU contribution, by hand; KPI precision; a suite runner

__ADVISOR__

## Base check

`git diff --stat 6802cba..HEAD -- src/ scripts/ test-data/ package.json` EMPTY.
HEAD at entry was `2ec0192`, the 0747 report commit. The STOP did not fire.

## Item 1 — the yield pool verified by hand (NEVER-SHED)

### The arithmetic, taken from the source rather than assumed

The base term takes the pools the lag has **delivered** (`eventMonthIdx < idx`),
sets `naturalVolume = newBAdj − Σ size`, and `scenarioAdjustedArpu` returns
`(baseArpu × natural + Σ size×rate) / newBAdj`. Subtracting the baseline
`baseArpu` collapses that to

```
Base ARPU delta = Σ delivered size × (rate − baseArpu) / stock
```

which is the formula every figure below is computed from — the brief's own
formula, derived rather than accepted.

### The fixture, and why its inflow varies

The yield pool is built from the **previous** month's natural inflow
(`p_prevBBaseIn`, `eventMonthIdx = idx − 1`). On a fixture whose inflow is
constant, "previous month" and "this month" are the same number, so a pool
sized from the wrong one is **unobservable** — the vacuous-result trap, in the
exact shape that made trap (b) plant green in the 1526 session.

So leaf A carries **200 / 300 / 400**, and the fixture asserts its own inflows
are distinct before anything is concluded from it.

Two horizons, because the KPI reads the **last** month only: a two-month store
puts T+1 last, a three-month store puts T+2 last.

### The yield event, and its rate

```
mix 25 / 75 over bands at 40 and 10
  raw blend      0.25×40 + 0.75×10 = 17.50
  equal weight   (40 + 10) / 2     = 25.00
  ratio          17.50 / 25.00     = 0.70
  pool rate      fitted inflow ARPU 22 × 0.70 = 15.40
```

15.40 is below the fitted **base** blend of 20, which is what makes the
contribution negative — the sign is a consequence of the mix, not an artefact.

### The result: every hand figure matches

| | stock | delivered pools | hand | rendered |
|---|---|---|---|---|
| **T+1, leaf** | 10,400 | 200 | **−0.088462** | **−0.09** |
| **T+2, leaf** | 10,700 | 200 + 300 | **−0.214953** | **−0.21** |
| **T+2, All** | 23,100 | 1,000 + 1,100 | **−0.418182** | **−0.42** |

The stocks are the engine's own recursion, by hand:
`10000 + 200 = 10200`, `+200 = 10400`, `+300 = 10700`. Two pools are delivered
by T+2 because the event rolls forward: one pushed at idx 1 sized from idx 0's
inflow, one pushed at idx 2 sized from idx 1's.

The All row is not a second typed number — the aggregate's inflows
(1,000 / 1,100 / 1,200) and seed (20,000) are **read from the resolved
aggregate** and put through the same formula, so it checks the engine's ARPU
against an independently computed one.

**T+1 and T+2 are asserted to differ**, so a defect that is constant in time
cannot satisfy both checks with one number.

### Therefore the save's −0.27 is the same arithmetic on the save's numbers

The mechanism is verified. `Σ delivered × (rate − baseArpu) / stock` is what
the engine computes, and on a fixture where every quantity is known it agrees
with hand arithmetic at three different views and two different months. The
0747 session's −0.27 was that formula on the save's own mix, stock and fitted
base blend. **The save was not re-run** — the brief asked for the arithmetic to
be verified, not the figure to be reproduced again.

### Trap 156 — RED

```
view-apply-mounted spec: 103/106 passed
  FAIL  yield: BASE ARPU at T+1 equals the hand figure
        [rendered -0.13 vs hand -0.088462 — 200 x (15.40 − 20) / 10400]
  FAIL  yield: BASE ARPU at T+2 equals the hand figure
        [rendered -0.3 vs hand -0.214953 — (200 + 300) x (15.40 − 20) / 10700]
  FAIL  yield: BASE ARPU at ALL equals the same formula on the aggregate
        [rendered -0.46 vs hand -0.418182]
```

The defect's readings are **−0.13 and −0.30**, which the spec prints before the
plant as the predicted current-month values (−0.1327, −0.3009). Two known
numbers on each side.

## Item 2 — the KPI subtracts, then rounds

`impactSummary` read the two **chartData columns**, and those are rounded to 2dp
at source because they are chart and export values. It now reads the unrounded
pair those columns were rounded *from*: the adjusted rate is
`adjustedMonths[i].scenarioArpu[key].arpu`, the baseline is the forecast band's
own mean. **The columns are untouched** — they are pinned by their own checks
and are what the export carries; only this consumer stops going through them.

Absence still travels, and now from the source rather than from a rounded copy.

### The fixture is built so the two paths disagree

A base ARPU of exactly 20 would **not** show it: 20.000 and 20.006 round to
20.00 and 20.01, so the old subtraction lands on 0.01 by luck. At **19.996**
both sides round to 20.00 and the movement disappears entirely.

| true delta | old path | new path |
|---|---|---|
| 0.004 | 0.00 | **0.00** — below what two decimals express |
| 0.006 | 0.00 | **0.01** |

The 0.004 case is asserted too, so the new path is not mistaken for "always
shows more": it shows the truth, and here the truth rounds to nothing.

The mix share needed for each target delta is **solved for** in the spec
(`rate = 22 × 2p/100`, so `p = rate × 50/22`) rather than typed as a magic
number.

### Trap 157 — RED

```
view-apply-mounted spec: 107/108 passed
  FAIL  precision: a true delta of 0.006 reads 0.01, NOT 0.00
        [0 — 0.00 means the pair was rounded before it was subtracted]
```

Only that check fires; the 0.004 case stays green under both paths, as designed.

### A check was edited, and why

`spec:applied-count` went red the moment the suite runner ran:

```
applied-count spec: 15 passed, 1 failed
  FAIL CARD: the memo depends on adjustedMonths, not on the array length
```

It pins the dependency array as a **literal**, and the memo now reads
`baseForecast`, so the read-set rule (D3-04) requires it there. The check was
**re-aimed, not loosened**: the new literal is pinned exactly, so it is as
strong as before, and a second check was added that it still does not key on
`marketEvents.length`. 15 → **17**.

**The suite runner found this, and nothing else would have.** I had re-run
`spec:view-apply-mounted` after the Item 2 change and it was green; the
regression was two files away.

## Item 3 — the suite runner and spec:survival

### `npm run suite`, committed

`scripts/suite.ts`. Runs every `spec:*` script in `package.json` **serially**,
captures each to a file under the OS temp directory (not the repo), and
classifies each into **three** states rather than two — the lesson guard-traps
learned as CRASHED:

| state | meaning |
|---|---|
| GREEN | exit 0 **and** a terminal report line |
| FAILED | non-zero **and** a terminal report line |
| CRASHED | **no report line**, however it exited |

A spec that dies before it reports has not failed; it has said nothing, and a
runner keying only on exit code cannot tell those apart.

**The sentinel accepts two shapes because the suite genuinely has two** — most
specs end `<name> spec: N passed, M failed` or `N/N passed`, while
`spec:i18n-scan` ends with a `PASS:` paragraph. Both were measured. A third
shape will read as CRASHED and say so rather than being swallowed by a looser
pattern.

**guard-traps stays a separate step**, deliberately: it mutates tracked source,
so a suite that could interleave with it would be reading files mid-plant.

```
59/59 green
```

**That is the "full suite" figure from now on**, and it is 59 rather than 58
because `spec:survival` joins it.

### `spec:survival` — 91, not 87

Counted again, not carried forward. **91 first-row dereferences across 24
files**, pinned per file, exact in both directions.

| file | sites | | file | sites |
|---|---|---|---|---|
| churn-fold-spec.ts | 27 | | percentage-events-spec.ts | 6 |
| derived-interaction-spec.ts | 7 | | step1-selection-spec.tsx | 6 |
| amount-control-spec.ts | 6 | | compare-events-panel-spec.ts | 5 |
| base-seed-spec.ts | 4 | | unscored-row-spec.tsx | 4 |
| event-roundtrip-spec.ts | 3 | | 15 files at 1–2 | 23 |

**The 1327 report's 87 was a different count** — taken by hand, before three
sessions added specs. The file says so, and says to recount rather than adjust
the total to make it pass.

**Two things it deliberately does not claim.** It does not distinguish
*guarded* from *unguarded*: that needs flow analysis, while "does this site
exist" needs a regex, and the value is that a new one cannot appear silently.
And it strips comments first — **measured**: without stripping, this very file
counted two sites in its own prose, and a counter that fires on a comment edit
is one that gets adjusted to pass. No other file had prose false positives
(91 stripped vs 93 raw, and the difference is entirely this file's two
examples).

## Gate

```
guard-traps: 153/153 caught, no MISSED, no INCONCLUSIVE, no CRASHED
full suite:  59/59 green   (npm run suite - the committed runner)
anchors:     164/164 (153 traps, 160 anchors)
tsc:         clean
build:       clean
```

Serial, guard-traps first and alone. Its output went to a FILE, so both new
traps are quoted from the run rather than inferred from the exit code:

```
[CAUGHT] 156 the yield pool re-prices THIS month instead of last
         - Base ARPU is computed over subscribers the lag has not delivered
[CAUGHT] 157 the per-scenario delta is rounded before it is subtracted
         - a true movement of 0.006 disappears entirely at a baseline of 19.996
```

## Limits of this check

- **The save was not re-measured.** Item 1 verifies the arithmetic on a known
  fixture and reasons that the save's −0.27 is that arithmetic on the save's
  numbers. That is the brief's instruction, and it is an inference, not a
  measurement of the save.
- **The yield RATIO is not verified against a walk.** The mix→ratio→rate chain
  is exercised at one mix (25/75 over 40/10) and one fitted inflow ARPU (22).
  A mix whose bands carry unequal counts, or a forecast-scaled
  `tariffBaseArpu`, is reasoned from the code rather than driven.
- **`spec:survival` counts text, not syntax.** Its comment stripper is a
  regex, so a `//` inside a string literal takes the rest of that line with it.
  Stated in the file; an AST pass would be a second parser to keep in step.
- **The suite runner's sentinel is a pattern, not a contract.** A spec that
  prints a report line and then dies would read GREEN if it also exited 0.
  Nothing enforces that the line's numbers are consistent with the exit code.
- **Item 2 changed one consumer only.** Any other reader of the 2dp columns
  still gets 2dp — including the export, deliberately.
- **No walk, no browser.** Everything is the mounted card on constructed
  fixtures.

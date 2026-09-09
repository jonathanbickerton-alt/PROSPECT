# Two yield events on one cohort-month — read-only inventory

```
FOR ADVISOR
Generated: 2026-09-09 19:27 +0100 (UTC 2026-09-09 18:27)
Certifies: e5e1656 (docs only; everything after it is read-only)

BASE 9118678 + 355925e (reports/ ONLY fill; stated).
0 DOCS e5e1656 — D5-11 and D5-12 closing paragraphs, verbatim, nothing
  else. Committed and pushed before the read-only work began.
1 ONE SORT KEY, NO TIEBREAK, THREE SITES: b.month.localeCompare(a.month)
  [0] at WIT:1461 (site 2), WIT:1679 (site 5), sh:393 (site 10; Compare
  has NO retention site). Scope plays NO part — a boolean FILTER, never a
  rank. On equal months the comparator returns 0, so INPUT ORDER decides;
  measured: reversing the array flips the winner.
2 MEASURED: the SAVED "test save W3" WINS at Oct 2026 — yieldsForRun
  appends the draft LAST (WIT:3270), both are 2026-09. Its ratio 0.946790
  = -5.32%; Jon reads -5.26%; a 1.9 draft would read ~+90%. THE DRAFT
  CANNOT WIN A TIE, by position alone.
3 EFFECT after save: winner ARPU (rule 3), loser SUPERSEDED (rule 4).
  Both correct — the column already tells the truth the card does not.
4 The box shows the WINNER's figures, which ARE the chart's: not wrong
  about the CHART, wrong about the DRAFT. NOTHING says so. ASYMMETRY: on
  EDIT excludeYieldId drops the saved event, so only ADD misleads.
5 (a) 3 sites + a new rank; (b) 3 sites + a NEW SHEET COLUMN (no
  ordinal exists); (c) 1 card + 1 key x6; (d) capability change.
  CHANGES EXISTING SAVES: (a) YES, (b) YES — today is FIRST-saved-wins,
  so (b) REVERSES it — (d) YES. (c) NO.
```

## 0. Docs

`e5e1656` appended the two closing paragraphs — D5-11 `CLOSED 6538350` and
D5-12 `CLOSED 9118678` — verbatim as briefed, and nothing else. Committed and
pushed before any of the read-only work below.

## 1. How the winner is chosen

**Three sites, one expression, no tiebreak.**

| site | file:line | population |
|---|---|---|
| 2 | `WhatIfTab.tsx:1461` | Inflow yield, What-If engine |
| 5 | `WhatIfTab.tsx:1679` | Retention yield, What-If engine |
| 10 | `scenarioHelper.ts:393` | Inflow yield, Compare |

All three are the same line:

```ts
.sort((a, b) => b.month.localeCompare(a.month))[0]
```

**Compare has no retention site.** Retention yield ids are collected into
`notAppliedHereIds` (`ScenarioCompareTab.tsx:172-174`) and the EFFECT column
renders *not applied here* for them.

**The sole sort key is `month`, descending.** Its comment says what it is for —
*"If multiple roll-forward events overlap, use the most recent"* (`:1460`) — and
that is the case it was written for: a roll-forward event from an earlier month
must not beat a later one. It was never a rule for two events **in the same
month**.

**There is no tiebreak.** On equal months the comparator returns `0`. `Array.
prototype.sort` has been stable since ES2019, so the input order survives and
`[0]` is simply **the first matching event in the array**. Measured rather than
assumed:

```
comparator on equal months: 0
WINNER at Oct 2026: SAVED test save W3
reversed input -> DRAFT (SOHO/Mobile Voice)
```

Reversing the array flips the winner. Nothing else in the expression can.

**Scope plays no part whatsoever.** It is a **boolean filter** — an event either
reaches the sort or it does not (`eventScopeMatchesView`, `:1445-1451` at site 2,
`:1668-1673` at site 5). An event scoped to one leaf and one scoped to `All`
arrive at the sort as equals. There is no specificity rank anywhere in the
codebase to appeal to.

**Where the array order comes from** matters, because it is now the deciding
factor:

- **What-If:** `yieldEvents` in insertion order — so, in practice, **the
  earliest-saved matching event wins**.
- **The preview:** `yieldsForRun` (`WhatIfTab.tsx:3270`) is
  `[...yieldEvents, ...(yieldDraft ? [yieldDraft] : [])]` — **the draft is
  appended last**, so a draft can never win a tie.
- **Compare:** `Yield_Events` sheet row order.

## 2. Measured

**On Jon's 09 Sep save, plus a spliced Inflow draft scoped SOHO / Mobile Voice,
Sep 2026 — the SAVED event wins at Oct 2026.**

The save holds one yield event: `test save W3`, **Inflow**, month **2026-09**,
`Roll_Forward: No`, scope **All / All / All**. At Oct 2026 the engine's
`prevMonthKey` is `2026-09`, so:

- both events pass `ye.ibro === 'Inflow'`;
- both pass the scope filter — the saved one because `All` matches everything,
  the draft because the view *is* SOHO / Mobile Voice;
- both satisfy `ye.month === prevMonthKey`;
- both carry `2026-09`, so the sort cannot separate them;
- `yieldsForRun` put the draft **last**, so `[0]` is the saved event.

**The arithmetic confirms it.** Running the engine's own ratio expression on the
saved event's stored mix and rates:

| | |
|---|---|
| raw blended (share-weighted) | 21.1174 |
| equal-weight stored | 22.3042 |
| **ratio** | **0.946790 → −5.32 %** |

Jon reads **−5.26 %**. A draft at ratio ~1.9 would read about **+90 %**. The
figure on screen is the saved event's, beyond any doubt.

**And the Retention case corroborates it from the other direction.** There is no
saved Retention yield event, so a Retention draft is the only candidate, wins
uncontested, and previews +82.73 %. The two observations are one mechanism.

## 3. The EFFECT column after save

`effectStatusOf` (`forecasting.ts:1036-1069`) is rule-ordered, and both rows
land correctly without any change:

| row | rule | value |
|---|---|---|
| `test save W3` (winner) | 3 — `appliedArpuIds.has(id)` | **ARPU** |
| the new event (loser) | 4 — `arpuCandidateIds.has(id)` | **Superseded** |

Rule 4's own comment describes exactly this case: *"A yield event that reached
the sort in some month and never won it."* Both events are `Roll_Forward: No` at
2026-09, so each is a candidate in exactly one month and the loser is superseded
everywhere it appears.

**So the table already tells the truth the card does not.** D5-09B built
`arpuCandidateIds` for precisely this, and it works — the gap is that the user
finds out *after* saving, from a different control.

## 4. The preview box when the draft is not the winner

**It shows the winner's figures, and says nothing.**

`yieldPreview` (`:3353-3395`) reads `Inflow ARPU (Baseline)` and
`(Adjusted)` out of the series `computeAdjustedForecast` returned for
`yieldsForRun`. Those columns are the *chart's*, and the chart reflects whichever
event won. So the box is **not wrong about the chart** — it is wrong about **the
draft**, which is a sharper failure than an incorrect number: every figure it
shows is real, and none of them is the thing the user is editing.

There is no signal. The card carries `yield-preview-baseline`,
`-adjusted`, `-pct` and `-absent` (`:8930-8955`); `-absent` fires only when the
slice has **no forecast at all**. Nothing anywhere in `WhatIfTab.tsx` renders a
superseded or lost-tie state — the only two occurrences of the word are engine
comments at `:1682` and `:1757`.

**One asymmetry worth knowing.** The preview passes
`excludeYieldId = editingYieldId ?? null` (`:3372`). When the user is **editing**
the saved event it is dropped from the list, the draft stands alone and wins,
and the box is correct. The failure is specific to **adding a second** event on a
cohort-month — which is exactly what Jon did.

## 5. Options

### (a) Most-specific scope wins, ties by latest saved

**Sites:** the three sort sites (`WhatIfTab.tsx:1461`, `:1679`,
`scenarioHelper.ts:393`) plus **one new shared rank function** — there is no
specificity ordering in the codebase today. The rank would run over the five
dimensions a yield event carries: `segment`, `product`, `channelL1`,
`channelL2`, `tariffScope` (no `productL2` — `YieldEventLike` has none).

The "ties by latest saved" half inherits option (b)'s problem below.

**Changes existing saves: YES.** Any file with a narrow event and a broad one on
the same cohort-month flips, wherever position currently favours the broad one.

### (b) Latest saved wins

**Sites:** the same three, **plus a new sheet column and its reader/writer** —
`yieldEventExportRow` (`forecasting.ts:1552-1576`) carries no ordinal at all.
`Market_Events` has `Sequence`; `Yield_Events` has nothing equivalent, so
"latest" has no persisted meaning and would have to be created. Relying on array
or row order instead is what already happens, by accident.

**Changes existing saves: YES, and it reverses today's behaviour.** Insertion
order means the **first**-saved matching event currently wins; (b) makes it the
last.

### (c) Block a second yield event on a cohort-month, with a rendered reason

**Sites:** the Value card's save path — one guard beside the existing block
reasons — plus **one locale key in six locales**. D5-05's shape, where the bar
states its own reason.

**Changes existing saves: NO.** It prevents new collisions; a file that already
holds two behaves exactly as it does today. That makes it the only option that
is safe to ship without re-validating existing work — and the only one that does
not answer the question, merely refuses it.

### (d) Apply both

**"Both" has no defined meaning at the pool, and that is the finding.** The
engine builds **one** synthetic pool per month from `p_prevBBaseIn` at **one**
`yieldArpu` (`:1491-1500`). Two events could mean:

- **compounding the ratios** (`0.9468 × 1.9`) into a single rate — arithmetically
  easy, but it says a cohort was re-mixed twice, which is not what the user
  described;
- **splitting the inflow between two pools** by scope — the honest reading, and
  the engine has **no basis for the split**: scope is a filter, not a share, and
  nothing tells it what fraction of SOHO / Mobile Voice inflow sits inside the
  narrower event.

**Sites:** the three winner sites become multi-winner, the pool construction at
`:1491` and `:1704` and `sh:400`, `appliedArpuIds` semantics (currently "the
winner"), and rule 4 of `effectStatusOf`, which exists only because a month has
exactly one winner.

**Changes existing saves: YES**, for every file holding two matching events.

## Limits

- **Read-only after `e5e1656`.** No spec was run, no guard-traps, no suite —
  the brief excluded them. So the option costings are read from the code, not
  demonstrated by building any of them.
- **The −5.32 % is the pool ratio, not the rendered pair.** Jon's box reads
  10.65 → 10.09 (−5.26 %). I computed the saved event's ratio and the fitted
  levels; the small residual is the pool blending with the rest of the month's
  inflow and with the save's twelve market events, which I did not model. It is
  not enough to change the conclusion — a 1.9 draft would read about +90 % — but
  the two figures are not the same measurement.
- **The draft's ~1.9 ratio is Jon's, taken as given.** I did not reconstruct the
  draft mix that produces it.
- **No spec covers the tie.** Nothing asserts which of two matching yield events
  wins, in either engine, so all four options would be changing behaviour that
  is currently unpinned.

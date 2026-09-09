# Two Inflow yield events, measured through both engines

```
FOR ADVISOR
Generated: 2026-09-09 19:36 +0100 (UTC 2026-09-09 18:36)
Certifies: e5e1656 (the docs commit — ALREADY APPLIED, see item 0)

BASE 9118678 + e5e1656 (DOCS; NOT reports-only, it IS item 0) + 2 reports.
0 DOCS ALREADY DONE at e5e1656, verbatim; NOT re-added. FILENAME 1936
  not 09-10 — the stamp is COMMAND-SOURCED (CLAUDE.md).
1 FILTER roll? month<=prev : month===prev — a NON-roll event is a
  candidate in ONE month. SORT b.month vs a.month, [0]; NO TIEBREAK, and
  scope is a FILTER not a rank. WIT:1452/1461, 1674/1679, sh:383/393.
2 MEASURED through BOTH REAL ENGINES, SOHO/Mobile Voice. TIE BITES ONCE:
  month  winner        What-If InflowARPU      Compare blended ARPU
  Oct26  test save W3  10.65 -> 10.09  -5.26%  13.7411 -> 13.6560 -0.62%
  Nov26  inflow draft  10.70 -> 20.68 +93.27%  13.8453 -> 15.1078 +9.12%
  Dec26  inflow draft  10.73 -> 20.72 +93.10%  13.9079 -> 16.4325 +18.15%
  Jan27  inflow draft  10.73 -> 20.74 +93.29%  13.9686 -> 17.6555 +26.39%
  BOTH ENGINES AGREE ON THE WINNER EVERY MONTH; -5.26% reproduced EXACTLY.
3 EFFECT = arpu for BOTH (via effectStatusOf): rule 4 NEVER fires, each
  wins somewhere. Nothing reports the Oct clash: status is per-EVENT.
4 The Inflow preview reads the month AFTER its own = Oct, THE ONE MONTH
  IT LOSES; Nov would read +93%. Card silent. CORRECTION to 1927:
  excludeYieldId does NOT rescue EDIT; the rival is a DIFFERENT event.
5 (a) 3 sites + rank, CHANGES SAVES; (b) 3 sites + NEW COLUMN, CHANGES
  SAVES (reverses first-wins); (c) 1 guard + key x6, REFUSES this working
  file; (d) seam :3302 + memo + key x6, NO engine change. ONLY (d) fits.
```

## 0. Docs

**Already applied.** `e5e1656`, last session, carries both paragraphs verbatim —
D5-11 `CLOSED 6538350; walked by Jon 2026-09-09: Forecast basis default…` and
D5-12 `CLOSED 9118678; walked by Jon 2026-09-09: 4 · 3 moving volume…`. I
checked before writing and did **not** re-append: a second copy of a closing
paragraph is a change to the record, not the record.

So this session commits its skeleton and this report, and nothing else. It
certifies `e5e1656` as the docs hash the brief asked for.

**One deviation, stated.** The brief named `reports/2026-09-10-HHMM-…`. `date`
reads **2026-09-09 19:36 +0100**, and CLAUDE.md requires the stamp be read from
the clock rather than composed. The file is `2026-09-09-1936-…`.

## 1. How the winner is chosen

Three sites, one shape.

| site | file:line | population |
|---|---|---|
| 2 | `WhatIfTab.tsx:1452-1461` | Inflow yield, What-If |
| 5 | `WhatIfTab.tsx:1674-1679` | Retention yield, What-If |
| 10 | `scenarioHelper.ts:382-393` | Inflow yield, Compare (no retention site) |

**The candidate filter** — the two lines that decide who reaches the sort at all
(`:1452-1453`, and `sh:383-384` in Compare's column names):

```ts
if (ye.rollForward) return ye.month <= prevMonthKey;
return ye.month === prevMonthKey;
```

A **roll-forward** event is a candidate in every month **from** its own month
onwards. A **non**-roll-forward event is a candidate in **exactly one** month.
That asymmetry is what makes this file's behaviour change month to month, and it
is the part the last inventory did not have in front of it.

`prevMonthKey` is the **previous** month at sites 2 and 10 (Inflow enters the
next month's pool) and the **current** month at site 5 (Retention).

**The sort, the tiebreak, the specificity** — unchanged from the 1927 report and
re-confirmed here:

```ts
.sort((a, b) => b.month.localeCompare(a.month))[0]
```

Sole key `month`, descending. **No tiebreak**: on equal months the comparator
returns `0`, the sort is stable, and `[0]` is the first match in the array —
insertion order in What-If, sheet-row order in Compare. **Scope plays no part**:
`eventScopeMatchesView` is a boolean filter (`:1445-1451`, `sh:375-382`), so a
`SOHO / Mobile Voice` event and an `All / All` event reach the sort as equals.
There is no specificity rank in the codebase.

## 2. Measured, per month, in both engines

Both engines run on `PROSPECT Forecast Save — 09 Sep 2026 1930.xlsx` at cohort
**SOHO / Mobile Voice**, with both saved events on. The What-If side is the real
`computeAdjustedForecast` over the `deriveAggregate` of the cohort's leaves;
the Compare side is the real `computeScenarioForFilter` over the raw sheet.

| month | winner | candidates | What-If Inflow ARPU | Compare blended ARPU |
|---|---|---|---|---|
| 2026-10 | **test save W3** | both | 10.65 → 10.09 (**−5.26 %**) | 13.7411 → 13.6560 (−0.62 %) |
| 2026-11 | **inflow draft** | draft only | 10.70 → 20.68 (**+93.27 %**) | 13.8453 → 15.1078 (+9.12 %) |
| 2026-12 | **inflow draft** | draft only | 10.73 → 20.72 (+93.10 %) | 13.9079 → 16.4325 (+18.15 %) |
| 2027-01 | **inflow draft** | draft only | 10.73 → 20.74 (+93.29 %) | 13.9686 → 17.6555 (+26.39 %) |

**−5.26 % at October is reproduced exactly** — it is Jon's figure, from the real
engine, and it belongs to `test save W3`.

**Why the tie bites exactly once.** `test save W3` is `Roll_Forward: No` at
2026-09, so `ye.month === prevMonthKey` makes it a candidate **only** at October.
`inflow draft` is `Roll_Forward: Yes` at 2026-09, so it is a candidate from
October onwards. They collide in October alone — and October is the month the
non-roll-forward event wins, on row order.

**Both engines choose the same winner in every month.** The magnitudes differ
because the two columns are different measures — What-If's is Inflow ARPU, the
band the yield pool sets directly; Compare's `adjustedArpu` is the blended ARPU
across the whole base, so the same pool moves it less at first and more as the
pool accumulates. Different quantities, one selection rule.

## 3. The EFFECT column after save

**Both rows read `arpu`.** Measured by calling `effectStatusOf` on the real
unions rather than reasoning about it:

```
appliedArpuIds : test save W3, inflow draft
arpuCandidates : test save W3, inflow draft
test save W3     -> arpu
inflow draft     -> arpu
```

Rule 3 (`appliedArpuIds.has(row.id)`, `forecasting.ts:1058`) fires for both,
because the unions are taken **across all months** and each event wins at least
one. Rule 4 — **Superseded** — is therefore never reached.

**That is correct, and it is also the whole problem.** Each event genuinely does
move the ARPU path somewhere, so "ARPU" is true of both. But nothing in the
column, the card, or the chart says that in **October** one of them displaced the
other. The status is per-event; the collision is per-month; and the model has no
place to put a per-month fact about an event that won elsewhere.

This is a different answer from the one the 1927 inventory predicted, and the
reason is the roll-forward flag: there, the loser lost everywhere and read
*Superseded*; here it wins from November and reads *ARPU*.

## 4. The preview box when the draft is not the winner

**It reads the one month the draft does not own.**

`yieldPreview` (`:3353-3395`) picks the month it reads by IBRO:

```ts
const wanted = draft.ibro === 'Inflow'
  ? (series.find((r: any) => r.month > draft.month)?.month ?? draft.month)
  : draft.month;
```

For an Inflow draft at 2026-09 that is **2026-10** — correct, because that is
where an Inflow yield lands. It is also, on this file, precisely the month where
`test save W3` beats it. Had the box read November it would have shown **+93 %**.

**Nothing on the card says so.** The box renders baseline, adjusted and percent
(`:8930-8955`); `yield-preview-absent` fires only when the slice has no forecast
at all. The two occurrences of "superseded" in `WhatIfTab.tsx` (`:1682`,
`:1757`) are engine comments.

**Correction to my 1927 report.** I wrote there that the edit path is safe
because `excludeYieldId` drops the event being edited. That is true and
irrelevant here: it removes only *that* event, and the rival is a **different**
one. On this file the collision survives both the add path and the edit path.

The seam is also why option (d) is small: `eventScopeSeriesFor` returns
`.chartData` **only** (`:3302`), so the winner is computed and discarded one line
before the card could read it.

## 5. Options

### (a) Most-specific scope wins, ties by latest saved

**Sites:** the three sort sites, plus a **new shared specificity rank** over the
five dimensions a yield event carries (`segment`, `product`, `channelL1`,
`channelL2`, `tariffScope` — `YieldEventLike` has no `productL2`). The tie half
inherits (b)'s missing ordinal.

**Changes existing saves: YES.** On this very file October flips from −5.26 % to
the draft's ratio, because `SOHO / Mobile Voice` outranks `All / All`.

### (b) Latest saved wins

**Sites:** the three sort sites, plus **a new sheet column with its writer and
reader** — `yieldEventExportRow` (`forecasting.ts:1552-1576`) carries no ordinal;
`Market_Events` has `Sequence`, `Yield_Events` has nothing equivalent.

**Changes existing saves: YES, and it reverses today's rule.** Insertion order
means the **first**-saved matching event currently wins.

### (c) Block a second yield event on a cohort-month, with a rendered reason

**Sites:** one guard on the Value card's save path beside the existing block
reasons, plus one locale key in six locales. D5-05's shape.

**Changes existing saves: NO** — but note it would have **refused this file**,
which is a working scenario: the two events do not actually conflict in eleven
of the twelve months they span. Blocking is the only option that costs the user
a capability.

### (d) The preview names the winner when the draft is not it

**Sites, and it is the smallest of the four:**

- `WhatIfTab.tsx:3302` — the seam returns `.chartData`; also return the
  winner for the month it read, from `adjustedMonths[i].appliedArpuIds`, which
  the engine **already computes**. The Pricing card's two callers ignore the
  extra field, so they stay byte-identical.
- `yieldPreview` (`:3353-3395`) — compare that id against the draft's.
- One locale key in six locales.

**No engine change. Changes existing saves: NO** — nothing about any forecast
moves; the card stops mis-attributing a figure.

**This is the only option that addresses what Jon actually saw.** (a) and (b)
change which event wins, which is a forecast-behaviour change on every existing
file; (c) forbids the scenario; (d) leaves the answer alone and stops the card
claiming it as the draft's.

## Limits

- **Read-only; no gate.** No suite, no guard-traps, no spec run — the brief
  excluded them. The option costings are read from the code, not built.
- **The two engines' figures are different measures**, as noted: What-If's
  Inflow ARPU against Compare's blended ARPU. They are comparable on the
  **winner**, which is what was asked, and not on the percentage.
- **Market events were excluded from both runs.** The save holds twelve; I
  passed `[]` so the yield selection could be read without other pools moving
  the same columns. That isolates the question and means the printed percentages
  are not what Jon's screen shows for the *chart* as a whole — his −5.26 % for
  the preview box is reproduced exactly, which is the figure at issue.
- **The aggregate is derived here, not restored through the app.** I rebuilt the
  cohort from `Baseline_Forecasts` and called `deriveAggregate`; the app's
  restore path (`App.tsx:760-800`) does more with provenance and keys than this
  harness does.
- **Nothing pins the tie.** No spec in either engine asserts which of two
  matching yield events wins, so all four options would change unpinned
  behaviour.

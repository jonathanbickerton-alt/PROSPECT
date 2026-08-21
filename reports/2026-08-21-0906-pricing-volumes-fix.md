# Pricing weighting volumes — the asymmetry does not exist, and that changes the fix

## FOR ADVISOR

```
Generated: 2026-08-21 09:06 +0100 (UTC 2026-08-21 08:06)
Certifies: none (no source file changed)
Repo: committed <filled below>, pushed (origin in sync)
SKELETON CREATED AS THIS SESSION'S FIRST ACTION, before the base check.
STOPPED AT ITEM 1 BY THE SHED ORDER'S OWN CLAUSE. The mechanism makes the fix
  unsafe for the ARPU constraint, which the brief names as an outcome.
THERE IS NO ARPU/VOLUME ASYMMETRY. computeAdjustedForecast takes ARPU AND all
  three volume terms from the SINGLE baseForecast object. The draft's dims
  enter ONLY via viewScopeForMatch (event matching) and pro-rata leaf weights;
  `data` enters ONLY to build those weights. Same shape as 2233's finding, one
  level up: same source, therefore not separately scopable.
SO THE FIX CANNOT LEAVE ARPU UNTOUCHED. Swapping baseForecast for the
  draft-resolved forecast moves the Preview's baseline ARPU too — approx
  24.74 -> 14.66 on the factbook's slice, about -41%.
AND IT REACHES STORED ROWS: the saved row's Baseline ARPU column reads the same
  figure, so rider 2's "volumes" wording under-describes what would be stored.
RIDER 1 NOT RECORDED. Its substance (all three volume terms event-scoped) is
  confirmed and right; its named implementation carries an ARPU consequence the
  brief separately forbids. Recording it would install an unsatisfiable pair.
RIDER 3 DONE: dated correction note appended to 2033's section 6, append-only.
MY INTENSIVE-VS-EXTENSIVE HYPOTHESIS WAS ALSO WRONG, and measuring is what
  killed it — the arc's record on plausible mechanisms is now 0-for-4.
NO GATE RUN: no source file changed. tsc clean; tree carries reports only.
DECISION NEEDED: option A (fix all four figures), B (two series, volumes only),
  or C (hold). My recommendation is A, in a session briefed for it.
```

---

## Base check

`HEAD` **`0b2d030`**; the scope report's Repo line names **`293485f`**. One commit
apart, `--stat` confirms **report-only** (its own Repo-line fill). Established
drift pattern, flagged and proceeded.

**No source file was modified in this session.** The only repo changes are this
report and the correction note of item 6.

## 1. The asymmetry — measured, and it is not there

### What I was asked to find

The brief states the asymmetry as established: slice-correct **baseline ARPU**
off this path, cohort-scoped **volumes** off the same series, and asks for the
mechanism that separates them. It also warns that this arc is **0-for-3 on
plausible mechanisms**, so I measured before concluding.

### My first hypothesis, and why it died

ARPU is **intensive** (a ratio) and volumes are **extensive** (sums), so a
cohort figure ought to sit close to any slice's ARPU while being wildly off its
volumes. That would explain a walk seeing a believable ARPU beside an
unbelievable volume without any code difference at all.

Measured on the factbook's own save and slice, month 2026-08:

```
ARPU   (intensive)   ALL = 24.74     SLICE = 14.66     ALL is +68.8% off
FLOWS  (extensive)   ALL = 52,660    SLICE = 21,463    ALL is +145.4% off
```

Volumes diverge only **2.1x** more than ARPU, and 68.8% is not "believable" —
a walk would have seen 24.74 where it expected 14-something. **The hypothesis is
refuted.** It is recorded because it was wrong: 0-for-4.

### The mechanism, from the data flow

Both halves of the pricing card already take the **same** feed. The Preview's
baseline ARPU and its volumes both read `previewScopeSeries`:

```ts
const matchRow = previewScopeSeries?.find(r => r.month === newPricingEvent.month);
const baseArpu = matchRow ? matchRow['ARPU (Adjusted)'] : null;
...
volumesFromSeries(previewScopeSeries, newPricingEvent.month)
```

and the save path takes the same series from the same `eventScopeSeriesFor`. So
the two figures come from **one row of one series** — the identical structure
2233 found among the three volume terms, one level up.

Inside `computeAdjustedForecast`, every baseline quantity has one source:

```
m.baseline.arpu       = baseForecast.months[idx].arpu.mean
m.baseline.inflow     = baseForecast.months[idx].inflow.mean
m.baseline.retention  = baseForecast.months[idx].retention.mean
baseARPU              = m.baseline.arpu          // pass 2's starting point
```

The draft's dims do **not** scope that. They build `viewScopeForMatch`, which
decides **which events match**, and they weight `eventProRataShare`. `data` and
the `wi*Col` names enter only through `buildLeaves`, which produces the
**pro-rata leaf weights** — nothing else. There is no ARPU recomputation keyed
on dims anywhere in the function: pass 2's "cohort-pool blended ARPU" blends
*event pools* into the cohort's own ARPU, and `fcCurMonth` is
`baseForecast.months[idx]` again.

**In symbols.** For column c of the series row at month t, given loaded cohort C
and draft scope S:

```
row_t[c] = f_c( baseForecast_C(t) ,  E|S )
```

for every c — ARPU and the three volume terms alike. S enters only through the
matched-event set `E|S`. **Nothing in the signature lets ARPU take S while the
volumes take C.** The asymmetry the brief describes is a state this function
cannot produce.

### So what did the walk see

Two readings fit, and I cannot separate them from the record: the walk that saw
a slice-correct ARPU had **that slice loaded in Step 1** (making C = S, so every
column is slice-correct and nothing is wrong), or the figure came from a
different panel than this one. What I can say from the code is that if the walk
and the 18 Aug save had been the **same** configuration, the ARPU would have
read 24.74, not 14-something.

I did not find a `14.28` in `reports/` — the `14.3888`-family figures there are
**ARPU MAPE percentages** from the accuracy work, not ARPU values, and they are
unrelated. That is worth stating plainly rather than quietly relying on the
brief's premise.

## 2-5. Not built — and the reason is the shed order's own clause

> *If item 1's mechanism makes the fix unsafe for the walked ARPU behaviour,
> STOP and report options — that is an outcome.*

The fix in item 2 is to feed `computeAdjustedForecast` the **draft-resolved**
forecast instead of `baseForecast`. Because every column takes its baseline from
that one object, doing so corrects the three volume terms **and moves the ARPU
in the same motion**. On the factbook's slice the Preview's baseline ARPU would
go from about **24.74 to 14.66** — roughly **-41%**.

That is not a rounding correction, and it does not stay in the Preview: the
saved row's **Baseline ARPU** column reads the same figure
(`WhatIfTab.tsx:4709`), so new rows would store a different ARPU as well as
different volumes. Rider 2 speaks only of volumes, so what would actually be
written exceeds what the rider describes.

**The brief's own two instructions cannot both be satisfied**: rider 1 says fix
it via the shared resolved-forecast helper; item 1 says leave the ARPU untouched
and assert so. Per the reserved-decisions rule, that conflict is the thing to
report rather than the thing to resolve here.

### Why rider 1 was not recorded in EXPECTED.md

Its **substance is right** and 2233 proves it: all three volume terms are
cohort-scoped and should be event-scoped. What is not settled is its **named
implementation**, because that implementation carries a consequence the same
brief forbids. Recording the decision as written would install an unsatisfiable
pair into the file that later sessions treat as settled — the same failure mode
as recording a refuted premise last session, arriving from the other direction.

## The options, with the sizes attached

**A — fix all four figures together.** One feed, one row, structurally clean and
consistent with every other fix in this arc. The Preview and the stored row both
start describing the slice the event actually targets. Cost: the ARPU moves
about -41% on a narrow draft over a wide load, and rider 2 needs restating to
cover ARPU as well as volumes. **My recommendation**, in a session briefed for
it.

**B — volumes only, preserving ARPU exactly.** Achievable by resolving a *second*
series for the draft and taking volumes from it while ARPU keeps coming from
`baseForecast`. It honours the constraint literally, and I would argue against
it: two series for one draft is the "two implementations that happen to agree"
shape this arc has removed four times, and it puts the ARPU and the weights of
one preview panel on different footings — the mixed-axes defect the churn work
named and closed.

**C — hold.** The defect is a display and stored-record error, not an engine
error: the weighting **ratio** moves only 6.05% to 5.95%, so forecasts barely
move. Only the figures shown and stored are wrong, by ~2.5x.

## 6. The correction note — done

Appended to section 6 of `reports/2026-08-20-2033-r7-scope-add-fix.md`, dated,
**append-only**: the original text stands untouched above it so the error and
its correction are both readable. It states what was concluded, what 2233
measured, and where the corrected account lives.

## Gate

```
guard-traps:             NOT RUN — no source file changed
full suite:              NOT RUN — no source file changed
lint (tsc --noEmit):     clean
build:                   NOT RUN — no source file changed
git status:              reports only
```

**Stated rather than skipped quietly.** The tree carries this report and the
correction note; running 105 traps against an unmodified `src/` would re-prove
`0b2d030` and nothing else. Same standing as the 2233 session.

## Where things stand

**Blocked on Jon**, exactly one decision: A, B or C above.

**Nothing is worse than it was.** The volumes are wrong today and remain wrong;
no stored row moved, and the correction note stops the next reader inheriting
the refuted account.

**Open:** DQ, still next-no-exceptions per EXPECTED.md and deferred again; the
customer pipeline (decision 4); the `:512` campaign bar unexercised; the held
tail on the churn ramp, awaiting Alessandro.

## Limits of this check

**The ARPU figures are my blend, not the engine's output.** The save carries 72
leaf cohorts and **no stored aggregate**, so the ALL forecast is derived by
`resolveForecast` at runtime. I volume-weighted `ARPU_Mean` over inflow plus
retention, which is the shape the aggregate uses; the exact derived figure may
differ. The 68.8% gap is far too large for that to change the conclusion, but
`24.74` should be read as approximate and `-41%` as an estimate.

**The walk's configuration is not in the record.** I could not determine which
cohort was loaded when the slice-correct ARPU was observed, and I did not locate
the `14.28` figure in `reports/`. My account of the mechanism rests on the code
and on today's measurement, not on reconstructing that walk.

**Nothing was run in the app.** This is a source reading plus an arithmetic
check against a saved file — the same class of evidence as the two sessions
before it, and the reason both of their leading conclusions needed correcting.
The mount could settle it: driving one narrow draft and reading both figures
would make the whole question observable rather than argued.

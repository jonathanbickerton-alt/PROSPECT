# Pricing weighting volumes — the confirmation step stopped the fix

## FOR ADVISOR

```
Generated: 2026-08-20 22:33 +0100 (UTC 2026-08-20 21:33)
Verified against: 46377e8
Repo: __PENDING__
SKELETON CREATED AS THIS SESSION'S FIRST ACTION, before any check ran.
STOPPED AT ITEM 1 BY THE BRIEF'S OWN CONDITION. The confirmation CONTRADICTS
  session 1's measurement, so nothing was built. NO SOURCE CHANGED, and no
  EXPECTED decision was recorded — its premise is refuted (see below).
THE EXPOSURE IS WIDER, NOT NARROWER. Session 1 reported the BASE term alone as
  unscoped and pricedVol as "scoped and right". BOTH stored figures are the
  LOADED COHORT's, to the penny:
     pricedVol 21,083.33  =  ALL retention 21,083.33   (0.00%)
     totalVol 348,466.54  =  ALL flows + ALL base 348,467 (0.0%)
     the slice's own retention is 8,486.48 — nothing like it
WHY SESSION 1 GOT IT WRONG: the event is a DILUTION, so pricedVol is
  retention ALONE. I compared it against the slice's inflow+retention
  (21,463) and read a 1.8% gap as a match — a COINCIDENCE OF TWO WRONG
  QUANTITIES, and the whole "partial" framing came from it.
THE MECHANISM IS CONFIRMED AND SIMPLER THAN REPORTED: pricedVol and totalVol
  come from ONE pricedVolumesFor call over ONE volumesFromSeries row, so they
  CANNOT be scoped differently. Session 1's claim that one was and one was not
  should not have survived a reading of the call site.
THE FIX SHAPE IS UNCHANGED and corrects all three terms at once — the
  resolved-forecast feed built for churn. Only its DESCRIPTION was wrong;
  restating the decision's scope is Jon's, so it was not built here.
DECISION NEEDED: restate the decision to all three terms, then build.
```

---

## Base check

`HEAD` **`46377e8`**; the edit-path report's Repo line names **`7330e8e`**. One
commit apart, `--stat` confirms **report-only**. Established drift pattern,
flagged and proceeded.

**No source file was modified in this session**, so the brief's *revert clean*
had nothing to revert.

## 1. The confirmation — and what it found

### The call site cannot support the reported split

`handleAddPricingEvent` computes both figures in **one** call:

```ts
const savedVolumes = matchRow
  ? pricedVolumesFor(
      { target, cohortScope: isDilution ? 'retention' : (cohortScope ?? 'both') },
      volumesFromSeries(eventScopeSeries, month) ?? { inflow: 0, retention: 0, base: 0 },
    )
  : null;
```

and `pricedVolumesFor` derives both from that single `v`:

```ts
const totalVol = v.inflow + v.retention + v.base;
const pricedVol = e.target === 'cohorts' ? cohortVol : cohortVol + v.base;
```

`volumesFromSeries` reads `'Inflow (Adjusted)'`, `'Retention (Adjusted)'` and
`'Base (Adjusted)'` off **one row of one series**. **The three terms cannot be
scoped differently** — there is no path by which the flows could be event-scoped
and the base cohort-scoped.

That alone refutes session 1's "partial, the base term only". It should have been
caught there by reading the call site, and was not.

### The measurement, done against the right quantities

```
event "test dilution narrow"   scope All / Mobile Voice / Direct   month 2026-08

STORED    pricedVol =  21,083.33      totalVol = 348,466.54

ALL       inflow = 31,577.08   retention = 21,083.33   base = 295,806
          flows + base = 348,467
SLICE     inflow = 12,976.17   retention =  8,486.48   base = 121,073
          flows + base = 142,536

pricedVol vs ALL retention   ->  0.00%
pricedVol vs SLICE retention -> 148.43%
totalVol  vs ALL flows+base  ->  0.0%
totalVol  vs SLICE flows+base-> 144.5%
```

**Both figures are the loaded cohort's, exactly.** `pricedVol` is ALL's retention
to the penny; `totalVol` is ALL's flows plus ALL's base to the penny.

### Why session 1 concluded the opposite

The event is a **dilution**, so `cohortScope` is `'retention'` and `pricedVol` is
**retention alone**. Session 1 compared it against the slice's **inflow +
retention** (21,463) and read the 1.8% gap as a match.

It is a coincidence: ALL's retention (21,083) and the slice's two flows summed
(21,463) happen to land 1.8% apart in this dataset. **Two wrong quantities
agreeing.** Everything downstream of that — "the priced pool is fine", "the
exposure is partial", "the halves disagree" — followed from it.

The session-1 report hedged the conclusion (*"stated as consistent-with rather
than proven"*), and the hedge was the right instinct pointed at the wrong risk:
the danger was not the residual inference, it was the comparison underneath it.

## 2-5. Not built

Items 2 through 5 are **not done**, per the brief's stop-condition:

> *If the confirmation contradicts the measurement, that is the report — revert
> clean and stop.*

**No EXPECTED decision was recorded either**, and that is deliberate. The brief's
decision text reads *"the pricing weighting volumes' **BASE term** is
event-scoped for new saves"*. Recording it would install a premise this session
just refuted — the base term is not the problem, or rather it is not *only* the
problem. What changes is all three terms.

**The fix shape itself is unaffected.** Feeding `eventScopeSeriesFor` a forecast
resolved on the draft's own key — the helper session 1 built for the churn panel
— corrects `inflow`, `retention` and `base` in one move, because they come from
one row. The shared-helper design, the compat rule, the mount plan and the two
traps in the brief all still hold. Only the sentence describing what is wrong
needs restating, and that sentence is Jon's.

## What would change, if built

Worth stating so the decision has a size attached. On this event, new saves would
store:

```
              stored today        would store
pricedVol       21,083.33            8,486.48     (the slice's retention)
totalVol       348,466.54          142,536        (the slice's flows + base)
```

That is a **2.5× change in the priced pool** and a **2.4× change in the total** —
not a rounding correction. The ratio `pricedVol / totalVol`, which is what the
weighting actually uses, moves from **6.05%** to **5.95%**: close, but the two
figures are also displayed on the row, where they are wrong by a factor of two
and a half.

**Stored rows keep their figures** under the recorded save-time-record semantic,
so nothing rewrites history — which also means old rows and new rows will show
different-looking volumes for the same slice. That is a consequence worth naming
before the fix, not after it.

## Decisions for Jon

1. **Restate the decision to cover all three terms**, then build? The work is the
   same size; only the description changes. My recommendation is yes, and in the
   next session rather than folded into another.
2. **Does the display need a note** distinguishing rows saved before and after?
   The save-time-record rule keeps old figures, and two rows for the same slice
   will disagree by ~2.5× with nothing on screen saying why.
3. **Is the same coincidence lurking in the other direction** — should the
   session-1 report be annotated? It is committed and its §6 states a refuted
   conclusion. I have not edited it; a correction note there would stop the next
   reader inheriting the error.

## Limits of this check

**One event, on one save.** 1349 and 1351 carry the same event, and 2155's
predates the stored fields. The exactness of the two matches (0.00% and 0.0%)
makes a coincidence implausible, but this is one observation, not a survey.

**The base roll-forward is my reconstruction.** I rolled each cohort's seed
forward as the engine does (`b = max(0, b + prevIn - prevOut)`); it is not the
engine's own output. The ALL figure landing on `totalVol − ALL flows` to 0.0% is
what makes me confident the reconstruction is faithful.

**Nothing was run in the app.** This is a source reading plus an arithmetic check
against a saved file — the same class of evidence as session 1's, which is
precisely why the confirmation step existed and precisely why it earned its
place.

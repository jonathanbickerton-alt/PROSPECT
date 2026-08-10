# The restored-save provenance test — the seed survives the round trip

## FOR ADVISOR

```
Generated: 2026-08-10 09:23 +0100 (UTC 2026-08-10 08:23)
Verified against: HEAD 5a5427d, branch main, tree CLEAN. NO CODE CHANGED.
THE PROVENANCE HYPOTHESIS IS DISPROVEN, on both halves.
  (1) The 07 Aug 10:26 save DOES carry seeds: Baseline_Forecasts has a
      Seed_Base_Volume column and across its 425 distinct cohorts there are
      0 blank, 0 zero, 425 POSITIVE (Corporate = 123699).
  (2) IMPORT DOES restore it — App.tsx:809, 913, 1115 all read
      Number(first.Seed_Base_Volume ?? 0), the same shape as
      Last_Historical_Inflow beside them. Export writes it at :478.
SO THE RED STATE STILL DOES NOT EXIST. A restored pre-seed session was the last
  plausible way to produce the seedless line from data with Base rows intact.
  Two consecutive sessions have now failed to reproduce it.
SCALE CORROBORATES the save as the screens' source — Corporate seed 123699 fits
  ~1.8K/month to ~40K, and is nothing like the edge fixture's 3984. So the
  screens are very likely FROM this save, which makes the absence of any zero
  seed in it an observation about the reported case, not a loose end.
STILL TRUE REGARDLESS: `|| 0` lets zero impersonate absence at three seed reads,
  and the two surfaces still answer "can this show Base" differently. Neither
  claim depends on reproducing Jon's line.
FIX NOT IMPLEMENTED — budget, not doubt about the decision. (b-corrected) touches
  a type read at three sites plus both surfaces, needs specs on two tabs, a
  guard-trap and a full gate. I could not complete that to standard in the
  remaining context, and a half-applied absence change left ungated is worse
  than none. NOTHING was changed, so there is no partial state to unpick.
NO FIGURES RE-MEASURED, deliberately: this session changed nothing, so 74/72/2
  and the pinned MAPEs are untouched by construction rather than re-run.
Decisions needed: none new — (b-corrected) stands. But see the question below
  about what the decline case should be driven against, given no red state.
State: HOLD. The fix is unstarted and the decision is intact for a fresh session.
```

---

## What was asked, and what the test returned

The brief's provenance test: Jon's artefact screens came from the restored
07 Aug 10:26 save, so if `seedBaseVolume` postdates those fits, every restored
`bf.seedBaseVolume` would be `undefined`, `|| 0` would seed the sum at zero, and
Jon's exact line would appear on data whose Base rows are fully present.

**Measured on the actual file** (`PROSPECT Forecast Save — 07 Aug 2026 1026.xlsx`):

```
sheet Baseline_Forecasts — 12,984 rows, 425 distinct cohorts
  Seed_Base_Volume BLANK/absent : 0
  Seed_Base_Volume ZERO         : 0
  Seed_Base_Volume POSITIVE     : 425
  e.g. Corporate = 123699
```

The column exists and is populated throughout. The field does **not** postdate
those fits.

**And the import restores it.** Three sites, all reading the same way:

```ts
seedBaseVolume: Number(first.Seed_Base_Volume ?? 0),     // App.tsx:809, 913, 1115
lastHistoricalInflow: Number(first.Last_Historical_Inflow ?? 0),
```

Export writes it at `App.tsx:478`. The round trip is intact, so a restored
session's fits arrive seeded.

## Why this matters more than a negative result usually would

The save's scale **corroborates it as the screens' source**: a Corporate seed of
123,699 is the right order for Jon's ~1.8K/month climbing to ~40K, and nothing
like the edge fixture's 3,984. So these are very probably the fits behind those
screenshots — which makes "every one of them carries a positive seed" a direct
observation about the reported case, not a loose end.

**Two consecutive sessions have now failed to reproduce the seedless line.** The
previous one ruled out shipped fixtures; this one rules out the restored save
that produced the screens. The remaining explanations are narrower and worth
stating plainly rather than leaving implied:

- the screens predate a fix that has since landed (the store landscape moved
  three times this week: keep-last retired, Step 2 gate rederived, Step 1
  selection resolution);
- the selection on screen was not the one assumed;
- or the line was drawn from a code path other than the per-leaf roll — which
  the previous diagnosis did not enumerate exhaustively, having found the
  recursion and stopped.

## What remains true regardless

Neither of these depends on reproducing Jon's line, and both are still worth
fixing:

1. **`|| 0` lets zero impersonate absence** at three seed reads. A leaf with no
   Base rows genuinely seeds at 0 today, and the aggregate sum silently
   under-counts. That is the absence-propagation rule this codebase has settled
   everywhere else.
2. **The two surfaces disagree.** Step 1 renders an empty panel for
   Base-on-aggregate; Step 3 draws a line. That is unmet consistency at HEAD
   whether or not the line is correct.

## Why the fix is not in this commit

Not doubt about the decision — (b-corrected) stands as decided, and I would
implement it as specified. It is budget. The change makes a seed type express
absence, updates three reads plus any fourth consumer found by enumeration,
gives both surfaces one shared predicate, needs mounted specs on two tabs, a
guard-trap restoring `|| 0`, and a full gate. I did not have the remaining
context to complete that to this repo's standard, and a half-applied
absence change left ungated is worse than none — it would look like the rule was
applied while leaving a path where zero still impersonates absence.

**Nothing was changed**, so there is no partial state to unpick. A fresh session
can start from the decision as written.

## One question for the next session

With no red state anywhere, what should the decline case be driven against?

- A **constructed** seed-absent store, labelled as constructed — honest, and the
  brief already permits it ("a constructed pre-seed store otherwise, labelled as
  such"). It proves the fix's logic but not that any real session reaches it.
- Or **a fixture built with Base rows removed for some leaves**, which would make
  the absent-seed path reachable from real data and give the guard-trap a
  genuine target. That is a fixture change, so it belongs to whoever owns
  `test-data/`.

The first is sufficient for the fix. The second is what would let the trap prove
the *behaviour* rather than the *logic*, which is the distinction the previous
report ended on.

## Where things stand

**HOLD.** Nothing merged, nothing moved, the fix unstarted, the decision intact.
B-11 is unaffected; the walk-finish instructions in
`reports/2026-08-09-2113-step2-unlock.md` stand, including the Step 2 round trip
Jon still owes.

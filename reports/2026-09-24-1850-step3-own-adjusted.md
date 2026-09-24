# REQ-D7-02 session 2 — STOPPED at Item 1: the seam cannot yield Step 3's adjusted means

## FOR ADVISOR

```
Generated: 2026-09-24 19:52 +0100 (UTC 2026-09-24 18:52)
Certifies: none (nothing built; src at 8ccee41, unchanged)
Repo: committed 4ae4148 (report only), pushed (origin in sync)
Clauses 8-10 alone: bd0d668. Skeleton 9245ae5. Base clean, quoted s.0.
STOP, per the brief: eventScopeSeriesFor cannot yield the per-month
adjusted means the table scores against. It lacks two things:
1 REACH: it is a useCallback INSIDE WhatIfTab (WhatIf:3832), closed over
Step 2's own state (events, data, columns, resolveForecast). It is not
exported, and WhatIfTab is not mounted on Step 3, so FVA cannot call it.
2 SHAPE: it returns run.chartData (WhatIf:3954) - every column rounded
+x.toFixed(2) - and an ARPU pair for Inflow/Retention only. It does NOT
return run.adjustedMonths, whose uplifted {inflow,outflow,retention,arpu}
is exactly what adjustedMeanMap is built from. Its 'ARPU (Adjusted)'
column is pricingARPU, not uplifted.arpu.
Nothing else built: the clause-8 carry, the actuals_clear retirement, the
mounted cases and traps 287-289 were all withheld with the view's run.
Decision needed from Jon (s.2): (A) extract the seam to a module-level
function that also returns adjustedMonths - Step 3 becomes caller 6,
engine stays 6; or (B) a 7th computeAdjustedForecast site in FVA
(clause 5 allowed it). The clause-8 carry does not depend on either.
```

## 0. Base

Quoted before any change:

- `git status --short` — empty.
- `git diff 8ccee41 HEAD --stat -- src` — empty.
- `git diff 8ccee41 HEAD --stat -- scripts` —
  `scripts/guard-traps-ledger.json | 286 +++++++++++++-----------` (the ledger
  only).

HEAD and origin/main were both `b12e4bc`. Skeleton `9245ae5` came first;
clauses 8-10 were then committed alone as `bd0d668` and pushed. They stand as
recorded decisions whatever is decided next.

## 1. What the seam lacks

**The requirement.** Step 3's table and cards score against `adjustedMeanMap`:
per month `{ inflow, outflow, retention, arpu }`, built from
`adjustedForecast.adjustedMonths[].uplifted` (FVA, the memo below
`showAdjusted`). A view's own run must yield those four unrounded per-month
figures.

**Lack 1 — reach.** `eventScopeSeriesFor` is defined at `WhatIfTab.tsx:3832` as
a `useCallback` inside the WhatIfTab component.

- It closes over WhatIfTab's props and state: `marketEvents`, `yieldEvents`,
  `pricingEvents`, `data`, the `wi*` columns and `resolveForecast` (its
  dependency list, `:3958-3961`).
- It is not exported.
- WhatIfTab is mounted only on Step 2 (`App.tsx:4732`, as of 1151).

So FVA cannot become its sixth caller. Getting there means moving it out of the
component.

**Lack 2 — shape.** It returns
`{ series: run.chartData, reason, arpuIdsByMonth, rawArpuByMonth }`
(`WhatIfTab.tsx:3954`). That does not give the four figures:

- `series` is the chart rows. Every column is rounded with `+x.toFixed(2)`
  (the row builder in `computeAdjustedForecast`).
- Its `'ARPU (Adjusted)'` is `pricingARPU`, which is not the `uplifted.arpu`
  the scorer reads.
- `rawArpuByMonth` carries the Inflow and Retention ARPU pair only.
- `run.adjustedMonths` is computed inside and discarded. It holds exactly what
  is needed, unrounded.

**What the seam does have.** The scoping is right for a view.
`resolveEventScopeForecast` (`forecasting.ts:4026`) resolves the draft's own
slice, and the view dims drive event matching (`WhatIfTab.tsx:3906-3937`). A
view scope in the draft shape (`segment`, `product`/`productL2`,
`channelL1`/`channelL2`, `tariffL1`/`tariffL2`) is accepted as it stands.

## 2. The decision this needs (Jon's)

**(A) Extract the seam.**

- Move the body of `eventScopeSeriesFor` to a module-level function that takes
  the scope, the three event arrays, `resolveForecast`, `data` and the
  columns.
- Add `adjustedMonths` to its return, as an additive field so the five existing
  callers read what they read today.
- WhatIfTab keeps a thin `useCallback` wrapper, so its five callers are
  untouched. Step 3 calls the module function as **caller 6**.
- `computeAdjustedForecast` stays **6**, because the one call inside the seam
  moves rather than multiplies.
- Cost: a move of Step 2's most-pinned seam, where specs pin its callers (5) and
  its dependency set. Expected red: the caller-count pins and any source pin on
  its location.

**(B) A 7th engine site.**

- FVA calls `computeAdjustedForecast` directly for the view's resolved
  forecast, with the event arrays passed by prop.
- Clause 5 already allows 7 by decision. Smaller, but it is a second route to an
  adjusted run, beside the seam.

**Either way the clause-8 carry is independent** (load-then-save keeps the
Adjusted rows), and so is the `actuals_clear` retirement. Both were withheld
here only because the brief stops the session. They could land in the next
session with either option.

## 3. What was not done

- Item 1 in full: events by prop, the view's run, `showAdjusted` rewired, the
  `adjustedMeanMap` source, the load-then-save carry, the `actuals_clear`
  retirement, mounted cases (g) to (j), and traps 287 to 289.
- The gate: no suite and no guard-traps run, because no src changed.

**Touched:** this report and `test-data/EXPECTED.md` (clauses 8 to 10, already
committed). No src, scripts, spec or locale file changed.

## Limits

This STOP comes from reading, with file:lines cited. The rounding and the
`pricingARPU` distinction are read from the row builder, not measured against a
run. No seam call was timed; the brief's ms-per-run figure belongs with the
build.

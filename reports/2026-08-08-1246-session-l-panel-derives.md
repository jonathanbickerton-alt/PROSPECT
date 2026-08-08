# Session L — the panel derives

## FOR ADVISOR

```
Generated: 2026-08-08 12:46 +0100 (UTC 2026-08-08 11:46)
Certifies: ec77b34 (merge of session-l-panel-derives at 3d006f4) — MERGED
C-17 classified DESIGN GAP: the gate is in the initial commit (f52b21d), restore came later
Evidence: every restore implementation in history checked — none ever wrote forecastData
So a restored session has NEVER rendered in Step 1; section C reached it first, not J or K
Fix is a deletion not an addition: the panel derives, so there is no writer list to join
Compare mode stays written — a real exception, its series are never store-backed
Latent bug closed with it: written panel state persisted across selection changes
Subsidiary 1: placeholder stands down for covered/blocked/never, not just for a notice
Subsidiary 2: disabled button off red, onto the file's own slate treatment
Subsidiary 3: unfittableLeaves RESETS on restore — deliberate, documented, consequence stated
Trap 33 folded in from the unmerged verification branch; traps 34, 35 added; 28, 31 retired
Gate found 4 things review did not, incl. a consumer left on the old state (chart centring)
Recorded not fixed: legacy multi-combo now shows the store's fit — a convergence, bands unchecked
Stage 3 MOUNTED A8, A9, A10 and C-17 with exact i18n strings before certifying
Decisions needed: none
State: MERGED. Walk resumes at C step 17. Sections B, D, E stand as written.
```

---

## The defect, and why it is a design gap

After a session restore, forecasts existed and drew in Actuals Review — all four
series for Segment=Corporate, Product=Fixed Connectivity — while Step 1 showed
"Ready to forecast" and its button read "All cohorts in scope already forecast".
The store held the forecasts; Step 1 could neither show nor regenerate any.

**Mechanism, verified rather than assumed.** The Step 1 result panel gates on
`forecastData.length > 0`. That state is written only by paths that GENERATE.
Restore rehydrates `forecastStore` and writes none, so the gate never opened.

**Classification: DESIGN GAP.** `git log -S "forecastData.length > 0"` returns
exactly one commit — `f52b21d Initial commit`. `git log -S "restoredStore"`
returns later commits only. Every restore implementation in history was checked
for a `setForecastData` within its body: none has one. **A restored session has
never rendered in Step 1.** Section C simply reached it first — not a Session J
or K regression, though K's fix is in the same family, which is why the shape
was recognisable.

## The fix is a deletion

Session K made the aggregate path a **second** writer of `forecastData`. Restore
would have been a third, and the next path a fourth. That is the pattern this
codebase has now paid for four times: a requirement that lives at call sites
rather than inside the thing itself.

So the panel **derives**. `stdPanelRows` asks the seam what exists for the
current selection and builds rows from it; the panel gates on that.
`showResolvedAggregate` stopped writing panel state and restore never had to
start. **The question "which paths must remember to populate the panel" no longer
exists** — which is the only durable answer to a defect that has now recurred at
three separate call sites.

**Compare mode is the one exception, and it is real.** Compare-categories fits
ad-hoc per-category series that are never stored under a cohort key, so there is
nothing in the store to derive them from. Those rows stay written.

**A latent bug closed on the way:** written panel state persisted across
selection changes until the next generate, so the panel could show one
selection's numbers under another's label. A derived panel cannot.

## Subsidiary

1. **The placeholder no longer invites an impossible action.** It stands down for
   `covered`, `blocked` and `never` as well as for a notice — the same
   contradiction shape Session K fixed for the notice case, in the state the walk
   reached first.
2. **The disabled button leaves the red action colour.** A coverage statement on
   faded red reads as "the thing to click, but not now". It now uses the
   treatment this file already had (`bg-slate-200 text-slate-400`) rather than
   the one I first invented — stage 1 caught that.
3. **`unfittableLeaves` resets on restore, deliberately.** Restore replaces
   `data`, so the reset effect fires. The visible consequence: after a restore
   the two short-history leaves count as fittable-missing again, the button
   offers them, and a run re-proves them unfittable. That is the correct trade —
   unfittability is a property of the data, and persisting the set into the save
   file would carry a claim about a fit forward past the moment it was measured.

## What the gate found that review did not

- **A consumer left on the old state.** The window-offset effect still read
  `forecastData`, so it silently stopped firing for exactly the derived views
  this session created: the chart drew but no longer centred on the
  history/forecast transition. Nothing failed, because the diff shrank the
  effect's reach without touching a line of it. `spec:walk-fixes` now enumerates
  every reader and permits only two.
- **A name meaning two things.** Writing that check surfaced a local in
  `generateCohortForecast` also called `forecastData`, shadowing the panel state
  so no check could tell a consumer from an unrelated variable. Renamed.
- **An invented disabled style**, where the file already had one.
- **`stdChartData`'s deps said `stdPanelRows` while its body still read
  `forecastData`** — caught by `spec:chart-scope` going red when its premise
  changed, rather than passing over it.

## Recorded, not fixed

- **The legacy multi-combo path now shows the store's fit.** That branch writes
  `forecastData` as a sum of per-combo fits while separately storing one fit on
  the combined series. Deriving means Step 1 shows the stored one — a
  **convergence**, since `forecastStore` is what Actuals Review scores against, so
  Step 1 previously displayed a figure no other screen agreed with. Measured
  31570.16 against 31570.15 across five real series; **the bands were not
  compared** and are the likelier place for a visible difference.
- **A latent divergence on an irregular metric grid**, where a month present for
  other metrics but absent for the target would be dropped by the old path and
  kept as zero by the new one. Both shipped fixtures were checked
  programmatically and contain none, so this is untested rather than working.

## Gate

- **ui-consistency** — found the invented disabled treatment. Its other
  observation, that the `never` state shows no red call-to-action anywhere, is
  accepted rather than actioned: there is genuinely nothing to do with a
  selection the data cannot produce, and a red affordance would be the
  contradiction this session removed.
- **qa-tester** — drove the manual path's derived output against its written
  output on real fixtures and found them byte-identical across two leaves and two
  scenarios; traced the two consequences recorded above.
- **regression-guard** — found the window-offset regression on the first pass and
  returned REGRESSIONS FOUND. On re-run over the fixed tree: **SAFE FOR USER
  TESTING**, having **mounted A8, A9, A10 and C-17** and, this time, matched the
  A10 button with the exact `standard_scope_not_in_data` string rather than an
  ad-hoc pattern.
- 23 spec suites green (`step1-panel` 38/38 mounted, `walk-fixes` 74/74),
  `guard-traps` 33/33 with 33/34/35 caught and 28/31 retired-with-reason, `traps`
  3/3, typecheck 0, build clean, i18n parity clean, scoped no-AI confirmed.

**Figures re-measured, not quoted:** ARPU MAPEs 13.8845 / 13.4315 / 14.3888 /
13.0192; leaf-grain 72 of 74; generate-missing 74 leaves, 72 fit, 2 unfittable.

## Where the walk resumes

**At section C step 17**, on `ec77b34`.

- **C17** — load your saved session. Step 1 must now show the forecast panel with
  a drawn chart, not "Ready to forecast". This was verified by mounting the real
  component against a store built exactly as restore leaves it.
- **Also expect on that screen:** where the button is disabled it is now grey
  rather than faded red, and the panel area no longer tells you to click Generate
  while the button says everything is already forecast.
- **Worth knowing:** after a restore the two short-history leaves count as
  missing again, so the button may offer to generate them. Running it will
  re-prove them unfittable and move to the blocked state. That is intended.

**Sections B, D and E stand as written** in the Session I report — untouched by
this diff. Stage 3 reports that as diff-scope reasoning rather than a re-walk,
and I am repeating the distinction rather than smoothing it: **A 8–10 and C-17
were mounted; B, D and E were not re-verified.**

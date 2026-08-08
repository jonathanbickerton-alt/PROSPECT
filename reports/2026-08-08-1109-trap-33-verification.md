# Trap 33 — verifying the mounted assertion catches Session J's defect

## FOR ADVISOR

```
Generated: 2026-08-08 11:09 +0100 (UTC 2026-08-08 10:09)
Certifies: <pending merge> — branch session-k-trap33, check FAILED and was fixed
Answer: NO trap 28–32 was this. Trap 28 plants the defect but kills a SOURCE check, not the mounted one.
Worse: with trap 28's mutation planted, EVERY mounted assertion in spec:step1-panel stayed GREEN.
Cause: the spec built its own forecastData rows and passed them as a prop — it never drove production.
Fix: row building extracted to buildAggregateForecastRows; the spec now calls the real function.
Added: trap 33, file ENGINE, spec PANEL. Red run shown below — placeholder present, 0 curves.
Also fixed: trap 28's anchor matched the Base-branch clear and cut 2,314 chars, more than its name.
Also fixed: trap 32 INCONCLUSIVE after the extraction moved its anchor.
State: 33/33 caught, 26/26 mounted spec, 70/70 walk-fixes, typecheck 0, build clean.
```

---

## The answer to the question asked

**No trap among 28–32 is the requested mutation.** Trap 28 plants the right
defect — it reverts `showResolvedAggregate` to not populating `forecastData` —
but it is declared `spec: WALKFIX`, so what catches it is a **structural source
check**, not the mounted assertion.

That distinction turned out to matter more than a label.

## What the check found

I planted trap 28's mutation by hand and ran both specs:

```
--- does the MOUNTED spec notice? ---
step1-panel spec: 22 passed, 2 failed
  FAIL STALE PANEL: the Base branch clears forecastData before noticing
  FAIL STALE PANEL: and clears the context forecast with it

--- does the structural spec notice? ---
walk-fixes spec: 64 passed, 4 failed
  FAIL PANEL: the resolver populates forecastData, not only baseForecast
  ...
```

**Read the two failures in `step1-panel` carefully: both are its *source-reading*
checks.** Every **mounted** assertion — placeholder gone, panel present, chart
geometry — stayed **green** under the exact defect Jon's walk failed on twice.

The reason is the spec's own construction. It built `forecastData` itself and
passed it in as a prop. So it proved *"the panel renders correctly when given
good rows"* and proved **nothing** about *"the app gives it rows"* — and only the
second is what failed on screen. A mounted spec that supplies its own inputs is
still a spec about the component, not about the product.

That is the same species as the defect it was written for, one level further
out: Session J asserted on state below the gate; Session K's spec mounted above
the gate but fed it from the test rather than from production.

## The fix

`buildAggregateForecastRows` is extracted to `src/utils/forecasting.ts` — pure,
exported, taking the scope predicate and month parser as arguments. `App` calls
it; `spec:step1-panel` calls **the same function** to build the rows it mounts.
The chain from production code to rendered pixel is now unbroken inside the
assertion.

**Trap 33** mutates that function to return `[]` and targets `spec: PANEL`.

### The red run, as asked

```
=== TRAP 33 MUTATION PLANTED ===
step1-panel spec: 20 passed, 6 failed
  FAIL PREMISE: the production row builder produced rows  [0]
  FAIL PREMISE: with both a historical and a forecast half
  FAIL FIXED: the placeholder is GONE  [the panel still has not mounted]
  FAIL FIXED: the chart drew at least one series  [0 line groups]
  FAIL FIXED: and at least one series has real geometry  [0 curves with a path]
  FAIL STALE PANEL: a mounted chart under an absence notice is visible here
```

`FIXED: the placeholder is GONE` failing **is** the walk's step 8 failure,
reproduced in the harness: placeholder present, panel absent, zero curves — and
caught by the mounted DOM assertion, not by a state-level check. Green-first
positive control held (the harness reports INCONCLUSIVE if the spec is already
red, and did not).

In the full run: **33/33 caught.**

## Two further defects the check surfaced

- **Trap 28's anchor was ambiguous.** It searched `'    setForecastData(['`
  (four spaces), which is a substring of the six-space Base-branch clear a few
  lines earlier — so it cut from there and removed **2,314 characters**, rather
  more than "the derived forecast never reaches the panel". It still reported
  CAUGHT, for a mutation broader than its name. Re-anchored on the call itself.
- **Trap 32 went INCONCLUSIVE** after the extraction moved its anchor — the scope
  test became a predicate passed to the builder rather than an inline `continue`.
  The harness reported INCONCLUSIVE instead of a false catch, which is that
  state doing its job. Re-anchored.

One spec check also went red rather than blind: `walk-fixes`' "rows carry the
Type field" was looking inside `showResolvedAggregate`, where the rows no longer
are. It failed instead of passing over a body that had stopped building them,
and now reads the engine — with an anchor check in front of it.

## Verification state

`spec:step1-panel` 26/26 (mounted), `spec:walk-fixes` 70/70, `guard-traps`
33/33, `traps` 3/3, typecheck 0, build clean, i18n clean. Working tree restored
and verified clean after each planted mutation.

**Code did change** — the task said no changes expected unless the check failed.
The check failed, in the way that mattered most: the assertion that was supposed
to be the backstop for two failed walks could not see the defect it existed for.

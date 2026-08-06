# FOR ADVISOR

**Certifies:** `e3f0a2f` (stage 2 PASS, stage 3 SAFE — 5th run, supersedes 4 prior certificates)

**Findings**
- The derived-row mix (leaf count + model histogram) renders nowhere a derived row can reach.
- All three `incumbentLabel` call sites sit behind preview or accept-all guards derived rows cannot pass.
- The walk's "108 leaves" expected value was measured from the store, not from any surface — my error.
- The illustration panel ranks three models by error on aggregates, contradicting the no-comparison banner.
- Two of those three trajectories are synthetic perturbations of the incumbent, not fitted models.
- The challenger tab is never passed the tariff columns, so "(not mapped)" there is permanent on every file.
- "(not mapped) = wrong file" was therefore a false diagnostic and is now retracted.
- The earlier Part B `ProductL2_Full` identification rested on that tell and is now unestablished, not merely weaker.
- `ViewFilterBar` still offers "Generate in Step 1" on a selection-null (reported, not fixed).

**Decisions needed from Jon / advisor**
- Wire the mix onto derived rows, or correct the walk to expect only the "Aggregate — no single model" subtitle?
- Illustration panel on a derived row: drop the error rankings, or do not show the panel at all?
- Fix `ViewFilterBar`'s Step 1 button for the selection-null case, or leave it recorded?

**Merge state:** HELD. No fixes made this session; grading outstanding on the two remaining clicks.

---

## 1. Where the leaf count / model mix renders — nowhere reachable

`leafCount` becomes words in exactly one place, `incumbentLabel`
(`ForecastVsActualsTab.tsx:3086`). Its three call sites:

| site | surface | why unreachable for a derived row |
|---|---|---|
| :4399 | preview banner "Current: X, MAPE …" | inside `if (preview)` at :4356 — requires having *run* a challenger; Run buttons are withheld for derived rows |
| :4432 | chart legend "… (current)" | same `if (preview)` block |
| :4678 | Accept-All modal row badge | iterates `acceptAllCandidates`, which filters `!g.derivedMix` |

There is no click path. The 108s exist only in the store. What renders on the
rows is the Gap A fix — `actuals_aggregate_of_leaves`, "Aggregate — no single
model" — which carries no count and no histogram.

**This is a surface-not-store violation committed from inside the walk.** The
leaf counts were measured by driving `deriveAggregate` and reading
`provenance.leafCount`, then written into the walk as an on-screen expected
value — the exact rule recorded two commits earlier, repeated while writing the
check meant to verify the fix. The 5 × 108 = 540 cross-check offered as the
anti-vacuity guard was checking arithmetic against the store, not against
anything rendered.

`derived-interaction-spec`'s B3 block asserts on provenance, not rendered DOM,
so it stays green under either resolution.

## 2. The illustration panel is a comparison

`ForecastVsActualsTab.tsx:4541` maps `selectedChallengerGroup.models` rendering
`{m.name} ({m.error.toFixed(1)}% err)`, with no `derivedMix` guard. `models` is
built at :3223 with an explicit `.sort((a, b) => a.error - b.error)` — rank
-ordered by error — and `bestModel = models[0]` is that ranking's winner.

A writer the exhaust-the-writers pass missed. That pass asked whether a derived
row can reach the *accept* path and answered correctly; it never asked whether
any surviving surface still ranks models by error. Suppressing acceptance is not
suppressing comparison.

Worse than a residual: the trajectories are synthetic (:3193–3197).
`dampedTrend = forecast * 0.9`;
`holtWinters = act.inflow + (forecast − act.inflow) * 0.2 + sin(i) * act.inflow * 0.05`.
Only "Holt Linear" is the real loaded forecast; the other two are arithmetic
perturbations of it. The percentages are genuine MAPEs of fabricated series, so
the ranking is an artefact of the perturbation constants and would order the
same way on any cohort.

It cannot be justified as anything but fit-on-aggregate advice. Of the two
options, trajectories-without-rankings is the weaker fix — it still presents
three synthetic curves as model behaviour. On a derived row the panel arguably
should not show at all. Product call, reserved.

## 3. "(not mapped)" is permanent on the challenger tab

- Accuracy tab, `ForecastVsActualsTab.tsx:3908` — passes `wiTariffL1Col` and `wiTariffL2Col`.
- Challenger tab, `:4181` — **passes neither**.

`CohortDimCheckboxes` renders the disabled "(not mapped)" label whenever those
props are falsy, so on the challenger tab they are `undefined` on every file,
permanently. The dims type carries tariff and the key builder reads it
(:3154–3155), so the plumbing is half-present — the toggle can never be enabled.
The fallback `cohort` literal at :3229 also omits `tariffL1`/`tariffL2`. Tariff
was never wired into the challenger's grouping.

The label was recorded as a positive identification of `ProductL2_Full` and both
gates read past it. It was also the *only* evidence pointing that way — the ARPU
measurement pointed the other way (16.5 observed sits near TariffHierarchy's
16.28, not ProductL2_Full's 14.84), and that tension was recorded as unresolved
rather than allowed to overturn the diagnostic. The tension was the signal.

### Reliable on-screen fixture tells

| pair | reliable tell |
|---|---|
| Edge (12,112) vs Trimmed (12,432) | **row count** — distinct |
| Dec2025 (77,760) vs Jun2026 (90,720) | **row count** — distinct |
| `ProductL2_Full` vs `TariffHierarchy`, same date range | **row count is identical** (77,760 / 90,720), as are months (36/42) and cohorts (540). Use the **mapping step's Tariff L1/L2 selectors**, or the **Historical Accuracy tab's** dimension checkboxes (:3908), which do receive the tariff columns. Never the challenger tab's. |

Secondary independent tell for that pair: `Avg_Unit_Price_GBP` is **0.00
throughout `ProductL2_Full`** (measured across all rows), so any ARPU surface
falls back to revenue ÷ volume there.

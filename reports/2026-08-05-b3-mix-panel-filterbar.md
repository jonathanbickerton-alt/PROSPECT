# FOR ADVISOR

**Certifies:** `00a4116` — stage 2 PASS, stage 3 SAFE (6th certificate, supersedes 5 prior)

**Findings**
- The mix now renders on the derived row; previously it reached no surface at all.
- The shortfall was the implementation, not the walk — "108 leaves" was the approved design.
- The illustration panel is suppressed entirely for derived selections; the banner stays.
- Standing pre-existing finding: the same synthetic trajectories rank FITTED leaf rows too.
- The filter bar's "Generate in Step 1" is gone on selection-null; never-generated keeps it.
- Specs now assert rendered DOM; the B3 block was asserting provenance and could not tell them apart.
- Retracted: "(not mapped)" is permanent on the challenger tab, so it is not a fixture tell.
- The ProductL2_Full identification of the earlier Part B session is unestablished, not merely weaker.
- Stage 3 caught a stale record heading still reading "still open" after the fix landed; corrected.

**Decisions needed from Jon / advisor**
- Fitted-leaf-unchanged is NOT DOM-asserted: worth a fixture yielding scored leaf-grain rows?
- Stage 2 reported reaching a fitted row where I could not; discrepancy recorded unresolved — pursue?
- Leaf-grain challenger redesign inherits "real fits or nothing" — confirm that constraint stands.

**Merge state:** HELD. Jon's final clicks outstanding: dropdown buckets, and the mix visible on rows.

---

## What changed

**1. The mix reaches the row.** `incumbentLabel`'s three call sites were the preview
banner, the preview legend (both inside `if (preview)`, which a derived row cannot
reach — Run buttons are withheld) and the Accept-All modal (which filters
`!g.derivedMix`). The row rendered a constant instead, so the leaf count and model
histogram lived only in the store. The row now renders `incumbentLabel(g)`. The word
"leaves" is keyed (`actuals_leaves`) — it was English inside a template literal, which
the JSX scanner cannot see.

**2. The illustration panel is suppressed for derived selections.** It printed
`{m.name} ({m.error}% err)` from a `models` array sorted by error — an error-ranked
comparison directly beneath a banner stating no comparison exists. Suppressed rather
than de-ranked: two of the three curves are arithmetic perturbations of the loaded
forecast (`dampedTrend = forecast * 0.9`; `holtWinters = act.inflow + (forecast −
act.inflow) * 0.2 + sin(i) * act.inflow * 0.05`), so the percentages are real MAPEs of
fabricated series and the ranking is an artefact of the perturbation constants — it
would order the same way on any cohort.

**Standing finding, pre-existing, out of scope:** those same synthetic trajectories are
what a FITTED leaf row is ranked on. Suppressing the panel on aggregates does not make
it truthful on leaves. Inherited by the backlogged leaf-grain redesign under the
constraint **real fits or nothing**.

**3. The filter bar's corner link.** On a selection-null it now states the cause via the
shared `SKIP_REASON_KEY` enum plus a widen-the-filter hint, with no Step 1 button. The
never-generated case keeps the link unchanged. App gates the reason on
`forecastStore.size > 0 || hasLegacyBaseline` first, because `resolveForecast` reports
`insufficient-history` for a key whose leaves all failed to fit — indistinguishable from
"nothing generated yet" unless the store is consulted.

## The spec-layer correction

`npm run spec:challenger` (12 cases) mounts the real `ForecastVsActualsTab`, clicks
through to the challenger tab, and reads rendered text. It carries a positive control
proving the harness can paint a Recharts surface, because three of its assertions are
of ABSENCE and Recharts paints nothing at jsdom's width of −1 — without the control they
would all pass vacuously.

The B3 block in `derived-interaction-spec` kept a source tripwire and lost its claim to
cover the display, with the reason written in: it asserted provenance and source text,
stayed green throughout, and the mix rendered nowhere. A spec that cannot distinguish
"the value exists" from "the value is on screen" is asserting the wrong layer.

## The declared gap, and how it got there

`spec:challenger` does **not** assert the fitted-leaf-unchanged case at the DOM layer.

I first declared this without chasing it. Stage 2 reported the case reachable by
toggling Product L1, which would have made the declaration an overstatement of the
limitation — the mirror of a docstring claiming coverage it lacks. So I chased it: the
store's leaf keys carry a real channel, so a product-only grouping cannot hit them; I
added a product-grain fit to the store, which made the key hit. The list still yields no
fitted row, and the mechanism is visible rather than guessed — at that grain
`challengerCohortAccuracy` has no scored rows, `c.overallScore !== null` filters
everything out, and the empty state renders. Channel L1 also turned out to be on by
default, so the original two-toggle attempt reported "1 of 2 toggled" for a reason
unrelated to reachability.

Stage 2's route was not reproducible. That is recorded as an unresolved discrepancy
rather than settled by picking whichever result is more convenient. The missing piece
for anyone extending the harness: a store arrangement yielding **scored** accuracy rows
at leaf grain.

Stage 3 agreed with the framing and reached the same limitation independently.

## Retraction, at the lead of the entry it corrects

"(not mapped)" beside Tariff on the challenger tab is **permanent on every file**:
`ForecastVsActualsTab.tsx:4181` renders `CohortDimCheckboxes` without passing either
tariff column, while the accuracy tab's call at `:3908` does pass them. Observed in a
live DOM render, not only in source.

So it is not a fixture tell, and the `ProductL2_Full` identification of the earlier
Part B session is **unestablished** — it was the only evidence for it.

**The lesson, by name: a recorded unresolved tension pointing against a diagnostic is
evidence against it, not a footnote.** The ARPU measurement disagreed at the time (16.5
sits near TariffHierarchy's 16.28, not ProductL2_Full's 14.84), was written down as an
open question, and was then read past — by me and by two gate stages.

### Reliable on-screen fixture tells

| pair | reliable tell |
|---|---|
| Edge (12,112) vs Trimmed (12,432) | row count — distinct |
| Dec2025 (77,760) vs Jun2026 (90,720) | row count — distinct |
| `ProductL2_Full` vs `TariffHierarchy`, same dates | row count is **identical**; use the mapping step's Tariff selectors, or the **Historical Accuracy** tab's checkboxes (`:3908`). Never the challenger tab's. |

Secondary tell: `Avg_Unit_Price_GBP` is **0.00 throughout `ProductL2_Full`**.

## Verification at `00a4116`

typecheck 0 · build clean · ten suites 392 · nullrender 35 · challenger 12 · traps 3/3 ·
guard-traps 8/8 · i18n parity clean · scoped no-AI clean · `.env` untracked.

Stage 3 measured 1,860 of 1,860 `All`-bearing keys resolving (657 multi-leaf derived,
1,203 single-leaf passthrough, 0 null), and re-confirmed the roll-up dedup (0 duplicated
roll-ups, leafCount 14, inflow.mean 4970.08) and the A5 hook-order fix.

# FOR ADVISOR

**Certifies:** `eb036c6` — Session B merged to main, `--no-ff`, verified ON main after merge

**Findings**
- Jon's final walk PASSED at `00a4116`; all suites green again on merged main.
- Merged tip was `35a2984`, one commit past the certified tree — docs only, no code. Stated, not glossed.
- The mix reconciles: every histogram sums to its row's 108, the five rows sum to 540.
- Cross-grouping check is the strong one: segment Holt Linear 71+75+78+78+72 = 374 = the leaf-grain bucket.
- Deep-grouping screens are CORRECT BY DESIGN — 540 groups from 540 leaves means single-leaf passthroughs.
- FIXTURE DEGENERACY: one tariff per 5-part combo, so multi-leaf derived rows below segment are undemonstrable here.
- That also removes the last indirect support for the old ProductL2_Full identification.
- Queued: tariff wiring into the challenger tab (prerequisite for the leaf-grain redesign).
- Queued: relabel "(not mapped)" → "(not available in this view)" into the Phase 3 copy batch.

**Decisions needed from Jon / advisor**
- None outstanding for Session B. Session C docket is agreed and carried forward below.

**Merge state:** MERGED and pushed. Session B CLOSED. Session C next session, fresh budget.

---

## The merge

`--no-ff` merge of `session-b2-wire-seam` into `main` at **`eb036c6`**, from branch
tip `35a2984`. No conflicts.

Jon's walk passed at `00a4116`. The tip carried one further commit — an
`EXPECTED.md` heading correction and the session report, no code, no scripts, no
locales. Recorded explicitly because "certified X, merged Y" is the shape of the
verification-before-the-last-edit mistake even when the delta is documentation,
and the post-merge verification below is what actually covers it.

### Verified on main, after the merge

typecheck 0 · build clean · ten suites 392 · nullrender 35 · challenger 12 ·
traps 3/3 · guard-traps 8/8 · i18n parity clean.

## What Jon's walk established

**Part 1 — both looks passed.** The reason panel states the cause with no Step 1
redirect, and the filter bar's corner link does the same. The two-meanings-of-null
split holds on the screen, not only in the spec.

**The mix renders on all five rows and reconciles.** Every histogram sums to its
own row's 108; the five rows sum to 540, the whole fitted store. The count is not
decorative.

**Cross-grouping consistency is the strongest result of the walk.** The
segment-grouped Holt Linear counts — 71 + 75 + 78 + 78 + 72 — total **374**, which
equals the leaf-grain Holt Linear bucket exactly. The same population, counted two
ways through two code paths, agrees. That is a far better result than any single
screen looking plausible, and it is the kind of check worth designing for
deliberately rather than stumbling into.

**The Aggregates bucket: 5 of 5 at segment grouping**, with exclusivity proven at
deep grouping — every derived row, and only derived rows.

**The deep-grouping screens are CORRECT BY DESIGN.** They show fitted rows with
model recommendations rather than mixes. 540 groups from 540 leaves proves exactly
one tariff per 5-part combination on this fixture, so every deep-grouped key is a
single-leaf passthrough — a fitted forecast, per the settled rule that a one-leaf
"aggregate" returns the stored object by reference rather than deriving.

## Fixture degeneracy — what this file cannot show

One tariff per 5-part combination means **multi-leaf derived rows below segment
level are undemonstrable on this fixture.** Every sub-segment grouping collapses to
single-leaf passthroughs; derived behaviour is observable only at segment grain and
above.

A future check wanting a multi-leaf derived row below segment level needs a fixture
with genuine tariff variation inside a 5-part combo. None exists.

It also **removes the last indirect support for the old `ProductL2_Full`
identification.** Tariff adds no grain on the TariffHierarchy fixture, so cohort
counts are identical whether tariff is mapped or not — which is precisely why 540
could never discriminate between the two files. The identification rested on
"(not mapped)", already retracted; this removes what was left.

## Queued

- **Tariff wiring into the challenger tab.** `ForecastVsActualsTab.tsx:4181` passes
  neither tariff column to `CohortDimCheckboxes`; the fallback `cohort` literal at
  `:3229` omits both tariff fields. This is a **prerequisite** for the backlogged
  leaf-grain challenger redesign — that redesign cannot group at leaf grain on a
  tariff-bearing file while the tab cannot see tariff at all.
- **Relabel "(not mapped)" → "(not available in this view)"**, into the Phase 3 copy
  batch. The current label states a property of the FILE when it is a property of
  the VIEW, which is exactly what made it a false fixture diagnostic. The relabel is
  the cheap half and must not be taken as closing the wiring above.

## Session B, closed

What it established: an aggregate cohort resolves to a DERIVED forecast summed from
its fitted leaves, rather than to whatever was last loaded. It closed the
aggregate-typed-forecast defect that every gate had re-confirmed since 2026-08-04.

Four defects were found while wiring it, three of them classified
introduced-in-effect under the rule that a diff making pre-existing code newly
reachable owns that code's defects:

1. **Roll-up duplication** — an unmapped dimension collapsed three roll-up variants
   into one key and recorded each leaf three times, tripling every aggregate above
   it (14,910.24 against an honest 4,970.08).
2. **Hook-order crash** — three `useMemo` calls below a conditional return blanked
   the app on the forecast-to-null transition, invisible to any mount-only spec.
3. **The empty state** — a session holding 7,588 forecasts was told none existed and
   sent to the fit-on-aggregate path Phase 3 removes.
4. **The challenger mix** — designed onto the row, rendering nowhere, with the
   specs asserting provenance and therefore unable to tell the difference.

Six regression-guard certificates, the last over `00a4116`, plus this
post-merge run on main.

## Session C docket, carried forward

- The deletions: `scaledBandFlow`, `computeAvgShare`, the instance-2 seed fallback,
  and the always-true guard at `ForecastVsActualsTab.tsx:4682`.
- The scored-leaf-grain DOM spec, via a 5-part store arrangement — the missing
  piece that stopped `spec:challenger` asserting the fitted-leaf case.
- The one-shot re-test of stage 2's irreproducible route to a fitted challenger row,
  recorded as an unresolved discrepancy rather than settled either way.

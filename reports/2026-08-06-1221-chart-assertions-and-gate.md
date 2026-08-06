# FOR ADVISOR

**Generated:** 2026-08-06 12:21
**Certifies:** none — `f9eae73` passed stages 1 and 2; stage 3 NOT run, merge withheld on a finding.

**Findings**
- Measured first: the rendered chart was ALREADY honest for a selected unscored row. Nothing fabricated by another route.
- `className` verified to reach the DOM — groups render `recharts-line series-forecast` / `series-actual`.
- The assertion pair uses one selector and one geometry test, so the actuals half is a real positive control.
- Trap 9 restored and CONFIRMED killing: stage 2 planted it, exactly 2 assertions went red, geometry 4/16 → 14/16.
- Stage 1 PASS, stage 2 PASS.
- STAGE 2 FINDING: the `cohortMatchesFilter` half of the retained Case B guard is UNTESTED — remove it, all specs stay green.
- Case B's rationale was sitting in the DEAD memo, not beside the live guard. Moved; each half's coverage now named in code.
- `chartData` dead-code finding independently confirmed by stage 2's own rename test.
- Candidate-scan measurement independently reproduced: 4 tier-1 misses, 0 scan hits, all on the edge fixture.

**Decisions needed from Jon / advisor**
- Close the `cohortMatchesFilter` coverage gap before merging (needs a new scenario + trap), or merge and follow up?
- That is the only thing standing between here and stage 3 + the pre-authorised merge.

**Merge state:** UNMERGED on `session-d-chartdata` at `f9eae73`. Stage 3 not run pending the above.

---

## Step 1, done as specified — measure, then assert

**Measured first.** For a selected unscored row the rendered chart already draws
no forecast: the "no forecast matches the current view scope" notice appears, the
variance table has 0 rows (it requires both an actual and a baseline), and 4 of 16
curves still carry geometry — the actuals. `multiChartData` was honest all along,
exactly as the dependency map said. **Nothing fabricated by another route**, so no
new finding on that front.

**Identities verified in output, not from docs.** `className` does reach the DOM:
the groups render as `recharts-layer recharts-line series-forecast` and
`... series-actual`, on both chart variants.

**The assertion pair uses one selector and one geometry test for both halves**, so
the actuals half is a genuine positive control — it proves the selector matches
and that geometry is detectable. The previous version had no such mirror, matched
nothing, and passed for free.

**Trap 9 restored and confirmed killing.** Stage 2 planted it independently:
exactly two assertions went red (the forecast-absence one and the both-panels
one), the table-panel and positive-control assertions stayed green, and geometry
jumped from 4/16 to 14/16. It kills for the stated reason, not an incidental one.

## The gate

**Stage 1 PASS** — the classNames collide with no CSS anywhere in the project, no
orphaned imports, i18n clean, build clean, unscored-row presentation untouched.

**Stage 2 PASS**, and it earned it. It independently confirmed the `chartData`
dead-code finding with its own rename test, independently reproduced the
candidate-scan measurement (4 tier-1 misses, 0 scan hits), and verified the
assertion pair is non-vacuous by checking the selector matches 4 elements rather
than 0.

## The finding, and why I have not merged

Stage 2 mutated the **other** half of the retained Case B guard — removing
`(!activeFilter || cohortMatchesFilter(...))`, leaving only `!selectedCohortRow` —
and **every spec stayed green.** No spec exercises "no cohort selected, a filter
set, and the loaded forecast scoped to a different cohort", which is exactly the
scenario that half exists to prevent and which the comment records as having
produced +99.9% nonsense variances.

The guard is present and correct in the shipped code. It is **unverified**, not
broken. But this branch's whole subject is the difference between a check that
bites and one that reads well, and I have just spent two sessions on assertions of
mine that turned out to prove nothing. Merging with a known-untested guard, in
that context, is not a call I should make for you.

I did fix the cheap half: Case B's rationale was sitting inside the **dead**
`chartData` memo, beside a twin of the guard rather than the live one — the
reasoning recorded where nobody reading the running code would find it. It now
sits on the live guard and names what each half is worth, including that
`cohortMatchesFilter` has no coverage. The next person to simplify that condition
will be reading the condition.

## What closing it would take

A scenario the suite does not currently have: no cohort selected, `activeFilter`
set, and `baseForecast` scoped to a cohort the filter excludes — then assert the
aggregate is NOT drawn against those filter-scoped actuals, with a trap that
removes `cohortMatchesFilter` and watches it die. Same shape as trap 9. It is
real work, not a one-liner, which is why it is a decision rather than something I
absorbed.

## Carried forward

- The decision above, then stage 3 and the pre-authorised merge.
- **The reworded family declaration**, to be made with the merge record: every
  REACHABLE fabrication is gone — three fallbacks in the table, the borrowed seed,
  and the candidate scan; the chart-side three lived in dead code no user ever
  saw, deleted regardless. `spec:triggers`, `spec:unscored` with its restored trap,
  and the summation guard stand as its defence.
- `chartData`'s ~460 dead lines: own branch after tasks 2/3, opening with the
  divergence check against `multiChartData`'s live logic.
- Tasks 2 and 3, fresh session.

# Step 1 resolves its selection — keep-last retired, and a second door closed

## FOR ADVISOR

```
Generated: 2026-08-09 18:39 +0100 (UTC 2026-08-09 17:39)
Certifies: working tree on main, base c161a42. NOT YET COMMITTED at write time.
RESERVED DECISION IMPLEMENTED: option 1. Step 1 re-resolves through the seam on a
  selection change — fitted verbatim, aggregate derived, MISS NULL. The null is
  the decision: an early return on a miss IS keep-last.
ONE RESOLVER, no reimplementation: the transition is forecastForStep1Selection in
  utils/viewFilter, alongside forecastForView and extracted for its reason.
GATE FOUND A SECOND DOOR the first fix left open, reproducing the same defect:
  Steps 2/3 reassign baseForecast and forecastForView returns owns:false for
  'standard', so RETURNING to Step 1 left another cohort's forecast under Step
  1's dropdowns. Entering is now a trigger too, via an AWAY sentinel.
A TRAP FOUND DEAD LOGIC IN MY OWN FIX: the `returning` flag was inert (AWAY can
  never equal a key), so trap 46 stayed GREEN on a mutation that should have
  hurt. Flag removed, trap re-aimed at the sentinel, return check re-chained.
CONSEQUENCE VERIFIED, measured independently by stage 3: Corporate forecast
  17.3759 vs last actual 17.343051 — continuous; 33.69 unreachable. The MNC
  sighting is predicted unreproducible; closure still awaits Jon's fixture.
ENUMERATIONS: setBaseForecast 11 -> 12, classified BY SITE first and the count
  raised after; setForecastData pin (7) undisturbed; trap 38 still bites; the
  seam claim now verified at BOTH ends, site and delegate.
GENERATED panel unchanged; generated leaves reappear on reselection.
RE-MEASURED: 74/72/2; MAPEs 13.8845/13.4315/14.3888/13.0192. Unmoved.
GATE all three PASS / SAFE FOR USER TESTING; one gap declared (no live browser
  mount). 27 specs, guard-traps 44/44, lint and build clean.
Decisions needed: none.
State: B-11 step 7 is the re-check — Corporate/others-All, Value ARPU, blended.
```

---

## Provenance

Base `c161a42`, branch `main`. Implements the reserved decision resolved by Jon
on 2026-08-09 — option 1 of the three offered in
`reports/2026-08-09-1448-overall-door-and-arpu-scope.md`. The mechanism was
demonstrated there and was **not** re-diagnosed here.

## The decision, implemented

A Step 1 selection change re-resolves `baseForecast` through the seam for the new
selection, exactly as `handleStep2FilterChange` and `handleStep3FilterChange`
already did.

```ts
const showStep1Selection = useCallback((selection: ViewFilter) => {
  const { forecast } = forecastForStep1Selection(selection, resolveForecast);
  setBaseForecast(forecast as BaseForecast | null);
  setAdjustedForecast(null);
}, [resolveForecast]);
```

**The null is the decision, not a detail.** `showResolvedAggregate` returns early
on a miss and that is right for *it* — it is handed a key it has just generated
into. The selection path may not: returning early on a miss *is* keep-last, and
leaves the previous cohort's numbers under a changed label.

**One resolver.** `forecastForStep1Selection` sits in `utils/viewFilter.ts`
beside `forecastForView`, and was extracted for that function's stated reason: a
transition living only inside a component effect can be *modelled* by a spec but
never *driven* by one, and a spec that models the rule it checks measures its own
copy.

## The second door — found by the gate, not by the walk

Fixing the "dropdowns move" trigger left the identical symptom reachable another
way. Steps 2 and 3 reassign `baseForecast` for their own filters, and

```ts
return { owns: false, forecast: null };   // forecastForView, for 'standard'
```

means nothing restores Step 1 on the way back. A user who visited Step 2 and
returned without touching Step 1's dropdowns found Step 1's dropdowns reading one
cohort and its chart drawing another's forecast. **Two populations again, same
chart, different door.**

So entering Step 1 is now a trigger too. The ref holds three states — never
observed (record, resolve nothing, so a mount or session import keeps what the
restore put there), a key (resolve only on a change), and AWAY (left and
returned — resolve even when the selection is unchanged).

This is worth recording because the first fix *looked* complete and passed its
own spec. The spec covered the trigger it was written for and said so in its
header; the gate read that disclosure and went looking at the other one.

## A trap found dead logic in my own fix

Trap 46 was first aimed at a `returning` flag I had written into the decision. It
was planted and **the spec stayed green** — which is the trap reporting on the
code, not on the spec.

The flag was inert. `STEP1_AWAY` can never equal a real key, so `prev === key`
already fails on a return and the flag changed nothing. The sentinel alone
carries the behaviour.

Three corrections followed, in this order:

1. **The dead flag was removed** rather than left as decoration that reads like a
   guarantee.
2. **The trap was re-aimed at the sentinel** — leaving records the key instead of
   AWAY, so a return with an unchanged selection looks like standing still.
3. **The return check was re-chained.** It had passed `STEP1_AWAY` in by hand,
   which made it blind to the leave step; it now takes `left.next`, so the
   sequence is a real transition and the mutation is felt at both ends.

Demonstrated red on both checks after re-aiming.

## Enumerations — moved, and classified by site

| pin | before | after |
|---|---|---|
| `setBaseForecast` call sites | 11 | **12** |
| `setForecastData` writers | 7 | **7**, undisturbed |
| guard-trap 38 (eighth writer) | bites | **still bites** |

The new site was added to `import-seam-spec`'s `ACCOUNTED` table **first**, with
a reason true of it, and `EXPECTED_SITES` was raised only afterwards. The count
exists to make adding a site deliberate, so bumping it first would invert the
point of the pin.

**The seam claim is now verified at both ends.** The site does not *call*
`resolveForecast` — it hands it to the helper. That check went red honestly, so
the table's reason now says so, the verification accepts delegation as well as a
direct call, and the delegate itself is checked in `viewFilter.ts`: it resolves
the key it was given, and returns the miss rather than swallowing it.

## Consequence — verified

Measured independently by stage 3 against the real forecasting code:

```
Corporate selection, forecast month-0 ARPU   17.3759
last actual ARPU                             17.343051   -> continuous
the old keep-last leaf                       33.69       -> unreachable
```

The 33.69 leaf cannot appear because the forecast half now resolves the
selection's own key.

**The MNC | Fixed Connectivity sighting** is predicted unreproducible under this
fix — under the old mechanism the forecast half was never that scope's forecast,
which is exactly why it could not be reproduced from the store. Its **formal
closure still awaits Jon's fixture** if he ever supplies one; nothing here closes
it by inference.

**The GENERATED panel is unchanged.** Generated leaves remain listed and reappear
on reselection — retiring keep-last means a forecast is not *shown* for a
selection that does not own it, never that generated work is lost. Asserted.

## Gate

| stage | verdict |
|---|---|
| ui-consistency | PASS — no strings moved, no props added, existing empty state |
| qa-tester | PASS on the fix, and **found the second door** |
| regression-guard | **SAFE FOR USER TESTING**, one gap declared |

27 specs green; guard-traps **44/44**; `traps` 3/3; lint and build clean; i18n
parity 0 missing. §33 with scope named: **main's working tree and build output
are AI-free**; history and remote branches out of scope, the preserved
`ai-capability` branch expected.

### Figures — re-measured, not quoted

```
PINNED ARPU MAPEs: 13.8845 / 13.4315 / 14.3888 / 13.0192   spread 1.3696pp
edge fixture: 74 leaves, 72 fit, 2 unfittable
step1-selection 24/24   import-seam 36/36   walk-fixes 82/82
```

### Declared gap

Stage 3 exercised the transitions by driving the extracted decision and the
extracted resolver against real production code, and read App's effect from
source. **No live browser mount of App's Step 1 dropdowns was performed.** Both
halves exist and neither covers the other; the spec says so in its header.

## Incidental

A NUL byte had got into an `App.tsx` string literal while editing (it made `grep`
treat the file as binary). Found and removed while refactoring that line out;
the file now contains none. Flagged because it would have been invisible in a
diff and confusing later.

## Where the walk stands — B-11 step 7 re-check

Section B, step 11, step 7 is the one to re-run:

1. Load the edge fixture and generate, so Step 1 has forecasts.
2. **Step 1 → Segment = Corporate, everything else All → Value (ARPU) →
   blended view.**
3. **Expect the forecast to start at about 17.38, continuous with a history
   ending about 17.34.** No step at the boundary.
4. **33.69 must not appear anywhere on that chart.** If it does, keep-last is
   back.
5. **Then the second door:** from that screen go to Step 2, then come straight
   back to Step 1 without touching its dropdowns. The chart must still read
   ~17.38 — not whatever Step 2 was showing.
6. **And the reselect:** pick the Corporate · Mobile Voice · High Value · Direct ·
   Call Centre leaf. Its own forecast (~33.69) should appear — correctly, because
   now it *is* the selection. Generated work is unshown when it is not selected,
   never lost.

Sections A and C stand as last verified (Session M); D and E as written in the
Session I report.

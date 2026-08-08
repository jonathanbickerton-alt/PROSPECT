# Section C findings — diagnosis before fix

## FOR ADVISOR

```
Generated: 2026-08-08 13:39 +0100 (UTC 2026-08-08 12:39)
Verified against: HEAD 89f82dd (main, tree clean apart from reports/)
NO CODE CHANGED. Finding 1's premise did not survive diagnosis; holding for a decision.

F1 DOES NOT REPRODUCE, and is NOT introduced by L. Evidence:
  - L's diff touches neither ForecastVsActualsTab.tsx nor ForecastContext.tsx (--name-only)
  - the restore path (App ~729-1000) is in NO diff hunk between d4a7f8a and ec77b34
  - resolveFromStore is unchanged; L only ADDED two functions to forecasting.ts
  - L REMOVED a setBaseForecast(null) (d4a7f8a:2077); it added none
  - replayed Jon's real save through the seam: with columns mapped BOTH surfaces
    resolve to `derived`; with columns unmapped BOTH return null. Neither state
    produces "Step 1 renders, Step 3 blank".
  So the inversion is real on Jon's screen but not explained by any code path I
  can find. I will not write a fix for a mechanism I cannot demonstrate.
  DECISION NEEDED: see "What would settle F1" — three cheap asks of Jon.

F2 CONFIRMED, classified DESIGN GAP (not introduced by L).
  bulk_complete_retired renders in exactly one place: BulkGenerateModal:443, inside
  BulkCompletePanel, reachable only via phase==='complete', set only in handleConfirm.
  It has NEVER appeared in App.tsx in any commit (checked all 4 commits touching it).
  Restore never opens that modal, so the statement has never been shown after a restore.

FOLD-IN CONTRADICTED: "after L, compare mode should be the only writer" — there are
  SEVEN setForecastData sites at HEAD; only 3 are compare mode. Four are now DEAD with
  respect to the panel (it derives unless compare mode is active). Detail below.

VERDICT: HOLD — F1 needs Jon's input; F2 and the writer pin need a surface decision.
```

---

## Provenance and scope

`git rev-parse HEAD` → `89f82dd`, branch `main`, working tree clean except the
untracked report from the previous verification task. **No source file, spec,
`EXPECTED.md` or agent definition was modified in this session.** The task said
to diagnose before assuming; the diagnosis changed what the session should do,
so it stopped there.

## Finding 1 — the reproduction failed, and that is the finding

### What I checked, and with what

| question | instrument | result |
|---|---|---|
| Did L touch the Actuals Review gate? | `git diff d4a7f8a ec77b34 --name-only -- src/components/ForecastVsActualsTab.tsx src/context/ForecastContext.tsx` | **empty** — neither file touched |
| Did L touch the restore path? | `git diff d4a7f8a ec77b34 -- src/App.tsx` hunk headers: `@@ -1732`, `-2060`, `-3393`, `-3413`, `-3450`, `-3843`, `-4407` | restore lives at ~729–1000; **no hunk covers it** |
| Did L change the seam? | `git diff d4a7f8a ec77b34 -- src/utils/forecasting.ts \| grep "^[-+]export function"` | only **additions**: `buildAggregateForecastRows`, `buildPanelRowsFromStore`. `resolveFromStore` unchanged |
| Did L add a `setBaseForecast(null)`? | site lists at both commits | the opposite — d4a7f8a had one at `:2077`; **ec77b34 has none** |

### The gate itself

`ForecastVsActualsTab.tsx:2900` — `if (!baseForecast) { return <"No Forecast
Loaded" … "go to Step 1"> }`. It reads the **context** forecast, not the seam.
The suspected shape in the brief is therefore right *in principle*: one state
carries both "Step 1's working preview" and "the committed forecast Steps 2–3
depend on". But the brief's proposed cause — L clearing that state — is not what
the diff does.

### The reproduction

Replayed Jon's real save (`541` keys, `Is_Active =
Corporate|Fixed Connectivity|All|All|All|All|All`) through the production seam,
modelling both surfaces' keys exactly as the app computes them. Restore resolves
the active key to a **derived** forecast, and sets `step3Filter =
cohortToFilter(bf.cohort)` (`App.tsx:893`).

```
--- columns mapped: true (leafMap size 7964) ---
  STEP 1 key : All|All|All|All|All|All|All              -> derived
  STEP 3 key : Corporate|Fixed Connectivity|All|All|All|All|All -> derived
  => FvA shows never-generated? false

--- columns mapped: false (leafMap size 0) ---
  STEP 1 key -> NULL (never-enumerated)
  STEP 3 key -> NULL (never-enumerated)
  => FvA shows never-generated? true
```

**Neither state produces the observed asymmetry.** With mappings, both surfaces
resolve. Without, Step 1 would be blank too — and Jon reports Step 1 rendering.

I take Jon's screen as fact. The conclusion is that the mechanism is not in the
paths I enumerated, not that the observation is wrong.

### What would settle F1 — three cheap asks

1. **The Step 3 filter bar's state in the screenshot.** If it shows a cohort
   other than `Corporate | Fixed Connectivity`, the tab-switch effect resolved a
   *different* key and null is arithmetically correct — the defect would then be
   in what restore leaves the filter bar showing, not in the gate.
2. **Whether Step 1 was visited before Step 3.** Step 1's panel derives from
   `stdSelectionFilter`, which restore does **not** set; the tab-switch effect
   overwrites `baseForecast` from `step3Filter`. The order of those two is the
   only place I can see an asymmetry arising, and it depends on navigation.
3. **Whether the columns were re-mapped after the restore.** Restore replaces
   `data` (`App.tsx:771`) and writes `setColumns`, but writes **no** `wi*Col`
   mapping. If a restore into a *fresh* session is in play, `populatedCohorts` is
   empty and everything resolves null — which would make this a different and
   larger finding than C-17's second half.

### An instrument limitation I hit twice, recorded

Two of my enumeration regexes silently excluded digits — `"spec:[a-z-]+"` missed
`spec:step1-panel`, and `set[A-Z][A-Za-z]+\(` missed `setStep3Filter`. Both were
caught and corrected, and the corrected instruments are what the results above
rest on. Recording it because an enumeration is evidence about what it found.

## Finding 2 (C-19) — confirmed, DESIGN GAP

**Mechanism, exactly.** `grep -rn "bulk_complete_retired" src/` (covering all of
`src/`) returns **one** render site: `BulkGenerateModal.tsx:443`, inside
`BulkCompletePanel`. That panel renders only under `phase === 'complete'`
(`:319`), and `setPhase('complete')` occurs only in `handleConfirm` (`:98`,
`:100`) — the bulk-generate confirmation. **Restore never opens that modal.**

**Classification: DESIGN GAP, not introduced by L.** `git log -S
"bulk_complete_retired"` shows it added in `7578038` (Session G). I checked every
commit that touches the string for any occurrence in `App.tsx`: `dbbee82`,
`53a0651`, `7578038`, `05c1b3c` — **all zero**. The statement has never existed
outside the generate modal, so restore has never shown it.

The shape is exactly as predicted: the statement's trigger lives on the generate
path, and restore is the next caller that did not inherit it. It is also the case
where the statement matters *most* — a restored pre-Phase-3 session is precisely
where retirement changes numbers.

**Why I did not fix it this session.** The direction is clear (derive the
statement's presence from what the restored store contains — All-bearing fitted
entries and coverage state — not from which path populated the screen), but it
needs a **surface decision** that is not mine: the modal is generate-only by
construction, so after a restore the statement needs somewhere to live. Step 1's
grey notice surface is the obvious candidate, but that surface is currently
cleared on every selection change (Session J), which would make a coverage
statement about the *session* disappear on the first filter click. That is the
same "one state, two meanings" problem as F1, and worth deciding once for both.

## Fold-in — the writer enumeration, and what it reveals

The expectation was "after L, compare mode should be the only writer". **There
are seven `setForecastData` sites at HEAD:**

| line | enclosing function | classification |
|---|---|---|
| 1947 | `handleFileUpload` | clear on new upload — legitimate |
| 2034 | `onSelectCohort` | writes `savedForecasts[cohortId]` — **dead for the panel** |
| 2304 | `generateStandardForecast` (compare) | compare mode — the permitted writer |
| 2396 | `generateStandardForecast` (compare) | compare mode — permitted |
| 2488 | `generateStandardForecast` (compare) | compare mode — permitted |
| 2585 | `generateStandardForecast` (legacy multi-combo) | **dead for the panel** |
| 2747 | `generateStandardForecast` (single-cohort manual) | **dead for the panel** |

`stdPanelRows` reads `forecastData` **only** when `compareCategories.length > 0`.
So four of the seven writes no longer reach the panel at all. They are not
harmful, but they are exactly the "convenience write" the pin is meant to trip —
and three of them predate L rather than being introduced by it.

**Recommended pin (not written this session):** a spec check enumerating all
`setForecastData` sites with a pinned count of 7 and each classified by enclosing
function, so a new one fails rather than passing silently — the same shape as the
existing `setBaseForecast` enumeration in `spec:import-seam`. The four dead
writes are a separate cleanup decision: deleting them is a behaviour change to
compare mode's entry/exit and to `onSelectCohort`, which deserves its own pass.

## What did not change

No fix was written, so nothing needs regression cover this session. For the
record, the C-17 Step 1 fix and its mounted specs are untouched: `spec:step1-panel`
and the rest of the suite were last measured green at this HEAD during the
context-document verification earlier today (23 suites, 786 checks, guard-traps
33/33, traps 3/3, typecheck 0). I did not re-run them, because nothing changed.

## Where the walk stands

**Unchanged: C step 17 onward.** No fix has landed, so nothing has moved. Section
C's two findings are now diagnosed rather than fixed:

- **C-17 second half** — held pending the three asks above.
- **C-19** — mechanism established; needs a surface decision before implementation.

Sections A 8–10 and C-17's Step 1 half remain as Session L verified them; they
were mounted then and nothing in this session touched their paths.

# Section B — two fixes, both mechanisms demonstrated before they were touched

## FOR ADVISOR

```
Generated: 2026-08-08 22:05 +0100 (UTC 2026-08-08 21:05)
Certifies: the working tree on main, base 27cce36. NOT YET COMMITTED at write time.
FIX 1 SHIPPED: aggregate generates raise the completion panel again. G's early
  return and its retirement semantics are UNCHANGED — only the trigger is restored.
FIX 1 DEFECT FOUND IN MY OWN FIX: a scoped run's `failed` and `skipped` are the SAME
  leaves, so the panel double-counted uncovered. Fixed with a `grain` marker.
FIX 2 SHIPPED: nav label corrected to `nav_overall_forecast`. TARGET UNCHANGED —
  that site is the ONLY one setting 'overall'; repointing it would shut the door.
DECISION (2) FROM THE DIAGNOSIS NOT TAKEN, as instructed. No interim door built.
NEW SPECS: spec:bulk-completion 18/18 (mounted, production-fed), spec:nav-target 13/13
GUARD-TRAPS 39/39, traps 39/40/41 new, each demonstrated RED then restored
TRAP 39 IS CAUGHT BY THE WIRING HALF, NOT THE MOUNT — stated in the spec, not implied
qa-tester FOUND A DURABILITY GAP: the leaves count is safe only because classifySkip
  never returns null for a falsy forecast — a reason living outside the modal. Pinned
  with an executed check + control; demonstrated red on the exact drift.
RE-MEASURED not quoted: 74 leaves / 72 fit / 2 unfittable; ARPU MAPEs 13.8845 /
  13.4315 / 14.3888 / 13.0192, spread 1.3696pp. No earlier figure moved.
GATE: ui-consistency PASS, qa-tester PASS, regression-guard SAFE FOR USER TESTING
26 specs green, lint clean, build clean, i18n parity 0 missing, §33 AI gate PASS
  (scope: working tree and build output only; history/remotes out of scope)
BACKLOG RECORDED ONLY, not fixed: arpuOf's `?? 0`; Model Advisor aggregate copy
PROCESS FAILURE: qa-tester ran guard-traps concurrently and stranded mutations in two
  untouched files. Restore verified by me. Rule folded into both gate agents.
Decisions needed: none. Merge is Jon's call.
State: gate green, uncommitted at write time. Walk resumes at B-11 — see below.
```

---

## Provenance

Base `27cce36`, branch `main`. Scoped entirely by
`reports/2026-08-08-1624-section-b-diagnosis.md` — both mechanisms were
demonstrated there, so this session implemented and did not re-diagnose.

## Fix 1 — the post-generation prompt, restored for aggregate selections

### The mechanism, as diagnosed

`generateStandardForecast`'s aggregate branch returns before
`setTriggerBulkCheck` (App.tsx 2689/2756). Session G (`7578038`) introduced the
early return; pre-G at `67eca3b` the path fell through. Leaf generates always
kept the prompt. Nothing in G's report suggests the loss was intended.

### What was built

The aggregate branch now records its finished run:

```ts
setBulkCompletedRun({ grain: 'leaves', generated: res.generated,
                      failed: res.failed, skipped: res.skipped });
```

`BulkGenerateModal` gained `initialSummary`, opening straight at its COMPLETE
phase rather than at CONFIRM. **G's decline is untouched** — the early return and
its retirement semantics stay exactly as they were. Only the trigger is restored,
which is what was asked.

### A defect in my own fix, caught before it shipped

The first spec run came back 13/2. `uncovered` read:

```ts
const uncovered = skipped.length + failed;
```

That is correct for the whole-book path, where `failed` counts chart series that
errored and `skipped` names cohorts that were never attempted. It is **wrong for
a scoped run**, where the worker increments `ibroFailed` and pushes to `skipped`
for the *same leaf* — so the sum counts every uncovered leaf twice.

Fixed by threading a grain marker rather than by patching the number:

```ts
const uncovered = grain === 'leaves' ? skipped.length : skipped.length + failed;
```

The two populations are genuinely different and now say so. This is the grain
discipline the codebase already applies to chart series (5-part) versus forecast
leaves (7-part), applied to a count that had quietly conflated them.

### The invariant that correctness rests on — pinned, not trusted

qa-tester found the real fragility, and it is worth stating plainly: dropping
`failed` on the leaves path is safe **only because** `classifySkip` never returns
`null` for a falsy forecast, so every `ibroFailed++` is paired with a
`skipped.push`. That reason lives in `forecasting.ts`; the count lives in
`BulkGenerateModal.tsx`. **The reason a thing is safe living outside the thing**
is the third-instance rule, and the next person to edit `classifySkip` would not
inherit it.

So it is exercised rather than commented:

```ts
const falsy: unknown[] = [null, undefined, 0, '', false, NaN];
check('INVARIANT: no falsy forecast is ever classified as a success',
  falsy.every(f => fc.classifySkip(populated, f) !== null),
  'a leaf can now fail WITHOUT being named in skipped - uncovered under-counts');
```

with a positive control, so it cannot pass vacuously. Demonstrated: relaxing
`if (forecast)` to `if (forecast !== null)` turns it red on exactly that check.

## Fix 2 — the nav label, and why the label moved rather than the target

The button labelled `t('standard_forecast')` called `setActiveView('overall')`.
Both halves named a real screen; they named **different** screens.

**The label moved.** Measured before choosing: `setActiveView('overall')` has
**exactly one** site, `setActiveView('standard')` has **six**. Repointing the one
would have made the Overall Forecast view — and the Generate Missing door on it,
which is B-11's entry — unreachable. Retargeting would have destroyed a route to
fix a word.

`spec:nav-target` asserts label and target **as a pair**, because each half alone
looks fine and only together do they disagree. It carries an anti-vacuity control
(the old label must not itself read as "overall") and route counts on both views.

## What was NOT done, deliberately

**Decision (2) from the diagnosis** — giving the coverage statement a door that
does not depend on `missing > 0` — **was not taken**, as instructed, and no
interim door was built. It remains C-19's DQ-phase orientation line. Fix 1
narrows when that gap is visible; it does not close it, and pretending otherwise
would let a queued requirement quietly drop.

## Two backlog entries — recorded, not fixed

**`arpuOf`'s `?? 0`** (`forecasting.ts:1301`). A leaf month with no ARPU band
contributes zero ARPU carrying full volume — the structural form of the
absence-propagation rule. It does **not reproduce** on any shipped fixture: 0.0%
of month-0 volume, 0 of 27 leaves. Real in the code, unexercised in the data.
Fixing it blind would destroy the evidence the open F2-ARPU question still needs,
so it rides with that resolution.

**Model Advisor copy on aggregates.** The advisory is behaviourally correct —
it backtests, never fits, never writes. The *copy* reads as though the aggregate
was fitted, which is the belief Phase 3 exists to prevent. Deferred to the copy
batch's successor: six locales of unreviewed wording does not belong inside a
two-mechanism fix session.

## Gate

| stage | verdict |
|---|---|
| ui-consistency | PASS — i18n via `t()`, both keys in all six locales, nothing deleted, no invented classes |
| qa-tester | PASS — grain arms independently counted, no double-raise, no new store writer |
| regression-guard | **SAFE FOR USER TESTING** |

26 specs green; `guard-traps` 39/39; `traps` 3/3; lint and build clean; i18n
parity 0 missing. §33 reported with its scope named: **main's working tree and
build output are AI-free**; history and remote branches are out of scope and the
preserved `ai-capability` branch is expected, not a leak.

### Figures — re-measured, not quoted

```
PINNED ARPU MAPEs: 13.8845 / 13.4315 / 14.3888 / 13.0192   spread 1.3696pp
generate-missing spec: 38 passed, 0 failed   (74 leaves, 72 fit, 2 unfittable)
setActiveView('overall'): 1 site    setActiveView('standard'): 6 sites
```

No earlier figure moved.

## Where the instruments do and do not reach

**Trap 39 is caught by the wiring half, not the mount.** The spec hands the modal
its summary as a prop, so replanting G's severance leaves the mounted checks
green. Session M hit this and fixed it by extracting the function under test;
here the App side is state plumbing inside a promise callback with nothing pure
to extract, so the wiring guard is the honest instrument. **That is written into
the spec's header**, because a reader who assumes the mount is watching it would
be wrong.

Not exercised: a live browser click-through. The specs mount the real component
tree with production-fed data; they are not a walk.

## Process failure, and what was done about it

qa-tester ran `guard-traps` a second time because the first exceeded a tool
timeout. The two instances raced and stranded mutations in
`src/utils/forecasting.ts` and `src/utils/viewFilter.ts` — files this session
never touched — producing an `[INCONCLUSIVE] control. The spec is RED on the
unmutated tree` that reads exactly like a product defect.

The agent restored both files. **I verified the restore myself** rather than
accept the claim: `git status --short` shows neither file modified, and
regression-guard independently re-measured the tree afterwards.

That constraint existed only in my prompt, which means it would have run once and
vanished. **It is now folded into `.claude/agents/qa-tester.md` and
`.claude/agents/regression-guard.md`** with the failure recorded as the reason —
run once sequentially, check `git status` either side, and suspect the harness
before the product when the control goes red.

One further note in the same spirit: my own gate prompt told regression-guard the
tree was 13 modified files. It is 12 — I had listed an untracked spec inside the
modified group. The agent checked rather than adopted the figure and said so.
That is the behaviour the count was there to elicit.

## Resuming the walk — B-11 re-run instructions

Section B step 11 is the one to re-run, and it now has two doors to check.

1. **Load a fixture with missing cohorts.** Capture the row count at step zero —
   it identifies the horizon, not the file, so note the filename too.
2. **The door that was mislabelled.** Top nav now reads **"Overall Forecast"**,
   not "Standard Forecast". Confirm it lands on the Overall Forecast view and
   that **Generate Missing** is present there.
3. **The door that was severed — the actual fix.** From **Step 1**, select an
   **aggregate** scope on a mapped dimension and generate. The completion panel
   must now appear, showing: the coverage statement, **"forecast leaves
   generated"** (not "series"), each skipped leaf named with its reason, and the
   retirement line where applicable.
4. **Check the count, not just the panel.** Uncovered must equal the number of
   named skipped leaves — **not twice that**. This is the defect found and fixed
   mid-session; it is the thing most worth a human eye.
5. **Close it and confirm it stays closed** — it must not reappear on the next
   render.
6. **Still expected to be absent:** on a fully covered book the coverage
   statement remains unreachable. That is C-19, queued to DQ, not a regression.
7. **While in the ARPU chart**, capture the two inputs that close the open F2
   question: which fixture is loaded, and whether the chart is on the **blended**
   ARPU view or a **per-scenario** one.

Sections A and C stand as last verified (Session M); D and E as written in the
Session I report.

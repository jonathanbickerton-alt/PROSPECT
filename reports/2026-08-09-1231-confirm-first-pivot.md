# Design pivot — no multi-leaf run starts without a confirmed settings step

## FOR ADVISOR

```
Generated: 2026-08-09 12:31 +0100 (UTC 2026-08-09 11:31)
Certifies: working tree on branch design-pivot-confirm-first, base a880356.
BASE PREMISE CORRECTED: section-B fixes are NOT on main (main b835006; a880356
  unmerged on section-b-fixes). This stacks on it; that merge is still outstanding.
PIVOT SHIPPED: both doors open BulkGenerateModal at CONFIRM, run only on confirm.
  initialSummary/bulkCompletedRun deleted. Engine untouched: restrictToLeafKeys.
SINGLE-COHORT MANUAL GENERATE EXCLUDED and unchanged, as specified.
DEFECT 4 MECHANISM: handleClose restored phase from the initialSummary it was
  CLOSING with, and the modal stays mounted — so the next open from EITHER door
  showed stale results. Not merely the intended open-at-COMPLETE.
STRUCTURALLY ELIMINATED: reset moved ON OPEN, in a useLayoutEffect. Trap 42 proves it.
TRAP 42 MISSED FIRST TIME: handleClose also reset, so neither reset was
  load-bearing. Duplicate removed — the design simplified because the trap refused.
SETTINGS TRUTH — REAL DEFECT: panel displayed Step 1 sidebar values (1.0/1.0)
  while every bulk run applied gen* (2.0/5.0), hidden by auto-per-cohort defaults.
  Auto options ARE real. DISPLAY corrected to applied — the reverse moves figures.
GRAIN FIX and classifySkip INVARIANT preserved; describeScope extracted to
  viewFilter.ts (pure, exported) after stage 2 could only read it.
GUARD-TRAPS 41/41; 39 replaced (old target gone), 42/43 new, each shown red.
RE-MEASURED: 74/72/2; MAPEs 13.8845/13.4315/14.3888/13.0192. Unmoved.
GATE all three PASS / SAFE FOR USER TESTING. One ui-consistency blocker rejected:
  42 of 45 bulk_* keys were already English-identical in de before this branch.
DECLARED GAP: no live click on App's own Step 1 button; that half is source-checked.
Decisions needed: whether to merge section-b-fixes to main first.
State: gate green. Walk resumes at B-11 — fresh instructions at the end.
```

---

## Provenance and one correction to the brief

Base `a880356`, branch `design-pivot-confirm-first`.

The brief said to base on "the merged section-B fixes". **They are not merged.**
`main` is at `b835006`; `a880356` is on `section-b-fixes`. Nothing about the work
changed — this branch stacks directly on `a880356` — but the section-B merge is
still outstanding and is not something this session took on its own initiative.

## The decision, and what it supersedes

No run that fits more than one leaf begins before the user has seen and
confirmed the settings it will use. Step 1's "Generate N missing" opens
`BulkGenerateModal` at CONFIRM, pre-scoped to the selection, with a header that
names the scope and the count. Both doors now share one lifecycle.

This supersedes the open-at-COMPLETE entry built the day before. That design was
deliberate and its argument was sound *about the completion panel* — the work is
done, so a confirm would be offering to do it again — and silent about the
decision, which it treated as settled before the user had seen anything. Recorded
in EXPECTED.md with the supersession stated, because otherwise the repo carries
two arguments and no way to tell which is current.

**The engine-level decision is untouched.** `restrictToLeafKeys` still scopes the
one generator; no second fitting path; nothing written under an All-bearing key.
Only the door moved. **The single-cohort manual generate is excluded and
unchanged** — its settings are inline and adjacent, so a modal would add a step
and no information.

## Item 4 — the observed defect, diagnosed before building over it

The prime suspect in the brief was residue forcing COMPLETE on a later open. That
is what it is, and the mechanism is one line:

```ts
setPhase(initialSummary ? 'complete' : 'confirm');   // handleClose, pre-pivot
```

`handleClose` restored phase from the prop it was **closing with**. The component
**stays mounted while closed**, so after a Step 1 run it sat at `'complete'`
holding that run's summary. Reopening from either door rendered results with
stale numbers and no settings step, because the sync effect only fired
`if (initialSummary)` and by then it was null.

So Jon's symptom had two contributions: the intended open-at-COMPLETE on the
first run, and a genuine residue defect on every open after it. The second was
not intended by anything.

**Does the pivot eliminate it structurally?** Yes, and not merely by deleting
`initialSummary`. The reset now runs **on open**:

```ts
React.useLayoutEffect(() => {
  if (!isOpen) return;
  setPhase('confirm'); setSummary(null); /* … */
}, [isOpen]);
```

`useLayoutEffect` rather than `useEffect` deliberately: a reset after paint
renders one frame of the previous run's results, which is a milder version of
the reported "flash". Freshness now depends on nothing — not on which door the
user left by, not on a prop.

**Proven, not asserted.** Guard-trap 42 makes the reset conditional on there
being no leftover summary, and the transition spec goes red on exactly the two
checks that matter.

### One thing the trap taught, which changed the design

Trap 42 was **MISSED** on its first run. Not because the spec was weak — because
`handleClose` *also* reset, so the mutation was inert. Two resets, and neither
load-bearing: remove either and everything stays green while the guarantee rests
silently on the other. That is the shape this codebase keeps naming — a thing
safe for a reason living outside it.

So the duplicate was removed. `handleClose` now only closes, the reset happens
once on open, and the trap bites. The design got simpler because the trap refused
to pass.

## Item 3 — settings truth, and a real defect

**What a scoped missing run actually uses at HEAD:**

| shown in the panel | what the run applied | same? |
|---|---|---|
| `preHorizonUncertainty` 1.0 | `genPreHorizonUncertainty` 2.0 | **no** |
| `postHorizonExpansionRate` 1.0 | `genPostHorizonExpansionRate` 5.0 | **no** |
| `confidenceHorizon` 3 | `confidenceHorizon` 3 | yes |
| `stdForecastLength` 24 | `genLength` 24 | by coincidence |

`onConfirm` sends only `{name, comment, autoModel, autoConfidence}` — never the
numbers — so `options?.preHorizonUncertainty ?? genPreHorizonUncertainty` always
took the fallback. **The panel displayed Step 1's single-cohort sidebar values
for a run that used the generator's own.**

**Why nobody saw it:** the auto-per-cohort options default to on and replace both
numbers with "Auto-configured per cohort". Turn auto off and the panel showed 1.0
while 2.0 was applied. This is exactly the failure the brief suspected, and it is
part of why the pivot happened — a confirm panel that lies is worse than no
confirm panel.

**The auto-per-cohort option is real**, honoured by the generator per cohort. A
panel naming a single model or z-score for a run that chooses per cohort would be
a second version of the same lie, so the auto rows stay.

**The display was corrected to the applied values, not the reverse.** Making runs
honour 1.0/1.0 would change every forecast they produce, and this session moves no
figure. Guard-trap 43.

**Also found:** the confirm button rendered hardcoded English, "Generate N
Forecasts" — untranslated, and wrong about grain once Step 1 arrives here, since
a scoped run produces leaves. Now `t()` and grain-aware.

## What the specs assert, and where they stop

`spec:bulk-completion` 40/40, mounted and production-fed, drives **both doors**
through a real DOM click.

The load-bearing check is not "a confirm panel appears" — a modal that renders one
and generates anyway would pass that. It is that the panel **appears and waits**:

```
SCOPED: NOTHING HAS RUN — the modal is waiting, not reporting
SCOPED CONTROL: a confirm button is present to wait on
SCOPED CONTROL: and clicking it DOES start the run
```

Without the controls, "never ran" would pass for a dead button.

Also covered: the transition (run → Done → reopen → CONFIRM, no residue, nothing
re-run), both grain arms read off the rendered panel, and `describeScope` driven
on both aggregated encodings — `segment` carries the literal `'All'` while the
L1/L2 pairs carry `null`, and dropping only one would name a scope the run does
not have.

**Where they stop.** The mounted half proves the component; the App half —
which door sets what state — is verified by source-pattern checks against
App.tsx. Stage 3 declared this rather than folding it into its verdict: no live
click on App's own Step 1 button was performed. Both halves exist, neither covers
the other, and it is written in the spec header so a reader does not assume
otherwise.

## Changes to existing instruments — re-anchored, not relaxed

`spec:walk-fixes` went red on two Session J checks when the scoped run moved from
the button into `onConfirm`. **That is the checks working**: they pin a site, so
relocating the run tripped them. Substance is unchanged — same call, same
hand-off, same unfittable bookkeeping — so they were re-anchored to where the run
now lives, with a note saying why. A check that had merely searched the whole file
would have stayed green and told nobody the run had changed hands.

Trap 39's original mutation targeted `setBulkCompletedRun`, which no longer
exists; it would have gone MISSED for want of a thing to break. Replaced with the
trap the pivot needs: Step 1 generates on click without confirmation. It then went
**INCONCLUSIVE** mid-session when its anchor line changed under it, and was
re-anchored to a stable prefix — an inconclusive trap protects nothing and fails
quietly in the direction of looking fine.

## Gate

| stage | verdict |
|---|---|
| ui-consistency | PASS on all structural checks |
| qa-tester | PASS — both doors traced, grain counted independently, no new store writer |
| regression-guard | **SAFE FOR USER TESTING**, one declared gap |

41/41 guard-traps; `traps` 3/3; 26 specs green; lint and build clean; i18n parity
0 missing. §33 with its scope named: **main's working tree and build output are
AI-free**; history and remote branches are out of scope and the preserved
`ai-capability` branch is expected.

**One ui-consistency finding I did not accept as a blocker.** It reported the five
new keys carrying English text in the five non-EN locales as a critical failure.
Measured: **42 of 45 `bulk_*` keys were already English-identical in `de` before
this branch**, and the scanner's own parity gate passes. The new keys match the
established state exactly; the standard applied would fail 42 pre-existing keys
the same way. Real translation debt on this surface, not introduced here, and it
belongs with the copy batch.

### Figures — re-measured, not quoted

```
PINNED ARPU MAPEs: 13.8845 / 13.4315 / 14.3888 / 13.0192   spread 1.3696pp
generate-missing spec: 38 passed, 0 failed   (74 leaves, 72 fit, 2 unfittable)
bulk-completion 40/40   walk-fixes 82/82   guard-traps 41/41
```

No earlier figure moved.

## Recorded, not fixed

`pendingScopedRun` is not cleared when new data is uploaded. Stage 2 established
it is **unreachable** — an upload cannot happen while the modal blocks the page,
and every exit clears the state. Dormant, and this repo fixes where mechanisms are
demonstrated, so it is named here rather than patched blind.

## Folded back into the agent definitions

Two checks from this gate's prompt would otherwise have run once and vanished,
both now in `.claude/agents/regression-guard.md`:

- **Running a spec is evidence for what the spec mounts, and nothing wider** —
  name the boundary between what was mounted and what was read. This prompt asked
  stage 3 to say plainly whether running the spec was sufficient, and that
  produced the most useful line in its report.
- **The one place the scratch-script rule bends** — a script importing app
  modules needs repo `node_modules`, which the scratchpad cannot resolve. Stage 3
  hit this, put a temp file in `scripts/`, deleted it and disclosed it. That is
  the right handling, so it is now written down with the obligations attached.

## Resuming the walk — fresh B-11 instructions

The flow has changed shape, so this replaces the previous step 11.

1. **Load a fixture with missing cohorts.** Note the filename and the row count
   at step zero.
2. **Step 1's door — the pivot.** Select an **aggregate** scope on a mapped
   dimension and click **Generate N missing**. It must open the modal at the
   **settings step** — not run, not flash, not land on results.
3. **Read the header.** It must name your scope and the count, e.g. "Generate 35
   missing leaves in Corporate". If it says "Apply to all remaining
   combinations", the scoping did not reach the header.
4. **Check the settings are true.** Turn **off** auto model / auto confidence.
   The z-score and band multiplier shown must be the ones the run applies —
   **2.0** and **5.0×**, not 1.0 and 1.0×. This is the defect fixed this session
   and the one most worth a human eye.
5. **Decline first.** Close without confirming. Nothing should have been
   generated — the count on the button must be unchanged.
6. **Then confirm.** The run proceeds to the coverage panel: the coverage
   statement, **"forecast leaves generated"**, each skipped leaf named with its
   reason, retirement line where applicable.
7. **Count check.** Uncovered must equal the number of named skipped leaves, not
   twice it.
8. **Click Done, then reopen from either door.** It must land on **CONFIRM** with
   no trace of the previous run's numbers. This is the residue defect; before this
   session it reopened at results.
9. **The other door.** Top nav → **Overall Forecast** → **Generate Missing**. Same
   lifecycle, and its counter should read in **series**, not leaves.
10. **Still expected absent:** on a fully covered book the coverage statement
    remains unreachable. That is C-19, queued to DQ, not a regression.
11. **While in the ARPU chart**, capture the two inputs that close the open F2
    question: which fixture is loaded, and whether the chart is on the **blended**
    ARPU view or a **per-scenario** one.

Sections A and C stand as last verified (Session M); D and E as written in the
Session I report.

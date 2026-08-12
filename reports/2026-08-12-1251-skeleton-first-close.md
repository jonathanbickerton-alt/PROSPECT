# The report skeleton comes before the gate

## FOR ADVISOR

```
Generated: 2026-08-12 12:51 +0100 (UTC 2026-08-12 11:51)
Certifies: records only — ZERO source files changed. HEAD at start 7eaa59b.
Repo: __PENDING__
WRITTEN SKELETON-FIRST, the rule it introduces. This block and the whole
  narrative existed before any verification ran; only the numbers and the Repo
  line were filled after. A reader finding __PENDING__ still here knows the
  session died between the checks and the fill — the signal the rule produces.
THE DIAGNOSIS: close failures here do not scatter, they CLUSTER at one position
  — immediately after guard-traps, the most expensive operation, which runs
  last. Three closes died in that window: build done, gate done, nothing kept.
AMENDMENT 1, SKELETON BEFORE THE GATE. The report is written when the build is
  code-complete, numbers as marked placeholders. This moves the REASONING to the
  cheap side of the expensive operation: a session dying post-gate loses digits,
  which re-run, not argument, which does not. A report with placeholders is not
  a defect but a precise signal of where the session died.
AMENDMENT 2, THE CHECKPOINT. One line immediately before guard-traps: skeleton
  written, close affordable. If it cannot be said honestly, shed scope THEN —
  shedding after the gate wastes the gate. This gives the budget clause a moment
  to bite: "budget from minute one" is easy to agree with while drifting past;
  a checkpoint at a named position either happened or did not.
AMENDMENT 3, NAMED RECOVERY, improvised three times before being written: the
  three-branch state check, with both branch-3 traps recorded — a run still IN
  FLIGHT looks exactly like a dead one, and every target must be checked.
Instruments: full suite 36/36, lint exit 0, src files changed 0.
```

---

## 0. This report was written before the checks it reports

Everything above and below existed **before** any verification ran, with the
numbers as `__PENDING__` markers. That is not a stylistic flourish — it is the
rule this session introduces, applied to the session introducing it. The only
edits after the checks were the numbers and the `Repo:` line.

## 1. The diagnosis: the failures cluster

Close failures in this project have a position, not a distribution. **Every one
of them landed immediately after guard-traps.**

That is not coincidence. Guard-traps is the most expensive thing a session does
and it runs at the end, so a session that is going to run short runs short
precisely there — build finished, gate finished, and nothing written down. The
work is complete and unrecoverable in the only sense that matters: nobody who
was not in the session can retrieve why any of it was done.

Three closes died in that window. The rules written in response — the
report-trigger widening, then the budget clause — were both correct and neither
moved the failure, because both addressed *whether* a report is owed rather than
*when* it gets written relative to the thing that kills sessions.

## 2. Amendment 1 — the skeleton before the gate

As soon as the build is code-complete, and **before guard-traps starts**, the
session writes the report file: full narrative, full FOR ADVISOR block,
measured numbers as marked placeholders.

```
guard-traps: __/__ PENDING
full suite:  __/__ PENDING
```

After the gate, only the placeholders are filled and the `Repo:` line added.

**The reasoning moves to the cheap side of the expensive operation.** A session
that dies post-gate then loses digits rather than argument — and digits re-run,
while reasoning does not.

**A report found with placeholders is a signal, not a defect.** It says precisely
where the session died: between the gate and the fill. It hands the next session
the entire argument with only numbers missing, which is strictly better than the
empty `reports/` directory and reverse-engineered diff it replaces.

The pre-commit rider is unchanged and still governs: a report written before its
commit says so, and does not imply a hash it cannot contain.

## 3. Amendment 2 — the checkpoint

Immediately before starting guard-traps, one line:

> *Skeleton written; close affordable — starting guard-traps.*

If that cannot honestly be said, **shed scope then** — before the expensive run.

Shedding after the gate wastes the gate. Shedding before it costs only the
increment, which is the thing the budget clause already said should go.

**This is the budget clause given a moment.** "Budget the close from minute one"
is true, easy to agree with, and easy to drift past while agreeing. A checkpoint
at a named position is a thing that either happened or did not — which is the
difference between a principle and a control.

## 4. Amendment 3 — recovery, named at last

The three-branch state check has been improvised three times. It is now in the
skill: closed / gated-but-unclosed / died-mid-gate, with the action for each.

**Both branch-3 traps are recorded, because both were paid for.**

- **A run still in flight looks exactly like a dead one.** A `git status` taken
  during a run shows mutated files, and reading it suggests a stranding that is
  not there. This happened on 2026-08-12: `src/App.tsx` read as modified and the
  diff was empty seconds later, because the run had restored it. A state check
  is part of the "everything else" that waits for the run.
- **Check every target, not the plausible ones.** The stranding that originally
  prompted the concurrency rule was in files nobody had edited, which is exactly
  what made it hard to see.

## 5. Scope and verification

**Zero source files changed** — `git diff --name-only | grep '^src/'` returns
**0**. This session touched `CLAUDE.md`, the session-close skill, and this
report.

No figure can have moved and none was re-measured; that is the basis stated
rather than a re-run claimed. No gate was run, because there is no behaviour to
gate — which is also why this session could not fully rehearse its own
checkpoint, and says so rather than implying otherwise.

| instrument | result |
|---|---|
| full suite | **36/36** npm scripts green |
| lint (`tsc --noEmit`) | exit 0 |
| src files changed | **0** |

## Where things stand

Request 2 is complete (`a50cca9` persistence, `4d8ae2b` surface) with item 3's
`?? 0` display fixes and the mounted spec held. Request 3 is designed and
unbuilt. Option (b) is queued, scoped and untouched.

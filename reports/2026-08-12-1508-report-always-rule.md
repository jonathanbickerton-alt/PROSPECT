# Every session produces a report — the condition is removed

## FOR ADVISOR

```
Generated: 2026-08-12 15:08 +0100 (UTC 2026-08-12 14:08)
Certifies: 1a2efa4, branch main, tree CLEAN.
Repo: committed 1a2efa4, pushed (origin in sync)
SKELETON CREATED AS THIS SESSION'S FIRST ACTION — before the recovery check and
  before any amendment. That ordering is the session's subject, practised before
  it was written down.
PART 1, RECOVERY — branch: THE SESSION NEVER RAN. Request 3 was never built: no
  promoBandArpuOverride, no band input, nothing in src/. The session holding
  that brief declined it on budget and closed the option-(a) work instead, which
  DID produce and commit a report (1452-one-baseline, at 57dcf04). No report is
  missing; if it did not reach Jon the gap is DELIVERY, not the record. No
  stranding, no unclosed gate, nothing to remediate.
PART 2, THE RULE, FINAL: EVERY session produces a report file. No read-only
  exception, no triviality exception, no judgment. The skeleton is the FIRST
  ACTION and is filled at close. A state check's report can be three lines; a
  died session leaves a skeleton with placeholders, and that IS the diagnostic.
FOUR CONDITIONAL REFINEMENTS — state-changing only; or findings-producing;
  except trivial checks; with a carry-forward test — each leaked at the SAME
  step, the judgment. None was wrong about WHICH sessions deserve a report; all
  were wrong to ASK, since those that most needed one were least able to spare
  the attention to decide.
DEAD LANGUAGE DELETED, not left citable: both CLAUDE.md inline-summary
  exceptions read SUPERSEDED with the reason, the skill trigger reads TRIGGER
  UNCONDITIONALLY, and grep confirms no exception clause survives.
Instruments: lint 0, src changed 0, 3 placements amended, no gate run.
```

---

## 0. The skeleton came first

`reports/2026-08-12-1508-report-always-rule.md` was created before the recovery
check ran and before a line of the amendment was written — title, `Generated:`
line, empty FOR ADVISOR block, then work.

That is the rule this session ships, practised on the session that ships it.
The previous outing of skeleton-first proved the *dying* case: a session ended
between the gate and the close, and what survived was the whole argument with
six numbers missing. This outing proves the *ordinary* case — that writing it
first costs almost nothing.

## Part 1 — recovery

The named procedure, run before anything else:

| check | result |
|---|---|
| HEAD | `57dcf04` — *Fill the Certifies and Repo lines on the one-baseline report* |
| tree | clean but for this session's own skeleton |
| origin | in sync, 0 ahead / 0 behind |
| newest reports | `1452-one-baseline`, `1333-two-baselines-diagnosis`, `1251-skeleton-first-close`, `1237-value-card-surface` |
| Request 3 artefacts in `src/` | **none** |

**Branch: the session never ran.**

The brief's premise was that the Request 3 build session "ended with no report
reaching Jon". What actually happened is narrower and better: **Request 3 was
never built.** The session holding that brief declined it on budget grounds —
correcting a base premise (`62b3c66`, which does not exist) — and used its
budget to recover and close the option-(a) baseline fix instead.

**That session did produce a report**, `2026-08-12-1452-one-baseline.md`,
committed at `57dcf04` and covering the work it actually did. So nothing is
missing from disk. If it did not reach Jon, the gap is in delivery rather than
in the record, which is worth separating: one is fixable here and the other is
not.

**No remediation applies.** No stranded mutations — the last guard-traps run
completed at 63/63 and its restore was verified. No unclosed gate. No uncommitted
build.

## Part 2 — the rule, final form

**Every session produces a report file. No read-only exception, no triviality
exception, no judgment.**

- **The skeleton is the FIRST ACTION of every session** — before the state check,
  before diagnosis, before code — and is filled at close.
- **A three-line report is a valid report.** A state check's record can be the
  three lines of the state check.
- **A died session leaves a skeleton with placeholders, and that is the
  diagnostic** — it says a session started here and did not finish, which the
  empty case never said.

### Why removed rather than tightened

**Four conditional refinements, each leaking at the same step.**

| # | the condition | how it leaked |
|---|---|---|
| 1 | state-changing sessions | a merge went unreported — it read as mechanical, not report-shaped |
| 2 | …or findings-producing | a diagnosis lived in a transcript until the next brief planned against a merge that did not exist |
| 3 | …except trivial read-only checks | a rider fixing two real defects shipped with no report, one commit before the rule was strengthened |
| 4 | …with a carry-forward test | narrower judgment, same judgment |

**None of them was wrong about which sessions deserve a report.** Every one was
wrong to *ask*, because the question has to be answered by the session, and the
sessions that most needed a report were exactly the ones least able to spare the
attention to decide. Each refinement made the question harder while leaving it in
place.

**So the fix is not a fifth condition. It is deleting the step that failed.**

### The dead language is gone, not merely outvoted

Both inline-summary exceptions in `CLAUDE.md` now read **SUPERSEDED** with the
reason, so a future session cannot cite the old rule and be technically correct.
The report-writing skill's trigger reads **TRIGGER UNCONDITIONALLY, ON EVERY
SESSION**. Verified by grep that no surviving clause offers an exception.

Three placements amended: `CLAUDE.md`'s always-on section, the session-close
skill (as `§0a`, ahead of the skeleton-before-the-gate rule it generalises), and
the report-writing skill's trigger and body.

## Gate

| instrument | result |
|---|---|
| lint (`tsc --noEmit`) | exit 0 |
| src files changed | **0** |
| placements amended | 3 |

No suite run and no gate: this session changed no behaviour, and says so rather
than implying a verification it did not perform. No figure can have moved.

§33 with the scope named: **main's working tree and build output are AI-free**
(`package.json`, `src/`, `.env`). History and remote branches are out of scope;
the preserved `ai-capability` branch is expected.

## Where things stand

**Request 3 is designed and unbuilt** — its four decisions are recorded, and its
decision 3 (an override *resolving* absence and lifting the save refusal) remains
the genuinely new ground in the arc. Request 2 is complete, with item 1's `?? 0`
display fixes and the mounted spec still held. Option (b) is queued, scoped and
untouched.

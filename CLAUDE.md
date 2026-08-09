# Model routing for subagents

Subagents inherit the parent model by default. This is wasteful — the main
session runs Opus, but most subagent work is mechanical. Route by cognitive
difficulty, not importance. All six agents matter; they do not all reason
equally hard.

## Routing table

| Agent              | Model  | Why |
|--------------------|--------|-----|
| regression-guard   | sonnet | **Escalated from haiku 2026-07-31 — see below.** Walks a fixed checklist in test-data/EXPECTED.md and reports pass/fail against concrete expected values. The reasoning is not hard; citing files and sections that actually exist turned out to be. |
| ui-consistency     | haiku  | Conformance-checking new UI against a written list of established patterns, plus lint and build. Pattern-matching, not judgment. |
| qa-tester          | sonnet | Must decide what to test from what changed, trace data flow through ForecastContext, and notice subtly wrong results — not just absent ones. This is the gate before merge; do not under-power it. |
| dependency-mapper  | sonnet | Mostly exhaustive grep-and-trace, but needs judgment on the "shared, must be retained" distinction and change sequencing. Sonnet is sufficient; Opus is overkill. |
| debugger           | sonnet | Default. Routine debugging (reproduce, log, compare, spot mismatch) is well within Sonnet. |
| ux-design          | opus   | Reasoning across an end-to-end user journey with trade-offs. Genuinely hard, produces no code, invoked rarely. Cost profile is different from the gate agents. |

### Tier changes are evidence-led

**regression-guard: haiku → sonnet, 2026-07-31.** The first tier change since
this table was written, and it was made because a specific failure recurred
after two attempts to fix it by instruction.

Two consecutive gate runs produced fabricated-but-plausible identifiers — a
module path that does not exist (`src/utils/predicates.ts` for what is
`cohortScope.ts`), five claimed exports of which one was real, and a hook name
(`useArpuToggle`) for a toggle that is `valueUnit`. **Both runs happened after
regression-guard.md gained a rule written specifically to prevent it**, and in
both the underlying conclusions were sound.

That is the shape that justifies a tier change rather than more briefing: the
reasoning held and the precision did not. A third prose instruction would have
been the wrong response to two that did not land — at some point "try harder"
stops being a fix and starts being a way of avoiding the cost.

The bar for future changes is the same. Escalate when a specific, named failure
survives an attempt to close it by instruction, not when output feels thin.
Record the evidence here, as above, so the next reader can judge whether the
reason still applies — and de-escalate on the same standard.

## Escalation rule

If the debugger runs once on Sonnet and cannot identify a root cause — or if
the bug involves subtle divergence between two code paths that should behave
identically — promote it to Opus for a second pass. Do not default it to Opus.
This is where the Opus budget belongs.

## Efficiency rules

- Do not invoke a subagent for small, contained checks. Subagent architecture
  adds overhead (system prompt + tool definitions reloaded per agent), so for a
  quick two-file check the main thread is cheaper. Reserve subagents for
  genuinely high-context work: full regression sweeps, whole-codebase
  dependency maps, end-to-end test runs.
- During active building on a branch, run only the targeted check for what
  changed. Reserve the full gate (ui-consistency → qa-tester →
  regression-guard) for the pre-merge checkpoint.
- Agents must read test data from a path, never have it pasted into context.
  Pasted content is reprocessed on every subsequent message.
- Use the trimmed test fixture for routine agent runs. The full 80k-cohort file
  is only needed for pre-merge validation and bulk-generation testing.
- Agents write scratch scripts to the scratchpad directory, never into the
  repo. A harness left in the repo root becomes untracked clutter that hides
  genuinely unexpected entries in `git status`.

## Folding gate checks back into definitions

Any check that proves useful in a gate prompt gets folded into the relevant
agent definition **at the end of that gate** — not left in conversation
history.

A check that lives only in a prompt runs exactly once and then vanishes with
the conversation. The agent definitions encode what went wrong in previous
sessions; improvised prompt checks encode what is going wrong in this one,
and that is usually the more valuable of the two. Every check that caught a
real defect in the pro-rata gate — the hook dependency-array read-set, measure
-don't-reimplement, declare-what-you-could-not-exercise, the vacuous-result
trap, verify-counts-independently, and no-parallel-implementations — existed
only in an improvised prompt and would never have run again.

When a gate finishes, ask of each check that earned its place: does this live
in the agent definition, or only in the prompt I just wrote? Move it.

## Reserved decisions

When I reserve a decision — "show me X before doing Y", "tell me which it is
before acting", "report back and I'll choose" — that decision stays reserved
**even where the answer looks self-evident**. Report and wait.

The evidence being overwhelming is not an exception. Neither is the change
being trivially revertable, nor the alternative contradicting some other goal
I stated in the same breath. If a reserved decision appears to conflict with
another instruction, that conflict is itself the thing to report — it is not
a licence to resolve it unilaterally.

Specifically: keeping `git status` clean is never a reason to make a call I
asked to make. A dirty working tree is a cheap, visible, entirely reversible
state. A decision taken out of my hands is none of those things.

## Reporting conventions

Every session report is **also** written to
`reports/<yyyy-mm-dd-HHMM>-<topic>.md` and committed. A report that exists only
in a chat transcript is not retrievable by anyone who was not in the session,
and is lost at compaction.

### What triggers a report: CHANGED STATE, not the size of the task

**Any session that changes repo state ends by writing a report file.** Changing
state means committing, merging, moving HEAD, or mutating any file — tracked or
not. There is no size threshold and no category of change too small to record.

**An inline chat summary is sufficient only for a strictly read-only session** —
a question answered, a file inspected, a measurement taken and nothing written.
The moment anything is written, so is a report.

**This rule exists because a merge went unrecorded.** Two branches were
fast-forwarded onto main, verified against the gated tree, and the whole suite
re-run on the result — and none of it produced a file, because the task read as
mechanical rather than report-shaped. The work was sound; the record was
retrievable only from a transcript. That is the exact failure the convention
above exists to prevent, and it went straight past it, because "session report"
sounds like something a *session* produces and not something a *merge* produces.

A short task gets a short report. Length is scaled to what happened; the file's
existence is not negotiable. Provenance is cheapest at the moment the state
changed and most expensive to reconstruct later — a retrospective record can
only report what someone still remembers measuring.

**Reports about state changes state their own limits.** If a report is written
after the fact, say so and say that nothing was re-run to produce it. If it is
written before the commit it describes, say that rather than implying a hash it
cannot contain.

`HHMM` is 24-hour local time at generation. It is in the filename so reports
sort chronologically by name alone — filesystem timestamps do not survive
copying, archiving, or a fresh clone, and several reports a day is normal.

### Timestamps are COMMAND-SOURCED, never composed

Every timestamp in a report — the `HHMM` in the filename and the `Generated:`
line — is read from the system clock at write time by running `date`. It is
never inferred from context, estimated from how long a session felt, or carried
forward from an earlier message.

**This rule exists because a stamp was fabricated.** The Session H report is
headed `21:34`; it was written at about 13:56. No timezone accounts for a
7h38m gap, so the figure was composed rather than read. The conclusions in that
report were sound, which is exactly what makes the failure worth a rule: a
plausible number in a header is not checkable by the person reading it, and the
header is the part that outlives the transcript.

It is the same species as the fabricated module paths that moved
regression-guard from Haiku to Sonnet — precision failing where reasoning held —
and the same answer applies: not "be more careful", but "read it from the thing
that knows".

**Pin the offset, do not trust the label.** Measured on this machine
2026-08-07: `date` reports `Fri Aug  7 16:48:39 GMTST 2026`, offset `+0100`,
UTC `15:48`. `GMTST` is not a real zone abbreviation — the offset is sound but
the label is malformed, so a bare local time is ambiguous to a later reader.
Therefore:

- the filename uses local 24-hour time, as before, so sorting is unchanged;
- the `Generated:` line carries the offset and UTC:
  `Generated: <yyyy-mm-dd HH:MM> <±hhmm> (UTC <yyyy-mm-dd HH:MM>)`.

Get all of it from one command so the parts cannot disagree:

```bash
date +"%Y-%m-%d %H:%M %z (UTC $(date -u +'%Y-%m-%d %H:%M'))"
```

Each report **begins** with a block titled **FOR ADVISOR**, **maximum 25 lines**,
containing only:

- `Generated: <yyyy-mm-dd HH:MM> <±hhmm> (UTC <yyyy-mm-dd HH:MM>)` as the first
  line, read from `date` — so the moment survives copying and renaming, and a
  filename is not evidence of when something was written;
- the commit hash the session certifies, or `none`;
- findings, **one line each**;
- decisions needed from Jon or the advisor, **one line each**;
- current merge/hold state.

Everything else follows below it.

The line cap is the point, not a formatting preference: this block is read by
someone who was not in the session and will not read the rest. If a finding does
not fit on one line, the line states the finding and the detail goes below the
block — never a second line inside it.

## Compact instructions

When compacting, preserve: test output, agent findings, code changes, and the
current phase from SCENARIO_PLANNING_BACKLOG.md. Discard: file contents already
read, verbose tool output, superseded reasoning.
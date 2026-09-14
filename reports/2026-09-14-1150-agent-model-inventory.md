# Agent, skill and model inventory (read-only, docs-only)

## FOR ADVISOR

```
Generated: 2026-09-14 11:50 +0100 (UTC 2026-09-14 10:50)
Verified against: HEAD ee41f23, branch main, tree CLEAN (last gated: 6fd13f8 per d5-05-held Repo line; ee41f23 is a later gated fill, 71/71 + 232/232)
Repo: committed bdf2603 (report), pushed (origin in sync); Repo-line fill commit follows
Session model: Fable 5.1 (claude-fable-5-1), effortLevel "medium" from ~/.claude/settings.json — NO RECORDED RATIONALE
debugger — reproduce/isolate/propose fix — sonnet — .claude/agents/debugger.md
dependency-mapper — map dependents before shared-logic change — sonnet — .claude/agents/dependency-mapper.md
qa-tester — test changed functionality across three steps — sonnet — .claude/agents/qa-tester.md
regression-guard — re-run previously-fixed-issue checklist, final gate — sonnet — .claude/agents/regression-guard.md
ui-consistency — conformance to PROSPECT UI patterns — haiku — .claude/agents/ui-consistency.md
ux-design — conversational design partner, no code — opus — .claude/agents/ux-design.md
Skill: artefact-verification — .claude/skills/artefact-verification/SKILL.md
Skill: fixture-handling — .claude/skills/fixture-handling/SKILL.md
Skill: report-writing — .claude/skills/report-writing/SKILL.md
Skill: session-close — .claude/skills/session-close/SKILL.md
Finding: all six agent model fields are set explicitly; none inherits; CLAUDE.md table and frontmatter agree.
Finding: CLAUDE.md line 3-4 says "the main session runs Opus"; this session runs Fable 5.1 — the doc is stale on that point.
Finding: no `model` key in .claude/settings.json, settings.local.json, or ~/.claude/settings.json; no per-session model recorded anywhere.
Finding: the only rationale for Fable is a PROPOSED trial (prompt-audit 2026-09-07, working agreement §3) — no record says this session is that trial.
No recorded rationale: session default model (Fable 5.1); effortLevel "medium"; user-level plugin agents' models (out of repo).
Decision (Jon): is Fable 5.1 as orchestrator the trial's first arm, and if so where is its usage delta being recorded?
State: docs-only inventory; nothing merged, nothing held; the report is the only change.
```

## Scope and method

Read-only. No code changed, no gate run, no python, no background tasks. Every
quotation below was read from the file named; nothing is paraphrased where the
brief asked for verbatim.

Locations searched for agent definitions: `CLAUDE.md`, `.claude/agents/`,
`.claude/settings.json`, `.claude/settings.local.json`, `~/.claude/settings.json`,
`~/.claude/agents/` (absent), and the one plugin the project settings enable
(`claude-api@anthropic-agent-skills`, which is a skill package and defines no
agents).

## 2. Agents — verbatim frontmatter

### debugger — `.claude/agents/debugger.md`

```
name: debugger
description: Use proactively when a bug is found, an error appears in the console, a test fails, or behaviour does not match expectation. Reproduces the failure, reads the relevant logs and code, isolates the root cause, and proposes a precise fix. Invoke whenever something is broken and the cause is not immediately obvious.
tools: Read, Grep, Glob, Bash
model: sonnet
```

### dependency-mapper — `.claude/agents/dependency-mapper.md`

```
name: dependency-mapper
description: Use proactively BEFORE making any change to shared logic, data structures, cohort keys, ForecastContext, or any function used in more than one place. Maps what depends on the thing being changed and what the change could affect downstream, so dependencies are considered before code is written rather than discovered as bugs afterwards.
tools: Read, Grep, Glob
model: sonnet
```

### qa-tester — `.claude/agents/qa-tester.md`

```
name: qa-tester
description: Use proactively after any feature implementation or bug fix to thoroughly test the changed functionality across all three steps of PROSPECT (Baseline Forecast, Market Events, Actuals Review). Tests data flow, filter behaviour, MAPE scoring, hierarchical dropdowns, and confirms no regressions in previously fixed issues. Invoke whenever a change has been made before the user manually tests.
tools: Read, Grep, Glob, Bash
model: sonnet
```

### regression-guard — `.claude/agents/regression-guard.md`

```
name: regression-guard
description: Use proactively after every change, no matter how small, to re-run the full checklist of previously-fixed high-risk issues and confirm none have regressed. This is the final gate before the user tests. Invoke automatically once any implementation or fix is complete.
tools: Read, Grep, Glob, Bash
model: sonnet
```

### ui-consistency — `.claude/agents/ui-consistency.md`

```
name: ui-consistency
description: Use proactively after any UI change to confirm the new or modified element matches established PROSPECT patterns — Vodafone styling, dropdown behaviour, tooltip conventions, filter sync, empty states. Catches inconsistency between a new element and the rest of the app. Distinct from design quality; this checks conformance to existing conventions.
tools: Read, Grep, Glob, Bash
model: haiku
```

### ux-design — `.claude/agents/ux-design.md`

```
name: ux-design
description: Use when considering changes to the UI or user experience, or when evaluating whether a screen or flow could be better. Acts as a conversational design partner — asks questions, walks the end-to-end journey, identifies friction, and proposes options for the user to decide between. Never changes code; produces design recommendations and rationale only.
tools: Read, Grep, Glob
model: opus
```

### Agents available to the session but NOT defined in the repo

These come from plugins enabled in `~/.claude/settings.json` (user level, not
project level). Listed for completeness because they appear in this session's
agent roster; they are outside the brief's "defined anywhere in the repo" scope
and the repo cannot govern them. Model fields read from
`~/.claude/plugins/cache/claude-plugins-official/<plugin>/<version>/agents/`:

| Agent | Plugin | model field | tools field |
|---|---|---|---|
| code-simplifier | code-simplifier | `opus` | none set |
| code-architect | feature-dev | `sonnet` | Glob, Grep, LS, Read, NotebookRead, WebFetch, TodoWrite, WebSearch, KillShell, BashOutput |
| code-explorer | feature-dev | `sonnet` | same as above |
| code-reviewer | feature-dev | `sonnet` | same as above |
| agent-creator | plugin-dev | `sonnet` | Write, Read |
| plugin-validator | plugin-dev | `inherit` | Read, Grep, Glob, Bash |
| skill-reviewer | plugin-dev | `inherit` | Read, Grep, Glob |

Built-in agents (claude, claude-code-guide, Explore, Plan, general-purpose,
statusline-setup) have no file in the repo or the plugin cache and no model
field visible to inspection; they inherit.

## 3. Skills — verbatim description lines

### artefact-verification — `.claude/skills/artefact-verification/SKILL.md`

```
description: Use before reading numbers from, or acting on, any artefact whose claims are not yet checked against the repo — an uploaded save file or fixture, a context document, a design doc, a prior report being reused, or an agent's report. Trigger on "verify this against the repo", "is this still true", "check before we install this as context", or whenever a figure is about to be quoted from something other than a fresh measurement.
```

### fixture-handling — `.claude/skills/fixture-handling/SKILL.md`

```
description: Use when touching anything in test-data/ — identifying which fixture is loaded, adding or regenerating one, choosing a fixture for a spec, or interpreting a row count. Trigger on "which fixture is this", "regenerate the fixture", "add a fixture", "the trimmed file", "the edge fixture", or when a walk step turns on identifying the loaded file.
```

### report-writing — `.claude/skills/report-writing/SKILL.md`

```
description: Use when writing any session report, gate report, diagnosis, or verification report to reports/ — anything that will be uploaded to the advisor chat or read by someone who was not in the session. Covers the filename convention, the FOR ADVISOR block, and the command that sources the timestamp. Trigger on "write the report", "report per convention", "standard report format", or whenever a session is being closed out. ALSO TRIGGER ON ANY TASK THAT CHANGES REPO STATE, whether or not a report was asked for: merge, commit, push, rebase, cherry-pick, revert, tag, branch, "land it", "merge X into main", renaming or deleting files, editing config or agent definitions, or any run that mutates a tracked file — every one of those ends by writing a report file, however mechanical the task looked. TRIGGER UNCONDITIONALLY, ON EVERY SESSION, whatever it does — build, merge, diagnosis, state check, a single lookup, or a session that answers a question and stops. There is NO read-only exception and NO triviality exception; the conditional forms of this trigger were tried four times and each leaked at the judgment step. The skeleton is created as the session's FIRST ACTION, before the state check and before any code, and filled at close; a three-line report is a valid report, and a skeleton left with placeholders is a valid diagnostic.
```

### session-close — `.claude/skills/session-close/SKILL.md`

```
description: Use when finishing a working session on a branch — running the pre-merge gate, merging to main, and recording the outcome. Trigger on "close the session", "run the gate and merge", "pre-authorized merge on a clean run", or after the last fix on a branch is committed. Covers the three-stage gate, the instrument scores, EXPECTED.md updates, the report, the record-the-merge commit, and the working-agreement document update.
```

No other `SKILL.md` exists under `.claude/skills/`. None of the four declares a
model.

## 4. Model settings — every place a model is named or selected

### `.claude/settings.json` (project)

No `model` key. The file contains only a `permissions.allow` list and:

```
  "enabledPlugins": {
    "claude-api@anthropic-agent-skills": true
  }
```

### `.claude/settings.local.json` (project, local)

No `model` key. Contains only a `permissions.allow` list.

### `~/.claude/settings.json` (user)

No `model` key. The only model-adjacent settings are:

```
  "effortLevel": "medium",
  "autoUpdatesChannel": "latest",
```

plus `enabledPlugins` (the user-level plugins listed in §2) and
`extraKnownMarketplaces`.

### Per-agent model fields

All six repo agents set one (quoted in §2): sonnet ×4, haiku ×1, opus ×1.
None reads "inherits".

### `CLAUDE.md`

Lines 1-4:

```
# Model routing for subagents

Subagents inherit the parent model by default. This is wasteful — the main
session runs Opus, but most subagent work is mechanical. Route by cognitive
```

Routing table, lines 9-17 (Model column): regression-guard sonnet,
ui-consistency haiku, qa-tester sonnet, dependency-mapper sonnet, debugger
sonnet, ux-design opus. Lines 44-47:

```
If the debugger runs once on Sonnet and cannot identify a root cause — or if
the bug involves subtle divergence between two code paths that should behave
identically — promote it to Opus for a second pass. Do not default it to Opus.
This is where the Opus budget belongs.
```

### The session itself

This session's own status reports: `You are powered by the model named
Fable 5.1. The exact model ID is claude-fable-5-1.` No env var, settings key,
or repo file selects it; it is whatever the desktop app's model picker was set
to when the session started. Two earlier reports recorded the session model as
`claude-opus-5` (2026-08-07-2237, table row "this session"; 2026-09-07-1202
line 46: "Target model: **Claude Opus 5**, what this session runs"), so the
session default has changed between 2026-09-07 and today and no report records
the change.

`.claude/launch.json` names no model (dev-server config only).

## 5. Rationale — what is recorded, with file and line

Search terms per brief ("model", "Opus", "Sonnet", "Haiku", "Fable", "sizing")
across `reports/`, `docs/`, `test-data/EXPECTED.md`; forecast-model and
CSS-sizing hits discarded.

### Per-agent choices — rationale IS recorded, in CLAUDE.md only

`CLAUDE.md` lines 9-17, "Why" column, one per agent:

- regression-guard: "Escalated from haiku 2026-07-31 — see below. Walks a fixed checklist in test-data/EXPECTED.md and reports pass/fail against concrete expected values. The reasoning is not hard; citing files and sections that actually exist turned out to be."
- ui-consistency: "Conformance-checking new UI against a written list of established patterns, plus lint and build. Pattern-matching, not judgment."
- qa-tester: "Must decide what to test from what changed, trace data flow through ForecastContext, and notice subtly wrong results — not just absent ones. This is the gate before merge; do not under-power it."
- dependency-mapper: "Mostly exhaustive grep-and-trace, but needs judgment on the "shared, must be retained" distinction and change sequencing. Sonnet is sufficient; Opus is overkill."
- debugger: "Default. Routine debugging (reproduce, log, compare, spot mismatch) is well within Sonnet."
- ux-design: "Reasoning across an end-to-end user journey with trade-offs. Genuinely hard, produces no code, invoked rarely. Cost profile is different from the gate agents."

CLAUDE.md lines 21-31 record the evidence for the one tier change
(regression-guard haiku → sonnet, 2026-07-31: two fabricated identifiers after
an instruction meant to prevent it). No report in `reports/` predates that
change; the earliest reference is a citation of it, not the original evidence.

### Hits in reports/, docs/, EXPECTED.md

- `reports/2026-08-07-1805-session-i-phase-3-close.md:40-41` — "It is the same species as the fabricated module paths that moved regression-guard from Haiku to Sonnet — precision failing where reasoning held". Cites the CLAUDE.md rationale; adds none.
- `reports/2026-08-07-2237-session-j-walk-fixes.md:8-9` — "Audit: agent model fields were ALREADY PRESENT and correct — nothing restored" / "Audit: no model key in project or user settings; no model env var set". Lines 30-37 table: six agents as today, "this session … `claude-opus-5`". Audit, not rationale.
- `reports/2026-08-08-1320-context-doc-verification.md:126-128` — "Six agent definitions with model frontmatter: debugger sonnet, dependency-mapper sonnet, qa-tester sonnet, regression-guard sonnet, ui-consistency haiku, ux-design opus. CLAUDE.md's routing table lists the same". Line 212: "~87% of cost is the Opus 5 main loop (panel attribution verified honest, no bug)". Line 200: "the two-tier structure and Fable 5 assignment" (refers to the advisor chat, not this session).
- `reports/2026-08-11-1340-context-doc-v3-verification.md:187-188` — same two usage/advisor lines, unchanged.
- `reports/2026-09-07-1202-prompt-audit.md:30` — "ITEM 3 is a PROPOSAL, not a decision: a measurable Fable-5.1-vs-Opus trial." Line 46: "Target model: **Claude Opus 5**, what this session runs." Lines 373-410 lay out the trial design: three archived briefs, both models, gate as grader, tokens per completed gated session, wall time, with the caution that "prompts written for prior models are often *too prescriptive*" for Fable 5.1 and that "a comparison at mismatched effort tells you nothing".
- `docs/PROSPECT-development-history-and-working-agreement-v3-3-16.md:135` — "**the Fable trial's second arm** (Fable 5.1 as orchestrator over Opus/Sonnet subagents) is considered only if the first arm shows a measurable difference on the project's instruments; **each trial arm records its weekly-usage delta** (read from the usage panel before and after) so the quota question is measured, not estimated". Line 348: "**After UAT, in order:** the Fable trial (calibration first; usage delta per arm; second arm only on a measured difference)".
- `test-data/EXPECTED.md:6704` — "the same failure class that moved regression-guard from Haiku to Sonnet". Citation only.
- `reports/2026-09-07-1412-python-rule-claude-md.md:44-46` — names the CLAUDE.md sections; no model rationale.
- All other "sizing" hits (2026-08-13-0938, 2026-08-20-2033, 2026-09-01-1219, 2026-09-03-1409, 2026-09-10-0750, EXPECTED.md:5559) are about work sizing or forecast quantities, not models.

### Choices with NO RECORDED RATIONALE

- **Session default model = Fable 5.1.** The working agreement schedules a Fable trial "after UAT" with a "second arm" defined as Fable 5.1 as orchestrator; nothing records that the first arm started, what it is, or that today's session is part of it. The 2026-09-07 report says the session runs Opus 5. NO RECORDED RATIONALE for the switch.
- **`effortLevel: "medium"`** in `~/.claude/settings.json`. NO RECORDED RATIONALE. The prompt-audit's own caution about mismatched effort makes this a live variable for any trial.
- **User-level plugin agents' models** (code-simplifier opus, feature-dev sonnet ×3, plugin-dev sonnet/inherit). Set by their upstream authors, not by this project. NO RECORDED RATIONALE in the repo; out of scope to supply one.

## 6. Observations for the next reader

- CLAUDE.md's opening premise, "the main session runs Opus", was true on
  2026-08-07 and 2026-09-07 and is not true today. Its escalation rule
  ("promote it to Opus for a second pass") assumes Opus is the ceiling; with
  Fable 5.1 as the parent, "inherit" would now mean Fable, which changes the
  cost argument the whole section rests on. Reported, not fixed — docs-only
  brief.
- The routing table's "Why" column is the only place per-agent rationale lives.
  It is not duplicated in any report, which is consistent with the CLAUDE.md
  rule that tier changes are recorded there.
- No repo artefact selects the session model. If the Fable trial is to record
  "usage delta per arm", the arm has to be identifiable from something written
  down; today it is identifiable only from the model line in a session's
  own status.

## Close

Nothing to gate. Report committed alone; `Repo:` line filled from the commit.

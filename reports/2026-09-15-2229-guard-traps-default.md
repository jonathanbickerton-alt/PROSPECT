# guard-traps — full is the default, targeted is opt-in; the gate wording

## FOR ADVISOR

```
Generated: 2026-09-16 00:08 +0100 (UTC 2026-09-15 23:08)
Certifies: 1bc094b (src, untouched). Harness: 0af35c6 (scripts/ + docs)
Repo: committed 0af35c6, pushed (origin in sync); src diff vs 1bc094b EMPTY
BASE 21581a2; status --short EMPTY; src diff EMPTY. Both quoted.
1 CLAUSE 6 RECORDED, EXPECTED.md alone (ab7236b), before any change.
2 FLIPPED: `npm run guard-traps` = FULL; `-- --targeted` / `-- --base`
  opt in; `--full` a no-op alias; --select-only unchanged (targeted).
3 CONTROL A, plain run, scratch ledger:
  240/240 caught, NOT RUN 0, no selection lines (33.0 min)
4 CONTROL B, --targeted, same scratch ledger:
  20/20 CAUGHT, rotation 20, NOT RUN 220 (1.7 min)
5 WORDING: CLAUDE.md gate text, session-close + report-writing skills,
  suite.ts help. Every guard-traps hit in CLAUDE.md/.claude/scripts listed.
6 LEDGER: the run commits nothing; the session commits the ledger with
  its report (session-close skill + CLAUDE.md). Tracked ledger untouched
  this session (scratch ledger used) - lastFullRun still e7c88aa.
7 NO FULL RUN FOR CERTIFICATION: nothing under test changed (src none;
  the harness only chooses mode). Control A ran all traps by design only.
SHED: nothing. Items 0-3 done.
```

## 0. Base

BASE `21581a2` (the 2109 report's `Repo:`; harness `e7c88aa`; `src` `1bc094b`). After the
skeleton (`c9cac28`, the first repo action):

```
$ git status --short
(empty)
$ git diff 1bc094b HEAD --stat -- src
(empty)
```

`git diff 1bc094b HEAD --stat -- src` is still empty at `0af35c6`.

## 1. Item 0 — clause 6 recorded

Appended under "GUARD-TRAPS TARGETED RUNS" verbatim and committed **alone** at `ab7236b`.

## 2. Item 1 — the flag flip

`scripts/guard-traps.ts`:
- **FULL is the default.** A run is targeted only when `--targeted`, `--base <rev>` or
  `--select-only` is given.
- `--full` is accepted and does nothing, so older chains that pass it still get a full run.
- `--only=` is unchanged: a FILTERED full-mode subset.
- Combining a targeted flag with `--full` or `--only=` is refused with a message.
- The no-base message now points at a full run: `npm run guard-traps`.
- The header usage and the mode block say the same.

Cheap checks before the controls: `spec:trap-anchors` 254/254 on 240 traps, so the dump mode is
untouched; `spec:survival` 27/27 with 104 first-row dereferences, so its pinned count for
`guard-traps.ts` is unchanged; both refusals printed.

**Control A — a PLAIN run (no flag) on a scratch ledger** (`scratchpad/s13-plain.out`):

```
$ npx tsx scripts/guard-traps.ts --ledger <scratch>
first line: GUARD TRAPS
240/240 caught
NOT RUN rows: 0;  [select] lines: 0;  targeted summary lines: 0
[timing-total] total_wall_ms=1978575 control_ms=275428 trap_runs_ms=1700676 plants_ms=241 restores_ms=192 traps_timed=240 traps_total=240
```

**Control B — `--targeted` on the same scratch ledger** (`scratchpad/s13-targeted.out`):

```
$ npx tsx scripts/guard-traps.ts --targeted --ledger <scratch>
first line: [select] BASE ab7236b (ledger lastFullRun) -> ab7236b+dirty; 5 changed file(s)
[select] targeted 0, rotation 20, NOT RUN 220 of 240
[control] cached green f7706a704eb4 2026-09-15T23:04:27.585Z — skipped
guard-traps targeted 20/20 CAUGHT (ids -), rotation 20 (ids 1 2 3 4 5 6 7 8 9 10 11 12 13 14 15 16 17 18 19 20), NOT RUN 220, last FULL run ab7236b+dirty 2026-09-15T23:04:27.585Z
"N/N caught" lines: 0
[timing-total] total_wall_ms=100808 control_ms=- trap_runs_ms=97882 plants_ms=18 restores_ms=13 traps_timed=20 traps_total=240
```

## 3. Item 2 — the wording

Every hit of `guard-traps` across `CLAUDE.md`, `.claude/` and `scripts/`, and what happened to it:

| where | hit | action |
|---|---|---|
| `CLAUDE.md` "THE REPORT SKELETON IS WRITTEN BEFORE THE GATE" (placeholder block) | `guard-traps: __/__ PENDING` | **kept** for a FULL run; **added** the TARGETED placeholder in clause 2's certification-line shape |
| `CLAUDE.md` (new) "WHICH GUARD-TRAPS RUN" | — | **added** before the close checkpoint. It covers: build session → `-- --targeted` / `-- --base`, certified by the verbatim line; release, docs "last gated state" and session-close → FULL, certified by `N/N caught`; a targeted figure is never the release gate; the ledger sentence (Item 3) |
| `CLAUDE.md` lines on "BEFORE guard-traps starts", "AFTER guard-traps", the close checkpoint and its quoted sentence | 5 | **unchanged**: they are about *when* the expensive run sits relative to the skeleton, which is true of either mode |
| `.claude/skills/session-close/SKILL.md` §0b placeholder | `guard-traps: __/__ PENDING` | **edited**: this close runs FULL; a targeted gate uses CLAUDE.md's placeholder |
| session-close §0b checkpoint sentence, "after guard-traps" rationale | 3 | **unchanged**: timing, mode-agnostic |
| session-close §0c branch 3 "a guard-traps run did not finish" | 1 | **unchanged**: the stranding check holds for both modes |
| session-close §1 "never run a SECOND guard-traps instance" | 1 | **unchanged**: holds for both modes |
| session-close §2 instruments `npm run guard-traps # … expect N/N` | 1 | **edited**: FULL stated, `N/N caught`, plus two paragraphs (the close runs FULL; the ledger commits with the report) |
| session-close checklist "guard-traps score recorded" | 1 | **edited**: FULL `N/N caught`, and a new ledger box |
| `.claude/skills/report-writing/SKILL.md` | 0 hits | **added** a paragraph and a checklist line: quote guard-traps in its mode's form (FULL `N/N caught`; TARGETED the whole certification line, never shortened, never the release gate). There was no hit, but it is where figures are quoted |
| `.claude/agents/qa-tester.md` :412, :418, :445, :454 | 4 | **unchanged**: the harness mutates tracked source, don't run two instances, don't read the tree mid-run. All true of both modes, and no agent runs the gate's mode choice |
| `.claude/agents/regression-guard.md` :129, :317, :323, :350, :359 | 5 | **unchanged**: the same concurrency rules, and :129 is history |
| `scripts/suite.ts` help text :15 | 1 | **edited**: it names the two modes and when each applies |
| `scripts/suite.ts` :19 ("the lesson guard-traps learned as CRASHED") | 1 | **unchanged**: history |
| `scripts/guard-traps.ts` header :4 and mode block :3550, :3552–3554 | 5 | **edited** (Item 1) |
| `scripts/guard-traps.ts` other hits: :2 title, :36–37 import, :166 history, :3566 ledger path, :3617 harness list, :3642 / :3693 / :3816 / :3824 / :3829 output strings, :3665 harness path | 12 | **unchanged**: code and history, not gate wording |
| `scripts/trap-anchors-spec.ts` :40 | 1 | **unchanged**: runs the harness in dump mode, which exits before any mode is read |
| `scripts/survival-spec.ts` :8, :103 | 2 | **unchanged**: a comment, and a pinned dereference count that is still correct (27/27) |
| `scripts/ai-hold-spec.ts` :216, :232; `base-seed-spec.ts` :28; `compare-events-panel-spec.ts` :197; `events-summary-spec.ts` :140; `leaf-grain-spec.ts` :209; `mix-card-spec.tsx` :1649; `unscored-row-spec.tsx` :13, :291 | 9 | **unchanged**: comments citing traps by number or history; no gate wording |

## 4. Item 3 — the ledger's dirtiness

**Decided and recorded at the line.** A run commits nothing, and the session commits
`scripts/guard-traps-ledger.json` in the same push as its report, so `+dirty` is never left
behind between sessions. This is written into three places:
- the session-close skill, as a §2 paragraph plus a checklist box;
- CLAUDE.md "WHICH GUARD-TRAPS RUN";
- the report-writing skill's guidance, through CLAUDE.md.

**This session's own ledger:** both controls used a scratch ledger, so the tracked ledger is
unchanged, with `lastFullRun e7c88aa` and 240/240. There was nothing to commit.

## Limits

- **No FULL run was made for certification, and none was needed.** Nothing under test changed:
  `src` has no diff, and the harness change only decides *which* traps a run executes. How a
  trap is planted and judged is untouched, and trap-anchors, survival and control B's traps all
  confirm it. Control A happens to be a complete plain run on a scratch ledger. It was run
  because a plain run's own output is the only proof of the flip, not as a re-certification.
- **The working-agreement document was not edited.** Its gate wording should follow CLAUDE.md
  at the next session-close, which by its own rule updates §3/§4.
- **Old report fill scripts in the scratchpad** parse `N/N caught` and would refuse a targeted
  run. That is intended.

# guard-traps — anchor-in-hunk selection, rotation ledger, control cache

## FOR ADVISOR

```
Generated: 2026-09-15 23:22 +0100 (UTC 2026-09-15 22:22)
Certifies: 1bc094b (src, untouched). Harness: e7c88aa (scripts/ only)
Repo: committed 21581a2, pushed (origin in sync); src diff vs 1bc094b EMPTY
Ledger lastFullRun: e7c88aa 2026-09-15T22:19:55.696Z 240/240
BASE ed4dd8e; status --short EMPTY; src diff EMPTY. Both quoted.
1 DECISIONS 1-5 RECORDED, EXPECTED.md alone (0965223), before any code.
2 SELECTION BY EXECUTION: each mutate() applied, lines diffed -> span; all
  240 located (0 unlocatable in all 5 historical registries too).
3 CONTROLS PASSED before trust: 237's anchor line edited -> selected; 50
  lines away -> not; oldest-dated trap heads rotation; NOT RUN 239 kept
  out of a 1/1 ratio; repeat run "[control] cached green ... skipped".
4 CACHE: sha256 of 55 control specs + TARGETS + harness + registry; one
  byte in a TARGET flips it to RUN. Pays only WITHIN a session.
5 FIVE SESSIONS, built selector: 78 / 10 / 17 / 9 / 12 traps; with
  rotation + control 1542 / 686 / 753 / 698 / 750 s vs 2537 s full.
6 REAL TARGETED RUN --base 88e0adb: 11.0 min, 32/32 CAUGHT (12 targeted
  + 20 rotation), NOT RUN 208; control ran (331 s, no ledger yet).
7 FULL RUN --full: 42.2 min, 240/240; output IDENTICAL to 1919's run
  (248 lines, timing lines excluded). Recorded as lastFullRun.
8 DECISION NEEDED: plain `npm run guard-traps` is now TARGETED. Gate and
  release blocks, and the session-close skill, must say `-- --full`.
9 FINDING: traps 122 and 227 span thousands of lines (122: 6888-9267),
  so they are selected in almost every WhatIfTab session.
SHED: nothing. Items 0-3 done.
```

## 0. Base

BASE `ed4dd8e` (the 1919 report's harness commit; `src` at `1bc094b`). After the skeleton
(`e3e5d1d`, the session's first repo action):

```
$ git status --short
(empty)
$ git diff 1bc094b HEAD --stat -- src
(empty)
```

The session's STOP was any `src/` change. `git diff 1bc094b HEAD --stat -- src` is still
empty at `21581a2`, and every run left `git diff --stat -- src` empty.

## 1. Item 0 — decisions recorded

"GUARD-TRAPS TARGETED RUNS (Jon, 2026-09-10; built 2026-09-15)", clauses 1–5 verbatim,
committed **alone** at `0965223`, before any harness change.

## 2. Item 1 — selection by execution, the ledger, rotation

**Built** in `scripts/guard-traps-select.ts` (new) and `scripts/guard-traps.ts`, committed
`e7c88aa`, +385/−45:

- **Anchor location by execution.** For each trap, `mutate()` is applied to the target's
  text and the result is diffed line by line against the original; the differing lines are
  the span. No anchor is read from source text, so the class of 16–17 unparseable anchors
  from 1919 is gone. All 240 were located today, and in each of the five historical
  registries (below) the count unlocatable was **0**.
- **A trap is selected** when any of these holds:
  - **hunk:** its span intersects a hunk of `git diff -U2 BASE -- <target>` (BASE against
    the working tree, so an uncommitted change counts);
  - **spec-changed:** its target spec is in the diff;
  - **added / edited:** its registry entry is new, or its text hash (comments excluded)
    changed;
  - **anchor-moved:** its span's text differs from the ledger's recorded span (a pure line
    shift is not a move);
  - **anchor-missing / mutate-threw:** it plants nothing or throws today, so it runs and
    reports INCONCLUSIVE or CRASHED.
- **Rotation:** the N (default 20) oldest `lastRunDate` not already selected. Never-run
  traps count as oldest, with ties broken by id.
- **Modes.**
  - *Default* is **targeted** against the ledger's `lastFullRun`; `--base <rev>` overrides.
  - `--full` is today's run.
  - `--only=` is unchanged (a FILTERED full-mode subset).
  - `--select-only` prints the selection and the control decision and plants nothing.
  - `--scratch target=file` substitutes content for selection only, and is refused without
    `--select-only`.
- **Output.**
  - The selection prints **in full before the control and before the first plant.**
  - A targeted run prints each trap's state, **NOT RUN** per trap, and clause 2's line.
  - It never prints the `N/N caught` line other scripts parse.
- **Ledger** `scripts/guard-traps-ledger.json` (tracked): per trap `{lastRunHash, lastRunDate,
  lastState, anchorSpan}`, advanced **only** for traps that ran, whatever the state. A FULL
  unfiltered run records `lastFullRun`, and a green control records its hash. HEAD's hash
  is suffixed `+dirty` when tracked files other than the ledger differ.

**Controls, quoted before any selection was trusted** (`scratchpad/s12-controls.out`):

```
C1 POSITIVE  trap 237's anchor line (3172) edited in a scratch copy, anchor text intact
[select] 237  hunk src/components/WhatIfTab.tsx:3172-3172  ->  scripts/campaign-delete-mounted-spec.tsx
[select] 238  hunk src/components/WhatIfTab.tsx:3173-3173  ->  scripts/campaign-delete-mounted-spec.tsx
[select] targeted 2, rotation 20, NOT RUN 218 of 240
C2 NEGATIVE  line 3222 (50 lines away) edited
[select] targeted 0, rotation 20, NOT RUN 220 of 240
C3 ROTATION  scratch ledger: 240 traps dated 2026-09-15, trap 150 dated 2026-09-01
[select] rotation 20: 150@2026-09-01T00:00 1@2026-09-15T00:00 2@… 19@2026-09-15T00:00
C4 NOT RUN   a real targeted run, --rotation 1, scratch ledger
[select] at output line 2; the first trap state at line 8
guard-traps targeted 1/1 CAUGHT (ids -), rotation 1 (ids 1), NOT RUN 239, last FULL run (none recorded)
NOT RUN lines: 239   '/N caught' lines: 0
C5 CACHED    the same run again
[control] cached green 77bd4b766a93 2026-09-15T21:25:05.419Z — skipped
guard-traps targeted 1/1 CAUGHT (ids -), rotation 1 (ids 2), … (total_wall_ms=10670)
```

- **C1** selected 238 as well, because its anchor line 3173 sits inside the two lines of
  context. That is the rule working as briefed, not a leak.
- **C5** also shows the rotation advancing: trap 1 now had a date, so trap 2 came next.
- **Trap-anchors' aged-out check** still runs inside the control. `TRAPANCHORS` is in
  `CONTROL_SPEC_MAP`, and `spec:trap-anchors` read 254/254 after the change.
- **Refusals:** `--scratch` without `--select-only`, and `--full --select-only`, both exit
  with a message.

**The control list became ONE named list.** `CONTROL_SPEC_MAP` was generated mechanically from
the `||` expression, keeping its order and comments. The patch refused unless there were exactly
55 unique names. The control runs `Object.values(CONTROL_SPEC_MAP).some(specFails)` (same
short-circuit, same order), and the cache hashes the same list, so the two cannot drift.

## 3. Item 2 — the control cache

The key is sha256 over the sorted control spec files (55), every TARGET file, `guard-traps.ts` +
`guard-traps-select.ts`, and the registry (each trap's id and `mutate` source). It is taken
**before** the control runs, recorded with the date when the control is green, and compared
exactly.

```
C6  one byte appended to .env.example (a TARGET, via --scratch)
[control] would RUN — hash 39de4801495b differs from the last green 77bd4b766a93 2026-09-15T21:25:05.419Z
    unchanged
[control] cached green 77bd4b766a93 2026-09-15T21:25:05.419Z — would be skipped
```

The real-run form of the same fact is C5 above: a repeat run printed the cached line and ran no
control. **The cache pays only within a session.** A build session changes TARGET files
(`WhatIfTab.tsx`, the locales), so its first targeted run after an edit always runs the
control. What saves time across sessions is the **selection**, not the cache.

## 4. Item 3 — measured

**The built selector against the five sessions 1919 costed.** Each session's **own registry was
executed at its own HEAD**: a scratchpad copy of that commit's harness, with target files read
from git at that commit. Hunks come from `BASE..HEAD`. Costs use 1919's measured per-spec means,
with rotation 20 × 9.05 s and control 364 s (`scratchpad/s12-sessions.json`):

| session | registry | targeted | reasons (a trap may carry several) | trap s | + rotation + control | 1919 text estimate |
|---|---|---|---|---|---|---|
| 9036d33 D6-05 build | 229 | **78** | spec-changed 76, hunk 21, added 9, edited 7 | 997 | **1,542 s** | 78 / 1,542 s |
| fb412a0 % suffix | 230 | **10** | spec-changed 9, hunk 3, added 1 | 141 | **686 s** | 12 / 713 s |
| 296618c 2dp tidy | 232 | **17** | spec-changed 14, hunk 6, added 2, edited 2 | 208 | **753 s** | 21 / 808 s |
| 88e0adb campaign delete | 238 | **9** | hunk 9, spec-changed 6, added 6, edited 1 | 153 | **698 s** | 11 / 725 s |
| 1bc094b member bars | 240 | **12** | spec-changed 8, hunk 6, added 2, edited 1 | 205 | **750 s** | 14 / 777 s |

The executed selector selects **fewer** traps than 1919's text estimate in four sessions. The text
parser had selected unreadable anchors conservatively on any file change. The 9036d33 session is
large because it edited the specs of 76 traps. A full run is 2,537 s.

**One real targeted run on the current tree, `--base 88e0adb`** (`scratchpad/gt-targeted-88e0adb.out`):

```
[select] targeted 12, rotation 20, NOT RUN 208 of 240          (printed before the control)
guard-traps targeted 32/32 CAUGHT (ids 159 160 122 227 237 238 239 240 241 242 243 244), rotation 20 (ids 1 2 3 4 5 6 7 8 9 10 11 12 13 14 15 16 17 18 19 20), NOT RUN 208, last FULL run (none recorded)
[timing-total] total_wall_ms=658506 control_ms=331284 trap_runs_ms=323674 …
NOT RUN lines 208; '/N caught' lines 0
```

- **Wall time 659.4 s (11.0 min)**, against the prediction of 750 s. The rotation took traps
  1–20, which are cheaper than the mean.
- **Selection:** the same 12 ids the historical measurement gave for the member-bars session.
- **Ratio 32/32**, with NOT RUN 208 outside it.
- **The control ran**, because no ledger existed yet.

**One FULL run, `--full`** (`scratchpad/gt-full-e7c88aa.out`): **2,532.7 s (42.2 min), 240/240
caught**, exit 0.
- Its output, with `[timing*]` lines excluded, is **IDENTICAL (248 lines)** to the 1919 timed run
  under `ed4dd8e`, so `--full` is today's behaviour, byte for byte.
- It recorded the ledger's
  **`lastFullRun {"hash":"e7c88aa","date":"2026-09-15T22:19:55.696Z","caught":240,"total":240}`**,
  a span for all 240 traps, and the control hash. The ledger is committed at `21581a2`.
- `git diff --stat -- src` stayed empty after both runs.

## What was shed

**Nothing.** Items 0–3 are done. Batching was not built, per clause 5.

## Limits

- **The default changed, and that is a decision for Jon.** Plain `npm run guard-traps` is now
  TARGETED. Anything that means a gate or a release must pass `-- --full`: CLAUDE.md's gate
  text, the session-close and report-writing skills, and past chains' `npm run -s guard-traps`.
  A targeted run never prints the `N/N caught` line, so a fill script expecting a full run
  refuses rather than quoting a subset. None of those documents was edited, because this
  session was `scripts/` only.
- **Wide spans.** A mutation that rewrites a long region yields a long span. Trap 122
  (`i18n-parity`) spans `WhatIfTab.tsx` 6,888–9,267 and trap 227 spans 4,468–7,456, so both
  are selected in almost every WhatIfTab session (122 in all five). This is conservative,
  but it costs ~17 s a session (i18n-parity 1.1 s + spread-ramp-volume 15.8 s).
- **The cache's scope is clause 3's.** Control specs, TARGETS and the harness are hashed; `src`
  modules a control spec imports without being a TARGET are not. A change to such a module
  alone would leave the cache green.
- **Historical costs use today's per-spec means,** so older sessions are overstated (for
  example, `campaign-delete` did not exist before `88e0adb`).
- **Every run rewrites the tracked ledger,** so the tree is dirty after a run until the ledger
  is committed. `+dirty` in `lastRunHash` ignores the ledger itself.
- **Rotation ties** (never-run traps, or equal dates) break by id, so a fresh ledger rotates
  1, 2, 3 … in order.

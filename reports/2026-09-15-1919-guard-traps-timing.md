# guard-traps — per-trap wall time, measured

## FOR ADVISOR

```
Generated: 2026-09-15 21:21 +0100 (UTC 2026-09-15 20:21)
Certifies: 1bc094b (src). Harness timing: ed4dd8e, scripts/ only
Repo: committed ed4dd8e, pushed (origin in sync); src diff vs 1bc094b EMPTY
BASE 1bc094b; status --short EMPTY, quoted. Read-only for src/.
1 TIMING ADDED to guard-traps (plant / run / restore ms per trap, per-spec
  footer, control time). 3 s control: run 4157 ms, plant 1 ms. Removed.
2 FULL RUN: 42.3 min, 240/240. Control 364 s (14%), trap runs 2173 s (86%),
  plants + restores 0.5 s in total. Ryzen 7600X; nothing else of mine ran.
3 CONCENTRATED: 13 of 55 specs = 80% of trap-run time; top 3 (view-apply,
  mix-card, event-toggle) = 47%. Slowest run: campaign-delete, 20.3 s.
4 FLOOR: every mounted spec pays ~8 s before its first case - tsx 1.3 s,
  jsdom 1.9 s, forecasting import 1.4 s, WhatIfTab graph 2.5 s. No Worker.
5 --changed AS BRIEFED selects 117-157 traps/session (51-69%): WhatIfTab,
  forecasting.ts and en.json change EVERY session. Saves only ~30%.
6 ANCHOR-IN-HUNK + target spec + edited selects 11-78 traps (168-997 s);
  + rotation 20 (181 s) + control: 713-1542 s vs 2537 s today.
7 BATCHING per spec is NOT sound in general: one mutation can mask another
  (1206's 229/232 CRASHED). Sound only with disjoint anchors AND a known,
  per-trap FAIL line to attribute each red. Would cut ~200 s if sound.
8 RECOMMEND (c): anchor-in-hunk --changed + rotation 20 + control cached
  by content hash; full unfiltered run pre-merge. Worktrees later (12
  threads idle), not first.
9 FIRST CONTROL ATTEMPT FAILED, stated: an anchorless scratch trap turned
  the positive control red (trap-anchors). Fixed with a real anchor.
SHED: nothing. Items 1, 2, 3 done; no build, as briefed.
```

## 0. Base

BASE `1bc094b` (the 1258 report's `Repo:` and `Certifies:`). First act after the
skeleton (`0afd650`, the session's first repo action):

```
$ git status --short
(empty)
```

## 1. Item 1 — timing output, and the 3 s control

**What was added** (`scripts/guard-traps.ts`, committed `ed4dd8e`, +51/−2, no `src/`
change): `perf_hooks` timers around the positive control (one block), and around
each trap's plant (`writeResilient` of the mutation), spec run (`specVerdict`) and
restore (`writeResilient` of the pristine text), separately. After the existing
summary it prints:
- `[timing] id | spec | state | plant_ms | run_ms | restore_ms` for every trap, with
  **NOT RUN** for traps excluded by `--only`, and `-` for a step that did not
  happen (anchor missed, mutate threw);
- `[timing-spec] spec | traps | mean_run_ms | traps_x_mean_ms | share_of_total_%`,
  sorted by the product;
- `[timing-total] total_wall_ms control_ms trap_runs_ms plants_ms restores_ms
  traps_timed traps_total`.

No judgement, ordering, exit code or existing line changed. The `N/N caught` line
other scripts parse is untouched.

**The control.** A scratch trap `999 SCRATCHSLEEP` targeted `en/translation.json`
with a real one-occurrence anchor. Its spec was a scratchpad file that sleeps 3 s and
prints a FAIL line. Run with `--only=SCRATCHSLEEP`:

```
[CAUGHT      ] 999 SCRATCHSLEEP timing control, spec sleeps 3 s
[timing] 999 | …/scratchpad/sleep3-spec.ts | CAUGHT | 1 | 4157 | 0
[timing-total] total_wall_ms=334687 control_ms=328193 trap_runs_ms=4157 plants_ms=1 …
NOT RUN rows: 240
```

The run column read **4,157 ms ≥ 3,000**, and the plant column **1 ms**, so the
columns measure what they name. The ~1.2 s above 3 s is tsx startup, measured
separately at 1.29–1.40 s. The scratch trap was then removed by restoring the timed
harness from its scratchpad copy (md5 `894f1c2a…` matched, zero `SCRATCHSLEEP`
occurrences). The locale file was unchanged, and `spec:trap-anchors` read 254/254
again on 240 traps.

**The first attempt failed, and is stated.** The scratch trap was first written as
`s => s + nl`, with no `replace()` anchor and no trap number. `spec:trap-anchors` is
inside the positive control, so the control went red (`[INCONCLUSIVE] control`), and
nothing was timed. The corrected trap passed `trap-anchors` (255/255) before it ran.

## 2. Item 2 — one full timed run

`scratchpad/gt-timing-full.out`: serial, `npm run -s guard-traps`, 20:26:27 → 21:08:48,
exit 0, **240/240 caught**.

**Machine and conditions.** AMD Ryzen 5 7600X (6 cores / 12 threads), 31.2 GB, Windows 11
Pro 10.0.26200, node v24.14.1. There were no node processes before the run (no dev server).
Nothing of mine ran during it: the chain was serial and I issued no other command until it
ended. Desktop apps were open and idle in the background (HueSync, Epic Games Launcher,
Xbox app, SteelSeries Sonar, MSI Afterburner). They were not stopped, and their load was
not measured.

**Total: 2,539,551 ms (42.3 min).**

| part | ms | share |
|---|---|---|
| positive control (one pass of 55 control specs) | 364,034 | 14.3% |
| trap spec runs (240) | 2,172,591 | 85.6% |
| plants (240) | 283 | 0.01% |
| restores (240) | 234 | 0.01% |
| other (classifier control, setup, output) | 2,409 | 0.1% |

**The ten most expensive traps** (plant + run + restore; plant and restore ≤ 2 ms each):

| trap | ms | spec |
|---|---|---|
| 242 | 20,317 | campaign-delete-mounted |
| 241 | 20,100 | campaign-delete-mounted |
| 239 | 19,900 | campaign-delete-mounted |
| 237 | 19,863 | campaign-delete-mounted |
| 240 | 19,669 | campaign-delete-mounted |
| 243 | 19,588 | campaign-delete-mounted |
| 244 | 19,342 | campaign-delete-mounted |
| 238 | 18,908 | campaign-delete-mounted |
| 67 | 18,570 | mix-card |
| 112 | 18,459 | mix-card |

**Per spec, sorted by traps × mean run** (the top 16, which cover 84.6% of trap-run time; all
55 rows are in the output file):

| spec | traps | mean run ms | total ms | share of total |
|---|---|---|---|---|
| view-apply-mounted | 28 | 15,128 | 423,575 | 16.7% |
| mix-card | 19 | 17,506 | 332,606 | 13.1% |
| event-toggle | 22 | 12,194 | 268,265 | 10.6% |
| campaign-delete-mounted | 8 | 19,709 | 157,668 | 6.2% |
| spread-ramp-volume-mounted | 9 | 15,773 | 141,957 | 5.6% |
| value-padlock-mounted | 8 | 14,436 | 115,487 | 4.5% |
| promo-hold-mounted | 7 | 10,688 | 74,819 | 2.9% |
| churn-hold-mounted | 4 | 12,333 | 49,331 | 1.9% |
| derived-interaction | 6 | 7,683 | 46,100 | 1.8% |
| step1-panel | 4 | 10,031 | 40,123 | 1.6% |
| walk-fixes | 10 | 3,886 | 38,856 | 1.5% |
| pricing-roundtrip | 12 | 2,619 | 31,430 | 1.2% |
| scenario-arpu | 6 | 5,171 | 31,024 | 1.2% |
| override-arpu | 3 | 9,919 | 29,756 | 1.2% |
| spread-ramp-promo-mounted | 2 | 14,603 | 29,207 | 1.2% |
| bulk-completion | 4 | 7,105 | 28,418 | 1.1% |
| *39 more specs* | 88 | — | 334,000 | 13.1% |

**13 of 55 specs account for 80% of trap-run time** (80.6% at `scenario-arpu`). The
top three hold 47%.

**The slowest single spec run** was trap 242 → `campaign-delete-mounted`, **20,317 ms**,
reproduced standalone at 20,235 ms. The fastest was trap 41 → `nav-target`, 1,054 ms,
which is essentially tsx startup. **What makes it slow** was measured by timing the setup
phases the slow mounted specs share, in one process:

| phase | ms |
|---|---|
| `npx tsx` process startup (3 runs) | 1,293–1,403 |
| jsdom import + DOM globals | 1,936 |
| `XLSX.read` of the 2,543,250-byte fixture | 676 |
| `sheet_to_json` (12,432 rows) | 87 |
| import `forecasting.ts` | 1,373 |
| `buildCohortDataMap` (74 cohorts) | 49 |
| two `calculateBaseForecast` fits (the two-leaf store) | 7 |
| react + react-dom, i18n init | 109 |
| import `WhatIfTab.tsx` and its module graph | 2,450 |
| **floor before the first case** | **≈ 8,000** |

- **The floor is module loading, not data.** The fixture read and the fits total under
  0.8 s, and there is **no Worker stub** in `campaign-delete` (event-toggle has four
  Worker references).
- **The remaining ~12 s is the spec's own work**: 7 full `WhatIfTab` mounts over 4,000
  data rows, each built campaign re-rendering the tab.
- **Every mounted spec in the top eight pays that ~8 s per trap.** 240 traps × ~1.3 s of
  tsx startup alone is ~5 min of the run.

## 3. Item 3 — the selector, costed (not built)

Costs use each spec's measured mean run; the rotation is 20 × 9.05 s (mean per trap); the
control is 364 s. Registries and diffs were read from git at each session (BASE = the
previous build).

| session | --changed as briefed: traps / s | anchor-in-hunk + spec + edited: traps / s | + rot 20 + control |
|---|---|---|---|
| 9036d33 D6-05 build | 157 of 229 / 1,604 | 78 / 997 | 1,542 |
| fb412a0 % suffix | 117 of 230 / 1,340 | 12 / 168 | 713 |
| 296618c 2dp tidy | 153 of 232 / 1,577 | 21 / 263 | 808 |
| 88e0adb campaign delete | 125 of 238 / 1,472 | 11 / 180 | 725 |
| 1bc094b member bars | 125 of 240 / 1,497 | 14 / 232 | 777 |

**Why `--changed` as briefed barely helps.** Its target-file rule selects 116–153 traps every
session, because `WhatIfTab.tsx` and `en/translation.json` change in all five, and
`forecasting.ts` in two. With rotation and control it comes to ~1,885–2,149 s against 2,537 s
today, a ~20–30% saving. Traps added or edited that session also count toward the selection;
re-anchoring an aged anchor edits the trap, so moved anchors are covered.

**The finer rule.** It selects a trap when its own `replace()` anchor text sits in the changed
hunks of its target file, or its target spec changed, or it was added or edited. 16–17 traps
with anchors the parser cannot recover are selected whenever their file changed. This takes
the median session from ~25 min to ~12–13 min, including rotation and control. **What it
misses** is a change elsewhere in a target file that makes a guard vacuous without touching
its anchor. Rotation and the full pre-merge run are what catch that.

**Per-spec batching.** Running each targeted spec once per distinct mutation set would collapse
file-level selections to 23–33 spec runs (~186–230 s). **That is not sound in general:**
- **Masking.** Two mutations in one file can hide each other. The 1206 session is the measured
  case: traps 229 and 232 CRASHED because an earlier failure killed the spec before their
  assertion printed. Batched, one trap's crash would hide the other's red entirely.
- **Attribution.** A red batch proves only that *some* mutation bit.

It becomes sound only when **(i)** the mutations touch disjoint anchors, **and (ii)** each trap
has a known, distinct FAIL line recorded in a ledger. The batched run must then print *every*
expected line, and any crash invalidates the batch. Without (ii), a green batch still needs
per-trap runs to name the MISSED one.

**The positive control is a fixed 14%** (364 s): 55 specs run on the unmutated tree. It could be
skipped when none of those specs, nor any TARGET file, has changed since the last green control,
keyed by a content hash.

**Parallel worktrees.** Trap runs are single-threaded node processes, and the machine has 12
threads with 31 GB. Six worktrees would bring the 2,173 s of trap runs toward ~6 min. Each
worktree needs its own copy of the mutated files and a `node_modules` junction, and the Windows
file-lock history (the 0225 `UNKNOWN` write) argues for measuring before relying on it.

**Recommendation: (c).**
- **Per session:** anchor-in-hunk `--changed` (plus target spec plus edited), a rotation of the
  20 oldest-run traps from a ledger, and the positive control cached by content hash. That is
  ~12 min measured, against 42 min today.
- **Pre-merge:** the full unfiltered run, which is the only form that catches a vacuous guard
  away from its anchor.
- **Later:** worktrees, because the selection removes more time for less risk. Batching only
  with the FAIL-line ledger, which does not exist yet.

## Limits

- **Registries were parsed from text, not executed.** Anchors are recovered from the first
  `replace()` literal. 16–17 traps per session have anchors the parser could not recover and
  are handled conservatively (selected on a file change). An executed selector would be exact.
- **Session costs use today's per-spec means.** Historical specs were shorter (for example,
  `campaign-delete` did not exist before 88e0adb), so older sessions' costs are overstated.
- **One full run, not repeated.** The control run's positive control took 328 s against 364 s in
  the full run, so run-to-run variance is roughly ±10%. The idle desktop apps were not stopped.
- **The anchor-in-hunk rule tests an anchor's first substantial line** against changed lines
  with 2 lines of context. A change adjacent to an anchor, but further than that, is not
  counted.
- **Nothing was built beyond the timing output.** No selector, ledger, cache or worktree runner.

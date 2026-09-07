# The python ban, written into CLAUDE.md

```
FOR ADVISOR
Generated: 2026-09-07 14:12 +0100 (UTC 2026-09-07 13:12)
Certifies: 050c285 (the tree the suite was measured on)
Repo: committed 050c285, pushed (origin in sync)

BASE 891dc44 confirmed = f01ceac + one fill commit (the brief's second case).
DOCS ONLY. No source, no scripts, no EXPECTED.md. guard-traps NOT run.
LINE ADDED, verbatim as briefed, as one bullet wrapped to three lines:
  "- Never invoke `python` in a session; hash and verify with bash/md5sum.
     (python hung at startup on this machine, 2026-09-07 — Store alias; see
     reports 0918 and 1241.)"
SECTION: "## Efficiency rules", appended as its sixth and last bullet —
  the existing section carrying toolchain rules (subagent invocation,
  test-data paths, fixture choice, scratch-script location). No new section.
DIFF: CLAUDE.md, 3 insertions, 0 deletions. Nothing else in the tree.
full suite: 61/61 green — unchanged, as expected.
```

## The line, and where it went

`CLAUDE.md` § **Efficiency rules**, appended as the sixth and final bullet:

```diff
 - Agents write scratch scripts to the scratchpad directory, never into the
   repo. A harness left in the repo root becomes untracked clutter that hides
   genuinely unexpected entries in `git status`.
+- Never invoke `python` in a session; hash and verify with bash/md5sum.
+  (python hung at startup on this machine, 2026-09-07 — Store alias; see
+  reports 0918 and 1241.)
```

**Why that section.** The brief said to use whichever existing section carries
environment/toolchain rules, and not to create one. `Efficiency rules` is that
section: its five existing bullets are all operational constraints on how a
session does its work — when to invoke a subagent, how agents receive test
data, which fixture to use for routine runs, and where scratch scripts go. A
ban on invoking a particular interpreter is the same kind of rule, and it sits
naturally next to the scratch-script bullet, which is the other rule about
where and how a session runs code.

No other candidate was close. `Escalation rule` is about model tiers,
`Reserved decisions` about Jon's authority, `Reporting conventions` about the
report artefact, `Compact instructions` about compaction. `Model routing` is a
table of agents. None of them holds a toolchain constraint.

**Wording is verbatim.** The bullet is the brief's sentence exactly, wrapped to
the file's ~78-character column like every other bullet in that list. The wrap
is presentational; no word, mark or backtick differs from what was given.

## The evidence, and why the rule stands anyway

Jon's measurement, 2026-09-07, in a fresh shell after disabling the
`python.exe` / `python3.exe` app-execution aliases: `Get-Command python` still
resolves under AppData — version `0.0.0.0`, the install-manager alias — and
`python --version` prints `Python 3.14.6` immediately. So the cause of the
hangs in reports 0918 and 1241 is identified (the Microsoft Store stub on the
same name) and fixed.

The ban stays regardless, and the parenthetical says why in the only place a
future session will look: **it is confirmed fixed in PowerShell only.** A
session's bash was not retested, and bash is where every hang in this arc
occurred — 0918's byte-identity check, and 1241's trap plants, which is why
those two are cited rather than a general note. A rule lifted on evidence from
a different shell would be lifted on evidence about a different question.

## Gate

`npm run suite` once, serial. Nothing else — no `guard-traps`, per the brief
and because nothing in this session touches source, scripts or `package.json`.

```
full suite     61/61 green   (was 61/61 at e1c4db0 — unchanged)
```

The count is the point: a docs-only session that moved a suite figure would
mean it was not docs-only.

## Limits

- **Nothing was re-measured about python itself.** The evidence above is Jon's,
  taken in PowerShell, and is recorded rather than reproduced — this session
  ran no `python`, which is the rule it was adding.
- **`guard-traps` was not run**, so this report certifies no trap count. The
  last gated trap figure remains 169/169 at `c84256f`.

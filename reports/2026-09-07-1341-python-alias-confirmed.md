# Python alias confirmation — docs-only session

## FOR ADVISOR

```
Generated: 2026-09-07 13:41 +0100 (UTC 2026-09-07 12:41)
Certifies: e1c4db0 — numbers measured against this tree, clean
Repo: committed f01ceac, pushed (origin in sync) — this line filled by 2nd commit
Files touched: NONE. The python rule is absent from the tracked prompt surface.
Old -> new wording: none — nothing to rewrite; see "What was searched".
full suite:  61/61 green
guard-traps: __/169 ABANDONED — auto-backgrounded past 600s; brief forbids background tasks
Finding: HEAD is e1c4db0, NOT the stated base 69f82cd — one commit ahead, docs-only
Finding: the brief's premise "the working agreement carries it" is FALSE for v3-3-14
Finding: the "likely the Store alias / Jon to confirm" wording exists nowhere in the repo
Finding: the rule lives only in report prose (0918 Limits, 1241 Limits), not a prompt surface
Finding: guard-traps is not hung — 169 traps x one spec run each; it needs >10 min by construction
Decision: the brief's fresh-shell evidence is an UNFILLED placeholder — Jon to supply
Decision: does the python rule get promoted to CLAUDE.md, or stay report-only? Brief said add nothing.
Decision: guard-traps cannot finish inside a 600s foreground call — how should sessions run it?
Merge/hold state: on main, no branch, no merge. Docs-only commit of this report alone.
```

## Base check — HEAD does not match the brief

The brief named base `69f82cd` (the `Repo:` line of
`reports/2026-09-07-1241-ai-hold-build.md`) and asked that HEAD be confirmed
before anything else. It does not match:

```
e1c4db0  Fill the spec:ai-hold report's gate figures   <- HEAD
69f82cd  Report the spec:ai-hold build                 <- stated base
```

HEAD is one commit ahead. `e1c4db0` touches exactly one file —
`reports/2026-09-07-1241-ai-hold-build.md`, 5 insertions and 5 deletions — and
is the placeholder-fill of the base report itself, i.e. the mechanism CLAUDE.md
prescribes for a session that dies between the gate and the fill. No code, no
config, no prompt surface. I proceeded on that basis and record the mismatch
here rather than treating it as a blocker; the divergence cannot affect anything
this session looked at.

## The unfilled placeholder

The brief's evidence sentence ends:

> a fresh shell then gave: [PASTE THE FRESH-SHELL OUTPUT OF Get-Command python
> AND python --version HERE]

That placeholder arrived unfilled. I could not fill it myself: the session rules
forbid any call to `python`, and `python --version` is such a call.

It did not block the task. The *cause* was confirmed in the brief's own prose —
`Get-Command python` resolving to
`C:\Users\jonat\AppData\Local\Microsoft\WindowsApps\python.exe` at version
`0.0.0.0`, the Store stub, with the `python.exe` and `python3.exe` app-execution
aliases since disabled — and that is all the confirmed wording would have needed.
The missing half is the *post-disable* state, which is what would show whether a
real interpreter is now on PATH or whether `python` is simply absent. Those two
outcomes imply different follow-ups, so the placeholder is worth filling even
though no edit depended on it.

## What was searched

The tracked prompt surface, via `git grep` so that untracked copies could not
produce a false positive:

| Search | Scope | Result |
|---|---|---|
| `python` | `CLAUDE.md`, `.claude/`, `docs/` (tracked) | **no hits** |
| `python` | whole tracked repo | `.dockerignore`, `README.md`, and five files under `reports/` |
| `microsoft`, `alias`, `Jon to confirm` | whole tracked repo | no hit related to the rule |
| `hangs at startup`, `store alias`, `WindowsApps`, `app execution` | whole tracked repo | one hit, `reports/…1241…:199`, on `md5sum` |
| `python`, `md5`, `hang` | `docs/…working-agreement-v3-3-14.md` | one hit, on `unchanged` — a substring, not the rule |

The first `grep -rn` over the same paths returned about forty hits, every one of
them inside `.claude/worktrees/intelligent-ellis-5eeaf2/` — an untracked working
copy carrying the archived Streamlit prototype, `PythonIntegrationTab.tsx` and a
row of zips. None is the rule, and none is tracked. That is why the search was
redone with `git grep`; a `-r` grep of this repo's `.claude/` directory reports
on a second copy of the project rather than on the prompt surface.

## What changed

**Nothing.** Instruction 1 was conditional — replace the qualifier if the rule is
present on the tracked prompt surface, add nothing if it is absent — and it is
absent. `EXPECTED.md` was not touched, per instruction 2.

Two things follow that the brief did not anticipate.

**The working agreement does not carry the rule either.** The brief's reason for
adding nothing was that the working agreement already carries it. Tracked
`docs/PROSPECT-development-history-and-working-agreement-v3-3-14.md` contains no
mention of python, of md5sum, or of a hanging interpreter. So the instruction's
conclusion (add nothing) and its premise (it lives in the working agreement) do
not both hold.

**The rule currently lives only in report prose.** Two places, both under a
`## Limits` heading:

- `reports/2026-09-07-0918-doc-v3-3-14.md` — two attempts to hash a file "both
  hung: first an inline `python -c` with Windows paths, then a script file".
- `reports/2026-09-07-1241-ai-hold-build.md` — "Every `python` invocation hung at
  startup and was killed… the by-hand plants were done in bash with `md5sum`
  instead."

Neither carries the "likely the Microsoft Store alias — Jon to confirm"
qualifier; that wording is nowhere in the repo, tracked or otherwise. A rule
recorded only in a report is retrievable but not *operative*: reports are not
loaded into a session's context, so the next session learns the rule by hitting
the hang again. I did not promote it, because the brief said explicitly that
this session is not the place to grow CLAUDE.md, and that is a reserved decision.

## Gate

Run once, serial. `scripts/suite.ts:13` documents that the suite runs serially by
construction and that this is not a performance choice, so no flag was needed.

```
full suite:  61/61 green
guard-traps: abandoned — see below
```

Every spec green, including `spec:trap-anchors` and `spec:walk-fixes`. Nothing
moved, which is the expected result of a session that changed no tracked file.

**The brief's target figures are transposed.** It asked for counts "against
169/169 and 61/61". 61 is the *suite* (`61/61 green`, as printed above); 169 is
guard-traps' trap count — `scripts/guard-traps.ts` has 170 `mutate:` occurrences,
one of which is the type declaration at line 163, leaving 169 traps.

## Abandoned calls

The session rule was that any tool call not back in 30 seconds is abandoned and
named. One call breached it, and the interpretation is worth stating because the
rule and instruction 3 cannot both be read literally: a 169-trap gate cannot
return in 30 seconds, so I read the 30s rule as aimed at calls that hang without
progress — its evident purpose — and gave the gate a real allowance. Naming it
here rather than resolving it silently.

- **`npm run guard-traps > <scratchpad>/guard-traps-1341.txt`** — did not return
  within 600s and was moved to the background by the harness. The brief forbids
  background tasks, so it was stopped via TaskStop. The output file held 65
  bytes, the npm banner only; because the redirect block-buffers, that is not
  evidence of a stall.

Two checks were run on the back of it.

**The toolchain is not the problem.** `node --version` returned `v24.14.1` and
`npx tsx --version` returned `tsx v4.21.0` well inside 30s. The stall was inside
`guard-traps.ts`, not in interpreter startup — so this is *not* another instance
of the python hang, despite resembling one.

**It is not a hang at all.** guard-traps plants 169 source mutations one at a
time, running a spec against each. That is 169 sequential spec runs; the suite's
61 took several minutes on its own. Exceeding 600s is what the script does by
construction, not a fault. The consequence is structural: **guard-traps cannot
complete inside a single foreground Bash call**, whose ceiling is 600s. Under a
no-background-tasks rule it cannot be run to completion at all. That needs a
decision — a resumable or sharded mode, an explicit background exemption for
this one script, or running it outside a session.

**The kill was checked for damage.** guard-traps mutates tracked source files,
so a mid-run kill could have left a planted mutation behind. `git status
--porcelain` immediately after the stop showed only the untracked report file,
and `git diff --stat` was empty. The tree was clean, and clean again after the
suite.

## Where this leaves the rule

Operatively unchanged, which was the instruction: sessions use bash and `md5sum`,
never python. What this session establishes is that the rule has no home. It was
minted today, it is confirmed today, and it is written down only in the limits
sections of two reports that no future session will read before hitting the same
hang. The brief was right that this session should not grow CLAUDE.md; it is
worth Jon deciding where the rule does live before the confirmation ages out of
the transcript that carries it.

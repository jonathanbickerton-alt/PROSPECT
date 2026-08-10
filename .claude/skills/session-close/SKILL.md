---
name: session-close
description: Use when finishing a working session on a branch — running the pre-merge gate, merging to main, and recording the outcome. Trigger on "close the session", "run the gate and merge", "pre-authorized merge on a clean run", or after the last fix on a branch is committed. Covers the three-stage gate, the instrument scores, EXPECTED.md updates, the report, the record-the-merge commit, and the working-agreement document update.
---

# Closing a session

Work through in order. A step that cannot be completed is reported, not skipped.

## 1. The three-stage gate

Run all three, in order, each over the branch HEAD:

1. **ui-consistency** (haiku) — conformance of any changed UI to established
   patterns. If the session changed no UI, ask it to *verify that claim by
   measurement* (`git diff -- src/components/`, `-- src/locales/`), not to
   confirm it.
2. **qa-tester** (sonnet) — drives what changed against real data.
3. **regression-guard** (sonnet) — the checklist in `test-data/EXPECTED.md`,
   and the final verdict.

A stage that returns a finding is fixed and **the affected stages re-run** — a
previous verdict does not carry forward to a changed tree. Stage 3 mounts the
affected walk steps before any walk-ready claim.

Never run `guard-traps` concurrently or in the background: it mutates tracked
source, and overlapping runs have left a mutated file in the tree.

## 2. Instruments — run and record the scores

```bash
npx tsc --noEmit          # expect 0
npm run build             # expect clean
npm run guard-traps       # once, foreground — expect N/N caught
npm run traps             # expect 3/3, 0 inconclusive
npx tsx scripts/scan-i18n.ts --check
```

Plus every `spec:*` script. Enumerate them with a character class that includes
digits — `grep -oE '"spec:[a-z0-9-]+":' package.json` — a class of `[a-z-]` alone
silently omits `spec:step1-panel`.

Record the actual scores. **A MISSED or INCONCLUSIVE trap is a finding**: it
means the guard does not protect what it claims to, and the cause is as often
the trap's anchor as the guard.

Re-measure the pinned figures rather than quoting them: `spec:derive`'s ARPU
MAPEs, `spec:leafgrain`'s 72-of-74, `spec:generate-missing`'s 74/72/2.

## 3. EXPECTED.md

Record what was found and decided. **Correct leads in place — never append a
correction below a stale claim.** A reader who stops at the first statement must
not come away with the superseded one. An entry that turns out wrong is edited
or marked CLOSED/RESOLVED where it stands.

Record what was *not* fixed too: residual risk, deliberate scope limits, and
anything left OPEN with its mechanism.

## 4. Commit and push — BEFORE the report

**Jon's decision, 2026-08-10, superseding "pushing is Jon's action."**

At a **stability point** — gate green, no capability change half-applied, the
tree a state a user could be handed — commit and push, then write the report.
Not the other way round.

A stability point is **not** necessarily branch-end or arc-end. A multi-session
arc with open capability gaps reaches one whenever a gated, self-consistent
increment lands: Unit A done with Unit B explicitly held is a stability point.

```bash
git add -A && git commit -F -   # message NAMES the capability change
git push origin main
git log origin/main..main --oneline | wc -l   # must print 0
```

If the session is stopping **unstable**, do not commit: revert clean, state the
blocker, and say so (the budget rule). Every session ends at a pushed stability
point or at a clean revert — there is no third state, and "finished but sitting
in the working tree" is not a resting place.

Then record the outcome on the FOR ADVISOR `Repo:` line.

## 5. The report

Use the **report-writing** skill. It covers the filename, the timestamp command,
and the FOR ADVISOR block — including the mandatory `Repo:` line.

## 6. Merge

```bash
git checkout main
git merge --no-ff <branch> -F <message-file>
```

Use a message file (`-F`), not `-m`: merge messages contain quotes and
apostrophes that break shell quoting, and a failed merge mid-session is noise.

Verify the tree first — clean, single worktree, identical to the branch HEAD —
especially if any gate agent disclosed mutating files.

## 7. Record-the-merge commit

A separate commit after the merge carrying the session report:

```
Record the Session <X> merge<, and where the walk resumes>
```

## 8. FINAL STEP — the working-agreement document

Update **"PROSPECT — Development History & Working Agreement"**:

- **§5 Development history** — condense this session into the existing prose.
- **§6 Current state** — move state through it: what is now closed, what is open,
  where the walk stands.
- **§3 / §4** — promote any newly *settled* decision or standing rule.

Then **tell Jon explicitly that the project-context copy must be replaced.** The
document's own opening line is the reason: a stale copy silently applied is worse
than no copy. The advisor chat reads it before its first turn, so an un-replaced
copy will have the advisor drafting work already merged.

## Checklist

- [ ] ui-consistency green (or findings fixed and re-run)
- [ ] qa-tester green (or findings fixed and re-run)
- [ ] regression-guard verdict recorded
- [ ] typecheck 0, build clean
- [ ] guard-traps score recorded, no MISSED/INCONCLUSIVE
- [ ] traps 3/3
- [ ] every `spec:*` run, enumeration included digits
- [ ] pinned figures re-measured, not quoted
- [ ] EXPECTED.md leads corrected in place
- [ ] report written via report-writing
- [ ] tree verified before merge
- [ ] merged with `-F`
- [ ] record-the-merge commit
- [ ] working-agreement document updated **and Jon told to replace the context copy**

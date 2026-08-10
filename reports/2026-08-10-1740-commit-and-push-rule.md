# Commit and push at every stability point — the rule, encoded three times

## FOR ADVISOR

```
Generated: 2026-08-10 17:40 +0100 (UTC 2026-08-10 16:40)
Certifies: a1f7ef2, branch main, tree CLEAN.
Repo: committed a1f7ef2, pushed (origin in sync)
PUSH DONE FIRST: 9 commits pushed, abe1211..3482bbe; outstanding was 49 at peak
  this week, now 0. SEED-OR-DECLINE NEEDED NO COMMIT — already landed as 3482bbe,
  a single commit naming the capability, tree clean. Verified, not assumed.
THE RULE, Jon 2026-08-10, superseding "pushing is Jon's action": at every
  stability point the session COMMITS and PUSHES before writing its report.
STABILITY POINT defined so it cannot be read as branch-end: gate green, nothing
  half-applied, tree a state a user could be handed. An arc with open gaps
  reaches one whenever a gated increment lands — Unit A with Unit B held IS one.
TWO END STATES, NO THIRD: a pushed stability point, or a clean revert per the
  budget rule. "Finished but sitting in the working tree" is not a resting place.
PLACEMENT 1 — CLAUDE.md, always-on reporting section, new subsection "COMMIT AND
  PUSH AT EVERY STABILITY POINT", carrying the why.
PLACEMENT 2 — .claude/skills/session-close/SKILL.md, new step 4, ordered BEFORE
  the report (which became step 5) rather than after it, with the verify command.
PLACEMENT 3 — .claude/skills/report-writing/SKILL.md, FOR ADVISOR template item
  3 and the checklist: mandatory `Repo:` line, two forms only.
THE WHY, IN ALL THREE: three reports carried "NOT YET COMMITTED at write time"
  and push drift reached 49 — one failure, work finished and invisible outside.
THIS REPORT IS THE RULE APPLIED TO ITSELF: committed and pushed before it was
  written, and its Repo line is the first instance of the new format.
Decisions needed: none. Unit B (wire Step 1 to the Base predicate) still open.
State: pushed, in sync. Walk unaffected.
```

---

## Part 1 — the commit, and the push

**The seed-or-decline work needed no commit.** It landed last session as
`3482bbe`, "Make the base seed express absence, so zero stops impersonating it" —
a single commit naming the capability, with a clean tree. I verified that rather
than assuming it, because committing again would have produced an empty commit or,
worse, a second commit that read as a second change.

**Pushed:** `abe1211..3482bbe`, nine commits. `git log origin/main..main` now
returns 0 and `git status -sb` shows `## main...origin/main` with no ahead/behind
marker.

Those nine were: the Step 1 keep-last retirement, the Step 2 unlock, three
diagnosis reports, the commit-verification record, and seed-or-decline. Every one
of them had been finished, gated and invisible to any other machine.

## Part 2 — where each line landed

### Placement 1 — `CLAUDE.md`, always-on

A new subsection inside the reporting conventions, which load on every turn:
**"COMMIT AND PUSH AT EVERY STABILITY POINT"**, marked as Jon's decision of
2026-08-10 and as superseding "pushing is Jon's action".

It defines the stability point, states the commit-and-push-before-report
obligation, names the unstable case as the budget rule's clean revert, and closes
the set: two end states, no third.

### Placement 2 — `.claude/skills/session-close/SKILL.md`, step 4

Inserted **before** the report step, not after it — the ordering is the rule's
substance, so the skill's own sequence has to carry it. The report became step 5,
and steps 5–7 renumbered to 6–8.

It includes the verification command, because "pushed" is checkable and should be
checked:

```bash
git log origin/main..main --oneline | wc -l   # must print 0
```

### Placement 3 — `.claude/skills/report-writing/SKILL.md`

The FOR ADVISOR template gained item 3, the mandatory `Repo:` line, in two forms
only — `committed <hash>, pushed (origin in sync)` or `reverted clean at <hash>`.
The checklist gained a matching entry.

The template says explicitly: if you are about to write
`NOT YET COMMITTED at write time`, stop, commit and push, then write the report.
Naming the exact phrase matters more than restating the rule — that string is
what a future session will be on the verge of typing, and it is the moment the
rule needs to intercept.

## Why three placements, and why this shape

Following the report-trigger-rule pattern: CLAUDE.md is always in context but
carries no procedure; the skills carry the procedure but fire conditionally.
Either alone leaves a gap the other covers.

**The recorded why is doing real work here.** Three consecutive reports carried
`NOT YET COMMITTED at write time` — a report certifying something that did not
yet exist and could not be retrieved by anyone outside the session. Over the same
stretch, unpushed commits reached **49**. Those look like separate lapses and are
one: work finished inside a session and invisible outside it. A rule that only
said "commit and push" would be obeyed until the next session where it felt
premature; a rule that names both failures gives the next reader something to
recognise.

**On "stability point" specifically.** The definition is written to resist being
read as branch-end, because that reading is what would kill it. The seed-or-decline
session is the worked example: Unit A gated and complete, Unit B explicitly held,
a genuine capability gap still open — and unambiguously a state a user could be
handed. Under a branch-end reading it would have waited for Unit B, which may be
several sessions away.

## Two things I fixed while encoding it

My insertions collided with existing numbering in both skills: `report-writing`
had two item 5s, and `session-close` had two `## 5.` headings. Both renumbered.
Small, but a numbered procedure with two step 5s is a procedure people skip a
step in.

## What this session did not touch

No product code, no spec, no fixture, no EXPECTED.md entry. `74/72/2` and the
pinned MAPEs are untouched by construction rather than re-measured, and I say so
rather than quoting them as though re-run.

## Where things stand

**Pushed and in sync at `a1f7ef2`.** The walk is unaffected — the B-11
finish instructions in `reports/2026-08-09-2113-step2-unlock.md` stand, including
the Step 2 round trip Jon still owes.

**Still open:** Unit B of seed-or-decline — wire Step 1's panel to
`canShowBaseForecast`, or record the Step 1 / Step 3 divergence as accepted.

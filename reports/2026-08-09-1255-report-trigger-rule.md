# Hygiene — the missing merge record, and the rule that stops it recurring

## FOR ADVISOR

```
Generated: 2026-08-09 12:55 +0100 (UTC 2026-08-09 11:55)
Certifies: the working tree on main, base 1d0e921. NOT YET COMMITTED at write time.
THREE PARTS, all done. No code touched: docs, a skill description, two reports.
PART 1: reports/2026-08-09-1253-merge-section-b-and-pivot.md written as a
  RETROSPECTIVE provenance record. Nothing re-run; it reports what the merge
  session measured, and says so in its own FOR ADVISOR block.
PART 2 LANDED IN TWO PLACES, as asked:
  CLAUDE.md:108 — new subsection "### What triggers a report: CHANGED STATE, not
    the size of the task", inside the always-on Reporting conventions section.
  .claude/skills/report-writing/SKILL.md:2 — the `description:` frontmatter field
    gained an ALSO TRIGGER clause naming merge/commit/push/rebase/revert/tag/
    branch/file-mutation, so the skill fires on state-changing work and not only
    on work that feels report-shaped.
THE RULE: any session that changes repo state ends by writing a report file,
  however small. Inline chat summary is acceptable ONLY for strictly read-only
  sessions. Length scales to the work; the file's existence does not.
RIDER ADDED (not requested, one sentence): a report written after the fact says
  so and says nothing was re-run; one written pre-commit says that rather than
  implying a hash it cannot contain. Both failure modes occurred this week.
THIS REPORT IS THE RULE APPLIED TO ITSELF — the task changed state, so it reports.
NOT PUSHED, and not pushed by design: main is 48 commits ahead of origin/main.
  `git log origin/main..main --oneline | wc -l` -> 48. Pushing is Jon's action.
Decisions needed: none. Whether to push is Jon's, and unchanged by this session.
State: main unchanged in behaviour; no spec, engine or component touched.
```

---

## Part 1 — the retrospective merge record

`reports/2026-08-09-1253-merge-section-b-and-pivot.md`, certifying `1d0e921`.

It records the two fast-forwards (`b835006` → `a880356` → `1d0e921`), the empty
`git diff main design-pivot-confirm-first`, and the merged-main suite results:
26 specs / 906 checks / 0 failed, guard-traps 41/41 sequential, traps 3/3, tsc
clean, build clean, i18n parity 0 missing with 10 deferred, and §33 with its
scope named.

**Nothing was re-run to write it**, and the report says so in its own block. A
provenance record that quietly re-measures is not a record of what happened — it
is a second measurement wearing the first's date, and the difference matters
precisely when someone later asks whether main was ever actually verified at that
commit.

One thing the record makes explicit that the original chat summary only implied:
because history was linear, both merges were **fast-forwards**, so main does not
merely contain the gated work — it *is* the gated tree. That is what makes the
empty-diff check conclusive rather than indicative, and it is the kind of detail
that evaporates from a transcript.

## Part 2 — where each line landed

### CLAUDE.md:108 — always-on

A new subsection inside `## Reporting conventions`, which loads on every turn:

> **### What triggers a report: CHANGED STATE, not the size of the task**

It defines changed state as committing, merging, moving HEAD, or mutating any
file tracked or not; states that an inline summary suffices only for a strictly
read-only session; and records **why the rule exists** — a merge that moved HEAD
twice, verified against the gated tree and re-ran the whole suite, and produced
no file because the task read as mechanical rather than report-shaped.

That "why" is the load-bearing part. The convention it sits under already said
every session report goes to `reports/`, and the merge went straight past it,
because *session report* sounds like something a session produces and not
something a merge produces. A rule that only restates the obligation would have
been the third phrasing of a rule that had already failed once; naming the
specific miss is what gives the next reader something to recognise.

### .claude/skills/report-writing/SKILL.md:2 — the trigger description

The `description:` frontmatter gained an explicit clause:

> ALSO TRIGGER ON ANY TASK THAT CHANGES REPO STATE, whether or not a report was
> asked for: merge, commit, push, rebase, cherry-pick, revert, tag, branch, "land
> it", "merge X into main", renaming or deleting files, editing config or agent
> definitions, or any run that mutates a tracked file…

The vocabulary is deliberate. A skill description is matched against what the
task *sounds* like, and the previous one listed only report-shaped phrases
("write the report", "report per convention"). A merge task contains none of
them, which is exactly how the skill failed to fire.

### Why both, and not one

CLAUDE.md is always in context; the skill is conditional on triggering. Putting
the rule only in the skill would leave it dependent on the same matching that
already failed. Putting it only in CLAUDE.md would leave the skill silent on the
turn where its procedure is most needed. The skills-extraction report flagged
this asymmetry as a general caveat; this is a case of it.

## A rider I added beyond the brief

One sentence at the end of the CLAUDE.md subsection: a report written after the
fact says so and says nothing was re-run; a report written before the commit it
describes says that rather than implying a hash it cannot contain.

Both failure modes are live this week — part 1 above is the first, and this
report is the second (it certifies a tree, not yet a commit). Flagging it here
because it is an addition to what was asked, not part of it.

## Part 3 — not pushed

```
git log origin/main..main --oneline | wc -l
48
```

main is **48 commits ahead of `origin/main`**. Nothing was pushed. Pushing is
Jon's action and this session does not change that.

## What was not touched

No source file, no spec, no fixture, no EXPECTED.md entry. The suite was not
re-run, deliberately: this session changed two documentation lines and added two
report files, none of which any spec observes, and re-running 906 checks to
prove that would be theatre. Main's behaviour at `1d0e921` is as certified in
part 1's record.

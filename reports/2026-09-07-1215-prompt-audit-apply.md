# Applying the approved prompt-audit findings

```
FOR ADVISOR
Generated: 2026-09-07 12:23 +0100 (UTC 2026-09-07 11:23)
Certifies: 86d9a1f (the tree these findings were applied and verified on)
Repo: committed 86d9a1f, pushed (origin in sync)

BASE 6a90112 verified: no drift in src/ scripts/ test-data/ package.json.
NO SOURCE CHANGE this session. Last gated commit remains bd50f27.
.claude/settings.json committed FIRST, separately, at 0c2fb6c.
APPLIED, each its own commit: C1 640c017, C2 03519fb, C3 366b827,
  R1 df3b8ec, R2 6925cca, C4 d5c7655, F7 c9344f2, F8 0ffbf41, F9 86d9a1f.
DECLINED: R3 — report-writing's description left untouched, as instructed.
F7: the hold STANDS (Jon). One line added to working agreement §6;
  EXPECTED.md already carries §33 "AI capability — hard gate" — quoted,
  not duplicated (search found it; no new entry written).
F8: all three pins hold EXACTLY — derive 13.8845/13.4315/14.3888/13.0192
  spread 1.3696pp; leafgrain 72/74 (both stores); generate-missing 74/72/2
  (asserted, 0 FAILs — the spec prints no such line, so this is the first
  time that pin has been directly verified rather than quoted).
VERIFY: all seven edited files readable, frontmatter intact, settings.json
  valid JSON. The three guard-traps files now AGREE — quoted below.
Tree clean, 11 commits since BASE, origin in sync.
```

## Order of operations

Per the brief: `.claude/settings.json` first (its own commit, before the
skeleton), then the skeleton, then C1→C2→C3→R1→R2→C4→F7→F8→F9, each its own
commit naming the finding id. No source file under `src/`, `scripts/`,
`test-data/` was touched — this session applied prompt-surface findings only.

## What was applied

**C1 — `session-close/SKILL.md`'s guard-traps rule** (640c017). It still said
"never … or in the background"; `regression-guard.md` and `qa-tester.md` were
amended away from that on 2026-08-09, with the reasoning quoted in the diff.
Rewrote the rule and the instrument-block comment to agree.

**C2 — `CLAUDE.md`'s compact instructions** (03519fb). Replaced the reference
to `SCENARIO_PLANNING_BACKLOG.md`, which does not exist, with the session
brief verbatim and the skeleton report path / BASE hash — artefacts that do
exist and are what a compaction most needs to survive.

**C3 — the hand-enumerated `spec:*` loop** (366b827). Replaced with
`npm run suite`, which discovers every `spec:*` from `package.json` and
distinguishes CRASHED from FAILED — the loop's original purpose (not missing
`spec:step1-panel` again) is now structural rather than a grep pattern to get
right by hand each time.

**R1 — `qa-tester.md`'s standard numbering** (df3b8ec). Was
`1-9, 12, 10, 11, [How you report], 14, 13`. Renumbered `1-14` in reading
order and moved the two orphaned standards above `## How you report`, so that
section once again terminates the file's instructions. No wording changed;
the internal "Standard 10" cross-reference (inside the trap-mutation standard)
still resolves correctly, since it now points at standard 10 by its new
number too.

**R2 — `ui-consistency.md`'s missing bullet** (6925cca). `Tables:` had no
leading `- `, so it read as a continuation of the Filters bullet. One
character.

**C4 — the branch-merge appendix** (d5c7655), per Jon's 2026-09-07 decision
that direct-to-main is the settled mode. Moved §6 (Merge) and §7
(Record-the-merge commit) into a new `## Appendix: Branch sessions only (not
the working mode since 2026-08-08)`, stated as 275 commits with no merge. The
former §8 (working-agreement update) renumbered to §6 to close the numbering
gap this leaves — the same defect shape R1 just fixed elsewhere, so it seemed
right not to reintroduce it here. Checklist gained
`committed to main and pushed`; the two branch-only boxes moved under one
`branch sessions only` line pointing at the appendix, so a direct-to-main
session's checklist has no box it can never tick.

**F7 — the AI-approval hold** (c9344f2). Searched `EXPECTED.md` first, per
instruction: an entry already exists — **§33 "AI capability — hard gate"**
(`test-data/EXPECTED.md:9224`), dated implicitly by its position in the
document's own history rather than by an explicit date line, but a real
dated entry. Quoted rather than duplicated. Added one line to the working
agreement's §6 "Product decisions surfaced" list recording that the hold
stands, the `ai-capability` branch must not reach main, and enforcement moves
to `spec:ai-hold` (queued). `regression-guard.md`'s hard gate itself is
untouched, as instructed — the audit's Q1 asked whether the hold still
applies, and Jon's answer is that it does; nothing in the enforcement needed
to change today.

**F8 — the three pinned figures** (0ffbf41). Ran all three:

```
spec:derive:           PINNED ARPU MAPEs: 13.8845 / 13.4315 / 14.3888 / 13.0192   spread 1.3696pp
                        derive-aggregate spec: 75 passed, 0 failed
spec:leafgrain:         [diagnosis] 5-part store: 72 scored / 74;  7-part only: 72 scored / 74
                        leaf-grain spec: 17 passed, 0 failed
spec:generate-missing:  generate-missing spec: 44 passed, 0 failed  (0 FAILs)
```

The first two print their pinned figures directly and both match the recorded
pins exactly. The third does not print `74/72/2` anywhere — it is asserted
(`first.leaves.length === 74`, `skipped.length === 2`, `store.size === 72`)
rather than logged, so the pin's only confirmation is the absence of a FAIL
against those three lines, which held. Recorded "last verified 2026-09-07"
beside all three in `session-close/SKILL.md`, with the values, and noted that
the third is asserted rather than printed so a future session does not go
looking for a console line that was never there.

No figure differed from its pin. Per instruction, none of the three pins was
touched — only the verification date and, for the first two, the measured
values were added beside them.

**F9 — the fixture row-count table's date** (86d9a1f). No date was recorded
in `fixture-handling/SKILL.md` when it was written. `git log --follow` on the
file shows exactly one commit — `27cce36`, 2026-08-08, the commit that
created it — and no edit since. Dated the table from that, and stated the
method in the file itself (git log of the file, because no date was recorded)
per the instruction's fallback clause.

## Declined

**R3** — the audit's own proposed shortening of `report-writing/SKILL.md`'s
description. Left untouched, as instructed. (The audit's report noted this as
the one finding Jon might reasonably decline, since the enumeration is cheap
insurance on a rule that has demonstrably leaked four times.)

## Verify

**Every edited file still parses.** `.claude/settings.json` checked with
`JSON.parse` — valid. The six markdown files were each checked by reading
their first lines back: frontmatter intact (`---\nname: …\ndescription: …\n---`)
where present, and the body readable, for `session-close/SKILL.md` (edited
four times, by C1/C3/C4/F8), `fixture-handling/SKILL.md`, `CLAUDE.md`,
`qa-tester.md`, `ui-consistency.md`, and the working-agreement document.

**The three files carrying the guard-traps rule now agree.** Quoted in full:

`regression-guard.md:323-331` (unchanged by this session — the source of the
2026-08-09 amendment):

> "Run it **once**, with a long timeout. **The prohibition is on a SECOND
> instance, not on backgrounding.** Amended 2026-08-09: the rule first said
> 'never in the background', and two consecutive gates backgrounded it anyway
> because the run exceeds the 120s foreground timeout and the harness moves
> it there. Both were correct to — they ran one instance and waited. A rule
> that forbids the only workable way to run the thing gets ignored, and an
> ignored rule stops protecting the part that matters. So: background it if
> you must, then **wait for that instance to finish**. Never start another
> because the first is slow."

`qa-tester.md:426-431` (also unchanged — the duplicate copy of the same
amendment already present before this session):

> Identical text to the above, word for word.

`session-close/SKILL.md:103-108` (the file this session fixed, C1):

> "Never run a SECOND `guard-traps` instance while one is in flight, and let
> nothing else read the tree while it runs — it mutates tracked source, and
> overlapping runs have left a mutated file in the tree. Backgrounding a
> single instance is fine and is usually necessary: the run exceeds the 120s
> foreground timeout. Start one, wait for it, then run everything else.
> (Amended 2026-08-09 in regression-guard.md and qa-tester.md; this file was
> missed.)"

All three now say the same thing: one instance permitted, backgrounding
permitted, a second concurrent instance forbidden. The third file states it
in its own shorter words rather than reproducing the other two verbatim,
which is a deliberate choice — copying the full passage a third time would
have been the near-duplicate-content pattern the audit itself flags
elsewhere, for no gain over a shorter sentence saying the same thing.

**No source change.** `git diff --stat 6a90112..HEAD -- src/ scripts/
test-data/ package.json` is empty throughout this session. The last gated
commit is unchanged at **`bd50f27`** — nothing here required or triggered a
gate, since nothing under `src/` moved.

## Limits

- **F7's EXPECTED.md entry has no explicit date line.** §33 is dated by its
  position in the document's edit history rather than by a stated date; the
  brief's fallback ("say which" if no date is recorded) applied to F9, not
  F7, since F7 asked only to search and quote. Not fixed here, because it was
  not asked for.
- **F8's third pin (`generate-missing`) was never printed by the instrument
  itself**, only asserted. This session confirmed it by absence-of-FAIL
  rather than by reading a number, and said so rather than presenting it as
  read directly.
- **No gate was run.** This session touches only the prompt surface; the
  working-agreement's own gated state (`bd50f27`, 167/167, 60/60) is
  unaffected and unchanged.

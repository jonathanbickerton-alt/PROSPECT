# Tariff scope — STOPPED: the named base report does not exist

```
FOR ADVISOR
Generated: 2026-09-09 12:25 +0100 (UTC 2026-09-09 11:25)
Certifies: none — nothing read beyond reports/ and git; nothing changed.

STOPPED ON THE BRIEF'S FIRST INSTRUCTION: "if that report does not exist,
  STOP and say so — do not proceed on 9c93807." That report DOES NOT EXIST:
  absent from the working tree AND from every commit in history (`find`,
  `git log --all --name-only`). NOT PROCEEDED ON 9c93807.
WHAT reports/ HOLDS for that arc: 0939 inventory, 0948 the STOP at 1(c), 1039
  the engine + predicate half. There is no -ui report.
WHY: the REQ-D6-02 UI session never ran. The 1039 brief carried its own shed
  clause and that session took it — items 1-2 built and gated at 9c93807,
  items 3-5 HELD WHOLE. Recorded in 1039 §Scope. Not a filing error.
CONSEQUENCE: this brief reads as though that UI had shipped. It has not, so
  "prior count + 5" is 177 + 5, not 180 + 5, and `next free trap id` is still
  182 with REQ-D6-02's three ids unused.
HEAD d92cc36 = 9c93807 + four reports-only commits (9eefbfc, f8e8879,
  72e08f8, d92cc36); ZERO drift. Stated only — the STOP forbids proceeding.
BRIEF TRUNCATED AGAIN at item 5 ("lint,"); items 6-7 absent. Named, not
  filled; this report is filed by CLAUDE.md's convention.
NOTHING BUILT, NOTHING RECORDED, NO GATE. The D number is unassigned and
  EXPECTED.md is untouched; the decision text is complete in the brief.
TWO WAYS FORWARD, Jon's call: (a) re-brief on 9c93807 naming 1039 as the base
  and correcting the arithmetic to 177 + 5; or (b) run the held UI session
  first, then re-issue this brief unchanged.
```

## What was checked

```
git log --oneline -1     d92cc36 Report the tariff-scope STOP at item 1
git status --short       (clean)
ls reports/ | grep delta 0939-delta-month-inventory.md
                         0948-delta-month-selector.md
                         1039-delta-month-selector-build.md
find . -name "*delta-month-selector-ui*"                    (no match)
git log --all --name-only | grep delta-month-selector-ui    (no match)
```

The second check matters more than the first: the file is absent from **every
commit in the repository's history**, so it was never written and later
deleted — it was never written at all.

## Why it does not exist

The REQ-D6-02 UI session never ran. Its brief (the 1039 one) carried this
clause:

> *If the session cannot finish all of 1–5 gated, STOP after 1 and 2 gated and
> committed, and report — the UI is a second session.*

That session took the clause deliberately and said so at the close checkpoint:
the engine fields and the actuals predicate were built, gated and committed at
`9c93807`; the selector, the Revenue card, their mounted spec and their three
traps were **held whole**, with nothing half-applied. It is recorded in
`reports/2026-09-09-1039-delta-month-selector-build.md` under *Scope: the
brief's own stop point, taken*, and it was reported at the time.

So the missing report is not a filing error. The session it would describe has
not happened.

## What this implies for the brief as written

- **The trap arithmetic is off by the held work.** The brief expects
  "prior count + 5". The prior count is **177**, not 180 — REQ-D6-02's three
  traps were never built either — so a completed session would land on
  **182**, and `next free trap id` is **182** right now, unchanged since
  `d63e67a`.
- **Nothing else in the brief depends on the UI.** The tariff-scope decision,
  its nine clauses, and the 1217 emitter enumeration all stand on their own.
  The decision text is complete and was not recorded, because recording is
  ordered *before code* and the STOP precedes both.

I did not treat any of this as licence to proceed. The instruction was
explicit and unconditional, and the previous session had already reported the
same absence — a second silent workaround would have made the same gap invisible
twice.

## The truncation, again

This brief ends mid-item-5, at `lint,`, and items 6 and 7 (commit, report path)
are absent — the same shape as the 1217 brief. It changed nothing here, since
the STOP fires long before the gate, and this report is filed under CLAUDE.md's
naming convention. Named rather than filled, per the 1341 rule.

## Two ways forward

1. **Re-brief on `9c93807`**, naming `reports/2026-09-09-1039-delta-month-
   selector-build.md` as the base and correcting the trap arithmetic to
   177 + 5. Nothing else in the brief needs to change.
2. **Run the held REQ-D6-02 UI session first.** It produces the `-ui` report
   this brief expects, after which this brief can be re-issued unchanged — but
   note it would also move the trap count, so "prior count + 5" would then be
   180 + 5.

Either is a line. I have no preference that should override yours; (1) is
smaller and unblocks the UAT finding sooner, (2) keeps the arc in the order the
brief assumes.

## Limits

- **Nothing was read but `reports/` and git metadata.** No source file was
  opened this session, so the 1217 enumeration and the 1202 inventory are
  unre-checked — their line numbers will need re-checking whenever this brief
  is re-issued, and two sessions have edited `WhatIfTab.tsx` since 1202.
- **Nothing changed.** No `src/`, no `scripts/`, no `test-data/`. There is no
  `Repo:` line because nothing was committed but this report.

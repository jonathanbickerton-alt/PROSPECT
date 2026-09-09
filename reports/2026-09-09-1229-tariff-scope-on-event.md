# Tariff scope on an event — STOPPED again on the base clause

```
FOR ADVISOR
Generated: 2026-09-09 12:29 +0100 (UTC 2026-09-09 11:29)
Certifies: none — nothing read beyond git metadata; nothing changed.

STOPPED, SECOND TIME, ON THE SAME UNCHANGED CLAUSE: "if that report does not
  exist, STOP and say so — do not proceed on 9c93807." It still does not
  exist, in the tree or in any commit. Re-verified this session.
THE BRIEF IS OTHERWISE COMPLETE NOW: item 7's end-marker is present and item
  5's shed clause is whole, so the truncation reported at 1217 and 1225 is
  fixed. The base clause is the ONLY thing blocking the build.
NOTHING HAS CHANGED SINCE 1225 but reports: `git diff 9c93807 -- src/
  scripts/ test-data/ package.json` is empty. HEAD f7dce20 = 9c93807 + five
  reports-only commits.
THE ONE-LINE FIX, replacing the brief's first sentence:
  "Base 9c93807 — the Repo line of reports/2026-09-09-1039-delta-month-
   selector-build.md; confirm with `git log --oneline -1` (reports-only fill
   commits ahead are fine; say so)."
AND ONE FIGURE: item 5's "prior count + 5" becomes 177 + 5 = 182, because
  REQ-D6-02's UI and its three traps were held. `next free trap id` is 182.
NOTHING ELSE IN THE BRIEF NEEDS TO CHANGE. Decision clauses (1)-(9) stand,
  the 1217 emitter enumeration stands, items 1-6 stand.
NOT RECORDED, NOT BUILT, NO GATE: the D number is unassigned and EXPECTED.md
  is untouched. The full argument is in reports/2026-09-09-1225-tariff-scope-
  base-absent.md; this report exists so the second stop is on the record too.
```

## The stop

`reports/2026-09-09-…-delta-month-selector-ui.md` is still absent — from the
working tree and from every commit in history. Re-checked this session with
`find` and `git log --all --name-only`; both return nothing.

The brief's first instruction is unconditional — *"if that report does not
exist, STOP and say so — do not proceed on 9c93807"* — so I have not run item
1, not recorded the decision, and not touched `src/`, `scripts/` or
`test-data/`.

**This is the second time on the same clause.** The re-issued brief fixed the
truncation I reported (item 7's end-marker is now present, item 5's shed clause
is complete) but left the base sentence unchanged. I have read that as the
instruction it is rather than as an oversight to work around: the clause names
`9c93807` explicitly and forbids proceeding on it, which is exactly the tree a
workaround would use.

**Why the report does not exist** is unchanged and is set out in full in
`reports/2026-09-09-1225-tariff-scope-base-absent.md`: the REQ-D6-02 UI session
never ran, because the 1039 brief carried its own shed clause and that session
took it — engine and predicate built and gated at `9c93807`, selector and
Revenue card held whole.

## The one-line fix

Replace the brief's first sentence with:

> Base `9c93807` — the Repo line of
> `reports/2026-09-09-1039-delta-month-selector-build.md`; confirm with
> `git log --oneline -1` (reports-only fill commits ahead are fine; say so).

and change item 5's `prior count + 5` to **177 + 5**. `next free trap id` is
**182**, unchanged since `d63e67a`, because REQ-D6-02's three traps were held
with its UI.

Nothing else needs to move. The nine decision clauses, the 1217 emitter
enumeration they rest on, and items 1–6 are all consistent with `9c93807`.

## What the next session will do first

Item 1 is read-only and was not run here, but it is the only unknown left
before the build: whether each carrier's emitters funnel through a single state
writer, and which restore/import paths build events from a sheet (those must
**not** call `tariffScopeFor` — the sheet carries the answer). The 1217 report
already enumerates the emitters; the funnel question and the import sweep are
new, and both are cheap.

## Limits

- **Nothing was read but git metadata.** No source file was opened, so the
  1202 and 1217 line numbers remain unre-checked; they will need re-checking
  when the brief is re-issued.
- **Nothing changed.** No `Repo:` line, because nothing was committed but this
  report and its skeleton.

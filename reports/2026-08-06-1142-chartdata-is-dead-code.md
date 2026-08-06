# FOR ADVISOR

**Generated:** 2026-08-06 11:42
**Certifies:** none — `e672646` ungated. STOPPED on a retraction; your decision needed.

**Findings**
- `chartData` is DEAD CODE: declared, never read. Proven by rename — typecheck 0, build clean, specs green.
- Dead on **main** too, at the same three occurrences — dead before Session D touched it.
- RETRACTION: stage 3's "the chart still fabricates a line" cannot have been visible. I recorded it as fact.
- The rendered chart is `multiChartData`, which the map already showed never had share-scaling.
- So the "table honest, chart fabricating" transient state never existed on screen.
- The "2-row screen change" behind the Session C merge decision was, chart-side, no screen change at all.
- Session D's deletion stays correct — dead fabricating code is worth removing — but for a different reason, blast radius zero.
- Three reviews called it live; none asked whether the memo was read. Each inherited the assumption from the one before.
- Your step 1 is unexecutable as written: it names the Lines of a chart that is not the rendered one.

**Decisions needed from Jon / advisor**
- Retarget the series identities onto `multiChartData`'s Lines, or drop that step entirely?
- Delete `chartData` outright (~460 lines, logic duplicated in `multiChartData`) — own branch, or leave recorded?
- The family declaration's wording: "three in the chart" describes unreachable fallbacks. Reword, or scope it to the table?

**Merge state:** UNMERGED, UNGATED on `session-d-chartdata` at `e672646`. No gate run. Tasks 2/3 unstarted.

---

## What I found, and how

Working step 1 — give the forecast and actuals Lines stable identities — I went
looking for them and found the rendered comparison chart does not use `chartData`
at all. Its Lines read `${prefix}_baseline` and `${prefix}_actual`, which come
from **`multiChartData`**.

Then the prior question, which nobody had asked: **is `chartData` read at all?**

Every occurrence of the bare name in the file is either a comment, the
declaration itself, or a *different* `chartData` — a property on the challenger
group type. Proven rather than argued: renaming the memo to `__unusedChartData`
leaves typecheck at 0, the build clean, `spec:unscored` 8/8 and `npm run traps`
3/3. Nothing notices.

It is dead on **main** too, at the same three occurrences. It was dead before
Session D touched it.

## What this retracts

Stage 3 of the Session C gate reported that selecting a trigger-population row
showed "a fabricated share-scaled line in the chart" beside an unscored table
row. **I recorded that as a finding**, wrote it into EXPECTED.md as a named
transient state, carried it into the Session C merge decision, and built this
branch's framing on it.

It cannot have been visible.

- The **transient state did not exist on screen**, and the strike that closed it
  rests on a false premise. Both are now corrected at the lead of the entry.
- The **"2-row screen change"** you reasoned about across two merges was, on the
  chart side, **no screen change at all**.
- **Session D's deletion remains correct** — dead code that fabricates is still
  worth deleting, and `spec:triggers` still earns its place — but it was correct
  for a different reason, with a blast radius of zero rather than two rows.

## How it survived three reviews

A dependency-mapper pass traced the closures' consumers *within* the memo. A
stage-3 gate inferred a user impact from reading the branch. My reports repeated
both. None asked whether the memo was read, because each was handed the
assumption by the one before — including by me, in the prompts I wrote.

**A consumer map that starts inside the thing being mapped cannot discover that
the thing has no consumers.** The check that would have caught it is the cheapest
one available and I ran it only when a different question forced me to: rename the
symbol, see whether anything notices.

Worth noting the shape: this is the fourth time on this programme that a
plausible, unchallenged claim propagated through reviews — after the fabricated
identifiers, the "buildCohortAccuracy is exported" claim, and my own 0/0/2
mislabelling. The common factor is not carelessness in any one step; it is that
each step's input was another step's confident output.

## Why I stopped

Step 1 is unexecutable as written: it asks for stable identities on the forecast
and actuals Lines so the assertion pair can be built, but those Lines belong to a
chart whose fabrication path was never reachable. Building the assertion pair
against `multiChartData` would be a different piece of work aimed at a different
mechanism — one the dependency map says never had the defect.

And the family-closed declaration cannot be made in the agreed words: *"three in
the chart"* describes fallbacks that no user could reach, which is a materially
weaker claim than the table's three.

## Carried forward

- Your three decisions above.
- If `chartData` is to go, it is its own branch: ~460 lines, with logic duplicated
  in `multiChartData` that should be checked for divergence first.
- The full gate and merge for this branch, once the framing is settled — the code
  changes in it are green and measured, only the *account* of what they did was
  wrong.
- Tasks 2 and 3, unstarted.

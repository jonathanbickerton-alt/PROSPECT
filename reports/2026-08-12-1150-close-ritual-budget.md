# The close ritual is budgeted work — hygiene and verification

## FOR ADVISOR

```
Generated: 2026-08-12 11:50 +0100 (UTC 2026-08-12 10:50)
Certifies: docs and records only — ZERO source files changed.
Repo: committed e3cdfda, pushed (origin in sync)
PART 1 — STATE: HEAD was 0b90640, tree CLEAN, origin in sync. The negative-ARPU
  sign-fix work is COMMITTED AND PUSHED at 03a08fe, so the commit-and-push
  branch of the stability rule did not apply and nothing was guessed. Verified
  not assumed: grep for neg( / abs( / Math.abs( on arpuOverride returns ZERO.
CORRECTION: there is ONE rider commit, not two. 03a08fe IS the sign fix — seven
  transforms removed, negative spec and fixture cases, trap 62, and traps 60/61
  re-aimed in the same commit because the fix rewrote the lines they pinned.
PART 2 — THE RIDER REPORT ALREADY EXISTED, pushed at 0b90640 one commit ago, so
  I did NOT write a second. Two real gaps closed in it: both defects are now
  classified INTRODUCED BY 6667464 with the reason they cannot be pre-existing,
  and the generalised rule now sits BESIDE the rates rule in EXPECTED.md rather
  than only inside the rider's own entry.
THE RULE, both halves together: a rate does not split across cohorts, and a rate
  does not flip with the metric's direction. Sign conventions belong to
  QUANTITIES; a rate stated absolutely is written and read VERBATIM.
PART 3 — BUDGET CLAUSE in CLAUDE.md and as section 0 of session-close: if the
  close ritual cannot be afforded, the last increment taken on could not be
  afforded either. A session running short sheds SCOPE, never the record. THREE
  GAPS IN A WEEK, none from ignorance — the third happened one commit before
  that very rule was strengthened. The trigger was never the weak part; the
  budget was. The build survives in the diff; the reasoning does not.
No gate run and no figure re-measured: there is no behaviour to gate.
```

---

## Part 1 — state check

| | |
|---|---|
| HEAD at session start | `0b90640` |
| Tree | **clean** — nothing uncommitted |
| Origin | in sync, 0 ahead / 0 behind |

**The negative-ARPU sign-fix work is COMMITTED AND PUSHED at `03a08fe`.** No
uncommitted work was found, so the stability rule's commit-and-push branch did
not apply and nothing was guessed at.

**One correction to the brief.** It asks for a report covering "BOTH rider
commits — `03a08fe` and the sign-fix commit from part 1". **There is only one
rider commit.** `03a08fe` *is* the sign fix: it removed all seven sign
transforms, added the negative spec and fixture cases, added guard-trap 62, and
re-aimed traps 60 and 61 in the same commit — the last of those because the fix
had rewritten the exact lines they pinned.

**Verified rather than assumed:** `grep` for `neg(` / `abs(` / `Math.abs(`
against `arpuOverride` across `src/` returns **0**.

## Part 2 — the rider report already existed

`reports/2026-08-12-1143-negative-arpu-rider.md` was written and pushed at
`0b90640`, one commit before this session. **I did not write a second one.**

Two genuine gaps against the brief's specification were closed in it:

1. **The introducing commit is now named.** The report said "the request-1 build
   the day before"; it now classifies both defects explicitly as **INTRODUCED BY
   `6667464`**, with the reason they cannot be pre-existing — before `6667464`
   there was no `arpuOverride` for a sign convention to be wrong about.
2. **The generalised rule now sits beside the rates rule** in EXPECTED.md rather
   than only inside the rider's own entry. See below.

Everything else the brief asked for was already present: both defects with their
mechanisms, the seven enumerated sites, the −5-reopening-as-+5 behaviour, the
masking on Inflow/Retention, the no-clamp findings (no `Math.max` on the ARPU
path, no `min` attribute on the input — asserted in the spec, not eyeballed), and
the spec/fixture/trap deltas with counts (`event-roundtrip` 55 → 59,
`override-arpu` 30 → 37, fixture row `promo-mix-6`, guard-trap 62).

### The generalised rule, placed where it belongs

EXPECTED.md's rates rule previously said only that a rate applies at full
magnitude and never pro-rates. It now carries its second half:

> **Sign conventions belong to QUANTITIES.** This app stores Outflow volumes and
> revenue negative and displays them positive, via a `neg()`/`abs()` pair; a
> **rate stated absolutely is written and read VERBATIM**, with no transform on
> either side.

The two halves read together: a rate does not split across cohorts, and a rate
does not flip with the metric's direction. Both follow from *a rate is not a
quantity*, and both were learned the same way — by a quantity's habit being
applied to one.

## Part 3 — the budget clause

Added to `CLAUDE.md`'s stability rule and to `§0` of the session-close skill,
which is now the **first** thing that skill says:

> **If the close ritual cannot be afforded, the last increment taken on could
> not be afforded either.**

Commit, push and report are inside the session's budget from the first minute,
not funded by what survives it. **A session running short sheds SCOPE, never the
record** — hold the last increment explicitly, say so, and close properly on what
is done.

### Why, recorded with the evidence

**Three report gaps in one week, each the same shape**: a session that spent its
close-ritual budget on scope and had nothing left to record with.

| gap | what was lost |
|---|---|
| Two branches fast-forwarded onto main | the merge, its verification and its re-run suite — recorded nowhere |
| The Value-card comparator diagnosis | lived only in a transcript until the next brief planned against a merge that did not exist |
| The negative-ARPU rider (`03a08fe`) | committed with no report, **one commit before the rule requiring one was strengthened** |

**None was caused by not knowing the rule.** The rule was known in all three, and
in the third it was being *amended* at the time. All three were caused by
treating the record as the thing that gets cut when time runs short — which
inverts the value: **the build is recoverable from the diff and the reasoning is
not.**

That is why this clause targets the *budget* rather than the wording. The
previous amendment widened what triggers a report and did not stop the next gap,
because the trigger was never the weak part.

## Scope and verification

**Zero source files changed.** `git diff --name-only | grep '^src/'` returns
**0** — this session touched only `CLAUDE.md`, the session-close skill,
EXPECTED.md and two reports.

No figure can therefore have moved, and none was re-measured: that is the basis
stated rather than a re-run claimed. No gate was run, because there is no
behaviour to gate.

## Where things stand

Request 2 (Value card per-tier Base ARPU) is **not built**. Request 3 (promotion
value-mix arm) is **not started**, and its four decisions are recorded nowhere
yet — they arrived in a brief whose premise was a Request 2 merge that does not
exist. The option-(b) comparator session remains queued and untouched.

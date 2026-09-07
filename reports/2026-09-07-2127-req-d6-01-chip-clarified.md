# REQ-D6-01: what the Events summary chip counts, clarified

```
FOR ADVISOR
Generated: 2026-09-07 21:27 +0100 (UTC 2026-09-07 20:27)
Certifies: e4fd63f (the tree the suite and survival were measured on)
Repo: committed e4fd63f, pushed (origin in sync)

BASE 7118e5b + d34f468 (reports/ only; ZERO drift in gated paths). Proceeded.
DOCS ONLY. EXPECTED.md's REQ-D6-01 entry, appended. No source change.
FINDING: the entry's sentence is about a DIFFERENT CONTROL from the decision.
STEP 1a EXPECTED.md a23d8bf, decision 6, verbatim: "the summary bar's 'N
  events' badge counts events that are ON; the KPI caption counts applied
  (unchanged...); the Metadata sheet counts all rows."  <- summary BAR.
STEP 1b CODE, the chip, EventsSummaryTable.tsx:109 verbatim:
  "t('whatif_summary_count', { count: rows.length })"  <- ALL rows, always has.
  The BAR badge is ForecastSummaryBar.tsx:33: "(adjustedForecast?.marketEvents
  ?? []).filter(isEventOn).length"  <- ON only. Two controls, not one.
STEP 1c SPEC: NOTHING asserts the chip's semantics. events-summary-spec.ts:53
  lists 'whatif_summary_count' among keys that must EXIST in en - nothing more.
  event-toggle-spec.tsx:128 asserts the BAR badge, not the chip.
STEP 2: a Value event is a YieldEvent; apply site 1 (WhatIfTab.tsx:1133)
  filters marketEvents only, and its result feeds appliedEventIds (:1200) which
  the caption sums (:4539) - so a mix event applied at site 2 (:1323) moves
  ARPU without ever entering "4 applied".
APPENDED VERBATIM: the brief's CLARIFIED sentence, plus a note recording the
  two-control distinction. Nothing existing was edited. 12 insertions.
suite 61/61   survival 104/26 derefs/files, 27/27 checks
```

## Step 1 — the three statements, side by side

**They are not three statements about one thing. Two of them are about
different controls**, and that is the session's finding.

| source | what it says | which control |
|---|---|---|
| **EXPECTED.md** `a23d8bf`, decision 6 | *"the summary bar's `N events` badge counts events that are **ON**; the KPI caption counts **applied** (unchanged — the predicate at apply site 1 propagates through `appliedEventIds`); the **Metadata sheet counts all rows**."* | the summary **bar** |
| **Code** `EventsSummaryTable.tsx:109` | `t('whatif_summary_count', { count: rows.length })` | the summary panel's **chip** |
| **Code** `ForecastSummaryBar.tsx:33` | `const eventCount = (adjustedForecast?.marketEvents ?? []).filter(isEventOn).length;` | the summary **bar** |
| **Spec** `events-summary-spec.ts:53` | lists `'whatif_summary_count'` among keys asserted to **exist in `en`** — nothing about what it counts | the **chip**, key only |
| **Spec** `event-toggle-spec.tsx:128` | `check('badge: the event count is taken through isEventOn', …)` | the **bar**, guarded by trap 169 |

**Read together:** EXPECTED.md's decision 6 describes the **summary bar's**
badge, and the code agrees with it exactly — `ForecastSummaryBar` filters
through `isEventOn` and counts ON. The **Events summary panel's chip** is a
different control on a different component, has always counted `rows.length`
(all rows, on and off), and **no spec asserts its semantics in either
direction**. The only spec mention of its key checks that the key exists.

So Jon's decision does not overturn anything in the code or in a spec. What it
corrects is a *reading*: the two controls carry near-identical labels ("N
events"), and decision 6's sentence is easy to apply to whichever one the
reader has in mind. The brief anticipated the entry might already say the chip
counts all rows; it does not say that — it says something true about a
different control.

**Nothing was changed.** No source file, no spec, no existing line of
EXPECTED.md.

## Step 2 — why a Value event is not in "4 applied"

**A Value (mix) event is a `YieldEvent`, and apply site 1
(`WhatIfTab.tsx:1133`) filters `marketEvents` only — its result is what feeds
`applyEventsToMonth` and therefore `appliedEventIds` (`:1200`), which the
caption sums (`:4539`) — so a mix event applied on the yield path at apply
site 2 (`:1323`) moves ARPU without ever entering the count.**

The site's own comment says as much: *"This one feeds `applyEventsToMonth`, so
the KPI caption's `appliedEventIds` and `zeroCoverageEventIds` follow from here
without a second check."* That is the caption working as designed — it is a
volume-path count, not an all-carriers count — and it is why the walk's `chip
10 / caption 4 / five on` are three different numbers rather than a
discrepancy.

## Step 3 — the append

Appended to the REQ-D6-01 entry, after its closing "does NOT add a sixth row
renderer" paragraph and before the `#### D5-08` heading, in the same bold form
as D5-07's and D5-08's closures:

```diff
+**CLARIFIED (Jon, 2026-09-07): the Events summary chip counts all rows, on and
+off (total); the KPI caption counts applied via site 1 (volume path); Metadata
+counts all rows. Walked on the 07 Sep 09:13 save: chip 10, caption 4, five on.**
+
+*Note on decision 6 above, which this does not contradict.* Decision 6 is about
+the **summary bar's** badge (`ForecastSummaryBar.tsx:33`,
+`.filter(isEventOn).length`, guarded by trap 169) — a different control from
+the **Events summary panel's** chip (`EventsSummaryTable.tsx:109`,
+`{ count: rows.length }`). The two carry similar labels and count different
+things by design; the chip has always counted all rows, and no spec asserts its
+semantics either way.
```

The brief's sentence is verbatim. **The note is mine and is the reason to read
it**: without it, a future reader lands on decision 6 ("badge counts ON") and
the clarification ("chip counts all") on the same page and reasonably concludes
one supersedes the other. Neither does. Recording the distinction where both
sentences live is the only place it stops being re-derived — and correcting
decision 6 in place, which the standing rule would otherwise demand, would have
been wrong here, because decision 6 is not stale. It is accurate about its own
control.

Twelve insertions, zero deletions; `EXPECTED.md` is the only file touched.

## Gate

```
full suite   61/61 green   (unchanged from 7118e5b)
survival     104/26 dereferences/files; 27/27 checks
```

No `guard-traps` — no source, script or `package.json` change. Trap 169 (the
bar badge) and trap 176 are untouched and unrun; the last gated trap figure
remains **172/172** at `8c0cb71`.

## Limits

- **The walk figures are recorded, not reproduced.** `chip 10, caption 4, five
  on` is Jon's observation on the 07 Sep 09:13 save; this session mounted
  nothing and opened no save.
- **The chip's semantics remain unasserted.** Nothing in the suite would catch
  the chip being switched to an ON-count tomorrow. That is now a *documented*
  gap rather than an unnoticed one, but it is still a gap — a one-line check in
  `events-summary-spec` would close it, and was not in this brief's scope.
- **Metadata's "counts all rows" was not re-verified** in code this session;
  it is quoted from decision 6, which the brief did not ask me to re-measure.

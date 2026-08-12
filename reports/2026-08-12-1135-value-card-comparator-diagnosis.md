# The Value card's equal-weight comparator — diagnosis

## FOR ADVISOR

```
Generated: 2026-08-12 11:35 +0100 (UTC 2026-08-12 10:35)
Certifies: no code change — read-only diagnosis, written RETROSPECTIVELY.
Repo: committed 03a08fe, pushed (origin in sync). That commit is the
  negative-ARPU rider, NOT this diagnosis, which changed no source.
NOTHING WAS RE-RUN to produce this. Figures and lines were measured in the
  2026-08-12 session carrying the Request 2 brief; lines are as at 9f5d5fb.
THE COMPARATOR IS NOT ONE SITE. The equal-weight mean appears FOUR times and
  TWO are inside the forecast ENGINE, not on a label:
    WhatIfTab:855   storedEqualWeightArpu     -> denominator of yieldRatio
    WhatIfTab:1013  retStoredEqualWeightArpu  -> denominator of retYieldRatio
    WhatIfTab:1354  baselineBlendedArpu       -> the card's "vs baseline"
    WhatIfTab:5247  evtBaselineArpu           -> the event list's ARPU delta
  The first two COMPUTE a forecast number rather than describe one. A fifth
  sits in computeTierData's scaling branch, setting displayed tier ARPUs.
SHARES SPLIT: derivable at DRAFT time (computeTierData accumulates vol per tier,
  then discards it) but NOT from a stored event — YieldEvent persists tariffMix
  and tariffBaseArpu only. THEREFORE option (a), card-only share-weighting,
  puts the card in disagreement with the forecast it describes.
EIGHT `tariffBaseArpu[...] ?? 0` SITES: 853, 857, 1011, 1015, 5242, 5247, 5272,
  5325 — four card display, four engine arithmetic. And computeTierData
  MANUFACTURES a zero: no volume returns historicalArpu 0, which is UNKNOWN.
WRITERS ARE COUNTABLE: ONE construction site (WhatIfTab 1641-1667) and ONE
  import route (App.tsx:1032) — no second path, unlike market events.
Decision since (Jon): option (c); (b) queued as its own gated session. THE RULE
  CHANGED — see section 5; this diagnosis nearly stayed in a chat transcript.
```

---

## Why this file exists

**This diagnosis nearly lived only in a chat transcript.** It was produced as
the first half of a session whose build was then held, delivered inline, and
never written down. The next brief arrived assuming a merge that did not exist,
which is precisely the failure mode an unwritten finding produces: the work is
real, the record is not, and the next session plans against the gap.

The report-trigger rule as written covered **state changes**. This session
changed no state and produced findings a later session would consume — a case
the rule did not name. It does now; see §5.

## 1. What was asked

Whether the Value card's "vs baseline" comparator could be made share-weighted
like-for-like, since it compares a share-weighted blend against an equal-weight
mean whose own comment says "Approximate".

## 2. The comparator is four sites, and two are load-bearing

| site | symbol | what it feeds |
|---|---|---|
| `WhatIfTab:855` | `storedEqualWeightArpu` | **denominator of `yieldRatio`**, applied to the forecast's per-scenario Inflow ARPU |
| `WhatIfTab:1013` | `retStoredEqualWeightArpu` | **denominator of `retYieldRatio`**, same for Retention |
| `WhatIfTab:1354` | `baselineBlendedArpu` | the card's "vs baseline" display |
| `WhatIfTab:5247` | `evtBaselineArpu` | the event list's displayed ARPU delta |

The first two do not label a number. They **compute** one, and it reaches the
adjusted forecast. Any change to them moves figures.

A fifth instance sits in `computeTierData`'s forecast-scaling branch, which
derives its scale factor from `Σ historicalArpu / n` — the same assumption again,
this time deciding the tier ARPUs the card displays.

## 3. The shares question splits

- **At draft time: available.** `computeTierData` builds a `tierMap` of
  `{ vol, rev }` per tier and then keeps only `rev / vol`. The per-tier volume —
  which *is* the baseline share, up to normalisation — is computed and discarded.
- **From a stored event: absent.** `YieldEvent` persists `tariffMix` and
  `tariffBaseArpu`. Baseline shares were never stored, so the engine has nothing
  to reconstruct them from.

**That asymmetry is the whole finding.** It means:

- **option (a), card-only share-weighting** — makes the card disagree with the
  forecast it describes. A worse inconsistency than the one being fixed;
- **option (b), both** — needs a **new persisted carrier** on `YieldEvent`, a
  migration story for events saved without it, and it **will move forecast
  figures**;
- **option (c), keep the honest label** — costs nothing and stays truthful.

## 4. Absence discipline is wider than the comparator

`tariffBaseArpu[tier] ?? 0` appears at **eight** read sites: `853`, `857`,
`1011`, `1015`, `5242`, `5247`, `5272`, `5325`. Four are card display, four are
engine arithmetic.

And `computeTierData` **manufactures** the zero at source: `vol > 0 ? rev / vol
: 0`. A tier with no volume has **no known ARPU**; returning 0 makes it read as
a real and very cheap tier. That is the diluting-zero pattern this programme has
now removed three times elsewhere.

## 5. The rule this changed

`CLAUDE.md` and the report-writing skill required a report for any session that
**changes repo state**. A read-only session was permitted to end with an inline
summary. That is right for a question answered and forgotten, and wrong for a
diagnosis a later session is expected to build on.

Both now require a report for a session that changes state **or produces
findings a future session will consume**, with inline summaries reserved for
trivial read-only checks carrying nothing forward. The evidence is this file:
its findings determined that option (a) was unsafe and that option (b) needs a
new persisted field — and they were, for two sessions, retrievable only from a
transcript.

## Limits of this record

Written after the fact. **Nothing was re-run to produce it**, and no figure here
was re-measured at write time. Line numbers are as at `9f5d5fb`. The commit named
in the block above is the negative-ARPU rider that happened to be in flight; this
diagnosis certifies no code change of its own.

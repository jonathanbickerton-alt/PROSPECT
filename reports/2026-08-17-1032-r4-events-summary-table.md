# R4 — the combined events summary table

## FOR ADVISOR

```
Generated: 2026-08-17 10:32 +0100 (UTC 2026-08-17 09:32)
Certifies: __PENDING__
Repo: __PENDING__
SKELETON CREATED AS THIS SESSION'S FIRST ACTION, before the base check.
BASE: HEAD 0269fb6 vs the brief's b3795f3 — one commit, REPORT-ONLY (--stat).
SHIPPED: a collapsed-by-default Events summary panel between the visual and the
  cards. All THREE carriers, four kinds, PIPELINE order, capped and scrollable.
FOUR SUMMARISERS, one per kind, exported, DESCRIBING from stored fields. The
  yield blend uses the shared blendTierMixOrNull, not a local sum.
FINDING — SCENARIO COMPARE IGNORES target AND cohortScope ENTIRELY, multiplying
  the WHOLE blended ARPU; WhatIfTab honours both. PRE-EXISTING, but R5 makes it
  systematic — every dilution event is retention-scoped by construction, so one
  event now shows two different effects on two screens. See §5.
GAP FOUND AND CLOSED: pricingEventSummary hard-coded the English "dilution"
  beside a Mode cell that IS translated. It now takes `t`.
TWO OF MY OWN ANCHORS WENT STALE on that signature change and were re-aimed in
  the same commit; one is now a COUNT so an argument change cannot break it.
RIDER (item 7) SHED, DELIBERATELY: WhatIfTab's pricing pass is inside a useMemo
  and needs a mount. scenarioHelper's is reachable but is a DIFFERENT
  implementation, so driving it would measure the wrong path. R5's compounding
  limit stays OPEN rather than covered by a probe that models it. See §6.
A SPEC EXPECTATION WAS WRONG AND THE RUN CORRECTED IT — 3 month-sorts, not 2;
  the third is the pricing apply pass. Recorded rather than quietly amended.
events-summary 37/37 (new), pricing-roundtrip 47/47, guard-traps 71/71, mix-card
  99/99, event 69/69, yield 35/35, lint and build clean, i18n parity verified.
```

---

## Base check

`git rev-parse --short HEAD` → **`0269fb6`**; the brief names `b3795f3`. One
commit apart, `--stat` confirms only `reports/` — the predecessor's Repo-line
fill, the established pattern. Flagged, proceeded.

## Decisions recorded

Three, in `test-data/EXPECTED.md`, before any code: pipeline order (with the
reason a creation-order list *cannot* be built); the existing card lists are not
touched; describe-never-re-derive.

## What shipped

### 1. Four summarisers, one per kind

`volumeEventSummary`, `promoEventSummary`, `yieldEventSummary` and the existing
`pricingEventSummary` — all exported, all reading the event's **stored** fields.

**They describe; they do not re-derive.** The one place a figure has to be
combined is the yield blend, and that goes through **`blendTierMixOrNull`**, the
same function the card and the engine use, against the stored `tariffBaseArpu`
— which is already the *effective* snapshot, so no override rule is
re-implemented either. Absence stays absence: a mix whose blend is unknown says
so rather than printing `0.00`.

That discipline is the point of decision 3. `scenarioHelper` is already a
parallel apply path duplicating yield and pricing logic; a summary table that
recomputed what an event does would be the **third** description, and three
descriptions disagree faster than two.

**Each takes `t`.** A summariser holding its own English would be a second copy
of the card's vocabulary, drifting silently and untranslated in five locales.

### 2. A gap in R5's own summariser, found by needing it twice

`pricingEventSummary` **hard-coded the English word "dilution"**. On the pricing
card that string renders beside a Mode cell that *is* translated — so five
locales showed one translated label and one English word on the same row.

It now takes `t` and reads `whatif_summary_dilution`. Worth recording as the
brief's "extend only if a gap is found, report it": the gap was invisible while
the function had one caller, and appeared the moment a second surface needed the
same words. Reuse is a defect-finding instrument, not just an economy.

### 3. The panel

Between the visual and the cards, **collapsed by default**, header showing
`Events summary` and a count across all three arrays. Expanded, it is capped at
`max-h-[320px]` and scrolls — it is a reference, not the working surface, and
must never push the cards down the page.

Columns: **Card** (Volume / Value / Pricing / Promotion — the recognisability
anchor), **Name**, **Adjusts**, **Scope**, **When**.

- **Name** prefers `campaignName`, falls back to `name`, then to a per-kind
  italic fallback. The fallback is *flagged* (`unnamed: true`) rather than
  inferred from the string, so the italic styling cannot be fooled by a user who
  literally types "Unnamed pricing event".
- **Scope** omits wildcards; an all-wildcard event reads `All` rather than
  leaving an empty cell that looks like missing data.
- **When** carries what each carrier actually has — `rollForward` for yield,
  `recurring` for pricing, and the month alone for market events, whose carrier
  has no duration concept at all. Absence rendered, not left ambiguous.

Empty state is its own copy, not a blank panel. Partial state shows only the
kinds that have events — no placeholder rows for absent carriers.

### 4. Pipeline order, and the check that proves it

Kind in pass order (market → yield → pricing), month ascending within kind, and
**the panel states the order in words** rather than leaving a reader to infer
chronology from the row sequence.

**The decisive spec check is a sequence, not a set:** the constructed yield
event is `2026-01` — earlier than every market event — and must still sort
**below** them. A chronological sort would put it first. That single assertion
is what separates pipeline order from a timeline, and it is exactly what
guard-trap 73 breaks.

The four existing card lists are untouched, per decision 2, and the spec pins
that they still carry their differing sorts.

## 5. FINDING — the two apply paths disagree about scope

**`scenarioHelper` ignores `target` and `cohortScope` entirely.** Its pricing
pass reads only `Input_Mode`, `Amount` and `Duration` from the raw row, then:

```js
if (pe.Input_Mode === 'percentage') finalArpu *= (1 + amount / 100);
else finalArpu += amount;
```

— applied to the **whole blended ARPU**. A repo-wide search for `Cohort_Scope`,
`cohortScope`, `Target` or `pe.target` in that file returns **nothing**.
`WhatIfTab` honours both (7 references to `pe.cohortScope`, 5 to `pe.target`).

**This is pre-existing** — any pricing event narrower than "everything" already
diverged between the What-If tab and Scenario Compare. **R5 makes it
systematic**, because a dilution event is retention-scoped *by construction*:
every one of them will move only the retention share on one screen and all of
ARPU on the other.

Not fixed here — it is neither R4's scope nor a change to make without deciding
which path is right. Recorded because the R5 capability just shipped into it.

## 6. The rider (item 7) — shed, and why that is the honest call

The brief asked for a numeric compounding check on the pricing pass, *"or state
so and record the limit as still open rather than forcing a modelled probe"*.

**WhatIfTab's pricing pass is not reachable without a mount** — it lives inside
a `useMemo` in the component, and the running `pricingARPU` that produces
compounding is a local inside it.

**`scenarioHelper`'s pass IS reachable**, via the exported
`computeScenarioForFilter`. But it is a *different implementation*: no
`pricingARPU` at all, a different variable, different structure, and — per §5 —
different semantics. Driving it and reporting "compounding is covered" would
measure the wrong path and say the right-sounding thing about it. That is the
probe-that-models-the-path trap the brief names.

**So R5's compounding limit stays open**, recorded here and unchanged. What this
session found instead — §5 — is worth more than the check would have been.

## 7. Two stale anchors, both mine, re-aimed in the same commit

Giving `pricingEventSummary` a `t` parameter broke **two** checks in
`spec:pricing-roundtrip`:

1. the summary assertions, which called it with one argument — they went red on
   the signature, which is the anchor rule working. Re-aimed, and their `t` is
   now built from the **real `en` locale**, so a missing or renamed key fails in
   the spec instead of reaching the screen as a raw key;
2. a wiring check pinning the literal `pricingEventSummary(pe)`. Re-aimed to a
   **count** of `pricingEventSummary(` call sites — argument-change-proof, and
   strictly stronger, since a second inline description appearing beside it now
   fails too.

Same species as the trap-64 lesson from the R3 surface session: a signature
change is not a wiring loss, and an anchor that cannot tell them apart will cry
wolf and then, later, miss.

## 8. A wrong expectation, corrected by the run

The spec first asserted **2** month-sorts in `WhatIfTab`. The run said **3**.
The third is the **pricing apply pass** (`:1187`), alongside the pricing list
(`:4623`) and the yield list (`:5869`).

The code was right and my expectation was wrong. Corrected to 3 with the three
sites named in the spec, and recorded here rather than quietly amended — a
number changed to make a check pass, with no note of why, is indistinguishable
later from a check that was always weak.

## 9. Guard-traps 72 and 73

- **72 — a carrier vanishes from the projection.** The yield card keeps working
  and its own list keeps rendering, so nothing on the cards looks wrong; the
  combined view simply stops being combined, which is the one thing only the
  table can be wrong about. Caught by the per-carrier **count** check, not by
  "all four cards present" — that weaker form would pass if any one row of the
  kind survived.
- **73 — the combined set sorts chronologically across kinds.** The subtle one:
  it looks like a timeline, reads like a timeline, and is a lie.

Both anchors verified unique before planting.

## Gate

```
events-summary spec:     37 passed, 0 failed   (new)
pricing-roundtrip spec:  47 passed, 0 failed   (re-aimed, +1 check)
mix-card spec (mounted): 99/99 passed          (untouched — no regression)
event-roundtrip spec:    69 passed, 0 failed
yield-roundtrip spec:    35 passed, 0 failed
guard-traps:             71/71 caught          (72 and 73 caught first run)
lint (tsc --noEmit):     clean
build:                   clean, 6.15s
i18n:                    22 keys x 6 locales, present, non-empty, every
                         placeholder preserved in every locale
```

## Where things stand

**R4 is complete as scoped**, minus the rider, which was shed with a reason
rather than for budget. Nothing else was shed: three-carrier coverage, pipeline
ordering, describe-not-re-derive, the report and the gate all landed.

**`pricingEventSummary` is now shared by two surfaces** — the pricing card's
row and the summary table — which is what the R5 report predicted it would be
needed for, and what surfaced its i18n gap.

**Open, unchanged:** `spec:yield-roundtrip`'s `toRow` is still a copy;
`yieldArpuMode` is still not restored on reopen; R5's compounding limit (§6).
**Newly recorded:** the scope divergence between the two apply paths (§5).

## Limits of this check

**The panel is not mounted.** The projection, the summarisers, the ordering, the
name fallbacks, the absence rendering and the wiring are machine-checked at the
function level and by source assertions; the rendered panel — the collapse
toggle, the cap, the sticky header — is **source-read**. `mix-card-spec` mounts
`WhatIfTab` and could in principle reach this panel, but it opens the Promotion
card and drives the mix arm; extending it to assert on a sibling panel was not
attempted this session. Stated rather than implied.

The i18n copy is machine-checked for **existence and interpolation**, not for
translation quality. Three keys are byte-identical to English in some locales
and are correct: `whatif_summary_volume` is `"{{scenario}} {{amount}}"` — pure
interpolation with no words in it — and "Promotion" (de, fr) and "Name" (de) are
true cognates. Flagged because an automated untranslated-string sweep will keep
reporting them, and the next reader should not "fix" them into something wrong.

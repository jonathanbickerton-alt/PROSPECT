# The Value card reconciles to the chart

```
FOR ADVISOR
Generated: 2026-09-09 17:11 +0100 (UTC 2026-09-09 16:11)
Certifies: 6538350
Repo: committed 6538350, pushed (origin in sync)

BASE 41c8be7 + e32acc9 (reports/ ONLY; ZERO drift in gated paths).
RECORDED FIRST 3ac8a1c — D5-11, citing "SETTLED 2026-08-12 — option (c)"
  as UNCHANGED. NEITHER STOP FIRED, both checked and reported below.
1 DEFAULT BASIS was an INITIALISER (WIT:2218), not a decision — 2026-08-12
  is SILENT on it, so NO STOP; now 'forecast'. PREVIEW PATH already hands
  yieldEvents to the engine, so the draft is a SPLICE. NO STOP either.
2 BUILD all three: default :2218, yieldsForRun splice :3270, preview on the
  CHART's OWN columns :3335, caption :8878 + box :8887, 877 -> 881 x6.
  PINS UNMOVED: apply 12 (8+4), display 6, .enabled 5+1+0, TARIFF_SCOPE 10
  (9+1), eventScopeMatchesView 16 (11+4+1). RE-AIMED not loosened:
  eventScopeSeriesFor callers 2 -> 3, plus a NEW pin: engine calls still 6.
3 SPEC yield-roundtrip 56 -> 69, STRUCTURAL — that spec has no jsdom, so
  NO mounted assertions. A real gap, stated in full in Limits.
4 TRAPS 192/193/194 seen RED BY HAND, 1 site, restored to md5 7d941e1c;
  194 was GREEN until the spec was strengthened. Trap 108 re-anchored.
5 GATE serial: suite 61/61, guard-traps 190/190 CAUGHT (0 MISSED /
  INCONCLUSIVE / CRASHED), evt-toggle 153, mounted 189, yield 69, anchors
  202, survival 27, i18n 200, ai-hold 13, tsc + lint + build clean.
LOSS: git checkout -- DESTROYED the uncommitted build; recovered VERBATIM
  from the transcript, tsc + 69/69 green. Limits carries it whole.
```

## 1. Diagnose

**Both STOP conditions were checked before any code, and neither fired.**

**The default basis is an initialiser.** `WhatIfTab.tsx:2218`, one `useState`
with no decision behind it. The 2026-08-12 entry settles *the comparator* —
"option (c)", equal-weight, with share-weighting queued as option (b) — and is
**silent on which basis the card opens in**. No other entry fixes Historical.
So item (1) proceeds. (There is a second, separate initialiser at `:2476`,
`promoYieldArpuMode`, for the Promotion card; it is untouched.)

**The preview needs no second engine.** `eventScopeSeriesFor` (`:3222`) already
passes `yieldEvents` straight to `computeAdjustedForecast`, and apply sites 2
(`:1476`) and 5 (`:1694`) read that list. A yield draft therefore reaches the
forecast by being *in the list*, which is a splice, not an engine. So item (2)
proceeds too.

## 2. Build

**(1) The default.** `:2218`, `'historical'` → `'forecast'`. Historical is
still selectable and still does exactly what it did.

**(2) The preview.** `eventScopeSeriesFor` gained two optional parameters,
`yieldDraft` and `excludeYieldId`. When neither is given the yield list is
`yieldEvents` **by identity** (`:3270`), so the Pricing card's two callers
behave byte-identically; when they are, the edited event is dropped and the
draft spliced in.

`yieldPreview` (`:3335`) reads the **chart's own columns** —
`Inflow ARPU (Baseline)` and `(Adjusted)` — never the card's blend. The month
is looked up **by key**, never by offset: an Inflow yield reaches the *next*
month's pool, so the preview reads the first month after the draft month; a
Retention yield reads the draft month itself.

**(3) The caption**, `:8878`, `data-testid="yield-ratio-caption"`. English:

> What reaches the forecast is the RATIO of these two figures, applied to the
> cohort's fitted ARPU — not the figures themselves.

de/es/fr/it/pt carry the same sentence; all four new keys are present in all
six locales (877 → 881 each, i18n-parity 200/200).

## 3. Spec

`scripts/yield-roundtrip-spec.ts`, **56 → 69**. It asserts the default is
forecast, that Historical survives, that the preview reads the chart columns
and **not** `baselineBlendedArpu`, that the draft is spliced in, that there is
**one** `eventScopeSeriesFor`, that the caption renders, and that the four keys
exist in six locales.

**It is structural.** That spec has no jsdom, so nothing here mounts the card.
See Limits.

## 4. Traps

Ids from `next free trap id`, which read **192** before and **195** after.

| id | the defect it plants | seen red |
|---|---|---|
| 192 | the basis default goes back to Historical | 1 site, spec 68/69 |
| 193 | the preview shows `baselineBlendedArpu`, the ratio's denominator | 1 site, spec 68/69 |
| 194 | the draft never joins the list — Adjusted always equals Baseline | 1 site, spec 68/69 |

Each was planted **by hand**, run, seen red, and restored from a pristine copy;
the file's md5 was `7d941e1c3f39d440a73f384251f3c89e` before each plant and
after each restore.

**194 was green when first planted**, because the spec asserted `yieldsForRun`
existed and was passed, and dropping only the `...(yieldDraft ? …)` term left
both of those true. The spec was strengthened to require the splice term
itself; the trap then went red. A trap nothing can catch is not a guard, and
this one earned its id by making the spec better rather than by being deleted.

**Trap 108 aged out on this session's own edit** and `spec:trap-anchors` caught
it: its three-line anchor was split when `yieldsForRun` was inserted between the
guard and the call. Re-anchored on the single line that names the resolved
slice, which is what the trap is actually about.

## 5. Gate

Run **serially**; guard-traps to a file in the scratchpad, never through a
pipe, one instance.

| check | result |
|---|---|
| suite | **61/61 green** |
| guard-traps | **190/190 CAUGHT** — 0 MISSED, 0 INCONCLUSIVE, 0 CRASHED |
| event-toggle | 153/153 |
| view-apply-mounted | 189/189 |
| yield-roundtrip | **69/69** (56 before) |
| trap-anchors | 202/202 — 190 traps, 197 anchors |
| survival | 27/27 |
| i18n-parity | 200/200 |
| ai-hold | 13/13 |
| tsc / lint / build | clean |

**One pin went red on this session's own change and was RE-AIMED, not
loosened.** `pricing-roundtrip` pinned `eventScopeSeriesFor` at exactly two
callers — the save path and the Pricing preview. The yield preview is a third,
which is the *outcome* that pin wants rather than a violation of it. The count
was raised to three with the third named, and a **new** pin added directly
beneath it: `computeAdjustedForecast` sites in `WhatIfTab.tsx` are still
**6** (1 definition + 5 calls). That is the invariant the caller count was
standing in for — "no second engine" — now asserted literally, so the next
caller to arrive cannot quietly bring an engine with it.
`pricing-roundtrip` 134 → **137**.

`src/components/WhatIfTab.tsx` was `7d941e1c3f39d440a73f384251f3c89e` before
guard-traps and the same after.

## Limits

- **I destroyed the uncommitted build and recovered it.** Restoring a planted
  trap with `git checkout -- src/components/WhatIfTab.tsx` reverted the file to
  HEAD, which did not contain the D5-11 work — none of it was committed yet.
  The four edits were recovered **verbatim** from this session's transcript and
  replayed, each matching exactly one site; the fifth change (the default flip)
  was re-applied by line number after confirming it must not touch the
  Promotion card's initialiser at `:2476`. `tsc` is clean and the spec is
  69/69, so the recovery is verified rather than assumed — but the file on disk
  is a reconstruction, and that is worth knowing. Every subsequent restore was
  from a pristine copy in the scratchpad, never from git.
- **No mounted assertions.** The brief asked for the preview to be tested
  mounted; `yield-roundtrip` has no jsdom, and moving the assertions to
  `view-apply-mounted` was not attempted inside this session's budget. What is
  pinned is the wiring, not the rendered box. Nothing asserts the *numbers* the
  user sees — which is the same gap the 1652 inventory recorded and this
  session did not close.
- **The preview's `reason` path is untested.** When the draft's slice has no
  forecast the box shows the seam's own words; no spec exercises it.
- **The report's figures are the spec's, not a user's.** Nothing in this
  session reproduced Alessandro's 13.32 → 24.17 against the new card.

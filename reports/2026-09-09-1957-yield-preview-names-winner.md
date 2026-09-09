# The Value card's preview names the winner

```
FOR ADVISOR
Generated: 2026-09-09 19:57 +0100 (UTC 2026-09-09 18:57)
Certifies: f252700
Repo: committed f252700, pushed (origin in sync)

BASE e5e1656 + 3 commits, reports/ ONLY, ZERO drift in gated paths.
  PREMISE 1936 re-checked: every line EXACT except sh:384 not sh:383.
RECORDED FIRST 99dfada — D5-13 in full: the tie rule UNCHANGED, (a)/(b)
  OPEN for after UAT with the 1936 costings, (c) DECLINED.
1 SEAM :3302 returns arpuIdsByMonth beside chartData — the engine's own
  appliedArpuIds; ONE run into a local, series = run.chartData untouched.
  yieldPreview filters to THIS run's yield ids (pricing shares the array)
  and FINDS first-win in the series, never computing it from the month.
  PRICING CALLERS read .series only: pricing-roundtrip 137/137 + mounted
  pricing assertions unchanged. Reused whatif_summary_unnamed_yield, no
  7th key; 881 -> 883 x6. PINS UNMOVED apply 12, display 6, .enabled
  5+1+0, TARIFF_SCOPE 10, engine 6, seriesFor 3; NOTHING re-aimed.
2 SPEC mounted 199 -> 208; fixture shaped like the 1930 file, the two
  RATIOS asserted to differ BEFORE any line is read. Rendered "2026-02:
  'first saved' applies instead · this event applies from 2026-03"; no
  rival -> no line; draft wins nowhere -> the superseded line.
3 TRAPS 197/198 seen RED BY HAND, 1 site, restored to md5 24403242.
4 GATE serial: suite 61/61, guard-traps 194/194 CAUGHT (0 MISSED /
  INCONCLUSIVE / CRASHED), evt-toggle 153, mounted 208, yield 76, pricing
  137, anchors 206, survival 27, i18n 200, ai-hold 13, applied 19, clean.
```

## 0. Premise re-checked

`reports/2026-09-09-1936-yield-tie-inventory.md` holds. Re-read at HEAD: the
seam's return at `:3302`, `yieldPreview` at `:3353`, site 2's filter/sort at
`:1452`/`:1461`, site 5's at `:1674`/`:1679`, Compare's sort at
`scenarioHelper.ts:393`, the preview box at `:8932`. **One correction:** the
1936 report cites Compare's roll-forward filter as `sh:383`; it is **`sh:384`**
(`:383` is the closing line of the scope predicate). Line numbers rot; this one
had a day.

## 1. Build

**The seam carries the winner.** `eventScopeSeriesFor` returned `.chartData`
alone and discarded, one line later, the very thing the card needed. It now
returns `arpuIdsByMonth` beside it:

```ts
const arpuIdsByMonth: Record<string, string[]> = {};
for (const m of run.adjustedMonths) arpuIdsByMonth[m.month] = m.appliedArpuIds ?? [];
return { series: run.chartData, reason: null, arpuIdsByMonth };
```

Three things about that, each pinned:

- **The engine runs ONCE**, into a local `run`. A second call for the ids would
  be a second engine, and could disagree with the series beside it.
- **`series` is `run.chartData`, unchanged.** That is what makes the widening
  safe for the Pricing card.
- **The ids are the engine's own `appliedArpuIds`, verbatim and unfiltered.**
  Deciding which id is *the yield winner* needs the yield list, which the
  **caller** built. A seam that guessed would be a second place deciding what
  won.

**The card derives the rival.** `yieldPreview` filters the month's ids to the
yield ids in this run — `appliedArpuIds` also carries pricing ids from sites 6
and 8, and a pricing event in the same month is not a rival for the single yield
slot. It then finds the draft's first winning month **in the series**, never by
arithmetic on the draft's month: a rolling draft wins from its month onward and
a plain one wins exactly once, and the engine has already decided which.

**The Pricing callers are untouched.** Both read `.series` and nothing else
(`:3328` destructures it, `:3670` takes `.series`). Evidence that they are
unaffected: `pricing-roundtrip` **137/137** and the mounted spec's existing
pricing-preview assertions unchanged and green, plus the structural pin that
`series` is that one run's own `chartData`. This is evidence from unchanged
assertions, **not** a differential run of the old and new code — stated plainly
because the two are not the same thing.

**One key reused, not added.** The unnamed-rival fallback uses the existing
`whatif_summary_unnamed_yield` ("Unnamed value event") rather than a seventh
key. Two new keys, 881 → **883** per locale, i18n-parity 200/200.

**The six strings:**

```
en  {{month}}: '{{name}}' applies instead · this event applies from {{first}}
    this event is superseded in every month
de  {{month}}: Stattdessen gilt „{{name}}“ · dieses Ereignis gilt ab {{first}}
    Dieses Ereignis wird in jedem Monat verdrängt
es  {{month}}: se aplica «{{name}}» en su lugar · este evento se aplica desde {{first}}
    Este evento queda desplazado en todos los meses
fr  {{month}} : c'est « {{name}} » qui s'applique · cet événement s'applique à partir de {{first}}
    Cet événement est supplanté tous les mois
it  {{month}}: si applica «{{name}}» · questo evento si applica da {{first}}
    Questo evento è sostituito in ogni mese
pt  {{month}}: aplica-se «{{name}}» · este evento aplica-se a partir de {{first}}
    Este evento é substituído em todos os meses
```

Testids: `yield-preview-rival` and `yield-preview-superseded`.

**Pins, all unmoved:** apply 12 (8 + 4), display 6, `.enabled` 5 + 1 + 0,
TARIFF_SCOPE_SITES 10 (9 + 1), `computeAdjustedForecast` sites **6**,
`eventScopeSeriesFor` callers **3**. **Nothing was re-aimed this session** —
the first in several, and the reason is that this change adds a field rather
than altering one.

## 2. Spec

`scripts/view-apply-mounted-spec.tsx`, **199 → 208**, mounted, because the
defect was an attribution: every figure the box showed was real and none of them
was the draft's.

**The fixture is shaped like the 1930 file** — a first-saved `All / All` Inflow
yield that does **not** roll forward, and a later cohort-scoped **rolling**
draft in the same month. On a three-month store:

| month | who is a candidate | winner |
|---|---|---|
| `MONTHS[1]` | both — months tie, insertion order decides | **the rival** |
| `MONTHS[2]` | the rival is no longer a candidate | **the draft** |

and an Inflow draft's box reads `MONTHS[1]`: the one month it loses.

**The fixture discriminates, asserted before any line is read.** The rival's
ratio and the draft's must differ, or the box would print the same two figures
whichever event won and every assertion below would pass without the winner ever
being consulted.

Rendered and asserted:

```
2026-02: 'first saved' applies instead · this event applies from 2026-03
```

Three cases: rival present → the line names it and the following month; rival
removed → **neither** line (a line on an uncontested draft is noise on every
save); draft made non-rolling too → it wins nowhere, so the **superseded** line,
and it names no month it never wins.

## 3. Traps

Ids from `next free trap id`, which read **197** before and **199** after.

| id | the defect it plants | seen red |
|---|---|---|
| 197 | the seam drops the per-month ids — the line never renders | 1 site, 204/208 |
| 198 | the winner is looked up at the draft's month, not the month read | 1 site, 204/208 |

197 restores the exact state the card was in when Jon reported it: the engine
still picks a winner, the seam just does not carry it, so every figure stays
correct and correctly attributed to nobody. 198 is the subtler one — all the
plumbing works, and the answer is about a month the box is not showing.

Each planted **by hand**, run, seen red, restored **from the scratchpad backup**
— never `git checkout` — with `WhatIfTab.tsx` at md5
`24403242fe4c7e0539b418890963d8e3` before each plant and after each restore.

## 4. Gate

Run **serially**; guard-traps to a file in the scratchpad, never through a
pipe, one instance.

| check | result |
|---|---|
| suite | **61/61 green** |
| guard-traps | **194/194 CAUGHT** — 0 MISSED, 0 INCONCLUSIVE, 0 CRASHED |
| event-toggle | 153/153 |
| view-apply-mounted | **208/208** (199 before) |
| yield-roundtrip | **76/76** (69 before) |
| pricing-roundtrip | 137/137 |
| trap-anchors | 206/206 — 194 traps, 201 anchors |
| survival | 27/27 |
| i18n-parity | 200/200 |
| ai-hold | 13/13 |
| applied-count | 19/19 |
| tsc / lint / build | clean |

**No pin moved and nothing was re-aimed** — the first session in several
where that is true.

`src/components/WhatIfTab.tsx` was `24403242fe4c7e0539b418890963d8e3` before
guard-traps and the same after.

## Limits

- **Byte-identity for the Pricing callers is argued, not measured.** What is
  shown is that their assertions are unchanged and green and that `series` is
  one run's own `chartData`. A differential run of the pre- and post-change seam
  would be stronger and was not done.
- **The mounted fixture is synthetic, not Jon's file.** It reproduces the 1930
  file's *shape* — first-saved non-rolling rival, later rolling draft, same
  month — on the spec's own three-month store. The real file's figures are in
  the 1936 report; nothing here re-measures them.
- **The draft's own mix is the card's default even mix**, so its ratio is 1.0 on
  this fixture. That is enough to discriminate against the rival's 0.7, and it
  means the spec does not exercise a draft whose figures are themselves
  interesting.
- **Nothing pins the tie rule itself.** D5-13 leaves it unchanged deliberately,
  and no spec in either engine asserts which of two matching yield events wins —
  so options (a) and (b) would still be changing unpinned behaviour when they
  are decided.

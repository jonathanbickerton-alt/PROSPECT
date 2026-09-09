# "Events in effect" counts the union

```
FOR ADVISOR
Generated: 2026-09-09 17:59 +0100 (UTC 2026-09-09 16:59)
Certifies: 9118678
Repo: committed 9118678, pushed (origin in sync)

BASE 6538350 + 7d36e70 (reports/ ONLY fill; stated). HARD RULE in force:
  restored ONLY from a scratchpad backup, never git. No loss this session.
0 D5-11 ON DISK: all five present at HEAD, matching 1711. NO divergence.
  MEASURED, Jon's 09 Sep save, SOHO/Mobile Voice: fitted Inflow ARPU Sep
  10.6252 / Oct 10.6529 — the chart's ~10.65 is OCT, where an Inflow yield
  lands; the card scales to the DRAFT month. No override -> 10.6252 EXACT;
  WITH the save's {Low Value:10} -> 12.9653 = Jon's 12.94. BY CONSTRUCTION
  (override REPLACES, R3; and Sep vs Oct). NOT fixed — NEEDS A CALL.
RECORDED FIRST 2373b94 — D5-12, superseding D5-09 (i), quoted in full.
1 BUILD unionHere :4934 + volumeCount/arpuCount; caption ALWAYS rendered,
  invitation only at on==0; switchedOnCount derived ONCE :2723. SWEEP
  whatif_effect_caption 1 reader -> RETIRED x6, add-events KEPT, 881 x6.
  PINS UNMOVED apply 12, display 6, .enabled 5+1+0, TARIFF_SCOPE 10,
  engine 6, seriesFor 3. RE-AIMED not loosened: applied-count 17->19,
  both D5-09 card pins (WHOLE caption, not includes), trap 126's anchor.
2 SPEC mounted 189 -> 199; the yield LANDING asserted via the ARPU KPI.
3 TRAPS 195/196 seen RED BY HAND, 1 site, restored to md5 a14f0ada.
4 GATE serial: suite 61/61, guard-traps 192/192 CAUGHT (0 MISSED /
  INCONCLUSIVE / CRASHED), evt-toggle 153, mounted 199, yield 69, anchors
  204, survival 27, i18n 200, ai-hold 13, applied 19, tsc+lint+build clean.
```

## 0. Verify D5-11, and measure

**All five D5-11 changes are on disk at HEAD and match the 1711 report.**
Default `'forecast'` at `:2218` (the Promotion card's separate initialiser at
`:2476` still `'historical'`, as intended); the two optional parameters and the
`yieldsForRun` splice at `:3270`; the preview reading
`Inflow/Retention ARPU (Baseline)/(Adjusted)` at `:3358-3369`; the caption at
`:8878`; the box at `:8887`. **No divergence.**

### Where 12.94 comes from

`baselineBlendedArpu` is the **equal-weight mean of `effectiveTierArpuMap`** —
the *effective* rates, meaning override-if-present over the derived ones. On
**Forecast** basis `computeTierData` (`:333-347`) scales the derived rates by
`fcArpu / histBlended`, where

```ts
fcArpu = fcMonth.inflowArpu?.mean ?? fcMonth.arpu.mean   // ibro === 'Inflow'
```

read at **the draft month**. The scaling is *defined* to make the equal-weight
blend of the scaled rates equal `fcArpu` — so with no override the card's
Baseline figure **is** the fitted Inflow ARPU, exactly.

**Measured on Jon's own file** (`PROSPECT Forecast Save — 09 Sep 2026 1425.xlsx`),
cohort SOHO / Mobile Voice, aggregated through the app's own `deriveAggregate`
over its 10 leaves:

| month | fitted Inflow ARPU |
|---|---|
| 2026-08 | 10.5965 |
| **2026-09** (the draft month) | **10.6252** |
| **2026-10** (where an Inflow yield lands) | **10.6529** |

and, replicating `computeTierData`'s bucketing on the Actuals sheet:

| | value axis | tariff axis (5 selected) |
|---|---|---|
| historical tier ARPUs | High 33.8662, Low 4.4356, Med 9.1476 | RED L 10.9313, M 8.2273, S 4.4356, ULTD 38.4514, XL 15.2579 |
| scaled, equal-weight blend | **10.6252** | **10.6252** |
| with the save's override `{Low Value: 10}` | **12.9653** | 10.6252 |

**12.9653 against Jon's 12.94.** The residual is my aggregate fitted mean
against his exact UI state; the construction is identified by the override's
signature — it moves the *value* axis and leaves the tariff axis untouched,
because "Low Value" is not a tariff. The save carries
`Tariff_Base_ARPU_Override_JSON: {"Low Value": 10}`.

### The verdict: by construction, in two places

1. **An override REPLACES rather than adjusts.** That is R3's stated ordering,
   and `effectiveTierArpu`'s own documentation says so in terms. But the scale
   factor was computed so the *derived* rates blend to the fitted mean;
   substituting one member for a stated rate breaks that identity. The card
   D5-11 reconciled to the chart is **un-reconciled by any stated rate**, and
   nothing on screen distinguishes the two cases.
2. **The months differ.** The card reads the draft month (Sep, 10.6252); the
   chart figure an Inflow yield moves is the month after (Oct, 10.6529). Small
   here — 0.03 — but structural, and it grows with the ARPU trend.

**Not fixed; not briefed.** Recorded for a decision. The D5-11 *preview* box is
unaffected — it reads the chart's own columns, so it already shows 10.65 → the
adjusted figure. What still disagrees is the **comparator pair** above it,
which D5-11's caption does explain ("what reaches the forecast is the RATIO of
these two figures"), but only for a reader who reads captions.

## 1. Build

**The union.** `impactSummary` (`:4934`) builds
`unionHere = new Set([...appliedHere, ...arpuAppliedHere])` from the two sets
the same walk already produced, and returns `eventCount: unionHere.size`
alongside `volumeCount` and `arpuCount`. No third pass, no new set.

**The caption.** One key, three params, **always rendered**. The invitation is
a separate line, shown only when `switchedOnCount === 0`.

**One read, not two.** The caption and the invitation ask the same question, so
`switchedOnCount` is derived once (`:2723`) from `summaryRows`' own `enabled`.
This is why the `.enabled` pin stayed at 1 rather than being raised to 2 — the
first draft had two `summaryRows.filter(...)` copies and `spec:event-toggle`
caught it. Two copies of one predicate is the shape that drifted for three
sessions; the pin did exactly its job.

### The sweep

| key | readers before | after |
|---|---|---|
| `whatif_effect_caption` | 1 (`WhatIfTab:5254`) | **0 — RETIRED in all six locales** |
| `whatif_add_events_below_to_adjust_the_forecast` | 1 | 1 (the `on === 0` branch) — **kept** |
| `whatif_events_in_effect` | 1 (the title) | 1 — untouched |

`whatif_effect_caption_full` replaces the retired key in place, so each locale
file shows **one changed line** and stays at **881 keys**.

**The six strings:**

```
en  {{v}} moving volume · {{a}} moving ARPU · {{on}} switched on
de  {{v}} bewegen Menge · {{a}} bewegen ARPU · {{on}} eingeschaltet
es  {{v}} mueven volumen · {{a}} mueven ARPU · {{on}} activados
fr  {{v}} agissent sur le volume · {{a}} agissent sur l'ARPU · {{on}} activés
it  {{v}} muovono volume · {{a}} muovono ARPU · {{on}} attivati
pt  {{v}} movem volume · {{a}} movem ARPU · {{on}} ativados
```

### Pins

**Unmoved:** apply 12 (8 + 4), display 6, `.enabled` 5 + 1 + 0,
TARIFF_SCOPE_SITES 10 (9 + 1), `eventScopeMatchesView` 16 (11 + 4 + 1),
`computeAdjustedForecast` sites 6, `eventScopeSeriesFor` callers 3.

**Re-aimed, never loosened** — three, all of which went red on this session's
own change:

- `applied-count` pinned the literal `eventCount: appliedHere.size`. Re-aimed
  to `unionHere.size` **and strengthened**: it now also pins that the union is
  built from the two already-walked sets, and that both halves travel. 17 → 19.
- The two D5-09 card pins asserted the number is the volume path alone — which
  D5-12 explicitly supersedes. Re-aimed to the union, and while moving, both
  captions are now asserted as **the whole rendered string** instead of
  `includes('3')`, which any caption containing a 3 would have satisfied.
- **Trap 126's anchor aged out** on my own edit (`appliedHere` → `unionHere`)
  and `spec:trap-anchors` caught it. Re-anchored; the mutation is unchanged.

## 2. Spec

`scripts/view-apply-mounted-spec.tsx`, **189 → 199**, mounted, because the
defect was entirely in what the card *said* — the engine was right throughout.

**The fixture discriminates before anything is read.** The block turns on the
yield event actually reaching `appliedArpuIds`; if it did not, every caption
would read "0 moving ARPU" and every check would pass for the wrong reason.
That is asserted through an **independent observable** — the rendered
per-scenario Inflow ARPU delta, which a landed pool at rate
`22 × (0.25·40 + 0.75·10)/25 = 15.40` must move and a dropped one cannot.

| case | number | caption |
|---|---|---|
| volume + yield, both on | **2** | `1 moving volume · 1 moving ARPU · 2 switched on` |
| yield only | **1** (was 0 — the UAT defect) | `0 moving volume · 1 moving ARPU · 1 switched on` |
| both off | **0** | `0 moving volume · 0 moving ARPU · 0 switched on`, **plus** the add-events line |

## 3. Traps

Ids from `next free trap id`, which read **195** before and **197** after.

| id | the defect it plants | seen red |
|---|---|---|
| 195 | the union drops the ARPU set — the card counts volume only | 1 site, 197/199 |
| 196 | the zero branch hides the caption, so the on-count vanishes at zero | 1 site, 198/199 |

Each planted **by hand**, run, seen red, restored **from the scratchpad
backup** — never `git checkout` — with `WhatIfTab.tsx` at md5
`a14f0ada1ef68329738290654663e767` before each plant and after each restore.

Trap 195's failure line reproduces the UAT report verbatim:
`the card reads 1, not 0  [0 — THE UAT DEFECT: 0 while the chart moved]`.

## 4. Gate

Run **serially**; guard-traps to a file in the scratchpad, never through a
pipe, one instance.

| check | result |
|---|---|
| suite | **61/61 green** |
| guard-traps | **192/192 CAUGHT** — 0 MISSED, 0 INCONCLUSIVE, 0 CRASHED |
| event-toggle | 153/153 |
| view-apply-mounted | **199/199** (189 before) |
| yield-roundtrip | 69/69 |
| trap-anchors | 204/204 — 192 traps, 199 anchors |
| survival | 27/27 |
| i18n-parity | 200/200 |
| ai-hold | 13/13 |
| applied-count | **19/19** (17 before) |
| tsc / lint / build | clean |

`src/components/WhatIfTab.tsx` was `a14f0ada1ef68329738290654663e767` before
guard-traps and the same after.

## Limits

- **The 12.94 measurement REPLICATES `computeTierData`, it does not call it.**
  That function is module-private and unexported; the scratchpad harness
  reproduces its bucketing and scaling arithmetic line for line against the
  same Actuals sheet. The aggregate side *is* measured through the app's own
  `deriveAggregate`. So the fitted figures are the app's; the tier blend is a
  faithful copy, and a divergence between copy and original is not visible here.
- **Jon's exact UI state is inferred, not observed.** 12.9653 against his 12.94
  is close enough to name the construction, but the override was read from the
  *saved event* (Segment All / Product All) while his reading was on
  SOHO / Mobile Voice. Card-level overrides persist across cohort changes,
  which is the mechanism — I did not reproduce his session to confirm it.
- **No spec covers the override case.** Nothing asserts what the card shows
  when a stated rate is in force on Forecast basis, which is exactly the state
  the 12.94 reading came from.

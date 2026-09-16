# REQ-D6-07 clause 12 build — the market-draft slot; the Promotion arm in cohort units

## FOR ADVISOR

```
Generated: 2026-09-16 11:50 +0100 (UTC 2026-09-16 10:50)
Certifies: fe0cb7eca4af8c859992d0f4d64db8dd33a278f6
Repo: committed fe0cb7e, pushed (origin in sync)
The seam has a market-draft slot; the Promotion arm leads with the cohort
ARPU at the promotion's own month, and its target is solved on the seam
by the ONE solveForCohortTarget, rows built by buildPromoEvents.
The four existing seam callers are byte-identical to 3510cc9 (4 literals).
SHED - clause 14 HELD, conflict for Jon: a Forecast basis default rewrites
a reopened promotion's baked rate on a no-change save (36 -> 35.6, D5-04's
recorded decision, view-apply red). The basis is not stored on the event.
BRIEF vs MEASUREMENT: (a) 13.88->13.88 holds only on Forecast; the 1008
literals (16.56/30.91/14.19/15.59) used all-row rates. Mount figures
16.91/33.13/14.23/15.86 reproduced engine-direct to 4dp with its inputs.
FIXED 1.5 (image 8): Forecast-basis rates were scaled to the LOADED
cohort; a SOHO draft showed 31.08 where SOHO's forecast gives 34.65.
FIXED: MixTargetPanel fell back to the BLEND band when a cohort band was
null (a 0706 defect) - blend numbers under a cohort label.
FIXED: ai-hold red at BASE - its exclusion named v3-3-16 exactly and the
0706 doc swap (mine) never updated it; masked by an untracked-file run.
Trap 249 RETIRED: its plant (a cohort DEFAULT label) is inert now both
cards pass labels; its premise was the blend label clause 12 removed.
guard-traps targeted 89/89 CAUGHT, rotation 20, NOT RUN 162 (line
verbatim in section 3), last FULL run e7c88aa 2026-09-15T22:19Z
full suite:  74/74 green
```

## 0. Base

`git status --short` — empty. `git diff 3510cc9 HEAD --stat -- src scripts` —
empty. Both quoted before any change; HEAD at the check was `a3f974f`, this
report's skeleton. BASE for the STOP diffs: `362f927`, src at `3510cc9`.

## 1. Item 0 — clauses 13-15

Committed alone as `fb1449f`, before any code, verbatim from the brief.

## 2. Item 1

### 1.1 The seam slot

`eventScopeSeriesFor` takes `marketDraft?: MarketEvent[] | null` and
`excludeMarketIds?: readonly string[] | null`. The splice sits directly under
the yield one and mirrors it line for line:

```ts
const yieldsForRun = (yieldDraft || excludeYieldId)
  ? [...(excludeYieldId ? yieldEvents.filter(y => y.id !== excludeYieldId) : yieldEvents),
     ...(yieldDraft ? [yieldDraft] : [])]
  : yieldEvents;
const marketsForRun = (marketDraft || excludeMarketIds)
  ? [...(excludeMarketIds ? marketEvents.filter(e => !excludeMarketIds.includes(e.id)) : marketEvents),
     ...(marketDraft ? marketDraft : [])]
  : marketEvents;
```

and the engine call passes `marketEvents: marketsForRun`. With no market draft,
the four earlier callers get the very same array.

**Byte-identical, asserted.** Section S of the new spec reads one literal per
caller. The literals were measured on the untouched tree
(`WhatIfTab.tsx` md5 `f514b965…`, i.e. `3510cc9`'s) before the slot existed, then
frozen into the spec:

| caller | literal |
|---|---|
| Pricing preview | `Baseline ARPU 13.88Adjusted ARPU 14.32+0.44 (+3.2%)` |
| Pricing save | `{"amount":5,"originalBaseArpu":13.880813,"pricedVol":26623.05,"totalVol":42240.5}` |
| Value card preview | `All Inflow ARPU, Nov 202613.87 → 13.87+0.00%at Nov 2026 only` |
| Value card cohort solve | `14.29 @ 35.3666,32.3167,32.3167` |

All four still match after the build.

### 1.2 The promo deliver

`promoRowsFor(mix)` → `buildPromoEvents` with the card's own draft, volume,
shape, hold, mode, mix arm and pricing arm (the same parameters as the three save
paths). `promoMeasure(mix)` hands those rows to the seam as `marketDraft`, with
the edited rows excluded (a campaign edit excludes the campaign's rows), and reads
`rawArpuByMonth[newPromo.date]` in the promotion's scenario — its OWN month,
clause 13. `promoDeliverForBlend(blend)` → `solveForTarget` → shares →
`promoMeasure`. The solve is the ONE `solveForCohortTarget`, with
`promoDeliverForBlend` injected. `yieldDeliverForBlend` is untouched.

### 1.3 The arm

- **Lead**: `promo-preview-baseline / -adjusted / -pct`, label
  `{cohort} {ibro} ARPU, {month}` (the Value card's key), and the caption
  `promo-lead-scope` "with this promotion's {n} subscribers at this mix", or
  "…, first month of {k}" for a campaign. Two new keys, six locales, de/it
  translated.
- **Target**: `MixTargetPanel` now gets `label` ("Target {ibro} ARPU at {month}"),
  `rangeOverride` (the cohort band, memoised on the draft, volume included),
  `onCommit`, `refusal` (clause 11's two), and `onApply = runPromoCohortSolve`.
  The early state holds the SOLVED blend for the drag and exactly-determined
  rules, as on the Value card.
- **One verdict for both cards**: the band/blocked/binding logic the 0706 build
  wrote inline for the Value card is now `cohortTargetVerdict`, a pure
  function. Both cards call it, so the two cannot drift on that rule. The Value
  card's literals are unchanged (its spec 36/36).
- **Demotion**: the promotion's blended ARPU moved, unreworded, into
  `promo-how-computed`, closed by default.
- **Basis default**: see What was shed — clause 14 is held.

**The panel's band fallback, fixed.** `MixTargetPanel` read
`rangeOverride ?? range`, so a cohort caller whose cohort band was null fell
back to the BLEND band and printed blend numbers under a cohort label. That was
latent on the Value card since 0706 (a month outside the forecast) and immediate
on the Promotion arm (no volume yet). It now honours `null` as "no band";
`undefined` is the only "not a cohort card".

### 1.4 Mounted

New spec `scripts/promo-cohort-target-mounted-spec.tsx`, **38/38**: section S
(4 callers), section P (a)-(i) plus a drag under the target, and section X
(structural).

The mount is value-cohort-target's harness, with trimmed fixture tier rates from
its 4,000-row slice. **Every literal below was reproduced by driving
`computeAdjustedForecast` directly with the mount's own inputs** (scratchpad
`d620-check` / `d621-spread` / `d622-ret`):

| case | card | engine-direct |
|---|---|---|
| (a) even mix, Historical basis | 13.88 → **15.03** | 13.8808 → 15.0299 |
| (a) even mix, Forecast basis (toggle) | 13.88 → **13.88**, blend 13.88 | — (equal-weight = fitted by construction) |
| (b) tilt 10/20/70, 3,000 | **16.91**, blend **33.13** | 16.9057, 33.1264 |
| (c) same mix, 300 | **14.23**; band 12.62–18.30 → 13.73–14.40 | 14.2331 |
| (d) type 15.00 | sliders moved, lead **15.00**, box `15.00`; after a drag **15.00** | — |
| (e) dilution −20% | **15.86** (< 16.91) | 15.8644 |
| (f) above the band | "…highest cohort ARPU … is 18.30, set by High Value." (not 41.99) | — |
| (g) Retention | "All Retention ARPU, Oct 2026 … 15.53"; label "Target Retention ARPU at Oct 2026" | 13.8808 → 15.5331 |
| (h) 3-month spread | "…1000.00 subscribers…, first month of 3", **14.31** = a single month at 1,000 | 14.3087 (unchanged by the later rows) |
| (i) Value card | lead and band 3.83 – 27.49 unchanged | — |

**The brief's literals and these differ, and the reason is measured.** The 1008
harness derived tier rates from ALL rows (High 39.81); this mount's card derives
them from its 4,000-row slice (High 41.99). Same mechanism, different rates.
(a)'s "13.88 → 13.88" is true only on the Forecast basis, where the rates'
equal-weight is scaled to the fitted figure. On Historical an even mix is a pool
priced at 21.19 and raises the cohort's ARPU. Both are asserted.

A first engine-direct run disagreed with (h) (14.09 vs 14.31). The cause was
my check, not the card: that variant drafted segment All under a Corporate view,
so the pro-rata share cut the volume to 0.485. Corrected to Corporate, it reads
14.3087.

### 1.5 Rates column

**Defect confirmed and fixed.** A Value-card draft for SOHO, with Corporate
loaded, on the Forecast basis (the card's default):

| | High / Low / Medium |
|---|---|
| shown before | 31.08 / 3.49 / 7.07 |
| SOHO's rates scaled to SOHO's forecast (fitted 15.4764) | 34.65 / 3.90 / 7.89 |
| SOHO's rates scaled to Corporate's forecast (fitted 13.8808) | 31.08 / 3.49 / 7.07 |

The tier derivation took `baseForecast`, which is the LOADED cohort's. Both tier
derivations (the Value card's and the Promotion arm's, the same line) now take
`draftScopeForecast(dims)`, which resolves the draft's own slice through the
shared `resolveEventScopeForecast`. If the slice has no forecast it returns null,
and the derivation keeps the historical rates rather than borrowing another
cohort's level. After: shown = 34.65 / 3.90 / 7.89. The case lives in
`value-cohort-target` (its resolver now answers SOHO keys with a SOHO forecast
built the same way); trap 256.

### 1.6 Re-aims and traps 252-256

Seen red first — the post-build suite was **66/73**:

| spec | the red, quoted | outcome |
|---|---|---|
| `value-cohort-target` | `FAIL (1.3) the Promotion arm keeps the BLEND label, byte for byte [Target Inflow ARPU at Sep 2026]` | **retired** with the reason at the line; replaced by "the arm now carries the cohort label" |
| `pricing-roundtrip` | `FAIL baseline: EXACTLY FOUR callers share it … [5 call sites, expected 4]` (+ the save pin) | 4 → **5**, `promoMeasure` named; engine pin unmoved at 6 |
| `mix-card` | `FAIL target: an unreachable target is FLAGGED`, `…binding constraint is NAMED`, `…Apply becomes enabled` | blend-unit leg retired, pointer to (d)/(f); now asserts no band and no blend fallback with no volume |
| `mix-card` | `FAIL pricing scope: the shared helper has EXACTLY three callers [found 4]` | 3 → **4**, `draftScopeForecast` named, same reasoning the pin already records |
| `value-padlock` | `FAIL (h) THE PROMOTION ARM ALSO HOLDS THE TARGET UNDER A DRAG [20.040250 vs 23.93]` | blend drag retired here; the claim moved to promo-cohort-target (d), "a drag under the target keeps the lead on it" |
| `trap-anchors` | `FAIL trap 108 … [ZERO — the anchor has aged out]`; `FAIL trap 192 … [2 occurrences]` | 108 re-anchored onto the `marketsForRun` line; 192 cleared itself when clause 14 was held |
| `view-apply-mounted` | `FAIL D5-04: a no-change edit-and-save leaves the 23-field read-set IDENTICAL [arpu]`, `…BAKED RATE survives [36 -> 35.6]` | **not re-aimed** — this red is clause 14's conflict with D5-04; clause 14 held |
| `ai-hold` | `FAIL (d) the three AI identifiers appear in ZERO tracked files [docs/…-v3-3-18.md :: @google/genai …]` | **a real defect at BASE**, fixed: exclusion by name pattern |

| trap | plants | spec |
|---|---|---|
| 252 | the promotion deliver ignores the draft volume | promo-cohort-target |
| 253 | the promotion band readout reverts to the blend band | promo-cohort-target |
| 254 | a second, local row builder in the preview (structural) | promo-cohort-target |
| 255 | the market-draft splice dropped (the 1008 symptom) | promo-cohort-target |
| 256 | Value-card rates scaled to the loaded cohort | value-cohort-target |

The new spec is registered in `CONTROL_SPEC_MAP` with its first trap, 252.

**Not trapped separately:** "a second solver". Section X pins
`solveForCohortTarget` at exactly one definition, but 254 plants only the row
builder. One trap id was given for both, and a compiling second-solver plant
would be a second trap.

## 3. Gate

| step | result |
|---|---|
| `npm run suite` | **74/74 green** (73 + the new spec) |
| `npm run guard-traps -- --targeted` | **89/89 CAUGHT**, 0 missed / inconclusive / crashed (second run; line below) |
| `spec:trap-anchors` | 267 passed, 0 failed (252 traps, 262 anchors) |
| `spec:i18n-parity` | 200 passed, 0 failed — **930 keys per locale**, all six |
| `spec:i18n-scan` | PASS |
| `spec:survival` | 27 passed, 0 failed; **104 first-row dereferences across 26 files** |
| `tsc --noEmit` | clean |
| `npm run lint` | clean |
| `npm run build` | built in 5.94s |

The certification line, verbatim:

```
guard-traps targeted 89/89 CAUGHT (ids 56 57 58 63 64 65 67 68 69 70 71 72 73 74 75 76 77 78 79 80 81 87 88 89 90 94 102 145 146 147 148 103 104 105 106 107 108 109 110 111 112 113 120 132 133 138 140 141 142 143 172 173 192 193 194 197 227 244 245 246 247 248 250 251 252 253 254 255 256), rotation 20 (ids 84 85 86 91 92 93 95 96 98 99 100 101 114 115 116 117 118 119 121 122), NOT RUN 162, last FULL run e7c88aa 2026-09-15T22:19:55.696Z
```

**guard-traps left the tree clean**: the five mutated source files' md5s are
identical before and after the run (`WhatIfTab.tsx` `ac38beb1…`,
`MixTargetPanel.tsx` `c4b41fb7…`, `mixConstraint.ts` `f7f32f18…`,
`forecasting.ts` `201ea2f9…`, `EventsSummaryTable.tsx` `e4607e87…`).

**The first targeted run was 89/90.** Trap **249** was MISSED, and it is
**retired**, not re-pointed. It planted a cohort label as `MixTargetPanel`'s
DEFAULT, to guard "the Promotion arm keeps its blend label" — the 0706 1.3
claim. Clause 12 removed that claim deliberately, and both cards now pass their
own `label`, so the default reaches no caller. Planted, it changed nothing on
screen. There is nothing left for it to discriminate, so the id is retired with
the reason at its old place in the registry and the number is not reused. The
second run is the 89/89 above.

**Retirements, stated together:** trap 249; the 1.3 byte-identical literal in
`value-cohort-target`; `mix-card`'s blend-unit target leg; `value-padlock`'s
blend drag in (h). In each case the claim was clause 12's to remove, and where a
cohort-unit version of the claim exists it now lives in `promo-cohort-target`.

The ledger (`scripts/guard-traps-ledger.json`) is committed in `fe0cb7e`, the
build commit, together with the run it records. This report follows in its own
commit.

| count | measured |
|---|---|
| `computeAdjustedForecast` sites | **6** (1 definition + 5 calls) |
| `eventScopeSeriesFor` callers | **5** — Pricing save, Pricing preview, yield preview, yield solve, `promoMeasure` |
| `solveForCohortTarget` definitions | **1** (mixConstraint.ts) |
| `buildPromoEvents` | **5** in WhatIfTab: 1 definition + 3 save paths (add, row edit, campaign edit) + `promoRowsFor`; none elsewhere in `src` |
| `resolveEventScopeForecast` callers (mix-card's pin) | **4** — `draftScopeForecast` added |
| the 0706 pins (runIngest 3, apply 12, display 6, ramp/hold 4, last column 4/2/3, handleDeleteCampaign 3) | held by their specs, all green in the 74/74 |

## What was shed

**Clause 14 (the Promotion arm's basis opens on Forecast) is HELD, not applied.
The conflict is Jon's to settle.**

Applying it turned `view-apply-mounted`'s D5-04 case red. A promotion saved on
the Historical basis, reopened and saved without changes, has its baked rate
rewritten, 36 → 35.6. The basis is not stored on the event (the same gap
`types/forecast.ts` records for the Value card's `yieldArpuMode`, "Finding 1"),
so reopening re-derives the tier rates on whatever basis the card opens on.
D5-04's recorded decision is that a no-change edit-and-save leaves the read-set,
arpu included, identical. Clause 14 as written breaks that for every promotion
saved before it.

Options, none taken:
- **(A)** Store the basis on the promotion event and restore it on reopen.
  Clause 14 then applies to new drafts only, and D5-04 holds.
- **(B)** Apply clause 14 and re-aim D5-04 to accept the re-derived rate.
- **(C)** Keep Historical.

Everything else in Item 1 is built. The arm works on either basis, and the
toggle stays. The Forecast-basis behaviour clause 14 wanted (even mix → fitted)
is measured and asserted through the toggle.

## Limits

- Mounted figures are this fixture's, from a 4,000-row slice, with every key
  resolving to one seeded forecast (SOHO excepted, for 1.5). The mechanism and
  directions carry over; the literals do not.
- A **percentage** promotion's caption prints its per-cent as "{n} subscribers";
  not handled.
- With no month or volume typed there is no lead, no band and no verdict. Enter
  on a target then gives the clause-11 "no fitted ARPU" refusal, which names
  the wrong cause for a draft that is merely unfinished.
- The cohort band costs two seam runs per draft change, and the solve up to 30.
  Measured on the Value card in 0647 (~8.9 ms per run); not re-measured for
  promotions, whose draft key includes volume and so recomputes on volume edits.
- `draftScopeForecast` changes the Promotion arm's Forecast-basis rates too (same
  line, same defect). The arm opens on Historical, so that is visible only after
  the toggle.

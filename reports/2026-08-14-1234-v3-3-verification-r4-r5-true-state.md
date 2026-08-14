# v3.3 verification, and true state for R4 (events summary) and R5 (retention dilution)

## FOR ADVISOR

```
Generated: 2026-08-14 12:34 +0100 (UTC 2026-08-14 11:34)
Verified against: b02f76a, branch main, tree clean (bar this report).
Repo: no source changed (read-only); this report committed c841e43, pushed
SKELETON CREATED AS THIS SESSION'S FIRST ACTION, before any check ran.
PART 1 — THE ARTEFACT DOES NOT EXIST. No v3.3 on this machine; newest is v3.2
  (2026-08-12), with ZERO mentions of the R3 symbols. I verified the brief's
  ENUMERATED CLAIMS against source instead — what authoring v3.3 needs.
PART 1 VERDICTS: 14 VERIFIED, 1 CONTRADICTED, 1 stale comment, 2 precision notes.
CONTRADICTED — "two-field shape, alongside the effective rates the event carries"
  is untrue of MarketEvent: NO per-band effective map, only promoMix + the SCALAR
  blend. YieldEvent does. The REASON transfers; the description does not.
STALE COMMENT (finding, not fixed): forecasting.ts:134 still says the field is
  "INERT ... nothing produces one yet". False since 4531acf.
PRECISION: 67 traps but ids run 1–69 (gaps at 28, 31); readOptionalNumber is
  module-PRIVATE, not exported.
PART 2 — THREE CARRIERS, NOT TWO: MarketEvent, YieldEvent AND PricingEvent, each
  its own array, sheet and hand-rolled table; all four lists sort DIFFERENTLY.
R4 DECISIVE FACT: `sequence` is MarketEvent-only and EXPLICITLY display/edit-slot
  only, NOT processing order (forecasting.ts:2109-2126). True order is a FIXED
  PIPELINE BY KIND; cross-carrier creation order does NOT exist to be shown.
R5 DECISIVE FACT: dilution is NOT derivable — Avg_Unit_Price_GBP is populated in
  4 of 7 fixtures but read by NOTHING (zero source references). Must be stated.
R5 TRAP: pricing events COMPOUND with each other (running pricingARPU), unlike
  market percentage events which are flat by construction. See §3.3.
DECISIONS: author v3.3 from these verdicts? fix the stale comment + wording?
```

---

## Base check

`git rev-parse --short HEAD` → **`b02f76a`** — `c7d4710` plus one report-only
commit (*"Fill the Certifies and Repo lines on the R3 orphans report"*),
exactly the state the brief expected. Tree clean bar this report.

---

# Part 1 — verification

## 1.0 The artefact is missing

**There is no working agreement v3.3 on this machine.** Searched the repo,
`~/Downloads` and `~/Desktop`. The newest is
`PROSPECT-development-history-and-working-agreement-v3-2.md`, **2026-08-12
22:00**, and it contains **zero** occurrences of `promoBandArpuOverride`,
`promoEffectiveArpuMap` or `promoOrphanedBands`. (The "67" matches in it are
incidental digits on lines 92–105, not a trap count.)

That is expected rather than alarming: v3.2 predates the entire 2026-08-13 R3
arc. But it means **Part 1 as briefed — "verify the §3 R3 block of v3.3" — has
no artefact to verify against.**

**What I did instead**, since it is the useful half and unblocks the advisor:
verified the brief's *enumerated claims* directly against source at HEAD. The
verdicts below are therefore about **the claims**, not about a document's
rendering of them — which is precisely what authoring v3.3 requires.

## 1.1 The R3 block

| # | Claim | Verdict | Evidence |
|---|---|---|---|
| 1 | `promoBandArpuOverride` on `MarketEvent` | **VERIFIED** | `forecasting.ts:138` |
| 1b | "…in the two-field shape, alongside the effective rates the event already carries" | **CONTRADICTED** | see below |
| 2 | `promoEffectiveArpuMap` module-level, called by the card **and** `buildPromoEvents` | **VERIFIED** | defined `WhatIfTab.tsx`; called at `promoEffectiveArpuMap(p.tierData, p.bandArpuOverride)` (write path) and `(promoTierData, draftPromoBandArpu)` (card) |
| 3 | `promoStatedRatesForMembers` returns `undefined`, never `{}` | **VERIFIED** | `if (!override) return undefined` and `Object.keys(out).length > 0 ? out : undefined` |
| 4 | `promoOrphanedBands` tests `share > 0` | **VERIFIED** | `Number.isFinite(s) && s > 0` |
| 5 | the drop uses `rebalance`, not `seedMixPreserving` | **VERIFIED** | `rebalance(promoMembers, next, promoMixLocked, anchor, …)`; `seedMixPreserving` named only in the explanatory comment |
| 6 | the input reuses `whatif_tier_arpu_default_from` | **VERIFIED** | `WhatIfTab.tsx:4978` |
| 7 | clear deletes the key | **VERIFIED** | `if (raw === '') delete next[tier];` at the promo site |

### 1b — the CONTRADICTED claim, stated precisely

`MarketEvent` carries exactly **two** `Record<string, number>` fields:
`promoMix` (the **shares**) and `promoBandArpuOverride` (the **stated** rates).
**There is no per-band effective-rate map on `MarketEvent`.** The event's own
comment says so: *"arpu/revenue already carry the resolved blend at creation
time"* — a **scalar**.

`YieldEvent` (`types/forecast.ts:398`) genuinely has the two-map shape:
`tariffMix`, `tariffBaseArpu` (effective) and `tariffBaseArpuOverride` (stated).

So R2's two-field shape is literal; **R3's is an analogy**. The *reason* for the
shape transfers intact — a stated rate is not recoverable from a blend, so
provenance dies if you store only one. The *description* does not: on the promo
carrier the override sits beside a scalar blend, not beside per-band effective
rates. A v3.3 sentence copied from the R2 block would be wrong.

### 1c — a stale comment (finding, not fixed)

`forecasting.ts:134-136` still reads:

> INERT AT THIS COMMIT — nothing produces one yet. The promotion card has no
> per-band input; that is R3's surface session.

**False since `4531acf`.** The input shipped, and the orphan work landed after
it. Left in place per the brief's *do not fix* instruction; flagged because
unlike a stale report, this comment sits in the file a reader consults to learn
what the field does, and it now denies a shipped capability.

## 1.2 Carrier conventions

| # | Claim | Verdict | Evidence |
|---|---|---|---|
| 8 | exactly **two** `readStoredEventModifiers` spreads | **VERIFIED** | `App.tsx:993`, `App.tsx:2024` — count is 2 |
| 9 | `marketEventExportRow` in `forecasting.ts`, driving `spec:event-roundtrip` | **VERIFIED** | defined `forecasting.ts:267`; `App.tsx:531` `.map(marketEventExportRow)`; spec line 87 `const toRow = (e) => marketEventExportRow(e)` |
| 10 | `spec:yield-roundtrip`'s `toRow` is **still a copy** | **VERIFIED (the record is right)** | `yield-roundtrip-spec.ts:36` is a hand-rolled object literal |

Claim 10 was flagged in the brief as *"expected TRUE — verify the record's
claim, not the hope"*. It is true: the yield spec still certifies its own copy.

## 1.3 Harness claims

| # | Claim | Verdict | Evidence |
|---|---|---|---|
| 11 | anchors built in LF, targets normalised | **VERIFIED** | `guard-traps.ts:94` `const nl = '\n'`, `:95` `toLF`, `:822` `const base = toLF(pristine)` |
| 12 | guard-traps count **67** | **VERIFIED, with a precision note** | 67 trap entries — but ids run **1–69**, with **gaps at 28 and 31** |

The id/count distinction matters for a context document: "67 traps" is correct,
"traps 1–67" would not be. Two ids were retired at some point and the ceiling
has moved past the count.

## 1.4 Drift control — three pre-R3 claims

| Claim | Verdict | Evidence |
|---|---|---|
| `readOptionalNumber` uses `''` as the absence carrier | **VERIFIED**, with a note | `raw === ''` → `undefined` (`forecasting.ts:223`). **It is module-PRIVATE — not exported.** Any claim that it is shared API is wrong |
| `blendTierMixOrNull` carries absence in its NAME | **VERIFIED** | `forecasting.ts:387` |
| `MIX_TOTAL = 100`, outcomes use **string** discriminants | **VERIFIED** | `mixConstraint.ts:42`; `kind: 'ok'` unions at `:120`, `:124`, `:129` |

No drift found in the pre-R3 sample.

---

# Part 2 — true state for R4 (events summary table)

## 2.1 THREE carriers, not two

The brief says *"BOTH carriers (MarketEvent and YieldEvent)"*. **There are
three.** Each has its own state array, its own export sheet and its own list UI:

| Carrier | State | Sheet | Card |
|---|---|---|---|
| `MarketEvent` (`forecasting.ts:6`) | `App.tsx:193` | `Market_Events` (sheet 3) | Volume card **and** Promotion card |
| `YieldEvent` (`types/forecast.ts:398`) | `App.tsx:1323` | `Yield_Events` (sheet 7) | Value / Yield card |
| `PricingEvent` (`types/forecast.ts:348`) | `App.tsx:1354` | `Pricing_Events` (sheet 8) | Pricing card |

The R2 diagnosis established the Market/Yield split for *tier overrides*; it did
not enumerate carriers. A combined table must cover three.

## 2.2 The event kinds a user can create

**On `MarketEvent` — two cards, one carrier, distinguished by `isPromotion`.**

- **Volume card** (`isPromotion` falsy). Identity: `name?`, **`campaignName`**,
  `comment`. Adjusts: `scenario` ∈ Inflow / Retention / Outflow / **ARPU**, by
  `subscriberVolume` (+ `customerVolume`, `revenue`, `arpu`), optionally
  `amountType: 'absolute' | 'percentage'` with `percentageBasis: 'baseline' |
  'adjusted'`, plus `arpuOverride?` and `retentionLinked?`. Scope:
  segment, product, productL2?, channel, channelL2?, tariffL1?, tariffL2?.
  Month: single `date` (yyyy-MM), one row per month — a spread is *N rows*.
- **Promotion card** (`isPromotion: true`). Same carrier and scope dims, plus
  the mix arm (`promoMixAxis`, `promoMix`, `promoBandArpuOverride`), the pricing
  arm (`promoPricingMode`, `promoPricingAmount`), `promoRebanded`, and
  `contractLength`. Identity: **`campaignName`** is the grouping key.

**On `YieldEvent` — Value / Yield card.** Identity: `name?`, `comment?` —
**no campaign name**. Adjusts: the tariff/value mix (`tariffMix`) against
`tariffBaseArpu`, with `tariffBaseArpuOverride?`. Scope: `ibro`
(Inflow | Retention), segment, product, channelL1, channelL2 — **no productL2,
no tariff dims**. Month: single `month`, plus **`rollForward`** (applies from
that month onward).

**On `PricingEvent` — Pricing card.** Identity: `name?`, `comment?` — **no
campaign name**. Adjusts: ARPU by `amount` under `inputMode: 'percentage' |
'absolute'`, aimed by `target: 'cohorts' | 'cohorts+base' | 'base-only'` and
`cohortScope: 'inflow' | 'retention' | 'both'`. Scope: segment, product,
productL2, channelL1, channelL2, tariffL1?, tariffL2?. Month: single `month`
plus `duration: 'one-off' | 'recurring'`. Also carries `originalBaseArpu`, a
display-only snapshot **recomputed on edit** (`WhatIfTab.tsx:2032`).

**Note the asymmetry a combined table must resolve:** only `MarketEvent` has
`campaignName`; only `YieldEvent` has `rollForward`; only `PricingEvent` has
`duration`; and the scope dimensions differ per carrier (yield has no
productL2 or tariff dims).

## 2.3 List rendering — four hand-rolled tables, four different sorts

**Verified, not assumed: there is no shared list or table componentry.**
`src/components/` contains no table/list component; all four lists are inline
`<table>` markup inside `WhatIfTab.tsx`, each with its own `<thead>`, its own
`colSpan`, its own empty-state i18n key — and its own ordering:

| Card | Line | Sort |
|---|---|---|
| Volume | `3747` | `.sort(bySequence)` — creation order |
| Pricing | `4403` | `.sort(month asc)` |
| Promotion | `5198` | **none** — raw array order |
| Value / Yield | `5633` | `.sort(month asc)` |

Empty-state keys are per-card (`whatif_no_pricing_events_yet_…`,
`whatif_no_promotions_added_yet`, `whatif_no_yield_events_yet_…`).

**The four lists already disagree about order.** Any combined table adopts one
rule and changes the apparent ordering of at least three existing surfaces.

## 2.4 Application order — the load-bearing fact

**Within `MarketEvent`:** `sequence` exists, with `nextSequence`,
`backfillSequences`, `resequenceRebuild` and `bySequence`
(`forecasting.ts:2780-2899`). **But it is not processing order.**
`forecasting.ts:2109-2126` is explicit:

> Percentage events are flat, not compounding… the maths here is
> order-independent BY CONSTRUCTION, and the `sequence` field exists for
> **display stability and edit-slot retention only**. Do not add a strict
> processing order… do not sort this array before calling.

**Across carriers:** a **fixed pipeline by kind**, documented at
`types/forecast.ts:345` — *"Order of operations: Yield Events (Pass 2) →
Pricing Events (Pass 3)"* — with market events applied first via
`applyEventsToMonth`. In `WhatIfTab.tsx` the passes run in that order: market
(`:794`), inflow yield (`:937`), retention yield (`:1106`), pricing (`:1174`).

**`YieldEvent` and `PricingEvent` carry no ordering field at all** — no
`sequence`, no timestamp. They resolve by **month**: yield picks the *most
recent applicable* (`.sort((a,b) => b.month.localeCompare(a.month))[0]`),
pricing applies *all* applicable in ascending month order.

**Therefore:** creation order across carriers is **not derivable** — there is no
shared timestamp and no interleaved index. A combined table **can** show true
application order, but only as the **pipeline order (kind, then month)**.
Showing creation order as if it were application order would be false, and for
market percentage events there is no meaningful application order to show.

## 2.5 Scenario Compare's parser, as sibling reference

`src/utils/scenarioHelper.ts` — `computeScenarioForFilter(parsedSession, …)`
destructures `{ baselineRows, marketEvents, yieldEvents, pricingEvents }` and
runs the same three passes (`:203` market via the shared `applyEventsToMonth`,
`:320` yield, `:428` pricing).

**It is a parallel implementation of the apply path**, sharing only
`applyEventsToMonth`, `eventProRataShare`, `eventCoverage` and
`resolvedEventVolume` with the live path in `WhatIfTab`. The yield and pricing
filtering/blending logic is duplicated between the two files. Worth knowing
before a cross-event projection is built on either.

---

# Part 3 — true state for R5 (retention dilution)

## 3.1 The pricing card's structure

Shape as enumerated in §2.2. The apply path (`WhatIfTab.tsx:1174-1245`):

1. filter by scope dims, then by duration — `one-off` requires
   `pe.month === m.month`, `recurring` requires `pe.month <= m.month`;
2. `.sort((a, b) => a.month.localeCompare(b.month))`;
3. `forEach`, with
   `applyDelta = arpu => inputMode === 'percentage' ? arpu * (1 + amount / 100) : arpu + amount`.

**How a percentage reaches Retention-scoped revenue:** `cohortScope` selects the
volumes — `retentionVol = pe.cohortScope !== 'inflow' ? m.uplifted.retention : 0`
— and the priced ARPU is volume-weighted back into the month's blended ARPU:

```
pricingARPU = (pricedVol * pricedARPU + (totalVol - pricedVol) * pricingARPU) / totalVol
```

`target` then decides the pool: `cohorts` (cohort volumes only), `base-only`
(the base pool, event pools keeping their own fixed ARPUs), `cohorts+base`.

## 3.2 Data support for a CURRENT dilution figure — VERDICT: NOT DERIVABLE

**The brief's premise needs correcting in two ways.**

`Avg_Unit_Price_GBP` is **not** "0.00 throughout ProductL2_Full" — it is **not a
column of the ProductL2_Full family at all**. It exists in four of seven
fixtures (both TariffHierarchy files, EdgeCases, and the Trimmed fixture) and is
**populated with plausible non-zero values** (sampled: 3.89, 8.07, 4.279,
3.6955, 8.877 across 4000 rows, zero nulls).

**But it is read by nothing.** A repo-wide search for `avg_unit_price`,
`unit_price`, `list_price`, `rack_rate`, `undiscounted`, `gross_revenue` and
`pre_discount` across `src/` returns **no hits**. The importer's auto-detection
(`App.tsx:1400-1415`) maps only:

- value/volume — `['subscriber','volume','subs','value','measure','amount','total']`
- revenue — `['revenue','gbp','monthly']`
- ARPU — `['arpu','average revenue','revenue per']`

`avg_unit_price_gbp` matches none of the ARPU patterns.

**Verdict: dilution is NOT derivable from any shipped data path.** The column
that could support it exists in some source files, reaches the app as an unused
column, and has no reader, no mapping and no UI. **A current dilution figure
must be user-stated** unless a new ingest path is built for it.

**Latent mis-mapping risk, recorded while here.** `match` iterates *patterns* in
order and takes the first column containing each. For revenue, `'revenue'` is
tried before `'gbp'`, so `Monthly_Revenue_GBP` wins in every shipped fixture.
**But a file carrying `Avg_Unit_Price_GBP` and no column containing "revenue"
would silently map unit price as the revenue column.** Not a live defect; a
sharp edge if ingest widens.

## 3.3 How a retained-revenue ratio would reach the engine

**Nearest existing mechanism:** a percentage `PricingEvent` with
`cohortScope: 'retention'`. A dilution ratio is expressible directly — a
retained-revenue ratio of 0.97 is `amount: -3`, `inputMode: 'percentage'` — so
arithmetically nothing blocks it.

**The one thing that would be violated is not what the brief anticipated.**
Nothing in the pricing path assumes the percentage is a *user-entered ARPU
delta*: `applyDelta` treats `amount` as an opaque scalar and never consults
provenance.

**The real hazard is compounding.** `let pricingARPU = blendedARPU`
(`WhatIfTab.tsx:1173`) is a **running** value: each event's
`applyDelta(pricingARPU)` reads the result of the previous one and writes back
(`:1200`, `:1209`, `:1214`, `:1222`). **Pricing events therefore COMPOUND with
each other** — two −3% events give −5.91%, not −6%.

That is the **opposite** of the market-event doctrine, where percentage events
are flat by construction and `sequence` is explicitly not load-bearing for the
numbers. The Volume card's own tooltip (`WhatIfTab.tsx:3318`) tells the user
*"Percentage events never compound with each other"* — true of market events,
and **not true of the pricing card the user sees beside it**.

So a computed dilution ratio riding a pricing event would compound with any
other pricing event in scope, and its result would depend on how many others
there are. Whether that is acceptable is a design question — flagged, not
answered.

## Decisions needed

1. **v3.3 does not exist.** Author it from these verdicts, or is there a copy
   the advisor holds that never reached this machine?
2. **The two-field-shape wording** for R3 — reword per §1b, or keep the analogy
   with the distinction stated?
3. **The stale `INERT AT THIS COMMIT` comment** (`forecasting.ts:134`) — a
   one-line fix, deliberately not made this session.
4. **R4 ordering:** confirm a combined table shows **pipeline order**, since
   creation order across carriers does not exist.
5. **R5:** confirm dilution is **user-stated**; and rule on whether a dilution
   ratio may ride a mechanism that compounds (§3.3).

## Limits of this check

Read-only: no source changed, nothing run, no gate. `Verified against:` names
the commit rather than certifying it. Part 1's verdicts are about the brief's
enumerated claims verified against source, **not** about a v3.3 document, which
does not exist. Fixture inspection covered header presence and a 4000-row sample
per file, not full-column validation. Nothing here was executed in a browser, so
all rendering claims are source-read.

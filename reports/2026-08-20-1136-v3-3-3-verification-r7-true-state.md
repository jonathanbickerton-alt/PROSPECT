# Working agreement v3.3.3 verified, and the true state for R7 (churn-targeted outflow)

## FOR ADVISOR

```
Generated: 2026-08-20 11:36 +0100 (UTC 2026-08-20 10:36)
Verified against: a767a30
Repo: committed 24cbc6e, pushed (origin in sync)
SKELETON CREATED AS THIS SESSION'S FIRST ACTION, before any check ran.
READ-ONLY on source — the only commits are the docs swap and this report.
BASE: HEAD 71e2a21 vs the report's e351d64 — one commit, --stat REPORT-ONLY.
PART 1: 36 claims checked, 36 VERIFIED, 0 CONTRADICTED. Six seams real, market
  reader carries SOURCE; placeholder guard at 9 App sites + worker, ZERO twins;
  both window ends clamped; 4 empty-states distinct. Drift control holds.
RETIREMENT NOT DONE — REPORTED per the escape hatch: deleting it would strand
  GUARD-TRAP 87 (`spec: EQUIV`). A clean re-home exists — see Decisions.
R7-2 DENOMINATOR ALREADY REACHABLE AND MEMOISED: eventScopeSeriesFor runs the
  pipeline on the draft's dims, event EXCLUDED. ADJUSTED-SO-FAR, the hard half.
R7-3 ZERO ENGINE CHANGE CONFIRMED: applyEventsToMonth does `outflow -= vol`
  with Outflow STORED NEGATIVE, so a REDUCTION is a POSITIVE stored volume.
R7-3 THE SIGN BITES IN ONE PLACE: marketEventFromRow(r,'workbook') forces
  -Math.abs(v) and would FLIP a stated reduction. 'session' does not.
R7-4 MarketEvent HAS NO recurring FIELD — "one row is one month"; the SPREAD
  already materialises N rows each with its OWN amount, so a per-month
  derived-delta series needs NO new storage and NO apply change.
R7-7 THE RAMP IS N EVENTS, NOT ONE ROW: storage and apply carry churn as-is.
  HARD BLOCKER NAMED — campaign group-edit reverse-engineers a ramp by summing
  |subscriberVolume|; on churn rows that SUCCEEDS and is wrong. Same barred
  class as percentage rows, and the bar belongs at the same rule site.
DECISIONS: 5 — the retirement re-home, three R7 scoping questions, the bar.
```

---

## Base check

`HEAD` at session start **`71e2a21`**; the render-and-phantom report's Repo line
names **`e351d64`**. One commit apart, and `git diff --stat e351d64..HEAD`
confirms **report-only** — one file, that report's own fill. Established drift
pattern, flagged and proceeded.

**Verified against `a767a30`** — the docs-swap commit made below, which is the
tree every claim in Part 1 and Part 2 was checked against. No source file was
modified in this session.

## Housekeeping

**Done: v3.3.3 in, v3.3.2 out, one commit (`a767a30`).** The repo never held two
working agreements and never held none.

**Not done, and reported rather than forced: the `spec:fromrow-equivalence`
retirement.** The brief's escape hatch — *if anything still references it, report
rather than force* — fires. Three references exist:

| reference | consequence of deleting |
|---|---|
| `package.json:57` | the npm script vanishes — harmless |
| `guard-traps.ts:72` `const EQUIV` and `:1108` positive control | mechanical |
| **`guard-traps.ts:1005` — trap 87 `spec: EQUIV`** | **the trap is stranded** |

Trap 87 removes the `...readStoredEventModifiers(r)` spread from inside
`marketEventFromRow`, and its whole point is that the modifier spread — carrying
the `isPromotion` string conversion — rides along with the extraction. Retiring
its only spec leaves the defect unguarded.

**A clean re-home exists.** `spec:compare-events-panel` drives
`buildPerFileEventPanels` → `marketEventFromRow`, and asserts *"ROUTING: the
Is_Promotion=Yes event takes the PROMOTION card"* plus the `'No'` counterpart.
Dropping the spread makes `isPromotion` `undefined`, both events take the Volume
card, and those checks go red. **Stated as a source reading, not a run** — one
guard-traps run settles it, and that run belongs to the session that does the
retirement.

---

# PART 1 — Verification of v3.3.3

Method: each claim reduced to a mechanical check against source at `a767a30`,
run in one pass. Comments stripped before any source-text check, per the lesson
trap 93 taught yesterday.

## §3, the Compare block — 22/22 VERIFIED

| claim | verdict | evidence |
|---|---|---|
| pricing pass calls `eventScopeMatchesView` | **VERIFIED** | 1 site in `scenarioHelper` |
| …`pricedVolumesFor` | **VERIFIED** | 1 site |
| …`applyPricingToBlend` | **VERIFIED** | 1 site |
| all three imported from the shared module, no local twin | **VERIFIED** | no local `function eventScopeMatchesView` |
| `Product_L2` present in the pricing scope filter | **VERIFIED** | 17 mentions |
| dilution needs no branch in the pass | **VERIFIED** | no dilution branch precedes the shared apply |
| `collectEventScopeDims` is the three-carrier populate | **VERIFIED** | exported; exactly 1 tab call site |
| toggle reads "Events Only" | **VERIFIED** | key + en value both |
| `buildPerFileEventPanels` extracted, spec drives the real function | **VERIFIED** | exported; spec imports it |
| tab calls it once and holds no parse of its own | **VERIFIED** | 1 site, no `marketEventFromRow(` |
| `windowBounds` clamps BOTH ends | **VERIFIED** | both `Math.min` guards present |
| offset resets on data-length change | **VERIFIED** | the `[chartData.length]` effect |
| the message discriminates the events-vocabulary case | **VERIFIED** | `selectionUncoveredByBaseline` + key |
| one shared placeholder guard | **VERIFIED** | `isPlaceholderSheet` exported |
| tests the SHAPE, not the message text | **VERIFIED** | `keys.length === 1 && keys[0] === 'Note'` |
| worker consults it before any seam | **VERIFIED** | `rowsOrEmpty` in `parseSheet` |
| App consults the same predicate at nine sites | **VERIFIED** | **exactly 9** |
| **no consumer-local twin anywhere** | **VERIFIED** | **zero `?.Note` in App, worker or tab** |
| named undrawable state exists | **VERIFIED** | `chartDrawability` + key |
| distinct from the other three, all four reachable | **VERIFIED** | all four `t(...)` present |

## §1, the seam inventory — 9/9 VERIFIED

All six seams exported and real: `marketEventFromRow`, `yieldEventFromRow`,
`pricingEventFromRow`, `marketEventExportRow`, `yieldEventExportRow`,
`pricingEventExportRow`. The market reader's signature carries
`source: MarketRowSource`. `spec:yield-roundtrip` imports **both** the real
writer and the real reader — Finding 2 closed, as claimed;
`spec:pricing-roundtrip` drives its real pair.

## Drift control — three earlier-arc claims

1. **`eventScopeMatchesView` is a single shared definition** (the one verified
   over 46,656 wildcard combinations) — **VERIFIED**, exactly one definition.
2. **Import-route counts: market TWO, yield ONE, pricing ONE** — **VERIFIED**,
   measured 2 / 1 / 1.
3. **`readOptionalNumber` is module-private** — **VERIFIED**, defined and never
   exported.

## Verdict summary

**36 VERIFIED · 0 CONTRADICTED · 0 NOT-CHECKABLE.**

Two honesty notes on that clean sheet. First, these are **structural** claims —
symbols exist, counts hold, wiring connects. The document's *behavioural* claims
(“walked green end to end”, “£14.34 on screen beside £14.47”) are Jon's walk and
are **not checkable from source**; they are not counted above rather than being
counted as verified. Second, an all-pass verification is the shape a vacuous one
has, so several checks were written as **exact counts** (nine guard sites, one
call site, zero twins, 2/1/1 routes) precisely because a presence check would
have passed on almost any tree.

---

# PART 2 — R7 true state (facts only, no design)

## 1. The Volume card's amount control

The toggle is at `WhatIfTab.tsx:3490-3517`: a two-arm control over
`newEvent.amountType`, `'absolute' | 'percentage'`, rendered as **Subs / %**.
Selecting an arm sets `amountType` **and zeroes `subscriberVolume` and
`revenue`** — because the number means a different thing under each mode, and
carrying it across would silently reinterpret 5,000 subscribers as 5,000 per
cent. Choosing `'percentage'` also force-clears `spreadEnabled`.

**The IBRO type is known at render time** from `newEvent.scenario`, the same
draft object — the label above the toggle already reads it
(`Change to ${newEvent.scenario ?? 'Inflow'}`). A conditionally-visible third
mode therefore needs no new plumbing to know whether Outflow is selected.

### The structural difference from the Pricing card's precedent

This matters more than it first looks, and it is the single most useful fact in
this section.

| | Volume card `amountType` | Pricing card `pricingMode` |
|---|---|---|
| values | `'absolute' \| 'percentage'` | `undefined \| 'dilution'` |
| stored on the event? | **YES** — `amountType` is a MarketEvent field the ENGINE reads | **YES**, but only as provenance |
| does the engine branch on it? | **YES** — percentage events resolve per cohort-month | **NO** — the amount is precomputed at save; the engine sees an ordinary percentage event |
| what selecting it does | sets the discriminant, clears the amount | sets `inputMode:'percentage'` + `cohortScope:'retention'`, clears the stale amount |

So the two toggles look alike and are not: **`amountType` selects an engine
behaviour; `pricingMode` selects a way of SAYING something the engine already
does.** R5's dilution rides the second pattern, which is why it needed no engine
branch — and §3's verified claim *"dilution needs NO branch"* is exactly that.

## 2. The denominator — already reachable, already memoised

**`eventScopeSeriesFor(draft, excludeId)`** (`WhatIfTab.tsx:2101`) runs
`computeAdjustedForecast` with the view scoped to **the draft's own dims** and
with **this event excluded**, returning `chartData`.

**Which series is that? Adjusted-so-far, in pipeline order** — every other
market, yield and pricing event applied, this one removed. That is the *harder*
of the two the brief asks about, and it already exists.

**The running base is reconstructed inside `computeAdjustedForecast`**
(`forecasting.ts:2507-2526`): a per-leaf `runningBase` map rolled forward as
`b = Math.max(0, b + prevIn - prevOut)`. So **previous month's base for a slice
is a lookup on a series the card can already obtain**, not a new computation.

**It is already memoised, and on the right key.** `previewScopeSeries`
(`:2134`) caches on **dims + month only** — deliberately excluding the typed
figures, so changing a number is cheap arithmetic against a cached series and
only changing slice or month costs a pipeline run. That is the
`eventScopeSeriesFor` precedent the brief names, and it applies unchanged.

**Seed-gating**: `seedBaseKnown` is computed across the scope's leaves
(`:2467-2479`) and is **false if ANY leaf lacks a known seed**;
`canShowBaseForecast(bf)` (`:2004`) is the single read. So the base series is
declinable per slice, by an existing predicate.

**Plainly, for the event's own slice at its month: it exists, it is
adjusted-so-far, and it is already cached.** No new machinery is needed for the
denominator.

## 3. The numerator and the reverse path

**"Current month's outflow" on that series** is `months[i].outflow.mean` —
`combineBandSlot` over the scope's leaves (`:2564`), the same aggregation the
base weighting uses.

**What an absolute outflow event stores today** (`addMarketEvent`, `:2296-2311`):
`subscriberVolume`, `customerVolume`, `revenue`, `arpu` — each passed through
`neg(...)` — plus `contractLength`, `sequence`, `amountType: 'absolute'`,
`percentageBasis`, `retentionLinked`.

**Zero engine change — CONFIRMED.** `applyEventsToMonth` (`:2976-2986`):

```ts
} else if (e.scenario === 'Outflow') {
  // subscriberVolume is stored negative for Outflow, so subtracting adds
  // its magnitude — more outflow, and less Base one month later.
  outflow -= vol;
}
```

A churn **increase** is a negative stored volume; a churn **reduction** is a
**positive** stored volume, giving `outflow -= (+delta)` — less outflow. **Both
directions already work through the existing mechanism**, exactly the R5 shape.

### Where the rate-sign rule bites — one place, named

**`marketEventFromRow(r, 'workbook')`** applies `neg = v => isOut ? -Math.abs(v) : v`
to `subscriberVolume`. A stated churn **reduction** (positive) read through the
**workbook** route would be forced negative and become a churn **increase** —
the event reversed, silently.

**The `'session'` route applies no sign transform**, so a save written by this
app round-trips a reduction correctly. The exposure is a hand-made workbook
import only. **Named, not fixed** — this is a true-state pass.

## 4. The recurring cliff — established

**`MarketEvent` has no `duration` field and no recurring concept.** The source
says so at `forecasting.ts:803`: *"MarketEvent has no duration or roll-forward
concept — one row is one month."* `duration: 'one-off' | 'recurring'` belongs to
**PricingEvent** (`:954`).

**The card's multi-month device is the SPREAD** (`buildPromoEvents`, `:403-410`):
it materialises **N separate events**, one per month, each carrying its own
amount as a `fraction` of the stated total, with consecutive `sequence` slots.

**The apply path applies each event's stored delta verbatim at its own month** —
`outflow -= vol`, no reference to any other month.

**Therefore a constant-churn-RATE recurring target cannot be one stored delta.**
The rate is applied to a base that moves: month 2's prevBase depends on month 1's
delta, so a single stored figure would drift from the intended rate immediately.

**What each option would touch:**

| approach | apply path | storage | derivation |
|---|---|---|---|
| **per-month derived-delta series** | **unchanged** — it already applies one delta per month per row | **unchanged** — the spread already stores per-row amounts | the card must roll the base forward itself, applying each derived delta before deriving the next |
| **engine-side churn mode** | **changed** — a new event kind resolved per cohort-month, like the percentage path | new discriminant + stated rate on the carrier | engine computes against the live prevBase, no card-side simulation |

The first needs **no new storage shape and no apply change**; only the derivation
differs from the spread's `fraction`. The second is the percentage-event pattern
extended. **The one-off/recurring choice is Alessandro's question and is not
touched here.**

## 5. Display provenance

**Computable event-scoped, by the same machinery as §2.** Both inputs — the
slice's outflow at the event's month, and its previous month's base — come from
the same `eventScopeSeriesFor` result, so the displayed current-churn figure and
the delta the event stores would read **one series**, not two.

**The figure can be legitimately ABSENT, and the condition is named**:
`seedBaseKnown === false` for the event's scope, i.e. **any leaf in the slice
lacking a known seed**. There is no base series to divide by, so no churn rate
exists to show — the em-dash-with-reason precedent applies exactly, and
`canShowBaseForecast` is the existing single read.

A second absence condition falls out of the arithmetic: **prevBase of zero**.
The first forecast month has no prior month inside the series, and a slice whose
base rolls to zero divides by zero. Both are absences with reasons, not errors.

## 6. The carrier, and the pins that must re-aim

**Fields, on the R-family pattern** (discriminant + stated + derived, presence as
carrier):

| field | why |
|---|---|
| `churnMode?: 'churn'` | the discriminant. Absent = an ordinary volume event — presence-as-carrier, as `promoMixAxis` and `pricingMode` are |
| `churnTargetPct?: number` | what the user STATED. `0` is a real target (no churn); `''`/absent is unset |
| `churnCurrentPct?: number` | the current rate at save — **stored, not recomputed**, per the R5 superseding decision that a row is its save-time record |
| `churnPrevBase?: number` | the denominator used, so the stored delta is reconstructible and auditable |

`subscriberVolume` continues to carry **the computed delta**, which is what makes
§3's zero-engine-change claim hold.

**The pins that must re-aim** (`scripts/event-roundtrip-spec.ts`):

- **`:274-277` — the export-column list**, currently eleven columns
  (`Is_Promotion` … `Promo_Band_ARPU_Override_JSON`). Each new field adds a
  column and this list must grow with it, or the writer can drop one silently.
- **`:302-304` — exactly TWO import routes, one per source.** Unchanged in count,
  but both routes must carry the new fields, and the workbook route is where §3's
  sign hazard lives.
- **`:309-311` — exactly ONE modifier spread inside the shared reader.** If the
  churn fields ride `readStoredEventModifiers`, this count is unchanged and they
  reach both routes for free; if they are hand-rolled per source, this pin will
  not notice and the promo-field defect repeats.
- **`:313-315` — App uses `map(marketEventExportRow)`**, unchanged.

**Also `spec:events-summary`**: a churn event needs a summariser sentence, and
the describe-never-re-derive rule means it must read the stored figures rather
than recompute the rate.

## 7. The ramp precedent — the shape churn would ride

### The stored shape: N events, not one event with month rows

**Two builders, the same output shape.** The Volume card ramps inline
(`WhatIfTab.tsx:2266-2320`); the Promotion card ramps through the shared
`buildPromoEvents` (`:403`). Both compute a share vector and `map` it:

```ts
const pcts = spreadDistType === 'even'
  ? Array.from({ length: spreadMonths }, () => 100 / spreadMonths)
  : customDist.slice(0, spreadMonths);
const total = pcts.reduce((s, p) => s + p, 0);
...
const events: MarketEvent[] = pcts.map((pct, i) => {
  const fraction = pct / total;
  const monthStr = format(addMonths(baseDate, i), 'yyyy-MM');
  const vol      = Math.round((newEvent.subscriberVolume || 0) * fraction);
  ...
  date: monthStr, subscriberVolume: neg(vol), sequence: nextSequence(...) + i,
});
```

**A ramp is N independent MarketEvents**, one per month, each carrying its own
`date`, its own absolute `subscriberVolume`, and a consecutive `sequence` slot.
There is no month-rows array and no parent row: after Add, nothing in the
stored data says these rows were ever one gesture except a **shared
`campaignName`**.

That matters for R7 in one direction only, and it is the good direction: the
**apply path** already does exactly what a per-month churn series needs — one
stored delta per month, applied verbatim at its own month, with no
cross-month reference. §4's conclusion is this fact seen from the other end.

### How the card edits per-month values — shares, never volumes

The editor (`:3846-3882`) is a three-column grid: month label, **derived**
volume, and — in `custom` mode only — an editable **percentage** input bound
to `customDist[i]`.

**The user never types a per-month volume.** They type shares; the volumes are
`Math.round(totalVol * pcts[i] / pctTotal)` and are display-only. Shares that
do not sum to 100 are accepted with a warning and **normalised on Add**.

So the ramp's mental model is *distribute a stated total*. That is the one
place churn does not fit the precedent as-is — see the structural notes below.

### What the summariser and the table show

`buildEventsSummaryRows` pushes **one row per market event** (`forecasting.ts:793`),
with no grouping. A three-month ramp is therefore **three rows** in the R4
events summary and in Scenario Compare's per-file panels — three months, three
volumes, one shared name.

The card's OWN list groups them: `campaignGroups` collapses rows sharing a
`campaignName` into a single editable campaign with a computed `span`
(`:509-511`).

### Structural reasons — one soft, one hard

**No blocker on storage or apply.** A churn-mode ramp would emit exactly what a
volume ramp emits: N rows, one per month, each an absolute delta. Nothing in
the carrier, the writer, the readers or `applyEventsToMonth` needs to change to
hold it.

**Soft: `map` must become a fold.** The share vector is knowable upfront, so the
builder is a pure `map`. A constant-churn-rate ramp is **sequentially
dependent** — month *i*'s delta needs the base rolled forward through months
*0..i-1*, which needs their deltas. Same output type, different body: an
accumulator instead of a `fraction`. §4 established the arithmetic; this names
where it would sit.

**Soft: the stated total inverts.** The ramp derives per-month volumes from a
stated TOTAL; a churn ramp derives them from a stated RATE, and the total
becomes an OUTPUT. That is the same inversion R5's dilution made on the Pricing
card — state the outcome, derive the amount — so the precedent for it exists
one card over. Two consequences fall out: the `even`/`custom` share control has
no meaning for a constant rate, and the "percentages sum to 100" normalisation
warning has nothing to normalise.

**HARD, and this is the one to name: campaign group-edit cannot reverse-engineer
a churn ramp.** `handleEditCampaignStart` (`:2397-2418`) reconstructs a ramp by
summing `Math.abs(subscriberVolume)` across the group's rows and redistributing
that total by offset. The codebase already bars **percentage** rows from this
path by RULE rather than by defensive handling (`:512-517`), with the reason
stated in source: the summation is *"arithmetic that is meaningless for a row
storing a percent rather than a quantity, and would produce a plausible, wrong
spread."*

A churn row stores a **quantity**, so the sum would not be meaningless — it
would be **worse**. It succeeds arithmetically and produces a total that is not
a churn statement, and re-spreading it by shares would not reproduce the rates
the user typed. **A plausible, wrong spread with nothing to make it look
wrong.** Churn rows therefore belong in the same barred class as percentage
rows, and the bar must be a rule at `:512`, not a guard downstream.

The same source comment carries a second lesson worth honouring here: the
homogeneity test below that bar deliberately does *not* also compare
`amountType`, because the branch above already catches every affected campaign —
and a mutation test proved the extra clause could be deleted with every
assertion still green. **An unreachable guard reads as protection while
providing none.** A churn bar should be placed where it can actually fire, and
a trap should prove it does.

### One more fact, stated because it is easy to trip over

Selecting `amountType: 'percentage'` **force-clears `spreadEnabled`**
(`:3508`), because the spread control is hidden for percentages and a spread
left enabled from an earlier draft would otherwise persist invisibly and still
apply on Add. A third mode inherits that question: whichever way churn goes, it
must state explicitly whether it clears the spread, keeps it, or redefines it —
silence there reproduces exactly the defect that comment records.

## Decisions for Jon

1. **The retirement re-home.** Point trap 87 at `spec:compare-events-panel`
   (which drives `marketEventFromRow` and asserts `isPromotion` routing both
   ways) and then delete `spec:fromrow-equivalence` — one small session with a
   guard-traps run to prove the re-home bites. Or leave the spec in place. Not
   taken here, per the brief.
2. **R7's mode: engine behaviour or a way of saying?** §1's table is the fork.
   The Pricing/dilution precedent (precompute at save, no engine branch) is
   available and is what makes §3's zero-engine-change finding usable — but it is
   the choice that determines whether §4's recurring answer is card-side or
   engine-side.
3. **Does R7 cover recurring at all in its first session?** §4 establishes that
   one-off needs no apply change and recurring needs either a card-side rollforward
   or an engine mode. Alessandro's question is on record; a first session could
   ship one-off with recurring explicitly held.
5. **Where does the churn bar on campaign group-edit go, and is it a rule or a
   guard?** §7 says rule, at `:512` beside the percentage bar, because that is
   the only place it can fire — and the source comment there records a mutation
   test proving an unreachable clause provides nothing. A trap should prove the
   bar bites.

4. **The workbook-route sign hazard (§3): fold into R7, or file separately?** It
   is a real defect for hand-made imports and is currently unreachable through
   normal save/reload. It touches `marketEventFromRow`'s workbook branch, which
   R7 will be editing anyway.

## Limits of this check

**Part 1 verified structure, not behaviour.** Every claim reduced to a symbol,
a count or a wiring connection at `a767a30`. The document's walk claims are
Jon's observation and are recorded as not-checkable rather than as verified.

**Part 2 read source; it ran nothing.** No churn figure was computed, no event
was saved, and no series was measured. The claims that
`eventScopeSeriesFor` returns adjusted-so-far and that `previewScopeSeries` is
memoised on dims+month are read from the function bodies and their dependency
arrays, which is strong for a memo key and weaker for the cost — **no timing was
taken**, and the 16.2 ms figure on record for a different per-slice computation
is a caution, not a measurement of this one.

**The trap-87 re-home is a source reading.** That the panel spec's routing checks
would go red under trap 87's mutation follows from `isPromotion` becoming
`undefined`, but no run confirms it. One guard-traps run settles it.

**No design was produced**, per the brief. §6's field list is the shape the
existing R-family conventions imply, not a decision that those fields are right.

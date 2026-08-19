# Scenario Compare — the events filter, populated from all three carriers

## FOR ADVISOR

```
Generated: 2026-08-19 08:43 +0100 (UTC 2026-08-19 07:43)
Certifies: 3337b46 (this report filled one commit later)
Repo: committed 3337b46, pushed (origin in sync)
SKELETON CREATED AS THIS SESSION'S FIRST ACTION, before the base check.
BASE: HEAD b5982ef vs the brief's 62923a3 — one commit, REPORT-ONLY.
HOUSEKEEPING NOT DONE, SECOND SESSION RUNNING — v3.3.2 absent everywhere.
  v3-3-1 deliberately NOT deleted: removing it without its successor would
  leave the repo with no working agreement at all.
NEVER-WORKED, and the populate read ONE carrier: `sourceRows = s.marketEvents`.
  Yield and pricing never contributed a scope value. Jon's Mobile Voice lived
  only on a pricing event, so it was unselectable.
A SECOND, WIDER INSTANCE OF THE SAME BUG: the "are there any events?" test was
  ALSO market-only, so a file carrying only pricing/yield events counted as
  having none and silently fell back to the BASELINE dimensions.
SHIPPED: collectEventScopeDims + hasAnyCarrierEvents, EXTRACTED from an inline
  useMemo — the untestable-in-place shape that let this ship. All three
  carriers, deduped, 'All' excluded as the clear state.
THE THREE SHEETS DISAGREE ON COLUMN NAMES: market writes `Channel`, yield and
  pricing write `Channel_L1`; yield has no Product_L2 and no tariff at all.
  Declared as DATA in one table, so the differences are visible in one place.
COPY CORRECTED: "Market Events Only" -> "Events Only", a NEW key so no locale
  silently carries the old sentence. Baseline (All) side untouched.
PART 2 (R6 true state, read-only): pricing has a full fromRow seam; MARKET AND
  YIELD HAVE NONE — inline parses in App, market partly via
  readStoredEventModifiers. Shapes and costs in §5; nothing extracted here.
GATE GREEN: guard-traps 84/84, all nine specs pass, lint and build clean.
```

---

## Base check

`git rev-parse --short HEAD` → **`b5982ef`**; the brief names `62923a3`. One
commit apart, report-only. Flagged, proceeded.

## Housekeeping — v3.3.2 still absent

`docs/` holds only `…-v3-3-1.md`; nothing matching `v3-3-2` / `v3.3.2` exists
under `~/Downloads` or `~/Desktop`. **Second session running.**

v3-3-1 was **not** deleted. The brief is explicit — *do not delete v3-3-1
without its successor present* — and the reason is worth restating: removing it
now would leave the repo with no working agreement at all, which is a worse
state than a stale one.

## Part 1 — the filter populate

### 1. What it read, and the classification

`ScenarioCompareTab`'s `dims` memo:

```js
const hasNoEvents = parsedSessions.every(s => s.marketEvents.length === 0);
const sourceRows = (dimSource === 'baseline' || hasNoEvents) ? s.baselineRows : s.marketEvents;
```

**One carrier.** Yield and pricing events never contributed a scope value, which
is exactly Jon's screenshot: All / Mobile Data / Fixed Connectivity — the two
market-scoped products — and no **Mobile Voice**, which exists only on a pricing
event.

**Classification: NEVER-WORKED.** `git log -S` on that expression returns only
`432837d`, the AI-capability removal that rewrote the file wholesale — there is
no commit in which the populate read anything but `marketEvents`. Not a
regression, so no commit to name.

### A second instance, wider than the reported one

`hasNoEvents` is **also** market-only. So a file carrying **only** pricing or
yield events counted as having *no events at all*, and the control silently fell
back to the **baseline** dimensions — a different list, presented as though it
were the events list, with no indication that a substitution had happened.

That was not in the brief and is arguably the worse half: the reported defect
omits values, this one swaps the whole source. Both are fixed by the same
change, and the spec pins each separately.

### 2. The fix — extracted, then widened

`collectEventScopeDims(sessions)` and `hasAnyCarrierEvents(sessions)` in
`viewFilter.ts`.

**Extracted first, for a stated reason.** The populate was an inline `useMemo`
inside the component — the shape that cannot be reached without a mount, and
therefore the shape in which a defect like this ships and stays. The brief's
untestable-in-place rule applies exactly here: the fix is only half the work,
and the other half is making the thing reachable.

**The three sheets disagree, and the collector owns that.** Market events write
`Channel`; yield and pricing write `Channel_L1`. Yield carries **no**
`Product_L2` and **no** tariff columns, because `YieldEvent` has neither. The
per-carrier column map is declared as **data in one table**, so adding a carrier
is one row and the differences between them are visible in one place instead of
being spread across three loops that look identical and are not.

**A dimension a carrier lacks contributes nothing** — absence, not an error, and
not an `undefined` leaking into an option list. The spec asserts that a product
from the yield sheet gets an **empty** L2 array rather than a broken one.

**`'All'` is excluded**, as before. It is the control's clear state, not a value;
offering it as an item as well would make one choice mean two things. Blank and
missing cells are treated identically.

### 3. The copy

`Market Events Only` → **`Events Only`**, six locales, under a **new key**
(`compare_events_only`) rather than by rewriting the old one — so no locale is
left carrying the previous sentence under a reused name while translations
catch up. The **Baseline Forecasts (All)** side is untouched, and the spec pins
that it still reads `baselineRows`.

### 4. The spec and the trap

`spec:compare-filter` — 24 checks against the real collector.

**Each carrier is given a scope value nobody else uses** (`Mobile Data` /
`Fixed Connectivity` / `Mobile Voice`), so dropping any one carrier makes
exactly one value vanish and the failing check names which. A shared value would
let two carriers cover for each other and the check would prove nothing.

The channel case doubles as the **column-mapping** check: the three fixtures use
each carrier's *real* column names, so reading one name for all three would lose
two of the three values.

**Guard-trap 86** points the pricing row of the carrier table at `marketEvents`,
so the pricing carrier silently drops out. The list still populates and still
looks complete — which is precisely how Jon met it — and only a check naming a
pricing-exclusive value can tell.

---

## Part 2 — R6 true state (read-only; nothing extracted)

### 5. What exists per carrier for row → typed event

| carrier | seam | coverage |
|---|---|---|
| **Pricing** | `pricingEventFromRow` (`forecasting.ts:891`) | **Full**, exported, spec-driven both directions with the export writer |
| **Market** | **none** | Parsed **inline** in `App.tsx` (~:975-1000). The modifier fields go through the shared `readStoredEventModifiers` (`:921`), but the base fields — id, scenario, dims, date, volumes, ARPU — are hand-rolled at the call site |
| **Yield** | **none** | Parsed **inline** in `App.tsx` (~:1011+), with `Tariff_Mix_JSON` / `Tariff_Base_ARPU_JSON` parsed locally and the override map through the shared rate reader |

So **one of three** carriers has the seam R6 would need. `readStoredEventModifiers`
is a *partial* market seam: it covers the promo and override modifiers — the
fields that caused the round-trip defects — and not the event's own identity or
scope.

**Shape and cost if R6 needs them** (not done here):

- `marketEventFromRow(r): MarketEvent` — mirror of the existing
  `marketEventExportRow`, absorbing the inline block and keeping the
  `...readStoredEventModifiers(r)` spread inside it. Modest: the fields are
  already enumerated in one place, and the export row exists to check against.
  **Two import routes** spread the modifiers today, so the pin the R3 carrier
  session placed (exactly two spreads) must move with it or be re-aimed.
- `yieldEventFromRow(r): YieldEvent` — same shape, plus the two JSON parses.
  Smaller, but `spec:yield-roundtrip`'s `toRow` is **still a copy**, so
  extracting the reader without also promoting that spec would leave the yield
  round trip certified against a copy on one side and a seam on the other.

### 6. Where a per-file typed parse would hang

`ParsedSession` (`workers/scenarioParser.worker.ts:8`) carries `fileName`,
`baselineRows`, and the three event arrays **as raw sheet rows**, plus
pre-extracted `segments` / `products` / `channels` string lists.

So a per-file typed-events parse hangs **in the worker**, at the point the
arrays are already isolated per file — or immediately after, in the tab. Nothing
about the current structure blocks it: the rows are there, per file, untyped.
The work is the seams above, not the plumbing.

### 7. The four summarisers against a `fromRow` parse

`volumeEventSummary(e: MarketEvent)`, `promoEventSummary(e: MarketEvent)`,
`yieldEventSummary(e: YieldEventLike)`, `pricingEventSummary(e: PricingEvent)`.

**One gap, and it is small.** `isPromotion` is the discriminator between the two
MarketEvent summarisers, and a raw row carries `Is_Promotion: 'Yes' | 'No'` —
a **string**, not a boolean. `readStoredEventModifiers` already converts it
(`row.Is_Promotion === 'Yes'`, `:940`), so a `marketEventFromRow` that spreads
that reader gets the discrimination for free. A parse that did **not** go through
it would produce a truthy `'No'` and route every market event to the promotion
summariser — the exact string-truthiness trap this codebase has recorded before.

Otherwise the summarisers read only fields a `fromRow` parse would populate, and
`YieldEventLike` is already declared structurally for precisely this reason.

---

## Gate

```
compare-filter spec:     24 passed, 0 failed   (new)
scenario-pricing spec:   16 passed, 0 failed
active-cohort spec:      23 passed, 0 failed
pricing-roundtrip spec:  116 passed, 0 failed
events-summary spec:     37 passed, 0 failed
mix-card spec (mounted): 99/99 passed
event-roundtrip spec:    69 passed, 0 failed
yield-roundtrip spec:    35 passed, 0 failed
import-seam spec:        36 passed, 0 failed
guard-traps:             84/84 caught, 0 missed, 0 inconclusive
lint (tsc --noEmit):     clean
build:                   clean (9.97s)
```

## Where things stand

**The filter now describes the events it claims to describe**, and a
pricing-only file no longer silently shows baseline dimensions instead.

**Recorded in EXPECTED.md**: the Scenario Compare arc (this filter fix, plus the
per-file events summary) runs **before DQ**, and **DQ is next-no-exceptions**
after it.

**Open:** R6's market and yield `fromRow` seams (§5, shapes and costs stated,
nothing extracted); the yield pass's private scope filter in `scenarioHelper`;
`spec:yield-roundtrip`'s `toRow` still a copy; `yieldArpuMode` still not
restored on reopen; full apply-path unification.

## Limits of this check

**Nothing is mounted.** The collector, the emptiness test and the wiring are
machine-checked; that the rendered dropdown *shows* the new options is
**source-read** — no check renders `ScenarioCompareTab`.

**The fixtures are constructed rows, not a real workbook.** They use each
carrier's real column names, taken from the three export writers, but no check
loads a saved file and reads its sheets. A column renamed in an exporter without
its collector row being updated would pass here — the same class of coupling the
export/import seams close for the carriers that have them, and one more reason
§5's missing seams matter.

**Part 2 is read-only and was not exercised.** Every claim in §5-§7 is a source
reading with symbols and line numbers; no `fromRow` was written or run.

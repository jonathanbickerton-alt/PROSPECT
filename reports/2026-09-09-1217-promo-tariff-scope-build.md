# Tariff scope on an event — STOPPED at item 1

```
FOR ADVISOR
Generated: 2026-09-09 12:17 +0100 (UTC 2026-09-09 11:17)
Certifies: 9c93807 (read-only; nothing committed but this report)

STOPPED AT ITEM 1 AS THE BRIEF DIRECTS: no card builds its event in one
  place. NOTHING BUILT, NOTHING RECORDED — the STOP is "before editing".
VOLUME: 3 emitters + 2 edit-savers — churn ramp WIT:3560, spread :3619, App
  :212 (its own comment: THE FIFTH WRITER, "four in my head, five in code"),
  handleSaveEdit :4161, handleSaveCampaign :3937.
PROMOTION: 3 — add :2756, handleSavePromoEdit :4430, handleSavePromoCampaign
  :4460. All three call buildPromoEvents; none is a preview.
PRICING: 2 — addPricingEvent :3521, updatePricingEvent :3518.
SO decision (2)'s "at the one place each draft becomes an event" describes a
  codebase that does not exist. tariffScopeFor would be called at 8-10 sites,
  not 3, and every missed one saves an event with no scope — silently.
REACHABLE: YES everywhere. tariffTree is built App:1772, passed :4417/:4502,
  read as fullTariffTree WIT:1993; selectedTariffs is App:1238. App's own
  addMarketEvent sits in the same component as both.
BASE NAMED DOES NOT EXIST: reports/…-delta-month-selector-ui.md was never
  written — that session was HELD at the previous brief's shed point (1039
  §Scope). Actual base 9c93807 + three reports-only commits; ZERO drift.
BRIEF TRUNCATED at item 5's shed clause; items 6-7 absent. Named, not filled.
PREMISE LINE NUMBERS ALL HELD: fc:566, fc:3090, fc:532/3570, WIT:592, :1994.
ONE LINE FROM JON: extract one save helper per card first (then (2) is true
  as written), or authorise tariffScopeFor at all 8-10 emitters as they are.
```

## Base, and two problems with the brief

**The named base report does not exist.** The brief says *"Base: the Repo line
of `reports/2026-09-09-…-delta-month-selector-ui.md`"*. `reports/` holds three
delta-month files — `0939` (inventory), `0948` (the stop), `1039` (the engine
and predicate half) — and no `-ui`. That session was **held**, at the previous
brief's own shed point, and its report says so.

So the base was verified against the tree instead: HEAD `72e08f8` is the last
code commit **`9c93807`** plus **three** reports-only commits (`9eefbfc`,
`f8e8879`, `72e08f8`), and `git diff 9c93807 -- src/ scripts/ test-data/
package.json` is empty. Zero drift in gated paths.

This matters beyond bookkeeping: the brief appears to be written from a plan in
which REQ-D6-02's UI had shipped. **It has not.** The selector, the Revenue
card, their spec and their three traps are still held, and trap ids 182+ are
still unused — so this session's "prior count + 4" would be 177 + 4, not
180 + 4.

**The brief is truncated.** Item 5's shed clause ends mid-sentence — *"STOP
after the carrier, predicates, export and their specs are gated and"* — and
items 6 and 7 (commit, report path) are absent. Neither blocks anything: the
intent is recoverable from the previous brief's identical clause and from
CLAUDE.md's conventions, and this report is filed under them. Named rather than
filled, per the 1341 rule.

**The premise's line numbers all held**, re-checked before use as instructed:
`eventScopeMatchesView`'s `ok` at `fc:566`, `leafWithinScope` at `fc:3090`, the
two `EventScopeDims` at `fc:532` and `fc:3570`, `buildPromoEvents`' tariff
write at `WIT:592`, `targetTariffTree` at `WIT:1994`.

## 1. Where a draft becomes an event — the STOP

The brief: *"name the one site per card where a draft becomes an event … If
any card builds its event in more than one place, STOP and report before
editing."*

**All three cards build in more than one place.** This is not a near miss on
one card; it is the shape of the whole step.

### Promotion — three, and none is a preview

| site | function | what it does |
|---|---|---|
| `WhatIfTab.tsx:2756` | the add path | builds and appends |
| `:4430` | `handleSavePromoEdit` | rebuilds, then `updateMarketEvent(editingPromoId, …)` at `:4448` |
| `:4460` | `handleSavePromoCampaign` | rebuilds a whole campaign |

All three call `buildPromoEvents` with the same argument shape. I checked each
for being an impact preview rather than a save; none is — `:2756` sits after
the `promoMixBlocksSave` / `promoDilutionBlockReason` guards and commits.

### Volume — at least three emitters and two edit-savers

`handleAddMarketEvent` (`:3527`) is a router, not an emitter, and it has three
exits:

- the **churn ramp** branch builds `MarketEvent[]` at `:3560` and commits at
  `:3589`;
- when spreading is off it delegates to **App's `addMarketEvent`** (`:3604` →
  `App.tsx:212`);
- the **spread** branch builds its own `MarketEvent[]` at `:3619`.

Plus `handleSaveEdit` (`:4161`) and `handleSaveCampaign` (`:3937`).

`App.tsx:229` already names the problem in its own comment — *"THE FIFTH
WRITER. This is the DEFAULT add path … the count of writers was four in my head
and five in the code."* That count was made for a different field (the ARPU
override) and the same routing produced the same class of bug: **a writer
nobody remembered, silently dropping a field the others carried.**

### Pricing — two

`addPricingEvent(event)` at `:3521` and `updatePricingEvent(editingPricingId,
patch)` at `:3518`.

### Why this stops the build rather than merely enlarging it

Decision (2) reads *"at the one place each draft becomes an event"*. There is
no such place on any card. Building anyway would mean either:

- calling `tariffScopeFor` at **eight to ten** sites, where the failure mode of
  missing one is an event saved with **no scope at all** — indistinguishable
  from a deliberate "all tariffs", and wrong in exactly the direction the
  finding reports; or
- silently reinterpreting the decision as "at the sites I found", which is the
  decision being taken by me rather than by Jon.

The codebase's own history says which risk this is: the fifth writer was found
by a gate, not by reading, and the field it dropped was carried correctly by
the other four. A scope field would fail the same way, and the symptom — full
uplift at an out-of-scope tariff — is precisely the bug being fixed, so a
partial application would look like the fix not working.

## Reachability — the other half of item 1

**Yes, at every site.** `tariffTree` is built in `App.tsx:1772` and passed to
`WhatIfTab` at `:4417` and `:4502`, where `fullTariffTree = tariffTree ??
new Map()` (`WhatIfTab.tsx:1993`). `selectedTariffs` is `App.tsx:1238` and is
already a prop of `WhatIfTab` (`:92`). App's own `addMarketEvent` (`:212`) is
declared in the same component as both, so the strict-subset test is available
there without new plumbing.

So `tariffScopeFor(draftTariffL1, selectedTariffs, fullL1s)` is buildable
exactly as specified. Only *where it is called* is unsettled.

## What was NOT done

- **No code.** Nothing under `src/` or `scripts/` was touched.
- **No EXPECTED.md entry.** The brief orders the record before code, and the
  STOP precedes both. Recording decision (2) verbatim would write *"the one
  place each draft becomes an event"* into the terrain, and EXPECTED.md is the
  terrain. The decision text is complete in the brief and preserved here for
  whoever records it next — only clause (2)'s premise needs amending.
- **No traps, no spec.** `next free trap id` is **182**, unchanged: REQ-D6-02's
  three traps were never built either.
- **No gate run.** Nothing changed, so there is nothing to certify but the
  reading.

## The one line that unblocks it

Two shapes, and they are not equivalent:

1. **Extract one save helper per card first** — `saveVolumeEvent`,
   `savePricingEvent`, `savePromoEvents` — so that decision (2) becomes true as
   written, then apply `tariffScopeFor` at three sites. This is a refactor of a
   routing structure that has already produced one known defect, and it would
   want its own gate and its own trap before the scope work rides on it.
2. **Authorise `tariffScopeFor` at all eight to ten emitters as they stand**,
   with a pin counting the call sites — the shape REQ-D6-01 used for its twelve
   apply sites, which is exactly the mechanism this codebase uses to keep a
   scattered obligation honest.

(2) is smaller and matches the project's existing habit. (1) is the deeper fix
and pays down the fifth-writer debt, but it moves code the current finding does
not otherwise touch.

## Limits

- **Read-only, nothing run.** No suite, no guard-traps, no mount. Line numbers
  were re-read this session at `9c93807` and drift on the next `WhatIfTab.tsx`
  edit.
- **The emitter count is a floor, not a ceiling.** I enumerated the sites that
  build a `MarketEvent` or call `buildPromoEvents` from a draft; a restore or
  import path that constructs events from a sheet is a different question and
  was not swept, because it does not read a draft.
- **Not reproduced.** The finding rests on Jon's screen and on the inventory's
  reading of the two predicates; nothing was mounted this session.

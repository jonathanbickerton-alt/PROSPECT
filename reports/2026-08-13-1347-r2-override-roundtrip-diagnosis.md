# R2 tier override — does it survive save and reload?

## FOR ADVISOR

```
Generated: 2026-08-13 13:47 +0100 (UTC 2026-08-13 12:47)
Verified against: 9694520, branch main, tree CLEAN (bar this report).
Repo: __REPO__
SKELETON CREATED AS THIS SESSION'S FIRST ACTION, before any check ran.
NOT REPRODUCED BY INSPECTION — the honest headline. Every link checks out at
  HEAD: the ONE yield writer persists tariffBaseArpuOverride (it survived
  6e9adff); the export writes Tariff_Base_ARPU_Override_JSON with the '' carrier
  (App.tsx:652); the ONE import route restores it via readStoredRateMap
  (App.tsx:1046); handleEditYieldStart restores the map and IS reachable.
ROUTE-COUNT CORRECTION, load-bearing: the TWO-import-routes fact is true of
  MARKET events, not yield. Yield has ONE parse site (App.tsx:1037). The Value
  card's overrides ride YieldEvent — MarketEvent has NO tier-override field —
  so "a saved market event on the Value card" mixes two carriers.
FINDING 1 — yieldArpuMode IS NOT RESTORED ON REOPEN. computeTierData's forecast
  branch SCALES every tier ARPU, so an event made in Forecast mode reopens in
  Historical with different DERIVED figures. It does not erase a stored
  override, but it is a sufficient cause of "the numbers came back wrong" and
  the smallest-scope candidate. NEVER-WORKED, predating R2.
FINDING 2 — spec:yield-roundtrip does NOT drive the real writer; its toRow is a
  COPY pinned only by a column-name check, so 35/35 does not certify the real
  export — the weakness that let the promo-field hole survive.
THE R2 SURFACE REPORT never claimed a save/reload/reopen walk: it certified
  eight SOURCE assertions and declared rendered behaviour unproven.
DECISIONS: which figure moved (override box vs derived placeholder)? which
  reload? was the event created in Forecast mode? NO FIX MADE.
```

---

## Instruments

`git rev-parse`; `sed -n` over `handleAddYieldEvent` and `handleEditYieldStart`
in `src/components/WhatIfTab.tsx`; `grep -n` for `handleEditYieldStart`,
`setYieldEvents`, `Yield_Events`, `Tariff_Base_ARPU_Override_JSON`,
`yieldArpuMode`. **No spec run, no gate** — read-only, and nothing was mounted,
so every claim below is source-read and is labelled as such.

## 1. Write — the one yield writer persists the map

`handleAddYieldEvent` builds the event with:

- `tariffBaseArpu: { ...effectiveTierArpuMap }` — the effective snapshot, as
  `6e9adff` left it;
- `tariffBaseArpuOverride: Object.keys(draftTierArpuOverride).length > 0 ? … :
  undefined` — the override map, **absent rather than `{}`** when nothing is
  stated.

**Both fields survive `6e9adff`.** That commit rewrote the block to spread the
shared map, and the override line is still there — the R2 two-field shape is
intact on the real save path, not a harness path. Consistent with the pinned
count of **one** construction site.

## 2. Export — the column is written

`App.tsx:652` writes `Tariff_Base_ARPU_Override_JSON` as
`e.tariffBaseArpuOverride ? JSON.stringify(...) : ''` — the `''` absence carrier
per the yield precedent.

## 3. Import — one route, not two

**This is the correction that matters most.**

The two-import-routes fact is **true of market events** — session restore and
workbook import, both through `readStoredEventModifiers`. **Yield events have
exactly one parse site**: `App.tsx:1037`, inside the session-restore block,
reading `Tariff_Base_ARPU_Override_JSON` through `readStoredRateMap` at
`App.tsx:1046`. The other `setYieldEvents` call sites are add / remove / clear.

**So the brief's framing — "a saved market event on the Value card" — mixes two
carriers.** The Value card's tier overrides ride `YieldEvent.tariffBaseArpuOverride`;
`MarketEvent` has no tier-override field at all. There is no second yield route
that could diverge from the first, so "which route carries the defect" has only
one possible answer for yield data.

## 4. Reopen — restored, and reachable

`handleEditYieldStart` sets `setDraftTierArpuOverride({ ...(ev.tariffBaseArpuOverride ?? {}) })`,
and it **is** wired to the event row's edit control (`WhatIfTab.tsx:5397`). The
input renders `overridden ? draftTierArpuOverride[tier] : ''` with `overridden`
testing presence, so a restored map drives both the value and the
edited-vs-default styling.

**No break found by reading.**

## 5. Findings

### FINDING 1 — `yieldArpuMode` is not restored on reopen

`handleEditYieldStart` restores `ibro`, `segment`, `product`, `channelL1/L2`,
`month`, `mixAxis`, `tariffMix` and the override map. It **never calls
`setYieldArpuMode`**, which stays at its `useState('historical')` default.

`computeTierData`'s forecast branch **scales every tier ARPU** so their
equal-weight blend matches the forecast for that month. So an event created in
**Forecast ARPU** mode and reopened in **Historical** shows a different set of
derived figures for the same event.

**This does not erase a stored override** — the map is keyed by tier name and
restores independently. But it is a real, sufficient cause of *"the numbers came
back wrong after reload"*, and it is the smallest-scope candidate for what Jon
saw. **Classification: never-worked.** `yieldArpuMode` predates R2; the reopen
handler never restored it, and R2 added fields to that handler without
inheriting a defect that was already there.

### FINDING 2 — the spec does not drive the real writer

`spec:yield-roundtrip`'s `toRow` is a **copy** "lifted from App.tsx", pinned only
by a check that the real writer emits the column name. Under the standing rule —
*round-trip checks drive the WRITER, not the reader on literal inputs* — this
spec is evidence about its own copy plus a name check, and **35/35 does not
certify the real export path**.

That is the same instrument weakness that let the promo-field hole survive, and
it is worth recording as a finding about the spec whether or not it is implicated
here.

### What the R2 surface report does and does not certify

`2026-08-12-1237-value-card-surface.md` certifies: the input renders, writes by
presence, clearing deletes the key, the effective rate is one definition, the
blend reads it, the construction site snapshots it. It states plainly that these
are **eight source-level assertions** standing in for a mounted spec, and that
**"a tier edit visibly moves the blend is still unproven by machine"**.

**It never claimed a save → reload → reopen walk of an override.** The mounted
spec was shed in that session and remains held. So a reopen defect is precisely
the kind of thing its coverage was declared not to reach — the report said so at
the time rather than in hindsight.

## 6. Why this is NOT REPRODUCED rather than "no defect"

Reading source establishes that each link is present. It does **not** establish
that they compose at runtime, and Jon watched them not compose. Three things
could still be true that source reading will not show:

1. the tier **names** differ between save and reopen (the map is keyed by name,
   and `computeTierData` derives names from data — a changed grouping column or
   a filtered-out tier would orphan the keys);
2. the seeding effect ordering — `setDraftMix` is protected by
   `seedMixPreserving`; `draftTierArpuOverride` has **no equivalent protection**,
   and nothing currently wipes it, but a render-order change would not be visible
   by inspection;
3. Finding 1's mode difference produced different derived figures and the
   override box was in fact still populated.

**Distinguishing these needs a behavioural repro, which this session did not
run.** Saying which one it is from source alone would be a guess wearing a
diagnosis's clothes.

## 7. Smallest-scope fix proposal

**Do not fix anything yet.** In order:

1. **Answer the two decision questions below** — they discriminate between the
   three candidates above at zero cost.
2. **Then**, if Finding 1 is the cause: restore `yieldArpuMode` in
   `handleEditYieldStart`. One line, no carrier, no round-trip change. It also
   needs a decision of its own — the mode is not persisted on the event, so
   restoring it means *storing* it, which is a new field.
3. **Independently of the outcome**: promote `spec:yield-roundtrip` to drive the
   real export writer, or state in the spec that it does not. Finding 2 stands
   on its own.

## Decisions needed from Jon

1. **Which figure moved?** After reload and reopen, was the **override box**
   empty/derived, or was the box still populated while the **derived placeholder
   or blend** looked wrong? These are different defects.
2. **Which reload?** A session restore of a saved workbook, or a fresh import?
   For yield data there is only one parse route, so the answer mostly confirms
   the surface — but it rules out a whole branch.
3. **Was the event created in Forecast ARPU mode?** If yes, Finding 1 is very
   likely the whole story.

## Limits of this check

Read-only; no source changed, no spec or gate run. `Verified against:` names the
commit rather than certifying one. **Nothing was mounted** — the promo and Value
cards still have no mounted spec — so all rendering and lifecycle claims here are
read from source and cannot exclude a runtime composition defect.

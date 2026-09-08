# The EFFECT column, session C — Compare joins (D5-09)

```
FOR ADVISOR
Generated: 2026-09-08 11:16 +0100 (UTC 2026-09-08 10:16)
Certifies: d63e67a (the tree every figure below was measured on)
Repo: committed d63e67a, pushed (origin in sync)

BASE ae58aca + 13db379 (reports/ only, ZERO drift). D5-09 appended: d260fbd.
FOUR RAW-ID SITES, all now eventRowId: fc:1221 market, fc:1204 pricing,
  fc:1491 yield, scenarioHelper:238 engine. Plus TWO MORE found and converted
  (sh:452, :464). Residual `?? Math.random` for event ROWS: ZERO. sh:122 is a
  memo key for eventShare, not a row id. Exports write ID: fc:330/1120/1397.
KIND TEST: the raw yield row's `IBRO` (fc:1399/1459) — what the event IS.
STEP 1 CORRECTION: the rule has ONE limb. "Per-scenario pricing" is NOT a kind
  of event — Compare's site 12 applies every on/in-scope/in-window pricing
  event with no Target condition; site 8 is a second CONSUMER of the same
  events. Not built, rather than inventing a class that does not exist.
DELIVERED AS A PARAMETER of effectStatusOf (`notAppliedHereIds`), not a
  wrapper: a wrapper is a second place deciding a row's status. PINS
  IDENTICAL: apply 12 (8+4), display 6, .enabled fc 5 + WhatIfTab 1.
not-applied-here: en Not applied here, de Hier nicht angewendet, es No
  aplicado aquí, fr Non appliqué ici, it Non applicato qui, pt Não aplicado
  aqui. All six differ; no allowlist entry. SPEC event-toggle 106->112;
  ScenarioCompareTab MOUNTED for the first time (Worker stubbed).
  TRAPS 180, 181, red by hand, 1 site each, restored.
suite 61/61  guard-traps 177/177  event-toggle 112/112  view-apply 168/168
trap-anchors 189/189  survival 104/26 + 27/27  i18n 200/200 keys 874  tsc 0
```

## Step 1 — diagnosis

**The four raw-id sites, re-checked (A→B drift was real; A→C moved them again).**

| site | before | after |
|---|---|---|
| `pricingEventFromRow` | `fc:1095` (A) → `:1170` (B) | **`fc:1204`** |
| `marketEventFromRow` | `:1248` (A) → `:1323` (B) | **`fc:1221`** |
| `yieldEventFromRow` | `:1382` (A) → `:1457` (B) | **`fc:1491`** |
| Compare's engine | `scenarioHelper:238` | **`:238`** |

**Two more that neither A nor B had found.** `scenarioHelper:452` and `:464`
also built `String(ev.ID ?? ev.Name ?? '')` for an event row, feeding the churn
path. Both converted, so the derivation is genuinely single.

```
residual `?? Math.random` id derivations for event ROWS: 0
```

The remaining `Math.random` ids in `src/` (`App.tsx:238`, `:4215`,
`WhatIfTab:588` and six siblings) mint ids for events the user CREATES in the
UI. They are not reading a sheet and are correctly untouched.

**`scenarioHelper:122` is not a fifth site.** It composes `ID ?? Name` with
month and scenario into a **memo cache key** for `eventShare`. Different
concept, deliberately left alone, named here so the "four sites" claim is
checkable rather than merely asserted.

**Every export writes `ID`** — `forecasting.ts:330` (market), `:1120`
(pricing), `:1397` (yield).

**The kind test — no STOP.** A retention yield event is identifiable from its
raw row: the sheet carries `IBRO` (written `fc:1399`, read `fc:1459`), and
`scenarioHelper` tests `ye.IBRO !== 'Inflow'` — its only IBRO test. So the
Compare-only rule keys on **what the event is**, not on its absence from a set.
That distinction matters: absence from a set is exactly what "no coverage"
already means, and conflating the two would make the new label meaningless.

**The correction: the rule has one limb, not two.** The decision names
retention yield *and* per-scenario pricing. Compare's site 12 applies **every**
on, in-scope, in-window pricing event — its filter has no `Target` condition —
and What-If's site 8 (`pricingFor`) is a second *consumer* of those same events
for the scenario-ARPU breakdown, not a separate population. So no pricing event
goes unapplied in Compare. The second limb is **not built**, because building
it would mean inventing a class of event that does not exist.

## Step 2 — the build

**`eventRowId(raw)` = `String(ID ?? Name ?? '')`**, exported from
`forecasting.ts`, used at all six sites. A random id survives only when both
tokens are absent — the one case where nothing can be joined on anyway.

`Name` is the fallback because it is what the engine already used, so adopting
it changes nothing on the engine side; only the readers move, and they move
*towards* the engine.

**Compare's flat row shape carries all four arrays** now
(`appliedEventIds`, `zeroCoverageEventIds`, `appliedArpuIds`,
`arpuCandidateIds`). The stale comment above the month record — which said
`appliedEventIds` is "NOT read by anything in this path" — is amended rather
than left to mislead; only `preFloor` and `flooredMetrics` remain unread.

**`ScenarioCompareTab` derives the four unions per file** in one memo and
passes `effectOf` to the shared table.

**The Compare-only rule is a PARAMETER, not a wrapper**:
`effectStatusOf(row, applied, zero, arpu, cand, notAppliedHereIds)`, inserted
as rule 4b — **before** the coverage rules. A wrapper in `ScenarioCompareTab`
would have been a second place deciding a row's status, and the whole point of
`effectStatusOf` is that there is one. The caller supplies a fact about its own
engine; the rule order stays in the function.

**Pins identical before and after: apply 12 (8+4), display 6, `.enabled` 5 in
`forecasting.ts` + 1 in `WhatIfTab`.**

**Six locale strings** for `whatif_effect_not_applied_here`: en *Not applied
here*, de *Hier nicht angewendet*, es *No aplicado aquí*, fr *Non appliqué
ici*, it *Non applicato qui*, pt *Não aplicado aqui*. All six differ from
English, so no allowlist entry was needed and `i18n-parity` stayed at 200/200.

## Step 3 — the spec

`spec:event-toggle` 106 → 112. **`ScenarioCompareTab` is mounted for the first
time in this project.** No spec had ever mounted it because it constructs a
`Worker` in an effect and receives its sessions only through `onmessage`, which
jsdom cannot provide. A Worker stub records the instance and the test delivers
the file by calling `onmessage` exactly as the real worker would — the
component's own code path, not a hand-set state.

```
  compare(ID)     ["volume","no-coverage","off","arpu"]  retention=not-applied-here
  compare(no ID)  ["volume","no-coverage","off","arpu"]  retention=not-applied-here
  what-if retention -> arpu
```

Case (b) is the one that matters: **the same rows with the `ID` column removed
label identically**, because `Name` now carries the join. That is the divergence
session A held the whole column for.

Case (c) pins that the label is a fact about the **engine**: the same retention
yield event reads `arpu` in What-If, which does apply it at site 5.

## Step 4 — the traps

Ids from `next free trap id` (`180` before, `182` after).

| trap | mutation | observed |
|---|---|---|
| **180** | drop the four arrays at the flat shape | both files → `["no-coverage","no-coverage","off","no-coverage"]` |
| **181** | one reader mints a random id again | with ID: unchanged; **without ID: `[null,null,null,"arpu"]`** |

Trap 181's asymmetry is the evidence: the ID-bearing file is untouched and only
the ID-less one breaks, which is precisely the divergence being guarded. The
observed values are `null` rather than "no coverage" — with a random id the
row's `data-testid` no longer exists at all, so the label is not merely wrong,
it is absent. The check's hint text says "read no coverage", which describes
the *class* of failure rather than this exact rendering; the assertion is on
label equality and is correct either way.

`spec:trap-anchors` caught trap 181's first anchor as **non-unique** (2
occurrences — the pricing reader's id/name pair is identical). Re-anchored on
the `campaignName` comment, which is unique to `marketEventFromRow`.

Both planted by hand, pre-plant md5s `df13e8ff2f` and `74041fc58d`, one site
each (the harness dies rather than planting if the count is not exactly 1),
both restored and verified.

## Gate

```
tsc                0
build              clean
i18n-parity        200/200 (checks unchanged); keys 873 -> 874 per locale
i18n-scan          PASS
survival           104/26 dereferences/files; 27/27 checks
trap-anchors       189/189 (177 traps, 184 anchors, ids unique by number)
view-apply-mounted 168/168
event-toggle       112/112
guard-traps        177/177 caught (0 MISSED, 0 INCONCLUSIVE, 0 CRASHED)
full suite         61/61 green
```

## Limits

- **The ID-less same-name collapse is unfixed and now reachable.** With no `ID`
  column, every row of a campaign shares the campaign's `Name`, so they share
  one id and one EFFECT status. Recorded in EXPECTED.md as a watch; the spec
  does not cover it.
- **The Worker stub is a stub.** The mount proves the component's render and
  memo paths; it does not exercise the real parser worker, so a defect in the
  worker's output shape would not be caught here.
- **Compare's ARPU coverage is still narrower than What-If's**, as session B
  recorded — no retention yield, no per-scenario pricing. The new label makes
  the first of those visible to the user rather than fixing it.

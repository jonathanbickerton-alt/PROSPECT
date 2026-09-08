# The EFFECT column, session B — ARPU measured (D5-09)

```
FOR ADVISOR
Generated: 2026-09-08 10:27 +0100 (UTC 2026-09-08 09:27)
Certifies: ae58aca (the tree every figure below was measured on)
Repo: committed ae58aca, pushed (origin in sync)

BASE 3d3ef3d + dcef640 (reports/ only, ZERO drift). D5-09 appended: 58a3cf6.
PREMISE CLAIMS HOLD; LINE NUMBERS DRIFTED ~5, moved by session A's own edits.
  Now: yield winners :1344 (site 2), :1554 (site 5); pricing applies EVERY
  match at 6 (:1613) and 8 (:1728), no winner.
WRITES What-If: appliedArpuIds :1361/:1579/:1653/:1775; candidates :1355/:1572.
WRITES Compare: both at site 10 (:369/:373), appliedArpuIds at site 12 (:526).
  NO EQUIVALENT for What-If sites 5 and 8 — one IBRO test, no per-scenario
  pricing — so Compare's array is a SUBSET. Still dropped at the flat shape;
  (iii) remains held on session A's id-join decision.
PINS IDENTICAL BEFORE/AFTER: apply 12 (8+4), display 6, .enabled fc 5 +
  WhatIfTab 1. No new isEventOn or eventScopeMatchesView call.
RULES: 1 off; 2 appliedIds->volume; 3 appliedArpuIds->arpu; 4 candidates->
  superseded; 5+6 ->no-coverage. Carrier inference REMOVED.
Superseded: en Superseded, de Überschrieben, es Sustituido, fr Remplacé, it
  Sostituito, pt Substituído. All six differ; no allowlist entry needed.
SPEC event-toggle 98->106. TRAPS 178, 179, red by hand, 1 site each.
FINDING: an early roll-forward yield event is NOT superseded — it WINS its
  first month. Superseded is candidate-somewhere, winner-nowhere.
suite 61/61  guard-traps 175/175  event-toggle 106/106  view-apply 168/168
trap-anchors 187/187  survival 104/26 + 27/27  i18n 200/200 keys 873  tsc 0
```

## Step 1 — the premise re-verified

**All four claims from session A hold. Their line numbers do not.** Session A's
own edits (`EMPTY_ID_SET`, an import) added lines above, moving every citation
down about five. This is the drift regression-guard.md warns about — "the
branch under review is the usual cause" — caught by re-checking rather than by
quoting.

| claim | session A said | actually |
|---|---|---|
| yield Inflow winner | `:1339` | **`:1344`**, `.sort(...)[0]` |
| yield Retention winner | `:1549` | **`:1554`**, same construct |
| pricing site 6 applies every match | `:1607` | **`:1613`** filter → sort → `forEach`, no `[0]` |
| pricing site 8 applies every match | `:1721` | **`:1728`** filter → sort → `map`, no `[0]` |

**Compare's equivalents — two of four.**

| What-If | Compare |
|---|---|
| site 2, Inflow yield winner | **site 10**, filter `:361`, winner `:375` |
| site 6, pricing every match | **site 12**, `:485` filter, `:526` forEach |
| site 5, **Retention** yield winner | **none** — one IBRO test only, `!== 'Inflow'` |
| site 8, per-scenario pricing | **none** — no `scenarioArpu` / `pricingFor` |

So Compare's `appliedArpuIds` is necessarily a subset of What-If's. Recorded in
EXPECTED.md and in the code, because a later session reading Compare's array
must not assume it answers the same question.

## Step 2 — the build

Both arrays sit on the per-month object beside `appliedEventIds` and
`zeroCoverageEventIds`, **initialised empty in pass 1 and filled in pass 2** —
the ARPU carriers are applied after Base volumes are known, so they cannot be
recorded where the month is created. `computed.map((m, idx) => …)` gives pass 2
the same objects.

**Ids are pushed inside the existing filters.** Each site's list is now *named*
(`inflowYieldCandidates`, `retentionYieldCandidates`) so the candidates can be
read off the array the sort already consumed. No predicate call was added:
`isEventOn` stays at 24 occurrences in `WhatIfTab`, `eventScopeMatchesView` at
11, and all three pins are identical before and after — **apply 12 (8+4),
display 6, `.enabled` 5 in `forecasting.ts` + 1 in `WhatIfTab`**.

Site 8 records inside a block-bodied `map` rather than the object literal; the
returned `ScenarioPricing` shape is unchanged. It runs once per scenario, so an
event is recorded several times a month — harmless, because the consumer unions
into a `Set`, and de-duplicating at the site would be that site holding an
opinion about how it is read.

**The final rule order**, stated at the function:

| | rule |
|---|---|
| 1 | `!enabled` → **off** |
| 2 | in `appliedIds` → **volume** |
| 3 | in `appliedArpuIds` → **arpu** |
| 4 | in `arpuCandidateIds` → **superseded** |
| 5 | in `zeroCoverageIds` → **no-coverage** |
| 6 | otherwise → **no-coverage** |

Rules 5 and 6 return the same value **deliberately**: 5 is "the engine said
this covered nothing", 6 is "no set claims it". They read alike to the user and
differently to anyone editing the function, and collapsing them would hide the
second case the moment a sixth status is added.

Rule 3 sits above rule 4 for a reason the spec then proved necessary — see
below.

## Step 3 — the spec, and the finding it forced

`spec:event-toggle` 98 → 106.

```
  (a) single yield          -> arpu
  (b) two yield, same month -> wins=arpu loses=superseded
  (c) pricing               -> arpu
  (d) yield, scope matches 0-> no-coverage
  (e) market, no union      -> no-coverage
  (f) card number/caption   -> 1 / "moving volume · 3 switched on"
```

**Case (b) failed first, and the fixture was wrong, not the code.** The obvious
construction — an early roll-forward yield event and a later one — reported
`arpu` for both. That is correct: the early event **wins the first month it
qualifies in**, because the later one's month has not arrived yet, and only
loses afterwards. It moved ARPU, so calling it superseded would be false.

**So `superseded` means candidate-somewhere, winner-nowhere**, and the fixture
now builds that: two yield events in the *same* month, where equal months sort
equal, the sort is stable (ES2019), and the second can never win. Rule 3 above
rule 4 is what makes a winner-anywhere immune to the label.

Cases (d) and (e) are the regressions session A's carrier inference would have
failed: an unmatched *yield* event now reads **No coverage**, not ARPU, and a
market event in no union reads **No coverage** without anything consulting
`pass`.

Case (f) pins that none of this moved the card: still `1` on the volume path,
still `3` switched on across all three carriers.

## Step 4 — the traps

Ids from `next free trap id` (`178` before, `180` after).

| trap | mutation | FAIL |
|---|---|---|
| **178** | the winner is never recorded | `(a) a matched yield event reads ARPU [superseded]`; `(b) the winning yield event reads ARPU [superseded]` |
| **179** | candidates are never recorded | `(b) the one that never wins reads Superseded [no-coverage]` |

Two, because the arrays fail in **opposite directions**. Losing the winner makes
every yield row claim it was displaced when it in fact set the ARPU. Losing the
candidates makes `superseded` *unreachable* — a status that can never render,
which no green suite would notice because nothing else changes.

Both planted by hand, literal `\Q…\E` replace, pre-plant md5 `a1b8eba8cf`,
**1 site each**, `anchor_left=0`, both restored and verified.

*(The first plant harness used `awk`'s `sub()`, which treats its pattern as a
regex — the parentheses in the anchor stopped it matching and it reported
`landed=NO` rather than silently planting something wider. Replaced with perl
`\Q…\E`.)*

## Gate

```
tsc                0
build              clean
i18n-parity        200/200 (checks unchanged); keys 872 -> 873 per locale, all six
i18n-scan          PASS
survival           104/26 dereferences/files; 27/27 checks
trap-anchors       187/187 (175 traps, 182 anchors, ids unique by number)
view-apply-mounted 168/168
event-toggle       106/106
guard-traps        175/175 caught (0 MISSED, 0 INCONCLUSIVE, 0 CRASHED)
full suite         61/61 green
```

## Limits

- **(iii) is still held.** Compare records both arrays but drops them at the
  flat row shape; no column there, and session A's id-join decision is still
  open.
- **Case (b) leans on sort stability.** `Array.prototype.sort` is stable from
  ES2019 and V8 honours it, but the fixture's two same-month events are
  distinguished only by input order. A future engine change that sorted by a
  tiebreaker would change which one is superseded without breaking the check.
- **Compare's recording is untested.** No spec mounts `ScenarioCompareTab` and
  asserts its two arrays are populated — they are written for session C to
  consume and nothing yet reads them, so nothing yet proves they are right.

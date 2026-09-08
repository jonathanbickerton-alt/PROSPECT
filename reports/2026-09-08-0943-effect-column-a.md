# The EFFECT column, session A (D5-09)

```
FOR ADVISOR
Generated: 2026-09-08 09:43 +0100 (UTC 2026-09-08 08:43)
Certifies: 3d3ef3d (the tree every figure below was measured on)
Repo: committed 3d3ef3d, pushed (origin in sync)

BASE 164740e + 0b38d56 (reports/ only, ZERO drift). D5-09 recorded at ff38d5a.
1(a) appliedHere local const WhatIfTab:4538-9, only .size escaped. 1(b)
  scenarioHelper:283-4 attaches both sets, flat shape :530-543 omits both.
1(c) FIRED THE STOP — (iii) NOT BUILT. Engine id String(ID ?? Name)
  (scenarioHelper:238) vs row id String(ID ?? random) (fc:1248/1095/1382).
  Same raw row: agree when the sheet has an ID column (every export writes
  one, fc:330), diverge SILENTLY when not — every row would read "No
  coverage" for events that applied. Jon decides; 3 options below.
FILES: fc, EventsSummaryTable, WhatIfTab, 6 locales, 3 specs, EXPECTED.md.
PINS: named UNMOVED, apply 12/12, display 6/6. A THIRD raised deliberately,
  `.enabled` fc 4->5 and WhatIfTab 0->1 — both new reads are on a DERIVED
  row, not an event carrier. Reason at the check.
effectStatusOf(row, appliedIds, zeroCoverageIds): off wins; applied->volume;
  zero-cov->no-coverage; else pass 0 -> no-coverage, 1|2 -> arpu (INFERRED).
SPEC event-toggle 89->98. TRAP 177 red by hand, 1 site, restored. The second
  trap asked for has nothing to guard while (iii) is held.
SESSION B: yield winner WhatIfTab:1339 (:1549 retention). PRICING HAS NO
  WINNER: sites 6/8 (:1607/:1721) apply EVERY match; Superseded is yield-only.
suite 61/61  guard-traps 173/173  event-toggle 98/98  view-apply 168/168
trap-anchors 185/185  survival 104/26 + 27/27  i18n-parity 200/200 keys 872
```

## Step 1 — the inventory's claims, re-verified before building on them

**(a) confirmed.** `WhatIfTab.tsx:4538-4539` builds `const appliedHere` locally;
`:4540` returned `{ baseDelta, arpuByScenario, eventCount: appliedHere.size }`.
The set did not escape.

**(b) confirmed.** `scenarioHelper.ts:283-284` attaches both id arrays to each
month record; the flat row shape returned at `:530-543` carries eleven fields
and neither of those two. `finalRows` (`:545`) is what `ScenarioCompareTab`
receives.

**(c) the stop condition fired, and the shape of it matters.**

| | expression | file:line |
|---|---|---|
| engine's id | `String(e.ID ?? e.Name ?? '')` | `scenarioHelper.ts:238` |
| summary row's id | `String(r.ID ?? Math.random()…)` | `forecasting.ts:1248` (market), `:1095` (pricing), `:1382` (yield) |

Both read the **same raw sheet row** — `RawEventSession.marketEvents` is
`any[]`, straight from the uploaded workbook. So:

- **With an `ID` column** — which every workbook this app exports has, because
  `marketEventExportRow:330` writes `ID: e.id` — both sides produce
  `String(r.ID)` and the join is exact.
- **Without one**, the engine falls back to `Name` and the reader invents a
  random id. The join then matches **nothing**, and because `effectStatusOf`
  reads absence-from-both-unions as a *state* rather than as *unknown*, every
  row would render **"No coverage"** — for events that plainly applied.

That is an affirmative false statement about the user's data, not a blank, and
it is silent. So **(iii) is not built.** The brief reserved this branch
explicitly, and the decision is Jon's. Three options, none of them mine to
take:

1. **Widen the three readers to the engine's fallback** (`ID ?? Name`) — one
   definition, three files, and it makes the join total for any file with
   either column. Closest to this project's usual answer.
2. **Suppress the column per file** when the join finds nothing on a file that
   has applied events — defensive, but a heuristic nobody asked for.
3. **Accept the risk** for files with no `ID` column.

## Step 2 — the build

### (i) The card

Title `whatif_events_in_effect`; **the number expression is untouched** —
`impactSummary.eventCount`, still the volume-path applied count. The caption
becomes `whatif_effect_caption` with `count` from
`summaryRows.filter(r => r.enabled).length`.

That on-count reads `EventSummaryRow.enabled`, which the builder already set
from `isEventOn` (`forecasting.ts:951/966/981`) — **no thirteenth call to the
predicate**, so the two named pins are untouched. It spans all three carriers,
deliberately a different population from the number above.

### (ii) The EFFECT column

`effectStatusOf(row, appliedIds, zeroCoverageIds)` in `forecasting.ts`, one
function, four rules **in order**:

1. `!row.enabled` → **off**. Off wins over everything, because a switched-off
   event is in neither union (site 1 drops it before `applyEventsToMonth` sees
   it) — so asking the unions first would report it as "no coverage", which is
   derivable from the sets and completely wrong about why.
2. in `appliedIds` → **volume**. The only status the engine *states*.
3. in `zeroCoverageIds` → **no-coverage**. Cohort-scoped; **the label never
   says "view"**, because the set does not move when the viewing bar moves.
4. else → `pass === 0 ? 'no-coverage' : 'arpu'`.

**Rule 4 is a carrier inference and the code says so.** There is no applied-id
set for yield or pricing, so "on, market carrier, in neither union" cannot be
told apart from "on, yield carrier, superseded". A pass-0 row reaching step 4
is reported `no-coverage` rather than `arpu`, because calling a volume event
"ARPU" would be inventing a mechanism. Session B replaces the branch.

`EFFECT_LABEL_KEY` maps the four statuses to keys, so the labels cannot drift
between callers. The column is opt-in (`effectOf?`), like `showAllToggle` and
`onSetEnabled` before it — Compare gets no column rather than a wrong one.

### Locale strings, all six

| key | en | de | es | fr | it | pt |
|---|---|---|---|---|---|---|
| `whatif_events_in_effect` | Events in effect | Ereignisse in Wirkung | Eventos con efecto | Événements en effet | Eventi in effetto | Eventos em efeito |
| `whatif_effect_caption` | moving volume · {{count}} switched on | bewegen Menge · {{count}} eingeschaltet | mueven volumen · {{count}} activados | agissent sur le volume · {{count}} activés | muovono volume · {{count}} attivati | movem volume · {{count}} ativados |
| `whatif_effect_volume` | Volume | Menge | Volumen | Volume | Volume | Volume |
| `whatif_effect_no_coverage` | No coverage | Keine Abdeckung | Sin cobertura | Aucune couverture | Nessuna copertura | Sem cobertura |
| `whatif_effect_off` | Off | Aus | Desactivado | Désactivé | Disattivato | Desativado |
| `whatif_effect_arpu` | ARPU | ARPU | ARPU | ARPU | ARPU | ARPU |
| `whatif_summary_col_effect` | Effect | Wirkung | Efecto | Effet | Effetto | Efeito |

**`i18n-parity` failed first, and the allowlist is why that was right.**
`ARPU` is identical in all five non-English locales (TERMBASE §1), and
`Volume` is the correct word in fr/it/pt — eight new equal-to-English pairs.
The pin is exact-count precisely so this cannot be waved through: both keys
were added to `ALLOW` with justifications and the pins raised `52→54` entries,
`184→192` pairs, as a deliberate reviewed edit. The alternative — mistranslating
`ARPU` to make a number go green — is the failure the pin exists to prevent.

### The third pin, raised deliberately

The two pins the brief named are **unmoved: 12 apply (8+4), 6 display**. A
third pin — zero `.enabled` reads outside the predicate and its writers — did
fire, at `forecasting.ts:947` (`effectStatusOf`) and `WhatIfTab.tsx:4846` (the
caption).

**Both new reads are on a DERIVED ROW, not an event carrier.**
`EventSummaryRow.enabled` was set by the builder *from* `isEventOn`; reading it
is reading a decision made once, not making a second one. `EventsSummaryTable`
has done exactly this four times since REQ-D6-01 and was never in the pin's
scope. The counts are raised `4→5` and `0→1`, exact both ways, with the
distinction written at the check.

## Step 3 — the spec

`spec:event-toggle`, 89 → 98 checks. Fixture: one applied volume event, one
targeting a product the cohort does not hold (so it matches the cohort and
covers none of it), one switched off, one yield event.

```
  effect  vol=volume zero=no-coverage off=off arpu=arpu
  labels  ["Volume","No coverage","Off","ARPU"]
  card    number 1  caption "moving volume · 3 switched on"
  flipped off -> volume
```

**The instrument is the label element** (`event-effect-<id>` and its
`data-effect`), not the row count — every row is present under every status,
so a row count would pass on a column that labelled all four identically. The
rendered text is asserted too, which catches a hard-coded English string that
`data-effect` alone would not.

The card's two numbers are asserted to **differ** — 1 applied, 3 on — because
that is the point of the change. And flipping the off event on moves its label
(`off → volume`), so the column cannot be a static cell.

## Step 4 — the trap

**Trap 177**, id from `next free trap id` (`177` before, `178` after). It
empties the applied union and leaves everything else standing.

```
FAIL  D5-09: an applied volume event reads Volume  [no-coverage]
FAIL  D5-09: the four labels are the keyed strings  [["No coverage","No coverage","Off","ARPU"]]
FAIL  D5-09: the card number is the volume-path applied count  [0]
FAIL  D5-09: the caption carries the on-count across all carriers  [Add events below…]
```

Planted by hand: md5 `ba9414fe51` → `b47031cca4`, landed, **1 site hit**,
restored to `ba9414fe51`, verified. The planted run shows the failure exactly
as named — `vol` reads `no-coverage`, a confident wrong answer with no error.

**The second trap the brief asked for is not written.** It was to drop the two
sets again at Compare's flat row shape; with (iii) held, the sets never reach
that shape and there is nothing for it to guard. It belongs with (iii).

## For session B

- **The yield winner is chosen at `WhatIfTab.tsx:1339`** —
  `.sort((a, b) => b.month.localeCompare(a.month))[0]`, apply site 2 (Inflow).
  The retention yield path has the same construct at **`:1549`** (site 5).
- **Pricing has no equivalent, and that is the finding.** Sites 6 (`:1607`)
  and 8 (`:1721`) apply **every** matching pricing event — `filter`, no sort,
  no `[0]`. So `Superseded` is a **yield-only** state; a pricing event is
  never displaced by another. Session B should not look for a pricing winner.

## Gate

```
tsc                0
build              clean
i18n-parity        200/200 (was 194 — +6 checks from two allowlist entries);
                   keys 865 -> 872 per locale, all six
i18n-scan          PASS
survival           104/26 dereferences/files; 27/27 checks
trap-anchors       185/185 (173 traps, 180 anchors, ids unique by number)
view-apply-mounted 168/168
event-toggle       98/98
guard-traps        173/173 caught (0 MISSED, 0 INCONCLUSIVE, 0 CRASHED)
full suite         61/61 green (no spec added — the block joined event-toggle)
```

## Limits

- **(iii) is not built and Compare is unchanged** — no column there, no widened
  row shape, and no spec asserting the column's absence in Compare.
- **Rule 4 is an inference, not a measurement.** A pass-1/2 row in neither
  union is labelled ARPU without anything confirming it moved ARPU this month.
  Session B is the fix; until then the label is a carrier statement.
- **The zero-coverage fixture leans on cohort scoping.** `e-zero` targets a
  product outside the loaded cohort; I did not separately verify that it
  reaches `zeroCoverageIds` via `coverage === 0` rather than `viewShare === 0`.

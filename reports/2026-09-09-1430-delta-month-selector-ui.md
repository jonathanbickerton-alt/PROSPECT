# REQ-D6-02 part 2 — the delta-month selector and the Revenue card

```
FOR ADVISOR
Generated: 2026-09-09 14:30 +0100 (UTC 2026-09-09 13:30)
Certifies: 0e67708 (the tree every figure below was measured on)
Repo: committed 0e67708, pushed (origin in sync)

BASE fb51506 + 56759ad/239787c (reports/ ONLY; ZERO drift in gated paths).
0 DOCS FIRST: D5-10 CLOSED and the REQ-D6-02 part-2 line, both at eaee5f6.
1 CARD: `ScenarioDeltaCard`, ONE component used TWICE — the ARPU card was
  inline JSX. Public testids PRESERVED via an explicit groupTestid prop.
  SWEEP of "(end of period)": EXACTLY 2 readers, both card titles, no spec
  or trap or doc — so both keys RETIRED. The option list excludes months
  carrying actuals; the default is DERIVED, so nothing exists to reset.
2 SPEC view-apply-mounted 177 -> 189, with its OWN mount; the fixture was
  wrong TWICE and discriminate-first said so both times.
3 TRAPS 188, 189 RED by hand (md5 72fe3ccf3d, 1 site each, restored). 190 AND
  191 WERE WRITTEN, PLANTED AND REMOVED: both stayed GREEN because every
  revenue on this fixture lands on a WHOLE PENNY, so round-first and
  subtract-first print the same string; the rule ships UNGUARDED, said plainly.
4 GATE: guard-traps 185/185 CAUGHT, 0 MISSED/INCONC/CRASHED. suite 61/61,
  view-apply 189/189, event-toggle 146/146, applied-count 17/17, anchors
  197/197, survival 104/26 + 27/27, ai-hold 13/13, i18n 200/200 (877 x 6:
  4 added, 2 retired), tsc 0, lint and build clean. Next free trap id 190.
DEFECT I INTRODUCED, CAUGHT BY THE SPEC: Math.max(0, findIndex) made "not
  found" mean MONTH 0 — 24 checks red. The fallback is now end of period.
RE-AIMED, each by its own check: applied-count's dep literal, trap 157, 134.
```

## 0. Docs first

`eaee5f6` appended two things and changed nothing else: D5-10's closing
paragraph in the D5-07/08/09 form, verbatim as supplied, and a dated line on
REQ-D6-02 recording that part 2 is built against it with no new decision.

## 1. The UI

**The selector.** `selectedDeltaMonth` sits beside `windowSize` as view state.
Its options are derived once:

```ts
const withActuals = monthsCarryingActuals(data, [wiDateCol], wiValueCol);
return adjustedMonths.map(m => m.month).filter(mo => !withActuals.has(mo)).reverse();
```

— the **one** predicate part 1 extracted, not a second copy of its rule, and
given the same candidate date columns the import modal gives it.

**The default is derived, not written.** `selectedDeltaMonth` starts `''` and
the month actually read is `options.includes(selected) ? selected : options[0]`.
A `useEffect` writing state on mount would make the first render show one month
and the second another, and "a remount resets" would then be a claim about an
effect rather than about nothing existing to reset.

**`ScenarioDeltaCard`, one component used twice.** The ARPU card was inline
JSX, so it was extracted rather than forked, exactly as the brief directed. The
two uses differ in title, tone and testid prefix; four rows keyed by scenario,
raw scenario identifiers and the em-dash-for-absence rule are shared.

**Public testids were preserved, deliberately.** `impact-arpu-delta-<kpi>` is
read by the mounted spec and by trap 134, and the group id
`impact-arpu-scenarios` by `spec:event-toggle`'s `measure()`. The group id is
therefore an explicit `groupTestid` prop rather than derived from the prefix —
deriving it would have renamed a public handle for tidiness. Revenue gets
`impact-revenue-delta-<kpi>` and `impact-revenue-scenarios`.

**The sweep.** `grep` for the two `_end_of_period` keys across `src/`,
`scripts/`, `test-data/` and `docs/` found **exactly two readers**, both card
titles in `WhatIfTab.tsx`. No spec, no trap, no document. Both keys are
therefore **retired**, not left orphaned, and replaced by three titles carrying
`{{month}}` plus a selector label — 875 → **877** keys per locale.

| key | en |
|---|---|
| `whatif_base_volume_delta_at` | Base Volume Delta ({{month}}) |
| `whatif_arpu_delta_at` | ARPU Delta ({{month}}) |
| `whatif_revenue_delta_at` | Revenue Delta ({{month}}) |
| `whatif_delta_month` | Delta month |

de *Base-Volumendelta / ARPU-Delta / Umsatzdelta / Delta-Monat*; es *Delta del
volumen Base / Delta de ARPU / Delta de ingresos / Mes del delta*; fr *Delta du
volume Base / Delta d'ARPU / Delta de revenu / Mois du delta*; it *Delta del
volume Base / Delta ARPU / Delta di ricavo / Mese del delta*; pt *Delta do
volume Base / Delta de ARPU / Delta de receita / Mês do delta*. All distinct
from English, so **no ALLOW entry was needed** and `i18n-parity` stayed
200/200.

**Month labels** go through `monthLabel(month, i18n.language)`, the Step-2
formatter, in both the options and the three titles.

**The Revenue card** reads `scenarioArpu[k].revenue − baselineRevenue[k]` at
the selected month — both halves unrounded, rounded once, em dash where either
is null. Those are the fields part 1 persisted, and the reason it persisted
them.

### The defect I introduced, and what found it

`const mi = Math.max(0, adjustedMonths.findIndex(...))` — which maps **not
found** to **month 0**. The mounted spec went from 177/177 to **153/177**, and
the failures said `delta 0` at views that plainly move. Not found must mean
**end of period**, the figure every existing reader expects; it now does.

This is also why the existing spec's option list is empty: its fixture's `data`
covers the forecast months themselves, so `monthsCarryingActuals` excludes all
of them. The fallback is what those 177 checks now exercise.

## 2. Spec

`spec:view-apply-mounted` **177 → 189** — the spec that reads the rendered KPI
cards. The block builds its **own mount**, because `readAt` unmounts before it
returns and this work has to change the control and re-read the cards on the
same tree.

Covered: the option list non-empty on a fixture where only the first forecast
month carries an actual; that month absent; options descending; the default is
the last offered month; **changing `windowSize` leaves the list unchanged**
(with the 6M button asserted found, so the check cannot pass vacuously);
selecting the earlier month moves the Base card to that month's value, computed
in the spec from the engine's unrounded fields; a remount resets to the
default; the Revenue card renders four rows.

**The fixture was wrong twice and the discriminate-first rule said so both
times.** First the two months' base deltas were identical (an event in
`MONTHS[0]` gives the same delta at every later month) — moved to `MONTHS[1]`
so the lagged stock differs. Then the revenue precision fixture did not
discriminate; see below.

## 3. Traps

**188** the cards ignore the selected month; **189** months carrying actuals
are offered. Both planted by hand against pre-plant md5 `72fe3ccf3d`, one site
each, restored and verified:

| trap | observed |
|---|---|
| 188 | `FAIL … selecting the earlier month MOVES the Base card [card 1000 vs engine 0]` |
| 189 | `FAIL … the month carrying an actual is ABSENT [options 2026-03,2026-02,2026-01]` |

**190 and 191 were written and REMOVED, and that is the finding.** They planted
the two rounding defects decision 5 forbids — the Revenue card subtracting 2dp
figures, and `baselineRevenue` rounded at birth — and the mounted spec stayed
**green for both**. Measured rather than assumed: on this fixture every revenue
lands on a whole penny, so round-first and subtract-first **print the same
string** (`+400.00` either way), and no assertion on the rendered card can tell
them apart.

A trap nothing can catch is not a guard, so they are not in the registry. The
spec now records the two strings side by side and says when they are identical,
so the next fixture with sub-penny revenue earns the ids back. **The Revenue
card's subtract-then-round rule is therefore correct by construction and
unguarded by any trap** — stated here rather than implied by an id.

## Re-aimed, each caught by its own check

- **`spec:applied-count`'s dep-array literal.** `deltaMonth` joined
  `impactSummary`'s read-set, so the pinned literal moved. Re-aimed, not
  loosened — the third time this pin has moved and each time because a real
  read arrived.
- **Trap 157** — its anchor became **non-unique** the moment
  `revenueByScenario` was written in the ARPU block's shape, so `replace()`
  would have planted at the ARPU one while claiming to test both.
  `spec:trap-anchors` reported `2 occurrences`; re-anchored on the ARPU pair,
  which uses `.arpu` and the band mean and is unique.
- **Trap 134** — anchored on the inline card's `data-testid` template, which
  the extraction removed. Re-anchored on `testid="impact-arpu-delta"`, which
  retires exactly the four testids it was always about and leaves Revenue's
  alone.

## 4. Gate

Serial, guard-traps to a FILE, one instance.

```
guard-traps        185/185 CAUGHT   0 MISSED / 0 INCONCLUSIVE / 0 CRASHED
                   134, 157, 188, 189 all CAUGHT; TARGETS restored
suite              61/61 green
view-apply-mounted 189/189  (177 -> 189)
event-toggle       146/146
spec:applied-count 17/17   (dep-array literal re-aimed)
spec:trap-anchors  197/197  (185 traps, 192 anchors); next free id 190
spec:survival      104 dereferences across 26 files; 27/27 checks
spec:ai-hold       13/13
spec:i18n-parity   200/200; 877 keys per locale (+2 net: 4 added, 2 retired)
tsc 0              lint clean        build clean
```

**185, not the brief's 187**, and the difference is the two traps removed for
being uncatchable, not two traps unwritten. `next free trap id` is **190**;
ids 190 and 191 are burnt in the registry's comment, which records why.

Pins identical before and after: **apply 8 + 4 = 12**, **display 6**,
**`.enabled` 5 + 1**, **`TARIFF_SCOPE_SITES` 9** — all asserted by
`spec:event-toggle`, green.

## Limits

- **The Revenue card's precision rule is unguarded.** Traps 190 and 191 were
  written, planted and removed because this fixture cannot see 2dp rounding —
  every revenue on it lands on a whole penny. The rule holds by construction
  (the card reads the unrounded fields and rounds once) and the spec pins the
  Base cell's exact string, but nothing would fail if a future edit rounded
  first. A fixture with sub-penny revenue is what closes this.
- **The card figures are asserted for the BASE card only.** Selecting a month
  is proven to move `impact-base-delta` to the engine's value; the ARPU and
  Revenue cards are proven to render and to read the same `impactSummary.month`
  by construction, not by a per-month numeric assertion of their own.
- **`monthsCarryingActuals` is given `[wiDateCol]` alone here**, where the
  import modal passes `[wiDateCol, dateCol]` — the second is the incoming
  file's detected column, which exists only during an import. Correct at this
  call site, and worth knowing if the selector ever runs mid-import.
- **No walk.** Everything above is mounted-spec evidence; the strip is now four
  cards wide on a `grid-cols-4`, and how that renders at a narrow viewport has
  not been looked at.

# The market and yield fromRow seams, and the yield spec promotion

## FOR ADVISOR

```
Generated: 2026-08-19 09:25 +0100 (UTC 2026-08-19 08:25)
Certifies: c426521 (this report filled one commit later)
Repo: committed c426521, pushed (origin in sync)
SKELETON CREATED AS THIS SESSION'S FIRST ACTION, before the base check.
HOUSEKEEPING DONE: v3.3.2 committed, v3.3.1 removed, ONE commit (4bd703f).
THE BRIEF ASSUMED ONE MARKET PARSE. THERE ARE TWO, AND THEY NEVER MATCHED:
  session restore keeps stored ids, defaults on `??`, no sign transform;
  workbook import mints ids, defaults on `||`, FORCES OUTFLOW NEGATIVE.
  Collapsing them would have been a behaviour change dressed as a refactor.
RESOLVED by naming the source: marketEventFromRow(r, 'session'|'workbook').
  Both routes call it; the divergence is now declared in ONE place.
BYTE-EQUIVALENCE PROVED, NOT ARGUED: spec:fromrow-equivalence drives the new
  seams against VERBATIM COPIES of the three pre-extraction bodies over rows
  chosen where `??` and `||` disagree — blanks, zeros, NaN, Outflow. 49/49.
  It carries a NEGATIVE CONTROL, because everything passed first run.
YIELD SPEC PROMOTED: the toRow copy is retired; spec:yield-roundtrip now
  drives the real writer AND the real reader, both directions. 35 -> 56.
PIN RE-AIMED, exact counts, sites named: App has exactly 2 marketEventFromRow
  call sites (1 session, 1 workbook) and 0 spreads; forecasting.ts has
  exactly 1 spread, inside the reader. Old anchor would have read 0.
WORKER-IMPORTABLE, CONFIRMED: no React, no DOM — and the specs importing the
  seams under plain Node ARE the proof. Not wired; that is session 2.
INERT BY DESIGN — no UI, no behaviour change. Recorded in EXPECTED.md.
GATE GREEN: guard-traps 86/86 (trap 63 re-aimed after it went INCONCLUSIVE).
```

---

## Base check

`HEAD` was **`76d2ae3`**; the brief names **`3337b46`**. Two commits apart, both
**report-only** (the fill and the ≤25-line trim). The established drift pattern,
flagged and proceeded.

## Housekeeping — done, after two sessions of flagging it

Jon placed `docs/…-v3-3-2.md` and removed `v3-3-1.md` in the working tree. Both
went into **one commit** (`4bd703f`), so the repo never held two working
agreements and never held none — which is the whole reason the previous two
sessions declined to delete the predecessor on its own.

v3.3.2 states its own provenance, and it is worth repeating here because it
governs how much weight the next session may put on it: the R4/R5-arc content is
**compiled from session reports and Jon's walks and has not been independently
re-verified**, and it recommends a verification pass before heavy reliance.

## The finding that reshaped the session

**The brief asked for one market reader. There are two market parses, and they
were never the same parse.**

| | `'session'` (App ~:975) | `'workbook'` (App ~:2016) |
|---|---|---|
| identity | `String(r.ID ?? …)` — **restores** the stored id | **always mints** a fresh one |
| defaults | `??` — falls back on null/undefined only | `\|\|` — falls back on any falsy cell |
| sign | none | **Outflow forced negative** via `-Math.abs(v)` |
| columns | `Start_Month`, `Contract_Length_Months` | also accepts `Date`, `Contract_Length` |

Each difference is correct for its input. A PROSPECT save already holds signed
quantities and real ids, and a stored `''` is a stored value. An arbitrary user
workbook has no id column, a blank cell means *unset* rather than *the empty
string*, and a human types the **size** of a loss rather than its sign.

So "make both routes call one function" and "change no behaviour" are in tension,
and the tension is real rather than a wording problem. **Resolved by making the
source an argument** — `marketEventFromRow(r, 'session' | 'workbook')`. Both
routes call one symbol, every divergence is preserved exactly, and the
differences are now declared in one place instead of being implicit in two
literals eight hundred lines apart.

That is arguably the better outcome than the brief's shape. The two parses
drifting apart is not hypothetical here: it is the **documented history of this
exact code** — the promo fields round-tripped on one route only, precisely
because the two literals were maintained separately.

## 1. `marketEventFromRow`

In `forecasting.ts`, beside `readStoredEventModifiers`. One exported function,
two private per-source field builders, and the modifier spread applied **once**:

```ts
return {
  ...(source === 'workbook' ? marketFieldsFromWorkbookRow(r) : marketFieldsFromSessionRow(r)),
  ...readStoredEventModifiers(r),
} as MarketEvent;
```

**The `isPromotion` conversion rides in with the spread**, which is the point the
true-state pass named in advance. The sheet stores the **string** `'Yes'`/`'No'`,
and only `readStoredEventModifiers` turns it into a boolean; a parse that
hand-rolled the base fields and skipped the reader would set `isPromotion` to a
truthy `'No'` and route **every** market event to the promotion summariser. Both
sources are asserted on that specific row.

**The spread moved position on the session route** — it used to sit before
`sequence` and now sits last. That is only safe if no modifier key collides with
a base key, so the spec **asserts the disjointness** rather than my having
reasoned it, and asserts specifically that `sequence` is not a modifier key.

## 2. `yieldEventFromRow`, and 3. the promotion

The yield **writer was also inline** in App, so item 3's conditional fired:
`yieldEventExportRow` was extracted first, in the same session and for the same
reason.

`spec:yield-roundtrip` previously drove a **copy** of that writer and, on the
reading side, only `readStoredRateMap` — **one field of thirteen**, with no
reader at all. It now drives the real writer and the real reader, both
directions, through a real xlsx write/read: every scalar field, `rollForward` as
a **boolean** rather than the string `'Yes'`, both JSON maps, the override map
including a stated zero, and an unset override coming back **absent rather than
empty**.

**35 → 56 checks.** Two wiring anchors that grepped App for the writer and the
reader were re-aimed: one now **calls** `yieldEventExportRow` and asks whether
the column is in the emitted row, which cannot go stale on a move; the other
follows the code to `forecasting.ts`.

## 4. Byte-equivalence — proved, not argued

`spec:fromrow-equivalence`, **49/49**. It holds **verbatim copies of the three
pre-extraction bodies** taken from App at `4bd703f` and compares them field by
field against the new seams.

**The rows are chosen where the implementations disagree**, not where they agree
— a row of ordinary populated cells passes under any implementation and proves
nothing. Blank cells, zero cells, missing columns, unparseable numbers (`NaN`
survives `??` and is replaced by `|| 0`), Outflow with positive and with
already-negative magnitudes, and both workbook column aliases.

The comparator is deliberately not `JSON.stringify`: it distinguishes an **absent
key** from a **key holding `undefined`**, because presence-as-carrier is the
convention this codebase runs on and JSON erases exactly that distinction.

**Everything passed on the first run, which is the shape a vacuous spec has**, so
the file carries a **negative control**: the comparator is pointed at a pair that
must differ (the session seam against the workbook oracle) and the check fails if
it cannot see the difference. Two further checks pin the divergences themselves —
`500` vs `-500` on sign, `''` vs `'All'` on blank-cell defaults.

**This file is designed to be retired.** It certifies one commit's worth of
equivalence against a copy of history. Once the seams move on under their own
specs — and R6 session 2 will move them — comparing against the oracles stops
meaning anything. The header says so, and says explicitly that the oracles must
never be *updated* to match a deliberate change, which would convert a proof into
a rubber stamp.

## 5. The pin re-aim

The R3-era pin asserted **exactly two `readStoredEventModifiers` spreads in
App**. After the extraction there are **zero**, so the old anchor would have gone
red — stale in the failing direction, which is the only acceptable direction.

The invariant it protects is unchanged in substance: both routes reach the
modifiers through one function, so a field added there reaches both or neither.
Only that function's location changed. Re-aimed to **exact counts, never a lower
bound**, with the sites named:

- `App.tsx` — exactly **1** `marketEventFromRow(r, 'session')` (the Market_Events
  restore) and exactly **1** `marketEventFromRow(r, 'workbook')` (the
  `eventsSheetName` import); exactly **0** spreads.
- `forecasting.ts` — exactly **1** spread, inside `marketEventFromRow`.

The two sources are counted **separately** rather than summed to two, because
they are genuinely different parses and the pin must fail if either route
silently adopts the other's rules — which a total of two would not catch.

`spec:event-roundtrip` 69 → 72.

## 6. Worker importability (report-only, not wired)

`forecasting.ts` imports `date-fns`, a **type-only** import from
`types/forecast`, and `mixConstraint` — which imports nothing. No React, no DOM,
no App. The seams are therefore importable from the worker context, where R6
session 2 will parse per-file typed events.

**The evidence is stronger than a read of the import list**: `tsx` runs the specs
in plain Node with no DOM, and `spec:fromrow-equivalence` imports both seams
directly and passes. A hidden browser dependency would have failed there.

`ParsedSession` already carries all three event arrays per file as raw rows, so
session 2's parse has both its input and its readers. Nothing was wired.

## Gate

```
fromrow-equivalence:     49 passed, 0 failed   (new)
yield-roundtrip:         56 passed, 0 failed   (was 35 — promoted)
event-roundtrip:         72 passed, 0 failed   (was 69 — pin re-aimed)
guard-traps:             86/86 caught, 0 missed, 0 inconclusive
compare-filter:          24 passed, 0 failed
scenario-pricing:        16 passed, 0 failed
active-cohort:           23 passed, 0 failed
import-seam:             36 passed, 0 failed
pricing-roundtrip:      116 passed, 0 failed
events-summary:          37 passed, 0 failed
mix-card (mounted):      99/99 passed
lint (tsc --noEmit):     clean
build:                   clean (5.87s)
```

## Where things stand

**All three carriers now have a full reader seam and a full writer seam**, and
all three round trips drive the real ones. That was the last copy.

**Nothing a user can see changed.** No UI, no behaviour — recorded in EXPECTED.md
as the deliberate shape of R6 session 1, so the split is legible to whoever picks
up session 2.

**Open:** R6 session 2 (the per-file panel, which consumes these seams); the
yield pass's private scope filter in `scenarioHelper`; `yieldArpuMode` still not
restored on reopen; full apply-path unification; and DQ, which EXPECTED.md now
records as next-no-exceptions after the Scenario Compare arc.

## Limits of this check

**Nothing is mounted, and no real workbook was loaded.** The seams are exercised
on constructed rows and, for yield, through a real xlsx write/read. That an
actual save file still restores correctly is **inferred from equivalence**, not
observed — which is a strong inference for a pure extraction and is not the same
as having opened one.

**The equivalence oracles are my transcription of the old bodies**, not a
mechanical extract. They were copied field by field from App at `4bd703f` and
they typecheck and agree with the seams on every constructed row; a
transcription error that happened to match a matching error in the seam would be
invisible to this file. Guard-trap 87 is the independent check on that, since it
mutates the seam without touching the oracle.

**Byte-equivalence is asserted over the rows listed in §4, not proved
universally.** No property-based or fuzzed input was used.

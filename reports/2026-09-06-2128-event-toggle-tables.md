# REQ-D6-01 second half — the switch in the four card tables

```
FOR ADVISOR
Generated: 2026-09-06 21:28 +0100 (UTC 2026-09-06 20:28)
Certifies: __PENDING__
Repo: __PENDING__

BASE fc718bf verified: no drift in src/ scripts/ test-data/ package.json.
ITEM 0: DUPLICATES, not a report typo. 144-147 were already in use; the four
  new traps are renumbered 166-169 and 2027's table is corrected in this commit.
ITEM 0 cause: the registry is NOT ordered by id (144-165 sit mid-file), so
  "last entry + 1" is not the next free id. spec:trap-anchors now prints it.
ITEM 0 fix: the id check was ADDED, PLANTED, AND PASSED - t.id is number AND
  description, so duplicating the number never duplicated the id. Re-aimed at
  the numeric prefix; it now goes red on a planted duplicate.
The one switch is inserted in all four card tables and both campaign pills.
PIN: exactly 5 invocations of handleSetEventEnabled - the four tables plus the
  campaign loop; the summary is handed the same function by reference.
PIN: opacity-45 is written ONCE, as OFF_ROW, shared by all five renderers.
Mounted, per tab: volume 1300->300, value BaseARPU +0.03->+0.00, pricing
  Inflow +5.00->+0.00, promotion 1300->1200; each restored exactly on re-click.
A promotion switched off on the Promotion card reads off on Volume - one field.
Campaign: 1300 -> off 1000 (both rows) -> one back on 1100, pill "mixed",
  and a click on mixed returns 1300 rather than switching the survivor off.
Traps 170-171 CAUGHT, plants verified landed and restored.
guard-traps: __/__ PENDING
full suite:  __/__ PENDING
```

## Item 0 — the trap ids

**Duplicates.** The registry's id list, printed in full, carries `144 145 146
147` twice: once mid-file, once at the end where the previous session appended.
Both copies ran in the 2027 gate and both were caught, so `165/165` was a
truthful figure — only the labels collided. The four new traps are renumbered
**166–169** and 2027's table is corrected in the same commit as this fix.

**Why it happened.** The registry is not ordered by id. Ids 144–165 sit in the
middle of the file, appended by one session before a later one inserted ahead
of them, so the bottom entry reads `143` and "last entry plus one" lands on a
number that has been in use for weeks. `spec:trap-anchors` now prints
`next free trap id: N`, computed as `max + 1`, so the guess is unnecessary.

**Why the file-wide check did not fire, and this is the part worth reading.**
It never existed. The spec has always asserted that *anchors* are unique and
never that *ids* are, and the two failures look nothing alike: a duplicated
anchor plants at the wrong line and goes red, while a duplicated id plants
perfectly and then reports under another trap's number. Nothing was ever going
to break.

It is also worse than mislabelling. `KNOWN_NON_UNIQUE` is keyed **by id**, so a
new trap reusing an exempted number would inherit an anchor-uniqueness
exemption it was never granted, and its non-unique anchor would pass silently.

**The fix had to be made to fail first.** The obvious check — count `t.id`
values — was written, planted with a duplicated number, and **passed**, because
`t.id` is the number *and* the description (`'143 Apply moves a tier the user is
holding'`), so two traps can share a number while their id strings differ. That
is exactly the shape that shipped. Re-aimed at the numeric prefix, it goes red:

```
FAIL  every trap NUMBER is unique  [143 — a duplicated number plants correctly
      and then reports under another trap's number, and inherits its
      KNOWN_NON_UNIQUE exemption]
```

A check that has not been seen red has not been seen.

## Item 1 — the four card tables

Four insertions of the one `EventOnOffSwitch`, marked `REQ-D6-01 CARD SWITCH
n of 4`, in the Volume, Value, Pricing and Promotion tables. No fifth renderer:
the duplication being paid for is the four tables', which already existed; a
fifth copy of the control would be duplication this work created.

The switch column is first in each, as on the summary table, because it decides
whether the rest of the row applies. Each table's empty-state `colSpan` moved
with it. The Value table's event is **two `<tr>`s joined by `rowSpan`**, so its
switch spans both and both carry the greying — half a greyed event reads as a
rendering fault rather than as a state.

`opacity-45` is now written **once**, as `OFF_ROW` exported beside the
component, and used by all five renderers. Five copies of a literal are five
chances to drift.

**A promotion appears in two tables**, and both switches read the one predicate
and write through the one handler. That is asserted mounted, not assumed.

## Item 2 — the campaign pill

The same edit twice, in the duplicated Volume and Promotion pill JSX. This
session does not unify them — a larger change than the one asked for — so what
is duplicated is markup, and nothing about the behaviour is.

**One control per campaign, not one per row.** The pill renders per row, so a
switch beside it unconditionally would put N identical controls and N identical
testids in the DOM for an N-row campaign. The group's first row carries it.

**Mixed is a real answer.** A campaign with one row on and one off is neither
on nor off; `campaignToggleState` returns `null`, which the switch renders as
`aria-checked="mixed"`. Drawing it as off would invite a click that silently
turned the survivor off too — so a click on mixed turns the campaign **on**.

**One write per row, through the same handler.** `updateById` patches by id
through a functional `setState`, so N calls in one tick each land on the
previous result. That is what lets a campaign be set row by row without a second
code path; a whole-array write would also clobber a concurrent edit to a sibling
the campaign does not own.

**The percentage-campaign bar is untouched.** The switch renders whether or not
the group is editable, because switching a campaign off is not editing it — and
a control the user can see but not press, with no reason given, is the D5-05
defect again.

## Item 3 — mounted, from each tab

```
  volume     1300 | Inflow+5.00 Outflow— Retention+5.00 Base+0.03
         ->   300 | Inflow+5.00 Outflow— Retention+5.00 Base+0.04
  value     1300 | … Base+0.03   ->  1300 | … Base+0.00
  pricing   1300 | Inflow+5.00 … Retention+5.00  ->  1300 | Inflow+0.00 … Retention+0.00
  promotion 1300 | …             ->  1200 | …
  campaign  1300 -> off 1000 -> one back on 1100   pill aria-checked mixed
```

Every row greyed on its card **and** on the summary simultaneously, and every
re-click restored the reading exactly.

**Two measurement errors of mine, both caught by going red rather than green.**

The summary panel is collapsed by default, so its rows are not in the DOM at
all — a "the summary row greys" check against a closed panel reads false for
the wrong reason. Opening it is fixture, not evidence.

And `impact-base-delta` is a **subscriber volume** figure. A yield or pricing
event moves ARPU and no volume, so measuring one with the other reported
"nothing happened" for a switch that worked perfectly. The instrument now reads
both, so each kind of event is measured by something it can actually move. This
is the same species as the ratio check that passed at `arpu 0`, caught from the
other direction.

### Two traps, by hand

Each planted against a pre-plant hash, landing verified before any result was
read, restored and the restoration verified.

| trap | aimed at | FAIL line |
|---|---|---|
| 170 | a card switch writes its own state | `mounted promotion: switching the row off changes the forecast [1300 … -> 1300 …]` |
| 171 | the campaign sets only its first row | `mounted: and the forecast drops both rows' contribution [1300 -> 1200 (expected -300)]` |

Trap 170 additionally trips the structural pin — `EXACTLY 5 invocations of
handleSetEventEnabled [4]` — which is the cheaper of the two reds and the one a
reader sees first.

Trap 171's other three reds are the interesting ones: the campaign reads
`mixed` when it should read fully off, and a click on that mixed state then
lands on 1200 rather than 1300. A half-applied campaign is worse than one that
does not apply, because the pill then tells the user something ambiguous
happened rather than that nothing did.

## Counts

- traps 165 → **167**; ids now asserted unique by number, next free printed
- specs **60** (unchanged — `spec:event-toggle` grew from 31 to 65 checks)
- survival recounted, not carried: __PENDING__
- TARGETS complete: both new traps mutate `WhatIfTab.tsx`, already present

## Gate

```
tsc            clean
i18n-scan      PASS
trap-anchors   179/179 (167 traps, 174 anchors, all unique)
event-toggle   65/65
survival       __PENDING__
guard-traps    __/__ PENDING
full suite     __/__ PENDING
```

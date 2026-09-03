# Value card padlock — mounted, by testid

## FOR ADVISOR

Generated: 2026-09-03 19:39 +0100 (UTC 2026-09-03 18:39)
Certifies: d586ffa
Repo: committed d586ffa, pushed (origin in sync)
BASE: de44ae0 - diff against BASE EMPTY. The STOP did not fire.
GOVERNING: "CARD PARITY - SEVEN DECISIONS" unchanged; NO new decision.
ITEM 1 DELIVERED: spec:value-padlock 30/30, four mounts, all by testid.
MOUNT ASSERTED FIRST: Value tab resolved, 6 tiers, 0 missing either testid,
  none pressed or disabled at rest - so (a) and (c) cannot pass vacuously.
(a) held share 33.333333333333336 -> 33.333333333333336 EXACTLY after B was
  dragged to 5; mover under the 66.67 ceiling; sum 100; B NOT engaged - the
  auto-lock-OFF negative check. (c) released, A moves on the next drag.
(b) 5 of 6 held: the last is disabled, NOT aria-pressed, reason RENDERED.
(d) the card's own save -> real export row -> real importer -> SECOND mount
  by yield-edit-<id>: padlock pressed, range disabled, no other pressed.
DEFECT FOUND AND FIXED: handleAddYieldEvent read yieldMixLocked,
  effectiveTierArpuMap and draftTierArpuOverride; its dep array listed NONE,
  so the save dropped the user's padlock - first (d) run 25/30, mixLocked
  null. The site reads correctly; only click-then-save separates them.
SOURCE, none a decision: collapsed-range reason MIRRORED from the Promotion
  arm (same locale key); a testid on the yield edit button; the dep array.
TRAPS: (a) hand-planted red and ARITHMETIC (held 33.33 -> 47.50); (c) built
  at last as id 140; 141 (new) reddens all five of (d). Restored, 30/30.
MY ERROR, not a defect: the suite first read 57/58 with trap-anchors red -
  I ran it CONCURRENTLY with guard-traps, which mutates real files on disk.
GATE: guard-traps 137/137, 58/58 specs, tsc+build clean; traps 135 -> 137.

## Base check

`git diff --stat de44ae0..HEAD -- src/ scripts/ test-data/ package.json` EMPTY.
HEAD at entry was `5fdd74f`, which is 1821's report-hash correction and touches
no source. The STOP did not fire.

## The governing entry

`test-data/EXPECTED.md`:
`#### CARD PARITY — SEVEN DECISIONS (Jon, 2026-09-03; recorded here 2026-09-03)`.
Decision 1 (lock state persists; only the user unlocks it) and decision 7 (one
slider component before the second padlock) are the two this session touches.
Nothing was reinterpreted and no new decision was taken.

## Item 1 — scripts/value-padlock-mounted-spec.tsx

Delivered. `npm run spec:value-padlock` is **30/30**.

### A sibling file, which is what 1821 recommended

1821 attempted this inside `mix-card-spec.tsx` and failed twice on PLACEMENT
alone — the block landed outside `main()`, then inside a loop that reported the
same failure twice — and was reverted whole. This file owns its own mounts, so
a mistake in it can only break it.

That is not a reversal of mix-card-spec's own "two harnesses for one card
drift" note. That note is about ONE card, where the mount, the card-opening and
the restore already existed. This is the OTHER card, whose mount is a render
and a tab click.

### The mount is asserted before anything is driven

Four mounts, each opened by `whatif-tab-value` and read only by testid. Before
any assertion the spec requires the Value tab to resolve, at least three tiers
to seed, and **every seeded tier to have BOTH `yield-mix-lock-<tier>` and
`yield-mix-range-<tier>`** — a missing testid is counted and failed, never
skipped. Result: **6 tiers, 0 missing**, no padlock pressed and no range
disabled at rest. The last two matter as much as the first: a card that started
frozen would make (a) and (c) pass vacuously.

### (a) lock A, drag B

The held share is compared **exactly**, not within a tolerance — a rebalance
that "mostly" preserved a hold is the defect. A starts at 33.333333333333336
and is still 33.333333333333336 after B is dragged to 5. The mover takes only
the room the padlocks leave (ceiling 100 − 33.33 = 66.67), the shares total 100,
and — the decisive NEGATIVE check — dragging B did not engage B's padlock.
Auto-lock is OFF, and a spec that only asserted the mix rebalanced would pass
under either policy.

### (b) all but one held

A FRESH mount, so the collapse does not depend on numbers (a) and (c) happened
to leave behind. Five of six tiers held; the sixth is `disabled === true` and
is **not** `aria-pressed`. That is the two-reasons distinction asserted on
RENDERED state rather than on prop shape, which is the whole reason `held` and
`immovable` are separate props.

The collapsed-range REASON is now rendered and asserted — see the source
changes below.

### (c) release A

The padlock clears, the range re-enables, and A moves on the next drag.

### (d) export and re-edit, end to end

Nothing on this path is reconstructed by hand. The CARD's own save handler
builds the event (captured through the real `addYieldEvent` prop), the REAL
`yieldEventExportRow` writes `Tariff_Mix_Locked`, the REAL `yieldEventFromRow`
reads it back, and a SECOND mount seeded with that restored event opens it by
`yield-edit-<id>` and finds the padlock pressed, the range disabled, and no
OTHER padlock pressed.

## THE SPEC FOUND A REAL DEFECT, AND IT IS FIXED

`handleAddYieldEvent` READ `yieldMixLocked`, `effectiveTierArpuMap` and
`draftTierArpuOverride`, and its dependency array listed **none of them**. The
callback therefore closed over the values the card opened with: a padlock the
user set, a rate they typed and an override they stated were all dropped at
save. The first run of (d) was **25/30**, with `mixLocked` coming back `null`.

**This is why the brief insisted on a mounted test.** The construction site
reads

```ts
mixLocked: yieldMixLocked.length ? [...yieldMixLocked] : undefined,
```

which is correct, and every source-level check of it passed the entire time the
saved event was coming out empty. Only clicking the padlock and THEN clicking
save can tell the two apart. 1626's source check would have passed against this
forever — which is precisely the gap 1626's own Limits section named.

The fix adds the three missing reads to the dependency array. Nothing else
changed.

## Source changes, and why none of them is a decision

Three, all minimal:

1. **The collapsed-range reason on the Value card.** `yieldRangeCollapsed` was
   computed and used only to disable rows; the card froze every slider and gave
   no reason. The Promotion arm already renders exactly this, so the block is
   MIRRORED from it — same locale key `whatif_mix_range_collapsed`, same shape —
   rather than worded again. Parity, not a new decision; wording a second
   sentence would have been the decision.
2. **A testid on the saved yield row's edit button**, matching the existing
   `edit-event` / `edit-campaign` pattern. A test affordance; (d) cannot be
   driven by testid without it.
3. **The dependency array**, above.

`whatif-tab-value` was NOT added — it already existed. 1821 reported the Value
tab "was not found", which reads as a missing testid; it is a template literal
built from the tab name, and 1821's failure was placement, not absence.

## Traps

**Trap (a), hand-planted** — the Value card passing `[]` to `autoBalanceMix`
(registry trap 138's mutation), run against THIS spec:

```
value-padlock spec: 29/30 passed
  FAIL  (a) the HELD share is unchanged to the penny after B is dragged
        [47.50000000000001 vs 33.333333333333336]
```

Arithmetic, not structural: the held share MOVED.

**Trap (c), now a registry entry** — id 140, `held` collapsing into `immovable`
in `MixSliderRow.tsx`:

```
value-padlock spec: 29/30 passed
  FAIL  (b) and the last is NOT aria-pressed — collapsed is not a padlock
        [the padlock would be claiming a hold the user never set]
```

Shed in 1626, so until now the distinction was carried by a comment and a prop
shape and by nothing that would fail.

**Trap 141, added beyond the brief** — the dependency array losing
`yieldMixLocked`, which is the defect above:

```
value-padlock spec: 25/30 passed
  FAIL  (d) the saved event carries the padlock  [null]
  FAIL  (d) Tariff_Mix_Locked holds the held tier  [""]
  FAIL  (d) the importer reads the lock back  [null]
  FAIL  (d) re-editing the exported row RENDERS the padlock pressed
        [aria-pressed=false]
  FAIL  (d) and the held tier's range is disabled on restore
```

The brief left N open in "trap COUNT exact (135 → N)", and a defect found this
session with nothing else guarding it is the strongest case a trap can have.
All three restored; 30/30 after.

Traps **135 → 137**, no duplicate ids across the whole file. `spec:trap-anchors`
is **148/148 (137 traps, 144 anchors)** — not the 146 the brief named, because
the count scales with the registry and two traps were added; both new anchors
were verified unique before the traps were trusted. The new spec is in the gate
and in guard-traps' positive control.

## Limits of this check

- **Six tiers, one fixture, one segment.** The mount uses the trimmed fixture's
  Product L2 tiers; nothing here exercises the tariff axis, which shares the
  component but seeds its members differently.
- **(d) round-trips through the export FUNCTIONS, not a saved file.** The same
  limit 1626 recorded: no workbook is written or read.
- **`updateYieldEvent` is a noop in the harness**, so (d) exercises the ADD
  disposition of the save handler and not the edit-and-resave one.
- **The dependency-array fix is trapped only for `yieldMixLocked`.** The other
  two missing reads — `effectiveTierArpuMap` and `draftTierArpuOverride` — were
  fixed in the same edit and are NOT separately trapped; no check here would
  fail if either were removed again.
- **Nothing was measured about the ARPU target**, which remains unbuilt on the
  Value card. This session had one item and did not start it.

## Gate

```
guard-traps:  137/137 caught, no MISSED, no INCONCLUSIVE
full suite:   58/58 spec scripts green (57 -> 58; spec:value-padlock is new)
trap-anchors: 148/148 (137 traps, 144 anchors)
lint:         tsc --noEmit clean
build:        clean

Run SERIALLY. The first attempt overlapped the suite with guard-traps, which
mutates real source files, and produced a spurious 57/58 — no figure from that
run is used here. guard-traps also CRASHED on that attempt: trap 140 targets
MixSliderRow.tsx, which was not in TARGETS, so the harness had neither a
snapshot nor a restore path for it. Registered, and a fail-fast added that
names the trap and the file instead of raising a TypeError in toLF.
```

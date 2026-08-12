# Request 2, persistence half — the carrier ships, the card is held

## FOR ADVISOR

```
PLACEHOLDER
```

---

## 0. What shipped, and what was shed

**Request 2 splits the way the mix engine did.** This session built the
**persistence half** — the carrier, the writer, the single import route, the
construction site, a writer-driven round-trip spec and a trap. **The card
surface is held.**

That is the budget clause's shed order taken one notch further than the brief
anticipated. The brief named item 3 (the `?? 0` display fixes) as the first
thing to drop; the shed needed was the whole surface. Scope went, the record did
not.

**The field is inert until the card can produce one** — nothing writes an
override yet. That is a coherent resting state, not a half-applied change: it is
exactly where `mixConstraint` sat after its own first session, and the round trip
is correct the moment an input exists.

## 1. The carrier, and why `tariffBaseArpu` could not be it

`YieldEvent.tariffBaseArpuOverride?: Record<string, number>` — **presence per
bucket is the carrier.**

Four states must stay separable: **unset** (use the derived figure), **stated**,
**stated as zero**, and **stated negative**.

- `tariffBaseArpu` cannot hold them: a derived 30 and a typed 30 are the same
  number.
- Truthiness cannot hold them: a stated `0` is falsy and legitimate — a band
  priced at nothing.

So known-ness gets its own carrier, one level down from the request-1 pattern:
there, presence of a field; here, presence of a **key**.

### `readStoredRateMap` — extended, not duplicated

The map reader **reuses `readOptionalNumber` per value** rather than restating
its conditions. That matters because the condition is fiddlier than it looks:
`Number('')` is `0`, so the emptiness test must precede the numeric one or every
blank entry reads as a deliberate zero. That logic now exists in exactly one
place for the scalar fields and the map alike.

Two absence rules follow, both asserted:

- **a corrupted entry is DROPPED, not defaulted** — it degrades to "nothing
  stated for this bucket" rather than "the user stated zero";
- **an empty map reads absent** — "a map with no members" is not the claim "no
  map", exactly as `promoMix` already has it.

### Negative, asserted on the day rather than after a rider

The spec asserts **at source** that zero sign transforms touch the field. That is
the assertion `03a08fe` added for `arpuOverride` — *after* a rider found seven of
them. Applying it to the new field on the day it was written is the cheap half of
that lesson.

## 2. The counts are pinned, not claimed

The enumeration was verified at `dae586d` and is now **pinned in the spec**:

| thing | pinned at |
|---|---|
| construction sites persisting the override | **1** |
| `addYieldEvent` callers | **1** |
| import routes reading it, through the shared reader | **1** |

Plus two wiring assertions: the export **writes** the column, and the import does
**not** hand-roll a parse beside the shared reader.

**Guard-trap 63** plants exactly that hand-rolled parse — the promo-field shape,
on the only route there is. It bit.

This is the fifth-writer lesson applied preventively rather than retrospectively:
the count is an assertion a trap can falsify, not a sentence in a commit message.

## 3. Gate

| instrument | result |
|---|---|
| `spec:yield-roundtrip` (new) | **18/18** |
| full suite | **36/36** npm scripts green |
| guard-traps | **61/61** caught — trap 63 new and CAUGHT |
| lint (`tsc --noEmit`) | exit 0 |
| build (vite) | succeeded |
| edge fixture | 74 leaves, 72 fit, 2 skipped |
| PINNED ARPU MAPEs | 13.8845 / 13.4315 / 14.3888 / 13.0192 |

All re-measured on this tree before the commit. **No earlier figure moved** —
and none could have: the engine-arithmetic sites were not touched, which is
option-(b) scope and was left alone as instructed.

No three-stage agent gate was run. There is no rendered surface in this change —
the field is unreachable from the UI — so stage 1 would have examined nothing,
and the persistence behaviour is covered directly by a writer-driven spec and a
demonstrated-red trap. **Declared rather than quietly skipped.**

§33 with the scope named: **main's working tree and build output are AI-free**
(`package.json`, `src/`, `.env`). History and remote branches are out of scope;
the preserved `ai-capability` branch is expected.

## 4. What the next session inherits

The remaining work is small and has precedent to copy rather than invent:

1. **The input**, modelled on `pct-arpu-override` on the Volume card — which
   already has all four display states, the source-named caption and the revert
   affordance, and its own mounted spec to model the new one on.
2. **The effective rate**: override-if-present else derived, by PRESENCE. The
   draft state (`draftTierArpuOverride`) exists and the construction site already
   persists it; **edit-restore already repopulates it** and needs mounting and
   verifying, not writing.
3. **The card-display absence fixes** — the four `?? 0` display sites and
   `computeTierData`'s manufactured `historicalArpu: 0`, which is *unknown* and
   should read so. The **four engine-arithmetic sites stay untouched**: they are
   option-(b) scope and moving them moves figures.
4. **A mounted spec** with the four transitions the brief lists.

## WALK INSTRUCTIONS

**There is nothing to walk yet, and that is the honest answer.** The override is
not reachable from the UI in this build — no input writes it — so a walk would
show you an unchanged Value card.

What you *can* check, if you want assurance the plumbing is real before the
surface lands: export a session, open the workbook, and confirm the
`Yield_Events` sheet now carries a **`Tariff_Base_ARPU_Override_JSON`** column.
It will be empty on every row, because nothing can populate it yet — an empty
column is the correct state, and it is the column the next session fills.

The three things your eyes will gate — a tier edit moving the blend live, "not
known" resolved by an override, and reload survival — all belong to the card
surface and arrive with it.

## Where things stand

Request 2: **persistence shipped, card held**. Request 3: designed, not built.
Option (b): queued, scoped, untouched. Request 1 and the negative-ARPU rider:
shipped and reported.

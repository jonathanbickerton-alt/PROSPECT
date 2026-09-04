# Promotion percentage — step 2, then the form; working agreement v3.3.11

## FOR ADVISOR

Generated: 2026-09-04 15:59 +0100 (UTC 2026-09-04 14:59)
Certifies: d92fdaa
Repo: committed d92fdaa, pushed (origin in sync)
BASE: 670c7c3 - diff EMPTY. STOP did not fire.
ITEM 0: v3.3.11 in, v3.3.10 deleted, same commit 1c1f224. ALL THREE CLAIMS
  MATCH: dragUnderTarget 2 callers; MixTargetPanel 2 sites; zero raw ranges.
ITEM 1(a): STEP 2 WAS NOT DONE. 2ecdefb's 'one pool arithmetic' moved the
  INFLOW pool only; promoRebanded at :1427 still read the stored scalar, as
  the entry itself said.
STOP DID NOT FIRE, on a distinction the entry did not draw: REVENUE is a
  magnitude and cannot survive a percentage (per-cent x rate, read by the pool
  as an ARPU) so it goes to 0; ARPU is a RATE and survives. draftEventRate
  already encodes this.
BY-HAND, mounted: a +10% Inflow PROMOTION moves leaf 20, All 20, disjoint 0 -
  IDENTICAL to a +10% plain event, All === leaf to the penny.
TRAP 149 red: 'FAIL promo%: REVENUE IS ZERO [200 - per-cent times a rate]'.
TRAP (b) PLANTS GREEN AND IS NOT REGISTERED: promoRebanded is a RETENTION pool
  the Inflow case never reaches. An unfireable trap is not written - SO THAT
  HALF OF STEP 2 SHIPS WITH NO MOUNTED COVERAGE. Close it first.
2 NEW KEYS, six locales, parity 194/194. Control INLINE, extraction shed and
  recorded; trap 122 went GLOBAL(2) as the new control reuses the Volume
  card's label expression. I caused mix-card 229/230 via a TEXT selector;
  repointed, 237/237.
COUNTS: traps 144->145; view-apply 56->67; anchors 156/156. GATE (serial):
  145/145, no CRASHED/MISSED/INCONCLUSIVE; 58/58 specs; tsc+build clean.

## Base check

`git diff --stat 670c7c3..HEAD -- src/ scripts/ test-data/ package.json` EMPTY.
HEAD at entry was `7d9f7a1`, the 1452 report. The STOP did not fire.

## Item 0 — docs, and three claims checked against source

`docs/PROSPECT-development-history-and-working-agreement-v3-3-11.md` committed
as supplied, unedited; v3.3.10 deleted in the same commit (`1c1f224`).

| claim | measured | verdict |
|---|---|---|
| `dragUnderTarget` has exactly 2 callers | `WhatIfTab.tsx:2127`, `:2317` | **MATCH** |
| `MixTargetPanel` has exactly 2 call sites | 2 | **MATCH** |
| zero raw `<input type="range">` in WhatIfTab | 0 | **MATCH** |

## The governing entries

- `### Percentage on the Promotion card — declined, and the reason is the`
  `### resolution model, not the interaction count — 2026-08-02`
- `#### CARD PARITY — SEVEN DECISIONS (Jon, 2026-09-03; recorded here 2026-09-03)`

Decision 6's build status is recorded beside the 2026-08-02 entry **before any
code**, as `REOPENED 2026-09-03, BUILT 2026-09-04`, with the note that the entry
is not withdrawn: its reason was right, its order was followed, and steps 1 and
2 completing is what made step 3 reachable. The decline was never "never" — it
was "not until the resolution model can carry it".

## Item 1 — the recorded order's remaining steps, measured

### (a) The pool still read the stored scalar — step 2 was NOT done

The entry's own step 2 says *"Done for the Inflow pool; `promoRebanded` still
reads `e.subscriberVolume` directly."* That was still true at `670c7c3`:

| pool | line | size, verbatim |
|---|---|---|
| Inflow | 1379 | `Math.max(0, resolvedEventVolume(e, e.subscriberVolume * eventShare(e), computed[idx - 1]?.derivations, 'inflow'))` |
| `promoRebanded` | 1427 | `Math.max(0, e.subscriberVolume * eventShare(e))` |

`2ecdefb`'s "one pool arithmetic" moved the **Inflow** pool only. The two are
not one arithmetic and were not at that commit.

### (b) The eager sites

The 1012 line numbers have drifted; the sites are `:534` (`vol`), `:539-542`
(`baseArpu` / `finalArpu`), `:551-552` (`revenue` / `arpu`).

| baked | consumer | count |
|---|---|---|
| `revenue` | the event pool's ARPU chain, `e.revenue / e.subscriberVolume` (`:1362`); a second copy at `:1615`; `Revenue` export column | 3 |
| `arpu` | the same chain's third arm, `e.arpu > 0 ? e.arpu` (`:1363`); the `promoRebanded` pool's `arpu` (`:1421`) | 2 |
| `vol` | the pool `size` (both pools), the engine's own delta | — |

### (c) The guard

**It is not a runtime guard.** `WhatIfTab.tsx:491-498`, a doc comment on
`buildPromoEvents`, saying verbatim: *"Percentage amounts are a Volume-tab
capability and are deliberately absent here: this function never sets
amountType, so every promo row is absolute… The exclusion is a rule, not a
guard: percentage rows are also barred from campaign group-editing rather than
defensively handled there."*

## The STOP-AND-MEASURE outcome: the STOP did NOT fire

No consumer needs write-time derivation, and the reason is a distinction the
entry did not draw:

- **`revenue` is a magnitude and cannot survive** — for a percentage it would be
  per-cent × rate, and the pool's `revenue / volume` arm would read that as an
  ARPU. It goes to **0**.
- **`arpu` is a RATE and survives untouched.** The mix blend and the pricing
  delta are the same number whether the promotion moves 10 subscribers or 10 per
  cent. That is 1012's "mix and band overrides magnitude-independent", and it is
  what lets the pool price the promotion at all.

**`draftEventRate` already encodes exactly this** for plain percentage volume
events: `if (isPct) return { arpu: 0, revenue: 0 }`, and with a stated rate
`revenue: isPct ? 0 : vol * draft.arpuOverride`. Step 2 is that existing rule
applied to the promotion builder, not a new one.

## Item 2 — step 2

Two changes, both small because the machinery was already there:

1. **`buildPromoEvents`** takes `amountType`, sets it on every row, and writes
   `revenue: isPct ? 0 : vol * finalArpu` plus `percentageBasis: 'baseline'`.
   `arpu` is unchanged.
2. **The `promoRebanded` pool** takes its size from
   `resolvedEventVolume(e, e.subscriberVolume * eventShare(e), computed[idx]?.derivations, 'retention')`
   — `idx`, not `idx - 1`, because retention applies in its own month.

**The metric follows `scenario`**, so a Retention percentage promotion resolves
against the view's forecast retention for the month with no arithmetic added —
which is decision 6's stated basis, satisfied by the existing path rather than
by new code.

**Absolute promotions are unchanged by construction**: `resolvedEventVolume`
returns its second argument verbatim unless `amountType === 'percentage'`, and
`revenue` keeps its old expression on the absolute arm. `spec:mix-card` 237/237
and `spec:view-apply-mounted`'s absolute cases confirm it.

## Item 3 — the form

**The unit control is INLINE, and the extraction was shed** (first in the
order). The reason is measurable rather than a preference: the Volume card's
control has **three** arms and its own writer in `src/utils/amountControl.ts` —
`applyAmountControl` clears a churn draft, zeroes the amount and force-clears
the spread. The promotion arm has two arms and no churn, so extracting one
component means parameterising the churn arm away, which is larger than the two
buttons it replaces. **Recorded as duplication** beside 1012's "three
amount-mode controls, none shared".

That duplication showed up immediately and usefully — see trap 122 below.

**Lexical separation**, the entry's own condition (*"visually and lexically
separated well beyond a shared '%' glyph"*). The volume arm reads:

> **Volume change (% of the forecast)**
> *A share of this view's forecast for the month — acquisition for an Inflow
> promotion, retention for a Retention one. Not a price change; the promo price
> is set further down.*

The price arm is under its own checkbox far below, never adjacent. The helper
ends by naming the other control, so a user who found the wrong one is told
where the right one is.

**Two new keys**, six locales each, parity 194/194:
`whatif_promo_volume_pct_label`, `whatif_promo_volume_pct_help`.

**The guard is retired** — the doc comment now records that the exclusion was
lifted, cites the entry by heading, and states why the ARPU bake could stay.

**Export/import: SHED and reported as a gap.** The row already carries
`Amount_Type` and `Percentage_Basis` through the shared reader, so a percentage
promotion round-trips through the existing columns and old workbooks load as
absolute — but **nothing here asserts that**, and no mounted round-trip was run.

## Item 4 — the Inflow mounted case, and one trap that could not be written

Added to `spec:view-apply-mounted` on the discriminating fixture, built through
the **real** `buildPromoEvents` rather than a hand-shaped row:

```
promo%   leaf 20   All 20   disjoint 0   (plain pct leaf 20)
```

- the built row carries `amountType: 'percentage'`, `revenue === 0`,
  `arpu > 0`, and `subscriberVolume === 10` (the per cent);
- the leaf moves, **All === leaf to the penny**, a disjoint leaf does not move;
- **a +10% promotion moves the view exactly as a +10% plain event does** — 20 at
  the leaf and 20 at All, identical. That is the assertion that the promotion
  resolves through the same market-event path, which is what step 2 was for. If
  these ever diverge a second resolution model has appeared.

`spec:view-apply-mounted` 56 → **67**.

### Trap (a) — red

```
view-apply-mounted spec: 66/67 passed
  FAIL  promo%: REVENUE IS ZERO - the bake that could not survive
        [200 — per-cent times a rate, which the pool would read as an ARPU]
```

200 is 10 × 20: the per cent multiplied by the rate. Registered as **trap 149**.

### Trap (b) — planted, and NOT WRITTEN

Reverting the pool to `e.subscriberVolume * eventShare(e)` leaves the spec at
**67/67**. It plants; nothing catches it.

The reason is structural: `promoRebanded` is a **Retention** pool, and the
Inflow mounted case never reaches it. The Retention mounted case is not on the
brief's never-shed list and was not built.

**So the trap is not registered.** The standing rule is *"a trap that cannot be
planted red is not written"* — registering it would either turn the gate red or,
worse, sit in the registry looking like coverage. **The `promoRebanded` change
therefore ships with no mounted coverage**, and that is the honest state: it is
type-checked, provably a no-op for absolute events, and unexercised for the
percentage-retention path it exists for.

### Trap (c) — shed, per the order.

### Trap 122 moved to the global class

The new unit control reuses the Volume card's label expression verbatim, so trap
122's anchor became non-unique — the duplication surfacing in the registry
within minutes of being created. Its subject is "a keyed label goes back to a
literal" and both sites are instances, so it takes both (`global: 2`), with the
count asserted exact: a **third** copy of this control now fails.

## Counts

Traps **144 → 145** (149; 122 changed class, not count). No duplicate ids.
`spec:trap-anchors` **156/156 (145 traps, 152 anchors)**.
`spec:view-apply-mounted` 56 → 67; `spec:mix-card` 237 unchanged.

## Limits of this check

- **THE RETENTION ARM IS UNEXERCISED.** The `promoRebanded` pool change - the
  half of step 2 this session existed to finish - has no mounted coverage, and
  its trap plants green. Named above rather than buried; it is the first thing
  a follow-up should close.
- **No mounted mix-arm percentage case.** The Inflow case runs with the mix arm
  OFF, so "the mix splits the resolved volume, not the percent" is asserted by
  nothing here.
- **A spec regression was caused and fixed in-session.** `spec:mix-card` fell to
  229/230 when the new unit control changed the DOM under a TEXT selector
  (`closest('div').textContent` matching /volume/). Repointed at the new testid;
  237/237 restored. The card was never wrong.
- **Export/import is unasserted**, as above - the columns exist and are believed
  sufficient, but no round-trip was run for a percentage promotion.
- **The unit control is duplicated, deliberately.** Three amount-mode controls
  now exist and none is shared; trap 122's global count is the only thing that
  will notice a fourth.
- **`arpu` is still baked** for percentage promotions. That is the design - it
  is a rate - but it means a promotion's stored ARPU is a save-time figure while
  its volume is resolved per month, and nothing asserts the two stay coherent.

## Gate

```
guard-traps:  145/145 caught, 0 CRASHED, 0 MISSED, 0 INCONCLUSIVE (exit 0)
full suite:   58/58 spec scripts green
trap-anchors: 156/156 (145 traps, 152 anchors)
lint:         tsc --noEmit clean
build:        clean

Run SERIALLY. Traps 144 -> 145 (149 added; 122 changed class, not count).
view-apply-mounted 56 -> 67; mix-card 237 unchanged after its selector was
repointed; i18n-parity 194/194 with the two new keys.

THE GATE IS GREEN AND ONE THING IT DOES NOT COVER IS NAMED ABOVE: the
promoRebanded pool change has no mounted assertion, and its trap plants
green. A green gate here means "nothing regressed", not "step 2 is proven
in both halves".
```

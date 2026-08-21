# Churn ramp edit routes — D5-revised, and a decline that never fired

## FOR ADVISOR

```
Generated: 2026-08-21 13:02 +0100 (UTC 2026-08-21 12:02)
Certifies: __HASH__
Repo: __REPO__
SKELETON FIRST. BASE: HEAD 8d6f260 vs 1200's cf4a610 — one, REPORT-ONLY.
PART 1: the pencil DOES route through handleEditStart and the gate IS there —
  but it is memoised on [setNewEvent] while READING marketEvents, and App's
  setNewEvent is a raw useState setter, stable for the component's life. Built
  ONCE over an EMPTY list, so siblings.length was always 0: THE DECLINE NEVER
  FIRED, ONCE. Born unreachable in its own commit (7330e8e), not a regression.
THE WHOLE CHAIN WAS UN-GATED, not just the onClick (walk addendum): there is NO
  downstream check — handleSaveEdit has no sibling test — so open, confirm and
  Save all committed, re-stating a member against its siblings' effects.
THE MOUNT MASKED IT, and that half matters more: the harness passed
  `setNewEvent: (e) => setEv(e)`, a fresh arrow per render, so the dep changed
  every render and the callback was rebuilt every render — green because the
  HARNESS's prop was unstable where the app's is not. RULE RECORDED: a harness
  passes props with the app's STABILITY; trap 111 needed it to work at all.
D5-REVISED RECORDED and built: churn campaigns group-edit through a dedicated
  remove-and-restate branch, so summed-|volume| derivation is never reached.
  Members decline, naming the campaign route, in six locales.
DELTA DISPLAY negated at ONE named site, storage untouched; trap 113 proves the
  LAYER by leaving the display literal GREEN while D4's pins go red.
SECOND HARNESS DEFECT: removing the bar made the campaign pencil appear and a
  title-matched selector silently switched affordance. Both now have testids.
mix-card 172->195; traps 108->110 (97 RETIRED). GATE GREEN: 110/110, 14 specs.
```

---

## Base check

`HEAD` **`8d6f260`**; the 1200 report's Repo line names **`cf4a610`**. One commit
apart, `--stat` confirms **report-only**. Within expectation, flagged and
proceeded.

## D5-revised, recorded

Written to `EXPECTED.md` before any code, dated **Jon, 2026-08-21**, superseding
decision 5 of 2026-08-20. Churn campaigns gain group edit; **the hazard that
justified the old bar does not lapse with it** — reverse-engineering a ramp from
summed `|subscriberVolume|` remains forbidden, and is avoided by never reaching
that path rather than by refusing the edit.

## 1. The live pencil — diagnosis

The brief asked three questions read-only. The answers are, in order:

**Which affordance the 2211 decline gates.** `handleEditStart` — and the pencil
**does** call it (`onClick={() => handleEditStart(event)}`). The gate is present
and correctly written:

```ts
if (event.churnMode === 'churn') {
  const siblings = marketEvents.filter(e => e.churnMode === 'churn'
    && (e.campaignName ?? '') === (event.campaignName ?? ''));
  if (siblings.length > 1) { setEditDeclineReason(t('whatif_churn_member_no_edit')); return; }
}
```

So the routing hypothesis is wrong: there is no second entry point, and the
comment's claim that this is the only place a row can be opened is true.

**Whether the pencil path ever declined — no. Not once.**

```ts
}, [setNewEvent]);        // ← the dependency array
```

The callback **reads `marketEvents`** and is memoised on `setNewEvent` alone.
In `App`, `setNewEvent` comes from `useState`, and React guarantees a state
setter stable for the component's lifetime. So `handleEditStart` is created on
the first render and **never rebuilt**, closing over `marketEvents` as it stood
then — **empty**. `siblings.length` was permanently `0`.

**Whether it regressed, and at which commit — it did not regress.** It was born
unreachable in `7330e8e`, the commit that introduced it. The 2211 report's claim
was true of the code as written and false of the code as run; that is a
different failure from a regression and is worth naming as such.

### The whole chain was un-gated, not just the pencil (walk addendum)

Jon drove member 1 of a 20pt/3mo ramp end to end after the brief: the form
opened, the confirm dialog rendered, and Save committed. That is worth
separating from the stale closure, because it is a second fact rather than a
consequence anyone should have assumed.

**There is exactly one gate on this chain, and it is the entry point.**
`handleSaveEdit` carries no sibling test, no churn-member refusal, and the
confirm dialog is keyed only on `editingEventId`. So the dead gate did not
merely let a form open — it let a member be **re-stated and written**.

And the write is wrong in a specific way: `handleSaveEdit`'s churn branch
re-states against a series excluding **`editingEventId` alone**, so the member's
siblings are still in it. The row is stated against a base its own campaign has
already moved — precisely the desync decision 2 exists to prevent, reachable end
to end for the whole life of the gate.

The single-gate design is right and stays: a downstream twin would be the
unreachable-clause shape this file already has a mutation test about. What it
requires is that the entry point actually run, which is what the dependency-array
fix restores, and what **trap 111** now holds.

**On the dialog showing zero change:** that is expected for member 1
specifically and is not evidence the save was inert. Month 1's cumulative
statement equals its single statement, and August's delta reads July's
`prevBase`, which the excluded siblings do not touch. A zero-change dialog on
member 2 or 3 would have meant something quite different.

**The walk save is now a mixed-semantics campaign** — one single-statement
member beside two cumulative ones — and is therefore **not a re-check subject**.
Recorded here so a later session does not reach for it as a fixture.

### The part that matters more: the mount reported it working

`spec:mix-card` has asserted *"a ramp MEMBER declines row-edit"* since 2211, and
it passed. It passed because the harness rendered:

```tsx
setNewEvent: (e: any) => setEv(e),      // a fresh arrow EVERY render
```

An inline arrow where the app passes a stable setter is not a cosmetic
difference. It **silently disables `useCallback` memoisation** — the dependency
changes on every render, so every callback keyed on it is rebuilt, and every
stale closure in the component is invisible.

**This codebase has now found two stale-closure defects in this one file.** The
first (`churnFold` in `handleAddMarketEvent`) the mount **caught**; the second
the mount **hid**, for this reason. The rule is recorded in EXPECTED.md: *a
mounted harness passes props with the same stability the app passes them, or it
is testing a component the app does not render.*

The harness now passes `setNewEvent: setEv` and `setMarketEvents: setEvs`
directly, and **trap 111 plants the stale array** — a trap that could not have
worked before this change.

## 2. The build

### (a) The member pencil declines

The gate was already right; the dependency array is what made it reachable. Deps
are now `[setNewEvent, marketEvents, t]` — the read-set, with a comment at the
site recording why.

The reason is revised in **six locales** to point at the group route: *"…Edit
the campaign instead."*

**On "the same sentence as the chip":** under D5-revised the campaign chip
carries **no decline reason for churn at all** — churn campaigns are editable
now, so the chip renders the affordance instead. There is no chip sentence left
to compare against. Asserting equality with an element that no longer exists
would be a vacuous check, so the spec compares the rendered member sentence
against the **i18n value itself**, read from the locale file at spec start. One
sentence, one source, and a copy change in the app cannot leave the assertion
passing against the old words.

### (b) The group affordance and its seeding

The `anyChurn` term at `:512` is **removed**. `handleEditCampaignStart` gains a
churn branch **above** the spread derivation — placement, not a downstream
guard, because reaching `volByOffset` with churn rows *is* the hazard.

Seeding reads the **stored statement**: every member row records
`churnTargetPct` as that month's cumulative reduction, so the trajectory reads
straight back in date order. A 20-point target over three months stored
6.67 / 13.33 / 20 and reopens as exactly that — **not** a linear re-derivation,
so a hand-edited 1/3/6 returns as 1/3/6. The headline target seeds from the
final cumulative figure.

The amount field is seeded to **zero, deliberately**: a delta placed in that
control is a figure the user never typed, in an input that would save it back as
a hand-stated volume.

### (c) Save re-states atomically

`handleSaveCampaign` gains a churn branch **above both** the `neg` and the
spread branch — the same placement fix B made on the add path and the edit path,
for the same reason a third time. `neg` forces an Outflow amount negative, which
is right for a typed magnitude and catastrophic for a delta whose sign carries
direction.

**The exclusion is now a set.** `churnExcludedIds` is derived — one id on a row
edit, every member on a campaign edit, none on Add — rather than tracked as
separate state, because a second source of truth about "what is being edited" is
a shape this card has already been corrected for.

Excluding only the first member would be **worse than excluding none**: months
2..n would remain in the series, so the fold would re-state against a partially
reduced base and derive a trajectory that is neither the old one nor the stated
one.

**Replacement was already atomic** and stays so — one `setMarketEvents` call
carrying survivors plus new rows, so no render shows old and new deltas
together.

### (d) Delta display

One named site, `outflowDelta`, in the events table:

```tsx
const outflowDelta = isOutflow
  ? (event.churnMode === 'churn' ? -event.subscriberVolume : event.subscriberVolume)
  : …
```

**Storage is untouched.** D4 stands: no `neg` on write, read, or edit-save, and
the specs assert stored deltas stay positive on both the add and the re-state
paths. Measured in the harness: a stored `+18,044.52` renders as `-18044.52`.

### (e) The rounded input

`value={Math.round((churnStated[i] ?? 0) * 100) / 100}`. A linear 20-point ramp
over three months is 20/3, and the field showed `6.666666666666667` — a float
artefact presented as a figure the user had stated. State keeps full precision;
the fold still divides by the exact value.

## Specs

**mix-card 172 → 195**, twenty-three new checks.

The statement is asserted as **fields, never derived deltas**: `churnTargetPct`
of 20/3, 40/3 and 20 on the stored rows, and 6.67 / 13.33 / 20 in the reopened
inputs.

**The exclusion test is a round-trip identity.** Reopening and saving an
*unchanged* statement must reproduce the stored figures **exactly** — because
the fold re-runs against a series with every member removed, which is the same
series the campaign was first stated against. If even one member were left in,
its own reduction would read as the current rate and `churnCurrentPct` would
come back lower. Asserted as literal equality on `churnCurrentPct`,
`churnPrevBase` and `subscriberVolume`, month for month — never `near(x, 0)`.

**Count guard:** the fixture inputs added here are exercised by the new checks
and by traps 111–113; no existing expectation was re-baselined by them.

### Two harness defects, both mine, both found by running it

**The delta assertion matched formatting, not the claim.** The first version
looked for a thousands-separated integer and failed against a cell reading
`-18044.52`; the harness's `formatNumber` is `toFixed(2)`. Re-aimed at sign and
magnitude, which is what the decision actually says — the string form was never
the claim.

**The edit selector became ambiguous the moment the bar was removed.** Both
pencils' titles match `/edit/i`, and once churn campaigns became group-editable
the **campaign** pencil sorted first, so a title-matched selector silently
switched which affordance the whole edit section was driving. The failure
presented as a missing "Save Changes" button; it was the campaign route
answering instead. Both controls now carry testids (`edit-event`,
`edit-campaign`) and the spec selects by them.

## Traps

**108 → 110.** One retired, three added.

**97 RETIRED.** It planted the removal of the `anyChurn` bar — now the wanted
behaviour, so it was asserting the opposite of the decision. Retired rather than
re-aimed, with a note at its former position: the property it stood for is now
held by `spec:churn-fold`'s re-aimed BAR checks and by trap 112.

**111** restores the stale dependency array. **It could not have worked before
this session** — while the harness's props were unstable the callback was
rebuilt every render and the trap would have MISSED. That is the clearest
statement of what the prop-stability fix bought.

**112** puts the campaign's own rows back into the re-state series.

**113** moves the sign flip to the **storage** path. The Δ column still reads
correctly, so the display literal stays **green**, while D4's signed-verbatim
pins go **red**. That pairing is the whole point: it distinguishes *the figure
looks right* from *the fix is on the right layer*, and only a trap that leaves
one half green can prove it.

## Gate

```
mix-card (mounted):      195/195 passed   (was 172)
guard-traps:             110/110 caught, 0 missed, 0 inconclusive     (was 108)
full suite:              fourteen specs, 0 failed
  churn-fold 56 (was 53)   amount-control 91   event-roundtrip 86
  events-summary 43   compare-render 40   compare-events-panel 71
  compare-window 45   compare-filter 24   yield-roundtrip 56
  scenario-pricing 16   active-cohort 23   import-seam 36
  pricing-roundtrip 117
lint (tsc --noEmit):     clean
build:                   clean (6.05s)
```

## Where things stand

**A churn ramp now has a working edit route, and had none before** — not because
the group bar stood, but because the member decline never fired, so the pencil
opened a partial statement in single-event semantics. Both halves are closed.

**Open:** DQ, still next per EXPECTED.md; the customer pipeline (decision 4);
the held tail on the churn ramp, awaiting Alessandro; the yield pass's private
scope filter in `scenarioHelper`.

## Limits of this check

**The mount is jsdom.** State, handlers and conditional rendering under real
props; not layout, not real event ordering, not CSS.

**The re-state is exercised on an unchanged statement.** The round-trip identity
is the sharpest available test of the exclusion, but a *changed* trajectory
saved through the group route is not separately asserted — the arithmetic is
`spec:churn-fold`'s, and the single-row edit path already proves a changed
statement moves the delta proportionally.

**The trajectory is not hand-edited in the mount.** D3 says 1/3/6 stays 1/3/6
and the seeding reads the stored fields rather than re-deriving, which is what
the spec asserts; a user typing into a per-month box and saving is not driven.

**One fixture slice, one target.** 20 points over three months on the harness's
two-leaf store. The deltas quoted (`18,044.52`-family) are this fixture's, not
Jon's walked figures.

**The un-gated chain is closed at the entry point, and only there.** I did not
drive open-confirm-save on a member after the fix to watch it refuse at each
step, because after the fix there is nothing to drive: the form never opens. The
mount asserts the decline and the absent panel; it does not assert that a
hypothetical bypass of the entry point would still be caught, because nothing
would catch it.

# R7 — the amount control becomes one exclusive tri-state, and the churn figure shows its inputs

## FOR ADVISOR

```
Generated: 2026-08-20 14:25 +0100 (UTC 2026-08-20 13:25)
Certifies: __PENDING__
Repo: __PENDING__
SKELETON CREATED AS THIS SESSION'S FIRST ACTION, before the base check.
BASE: HEAD 0240104 vs the R7 report's da92622 — one commit, --stat REPORT-ONLY.
ROOT CAUSE, ONE DEFECT NOT FOUR: the card had TWO SOURCES OF TRUTH for one
  control — amountType lit Subs/%, a boolean lit Churn — and a churn draft
  legitimately stores amountType 'absolute'. Hence both lit. The panel then
  keyed on the boolean ALONE, so it survived a scenario change. Same root.
THE INVALID STATE IS NOW UNREPRESENTABLE, not guarded: effectiveAmountControl
  never REPORTS churn off Outflow, so no render between a scenario change and
  its cleanup effect can show a churn panel on an Inflow draft.
ONE WRITER: every arm click and every scenario change goes through
  nextAmountControlState — "what happens when you leave churn" is answered
  once rather than at each place that can leave it.
RAMP NOW OPT-IN, default OFF; unchecked states a SINGLE month through the SAME
  fold as a one-month ramp — asserted with the literal (delta 2.45), because a
  special case would be a second arithmetic for one statement.
THE BREAKDOWN READS THE FOLD'S OWN OUTPUT, never a re-derivation, so the
  figure and the inputs beneath it cannot disagree. Absent with the figure.
91-CHECK TRANSITION SPEC, EXHAUSTIVE over every arm-from-arm and every
  scenario-from-control, with a postcondition sweep and a NEGATIVE CONTROL
  replicating the shipped two-flag model to prove the sweep can fail.
THESE WERE THE SOURCE-READ GAP THE R7 REPORT DECLARED. Each half was
  individually correct; only the transitions were wrong. The spec is pure and
  exhaustive for that reason — a mount was not needed to catch them.
STILL NOT MOUNTED: that the arm renders and the panel unmounts is source-read.
__GATE_PENDING__
```

---

## Base check

`HEAD` **`0240104`**; the R7 report's Repo line names **`da92622`**. One commit
apart, `--stat` confirms **report-only** (that report's own fill). Established
drift pattern, flagged and proceeded.

## What the walk found, at source

Five observations, and reading the shipped code turns them into **one root
cause plus two consequences**.

**The card kept the lit arm in two places.** `newEvent.amountType` decided
whether Subs or % was lit (`:3670`); a separate `isChurnDraft` boolean decided
whether Churn was (`:3697`). Because a churn draft legitimately stores
`amountType: 'absolute'` — churn is a way of *saying*, not an engine behaviour —
**Subs and Churn were both lit**. That is observation (b), and each half was
individually correct, which is why no source reading caught it.

**The panel keyed on the boolean alone** (`{isChurnDraft && (` at `:3732`) while
the *arm* was gated on scenario (`:3678`). So flipping IBRO type hid the arm and
**left the panel rendered** — observation (a), at the panel's own condition
rather than anywhere downstream.

**Nothing reset the control on a scenario change at all** — no handler touched
it — so there was no defined default when leaving Outflow: observation (c).

Observations (d) and (e) are independent: an untriageable figure and an
always-on ramp.

## 1. The exclusive control

`src/utils/amountControl.ts` — one stored value, one derived value, one writer.

```ts
export function effectiveAmountControl(stored, scenario): AmountControl {
  if (stored === 'churn' && !churnAvailableFor(scenario)) return 'subs';
  return stored;
}
```

**That line is load-bearing.** A stored `'churn'` on a non-Outflow draft never
*reports* as churn, so the lit arm and the panel cannot disagree with the
scenario **even for the single render between a scenario change and the effect
that cleans up after it**. The invalid combination is not guarded against; it is
not expressible in the value the UI reads.

The lit state now reads that one value. `amountType` is still written for the
engine — churn stores `'absolute'` — but it no longer decides what is lit, which
is exactly the coupling that produced the defect.

## 2. The transition

`nextAmountControlState(prev, action, scenario)` is the **only** writer. Every
arm click and every scenario change goes through it, so *"what happens when you
leave churn"* is answered **once** rather than at each of the places that can
leave it.

**Leaving Outflow → Subs, always.** Never a no-selection state, and the churn
draft — target, months, ramp flag, grid edits — is cleared with it. A reduction
stated against an Outflow rate means nothing on an Inflow event.

Three decisions inside it worth naming:

- **A scenario change that does not leave churn's domain changes nothing.**
  Switching Inflow to Retention has no bearing on subs-versus-percentage, and
  resetting there would discard a choice for no reason.
- **Re-selecting the lit arm is a no-op, not a reset.** Clicking Subs twice must
  not wipe a number the user is halfway through typing.
- **Entering churn does not clear a churn draft**; only leaving does. There is
  nothing of the previous mode inside the churn fields.

## 3. The ramp radio

Opt-in, **default off**, mirroring the volume spread's control one card-section
away. Shipped it was always-on with months defaulting to 3 — a multi-month
commitment nobody asked for, and inconsistent with the neighbouring pattern.

**Unchecked states a single month, through the same fold**:

```ts
statedReductions: churnRampOn ? churnStated.slice(0, churnMonths) : [churnTargetPct]
```

A special case would be a second arithmetic for the same statement, and the two
would drift. The spec asserts the single-month path and a one-month ramp produce
**identical** output, with the literal shown.

Toggling the radio re-prefills, so the grid never shows a distribution belonging
to the other shape.

## 4. The breakdown

One line under the current-churn figure: *`<month> outflow <n> ÷ prior-month
base <n> × 12`*.

**It reads the fold's own output** — `churnFold[0].prevBase`, and the series
outflow recovered as `targetOutflow + delta` — never a re-derivation. One series,
one place, so the figure and the inputs beneath it cannot disagree.

**Absent with the figure.** When there is no rate there are no inputs to show,
and the reason line already says why.

The walk's 118.4% at All/All/All was not necessarily wrong — it was
*uncheckable*, and a figure a user cannot check is a figure a user cannot trust.
This is also the hand-check surface the next walk needs.

## 5. The specs

`spec:amount-control` — **91 checks**, and it is **exhaustive rather than
sampled**: every arm from every arm, every scenario from every control, plus a
postcondition sweep over all transitions.

**Every defect here was a transition**, which is a function from (state, action)
to state — so it is checkable without a browser. That is why the pure module
came first: the R7 report's limits section said the card was source-read and
never mounted, and these defects are precisely that gap.

**It carries a negative control.** The shipped two-flag model is replicated and
asserted to light two arms — because a sweep that could not fail on the reported
defect would prove nothing about the fix.

`spec:churn-fold` and the rest are unchanged and still green; the single-month
literal (`delta 2.45 = 3/1200 × 980`) is hand-written like the others.

## 6. The traps

**99** removes the scenario reset — a churn draft then outlives the mode it was
stated in. **100** lets the invalid combination back into the derived value, so
the panel renders on a non-Outflow draft: this is the exclusivity itself, and
under it the state stops being unrepresentable and becomes merely unlikely.
**101** re-derives the breakdown's inputs instead of reading the fold's output —
it still prints a plausible line, which is exactly the danger.

`src/utils/amountControl.ts` was added to guard-traps' `TARGETS`, or traps 99 and
100 could not have been restored.

## Gate

```
amount-control:          91 passed, 0 failed   (new)
guard-traps:             __/__ PENDING
full suite:              __/__ PENDING
lint (tsc --noEmit):     __PENDING__
build:                   __PENDING__
```

## Where things stand

**Four walk defects closed, and the root of three of them removed rather than
patched.** The control is one value; the transitions are one function; both are
exhaustively checked.

**Open:** DQ, next per EXPECTED.md; the held tail on the churn ramp (decision 3
of the R7 build, awaiting Alessandro); the yield pass's private scope filter;
`yieldArpuMode` not restored on reopen.

## Limits of this check

**Still not mounted, and this is the honest repeat.** The transition logic is
now pure and exhaustively driven — which is what these defects needed — but that
the arm **renders** only for Outflow, that the panel **unmounts**, and that the
breakdown **appears** are source-read. A mounted harness for this card remains
the standing gap; it was not taken here because the pure spec covers every
defect the walk actually found, and a mount that only re-checked those would be
cost without coverage.

**The breakdown's outflow is recovered arithmetically** as `targetOutflow +
delta` rather than carried explicitly on the fold's output. That is exact — the
fold defines `delta = seriesOutflow − targetOutflow` — but it is a derivation of
a value the fold already had, and adding `seriesOutflow` to `ChurnFoldMonth`
would be plainer. Left as is because trap 101 pins the source either way.

**Nothing was re-walked.** These fixes address observations from Jon's 2026-08-20
walk; whether the card now behaves as intended on screen is the next walk's
question, and the breakdown exists to make that walk checkable.

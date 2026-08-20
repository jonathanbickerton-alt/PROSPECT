/**
 * R7 — THE VOLUME CARD'S AMOUNT CONTROL, as one exclusive tri-state.
 *
 * WHY THIS EXISTS. The shipped card had TWO independent sources of truth for
 * one control: `newEvent.amountType` decided whether Subs or % was lit, and a
 * separate boolean decided whether Churn was. Because a churn draft legitimately
 * stores `amountType: 'absolute'` — churn is a way of SAYING, not an engine
 * behaviour — SUBS AND CHURN WERE BOTH LIT AT ONCE. Jon's walk found it in
 * seconds; no source reading had, because each half was individually correct.
 *
 * The lesson is the shape, not the slip: a control with N arms and N-1
 * independent booleans can always represent a state the UI has no meaning for.
 * One value with one writer cannot.
 *
 * WHY A PURE MODULE. Every defect the walk found was a TRANSITION — flipping
 * IBRO type, switching arms, leaving a mode with a draft half-filled. A
 * transition is a function from (state, action) to state, so it can be
 * exhaustively checked without a browser, which is what the shipped version's
 * limits section said was missing.
 */

/** Exactly one of these is lit, always. There is no no-selection state. */
export type AmountControl = 'subs' | 'pct' | 'churn';

/** What the card must do when the control changes. */
export interface AmountControlTransition {
  control: AmountControl;
  /** What the DRAFT EVENT's amountType becomes. Churn stores 'absolute'. */
  amountType: 'absolute' | 'percentage';
  /**
   * True when the churn draft — target, months, ramp flag, grid edits — must be
   * discarded. The stale-draft rule: a figure stated in one mode does not mean
   * the same thing in another, and carrying it across is how a number the user
   * never typed ends up in a saved event.
   */
  clearChurnDraft: boolean;
  /** True when the typed amount must be zeroed: the number changes meaning. */
  clearAmount: boolean;
  /** True when the multi-month spread must be force-cleared. */
  clearSpread: boolean;
}

export type AmountControlAction =
  | { kind: 'select'; arm: AmountControl }
  | { kind: 'scenario'; scenario: string | undefined };

/** Churn is only offerable for Outflow drafts — it reduces a churn rate. */
export const churnAvailableFor = (scenario: string | undefined): boolean =>
  scenario === 'Outflow';

/**
 * THE DERIVED CONTROL — what is actually lit, given what is stored.
 *
 * This is the load-bearing line. A stored control of 'churn' on a non-Outflow
 * draft NEVER reports as churn, so the panel and the lit arm cannot disagree
 * with the scenario even for the render between a scenario change and the
 * effect that cleans up after it. The invalid combination is not guarded
 * against; it is not expressible in the value the UI reads.
 */
export function effectiveAmountControl(
  stored: AmountControl,
  scenario: string | undefined,
): AmountControl {
  if (stored === 'churn' && !churnAvailableFor(scenario)) return 'subs';
  return stored;
}

/**
 * ONE WRITER. Every arm click and every scenario change goes through here, so
 * "what happens when you leave churn" is answered once instead of at each of
 * the places that can leave it.
 */
export function nextAmountControlState(
  prev: AmountControl,
  action: AmountControlAction,
  scenario: string | undefined,
): AmountControlTransition {
  if (action.kind === 'scenario') {
    // LEAVING OUTFLOW WITH CHURN SELECTED. Default to Subs — never to nothing —
    // and discard the churn draft, because a reduction stated against an
    // Outflow rate means nothing on an Inflow event.
    if (prev === 'churn' && !churnAvailableFor(action.scenario)) {
      return {
        control: 'subs', amountType: 'absolute',
        clearChurnDraft: true, clearAmount: true, clearSpread: false,
      };
    }
    // Any other scenario change leaves the control alone: switching between
    // Inflow and Retention has no bearing on whether you are typing subs or a
    // percentage, and resetting it would discard a choice for no reason.
    return {
      control: prev, amountType: prev === 'pct' ? 'percentage' : 'absolute',
      clearChurnDraft: false, clearAmount: false, clearSpread: false,
    };
  }

  const arm = action.arm;

  // Selecting churn where it is not offered is not a state the UI can reach —
  // the arm is not rendered — and it is refused here too rather than silently
  // producing a churn control on an Inflow draft.
  if (arm === 'churn' && !churnAvailableFor(scenario)) {
    return {
      control: prev === 'churn' ? 'subs' : prev,
      amountType: prev === 'pct' ? 'percentage' : 'absolute',
      clearChurnDraft: prev === 'churn', clearAmount: false, clearSpread: false,
    };
  }

  // RE-SELECTING THE LIT ARM IS A NO-OP, not a reset. Clicking Subs twice must
  // not wipe a number the user is halfway through typing.
  if (arm === prev) {
    return {
      control: prev, amountType: prev === 'pct' ? 'percentage' : 'absolute',
      clearChurnDraft: false, clearAmount: false, clearSpread: false,
    };
  }

  return {
    control: arm,
    // CHURN STORES 'absolute'. It is a way of SAYING; the engine reads
    // amountType and must not learn that churn exists.
    amountType: arm === 'pct' ? 'percentage' : 'absolute',
    // Leaving churn discards its draft. Entering it does not need to: there is
    // nothing of the previous mode inside the churn fields.
    clearChurnDraft: prev === 'churn',
    // The number means something different under every arm.
    clearAmount: true,
    // Both % and churn replace the spread rather than configuring it — churn
    // with its own ramp control, % because a spread is hidden for percentages.
    // The percentage arm's own comment records what silence here costs.
    clearSpread: arm === 'pct' || arm === 'churn',
  };
}

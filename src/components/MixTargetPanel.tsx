import React from 'react';
import type { RangeOutcome, SolveOutcome, DragWall } from '../utils/mixConstraint';

/**
 * THE TARGET-BLEND PANEL, used by BOTH mix cards.
 *
 * Second application of decision 7 (Jon, 2026-09-03: one slider component
 * before the second padlock). The reasoning that produced MixSliderRow applies
 * unchanged here: the Promotion arm had a target block, the Value card was
 * about to get one, and writing the second one inline would have made two
 * copies of the unreachable-target rule — the rule this project is most careful
 * about, because SHOWING an unreachable target rather than clamping it is a
 * settled decision that a divergent copy could quietly undo on one card.
 *
 * WHAT IS SHARED IS THE WHOLE PANEL: the target box, Apply, the reachable-range
 * readout and the blocked message. Unlike MixSliderRow there are no per-card
 * trailing cells, because the two cards genuinely want the same control — the
 * only differences were state names and a testid prefix, which are props.
 *
 * IT COMPUTES NOTHING. `outcome` and `range` arrive already solved by
 * `solveForTarget` and `achievableTargetRange`, so this file cannot become a
 * second implementation of the arithmetic; it decides only what to draw. The
 * early return on a blocked outcome is a RENDER rule, not a clamp — the typed
 * number is never rewritten.
 */
export interface MixTargetPanelProps {
  /** `${prefix}-mix-target`, `-mix-target-apply`, `-mix-target-range`. */
  testIdPrefix: string;
  /** The RAW typed string. Blank is a real state — free sliders, no verdict. */
  value: string;
  onChange: (next: string) => void;
  onApply: () => void;
  /**
   * The typed target's outcome, or null when nothing is typed. NULL AND
   * BLOCKED ARE DIFFERENT: null is "no target, no verdict"; blocked is "a
   * target was typed and cannot be reached". Collapsing them would make an
   * empty box render as a failure.
   */
  outcome: SolveOutcome | null;
  /** The reachable interval, for the readout beside the box. */
  range: RangeOutcome;
  /** A collapsed range has its own message elsewhere; the readout is hidden. */
  rangeCollapsed: boolean;
  /**
   * Where the last drag was stopped, or null. COMPUTED BY THE CARD, drawn
   * here - this panel still decides nothing, which is the rule it was created
   * under and the reason the solver lives in the engine.
   */
  wall: DragWall | null;
  /**
   * The target and the holds leave ONE reachable mix. A different claim from
   * `wall`: the wall says a move was stopped, this says there is no move to
   * make. Rendering the wall copy here would report an interaction that never
   * happened, so the two are separate props and separate messages.
   */
  exactlyDetermined: boolean;
  t: (key: string, opts?: Record<string, unknown>) => string;
  formatNumber: (v: number) => string;
  /**
   * REQ-D6-07 clause 2 — OPT-IN, all four. The Value card types a COHORT ARPU and
   * needs its own label, its own band (cohort terms, not blend), a commit on
   * Enter/blur, and clause 11's refusals. The Promotion arm passes none of them and
   * renders exactly what it rendered before: blend semantics, unchanged.
   */
  label?: string;
  /** The band to READ OUT, when it is not the blend band `range` carries. */
  rangeOverride?: { min: number; max: number } | null;
  /** Enter and blur commit the typed figure — the D4-02 rule, where a solve is dear. */
  onCommit?: () => void;
  /** A stated refusal (clause 11), rendered in place of the blocked message. */
  refusal?: { text: string; testId: string } | null;
}

export function MixTargetPanel({
  testIdPrefix, value, onChange, onApply, outcome, range, rangeCollapsed, wall,
  exactlyDetermined,
  t, formatNumber, label, rangeOverride, onCommit, refusal,
}: MixTargetPanelProps) {
  return (
    <div className="mb-3 p-2.5 rounded-lg bg-slate-50 border border-slate-100">
      <div className="flex items-center gap-2 flex-wrap">
        <label className="text-[11px] font-semibold text-slate-600 whitespace-nowrap">
          {label ?? t('whatif_mix_target_arpu')}
        </label>
        <input
          type="number"
          step={0.01}
          value={value}
          data-testid={`${testIdPrefix}-mix-target`}
          placeholder={t('whatif_mix_target_placeholder')}
          onChange={e => onChange(e.target.value)}
          onKeyDown={e => { if (onCommit && e.key === 'Enter') { e.preventDefault(); onCommit(); } }}
          onBlur={() => { if (onCommit) onCommit(); }}
          className="w-24 text-xs font-semibold text-slate-700 text-right tabular-nums border border-slate-200 rounded px-1.5 py-1 outline-none focus:border-[#e60000] bg-white"
        />
        {/* DISABLED UNLESS THE TARGET IS REACHABLE. Apply is only ever called
            from the ok arm; the guard is here as well as in the handler so the
            control cannot offer an action that would be refused. */}
        <button
          type="button"
          disabled={outcome?.kind !== 'ok'}
          data-testid={`${testIdPrefix}-mix-target-apply`}
          onClick={onApply}
          className="px-2.5 py-1 text-[11px] font-semibold rounded-md bg-[#e60000] text-white disabled:opacity-40 disabled:cursor-not-allowed"
        >{t('whatif_mix_target_apply')}</button>
        {/* A CALLER THAT STATES ITS OWN BAND OWNS THE READOUT, null included. This
            read `rangeOverride ?? range`, so a cohort card whose cohort figure was
            unavailable (no month in the forecast, a promotion with no volume yet)
            fell back to the BLEND band and printed blend numbers under a cohort
            label — found building REQ-D6-07 clause 12. `undefined` is the only
            "not a cohort card", which is what the Promotion arm used to pass. */}
        {(() => {
          const band = rangeOverride !== undefined
            ? rangeOverride
            : (range.kind === 'ok' && !rangeCollapsed ? range.range : null);
          return band && (
            <span className="text-[11px] text-slate-500 tabular-nums"
              data-testid={`${testIdPrefix}-mix-target-range`}>
              {t('whatif_mix_reachable_range')}{' '}
              {formatNumber(band.min)} – {formatNumber(band.max)}
            </span>
          );
        })()}
      </div>

      {/* EXACTLY DETERMINED (Jon, 2026-09-04, D4-03). The sliders are
          disabled and NOT shown as held - the two-reasons rule, at a third
          site. It takes precedence over the wall message because a mix with
          no move to make cannot also have had a move stopped. */}
      {exactlyDetermined && (
        <div className="mt-2 text-[11px] text-slate-600"
          data-testid={`${testIdPrefix}-mix-determined`}>
          {t('whatif_mix_exactly_determined')}{' '}
          {range.kind === 'ok' && (
            <span className="font-semibold tabular-nums">{formatNumber(range.range.min)}</span>
          )}
        </div>
      )}

      {/* THE WALL. A drag that would leave the reachable range stops at the
          last position where the target can still be held, and says so
          (Jon, 2026-09-04, decision 2).

          THIS IS NOT THE CLAMPING THE SETTLED ENTRY FORBIDS. That rule is
          about the user's TYPED TARGET, which is never rewritten and is still
          shown when unreachable. What stops here is the SLIDER, and stopping
          it is the only way to keep the target the user asked for. */}
      {wall && !exactlyDetermined && (
        <div className="mt-2 text-[11px] text-amber-600"
          data-testid={`${testIdPrefix}-mix-wall`}>
          {t('whatif_mix_drag_wall', { share: formatNumber(wall.clampedShare) })}
        </div>
      )}

      {/* A COLLAPSED RANGE LOCKS, AND SAYS SO. Settled semantics: the control
          states the cause rather than offering movement that cannot happen.
          This is the constraints leaving one value, NOT auto-lock — auto-lock
          is OFF. It lives here because it is the RANGE's message, and the range
          readout it replaces is two lines above; the Value card previously
          carried a separate copy, now retired in favour of this one. */}
      {rangeCollapsed && range.kind === 'ok' && (
        <div className="mt-2 text-[11px] text-slate-600"
          data-testid={`${testIdPrefix}-mix-range-collapsed`}>
          {t('whatif_mix_range_collapsed')}{' '}
          <span className="font-semibold tabular-nums">{formatNumber(range.range.min)}</span>
        </div>
      )}

      {/* UNREACHABLE, SHOWN AND NEVER CLAMPED. The binding constraint is named —
          which member forms the wall and where the wall is. Moving the user's
          number to the nearest reachable one would be the tool stating
          something on their behalf. */}
      {/* CLAUSE 11: a refusal is stated, and takes the place of the blocked message —
          a target that cannot be SOLVED is a different thing from one that is out of
          range, and saying both at once would describe two failures where there is one. */}
      {refusal && (
        <div className="mt-2 text-[11px] text-amber-600" data-testid={refusal.testId}>{refusal.text}</div>
      )}
      {!refusal && outcome?.kind === 'blocked' && (
        <div className="mt-2 text-[11px] text-amber-600"
          data-testid={`${testIdPrefix}-mix-target-blocked`}>
          <span className="font-semibold">{t('whatif_mix_target_unreachable')}</span>{' '}
          {/* THE SENTENCE FOLLOWS THE UNITS. A caller that states its own band has
              stated it in COHORT terms, and "the highest blend these holds allow"
              would then name a figure in units the reader never typed. The
              Promotion arm passes no band and keeps the blend sentence, byte for
              byte — which is what its own assertion pins. */}
          {(outcome.reason === 'above-max' || outcome.reason === 'below-min')
            ? t(rangeOverride !== undefined
                  ? (outcome.reason === 'above-max' ? 'whatif_value_bound_above' : 'whatif_value_bound_below')
                  : (outcome.reason === 'above-max' ? 'whatif_mix_bound_above' : 'whatif_mix_bound_below'),
                { member: outcome.binding?.member ?? '',
                  bound: formatNumber(outcome.binding?.bound ?? 0) })
            : t('whatif_mix_target_blocked_other')}
        </div>
      )}
    </div>
  );
}

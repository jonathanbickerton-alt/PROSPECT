import React, { useEffect, useState } from 'react';

/**
 * ONE MIX SLIDER ROW, used by BOTH cards.
 *
 * Jon, 2026-09-03, decision 7: one slider component before the second padlock.
 * Until this file existed there was no slider component at all — the Promotion
 * card and the Value card each rendered a raw `<input type="range">` inline,
 * and the padlock was bolted onto one of them. Adding a second padlock to the
 * second copy would have made two copies of the padlock as well, which is the
 * shape this project has already paid for twice (the view-scope predicate, the
 * pool arithmetic).
 *
 * WHAT IS SHARED IS THE ROW'S LEFT HALF — the tier label, the range, the
 * numeric echo and the padlock. The trailing cells differ by card (the
 * Promotion arm shows a band-ARPU override; the Value card shows an effective
 * rate and its own override) and are passed as children, because they are
 * genuinely different controls rather than the same control configured twice.
 * `gridTemplateColumns` therefore comes from the caller: the component owns
 * four columns and the caller owns the rest.
 */
export interface MixSliderRowProps {
  /** The band or tariff this row states a share for. Identifier, rendered raw. */
  tier: string;
  /** The share, 0-100. */
  mixPct: number;
  /** Whether the USER has held this row. Drives the padlock's own state. */
  held: boolean;
  /**
   * Whether the row can move at all.
   *
   * IMMOVABLE FOR ONE OF TWO DISTINCT REASONS: the user held it, or the
   * constraints leave a single value. The padlock only ever reflects the
   * first — collapsing the two would make the control claim the user held
   * something they did not.
   *
   * Carried verbatim from the Promotion card, where it was written, because
   * the distinction is the whole reason the padlock and the disabled state are
   * two props rather than one.
   */
  immovable: boolean;
  onChange: (tier: string, next: number) => void;
  onToggleLock: (tier: string) => void;
  /** `${prefix}-mix-lock-${tier}` and `${prefix}-mix-range-${tier}`. */
  testIdPrefix: string;
  /** The FULL grid, including the caller's trailing columns. */
  gridTemplateColumns: string;
  /** Localised padlock title/aria: [hold, release]. */
  holdLabel: string;
  releaseLabel: string;
  /** The caller's trailing cells, rendered after the padlock. */
  children?: React.ReactNode;
}

export function MixSliderRow({
  tier, mixPct, held, immovable, onChange, onToggleLock,
  testIdPrefix, gridTemplateColumns, holdLabel, releaseLabel, children,
}: MixSliderRowProps) {
  return (
    <div className="grid gap-x-3 items-center" style={{ gridTemplateColumns }}>
      <span className="text-xs font-medium text-slate-700 truncate leading-none" title={tier}>{tier}</span>
      <input
        type="range"
        min={0}
        max={100}
        step={0.1}
        value={mixPct}
        disabled={immovable}
        data-testid={`${testIdPrefix}-mix-range-${tier}`}
        onChange={e => onChange(tier, Number(e.target.value))}
        className="w-full accent-[#e60000] h-1.5 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
      />
      {/* THE NUMERIC ECHO COMMITS ON ENTER OR BLUR, NOT ON EVERY KEYSTROKE
          (Jon, 2026-09-04, D4-02 option (a); EXPECTED.md "SUPPLEMENT: THE
          TYPED BOX, AND EXACTLY DETERMINED").

          ONE BEHAVIOUR, WITH AND WITHOUT A TARGET. The alternative was
          commit-on-keystroke when free and commit-on-Enter under a target,
          which makes the same control behave differently because of a number
          typed in a different box.

          WHY A DRAFT AT ALL. Typing "35" passes through "3". Committing each
          keystroke rebalances every other slider to a 3% mix and then again
          to 35% - and under a target the intermediate can hit the WALL and
          clamp, leaving the user at a number they never typed and never saw.
          The draft exists because the wall exists.

          The commit calls the SAME onChange a drag does, so the wall applies
          at commit exactly as at the end of a drag. */}
      <MixPctBox
        tier={tier}
        mixPct={mixPct}
        immovable={immovable}
        onCommit={onChange}
        testIdPrefix={testIdPrefix}
      />
      {/* THE PADLOCK. Manual only — clicking it is the one thing that changes
          lock state. Moving a slider does not: auto-lock is OFF, settled
          2026-08-11 and STILL OPEN as a question. `held` and `immovable` are
          separate props precisely so this button cannot start reflecting the
          collapsed-range case. */}
      <button
        type="button"
        data-testid={`${testIdPrefix}-mix-lock-${tier}`}
        aria-pressed={held}
        aria-label={held ? releaseLabel : holdLabel}
        title={held ? releaseLabel : holdLabel}
        onClick={() => onToggleLock(tier)}
        className={`justify-self-center px-1.5 py-0.5 text-[13px] leading-none rounded transition-colors ${held ? 'text-[#e60000]' : 'text-slate-300 hover:text-slate-500'}`}
      >{held ? '\u{1F512}' : '\u{1F513}'}</button>
      {children}
    </div>
  );
}

/**
 * The mix-percentage box. Local draft while focused; commits on Enter or blur;
 * Escape restores the committed value.
 *
 * A SEPARATE COMPONENT because it owns state and MixSliderRow does not - the
 * row is a pure render of what the card hands it, and putting a draft in it
 * would give every row's identity a lifetime it did not have.
 */
function MixPctBox({ tier, mixPct, immovable, onCommit, testIdPrefix }: {
  tier: string;
  mixPct: number;
  immovable: boolean;
  onCommit: (tier: string, next: number) => void;
  testIdPrefix: string;
}) {
  const committed = parseFloat(mixPct.toFixed(1));
  const [draft, setDraft] = useState<string | null>(null);
  // WHEN THE CARD MOVES THE SHARE, THE BOX FOLLOWS - unless the user is
  // mid-edit, in which case their draft is theirs until they commit or
  // cancel. Dragging the slider of a row whose box is focused is not a case
  // this needs to win: the draft is discarded on blur, which is what focus
  // leaving to grab a slider does.
  useEffect(() => { setDraft(null); }, [committed]);

  const commit = () => {
    if (draft === null) return;
    const n = Number(draft);
    setDraft(null);
    // A BLANK OR UNPARSEABLE BOX IS A CANCEL, not a zero. Committing NaN as 0
    // would silently empty a tier the user was only part-way through typing.
    if (draft.trim() === '' || !Number.isFinite(n)) return;
    onCommit(tier, n);
  };

  return (
    <input
      type="number"
      min={0}
      max={100}
      step={0.1}
      value={draft ?? String(committed)}
      disabled={immovable}
      data-testid={`${testIdPrefix}-mix-pct-${tier}`}
      onChange={e => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={e => {
        if (e.key === 'Enter') { commit(); return; }
        if (e.key === 'Escape') { setDraft(null); }
      }}
      className="w-full text-xs font-semibold text-slate-700 text-right tabular-nums border border-slate-200 rounded px-1 py-0.5 outline-none focus:border-[#e60000] bg-white disabled:bg-slate-50 disabled:text-slate-400"
    />
  );
}

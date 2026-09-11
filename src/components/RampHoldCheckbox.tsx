import React from 'react';

/**
 * REQ-D6-03 clause 10 (Jon, 2026-09-11) — THE RAMP/HOLD CONTROL, ONCE.
 *
 * Six controls across three cards — Volume spread + hold, Promotion spread +
 * hold, churn ramp + hold — and before this they were three different things:
 * two pairs of `<button type="button">` drawing a ROUND DOT, and one pair of
 * real `<input type="checkbox">`.
 *
 * WHY THE GLYPH MATTERED. A round ring with a filled centre is the visual
 * vocabulary of a RADIO GROUP, and two of them side by side in one row read as
 * a choice between the two. The controls are not a choice: clause 4 says the
 * ramp and the hold are INDEPENDENT, and ramp PLUS hold is the feature. The
 * 2059 session measured that they are genuinely independent — clicking Hold
 * leaves the ramp control, its panel and its duration value untouched — so the
 * markup was stating the opposite of the rule it implements, which is worse
 * than an inconsistency: it is a control that lies about what it does.
 *
 * WHY NOT `EventOnOffSwitch`. That is a `role="switch"` with its own on/off/
 * mixed vocabulary and an `event-on-<id>` testid scheme, built for a row of
 * events. Bending it to carry a ramp label would make one component answer two
 * unrelated questions; this is the second component, not a sixth copy.
 *
 * WHY NOT SIX INLINE COPIES. That is what produced the divergence in the first
 * place. One component means the next change to the glyph, the focus ring or
 * the hit area happens once.
 *
 * THE TESTIDS ARE THE CALLER'S. Every existing handle — `volume-hold-toggle`,
 * `promo-hold-toggle`, `churn-ramp-toggle`, `churn-hold-toggle` — is passed
 * straight through and lands on the `<input>`, which is what `.checked` is read
 * from. Renaming a public handle for tidiness is the failure session 2 paid a
 * gate run for.
 */
export interface RampHoldCheckboxProps {
  checked: boolean;
  onChange: (next: boolean) => void;
  /** The visible label — an already-translated string, never a key. */
  label: string;
  /** Lands on the `<input>`, so a spec reads `.checked` from it. */
  testId: string;
  /** Optional hover/`title` help, already translated. */
  title?: string;
}

export function RampHoldCheckbox({ checked, onChange, label, testId, title }: RampHoldCheckboxProps) {
  return (
    <label
      className="inline-flex items-center gap-2 cursor-pointer select-none"
      title={title}
    >
      <input
        type="checkbox"
        data-testid={testId}
        checked={checked}
        onChange={e => onChange(e.target.checked)}
        className="rounded border-slate-300 text-[#e60000] focus:ring-[#e60000]"
      />
      <span className="text-[11px] font-medium text-slate-600">{label}</span>
    </label>
  );
}

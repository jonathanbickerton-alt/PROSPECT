/**
 * THE ONE ON/OFF SWITCH — REQ-D6-01 (Jon, 2026-09-06, decision 2).
 *
 * ONE component, rendered on the events summary row and on each of the four
 * card tables' rows. The four tables are four separate inline row
 * implementations (recorded in the 2026-09-06 true-state, Item 3), so the
 * switch is INSERTED four times — it is not COPIED four times. The
 * duplication is the tables', which already existed; a fifth copy of the
 * control would be new duplication created by this work, and that is what is
 * being avoided.
 *
 * INDEPENDENT, NOT A RADIO. Turning one event off says nothing about any
 * other, which is the whole of what was asked for: keep many events and apply
 * a subset.
 *
 * THREE STATES, and the third is real. A CAMPAIGN switch is indeterminate when
 * its rows disagree — `checked === null`. That is not "off": a campaign with
 * one row on and one off is neither, and rendering it as off would invite a
 * click that silently turned the surviving row off too.
 *
 * `role="switch"` with `aria-checked`, not a checkbox: assistive technology
 * announces on/off rather than ticked/unticked, and the indeterminate state
 * has a defined ARIA value ("mixed") which a checkbox's `indeterminate`
 * property does not expose to the accessibility tree.
 *
 * THE TERM IS "ON" / "OFF" — never "scenario", which is this application's
 * word for an IBRO term and would collide.
 */
import React from 'react';

export interface EventOnOffSwitchProps {
  /** true = on, false = off, null = indeterminate (a mixed campaign). */
  checked: boolean | null;
  onChange: (next: boolean) => void;
  /** Event or campaign identifier — the testid is `event-on-<id>`. */
  id: string;
  t: (k: string, v?: any) => string;
  /** Slightly smaller inside a dense table row. */
  dense?: boolean;
}

export function EventOnOffSwitch({ checked, onChange, id, t, dense }: EventOnOffSwitchProps) {
  const on = checked === true;
  const mixed = checked === null;
  const label = mixed ? t('whatif_event_mixed') : on ? t('whatif_event_on') : t('whatif_event_off');
  // THE ARIA TOKEN IS COMPUTED HERE, not inline in the attribute.
  //
  // `aria-checked` takes the literal 'mixed' - an ARIA token, not copy - and
  // scan-i18n treats any string literal inside a JSX expression as a rendering
  // position, so inline it reads as an untranslated user-facing string. Naming
  // it once keeps the scanner honest about real copy instead of teaching it an
  // exception, and it is clearer besides.
  const ariaChecked: boolean | 'mixed' = mixed ? 'mixed' : on;
  const w = dense ? 'w-7 h-4' : 'w-9 h-5';
  const knob = dense ? 'w-3 h-3' : 'w-4 h-4';
  return (
    <button
      type="button"
      role="switch"
      data-testid={`event-on-${id}`}
      // MIXED IS AN ARIA VALUE, not a visual state invented here.
      aria-checked={ariaChecked}
      aria-label={label}
      title={label}
      // A CLICK ON A MIXED CAMPAIGN TURNS IT ON. Off would be the destructive
      // reading of an ambiguous state, and the user can always turn it off
      // from the resulting all-on.
      onClick={(e) => { e.stopPropagation(); onChange(mixed ? true : !on); }}
      className={`relative inline-flex ${w} shrink-0 items-center rounded-full transition-colors ${
        mixed ? 'bg-amber-300' : on ? 'bg-[#e60000]' : 'bg-slate-300'
      }`}
    >
      <span
        className={`inline-block ${knob} rounded-full bg-white shadow transform transition-transform ${
          mixed ? 'translate-x-1/2' : on ? (dense ? 'translate-x-3.5' : 'translate-x-4') : 'translate-x-0.5'
        }`}
      />
    </button>
  );
}

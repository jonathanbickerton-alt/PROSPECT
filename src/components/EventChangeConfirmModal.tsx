import React from 'react';
import { AlertTriangle, Trash2 } from 'lucide-react';

/**
 * Confirmation for a market-event change that recalculates the forecast:
 * delete, edit-save, and Clear all.
 *
 * THE ONE INVARIANT WORTH STATING. The "after" figures must describe the state
 * that will actually exist once the user confirms. The way that is guaranteed
 * here is structural rather than by care: the caller supplies `nextEvents`, the
 * modal previews exactly that array, and confirming commits exactly that same
 * array. There is no second derivation of the outcome that could drift from the
 * one on screen.
 *
 * The alternative — preview a computed guess, then re-derive the change on
 * confirm — is how a confirmation dialog comes to show figures nobody ever
 * gets, and it fails silently because both halves look right in isolation.
 */
export interface ChangeSummary {
  /** Last forecast month's totals, before and after the pending change. */
  month: string;
  before: { inflow: number; outflow: number; retention: number; base: number };
  after: { inflow: number; outflow: number; retention: number; base: number };
  /** Cohort-months where an event would drive a metric below zero. */
  floorWarnings: Array<{ month: string; metrics: string[] }>;
}

interface Props {
  kind: 'delete' | 'edit' | 'clear';
  /** How many events the change affects — 1 for delete/edit, all for clear. */
  affectedCount: number;
  summary: ChangeSummary | null;
  formatNumber: (v: any) => string;
  onConfirm: () => void;
  onCancel: () => void;
}

const TITLES: Record<Props['kind'], string> = {
  delete: 'Delete this event?',
  edit: 'Save these changes?',
  clear: 'Clear all market events?',
};

const BLURBS: Record<Props['kind'], string> = {
  delete: 'The forecast will be recalculated without this event.',
  edit: 'The forecast will be recalculated with the edited event.',
  clear: 'Every market event will be removed and the forecast returned to baseline.',
};

export const EventChangeConfirmModal: React.FC<Props> = ({
  kind, affectedCount, summary, formatNumber, onConfirm, onCancel,
}) => {
  const rows: Array<{ label: string; key: 'inflow' | 'outflow' | 'retention' | 'base' }> = [
    { label: 'Inflow', key: 'inflow' },
    { label: 'Outflow', key: 'outflow' },
    { label: 'Retention', key: 'retention' },
    { label: 'Base', key: 'base' },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 flex items-start gap-3">
          <div className={`mt-0.5 shrink-0 ${kind === 'clear' ? 'text-[#e60000]' : 'text-amber-500'}`}>
            {kind === 'clear' ? <Trash2 size={18} /> : <AlertTriangle size={18} />}
          </div>
          <div>
            <h3 className="text-base font-semibold text-slate-800">{TITLES[kind]}</h3>
            <p className="text-xs text-slate-500 mt-0.5">
              {BLURBS[kind]}
              {kind === 'clear' && affectedCount > 0 && ` ${affectedCount} event${affectedCount === 1 ? '' : 's'}.`}
            </p>
          </div>
        </div>

        <div className="px-6 py-4">
          {summary ? (
            <>
              <div className="text-[11px] uppercase tracking-wide text-slate-400 mb-2">
                {summary.month}
              </div>
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-slate-400 text-xs">
                    <th className="text-left font-medium pb-1.5" />
                    <th className="text-right font-medium pb-1.5">Now</th>
                    <th className="text-right font-medium pb-1.5">After</th>
                    <th className="text-right font-medium pb-1.5">Change</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {rows.map(({ label, key }) => {
                    const b = summary.before[key];
                    const a = summary.after[key];
                    const d = a - b;
                    const moved = Math.abs(d) > 0.5;
                    return (
                      <tr key={key}>
                        <td className="py-1.5 text-slate-600">{label}</td>
                        <td className="py-1.5 text-right tabular-nums text-slate-500">{formatNumber(b)}</td>
                        <td className="py-1.5 text-right tabular-nums text-slate-800 font-medium">{formatNumber(a)}</td>
                        <td className={`py-1.5 text-right tabular-nums ${
                          !moved ? 'text-slate-300' : d > 0 ? 'text-emerald-600' : 'text-[#e60000]'
                        }`}>
                          {moved ? (d > 0 ? '+' : '') + formatNumber(d) : '—'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>

              {summary.floorWarnings.length > 0 && (
                <div className="mt-3 rounded-lg bg-amber-50 border border-amber-200 px-3 py-2">
                  <div className="flex items-center gap-1.5 text-amber-700 text-xs font-medium">
                    <AlertTriangle size={12} />
                    Floored at zero after this change
                  </div>
                  <ul className="mt-1 text-[11px] text-amber-700/80 space-y-0.5">
                    {summary.floorWarnings.slice(0, 4).map(w => (
                      <li key={w.month}>{w.month} — {w.metrics.join(', ')}</li>
                    ))}
                    {summary.floorWarnings.length > 4 && (
                      <li>and {summary.floorWarnings.length - 4} more</li>
                    )}
                  </ul>
                </div>
              )}
            </>
          ) : (
            <p className="text-sm text-slate-400 italic">
              No baseline forecast loaded, so there is nothing to recalculate.
            </p>
          )}
        </div>

        <div className="px-6 py-3 bg-slate-50 flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="px-3.5 py-1.5 text-sm rounded-lg border border-slate-200 text-slate-600 hover:bg-white transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="px-3.5 py-1.5 text-sm rounded-lg bg-[#e60000] text-white font-medium hover:bg-[#cc0000] transition-colors"
          >
            {kind === 'clear' ? 'Clear all' : kind === 'delete' ? 'Delete' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
};

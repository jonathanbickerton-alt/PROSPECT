import { ChevronDown } from 'lucide-react';
import type { EventSummaryRow, SummaryT } from '../utils/forecasting';

/**
 * THE R4 EVENTS SUMMARY, as one component with two callers.
 *
 * Extracted 2026-08-19 for R6 session 2. Scenario Compare needs this table once
 * per loaded file, and the alternative was a second copy of the markup — the
 * fifth-writer failure mode this programme has already paid for twice, applied
 * to a render instead of a writer. A copied table drifts the same way a copied
 * row literal does, and drifts more quietly, because two tables that look alike
 * on screen are not compared by anyone.
 *
 * WHAT IT OWNS, and what it deliberately does not:
 *
 *  - It RENDERS rows. It does not build them. `buildEventsSummaryRows` is the
 *    one builder, it already sorts into pipeline order, and it already routes
 *    a market event to the promotion or the volume summariser by `isPromotion`.
 *    Every cell here comes from a summariser reading the event's stored fields;
 *    NOTHING in this file recomputes what an event does.
 *  - THE ORDER IS STATED IN WORDS, not left to be inferred from row sequence.
 *    A reader who assumes chronology would be wrong, and the table cannot show
 *    chronology because no cross-carrier creation order exists to show.
 *  - A MISSING NAME IS FLAGGED BY PRESENCE — the `unnamed` flag drives italic
 *    muted styling, so a fallback label never passes as something the user
 *    typed. Absence is rendered, never blanked.
 *
 * `testIdPrefix` exists because Scenario Compare mounts several of these at
 * once and a fixed testid would address whichever happened to render first.
 * WhatIfTab keeps the original ids by defaulting to `events-summary`.
 */
export interface EventsSummaryTableProps {
  rows: EventSummaryRow[];
  t: SummaryT;
  open: boolean;
  onToggle: () => void;
  /** Header label. WhatIfTab passes the R4 title; Compare passes the file name. */
  title: string;
  testIdPrefix?: string;
  /** Compare stacks one per file and needs them visually subordinate. */
  dense?: boolean;
}

export function EventsSummaryTable({
  rows, t, open, onToggle, title, testIdPrefix = 'events-summary', dense = false,
}: EventsSummaryTableProps) {
  return (
    <div className={`bg-white rounded-2xl shadow-sm border border-slate-200 ${dense ? 'rounded-xl' : ''}`}>
      <button
        type="button"
        data-testid={`${testIdPrefix}-toggle`}
        aria-expanded={open}
        onClick={onToggle}
        className={`w-full flex items-center justify-between gap-3 text-left ${dense ? 'px-4 py-2.5' : 'px-5 py-3'}`}
      >
        <span className="flex items-center gap-2 min-w-0">
          <span className={`font-semibold text-slate-700 truncate ${dense ? 'text-xs' : 'text-sm'}`} title={title}>{title}</span>
          <span
            data-testid={`${testIdPrefix}-count`}
            className="text-[11px] font-semibold text-slate-500 bg-slate-100 rounded-full px-2 py-0.5 shrink-0"
          >{t('whatif_summary_count', { count: rows.length })}</span>
        </span>
        <ChevronDown
          size={16}
          className={`shrink-0 text-slate-400 transition-transform ${open ? 'rotate-180' : ''}`}
        />
      </button>

      {open && (
        <div className={dense ? 'px-4 pb-3' : 'px-5 pb-4'} data-testid={`${testIdPrefix}-body`}>
          {rows.length === 0 ? (
            <p className="text-xs text-slate-400 italic py-2">{t('whatif_summary_empty')}</p>
          ) : (
            <>
              {/* THE ORDER IS STATED, not left to be inferred from the row
                  sequence. A reader who assumes chronology would be wrong,
                  and the table cannot show chronology because no
                  cross-carrier creation order exists to show. */}
              <p className="text-[10px] text-slate-400 mb-2">{t('whatif_summary_order_note')}</p>
              <div className="overflow-y-auto max-h-[320px] overflow-x-auto">
                <table className="w-full text-xs text-left">
                  <thead className="text-[10px] text-slate-500 bg-slate-50 uppercase tracking-wider sticky top-0">
                    <tr>
                      <th className="px-3 py-2 font-semibold">{t('whatif_summary_col_card')}</th>
                      <th className="px-3 py-2 font-semibold">{t('whatif_summary_col_name')}</th>
                      <th className="px-3 py-2 font-semibold">{t('whatif_summary_col_adjusts')}</th>
                      <th className="px-3 py-2 font-semibold">{t('whatif_summary_col_scope')}</th>
                      <th className="px-3 py-2 font-semibold">{t('whatif_summary_col_when')}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {rows.map(r => (
                      <tr key={`${r.pass}-${r.id}`} data-testid={`${testIdPrefix}-row-${r.id}`}>
                        <td className="px-3 py-2 whitespace-nowrap">
                          <span className="inline-block px-1.5 py-0.5 rounded text-[10px] font-semibold bg-slate-100 text-slate-600">
                            {r.card}
                          </span>
                        </td>
                        <td className={`px-3 py-2 max-w-[160px] truncate ${r.unnamed ? 'italic text-slate-400' : 'text-slate-700'}`} title={r.name}>
                          {r.name}
                        </td>
                        <td className="px-3 py-2 text-slate-700 whitespace-nowrap">{r.adjusts}</td>
                        <td className="px-3 py-2 text-slate-500 max-w-[180px] truncate" title={r.scope}>{r.scope}</td>
                        <td className="px-3 py-2 text-slate-500 whitespace-nowrap tabular-nums">{r.when}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

import { useState } from 'react';
import { ChevronDown, Trash2 } from 'lucide-react';
import type { EventSummaryRow, SummaryT, EffectStatus, SummaryEntry } from '../utils/forecasting';
import { EFFECT_LABEL_KEY, INITIATIVE_EFFECT_ORDER } from '../utils/forecasting';
import { EventOnOffSwitch, OFF_ROW } from './EventOnOffSwitch';

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
  /**
   * REQ-D6-01. Absent = READ-ONLY, which is exactly Compare's case: it lists a
   * disabled event greyed (decision 4) but owns no state to change. WhatIfTab
   * passes a handler; Compare passes none, and the column renders a static
   * indicator rather than a control nobody can honour.
   */
  onSetEnabled?: (row: EventSummaryRow, next: boolean) => void;
  /**
   * D5-08 (Jon, UAT 2026-09-07). OPT-IN, and opt-in on purpose: the decision
   * is summary-panel-only, and this component is also mounted by Scenario
   * Compare, once per loaded file. Rendering the toggle unconditionally would
   * have put it on Compare's panels too — a wider change than was decided,
   * arriving silently through a shared component.
   */
  showAllToggle?: boolean;
  /**
   * D5-09. OPT-IN, for the same reason `showAllToggle` is: this component is
   * also Compare's, and Compare cannot answer the question yet (its engine
   * computes the two id sets and its flat row shape drops them). Absent = no
   * column, which is honest, rather than a column that would read "No
   * coverage" for every row because the join found nothing.
   */
  effectOf?: (row: EventSummaryRow) => EffectStatus;
  /**
   * REQ-D6-06 Item 2. OPT-IN, for the reason `showAllToggle` and `effectOf` are:
   * Compare mounts this component too, and its summary is read-only (decision
   * 5). Absent = no bin anywhere. Present, it is asked per row and answers with
   * the campaign's name, row count and the delete action for a campaign's FIRST
   * row, or null — so the table never works out for itself which rows form a
   * campaign, and the action stays the caller's one function.
   */
  onDeleteCampaign?: (row: EventSummaryRow) => { name: string; n: number; run: () => void } | null;
  /**
   * REQ-D6-07 clause 3. OPT-IN, for the reason every other opt-in here is: this
   * component is Compare's too, and Compare has no forecast to read a per-month
   * pair from. Absent = no title anywhere, which is Compare's case exactly.
   */
  adjustsTitle?: (row: EventSummaryRow) => string | null;
  /**
   * REQ-D6-08. OPT-IN, as every prop above: the What-If summary passes the
   * entries `initiativeGroups` laid out; Compare passes none and renders its rows
   * in pipeline order (clause 15). This component still BUILDS nothing — it is
   * handed the headers, and asks the caller for each header's state.
   */
  entries?: SummaryEntry[];
  /** REQ-D6-08 clause 3. A header's tri-state, from its members' rows. */
  initiativeState?: (members: EventSummaryRow[]) => boolean | null;
  /** REQ-D6-08 clause 3. Absent = no switch on the header. */
  onSetInitiativeEnabled?: (members: EventSummaryRow[], next: boolean) => void;
  /** REQ-D6-08 clause 15. Compare's read-only Initiative column. */
  showInitiativeColumn?: boolean;
}

/**
 * D5-08: above how many rows the "Show all" control appears.
 *
 * A ROW COUNT STANDING IN FOR A PIXEL CAP, and the approximation is
 * deliberate. The cap below is `max-h-[320px]` — height, not rows. A row is
 * ~32px (`px-3 py-2`, `text-xs`) under a ~30px sticky header, so about nine
 * fit; Jon reported the scrollbar at ten, which agrees.
 *
 * The exact test is `scrollHeight > clientHeight`, and it was rejected: jsdom
 * reports every element as 0×0, so an overflow-measured control could not be
 * asserted by the mounted spec at all — it would be a control whose appearing
 * and disappearing nothing could check. A deterministic threshold that a spec
 * can drive beats an exact one it cannot. The cost is that a very narrow
 * viewport could wrap cells and overflow below nine rows without the control
 * offering itself.
 */
export const SHOW_ALL_THRESHOLD = 9;

export function EventsSummaryTable({
  rows, t, open, onToggle, title, testIdPrefix = 'events-summary', dense = false,
  onSetEnabled, showAllToggle = false, effectOf, onDeleteCampaign, adjustsTitle,
  entries, initiativeState, onSetInitiativeEnabled, showInitiativeColumn = false,
}: EventsSummaryTableProps) {
  // D5-08. VIEW STATE, local to the panel: not exported, not persisted, and
  // reset on reload — a height preference is not a property of the forecast.
  const [showAll, setShowAll] = useState(false);
  // REQ-D6-08. With no entries handed in, every row is its own entry — exactly
  // the table as it was, which is Compare's case.
  const shown: SummaryEntry[] = entries ?? rows.map(row => ({ kind: 'row' as const, row }));
  // REQ-D6-08 clause 13. THE THRESHOLD COUNTS WHAT TAKES HEIGHT — every visible
  // entry, headers included — because it stands in for the panel's pixel cap.
  // The badge below still counts EVENTS (`rows.length`): a header is not one.
  const canShowAll = showAllToggle && shown.length > SHOW_ALL_THRESHOLD;
  // Columns after the switch (and effect) cells, for a header's spanning cell.
  const spanAfter = 5 + (showInitiativeColumn ? 1 : 0);
  const bodyId = `${testIdPrefix}-scroll`;
  return (
    <div className={`bg-white rounded-2xl shadow-sm border border-slate-200 ${dense ? 'rounded-xl' : ''}`}>
      {/* D5-08: the header is now a ROW holding two independent controls.
          The collapse button below is UNCHANGED apart from `w-full` becoming
          `flex-1` so it shares the row — same testid, same aria-expanded, same
          chevron, same handler. The decision says the chevron is unchanged and
          separate, and a nested <button> would have been invalid markup and
          would have collapsed the panel on every "Show all" click. */}
      <div className="w-full flex items-center gap-2">
        <button
          type="button"
          data-testid={`${testIdPrefix}-toggle`}
          aria-expanded={open}
          onClick={onToggle}
          className={`flex-1 min-w-0 flex items-center justify-between gap-3 text-left ${dense ? 'px-4 py-2.5' : 'px-5 py-3'}`}
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
        {/* Only while the panel is OPEN: a height control on a collapsed panel
            governs nothing the user can see, and would read as a second way to
            expand it. */}
        {open && canShowAll && (
          <button
            type="button"
            data-testid={`${testIdPrefix}-show-all`}
            aria-expanded={showAll}
            aria-controls={bodyId}
            onClick={() => setShowAll(v => !v)}
            className={`shrink-0 text-[11px] font-semibold text-[#e60000] hover:underline ${dense ? 'pr-4' : 'pr-5'}`}
          >
            {showAll ? t('whatif_summary_show_fewer') : t('whatif_summary_show_all')}
          </button>
        )}
      </div>

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
              {/* D5-08: the cap comes OFF when "Show all" is on, so every row
                  is visible and the PAGE scrolls instead of the panel. The
                  horizontal scroll stays either way — it is what keeps a wide
                  table from forcing the whole page sideways. */}
              <div
                id={bodyId}
                data-testid={bodyId}
                className={showAll ? 'overflow-x-auto' : 'overflow-y-auto max-h-[320px] overflow-x-auto'}
              >
                <table className="w-full text-xs text-left">
                  <thead className="text-[10px] text-slate-500 bg-slate-50 uppercase tracking-wider sticky top-0">
                    <tr>
                      {/* REQ-D6-01: the switch column comes FIRST, because it
                          decides whether the rest of the row applies at all. */}
                      <th className="px-3 py-2 font-semibold w-8" />
                      {/* D5-09: EFFECT sits after the switch and before CARD —
                          what the row is DOING reads before what kind of thing
                          it is. Rendered only when the caller supplies the
                          predicate; see `effectOf`. */}
                      {effectOf && (
                        <th className="px-3 py-2 font-semibold">{t('whatif_summary_col_effect')}</th>
                      )}
                      <th className="px-3 py-2 font-semibold">{t('whatif_summary_col_card')}</th>
                      <th className="px-3 py-2 font-semibold">{t('whatif_summary_col_name')}</th>
                      {showInitiativeColumn && (
                        <th className="px-3 py-2 font-semibold">{t('whatif_summary_col_initiative')}</th>
                      )}
                      <th className="px-3 py-2 font-semibold">{t('whatif_summary_col_adjusts')}</th>
                      <th className="px-3 py-2 font-semibold">{t('whatif_summary_col_scope')}</th>
                      <th className="px-3 py-2 font-semibold">{t('whatif_summary_col_when')}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {shown.map(entry => entry.kind === 'header' ? (() => {
                      // REQ-D6-08 — THE INITIATIVE HEADER: name, event count, the
                      // tri-state switch over its members, and the members' EFFECT
                      // states counted. No bin, no controls: session 2.
                      const members = entry.members;
                      const state = initiativeState ? initiativeState(members) : null;
                      const effectParts = effectOf
                        ? INITIATIVE_EFFECT_ORDER
                            .map(st => [st, members.filter(m => effectOf(m) === st).length] as const)
                            .filter(([, n]) => n > 0)
                            .map(([st, n]) => `${t(EFFECT_LABEL_KEY[st])} ×${n}`)
                            .join(' · ')
                        : '';
                      return (
                        <tr key={`initiative-${entry.name}`}
                            data-testid={`${testIdPrefix}-initiative-${entry.name}`}
                            className="bg-slate-50/70">
                          <td className="px-3 py-2">
                            {onSetInitiativeEnabled && (
                              <EventOnOffSwitch
                                id={`initiative-${entry.name}`}
                                checked={state}
                                onChange={(next) => onSetInitiativeEnabled(members, next)}
                                t={t as any}
                                dense
                              />
                            )}
                          </td>
                          {effectOf && (
                            <td className="px-3 py-2 whitespace-nowrap text-[10px] font-semibold text-slate-500"
                                data-testid={`${testIdPrefix}-initiative-effect-${entry.name}`}>
                              {effectParts}
                            </td>
                          )}
                          <td colSpan={spanAfter} className="px-3 py-2">
                            <span className="inline-block px-1.5 py-0.5 rounded text-[10px] font-semibold bg-slate-200 text-slate-700 mr-2">
                              {t('whatif_summary_col_initiative')}
                            </span>
                            <span className="font-semibold text-slate-800"
                                  data-testid={`${testIdPrefix}-initiative-name-${entry.name}`}>{entry.name}</span>
                            <span className="ml-2 text-[11px] text-slate-500"
                                  data-testid={`${testIdPrefix}-initiative-count-${entry.name}`}>
                              {t('whatif_summary_count', { count: members.length })}
                            </span>
                          </td>
                        </tr>
                      );
                    })() : (() => { const r = entry.row; return (
                      // OFF ROWS ARE GREYED, NOT HIDDEN (decision 4). One class,
                      // applied to the row, so a reader can see at a glance which
                      // events are in play without losing the ones that are not.
                      <tr key={`${r.pass}-${r.id}`} data-testid={`${testIdPrefix}-row-${r.id}`}
                          className={r.enabled ? '' : OFF_ROW}>
                        <td className="px-3 py-2">
                          {onSetEnabled ? (
                            <EventOnOffSwitch
                              id={r.id}
                              checked={r.enabled}
                              onChange={(next) => onSetEnabled(r, next)}
                              t={t as any}
                              dense
                            />
                          ) : (
                            <span
                              data-testid={`event-state-${r.id}`}
                              className={`inline-block w-2 h-2 rounded-full ${
                                r.enabled ? 'bg-[#e60000]' : 'bg-slate-300'}`}
                              title={r.enabled ? t('whatif_event_on') : t('whatif_event_off')}
                            />
                          )}
                          {(() => {
                            // REQ-D6-06 — beside the switch, on a campaign's first row, and only
                            // when the caller opted in.
                            const bin = onDeleteCampaign ? onDeleteCampaign(r) : null;
                            return bin ? (
                              <button
                                type="button"
                                data-testid={`${testIdPrefix}-campaign-delete-${r.id}`}
                                data-campaign={bin.name}
                                onClick={bin.run}
                                className="align-middle ml-1 p-0.5 rounded text-rose-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                                title={t('whatif_delete_campaign_bin', { name: bin.name, n: bin.n })}
                                aria-label={t('whatif_delete_campaign_bin', { name: bin.name, n: bin.n })}
                              >
                                <Trash2 size={12} />
                              </button>
                            ) : null;
                          })()}
                        </td>
                        {/* D5-09. ONE label component, one keyed string per
                            status, both from EFFECT_LABEL_KEY — so the four
                            labels cannot drift between this panel and any
                            other caller that opts in. */}
                        {effectOf && (() => {
                          const st: EffectStatus = effectOf(r);
                          return (
                            <td className="px-3 py-2 whitespace-nowrap">
                              <span
                                data-testid={`event-effect-${r.id}`}
                                data-effect={st}
                                className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-semibold ${
                                  st === 'volume' ? 'bg-emerald-50 text-emerald-700'
                                  : st === 'arpu' ? 'bg-cyan-50 text-cyan-700'
                                  : st === 'no-coverage' ? 'bg-amber-50 text-amber-700'
                                  // D5-09B. Superseded reads like off, not
                                  // like a warning: the event is fine, another
                                  // one simply won its month.
                                  : st === 'superseded' ? 'bg-slate-100 text-slate-500'
                                  : 'bg-slate-100 text-slate-500'}`}
                              >{t(EFFECT_LABEL_KEY[st])}</span>
                            </td>
                          );
                        })()}
                        <td className="px-3 py-2 whitespace-nowrap">
                          <span className="inline-block px-1.5 py-0.5 rounded text-[10px] font-semibold bg-slate-100 text-slate-600">
                            {r.card}
                          </span>
                        </td>
                        <td className={`px-3 py-2 max-w-[160px] truncate ${r.unnamed ? 'italic text-slate-400' : 'text-slate-700'}`} title={r.name}>
                          {r.name}
                        </td>
                        {showInitiativeColumn && (
                          <td className="px-3 py-2 text-slate-600 max-w-[140px] truncate"
                              data-testid={`${testIdPrefix}-initiative-cell-${r.id}`}
                              title={r.initiative ?? ''}>{r.initiative ?? ''}</td>
                        )}
                        <td className="px-3 py-2 text-slate-700 whitespace-nowrap"
                            data-testid={`${testIdPrefix}-adjusts-${r.id}`}
                            title={adjustsTitle ? (adjustsTitle(r) ?? undefined) : undefined}>{r.adjusts}</td>
                        <td className="px-3 py-2 text-slate-500 max-w-[180px] truncate" title={r.scope}>{r.scope}</td>
                        <td className="px-3 py-2 text-slate-500 whitespace-nowrap tabular-nums">{r.when}</td>
                      </tr>
                    ); })())}
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

import { useState } from 'react';
import { ChevronDown, Trash2, Pencil } from 'lucide-react';
import type { EventSummaryRow, SummaryT, EffectStatus, SummaryEntry } from '../utils/forecasting';
import { EFFECT_LABEL_KEY, INITIATIVE_EFFECT_ORDER, campaignUnit, initiativeKey } from '../utils/forecasting';
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
  /**
   * REQ-D6-08 session 2. THE CALLER'S ONE SETTER of a member set's initiative
   * ('' = none). Absent = no selection mode, no Ungroup, Dissolve or Rename —
   * Compare's case. Every control below is this function applied to rows; the
   * table decides only WHICH rows, and a campaign is always all of its rows.
   */
  onSetInitiative?: (members: EventSummaryRow[], name: string) => void;
  /** REQ-D6-08 clauses 6 and 8. The initiative bin: the caller stages its dialog. */
  onDeleteInitiative?: (name: string, members: EventSummaryRow[]) => void;
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
  onSetInitiative, onDeleteInitiative,
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

  // REQ-D6-08 session 2 — SELECTION MODE and the header controls. VIEW STATE,
  // local to the panel, as `showAll` is: a tick is not a property of the forecast.
  const [selecting, setSelecting] = useState(false);
  const [picked, setPicked] = useState<ReadonlySet<string>>(new Set());
  const [groupName, setGroupName] = useState('');
  const [renaming, setRenaming] = useState<{ from: string; to: string } | null>(null);
  const [merge, setMerge] = useState<{ into: string; members: EventSummaryRow[] } | null>(null);
  const keyOf = (r: EventSummaryRow) => `${r.pass}-${r.id}`;
  const initiativeNames = shown.flatMap(e => (e.kind === 'header' ? [e.name] : []));
  // Clause 17: a typed name IS the existing initiative whose key it shares, and
  // the EXISTING casing wins. Undefined = no such initiative.
  const existingInitiative = (typed: string) => initiativeNames.find(n => initiativeKey(n) === initiativeKey(typed));
  const membersOf = (name: string) => shown.flatMap(e => (e.kind === 'header' && e.name === name ? e.members : []));
  const pickedRows = rows.filter(r => picked.has(keyOf(r)));
  // Clause 4: A CAMPAIGN TICKS WHOLE — ticking any of its rows ticks (or unticks) all.
  const toggleTick = (r: EventSummaryRow) => {
    const unit = campaignUnit(rows, r);
    setPicked(prev => {
      const next = new Set(prev);
      const on = !prev.has(keyOf(r));
      unit.forEach(u => (on ? next.add(keyOf(u)) : next.delete(keyOf(u))));
      return next;
    });
  };
  const endSelecting = () => { setSelecting(false); setPicked(new Set()); setGroupName(''); };
  // Clauses 4 and 10: a new name creates, an existing one ADDS (no prompt), and a
  // member of another initiative MOVES — one row holds one initiative.
  const groupAs = () => {
    const name = groupName.trim();
    if (!onSetInitiative || !name || pickedRows.length === 0) return;
    onSetInitiative(pickedRows, existingInitiative(name) ?? name);
    endSelecting();
  };
  // Clause 11: trimmed; an unused name renames silently, a used one asks first.
  // Clause 17: "used" is decided by initiativeKey, and the merge goes INTO the
  // existing casing.
  const commitRename = () => {
    if (!renaming || !onSetInitiative) return;
    const to = renaming.to.trim();
    const members = membersOf(renaming.from);
    setRenaming(null);
    if (!to || members.length === 0) return;
    const into = existingInitiative(to);
    // The same initiative, retyped (in any casing): the existing casing wins, so
    // nothing changes.
    if (into === renaming.from) return;
    if (into) { setMerge({ into, members }); return; }
    onSetInitiative(members, to);
  };
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
        {open && onSetInitiative && rows.length > 0 && !selecting && (
          <button
            type="button"
            data-testid={`${testIdPrefix}-select`}
            onClick={() => setSelecting(true)}
            className={`shrink-0 text-[11px] font-semibold text-[#e60000] hover:underline ${canShowAll ? '' : (dense ? 'pr-4' : 'pr-5')}`}
          >
            {t('whatif_summary_select')}
          </button>
        )}
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
              {selecting && onSetInitiative && (
                <div data-testid={`${testIdPrefix}-selection-bar`}
                     className="mb-2 flex flex-wrap items-center gap-2 rounded-lg bg-slate-50 border border-slate-200 px-3 py-2 text-xs">
                  <span data-testid={`${testIdPrefix}-selected-count`} className="font-semibold text-slate-700">
                    {t('whatif_summary_selected', { n: pickedRows.length })}
                  </span>
                  <input
                    type="text"
                    data-testid={`${testIdPrefix}-group-name`}
                    value={groupName}
                    placeholder={t('whatif_initiative_name_placeholder')}
                    onChange={e => setGroupName(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') groupAs(); }}
                    className="text-xs border border-slate-200 rounded px-2 py-1 bg-white outline-none focus:border-[#e60000]"
                  />
                  {initiativeNames.length > 0 && (
                    <select
                      data-testid={`${testIdPrefix}-group-pick`}
                      value=""
                      onChange={e => { if (e.target.value) setGroupName(e.target.value); }}
                      className="text-xs border border-slate-200 rounded px-1 py-1 bg-white"
                    >
                      <option value="">{t('whatif_initiative_pick_existing')}</option>
                      {initiativeNames.map(n => <option key={n} value={n}>{n}</option>)}
                    </select>
                  )}
                  <button
                    type="button"
                    data-testid={`${testIdPrefix}-group-as`}
                    onClick={groupAs}
                    disabled={!groupName.trim() || pickedRows.length === 0}
                    className="px-2.5 py-1 rounded bg-[#e60000] text-white font-semibold disabled:opacity-40 disabled:cursor-not-allowed"
                  >{t('whatif_initiative_group_as')}</button>
                  <button
                    type="button"
                    data-testid={`${testIdPrefix}-select-cancel`}
                    onClick={endSelecting}
                    className="px-2.5 py-1 rounded border border-slate-200 text-slate-600 bg-white"
                  >{t('common_cancel')}</button>
                </div>
              )}
              {merge && onSetInitiative && (
                <div data-testid={`${testIdPrefix}-merge-dialog`} role="alertdialog"
                     className="mb-2 flex flex-wrap items-center gap-2 rounded-lg bg-amber-50 border border-amber-200 px-3 py-2 text-xs">
                  <span data-testid={`${testIdPrefix}-merge-title`} className="font-semibold text-amber-800">
                    {t('whatif_initiative_merge_title', { name: merge.into, n: merge.members.length })}
                  </span>
                  <button
                    type="button"
                    data-testid={`${testIdPrefix}-merge-confirm`}
                    onClick={() => { onSetInitiative(merge.members, merge.into); setMerge(null); }}
                    className="px-2.5 py-1 rounded bg-[#e60000] text-white font-semibold"
                  >{t('whatif_initiative_merge_confirm')}</button>
                  <button
                    type="button"
                    data-testid={`${testIdPrefix}-merge-cancel`}
                    onClick={() => setMerge(null)}
                    className="px-2.5 py-1 rounded border border-slate-200 text-slate-600 bg-white"
                  >{t('common_cancel')}</button>
                </div>
              )}
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
                      // tri-state switch over its members, the members' EFFECT
                      // states counted, and (session 2) Rename, Dissolve and the bin.
                      // A header has no tick: it is not an event.
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
                            {onSetInitiative && (renaming?.from === entry.name ? (
                              <span className="ml-2 inline-flex items-center gap-1">
                                <input
                                  type="text"
                                  data-testid={`${testIdPrefix}-initiative-rename-input-${entry.name}`}
                                  value={renaming.to}
                                  onChange={e => setRenaming({ from: entry.name, to: e.target.value })}
                                  onKeyDown={e => { if (e.key === 'Enter') commitRename(); if (e.key === 'Escape') setRenaming(null); }}
                                  className="text-xs border border-slate-200 rounded px-1.5 py-0.5 bg-white outline-none focus:border-[#e60000]"
                                />
                                <button type="button"
                                  data-testid={`${testIdPrefix}-initiative-rename-save-${entry.name}`}
                                  onClick={commitRename}
                                  className="text-[11px] font-semibold text-[#e60000] hover:underline"
                                >{t('whatif_initiative_rename_save')}</button>
                              </span>
                            ) : (
                              <span className="ml-3 inline-flex items-center gap-2 align-middle">
                                <button type="button"
                                  data-testid={`${testIdPrefix}-initiative-rename-${entry.name}`}
                                  onClick={() => setRenaming({ from: entry.name, to: entry.name })}
                                  title={t('whatif_initiative_rename')} aria-label={t('whatif_initiative_rename')}
                                  className="p-0.5 rounded text-slate-400 hover:text-[#e60000]"
                                ><Pencil size={12} /></button>
                                {/* Clause 4: DISSOLVE clears the grouping and nothing else — no dialog,
                                    because nothing is lost but the grouping. */}
                                <button type="button"
                                  data-testid={`${testIdPrefix}-initiative-dissolve-${entry.name}`}
                                  onClick={() => onSetInitiative(members, '')}
                                  className="text-[11px] font-semibold text-slate-500 hover:text-[#e60000] hover:underline"
                                >{t('whatif_initiative_dissolve')}</button>
                                {onDeleteInitiative && (
                                  <button type="button"
                                    data-testid={`${testIdPrefix}-initiative-delete-${entry.name}`}
                                    onClick={() => onDeleteInitiative(entry.name, members)}
                                    title={t('whatif_delete_initiative_bin', { name: entry.name, n: members.length })}
                                    aria-label={t('whatif_delete_initiative_bin', { name: entry.name, n: members.length })}
                                    className="p-0.5 rounded text-rose-400 hover:text-rose-600 hover:bg-rose-50"
                                  ><Trash2 size={12} /></button>
                                )}
                              </span>
                            ))}
                          </td>
                        </tr>
                      );
                    })() : (() => { const r = entry.row; return (
                      // OFF ROWS ARE GREYED, NOT HIDDEN (decision 4). One class,
                      // applied to the row, so a reader can see at a glance which
                      // events are in play without losing the ones that are not.
                      <tr key={`${r.pass}-${r.id}`} data-testid={`${testIdPrefix}-row-${r.id}`}
                          className={r.enabled ? '' : OFF_ROW}>
                        <td className="px-3 py-2 whitespace-nowrap">
                          {selecting && onSetInitiative && (
                            <input
                              type="checkbox"
                              data-testid={`${testIdPrefix}-tick-${r.id}`}
                              checked={picked.has(keyOf(r))}
                              onChange={() => toggleTick(r)}
                              aria-label={t('whatif_summary_tick', { name: r.name })}
                              className="align-middle mr-1.5 accent-[#e60000]"
                            />
                          )}
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
                          {/* Clause 4: UNGROUP per member — a campaign member ungroups its whole campaign. */}
                          {onSetInitiative && entries && r.initiative && !selecting && (
                            <button
                              type="button"
                              data-testid={`${testIdPrefix}-ungroup-${r.id}`}
                              onClick={() => onSetInitiative(campaignUnit(rows, r), '')}
                              className="align-middle ml-1.5 text-[10px] font-semibold text-slate-400 hover:text-[#e60000] hover:underline"
                            >{t('whatif_initiative_ungroup')}</button>
                          )}
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

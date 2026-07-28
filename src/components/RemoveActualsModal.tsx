import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { format, isValid, parseISO } from 'date-fns';
import { Trash2, ChevronDown, AlertTriangle } from 'lucide-react';

interface RemoveActualsModalProps {
  data: any[];
  wiDateCol: string;
  wiSegmentCol: string;
  wiProductCol: string;
  wiChannelCol: string;
  /** Called with a predicate to keep (not remove) and the count of removed rows. */
  onConfirm: (keepFn: (row: any) => boolean, removedCount: number) => void;
  onCancel: () => void;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function parseMonth(rawDate: any): string | null {
  if (!rawDate) return null;
  const d = rawDate instanceof Date ? rawDate : new Date(rawDate);
  if (!isValid(d)) return null;
  return format(d, 'yyyy-MM');
}

function fmtMonth(ym: string): string {
  try { return format(parseISO(ym + '-01'), 'MMM yyyy'); }
  catch { return ym; }
}

const selectCls =
  'appearance-none bg-white border border-slate-200 rounded-lg text-sm px-2.5 py-1.5 pr-7 focus:outline-none focus:border-[#e60000] cursor-pointer';

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
export const RemoveActualsModal: React.FC<RemoveActualsModalProps> = ({
  data, wiDateCol, wiSegmentCol, wiProductCol, wiChannelCol,
  onConfirm, onCancel,
}) => {
  const { t } = useTranslation();
  // ── Derive dimension lists + sorted month list from data ─────────────────
  const { months, segments, products, channels } = useMemo(() => {
    const mSet = new Set<string>();
    const sSet = new Set<string>();
    const pSet = new Set<string>();
    const cSet = new Set<string>();
    for (const row of data) {
      const m = parseMonth(row[wiDateCol]);
      if (m) mSet.add(m);
      if (wiSegmentCol) sSet.add(String(row[wiSegmentCol] || '').trim());
      if (wiProductCol) pSet.add(String(row[wiProductCol] || '').trim());
      if (wiChannelCol) cSet.add(String(row[wiChannelCol] || '').trim());
    }
    const months = [...mSet].filter(Boolean).sort();
    return {
      months,
      segments: [...sSet].filter(Boolean).sort(),
      products: [...pSet].filter(Boolean).sort(),
      channels: [...cSet].filter(Boolean).sort(),
    };
  }, [data, wiDateCol, wiSegmentCol, wiProductCol, wiChannelCol]);

  const latestMonth = months[months.length - 1] ?? '';
  const [startMonth, setStartMonth] = useState(latestMonth);
  const [endMonth,   setEndMonth]   = useState(latestMonth);
  const [segFilter,  setSegFilter]  = useState('All');
  const [prodFilter, setProdFilter] = useState('All');
  const [chanFilter, setChanFilter] = useState('All');

  // ── Matching rows ─────────────────────────────────────────────────────────
  const matchingRows = useMemo(() => {
    // Normalise range (swap if inverted)
    const lo = startMonth <= endMonth ? startMonth : endMonth;
    const hi = startMonth <= endMonth ? endMonth   : startMonth;
    return data.filter(row => {
      const m = parseMonth(row[wiDateCol]);
      if (!m || m < lo || m > hi) return false;
      if (segFilter  !== 'All' && wiSegmentCol && String(row[wiSegmentCol] || '').trim() !== segFilter)  return false;
      if (prodFilter !== 'All' && wiProductCol && String(row[wiProductCol] || '').trim() !== prodFilter) return false;
      if (chanFilter !== 'All' && wiChannelCol && String(row[wiChannelCol] || '').trim() !== chanFilter) return false;
      return true;
    });
  }, [data, wiDateCol, wiSegmentCol, wiProductCol, wiChannelCol,
      startMonth, endMonth, segFilter, prodFilter, chanFilter]);

  const removedCount = matchingRows.length;
  const isAllRemoved = removedCount === data.length && data.length > 0;

  // ── Preview: unique cohort-month combinations (max 20 shown) ─────────────
  const previewRows = useMemo(() => {
    const seen = new Set<string>();
    const rows: { month: string; seg: string; prod: string; chan: string }[] = [];
    for (const row of matchingRows) {
      const m   = parseMonth(row[wiDateCol]) ?? '';
      const seg = wiSegmentCol ? String(row[wiSegmentCol] || '').trim() : '—';
      const prod = wiProductCol ? String(row[wiProductCol] || '').trim() : '—';
      const chan = wiChannelCol ? String(row[wiChannelCol] || '').trim() : '—';
      const key = `${m}|${seg}|${prod}|${chan}`;
      if (!seen.has(key)) { seen.add(key); rows.push({ month: m, seg, prod, chan }); }
    }
    rows.sort((a, b) => a.month.localeCompare(b.month) || a.seg.localeCompare(b.seg));
    return rows;
  }, [matchingRows, wiDateCol, wiSegmentCol, wiProductCol, wiChannelCol]);

  const previewShown = previewRows.slice(0, 20);
  const previewOverflow = previewRows.length - previewShown.length;

  // ── Handle confirm ────────────────────────────────────────────────────────
  const handleConfirm = () => {
    const lo = startMonth <= endMonth ? startMonth : endMonth;
    const hi = startMonth <= endMonth ? endMonth   : startMonth;
    const keepFn = (row: any) => {
      const m = parseMonth(row[wiDateCol]);
      if (!m || m < lo || m > hi) return true;
      if (segFilter  !== 'All' && wiSegmentCol && String(row[wiSegmentCol] || '').trim() !== segFilter)  return true;
      if (prodFilter !== 'All' && wiProductCol && String(row[wiProductCol] || '').trim() !== prodFilter) return true;
      if (chanFilter !== 'All' && wiChannelCol && String(row[wiChannelCol] || '').trim() !== chanFilter) return true;
      return false;
    };
    onConfirm(keepFn, removedCount);
  };

  const showProducts = products.length > 0;
  const showChannels = channels.length > 0;

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xl flex flex-col max-h-[90vh]">

        {/* ── Header ── */}
        <div className="flex items-center gap-3 px-6 py-4 border-b border-slate-200 shrink-0">
          <div className="p-2 bg-red-50 rounded-lg">
            <Trash2 size={18} className="text-[#e60000]" />
          </div>
          <div>
            <h2 className="text-base font-bold text-slate-900">{t('common_remove_actuals')}</h2>
            <p className="text-xs text-slate-500">{t('removeactuals_select_the_period_and_cohorts_to_remove_from')}</p>
          </div>
        </div>

        {/* ── Body (scrollable) ── */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-5">

          {/* Period */}
          <section>
            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-2">{t('removeactuals_period')}</p>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-500 shrink-0">{t('removeactuals_from')}</span>
                <div className="relative">
                  <select
                    value={startMonth}
                    onChange={e => setStartMonth(e.target.value)}
                    className={selectCls}
                  >
                    {months.map(m => <option key={m} value={m}>{fmtMonth(m)}</option>)}
                  </select>
                  <ChevronDown size={11} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-500 shrink-0">{t('removeactuals_to')}</span>
                <div className="relative">
                  <select
                    value={endMonth}
                    onChange={e => setEndMonth(e.target.value)}
                    className={selectCls}
                  >
                    {months.map(m => <option key={m} value={m}>{fmtMonth(m)}</option>)}
                  </select>
                  <ChevronDown size={11} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                </div>
              </div>
            </div>
          </section>

          {/* Dimension filters */}
          <section>
            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-2">{t('removeactuals_dimension_filters')}<span className="normal-case font-normal text-slate-400">{t('removeactuals_optional_leave_all_to_match_every_cohort')}</span>
            </p>
            <div className="flex flex-wrap gap-3">
              <div className="flex items-center gap-1.5">
                <span className="text-xs text-slate-500">{t('common_segment')}</span>
                <div className="relative">
                  <select value={segFilter} onChange={e => setSegFilter(e.target.value)} className={selectCls}>
                    <option value="All">{t('removeactuals_all')}</option>
                    {segments.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                  <ChevronDown size={11} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                </div>
              </div>
              {showProducts && (
                <div className="flex items-center gap-1.5">
                  <span className="text-xs text-slate-500">{t('common_product')}</span>
                  <div className="relative">
                    <select value={prodFilter} onChange={e => setProdFilter(e.target.value)} className={selectCls}>
                      <option value="All">{t('removeactuals_all')}</option>
                      {products.map(p => <option key={p} value={p}>{p}</option>)}
                    </select>
                    <ChevronDown size={11} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                  </div>
                </div>
              )}
              {showChannels && (
                <div className="flex items-center gap-1.5">
                  <span className="text-xs text-slate-500">{t('common_channel')}</span>
                  <div className="relative">
                    <select value={chanFilter} onChange={e => setChanFilter(e.target.value)} className={selectCls}>
                      <option value="All">{t('removeactuals_all')}</option>
                      {channels.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                    <ChevronDown size={11} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                  </div>
                </div>
              )}
            </div>
          </section>

          {/* Impact count */}
          <div className={`rounded-lg px-4 py-2.5 text-sm font-semibold ${
            removedCount === 0
              ? 'bg-slate-50 text-slate-400'
              : 'bg-red-50 text-[#e60000]'
          }`}>
            {removedCount === 0
              ? t('removeactuals_no_rows_match_the_current_selection')
              : t('removeactuals_row_will_be_removed', { p0: removedCount.toLocaleString(), p1: removedCount !== 1 ? 's' : '' })}
          </div>

          {/* All-data warning */}
          {isAllRemoved && (
            <div className="flex items-start gap-2.5 bg-amber-50 border border-amber-200 rounded-lg px-4 py-3">
              <AlertTriangle size={15} className="text-amber-500 shrink-0 mt-0.5" />
              <p className="text-xs text-amber-800 leading-relaxed">
                <span className="font-bold">{t('removeactuals_this_will_remove_all_actuals_data')}</span>{' '}
                
                {t('removeactuals_the_actuals_review_tab_will_show_no_compariso')}
              </p>
            </div>
          )}

          {/* Preview table */}
          {previewShown.length > 0 && (
            <section>
              <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-2">
                {t('removeactuals_preview')}
                {previewOverflow > 0 && (
                  <span className="ml-1 normal-case font-normal text-slate-400">
                    (showing 20 of {previewRows.length.toLocaleString()})
                  </span>
                )}
              </p>
              <div className="border border-slate-200 rounded-lg overflow-hidden">
                <table className="w-full text-xs">
                  <thead className="bg-slate-50 border-b border-slate-200">
                    <tr>
                      <th className="text-left px-3 py-2 font-semibold text-slate-500">{t('common_month')}</th>
                      {segments.length > 0 && <th className="text-left px-3 py-2 font-semibold text-slate-500">{t('common_segment')}</th>}
                      {showProducts && <th className="text-left px-3 py-2 font-semibold text-slate-500">{t('common_product')}</th>}
                      {showChannels && <th className="text-left px-3 py-2 font-semibold text-slate-500">{t('common_channel')}</th>}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {previewShown.map((r, i) => (
                      <tr key={i} className="hover:bg-slate-50">
                        <td className="px-3 py-1.5 text-slate-700 font-medium">{fmtMonth(r.month)}</td>
                        {segments.length > 0 && <td className="px-3 py-1.5 text-slate-600">{r.seg}</td>}
                        {showProducts && <td className="px-3 py-1.5 text-slate-600">{r.prod}</td>}
                        {showChannels && <td className="px-3 py-1.5 text-slate-600">{r.chan}</td>}
                      </tr>
                    ))}
                  </tbody>
                </table>
                {previewOverflow > 0 && (
                  <div className="bg-slate-50 border-t border-slate-200 px-3 py-2 text-xs text-slate-400">
                    +{previewOverflow.toLocaleString()} {t('removeactuals_more_cohort_month_combinations_not_shown')}
                  </div>
                )}
              </div>
            </section>
          )}
        </div>

        {/* ── Footer ── */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-200 bg-slate-50 rounded-b-2xl shrink-0">
          <button
            onClick={onCancel}
            className="px-4 py-2 text-sm font-semibold text-slate-600 hover:text-slate-800 transition-colors"
          >{t('common_cancel')}</button>
          <button
            onClick={handleConfirm}
            disabled={removedCount === 0}
            className="px-4 py-2 text-sm font-bold text-white bg-[#e60000] rounded-lg hover:bg-[#cc0000] transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2"
          >
            <Trash2 size={14} />{t('common_remove_actuals')}</button>
        </div>
      </div>
    </div>
  );
};

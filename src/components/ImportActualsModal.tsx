import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Upload, X, CheckSquare, Square, Calendar } from 'lucide-react';

interface MonthEntry {
  label: string; // yyyy-MM
  count: number;
  alreadyLoaded: boolean;
}

interface ImportActualsModalProps {
  months: MonthEntry[];
  onConfirm: (selectedMonths: Set<string>) => void;
  onCancel: () => void;
}

export const ImportActualsModal: React.FC<ImportActualsModalProps> = ({ months, onConfirm, onCancel }) => {
  const { t } = useTranslation();
  const [selected, setSelected] = useState<Set<string>>(
    () => new Set(months.filter(m => !m.alreadyLoaded).map(m => m.label))
  );

  const toggle = (label: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(label)) next.delete(label);
      else next.add(label);
      return next;
    });
  };

  const allSelected = months.every(m => selected.has(m.label));
  const toggleAll = () => {
    if (allSelected) setSelected(new Set());
    else setSelected(new Set(months.map(m => m.label)));
  };

  const newMonths = [...selected].filter(l => !months.find(m => m.label === l && m.alreadyLoaded));
  const totalRows = months.filter(m => selected.has(m.label)).reduce((s, m) => s + m.count, 0);

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl border border-slate-200 w-full max-w-lg flex flex-col max-h-[80vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-emerald-50 flex items-center justify-center">
              <Upload size={16} className="text-emerald-600" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-slate-900">{t('common_import_actuals')}</h2>
              <p className="text-xs text-slate-500">{t('importactuals_select_which_months_to_append_to_the_current')}</p>
            </div>
          </div>
          <button onClick={onCancel} className="text-slate-400 hover:text-slate-600 transition-colors">
            <X size={20} />
          </button>
        </div>

        {/* Month list */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-1">
          {/* Select All row */}
          <button
            onClick={toggleAll}
            className="w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-slate-50 text-sm text-slate-600 font-medium transition-colors"
          >
            {allSelected
              ? <CheckSquare size={16} className="text-emerald-600 shrink-0" />
              : <Square size={16} className="text-slate-400 shrink-0" />
            }
            {allSelected ? t('importactuals_deselect_all') : t('importactuals_select_all')}
            <span className="ml-auto text-xs text-slate-400">{months.length} months</span>
          </button>

          <div className="border-t border-slate-100 my-2" />

          {months.map(m => (
            <button
              key={m.label}
              onClick={() => toggle(m.label)}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-slate-50 transition-colors"
            >
              {selected.has(m.label)
                ? <CheckSquare size={16} className="text-emerald-600 shrink-0" />
                : <Square size={16} className="text-slate-400 shrink-0" />
              }
              <Calendar size={14} className="text-slate-400 shrink-0" />
              <span className="text-sm font-medium text-slate-800">{m.label}</span>
              {m.alreadyLoaded && (
                <span className="ml-2 text-[10px] font-semibold uppercase tracking-wider text-amber-600 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded">{t('importactuals_already_loaded')}</span>
              )}
              <span className="ml-auto text-xs text-slate-400">{m.count.toLocaleString()} rows</span>
            </button>
          ))}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-100 bg-slate-50/50 rounded-b-2xl flex items-center justify-between gap-4">
          <p className="text-xs text-slate-500">
            {selected.size > 0
              ? <><strong className="text-slate-700">{totalRows.toLocaleString()}</strong> rows across <strong className="text-slate-700">{selected.size}</strong> month{selected.size !== 1 ? 's' : ''} will be appended{newMonths.length < selected.size ? t('importactuals_includes_already_loaded_months') : ''}</>
              : t('importactuals_no_months_selected')
            }
          </p>
          <div className="flex gap-2 shrink-0">
            <button
              onClick={onCancel}
              className="px-4 py-2 text-sm font-medium text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
            >{t('common_cancel')}</button>
            <button
              onClick={() => onConfirm(selected)}
              disabled={selected.size === 0}
              className="px-4 py-2 text-sm font-semibold text-white bg-emerald-600 rounded-lg hover:bg-emerald-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              {selected.size > 0
                ? t('importactuals_import_count_months', { count: selected.size })
                : t('importactuals_import')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

import React, { useState, useRef, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { ChevronDown, Search } from 'lucide-react';

interface MultiSelectDropdownProps {
  /** Displayed label above the trigger button */
  label?: string;
  /** All selectable option values */
  options: string[];
  /** Currently selected values */
  selected: string[];
  onChange: (next: string[]) => void;
  /** Text shown on the trigger when nothing is selected */
  placeholder?: string;
  /** Noun used in the summary/select-all copy, e.g. "tariff" */
  noun?: string;
  /** Extra classes on the trigger button */
  className?: string;
}

/**
 * Compact multi-select control: a trigger button showing a selection summary
 * that opens a searchable checkbox list with Select all / Clear. Styled to match
 * the app's light card dropdowns (HierarchicalDropdown variant="light").
 */
export function MultiSelectDropdown({
  label,
  options,
  selected,
  onChange,
  placeholder = 'Select…',
  noun = 'item',
  className = '',
}: MultiSelectDropdownProps) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  // Close on click outside
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (!triggerRef.current?.contains(e.target as Node) && !panelRef.current?.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  // Focus the search box when opening; clear the query on close
  useEffect(() => {
    if (open) { setTimeout(() => searchRef.current?.focus(), 0); }
    else setQuery('');
  }, [open]);

  const filtered = useMemo(
    () => options.filter(o => o.toLowerCase().includes(query.trim().toLowerCase())),
    [options, query],
  );

  const allSelected = options.length > 0 && selected.length === options.length;

  const summary = selected.length === 0
    ? placeholder
    : allSelected
      ? `All ${options.length} ${noun}${options.length === 1 ? '' : 's'}`
      : selected.length <= 2
        ? selected.join(', ')
        : `${selected.length} ${noun}s selected`;

  const toggle = (opt: string) =>
    onChange(selected.includes(opt) ? selected.filter(x => x !== opt) : [...selected, opt]);

  return (
    <div className={`relative ${className}`}>
      {label && <label className="block text-xs font-medium text-slate-500 mb-1">{label}</label>}
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen(o => !o)}
        className="w-full text-sm border border-slate-200 rounded-lg p-2 bg-white outline-none focus:border-[#e60000] flex items-center justify-between gap-2 hover:border-slate-300 transition-colors"
      >
        <span className={`truncate ${selected.length === 0 ? 'text-slate-400' : 'text-slate-700'}`}>{summary}</span>
        <ChevronDown size={14} className={`shrink-0 text-slate-400 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div
          ref={panelRef}
          className="absolute z-50 mt-1 w-full min-w-[220px] bg-white border border-slate-200 rounded-xl shadow-xl overflow-hidden"
        >
          {/* Search */}
          <div className="p-2 border-b border-slate-100">
            <div className="relative">
              <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
              <input
                ref={searchRef}
                type="text"
                value={query}
                onChange={e => setQuery(e.target.value)}
                placeholder={`Search ${noun}s…`}
                className="w-full pl-7 pr-2 py-1.5 text-xs border border-slate-200 rounded-md bg-white placeholder-slate-400 outline-none focus:border-[#e60000]"
              />
            </div>
          </div>

          {/* Select all / Clear */}
          <div className="flex items-center justify-between px-2.5 py-1.5 border-b border-slate-100">
            <button
              type="button"
              onClick={() => onChange(options.slice())}
              disabled={allSelected}
              className="text-[11px] font-medium text-slate-600 hover:text-[#e60000] transition-colors disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:text-slate-600"
            >{t('common_select_all')}</button>
            <button
              type="button"
              onClick={() => onChange([])}
              disabled={selected.length === 0}
              className="text-[11px] font-medium text-slate-500 hover:text-[#e60000] transition-colors disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:text-slate-500"
            >{t('multiselect_clear')}</button>
          </div>

          {/* Option list */}
          <div className="max-h-56 overflow-y-auto py-1">
            {filtered.length === 0 ? (
              <div className="px-3 py-3 text-xs text-slate-400 italic text-center">{t('multiselect_no_matches')}</div>
            ) : (
              filtered.map(opt => {
                const on = selected.includes(opt);
                return (
                  <label
                    key={opt}
                    className="flex items-center gap-2 px-3 py-1.5 text-sm hover:bg-slate-50 transition-colors cursor-pointer select-none"
                  >
                    <input
                      type="checkbox"
                      checked={on}
                      onChange={() => toggle(opt)}
                      className="accent-[#e60000] h-4 w-4 shrink-0"
                    />
                    <span className="truncate text-slate-700">{opt}</span>
                  </label>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}

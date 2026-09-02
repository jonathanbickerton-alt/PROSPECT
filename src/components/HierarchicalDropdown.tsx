import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { ChevronDown, ChevronRight, X } from 'lucide-react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface HierarchicalSelection {
  /** L1 value, or null meaning "All" */
  l1: string | null;
  /** L2 value, or null meaning "All L2" */
  l2: string | null;
}

interface HierarchicalDropdownProps {
  /** Displayed label above the trigger button */
  label: string;
  /** L1 → L2 children map. Empty map = no options = dropdown hidden */
  tree: Map<string, string[]>;
  /** Current selection */
  value: HierarchicalSelection;
  onChange: (v: HierarchicalSelection) => void;
  /** Optional extra CSS classes on the trigger button */
  className?: string;
  /**
   * 'dark'  = dark toolbar style (default, used in ViewFilterBar)
   * 'light' = light card style (used in WhatIfTab local view bar)
   */
  variant?: 'dark' | 'light';
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function selectionLabel(value: HierarchicalSelection, allLabel = 'All'): string {
  // The 'All' default is for the two non-rendering callers only. Every
  // rendering path passes t('hierdrop_all') — the collapsed button used to
  // return the literal while the list beneath it rendered the key, so the
  // control disagreed with itself in every non-English locale.
  if (!value.l1) return allLabel;
  if (!value.l2) return value.l1;
  return `${value.l1} — ${value.l2}`;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function HierarchicalDropdown({
  label,
  tree,
  value,
  onChange,
  className = '',
  variant = 'dark',
}: HierarchicalDropdownProps) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  // Track which L1 nodes are expanded in the panel
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  // Keyboard focus index over the flat rendered item list
  const [focusIdx, setFocusIdx] = useState<number>(-1);

  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef   = useRef<HTMLDivElement>(null);

  // Auto-expand the L1 node of the current selection when opening
  useEffect(() => {
    if (open && value.l1) {
      setExpanded(prev => new Set([...prev, value.l1!]));
    }
  }, [open, value.l1]);

  // Close on click outside
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (
        !triggerRef.current?.contains(e.target as Node) &&
        !panelRef.current?.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  // Build the flat item list for keyboard navigation
  const flatItems = useMemo(() => {
    const items: Array<{ type: 'l1' | 'l2'; l1: string; l2?: string }> = [
      { type: 'l1', l1: '__ALL__' }, // "All" sentinel
    ];
    for (const [l1, children] of tree.entries()) {
      items.push({ type: 'l1', l1 });
      if (expanded.has(l1)) {
        for (const l2 of children) {
          items.push({ type: 'l2', l1, l2 });
        }
      }
    }
    return items;
  }, [tree, expanded]);

  const toggleExpand = useCallback((l1: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setExpanded(prev => {
      const next = new Set(prev);
      if (next.has(l1)) next.delete(l1); else next.add(l1);
      return next;
    });
    setFocusIdx(-1);
  }, []);

  const selectItem = useCallback((item: { type: 'l1' | 'l2'; l1: string; l2?: string }) => {
    if (item.l1 === '__ALL__') {
      onChange({ l1: null, l2: null });
    } else if (item.type === 'l1') {
      onChange({ l1: item.l1, l2: null });
    } else {
      onChange({ l1: item.l1, l2: item.l2! });
    }
    setOpen(false);
  }, [onChange]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (!open) {
      if (e.key === 'Enter' || e.key === ' ' || e.key === 'ArrowDown') {
        e.preventDefault();
        setOpen(true);
        setFocusIdx(0);
      }
      return;
    }

    if (e.key === 'Escape') {
      setOpen(false);
      triggerRef.current?.focus();
      return;
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setFocusIdx(prev => Math.min(prev + 1, flatItems.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setFocusIdx(prev => Math.max(prev - 1, 0));
    } else if (e.key === 'ArrowRight') {
      e.preventDefault();
      const item = flatItems[focusIdx];
      if (item?.type === 'l1' && item.l1 !== '__ALL__' && (tree.get(item.l1)?.length ?? 0) > 0) {
        setExpanded(prev => new Set([...prev, item.l1]));
      }
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault();
      const item = flatItems[focusIdx];
      if (item) {
        const l1 = item.type === 'l2' ? item.l1 : item.l1;
        setExpanded(prev => { const n = new Set(prev); n.delete(l1); return n; });
      }
    } else if (e.key === 'Enter' && focusIdx >= 0) {
      e.preventDefault();
      const item = flatItems[focusIdx];
      if (item) selectItem(item);
    }
  }, [open, flatItems, focusIdx, tree, selectItem]);

  const isSelected = (item: { type: 'l1' | 'l2'; l1: string; l2?: string }): boolean => {
    if (item.l1 === '__ALL__') return !value.l1;
    if (item.type === 'l1') return value.l1 === item.l1 && !value.l2;
    return value.l1 === item.l1 && value.l2 === item.l2;
  };

  const triggerCls = variant === 'light'
    ? [
        'appearance-none bg-slate-50 hover:bg-slate-100 text-slate-700 text-xs',
        'px-2 py-1.5 pr-7 rounded-lg border border-slate-200 focus:outline-none focus:border-[#e60000]',
        'cursor-pointer transition-colors flex items-center gap-1 min-w-0 max-w-full truncate',
        className,
      ].join(' ')
    : [
        'appearance-none bg-slate-700 hover:bg-slate-600 text-slate-100 text-xs',
        'px-2.5 py-1 pr-7 rounded border border-slate-600 focus:outline-none focus:border-slate-400',
        // Dark is the top filter bar — a flex toolbar with no column to size
        // to, so it keeps an explicit cap. Only the light variant, which sits
        // in a grid cell, is fluid.
        'cursor-pointer transition-colors flex items-center gap-1 min-w-0 max-w-[180px] truncate',
        className,
      ].join(' ');

  const displayText = selectionLabel(value, t('hierdrop_all'));

  if (tree.size === 0) return null;

  return (
    <div className="flex items-center gap-1.5 relative min-w-0">
      <span className="text-[10px] uppercase tracking-wide text-slate-500 shrink-0">{label}</span>
      {/* min-w-0 is load-bearing. This is a flex item, so its min-width
          defaults to auto and it will not shrink below its content — which
          made the trigger size to the selected label (236.7px measured for
          "Direct — Call Centre / Tele-sales") and paint 70px over the next
          grid cell. w-full on the button resolves against THIS box, so
          without it the width constraint is circular and never binds. */}
      <div className="relative min-w-0">
        <button
          ref={triggerRef}
          type="button"
          onClick={() => { setOpen(o => !o); setFocusIdx(0); }}
          onKeyDown={handleKeyDown}
          className={triggerCls}
          aria-haspopup="listbox"
          aria-expanded={open}
        >
          <span className="truncate">{displayText}</span>
          {value.l1 && (
            <span
              role="button"
              aria-label={t('hierdrop_clear_selection')}
              className="ml-0.5 text-slate-400 hover:text-white shrink-0"
              onMouseDown={e => { e.stopPropagation(); onChange({ l1: null, l2: null }); }}
            >
              <X size={9} />
            </span>
          )}
          <ChevronDown size={10} className="shrink-0 text-slate-400 pointer-events-none" />
        </button>

        {open && (
          <div
            ref={panelRef}
            role="listbox"
            className="absolute left-0 top-full mt-1 z-50 bg-white border border-slate-200 rounded-xl shadow-xl overflow-hidden min-w-[200px] max-h-64 overflow-y-auto"
          >
            {/* "All" option */}
            <button
              type="button"
              role="option"
              aria-selected={!value.l1}
              onClick={() => selectItem({ type: 'l1', l1: '__ALL__' })}
              className={`w-full text-left px-3 py-2 text-xs flex items-center justify-between transition-colors
                ${focusIdx === 0 ? 'bg-slate-100' : ''}
                ${!value.l1 ? 'bg-slate-800 text-white' : 'text-slate-700 hover:bg-slate-50'}`}
            >
              <span className="font-semibold">{t('hierdrop_all')}</span>
            </button>

            {/* L1 / L2 nodes */}
            {Array.from(tree.entries()).map(([l1, children], l1Idx) => {
              const flatIdxForL1 = flatItems.findIndex(fi => fi.l1 === l1 && fi.type === 'l1');
              const isL1Expanded = expanded.has(l1);
              const isL1Selected = value.l1 === l1 && !value.l2;
              const hasChildren  = children.length > 0;

              return (
                <React.Fragment key={l1}>
                  {/* L1 row */}
                  <button
                    type="button"
                    role="option"
                    aria-selected={isL1Selected}
                    aria-expanded={isL1Expanded}
                    onClick={() => selectItem({ type: 'l1', l1 })}
                    className={`w-full text-left pl-3 pr-2 py-2 text-xs flex items-center gap-1 transition-colors
                      ${focusIdx === flatIdxForL1 ? 'bg-slate-100' : ''}
                      ${isL1Selected ? 'bg-slate-800 text-white' : 'text-slate-800 hover:bg-slate-50'}`}
                  >
                    {hasChildren ? (
                      <span
                        role="button"
                        aria-label={isL1Expanded ? t('hierdrop_collapse') : t('hierdrop_expand')}
                        className="shrink-0 p-0.5 rounded hover:bg-slate-200/60"
                        onMouseDown={e => toggleExpand(l1, e)}
                      >
                        {isL1Expanded
                          ? <ChevronDown size={11} />
                          : <ChevronRight size={11} />}
                      </span>
                    ) : (
                      <span className="w-4 shrink-0" />
                    )}
                    <span className="font-bold truncate">{l1}</span>
                  </button>

                  {/* L2 children */}
                  {isL1Expanded && children.map(l2 => {
                    const flatIdxForL2 = flatItems.findIndex(fi => fi.l1 === l1 && fi.l2 === l2);
                    const isL2Selected = value.l1 === l1 && value.l2 === l2;
                    return (
                      <button
                        key={`${l1}|${l2}`}
                        type="button"
                        role="option"
                        aria-selected={isL2Selected}
                        onClick={() => selectItem({ type: 'l2', l1, l2 })}
                        className={`w-full text-left pl-9 pr-3 py-1.5 text-xs flex items-center gap-1 transition-colors
                          ${focusIdx === flatIdxForL2 ? 'bg-slate-100' : ''}
                          ${isL2Selected ? 'bg-slate-700 text-white' : 'text-slate-500 font-normal hover:bg-slate-50 hover:text-slate-700'}`}
                      >
                        <span className="truncate">{l2}</span>
                      </button>
                    );
                  })}
                </React.Fragment>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

export { selectionLabel };

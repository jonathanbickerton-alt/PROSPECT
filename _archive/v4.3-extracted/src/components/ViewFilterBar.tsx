import React from 'react';
import { SlidersHorizontal, ChevronDown, CheckCircle2, AlertCircle } from 'lucide-react';
import { HierarchicalDropdown } from './HierarchicalDropdown';
import type { HierarchicalSelection } from './HierarchicalDropdown';

// Re-export so consumers can import from a single location
export type { HierarchicalSelection };

export interface ViewFilter {
  segment: string;
  product: HierarchicalSelection;
  channel: HierarchicalSelection;
}

interface ViewFilterBarProps {
  filter: ViewFilter;
  onChange: (f: ViewFilter) => void;
  segments: string[];
  /** L1 → L2 children map for Product hierarchy */
  productTree: Map<string, string[]>;
  /** L1 → L2 children map for Channel hierarchy */
  channelTree: Map<string, string[]>;
  /** True when the forecastStore has an entry for the current filter selection. */
  hasForecast: boolean;
  /** Navigate to Step 1 to generate a forecast. */
  onGoToStep1: () => void;
}

export function ViewFilterBar({
  filter,
  onChange,
  segments,
  productTree,
  channelTree,
  hasForecast,
  onGoToStep1,
}: ViewFilterBarProps) {
  const selectCls =
    'appearance-none bg-slate-700 hover:bg-slate-600 text-slate-100 text-xs px-2.5 py-1 pr-6 rounded border border-slate-600 focus:outline-none focus:border-slate-400 cursor-pointer transition-colors';

  return (
    <div className="bg-slate-800 text-white px-6 py-2 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs shrink-0">
      {/* Label */}
      <div className="flex items-center gap-1.5 shrink-0">
        <SlidersHorizontal size={12} className="text-slate-400" />
        <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
          Viewing
        </span>
      </div>

      {/* Segment — flat select, unchanged */}
      <div className="flex items-center gap-1.5">
        <span className="text-[10px] uppercase tracking-wide text-slate-500">Segment</span>
        <div className="relative">
          <select
            value={filter.segment}
            onChange={e => onChange({ ...filter, segment: e.target.value })}
            className={selectCls}
          >
            <option value="All">All</option>
            {segments.map(s => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
          <ChevronDown
            size={10}
            className="absolute right-1.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"
          />
        </div>
      </div>

      {/* Product — hierarchical tree dropdown */}
      {productTree.size > 0 && (
        <HierarchicalDropdown
          label="Product"
          tree={productTree}
          value={filter.product}
          onChange={p => onChange({ ...filter, product: p })}
        />
      )}

      {/* Channel — hierarchical tree dropdown */}
      {channelTree.size > 0 && (
        <HierarchicalDropdown
          label="Channel"
          tree={channelTree}
          value={filter.channel}
          onChange={c => onChange({ ...filter, channel: c })}
        />
      )}

      {/* Status badge — right-aligned */}
      <div className="ml-auto flex items-center gap-2.5 shrink-0">
        {hasForecast ? (
          <span className="flex items-center gap-1 text-[10px] text-emerald-400">
            <CheckCircle2 size={11} />
            Forecast loaded
          </span>
        ) : (
          <>
            <span className="flex items-center gap-1 text-[10px] text-slate-400">
              <AlertCircle size={11} />
              No forecast for this selection
            </span>
            <button
              onClick={onGoToStep1}
              className="text-[10px] font-semibold text-[#e60000] hover:text-red-400 transition-colors underline underline-offset-2"
            >
              Generate in Step 1
            </button>
          </>
        )}
      </div>
    </div>
  );
}

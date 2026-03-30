import React from 'react';

export interface CohortDims {
  product: boolean;
  channelL1: boolean;
}

interface Props {
  dims: CohortDims;
  onChange: (d: CohortDims) => void;
  wiProductCol: string;
  wiChannelCol: string;
  /** When provided, renders a right-aligned count badge. */
  count?: number;
  /** Noun for the count badge, defaults to "cohort". */
  countLabel?: string;
}

/**
 * Reusable "Group by" dimension checkbox row.
 * Customer Segment is always enabled and cannot be deselected.
 * Product and Channel L1 are optional; Channel L2 is permanently disabled
 * (not yet mapped in the current data model).
 *
 * State is owned by the caller so two instances can have independent selections.
 */
export function CohortDimCheckboxes({
  dims,
  onChange,
  wiProductCol,
  wiChannelCol,
  count,
  countLabel = 'cohort',
}: Props) {
  return (
    <div className="px-6 py-3 border-b border-slate-100 bg-white flex flex-wrap items-center gap-5">
      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 shrink-0">
        Group by
      </span>

      {/* Customer Segment — always checked, cannot be deselected */}
      <label className="flex items-center gap-1.5 cursor-not-allowed select-none">
        <input
          type="checkbox"
          checked
          disabled
          className="accent-[#e60000] h-3.5 w-3.5"
        />
        <span className="text-xs font-medium text-slate-600">Customer Segment</span>
        <span className="text-[9px] text-slate-400 uppercase tracking-wide ml-0.5">(required)</span>
      </label>

      {/* Product */}
      {wiProductCol ? (
        <label className="flex items-center gap-1.5 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={dims.product}
            onChange={e => onChange({ ...dims, product: e.target.checked })}
            className="accent-[#e60000] h-3.5 w-3.5"
          />
          <span className="text-xs font-medium text-slate-700">Product</span>
        </label>
      ) : (
        <label className="flex items-center gap-1.5 cursor-not-allowed opacity-40 select-none">
          <input type="checkbox" disabled className="h-3.5 w-3.5" />
          <span className="text-xs font-medium text-slate-500">Product</span>
          <span className="text-[9px] text-slate-400">(not mapped)</span>
        </label>
      )}

      {/* Channel L1 */}
      {wiChannelCol ? (
        <label className="flex items-center gap-1.5 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={dims.channelL1}
            onChange={e => onChange({ ...dims, channelL1: e.target.checked })}
            className="accent-[#e60000] h-3.5 w-3.5"
          />
          <span className="text-xs font-medium text-slate-700">Channel L1</span>
        </label>
      ) : (
        <label className="flex items-center gap-1.5 cursor-not-allowed opacity-40 select-none">
          <input type="checkbox" disabled className="h-3.5 w-3.5" />
          <span className="text-xs font-medium text-slate-500">Channel L1</span>
          <span className="text-[9px] text-slate-400">(not mapped)</span>
        </label>
      )}

      {/* Channel L2 — always disabled: no L2 column in current data model */}
      <label
        className={`flex items-center gap-1.5 select-none ${
          dims.channelL1 && wiChannelCol
            ? 'opacity-40 cursor-not-allowed'
            : 'opacity-25 cursor-not-allowed'
        }`}
      >
        <input type="checkbox" disabled className="h-3.5 w-3.5" />
        <span className="text-xs font-medium text-slate-500">Channel L2</span>
        <span className="text-[9px] text-slate-400">(not mapped)</span>
      </label>

      {count !== undefined && (
        <span className="ml-auto text-[10px] text-slate-400">
          {count} {countLabel}{count !== 1 ? 's' : ''}
        </span>
      )}
    </div>
  );
}

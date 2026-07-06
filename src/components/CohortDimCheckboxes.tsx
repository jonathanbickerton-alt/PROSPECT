import React from 'react';

export interface CohortDims {
  product: boolean;
  /** Product L2 — only meaningful when product is true */
  productL2: boolean;
  channelL1: boolean;
  /** Channel L2 — only meaningful when channelL1 is true */
  channelL2: boolean;
  /** Tariff L1 (Phase 2a) */
  tariffL1: boolean;
  /** Tariff L2 — only meaningful when tariffL1 is true */
  tariffL2: boolean;
}

interface Props {
  dims: CohortDims;
  onChange: (d: CohortDims) => void;
  wiProductCol: string;
  wiChannelCol: string;
  /** Column name for Product L2 — controls whether the checkbox is available */
  wiProductL2Col?: string;
  /** Column name for Channel L2 — controls whether the checkbox is available */
  wiChannelL2Col?: string;
  /** Column name for Tariff L1 — controls whether the tariff checkboxes are available (Phase 2a) */
  wiTariffL1Col?: string;
  /** Column name for Tariff L2 — controls whether the tariff L2 checkbox is available (Phase 2a) */
  wiTariffL2Col?: string;
  /** When provided, renders a right-aligned count badge. */
  count?: number;
  /** Noun for the count badge, defaults to "cohort". */
  countLabel?: string;
}

/**
 * Reusable "Group by" dimension checkbox row.
 * Customer Segment is always enabled and cannot be deselected.
 * Product L1 and Channel L1 are optional.
 * Product L2 is only selectable when Product L1 is checked.
 * Channel L2 is only selectable when Channel L1 is checked.
 *
 * State is owned by the caller so two instances can have independent selections.
 */
export function CohortDimCheckboxes({
  dims,
  onChange,
  wiProductCol,
  wiChannelCol,
  wiProductL2Col = '',
  wiChannelL2Col = '',
  wiTariffL1Col = '',
  wiTariffL2Col = '',
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

      {/* Product L1 */}
      {wiProductCol ? (
        <label className="flex items-center gap-1.5 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={dims.product}
            onChange={e => {
              const checked = e.target.checked;
              // Deselecting L1 also clears L2
              onChange({ ...dims, product: checked, productL2: checked ? dims.productL2 : false });
            }}
            className="accent-[#e60000] h-3.5 w-3.5"
          />
          <span className="text-xs font-medium text-slate-700">Product L1</span>
        </label>
      ) : (
        <label className="flex items-center gap-1.5 cursor-not-allowed opacity-40 select-none">
          <input type="checkbox" disabled className="h-3.5 w-3.5" />
          <span className="text-xs font-medium text-slate-500">Product L1</span>
          <span className="text-[9px] text-slate-400">(not mapped)</span>
        </label>
      )}

      {/* Product L2 — only enabled when Product L1 is checked */}
      {wiProductL2Col ? (
        <label
          className={`flex items-center gap-1.5 select-none ${
            dims.product ? 'cursor-pointer' : 'opacity-40 cursor-not-allowed'
          }`}
        >
          <input
            type="checkbox"
            checked={dims.productL2}
            disabled={!dims.product}
            onChange={e => onChange({ ...dims, productL2: e.target.checked })}
            className="accent-[#e60000] h-3.5 w-3.5"
          />
          <span className="text-xs font-medium text-slate-700">Product L2</span>
          {!dims.product && (
            <span className="text-[9px] text-slate-400">(requires L1)</span>
          )}
        </label>
      ) : (
        <label className="flex items-center gap-1.5 cursor-not-allowed opacity-25 select-none">
          <input type="checkbox" disabled className="h-3.5 w-3.5" />
          <span className="text-xs font-medium text-slate-500">Product L2</span>
          <span className="text-[9px] text-slate-400">(not mapped)</span>
        </label>
      )}

      {/* Channel L1 */}
      {wiChannelCol ? (
        <label className="flex items-center gap-1.5 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={dims.channelL1}
            onChange={e => {
              const checked = e.target.checked;
              onChange({ ...dims, channelL1: checked, channelL2: checked ? dims.channelL2 : false });
            }}
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

      {/* Channel L2 — enabled when Channel L1 is checked AND L2 column is mapped */}
      {wiChannelL2Col ? (
        <label
          className={`flex items-center gap-1.5 select-none ${
            dims.channelL1 ? 'cursor-pointer' : 'opacity-40 cursor-not-allowed'
          }`}
        >
          <input
            type="checkbox"
            checked={dims.channelL2}
            disabled={!dims.channelL1}
            onChange={e => onChange({ ...dims, channelL2: e.target.checked })}
            className="accent-[#e60000] h-3.5 w-3.5"
          />
          <span className="text-xs font-medium text-slate-700">Channel L2</span>
          {!dims.channelL1 && (
            <span className="text-[9px] text-slate-400">(requires L1)</span>
          )}
        </label>
      ) : (
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
      )}

      {/* Tariff L1 (Phase 2a) */}
      {wiTariffL1Col ? (
        <label className="flex items-center gap-1.5 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={dims.tariffL1}
            onChange={e => {
              const checked = e.target.checked;
              onChange({ ...dims, tariffL1: checked, tariffL2: checked ? dims.tariffL2 : false });
            }}
            className="accent-[#e60000] h-3.5 w-3.5"
          />
          <span className="text-xs font-medium text-slate-700">Tariff L1</span>
        </label>
      ) : (
        <label className="flex items-center gap-1.5 cursor-not-allowed opacity-40 select-none">
          <input type="checkbox" disabled className="h-3.5 w-3.5" />
          <span className="text-xs font-medium text-slate-500">Tariff L1</span>
          <span className="text-[9px] text-slate-400">(not mapped)</span>
        </label>
      )}

      {/* Tariff L2 — enabled when Tariff L1 is checked AND L2 column is mapped */}
      {wiTariffL2Col ? (
        <label
          className={`flex items-center gap-1.5 select-none ${
            dims.tariffL1 ? 'cursor-pointer' : 'opacity-40 cursor-not-allowed'
          }`}
        >
          <input
            type="checkbox"
            checked={dims.tariffL2}
            disabled={!dims.tariffL1}
            onChange={e => onChange({ ...dims, tariffL2: e.target.checked })}
            className="accent-[#e60000] h-3.5 w-3.5"
          />
          <span className="text-xs font-medium text-slate-700">Tariff L2</span>
          {!dims.tariffL1 && (
            <span className="text-[9px] text-slate-400">(requires L1)</span>
          )}
        </label>
      ) : (
        <label
          className={`flex items-center gap-1.5 select-none ${
            dims.tariffL1 && wiTariffL1Col
              ? 'opacity-40 cursor-not-allowed'
              : 'opacity-25 cursor-not-allowed'
          }`}
        >
          <input type="checkbox" disabled className="h-3.5 w-3.5" />
          <span className="text-xs font-medium text-slate-500">Tariff L2</span>
          <span className="text-[9px] text-slate-400">(not mapped)</span>
        </label>
      )}

      {count !== undefined && (
        <span className="ml-auto text-[10px] text-slate-400">
          {count} {countLabel}{count !== 1 ? 's' : ''}
        </span>
      )}
    </div>
  );
}

import React from 'react';
import { useTranslation } from 'react-i18next';
import { SlidersHorizontal, ChevronDown, CheckCircle2, AlertCircle } from 'lucide-react';
import { HierarchicalDropdown } from './HierarchicalDropdown';
import { SKIP_REASON_KEY } from '../types/forecast';
import type { HierarchicalSelection } from './HierarchicalDropdown';

// Re-export so consumers can import from a single location
export type { HierarchicalSelection };

export interface ViewFilter {
  segment: string;
  product: HierarchicalSelection;
  channel: HierarchicalSelection;
  /** Tariff dimension (Phase 2a) — optional so existing filter constructions
   *  remain valid; absent means no tariff filter (treated as All). */
  tariff?: HierarchicalSelection;
}

interface ViewFilterBarProps {
  filter: ViewFilter;
  onChange: (f: ViewFilter) => void;
  segments: string[];
  /** L1 → L2 children map for Product hierarchy */
  productTree: Map<string, string[]>;
  /** L1 → L2 children map for Channel hierarchy */
  channelTree: Map<string, string[]>;
  /** L1 → L2 children map for Tariff hierarchy (Phase 2a) */
  tariffTree?: Map<string, string[]>;
  /** True when the forecastStore has an entry for the current filter selection. */
  hasForecast: boolean;
  /**
   * Why the current selection has no forecast, or null when it has one or when
   * nothing has been generated at all.
   *
   * The LAST consumer of the two-meanings-of-null split. `hasForecast` false
   * used to mean one thing - nothing generated - so an unconditional
   * "Generate in Step 1" was always the right action. It now also covers a
   * selection that resolves to nothing in a session full of forecasts, where
   * Step 1 cannot help: it is the manual fit-on-aggregate path, and it cannot
   * give a cohort more months of history.
   */
  noForecastReason?: import('../types/forecast').SkipReason | null;
  /** Navigate to Step 1 to generate a forecast. */
  onGoToStep1: () => void;
}

export function ViewFilterBar({
  filter,
  onChange,
  segments,
  productTree,
  channelTree,
  tariffTree,
  hasForecast,
  noForecastReason = null,
  onGoToStep1,
}: ViewFilterBarProps) {
  const { t } = useTranslation();
  const tariffSelection: HierarchicalSelection = filter.tariff ?? { l1: null, l2: null };
  const selectCls =
    'appearance-none bg-slate-700 hover:bg-slate-600 text-slate-100 text-xs px-2.5 py-1 pr-6 rounded border border-slate-600 focus:outline-none focus:border-slate-400 cursor-pointer transition-colors';

  return (
    <div className="bg-slate-800 text-white px-6 py-2 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs shrink-0">
      {/* Label */}
      <div className="flex items-center gap-1.5 shrink-0">
        <SlidersHorizontal size={12} className="text-slate-400" />
        <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">{t('viewfilter_viewing')}</span>
      </div>

      {/* Segment — flat select, unchanged */}
      <div className="flex items-center gap-1.5">
        <span className="text-[10px] uppercase tracking-wide text-slate-500">{t('common_segment')}</span>
        <div className="relative">
          <select
            value={filter.segment}
            onChange={e => onChange({ ...filter, segment: e.target.value })}
            className={selectCls}
          >
            <option value="All">{t('viewfilter_all')}</option>
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
          label={t('common_product')}
          tree={productTree}
          value={filter.product}
          onChange={p => onChange({ ...filter, product: p })}
        />
      )}

      {/* Channel — hierarchical tree dropdown */}
      {channelTree.size > 0 && (
        <HierarchicalDropdown
          label={t('common_channel')}
          tree={channelTree}
          value={filter.channel}
          onChange={c => onChange({ ...filter, channel: c })}
        />
      )}

      {/* Tariff — hierarchical tree dropdown (Phase 2a); only shown when tariff data exists */}
      {tariffTree && tariffTree.size > 0 && (
        <HierarchicalDropdown
          label={t('common_tariff')}
          tree={tariffTree}
          value={tariffSelection}
          onChange={t => onChange({ ...filter, tariff: t })}
        />
      )}

      {/* Status badge — right-aligned */}
      <div className="ml-auto flex items-center gap-2.5 shrink-0">
        {hasForecast ? (
          <span className="flex items-center gap-1 text-[10px] text-emerald-400">
            <CheckCircle2 size={11} />{t('viewfilter_forecast_loaded')}</span>
        ) : (
          <>
            <span className="flex items-center gap-1 text-[10px] text-slate-400">
              <AlertCircle size={11} />{t('viewfilter_no_forecast_for_this_selection')}</span>
            {noForecastReason ? (
              /* A generation exists and does not cover this selection: say why,
                 through the same reason enum the Step 2 panel uses, and offer
                 the action that can actually work. No Step 1 link. */
              <span className="text-[10px] text-slate-500">
                {t(SKIP_REASON_KEY[noForecastReason])}{' · '}{t('viewfilter_widen_the_filter')}
              </span>
            ) : (
              <button
                onClick={onGoToStep1}
                className="text-[10px] font-semibold text-[#e60000] hover:text-red-400 transition-colors underline underline-offset-2"
              >{t('viewfilter_generate_in_step_1')}</button>
            )}
          </>
        )}
      </div>
    </div>
  );
}

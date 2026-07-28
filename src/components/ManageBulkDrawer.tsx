import React, { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  X, ChevronDown, ChevronRight, Zap, ArrowLeft,
  CheckCircle2, AlertTriangle, Loader2, LayersIcon,
} from 'lucide-react';
import type { BulkRunRecord, ForecastModel } from '../types/forecast';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface CohortEntry {
  id: string;
  segment: string;
  product: string;
  productL2?: string;
  channel: string;
  channelL2?: string;
  tariffL1?: string;
  tariffL2?: string;
  scenario: string;
  forecastType: string;
  hasForecast: boolean;
}

interface ReApplyOptions {
  cohortIds: string[];
  name: string;
  comment: string;
  model: ForecastModel;
  preHorizonUncertainty: number;
  postHorizonExpansionRate: number;
  confidenceHorizon: number;
  autoModel?: boolean;
  autoConfidence?: boolean;
}

export interface ManageBulkDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  allCohorts: CohortEntry[];
  bulkRuns: BulkRunRecord[];
  onReApply: (opts: ReApplyOptions) => Promise<{ generated: number; failed: number }>;
  defaultModel: ForecastModel;
  defaultPreHorizonUncertainty: number;
  defaultPostHorizonExpansionRate: number;
  defaultConfidenceHorizon: number;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function cohortLabel(c: CohortEntry): string {
  const prodLabel = c.product && c.product !== 'All'
    ? (c.productL2 && c.productL2 !== 'All' ? `${c.product} · ${c.productL2}` : c.product)
    : null;
  const chanLabel = c.channel && c.channel !== 'All'
    ? (c.channelL2 && c.channelL2 !== 'All' ? `${c.channel} · ${c.channelL2}` : c.channel)
    : null;
  const tariffLabel = c.tariffL1 && c.tariffL1 !== 'All'
    ? (c.tariffL2 && c.tariffL2 !== 'All' ? `${c.tariffL1} · ${c.tariffL2}` : c.tariffL1)
    : null;
  return [c.segment !== 'All' ? c.segment : null, prodLabel, chanLabel, tariffLabel]
    .filter(Boolean)
    .join(' · ') || 'All cohorts';
}

function fmtTimestamp(iso: string): string {
  try {
    return new Date(iso).toLocaleString(undefined, {
      day: '2-digit', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });
  } catch {
    return iso;
  }
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

type Phase = 'select' | 'settings' | 'generating' | 'done';

const MODELS: ForecastModel[] = ['Holt Linear', 'Damped Trend', 'Holt-Winters', 'Simple Exponential Smoothing'];

export function ManageBulkDrawer({
  isOpen,
  onClose,
  allCohorts,
  bulkRuns,
  onReApply,
  defaultModel,
  defaultPreHorizonUncertainty,
  defaultPostHorizonExpansionRate,
  defaultConfidenceHorizon,
}: ManageBulkDrawerProps) {
  const { t } = useTranslation();
  const [phase, setPhase] = useState<Phase>('select');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set(['manual']));

  // Settings panel state — reset when entering settings phase
  const [runName, setRunName] = useState('');
  const [runComment, setRunComment] = useState('');
  const [model, setModel] = useState<ForecastModel>(defaultModel);
  const [preUnc, setPreUnc] = useState(defaultPreHorizonUncertainty);
  const [postExp, setPostExp] = useState(defaultPostHorizonExpansionRate);
  const [confHor, setConfHor] = useState(defaultConfidenceHorizon);

  const [result, setResult] = useState<{ generated: number; failed: number } | null>(null);

  // ── Derived ──
  const allBulkIds = useMemo(() => {
    const s = new Set<string>();
    bulkRuns.forEach(r => r.cohortIds.forEach(id => s.add(id)));
    return s;
  }, [bulkRuns]);

  const generatedCohorts = useMemo(
    () => allCohorts.filter(c => c.hasForecast && c.forecastType === 'Standard Forecast'),
    [allCohorts],
  );

  const manualCohorts = useMemo(
    () => generatedCohorts.filter(c => !allBulkIds.has(c.id)),
    [generatedCohorts, allBulkIds],
  );

  // ── Handlers ──
  const toggleGroup = (key: string) =>
    setExpandedGroups(prev => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });

  const toggleCohort = (id: string) =>
    setSelected(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  const toggleGroupAll = (ids: string[]) => {
    const allSel = ids.every(id => selected.has(id));
    setSelected(prev => {
      const next = new Set(prev);
      if (allSel) ids.forEach(id => next.delete(id));
      else ids.forEach(id => next.add(id));
      return next;
    });
  };

  const openSettings = () => {
    // Seed settings from defaults each time so the user starts fresh
    setModel(defaultModel);
    setPreUnc(defaultPreHorizonUncertainty);
    setPostExp(defaultPostHorizonExpansionRate);
    setConfHor(defaultConfidenceHorizon);
    setRunName('');
    setRunComment('');
    setPhase('settings');
  };

  const handleGenerate = async () => {
    setPhase('generating');
    try {
      const res = await onReApply({
        cohortIds: Array.from(selected),
        name: runName.trim(),   // empty string → App.tsx computes the timestamp fallback
        comment: runComment.trim(),
        model,
        preHorizonUncertainty: preUnc,
        postHorizonExpansionRate: postExp,
        confidenceHorizon: confHor,
        autoModel: false,
        autoConfidence: false,
      });
      setResult(res);
    } catch {
      setResult({ generated: 0, failed: selected.size });
    }
    setPhase('done');
  };

  const resetToSelect = () => {
    setPhase('select');
    setSelected(new Set());
    setResult(null);
  };

  const handleClose = () => {
    resetToSelect();
    onClose();
  };

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-black/30 backdrop-blur-sm"
        onClick={phase === 'generating' ? undefined : handleClose}
      />

      {/* Drawer — slides in from right */}
      <div className="fixed inset-y-0 right-0 z-50 w-[480px] bg-white shadow-2xl flex flex-col">

        {/* ── Header ── */}
        <div className="px-5 py-4 border-b border-slate-200 flex items-center gap-3 shrink-0">
          {(phase === 'settings') && (
            <button
              onClick={() => setPhase('select')}
              className="text-slate-400 hover:text-slate-600 p-1 -ml-1 transition-colors"
            >
              <ArrowLeft size={18} />
            </button>
          )}
          <div className="w-8 h-8 rounded-lg bg-[#e60000]/10 flex items-center justify-center shrink-0">
            <LayersIcon size={16} className="text-[#e60000]" />
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="text-sm font-bold text-slate-900">
              {phase === 'settings' || phase === 'generating'
                ? 'Re-apply Settings'
                : 'Manage Bulk Generations'}
            </h2>
            <p className="text-[11px] text-slate-500 truncate">
              {phase === 'select'
                ? `${generatedCohorts.length} cohort${generatedCohorts.length !== 1 ? 's' : ''} generated · ${bulkRuns.length} bulk run${bulkRuns.length !== 1 ? 's' : ''}`
                : `Applying to ${selected.size} cohort${selected.size !== 1 ? 's' : ''}`}
            </p>
          </div>
          {phase !== 'generating' && (
            <button
              onClick={handleClose}
              className="text-slate-400 hover:text-slate-600 p-1 transition-colors"
            >
              <X size={18} />
            </button>
          )}
        </div>

        {/* ── Scrollable body ── */}
        <div className="flex-1 overflow-y-auto">

          {/* ══ Phase: Select ══ */}
          {phase === 'select' && (
            <div className="p-4 space-y-3">

              {/* Select all / deselect all */}
              <div className="flex items-center gap-3 px-1 pb-1">
                <button
                  onClick={() => setSelected(new Set(generatedCohorts.map(c => c.id)))}
                  className="text-xs font-semibold text-indigo-600 hover:text-indigo-700 transition-colors"
                >{t('common_select_all')}</button>
                <span className="text-slate-200 select-none">|</span>
                <button
                  onClick={() => setSelected(new Set())}
                  className="text-xs font-semibold text-slate-500 hover:text-slate-700 transition-colors"
                >{t('bulkdrawer_deselect_all')}</button>
                {selected.size > 0 && (
                  <span className="ml-auto text-xs text-slate-400">
                    {selected.size} selected
                  </span>
                )}
              </div>

              {/* Empty state */}
              {generatedCohorts.length === 0 && (
                <div className="text-center py-16 text-slate-400 text-sm">{t('bulkdrawer_no_cohort_forecasts_have_been_generated_yet')}</div>
              )}

              {/* Manually generated group */}
              {manualCohorts.length > 0 && (
                <CohortGroup
                  groupId="manual"
                  title={t('bulkdrawer_manually_generated')}
                  count={manualCohorts.length}
                  isExpanded={expandedGroups.has('manual')}
                  onToggle={() => toggleGroup('manual')}
                  cohorts={manualCohorts}
                  selected={selected}
                  onToggleCohort={toggleCohort}
                  onToggleGroupAll={() => toggleGroupAll(manualCohorts.map(c => c.id))}
                />
              )}

              {/* Bulk run groups — most recent first */}
              {[...bulkRuns].reverse().map(run => {
                const runCohorts = generatedCohorts.filter(c => run.cohortIds.includes(c.id));
                return (
                  <BulkRunGroup
                    key={run.id}
                    run={run}
                    cohorts={runCohorts}
                    isExpanded={expandedGroups.has(run.id)}
                    onToggle={() => toggleGroup(run.id)}
                    selected={selected}
                    onToggleCohort={toggleCohort}
                    onToggleGroupAll={() => toggleGroupAll(runCohorts.map(c => c.id))}
                  />
                );
              })}
            </div>
          )}

          {/* ══ Phase: Settings / Generating ══ */}
          {(phase === 'settings' || phase === 'generating') && (
            <div className="p-5 space-y-5">

              {/* Run name */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">{t('common_run_name')}<span className="font-normal text-slate-400">(optional)</span>
                </label>
                <input
                  type="text"
                  value={runName}
                  onChange={e => setRunName(e.target.value)}
                  placeholder={`Bulk Run — ${new Date().toLocaleDateString()}`}
                  disabled={phase === 'generating'}
                  className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2.5 outline-none focus:ring-2 focus:ring-[#e60000]/20 focus:border-[#e60000]/40 disabled:bg-slate-50 disabled:text-slate-400"
                />
              </div>

              {/* Comment */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">{t('common_comment')}<span className="font-normal text-slate-400">(optional)</span>
                </label>
                <textarea
                  value={runComment}
                  onChange={e => setRunComment(e.target.value)}
                  placeholder={t('common_e_g_quarterly_pricing_review_updated_confiden')}
                  rows={2}
                  disabled={phase === 'generating'}
                  className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-[#e60000]/20 focus:border-[#e60000]/40 resize-none disabled:bg-slate-50 disabled:text-slate-400"
                />
              </div>

              <div className="border-t border-slate-100 pt-4 space-y-4">
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{t('bulkdrawer_forecast_settings')}</p>

                {/* Model */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-2">{t('bulkdrawer_model')}</label>
                  <div className="space-y-2">
                    {MODELS.map(m => (
                      <button
                        key={m}
                        onClick={() => setModel(m)}
                        disabled={phase === 'generating'}
                        className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg border text-left transition-all text-sm ${
                          model === m
                            ? 'bg-red-50 border-[#e60000]/30 text-[#e60000] font-semibold'
                            : 'border-slate-200 text-slate-600 hover:border-slate-300 hover:bg-slate-50'
                        }`}
                      >
                        <span className={`h-3 w-3 rounded-full border-2 shrink-0 transition-colors ${
                          model === m ? 'border-[#e60000] bg-[#e60000]' : 'border-slate-300'
                        }`} />
                        {m}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Confidence sliders */}
                <div className="space-y-4">
                  {([
                    {
                      label: 'Pre-Horizon Uncertainty', value: preUnc,
                      set: setPreUnc, min: 0, max: 20, step: 0.5,
                      display: `${preUnc}%`,
                    },
                    {
                      label: 'Post-Horizon Expansion', value: postExp,
                      set: setPostExp, min: 0, max: 20, step: 0.5,
                      display: `${postExp}% /mo`,
                    },
                    {
                      label: 'Confidence Horizon', value: confHor,
                      set: setConfHor, min: 1, max: 12, step: 1,
                      display: `${confHor} month${confHor !== 1 ? 's' : ''}`,
                    },
                  ] as const).map(({ label, value, set, min, max, step, display }) => (
                    <div key={label}>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-medium text-slate-600">{label}</span>
                        <span className="text-xs font-semibold text-slate-800">{display}</span>
                      </div>
                      <input
                        type="range"
                        min={min} max={max} step={step} value={value}
                        onChange={e => (set as (v: number) => void)(Number(e.target.value))}
                        disabled={phase === 'generating'}
                        className="w-full accent-[#e60000]"
                      />
                    </div>
                  ))}
                </div>
              </div>

              {/* Summary */}
              <div className="bg-slate-50 rounded-lg px-3 py-2.5 text-xs text-slate-600">{t('bulkdrawer_applying_to')}<strong>{selected.size}</strong> cohort{selected.size !== 1 ? 's' : ''}.{' '}
                Existing forecasts for these cohorts will be overwritten.
              </div>

              {phase === 'generating' && (
                <div className="flex items-center gap-2.5 text-sm text-slate-600">
                  <Loader2 size={16} className="animate-spin text-[#e60000] shrink-0" />{t('bulkdrawer_generating_forecasts')}</div>
              )}
            </div>
          )}

          {/* ══ Phase: Done ══ */}
          {phase === 'done' && result && (
            <div className="p-8 flex flex-col items-center text-center gap-5">
              <div className={`w-14 h-14 rounded-full flex items-center justify-center ${
                result.failed === 0 ? 'bg-emerald-50' : 'bg-amber-50'
              }`}>
                <CheckCircle2
                  size={28}
                  className={result.failed === 0 ? 'text-emerald-500' : 'text-amber-500'}
                />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900 mb-4">{t('bulkdrawer_re_apply_complete')}</h3>
                <div className="space-y-2 text-sm max-w-xs mx-auto">
                  <div className="flex items-center gap-2 bg-emerald-50 rounded-lg px-3 py-2.5 text-left">
                    <CheckCircle2 size={14} className="text-emerald-500 shrink-0" />
                    <span className="text-emerald-700">
                      <strong>{result.generated}</strong> forecast{result.generated !== 1 ? 's' : ''} updated
                    </span>
                  </div>
                  {result.failed > 0 && (
                    <div className="flex items-center gap-2 bg-amber-50 rounded-lg px-3 py-2.5 text-left">
                      <AlertTriangle size={14} className="text-amber-500 shrink-0" />
                      <span className="text-amber-700">
                        <strong>{result.failed}</strong> skipped — insufficient data
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* ── Footer ── */}
        <div className="px-5 py-4 border-t border-slate-200 bg-white shrink-0">

          {phase === 'select' && (
            <div className="flex items-center gap-3">
              <span className="text-xs text-slate-500 flex-1">
                {selected.size > 0
                  ? `${selected.size} cohort${selected.size !== 1 ? 's' : ''} selected`
                  : 'Select cohorts above to re-apply'}
              </span>
              <button
                onClick={openSettings}
                disabled={selected.size === 0}
                className="px-4 py-2 bg-[#e60000] hover:bg-[#cc0000] disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-lg text-sm font-semibold transition-colors flex items-center gap-2"
              >
                <Zap size={14} />{t('bulkdrawer_re_apply_to_selected')}</button>
            </div>
          )}

          {phase === 'settings' && (
            <div className="flex items-center gap-3">
              <button
                onClick={() => setPhase('select')}
                className="px-3 py-2 text-sm font-medium text-slate-600 hover:text-slate-800 transition-colors"
              >
                ← Back
              </button>
              <button
                onClick={handleGenerate}
                className="flex-1 px-4 py-2 bg-[#e60000] hover:bg-[#cc0000] text-white rounded-lg text-sm font-semibold transition-colors flex items-center justify-center gap-2"
              >
                <Zap size={14} /> Generate {selected.size} Forecast{selected.size !== 1 ? 's' : ''}
              </button>
            </div>
          )}

          {phase === 'done' && (
            <div className="flex items-center gap-3">
              <button
                onClick={resetToSelect}
                className="text-sm font-medium text-slate-600 hover:text-slate-800 transition-colors"
              >{t('bulkdrawer_back_to_list')}</button>
              <button
                onClick={handleClose}
                className="flex-1 px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-lg text-sm font-semibold transition-colors"
              >{t('bulkdrawer_done')}</button>
            </div>
          )}
        </div>
      </div>
    </>
  );
}

// ---------------------------------------------------------------------------
// Sub-components — typed as React.FC so React 19 accepts `key` in JSX
// ---------------------------------------------------------------------------

const CohortRow: React.FC<{
  cohort: CohortEntry;
  checked: boolean;
  onToggle: () => void;
}> = ({ cohort, checked, onToggle }) => (
  <label className="flex items-center gap-3 px-4 py-2.5 hover:bg-slate-50/80 cursor-pointer transition-colors">
    <input
      type="checkbox"
      checked={checked}
      onChange={onToggle}
      className="accent-[#e60000] h-3.5 w-3.5 shrink-0"
    />
    <span className="text-xs text-slate-700 flex-1 truncate">
      {cohortLabel(cohort)}
      <span className="ml-1.5 text-slate-400">· {cohort.scenario}</span>
    </span>
  </label>
);

const CohortGroup: React.FC<{
  groupId: string;
  title: string;
  count: number;
  isExpanded: boolean;
  onToggle: () => void;
  cohorts: CohortEntry[];
  selected: Set<string>;
  onToggleCohort: (id: string) => void;
  onToggleGroupAll: () => void;
}> = ({ groupId: _groupId, title, count, isExpanded, onToggle, cohorts, selected, onToggleCohort, onToggleGroupAll }) => {
  const allSel = cohorts.length > 0 && cohorts.every(c => selected.has(c.id));
  const someSel = cohorts.some(c => selected.has(c.id));

  return (
    <div className="rounded-xl border border-slate-200 overflow-hidden">
      <div className="flex items-center bg-slate-50 border-b border-slate-100">
        <button
          onClick={onToggle}
          className="flex-1 flex items-center gap-2 px-4 py-3 hover:bg-slate-100 transition-colors text-left"
        >
          {isExpanded
            ? <ChevronDown size={14} className="text-slate-400 shrink-0" />
            : <ChevronRight size={14} className="text-slate-400 shrink-0" />}
          <span className="text-sm font-semibold text-slate-700">{title}</span>
        </button>
        <button
          onClick={onToggleGroupAll}
          className="px-3 py-3 text-[10px] font-semibold text-indigo-600 hover:text-indigo-700 shrink-0 transition-colors"
        >
          {allSel ? 'Deselect' : someSel ? 'Select all' : 'Select all'}
        </button>
        <span className="pr-4 text-xs text-slate-400 shrink-0">{count}</span>
      </div>
      {isExpanded && (
        <div className="divide-y divide-slate-100">
          {cohorts.map(c => (
            <CohortRow
              key={c.id}
              cohort={c}
              checked={selected.has(c.id)}
              onToggle={() => onToggleCohort(c.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
};

const BulkRunGroup: React.FC<{
  run: BulkRunRecord;
  cohorts: CohortEntry[];
  isExpanded: boolean;
  onToggle: () => void;
  selected: Set<string>;
  onToggleCohort: (id: string) => void;
  onToggleGroupAll: () => void;
}> = ({ run, cohorts, isExpanded, onToggle, selected, onToggleCohort, onToggleGroupAll }) => {
  const { t } = useTranslation();
  const allSel = cohorts.length > 0 && cohorts.every(c => selected.has(c.id));
  const someSel = cohorts.some(c => selected.has(c.id));

  return (
    <div className="rounded-xl border border-slate-200 overflow-hidden">
      {/* Group header */}
      <div className="flex items-center bg-slate-50">
        <button
          onClick={onToggle}
          className="flex-1 flex items-start gap-2 px-4 py-3 hover:bg-slate-100 transition-colors text-left"
        >
          {isExpanded
            ? <ChevronDown size={14} className="text-slate-400 shrink-0 mt-0.5" />
            : <ChevronRight size={14} className="text-slate-400 shrink-0 mt-0.5" />}
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-slate-700 truncate">{run.name}</p>
            <p className="text-[10px] text-slate-400 mt-0.5">{fmtTimestamp(run.timestamp)}</p>
            {run.comment && (
              <p className="text-[10px] text-slate-500 italic mt-0.5 truncate">"{run.comment}"</p>
            )}
          </div>
        </button>
        <button
          onClick={onToggleGroupAll}
          className="px-3 py-3 text-[10px] font-semibold text-indigo-600 hover:text-indigo-700 shrink-0 transition-colors"
        >
          {allSel ? 'Deselect' : someSel ? 'Select all' : 'Select all'}
        </button>
        <span className="pr-4 text-xs text-slate-400 shrink-0">{cohorts.length}</span>
      </div>

      {isExpanded && (
        <>
          {/* Run metadata */}
          <div className="px-4 py-3 bg-white border-b border-slate-100">
            <div className="flex flex-wrap gap-x-4 gap-y-1 text-[10px] text-slate-400">
              <span>{t('bulkdrawer_model')}<strong className="text-slate-600">{run.settings.model}</strong></span>
              <span>{t('bulkdrawer_horizon')}<strong className="text-slate-600">{run.settings.confidenceHorizon}m</strong></span>
              <span>{t('bulkdrawer_pre_unc')}<strong className="text-slate-600">{run.settings.preHorizonUncertainty}%</strong></span>
              <span>{t('bulkdrawer_post_exp')}<strong className="text-slate-600">{run.settings.postHorizonExpansionRate}% /mo</strong></span>
              <span>
                <span className={run.generated > 0 ? 'text-emerald-600' : 'text-slate-400'}>
                  {run.generated} generated
                </span>
                {run.failed > 0 && (
                  <span className="text-amber-600"> · {run.failed} skipped</span>
                )}
              </span>
            </div>
          </div>

          {/* Cohort list */}
          {cohorts.length > 0 ? (
            <div className="divide-y divide-slate-100">
              {cohorts.map(c => (
                <CohortRow
                  key={c.id}
                  cohort={c}
                  checked={selected.has(c.id)}
                  onToggle={() => onToggleCohort(c.id)}
                />
              ))}
            </div>
          ) : (
            <div className="px-4 py-3 text-xs text-slate-400 italic">{t('bulkdrawer_no_cohorts_from_this_run_are_currently_loaded')}</div>
          )}
        </>
      )}
    </div>
  );
};

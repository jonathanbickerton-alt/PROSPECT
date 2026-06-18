import React from 'react';
import { X, Database, CheckCircle2, AlertCircle } from 'lucide-react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface DataMappingDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  columns: string[];
  data: any[];
  // Column mappings
  wiDateCol: string;        setWiDateCol: (v: string) => void;
  wiMetricCol: string;      setWiMetricCol: (v: string) => void;
  wiValueCol: string;       setWiValueCol: (v: string) => void;
  wiArpuCol: string;        setWiArpuCol: (v: string) => void;
  wiRevenueCol: string;     setWiRevenueCol: (v: string) => void;
  // Metric identifiers
  wiInflowVal: string;      setWiInflowVal: (v: string) => void;
  wiOutflowVal: string;     setWiOutflowVal: (v: string) => void;
  wiBaseVal: string;        setWiBaseVal: (v: string) => void;
  wiRetentionVal: string;   setWiRetentionVal: (v: string) => void;
  // Segmentation columns
  wiSegmentCol: string;     setWiSegmentCol: (v: string) => void;
  wiProductCol: string;     setWiProductCol: (v: string) => void;
  wiProductL2Col?: string;  setWiProductL2Col?: (v: string) => void;
  wiChannelCol: string;     setWiChannelCol: (v: string) => void;
  wiChannelL2Col?: string;  setWiChannelL2Col?: (v: string) => void;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function SelectRow({
  label, value, onChange, columns, includeNone = false, hint,
}: {
  label: string; value: string; onChange: (v: string) => void;
  columns: string[]; includeNone?: boolean; hint?: string;
}) {
  return (
    <div>
      <label className="block text-xs font-semibold text-slate-700 mb-1">{label}</label>
      {hint && <p className="text-[10px] text-slate-400 mb-1">{hint}</p>}
      <select
        value={value}
        onChange={e => onChange(e.target.value)}
        className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 bg-slate-50 outline-none focus:border-[#e60000]/50 focus:ring-2 focus:ring-[#e60000]/10"
      >
        {includeNone && <option value="">None</option>}
        {columns.map(c => <option key={c} value={c}>{c}</option>)}
      </select>
    </div>
  );
}

function MetricSelectRow({
  label, value, onChange, options,
}: {
  label: string; value: string; onChange: (v: string) => void; options: string[];
}) {
  return (
    <div>
      <label className="block text-xs font-semibold text-slate-700 mb-1">{label}</label>
      <select
        value={value}
        onChange={e => onChange(e.target.value)}
        className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 bg-slate-50 outline-none focus:border-[#e60000]/50 focus:ring-2 focus:ring-[#e60000]/10"
      >
        <option value="">— Select —</option>
        {options.map(m => <option key={m} value={m}>{m}</option>)}
      </select>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function DataMappingDrawer({
  isOpen, onClose,
  columns, data,
  wiDateCol, setWiDateCol,
  wiMetricCol, setWiMetricCol,
  wiValueCol, setWiValueCol,
  wiArpuCol, setWiArpuCol,
  wiRevenueCol, setWiRevenueCol,
  wiInflowVal, setWiInflowVal,
  wiOutflowVal, setWiOutflowVal,
  wiBaseVal, setWiBaseVal,
  wiRetentionVal, setWiRetentionVal,
  wiSegmentCol, setWiSegmentCol,
  wiProductCol, setWiProductCol,
  wiProductL2Col = '', setWiProductL2Col,
  wiChannelCol, setWiChannelCol,
  wiChannelL2Col = '', setWiChannelL2Col,
}: DataMappingDrawerProps) {

  const uniqueMetrics = React.useMemo(
    () => wiMetricCol
      ? Array.from(new Set(data.map(r => String(r[wiMetricCol])).filter(v => v && v !== 'undefined'))).sort()
      : [],
    [data, wiMetricCol],
  );

  // Completeness badge
  const coreOk = !!(wiDateCol && wiMetricCol && wiValueCol && wiInflowVal && wiOutflowVal);

  return (
    <>
      {/* Backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/30 backdrop-blur-sm"
          onClick={onClose}
        />
      )}

      {/* Drawer */}
      <div
        className={`fixed top-0 right-0 h-full z-50 w-[420px] bg-white shadow-2xl flex flex-col transition-transform duration-300 ease-in-out ${
          isOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-slate-100 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-slate-100 flex items-center justify-center">
              <Database size={17} className="text-slate-600" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-900">Data Mapping &amp; Segmentation</h2>
              <p className="text-[11px] text-slate-500 mt-0.5">Map columns once — auto-detected on upload</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        {/* Status pill */}
        <div className="px-6 pt-4 shrink-0">
          <div className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium ${
            coreOk
              ? 'bg-emerald-50 text-emerald-700 border border-emerald-100'
              : 'bg-amber-50 text-amber-700 border border-amber-100'
          }`}>
            {coreOk
              ? <CheckCircle2 size={13} className="shrink-0" />
              : <AlertCircle size={13} className="shrink-0" />}
            {coreOk
              ? 'Core mapping complete — ready to forecast'
              : 'Complete core mapping below to enable forecasting'}
          </div>
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-7">

          {/* ── 1. Column mapping ── */}
          <section>
            <h3 className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-3">
              1 · Column Mapping
            </h3>
            <div className="space-y-3">
              <SelectRow label="Date Column" value={wiDateCol} onChange={setWiDateCol} columns={columns} />
              <SelectRow label="Metric / Dimension Column" value={wiMetricCol} onChange={setWiMetricCol} columns={columns}
                hint="The column that holds values like 'Inflow', 'Outflow', etc." />
              <SelectRow label="Subscriber Volume Column" value={wiValueCol} onChange={setWiValueCol} columns={columns} />
              <SelectRow label="ARPU Column" value={wiArpuCol} onChange={setWiArpuCol} columns={columns} includeNone
                hint="Optional — used to compute revenue-weighted ARPU" />
              <SelectRow label="Revenue Column" value={wiRevenueCol} onChange={setWiRevenueCol} columns={columns} includeNone
                hint="Optional — alternative to ARPU × volume" />
            </div>
          </section>

          {/* ── 2. Metric identifiers ── */}
          {wiMetricCol && (
            <section>
              <h3 className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-3">
                2 · Metric Identifiers
              </h3>
              <div className="space-y-3">
                <MetricSelectRow label="Inflow Identifier" value={wiInflowVal} onChange={setWiInflowVal} options={uniqueMetrics} />
                <MetricSelectRow label="Outflow Identifier" value={wiOutflowVal} onChange={setWiOutflowVal} options={uniqueMetrics} />
                <MetricSelectRow label="Base Identifier" value={wiBaseVal} onChange={setWiBaseVal} options={uniqueMetrics} />
                <MetricSelectRow label="Retention Identifier" value={wiRetentionVal} onChange={setWiRetentionVal} options={uniqueMetrics} />
              </div>
            </section>
          )}

          {/* ── 3. Segmentation ── */}
          <section>
            <h3 className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-1">
              3 · Segmentation Columns
            </h3>
            <p className="text-[11px] text-slate-400 mb-3">
              Optional — map dimension columns to enable per-cohort forecasting.
            </p>
            <div className="space-y-3">
              <SelectRow label="Customer Segment" value={wiSegmentCol} onChange={v => { setWiSegmentCol(v); }} columns={columns} includeNone />
              <SelectRow label="Product L1" value={wiProductCol} onChange={v => { setWiProductCol(v); }} columns={columns} includeNone />
              {wiProductCol && (
                <SelectRow label="Product L2 (optional)" value={wiProductL2Col} onChange={v => setWiProductL2Col?.(v)} columns={columns} includeNone />
              )}
              <SelectRow label="Channel L1" value={wiChannelCol} onChange={v => { setWiChannelCol(v); }} columns={columns} includeNone />
              {wiChannelCol && (
                <SelectRow label="Channel L2 (optional)" value={wiChannelL2Col} onChange={v => setWiChannelL2Col?.(v)} columns={columns} includeNone />
              )}
            </div>
          </section>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-100 shrink-0">
          <button
            onClick={onClose}
            className="w-full py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-sm font-semibold transition-colors"
          >
            Done
          </button>
        </div>
      </div>
    </>
  );
}

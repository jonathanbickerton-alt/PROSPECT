import React, { useState, useRef, useMemo, useEffect } from 'react';
import { collectEventScopeDims, hasAnyCarrierEvents, windowBounds, selectionUncoveredByBaseline, chartDrawability, MIN_DRAWABLE_CHART_PX } from '../utils/viewFilter';
import { buildPerFileEventPanels } from '../utils/forecasting';
import { EventsSummaryTable } from './EventsSummaryTable';
import { useTranslation } from 'react-i18next';
import { UploadCloud, X, AlertTriangle, FileSpreadsheet, ChevronDown } from 'lucide-react'; // ChevronDown used in Segment select
import { ResponsiveContainer, ComposedChart, CartesianGrid, XAxis, YAxis, Tooltip, Legend, Line, Brush } from 'recharts';
import type { ParsedSession } from '../workers/scenarioParser.worker';
import { computeScenarioForFilter } from '../utils/scenarioHelper';
import { HierarchicalDropdown, type HierarchicalSelection } from './HierarchicalDropdown';

const formatNumber = (v: number) => new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(v);


interface ScenarioCompareTabProps {
  globalSegments?: string[];
  globalProductTree?: Map<string, string[]>;
  globalChannelTree?: Map<string, string[]>;
  globalTariffTree?: Map<string, string[]>;
}

export const ScenarioCompareTab: React.FC<ScenarioCompareTabProps> = ({ globalSegments = [], globalProductTree = new Map(), globalChannelTree = new Map(), globalTariffTree = new Map() }) => {
  const { t } = useTranslation();
  const [parsedSessions, setParsedSessions] = useState<ParsedSession[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [warningMsg, setWarningMsg] = useState<string | null>(null);

  const [viewSegment, setViewSegment] = useState<string>('All');
  const [viewProduct, setViewProduct] = useState<HierarchicalSelection>({l1: null, l2: null});
  const [viewChannel, setViewChannel] = useState<HierarchicalSelection>({l1: null, l2: null});
  const [viewTariff, setViewTariff] = useState<HierarchicalSelection>({l1: null, l2: null});

  const [dimSource, setDimSource] = useState<'events' | 'baseline'>('events');

  const [activeScenarios, setActiveScenarios] = useState<Record<string, boolean>>({});
  const [scenarioNames, setScenarioNames] = useState<Record<string, string>>({});
  // COLLAPSED BY DEFAULT, and absence carries it: a file with no entry here is
  // closed. Seeding a key per file on load would work too and would then need
  // keeping in step with add/remove — this cannot fall out of step.
  const [openPanels, setOpenPanels] = useState<Record<string, boolean>>({});
  const [showBaseline, setShowBaseline] = useState(false);
  
  const [chartView, setChartView] = useState<'volume' | 'value'>('volume');
  const [activeVolumeKpis, setActiveVolumeKpis] = useState<('inflow' | 'outflow' | 'retention' | 'base')[]>(['base']);
  const [activeValueKpis, setActiveValueKpis] = useState<('arpu')[]>(['arpu']);
  
  const [windowSize, setWindowSize] = useState<number | 'all'>('all');
  const [windowOffset, setWindowOffset] = useState(0);
  
  const workerRef = useRef<Worker | null>(null);

  useEffect(() => {
    workerRef.current = new Worker(new URL('../workers/scenarioParser.worker.ts', import.meta.url), { type: 'module' });
    workerRef.current.onmessage = (e) => {
      const results: ParsedSession[] = e.data;
      setParsedSessions(prev => {
        const next = [...prev, ...results];
        const newActives: Record<string, boolean> = {};
        const newNames: Record<string, string> = {};
        next.forEach(s => {
          newActives[s.fileName] = true;
          if (!prev.find(p => p.fileName === s.fileName)) {
            newNames[s.fileName] = s.fileName; // default name
          }
        });
        setActiveScenarios(newActives);
        setScenarioNames(pn => ({...pn, ...newNames}));
        return next;
      });
      setIsLoading(false);
    };
    return () => {
      workerRef.current?.terminate();
    };
  }, []);

  const handleFiles = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []) as File[];
    if (!files.length) return;
    
    if (parsedSessions.length + files.length > 4) {
      alert("You can select up to 4 scenario files to compare.");
      return;
    }
    
    // Check total size
    const totalSize = files.reduce((s, f) => s + f.size, 0);
    if (totalSize > 200 * 1024 * 1024) {
      setWarningMsg('Warning: Loading multiple large files may slow down performance or risk browser memory limits.');
    } else {
      setWarningMsg(null);
    }
    
    setIsLoading(true);
    const readPromises = files.map(f => {
      return new Promise<{buffer: ArrayBuffer, name: string}>((resolve) => {
        const reader = new FileReader();
        reader.onload = (evt) => {
          resolve({ buffer: evt.target?.result as ArrayBuffer, name: f.name });
        };
        reader.readAsArrayBuffer(f);
      });
    });
    
    Promise.all(readPromises).then(results => {
      const fileBuffers = results.map(r => r.buffer);
      const fileNames = results.map(r => r.name);
      workerRef.current?.postMessage({ fileBuffers, fileNames });
    });
    
    e.target.value = '';
  };

  /**
   * THE TYPED PARSE, ONE PASS PER FILE LOAD.
   *
   * A Scenario Compare upload IS a PROSPECT save — the worker reads it by
   * sheet name from a workbook this app wrote — so the market rows go through
   * the seam with source 'session': stored ids are restored, a stored blank
   * stays blank, and no sign transform is applied. Passing 'workbook' here
   * would mint new ids and negate Outflow volumes that are already signed.
   *
   * IN THE TAB RATHER THAN THE WORKER, and measured rather than assumed: the
   * parse costs 0.50 ms for 1,200 events across four files (3.24 ms at 12,000,
   * far beyond anything real). The expensive half — the xlsx decode — is
   * already in the worker; moving this half across would pull forecasting.ts
   * into a second bundle to save half a millisecond.
   *
   * The memo depends on parsedSessions ALONE, so it runs once per file load
   * and not on filter changes, chart toggles or renames.
   */
  const perFileSummaries = useMemo(
    () => buildPerFileEventPanels(parsedSessions, t), [parsedSessions, t]);

  const removeSession = (name: string) => {
    setParsedSessions(prev => prev.filter(s => s.fileName !== name));
    setActiveScenarios(prev => {
      const next = {...prev};
      delete next[name];
      return next;
    });
  };

  // Extract dimensions
  const dims = useMemo(() => {
    const segs = new Set<string>();
    const productTree = new Map<string, Set<string>>();
    const channelTree = new Map<string, Set<string>>();
    const tariffTree = new Map<string, Set<string>>();

    // ALL THREE CARRIERS, through the shared collector. This read
    // `s.marketEvents` alone, so a scope value that existed only on a pricing
    // or yield event was missing from the filter and could not be selected —
    // Jon's files offered Mobile Data and Fixed Connectivity but not Mobile
    // Voice, which lived on a pricing event. The three sheets disagree about
    // their column names and about which dimensions they even have, and the
    // collector owns that; the component does not repeat it.
    const hasNoEvents = !hasAnyCarrierEvents(parsedSessions);

    if (!(dimSource === 'baseline' || hasNoEvents)) {
      const fromEvents = collectEventScopeDims(parsedSessions);
      fromEvents.segments.forEach(v => segs.add(v));
      fromEvents.productTree.forEach((l2s, l1) => {
        if (!productTree.has(l1)) productTree.set(l1, new Set());
        l2s.forEach(l2 => productTree.get(l1)!.add(l2));
      });
      fromEvents.channelTree.forEach((l2s, l1) => {
        if (!channelTree.has(l1)) channelTree.set(l1, new Set());
        l2s.forEach(l2 => channelTree.get(l1)!.add(l2));
      });
      fromEvents.tariffTree.forEach((l2s, l1) => {
        if (!tariffTree.has(l1)) tariffTree.set(l1, new Set());
        l2s.forEach(l2 => tariffTree.get(l1)!.add(l2));
      });
    } else {
      // Baseline side, untouched: the cohort rows drive the options.
      parsedSessions.forEach(s => {
        s.baselineRows.forEach((r: any) => {
          if (r.Segment && r.Segment !== 'All') segs.add(r.Segment);
          if (r.Product && r.Product !== 'All') {
            if (!productTree.has(r.Product)) productTree.set(r.Product, new Set());
            if (r.Product_L2 && r.Product_L2 !== 'All') productTree.get(r.Product)!.add(r.Product_L2);
          }
          if (r.Channel && r.Channel !== 'All') {
            if (!channelTree.has(r.Channel)) channelTree.set(r.Channel, new Set());
            if (r.Channel_L2 && r.Channel_L2 !== 'All') channelTree.get(r.Channel)!.add(r.Channel_L2);
          }
          if (r.Tariff_L1 && r.Tariff_L1 !== 'All') {
            if (!tariffTree.has(r.Tariff_L1)) tariffTree.set(r.Tariff_L1, new Set());
            if (r.Tariff_L2 && r.Tariff_L2 !== 'All') tariffTree.get(r.Tariff_L1)!.add(r.Tariff_L2);
          }
        });
      });
    }
    if (dimSource === 'baseline' || hasNoEvents) {
      globalSegments.forEach(s => segs.add(s));
      globalProductTree.forEach((l2s, l1) => {
        if (!productTree.has(l1)) productTree.set(l1, new Set());
        l2s.forEach(l2 => productTree.get(l1)!.add(l2));
      });
      globalChannelTree.forEach((l2s, l1) => {
        if (!channelTree.has(l1)) channelTree.set(l1, new Set());
        l2s.forEach(l2 => channelTree.get(l1)!.add(l2));
      });
      globalTariffTree.forEach((l2s, l1) => {
        if (!tariffTree.has(l1)) tariffTree.set(l1, new Set());
        l2s.forEach(l2 => tariffTree.get(l1)!.add(l2));
      });
    }

    const pTree = new Map<string, string[]>();
    for (const [l1, l2s] of productTree.entries()) {
      pTree.set(l1, Array.from(l2s).sort());
    }

    const cTree = new Map<string, string[]>();
    for (const [l1, l2s] of channelTree.entries()) {
      cTree.set(l1, Array.from(l2s).sort());
    }

    const tTree = new Map<string, string[]>();
    for (const [l1, l2s] of tariffTree.entries()) {
      tTree.set(l1, Array.from(l2s).sort());
    }

    return {
      segments: Array.from(segs).sort(),
      productTree: pTree,
      channelTree: cTree,
      tariffTree: tTree
    };
  }, [parsedSessions, dimSource, globalSegments, globalProductTree, globalChannelTree, globalTariffTree]);

  // Compute computed data
  const chartData = useMemo(() => {
    if (!parsedSessions.length) return [];
    
    const allComputed = parsedSessions.map(session => {
      if (!activeScenarios[session.fileName]) return null;
      return {
        fileName: session.fileName,
        data: computeScenarioForFilter(session, viewSegment, viewProduct, viewChannel, viewTariff)
      };
    }).filter(Boolean);

    if (!allComputed.length) return [];
    
    // Merge by month
    const monthMap = new Map<string, any>();
    allComputed.forEach(({ fileName, data }) => {
      data.forEach((row: any) => {
        if (!monthMap.has(row.month)) {
          monthMap.set(row.month, { month: row.month });
        }
        const m = monthMap.get(row.month);
        m[`${fileName}_Base`] = row.adjustedBase;
        m[`${fileName}_Inflow`] = row.adjustedInflow;
        m[`${fileName}_Outflow`] = row.adjustedOutflow;
        m[`${fileName}_Retention`] = row.adjustedRetention;
        m[`${fileName}_ARPU`] = row.adjustedArpu;
        if (showBaseline) {
          m[`${fileName}_BaselineBase`] = row.baselineBase;
          m[`${fileName}_BaselineInflow`] = row.baselineInflow;
          m[`${fileName}_BaselineOutflow`] = row.baselineOutflow;
          m[`${fileName}_BaselineRetention`] = row.baselineRetention;
          m[`${fileName}_BaselineARPU`] = row.baselineArpu;
        }
      });
    });
    return Array.from(monthMap.values()).sort((a, b) => a.month.localeCompare(b.month));
  }, [parsedSessions, viewSegment, viewProduct, viewChannel, viewTariff, activeScenarios, showBaseline]);

  /**
   * THE WINDOW, DERIVED ONCE from the shared function rather than as two
   * disagreeing JSX expressions. See windowBounds: startIndex used to be
   * unclamped while endIndex was clamped, which is how a stale offset produced
   * a chart with axes and no lines.
   */
  /**
   * THE MEASURED HEIGHT OF THE PLOTTING AREA.
   *
   * Null until the observer first fires. The predicate treats that as
   * drawable on purpose — see chartDrawability — so nothing flashes a fault
   * on the first paint.
   */
  const chartAreaRef = useRef<HTMLDivElement | null>(null);
  const [chartAreaPx, setChartAreaPx] = useState<number | null>(null);

  useEffect(() => {
    const el = chartAreaRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(entries => {
      for (const e of entries) setChartAreaPx(e.contentRect.height);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [chartData.length > 0]);

  const brush = useMemo(
    () => windowBounds(windowOffset, windowSize, chartData.length),
    [windowOffset, windowSize, chartData.length]);

  /**
   * AN OFFSET BELONGS TO THE DATASET IT WAS DRAGGED ON.
   *
   * The trigger is the DATA LENGTH, not the filter identity, and the weaker
   * trigger is the correct one: an offset valid for a 24-month series stays
   * valid for any other 24-month series, so resetting on every filter touch
   * would throw away a window the user had set for no reason at all. Length is
   * exactly the condition under which an offset can stop being meaningful.
   *
   * windowBounds already makes a stale offset SAFE by clamping it. This makes
   * it PREDICTABLE: without the reset a clamped offset pins the view to the
   * final month, which is a strange place to land after changing a filter.
   */
  useEffect(() => { setWindowOffset(0); }, [chartData.length]);

  /**
   * WHICH BLANK IS THIS? Computed once, read by the empty state. The selection
   * came from the events vocabulary and the baseline does not cover it — a
   * different situation from an ordinary empty result, and a different sentence.
   */
  const uncoveredByBaseline = useMemo(
    () => selectionUncoveredByBaseline(
      { segment: viewSegment, product: viewProduct.l1, channel: viewChannel.l1 },
      parsedSessions),
    [viewSegment, viewProduct.l1, viewChannel.l1, parsedSessions]);

  /** The fourth state: enough data to draw, not enough room to draw it in. */
  const drawability = chartDrawability(chartData.length, chartAreaPx);

  const COLORS = ['#3b82f6', '#ef4444', '#10b981', '#f59e0b'];

  return (
    <div className="flex-1 overflow-auto bg-slate-50 p-6 flex flex-col h-full">
      <div className="max-w-[1400px] mx-auto w-full flex flex-col h-full">
        <div className="flex items-center justify-between mb-4 shrink-0">
          <div>
            <h2 className="text-2xl font-bold text-slate-900">{t('compare_scenario_compare')}</h2>
            <p className="text-slate-500 text-sm mt-1">{t('compare_upload_multiple_session_files_to_compare_thei')}</p>
          </div>
          <label className="px-4 py-2 bg-[#e60000] hover:bg-[#cc0000] text-white font-medium text-sm rounded-lg shadow-sm transition-colors cursor-pointer flex items-center gap-2">
            <UploadCloud size={18} />
            {isLoading ? t('compare_processing') : t('compare_load_session_file_max_4')}
            <input type="file" multiple accept=".xlsx" className="hidden" onChange={handleFiles} disabled={isLoading || parsedSessions.length >= 4} />
          </label>
        </div>

        {warningMsg && (
          <div className="mb-4 bg-amber-50 border border-amber-200 text-amber-800 p-3 rounded-lg flex items-start gap-2 shrink-0">
            <AlertTriangle className="shrink-0 mt-0.5" size={16} />
            <span className="text-sm">{warningMsg}</span>
          </div>
        )}

        {parsedSessions.length === 0 && !isLoading && (
          <div className="flex-1 flex flex-col items-center justify-center border-2 border-dashed border-slate-300 rounded-xl bg-white/50">
            <FileSpreadsheet size={48} className="text-slate-300 mb-4" />
            <p className="text-slate-500 font-medium">{t('compare_no_session_files_loaded')}</p>
            <p className="text-slate-400 text-sm max-w-sm text-center mt-2">{t('compare_export_your_adjusted_forecasts_via_actuals_re')}</p>
          </div>
        )}

        {parsedSessions.length > 0 && (
          <div className="flex-1 flex flex-col gap-4 min-h-0">
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm shrink-0 flex flex-col gap-4">
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-6 items-center">
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-semibold text-slate-500 uppercase flex justify-between">
                    Segment
                    {viewSegment !== 'All' && (
                      <button onClick={() => setViewSegment('All')} className="text-[#e60000] hover:underline text-[10px]">{t('compare_clear')}</button>
                    )}
                  </label>
                  <div className="relative">
                    <select
                      value={viewSegment}
                      onChange={e => setViewSegment(e.target.value)}
                      className="w-full appearance-none bg-white border border-slate-200 text-sm pl-3 pr-8 py-1.5 rounded-lg text-slate-700 outline-none focus:border-[#e60000] transition-colors"
                    >
                      <option value="All">{t('common_all_segments')}</option>
                      {dims.segments.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                    <ChevronDown size={14} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                  </div>
                </div>
                <HierarchicalDropdown
                  label={t('common_product')}
                  tree={dims.productTree}
                  value={viewProduct}
                  onChange={setViewProduct}
                  variant="light"
                />
                <HierarchicalDropdown
                  label={t('common_channel')}
                  tree={dims.channelTree}
                  value={viewChannel}
                  onChange={setViewChannel}
                  variant="light"
                />
                {dims.tariffTree.size > 0 && (
                  <HierarchicalDropdown
                    label={t('common_tariff')}
                    tree={dims.tariffTree}
                    value={viewTariff}
                    onChange={setViewTariff}
                    variant="light"
                  />
                )}

                <div className="ml-auto flex flex-col gap-2 items-end">
                  <div className="flex items-center gap-2">
                    <input type="checkbox" id="sc_bl" checked={showBaseline} onChange={e => setShowBaseline(e.target.checked)} className="rounded border-slate-300 text-[#e60000] focus:ring-[#e60000]" />
                    <label htmlFor="sc_bl" className="text-sm font-medium text-slate-700 select-none cursor-pointer">{t('compare_show_baseline_dotted')}</label>
                  </div>
                </div>
              </div>
              
              {!hasAnyCarrierEvents(parsedSessions) && (
                <div className="flex items-center gap-4 bg-amber-50 border border-amber-200 p-2 rounded-lg mt-2">
                  <AlertTriangle className="text-amber-600" size={16} />
                  <span className="text-sm text-amber-800 font-medium">{t('compare_no_market_events_found_in_loaded_sessions')}</span>
                  
                  <div className="flex items-center gap-3 ml-auto">
                    <span className="text-xs font-semibold text-amber-700 uppercase">{t('compare_populate_filters_from')}</span>
                    <label className="flex items-center gap-1.5 text-xs text-amber-900 cursor-pointer">
                      <input type="radio" value="baseline" checked={dimSource === 'baseline' || !hasAnyCarrierEvents(parsedSessions)} onChange={() => setDimSource('baseline')} className="accent-amber-600 w-3.5 h-3.5" />{t('compare_baseline_forecasts')}</label>
                  </div>
                </div>
              )}
              {parsedSessions.some(s => s.marketEvents.length > 0) && (
                <div className="flex items-center gap-3 pt-2 border-t border-slate-100">
                  <span className="text-xs font-semibold text-slate-500 uppercase">{t('compare_populate_filters_from')}</span>
                  <label className="flex items-center gap-1.5 text-xs text-slate-700 cursor-pointer">
                    <input type="radio" value="events" checked={dimSource === 'events'} onChange={() => setDimSource('events')} className="accent-[#e60000] w-3.5 h-3.5" />{t('compare_events_only')}</label>
                  <label className="flex items-center gap-1.5 text-xs text-slate-700 cursor-pointer">
                    <input type="radio" value="baseline" checked={dimSource === 'baseline'} onChange={() => setDimSource('baseline')} className="accent-[#e60000] w-3.5 h-3.5" />{t('compare_baseline_forecasts_all')}</label>
                </div>
              )}
            </div>

            {/* KPI Toggles */}
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm shrink-0 flex flex-col md:flex-row gap-4 items-start md:items-center">
              <div className="flex bg-slate-100 p-1 rounded-xl shrink-0">
                {(['all', 6, 12, 18, 24] as const).map(size => (
                  <button
                    key={size}
                    onClick={() => setWindowSize(size)}
                    className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${windowSize === size ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                  >
                    {size === 'all' ? t('compare_window_all_time') : t('compare_window_months', { n: size })}
                  </button>
                ))}
              </div>

              <div className="h-6 w-px bg-slate-200 hidden md:block"></div>

              <div className="flex bg-slate-100 p-1 rounded-xl shrink-0">
                <button
                  onClick={() => setChartView('volume')}
                  className={`px-4 py-1.5 text-xs font-semibold rounded-lg transition-colors ${chartView === 'volume' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                >{t('compare_volumes')}</button>
                <button
                  onClick={() => setChartView('value')}
                  className={`px-4 py-1.5 text-xs font-semibold rounded-lg transition-colors ${chartView === 'value' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                >{t('common_value')}</button>
              </div>

              <div className="flex flex-wrap gap-2">
                {chartView === 'volume' ? (
                  (['inflow', 'outflow', 'retention', 'base'] as const).map(sc => {
                    const active = activeVolumeKpis.includes(sc);
                    return (
                      <button
                        key={sc}
                        onClick={() => setActiveVolumeKpis(prev => active && prev.length > 1 ? prev.filter(x => x !== sc) : prev.includes(sc) ? prev : [...prev, sc])}
                        className={`text-[10px] font-semibold px-2 py-1 rounded border transition-colors ${
                          active
                            ? 'bg-[#e60000]/10 text-[#e60000] border-[#e60000]'
                            : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50'
                        }`}
                      >
                        {sc.charAt(0).toUpperCase() + sc.slice(1)}
                      </button>
                    );
                  })
                ) : (
                  (['arpu'] as const).map(sc => {
                    const active = activeValueKpis.includes(sc);
                    return (
                      <button
                        key={sc}
                        onClick={() => setActiveValueKpis(prev => active && prev.length > 1 ? prev.filter(x => x !== sc) : prev.includes(sc) ? prev : [...prev, sc])}
                        className={`text-[10px] font-semibold px-2 py-1 rounded border transition-colors ${
                          active
                            ? 'bg-[#e60000]/10 text-[#e60000] border-[#e60000]'
                            : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50'
                        }`}
                      >
                        ARPU
                      </button>
                    );
                  })
                )}
              </div>
            </div>

            {/* THE FLOOR. This card is the ONLY flex-1 among shrink-0 siblings
                in a height-capped column, so every pixel they take comes out of
                it — and min-h-0 let it reach ZERO, at which point the SVG had no
                height and the region showed nothing at all: no lines, no axis,
                no message, no scrollbar. A third loaded file was enough.
                min-h-[320px] stops the collapse; the column then overflows into
                the root's overflow-auto, so the user gets a SCROLLBAR — a stated
                condition — instead of an absence. See the 2026-08-20 diagnosis. */}
            <div className="flex-1 bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex flex-col min-h-[320px]">
              <h3 className="font-semibold text-slate-800 mb-4 shrink-0">{chartView === 'volume' ? t('compare_subscriber_volumes') : 'ARPU'}</h3>
              {chartData.length > 0 ? (
                <div className="flex-1 min-h-0 relative" ref={chartAreaRef}>
                  {/* THE FOURTH STATE. The other three describe an empty
                      RESULT; this one describes an undrawable REGION — the data
                      is fine and there is no room to show it. It must be said
                      out loud, because the failure it replaces was invisible. */}
                  {drawability === 'too-short' && (
                    <div className="absolute inset-0 z-10 flex items-center justify-center bg-white/95 text-center px-4">
                      <p className="text-xs text-slate-500 max-w-md" data-testid="compare-chart-too-short">
                        {t('compare_chart_too_short')}
                      </p>
                    </div>
                  )}
                  <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart data={chartData} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                      <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#64748b' }} tickMargin={12} minTickGap={30} />
                      <YAxis yAxisId="left" domain={['auto', 'auto']} tick={{ fontSize: 11, fill: '#64748b' }} tickFormatter={(v) => formatNumber(v)} width={80} />
                      {chartView === 'value' && <YAxis yAxisId="right" orientation="right" domain={['auto', 'auto']} tick={{ fontSize: 11, fill: '#64748b' }} tickFormatter={(v) => `£${parseFloat(v).toFixed(2)}`} width={60} />}
                      <Tooltip
                        contentStyle={{ borderRadius: '8px', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)', fontSize: '12px' }}
                        formatter={(value: any, name: string) => {
                          if (name.includes('ARPU')) return [`£${Number(value).toFixed(2)}`, name];
                          return [formatNumber(value), name];
                        }}
                      />
                      <Legend wrapperStyle={{ fontSize: '12px', paddingTop: '20px' }} />
                      
                      {parsedSessions.map((session, i) => {
                         const color = COLORS[i % COLORS.length];
                         const displayName = scenarioNames[session.fileName] || session.fileName;
                         if (!activeScenarios[session.fileName]) return null;
                         
                         const lines: any[] = [];
                         if (chartView === 'volume') {
                           const KPI_MAP = {
                             inflow: 'Inflow', outflow: 'Outflow', retention: 'Retention', base: 'Base'
                           };
                           const STROKE_MAP = {
                             inflow: '8 8', outflow: '16 4', retention: '4 4', base: ''
                           }; // Use different dashes/dots for volume metrics if multiple are active to distinguish them

                           activeVolumeKpis.forEach((kpi, kpiIdx) => {
                             const KpiName = KPI_MAP[kpi];
                             const dashArray = STROKE_MAP[kpi];
                             
                             if (showBaseline) {
                               lines.push(
                                 <Line key={`bl_${session.fileName}_${kpi}`} yAxisId="left" type="monotone" dataKey={`${session.fileName}_Baseline${KpiName}`} name={`${displayName} (Baseline ${KpiName})`} stroke={color} strokeWidth={1} strokeDasharray="2 6" dot={false} opacity={0.4} />
                               );
                             }
                             lines.push(
                               <Line key={`adj_${session.fileName}_${kpi}`} yAxisId="left" type="monotone" dataKey={`${session.fileName}_${KpiName}`} name={`${displayName} (${KpiName})`} stroke={color} strokeWidth={kpi === 'base' ? 3 : 2} strokeDasharray={dashArray} dot={false} activeDot={{ r: 4 }} opacity={1 - (kpiIdx * 0.15)} />
                             );
                           });
                         } else {
                           // value
                           activeValueKpis.forEach(kpi => {
                             if (kpi === 'arpu') {
                               if (showBaseline) {
                                  lines.push(
                                    <Line key={`bl_arpu_${session.fileName}`} yAxisId="right" type="monotone" dataKey={`${session.fileName}_BaselineARPU`} name={`${displayName} (Baseline ARPU)`} stroke={color} strokeWidth={1} strokeDasharray="2 6" dot={false} opacity={0.4} />
                                  );
                               }
                               lines.push(
                                 <Line key={`adj_arpu_${session.fileName}`} yAxisId="right" type="monotone" dataKey={`${session.fileName}_ARPU`} name={`${displayName} (ARPU)`} stroke={color} strokeWidth={2} strokeDasharray="10 5" dot={false} opacity={0.8} />
                               );
                             }
                           });
                         }
                         return <React.Fragment key={session.fileName}>{lines}</React.Fragment>;
                      })}
                      
                      <Brush
                        dataKey="month"
                        height={28}
                        stroke="#cbd5e1"
                        startIndex={brush.start}
                        endIndex={brush.end}
                        onChange={(obj: any) => {
                          if (obj && typeof obj.startIndex === 'number' && typeof obj.endIndex === 'number') {
                            setWindowOffset(obj.startIndex);
                            setWindowSize(obj.endIndex - obj.startIndex + 1);
                          }
                        }}
                        tickFormatter={() => ''}
                      />
                    </ComposedChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div className="flex-1 flex items-center justify-center text-slate-400 text-sm">
                  {/* THREE CAUSES, THREE SENTENCES. Nothing plotted at all is
                      one thing; a selection the baseline cannot cover is
                      another, and it is the one a user cannot diagnose alone
                      — the events are real, the forecast rows are not there. */}
                  {!parsedSessions.some(s => activeScenarios[s.fileName])
                    ? t('compare_check_at_least_one_scenario_below_to_display')
                    : uncoveredByBaseline
                      ? t('compare_events_scope_not_in_baseline')
                      : t('compare_no_data_for_selected_filters')}
                </div>
              )}
            </div>

            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm shrink-0 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {parsedSessions.map((s, i) => (
                <div key={s.fileName} className="flex gap-3 p-3 rounded-lg border border-slate-100 bg-slate-50 relative group">
                  <div className="w-4 h-4 mt-2 shrink-0 rounded-full" style={{ backgroundColor: COLORS[i % COLORS.length] }}></div>
                  <div className="overflow-hidden flex-1 flex flex-col gap-1.5">
                    <input 
                      type="text" 
                      value={scenarioNames[s.fileName] || s.fileName}
                      onChange={e => setScenarioNames(pn => ({...pn, [s.fileName]: e.target.value}))}
                      className="text-xs font-semibold text-slate-800 bg-transparent border-b border-dashed border-slate-300 focus:border-[#e60000] focus:outline-none w-full pb-0.5"
                      title={s.fileName}
                    />
                    <div className="flex items-center gap-2 mt-0.5">
                      <input 
                        type="checkbox" 
                        id={`show_${s.fileName}`}
                        checked={activeScenarios[s.fileName]} 
                        onChange={e => setActiveScenarios(prev => ({...prev, [s.fileName]: e.target.checked}))}
                        className="rounded border-slate-300 text-[#e60000] focus:ring-[#e60000] cursor-pointer w-3.5 h-3.5"
                      />
                      <label htmlFor={`show_${s.fileName}`} className="text-[10px] text-slate-500 select-none cursor-pointer">{t('compare_plot_on_chart')}</label>
                    </div>
                  </div>
                  <button 
                    onClick={() => removeSession(s.fileName)}
                    className="absolute right-2 top-2 p-1 text-slate-400 hover:text-slate-600 hover:bg-slate-200 rounded opacity-0 group-hover:opacity-100 transition-opacity"
                    title={t('compare_remove_session')}
                  >
                    <X size={14} />
                  </button>
                </div>
              ))}
            </div>

            {/* ── R6 — ONE EVENTS SUMMARY PER LOADED FILE ──────────────────
                BELOW the file cards, stacked, one panel per file. Beside each
                card was the alternative and was rejected: the cards sit in a
                four-across grid, so a table inside one would be ~200px wide
                and the Scope column — the widest and the one that says which
                cohort an event hits — would be unreadable.

                PER FILE, never merged. Telling files apart is the entire job
                of this tab; one combined table would answer a question nobody
                asked and hide the one they did.

                It DESCRIBES. Every row comes from buildEventsSummaryRows —
                the same builder the What-If tab uses, calling the same four
                summarisers — so nothing here recomputes what an event does
                and there is no fifth copy to drift. */}
            {perFileSummaries.length > 0 && (
              <div className="flex flex-col gap-2 shrink-0" data-testid="compare-events-panels">
                <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  {t('compare_events_per_file')}
                </span>
                {perFileSummaries.map(f => (
                  <EventsSummaryTable
                    key={f.fileName}
                    rows={f.rows}
                    t={t}
                    open={!!openPanels[f.fileName]}
                    onToggle={() => setOpenPanels(o => ({ ...o, [f.fileName]: !o[f.fileName] }))}
                    title={scenarioNames[f.fileName] || f.fileName}
                    testIdPrefix={`compare-events-${f.fileName}`}
                    dense
                  />
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

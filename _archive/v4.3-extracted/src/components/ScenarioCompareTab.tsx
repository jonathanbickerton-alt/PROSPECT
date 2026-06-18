import React, { useState, useRef, useMemo, useEffect } from 'react';
import { UploadCloud, X, AlertTriangle, FileSpreadsheet, ChevronDown } from 'lucide-react';
import { ResponsiveContainer, ComposedChart, CartesianGrid, XAxis, YAxis, Tooltip, Legend, Line, Brush } from 'recharts';
import type { ParsedSession } from '../workers/scenarioParser.worker';
import { computeScenarioForFilter } from '../utils/scenarioHelper';
import { HierarchicalDropdown, type HierarchicalSelection } from './HierarchicalDropdown';

const formatNumber = (v: number) => new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(v);

interface HierarchicalDropdownProps {
  label: string;
  value: { l1: string | null; l2: string | null } | string;
  onChange: (val: any) => void;
  options: string[];
  tree?: Record<string, string[]>;
  allowL2?: boolean;
}

// Minimal HierarchicalDropdown wrapper for the View filter
const Dropdown: React.FC<HierarchicalDropdownProps> = ({ label, value, onChange, options, tree, allowL2 }) => {
  const isObj = typeof value === 'object' && value !== null;
  const l1 = isObj ? (value as any).l1 : (value === 'All' ? null : value);
  const l2 = isObj ? (value as any).l2 : null;

  return (
    <div className="flex flex-col gap-1">
      <label className="text-xs font-semibold text-slate-500 uppercase flex justify-between">
        {label}
        {(!allowL2 && l1) && (
           <button onClick={() => onChange('All')} className="text-[#e60000] hover:underline text-[10px]">Clear</button>
        )}
        {(allowL2 && (l1 || l2)) && (
           <button onClick={() => onChange({ l1: null, l2: null })} className="text-[#e60000] hover:underline text-[10px]">Clear</button>
        )}
      </label>
      <div className="relative">
        <select
          value={allowL2 ? (l2 ? `${l1}::${l2}` : (l1 || 'All')) : (l1 || 'All')}
          onChange={(e) => {
            const v = e.target.value;
            if (v === 'All') {
               onChange(allowL2 ? { l1: null, l2: null } : 'All');
            } else if (v.includes('::')) {
               const [nl1, nl2] = v.split('::');
               onChange({ l1: nl1, l2: nl2 });
            } else {
               onChange(allowL2 ? { l1: v, l2: null } : v);
            }
          }}
          className="w-full appearance-none bg-white border border-slate-200 text-sm pl-3 pr-8 py-1.5 rounded-lg text-slate-700 outline-none focus:border-[#e60000] transition-colors"
        >
          <option value="All">All {label}s</option>
          {allowL2 && tree ? (
            Object.entries(tree).map(([parent, children]) => (
              <optgroup key={parent} label={parent}>
                <option value={parent}>{parent} (All)</option>
                {(children as string[]).map((child: string) => <option key={`${parent}::${child}`} value={`${parent}::${child}`}>— {child}</option>)}
              </optgroup>
            ))
          ) : (
            options.map(o => <option key={o} value={o}>{o}</option>)
          )}
        </select>
        <ChevronDown size={14} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
      </div>
    </div>
  );
};

interface ScenarioCompareTabProps {
  globalSegments?: string[];
  globalProductTree?: Map<string, string[]>;
  globalChannelTree?: Map<string, string[]>;
}

export const ScenarioCompareTab: React.FC<ScenarioCompareTabProps> = ({ globalSegments = [], globalProductTree = new Map(), globalChannelTree = new Map() }) => {
  const [parsedSessions, setParsedSessions] = useState<ParsedSession[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [warningMsg, setWarningMsg] = useState<string | null>(null);
  
  const [viewSegment, setViewSegment] = useState<string>('All');
  const [viewProduct, setViewProduct] = useState<HierarchicalSelection>({l1: null, l2: null});
  const [viewChannel, setViewChannel] = useState<HierarchicalSelection>({l1: null, l2: null});

  const [dimSource, setDimSource] = useState<'events' | 'baseline'>('events');

  const [activeScenarios, setActiveScenarios] = useState<Record<string, boolean>>({});
  const [scenarioNames, setScenarioNames] = useState<Record<string, string>>({});
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

    const hasNoEvents = parsedSessions.every(s => s.marketEvents.length === 0);

    parsedSessions.forEach(s => {
      const sourceRows = (dimSource === 'baseline' || hasNoEvents) ? s.baselineRows : s.marketEvents;
      
      sourceRows.forEach(r => {
        if (r.Segment && r.Segment !== 'All') segs.add(r.Segment);
        
        if (r.Product && r.Product !== 'All') {
          if (!productTree.has(r.Product)) productTree.set(r.Product, new Set());
          if (r.Product_L2 && r.Product_L2 !== 'All') {
            productTree.get(r.Product)!.add(r.Product_L2);
          }
        }
        
        if (r.Channel && r.Channel !== 'All') {
          if (!channelTree.has(r.Channel)) channelTree.set(r.Channel, new Set());
          if (r.Channel_L2 && r.Channel_L2 !== 'All') {
            channelTree.get(r.Channel)!.add(r.Channel_L2);
          }
        }
      });
    });

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
    }

    const pTree = new Map<string, string[]>();
    for (const [l1, l2s] of productTree.entries()) {
      pTree.set(l1, Array.from(l2s).sort());
    }
    
    const cTree = new Map<string, string[]>();
    for (const [l1, l2s] of channelTree.entries()) {
      cTree.set(l1, Array.from(l2s).sort());
    }

    return {
      segments: Array.from(segs).sort(),
      productTree: pTree,
      channelTree: cTree
    };
  }, [parsedSessions, dimSource, globalSegments, globalProductTree, globalChannelTree]);

  // Compute computed data
  const chartData = useMemo(() => {
    if (!parsedSessions.length) return [];
    
    const allComputed = parsedSessions.map(session => {
      if (!activeScenarios[session.fileName]) return null;
      return {
        fileName: session.fileName,
        data: computeScenarioForFilter(session, viewSegment, viewProduct, viewChannel)
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
  }, [parsedSessions, viewSegment, viewProduct, viewChannel, activeScenarios, showBaseline]);

  const COLORS = ['#3b82f6', '#ef4444', '#10b981', '#f59e0b'];

  return (
    <div className="flex-1 overflow-auto bg-slate-50 p-6 flex flex-col h-full">
      <div className="max-w-[1400px] mx-auto w-full flex flex-col h-full">
        <div className="flex items-center justify-between mb-4 shrink-0">
          <div>
            <h2 className="text-2xl font-bold text-slate-900">Scenario Compare</h2>
            <p className="text-slate-500 text-sm mt-1">Upload multiple session files to compare their adjusted Base & ARPU trajectories.</p>
          </div>
          <label className="px-4 py-2 bg-[#e60000] hover:bg-[#cc0000] text-white font-medium text-sm rounded-lg shadow-sm transition-colors cursor-pointer flex items-center gap-2">
            <UploadCloud size={18} />
            {isLoading ? 'Processing...' : 'Load Session File (Max 4)'}
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
            <p className="text-slate-500 font-medium">No session files loaded</p>
            <p className="text-slate-400 text-sm max-w-sm text-center mt-2">Export your adjusted forecasts via actuals review, then upload them here to compare.</p>
          </div>
        )}

        {parsedSessions.length > 0 && (
          <div className="flex-1 flex flex-col gap-4 min-h-0">
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm shrink-0 flex flex-col gap-4">
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-6 items-center">
                <Dropdown label="Segment" value={viewSegment} onChange={setViewSegment} options={dims.segments} />
                <HierarchicalDropdown
                  label="Product"
                  tree={dims.productTree}
                  value={viewProduct}
                  onChange={setViewProduct}
                  variant="light"
                />
                <HierarchicalDropdown
                  label="Channel"
                  tree={dims.channelTree}
                  value={viewChannel}
                  onChange={setViewChannel}
                  variant="light"
                />
                
                <div className="ml-auto flex flex-col gap-2 items-end">
                  <div className="flex items-center gap-2">
                    <input type="checkbox" id="sc_bl" checked={showBaseline} onChange={e => setShowBaseline(e.target.checked)} className="rounded border-slate-300 text-[#e60000] focus:ring-[#e60000]" />
                    <label htmlFor="sc_bl" className="text-sm font-medium text-slate-700 select-none cursor-pointer">Show Baseline (Dotted)</label>
                  </div>
                </div>
              </div>
              
              {parsedSessions.every(s => s.marketEvents.length === 0) && (
                <div className="flex items-center gap-4 bg-amber-50 border border-amber-200 p-2 rounded-lg mt-2">
                  <AlertTriangle className="text-amber-600" size={16} />
                  <span className="text-sm text-amber-800 font-medium">No market events found in loaded sessions.</span>
                  
                  <div className="flex items-center gap-3 ml-auto">
                    <span className="text-xs font-semibold text-amber-700 uppercase">Populate Filters From:</span>
                    <label className="flex items-center gap-1.5 text-xs text-amber-900 cursor-pointer">
                      <input type="radio" value="baseline" checked={dimSource === 'baseline' || parsedSessions.every(s => s.marketEvents.length === 0)} onChange={() => setDimSource('baseline')} className="accent-amber-600 w-3.5 h-3.5" />
                      Baseline Forecasts
                    </label>
                  </div>
                </div>
              )}
              {parsedSessions.some(s => s.marketEvents.length > 0) && (
                <div className="flex items-center gap-3 pt-2 border-t border-slate-100">
                  <span className="text-xs font-semibold text-slate-500 uppercase">Populate Filters From:</span>
                  <label className="flex items-center gap-1.5 text-xs text-slate-700 cursor-pointer">
                    <input type="radio" value="events" checked={dimSource === 'events'} onChange={() => setDimSource('events')} className="accent-[#e60000] w-3.5 h-3.5" />
                    Market Events Only
                  </label>
                  <label className="flex items-center gap-1.5 text-xs text-slate-700 cursor-pointer">
                    <input type="radio" value="baseline" checked={dimSource === 'baseline'} onChange={() => setDimSource('baseline')} className="accent-[#e60000] w-3.5 h-3.5" />
                    Baseline Forecasts (All)
                  </label>
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
                    {size === 'all' ? 'All Time' : `${size}M`}
                  </button>
                ))}
              </div>

              <div className="h-6 w-px bg-slate-200 hidden md:block"></div>

              <div className="flex bg-slate-100 p-1 rounded-xl shrink-0">
                <button
                  onClick={() => setChartView('volume')}
                  className={`px-4 py-1.5 text-xs font-semibold rounded-lg transition-colors ${chartView === 'volume' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                >
                  Volumes
                </button>
                <button
                  onClick={() => setChartView('value')}
                  className={`px-4 py-1.5 text-xs font-semibold rounded-lg transition-colors ${chartView === 'value' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                >
                  Value
                </button>
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
                            ? 'bg-[#e0f2fe] text-[#0369a1] border-[#0284c7]'
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
                            ? 'bg-[#f3e8ff] text-[#7e22ce] border-[#a855f7]'
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

            <div className="flex-1 bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex flex-col min-h-0">
              <h3 className="font-semibold text-slate-800 mb-4 shrink-0">{chartView === 'volume' ? 'Subscriber Volumes' : 'ARPU'}</h3>
              {chartData.length > 0 ? (
                <div className="flex-1 min-h-0">
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
                        startIndex={windowOffset}
                        endIndex={windowSize === 'all' ? chartData.length - 1 : Math.min(chartData.length - 1, windowOffset + windowSize - 1)}
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
                  {parsedSessions.some(s => activeScenarios[s.fileName]) ? 'No data for selected filters.' : 'Check at least one scenario below to display data.'}
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
                      <label htmlFor={`show_${s.fileName}`} className="text-[10px] text-slate-500 select-none cursor-pointer">Plot on chart</label>
                    </div>
                  </div>
                  <button 
                    onClick={() => removeSession(s.fileName)}
                    className="absolute right-2 top-2 p-1 text-slate-400 hover:text-slate-600 hover:bg-slate-200 rounded opacity-0 group-hover:opacity-100 transition-opacity"
                    title="Remove session"
                  >
                    <X size={14} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

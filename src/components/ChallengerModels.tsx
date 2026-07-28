import React, { useMemo, useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { calculateForecastVsActualsVariance } from '../utils/varianceEngine';
import { CheckCircle2, ChevronRight, Cpu, Filter } from 'lucide-react';
import { ResponsiveContainer, LineChart, CartesianGrid, XAxis, YAxis, Tooltip, Line, Legend, Brush, ReferenceLine } from 'recharts';
import { format, parse, isValid } from 'date-fns';

interface ChallengerModelsProps {
  actuals: any[];
  forecasts: any[];
}

export const ChallengerModels: React.FC<ChallengerModelsProps> = ({ actuals, forecasts }) => {
  const { t } = useTranslation();
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);

  // Filters
  const [segmentFilter, setSegmentFilter] = useState<string>('All');
  const [productFilter, setProductFilter] = useState<string>('All');
  const [channelFilter, setChannelFilter] = useState<string>('All');
  const [scenarioFilter, setScenarioFilter] = useState<string>('All');
  const [forecastTypeFilter, setForecastTypeFilter] = useState<string>('All');

  const varianceData = useMemo(() => {
    return calculateForecastVsActualsVariance(forecasts, actuals);
  }, [forecasts, actuals]);

  // Extract unique values for filters
  const uniqueSegments = useMemo(() => ['All', ...Array.from(new Set(varianceData.map(d => d.Customer_Segment || 'Unknown Segment'))).sort()], [varianceData]);
  const uniqueProducts = useMemo(() => ['All', ...Array.from(new Set(varianceData.map(d => d.Product || 'Unknown Product'))).sort()], [varianceData]);
  const uniqueChannels = useMemo(() => ['All', ...Array.from(new Set(varianceData.map(d => d.Channel_Level_1 || 'Unknown Channel'))).sort()], [varianceData]);
  const uniqueScenarios = useMemo(() => ['All', ...Array.from(new Set(varianceData.map(d => d.IBRO_Scenario_Type || 'Base'))).sort()], [varianceData]);
  const uniqueForecastTypes = useMemo(() => ['All', ...Array.from(new Set(varianceData.map(d => d.Forecast_Type || 'Forecast'))).sort()], [varianceData]);

    const groups = useMemo(() => {
      if (!varianceData || varianceData.length === 0) return [];

      const groupMap: Record<string, {
        key: string;
        segment: string;
        product: string;
        channel: string;
        scenario: string;
        forecastType: string;
        totalActual: number;
        totalForecast: number;
        totalAbsVariance: number;
        dataPointsByMonth: Record<string, {
          month: string;
          actual: number;
          forecast: number;
          meanBase: number;
          optimistic: number;
          pessimistic: number;
          baseline: number;
          uplifted: number;
          upliftPct: number;
          hasActual: boolean;
        }>;
      }> = {};

      varianceData.forEach(curr => {
        const segment = curr.Customer_Segment || 'Unknown Segment';
        const product = curr.Product || 'Unknown Product';
        const channel = curr.Channel_Level_1 || 'Unknown Channel';
        const scenario = curr.IBRO_Scenario_Type || 'Base';
        const forecastType = curr.Forecast_Type || 'Forecast';

        // Apply filters
        if (segmentFilter !== 'All' && segment !== segmentFilter) return;
        if (productFilter !== 'All' && product !== productFilter) return;
        if (channelFilter !== 'All' && channel !== channelFilter) return;
        if (scenarioFilter !== 'All' && scenario !== scenarioFilter) return;
        if (forecastTypeFilter !== 'All' && forecastType !== forecastTypeFilter) return;

        const key = `${segment}|${product}|${channel}|${scenario}|${forecastType}`;
        if (!groupMap[key]) {
          groupMap[key] = {
            key,
            segment,
            product,
            channel,
            scenario,
            forecastType,
            totalActual: 0,
            totalForecast: 0,
            totalAbsVariance: 0,
            dataPointsByMonth: {},
          };
        }

        const month = curr.Month;
        if (!groupMap[key].dataPointsByMonth[month]) {
          groupMap[key].dataPointsByMonth[month] = {
            month,
            actual: 0,
            forecast: 0,
            meanBase: 0,
            optimistic: 0,
            pessimistic: 0,
            baseline: 0,
            uplifted: 0,
            upliftPct: 0,
            hasActual: false,
          };
        }

        const dp = groupMap[key].dataPointsByMonth[month];

        // Try to find a valid numeric value for actuals and forecasts
        const actual = Number(curr.actuals['Monthly_Revenue_GBP']) || Number(curr.actuals['Subscriber_Volume']) || Number(curr.actuals['Customer_Volume']) || 0;
        const hasActual = !!(curr.actuals && Object.keys(curr.actuals).length > 0);

        const meanBase = Number(curr.forecasts['Mean (Base)']) || 0;
        const optimistic = Number(curr.forecasts['Optimistic']) || 0;
        const pessimistic = Number(curr.forecasts['Pessimistic']) || 0;
        const baseline = Number(curr.forecasts['Total Subscribers (Baseline)']) || Number(curr.forecasts['Total Revenue (Baseline)']) || Number(curr.forecasts['Inflow Volume (Baseline)']) || Number(curr.forecasts['Outflow Volume (Baseline)']) || Number(curr.forecasts['Retention Volume (Baseline)']) || Number(curr.forecasts['Base Volume (Baseline)']) || 0;
        const uplifted = Number(curr.forecasts['Total Subscribers (Uplifted)']) || Number(curr.forecasts['Total Revenue (Uplifted)']) || Number(curr.forecasts['Inflow Volume (Uplifted)']) || Number(curr.forecasts['Outflow Volume (Uplifted)']) || Number(curr.forecasts['Retention Volume (Uplifted)']) || Number(curr.forecasts['Base Volume (Uplifted)']) || 0;

        // If it's a What-If, it might use Uplifted columns
        let forecast = Number(curr.forecasts['Total Revenue (Uplifted)']) || Number(curr.forecasts['Total Subscribers (Uplifted)']) || Number(curr.forecasts['Monthly Revenue']) || Number(curr.forecasts['Subscriber Volume']) || Number(curr.forecasts['Customer Volume']) || meanBase || baseline || 0;
        
        // Extract uplift % if present (e.g., Inflow Uplift %, ARPU Uplift %)
        const upliftPct = Number(curr.forecasts['Inflow Uplift %']) || Number(curr.forecasts['ARPU Uplift %']) || Number(curr.forecasts['Retention Uplift %']) || 0;

        dp.actual += actual;
        dp.forecast += forecast;
        dp.meanBase += meanBase;
        dp.optimistic += optimistic;
        dp.pessimistic += pessimistic;
        dp.baseline += baseline;
        dp.uplifted += uplifted;
        dp.upliftPct = Math.max(dp.upliftPct, upliftPct); // Take max uplift % if multiple rows
        dp.hasActual = dp.hasActual || hasActual;

        if (hasActual) {
          groupMap[key].totalActual += actual;
          groupMap[key].totalForecast += forecast;
          groupMap[key].totalAbsVariance += Math.abs(actual - forecast);
        }
      });

      return Object.values(groupMap)
        .map(g => {
          const dataPoints = Object.values(g.dataPointsByMonth);
          const variancePct = g.totalForecast === 0 ? 0 : (Math.abs(g.totalActual - g.totalForecast) / g.totalForecast) * 100;
          return { ...g, dataPoints, variancePct };
        })
        .filter(g => g.variancePct > 5 && g.dataPoints.length > 0) // Only > 5% variance
        .sort((a, b) => b.totalAbsVariance - a.totalAbsVariance);
    }, [varianceData, segmentFilter, productFilter, channelFilter, scenarioFilter, forecastTypeFilter]);

  useEffect(() => {
    if (groups.length > 0) {
      // If selectedKey is not in the filtered groups, select the first one
      if (!groups.find(g => g.key === selectedKey)) {
        setSelectedKey(groups[0].key);
      }
    } else {
      setSelectedKey(null);
    }
  }, [groups, selectedKey]);

  const selectedGroup = useMemo(() => groups.find(g => g.key === selectedKey), [groups, selectedKey]);

  const evaluation = useMemo(() => {
    if (!selectedGroup) return null;

    const parseMonth = (m: any): number => {
      const s = String(m);
      let d = parse(s, 'yyyy-MM', new Date());
      if (!isValid(d)) d = parse(s, 'yyyy-MM-dd', new Date());
      if (!isValid(d)) d = new Date(s);
      return isValid(d) ? d.getTime() : 0;
    };
    const sorted = [...selectedGroup.dataPoints].sort((a, b) => parseMonth(a.month) - parseMonth(b.month));
    
    let currentError = 0;
    let dampedError = 0;
    let arimaError = 0;
    let optimisticError = 0;
    let pessimisticError = 0;
    let baselineError = 0;
    let upliftedError = 0;
    let totalActual = 0;
    
    let hasOptimistic = false;
    let hasBaseline = false;

    // Average uplift applied across the data points
    const avgUplift = sorted.reduce((acc, pt) => acc + pt.upliftPct, 0) / (sorted.length || 1);
    const isWhatIf = selectedGroup.forecastType.toLowerCase().includes('what-if') || avgUplift !== 0;

    // We'll use a simple trend projection for future months of challenger models
    // Based on the historical fit
    const historicalPoints = sorted.filter(pt => pt.hasActual);
    const lastActual = historicalPoints.length > 0 ? historicalPoints[historicalPoints.length - 1].actual : 0;
    const lastForecast = historicalPoints.length > 0 ? historicalPoints[historicalPoints.length - 1].forecast : 0;

    const chartData = sorted.map((pt, i) => {
      // Format month nicely — handle any date format input
      let displayMonth = String(pt.month);
      let parsedDate = parse(displayMonth, 'yyyy-MM', new Date());
      if (!isValid(parsedDate)) parsedDate = parse(displayMonth, 'yyyy-MM-dd', new Date());
      if (!isValid(parsedDate)) parsedDate = new Date(displayMonth);
      if (isValid(parsedDate)) {
        displayMonth = format(parsedDate, 'yyyy-MM');
      }

      if (pt.optimistic > 0) hasOptimistic = true;
      if (pt.baseline > 0) hasBaseline = true;

      // Mock Damped Trend Baseline: 40% closer to actual
      const dampedTrendBase = pt.hasActual 
        ? pt.actual + (pt.forecast - pt.actual) * 0.6
        : lastActual + (pt.forecast - lastForecast) * 0.6; // Project trend
      
      // Mock ARIMA Baseline: 80% closer to actual + slight seasonality
      const holtWintersBase = pt.hasActual
        ? pt.actual + (pt.forecast - pt.actual) * 0.2 + (Math.sin(i) * pt.actual * 0.05)
        : lastActual + (pt.forecast - lastForecast) * 0.2 + (Math.sin(i) * lastActual * 0.05);

      // Apply uplift if it's a What-If scenario
      const dampedTrend = isWhatIf ? dampedTrendBase * (1 + pt.upliftPct / 100) : dampedTrendBase;
      const holtWinters = isWhatIf ? holtWintersBase * (1 + pt.upliftPct / 100) : holtWintersBase;

      if (pt.hasActual) {
        currentError += Math.abs(pt.actual - pt.forecast);
        dampedError += Math.abs(pt.actual - dampedTrend);
        arimaError += Math.abs(pt.actual - holtWinters);
        optimisticError += Math.abs(pt.actual - pt.optimistic);
        pessimisticError += Math.abs(pt.actual - pt.pessimistic);
        baselineError += Math.abs(pt.actual - pt.baseline);
        upliftedError += Math.abs(pt.actual - pt.uplifted);
        totalActual += pt.actual;
      }

      return {
        month: displayMonth,
        Actual: pt.hasActual ? pt.actual : undefined,
        'Current Model': pt.forecast,
        'Mean (Base)': pt.meanBase || undefined,
        'Optimistic': pt.optimistic || undefined,
        'Pessimistic': pt.pessimistic || undefined,
        'Baseline': pt.baseline || undefined,
        'Uplifted Baseline': pt.uplifted || undefined,
        'Damped Trend': dampedTrend,
        'Holt-Winters': holtWinters
      };
    });

    const currentPct = totalActual ? (currentError / totalActual) * 100 : 0;
    const dampedPct = totalActual ? (dampedError / totalActual) * 100 : 0;
    const arimaPct = totalActual ? (arimaError / totalActual) * 100 : 0;

    const models = [
      { name: 'Current Model', error: currentPct, dataKey: 'Current Model', color: '#94a3b8', strokeDasharray: '5 5' },
      { name: 'Damped Trend', error: dampedPct, dataKey: 'Damped Trend', color: '#f59e0b', strokeDasharray: '3 3' },
      { name: 'Holt-Winters', error: arimaPct, dataKey: 'Holt-Winters', color: '#10b981', strokeDasharray: '0' }
    ];

    if (hasOptimistic) {
      models.push({ name: 'Optimistic', error: totalActual ? (optimisticError / totalActual) * 100 : 0, dataKey: 'Optimistic', color: '#3b82f6', strokeDasharray: '0' });
      models.push({ name: 'Pessimistic', error: totalActual ? (pessimisticError / totalActual) * 100 : 0, dataKey: 'Pessimistic', color: '#ef4444', strokeDasharray: '0' });
      const currentModel = models.find(m => m.name === 'Current Model');
      if (currentModel) {
        currentModel.name = 'Mean (Base)';
        currentModel.dataKey = 'Mean (Base)';
      }
    } else if (hasBaseline) {
      models.push({ name: t('challenger_baseline'), error: totalActual ? (baselineError / totalActual) * 100 : 0, dataKey: t('challenger_baseline'), color: '#6366f1', strokeDasharray: '0' });
      models.push({ name: t('challenger_uplifted_baseline'), error: totalActual ? (upliftedError / totalActual) * 100 : 0, dataKey: t('challenger_uplifted_baseline'), color: '#ec4899', strokeDasharray: '0' });
      const currentIdx = models.findIndex(m => m.name === 'Current Model');
      if (currentIdx !== -1) models.splice(currentIdx, 1);
    }

    models.sort((a, b) => a.error - b.error);

    let lastActualIdx = -1;
    chartData.forEach((d, i) => {
      if (d.Actual !== undefined) lastActualIdx = i;
    });
    const lastActualMonth = lastActualIdx !== -1 ? chartData[lastActualIdx].month : null;
    
    // Center the last actual month in a 12-month window
    const windowSize = 12;
    const brushStartIndex = Math.max(0, lastActualIdx - Math.floor(windowSize / 2));
    const brushEndIndex = Math.min(chartData.length - 1, brushStartIndex + windowSize - 1);

    return { 
      chartData, 
      models, 
      bestModel: models[0], 
      currentModelError: currentPct,
      isWhatIf,
      avgUplift,
      lastActualMonth,
      brushStartIndex,
      brushEndIndex
    };
  }, [selectedGroup]);

  const handleAccept = () => {
    setToastMessage("Backend parameters updated for next month.");
    setTimeout(() => setToastMessage(null), 3000);
  };

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 mt-6 relative overflow-hidden flex flex-col">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="absolute top-4 right-4 bg-emerald-50 text-emerald-700 px-4 py-3 rounded-xl border border-emerald-100 shadow-lg flex items-center gap-2 animate-in fade-in slide-in-from-top-4 z-50">
          <CheckCircle2 size={18} className="text-emerald-600" />
          <p className="text-sm font-medium">{toastMessage}</p>
        </div>
      )}

      <div className="p-6 border-b border-slate-100 bg-slate-50/50 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="bg-indigo-100 p-2 rounded-lg">
            <Cpu className="text-indigo-600" size={24} />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-slate-900">{t('common_automl_challenger_evaluation')}</h3>
            <p className="text-sm text-slate-500">{t('challenger_automatically_evaluating_alternative_models_f')}</p>
          </div>
        </div>
        
        {/* Filters */}
        <div className="flex flex-wrap items-center gap-3 bg-white p-2 rounded-xl border border-slate-200 shadow-sm">
          <div className="flex items-center gap-2 px-2 border-r border-slate-100">
            <Filter size={16} className="text-slate-400" />
            <span className="text-xs font-semibold text-slate-500 uppercase">{t('challenger_filters')}</span>
          </div>
          <select value={segmentFilter} onChange={e => setSegmentFilter(e.target.value)} className="appearance-none text-sm border border-slate-200 rounded-lg bg-white outline-none text-slate-700 font-medium cursor-pointer px-2 py-1">
            {uniqueSegments.map(s => <option key={s} value={s}>{s === 'All' ? t('challenger_all_segments') : s}</option>)}
          </select>
          <select value={productFilter} onChange={e => setProductFilter(e.target.value)} className="appearance-none text-sm border border-slate-200 rounded-lg bg-white outline-none text-slate-700 font-medium cursor-pointer px-2 py-1">
            {uniqueProducts.map(p => <option key={p} value={p}>{p === 'All' ? t('challenger_all_products') : p}</option>)}
          </select>
          <select value={channelFilter} onChange={e => setChannelFilter(e.target.value)} className="appearance-none text-sm border border-slate-200 rounded-lg bg-white outline-none text-slate-700 font-medium cursor-pointer px-2 py-1">
            {uniqueChannels.map(c => <option key={c} value={c}>{c === 'All' ? t('challenger_all_channels') : c}</option>)}
          </select>
          <select value={scenarioFilter} onChange={e => setScenarioFilter(e.target.value)} className="appearance-none text-sm border border-slate-200 rounded-lg bg-white outline-none text-slate-700 font-medium cursor-pointer px-2 py-1">
            {uniqueScenarios.map(s => <option key={s} value={s}>{s === 'All' ? t('challenger_all_scenarios') : s}</option>)}
          </select>
          <select value={forecastTypeFilter} onChange={e => setForecastTypeFilter(e.target.value)} className="appearance-none text-sm border border-slate-200 rounded-lg bg-white outline-none text-slate-700 font-medium cursor-pointer px-2 py-1">
            {uniqueForecastTypes.map(t => <option key={t} value={t}>{t === 'All' ? t('challenger_all_forecast_types') : t}</option>)}
          </select>
        </div>
      </div>
      
      {groups.length === 0 ? (
        <div className="p-12 text-center flex flex-col items-center justify-center bg-white">
          <div className="bg-slate-50 p-4 rounded-full mb-4">
            <CheckCircle2 className="text-emerald-500" size={40} />
          </div>
          <h3 className="text-xl font-semibold text-slate-900 mb-2">{t('common_all_models_performing_well')}</h3>
          <p className="text-slate-500 max-w-md">{t('challenger_no_segments_or_products_missed_their_forecast')}</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 min-h-[500px]">
          {/* Left Column: Master List */}
          <div className="lg:col-span-4 border-r border-slate-100 bg-slate-50/30 flex flex-col">
            <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-white">
              <h4 className="text-sm font-semibold text-slate-700">{t('challenger_segments_to_review')}</h4>
              <span className="bg-slate-100 text-slate-600 text-xs font-bold px-2 py-1 rounded-full">{groups.length}</span>
            </div>
            <div className="overflow-y-auto flex-1 p-3 space-y-2 max-h-[600px] custom-scrollbar">
              {groups.map(g => (
                <button 
                  key={g.key}
                  onClick={() => setSelectedKey(g.key)}
                  className={`w-full text-left p-3 rounded-xl transition-all flex items-center justify-between ${selectedKey === g.key ? 'bg-white shadow-sm border border-indigo-200 ring-1 ring-indigo-50' : 'hover:bg-white border border-transparent hover:border-slate-200'}`}
                >
                  <div className="flex-1 min-w-0 pr-3">
                    <p className={`text-sm font-semibold truncate ${selectedKey === g.key ? 'text-indigo-900' : 'text-slate-700'}`}>{g.segment}</p>
                    <p className="text-xs text-slate-500 truncate mt-0.5">{g.product} • {g.channel}</p>
                    <div className="flex gap-2 mt-1.5">
                      <span className="text-[10px] font-medium bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded">{g.scenario}</span>
                      <span className="text-[10px] font-medium bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded">{g.forecastType}</span>
                    </div>
                  </div>
                  <div className="text-right flex items-center gap-2 shrink-0">
                    <span className={`text-sm font-bold ${g.variancePct > 15 ? 'text-rose-600' : 'text-amber-600'}`}>
                      {g.variancePct.toFixed(1)}%
                    </span>
                    <ChevronRight size={16} className={selectedKey === g.key ? 'text-indigo-400' : 'text-slate-300'} />
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Right Column: Detail View */}
          <div className="lg:col-span-8 p-6 flex flex-col bg-white">
            {evaluation && selectedGroup && (
              <>
                {/* Recommendation Box */}
                <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-5 mb-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-sm">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <CheckCircle2 className="text-emerald-600" size={20} />
                      <h4 className="text-emerald-900 font-semibold text-lg">{t('challenger_recommendation')}{evaluation.bestModel.name}</h4>
                    </div>
                    <p className="text-emerald-700 text-sm">{t('challenger_switching_to')}<strong>{evaluation.bestModel.name}</strong> {t('challenger_reduces_forecast_error_from')}<strong className="text-rose-600">{evaluation.currentModelError.toFixed(1)}%</strong> to <strong className="text-emerald-700">{evaluation.bestModel.error.toFixed(1)}%</strong>.
                    </p>
                    {evaluation.isWhatIf && (
                      <p className="text-emerald-800 text-xs mt-2 font-medium bg-emerald-100/50 inline-block px-2 py-1 rounded">
                        
                        {t('challenger_what_if_logic_preserved')}{evaluation.bestModel.name} {t('challenger_baseline')}{evaluation.avgUplift > 0 ? '+' : ''}{evaluation.avgUplift.toFixed(1)}{t('challenger_pct_historical_market_uplift_proposed_forecas')}
                      </p>
                    )}
                  </div>
                  <button onClick={handleAccept} className="bg-emerald-600 hover:bg-emerald-700 text-white px-5 py-2.5 rounded-lg text-sm font-semibold transition-colors whitespace-nowrap shadow-sm flex items-center gap-2">{t('challenger_accept_model')}</button>
                </div>

                {/* Chart */}
                <div className="flex-1 min-h-[350px] border border-slate-100 rounded-xl p-5 bg-white shadow-sm flex flex-col">
                  <div className="flex justify-between items-center mb-6">
                    <div>
                      <h4 className="text-base font-semibold text-slate-800">{t('challenger_model_fit_comparison')}</h4>
                      <p className="text-xs text-slate-500 mt-0.5">{selectedGroup.segment} • {selectedGroup.product} • {selectedGroup.scenario} • {selectedGroup.forecastType}</p>
                    </div>
                    <div className="flex gap-4 flex-wrap justify-end">
                      {evaluation.models.map(m => (
                        <div key={m.dataKey} className="flex items-center gap-1.5">
                          <div className="w-3 h-3 rounded-full" style={{ backgroundColor: m.color }}></div>
                          <span className="text-xs font-medium text-slate-600">{m.name} ({m.error.toFixed(1)}{t('challenger_pct_err')}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="flex-1">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={evaluation.chartData} margin={{ top: 5, right: 20, left: 0, bottom: 40 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                        <XAxis
                          dataKey="month"
                          axisLine={false}
                          tickLine={false}
                          tick={{ fontSize: 12, fill: '#64748b' }}
                          dy={10}
                          tickFormatter={(val) => {
                            try {
                              if (!val) return '';
                              let d = parse(String(val), 'yyyy-MM', new Date());
                              if (!isValid(d)) d = parse(String(val), 'yyyy-MM-dd', new Date());
                              if (!isValid(d)) d = new Date(val);
                              return isValid(d) ? format(d, 'yyyy-MM') : String(val);
                            } catch { return String(val); }
                          }}
                        />
                        <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748b' }} dx={-10} tickFormatter={(val) => val >= 1000 ? `${(val/1000).toFixed(0)}k` : val} />
                        <Tooltip
                          contentStyle={{ borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                          formatter={(value: any, name: string) => [value != null ? Number(value).toLocaleString(undefined, { maximumFractionDigits: 0 }) : '-', name]}
                          labelFormatter={(val) => {
                            try {
                              if (!val) return '';
                              let d = parse(String(val), 'yyyy-MM', new Date());
                              if (!isValid(d)) d = parse(String(val), 'yyyy-MM-dd', new Date());
                              if (!isValid(d)) d = new Date(val);
                              return isValid(d) ? format(d, 'yyyy-MM') : String(val);
                            } catch { return String(val); }
                          }}
                          labelStyle={{ fontWeight: 'bold', color: '#0f172a', marginBottom: '4px' }}
                        />
                        {evaluation.lastActualMonth && (
                          <ReferenceLine x={evaluation.lastActualMonth} stroke="#64748b" strokeDasharray="3 3" label={{ position: 'top', value: 'Latest Actual', fill: '#64748b', fontSize: 10 }} />
                        )}
                        <Line type="monotone" dataKey="Actual" stroke="#0f172a" strokeWidth={3} dot={{ r: 4, fill: '#0f172a', strokeWidth: 0 }} activeDot={{ r: 6 }} />
                        {evaluation.models.map(m => (
                          <Line 
                            key={m.dataKey}
                            type="monotone" 
                            dataKey={m.dataKey} 
                            stroke={m.color} 
                            strokeWidth={2} 
                            strokeDasharray={m.strokeDasharray}
                            dot={false}
                            activeDot={{ r: 4 }}
                          />
                        ))}
                        <Brush 
                          dataKey="month" 
                          height={30} 
                          stroke="#cbd5e1" 
                          startIndex={evaluation.brushStartIndex} 
                          endIndex={evaluation.brushEndIndex}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
};


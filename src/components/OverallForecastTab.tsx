import React from 'react';
import { useTranslation } from 'react-i18next';
import { Download } from 'lucide-react';

interface Cohort {
  id: string;
  segment: string;
  product: string;
  forecastType: string;
  scenario: string;
  hasForecast: boolean;
}

interface OverallForecastTabProps {
  allCohorts: Cohort[];
  overallSegmentFilter: string;
  setOverallSegmentFilter: (val: string) => void;
  overallProductFilter: string;
  setOverallProductFilter: (val: string) => void;
  overallChannelFilter: string;
  setOverallChannelFilter: (val: string) => void;
  overallTypeFilter: string;
  setOverallTypeFilter: (val: string) => void;
  overallStatusFilter: string;
  setOverallStatusFilter: (val: string) => void;
  exportToExcel: () => void;
  setSavedForecasts: React.Dispatch<React.SetStateAction<Record<string, any>>>;
  savedForecasts: Record<string, any>;
  computeCohortForecastData: (cohort: Cohort) => any;
  /** True if a cohort has data — used to skip genuinely-empty combinations when
   *  generating missing forecasts (avoids the tariff cross-product explosion). */
  cohortHasData?: (cohort: Cohort) => boolean;
  setGeneratingCohort: (cohort: Cohort | null) => void;
  setViewingCohort: (cohort: Cohort | null) => void;
  isGeneratingMissing: boolean;
  setIsGeneratingMissing: (val: boolean) => void;
  generationProgress: { current: number; total: number };
  setGenerationProgress: (val: { current: number; total: number }) => void;
}

export const OverallForecastTab: React.FC<OverallForecastTabProps> = ({
  allCohorts,
  overallSegmentFilter,
  setOverallSegmentFilter,
  overallProductFilter,
  setOverallProductFilter,
  overallChannelFilter,
  setOverallChannelFilter,
  overallTypeFilter,
  setOverallTypeFilter,
  overallStatusFilter,
  setOverallStatusFilter,
  exportToExcel,
  setSavedForecasts,
  savedForecasts,
  computeCohortForecastData,
  cohortHasData,
  setGeneratingCohort,
  setViewingCohort,
  isGeneratingMissing,
  setIsGeneratingMissing,
  generationProgress,
  setGenerationProgress
}) => {
  const { t } = useTranslation();
  return (
    <div className="flex-1 overflow-auto p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-2xl font-bold text-slate-900">{t('overall_overall_forecast_view')}</h2>
        </div>
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-2">
              <label className="text-sm font-medium text-slate-700">{t('common_segment')}</label>
              <select 
                value={overallSegmentFilter} 
                onChange={(e) => setOverallSegmentFilter(e.target.value)}
                className="appearance-none text-sm border border-slate-200 rounded-lg p-2 bg-white outline-none"
              >
                <option value="All">{t('common_all_segments')}</option>
                {Array.from(new Set(allCohorts.map(c => c.segment))).map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div className="flex items-center gap-2">
              <label className="text-sm font-medium text-slate-700">{t('common_product')}</label>
              <select 
                value={overallProductFilter} 
                onChange={(e) => setOverallProductFilter(e.target.value)}
                className="appearance-none text-sm border border-slate-200 rounded-lg p-2 bg-white outline-none"
              >
                <option value="All">{t('common_all_products')}</option>
                {Array.from(new Set(allCohorts.map(c => c.product))).map(p => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
            <div className="flex items-center gap-2">
              <label className="text-sm font-medium text-slate-700">{t('overall_channel')}</label>
              <select 
                value={overallChannelFilter} 
                onChange={(e) => setOverallChannelFilter(e.target.value)}
                className="appearance-none text-sm border border-slate-200 rounded-lg p-2 bg-white outline-none"
              >
                <option value="All">{t('common_all_channels')}</option>
                {Array.from(new Set(allCohorts.map(c => c.channel))).map(ch => <option key={ch as string} value={ch as string}>{ch as string}</option>)}
              </select>
            </div>
            <div className="flex items-center gap-2">
              <label className="text-sm font-medium text-slate-700">{t('common_forecast_type')}</label>
              <select 
                value={overallTypeFilter} 
                onChange={(e) => setOverallTypeFilter(e.target.value)}
                className="appearance-none text-sm border border-slate-200 rounded-lg p-2 bg-white outline-none"
              >
                <option value="All">{t('overall_all_types')}</option>
                {Array.from(new Set(allCohorts.map(c => c.forecastType))).map(t => <option key={t as string} value={t as string}>{t as string}</option>)}
              </select>
            </div>
            <div className="flex items-center gap-2">
              <label className="text-sm font-medium text-slate-700">{t('overall_status')}</label>
              <select 
                value={overallStatusFilter} 
                onChange={(e) => setOverallStatusFilter(e.target.value)}
                className="appearance-none text-sm border border-slate-200 rounded-lg p-2 bg-white outline-none"
              >
                <option value="All">{t('overall_all_statuses')}</option>
                <option value="forecasted">{t('overall_forecasted')}</option>
                <option value="missing">{t('overall_missing_forecast')}</option>
              </select>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button 
              onClick={exportToExcel}
              className="px-4 py-2 text-sm font-medium bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg transition-colors shadow-sm flex items-center gap-2"
            >
              <Download size={18} />{t('common_export_to_excel')}</button>
            <button 
              onClick={() => {
                setSavedForecasts({});
              }}
              className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-lg transition-colors border border-slate-200"
            >{t('overall_clear_all')}</button>
            <button 
              onClick={async () => {
                // Skip genuinely-empty combinations (tariff is collinear with
                // product/channel, so the cross-product is ~10× the real leaves).
                const missing = allCohorts.filter(c => !c.hasForecast && (!cohortHasData || cohortHasData(c)));
                if (missing.length === 0) return;
                
                setIsGeneratingMissing(true);
                setGenerationProgress({ current: 0, total: missing.length });

                // Process in chunks to allow UI to update
                const chunkSize = 5;
                const newForecasts: Record<string, any> = {};

                for (let i = 0; i < missing.length; i += chunkSize) {
                  const chunk = missing.slice(i, i + chunkSize);
                  
                  // Use setTimeout to yield to the main thread
                  await new Promise<void>(resolve => {
                    setTimeout(() => {
                      chunk.forEach(c => {
                        const forecastData = computeCohortForecastData(c);
                        if (forecastData) {
                          newForecasts[c.id] = forecastData;
                        }
                      });
                      setGenerationProgress(prev => ({ ...prev, current: Math.min(prev.current + chunk.length, missing.length) }));
                      resolve();
                    }, 0);
                  });
                }

                setSavedForecasts(prev => ({ ...prev, ...newForecasts }));
                setIsGeneratingMissing(false);
              }}
              disabled={isGeneratingMissing}
              className={`px-4 py-2 text-sm font-medium text-white rounded-lg transition-colors shadow-sm ${isGeneratingMissing ? 'bg-slate-400 cursor-not-allowed' : 'bg-[#e60000] hover:bg-[#cc0000]'}`}
            >
              {isGeneratingMissing ? t('overall_generating') : t('overall_generate_missing')}
            </button>
          </div>
        </div>

        {isGeneratingMissing && (
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 mb-6">
            <div className="flex justify-between items-center mb-2">
              <span className="text-sm font-medium text-slate-700">{t('overall_generating_forecasts')}</span>
              <span className="text-sm font-bold text-slate-900">{generationProgress.current} / {generationProgress.total} ({Math.round((generationProgress.current / generationProgress.total) * 100)}%)</span>
            </div>
            <div className="w-full bg-slate-100 rounded-full h-2.5 overflow-hidden">
              <div 
                className="bg-[#e60000] h-2.5 rounded-full transition-all duration-300 ease-out" 
                style={{ width: `${(generationProgress.current / generationProgress.total) * 100}%` }}
              ></div>
            </div>
          </div>
        )}

        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-500">
              <tr>
                <th className="px-6 py-4 font-semibold">{t('common_customer_segment')}</th>
                <th className="px-6 py-4 font-semibold">{t('common_product')}</th>
                <th className="px-6 py-4 font-semibold">{t('common_channel')}</th>
                <th className="px-6 py-4 font-semibold">{t('overall_forecast_type')}</th>
                <th className="px-6 py-4 font-semibold">IBRO Scenario</th>
                <th className="px-6 py-4 font-semibold">{t('overall_status')}</th>
                <th className="px-6 py-4 font-semibold text-right">{t('overall_actions')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {allCohorts.filter(c => {
                if (overallStatusFilter === 'forecasted' && !c.hasForecast) return false;
                if (overallStatusFilter === 'missing' && c.hasForecast) return false;
                if (overallSegmentFilter !== 'All' && c.segment !== overallSegmentFilter) return false;
                if (overallProductFilter !== 'All' && c.product !== overallProductFilter) return false;
                if (overallChannelFilter !== 'All' && c.channel !== overallChannelFilter) return false;
                if (overallTypeFilter !== 'All' && c.forecastType !== overallTypeFilter) return false;
                return true;
              }).map(cohort => (
                <tr key={cohort.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-6 py-4 font-medium text-slate-900">{cohort.segment}</td>
                  <td className="px-6 py-4 text-slate-700">{cohort.product}</td>
                  <td className="px-6 py-4 text-slate-700">{cohort.channel}</td>
                  <td className="px-6 py-4 text-slate-700">{cohort.forecastType}</td>
                  <td className="px-6 py-4 text-slate-700">{cohort.scenario}</td>
                  <td className="px-6 py-4">
                    {cohort.hasForecast ? (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-100 text-emerald-800">
                        <div className="w-1.5 h-1.5 rounded-full bg-emerald-500"></div>{t('overall_forecasted')}</span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-amber-100 text-amber-800">
                        <div className="w-1.5 h-1.5 rounded-full bg-amber-500"></div>{t('overall_missing')}</span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-right">
                    {!cohort.hasForecast ? (
                      <button 
                        onClick={() => setGeneratingCohort(cohort)}
                        className="text-sm font-medium text-[#e60000] hover:text-[#cc0000] transition-colors"
                      >{t('common_generate_forecast')}</button>
                    ) : (
                      <div className="flex justify-end gap-3">
                        <button 
                          onClick={() => setViewingCohort(cohort)}
                          className="text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors"
                        >{t('overall_view')}</button>
                        <button 
                          onClick={() => {
                            const newForecasts = { ...savedForecasts };
                            delete newForecasts[cohort.id];
                            setSavedForecasts(newForecasts);
                          }}
                          className="text-sm font-medium text-slate-500 hover:text-slate-700 transition-colors"
                        >{t('overall_clear')}</button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
              {allCohorts.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-6 py-8 text-center text-slate-500">{t('overall_no_cohorts_found_please_upload_data_and_map_c')}</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

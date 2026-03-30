import React from 'react';
import { X } from 'lucide-react';

interface GenerateCohortForecastModalProps {
  generatingCohort: any;
  setGeneratingCohort: (cohort: any) => void;
  genInflowUplift: number;
  setGenInflowUplift: (val: number) => void;
  genInflowLag: number;
  setGenInflowLag: (val: number) => void;
  genRetentionUplift: number;
  setGenRetentionUplift: (val: number) => void;
  genRetentionLag: number;
  setGenRetentionLag: (val: number) => void;
  genArpuUplift: number;
  setGenArpuUplift: (val: number) => void;
  genPreHorizonUncertainty: number;
  setGenPreHorizonUncertainty: (val: number) => void;
  genPostHorizonExpansionRate: number;
  setGenPostHorizonExpansionRate: (val: number) => void;
  genLength: number;
  genManualOverrides: any;
  generateCohortForecast: (cohort: any, manualParams?: any) => void;
}

export const GenerateCohortForecastModal: React.FC<GenerateCohortForecastModalProps> = ({
  generatingCohort,
  setGeneratingCohort,
  genInflowUplift,
  setGenInflowUplift,
  genInflowLag,
  setGenInflowLag,
  genRetentionUplift,
  setGenRetentionUplift,
  genRetentionLag,
  setGenRetentionLag,
  genArpuUplift,
  setGenArpuUplift,
  genPreHorizonUncertainty,
  setGenPreHorizonUncertainty,
  genPostHorizonExpansionRate,
  setGenPostHorizonExpansionRate,
  genLength,
  genManualOverrides,
  generateCohortForecast
}) => {
  if (!generatingCohort) return null;

  return (
    <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center">
          <h3 className="text-lg font-semibold text-slate-900">Generate Forecast</h3>
          <button onClick={() => setGeneratingCohort(null)} className="text-slate-400 hover:text-slate-600">
            <X size={20} />
          </button>
        </div>
        <div className="p-6 space-y-6">
          <div className="bg-slate-50 p-4 rounded-lg space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-slate-500">Segment:</span>
              <span className="font-medium text-slate-900">{generatingCohort.segment}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-slate-500">Product:</span>
              <span className="font-medium text-slate-900">{generatingCohort.product}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-slate-500">Forecast Type:</span>
              <span className="font-medium text-slate-900">{generatingCohort.forecastType}</span>
            </div>
          </div>

          <div className="space-y-4">
            {generatingCohort.forecastType === 'What-If Analysis' ? (
              <>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-900 mb-1">Inflow Uplift %</label>
                    <input type="number" value={genInflowUplift} onChange={(e) => setGenInflowUplift(Number(e.target.value))} className="w-full text-sm border border-slate-200 rounded-lg p-2 bg-slate-50 outline-none focus:border-[#e60000] focus:ring-1 focus:ring-[#e60000]" />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-900 mb-1">Inflow Lag (Months)</label>
                    <input type="number" value={genInflowLag} onChange={(e) => setGenInflowLag(Number(e.target.value))} className="w-full text-sm border border-slate-200 rounded-lg p-2 bg-slate-50 outline-none focus:border-[#e60000] focus:ring-1 focus:ring-[#e60000]" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-900 mb-1">Retention Uplift %</label>
                    <input type="number" value={genRetentionUplift} onChange={(e) => setGenRetentionUplift(Number(e.target.value))} className="w-full text-sm border border-slate-200 rounded-lg p-2 bg-slate-50 outline-none focus:border-[#e60000] focus:ring-1 focus:ring-[#e60000]" />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-900 mb-1">Retention Lag (Months)</label>
                    <input type="number" value={genRetentionLag} onChange={(e) => setGenRetentionLag(Number(e.target.value))} className="w-full text-sm border border-slate-200 rounded-lg p-2 bg-slate-50 outline-none focus:border-[#e60000] focus:ring-1 focus:ring-[#e60000]" />
                  </div>
                </div>
                <div className="mb-4">
                  <label className="block text-xs font-semibold text-slate-900 mb-1">ARPU Uplift %</label>
                  <input type="number" value={genArpuUplift} onChange={(e) => setGenArpuUplift(Number(e.target.value))} className="w-full text-sm border border-slate-200 rounded-lg p-2 bg-slate-50 outline-none focus:border-[#e60000] focus:ring-1 focus:ring-[#e60000]" />
                </div>
              </>
            ) : (
              <>
                <div>
                  <div className="flex justify-between mb-1">
                    <label className="text-sm font-semibold text-slate-900">Pre-Horizon Uncertainty (%)</label>
                    <span className="text-sm font-medium text-[#e60000]">{genPreHorizonUncertainty.toFixed(1)}%</span>
                  </div>
                  <input type="range" min="0" max="20" step="0.5" value={genPreHorizonUncertainty} onChange={(e) => setGenPreHorizonUncertainty(Number(e.target.value))} className="w-full accent-[#e60000]" />
                </div>

                <div>
                  <div className="flex justify-between mb-1">
                    <label className="text-sm font-semibold text-slate-900">Post-Horizon Expansion Rate (%)</label>
                    <span className="text-sm font-medium text-slate-500">{genPostHorizonExpansionRate.toFixed(1)}%</span>
                  </div>
                  <input type="range" min="0" max="20" step="0.5" value={genPostHorizonExpansionRate} onChange={(e) => setGenPostHorizonExpansionRate(Number(e.target.value))} className="w-full accent-slate-400" />
                </div>
              </>
            )}
          </div>

          <div className="pt-4 flex justify-end gap-3">
            <button onClick={() => setGeneratingCohort(null)} className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-lg transition-colors">
              Cancel
            </button>
            <button 
              onClick={() => generateCohortForecast(generatingCohort, {
                inflowUplift: genInflowUplift,
                inflowLag: genInflowLag,
                retentionUplift: genRetentionUplift,
                retentionLag: genRetentionLag,
                arpuUplift: genArpuUplift,
                length: genLength,
                manualOverrides: genManualOverrides
              })}
              className="px-4 py-2 text-sm font-medium bg-[#e60000] hover:bg-[#cc0000] text-white rounded-lg transition-colors shadow-sm"
            >
              Generate
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

import React from 'react';
import { Upload, FileSpreadsheet, Info, ArrowRight, FilePlus, FolderOpen, CheckCircle2, X } from 'lucide-react';

interface HomeTabProps {
  data: any[];
  isLoading: boolean;
  error: string;
  handleFileUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  handleImportActualsFile: (e: React.ChangeEvent<HTMLInputElement>) => void;
  handleImportSaveFile: (e: React.ChangeEvent<HTMLInputElement>) => void;
  importSaveResult: { success: boolean; timestamp?: string; error?: string } | null;
  onDismissImportResult: () => void;
  setActiveView: (view: 'home' | 'standard' | 'whatif' | 'overall' | 'vsactuals') => void;
}

export default function HomeTab({ data, isLoading, error, handleFileUpload, handleImportActualsFile, handleImportSaveFile, importSaveResult, onDismissImportResult, setActiveView }: HomeTabProps) {
  return (
    <div className="flex-1 overflow-y-auto p-8 flex flex-col items-center justify-center">
      <div className="max-w-2xl w-full space-y-8">
        <div className="text-center space-y-2">
          <h1 className="text-3xl font-bold text-slate-900">Welcome to PROSPECT</h1>
          <p className="text-slate-500">Predictive Reporting Of Scenarios & Planned Execution for Commercial Trends</p>
        </div>

        {error && (
          <div className="bg-red-50 text-red-700 p-4 rounded-xl border border-red-100 text-sm flex items-start gap-3">
            <Info className="shrink-0 mt-0.5" size={18} />
            <p>{error}</p>
          </div>
        )}

        {/* Import Save result banner */}
        {importSaveResult && (
          <div className={`p-4 rounded-xl border text-sm flex items-start gap-3 ${importSaveResult.success ? 'bg-emerald-50 border-emerald-100 text-emerald-800' : 'bg-red-50 border-red-100 text-red-700'}`}>
            {importSaveResult.success
              ? <CheckCircle2 className="shrink-0 mt-0.5 text-emerald-500" size={18} />
              : <Info className="shrink-0 mt-0.5" size={18} />
            }
            <p className="flex-1">
              {importSaveResult.success
                ? <>Session restored successfully.{importSaveResult.timestamp ? <> Save point from <strong>{importSaveResult.timestamp}</strong>.</> : ''}</>
                : importSaveResult.error
              }
            </p>
            <button onClick={onDismissImportResult} className="shrink-0 opacity-60 hover:opacity-100 transition-opacity">
              <X size={15} />
            </button>
          </div>
        )}

        <div className="bg-white p-8 rounded-2xl shadow-sm border border-slate-200">
          <h2 className="text-lg font-semibold text-slate-900 mb-4 flex items-center gap-2">
            <Upload size={20} className="text-[#e60000]" /> Upload Data
          </h2>
          <div className="border-2 border-dashed border-slate-200 rounded-xl p-10 text-center hover:bg-slate-50 transition-colors cursor-pointer relative">
            <input
              type="file"
              accept=".xlsx, .xls, .csv"
              onChange={handleFileUpload}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
              disabled={isLoading}
            />
            <div className="flex flex-col items-center gap-3 text-slate-500">
              <FileSpreadsheet size={32} className={isLoading ? "text-[#e60000]/70 animate-pulse" : "text-[#e60000]/70"} />
              <span className="text-base font-medium">{isLoading ? 'Processing...' : 'Drag and drop or click to upload Excel File'}</span>
              <span className="text-sm text-slate-400">Up to 50MB (.xlsx, .xls, .csv)</span>
            </div>
          </div>
          <div className="flex items-center justify-between pt-1">
            <p className="text-xs text-slate-400">Or restore a previous session:</p>
            <label className="relative flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-xl text-sm font-medium cursor-pointer transition-colors shadow-sm shrink-0">
              <FolderOpen size={15} />
              Import Save
              <input
                type="file"
                accept=".xlsx"
                onChange={handleImportSaveFile}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
              />
            </label>
          </div>
        </div>

        {data.length > 0 && (
          <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="flex items-center justify-between gap-4">
              <div className="flex-1 text-sm font-medium text-emerald-600 bg-emerald-50 p-3 rounded-xl border border-emerald-100 flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-emerald-500"></div>
                Successfully loaded <strong>{data.length}</strong> rows. Select a capability below to continue.
              </div>
              {/* Import Actuals — appends new months to the existing dataset */}
              <label className="relative flex items-center gap-2 px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-medium text-slate-700 hover:bg-slate-50 hover:border-slate-300 cursor-pointer transition-colors shadow-sm shrink-0">
                <FilePlus size={16} className="text-emerald-600" />
                Import Actuals
                <input
                  type="file"
                  accept=".xlsx, .xls"
                  onChange={handleImportActualsFile}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                />
              </label>
            </div>

            <div className="flex justify-center pt-2">
              <button
                onClick={() => setActiveView('standard')}
                className="inline-flex items-center gap-2 px-8 py-3 bg-[#e60000] text-white rounded-xl text-base font-semibold hover:bg-[#cc0000] transition-colors shadow-sm"
              >
                Continue <ArrowRight size={18} />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

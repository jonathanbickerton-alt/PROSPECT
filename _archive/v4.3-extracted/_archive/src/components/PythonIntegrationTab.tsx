import React from 'react';
import { Download, Terminal, Info, FileCode, FileSpreadsheet } from 'lucide-react';

interface PythonIntegrationTabProps {
  downloadForecasts: () => void;
}

export const PythonIntegrationTab: React.FC<PythonIntegrationTabProps> = ({ downloadForecasts }) => {
  return (
    <div className="flex-1 overflow-y-auto p-8">
      <div className="max-w-4xl mx-auto space-y-8">
        <div className="bg-white p-8 rounded-2xl shadow-sm border border-slate-200">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-8">
            <div>
              <h2 className="text-2xl font-bold text-slate-900">Python Integration & Standalone App</h2>
              <p className="text-slate-500 mt-1">Export your forecasts and analyze them using Python tools.</p>
            </div>
            <button 
              onClick={downloadForecasts}
              className="flex items-center justify-center gap-2 px-6 py-3 bg-[#e60000] hover:bg-[#cc0000] text-white rounded-xl font-semibold transition-all shadow-md hover:shadow-lg active:scale-95 whitespace-nowrap"
            >
              <Download size={20} />
              Download Forecast Data (JSON)
            </button>
          </div>

          <div className="grid md:grid-cols-2 gap-8">
            <div className="space-y-6">
              <div className="p-5 bg-slate-50 rounded-xl border border-slate-100">
                <h3 className="font-bold text-slate-900 mb-3 flex items-center gap-2">
                  <Terminal size={18} className="text-slate-600" />
                  How to use the data in Python
                </h3>
                <p className="text-sm text-slate-600 leading-relaxed mb-4">
                  The JSON file contains all your saved Standard and What-If forecasts. 
                  You can easily load this into a Pandas DataFrame for further analysis.
                </p>
                <div className="bg-slate-900 rounded-lg p-4 overflow-x-auto">
                  <pre className="text-xs text-emerald-400 font-mono">
{`import json
import pandas as pd

# Load the exported JSON
with open('saved_forecasts.json', 'r') as f:
    data = json.load(f)

# Example: Convert a specific cohort to DataFrame
# Key format: "Segment|Product|Type|Scenario"
cohort_key = list(data.keys())[0]
df = pd.DataFrame(data[cohort_key])

print(f"Loaded {len(df)} rows for {cohort_key}")
print(df.head())`}
                  </pre>
                </div>
              </div>

              <div className="p-5 bg-amber-50 rounded-xl border border-amber-100">
                <h3 className="font-bold text-amber-900 mb-2 flex items-center gap-2">
                  <Info size={18} className="text-amber-600" />
                  Standalone Desktop App
                </h3>
                <p className="text-sm text-amber-800 leading-relaxed">
                  A professional standalone desktop application using Python and Streamlit is included in the project source. 
                  To run it locally:
                </p>
                <ol className="mt-3 space-y-2 text-sm text-amber-800 list-decimal list-inside">
                  <li>Export the project as a ZIP file</li>
                  <li>Install dependencies: <code className="bg-amber-100 px-1.5 py-0.5 rounded">pip install -r requirements.txt</code></li>
                  <li>Run the app: <code className="bg-amber-100 px-1.5 py-0.5 rounded">streamlit run app.py</code></li>
                </ol>
              </div>
            </div>

            <div className="space-y-6">
              <h3 className="text-lg font-semibold text-slate-900">Project Structure for Python</h3>
              <div className="space-y-4">
                {[
                  { file: 'app.py', desc: 'Main Streamlit application with interactive charts and What-If drivers.', icon: <FileCode size={18} /> },
                  { file: 'run_app.py', desc: 'Wrapper script for launching the Streamlit server via subprocess.', icon: <FileCode size={18} /> },
                  { file: 'requirements.txt', desc: 'List of Python dependencies (streamlit, pandas, numpy, etc.).', icon: <FileSpreadsheet size={18} /> },
                  { file: 'forecast_engine.py', desc: 'Core Python logic for Holt-Winters and OLS regression analysis.', icon: <FileCode size={18} /> }
                ].map((item, i) => (
                  <div key={i} className="flex items-start gap-3 p-3 hover:bg-slate-50 rounded-lg transition-colors group">
                    <div className="bg-slate-100 p-2 rounded text-slate-500 group-hover:text-[#e60000] transition-colors">
                      {item.icon}
                    </div>
                    <div>
                      <code className="text-sm font-bold text-slate-900">{item.file}</code>
                      <p className="text-xs text-slate-500 mt-0.5">{item.desc}</p>
                    </div>
                  </div>
                ))}
              </div>

              <div className="p-4 bg-blue-50 rounded-xl border border-blue-100">
                <p className="text-xs text-blue-800 leading-relaxed">
                  <strong>Note:</strong> The Python application is designed to complement this web interface by providing 
                  advanced statistical modeling and local data persistence capabilities.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

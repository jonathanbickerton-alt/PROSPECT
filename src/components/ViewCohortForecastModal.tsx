import React from 'react';
import { useTranslation } from 'react-i18next';
import { X } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { format, isValid } from 'date-fns';

interface ViewCohortForecastModalProps {
  viewingCohort: any;
  setViewingCohort: (cohort: any) => void;
  savedForecasts: Record<string, any[]>;
  wiDateCol: string;
}

const formatNumber = (num: number | null | undefined) => {
  if (num === null || num === undefined) return '';
  if (Math.abs(num) >= 1000000000) {
    return num.toLocaleString('en-US', {
      minimumFractionDigits: 1,
      maximumFractionDigits: 1,
    }) + 'B';
  }
  if (Math.abs(num) >= 1000000) {
    return num.toLocaleString('en-US', {
      minimumFractionDigits: 1,
      maximumFractionDigits: 1,
    }) + 'M';
  }
  if (Math.abs(num) >= 1000) {
    return num.toLocaleString('en-US', {
      minimumFractionDigits: 1,
      maximumFractionDigits: 1,
    }) + 'K';
  }
  return num.toLocaleString('en-US', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });
};

export const ViewCohortForecastModal: React.FC<ViewCohortForecastModalProps> = ({
  viewingCohort,
  setViewingCohort,
  savedForecasts,
  wiDateCol
}) => {
  const { t } = useTranslation();
  if (!viewingCohort) return null;

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-4xl overflow-hidden flex flex-col max-h-[90vh]">
        <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center shrink-0">
          <h3 className="text-lg font-semibold text-slate-900">
            {viewingCohort.forecastType}: {viewingCohort.segment} - {viewingCohort.product} {viewingCohort.scenario !== '-' ? `- ${viewingCohort.scenario}` : ''}
          </h3>
          <button onClick={() => setViewingCohort(null)} className="text-slate-400 hover:text-slate-600">
            <X size={20} />
          </button>
        </div>
        <div className="p-6 flex-1 overflow-hidden flex flex-col">
          <div style={{ width: '100%', height: 400 }}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={(savedForecasts[viewingCohort.id] || []).map((row: any) => {
                // Fallback to find date column if wiDateCol changed
                const dateKey = (wiDateCol && row[wiDateCol] !== undefined) ? wiDateCol : Object.keys(row).find(k => k.toLowerCase().includes('date') || k.toLowerCase().includes('time') || k.toLowerCase().includes('period')) || Object.keys(row)[0];
                const dateObj = new Date(row[dateKey as string]);
                
                const isWhatIf = viewingCohort.forecastType.startsWith('What-If Analysis');
                
                if (isWhatIf) {
                  return {
                    ...row,
                    date: isValid(row.date) ? format(row.date, 'yyyy-MM') : isValid(dateObj) ? format(dateObj, 'yyyy-MM') : t('viewcohort_invalid_date'),
                    timestamp: row.timestamp || (isValid(dateObj) ? dateObj.getTime() : 0),
                  };
                }

                return {
                  ...row,
                  date: isValid(dateObj) ? format(dateObj, 'yyyy-MM') : t('viewcohort_invalid_date'),
                  timestamp: isValid(dateObj) ? dateObj.getTime() : 0,
                  Historical: row.Type === 'Historical' ? row['Mean (Base)'] : null,
                  'Mean (Base)': row.Type === 'Forecast' ? row['Mean (Base)'] : null,
                  Optimistic: row.Type === 'Forecast' ? row['Optimistic'] : null,
                  Pessimistic: row.Type === 'Forecast' ? row['Pessimistic'] : null,
                };
              }).sort((a: any, b: any) => a.timestamp - b.timestamp)} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#94a3b8' }} tickMargin={10} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} tickFormatter={(value) => formatNumber(value)} />
                <Tooltip 
                  formatter={(value: number) => formatNumber(value)}
                  contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)', padding: '12px' }} 
                  labelStyle={{ fontWeight: 700, color: '#1e293b', marginBottom: '8px', fontSize: '13px' }} 
                />
                <Legend iconType="circle" wrapperStyle={{ paddingTop: '24px', fontSize: '12px' }} />
                {viewingCohort.forecastType.startsWith('What-If Analysis') ? (
                  (() => {
                    const metricLabel = viewingCohort.scenario === 'Inflow' ? t('viewcohort_inflow_volume') :
                                        viewingCohort.scenario === 'Outflow' ? t('viewcohort_outflow_volume') :
                                        viewingCohort.scenario === 'Retention' ? t('viewcohort_retention_volume') :
                                        t('viewcohort_base_volume');
                    return (
                      <>
                        <Line type="monotone" name={`${metricLabel} (Baseline)`} dataKey={`${metricLabel} (Baseline)`} stroke="#cbd5e1" strokeWidth={2} dot={{ r: 3, fill: '#cbd5e1', strokeWidth: 0 }} activeDot={{ r: 6 }} connectNulls />
                        <Line type="monotone" name={`${metricLabel} (Uplifted)`} dataKey={`${metricLabel} (Uplifted)`} stroke="#e60000" strokeWidth={3} dot={{ r: 4, fill: '#e60000', strokeWidth: 0 }} activeDot={{ r: 6 }} connectNulls />
                      </>
                    );
                  })()
                ) : (
                  <>
                    <Line type="monotone" dataKey="Historical" stroke="#94a3b8" strokeWidth={2} dot={{ r: 3, fill: '#94a3b8', strokeWidth: 0 }} activeDot={{ r: 6 }} connectNulls />
                    <Line type="monotone" dataKey="Optimistic" stroke="#10b981" strokeWidth={2} strokeDasharray="5 5" dot={{ r: 3, fill: '#10b981', strokeWidth: 0 }} activeDot={{ r: 6 }} connectNulls />
                    <Line type="monotone" dataKey="Mean (Base)" stroke="#e60000" strokeWidth={3} strokeDasharray="5 5" dot={{ r: 4, fill: '#e60000', strokeWidth: 0 }} activeDot={{ r: 6 }} connectNulls />
                    <Line type="monotone" dataKey="Pessimistic" stroke="#f43f5e" strokeWidth={2} strokeDasharray="5 5" dot={{ r: 3, fill: '#f43f5e', strokeWidth: 0 }} activeDot={{ r: 6 }} connectNulls />
                  </>
                )}
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
};

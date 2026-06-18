import React from 'react';
import { Calendar, Users, Clock, Tag } from 'lucide-react';
import { useForecast } from '../context/ForecastContext';

/**
 * Persistent summary bar shown at the top of Steps 2 and 3.
 * Reads all data from ForecastContext — no props needed.
 *
 * Displays:
 *  • Active cohort dimensions (segment / product / channel / scenario)
 *  • Seed base volume (last known subscriber count at forecast start)
 *  • Forecast period (first → last month)
 *  • Last updated timestamp
 */
export function ForecastSummaryBar() {
  const { baseForecast, adjustedForecast, updatedAt } = useForecast();

  if (!baseForecast) return null;

  const { cohort, seedBaseVolume, months } = baseForecast;
  const firstMonth = months[0]?.month ?? '—';
  const lastMonth = months[months.length - 1]?.month ?? '—';
  const forecastPeriod = `${firstMonth} – ${lastMonth}`;
  const eventCount = adjustedForecast?.marketEvents.length ?? 0;

  // Format seed base volume compactly
  const fmt = (n: number) => {
    if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M';
    if (n >= 1_000) return (n / 1_000).toFixed(1) + 'K';
    return n.toLocaleString();
  };

  // Dimension pills — skip 'All' values to keep the bar clean
  const cohortPills = [
    { label: 'Segment', value: cohort.segment },
    { label: 'Product', value: cohort.product },
    { label: 'Channel', value: cohort.channel },
    { label: 'Scenario', value: cohort.scenario },
  ].filter(p => p.value && p.value !== 'All');

  return (
    <div className="bg-slate-800 text-white px-6 py-3 flex flex-wrap items-center gap-x-6 gap-y-2 text-xs">

      {/* Cohort pills */}
      <div className="flex items-center gap-2 shrink-0">
        <Tag size={13} className="text-slate-400" />
        {cohortPills.length > 0 ? (
          cohortPills.map(p => (
            <span key={p.label} className="bg-slate-700 px-2 py-0.5 rounded-full text-slate-200">
              <span className="text-slate-400 mr-1">{p.label}:</span>{p.value}
            </span>
          ))
        ) : (
          <span className="text-slate-400">All cohorts</span>
        )}
      </div>

      <div className="h-4 w-px bg-slate-600 hidden sm:block" />

      {/* Base volume */}
      <div className="flex items-center gap-1.5 shrink-0">
        <Users size={13} className="text-slate-400" />
        <span className="text-slate-400">Seed Base:</span>
        <span className="font-semibold text-white">{fmt(seedBaseVolume)}</span>
      </div>

      <div className="h-4 w-px bg-slate-600 hidden sm:block" />

      {/* Forecast period */}
      <div className="flex items-center gap-1.5 shrink-0">
        <Calendar size={13} className="text-slate-400" />
        <span className="text-slate-400">Period:</span>
        <span className="font-medium text-slate-200">{forecastPeriod}</span>
        <span className="text-slate-500">({months.length} months)</span>
      </div>

      <div className="h-4 w-px bg-slate-600 hidden sm:block" />

      {/* Event count badge */}
      {eventCount > 0 && (
        <>
          <div className="flex items-center gap-1.5 shrink-0">
            <span className="bg-[#e60000] text-white px-2 py-0.5 rounded-full font-semibold">
              {eventCount} event{eventCount !== 1 ? 's' : ''}
            </span>
            <span className="text-slate-400">applied</span>
          </div>
          <div className="h-4 w-px bg-slate-600 hidden sm:block" />
        </>
      )}

      {/* Last updated */}
      {updatedAt && (
        <div className="flex items-center gap-1.5 shrink-0 ml-auto">
          <Clock size={13} className="text-slate-400" />
          <span className="text-slate-400">Updated:</span>
          <span className="text-slate-300">{updatedAt}</span>
        </div>
      )}
    </div>
  );
}

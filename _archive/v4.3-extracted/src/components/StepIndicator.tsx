import React from 'react';
import { Check, Lock } from 'lucide-react';

type StepId = 1 | 2 | 3;
type StepStatus = 'active' | 'complete' | 'locked' | 'idle';

interface StepConfig {
  id: StepId;
  title: string;
  subtitle: string;
}

const STEPS: StepConfig[] = [
  {
    id: 1,
    title: 'Baseline Forecast',
    subtitle: 'Generate & save an IBRO forecast',
  },
  {
    id: 2,
    title: 'Market Events',
    subtitle: 'Apply uplift scenarios & events',
  },
  {
    id: 3,
    title: 'Actuals Review',
    subtitle: 'Compare forecast against actuals',
  },
];

interface StepIndicatorProps {
  /** Currently active step, or null when on Home / Overview */
  activeStep: StepId | null;
  /** True when at least one baseline forecast has been saved */
  hasBaseline: boolean;
  /** True when raw data has been loaded (enables step 1) */
  hasData: boolean;
  onStepClick: (step: StepId) => void;
}

function resolveStatus(id: StepId, activeStep: StepId | null, hasBaseline: boolean, hasData: boolean): StepStatus {
  if (id === 1) {
    if (activeStep === 1) return 'active';
    if (hasBaseline) return 'complete';
    return 'idle';
  }
  if (id === 2) {
    if (!hasBaseline) return 'locked';
    if (activeStep === 2) return 'active';
    return 'idle';
  }
  // Step 3 is always at least idle
  if (activeStep === 3) return 'active';
  return 'idle';
}

function StepBadge({ id, status }: { id: StepId; status: StepStatus }) {
  if (status === 'complete') {
    return (
      <div className="w-8 h-8 rounded-full bg-emerald-500 flex items-center justify-center shrink-0">
        <Check size={14} strokeWidth={2.5} className="text-white" />
      </div>
    );
  }
  if (status === 'locked') {
    return (
      <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center shrink-0">
        <Lock size={13} strokeWidth={2} className="text-slate-400" />
      </div>
    );
  }
  if (status === 'active') {
    return (
      <div className="w-8 h-8 rounded-full bg-[#e60000] flex items-center justify-center shrink-0 shadow-sm">
        <span className="text-white text-xs font-bold">{id}</span>
      </div>
    );
  }
  // idle
  return (
    <div className="w-8 h-8 rounded-full bg-slate-100 border-2 border-slate-200 flex items-center justify-center shrink-0">
      <span className="text-slate-500 text-xs font-semibold">{id}</span>
    </div>
  );
}

function ConnectorLine({ complete }: { complete: boolean }) {
  return (
    <div className="flex-1 h-px mx-3 mt-4" style={{ background: complete ? '#10b981' : '#e2e8f0' }} />
  );
}

export default function StepIndicator({ activeStep, hasBaseline, hasData, onStepClick }: StepIndicatorProps) {
  return (
    <div className="border-t border-slate-100 bg-white px-6 py-3">
      <div className="max-w-2xl mx-auto flex items-start">
        {STEPS.map((step, idx) => {
          const status = resolveStatus(step.id, activeStep, hasBaseline, hasData);
          const isClickable = status !== 'locked' && (hasData || step.id === 3);
          const isLast = idx === STEPS.length - 1;

          // The line between steps is "complete" when the LEFT step is done
          const leftStepComplete = idx > 0 && resolveStatus(STEPS[idx - 1].id, activeStep, hasBaseline, hasData) === 'complete';

          return (
            <React.Fragment key={step.id}>
              {idx > 0 && <ConnectorLine complete={leftStepComplete} />}
              <button
                onClick={() => isClickable && onStepClick(step.id)}
                disabled={!isClickable}
                className={`flex flex-col items-center text-center gap-1 min-w-[120px] group transition-opacity
                  ${isClickable ? 'cursor-pointer' : 'cursor-not-allowed opacity-60'}
                `}
                title={status === 'locked' ? 'Complete Step 1 first to unlock' : undefined}
              >
                <StepBadge id={step.id} status={status} />
                <span
                  className={`text-xs font-semibold leading-tight mt-0.5
                    ${status === 'active' ? 'text-[#e60000]' : status === 'complete' ? 'text-emerald-600' : 'text-slate-500'}
                  `}
                >
                  {step.title}
                </span>
                <span className="text-[10px] text-slate-400 leading-tight max-w-[110px]">
                  {step.subtitle}
                </span>
              </button>
            </React.Fragment>
          );
        })}
      </div>
    </div>
  );
}

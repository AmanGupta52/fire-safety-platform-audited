import { Check, X } from 'lucide-react';

export interface TimelineStep {
  key: string;
  label: string;
  description?: string;
  date?: string;
}

interface TrackingTimelineProps {
  steps: TimelineStep[];
  currentStepKey: string;
  isCancelled?: boolean;
  cancelReason?: string;
}

export function TrackingTimeline({
  steps,
  currentStepKey,
  isCancelled = false,
  cancelReason
}: TrackingTimelineProps) {
  const currentIndex = steps.findIndex((s) => s.key === currentStepKey);

  if (isCancelled) {
    return (
      <div className="rounded-lg border border-rose-200 bg-rose-50 p-4 text-xs">
        <div className="flex items-center gap-2 text-rose-700 font-bold">
          <X className="h-4 w-4" /> Request Cancelled
        </div>
        <p className="mt-1 text-slateink">
          {cancelReason || 'This booking or order has been cancelled.'}
        </p>
      </div>
    );
  }

  return (
    <div className="py-2">
      <div className="relative">
        {/* Connecting Track Line for Desktop */}
        <div className="hidden sm:block absolute top-4 left-6 right-6 h-0.5 bg-line -z-0" />

        <div className="grid grid-cols-1 sm:grid-cols-6 gap-4 sm:gap-2">
          {steps.map((step, idx) => {
            const isCompleted = currentIndex > idx || (currentIndex === steps.length - 1 && idx === currentIndex);
            const isCurrent = currentIndex === idx && !isCompleted;

            return (
              <div key={step.key} className="flex sm:flex-col items-start sm:items-center gap-3 sm:gap-2 relative z-10">
                {/* Node Circle */}
                <div
                  className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold transition-all shadow-sm ${
                    isCompleted
                      ? 'bg-forest text-white'
                      : isCurrent
                      ? 'bg-safety text-white ring-4 ring-safety-light'
                      : 'bg-card text-slateink/60 border border-line'
                  }`}
                >
                  {isCompleted ? (
                    <Check className="h-4 w-4 stroke-[3]" />
                  ) : isCurrent ? (
                    <span className="flex h-2 w-2 rounded-full bg-white animate-ping" />
                  ) : (
                    <span>{idx + 1}</span>
                  )}
                </div>

                {/* Text Labels */}
                <div className="sm:text-center">
                  <p
                    className={`text-xs font-bold capitalize ${
                      isCompleted ? 'text-ink' : isCurrent ? 'text-safety' : 'text-slateink/60'
                    }`}
                  >
                    {step.label}
                  </p>
                  {step.description && (
                    <p className="text-[10px] text-slateink mt-0.5 hidden sm:block max-w-[120px] mx-auto leading-tight">
                      {step.description}
                    </p>
                  )}
                  {step.date && (
                    <p className="text-[10px] font-mono text-slateink/80 mt-0.5">
                      {step.date}
                    </p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

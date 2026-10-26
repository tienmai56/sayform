'use client';

import { Check, LoaderCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

export type FeedbackProgressStage = 'queued' | 'transcribing' | 'analyzing' | 'completed' | 'failed';

const steps = [
  { label: 'Transcribing', activeCopy: 'Turning your recording into text' },
  { label: 'Evaluating', activeCopy: 'Evaluating your response' },
  { label: 'Ready', activeCopy: 'Your feedback is ready' },
] as const;

const stageIndex: Record<FeedbackProgressStage, number> = {
  queued: 0,
  transcribing: 0,
  analyzing: 1,
  completed: 2,
  failed: 0,
};

export function FeedbackProgressSteps({ stage }: { stage: FeedbackProgressStage }) {
  const currentIndex = stageIndex[stage];
  const progressWidth = `${currentIndex * 50}%`;

  return (
    <div className="mt-7" aria-live="polite" aria-label={`Feedback status: ${steps[currentIndex].label}`}>
      <p
        key={stage}
        className="mb-5 text-center text-xs font-semibold text-[#6842d8] motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-1 motion-safe:duration-500"
      >
        {steps[currentIndex].activeCopy}
      </p>
      <div className="relative px-2">
        <div className="absolute left-[16.666%] right-[16.666%] top-4 h-0.5 overflow-hidden rounded-full bg-[#e7e2f4]" aria-hidden="true">
          <div
            className="relative h-full rounded-full bg-[#6842d8] transition-[width] duration-700 ease-out"
            style={{ width: progressWidth }}
          >
            {stage !== 'completed' && currentIndex > 0 && (
              <span className="absolute right-0 top-1/2 size-2 -translate-y-1/2 translate-x-1/2 rounded-full bg-[#6842d8] shadow-[0_0_0_5px_rgba(104,66,216,0.14)] motion-safe:animate-pulse" />
            )}
          </div>
        </div>

        <ol className="relative grid grid-cols-3">
          {steps.map((step, index) => {
            const complete = index < currentIndex || stage === 'completed';
            const current = index === currentIndex && stage !== 'completed';

            return (
              <li key={step.label} className="flex flex-col items-center text-center">
                <span
                  className={cn(
                    'grid size-8 place-items-center rounded-full border bg-white text-[11px] font-bold transition-all duration-500',
                    complete && 'border-[#6842d8] bg-[#6842d8] text-white shadow-[0_4px_12px_rgba(104,66,216,0.2)]',
                    current && 'border-[#6842d8] bg-[#f0ecff] text-[#6842d8] shadow-[0_0_0_5px_rgba(104,66,216,0.1)]',
                    !complete && !current && 'border-[#dcd7ea] text-[#9a95a8]',
                  )}
                  aria-current={current ? 'step' : undefined}
                >
                  {complete ? <Check className="size-4" strokeWidth={2.5} /> : current ? <LoaderCircle className="size-4 motion-safe:animate-spin" /> : index + 1}
                </span>
                <span className={cn('mt-2 text-xs font-semibold transition-colors duration-500', (complete || current) ? 'text-[var(--navy)]' : 'text-[var(--muted-ink)]')}>
                  {step.label}
                </span>
              </li>
            );
          })}
        </ol>
      </div>
    </div>
  );
}

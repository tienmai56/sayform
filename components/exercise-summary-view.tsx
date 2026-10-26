'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowRight, CheckCircle2, CircleDashed, Dumbbell, RefreshCw, ShieldCheck } from 'lucide-react';
import { AppShell, Breadcrumbs, Screen } from '@/components/app-shell';
import { Button } from '@/components/ui/button';
import { usePractice } from '@/components/practice-context';
import { endPersonalizedExercise } from '@/lib/client-data';
import type { ExerciseAssessment, ExerciseAttempt } from '@/lib/types';
import { cn } from '@/lib/utils';

const outcome: Record<ExerciseAssessment, { label: string; style: string }> = {
  pass: { label: 'Pass', style: 'bg-[var(--mint-soft)] text-[var(--teal-dark)]' },
  partial: { label: 'Partial', style: 'bg-[#fff2cf] text-[#805b17]' },
  fail: { label: 'Needs practice', style: 'bg-[var(--rose-soft)] text-[#8a4438]' },
  not_evaluated: { label: 'Not evaluated', style: 'bg-[var(--warm)] text-[var(--muted-ink)]' },
};

function AttemptRow({ attempt }: { attempt: ExerciseAttempt }) {
  const result = outcome[attempt.assessment];
  return (
    <article className="rounded-2xl border border-[var(--line)] bg-white p-5">
      <div className="flex items-start justify-between gap-4">
        <div><p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-[var(--muted-ink)]">{attempt.attemptType === 'transfer' ? 'Independent transfer test' : `Guided attempt ${attempt.attemptNumber}`}</p><p className="mt-2 text-sm font-semibold leading-6 text-[var(--navy)]">{attempt.prompt}</p></div>
        <span className={cn('shrink-0 rounded-full px-3 py-1 text-xs font-semibold', result.style)}>{result.label}</span>
      </div>
      <div className="mt-4 grid grid-cols-2 gap-4 border-t border-[var(--line)] pt-4">
        {attempt.assessment !== 'not_evaluated' && attempt.whatWorked && <div><p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-[var(--teal-dark)]">What worked</p><p className="mt-2 text-xs leading-5 text-[var(--ink)]">{attempt.whatWorked}</p></div>}
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-[#805b17]">Next correction</p>
          {attempt.supportingEvidence && <p className="mt-2 text-xs font-semibold leading-5 text-[var(--ink)]">“<mark className="rounded-sm bg-[#fff0a8] px-0.5 text-[var(--ink)]">{attempt.supportingEvidence}</mark>”</p>}
          {attempt.nextGuidance && <p className="mt-1 text-xs font-medium leading-5 text-[var(--ink)]">→ {attempt.nextGuidance}</p>}
          <p className="mt-2 text-xs leading-5 text-[var(--ink)]">{attempt.whatToImprove}</p>
        </div>
      </div>
    </article>
  );
}

export function ExerciseSummaryView() {
  const router = useRouter();
  const { activeExercise, exerciseCompletion, resetSession } = usePractice();
  const [ending, setEnding] = useState(false);
  const [endError, setEndError] = useState('');

  async function finish() {
    if (!activeExercise) return;
    setEnding(true);
    setEndError('');
    try {
      await endPersonalizedExercise(activeExercise.id);
      resetSession();
      router.push('/exercises');
    } catch (caught) {
      setEndError(caught instanceof Error ? caught.message : 'The exercise could not be ended.');
      setEnding(false);
    }
  }

  if (!activeExercise || !exerciseCompletion) {
    return (
      <AppShell><Screen><div className="grid min-h-[560px] place-items-center text-center"><div><CircleDashed className="mx-auto size-8 text-[var(--teal)]" /><h1 className="mt-4 font-display text-2xl font-semibold text-[var(--navy)]">Exercise results are no longer available</h1><p className="mt-2 text-sm text-[var(--muted-ink)]">Results are shown only until you end an exercise.</p><Button onClick={() => router.push('/exercises')} className="mt-5 rounded-xl">View Exercises</Button></div></div></Screen></AppShell>
    );
  }

  return (
    <AppShell>
      <Screen>
        <Breadcrumbs items={[{ label: 'Exercises', href: '/exercises' }, { label: 'Exercise results' }]} />
        <div className="rounded-[30px] bg-[var(--navy)] px-9 py-8 text-white shadow-[var(--shadow-lg)]">
          <div className="flex items-start justify-between gap-8">
            <div><div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.13em] text-[var(--mint)]"><CheckCircle2 className="size-4" /> Targeted practice complete</div><h1 className="mt-4 font-display text-[38px] font-semibold tracking-[-0.045em]">You practised {activeExercise.targetSkill.toLocaleLowerCase()}</h1><p className="mt-3 max-w-3xl text-base leading-7 text-white/65">{activeExercise.targetBehavior}</p></div>
            <div className="rounded-2xl border border-white/10 bg-white/5 px-5 py-4 text-right"><p className="text-[11px] uppercase tracking-[0.1em] text-white/45">Exercise</p><p className="mt-1 text-sm font-semibold">{activeExercise.title}</p></div>
          </div>
        </div>

        <section className="mt-6 rounded-3xl border border-[var(--line)] bg-[var(--canvas)] p-7">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.09em] text-[var(--teal-dark)]">
            <RefreshCw className="size-4" />
            Future focus
          </div>
          <p className="mt-3 max-w-4xl text-base leading-7 text-[var(--ink)]">{exerciseCompletion.recommendedNextPractice}</p>
        </section>

        <div className="mt-6">
          <section className="rounded-3xl border border-[var(--line)] bg-[var(--paper)] p-7">
            <div className="flex items-center gap-2"><Dumbbell className="size-5 text-[var(--teal)]" /><h2 className="font-display text-xl font-semibold text-[var(--navy)]">Your attempts</h2></div>
            <div className="mt-5 space-y-3">{exerciseCompletion.guidedAttempts.map((attempt) => <AttemptRow key={attempt.id} attempt={attempt} />)}</div>
            <div className="mt-6"><h3 className="text-sm font-semibold text-[var(--navy)]">Independent transfer</h3>{exerciseCompletion.transferTest ? <div className="mt-3"><AttemptRow attempt={exerciseCompletion.transferTest} /></div> : <div className="mt-3 rounded-2xl border border-dashed border-[var(--line)] bg-[var(--canvas)] p-5"><p className="text-sm font-medium text-[var(--ink)]">Not tested</p><p className="mt-1 text-sm leading-6 text-[var(--muted-ink)]">Your guided attempts were saved, but independent performance was not tested in this exercise.</p></div>}</div>
          </section>

          <div className="mt-4 flex items-center justify-between gap-5 rounded-2xl border border-[var(--line)] bg-white p-4">
            <div className="flex gap-2 text-sm leading-6 text-[var(--muted-ink)]"><ShieldCheck className="mt-0.5 size-4 shrink-0 text-[var(--teal)]" />When you end the exercise, these results are removed. Sayform keeps only the learning signal needed to recommend your next exercise.</div>
            <Button onClick={() => void finish()} disabled={ending} className="h-11 shrink-0 rounded-xl bg-[var(--navy)] px-6 hover:bg-[#4c1d95]">{ending ? 'Ending…' : 'End exercise'} <ArrowRight className="ml-1 size-4" /></Button>
          </div>
          {endError && <p role="alert" className="mt-3 text-right text-xs text-[#9a493c]">{endError}</p>}
        </div>
      </Screen>
    </AppShell>
  );
}

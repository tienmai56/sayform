'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AlertCircle, ArrowRight, Sparkles, Target } from 'lucide-react';
import { AppShell, Breadcrumbs, MetricCard, Screen } from '@/components/app-shell';
import { Button } from '@/components/ui/button';
import { usePractice } from '@/components/practice-context';
import { finishPersonalizedExercise, getExerciseAttemptProgress } from '@/lib/client-data';
import type { ExerciseAssessment, ExerciseAttemptProgress } from '@/lib/types';
import { cn } from '@/lib/utils';

const assessmentCopy: Record<ExerciseAssessment, { label: string; className: string }> = {
  pass: { label: 'Pass', className: 'bg-[var(--mint-soft)] text-[var(--teal-dark)]' },
  partial: { label: 'Partial', className: 'bg-[#fff2cf] text-[#805b17]' },
  fail: { label: 'Needs another try', className: 'bg-[var(--rose-soft)] text-[#8a4438]' },
  not_evaluated: { label: 'Not evaluated', className: 'bg-[var(--warm)] text-[var(--muted-ink)]' },
};

export function ExerciseAttemptFeedback() {
  const router = useRouter();
  const {
    activeExercise,
    activeExerciseAttemptId,
    advanceExercise,
    clearRecording,
    completeExerciseAttempt,
    currentExerciseResult,
    exerciseAnalysisError,
    exerciseAnalysisStatus,
    exerciseResults,
    prompt,
    setExerciseAnalysisProgress,
    setExerciseCompletion,
  } = usePractice();
  const [finishing, setFinishing] = useState(false);
  const [error, setError] = useState('');
  const [analysisPreview, setAnalysisPreview] = useState<ExerciseAttemptProgress | null>(null);

  useEffect(() => {
    if (!activeExercise || currentExerciseResult || !activeExerciseAttemptId || exerciseAnalysisStatus === 'failed') return;
    const exerciseId = activeExercise.id;
    const attemptId = activeExerciseAttemptId;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const startedAt = Date.now();

    async function poll() {
      try {
        const progress = await getExerciseAttemptProgress(exerciseId, attemptId);
        if (cancelled) return;
        setAnalysisPreview(progress);
        if (progress.result) {
          completeExerciseAttempt(progress.result);
          return;
        }
        if (progress.stage === 'failed') {
          setExerciseAnalysisProgress('failed', progress.error);
          return;
        }
        if (Date.now() - startedAt >= 120_000) {
          setExerciseAnalysisProgress('failed', 'Exercise feedback is taking longer than expected. Please record this attempt again.');
          return;
        }
        timer = setTimeout(() => void poll(), 700);
      } catch {
        if (cancelled) return;
        timer = setTimeout(() => void poll(), 1200);
      }
    }

    void poll();
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [activeExercise, activeExerciseAttemptId, completeExerciseAttempt, currentExerciseResult, exerciseAnalysisStatus, setExerciseAnalysisProgress]);

  if (!activeExercise) return null;
  const exercise = activeExercise;
  if (!currentExerciseResult) {
    const stage = analysisPreview?.stage ?? (exerciseAnalysisStatus === 'idle' ? 'queued' : exerciseAnalysisStatus);
    const stageOrder = { queued: 0, transcribing: 0, analyzing: 1, completed: 2, failed: 0 } as const;
    const tryAgain = () => {
      clearRecording();
      setExerciseAnalysisProgress('idle');
      router.push('/practice/session');
    };
    return (
      <AppShell>
        <Screen wide>
          <Breadcrumbs items={[{ label: 'Exercises', href: '/exercises' }, { label: exercise.title }, { label: 'Preparing feedback' }]} />
          <div className="mb-6 flex items-start justify-between gap-6">
            <div><p className="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--teal-dark)]">Attempt complete</p><h1 className="mt-2 max-w-4xl font-display text-2xl font-semibold leading-8 text-[var(--navy)]">{prompt}</h1></div>
            <span className="rounded-full bg-[var(--mint-soft)] px-3 py-1.5 text-xs font-medium text-[var(--teal-dark)]">Skill · {exercise.targetSkill}</span>
          </div>
          <section className="min-h-[620px] rounded-3xl border border-[var(--line)] bg-[var(--paper)] p-8 shadow-[var(--shadow-sm)]">
            <div className="mx-auto flex min-h-[550px] max-w-3xl flex-col justify-center">
              {exerciseAnalysisStatus === 'failed' || !activeExerciseAttemptId ? (
                <div className="rounded-2xl border border-[#e8c6bf] bg-[var(--rose-soft)] p-7 text-center">
                  <AlertCircle className="mx-auto size-7 text-[#914435]" />
                  <h2 className="mt-3 font-display text-xl font-semibold text-[var(--navy)]">Exercise feedback could not be completed</h2>
                  <p className="mt-2 text-sm leading-6 text-[#765149]">{exerciseAnalysisError ?? 'Please record this exercise attempt again.'}</p>
                  <Button onClick={tryAgain} className="mt-5 rounded-xl bg-[var(--navy)]">Try attempt again</Button>
                </div>
              ) : (
                <>
                  <div className="text-center">
                    <span className="mx-auto grid size-12 place-items-center rounded-2xl bg-[var(--mint-soft)] text-[var(--teal-dark)]"><Sparkles className="size-5 animate-pulse" /></span>
                    <h2 className="mt-4 font-display text-xl font-semibold text-[var(--navy)]">Preparing your targeted feedback</h2>
                    <p className="mt-2 text-sm text-[var(--muted-ink)]">Your recording is saved. Coaching will appear as soon as it is ready.</p>
                  </div>
                  <div className="mt-6 grid grid-cols-3 gap-2">
                    {(['Transcribing', 'Evaluating', 'Ready'] as const).map((label, index) => (
                      <div key={label} className={cn('rounded-xl border px-3 py-3 text-center text-xs font-semibold', stageOrder[stage] >= index ? 'border-[var(--mint)] bg-[var(--mint-soft)] text-[var(--teal-dark)]' : 'border-[var(--line)] bg-white text-[var(--muted-ink)]')}>{label}</div>
                    ))}
                  </div>
                  {analysisPreview?.transcript && (
                    <div className="mt-6 rounded-2xl border border-[var(--line)] bg-white p-5">
                      <div className="flex items-center justify-between gap-4"><p className="text-xs font-semibold uppercase tracking-[0.09em] text-[var(--teal-dark)]">Transcript ready</p>{analysisPreview.metrics && <span className="text-xs text-[var(--muted-ink)]">{analysisPreview.metrics.wordCount} words · {analysisPreview.metrics.averageWpm} WPM</span>}</div>
                      <p className="mt-3 line-clamp-5 text-sm leading-7 text-[#52666e]">{analysisPreview.transcript}</p>
                    </div>
                  )}
                </>
              )}
            </div>
          </section>
        </Screen>
      </AppShell>
    );
  }
  const { attempt, next } = currentExerciseResult;
  const assessment = assessmentCopy[attempt.assessment];
  const whatWorked = attempt.assessment === 'not_evaluated' ? '' : attempt.whatWorked.trim();
  const guidedCompleted = exerciseResults.filter((result) => result.attempt.attemptType === 'guided').length;

  function continueExercise() {
    clearRecording();
    advanceExercise();
    router.push('/practice/session');
  }

  async function showSummary() {
    setFinishing(true);
    setError('');
    try {
      const summary = await finishPersonalizedExercise(exercise.id);
      setExerciseCompletion(summary);
      clearRecording();
      router.push('/exercise/summary');
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'The exercise summary could not be prepared.');
      setFinishing(false);
    }
  }

  const feedbackPanel = (
    <section className="min-h-0 overflow-hidden rounded-3xl border border-[var(--line)] bg-[var(--paper)] shadow-[var(--shadow-sm)]">
      <div className="flex h-full min-h-0 flex-col">
        <header className="flex items-center justify-between border-b border-[var(--line)] px-6 py-4">
          <div>
            <div className="flex items-center gap-2"><Target className="size-4 text-[var(--teal)]" /><h2 className="font-display text-lg font-semibold text-[var(--navy)]">Targeted feedback</h2></div>
            <p className="mt-1 text-xs text-[var(--muted-ink)]">Evaluated only for {exercise.targetBehavior.toLocaleLowerCase()}</p>
          </div>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto p-6">
          <div className="flex items-center justify-between rounded-2xl border border-[var(--line)] bg-white p-5">
            <div><p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-[var(--muted-ink)]">{attempt.attemptType === 'transfer' ? 'Independent transfer test' : `Guided attempt ${attempt.attemptNumber}`}</p><p className="mt-2 text-sm font-semibold text-[var(--navy)]">{exercise.title}</p></div>
            <span className={cn('rounded-full px-3 py-1.5 text-xs font-semibold', assessment.className)}>{assessment.label}</span>
          </div>

          <div className="mt-5 grid grid-cols-3 gap-3">
            <MetricCard label="Speaking time" value={`${attempt.durationSeconds}s`} detail="This recorded attempt" />
            <MetricCard label="Speaking pace" value={`${attempt.metrics.averageWpm} WPM`} detail="Supporting metric only" />
            <MetricCard label="Fillers" value={String(attempt.metrics.fillerCount)} detail="Not used as the pass criterion" />
          </div>

          <div className={cn('mt-5 grid gap-4', whatWorked ? 'grid-cols-2' : 'grid-cols-1')}>
            {whatWorked && (
              <article className="rounded-2xl border border-[var(--line)] bg-white p-5">
                <p className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.09em] text-[var(--muted-ink)]"><span className="size-2 rounded-full bg-[#55a887]" />What worked</p>
                <h3 className="mt-3 text-sm font-semibold leading-5 text-[var(--navy)]">A behavior to keep</h3>
                <p className="mt-3 text-sm leading-6 text-[var(--ink)]">{whatWorked}</p>
              </article>
            )}
            <article className="rounded-2xl border border-[var(--line)] bg-white p-5">
              <p className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.09em] text-[var(--muted-ink)]"><span className="size-2 rounded-full bg-[#d19a29]" />What you can improve</p>
              <h3 className="mt-3 text-sm font-semibold leading-5 text-[var(--navy)]">Make the target behavior clearer</h3>
              {(attempt.supportingEvidence || attempt.nextGuidance) && (
                <div className="mt-4">
                  {attempt.supportingEvidence && <p className="text-sm font-semibold leading-6 text-[var(--ink)]">“<mark className="rounded-sm bg-[#fff0a8] px-0.5 text-[var(--ink)]">{attempt.supportingEvidence}</mark>”</p>}
                  {attempt.nextGuidance && <p className="mt-1.5 text-sm font-medium leading-6 text-[var(--ink)]">→ {attempt.nextGuidance}</p>}
                </div>
              )}
              <p className="mt-4 text-sm leading-6 text-[var(--ink)]">{attempt.whatToImprove}</p>
            </article>
          </div>

          {next.stage === 'guided' && (
            <div className="mt-5 rounded-2xl border border-[var(--mint)] bg-[var(--canvas)] p-5">
              <p className="text-xs font-semibold uppercase tracking-[0.09em] text-[var(--teal-dark)]">Your next question</p>
              <p className="mt-2 text-sm font-medium leading-6 text-[var(--ink)]">{next.prompt}</p>
              <p className="mt-2 text-xs leading-5 text-[var(--muted-ink)]">Use the specific rewrite above as a pattern, not a script.</p>
            </div>
          )}
          {next.stage === 'transfer' && (
            <div className="mt-5 rounded-2xl border border-[var(--line)] bg-[var(--canvas)] p-5">
              <p className="text-xs font-semibold uppercase tracking-[0.09em] text-[var(--teal-dark)]">Ready for an independent test</p>
              <p className="mt-2 text-sm leading-6 text-[var(--ink)]">You’ll apply the same behavior to a new question without hints or a model answer.</p>
            </div>
          )}
        </div>

        <footer className="border-t border-[var(--line)] bg-[var(--canvas)] px-6 py-4">
          {error && <p role="alert" className="mb-3 text-right text-xs text-[#9a493c]">{error}</p>}
          <div className="flex items-center justify-between gap-4">
            <span className="text-xs text-[var(--muted-ink)]">{guidedCompleted} guided {guidedCompleted === 1 ? 'attempt' : 'attempts'} completed</span>
            <div className="flex items-center gap-3">
              {next.stage !== 'summary' && <button onClick={() => void showSummary()} disabled={finishing} className="px-2 py-2 text-sm font-medium text-[var(--muted-ink)] hover:text-[var(--ink)]">Finish for now</button>}
              {next.stage === 'summary' ? (
                <Button onClick={() => void showSummary()} disabled={finishing} className="h-10 rounded-xl bg-[var(--navy)] px-4 hover:bg-[#1d4255]">{finishing ? 'Preparing results…' : 'View exercise results'} <ArrowRight className="ml-1 size-4" /></Button>
              ) : (
                <Button onClick={continueExercise} className="h-10 rounded-xl bg-[var(--navy)] px-4 hover:bg-[#1d4255]">{next.stage === 'transfer' ? 'Start independent test' : 'Next attempt'} <ArrowRight className="ml-1 size-4" /></Button>
              )}
            </div>
          </div>
        </footer>
      </div>
    </section>
  );

  return (
    <AppShell>
      <Screen wide>
        <Breadcrumbs items={[{ label: 'Exercises', href: '/exercises' }, { label: exercise.title }, { label: attempt.attemptType === 'transfer' ? 'Independent test feedback' : `Attempt ${attempt.attemptNumber} feedback` }]} />
        <div className="mb-6 flex items-start justify-between gap-6">
          <div><p className="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--teal-dark)]">{attempt.attemptType === 'transfer' ? 'Independent test complete' : `Attempt ${attempt.attemptNumber} complete`}</p><h1 className="mt-2 max-w-4xl font-display text-2xl font-semibold leading-8 text-[var(--navy)]">{attempt.prompt}</h1></div>
          <span className="rounded-full bg-[var(--mint-soft)] px-3 py-1.5 text-xs font-medium text-[var(--teal-dark)]">Skill · {exercise.targetSkill}</span>
        </div>
        <div className="min-h-[720px]">{feedbackPanel}</div>
      </Screen>
    </AppShell>
  );
}

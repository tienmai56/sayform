'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AlertCircle, ArrowRight, Sparkles, Target } from 'lucide-react';
import { AppShell, Breadcrumbs, Screen } from '@/components/app-shell';
import { Button } from '@/components/ui/button';
import { usePractice } from '@/components/practice-context';
import { finishPersonalizedExercise, getExerciseAttemptProgress } from '@/lib/client-data';
import type { ExerciseAssessment, ExerciseAttemptProgress } from '@/lib/types';
import { cn } from '@/lib/utils';
import { FeedbackProgressSteps } from '@/components/feedback-progress-steps';
import { SpeakingPaceIllustration, speakingPaceComment } from '@/components/speaking-pace-illustration';

const assessmentCopy: Record<ExerciseAssessment, { label: string; className: string; surfaceClassName: string; summary: string }> = {
  pass: {
    label: 'Pass',
    className: 'bg-[#c8f2d3] text-[#17613a]',
    surfaceClassName: 'border-[#cfe7d7] bg-[#f4fbf6]',
    summary: 'You demonstrated the target behavior clearly in this attempt.',
  },
  partial: {
    label: 'Partial',
    className: 'bg-[#ffe6a8] text-[#805b17]',
    surfaceClassName: 'border-[#eadfc8] bg-[#fffaf1]',
    summary: 'You showed the target behavior, but it needs to be more explicit and consistent.',
  },
  fail: {
    label: 'Needs another try',
    className: 'bg-[#f6d8d1] text-[#8a4438]',
    surfaceClassName: 'border-[#ead3ce] bg-[#fff7f5]',
    summary: 'The target behavior was not clear enough in this attempt yet.',
  },
  not_evaluated: {
    label: 'Not evaluated',
    className: 'bg-[#ece8f3] text-[var(--muted-ink)]',
    surfaceClassName: 'border-[#e4deeb] bg-[#f8f6fc]',
    summary: 'This attempt could not be evaluated against the target behavior.',
  },
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
          const result = progress.result;
          timer = setTimeout(() => {
            if (!cancelled) completeExerciseAttempt(result);
          }, 800);
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
                  <FeedbackProgressSteps stage={stage} />
                  {analysisPreview?.transcript && (
                    <div className="mt-6 rounded-2xl border border-[var(--line)] bg-white p-5">
                      <div className="flex items-center justify-between gap-4"><p className="text-xs font-semibold uppercase tracking-[0.09em] text-[var(--teal-dark)]">Transcript ready</p>{analysisPreview.metrics && <span className="text-xs text-[var(--muted-ink)]">{analysisPreview.metrics.wordCount} words · {analysisPreview.metrics.averageWpm} WPM</span>}</div>
                      <p className="mt-3 whitespace-pre-wrap text-sm leading-7 text-[#6d5b7f]">{analysisPreview.transcript}</p>
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
  const primaryFiller = Object.entries(attempt.metrics.fillerWords ?? {})
    .filter(([phrase, count]) => phrase.trim() && count > 0)
    .sort(([leftPhrase, leftCount], [rightPhrase, rightCount]) => rightCount - leftCount || leftPhrase.localeCompare(rightPhrase))[0] ?? null;

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
          <section aria-labelledby="exercise-attempt-glance-title">
            <h3 id="exercise-attempt-glance-title" className="font-display text-xl font-semibold tracking-[-0.025em] text-[#4f23c8]">Your attempt at a glance</h3>
            <article className={cn('mt-3 rounded-2xl border p-5', assessment.surfaceClassName)}>
              <div className="flex items-start justify-between gap-5">
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-[var(--muted-ink)]">{attempt.attemptType === 'transfer' ? 'Independent transfer test' : `Guided attempt ${attempt.attemptNumber}`}</p>
                  <h4 className="mt-2 text-base font-semibold text-[var(--navy)]">{exercise.title}</h4>
                </div>
                <span className={cn('shrink-0 rounded-xl px-4 py-2 text-xs font-bold uppercase tracking-[0.04em]', assessment.className)}>{assessment.label}</span>
              </div>
              <p className="mt-3 max-w-3xl text-sm leading-6 text-[var(--ink)]">{assessment.summary}</p>
            </article>

            <h3 className="mt-6 font-display text-xl font-semibold tracking-[-0.025em] text-[#4f23c8]">Detailed coaching</h3>
            <div className={cn('mt-3 grid grid-cols-1 gap-3', whatWorked && 'xl:grid-cols-2')}>
              {whatWorked && (
                <article className="rounded-2xl border border-[#e4dcf2] bg-[#f8f5ff] p-5 shadow-[0_1px_2px_rgba(43,23,69,0.03)]">
                  <p className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.09em] text-[var(--muted-ink)]"><span className="size-2 rounded-full bg-[#8b5cf6]" />What worked</p>
                  <h4 className="mt-2 text-sm font-semibold leading-5 text-[var(--navy)]">A behavior to keep</h4>
                  <p className="mt-3 text-sm leading-6 text-[var(--ink)]">{whatWorked}</p>
                </article>
              )}
              <article className="rounded-2xl border border-[#e4dcf2] bg-[#f8f5ff] p-5 shadow-[0_1px_2px_rgba(43,23,69,0.03)]">
                <p className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.09em] text-[var(--muted-ink)]"><span className="size-2 rounded-full bg-[#d19a29]" />What you can improve</p>
                <h4 className="mt-2 text-sm font-semibold leading-5 text-[var(--navy)]">Make the target behavior clearer</h4>
                {attempt.supportingEvidence && <p className="mt-3 text-sm font-semibold leading-6 text-[var(--ink)]">“<mark className="rounded-sm bg-[#fff0a8] px-0.5 text-[var(--ink)]">{attempt.supportingEvidence}</mark>”</p>}
                {attempt.nextGuidance && (
                  <div className="mt-3">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.09em] text-[#6842d8]">Recommendation</p>
                    <p className="mt-1 text-sm font-medium leading-6 text-[var(--ink)]">→ {attempt.nextGuidance}</p>
                  </div>
                )}
                <p className="mt-3 text-sm leading-6 text-[var(--muted-ink)]">{attempt.whatToImprove}</p>
              </article>
            </div>

            {next.stage === 'guided' && (
              <section className="mt-4 rounded-2xl bg-[#f8f6fc] p-5" aria-labelledby="next-exercise-question-title">
                <p id="next-exercise-question-title" className="text-xs font-semibold uppercase tracking-[0.09em] text-[#6842d8]">Your next question</p>
                <p className="mt-2 text-sm font-medium leading-6 text-[var(--ink)]">{next.prompt}</p>
                <p className="mt-2 text-sm leading-6 text-[var(--muted-ink)]">Use the specific rewrite above as a pattern, not a script.</p>
              </section>
            )}
            {next.stage === 'transfer' && (
              <section className="mt-4 rounded-2xl bg-[#f8f6fc] p-5" aria-labelledby="independent-test-title">
                <p id="independent-test-title" className="text-xs font-semibold uppercase tracking-[0.09em] text-[#6842d8]">Ready for an independent test</p>
                <p className="mt-2 text-sm leading-6 text-[var(--ink)]">You’ll apply the same behavior to a new question without hints or a model answer.</p>
              </section>
            )}

            <section className="mt-4 rounded-2xl bg-[#f8f6fc] p-5" aria-labelledby="exercise-response-details-title">
              <h3 id="exercise-response-details-title" className="text-sm font-semibold text-[var(--navy)]">Response details</h3>
              <div className="mt-3 grid items-center gap-5 xl:grid-cols-[minmax(0,1.15fr)_minmax(360px,0.85fr)]">
                <div className="flex min-w-0 flex-col items-start gap-5 sm:flex-row sm:items-center">
                  <SpeakingPaceIllustration wordsPerMinute={attempt.metrics.averageWpm} />
                  <div className="min-w-0">
                    <p className="text-xs font-semibold uppercase tracking-[0.09em] text-[var(--teal-dark)]">Average speaking pace</p>
                    <p className="mt-2 font-display text-4xl font-semibold tracking-[-0.04em] text-[var(--navy)]">{attempt.metrics.averageWpm} <span className="text-base tracking-normal text-[var(--muted-ink)]">WPM</span></p>
                    <p className="mt-2 max-w-lg text-sm leading-6 text-[var(--muted-ink)]">{speakingPaceComment(attempt.metrics.averageWpm)}</p>
                  </div>
                </div>
                <dl className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  <div className="rounded-xl bg-white p-4">
                    <dt className="text-xs font-medium text-[var(--muted-ink)]">Speaking time</dt>
                    <dd className="mt-2 font-display text-2xl font-semibold tracking-[-0.03em] text-[var(--navy)]">{attempt.durationSeconds}s</dd>
                    <dd className="mt-1.5 text-[11px] leading-4 text-[var(--muted-ink)]">This recorded attempt</dd>
                  </div>
                  <div className="rounded-xl bg-white p-4">
                    <dt className="text-xs font-medium text-[var(--muted-ink)]">Most-used filler</dt>
                    <dd className="mt-2 font-display text-2xl font-semibold tracking-[-0.03em] text-[var(--navy)]">{primaryFiller ? `“${primaryFiller[0]}”` : 'None'}</dd>
                    <dd className="mt-1.5 text-[11px] leading-4 text-[var(--muted-ink)]">
                      {primaryFiller
                        ? `Used ${primaryFiller[1]} ${primaryFiller[1] === 1 ? 'time' : 'times'} · ${attempt.metrics.fillerCount} total ${attempt.metrics.fillerCount === 1 ? 'filler' : 'fillers'}`
                        : 'No filler words detected'}
                    </dd>
                  </div>
                </dl>
              </div>
            </section>
          </section>
        </div>

        <footer className="border-t border-[var(--line)] bg-[var(--canvas)] px-6 py-4">
          {error && <p role="alert" className="mb-3 text-right text-xs text-[#9a493c]">{error}</p>}
          <div className="flex items-center justify-between gap-4">
            <span className="text-xs text-[var(--muted-ink)]">{guidedCompleted} guided {guidedCompleted === 1 ? 'attempt' : 'attempts'} completed</span>
            <div className="flex items-center gap-3">
              {next.stage !== 'summary' && <button onClick={() => void showSummary()} disabled={finishing} className="px-2 py-2 text-sm font-medium text-[var(--muted-ink)] hover:text-[var(--ink)]">Finish for now</button>}
              {next.stage === 'summary' ? (
                <Button onClick={() => void showSummary()} disabled={finishing} className="h-10 rounded-xl bg-[var(--navy)] px-4 hover:bg-[#4c1d95]">{finishing ? 'Preparing results…' : 'View exercise results'} <ArrowRight className="ml-1 size-4" /></Button>
              ) : (
                <Button onClick={continueExercise} className="h-10 rounded-xl bg-[var(--navy)] px-4 hover:bg-[#4c1d95]">{next.stage === 'transfer' ? 'Start independent test' : 'Next attempt'} <ArrowRight className="ml-1 size-4" /></Button>
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
          <div><p className="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--teal-dark)]">{attempt.attemptType === 'transfer' ? 'Independent test complete' : `Attempt ${attempt.attemptNumber} complete`}</p><h1 className="mt-2 max-w-5xl font-display text-lg font-medium leading-7 tracking-[-0.01em] text-[var(--navy)]">{attempt.prompt}</h1></div>
          <span className="rounded-full bg-[var(--mint-soft)] px-3 py-1.5 text-xs font-medium text-[var(--teal-dark)]">Skill · {exercise.targetSkill}</span>
        </div>
        <div className="min-h-[720px]">{feedbackPanel}</div>
      </Screen>
    </AppShell>
  );
}

'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AlertCircle, ArrowRight, BookOpenCheck, CheckCircle2, Clock3, Dumbbell, Lightbulb, Sparkles, Target } from 'lucide-react';
import { AppShell, Breadcrumbs, MetricCard, Screen } from '@/components/app-shell';
import { Button } from '@/components/ui/button';
import { usePractice } from '@/components/practice-context';
import { finishPracticeSession, getPracticeSessionSummary, updateExerciseStatus, usesPersistentBackend } from '@/lib/client-data';
import type { FinishedSession, InterviewCheck, SessionSummaryProgress, SummaryPattern } from '@/lib/types';

function formatDuration(totalSeconds: number) {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return minutes ? `${minutes} min ${seconds} sec` : `${seconds} sec`;
}

function PatternCard({ pattern, kind }: { pattern: SummaryPattern; kind: 'strength' | 'opportunity' }) {
  const strength = kind === 'strength';
  return (
    <article className={`rounded-2xl border p-5 ${strength ? 'border-[var(--mint)] bg-[var(--mint-soft)]' : 'border-[var(--line)] bg-white'}`}>
      <div className="flex items-start gap-4">
        <span className={`grid size-9 shrink-0 place-items-center rounded-xl bg-white ${strength ? 'text-[var(--teal-dark)]' : 'text-[#93671c]'}`}>
          {strength ? <CheckCircle2 className="size-4" /> : <Lightbulb className="size-4" />}
        </span>
        <div>
          <p className={`text-xs font-semibold uppercase tracking-[0.1em] ${strength ? 'text-[var(--teal-dark)]' : 'text-[#87601d]'}`}>{strength ? 'Recurring strength' : 'Primary opportunity'}</p>
          <h3 className="mt-1.5 text-base font-semibold text-[var(--navy)]">{pattern.title}</h3>
          <p className="mt-2 text-sm leading-6 text-[var(--muted-ink)]">{pattern.detail}</p>
          {pattern.evidence && <blockquote className="mt-3 border-l-2 border-[var(--mint)] pl-3 text-xs italic leading-5 text-[#52666d]">“{pattern.evidence}”</blockquote>}
        </div>
      </div>
    </article>
  );
}

function InterviewCheckCard({ check }: { check: InterviewCheck }) {
  const verdict = check.verdict ?? (check.passed ? 'yes' : 'no');
  return (
    <article className="rounded-2xl border border-[var(--line)] bg-white p-5 shadow-[var(--shadow-sm)]">
      <div className="flex items-start gap-3">
        <span className={`mt-0.5 grid size-8 shrink-0 place-items-center rounded-full ${verdict === 'yes' ? 'bg-[var(--mint-soft)] text-[var(--teal-dark)]' : verdict === 'partially' ? 'bg-[var(--amber-soft)] text-[#8a621c]' : 'bg-[var(--rose-soft)] text-[#914435]'}`}>
          {verdict === 'yes' ? <CheckCircle2 className="size-4" /> : <AlertCircle className="size-4" />}
        </span>
        <h3 className="pt-1 text-sm font-semibold leading-5 text-[var(--navy)]">{check.question}</h3>
      </div>
      <p className="mt-4 text-sm leading-6 text-[var(--ink)]"><span className="font-bold">{verdict === 'yes' ? 'Yes' : verdict === 'partially' ? 'Partially' : 'No'}.</span> {check.detail}</p>
      {check.evidence && (
        <p className="mt-3 text-xs font-semibold leading-5 text-[var(--ink)]">
          “{verdict === 'yes' ? check.evidence : <mark className="rounded-sm bg-[#fff0a8] px-0.5 text-[var(--ink)]">{check.evidence}</mark>}”
        </p>
      )}
    </article>
  );
}

export function SessionSummaryView() {
  const router = useRouter();
  const {
    activeSessionId,
    answerCount,
    categories,
    goalTemplateKey,
    goalTitle,
    prompt,
    resetSession,
    sessionStartedAt,
    setActiveExercise,
    startExercise: beginExercise,
  } = usePractice();
  const saveStarted = useRef(false);
  const [result, setResult] = useState<FinishedSession | null>(null);
  const [pendingSession, setPendingSession] = useState<FinishedSession['session'] | null>(null);
  const [saveState, setSaveState] = useState<'saving' | 'processing' | 'saved' | 'error'>('saving');

  useEffect(() => {
    if (!activeSessionId || saveStarted.current) return;
    saveStarted.current = true;
    const sessionId = activeSessionId;
    let cancelled = false;
    let pollingTimer: ReturnType<typeof setTimeout> | undefined;
    const summaryStartedAt = Date.now();

    function applyProgress(progress: SessionSummaryProgress) {
      if (cancelled) return;
      if (progress.generationStatus === 'completed') {
        setResult(progress.result);
        setPendingSession(progress.result.session);
        setActiveExercise(progress.result.exercise);
        setSaveState('saved');
        return;
      }
      setPendingSession(progress.session);
      if (progress.generationStatus === 'failed') {
        setSaveState('error');
        return;
      }
      if (Date.now() - summaryStartedAt >= 120_000) {
        setSaveState('error');
        return;
      }
      setSaveState('processing');
      pollingTimer = setTimeout(() => void pollSummary(), 850);
    }

    async function pollSummary() {
      try {
        applyProgress(await getPracticeSessionSummary(sessionId));
      } catch {
        if (!cancelled) setSaveState('error');
      }
    }

    void finishPracticeSession({
      sessionId,
      goal: goalTitle,
      goalTemplateKey,
      categories,
      prompt,
      answerCount,
      startedAt: sessionStartedAt,
    }).then(applyProgress).catch(() => {
      if (!cancelled) setSaveState('error');
    });

    return () => {
      cancelled = true;
      if (pollingTimer) clearTimeout(pollingTimer);
    };
  }, [activeSessionId, answerCount, categories, goalTemplateKey, goalTitle, prompt, sessionStartedAt, setActiveExercise]);

  async function startExercise() {
    if (!result?.exercise) return;
    await updateExerciseStatus(result.exercise.id, 'in_progress');
    beginExercise(result.exercise);
    router.push('/practice/session');
  }

  async function finishSession() {
    resetSession();
    router.push('/history');
  }

  const metrics = result?.session ?? pendingSession;
  const summary = result?.summary;
  const exercise = result?.exercise;

  return (
    <AppShell>
      <Screen>
        <Breadcrumbs items={[{ label: 'Home', href: '/goals' }, { label: 'Session summary' }]} />

        <div className="rounded-[30px] bg-[var(--navy)] px-9 py-8 text-white shadow-[var(--shadow-lg)]">
          <div className="flex items-start justify-between gap-8">
            <div>
              <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.13em] text-[var(--mint)]"><CheckCircle2 className="size-4" /> Session complete</div>
              <h1 className="mt-4 font-display text-[38px] font-semibold tracking-[-0.045em]">{summary?.headline ?? 'Building your session summary…'}</h1>
              <p className="mt-3 max-w-3xl text-[15px] leading-7 text-white/65">{summary?.summary ?? 'Combining your completed answers, metrics, and feedback patterns.'}</p>
            </div>
            <div className="shrink-0 rounded-2xl border border-white/10 bg-white/5 px-5 py-4 text-right">
              <p className="text-[11px] uppercase tracking-[0.1em] text-white/45">Primary goal</p>
              <p className="mt-1 max-w-52 text-sm font-semibold">{goalTitle}</p>
            </div>
          </div>
        </div>

        {summary?.interviewChecks?.length ? (
          <section className="mt-6" aria-labelledby="interview-check-title">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.11em] text-[var(--teal-dark)]">Interview answer check</p>
              <h2 id="interview-check-title" className="mt-1 font-display text-2xl font-semibold tracking-[-0.025em] text-[var(--navy)]">Three questions your coach always checks</h2>
            </div>
            <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-3">
              {summary.interviewChecks.map((check) => <InterviewCheckCard key={check.id} check={check} />)}
            </div>
          </section>
        ) : null}

        <div className="mt-6 grid grid-cols-4 gap-4">
          <MetricCard label="Session pace" value={metrics ? `${metrics.averageWpm} WPM` : '—'} detail={metrics ? `${metrics.wordCount} words ÷ ${formatDuration(metrics.durationSeconds)}` : 'Calculating from all completed answers'} />
          <MetricCard label="Completed answers" value={metrics ? String(metrics.answers) : '—'} detail="Skipped questions are excluded" />
          <MetricCard label="Fillers" value={metrics ? String(metrics.fillerCount) : '—'} detail="From transcribed speech" />
          <MetricCard label="Practice time" value={metrics ? formatDuration(metrics.durationSeconds) : '—'} detail="Recording time across answers" />
        </div>

        <div className="mt-7 grid grid-cols-[minmax(0,1fr)_420px] gap-6">
          <section className="rounded-3xl border border-[var(--line)] bg-[var(--paper)] p-7 shadow-[var(--shadow-sm)]">
            <div className="flex items-center gap-2"><BookOpenCheck className="size-5 text-[var(--teal)]" /><h2 className="font-display text-xl font-semibold text-[var(--navy)]">Patterns across your answers</h2></div>
            {summary ? (
              <div className="mt-6 space-y-4">
                {summary.strengths.map((pattern) => <PatternCard key={`strength-${pattern.title}`} pattern={pattern} kind="strength" />)}
                {summary.opportunities.map((pattern) => <PatternCard key={`opportunity-${pattern.title}`} pattern={pattern} kind="opportunity" />)}
                <div className="rounded-2xl border border-[var(--line)] bg-[var(--canvas)] p-5"><p className="text-xs font-semibold uppercase tracking-[0.1em] text-[var(--teal-dark)]">Takeaway for your next session</p><p className="mt-2 text-sm leading-6 text-[var(--muted-ink)]">{summary.takeaway}</p></div>
              </div>
            ) : (
              <div className="mt-6 grid min-h-64 place-items-center rounded-2xl border border-dashed border-[var(--line)] text-sm text-[var(--muted-ink)]">{saveState === 'error' ? 'The summary could not be completed. Reload this page to try again.' : 'Reviewing saved feedback patterns…'}</div>
            )}
          </section>

          <aside className="self-start overflow-hidden rounded-3xl border border-[var(--line)] bg-[var(--paper)] shadow-[var(--shadow-sm)]">
            <div className="bg-[var(--mint-soft)] p-6">
              <div className="flex items-center justify-between"><span className="grid size-11 place-items-center rounded-2xl bg-white text-[var(--teal-dark)] shadow-sm"><Dumbbell className="size-5" /></span><span className="rounded-full bg-white/80 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.09em] text-[var(--teal-dark)]">After-session exercise</span></div>
              <p className="mt-5 text-xs font-semibold uppercase tracking-[0.1em] text-[var(--teal-dark)]">{exercise ? `Let’s work on ${exercise.targetSkill.toLocaleLowerCase()}` : 'Selecting one focused exercise…'}</p>
              <h2 className="mt-2 font-display text-2xl font-semibold tracking-[-0.03em] text-[var(--navy)]">{exercise?.title ?? 'Personalized practice'}</h2>
              {exercise && <p className="mt-2 flex items-center gap-1.5 text-sm text-[#516b6b]"><Clock3 className="size-4" />About {exercise.estimatedMinutes} minutes</p>}
            </div>

            <div className="p-6">
              {exercise ? (
                <>
                  <p className="text-xs font-semibold uppercase tracking-[0.1em] text-[var(--muted-ink)]">Why this exercise</p>
                  <p className="mt-3 text-sm leading-6 text-[var(--muted-ink)]">{exercise.selectionReason}</p>
                  <div className="mt-4 rounded-xl bg-[var(--canvas)] p-4"><p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-[var(--muted-ink)]">Evidence from your session</p><p className="mt-2 text-sm font-medium leading-6 text-[var(--ink)]">“{exercise.sourceEvidence}”</p></div>
                  <div className="mt-4 rounded-xl border border-[var(--line)] p-4"><p className="flex items-center gap-2 text-xs font-semibold text-[var(--navy)]"><Target className="size-4 text-[var(--teal)]" />What you’ll practise</p><p className="mt-2 text-sm leading-6 text-[#53666e]">{exercise.targetBehavior}</p><ul className="mt-3 space-y-1.5">{exercise.instructions.map((instruction) => <li key={instruction} className="flex gap-2 text-xs leading-5 text-[var(--muted-ink)]"><span className="text-[var(--teal)]">•</span>{instruction}</li>)}</ul></div>
                </>
              ) : <div className="grid min-h-48 place-items-center text-center text-sm leading-6 text-[var(--muted-ink)]">Finish saving the session to reveal its evidence-linked exercise.</div>}

              <Button disabled={!exercise || saveState !== 'saved'} onClick={() => void startExercise()} className="mt-5 h-11 w-full rounded-xl bg-[var(--navy)] hover:bg-[#1d4255]">Practice this skill <ArrowRight className="ml-1 size-4" /></Button>
              <button onClick={() => void finishSession()} className="mt-3 w-full py-2 text-sm font-medium text-[var(--muted-ink)] hover:text-[var(--ink)]">Finish session</button>
            </div>
          </aside>
        </div>

        <div className="mt-7 flex items-center justify-between rounded-2xl border border-[var(--line)] bg-[var(--paper)] px-5 py-4">
          <div className="flex items-center gap-3"><span className="grid size-9 place-items-center rounded-xl bg-[var(--warm)] text-[var(--navy)]"><Sparkles className="size-4" /></span><div><p className="text-sm font-semibold text-[var(--navy)]">{saveState === 'saving' ? 'Saving your session…' : saveState === 'processing' ? 'Session saved · building your coaching summary…' : saveState === 'error' ? 'Your session was saved, but the summary needs another try' : 'Your session has been added to History'}</p><p className="mt-0.5 text-xs text-[var(--muted-ink)]">{saveState === 'error' ? 'Reload this page to retry the personalized summary.' : usesPersistentBackend ? 'Transcript, metrics, and feedback are saved immediately. The recording is not saved.' : 'Demo data is stored only in this browser. The recording is not saved.'}</p></div></div>
          <Button variant="outline" onClick={() => void finishSession()} className="rounded-xl bg-white">View history</Button>
        </div>
      </Screen>
    </AppShell>
  );
}

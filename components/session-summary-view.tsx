'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  ArrowRight,
  BookOpenCheck,
  CheckCircle2,
  ChevronRight,
  Dumbbell,
  Lightbulb,
  MessageSquareQuote,
  Sparkles,
  Target,
} from 'lucide-react';
import { AppShell, Breadcrumbs, MetricCard, Screen } from '@/components/app-shell';
import { Button } from '@/components/ui/button';
import { usePractice } from '@/components/practice-context';
import { finishPracticeSession, usesPersistentBackend } from '@/lib/client-data';

const exercisePrompt =
  'Rephrase this idea in one clear sentence using a specific consequence: “Moving too quickly creates kind of a big problem later.”';

export function SessionSummaryView() {
  const router = useRouter();
  const {
    activeSessionId,
    answerCount,
    categories,
    goalTitle,
    prompt,
    sessionStartedAt,
    setActiveExerciseId,
    updateSetup,
  } = usePractice();
  const saveStarted = useRef(false);
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');

  useEffect(() => {
    if (!activeSessionId || saveStarted.current) return;
    saveStarted.current = true;
    setSaveState('saving');
    void finishPracticeSession({
      sessionId: activeSessionId,
      goal: goalTitle,
      categories,
      prompt,
      answerCount,
      startedAt: sessionStartedAt,
    })
      .then((result) => {
        setActiveExerciseId(result?.exerciseId ?? null);
        setSaveState('saved');
      })
      .catch(() => setSaveState('error'));
  }, [activeSessionId, answerCount, categories, goalTitle, prompt, sessionStartedAt, setActiveExerciseId]);

  function startExercise() {
    updateSetup({ prompt: exercisePrompt, categories: ['targeted-exercise'] });
    router.push('/practice/session');
  }

  return (
    <AppShell>
      <Screen>
        <Breadcrumbs items={[{ label: 'Practice', href: '/practice/setup' }, { label: 'Session summary' }]} />

        <div className="rounded-[30px] bg-[var(--navy)] px-9 py-8 text-white shadow-[var(--shadow-lg)]">
          <div className="flex items-start justify-between gap-8">
            <div>
              <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.13em] text-[var(--mint)]">
                <CheckCircle2 className="size-4" /> Session complete
              </div>
              <h1 className="mt-4 font-display text-[38px] font-semibold tracking-[-0.045em]">You made the recommendation easy to follow.</h1>
              <p className="mt-3 max-w-3xl text-[15px] leading-7 text-white/65">
                Across three answers, your strongest pattern was stating a position early. The clearest next step is replacing broad language with specific consequences.
              </p>
            </div>
            <div className="shrink-0 rounded-2xl border border-white/10 bg-white/5 px-5 py-4 text-right">
              <p className="text-[11px] uppercase tracking-[0.1em] text-white/45">Primary goal</p>
              <p className="mt-1 max-w-52 text-sm font-semibold">{goalTitle}</p>
            </div>
          </div>
        </div>

        <div className="mt-6 grid grid-cols-4 gap-4">
          <MetricCard label="Session pace" value="129 WPM" detail="418 words ÷ 3 min 14 sec" />
          <MetricCard label="Completed answers" value="3" detail="One skipped question excluded" />
          <MetricCard label="Fillers" value="7" detail="1.7 per 100 transcribed words" />
          <MetricCard label="Practice time" value="9 min" detail="Suggested duration, not a limit" />
        </div>

        <div className="mt-7 grid grid-cols-[minmax(0,1fr)_420px] gap-6">
          <section className="rounded-3xl border border-[var(--line)] bg-[var(--paper)] p-7 shadow-[var(--shadow-sm)]">
            <div className="flex items-center gap-2">
              <BookOpenCheck className="size-5 text-[var(--teal)]" />
              <h2 className="font-display text-xl font-semibold text-[var(--navy)]">Patterns across your answers</h2>
            </div>

            <div className="mt-6 space-y-4">
              <article className="rounded-2xl border border-[var(--mint)] bg-[var(--mint-soft)] p-5">
                <div className="flex items-start gap-4">
                  <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-white text-[var(--teal-dark)]"><CheckCircle2 className="size-4" /></span>
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.1em] text-[var(--teal-dark)]">Recurring strength</p>
                    <h3 className="mt-1.5 text-base font-semibold text-[var(--navy)]">Your position arrives before the explanation</h3>
                    <p className="mt-2 text-sm leading-6 text-[#516b6b]">In questions 1 and 3, you opened with a direct choice before adding reasons. This reduced listener effort and kept the answer purposeful.</p>
                    <button className="mt-3 flex items-center gap-1 text-xs font-semibold text-[var(--teal-dark)]">See evidence from questions 1 & 3 <ChevronRight className="size-3.5" /></button>
                  </div>
                </div>
              </article>

              <article className="rounded-2xl border border-[var(--line)] bg-white p-5">
                <div className="flex items-start gap-4">
                  <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-[var(--amber-soft)] text-[#93671c]"><Lightbulb className="size-4" /></span>
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.1em] text-[#87601d]">Primary opportunity</p>
                    <h3 className="mt-1.5 text-base font-semibold text-[var(--navy)]">Name the consequence instead of its size</h3>
                    <p className="mt-2 text-sm leading-6 text-[var(--muted-ink)]">Broad phrases such as “a big problem” and “a lot better” appeared in two answers. Replacing them with the actual cost, risk, or behavior would make the reasoning more credible.</p>
                    <button className="mt-3 flex items-center gap-1 text-xs font-semibold text-[var(--teal-dark)]">See quotes from questions 1 & 2 <ChevronRight className="size-3.5" /></button>
                  </div>
                </div>
              </article>

              <article className="rounded-2xl border border-[var(--line)] bg-white p-5">
                <div className="flex items-start gap-4">
                  <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-[#e9edf5] text-[#536b91]"><MessageSquareQuote className="size-4" /></span>
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.1em] text-[#536b91]">Reasoning pattern</p>
                    <h3 className="mt-1.5 text-base font-semibold text-[var(--navy)]">Acknowledge tradeoffs, then add a decision boundary</h3>
                    <p className="mt-2 text-sm leading-6 text-[var(--muted-ink)]">You consistently recognized the opposing view. Your next improvement is explaining what new evidence would change your recommendation.</p>
                    <button className="mt-3 flex items-center gap-1 text-xs font-semibold text-[var(--teal-dark)]">See evidence from question 1 <ChevronRight className="size-3.5" /></button>
                  </div>
                </div>
              </article>
            </div>
          </section>

          <aside className="self-start overflow-hidden rounded-3xl border border-[var(--line)] bg-[var(--paper)] shadow-[var(--shadow-sm)]">
            <div className="bg-[var(--mint-soft)] p-6">
              <div className="flex items-center justify-between">
                <span className="grid size-11 place-items-center rounded-2xl bg-white text-[var(--teal-dark)] shadow-sm"><Dumbbell className="size-5" /></span>
                <span className="rounded-full bg-white/80 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.09em] text-[var(--teal-dark)]">Recommended exercise</span>
              </div>
              <h2 className="mt-5 font-display text-2xl font-semibold tracking-[-0.03em] text-[var(--navy)]">Make the consequence concrete</h2>
              <p className="mt-2 text-sm leading-6 text-[#516b6b]">A short rephrasing drill to strengthen vocabulary precision.</p>
            </div>

            <div className="p-6">
              <p className="text-xs font-semibold uppercase tracking-[0.1em] text-[var(--muted-ink)]">Why this exercise</p>
              <blockquote className="mt-3 rounded-xl border-l-2 border-[var(--mint)] bg-[var(--canvas)] p-4 text-sm italic leading-6 text-[#52666d]">
                “moving fast without a stable foundation creates kind of a big problem later”
              </blockquote>
              <p className="mt-4 text-sm leading-6 text-[var(--muted-ink)]">The idea is strong; the consequence is still abstract. Practise naming the specific effect without changing your meaning.</p>

              <div className="mt-5 rounded-xl border border-[var(--line)] p-4">
                <p className="flex items-center gap-2 text-xs font-semibold text-[var(--navy)]"><Target className="size-4 text-[var(--teal)]" />Exercise prompt</p>
                <p className="mt-2 text-sm leading-6 text-[#53666e]">{exercisePrompt}</p>
              </div>

              <Button disabled={usesPersistentBackend && saveState !== 'saved'} onClick={startExercise} className="mt-5 h-11 w-full rounded-xl bg-[var(--navy)] hover:bg-[#1d4255]">
                Start exercise <ArrowRight className="ml-1 size-4" />
              </Button>
              <button onClick={() => router.push('/history')} className="mt-3 w-full py-2 text-sm font-medium text-[var(--muted-ink)] hover:text-[var(--ink)]">Finish session</button>
            </div>
          </aside>
        </div>

        <div className="mt-7 flex items-center justify-between rounded-2xl border border-[var(--line)] bg-[var(--paper)] px-5 py-4">
          <div className="flex items-center gap-3">
            <span className="grid size-9 place-items-center rounded-xl bg-[var(--warm)] text-[var(--navy)]"><Sparkles className="size-4" /></span>
            <div><p className="text-sm font-semibold text-[var(--navy)]">{saveState === 'saving' ? 'Saving your session…' : saveState === 'error' ? 'This session still needs to be saved' : 'Your session has been added to History'}</p><p className="mt-0.5 text-xs text-[var(--muted-ink)]">{saveState === 'error' ? 'Return to the summary to try again after checking your connection.' : usesPersistentBackend ? 'Transcript, metrics, and feedback are saved to your account. The recording is not.' : 'Demo data is stored only in this browser. The recording is not saved.'}</p></div>
          </div>
          <Button variant="outline" onClick={() => router.push('/history')} className="rounded-xl bg-white">View history</Button>
        </div>
      </Screen>
    </AppShell>
  );
}

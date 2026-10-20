'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, BookOpenCheck, Dumbbell, MessageSquareQuote, Target, VideoOff } from 'lucide-react';
import { AppShell, Breadcrumbs, MetricCard, Screen } from '@/components/app-shell';
import { Button } from '@/components/ui/button';
import { getSessionDetail } from '@/lib/client-data';
import type { SessionDetail } from '@/lib/types';

export function HistoryDetailView() {
  const params = useParams<{ sessionId: string }>();
  const router = useRouter();
  const [session, setSession] = useState<SessionDetail | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void getSessionDetail(params.sessionId).then(setSession).finally(() => setLoading(false));
  }, [params.sessionId]);

  if (loading) {
    return <AppShell><Screen><div className="grid min-h-[70vh] place-items-center text-sm text-[var(--muted-ink)]">Loading saved session…</div></Screen></AppShell>;
  }

  if (!session) {
    return <AppShell><Screen><div className="grid min-h-[70vh] place-items-center text-center"><div><h1 className="font-display text-2xl font-semibold text-[var(--navy)]">Session not found</h1><Button onClick={() => router.push('/history')} className="mt-5">Back to History</Button></div></div></Screen></AppShell>;
  }

  return (
    <AppShell>
      <Screen>
        <Breadcrumbs items={[{ label: 'History', href: '/history' }, { label: session.date.split(' · ')[0] }]} />
        <div className="flex items-start justify-between gap-8">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--teal-dark)]">Saved session</p>
            <h1 className="mt-2 font-display text-[36px] font-semibold tracking-[-0.04em] text-[var(--navy)]">{session.title}</h1>
            <p className="mt-2 text-sm text-[var(--muted-ink)]">{session.date} · {session.duration} · {session.goal}</p>
          </div>
          <Button variant="outline" onClick={() => router.push('/history')} className="rounded-xl bg-white"><ArrowLeft className="size-4" />Back to History</Button>
        </div>

        <div className="mt-7 grid grid-cols-4 gap-4">
          <MetricCard label="Average pace" value={`${session.averageWpm} WPM`} detail="Combined words ÷ combined duration" />
          <MetricCard label="Answers" value={String(session.answers)} detail="Completed responses only" />
          <MetricCard label="Fillers" value={String(session.fillerCount)} detail="From the saved transcripts" />
          <MetricCard label="Recording" value="Not saved" detail="History is text-only by design" />
        </div>

        <div className="mt-7 grid grid-cols-[minmax(0,1fr)_370px] gap-6">
          <div className="space-y-5">
            <section className="rounded-3xl border border-[var(--line)] bg-[var(--paper)] p-7 shadow-[var(--shadow-sm)]">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2"><MessageSquareQuote className="size-5 text-[var(--teal)]" /><h2 className="font-display text-xl font-semibold text-[var(--navy)]">Question 1 and transcript</h2></div>
                <span className="rounded-full bg-[var(--warm)] px-3 py-1 text-xs text-[var(--muted-ink)]">132 WPM · 168 words</span>
              </div>
              <p className="mt-5 rounded-2xl bg-[var(--canvas)] p-4 text-sm font-medium leading-6 text-[var(--navy)]">{session.prompt}</p>
              <p className="mt-5 text-sm leading-7 text-[#52666e]">{session.transcript}</p>
              <div className="mt-6 border-t border-[var(--line)] pt-5">
                <p className="text-xs font-semibold uppercase tracking-[0.09em] text-[var(--teal-dark)]">Saved coaching</p>
                <h3 className="mt-2 text-sm font-semibold text-[var(--navy)]">{session.feedbackTitle}</h3>
                <p className="mt-1 text-sm leading-6 text-[var(--muted-ink)]">{session.feedbackExplanation}</p>
              </div>
            </section>

            <section className="rounded-3xl border border-[var(--line)] bg-[var(--paper)] p-7 shadow-[var(--shadow-sm)]">
              <div className="flex items-center gap-2"><BookOpenCheck className="size-5 text-[var(--teal)]" /><h2 className="font-display text-xl font-semibold text-[var(--navy)]">Session summary</h2></div>
              <div className="mt-5 grid grid-cols-2 gap-4">
                <div className="rounded-2xl bg-[var(--mint-soft)] p-5"><p className="text-xs font-semibold text-[var(--teal-dark)]">Summary</p><p className="mt-2 text-sm font-semibold leading-6 text-[var(--navy)]">{session.summary}</p><p className="mt-2 text-xs leading-5 text-[#55706f]">Saved with this session.</p></div>
                <div className="rounded-2xl bg-[var(--amber-soft)] p-5"><p className="text-xs font-semibold text-[#815e1b]">Opportunity</p><p className="mt-2 text-sm font-semibold text-[var(--navy)]">Make consequences concrete</p><p className="mt-2 text-xs leading-5 text-[#735e36]">Supported by questions 1 and 2.</p></div>
              </div>
            </section>
          </div>

          <aside className="space-y-5">
            <div className="rounded-2xl border border-[var(--line)] bg-[var(--paper)] p-5 shadow-[var(--shadow-sm)]">
              <div className="flex items-center gap-2 text-sm font-semibold text-[var(--navy)]"><VideoOff className="size-4 text-[var(--muted-ink)]" />No historical playback</div>
              <p className="mt-2 text-xs leading-5 text-[var(--muted-ink)]">Only the transcript, metrics, and coaching were saved. Video and audio were released after immediate feedback.</p>
            </div>

            {session.hasExercise && (
              <div className="rounded-3xl border border-[var(--mint)] bg-[var(--mint-soft)] p-6">
                <span className="grid size-10 place-items-center rounded-xl bg-white text-[var(--teal-dark)]"><Dumbbell className="size-5" /></span>
                <p className="mt-5 text-xs font-semibold uppercase tracking-[0.1em] text-[var(--teal-dark)]">Completed exercise</p>
                <h2 className="mt-2 font-display text-xl font-semibold text-[var(--navy)]">{session.exerciseTitle ?? 'Make the consequence concrete'}</h2>
                {session.exerciseTargetSkill && <p className="mt-2 text-xs font-semibold text-[var(--teal-dark)]">Skill · {session.exerciseTargetSkill}</p>}
                <p className="mt-3 text-xs leading-5 text-[#55706f]">{session.exerciseReason ?? 'This exercise was selected from the feedback saved in this session.'}</p>
                {session.exerciseEvidence && <blockquote className="mt-4 border-l-2 border-[var(--teal)] pl-3 text-xs italic leading-5 text-[#55706f]">“{session.exerciseEvidence}”</blockquote>}
                <div className="mt-4 rounded-xl bg-white/75 p-4"><p className="flex items-center gap-2 text-xs font-semibold text-[var(--navy)]"><Target className="size-4 text-[var(--teal)]" />Targeted feedback</p><p className="mt-2 text-xs leading-5 text-[#55706f]">The completed exercise and its focused coaching are saved with the originating session.</p></div>
              </div>
            )}
          </aside>
        </div>
      </Screen>
    </AppShell>
  );
}

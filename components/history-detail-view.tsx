'use client';

import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, BookOpenCheck, Dumbbell, MessageSquareQuote, Target, VideoOff } from 'lucide-react';
import { AppShell, Breadcrumbs, MetricCard, Screen } from '@/components/app-shell';
import { Button } from '@/components/ui/button';
import { sessions } from '@/lib/mock-data';

export function HistoryDetailView() {
  const params = useParams<{ sessionId: string }>();
  const router = useRouter();
  const session = sessions.find((item) => item.id === params.sessionId) ?? sessions[0];

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
              <p className="mt-5 rounded-2xl bg-[var(--canvas)] p-4 text-sm font-medium leading-6 text-[var(--navy)]">Your team can invest in speed or reliability this quarter, but not both. Which would you choose, and how would you explain the tradeoff?</p>
              <p className="mt-5 text-sm leading-7 text-[#52666e]">I would choose reliability first. We have already learned that moving fast without a stable foundation creates <mark className="rounded bg-[var(--amber-soft)] px-1 text-inherit">kind of a big problem</mark> later. Speed matters for learning, but reliability protects customer trust and gives the team more confidence.</p>
              <div className="mt-6 border-t border-[var(--line)] pt-5">
                <p className="text-xs font-semibold uppercase tracking-[0.09em] text-[var(--teal-dark)]">Saved coaching</p>
                <h3 className="mt-2 text-sm font-semibold text-[var(--navy)]">Replace vague scale with a precise consequence</h3>
                <p className="mt-1 text-sm leading-6 text-[var(--muted-ink)]">Name what the reliability risk would actually do to the customer or team.</p>
              </div>
            </section>

            <section className="rounded-3xl border border-[var(--line)] bg-[var(--paper)] p-7 shadow-[var(--shadow-sm)]">
              <div className="flex items-center gap-2"><BookOpenCheck className="size-5 text-[var(--teal)]" /><h2 className="font-display text-xl font-semibold text-[var(--navy)]">Session summary</h2></div>
              <div className="mt-5 grid grid-cols-2 gap-4">
                <div className="rounded-2xl bg-[var(--mint-soft)] p-5"><p className="text-xs font-semibold text-[var(--teal-dark)]">Strength</p><p className="mt-2 text-sm font-semibold text-[var(--navy)]">Your recommendation arrives early</p><p className="mt-2 text-xs leading-5 text-[#55706f]">Supported by questions 1 and 3.</p></div>
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
                <h2 className="mt-2 font-display text-xl font-semibold text-[var(--navy)]">Make the consequence concrete</h2>
                <div className="mt-4 rounded-xl bg-white/75 p-4"><p className="flex items-center gap-2 text-xs font-semibold text-[var(--navy)]"><Target className="size-4 text-[var(--teal)]" />Targeted feedback</p><p className="mt-2 text-xs leading-5 text-[#55706f]">Your revision named “customer trust” directly and removed the vague qualifier without changing the original meaning.</p></div>
              </div>
            )}
          </aside>
        </div>
      </Screen>
    </AppShell>
  );
}

'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, ChevronDown, MessageSquareQuote, Sparkles } from 'lucide-react';
import { AppShell, Breadcrumbs, Screen } from '@/components/app-shell';
import { Button } from '@/components/ui/button';
import { FeedbackCoachingContent } from '@/components/feedback-coaching-content';
import { getSessionDetail } from '@/lib/client-data';
import type { SessionDetail } from '@/lib/types';

function SavedSessionContent({ session }: { session: SessionDetail }) {
  const responses = session.responses?.length
    ? session.responses
    : [{ id: 'legacy', prompt: session.prompt, transcript: session.transcript, metrics: null, feedback: [] }];

  return (
    <div className="space-y-6">
      {responses.map((response, index) => {
        const feedback = response.feedback.length
          ? response.feedback
          : [{ id: 'legacy-feedback', title: session.feedbackTitle, explanation: session.feedbackExplanation, dimension: 'Communication effectiveness' as const, evidence: '', positive: false }];
        return (
          <section key={response.id} className="rounded-3xl border border-[var(--line)] bg-[var(--paper)] p-7 shadow-[var(--shadow-sm)]">
            <div className="flex items-center gap-2"><MessageSquareQuote className="size-5 text-[var(--teal)]" /><p className="text-xs font-semibold uppercase tracking-[0.09em] text-[var(--teal-dark)]">Question {index + 1}</p></div>
            <h2 className="mt-3 max-w-4xl font-display text-xl font-semibold leading-7 text-[var(--navy)]">{response.prompt}</h2>

            {response.metrics && (
              <dl className="mt-6 grid grid-cols-3 border-y border-[var(--line)] py-4">
                <div>
                  <dt className="text-xs text-[var(--muted-ink)]">Time to main point</dt>
                  <dd className="mt-1 text-base font-semibold text-[var(--navy)]">
                    {response.metrics.timeToMainPointSeconds !== null ? `${response.metrics.timeToMainPointSeconds} sec` : 'Not reached'}
                  </dd>
                </div>
                <div className="border-l border-[var(--line)] px-5">
                  <dt className="text-xs text-[var(--muted-ink)]">Speaking pace</dt>
                  <dd className="mt-1 text-base font-semibold text-[var(--navy)]">{response.metrics.averageWpm} WPM</dd>
                </div>
                <div className="border-l border-[var(--line)] pl-5">
                  <dt className="text-xs text-[var(--muted-ink)]">Fillers</dt>
                  <dd className="mt-1 text-base font-semibold text-[var(--navy)]">{response.metrics.fillerCount}</dd>
                </div>
              </dl>
            )}

            <div className="mt-6 rounded-2xl bg-[var(--canvas)] p-5">
              <div className="flex items-center gap-2"><Sparkles className="size-4 text-[var(--teal)]" /><h3 className="font-display text-xl font-semibold text-[var(--navy)]">Saved coaching</h3></div>
              <p className="mt-1 text-xs text-[var(--muted-ink)]">The most useful feedback saved from this answer</p>
              <div className="mt-4 grid grid-cols-2 gap-4">
                {feedback.map((item) => (
                  <article key={item.id} className="rounded-2xl border border-[var(--line)] bg-white p-5">
                    <FeedbackCoachingContent item={item} />
                  </article>
                ))}
              </div>
            </div>

            <details className="group mt-5 rounded-2xl border border-[var(--line)] bg-white px-5 py-4">
              <summary className="flex cursor-pointer list-none items-center justify-between text-sm font-semibold text-[var(--navy)]">
                View transcript
                <ChevronDown className="size-4 text-[var(--muted-ink)] transition-transform group-open:rotate-180" />
              </summary>
              <p className="mt-4 border-t border-[var(--line)] pt-4 text-sm leading-7 text-[#6d5b7f]">{response.transcript}</p>
            </details>
          </section>
        );
      })}
    </div>
  );
}

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
    return <AppShell><Screen><div className="grid min-h-[70vh] place-items-center text-center"><div><h1 className="font-display text-2xl font-semibold text-[var(--navy)]">Session not found</h1><Button onClick={() => router.push('/history')} className="mt-5">Go back</Button></div></div></Screen></AppShell>;
  }

  return (
    <AppShell>
      <Screen>
        <Breadcrumbs items={[{ label: 'History', href: '/history' }, { label: session.date.split(' · ')[0] }]} />

        <div className="relative">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--teal-dark)]">Saved session</p>
            <h1 className="mt-2 font-display text-[36px] font-semibold tracking-[-0.04em] text-[var(--navy)]">{session.title}</h1>
            <p className="mt-2 text-sm text-[var(--muted-ink)]">{session.date} · {session.goal}</p>
          </div>
          <Button variant="outline" onClick={() => router.push('/history')} className="absolute right-0 top-0 rounded-xl bg-white"><ArrowLeft className="size-4" />Back to History</Button>
        </div>

        <div className="mx-auto mt-8 max-w-5xl">
          <SavedSessionContent session={session} />
        </div>
      </Screen>
    </AppShell>
  );
}

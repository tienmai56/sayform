'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  ArrowRight,
  Check,
  Expand,
  Lightbulb,
  Maximize2,
  Minimize2,
  Play,
  RotateCcw,
  Sparkles,
  ThumbsDown,
  ThumbsUp,
  VideoOff,
} from 'lucide-react';
import { AppShell, Breadcrumbs, MetricCard, Screen } from '@/components/app-shell';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { feedbackItems, practiceQuestions, transcript } from '@/lib/mock-data';
import type { FeedbackDimension } from '@/lib/types';
import { cn } from '@/lib/utils';
import { usePractice } from '@/components/practice-context';
import { rateFeedback } from '@/lib/client-data';

const dimensions: FeedbackDimension[] = [
  'Vocabulary',
  'Sentence structure',
  'Communication effectiveness',
  'Critical thinking',
  'What worked',
];

export function FeedbackWorkspace() {
  const router = useRouter();
  const { recordingUrl, goalTitle, prompt, feedbackIds, updateSetup, clearRecording } = usePractice();
  const [fullScreen, setFullScreen] = useState(false);
  const [selectedId, setSelectedId] = useState('vague-language');
  const [ratings, setRatings] = useState<Record<string, 'helpful' | 'unhelpful'>>({});
  const [pendingDismiss, setPendingDismiss] = useState<string | null>(null);
  const [dismissed, setDismissed] = useState<string[]>([]);
  const [note, setNote] = useState('');

  const activeFeedback = useMemo(
    () => feedbackItems.filter((item) => !dismissed.includes(item.id)),
    [dismissed],
  );

  function rateHelpful(id: string) {
    setRatings((current) => ({ ...current, [id]: 'helpful' }));
    setPendingDismiss(null);
    void rateFeedback(feedbackIds[id], { rating: 'helpful' });
  }

  function openUnhelpful(id: string) {
    setRatings((current) => ({ ...current, [id]: 'unhelpful' }));
    setPendingDismiss(id);
    setNote('');
  }

  function dismissSuggestion(id: string) {
    setDismissed((current) => [...current, id]);
    setPendingDismiss(null);
    const next = activeFeedback.find((item) => item.id !== id);
    if (next) setSelectedId(next.id);
    void rateFeedback(feedbackIds[id], { rating: 'unhelpful', note, dismissed: true });
  }

  function nextQuestion() {
    clearRecording();
    const index = practiceQuestions.indexOf(prompt);
    updateSetup({ prompt: practiceQuestions[(index + 1) % practiceQuestions.length] });
    router.push('/practice/session');
  }

  function endSession() {
    clearRecording();
    router.push('/session/summary');
  }

  const report = (
    <section
      className={cn(
        'min-h-0 overflow-hidden rounded-3xl border border-[var(--line)] bg-[var(--paper)] shadow-[var(--shadow-sm)]',
        fullScreen && 'fixed inset-5 z-50 rounded-[28px] shadow-[var(--shadow-lg)]',
      )}
    >
      <div className="flex h-full min-h-0 flex-col">
        <header className="flex items-center justify-between border-b border-[var(--line)] px-6 py-4">
          <div>
            <div className="flex items-center gap-2">
              <Sparkles className="size-4 text-[var(--teal)]" />
              <h2 className="font-display text-lg font-semibold tracking-[-0.02em] text-[var(--navy)]">Personalized feedback</h2>
            </div>
            <p className="mt-1 text-xs text-[var(--muted-ink)]">Based only on the words in this response</p>
          </div>
          <Button
            variant="outline"
            onClick={() => setFullScreen((current) => !current)}
            className="rounded-xl bg-white"
          >
            {fullScreen ? <Minimize2 className="size-4" /> : <Maximize2 className="size-4" />}
            {fullScreen ? 'Return to split screen' : 'View full screen'}
          </Button>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto p-6">
          <div className="grid grid-cols-4 gap-3">
            <MetricCard label="Average pace" value="132 WPM" detail="Within 100–165 presentation reference" />
            <MetricCard label="Fillers" value="3" detail="1.8 per 100 transcribed words" />
            <MetricCard label="Total words" value="168" detail="Across 1 min 16 sec" />
            <MetricCard label="Distinct words" value="103" detail="Consistent normalization" />
          </div>

          <div className="mt-7 grid grid-cols-[minmax(0,1.05fr)_minmax(340px,0.95fr)] gap-6">
            <div>
              <div className="mb-3 flex items-center justify-between">
                <h3 className="text-sm font-semibold text-[var(--navy)]">Transcript</h3>
                <span className="text-[11px] text-[var(--muted-ink)]">Select a highlight to see the coaching</span>
              </div>
              <div className="rounded-2xl border border-[var(--line)] bg-white p-5 text-[15px] leading-8 text-[#344b55]">
                {transcript.before}
                <button
                  onClick={() => setSelectedId('vague-language')}
                  className={cn('rounded px-1 py-0.5 font-medium underline decoration-2 underline-offset-4', selectedId === 'vague-language' ? 'bg-[var(--amber-soft)] text-[#6f5018] decoration-[#c58d2e]' : 'bg-[#fbf4e4] decoration-[#d6a554]')}
                >
                  {transcript.vague}
                </button>
                {transcript.middle.split('I think').map((part, index, array) => (
                  <span key={`${index}-${part.slice(0, 8)}`}>
                    {part}
                    {index < array.length - 1 && (
                      <button
                        onClick={() => setSelectedId('repeated-opening')}
                        className={cn('rounded px-1 py-0.5 font-medium underline decoration-2 underline-offset-4', selectedId === 'repeated-opening' ? 'bg-[#e7edf7] text-[#3e577f] decoration-[#748db2]' : 'bg-[#f0f3f8] decoration-[#9aa9c1]')}
                      >
                        I think
                      </button>
                    )}
                  </span>
                ))}
                <button
                  onClick={() => setSelectedId('repeated-opening')}
                  className={cn('rounded px-1 py-0.5 font-medium underline decoration-2 underline-offset-4', selectedId === 'repeated-opening' ? 'bg-[#e7edf7] text-[#3e577f] decoration-[#748db2]' : 'bg-[#f0f3f8] decoration-[#9aa9c1]')}
                >
                  {transcript.repeated}
                </button>
                {transcript.after}
              </div>
              <p className="mt-3 flex items-start gap-2 text-xs leading-5 text-[var(--muted-ink)]">
                <Expand className="mt-0.5 size-3.5 shrink-0" /> Transcript highlights explain language choices. They do not control video playback.
              </p>

              <div className="mt-7">
                <h3 className="text-sm font-semibold text-[var(--navy)]">Complete coaching</h3>
                <div className="mt-3 flex flex-wrap gap-2">
                  {dimensions.map((dimension) => {
                    const item = activeFeedback.find((feedback) => feedback.dimension === dimension);
                    return (
                      <button
                        key={dimension}
                        onClick={() => item && setSelectedId(item.id)}
                        className={cn(
                          'rounded-full border px-3 py-1.5 text-xs font-medium',
                          item?.id === selectedId
                            ? 'border-[var(--teal)] bg-[var(--mint-soft)] text-[var(--teal-dark)]'
                            : 'border-[var(--line)] bg-white text-[var(--muted-ink)] hover:text-[var(--ink)]',
                        )}
                      >
                        {dimension}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="space-y-3">
              {activeFeedback.map((item) => (
                <article
                  key={item.id}
                  className={cn(
                    'rounded-2xl border bg-white p-5 transition-all',
                    selectedId === item.id ? 'border-[var(--teal)] shadow-[0_0_0_3px_rgb(22_127_118/8%)]' : 'border-[var(--line)]',
                  )}
                >
                  <button onClick={() => setSelectedId(item.id)} className="w-full text-left">
                    <div className="flex items-center justify-between gap-3">
                      <span className={cn('rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.08em]', item.positive ? 'bg-[var(--mint-soft)] text-[var(--teal-dark)]' : 'bg-[var(--warm)] text-[var(--muted-ink)]')}>
                        {item.dimension}
                      </span>
                      {item.positive && <span className="flex items-center gap-1 text-[11px] font-medium text-[var(--teal-dark)]"><Check className="size-3" />What worked</span>}
                    </div>
                    <h4 className="mt-3 text-sm font-semibold leading-5 text-[var(--navy)]">{item.title}</h4>
                    <blockquote className="mt-3 border-l-2 border-[var(--mint)] pl-3 text-xs italic leading-5 text-[var(--muted-ink)]">“{item.evidence}”</blockquote>
                    <p className="mt-3 text-sm leading-6 text-[#53666e]">{item.explanation}</p>
                  </button>

                  {item.alternatives && selectedId === item.id && (
                    <div className="mt-4 rounded-xl bg-[var(--canvas)] p-4">
                      <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--teal-dark)]"><Lightbulb className="size-3.5" />Try instead</p>
                      <ul className="mt-2 space-y-2">
                        {item.alternatives.map((alternative) => <li key={alternative} className="text-xs leading-5 text-[#4d626a]">“{alternative}”</li>)}
                      </ul>
                    </div>
                  )}

                  {pendingDismiss === item.id ? (
                    <div className="mt-4 border-t border-[var(--line)] pt-4">
                      <label htmlFor={`note-${item.id}`} className="text-xs font-medium text-[var(--ink)]">What missed the mark? <span className="font-normal text-[var(--muted-ink)]">Optional</span></label>
                      <Textarea id={`note-${item.id}`} value={note} onChange={(event) => setNote(event.target.value)} placeholder="Add a short note for future coaching" className="mt-2 min-h-20 bg-[var(--canvas)] text-xs" />
                      <div className="mt-3 flex justify-end gap-2">
                        <Button size="sm" variant="ghost" onClick={() => setPendingDismiss(null)}>Cancel</Button>
                        <Button size="sm" variant="destructive" onClick={() => dismissSuggestion(item.id)}>Dismiss suggestion</Button>
                      </div>
                    </div>
                  ) : (
                    <div className="mt-4 flex items-center gap-2 border-t border-[var(--line)] pt-3">
                      <span className="mr-auto text-[11px] text-[var(--muted-ink)]">Was this useful?</span>
                      <button onClick={() => rateHelpful(item.id)} className={cn('flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-[11px] font-medium', ratings[item.id] === 'helpful' ? 'bg-[var(--mint-soft)] text-[var(--teal-dark)]' : 'text-[var(--muted-ink)] hover:bg-[var(--warm)]')}><ThumbsUp className="size-3.5" />Helpful</button>
                      <button onClick={() => openUnhelpful(item.id)} className="flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-[11px] font-medium text-[var(--muted-ink)] hover:bg-[var(--rose-soft)] hover:text-[#914435]"><ThumbsDown className="size-3.5" />Unhelpful</button>
                    </div>
                  )}
                </article>
              ))}

              {dismissed.length > 0 && (
                <button onClick={() => setDismissed([])} className="flex w-full items-center justify-center gap-1.5 py-2 text-xs font-medium text-[var(--muted-ink)] hover:text-[var(--ink)]">
                  <RotateCcw className="size-3.5" /> Restore dismissed suggestions
                </button>
              )}
            </div>
          </div>
        </div>

        <footer className="flex items-center justify-between border-t border-[var(--line)] bg-[var(--canvas)] px-6 py-4">
          <button onClick={endSession} className="text-sm font-medium text-[var(--muted-ink)] hover:text-[var(--ink)]">End session</button>
          <Button onClick={nextQuestion} className="h-10 rounded-xl bg-[var(--navy)] px-4 hover:bg-[#1d4255]">
            Next question <ArrowRight className="ml-1 size-4" />
          </Button>
        </footer>
      </div>
    </section>
  );

  return (
    <AppShell>
      {fullScreen && <div className="fixed inset-0 z-40 bg-[#0e222d]/55 backdrop-blur-sm" />}
      <Screen wide>
        <Breadcrumbs items={[{ label: 'Practice', href: '/practice/setup' }, { label: 'Answer feedback' }]} />
        <div className="mb-6 flex items-start justify-between gap-6">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--teal-dark)]">Answer complete</p>
            <h1 className="mt-2 max-w-4xl font-display text-2xl font-semibold leading-8 tracking-[-0.03em] text-[var(--navy)]">{prompt}</h1>
          </div>
          <span className="shrink-0 rounded-full bg-[var(--mint-soft)] px-3 py-1.5 text-xs font-medium text-[var(--teal-dark)]">Goal · {goalTitle}</span>
        </div>

        <div className="grid h-[calc(100vh-190px)] min-h-[720px] grid-cols-[minmax(420px,0.72fr)_minmax(620px,1.28fr)] gap-5">
          <section className="flex min-h-0 flex-col overflow-hidden rounded-3xl border border-[#243e49] bg-[#102630] shadow-[var(--shadow-sm)]">
            <div className="flex items-center justify-between border-b border-white/10 px-5 py-4 text-white">
              <div className="flex items-center gap-2"><Play className="size-4 text-[var(--mint)]" /><span className="text-sm font-semibold">Your recording</span></div>
              <span className="text-xs text-white/45">Paused · play when ready</span>
            </div>
            <div className="flex min-h-0 flex-1 items-center justify-center bg-[#09191f] p-5">
              {recordingUrl ? (
                <>
                  {/* oxlint-disable-next-line jsx-a11y/media-has-caption -- user-recorded prototype media has no caption asset */}
                  <video src={recordingUrl} controls playsInline className="max-h-full w-full rounded-2xl bg-black" />
                </>
              ) : (
                <div className="max-w-xs text-center text-white">
                  <div className="mx-auto grid size-16 place-items-center rounded-3xl bg-white/8 text-[var(--mint)]"><VideoOff className="size-7" /></div>
                  <p className="mt-5 font-display text-xl font-semibold">Recording preview unavailable</p>
                  <p className="mt-2 text-sm leading-6 text-white/50">This demo answer did not capture video. Feedback remains available for the prototype transcript.</p>
                </div>
              )}
            </div>
            <div className="border-t border-white/10 px-5 py-4 text-xs leading-5 text-white/45">
              This recording remains only in the current feedback view. It is released when you continue.
            </div>
          </section>

          {report}
        </div>
      </Screen>
    </AppShell>
  );
}

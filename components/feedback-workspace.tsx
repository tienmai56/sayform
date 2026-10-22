'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  ArrowRight,
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
import { getPracticeQuestions } from '@/lib/goal-catalog';
import { cn } from '@/lib/utils';
import { usePractice } from '@/components/practice-context';
import { rateFeedback } from '@/lib/client-data';
import { ExerciseAttemptFeedback } from '@/components/exercise-attempt-feedback';
import { FeedbackCoachingContent } from '@/components/feedback-coaching-content';

function formatDuration(totalSeconds: number) {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return minutes ? `${minutes} min ${seconds} sec` : `${seconds} sec`;
}

export function FeedbackWorkspace() {
  const { activeExercise, currentExerciseResult } = usePractice();
  if (activeExercise && currentExerciseResult) return <ExerciseAttemptFeedback />;
  return <StandardFeedbackWorkspace />;
}

function StandardFeedbackWorkspace() {
  const router = useRouter();
  const {
    activeExercise,
    clearRecording,
    currentAnalysis,
    feedbackIds,
    goalSkills,
    goalTemplateKey,
    goalTitle,
    prompt,
    recordingUrl,
    resetSession,
    updateSetup,
  } = usePractice();
  const [fullScreen, setFullScreen] = useState(false);
  const [selectedId, setSelectedId] = useState('');
  const [ratings, setRatings] = useState<Record<string, 'helpful' | 'unhelpful'>>({});
  const [pendingDismiss, setPendingDismiss] = useState<string | null>(null);
  const [dismissed, setDismissed] = useState<string[]>([]);
  const [note, setNote] = useState('');
  const feedback = useMemo(() => currentAnalysis?.feedback ?? [], [currentAnalysis]);

  const activeFeedback = useMemo(
    () => feedback.filter((item) => !dismissed.includes(item.id)),
    [dismissed, feedback],
  );
  const effectiveSelectedId = activeFeedback.some((item) => item.id === selectedId)
    ? selectedId
    : activeFeedback[0]?.id ?? '';
  const resolvedCount = activeFeedback.filter((item) => item.progressStatus === 'resolved').length;
  const continuingCount = activeFeedback.filter((item) => item.progressStatus === 'still_happening').length;
  const newIssueCount = activeFeedback.filter((item) => item.progressStatus === 'new' && !item.positive).length;
  const hasComparison = resolvedCount + continuingCount + newIssueCount > 0;

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
    const questions = getPracticeQuestions(goalTemplateKey);
    const index = questions.indexOf(prompt);
    updateSetup({ answerNotes: '', customTopic: '', redoFeedback: [], prompt: questions[(index + 1) % questions.length] });
    router.push('/practice/session');
  }

  function redoQuestion() {
    clearRecording();
    updateSetup({ redoFeedback: currentAnalysis?.feedback ?? [] });
    router.push('/practice/session');
  }

  function endSession() {
    clearRecording();
    router.push('/session/summary');
  }

  function finishExercise() {
    clearRecording();
    resetSession();
    router.push('/history');
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
              <h2 className="font-display text-lg font-semibold tracking-[-0.02em] text-[var(--navy)]">{activeExercise ? 'Targeted exercise feedback' : 'Personalized feedback'}</h2>
            </div>
            <p className="mt-1 text-xs text-[var(--muted-ink)]">{activeExercise ? `Focused on ${activeExercise.targetSkill}` : goalSkills.length ? `Evaluated across all ${goalSkills.length} goal skills, based only on this response` : 'Evaluated across all coaching dimensions, based only on this response'}</p>
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
          {activeExercise && (
            <div className="mb-5 grid grid-cols-[minmax(0,1fr)_minmax(300px,0.7fr)] gap-4 rounded-2xl border border-[var(--mint)] bg-[var(--mint-soft)] p-5">
              <div><p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-[var(--teal-dark)]">Skill practised</p><h3 className="mt-1.5 text-base font-semibold text-[var(--navy)]">{activeExercise.targetSkill}</h3><p className="mt-2 text-sm leading-6 text-[#516b6b]">Your response made the target behavior more explicit. Keep the same meaning while making the evidence concrete.</p></div>
              <div className="rounded-xl bg-white/75 p-4"><p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-[var(--muted-ink)]">Compared with the session evidence</p><p className="mt-2 text-xs italic leading-5 text-[#52666d]">“{activeExercise.sourceEvidence}”</p></div>
            </div>
          )}
          {!activeExercise && goalTemplateKey === 'storytelling' && (
            <div className="mb-5 rounded-2xl border border-[#bdd8cf] bg-[var(--mint-soft)] p-5">
              <div className="flex items-start gap-3">
                <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-white text-[var(--teal-dark)]"><Sparkles className="size-4" /></span>
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-[var(--teal-dark)]">Story structure review</p>
                  <h3 className="mt-1 font-display text-lg font-semibold text-[var(--navy)]">Matthew Dicks’ Storyworthy framework</h3>
                  <p className="mt-1.5 text-sm leading-6 text-[#516b6b]">This feedback evaluates only what appears in your transcript: the five-second moment, an opening close to the action, meaningful stakes, and a clear beginning-to-ending contrast.</p>
                </div>
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                {['Five-second moment', 'Start close to the action', 'Meaningful stakes', 'Beginning-to-ending contrast'].map((criterion) => (
                  <span key={criterion} className="rounded-full border border-[#a9cfc3] bg-white/75 px-3 py-1 text-[11px] font-semibold text-[var(--teal-dark)]">{criterion}</span>
                ))}
              </div>
            </div>
          )}
          <div className="grid grid-cols-4 gap-3">
            <MetricCard label="Average pace" value={currentAnalysis ? `${currentAnalysis.metrics.averageWpm} WPM` : '—'} detail="Calculated from this recording" />
            <MetricCard
              label="Fillers"
              value={currentAnalysis ? String(currentAnalysis.metrics.fillerCount) : '—'}
              detail={currentAnalysis && currentAnalysis.metrics.wordCount
                ? `${((currentAnalysis.metrics.fillerCount / currentAnalysis.metrics.wordCount) * 100).toFixed(1)} per 100 transcribed words`
                : 'From the transcript'}
            />
            <MetricCard label="Total words" value={currentAnalysis ? String(currentAnalysis.metrics.wordCount) : '—'} detail={currentAnalysis ? `Across ${formatDuration(currentAnalysis.durationSeconds)}` : 'From the transcript'} />
            <MetricCard label="Distinct words" value={currentAnalysis ? String(currentAnalysis.metrics.uniqueWordCount) : '—'} detail="Case-normalized word count" />
          </div>

          <div className="mt-7 grid grid-cols-[minmax(0,1.05fr)_minmax(340px,0.95fr)] gap-6">
            <div>
              <h3 className="mb-3 text-sm font-semibold text-[var(--navy)]">Transcript</h3>
              <div className="rounded-2xl border border-[var(--line)] bg-white p-5 text-[15px] leading-8 text-[#344b55]">
                {currentAnalysis?.transcript ?? 'Your transcript is unavailable.'}
              </div>
            </div>

            <div className="space-y-3">
              {hasComparison && (
                <div className="rounded-2xl border border-[var(--line)] bg-[var(--canvas)] p-4">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.09em] text-[var(--muted-ink)]">Compared with your last answer</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {resolvedCount > 0 && <span className="rounded-full bg-[#dff2e9] px-2.5 py-1 text-[11px] font-semibold text-[#286b55]">{resolvedCount} resolved</span>}
                    {continuingCount > 0 && <span className="rounded-full bg-[#fff0c7] px-2.5 py-1 text-[11px] font-semibold text-[#805b17]">{continuingCount} still happening</span>}
                    {newIssueCount > 0 && <span className="rounded-full bg-[#e7eef6] px-2.5 py-1 text-[11px] font-semibold text-[#3e6078]">{newIssueCount} new {newIssueCount === 1 ? 'issue' : 'issues'}</span>}
                  </div>
                </div>
              )}
              {activeFeedback.map((item) => {
                return (
                  <article
                    key={item.id}
                    className={cn(
                      'rounded-2xl border bg-white p-5 transition-all',
                      effectiveSelectedId === item.id ? 'border-[var(--teal)] shadow-[0_0_0_3px_rgb(22_127_118/8%)]' : 'border-[var(--line)]',
                    )}
                  >
                    <button onClick={() => setSelectedId(item.id)} className="w-full text-left">
                      <FeedbackCoachingContent item={item} />
                    </button>

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
                );
              })}

              {dismissed.length > 0 && (
                <button onClick={() => setDismissed([])} className="flex w-full items-center justify-center gap-1.5 py-2 text-xs font-medium text-[var(--muted-ink)] hover:text-[var(--ink)]">
                  <RotateCcw className="size-3.5" /> Restore dismissed suggestions
                </button>
              )}
            </div>
          </div>
        </div>

        <footer className="flex items-center justify-between border-t border-[var(--line)] bg-[var(--canvas)] px-6 py-4">
          {activeExercise ? (
            <><span className="text-sm text-[var(--muted-ink)]">Exercise complete · saved with this session</span><Button onClick={finishExercise} className="h-10 rounded-xl bg-[var(--navy)] px-4 hover:bg-[#1d4255]">Finish exercise <ArrowRight className="ml-1 size-4" /></Button></>
          ) : (
            <>
              <button onClick={endSession} className="text-sm font-medium text-[var(--muted-ink)] hover:text-[var(--ink)]">End session</button>
              <div className="flex items-center gap-2">
                <Button variant="outline" onClick={redoQuestion} className="h-10 rounded-xl border-[var(--line)] bg-white px-4">Redo question <RotateCcw className="ml-1 size-4" /></Button>
                <Button onClick={nextQuestion} className="h-10 rounded-xl bg-[var(--navy)] px-4 hover:bg-[#1d4255]">Next question <ArrowRight className="ml-1 size-4" /></Button>
              </div>
            </>
          )}
        </footer>
      </div>
    </section>
  );

  return (
    <AppShell>
      {fullScreen && <div className="fixed inset-0 z-40 bg-[#0e222d]/55 backdrop-blur-sm" />}
      <Screen wide>
        <Breadcrumbs items={[{ label: activeExercise ? 'Exercises' : 'Goals', href: activeExercise ? '/exercises' : '/goals' }, { label: activeExercise ? 'Exercise feedback' : 'Answer feedback' }]} />
        <div className="mb-6 flex items-start justify-between gap-6">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--teal-dark)]">{activeExercise ? 'Exercise complete' : 'Answer complete'}</p>
            <h1 className="mt-2 max-w-4xl font-display text-2xl font-semibold leading-8 tracking-[-0.03em] text-[var(--navy)]">{prompt}</h1>
          </div>
          <span className="shrink-0 rounded-full bg-[var(--mint-soft)] px-3 py-1.5 text-xs font-medium text-[var(--teal-dark)]">{activeExercise ? `Skill · ${activeExercise.targetSkill}` : `Goal · ${goalTitle}`}</span>
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
                  <p className="mt-2 text-sm leading-6 text-white/50">The local video preview is unavailable. Your transcript and feedback remain available.</p>
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

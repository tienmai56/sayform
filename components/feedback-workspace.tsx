'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  AlertCircle,
  ArrowRight,
  CheckCircle2,
  FileText,
  Maximize2,
  Minimize2,
  Play,
  RotateCcw,
  Sparkles,
  ThumbsDown,
  ThumbsUp,
  VideoOff,
} from 'lucide-react';
import { AppShell, Breadcrumbs, Screen } from '@/components/app-shell';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { getPracticeQuestions } from '@/lib/goal-catalog';
import { cn } from '@/lib/utils';
import { usePractice } from '@/components/practice-context';
import { getResponseAnalysisProgress, rateFeedback } from '@/lib/client-data';
import { ExerciseAttemptFeedback } from '@/components/exercise-attempt-feedback';
import { FeedbackCoachingContent } from '@/components/feedback-coaching-content';
import { FeedbackProgressSteps } from '@/components/feedback-progress-steps';
import { SpeakingPaceIllustration, speakingPaceComment } from '@/components/speaking-pace-illustration';
import { getInterviewEvaluation } from '@/lib/feedback-copy';
import type { FeedbackDimension, FeedbackItem, ResponseAnalysisProgress } from '@/lib/types';

function formatDuration(totalSeconds: number) {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return minutes ? `${minutes} min ${seconds} sec` : `${seconds} sec`;
}

const interviewCheckDefinitions: Array<{
  question: string;
  dimension: FeedbackDimension;
}> = [
  { question: 'Did you answer the question?', dimension: 'Communication effectiveness' },
  { question: 'Was the reasoning easy to follow?', dimension: 'Critical thinking' },
  { question: 'Did you provide a clear conclusion?', dimension: 'Sentence structure' },
];

function InterviewAnswerCheck({ feedback }: { feedback: FeedbackItem[] }) {
  return (
    <div aria-labelledby="interview-answer-check-title">
      <h3 id="interview-answer-check-title" className="font-display text-xl font-semibold tracking-[-0.025em] text-[#4f23c8]">
        Your answer at a glance
      </h3>
      <div className="mt-3 grid grid-cols-1 gap-3 xl:grid-cols-3">
        {interviewCheckDefinitions.map((definition) => {
          const item = feedback.find((candidate) => candidate.dimension === definition.dimension);
          const evaluation = item ? getInterviewEvaluation(item) : null;
          return (
            <article
              key={definition.dimension}
              className={cn(
                'rounded-2xl border p-5 shadow-[0_1px_2px_rgba(43,23,69,0.03)]',
                evaluation?.verdict === 'yes'
                  ? 'border-[#d3e9df] bg-[#f5fbf8]'
                  : evaluation?.verdict === 'partially'
                    ? 'border-[#ecdfc9] bg-[#fffaf2]'
                    : evaluation?.verdict === 'no'
                      ? 'border-[#efd6d0] bg-[#fff7f5]'
                      : 'border-[var(--line)] bg-[#faf9fc]',
              )}
            >
              <p className="text-sm font-semibold leading-5 text-[var(--navy)]">{definition.question}</p>
              {evaluation && (
                <span
                  className={cn(
                    'mt-3 inline-flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-bold uppercase tracking-[0.04em]',
                    evaluation.verdict === 'yes'
                      ? 'bg-[#c9f2d5] text-[#135f34]'
                      : evaluation.verdict === 'partially'
                        ? 'bg-[#ffe8ad] text-[#873f12]'
                        : 'bg-[#f8d7d1] text-[#8a3427]',
                  )}
                >
                  {evaluation.verdict === 'yes' ? <CheckCircle2 className="size-4" /> : <AlertCircle className="size-4" />}
                  {evaluation.label}
                </span>
              )}
              {evaluation ? (
                <p className="mt-3 text-sm leading-6 text-[var(--ink)]">{evaluation.reason}</p>
              ) : (
                <p className="mt-3 text-sm leading-6 text-[var(--muted-ink)]">This check could not be evaluated from the transcript.</p>
              )}
            </article>
          );
        })}
      </div>
    </div>
  );
}

export function FeedbackWorkspace() {
  const { activeExercise } = usePractice();
  if (activeExercise) return <ExerciseAttemptFeedback />;
  return <StandardFeedbackWorkspace />;
}

function StandardFeedbackWorkspace() {
  const router = useRouter();
  const {
    activeExercise,
    activeResponseId,
    analysisError,
    analysisStatus,
    clearRecording,
    completeResponse,
    currentAnalysis,
    feedbackIds,
    goalSkills,
    goalTemplateKey,
    goalTitle,
    interviewQuestionType,
    prompt,
    recordingUrl,
    resetSession,
    setAnalysisProgress,
    updateSetup,
  } = usePractice();
  const [fullScreen, setFullScreen] = useState(false);
  const [recordingOpen, setRecordingOpen] = useState(false);
  const [coachingRating, setCoachingRating] = useState<'helpful' | 'unhelpful' | null>(null);
  const [coachingNoteOpen, setCoachingNoteOpen] = useState(false);
  const [note, setNote] = useState('');
  const [transcriptOpen, setTranscriptOpen] = useState(false);
  const [analysisPreview, setAnalysisPreview] = useState<ResponseAnalysisProgress | null>(null);
  const feedback = useMemo(() => currentAnalysis?.feedback ?? [], [currentAnalysis]);
  const isInterview = goalTemplateKey === 'clarity';
  const interviewFollowUp = currentAnalysis?.followUpQuestion?.trim() ?? '';
  const canAnswerFollowUp = isInterview && interviewQuestionType === 'primary' && Boolean(interviewFollowUp);
  const primaryFiller = currentAnalysis
    ? Object.entries(currentAnalysis.metrics.fillerWords ?? {})
      .filter(([phrase, count]) => phrase.trim() && count > 0)
      .sort(([leftPhrase, leftCount], [rightPhrase, rightCount]) => rightCount - leftCount || leftPhrase.localeCompare(rightPhrase))[0] ?? null
    : null;

  const activeFeedback = feedback;
  const orderedFeedback = useMemo(
    () => [...activeFeedback].sort((first, second) => Number(Boolean(second.positive)) - Number(Boolean(first.positive))),
    [activeFeedback],
  );
  const resolvedCount = activeFeedback.filter((item) => item.progressStatus === 'resolved').length;
  const continuingCount = activeFeedback.filter((item) => item.progressStatus === 'still_happening').length;
  const newIssueCount = activeFeedback.filter((item) => item.progressStatus === 'new' && !item.positive).length;
  const hasComparison = resolvedCount + continuingCount + newIssueCount > 0;

  useEffect(() => {
    if (activeExercise || currentAnalysis || !activeResponseId || analysisStatus === 'failed') return;
    const responseId = activeResponseId;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const startedAt = Date.now();

    async function poll() {
      try {
        const progress = await getResponseAnalysisProgress(responseId);
        if (cancelled) return;
        setAnalysisPreview(progress);
        if (progress.analysis) {
          const analysis = progress.analysis;
          timer = setTimeout(() => {
            if (!cancelled) completeResponse(responseId, progress.feedbackIds ?? {}, analysis);
          }, 800);
          return;
        }
        if (progress.stage === 'failed') {
          setAnalysisProgress('failed', progress.error);
          return;
        }
        if (Date.now() - startedAt >= 120_000) {
          setAnalysisProgress('failed', 'Feedback is taking longer than expected. Please try this question again.');
          return;
        }
        timer = setTimeout(() => void poll(), 700);
      } catch {
        if (cancelled) return;
        if (Date.now() - startedAt >= 120_000) {
          setAnalysisProgress('failed', 'Feedback is taking longer than expected. Please try this question again.');
          return;
        }
        timer = setTimeout(() => void poll(), 1200);
      }
    }

    void poll();
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [activeExercise, activeResponseId, analysisStatus, completeResponse, currentAnalysis, setAnalysisProgress]);

  function rateCoachingHelpful() {
    setCoachingRating('helpful');
    setCoachingNoteOpen(false);
    setNote('');
    void Promise.all(
      activeFeedback.map((item) => rateFeedback(feedbackIds[item.id], { rating: 'helpful' })),
    );
  }

  function openCoachingUnhelpful() {
    setCoachingNoteOpen(true);
    setNote('');
  }

  function submitCoachingUnhelpful() {
    setCoachingRating('unhelpful');
    setCoachingNoteOpen(false);
    void Promise.all(
      activeFeedback.map((item) => rateFeedback(feedbackIds[item.id], { rating: 'unhelpful', note })),
    );
  }

  function answerFollowUp() {
    if (!canAnswerFollowUp) return;
    clearRecording();
    updateSetup({ answerNotes: '', customTopic: '', redoFeedback: [], prompt: interviewFollowUp, interviewQuestionType: 'follow-up' });
    router.push('/practice/session');
  }

  function nextQuestion() {
    clearRecording();
    if (isInterview) {
      updateSetup({ answerNotes: '', customTopic: '', redoFeedback: [], prompt: '', interviewQuestionType: 'primary' });
      router.push('/practice/session');
      return;
    }
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
          <div className="flex items-center gap-2">
            {!fullScreen && (
              <Button variant="outline" onClick={() => setRecordingOpen((current) => !current)} className="rounded-xl bg-white">
                <Play className="size-4" />
                {recordingOpen ? 'Hide recording' : 'View recording'}
              </Button>
            )}
            {currentAnalysis && (
              <Button
                variant="outline"
                aria-expanded={transcriptOpen}
                aria-controls="answer-transcript"
                onClick={() => setTranscriptOpen((current) => !current)}
                className="rounded-xl bg-white"
              >
                <FileText className="size-4" />
                {transcriptOpen ? 'Hide transcript' : 'View transcript'}
              </Button>
            )}
            <Button
              variant="outline"
              onClick={() => setFullScreen((current) => !current)}
              className="rounded-xl bg-white"
            >
              {fullScreen ? <Minimize2 className="size-4" /> : <Maximize2 className="size-4" />}
              {fullScreen ? 'Return to feedback page' : 'View full screen'}
            </Button>
          </div>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto p-6">
          {transcriptOpen && currentAnalysis && (
            <section id="answer-transcript" className="mb-7 border-b border-[var(--line)] bg-[#faf8ff] px-5 pb-6 pt-5" aria-labelledby="answer-transcript-title">
              <div className="flex items-center justify-between gap-4">
                <h3 id="answer-transcript-title" className="font-display text-lg font-semibold text-[var(--navy)]">Your transcript</h3>
                <span className="text-xs text-[var(--muted-ink)]">{currentAnalysis.metrics.wordCount} words · {formatDuration(currentAnalysis.durationSeconds)}</span>
              </div>
              <p className="mt-3 whitespace-pre-wrap text-base leading-8 text-[#5f4f72]">{currentAnalysis.transcript}</p>
            </section>
          )}
          {!activeExercise && !currentAnalysis && (
            <div className="mx-auto flex min-h-full max-w-3xl flex-col justify-center py-8">
              {analysisStatus === 'failed' ? (
                <div className="rounded-2xl border border-[#e8c6bf] bg-[var(--rose-soft)] p-6 text-center">
                  <AlertCircle className="mx-auto size-7 text-[#914435]" />
                  <h3 className="mt-3 font-display text-xl font-semibold text-[var(--navy)]">Feedback could not be completed</h3>
                  <p className="mt-2 text-sm leading-6 text-[#765149]">{analysisError ?? 'Please try recording this answer again.'}</p>
                  <Button onClick={redoQuestion} className="mt-5 rounded-xl bg-[var(--navy)]">Try question again</Button>
                </div>
              ) : (
                <>
                  <div className="text-center">
                    <span className="mx-auto grid size-12 place-items-center rounded-2xl bg-[var(--mint-soft)] text-[var(--teal-dark)]"><Sparkles className="size-5 animate-pulse" /></span>
                    <h3 className="mt-4 font-display text-xl font-semibold text-[var(--navy)]">Preparing your personalized feedback</h3>
                    <p className="mt-2 text-sm text-[var(--muted-ink)]">You can stay here while each stage appears as soon as it is ready.</p>
                  </div>
                  <FeedbackProgressSteps stage={analysisPreview?.stage ?? (analysisStatus === 'idle' ? 'queued' : analysisStatus)} />
                  {analysisPreview?.transcript && (
                    <div className="mt-6 rounded-2xl border border-[var(--line)] bg-white p-5 text-left">
                      <div className="flex items-center justify-between gap-4">
                        <p className="text-xs font-semibold uppercase tracking-[0.09em] text-[var(--teal-dark)]">Transcript ready</p>
                        {analysisPreview.metrics && <span className="text-xs text-[var(--muted-ink)]">{analysisPreview.metrics.wordCount} words · {analysisPreview.metrics.averageWpm} WPM</span>}
                      </div>
                      <p className="mt-3 whitespace-pre-wrap text-sm leading-7 text-[#6d5b7f]">{analysisPreview.transcript}</p>
                    </div>
                  )}
                </>
              )}
            </div>
          )}
          <div className={cn(!activeExercise && !currentAnalysis && 'hidden')}>
          {activeExercise && (
            <div className="mb-5 grid grid-cols-[minmax(0,1fr)_minmax(300px,0.7fr)] gap-4 rounded-2xl border border-[var(--mint)] bg-[var(--mint-soft)] p-5">
              <div><p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-[var(--teal-dark)]">Skill practised</p><h3 className="mt-1.5 text-base font-semibold text-[var(--navy)]">{activeExercise.targetSkill}</h3><p className="mt-2 text-sm leading-6 text-[#5f4f72]">Your response made the target behavior more explicit. Keep the same meaning while making the evidence concrete.</p></div>
              <div className="rounded-xl bg-white/75 p-4"><p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-[var(--muted-ink)]">Compared with the session evidence</p><p className="mt-2 text-xs italic leading-5 text-[#6d5b7f]">“{activeExercise.sourceEvidence}”</p></div>
            </div>
          )}
          {!activeExercise && goalTemplateKey === 'storytelling' && (
            <div className="mb-5 rounded-2xl border border-[#cfc3e6] bg-[var(--mint-soft)] p-5">
              <div className="flex items-start gap-3">
                <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-white text-[var(--teal-dark)]"><Sparkles className="size-4" /></span>
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-[var(--teal-dark)]">Story structure review</p>
                  <h3 className="mt-1 font-display text-lg font-semibold text-[var(--navy)]">Matthew Dicks’ Storyworthy framework</h3>
                  <p className="mt-1.5 text-sm leading-6 text-[#5f4f72]">This feedback evaluates only what appears in your transcript: the five-second moment, an opening close to the action, meaningful stakes, and a clear beginning-to-ending contrast.</p>
                </div>
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                {['Five-second moment', 'Start close to the action', 'Meaningful stakes', 'Beginning-to-ending contrast'].map((criterion) => (
                  <span key={criterion} className="rounded-full border border-[#c4b5fd] bg-white/75 px-3 py-1 text-[11px] font-semibold text-[var(--teal-dark)]">{criterion}</span>
                ))}
              </div>
            </div>
          )}
          <section aria-labelledby="coaching-feedback-title">
            <h2
              id="coaching-feedback-title"
              className="font-display text-2xl font-semibold tracking-[-0.03em] text-[#4f23c8]"
            >
              Coaching feedback
            </h2>

            {!activeExercise && isInterview && (
              <div className="mt-4">
                <InterviewAnswerCheck feedback={activeFeedback} />
              </div>
            )}

            {hasComparison && (
              <div className="mt-4 rounded-2xl bg-[#f5f2fb] px-4 py-3.5">
                <p className="text-[11px] font-semibold uppercase tracking-[0.09em] text-[var(--muted-ink)]">Compared with your last answer</p>
                <div className="mt-2.5 flex flex-wrap gap-2">
                  {resolvedCount > 0 && <span className="rounded-full bg-[#ede9fe] px-2.5 py-1 text-[11px] font-semibold text-[#5b21b6]">{resolvedCount} resolved</span>}
                  {continuingCount > 0 && <span className="rounded-full bg-[#fff0c7] px-2.5 py-1 text-[11px] font-semibold text-[#805b17]">{continuingCount} still happening</span>}
                  {newIssueCount > 0 && <span className="rounded-full bg-[#e7eef6] px-2.5 py-1 text-[11px] font-semibold text-[#3e6078]">{newIssueCount} new {newIssueCount === 1 ? 'issue' : 'issues'}</span>}
                </div>
              </div>
            )}

            <h3 className="mt-6 font-display text-xl font-semibold tracking-[-0.025em] text-[#4f23c8]">
              Detailed coaching
            </h3>
            <div className="mt-3 grid grid-cols-1 gap-3 xl:grid-cols-2">
              {orderedFeedback.map((item) => (
                <article
                  key={item.id}
                  className="rounded-2xl border border-[#e7e0f3] bg-[#fbfaff] p-4 shadow-[0_1px_2px_rgba(43,23,69,0.03)]"
                >
                  <FeedbackCoachingContent item={item} variant="card" />
                </article>
              ))}
            </div>

            <div className="mt-4 flex flex-wrap items-center gap-2 rounded-2xl bg-[#f8f6fc] px-5 py-3.5">
              <span className="mr-auto text-xs font-medium text-[var(--ink)]">Was this coaching useful?</span>
              <button
                type="button"
                aria-pressed={coachingRating === 'helpful'}
                onClick={rateCoachingHelpful}
                className={cn(
                  'flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-medium transition-colors',
                  coachingRating === 'helpful'
                    ? 'bg-[#dff4e7] text-[#17613a]'
                    : 'text-[var(--muted-ink)] hover:bg-white hover:text-[var(--ink)]',
                )}
              >
                <ThumbsUp className="size-3.5" /> Helpful
              </button>
              <button
                type="button"
                aria-pressed={coachingRating === 'unhelpful'}
                onClick={openCoachingUnhelpful}
                className={cn(
                  'flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-medium transition-colors',
                  coachingRating === 'unhelpful'
                    ? 'bg-[var(--rose-soft)] text-[#914435]'
                    : 'text-[var(--muted-ink)] hover:bg-white hover:text-[#914435]',
                )}
              >
                <ThumbsDown className="size-3.5" /> Unhelpful
              </button>
            </div>

            {coachingNoteOpen && (
              <div className="mt-3 rounded-2xl bg-[#fff8f6] p-4">
                <label htmlFor="coaching-note" className="text-xs font-medium text-[var(--ink)]">
                  What missed the mark? <span className="font-normal text-[var(--muted-ink)]">Optional</span>
                </label>
                <Textarea
                  id="coaching-note"
                  value={note}
                  onChange={(event) => setNote(event.target.value)}
                  placeholder="Add a short note for future coaching"
                  className="mt-2 min-h-20 border-[#ead8d3] bg-white text-xs"
                />
                <div className="mt-3 flex justify-end gap-2">
                  <Button size="sm" variant="ghost" onClick={() => setCoachingNoteOpen(false)}>Cancel</Button>
                  <Button size="sm" variant="destructive" onClick={submitCoachingUnhelpful}>Send feedback</Button>
                </div>
              </div>
            )}
          </section>

          <section className="mt-7 rounded-2xl bg-[#f8f6fc] p-5" aria-labelledby="response-metrics-title">
            <h3 id="response-metrics-title" className="sr-only">Response metrics</h3>
            <div className="grid items-center gap-5 xl:grid-cols-[minmax(0,1.1fr)_minmax(560px,1fr)]">
              <div className="flex min-w-0 items-center gap-5">
                {currentAnalysis ? <SpeakingPaceIllustration wordsPerMinute={currentAnalysis.metrics.averageWpm} /> : <div className="h-28 w-44 shrink-0 rounded-2xl bg-white" />}
                <div className="min-w-0">
                  <p className="text-xs font-semibold uppercase tracking-[0.09em] text-[var(--teal-dark)]">Average speaking pace</p>
                  <p className="mt-2 font-display text-4xl font-semibold tracking-[-0.04em] text-[var(--navy)]">{currentAnalysis ? currentAnalysis.metrics.averageWpm : '—'} <span className="text-base tracking-normal text-[var(--muted-ink)]">WPM</span></p>
                  <p className="mt-2 max-w-lg text-sm leading-6 text-[var(--muted-ink)]">{currentAnalysis ? speakingPaceComment(currentAnalysis.metrics.averageWpm) : 'Calculated from this recording'}</p>
                </div>
              </div>
              <dl className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                <div className="rounded-xl bg-white p-3.5">
                  <dt className="text-xs font-medium text-[var(--muted-ink)]">Time to main point</dt>
                  <dd className="mt-2 font-display text-2xl font-semibold tracking-[-0.03em] text-[var(--navy)]">
                    {currentAnalysis?.metrics.timeToMainPointSeconds !== null && currentAnalysis?.metrics.timeToMainPointSeconds !== undefined
                      ? `${currentAnalysis.metrics.timeToMainPointSeconds} sec`
                      : '—'}
                  </dd>
                  <p className="mt-1.5 text-[11px] leading-4 text-[var(--muted-ink)]">
                    {currentAnalysis
                      ? currentAnalysis.metrics.mainPointEvidence
                        ? 'From first spoken word'
                        : 'Main answer not reached'
                      : 'From this answer'}
                  </p>
                </div>
                <div className="rounded-xl bg-white p-3.5">
                  <dt className="text-xs font-medium text-[var(--muted-ink)]">Most-used filler</dt>
                  <dd className="mt-2 break-words font-display text-2xl font-semibold tracking-[-0.03em] text-[var(--navy)]">{currentAnalysis ? primaryFiller ? `“${primaryFiller[0]}”` : 'None' : '—'}</dd>
                  <p className="mt-1.5 text-[11px] leading-4 text-[var(--muted-ink)]">
                    {currentAnalysis
                      ? primaryFiller
                        ? `Used ${primaryFiller[1]} ${primaryFiller[1] === 1 ? 'time' : 'times'} · ${currentAnalysis.metrics.fillerCount} total`
                        : 'No filler words detected'
                      : 'From the transcript'}
                  </p>
                </div>
                <div className="rounded-xl bg-white p-3.5">
                  <dt className="text-xs font-medium text-[var(--muted-ink)]">Total words</dt>
                  <dd className="mt-2 font-display text-2xl font-semibold tracking-[-0.03em] text-[var(--navy)]">{currentAnalysis ? currentAnalysis.metrics.wordCount : '—'}</dd>
                  <p className="mt-1.5 text-[11px] leading-4 text-[var(--muted-ink)]">{currentAnalysis ? formatDuration(currentAnalysis.durationSeconds) : 'From the transcript'}</p>
                </div>
                <div className="rounded-xl bg-white p-3.5">
                  <dt className="text-xs font-medium text-[var(--muted-ink)]">Distinct words</dt>
                  <dd className="mt-2 font-display text-2xl font-semibold tracking-[-0.03em] text-[var(--navy)]">{currentAnalysis ? currentAnalysis.metrics.uniqueWordCount : '—'}</dd>
                  <p className="mt-1.5 text-[11px] leading-4 text-[var(--muted-ink)]">Case-normalized</p>
                </div>
              </dl>
            </div>
          </section>

          {canAnswerFollowUp && (
            <div className="mt-5 rounded-2xl border border-[#cfc3e6] bg-[var(--mint-soft)] p-5">
              <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-[var(--teal-dark)]">Your manager’s follow-up</p>
              <p className="mt-2 text-sm font-semibold leading-6 text-[var(--navy)]">{interviewFollowUp}</p>
              <p className="mt-2 text-xs leading-5 text-[#5f4f72]">This question was generated from your interview question and answer.</p>
            </div>
          )}
          </div>
        </div>

        {(activeExercise || currentAnalysis) && <footer className="flex items-center justify-between border-t border-[var(--line)] bg-[var(--canvas)] px-6 py-4">
          {activeExercise ? (
            <><span className="text-sm text-[var(--muted-ink)]">Exercise complete · saved with this session</span><Button onClick={finishExercise} className="h-10 rounded-xl bg-[var(--navy)] px-4 hover:bg-[#4c1d95]">Finish exercise <ArrowRight className="ml-1 size-4" /></Button></>
          ) : (
            <>
              <button onClick={endSession} className="text-sm font-medium text-[var(--muted-ink)] hover:text-[var(--ink)]">End session</button>
              <div className="flex items-center gap-2">
                <Button variant="outline" onClick={redoQuestion} className="h-10 rounded-xl border-[var(--line)] bg-white px-4">Redo question <RotateCcw className="ml-1 size-4" /></Button>
                {canAnswerFollowUp && <Button variant="outline" onClick={answerFollowUp} className="h-10 rounded-xl border-[var(--line)] bg-white px-4">Answer follow-up <ArrowRight className="ml-1 size-4" /></Button>}
                <Button onClick={nextQuestion} className="h-10 rounded-xl bg-[var(--navy)] px-4 hover:bg-[#4c1d95]">{isInterview ? 'New question' : 'Next question'} <ArrowRight className="ml-1 size-4" /></Button>
              </div>
            </>
          )}
        </footer>}
      </div>
    </section>
  );

  return (
    <AppShell>
      {fullScreen && <div className="fixed inset-0 z-40 bg-[#2e1065]/55 backdrop-blur-sm" />}
      <Screen wide>
        <Breadcrumbs items={[{ label: activeExercise ? 'Exercises' : 'Home', href: activeExercise ? '/exercises' : '/goals' }, { label: activeExercise ? 'Exercise feedback' : 'Answer feedback' }]} />
        <div className="mb-6 flex items-start justify-between gap-6">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--teal-dark)]">{activeExercise ? 'Exercise complete' : 'Answer complete'}</p>
            <h1 className="mt-2 max-w-4xl font-display text-2xl font-semibold leading-8 tracking-[-0.03em] text-[var(--navy)]">{prompt}</h1>
          </div>
          <span className="shrink-0 rounded-full bg-[var(--mint-soft)] px-3 py-1.5 text-xs font-medium text-[var(--teal-dark)]">{activeExercise ? `Skill · ${activeExercise.targetSkill}` : `Goal · ${goalTitle}`}</span>
        </div>

        <div className={cn('grid h-[calc(100vh-190px)] min-h-[720px] gap-5', recordingOpen ? 'grid-cols-[minmax(380px,0.62fr)_minmax(620px,1.38fr)]' : 'grid-cols-1')}>
          {recordingOpen && <section className="flex min-h-0 flex-col overflow-hidden rounded-3xl border border-[#4c1d95] bg-[#24123d] shadow-[var(--shadow-sm)]">
            <div className="flex items-center justify-between border-b border-white/10 px-5 py-4 text-white">
              <div className="flex items-center gap-2"><Play className="size-4 text-[var(--mint)]" /><span className="text-sm font-semibold">Your recording</span></div>
              <span className="text-xs text-white/45">Paused · play when ready</span>
            </div>
            <div className="flex min-h-0 flex-1 items-center justify-center bg-[#160a29] p-5">
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
          </section>}

          {report}
        </div>
      </Screen>
    </AppShell>
  );
}

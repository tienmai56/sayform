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
import { getInterviewEvaluation } from '@/lib/feedback-copy';
import type { FeedbackDimension, FeedbackItem, ResponseAnalysisProgress } from '@/lib/types';

function formatDuration(totalSeconds: number) {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return minutes ? `${minutes} min ${seconds} sec` : `${seconds} sec`;
}

function speakingPaceComment(wordsPerMinute: number) {
  if (wordsPerMinute < 100) return 'Below the 100–165 WPM clarity reference. Try speaking slightly faster while keeping your words clear.';
  if (wordsPerMinute <= 165) return 'Within the 100–165 WPM clarity reference—a clear, natural pace for most interviews.';
  return 'Above the 100–165 WPM clarity reference. Slow down slightly so your key points have time to land.';
}

const PACE_MIN = 60;
const PACE_MAX = 220;
const PACE_RANGE_START = 100;
const PACE_RANGE_END = 165;

function paceGaugePoint(wordsPerMinute: number, radius = 62) {
  const clampedPace = Math.min(PACE_MAX, Math.max(PACE_MIN, wordsPerMinute));
  const angle = Math.PI - ((clampedPace - PACE_MIN) / (PACE_MAX - PACE_MIN)) * Math.PI;
  return {
    x: 82 + radius * Math.cos(angle),
    y: 72 - radius * Math.sin(angle),
  };
}

function paceGaugeArc(start: number, end: number) {
  const startPoint = paceGaugePoint(start);
  const endPoint = paceGaugePoint(end);
  return `M ${startPoint.x} ${startPoint.y} A 62 62 0 0 1 ${endPoint.x} ${endPoint.y}`;
}

function SpeakingPaceIllustration({ wordsPerMinute }: { wordsPerMinute: number }) {
  const marker = paceGaugePoint(wordsPerMinute);

  return (
    <figure className="w-44 shrink-0" aria-label={`Average speaking pace: ${wordsPerMinute} words per minute`}>
      <svg viewBox="0 0 164 96" className="block h-auto w-full" aria-labelledby="pace-illustration-title">
        <title id="pace-illustration-title">Speaking pace compared with the 100 to 165 words per minute clarity reference</title>
        <path d={paceGaugeArc(PACE_MIN, 96)} fill="none" stroke="#e8e3f2" strokeLinecap="round" strokeWidth="14" />
        <path d={paceGaugeArc(PACE_RANGE_START, PACE_RANGE_END)} fill="none" stroke="#8b5cf6" strokeLinecap="round" strokeWidth="14" />
        <path d={paceGaugeArc(169, PACE_MAX)} fill="none" stroke="#e8e3f2" strokeLinecap="round" strokeWidth="14" />
        <circle cx={marker.x} cy={marker.y} r="6" fill="#2b1745" stroke="white" strokeWidth="3" />
        <text x="82" y="62" textAnchor="middle" fill="#6d5b7f" fontFamily="var(--font-sans-ui)" fontSize="7" fontWeight="700" letterSpacing="0.08em">CLARITY RANGE</text>
        <text x="82" y="76" textAnchor="middle" fill="#2b1745" fontFamily="var(--font-display-ui)" fontSize="12" fontWeight="600">100–165</text>
      </svg>
      <figcaption className="-mt-1 flex justify-between text-[10px] font-semibold text-[var(--muted-ink)]">
        <span>Slower</span>
        <span>Faster</span>
      </figcaption>
    </figure>
  );
}

const interviewCheckDefinitions: Array<{
  question: string;
  dimension: FeedbackDimension;
}> = [
  { question: 'Did you answer the actual question?', dimension: 'Communication effectiveness' },
  { question: 'Was your reasoning easy to follow?', dimension: 'Critical thinking' },
  { question: 'Did you provide a clear conclusion?', dimension: 'Sentence structure' },
];

function InterviewAnswerCheck({ feedback }: { feedback: FeedbackItem[] }) {
  return (
    <section className="mb-7" aria-labelledby="interview-answer-check-title">
      <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-[var(--teal-dark)]">Interview answer check</p>
      <h3 id="interview-answer-check-title" className="mt-1 font-display text-2xl font-semibold tracking-[-0.025em] text-[var(--navy)]">The three questions your coach always checks</h3>
      <div className="mt-5 grid grid-cols-1 border-y border-[var(--line)] xl:grid-cols-3 xl:divide-x xl:divide-[var(--line)]">
        {interviewCheckDefinitions.map((definition) => {
          const item = feedback.find((candidate) => candidate.dimension === definition.dimension);
          const evaluation = item ? getInterviewEvaluation(item) : null;
          return (
            <article key={definition.dimension} className="border-b border-[var(--line)] py-5 last:border-b-0 xl:border-b-0 xl:px-5 xl:first:pl-0 xl:last:pr-0">
              <div className="flex items-start gap-3">
                <span className={cn(
                  'grid size-8 shrink-0 place-items-center rounded-full',
                  evaluation?.verdict === 'yes'
                    ? 'bg-[var(--mint-soft)] text-[var(--teal-dark)]'
                    : evaluation?.verdict === 'partially'
                      ? 'bg-[var(--amber-soft)] text-[#8a621c]'
                      : 'bg-[var(--rose-soft)] text-[#914435]',
                )}>
                  {evaluation?.verdict === 'yes' ? <CheckCircle2 className="size-4" /> : <AlertCircle className="size-4" />}
                </span>
                <div>
                  <p className="text-base font-semibold leading-6 text-[var(--navy)]">{definition.question}</p>
                  {evaluation && <p className="mt-1 text-xs font-bold uppercase tracking-[0.08em] text-[var(--muted-ink)]">{evaluation.label}</p>}
                </div>
              </div>
              {evaluation ? (
                <p className="mt-4 text-sm leading-6 text-[var(--ink)]">{evaluation.reason}</p>
              ) : (
                <p className="mt-3 text-sm leading-6 text-[var(--muted-ink)]">This check could not be evaluated from the transcript.</p>
              )}
            </article>
          );
        })}
      </div>
    </section>
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
  const [ratings, setRatings] = useState<Record<string, 'helpful' | 'unhelpful'>>({});
  const [pendingDismiss, setPendingDismiss] = useState<string | null>(null);
  const [dismissed, setDismissed] = useState<string[]>([]);
  const [note, setNote] = useState('');
  const [transcriptOpen, setTranscriptOpen] = useState(false);
  const [analysisPreview, setAnalysisPreview] = useState<ResponseAnalysisProgress | null>(null);
  const feedback = useMemo(() => currentAnalysis?.feedback ?? [], [currentAnalysis]);
  const isInterview = goalTemplateKey === 'clarity';
  const interviewFollowUp = currentAnalysis?.followUpQuestion?.trim() ?? '';
  const canAnswerFollowUp = isInterview && interviewQuestionType === 'primary' && Boolean(interviewFollowUp);

  const activeFeedback = useMemo(
    () => feedback.filter((item) => !dismissed.includes(item.id)),
    [dismissed, feedback],
  );
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
    void rateFeedback(feedbackIds[id], { rating: 'unhelpful', note, dismissed: true });
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
          {!activeExercise && isInterview && <InterviewAnswerCheck feedback={activeFeedback} />}
          <section className="border-y border-[var(--line)] py-6" aria-labelledby="response-metrics-title">
            <h3 id="response-metrics-title" className="sr-only">Response metrics</h3>
            <div className="grid items-center gap-7 xl:grid-cols-[minmax(0,1.35fr)_minmax(420px,1fr)]">
              <div className="flex min-w-0 items-center gap-6 xl:border-r xl:border-[var(--line)] xl:pr-8">
                {currentAnalysis ? <SpeakingPaceIllustration wordsPerMinute={currentAnalysis.metrics.averageWpm} /> : <div className="h-28 w-44 shrink-0 rounded-2xl bg-[var(--canvas)]" />}
                <div className="min-w-0">
                  <p className="text-xs font-semibold uppercase tracking-[0.09em] text-[var(--teal-dark)]">Average speaking pace</p>
                  <p className="mt-2 font-display text-4xl font-semibold tracking-[-0.04em] text-[var(--navy)]">{currentAnalysis ? currentAnalysis.metrics.averageWpm : '—'} <span className="text-base tracking-normal text-[var(--muted-ink)]">WPM</span></p>
                  <p className="mt-2 max-w-lg text-sm leading-6 text-[var(--muted-ink)]">{currentAnalysis ? speakingPaceComment(currentAnalysis.metrics.averageWpm) : 'Calculated from this recording'}</p>
                </div>
              </div>
              <dl className="grid grid-cols-3 divide-x divide-[var(--line)]">
                <div className="px-5 first:pl-0">
                  <dt className="text-xs font-medium text-[var(--muted-ink)]">Fillers</dt>
                  <dd className="mt-2 font-display text-3xl font-semibold tracking-[-0.03em] text-[var(--navy)]">{currentAnalysis ? currentAnalysis.metrics.fillerCount : '—'}</dd>
                  <p className="mt-2 text-xs leading-5 text-[var(--muted-ink)]">{currentAnalysis && currentAnalysis.metrics.wordCount ? `${((currentAnalysis.metrics.fillerCount / currentAnalysis.metrics.wordCount) * 100).toFixed(1)} per 100 words` : 'From the transcript'}</p>
                </div>
                <div className="px-5">
                  <dt className="text-xs font-medium text-[var(--muted-ink)]">Total words</dt>
                  <dd className="mt-2 font-display text-3xl font-semibold tracking-[-0.03em] text-[var(--navy)]">{currentAnalysis ? currentAnalysis.metrics.wordCount : '—'}</dd>
                  <p className="mt-2 text-xs leading-5 text-[var(--muted-ink)]">{currentAnalysis ? formatDuration(currentAnalysis.durationSeconds) : 'From the transcript'}</p>
                </div>
                <div className="px-5 last:pr-0">
                  <dt className="text-xs font-medium text-[var(--muted-ink)]">Distinct words</dt>
                  <dd className="mt-2 font-display text-3xl font-semibold tracking-[-0.03em] text-[var(--navy)]">{currentAnalysis ? currentAnalysis.metrics.uniqueWordCount : '—'}</dd>
                  <p className="mt-2 text-xs leading-5 text-[var(--muted-ink)]">Case-normalized</p>
                </div>
              </dl>
            </div>
          </section>

          <div className="mt-7 space-y-5">
            {hasComparison && (
              <div className="border-b border-[var(--line)] pb-5">
                <p className="text-[11px] font-semibold uppercase tracking-[0.09em] text-[var(--muted-ink)]">Compared with your last answer</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {resolvedCount > 0 && <span className="rounded-full bg-[#ede9fe] px-2.5 py-1 text-[11px] font-semibold text-[#5b21b6]">{resolvedCount} resolved</span>}
                  {continuingCount > 0 && <span className="rounded-full bg-[#fff0c7] px-2.5 py-1 text-[11px] font-semibold text-[#805b17]">{continuingCount} still happening</span>}
                  {newIssueCount > 0 && <span className="rounded-full bg-[#e7eef6] px-2.5 py-1 text-[11px] font-semibold text-[#3e6078]">{newIssueCount} new {newIssueCount === 1 ? 'issue' : 'issues'}</span>}
                </div>
              </div>
            )}

            <section aria-labelledby="coaching-feedback-title">
              <h3 id="coaching-feedback-title" className="text-sm font-semibold text-[var(--navy)]">Coaching feedback</h3>

              <div className="mt-3 columns-1 xl:columns-2 xl:gap-4">
                {orderedFeedback.map((item) => {
                  return (
                    <article
                      key={item.id}
                      className="mb-2 inline-block w-full break-inside-avoid border-t border-[var(--line)] px-1 py-5 align-top"
                    >
                      <div className="text-left">
                        <FeedbackCoachingContent item={item} />
                      </div>

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
              </div>
            </section>

            {dismissed.length > 0 && (
              <button onClick={() => setDismissed([])} className="flex w-full items-center justify-center gap-1.5 py-2 text-xs font-medium text-[var(--muted-ink)] hover:text-[var(--ink)]">
                <RotateCcw className="size-3.5" /> Restore dismissed suggestions
              </button>
            )}

            {canAnswerFollowUp && (
              <div className="rounded-2xl border border-[#cfc3e6] bg-[var(--mint-soft)] p-5">
                <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-[var(--teal-dark)]">Your manager’s follow-up</p>
                <p className="mt-2 text-sm font-semibold leading-6 text-[var(--navy)]">{interviewFollowUp}</p>
                <p className="mt-2 text-xs leading-5 text-[#5f4f72]">This question was generated from your interview question and answer.</p>
              </div>
            )}
          </div>
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

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
  VideoOff,
} from 'lucide-react';
import { AppShell, Breadcrumbs, Screen } from '@/components/app-shell';
import { Button } from '@/components/ui/button';
import { getPracticeQuestions } from '@/lib/goal-catalog';
import { cn } from '@/lib/utils';
import { usePractice } from '@/components/practice-context';
import { getResponseAnalysisProgress } from '@/lib/client-data';
import { ExerciseAttemptFeedback } from '@/components/exercise-attempt-feedback';
import { FeedbackCoachingContent } from '@/components/feedback-coaching-content';
import { FeedbackProgressSteps } from '@/components/feedback-progress-steps';
import { SpeakingPaceIllustration, speakingPaceComment } from '@/components/speaking-pace-illustration';
import { getInterviewEvaluation } from '@/lib/feedback-copy';
import type { FeedbackDimension, FeedbackItem, ResponseAnalysis, ResponseAnalysisProgress } from '@/lib/types';

function formatDuration(totalSeconds: number) {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return minutes ? `${minutes} min ${seconds} sec` : `${seconds} sec`;
}

function combineInterviewAnalysis(primary: ResponseAnalysis, followUp: ResponseAnalysis): ResponseAnalysis {
  const transcript = `${primary.transcript}\n\n${followUp.transcript}`;
  const words = transcript.toLocaleLowerCase().match(/[\p{L}\p{N}']+/gu) ?? [];
  const durationSeconds = primary.durationSeconds + followUp.durationSeconds;
  const fillerWords = { ...primary.metrics.fillerWords };
  Object.entries(followUp.metrics.fillerWords).forEach(([phrase, count]) => {
    fillerWords[phrase] = (fillerWords[phrase] ?? 0) + count;
  });
  const mainPointTimes = [primary.metrics.timeToMainPointSeconds, followUp.metrics.timeToMainPointSeconds]
    .filter((seconds): seconds is number => typeof seconds === 'number');

  return {
    ...followUp,
    transcript,
    durationSeconds,
    metrics: {
      wordCount: words.length,
      uniqueWordCount: new Set(words).size,
      averageWpm: durationSeconds > 0 ? Math.round((words.length * 60) / durationSeconds) : 0,
      fillerCount: primary.metrics.fillerCount + followUp.metrics.fillerCount,
      fillerWords,
      timeToMainPointSeconds: mainPointTimes.length
        ? Math.round(mainPointTimes.reduce((total, seconds) => total + seconds, 0) / mainPointTimes.length)
        : null,
      mainPointEvidence: followUp.metrics.mainPointEvidence || primary.metrics.mainPointEvidence,
    },
  };
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
      <h3 id="interview-answer-check-title" className="font-display text-xl font-semibold tracking-[-0.025em] text-[var(--navy)]">
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
    goalSkills,
    goalTemplateKey,
    goalTitle,
    interviewPrimaryResponse,
    interviewQuestionType,
    prompt,
    recordingUrl,
    resetSession,
    setAnalysisProgress,
    updateSetup,
  } = usePractice();
  const [fullScreen, setFullScreen] = useState(false);
  const [recordingOpen, setRecordingOpen] = useState(false);
  const [transcriptOpen, setTranscriptOpen] = useState(false);
  const [analysisPreview, setAnalysisPreview] = useState<ResponseAnalysisProgress | null>(null);
  const feedback = useMemo(() => currentAnalysis?.feedback ?? [], [currentAnalysis]);
  const isInterview = goalTemplateKey === 'clarity';
  const isInterviewPrimary = isInterview && interviewQuestionType === 'primary';
  const interviewFollowUp = currentAnalysis?.followUpQuestion?.trim() ?? '';
  const isPreparedInterviewFollowUp = isInterview
    && interviewQuestionType === 'follow-up'
    && Boolean(interviewPrimaryResponse)
    && activeResponseId === interviewPrimaryResponse?.responseId
    && interviewFollowUp === prompt.trim();
  const followUpPreparationFailed = analysisStatus === 'failed'
    || (isInterviewPrimary && analysisStatus === 'completed' && Boolean(currentAnalysis) && !interviewFollowUp);
  const isCompletedInterviewSequence = isInterview && interviewQuestionType === 'follow-up' && Boolean(interviewPrimaryResponse);
  const displayAnalysis = useMemo(
    () => currentAnalysis && isCompletedInterviewSequence && interviewPrimaryResponse
      ? combineInterviewAnalysis(interviewPrimaryResponse.analysis, currentAnalysis)
      : currentAnalysis,
    [currentAnalysis, interviewPrimaryResponse, isCompletedInterviewSequence],
  );
  const primaryFiller = displayAnalysis
    ? Object.entries(displayAnalysis.metrics.fillerWords ?? {})
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

  useEffect(() => {
    if (!isPreparedInterviewFollowUp) return;
    router.replace('/practice/session');
  }, [isPreparedInterviewFollowUp, router]);

  function nextQuestion() {
    clearRecording();
    if (isInterview) {
      updateSetup({ answerNotes: '', customTopic: '', redoFeedback: [], prompt: '', interviewQuestionType: 'primary', interviewPrimaryResponse: null });
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

  if (isInterviewPrimary || isPreparedInterviewFollowUp) {
    return (
      <AppShell>
        <Screen>
          <Breadcrumbs items={[{ label: 'Home', href: '/goals' }, { label: 'Unscripted follow-up' }]} />
          <div className="mx-auto flex min-h-[70vh] max-w-2xl items-center justify-center py-8">
            {followUpPreparationFailed ? (
              <section className="w-full rounded-3xl border border-[#e8c6bf] bg-[var(--rose-soft)] p-8 text-center" aria-labelledby="follow-up-error-title">
                <AlertCircle className="mx-auto size-7 text-[#914435]" />
                <h1 id="follow-up-error-title" className="mt-4 font-display text-2xl font-semibold tracking-[-0.03em] text-[var(--navy)]">Your follow-up could not be prepared</h1>
                <p className="mx-auto mt-3 max-w-lg text-sm leading-6 text-[#765149]">{analysisError ?? 'Please record your main answer again.'}</p>
                <Button onClick={redoQuestion} className="mt-6 rounded-xl bg-[var(--navy)]">Try the main question again</Button>
              </section>
            ) : (
              <section className="relative w-full overflow-hidden rounded-3xl border border-[#d7ccef] bg-[linear-gradient(145deg,#ffffff_0%,#faf8ff_50%,#f1ecff_100%)] p-8 text-center shadow-[0_18px_50px_rgba(76,29,149,0.09)] motion-safe:animate-in motion-safe:fade-in motion-safe:zoom-in-95 motion-safe:duration-500" aria-labelledby="follow-up-preparing-title" aria-live="polite">
                <span aria-hidden="true" className="absolute -right-14 -top-16 size-44 rounded-full bg-[#ddd3ff]/60 blur-3xl motion-safe:animate-pulse" />
                <span aria-hidden="true" className="absolute -bottom-20 -left-8 size-40 rounded-full bg-white blur-3xl" />
                <div className="relative">
                  <div className="relative mx-auto size-20" aria-hidden="true">
                    <span className="absolute inset-0 rounded-full border border-[#ddd3f5] bg-white/80 shadow-[0_10px_30px_rgba(104,66,216,0.12)]" />
                    <span className="absolute inset-0 rounded-full border-2 border-transparent border-r-[#b9a7ed] border-t-[#6842d8] motion-safe:animate-[spin_2.2s_linear_infinite]" />
                    <span className="absolute inset-[10px] grid place-items-center rounded-2xl bg-[#eee9ff] text-[#6842d8]">
                      <Sparkles className="size-6 motion-safe:animate-pulse" />
                    </span>
                    <span className="absolute right-1 top-2 size-2.5 rounded-full bg-[#8b5cf6] shadow-[0_0_0_5px_rgba(139,92,246,0.13)]" />
                  </div>
                  <p className="mt-5 text-xs font-semibold uppercase tracking-[0.12em] text-[var(--teal-dark)]">Main answer complete</p>
                  <h1 id="follow-up-preparing-title" className="mt-2 font-display text-3xl font-semibold tracking-[-0.035em] text-[var(--navy)]">Preparing your unscripted follow-up</h1>
                  <p className="mx-auto mt-3 max-w-lg text-base leading-7 text-[var(--muted-ink)]">Your follow-up will open automatically. Coaching stays hidden until you finish answering it.</p>
                  <div className="mx-auto mt-7 max-w-sm" aria-busy="true" aria-label="Preparing your follow-up question">
                    <div className="h-2 overflow-hidden rounded-full bg-[#e6def8] shadow-inner">
                      <span className="block h-full w-2/5 rounded-full bg-[linear-gradient(90deg,#8b5cf6,#c4b5fd,#6842d8)] shadow-[0_0_16px_rgba(104,66,216,0.45)] motion-safe:animate-[follow-up-progress_1.8s_ease-in-out_infinite]" />
                    </div>
                    <div className="mt-3 flex items-center justify-center gap-2 text-xs font-medium text-[#6d5b7f]">
                      <span>Creating your next question</span>
                      <span className="flex gap-1" aria-hidden="true">
                        <span className="size-1.5 rounded-full bg-[#8b5cf6] motion-safe:animate-bounce" />
                        <span className="size-1.5 rounded-full bg-[#8b5cf6] motion-safe:animate-bounce motion-safe:[animation-delay:150ms]" />
                        <span className="size-1.5 rounded-full bg-[#8b5cf6] motion-safe:animate-bounce motion-safe:[animation-delay:300ms]" />
                      </span>
                    </div>
                  </div>
                </div>
              </section>
            )}
          </div>
        </Screen>
      </AppShell>
    );
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
              <h2 className="font-display text-lg font-semibold tracking-[-0.02em] text-[var(--navy)]">{activeExercise ? 'Targeted exercise feedback' : isInterview && interviewQuestionType === 'primary' ? 'Preparing your follow-up' : 'Personalized feedback'}</h2>
            </div>
            <p className="mt-1 text-xs text-[var(--muted-ink)]">{activeExercise
              ? `Focused on ${activeExercise.targetSkill}`
              : isInterview && interviewQuestionType === 'primary'
                ? 'Reviewing your main answer to create one natural interviewer follow-up'
                : isCompletedInterviewSequence
                  ? `Evaluated across all ${goalSkills.length || 5} goal skills using your main answer and follow-up`
                  : goalSkills.length
                    ? `Evaluated across all ${goalSkills.length} goal skills, based only on this response`
                    : 'Evaluated across all coaching dimensions, based only on this response'}</p>
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
          {transcriptOpen && displayAnalysis && (
            <section id="answer-transcript" className="mb-7 border-b border-[var(--line)] bg-[#faf8ff] px-5 pb-6 pt-5" aria-labelledby="answer-transcript-title">
              <div className="flex items-center justify-between gap-4">
                <h3 id="answer-transcript-title" className="font-display text-lg font-semibold text-[var(--navy)]">{isCompletedInterviewSequence ? 'Your interview transcripts' : 'Your transcript'}</h3>
                <span className="text-xs text-[var(--muted-ink)]">{displayAnalysis.metrics.wordCount} words · {formatDuration(displayAnalysis.durationSeconds)}</span>
              </div>
              {isCompletedInterviewSequence && interviewPrimaryResponse && currentAnalysis ? (
                <div className="mt-4 grid gap-4 xl:grid-cols-2">
                  <article className="rounded-2xl bg-white p-5">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-[var(--teal-dark)]">Main answer</p>
                    <p className="mt-2 text-sm font-semibold leading-6 text-[var(--navy)]">{interviewPrimaryResponse.prompt}</p>
                    <p className="mt-3 whitespace-pre-wrap text-sm leading-7 text-[#5f4f72]">{interviewPrimaryResponse.analysis.transcript}</p>
                  </article>
                  <article className="rounded-2xl bg-white p-5">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-[var(--teal-dark)]">Unscripted follow-up</p>
                    <p className="mt-2 text-sm font-semibold leading-6 text-[var(--navy)]">{prompt}</p>
                    <p className="mt-3 whitespace-pre-wrap text-sm leading-7 text-[#5f4f72]">{currentAnalysis.transcript}</p>
                  </article>
                </div>
              ) : (
                <p className="mt-3 whitespace-pre-wrap text-base leading-8 text-[#5f4f72]">{displayAnalysis.transcript}</p>
              )}
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
                    <h3 className="mt-4 font-display text-xl font-semibold text-[var(--navy)]">{isInterview && interviewQuestionType === 'primary' ? 'Preparing your unscripted follow-up' : 'Preparing your personalized feedback'}</h3>
                    <p className="mt-2 text-sm text-[var(--muted-ink)]">{isInterview && interviewQuestionType === 'primary' ? 'We’re reviewing your answer to choose the most useful point to probe next.' : 'You can stay here while each stage appears as soon as it is ready.'}</p>
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
          <section aria-label="Personalized feedback details">
            {!activeExercise && isInterview && (
              <div>
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

            <h3 className="mt-6 font-display text-xl font-semibold tracking-[-0.025em] text-[var(--navy)]">
              Detailed feedback
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

          </section>

          <section className="mt-7 rounded-2xl bg-[#f8f6fc] p-5" aria-labelledby="response-metrics-title">
            <h3 id="response-metrics-title" className="sr-only">Response metrics</h3>
            <div className="grid items-center gap-5 xl:grid-cols-[minmax(0,1.1fr)_minmax(560px,1fr)]">
              <div className="flex min-w-0 items-center gap-5">
                {displayAnalysis ? <SpeakingPaceIllustration wordsPerMinute={displayAnalysis.metrics.averageWpm} /> : <div className="h-28 w-44 shrink-0 rounded-2xl bg-white" />}
                <div className="min-w-0">
                  <p className="text-xs font-semibold uppercase tracking-[0.09em] text-[var(--teal-dark)]">{isCompletedInterviewSequence ? 'Combined speaking pace' : 'Average speaking pace'}</p>
                  <p className="mt-2 font-display text-4xl font-semibold tracking-[-0.04em] text-[var(--navy)]">{displayAnalysis ? displayAnalysis.metrics.averageWpm : '—'} <span className="text-base tracking-normal text-[var(--muted-ink)]">WPM</span></p>
                  <p className="mt-2 max-w-lg text-sm leading-6 text-[var(--muted-ink)]">{displayAnalysis ? speakingPaceComment(displayAnalysis.metrics.averageWpm) : 'Calculated from this recording'}</p>
                </div>
              </div>
              <dl className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                <div className="rounded-xl bg-white p-3.5">
                  <dt className="text-xs font-medium text-[var(--muted-ink)]">Time to main point</dt>
                  <dd className="mt-2 font-display text-2xl font-semibold tracking-[-0.03em] text-[var(--navy)]">
                    {displayAnalysis?.metrics.timeToMainPointSeconds !== null && displayAnalysis?.metrics.timeToMainPointSeconds !== undefined
                      ? `${displayAnalysis.metrics.timeToMainPointSeconds} sec`
                      : '—'}
                  </dd>
                  <p className="mt-1.5 text-[11px] leading-4 text-[var(--muted-ink)]">
                    {displayAnalysis
                      ? displayAnalysis.metrics.mainPointEvidence
                        ? 'From first spoken word'
                        : 'Main answer not reached'
                      : 'From this answer'}
                  </p>
                </div>
                <div className="rounded-xl bg-white p-3.5">
                  <dt className="text-xs font-medium text-[var(--muted-ink)]">Most-used filler</dt>
                  <dd className="mt-2 break-words font-display text-2xl font-semibold tracking-[-0.03em] text-[var(--navy)]">{displayAnalysis ? primaryFiller ? `“${primaryFiller[0]}”` : 'None' : '—'}</dd>
                  <p className="mt-1.5 text-[11px] leading-4 text-[var(--muted-ink)]">
                    {displayAnalysis
                      ? primaryFiller
                        ? `Used ${primaryFiller[1]} ${primaryFiller[1] === 1 ? 'time' : 'times'} · ${displayAnalysis.metrics.fillerCount} total`
                        : 'No filler words detected'
                      : 'From the transcript'}
                  </p>
                </div>
                <div className="rounded-xl bg-white p-3.5">
                  <dt className="text-xs font-medium text-[var(--muted-ink)]">Total words</dt>
                  <dd className="mt-2 font-display text-2xl font-semibold tracking-[-0.03em] text-[var(--navy)]">{displayAnalysis ? displayAnalysis.metrics.wordCount : '—'}</dd>
                  <p className="mt-1.5 text-[11px] leading-4 text-[var(--muted-ink)]">{displayAnalysis ? formatDuration(displayAnalysis.durationSeconds) : 'From the transcript'}</p>
                </div>
                <div className="rounded-xl bg-white p-3.5">
                  <dt className="text-xs font-medium text-[var(--muted-ink)]">Distinct words</dt>
                  <dd className="mt-2 font-display text-2xl font-semibold tracking-[-0.03em] text-[var(--navy)]">{displayAnalysis ? displayAnalysis.metrics.uniqueWordCount : '—'}</dd>
                  <p className="mt-1.5 text-[11px] leading-4 text-[var(--muted-ink)]">Case-normalized</p>
                </div>
              </dl>
            </div>
          </section>

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
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--teal-dark)]">{activeExercise ? 'Exercise complete' : isCompletedInterviewSequence ? 'Interview complete' : 'Answer complete'}</p>
            <h1 className="mt-2 max-w-4xl font-display text-2xl font-semibold leading-8 tracking-[-0.03em] text-[var(--navy)]">{isCompletedInterviewSequence && interviewPrimaryResponse ? interviewPrimaryResponse.prompt : prompt}</h1>
          </div>
          <span className="shrink-0 rounded-full bg-[var(--mint-soft)] px-3 py-1.5 text-xs font-medium text-[var(--teal-dark)]">{activeExercise ? `Skill · ${activeExercise.targetSkill}` : isCompletedInterviewSequence ? 'Main answer + follow-up' : `Goal · ${goalTitle}`}</span>
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

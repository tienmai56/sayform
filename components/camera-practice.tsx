'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Camera,
  CameraOff,
  Check,
  ChevronRight,
  Mic,
  Sparkles,
  Square,
  X,
} from 'lucide-react';
import { getFeedbackCorrections } from '@/components/feedback-coaching-content';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { usePractice } from '@/components/practice-context';
import { getGoalDefinition } from '@/lib/goal-catalog';
import { categories as categoryOptions } from '@/lib/mock-data';
import { completeExerciseAttempt as submitExerciseAttempt, createPracticeSession, startResponseAnalysis, updateExerciseStatus } from '@/lib/client-data';
import type { FeedbackDimension, FeedbackItem } from '@/lib/types';
import { cn } from '@/lib/utils';

type PracticeStatus = 'permission' | 'requesting' | 'ready' | 'recording' | 'processing' | 'error';

const feedbackOrder: Record<FeedbackDimension, number> = {
  'Communication effectiveness': 0,
  'Critical thinking': 1,
  Vocabulary: 2,
  'Sentence structure': 3,
  'What worked': 4,
};

const interviewFeedbackSteps: Record<FeedbackDimension, string> = {
  'Communication effectiveness': 'Start with the direct answer',
  'Critical thinking': 'Then show your reasoning',
  Vocabulary: 'Clarify key terms',
  'Sentence structure': 'Finish with a clear conclusion',
  'What worked': 'Keep this strength',
};

const generalFeedbackSteps: Record<FeedbackDimension, string> = {
  'Communication effectiveness': 'State the main message',
  'Critical thinking': 'Support the reasoning',
  Vocabulary: 'Clarify the wording',
  'Sentence structure': 'Tighten the structure',
  'What worked': 'Keep this strength',
};

function orderFeedbackForNextAttempt(feedback: FeedbackItem[]) {
  return feedback
    .map((item, originalIndex) => ({ item, originalIndex }))
    .sort((left, right) => (
      feedbackOrder[left.item.dimension] - feedbackOrder[right.item.dimension]
      || left.originalIndex - right.originalIndex
    ))
    .map(({ item }) => item);
}

function formatTime(totalSeconds: number) {
  const minutes = Math.floor(totalSeconds / 60).toString().padStart(2, '0');
  const seconds = (totalSeconds % 60).toString().padStart(2, '0');
  return `${minutes}:${seconds}`;
}

function createRecorder(stream: MediaStream, mimeTypes: string[], options: MediaRecorderOptions = {}) {
  const mimeType = mimeTypes.find((candidate) => MediaRecorder.isTypeSupported(candidate));
  return new MediaRecorder(stream, mimeType ? { ...options, mimeType } : options);
}

function recordedBlob(recorder: MediaRecorder | null, chunks: Blob[]) {
  if (!chunks.length) return null;
  const mimeType = recorder?.mimeType || chunks.find((chunk) => chunk.type)?.type || 'audio/webm';
  return new Blob(chunks, { type: mimeType });
}

function stopRecorder(recorder: MediaRecorder | null, chunks: Blob[]) {
  if (!recorder || recorder.state === 'inactive') return Promise.resolve(recordedBlob(recorder, chunks));
  return new Promise<Blob | null>((resolve) => {
    recorder.addEventListener('stop', () => {
      resolve(recordedBlob(recorder, chunks));
    }, { once: true });
    recorder.stop();
  });
}

export function CameraPractice() {
  const router = useRouter();
  const {
    activeExercise,
    activeSessionId,
    answerNotes,
    answerCount,
    beginExerciseAttempt,
    beginResponse,
    beginSession,
    categories,
    completeResponse,
    customTopic,
    goalId,
    goalTemplateKey,
    goalTitle,
    interviewPrimaryResponse,
    interviewQuestionType,
    prompt,
    redoFeedback,
    exerciseAttemptNumber,
    exerciseDifficultyLevel,
    exerciseStage,
    completeExerciseAttempt,
    resetSession,
    setRecordingUrl,
    clearRecording,
    updateSetup,
  } = usePractice();
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const previewRecorderRef = useRef<MediaRecorder | null>(null);
  const audioRecorderRef = useRef<MediaRecorder | null>(null);
  const previewChunksRef = useRef<Blob[]>([]);
  const audioChunksRef = useRef<Blob[]>([]);
  const retryAudioRef = useRef<Blob | null>(null);
  const finishInFlightRef = useRef(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const automaticMediaRequestRef = useRef(false);
  const [status, setStatus] = useState<PracticeStatus>('permission');
  const [elapsed, setElapsed] = useState(0);
  const [errorMessage, setErrorMessage] = useState('');
  const [demoMode, setDemoMode] = useState(false);
  const [errorKind, setErrorKind] = useState<'media' | 'save'>('media');
  const [hasRetryAudio, setHasRetryAudio] = useState(false);
  const [starting, setStarting] = useState(false);
  const [setupError, setSetupError] = useState('');
  const [promptValidationActive, setPromptValidationActive] = useState(false);
  const practiceCategories = categories.length > 0 ? categories : ['spontaneous'];
  const goalDefinition = getGoalDefinition(goalTemplateKey);
  const requiresPersonalPrompt = !activeExercise && goalDefinition?.requiresPersonalPrompt === true;
  const isInterviewFollowUp = !activeExercise && goalTemplateKey === 'clarity' && interviewQuestionType === 'follow-up';
  const savedCustomPrompt = customTopic.trim();
  const savedFollowUpPrompt = interviewQuestionType === 'follow-up' ? prompt.trim() : '';
  const [promptDraft, setPromptDraft] = useState(savedCustomPrompt || savedFollowUpPrompt);
  const [promptSaved, setPromptSaved] = useState(Boolean(savedCustomPrompt || savedFollowUpPrompt));
  const promptReady = !requiresPersonalPrompt || (promptSaved && promptDraft.trim().length >= 3);
  const displayedPrompt = !activeExercise && customTopic.trim() ? customTopic.trim() : prompt;
  const visiblePrompt = displayedPrompt || (requiresPersonalPrompt ? 'Enter and save the interview question above.' : 'Choose a question to begin.');
  const categoryTitle = activeExercise
    ? activeExercise.targetSkill
    : requiresPersonalPrompt
      ? 'Experienced manager coaching'
      : categoryOptions.find((category) => category.id === practiceCategories[0])?.title ?? 'Spontaneous thinking';
  const feedbackToApply = orderFeedbackForNextAttempt(redoFeedback);
  const feedbackSteps = goalTemplateKey === 'clarity' ? interviewFeedbackSteps : generalFeedbackSteps;

  function savePrompt() {
    const nextPrompt = promptDraft.trim();
    if (nextPrompt.length < 3) {
      setPromptSaved(false);
      setPromptValidationActive(true);
      setSetupError('Your prompt needs at least 3 characters.');
      return;
    }
    updateSetup({ customTopic: nextPrompt, prompt: nextPrompt });
    setPromptSaved(true);
    setPromptValidationActive(false);
    setSetupError('');
  }

  const stopTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const releaseCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
  }, []);

  useEffect(() => {
    return () => {
      stopTimer();
      releaseCamera();
    };
  }, [releaseCamera, stopTimer]);

  const enableCamera = useCallback(async () => {
    setErrorMessage('');
    setErrorKind('media');
    setStatus('requesting');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true },
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setStatus('ready');
    } catch {
      releaseCamera();
      setErrorMessage('Camera or microphone access was not granted. Update your browser permissions and try again.');
      setStatus('error');
    }
  }, [releaseCamera]);

  const enableAudioOnly = useCallback(async () => {
    setErrorMessage('');
    setErrorKind('media');
    setStatus('requesting');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: false,
        audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true },
      });
      streamRef.current = stream;
      setDemoMode(true);
      setStatus('ready');
    } catch {
      releaseCamera();
      setErrorMessage('Microphone access was not granted. Speech analysis requires an audio recording.');
      setStatus('error');
    }
  }, [releaseCamera]);

  useEffect(() => {
    if (!activeExercise || status !== 'permission' || automaticMediaRequestRef.current) return;
    automaticMediaRequestRef.current = true;
    void enableAudioOnly();
  }, [activeExercise, enableAudioOnly, status]);

  async function startSpeaking() {
    setStarting(true);
    setSetupError('');
    if (isInterviewFollowUp && !interviewPrimaryResponse) {
      setSetupError('The main interview answer is missing. Return to Home and start a new interview.');
      setStarting(false);
      return;
    }
    if (!promptReady) {
      setPromptValidationActive(true);
      setStarting(false);
      window.requestAnimationFrame(() => {
        const promptInput = document.getElementById('practice-prompt');
        promptInput?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        promptInput?.focus({ preventScroll: true });
      });
      return;
    }
    if (!activeExercise && customTopic.trim() && customTopic.trim().length < 3) {
      setSetupError('Your personal prompt needs at least 3 characters.');
      setStarting(false);
      return;
    }
    try {
      if (!activeExercise && !activeSessionId) {
        if (categories.length === 0) updateSetup({ categories: practiceCategories });
        if (customTopic.trim()) updateSetup({ prompt: displayedPrompt });
        const session = await createPracticeSession({
          goalId,
          goalTitle,
          categories: practiceCategories,
          topic: customTopic,
          prompt: displayedPrompt,
        });
        beginSession(session.id);
      }
    } catch (caught) {
      setSetupError(caught instanceof Error ? caught.message : 'The practice session could not be started.');
      setStarting(false);
      return;
    }

    clearRecording();
    previewChunksRef.current = [];
    audioChunksRef.current = [];
    retryAudioRef.current = null;
    setHasRetryAudio(false);
    setElapsed(0);

    if (streamRef.current && typeof MediaRecorder !== 'undefined') {
      const previewRecorder = streamRef.current.getVideoTracks().length
        ? createRecorder(streamRef.current, [
            'video/webm;codecs=vp9,opus',
            'video/webm;codecs=vp8,opus',
            'video/webm',
            'video/mp4',
          ])
        : null;
      const audioStream = new MediaStream(streamRef.current.getAudioTracks());
      const audioRecorder = createRecorder(audioStream, [
        'audio/webm;codecs=opus',
        'audio/webm',
        'audio/mp4',
        'audio/ogg;codecs=opus',
      ], { audioBitsPerSecond: 32_000 });
      previewRecorderRef.current = previewRecorder;
      audioRecorderRef.current = audioRecorder;
      if (previewRecorder) {
        previewRecorder.ondataavailable = (event: BlobEvent) => {
          if (event.data.size > 0) previewChunksRef.current.push(event.data);
        };
      }
      audioRecorder.ondataavailable = (event: BlobEvent) => {
        if (event.data.size > 0) audioChunksRef.current.push(event.data);
      };
      previewRecorder?.start(1000);
      audioRecorder.start(1000);
    }

    setStatus('recording');
    timerRef.current = setInterval(() => setElapsed((current) => current + 1), 1000);
    setStarting(false);
  }

  async function persistResponse(audio: Blob | null) {
    if (!audio) throw new Error('No usable microphone audio was captured. Record your response again.');
    if (activeExercise) {
      const progress = await submitExerciseAttempt({
        exerciseId: activeExercise.id,
        templateId: activeExercise.templateId,
        audio,
        durationSeconds: elapsed,
        attemptNumber: exerciseAttemptNumber,
        attemptType: exerciseStage,
        prompt: displayedPrompt,
        guidance: '',
        difficultyLevel: exerciseDifficultyLevel,
      });
      beginExerciseAttempt(progress.attemptId);
      if (progress.result) completeExerciseAttempt(progress.result);
      return;
    }
    if (!activeSessionId) return;
    const result = await startResponseAnalysis({
      sessionId: activeSessionId,
      prompt: displayedPrompt,
      durationSeconds: elapsed,
      sequenceNumber: answerCount + 1,
      audio,
      goalTemplateKey,
      generateInterviewFollowUp: goalTemplateKey === 'clarity' && interviewQuestionType === 'primary',
      interviewPrimaryResponseId: isInterviewFollowUp ? interviewPrimaryResponse?.responseId : null,
    });
    beginResponse(result.responseId);
    if (result.analysis) completeResponse(result.responseId, result.feedbackIds ?? {}, result.analysis);
  }

  async function doneSpeaking() {
    if (finishInFlightRef.current) return;
    finishInFlightRef.current = true;
    stopTimer();
    setStatus('processing');
    try {
      const [previewBlob, audioBlob] = await Promise.all([
        stopRecorder(previewRecorderRef.current, previewChunksRef.current),
        stopRecorder(audioRecorderRef.current, audioChunksRef.current),
      ]);
      retryAudioRef.current = audioBlob;
      setHasRetryAudio(Boolean(audioBlob));
      if (activeExercise && audioBlob) setRecordingUrl(URL.createObjectURL(audioBlob));
      else if (previewBlob) setRecordingUrl(URL.createObjectURL(previewBlob));
      releaseCamera();
      await persistResponse(audioBlob);
      router.push('/practice/feedback');
    } catch (caught) {
      setErrorKind('save');
      setErrorMessage(caught instanceof Error ? caught.message : 'This response could not be saved.');
      setDemoMode(true);
      setStatus('error');
    } finally {
      finishInFlightRef.current = false;
    }
  }

  async function retrySave() {
    if (finishInFlightRef.current) return;
    finishInFlightRef.current = true;
    setStatus('processing');
    try {
      await persistResponse(retryAudioRef.current);
      router.push('/practice/feedback');
    } catch (caught) {
      setErrorMessage(caught instanceof Error ? caught.message : 'This response could not be saved.');
      setStatus('error');
    } finally {
      finishInFlightRef.current = false;
    }
  }

  async function leaveExercise() {
    if (!activeExercise) return;
    await updateExerciseStatus(activeExercise.id, 'abandoned');
    clearRecording();
    resetSession();
    router.push('/history');
  }

  return (
    <div className="min-h-screen bg-white text-[var(--ink)]">
      <div className="grid h-screen grid-cols-[minmax(0,2fr)_minmax(360px,1fr)]">
        <section className="relative flex min-h-0 items-start justify-center overflow-hidden bg-white px-8 pb-20 pt-7">
          <div className="w-full max-w-[1120px]">
            {activeExercise ? (
              <section className="mb-4 border-b border-[var(--line)] pb-4" aria-labelledby="exercise-prompt-title">
                <p id="exercise-prompt-title" className="text-sm font-semibold uppercase tracking-[0.09em] text-[var(--teal-dark)]">Exercise prompt</p>
                <p className="mt-2 max-w-5xl text-sm font-medium leading-6 text-[var(--ink)]">{visiblePrompt}</p>
              </section>
            ) : isInterviewFollowUp ? (
              <section className="mb-4 rounded-2xl border border-[#d7ccef] bg-[#faf8ff] p-4" aria-labelledby="follow-up-prompt-title">
                <p id="follow-up-prompt-title" className="text-sm font-semibold uppercase tracking-[0.09em] text-[var(--teal-dark)]">Unscripted follow-up</p>
                <p className="mt-2 max-w-5xl text-base font-semibold leading-7 text-[var(--navy)]">{visiblePrompt}</p>
              </section>
            ) : (
              <section
                className={cn(
                  'mb-4 rounded-2xl border p-4 transition-[background-color,border-color,box-shadow] duration-200',
                  promptValidationActive
                    ? 'border-[#d19a29] bg-[#fff9eb] shadow-[0_0_0_4px_rgba(209,154,41,0.12)]'
                    : 'border-transparent border-b-[var(--line)] bg-white',
                )}
                aria-labelledby="prompt-editor-title"
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <label id="prompt-editor-title" htmlFor="practice-prompt" className="text-sm font-semibold uppercase tracking-[0.09em] text-[var(--teal-dark)]">Input your prompt</label>
                    {promptValidationActive && (
                      <p id="prompt-save-note" role="alert" className="mt-1 text-xs font-semibold normal-case tracking-normal text-[#8a5b12]">
                        Save your prompt first
                      </p>
                    )}
                  </div>
                  <Button
                    type="button"
                    onClick={savePrompt}
                    disabled={status === 'recording' || status === 'processing' || promptDraft.trim().length < 3}
                    variant={promptSaved ? 'ghost' : 'default'}
                    className={promptSaved
                      ? 'h-9 shrink-0 px-2 text-[var(--teal-dark)] hover:bg-[var(--mint-soft)] hover:text-[var(--teal-dark)] disabled:text-[var(--muted-ink)]/50'
                      : 'h-9 shrink-0 rounded-lg bg-[var(--navy)] px-4 text-white hover:bg-[#4c1d95] disabled:bg-[var(--line)] disabled:text-[var(--muted-ink)]'}
                  >
                    {promptSaved ? <Check className="size-4" /> : null}
                    {promptSaved ? 'Saved' : 'Save prompt'}
                  </Button>
                </div>
                <Textarea
                  id="practice-prompt"
                  value={promptDraft}
                  onChange={(event) => {
                    setPromptDraft(event.target.value);
                    setPromptSaved(false);
                    setSetupError('');
                  }}
                  aria-invalid={promptValidationActive}
                  aria-describedby={promptValidationActive ? 'prompt-save-note' : undefined}
                  disabled={status === 'recording' || status === 'processing'}
                  maxLength={500}
                  placeholder="Paste the interview question you want to practise"
                  className="mt-2 min-h-14 resize-y rounded-none border-0 bg-transparent px-0 py-2 text-sm leading-6 text-[var(--ink)] shadow-none placeholder:text-[var(--muted-ink)]/65 focus-visible:border-0 focus-visible:ring-0 disabled:opacity-50"
                />
              </section>
            )}

            <div className="relative h-[calc(100vh-230px)] min-h-[420px] max-h-[700px] w-full overflow-hidden rounded-[20px] bg-[#f7f4fc] ring-1 ring-[var(--line)]">
            {!activeExercise && <video ref={videoRef} muted playsInline className="h-full w-full object-cover [transform:scaleX(-1)]" />}

            {(status === 'permission' || status === 'requesting' || status === 'error' || demoMode) && (
              <div className="absolute inset-0 grid place-items-center bg-[radial-gradient(circle_at_50%_25%,#ede9fe_0%,#f7f4fc_42%,#ffffff_100%)]">
                <div className="max-w-md text-center">
                  <div className="mx-auto grid size-16 place-items-center rounded-3xl bg-white text-[var(--teal-dark)] shadow-sm ring-1 ring-[var(--line)]">
                    {activeExercise ? <Mic className="size-7" /> : status === 'error' ? <CameraOff className="size-7" /> : <Camera className="size-7" />}
                  </div>
                  {(status === 'permission' || status === 'requesting') && (
                    <Button onClick={activeExercise ? () => void enableAudioOnly() : enableCamera} disabled={status === 'requesting'} className="mt-6 h-11 rounded-xl bg-[var(--navy)] px-5 text-white hover:bg-[#4c1d95]">
                      {activeExercise ? <Mic className="size-4" /> : <Camera className="size-4" />} {status === 'requesting' ? (activeExercise ? 'Preparing microphone…' : 'Preparing camera…') : (activeExercise ? 'Enable microphone' : 'Enable camera & microphone')}
                    </Button>
                  )}
                  {status === 'error' && errorKind === 'media' && (
                    <>
                      <h1 className="mt-6 font-display text-2xl font-semibold">Permission needed</h1>
                      <p className="mt-2 text-base leading-7 text-[var(--muted-ink)]">{errorMessage}</p>
                      <div className="mt-6 flex justify-center gap-3">
                        <Button onClick={activeExercise ? () => void enableAudioOnly() : enableCamera} className="bg-[var(--navy)] text-white hover:bg-[#4c1d95]">Try again</Button>
                        {!activeExercise && <Button onClick={() => void enableAudioOnly()} variant="outline" className="border-[var(--line)] bg-white text-[var(--ink)] hover:bg-[var(--mint-soft)]">Use microphone only</Button>}
                      </div>
                    </>
                  )}
                  {status === 'error' && errorKind === 'save' && (
                    <>
                      <h1 className="mt-6 font-display text-2xl font-semibold">Couldn’t save this response</h1>
                      <p className="mt-2 text-base leading-7 text-[var(--muted-ink)]">{errorMessage}</p>
                      <div className="mt-6 flex justify-center gap-3">
                        <Button onClick={hasRetryAudio ? () => void retrySave() : () => void enableAudioOnly()} className="bg-[var(--navy)] text-white hover:bg-[#4c1d95]">{hasRetryAudio ? 'Try saving again' : 'Record again'}</Button>
                        {!activeExercise && <Button onClick={() => router.push('/practice/feedback')} variant="outline" className="border-[var(--line)] bg-white text-[var(--ink)] hover:bg-[var(--mint-soft)]">Continue without saving</Button>}
                      </div>
                    </>
                  )}
                </div>
              </div>
            )}

            {status === 'recording' && demoMode && (
              <div className="absolute inset-0 grid place-items-center bg-[radial-gradient(circle_at_50%_25%,#ede9fe_0%,#f7f4fc_42%,#ffffff_100%)]">
                <div className="text-center"><Mic className="mx-auto size-10 text-[var(--teal-dark)]" /><p className="mt-4 text-sm text-[var(--muted-ink)]">Microphone recording in progress</p></div>
              </div>
            )}

            <div className="absolute inset-x-0 top-0 flex items-center justify-between p-5">
              <span className="rounded-full bg-black/45 px-3 py-1.5 text-xs font-medium text-white backdrop-blur">
                {activeExercise ? (exerciseStage === 'transfer' ? 'Independent test' : `Guided attempt ${exerciseAttemptNumber}`) : isInterviewFollowUp ? 'Unscripted follow-up' : `Question ${answerCount + 1}`}
              </span>
              <span className="flex items-center gap-2 rounded-full bg-black/45 px-3 py-1.5 text-xs font-medium text-white backdrop-blur">
                {status === 'recording' ? <><span className="size-2 animate-pulse rounded-full bg-[#ff7668]" />Recording · {formatTime(elapsed)}</> : <><span className="size-2 rounded-full bg-white/45" />Recording off</>}
              </span>
            </div>

            </div>
          </div>

          {status === 'processing' && (
            <div className="absolute inset-0 z-20 grid place-items-center bg-white/85 backdrop-blur-sm">
              <div className="w-[420px] rounded-3xl border border-[var(--line)] bg-white p-8 text-center shadow-2xl">
                <div className="mx-auto grid size-14 place-items-center rounded-2xl bg-[var(--mint-soft)] text-[var(--teal-dark)]">
                  <Sparkles className="size-6 animate-pulse" />
                </div>
                <h2 className="mt-5 font-display text-2xl font-semibold">Preparing your feedback</h2>
                <p className="mt-2 text-base leading-7 text-[var(--muted-ink)]">Reviewing your transcript, speaking pace, vocabulary, structure, and reasoning.</p>
                <div className="mt-6 h-1.5 overflow-hidden rounded-full bg-[var(--line)]"><div className="h-full w-3/4 animate-pulse rounded-full bg-[var(--teal)]" /></div>
              </div>
            </div>
          )}

          <div className="absolute bottom-7 left-1/2 z-10 w-full max-w-sm -translate-x-1/2 px-6">
            {setupError && <p role="alert" className="mb-2 rounded-xl bg-[#8f4336]/90 px-3 py-2 text-center text-xs leading-5 text-[#ffd3cc] shadow-lg backdrop-blur">{setupError}</p>}
            {status === 'ready' && (
              <Button onClick={() => void startSpeaking()} disabled={starting} size="lg" className="mx-auto h-12 min-w-56 rounded-xl bg-[var(--navy)] px-7 text-white shadow-xl hover:bg-[#4c1d95] disabled:bg-[var(--line)] disabled:text-[var(--muted-ink)]">
                <Mic className="size-4" /> {starting ? 'Preparing session…' : isInterviewFollowUp ? 'Start follow-up' : 'Start speaking'}
              </Button>
            )}
            {status === 'recording' && (
              <Button onClick={doneSpeaking} size="lg" className="mx-auto h-12 min-w-56 rounded-xl bg-[#e16d5d] px-7 text-white shadow-xl hover:bg-[#c95d50]">
                <Square className="size-4 fill-current" /> Done speaking
              </Button>
            )}
            {(status === 'permission' || status === 'requesting' || status === 'error') && (
              <Button disabled size="lg" className="mx-auto h-12 min-w-56 rounded-xl bg-[var(--line)] px-7 text-[var(--muted-ink)] shadow-sm">{status === 'requesting' ? (activeExercise ? 'Preparing microphone…' : 'Preparing camera…') : 'Start speaking'}</Button>
            )}
          </div>
        </section>

        <aside className="flex min-h-0 flex-col border-l border-[var(--line)] bg-white p-7">
          {activeExercise && (
            <>
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.13em] text-[var(--teal-dark)]">{exerciseStage === 'transfer' ? 'Independent transfer test' : `Personalized exercise · Attempt ${exerciseAttemptNumber}`}</p>
                <h2 className="mt-3 font-display text-2xl font-semibold tracking-[-0.03em]">{activeExercise.title}</h2>
                <p className="mt-2 text-sm leading-6 text-[var(--muted-ink)]"><span className="font-semibold text-[var(--ink)]">{categoryTitle}:</span> {activeExercise.targetBehavior}</p>
              </div>
              <div className="my-7 h-px bg-[var(--line)]" />
            </>
          )}

          <div className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto pr-1">
            {activeExercise ? (
              <>
                <div className="flex min-h-0 flex-1 flex-col">
                  <label htmlFor="exercise-reasoning" className="font-display text-2xl font-semibold tracking-[-0.03em] text-[var(--ink)]">Plan your reasoning</label>
                  <p className="mt-2 text-sm leading-6 text-[var(--muted-ink)]">Map the direct answer, supporting logic, evidence, and conclusion you want to communicate.</p>
                  <Textarea
                    id="exercise-reasoning"
                    value={answerNotes}
                    onChange={(event) => updateSetup({ answerNotes: event.target.value })}
                    disabled={status === 'processing'}
                    maxLength={2000}
                    placeholder={'Direct answer\n\n• First reason\n• Second reason\n• Evidence or example\n\nClear conclusion'}
                    className="mt-5 min-h-[360px] flex-1 resize-none rounded-none border-0 bg-transparent px-0 py-1 text-sm leading-6 text-[var(--ink)] shadow-none placeholder:text-[var(--muted-ink)]/60 focus-visible:ring-0 disabled:opacity-50"
                  />
                  <div className="mt-2 flex items-center justify-between gap-4 text-[11px] leading-4 text-[var(--muted-ink)]">
                    <p>Private notes for this attempt. They aren’t saved or included in your coaching.</p>
                    <p className="shrink-0">Difficulty {exerciseDifficultyLevel} of 3</p>
                  </div>
                </div>
                {exerciseStage === 'transfer' && (
                  <div className="border-t border-[var(--line)] pt-5">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.11em] text-[var(--muted-ink)]">No coaching hints</p>
                    <p className="mt-2 text-xs leading-5 text-[var(--ink)]">Apply the skill independently to this unfamiliar question.</p>
                  </div>
                )}
              </>
            ) : isInterviewFollowUp ? (
              <div className="flex min-h-0 flex-1 flex-col justify-center">
                <div className="rounded-2xl border border-[#d7ccef] bg-[#faf8ff] p-6">
                  <p className="text-xs font-semibold uppercase tracking-[0.11em] text-[var(--teal-dark)]">Answer in the moment</p>
                  <h2 className="mt-3 font-display text-2xl font-semibold tracking-[-0.03em] text-[var(--navy)]">Treat it like a real interviewer follow-up</h2>
                  <p className="mt-3 text-sm leading-6 text-[var(--muted-ink)]">Respond naturally without scripting. Start with the direct answer, then add the most relevant evidence or reflection.</p>
                  <p className="mt-5 rounded-xl bg-white px-4 py-3 text-xs leading-5 text-[#5f4f72]">Your final feedback will evaluate this follow-up together with your main answer.</p>
                </div>
              </div>
            ) : (
              <div className="flex min-h-0 flex-1 flex-col">
                {redoFeedback.length > 0 && (
                  <section className="mb-7 rounded-2xl bg-[#faf8ff] p-5" aria-labelledby="feedback-to-apply-title">
                    <div className="flex items-center justify-between gap-4">
                      <p id="feedback-to-apply-title" className="text-xs font-semibold uppercase tracking-[0.11em] text-[var(--teal-dark)]">Feedback to apply</p>
                      <span className="rounded-full bg-white px-2.5 py-1 text-[10px] font-semibold text-[var(--muted-ink)] shadow-sm">{feedbackToApply.length} cues</span>
                    </div>
                    <p className="mt-2 text-sm leading-6 text-[var(--muted-ink)]">Keep these priorities in mind as you answer again.</p>
                    <ol className="mt-5 space-y-5">
                      {feedbackToApply.map((item, index) => {
                        const corrections = getFeedbackCorrections(item);
                        return (
                          <li key={item.id} className="flex items-start gap-3 text-sm leading-6 text-[var(--ink)]">
                            <span className={cn(
                              'mt-0.5 grid size-6 shrink-0 place-items-center rounded-full text-[10px] font-semibold',
                              item.positive ? 'bg-[var(--mint-soft)] text-[var(--teal-dark)]' : 'bg-[var(--amber-soft)] text-[#805d1c]',
                            )}>{item.positive ? <Check className="size-3.5" /> : index + 1}</span>
                            <div className="min-w-0">
                              <strong className={cn('block font-semibold', item.positive ? 'text-[var(--teal-dark)]' : 'text-[#805d1c]')}>{feedbackSteps[item.dimension]}</strong>
                              <p className="mt-0.5 text-[var(--ink)]">{item.title}</p>
                              {corrections.length > 0 && (
                                <div className="mt-2 space-y-2 text-[var(--muted-ink)]">
                                  {corrections.map((correction, correctionIndex) => (
                                    <p key={`${correction.suggestion}-${correctionIndex}`}><span className="font-semibold text-[var(--ink)]">{item.dimension === 'Vocabulary' ? 'Use:' : 'Try:'}</span> {correction.suggestion}</p>
                                  ))}
                                </div>
                              )}
                              {corrections.length > 0 && (
                                <details className="mt-2 text-xs text-[var(--muted-ink)]">
                                  <summary className="w-fit cursor-pointer font-medium hover:text-[var(--ink)]">See original wording</summary>
                                  <div className="mt-2 space-y-1.5 rounded-xl bg-white px-3 py-2.5">
                                    {corrections.map((correction, correctionIndex) => (
                                      <p key={`${correction.evidence}-${correctionIndex}`}>“{correction.evidence}”</p>
                                    ))}
                                  </div>
                                </details>
                              )}
                            </div>
                          </li>
                        );
                      })}
                    </ol>
                  </section>
                )}

                <div className="flex min-h-0 flex-1 flex-col">
                  <label htmlFor="answer-notes" className="font-display text-2xl font-semibold tracking-[-0.03em] text-[var(--ink)]">Plan your reasoning</label>
                  <p className="mt-2 text-sm leading-6 text-[var(--muted-ink)]">Map the direct answer, supporting logic, evidence, and conclusion you want the interviewer to hear.</p>
                  <Textarea
                    id="answer-notes"
                    value={answerNotes}
                    onChange={(event) => updateSetup({ answerNotes: event.target.value })}
                    maxLength={2000}
                    placeholder={'Direct answer\n\n• First reason\n• Second reason\n• Evidence or example\n\nClear conclusion'}
                    className="mt-5 min-h-[360px] flex-1 resize-none rounded-none border-0 bg-transparent px-0 py-1 text-sm leading-6 text-[var(--ink)] shadow-none placeholder:text-[var(--muted-ink)]/60 focus-visible:ring-0"
                  />
                  <p className="mt-2 text-[11px] leading-4 text-[var(--muted-ink)]">Private notes for this answer. They aren’t saved or included in your coaching.</p>
                </div>
              </div>
            )}
          </div>

          <div className="mt-5 flex items-center justify-end gap-3">
            {activeExercise && <button onClick={() => void leaveExercise()} disabled={status === 'recording' || status === 'processing'} className="w-full py-2 text-xs font-medium text-[var(--muted-ink)] hover:text-[var(--ink)] disabled:opacity-40">Stop exercise</button>}
            {!activeExercise && !isInterviewFollowUp && activeSessionId && answerCount > 0 && <button onClick={() => router.push('/session/summary')} disabled={status === 'recording' || status === 'processing'} className="flex w-full items-center justify-center gap-1 py-2 text-xs font-medium text-[var(--muted-ink)] hover:text-[var(--ink)] disabled:opacity-40">End session <ChevronRight className="size-3.5" /></button>}
            {!activeExercise && (
              <Link href="/goals" className="inline-flex h-10 shrink-0 items-center gap-2 rounded-lg border border-[var(--line)] px-4 text-xs font-semibold text-[var(--ink)] transition-colors hover:border-[#b9a6df] hover:bg-[var(--mint-soft)]">
                <X className="size-3.5" /> Exit interview
              </Link>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}

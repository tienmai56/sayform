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

function stopRecorder(recorder: MediaRecorder | null, chunks: Blob[]) {
  if (!recorder || recorder.state === 'inactive') return Promise.resolve<Blob | null>(null);
  return new Promise<Blob | null>((resolve) => {
    recorder.addEventListener('stop', () => {
      resolve(chunks.length ? new Blob(chunks, { type: recorder.mimeType }) : null);
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
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const automaticMediaRequestRef = useRef(false);
  const [status, setStatus] = useState<PracticeStatus>('permission');
  const [elapsed, setElapsed] = useState(0);
  const [errorMessage, setErrorMessage] = useState('');
  const [demoMode, setDemoMode] = useState(false);
  const [errorKind, setErrorKind] = useState<'media' | 'save'>('media');
  const [starting, setStarting] = useState(false);
  const [setupError, setSetupError] = useState('');
  const practiceCategories = categories.length > 0 ? categories : ['spontaneous'];
  const goalDefinition = getGoalDefinition(goalTemplateKey);
  const requiresPersonalPrompt = !activeExercise && goalDefinition?.requiresPersonalPrompt === true;
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
      setSetupError('Your prompt needs at least 3 characters.');
      return;
    }
    updateSetup({ customTopic: nextPrompt, prompt: nextPrompt });
    setPromptSaved(true);
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
    if (!promptReady) {
      setSetupError(promptDraft.trim().length >= 3 ? 'Save your interview question before starting.' : 'Enter the interview question you want to practise before starting.');
      setStarting(false);
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
    if (!audio) throw new Error('A microphone recording is required for speech analysis.');
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
    });
    beginResponse(result.responseId);
    if (result.analysis) completeResponse(result.responseId, result.feedbackIds ?? {}, result.analysis);
  }

  async function doneSpeaking() {
    stopTimer();
    setStatus('processing');
    try {
      const [previewBlob, audioBlob] = await Promise.all([
        stopRecorder(previewRecorderRef.current, previewChunksRef.current),
        stopRecorder(audioRecorderRef.current, audioChunksRef.current),
      ]);
      retryAudioRef.current = audioBlob;
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
    }
  }

  async function retrySave() {
    setStatus('processing');
    try {
      await persistResponse(retryAudioRef.current);
      router.push('/practice/feedback');
    } catch (caught) {
      setErrorMessage(caught instanceof Error ? caught.message : 'This response could not be saved.');
      setStatus('error');
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
    <div className="min-h-screen bg-[#0e222d] text-white">
      <div className="grid h-screen grid-cols-[minmax(0,2fr)_minmax(360px,1fr)]">
        <section className="relative flex min-h-0 items-start justify-center overflow-hidden bg-[#0a1921] px-8 pb-20 pt-7">
          <div className="w-full max-w-[1120px]">
            {!activeExercise && (
              <section className="mb-4 border-b border-white/10 pb-4" aria-labelledby="prompt-editor-title">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <label id="prompt-editor-title" htmlFor="practice-prompt" className="text-sm font-semibold uppercase tracking-[0.09em] text-[var(--mint)]">Input your prompt</label>
                  </div>
                  <Button
                    type="button"
                    onClick={savePrompt}
                    disabled={status === 'recording' || status === 'processing' || promptDraft.trim().length < 3}
                    variant={promptSaved ? 'ghost' : 'default'}
                    className={promptSaved
                      ? 'h-9 shrink-0 px-2 text-[var(--mint)] hover:bg-white/5 hover:text-[var(--mint)] disabled:text-white/35'
                      : 'h-9 shrink-0 rounded-lg bg-white px-4 text-[var(--navy)] hover:bg-[var(--mint-soft)] disabled:bg-white/10 disabled:text-white/35'}
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
                  }}
                  disabled={status === 'recording' || status === 'processing'}
                  maxLength={500}
                  placeholder="Paste the interview question you want to practise"
                  className="mt-2 min-h-14 resize-y rounded-none border-0 bg-transparent px-0 py-2 text-sm leading-6 text-white shadow-none placeholder:text-white/30 focus-visible:border-0 focus-visible:ring-0 disabled:opacity-50"
                />
              </section>
            )}

            <div className="relative aspect-video w-full overflow-hidden rounded-[20px] bg-[#152c37] ring-1 ring-white/10">
            {!activeExercise && <video ref={videoRef} muted playsInline className="h-full w-full object-cover [transform:scaleX(-1)]" />}

            {(status === 'permission' || status === 'requesting' || status === 'error' || demoMode) && (
              <div className="absolute inset-0 grid place-items-center bg-[radial-gradient(circle_at_50%_25%,#244858_0%,#152c37_42%,#10242e_100%)]">
                <div className="max-w-md text-center">
                  <div className="mx-auto grid size-16 place-items-center rounded-3xl bg-white/10 text-[var(--mint)] ring-1 ring-white/10">
                    {activeExercise ? <Mic className="size-7" /> : status === 'error' ? <CameraOff className="size-7" /> : <Camera className="size-7" />}
                  </div>
                  {(status === 'permission' || status === 'requesting') && (
                    <Button onClick={activeExercise ? () => void enableAudioOnly() : enableCamera} disabled={status === 'requesting'} className="mt-6 h-11 rounded-xl bg-white px-5 text-[var(--navy)] hover:bg-[var(--mint-soft)]">
                      {activeExercise ? <Mic className="size-4" /> : <Camera className="size-4" />} {status === 'requesting' ? (activeExercise ? 'Preparing microphone…' : 'Preparing camera…') : (activeExercise ? 'Enable microphone' : 'Enable camera & microphone')}
                    </Button>
                  )}
                  {status === 'error' && errorKind === 'media' && (
                    <>
                      <h1 className="mt-6 font-display text-2xl font-semibold">Permission needed</h1>
                      <p className="mt-2 text-sm leading-6 text-white/60">{errorMessage}</p>
                      <div className="mt-6 flex justify-center gap-3">
                        <Button onClick={activeExercise ? () => void enableAudioOnly() : enableCamera} className="bg-white text-[var(--navy)] hover:bg-[var(--mint-soft)]">Try again</Button>
                        {!activeExercise && <Button onClick={() => void enableAudioOnly()} variant="outline" className="border-white/20 bg-white/5 text-white hover:bg-white/10">Use microphone only</Button>}
                      </div>
                    </>
                  )}
                  {status === 'error' && errorKind === 'save' && (
                    <>
                      <h1 className="mt-6 font-display text-2xl font-semibold">Couldn’t save this response</h1>
                      <p className="mt-2 text-sm leading-6 text-white/60">{errorMessage}</p>
                      <div className="mt-6 flex justify-center gap-3">
                        <Button onClick={() => void retrySave()} className="bg-white text-[var(--navy)] hover:bg-[var(--mint-soft)]">Try saving again</Button>
                        <Button onClick={() => router.push('/practice/feedback')} variant="outline" className="border-white/20 bg-white/5 text-white hover:bg-white/10">Continue without saving</Button>
                      </div>
                    </>
                  )}
                </div>
              </div>
            )}

            {status === 'recording' && demoMode && (
              <div className="absolute inset-0 grid place-items-center bg-[radial-gradient(circle_at_50%_25%,#244858_0%,#152c37_42%,#10242e_100%)]">
                <div className="text-center"><Mic className="mx-auto size-10 text-[var(--mint)]" /><p className="mt-4 text-sm text-white/65">Microphone recording in progress</p></div>
              </div>
            )}

            <div className="absolute inset-x-0 top-0 flex items-center justify-between p-5">
              <span className="rounded-full bg-black/35 px-3 py-1.5 text-xs font-medium backdrop-blur">
                {activeExercise ? (exerciseStage === 'transfer' ? 'Independent test' : `Guided attempt ${exerciseAttemptNumber}`) : `Question ${answerCount + 1}`}
              </span>
              <span className="flex items-center gap-2 rounded-full bg-black/35 px-3 py-1.5 text-xs font-medium backdrop-blur">
                {status === 'recording' ? <><span className="size-2 animate-pulse rounded-full bg-[#ff7668]" />Recording · {formatTime(elapsed)}</> : <><span className="size-2 rounded-full bg-white/45" />Recording off</>}
              </span>
            </div>

            {activeExercise && <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-[#07161d] via-[#07161d]/85 to-transparent px-6 pb-6 pt-16">
              <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--mint)]">Exercise prompt</p>
              <p className="mt-2 max-w-4xl font-display text-lg font-medium leading-7">{visiblePrompt}</p>
            </div>}
            </div>
          </div>

          {status === 'processing' && (
            <div className="absolute inset-0 z-20 grid place-items-center bg-[#09171e]/85 backdrop-blur-sm">
              <div className="w-[420px] rounded-3xl border border-white/10 bg-[#132b36] p-8 text-center shadow-2xl">
                <div className="mx-auto grid size-14 place-items-center rounded-2xl bg-[var(--mint-soft)] text-[var(--teal-dark)]">
                  <Sparkles className="size-6 animate-pulse" />
                </div>
                <h2 className="mt-5 font-display text-2xl font-semibold">Preparing your feedback</h2>
                <p className="mt-2 text-sm leading-6 text-white/55">Reviewing your transcript, speaking pace, vocabulary, structure, and reasoning.</p>
                <div className="mt-6 h-1.5 overflow-hidden rounded-full bg-white/10"><div className="h-full w-3/4 animate-pulse rounded-full bg-[var(--mint)]" /></div>
              </div>
            </div>
          )}

          <div className="absolute bottom-7 left-1/2 z-10 w-full max-w-sm -translate-x-1/2 px-6">
            {setupError && <p role="alert" className="mb-2 rounded-xl bg-[#8f4336]/90 px-3 py-2 text-center text-xs leading-5 text-[#ffd3cc] shadow-lg backdrop-blur">{setupError}</p>}
            {status === 'ready' && (
              <Button onClick={() => void startSpeaking()} disabled={starting || !promptReady} size="lg" className="mx-auto h-12 min-w-56 rounded-xl bg-[#f4f0e4] px-7 text-[var(--navy)] shadow-xl hover:bg-white disabled:bg-white/10 disabled:text-white/35">
                <Mic className="size-4" /> {starting ? 'Preparing session…' : 'Start speaking'}
              </Button>
            )}
            {status === 'recording' && (
              <Button onClick={doneSpeaking} size="lg" className="mx-auto h-12 min-w-56 rounded-xl bg-[#e16d5d] px-7 text-white shadow-xl hover:bg-[#c95d50]">
                <Square className="size-4 fill-current" /> Done speaking
              </Button>
            )}
            {(status === 'permission' || status === 'requesting' || status === 'error') && (
              <Button disabled size="lg" className="mx-auto h-12 min-w-56 rounded-xl bg-white/10 px-7 text-white/45 shadow-xl backdrop-blur">{status === 'requesting' ? (activeExercise ? 'Preparing microphone…' : 'Preparing camera…') : 'Start speaking'}</Button>
            )}
          </div>
        </section>

        <aside className="flex min-h-0 flex-col border-l border-white/10 bg-[#102630] p-7">
          {activeExercise && (
            <>
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.13em] text-[var(--mint)]">{exerciseStage === 'transfer' ? 'Independent transfer test' : `Personalized exercise · Attempt ${exerciseAttemptNumber}`}</p>
                <p className="mt-2 text-sm font-semibold text-white/80">{categoryTitle}</p>
                <h2 className="mt-4 font-display text-2xl font-semibold tracking-[-0.03em]">{activeExercise.title}</h2>
              </div>
              <div className="my-7 h-px bg-white/10" />
            </>
          )}

          <div className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto pr-1">
            {activeExercise ? (
              <>
                <div className="border-b border-white/10 pb-5">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.11em] text-[var(--mint)]">Target skill</p>
                  <p className="mt-2 text-sm font-semibold text-white/90">{activeExercise.targetSkill}</p>
                  <p className="mt-2 text-xs leading-5 text-white/55">{activeExercise.targetBehavior}</p>
                </div>
                <div>
                  <label htmlFor="exercise-reasoning" className="text-xs font-semibold text-white/75">Your reasoning</label>
                  <p className="mt-2 text-[11px] leading-4 text-white/40">Outline the answer, evidence, and conclusion you want to communicate.</p>
                  <Textarea
                    id="exercise-reasoning"
                    value={answerNotes}
                    onChange={(event) => updateSetup({ answerNotes: event.target.value })}
                    disabled={status === 'recording' || status === 'processing'}
                    maxLength={2000}
                    placeholder={'Direct answer\n\n• Supporting reason\n• Evidence or example\n\nClear conclusion'}
                    className="mt-4 min-h-40 resize-y rounded-none border-0 bg-transparent px-0 py-1 text-xs leading-5 text-white shadow-none placeholder:text-white/30 focus-visible:ring-0 disabled:opacity-50"
                  />
                  <p className="mt-2 text-[11px] leading-4 text-white/40">Private planning notes. They do not change the exercise prompt or appear in your coaching.</p>
                  <p className="mt-2 text-[10px] text-white/35">Difficulty level {exerciseDifficultyLevel} of 3</p>
                </div>
                {exerciseStage === 'transfer' && (
                  <div className="border-t border-white/10 pt-5">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.11em] text-white/45">No coaching hints</p>
                    <p className="mt-2 text-xs leading-5 text-white/65">Apply the skill independently to this unfamiliar question.</p>
                  </div>
                )}
              </>
            ) : (
              <div className="flex min-h-0 flex-1 flex-col">
                {redoFeedback.length > 0 && (
                  <div className="mb-6 border-l-2 border-[#d9aa45]/70 pl-4">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.11em] text-[#f1ca72]">Feedback to apply</p>
                    <ol className="mt-3 space-y-4">
                      {feedbackToApply.map((item, index) => {
                        const corrections = getFeedbackCorrections(item);
                        return (
                          <li key={item.id} className="flex items-start gap-2.5 text-xs leading-5 text-white/75">
                            <span className="mt-0.5 grid size-5 shrink-0 place-items-center rounded-full bg-[#f1ca72]/15 text-[10px] font-semibold text-[#f1ca72]">{index + 1}</span>
                            <span className="min-w-0">
                              <strong className="block font-semibold text-[#f1ca72]">{feedbackSteps[item.dimension]}</strong>
                              <span className="mt-0.5 block font-medium text-white/90">{item.title}</span>
                              {corrections.map((correction, correctionIndex) => (
                                <span key={`${correction.evidence}-${correctionIndex}`} className="mt-1.5 block border-l border-white/15 pl-2.5">
                                  <span className="block text-white/45"><span className="font-semibold text-white/65">Avoid:</span> “{correction.evidence}”</span>
                                  <span className="mt-0.5 block text-white/70"><span className="font-semibold text-white/90">{item.dimension === 'Vocabulary' ? 'Use:' : 'Try:'}</span> {correction.suggestion}</span>
                                </span>
                              ))}
                            </span>
                          </li>
                        );
                      })}
                    </ol>
                  </div>
                )}

                <div className="flex min-h-0 flex-1 flex-col">
                  <label htmlFor="answer-notes" className="font-display text-2xl font-semibold tracking-[-0.03em] text-white">Plan your reasoning</label>
                  <p className="mt-2 text-xs leading-5 text-white/45">Map the direct answer, supporting logic, evidence, and conclusion you want the interviewer to hear.</p>
                  <Textarea
                    id="answer-notes"
                    value={answerNotes}
                    onChange={(event) => updateSetup({ answerNotes: event.target.value })}
                    maxLength={2000}
                    placeholder={'Direct answer\n\n• First reason\n• Second reason\n• Evidence or example\n\nClear conclusion'}
                    className="mt-5 min-h-[360px] flex-1 resize-none rounded-none border-0 bg-transparent px-0 py-1 text-sm leading-6 text-white shadow-none placeholder:text-white/30 focus-visible:ring-0"
                  />
                  <p className="mt-2 text-[11px] leading-4 text-white/40">Private notes for this answer. They aren’t saved or included in your coaching.</p>
                </div>
              </div>
            )}
          </div>

          <div className="mt-5 flex items-center justify-end gap-3">
            {activeExercise && <button onClick={() => void leaveExercise()} disabled={status === 'recording' || status === 'processing'} className="w-full py-2 text-xs font-medium text-white/45 hover:text-white disabled:opacity-40">Stop exercise</button>}
            {!activeExercise && activeSessionId && answerCount > 0 && <button onClick={() => router.push('/session/summary')} disabled={status === 'recording' || status === 'processing'} className="flex w-full items-center justify-center gap-1 py-2 text-xs font-medium text-white/45 hover:text-white disabled:opacity-40">End session <ChevronRight className="size-3.5" /></button>}
            {!activeExercise && (
              <Link href="/goals" className="inline-flex h-10 shrink-0 items-center gap-2 rounded-lg border border-white/15 px-4 text-xs font-semibold text-white/70 transition-colors hover:border-white/30 hover:bg-white/5 hover:text-white">
                <X className="size-3.5" /> Exit interview
              </Link>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}

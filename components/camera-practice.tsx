'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Camera,
  CameraOff,
  Check,
  ChevronRight,
  Clock3,
  Lightbulb,
  Mic,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  Square,
} from 'lucide-react';
import { Brand } from '@/components/app-shell';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { usePractice } from '@/components/practice-context';
import { getPracticeQuestions } from '@/lib/goal-catalog';
import { categories as categoryOptions } from '@/lib/mock-data';
import { completeExercise, createPracticeSession, saveAndAnalyzeResponse } from '@/lib/client-data';
import { cn } from '@/lib/utils';

type PracticeStatus = 'permission' | 'ready' | 'recording' | 'processing' | 'error';

function formatTime(totalSeconds: number) {
  const minutes = Math.floor(totalSeconds / 60).toString().padStart(2, '0');
  const seconds = (totalSeconds % 60).toString().padStart(2, '0');
  return `${minutes}:${seconds}`;
}

export function CameraPractice() {
  const router = useRouter();
  const {
    activeExercise,
    activeSessionId,
    answerCount,
    beginSession,
    categories,
    completeResponse,
    customTopic,
    goalId,
    goalSkills,
    goalTemplateKey,
    goalTitle,
    prompt,
    setRecordingUrl,
    clearRecording,
    updateSetup,
  } = usePractice();
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [status, setStatus] = useState<PracticeStatus>('permission');
  const [elapsed, setElapsed] = useState(0);
  const [errorMessage, setErrorMessage] = useState('');
  const [demoMode, setDemoMode] = useState(false);
  const [errorKind, setErrorKind] = useState<'media' | 'save'>('media');
  const [starting, setStarting] = useState(false);
  const [setupError, setSetupError] = useState('');

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

  async function enableCamera() {
    setErrorMessage('');
    setErrorKind('media');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: true,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setStatus('ready');
    } catch {
      setErrorMessage('Camera or microphone access was not granted. Update your browser permissions and try again.');
      setStatus('error');
    }
  }

  function useDemoMode() {
    setDemoMode(true);
    setErrorMessage('');
    setStatus('ready');
  }

  async function startSpeaking() {
    if (!activeExercise && categories.length === 0) {
      setSetupError('Choose at least one practice category.');
      return;
    }
    setStarting(true);
    setSetupError('');
    try {
      if (!activeExercise && !activeSessionId) {
        const session = await createPracticeSession({
          goalId,
          goalTitle,
          categories,
          topic: customTopic,
          prompt,
        });
        beginSession(session.id);
      }
    } catch (caught) {
      setSetupError(caught instanceof Error ? caught.message : 'The practice session could not be started.');
      setStarting(false);
      return;
    }

    clearRecording();
    chunksRef.current = [];
    setElapsed(0);

    if (streamRef.current && typeof MediaRecorder !== 'undefined') {
      const recorder = new MediaRecorder(streamRef.current);
      recorderRef.current = recorder;
      recorder.ondataavailable = (event: BlobEvent) => {
        if (event.data.size > 0) chunksRef.current.push(event.data);
      };
      recorder.onstop = () => {
        if (chunksRef.current.length > 0) {
          const blob = new Blob(chunksRef.current, { type: recorder.mimeType || 'video/webm' });
          setRecordingUrl(URL.createObjectURL(blob));
        }
      };
      recorder.start();
    }

    setStatus('recording');
    timerRef.current = setInterval(() => setElapsed((current) => current + 1), 1000);
    setStarting(false);
  }

  async function persistResponse() {
    if (activeExercise) {
      await completeExercise(activeExercise.id);
      return;
    }
    if (!activeSessionId) return;
    const result = await saveAndAnalyzeResponse({
      sessionId: activeSessionId,
      prompt,
      durationSeconds: elapsed,
      sequenceNumber: answerCount + 1,
    });
    completeResponse(result.responseId, result.feedbackIds);
  }

  async function doneSpeaking() {
    stopTimer();
    if (recorderRef.current?.state === 'recording') recorderRef.current.stop();
    releaseCamera();
    setStatus('processing');
    try {
      await Promise.all([
        persistResponse(),
        new Promise((resolve) => window.setTimeout(resolve, 900)),
      ]);
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
      await persistResponse();
      router.push('/practice/feedback');
    } catch (caught) {
      setErrorMessage(caught instanceof Error ? caught.message : 'This response could not be saved.');
      setStatus('error');
    }
  }

  async function tryAnotherQuestion() {
    const questions = getPracticeQuestions(goalTemplateKey);
    const index = questions.indexOf(prompt);
    updateSetup({ prompt: questions[(index + 1) % questions.length] });
  }

  function toggleCategory(categoryId: string) {
    const next = categories.includes(categoryId)
      ? categories.filter((category) => category !== categoryId)
      : [...categories, categoryId];
    updateSetup({ categories: next });
    setSetupError('');
  }

  return (
    <main className="min-h-screen bg-[#0e222d] text-white">
      <header className="flex h-[72px] items-center justify-between border-b border-white/10 px-7">
        <div className="[&_span:first-child]:bg-white [&_span:first-child]:text-[var(--navy)] [&_span:last-child]:text-white">
          <Brand />
        </div>
        <div className="flex items-center gap-3">
          <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-white/65">Goal · {goalTitle}</span>
          {!activeExercise && activeSessionId && answerCount > 0 && <Button variant="ghost" onClick={() => router.push('/session/summary')} className="text-white/65 hover:bg-white/10 hover:text-white">End session</Button>}
        </div>
      </header>

      <div className="grid h-[calc(100vh-72px)] grid-cols-[minmax(0,1fr)_390px]">
        <section className="relative flex min-h-0 items-center justify-center overflow-hidden bg-[#0a1921] p-8">
          <div className="relative aspect-video w-full max-w-[1120px] overflow-hidden rounded-[28px] border border-white/10 bg-[#152c37] shadow-2xl">
            <video ref={videoRef} muted playsInline className="h-full w-full object-cover [transform:scaleX(-1)]" />

            {(status === 'permission' || status === 'error' || demoMode) && (
              <div className="absolute inset-0 grid place-items-center bg-[radial-gradient(circle_at_50%_25%,#244858_0%,#152c37_42%,#10242e_100%)]">
                <div className="max-w-md text-center">
                  <div className="mx-auto grid size-16 place-items-center rounded-3xl bg-white/10 text-[var(--mint)] ring-1 ring-white/10">
                    {status === 'error' ? <CameraOff className="size-7" /> : <Camera className="size-7" />}
                  </div>
                  {status === 'permission' && (
                    <>
                      <h1 className="mt-6 font-display text-2xl font-semibold tracking-[-0.03em]">Set up your camera</h1>
                      <p className="mt-2 text-sm leading-6 text-white/60">Your recording stays in this browser and is available only for the immediate feedback view.</p>
                      <Button onClick={enableCamera} className="mt-6 h-11 rounded-xl bg-white px-5 text-[var(--navy)] hover:bg-[var(--mint-soft)]">
                        <Camera className="size-4" /> Enable camera & microphone
                      </Button>
                    </>
                  )}
                  {status === 'error' && errorKind === 'media' && (
                    <>
                      <h1 className="mt-6 font-display text-2xl font-semibold">Permission needed</h1>
                      <p className="mt-2 text-sm leading-6 text-white/60">{errorMessage}</p>
                      <div className="mt-6 flex justify-center gap-3">
                        <Button onClick={enableCamera} className="bg-white text-[var(--navy)] hover:bg-[var(--mint-soft)]">Try again</Button>
                        <Button onClick={useDemoMode} variant="outline" className="border-white/20 bg-white/5 text-white hover:bg-white/10">Use prototype without camera</Button>
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
                  {demoMode && status !== 'recording' && (
                    <>
                      <h1 className="mt-6 font-display text-2xl font-semibold">Prototype camera</h1>
                      <p className="mt-2 text-sm text-white/60">Camera preview is off. The practice controls and mock coaching flow remain available.</p>
                    </>
                  )}
                </div>
              </div>
            )}

            {status === 'recording' && demoMode && (
              <div className="absolute inset-0 grid place-items-center bg-[radial-gradient(circle_at_50%_25%,#244858_0%,#152c37_42%,#10242e_100%)]">
                <div className="text-center"><Mic className="mx-auto size-10 text-[var(--mint)]" /><p className="mt-4 text-sm text-white/65">Prototype recording in progress</p></div>
              </div>
            )}

            <div className="absolute inset-x-0 top-0 flex items-center justify-between p-5">
              <span className="rounded-full bg-black/35 px-3 py-1.5 text-xs font-medium backdrop-blur">
                {activeExercise ? 'Targeted exercise' : `Question ${answerCount + 1}`}
              </span>
              <span className="flex items-center gap-2 rounded-full bg-black/35 px-3 py-1.5 text-xs font-medium backdrop-blur">
                {status === 'recording' ? <><span className="size-2 animate-pulse rounded-full bg-[#ff7668]" />Recording · {formatTime(elapsed)}</> : <><span className="size-2 rounded-full bg-white/45" />Recording off</>}
              </span>
            </div>

            <div className="absolute inset-x-5 bottom-5 rounded-2xl border border-white/10 bg-[#07161d]/80 p-5 backdrop-blur-md">
              <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--mint)]">Your prompt</p>
              <p className="mt-2 max-w-4xl font-display text-lg font-medium leading-7">{prompt}</p>
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
        </section>

        <aside className="flex min-h-0 flex-col border-l border-white/10 bg-[#102630] p-7">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.13em] text-[var(--mint)]">{activeExercise ? 'Personalized exercise' : 'Practice room'}</p>
            <h2 className="mt-2 font-display text-2xl font-semibold tracking-[-0.03em]">{activeExercise ? activeExercise.title : 'Review your setup, then speak'}</h2>
            <p className="mt-3 text-sm leading-6 text-white/55">The timer starts only when you choose <strong className="font-medium text-white/75">Start speaking</strong>.</p>
          </div>

          <div className="my-7 h-px bg-white/10" />

          <div className="min-h-0 flex-1 space-y-5 overflow-y-auto pr-1">
            {activeExercise ? (
              <>
                <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.11em] text-[var(--mint)]">Target skill</p>
                  <p className="mt-2 text-sm font-semibold text-white/90">{activeExercise.targetSkill}</p>
                  <p className="mt-2 text-xs leading-5 text-white/55">{activeExercise.selectionReason}</p>
                </div>
                <div className="rounded-2xl border-l-2 border-[var(--mint)] bg-white/5 p-4">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.11em] text-white/45">Evidence from your session</p>
                  <p className="mt-2 text-xs italic leading-5 text-white/70">“{activeExercise.sourceEvidence}”</p>
                </div>
              </>
            ) : (
              <>
                <div className="rounded-2xl border border-[var(--mint)]/35 bg-[var(--mint)]/10 p-4">
                  <div className="flex items-center gap-2 text-xs font-semibold text-white/85">
                    <Sparkles className="size-3.5 text-[var(--mint)]" /> Full skill review
                  </div>
                  <p className="mt-2 text-xs leading-5 text-white/55">
                    {goalSkills.length
                      ? 'The coach evaluates every skill in this goal after each answer.'
                      : 'The coach evaluates vocabulary, structure, effectiveness, and reasoning after each answer.'}
                  </p>
                  {goalSkills.length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {goalSkills.map((skill) => (
                        <span key={skill.id} className="rounded-full border border-white/10 bg-white/5 px-2 py-1 text-[10px] font-medium text-white/65">
                          {skill.title}
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                <div>
                  <p className="text-xs font-semibold text-white/75">Practice category</p>
                  <div className="mt-2 grid grid-cols-2 gap-2">
                    {categoryOptions.map((category) => {
                      const selected = categories.includes(category.id);
                      return (
                        <button
                          key={category.id}
                          type="button"
                          disabled={Boolean(activeSessionId)}
                          onClick={() => toggleCategory(category.id)}
                          className={cn(
                            'rounded-xl border px-3 py-2 text-left text-[11px] font-medium leading-4 transition-colors disabled:opacity-60',
                            selected ? 'border-[var(--mint)] bg-[var(--mint)]/15 text-white' : 'border-white/10 bg-white/5 text-white/55 hover:text-white',
                          )}
                        >
                          {selected && <Check className="mr-1 inline size-3 text-[var(--mint)]" />}{category.title}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {!activeSessionId && (
                  <div>
                    <label htmlFor="practice-topic" className="text-xs font-semibold text-white/75">Optional topic</label>
                    <Textarea
                      id="practice-topic"
                      value={customTopic}
                      onChange={(event) => updateSetup({ customTopic: event.target.value })}
                      placeholder="A situation you want to practise"
                      className="mt-2 min-h-16 resize-none border-white/10 bg-white/5 text-xs text-white placeholder:text-white/30"
                    />
                  </div>
                )}
              </>
            )}

            <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <p className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.11em] text-[var(--mint)]"><Lightbulb className="size-3.5" />{activeExercise ? 'Exercise prompt' : 'Your question'}</p>
              <p className="mt-2 text-sm font-medium leading-6 text-white/90">{prompt}</p>
              {!activeExercise && <button onClick={() => void tryAnotherQuestion()} disabled={status === 'recording' || status === 'processing'} className="mt-3 flex items-center gap-1.5 text-xs font-medium text-white/55 hover:text-white"><RefreshCw className="size-3.5" />Try another question</button>}
            </div>

            <div className="space-y-2">
              <div className="flex items-center gap-3 rounded-xl bg-white/5 px-4 py-3 text-xs text-white/65"><Clock3 className="size-4 text-[var(--mint)]" />Suggested session: about 10 min</div>
              <div className="flex items-center gap-3 rounded-xl bg-white/5 px-4 py-3 text-xs text-white/65"><ShieldCheck className="size-4 text-[var(--mint)]" />Video is never uploaded or saved</div>
            </div>
          </div>

          <div className="mt-auto space-y-3">
            {status === 'ready' && (
              <Button onClick={() => void startSpeaking()} disabled={starting || (!activeExercise && categories.length === 0)} size="lg" className="h-12 w-full rounded-xl bg-[#f4f0e4] text-[var(--navy)] hover:bg-white">
                <Mic className="size-4" /> {starting ? 'Preparing session…' : 'Start speaking'}
              </Button>
            )}
            {status === 'recording' && (
              <Button onClick={doneSpeaking} size="lg" className="h-12 w-full rounded-xl bg-[#e16d5d] text-white hover:bg-[#c95d50]">
                <Square className="size-4 fill-current" /> Done speaking
              </Button>
            )}
            {(status === 'permission' || status === 'error') && (
              <Button disabled size="lg" className="h-12 w-full rounded-xl bg-white/10 text-white/45">Start speaking</Button>
            )}
            {setupError && <p role="alert" className="rounded-xl bg-[#8f4336]/20 px-3 py-2 text-center text-xs leading-5 text-[#ffd3cc]">{setupError}</p>}
            {!activeExercise && activeSessionId && answerCount > 0 && <button onClick={() => router.push('/session/summary')} disabled={status === 'recording' || status === 'processing'} className="flex w-full items-center justify-center gap-1 py-2 text-xs font-medium text-white/45 hover:text-white disabled:opacity-40">End session <ChevronRight className="size-3.5" /></button>}
          </div>
        </aside>
      </div>
    </main>
  );
}

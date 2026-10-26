import { after, NextResponse } from 'next/server';
import { apiError, databaseError, requireApiUser } from '@/lib/api-response';
import { generateExerciseAttemptEvaluation, OpenRouterRequestError, transcribeAudio } from '@/lib/analysis/openrouter-provider';
import { createSpeechMetrics } from '@/lib/analysis/speech-metrics';
import { fallbackExercisePrompt, getExerciseTemplate } from '@/lib/exercise-library';
import type { ExerciseAssessment, ExerciseAttemptType, ExerciseNextStep, ExerciseTemplateId } from '@/lib/types';

type RouteParams = { params: Promise<{ exerciseId: string }> };
type ExerciseAttemptStage = 'queued' | 'transcribing' | 'analyzing' | 'completed' | 'failed';

export const maxDuration = 120;

type ExistingAttempt = {
  id: string;
  attempt_number: number;
  attempt_type: ExerciseAttemptType;
  prompt: string;
  assessment: ExerciseAssessment;
  improvement_feedback: string;
  processing_status: ExerciseAttemptStage;
};

type SavedAttempt = ExistingAttempt & {
  difficulty_level: number;
  guidance_provided: string;
  transcript: string;
  duration_seconds: number;
  metrics: Record<string, unknown>;
  positive_feedback: string;
  supporting_evidence: string;
  next_guidance: string;
  next_step: unknown;
  last_error: string | null;
  completed_at: string | null;
  updated_at: string;
  exercises: { exercise_template_id: ExerciseTemplateId } | Array<{ exercise_template_id: ExerciseTemplateId }> | null;
};

function asArray<T>(value: T | T[] | null | undefined): T[] {
  if (!value) return [];
  return Array.isArray(value) ? value : [value];
}

function nextPlan(input: {
  templateId: ExerciseTemplateId;
  attemptType: ExerciseAttemptType;
  attemptNumber: number;
  assessment: ExerciseAssessment;
  difficultyLevel: number;
  generatedPrompt: string;
  generatedGuidance: string;
}): ExerciseNextStep {
  const template = getExerciseTemplate(input.templateId);
  if (input.attemptType === 'transfer') return { stage: 'summary' };

  if (input.attemptNumber >= 3 || (input.attemptNumber === 2 && input.assessment === 'pass')) {
    return {
      stage: 'transfer',
      attemptNumber: 1,
      prompt: input.generatedPrompt || fallbackExercisePrompt(input.templateId, 1, true),
      guidance: '',
      difficultyLevel: 3,
    };
  }

  const nextNumber = input.attemptNumber + 1;
  const nextDifficulty = input.assessment === 'pass'
    ? Math.min(3, input.difficultyLevel + 1)
    : input.assessment === 'fail'
      ? Math.max(1, input.difficultyLevel - 1)
      : input.difficultyLevel;
  const fallback = fallbackExercisePrompt(input.templateId, nextNumber);
  return {
    stage: 'guided',
    attemptNumber: nextNumber,
    prompt: input.generatedPrompt && input.generatedPrompt !== fallbackExercisePrompt(input.templateId, input.attemptNumber)
      ? input.generatedPrompt
      : fallback,
    guidance: input.generatedGuidance || template.levelGuidance[nextDifficulty - 1],
    difficultyLevel: nextDifficulty,
  };
}

function savedNextStep(value: unknown): ExerciseNextStep | null {
  if (!value || typeof value !== 'object') return null;
  const candidate = value as Record<string, unknown>;
  if (candidate.stage === 'summary') return { stage: 'summary' };
  if (
    (candidate.stage === 'guided' || candidate.stage === 'transfer')
    && typeof candidate.attemptNumber === 'number'
    && typeof candidate.prompt === 'string'
    && typeof candidate.guidance === 'string'
    && typeof candidate.difficultyLevel === 'number'
  ) {
    return {
      stage: candidate.stage,
      attemptNumber: candidate.attemptNumber,
      prompt: candidate.prompt,
      guidance: candidate.guidance,
      difficultyLevel: candidate.difficultyLevel,
    };
  }
  return null;
}

function completedResult(attempt: SavedAttempt) {
  const exerciseRelation = Array.isArray(attempt.exercises) ? attempt.exercises[0] : attempt.exercises;
  const next = savedNextStep(attempt.next_step) ?? (exerciseRelation
    ? nextPlan({
        templateId: exerciseRelation.exercise_template_id,
        attemptType: attempt.attempt_type,
        attemptNumber: attempt.attempt_number,
        assessment: attempt.assessment,
        difficultyLevel: attempt.difficulty_level,
        generatedPrompt: '',
        generatedGuidance: attempt.next_guidance,
      })
    : { stage: 'summary' as const });
  return {
    attempt: {
      id: attempt.id,
      attemptNumber: attempt.attempt_number,
      attemptType: attempt.attempt_type,
      prompt: attempt.prompt,
      difficultyLevel: attempt.difficulty_level,
      guidanceProvided: attempt.guidance_provided,
      transcript: attempt.transcript,
      durationSeconds: attempt.duration_seconds,
      metrics: attempt.metrics,
      assessment: attempt.assessment,
      whatWorked: attempt.positive_feedback,
      whatToImprove: attempt.improvement_feedback,
      supportingEvidence: attempt.supporting_evidence,
      nextGuidance: attempt.next_guidance,
      completedAt: attempt.completed_at ?? attempt.updated_at,
    },
    next,
  };
}

function exerciseFailureMessage(error: unknown) {
  const message = error instanceof Error ? error.message : '';
  if (message === 'No speech was detected in the recording.') {
    return 'No speech was detected. Check your microphone and record the exercise again.';
  }
  if (error instanceof OpenRouterRequestError && error.status === 402) {
    return 'OpenRouter needs available balance for speech transcription. Add credit or raise this key’s usable limit, then try again.';
  }
  return 'The exercise response could not be processed. Please try again.';
}

export async function GET(request: Request, { params }: RouteParams) {
  const context = await requireApiUser();
  if ('error' in context) return context.error;
  const { exerciseId } = await params;
  const attemptId = new URL(request.url).searchParams.get('attemptId');
  if (!attemptId) return apiError(400, 'attempt_required', 'The exercise attempt identifier is required.');

  const { data, error } = await context.supabase
    .from('exercise_attempts')
    .select('id, attempt_number, attempt_type, prompt, difficulty_level, guidance_provided, transcript, duration_seconds, metrics, assessment, positive_feedback, improvement_feedback, supporting_evidence, next_guidance, next_step, processing_status, last_error, completed_at, updated_at, exercises(exercise_template_id)')
    .eq('id', attemptId)
    .eq('exercise_id', exerciseId)
    .eq('user_id', context.userId)
    .maybeSingle();
  if (error) return databaseError(error);
  if (!data) return apiError(404, 'attempt_not_found', 'Exercise attempt not found.');

  const attempt = data as unknown as SavedAttempt;
  return NextResponse.json({
    progress: {
      attemptId: attempt.id,
      stage: attempt.processing_status,
      transcript: attempt.transcript || undefined,
      durationSeconds: attempt.duration_seconds,
      metrics: Object.keys(attempt.metrics ?? {}).length ? attempt.metrics : undefined,
      result: attempt.processing_status === 'completed' ? completedResult(attempt) : undefined,
      error: attempt.processing_status === 'failed' ? attempt.last_error ?? exerciseFailureMessage(null) : undefined,
    },
  });
}

export async function POST(request: Request, { params }: RouteParams) {
  const requestStartedAt = performance.now();
  const context = await requireApiUser();
  if ('error' in context) return context.error;

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return apiError(400, 'invalid_upload', 'The exercise recording could not be read.');
  }
  const audio = formData.get('audio');
  const durationSeconds = Math.max(1, Math.round(Number(formData.get('durationSeconds')) || 0));
  const attemptNumber = Math.max(1, Math.min(3, Math.round(Number(formData.get('attemptNumber')) || 1)));
  const attemptType: ExerciseAttemptType = formData.get('attemptType') === 'transfer' ? 'transfer' : 'guided';
  const difficultyLevel = Math.max(1, Math.min(3, Math.round(Number(formData.get('difficultyLevel')) || 1)));
  const promptValue = formData.get('prompt');
  const guidanceValue = formData.get('guidance');
  const submittedPrompt = typeof promptValue === 'string' ? promptValue.trim() : '';
  const guidance = attemptType === 'transfer' ? '' : typeof guidanceValue === 'string' ? guidanceValue.trim() : '';
  if (!(audio instanceof File) || audio.size === 0) return apiError(400, 'audio_required', 'Record the exercise response before finishing.');
  if (audio.size > 15 * 1024 * 1024) return apiError(413, 'audio_too_large', 'Keep the exercise recording under 15 MB.');

  const { exerciseId } = await params;
  const { data: exercise, error: exerciseError } = await context.supabase
    .from('exercises')
    .select('id, exercise_template_id, title, target_skill, target_behavior, prompt, guidance, started_at, session_id, sessions(goal_title), exercise_attempts(id, attempt_number, attempt_type, prompt, assessment, improvement_feedback, processing_status)')
    .eq('id', exerciseId)
    .eq('user_id', context.userId)
    .maybeSingle();
  if (exerciseError) return databaseError(exerciseError);
  if (!exercise) return apiError(404, 'exercise_not_found', 'Exercise not found.');

  const allAttempts = asArray(exercise.exercise_attempts) as unknown as ExistingAttempt[];
  const existingAttempt = allAttempts.find((attempt) => attempt.attempt_number === attemptNumber && attempt.attempt_type === attemptType);
  if (existingAttempt?.processing_status === 'completed') {
    return NextResponse.json({ attemptId: existingAttempt.id, status: 'completed', reused: true });
  }
  if (existingAttempt && ['queued', 'transcribing', 'analyzing'].includes(existingAttempt.processing_status)) {
    return NextResponse.json({ attemptId: existingAttempt.id, status: existingAttempt.processing_status, reused: true }, { status: 202 });
  }

  const templateId = exercise.exercise_template_id as ExerciseTemplateId;
  const prompt = submittedPrompt || exercise.prompt;
  const previousAttempts = allAttempts
    .filter((attempt) => attempt.id !== existingAttempt?.id && attempt.processing_status === 'completed')
    .map((attempt) => ({
      prompt: attempt.prompt,
      assessment: attempt.assessment,
      whatToImprove: attempt.improvement_feedback,
    }));
  const { data: queuedAttempt, error: attemptError } = await context.supabase
    .from('exercise_attempts')
    .upsert({
      user_id: context.userId,
      exercise_id: exerciseId,
      attempt_number: attemptNumber,
      attempt_type: attemptType,
      prompt,
      difficulty_level: difficultyLevel,
      guidance_provided: guidance,
      transcript: '',
      duration_seconds: durationSeconds,
      metrics: {},
      assessment: 'not_evaluated',
      positive_feedback: '',
      improvement_feedback: '',
      supporting_evidence: '',
      next_guidance: '',
      next_step: {},
      processing_status: 'queued',
      last_error: null,
      timings: {},
      completed_at: null,
    }, { onConflict: 'exercise_id,attempt_type,attempt_number' })
    .select('id')
    .single();
  if (attemptError) return databaseError(attemptError);
  const attemptId = queuedAttempt.id;

  after(async () => {
    const processingStartedAt = performance.now();
    const timings: Record<string, number> = {};
    try {
      const transcribingStartedAt = performance.now();
      const { error: transcribingError } = await context.supabase
        .from('exercise_attempts')
        .update({ processing_status: 'transcribing' })
        .eq('id', attemptId)
        .eq('user_id', context.userId);
      if (transcribingError) throw new Error(`Could not start exercise transcription: ${transcribingError.message}`);

      const transcript = await transcribeAudio(audio);
      timings.transcriptionMs = Math.round(performance.now() - transcribingStartedAt);
      const metrics = createSpeechMetrics(transcript, durationSeconds);
      const { error: transcriptError } = await context.supabase
        .from('exercise_attempts')
        .update({ transcript, metrics, processing_status: 'analyzing' })
        .eq('id', attemptId)
        .eq('user_id', context.userId);
      if (transcriptError) throw new Error(`Could not save the exercise transcript: ${transcriptError.message}`);

      const requestedNextStage = attemptType === 'transfer'
        ? 'summary'
        : attemptNumber >= 2
          ? 'transfer'
          : 'guided';
      const fallbackNextPrompt = requestedNextStage === 'transfer'
        ? fallbackExercisePrompt(templateId, 1, true)
        : requestedNextStage === 'guided'
          ? fallbackExercisePrompt(templateId, attemptNumber + 1)
          : '';

      const evaluationStartedAt = performance.now();
      let evaluation;
      try {
        evaluation = await generateExerciseAttemptEvaluation({
          templateId,
          targetBehavior: exercise.target_behavior,
          prompt,
          guidance,
          attemptType,
          attemptNumber,
          difficultyLevel,
          transcript,
          metrics,
          previousAttempts,
          nextStage: requestedNextStage,
          fallbackNextPrompt,
        });
      } catch (error) {
        console.warn('Exercise attempt could not be evaluated reliably', {
          exerciseId,
          attemptId,
          attemptType,
          attemptNumber,
          message: error instanceof Error ? error.message : 'Unknown evaluation error',
        });
        evaluation = {
          assessment: 'not_evaluated' as const,
          whatWorked: '',
          whatToImprove: 'The coach could not evaluate this attempt reliably. Review the transcript before relying on a conclusion.',
          evidence: '',
          nextGuidance: getExerciseTemplate(templateId).levelGuidance[Math.max(0, difficultyLevel - 1)],
          nextPrompt: fallbackNextPrompt,
        };
      }
      timings.evaluationMs = Math.round(performance.now() - evaluationStartedAt);
      const next = nextPlan({
        templateId,
        attemptType,
        attemptNumber,
        assessment: evaluation.assessment,
        difficultyLevel,
        generatedPrompt: evaluation.nextPrompt,
        generatedGuidance: evaluation.nextGuidance,
      });

      const persistenceStartedAt = performance.now();
      const completedAt = new Date().toISOString();
      const { error: exerciseUpdateError } = await context.supabase
        .from('exercises')
        .update({
          status: 'in_progress',
          started_at: exercise.started_at ?? completedAt,
          answer_text: transcript,
          duration_seconds: durationSeconds,
          metrics,
          coaching: { targetedAttempt: evaluation },
        })
        .eq('id', exerciseId)
        .eq('user_id', context.userId);
      if (exerciseUpdateError) throw new Error(`Could not update the exercise: ${exerciseUpdateError.message}`);

      timings.persistenceMs = Math.round(performance.now() - persistenceStartedAt);
      timings.totalMs = Math.round(performance.now() - processingStartedAt);
      const { error: completedError } = await context.supabase
        .from('exercise_attempts')
        .update({
          assessment: evaluation.assessment,
          positive_feedback: evaluation.whatWorked,
          improvement_feedback: evaluation.whatToImprove,
          supporting_evidence: evaluation.evidence,
          next_guidance: evaluation.nextGuidance,
          next_step: next,
          processing_status: 'completed',
          completed_at: completedAt,
          timings,
        })
        .eq('id', attemptId)
        .eq('user_id', context.userId);
      if (completedError) throw new Error(`Could not finish the exercise attempt: ${completedError.message}`);
      console.info('Exercise attempt timing', { exerciseId, attemptId, ...timings });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown exercise analysis error';
      const userMessage = exerciseFailureMessage(error);
      timings.totalMs = Math.round(performance.now() - processingStartedAt);
      console.error('Exercise analysis failed', { exerciseId, attemptId, message, ...timings });
      await context.supabase
        .from('exercise_attempts')
        .update({ processing_status: 'failed', last_error: userMessage, timings })
        .eq('id', attemptId)
        .eq('user_id', context.userId);
    }
  });

  const enqueueMs = Math.round(performance.now() - requestStartedAt);
  return NextResponse.json(
    { attemptId, status: 'queued' },
    { status: 202, headers: { 'Server-Timing': `enqueue;dur=${enqueueMs}` } },
  );
}

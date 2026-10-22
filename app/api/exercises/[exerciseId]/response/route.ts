import { NextResponse } from 'next/server';
import { apiError, databaseError, requireApiUser } from '@/lib/api-response';
import { generateExerciseAttemptEvaluation, OpenRouterRequestError, transcribeAudio } from '@/lib/analysis/openrouter-provider';
import { createSpeechMetrics } from '@/lib/analysis/speech-metrics';
import { fallbackExercisePrompt, getExerciseTemplate } from '@/lib/exercise-library';
import type { ExerciseAssessment, ExerciseAttemptType, ExerciseNextStep, ExerciseTemplateId } from '@/lib/types';

type RouteParams = { params: Promise<{ exerciseId: string }> };

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

export async function POST(request: Request, { params }: RouteParams) {
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
  const attemptType = formData.get('attemptType') === 'transfer' ? 'transfer' : 'guided';
  const difficultyLevel = Math.max(1, Math.min(3, Math.round(Number(formData.get('difficultyLevel')) || 1)));
  const promptValue = formData.get('prompt');
  const guidanceValue = formData.get('guidance');
  const submittedPrompt = typeof promptValue === 'string' ? promptValue.trim() : '';
  const guidance = attemptType === 'transfer' ? '' : typeof guidanceValue === 'string' ? guidanceValue.trim() : '';
  if (!(audio instanceof File) || audio.size === 0) {
    return apiError(400, 'audio_required', 'Record the exercise response before finishing.');
  }
  if (audio.size > 15 * 1024 * 1024) {
    return apiError(413, 'audio_too_large', 'Keep the exercise recording under 15 MB.');
  }

  const { exerciseId } = await params;
  const { data: exercise, error: exerciseError } = await context.supabase
    .from('exercises')
    .select('id, exercise_template_id, title, target_skill, target_behavior, prompt, guidance, started_at, session_id, sessions(goal_title), exercise_attempts(prompt, attempt_type, assessment, improvement_feedback)')
    .eq('id', exerciseId)
    .eq('user_id', context.userId)
    .maybeSingle();

  if (exerciseError) return databaseError(exerciseError);
  if (!exercise) return apiError(404, 'exercise_not_found', 'Exercise not found.');

  const templateId = exercise.exercise_template_id as ExerciseTemplateId;
  const prompt = submittedPrompt || exercise.prompt;
  const previousAttempts = asArray(exercise.exercise_attempts).map((attempt) => ({
    prompt: attempt.prompt,
    assessment: attempt.assessment as ExerciseAssessment,
    whatToImprove: attempt.improvement_feedback,
  }));
  let stage: 'transcription' | 'feedback' | 'saving' = 'transcription';
  try {
    const transcript = await transcribeAudio(audio);
    const metrics = createSpeechMetrics(transcript, durationSeconds);
    stage = 'feedback';
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

    const next = nextPlan({
      templateId,
      attemptType,
      attemptNumber,
      assessment: evaluation.assessment,
      difficultyLevel,
      generatedPrompt: evaluation.nextPrompt,
      generatedGuidance: evaluation.nextGuidance,
    });

    stage = 'saving';
    const completedAt = new Date().toISOString();
    const { data: savedAttempt, error: attemptError } = await context.supabase
      .from('exercise_attempts')
      .upsert({
        user_id: context.userId,
        exercise_id: exerciseId,
        attempt_number: attemptNumber,
        attempt_type: attemptType,
        prompt,
        difficulty_level: difficultyLevel,
        guidance_provided: guidance,
        transcript,
        duration_seconds: durationSeconds,
        metrics,
        assessment: evaluation.assessment,
        positive_feedback: evaluation.whatWorked,
        improvement_feedback: evaluation.whatToImprove,
        supporting_evidence: evaluation.evidence,
        next_guidance: evaluation.nextGuidance,
        completed_at: completedAt,
      }, { onConflict: 'exercise_id,attempt_type,attempt_number' })
      .select('id, attempt_number, attempt_type, prompt, difficulty_level, guidance_provided, transcript, duration_seconds, metrics, assessment, positive_feedback, improvement_feedback, supporting_evidence, next_guidance, completed_at')
      .single();
    if (attemptError) return databaseError(attemptError);

    const { error: updateError } = await context.supabase
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
    if (updateError) return databaseError(updateError);

    return NextResponse.json({
      result: {
        attempt: {
          id: savedAttempt.id,
          attemptNumber: savedAttempt.attempt_number,
          attemptType: savedAttempt.attempt_type,
          prompt: savedAttempt.prompt,
          difficultyLevel: savedAttempt.difficulty_level,
          guidanceProvided: savedAttempt.guidance_provided,
          transcript: savedAttempt.transcript,
          durationSeconds: savedAttempt.duration_seconds,
          metrics: savedAttempt.metrics,
          assessment: savedAttempt.assessment,
          whatWorked: savedAttempt.positive_feedback,
          whatToImprove: savedAttempt.improvement_feedback,
          supportingEvidence: savedAttempt.supporting_evidence,
          nextGuidance: savedAttempt.next_guidance,
          completedAt: savedAttempt.completed_at,
        },
        next,
      },
    });
  } catch (error) {
    console.error('Exercise analysis failed', {
      exerciseId,
      stage,
      message: error instanceof Error ? error.message : 'Unknown exercise analysis error',
    });
    const message = error instanceof Error ? error.message : '';
    const userMessage = message === 'No speech was detected in the recording.'
      ? 'No speech was detected. Check your microphone and record the exercise again.'
      : error instanceof OpenRouterRequestError && error.status === 402
        ? 'OpenRouter needs available balance for speech transcription. Add credit or raise this key’s usable limit, then try again.'
        : 'The exercise response could not be processed. Please try again.';
    return apiError(error instanceof OpenRouterRequestError ? error.status : 502, 'analysis_failed', userMessage);
  }
}

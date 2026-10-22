import { NextResponse } from 'next/server';
import { apiError, databaseError, requireApiUser } from '@/lib/api-response';
import { generateExerciseCompletionFeedback } from '@/lib/analysis/openrouter-provider';
import type { ExerciseAssessment, ExerciseAttempt, ExerciseAttemptType, ResponseMetrics } from '@/lib/types';

type RouteParams = { params: Promise<{ exerciseId: string }> };

function asArray<T>(value: T | T[] | null | undefined): T[] {
  if (!value) return [];
  return Array.isArray(value) ? value : [value];
}

function textValue(value: unknown) {
  return typeof value === 'string' ? value : '';
}

function mapAttempt(row: Record<string, unknown>): ExerciseAttempt {
  return {
    id: String(row.id),
    attemptNumber: Number(row.attempt_number),
    attemptType: row.attempt_type as ExerciseAttemptType,
    prompt: String(row.prompt),
    difficultyLevel: Number(row.difficulty_level),
    guidanceProvided: textValue(row.guidance_provided),
    transcript: textValue(row.transcript),
    durationSeconds: Number(row.duration_seconds),
    metrics: row.metrics as ResponseMetrics,
    assessment: row.assessment as ExerciseAssessment,
    whatWorked: textValue(row.positive_feedback),
    whatToImprove: textValue(row.improvement_feedback),
    supportingEvidence: textValue(row.supporting_evidence),
    nextGuidance: textValue(row.next_guidance),
    completedAt: textValue(row.completed_at) || textValue(row.created_at),
  };
}

export async function POST(_request: Request, { params }: RouteParams) {
  const context = await requireApiUser();
  if ('error' in context) return context.error;
  const { exerciseId } = await params;
  const { data: exercise, error } = await context.supabase
    .from('exercises')
    .select('id, title, target_skill, target_behavior, completion_feedback, exercise_attempts(*)')
    .eq('id', exerciseId)
    .eq('user_id', context.userId)
    .maybeSingle();
  if (error) return databaseError(error);
  if (!exercise) return apiError(404, 'exercise_not_found', 'Exercise not found.');

  const attempts = asArray(exercise.exercise_attempts as Record<string, unknown> | Record<string, unknown>[])
    .map(mapAttempt)
    .sort((left, right) => left.completedAt.localeCompare(right.completedAt));
  if (!attempts.length) return apiError(409, 'no_attempts', 'Complete at least one exercise attempt first.');

  let completion;
  try {
    completion = await generateExerciseCompletionFeedback({
      title: exercise.title,
      targetSkill: exercise.target_skill,
      targetBehavior: exercise.target_behavior,
      attempts: attempts.map((attempt) => ({
        attemptType: attempt.attemptType,
        assessment: attempt.assessment,
        whatWorked: attempt.whatWorked,
        whatToImprove: attempt.whatToImprove,
        evidence: attempt.supportingEvidence,
      })),
    });
  } catch (completionError) {
    console.warn('Exercise completion summary fell back to saved attempt feedback', {
      exerciseId,
      message: completionError instanceof Error ? completionError.message : 'Unknown summary error',
    });
    const first = attempts[0];
    const latest = attempts.at(-1) ?? first;
    completion = {
      whatImproved: attempts.length > 1 && first.assessment !== latest.assessment
        ? `Your latest attempt showed a different outcome from the first. ${latest.whatWorked}`
        : `You practised the target behavior across ${attempts.length} ${attempts.length === 1 ? 'attempt' : 'attempts'}. ${latest.whatWorked}`,
      remainingFocus: latest.whatToImprove || 'Keep making the target behavior explicit in unfamiliar questions.',
      recommendedNextPractice: latest.nextGuidance || `Revisit ${exercise.target_skill.toLocaleLowerCase()} in a new workplace scenario.`,
    };
  }

  const completedAt = new Date().toISOString();
  const previousCompletion = exercise.completion_feedback && typeof exercise.completion_feedback === 'object'
    ? exercise.completion_feedback as Record<string, unknown>
    : {};
  const learningHistory = Array.isArray(previousCompletion.history) ? previousCompletion.history : [];
  const { error: updateError } = await context.supabase
    .from('exercises')
    .update({ status: 'completed', completed_at: completedAt, completion_feedback: { ...completion, history: learningHistory } })
    .eq('id', exerciseId)
    .eq('user_id', context.userId);
  if (updateError) return databaseError(updateError);

  return NextResponse.json({
    summary: {
      exerciseId,
      status: 'completed',
      targetSkill: exercise.target_skill,
      targetBehavior: exercise.target_behavior,
      guidedAttempts: attempts.filter((attempt) => attempt.attemptType === 'guided'),
      transferTest: attempts.find((attempt) => attempt.attemptType === 'transfer') ?? null,
      ...completion,
    },
  });
}

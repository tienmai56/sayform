import { NextResponse } from 'next/server';
import { apiError, databaseError, requireApiUser } from '@/lib/api-response';
import { fallbackExercisePrompt, getExerciseTemplate } from '@/lib/exercise-library';
import type { ExerciseAssessment, ExerciseTemplateId } from '@/lib/types';

type RouteParams = { params: Promise<{ exerciseId: string }> };

type AttemptRow = {
  attempt_type: 'guided' | 'transfer';
  assessment: ExerciseAssessment;
  difficulty_level: number;
  completed_at: string | null;
  created_at: string;
};

function asArray<T>(value: T | T[] | null | undefined): T[] {
  if (!value) return [];
  return Array.isArray(value) ? value : [value];
}

function textValue(value: unknown) {
  return typeof value === 'string' ? value : '';
}

export async function POST(_request: Request, { params }: RouteParams) {
  const context = await requireApiUser();
  if ('error' in context) return context.error;
  const { exerciseId } = await params;

  const { data: exercise, error } = await context.supabase
    .from('exercises')
    .select('id, exercise_template_id, target_skill, target_behavior, difficulty_level, completion_feedback, status, exercise_attempts(attempt_type, assessment, difficulty_level, completed_at, created_at)')
    .eq('id', exerciseId)
    .eq('user_id', context.userId)
    .maybeSingle();
  if (error) return databaseError(error);
  if (!exercise) return apiError(404, 'exercise_not_found', 'Exercise not found.');
  if (exercise.status !== 'completed') {
    return apiError(409, 'exercise_not_completed', 'View the exercise summary before ending this exercise.');
  }

  const templateId = exercise.exercise_template_id as ExerciseTemplateId;
  const template = getExerciseTemplate(templateId);
  const attempts = asArray(exercise.exercise_attempts as AttemptRow | AttemptRow[] | null)
    .sort((left, right) => (left.completed_at ?? left.created_at).localeCompare(right.completed_at ?? right.created_at));
  const guidedAssessments = attempts
    .filter((attempt) => attempt.attempt_type === 'guided')
    .map((attempt) => attempt.assessment);
  const transferAssessment = attempts.find((attempt) => attempt.attempt_type === 'transfer')?.assessment ?? null;
  const latestAttempt = attempts.at(-1);
  const completion = exercise.completion_feedback && typeof exercise.completion_feedback === 'object'
    ? exercise.completion_feedback as Record<string, unknown>
    : {};
  const existingHistory = Array.isArray(completion.history) ? completion.history : [];
  const remainingFocus = textValue(completion.remainingFocus) || exercise.target_behavior;
  const recommendedNextPractice = textValue(completion.recommendedNextPractice) || template.levelGuidance[0];
  const learningHistory = [
    ...existingHistory,
    {
      completedAt: new Date().toISOString(),
      templateId,
      targetSkill: exercise.target_skill,
      targetBehavior: exercise.target_behavior,
      guidedAssessments,
      transferAssessment,
      whatImproved: textValue(completion.whatImproved),
      remainingFocus,
      recommendedNextPractice,
    },
  ];

  const latestAssessment = transferAssessment ?? latestAttempt?.assessment ?? 'partial';
  const nextDifficulty = latestAssessment === 'pass'
    ? Math.min(3, exercise.difficulty_level + 1)
    : latestAssessment === 'fail'
      ? Math.max(1, exercise.difficulty_level - 1)
      : exercise.difficulty_level;

  const { error: deleteError } = await context.supabase
    .from('exercise_attempts')
    .delete()
    .eq('exercise_id', exerciseId)
    .eq('user_id', context.userId);
  if (deleteError) return databaseError(deleteError);

  const { error: updateError } = await context.supabase
    .from('exercises')
    .update({
      title: `${template.title} · Follow-up`,
      target_behavior: remainingFocus,
      selection_reason: 'Recommended from the remaining weakness identified in your latest exercise.',
      prompt: fallbackExercisePrompt(templateId, 1, true),
      guidance: recommendedNextPractice,
      difficulty_level: nextDifficulty,
      status: 'recommended',
      started_at: null,
      completed_at: null,
      answer_text: null,
      duration_seconds: 0,
      metrics: {},
      coaching: {},
      source_evidence: '',
      completion_feedback: { history: learningHistory },
    })
    .eq('id', exerciseId)
    .eq('user_id', context.userId);
  if (updateError) return databaseError(updateError);

  return NextResponse.json({ ended: true });
}

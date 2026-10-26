import { NextResponse } from 'next/server';
import { apiError, databaseError, requireApiUser } from '@/lib/api-response';
import { fallbackExercisePrompt, getExerciseTemplate } from '@/lib/exercise-library';
import type { ExerciseAssessment, ExerciseNextStep, ExerciseTemplateId } from '@/lib/types';

type RouteParams = { params: Promise<{ goalId: string }> };

type AttemptRow = {
  attempt_number: number;
  attempt_type: 'guided' | 'transfer';
  difficulty_level: number;
  assessment: ExerciseAssessment;
  next_guidance: string;
  processing_status: 'queued' | 'transcribing' | 'analyzing' | 'completed' | 'failed';
  completed_at: string | null;
  created_at: string;
};

function asArray<T>(value: T | T[] | null | undefined): T[] {
  if (!value) return [];
  return Array.isArray(value) ? value : [value];
}

function nextExerciseStep(exercise: {
  exercise_template_id: ExerciseTemplateId;
  prompt: string;
  guidance: string;
  difficulty_level: number;
  status: string;
  exercise_attempts: AttemptRow | AttemptRow[] | null;
}): ExerciseNextStep {
  if (exercise.status === 'completed') return { stage: 'summary' };
  const attempts = asArray(exercise.exercise_attempts)
    .sort((left, right) => (left.completed_at ?? left.created_at).localeCompare(right.completed_at ?? right.created_at));
  if (attempts.some((attempt) => attempt.attempt_type === 'transfer')) return { stage: 'summary' };

  const guided = attempts.filter((attempt) => attempt.attempt_type === 'guided');
  const latest = guided.at(-1);
  if (!latest) {
    return {
      stage: 'guided',
      attemptNumber: 1,
      prompt: exercise.prompt,
      guidance: exercise.guidance,
      difficultyLevel: exercise.difficulty_level,
    };
  }

  if (latest.attempt_number >= 3 || (latest.attempt_number >= 2 && latest.assessment === 'pass')) {
    return {
      stage: 'transfer',
      attemptNumber: 1,
      prompt: fallbackExercisePrompt(exercise.exercise_template_id, 1, true),
      guidance: '',
      difficultyLevel: 3,
    };
  }

  const nextAttemptNumber = latest.attempt_number + 1;
  const nextDifficulty = latest.assessment === 'pass'
    ? Math.min(3, latest.difficulty_level + 1)
    : latest.assessment === 'fail'
      ? Math.max(1, latest.difficulty_level - 1)
      : latest.difficulty_level;
  const template = getExerciseTemplate(exercise.exercise_template_id);
  return {
    stage: 'guided',
    attemptNumber: nextAttemptNumber,
    prompt: fallbackExercisePrompt(exercise.exercise_template_id, nextAttemptNumber),
    guidance: latest.next_guidance || template.levelGuidance[nextDifficulty - 1],
    difficultyLevel: nextDifficulty,
  };
}

export async function GET(_request: Request, { params }: RouteParams) {
  const context = await requireApiUser();
  if ('error' in context) return context.error;
  const { goalId } = await params;

  const { data: goal, error: goalError } = await context.supabase
    .from('goals')
    .select('id')
    .eq('id', goalId)
    .eq('user_id', context.userId)
    .maybeSingle();
  if (goalError) return databaseError(goalError);
  if (!goal) return apiError(404, 'goal_not_found', 'Communication goal not found.');

  const { data, error } = await context.supabase
    .from('exercises')
    .select('id, exercise_template_id, skill_category, title, target_skill, target_behavior, behavior_code, selection_reason, instructions, estimated_minutes, prompt, guidance, difficulty_level, source_evidence, status, created_at, completed_at, sessions!inner(id, goal_id, title), exercise_attempts(attempt_number, attempt_type, difficulty_level, assessment, next_guidance, processing_status, completed_at, created_at)')
    .eq('user_id', context.userId)
    .eq('sessions.goal_id', goalId)
    .neq('status', 'completed')
    .order('created_at', { ascending: false });
  if (error) return databaseError(error);

  return NextResponse.json({
    exercises: (data ?? []).map((exercise) => {
      const sessionRelation = Array.isArray(exercise.sessions) ? exercise.sessions[0] : exercise.sessions;
      const attempts = asArray(exercise.exercise_attempts as AttemptRow | AttemptRow[] | null)
        .filter((attempt) => attempt.processing_status === 'completed');
      const latestAttempt = [...attempts]
        .sort((left, right) => (right.completed_at ?? right.created_at).localeCompare(left.completed_at ?? left.created_at))[0];
      return {
        id: exercise.id,
        templateId: exercise.exercise_template_id,
        skillId: exercise.skill_category,
        title: exercise.title,
        targetSkill: exercise.target_skill,
        targetBehavior: exercise.target_behavior,
        behaviorCode: exercise.behavior_code,
        selectionReason: exercise.selection_reason,
        instructions: Array.isArray(exercise.instructions) ? exercise.instructions : [],
        estimatedMinutes: exercise.estimated_minutes,
        prompt: exercise.prompt,
        guidance: exercise.guidance,
        difficultyLevel: exercise.difficulty_level,
        sourceEvidence: exercise.source_evidence,
        status: exercise.status,
        sessionId: sessionRelation?.id ?? '',
        sessionTitle: sessionRelation?.title ?? 'Practice session',
        createdAt: exercise.created_at,
        completedAt: exercise.completed_at,
        attemptCount: attempts.length,
        lastAssessment: latestAttempt?.assessment ?? null,
        nextStep: nextExerciseStep({
          exercise_template_id: exercise.exercise_template_id,
          prompt: exercise.prompt,
          guidance: exercise.guidance,
          difficulty_level: exercise.difficulty_level,
          status: exercise.status,
          exercise_attempts: attempts,
        }),
      };
    }),
  });
}

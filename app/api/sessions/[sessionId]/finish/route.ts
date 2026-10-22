import { NextResponse } from 'next/server';
import { apiError, databaseError, parseBody, requireApiUser } from '@/lib/api-response';
import { generateSessionSummary } from '@/lib/analysis/openrouter-provider';
import { getGoalDefinition } from '@/lib/goal-catalog';
import { finishSessionSchema } from '@/lib/validation';
import type { FeedbackDimension } from '@/lib/types';

type RouteParams = { params: Promise<{ sessionId: string }> };

type MetricRow = {
  word_count: number;
  average_wpm: number;
  filler_count: number;
};

type FeedbackRow = {
  id: string;
  dimension: FeedbackDimension;
  evidence: string;
  title: string;
  explanation: string;
  positive: boolean;
  dismissed: boolean;
  skill: string;
};

function asArray<T>(value: T | T[] | null | undefined): T[] {
  if (!value) return [];
  return Array.isArray(value) ? value : [value];
}

export async function POST(request: Request, { params }: RouteParams) {
  const context = await requireApiUser();
  if ('error' in context) return context.error;
  const body = await parseBody(request, finishSessionSchema);
  if ('error' in body) return body.error;
  const { sessionId } = await params;

  const { data: session, error: sessionError } = await context.supabase
    .from('sessions')
    .select('id, status, created_at, title, goal_id, goal_title, takeaway, goals(template_key)')
    .eq('id', sessionId)
    .eq('user_id', context.userId)
    .maybeSingle();
  if (sessionError) return databaseError(sessionError);
  if (!session) return apiError(404, 'session_not_found', 'Practice session not found.');

  const { data: responses, error: responsesError } = await context.supabase
    .from('responses')
    .select('id, prompt, transcript, duration_seconds, sequence_number, response_metrics(word_count, average_wpm, filler_count), feedback_items(id, dimension, evidence, title, explanation, positive, dismissed, skill)')
    .eq('session_id', sessionId)
    .eq('user_id', context.userId)
    .eq('status', 'completed')
    .order('sequence_number', { ascending: true });
  if (responsesError) return databaseError(responsesError);

  const completedResponses = responses ?? [];
  if (!completedResponses.length) {
    return apiError(409, 'no_completed_answers', 'Complete at least one answer before ending the session.');
  }

  const totalDuration = completedResponses.reduce((total, response) => total + response.duration_seconds, 0);
  const metricRows = completedResponses.flatMap((response) => asArray(response.response_metrics as MetricRow | MetricRow[]));
  const wordCount = metricRows.reduce((total, metrics) => total + metrics.word_count, 0);
  const averageWpm = totalDuration > 0 ? Math.round((wordCount * 60) / totalDuration) : 0;
  const fillerCount = metricRows.reduce((total, metrics) => total + metrics.filler_count, 0);
  const feedback = completedResponses.flatMap((response) =>
    asArray(response.feedback_items as FeedbackRow | FeedbackRow[]).map((item) => ({
      ...item,
      responseId: response.id,
    })),
  );

  if (session.status === 'completed') {
    const [{ data: savedSummary }, { data: savedExercise }] = await Promise.all([
      context.supabase
        .from('session_summaries')
        .select('summary, strengths, opportunities')
        .eq('session_id', sessionId)
        .eq('user_id', context.userId)
        .maybeSingle(),
      context.supabase
        .from('exercises')
        .select('id, exercise_template_id, skill_category, title, target_skill, target_behavior, behavior_code, selection_reason, instructions, estimated_minutes, prompt, guidance, difficulty_level, source_evidence, status')
        .eq('session_id', sessionId)
        .eq('user_id', context.userId)
        .maybeSingle(),
    ]);
    if (savedSummary && savedExercise) {
      const strengths = Array.isArray(savedSummary.strengths) ? savedSummary.strengths : [];
      const opportunities = Array.isArray(savedSummary.opportunities) ? savedSummary.opportunities : [];
      const firstStrength = strengths[0] as { title?: string } | undefined;
      return NextResponse.json({
        session: {
          id: sessionId,
          status: 'completed',
          answers: completedResponses.length,
          durationSeconds: totalDuration,
          wordCount,
          averageWpm,
          fillerCount,
        },
        summary: {
          headline: firstStrength?.title ?? 'Session complete',
          summary: savedSummary.summary,
          strengths,
          opportunities,
          takeaway: session.takeaway,
        },
        exercise: {
          id: savedExercise.id,
          templateId: savedExercise.exercise_template_id,
          skillId: savedExercise.skill_category,
          title: savedExercise.title,
          targetSkill: savedExercise.target_skill,
          targetBehavior: savedExercise.target_behavior,
          behaviorCode: savedExercise.behavior_code,
          selectionReason: savedExercise.selection_reason,
          instructions: Array.isArray(savedExercise.instructions) ? savedExercise.instructions : [],
          estimatedMinutes: savedExercise.estimated_minutes,
          prompt: savedExercise.prompt,
          guidance: savedExercise.guidance,
          difficultyLevel: savedExercise.difficulty_level,
          sourceEvidence: savedExercise.source_evidence,
          status: savedExercise.status,
        },
      });
    }
  }

  const goalRelation = Array.isArray(session.goals) ? session.goals[0] : session.goals;
  const goalDefinition = getGoalDefinition(goalRelation?.template_key);
  const completedAt = new Date().toISOString();

  // Persist the completed-session metrics before the slower AI summary step. This
  // keeps recorded practice data safe when the request comes from a page-exit
  // beacon or when summary generation needs to be retried.
  const { error: metricUpdateError } = await context.supabase
    .from('sessions')
    .update({
      status: 'completed',
      completed_at: completedAt,
      duration_seconds: totalDuration,
      average_wpm: averageWpm,
      filler_count: fillerCount,
      title: session.goal_title,
    })
    .eq('id', sessionId)
    .eq('user_id', context.userId);
  if (metricUpdateError) return databaseError(metricUpdateError);

  let exerciseHistory: Array<{
    templateId: string;
    targetBehavior: string;
    status: string;
    guidedAssessments: Array<'pass' | 'partial' | 'fail' | 'not_evaluated'>;
    transferAssessment: 'pass' | 'partial' | 'fail' | 'not_evaluated' | null;
  }> = [];
  if (session.goal_id) {
    const { data: previousSessions } = await context.supabase
      .from('sessions')
      .select('id')
      .eq('user_id', context.userId)
      .eq('goal_id', session.goal_id)
      .neq('id', sessionId)
      .eq('status', 'completed')
      .order('completed_at', { ascending: false })
      .limit(8);
    const previousSessionIds = (previousSessions ?? []).map((item) => item.id);
    if (previousSessionIds.length) {
      const { data: previousExercises } = await context.supabase
        .from('exercises')
        .select('exercise_template_id, target_behavior, status, completion_feedback, exercise_attempts(attempt_type, assessment)')
        .eq('user_id', context.userId)
        .in('session_id', previousSessionIds)
        .order('created_at', { ascending: false });
      exerciseHistory = (previousExercises ?? []).flatMap((exercise) => {
        const completionFeedback = exercise.completion_feedback && typeof exercise.completion_feedback === 'object'
          ? exercise.completion_feedback as Record<string, unknown>
          : {};
        const learningHistory = Array.isArray(completionFeedback.history)
          ? completionFeedback.history as Array<Record<string, unknown>>
          : [];
        if (learningHistory.length) {
          return learningHistory.map((signal) => ({
            templateId: typeof signal.templateId === 'string' ? signal.templateId : exercise.exercise_template_id,
            targetBehavior: typeof signal.remainingFocus === 'string'
              ? signal.remainingFocus
              : typeof signal.targetBehavior === 'string' ? signal.targetBehavior : exercise.target_behavior,
            status: 'completed',
            guidedAssessments: Array.isArray(signal.guidedAssessments)
              ? signal.guidedAssessments as Array<'pass' | 'partial' | 'fail' | 'not_evaluated'>
              : [],
            transferAssessment: typeof signal.transferAssessment === 'string'
              ? signal.transferAssessment as 'pass' | 'partial' | 'fail' | 'not_evaluated'
              : null,
          }));
        }
        const attempts = Array.isArray(exercise.exercise_attempts)
          ? exercise.exercise_attempts
          : exercise.exercise_attempts ? [exercise.exercise_attempts] : [];
        return [{
          templateId: exercise.exercise_template_id,
          targetBehavior: exercise.target_behavior,
          status: exercise.status,
          guidedAssessments: attempts
            .filter((attempt) => attempt.attempt_type === 'guided')
            .map((attempt) => attempt.assessment as 'pass' | 'partial' | 'fail' | 'not_evaluated'),
          transferAssessment: (attempts.find((attempt) => attempt.attempt_type === 'transfer')?.assessment as 'pass' | 'partial' | 'fail' | 'not_evaluated' | undefined) ?? null,
        }];
      });
    }
  }
  let summary: Awaited<ReturnType<typeof generateSessionSummary>>;
  try {
    summary = await generateSessionSummary({
      goalTitle: session.goal_title,
      goalSkills: goalDefinition?.skills ?? [],
      goalFramework: goalDefinition?.evaluationFramework,
      responses: completedResponses.map((response) => ({
        id: response.id,
        prompt: response.prompt,
        transcript: response.transcript,
      })),
      feedback,
      exerciseHistory,
    });
  } catch (error) {
    console.error('Session summary generation failed', {
      sessionId,
      message: error instanceof Error ? error.message : 'Unknown summary error',
    });
    return apiError(502, 'summary_failed', 'The personalized session summary could not be completed. Please try again.');
  }
  const { error: updateError } = await context.supabase
    .from('sessions')
    .update({
      takeaway: summary.takeaway,
    })
    .eq('id', sessionId)
    .eq('user_id', context.userId);
  if (updateError) return databaseError(updateError);

  const { data: exercise, error: exerciseError } = await context.supabase
    .from('exercises')
    .upsert({
      user_id: context.userId,
      session_id: sessionId,
      response_id: summary.exercise.sourceResponseId,
      source_feedback_item_id: summary.exercise.sourceFeedbackItemId,
      exercise_type: summary.exercise.templateId,
      exercise_template_id: summary.exercise.templateId,
      skill_category: summary.exercise.skillId,
      title: summary.exercise.title,
      target_skill: summary.exercise.targetSkill,
      target_behavior: summary.exercise.targetBehavior,
      behavior_code: summary.exercise.behaviorCode,
      selection_reason: summary.exercise.selectionReason,
      instructions: summary.exercise.instructions,
      estimated_minutes: summary.exercise.estimatedMinutes,
      prompt: summary.exercise.prompt,
      guidance: summary.exercise.guidance,
      difficulty_level: summary.exercise.difficultyLevel,
      source_evidence: summary.exercise.sourceEvidence,
      status: 'recommended',
    }, { onConflict: 'session_id' })
    .select('id, exercise_template_id, skill_category, title, target_skill, target_behavior, behavior_code, selection_reason, instructions, estimated_minutes, prompt, guidance, difficulty_level, source_evidence, status')
    .single();
  if (exerciseError) return databaseError(exerciseError);

  const { error: summaryError } = await context.supabase.from('session_summaries').upsert({
    session_id: sessionId,
    user_id: context.userId,
    summary: summary.summary,
    strengths: summary.strengths,
    opportunities: summary.opportunities,
    recommended_exercise_id: exercise.id,
  });
  if (summaryError) return databaseError(summaryError);

  return NextResponse.json({
    session: {
      id: sessionId,
      status: 'completed',
      answers: completedResponses.length,
      durationSeconds: totalDuration,
      wordCount,
      averageWpm,
      fillerCount,
    },
    summary: {
      headline: summary.headline,
      summary: summary.summary,
      strengths: summary.strengths,
      opportunities: summary.opportunities,
      takeaway: summary.takeaway,
    },
    exercise: {
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
    },
  });
}

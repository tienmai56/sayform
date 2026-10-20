import { NextResponse } from 'next/server';
import { apiError, databaseError, parseBody, requireApiUser } from '@/lib/api-response';
import { createMockSessionSummary } from '@/lib/analysis/mock-provider';
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
    .select('id, status, created_at, title, goal_title, skill_focus, goals(template_key)')
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
  const goalRelation = Array.isArray(session.goals) ? session.goals[0] : session.goals;
  const summary = createMockSessionSummary({
    goalTitle: session.goal_title,
    goalTemplateKey: goalRelation?.template_key,
    skillFocus: session.skill_focus,
    answerCount: completedResponses.length,
    feedback,
  });
  const completedAt = new Date().toISOString();

  const { error: updateError } = await context.supabase
    .from('sessions')
    .update({
      status: 'completed',
      completed_at: completedAt,
      duration_seconds: totalDuration,
      average_wpm: averageWpm,
      filler_count: fillerCount,
      takeaway: summary.takeaway,
      title: body.data.title ?? session.title,
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
      exercise_type: goalRelation?.template_key ?? 'custom',
      title: summary.exercise.title,
      target_skill: summary.exercise.targetSkill,
      selection_reason: summary.exercise.selectionReason,
      prompt: summary.exercise.prompt,
      source_evidence: summary.exercise.sourceEvidence,
    }, { onConflict: 'session_id' })
    .select('id, title, target_skill, selection_reason, prompt, source_evidence')
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
      title: exercise.title,
      targetSkill: exercise.target_skill,
      selectionReason: exercise.selection_reason,
      prompt: exercise.prompt,
      sourceEvidence: exercise.source_evidence,
    },
  });
}

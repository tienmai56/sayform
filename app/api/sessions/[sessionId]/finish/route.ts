import { NextResponse } from 'next/server';
import { apiError, databaseError, parseBody, requireApiUser } from '@/lib/api-response';
import { mockSessionSummary } from '@/lib/analysis/mock-provider';
import { finishSessionSchema } from '@/lib/validation';

type RouteParams = { params: Promise<{ sessionId: string }> };

export async function POST(request: Request, { params }: RouteParams) {
  const context = await requireApiUser();
  if ('error' in context) return context.error;
  const body = await parseBody(request, finishSessionSchema);
  if ('error' in body) return body.error;
  const { sessionId } = await params;

  const { data: session, error: sessionError } = await context.supabase
    .from('sessions')
    .select('id, status, created_at, title')
    .eq('id', sessionId)
    .eq('user_id', context.userId)
    .maybeSingle();
  if (sessionError) return databaseError(sessionError);
  if (!session) return apiError(404, 'session_not_found', 'Practice session not found.');

  const { data: responses, error: responsesError } = await context.supabase
    .from('responses')
    .select('id, duration_seconds, response_metrics(average_wpm, filler_count)')
    .eq('session_id', sessionId)
    .eq('user_id', context.userId)
    .eq('status', 'completed');
  if (responsesError) return databaseError(responsesError);

  const completedResponses = responses ?? [];
  const totalDuration = completedResponses.reduce((total, response) => total + response.duration_seconds, 0);
  const metricRows = completedResponses.flatMap((response) => response.response_metrics ?? []);
  const averageWpm = metricRows.length
    ? Math.round(metricRows.reduce((total, metrics) => total + metrics.average_wpm, 0) / metricRows.length)
    : 0;
  const fillerCount = metricRows.reduce((total, metrics) => total + metrics.filler_count, 0);
  const completedAt = new Date().toISOString();

  const { error: updateError } = await context.supabase
    .from('sessions')
    .update({
      status: 'completed',
      completed_at: completedAt,
      duration_seconds: totalDuration,
      average_wpm: averageWpm,
      filler_count: fillerCount,
      takeaway: mockSessionSummary.takeaway,
      title: body.data.title ?? session.title,
    })
    .eq('id', sessionId)
    .eq('user_id', context.userId);
  if (updateError) return databaseError(updateError);

  const { data: existingExercise, error: exerciseReadError } = await context.supabase
    .from('exercises')
    .select('id')
    .eq('session_id', sessionId)
    .eq('user_id', context.userId)
    .maybeSingle();
  if (exerciseReadError) return databaseError(exerciseReadError);

  let exerciseId = existingExercise?.id;
  if (!exerciseId) {
    const { data: exercise, error: exerciseError } = await context.supabase
      .from('exercises')
      .insert({
        user_id: context.userId,
        session_id: sessionId,
        response_id: completedResponses.at(-1)?.id ?? null,
        exercise_type: 'rephrase',
        title: mockSessionSummary.exercise.title,
        prompt: mockSessionSummary.exercise.prompt,
        source_evidence: mockSessionSummary.exercise.sourceEvidence,
      })
      .select('id')
      .single();
    if (exerciseError) return databaseError(exerciseError);
    exerciseId = exercise.id;
  }

  const { error: summaryError } = await context.supabase.from('session_summaries').upsert({
    session_id: sessionId,
    user_id: context.userId,
    summary: mockSessionSummary.summary,
    strengths: mockSessionSummary.strengths,
    opportunities: mockSessionSummary.opportunities,
    recommended_exercise_id: exerciseId,
  });
  if (summaryError) return databaseError(summaryError);

  return NextResponse.json({
    session: {
      id: sessionId,
      status: 'completed',
      answers: completedResponses.length,
      durationSeconds: totalDuration,
      averageWpm,
      fillerCount,
    },
    summary: mockSessionSummary,
    exerciseId,
  });
}

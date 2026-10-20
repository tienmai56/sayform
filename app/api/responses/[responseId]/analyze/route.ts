import { NextResponse } from 'next/server';
import { apiError, databaseError, parseBody, requireApiUser } from '@/lib/api-response';
import { createMockAnalysis } from '@/lib/analysis/mock-provider';
import { analyzeResponseSchema } from '@/lib/validation';

type RouteParams = { params: Promise<{ responseId: string }> };

export async function POST(request: Request, { params }: RouteParams) {
  const context = await requireApiUser();
  if ('error' in context) return context.error;
  const body = await parseBody(request, analyzeResponseSchema);
  if ('error' in body) return body.error;
  const { responseId } = await params;

  const { data: response, error: responseError } = await context.supabase
    .from('responses')
    .select('id, session_id, duration_seconds, status')
    .eq('id', responseId)
    .eq('user_id', context.userId)
    .maybeSingle();

  if (responseError) return databaseError(responseError);
  if (!response) return apiError(404, 'response_not_found', 'Response not found.');

  const { data: existingJob, error: existingJobError } = await context.supabase
    .from('analysis_jobs')
    .select('id, state')
    .eq('idempotency_key', body.data.idempotencyKey)
    .eq('user_id', context.userId)
    .maybeSingle();

  if (existingJobError) return databaseError(existingJobError);
  if (existingJob?.state === 'completed' || response.status === 'completed') {
    return NextResponse.json({ responseId, status: 'completed', reused: true });
  }

  let jobId = existingJob?.id;
  if (!jobId) {
    const { data: job, error: jobError } = await context.supabase
      .from('analysis_jobs')
      .insert({
        user_id: context.userId,
        session_id: response.session_id,
        response_id: response.id,
        state: 'queued',
        idempotency_key: body.data.idempotencyKey,
      })
      .select('id')
      .single();
    if (jobError) return databaseError(jobError);
    jobId = job.id;
  }

  const { error: analyzingError } = await context.supabase
    .from('analysis_jobs')
    .update({ state: 'analyzing', attempts: 1 })
    .eq('id', jobId)
    .eq('user_id', context.userId);
  if (analyzingError) return databaseError(analyzingError);

  const { data: session, error: sessionError } = await context.supabase
    .from('sessions')
    .select('goals(template_key)')
    .eq('id', response.session_id)
    .eq('user_id', context.userId)
    .single();
  if (sessionError) return databaseError(sessionError);
  const goalRelation = Array.isArray(session.goals) ? session.goals[0] : session.goals;
  const analysis = createMockAnalysis(response.duration_seconds, {
    goalTemplateKey: goalRelation?.template_key,
  });
  const { error: updateResponseError } = await context.supabase
    .from('responses')
    .update({ transcript: analysis.transcript, status: 'completed' })
    .eq('id', response.id)
    .eq('user_id', context.userId);
  if (updateResponseError) return databaseError(updateResponseError);

  const { error: metricsError } = await context.supabase.from('response_metrics').upsert({
    response_id: response.id,
    user_id: context.userId,
    word_count: analysis.metrics.wordCount,
    unique_word_count: analysis.metrics.uniqueWordCount,
    average_wpm: analysis.metrics.averageWpm,
    filler_count: analysis.metrics.fillerCount,
    filler_words: analysis.metrics.fillerWords,
  });
  if (metricsError) return databaseError(metricsError);

  const { data: existingFeedback, error: feedbackReadError } = await context.supabase
    .from('feedback_items')
    .select('id')
    .eq('response_id', response.id)
    .limit(1);
  if (feedbackReadError) return databaseError(feedbackReadError);

  if (!existingFeedback?.length) {
    const { error: feedbackError } = await context.supabase.from('feedback_items').upsert(
      analysis.feedback.map((item) => ({
        user_id: context.userId,
        response_id: response.id,
        dimension: item.dimension,
        skill: item.skill,
        evidence: item.evidence,
        title: item.title,
        explanation: item.explanation,
        alternatives: item.alternatives ?? [],
        positive: item.positive ?? false,
      })),
      { onConflict: 'response_id,title', ignoreDuplicates: true },
    );
    if (feedbackError) return databaseError(feedbackError);
  }

  const { error: completedError } = await context.supabase
    .from('analysis_jobs')
    .update({ state: 'completed', completed_at: new Date().toISOString() })
    .eq('id', jobId)
    .eq('user_id', context.userId);
  if (completedError) return databaseError(completedError);

  return NextResponse.json({ responseId, status: 'completed', provider: 'mock' });
}

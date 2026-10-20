import { NextResponse } from 'next/server';
import { apiError, databaseError, requireApiUser } from '@/lib/api-response';
import { generateResponseFeedback, OpenRouterRequestError, transcribeAudio } from '@/lib/analysis/openrouter-provider';
import { createSpeechMetrics } from '@/lib/analysis/speech-metrics';
import { getGoalDefinition } from '@/lib/goal-catalog';
import { analyzeResponseSchema } from '@/lib/validation';

type RouteParams = { params: Promise<{ responseId: string }> };

const maximumAudioBytes = 15 * 1024 * 1024;
const allowedAudioTypes = new Set([
  'audio/webm',
  'audio/mp4',
  'audio/ogg',
  'audio/mpeg',
  'audio/wav',
  'audio/x-m4a',
]);

function parseUpload(formData: FormData) {
  const body = analyzeResponseSchema.safeParse({ idempotencyKey: formData.get('idempotencyKey') });
  if (!body.success) return { error: apiError(400, 'invalid_request', 'The analysis request is missing its identifier.') } as const;
  const audio = formData.get('audio');
  if (!(audio instanceof File) || audio.size === 0) {
    return { error: apiError(400, 'audio_required', 'Record an answer before requesting feedback.') } as const;
  }
  const normalizedType = audio.type.split(';')[0].toLocaleLowerCase();
  if (normalizedType && !allowedAudioTypes.has(normalizedType)) {
    return { error: apiError(415, 'unsupported_audio', 'This browser produced an unsupported audio format.') } as const;
  }
  if (audio.size > maximumAudioBytes) {
    return { error: apiError(413, 'audio_too_large', 'Keep each answer under the 15 MB recording limit.') } as const;
  }
  return { data: { idempotencyKey: body.data.idempotencyKey, audio } } as const;
}

export async function POST(request: Request, { params }: RouteParams) {
  const context = await requireApiUser();
  if ('error' in context) return context.error;

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return apiError(400, 'invalid_upload', 'The audio upload could not be read.');
  }
  const upload = parseUpload(formData);
  if ('error' in upload) return upload.error;
  const { responseId } = await params;

  const { data: response, error: responseError } = await context.supabase
    .from('responses')
    .select('id, session_id, prompt, duration_seconds, status')
    .eq('id', responseId)
    .eq('user_id', context.userId)
    .maybeSingle();

  if (responseError) return databaseError(responseError);
  if (!response) return apiError(404, 'response_not_found', 'Response not found.');

  const { data: existingJob, error: existingJobError } = await context.supabase
    .from('analysis_jobs')
    .select('id, state, attempts')
    .eq('idempotency_key', upload.data.idempotencyKey)
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
        idempotency_key: upload.data.idempotencyKey,
      })
      .select('id')
      .single();
    if (jobError) return databaseError(jobError);
    jobId = job.id;
  }

  const { error: transcribingJobError } = await context.supabase
    .from('analysis_jobs')
    .update({ state: 'transcribing', attempts: (existingJob?.attempts ?? 0) + 1, last_error: null })
    .eq('id', jobId)
    .eq('user_id', context.userId);
  if (transcribingJobError) return databaseError(transcribingJobError);

  const { error: transcribingResponseError } = await context.supabase
    .from('responses')
    .update({ status: 'transcribing' })
    .eq('id', response.id)
    .eq('user_id', context.userId);
  if (transcribingResponseError) return databaseError(transcribingResponseError);

  const { data: session, error: sessionError } = await context.supabase
    .from('sessions')
    .select('goal_title, topic, goals(template_key, title, description)')
    .eq('id', response.session_id)
    .eq('user_id', context.userId)
    .single();
  if (sessionError) return databaseError(sessionError);

  const goalRelation = Array.isArray(session.goals) ? session.goals[0] : session.goals;
  const goalDefinition = getGoalDefinition(goalRelation?.template_key);

  try {
    const transcript = await transcribeAudio(upload.data.audio);
    const metrics = createSpeechMetrics(transcript, response.duration_seconds);

    await context.supabase.from('analysis_jobs').update({ state: 'analyzing' }).eq('id', jobId).eq('user_id', context.userId);
    await context.supabase.from('responses').update({ transcript, status: 'analyzing' }).eq('id', response.id).eq('user_id', context.userId);

    const feedback = await generateResponseFeedback({
      prompt: response.prompt,
      goalTitle: session.goal_title,
      goalDescription: goalRelation?.description ?? session.topic,
      goalSkills: goalDefinition?.skills ?? [],
      transcript,
      metrics,
    });

    const { error: metricsError } = await context.supabase.from('response_metrics').upsert({
      response_id: response.id,
      user_id: context.userId,
      word_count: metrics.wordCount,
      unique_word_count: metrics.uniqueWordCount,
      average_wpm: metrics.averageWpm,
      filler_count: metrics.fillerCount,
      filler_words: metrics.fillerWords,
    });
    if (metricsError) throw new Error(`Could not save response metrics: ${metricsError.message}`);

    const { error: deleteFeedbackError } = await context.supabase
      .from('feedback_items')
      .delete()
      .eq('response_id', response.id)
      .eq('user_id', context.userId);
    if (deleteFeedbackError) throw new Error(`Could not replace feedback: ${deleteFeedbackError.message}`);

    const { data: savedFeedback, error: feedbackError } = await context.supabase
      .from('feedback_items')
      .insert(
        feedback.map((item) => ({
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
      )
      .select('id, dimension, skill, evidence, title, explanation, alternatives, positive');
    if (feedbackError) throw new Error(`Could not save feedback: ${feedbackError.message}`);

    const { error: updateResponseError } = await context.supabase
      .from('responses')
      .update({ transcript, status: 'completed' })
      .eq('id', response.id)
      .eq('user_id', context.userId);
    if (updateResponseError) throw new Error(`Could not finish the response: ${updateResponseError.message}`);

    const { error: completedError } = await context.supabase
      .from('analysis_jobs')
      .update({ state: 'completed', completed_at: new Date().toISOString() })
      .eq('id', jobId)
      .eq('user_id', context.userId);
    if (completedError) throw new Error(`Could not finish the analysis job: ${completedError.message}`);

    return NextResponse.json({
      responseId,
      status: 'completed',
      provider: 'openrouter',
      analysis: {
        transcript,
        durationSeconds: response.duration_seconds,
        metrics,
        feedback: savedFeedback ?? [],
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown analysis error';
    console.error('Response analysis failed', { responseId, message });
    await Promise.all([
      context.supabase
        .from('responses')
        .update({ status: 'failed' })
        .eq('id', response.id)
        .eq('user_id', context.userId),
      context.supabase
        .from('analysis_jobs')
        .update({ state: 'failed', last_error: message.slice(0, 1000) })
        .eq('id', jobId)
        .eq('user_id', context.userId),
    ]);
    const userMessage = message === 'No speech was detected in the recording.'
      ? message
      : error instanceof OpenRouterRequestError && error.status === 402
        ? 'OpenRouter needs at least $0.50 of available balance for speech transcription. Add credit or raise this key’s usable limit, then try again.'
        : 'The speech analysis could not be completed. Please try again.';
    return apiError(error instanceof OpenRouterRequestError ? error.status : 502, 'analysis_failed', userMessage);
  }
}

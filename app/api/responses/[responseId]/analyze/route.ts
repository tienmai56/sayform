import { after, NextResponse } from 'next/server';
import { apiError, databaseError, requireApiUser } from '@/lib/api-response';
import { generateResponseFeedback, OpenRouterRequestError, transcribeAudio } from '@/lib/analysis/openrouter-provider';
import { createSpeechMetrics, timeToTranscriptEvidence } from '@/lib/analysis/speech-metrics';
import { getGoalDefinition } from '@/lib/goal-catalog';
import type { FeedbackCorrection, FeedbackDimension, FeedbackItem, FeedbackProgressStatus, ResponseMetrics } from '@/lib/types';
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

export const maxDuration = 120;

type PreviousMetricRow = {
  word_count: number;
  unique_word_count: number;
  average_wpm: number;
  filler_count: number;
  filler_words: unknown;
  time_to_main_point_seconds: number | null;
  main_point_evidence: string;
};

type PreviousFeedbackRow = {
  id: string;
  dimension: FeedbackDimension;
  skill: string;
  evidence: string;
  title: string;
  explanation: string;
  alternatives: unknown;
  corrections: unknown;
  positive: boolean;
  progress_status: FeedbackProgressStatus | null;
};

type PreviousResponseRow = {
  transcript: string | null;
  response_metrics: PreviousMetricRow | PreviousMetricRow[] | null;
  feedback_items: PreviousFeedbackRow | PreviousFeedbackRow[] | null;
};

function asArray<T>(value: T | T[] | null | undefined): T[] {
  if (!value) return [];
  return Array.isArray(value) ? value : [value];
}

function feedbackCorrections(value: unknown): FeedbackCorrection[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (!item || typeof item !== 'object') return [];
    const candidate = item as { evidence?: unknown; suggestion?: unknown };
    return typeof candidate.evidence === 'string' && typeof candidate.suggestion === 'string'
      ? [{ evidence: candidate.evidence, suggestion: candidate.suggestion }]
      : [];
  });
}

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
  return { data: { idempotencyKey: body.data.idempotencyKey, audio, generateFollowUp: formData.get('generateFollowUp') === 'true' } } as const;
}

function analysisFailureMessage(error: unknown) {
  const message = error instanceof Error ? error.message : 'Unknown analysis error';
  if (message === 'No speech was detected in the recording.') return message;
  if (error instanceof OpenRouterRequestError && error.status === 402) {
    return 'OpenRouter needs at least $0.50 of available balance for speech transcription. Add credit or raise this key’s usable limit, then try again.';
  }
  return 'The speech analysis could not be completed. Please try again.';
}

async function measure<T>(name: string, operation: PromiseLike<T>, timings: Record<string, number>) {
  const startedAt = performance.now();
  try {
    return await operation;
  } finally {
    timings[name] = Math.round(performance.now() - startedAt);
  }
}

export async function POST(request: Request, { params }: RouteParams) {
  const requestStartedAt = performance.now();
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
    .select('id, session_id, prompt, duration_seconds, sequence_number, status')
    .eq('id', responseId)
    .eq('user_id', context.userId)
    .maybeSingle();

  if (responseError) return databaseError(responseError);
  if (!response) return apiError(404, 'response_not_found', 'Response not found.');

  const { data: existingJob, error: existingJobError } = await context.supabase
    .from('analysis_jobs')
    .select('id, state, attempts, updated_at')
    .eq('idempotency_key', upload.data.idempotencyKey)
    .eq('user_id', context.userId)
    .maybeSingle();

  if (existingJobError) return databaseError(existingJobError);
  if (existingJob?.state === 'completed' || response.status === 'completed') {
    return NextResponse.json({ responseId, status: 'completed', reused: true });
  }

  const existingJobAge = existingJob?.updated_at
    ? Date.now() - new Date(existingJob.updated_at).getTime()
    : Number.POSITIVE_INFINITY;
  if (
    existingJob
    && ['queued', 'transcribing', 'analyzing'].includes(existingJob.state)
    && response.status === existingJob.state
    && existingJobAge < 120_000
  ) {
    return NextResponse.json(
      { responseId, status: existingJob.state, reused: true },
      { status: 202 },
    );
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

  const analysisJobId = jobId;
  if (!analysisJobId) return apiError(500, 'analysis_job_missing', 'The analysis job could not be created.');

  const { error: queuedJobError } = await context.supabase
    .from('analysis_jobs')
    .update({
      state: 'queued',
      attempts: (existingJob?.attempts ?? 0) + 1,
      last_error: null,
      completed_at: null,
    })
    .eq('id', analysisJobId)
    .eq('user_id', context.userId);
  if (queuedJobError) return databaseError(queuedJobError);

  const { error: queuedResponseError } = await context.supabase
    .from('responses')
    .update({ status: 'queued' })
    .eq('id', response.id)
    .eq('user_id', context.userId);
  if (queuedResponseError) return databaseError(queuedResponseError);

  after(async () => {
    const processingStartedAt = performance.now();
    const timings: Record<string, number> = {};

    try {
      const [transcribingJob, transcribingResponse] = await Promise.all([
        context.supabase
          .from('analysis_jobs')
          .update({ state: 'transcribing' })
          .eq('id', analysisJobId)
          .eq('user_id', context.userId),
        context.supabase
          .from('responses')
          .update({ status: 'transcribing' })
          .eq('id', response.id)
          .eq('user_id', context.userId),
      ]);
      if (transcribingJob.error) throw new Error(`Could not start the analysis job: ${transcribingJob.error.message}`);
      if (transcribingResponse.error) throw new Error(`Could not start transcription: ${transcribingResponse.error.message}`);

      const sessionPromise = measure(
        'sessionContextMs',
        context.supabase
          .from('sessions')
          .select('goal_title, topic, goals(template_key, title, description)')
          .eq('id', response.session_id)
          .eq('user_id', context.userId)
          .single(),
        timings,
      );
      const previousPromise = measure(
        'previousAttemptsMs',
        context.supabase
          .from('responses')
          .select('transcript, sequence_number, response_metrics(word_count, unique_word_count, average_wpm, filler_count, filler_words, time_to_main_point_seconds, main_point_evidence), feedback_items(id, dimension, skill, evidence, title, explanation, alternatives, corrections, positive, progress_status)')
          .eq('session_id', response.session_id)
          .eq('user_id', context.userId)
          .eq('prompt', response.prompt)
          .eq('status', 'completed')
          .lt('sequence_number', response.sequence_number)
          .order('sequence_number', { ascending: false })
          .limit(3),
        timings,
      );
      const transcriptPromise = measure('transcriptionMs', transcribeAudio(upload.data.audio), timings);
      const [sessionResult, previousResult, transcription] = await Promise.all([
        sessionPromise,
        previousPromise,
        transcriptPromise,
      ]);

      if (sessionResult.error) throw new Error(`Could not load session context: ${sessionResult.error.message}`);
      if (previousResult.error) throw new Error(`Could not load earlier attempts: ${previousResult.error.message}`);
      const session = sessionResult.data;
      const previousRows = previousResult.data;
      const transcript = transcription.text;
      const metrics = createSpeechMetrics(transcript, response.duration_seconds);

      const partialSaveStartedAt = performance.now();
      const [jobUpdate, responseUpdate, metricsUpdate] = await Promise.all([
        context.supabase
          .from('analysis_jobs')
          .update({ state: 'analyzing' })
          .eq('id', analysisJobId)
          .eq('user_id', context.userId),
        context.supabase
          .from('responses')
          .update({ transcript, status: 'analyzing' })
          .eq('id', response.id)
          .eq('user_id', context.userId),
        context.supabase.from('response_metrics').upsert({
          response_id: response.id,
          user_id: context.userId,
          word_count: metrics.wordCount,
          unique_word_count: metrics.uniqueWordCount,
          average_wpm: metrics.averageWpm,
          filler_count: metrics.fillerCount,
          filler_words: metrics.fillerWords,
          time_to_main_point_seconds: null,
          main_point_evidence: '',
        }),
      ]);
      if (jobUpdate.error) throw new Error(`Could not update the analysis job: ${jobUpdate.error.message}`);
      if (responseUpdate.error) throw new Error(`Could not save the transcript: ${responseUpdate.error.message}`);
      if (metricsUpdate.error) throw new Error(`Could not save response metrics: ${metricsUpdate.error.message}`);
      timings.partialSaveMs = Math.round(performance.now() - partialSaveStartedAt);

      const previousAttempts = ((previousRows ?? []) as unknown as PreviousResponseRow[]).flatMap((previous) => {
        const previousMetrics = asArray(previous.response_metrics)[0];
        if (!previous.transcript || !previousMetrics) return [];
        const normalizedMetrics: ResponseMetrics = {
          wordCount: previousMetrics.word_count,
          uniqueWordCount: previousMetrics.unique_word_count,
          averageWpm: previousMetrics.average_wpm,
          fillerCount: previousMetrics.filler_count,
          fillerWords: previousMetrics.filler_words && typeof previousMetrics.filler_words === 'object'
            ? previousMetrics.filler_words as Record<string, number>
            : {},
          timeToMainPointSeconds: previousMetrics.time_to_main_point_seconds,
          mainPointEvidence: previousMetrics.main_point_evidence,
        };
        const previousFeedback: FeedbackItem[] = asArray(previous.feedback_items).map((item) => ({
          id: item.id,
          dimension: item.dimension,
          skill: item.skill,
          evidence: item.evidence,
          title: item.title,
          explanation: item.explanation,
          alternatives: Array.isArray(item.alternatives) ? item.alternatives.filter((value): value is string => typeof value === 'string') : [],
          corrections: feedbackCorrections(item.corrections),
          positive: item.positive,
          progressStatus: item.progress_status ?? 'baseline',
        }));
        return [{ transcript: previous.transcript, metrics: normalizedMetrics, feedback: previousFeedback }];
      });

      const goalRelation = Array.isArray(session.goals) ? session.goals[0] : session.goals;
      const goalDefinition = getGoalDefinition(goalRelation?.template_key);
      const generatedFeedback = await measure(
        'feedbackGenerationMs',
        generateResponseFeedback({
          prompt: response.prompt,
          goalTitle: session.goal_title,
          goalDescription: goalRelation?.description ?? session.topic,
          goalSkills: goalDefinition?.skills ?? [],
          goalFramework: goalDefinition?.evaluationFramework,
          coachInstructions: goalDefinition?.coachInstructions,
          generateFollowUp: goalRelation?.template_key === 'clarity' && upload.data.generateFollowUp,
          transcript,
          metrics,
          previousAttempts,
        }),
        timings,
      );

      const persistenceStartedAt = performance.now();
      const timeToMainPointSeconds = generatedFeedback.mainPoint.found
        ? timeToTranscriptEvidence(transcription.words, generatedFeedback.mainPoint.evidence)
        : null;
      const { error: deleteFeedbackError } = await context.supabase
        .from('feedback_items')
        .delete()
        .eq('response_id', response.id)
        .eq('user_id', context.userId);
      if (deleteFeedbackError) throw new Error(`Could not replace feedback: ${deleteFeedbackError.message}`);

      const { error: mainPointMetricError } = await context.supabase
        .from('response_metrics')
        .update({
          time_to_main_point_seconds: timeToMainPointSeconds,
          main_point_evidence: generatedFeedback.mainPoint.evidence,
        })
        .eq('response_id', response.id)
        .eq('user_id', context.userId);
      if (mainPointMetricError) throw new Error(`Could not save time to main point: ${mainPointMetricError.message}`);

      const { error: feedbackError } = await context.supabase
        .from('feedback_items')
        .insert(
          generatedFeedback.feedback.map((item) => ({
            user_id: context.userId,
            response_id: response.id,
            dimension: item.dimension,
            skill: item.skill,
            evidence: item.evidence,
            title: item.title,
            explanation: item.explanation,
            alternatives: item.alternatives ?? [],
            corrections: item.corrections ?? [],
            positive: item.positive ?? false,
            progress_status: item.progressStatus ?? 'baseline',
          })),
        );
      if (feedbackError) throw new Error(`Could not save feedback: ${feedbackError.message}`);

      timings.persistenceMs = Math.round(performance.now() - persistenceStartedAt);
      timings.totalMs = Math.round(performance.now() - processingStartedAt);
      const [completedResponse, completedJob] = await Promise.all([
        context.supabase
          .from('responses')
          .update({ transcript, status: 'completed' })
          .eq('id', response.id)
          .eq('user_id', context.userId),
        context.supabase
          .from('analysis_jobs')
          .update({
            state: 'completed',
            completed_at: new Date().toISOString(),
          })
          .eq('id', analysisJobId)
          .eq('user_id', context.userId),
      ]);
      if (completedResponse.error) throw new Error(`Could not finish the response: ${completedResponse.error.message}`);
      if (completedJob.error) throw new Error(`Could not finish the analysis job: ${completedJob.error.message}`);

      const [followUpUpdate, timingUpdate] = await Promise.all([
        context.supabase
          .from('responses')
          .update({ follow_up_question: generatedFeedback.followUpQuestion ?? null })
          .eq('id', response.id)
          .eq('user_id', context.userId),
        context.supabase
          .from('analysis_jobs')
          .update({ timings })
          .eq('id', analysisJobId)
          .eq('user_id', context.userId),
      ]);
      if (followUpUpdate.error) console.warn('Follow-up question metadata was not saved', { responseId, message: followUpUpdate.error.message });
      if (timingUpdate.error) console.warn('Analysis timing metadata was not saved', { responseId, message: timingUpdate.error.message });

      console.info('Response analysis timing', { responseId, ...timings });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown analysis error';
      const userMessage = analysisFailureMessage(error);
      timings.totalMs = Math.round(performance.now() - processingStartedAt);
      console.error('Response analysis failed', { responseId, message, ...timings });
      await Promise.all([
        context.supabase
          .from('responses')
          .update({ status: 'failed' })
          .eq('id', response.id)
          .eq('user_id', context.userId),
        context.supabase
          .from('analysis_jobs')
          .update({ state: 'failed', last_error: userMessage })
          .eq('id', analysisJobId)
          .eq('user_id', context.userId),
      ]);
    }
  });

  const enqueueMs = Math.round(performance.now() - requestStartedAt);
  return NextResponse.json(
    { responseId, status: 'queued', provider: 'openrouter' },
    {
      status: 202,
      headers: { 'Server-Timing': `enqueue;dur=${enqueueMs}` },
    },
  );
}

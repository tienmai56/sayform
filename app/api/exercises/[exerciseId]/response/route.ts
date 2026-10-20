import { NextResponse } from 'next/server';
import { apiError, databaseError, requireApiUser } from '@/lib/api-response';
import { generateResponseFeedback, OpenRouterRequestError, transcribeAudio } from '@/lib/analysis/openrouter-provider';
import { createSpeechMetrics } from '@/lib/analysis/speech-metrics';

type RouteParams = { params: Promise<{ exerciseId: string }> };

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
  if (!(audio instanceof File) || audio.size === 0) {
    return apiError(400, 'audio_required', 'Record the exercise response before finishing.');
  }
  if (audio.size > 15 * 1024 * 1024) {
    return apiError(413, 'audio_too_large', 'Keep the exercise recording under 15 MB.');
  }

  const { exerciseId } = await params;
  const { data: exercise, error: exerciseError } = await context.supabase
    .from('exercises')
    .select('id, prompt, target_skill, session_id, sessions(goal_title)')
    .eq('id', exerciseId)
    .eq('user_id', context.userId)
    .maybeSingle();

  if (exerciseError) return databaseError(exerciseError);
  if (!exercise) return apiError(404, 'exercise_not_found', 'Exercise not found.');

  const sessionRelation = Array.isArray(exercise.sessions) ? exercise.sessions[0] : exercise.sessions;
  try {
    const transcript = await transcribeAudio(audio);
    const metrics = createSpeechMetrics(transcript, durationSeconds);
    const feedback = await generateResponseFeedback({
      prompt: exercise.prompt,
      goalTitle: sessionRelation?.goal_title ?? 'Personalized communication exercise',
      goalDescription: `Practise the target skill: ${exercise.target_skill}`,
      goalSkills: [{ title: exercise.target_skill }],
      transcript,
      metrics,
    });

    const { data, error } = await context.supabase
      .from('exercises')
      .update({
        answer_text: transcript,
        completed_at: new Date().toISOString(),
        metrics,
        coaching: { feedback },
      })
      .eq('id', exerciseId)
      .eq('user_id', context.userId)
      .select('id, target_skill, answer_text, metrics, coaching, completed_at')
      .maybeSingle();

    if (error) return databaseError(error);
    if (!data) return apiError(404, 'exercise_not_found', 'Exercise not found.');
    return NextResponse.json({
      exercise: data,
      analysis: { transcript, durationSeconds, metrics, feedback },
    });
  } catch (error) {
    console.error('Exercise analysis failed', {
      exerciseId,
      message: error instanceof Error ? error.message : 'Unknown exercise analysis error',
    });
    const userMessage = error instanceof OpenRouterRequestError && error.status === 402
      ? 'OpenRouter needs at least $0.50 of available balance for speech transcription. Add credit or raise this key’s usable limit, then try again.'
      : 'The exercise analysis could not be completed. Please try again.';
    return apiError(error instanceof OpenRouterRequestError ? error.status : 502, 'analysis_failed', userMessage);
  }
}

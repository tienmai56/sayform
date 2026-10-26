import { NextResponse } from 'next/server';
import { apiError, databaseError, requireApiUser } from '@/lib/api-response';

type RouteParams = { params: Promise<{ responseId: string }> };

export async function GET(_request: Request, { params }: RouteParams) {
  const context = await requireApiUser();
  if ('error' in context) return context.error;
  const { responseId } = await params;

  const { data, error } = await context.supabase
    .from('responses')
    .select('id, session_id, prompt, transcript, duration_seconds, sequence_number, status, response_metrics(*), feedback_items(*), analysis_jobs(state, last_error, updated_at)')
    .eq('id', responseId)
    .eq('user_id', context.userId)
    .maybeSingle();

  if (error) return databaseError(error);
  if (!data) return apiError(404, 'response_not_found', 'Response not found.');

  const { data: followUpMetadata } = await context.supabase
    .from('responses')
    .select('follow_up_question')
    .eq('id', responseId)
    .eq('user_id', context.userId)
    .maybeSingle();

  return NextResponse.json({
    response: {
      ...data,
      follow_up_question: followUpMetadata?.follow_up_question ?? null,
    },
  });
}

import { NextResponse } from 'next/server';
import { apiError, databaseError, parseBody, requireApiUser } from '@/lib/api-response';
import { exerciseResponseSchema } from '@/lib/validation';

type RouteParams = { params: Promise<{ exerciseId: string }> };

export async function POST(request: Request, { params }: RouteParams) {
  const context = await requireApiUser();
  if ('error' in context) return context.error;
  const body = await parseBody(request, exerciseResponseSchema);
  if ('error' in body) return body.error;
  const { exerciseId } = await params;

  const { data, error } = await context.supabase
    .from('exercises')
    .update({
      answer_text: body.data.answerText,
      completed_at: new Date().toISOString(),
      metrics: { wordCount: body.data.answerText.trim().split(/\s+/).length },
      coaching: {
        outcome: 'The revised response makes the target behavior more explicit.',
        nextStep: 'Carry the same specific wording into the next full practice session.',
      },
    })
    .eq('id', exerciseId)
    .eq('user_id', context.userId)
    .select('id, target_skill, answer_text, metrics, coaching, completed_at')
    .maybeSingle();

  if (error) return databaseError(error);
  if (!data) return apiError(404, 'exercise_not_found', 'Exercise not found.');
  return NextResponse.json({ exercise: data });
}

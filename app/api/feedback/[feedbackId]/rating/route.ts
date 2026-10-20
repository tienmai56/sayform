import { NextResponse } from 'next/server';
import { apiError, databaseError, parseBody, requireApiUser } from '@/lib/api-response';
import { feedbackRatingSchema } from '@/lib/validation';

type RouteParams = { params: Promise<{ feedbackId: string }> };

export async function POST(request: Request, { params }: RouteParams) {
  const context = await requireApiUser();
  if ('error' in context) return context.error;
  const body = await parseBody(request, feedbackRatingSchema);
  if ('error' in body) return body.error;
  const { feedbackId } = await params;

  const { data, error } = await context.supabase
    .from('feedback_items')
    .update({
      rating: body.data.rating,
      rating_note: body.data.note ?? null,
      dismissed: body.data.dismissed ?? false,
    })
    .eq('id', feedbackId)
    .eq('user_id', context.userId)
    .select('id, rating, dismissed')
    .maybeSingle();

  if (error) return databaseError(error);
  if (!data) return apiError(404, 'feedback_not_found', 'Feedback item not found.');
  return NextResponse.json({ feedback: data });
}

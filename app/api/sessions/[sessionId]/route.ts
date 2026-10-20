import { NextResponse } from 'next/server';
import { apiError, databaseError, requireApiUser } from '@/lib/api-response';

type RouteParams = { params: Promise<{ sessionId: string }> };

export async function GET(_request: Request, { params }: RouteParams) {
  const context = await requireApiUser();
  if ('error' in context) return context.error;
  const { sessionId } = await params;

  const { data, error } = await context.supabase
    .from('sessions')
    .select('*, responses(*, response_metrics(*), feedback_items(*)), session_summaries(*), exercises(*)')
    .eq('id', sessionId)
    .eq('user_id', context.userId)
    .maybeSingle();

  if (error) return databaseError(error);
  if (!data) return apiError(404, 'session_not_found', 'Practice session not found.');
  return NextResponse.json({ session: data });
}

export async function DELETE(_request: Request, { params }: RouteParams) {
  const context = await requireApiUser();
  if ('error' in context) return context.error;
  const { sessionId } = await params;

  const { data, error } = await context.supabase
    .from('sessions')
    .delete()
    .eq('id', sessionId)
    .eq('user_id', context.userId)
    .select('id')
    .maybeSingle();

  if (error) return databaseError(error);
  if (!data) return apiError(404, 'session_not_found', 'Practice session not found.');
  return new NextResponse(null, { status: 204 });
}

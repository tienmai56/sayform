import { NextResponse } from 'next/server';
import { apiError, databaseError, parseBody, requireApiUser } from '@/lib/api-response';
import { responseCreateSchema } from '@/lib/validation';

type RouteParams = { params: Promise<{ sessionId: string }> };

export async function POST(request: Request, { params }: RouteParams) {
  const context = await requireApiUser();
  if ('error' in context) return context.error;
  const body = await parseBody(request, responseCreateSchema);
  if ('error' in body) return body.error;
  const { sessionId } = await params;

  const { data: session, error: sessionError } = await context.supabase
    .from('sessions')
    .select('id, status')
    .eq('id', sessionId)
    .eq('user_id', context.userId)
    .maybeSingle();

  if (sessionError) return databaseError(sessionError);
  if (!session) return apiError(404, 'session_not_found', 'Practice session not found.');
  if (session.status !== 'in_progress') return apiError(409, 'session_closed', 'This session is already finished.');

  const { data, error } = await context.supabase
    .from('responses')
    .insert({
      user_id: context.userId,
      session_id: sessionId,
      prompt: body.data.prompt,
      duration_seconds: body.data.durationSeconds,
      sequence_number: body.data.sequenceNumber,
    })
    .select('id, status, created_at')
    .single();

  if (error?.code === '23505') {
    const { data: existing, error: existingError } = await context.supabase
      .from('responses')
      .select('id, status, created_at')
      .eq('session_id', sessionId)
      .eq('sequence_number', body.data.sequenceNumber)
      .single();
    if (existingError) return databaseError(existingError);
    return NextResponse.json({ response: existing });
  }
  if (error) return databaseError(error);
  return NextResponse.json({ response: data }, { status: 201 });
}

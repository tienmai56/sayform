import { NextResponse } from 'next/server';
import { databaseError, parseBody, requireApiUser } from '@/lib/api-response';
import { goalUpdateSchema } from '@/lib/validation';

type RouteParams = { params: Promise<{ goalId: string }> };

export async function PATCH(request: Request, { params }: RouteParams) {
  const context = await requireApiUser();
  if ('error' in context) return context.error;
  const body = await parseBody(request, goalUpdateSchema);
  if ('error' in body) return body.error;
  const { goalId } = await params;

  const { data, error } = await context.supabase
    .from('goals')
    .update(body.data)
    .eq('id', goalId)
    .eq('user_id', context.userId)
    .select('id, title, description, status')
    .maybeSingle();

  if (error) return databaseError(error);
  if (!data) return NextResponse.json({ error: { code: 'not_found', message: 'Goal not found.' } }, { status: 404 });
  return NextResponse.json({ goal: data });
}

import { NextResponse } from 'next/server';
import { apiError, databaseError, requireApiUser } from '@/lib/api-response';

type RouteParams = { params: Promise<{ exerciseId: string }> };
const allowedStatuses = new Set(['in_progress', 'skipped', 'abandoned']);

export async function PATCH(request: Request, { params }: RouteParams) {
  const context = await requireApiUser();
  if ('error' in context) return context.error;
  const payload = await request.json().catch(() => null) as { status?: string } | null;
  if (!payload?.status || !allowedStatuses.has(payload.status)) {
    return apiError(400, 'invalid_status', 'Choose a valid exercise status.');
  }
  const { exerciseId } = await params;
  const updates: Record<string, string> = { status: payload.status };
  if (payload.status === 'in_progress') updates.started_at = new Date().toISOString();
  const { data, error } = await context.supabase
    .from('exercises')
    .update(updates)
    .eq('id', exerciseId)
    .eq('user_id', context.userId)
    .select('id, status, started_at')
    .maybeSingle();
  if (error) return databaseError(error);
  if (!data) return apiError(404, 'exercise_not_found', 'Exercise not found.');
  return NextResponse.json({ exercise: data });
}

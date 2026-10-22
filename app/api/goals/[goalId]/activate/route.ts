import { NextResponse } from 'next/server';
import { apiError, databaseError, requireApiUser } from '@/lib/api-response';

type RouteParams = { params: Promise<{ goalId: string }> };

export async function POST(_request: Request, { params }: RouteParams) {
  const context = await requireApiUser();
  if ('error' in context) return context.error;
  const { goalId } = await params;

  const { data, error } = await context.supabase.rpc('set_active_goal', { p_goal_id: goalId });
  if (error) {
    if (error.message.includes('Goal not found or unavailable')) {
      return apiError(404, 'goal_not_found', 'The selected goal could not be made active.');
    }
    return databaseError(error);
  }

  return NextResponse.json({ activeGoalId: data });
}

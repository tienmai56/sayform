import { NextResponse } from 'next/server';
import { apiError, databaseError, parseBody, requireApiUser } from '@/lib/api-response';
import { sessionCreateSchema } from '@/lib/validation';

export async function POST(request: Request) {
  const context = await requireApiUser();
  if ('error' in context) return context.error;
  const body = await parseBody(request, sessionCreateSchema);
  if ('error' in body) return body.error;

  if (body.data.goalId) {
    const { data: goal, error: goalError } = await context.supabase
      .from('goals')
      .select('id')
      .eq('id', body.data.goalId)
      .eq('user_id', context.userId)
      .maybeSingle();

    if (goalError) return databaseError(goalError);
    if (!goal) return apiError(404, 'goal_not_found', 'The selected goal was not found.');
  }

  const { data, error } = await context.supabase
    .from('sessions')
    .insert({
      user_id: context.userId,
      goal_id: body.data.goalId ?? null,
      goal_title: body.data.goalTitle,
      title: body.data.title,
      categories: body.data.categories,
    })
    .select('id, status, created_at')
    .single();

  if (error) return databaseError(error);
  return NextResponse.json({ session: data }, { status: 201 });
}

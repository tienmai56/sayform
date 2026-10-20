import { NextResponse } from 'next/server';
import { databaseError, parseBody, requireApiUser } from '@/lib/api-response';
import { goalCreateSchema } from '@/lib/validation';

export async function GET() {
  const context = await requireApiUser();
  if ('error' in context) return context.error;

  const { data, error } = await context.supabase
    .from('goals')
    .select('id, title, description, status, created_at, updated_at, sessions(count)')
    .order('created_at', { ascending: true });

  if (error) return databaseError(error);

  return NextResponse.json({
    goals: (data ?? []).map((goal) => ({
      id: goal.id,
      title: goal.title,
      description: goal.description,
      status: goal.status,
      lastPractised: null,
      sessions: Array.isArray(goal.sessions) ? (goal.sessions[0]?.count ?? 0) : 0,
    })),
  });
}

export async function POST(request: Request) {
  const context = await requireApiUser();
  if ('error' in context) return context.error;

  const body = await parseBody(request, goalCreateSchema);
  if ('error' in body) return body.error;

  const { data, error } = await context.supabase
    .from('goals')
    .insert({ user_id: context.userId, ...body.data })
    .select('id, title, description, status')
    .single();

  if (error) return databaseError(error);
  return NextResponse.json({ goal: { ...data, lastPractised: null, sessions: 0 } }, { status: 201 });
}

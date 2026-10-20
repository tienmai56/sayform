import { NextResponse } from 'next/server';
import { databaseError, parseBody, requireApiUser } from '@/lib/api-response';
import { getGoalDefinition, goalCatalog } from '@/lib/goal-catalog';
import { goalCreateSchema } from '@/lib/validation';

export async function GET() {
  const context = await requireApiUser();
  if ('error' in context) return context.error;

  const { error: seedError } = await context.supabase.from('goals').upsert(
    goalCatalog.map((goal) => ({
      user_id: context.userId,
      template_key: goal.key,
      is_custom: false,
      title: goal.title,
      description: goal.description,
    })),
    { onConflict: 'user_id,template_key' },
  );
  if (seedError) return databaseError(seedError);

  const { data, error } = await context.supabase
    .from('goals')
    .select('id, template_key, is_custom, title, description, status, created_at, updated_at')
    .order('created_at', { ascending: true });

  if (error) return databaseError(error);

  const { data: sessions, error: sessionsError } = await context.supabase
    .from('sessions')
    .select('goal_id, completed_at')
    .eq('user_id', context.userId)
    .eq('status', 'completed');
  if (sessionsError) return databaseError(sessionsError);

  const activity = new Map<string, { sessions: number; lastPractised: string | null }>();
  for (const session of sessions ?? []) {
    if (!session.goal_id) continue;
    const current = activity.get(session.goal_id) ?? { sessions: 0, lastPractised: null };
    current.sessions += 1;
    if (session.completed_at && (!current.lastPractised || session.completed_at > current.lastPractised)) {
      current.lastPractised = session.completed_at;
    }
    activity.set(session.goal_id, current);
  }

  return NextResponse.json({
    goals: (data ?? []).map((goal) => ({
      id: goal.id,
      templateKey: goal.template_key,
      isCustom: goal.is_custom,
      title: goal.title,
      description: goal.description,
      skills: getGoalDefinition(goal.template_key)?.skills ?? [],
      defaultCategory: getGoalDefinition(goal.template_key)?.defaultCategory ?? 'spontaneous',
      status: goal.status,
      lastPractised: activity.get(goal.id)?.lastPractised ?? null,
      sessions: activity.get(goal.id)?.sessions ?? 0,
      recommended: (activity.get(goal.id)?.sessions ?? 0) === 0,
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
    .insert({ user_id: context.userId, is_custom: true, ...body.data })
    .select('id, template_key, is_custom, title, description, status')
    .single();

  if (error) return databaseError(error);
  return NextResponse.json({
    goal: {
      id: data.id,
      templateKey: data.template_key,
      isCustom: data.is_custom,
      title: data.title,
      description: data.description,
      skills: [],
      defaultCategory: 'spontaneous',
      status: data.status,
      lastPractised: null,
      sessions: 0,
      recommended: true,
    },
  }, { status: 201 });
}

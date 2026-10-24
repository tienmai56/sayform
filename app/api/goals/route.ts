import { NextResponse } from 'next/server';
import { databaseError, requireApiUser } from '@/lib/api-response';
import { getGoalDefinition, goalCatalog } from '@/lib/goal-catalog';

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
    .select('id, template_key, is_custom, is_active_goal, title, description, status, created_at, updated_at')
    .order('created_at', { ascending: true });

  if (error) return databaseError(error);

  let goalRows = data ?? [];
  if (!goalRows.some((goal) => goal.is_active_goal)) {
    const initialGoal = goalRows.find((goal) => goal.status === 'active');
    if (initialGoal) {
      const { error: activeGoalError } = await context.supabase.rpc('set_active_goal', { p_goal_id: initialGoal.id });
      if (activeGoalError) return databaseError(activeGoalError);
      goalRows = goalRows.map((goal) => ({ ...goal, is_active_goal: goal.id === initialGoal.id }));
    }
  }

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
    goals: goalRows.map((goal) => ({
      id: goal.id,
      templateKey: goal.template_key,
      isCustom: goal.is_custom,
      isActive: goal.is_active_goal,
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

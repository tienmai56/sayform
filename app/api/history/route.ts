import { NextResponse } from 'next/server';
import { databaseError, requireApiUser } from '@/lib/api-response';

export async function GET() {
  const context = await requireApiUser();
  if ('error' in context) return context.error;

  const { data, error } = await context.supabase
    .from('sessions')
    .select('id, goal_title, title, categories, duration_seconds, average_wpm, filler_count, takeaway, created_at, completed_at, responses(id), exercises(id, completed_at)')
    .eq('user_id', context.userId)
    .eq('status', 'completed')
    .order('completed_at', { ascending: false });

  if (error) return databaseError(error);

  return NextResponse.json({
    sessions: (data ?? []).map((session) => {
      const exercises = Array.isArray(session.exercises)
        ? session.exercises
        : session.exercises
          ? [session.exercises]
          : [];
      return {
        id: session.id,
        date: new Intl.DateTimeFormat('en-US', { dateStyle: 'medium', timeStyle: 'short' }).format(
          new Date(session.completed_at ?? session.created_at),
        ),
        goal: session.goal_title,
        categories: session.categories,
        duration: `${Math.max(1, Math.round(session.duration_seconds / 60))} min`,
        answers: session.responses?.length ?? 0,
        averageWpm: session.average_wpm,
        fillerCount: session.filler_count,
        title: session.title,
        takeaway: session.takeaway,
        hasExercise: exercises.some((exercise) => Boolean(exercise.completed_at)),
      };
    }),
  });
}

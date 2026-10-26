'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowRight, Clock3, Dumbbell, Target } from 'lucide-react';
import { AppShell, PageHeader, Screen } from '@/components/app-shell';
import { usePractice } from '@/components/practice-context';
import { Button } from '@/components/ui/button';
import { listGoalExercises, listGoals, updateExerciseStatus } from '@/lib/client-data';
import type { Goal, GoalExercise } from '@/lib/types';
import { cn } from '@/lib/utils';

const exerciseStatusCopy: Record<GoalExercise['status'], { label: string; className: string }> = {
  recommended: { label: 'Ready to practise', className: 'bg-[#f0ecff] text-[#6842d8]' },
  in_progress: { label: 'In progress', className: 'bg-[#e7eef6] text-[#3e6078]' },
  completed: { label: 'Completed', className: 'bg-[#f0ecff] text-[#6842d8]' },
  skipped: { label: 'Saved for later', className: 'bg-[var(--warm)] text-[var(--muted-ink)]' },
  abandoned: { label: 'Saved for later', className: 'bg-[var(--warm)] text-[var(--muted-ink)]' },
};

export function ExercisesView() {
  const router = useRouter();
  const { updateSetup, resetSession, startExercise: beginExercise } = usePractice();
  const [activeGoal, setActiveGoal] = useState<Goal | null>(null);
  const [exercises, setExercises] = useState<GoalExercise[]>([]);
  const [startingId, setStartingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const goals = await listGoals();
        const goal = goals.find((item) => item.templateKey === 'clarity' && item.status === 'active') ?? null;
        if (cancelled) return;
        setActiveGoal(goal);
        if (!goal) return;
        const savedExercises = await listGoalExercises(goal.id);
        if (!cancelled) setExercises(savedExercises);
      } catch (caught) {
        if (!cancelled) setError(caught instanceof Error ? caught.message : 'Personalized exercises could not be loaded.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => { cancelled = true; };
  }, []);

  async function startSavedExercise(exercise: GoalExercise) {
    if (!activeGoal || exercise.nextStep.stage === 'summary') return;
    setStartingId(exercise.id);
    setError('');
    try {
      await updateExerciseStatus(exercise.id, 'in_progress');
      resetSession();
      updateSetup({
        goalId: activeGoal.id,
        goalTitle: activeGoal.title,
        goalTemplateKey: activeGoal.templateKey,
        goalSkills: activeGoal.skills,
        categories: [activeGoal.defaultCategory],
        customTopic: '',
      });
      beginExercise(exercise, exercise.nextStep);
      router.push('/practice/session');
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'The personalized exercise could not be opened.');
      setStartingId(null);
    }
  }

  return (
    <AppShell>
      <Screen wide>
        <PageHeader
          title="Personalized exercises"
          description={activeGoal ? `Practice recommendations created from your feedback for ${activeGoal.title.toLocaleLowerCase()}.` : 'Practice recommendations created from your personal feedback.'}
        />

        {error && <div role="alert" className="mb-5 flex items-center justify-between rounded-xl border border-[#e8c6bf] bg-[var(--rose-soft)] px-4 py-3 text-sm text-[#8f4336]"><span>{error}</span><button onClick={() => setError('')} className="text-xs font-semibold hover:underline">Dismiss</button></div>}

        {loading ? (
          <div className="grid min-h-[420px] place-items-center rounded-3xl border border-[var(--line)] bg-[var(--paper)] text-sm text-[var(--muted-ink)]">Loading personalized exercises…</div>
        ) : !activeGoal ? (
          <div className="grid min-h-[420px] place-items-center rounded-3xl border border-dashed border-[#d8cced] bg-[var(--paper)] px-8 text-center">
            <div className="max-w-md"><Target className="mx-auto size-9 text-[var(--teal)]" /><h2 className="mt-4 font-display text-xl font-semibold text-[var(--navy)]">Choose an active goal first</h2><p className="mt-2 text-base leading-7 text-[var(--muted-ink)]">Exercises are organized around the communication goal you are currently practising.</p><Button nativeButton={false} render={<Link href="/goals" />} className="mt-5 rounded-xl bg-[var(--navy)]">Go to Home <ArrowRight className="ml-1 size-4" /></Button></div>
          </div>
        ) : !exercises.length ? (
          <div className="grid min-h-[420px] place-items-center rounded-3xl border border-dashed border-[#d8cced] bg-[var(--paper)] px-8 text-center">
            <div className="max-w-md"><span className="mx-auto grid size-12 place-items-center rounded-2xl bg-[var(--mint-soft)] text-[var(--teal-dark)]"><Dumbbell className="size-5" /></span><h2 className="mt-5 font-display text-xl font-semibold text-[var(--navy)]">No exercises for {activeGoal.title.toLocaleLowerCase()} yet</h2><p className="mt-2 text-base leading-7 text-[var(--muted-ink)]">Complete a practice session first. Sayform will create an evidence-linked exercise from your feedback.</p><Button nativeButton={false} render={<Link href="/goals" />} className="mt-5 rounded-xl bg-[var(--navy)]">Go to Home <ArrowRight className="ml-1 size-4" /></Button></div>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-4">
            {exercises.map((exercise) => {
              const status = exerciseStatusCopy[exercise.status];
              const date = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).format(new Date(exercise.createdAt));
              return (
                <article key={exercise.id} className="flex min-h-[330px] flex-col rounded-2xl border border-[var(--line)] bg-white p-6 shadow-[var(--shadow-sm)]">
                  <div className="flex items-start justify-between gap-4"><span className="grid size-10 shrink-0 place-items-center rounded-xl bg-[var(--mint-soft)] text-[var(--teal-dark)]"><Dumbbell className="size-5" /></span><span className={cn('rounded-full px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.07em]', status.className)}>{status.label}</span></div>
                  <p className="mt-5 text-[10px] font-semibold uppercase tracking-[0.1em] text-[#6842d8]">Skill · {exercise.targetSkill}</p>
                  <h2 className="mt-2 font-display text-xl font-semibold leading-7 text-[var(--navy)]">{exercise.title}</h2>
                  <p className="mt-3 text-base leading-7 text-[var(--muted-ink)]">{exercise.targetBehavior}</p>
                  <div className="mt-auto pt-5">
                    <div className="flex items-center justify-between border-t border-[var(--line)] pt-4 text-xs text-[var(--muted-ink)]"><span><Clock3 className="mr-1 inline size-3.5" />{exercise.estimatedMinutes} min</span><span>{date}</span></div>
                    <div className="mt-4 flex items-center justify-end gap-3">
                      <Button size="sm" disabled={Boolean(startingId)} onClick={() => void startSavedExercise(exercise)} className="rounded-xl bg-[var(--navy)] hover:bg-[#4c1d95]">{startingId === exercise.id ? 'Opening…' : exercise.attemptCount ? 'Continue exercise' : 'Start exercise'} <ArrowRight className="ml-1 size-3.5" /></Button>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </Screen>
    </AppShell>
  );
}

'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Archive, ArrowRight, CalendarDays, CheckCircle2, MoreHorizontal, Pencil, Plus, Sparkles } from 'lucide-react';
import { AppShell, PageHeader, Screen } from '@/components/app-shell';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { goals as initialGoals } from '@/lib/mock-data';
import type { Goal } from '@/lib/types';
import { usePractice } from '@/components/practice-context';

export function GoalsView() {
  const router = useRouter();
  const { updateSetup } = usePractice();
  const [goals, setGoals] = useState<Goal[]>(initialGoals);
  const [editing, setEditing] = useState<Goal | null>(null);
  const [draftTitle, setDraftTitle] = useState('');
  const [notice, setNotice] = useState('');

  const activeGoals = goals.filter((goal) => goal.status === 'active');

  function startPractice(goal: Goal) {
    updateSetup({ goalId: goal.id, goalTitle: goal.title });
    router.push('/practice/setup');
  }

  function openEdit(goal: Goal) {
    setEditing(goal);
    setDraftTitle(goal.title);
  }

  function saveEdit() {
    if (!editing || !draftTitle.trim()) return;
    setGoals((current) => current.map((goal) => (goal.id === editing.id ? { ...goal, title: draftTitle.trim() } : goal)));
    setEditing(null);
    setNotice('Goal updated');
  }

  function changeStatus(goal: Goal, status: Goal['status']) {
    setGoals((current) => current.map((item) => (item.id === goal.id ? { ...item, status } : item)));
    setNotice(status === 'completed' ? 'Goal marked complete' : 'Goal archived');
  }

  return (
    <AppShell>
      <Screen>
        <PageHeader
          eyebrow="Goals"
          title="What are you working on?"
          description="Choose one primary goal for each practice session. Your coach will prioritize feedback that helps you move it forward."
          action={
            <Button
              variant="outline"
              size="lg"
              className="h-10 rounded-xl border-[var(--line)] bg-white px-4"
              onClick={() => {
                const goal: Goal = {
                  id: `goal-${Date.now()}`,
                  title: 'New communication goal',
                  description: 'Add a description that makes the practice goal specific.',
                  status: 'active',
                  lastPractised: null,
                  sessions: 0,
                  recommended: true,
                };
                setGoals((current) => [...current, goal]);
                openEdit(goal);
              }}
            >
              <Plus className="size-4" />
              Add goal
            </Button>
          }
        />

        {notice && (
          <div className="mb-5 flex items-center justify-between rounded-xl border border-[var(--mint)] bg-[var(--mint-soft)] px-4 py-3 text-sm text-[var(--teal-dark)]">
            <span className="flex items-center gap-2"><CheckCircle2 className="size-4" />{notice}</span>
            <button onClick={() => setNotice('')} className="text-xs font-semibold hover:underline">Dismiss</button>
          </div>
        )}

        <div className="grid grid-cols-3 gap-5">
          {activeGoals.map((goal, index) => (
            <article key={goal.id} className="group flex min-h-[310px] flex-col rounded-3xl border border-[var(--line)] bg-[var(--paper)] p-6 shadow-[var(--shadow-sm)] transition-all hover:-translate-y-0.5 hover:shadow-lg">
              <div className="flex items-start justify-between">
                <div className="flex flex-wrap gap-2">
                  {goal.recommended && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-[var(--amber-soft)] px-2.5 py-1 text-[11px] font-semibold text-[#815e1b]">
                      <Sparkles className="size-3" /> Recommended
                    </span>
                  )}
                  <span className="rounded-full bg-[var(--warm)] px-2.5 py-1 text-[11px] font-semibold text-[var(--muted-ink)]">Goal {index + 1}</span>
                </div>
                <MoreHorizontal className="size-5 text-[var(--muted-ink)]" />
              </div>

              <h2 className="mt-7 font-display text-[22px] font-semibold leading-7 tracking-[-0.025em] text-[var(--navy)]">{goal.title}</h2>
              <p className="mt-2 text-sm leading-6 text-[var(--muted-ink)]">{goal.description}</p>

              <div className="mt-auto pt-6">
                <div className="mb-4 flex items-center justify-between border-t border-[var(--line)] pt-4 text-xs text-[var(--muted-ink)]">
                  <span className="flex items-center gap-1.5"><CalendarDays className="size-3.5" />{goal.lastPractised ? `Last practised ${goal.lastPractised}` : 'Not practised yet'}</span>
                  <span>{goal.sessions} {goal.sessions === 1 ? 'session' : 'sessions'}</span>
                </div>
                <Button onClick={() => startPractice(goal)} className="h-10 w-full rounded-xl bg-[var(--navy)] hover:bg-[#1d4255]">
                  Practise this goal <ArrowRight className="ml-1 size-4" />
                </Button>
                <div className="mt-3 flex items-center justify-center gap-1 text-xs text-[var(--muted-ink)] opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100">
                  <button onClick={() => openEdit(goal)} className="flex items-center gap-1 rounded-md px-2 py-1.5 hover:bg-[var(--warm)]"><Pencil className="size-3" />Edit</button>
                  <button onClick={() => changeStatus(goal, 'completed')} className="flex items-center gap-1 rounded-md px-2 py-1.5 hover:bg-[var(--warm)]"><CheckCircle2 className="size-3" />Complete</button>
                  <button onClick={() => changeStatus(goal, 'archived')} className="flex items-center gap-1 rounded-md px-2 py-1.5 hover:bg-[var(--warm)]"><Archive className="size-3" />Archive</button>
                </div>
              </div>
            </article>
          ))}
        </div>

        <div className="mt-8 flex items-center justify-between rounded-2xl border border-dashed border-[#bcc8c4] bg-transparent px-5 py-4">
          <div>
            <p className="text-sm font-semibold text-[var(--navy)]">Your first session is your baseline</p>
            <p className="mt-1 text-xs text-[var(--muted-ink)]">No assessment or score is required before you start practising.</p>
          </div>
          <span className="text-xs font-medium text-[var(--teal-dark)]">Suggested session · about 10 minutes</span>
        </div>
      </Screen>

      <Dialog open={Boolean(editing)} onOpenChange={(open) => !open && setEditing(null)}>
        <DialogContent className="max-w-md rounded-2xl p-6">
          <DialogHeader>
            <DialogTitle className="font-display text-xl text-[var(--navy)]">Edit communication goal</DialogTitle>
            <DialogDescription>Make the goal specific enough to guide your practice feedback.</DialogDescription>
          </DialogHeader>
          <Input value={draftTitle} onChange={(event) => setDraftTitle(event.target.value)} className="h-11" />
          <DialogFooter className="-mx-6 -mb-6 mt-2 px-6 py-4">
            <Button variant="outline" onClick={() => setEditing(null)}>Cancel</Button>
            <Button onClick={saveEdit}>Save goal</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}

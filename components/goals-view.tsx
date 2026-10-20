'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Archive, ArrowRight, CalendarDays, CheckCircle2, Pencil, Plus, Sparkles, Target } from 'lucide-react';
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
import { Textarea } from '@/components/ui/textarea';
import type { Goal } from '@/lib/types';
import { getPracticeQuestions } from '@/lib/goal-catalog';
import { usePractice } from '@/components/practice-context';
import { createGoal, listGoals, updateGoal } from '@/lib/client-data';

function formatLastPractised(value: string | null) {
  if (!value) return 'Not practised yet';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return `Last practised ${new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' }).format(date)}`;
}

export function GoalsView() {
  const router = useRouter();
  const { updateSetup, resetSession } = usePractice();
  const [goals, setGoals] = useState<Goal[]>([]);
  const [editing, setEditing] = useState<Goal | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [draftTitle, setDraftTitle] = useState('');
  const [draftDescription, setDraftDescription] = useState('');
  const [notice, setNotice] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    void listGoals()
      .then(setGoals)
      .catch((caught) => setError(caught instanceof Error ? caught.message : 'Goals could not be loaded.'))
      .finally(() => setLoading(false));
  }, []);

  const activeGoals = goals.filter((goal) => goal.status === 'active');

  function startPractice(goal: Goal) {
    const questions = getPracticeQuestions(goal.templateKey);
    resetSession();
    updateSetup({
      goalId: goal.id,
      goalTitle: goal.title,
      goalTemplateKey: goal.templateKey,
      goalSkills: goal.skills,
      categories: [goal.defaultCategory],
      customTopic: '',
      prompt: questions[0],
    });
    router.push('/practice/session');
  }

  function openCreate() {
    setEditing(null);
    setDraftTitle('');
    setDraftDescription('');
    setDialogOpen(true);
  }

  function openEdit(goal: Goal) {
    setEditing(goal);
    setDraftTitle(goal.title);
    setDraftDescription(goal.description);
    setDialogOpen(true);
  }

  async function saveGoal() {
    if (draftTitle.trim().length < 3) return;
    setSaving(true);
    setError('');
    try {
      if (editing) {
        await updateGoal(editing.id, { title: draftTitle.trim(), description: draftDescription.trim() });
        setGoals((current) => current.map((goal) => (
          goal.id === editing.id
            ? { ...goal, title: draftTitle.trim(), description: draftDescription.trim() }
            : goal
        )));
        setNotice('Custom goal updated');
      } else {
        const goal = await createGoal({ title: draftTitle.trim(), description: draftDescription.trim() });
        setGoals((current) => current.some((item) => item.id === goal.id) ? current : [...current, goal]);
        setNotice('Custom goal created');
      }
      setDialogOpen(false);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Goal could not be saved.');
    } finally {
      setSaving(false);
    }
  }

  async function changeStatus(goal: Goal, status: Goal['status']) {
    try {
      await updateGoal(goal.id, { status });
      setGoals((current) => current.map((item) => (item.id === goal.id ? { ...item, status } : item)));
      setNotice(status === 'completed' ? 'Goal marked complete' : 'Goal archived');
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Goal could not be updated.');
    }
  }

  return (
    <AppShell>
      <Screen>
        <PageHeader
          eyebrow="Your communication goals"
          title="What would you like to practise?"
          description="Choose one goal for this session. Each goal contains specific skills your coach will look for in your answers."
          action={(
            <Button variant="outline" size="lg" className="h-10 rounded-xl border-[var(--line)] bg-white px-4" onClick={openCreate}>
              <Plus className="size-4" /> Create custom goal
            </Button>
          )}
        />

        {notice && (
          <div className="mb-5 flex items-center justify-between rounded-xl border border-[var(--mint)] bg-[var(--mint-soft)] px-4 py-3 text-sm text-[var(--teal-dark)]">
            <span className="flex items-center gap-2"><CheckCircle2 className="size-4" />{notice}</span>
            <button onClick={() => setNotice('')} className="text-xs font-semibold hover:underline">Dismiss</button>
          </div>
        )}

        {error && (
          <div role="alert" className="mb-5 flex items-center justify-between rounded-xl border border-[#e8c6bf] bg-[var(--rose-soft)] px-4 py-3 text-sm text-[#8f4336]">
            <span>{error}</span><button onClick={() => setError('')} className="text-xs font-semibold hover:underline">Dismiss</button>
          </div>
        )}

        {loading ? (
          <div className="grid min-h-80 place-items-center rounded-3xl border border-dashed border-[#bcc8c4] bg-white/45 text-sm text-[var(--muted-ink)]">Loading your goals…</div>
        ) : activeGoals.length === 0 ? (
          <div className="grid min-h-80 place-items-center rounded-3xl border border-dashed border-[#bcc8c4] bg-white/45 text-center">
            <div><Target className="mx-auto size-8 text-[var(--teal)]" /><h2 className="mt-4 text-base font-semibold text-[var(--navy)]">No active goals</h2><p className="mt-1 text-sm text-[var(--muted-ink)]">Create a custom goal to continue practising.</p><Button onClick={openCreate} className="mt-5 rounded-xl">Create custom goal</Button></div>
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-5">
            {activeGoals.map((goal) => (
              <article key={goal.id} className="group flex min-h-[390px] flex-col rounded-3xl border border-[var(--line)] bg-[var(--paper)] p-6 shadow-[var(--shadow-sm)] transition-all hover:-translate-y-0.5 hover:shadow-lg">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex flex-wrap gap-2">
                    {goal.recommended && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-[var(--amber-soft)] px-2.5 py-1 text-[11px] font-semibold text-[#815e1b]">
                        <Sparkles className="size-3" /> Recommended
                      </span>
                    )}
                    <span className="rounded-full bg-[var(--warm)] px-2.5 py-1 text-[11px] font-semibold text-[var(--muted-ink)]">
                      {goal.isCustom ? 'Custom goal' : `${goal.skills.length} skills`}
                    </span>
                  </div>
                  <Target className="size-5 shrink-0 text-[var(--teal)]" />
                </div>

                <h2 className="mt-6 font-display text-[24px] font-semibold leading-7 tracking-[-0.025em] text-[var(--navy)]">{goal.title}</h2>
                <p className="mt-2 text-sm leading-6 text-[var(--muted-ink)]">{goal.description}</p>

                <div className="mt-5 flex flex-wrap gap-2">
                  {goal.skills.length ? goal.skills.slice(0, 4).map((skill) => (
                    <span key={skill.id} className="rounded-full border border-[var(--line)] bg-white px-2.5 py-1 text-[11px] font-medium text-[#52666e]">
                      {skill.title}
                    </span>
                  )) : (
                    <span className="rounded-full border border-[var(--line)] bg-white px-2.5 py-1 text-[11px] font-medium text-[#52666e]">Coach identifies the skill focus</span>
                  )}
                  {goal.skills.length > 4 && <span className="px-1 py-1 text-[11px] font-medium text-[var(--muted-ink)]">+{goal.skills.length - 4} more</span>}
                </div>

                <div className="mt-auto pt-6">
                  <div className="mb-4 flex items-center justify-between border-t border-[var(--line)] pt-4 text-xs text-[var(--muted-ink)]">
                    <span className="flex items-center gap-1.5"><CalendarDays className="size-3.5" />{formatLastPractised(goal.lastPractised)}</span>
                    <span>{goal.sessions} {goal.sessions === 1 ? 'session' : 'sessions'}</span>
                  </div>
                  <Button onClick={() => startPractice(goal)} className="h-10 w-full rounded-xl bg-[var(--navy)] hover:bg-[#1d4255]">
                    Practise this goal <ArrowRight className="ml-1 size-4" />
                  </Button>
                  <div className="mt-3 flex items-center justify-center gap-1 text-xs text-[var(--muted-ink)] opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100">
                    {goal.isCustom && <button onClick={() => openEdit(goal)} className="flex items-center gap-1 rounded-md px-2 py-1.5 hover:bg-[var(--warm)]"><Pencil className="size-3" />Edit</button>}
                    <button onClick={() => void changeStatus(goal, 'completed')} className="flex items-center gap-1 rounded-md px-2 py-1.5 hover:bg-[var(--warm)]"><CheckCircle2 className="size-3" />Complete</button>
                    <button onClick={() => void changeStatus(goal, 'archived')} className="flex items-center gap-1 rounded-md px-2 py-1.5 hover:bg-[var(--warm)]"><Archive className="size-3" />Archive</button>
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}

        <div className="mt-8 flex items-center justify-between rounded-2xl border border-dashed border-[#bcc8c4] bg-transparent px-5 py-4">
          <div><p className="text-sm font-semibold text-[var(--navy)]">Your first session is your baseline</p><p className="mt-1 text-xs text-[var(--muted-ink)]">No assessment is required. Choose a goal and start with a real speaking question.</p></div>
          <span className="text-xs font-medium text-[var(--teal-dark)]">Suggested session · about 10 minutes</span>
        </div>
      </Screen>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg rounded-2xl p-6">
          <DialogHeader>
            <DialogTitle className="font-display text-xl text-[var(--navy)]">{editing ? 'Edit custom goal' : 'Create a custom goal'}</DialogTitle>
            <DialogDescription>Describe the communication outcome you want to practise. The coach will identify relevant skills from your responses.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div><label htmlFor="goal-title" className="text-sm font-semibold text-[var(--navy)]">Goal</label><Input id="goal-title" value={draftTitle} onChange={(event) => setDraftTitle(event.target.value)} placeholder="Example: Present technical recommendations to executives" className="mt-2 h-11" /></div>
            <div><label htmlFor="goal-description" className="text-sm font-semibold text-[var(--navy)]">What would improvement look like?</label><Textarea id="goal-description" value={draftDescription} onChange={(event) => setDraftDescription(event.target.value)} placeholder="Describe the audience, situation, or result you want." className="mt-2 min-h-24 resize-none" /></div>
          </div>
          <DialogFooter className="-mx-6 -mb-6 mt-2 px-6 py-4">
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button disabled={draftTitle.trim().length < 3 || saving} onClick={() => void saveGoal()}>{saving ? 'Saving…' : editing ? 'Save goal' : 'Create goal'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}

'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowRight, Check, PencilLine, Sparkles } from 'lucide-react';
import { Brand } from '@/components/app-shell';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { goalTemplates } from '@/lib/mock-data';
import { cn } from '@/lib/utils';
import { usePractice } from '@/components/practice-context';

export function OnboardingView() {
  const router = useRouter();
  const { updateSetup } = usePractice();
  const [selected, setSelected] = useState<string[]>(['clarity']);
  const [customGoal, setCustomGoal] = useState('');

  function toggleGoal(id: string) {
    setSelected((current) =>
      current.includes(id) ? current.filter((item) => item !== id) : [...current, id],
    );
  }

  function continueToGoals() {
    const primary = goalTemplates.find((goal) => goal.id === selected[0]);
    if (primary) updateSetup({ goalId: primary.id, goalTitle: primary.title });
    if (!primary && customGoal.trim()) {
      updateSetup({ goalId: 'custom', goalTitle: customGoal.trim() });
    }
    router.push('/goals');
  }

  const canContinue = selected.length > 0 || customGoal.trim().length > 2;

  return (
    <main className="grid min-h-screen grid-cols-[minmax(0,1fr)_minmax(540px,0.92fr)] bg-[var(--paper)]">
      <section className="relative flex min-h-screen flex-col overflow-hidden bg-[var(--navy)] px-16 py-10 text-white">
        <div className="absolute -left-24 top-28 size-80 rounded-full bg-[var(--teal)]/20 blur-3xl" />
        <div className="absolute -bottom-24 right-12 size-96 rounded-full bg-[#d9b775]/10 blur-3xl" />
        <div className="relative [&_a]:text-white [&_span:first-child]:bg-white [&_span:first-child]:text-[var(--navy)] [&_span:last-child]:text-white">
          <Brand />
        </div>

        <div className="relative my-auto max-w-[620px] py-16">
          <p className="mb-5 text-xs font-semibold uppercase tracking-[0.16em] text-[var(--mint)]">Your personal speaking gym</p>
          <h1 className="font-display text-[58px] font-semibold leading-[1.02] tracking-[-0.055em]">
            Make every answer a coaching opportunity.
          </h1>
          <p className="mt-7 max-w-[540px] text-lg leading-8 text-white/70">
            Practice spontaneous English on camera, understand exactly what worked, and improve one response at a time.
          </p>

          <div className="mt-12 grid grid-cols-3 gap-3">
            {[
              ['01', 'Choose a goal'],
              ['02', 'Answer on camera'],
              ['03', 'Apply feedback'],
            ].map(([number, label], index) => (
              <div key={number} className="border-t border-white/20 pt-4">
                <span className="text-xs font-semibold text-[var(--mint)]">{number}</span>
                <p className="mt-1.5 text-sm font-medium text-white/85">{label}</p>
                {index === 0 && <div className="mt-4 h-1 w-10 rounded-full bg-[var(--mint)]" />}
              </div>
            ))}
          </div>
        </div>

        <p className="relative text-xs leading-5 text-white/45">Desktop prototype · English speaking practice</p>
      </section>

      <section className="flex min-h-screen flex-col px-16 py-10">
        <div className="flex justify-end text-sm text-[var(--muted-ink)]">
          Already have an account? <button className="ml-1 font-semibold text-[var(--teal-dark)] hover:underline">Log in</button>
        </div>

        <div className="my-auto w-full max-w-[650px] py-12">
          <div className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.13em] text-[var(--teal-dark)]">
            <Sparkles className="size-4" />
            Let’s personalize your practice
          </div>
          <h2 className="font-display text-[38px] font-semibold tracking-[-0.04em] text-[var(--navy)]">What would you like to improve?</h2>
          <p className="mt-2 text-[15px] leading-6 text-[var(--muted-ink)]">Choose one or more goals. You can edit these anytime.</p>

          <div className="mt-8 grid grid-cols-2 gap-3">
            {goalTemplates.map((goal) => {
              const isSelected = selected.includes(goal.id);
              return (
                <button
                  key={goal.id}
                  type="button"
                  onClick={() => toggleGoal(goal.id)}
                  className={cn(
                    'relative min-h-36 rounded-2xl border p-5 text-left shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md',
                    isSelected
                      ? 'border-[var(--teal)] bg-[var(--mint-soft)] ring-1 ring-[var(--teal)]/20'
                      : 'border-[var(--line)] bg-white hover:border-[#b8c7c2]',
                  )}
                  aria-pressed={isSelected}
                >
                  <span
                    className={cn(
                      'absolute right-4 top-4 grid size-6 place-items-center rounded-full border',
                      isSelected ? 'border-[var(--teal)] bg-[var(--teal)] text-white' : 'border-[var(--line)] bg-white text-transparent',
                    )}
                  >
                    <Check className="size-3.5" strokeWidth={3} />
                  </span>
                  <p className="pr-8 text-[15px] font-semibold text-[var(--navy)]">{goal.title}</p>
                  <p className="mt-2 text-sm leading-5 text-[var(--muted-ink)]">{goal.description}</p>
                </button>
              );
            })}
          </div>

          <div className="mt-4 rounded-2xl border border-[var(--line)] bg-white p-4">
            <label htmlFor="custom-goal" className="mb-2 flex items-center gap-2 text-sm font-semibold text-[var(--navy)]">
              <PencilLine className="size-4 text-[var(--teal)]" />
              Or write your own goal
            </label>
            <Input
              id="custom-goal"
              value={customGoal}
              onChange={(event) => setCustomGoal(event.target.value)}
              placeholder="Example: Explain technical decisions to non-technical leaders"
              className="h-11 border-0 bg-[var(--canvas)] px-4 text-sm shadow-none focus-visible:ring-2"
            />
          </div>

          <Button
            onClick={continueToGoals}
            disabled={!canContinue}
            size="lg"
            className="mt-7 h-12 w-full rounded-xl bg-[var(--navy)] text-[15px] hover:bg-[#1d4255]"
          >
            Create my goals
            <ArrowRight className="ml-1 size-4" />
          </Button>
          <p className="mt-3 text-center text-xs text-[var(--muted-ink)]">No baseline test required. Your first practice becomes your starting point.</p>
        </div>
      </section>
    </main>
  );
}

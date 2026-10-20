'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowRight, Check, Lightbulb, RefreshCw, Target } from 'lucide-react';
import { AppShell, Breadcrumbs, PageHeader, Screen } from '@/components/app-shell';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { categories, practiceQuestions } from '@/lib/mock-data';
import { cn } from '@/lib/utils';
import { usePractice } from '@/components/practice-context';
import { createPracticeSession } from '@/lib/client-data';

export function PracticeSetupView() {
  const router = useRouter();
  const { goalId, goalTitle, categories: savedCategories, prompt: savedPrompt, updateSetup, beginSession } = usePractice();
  const [selectedCategories, setSelectedCategories] = useState<string[]>(savedCategories);
  const [customTopic, setCustomTopic] = useState('');
  const [questionIndex, setQuestionIndex] = useState(Math.max(0, practiceQuestions.indexOf(savedPrompt)));
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');

  function toggleCategory(id: string) {
    setSelectedCategories((current) =>
      current.includes(id) ? current.filter((category) => category !== id) : [...current, id],
    );
  }

  function generateAnother() {
    setQuestionIndex((current) => (current + 1) % practiceQuestions.length);
  }

  async function begin() {
    const nextPrompt = practiceQuestions[questionIndex];
    setPending(true);
    setError('');
    try {
      const session = await createPracticeSession({
        goalId,
        goalTitle,
        categories: selectedCategories,
        prompt: nextPrompt,
      });
      updateSetup({ categories: selectedCategories, customTopic, prompt: nextPrompt });
      beginSession(session.id);
      router.push('/practice/session');
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'The practice session could not be created.');
      setPending(false);
    }
  }

  return (
    <AppShell>
      <Screen>
        <Breadcrumbs items={[{ label: 'Goals', href: '/goals' }, { label: 'Practice setup' }]} />
        <PageHeader
          eyebrow="New practice session"
          title="Choose what to practise"
          description="Pick one or more categories. We’ll use them with your goal to shape the question."
        />

        <div className="grid grid-cols-[minmax(0,1fr)_390px] gap-7">
          <div className="space-y-7">
            <section className="rounded-3xl border border-[var(--line)] bg-[var(--paper)] p-7 shadow-[var(--shadow-sm)]">
              <div className="mb-5 flex items-center justify-between">
                <div>
                  <h2 className="font-display text-xl font-semibold tracking-[-0.02em] text-[var(--navy)]">Practice categories</h2>
                  <p className="mt-1 text-sm text-[var(--muted-ink)]">Choose as many as you want.</p>
                </div>
                <span className="rounded-full bg-[var(--warm)] px-3 py-1.5 text-xs font-medium text-[var(--muted-ink)]">
                  {selectedCategories.length} selected
                </span>
              </div>

              <div className="grid grid-cols-2 gap-3">
                {categories.map((category) => {
                  const selected = selectedCategories.includes(category.id);
                  return (
                    <button
                      key={category.id}
                      type="button"
                      onClick={() => toggleCategory(category.id)}
                      aria-pressed={selected}
                      className={cn(
                        'relative min-h-32 rounded-2xl border p-5 text-left transition-all hover:-translate-y-0.5',
                        selected
                          ? 'border-[var(--teal)] bg-[var(--mint-soft)] shadow-sm'
                          : 'border-[var(--line)] bg-white hover:border-[#b9c7c3]',
                      )}
                    >
                      <span className={cn('absolute right-4 top-4 grid size-6 place-items-center rounded-full border', selected ? 'border-[var(--teal)] bg-[var(--teal)] text-white' : 'border-[var(--line)] text-transparent')}>
                        <Check className="size-3.5" strokeWidth={3} />
                      </span>
                      <p className="pr-8 text-sm font-semibold text-[var(--navy)]">{category.title}</p>
                      <p className="mt-2 text-xs leading-5 text-[var(--muted-ink)]">{category.description}</p>
                    </button>
                  );
                })}
              </div>

              <label htmlFor="topic" className="mt-6 block text-sm font-semibold text-[var(--navy)]">Optional topic</label>
              <Textarea
                id="topic"
                value={customTopic}
                onChange={(event) => setCustomTopic(event.target.value)}
                placeholder="Example: choosing between speed and reliability for a product launch"
                className="mt-2 min-h-24 resize-none bg-white p-4 leading-6"
              />
            </section>

            <section className="rounded-3xl border border-[var(--line)] bg-[var(--paper)] p-7 shadow-[var(--shadow-sm)]">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--teal-dark)]">Your first question</p>
                  <h2 className="mt-3 max-w-[720px] font-display text-2xl font-semibold leading-8 tracking-[-0.025em] text-[var(--navy)]">
                    {practiceQuestions[questionIndex]}
                  </h2>
                </div>
              </div>
              <div className="mt-6 flex items-center justify-between border-t border-[var(--line)] pt-5">
                <p className="flex items-center gap-2 text-xs text-[var(--muted-ink)]"><Lightbulb className="size-4 text-[#b17a19]" />You can skip any question during practice.</p>
                <Button variant="outline" onClick={generateAnother} className="rounded-xl bg-white">
                  <RefreshCw className="size-4" /> Try another question
                </Button>
              </div>
            </section>
          </div>

          <aside className="self-start rounded-3xl bg-[var(--navy)] p-7 text-white shadow-[var(--shadow-lg)]">
            <div className="grid size-11 place-items-center rounded-2xl bg-white/10 text-[var(--mint)]">
              <Target className="size-5" />
            </div>
            <p className="mt-6 text-xs font-semibold uppercase tracking-[0.12em] text-[var(--mint)]">Primary goal</p>
            <h2 className="mt-2 font-display text-2xl font-semibold leading-8 tracking-[-0.03em]">{goalTitle}</h2>
            <p className="mt-3 text-sm leading-6 text-white/65">Your coach will prioritize clarity, structure, and evidence that help this goal—while still reviewing every feedback dimension.</p>

            <div className="my-7 h-px bg-white/12" />
            <dl className="space-y-4 text-sm">
              <div className="flex justify-between gap-4"><dt className="text-white/55">Suggested time</dt><dd className="font-medium">About 10 minutes</dd></div>
              <div className="flex justify-between gap-4"><dt className="text-white/55">Recording</dt><dd className="font-medium">Manual start & stop</dd></div>
              <div className="flex justify-between gap-4"><dt className="text-white/55">Feedback</dt><dd className="font-medium">After every answer</dd></div>
            </dl>

            <Button
              onClick={() => void begin()}
              disabled={selectedCategories.length === 0 || pending}
              size="lg"
              className="mt-8 h-12 w-full rounded-xl bg-white text-[var(--navy)] hover:bg-[var(--mint-soft)]"
            >
              {pending ? 'Opening practice room…' : 'Open practice room'} <ArrowRight className="ml-1 size-4" />
            </Button>
            {selectedCategories.length === 0 && <p className="mt-2 text-center text-xs text-white/55">Choose at least one category.</p>}
            {error && <p role="alert" className="mt-3 rounded-xl bg-white/10 px-3 py-2 text-center text-xs leading-5 text-[#ffd3cc]">{error}</p>}
          </aside>
        </div>
      </Screen>
    </AppShell>
  );
}

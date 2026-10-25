'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { AlertCircle, ArrowLeft, CheckCircle2, Gauge, MessageSquareText, Repeat2 } from 'lucide-react';
import { AppShell, Screen } from '@/components/app-shell';
import type { DashboardFeedbackItem, GoalDashboard, GoalLessonInsight } from '@/lib/types';
import { getGoalDashboard } from '@/lib/client-data';
import { cn } from '@/lib/utils';

type InsightTab = 'interview' | 'vocabulary' | 'fluency' | 'grammar';

function minutesLabel(seconds: number) {
  const minutes = seconds / 60;
  if (minutes === 0) return '0 minutes';
  if (minutes < 10 && !Number.isInteger(minutes)) return `${minutes.toFixed(1)} minutes`;
  return `${Math.round(minutes)} minutes`;
}

function FeedbackCard({ item, tone }: { item: DashboardFeedbackItem; tone: 'positive' | 'improve' }) {
  const corrections = (item.corrections ?? []).filter((correction) => correction.evidence.trim() && correction.suggestion.trim()).slice(0, 2);
  return (
    <article className="rounded-2xl border border-[var(--line)] bg-white p-5">
      <div className="flex items-center gap-2 text-xs font-semibold text-[var(--muted-ink)]">
        <span className={cn('h-5 w-1.5 rounded-full', tone === 'positive' ? 'bg-[#55a887]' : 'bg-[#c88a18]')} />
        {item.skill || item.title}
      </div>
      {corrections.length ? (
        <div className="mt-4 space-y-4">
          {corrections.map((correction, index) => (
            <div key={`${correction.evidence}-${index}`}>
              <p className="text-sm font-semibold leading-6 text-[var(--ink)]">“<mark className="rounded-sm bg-[#fff0a8] px-0.5 text-[var(--ink)]">{correction.evidence}</mark>”</p>
              <p className="mt-1.5 text-sm font-medium leading-6 text-[var(--ink)]">→ {correction.suggestion}</p>
            </div>
          ))}
        </div>
      ) : item.evidence ? (
        <p className="mt-4 text-sm font-semibold leading-6 text-[var(--ink)]">
          {tone === 'improve' ? <>“<mark className="rounded-sm bg-[#fff0a8] px-0.5 text-[var(--ink)]">{item.evidence}</mark>”</> : <>“{item.evidence}”</>}
        </p>
      ) : null}
      <p className="mt-4 text-sm leading-6 text-[var(--ink)]">{item.explanation}</p>
      <Link href={`/history/${item.sessionId}`} className="mt-4 inline-flex text-xs font-semibold text-[var(--teal-dark)] hover:underline">View answer in History →</Link>
    </article>
  );
}

function FeedbackColumns({ strengths, improvements, emptyMessage }: { strengths: DashboardFeedbackItem[]; improvements: DashboardFeedbackItem[]; emptyMessage: string }) {
  if (!strengths.length && !improvements.length) {
    return <div className="rounded-2xl border border-dashed border-[#b8c9c4] bg-white px-6 py-12 text-center text-sm text-[var(--muted-ink)]">{emptyMessage}</div>;
  }
  return (
    <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
      <section>
        <h3 className="mb-3 font-display text-lg font-semibold text-[var(--navy)]">What you did well</h3>
        <div className="space-y-3">{strengths.map((item) => <FeedbackCard key={item.id} item={item} tone="positive" />)}</div>
        {!strengths.length && <p className="rounded-2xl border border-dashed border-[var(--line)] p-5 text-sm text-[var(--muted-ink)]">No transcript-based strength was saved in this category.</p>}
      </section>
      <section>
        <h3 className="mb-3 font-display text-lg font-semibold text-[var(--navy)]">What you can improve</h3>
        <div className="space-y-3">{improvements.map((item) => <FeedbackCard key={item.id} item={item} tone="improve" />)}</div>
        {!improvements.length && <p className="rounded-2xl border border-dashed border-[var(--line)] p-5 text-sm text-[var(--muted-ink)]">No corrective feedback was saved in this category.</p>}
      </section>
    </div>
  );
}

function Metric({ label, value, detail }: { label: string; value: string; detail: string }) {
  return <div className="rounded-2xl border border-[var(--line)] bg-white p-5 shadow-[var(--shadow-sm)]"><p className="text-xs font-semibold text-[var(--muted-ink)]">{label}</p><p className="mt-3 font-display text-3xl font-semibold tracking-[-0.03em] text-[var(--navy)]">{value}</p><p className="mt-1 text-xs leading-5 text-[var(--muted-ink)]">{detail}</p></div>;
}

const interviewEvaluationDefinitions = [
  { question: 'Did you answer the actual question?', dimension: 'Communication effectiveness' },
  { question: 'Was your reasoning easy to follow?', dimension: 'Critical thinking' },
  { question: 'Did you provide a clear conclusion?', dimension: 'Sentence structure' },
] as const;

function InterviewEvaluationCard({ question, item }: { question: string; item?: DashboardFeedbackItem }) {
  return (
    <article className="rounded-2xl border border-[var(--line)] bg-white p-5 shadow-[var(--shadow-sm)]">
      <div className="flex items-start gap-3">
        <span className={cn(
          'mt-0.5 grid size-8 shrink-0 place-items-center rounded-full',
          item?.positive ? 'bg-[var(--mint-soft)] text-[var(--teal-dark)]' : 'bg-[var(--amber-soft)] text-[#8a621c]',
        )}>
          {item?.positive ? <CheckCircle2 className="size-4" /> : <AlertCircle className="size-4" />}
        </span>
        <h3 className="pt-1 text-sm font-semibold leading-5 text-[var(--navy)]">{question}</h3>
      </div>
      {item ? (
        <>
          <p className="mt-4 text-sm leading-6 text-[var(--ink)]">{item.explanation}</p>
          {item.evidence && (
            <div className="mt-4 border-t border-[var(--line)] pt-4">
              <p className="text-[10px] font-semibold uppercase tracking-[0.09em] text-[var(--muted-ink)]">Supporting evidence from your transcript</p>
              <p className="mt-2 text-sm font-semibold leading-6 text-[var(--ink)]">
                “{item.positive ? item.evidence : <mark className="rounded-sm bg-[#fff0a8] px-0.5 text-[var(--ink)]">{item.evidence}</mark>}”
              </p>
            </div>
          )}
        </>
      ) : (
        <p className="mt-4 text-sm leading-6 text-[var(--muted-ink)]">This evaluation was not available for the saved lesson.</p>
      )}
    </article>
  );
}

function InterviewCoaching({ lesson }: { lesson: GoalLessonInsight }) {
  const strengths = lesson.communicationFeedback.filter((item) => item.positive);
  const improvements = lesson.communicationFeedback.filter((item) => !item.positive);
  const interviewFeedback = [
    ...lesson.communicationFeedback,
    ...lesson.grammar.strengths,
    ...lesson.grammar.improvements,
  ];
  return (
    <div className="space-y-8">
      <section aria-labelledby="interview-evaluations-title">
        <h3 id="interview-evaluations-title" className="font-display text-lg font-semibold text-[var(--navy)]">Core interview evaluations</h3>
        <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-3">
          {interviewEvaluationDefinitions.map((definition) => (
            <InterviewEvaluationCard
              key={definition.dimension}
              question={definition.question}
              item={interviewFeedback.find((candidate) => candidate.dimension === definition.dimension)}
            />
          ))}
        </div>
      </section>
      <div className="border-t border-[var(--line)] pt-7">
        <h3 className="mb-4 font-display text-lg font-semibold text-[var(--navy)]">Additional coaching</h3>
      <FeedbackColumns strengths={strengths} improvements={improvements} emptyMessage="No interview-specific coaching was saved for this lesson." />
      </div>
    </div>
  );
}

function VocabularyInsights({ lesson }: { lesson: GoalLessonInsight }) {
  const vocabulary = lesson.vocabulary;
  return (
    <div className="space-y-7">
      <div><h2 className="font-display text-2xl font-semibold text-[var(--navy)]">Vocabulary</h2><p className="mt-1 text-sm text-[var(--muted-ink)]">Word use and word-choice feedback from this lesson only</p></div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Metric label="Total words spoken" value={vocabulary.totalWords.toLocaleString()} detail={`Across ${lesson.answerCount} ${lesson.answerCount === 1 ? 'answer' : 'answers'}`} />
        <Metric label="Distinct words used" value={vocabulary.uniqueWords.toLocaleString()} detail="Observed in this lesson" />
        <Metric label="First observed" value={vocabulary.newlyObservedWords === null ? '—' : vocabulary.newlyObservedWords.toLocaleString()} detail={vocabulary.comparisonLabel ?? 'Complete another lesson to compare'} />
        <Metric label="Repeated words" value={vocabulary.repeatedWords.length.toLocaleString()} detail="Meaningful words used repeatedly" />
      </div>
      <section>
        <h3 className="font-display text-lg font-semibold text-[var(--navy)]">Frequently repeated words</h3>
        {vocabulary.repeatedWords.length ? <div className="mt-3 flex flex-wrap gap-2">{vocabulary.repeatedWords.map((item) => <span key={item.word} className="rounded-full border border-[var(--line)] bg-white px-3 py-1.5 text-xs text-[var(--ink)]">{item.word} <span className="text-[var(--muted-ink)]">× {item.count}</span></span>)}</div> : <p className="mt-3 text-sm text-[var(--muted-ink)]">No meaningful word appears often enough to show yet.</p>}
      </section>
      <FeedbackColumns strengths={vocabulary.strengths} improvements={vocabulary.improvements} emptyMessage="No vocabulary feedback was saved for this lesson." />
    </div>
  );
}

function FluencyInsights({ lesson }: { lesson: GoalLessonInsight }) {
  const fluency = lesson.fluency;
  const pacePosition = Math.min(100, Math.max(0, ((fluency.averageWpm - 60) / 160) * 100));
  const strengths = fluency.feedback.filter((item) => item.positive);
  const improvements = fluency.feedback.filter((item) => !item.positive);
  return (
    <div className="space-y-7">
      <div><h2 className="font-display text-2xl font-semibold text-[var(--navy)]">Fluency</h2><p className="mt-1 text-sm text-[var(--muted-ink)]">Pace, fillers, repetition, and hesitation from this lesson only</p></div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4"><Metric label="Average pace" value={`${fluency.averageWpm} WPM`} detail="Weighted by recorded speaking time" /><Metric label="Filler words" value={fluency.fillerCount.toLocaleString()} detail="Across completed answers" /><Metric label="Filler rate" value={`${fluency.fillerRatePer100Words}`} detail="Fillers per 100 words" /><Metric label="Speaking time" value={minutesLabel(lesson.speakingSeconds)} detail="Recorded speech in this lesson" /></div>
      <section className="rounded-2xl border border-[var(--line)] bg-white p-6 shadow-[var(--shadow-sm)]">
        <div className="flex items-center gap-2"><Gauge className="size-5 text-[var(--teal)]" /><h3 className="font-display text-lg font-semibold text-[var(--navy)]">Speaking pace</h3></div>
        <p className="mt-2 text-sm leading-6 text-[var(--muted-ink)]">The 100–165 WPM band is a practical reference for clear professional speech, not a score.</p>
        <div className="relative mt-6 h-3 rounded-full bg-[var(--warm)]"><div className="absolute bottom-0 top-0 rounded-full bg-[var(--mint)]" style={{ left: '25%', width: '40.6%' }} /><span className="absolute top-1/2 size-5 -translate-x-1/2 -translate-y-1/2 rounded-full border-4 border-white bg-[var(--navy)] shadow" style={{ left: `${pacePosition}%` }} /></div>
        <div className="mt-2 flex justify-between text-[10px] text-[var(--muted-ink)]"><span>60 WPM</span><span>Reference: 100–165</span><span>220 WPM</span></div>
      </section>
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <section className="rounded-2xl border border-[var(--line)] bg-white p-5"><h3 className="flex items-center gap-2 font-display text-lg font-semibold text-[var(--navy)]"><MessageSquareText className="size-4 text-[var(--teal)]" />Common fillers</h3>{fluency.commonFillers.length ? <div className="mt-4 flex flex-wrap gap-2">{fluency.commonFillers.map((item) => <span key={item.phrase} className="rounded-full bg-[var(--amber-soft)] px-3 py-1.5 text-xs text-[#78581d]">{item.phrase} × {item.count}</span>)}</div> : <p className="mt-3 text-sm text-[var(--muted-ink)]">No filler expressions were detected.</p>}</section>
        <section className="rounded-2xl border border-[var(--line)] bg-white p-5"><h3 className="flex items-center gap-2 font-display text-lg font-semibold text-[var(--navy)]"><Repeat2 className="size-4 text-[var(--teal)]" />Repeated openings</h3>{fluency.repeatedOpenings.length ? <div className="mt-4 space-y-2">{fluency.repeatedOpenings.map((item) => <div key={item.phrase} className="flex items-center justify-between rounded-xl bg-[var(--canvas)] px-3 py-2 text-xs"><span>“{item.phrase}…”</span><span className="text-[var(--muted-ink)]">{item.count} times</span></div>)}</div> : <p className="mt-3 text-sm text-[var(--muted-ink)]">No repeated answer openings were detected.</p>}</section>
      </div>
      <FeedbackColumns strengths={strengths} improvements={improvements} emptyMessage="No fluency feedback was saved for this lesson." />
    </div>
  );
}

function GrammarInsights({ lesson }: { lesson: GoalLessonInsight }) {
  return (
    <div className="space-y-6">
      <div><h2 className="font-display text-2xl font-semibold text-[var(--navy)]">Grammar &amp; sentence structure</h2><p className="mt-1 text-sm text-[var(--muted-ink)]">Sentence-level patterns and specific corrections from this lesson</p></div>
      <FeedbackColumns strengths={lesson.grammar.strengths} improvements={lesson.grammar.improvements} emptyMessage="No grammar or sentence-structure feedback was saved for this lesson." />
    </div>
  );
}

export function LessonInsightsView({ goalId, lessonId }: { goalId: string; lessonId: string }) {
  const [dashboard, setDashboard] = useState<GoalDashboard | null>(null);
  const [tab, setTab] = useState<InsightTab>('interview');
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    void getGoalDashboard(goalId)
      .then((result) => { if (!cancelled) setDashboard(result); })
      .catch((caught) => { if (!cancelled) setError(caught instanceof Error ? caught.message : 'Lesson insights could not be loaded.'); });
    return () => { cancelled = true; };
  }, [goalId]);

  const lesson = dashboard?.lessons.find((item) => item.id === lessonId) ?? null;

  return (
    <AppShell>
      <Screen>
        <Link href="/goals" className="inline-flex items-center gap-1.5 text-sm font-semibold text-[var(--teal-dark)] hover:underline"><ArrowLeft className="size-4" />Back to Goals</Link>
        {error ? (
          <div role="alert" className="mt-8 rounded-2xl border border-[#e8c6bf] bg-[var(--rose-soft)] p-5 text-sm text-[#8f4336]">{error}</div>
        ) : !dashboard ? (
          <div className="grid min-h-96 place-items-center text-sm text-[var(--muted-ink)]">Loading lesson insights…</div>
        ) : !lesson ? (
          <div className="mt-8 grid min-h-96 place-items-center rounded-3xl border border-dashed border-[var(--line)] text-center"><div><h1 className="font-display text-2xl font-semibold text-[var(--navy)]">Lesson not found</h1><p className="mt-2 text-sm text-[var(--muted-ink)]">This lesson may no longer be available for this goal.</p></div></div>
        ) : (
          <>
            <header className="mt-8 border-b border-[var(--line)] pb-8">
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--teal-dark)]">Lesson insights</p>
              <h1 className="mt-3 max-w-4xl font-display text-4xl font-semibold leading-tight tracking-[-0.04em] text-[var(--navy)]">{lesson.title}</h1>
              <p className="mt-3 text-sm text-[var(--muted-ink)]">{new Intl.DateTimeFormat('en-US', { month: 'long', day: 'numeric', year: 'numeric' }).format(new Date(lesson.completedAt))} · {lesson.answerCount} {lesson.answerCount === 1 ? 'answer' : 'answers'} · {minutesLabel(lesson.speakingSeconds)} of recorded speech</p>
            </header>

            <div className="flex items-center gap-8 overflow-x-auto border-b border-[var(--line)]" role="tablist" aria-label="Lesson evaluation dimensions">
              {([
                ['interview', 'Interview coaching'],
                ['vocabulary', 'Vocabulary'],
                ['fluency', 'Fluency'],
                ['grammar', 'Grammar & sentence structure'],
              ] as const).map(([value, label]) => (
                <button key={value} type="button" role="tab" aria-selected={tab === value} onClick={() => setTab(value)} className={cn('relative h-14 whitespace-nowrap px-0.5 text-sm font-semibold', tab === value ? 'text-[var(--ink)] after:absolute after:bottom-0 after:left-0 after:h-[3px] after:w-full after:rounded-full after:bg-[var(--teal)]' : 'text-[var(--muted-ink)] hover:text-[var(--ink)]')}>{label}</button>
              ))}
            </div>

            <main className="py-9">
              {tab === 'interview' ? <InterviewCoaching lesson={lesson} /> : tab === 'vocabulary' ? <VocabularyInsights lesson={lesson} /> : tab === 'fluency' ? <FluencyInsights lesson={lesson} /> : <GrammarInsights lesson={lesson} />}
            </main>
          </>
        )}
      </Screen>
    </AppShell>
  );
}

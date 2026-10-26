'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { AlertCircle, ArrowLeft, CheckCircle2, Gauge, MessageSquareText, Repeat2 } from 'lucide-react';
import { AppShell, Screen } from '@/components/app-shell';
import type { DashboardFeedbackItem, GoalDashboard, GoalLessonInsight } from '@/lib/types';
import { getGoalDashboard } from '@/lib/client-data';
import { conciseOverallFeedback, getInterviewEvaluation } from '@/lib/feedback-copy';
import { cn } from '@/lib/utils';

type InsightTab = 'interview' | 'vocabulary' | 'speaking-speed' | 'fluency' | 'grammar';

function minutesLabel(seconds: number) {
  const minutes = seconds / 60;
  if (minutes === 0) return '0 minutes';
  if (minutes < 10 && !Number.isInteger(minutes)) return `${minutes.toFixed(1)} minutes`;
  return `${Math.round(minutes)} minutes`;
}

function speakingSpeedSummary(wordsPerMinute: number) {
  if (wordsPerMinute <= 0) return 'Complete a recorded answer to establish your speaking speed.';
  if (wordsPerMinute < 100) return 'A little slow for an interview. Try speaking slightly faster while keeping your words clear.';
  if (wordsPerMinute <= 165) return 'A clear, natural pace for most interview answers.';
  return 'A little fast. Slow down slightly so your key points are easier to follow.';
}

type FeedbackGroup = {
  key: string;
  label: string;
  items: DashboardFeedbackItem[];
};

function groupFeedback(items: DashboardFeedbackItem[]) {
  const groups = new Map<string, FeedbackGroup>();
  for (const item of items) {
    const label = item.skill?.trim() || item.title.trim();
    const key = label.toLocaleLowerCase().replace(/\s+/g, ' ');
    const group = groups.get(key) ?? { key, label, items: [] };
    group.items.push(item);
    groups.set(key, group);
  }
  return [...groups.values()];
}

function FeedbackGroupCard({ group, tone }: { group: FeedbackGroup; tone: 'positive' | 'improve' }) {
  return (
    <article className="rounded-2xl border border-[var(--line)] bg-white p-5">
      <div className="flex items-center gap-2">
        <span className={cn('h-5 w-1.5 shrink-0 rounded-full', tone === 'positive' ? 'bg-[#55a887]' : 'bg-[#c88a18]')} />
        <h4 className="text-xs font-semibold text-[var(--muted-ink)]">{group.label}</h4>
        {group.items.length > 1 && <span className="ml-auto rounded-full bg-[#f0ecff] px-2.5 py-1 text-[10px] font-semibold text-[#6842d8]">{group.items.length} examples</span>}
      </div>

      <div className="mt-4">
        {group.items.map((item, itemIndex) => {
          const corrections = (item.corrections ?? []).filter((correction) => correction.evidence.trim() && correction.suggestion.trim()).slice(0, 2);
          return (
            <section key={item.id} className="py-6 first:pt-0 last:pb-0" aria-label={group.items.length > 1 ? `Example ${itemIndex + 1}` : undefined}>
              {group.items.length > 1 && <h5 className="mb-4 font-display text-sm font-semibold text-[#6842d8]">Example {itemIndex + 1}</h5>}
              {corrections.length ? (
                <div className="space-y-4">
                  {corrections.map((correction, correctionIndex) => (
                    <div key={`${correction.evidence}-${correctionIndex}`}>
                      <p className="text-sm font-semibold leading-6 text-[var(--ink)]">“<mark className="rounded-sm bg-[#fff0a8] px-0.5 text-[var(--ink)]">{correction.evidence}</mark>”</p>
                      <div className="mt-3">
                        <p className="text-[10px] font-semibold uppercase tracking-[0.09em] text-[#6842d8]">Recommendation</p>
                        <p className="mt-1 text-sm font-medium leading-6 text-[var(--ink)]">→ {correction.suggestion}</p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : item.evidence ? (
                <p className="text-sm font-semibold leading-6 text-[var(--ink)]">
                  {tone === 'improve' ? <>“<mark className="rounded-sm bg-[#fff0a8] px-0.5 text-[var(--ink)]">{item.evidence}</mark>”</> : <>“{item.evidence}”</>}
                </p>
              ) : null}
              <div className="mt-4 border-t border-[var(--line)] pt-4">
                <p className="text-[10px] font-semibold uppercase tracking-[0.09em] text-[var(--muted-ink)]">Overall feedback</p>
                <p className="mt-1.5 text-sm leading-6 text-[var(--ink)]">{conciseOverallFeedback(item.explanation)}</p>
              </div>
            </section>
          );
        })}
      </div>
      <Link href={`/history/${group.items[0].sessionId}`} className="mt-5 inline-flex text-xs font-semibold text-[var(--teal-dark)] hover:underline">View {group.items.length > 1 ? 'answers' : 'answer'} in History →</Link>
    </article>
  );
}

function FeedbackColumns({ strengths, improvements, emptyMessage }: { strengths: DashboardFeedbackItem[]; improvements: DashboardFeedbackItem[]; emptyMessage: string }) {
  const strengthGroups = groupFeedback(strengths);
  const improvementGroups = groupFeedback(improvements);
  if (!strengths.length && !improvements.length) {
    return <div className="rounded-2xl border border-dashed border-[#b8c9c4] bg-white px-6 py-12 text-center text-sm text-[var(--muted-ink)]">{emptyMessage}</div>;
  }
  return (
    <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
      <section>
        <h3 className="mb-3 font-display text-lg font-semibold text-[var(--navy)]">What you did well</h3>
        <div className="space-y-3">{strengthGroups.map((group) => <FeedbackGroupCard key={group.key} group={group} tone="positive" />)}</div>
        {!strengths.length && <p className="rounded-2xl border border-dashed border-[var(--line)] p-5 text-sm text-[var(--muted-ink)]">No transcript-based strength was saved in this category.</p>}
      </section>
      <section>
        <h3 className="mb-3 font-display text-lg font-semibold text-[var(--navy)]">What you can improve</h3>
        <div className="space-y-3">{improvementGroups.map((group) => <FeedbackGroupCard key={group.key} group={group} tone="improve" />)}</div>
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
  const evaluation = item ? getInterviewEvaluation(item) : null;
  return (
    <article className="rounded-2xl border border-[var(--line)] bg-white p-5 shadow-[var(--shadow-sm)]">
      <div className="flex items-start gap-3">
        <span className={cn(
          'mt-0.5 grid size-8 shrink-0 place-items-center rounded-full',
          evaluation?.verdict === 'yes'
            ? 'bg-[var(--mint-soft)] text-[var(--teal-dark)]'
            : evaluation?.verdict === 'partially'
              ? 'bg-[var(--amber-soft)] text-[#8a621c]'
              : 'bg-[var(--rose-soft)] text-[#914435]',
        )}>
          {evaluation?.verdict === 'yes' ? <CheckCircle2 className="size-4" /> : <AlertCircle className="size-4" />}
        </span>
        <h3 className="pt-1 text-sm font-semibold leading-5 text-[var(--navy)]">{question}</h3>
      </div>
      {item && evaluation ? (
        <>
          <div className="mt-4">
            <span className={cn(
              'inline-flex rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.08em]',
              evaluation.verdict === 'yes'
                ? 'bg-[var(--mint-soft)] text-[var(--teal-dark)]'
                : evaluation.verdict === 'partially'
                  ? 'bg-[var(--amber-soft)] text-[#8a621c]'
                  : 'bg-[var(--rose-soft)] text-[#914435]',
            )}>{evaluation.label}</span>
            <p className="mt-2 text-sm leading-6 text-[var(--ink)]">{evaluation.reason}</p>
          </div>
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
      <div><h2 className="font-display text-2xl font-semibold text-[var(--navy)]">Vocabulary</h2><p className="mt-1 text-sm text-[var(--muted-ink)]">Word choice from this lesson and vocabulary growth across your completed sessions</p></div>
      <VocabularySizeCard vocabulary={vocabulary} />
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

function VocabularySizeCard({ vocabulary }: { vocabulary: GoalLessonInsight['vocabulary'] }) {
  const width = 190;
  const height = 74;
  const padding = 7;
  const baseline = height - padding;
  const values = vocabulary.sizeHistory.map((point) => point.uniqueWords);
  const maximum = Math.max(...values, 1);
  const minimum = Math.min(...values, 0);
  const range = Math.max(1, maximum - minimum);
  const points = values.map((value, index) => ({
    x: values.length === 1 ? width - padding : padding + (index / (values.length - 1)) * (width - padding * 2),
    y: padding + ((maximum - value) / range) * (height - padding * 2),
  }));
  const displayPoints = points.length === 1
    ? [{ x: padding, y: points[0].y }, points[0]]
    : points;
  const linePath = displayPoints.map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x} ${point.y}`).join(' ');
  const areaPath = `${linePath} L ${displayPoints.at(-1)?.x ?? width - padding} ${baseline} L ${displayPoints[0]?.x ?? padding} ${baseline} Z`;
  const latestPoint = displayPoints.at(-1);

  return (
    <section className="flex max-w-xl items-center justify-between gap-7 rounded-2xl border border-[var(--line)] bg-white px-5 py-5 shadow-[var(--shadow-sm)]" aria-labelledby="vocabulary-size-title">
      <div className="min-w-0">
        <h3 id="vocabulary-size-title" className="text-sm font-semibold text-[var(--navy)]">Vocabulary size</h3>
        <p className="mt-2 font-display text-4xl font-semibold tracking-[-0.04em] text-[var(--navy)]">+{vocabulary.vocabularySize.toLocaleString()}</p>
        <p className="mt-1 text-xs leading-5 text-[var(--muted-ink)]">Unique words used since your first session</p>
      </div>
      <div className="w-48 shrink-0">
        <svg viewBox={`0 0 ${width} ${height}`} className="block h-auto w-full" aria-hidden="true">
          <path d={areaPath} fill="#eee8ff" />
          <path d={linePath} fill="none" stroke="#6842d8" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" />
          {latestPoint && <circle cx={latestPoint.x} cy={latestPoint.y} r="4" fill="white" stroke="#6842d8" strokeWidth="2.5" />}
        </svg>
        <p className="sr-only">Vocabulary size is {vocabulary.vocabularySize} unique words across {vocabulary.sizeHistory.length} completed {vocabulary.sizeHistory.length === 1 ? 'session' : 'sessions'}.</p>
      </div>
    </section>
  );
}

function SpeakingSpeedInsights({ lesson }: { lesson: GoalLessonInsight }) {
  const fluency = lesson.fluency;
  const pacePosition = Math.min(100, Math.max(0, ((fluency.averageWpm - 60) / 160) * 100));

  return (
    <div className="space-y-7">
      <div><h2 className="font-display text-2xl font-semibold text-[var(--navy)]">Speaking speed</h2><p className="mt-1 text-sm text-[var(--muted-ink)]">Your speaking pace across the recorded answers in this lesson</p></div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Metric label="Average speaking speed" value={fluency.averageWpm > 0 ? `${fluency.averageWpm} WPM` : '—'} detail="Weighted by recorded speaking time" />
        <Metric label="Speaking time" value={minutesLabel(lesson.speakingSeconds)} detail="Recorded speech in this lesson" />
      </div>
      <section className="rounded-2xl border border-[var(--line)] bg-white p-6 shadow-[var(--shadow-sm)]">
        <div className="flex items-center gap-2"><Gauge className="size-5 text-[#6842d8]" /><h3 className="font-display text-lg font-semibold text-[var(--navy)]">How to read your pace</h3></div>
        <p className="mt-3 text-sm font-semibold leading-6 text-[var(--navy)]">{speakingSpeedSummary(fluency.averageWpm)}</p>
        <p className="mt-1 text-sm leading-6 text-[var(--muted-ink)]">The 100–165 WPM band is a practical clarity reference for professional speech. It is guidance, not a score, and the best pace may vary with the complexity of your answer.</p>
        <div className="relative mt-6 h-3 rounded-full bg-[var(--warm)]"><div className="absolute bottom-0 top-0 rounded-full bg-[#d9d0f5]" style={{ left: '25%', width: '40.6%' }} />{fluency.averageWpm > 0 && <span className="absolute top-1/2 size-5 -translate-x-1/2 -translate-y-1/2 rounded-full border-4 border-white bg-[#6842d8] shadow" style={{ left: `${pacePosition}%` }} />}</div>
        <div className="mt-2 flex justify-between text-[10px] text-[var(--muted-ink)]"><span>60 WPM</span><span>Clarity reference: 100–165 WPM</span><span>220 WPM</span></div>
      </section>
    </div>
  );
}

function FluencyInsights({ lesson }: { lesson: GoalLessonInsight }) {
  const fluency = lesson.fluency;
  const strengths = fluency.feedback.filter((item) => item.positive);
  const improvements = fluency.feedback.filter((item) => !item.positive);
  return (
    <div className="space-y-7">
      <div><h2 className="font-display text-2xl font-semibold text-[var(--navy)]">Fluency</h2><p className="mt-1 text-sm text-[var(--muted-ink)]">Fillers, repetition, and hesitation from this lesson only</p></div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2"><Metric label="Filler words" value={fluency.fillerCount.toLocaleString()} detail="Across completed answers" /><Metric label="Filler rate" value={`${fluency.fillerRatePer100Words}`} detail="Fillers per 100 words" /></div>
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
        <Link href="/goals" className="inline-flex items-center gap-1.5 text-sm font-semibold text-[var(--teal-dark)] hover:underline"><ArrowLeft className="size-4" />Back to Home</Link>
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
              <p className="mt-3 text-sm text-[var(--muted-ink)]">{new Intl.DateTimeFormat('en-US', { month: 'long', day: 'numeric', year: 'numeric' }).format(new Date(lesson.completedAt))} · {lesson.answerCount} {lesson.answerCount === 1 ? 'answer' : 'answers'} · {minutesLabel(lesson.speakingSeconds)} of recorded speech · {lesson.fluency.averageWpm > 0 ? `${lesson.fluency.averageWpm} WPM` : 'Speaking speed unavailable'}</p>
            </header>

            <div className="flex items-center gap-8 overflow-x-auto border-b border-[var(--line)]" role="tablist" aria-label="Lesson evaluation dimensions">
              {([
                ['interview', 'Interview coaching'],
                ['vocabulary', 'Vocabulary'],
                ['speaking-speed', 'Speaking speed'],
                ['fluency', 'Fluency'],
                ['grammar', 'Grammar & sentence structure'],
              ] as const).map(([value, label]) => (
                <button key={value} type="button" role="tab" aria-selected={tab === value} onClick={() => setTab(value)} className={cn('relative h-14 whitespace-nowrap px-0.5 text-sm font-semibold', tab === value ? 'text-[var(--ink)] after:absolute after:bottom-0 after:left-0 after:h-[3px] after:w-full after:rounded-full after:bg-[var(--teal)]' : 'text-[var(--muted-ink)] hover:text-[var(--ink)]')}>{label}</button>
              ))}
            </div>

            <main className="py-9">
              {tab === 'interview' && <InterviewCoaching lesson={lesson} />}
              {tab === 'vocabulary' && <VocabularyInsights lesson={lesson} />}
              {tab === 'speaking-speed' && <SpeakingSpeedInsights lesson={lesson} />}
              {tab === 'fluency' && <FluencyInsights lesson={lesson} />}
              {tab === 'grammar' && <GrammarInsights lesson={lesson} />}
            </main>
          </>
        )}
      </Screen>
    </AppShell>
  );
}

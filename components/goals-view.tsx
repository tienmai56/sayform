'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  ArrowRight,
  BarChart3,
  CalendarDays,
  Check,
  CheckCircle2,
  ChevronLeft,
  Clock3,
  Gauge,
  MessageSquareText,
  Pencil,
  Plus,
  Repeat2,
  Sparkles,
  Target,
} from 'lucide-react';
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
import type { DashboardFeedbackItem, Goal, GoalDashboard, GoalLessonInsight } from '@/lib/types';
import { getPracticeQuestions } from '@/lib/goal-catalog';
import { usePractice } from '@/components/practice-context';
import { createGoal, getGoalDashboard, listGoals, setActiveGoal, updateGoal } from '@/lib/client-data';
import { cn } from '@/lib/utils';

type GoalsPageTab = 'summary' | 'lessons';
type ChartMode = 'day' | 'week';

function formatLastPractised(value: string | null) {
  if (!value) return 'Not practised yet';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Practice saved';
  const today = new Date();
  if (date.toDateString() === today.toDateString()) return 'Last practised today';
  return `Last practised ${new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' }).format(date)}`;
}

function minutesLabel(seconds: number) {
  const minutes = seconds / 60;
  if (minutes === 0) return '0 minutes';
  if (minutes < 10 && !Number.isInteger(minutes)) return `${minutes.toFixed(1)} minutes`;
  return `${Math.round(minutes)} minutes`;
}

function localDateKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function startOfWeek(date: Date) {
  const result = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const day = result.getDay();
  result.setDate(result.getDate() - (day === 0 ? 6 : day - 1));
  return result;
}

function buildChartData(activity: GoalDashboard['speakingActivity'], mode: ChartMode) {
  const now = new Date();
  const latestActivity = activity.reduce<Date | null>((latest, item) => {
    const date = new Date(item.occurredAt);
    return !latest || date > latest ? date : latest;
  }, null);
  if (mode === 'day') {
    const recentBoundary = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 6);
    const anchor = latestActivity && latestActivity < recentBoundary ? latestActivity : now;
    const buckets = Array.from({ length: 7 }, (_, index) => {
      const date = new Date(anchor.getFullYear(), anchor.getMonth(), anchor.getDate() - (6 - index));
      return {
        key: localDateKey(date),
        label: new Intl.DateTimeFormat('en-US', { weekday: 'short' }).format(date),
        detail: new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' }).format(date),
        seconds: 0,
        fillerCount: 0,
      };
    });
    const byKey = new Map(buckets.map((bucket) => [bucket.key, bucket]));
    activity.forEach((item) => {
      const bucket = byKey.get(localDateKey(new Date(item.occurredAt)));
      if (bucket) {
        bucket.seconds += item.durationSeconds;
        bucket.fillerCount += item.fillerCount;
      }
    });
    return buckets;
  }

  const currentWeek = startOfWeek(now);
  const recentWeekBoundary = new Date(currentWeek);
  recentWeekBoundary.setDate(recentWeekBoundary.getDate() - 49);
  const thisWeek = latestActivity && latestActivity < recentWeekBoundary ? startOfWeek(latestActivity) : currentWeek;
  const buckets = Array.from({ length: 8 }, (_, index) => {
    const date = new Date(thisWeek);
    date.setDate(date.getDate() - ((7 - index) * 7));
    return {
      key: localDateKey(date),
      label: new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' }).format(date),
      detail: `Week of ${new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' }).format(date)}`,
      seconds: 0,
      fillerCount: 0,
    };
  });
  const byKey = new Map(buckets.map((bucket) => [bucket.key, bucket]));
  activity.forEach((item) => {
    const bucket = byKey.get(localDateKey(startOfWeek(new Date(item.occurredAt))));
    if (bucket) {
      bucket.seconds += item.durationSeconds;
      bucket.fillerCount += item.fillerCount;
    }
  });
  return buckets;
}

function EmptyDashboard({ goal, onPractice }: { goal: Goal; onPractice: () => void }) {
  return (
    <div className="grid min-h-[360px] place-items-center rounded-2xl border border-dashed border-[#b8c9c4] bg-[var(--canvas)] px-8 text-center">
      <div className="max-w-md">
        <span className="mx-auto grid size-12 place-items-center rounded-2xl bg-[var(--mint-soft)] text-[var(--teal-dark)]"><BarChart3 className="size-5" /></span>
        <h3 className="mt-5 font-display text-xl font-semibold text-[var(--navy)]">Build your baseline for {goal.title.toLocaleLowerCase()}</h3>
        <p className="mt-2 text-sm leading-6 text-[var(--muted-ink)]">Complete a speaking response to unlock goal-specific trends, transcript metrics, and coaching insights. Nothing is estimated before you practise.</p>
        <Button onClick={onPractice} className="mt-5 h-10 rounded-xl bg-[var(--navy)] hover:bg-[#1d4255]">Practise this goal <ArrowRight className="ml-1 size-4" /></Button>
      </div>
    </div>
  );
}

function cleanQuotedFragment(value: string) {
  return value
    .replace(/^[\s\u2018\u2019\u201c\u201d"'\u2026.]+|[\s\u2018\u2019\u201c\u201d"'\u2026.]+$/g, '')
    .trim();
}

function mistakeFragments(item: DashboardFeedbackItem) {
  const transcript = item.evidence.toLocaleLowerCase();
  const fragments: string[] = [];
  const addFragment = (value: string) => {
    const fragment = cleanQuotedFragment(value);
    if (!fragment || !transcript.includes(fragment.toLocaleLowerCase())) return;
    if (!fragments.some((existing) => existing.toLocaleLowerCase() === fragment.toLocaleLowerCase())) fragments.push(fragment);
  };

  for (const match of item.explanation.matchAll(/[\u201c"]([^\u201d"]{3,})[\u201d"]/g)) addFragment(match[1]);
  for (const match of item.explanation.matchAll(/(?:^|[\s(])'([^']{3,})'/g)) addFragment(match[1]);

  if (fragments.length < (item.alternatives?.length ?? 0)) {
    item.evidence.split(/\.{2,}|[;!?]+/).forEach(addFragment);
  }
  return fragments;
}

function pairedCorrections(item: DashboardFeedbackItem) {
  const stored = (item.corrections ?? []).filter((correction) => correction.evidence.trim() && correction.suggestion.trim());
  if (stored.length) return stored.slice(0, 2);

  const alternatives = (item.alternatives ?? []).filter((alternative) => alternative.trim()).slice(0, 2);
  if (!alternatives.length) return [];
  const fragments = mistakeFragments(item);
  if (alternatives.length === 1 && !fragments.length && item.evidence.trim()) fragments.push(item.evidence.trim());
  return alternatives.flatMap((suggestion, index) => (
    fragments[index] ? [{ evidence: fragments[index], suggestion }] : []
  ));
}

function FeedbackCard({ item, tone = 'positive' }: { item: DashboardFeedbackItem; tone?: 'positive' | 'improve' }) {
  const corrections = tone === 'improve' ? pairedCorrections(item) : [];
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
              <p className="text-sm font-semibold leading-6 text-[var(--ink)]">
                “<mark className="rounded-sm bg-[#fff0a8] px-0.5 text-[var(--ink)]">{correction.evidence}</mark>”
              </p>
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
    return <div className="rounded-2xl border border-dashed border-[#b8c9c4] bg-[var(--canvas)] px-6 py-10 text-center text-sm text-[var(--muted-ink)]">{emptyMessage}</div>;
  }
  return (
    <div className="grid grid-cols-2 gap-5">
      <section>
        <h3 className="mb-3 font-display text-lg font-semibold text-[var(--navy)]">What you did well</h3>
        <div className="space-y-3">{strengths.map((item) => <FeedbackCard key={item.id} item={item} />)}</div>
        {!strengths.length && <p className="rounded-2xl border border-dashed border-[var(--line)] p-5 text-sm text-[var(--muted-ink)]">No saved positive feedback in this category yet.</p>}
      </section>
      <section>
        <h3 className="mb-3 font-display text-lg font-semibold text-[var(--navy)]">What you can improve</h3>
        <div className="space-y-3">{improvements.map((item) => <FeedbackCard key={item.id} item={item} tone="improve" />)}</div>
        {!improvements.length && <p className="rounded-2xl border border-dashed border-[var(--line)] p-5 text-sm text-[var(--muted-ink)]">No saved corrective feedback in this category yet.</p>}
      </section>
    </div>
  );
}

function SpeakingChart({ activity }: { activity: GoalDashboard['speakingActivity'] }) {
  const [mode, setMode] = useState<ChartMode>('day');
  const data = useMemo(() => buildChartData(activity, mode), [activity, mode]);
  const maxSeconds = Math.max(...data.map((bucket) => bucket.seconds), 60);
  const periodSeconds = data.reduce((sum, bucket) => sum + bucket.seconds, 0);

  return (
    <section className="rounded-2xl border border-[var(--line)] bg-white p-6 shadow-[var(--shadow-sm)]">
      <div className="flex items-start justify-between gap-6">
        <div><h3 className="font-display text-lg font-semibold text-[var(--navy)]">Speaking time</h3><p className="mt-1 text-xs text-[var(--muted-ink)]">Minutes of completed recorded speech for this goal</p></div>
        <div className="flex rounded-xl bg-[var(--warm)] p-1" aria-label="Chart grouping">
          {(['day', 'week'] as const).map((value) => <button key={value} onClick={() => setMode(value)} className={cn('rounded-lg px-3 py-1.5 text-xs font-semibold', mode === value ? 'bg-white text-[var(--ink)] shadow-sm' : 'text-[var(--muted-ink)]')}>By {value}</button>)}
        </div>
      </div>
      <div className="mt-7 grid h-48 grid-cols-[38px_1fr] gap-3">
        <div className="flex flex-col justify-between pb-7 text-right text-[10px] text-[var(--muted-ink)]"><span>{Math.ceil(maxSeconds / 60)}m</span><span>{Math.ceil(maxSeconds / 120)}m</span><span>0m</span></div>
        <div className={cn('relative grid items-end gap-3 border-b border-[var(--line)] bg-[linear-gradient(to_bottom,transparent_49%,var(--line)_50%,transparent_51%)]', mode === 'day' ? 'grid-cols-7' : 'grid-cols-8')}>
          {data.map((bucket) => (
            <div key={bucket.key} className="group flex h-full flex-col items-center justify-end" title={`${bucket.detail}: ${(bucket.seconds / 60).toFixed(1)} minutes`}>
              <span className="mb-1 text-[10px] font-semibold text-[var(--teal-dark)] opacity-0 group-hover:opacity-100">{bucket.seconds ? (bucket.seconds / 60).toFixed(1) : ''}</span>
              <div className="w-full max-w-14 rounded-t-md bg-[#8dbcae] transition-[height]" style={{ height: bucket.seconds ? `${Math.max(8, (bucket.seconds / maxSeconds) * 132)}px` : '2px' }} />
              <span className="mt-2 text-[10px] text-[var(--muted-ink)]">{bucket.label}</span>
            </div>
          ))}
        </div>
      </div>
      <p className="mt-4 text-xs text-[var(--muted-ink)]">This period · {minutesLabel(periodSeconds)} of recorded speech</p>
    </section>
  );
}

function FillerChart({ activity }: { activity: GoalDashboard['speakingActivity'] }) {
  const [mode, setMode] = useState<ChartMode>('day');
  const data = useMemo(() => buildChartData(activity, mode), [activity, mode]);
  const maxCount = Math.max(...data.map((bucket) => bucket.fillerCount), 1);
  const periodCount = data.reduce((sum, bucket) => sum + bucket.fillerCount, 0);

  return (
    <section className="rounded-2xl border border-[var(--line)] bg-white p-6 shadow-[var(--shadow-sm)]">
      <div className="flex items-start justify-between gap-6">
        <div><h3 className="font-display text-lg font-semibold text-[var(--navy)]">Filler count</h3><p className="mt-1 text-xs text-[var(--muted-ink)]">Detected filler expressions in completed recordings for this goal</p></div>
        <div className="flex rounded-xl bg-[var(--warm)] p-1" aria-label="Filler chart grouping">
          {(['day', 'week'] as const).map((value) => <button key={value} onClick={() => setMode(value)} className={cn('rounded-lg px-3 py-1.5 text-xs font-semibold', mode === value ? 'bg-white text-[var(--ink)] shadow-sm' : 'text-[var(--muted-ink)]')}>By {value}</button>)}
        </div>
      </div>
      <div className="mt-7 grid h-48 grid-cols-[38px_1fr] gap-3">
        <div className="flex flex-col justify-between pb-7 text-right text-[10px] text-[var(--muted-ink)]"><span>{maxCount}</span><span>{Math.ceil(maxCount / 2)}</span><span>0</span></div>
        <div className={cn('relative grid items-end gap-3 border-b border-[var(--line)] bg-[linear-gradient(to_bottom,transparent_49%,var(--line)_50%,transparent_51%)]', mode === 'day' ? 'grid-cols-7' : 'grid-cols-8')}>
          {data.map((bucket) => (
            <div key={bucket.key} className="group flex h-full flex-col items-center justify-end" title={`${bucket.detail}: ${bucket.fillerCount} ${bucket.fillerCount === 1 ? 'filler' : 'fillers'}`}>
              <span className="mb-1 text-[10px] font-semibold text-[#9a6a20] opacity-0 group-hover:opacity-100">{bucket.fillerCount || ''}</span>
              <div className="w-full max-w-14 rounded-t-md bg-[#e1b45d] transition-[height]" style={{ height: bucket.fillerCount ? `${Math.max(8, (bucket.fillerCount / maxCount) * 132)}px` : '2px' }} />
              <span className="mt-2 text-[10px] text-[var(--muted-ink)]">{bucket.label}</span>
            </div>
          ))}
        </div>
      </div>
      <p className="mt-4 text-xs text-[var(--muted-ink)]">This period · {periodCount} detected {periodCount === 1 ? 'filler' : 'fillers'}</p>
    </section>
  );
}

function Metric({ label, value, detail }: { label: string; value: string; detail: string }) {
  return <div className="rounded-2xl border border-[var(--line)] bg-white p-5 shadow-[var(--shadow-sm)]"><p className="text-xs font-semibold text-[var(--muted-ink)]">{label}</p><p className="mt-3 font-display text-3xl font-semibold tracking-[-0.03em] text-[var(--navy)]">{value}</p><p className="mt-1 text-xs leading-5 text-[var(--muted-ink)]">{detail}</p></div>;
}

function StorytellingFrameworkSummary({ framework }: { framework: NonNullable<GoalDashboard['storytellingFramework']> }) {
  return (
    <section className="rounded-2xl border border-[var(--line)] bg-white p-6 shadow-[var(--shadow-sm)]">
      <div className="max-w-3xl">
        <p className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.1em] text-[var(--teal-dark)]"><Sparkles className="size-4" />Story structure</p>
        <h3 className="mt-2 font-display text-xl font-semibold text-[var(--navy)]">{framework.name}</h3>
        <p className="mt-2 text-sm leading-6 text-[var(--muted-ink)]">{framework.description}</p>
      </div>

      <div className="mt-6 grid grid-cols-2 gap-4">
        {framework.criteria.map((criterion, index) => {
          const evaluation = criterion.evaluation;
          const correction = evaluation && !evaluation.positive ? pairedCorrections(evaluation)[0] : null;
          return (
            <article key={criterion.id} className="rounded-2xl border border-[var(--line)] bg-[var(--canvas)] p-5">
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-start gap-3">
                  <span className="grid size-7 shrink-0 place-items-center rounded-full bg-white text-xs font-semibold text-[var(--teal-dark)] shadow-sm">{index + 1}</span>
                  <div>
                    <h4 className="text-sm font-semibold text-[var(--navy)]">{criterion.title}</h4>
                    <p className="mt-1 text-xs leading-5 text-[var(--muted-ink)]">{criterion.description}</p>
                  </div>
                </div>
                {evaluation && (
                  <span className={cn(
                    'shrink-0 rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.06em]',
                    evaluation.positive ? 'bg-[#dff2e9] text-[#286b55]' : 'bg-[#fff0c7] text-[#805b17]',
                  )}>
                    {evaluation.positive ? 'Demonstrated' : 'Needs focus'}
                  </span>
                )}
              </div>

              {evaluation ? (
                <div className="mt-4 border-t border-[var(--line)] pt-4">
                  {correction ? (
                    <div>
                      <p className="text-sm font-semibold leading-6 text-[var(--ink)]">“<mark className="rounded-sm bg-[#fff0a8] px-0.5 text-[var(--ink)]">{correction.evidence}</mark>”</p>
                      <p className="mt-1.5 text-sm font-medium leading-6 text-[var(--ink)]">→ {correction.suggestion}</p>
                    </div>
                  ) : evaluation.evidence ? (
                    <p className="text-sm font-semibold leading-6 text-[var(--ink)]">“{evaluation.evidence}”</p>
                  ) : null}
                  <p className="mt-3 text-sm leading-6 text-[var(--ink)]">{evaluation.explanation}</p>
                  <Link href={`/history/${evaluation.sessionId}`} className="mt-3 inline-flex text-xs font-semibold text-[var(--teal-dark)] hover:underline">View story in History →</Link>
                </div>
              ) : (
                <p className="mt-4 border-t border-[var(--line)] pt-4 text-xs leading-5 text-[var(--muted-ink)]">Complete a new storytelling response to evaluate this part of your story.</p>
              )}
            </article>
          );
        })}
      </div>
    </section>
  );
}

function SummaryTab({ dashboard }: { dashboard: GoalDashboard }) {
  return (
    <div className="space-y-5">
      <div><h2 className="font-display text-2xl font-semibold text-[var(--navy)]">Your progress at a glance</h2><p className="mt-1 text-sm text-[var(--muted-ink)]">Insights from your saved practice sessions for this goal</p></div>
      <div className="grid grid-cols-2 gap-5">
        {dashboard.overview.strength && <section className="rounded-2xl border border-[var(--line)] bg-white p-6"><p className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.09em] text-[var(--muted-ink)]"><span className="size-2 rounded-full bg-[#55a887]" />Your strength</p><p className="mt-4 text-sm leading-7 text-[var(--ink)]">{dashboard.overview.strength.explanation}</p></section>}
        {dashboard.overview.improvement && <section className="rounded-2xl border border-[var(--line)] bg-white p-6"><p className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.09em] text-[var(--muted-ink)]"><span className="size-2 rounded-full bg-[#dca64e]" />Your next improvement</p><p className="mt-4 text-sm leading-7 text-[var(--ink)]">{dashboard.overview.improvement.explanation}</p></section>}
      </div>
      {dashboard.storytellingFramework && <StorytellingFrameworkSummary framework={dashboard.storytellingFramework} />}
      <SpeakingChart activity={dashboard.speakingActivity} />
      <FillerChart activity={dashboard.speakingActivity} />
    </div>
  );
}

function LessonVocabulary({ lesson }: { lesson: GoalLessonInsight }) {
  const vocabulary = lesson.vocabulary;
  return (
    <div className="space-y-6">
      <div><h2 className="font-display text-2xl font-semibold text-[var(--navy)]">Vocabulary insights</h2><p className="mt-1 text-sm text-[var(--muted-ink)]">Calculated only from the transcripts in this lesson</p></div>
      <div className="grid grid-cols-4 gap-3">
        <Metric label="Total words spoken" value={vocabulary.totalWords.toLocaleString()} detail={`Across ${lesson.answerCount} ${lesson.answerCount === 1 ? 'answer' : 'answers'} in this lesson`} />
        <Metric label="Distinct words used" value={vocabulary.uniqueWords.toLocaleString()} detail="Observed in this lesson only" />
        <Metric label="First observed recently" value={vocabulary.newlyObservedWords === null ? '—' : vocabulary.newlyObservedWords.toLocaleString()} detail={vocabulary.comparisonLabel ?? 'Complete another lesson to compare'} />
        <Metric label="Repeated meaningful words" value={vocabulary.repeatedWords.length.toLocaleString()} detail="Frequently recurring transcript words" />
      </div>
      <section><h3 className="font-display text-lg font-semibold text-[var(--navy)]">Frequently repeated words</h3>{vocabulary.repeatedWords.length ? <div className="mt-3 flex flex-wrap gap-2">{vocabulary.repeatedWords.map((item) => <span key={item.word} className="rounded-full border border-[var(--line)] bg-white px-3 py-1.5 text-xs text-[var(--ink)]">{item.word} <span className="text-[var(--muted-ink)]">× {item.count}</span></span>)}</div> : <p className="mt-3 text-sm text-[var(--muted-ink)]">No meaningful word appears often enough to show yet.</p>}</section>
      <section><h3 className="mb-4 font-display text-xl font-semibold text-[var(--navy)]">Vocabulary feedback</h3><FeedbackColumns strengths={vocabulary.strengths} improvements={vocabulary.improvements} emptyMessage="No vocabulary feedback was saved for this lesson." /></section>
      <p className="text-xs leading-5 text-[var(--muted-ink)]">“First observed” means new to your saved Sayform transcripts, not newly learned. Sayform does not assign a vocabulary variety or sophistication score.</p>
    </div>
  );
}

function LessonGrammar({ lesson }: { lesson: GoalLessonInsight }) {
  return <div className="space-y-6"><div><h2 className="font-display text-2xl font-semibold text-[var(--navy)]">Grammar and sentence structure</h2><p className="mt-1 text-sm text-[var(--muted-ink)]">Sentence-level feedback from this lesson’s answers</p></div><FeedbackColumns strengths={lesson.grammar.strengths} improvements={lesson.grammar.improvements} emptyMessage="No sentence-structure feedback was saved for this lesson." /></div>;
}

function LessonFluency({ lesson }: { lesson: GoalLessonInsight }) {
  const fluency = lesson.fluency;
  const pacePosition = Math.min(100, Math.max(0, ((fluency.averageWpm - 60) / 160) * 100));
  return (
    <div className="space-y-6">
      <div><h2 className="font-display text-2xl font-semibold text-[var(--navy)]">Fluency insights</h2><p className="mt-1 text-sm text-[var(--muted-ink)]">Pace and verbal habits from this lesson only</p></div>
      <div className="grid grid-cols-4 gap-3"><Metric label="Average pace" value={`${fluency.averageWpm} WPM`} detail="Weighted by this lesson’s recorded speaking time" /><Metric label="Filler words" value={fluency.fillerCount.toLocaleString()} detail="Across this lesson’s completed answers" /><Metric label="Filler rate" value={`${fluency.fillerRatePer100Words}`} detail="Fillers per 100 transcript words" /><Metric label="Speaking time" value={minutesLabel(lesson.speakingSeconds)} detail="Recorded answers in this lesson" /></div>
      <section className="rounded-2xl border border-[var(--line)] bg-white p-6 shadow-[var(--shadow-sm)]">
        <div className="flex items-center gap-2"><Gauge className="size-5 text-[var(--teal)]" /><h3 className="font-display text-lg font-semibold text-[var(--navy)]">Speaking pace</h3></div>
        <p className="mt-2 text-sm leading-6 text-[var(--muted-ink)]">The 100–165 WPM band is a practical reference for clear professional speech, not a score or native-speaker benchmark.</p>
        <div className="relative mt-6 h-3 rounded-full bg-[var(--warm)]"><div className="absolute bottom-0 top-0 rounded-full bg-[var(--mint)]" style={{ left: '25%', width: '40.6%' }} /><span className="absolute top-1/2 size-5 -translate-x-1/2 -translate-y-1/2 rounded-full border-4 border-white bg-[var(--navy)] shadow" style={{ left: `${pacePosition}%` }} /></div>
        <div className="mt-2 flex justify-between text-[10px] text-[var(--muted-ink)]"><span>60 WPM</span><span>Reference: 100–165</span><span>220 WPM</span></div>
      </section>
      <div className="grid grid-cols-2 gap-5">
        <section className="rounded-2xl border border-[var(--line)] bg-white p-5"><h3 className="flex items-center gap-2 font-display text-lg font-semibold text-[var(--navy)]"><MessageSquareText className="size-4 text-[var(--teal)]" />Common fillers</h3>{fluency.commonFillers.length ? <div className="mt-4 flex flex-wrap gap-2">{fluency.commonFillers.map((item) => <span key={item.phrase} className="rounded-full bg-[var(--amber-soft)] px-3 py-1.5 text-xs text-[#78581d]">{item.phrase} × {item.count}</span>)}</div> : <p className="mt-3 text-sm text-[var(--muted-ink)]">No filler expressions were detected in saved transcripts.</p>}</section>
        <section className="rounded-2xl border border-[var(--line)] bg-white p-5"><h3 className="flex items-center gap-2 font-display text-lg font-semibold text-[var(--navy)]"><Repeat2 className="size-4 text-[var(--teal)]" />Repeated openings</h3>{fluency.repeatedOpenings.length ? <div className="mt-4 space-y-2">{fluency.repeatedOpenings.map((item) => <div key={item.phrase} className="flex items-center justify-between rounded-xl bg-[var(--canvas)] px-3 py-2 text-xs"><span>“{item.phrase}…”</span><span className="text-[var(--muted-ink)]">{item.count} times</span></div>)}</div> : <p className="mt-3 text-sm text-[var(--muted-ink)]">No repeated answer openings were detected.</p>}</section>
      </div>
      {fluency.feedback.length ? <section><h3 className="mb-4 font-display text-xl font-semibold text-[var(--navy)]">Related coaching</h3><div className="grid grid-cols-2 gap-4">{fluency.feedback.map((item) => <FeedbackCard key={item.id} item={item} tone={item.positive ? 'positive' : 'improve'} />)}</div></section> : <div className="rounded-2xl border border-dashed border-[#b8c9c4] bg-[var(--canvas)] px-6 py-10 text-center text-sm text-[var(--muted-ink)]">No fluency feedback was saved for this lesson.</div>}
    </div>
  );
}

function LessonInsights({
  dashboard,
  selectedLessonId,
  onSelectLesson,
  onPracticeGoal,
}: {
  dashboard: GoalDashboard;
  selectedLessonId: string | null;
  onSelectLesson: (lessonId: string | null) => void;
  onPracticeGoal: () => void;
}) {
  const lesson = dashboard.lessons.find((item) => item.id === selectedLessonId) ?? null;

  if (lesson) {
    const date = new Intl.DateTimeFormat('en-US', { month: 'long', day: 'numeric', year: 'numeric' }).format(new Date(lesson.completedAt));
    const communicationStrengths = lesson.communicationFeedback.filter((item) => item.positive);
    const communicationImprovements = lesson.communicationFeedback.filter((item) => !item.positive);
    return (
      <div className="space-y-10">
        <div>
          <button onClick={() => onSelectLesson(null)} className="inline-flex items-center gap-1.5 text-sm font-semibold text-[var(--teal-dark)] hover:underline"><ChevronLeft className="size-4" />All lessons</button>
          <div className="mt-5 flex items-start justify-between gap-8">
            <div className="max-w-3xl">
              <p className="text-[11px] font-semibold uppercase tracking-[0.11em] text-[var(--teal-dark)]">Lesson insights · {date}</p>
              <h2 className="mt-2 font-display text-3xl font-semibold leading-tight tracking-[-0.03em] text-[var(--navy)]">{lesson.title}</h2>
              <p className="mt-3 text-sm text-[var(--muted-ink)]">{lesson.answerCount} saved {lesson.answerCount === 1 ? 'answer' : 'answers'} · {minutesLabel(lesson.speakingSeconds)} of recorded speech</p>
            </div>
            <Button nativeButton={false} render={<Link href={`/history/${lesson.id}`} />} variant="outline" className="shrink-0 rounded-xl bg-white">View saved lesson <ArrowRight className="ml-1 size-4" /></Button>
          </div>
        </div>

        <section className="border-t border-[var(--line)] pt-9"><LessonVocabulary lesson={lesson} /></section>
        <section className="border-t border-[var(--line)] pt-9"><LessonGrammar lesson={lesson} /></section>
        <section className="border-t border-[var(--line)] pt-9"><LessonFluency lesson={lesson} /></section>
        <section className="border-t border-[var(--line)] pt-9">
          <div className="mb-5"><h2 className="font-display text-2xl font-semibold text-[var(--navy)]">Communication coaching</h2><p className="mt-1 text-sm text-[var(--muted-ink)]">Structure, reasoning, storytelling, and communication effectiveness from this lesson</p></div>
          <FeedbackColumns strengths={communicationStrengths} improvements={communicationImprovements} emptyMessage="No additional communication coaching was saved for this lesson." />
        </section>
      </div>
    );
  }

  return (
    <div className="space-y-10">
      <section>
        <div className="flex items-end justify-between gap-6">
          <div><h2 className="font-display text-2xl font-semibold text-[var(--navy)]">Lesson insights</h2><p className="mt-1 text-sm text-[var(--muted-ink)]">Open a lesson to see vocabulary, grammar, fluency, and feedback tied only to that session.</p></div>
          <p className="text-xs text-[var(--muted-ink)]">{dashboard.lessons.length} completed {dashboard.lessons.length === 1 ? 'lesson' : 'lessons'}</p>
        </div>
        {dashboard.lessons.length ? (
          <div className="mt-6 grid grid-cols-2 gap-4">
            {dashboard.lessons.map((item) => {
              const date = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).format(new Date(item.completedAt));
              return (
                <button key={item.id} onClick={() => onSelectLesson(item.id)} className="group rounded-2xl border border-[var(--line)] bg-white p-6 text-left shadow-[var(--shadow-sm)] transition hover:-translate-y-0.5 hover:border-[#9fc9bc] hover:shadow-md">
                  <div className="flex items-start justify-between gap-4">
                    <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-[var(--mint-soft)] text-[var(--teal-dark)]"><MessageSquareText className="size-5" /></span>
                    <span className="text-xs text-[var(--muted-ink)]">{date}</span>
                  </div>
                  <h3 className="mt-5 line-clamp-2 font-display text-xl font-semibold leading-7 text-[var(--navy)]">{item.title}</h3>
                  {item.summary && <p className="mt-2 line-clamp-2 text-sm leading-6 text-[var(--muted-ink)]">{item.summary}</p>}
                  <div className="mt-5 grid grid-cols-3 gap-2 border-t border-[var(--line)] pt-4 text-xs">
                    <span><strong className="block text-sm text-[var(--navy)]">{item.vocabulary.totalWords}</strong><span className="text-[var(--muted-ink)]">words</span></span>
                    <span><strong className="block text-sm text-[var(--navy)]">{item.fluency.averageWpm}</strong><span className="text-[var(--muted-ink)]">WPM</span></span>
                    <span><strong className="block text-sm text-[var(--navy)]">{item.fluency.fillerCount}</strong><span className="text-[var(--muted-ink)]">fillers</span></span>
                  </div>
                  <div className="mt-5 flex items-center justify-end text-xs font-semibold text-[var(--teal-dark)]"><span className="inline-flex items-center gap-1 group-hover:underline">View insights <ArrowRight className="size-3.5" /></span></div>
                </button>
              );
            })}
          </div>
        ) : (
          <div className="mt-6 grid min-h-[280px] place-items-center rounded-2xl border border-dashed border-[#b8c9c4] bg-[var(--canvas)] px-8 text-center">
            <div className="max-w-md"><MessageSquareText className="mx-auto size-8 text-[var(--teal)]" /><h3 className="mt-4 font-display text-xl font-semibold text-[var(--navy)]">Your lesson insights will appear here</h3><p className="mt-2 text-sm leading-6 text-[var(--muted-ink)]">Complete a practice session to create a lesson with its own vocabulary, grammar, fluency, and feedback.</p><Button onClick={onPracticeGoal} className="mt-5 rounded-xl bg-[var(--navy)]">Practise this goal <ArrowRight className="ml-1 size-4" /></Button></div>
          </div>
        )}
      </section>

    </div>
  );
}

export function GoalsView() {
  const router = useRouter();
  const { updateSetup, resetSession } = usePractice();
  const [goals, setGoals] = useState<Goal[]>([]);
  const [dashboard, setDashboard] = useState<GoalDashboard | null>(null);
  const [pageTab, setPageTab] = useState<GoalsPageTab>('summary');
  const [selectedLessonId, setSelectedLessonId] = useState<string | null>(null);
  const [editing, setEditing] = useState<Goal | null>(null);
  const [goalDialogOpen, setGoalDialogOpen] = useState(false);
  const [changeDialogOpen, setChangeDialogOpen] = useState(false);
  const [draftTitle, setDraftTitle] = useState('');
  const [draftDescription, setDraftDescription] = useState('');
  const [notice, setNotice] = useState('');
  const [loading, setLoading] = useState(true);
  const [dashboardLoading, setDashboardLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activatingId, setActivatingId] = useState<string | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    void listGoals().then(setGoals).catch((caught) => setError(caught instanceof Error ? caught.message : 'Goals could not be loaded.')).finally(() => setLoading(false));
  }, []);

  const availableGoals = goals.filter((goal) => goal.status === 'active');
  const activeGoal = availableGoals.find((goal) => goal.isActive) ?? availableGoals[0] ?? null;
  const activeGoalId = activeGoal?.id ?? null;
  const otherGoals = availableGoals.filter((goal) => goal.id !== activeGoal?.id);

  useEffect(() => {
    if (!activeGoalId) return;
    let cancelled = false;
    void getGoalDashboard(activeGoalId)
      .then((result) => { if (!cancelled) setDashboard(result); })
      .catch((caught) => { if (!cancelled) setError(caught instanceof Error ? caught.message : 'Dashboard insights could not be loaded.'); })
      .finally(() => { if (!cancelled) setDashboardLoading(false); });
    return () => { cancelled = true; };
  }, [activeGoalId]);

  function startPractice(goal: Goal) {
    const questions = getPracticeQuestions(goal.templateKey);
    resetSession();
    updateSetup({ goalId: goal.id, goalTitle: goal.title, goalTemplateKey: goal.templateKey, goalSkills: goal.skills, categories: [goal.defaultCategory], customTopic: '', prompt: questions[0] });
    router.push('/practice/session');
  }

  function openCreate() {
    setEditing(null);
    setDraftTitle('');
    setDraftDescription('');
    setGoalDialogOpen(true);
  }

  function openEdit(goal: Goal) {
    setEditing(goal);
    setDraftTitle(goal.title);
    setDraftDescription(goal.description);
    setGoalDialogOpen(true);
  }

  async function saveGoal() {
    if (draftTitle.trim().length < 3) return;
    setSaving(true);
    setError('');
    try {
      if (editing) {
        await updateGoal(editing.id, { title: draftTitle.trim(), description: draftDescription.trim() });
        setGoals((current) => current.map((goal) => goal.id === editing.id ? { ...goal, title: draftTitle.trim(), description: draftDescription.trim() } : goal));
        setNotice('Custom goal updated');
      } else {
        const goal = await createGoal({ title: draftTitle.trim(), description: draftDescription.trim() });
        setGoals((current) => current.some((item) => item.id === goal.id) ? current : [...current, goal]);
        setNotice('Custom goal created');
      }
      setGoalDialogOpen(false);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Goal could not be saved.');
    } finally {
      setSaving(false);
    }
  }

  async function activate(goal: Goal) {
    if (goal.isActive) return;
    setActivatingId(goal.id);
    setError('');
    try {
      await setActiveGoal(goal.id);
      setDashboard(null);
      setDashboardLoading(true);
      setGoals((current) => current.map((item) => ({ ...item, isActive: item.id === goal.id })));
      setPageTab('summary');
      setSelectedLessonId(null);
      setChangeDialogOpen(false);
      setNotice(`${goal.title} is now your active goal`);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'The active goal could not be changed.');
    } finally {
      setActivatingId(null);
    }
  }

  return (
    <AppShell>
      <Screen wide>
        <PageHeader eyebrow="Your practice dashboard" title="Keep getting better at what matters" action={<Button variant="outline" className="h-10 rounded-xl border-[var(--line)] bg-white" onClick={openCreate}><Plus className="size-4" />Create custom goal</Button>} />
        {notice && <div className="mb-5 flex items-center justify-between rounded-xl border border-[var(--mint)] bg-[var(--mint-soft)] px-4 py-3 text-sm text-[var(--teal-dark)]"><span className="flex items-center gap-2"><CheckCircle2 className="size-4" />{notice}</span><button onClick={() => setNotice('')} className="text-xs font-semibold hover:underline">Dismiss</button></div>}
        {error && <div role="alert" className="mb-5 flex items-center justify-between rounded-xl border border-[#e8c6bf] bg-[var(--rose-soft)] px-4 py-3 text-sm text-[#8f4336]"><span>{error}</span><button onClick={() => setError('')} className="text-xs font-semibold hover:underline">Dismiss</button></div>}

        {loading ? (
          <div className="grid min-h-80 place-items-center rounded-3xl border border-dashed border-[#bcc8c4] bg-white/45 text-sm text-[var(--muted-ink)]">Loading your dashboard…</div>
        ) : !activeGoal ? (
          <div className="grid min-h-80 place-items-center rounded-3xl border border-dashed border-[#bcc8c4] bg-white/45 text-center"><div><Target className="mx-auto size-8 text-[var(--teal)]" /><h2 className="mt-4 text-base font-semibold text-[var(--navy)]">No active goal</h2><p className="mt-1 text-sm text-[var(--muted-ink)]">Create a goal to start building your practice dashboard.</p><Button onClick={openCreate} className="mt-5 rounded-xl">Create custom goal</Button></div></div>
        ) : (
          <>
            <nav className="mb-6 flex items-center gap-7 border-b border-[var(--line)]" aria-label="Goals sections">
              <button onClick={() => setPageTab('summary')} className={cn('relative flex h-12 items-center gap-2 px-0.5 text-sm font-semibold', pageTab === 'summary' ? 'text-[var(--ink)] after:absolute after:bottom-0 after:left-0 after:h-0.5 after:w-full after:bg-[var(--ink)]' : 'text-[var(--muted-ink)] hover:text-[var(--ink)]')}>Summary</button>
              <button onClick={() => setPageTab('lessons')} className={cn('relative flex h-12 items-center gap-2 px-0.5 text-sm font-semibold', pageTab === 'lessons' ? 'text-[var(--ink)] after:absolute after:bottom-0 after:left-0 after:h-0.5 after:w-full after:bg-[var(--ink)]' : 'text-[var(--muted-ink)] hover:text-[var(--ink)]')}>
                Lesson Insights
                {dashboard?.lessons.length ? <span className="rounded-full bg-[var(--mint-soft)] px-2 py-0.5 text-[10px] text-[var(--teal-dark)]">{dashboard.lessons.length}</span> : null}
              </button>
            </nav>

            {pageTab === 'summary' && (
              <section className="rounded-3xl border border-[#9fc9bc] bg-[var(--paper)] p-7 shadow-[var(--shadow-sm)]">
                <div className="flex items-start justify-between gap-8">
                  <div className="max-w-3xl">
                    <div className="flex items-center gap-2"><span className="inline-flex items-center gap-1.5 rounded-full border border-[#b8d8cf] bg-[var(--mint-soft)] px-3 py-1 text-[11px] font-semibold text-[var(--teal-dark)]"><span className="size-1.5 rounded-full bg-[var(--teal)]" />Active goal</span><span className="text-xs text-[var(--muted-ink)]">{formatLastPractised(dashboard?.lastPractised ?? activeGoal.lastPractised)}</span></div>
                    <h2 className="mt-5 font-display text-[32px] font-semibold tracking-[-0.035em] text-[var(--navy)]">{activeGoal.title}</h2>
                    <p className="mt-2 text-[15px] leading-6 text-[var(--muted-ink)]">{activeGoal.description}</p>
                    <div className="mt-6 flex items-center gap-3"><Button onClick={() => startPractice(activeGoal)} className="h-11 rounded-xl bg-[var(--navy)] px-5 hover:bg-[#1d4255]">Practise this goal <ArrowRight className="ml-1 size-4" /></Button><Button variant="outline" onClick={() => setChangeDialogOpen(true)} className="h-11 rounded-xl border-[var(--line)] bg-white">Change goal</Button>{activeGoal.isCustom && <button onClick={() => openEdit(activeGoal)} className="ml-1 inline-flex items-center gap-1.5 text-xs font-semibold text-[var(--muted-ink)] hover:text-[var(--ink)]"><Pencil className="size-3.5" />Edit goal</button>}</div>
                  </div>
                  <div className="grid min-w-[280px] grid-cols-2 gap-3 self-stretch"><div className="rounded-2xl bg-[var(--canvas)] p-4"><CalendarDays className="size-4 text-[var(--teal)]" /><p className="mt-4 font-display text-2xl font-semibold text-[var(--navy)]">{dashboard?.sessionCount ?? activeGoal.sessions}</p><p className="mt-1 text-xs text-[var(--muted-ink)]">completed sessions</p></div><div className="rounded-2xl bg-[var(--canvas)] p-4"><Clock3 className="size-4 text-[var(--teal)]" /><p className="mt-4 font-display text-2xl font-semibold text-[var(--navy)]">{dashboard ? minutesLabel(dashboard.totalSpeakingSeconds) : '—'}</p><p className="mt-1 text-xs text-[var(--muted-ink)]">recorded speech</p></div></div>
                </div>
              </section>
            )}

            {pageTab === 'summary' ? (
              <>
                <section className="mt-6 overflow-hidden rounded-3xl border border-[var(--line)] bg-[var(--paper)] shadow-[var(--shadow-sm)]">
                  <div className="p-7">{dashboardLoading || !dashboard ? <div className="grid min-h-[360px] place-items-center text-sm text-[var(--muted-ink)]">Loading goal insights…</div> : dashboard.sessionCount === 0 ? <EmptyDashboard goal={activeGoal} onPractice={() => startPractice(activeGoal)} /> : <SummaryTab dashboard={dashboard} />}</div>
                </section>

                {otherGoals.length > 0 && (
                  <section className="mt-8 rounded-3xl border border-[var(--line)] bg-white/55 p-6">
                    <div className="flex items-end justify-between gap-6"><div><p className="text-xs font-semibold uppercase tracking-[0.11em] text-[var(--teal-dark)]">Other goals</p><h2 className="mt-1 font-display text-xl font-semibold text-[var(--navy)]">Choose a different direction when you are ready</h2></div><p className="max-w-sm text-right text-xs leading-5 text-[var(--muted-ink)]">Changing your active goal is always explicit. Each goal keeps its own history and metrics.</p></div>
                    <div className="mt-5 grid grid-cols-3 gap-3">{otherGoals.map((goal) => <article key={goal.id} className="rounded-2xl border border-[var(--line)] bg-[var(--paper)] p-5"><div className="flex items-start justify-between gap-3"><div><h3 className="font-display text-lg font-semibold text-[var(--navy)]">{goal.title}</h3><p className="mt-1 line-clamp-2 text-xs leading-5 text-[var(--muted-ink)]">{goal.description}</p></div>{goal.sessions === 0 && <Sparkles className="size-4 shrink-0 text-[#b78832]" />}</div><div className="mt-5 flex items-center justify-between border-t border-[var(--line)] pt-4"><span className="text-xs text-[var(--muted-ink)]">{goal.sessions ? `${goal.sessions} ${goal.sessions === 1 ? 'session' : 'sessions'}` : 'Not practised yet'}</span><button onClick={() => void activate(goal)} disabled={Boolean(activatingId)} className="text-xs font-semibold text-[var(--teal-dark)] hover:underline disabled:opacity-50">{activatingId === goal.id ? 'Changing…' : 'Set as active goal →'}</button></div></article>)}</div>
                  </section>
                )}
              </>
            ) : (
              <section className="rounded-3xl border border-[var(--line)] bg-[var(--paper)] p-7 shadow-[var(--shadow-sm)]">
                {dashboardLoading || !dashboard ? (
                  <div className="grid min-h-[360px] place-items-center text-sm text-[var(--muted-ink)]">Loading lesson insights…</div>
                ) : (
                  <LessonInsights
                    dashboard={dashboard}
                    selectedLessonId={selectedLessonId}
                    onSelectLesson={setSelectedLessonId}
                    onPracticeGoal={() => startPractice(activeGoal)}
                  />
                )}
              </section>
            )}
          </>
        )}
      </Screen>

      <Dialog open={changeDialogOpen} onOpenChange={setChangeDialogOpen}><DialogContent className="max-w-xl rounded-2xl p-6"><DialogHeader><DialogTitle className="font-display text-xl text-[var(--navy)]">Change your active goal</DialogTitle><DialogDescription>Your dashboard will switch to that goal’s own practice history. Sayform will not change it automatically.</DialogDescription></DialogHeader><div className="space-y-2">{availableGoals.map((goal) => <button key={goal.id} onClick={() => void activate(goal)} disabled={goal.isActive || Boolean(activatingId)} className={cn('flex w-full items-center justify-between rounded-xl border px-4 py-3 text-left', goal.isActive ? 'border-[var(--mint)] bg-[var(--mint-soft)]' : 'border-[var(--line)] bg-white hover:border-[#a9c8bf]')}><span><span className="block text-sm font-semibold text-[var(--navy)]">{goal.title}</span><span className="mt-0.5 block text-xs text-[var(--muted-ink)]">{goal.sessions ? `${goal.sessions} completed ${goal.sessions === 1 ? 'session' : 'sessions'}` : 'No practice yet'}</span></span>{goal.isActive ? <span className="inline-flex items-center gap-1 text-xs font-semibold text-[var(--teal-dark)]"><Check className="size-3.5" />Active</span> : <span className="text-xs font-semibold text-[var(--teal-dark)]">{activatingId === goal.id ? 'Changing…' : 'Set active'}</span>}</button>)}</div><DialogFooter><Button variant="outline" onClick={() => setChangeDialogOpen(false)}>Cancel</Button></DialogFooter></DialogContent></Dialog>

      <Dialog open={goalDialogOpen} onOpenChange={setGoalDialogOpen}><DialogContent className="max-w-lg rounded-2xl p-6"><DialogHeader><DialogTitle className="font-display text-xl text-[var(--navy)]">{editing ? 'Edit custom goal' : 'Create a custom goal'}</DialogTitle><DialogDescription>Describe the communication outcome you want to practise. It will keep its own history, metrics, and feedback.</DialogDescription></DialogHeader><div className="space-y-4"><div><label htmlFor="goal-title" className="text-sm font-semibold text-[var(--navy)]">Goal</label><Input id="goal-title" value={draftTitle} onChange={(event) => setDraftTitle(event.target.value)} placeholder="Example: Present technical recommendations to executives" className="mt-2 h-11" /></div><div><label htmlFor="goal-description" className="text-sm font-semibold text-[var(--navy)]">What would improvement look like?</label><Textarea id="goal-description" value={draftDescription} onChange={(event) => setDraftDescription(event.target.value)} placeholder="Describe the audience, situation, or result you want." className="mt-2 min-h-24 resize-none" /></div></div><DialogFooter className="-mx-6 -mb-6 mt-2 px-6 py-4"><Button variant="outline" onClick={() => setGoalDialogOpen(false)}>Cancel</Button><Button disabled={draftTitle.trim().length < 3 || saving} onClick={() => void saveGoal()}>{saving ? 'Saving…' : editing ? 'Save goal' : 'Create goal'}</Button></DialogFooter></DialogContent></Dialog>
    </AppShell>
  );
}

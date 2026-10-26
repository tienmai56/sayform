'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  ArrowRight,
  Clock3,
  Gauge,
  MessageSquareText,
  Target,
} from 'lucide-react';
import { AppShell, PageHeader, Screen } from '@/components/app-shell';
import { Button } from '@/components/ui/button';
import type { DashboardFeedbackItem, Goal, GoalDashboard, GoalExercise } from '@/lib/types';
import { getPracticeQuestions } from '@/lib/goal-catalog';
import { usePractice } from '@/components/practice-context';
import {
  getGoalDashboard,
  listGoalExercises,
  listGoals,
  updateExerciseStatus,
} from '@/lib/client-data';
import { cn } from '@/lib/utils';

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

function speakingSpeedSummary(wordsPerMinute: number) {
  if (wordsPerMinute <= 0) return 'Complete a recorded answer to establish your speaking speed.';
  if (wordsPerMinute < 100) return 'A little slow for an interview. Try speaking slightly faster while keeping your words clear.';
  if (wordsPerMinute <= 165) return 'A clear, natural pace for most interview answers.';
  return 'A little fast. Slow down slightly so your key points are easier to follow.';
}

function compactMinutesLabel(seconds: number) {
  const minutes = seconds / 60;
  return `${minutes >= 10 ? Math.round(minutes) : Number(minutes.toFixed(1))}m`;
}

type ChartMode = 'day' | 'week';
const LESSONS_PER_PAGE = 5;

function localDateKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function startOfWeek(date: Date) {
  const result = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const day = result.getDay();
  result.setDate(result.getDate() - (day === 0 ? 6 : day - 1));
  return result;
}

function buildSpeakingChartData(activity: GoalDashboard['speakingActivity'], mode: ChartMode) {
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
    for (const item of activity) {
      const bucket = byKey.get(localDateKey(new Date(item.occurredAt)));
      if (bucket) {
        bucket.seconds += item.durationSeconds;
        bucket.fillerCount += item.fillerCount;
      }
    }
    return buckets;
  }

  const currentWeek = startOfWeek(now);
  const recentWeekBoundary = new Date(currentWeek);
  recentWeekBoundary.setDate(recentWeekBoundary.getDate() - 49);
  const anchor = latestActivity && latestActivity < recentWeekBoundary ? startOfWeek(latestActivity) : currentWeek;
  const buckets = Array.from({ length: 8 }, (_, index) => {
    const date = new Date(anchor);
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
  for (const item of activity) {
    const bucket = byKey.get(localDateKey(startOfWeek(new Date(item.occurredAt))));
    if (bucket) {
      bucket.seconds += item.durationSeconds;
      bucket.fillerCount += item.fillerCount;
    }
  }
  return buckets;
}

function summarizeFeedback(items: DashboardFeedbackItem[], fallback: string) {
  const newestFirst = [...items].sort((first, second) => second.createdAt.localeCompare(first.createdAt));
  const latestByDimension = new Map<DashboardFeedbackItem['dimension'], DashboardFeedbackItem>();
  for (const item of newestFirst) {
    if (!latestByDimension.has(item.dimension)) latestByDimension.set(item.dimension, item);
  }
  const current = [...latestByDimension.values()];
  const earlierState = (item: DashboardFeedbackItem, positive: boolean) => {
    const currentIndex = newestFirst.indexOf(item);
    return newestFirst.slice(currentIndex + 1).find((candidate) => (
      candidate.dimension === item.dimension && Boolean(candidate.positive) === positive
    ));
  };
  const improvedStrength = current.find((item) => item.positive && earlierState(item, false));
  const strength = improvedStrength ?? current.find((item) => item.positive);
  const newFocus = current.find((item) => (
    !item.positive
    && (item.progressStatus === 'new' || Boolean(earlierState(item, true)))
  ));
  const improvement = newFocus ?? current.find((item) => !item.positive);
  return {
    strength: strength ? strength.explanation || strength.title : null,
    strengthLabel: improvedStrength ? 'Improved' : 'Strength',
    focus: improvement ? improvement.explanation || improvement.title : null,
    focusLabel: newFocus ? 'New focus' : 'Focus',
    fallback: strength || improvement ? null : fallback,
  };
}

function SpeakingChart({ activity }: { activity: GoalDashboard['speakingActivity'] }) {
  const [mode, setMode] = useState<ChartMode>('day');
  const data = useMemo(() => buildSpeakingChartData(activity, mode), [activity, mode]);
  const maxSeconds = Math.max(...data.map((bucket) => bucket.seconds), 60);
  const maxFillers = Math.max(...data.map((bucket) => bucket.fillerCount), 1);

  return (
    <div>
      <div className="flex items-start justify-between gap-5">
        <div>
          <h3 className="font-display text-lg font-semibold text-[var(--navy)]">Speaking time</h3>
        </div>
        <div className="flex items-center border-b border-[var(--line)]" aria-label="Speaking time grouping">
          {(['day', 'week'] as const).map((value) => (
            <button key={value} type="button" onClick={() => setMode(value)} className={cn('-mb-px border-b-2 px-3 py-2 text-xs font-semibold capitalize transition-colors', mode === value ? 'border-[#6842d8] text-[#6842d8]' : 'border-transparent text-[var(--muted-ink)] hover:text-[var(--ink)]')}>{value}</button>
          ))}
        </div>
      </div>
      <div className="mt-5 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-[var(--muted-ink)]" aria-label="Chart legend">
        <span className="inline-flex items-center gap-2"><span className="size-2.5 rounded-sm bg-[#6842d8]" aria-hidden="true" />Speaking time</span>
        <span className="inline-flex items-center gap-2"><span className="size-2.5 rounded-sm bg-[#d6a44f]" aria-hidden="true" />Filler words</span>
      </div>
      <div className="mt-5 grid h-52 grid-cols-[34px_1fr_26px] gap-3">
        <div className="flex flex-col justify-between pb-7 text-right text-[10px] text-[var(--muted-ink)]"><span>{compactMinutesLabel(maxSeconds)}</span><span>{compactMinutesLabel(maxSeconds / 2)}</span><span>0m</span></div>
        <div className={cn('relative grid items-end gap-2 border-b border-[var(--line)] bg-[linear-gradient(to_bottom,transparent_49%,var(--line)_50%,transparent_51%)]', mode === 'day' ? 'grid-cols-7' : 'grid-cols-8')}>
          {data.map((bucket) => (
            <div key={bucket.key} className="group flex h-full min-w-0 flex-col items-center justify-end" title={`${bucket.detail}: ${(bucket.seconds / 60).toFixed(1)} minutes, ${bucket.fillerCount} filler ${bucket.fillerCount === 1 ? 'word' : 'words'}`}>
              <span className="mb-1 whitespace-nowrap text-[9px] font-semibold text-[#6842d8] opacity-0 group-hover:opacity-100 group-focus-within:opacity-100">{bucket.seconds || bucket.fillerCount ? `${(bucket.seconds / 60).toFixed(1)}m · ${bucket.fillerCount}` : ''}</span>
              <span className="sr-only">{bucket.detail}: {(bucket.seconds / 60).toFixed(1)} minutes and {bucket.fillerCount} filler words</span>
              <div className="flex h-[132px] w-full items-end justify-center gap-1">
                <div className="w-[38%] max-w-5 rounded-t-sm bg-[#6842d8] transition-[height]" style={{ height: bucket.seconds ? `${Math.max(8, (bucket.seconds / maxSeconds) * 132)}px` : '2px' }} />
                <div className="w-[38%] max-w-5 rounded-t-sm bg-[#d6a44f] transition-[height]" style={{ height: bucket.fillerCount ? `${Math.max(8, (bucket.fillerCount / maxFillers) * 132)}px` : '2px' }} />
              </div>
              <span className="mt-2 max-w-full truncate text-[10px] text-[var(--muted-ink)]">{bucket.label}</span>
            </div>
          ))}
        </div>
        <div className="flex flex-col justify-between pb-7 text-[10px] text-[#8a621c]"><span>{maxFillers}</span><span>{Number((maxFillers / 2).toFixed(1))}</span><span>0</span></div>
      </div>
    </div>
  );
}

function ProgressRecap({ dashboard }: { dashboard: GoalDashboard }) {
  const newestLessons = dashboard.lessons;
  const interviewFeedback = newestLessons.flatMap((lesson) => lesson.communicationFeedback);
  const vocabularyFeedback = newestLessons.flatMap((lesson) => [...lesson.vocabulary.strengths, ...lesson.vocabulary.improvements]);
  const grammarFeedback = newestLessons.flatMap((lesson) => [...lesson.grammar.strengths, ...lesson.grammar.improvements]);
  const fluencyFeedback = newestLessons.flatMap((lesson) => lesson.fluency.feedback);
  const summaries = [
    {
      label: 'Interview skills',
      text: summarizeFeedback(interviewFeedback, 'Complete a lesson to receive feedback on how directly and convincingly you answer interview questions.'),
    },
    {
      label: 'Vocabulary',
      text: summarizeFeedback(vocabularyFeedback, 'No vocabulary pattern has been identified yet.'),
    },
    {
      label: 'Grammar & sentence structure',
      text: summarizeFeedback(grammarFeedback, 'No grammar or sentence-structure pattern has been identified yet.'),
    },
    {
      label: 'Fluency',
      text: summarizeFeedback(fluencyFeedback, dashboard.completedAnswerCount > 0
        ? `Average pace: ${dashboard.fluency.averageWpm} WPM. ${dashboard.fluency.fillerCount} fillers across ${dashboard.completedAnswerCount} completed ${dashboard.completedAnswerCount === 1 ? 'answer' : 'answers'}.`
        : 'Complete a lesson to establish your pace and filler baseline.'),
    },
  ];

  return (
    <section className="py-9">
      <h2 className="font-display text-2xl font-semibold tracking-[-0.025em] text-[var(--navy)]">Your progress at a glance</h2>
      <p className="mt-1 text-sm text-[var(--muted-ink)]">A combined view of your interview delivery and language feedback</p>
      <div className="mt-6 flex flex-col gap-4 border-y border-[var(--line)] py-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          <span className="grid size-10 shrink-0 place-items-center rounded-full bg-[#f0ecff] text-[#6842d8]" aria-hidden="true"><Gauge className="size-5" /></span>
          <div>
            <p className="text-xs font-semibold text-[var(--muted-ink)]">Speaking speed</p>
            <p className="mt-1 text-[var(--navy)]"><strong className="font-display text-3xl font-semibold tracking-[-0.03em]">{dashboard.fluency.averageWpm || '—'}</strong>{dashboard.fluency.averageWpm > 0 && <span className="ml-1.5 text-sm font-semibold">WPM</span>}</p>
          </div>
        </div>
        <div className="sm:max-w-sm sm:text-right">
          <p className="text-sm font-medium text-[var(--ink)]">{speakingSpeedSummary(dashboard.fluency.averageWpm)}</p>
          <p className="mt-1 text-xs text-[var(--muted-ink)]">Average across your recorded practice</p>
        </div>
      </div>
      <div className="mt-8">
        <div>
            <SpeakingChart activity={dashboard.speakingActivity} />
        </div>
        <div className="mt-10">
          <h3 className="font-display text-lg font-semibold text-[var(--navy)]">Coaching summary</h3>
          <p className="mt-1 text-sm text-[var(--muted-ink)]">The strongest patterns across your recent interview answers</p>
          <div className="mt-5 grid grid-cols-1 gap-x-10 md:grid-cols-2">
            {summaries.map((summary) => (
              <section key={summary.label} className="border-t border-[var(--line)] py-5" aria-labelledby={`summary-${summary.label.replace(/[^a-z]+/gi, '-').toLowerCase()}`}>
                <h4 id={`summary-${summary.label.replace(/[^a-z]+/gi, '-').toLowerCase()}`} className="text-sm font-semibold text-[var(--navy)]">{summary.label}</h4>
                <div className="mt-4 space-y-4 text-sm leading-6 text-[var(--ink)]">
                  {summary.text.strength && <div className="grid grid-cols-[76px_minmax(0,1fr)] gap-3"><span className="pt-0.5 text-[10px] font-bold uppercase tracking-[0.09em] text-[#6842d8]">{summary.text.strengthLabel}</span><p>{summary.text.strength}</p></div>}
                  {summary.text.focus && <div className="grid grid-cols-[76px_minmax(0,1fr)] gap-3"><span className="pt-0.5 text-[10px] font-bold uppercase tracking-[0.09em] text-[#946414]">{summary.text.focusLabel}</span><p>{summary.text.focus}</p></div>}
                  {summary.text.fallback && <p className="text-[var(--muted-ink)]">{summary.text.fallback}</p>}
                </div>
              </section>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

export function GoalsView() {
  const router = useRouter();
  const { updateSetup, resetSession, startExercise: beginExercise } = usePractice();
  const [goals, setGoals] = useState<Goal[]>([]);
  const [dashboard, setDashboard] = useState<GoalDashboard | null>(null);
  const [exercises, setExercises] = useState<GoalExercise[]>([]);
  const [loading, setLoading] = useState(true);
  const [dashboardLoading, setDashboardLoading] = useState(true);
  const [exercisesLoading, setExercisesLoading] = useState(true);
  const [startingExerciseId, setStartingExerciseId] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [lessonPage, setLessonPage] = useState(1);

  useEffect(() => {
    void listGoals()
      .then(setGoals)
      .catch((caught) => setError(caught instanceof Error ? caught.message : 'Goals could not be loaded.'))
      .finally(() => setLoading(false));
  }, []);

  const activeGoal = goals.find((goal) => goal.templateKey === 'clarity' && goal.status === 'active') ?? null;
  const activeGoalId = activeGoal?.id ?? null;
  const recommendedExercises = exercises
    .filter((exercise) => exercise.status !== 'completed' && exercise.nextStep.stage !== 'summary')
    .slice(0, 3);
  const lessonPageCount = dashboard ? Math.max(1, Math.ceil(dashboard.lessons.length / LESSONS_PER_PAGE)) : 1;
  const currentLessonPage = Math.min(lessonPage, lessonPageCount);
  const lessonPageStart = (currentLessonPage - 1) * LESSONS_PER_PAGE;
  const visibleLessons = dashboard?.lessons.slice(lessonPageStart, lessonPageStart + LESSONS_PER_PAGE) ?? [];

  useEffect(() => {
    if (!activeGoalId) return;
    let cancelled = false;
    void getGoalDashboard(activeGoalId)
      .then((result) => { if (!cancelled) { setDashboard(result); setLessonPage(1); } })
      .catch((caught) => { if (!cancelled) setError(caught instanceof Error ? caught.message : 'Dashboard insights could not be loaded.'); })
      .finally(() => { if (!cancelled) setDashboardLoading(false); });
    return () => { cancelled = true; };
  }, [activeGoalId]);

  useEffect(() => {
    if (!activeGoalId) return;
    let cancelled = false;
    void listGoalExercises(activeGoalId)
      .then((result) => { if (!cancelled) setExercises(result); })
      .catch((caught) => { if (!cancelled) setError(caught instanceof Error ? caught.message : 'Recommended exercises could not be loaded.'); })
      .finally(() => { if (!cancelled) setExercisesLoading(false); });
    return () => { cancelled = true; };
  }, [activeGoalId]);

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
      prompt: questions[0] ?? '',
      interviewQuestionType: 'primary',
    });
    router.push('/practice/session');
  }

  async function startSavedExercise(exercise: GoalExercise) {
    if (!activeGoal || exercise.nextStep.stage === 'summary') return;
    setStartingExerciseId(exercise.id);
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
      setError(caught instanceof Error ? caught.message : 'The exercise could not be opened.');
      setStartingExerciseId(null);
    }
  }

  return (
    <AppShell>
      <Screen wide>
        <PageHeader title="Ready for your next interview?" />
        {error && <div role="alert" className="mb-5 flex items-center justify-between rounded-xl border border-[#e8c6bf] bg-[var(--rose-soft)] px-4 py-3 text-sm text-[#8f4336]"><span>{error}</span><button onClick={() => setError('')} className="text-xs font-semibold hover:underline">Dismiss</button></div>}

        {loading ? (
          <div className="grid min-h-80 place-items-center rounded-3xl border border-dashed border-[#bcc8c4] bg-white text-sm text-[var(--muted-ink)]">Loading your dashboard…</div>
        ) : !activeGoal ? (
          <div className="grid min-h-80 place-items-center rounded-3xl border border-dashed border-[#bcc8c4] bg-white text-center"><div><Target className="mx-auto size-8 text-[var(--teal)]" /><h2 className="mt-4 text-base font-semibold text-[var(--navy)]">No active goal</h2><p className="mt-1 text-sm text-[var(--muted-ink)]">No practice goals are currently available.</p></div></div>
        ) : (
          <>
            <section className="overflow-hidden rounded-3xl bg-[#6842d8] px-6 py-7 text-white md:px-8 md:py-8" aria-labelledby="active-goal-title">
              <div className="flex flex-col items-start justify-between gap-7 lg:flex-row lg:items-end">
                <div className="max-w-3xl">
                  <h2 id="active-goal-title" className="font-display text-[34px] font-semibold tracking-[-0.04em] text-white">{activeGoal.title}</h2>
                  {activeGoal.description && <p className="mt-3 text-[15px] leading-7 text-white/80">{activeGoal.description}</p>}
                  <div className="mt-5 flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-white/80">
                    <span><strong className="mr-1 font-display text-xl font-semibold text-white">{dashboard?.sessionCount ?? activeGoal.sessions}</strong> lessons</span>
                    <span><strong className="mr-1 font-display text-xl font-semibold text-white">{dashboard ? minutesLabel(dashboard.totalSpeakingSeconds).replace(' minutes', '') : '—'}</strong> minutes</span>
                    <span>{formatLastPractised(dashboard?.lastPractised ?? activeGoal.lastPractised)}</span>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-4">
                  <Button onClick={() => startPractice(activeGoal)} className="h-11 rounded-none bg-white px-5 text-[#4b2aa8] hover:bg-[#f2edff]">Practice interview <ArrowRight className="ml-1 size-4" /></Button>
                </div>
              </div>
            </section>

            {dashboardLoading || !dashboard ? (
              <div className="grid min-h-52 place-items-center border-b border-[var(--line)] text-sm text-[var(--muted-ink)]">Loading your progress…</div>
            ) : (
              <>
                <ProgressRecap dashboard={dashboard} />
                <section className="border-t border-[var(--line)] py-9" aria-labelledby="lessons-title">
                  <div className="flex flex-col items-start justify-between gap-5 md:flex-row md:items-end md:gap-8">
                    <div>
                      <h2 id="lessons-title" className="font-display text-2xl font-semibold tracking-[-0.025em] text-[var(--navy)]">{dashboard.lessons.length} {dashboard.lessons.length === 1 ? 'lesson' : 'lessons'} practised</h2>
                    </div>
                    <Button onClick={() => startPractice(activeGoal)} variant="outline" className="h-10 rounded-xl border-[var(--line)] bg-white">Start another lesson <ArrowRight className="ml-1 size-4" /></Button>
                  </div>

                  {dashboard.lessons.length ? (
                    <div className="mt-6">
                      <p className="flex items-center gap-2 text-xs font-semibold text-[var(--muted-ink)]"><Clock3 className="size-3.5 text-[#6842d8]" />Newest to oldest</p>
                      <ol className="relative mt-3 space-y-3 before:absolute before:bottom-5 before:left-[17px] before:top-5 before:w-px before:bg-[var(--line)]">
                        {visibleLessons.map((lesson, index) => {
                          const lessonNumber = dashboard.lessons.length - (lessonPageStart + index);
                          const date = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).format(new Date(lesson.completedAt));
                          return (
                            <li key={lesson.id} className="relative pl-12">
                              <span className="absolute left-0 top-1/2 z-10 grid size-9 -translate-y-1/2 place-items-center rounded-full border border-[#d9d0f5] bg-[#f0ecff] text-xs font-semibold text-[#6842d8]" aria-hidden="true">{lessonNumber}</span>
                              <article className="grid items-center gap-3 rounded-xl border border-[var(--line)] bg-white px-4 py-3.5 shadow-[var(--shadow-sm)] md:grid-cols-[110px_minmax(0,1fr)_auto] md:gap-5 md:px-5">
                                <div>
                                  <p className="text-[10px] font-semibold uppercase tracking-[0.09em] text-[#6842d8]">Lesson {lessonNumber}</p>
                                  <p className="mt-1 text-xs text-[var(--muted-ink)]">{date}</p>
                                </div>
                                <div className="min-w-0">
                                  <h3 className="font-display text-base font-semibold leading-6 text-[var(--navy)]">{lesson.title}</h3>
                                  <p className="mt-1 text-xs text-[var(--muted-ink)]">{lesson.answerCount} {lesson.answerCount === 1 ? 'answer' : 'answers'} · {minutesLabel(lesson.speakingSeconds)}</p>
                                </div>
                                <Button nativeButton={false} render={<Link href={`/goals/${dashboard.goalId}/lessons/${lesson.id}`} />} variant="outline" className="h-9 justify-self-start rounded-lg border-[var(--line)] bg-white px-3 text-xs text-[var(--navy)] hover:bg-[#f0ecff] md:justify-self-end">View insights <ArrowRight className="ml-1 size-3.5" /></Button>
                              </article>
                            </li>
                          );
                        })}
                      </ol>
                      {lessonPageCount > 1 && (
                        <nav className="mt-5 flex flex-col gap-3 border-t border-[var(--line)] pt-5 sm:flex-row sm:items-center sm:justify-between" aria-label="Lesson pages">
                          <p className="text-xs text-[var(--muted-ink)]">Showing {lessonPageStart + 1}–{Math.min(lessonPageStart + LESSONS_PER_PAGE, dashboard.lessons.length)} of {dashboard.lessons.length} lessons</p>
                          <div className="flex items-center gap-2">
                            <Button type="button" size="sm" variant="outline" disabled={currentLessonPage === 1} onClick={() => setLessonPage((page) => Math.max(1, page - 1))} className="h-9 rounded-lg border-[var(--line)] bg-white px-3 text-xs">Previous</Button>
                            {Array.from({ length: lessonPageCount }, (_, index) => {
                              const page = index + 1;
                              return <button key={page} type="button" onClick={() => setLessonPage(page)} aria-current={currentLessonPage === page ? 'page' : undefined} aria-label={`Lesson page ${page}`} className={cn('grid size-9 place-items-center rounded-lg border text-xs font-semibold transition-colors', currentLessonPage === page ? 'border-[var(--navy)] bg-[var(--navy)] text-white' : 'border-[var(--line)] bg-white text-[var(--navy)] hover:bg-[#f0ecff]')}>{page}</button>;
                            })}
                            <Button type="button" size="sm" variant="outline" disabled={currentLessonPage === lessonPageCount} onClick={() => setLessonPage((page) => Math.min(lessonPageCount, page + 1))} className="h-9 rounded-lg border-[var(--line)] bg-white px-3 text-xs">Next</Button>
                          </div>
                        </nav>
                      )}
                    </div>
                  ) : (
                    <div className="mt-6 grid min-h-64 place-items-center rounded-2xl border border-dashed border-[#d9d0f5] bg-white px-8 text-center"><div className="max-w-md"><MessageSquareText className="mx-auto size-8 text-[#6842d8]" /><h3 className="mt-4 font-display text-xl font-semibold text-[var(--navy)]">Your lesson insights will appear here</h3><p className="mt-2 text-sm leading-6 text-[var(--muted-ink)]">Complete a practice session to create your first lesson-level interview analysis.</p><Button onClick={() => startPractice(activeGoal)} className="mt-5 rounded-xl bg-[var(--navy)]">Practise this goal <ArrowRight className="ml-1 size-4" /></Button></div></div>
                  )}
                </section>
              </>
            )}

            <section className="border-t border-[#e6def7] py-7" aria-labelledby="recommended-exercises-title">
              <div className="flex items-center justify-between gap-6">
                <h2 id="recommended-exercises-title" className="font-display text-xl font-semibold tracking-[-0.02em] text-[var(--navy)]">Recommended exercises</h2>
                <Link href="/exercises" className="shrink-0 text-xs font-semibold text-[#6842d8] hover:underline">See all exercises</Link>
              </div>
              {exercisesLoading ? (
                <p className="mt-4 text-sm text-[var(--muted-ink)]">Loading recommendations…</p>
              ) : recommendedExercises.length ? (
                <ol className="mt-4 grid divide-y divide-[#e6def7] md:grid-cols-3 md:divide-x md:divide-y-0">
                  {recommendedExercises.map((exercise) => (
                    <li key={exercise.id} className="flex min-w-0 flex-col py-4 first:pt-0 md:px-5 md:py-0 md:first:pl-0 md:last:pr-0">
                      <h3 className="font-display text-base font-semibold leading-6 text-[var(--navy)]">{exercise.title}</h3>
                      <p className="mt-1 line-clamp-2 text-xs leading-5 text-[var(--muted-ink)]">{exercise.targetBehavior}</p>
                      <div className="mt-auto flex items-center justify-between gap-4 pt-3 text-xs">
                        <span className="text-[var(--muted-ink)]">{exercise.estimatedMinutes} min</span>
                        <button type="button" onClick={() => void startSavedExercise(exercise)} disabled={Boolean(startingExerciseId)} className="font-semibold text-[#6842d8] hover:underline disabled:opacity-50">{startingExerciseId === exercise.id ? 'Opening…' : 'Start →'}</button>
                      </div>
                    </li>
                  ))}
                </ol>
              ) : (
                <p className="mt-4 text-sm text-[var(--muted-ink)]">Complete a lesson and your next recommended exercise will appear here.</p>
              )}
            </section>
          </>
        )}
      </Screen>

    </AppShell>
  );
}

'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  ArrowRight,
  CalendarDays,
  Check,
  CheckCircle2,
  Clock3,
  MessageSquareText,
  Pencil,
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
import type { DashboardFeedbackItem, Goal, GoalDashboard } from '@/lib/types';
import { getPracticeQuestions } from '@/lib/goal-catalog';
import { usePractice } from '@/components/practice-context';
import { getGoalDashboard, listGoals, setActiveGoal, updateGoal } from '@/lib/client-data';
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
  const strength = items.find((item) => item.positive);
  const improvement = items.find((item) => !item.positive);
  return {
    strength: strength ? strength.explanation || strength.title : null,
    focus: improvement ? improvement.explanation || improvement.title : null,
    fallback: strength || improvement ? null : fallback,
  };
}

function SpeakingChart({ activity }: { activity: GoalDashboard['speakingActivity'] }) {
  const [mode, setMode] = useState<ChartMode>('day');
  const data = useMemo(() => buildSpeakingChartData(activity, mode), [activity, mode]);
  const maxSeconds = Math.max(...data.map((bucket) => bucket.seconds), 60);
  const maxFillers = Math.max(...data.map((bucket) => bucket.fillerCount), 1);
  const periodSeconds = data.reduce((sum, bucket) => sum + bucket.seconds, 0);
  const periodFillers = data.reduce((sum, bucket) => sum + bucket.fillerCount, 0);

  return (
    <div>
      <div className="flex items-start justify-between gap-5">
        <div>
          <h3 className="font-display text-lg font-semibold text-[var(--navy)]">Speaking time</h3>
          <p className="mt-1 text-xs text-[var(--muted-ink)]">Completed recorded speech for this goal</p>
        </div>
        <div className="flex rounded-lg bg-[var(--warm)] p-1" aria-label="Speaking time grouping">
          {(['day', 'week'] as const).map((value) => (
            <button key={value} type="button" onClick={() => setMode(value)} className={cn('rounded-md px-3 py-1.5 text-xs font-semibold capitalize', mode === value ? 'bg-white text-[var(--ink)] shadow-sm' : 'text-[var(--muted-ink)]')}>{value}</button>
          ))}
        </div>
      </div>
      <div className="mt-5 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-[var(--muted-ink)]" aria-label="Chart legend">
        <span className="inline-flex items-center gap-2"><span className="size-2.5 rounded-sm bg-[#8dbcae]" aria-hidden="true" />Speaking time</span>
        <span className="inline-flex items-center gap-2"><span className="size-2.5 rounded-sm bg-[#d6a44f]" aria-hidden="true" />Filler words</span>
      </div>
      <div className="mt-5 grid h-52 grid-cols-[34px_1fr_26px] gap-3">
        <div className="flex flex-col justify-between pb-7 text-right text-[10px] text-[var(--muted-ink)]"><span>{compactMinutesLabel(maxSeconds)}</span><span>{compactMinutesLabel(maxSeconds / 2)}</span><span>0m</span></div>
        <div className={cn('relative grid items-end gap-2 border-b border-[var(--line)] bg-[linear-gradient(to_bottom,transparent_49%,var(--line)_50%,transparent_51%)]', mode === 'day' ? 'grid-cols-7' : 'grid-cols-8')}>
          {data.map((bucket) => (
            <div key={bucket.key} className="group flex h-full min-w-0 flex-col items-center justify-end" title={`${bucket.detail}: ${(bucket.seconds / 60).toFixed(1)} minutes, ${bucket.fillerCount} filler ${bucket.fillerCount === 1 ? 'word' : 'words'}`}>
              <span className="mb-1 whitespace-nowrap text-[9px] font-semibold text-[var(--teal-dark)] opacity-0 group-hover:opacity-100 group-focus-within:opacity-100">{bucket.seconds || bucket.fillerCount ? `${(bucket.seconds / 60).toFixed(1)}m · ${bucket.fillerCount}` : ''}</span>
              <span className="sr-only">{bucket.detail}: {(bucket.seconds / 60).toFixed(1)} minutes and {bucket.fillerCount} filler words</span>
              <div className="flex h-[132px] w-full items-end justify-center gap-1">
                <div className="w-[38%] max-w-5 rounded-t-md bg-[#8dbcae] transition-[height]" style={{ height: bucket.seconds ? `${Math.max(8, (bucket.seconds / maxSeconds) * 132)}px` : '2px' }} />
                <div className="w-[38%] max-w-5 rounded-t-md bg-[#d6a44f] transition-[height]" style={{ height: bucket.fillerCount ? `${Math.max(8, (bucket.fillerCount / maxFillers) * 132)}px` : '2px' }} />
              </div>
              <span className="mt-2 max-w-full truncate text-[10px] text-[var(--muted-ink)]">{bucket.label}</span>
            </div>
          ))}
        </div>
        <div className="flex flex-col justify-between pb-7 text-[10px] text-[#8a621c]"><span>{maxFillers}</span><span>{Number((maxFillers / 2).toFixed(1))}</span><span>0</span></div>
      </div>
      <p className="mt-4 text-xs text-[var(--muted-ink)]">This period · {minutesLabel(periodSeconds)} recorded · {periodFillers} filler {periodFillers === 1 ? 'word' : 'words'}</p>
    </div>
  );
}

function ProgressRecap({ dashboard }: { dashboard: GoalDashboard }) {
  const newestLessons = [...dashboard.lessons].reverse();
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
      <div className="mt-5">
        <div>
            <SpeakingChart activity={dashboard.speakingActivity} />
        </div>
        <div className="mt-8 border-t border-[var(--line)] pt-8">
          <h3 className="font-display text-lg font-semibold text-[var(--navy)]">Coaching summary</h3>
          <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
            {summaries.map((summary) => (
              <section key={summary.label} className="rounded-xl border border-[var(--line)] bg-[var(--canvas)] p-4 md:p-5" aria-labelledby={`summary-${summary.label.replace(/[^a-z]+/gi, '-').toLowerCase()}`}>
                <h4 id={`summary-${summary.label.replace(/[^a-z]+/gi, '-').toLowerCase()}`} className="text-xs font-semibold text-[var(--teal-dark)]">{summary.label}</h4>
                <div className="mt-3 space-y-2 text-sm leading-6 text-[var(--ink)]">
                  {summary.text.strength && <p className="rounded-md bg-[var(--mint-soft)] px-2.5 py-1.5"><span className="font-semibold text-[var(--teal-dark)]">Strength:</span> {summary.text.strength}</p>}
                  {summary.text.focus && <p className="rounded-md bg-[var(--amber-soft)] px-2.5 py-1.5"><span className="font-semibold text-[#8a621c]">Focus:</span> {summary.text.focus}</p>}
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
  const { updateSetup, resetSession } = usePractice();
  const [goals, setGoals] = useState<Goal[]>([]);
  const [dashboard, setDashboard] = useState<GoalDashboard | null>(null);
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
  const [lessonPage, setLessonPage] = useState(1);

  useEffect(() => {
    void listGoals()
      .then(setGoals)
      .catch((caught) => setError(caught instanceof Error ? caught.message : 'Goals could not be loaded.'))
      .finally(() => setLoading(false));
  }, []);

  const availableGoals = goals.filter((goal) => goal.status === 'active');
  const activeGoal = availableGoals.find((goal) => goal.isActive) ?? availableGoals[0] ?? null;
  const activeGoalId = activeGoal?.id ?? null;
  const otherGoals = availableGoals.filter((goal) => goal.id !== activeGoal?.id);
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

  function openEdit(goal: Goal) {
    setEditing(goal);
    setDraftTitle(goal.title);
    setDraftDescription(goal.description);
    setGoalDialogOpen(true);
  }

  async function saveGoal() {
    if (!editing || draftTitle.trim().length < 3) return;
    setSaving(true);
    setError('');
    try {
      await updateGoal(editing.id, { title: draftTitle.trim(), description: draftDescription.trim() });
      setGoals((current) => current.map((goal) => goal.id === editing.id ? { ...goal, title: draftTitle.trim(), description: draftDescription.trim() } : goal));
      setNotice('Custom goal updated');
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
        <PageHeader eyebrow="Goals" title="Your communication practice" />
        {notice && <div className="mb-5 flex items-center justify-between rounded-xl border border-[var(--mint)] bg-[var(--mint-soft)] px-4 py-3 text-sm text-[var(--teal-dark)]"><span className="flex items-center gap-2"><CheckCircle2 className="size-4" />{notice}</span><button onClick={() => setNotice('')} className="text-xs font-semibold hover:underline">Dismiss</button></div>}
        {error && <div role="alert" className="mb-5 flex items-center justify-between rounded-xl border border-[#e8c6bf] bg-[var(--rose-soft)] px-4 py-3 text-sm text-[#8f4336]"><span>{error}</span><button onClick={() => setError('')} className="text-xs font-semibold hover:underline">Dismiss</button></div>}

        {loading ? (
          <div className="grid min-h-80 place-items-center rounded-3xl border border-dashed border-[#bcc8c4] bg-white text-sm text-[var(--muted-ink)]">Loading your dashboard…</div>
        ) : !activeGoal ? (
          <div className="grid min-h-80 place-items-center rounded-3xl border border-dashed border-[#bcc8c4] bg-white text-center"><div><Target className="mx-auto size-8 text-[var(--teal)]" /><h2 className="mt-4 text-base font-semibold text-[var(--navy)]">No active goal</h2><p className="mt-1 text-sm text-[var(--muted-ink)]">No practice goals are currently available.</p></div></div>
        ) : (
          <>
            <section className="overflow-hidden rounded-3xl border border-[var(--line)] bg-white shadow-[var(--shadow-sm)]" aria-labelledby="active-goal-title">
              <div className="flex items-center justify-between border-b border-[#d9ebe5] bg-[#eef7f4] px-8 py-4">
                <div className="flex items-center gap-2"><span className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.11em] text-[var(--teal-dark)]"><span className="size-1.5 rounded-full bg-[var(--teal)]" />Active goal</span><span className="text-xs text-[var(--muted-ink)]">{formatLastPractised(dashboard?.lastPractised ?? activeGoal.lastPractised)}</span></div>
                <button onClick={() => setChangeDialogOpen(true)} className="text-xs font-semibold text-[var(--teal-dark)] hover:underline">Change goal</button>
              </div>
              <div className="flex flex-col items-stretch justify-between gap-8 p-6 md:p-8 xl:flex-row xl:gap-10">
                <div className="max-w-3xl">
                  <h2 id="active-goal-title" className="font-display text-[34px] font-semibold tracking-[-0.04em] text-[var(--navy)]">{activeGoal.title}</h2>
                  <p className="mt-3 text-[15px] leading-7 text-[var(--muted-ink)]">{activeGoal.description}</p>
                  <div className="mt-7 flex items-center gap-3"><Button onClick={() => startPractice(activeGoal)} className="h-11 rounded-xl bg-[var(--navy)] px-5 hover:bg-[#1d4255]">Practise this goal <ArrowRight className="ml-1 size-4" /></Button>{activeGoal.isCustom && <button onClick={() => openEdit(activeGoal)} className="ml-1 inline-flex items-center gap-1.5 text-xs font-semibold text-[var(--muted-ink)] hover:text-[var(--ink)]"><Pencil className="size-3.5" />Edit goal</button>}</div>
                </div>
                <div className="grid grid-cols-2 gap-3 xl:min-w-[300px]"><div className="rounded-2xl border border-[var(--line)] bg-white p-5"><CalendarDays className="size-4 text-[var(--teal)]" /><p className="mt-5 font-display text-3xl font-semibold text-[var(--navy)]">{dashboard?.sessionCount ?? activeGoal.sessions}</p><p className="mt-1 text-xs text-[var(--muted-ink)]">completed lessons</p></div><div className="rounded-2xl border border-[var(--line)] bg-white p-5"><Clock3 className="size-4 text-[var(--teal)]" /><p className="mt-5 font-display text-3xl font-semibold text-[var(--navy)]">{dashboard ? minutesLabel(dashboard.totalSpeakingSeconds) : '—'}</p><p className="mt-1 text-xs text-[var(--muted-ink)]">recorded speech</p></div></div>
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
                      <p className="text-xs font-semibold uppercase tracking-[0.11em] text-[var(--teal-dark)]">Lesson insights</p>
                      <h2 id="lessons-title" className="mt-1 font-display text-2xl font-semibold tracking-[-0.025em] text-[var(--navy)]">{dashboard.lessons.length} {dashboard.lessons.length === 1 ? 'lesson' : 'lessons'} practised</h2>
                      <p className="mt-1 text-sm text-[var(--muted-ink)]">Open a lesson to review feedback tied only to the answers from that session.</p>
                    </div>
                    <Button onClick={() => startPractice(activeGoal)} variant="outline" className="h-10 rounded-xl border-[var(--line)] bg-white">Start another lesson <ArrowRight className="ml-1 size-4" /></Button>
                  </div>

                  {dashboard.lessons.length ? (
                    <div className="mt-6">
                      <p className="flex items-center gap-2 text-xs font-semibold text-[var(--muted-ink)]"><Clock3 className="size-3.5 text-[var(--teal)]" />Newest to oldest</p>
                      <ol className="relative mt-3 space-y-3 before:absolute before:bottom-5 before:left-[17px] before:top-5 before:w-px before:bg-[var(--line)]">
                        {visibleLessons.map((lesson, index) => {
                          const lessonNumber = dashboard.lessons.length - (lessonPageStart + index);
                          const date = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).format(new Date(lesson.completedAt));
                          return (
                            <li key={lesson.id} className="relative pl-12">
                              <span className="absolute left-0 top-1/2 z-10 grid size-9 -translate-y-1/2 place-items-center rounded-full border border-[#b9d9d0] bg-[var(--mint-soft)] text-xs font-semibold text-[var(--teal-dark)]" aria-hidden="true">{lessonNumber}</span>
                              <article className="grid items-center gap-3 rounded-xl border border-[var(--line)] bg-white px-4 py-3.5 shadow-[var(--shadow-sm)] md:grid-cols-[110px_minmax(0,1fr)_auto] md:gap-5 md:px-5">
                                <div>
                                  <p className="text-[10px] font-semibold uppercase tracking-[0.09em] text-[var(--teal-dark)]">Lesson {lessonNumber}</p>
                                  <p className="mt-1 text-xs text-[var(--muted-ink)]">{date}</p>
                                </div>
                                <div className="min-w-0">
                                  <h3 className="font-display text-base font-semibold leading-6 text-[var(--navy)]">{lesson.title}</h3>
                                  <p className="mt-1 text-xs text-[var(--muted-ink)]">{lesson.answerCount} {lesson.answerCount === 1 ? 'answer' : 'answers'} · {minutesLabel(lesson.speakingSeconds)}</p>
                                </div>
                                <Button nativeButton={false} render={<Link href={`/goals/${dashboard.goalId}/lessons/${lesson.id}`} />} variant="outline" className="h-9 justify-self-start rounded-lg border-[var(--line)] bg-white px-3 text-xs text-[var(--navy)] hover:bg-[var(--mint-soft)] md:justify-self-end">View insights <ArrowRight className="ml-1 size-3.5" /></Button>
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
                              return <button key={page} type="button" onClick={() => setLessonPage(page)} aria-current={currentLessonPage === page ? 'page' : undefined} aria-label={`Lesson page ${page}`} className={cn('grid size-9 place-items-center rounded-lg border text-xs font-semibold transition-colors', currentLessonPage === page ? 'border-[var(--navy)] bg-[var(--navy)] text-white' : 'border-[var(--line)] bg-white text-[var(--navy)] hover:bg-[var(--mint-soft)]')}>{page}</button>;
                            })}
                            <Button type="button" size="sm" variant="outline" disabled={currentLessonPage === lessonPageCount} onClick={() => setLessonPage((page) => Math.min(lessonPageCount, page + 1))} className="h-9 rounded-lg border-[var(--line)] bg-white px-3 text-xs">Next</Button>
                          </div>
                        </nav>
                      )}
                    </div>
                  ) : (
                    <div className="mt-6 grid min-h-64 place-items-center rounded-2xl border border-dashed border-[#b8c9c4] bg-white px-8 text-center"><div className="max-w-md"><MessageSquareText className="mx-auto size-8 text-[var(--teal)]" /><h3 className="mt-4 font-display text-xl font-semibold text-[var(--navy)]">Your lesson insights will appear here</h3><p className="mt-2 text-sm leading-6 text-[var(--muted-ink)]">Complete a practice session to create your first lesson-level interview analysis.</p><Button onClick={() => startPractice(activeGoal)} className="mt-5 rounded-xl bg-[var(--navy)]">Practise this goal <ArrowRight className="ml-1 size-4" /></Button></div></div>
                  )}
                </section>
              </>
            )}

            {otherGoals.length > 0 && (
              <section className="mt-8 border-t border-[var(--line)] pt-8">
                <div className="flex items-end justify-between gap-6"><div><p className="text-xs font-semibold uppercase tracking-[0.11em] text-[var(--teal-dark)]">Other goals</p><h2 className="mt-1 font-display text-xl font-semibold text-[var(--navy)]">Choose a different direction when you are ready</h2></div><p className="max-w-sm text-right text-xs leading-5 text-[var(--muted-ink)]">Changing your active goal is always explicit. Each goal keeps its own history and metrics.</p></div>
                <div className="mt-5 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">{otherGoals.map((goal) => <article key={goal.id} className="rounded-2xl border border-[var(--line)] bg-white p-5 shadow-[var(--shadow-sm)]"><div className="flex items-start justify-between gap-3"><div><h3 className="font-display text-lg font-semibold text-[var(--navy)]">{goal.title}</h3><p className="mt-1 line-clamp-2 text-xs leading-5 text-[var(--muted-ink)]">{goal.description}</p></div>{goal.sessions === 0 && <Sparkles className="size-4 shrink-0 text-[#b78832]" />}</div><div className="mt-5 flex items-center justify-between border-t border-[var(--line)] pt-4"><span className="text-xs text-[var(--muted-ink)]">{goal.sessions ? `${goal.sessions} ${goal.sessions === 1 ? 'lesson' : 'lessons'}` : 'Not practised yet'}</span><button onClick={() => void activate(goal)} disabled={Boolean(activatingId)} className="text-xs font-semibold text-[var(--teal-dark)] hover:underline disabled:opacity-50">{activatingId === goal.id ? 'Changing…' : 'Set as active goal →'}</button></div></article>)}</div>
              </section>
            )}
          </>
        )}
      </Screen>

      <Dialog open={changeDialogOpen} onOpenChange={setChangeDialogOpen}><DialogContent className="max-w-xl rounded-2xl p-6"><DialogHeader><DialogTitle className="font-display text-xl text-[var(--navy)]">Change your active goal</DialogTitle><DialogDescription>Your dashboard will switch to that goal’s own practice history. Sayform will not change it automatically.</DialogDescription></DialogHeader><div className="space-y-2">{availableGoals.map((goal) => <button key={goal.id} onClick={() => void activate(goal)} disabled={goal.isActive || Boolean(activatingId)} className={cn('flex w-full items-center justify-between rounded-xl border px-4 py-3 text-left', goal.isActive ? 'border-[var(--mint)] bg-[var(--mint-soft)]' : 'border-[var(--line)] bg-white hover:border-[#a9c8bf]')}><span><span className="block text-sm font-semibold text-[var(--navy)]">{goal.title}</span><span className="mt-0.5 block text-xs text-[var(--muted-ink)]">{goal.sessions ? `${goal.sessions} completed ${goal.sessions === 1 ? 'lesson' : 'lessons'}` : 'No practice yet'}</span></span>{goal.isActive ? <span className="inline-flex items-center gap-1 text-xs font-semibold text-[var(--teal-dark)]"><Check className="size-3.5" />Active</span> : <span className="text-xs font-semibold text-[var(--teal-dark)]">{activatingId === goal.id ? 'Changing…' : 'Set active'}</span>}</button>)}</div><DialogFooter><Button variant="outline" onClick={() => setChangeDialogOpen(false)}>Cancel</Button></DialogFooter></DialogContent></Dialog>

      <Dialog open={goalDialogOpen} onOpenChange={setGoalDialogOpen}><DialogContent className="max-w-lg rounded-2xl p-6"><DialogHeader><DialogTitle className="font-display text-xl text-[var(--navy)]">Edit custom goal</DialogTitle><DialogDescription>Update the communication outcome for this existing goal.</DialogDescription></DialogHeader><div className="space-y-4"><div><label htmlFor="goal-title" className="text-sm font-semibold text-[var(--navy)]">Goal</label><Input id="goal-title" value={draftTitle} onChange={(event) => setDraftTitle(event.target.value)} className="mt-2 h-11" /></div><div><label htmlFor="goal-description" className="text-sm font-semibold text-[var(--navy)]">What would improvement look like?</label><Textarea id="goal-description" value={draftDescription} onChange={(event) => setDraftDescription(event.target.value)} placeholder="Describe the audience, situation, or result you want." className="mt-2 min-h-24 resize-none" /></div></div><DialogFooter className="-mx-6 -mb-6 mt-2 px-6 py-4"><Button variant="outline" onClick={() => setGoalDialogOpen(false)}>Cancel</Button><Button disabled={draftTitle.trim().length < 3 || saving} onClick={() => void saveGoal()}>{saving ? 'Saving…' : 'Save goal'}</Button></DialogFooter></DialogContent></Dialog>
    </AppShell>
  );
}

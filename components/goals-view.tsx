'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  ArrowRight,
  Clock3,
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

function speakingSpeedFeedback(wordsPerMinute: number) {
  if (wordsPerMinute <= 0) {
    return {
      label: 'No pace data yet',
      title: 'Your speaking pace will appear here',
      detail: 'Complete a recorded answer and we’ll compare your average with the comfortable 100–165 WPM reference range.',
    };
  }
  if (wordsPerMinute < 100) {
    return {
      label: 'Build momentum',
      title: 'Give your answer a little more momentum',
      detail: 'You’re below the comfortable range. Shorten longer pauses and move into your next sentence once the idea is clear.',
    };
  }
  if (wordsPerMinute <= 165) {
    return {
      label: 'Comfortable range',
      title: 'Your pace is clear and conversational',
      detail: 'Keep this rhythm, and slow down briefly when you want an important point to stand out.',
    };
  }
  return {
    label: 'Add breathing room',
    title: 'Make a little more room for your key points',
    detail: 'You’re above the comfortable range. Add a short pause between ideas so each point has time to land.',
  };
}

const PACE_MIN = 60;
const PACE_MAX = 220;
const PACE_RANGE_START = 100;
const PACE_RANGE_END = 165;

function paceGaugePoint(wordsPerMinute: number, radius = 76) {
  const clampedPace = Math.min(PACE_MAX, Math.max(PACE_MIN, wordsPerMinute));
  const angle = Math.PI - ((clampedPace - PACE_MIN) / (PACE_MAX - PACE_MIN)) * Math.PI;
  return {
    x: 110 + radius * Math.cos(angle),
    y: 96 - radius * Math.sin(angle),
  };
}

function paceGaugeArc(start: number, end: number) {
  const startPoint = paceGaugePoint(start);
  const endPoint = paceGaugePoint(end);
  return `M ${startPoint.x} ${startPoint.y} A 76 76 0 0 1 ${endPoint.x} ${endPoint.y}`;
}

function SpeakingSpeedGauge({ wordsPerMinute }: { wordsPerMinute: number }) {
  const marker = paceGaugePoint(wordsPerMinute);
  const hasPace = wordsPerMinute > 0;

  return (
    <figure className="rounded-2xl border border-[#e4e2dd] bg-white px-4 pb-3 pt-4">
      <svg
        viewBox="0 0 220 108"
        className="mx-auto block h-auto w-full max-w-[240px]"
        aria-labelledby="speaking-speed-gauge-title"
      >
        <title id="speaking-speed-gauge-title">
          {hasPace
            ? `Speaking speed gauge. Your average is ${wordsPerMinute} words per minute. The comfortable reference range is 100 to 165 words per minute.`
            : 'Speaking speed gauge. Complete a recorded answer to see your average. The comfortable reference range is 100 to 165 words per minute.'}
        </title>
        <path d={paceGaugeArc(PACE_MIN, 96)} fill="none" stroke="#e8e6e1" strokeLinecap="round" strokeWidth="17" />
        <path d={paceGaugeArc(PACE_RANGE_START, PACE_RANGE_END)} fill="none" stroke="#8b5cf6" strokeLinecap="round" strokeWidth="17" />
        <path d={paceGaugeArc(169, PACE_MAX)} fill="none" stroke="#e8e6e1" strokeLinecap="round" strokeWidth="17" />
        {hasPace && <circle cx={marker.x} cy={marker.y} r="6" fill="#2b1745" stroke="white" strokeWidth="3" />}
        <text x="110" y="72" textAnchor="middle" fill="#6d5b7f" fontFamily="var(--font-sans-ui)" fontSize="9" fontWeight="700" letterSpacing="0.08em">REFERENCE RANGE</text>
        <text x="110" y="91" textAnchor="middle" fill="#2b1745" fontFamily="var(--font-display-ui)" fontSize="15" fontWeight="600">100–165 WPM</text>
      </svg>
      <figcaption className="-mt-1 grid grid-cols-3 text-[10px] font-semibold text-[var(--muted-ink)]">
        <span>Slower</span>
        <span className="text-center text-[var(--teal-dark)]">Comfortable</span>
        <span className="text-right">Faster</span>
      </figcaption>
    </figure>
  );
}

function compactMinutesLabel(seconds: number) {
  const minutes = seconds / 60;
  return `${minutes >= 10 ? Math.round(minutes) : Number(minutes.toFixed(1))}m`;
}

type ChartMode = 'day' | 'week';
const SESSIONS_PER_PAGE = 5;

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

type CoachingPattern = {
  id: string;
  kind: 'focus' | 'strength';
  title: string;
  detail: string;
  priority: number;
};

function cleanPatternCopy(value: string) {
  const cleaned = value
    .replace(/^\s*(?:yes|partially|no)\s*[—–:-]\s*/i, '')
    .replace(/\bthe candidate\b/gi, 'you')
    .replace(/\bthe speaker\b/gi, 'you')
    .replace(/\s+/g, ' ')
    .trim();
  return cleaned ? `${cleaned[0].toLocaleUpperCase()}${cleaned.slice(1)}` : '';
}

function feedbackPatternTitle(item: DashboardFeedbackItem) {
  const skill = item.skill?.trim().toLocaleLowerCase() ?? '';
  if (skill === 'answer the actual question') return item.positive ? 'You answer the question directly' : 'Answers do not always address the full question';
  if (skill === 'make the reasoning easy to follow') return item.positive ? 'Your reasoning is easy to follow' : 'Reasoning is not always easy to follow';
  if (skill === 'provide a clear conclusion') return item.positive ? 'You close with a clear conclusion' : 'Conclusions are not consistently clear';
  if (item.dimension === 'Vocabulary') return item.positive ? 'Your word choice is precise and credible' : 'Terminology is not always precise or consistent';
  if (item.dimension === 'Sentence structure') return item.positive ? 'Your sentence structure supports clarity' : 'Sentence structure sometimes obscures the main point';
  if (item.dimension === 'Critical thinking') return item.positive ? 'Your reasoning is well supported' : 'Reasoning needs a more explicit step-by-step structure';
  if (item.dimension === 'Communication effectiveness') return item.positive ? 'Your answers communicate the main point clearly' : 'The main answer is not always stated early enough';
  return item.positive ? 'A communication strength is emerging' : 'A communication pattern needs more consistency';
}

function feedbackPatternDetail(item: DashboardFeedbackItem, supportCount: number) {
  const skill = item.skill?.trim().toLocaleLowerCase() ?? '';
  if (skill === 'answer the actual question') return 'Recent coaching asks for a direct opening that covers every part of the prompt before adding supporting detail.';
  if (skill === 'make the reasoning easy to follow') return 'The ideas are relevant, but the path from claim to evidence to conclusion is not always explicit.';
  if (skill === 'provide a clear conclusion') return 'Answers need a firmer final verdict that connects the recommendation back to the evidence.';
  if (item.dimension === 'Vocabulary') return 'Recent coaching flags vague or inconsistent terms. Define key language once and use it consistently throughout the answer.';
  if (item.dimension === 'Sentence structure') return 'Shorter, more deliberate sentences would make the main claim and supporting evidence easier to separate.';
  if (supportCount >= 2) {
    const skillLabel = item.skill?.trim().toLocaleLowerCase() || item.dimension.toLocaleLowerCase();
    return item.positive
      ? `Recent coaching recognizes ${skillLabel} across multiple answers. Keep applying it consistently.`
      : `Recent coaching flags ${skillLabel} across multiple answers. Make it a deliberate checkpoint in your next response.`;
  }
  return cleanPatternCopy(item.explanation || item.title);
}

function buildCoachingPatterns(dashboard: GoalDashboard) {
  const feedbackById = new Map<string, DashboardFeedbackItem>();
  const feedbackSources = dashboard.sessions.flatMap((session) => [
    ...session.communicationFeedback,
    ...session.vocabulary.strengths,
    ...session.vocabulary.improvements,
    ...session.grammar.strengths,
    ...session.grammar.improvements,
    ...session.fluency.feedback,
  ]);
  feedbackSources.forEach((item) => feedbackById.set(item.id, item));

  const groupedFeedback = new Map<string, { latest: DashboardFeedbackItem; answerIds: Set<string> }>();
  const latestFeedbackState = new Map<string, boolean>();
  const feedbackByRecency = [...feedbackById.values()].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  for (const item of feedbackByRecency) {
    const skill = item.skill?.trim().toLocaleLowerCase() || item.dimension.toLocaleLowerCase();
    if (!latestFeedbackState.has(skill)) latestFeedbackState.set(skill, Boolean(item.positive));
  }

  for (const item of feedbackById.values()) {
    const skill = item.skill?.trim().toLocaleLowerCase() || item.dimension.toLocaleLowerCase();
    const key = `${item.positive ? 'strength' : 'focus'}:${skill}`;
    const existing = groupedFeedback.get(key) ?? { latest: item, answerIds: new Set<string>() };
    existing.answerIds.add(item.responseId ?? `session:${item.sessionId}`);
    if (item.createdAt > existing.latest.createdAt) existing.latest = item;
    groupedFeedback.set(key, existing);
  }

  const patterns: CoachingPattern[] = [];
  const answerCount = dashboard.completedAnswerCount;
  const pace = dashboard.fluency.averageWpm;
  if (pace > 0 && pace < PACE_RANGE_START) {
    patterns.push({
      id: 'pace-slow',
      kind: 'focus',
      title: 'Your speaking pace trends slower than conversational',
      detail: `Your average is ${pace} WPM. Build a little more momentum while keeping the structure and wording clear.`,
      priority: 130,
    });
  } else if (pace > PACE_RANGE_END) {
    patterns.push({
      id: 'pace-fast',
      kind: 'focus',
      title: 'Your speaking pace trends faster than conversational',
      detail: `Your average is ${pace} WPM. Add brief pauses between ideas so the evidence and conclusion have time to land.`,
      priority: 130,
    });
  } else if (pace > 0 && answerCount >= 2) {
    patterns.push({
      id: 'pace-clear',
      kind: 'strength',
      title: 'Your speaking pace is clear and conversational',
      detail: `Your ${pace} WPM average stays within the 100–165 WPM clarity reference.`,
      priority: 55,
    });
  }

  const commonFillers = dashboard.fluency.commonFillers.filter((item) => item.count > 0).slice(0, 3);
  const topFiller = commonFillers[0];
  if (topFiller && (topFiller.count >= 2 || dashboard.fluency.fillerRatePer100Words >= 1.5)) {
    const fillerList = commonFillers.map((item) => `“${item.phrase}” (${item.count})`).join(', ');
    patterns.push({
      id: 'fillers',
      kind: 'focus',
      title: `“${topFiller.phrase}” is your most common filler`,
      detail: `${fillerList} ${commonFillers.length === 1 ? 'appears' : 'appear'} most often, for an overall rate of ${dashboard.fluency.fillerRatePer100Words} per 100 words.`,
      priority: 125,
    });
  }

  const repeatedOpening = dashboard.fluency.repeatedOpenings[0];
  if (repeatedOpening) {
    patterns.push({
      id: 'repeated-opening',
      kind: 'focus',
      title: 'Several answers begin in the same way',
      detail: `The opening “${repeatedOpening.phrase}” appears ${repeatedOpening.count} times. Vary the opening and lead with the answer you want the interviewer to remember.`,
      priority: 110,
    });
  }

  const feedbackPatterns = [...groupedFeedback.entries()]
    .map(([id, group]) => ({ id, ...group, supportCount: group.answerIds.size }))
    .filter((group) => {
      const skill = group.latest.skill?.trim().toLocaleLowerCase() || group.latest.dimension.toLocaleLowerCase();
      return latestFeedbackState.get(skill) === Boolean(group.latest.positive);
    })
    .filter((group) => group.supportCount >= 2 || answerCount <= 1)
    .filter((group) => !/pace|filler|hesitat|repeat|opening/i.test(`${group.latest.skill ?? ''} ${group.latest.title}`))
    .map<CoachingPattern>((group) => ({
      id: group.id,
      kind: group.latest.positive ? 'strength' : 'focus',
      title: feedbackPatternTitle(group.latest),
      detail: feedbackPatternDetail(group.latest, group.supportCount),
      priority: (group.latest.positive ? 45 : 80) + group.supportCount,
    }));
  patterns.push(...feedbackPatterns);

  const focusPatterns = patterns.filter((pattern) => pattern.kind === 'focus').sort((a, b) => b.priority - a.priority);
  const strengthPatterns = patterns.filter((pattern) => pattern.kind === 'strength').sort((a, b) => b.priority - a.priority);
  const selected = focusPatterns.slice(0, 4);
  if (selected.length < 4 && strengthPatterns[0]) selected.push(strengthPatterns[0]);
  return selected.slice(0, 4);
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
  const speedFeedback = speakingSpeedFeedback(dashboard.fluency.averageWpm);
  const coachingPatterns = buildCoachingPatterns(dashboard);
  const patternBasis = dashboard.completedAnswerCount === 1
    ? 'Early signals from 1 answer'
    : `Patterns across ${dashboard.completedAnswerCount} answers`;

  return (
    <section className="my-9 space-y-5 rounded-[30px] bg-[var(--canvas)] p-4 md:p-5">
      <section className="overflow-hidden rounded-3xl border border-[#d9d0f5] bg-[#f8f6fc] shadow-[0_10px_30px_rgba(19,45,59,0.07)]" aria-labelledby="progress-at-a-glance-title">
        <header className="px-6 pt-6 md:px-7 md:pt-7">
          <h2 id="progress-at-a-glance-title" className="font-display text-2xl font-semibold tracking-[-0.025em] text-[var(--navy)]">Your progress at a glance</h2>
          <p className="mt-1 text-base leading-7 text-[var(--muted-ink)]">A combined view of your interview delivery and language feedback</p>
        </header>

        <div className="mx-6 mt-6 bg-[#f7f6f3] px-5 py-4 md:mx-7">
          <h3 className="font-display text-lg font-semibold text-[var(--navy)]">Delivery timing</h3>
          <div className="mt-5 grid items-center gap-6 md:grid-cols-[minmax(0,1fr)_minmax(0,0.8fr)_280px] md:gap-8">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                <p className="shrink-0 text-[var(--navy)]"><strong className="font-display text-4xl font-semibold tracking-[-0.04em]">{dashboard.fluency.averageWpm || '—'}</strong>{dashboard.fluency.averageWpm > 0 && <span className="ml-1.5 text-sm font-semibold">WPM</span>}</p>
                <span className={cn(
                  'rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.06em]',
                  dashboard.fluency.averageWpm <= 0
                    ? 'bg-[#e8e6e1] text-[var(--muted-ink)]'
                    : dashboard.fluency.averageWpm >= PACE_RANGE_START && dashboard.fluency.averageWpm <= PACE_RANGE_END
                      ? 'bg-[var(--mint-soft)] text-[var(--teal-dark)]'
                      : 'bg-[var(--amber-soft)] text-[#805c1e]',
                )}>{speedFeedback.label}</span>
              </div>
              <p className="mt-4 text-base font-semibold text-[var(--navy)]">{speedFeedback.title}</p>
              <p className="mt-1 max-w-xl text-base leading-7 text-[var(--muted-ink)]">{speedFeedback.detail}</p>
              {dashboard.fluency.averageWpm > 0 && <p className="mt-3 text-xs text-[var(--muted-ink)]">Average across your recorded practice</p>}
            </div>
            <div className="min-w-0 border-t border-[var(--line)] pt-5 md:border-l md:border-t-0 md:pl-8 md:pt-0">
              <p className="text-xs font-semibold uppercase tracking-[0.09em] text-[var(--teal-dark)]">Time to main point</p>
              <p className="mt-2 text-[var(--navy)]">
                <strong className="font-display text-4xl font-semibold tracking-[-0.04em]">{dashboard.fluency.averageTimeToMainPointSeconds ?? '—'}</strong>
                {dashboard.fluency.averageTimeToMainPointSeconds !== null && <span className="ml-1.5 text-sm font-semibold">sec</span>}
              </p>
              <p className="mt-2 text-base leading-7 text-[var(--muted-ink)]">
                {dashboard.fluency.timeToMainPointAnswerCount > 0
                  ? `Average from your first spoken word to the first direct answer across ${dashboard.fluency.timeToMainPointAnswerCount} ${dashboard.fluency.timeToMainPointAnswerCount === 1 ? 'response' : 'responses'}.`
                  : 'No measured main point yet. This will appear after a direct answer is detected in a new response.'}
              </p>
            </div>
            <SpeakingSpeedGauge wordsPerMinute={dashboard.fluency.averageWpm} />
          </div>
        </div>

        <div className="px-6 pb-7 pt-7 md:px-7">
          <SpeakingChart activity={dashboard.speakingActivity} />
        </div>
      </section>

      <section className="rounded-3xl border border-[#e4e2dd] bg-white px-6 py-6 shadow-[0_10px_30px_rgba(19,45,59,0.07)] md:px-7 md:py-7" aria-labelledby="coaching-summary-title">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <h2 id="coaching-summary-title" className="font-display text-2xl font-semibold tracking-[-0.025em] text-[var(--navy)]">Coaching summary</h2>
            {dashboard.completedAnswerCount > 0 && <span className="text-xs font-medium text-[var(--muted-ink)]">{patternBasis}</span>}
          </div>
          {coachingPatterns.length > 0 ? (
            <ul className="mt-5 border-t border-[var(--line)]">
              {coachingPatterns.map((pattern) => (
                <li key={pattern.id} className="grid gap-3 border-b border-[var(--line)] py-5 last:border-b-0 md:grid-cols-[18px_minmax(0,1fr)] md:gap-4">
                  <span className={cn('mt-2 size-2.5 rounded-full', pattern.kind === 'strength' ? 'bg-[#6842d8]' : 'bg-[#d6a44f]')} aria-hidden="true" />
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-base font-semibold text-[var(--navy)]">{pattern.title}</h3>
                      {pattern.kind === 'strength' && <span className="rounded-full bg-[#f0ecff] px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.07em] text-[#6842d8]">Strength</span>}
                    </div>
                    <p className="mt-1.5 max-w-4xl text-base leading-7 text-[var(--muted-ink)]">{pattern.detail}</p>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-5 border-t border-[var(--line)] pt-5 text-base leading-7 text-[var(--muted-ink)]">
              {dashboard.completedAnswerCount > 0
                ? 'No recurring pattern is strong enough yet. Complete another session and Sayform will keep looking across your feedback.'
                : 'Complete a session to start identifying recurring interview patterns.'}
            </p>
          )}
      </section>
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
  const [sessionPage, setSessionPage] = useState(1);

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
  const sessionPageCount = dashboard ? Math.max(1, Math.ceil(dashboard.sessions.length / SESSIONS_PER_PAGE)) : 1;
  const currentSessionPage = Math.min(sessionPage, sessionPageCount);
  const sessionPageStart = (currentSessionPage - 1) * SESSIONS_PER_PAGE;
  const visibleSessions = dashboard?.sessions.slice(sessionPageStart, sessionPageStart + SESSIONS_PER_PAGE) ?? [];

  useEffect(() => {
    if (!activeGoalId) return;
    let cancelled = false;
    void getGoalDashboard(activeGoalId)
      .then((result) => { if (!cancelled) { setDashboard(result); setSessionPage(1); } })
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
          <div className="grid min-h-80 place-items-center rounded-3xl border border-dashed border-[#d8cced] bg-white text-sm text-[var(--muted-ink)]">Loading your dashboard…</div>
        ) : !activeGoal ? (
          <div className="grid min-h-80 place-items-center rounded-3xl border border-dashed border-[#d8cced] bg-white text-center"><div><Target className="mx-auto size-8 text-[var(--teal)]" /><h2 className="mt-4 text-base font-semibold text-[var(--navy)]">No active goal</h2><p className="mt-1 text-base leading-7 text-[var(--muted-ink)]">No practice goals are currently available.</p></div></div>
        ) : (
          <>
            <section className="overflow-hidden rounded-3xl bg-[#6842d8] px-6 py-7 text-white md:px-8 md:py-8" aria-labelledby="active-goal-title">
              <div className="flex flex-col items-start justify-between gap-7 lg:flex-row lg:items-end">
                <div className="max-w-3xl">
                  <h2 id="active-goal-title" className="font-display text-[34px] font-semibold tracking-[-0.04em] text-white">{activeGoal.title}</h2>
                  {activeGoal.description && <p className="mt-3 text-base leading-7 text-white/80">{activeGoal.description}</p>}
                  <div className="mt-5 flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-white/80">
                    <span><strong className="mr-1 font-display text-xl font-semibold text-white">{dashboard?.sessionCount ?? activeGoal.sessions}</strong> sessions</span>
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
                <section className="border-t border-[var(--line)] py-9" aria-labelledby="sessions-title">
                  <div className="flex flex-col items-start justify-between gap-5 md:flex-row md:items-end md:gap-8">
                    <div>
                      <h2 id="sessions-title" className="font-display text-2xl font-semibold tracking-[-0.025em] text-[var(--navy)]">{dashboard.sessions.length} {dashboard.sessions.length === 1 ? 'session' : 'sessions'} practised</h2>
                    </div>
                    <Button onClick={() => startPractice(activeGoal)} variant="outline" className="h-10 rounded-xl border-[var(--line)] bg-white">Start another session <ArrowRight className="ml-1 size-4" /></Button>
                  </div>

                  {dashboard.sessions.length ? (
                    <div className="mt-6">
                      <p className="flex items-center gap-2 text-xs font-semibold text-[var(--muted-ink)]"><Clock3 className="size-3.5 text-[#6842d8]" />Newest to oldest</p>
                      <ol className="relative mt-3 space-y-3 before:absolute before:bottom-5 before:left-[17px] before:top-5 before:w-px before:bg-[var(--line)]">
                        {visibleSessions.map((session, index) => {
                          const sessionNumber = dashboard.sessions.length - (sessionPageStart + index);
                          const date = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).format(new Date(session.completedAt));
                          return (
                            <li key={session.id} className="relative pl-12">
                              <span className="absolute left-0 top-1/2 z-10 grid size-9 -translate-y-1/2 place-items-center rounded-full border border-[#d9d0f5] bg-[#f0ecff] text-xs font-semibold text-[#6842d8]" aria-hidden="true">{sessionNumber}</span>
                              <article className="grid items-center gap-3 rounded-xl border border-[var(--line)] bg-white px-4 py-3.5 shadow-[var(--shadow-sm)] md:grid-cols-[110px_minmax(0,1fr)_auto] md:gap-5 md:px-5">
                                <div>
                                  <p className="text-[10px] font-semibold uppercase tracking-[0.09em] text-[#6842d8]">Session {sessionNumber}</p>
                                  <p className="mt-1 text-xs text-[var(--muted-ink)]">{date}</p>
                                </div>
                                <div className="min-w-0">
                                  <h3 className="font-display text-base font-semibold leading-6 text-[var(--navy)]">{session.title}</h3>
                                  <p className="mt-1 text-xs text-[var(--muted-ink)]">{session.answerCount} {session.answerCount === 1 ? 'answer' : 'answers'} · {minutesLabel(session.speakingSeconds)} · {session.fluency.averageWpm > 0 ? `${session.fluency.averageWpm} WPM` : 'Speed unavailable'}</p>
                                </div>
                                <Button nativeButton={false} render={<Link href={`/goals/${dashboard.goalId}/sessions/${session.id}`} />} variant="outline" className="h-9 justify-self-start rounded-lg border border-[var(--line)] bg-white px-3 text-xs text-[var(--navy)] hover:bg-[#f0ecff] md:justify-self-end">View insights <ArrowRight className="ml-1 size-3.5" /></Button>
                              </article>
                            </li>
                          );
                        })}
                      </ol>
                      {sessionPageCount > 1 && (
                        <nav className="mt-5 flex flex-col gap-3 border-t border-[var(--line)] pt-5 sm:flex-row sm:items-center sm:justify-between" aria-label="Session pages">
                          <p className="text-xs text-[var(--muted-ink)]">Showing {sessionPageStart + 1}–{Math.min(sessionPageStart + SESSIONS_PER_PAGE, dashboard.sessions.length)} of {dashboard.sessions.length} sessions</p>
                          <div className="flex items-center gap-2">
                            <Button type="button" size="sm" variant="outline" disabled={currentSessionPage === 1} onClick={() => setSessionPage((page) => Math.max(1, page - 1))} className="h-9 rounded-lg border-[var(--line)] bg-white px-3 text-xs">Previous</Button>
                            {Array.from({ length: sessionPageCount }, (_, index) => {
                              const page = index + 1;
                              return <button key={page} type="button" onClick={() => setSessionPage(page)} aria-current={currentSessionPage === page ? 'page' : undefined} aria-label={`Session page ${page}`} className={cn('grid size-9 place-items-center rounded-lg border text-xs font-semibold transition-colors', currentSessionPage === page ? 'border-[var(--navy)] bg-[var(--navy)] text-white' : 'border-[var(--line)] bg-white text-[var(--navy)] hover:bg-[#f0ecff]')}>{page}</button>;
                            })}
                            <Button type="button" size="sm" variant="outline" disabled={currentSessionPage === sessionPageCount} onClick={() => setSessionPage((page) => Math.min(sessionPageCount, page + 1))} className="h-9 rounded-lg border-[var(--line)] bg-white px-3 text-xs">Next</Button>
                          </div>
                        </nav>
                      )}
                    </div>
                  ) : (
                    <div className="mt-6 grid min-h-64 place-items-center rounded-2xl border border-dashed border-[#d9d0f5] bg-white px-8 text-center"><div className="max-w-md"><MessageSquareText className="mx-auto size-8 text-[#6842d8]" /><h3 className="mt-4 font-display text-xl font-semibold text-[var(--navy)]">Your session insights will appear here</h3><p className="mt-2 text-base leading-7 text-[var(--muted-ink)]">Complete a practice session to create your first session-level interview analysis.</p><Button onClick={() => startPractice(activeGoal)} className="mt-5 rounded-xl bg-[var(--navy)]">Practise this goal <ArrowRight className="ml-1 size-4" /></Button></div></div>
                  )}
                </section>
              </>
            )}

            <section className="py-7" aria-labelledby="recommended-exercises-title">
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
                      <p className="mt-1 line-clamp-2 text-sm leading-6 text-[var(--muted-ink)]">{exercise.targetBehavior}</p>
                      <div className="mt-auto flex items-center justify-between gap-4 pt-3 text-xs">
                        <span className="text-[var(--muted-ink)]">{exercise.estimatedMinutes} min</span>
                        <button type="button" onClick={() => void startSavedExercise(exercise)} disabled={Boolean(startingExerciseId)} className="font-semibold text-[#6842d8] hover:underline disabled:opacity-50">{startingExerciseId === exercise.id ? 'Opening…' : 'Start →'}</button>
                      </div>
                    </li>
                  ))}
                </ol>
              ) : (
                <p className="mt-4 text-base leading-7 text-[var(--muted-ink)]">Complete a session and your next recommended exercise will appear here.</p>
              )}
            </section>
          </>
        )}
      </Screen>

    </AppShell>
  );
}

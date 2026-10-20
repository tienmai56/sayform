'use client';

import { categories as categoryOptions, feedbackItems, goals as seedGoals, sessions as seedSessions, transcript } from '@/lib/mock-data';
import { isSupabaseConfigured } from '@/lib/supabase/config';
import type { Goal, PracticeSession, SessionDetail } from '@/lib/types';

const goalStorageKey = 'communication-coach:demo-goals';
const sessionStorageKey = 'communication-coach:demo-sessions';

export const usesPersistentBackend = isSupabaseConfigured();

function readLocal<T>(key: string, fallback: T): T {
  if (typeof window === 'undefined') return fallback;
  try {
    const value = window.localStorage.getItem(key);
    return value ? (JSON.parse(value) as T) : fallback;
  } catch {
    return fallback;
  }
}

function writeLocal<T>(key: string, value: T) {
  window.localStorage.setItem(key, JSON.stringify(value));
}

async function apiRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const headers = new Headers(init?.headers);
  if (init?.body && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json');
  const response = await fetch(path, {
    ...init,
    headers,
  });
  const payload = response.status === 204 ? null : await response.json();
  if (!response.ok) {
    const message = payload?.error?.message ?? 'The request could not be completed.';
    throw new Error(message);
  }
  return payload as T;
}

export async function listGoals(): Promise<Goal[]> {
  if (!usesPersistentBackend) return readLocal(goalStorageKey, seedGoals);
  const result = await apiRequest<{ goals: Goal[] }>('/api/goals');
  return result.goals;
}

export async function createGoal(input: { title: string; description: string }): Promise<Goal> {
  if (!usesPersistentBackend) {
    const current = readLocal(goalStorageKey, seedGoals);
    const duplicate = current.find((goal) => goal.title.toLowerCase() === input.title.toLowerCase());
    if (duplicate) return duplicate;
    const goal: Goal = {
      id: `demo-goal-${crypto.randomUUID()}`,
      title: input.title,
      description: input.description,
      status: 'active',
      lastPractised: null,
      sessions: 0,
    };
    writeLocal(goalStorageKey, [...current, goal]);
    return goal;
  }

  const result = await apiRequest<{ goal: Goal }>('/api/goals', {
    method: 'POST',
    body: JSON.stringify(input),
  });
  return result.goal;
}

export async function updateGoal(goalId: string, input: Partial<Pick<Goal, 'title' | 'description' | 'status'>>) {
  if (!usesPersistentBackend) {
    const current = readLocal(goalStorageKey, seedGoals);
    const next = current.map((goal) => (goal.id === goalId ? { ...goal, ...input } : goal));
    writeLocal(goalStorageKey, next);
    return next.find((goal) => goal.id === goalId);
  }

  const result = await apiRequest<{ goal: Goal }>(`/api/goals/${goalId}`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  });
  return result.goal;
}

export async function createPracticeSession(input: {
  goalId: string;
  goalTitle: string;
  categories: string[];
  prompt: string;
}) {
  if (!usesPersistentBackend) return { id: `demo-session-${crypto.randomUUID()}` };

  const result = await apiRequest<{ session: { id: string } }>('/api/sessions', {
    method: 'POST',
    body: JSON.stringify({
      goalId: input.goalId,
      goalTitle: input.goalTitle,
      categories: input.categories,
      title: input.prompt.slice(0, 120),
    }),
  });
  return result.session;
}

export async function saveAndAnalyzeResponse(input: {
  sessionId: string;
  prompt: string;
  durationSeconds: number;
  sequenceNumber: number;
}) {
  if (!usesPersistentBackend) {
    return { responseId: `demo-response-${crypto.randomUUID()}`, feedbackIds: {} as Record<string, string> };
  }

  const created = await apiRequest<{ response: { id: string } }>(`/api/sessions/${input.sessionId}/responses`, {
    method: 'POST',
    body: JSON.stringify({
      prompt: input.prompt,
      durationSeconds: input.durationSeconds,
      sequenceNumber: input.sequenceNumber,
    }),
  });
  const idempotencyKey = `${input.sessionId}:${input.sequenceNumber}:mock-v1`;
  await apiRequest(`/api/responses/${created.response.id}/analyze`, {
    method: 'POST',
    body: JSON.stringify({ idempotencyKey }),
  });
  const analyzed = await apiRequest<{
    response: { feedback_items: { id: string; title: string }[] };
  }>(`/api/responses/${created.response.id}`);
  const feedbackIds = Object.fromEntries(
    feedbackItems.flatMap((item) => {
      const saved = analyzed.response.feedback_items.find((candidate) => candidate.title === item.title);
      return saved ? [[item.id, saved.id]] : [];
    }),
  );
  return { responseId: created.response.id, feedbackIds };
}

export async function rateFeedback(
  feedbackId: string | undefined,
  input: { rating: 'helpful' | 'unhelpful'; note?: string; dismissed?: boolean },
) {
  if (!usesPersistentBackend || !feedbackId) return;
  await apiRequest(`/api/feedback/${feedbackId}/rating`, {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export async function finishPracticeSession(input: {
  sessionId: string;
  goal: string;
  categories: string[];
  prompt: string;
  answerCount: number;
  startedAt: number;
}) {
  if (usesPersistentBackend) {
    return apiRequest<{ exerciseId: string }>(`/api/sessions/${input.sessionId}/finish`, {
      method: 'POST',
      body: JSON.stringify({ title: input.prompt.slice(0, 120) }),
    });
  }

  const current = readLocal(sessionStorageKey, seedSessions);
  if (current.some((session) => session.id === input.sessionId)) return { exerciseId: undefined };
  const categoryTitles = input.categories.map(
    (category) => categoryOptions.find((option) => option.id === category)?.title ?? category,
  );
  const durationMinutes = Math.max(1, Math.round((Date.now() - input.startedAt) / 60000));
  const session: PracticeSession = {
    id: input.sessionId,
    date: new Intl.DateTimeFormat('en-US', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date()),
    goal: input.goal,
    categories: categoryTitles,
    duration: `${durationMinutes} min`,
    answers: input.answerCount,
    averageWpm: 132,
    fillerCount: 3,
    title: input.prompt.slice(0, 80),
    takeaway: 'Lead with the decision, then name one consequence and one boundary.',
    hasExercise: false,
  };
  writeLocal(sessionStorageKey, [session, ...current]);
  return { exerciseId: undefined };
}

export async function completeExercise(exerciseId: string | null) {
  if (!usesPersistentBackend || !exerciseId) return;
  await apiRequest(`/api/exercises/${exerciseId}/response`, {
    method: 'POST',
    body: JSON.stringify({
      answerText: 'Moving too quickly can increase support incidents and erode customer trust later.',
    }),
  });
}

export async function listHistory(): Promise<PracticeSession[]> {
  if (!usesPersistentBackend) return readLocal(sessionStorageKey, seedSessions);
  const result = await apiRequest<{ sessions: PracticeSession[] }>('/api/history');
  return result.sessions.map((session) => ({
    ...session,
    categories: session.categories.map(
      (category) => categoryOptions.find((option) => option.id === category)?.title ?? category,
    ),
  }));
}

export async function deleteSession(sessionId: string) {
  if (!usesPersistentBackend) {
    const current = readLocal(sessionStorageKey, seedSessions);
    writeLocal(sessionStorageKey, current.filter((session) => session.id !== sessionId));
    return;
  }
  await apiRequest(`/api/sessions/${sessionId}`, { method: 'DELETE' });
}

export async function getSessionDetail(sessionId: string): Promise<SessionDetail | null> {
  if (!usesPersistentBackend) {
    const session = readLocal(sessionStorageKey, seedSessions).find((item) => item.id === sessionId);
    if (!session) return null;
    return {
      ...session,
      prompt: 'Your team can invest in speed or reliability this quarter, but not both. Which would you choose?',
      transcript: `${transcript.before}${transcript.vague}${transcript.middle}${transcript.repeated}${transcript.after}`,
      feedbackTitle: feedbackItems[0].title,
      feedbackExplanation: feedbackItems[0].explanation,
      summary: 'Your recommendation arrived early and made the reasoning easy to follow.',
      exerciseTitle: session.hasExercise ? 'Make the consequence concrete' : undefined,
    };
  }

  const result = await apiRequest<{
    session: {
      id: string;
      goal_title: string;
      title: string;
      categories: string[];
      duration_seconds: number;
      average_wpm: number;
      filler_count: number;
      takeaway: string;
      created_at: string;
      completed_at: string | null;
      responses: Array<{
        prompt: string;
        transcript: string;
        feedback_items: Array<{ title: string; explanation: string }>;
      }>;
      session_summaries: Array<{ summary: string }> | { summary: string } | null;
      exercises:
        | Array<{ title: string; completed_at: string | null }>
        | { title: string; completed_at: string | null }
        | null;
    };
  }>(`/api/sessions/${sessionId}`);
  const session = result.session;
  const firstResponse = session.responses[0];
  const firstFeedback = firstResponse?.feedback_items[0];
  const summaries = Array.isArray(session.session_summaries)
    ? session.session_summaries
    : session.session_summaries
      ? [session.session_summaries]
      : [];
  const exercises = Array.isArray(session.exercises)
    ? session.exercises
    : session.exercises
      ? [session.exercises]
      : [];
  return {
    id: session.id,
    date: new Intl.DateTimeFormat('en-US', { dateStyle: 'medium', timeStyle: 'short' }).format(
      new Date(session.completed_at ?? session.created_at),
    ),
    goal: session.goal_title,
    categories: session.categories.map(
      (category) => categoryOptions.find((option) => option.id === category)?.title ?? category,
    ),
    duration: `${Math.max(1, Math.round(session.duration_seconds / 60))} min`,
    answers: session.responses.length,
    averageWpm: session.average_wpm,
    fillerCount: session.filler_count,
    title: session.title,
    takeaway: session.takeaway,
    hasExercise: exercises.some((exercise) => Boolean(exercise.completed_at)),
    prompt: firstResponse?.prompt ?? '',
    transcript: firstResponse?.transcript ?? '',
    feedbackTitle: firstFeedback?.title ?? 'Saved coaching',
    feedbackExplanation: firstFeedback?.explanation ?? '',
    summary: summaries[0]?.summary ?? session.takeaway,
    exerciseTitle: exercises[0]?.title,
  };
}

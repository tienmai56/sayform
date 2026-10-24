'use client';

import { categories as categoryOptions, feedbackItems, sessions as seedSessions, transcript } from '@/lib/mock-data';
import { createMockAnalysis } from '@/lib/analysis/mock-provider';
import { fallbackExercisePrompt, getExerciseTemplate } from '@/lib/exercise-library';
import { createDemoGoals, getGoalDefinition } from '@/lib/goal-catalog';
import { isSupabaseConfigured } from '@/lib/supabase/config';
import type { ExerciseAttemptResult, ExerciseAttemptType, ExerciseCompletionSummary, ExerciseStatus, FeedbackDimension, FeedbackItem, FeedbackProgressStatus, FinishedSession, Goal, GoalDashboard, GoalExercise, PracticeSession, ResponseAnalysis, SessionDetail, SummaryPattern } from '@/lib/types';

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

function textValue(value: unknown) {
  return typeof value === 'string' ? value : '';
}

function normalizeFeedbackItem<T extends FeedbackItem & { progress_status?: FeedbackProgressStatus }>(item: T): FeedbackItem {
  const { progress_status: progressStatus, ...feedback } = item;
  return { ...feedback, progressStatus: item.progressStatus ?? progressStatus ?? 'baseline' };
}

async function apiRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const headers = new Headers(init?.headers);
  if (init?.body && !(init.body instanceof FormData) && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }
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
  if (!usesPersistentBackend) {
    const stored = readLocal<Goal[]>(goalStorageKey, []);
    const presets = createDemoGoals().map((preset) => {
      const saved = stored.find((goal) => goal.templateKey === preset.templateKey);
      return saved ? { ...preset, ...saved, skills: preset.skills, defaultCategory: preset.defaultCategory } : preset;
    });
    const custom = stored
      .filter((goal) => goal.isCustom || (!goal.templateKey && goal.id.startsWith('demo-goal-')))
      .map((goal) => ({ ...goal, templateKey: null, isCustom: true, isActive: goal.isActive ?? false, skills: [], defaultCategory: 'spontaneous' }));
    return [...presets, ...custom];
  }
  const result = await apiRequest<{ goals: Goal[] }>('/api/goals');
  return result.goals;
}

export async function updateGoal(goalId: string, input: Partial<Pick<Goal, 'title' | 'description' | 'status'>>) {
  if (!usesPersistentBackend) {
    const current = await listGoals();
    const next = current.map((goal) => (goal.id === goalId ? { ...goal, ...input } : goal));
    writeLocal(goalStorageKey, next.filter((goal) => goal.isCustom || goal.templateKey));
    return next.find((goal) => goal.id === goalId);
  }

  const result = await apiRequest<{ goal: Goal }>(`/api/goals/${goalId}`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  });
  return result.goal;
}

export async function setActiveGoal(goalId: string): Promise<void> {
  if (!usesPersistentBackend) {
    const current = await listGoals();
    const next = current.map((goal) => ({ ...goal, isActive: goal.id === goalId }));
    writeLocal(goalStorageKey, next);
    return;
  }

  await apiRequest(`/api/goals/${goalId}/activate`, { method: 'POST' });
}

export async function getGoalDashboard(goalId: string): Promise<GoalDashboard> {
  if (!usesPersistentBackend) {
    const goal = (await listGoals()).find((item) => item.id === goalId);
    const framework = getGoalDefinition(goal?.templateKey)?.evaluationFramework;
    return {
      goalId,
      sessionCount: 0,
      completedAnswerCount: 0,
      lastPractised: null,
      totalSpeakingSeconds: 0,
      speakingActivity: [],
      overview: { text: null, strength: null, improvement: null, progress: null, supportingSessionIds: [] },
      storytellingFramework: framework
        ? {
            name: framework.name,
            description: framework.description,
            criteria: framework.criteria.map((criterion) => ({
              id: criterion.id,
              title: criterion.title,
              description: criterion.description,
              evaluation: null,
            })),
          }
        : undefined,
      vocabulary: { totalWords: 0, uniqueWords: 0, newlyObservedWords: null, comparisonLabel: null, repeatedWords: [], strengths: [], improvements: [] },
      grammar: { strengths: [], improvements: [] },
      fluency: { averageWpm: 0, fillerCount: 0, fillerRatePer100Words: 0, commonFillers: [], repeatedOpenings: [], feedback: [] },
      lessons: [],
    };
  }

  const result = await apiRequest<{ dashboard: GoalDashboard }>(`/api/goals/${goalId}/dashboard`);
  return result.dashboard;
}

export async function listGoalExercises(goalId: string): Promise<GoalExercise[]> {
  if (!usesPersistentBackend) return [];
  const result = await apiRequest<{ exercises: GoalExercise[] }>(`/api/goals/${goalId}/exercises`);
  return result.exercises;
}

export async function createPracticeSession(input: {
  goalId: string;
  goalTitle: string;
  categories: string[];
  topic: string;
  prompt: string;
}) {
  if (!usesPersistentBackend) return { id: `demo-session-${crypto.randomUUID()}` };

  const result = await apiRequest<{ session: { id: string } }>('/api/sessions', {
    method: 'POST',
    body: JSON.stringify({
      goalId: input.goalId,
      goalTitle: input.goalTitle,
      categories: input.categories,
      skillFocus: 'all-skills',
      topic: input.topic,
      title: input.goalTitle,
    }),
  });
  return result.session;
}

export async function saveAndAnalyzeResponse(input: {
  sessionId: string;
  prompt: string;
  durationSeconds: number;
  sequenceNumber: number;
  audio: Blob;
  goalTemplateKey?: string | null;
  generateInterviewFollowUp?: boolean;
}) {
  if (!usesPersistentBackend) {
    const responseId = `demo-response-${crypto.randomUUID()}`;
    const mock = createMockAnalysis(input.durationSeconds, { goalTemplateKey: input.goalTemplateKey });
    const analysis: ResponseAnalysis = {
      transcript: mock.transcript,
      durationSeconds: input.durationSeconds,
      metrics: mock.metrics,
      feedback: mock.feedback,
      followUpQuestion: input.goalTemplateKey === 'clarity'
        ? 'What was the most difficult decision you personally made in that situation, and what did you learn from it?'
        : undefined,
    };
    return { responseId, feedbackIds: {} as Record<string, string>, analysis };
  }

  const created = await apiRequest<{ response: { id: string } }>(`/api/sessions/${input.sessionId}/responses`, {
    method: 'POST',
    body: JSON.stringify({
      prompt: input.prompt,
      durationSeconds: Math.max(1, input.durationSeconds),
      sequenceNumber: input.sequenceNumber,
    }),
  });
  const idempotencyKey = `${input.sessionId}:${input.sequenceNumber}:openrouter-v1`;
  const upload = new FormData();
  upload.set('idempotencyKey', idempotencyKey);
  upload.set('generateFollowUp', input.generateInterviewFollowUp ? 'true' : 'false');
  upload.set('audio', input.audio, input.audio.type.includes('mp4') ? 'answer.m4a' : 'answer.webm');
  const analyzed = await apiRequest<{ analysis?: ResponseAnalysis }>(`/api/responses/${created.response.id}/analyze`, {
    method: 'POST',
    body: upload,
  });
  const analysis = analyzed.analysis ?? await getResponseAnalysis(created.response.id);
  if (!analysis) throw new Error('The completed analysis could not be loaded.');
  const feedbackIds = Object.fromEntries(analysis.feedback.map((item) => [item.id, item.id]));
  return { responseId: created.response.id, feedbackIds, analysis };
}

export async function getResponseAnalysis(responseId: string): Promise<ResponseAnalysis | null> {
  if (!usesPersistentBackend) return null;
  const result = await apiRequest<{
    response: {
      transcript: string;
      duration_seconds: number;
      response_metrics: Array<{
        word_count: number;
        unique_word_count: number;
        average_wpm: number;
        filler_count: number;
        filler_words: Record<string, number>;
      }> | {
        word_count: number;
        unique_word_count: number;
        average_wpm: number;
        filler_count: number;
        filler_words: Record<string, number>;
      } | null;
      feedback_items: Array<{
        id: string;
        dimension: FeedbackDimension;
        skill: string;
        evidence: string;
        title: string;
        explanation: string;
        alternatives: string[];
        corrections?: Array<{ evidence: string; suggestion: string }>;
        positive: boolean;
        progress_status?: FeedbackProgressStatus;
      }>;
    };
  }>(`/api/responses/${responseId}`);
  const metricsRelation = Array.isArray(result.response.response_metrics)
    ? result.response.response_metrics[0]
    : result.response.response_metrics;
  if (!metricsRelation) return null;
  return {
    transcript: result.response.transcript,
    durationSeconds: result.response.duration_seconds,
    metrics: {
      wordCount: metricsRelation.word_count,
      uniqueWordCount: metricsRelation.unique_word_count,
      averageWpm: metricsRelation.average_wpm,
      fillerCount: metricsRelation.filler_count,
      fillerWords: metricsRelation.filler_words,
    },
    feedback: result.response.feedback_items.map(normalizeFeedbackItem),
  };
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
  goalTemplateKey?: string | null;
  categories: string[];
  prompt: string;
  answerCount: number;
  startedAt: number;
}) {
  if (usesPersistentBackend) {
    return apiRequest<FinishedSession>(`/api/sessions/${input.sessionId}/finish`, {
      method: 'POST',
      body: JSON.stringify({ title: input.goal }),
    });
  }

  const current = readLocal(sessionStorageKey, seedSessions);
  if (current.some((session) => session.id === input.sessionId)) {
    return createDemoFinishedSession(
      input.sessionId,
      input.answerCount,
      Math.max(1, Math.round((Date.now() - input.startedAt) / 1000)),
      input.goalTemplateKey,
    );
  }
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
    title: input.goal,
    takeaway: 'Lead with the decision, then name one consequence and one boundary.',
    hasExercise: false,
  };
  writeLocal(sessionStorageKey, [session, ...current]);
  return createDemoFinishedSession(
    input.sessionId,
    input.answerCount,
    durationMinutes * 60,
    input.goalTemplateKey,
  );
}

function createDemoFinishedSession(
  sessionId: string,
  answerCount: number,
  durationSeconds: number,
  goalTemplateKey?: string | null,
): FinishedSession {
  const definition = getGoalDefinition(goalTemplateKey ?? 'clarity');
  const targetSkill = definition?.skills[0]?.title ?? 'Communicate with intention';
  const template = getExerciseTemplate(goalTemplateKey === 'negotiation' ? 'E2' : goalTemplateKey === 'storytelling' ? 'E3' : 'E1');
  return {
    session: {
      id: sessionId,
      status: 'completed',
      answers: answerCount,
      durationSeconds,
      wordCount: 168 * Math.max(1, answerCount),
      averageWpm: 132,
      fillerCount: 3 * Math.max(1, answerCount),
    },
    summary: {
      headline: `You made progress on ${definition?.title.toLowerCase() ?? 'your communication goal'}.`,
      summary: `Your answers showed a clear intention. The next step is to make ${targetSkill.toLowerCase()} more consistent.`,
      strengths: [{ title: targetSkill, detail: 'Your strongest moments gave listeners a clear frame for what followed.' }],
      opportunities: [{ title: `Strengthen ${targetSkill.toLowerCase()}`, detail: 'Make the intended skill visible in every answer, especially under time pressure.', evidence: 'kind of a big problem' }],
      takeaway: `Use your next answer to practise ${targetSkill.toLowerCase()} with one concrete example.`,
      interviewChecks: goalTemplateKey === 'clarity' ? [
        {
          id: 'answer-relevance',
          question: 'Did you answer the actual question?',
          passed: true,
          detail: 'Your response stated a clear position that addressed the decision in the question.',
          evidence: 'I would choose reliability first',
        },
        {
          id: 'reasoning-clarity',
          question: 'Was your reasoning easy to follow?',
          passed: true,
          detail: 'The answer connected customer trust and team confidence to the recommendation.',
          evidence: 'reliability protects customer trust',
        },
        {
          id: 'clear-conclusion',
          question: 'Did you provide a clear conclusion?',
          passed: true,
          detail: 'The ending restated the path forward and made the recommendation feel complete.',
          evidence: 'return to faster experiments with a clearer baseline',
        },
      ] : undefined,
    },
    exercise: {
      id: `demo-exercise-${sessionId}`,
      templateId: template.id,
      skillId: template.skillId,
      title: template.title,
      targetSkill: template.targetSkill,
      targetBehavior: targetSkill,
      behaviorCode: template.behaviorCode,
      selectionReason: `This session’s feedback showed that ${targetSkill.toLowerCase()} is the most useful skill to reinforce next.`,
      instructions: template.instructions,
      estimatedMinutes: template.estimatedMinutes,
      prompt: template.guidedPrompts[0],
      guidance: template.levelGuidance[0],
      difficultyLevel: 1,
      sourceEvidence: 'kind of a big problem',
      status: 'recommended',
    },
  };
}

export async function completeExerciseAttempt(input: {
  exerciseId: string | null;
  templateId: 'E1' | 'E2' | 'E3' | 'E4' | 'E5' | 'E6';
  audio: Blob;
  durationSeconds: number;
  attemptNumber: number;
  attemptType: ExerciseAttemptType;
  prompt: string;
  guidance: string;
  difficultyLevel: number;
}): Promise<ExerciseAttemptResult> {
  if (!usesPersistentBackend || !input.exerciseId) {
    const mock = createMockAnalysis(input.durationSeconds);
    const assessment = input.attemptType === 'transfer' || input.attemptNumber >= 2 ? 'pass' : 'partial';
    const next = input.attemptType === 'transfer'
      ? { stage: 'summary' as const }
      : input.attemptNumber >= 2 && assessment === 'pass'
        ? {
            stage: 'transfer' as const,
            attemptNumber: 1,
            prompt: fallbackExercisePrompt(input.templateId, 1, true),
            guidance: '',
            difficultyLevel: 3,
          }
        : {
            stage: 'guided' as const,
            attemptNumber: input.attemptNumber + 1,
            prompt: fallbackExercisePrompt(input.templateId, input.attemptNumber + 1),
            guidance: getExerciseTemplate(input.templateId).levelGuidance[Math.min(2, input.difficultyLevel)],
            difficultyLevel: Math.min(3, input.difficultyLevel + 1),
          };
    return {
      attempt: {
        id: `demo-attempt-${crypto.randomUUID()}`,
        attemptNumber: input.attemptNumber,
        attemptType: input.attemptType,
        prompt: input.prompt,
        difficultyLevel: input.difficultyLevel,
        guidanceProvided: input.guidance,
        transcript: mock.transcript,
        durationSeconds: input.durationSeconds,
        metrics: mock.metrics,
        assessment,
        whatWorked: 'You stated a measurable outcome: “The operations team reduced manual screening by about 80%.”',
        whatToImprove: 'The opening delays that outcome with background, so the listener has to infer the main result.',
        supportingEvidence: 'At my last company, I worked on an evaluation framework',
        nextGuidance: 'I turned expert feedback into an evaluation framework that reduced manual screening by about 80%.',
        completedAt: new Date().toISOString(),
      },
      next,
    };
  }
  const upload = new FormData();
  upload.set('durationSeconds', String(Math.max(1, input.durationSeconds)));
  upload.set('attemptNumber', String(input.attemptNumber));
  upload.set('attemptType', input.attemptType);
  upload.set('prompt', input.prompt);
  upload.set('guidance', input.guidance);
  upload.set('difficultyLevel', String(input.difficultyLevel));
  upload.set('audio', input.audio, input.audio.type.includes('mp4') ? 'exercise.m4a' : 'exercise.webm');
  const result = await apiRequest<{ result: ExerciseAttemptResult }>(`/api/exercises/${input.exerciseId}/response`, {
    method: 'POST',
    body: upload,
  });
  return result.result;
}

export async function updateExerciseStatus(exerciseId: string | null, status: Extract<ExerciseStatus, 'in_progress' | 'skipped' | 'abandoned'>) {
  if (!usesPersistentBackend || !exerciseId) return;
  await apiRequest(`/api/exercises/${exerciseId}/status`, {
    method: 'PATCH',
    body: JSON.stringify({ status }),
  });
}

export async function finishPersonalizedExercise(exerciseId: string | null): Promise<ExerciseCompletionSummary> {
  if (!usesPersistentBackend || !exerciseId) {
    return {
      exerciseId: exerciseId ?? 'demo-exercise',
      status: 'completed',
      targetSkill: 'Structuring thoughts',
      targetBehavior: 'Make the central point explicit before supporting detail.',
      guidedAttempts: [],
      transferTest: null,
      whatImproved: 'You repeated the target behavior with progressively less guidance.',
      remainingFocus: 'Keep the same structure when the topic is unfamiliar or ambiguous.',
      recommendedNextPractice: 'Use the target behavior once in your next goal-based practice session.',
    };
  }
  const result = await apiRequest<{ summary: ExerciseCompletionSummary }>(`/api/exercises/${exerciseId}/complete`, { method: 'POST' });
  return result.summary;
}

export async function endPersonalizedExercise(exerciseId: string | null) {
  if (!usesPersistentBackend || !exerciseId) return;
  await apiRequest(`/api/exercises/${exerciseId}/end`, { method: 'POST' });
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
      exerciseTargetSkill: session.hasExercise ? 'Use precise language' : undefined,
      exerciseReason: session.hasExercise ? 'This skill was selected from the recurring vocabulary feedback in the session.' : undefined,
      exerciseEvidence: session.hasExercise ? 'kind of a big problem' : undefined,
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
        id: string;
        prompt: string;
        transcript: string;
        response_metrics: Array<{
          word_count: number;
          unique_word_count: number;
          average_wpm: number;
          filler_count: number;
          filler_words: Record<string, number>;
        }> | {
          word_count: number;
          unique_word_count: number;
          average_wpm: number;
          filler_count: number;
          filler_words: Record<string, number>;
        } | null;
        feedback_items: Array<{
          id: string;
          dimension: FeedbackDimension;
          skill: string;
          evidence: string;
          title: string;
          explanation: string;
          alternatives: string[];
          corrections?: Array<{ evidence: string; suggestion: string }>;
          positive: boolean;
          progress_status?: FeedbackProgressStatus;
        }>;
      }>;
      session_summaries: Array<{ summary: string; strengths: SummaryPattern[]; opportunities: SummaryPattern[] }> | { summary: string; strengths: SummaryPattern[]; opportunities: SummaryPattern[] } | null;
      exercises:
        | Array<{
            title: string;
            exercise_template_id: 'E1' | 'E2' | 'E3' | 'E4' | 'E5' | 'E6';
            target_skill: string;
            target_behavior: string;
            instructions: string[];
            selection_reason: string;
            source_evidence: string;
            status: ExerciseStatus;
            completion_feedback: Record<string, unknown>;
            exercise_attempts: Array<Record<string, unknown>> | Record<string, unknown> | null;
          }>
        | {
            title: string;
            exercise_template_id: 'E1' | 'E2' | 'E3' | 'E4' | 'E5' | 'E6';
            target_skill: string;
            target_behavior: string;
            instructions: string[];
            selection_reason: string;
            source_evidence: string;
            status: ExerciseStatus;
            completion_feedback: Record<string, unknown>;
            exercise_attempts: Array<Record<string, unknown>> | Record<string, unknown> | null;
          }
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
  const savedExercise = exercises[0];
  const attemptRows = savedExercise
    ? (Array.isArray(savedExercise.exercise_attempts)
        ? savedExercise.exercise_attempts
        : savedExercise.exercise_attempts ? [savedExercise.exercise_attempts] : [])
    : [];
  const exerciseAttempts = attemptRows.map((row) => ({
    id: String(row.id),
    attemptNumber: Number(row.attempt_number),
    attemptType: row.attempt_type as ExerciseAttemptType,
    prompt: String(row.prompt),
    difficultyLevel: Number(row.difficulty_level),
    guidanceProvided: textValue(row.guidance_provided),
    transcript: textValue(row.transcript),
    durationSeconds: Number(row.duration_seconds),
    metrics: row.metrics as ResponseAnalysis['metrics'],
    assessment: row.assessment as 'pass' | 'partial' | 'fail' | 'not_evaluated',
    whatWorked: textValue(row.positive_feedback),
    whatToImprove: textValue(row.improvement_feedback),
    supportingEvidence: textValue(row.supporting_evidence),
    nextGuidance: textValue(row.next_guidance),
    completedAt: textValue(row.completed_at) || textValue(row.created_at),
  })).sort((left, right) => left.completedAt.localeCompare(right.completedAt));
  const completionFeedback = savedExercise?.completion_feedback ?? {};
  const historyResponses = session.responses.map((response) => {
    const metrics = Array.isArray(response.response_metrics) ? response.response_metrics[0] : response.response_metrics;
    return {
      id: response.id,
      prompt: response.prompt,
      transcript: response.transcript,
      metrics: metrics ? {
        wordCount: metrics.word_count,
        uniqueWordCount: metrics.unique_word_count,
        averageWpm: metrics.average_wpm,
        fillerCount: metrics.filler_count,
        fillerWords: metrics.filler_words,
      } : null,
      feedback: response.feedback_items.map(normalizeFeedbackItem),
    };
  });
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
    title: session.goal_title,
    takeaway: session.takeaway,
    hasExercise: savedExercise?.status === 'completed',
    prompt: firstResponse?.prompt ?? '',
    transcript: firstResponse?.transcript ?? '',
    feedbackTitle: firstFeedback?.title ?? 'Saved coaching',
    feedbackExplanation: firstFeedback?.explanation ?? '',
    summary: summaries[0]?.summary ?? session.takeaway,
    responses: historyResponses,
    summaryStrengths: summaries[0]?.strengths ?? [],
    summaryOpportunities: summaries[0]?.opportunities ?? [],
    exerciseTitle: savedExercise?.title,
    exerciseTemplateId: savedExercise?.exercise_template_id,
    exerciseTargetSkill: savedExercise?.target_skill,
    exerciseTargetBehavior: savedExercise?.target_behavior,
    exerciseInstructions: Array.isArray(savedExercise?.instructions)
      ? savedExercise.instructions.filter((instruction): instruction is string => typeof instruction === 'string')
      : [],
    exerciseReason: savedExercise?.selection_reason,
    exerciseEvidence: savedExercise?.source_evidence,
    exerciseStatus: savedExercise?.status,
    exerciseAttempts,
    exerciseCompletion: savedExercise?.status === 'completed' ? {
      whatImproved: textValue(completionFeedback.whatImproved),
      remainingFocus: textValue(completionFeedback.remainingFocus),
      recommendedNextPractice: textValue(completionFeedback.recommendedNextPractice),
    } : null,
  };
}

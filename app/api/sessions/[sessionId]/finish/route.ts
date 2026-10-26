import { after, NextResponse } from 'next/server';
import { apiError, databaseError, parseBody, requireApiUser } from '@/lib/api-response';
import { generateSessionSummary } from '@/lib/analysis/openrouter-provider';
import { getInterviewEvaluation } from '@/lib/feedback-copy';
import { getGoalDefinition } from '@/lib/goal-catalog';
import { finishSessionSchema } from '@/lib/validation';
import type { FeedbackDimension, InterviewCheck } from '@/lib/types';

type RouteParams = { params: Promise<{ sessionId: string }> };
type ApiContext = Extract<Awaited<ReturnType<typeof requireApiUser>>, { userId: string }>;

export const maxDuration = 120;

type MetricRow = { word_count: number; average_wpm: number; filler_count: number; time_to_main_point_seconds: number | null };
type FeedbackRow = {
  id: string;
  dimension: FeedbackDimension;
  evidence: string;
  title: string;
  explanation: string;
  positive: boolean;
  dismissed: boolean;
  skill: string;
};
type CompletedResponse = {
  id: string;
  prompt: string;
  transcript: string;
  duration_seconds: number;
  sequence_number: number;
  response_metrics: MetricRow | MetricRow[] | null;
  feedback_items: FeedbackRow | FeedbackRow[] | null;
};
type SessionRow = {
  id: string;
  status: string;
  created_at: string;
  title: string;
  goal_id: string | null;
  goal_title: string;
  takeaway: string;
  goals: { template_key: string | null } | Array<{ template_key: string | null }> | null;
};
type FinishData = {
  session: SessionRow;
  completedResponses: CompletedResponse[];
  totalDuration: number;
  wordCount: number;
  averageWpm: number;
  averageTimeToMainPointSeconds: number | null;
  timeToMainPointAnswerCount: number;
  fillerCount: number;
  feedback: Array<FeedbackRow & { responseId: string }>;
  interviewChecks?: InterviewCheck[];
};

function asArray<T>(value: T | T[] | null | undefined): T[] {
  if (!value) return [];
  return Array.isArray(value) ? value : [value];
}

function buildInterviewChecks(feedback: FeedbackRow[]): InterviewCheck[] {
  const definitions: Array<{ id: InterviewCheck['id']; question: string; dimension: FeedbackDimension; fallback: string }> = [
    { id: 'answer-relevance', question: 'Did you answer the actual question?', dimension: 'Communication effectiveness', fallback: 'The coach could not verify answer relevance from this session.' },
    { id: 'reasoning-clarity', question: 'Was your reasoning easy to follow?', dimension: 'Critical thinking', fallback: 'The coach could not verify the reasoning structure from this session.' },
    { id: 'clear-conclusion', question: 'Did you provide a clear conclusion?', dimension: 'Sentence structure', fallback: 'The coach could not verify a clear conclusion from this session.' },
  ];
  return definitions.map((definition) => {
    const relevant = feedback.filter((item) => !item.dismissed && item.dimension === definition.dimension);
    const representative = [...relevant].reverse().find((item) => !item.positive) ?? relevant.at(-1);
    const representativeEvaluation = representative ? getInterviewEvaluation(representative) : null;
    const verdict = relevant.length > 0 && relevant.every((item) => item.positive)
      ? 'yes'
      : relevant.some((item) => item.positive)
        ? 'partially'
        : representativeEvaluation?.verdict ?? 'no';
    return {
      id: definition.id,
      question: definition.question,
      passed: verdict === 'yes',
      verdict,
      detail: representativeEvaluation?.reason ?? definition.fallback,
      evidence: representative?.evidence || undefined,
    };
  });
}

function sessionSnapshot(data: FinishData) {
  return {
    id: data.session.id,
    status: 'completed' as const,
    answers: data.completedResponses.length,
    durationSeconds: data.totalDuration,
    wordCount: data.wordCount,
    averageWpm: data.averageWpm,
    averageTimeToMainPointSeconds: data.averageTimeToMainPointSeconds,
    timeToMainPointAnswerCount: data.timeToMainPointAnswerCount,
    fillerCount: data.fillerCount,
  };
}

async function loadFinishData(context: ApiContext, sessionId: string) {
  const [sessionResult, responsesResult] = await Promise.all([
    context.supabase.from('sessions').select('id, status, created_at, title, goal_id, goal_title, takeaway, goals(template_key)').eq('id', sessionId).eq('user_id', context.userId).maybeSingle(),
    context.supabase.from('responses').select('id, prompt, transcript, duration_seconds, sequence_number, response_metrics(word_count, average_wpm, filler_count, time_to_main_point_seconds), feedback_items(id, dimension, evidence, title, explanation, positive, dismissed, skill)').eq('session_id', sessionId).eq('user_id', context.userId).eq('status', 'completed').order('sequence_number', { ascending: true }),
  ]);
  if (sessionResult.error) return { error: databaseError(sessionResult.error) } as const;
  if (!sessionResult.data) return { error: apiError(404, 'session_not_found', 'Practice session not found.') } as const;
  if (responsesResult.error) return { error: databaseError(responsesResult.error) } as const;

  const session = sessionResult.data as unknown as SessionRow;
  const completedResponses = (responsesResult.data ?? []) as unknown as CompletedResponse[];
  if (!completedResponses.length) return { error: apiError(409, 'no_completed_answers', 'Complete at least one answer before ending the session.') } as const;

  const totalDuration = completedResponses.reduce((total, response) => total + response.duration_seconds, 0);
  const metricRows = completedResponses.flatMap((response) => asArray(response.response_metrics));
  const wordCount = metricRows.reduce((total, metrics) => total + metrics.word_count, 0);
  const averageWpm = totalDuration > 0 ? Math.round((wordCount * 60) / totalDuration) : 0;
  const timeToMainPointValues = metricRows.flatMap((metrics) => (
    typeof metrics.time_to_main_point_seconds === 'number' ? [metrics.time_to_main_point_seconds] : []
  ));
  const averageTimeToMainPointSeconds = timeToMainPointValues.length
    ? Math.round(timeToMainPointValues.reduce((total, seconds) => total + seconds, 0) / timeToMainPointValues.length)
    : null;
  const fillerCount = metricRows.reduce((total, metrics) => total + metrics.filler_count, 0);
  const feedback = completedResponses.flatMap((response) => asArray(response.feedback_items).map((item) => ({ ...item, responseId: response.id })));
  const goalRelation = Array.isArray(session.goals) ? session.goals[0] : session.goals;
  return {
    data: {
      session,
      completedResponses,
      totalDuration,
      wordCount,
      averageWpm,
      averageTimeToMainPointSeconds,
      timeToMainPointAnswerCount: timeToMainPointValues.length,
      fillerCount,
      feedback,
      interviewChecks: goalRelation?.template_key === 'clarity' ? buildInterviewChecks(feedback) : undefined,
    } satisfies FinishData,
  } as const;
}

async function loadSavedResult(context: ApiContext, data: FinishData) {
  const [summaryResult, exerciseResult] = await Promise.all([
    context.supabase.from('session_summaries').select('summary, strengths, opportunities').eq('session_id', data.session.id).eq('user_id', context.userId).maybeSingle(),
    context.supabase.from('exercises').select('id, exercise_template_id, skill_category, title, target_skill, target_behavior, behavior_code, selection_reason, instructions, estimated_minutes, prompt, guidance, difficulty_level, source_evidence, status').eq('session_id', data.session.id).eq('user_id', context.userId).maybeSingle(),
  ]);
  if (summaryResult.error) throw new Error(`Could not load the session summary: ${summaryResult.error.message}`);
  if (exerciseResult.error) throw new Error(`Could not load the recommended exercise: ${exerciseResult.error.message}`);
  if (!summaryResult.data || !exerciseResult.data) return null;

  const savedSummary = summaryResult.data;
  const savedExercise = exerciseResult.data;
  const strengths = Array.isArray(savedSummary.strengths) ? savedSummary.strengths : [];
  const opportunities = Array.isArray(savedSummary.opportunities) ? savedSummary.opportunities : [];
  const firstStrength = strengths[0] as { title?: string } | undefined;
  return {
    session: sessionSnapshot(data),
    summary: {
      headline: firstStrength?.title ?? 'Session complete',
      summary: savedSummary.summary,
      strengths,
      opportunities,
      takeaway: data.session.takeaway,
      interviewChecks: data.interviewChecks,
    },
    exercise: {
      id: savedExercise.id,
      templateId: savedExercise.exercise_template_id,
      skillId: savedExercise.skill_category,
      title: savedExercise.title,
      targetSkill: savedExercise.target_skill,
      targetBehavior: savedExercise.target_behavior,
      behaviorCode: savedExercise.behavior_code,
      selectionReason: savedExercise.selection_reason,
      instructions: Array.isArray(savedExercise.instructions) ? savedExercise.instructions : [],
      estimatedMinutes: savedExercise.estimated_minutes,
      prompt: savedExercise.prompt,
      guidance: savedExercise.guidance,
      difficultyLevel: savedExercise.difficulty_level,
      sourceEvidence: savedExercise.source_evidence,
      status: savedExercise.status,
    },
  };
}

async function loadExerciseHistory(context: ApiContext, data: FinishData) {
  if (!data.session.goal_id) return [];
  const { data: previousSessions, error: previousSessionsError } = await context.supabase.from('sessions').select('id').eq('user_id', context.userId).eq('goal_id', data.session.goal_id).neq('id', data.session.id).eq('status', 'completed').order('completed_at', { ascending: false }).limit(8);
  if (previousSessionsError) throw new Error(`Could not load prior sessions: ${previousSessionsError.message}`);
  const previousSessionIds = (previousSessions ?? []).map((item) => item.id);
  if (!previousSessionIds.length) return [];
  const { data: previousExercises, error: previousExercisesError } = await context.supabase.from('exercises').select('exercise_template_id, target_behavior, status, completion_feedback, exercise_attempts(attempt_type, assessment, processing_status)').eq('user_id', context.userId).in('session_id', previousSessionIds).order('created_at', { ascending: false });
  if (previousExercisesError) throw new Error(`Could not load prior exercises: ${previousExercisesError.message}`);

  return (previousExercises ?? []).flatMap((exercise) => {
    const completionFeedback = exercise.completion_feedback && typeof exercise.completion_feedback === 'object' ? exercise.completion_feedback as Record<string, unknown> : {};
    const learningHistory = Array.isArray(completionFeedback.history) ? completionFeedback.history as Array<Record<string, unknown>> : [];
    if (learningHistory.length) {
      return learningHistory.map((signal) => ({
        templateId: typeof signal.templateId === 'string' ? signal.templateId : exercise.exercise_template_id,
        targetBehavior: typeof signal.remainingFocus === 'string' ? signal.remainingFocus : typeof signal.targetBehavior === 'string' ? signal.targetBehavior : exercise.target_behavior,
        status: 'completed',
        guidedAssessments: Array.isArray(signal.guidedAssessments) ? signal.guidedAssessments as Array<'pass' | 'partial' | 'fail' | 'not_evaluated'> : [],
        transferAssessment: typeof signal.transferAssessment === 'string' ? signal.transferAssessment as 'pass' | 'partial' | 'fail' | 'not_evaluated' : null,
      }));
    }
    const attempts = (Array.isArray(exercise.exercise_attempts) ? exercise.exercise_attempts : exercise.exercise_attempts ? [exercise.exercise_attempts] : [])
      .filter((attempt) => attempt.processing_status === 'completed');
    return [{
      templateId: exercise.exercise_template_id,
      targetBehavior: exercise.target_behavior,
      status: exercise.status,
      guidedAssessments: attempts.filter((attempt) => attempt.attempt_type === 'guided').map((attempt) => attempt.assessment as 'pass' | 'partial' | 'fail' | 'not_evaluated'),
      transferAssessment: (attempts.find((attempt) => attempt.attempt_type === 'transfer')?.assessment as 'pass' | 'partial' | 'fail' | 'not_evaluated' | undefined) ?? null,
    }];
  });
}

async function generateAndSaveSummary(context: ApiContext, data: FinishData) {
  const startedAt = performance.now();
  const timings: Record<string, number> = {};
  try {
    const historyStartedAt = performance.now();
    const exerciseHistory = await loadExerciseHistory(context, data);
    timings.historyMs = Math.round(performance.now() - historyStartedAt);
    const goalRelation = Array.isArray(data.session.goals) ? data.session.goals[0] : data.session.goals;
    const goalDefinition = getGoalDefinition(goalRelation?.template_key);
    const generationStartedAt = performance.now();
    const summary = await generateSessionSummary({
      goalTitle: data.session.goal_title,
      goalSkills: goalDefinition?.skills ?? [],
      goalFramework: goalDefinition?.evaluationFramework,
      coachInstructions: goalDefinition?.coachInstructions,
      responses: data.completedResponses.map((response) => ({ id: response.id, prompt: response.prompt, transcript: response.transcript })),
      feedback: data.feedback,
      exerciseHistory,
    });
    timings.generationMs = Math.round(performance.now() - generationStartedAt);

    const persistenceStartedAt = performance.now();
    const { data: exercise, error: exerciseError } = await context.supabase.from('exercises').upsert({
      user_id: context.userId,
      session_id: data.session.id,
      response_id: summary.exercise.sourceResponseId,
      source_feedback_item_id: summary.exercise.sourceFeedbackItemId,
      exercise_type: summary.exercise.templateId,
      exercise_template_id: summary.exercise.templateId,
      skill_category: summary.exercise.skillId,
      title: summary.exercise.title,
      target_skill: summary.exercise.targetSkill,
      target_behavior: summary.exercise.targetBehavior,
      behavior_code: summary.exercise.behaviorCode,
      selection_reason: summary.exercise.selectionReason,
      instructions: summary.exercise.instructions,
      estimated_minutes: summary.exercise.estimatedMinutes,
      prompt: summary.exercise.prompt,
      guidance: summary.exercise.guidance,
      difficulty_level: summary.exercise.difficultyLevel,
      source_evidence: summary.exercise.sourceEvidence,
      status: 'recommended',
    }, { onConflict: 'session_id' }).select('id').single();
    if (exerciseError) throw new Error(`Could not save the recommended exercise: ${exerciseError.message}`);

    const { error: summaryError } = await context.supabase.from('session_summaries').upsert({
      session_id: data.session.id,
      user_id: context.userId,
      summary: summary.summary,
      strengths: summary.strengths,
      opportunities: summary.opportunities,
      recommended_exercise_id: exercise.id,
    });
    if (summaryError) throw new Error(`Could not save the session summary: ${summaryError.message}`);
    const { error: sessionUpdateError } = await context.supabase.from('sessions').update({ takeaway: summary.takeaway }).eq('id', data.session.id).eq('user_id', context.userId);
    if (sessionUpdateError) throw new Error(`Could not finish the session summary: ${sessionUpdateError.message}`);
    timings.persistenceMs = Math.round(performance.now() - persistenceStartedAt);
    timings.totalMs = Math.round(performance.now() - startedAt);
    console.info('Session summary timing', { sessionId: data.session.id, ...timings });
  } catch (error) {
    timings.totalMs = Math.round(performance.now() - startedAt);
    console.error('Session summary generation failed', { sessionId: data.session.id, message: error instanceof Error ? error.message : 'Unknown summary error', ...timings });
  }
}

export async function GET(_request: Request, { params }: RouteParams) {
  const context = await requireApiUser();
  if ('error' in context) return context.error;
  const { sessionId } = await params;
  const loaded = await loadFinishData(context, sessionId);
  if ('error' in loaded) return loaded.error;
  const data = loaded.data;
  try {
    const result = await loadSavedResult(context, data);
    if (result) return NextResponse.json({ generationStatus: 'completed', result });
  } catch (error) {
    console.error('Saved session summary could not be loaded', { sessionId, message: error instanceof Error ? error.message : 'Unknown saved-summary error' });
  }
  return NextResponse.json({ generationStatus: 'processing', session: sessionSnapshot(data) }, { status: 202 });
}

export async function POST(request: Request, { params }: RouteParams) {
  const requestStartedAt = performance.now();
  const context = await requireApiUser();
  if ('error' in context) return context.error;
  const body = await parseBody(request, finishSessionSchema);
  if ('error' in body) return body.error;
  const { sessionId } = await params;
  const loaded = await loadFinishData(context, sessionId);
  if ('error' in loaded) return loaded.error;
  const data = loaded.data;

  try {
    const result = await loadSavedResult(context, data);
    if (result) return NextResponse.json({ generationStatus: 'completed', result });
  } catch (error) {
    console.error('Saved session summary could not be loaded', { sessionId, message: error instanceof Error ? error.message : 'Unknown saved-summary error' });
  }

  const { error: metricUpdateError } = await context.supabase.from('sessions').update({
    status: 'completed',
    completed_at: new Date().toISOString(),
    duration_seconds: data.totalDuration,
    average_wpm: data.averageWpm,
    filler_count: data.fillerCount,
    title: data.session.goal_title,
  }).eq('id', sessionId).eq('user_id', context.userId);
  if (metricUpdateError) return databaseError(metricUpdateError);

  after(() => generateAndSaveSummary(context, data));
  const enqueueMs = Math.round(performance.now() - requestStartedAt);
  return NextResponse.json(
    { generationStatus: 'processing', session: sessionSnapshot(data) },
    { status: 202, headers: { 'Server-Timing': `enqueue;dur=${enqueueMs}` } },
  );
}

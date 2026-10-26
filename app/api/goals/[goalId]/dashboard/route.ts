import { NextResponse } from 'next/server';
import { apiError, databaseError, requireApiUser } from '@/lib/api-response';
import { getGoalDefinition } from '@/lib/goal-catalog';
import type { DashboardFeedbackItem, FeedbackCorrection, FeedbackDimension, FeedbackProgressStatus, GoalDashboard, GoalLessonInsight, ResponseMetrics, SummaryPattern } from '@/lib/types';

type RouteParams = { params: Promise<{ goalId: string }> };

type FeedbackRow = {
  id: string;
  dimension: FeedbackDimension;
  skill: string;
  evidence: string;
  title: string;
  explanation: string;
  alternatives: unknown;
  corrections: unknown;
  positive: boolean;
  progress_status: FeedbackProgressStatus | null;
  dismissed: boolean;
  created_at: string;
};

type MetricRow = {
  word_count: number;
  unique_word_count: number;
  average_wpm: number;
  filler_count: number;
  filler_words: unknown;
};

type ResponseRow = {
  id: string;
  prompt: string;
  transcript: string;
  duration_seconds: number;
  sequence_number: number;
  created_at: string;
  status: string;
  response_metrics: MetricRow | MetricRow[] | null;
  feedback_items: FeedbackRow | FeedbackRow[] | null;
};

type ExerciseRow = {
  id: string;
  answer_text: string | null;
  duration_seconds: number;
  completed_at: string | null;
  metrics: unknown;
  coaching: unknown;
  exercise_attempts: ExerciseAttemptRow | ExerciseAttemptRow[] | null;
};

type ExerciseAttemptRow = {
  id: string;
  transcript: string;
  duration_seconds: number;
  completed_at: string | null;
  metrics: unknown;
};

type SummaryRow = {
  summary: string;
  strengths: unknown;
  opportunities: unknown;
};

type SessionRow = {
  id: string;
  title: string;
  completed_at: string | null;
  responses: ResponseRow | ResponseRow[] | null;
  exercises: ExerciseRow | ExerciseRow[] | null;
  session_summaries: SummaryRow | SummaryRow[] | null;
};

const stopWords = new Set([
  'a', 'about', 'after', 'again', 'all', 'also', 'am', 'an', 'and', 'any', 'are', 'as', 'at', 'be', 'because',
  'been', 'before', 'being', 'but', 'by', 'can', 'could', 'did', 'do', 'does', 'doing', 'for', 'from', 'get',
  'had', 'has', 'have', 'he', 'her', 'here', 'hers', 'him', 'his', 'how', 'i', 'if', 'in', 'into', 'is', 'it',
  'its', 'just', 'like', 'me', 'more', 'most', 'my', 'no', 'not', 'now', 'of', 'on', 'one', 'only', 'or', 'our',
  'out', 'really', 'she', 'so', 'some', 'than', 'that', 'the', 'their', 'them', 'then', 'there', 'these', 'they',
  'this', 'those', 'through', 'to', 'too', 'up', 'us', 'very', 'was', 'we', 'were', 'what', 'when', 'where',
  'which', 'who', 'why', 'will', 'with', 'would', 'you', 'your', 'um', 'uh', 'erm', 'actually', 'basically',
  'literally', 'honestly', 'kind', 'sort', 'mean', 'good', 'thing', 'things', 'something', 'stuff', 'way', 'lot',
  'well', 'okay', 'ok', 'think',
]);

function asArray<T>(value: T | T[] | null | undefined): T[] {
  if (!value) return [];
  return Array.isArray(value) ? value : [value];
}

function wordsFrom(transcript: string) {
  return transcript.toLocaleLowerCase().match(/[\p{L}\p{N}]+(?:['’][\p{L}\p{N}]+)*/gu) ?? [];
}

function isVocabularyWord(word: string) {
  return /\p{L}/u.test(word);
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];
}

function correctionArray(value: unknown): FeedbackCorrection[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) return [];
    const correction = item as Record<string, unknown>;
    if (typeof correction.evidence !== 'string' || typeof correction.suggestion !== 'string') return [];
    return [{ evidence: correction.evidence, suggestion: correction.suggestion }];
  });
}

function recordOfNumbers(value: unknown): Record<string, number> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  return Object.fromEntries(
    Object.entries(value).filter((entry): entry is [string, number] => typeof entry[1] === 'number'),
  );
}

function metricFrom(value: unknown): Partial<ResponseMetrics> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  const record = value as Record<string, unknown>;
  return {
    wordCount: typeof record.wordCount === 'number' ? record.wordCount : undefined,
    averageWpm: typeof record.averageWpm === 'number' ? record.averageWpm : undefined,
    fillerCount: typeof record.fillerCount === 'number' ? record.fillerCount : undefined,
    fillerWords: recordOfNumbers(record.fillerWords),
  };
}

function coachingFeedback(value: unknown): Array<{
  dimension: FeedbackDimension;
  skill?: string;
  evidence?: string;
  title?: string;
  explanation?: string;
  alternatives?: unknown;
  corrections?: unknown;
  positive?: boolean;
}> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return [];
  const feedback = (value as Record<string, unknown>).feedback;
  if (!Array.isArray(feedback)) return [];
  return feedback.filter((item): item is {
    dimension: FeedbackDimension;
    skill?: string;
    evidence?: string;
    title?: string;
    explanation?: string;
    alternatives?: unknown;
    corrections?: unknown;
    positive?: boolean;
  } => Boolean(item && typeof item === 'object' && typeof (item as Record<string, unknown>).dimension === 'string'));
}

function findRecurring(items: DashboardFeedbackItem[]) {
  const groups = new Map<string, { label: string; responseIds: Set<string>; item: DashboardFeedbackItem }>();
  for (const item of items) {
    const label = item.skill?.trim() || item.title.trim();
    const key = label.toLocaleLowerCase();
    const existing = groups.get(key) ?? { label, responseIds: new Set<string>(), item };
    existing.responseIds.add(item.responseId ?? `session:${item.sessionId}`);
    if (item.createdAt > existing.item.createdAt) existing.item = item;
    groups.set(key, existing);
  }
  return [...groups.values()].sort((a, b) => b.responseIds.size - a.responseIds.size)[0]?.responseIds.size >= 2
    ? [...groups.values()].sort((a, b) => b.responseIds.size - a.responseIds.size)[0]
    : null;
}

function summaryPatterns(value: unknown): SummaryPattern[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is SummaryPattern => (
    Boolean(item && typeof item === 'object' && typeof (item as Record<string, unknown>).title === 'string')
  ));
}

export async function GET(_request: Request, { params }: RouteParams) {
  const context = await requireApiUser();
  if ('error' in context) return context.error;
  const { goalId } = await params;

  const { data: goal, error: goalError } = await context.supabase
    .from('goals')
    .select('id, template_key')
    .eq('id', goalId)
    .eq('user_id', context.userId)
    .maybeSingle();
  if (goalError) return databaseError(goalError);
  if (!goal) return apiError(404, 'goal_not_found', 'Goal not found.');
  const goalDefinition = getGoalDefinition(goal.template_key);

  const { data, error } = await context.supabase
    .from('sessions')
    .select(`
      id,
      title,
      completed_at,
      responses(
        id,
        prompt,
        transcript,
        duration_seconds,
        sequence_number,
        created_at,
        status,
        response_metrics(word_count, unique_word_count, average_wpm, filler_count, filler_words),
        feedback_items(id, dimension, skill, evidence, title, explanation, alternatives, corrections, positive, progress_status, dismissed, created_at)
      ),
      exercises(id, answer_text, duration_seconds, completed_at, metrics, coaching, exercise_attempts(id, transcript, duration_seconds, completed_at, metrics)),
      session_summaries(summary, strengths, opportunities)
    `)
    .eq('user_id', context.userId)
    .eq('goal_id', goalId)
    .eq('status', 'completed')
    .order('completed_at', { ascending: true });
  if (error) return databaseError(error);

  const sessions = (data ?? []) as unknown as SessionRow[];
  const allFeedback: DashboardFeedbackItem[] = [];
  const speakingActivity: GoalDashboard['speakingActivity'] = [];
  const fillerTotals = new Map<string, number>();
  const openingTotals = new Map<string, number>();
  const allWords: string[] = [];
  const wordsBySession = new Map<string, string[]>();
  const lessons: GoalLessonInsight[] = [];
  const previouslyObservedLessonWords = new Set<string>();
  const cumulativeVocabularyWords = new Set<string>();
  const vocabularySizeHistory: GoalLessonInsight['vocabulary']['sizeHistory'] = [];
  let completedLessonsSeen = 0;
  let completedAnswerCount = 0;

  for (const session of sessions) {
    const sessionWords: string[] = [];
    const lessonWords: string[] = [];
    const lessonPrompts: string[] = [];
    const lessonFeedback: DashboardFeedbackItem[] = [];
    const lessonFillerTotals = new Map<string, number>();
    const lessonOpeningTotals = new Map<string, number>();
    let lessonAnswerCount = 0;
    let lessonSpeakingSeconds = 0;
    let lessonFillerCount = 0;
    for (const response of asArray(session.responses).sort((a, b) => a.sequence_number - b.sequence_number)) {
      if (response.status !== 'completed') continue;
      completedAnswerCount += 1;
      lessonAnswerCount += 1;
      const words = wordsFrom(response.transcript);
      const responseMetrics = asArray(response.response_metrics);
      const responseFillerCount = responseMetrics.reduce((sum, metric) => sum + metric.filler_count, 0);
      allWords.push(...words);
      sessionWords.push(...words);
      lessonWords.push(...words);
      lessonSpeakingSeconds += response.duration_seconds;
      lessonFillerCount += responseFillerCount;
      if (response.prompt && !lessonPrompts.includes(response.prompt)) lessonPrompts.push(response.prompt);
      if (words.length >= 2) {
        const opening = words.slice(0, Math.min(3, words.length)).join(' ');
        openingTotals.set(opening, (openingTotals.get(opening) ?? 0) + 1);
        lessonOpeningTotals.set(opening, (lessonOpeningTotals.get(opening) ?? 0) + 1);
      }
      if (response.duration_seconds > 0) {
        speakingActivity.push({
          id: response.id,
          occurredAt: response.created_at,
          durationSeconds: response.duration_seconds,
          fillerCount: responseFillerCount,
          kind: 'answer',
        });
      }
      for (const metric of responseMetrics) {
        for (const [phrase, count] of Object.entries(recordOfNumbers(metric.filler_words))) {
          fillerTotals.set(phrase, (fillerTotals.get(phrase) ?? 0) + count);
          lessonFillerTotals.set(phrase, (lessonFillerTotals.get(phrase) ?? 0) + count);
        }
      }
      for (const item of asArray(response.feedback_items)) {
        if (item.dismissed) continue;
        const feedbackItem: DashboardFeedbackItem = {
          id: item.id,
          responseId: response.id,
          sessionId: session.id,
          createdAt: item.created_at,
          dimension: item.dimension,
          skill: item.skill,
          evidence: item.evidence,
          title: item.title,
          explanation: item.explanation,
          alternatives: stringArray(item.alternatives),
          corrections: correctionArray(item.corrections),
          positive: item.positive,
          progressStatus: item.progress_status ?? 'baseline',
        };
        allFeedback.push(feedbackItem);
        lessonFeedback.push(feedbackItem);
      }
    }

    if (lessonAnswerCount > 0) {
      lessonFeedback.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
      const lessonWordCounts = new Map<string, number>();
      const lessonMeaningfulWords = new Set<string>();
      for (const word of lessonWords) {
        if (word.length < 3 || stopWords.has(word)) continue;
        lessonMeaningfulWords.add(word);
        lessonWordCounts.set(word, (lessonWordCounts.get(word) ?? 0) + 1);
      }
      const newlyObservedLessonWords = previouslyObservedLessonWords.size > 0 && lessonMeaningfulWords.size > 0
        ? [...lessonMeaningfulWords].filter((word) => !previouslyObservedLessonWords.has(word)).length
        : null;
      lessonMeaningfulWords.forEach((word) => previouslyObservedLessonWords.add(word));

      const lessonVocabularyFeedback = lessonFeedback.filter((item) => item.dimension === 'Vocabulary');
      const lessonGrammarFeedback = lessonFeedback.filter((item) => item.dimension === 'Sentence structure');
      const lessonFluencyFeedback = lessonFeedback.filter((item) => (
        /fluenc|pace|filler|verbal|repeat|opening|hesitat/i.test(`${item.skill ?? ''} ${item.title} ${item.explanation}`)
      ));
      const savedSummary = asArray(session.session_summaries).at(-1)?.summary ?? null;
      const lessonTitle = lessonPrompts[0] ?? session.title;
      lessonWords.filter(isVocabularyWord).forEach((word) => cumulativeVocabularyWords.add(word));
      vocabularySizeHistory.push({
        sessionId: session.id,
        completedAt: session.completed_at ?? '',
        uniqueWords: cumulativeVocabularyWords.size,
      });

      lessons.push({
        id: session.id,
        title: lessonTitle,
        completedAt: session.completed_at ?? '',
        prompts: lessonPrompts,
        answerCount: lessonAnswerCount,
        speakingSeconds: lessonSpeakingSeconds,
        summary: savedSummary,
        vocabulary: {
          totalWords: lessonWords.length,
          uniqueWords: new Set(lessonWords.filter(isVocabularyWord)).size,
          vocabularySize: cumulativeVocabularyWords.size,
          sizeHistory: [...vocabularySizeHistory],
          newlyObservedWords: newlyObservedLessonWords,
          comparisonLabel: newlyObservedLessonWords === null
            ? null
            : `Compared with ${completedLessonsSeen} earlier ${completedLessonsSeen === 1 ? 'lesson' : 'lessons'}`,
          repeatedWords: [...lessonWordCounts.entries()]
            .filter(([, count]) => count >= 2)
            .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
            .slice(0, 8)
            .map(([word, count]) => ({ word, count })),
          strengths: lessonVocabularyFeedback.filter((item) => item.positive),
          improvements: lessonVocabularyFeedback.filter((item) => !item.positive),
        },
        grammar: {
          strengths: lessonGrammarFeedback.filter((item) => item.positive),
          improvements: lessonGrammarFeedback.filter((item) => !item.positive),
        },
        fluency: {
          averageWpm: lessonSpeakingSeconds > 0 ? Math.round((lessonWords.length * 60) / lessonSpeakingSeconds) : 0,
          fillerCount: lessonFillerCount,
          fillerRatePer100Words: lessonWords.length > 0 ? Number(((lessonFillerCount / lessonWords.length) * 100).toFixed(1)) : 0,
          commonFillers: [...lessonFillerTotals.entries()]
            .sort((a, b) => b[1] - a[1])
            .slice(0, 8)
            .map(([phrase, count]) => ({ phrase, count })),
          repeatedOpenings: [...lessonOpeningTotals.entries()]
            .filter(([, count]) => count >= 2)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 5)
            .map(([phrase, count]) => ({ phrase, count })),
          feedback: lessonFluencyFeedback,
        },
        communicationFeedback: lessonFeedback.filter((item) => (
          item.dimension === 'What worked'
          || item.dimension === 'Communication effectiveness'
          || item.dimension === 'Critical thinking'
        )),
      });
      completedLessonsSeen += 1;
    }

    for (const exercise of asArray(session.exercises)) {
      const attempts = asArray(exercise.exercise_attempts).filter((attempt) => Boolean(attempt.completed_at && attempt.transcript));
      if (attempts.length) {
        for (const attempt of attempts) {
          const words = wordsFrom(attempt.transcript);
          const metrics = metricFrom(attempt.metrics);
          allWords.push(...words);
          sessionWords.push(...words);
          if (words.length >= 2) {
            const opening = words.slice(0, Math.min(3, words.length)).join(' ');
            openingTotals.set(opening, (openingTotals.get(opening) ?? 0) + 1);
          }
          if (attempt.duration_seconds > 0) {
            speakingActivity.push({
              id: attempt.id,
              occurredAt: attempt.completed_at ?? '',
              durationSeconds: attempt.duration_seconds,
              fillerCount: metrics.fillerCount ?? 0,
              kind: 'exercise',
            });
          }
          for (const [phrase, count] of Object.entries(metrics.fillerWords ?? {})) {
            fillerTotals.set(phrase, (fillerTotals.get(phrase) ?? 0) + count);
          }
        }
        continue;
      }
      if (!exercise.completed_at || !exercise.answer_text) continue;
      const words = wordsFrom(exercise.answer_text);
      const metrics = metricFrom(exercise.metrics);
      allWords.push(...words);
      sessionWords.push(...words);
      if (words.length >= 2) {
        const opening = words.slice(0, Math.min(3, words.length)).join(' ');
        openingTotals.set(opening, (openingTotals.get(opening) ?? 0) + 1);
      }
      if (exercise.duration_seconds > 0) {
        speakingActivity.push({
          id: exercise.id,
          occurredAt: exercise.completed_at,
          durationSeconds: exercise.duration_seconds,
          fillerCount: metrics.fillerCount ?? 0,
          kind: 'exercise',
        });
      }
      for (const [phrase, count] of Object.entries(metrics.fillerWords ?? {})) {
        fillerTotals.set(phrase, (fillerTotals.get(phrase) ?? 0) + count);
      }
      coachingFeedback(exercise.coaching).forEach((item, index) => {
        allFeedback.push({
          id: `exercise-${exercise.id}-${index}`,
          responseId: null,
          sessionId: session.id,
          createdAt: exercise.completed_at ?? '',
          dimension: item.dimension,
          skill: item.skill,
          evidence: item.evidence ?? '',
          title: item.title ?? item.skill ?? item.dimension,
          explanation: item.explanation ?? '',
          alternatives: stringArray(item.alternatives),
          corrections: correctionArray(item.corrections),
          positive: item.positive,
        });
      });
    }
    wordsBySession.set(session.id, sessionWords);
  }

  allFeedback.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  speakingActivity.sort((a, b) => a.occurredAt.localeCompare(b.occurredAt));
  const totalSpeakingSeconds = speakingActivity.reduce((sum, item) => sum + item.durationSeconds, 0);
  const wordCounts = new Map<string, number>();
  for (const word of allWords) {
    if (word.length < 3 || stopWords.has(word)) continue;
    wordCounts.set(word, (wordCounts.get(word) ?? 0) + 1);
  }
  const repeatedWords = [...wordCounts.entries()]
    .filter(([, count]) => count >= 2)
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, 8)
    .map(([word, count]) => ({ word, count }));

  let newlyObservedWords: number | null = null;
  let comparisonLabel: string | null = null;
  const latestSession = sessions.at(-1);
  if (latestSession && sessions.length >= 2) {
    const earlierWords = new Set(
      sessions.slice(0, -1).flatMap((session) => wordsBySession.get(session.id) ?? []).filter((word) => word.length >= 3 && !stopWords.has(word)),
    );
    const latestWords = new Set((wordsBySession.get(latestSession.id) ?? []).filter((word) => word.length >= 3 && !stopWords.has(word)));
    if (earlierWords.size > 0 && latestWords.size > 0) {
      newlyObservedWords = [...latestWords].filter((word) => !earlierWords.has(word)).length;
      comparisonLabel = `Compared with ${sessions.length - 1} earlier ${sessions.length === 2 ? 'session' : 'sessions'}`;
    }
  }

  const summaryFeedback = allFeedback.filter((item) => (
    item.dimension === 'What worked' || item.dimension === 'Communication effectiveness' || item.dimension === 'Critical thinking'
  ));
  const strength = summaryFeedback.find((item) => item.positive) ?? allFeedback.find((item) => item.positive) ?? null;
  const improvement = summaryFeedback.find((item) => !item.positive) ?? allFeedback.find((item) => !item.positive) ?? null;
  const recurringStrength = findRecurring(summaryFeedback.filter((item) => item.positive));
  const recurringImprovement = findRecurring(summaryFeedback.filter((item) => !item.positive));
  const summaries = sessions.flatMap((session) => asArray(session.session_summaries).map((summary) => ({ ...summary, sessionId: session.id })));
  const latestSummary = summaries.at(-1);
  let overviewText: string | null = null;
  if (recurringStrength || recurringImprovement) {
    const parts = [`Across ${sessions.length} completed ${sessions.length === 1 ? 'session' : 'sessions'}, your saved coaching`];
    if (recurringStrength) parts.push(`repeatedly recognizes ${recurringStrength.label.toLocaleLowerCase()}`);
    if (recurringImprovement) parts.push(`${recurringStrength ? 'and' : 'repeatedly'} identifies ${recurringImprovement.label.toLocaleLowerCase()} as a useful next focus`);
    overviewText = `${parts.join(' ')}.`;
  } else if (latestSummary?.summary) {
    overviewText = sessions.length === 1
      ? `Your first completed session gives an initial picture: ${latestSummary.summary}`
      : `Your most recent saved coaching notes: ${latestSummary.summary}`;
  } else if (strength || improvement) {
    overviewText = [
      sessions.length === 1 ? 'Your first completed answer gives an initial picture.' : `This view is based on ${completedAnswerCount} completed answers.`,
      strength ? `${strength.title}: ${strength.explanation}` : null,
      improvement ? `Next focus — ${improvement.title}: ${improvement.explanation}` : null,
    ].filter(Boolean).join(' ');
  }

  let progress: string | null = null;
  const chronological = [...allFeedback].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  for (const item of chronological.filter((feedback) => feedback.positive).reverse()) {
    const key = (item.skill?.trim() || item.title.trim()).toLocaleLowerCase();
    const earlierOpportunity = chronological.find((feedback) => (
      !feedback.positive
      && feedback.createdAt < item.createdAt
      && (feedback.skill?.trim() || feedback.title.trim()).toLocaleLowerCase() === key
    ));
    if (earlierOpportunity) {
      progress = `Recent feedback recognizes ${item.skill || item.title} after earlier coaching identified the same skill as an opportunity.`;
      break;
    }
  }

  if (latestSummary && overviewText && !strength && !improvement) {
    const savedStrength = summaryPatterns(latestSummary.strengths)[0];
    const savedOpportunity = summaryPatterns(latestSummary.opportunities)[0];
    if (savedStrength) overviewText += ` Strength: ${savedStrength.title} — ${savedStrength.detail}`;
    if (savedOpportunity) overviewText += ` Next focus: ${savedOpportunity.title} — ${savedOpportunity.detail}`;
  }

  const vocabularyFeedback = allFeedback.filter((item) => item.dimension === 'Vocabulary');
  const grammarFeedback = allFeedback.filter((item) => item.dimension === 'Sentence structure');
  const fluencyFeedback = allFeedback.filter((item) => (
    /fluenc|pace|filler|verbal|repeat|opening|hesitat/i.test(`${item.skill ?? ''} ${item.title} ${item.explanation}`)
  ));
  const fillerCount = [...fillerTotals.values()].reduce((sum, count) => sum + count, 0);
  const averageWpm = totalSpeakingSeconds > 0 ? Math.round((allWords.length * 60) / totalSpeakingSeconds) : 0;
  const frameworkAliases: Record<string, RegExp> = {
    'five-second-moment': /five-second|turning point|realization|change in perspective/i,
    'start-close-to-action': /close to the action|context efficiently|opening|set the scene/i,
    stakes: /stakes|tension|why (?:it|this) matter/i,
    'beginning-ending-contrast': /beginning.{0,20}ending|contrast|meaningful takeaway|how you (?:changed|work today)/i,
  };
  const storytellingFramework = goalDefinition?.evaluationFramework
    ? {
        name: goalDefinition.evaluationFramework.name,
        description: goalDefinition.evaluationFramework.description,
        criteria: goalDefinition.evaluationFramework.criteria.map((criterion) => {
          const exactTitle = criterion.title.toLocaleLowerCase();
          const exactEvaluation = allFeedback.find((item) => (
            item.dimension === criterion.feedbackDimension
            && item.skill?.trim().toLocaleLowerCase() === exactTitle
          ));
          const titleEvaluation = allFeedback.find((item) => item.skill?.trim().toLocaleLowerCase() === exactTitle);
          const alias = frameworkAliases[criterion.id];
          const legacyEvaluation = alias
            ? allFeedback.find((item) => alias.test(`${item.skill ?? ''} ${item.title} ${item.explanation}`))
            : undefined;
          return {
            id: criterion.id,
            title: criterion.title,
            description: criterion.description,
            evaluation: exactEvaluation ?? titleEvaluation ?? legacyEvaluation ?? null,
          };
        }),
      }
    : undefined;

  const dashboard: GoalDashboard = {
    goalId,
    sessionCount: sessions.length,
    completedAnswerCount,
    lastPractised: sessions.at(-1)?.completed_at ?? null,
    totalSpeakingSeconds,
    speakingActivity,
    overview: {
      text: overviewText,
      strength,
      improvement,
      progress,
      supportingSessionIds: [...new Set([
        ...(strength ? [strength.sessionId] : []),
        ...(improvement ? [improvement.sessionId] : []),
        ...(latestSummary ? [latestSummary.sessionId] : []),
      ])],
    },
    storytellingFramework,
    vocabulary: {
      totalWords: allWords.length,
      uniqueWords: new Set(allWords.filter(isVocabularyWord)).size,
      newlyObservedWords,
      comparisonLabel,
      repeatedWords,
      strengths: vocabularyFeedback.filter((item) => item.positive),
      improvements: vocabularyFeedback.filter((item) => !item.positive),
    },
    grammar: {
      strengths: grammarFeedback.filter((item) => item.positive),
      improvements: grammarFeedback.filter((item) => !item.positive),
    },
    fluency: {
      averageWpm,
      fillerCount,
      fillerRatePer100Words: allWords.length > 0 ? Number(((fillerCount / allWords.length) * 100).toFixed(1)) : 0,
      commonFillers: [...fillerTotals.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, 8)
        .map(([phrase, count]) => ({ phrase, count })),
      repeatedOpenings: [...openingTotals.entries()]
        .filter(([, count]) => count >= 2)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([phrase, count]) => ({ phrase, count })),
      feedback: fluencyFeedback,
    },
    lessons: lessons.sort((a, b) => b.completedAt.localeCompare(a.completedAt)),
  };

  return NextResponse.json({ dashboard });
}

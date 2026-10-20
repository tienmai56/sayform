import { getGoalDefinition } from '@/lib/goal-catalog';
import { feedbackItems, transcript } from '@/lib/mock-data';
import type { FeedbackDimension, SummaryPattern } from '@/lib/types';

const transcriptText = `${transcript.before}${transcript.vague}${transcript.middle}${transcript.repeated}${transcript.after}`;

type AnalysisContext = {
  goalTemplateKey?: string | null;
  skillFocus?: string;
};

const skillByDimension: Record<string, Record<FeedbackDimension, string>> = {
  clarity: {
    Vocabulary: 'Use precise language',
    'Sentence structure': 'Be concise and direct',
    'Communication effectiveness': 'Lead with the main point',
    'Critical thinking': 'Build a logical flow',
    'What worked': 'Lead with the main point',
  },
  negotiation: {
    Vocabulary: 'Frame tradeoffs and concessions',
    'Sentence structure': 'State your position and outcome',
    'Communication effectiveness': 'Close with a clear next step',
    'Critical thinking': 'Respond to objections',
    'What worked': 'State your position and outcome',
  },
  storytelling: {
    Vocabulary: 'Choose relevant details',
    'Sentence structure': 'Land the turning point',
    'Communication effectiveness': 'End with a meaningful takeaway',
    'Critical thinking': 'Create stakes or tension',
    'What worked': 'Establish context efficiently',
  },
};

export type MockAnalysis = ReturnType<typeof createMockAnalysis>;

export function createMockAnalysis(durationSeconds: number, context: AnalysisContext = {}) {
  const words = transcriptText.trim().split(/\s+/);
  const normalized = words.map((word) => word.toLowerCase().replace(/[^a-z']/g, '')).filter(Boolean);
  const fillerWords = normalized.filter((word) => ['like', 'actually', 'basically'].includes(word));
  const safeDuration = Math.max(durationSeconds, 76);
  const definition = getGoalDefinition(context.goalTemplateKey);
  const focusedSkill = definition?.skills.find((skill) => skill.id === context.skillFocus)?.title;
  const dimensionMap = skillByDimension[context.goalTemplateKey ?? 'clarity'] ?? skillByDimension.clarity;

  return {
    transcript: transcriptText,
    metrics: {
      wordCount: words.length,
      uniqueWordCount: new Set(normalized).size,
      averageWpm: Math.round(words.length / (safeDuration / 60)),
      fillerCount: fillerWords.length + 3,
      fillerWords: { like: fillerWords.filter((word) => word === 'like').length, contextual: 3 },
    },
    feedback: feedbackItems.map((item) => ({
      ...item,
      skill: focusedSkill ?? dimensionMap[item.dimension],
    })),
  };
}

type SavedFeedback = {
  id: string;
  responseId: string;
  dimension: FeedbackDimension;
  evidence: string;
  title: string;
  explanation: string;
  positive: boolean;
  dismissed: boolean;
  skill: string;
};

type SessionSummaryInput = {
  goalTitle: string;
  goalTemplateKey?: string | null;
  skillFocus?: string;
  answerCount: number;
  feedback: SavedFeedback[];
};

function mostFrequent(items: SavedFeedback[]) {
  const groups = new Map<string, SavedFeedback[]>();
  for (const item of items) groups.set(item.title, [...(groups.get(item.title) ?? []), item]);
  return [...groups.values()].sort((left, right) => right.length - left.length)[0] ?? [];
}

function patternFrom(items: SavedFeedback[], fallback: SummaryPattern): SummaryPattern {
  const representative = items[0];
  if (!representative) return fallback;
  return {
    title: representative.title,
    detail: representative.explanation,
    evidence: representative.evidence,
    responseIds: [...new Set(items.map((item) => item.responseId))],
  };
}

function exerciseCopy(templateKey: string | null | undefined, targetSkill: string, evidence: string) {
  if (templateKey === 'negotiation') {
    return {
      title: 'Turn the position into a workable proposal',
      prompt: `Respond again in three parts: state the desired outcome, name one tradeoff, and propose a next step. Improve this evidence without changing its meaning: “${evidence}”`,
    };
  }
  if (templateKey === 'storytelling') {
    return {
      title: 'Shape the moment into a clear story beat',
      prompt: `Retell this idea with brief context, one turning point, and a useful takeaway. Keep the meaning of: “${evidence}”`,
    };
  }
  return {
    title: 'Make the message concrete',
    prompt: `Restate this idea in two direct sentences. Lead with the point and replace broad language with a specific consequence: “${evidence}”`,
  };
}

export function createMockSessionSummary(input: SessionSummaryInput) {
  const activeFeedback = input.feedback.filter((item) => !item.dismissed);
  const strengthItems = mostFrequent(activeFeedback.filter((item) => item.positive));
  const opportunityItems = mostFrequent(activeFeedback.filter((item) => !item.positive));
  const strength = patternFrom(strengthItems, {
    title: 'Your main point was easy to find',
    detail: 'The response gave listeners a clear frame before adding supporting detail.',
  });
  const opportunity = patternFrom(opportunityItems, {
    title: 'Make the language more specific',
    detail: 'Replace broad wording with the actual cost, risk, behavior, or result.',
    evidence: 'kind of a big problem',
  });
  const definition = getGoalDefinition(input.goalTemplateKey);
  const selectedSkill = definition?.skills.find((skill) => skill.id === input.skillFocus)?.title;
  const targetSkill = selectedSkill ?? opportunityItems[0]?.skill ?? definition?.skills[0]?.title ?? 'Communicate with greater precision';
  const sourceEvidence = opportunity.evidence ?? 'kind of a big problem';
  const exercise = exerciseCopy(input.goalTemplateKey, targetSkill, sourceEvidence);
  const occurrenceCount = Math.max(1, opportunityItems.length);

  return {
    headline: strength.title,
    summary: `Across ${input.answerCount} ${input.answerCount === 1 ? 'answer' : 'answers'}, ${strength.detail.charAt(0).toLowerCase()}${strength.detail.slice(1)} The clearest next step for “${input.goalTitle}” is ${targetSkill.toLowerCase()}.`,
    strengths: [strength],
    opportunities: [opportunity],
    takeaway: `In your next response, focus on ${targetSkill.toLowerCase()} and make the change visible in one specific sentence.`,
    exercise: {
      ...exercise,
      targetSkill,
      sourceEvidence,
      sourceFeedbackItemId: opportunityItems[0]?.id ?? null,
      sourceResponseId: opportunityItems[0]?.responseId ?? null,
      selectionReason: `${targetSkill} was selected because the related pattern appeared in ${occurrenceCount} saved feedback ${occurrenceCount === 1 ? 'item' : 'items'} from this session.`,
    },
  };
}

export const mockSessionSummary = {
  summary: 'Your recommendation arrived early and made the answer easy to follow.',
  strengths: [{ title: 'Your position arrives before the explanation', detail: 'A direct choice gives listeners a clear frame.' }],
  opportunities: [{ title: 'Name the consequence instead of its size', detail: 'Replace broad phrases with the actual cost, risk, or behavior.' }],
  takeaway: 'Lead with the decision, then name one consequence and one boundary.',
  exercise: {
    title: 'Make the consequence concrete',
    prompt: 'Rephrase this idea in one clear sentence using a specific consequence.',
    sourceEvidence: 'kind of a big problem',
  },
};

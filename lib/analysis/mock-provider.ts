import { getGoalDefinition } from '@/lib/goal-catalog';
import { getExerciseTemplate } from '@/lib/exercise-library';
import { feedbackItems, transcript } from '@/lib/mock-data';
import type { FeedbackDimension, SummaryPattern } from '@/lib/types';

const transcriptText = `${transcript.before}${transcript.vague}${transcript.middle}${transcript.repeated}${transcript.after}`;

type AnalysisContext = {
  goalTemplateKey?: string | null;
};

const skillByDimension: Record<string, Record<FeedbackDimension, string>> = {
  clarity: {
    Vocabulary: 'Show impact with evidence',
    'Sentence structure': 'Provide a clear conclusion',
    'Communication effectiveness': 'Answer the actual question',
    'Critical thinking': 'Make the reasoning easy to follow',
    'What worked': 'Structure a compelling example',
  },
  negotiation: {
    Vocabulary: 'Frame tradeoffs and concessions',
    'Sentence structure': 'State your position and outcome',
    'Communication effectiveness': 'Close with a clear next step',
    'Critical thinking': 'Respond to objections',
    'What worked': 'Surface interests and constraints',
  },
  storytelling: {
    Vocabulary: 'Beginning-to-ending contrast',
    'Sentence structure': 'Start close to the action',
    'Communication effectiveness': 'Five-second moment',
    'Critical thinking': 'Meaningful stakes',
    'What worked': 'Five-second moment',
  },
};

export type MockAnalysis = ReturnType<typeof createMockAnalysis>;

export function createMockAnalysis(durationSeconds: number, context: AnalysisContext = {}) {
  const words = transcriptText.trim().split(/\s+/);
  const normalized = words.map((word) => word.toLowerCase().replace(/[^a-z']/g, '')).filter(Boolean);
  const fillerWords = normalized.filter((word) => ['like', 'actually', 'basically'].includes(word));
  const safeDuration = Math.max(durationSeconds, 76);
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
      skill: dimensionMap[item.dimension],
      progressStatus: 'baseline' as const,
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
  const exerciseTemplate = getExerciseTemplate(templateKey === 'negotiation' ? 'E2' : templateKey === 'storytelling' ? 'E3' : 'E1');
  if (templateKey === 'negotiation') {
    return {
      template: exerciseTemplate,
      prompt: `Respond again in three parts: state the desired outcome, name one tradeoff, and propose a next step. Improve this evidence without changing its meaning: “${evidence}”`,
    };
  }
  if (templateKey === 'storytelling') {
    return {
      template: exerciseTemplate,
      prompt: `Retell this idea with brief context, one turning point, and a useful takeaway. Keep the meaning of: “${evidence}”`,
    };
  }
  return {
    template: exerciseTemplate,
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
  const targetSkill = opportunityItems[0]?.skill ?? definition?.skills[0]?.title ?? 'Communicate with greater precision';
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
      templateId: exercise.template.id,
      skillId: exercise.template.skillId,
      title: exercise.template.title,
      targetSkill: exercise.template.targetSkill,
      targetBehavior: targetSkill,
      behaviorCode: exercise.template.behaviorCode,
      sourceEvidence,
      sourceFeedbackItemId: opportunityItems[0]?.id ?? null,
      sourceResponseId: opportunityItems[0]?.responseId ?? null,
      selectionReason: `${targetSkill} was selected because the related pattern appeared in ${occurrenceCount} saved feedback ${occurrenceCount === 1 ? 'item' : 'items'} from this session.`,
      instructions: exercise.template.instructions,
      estimatedMinutes: exercise.template.estimatedMinutes,
      prompt: exercise.prompt,
      guidance: exercise.template.levelGuidance[0],
      difficultyLevel: 1,
      diagnosisSupported: Boolean(opportunityItems[0]),
    },
  };
}

export const mockSessionSummary = {
  summary: 'Your recommendation arrived early and made the answer easy to follow.',
  strengths: [{ title: 'Your position arrives before the explanation', detail: 'A direct choice gives listeners a clear frame.' }],
  opportunities: [{ title: 'Name the consequence instead of its size', detail: 'Replace broad phrases with the actual cost, risk, or behavior.' }],
  takeaway: 'Lead with the decision, then name one consequence and one boundary.',
  exercise: {
    templateId: 'E1',
    skillId: 'S1',
    title: 'Answer First',
    targetSkill: 'Structuring thoughts',
    targetBehavior: 'State the main point before background detail.',
    behaviorCode: 'state_main_point_first',
    selectionReason: 'The direct answer arrived after background detail.',
    instructions: ['State the answer first.', 'Add up to two supporting points.'],
    estimatedMinutes: 4,
    prompt: 'Rephrase this idea in one clear sentence using a specific consequence.',
    guidance: 'Use: answer first, then reason one and reason two.',
    difficultyLevel: 1,
    sourceEvidence: 'kind of a big problem',
    status: 'recommended',
  },
};

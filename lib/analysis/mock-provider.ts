import { feedbackItems, transcript } from '@/lib/mock-data';

const transcriptText = `${transcript.before}${transcript.vague}${transcript.middle}${transcript.repeated}${transcript.after}`;

export type MockAnalysis = ReturnType<typeof createMockAnalysis>;

export function createMockAnalysis(durationSeconds: number) {
  const words = transcriptText.trim().split(/\s+/);
  const normalized = words.map((word) => word.toLowerCase().replace(/[^a-z']/g, '')).filter(Boolean);
  const fillerWords = normalized.filter((word) => ['like', 'actually', 'basically'].includes(word));
  const safeDuration = Math.max(durationSeconds, 76);

  return {
    transcript: transcriptText,
    metrics: {
      wordCount: words.length,
      uniqueWordCount: new Set(normalized).size,
      averageWpm: Math.round(words.length / (safeDuration / 60)),
      fillerCount: fillerWords.length + 3,
      fillerWords: { like: fillerWords.filter((word) => word === 'like').length, contextual: 3 },
    },
    feedback: feedbackItems,
  };
}

export const mockSessionSummary = {
  summary:
    'Your recommendation arrived early and made the answer easy to follow. The clearest next step is replacing broad language with specific consequences.',
  strengths: [
    {
      title: 'Your position arrives before the explanation',
      detail: 'A direct choice gives listeners a clear frame for the reasons that follow.',
    },
  ],
  opportunities: [
    {
      title: 'Name the consequence instead of its size',
      detail: 'Replace broad phrases with the actual cost, risk, or behavior.',
    },
  ],
  takeaway: 'Lead with the decision, then name one consequence and one boundary.',
  exercise: {
    title: 'Make the consequence concrete',
    prompt:
      'Rephrase this idea in one clear sentence using a specific consequence: “Moving too quickly creates kind of a big problem later.”',
    sourceEvidence: 'moving fast without a stable foundation creates kind of a big problem later',
  },
};

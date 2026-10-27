import type { FeedbackItem, PracticeSession } from '@/lib/types';

export const categories = [
  {
    id: 'storytelling',
    title: 'Personal storytelling',
    description: 'Experiences, takeaways, and moments that changed your mind.',
  },
  {
    id: 'persuasion',
    title: 'Opinions & persuasion',
    description: 'Take a position and make a thoughtful case for it.',
  },
  {
    id: 'professional',
    title: 'Professional communication',
    description: 'Explain decisions, updates, proposals, and tradeoffs.',
  },
  {
    id: 'spontaneous',
    title: 'Spontaneous thinking',
    description: 'Respond to an unfamiliar prompt with composure.',
  },
];

export const feedbackItems: FeedbackItem[] = [
  {
    id: 'vague-language',
    dimension: 'Vocabulary',
    evidence: 'kind of a big problem',
    title: 'Replace vague scale with a precise consequence',
    explanation:
      '“Kind of” softens the claim, while “big problem” leaves the consequence unspecified. Name what reliability risk would actually do to the team or customer.',
    alternatives: [
      'a material risk to customer trust',
      'a costly source of support incidents',
      'a constraint on sustainable growth',
    ],
  },
  {
    id: 'repeated-opening',
    dimension: 'Sentence structure',
    evidence: 'I think',
    title: 'Vary the repeated opening',
    explanation:
      'You use “I think” three times in a short span. The position is already clearly yours, so the later repetitions make the delivery feel tentative.',
    alternatives: ['My recommendation is…', 'The key tradeoff is…', 'For that reason…'],
  },
  {
    id: 'main-point',
    dimension: 'Communication effectiveness',
    evidence: 'I would choose reliability first',
    title: 'Your recommendation arrives early',
    explanation:
      'You state the choice in the first sentence, which makes the rest of the answer easy to interpret. Keep this claim-first structure.',
    positive: true,
  },
  {
    id: 'counterargument',
    dimension: 'Critical thinking',
    evidence: 'speed matters for learning',
    title: 'Resolve the strongest counterargument',
    explanation:
      'You acknowledge why speed matters but do not explain when speed should regain priority. Add a condition that would change your recommendation.',
    alternatives: [
      'Once incident volume is stable for two releases, I would shift the balance back toward speed.',
      'If the reliability work delayed a time-sensitive market test, I would narrow the scope instead of pausing it entirely.',
    ],
  },
  {
    id: 'clear-close',
    dimension: 'What worked',
    evidence: 'return to faster experiments with a clearer baseline',
    title: 'Your ending gives the listener a path forward',
    explanation:
      'The closing connects the recommendation to what happens next. This makes the answer feel complete and helps the listener see how the decision can evolve.',
    positive: true,
  },
];

export const transcript = {
  before:
    'I would choose reliability first. We have already learned that moving fast without a stable foundation creates ',
  vague: 'kind of a big problem',
  middle:
    ' later. I think speed matters for learning, but I think reliability protects customer trust and gives the team more confidence. ',
  repeated: 'I think',
  after:
    ' we should spend this quarter fixing the highest-impact failure points, then return to faster experiments with a clearer baseline.',
};

export const sessions: PracticeSession[] = [
  {
    id: 'oct-20-clarity',
    date: 'Oct 20, 2026 · 9:42 AM',
    goal: 'Express complex ideas clearly',
    categories: ['Professional communication', 'Opinions & persuasion'],
    duration: '9 min',
    answers: 3,
    averageWpm: 132,
    fillerCount: 5,
    title: 'Explaining tradeoffs under pressure',
    takeaway: 'Lead with the decision, then name one consequence and one boundary.',
    hasExercise: true,
  },
  {
    id: 'oct-16-persuasion',
    date: 'Oct 16, 2026 · 4:18 PM',
    goal: 'Be more persuasive',
    categories: ['Opinions & persuasion'],
    duration: '11 min',
    answers: 4,
    averageWpm: 148,
    fillerCount: 8,
    title: 'Making a case for asynchronous work',
    takeaway: 'Use the strongest evidence before qualifying the recommendation.',
    hasExercise: false,
  },
  {
    id: 'oct-12-clarity',
    date: 'Oct 12, 2026 · 8:05 AM',
    goal: 'Express complex ideas clearly',
    categories: ['Spontaneous thinking'],
    duration: '7 min',
    answers: 2,
    averageWpm: 119,
    fillerCount: 3,
    title: 'Responding to an unfamiliar product prompt',
    takeaway: 'Pause once, choose a structure, and avoid restarting the opening.',
    hasExercise: true,
  },
];

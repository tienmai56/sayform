export type GoalStatus = 'active' | 'completed' | 'archived';

export type Goal = {
  id: string;
  title: string;
  description: string;
  status: GoalStatus;
  lastPractised: string | null;
  sessions: number;
  recommended?: boolean;
};

export type FeedbackDimension =
  | 'Vocabulary'
  | 'Sentence structure'
  | 'Communication effectiveness'
  | 'Critical thinking'
  | 'What worked';

export type FeedbackItem = {
  id: string;
  dimension: FeedbackDimension;
  evidence: string;
  title: string;
  explanation: string;
  alternatives?: string[];
  positive?: boolean;
};

export type PracticeSession = {
  id: string;
  date: string;
  goal: string;
  categories: string[];
  duration: string;
  answers: number;
  averageWpm: number;
  fillerCount: number;
  title: string;
  takeaway: string;
  hasExercise: boolean;
};

export type SessionDetail = PracticeSession & {
  prompt: string;
  transcript: string;
  feedbackTitle: string;
  feedbackExplanation: string;
  summary: string;
  exerciseTitle?: string;
};

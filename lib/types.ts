export type GoalStatus = 'active' | 'completed' | 'archived';

export type GoalSkill = {
  id: string;
  title: string;
  description: string;
};

export type Goal = {
  id: string;
  templateKey: string | null;
  isCustom: boolean;
  title: string;
  description: string;
  skills: GoalSkill[];
  defaultCategory: string;
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
  skill?: string;
  evidence: string;
  title: string;
  explanation: string;
  alternatives?: string[];
  positive?: boolean;
};

export type ResponseMetrics = {
  wordCount: number;
  uniqueWordCount: number;
  averageWpm: number;
  fillerCount: number;
  fillerWords: Record<string, number>;
};

export type ResponseAnalysis = {
  transcript: string;
  durationSeconds: number;
  metrics: ResponseMetrics;
  feedback: FeedbackItem[];
};

export type SummaryPattern = {
  title: string;
  detail: string;
  evidence?: string;
  responseIds?: string[];
};

export type ExerciseRecommendation = {
  id: string;
  title: string;
  targetSkill: string;
  selectionReason: string;
  prompt: string;
  sourceEvidence: string;
};

export type FinishedSession = {
  session: {
    id: string;
    status: 'completed';
    answers: number;
    durationSeconds: number;
    wordCount: number;
    averageWpm: number;
    fillerCount: number;
  };
  summary: {
    headline: string;
    summary: string;
    strengths: SummaryPattern[];
    opportunities: SummaryPattern[];
    takeaway: string;
  };
  exercise: ExerciseRecommendation | null;
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
  exerciseTargetSkill?: string;
  exerciseReason?: string;
  exerciseEvidence?: string;
};

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
  isActive: boolean;
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

export type FeedbackCorrection = {
  evidence: string;
  suggestion: string;
};

export type FeedbackProgressStatus = 'baseline' | 'resolved' | 'still_happening' | 'new';

export type FeedbackItem = {
  id: string;
  dimension: FeedbackDimension;
  skill?: string;
  evidence: string;
  title: string;
  explanation: string;
  alternatives?: string[];
  corrections?: FeedbackCorrection[];
  positive?: boolean;
  progressStatus?: FeedbackProgressStatus;
};

export type ResponseMetrics = {
  wordCount: number;
  uniqueWordCount: number;
  averageWpm: number;
  fillerCount: number;
  fillerWords: Record<string, number>;
  timeToMainPointSeconds: number | null;
  mainPointEvidence: string;
};

export type ResponseAnalysis = {
  transcript: string;
  durationSeconds: number;
  metrics: ResponseMetrics;
  feedback: FeedbackItem[];
  followUpQuestion?: string;
};

export type ResponseAnalysisStage = 'queued' | 'transcribing' | 'analyzing' | 'completed' | 'failed';

export type ResponseAnalysisProgress = {
  stage: ResponseAnalysisStage;
  transcript?: string;
  durationSeconds?: number;
  metrics?: ResponseMetrics;
  analysis?: ResponseAnalysis;
  feedbackIds?: Record<string, string>;
  error?: string;
};

export type SummaryPattern = {
  title: string;
  detail: string;
  evidence?: string;
  responseIds?: string[];
};

export type InterviewCheck = {
  id: 'answer-relevance' | 'reasoning-clarity' | 'clear-conclusion';
  question: string;
  passed: boolean;
  verdict?: 'yes' | 'partially' | 'no';
  detail: string;
  evidence?: string;
};

export type ExerciseTemplateId = 'E1' | 'E2' | 'E3' | 'E4' | 'E5' | 'E6';
export type ExerciseSkillId = 'S1' | 'S2' | 'S3' | 'S4' | 'S5' | 'S6';
export type ExerciseAssessment = 'pass' | 'partial' | 'fail' | 'not_evaluated';
export type ExerciseStatus = 'recommended' | 'in_progress' | 'completed' | 'skipped' | 'abandoned';
export type ExerciseAttemptType = 'guided' | 'transfer';

export type ExerciseRecommendation = {
  id: string;
  templateId: ExerciseTemplateId;
  skillId: ExerciseSkillId;
  title: string;
  targetSkill: string;
  targetBehavior: string;
  behaviorCode: string;
  selectionReason: string;
  instructions: string[];
  estimatedMinutes: number;
  prompt: string;
  guidance: string;
  difficultyLevel: number;
  sourceEvidence: string;
  status: ExerciseStatus;
};

export type GoalExercise = ExerciseRecommendation & {
  sessionId: string;
  sessionTitle: string;
  createdAt: string;
  completedAt: string | null;
  attemptCount: number;
  lastAssessment: ExerciseAssessment | null;
  nextStep: ExerciseNextStep;
};

export type ExerciseAttempt = {
  id: string;
  attemptNumber: number;
  attemptType: ExerciseAttemptType;
  prompt: string;
  difficultyLevel: number;
  guidanceProvided: string;
  transcript: string;
  durationSeconds: number;
  metrics: ResponseMetrics;
  assessment: ExerciseAssessment;
  whatWorked: string;
  whatToImprove: string;
  supportingEvidence: string;
  nextGuidance: string;
  completedAt: string;
};

export type ExerciseNextStep =
  | {
      stage: 'guided' | 'transfer';
      attemptNumber: number;
      prompt: string;
      guidance: string;
      difficultyLevel: number;
    }
  | { stage: 'summary' };

export type ExerciseAttemptResult = {
  attempt: ExerciseAttempt;
  next: ExerciseNextStep;
};

export type ExerciseAttemptStage = 'queued' | 'transcribing' | 'analyzing' | 'completed' | 'failed';

export type ExerciseAttemptProgress = {
  attemptId: string;
  stage: ExerciseAttemptStage;
  transcript?: string;
  durationSeconds?: number;
  metrics?: ResponseMetrics;
  result?: ExerciseAttemptResult;
  error?: string;
};

export type ExerciseCompletionSummary = {
  exerciseId: string;
  status: 'completed';
  targetSkill: string;
  targetBehavior: string;
  guidedAttempts: ExerciseAttempt[];
  transferTest: ExerciseAttempt | null;
  whatImproved: string;
  remainingFocus: string;
  recommendedNextPractice: string;
};

export type FinishedSession = {
  session: {
    id: string;
    status: 'completed';
    answers: number;
    durationSeconds: number;
    wordCount: number;
    averageWpm: number;
    averageTimeToMainPointSeconds: number | null;
    timeToMainPointAnswerCount: number;
    fillerCount: number;
  };
  summary: {
    headline: string;
    summary: string;
    strengths: SummaryPattern[];
    opportunities: SummaryPattern[];
    takeaway: string;
    interviewChecks?: InterviewCheck[];
  };
  exercise: ExerciseRecommendation | null;
};

export type SessionSummaryProgress =
  | { generationStatus: 'processing'; session: FinishedSession['session'] }
  | { generationStatus: 'failed'; session: FinishedSession['session']; error: string }
  | { generationStatus: 'completed'; result: FinishedSession };

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
  exerciseStatus?: ExerciseStatus;
};

export type SessionDetail = PracticeSession & {
  prompt: string;
  transcript: string;
  feedbackTitle: string;
  feedbackExplanation: string;
  summary: string;
  responses?: Array<{
    id: string;
    prompt: string;
    transcript: string;
    metrics: ResponseMetrics | null;
    feedback: FeedbackItem[];
  }>;
  summaryStrengths?: SummaryPattern[];
  summaryOpportunities?: SummaryPattern[];
  exerciseTitle?: string;
  exerciseTargetSkill?: string;
  exerciseReason?: string;
  exerciseEvidence?: string;
  exerciseInstructions?: string[];
  exerciseTemplateId?: ExerciseTemplateId;
  exerciseTargetBehavior?: string;
  exerciseStatus?: ExerciseStatus;
  exerciseAttempts?: ExerciseAttempt[];
  exerciseCompletion?: Pick<ExerciseCompletionSummary, 'whatImproved' | 'remainingFocus' | 'recommendedNextPractice'> | null;
};

export type DashboardFeedbackItem = FeedbackItem & {
  responseId: string | null;
  sessionId: string;
  createdAt: string;
};

export type GoalSessionInsight = {
  id: string;
  title: string;
  completedAt: string;
  prompts: string[];
  answerCount: number;
  speakingSeconds: number;
  summary: string | null;
  vocabulary: {
    totalWords: number;
    uniqueWords: number;
    vocabularySize: number;
    sizeHistory: Array<{
      sessionId: string;
      completedAt: string;
      uniqueWords: number;
    }>;
    newlyObservedWords: number | null;
    comparisonLabel: string | null;
    repeatedWords: Array<{ word: string; count: number }>;
    strengths: DashboardFeedbackItem[];
    improvements: DashboardFeedbackItem[];
  };
  grammar: {
    strengths: DashboardFeedbackItem[];
    improvements: DashboardFeedbackItem[];
  };
  fluency: {
    averageWpm: number;
    averageTimeToMainPointSeconds: number | null;
    timeToMainPointAnswerCount: number;
    fillerCount: number;
    fillerRatePer100Words: number;
    commonFillers: Array<{ phrase: string; count: number }>;
    repeatedOpenings: Array<{ phrase: string; count: number }>;
    feedback: DashboardFeedbackItem[];
  };
  communicationFeedback: DashboardFeedbackItem[];
};

export type GoalDashboard = {
  goalId: string;
  sessionCount: number;
  completedAnswerCount: number;
  lastPractised: string | null;
  totalSpeakingSeconds: number;
  speakingActivity: Array<{
    id: string;
    occurredAt: string;
    durationSeconds: number;
    fillerCount: number;
    kind: 'answer' | 'exercise';
  }>;
  overview: {
    text: string | null;
    strength: DashboardFeedbackItem | null;
    improvement: DashboardFeedbackItem | null;
    progress: string | null;
    supportingSessionIds: string[];
  };
  storytellingFramework?: {
    name: string;
    description: string;
    criteria: Array<{
      id: string;
      title: string;
      description: string;
      evaluation: DashboardFeedbackItem | null;
    }>;
  };
  vocabulary: {
    totalWords: number;
    uniqueWords: number;
    newlyObservedWords: number | null;
    comparisonLabel: string | null;
    repeatedWords: Array<{ word: string; count: number }>;
    strengths: DashboardFeedbackItem[];
    improvements: DashboardFeedbackItem[];
  };
  grammar: {
    strengths: DashboardFeedbackItem[];
    improvements: DashboardFeedbackItem[];
  };
  fluency: {
    averageWpm: number;
    averageTimeToMainPointSeconds: number | null;
    timeToMainPointAnswerCount: number;
    fillerCount: number;
    fillerRatePer100Words: number;
    commonFillers: Array<{ phrase: string; count: number }>;
    repeatedOpenings: Array<{ phrase: string; count: number }>;
    feedback: DashboardFeedbackItem[];
  };
  sessions: GoalSessionInsight[];
};

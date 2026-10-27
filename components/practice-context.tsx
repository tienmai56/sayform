'use client';

import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { getGoalDefinition, getPracticeQuestions } from '@/lib/goal-catalog';
import type { ExerciseAttemptResult, ExerciseAttemptStage, ExerciseCompletionSummary, ExerciseNextStep, ExerciseRecommendation, FeedbackItem, GoalSkill, ResponseAnalysis, ResponseAnalysisStage } from '@/lib/types';

type PracticeState = {
  goalId: string;
  goalTitle: string;
  goalTemplateKey: string | null;
  goalSkills: GoalSkill[];
  categories: string[];
  customTopic: string;
  answerNotes: string;
  redoFeedback: FeedbackItem[];
  prompt: string;
  interviewQuestionType: 'primary' | 'follow-up';
  interviewPrimaryResponse: {
    responseId: string;
    prompt: string;
    analysis: ResponseAnalysis;
  } | null;
  recordingUrl: string | null;
  activeSessionId: string | null;
  activeResponseId: string | null;
  answerCount: number;
  sessionStartedAt: number;
  feedbackIds: Record<string, string>;
  currentAnalysis: ResponseAnalysis | null;
  analysisStatus: ResponseAnalysisStage | 'idle';
  analysisError: string | null;
  activeExercise: ExerciseRecommendation | null;
  exerciseStage: 'guided' | 'transfer';
  exerciseAttemptNumber: number;
  exerciseGuidance: string;
  exerciseDifficultyLevel: number;
  exerciseResults: ExerciseAttemptResult[];
  currentExerciseResult: ExerciseAttemptResult | null;
  activeExerciseAttemptId: string | null;
  exerciseAnalysisStatus: ExerciseAttemptStage | 'idle';
  exerciseAnalysisError: string | null;
  exerciseCompletion: ExerciseCompletionSummary | null;
};

type PracticeContextValue = PracticeState & {
  updateSetup: (
    next: Partial<
      Pick<PracticeState, 'goalId' | 'goalTitle' | 'goalTemplateKey' | 'goalSkills' | 'categories' | 'customTopic' | 'answerNotes' | 'redoFeedback' | 'prompt' | 'interviewQuestionType' | 'interviewPrimaryResponse'>
    >,
  ) => void;
  setRecordingUrl: (url: string | null) => void;
  clearRecording: () => void;
  beginSession: (sessionId: string) => void;
  beginResponse: (responseId: string) => void;
  completeResponse: (responseId: string, feedbackIds: Record<string, string>, analysis: ResponseAnalysis) => void;
  setAnalysisProgress: (status: ResponseAnalysisStage, error?: string | null) => void;
  setCurrentAnalysis: (analysis: ResponseAnalysis | null) => void;
  resetSession: () => void;
  setActiveExercise: (exercise: ExerciseRecommendation | null) => void;
  startExercise: (exercise: ExerciseRecommendation, nextStep?: Exclude<ExerciseNextStep, { stage: 'summary' }>) => void;
  beginExerciseAttempt: (attemptId: string) => void;
  completeExerciseAttempt: (result: ExerciseAttemptResult) => void;
  setExerciseAnalysisProgress: (status: ExerciseAttemptStage | 'idle', error?: string | null) => void;
  advanceExercise: () => void;
  setExerciseCompletion: (summary: ExerciseCompletionSummary) => void;
};

const initialGoal = getGoalDefinition('clarity');

const initialState: PracticeState = {
  goalId: 'demo-goal-clarity',
  goalTitle: initialGoal?.title ?? 'Interview',
  goalTemplateKey: 'clarity',
  goalSkills: initialGoal?.skills ?? [],
  categories: ['professional'],
  customTopic: '',
  answerNotes: '',
  redoFeedback: [],
  prompt: getPracticeQuestions('clarity')[0] ?? '',
  interviewQuestionType: 'primary',
  interviewPrimaryResponse: null,
  recordingUrl: null,
  activeSessionId: null,
  activeResponseId: null,
  answerCount: 0,
  sessionStartedAt: Date.now(),
  feedbackIds: {},
  currentAnalysis: null,
  analysisStatus: 'idle',
  analysisError: null,
  activeExercise: null,
  exerciseStage: 'guided',
  exerciseAttemptNumber: 1,
  exerciseGuidance: '',
  exerciseDifficultyLevel: 1,
  exerciseResults: [],
  currentExerciseResult: null,
  activeExerciseAttemptId: null,
  exerciseAnalysisStatus: 'idle',
  exerciseAnalysisError: null,
  exerciseCompletion: null,
};

const PracticeContext = createContext<PracticeContextValue | null>(null);
export const practiceStorageKey = 'communication-coach:active-practice';

export function PracticeProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState(initialState);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      const saved = window.sessionStorage.getItem(practiceStorageKey);
      if (saved) {
        const restored = JSON.parse(saved) as Partial<PracticeState> & { skillFocus?: string };
        delete restored.skillFocus;
        if (restored.goalTemplateKey === 'clarity') {
          const interviewGoal = getGoalDefinition('clarity');
          restored.goalTitle = interviewGoal?.title ?? 'Interview';
          restored.goalSkills = interviewGoal?.skills ?? [];
        }
        setState((current) => ({ ...current, ...restored, recordingUrl: null }));
      }
    } finally {
      setHydrated(true);
    }
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    window.sessionStorage.setItem(practiceStorageKey, JSON.stringify({ ...state, recordingUrl: null }));
  }, [hydrated, state]);

  const value = useMemo<PracticeContextValue>(
    () => ({
      ...state,
      updateSetup(next) {
        setState((current) => ({ ...current, ...next }));
      },
      setRecordingUrl(url) {
        setState((current) => {
          if (current.recordingUrl && current.recordingUrl !== url) {
            URL.revokeObjectURL(current.recordingUrl);
          }
          return { ...current, recordingUrl: url };
        });
      },
      clearRecording() {
        setState((current) => {
          if (current.recordingUrl) URL.revokeObjectURL(current.recordingUrl);
          return { ...current, recordingUrl: null };
        });
      },
      beginSession(sessionId) {
        setState((current) => ({
          ...current,
          activeSessionId: sessionId,
          activeResponseId: null,
          answerCount: 0,
          sessionStartedAt: Date.now(),
          feedbackIds: {},
          currentAnalysis: null,
          analysisStatus: 'idle',
          analysisError: null,
          interviewPrimaryResponse: null,
          activeExercise: null,
          exerciseStage: 'guided',
          exerciseAttemptNumber: 1,
          exerciseGuidance: '',
          exerciseDifficultyLevel: 1,
          exerciseResults: [],
          currentExerciseResult: null,
          activeExerciseAttemptId: null,
          exerciseAnalysisStatus: 'idle',
          exerciseAnalysisError: null,
          exerciseCompletion: null,
        }));
      },
      beginResponse(responseId) {
        setState((current) => ({
          ...current,
          activeResponseId: responseId,
          feedbackIds: {},
          currentAnalysis: null,
          analysisStatus: 'queued',
          analysisError: null,
        }));
      },
      completeResponse(responseId, feedbackIds, analysis) {
        setState((current) => ({
          ...current,
          activeResponseId: responseId,
          answerCount: current.activeResponseId === responseId && current.analysisStatus === 'completed'
            ? current.answerCount
            : current.answerCount + 1,
          feedbackIds,
          currentAnalysis: analysis,
          analysisStatus: 'completed',
          analysisError: null,
          interviewPrimaryResponse: current.goalTemplateKey === 'clarity' && current.interviewQuestionType === 'primary'
            ? { responseId, prompt: current.prompt, analysis }
            : current.interviewPrimaryResponse,
        }));
      },
      setAnalysisProgress(status, error = null) {
        setState((current) => ({ ...current, analysisStatus: status, analysisError: error }));
      },
      setCurrentAnalysis(analysis) {
        setState((current) => ({
          ...current,
          currentAnalysis: analysis,
          analysisStatus: analysis ? 'completed' : 'idle',
          analysisError: null,
        }));
      },
      resetSession() {
        setState((current) => ({
          ...current,
          activeSessionId: null,
          activeResponseId: null,
          answerCount: 0,
          sessionStartedAt: Date.now(),
          feedbackIds: {},
          currentAnalysis: null,
          analysisStatus: 'idle',
          analysisError: null,
          answerNotes: '',
          redoFeedback: [],
          interviewQuestionType: 'primary',
          interviewPrimaryResponse: null,
          activeExercise: null,
          exerciseStage: 'guided',
          exerciseAttemptNumber: 1,
          exerciseGuidance: '',
          exerciseDifficultyLevel: 1,
          exerciseResults: [],
          currentExerciseResult: null,
          activeExerciseAttemptId: null,
          exerciseAnalysisStatus: 'idle',
          exerciseAnalysisError: null,
          exerciseCompletion: null,
        }));
      },
      setActiveExercise(exercise) {
        setState((current) => ({ ...current, activeExercise: exercise }));
      },
      startExercise(exercise, nextStep) {
        setState((current) => ({
          ...current,
          activeExercise: exercise,
          prompt: nextStep?.prompt ?? exercise.prompt,
          categories: ['targeted-exercise'],
          answerNotes: '',
          redoFeedback: [],
          currentAnalysis: null,
          exerciseStage: nextStep?.stage ?? 'guided',
          exerciseAttemptNumber: nextStep?.attemptNumber ?? 1,
          exerciseGuidance: nextStep?.guidance ?? exercise.guidance,
          exerciseDifficultyLevel: nextStep?.difficultyLevel ?? exercise.difficultyLevel,
          exerciseResults: [],
          currentExerciseResult: null,
          activeExerciseAttemptId: null,
          exerciseAnalysisStatus: 'idle',
          exerciseAnalysisError: null,
          exerciseCompletion: null,
        }));
      },
      beginExerciseAttempt(attemptId) {
        setState((current) => ({
          ...current,
          activeExerciseAttemptId: attemptId,
          currentExerciseResult: null,
          exerciseAnalysisStatus: 'queued',
          exerciseAnalysisError: null,
        }));
      },
      completeExerciseAttempt(result) {
        setState((current) => ({
          ...current,
          currentExerciseResult: result,
          activeExerciseAttemptId: result.attempt.id,
          exerciseAnalysisStatus: 'completed',
          exerciseAnalysisError: null,
          exerciseResults: [
            ...current.exerciseResults.filter((saved) => !(
              saved.attempt.attemptType === result.attempt.attemptType
              && saved.attempt.attemptNumber === result.attempt.attemptNumber
            )),
            result,
          ],
        }));
      },
      setExerciseAnalysisProgress(status, error = null) {
        setState((current) => ({ ...current, exerciseAnalysisStatus: status, exerciseAnalysisError: error }));
      },
      advanceExercise() {
        setState((current) => {
          const next = current.currentExerciseResult?.next;
          if (!next || next.stage === 'summary') return current;
          return {
            ...current,
            prompt: next.prompt,
            exerciseStage: next.stage,
            exerciseAttemptNumber: next.attemptNumber,
            exerciseGuidance: next.guidance,
            exerciseDifficultyLevel: next.difficultyLevel,
            currentExerciseResult: null,
            activeExerciseAttemptId: null,
            exerciseAnalysisStatus: 'idle',
            exerciseAnalysisError: null,
            currentAnalysis: null,
          };
        });
      },
      setExerciseCompletion(summary) {
        setState((current) => ({ ...current, exerciseCompletion: summary }));
      },
    }),
    [state],
  );

  return <PracticeContext.Provider value={value}>{children}</PracticeContext.Provider>;
}

export function usePractice() {
  const value = useContext(PracticeContext);
  if (!value) throw new Error('usePractice must be used within PracticeProvider');
  return value;
}

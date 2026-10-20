'use client';

import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { getGoalDefinition, getPracticeQuestions } from '@/lib/goal-catalog';
import type { ExerciseRecommendation, GoalSkill } from '@/lib/types';

type PracticeState = {
  goalId: string;
  goalTitle: string;
  goalTemplateKey: string | null;
  goalSkills: GoalSkill[];
  skillFocus: string;
  categories: string[];
  customTopic: string;
  prompt: string;
  recordingUrl: string | null;
  activeSessionId: string | null;
  activeResponseId: string | null;
  answerCount: number;
  sessionStartedAt: number;
  feedbackIds: Record<string, string>;
  activeExercise: ExerciseRecommendation | null;
};

type PracticeContextValue = PracticeState & {
  updateSetup: (
    next: Partial<
      Pick<PracticeState, 'goalId' | 'goalTitle' | 'goalTemplateKey' | 'goalSkills' | 'skillFocus' | 'categories' | 'customTopic' | 'prompt'>
    >,
  ) => void;
  setRecordingUrl: (url: string | null) => void;
  clearRecording: () => void;
  beginSession: (sessionId: string) => void;
  completeResponse: (responseId: string, feedbackIds: Record<string, string>) => void;
  resetSession: () => void;
  setActiveExercise: (exercise: ExerciseRecommendation | null) => void;
};

const initialGoal = getGoalDefinition('clarity');

const initialState: PracticeState = {
  goalId: 'demo-goal-clarity',
  goalTitle: initialGoal?.title ?? 'Communicate with clarity',
  goalTemplateKey: 'clarity',
  goalSkills: initialGoal?.skills ?? [],
  skillFocus: 'coach-choice',
  categories: ['professional'],
  customTopic: '',
  prompt: getPracticeQuestions('clarity')[0],
  recordingUrl: null,
  activeSessionId: null,
  activeResponseId: null,
  answerCount: 0,
  sessionStartedAt: Date.now(),
  feedbackIds: {},
  activeExercise: null,
};

const PracticeContext = createContext<PracticeContextValue | null>(null);
const practiceStorageKey = 'communication-coach:active-practice';

export function PracticeProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState(initialState);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      const saved = window.sessionStorage.getItem(practiceStorageKey);
      if (saved) {
        const restored = JSON.parse(saved) as Partial<PracticeState>;
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
          activeExercise: null,
        }));
      },
      completeResponse(responseId, feedbackIds) {
        setState((current) => ({
          ...current,
          activeResponseId: responseId,
          answerCount: current.answerCount + 1,
          feedbackIds,
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
          activeExercise: null,
        }));
      },
      setActiveExercise(exercise) {
        setState((current) => ({ ...current, activeExercise: exercise }));
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

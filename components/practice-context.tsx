'use client';

import { createContext, useContext, useMemo, useState } from 'react';
import { practiceQuestions } from '@/lib/mock-data';

type PracticeState = {
  goalId: string;
  goalTitle: string;
  categories: string[];
  customTopic: string;
  prompt: string;
  recordingUrl: string | null;
};

type PracticeContextValue = PracticeState & {
  updateSetup: (next: Partial<Omit<PracticeState, 'recordingUrl'>>) => void;
  setRecordingUrl: (url: string | null) => void;
  clearRecording: () => void;
};

const initialState: PracticeState = {
  goalId: 'clear-ideas',
  goalTitle: 'Express complex ideas clearly',
  categories: ['professional'],
  customTopic: '',
  prompt: practiceQuestions[0],
  recordingUrl: null,
};

const PracticeContext = createContext<PracticeContextValue | null>(null);

export function PracticeProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState(initialState);

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

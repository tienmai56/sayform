import type { ResponseMetrics } from '@/lib/types';

export type TimedTranscriptWord = {
  word: string;
  start: number;
  end: number;
};

const fillerPhrases = [
  ['you', 'know'],
  ['kind', 'of'],
  ['sort', 'of'],
  ['i', 'mean'],
  ['um'],
  ['uh'],
  ['erm'],
  ['like'],
  ['actually'],
  ['basically'],
  ['literally'],
  ['honestly'],
];

function wordsFrom(transcript: string) {
  return transcript.toLocaleLowerCase().match(/[\p{L}\p{N}]+(?:['’][\p{L}\p{N}]+)*/gu) ?? [];
}

function countPhrase(words: string[], phrase: string[]) {
  let count = 0;
  for (let index = 0; index <= words.length - phrase.length; index += 1) {
    if (phrase.every((word, offset) => words[index + offset] === word)) count += 1;
  }
  return count;
}

export function createSpeechMetrics(transcript: string, durationSeconds: number): ResponseMetrics {
  const words = wordsFrom(transcript);
  const fillerWords = Object.fromEntries(
    fillerPhrases
      .map((phrase) => [phrase.join(' '), countPhrase(words, phrase)] as const)
      .filter(([, count]) => count > 0),
  );
  const safeDuration = Math.max(1, durationSeconds);

  return {
    wordCount: words.length,
    uniqueWordCount: new Set(words).size,
    averageWpm: Math.round((words.length * 60) / safeDuration),
    fillerCount: Object.values(fillerWords).reduce((total, count) => total + count, 0),
    fillerWords,
    timeToMainPointSeconds: null,
    mainPointEvidence: '',
  };
}

export function timeToTranscriptEvidence(words: TimedTranscriptWord[], evidence: string) {
  const timedTokens = words.flatMap((item) => wordsFrom(item.word).map((word) => ({
    word,
    start: item.start,
  })));
  const evidenceTokens = wordsFrom(evidence);
  if (!timedTokens.length || !evidenceTokens.length) return null;

  for (let index = 0; index <= timedTokens.length - evidenceTokens.length; index += 1) {
    const matches = evidenceTokens.every((word, offset) => timedTokens[index + offset]?.word === word);
    if (!matches) continue;
    return Math.max(0, Math.round(timedTokens[index].start - timedTokens[0].start));
  }
  return null;
}

import type { ResponseMetrics } from '@/lib/types';

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
  };
}

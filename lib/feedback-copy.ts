export function conciseOverallFeedback(value: string) {
  const normalized = value.replace(/\s+/g, ' ').trim();
  if (!normalized) return '';

  const sentenceEnd = /[.!?](?=\s+(?:[A-Z0-9“”"']|$)|$)/.exec(normalized);
  return sentenceEnd ? normalized.slice(0, sentenceEnd.index + 1) : normalized;
}

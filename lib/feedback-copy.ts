import type { FeedbackDimension } from '@/lib/types';

export function conciseOverallFeedback(value: string) {
  const normalized = value.replace(/\s+/g, ' ').trim();
  if (!normalized) return '';

  const sentenceEnd = /[.!?](?=\s+(?:[A-Z0-9“”"']|$)|$)/.exec(normalized);
  return sentenceEnd ? normalized.slice(0, sentenceEnd.index + 1) : normalized;
}

export type InterviewEvaluationVerdict = 'yes' | 'partially' | 'no';

type InterviewEvaluationInput = {
  dimension: FeedbackDimension;
  explanation: string;
  positive?: boolean;
};

const verdictPrefix = /^(yes|no|partially|partial)\s*(?:[.!?:—–-]+)\s*/i;

export function getInterviewEvaluation(item: InterviewEvaluationInput) {
  const explanation = conciseOverallFeedback(item.explanation);
  const explicitVerdict = verdictPrefix.exec(explanation)?.[1]?.toLocaleLowerCase();
  let verdict: InterviewEvaluationVerdict;

  if (explicitVerdict === 'yes' || explicitVerdict === 'no') {
    verdict = explicitVerdict;
  } else if (explicitVerdict === 'partially' || explicitVerdict === 'partial') {
    verdict = 'partially';
  } else if (item.positive) {
    verdict = 'yes';
  } else if (
    item.dimension === 'Sentence structure'
    && /\b(?:did not|does not|never|no clear|without)\b/i.test(explanation)
  ) {
    verdict = 'no';
  } else if (/\b(?:but|however|although|some|useful|listed|discussed|explained|addressed|provided)\b/i.test(explanation)) {
    verdict = 'partially';
  } else {
    verdict = 'no';
  }

  return {
    verdict,
    label: verdict === 'yes' ? 'Yes' : verdict === 'partially' ? 'Partially' : 'No',
    reason: explanation.replace(verdictPrefix, '').trim(),
  };
}

export function ensureInterviewEvaluationExplanation(item: InterviewEvaluationInput) {
  const evaluation = getInterviewEvaluation(item);
  return `${evaluation.label} — ${evaluation.reason}`;
}

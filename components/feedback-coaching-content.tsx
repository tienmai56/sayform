import type { FeedbackItem } from '@/lib/types';
import { conciseOverallFeedback } from '@/lib/feedback-copy';
import { cn } from '@/lib/utils';

export function getFeedbackCorrections(item: FeedbackItem) {
  const seenEvidence = new Set<string>();
  const stored = (item.corrections ?? []).filter((correction) => {
    const evidence = correction.evidence.trim();
    const evidenceKey = evidence.toLocaleLowerCase().replace(/\s+/g, ' ');
    const wordCount = evidence.split(/\s+/).filter(Boolean).length;
    if (!evidence || !correction.suggestion.trim() || wordCount > 16 || evidence.length > 140 || seenEvidence.has(evidenceKey)) return false;
    seenEvidence.add(evidenceKey);
    return true;
  });
  if (stored.length) return stored.slice(0, 2);

  const firstAlternative = item.alternatives?.find((alternative) => alternative.trim());
  const fallbackWordCount = item.evidence.trim().split(/\s+/).filter(Boolean).length;
  if (!item.positive && item.evidence.trim() && fallbackWordCount <= 12 && item.evidence.length <= 120 && firstAlternative) {
    return [{ evidence: item.evidence.trim(), suggestion: firstAlternative.trim() }];
  }
  return [];
}

export function FeedbackCoachingContent({ item }: { item: FeedbackItem }) {
  const corrections = getFeedbackCorrections(item);
  const normalizedDimension = item.dimension.trim().toLocaleLowerCase().replace(/[^a-z0-9]+/g, ' ');
  const normalizedTitle = item.title.trim().toLocaleLowerCase().replace(/[^a-z0-9]+/g, ' ');
  const showTitle = Boolean(normalizedTitle && normalizedTitle !== normalizedDimension);
  const progressLabel = item.progressStatus === 'resolved'
    ? 'Resolved'
    : item.progressStatus === 'still_happening'
      ? 'Still happening'
      : item.progressStatus === 'new'
        ? item.positive ? 'New strength' : 'New issue'
        : null;

  return (
    <>
      <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.09em] text-[var(--muted-ink)]">
        <span className={cn('size-2 rounded-full', item.positive ? 'bg-[#55a887]' : 'bg-[#d19a29]')} />
        {item.dimension}
        {progressLabel && (
          <span className={cn(
            'ml-auto rounded-full px-2 py-1 text-[9px] tracking-[0.06em]',
            item.progressStatus === 'resolved'
              ? 'bg-[#dff2e9] text-[#286b55]'
              : item.progressStatus === 'still_happening'
                ? 'bg-[#fff0c7] text-[#805b17]'
                : 'bg-[#e7eef6] text-[#3e6078]',
          )}>{progressLabel}</span>
        )}
      </div>
      {showTitle && <h4 className="mt-3 text-sm font-semibold leading-5 text-[var(--navy)]">{item.title}</h4>}

      {corrections.length ? (
        <div className="mt-4 space-y-4">
          {corrections.map((correction, index) => (
            <div key={`${correction.evidence}-${index}`}>
              <p className="text-sm font-semibold leading-6 text-[var(--ink)]">
                “<mark className="rounded-sm bg-[#fff0a8] px-0.5 text-[var(--ink)]">{correction.evidence}</mark>”
              </p>
              <div className="mt-3">
                <p className="text-[10px] font-semibold uppercase tracking-[0.09em] text-[#6842d8]">Recommendation</p>
                <p className="mt-1 text-sm font-medium leading-6 text-[var(--ink)]">→ {correction.suggestion}</p>
              </div>
            </div>
          ))}
        </div>
      ) : item.evidence ? (
        <p className="mt-4 text-sm font-semibold leading-6 text-[var(--ink)]">“{item.evidence}”</p>
      ) : null}

      <div className="mt-4 border-t border-[var(--line)] pt-4">
        <p className="text-[10px] font-semibold uppercase tracking-[0.09em] text-[var(--muted-ink)]">Overall feedback</p>
        <p className="mt-1.5 text-sm leading-6 text-[var(--ink)]">{conciseOverallFeedback(item.explanation)}</p>
      </div>
    </>
  );
}

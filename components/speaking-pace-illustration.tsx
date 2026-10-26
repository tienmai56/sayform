const PACE_MIN = 60;
const PACE_MAX = 220;
const PACE_RANGE_START = 100;
const PACE_RANGE_END = 165;

function paceGaugePoint(wordsPerMinute: number, radius = 62) {
  const clampedPace = Math.min(PACE_MAX, Math.max(PACE_MIN, wordsPerMinute));
  const angle = Math.PI - ((clampedPace - PACE_MIN) / (PACE_MAX - PACE_MIN)) * Math.PI;
  return {
    x: 82 + radius * Math.cos(angle),
    y: 72 - radius * Math.sin(angle),
  };
}

function paceGaugeArc(start: number, end: number) {
  const startPoint = paceGaugePoint(start);
  const endPoint = paceGaugePoint(end);
  return `M ${startPoint.x} ${startPoint.y} A 62 62 0 0 1 ${endPoint.x} ${endPoint.y}`;
}

export function speakingPaceComment(wordsPerMinute: number) {
  if (wordsPerMinute < 100) return 'Below the 100–165 WPM clarity reference. Try speaking slightly faster while keeping your words clear.';
  if (wordsPerMinute <= 165) return 'Within the 100–165 WPM clarity reference—a clear, natural pace for most interviews.';
  return 'Above the 100–165 WPM clarity reference. Slow down slightly so your key points have time to land.';
}

export function SpeakingPaceIllustration({ wordsPerMinute }: { wordsPerMinute: number }) {
  const marker = paceGaugePoint(wordsPerMinute);

  return (
    <figure className="w-44 shrink-0" aria-label={`Average speaking pace: ${wordsPerMinute} words per minute`}>
      <svg viewBox="0 0 164 96" className="block h-auto w-full" aria-labelledby="pace-illustration-title">
        <title id="pace-illustration-title">Speaking pace compared with the 100 to 165 words per minute clarity reference</title>
        <path d={paceGaugeArc(PACE_MIN, 96)} fill="none" stroke="#e8e3f2" strokeLinecap="round" strokeWidth="14" />
        <path d={paceGaugeArc(PACE_RANGE_START, PACE_RANGE_END)} fill="none" stroke="#8b5cf6" strokeLinecap="round" strokeWidth="14" />
        <path d={paceGaugeArc(169, PACE_MAX)} fill="none" stroke="#e8e3f2" strokeLinecap="round" strokeWidth="14" />
        <circle cx={marker.x} cy={marker.y} r="6" fill="#2b1745" stroke="white" strokeWidth="3" />
        <text x="82" y="62" textAnchor="middle" fill="#6d5b7f" fontFamily="var(--font-sans-ui)" fontSize="7" fontWeight="700" letterSpacing="0.08em">CLARITY RANGE</text>
        <text x="82" y="76" textAnchor="middle" fill="#2b1745" fontFamily="var(--font-display-ui)" fontSize="12" fontWeight="600">100–165</text>
      </svg>
      <figcaption className="-mt-1 flex justify-between text-[10px] font-semibold text-[var(--muted-ink)]">
        <span>Slower</span>
        <span>Faster</span>
      </figcaption>
    </figure>
  );
}

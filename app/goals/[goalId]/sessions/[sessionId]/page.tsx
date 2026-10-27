import type { Metadata } from 'next';
import { SessionInsightsView } from '@/components/session-insights-view';

export const metadata: Metadata = {
  title: 'Session insights',
};

export default async function SessionInsightsPage({
  params,
}: {
  params: Promise<{ goalId: string; sessionId: string }>;
}) {
  const { goalId, sessionId } = await params;
  return <SessionInsightsView goalId={goalId} sessionId={sessionId} />;
}

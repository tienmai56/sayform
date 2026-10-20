import type { Metadata } from 'next';
import { SessionSummaryView } from '@/components/session-summary-view';

export const metadata: Metadata = { title: 'Session summary' };

export default function SessionSummaryPage() {
  return <SessionSummaryView />;
}

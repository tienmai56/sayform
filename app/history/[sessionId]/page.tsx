import type { Metadata } from 'next';
import { HistoryDetailView } from '@/components/history-detail-view';

export const metadata: Metadata = { title: 'Session details' };

export default function HistoryDetailPage() {
  return <HistoryDetailView />;
}

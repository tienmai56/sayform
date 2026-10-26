import type { Metadata } from 'next';
import { GoalsView } from '@/components/goals-view';

export const metadata: Metadata = { title: 'Home' };

export default function GoalsPage() {
  return <GoalsView />;
}

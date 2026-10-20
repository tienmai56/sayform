import type { Metadata } from 'next';
import { PracticeSetupView } from '@/components/practice-setup-view';

export const metadata: Metadata = { title: 'Practice setup' };

export default function PracticeSetupPage() {
  return <PracticeSetupView />;
}

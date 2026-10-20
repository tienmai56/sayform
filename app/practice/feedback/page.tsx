import type { Metadata } from 'next';
import { FeedbackWorkspace } from '@/components/feedback-workspace';

export const metadata: Metadata = { title: 'Answer feedback' };

export default function FeedbackPage() {
  return <FeedbackWorkspace />;
}

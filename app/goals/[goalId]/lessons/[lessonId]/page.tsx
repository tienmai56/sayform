import type { Metadata } from 'next';
import { LessonInsightsView } from '@/components/lesson-insights-view';

export const metadata: Metadata = {
  title: 'Lesson insights',
};

export default async function LessonInsightsPage({
  params,
}: {
  params: Promise<{ goalId: string; lessonId: string }>;
}) {
  const { goalId, lessonId } = await params;
  return <LessonInsightsView goalId={goalId} lessonId={lessonId} />;
}

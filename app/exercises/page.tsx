import type { Metadata } from 'next';
import { ExercisesView } from '@/components/exercises-view';

export const metadata: Metadata = { title: 'Exercises' };

export default function ExercisesPage() {
  return <ExercisesView />;
}

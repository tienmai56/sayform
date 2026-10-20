import type { Metadata } from 'next';
import { CameraPractice } from '@/components/camera-practice';

export const metadata: Metadata = { title: 'Speaking practice' };

export default function PracticeSessionPage() {
  return <CameraPractice />;
}

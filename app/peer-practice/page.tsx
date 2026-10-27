import type { Metadata } from 'next';
import { PeerPracticePrototype } from '@/components/peer-practice-prototype';

export const metadata: Metadata = {
  title: 'Peer practice prototype',
  description: 'Frontend-only prototype for Sayform peer mock interviews.',
};

export default function PeerPracticePage() {
  return <PeerPracticePrototype />;
}

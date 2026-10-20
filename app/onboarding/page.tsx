import type { Metadata } from 'next';
import { OnboardingView } from '@/components/onboarding-view';

export const metadata: Metadata = { title: 'Get started' };

export default function OnboardingPage() {
  return <OnboardingView />;
}

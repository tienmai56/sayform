import type { Metadata } from 'next';
import { AccessRequestView } from '@/components/access-request-view';

export const metadata: Metadata = { title: 'Find your coach' };

export default function LoginPage() {
  return <AccessRequestView />;
}

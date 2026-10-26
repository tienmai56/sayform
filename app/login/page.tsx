import type { Metadata } from 'next';
import { AccessRequestView } from '@/components/access-request-view';

export const metadata: Metadata = { title: 'Request access' };

export default function LoginPage() {
  return <AccessRequestView />;
}

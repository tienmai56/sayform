import type { Metadata } from 'next';
import { LoginView } from '@/components/login-view';

export const metadata: Metadata = { title: 'Sign in' };

type LoginPageProps = {
  searchParams: Promise<{ next?: string; error?: string }>;
};

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const params = await searchParams;
  const next = params.next?.startsWith('/') && !params.next.startsWith('//') ? params.next : '/goals';
  return <LoginView nextPath={next} initialError={params.error} />;
}

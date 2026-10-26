import type { Metadata } from 'next';
import { LoginView } from '@/components/login-view';

export const metadata: Metadata = { title: 'Member sign in' };

type SignInPageProps = {
  searchParams: Promise<{ next?: string; error?: string }>;
};

export default async function SignInPage({ searchParams }: SignInPageProps) {
  const params = await searchParams;
  const next =
    params.next?.startsWith('/') && !params.next.startsWith('//')
      ? params.next
      : '/goals';
  return (
    <LoginView
      nextPath={next}
      initialError={params.error}
      allowSignUp={false}
    />
  );
}

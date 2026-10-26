'use client';

import { useState } from 'react';
import type { SyntheticEvent } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowRight, Database, Sparkles } from 'lucide-react';
import { Button, buttonVariants } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { createClient } from '@/lib/supabase/client';
import { isSupabaseConfigured } from '@/lib/supabase/config';
import { cn } from '@/lib/utils';

function GoogleIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="size-4">
      <path
        fill="#4285F4"
        d="M21.35 12.23c0-.71-.06-1.4-.18-2.07H12v3.91h5.24a4.48 4.48 0 0 1-1.94 2.94v2.54h3.14c1.84-1.69 2.91-4.19 2.91-7.32Z"
      />
      <path
        fill="#34A853"
        d="M12 21.75c2.62 0 4.82-.87 6.44-2.36l-3.14-2.54c-.87.58-1.98.92-3.3.92-2.53 0-4.67-1.71-5.44-4.01H3.32v2.62A9.73 9.73 0 0 0 12 21.75Z"
      />
      <path
        fill="#FBBC05"
        d="M6.56 13.76a5.86 5.86 0 0 1 0-3.52V7.62H3.32a9.76 9.76 0 0 0 0 8.76l3.24-2.62Z"
      />
      <path
        fill="#EA4335"
        d="M12 6.23c1.43 0 2.71.49 3.72 1.45l2.79-2.79A9.35 9.35 0 0 0 12 2.25a9.73 9.73 0 0 0-8.68 5.37l3.24 2.62c.77-2.3 2.91-4.01 5.44-4.01Z"
      />
    </svg>
  );
}

export function LoginView({
  nextPath,
  initialError,
  allowSignUp = true,
}: {
  nextPath: string;
  initialError?: string;
  allowSignUp?: boolean;
}) {
  const router = useRouter();
  const configured = isSupabaseConfigured();
  const [mode, setMode] = useState<'sign-in' | 'sign-up'>('sign-in');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [pendingMethod, setPendingMethod] = useState<
    'google' | 'password' | null
  >(null);
  const [message, setMessage] = useState(initialError ?? '');
  const [success, setSuccess] = useState(false);
  const pending = pendingMethod !== null;

  async function signInWithGoogle() {
    setPendingMethod('google');
    setMessage('');
    setSuccess(false);

    const callback = new URL('/auth/callback', window.location.origin);
    callback.searchParams.set('next', nextPath);
    const { error } = await createClient().auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: callback.toString() },
    });
    if (error) {
      setMessage(error.message);
      setPendingMethod(null);
    }
  }

  async function submit(event: SyntheticEvent<HTMLFormElement>) {
    event.preventDefault();
    setPendingMethod('password');
    setMessage('');
    setSuccess(false);

    const supabase = createClient();
    if (mode === 'sign-in') {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (error) {
        setMessage(error.message);
        setPendingMethod(null);
        return;
      }
      router.push(nextPath);
      router.refresh();
      return;
    }

    const callback = new URL('/auth/callback', window.location.origin);
    callback.searchParams.set('next', nextPath);
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: callback.toString(),
        data: { full_name: name.trim() },
      },
    });
    if (error) {
      setMessage(error.message);
      setPendingMethod(null);
      return;
    }
    if (data.session) {
      router.push('/goals');
      router.refresh();
      return;
    }
    setSuccess(true);
    setMessage(
      'Check your email to confirm your account, then return here to sign in.',
    );
    setPendingMethod(null);
  }

  if (!configured) {
    return (
      <main className="grid min-h-screen place-items-center bg-[var(--canvas)] px-6">
        <section className="w-full max-w-lg rounded-3xl border border-[var(--line)] bg-[var(--paper)] p-8 text-center shadow-[var(--shadow-lg)]">
          <span className="mx-auto grid size-14 place-items-center rounded-2xl bg-[var(--mint-soft)] text-[var(--teal-dark)]">
            <Database className="size-6" />
          </span>
          <h1 className="mt-5 font-display text-3xl font-semibold tracking-[-0.04em] text-[var(--navy)]">
            Backend setup is ready
          </h1>
          <p className="mt-3 text-sm leading-6 text-[var(--muted-ink)]">
            Add your Supabase project details to enable accounts and cloud
            persistence. Until then, Sayform runs in a private demo mode in this
            browser.
          </p>
          <Link
            href="/goals"
            className={cn(
              buttonVariants(),
              'mt-6 h-11 w-full rounded-xl bg-[var(--navy)]',
            )}
          >
            Continue in demo mode <ArrowRight className="ml-1 size-4" />
          </Link>
        </section>
      </main>
    );
  }

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[linear-gradient(145deg,#faf7ff_0%,#f2edff_50%,#ffffff_100%)] px-6 py-16">
      <div
        aria-hidden="true"
        className="absolute -left-32 -top-36 size-[30rem] rounded-full bg-[#c4b5fd]/35 blur-3xl"
      />
      <div
        aria-hidden="true"
        className="absolute -bottom-44 -right-28 size-[32rem] rounded-full bg-[#e9d5ff]/45 blur-3xl"
      />
      <Link
        href="/"
        aria-label="Sayform home"
        className="absolute left-10 top-9 font-display text-2xl font-semibold tracking-[-0.045em] text-[#6842d8]"
      >
        sayform
      </Link>

      <section className="relative w-full max-w-md rounded-[2rem] border border-[#ddd3f2] bg-white/90 p-9 shadow-[0_28px_80px_rgba(76,29,149,0.14)] backdrop-blur-sm sm:p-11">
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.13em] text-[var(--teal-dark)]">
          <Sparkles className="size-4" />
          Welcome to Sayform
        </div>
        <h2 className="mt-3 font-display text-4xl font-semibold tracking-[-0.04em] text-[var(--navy)]">
          {mode === 'sign-in' ? 'Sign in to practise' : 'Create your account'}
        </h2>
        <p className="mt-2 text-sm leading-6 text-[var(--muted-ink)]">
          {mode === 'sign-in'
            ? 'Continue with your interview practice and session history.'
            : 'Create an account and start practicing interview answers.'}
        </p>

        <Button
          type="button"
          variant="outline"
          disabled={pending}
          onClick={signInWithGoogle}
          className="mt-8 h-11 w-full rounded-xl border-[var(--line)] bg-white text-[var(--navy)] shadow-sm hover:bg-[var(--canvas)]"
        >
          <GoogleIcon />
          {pendingMethod === 'google'
            ? 'Connecting to Google…'
            : 'Continue with Google'}
        </Button>

        <div className="my-6 flex items-center gap-3">
          <hr className="flex-1 border-0 border-t border-[var(--line)]" />
          <span className="text-xs font-medium uppercase tracking-[0.12em] text-[var(--muted-ink)]">
            or
          </span>
          <hr className="flex-1 border-0 border-t border-[var(--line)]" />
        </div>

        <form
          onSubmit={submit}
          className="space-y-4"
          aria-busy={pendingMethod === 'password'}
        >
          {mode === 'sign-up' && (
            <label
              htmlFor="name"
              className="block text-sm font-medium text-[var(--navy)]"
            >
              Name
              <Input
                id="name"
                value={name}
                onChange={(event) => setName(event.target.value)}
                required
                minLength={2}
                autoComplete="name"
                className="mt-2 h-11 bg-white"
              />
            </label>
          )}
          <label
            htmlFor="email"
            className="block text-sm font-medium text-[var(--navy)]"
          >
            Email
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
              autoComplete="email"
              className="mt-2 h-11 bg-white"
            />
          </label>
          <label
            htmlFor="password"
            className="block text-sm font-medium text-[var(--navy)]"
          >
            Password
            <Input
              id="password"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
              minLength={8}
              autoComplete={
                mode === 'sign-in' ? 'current-password' : 'new-password'
              }
              className="mt-2 h-11 bg-white"
            />
          </label>

          {message && (
            <output
              aria-live="polite"
              className={`block rounded-xl px-4 py-3 text-sm ${success ? 'bg-[var(--mint-soft)] text-[var(--teal-dark)]' : 'bg-[var(--rose-soft)] text-[#8f4336]'}`}
            >
              {message}
            </output>
          )}

          <Button
            disabled={pending}
            type="submit"
            className="h-11 w-full rounded-xl bg-[linear-gradient(135deg,#8b5cf6,#6d28d9,#5b21b6)] shadow-[0_10px_24px_rgba(109,40,217,0.24)] hover:opacity-92"
          >
            {pendingMethod === 'password'
              ? 'Please wait…'
              : mode === 'sign-in'
                ? 'Sign in'
                : 'Create account'}
            <ArrowRight className="ml-1 size-4" />
          </Button>
        </form>

        {allowSignUp && (
          <button
            type="button"
            disabled={pending}
            onClick={() => {
              setMode((current) =>
                current === 'sign-in' ? 'sign-up' : 'sign-in',
              );
              setMessage('');
            }}
            className="mt-5 w-full text-center text-sm text-[var(--muted-ink)] hover:text-[var(--teal-dark)] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {mode === 'sign-in'
              ? 'New here? Create an account'
              : 'Already have an account? Sign in'}
          </button>
        )}
      </section>
    </main>
  );
}

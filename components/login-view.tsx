'use client';

import { useState } from 'react';
import type { SyntheticEvent } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ArrowRight,
  CheckCircle2,
  Database,
  LockKeyhole,
  Sparkles,
} from 'lucide-react';
import { Brand } from '@/components/app-shell';
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
}: {
  nextPath: string;
  initialError?: string;
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
    <main className="grid min-h-screen grid-cols-[minmax(0,0.9fr)_minmax(560px,1.1fr)] bg-[var(--paper)]">
      <section className="relative flex flex-col overflow-hidden bg-[var(--navy)] px-14 py-10 text-white">
        <div className="absolute -left-24 top-24 size-80 rounded-full bg-[var(--teal)]/20 blur-3xl" />
        <div className="relative">
          <Brand inverted />
        </div>
        <div className="relative my-auto max-w-lg py-16">
          <span className="grid size-12 place-items-center rounded-2xl bg-white/10 text-[var(--mint)]">
            <LockKeyhole className="size-5" />
          </span>
          <h1 className="mt-6 font-display text-5xl font-semibold leading-[1.05] tracking-[-0.05em]">
            Your practice history, wherever you work.
          </h1>
          <p className="mt-5 text-base leading-7 text-white/65">
            Sign in to keep goals, transcripts, metrics, feedback, and completed
            exercises together. Recordings remain temporary.
          </p>
          <div className="mt-9 space-y-3 text-sm text-white/70">
            <p className="flex items-center gap-2">
              <CheckCircle2 className="size-4 text-[var(--mint)]" />
              Private records protected per account
            </p>
            <p className="flex items-center gap-2">
              <CheckCircle2 className="size-4 text-[var(--mint)]" />
              No saved video or audio in History
            </p>
          </div>
        </div>
      </section>

      <section className="flex items-center justify-center px-16 py-12">
        <div className="w-full max-w-md">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.13em] text-[var(--teal-dark)]">
            <Sparkles className="size-4" />
            Welcome to Sayform
          </div>
          <h2 className="mt-3 font-display text-4xl font-semibold tracking-[-0.04em] text-[var(--navy)]">
            {mode === 'sign-in' ? 'Sign in to practise' : 'Create your account'}
          </h2>
          <p className="mt-2 text-sm leading-6 text-[var(--muted-ink)]">
            {mode === 'sign-in'
              ? 'Continue with your saved goals and session history.'
              : 'Start with a communication goal—no baseline test required.'}
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
              className="h-11 w-full rounded-xl bg-[var(--navy)] hover:bg-[#1d4255]"
            >
              {pendingMethod === 'password'
                ? 'Please wait…'
                : mode === 'sign-in'
                  ? 'Sign in'
                  : 'Create account'}
              <ArrowRight className="ml-1 size-4" />
            </Button>
          </form>

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
        </div>
      </section>
    </main>
  );
}

'use client';

import { useState } from 'react';
import type { SyntheticEvent } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowRight, CheckCircle2, Database, LockKeyhole, Sparkles } from 'lucide-react';
import { Brand } from '@/components/app-shell';
import { Button, buttonVariants } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { createClient } from '@/lib/supabase/client';
import { isSupabaseConfigured } from '@/lib/supabase/config';
import { cn } from '@/lib/utils';

export function LoginView({ nextPath, initialError }: { nextPath: string; initialError?: string }) {
  const router = useRouter();
  const configured = isSupabaseConfigured();
  const [mode, setMode] = useState<'sign-in' | 'sign-up'>('sign-in');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState(initialError ?? '');
  const [success, setSuccess] = useState(false);

  async function submit(event: SyntheticEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setMessage('');
    setSuccess(false);

    const supabase = createClient();
    if (mode === 'sign-in') {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        setMessage(error.message);
        setPending(false);
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
      options: { emailRedirectTo: callback.toString(), data: { full_name: name.trim() } },
    });
    if (error) {
      setMessage(error.message);
      setPending(false);
      return;
    }
    if (data.session) {
      router.push('/goals');
      router.refresh();
      return;
    }
    setSuccess(true);
    setMessage('Check your email to confirm your account, then return here to sign in.');
    setPending(false);
  }

  if (!configured) {
    return (
      <main className="grid min-h-screen place-items-center bg-[var(--canvas)] px-6">
        <section className="w-full max-w-lg rounded-3xl border border-[var(--line)] bg-[var(--paper)] p-8 text-center shadow-[var(--shadow-lg)]">
          <span className="mx-auto grid size-14 place-items-center rounded-2xl bg-[var(--mint-soft)] text-[var(--teal-dark)]"><Database className="size-6" /></span>
          <h1 className="mt-5 font-display text-3xl font-semibold tracking-[-0.04em] text-[var(--navy)]">Backend setup is ready</h1>
          <p className="mt-3 text-sm leading-6 text-[var(--muted-ink)]">Add your Supabase project details to enable accounts and cloud persistence. Until then, Sayform runs in a private demo mode in this browser.</p>
          <Link href="/goals" className={cn(buttonVariants(), 'mt-6 h-11 w-full rounded-xl bg-[var(--navy)]')}>Continue in demo mode <ArrowRight className="ml-1 size-4" /></Link>
        </section>
      </main>
    );
  }

  return (
    <main className="grid min-h-screen grid-cols-[minmax(0,0.9fr)_minmax(560px,1.1fr)] bg-[var(--paper)]">
      <section className="relative flex flex-col overflow-hidden bg-[var(--navy)] px-14 py-10 text-white">
        <div className="absolute -left-24 top-24 size-80 rounded-full bg-[var(--teal)]/20 blur-3xl" />
        <div className="relative"><Brand inverted /></div>
        <div className="relative my-auto max-w-lg py-16">
          <span className="grid size-12 place-items-center rounded-2xl bg-white/10 text-[var(--mint)]"><LockKeyhole className="size-5" /></span>
          <h1 className="mt-6 font-display text-5xl font-semibold leading-[1.05] tracking-[-0.05em]">Your practice history, wherever you work.</h1>
          <p className="mt-5 text-base leading-7 text-white/65">Sign in to keep goals, transcripts, metrics, feedback, and completed exercises together. Recordings remain temporary.</p>
          <div className="mt-9 space-y-3 text-sm text-white/70">
            <p className="flex items-center gap-2"><CheckCircle2 className="size-4 text-[var(--mint)]" />Private records protected per account</p>
            <p className="flex items-center gap-2"><CheckCircle2 className="size-4 text-[var(--mint)]" />No saved video or audio in History</p>
          </div>
        </div>
      </section>

      <section className="flex items-center justify-center px-16 py-12">
        <div className="w-full max-w-md">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.13em] text-[var(--teal-dark)]"><Sparkles className="size-4" />Welcome to Sayform</div>
          <h2 className="mt-3 font-display text-4xl font-semibold tracking-[-0.04em] text-[var(--navy)]">{mode === 'sign-in' ? 'Sign in to practise' : 'Create your account'}</h2>
          <p className="mt-2 text-sm leading-6 text-[var(--muted-ink)]">{mode === 'sign-in' ? 'Continue with your saved goals and session history.' : 'Start with a communication goal—no baseline test required.'}</p>

          <form onSubmit={submit} className="mt-8 space-y-4">
            {mode === 'sign-up' && (
              <label htmlFor="name" className="block text-sm font-medium text-[var(--navy)]">Name<Input id="name" value={name} onChange={(event) => setName(event.target.value)} required minLength={2} autoComplete="name" className="mt-2 h-11 bg-white" /></label>
            )}
            <label htmlFor="email" className="block text-sm font-medium text-[var(--navy)]">Email<Input id="email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} required autoComplete="email" className="mt-2 h-11 bg-white" /></label>
            <label htmlFor="password" className="block text-sm font-medium text-[var(--navy)]">Password<Input id="password" type="password" value={password} onChange={(event) => setPassword(event.target.value)} required minLength={8} autoComplete={mode === 'sign-in' ? 'current-password' : 'new-password'} className="mt-2 h-11 bg-white" /></label>

            {message && <output className={`block rounded-xl px-4 py-3 text-sm ${success ? 'bg-[var(--mint-soft)] text-[var(--teal-dark)]' : 'bg-[var(--rose-soft)] text-[#8f4336]'}`}>{message}</output>}

            <Button disabled={pending} type="submit" className="h-11 w-full rounded-xl bg-[var(--navy)] hover:bg-[#1d4255]">{pending ? 'Please wait…' : mode === 'sign-in' ? 'Sign in' : 'Create account'}<ArrowRight className="ml-1 size-4" /></Button>
          </form>

          <button type="button" onClick={() => { setMode((current) => current === 'sign-in' ? 'sign-up' : 'sign-in'); setMessage(''); }} className="mt-5 w-full text-center text-sm text-[var(--muted-ink)] hover:text-[var(--teal-dark)]">
            {mode === 'sign-in' ? 'New here? Create an account' : 'Already have an account? Sign in'}
          </button>
        </div>
      </section>
    </main>
  );
}

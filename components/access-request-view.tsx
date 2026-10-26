'use client';

import { useState } from 'react';
import type { SyntheticEvent } from 'react';
import Link from 'next/link';
import { ArrowRight, CheckCircle2, Mail } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

export function AccessRequestView() {
  const [email, setEmail] = useState('');
  const [pending, setPending] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [message, setMessage] = useState('');

  async function submit(event: SyntheticEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setMessage('');

    try {
      const response = await fetch('/api/access-requests', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email }),
      });

      if (!response.ok) throw new Error('request_failed');
      setSubmitted(true);
    } catch {
      setMessage('We could not save your request. Please try again.');
    } finally {
      setPending(false);
    }
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

      <section className="relative w-full max-w-lg rounded-[2rem] border border-[#ddd3f2] bg-white/90 p-10 shadow-[0_28px_80px_rgba(76,29,149,0.14)] backdrop-blur-sm sm:p-12">
        {submitted ? (
          <div className="text-center">
            <span className="mx-auto grid size-14 place-items-center rounded-2xl bg-[var(--mint-soft)] text-[var(--teal-dark)]">
              <CheckCircle2 className="size-6" />
            </span>
            <h1 className="mt-6 font-display text-4xl font-semibold tracking-[-0.045em] text-[var(--navy)]">
              Request received
            </h1>
            <p className="mt-4 text-[15px] leading-7 text-[var(--muted-ink)]">
              Thanks for your interest in Sayform. I’ll review your request and
              email you if access is approved.
            </p>
            <Link
              href="/"
              className="mt-7 inline-flex text-sm font-semibold text-[var(--teal-dark)] hover:underline"
            >
              Back to Sayform
            </Link>
          </div>
        ) : (
          <>
            <span className="grid size-12 place-items-center rounded-2xl bg-[var(--mint-soft)] text-[var(--teal-dark)]">
              <Mail className="size-5" />
            </span>
            <p className="mt-7 text-xs font-semibold uppercase tracking-[0.13em] text-[var(--teal-dark)]">
              Invitation-only access
            </p>
            <h1 className="mt-3 font-display text-4xl font-semibold tracking-[-0.045em] text-[var(--navy)]">
              Request access to Sayform
            </h1>
            <p className="mt-4 text-[15px] leading-7 text-[var(--muted-ink)]">
              Sayform is currently available to a small group of interview
              candidates. Share your email and I’ll reach out if your request is
              approved.
            </p>

            <form
              onSubmit={submit}
              className="mt-8 space-y-4"
              aria-busy={pending}
            >
              <label
                htmlFor="email"
                className="block text-sm font-medium text-[var(--navy)]"
              >
                Email address
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  required
                  autoComplete="email"
                  placeholder="you@example.com"
                  className="mt-2 h-12 bg-white"
                />
              </label>

              {message && (
                <output
                  aria-live="polite"
                  className="block rounded-xl bg-[var(--rose-soft)] px-4 py-3 text-sm text-[#8f4336]"
                >
                  {message}
                </output>
              )}

              <Button
                disabled={pending}
                type="submit"
                className="h-12 w-full rounded-xl bg-[linear-gradient(135deg,#8b5cf6,#6d28d9,#5b21b6)] shadow-[0_10px_24px_rgba(109,40,217,0.24)] hover:opacity-92"
              >
                {pending ? 'Sending request…' : 'Request access'}
                {!pending && <ArrowRight className="ml-1 size-4" />}
              </Button>
            </form>

            <p className="mt-5 text-center text-xs leading-5 text-[var(--muted-ink)]">
              Your email is used only to review and respond to your request.
            </p>
            <p className="mt-6 text-center text-sm text-[var(--muted-ink)]">
              Already invited?{' '}
              <Link
                href="/signin"
                className="font-semibold text-[var(--teal-dark)] hover:underline"
              >
                Sign in
              </Link>
            </p>
          </>
        )}
      </section>
    </main>
  );
}

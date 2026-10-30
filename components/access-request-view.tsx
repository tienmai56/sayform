'use client';

import { useState } from 'react';
import type { SyntheticEvent } from 'react';
import Link from 'next/link';
import { ArrowRight, CheckCircle2, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { coachingGoals, speakingChallenges, sessionBudgets } from '@/lib/coach-matching';

function Choices({ title, hint, options, selected, onChange }: {
  title: string; hint: string; options: readonly string[]; selected: string[];
  onChange: (values: string[]) => void;
}) {
  return <fieldset className="space-y-3">
    <legend className="text-base font-semibold text-[var(--navy)]">{title} <span aria-hidden="true">*</span></legend>
    <p className="text-sm text-[var(--muted-ink)]">{hint}</p>
    <div className="grid gap-2 sm:grid-cols-2">
      {options.map(option => <label key={option} className={`flex cursor-pointer items-start gap-3 rounded-xl border p-3 text-sm leading-5 transition-colors ${selected.includes(option) ? 'border-violet-400 bg-violet-50 text-violet-950' : 'border-[#e3dced] bg-white text-[#514161] hover:border-violet-300'}`}>
        <input type="checkbox" name={title} value={option} checked={selected.includes(option)}
          onChange={e => onChange(e.target.checked ? [...selected, option] : selected.filter(value => value !== option))}
          className="mt-0.5 size-4 shrink-0 accent-violet-700" />
        {option}
      </label>)}
    </div>
  </fieldset>;
}

export function AccessRequestView() {
  const [email, setEmail] = useState('');
  const [currentRole, setCurrentRole] = useState('');
  const [company, setCompany] = useState('');
  const [goals, setGoals] = useState<string[]>([]);
  const [challenges, setChallenges] = useState<string[]>([]);
  const [sessionBudget, setSessionBudget] = useState('');
  const [pending, setPending] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [message, setMessage] = useState('');

  async function submit(event: SyntheticEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage('');
    if (!goals.length || !challenges.length) {
      setMessage('Choose at least one goal and one speaking challenge.');
      return;
    }
    setPending(true);
    try {
      const response = await fetch('/api/access-requests', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email, currentRole, company, goals, challenges, sessionBudget }),
      });
      if (!response.ok) {
        const result = await response.json().catch(() => null);
        if (response.status === 503 && result?.error?.code === 'coach_matching_unavailable') {
          setMessage(result.error.message);
          return;
        }
        throw new Error('request_failed');
      }
      setSubmitted(true);
    } catch {
      setMessage('We could not save your request. Please try again.');
    } finally { setPending(false); }
  }

  return <main data-public-page="true" className="relative min-h-screen bg-[linear-gradient(145deg,#faf7ff_0%,#f2edff_50%,#ffffff_100%)] px-5 pb-14 pt-28 sm:px-8">
    <Link href="/" aria-label="Sayform home" className="absolute left-8 top-8 font-display text-2xl font-semibold tracking-[-0.045em] text-[#6842d8]">sayform</Link>
    <section className="mx-auto w-full max-w-2xl rounded-[2rem] border border-[#ddd3f2] bg-white p-6 shadow-[0_20px_60px_rgba(76,29,149,0.08)] sm:p-10">
      {submitted ? <div className="py-8 text-center">
        <CheckCircle2 className="mx-auto size-12 text-violet-600" />
        <h1 className="mt-6 font-display text-3xl font-semibold text-[var(--navy)]">You’re on our list</h1>
        <p className="mx-auto mt-4 max-w-md text-base leading-7 text-[var(--muted-ink)]">We’ll email you when we find a coach match. Your first trial session is on us.</p>
        <Link href="/" className="mt-7 inline-flex text-base font-semibold text-violet-700 hover:underline">Back to Sayform</Link>
      </div> : <>
        <span className="grid size-11 place-items-center rounded-xl bg-violet-100 text-violet-700"><Users className="size-5" /></span>
        <p className="mt-5 text-xs font-semibold uppercase tracking-[0.13em] text-violet-700">Coaching beta</p>
        <h1 className="mt-2 font-display text-3xl font-semibold tracking-[-0.045em] text-[var(--navy)] sm:text-4xl">Find a coach who gets you</h1>
        <p className="mt-4 leading-7 text-black">Tell us a little about yourself and what you’d like to work on. Our team will review your request and help you find a coach who fits your goals.</p>
        <div className="mt-5 rounded-xl bg-violet-50 px-4 py-3 text-sm text-violet-950"><strong>Your first trial session is on us.</strong> No payment details needed.</div>
        <form onSubmit={submit} className="mt-5 space-y-7" aria-busy={pending}>
          <fieldset disabled={pending} className="space-y-7 disabled:opacity-70">
            <div className="space-y-4">
              <label className="block text-sm font-medium text-[var(--navy)]" htmlFor="email">Email address *
                <Input id="email" type="email" value={email} onChange={e => setEmail(e.target.value)} required maxLength={254} autoComplete="email" placeholder="you@example.com" className="mt-2 h-12 bg-white" />
              </label>
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block text-sm font-medium text-[var(--navy)]" htmlFor="current-role">Current role *
                  <Input id="current-role" value={currentRole} onChange={e => setCurrentRole(e.target.value)} required minLength={2} maxLength={160} autoComplete="organization-title" placeholder="e.g. Product Manager" className="mt-2 h-12 bg-white" />
                </label>
                <label className="block text-sm font-medium text-[var(--navy)]" htmlFor="company">Company *
                  <Input id="company" value={company} onChange={e => setCompany(e.target.value)} required minLength={2} maxLength={160} autoComplete="organization" placeholder="Your company" className="mt-2 h-12 bg-white" />
                </label>
              </div>
            </div>
            <Choices title="What brings you to coaching?" hint="Select all that apply." options={coachingGoals} selected={goals} onChange={setGoals} />
            <Choices title="What do you find challenging?" hint="Select the areas you’d like to work on." options={speakingChallenges} selected={challenges} onChange={setChallenges} />
            <fieldset>
              <legend className="text-base font-semibold text-[var(--navy)]">What’s your budget per session? *</legend>
              <p className="mb-3 mt-2 text-sm text-[var(--muted-ink)]">For sessions after your free trial, in USD. This helps us find a suitable match and isn’t a commitment to pay.</p>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {sessionBudgets.map(budget => <label key={budget} className={`flex cursor-pointer items-center gap-2 rounded-xl border p-3 text-sm ${sessionBudget === budget ? 'border-violet-400 bg-violet-50 text-violet-950' : 'border-[#e3dced] text-[#514161]'}`}>
                  <input type="radio" name="session-budget" value={budget} checked={sessionBudget === budget} onChange={() => setSessionBudget(budget)} required className="accent-violet-700" />{budget}
                </label>)}
              </div>
            </fieldset>
          </fieldset>
          {message && <p role="alert" className="rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-800">{message}</p>}
          <Button disabled={pending} type="submit" className="h-12 w-full rounded-xl bg-[linear-gradient(135deg,#8b5cf6,#6d28d9,#5b21b6)]">{pending ? 'Sending request…' : 'Request a coach match'}{!pending && <ArrowRight className="ml-1 size-4" />}</Button>
        </form>
        <p className="mt-4 text-center text-xs leading-6 text-[var(--muted-ink)]">We’ll use your responses to review your request and find a potential coach match. <Link href="/privacy" className="underline underline-offset-2">Privacy Policy</Link></p>
      </>}
    </section>
  </main>;
}

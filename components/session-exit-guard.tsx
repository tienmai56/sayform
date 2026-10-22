'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { LogOut } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogMedia,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { practiceStorageKey, usePractice } from '@/components/practice-context';
import { finishPracticeSession, usesPersistentBackend } from '@/lib/client-data';

const exitRedirectKey = 'communication-coach:finished-on-page-exit';

function isPracticeFlowPath(pathname: string) {
  return pathname === '/practice/session' || pathname === '/practice/feedback';
}

function isAllowedSessionDestination(pathname: string) {
  return isPracticeFlowPath(pathname) || pathname === '/session/summary';
}

export function SessionExitGuard() {
  const pathname = usePathname();
  const router = useRouter();
  const practice = usePractice();
  const [open, setOpen] = useState(false);
  const [destination, setDestination] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pageExitHandled = useRef(false);
  const previousPath = useRef(pathname);

  const hasSavableSession = Boolean(
    practice.activeSessionId
      && practice.answerCount > 0
      && !practice.activeExercise,
  );
  const shouldGuard = hasSavableSession && isPracticeFlowPath(pathname);

  const finishInput = useCallback(() => {
    if (!practice.activeSessionId) return null;
    return {
      sessionId: practice.activeSessionId,
      goal: practice.goalTitle,
      goalTemplateKey: practice.goalTemplateKey,
      categories: practice.categories,
      prompt: practice.prompt,
      answerCount: practice.answerCount,
      startedAt: practice.sessionStartedAt,
    };
  }, [
    practice.activeSessionId,
    practice.answerCount,
    practice.categories,
    practice.goalTemplateKey,
    practice.goalTitle,
    practice.prompt,
    practice.sessionStartedAt,
  ]);

  useEffect(() => {
    if (window.sessionStorage.getItem(exitRedirectKey) !== '1') return;
    window.sessionStorage.removeItem(exitRedirectKey);
    if (isPracticeFlowPath(pathname)) router.replace('/history');
  }, [pathname, router]);

  useEffect(() => {
    const previous = previousPath.current;
    previousPath.current = pathname;
    if (
      !hasSavableSession
      || !isPracticeFlowPath(previous)
      || isAllowedSessionDestination(pathname)
    ) return;

    const requestedDestination = `${pathname}${window.location.search}${window.location.hash}`;
    setDestination(requestedDestination);
    setError(null);
    setOpen(true);
    router.replace(previous);
  }, [hasSavableSession, pathname, router]);

  useEffect(() => {
    if (!shouldGuard) return;

    function interceptLink(event: MouseEvent) {
      if (
        event.defaultPrevented
        || event.button !== 0
        || event.metaKey
        || event.ctrlKey
        || event.shiftKey
        || event.altKey
      ) return;

      const target = event.target;
      if (!(target instanceof Element)) return;
      const anchor = target.closest<HTMLAnchorElement>('a[href]');
      if (!anchor || anchor.target === '_blank' || anchor.hasAttribute('download')) return;

      const url = new URL(anchor.href, window.location.href);
      if (url.origin !== window.location.origin || isAllowedSessionDestination(url.pathname)) return;
      if (url.pathname === pathname && url.search === window.location.search) return;

      event.preventDefault();
      event.stopPropagation();
      setDestination(`${url.pathname}${url.search}${url.hash}`);
      setError(null);
      setOpen(true);
    }

    document.addEventListener('click', interceptLink, true);
    return () => document.removeEventListener('click', interceptLink, true);
  }, [pathname, shouldGuard]);

  useEffect(() => {
    if (!shouldGuard) return;

    function warnBeforeUnload(event: BeforeUnloadEvent) {
      event.preventDefault();
    }

    function finishOnPageExit() {
      if (pageExitHandled.current) return;
      pageExitHandled.current = true;
      const input = finishInput();
      if (!input) return;

      window.sessionStorage.setItem(exitRedirectKey, '1');
      window.sessionStorage.removeItem(practiceStorageKey);

      if (!usesPersistentBackend) {
        void finishPracticeSession(input);
        return;
      }

      const payload = JSON.stringify({ title: input.goal });
      const endpoint = `/api/sessions/${input.sessionId}/finish`;
      const sent = navigator.sendBeacon(
        endpoint,
        new Blob([payload], { type: 'application/json' }),
      );
      if (!sent) {
        void fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: payload,
          keepalive: true,
        });
      }
    }

    window.addEventListener('beforeunload', warnBeforeUnload);
    window.addEventListener('pagehide', finishOnPageExit);
    return () => {
      window.removeEventListener('beforeunload', warnBeforeUnload);
      window.removeEventListener('pagehide', finishOnPageExit);
    };
  }, [finishInput, shouldGuard]);

  async function endSessionAndLeave() {
    const input = finishInput();
    if (!input || !destination) return;
    setSaving(true);
    setError(null);
    try {
      await finishPracticeSession(input);
      practice.resetSession();
      const nextDestination = destination;
      setOpen(false);
      setDestination(null);
      router.push(nextDestination);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'The session could not be saved. Please try again.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <AlertDialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (saving) return;
        setOpen(nextOpen);
        if (!nextOpen) {
          setDestination(null);
          setError(null);
        }
      }}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogMedia className="bg-[var(--sand)] text-[var(--navy)]">
            <LogOut className="size-5" />
          </AlertDialogMedia>
          <AlertDialogTitle>End this session?</AlertDialogTitle>
          <AlertDialogDescription>
            Leaving without ending the session won’t save your session metrics and feedback.
          </AlertDialogDescription>
        </AlertDialogHeader>
        {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
        <AlertDialogFooter>
          <AlertDialogCancel disabled={saving}>Keep practising</AlertDialogCancel>
          <Button onClick={() => void endSessionAndLeave()} disabled={saving}>
            {saving ? 'Saving session…' : 'End session and leave'}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

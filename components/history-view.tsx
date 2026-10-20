'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { CalendarDays, ChevronRight, Filter, History as HistoryIcon, Search, Trash2, VideoOff } from 'lucide-react';
import { AppShell, PageHeader, Screen } from '@/components/app-shell';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogMedia,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { cn } from '@/lib/utils';
import { deleteSession, listHistory } from '@/lib/client-data';
import type { PracticeSession } from '@/lib/types';

export function HistoryView() {
  const router = useRouter();
  const [sessions, setSessions] = useState<PracticeSession[]>([]);
  const [filter, setFilter] = useState('All goals');
  const [query, setQuery] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [deletedTitle, setDeletedTitle] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    void listHistory()
      .then(setSessions)
      .catch((caught) => setError(caught instanceof Error ? caught.message : 'History could not be loaded.'))
      .finally(() => setLoading(false));
  }, []);

  const filters = useMemo(
    () => ['All goals', ...Array.from(new Set(sessions.map((session) => session.goal)))],
    [sessions],
  );

  const visibleSessions = useMemo(
    () =>
      sessions.filter((session) => {
        const matchesFilter = filter === 'All goals' || session.goal === filter;
        const matchesQuery = `${session.title} ${session.goal} ${session.categories.join(' ')}`.toLowerCase().includes(query.toLowerCase());
        return matchesFilter && matchesQuery;
      }),
    [filter, query, sessions],
  );

  async function confirmDelete() {
    if (!deleteTarget) return;
    const target = sessions.find((session) => session.id === deleteTarget);
    try {
      await deleteSession(deleteTarget);
      if (target) setDeletedTitle(target.title);
      setSessions((current) => current.filter((session) => session.id !== deleteTarget));
      setDeleteTarget(null);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'The session could not be deleted.');
      setDeleteTarget(null);
    }
  }

  return (
    <AppShell>
      <Screen>
        <PageHeader
          eyebrow="History"
          title="Your practice sessions"
          description="Revisit questions, transcripts, coaching, and exercises. Recordings are never stored in History."
          action={
            <Button onClick={() => router.push('/practice/setup')} className="h-10 rounded-xl bg-[var(--navy)] px-4 hover:bg-[#1d4255]">Start a new session</Button>
          }
        />

        {deletedTitle && (
          <div className="mb-5 flex items-center justify-between rounded-xl border border-[var(--line)] bg-white px-4 py-3 text-sm text-[var(--muted-ink)] shadow-[var(--shadow-sm)]">
            <span>“{deletedTitle}” was permanently deleted.</span>
            <button onClick={() => setDeletedTitle('')} className="text-xs font-semibold text-[var(--teal-dark)]">Dismiss</button>
          </div>
        )}

        {error && (
          <div role="alert" className="mb-5 flex items-center justify-between rounded-xl border border-[#e8c6bf] bg-[var(--rose-soft)] px-4 py-3 text-sm text-[#8f4336]">
            <span>{error}</span><button onClick={() => setError('')} className="text-xs font-semibold">Dismiss</button>
          </div>
        )}

        <div className="mb-6 flex items-center justify-between gap-4 rounded-2xl border border-[var(--line)] bg-[var(--paper)] p-3 shadow-[var(--shadow-sm)]">
          <div className="flex items-center gap-2">
            <Filter className="ml-2 size-4 text-[var(--muted-ink)]" />
            {filters.map((item) => (
              <button
                key={item}
                onClick={() => setFilter(item)}
                className={cn(
                  'rounded-xl px-3 py-2 text-xs font-medium',
                  filter === item ? 'bg-[var(--mint-soft)] text-[var(--teal-dark)]' : 'text-[var(--muted-ink)] hover:bg-[var(--warm)]',
                )}
              >
                {item}
              </button>
            ))}
          </div>
          <div className="relative w-72">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[var(--muted-ink)]" />
            <Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search sessions" className="h-9 bg-white pl-9" />
          </div>
        </div>

        <div className="mb-5 flex items-center justify-between">
          <p className="text-sm font-semibold text-[var(--navy)]">{visibleSessions.length} sessions</p>
          <p className="text-xs text-[var(--muted-ink)]">Newest first</p>
        </div>

        {loading ? (
          <div className="grid min-h-80 place-items-center rounded-3xl border border-dashed border-[#bcc8c4] bg-white/45 text-sm text-[var(--muted-ink)]">Loading session history…</div>
        ) : visibleSessions.length > 0 ? (
          <div className="space-y-4">
            {visibleSessions.map((session) => (
              <article key={session.id} className="group grid grid-cols-[150px_minmax(0,1fr)_330px_44px] items-center gap-6 rounded-2xl border border-[var(--line)] bg-[var(--paper)] p-5 shadow-[var(--shadow-sm)] transition-all hover:border-[#bcc8c4] hover:shadow-md">
                <div className="border-r border-[var(--line)] pr-5">
                  <p className="flex items-center gap-1.5 text-xs font-medium text-[var(--muted-ink)]"><CalendarDays className="size-3.5" />{session.date.split(' · ')[0]}</p>
                  <p className="mt-2 font-display text-xl font-semibold text-[var(--navy)]">{session.duration}</p>
                  <p className="mt-0.5 text-xs text-[var(--muted-ink)]">{session.answers} answers</p>
                </div>

                <button onClick={() => router.push(`/history/${session.id}`)} className="min-w-0 text-left">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-full bg-[var(--mint-soft)] px-2.5 py-1 text-[10px] font-semibold text-[var(--teal-dark)]">{session.goal}</span>
                    {session.hasExercise && <span className="rounded-full bg-[var(--amber-soft)] px-2.5 py-1 text-[10px] font-semibold text-[#805d1c]">Exercise completed</span>}
                  </div>
                  <h2 className="mt-3 truncate text-base font-semibold text-[var(--navy)]">{session.title}</h2>
                  <p className="mt-1 truncate text-sm text-[var(--muted-ink)]">{session.takeaway}</p>
                </button>

                <button aria-label={`Open metrics for ${session.title}`} onClick={() => router.push(`/history/${session.id}`)} className="grid grid-cols-3 gap-3 text-left">
                  <div><p className="text-[11px] text-[var(--muted-ink)]">Avg. pace</p><p className="mt-1 text-sm font-semibold text-[var(--navy)]">{session.averageWpm} WPM</p></div>
                  <div><p className="text-[11px] text-[var(--muted-ink)]">Fillers</p><p className="mt-1 text-sm font-semibold text-[var(--navy)]">{session.fillerCount}</p></div>
                  <div><p className="text-[11px] text-[var(--muted-ink)]">Playback</p><p className="mt-1 flex items-center gap-1 text-sm font-semibold text-[var(--muted-ink)]"><VideoOff className="size-3.5" />None</p></div>
                </button>

                <div className="flex flex-col items-center gap-1">
                  <button onClick={() => router.push(`/history/${session.id}`)} className="grid size-8 place-items-center rounded-lg text-[var(--muted-ink)] hover:bg-[var(--mint-soft)] hover:text-[var(--teal-dark)]" aria-label={`Open ${session.title}`}><ChevronRight className="size-4" /></button>
                  <button onClick={() => setDeleteTarget(session.id)} className="grid size-8 place-items-center rounded-lg text-[var(--muted-ink)] opacity-0 hover:bg-[var(--rose-soft)] hover:text-[#a24838] group-hover:opacity-100 focus:opacity-100" aria-label={`Delete ${session.title}`}><Trash2 className="size-4" /></button>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <div className="grid min-h-80 place-items-center rounded-3xl border border-dashed border-[#bcc8c4] bg-white/45 text-center">
            <div><HistoryIcon className="mx-auto size-8 text-[var(--teal)]" /><h2 className="mt-4 text-base font-semibold text-[var(--navy)]">No sessions match this view</h2><p className="mt-1 text-sm text-[var(--muted-ink)]">Try another goal or clear your search.</p></div>
          </div>
        )}
      </Screen>

      <AlertDialog open={Boolean(deleteTarget)} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent className="rounded-2xl p-6">
          <AlertDialogHeader>
            <AlertDialogMedia className="bg-[var(--rose-soft)] text-[#a24838]"><Trash2 className="size-5" /></AlertDialogMedia>
            <AlertDialogTitle>Permanently delete this session?</AlertDialogTitle>
            <AlertDialogDescription>This removes its transcripts, feedback, metrics, exercise, and suggestion ratings. It cannot be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="-mx-6 -mb-6 px-6 py-4">
            <AlertDialogCancel>Keep session</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={() => void confirmDelete()}>Delete permanently</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppShell>
  );
}

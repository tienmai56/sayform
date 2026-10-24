'use client';

import Image from 'next/image';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  BookOpenText,
  ChevronRight,
  Dumbbell,
  History,
  Settings,
  LogOut,
  Target,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/components/auth-provider';

const navigation = [
  { label: 'Goals', href: '/goals', icon: Target },
  { label: 'Exercises', href: '/exercises', icon: Dumbbell },
  { label: 'History', href: '/history', icon: History },
];

export function Brand({ inverted = false }: { inverted?: boolean }) {
  return (
    <Link href="/goals" className="inline-flex items-center" aria-label="Sayform home">
      <span className="relative block h-9 w-[136px] overflow-hidden" aria-hidden="true">
        <Image
          src="/sayform-logo.png"
          alt=""
          width={1600}
          height={608}
          priority
          className={cn(
            'absolute -left-8 -top-5 h-auto w-[200px] max-w-none',
            inverted && 'brightness-0 invert',
          )}
        />
      </span>
    </Link>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const useWhiteCanvas = pathname.startsWith('/goals');
  const { configured, user, signOut } = useAuth();
  const displayName = user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'Tien';
  const initials = String(displayName).split(/\s+/).map((part) => part[0]).join('').slice(0, 2).toUpperCase();

  return (
    <div className={cn('min-h-screen text-[var(--ink)]', useWhiteCanvas ? 'bg-white' : 'bg-[var(--canvas)]')}>
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-[248px] border-r border-[var(--line)] bg-[var(--paper)] px-5 py-6 lg:flex lg:flex-col">
        <Brand />
        <nav className="mt-11 space-y-1" aria-label="Primary navigation">
          {navigation.map((item) => {
            const active = pathname.startsWith(item.href.split('/').slice(0, 2).join('/'));
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors',
                  active
                    ? 'bg-[var(--mint-soft)] text-[var(--teal-dark)]'
                    : 'text-[var(--muted-ink)] hover:bg-[var(--warm)] hover:text-[var(--ink)]',
                )}
              >
                <Icon className="size-[18px]" />
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="mt-auto rounded-2xl border border-[var(--line)] bg-[var(--canvas)] p-4">
          <div className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.11em] text-[var(--teal-dark)]">
            <BookOpenText className="size-4" />
            Today’s focus
          </div>
          <p className="text-sm font-medium leading-5 text-[var(--ink)]">Lead with your main point</p>
          <p className="mt-1 text-xs leading-5 text-[var(--muted-ink)]">One decision, one reason, one example.</p>
        </div>

        <div className="mt-5 flex items-center gap-3 border-t border-[var(--line)] pt-5">
          <span className="grid size-9 place-items-center rounded-full bg-[var(--sand)] text-sm font-semibold text-[var(--navy)]">{initials || 'CC'}</span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">{displayName}</p>
            <p className="truncate text-xs text-[var(--muted-ink)]">{configured ? user?.email : 'Demo mode · this browser'}</p>
          </div>
          {configured ? (
            <button onClick={() => void signOut()} className="grid size-8 place-items-center rounded-lg text-[var(--muted-ink)] hover:bg-[var(--warm)] hover:text-[var(--ink)]" aria-label="Sign out"><LogOut className="size-4" /></button>
          ) : (
            <Settings className="size-4 text-[var(--muted-ink)]" />
          )}
        </div>
      </aside>

      <header className="sticky top-0 z-20 flex h-16 items-center justify-between border-b border-[var(--line)] bg-[color:rgba(250,249,246,0.92)] px-5 backdrop-blur lg:hidden">
        <Brand />
        <Link href="/goals" className="rounded-lg bg-[var(--navy)] px-3 py-2 text-xs font-semibold text-white">
          Choose goal
        </Link>
      </header>

      <main className={cn('min-h-screen lg:pl-[248px]', useWhiteCanvas && 'bg-white')}>{children}</main>
    </div>
  );
}

export function PageHeader({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="mb-8 flex items-end justify-between gap-6">
      <div>
        {eyebrow && (
          <p className="mb-2 text-xs font-semibold uppercase tracking-[0.13em] text-[var(--teal-dark)]">{eyebrow}</p>
        )}
        <h1 className="font-display text-3xl font-semibold tracking-[-0.035em] text-[var(--navy)] md:text-[38px]">{title}</h1>
        {description && <p className="mt-2 max-w-2xl text-[15px] leading-6 text-[var(--muted-ink)]">{description}</p>}
      </div>
      {action}
    </div>
  );
}

export function Breadcrumbs({ items }: { items: { label: string; href?: string }[] }) {
  return (
    <nav aria-label="Breadcrumb" className="mb-6 flex items-center gap-1.5 text-sm text-[var(--muted-ink)]">
      {items.map((item, index) => (
        <span key={`${item.label}-${index}`} className="flex items-center gap-1.5">
          {index > 0 && <ChevronRight className="size-3.5" />}
          {item.href ? (
            <Link href={item.href} className="transition-colors hover:text-[var(--ink)]">{item.label}</Link>
          ) : (
            <span className="font-medium text-[var(--ink)]">{item.label}</span>
          )}
        </span>
      ))}
    </nav>
  );
}

export function Screen({ children, wide = false }: { children: React.ReactNode; wide?: boolean }) {
  return <div className={cn('mx-auto w-full px-6 py-9 md:px-10 md:py-12', wide ? 'max-w-[1500px]' : 'max-w-[1160px]')}>{children}</div>;
}

export function MetricCard({ label, value, detail }: { label: string; value: string; detail: string }) {
  return (
    <div className="rounded-2xl border border-[var(--line)] bg-white p-4 shadow-[var(--shadow-sm)]">
      <p className="text-xs font-medium text-[var(--muted-ink)]">{label}</p>
      <p className="mt-2 font-display text-2xl font-semibold tracking-[-0.03em] text-[var(--navy)]">{value}</p>
      <p className="mt-1 text-xs leading-5 text-[var(--muted-ink)]">{detail}</p>
    </div>
  );
}

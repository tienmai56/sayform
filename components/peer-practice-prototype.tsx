'use client';

import { useState } from 'react';
import {
  ArrowRight,
  CalendarDays,
  Camera,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  Clock3,
  Headphones,
  LockKeyhole,
  Mic,
  Plus,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  Trash2,
  Video,
  Wifi,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';

type Screen =
  | 'landing'
  | 'profile'
  | 'portal'
  | 'network'
  | 'schedule'
  | 'confirmation'
  | 'lobby'
  | 'interview'
  | 'feedback';

type ProfileForm = {
  name: string;
  role: string;
  company: string;
  timezone: string;
  bio: string;
};

type AvailabilityBlock = {
  id: string;
  start: string;
  end: string;
};

type WeeklyAvailability = Record<string, AvailabilityBlock[]>;

const interviewOptions = [
  {
    id: 'Product sense',
    description: 'Product design, improvement, and prioritization prompts',
  },
  {
    id: 'Leadership',
    description: 'Influence, conflict, and cross-functional situations',
  },
  {
    id: 'Analytics',
    description: 'Metrics, diagnosis, and experimentation',
  },
  {
    id: 'Execution',
    description: 'Tradeoffs, sequencing, and delivery',
  },
  {
    id: 'Strategy',
    description: 'Markets, positioning, and product growth',
  },
  {
    id: 'General PM',
    description: 'A flexible interview across common PM topics',
  },
] as const;

const availabilityDays = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const timeOptions = [
  '8:00 AM',
  '9:00 AM',
  '10:00 AM',
  '11:00 AM',
  '12:00 PM',
  '1:00 PM',
  '2:00 PM',
  '3:00 PM',
  '4:00 PM',
  '5:00 PM',
  '6:00 PM',
  '7:00 PM',
  '8:00 PM',
  '9:00 PM',
  '10:00 PM',
];

const initialAvailability: WeeklyAvailability = {
  Tue: [
    { id: 'tue-morning', start: '8:00 AM', end: '10:00 AM' },
    { id: 'tue-evening', start: '5:00 PM', end: '7:00 PM' },
  ],
  Wed: [{ id: 'wed-evening', start: '6:00 PM', end: '9:00 PM' }],
  Thu: [{ id: 'thu-evening', start: '5:00 PM', end: '9:00 PM' }],
};

const peers = [
  {
    initials: 'AP',
    name: 'Avery Patel',
    role: 'Senior Product Manager',
    company: 'Northstar Labs',
    tags: ['Product sense', 'Leadership'],
    availability: 'Tue–Thu evenings',
    note: 'B2B SaaS · Pacific Time',
  },
  {
    initials: 'JK',
    name: 'Jordan Kim',
    role: 'Group Product Manager',
    company: 'Ledgerly',
    tags: ['Strategy', 'Execution'],
    availability: 'Wednesday and Saturday',
    note: 'Fintech · Eastern Time',
  },
  {
    initials: 'MC',
    name: 'Maya Chen',
    role: 'Product Lead',
    company: 'Bright AI',
    tags: ['Analytics', 'Product sense'],
    availability: 'Mon–Wed mornings',
    note: 'Consumer AI · Pacific Time',
  },
] as const;

const slots = [
  { id: 'tue-630', day: 'Tue, Nov 3', time: '6:30 PM' },
  { id: 'wed-600', day: 'Wed, Nov 4', time: '6:00 PM' },
  { id: 'thu-600', day: 'Thu, Nov 5', time: '6:00 PM' },
  { id: 'thu-730', day: 'Thu, Nov 5', time: '7:30 PM' },
] as const;

const progressLabels = ['Profile'];

function Logo() {
  return (
    <span className="font-display text-2xl font-semibold tracking-[-0.045em] text-[#6842d8]">
      sayform
    </span>
  );
}

function PrototypeHeader({
  stage,
  reset,
}: {
  stage: number;
  reset: () => void;
}) {
  return (
    <header className="sticky top-0 z-40 border-b border-[#e6def7] bg-white/95 backdrop-blur">
      <div className="mx-auto flex h-[72px] max-w-[1500px] items-center gap-8 px-8">
        <Logo />
        <div className="flex items-center gap-2 rounded-full bg-[var(--warm)] px-3 py-1.5 text-xs font-semibold text-[var(--teal-dark)]">
          <span className="size-2 rounded-full bg-[#8b5cf6]" />
          UI prototype · local only
        </div>
        <ol className="ml-auto flex items-center gap-2" aria-label="Prototype progress">
          {progressLabels.map((label, index) => (
            <li key={label} className="flex items-center gap-2">
              {index > 0 && <span className="h-px w-7 bg-[var(--line)]" />}
              <span
                className={cn(
                  'grid size-7 place-items-center rounded-full border text-xs font-semibold',
                  index < stage &&
                    'border-[#7c3aed] bg-[#7c3aed] text-white',
                  index === stage &&
                    'border-[var(--navy)] bg-[var(--navy)] text-white',
                  index > stage &&
                    'border-[var(--line)] bg-white text-[var(--muted-ink)]',
                )}
              >
                {index < stage ? <Check className="size-3.5" /> : index + 1}
              </span>
              <span
                className={cn(
                  'hidden text-xs font-medium xl:inline',
                  index === stage
                    ? 'text-[var(--ink)]'
                    : 'text-[var(--muted-ink)]',
                )}
              >
                {label}
              </span>
            </li>
          ))}
        </ol>
        <Button
          type="button"
          variant="ghost"
          onClick={reset}
          className="h-9 rounded-xl px-3 text-[var(--muted-ink)]"
        >
          <RefreshCw className="size-4" />
          Reset demo
        </Button>
      </div>
    </header>
  );
}

function PrivacyNote({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-3 rounded-2xl bg-[var(--mint-soft)] px-4 py-3 text-sm leading-6 text-[var(--teal-dark)]">
      <LockKeyhole className="mt-0.5 size-4 shrink-0" />
      <p>{children}</p>
    </div>
  );
}

function PeerCard({
  peer,
  onViewTimes,
}: {
  peer: (typeof peers)[number];
  onViewTimes: () => void;
}) {
  return (
    <article className="flex min-h-[310px] flex-col rounded-[1.5rem] border border-[var(--line)] bg-white p-6 shadow-[var(--shadow-sm)]">
      <div className="flex items-center gap-3">
        <span className="grid size-12 place-items-center rounded-full bg-[var(--sand)] text-sm font-semibold text-[var(--navy)]">
          {peer.initials}
        </span>
        <div>
          <h3 className="font-display text-lg font-semibold tracking-[-0.02em]">
            {peer.name}
          </h3>
          <p className="text-sm text-[var(--muted-ink)]">{peer.role}</p>
        </div>
      </div>
      <p className="mt-5 text-sm font-medium text-[var(--ink)]">
        {peer.company}
      </p>
      <p className="mt-1 text-sm text-[var(--muted-ink)]">{peer.note}</p>
      <div className="mt-5 flex flex-wrap gap-2">
        {peer.tags.map((tag) => (
          <span
            key={tag}
            className="rounded-full bg-[var(--mint-soft)] px-3 py-1.5 text-xs font-medium text-[var(--teal-dark)]"
          >
            {tag}
          </span>
        ))}
      </div>
      <div className="mt-auto pt-6">
        <p className="mb-3 flex items-center gap-2 text-sm font-medium text-[#15803d]">
          <Clock3 className="size-4" />
          {peer.availability}
        </p>
        <Button
          type="button"
          onClick={onViewTimes}
          className="h-11 w-full rounded-xl"
        >
          View Sayform times
          <ArrowRight className="size-4" />
        </Button>
      </div>
    </article>
  );
}

function CameraTile({
  name,
  status,
  accent = false,
}: {
  name: string;
  status: string;
  accent?: boolean;
}) {
  const initials = name === 'You' ? 'TM' : 'AP';
  return (
    <div
      className={cn(
        'relative flex min-h-[330px] flex-1 items-center justify-center overflow-hidden rounded-[1.75rem] border',
        accent
          ? 'border-[#a78bfa] bg-[linear-gradient(145deg,#ede9fe,#ddd6fe)]'
          : 'border-[#ded4ed] bg-[linear-gradient(145deg,#f4f0fb,#e8e0f3)]',
      )}
    >
      <div className="text-center">
        <span
          className={cn(
            'mx-auto grid size-24 place-items-center rounded-full text-2xl font-semibold shadow-sm',
            accent
              ? 'bg-[#c4b5fd] text-[#3b1767]'
              : 'bg-white text-[var(--navy)]',
          )}
        >
          {initials}
        </span>
        <p className="mt-5 font-display text-xl font-semibold">{name}</p>
        <p className="mt-1 text-sm text-[var(--muted-ink)]">{status}</p>
      </div>
      <div className="absolute bottom-4 left-4 flex items-center gap-2 rounded-full bg-white/90 px-3 py-2 text-xs font-medium shadow-sm">
        <Mic className="size-3.5 text-[#15803d]" />
        Microphone on
      </div>
    </div>
  );
}

function PeerPracticePortal({
  profile,
  interviewTypes,
  days,
  availability,
}: {
  profile: ProfileForm;
  interviewTypes: string[];
  days: string[];
  availability: WeeklyAvailability;
}) {
  const initials = profile.name
    .trim()
    .split(/\s+/)
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
  const timeBlockCount = days.reduce(
    (total, day) => total + (availability[day]?.length ?? 0),
    0,
  );

  return (
    <main className="min-h-screen bg-[var(--canvas)] text-[var(--ink)]">
      <aside className="fixed inset-y-0 left-0 flex w-[224px] flex-col border-r border-[#e6def7] bg-white px-5 py-6">
        <Logo />
        <nav className="mt-11 space-y-1" aria-label="Portal navigation">
          {['Home', 'Discover', 'Exercises', 'History'].map((label) => (
            <div
              key={label}
              className={cn(
                'px-3 py-2.5 text-sm font-medium',
                label === 'Discover'
                  ? 'bg-[#faf8ff] text-[#6842d8]'
                  : 'text-[var(--muted-ink)]',
              )}
            >
              {label}
            </div>
          ))}
        </nav>
        <div className="mt-auto flex items-center gap-3 border-t border-[var(--line)] pt-5">
          <span className="grid size-10 place-items-center rounded-full bg-[var(--sand)] text-sm font-semibold text-[var(--navy)]">
            {initials || 'PM'}
          </span>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold">{profile.name}</p>
            <p className="truncate text-xs text-[var(--muted-ink)]">
              {profile.role}
            </p>
          </div>
        </div>
      </aside>

      <section className="min-h-screen pl-[224px]">
        <header className="flex h-[72px] items-center justify-between border-b border-[#e6def7] bg-white px-10">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--teal-dark)]">
              Sayform portal
            </p>
          </div>
          <span className="rounded-full bg-[var(--mint-soft)] px-3 py-1.5 text-xs font-semibold text-[var(--teal-dark)]">
            Profile active
          </span>
        </header>

        <div className="mx-auto max-w-[1180px] px-10 py-11">
          <p className="text-xs font-semibold uppercase tracking-[0.13em] text-[var(--teal-dark)]">
            Discover
          </p>
          <h1 className="mt-3 font-display text-4xl font-semibold tracking-[-0.045em] text-[var(--navy)]">
            Find a PM to practice with
          </h1>
          <p className="mt-3 text-base leading-7 text-[var(--muted-ink)]">
            Meet other product managers, compare interview focus areas, and see
            who is available for a peer mock interview.
          </p>

          <div className="mt-8 flex items-start gap-4 rounded-[1.5rem] border border-[#c4b5fd] bg-[linear-gradient(135deg,#f5f3ff,#ede9fe)] p-6">
            <span className="grid size-11 shrink-0 place-items-center rounded-full bg-white text-[#6842d8] shadow-sm">
              <CheckCircle2 className="size-5" />
            </span>
            <div>
              <h2 className="font-display text-xl font-semibold tracking-[-0.025em]">
                Your peer-practice profile is live
              </h2>
              <p className="mt-1 text-sm leading-6 text-[var(--muted-ink)]">
                Other product managers can now discover your profile and request
                one of your available time blocks.
              </p>
            </div>
          </div>

          <div className="mt-7 grid grid-cols-[1.05fr_0.95fr] gap-6">
            <article className="rounded-[1.5rem] border border-[var(--line)] bg-white p-7 shadow-[var(--shadow-sm)]">
              <p className="text-xs font-semibold uppercase tracking-[0.1em] text-[var(--teal-dark)]">
                Your practice profile
              </p>
              <div className="mt-5 flex items-center gap-4">
                <span className="grid size-14 place-items-center rounded-full bg-[var(--sand)] font-semibold text-[var(--navy)]">
                  {initials || 'PM'}
                </span>
                <div>
                  <h2 className="font-display text-xl font-semibold">
                    {profile.name}
                  </h2>
                  <p className="mt-1 text-sm text-[var(--muted-ink)]">
                    {profile.role} · {profile.company}
                  </p>
                </div>
              </div>
              <div className="mt-6 flex flex-wrap gap-2">
                {interviewTypes.map((type) => (
                  <span
                    key={type}
                    className="rounded-full bg-[var(--mint-soft)] px-3 py-1.5 text-xs font-medium text-[var(--teal-dark)]"
                  >
                    {type}
                  </span>
                ))}
              </div>
              <div className="mt-6 border-t border-[var(--line)] pt-5">
                <p className="text-sm font-semibold">Availability</p>
                <p className="mt-1 text-sm text-[var(--muted-ink)]">
                  {days.length} {days.length === 1 ? 'day' : 'days'} ·{' '}
                  {timeBlockCount}{' '}
                  {timeBlockCount === 1 ? 'time block' : 'time blocks'} ·{' '}
                  {profile.timezone}
                </p>
              </div>
            </article>

            <article className="rounded-[1.5rem] border border-[var(--line)] bg-white p-7 shadow-[var(--shadow-sm)]">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.1em] text-[var(--teal-dark)]">
                    Upcoming sessions
                  </p>
                  <h2 className="mt-2 font-display text-xl font-semibold">
                    Nothing scheduled yet
                  </h2>
                </div>
                <span className="grid size-11 place-items-center rounded-full bg-[var(--warm)] text-[var(--teal-dark)]">
                  <CalendarDays className="size-5" />
                </span>
              </div>
              <p className="mt-4 text-sm leading-6 text-[var(--muted-ink)]">
                Your confirmed peer interviews will appear here with the Sayform
                room link and session details.
              </p>
              <div className="mt-6 rounded-2xl border border-dashed border-[#cbbce7] bg-[var(--warm)] px-5 py-6 text-center text-sm text-[var(--muted-ink)]">
                No upcoming sessions
              </div>
            </article>
          </div>

          <section className="mt-9">
            <div className="flex items-end justify-between gap-6">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.1em] text-[var(--teal-dark)]">
                  People on Sayform
                </p>
                <h2 className="mt-2 font-display text-2xl font-semibold tracking-[-0.03em]">
                  Available practice partners
                </h2>
              </div>
              <span className="text-sm text-[var(--muted-ink)]">
                {peers.length} profiles
              </span>
            </div>

            <div className="mt-5 grid grid-cols-3 gap-5">
              {peers.map((peer) => (
                <article
                  key={peer.name}
                  className="rounded-[1.5rem] border border-[var(--line)] bg-white p-6 shadow-[var(--shadow-sm)]"
                >
                  <div className="flex items-center gap-3">
                    <span className="grid size-12 place-items-center rounded-full bg-[var(--sand)] text-sm font-semibold text-[var(--navy)]">
                      {peer.initials}
                    </span>
                    <div className="min-w-0">
                      <h3 className="truncate font-display text-lg font-semibold tracking-[-0.02em]">
                        {peer.name}
                      </h3>
                      <p className="truncate text-sm text-[var(--muted-ink)]">
                        {peer.role}
                      </p>
                    </div>
                  </div>
                  <p className="mt-5 text-sm font-medium">{peer.company}</p>
                  <p className="mt-1 text-sm text-[var(--muted-ink)]">
                    {peer.note}
                  </p>
                  <div className="mt-5 flex flex-wrap gap-2">
                    {peer.tags.map((tag) => (
                      <span
                        key={tag}
                        className="rounded-full bg-[var(--mint-soft)] px-3 py-1.5 text-xs font-medium text-[var(--teal-dark)]"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                  <p className="mt-6 flex items-center gap-2 border-t border-[var(--line)] pt-4 text-sm font-medium text-[#15803d]">
                    <Clock3 className="size-4" />
                    {peer.availability}
                  </p>
                </article>
              ))}
            </div>
          </section>
        </div>
      </section>
    </main>
  );
}

export function PeerPracticePrototype() {
  const [screen, setScreen] = useState<Screen>('profile');
  const [profileStep, setProfileStep] = useState(1);
  const [profile, setProfile] = useState<ProfileForm>({
    name: 'Tien Mai',
    role: 'Product Manager',
    company: 'Acme',
    timezone: 'Pacific Time',
    bio: 'I work on B2B products and want to practise structured product thinking with other PMs.',
  });
  const [interviewTypes, setInterviewTypes] = useState<string[]>([
    'Product sense',
    'Leadership',
  ]);
  const [days, setDays] = useState<string[]>(['Tue', 'Wed', 'Thu']);
  const [availability, setAvailability] =
    useState<WeeklyAvailability>(initialAvailability);
  const [selectedSlot, setSelectedSlot] = useState('thu-600');
  const [consented, setConsented] = useState(true);
  const [round, setRound] = useState<1 | 2>(1);

  const stage =
    screen === 'feedback'
      ? 3
      : screen === 'lobby' || screen === 'interview'
        ? 2
        : screen === 'network' ||
            screen === 'schedule' ||
            screen === 'confirmation'
          ? 1
          : 0;

  const chosenSlot =
    slots.find((slot) => slot.id === selectedSlot) ?? slots[2];

  function goTo(next: Screen) {
    setScreen(next);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function resetDemo() {
    setScreen('profile');
    setProfileStep(1);
    setSelectedSlot('thu-600');
    setConsented(true);
    setRound(1);
    setDays(['Tue', 'Wed', 'Thu']);
    setAvailability(initialAvailability);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function toggleInterviewType(type: string) {
    setInterviewTypes((current) =>
      current.includes(type)
        ? current.filter((item) => item !== type)
        : [...current, type],
    );
  }

  function toggleDay(day: string) {
    if (days.includes(day)) {
      setDays((current) => current.filter((item) => item !== day));
      return;
    }

    setDays((current) => [...current, day]);
    setAvailability((current) => ({
      ...current,
      [day]: current[day]?.length
        ? current[day]
        : [
            {
              id: `${day.toLowerCase()}-${Date.now()}`,
              start: '6:00 PM',
              end: '9:00 PM',
            },
          ],
    }));
  }

  function addTimeBlock(day: string) {
    setAvailability((current) => ({
      ...current,
      [day]: [
        ...(current[day] ?? []),
        {
          id: `${day.toLowerCase()}-${Date.now()}`,
          start: '5:00 PM',
          end: '7:00 PM',
        },
      ],
    }));
  }

  function updateTimeBlock(
    day: string,
    blockId: string,
    field: 'start' | 'end',
    value: string,
  ) {
    setAvailability((current) => ({
      ...current,
      [day]: (current[day] ?? []).map((block) => {
        if (block.id !== blockId) return block;

        if (field === 'start') {
          const startIndex = timeOptions.indexOf(value);
          const currentEndIndex = timeOptions.indexOf(block.end);

          return {
            ...block,
            start: value,
            end:
              currentEndIndex > startIndex
                ? block.end
                : timeOptions[startIndex + 1],
          };
        }

        return { ...block, end: value };
      }),
    }));
  }

  function removeTimeBlock(day: string, blockId: string) {
    const remainingBlocks = (availability[day] ?? []).filter(
      (block) => block.id !== blockId,
    );

    setAvailability((current) => ({
      ...current,
      [day]: remainingBlocks,
    }));

    if (remainingBlocks.length === 0) {
      setDays((current) => current.filter((item) => item !== day));
    }
  }

  if (screen === 'portal') {
    return (
      <PeerPracticePortal
        profile={profile}
        interviewTypes={interviewTypes}
        days={days}
        availability={availability}
      />
    );
  }

  return (
    <main className="min-h-screen bg-[var(--canvas)] text-[var(--ink)]">
      <PrototypeHeader stage={stage} reset={resetDemo} />

      {screen === 'landing' && (
        <section className="relative overflow-hidden">
          <div
            aria-hidden="true"
            className="absolute -left-32 top-8 size-[30rem] rounded-full bg-[#c4b5fd]/30 blur-3xl"
          />
          <div
            aria-hidden="true"
            className="absolute -right-24 top-36 size-[28rem] rounded-full bg-[#e9d5ff]/45 blur-3xl"
          />
          <div className="relative mx-auto grid min-h-[calc(100vh-72px)] max-w-[1380px] grid-cols-[1.05fr_0.95fr] items-center gap-16 px-12 py-16">
            <div className="max-w-[650px]">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--teal-dark)]">
                Peer mock interviews with private coaching
              </p>
              <h1 className="mt-5 font-display text-[64px] font-semibold leading-[1.02] tracking-[-0.055em] text-[var(--navy)]">
                Give a mock interview. Get one back.
              </h1>
              <p className="mt-7 max-w-[600px] text-lg leading-8 text-[var(--muted-ink)]">
                Meet other product managers, practise inside Sayform, and get
                targeted feedback grounded in what you actually said.
              </p>
              <div className="mt-9 flex items-center gap-4">
                <Button
                  type="button"
                  onClick={() => goTo('profile')}
                  className="h-13 rounded-xl px-6 text-base shadow-[0_12px_28px_rgba(43,23,69,0.18)]"
                >
                  Sign up to practice
                  <ArrowRight className="size-4" />
                </Button>
                <span className="text-sm text-[var(--muted-ink)]">
                  3-minute profile setup
                </span>
              </div>
              <div className="mt-10 grid grid-cols-3 gap-5 border-t border-[var(--line)] pt-7">
                {[
                  ['1:1', 'Peer sessions'],
                  ['2 rounds', 'Roles automatically swap'],
                  ['Private', 'Feedback for each PM'],
                ].map(([value, label]) => (
                  <div key={label}>
                    <p className="font-display text-xl font-semibold">{value}</p>
                    <p className="mt-1 text-sm text-[var(--muted-ink)]">{label}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="relative mx-auto w-full max-w-[560px]">
              <div className="absolute -inset-5 rotate-2 rounded-[2.25rem] bg-[#ddd6fe]/70" />
              <div className="relative rounded-[2rem] border border-[var(--line)] bg-white p-7 shadow-[var(--shadow-lg)]">
                <div className="flex items-center justify-between">
                  <span className="rounded-full bg-[var(--mint-soft)] px-3 py-1.5 text-xs font-semibold text-[var(--teal-dark)]">
                    Available this week
                  </span>
                  <ShieldCheck className="size-5 text-[#15803d]" />
                </div>
                <div className="mt-8 flex items-center gap-4">
                  <span className="grid size-16 place-items-center rounded-full bg-[var(--sand)] text-lg font-semibold">
                    AP
                  </span>
                  <div>
                    <h2 className="font-display text-2xl font-semibold tracking-[-0.03em]">
                      Avery Patel
                    </h2>
                    <p className="mt-1 text-sm text-[var(--muted-ink)]">
                      Senior Product Manager · Northstar Labs
                    </p>
                  </div>
                </div>
                <div className="mt-7 flex flex-wrap gap-2">
                  {['Product sense', 'Leadership'].map((tag) => (
                    <span
                      key={tag}
                      className="rounded-full bg-[var(--mint-soft)] px-3 py-1.5 text-sm font-medium text-[var(--teal-dark)]"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
                <div className="mt-8 rounded-2xl bg-[var(--warm)] p-5">
                  <p className="flex items-center gap-2 text-sm font-semibold">
                    <CalendarDays className="size-4 text-[var(--teal-dark)]" />
                    Next available
                  </p>
                  <div className="mt-4 grid grid-cols-3 gap-2">
                    {['Tue · 6:30', 'Wed · 6:00', 'Thu · 6:00'].map((time) => (
                      <span
                        key={time}
                        className="rounded-xl border border-[var(--line)] bg-white px-3 py-2 text-center text-xs font-medium"
                      >
                        {time}
                      </span>
                    ))}
                  </div>
                </div>
                <PrivacyNote>
                  Every booked session opens a Sayform interview room. Feedback
                  remains private to each participant.
                </PrivacyNote>
              </div>
            </div>
          </div>
        </section>
      )}

      {screen === 'profile' && (
        <section className="mx-auto grid max-w-[1260px] grid-cols-[260px_1fr] gap-10 px-10 py-12">
          <aside className="rounded-[1.5rem] bg-[var(--warm)] p-6">
            <p className="text-xs font-semibold uppercase tracking-[0.13em] text-[var(--teal-dark)]">
              Create your profile
            </p>
            <h2 className="mt-3 font-display text-2xl font-semibold tracking-[-0.03em]">
              Join the peer network
            </h2>
            <ol className="mt-8 space-y-3">
              {['About you', 'Interview types', 'Availability'].map(
                (label, index) => {
                  const step = index + 1;
                  return (
                    <li
                      key={label}
                      className={cn(
                        'flex items-center gap-3 rounded-xl px-3 py-3 text-sm',
                        step === profileStep
                          ? 'bg-white font-semibold shadow-sm'
                          : 'text-[var(--muted-ink)]',
                      )}
                    >
                      <span
                        className={cn(
                          'grid size-7 place-items-center rounded-full border text-xs font-semibold',
                          step < profileStep &&
                            'border-[#7c3aed] bg-[#7c3aed] text-white',
                          step === profileStep &&
                            'border-[var(--navy)] bg-[var(--navy)] text-white',
                          step > profileStep &&
                            'border-[var(--line)] bg-white text-[var(--muted-ink)]',
                        )}
                      >
                        {step < profileStep ? <Check className="size-3.5" /> : step}
                      </span>
                      {label}
                    </li>
                  );
                },
              )}
            </ol>
            <div className="mt-8 border-t border-[var(--line)] pt-6">
              <p className="text-sm leading-6 text-[var(--muted-ink)]">
                Your email, recordings, transcripts, and coaching reports are
                never shown on your public profile.
              </p>
            </div>
          </aside>

          <div className="rounded-[1.75rem] border border-[var(--line)] bg-white p-9 shadow-[var(--shadow-sm)]">
            {profileStep === 1 && (
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.13em] text-[var(--teal-dark)]">
                  Step 1 of 3
                </p>
                <h1 className="mt-3 font-display text-4xl font-semibold tracking-[-0.045em]">
                  Tell us about yourself
                </h1>
                <p className="mt-3 text-base leading-7 text-[var(--muted-ink)]">
                  Other PMs use this information to choose a relevant practice
                  partner.
                </p>
                <div className="mt-8 grid grid-cols-2 gap-5">
                  <label htmlFor="peer-name" className="text-sm font-medium">
                    Full name
                    <Input
                      id="peer-name"
                      value={profile.name}
                      onChange={(event) =>
                        setProfile({ ...profile, name: event.target.value })
                      }
                      className="mt-2 h-12 bg-white"
                    />
                  </label>
                  <label htmlFor="peer-role" className="text-sm font-medium">
                    Current role
                    <Input
                      id="peer-role"
                      value={profile.role}
                      onChange={(event) =>
                        setProfile({ ...profile, role: event.target.value })
                      }
                      className="mt-2 h-12 bg-white"
                    />
                  </label>
                  <label htmlFor="peer-company" className="text-sm font-medium">
                    Company
                    <Input
                      id="peer-company"
                      value={profile.company}
                      onChange={(event) =>
                        setProfile({ ...profile, company: event.target.value })
                      }
                      className="mt-2 h-12 bg-white"
                    />
                  </label>
                  <label className="text-sm font-medium">
                    Time zone
                    <select
                      value={profile.timezone}
                      onChange={(event) =>
                        setProfile({ ...profile, timezone: event.target.value })
                      }
                      className="mt-2 h-12 w-full rounded-lg border border-input bg-white px-3 text-sm outline-none focus:border-ring focus:ring-3 focus:ring-ring/50"
                    >
                      <option>Pacific Time</option>
                      <option>Mountain Time</option>
                      <option>Central Time</option>
                      <option>Eastern Time</option>
                      <option>GMT / UK</option>
                    </select>
                  </label>
                  <label
                    htmlFor="peer-introduction"
                    className="col-span-2 text-sm font-medium"
                  >
                    Short introduction <span className="font-normal text-[var(--muted-ink)]">(optional)</span>
                    <Textarea
                      id="peer-introduction"
                      value={profile.bio}
                      onChange={(event) =>
                        setProfile({ ...profile, bio: event.target.value })
                      }
                      className="mt-2 min-h-24 bg-white"
                    />
                  </label>
                </div>
                <div className="mt-8 flex justify-end">
                  <Button
                    type="button"
                    disabled={!profile.name || !profile.role || !profile.company}
                    onClick={() => setProfileStep(2)}
                    className="h-11 rounded-xl px-5"
                  >
                    Continue
                    <ArrowRight className="size-4" />
                  </Button>
                </div>
              </div>
            )}

            {profileStep === 2 && (
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.13em] text-[var(--teal-dark)]">
                  Step 2 of 3
                </p>
                <h1 className="mt-3 font-display text-4xl font-semibold tracking-[-0.045em]">
                  Which interviews can you offer?
                </h1>
                <p className="mt-3 text-base leading-7 text-[var(--muted-ink)]">
                  Select every format you would feel comfortable leading for
                  another product manager.
                </p>
                <div className="mt-8 grid grid-cols-2 gap-4">
                  {interviewOptions.map((option) => {
                    const selected = interviewTypes.includes(option.id);
                    return (
                      <button
                        key={option.id}
                        type="button"
                        aria-pressed={selected}
                        onClick={() => toggleInterviewType(option.id)}
                        className={cn(
                          'flex min-h-24 items-start gap-4 rounded-2xl border p-5 text-left transition-colors',
                          selected
                            ? 'border-[#8b5cf6] bg-[var(--mint-soft)]'
                            : 'border-[var(--line)] bg-white hover:bg-[var(--warm)]',
                        )}
                      >
                        <span
                          className={cn(
                            'mt-0.5 grid size-5 shrink-0 place-items-center rounded border',
                            selected
                              ? 'border-[#7c3aed] bg-[#7c3aed] text-white'
                              : 'border-[#b9a9d5] bg-white',
                          )}
                        >
                          {selected && <Check className="size-3.5" />}
                        </span>
                        <span>
                          <span className="block text-sm font-semibold">
                            {option.id}
                          </span>
                          <span className="mt-1 block text-sm leading-6 text-[var(--muted-ink)]">
                            {option.description}
                          </span>
                        </span>
                      </button>
                    );
                  })}
                </div>
                <div className="mt-8 flex items-center justify-between">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setProfileStep(1)}
                    className="h-11 rounded-xl px-5"
                  >
                    <ChevronLeft className="size-4" />
                    Back
                  </Button>
                  <Button
                    type="button"
                    disabled={interviewTypes.length === 0}
                    onClick={() => setProfileStep(3)}
                    className="h-11 rounded-xl px-5"
                  >
                    Continue
                    <ArrowRight className="size-4" />
                  </Button>
                </div>
              </div>
            )}

            {profileStep === 3 && (
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.13em] text-[var(--teal-dark)]">
                  Step 3 of 3
                </p>
                <h1 className="mt-3 font-display text-4xl font-semibold tracking-[-0.045em]">
                  When are you usually available?
                </h1>
                <p className="mt-3 text-base leading-7 text-[var(--muted-ink)]">
                  Peers will select a time inside Sayform. You can update or
                  pause these hours at any time.
                </p>
                <div className="mt-8 rounded-2xl border border-[var(--line)] bg-[var(--warm)] p-6">
                  <div className="flex items-start justify-between gap-6">
                    <div>
                      <p className="text-sm font-semibold">Days available</p>
                      <p className="mt-1 text-xs leading-5 text-[var(--muted-ink)]">
                        Select a day, then add every time block that works for you.
                      </p>
                    </div>
                    <span className="rounded-full bg-white px-3 py-1.5 text-xs font-medium text-[var(--teal-dark)]">
                      {profile.timezone}
                    </span>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {availabilityDays.map((day) => {
                      const selected = days.includes(day);
                      return (
                        <button
                          key={day}
                          type="button"
                          aria-pressed={selected}
                          onClick={() => toggleDay(day)}
                          className={cn(
                            'h-10 min-w-14 rounded-xl border px-4 text-sm font-semibold',
                            selected
                              ? 'border-[var(--navy)] bg-[var(--navy)] text-white'
                              : 'border-[var(--line)] bg-white text-[var(--muted-ink)]',
                          )}
                        >
                          {day}
                        </button>
                      );
                    })}
                  </div>

                  {days.length > 0 ? (
                    <div className="mt-6 space-y-3">
                      {availabilityDays
                        .filter((day) => days.includes(day))
                        .map((day) => (
                          <div
                            key={day}
                            className="rounded-2xl border border-[var(--line)] bg-white p-4"
                          >
                            <div className="flex items-center justify-between gap-4">
                              <p className="text-sm font-semibold">{day}</p>
                              <button
                                type="button"
                                onClick={() => addTimeBlock(day)}
                                className="flex items-center gap-1.5 text-xs font-semibold text-[var(--teal-dark)]"
                              >
                                <Plus className="size-3.5" />
                                Add another time
                              </button>
                            </div>
                            <div className="mt-3 space-y-3">
                              {(availability[day] ?? []).map((block, index) => (
                                <div
                                  key={block.id}
                                  className="grid grid-cols-[1fr_20px_1fr_40px] items-end gap-3"
                                >
                                  <label className="text-xs font-medium text-[var(--muted-ink)]">
                                    {index === 0 ? 'From' : 'Start'}
                                    <span className="relative mt-1.5 block">
                                      <select
                                        aria-label={`${day} block ${index + 1} start time`}
                                        value={block.start}
                                        onChange={(event) =>
                                          updateTimeBlock(
                                            day,
                                            block.id,
                                            'start',
                                            event.target.value,
                                          )
                                        }
                                        className="h-11 w-full appearance-none rounded-lg border border-input bg-white py-0 pl-3 pr-12 text-sm text-[var(--ink)] outline-none focus:border-ring focus:ring-3 focus:ring-ring/50"
                                      >
                                        {timeOptions.slice(0, -1).map((time) => (
                                          <option key={time}>{time}</option>
                                        ))}
                                      </select>
                                      <ChevronDown
                                        aria-hidden="true"
                                        className="pointer-events-none absolute right-4 top-1/2 size-4 -translate-y-1/2 text-[var(--muted-ink)]"
                                      />
                                    </span>
                                  </label>
                                  <span className="pb-3 text-center text-sm text-[var(--muted-ink)]">
                                    –
                                  </span>
                                  <label className="text-xs font-medium text-[var(--muted-ink)]">
                                    {index === 0 ? 'Until' : 'End'}
                                    <span className="relative mt-1.5 block">
                                      <select
                                        aria-label={`${day} block ${index + 1} end time`}
                                        value={block.end}
                                        onChange={(event) =>
                                          updateTimeBlock(
                                            day,
                                            block.id,
                                            'end',
                                            event.target.value,
                                          )
                                        }
                                        className="h-11 w-full appearance-none rounded-lg border border-input bg-white py-0 pl-3 pr-12 text-sm text-[var(--ink)] outline-none focus:border-ring focus:ring-3 focus:ring-ring/50"
                                      >
                                        {timeOptions
                                          .slice(
                                            timeOptions.indexOf(block.start) + 1,
                                          )
                                          .map((time) => (
                                            <option key={time}>{time}</option>
                                          ))}
                                      </select>
                                      <ChevronDown
                                        aria-hidden="true"
                                        className="pointer-events-none absolute right-4 top-1/2 size-4 -translate-y-1/2 text-[var(--muted-ink)]"
                                      />
                                    </span>
                                  </label>
                                  <button
                                    type="button"
                                    aria-label={`Remove ${day} time block ${index + 1}`}
                                    onClick={() => removeTimeBlock(day, block.id)}
                                    className="grid size-10 place-items-center rounded-lg border border-[var(--line)] text-[var(--muted-ink)] hover:border-[#fecaca] hover:bg-[#fef2f2] hover:text-[#b42318]"
                                  >
                                    <Trash2 className="size-4" />
                                  </button>
                                </div>
                              ))}
                            </div>
                          </div>
                        ))}
                    </div>
                  ) : (
                    <div className="mt-6 rounded-2xl border border-dashed border-[#b9a9d5] bg-white px-5 py-7 text-center">
                      <p className="text-sm font-semibold">Choose at least one day</p>
                      <p className="mt-1 text-xs text-[var(--muted-ink)]">
                        We will add a starter time block that you can edit.
                      </p>
                    </div>
                  )}

                  {days.length > 0 && (
                    <p className="mt-4 text-xs text-[var(--muted-ink)]">
                      {days.length} {days.length === 1 ? 'day' : 'days'} ·{' '}
                      {days.reduce(
                        (total, day) => total + (availability[day]?.length ?? 0),
                        0,
                      )}{' '}
                      {days.reduce(
                        (total, day) => total + (availability[day]?.length ?? 0),
                        0,
                      ) === 1
                        ? 'time block'
                        : 'time blocks'}
                    </p>
                  )}
                </div>
                <div className="mt-6">
                  <PrivacyNote>
                    Sayform creates the calendar invitation and uses a Sayform
                    interview room as the meeting location.
                  </PrivacyNote>
                </div>
                <div className="mt-8 flex items-center justify-between">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setProfileStep(2)}
                    className="h-11 rounded-xl px-5"
                  >
                    <ChevronLeft className="size-4" />
                    Back
                  </Button>
                  <Button
                    type="button"
                    disabled={days.length === 0}
                    onClick={() => goTo('portal')}
                    className="h-11 rounded-xl px-5"
                  >
                    Publish profile
                    <ArrowRight className="size-4" />
                  </Button>
                </div>
              </div>
            )}
          </div>
        </section>
      )}

      {screen === 'network' && (
        <section className="mx-auto max-w-[1260px] px-10 py-12">
          <div className="flex items-end justify-between gap-8">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.13em] text-[var(--teal-dark)]">
                Peer network
              </p>
              <h1 className="mt-3 font-display text-4xl font-semibold tracking-[-0.045em]">
                Find a PM to practice with
              </h1>
              <p className="mt-3 max-w-2xl text-base leading-7 text-[var(--muted-ink)]">
                Select a partner by interview focus and availability. Every
                session takes place in Sayform.
              </p>
            </div>
            <div className="rounded-2xl border border-[var(--line)] bg-white px-5 py-4 text-right shadow-[var(--shadow-sm)]">
              <p className="text-xs font-semibold uppercase tracking-[0.1em] text-[var(--teal-dark)]">
                Your profile is live
              </p>
              <p className="mt-1 text-sm text-[var(--muted-ink)]">
                {interviewTypes.slice(0, 2).join(' · ')}
              </p>
            </div>
          </div>
          <div className="mt-8 flex items-center gap-3 rounded-2xl border border-[var(--line)] bg-white p-3 shadow-[var(--shadow-sm)]">
            <Input
              aria-label="Search peers"
              placeholder="Search by company, interview type, or time zone"
              className="h-11 flex-1 border-0 bg-[var(--warm)] px-4 shadow-none focus-visible:ring-0"
            />
            {['Product sense', 'Leadership', 'Pacific Time'].map((filter) => (
              <button
                key={filter}
                type="button"
                className="h-10 rounded-full border border-[var(--line)] bg-white px-4 text-sm font-medium text-[var(--muted-ink)]"
              >
                {filter}
              </button>
            ))}
          </div>
          <div className="mt-7 grid grid-cols-3 gap-5">
            {peers.map((peer, index) => (
              <PeerCard
                key={peer.name}
                peer={peer}
                onViewTimes={() => index === 0 && goTo('schedule')}
              />
            ))}
          </div>
        </section>
      )}

      {screen === 'schedule' && (
        <section className="mx-auto max-w-[1160px] px-10 py-12">
          <button
            type="button"
            onClick={() => goTo('network')}
            className="flex items-center gap-2 text-sm font-medium text-[var(--teal-dark)]"
          >
            <ChevronLeft className="size-4" />
            Back to peer network
          </button>
          <div className="mt-6 grid grid-cols-[360px_1fr] gap-7">
            <aside className="rounded-[1.5rem] border border-[var(--line)] bg-white p-6 shadow-[var(--shadow-sm)]">
              <div className="flex items-center gap-4">
                <span className="grid size-14 place-items-center rounded-full bg-[var(--sand)] text-base font-semibold">
                  AP
                </span>
                <div>
                  <h2 className="font-display text-xl font-semibold">
                    Avery Patel
                  </h2>
                  <p className="mt-1 text-sm text-[var(--muted-ink)]">
                    Senior Product Manager
                  </p>
                </div>
              </div>
              <div className="mt-6 space-y-5 border-t border-[var(--line)] pt-6">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.1em] text-[var(--muted-ink)]">
                    Interview focus
                  </p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {['Product sense', 'Leadership'].map((tag) => (
                      <span
                        key={tag}
                        className="rounded-full bg-[var(--mint-soft)] px-3 py-1.5 text-xs font-medium text-[var(--teal-dark)]"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.1em] text-[var(--muted-ink)]">
                    Session format
                  </p>
                  <p className="mt-2 text-sm leading-6">
                    50 minutes · two 25-minute rounds · roles swap automatically
                  </p>
                </div>
                <PrivacyNote>
                  You will each receive a separate private feedback report.
                </PrivacyNote>
              </div>
            </aside>

            <div className="rounded-[1.5rem] border border-[var(--line)] bg-white p-8 shadow-[var(--shadow-sm)]">
              <p className="text-xs font-semibold uppercase tracking-[0.13em] text-[var(--teal-dark)]">
                Schedule in Sayform
              </p>
              <h1 className="mt-3 font-display text-4xl font-semibold tracking-[-0.045em]">
                Choose an interview time
              </h1>
              <p className="mt-3 text-base leading-7 text-[var(--muted-ink)]">
                Times are displayed in {profile.timezone}. Sayform will send both
                participants a calendar invitation and room link.
              </p>
              <div className="mt-8 grid grid-cols-2 gap-3">
                {slots.map((slot) => {
                  const selected = selectedSlot === slot.id;
                  return (
                    <button
                      key={slot.id}
                      type="button"
                      aria-pressed={selected}
                      onClick={() => setSelectedSlot(slot.id)}
                      className={cn(
                        'flex items-center justify-between rounded-2xl border px-5 py-4 text-left',
                        selected
                          ? 'border-[#7c3aed] bg-[var(--mint-soft)]'
                          : 'border-[var(--line)] bg-white hover:bg-[var(--warm)]',
                      )}
                    >
                      <span>
                        <span className="block text-sm font-semibold">{slot.day}</span>
                        <span className="mt-1 block text-sm text-[var(--muted-ink)]">
                          {slot.time} · 50 min
                        </span>
                      </span>
                      <span
                        className={cn(
                          'grid size-6 place-items-center rounded-full border',
                          selected
                            ? 'border-[#7c3aed] bg-[#7c3aed] text-white'
                            : 'border-[var(--line)]',
                        )}
                      >
                        {selected && <Check className="size-3.5" />}
                      </span>
                    </button>
                  );
                })}
              </div>
              <label
                htmlFor="practice-goal"
                className="mt-7 block text-sm font-medium"
              >
                What would you like to practise?
                <Textarea
                  id="practice-goal"
                  defaultValue="I want to practise structuring a product-sense answer and leading with a clear recommendation."
                  className="mt-2 min-h-24 bg-white"
                />
              </label>
              <Button
                type="button"
                onClick={() => goTo('confirmation')}
                className="mt-7 h-12 w-full rounded-xl text-base"
              >
                Book Sayform interview
                <ArrowRight className="size-4" />
              </Button>
            </div>
          </div>
        </section>
      )}

      {screen === 'confirmation' && (
        <section className="mx-auto flex min-h-[calc(100vh-72px)] max-w-[960px] items-center px-10 py-14">
          <div className="grid w-full grid-cols-[1fr_340px] gap-7 rounded-[2rem] border border-[var(--line)] bg-white p-10 shadow-[var(--shadow-lg)]">
            <div>
              <span className="grid size-14 place-items-center rounded-2xl bg-[#dcfce7] text-[#15803d]">
                <CheckCircle2 className="size-7" />
              </span>
              <p className="mt-7 text-xs font-semibold uppercase tracking-[0.13em] text-[var(--teal-dark)]">
                Interview booked
              </p>
              <h1 className="mt-3 font-display text-4xl font-semibold tracking-[-0.045em]">
                You’re meeting Avery
              </h1>
              <p className="mt-3 max-w-xl text-base leading-7 text-[var(--muted-ink)]">
                A calendar invitation has been simulated. Its meeting location
                is your private Sayform interview room.
              </p>
              <div className="mt-8 flex gap-3">
                <Button
                  type="button"
                  onClick={() => goTo('lobby')}
                  className="h-11 rounded-xl px-5"
                >
                  Preview session lobby
                  <ArrowRight className="size-4" />
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => goTo('schedule')}
                  className="h-11 rounded-xl px-5"
                >
                  Change time
                </Button>
              </div>
            </div>
            <aside className="rounded-2xl bg-[var(--warm)] p-6">
              <p className="text-xs font-semibold uppercase tracking-[0.1em] text-[var(--teal-dark)]">
                Session details
              </p>
              <div className="mt-5 space-y-5">
                <div className="flex gap-3">
                  <CalendarDays className="mt-0.5 size-4 text-[var(--teal-dark)]" />
                  <div>
                    <p className="text-sm font-semibold">{chosenSlot.day}</p>
                    <p className="mt-1 text-sm text-[var(--muted-ink)]">
                      {chosenSlot.time} · {profile.timezone}
                    </p>
                  </div>
                </div>
                <div className="flex gap-3">
                  <Clock3 className="mt-0.5 size-4 text-[var(--teal-dark)]" />
                  <div>
                    <p className="text-sm font-semibold">50 minutes</p>
                    <p className="mt-1 text-sm text-[var(--muted-ink)]">
                      Two role-swapped rounds
                    </p>
                  </div>
                </div>
                <div className="flex gap-3">
                  <Video className="mt-0.5 size-4 text-[var(--teal-dark)]" />
                  <div>
                    <p className="text-sm font-semibold">Sayform room</p>
                    <p className="mt-1 text-sm text-[var(--muted-ink)]">
                      Unique link for both participants
                    </p>
                  </div>
                </div>
              </div>
            </aside>
          </div>
        </section>
      )}

      {screen === 'lobby' && (
        <section className="mx-auto max-w-[1260px] px-10 py-10">
          <div className="flex items-end justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.13em] text-[var(--teal-dark)]">
                Session lobby
              </p>
              <h1 className="mt-3 font-display text-4xl font-semibold tracking-[-0.045em]">
                Get ready for your interview
              </h1>
              <p className="mt-3 text-base text-[var(--muted-ink)]">
                Both participants are here. Confirm devices and recording consent.
              </p>
            </div>
            <span className="rounded-full bg-[#dcfce7] px-4 py-2 text-sm font-semibold text-[#15803d]">
              Starts at {chosenSlot.time}
            </span>
          </div>
          <div className="mt-8 grid grid-cols-[1fr_360px] gap-6">
            <div className="grid grid-cols-2 gap-5">
              <CameraTile name="You" status="Interviewee · ready" accent />
              <CameraTile name="Avery Patel" status="Interviewer · ready" />
            </div>
            <aside className="rounded-[1.5rem] border border-[var(--line)] bg-white p-6 shadow-[var(--shadow-sm)]">
              <h2 className="font-display text-xl font-semibold">Before you join</h2>
              <div className="mt-5 space-y-3">
                {[
                  [Camera, 'Camera', 'On · preview looks clear'],
                  [Mic, 'Microphone', 'On · input level is good'],
                  [Wifi, 'Connection', 'Strong · 42 ms'],
                ].map(([Icon, label, detail]) => (
                  <div
                    key={String(label)}
                    className="flex items-center gap-3 rounded-xl bg-[var(--warm)] p-4"
                  >
                    <span className="grid size-9 place-items-center rounded-full bg-white text-[var(--teal-dark)]">
                      <Icon className="size-4" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold">{String(label)}</p>
                      <p className="mt-0.5 text-xs text-[var(--muted-ink)]">
                        {String(detail)}
                      </p>
                    </div>
                    <CheckCircle2 className="size-4 text-[#15803d]" />
                  </div>
                ))}
              </div>
              <button
                type="button"
                onClick={() => setConsented((value) => !value)}
                className="mt-5 flex w-full items-start gap-3 rounded-xl border border-[var(--line)] p-4 text-left"
              >
                <span
                  className={cn(
                    'mt-0.5 grid size-5 shrink-0 place-items-center rounded border',
                    consented
                      ? 'border-[#7c3aed] bg-[#7c3aed] text-white'
                      : 'border-[#b9a9d5] bg-white',
                  )}
                >
                  {consented && <Check className="size-3.5" />}
                </span>
                <span>
                  <span className="block text-sm font-semibold">
                    Recording and analysis consent
                  </span>
                  <span className="mt-1 block text-xs leading-5 text-[var(--muted-ink)]">
                    I consent to this session being recorded and analyzed for my
                    private feedback.
                  </span>
                </span>
              </button>
              <div className="mt-5 rounded-xl bg-[var(--mint-soft)] p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.1em] text-[var(--teal-dark)]">
                  Round 1
                </p>
                <p className="mt-2 text-sm font-semibold">Avery interviews you</p>
                <p className="mt-1 text-xs leading-5 text-[var(--muted-ink)]">
                  Roles automatically swap after 25 minutes.
                </p>
              </div>
              <Button
                type="button"
                disabled={!consented}
                onClick={() => goTo('interview')}
                className="mt-5 h-12 w-full rounded-xl text-base"
              >
                Join Sayform interview
                <ArrowRight className="size-4" />
              </Button>
            </aside>
          </div>
        </section>
      )}

      {screen === 'interview' && (
        <section className="min-h-[calc(100vh-72px)] bg-[#f4f0fa]">
          <div className="flex h-[68px] items-center border-b border-[#ded5ec] bg-white px-8">
            <span className="rounded-full bg-[var(--mint-soft)] px-3 py-1.5 text-xs font-semibold text-[var(--teal-dark)]">
              Round {round} of 2
            </span>
            <p className="ml-4 text-sm font-medium">
              {round === 1 ? 'Avery interviews you' : 'You interview Avery'}
            </p>
            <div className="ml-auto flex items-center gap-5">
              <span className="flex items-center gap-2 text-sm font-semibold tabular-nums">
                <Clock3 className="size-4" />
                {round === 1 ? '18:42' : '21:08'} remaining
              </span>
              <span className="flex items-center gap-2 rounded-full bg-[#fef2f2] px-3 py-1.5 text-xs font-semibold text-[#b91c1c]">
                <span className="size-2 rounded-full bg-[#dc2626]" />
                Recording
              </span>
              <span className="flex items-center gap-2 text-xs text-[var(--muted-ink)]">
                <LockKeyhole className="size-3.5" />
                Private feedback
              </span>
            </div>
          </div>
          <div className="grid min-h-[calc(100vh-140px)] grid-cols-[1fr_390px]">
            <div className="p-6">
              <div className="grid grid-cols-2 gap-5">
                <CameraTile
                  name="You"
                  status={round === 1 ? 'Interviewee' : 'Interviewer'}
                  accent={round === 1}
                />
                <CameraTile
                  name="Avery Patel"
                  status={round === 1 ? 'Interviewer' : 'Interviewee'}
                  accent={round === 2}
                />
              </div>
              <div className="mt-5 flex items-center justify-center gap-3">
                {[Camera, Mic, Headphones].map((Icon, index) => (
                  <button
                    key={index}
                    type="button"
                    aria-label={['Toggle camera', 'Toggle microphone', 'Audio settings'][index]}
                    className="grid size-11 place-items-center rounded-full border border-[#d7cce7] bg-white text-[var(--navy)] shadow-sm"
                  >
                    <Icon className="size-4" />
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => goTo('feedback')}
                  className="ml-3 h-11 rounded-full bg-[#b42318] px-5 text-sm font-semibold text-white"
                >
                  Leave session
                </button>
              </div>
            </div>
            <aside className="border-l border-[#ded5ec] bg-white p-7">
              <p className="text-xs font-semibold uppercase tracking-[0.13em] text-[var(--teal-dark)]">
                Interview guide
              </p>
              <h2 className="mt-4 font-display text-2xl font-semibold tracking-[-0.03em]">
                {round === 1 ? 'You are the interviewee' : 'You are the interviewer'}
              </h2>
              <p className="mt-2 text-sm leading-6 text-[var(--muted-ink)]">
                {round === 1
                  ? 'Think aloud, make assumptions explicit, and lead with a recommendation.'
                  : 'Guide the conversation, listen for structure, and ask one useful follow-up.'}
              </p>
              <div className="mt-6 rounded-2xl bg-[var(--warm)] p-5">
                <p className="text-xs font-semibold uppercase tracking-[0.1em] text-[var(--teal-dark)]">
                  Current question
                </p>
                <p className="mt-3 text-base font-semibold leading-7">
                  {round === 1
                    ? 'How would you improve activation for a new marketplace product?'
                    : 'Design a launch strategy for an AI assistant for small businesses.'}
                </p>
                <p className="mt-3 text-xs leading-5 text-[var(--muted-ink)]">
                  The conversation is peer-led. Use this prompt only when helpful.
                </p>
              </div>
              <div className="mt-6 space-y-3">
                {[
                  'Keep the main answer under 3 minutes',
                  'Ask one clarifying question',
                  'Leave 2 minutes for reflection',
                ].map((item) => (
                  <p key={item} className="flex items-start gap-2 text-sm leading-6">
                    <CheckCircle2 className="mt-1 size-4 shrink-0 text-[#15803d]" />
                    {item}
                  </p>
                ))}
              </div>
              <div className="mt-6 rounded-2xl bg-[var(--mint-soft)] p-4 text-sm leading-6 text-[var(--teal-dark)]">
                {round === 1
                  ? 'When this round ends, Sayform swaps the roles and tracks Avery as the interviewee.'
                  : 'After this round, Sayform will process two separate private feedback reports.'}
              </div>
              <Button
                type="button"
                onClick={() => {
                  if (round === 1) setRound(2);
                  else goTo('feedback');
                }}
                className="mt-6 h-12 w-full rounded-xl text-base"
              >
                {round === 1 ? 'End round & swap roles' : 'Finish interview'}
                <ArrowRight className="size-4" />
              </Button>
            </aside>
          </div>
        </section>
      )}

      {screen === 'feedback' && (
        <section className="mx-auto max-w-[1260px] px-10 py-12">
          <div className="flex items-start justify-between gap-8">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.13em] text-[var(--teal-dark)]">
                Private report · Round 1
              </p>
              <h1 className="mt-3 font-display text-4xl font-semibold tracking-[-0.045em]">
                Your targeted feedback
              </h1>
              <p className="mt-3 max-w-3xl text-base leading-7 text-[var(--muted-ink)]">
                You communicated strong evidence and stayed composed. The biggest
                opportunity is to state your recommendation sooner and make the
                central tradeoff explicit.
              </p>
            </div>
            <span className="flex items-center gap-2 rounded-full bg-[var(--mint-soft)] px-4 py-2 text-sm font-semibold text-[var(--teal-dark)]">
              <LockKeyhole className="size-4" />
              Only you can see this
            </span>
          </div>

          <div className="mt-8 grid grid-cols-4 gap-4">
            {[
              ['118', 'Words per minute', 'Clear conversational pace'],
              ['4', 'Filler words', 'Mostly during the opening'],
              ['9 sec', 'Time to main point', 'Aim for under five seconds'],
              ['72%', 'Direct answers', 'Strong, with room to tighten'],
            ].map(([value, label, detail]) => (
              <div
                key={label}
                className="rounded-2xl border border-[var(--line)] bg-white p-5 shadow-[var(--shadow-sm)]"
              >
                <p className="font-display text-3xl font-semibold tracking-[-0.04em]">
                  {value}
                </p>
                <p className="mt-2 text-sm font-semibold">{label}</p>
                <p className="mt-1 text-xs leading-5 text-[var(--muted-ink)]">
                  {detail}
                </p>
              </div>
            ))}
          </div>

          <div className="mt-6 grid grid-cols-[1.15fr_0.85fr] gap-6">
            <div className="rounded-[1.5rem] border border-[var(--line)] bg-white p-7 shadow-[var(--shadow-sm)]">
              <div className="flex items-center gap-3">
                <span className="grid size-10 place-items-center rounded-xl bg-[var(--mint-soft)] text-[var(--teal-dark)]">
                  <Sparkles className="size-5" />
                </span>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.1em] text-[var(--teal-dark)]">
                    Highest-impact change
                  </p>
                  <h2 className="mt-1 font-display text-2xl font-semibold">
                    Lead with the decision
                  </h2>
                </div>
              </div>
              <p className="mt-5 text-base leading-7 text-[var(--muted-ink)]">
                Your supporting analysis was relevant, but the recommendation
                arrived after the listener had already processed several options.
                Put the decision in the first sentence, then explain why.
              </p>
              <blockquote className="mt-6 rounded-2xl border-l-4 border-[#8b5cf6] bg-[var(--warm)] px-5 py-4 text-sm leading-6 text-[var(--ink)]">
                “I considered three possible activation levers before eventually
                choosing guided supply onboarding…”
                <footer className="mt-2 text-xs font-medium text-[var(--teal-dark)]">
                  08:14–08:27 · Product-sense answer
                </footer>
              </blockquote>
              <div className="mt-6 border-t border-[var(--line)] pt-5">
                <p className="text-sm font-semibold">Try this instead</p>
                <p className="mt-2 text-sm leading-6 text-[var(--muted-ink)]">
                  “I would prioritize guided supply onboarding because the
                  marketplace cannot activate demand until new suppliers reach
                  their first successful listing.”
                </p>
              </div>
            </div>

            <aside className="rounded-[1.5rem] bg-[var(--navy)] p-7 text-white shadow-[var(--shadow-lg)]">
              <span className="inline-flex rounded-full bg-white/12 px-3 py-1.5 text-xs font-semibold text-[#ddd6fe]">
                Recommended exercise
              </span>
              <h2 className="mt-5 font-display text-2xl font-semibold tracking-[-0.03em]">
                60-second recommendation drill
              </h2>
              <p className="mt-3 text-sm leading-6 text-[#d8cde5]">
                Answer the same prompt again. Give your recommendation first,
                then support it with two reasons and one explicit tradeoff.
              </p>
              <div className="mt-6 rounded-2xl bg-white/10 p-5">
                <p className="text-xs font-semibold uppercase tracking-[0.1em] text-[#c4b5fd]">
                  Practice prompt
                </p>
                <p className="mt-3 text-sm font-medium leading-6">
                  What would you prioritize in the first 90 days?
                </p>
              </div>
              <Button
                type="button"
                onClick={() => {
                  setRound(1);
                  goTo('network');
                }}
                className="mt-6 h-11 w-full rounded-xl bg-white text-[var(--navy)] hover:bg-[#f3efff]"
              >
                Find another practice partner
                <ArrowRight className="size-4" />
              </Button>
            </aside>
          </div>
        </section>
      )}
    </main>
  );
}

# Communication Coach

A desktop-first Next.js application for practising spoken English and reviewing evidence-linked communication feedback.

## Run locally

Requirements: Node.js 22.13 or newer and pnpm.

```bash
pnpm install
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000). The root route opens onboarding.

Without Supabase credentials, the app runs in demo mode and stores goals and session history in this browser. This keeps the full product flow testable while the backend is being configured.

## Enable accounts and persistence

Phase 2 uses Supabase Auth and PostgreSQL. The checked-in migration creates the product tables, ownership indexes, cascade rules, and row-level security policies.

1. Create a Supabase project, or start the local Supabase stack from this directory:

   ```bash
   pnpm dlx supabase start
   ```

2. Copy `.env.example` to `.env.local` and add the project URL and publishable key shown by the Supabase project’s Connect dialog or local status output.
3. For a hosted project, apply the checked-in migration:

   ```bash
   pnpm dlx supabase link --project-ref YOUR_PROJECT_REF
   pnpm dlx supabase db push
   ```

4. Add `http://localhost:3000/auth/callback` to the project’s allowed Auth redirect URLs.
5. Restart `pnpm dev`, create an account at `/login`, and complete onboarding.

Do not commit `.env.local`. The publishable key is intended for browser use; row-level security is still responsible for isolating each account’s records.

## Prototype walkthrough

1. Choose communication goals during onboarding.
2. Select a goal on the Goals dashboard.
3. Choose one or more practice categories and a question.
4. Allow camera and microphone access, then use **Start speaking** and **Done speaking**.
5. Review the mock transcript, objective metrics, evidence-linked coaching, full-screen report, and Helpful/Unhelpful controls. With Supabase configured, the response and ratings are saved to the signed-in account.
6. Continue to another question or end the session.
7. Review the aggregate summary, start the optional exercise, or open History.
8. Filter History, open a text-only saved session, or permanently delete a session and its child records after confirmation.

If camera access is unavailable, use the prototype fallback on the permission error screen. It exercises the same navigation and mock-feedback flow without recording media.

## Checks

```bash
pnpm typecheck
pnpm lint
pnpm build
```

## Phase 2 scope

- Supabase email/password authentication with cookie-based server sessions and protected application routes.
- PostgreSQL persistence for goals, sessions, responses, metrics, feedback, summaries, exercises, and analysis jobs.
- Row-level security and ownership checks on every user-owned table.
- API routes that follow the PRD/ADR contract, including idempotent mock analysis, feedback ratings, session finalization, history, and cascade deletion.
- The browser uploads no media. A camera recording is held in browser memory only for immediate replay and is released when the user continues or ends the session.
- Speech-to-text and qualitative coaching still use realistic mock output behind an analysis provider boundary. No AI provider or temporary audio storage is connected yet.

## Main project structure

```text
app/api/                 Authenticated product API routes
app/auth/callback/       Supabase PKCE callback
components/              Product screens and shared providers
lib/analysis/            Mock analysis provider boundary
lib/supabase/            Browser, server, and session-refresh clients
supabase/migrations/     Versioned PostgreSQL schema and RLS policies
```

# Communication Coach

A desktop-first Next.js application for practising spoken English and reviewing evidence-linked communication feedback.

## Run locally

Requirements: Node.js 22.13 or newer and pnpm.

```bash
pnpm install
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000). The root route opens the Goals page (or the login page when Supabase is enabled and no account is signed in).

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
5. Restart `pnpm dev`, create an account at `/login`, and open the Goals page.

Do not commit `.env.local`. The publishable key is intended for browser use; row-level security is still responsible for isolating each account’s records.

## Enable real speech analysis

Create an OpenRouter API key and add these server-only values to `.env.local`:

```bash
OPENROUTER_API_KEY=sk-or-v1-your-key
OPENROUTER_TRANSCRIPTION_MODEL=openai/gpt-4o-mini-transcribe
OPENROUTER_FEEDBACK_MODEL=openai/gpt-5-mini
```

Restart `pnpm dev` after changing the file. The API key must never use a `NEXT_PUBLIC_` prefix or be committed. The browser keeps video local, uploads a temporary audio-only recording for analysis, and stores only the resulting transcript, metrics, and coaching.

## Prototype walkthrough

1. Choose one of the three predefined goals—**Communicate with clarity**, **Negotiate effectively**, or **Tell compelling stories**—or create a custom goal.
2. Enter the practice room. The coach evaluates every skill inside the chosen goal after each answer.
3. Review the goal’s practice category, optionally add a topic, and select a question beside the camera preview.
4. Allow camera and microphone access, then use **Start speaking** and **Done speaking**.
5. Review the real transcript, objective metrics, evidence-linked coaching, full-screen report, and Helpful/Unhelpful controls. With Supabase and OpenRouter configured, the response and ratings are saved to the signed-in account.
6. Continue to another question or end the session.
7. Review patterns across the completed answers. Only then is one optional exercise recommended from the saved feedback and its transcript evidence.
8. Complete or skip that exercise, then open History to revisit the text-only session record.

If camera access is unavailable, choose **Use microphone only**. Speech analysis still works without uploading video.

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
- API routes that follow the PRD/ADR contract, including idempotent analysis, feedback ratings, session finalization, history, and cascade deletion.
- A camera recording is held in browser memory only for immediate replay and is released when the user continues or ends the session. Only a temporary audio-only recording is sent to OpenRouter and it is not stored by the application.
- OpenRouter speech-to-text produces the transcript. Deterministic metrics measure pace, vocabulary variety, and fillers, while structured model output produces evidence-linked coaching across all five dimensions.
- Session summaries and the single recommended exercise are generated only after completion and reference saved feedback and transcript evidence.

## Main project structure

```text
app/api/                 Authenticated product API routes
app/auth/callback/       Supabase PKCE callback
components/              Product screens and shared providers
lib/analysis/            Speech metrics plus mock and OpenRouter provider boundaries
lib/supabase/            Browser, server, and session-refresh clients
supabase/migrations/     Versioned PostgreSQL schema and RLS policies
```

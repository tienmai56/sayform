# Sayform

A desktop-first Next.js application for practising spoken English and reviewing evidence-linked communication feedback.

## Run locally

Requirements: Node.js 22.13 or newer and pnpm.

```bash
pnpm install
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000). The root route opens the public Sayform landing page. Sign in to open the authenticated Goals dashboard.

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

4. In Supabase **Authentication → URL Configuration**, add `http://localhost:3000/auth/callback` to the allowed redirect URLs. Add the matching `/auth/callback` URL for each deployed environment too.
5. To enable **Continue with Google**:
   - In Google Auth Platform, create a **Web application** OAuth client. Add your app origin (for example, `http://localhost:3000`) under **Authorized JavaScript origins**.
   - Under **Authorized redirect URIs**, add the Supabase callback shown on the Supabase Google provider page. Hosted projects use `https://<project-ref>.supabase.co/auth/v1/callback`; the local Supabase stack uses `http://127.0.0.1:54321/auth/v1/callback`.
   - In Supabase **Authentication → Sign In / Providers → Google**, enable the provider and add the Google client ID and client secret.
6. Restart `pnpm dev`. Approved members sign in at `/signin` with Google or email and password.

## Invite-only access

The public `/login` route collects each candidate's email and target roles instead of creating an account. The original account form remains available at `/signin` for people you approve.

Apply the latest migration before accepting requests:

```bash
pnpm dlx supabase login
pnpm dlx supabase db push
```

To approve someone:

1. Open **Supabase → Table Editor → access_requests**.
2. Change their `status` from `pending` to `approved`.
3. Send them the `/signin` URL. They must use the same email address they requested access with.

Only an authenticated user whose email has an `approved` row can open product pages or call product APIs. Accounts that existed before the migration are approved automatically.

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

1. Your active goal appears at the top of `/goals` with its own Summary and Lesson insights dashboard. Use **Change goal** or **Set as active goal** to switch explicitly; Sayform never changes it based on recent practice.
2. Choose **Practise this goal** for the active goal, or create a custom goal.
3. Enter the practice room. The coach evaluates every skill inside the chosen goal after each answer.
4. For the Interview goal, paste the interview question you want to practise. An experienced-manager coach evaluates the answer and generates one grounded follow-up question from your prompt and response.
5. Allow camera and microphone access, then use **Start speaking** and **Done speaking**.
6. Review the real transcript, objective metrics, evidence-linked coaching, full-screen report, and Helpful/Unhelpful controls. With Supabase and OpenRouter configured, the response and ratings are saved to the signed-in account.
7. Continue to another question or end the session.
8. Review patterns across the completed answers. Only then is one optional exercise recommended from the saved feedback and its transcript evidence.
9. Complete or skip that exercise, then open History to revisit the text-only session record. The active goal dashboard recomputes from the remaining saved transcripts and feedback.

If camera access is unavailable, choose **Use microphone only**. Speech analysis still works without uploading video.

## Checks

```bash
pnpm typecheck
pnpm lint
pnpm build
```

## Phase 2 scope

- Supabase Google OAuth and email/password authentication with cookie-based server sessions and protected application routes.
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

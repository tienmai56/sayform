# Communication Coach frontend prototype

A desktop-first Next.js prototype for practising spoken English and reviewing evidence-linked communication feedback.

## Run locally

Requirements: Node.js 22.13 or newer and pnpm.

```bash
pnpm install
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000). The root route opens onboarding.

## Prototype walkthrough

1. Choose communication goals during onboarding.
2. Select a goal on the Goals dashboard.
3. Choose one or more practice categories and a question.
4. Allow camera and microphone access, then use **Start speaking** and **Done speaking**.
5. Review the mock transcript, objective metrics, evidence-linked coaching, full-screen report, and Helpful/Unhelpful controls.
6. Continue to another question or end the session.
7. Review the aggregate summary, start the optional exercise, or open History.
8. Filter History, open a text-only saved session, or permanently delete a session after confirmation.

If camera access is unavailable, use the prototype fallback on the permission error screen. It exercises the same navigation and mock-feedback flow without recording media.

## Checks

```bash
pnpm typecheck
pnpm lint
pnpm build
```

## Phase 1 boundaries

- All coaching, transcripts, metrics, sessions, and exercises use local mock data.
- No AI, speech-to-text, authentication, Supabase, uploads, or server persistence are connected.
- A real camera recording is held in browser memory only for the immediate feedback view and is released when the user continues or ends the session.

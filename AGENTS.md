# AGENTS.md

## Cursor Cloud specific instructions

### Overview

Norixo is a single Next.js 16 App Router application (not a monorepo) for auditing and optimizing short-term rental listings (Airbnb, Booking.com, VRBO, etc.). It uses TypeScript, Tailwind CSS v4, and pnpm as its package manager.

### Running the app

- **Dev server**: `pnpm dev` (starts on port 3000)
- **Build**: `pnpm build`
- **Lint**: `pnpm lint` (ESLint with flat config; there are pre-existing lint errors in the codebase)

### Environment variables

A `.env.local` file is needed. The app uses Supabase, Stripe, and OpenAI clients that read env vars at import time. For local development without real credentials, set placeholder values:

- `NEXT_PUBLIC_SUPABASE_URL` — any valid URL (placeholder OK)
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` — any string
- `SUPABASE_SERVICE_ROLE_KEY` — any string
- `NEXT_PUBLIC_APP_URL` — the local dev server URL (default port 3000)
- `STRIPE_SECRET_KEY` — any `sk_test_*` string
- `STRIPE_WEBHOOK_SECRET` — any `whsec_*` string
- `SCRAPER_MODE` — set to `fallback`

Setting `SCRAPER_MODE=fallback` bypasses the BrightData scraping requirement.

### Key gotchas

- The `pnpm.onlyBuiltDependencies` field in `package.json` whitelists `sharp` and `unrs-resolver` for post-install build scripts. Without this, pnpm will show warnings about ignored build scripts.
- The `/dashboard` route requires Supabase auth — with placeholder credentials it redirects to `/sign-in`.
- The `/analyze` page uses a mock audit preview (client-side `setTimeout`), so it works without real API keys.
- The `/demo` page shows a fully static demo report.
- The app has no automated test suite (no `test` script in `package.json`).
- Lint runs via `pnpm lint` but exits with code 1 due to pre-existing `@typescript-eslint/no-explicit-any` and `@typescript-eslint/no-unused-vars` errors in the codebase.

Listing Conversion Optimizer
============================

SaaS MVP for auditing and improving short–term rental listings (Airbnb, Booking, etc.)
using Next.js 14 App Router, TypeScript, Tailwind CSS, and mock integrations for
Supabase, Stripe, and OpenAI.

Stack
-----

- Next.js 14 (App Router)
- TypeScript
- Tailwind CSS (v4, via `@tailwindcss/postcss`)
- Mock Supabase auth/database layer
- Mock Stripe billing helpers
- Mock OpenAI-powered audit generator

Core Product Flow
-----------------

1. Visitor lands on `/` and sees the marketing page and pricing (Single Audit €9, Concierge €39/mo, 5 listings included, extra listing €4).
2. Visitor signs in or signs up via `/sign-in` or `/sign-up` (mocked forms that route to the dashboard).
3. From `/dashboard/listings/new`, the user submits a public listing URL.
4. The app creates a mock listing in an in-memory store.
5. A mock audit runs via `ai/mockAudit.ts`.
6. The app stores mock audit data in memory (`lib/mock-db.ts`).
7. The user sees the audit result on `/dashboard/audits/[id]`.

Audit Report Fields
-------------------

Each audit report shows:

- Overall score /10
- Photo quality
- Photo order
- Description quality
- Amenities completeness
- SEO strength
- Conversion strength
- Strengths
- Weaknesses
- Prioritized improvements
- Suggested rewritten opening paragraph
- Suggested photo reorder list
- Missing amenities checklist

Key Routes
----------

- `/` – Landing page
- `/sign-in` – Sign-in (mocked)
- `/sign-up` – Sign-up (mocked)
- `/dashboard` – Overview
- `/dashboard/listings` – Listings index
- `/dashboard/listings/new` – New listing submission flow
- `/dashboard/audits` – Audits index
- `/dashboard/audits/[id]` – Audit result
- `/dashboard/billing` – Billing placeholder (Stripe)
- `/dashboard/settings` – Settings and integration placeholders

Mock Integrations
-----------------

- Supabase: see `auth/supabaseClient.ts` and `database/schema.ts` for placeholders and table definitions (profiles, listings, audits, audit_scores, improvements, subscriptions, monthly_usage).
- Stripe: see `stripe/client.ts` for placeholder helpers.
- OpenAI: see `ai/mockAudit.ts` which simulates an audit instead of calling the real API.

Running Locally
---------------

1. Install dependencies:

	npm install

2. Copy environment variables template and adjust as needed:

	cp .env.example .env.local

3. Run the development server:

	npm run dev

Then open http://localhost:3000 in your browser.

Notes
-----

- Authentication, billing, and AI calls are intentionally mocked for this MVP.
- All data lives in memory while the dev server is running; restarting clears listings and audits.

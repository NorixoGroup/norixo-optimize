# NORIXO — PROJECT RULES

Global Claude Code rules remain applicable. This file adds only Norixo-specific constraints.

## Context

Use `/norixo-context` when repository or product context is needed. Prefer targeted investigation over broad documentation or repository scans.

## Protected Areas

Treat these as high-impact areas requiring explicit inclusion in the approved write scope before modification:

- Supabase migrations, production data, RLS, authentication, and authorization.
- Stripe, billing, credits, subscriptions, prices, and payment behavior.
- Vercel production configuration, environment variables, secrets, and deployment behavior.
- Sitemap, canonical URLs, hreflang, indexing, IndexNow, and other SEO infrastructure.
- Audit scoring, product/business rules, pricing, and user-visible entitlement logic.
- Large-scale programmatic page generation or deletion.

Reading these areas for diagnosis is allowed. Do not modify them merely because an investigation reveals an issue.

## Product Decisions

Do not silently choose or change product behavior, pricing, audit methodology, SEO strategy, billing rules, access rules, or production architecture when multiple reasonable options exist.

## Scope Discipline

Do not mix independent Norixo workstreams. A fix in one subsystem does not authorize cleanup or changes in another.

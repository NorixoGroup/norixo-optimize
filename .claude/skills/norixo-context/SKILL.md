---
name: norixo-context
description: Route Norixo investigations to the smallest relevant set of repository documentation and code before broad exploration.
---

# Norixo Context Router

Use this skill when a task requires understanding Norixo architecture, product behavior, billing, audits, SEO, backlinks, or the marketing agent.

## Goal

Find the smallest authoritative context needed for the task. Do not load large parts of the repository or documentation by default.

## Routing

Start with targeted search for the user's exact topic.

For general repository orientation:
- `README.md`

For billing, credits, subscriptions, or Stripe-related architecture:
- `docs/billing-credit-architecture.md`
- then inspect only the relevant implementation files.

For the marketing agent:
- start with `marketing-agent/README.md`
- load only the relevant documents under `marketing-agent/core/`, `marketing-agent/agents/`, `marketing-agent/knowledge/`, or other subdirectories.

For marketing governance, permissions, approval, or publication safety:
- `marketing-agent/core/governance.md`
- `marketing-agent/core/approval-model.md`
- `marketing-agent/core/safety-rules.md`

For product positioning or product knowledge:
- `marketing-agent/knowledge/product.md`

## Efficiency Rules

- Search first; read targeted files or ranges.
- Do not recursively read `marketing-agent/`.
- Do not load all documentation "for context".
- Prefer current implementation when documentation and code need comparison.
- Expand investigation only when the current evidence is insufficient.
- Reuse facts already established in the current session.

Follow the project's global approval, scope, Git, and safety rules for all modifications.

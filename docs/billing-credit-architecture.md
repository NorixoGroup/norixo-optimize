# Billing Credits Architecture (Target)

## 1) Current State (baseline)

- `subscriptions` is the source of truth for active plan (`free`, `pro`, `scale`) and Stripe ids.
- `usage_events` is used as credit ledger today:
  - grants: `audit_test_purchased`, `audit_credit_granted`
  - consumption: `audit_credit_consumed`
- `getWorkspaceAuditCredits` computes:
  - `granted = sum(grants)`
  - `consumed = sum(consumption)`
  - `available = max(granted - consumed, 0)`
- Stripe webhook currently grants on `checkout.session.completed` (purchase moment).
- `invoice.paid` currently updates subscription status but does not grant a new cycle credit batch.

## 2) Target Model (scalable)

Keep `subscriptions` and `usage_events`, add a dedicated credit bucket model.

### New table: `audit_credit_lots`

Each grant creates one lot (bucket of credits).

Suggested columns:

- `id uuid pk`
- `workspace_id uuid not null`
- `source_type text not null`
  - `subscription_cycle`
  - `top_up`
  - `audit_test`
  - `backfill`
  - `manual_adjustment`
- `source_ref text not null`
  - Stripe invoice id / checkout session id / backfill key
- `plan_code text null` (`free|pro|scale` when relevant)
- `granted_quantity int not null check (granted_quantity > 0)`
- `consumed_quantity int not null default 0 check (consumed_quantity >= 0)`
- `expires_at timestamptz null`
- `granted_at timestamptz not null default now()`
- `period_start timestamptz null`
- `period_end timestamptz null`
- `metadata jsonb not null default '{}'::jsonb`
- `created_at timestamptz not null default now()`
- `updated_at timestamptz not null default now()`

Constraints/indexes:

- unique `(workspace_id, source_type, source_ref)` (strong idempotence)
- index `(workspace_id, expires_at, granted_at)`
- check `consumed_quantity <= granted_quantity`

### Keep `usage_events` as immutable audit trail

Use it for analytics/debug/product signals, not as the only runtime bucket source.

Recommended normalized credit-related `event_type`:

- `credit_granted_subscription_cycle`
- `credit_granted_top_up`
- `credit_granted_audit_test`
- `credit_granted_backfill`
- `credit_consumed_audit`
- `credit_expired`
- `credit_adjusted_manual`

## 3) Stripe Event Mapping (target)

### `checkout.session.completed`

- `mode=payment` for one-shot:
  - Starter/top-up grant:
    - create lot (`source_type=top_up` or `audit_test`)
    - write `usage_events` grant event
- `mode=subscription`:
  - create/update `subscriptions`
  - do not double-grant if renewal is handled by invoice cycle

### `invoice.paid` (primary cycle grant)

- For active paid subscription cycle:
  - resolve plan (`pro=5`, `scale=15`)
  - create lot with:
    - `source_type=subscription_cycle`
    - `source_ref=invoice.id`
    - `period_start/period_end` from Stripe
    - `expires_at` policy-driven
  - write matching usage event

### `customer.subscription.updated`

- update `subscriptions` status/period/end
- no credit grant by default (avoid duplicates)

### `customer.subscription.deleted`

- set subscription to free/canceled status
- do not remove already granted lots

## 4) Business Rules (target)

### Grant rules

- Starter one-shot: grant 1 credit (or quantity purchased).
- Pro cycle: grant 5 per paid cycle.
- Scale cycle: grant 15 per paid cycle.
- Top-up: grant purchased quantity immediately.

### Consume rules

- 1 created audit = 1 consumed credit.
- Consume from non-expired lots, oldest first (FIFO).
- If no available credit: block audit creation with clear reason/CTA.

### Expiration policy

Two safe options:

1. **Launch simple**: no expiration for all lots.
2. **Simple timed**:
   - Starter/top-up: 30 days
   - Pro cycle: 60 days
   - Scale cycle: 90 days

Recommendation: start without expiration, add later when conversion baseline is stable.

### Renewal

- Renewal is invoice-driven (`invoice.paid`).
- Each invoice cycle creates exactly one grant lot (idempotent on `invoice.id`).

### Top-ups

- Top-up is independent from subscription.
- Always creates a new lot.
- Works for `free`, `pro`, and `scale`.

## 5) Idempotence / Anti-duplicate Guarantees

- Stripe dedupe key:
  - cycle grants: `invoice.id`
  - one-shot grants: `checkout_session.id`
- DB unique constraints on `(workspace_id, source_type, source_ref)`.
- Keep metadata with:
  - `stripe_event_id`
  - `stripe_session_id`
  - `stripe_invoice_id`

## 6) Progressive Migration Plan (no big-bang)

### Phase A (safe prep)

- Add `audit_credit_lots` table + indexes + constraints.
- Keep existing billing UI and Stripe flows.

### Phase B (dual-write)

- On grant paths:
  - write lot
  - write usage event
- On consume path:
  - decrement lot(s) FIFO in a DB transaction
  - write usage event

### Phase C (read switch)

- Switch `getWorkspaceAuditCredits` to compute from lots.
- Keep temporary fallback to usage_events for legacy safety window.

### Phase D (enforcement)

- Update `canCreateAudit` for non-free plans:
  - allow only if `remaining > 0`
  - return upgrade/top-up reason otherwise.

### Phase E (cleanup)

- Remove fallback reads.
- Keep usage_events as analytics/event trail.

## 7) Product Upsell Hooks (ready for current UI)

Derive from real `remaining` + behavior:

- remaining `2`: soft warning.
- remaining `1`: critical warning.
- remaining `0`: hard block + targeted CTA.
- starter frequent one-shot purchases (>=2 recent): recommend Pro.
- pro frequent exhaustion: recommend Scale.
- scale exhaustion: recommend top-up/renewal.

This can stay in UI layer while backend source of truth moves to lots.


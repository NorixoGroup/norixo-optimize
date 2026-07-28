# Backlink Acquisition Platform — Data Model

Status: Draft  
Owner: Norixo  
Program: Growth

## Purpose

This specification defines the Supabase data model for a global, workspace-scoped backlink acquisition pipeline. It is an architecture document only: it contains no SQL, migration, UI, import process, operational data or contacts.

The design is intended for tens of thousands of domains and opportunities. It keeps the Markdown governance documents as reference material while storing operational records, relationships, state changes and audit history in relational tables.

## Existing-platform alignment

- The operational tenancy boundary is the existing `workspaces` table.
- Every operational backlink record is scoped by `workspace_id`; cross-workspace rows are not permitted.
- Existing workspace membership and administrative-role concepts are reused for RLS.
- UUID primary keys and `created_at` / `updated_at` timestamps follow the existing migration conventions.
- A database trigger or equivalent shared mechanism should maintain `updated_at`; application callers must not be trusted to do so.
- Controlled values should use database constraints or dedicated lookup tables where later governance requires extensibility. This design does not prescribe SQL enum types.

## Design principles

1. **Domain before opportunity.** One domain can have many editorial opportunities, contacts and acquired links.
2. **Opportunity before outreach.** No outreach record exists without a qualified, page-level opportunity.
3. **Campaign membership is many-to-many.** An opportunity can be evaluated in more than one campaign over time, without duplicating the opportunity.
4. **Contacts are sensitive data.** Personal contact details are isolated and receive stricter access than non-personal discovery data.
5. **History is append-only.** Operational changes and outreach events are audit records, not overwritten narrative fields.
6. **No polymorphic core ownership.** Primary workflow tables use explicit foreign keys. Generic activity is an audit projection, not the source of relationship truth.
7. **Immutable identifiers survive lifecycle changes.** Stable references are not reused after archival, merge or closure.

## Relationship overview

```text
workspace
  ├── backlink_assets
  ├── backlink_domains
  │     ├── backlink_contacts
  │     ├── backlink_domain_tags ── backlink_tags
  │     └── backlink_opportunities
  │             ├── backlink_opportunity_tags ── backlink_tags
  │             ├── backlink_campaign_opportunities ── backlink_campaigns
  │             ├── backlink_outreach_threads
  │             │     └── backlink_outreach_events
  │             ├── backlink_links
  │             ├── backlink_notes
  │             └── backlink_activity
  └── backlink_campaigns
```

`backlink_opportunities` also references one `backlink_asset`. `backlink_outreach_threads` reference one opportunity and, when identified, one contact. `backlink_links` reference the opportunity that produced the acquired or lost link.

## Tables

### 1. `backlink_assets`

**Role:** Canonical inventory of Norixo assets eligible for backlink work in one workspace. This is the operational representation of the asset portfolio; it does not replace the Markdown playbooks.

**Columns**

| Column | Purpose | Constraints / notes |
|---|---|---|
| `id` | Primary key. | UUID, immutable. |
| `workspace_id` | Tenant scope. | Required FK to `workspaces`. |
| `asset_key` | Stable machine identifier. | Required; lowercase, immutable; unique within workspace. |
| `name` | Canonical human-readable asset name. | Required. |
| `asset_family` | Controlled family such as calculator, methodology, research or snapshot. | Required controlled value. |
| `canonical_url` | Canonical public URL when the asset is published. | Nullable until published; unique within workspace when present. |
| `lifecycle_status` | Promotion eligibility. | Required; see lifecycle states. |
| `linkability_level` | Qualitative portfolio assessment. | Nullable controlled value; never a fabricated performance metric. |
| `source_document` | Reference to the governing Markdown or decision record. | Nullable text path; not a URL requirement. |
| `created_by`, `updated_by` | Operational accountability. | Nullable FK to authenticated user identity. |
| `created_at`, `updated_at`, `archived_at` | Lifecycle timestamps. | Standard timestamps. |

**Keys, indexes and constraints**

- Primary key: `id`.
- Unique: `(workspace_id, asset_key)`.
- Partial unique: `(workspace_id, canonical_url)` when `canonical_url` is not null.
- Index: `(workspace_id, lifecycle_status)` for eligible-asset selection.
- An archived asset cannot be chosen by a newly created opportunity.

### 2. `backlink_domains`

**Role:** One normalized publisher or organisation domain per workspace, independent of any particular page, campaign or contact.

**Columns**

| Column | Purpose | Constraints / notes |
|---|---|---|
| `id` | Primary key. | UUID, immutable. |
| `workspace_id` | Tenant scope. | Required FK. |
| `domain_key` | Stable permanent identifier, for example the future operational equivalent of a portfolio ID. | Required; immutable; unique within workspace. |
| `normalized_domain` | Lowercase registrable domain used for deduplication. | Required; immutable except verified correction; no protocol, path or subdomain unless a documented exception is needed. |
| `display_name` | Organisation or publisher name. | Required. |
| `organization_type` | Controlled category such as Media, Software, Association or Government. | Required. |
| `country_code`, `region`, `primary_language` | Discovery context. | Nullable controlled values; use only documented canonical labels. |
| `editorial_compatibility` | Qualitative fit from the qualification framework. | Nullable controlled value. |
| `estimated_difficulty` | Qualitative discovery estimate. | Nullable controlled value. |
| `domain_status` | Operational lifecycle. | Required; see lifecycle states. |
| `source_reference` | Internal evidence reference to a discovery document or record. | Nullable. |
| `first_discovered_at`, `last_verified_at` | Discovery verification timestamps. | Nullable. |
| `merged_into_domain_id` | Redirect for an intentional duplicate merge. | Nullable self-FK; must not form a cycle. |
| `created_by`, `updated_by`, `created_at`, `updated_at`, `archived_at` | Accountability and lifecycle. | Standard audit fields. |

**Keys, indexes and constraints**

- Primary key: `id`.
- Unique: `(workspace_id, domain_key)` and `(workspace_id, normalized_domain)`.
- Index: `(workspace_id, domain_status, organization_type)`.
- Index: `(workspace_id, region, primary_language)` for global portfolio filtering.
- A merged domain is read-only and cannot receive new opportunities, contacts or campaigns.

### 3. `backlink_opportunities`

**Role:** Central page-level record. One row represents one observed editorial opportunity on one domain for one recommended asset and one opportunity type.

**Columns**

| Column | Purpose | Constraints / notes |
|---|---|---|
| `id` | Primary key. | UUID, immutable. |
| `workspace_id` | Tenant scope. | Required FK. |
| `opportunity_key` | Stable permanent reference, such as `OP-000001`. | Required; immutable; unique within workspace. |
| `domain_id` | Publisher domain. | Required FK to `backlink_domains`. |
| `asset_id` | Recommended Norixo asset. | Required FK to `backlink_assets`. |
| `opportunity_type` | Editorial opportunity taxonomy value. | Required controlled value. |
| `target_page_url` | Observed publisher page. | Required, normalized URL. |
| `target_page_title` | Observed page title at verification time. | Required. |
| `page_type` | Resource, guide, research, documentation, news or other governed page type. | Required controlled value. |
| `evidence_summary` | Factual qualification evidence. | Required; no outreach copy. |
| `qualification_status` | Qualification outcome. | Required; see state model. |
| `discovery_status`, `editorial_status` | Separate operational dimensions from the inventory standard. | Required controlled values. |
| `priority` | Tier A, B or C. | Required controlled value. |
| `editorial_angle` | Concise value hypothesis, not a message template. | Nullable until identified. |
| `convention_risk` | Whether metric or methodology conventions need review. | Required boolean, default false. |
| `last_reviewed_at`, `next_review_at` | Freshness management. | Nullable timestamps. |
| `assigned_to` | Responsible internal user. | Nullable FK to authenticated identity. |
| `closed_reason` | Required when closed or unsuitable. | Nullable controlled value otherwise. |
| `created_by`, `updated_by`, `created_at`, `updated_at`, `closed_at`, `archived_at` | Audit and lifecycle. | Standard fields. |

**Keys, indexes and constraints**

- Primary key: `id`.
- Unique: `(workspace_id, opportunity_key)`.
- Unique: `(domain_id, target_page_url, opportunity_type, asset_id)` to prevent duplicate opportunity records while allowing distinct assets or contexts when genuinely justified.
- Index: `(workspace_id, qualification_status, priority, next_review_at)` for the qualification queue.
- Index: `(workspace_id, editorial_status, assigned_to, updated_at desc)` for operations.
- Index: `(domain_id, target_page_url)` for page deduplication.
- `workspace_id` must match the referenced domain and asset workspace. Enforce in a migration-level integrity check.

### 4. `backlink_campaigns`

**Role:** A bounded operational grouping of opportunities. Campaigns are not created by discovery and do not store contacts or messages directly.

**Columns**

| Column | Purpose | Constraints / notes |
|---|---|---|
| `id` | Primary key. | UUID, immutable. |
| `workspace_id` | Tenant scope. | Required FK. |
| `campaign_key` | Stable campaign reference, for example `BL-CAM-YYYY-NNN`. | Required; immutable; unique within workspace. |
| `name` | Internal campaign name. | Required. |
| `objective` | Bounded editorial objective. | Required. |
| `status` | Campaign lifecycle. | Required; see state model. |
| `start_at`, `end_at` | Planned or actual campaign window. | Nullable timestamps. |
| `owner_id` | Accountable internal owner. | Required FK. |
| `created_by`, `updated_by`, `created_at`, `updated_at`, `archived_at` | Audit and lifecycle. | Standard fields. |

**Keys, indexes and constraints**

- Unique: `(workspace_id, campaign_key)`.
- Index: `(workspace_id, status, start_at desc)`.
- Campaign closure does not delete associated opportunities or link history.

### 5. `backlink_campaign_opportunities`

**Role:** Join table that records when and why a qualified opportunity is included in a campaign.

**Columns**

- `campaign_id`, `opportunity_id`, `workspace_id`.
- `campaign_priority` (optional ordered queue value).
- `membership_status`: planned, active, paused, completed, removed.
- `added_by`, `added_at`, `removed_at`, `removal_reason`.

**Keys, indexes and constraints**

- Composite primary key: `(campaign_id, opportunity_id)`.
- Index: `(workspace_id, membership_status, campaign_priority)`.
- The campaign, opportunity and workspace must match.
- Only Qualified opportunities may enter an active campaign; `Needs Review`, `Not Suitable` and `Blocked` cannot.

### 6. `backlink_contacts`

**Role:** Contact identities associated with a domain. This table contains personal data and is deliberately separate from general discovery data.

**Columns**

| Column | Purpose | Constraints / notes |
|---|---|---|
| `id` | Primary key. | UUID, immutable. |
| `workspace_id`, `domain_id` | Scope and publisher relationship. | Required FKs. |
| `contact_key` | Stable internal contact reference. | Required; immutable; unique within workspace. |
| `full_name`, `role_title` | Publicly observed professional identity. | Nullable. |
| `email_normalized`, `linkedin_url`, `contact_form_url` | Contact channels. | Nullable; store only evidence-backed values. |
| `contact_status` | Verification and do-not-contact state. | Required controlled value. |
| `source_type`, `source_reference` | Where the detail was observed and its evidence. | Required when a channel is stored. |
| `consent_or_basis_note` | Internal record of permitted business-contact basis. | Required before outreach. |
| `last_verified_at`, `do_not_contact_at`, `do_not_contact_reason` | Privacy and lifecycle controls. | Nullable timestamps / controlled reason. |
| `created_by`, `updated_by`, `created_at`, `updated_at`, `archived_at` | Audit and lifecycle. | Standard fields. |

**Keys, indexes and constraints**

- Unique: `(workspace_id, contact_key)`.
- Partial unique: `(domain_id, email_normalized)` when email exists.
- Index: `(workspace_id, domain_id, contact_status)`.
- A contact with `do_not_contact` status cannot be attached to a new outreach thread.
- Store no scraped personal data, private social identifiers or unverified email guesses.

### 7. `backlink_outreach_threads`

**Role:** One relationship thread for one opportunity and one contact or channel. It enforces the outreach stop rule at the thread level.

**Columns**

- `id`, `workspace_id`, `thread_key` (immutable unique identifier).
- `opportunity_id` (required), `campaign_id` (nullable), `contact_id` (nullable only for permitted non-personal channels).
- `channel`: email, LinkedIn, contact_form, Slack, Discord, Reddit, other controlled value.
- `thread_status`: draft, ready, active, replied, conversation_open, declined, no_response, paused, closed.
- `attempt_count` (required non-negative integer, default zero; maximum three for unanswered attempts).
- `first_contacted_at`, `last_contacted_at`, `next_action_at`, `closed_at`.
- `owner_id`, `created_by`, `updated_by`, `created_at`, `updated_at`.

**Keys, indexes and constraints**

- Unique: `(workspace_id, thread_key)`.
- Partial unique: one active thread per `(opportunity_id, contact_id, channel)`.
- Index: `(workspace_id, thread_status, next_action_at)` for follow-up work queues.
- Index: `(opportunity_id, created_at desc)`.
- New threads require a Qualified opportunity, an active campaign membership when campaign-bound, and a contact that is not `do_not_contact`.

### 8. `backlink_outreach_events`

**Role:** Immutable chronology of send attempts, replies and follow-up decisions in a thread. This is the source of truth for contact-attempt counting.

**Columns**

- `id`, `workspace_id`, `thread_id`.
- `event_key` (immutable globally unique within workspace; supports future `BL-INT-YYYY-NNNN` convention).
- `event_type`: drafted, sent, follow_up_sent, reply_positive, reply_negative, reply_neutral, bounced, unsubscribed, paused, closed.
- `occurred_at`, `actor_user_id`, `channel`.
- `message_snapshot` (nullable protected content, only if retention policy permits), `external_message_reference` (nullable), `evidence_note`.
- `created_at`.

**Keys, indexes and constraints**

- Unique: `(workspace_id, event_key)`.
- Index: `(thread_id, occurred_at asc)`.
- Append-only: events cannot be updated or deleted by normal application roles.
- Attempt count is derived from sent and follow-up event types; it is not independently edited.

### 9. `backlink_links`

**Role:** Evidence record for a backlink that has been observed, acquired, changed or lost.

**Columns**

- `id`, `workspace_id`, `link_key` (immutable stable identifier).
- `opportunity_id` (required), `domain_id` (required), `campaign_id` (nullable).
- `source_url` (publisher page), `target_asset_id`, `target_url_at_observation`.
- `anchor_text`, `link_rel`, `link_placement_type`, `link_status`.
- `first_observed_at`, `last_verified_at`, `lost_at`, `lost_reason`.
- `verification_source`, `verification_evidence`.
- `created_by`, `updated_by`, `created_at`, `updated_at`.

**Keys, indexes and constraints**

- Unique: `(workspace_id, link_key)`.
- Unique: `(opportunity_id, source_url, target_url_at_observation)`.
- Index: `(workspace_id, link_status, last_verified_at)` for link-health monitoring.
- Index: `(target_asset_id, link_status)` for asset-level reporting.
- A link cannot be marked active without a source URL, target URL, observation timestamp and verification evidence.

### 10. `backlink_notes`

**Role:** Human operational notes attached to an opportunity. Notes do not replace structured status, evidence or outreach-event fields.

**Columns**

- `id`, `workspace_id`, `opportunity_id` (required FK).
- `note_type`: research, qualification, editorial, campaign, privacy, closure.
- `body` (required), `visibility`: admin_only or workspace_members.
- `author_id`, `created_at`, `edited_at`, `supersedes_note_id` (nullable self-FK).

**Keys, indexes and constraints**

- Index: `(opportunity_id, created_at desc)`.
- Do not delete notes; corrections create a superseding note.
- No raw message content, credentials or unnecessary personal data in notes.

### 11. `backlink_tags`

**Role:** Controlled, reusable internal labels for filtering; not a substitute for category, status or opportunity type.

**Columns**

- `id`, `workspace_id`, `tag_key` (immutable), `name`, `tag_group`, `description`, `is_active`.
- `created_at`, `updated_at`.

**Keys and constraints**

- Unique: `(workspace_id, tag_key)` and `(workspace_id, name)`.
- Index: `(workspace_id, tag_group, is_active)`.
- Tags are archived rather than deleted if already in use.

### 12. `backlink_domain_tags` and `backlink_opportunity_tags`

**Role:** Many-to-many tag joins for domains and opportunities.

**Columns and constraints**

- Each contains `workspace_id`, parent FK, `tag_id`, `added_by`, `added_at`.
- Composite primary key: parent ID plus `tag_id`.
- Parent and tag workspace IDs must match.

### 13. `backlink_activity`

**Role:** Append-only audit feed for material state and assignment changes. It is not a replacement for structured workflow tables.

**Columns**

- `id`, `workspace_id`, `activity_key` (immutable), `entity_type`, `entity_id`.
- `action_type`, `actor_user_id`, `occurred_at`.
- `before_state`, `after_state`, `reason`, `metadata`.

**Keys, indexes and constraints**

- Unique: `(workspace_id, activity_key)`.
- Index: `(workspace_id, entity_type, entity_id, occurred_at desc)`.
- Append-only; immutable after insert.
- Activity rows are generated for status transitions, assignments, merges, privacy actions and link verification changes.

## Controlled statuses and transitions

### Domain lifecycle

`discovered → qualified → active → paused → archived`

- `rejected` may be reached from discovered or qualified.
- `merged` may be reached only after an explicit `merged_into_domain_id` is recorded.
- Archived, rejected and merged domains are immutable except for audit or correction fields.

### Asset lifecycle

`draft → eligible → active → paused → archived`

- Only `eligible` and `active` assets can be recommended by a new opportunity.
- `paused` preserves existing history but prevents new campaign membership.

### Opportunity qualification and editorial lifecycle

Qualification: `Needs Review → Qualified | Not Suitable | Blocked`.

Editorial lifecycle: `Not Started → Page Identified → Ready for Contact → Contacted → In Discussion → Link Acquired | Closed`.

- `Ready for Contact` requires `Qualified`, a current reviewed page, a recommended active asset and no unresolved convention risk.
- `Contacted` requires at least one outreach event with a sent state.
- `Link Acquired` requires an active verified link record.
- `Blocked` or `Not Suitable` routes the editorial lifecycle to `Closed` with a reason.
- A material page change may return a Qualified opportunity to `Needs Review`; the historical qualification event remains in activity.

### Campaign lifecycle

`draft → active → paused → completed → archived`

- Only active campaigns may host active campaign memberships or new outreach threads.
- A completed campaign may be reactivated only with an audit reason; it is never silently reopened.

### Outreach lifecycle and stop rule

`draft → ready → active → replied | conversation_open | declined | no_response | paused | closed`

- A sent first contact increments the derived attempt count to one.
- Each unanswered follow-up increments the count.
- At three unanswered contact attempts, the thread transitions to `no_response` and no additional send event is allowed.
- A bounce, unsubscribe or do-not-contact signal immediately closes the thread and updates the contact status.
- A positive or neutral reply may move the thread to `conversation_open`; a declined reply closes it.

### Link lifecycle

`observed → active → changed | lost → archived`

- `active` requires verification evidence.
- `changed` records a material target, anchor, rel or source change and triggers re-verification.
- `lost` preserves all prior evidence; never delete a historical link row to represent loss.

## RLS and privacy model

### Baseline

- Enable RLS on every backlink table at creation.
- Scope every policy through the existing `workspace_members` relation and `workspace_id`.
- Service-role access is reserved for trusted server-side workers and migrations; it must never be exposed to browsers.
- No anonymous access is permitted to any backlink table.

### Access tiers

| Data class | Select | Insert / update | Delete |
|---|---|---|---|
| Domains, assets, opportunities, campaign memberships, tags | Workspace members | Workspace owners and admins | No ordinary deletion; archive or merge only |
| Campaigns | Workspace members | Workspace owners and admins | Archive only |
| Contacts, outreach threads, outreach events | Workspace owners and admins only | Workspace owners and admins only | No ordinary deletion; privacy suppression / archival only |
| Links, notes, activity | Workspace members subject to note visibility | Owners and admins; activity generated by trusted workflow | No ordinary deletion |

### Integrity requirements for RLS and writes

- Every insert and update checks that all referenced rows belong to the same workspace.
- `created_by`, `updated_by`, `author_id` and `actor_user_id` must be the authenticated user or an authorised server worker.
- Users cannot set another workspace ID or reassign a record across workspaces.
- Direct client writes to activity and outreach-event rows should be prohibited; use controlled server-side operations that validate transitions.
- Contact email and message snapshot fields must be excluded from broad member-readable views.
- Future reporting views must expose aggregate counts only unless a role explicitly requires personal contact access.

## Immutability and auditability

### Immutable fields

- All UUID primary keys.
- `domain_key`, `normalized_domain` except an audited verified correction.
- `asset_key`.
- `opportunity_key`, `campaign_key`, `contact_key`, `thread_key`, `event_key`, `link_key`, `activity_key`.
- All outreach events and activity records after insert.
- Original evidence timestamp fields such as `first_observed_at` and `first_discovered_at`.

### Auditable fields

- Domain status, merge decision and verification timestamps.
- Asset lifecycle status and canonical URL changes.
- Opportunity qualification, editorial status, priority, evidence summary, assignment, review schedule and closure reason.
- Campaign status and membership changes.
- Contact verification, contactability, do-not-contact actions and source evidence.
- Outreach state, send/reply chronology and stop-rule enforcement.
- Link verification, status, target, anchor and loss events.

Every auditable change creates a `backlink_activity` row with actor, time, before/after state and reason where applicable.

## Index strategy for scale

1. Put `workspace_id` first in operational queue indexes because RLS and most application queries are tenant-scoped.
2. Use unique normalized domain and opportunity-page constraints to stop duplication before it enters downstream workflow.
3. Index status plus time fields for queues: qualification review, next action, link verification and campaign progress.
4. Index foreign-key joins used by dashboards: domain, asset, campaign, opportunity, thread and contact IDs.
5. Do not add broad full-text or unbounded JSON indexes in the first migration. Add them only after measured query needs.
6. Keep activity and outreach events append-only; if volume grows, use time-based retention, archival or partitioning only after measured operational thresholds.

## Migration plan

Implement in atomic, reversible steps; do not combine the model with UI or import work.

1. **Foundation migration:** create controlled-value support, `backlink_assets`, `backlink_domains`, RLS baseline, timestamps and domain/asset uniqueness constraints.
2. **Opportunity migration:** create `backlink_opportunities`, opportunity indexes, same-workspace integrity checks and qualification-state constraints.
3. **Campaign migration:** create `backlink_campaigns` and `backlink_campaign_opportunities` with active-membership rules.
4. **Contact and outreach migration:** create `backlink_contacts`, threads and append-only events with restrictive RLS and the three-attempt stop rule.
5. **Link and audit migration:** create `backlink_links`, notes, tags, tag joins and append-only activity.
6. **Hardening migration:** add controlled transition functions or triggers, immutable-key protections, cross-workspace checks, deletion prohibitions and operational views.
7. **Verification migration:** add targeted tests for RLS isolation, duplicate prevention, state transitions, do-not-contact enforcement, append-only history and index-backed queue queries.

No migration should seed domains, contacts, opportunities, campaigns or links. Initial operational data requires a separate, explicitly approved process after the schema is validated.

## Deferred concerns

- UI, API routes, imports, automated discovery, CRM sync, email delivery and reporting dashboards are out of scope.
- This model deliberately does not create an externally visible public directory.
- No authority score, external-provider metric, email guess, or unverified contact field is required by the schema.
- Data retention periods for personal contact and message content require a separate privacy decision before implementation.

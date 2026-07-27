# Editorial Opportunity Inventory

Status: Draft  
Owner: Norixo  
Program: Growth

## Purpose

This inventory is the operational register for editorial opportunities after they have been identified and assessed. One row represents one editorial opportunity, not one domain, campaign, contact, or link.

It provides the future source of truth for opportunity lifecycle tracking while remaining separate from domain discovery, qualification standards, contacts, and outreach messages.

## Inventory Schema

| Column | Definition | Required when creating a row |
|---|---|---|
| Opportunity ID | Immutable identifier assigned to one opportunity. | Yes |
| Domain | Domain associated with the opportunity. | Yes |
| Country | Primary country or market associated with the domain. | Yes |
| Region | Canonical region for the domain. | Yes |
| Category | Canonical editorial category from the discovery portfolio. | Yes |
| Opportunity Type | Canonical opportunity type from `EDITORIAL_OPPORTUNITY_MAPPING.md`. | Yes |
| Recommended Norixo Asset | One documented Norixo asset appropriate to the opportunity. | Yes |
| Qualification Status | Outcome from `EDITORIAL_OPPORTUNITY_QUALIFICATION.md`. | Yes |
| Discovery Status | Progress of evidence gathering for the opportunity. | Yes |
| Editorial Status | Progress of the opportunity from page identification through maintenance. | Yes |
| Priority | Relative operational priority after qualification. | Yes |
| Owner | Internal responsible owner; left unassigned until ownership is established. | No |
| Last Review | Date of the last evidence or lifecycle review. | Yes |
| Notes | Concise, factual decision rationale and next-state context. | Yes |

## Controlled Values

### Qualification Status

- Qualified
- Needs Review
- Not Suitable
- Blocked

### Discovery Status

- To Research
- Researching
- Identified
- Verified

### Editorial Status

- Not Started
- Page Identified
- Ready for Contact
- Contacted
- In Discussion
- Link Acquired
- Closed

### Priority

- Tier A
- Tier B
- Tier C

## Opportunity Lifecycle

```text
Discovery
  ↓
Qualification
  ↓
Page Identification
  ↓
Contact Discovery
  ↓
Outreach
  ↓
Follow-up
  ↓
Link Acquired
  ↓
Maintenance
```

The inventory records the state of an opportunity at every stage. A later lifecycle stage does not replace the requirement for prior qualification evidence.

## Identifier Convention

Opportunity identifiers use a six-digit, sequential and immutable format:

```text
OP-000001
OP-000002
```

An identifier is assigned only when a new opportunity row is created. Identifiers are never reused, including after closure or archival.

## Governance

- Create a row only when one distinct editorial opportunity has been identified and has enough evidence to enter qualification.
- Update a row whenever its qualification outcome, lifecycle state, ownership, priority, evidence or decision rationale changes.
- Close a row when the opportunity is no longer suitable, has been declined, is blocked, or has reached a final outcome.
- Archive a row only when it is closed and no longer operationally active; retain its identifier, history and rationale.
- Do not merge distinct opportunities merely because they belong to the same domain.
- Do not create a row from authority, traffic, or commercial interest alone.

## Example Template

The following row is entirely fictional and demonstrates the required structure only. It is not a real opportunity, domain, contact, page, campaign, or asset.

| Opportunity ID | Domain | Country | Region | Category | Opportunity Type | Recommended Norixo Asset | Qualification Status | Discovery Status | Editorial Status | Priority | Owner | Last Review | Notes |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| OP-000001 | example.com | Example Country | Example Region | Example Category | Example Opportunity Type | Example Asset | Qualified | Identified | Not Started | Tier A | Unassigned | YYYY-MM-DD | Fictional template row only. |

## Future Integration

The inventory will connect operationally to:

- **Qualification:** it stores the qualification outcome and rationale produced under the qualification framework.
- **Page discovery:** it records progress after a specific editorial context is identified.
- **Contact discovery:** it records lifecycle readiness only; contact data belongs in a future controlled system.
- **Campaigns:** it provides the opportunity identifier and state needed to organise permitted outreach work.
- **Reporting:** it enables consistent analysis of opportunity progression, outcomes, maintenance and closure without changing the discovery portfolio.

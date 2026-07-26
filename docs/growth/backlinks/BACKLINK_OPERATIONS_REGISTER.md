# NORIXO — BACKLINK OPERATIONS REGISTER

Status:
Draft

Owner:
Norixo

Program:
Growth

# Purpose

This register tracks backlink outreach operations, preserves interaction history, prevents duplicate contacts, applies the stop rules, measures campaign outcomes, and connects every operation to a permanent portfolio identifier.

# Source of Truth Boundaries

## BACKLINK_TARGET_PORTFOLIO.md

The portfolio contains permanent qualification information:

- ID
- Domain
- Category
- Priority
- Editorial compatibility
- Difficulty
- Suggested asset
- Editorial angle
- Link intent

## BACKLINK_OPERATIONS_REGISTER.md

This register contains operational and evolving information:

- Campaign
- Contact
- Channel
- Dates
- Follow-ups
- Responses
- Result
- Acquired backlink
- History

The register references the portfolio through Target ID and does not unnecessarily duplicate portfolio data.

# Status Model

The authorized operational statuses are:

- Not Researched
- Contact Research In Progress
- Contact Identified
- Ready for Outreach
- Contacted
- Follow-up 1 Sent
- Follow-up 2 Sent
- Follow-up 3 Sent
- Replied
- Interested
- Declined
- No Response
- Paused
- Link Acquired
- Closed

A target starts as `Not Researched`. No contact may be sent before `Ready for Outreach`. Three follow-ups are the maximum permitted. After the final follow-up without a response, the target moves to `No Response` or `Closed`.

An explicit decline prevents any further unsolicited contact unless a documented justification establishes that a future contact is appropriate.

# Campaign Model

Campaign identifiers use the stable format `BL-CAM-YYYY-NNN`.

Every future interaction must be associated with both a Target ID in the `BK-XXXX` format and a Campaign ID in the `BL-CAM-YYYY-NNN` format. No campaign is created by this document.

# Interaction History Model

Each interaction record must preserve the following fields:

- Target ID
- Campaign ID
- Interaction ID
- Interaction Type
- Channel
- Contact Reference
- Date
- Outcome
- Next Action
- Next Action Date
- Notes

Interaction identifiers use the stable format `BL-INT-YYYY-NNNN`. No interaction is created by this document.

# Contact Reference Model

Future contact records may contain:

- Contact Name
- Role
- Organization
- Email
- LinkedIn Profile
- Contact Form
- Other Authorized Channel
- Verification Date
- Verification Source
- Contact Status

No contact data is collected or recorded by this document.

# Backlink Result Model

When a backlink is obtained, its result record may contain:

- Target ID
- Campaign ID
- Source Page
- Destination Asset
- Link Type
- Anchor Context
- Date Acquired
- First Verified Date
- Last Verified Date
- Current Status
- Referral Traffic Notes
- Editorial Notes

The authorized backlink statuses are:

- Pending Verification
- Active
- Changed
- Removed
- Unreachable

No source page, destination, or backlink result is recorded by this document.

# Stop Rules

- Send a maximum of three follow-ups.
- Stop immediately after an explicit decline.
- Do not follow up after an unsubscribe request or a request not to be contacted.
- Do not start a new campaign to the same person without a documented justification.
- Avoid simultaneous contact with multiple people at the same organization.
- Document every exception.

# Pilot Register

| Target ID | Operational Status | Active Campaign ID | Contact Status | Last Interaction | Next Action | Result |
| --- | --- | --- | --- | --- | --- | --- |
| BK-0001 | Not Researched |  | Not Researched |  | Contact research |  |
| BK-0002 | Not Researched |  | Not Researched |  | Contact research |  |
| BK-0003 | Not Researched |  | Not Researched |  | Contact research |  |
| BK-0004 | Not Researched |  | Not Researched |  | Contact research |  |
| BK-0005 | Not Researched |  | Not Researched |  | Contact research |  |
| BK-0006 | Not Researched |  | Not Researched |  | Contact research |  |
| BK-0007 | Not Researched |  | Not Researched |  | Contact research |  |
| BK-0008 | Not Researched |  | Not Researched |  | Contact research |  |
| BK-0009 | Not Researched |  | Not Researched |  | Contact research |  |
| BK-0010 | Not Researched |  | Not Researched |  | Contact research |  |

# Governance

- Target ID is immutable.
- Campaign IDs and Interaction IDs are never recycled.
- Historical interactions are never deleted.
- Corrections must preserve historical traceability.
- Update the register after every real action.
- Keep the portfolio and register consistent.
- A target absent from the official portfolio cannot enter the operations register.

# Future Migration

The register may later migrate to a CSV file, spreadsheet, CRM tool, or database without changing identifiers or governance rules. No migration mechanism is defined or implemented by this document.

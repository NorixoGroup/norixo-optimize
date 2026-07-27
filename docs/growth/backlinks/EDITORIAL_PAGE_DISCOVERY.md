# Editorial Page Discovery

Status: Draft  
Owner: Norixo  
Program: Growth

## Purpose

Domain discovery identifies organisations that may be relevant. Editorial page discovery is a separate step that identifies whether a specific, real editorial context can benefit from a Norixo asset. A qualified domain alone is not an opportunity; a page must have a clear audience need, compatible format and credible editorial reason for a reference.

## Page Types

| Page Type | Description |
|---|---|
| Resource Page | Curated learning or reference collection maintained for an audience. |
| Recommended Tools | Editorial selection of tools for a stated user need. |
| Blog Article | Published article addressing a defined topic or problem. |
| Research Publication | Evidence-led publication, paper or research-library entry. |
| Industry Report | Structured sector report, outlook or benchmark publication. |
| Statistics Page | Page presenting public, proprietary or contextualised metrics. |
| Methodology Page | Explanation of data collection, definitions, calculations or limitations. |
| Directory | Maintained editorial, association or vendor directory with review standards. |
| Software Listing | Product catalogue or software comparison with a documented editorial process. |
| Partner Page | Curated partner or ecosystem page with an observable relevance policy. |
| Knowledge Base | Maintained educational documentation organised by topic. |
| Best Tools List | Editorial roundup with a clear audience and selection rationale. |
| Guide | Long-form educational content explaining a workflow, concept or decision. |
| Case Study | Evidence-led account of a process, outcome or implementation. |
| Documentation | Product or professional documentation that explains implementation or metrics. |
| Press Page | Editorial news or press publication with a relevant evidence context. |
| News Article | Current editorial coverage that may require a factual, time-bound reference. |
| Community Resource | Moderated community knowledge, learning or evergreen-resource page. |

## Discovery Workflow

```text
Qualified domain
  ↓
Identify relevant sections
  ↓
Identify the page type
  ↓
Verify page-level relevance
  ↓
Create one opportunity in the inventory
  ↓
Pass the opportunity to qualification
```

The workflow begins only after a domain is available in the discovery portfolio. It does not include contact research, author identification, messaging or outreach.

## Validation Criteria

A page is exploitable for qualification only when all applicable criteria are supported by observable evidence:

1. **Topical coherence:** the page addresses a subject materially related to the relevant Norixo asset.
2. **Editorial substance:** the page contains educational, analytical, research or documented content rather than only conversion material.
3. **Audience relevance:** its intended audience has a credible need for the proposed reference.
4. **Format compatibility:** its page type can legitimately contain the proposed opportunity type.
5. **Content maintenance:** the page appears current, maintained or durably useful.
6. **Reference rationale:** a Norixo asset would improve reader understanding without displacing an adequate existing answer.
7. **Editorial accessibility:** there is observable evidence that the format can be updated, cite sources or include external references.
8. **Commercial neutrality:** the opportunity can be framed as editorial value rather than a placement request.
9. **Policy compatibility:** no visible policy, legal, privacy or reputation constraint prevents qualification.

## Exclusion Rules

Do not create an inventory opportunity from:

1. Login, account, checkout or private dashboard pages.
2. Purely commercial landing pages with no editorial or educational context.
3. Legal notices, privacy policies, cookie pages or terms of service.
4. Thin, automatically generated, duplicate or clearly stale content.
5. Pages whose only apparent function is link selling, sponsored placement or unreviewed listing collection.
6. Technical endpoints, APIs, search-result pages or internal site-search results without editorial value.
7. Pages that would require an artificial, irrelevant or reciprocal insertion.
8. Pages subject to a visible policy, legal, privacy or safety restriction that blocks an appropriate reference.

## Governance

Create one inventory row only after a specific page has passed the page-level validation criteria and an opportunity type can be assigned from `EDITORIAL_OPPORTUNITY_MAPPING.md`. Record the page discovery state according to the inventory schema, then apply `EDITORIAL_OPPORTUNITY_QUALIFICATION.md` before any later lifecycle stage.

Do not create duplicate inventory rows for the same page and opportunity type unless the editorial contexts are demonstrably distinct.

## Future Integration

- **Qualification:** page evidence supplies the factual basis for an opportunity outcome.
- **Contact discovery:** begins only after the page-level opportunity is Qualified and is managed outside this standard.
- **Outreach:** begins only after qualification, page discovery and contact discovery have each been completed under their respective controls.

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { parseDomainPagination } from "../app/api/backlinks/domains/route";
import { parseOpportunityPagination } from "../app/api/backlinks/opportunities/route";
import { listDomains } from "../lib/backlinks/services/domainService";
import { listOpportunities } from "../lib/backlinks/services/opportunityService";
import { BACKLINK_DOMAIN_CACHE_MAX_PAGES, BACKLINK_DOMAIN_CACHE_PAGE_SIZE, BacklinkDomainPageAggregationError, loadAllBacklinkDomainPages, loadAllBacklinkOpportunityPages } from "../lib/backlinks/services/domainPageAggregation";
import { getBacklinkOutreachDraftEligibilityForMembership } from "../lib/backlinks/services/outreachDraftEligibilityService";
import { BacklinkOutreachDraftError, createBacklinkOutreachDraftService } from "../lib/backlinks/services/outreachDraftService";

function repositoryClient(calls: Array<{ from: number; to: number }>) {
  return {
    from: () => ({
      select: () => ({
        eq: () => ({
          order: () => ({
            order: () => ({
              range: (from: number, to: number) => {
                calls.push({ from, to });
                return Promise.resolve({ data: [], count: 57, error: null });
              },
            }),
          }),
        }),
      }),
    }),
  };
}

async function eligibilityFor(contact: { id: string; contact_status: string; linkedin_url: string | null }, outreach: readonly { id: string; contact_id: string; channel: string; status: string }[] = []) {
  return getBacklinkOutreachDraftEligibilityForMembership({
    getMembership: async () => ({ campaign_id: "campaign", opportunity_id: "opportunity" }),
    getOpportunity: async () => ({ id: "opportunity", domain_id: "norixo-domain", asset_id: "asset", target_page_url: "https://norixo.io/free-audit" }),
    listContactsByDomain: async (_workspaceId, domainId) => {
      assert.equal(domainId, "norixo-domain", "eligibility must query the opportunity's exact domain");
      return [{ ...contact, contact_key: "CT-000001", full_name: "Test Contact", role_title: null, email_normalized: null, contact_form_url: null }];
    },
    listOutreachByOpportunity: async () => outreach,
  }, { workspaceId: "workspace", campaignId: "campaign", opportunityId: "opportunity" });
}

async function assertDomainMismatchRejected() {
  const createDraft = createBacklinkOutreachDraftService({
    eligibility: {
      getMembership: async () => ({ campaign_id: "campaign", opportunity_id: "opportunity" }),
      getOpportunity: async () => ({ id: "opportunity", domain_id: "norixo-domain", asset_id: "asset", target_page_url: "https://norixo.io/free-audit" }),
      listContactsByDomain: async () => [{ id: "contact", contact_key: "CT-000001", full_name: "Test Contact", role_title: null, contact_status: "unverified", email_normalized: null, linkedin_url: "https://www.linkedin.com/in/test", contact_form_url: null }],
      listOutreachByOpportunity: async () => [],
    },
    getCampaign: async () => ({ name: "Campaign", objective: "Objective" }),
    getContact: async () => ({ id: "contact", domain_id: "other-domain", full_name: "Test Contact", role_title: null }),
    getDomain: async () => ({ hostname: "norixo.io" }),
    getOpportunity: async () => ({ id: "opportunity", asset_id: "asset", target_page_title: "Free audit", target_page_url: "https://norixo.io/free-audit", opportunity_type: "Partnership", page_type: "Landing Page", evidence_summary: "Evidence" }),
    getAsset: async () => ({ display_name: "Asset", canonical_url: "https://norixo.io/free-audit" }),
    getActiveOutreach: async () => null,
    reserveOutreachKey: async () => "OR-000001",
    createOutreach: async () => { throw new Error("must not create an outreach for a mismatched domain"); },
  });
  await assert.rejects(
    () => createDraft({ workspaceId: "workspace", actorUserId: "actor", campaignId: "campaign", opportunityId: "opportunity", contactId: "contact", channel: "linkedin" }),
    (error: unknown) => error instanceof BacklinkOutreachDraftError && error.code === "CONTACT_NOT_ELIGIBLE",
    "mismatched contact domain must be explicitly rejected",
  );
}

async function main() {
  assert.deepEqual(parseDomainPagination(new URLSearchParams()), {}, "domain API defaults must remain unset for repository defaults");
  assert.deepEqual(parseDomainPagination(new URLSearchParams("page=2&pageSize=30")), { page: 2, pageSize: 30 }, "explicit domain pagination must be forwarded");
  assert.deepEqual(parseOpportunityPagination(new URLSearchParams()), {}, "opportunity API defaults must remain unset for repository defaults");
  assert.deepEqual(parseOpportunityPagination(new URLSearchParams("page=2&pageSize=30")), { page: 2, pageSize: 30 }, "explicit opportunity pagination must be forwarded");
  for (const query of ["page=0", "page=1.5", "page=-1", "pageSize=abc", "page=1&page=2", "page=9007199254740992"]) {
    assert.equal(parseDomainPagination(new URLSearchParams(query)), null, `invalid pagination must be rejected: ${query}`);
    assert.equal(parseOpportunityPagination(new URLSearchParams(query)), null, `invalid opportunity pagination must be rejected: ${query}`);
  }

  const calls: Array<{ from: number; to: number }> = [];
  await listDomains(repositoryClient(calls) as never, "workspace" as never);
  await listDomains(repositoryClient(calls) as never, "workspace" as never, { page: 2, pageSize: 30 });
  await listOpportunities(repositoryClient(calls) as never, "workspace" as never);
  await listOpportunities(repositoryClient(calls) as never, "workspace" as never, { pagination: { page: 2, pageSize: 30 } });
  assert.deepEqual(calls, [{ from: 0, to: 24 }, { from: 30, to: 59 }, { from: 0, to: 24 }, { from: 30, to: 59 }], "services must preserve defaults and forward explicit pagination to repositories");

  async function aggregate(items: number, hasNextPage = false) {
    const pageCalls: number[] = [];
    const result = await loadAllBacklinkDomainPages(async (page, pageSize) => {
      pageCalls.push(page);
      const start = (page - 1) * pageSize + 1;
      return { items: Array.from({ length: Math.max(0, Math.min(pageSize, items - start + 1)) }, (_, index) => ({ id: `domain-${start + index}` })), total: items, pageSize, hasNextPage };
    });
    return { result, pageCalls };
  }
  assert.deepEqual((await aggregate(0)).result, { items: [], total: 0 }, "zero domains must return an empty cache");
  assert.deepEqual((await aggregate(1)).result.items.map((item) => item.id), ["domain-1"], "one domain must return one page");
  assert.deepEqual((await aggregate(100)).pageCalls, [1], "exactly 100 domains must require one page");
  const oneHundredOne = await aggregate(101, true);
  assert.deepEqual(oneHundredOne.pageCalls, [1, 2], "101 domains must fetch page two");
  assert.ok(oneHundredOne.result.items.some((domain) => domain.id === "domain-101"), "a domain beyond the original first 25 must be available");
  const productionLikeOpportunities = await loadAllBacklinkOpportunityPages(async (page, pageSize) => {
    const start = (page - 1) * pageSize + 1;
    return { items: Array.from({ length: Math.max(0, Math.min(pageSize, 98 - start + 1)) }, (_, index) => ({ id: `opportunity-${start + index}` })), total: 98, pageSize, hasNextPage: false };
  });
  assert.equal(productionLikeOpportunities.items.length, 98, "all 98 production-like opportunities must be represented");
  assert.ok(productionLikeOpportunities.items.some((opportunity) => opportunity.id === "opportunity-98"), "opportunity beyond the original first 25 must be available");
  const duplicatePageCalls: number[] = [];
  const deduplicated = await loadAllBacklinkDomainPages(async (page, pageSize) => {
    duplicatePageCalls.push(page);
    return page === 1
      ? { items: Array.from({ length: pageSize }, (_, index) => ({ id: `domain-${index + 1}` })), total: 101, pageSize, hasNextPage: true }
      : { items: [{ id: "domain-100" }, { id: "domain-101" }], total: 101, pageSize, hasNextPage: false };
  });
  assert.deepEqual(duplicatePageCalls, [1, 2], "normal hasNextPage=false must terminate pagination");
  assert.equal(deduplicated.items.length, 101, "duplicate domain IDs across pages must be removed");
  const inconsistentCalls: number[] = [];
  await loadAllBacklinkDomainPages(async (page, pageSize) => {
    inconsistentCalls.push(page);
    return { items: [], total: 100, pageSize, hasNextPage: true };
  });
  assert.deepEqual(inconsistentCalls, [1], "stable finite totals must bound inconsistent hasNextPage=true");
  for (const scenario of ["growing", "cap"]) {
    let fetches = 0;
    await assert.rejects(
      () => loadAllBacklinkDomainPages(async (page, pageSize) => {
        fetches += 1;
        return scenario === "growing"
          ? { items: [], total: (page + 1) * pageSize, pageSize, hasNextPage: true }
          : { items: [], total: (BACKLINK_DOMAIN_CACHE_MAX_PAGES + 1) * pageSize, pageSize, hasNextPage: true };
      }),
      BacklinkDomainPageAggregationError,
      `${scenario} pagination must fail rather than return an incomplete cache`,
    );
    assert.equal(fetches, BACKLINK_DOMAIN_CACHE_MAX_PAGES, `${scenario} pagination must stop at the absolute hard cap`);
  }

  const source = readFileSync(join(process.cwd(), "app/(default)/dashboard/backlinks/page.tsx"), "utf8");
  const createFieldsSource = source.slice(source.indexOf("const createFields"), source.indexOf("const updateFields"));
  const updateFieldsSource = source.slice(source.indexOf("const updateFields"), source.indexOf("// formatters extracted"));
  assert.match(createFieldsSource, /contacts: \[[^\n]*\{ key: "linkedin_url", label: "URL LinkedIn", type: "url" \}[^\n]*source_type[^\n]*source_reference/, "Contacts create fields must independently include LinkedIn URL and source evidence");
  assert.match(updateFieldsSource, /contacts: \[[^\n]*\{ key: "linkedin_url", label: "URL LinkedIn", type: "url" \}/, "Contacts update fields must independently include LinkedIn URL");
  const contactsActionStart = source.indexOf('activeSection === "contacts" ? <button');
  const contactsActionSource = source.slice(contactsActionStart, source.indexOf('activeSection === "links" ?', contactsActionStart));
  assert.match(contactsActionSource, /openEditor\(activeSection, row\)/, "Contacts Modifier must reuse the generic editor with its row");
  assert.match(source, /contacts: \{ label: "Contacts"[^\n]*endpoint: "\/api\/backlinks\/contacts"/, "Contacts must retain the existing API endpoint");
  assert.match(source, /const path = editor\.row == null \? sections\[editor\.section\]\.endpoint : `\$\{sections\[editor\.section\]\.endpoint\}\/\$\{editor\.row\.id\}`[\s\S]*method: editor\.row == null \? "POST" : "PATCH"/, "generic editor must retain its PATCH update path");
  assert.match(source, /loadAllOpportunities[\s\S]*sections\.opportunities\.endpoint\}\?page=\$\{page\}&pageSize=\$\{pageSize\}/, "dashboard must aggregate every opportunity page through the production helper");

  const linkedInEligible = await eligibilityFor({ id: "linkedin", contact_status: "unverified", linkedin_url: "https://www.linkedin.com/in/test" });
  assert.ok(linkedInEligible.contacts[0].eligibleChannels.includes("linkedin"), "unverified same-domain LinkedIn contact must be eligible");
  const missingUrl = await eligibilityFor({ id: "missing-url", contact_status: "unverified", linkedin_url: null });
  assert.ok(!missingUrl.contacts[0].eligibleChannels.includes("linkedin"), "missing LinkedIn URL must be ineligible");
  await assertDomainMismatchRejected();
  const dnc = await eligibilityFor({ id: "dnc", contact_status: "do_not_contact", linkedin_url: "https://www.linkedin.com/in/dnc" });
  assert.ok(!dnc.contacts[0].eligibleChannels.includes("linkedin"), "do-not-contact must be ineligible");
  const archived = await eligibilityFor({ id: "archived", contact_status: "archived", linkedin_url: "https://www.linkedin.com/in/archived" });
  assert.ok(!archived.contacts[0].eligibleChannels.includes("linkedin"), "archived contact must be ineligible");
  const conflict = await eligibilityFor({ id: "conflict", contact_status: "unverified", linkedin_url: "https://www.linkedin.com/in/conflict" }, [{ id: "active", contact_id: "conflict", channel: "linkedin", status: "active" }]);
  assert.ok(!conflict.contacts[0].eligibleChannels.includes("linkedin"), "active LinkedIn outreach must block another LinkedIn draft");

  console.log("PASS — BKL-AI-R5C25I domain pagination, contact UI, and LinkedIn eligibility smoke");
}

void main();

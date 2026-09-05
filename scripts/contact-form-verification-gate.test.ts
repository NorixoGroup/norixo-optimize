import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  getBacklinkOutreachDraftEligibilityForMembership,
  resolveBacklinkOutreachChannels,
} from "../lib/backlinks/services/outreachDraftEligibilityService";
import {
  hasCurrentVerifiedContactFormEvidence,
  isValidContactFormVerificationEvidence,
  normalizeContactFormVerificationUrl,
  type ContactFormVerification,
} from "../lib/backlinks/repositories/contactFormAutomationRepository";

const validEvidence = {
  actual_form_observed: true,
  form_count: 1,
  message_field_present: true,
  submit_control_present: true,
  contact_intent: true,
  newsletter_only: false,
  login_only: false,
  support_only: false,
  sales_demo_only: false,
};

const baseVerification: ContactFormVerification = {
  id: "verification",
  workspace_id: "workspace",
  contact_id: "contact",
  form_url: "https://example.com/contact",
  verification_state: "verified",
  verified_at: "2026-09-05T00:00:00.000Z",
  evidence_version: "cfv1",
  form_fingerprint: "form-fingerprint",
  safe_evidence: validEvidence,
  created_at: "2026-09-05T00:00:00.000Z",
};

function verification(overrides: Partial<ContactFormVerification>): ContactFormVerification {
  return { ...baseVerification, ...overrides };
}

function assertMigrationContainsInOrder(source: string, clauses: readonly string[], message: string) {
  let position = -1;
  for (const clause of clauses) {
    const nextPosition = source.indexOf(clause, position + 1);
    assert.ok(nextPosition > position, `${message}: missing/out-of-order clause ${clause}`);
    position = nextPosition;
  }
}

async function eligibilityFor(verifiedIds: ReadonlySet<string>) {
  return getBacklinkOutreachDraftEligibilityForMembership({
    getMembership: async () => ({ campaign_id: "campaign", opportunity_id: "opportunity" }),
    getOpportunity: async () => ({ id: "opportunity", domain_id: "domain", asset_id: "asset", target_page_url: "https://norixo.io/tools/airbnb-revpar-calculator" }),
    listContactsByDomain: async () => [
      {
        id: "contact",
        contact_key: "CT-000001",
        full_name: "Contact",
        role_title: null,
        contact_status: "verified",
        email_normalized: "contact@example.com",
        linkedin_url: "https://www.linkedin.com/in/contact",
        contact_form_url: "https://example.com/contact",
      },
    ],
    listOutreachByOpportunity: async () => [],
    listCurrentVerifiedContactFormEvidenceContactIds: async (_workspaceId, contacts) => {
      assert.equal(contacts.length, 1, "verification lookup must receive current contacts");
      return verifiedIds;
    },
  }, { workspaceId: "workspace", campaignId: "campaign", opportunityId: "opportunity" });
}

async function main() {
  assert.equal(normalizeContactFormVerificationUrl("https://example.com/contact"), "https://example.com/contact");
  assert.equal(normalizeContactFormVerificationUrl("http://example.com/contact"), null);
  assert.equal(normalizeContactFormVerificationUrl(" https://example.com/contact "), null);
  assert.equal(normalizeContactFormVerificationUrl("https://example.com\\@evil/contact"), null);

  assert.equal(isValidContactFormVerificationEvidence(validEvidence), true, "valid structural evidence must pass");
  assert.equal(isValidContactFormVerificationEvidence({ ...validEvidence, form_count: 0 }), false, "empty form count must fail");
  assert.equal(isValidContactFormVerificationEvidence({ ...validEvidence, message_field_present: false }), false, "missing message field must fail");
  assert.equal(isValidContactFormVerificationEvidence({ ...validEvidence, submit_control_present: false }), false, "missing submit control must fail");
  assert.equal(isValidContactFormVerificationEvidence({ ...validEvidence, contact_intent: false }), false, "non-contact intent must fail");
  assert.equal(isValidContactFormVerificationEvidence({ ...validEvidence, newsletter_only: true }), false, "newsletter-only evidence must fail");
  assert.equal(isValidContactFormVerificationEvidence({ ...validEvidence, login_only: true }), false, "login-only evidence must fail");
  assert.equal(isValidContactFormVerificationEvidence({ ...validEvidence, support_only: true }), false, "support-only evidence must fail");
  assert.equal(isValidContactFormVerificationEvidence({ ...validEvidence, sales_demo_only: true }), false, "sales/demo-only evidence must fail");

  const contact = { id: "contact", contact_form_url: "https://example.com/contact" };
  assert.equal(hasCurrentVerifiedContactFormEvidence(contact, null), false, "missing verification must fail");
  assert.equal(hasCurrentVerifiedContactFormEvidence(contact, verification({ verification_state: "rejected", verified_at: null, safe_evidence: {} })), false, "rejected verification must fail");
  assert.equal(hasCurrentVerifiedContactFormEvidence(contact, verification({ form_url: "https://example.com/other" })), false, "URL mismatch must fail");
  assert.equal(hasCurrentVerifiedContactFormEvidence(contact, verification({ verified_at: null })), false, "verified_at is required");
  assert.equal(hasCurrentVerifiedContactFormEvidence(contact, verification({ safe_evidence: { ...validEvidence, form_count: 0 } })), false, "malformed evidence must fail");
  assert.equal(hasCurrentVerifiedContactFormEvidence(contact, baseVerification), true, "valid exact verified evidence must pass");

  assert.deepEqual(
    resolveBacklinkOutreachChannels({ contact_status: "verified", email_normalized: "editor@example.com", linkedin_url: "https://www.linkedin.com/in/editor", contact_form_url: "https://example.com/contact" }),
    ["email", "linkedin"],
    "other channels must remain available without contact-form verification",
  );
  assert.deepEqual(
    resolveBacklinkOutreachChannels({ contact_status: "verified", email_normalized: null, contact_form_url: "https://www.hospitalitynet.org/work-with-us", contact_form_verified: false }),
    [],
    "Hospitality Net-style generic stored URL alone must not pass",
  );
  assert.deepEqual(
    resolveBacklinkOutreachChannels({ contact_status: "verified", email_normalized: null, contact_form_url: "https://www.visitbritain.org/research-insights", contact_form_verified: false }),
    [],
    "VisitBritain-style generic stored URL alone must not pass",
  );
  assert.deepEqual(
    resolveBacklinkOutreachChannels({ contact_status: "verified", email_normalized: null, contact_form_url: "https://insights.ehl.edu/resources", contact_form_verified: false }),
    [],
    "EHL-style generic stored URL alone must not pass",
  );
  assert.deepEqual(
    resolveBacklinkOutreachChannels({ contact_status: "verified", email_normalized: null, contact_form_url: "https://example.com/contact", contact_form_verified: true }),
    ["contact_form"],
    "valid current verification must enable contact-form",
  );

  const withoutEvidence = await eligibilityFor(new Set());
  assert.ok(!withoutEvidence.contacts[0].eligibleChannels.includes("contact_form"), "eligibility must fail closed without verification");
  const withEvidence = await eligibilityFor(new Set(["contact"]));
  assert.ok(withEvidence.contacts[0].eligibleChannels.includes("contact_form"), "eligibility must allow exact current verification");

  const migration = readFileSync(join(process.cwd(), "supabase/migrations/20260905130000_add_contact_form_verification_gate.sql"), "utf8");
  for (const clause of [
    "create table public.backlink_contact_form_verifications",
    "verification_state text not null check (verification_state in ('verified','rejected'))",
    "verified_at timestamptz",
    "safe_evidence jsonb not null default '{}'::jsonb",
    "backlink_contact_form_verifications_verified_evidence_check",
    "public.backlink_contact_form_verification_evidence_valid(safe_evidence)",
    "create unique index backlink_contact_form_verifications_one_current_per_url_idx",
    "create policy \"backlink_contact_form_verifications_select_workspace_members\"",
    "revoke all on public.backlink_contact_form_verifications from public, anon, authenticated",
    "grant select on public.backlink_contact_form_verifications to authenticated",
    "grant select, insert, update on public.backlink_contact_form_verifications to service_role",
    "CONTACT_FORM_VERIFICATION_REQUIRED",
  ]) assert.ok(migration.includes(clause), `missing verification migration contract: ${clause}`);

  assert.match(migration, /v\.workspace_id\s*=\s*c\.workspace_id[\s\S]*v\.contact_id\s*=\s*c\.id[\s\S]*v\.form_url\s*=\s*trim\(c\.contact_form_url\)/, "verification helper must be workspace/contact/exact-current-URL bound");
  assert.match(migration, /v\.verification_state\s*=\s*'verified'[\s\S]*v\.verified_at\s+is\s+not\s+null[\s\S]*backlink_contact_form_verification_evidence_valid\(v\.safe_evidence\)/, "verification helper must require verified state, verified_at, and valid evidence");
  assertMigrationContainsInOrder(migration, [
    "create or replace function public.approve_backlink_contact_form_initial_v1",
    "CONTACT_FORM_VERIFICATION_REQUIRED",
    "insert into public.backlink_contact_form_approvals",
  ], "approval must gate before creating approval");
  assertMigrationContainsInOrder(migration, [
    "create or replace function public.queue_backlink_contact_form_run_v1",
    "CONTACT_FORM_VERIFICATION_REQUIRED",
    "insert into public.backlink_contact_form_runs",
  ], "queue must gate before creating run");
  assertMigrationContainsInOrder(migration, [
    "create or replace function public.validate_backlink_contact_form_run_binding",
    "CONTACT_FORM_VERIFICATION_REQUIRED",
    "CONTACT_FORM_RUN_ATTEMPT_BINDING_MISMATCH",
  ], "direct run insert/update binding must require verified evidence");

  const foundationMigration = readFileSync(join(process.cwd(), "supabase/migrations/20260902120000_add_backlink_contact_form_automation_foundation.sql"), "utf8");
  assert.ok(foundationMigration.includes("prevent_backlink_contact_form_post_submit_retry"), "existing worker/runtime state machine migration must remain present");
  const sourceFiles = [
    "app/api/backlinks/outreach/[id]/contact-form/approval/route.ts",
    "app/api/backlinks/outreach/[id]/contact-form/queue/route.ts",
    "lib/backlinks/repositories/contactFormAutomationRepository.ts",
    "lib/backlinks/services/contactFormAutomationService.ts",
  ];
  const executionPrimitive = /(?:from\s+["'](?:playwright|playwright-core|puppeteer)["']|require\(["'](?:playwright|playwright-core|puppeteer)["']\)|\b(?:chromium|firefox|webkit)\s*\.\s*launch\s*\(|\b(?:scheduleJob|setInterval|setTimeout|cron)\s*\()/;
  for (const file of sourceFiles) {
    const source = readFileSync(join(process.cwd(), file), "utf8").replace(/\/\*[\s\S]*?\*\/|\/\/[^\n]*/g, "");
    assert.ok(!executionPrimitive.test(source), `unexpected browser execution or scheduler primitive: ${file}`);
  }

  console.log("contact-form verification gate C9K tests passed");
}

void main();

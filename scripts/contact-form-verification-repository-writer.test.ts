import assert from "node:assert/strict";

import {
  persistVerifiedContactFormEvidence,
} from "../lib/backlinks/repositories/contactFormAutomationRepository";

type Row = Record<string, unknown>;

function validEvidence() {
  return {
    version: "cfv1",
    actual_form_observed: true,
    form_count: 1,
    selected_form_ordinal: 0,
    mapping_result: "mapped",
    mapped_semantic_fields: ["email", "message"],
    message_field_present: true,
    submit_control_present: true,
    contact_intent: true,
    newsletter_only: false,
    login_only: false,
    support_only: false,
    sales_demo_only: false,
  };
}

async function main() {
  let fromTable: string | null = null;
  let upsertRow: Row | null = null;
  let upsertOptions: Record<string, unknown> | null = null;
  let selectValue: string | null = null;
  let singleCalls = 0;

  const persisted = {
    id: "verification-1",
    workspace_id: "workspace-1",
    contact_id: "contact-1",
    form_url: "https://example.com/contact",
    verification_state: "verified",
    verified_at: "2026-09-28T08:00:00.000Z",
    evidence_version: "cfv1",
    form_fingerprint: "fingerprint-1",
    safe_evidence: validEvidence(),
    created_at: "2026-09-28T08:00:00.000Z",
  };

  const fakeClient = {
    from(table: string) {
      fromTable = table;

      return {
        upsert(row: Row, options: Record<string, unknown>) {
          upsertRow = row;
          upsertOptions = options;

          return {
            select(value: string) {
              selectValue = value;

              return {
                async single() {
                  singleCalls += 1;
                  return { data: persisted, error: null };
                },
              };
            },
          };
        },
      };
    },
  };

  const result = await persistVerifiedContactFormEvidence(
    fakeClient as never,
    {
      workspaceId: "workspace-1",
      contactId: "contact-1",
      formUrl: "https://example.com/contact",
      verifiedAt: "2026-09-28T08:00:00.000Z",
      evidenceVersion: "cfv1",
      formFingerprint: "fingerprint-1",
      safeEvidence: validEvidence(),
    },
  );

  assert.equal(fromTable, "backlink_contact_form_verifications");
  assert.equal(
    (upsertOptions as Record<string, unknown> | null)?.onConflict,
    "workspace_id,contact_id,form_url",
  );
  assert.equal(selectValue, "*");
  assert.equal(singleCalls, 1);

  assert.deepEqual(upsertRow, {
    workspace_id: "workspace-1",
    contact_id: "contact-1",
    form_url: "https://example.com/contact",
    verification_state: "verified",
    verified_at: "2026-09-28T08:00:00.000Z",
    evidence_version: "cfv1",
    form_fingerprint: "fingerprint-1",
    safe_evidence: validEvidence(),
  });

  assert.equal(result.id, "verification-1");

  let invalidTouchedDb = false;

  const failIfTouchedClient = {
    from() {
      invalidTouchedDb = true;
      throw new Error("DB must not be touched");
    },
  };

  await assert.rejects(
    () =>
      persistVerifiedContactFormEvidence(
        failIfTouchedClient as never,
        {
          workspaceId: "workspace-1",
          contactId: "contact-1",
          formUrl: "https://example.com/contact",
          verifiedAt: "2026-09-28T08:00:00.000Z",
          evidenceVersion: "cfv1",
          safeEvidence: {
            ...validEvidence(),
            submit_control_present: false,
          },
        },
      ),
    /safeEvidence is not valid verified contact-form evidence/,
  );

  assert.equal(
    invalidTouchedDb,
    false,
    "invalid evidence must fail before repository I/O",
  );

  console.log("contact-form verification repository writer R24E1 tests passed");
}

void main();

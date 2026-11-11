import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import type { BacklinkRepositoryClient } from "../lib/backlinks/repositories/repositoryClient";
import {
  assertContactSelectionAuthority,
  listContactSelectionCases,
  recordContactSelectionDecision,
} from "../lib/backlinks/repositories/contactSelectionRepository";
import {
  candidateFingerprint,
  classifyLinkedInProfile,
  parseCandidateIds,
  parseContactEvidenceSummary,
  parseContactSelectionDecision,
  type ContactSelectionDecisionInput,
} from "../lib/backlinks/services/contactSelectionReviewService";

const WORKSPACE_ID = "11111111-1111-4111-8111-111111111111";
const TASK_1 = "22222222-2222-4222-8222-222222222222";
const RUN_1 = "33333333-3333-4333-8333-333333333333";
const APP_1 = "44444444-4444-4444-8444-444444444444";
const DOMAIN_1 = "55555555-5555-4555-8555-555555555555";
const OPP_1 = "66666666-6666-4666-8666-666666666666";
const CONTACT_1 = "77777777-7777-4777-8777-777777777777";
const CONTACT_2 = "88888888-8888-4888-8888-888888888888";
const DECISION_1 = "99999999-9999-4999-8999-999999999999";
const SECRET_EMAIL = "secret-email-1@example.test";
const SECRET_LINKEDIN = "https://linkedin.example/secret-handle-1";
const SECRET_FORM_URL = "https://secret-form.example/apply";
const SECRET_SOURCE_URL = "https://secret-provenance.example/team?token=abc123";

type TableResponses = Record<string, { data: unknown; error: unknown }>;
type RpcHandler = (name: string, args: unknown) => Promise<{ data: unknown; error: unknown }>;

function queryBuilder(result: { data: unknown; error: unknown }, eqCalls: Array<[string, unknown]>) {
  const builder: Record<string, unknown> = {};
  builder.eq = (field: string, value: unknown) => {
    eqCalls.push([field, value]);
    return builder;
  };
  for (const method of ["select", "in", "order", "limit"]) builder[method] = () => builder;
  for (const method of ["insert", "update", "delete", "upsert"]) {
    builder[method] = () => {
      throw new Error(`UNEXPECTED_WRITE_CALL:${method}`);
    };
  }
  builder.maybeSingle = () => Promise.resolve(result);
  (builder as { then: typeof Promise.prototype.then }).then = (onFulfilled, onRejected) =>
    Promise.resolve(result).then(onFulfilled, onRejected);
  return builder;
}

function clientFor(options: {
  tableResponses?: TableResponses;
  rpc: RpcHandler;
  fromCalls?: string[];
  eqCallsByTable?: Record<string, Array<[string, unknown]>>;
}): BacklinkRepositoryClient {
  const tableResponses = options.tableResponses ?? {};
  const fromCalls = options.fromCalls ?? [];
  const eqCallsByTable = options.eqCallsByTable ?? {};
  return {
    from: (table: string) => {
      fromCalls.push(table);
      const eqCalls = eqCallsByTable[table] ?? (eqCallsByTable[table] = []);
      return queryBuilder(tableResponses[table] ?? { data: [], error: null }, eqCalls);
    },
    rpc: options.rpc,
  } as unknown as BacklinkRepositoryClient;
}

function authorityRpc(privateAdmin: boolean, workspaceAdmin: boolean): RpcHandler {
  return async (name) => {
    if (name === "is_norixo_private_admin") return { data: privateAdmin, error: null };
    if (name === "is_workspace_admin_or_owner") return { data: workspaceAdmin, error: null };
    throw new Error(`unexpected rpc ${name}`);
  };
}

// --- assertContactSelectionAuthority: fail-closed double gate ---

test("assertContactSelectionAuthority resolves only when both authorities are strictly true", async () => {
  await assert.doesNotReject(() =>
    assertContactSelectionAuthority(clientFor({ rpc: authorityRpc(true, true) }), WORKSPACE_ID),
  );
});

test("assertContactSelectionAuthority rejects when the private admin check is false", async () => {
  await assert.rejects(
    () => assertContactSelectionAuthority(clientFor({ rpc: authorityRpc(false, true) }), WORKSPACE_ID),
    (error: unknown) => error instanceof Error && (error as { code?: string }).code === "FORBIDDEN",
  );
});

test("assertContactSelectionAuthority rejects when the workspace admin/owner check is false", async () => {
  await assert.rejects(
    () => assertContactSelectionAuthority(clientFor({ rpc: authorityRpc(true, false) }), WORKSPACE_ID),
    (error: unknown) => error instanceof Error && (error as { code?: string }).code === "FORBIDDEN",
  );
});

test("assertContactSelectionAuthority rejects (fails closed) when either RPC errors, even if data is true", async () => {
  const rpc: RpcHandler = async (name) =>
    name === "is_norixo_private_admin" ? { data: true, error: { message: "boom" } } : { data: true, error: null };
  await assert.rejects(
    () => assertContactSelectionAuthority(clientFor({ rpc }), WORKSPACE_ID),
    (error: unknown) => error instanceof Error && (error as { code?: string }).code === "FORBIDDEN",
  );
});

test("an unauthorized caller triggers zero data reads: listContactSelectionCases never touches a table", async () => {
  const fromCalls: string[] = [];
  await assert.rejects(() =>
    listContactSelectionCases(clientFor({ rpc: authorityRpc(false, true), fromCalls }), WORKSPACE_ID),
  );
  assert.deepEqual(fromCalls, []);
});

test("an unauthorized caller triggers zero RPC calls: recordContactSelectionDecision never reaches the 5F RPC", async () => {
  const rpcNames: string[] = [];
  const rpc: RpcHandler = async (name) => {
    rpcNames.push(name);
    if (name === "is_norixo_private_admin") return { data: true, error: null };
    if (name === "is_workspace_admin_or_owner") return { data: false, error: null };
    return { data: [{ decision_id: DECISION_1, disposition: "created" }], error: null };
  };
  await assert.rejects(() =>
    recordContactSelectionDecision(clientFor({ rpc }), WORKSPACE_ID, validSelectInput()),
  );
  assert.deepEqual(rpcNames, ["is_norixo_private_admin", "is_workspace_admin_or_owner"]);
});

// --- GET: contract-scoped data, no PII leakage, workspace isolation ---

function buildCaseTableResponses(): TableResponses {
  return {
    automation_tasks: {
      data: [
        {
          id: TASK_1,
          run_id: RUN_1,
          input: { promotionApplicationId: APP_1, opportunityId: OPP_1, domainId: DOMAIN_1 },
          output: { createdContactIds: [CONTACT_1], existingContactIds: [CONTACT_2] },
          completed_at: "2026-11-01T00:00:00.000Z",
        },
      ],
      error: null,
    },
    automation_runs: {
      data: [{ id: RUN_1, workspace_id: WORKSPACE_ID, system: "backlinks", run_kind: "backlinks.autonomy", status: "completed" }],
      error: null,
    },
    backlink_promotion_applications: {
      data: [{ id: APP_1, workspace_id: WORKSPACE_ID, domain_id: DOMAIN_1, opportunity_id: OPP_1 }],
      error: null,
    },
    backlink_contacts: {
      data: [
        {
          id: CONTACT_1, workspace_id: WORKSPACE_ID, domain_id: DOMAIN_1,
          full_name: "Jane Doe", role_title: "Marketing Manager",
          email_normalized: SECRET_EMAIL, linkedin_url: SECRET_LINKEDIN, contact_form_url: null,
          contact_status: "unverified", source_type: "scrape",
          source_reference: JSON.stringify([
            { kind: "mailto", value: SECRET_EMAIL, sourceUrl: SECRET_SOURCE_URL, confidence: "strong" },
            { kind: "mailto", value: SECRET_EMAIL, sourceUrl: SECRET_SOURCE_URL, confidence: "strong" },
            { kind: "linkedin", value: SECRET_LINKEDIN, sourceUrl: SECRET_SOURCE_URL, confidence: "medium" },
          ]),
          archived_at: null, do_not_contact_at: null,
        },
        {
          id: CONTACT_2, workspace_id: WORKSPACE_ID, domain_id: DOMAIN_1,
          full_name: null, role_title: null,
          email_normalized: null, linkedin_url: null, contact_form_url: SECRET_FORM_URL,
          contact_status: "unverified", source_type: "manual", source_reference: "not-json-at-all",
          archived_at: null, do_not_contact_at: null,
        },
      ],
      error: null,
    },
    backlink_contact_selection_decisions: { data: [], error: null },
    backlink_contact_mailbox_verification_requests: { data: [], error: null },
    backlink_contact_mailbox_verifications: { data: [], error: null },
    backlink_contact_form_verification_preflights: { data: [], error: null },
  };
}

test("listContactSelectionCases exposes only contract-defined identity/booleans/states, never raw contact channels or provenance URLs", async () => {
  const cases = await listContactSelectionCases(
    clientFor({ tableResponses: buildCaseTableResponses(), rpc: authorityRpc(true, true) }),
    WORKSPACE_ID,
  );
  assert.equal(cases.length, 1);
  const serialized = JSON.stringify(cases);
  assert.equal(serialized.includes(SECRET_EMAIL), false, "raw email must never be serialized");
  assert.equal(serialized.includes(SECRET_LINKEDIN), false, "raw LinkedIn URL must never be serialized");
  assert.equal(serialized.includes(SECRET_FORM_URL), false, "raw contact form URL must never be serialized");
  assert.equal(serialized.includes(SECRET_SOURCE_URL), false, "a provenance source URL must never be serialized, even though it is present in source_reference");
  assert.equal(serialized.includes("not-json-at-all"), false, "the raw source_reference text must never be serialized verbatim");
  assert.equal(serialized.includes("token=abc123"), false, "no URL query parameter from a provenance source must ever leak");

  const candidate1 = cases[0].candidates.find((candidate) => candidate.id === CONTACT_1);
  const candidate2 = cases[0].candidates.find((candidate) => candidate.id === CONTACT_2);
  assert.ok(candidate1 && candidate2);
  const expectedKeys = ["id", "fullName", "roleTitle", "channels", "contactStatus", "evidenceSummary", "linkedinProfileKind", "mailboxState", "contactFormState", "selectable", "blockingCodes"].sort();
  assert.deepEqual(Object.keys(candidate1!).sort(), expectedKeys);
  assert.deepEqual(candidate1!.channels, { email: true, contactForm: false, linkedIn: true });
  assert.deepEqual(candidate2!.channels, { email: false, contactForm: true, linkedIn: false });
  assert.equal(candidate1!.contactFormState, "not_applicable");
  assert.equal(candidate1!.selectable, true);
  assert.equal(candidate1!.fullName, "Jane Doe", "a disambiguating display name must be surfaced to the authorized reviewer");
  assert.equal(candidate1!.roleTitle, "Marketing Manager");
  assert.equal(candidate2!.fullName, null, "a missing name must surface as null, never a fabricated label");
  assert.equal(candidate2!.roleTitle, null);

  assert.deepEqual(candidate1!.evidenceSummary, [
    { kind: "linkedin", confidence: "medium", count: 1 },
    { kind: "mailto", confidence: "strong", count: 2 },
  ], "distinct (kind, confidence) pairs from source_reference must be counted, never the raw entries");
  assert.deepEqual(candidate2!.evidenceSummary, [], "unparseable source_reference must degrade to an empty, safe summary");

  // SECRET_LINKEDIN does not resolve to linkedin.com, so this also proves a non-matching
  // hostname is classified "unknown" rather than crashing or defaulting to "person".
  assert.equal(candidate1!.linkedinProfileKind, "unknown");
  assert.equal(candidate2!.linkedinProfileKind, "not_applicable", "a candidate with no LinkedIn channel must not be classified as a profile kind");
});

test("listContactSelectionCases scopes every table read to the caller's own workspace_id", async () => {
  const eqCallsByTable: Record<string, Array<[string, unknown]>> = {};
  const otherWorkspaceId = "00000000-0000-4000-8000-000000000000";
  await listContactSelectionCases(
    clientFor({ tableResponses: buildCaseTableResponses(), rpc: authorityRpc(true, true), eqCallsByTable }),
    otherWorkspaceId,
  );
  const tablesRequiringWorkspaceScoping = [
    "automation_tasks", "automation_runs", "backlink_promotion_applications",
    "backlink_contacts", "backlink_contact_selection_decisions",
    "backlink_contact_mailbox_verification_requests", "backlink_contact_mailbox_verifications",
  ];
  for (const table of tablesRequiringWorkspaceScoping) {
    const calls = eqCallsByTable[table] ?? [];
    assert.ok(
      calls.some(([field, value]) => field === "workspace_id" && value === otherWorkspaceId),
      `${table} must be filtered by the caller's workspace_id (${otherWorkspaceId})`,
    );
  }
});

test("a candidate contact outside the resolved domain is excluded from the case entirely", async () => {
  const tableResponses = buildCaseTableResponses();
  (tableResponses.backlink_contacts.data as Array<Record<string, unknown>>)[1].domain_id = "00000000-0000-4000-8000-000000000001";
  const cases = await listContactSelectionCases(clientFor({ tableResponses, rpc: authorityRpc(true, true) }), WORKSPACE_ID);
  assert.equal(cases.length, 0, "a candidate from a different domain must void the whole case, not just that candidate");
});

test("a singleton resolution (one candidate) never becomes a reviewable case", async () => {
  const tableResponses = buildCaseTableResponses();
  (tableResponses.automation_tasks.data as Array<Record<string, unknown>>)[0].output = {
    createdContactIds: [CONTACT_1],
    existingContactIds: [],
  };
  const cases = await listContactSelectionCases(clientFor({ tableResponses, rpc: authorityRpc(true, true) }), WORKSPACE_ID);
  assert.equal(cases.length, 0, "singleton B resolutions must never surface for human selection");
});

// --- POST: cannot bypass the 5F RPC's own restrictions; safe, non-leaking error mapping ---

function validSelectInput(overrides: Partial<ContactSelectionDecisionInput> = {}): ContactSelectionDecisionInput {
  return {
    promotionApplicationId: APP_1,
    sourceResolutionTaskId: TASK_1,
    selectedContactId: CONTACT_1,
    candidateFingerprint: candidateFingerprint({
      workspaceId: WORKSPACE_ID, promotionApplicationId: APP_1, sourceResolutionTaskId: TASK_1,
      candidateIds: [CONTACT_1, CONTACT_2],
    }),
    idempotencyKey: "a".repeat(16),
    reasonCode: "HUMAN_REVIEW_SELECTED",
    confirm: true,
    ...overrides,
  };
}

test("recordContactSelectionDecision forwards fields verbatim to the 5F RPC and surfaces 'created'", async () => {
  const calls: Array<{ name: string; args: unknown }> = [];
  const input = validSelectInput();
  const rpc: RpcHandler = async (name, args) => {
    calls.push({ name, args });
    if (name === "is_norixo_private_admin" || name === "is_workspace_admin_or_owner") return { data: true, error: null };
    return { data: [{ decision_id: DECISION_1, disposition: "created" }], error: null };
  };
  const result = await recordContactSelectionDecision(clientFor({ rpc }), WORKSPACE_ID, input);
  assert.deepEqual(result, { decisionId: DECISION_1, disposition: "created" });
  const rpcCall = calls.find((call) => call.name === "record_backlink_contact_selection_decision");
  assert.deepEqual(rpcCall?.args, {
    p_workspace_id: WORKSPACE_ID, p_promotion_application_id: input.promotionApplicationId,
    p_source_resolution_task_id: input.sourceResolutionTaskId, p_selected_contact_id: input.selectedContactId,
    p_expected_candidate_fingerprint: input.candidateFingerprint, p_idempotency_key: input.idempotencyKey,
    p_reason_code: input.reasonCode, p_confirmed: true,
  });
});

test("recordContactSelectionDecision surfaces 'replayed' without any special-casing by the Node layer", async () => {
  const rpc: RpcHandler = async (name) => {
    if (name === "is_norixo_private_admin" || name === "is_workspace_admin_or_owner") return { data: true, error: null };
    return { data: [{ decision_id: DECISION_1, disposition: "replayed" }], error: null };
  };
  const result = await recordContactSelectionDecision(clientFor({ rpc }), WORKSPACE_ID, validSelectInput());
  assert.deepEqual(result, { decisionId: DECISION_1, disposition: "replayed" });
});

test("idempotence: two calls with the identical idempotencyKey pass that exact key through unmodified both times", async () => {
  const dispositions = ["created", "replayed"];
  const seenKeys: unknown[] = [];
  let call = 0;
  const rpc: RpcHandler = async (name, args) => {
    if (name === "is_norixo_private_admin" || name === "is_workspace_admin_or_owner") return { data: true, error: null };
    seenKeys.push((args as { p_idempotency_key: string }).p_idempotency_key);
    const disposition = dispositions[call++];
    return { data: [{ decision_id: DECISION_1, disposition }], error: null };
  };
  const input = validSelectInput();
  const first = await recordContactSelectionDecision(clientFor({ rpc }), WORKSPACE_ID, input);
  const second = await recordContactSelectionDecision(clientFor({ rpc }), WORKSPACE_ID, input);
  assert.equal(first.disposition, "created");
  assert.equal(second.disposition, "replayed");
  assert.equal(seenKeys[0], input.idempotencyKey);
  assert.equal(seenKeys[1], input.idempotencyKey);
});

test("a rejection decision carries a null contact id and the given reason code straight through to the RPC", async () => {
  const calls: unknown[] = [];
  const input = validSelectInput({
    selectedContactId: null,
    reasonCode: "HUMAN_REVIEW_REJECTED_NO_APPROPRIATE_CONTACT",
  });
  const rpc: RpcHandler = async (name, args) => {
    if (name === "is_norixo_private_admin" || name === "is_workspace_admin_or_owner") return { data: true, error: null };
    calls.push(args);
    return { data: [{ decision_id: DECISION_1, disposition: "created" }], error: null };
  };
  await recordContactSelectionDecision(clientFor({ rpc }), WORKSPACE_ID, input);
  assert.equal((calls[0] as { p_selected_contact_id: unknown }).p_selected_contact_id, null);
  assert.equal((calls[0] as { p_reason_code: unknown }).p_reason_code, "HUMAN_REVIEW_REJECTED_NO_APPROPRIATE_CONTACT");
});

test("a tampered/invalid RPC response (unknown disposition) is rejected as a DATABASE error, not trusted", async () => {
  for (const data of [
    [{ decision_id: DECISION_1, disposition: "deleted" }],
    [],
    [{ decision_id: DECISION_1, disposition: "created" }, { decision_id: DECISION_1, disposition: "created" }],
    "not-an-array",
    null,
  ]) {
    const rpc: RpcHandler = async (name) => {
      if (name === "is_norixo_private_admin" || name === "is_workspace_admin_or_owner") return { data: true, error: null };
      return { data, error: null };
    };
    await assert.rejects(
      () => recordContactSelectionDecision(clientFor({ rpc }), WORKSPACE_ID, validSelectInput()),
      (error: unknown) => error instanceof Error && (error as { code?: string }).code === "DATABASE",
    );
  }
});

test("every class of 5F RPC rejection (out-of-set candidate, stale fingerprint, already decided, forbidden, invalid input) reaches the caller as a generic error with no leaked exception text", async () => {
  const exceptions = [
    "BACKLINK_CONTACT_SELECTION_CONTACT_INVALID",
    "BACKLINK_CONTACT_SELECTION_CONTACT_INELIGIBLE",
    "BACKLINK_CONTACT_SELECTION_FINGERPRINT_STALE",
    "BACKLINK_CONTACT_SELECTION_ALREADY_DECIDED",
    "BACKLINK_CONTACT_SELECTION_CANDIDATES_INVALID",
    "BACKLINK_CONTACT_SELECTION_PROMOTION_SCOPE_INVALID",
    "BACKLINK_CONTACT_SELECTION_FORBIDDEN",
    "BACKLINK_CONTACT_SELECTION_INVALID_INPUT",
    "BACKLINK_CONTACT_SELECTION_IDEMPOTENCY_CONFLICT",
  ];
  for (const exceptionName of exceptions) {
    const rpc: RpcHandler = async (name) => {
      if (name === "is_norixo_private_admin" || name === "is_workspace_admin_or_owner") return { data: true, error: null };
      return { data: null, error: { code: "P0001", message: exceptionName } };
    };
    await assert.rejects(
      () => recordContactSelectionDecision(clientFor({ rpc }), WORKSPACE_ID, validSelectInput()),
      (error: unknown) => {
        assert.ok(error instanceof Error);
        assert.equal((error as Error).message.includes("BACKLINK_CONTACT_SELECTION"), false, `must not leak ${exceptionName}`);
        return true;
      },
    );
  }
});

// --- Pure input validation (service layer) ---

test("parseContactSelectionDecision enforces the exact selection/rejection XOR contract", () => {
  const base = validSelectInput();
  assert.equal(parseContactSelectionDecision({ ...base, selectedContactId: null }), null, "null contact with SELECTED reason is invalid");
  assert.equal(
    parseContactSelectionDecision({ ...base, reasonCode: "HUMAN_REVIEW_REJECTED_INSUFFICIENT_EVIDENCE" }),
    null,
    "a selected contact with a rejection reason code is invalid",
  );
  assert.ok(parseContactSelectionDecision(base) != null, "a well-formed selection is accepted");
  assert.ok(
    parseContactSelectionDecision({ ...base, selectedContactId: null, reasonCode: "HUMAN_REVIEW_REJECTED_INSUFFICIENT_EVIDENCE" }) != null,
    "a well-formed rejection is accepted",
  );
});

test("parseContactSelectionDecision rejects malformed bodies", () => {
  const base = validSelectInput();
  assert.equal(parseContactSelectionDecision({ ...base, extra: "x" }), null, "extra keys are rejected");
  assert.equal(parseContactSelectionDecision({ ...base, promotionApplicationId: "not-a-uuid" }), null);
  assert.equal(parseContactSelectionDecision({ ...base, candidateFingerprint: "too-short" }), null);
  assert.equal(parseContactSelectionDecision({ ...base, idempotencyKey: "short" }), null, "idempotency key under 16 chars is rejected");
  assert.equal(parseContactSelectionDecision({ ...base, idempotencyKey: ` ${base.idempotencyKey} ` }), null, "untrimmed idempotency key is rejected");
  assert.equal(parseContactSelectionDecision({ ...base, reasonCode: "NOT_A_REAL_CODE" }), null);
  assert.equal(parseContactSelectionDecision({ ...base, confirm: false }), null, "confirm must be exactly true, never implicit");
  assert.equal(parseContactSelectionDecision(null), null);
  assert.equal(parseContactSelectionDecision("x"), null);
});

test("parseCandidateIds excludes singletons, duplicates, and malformed ids", () => {
  assert.equal(parseCandidateIds({ createdContactIds: [CONTACT_1], existingContactIds: [] }), null, "a single candidate must be excluded");
  assert.deepEqual(parseCandidateIds({ createdContactIds: [CONTACT_1], existingContactIds: [CONTACT_2] }), [CONTACT_1, CONTACT_2].sort());
  assert.equal(
    parseCandidateIds({ createdContactIds: [CONTACT_1], existingContactIds: [CONTACT_1] }),
    null,
    "the same contact appearing in both created and existing lists must be rejected, not silently deduped into a valid case",
  );
  assert.equal(parseCandidateIds({ createdContactIds: [CONTACT_1], existingContactIds: ["not-a-uuid"] }), null);
  assert.equal(parseCandidateIds({ createdContactIds: "x", existingContactIds: [] }), null);
});

test("candidateFingerprint is deterministic regardless of candidate input order", () => {
  const a = candidateFingerprint({ workspaceId: WORKSPACE_ID, promotionApplicationId: APP_1, sourceResolutionTaskId: TASK_1, candidateIds: [CONTACT_1, CONTACT_2] });
  const b = candidateFingerprint({ workspaceId: WORKSPACE_ID, promotionApplicationId: APP_1, sourceResolutionTaskId: TASK_1, candidateIds: [CONTACT_2, CONTACT_1] });
  assert.equal(a, b);
  assert.match(a, /^[a-f0-9]{64}$/);
});

// --- parseContactEvidenceSummary: defensive parsing of a free-text column ---

test("parseContactEvidenceSummary accepts a well-formed evidence array and counts (kind, confidence) pairs", () => {
  const summary = parseContactEvidenceSummary(JSON.stringify([
    { kind: "mailto", value: "a@example.test", sourceUrl: "https://example.test/contact", confidence: "strong" },
    { kind: "mailto", value: "a@example.test", sourceUrl: "https://example.test/contact", confidence: "strong" },
    { kind: "contact_form", value: "https://example.test/contact-form", sourceUrl: "https://example.test/contact", confidence: "medium" },
  ]));
  assert.deepEqual(summary, [
    { kind: "contact_form", confidence: "medium", count: 1 },
    { kind: "mailto", confidence: "strong", count: 2 },
  ]);
});

test("parseContactEvidenceSummary treats absent/empty/non-string input as no evidence, never throws", () => {
  for (const value of [null, undefined, "", "   ", 42, {}, []]) {
    assert.deepEqual(parseContactEvidenceSummary(value), []);
  }
});

test("parseContactEvidenceSummary degrades malformed JSON to an empty summary instead of throwing", () => {
  for (const malformed of ["not-json-at-all", "{bad json", "[{\"kind\":\"mailto\"", "undefined"]) {
    assert.deepEqual(parseContactEvidenceSummary(malformed), []);
  }
});

test("parseContactEvidenceSummary rejects unexpected structures: non-array JSON, wrong element types, unknown kind/confidence values", () => {
  assert.deepEqual(parseContactEvidenceSummary(JSON.stringify({ kind: "mailto", confidence: "strong" })), [], "a bare object instead of an array must yield no evidence");
  assert.deepEqual(parseContactEvidenceSummary(JSON.stringify(["just a string", 42, null, ["nested", "array"]])), [], "non-object array elements must be ignored, not crash");
  assert.deepEqual(
    parseContactEvidenceSummary(JSON.stringify([{ kind: "zerobounce_call", confidence: "strong" }, { kind: "mailto", confidence: "verified" }])),
    [],
    "an unrecognized kind or confidence value outside the closed enums must never be trusted through",
  );
  assert.deepEqual(
    parseContactEvidenceSummary(JSON.stringify([{ kind: "mailto" }, { confidence: "strong" }])),
    [],
    "a partial object missing either field must be ignored",
  );
});

test("parseContactEvidenceSummary caps pathologically large input instead of doing unbounded work on a free-text column", () => {
  const hugeString = `"${"a".repeat(25_000)}"`;
  assert.deepEqual(parseContactEvidenceSummary(`[{"kind":"mailto","confidence":"strong","note":${hugeString}}]`), []);
  const manyItems = JSON.stringify(Array.from({ length: 200 }, () => ({ kind: "mailto", confidence: "strong" })));
  const cappedSummary = parseContactEvidenceSummary(manyItems);
  assert.equal(cappedSummary.length, 1);
  assert.ok(cappedSummary[0].count <= 50, "counting must stop at the item cap, not scan an unbounded array");
});

// --- classifyLinkedInProfile: a company page must never be treated as a named person ---

test("classifyLinkedInProfile distinguishes personal profiles, company pages, unknown shapes, and absence — without ever needing the URL back", () => {
  assert.equal(classifyLinkedInProfile(null), "not_applicable");
  assert.equal(classifyLinkedInProfile("https://www.linkedin.com/in/jane-doe-12345"), "person");
  assert.equal(classifyLinkedInProfile("https://linkedin.com/in/jane-doe"), "person");
  assert.equal(classifyLinkedInProfile("https://www.linkedin.com/company/acme-corp"), "company");
  assert.equal(classifyLinkedInProfile("https://fr.linkedin.com/company/acme-corp"), "company");
  assert.equal(classifyLinkedInProfile("https://www.linkedin.com/pulse/some-article"), "unknown", "a LinkedIn URL that is neither /in/ nor /company/ must not be guessed as a person");
  assert.equal(classifyLinkedInProfile("https://not-linkedin.example/in/jane-doe"), "unknown", "a look-alike host must never be classified as a real LinkedIn profile");
  assert.equal(classifyLinkedInProfile("not a url"), "unknown", "an unparseable URL must degrade safely, never throw");
});

// --- Cross-file and structural safeguards ---

test("the Node fingerprint formula stays byte-for-byte consistent with the 5F Postgres RPC's formula", () => {
  const serviceSource = readFileSync("lib/backlinks/services/contactSelectionReviewService.ts", "utf8");
  const migrationSource = readFileSync("supabase/migrations/20261110100000_add_backlink_contact_selection_decisions.sql", "utf8");
  assert.ok(serviceSource.includes("backlink-contact-selection-v1|workspace="));
  assert.ok(migrationSource.includes("'backlink-contact-selection-v1|workspace='"));
  for (const token of ["|promotion=", "|task=", "|candidates="]) {
    assert.ok(serviceSource.includes(token), `TS formula missing ${token}`);
    assert.ok(migrationSource.includes(`'${token}'`), `SQL formula missing ${token}`);
  }
});

test("the repository and service files never call outreach, mailbox-claim, or ZeroBounce side-effecting functions", () => {
  const repositorySource = readFileSync("lib/backlinks/repositories/contactSelectionRepository.ts", "utf8");
  const serviceSource = readFileSync("lib/backlinks/services/contactSelectionReviewService.ts", "utf8");
  const routeSource = readFileSync("app/api/backlinks/contact-selections/route.ts", "utf8");
  const forbiddenTokens = [
    "claimMailboxVerificationRequest", "claimContactFormVerificationPreflight", "ZeroBounce", "zerobounce",
    "sendOutreach", "createOutreach", "scheduleBacklink", "resumeBacklink", "createAutomationTask", "createAutomationRun",
  ];
  for (const source of [repositorySource, serviceSource, routeSource]) {
    for (const token of forbiddenTokens) assert.equal(source.includes(token), false, `unexpected downstream token "${token}"`);
  }
  const rpcCalls = [...repositorySource.matchAll(/client\.rpc\("([^"]+)"/g)].map((match) => match[1]);
  assert.deepEqual(new Set(rpcCalls), new Set(["is_norixo_private_admin", "is_workspace_admin_or_owner", "record_backlink_contact_selection_decision"]));
});

test("route.ts never serializes the underlying error message/cause back to the client", () => {
  const routeSource = readFileSync("app/api/backlinks/contact-selections/route.ts", "utf8");
  const responseForBody = routeSource.slice(routeSource.indexOf("function responseFor"), routeSource.indexOf("export async function GET"));
  assert.equal(responseForBody.includes("error.message"), false);
  assert.equal(responseForBody.includes("error.cause"), false);
  assert.equal(responseForBody.includes("String(error)"), false);
  for (const safeMessage of ["Forbidden", "Contact selection is no longer available.", "Contact selection is unavailable."]) {
    assert.ok(responseForBody.includes(safeMessage), `missing safe message literal: ${safeMessage}`);
  }
});

test("route.ts enforces the private-admin email gate and asserts authority before touching any case data, on both GET and POST", () => {
  const routeSource = readFileSync("app/api/backlinks/contact-selections/route.ts", "utf8");
  assert.ok(routeSource.includes('!isAdminPrivateEmail(auth.user.email)) return "forbidden"'));
  const getBody = routeSource.slice(routeSource.indexOf("export async function GET"), routeSource.indexOf("export async function POST"));
  const postBody = routeSource.slice(routeSource.indexOf("export async function POST"));
  for (const body of [getBody, postBody]) {
    const authorityIndex = body.indexOf("assertContactSelectionAuthority");
    const dataCallIndex = Math.min(
      ...[body.indexOf("listContactSelectionCases"), body.indexOf("recordContactSelectionDecision")].filter((index) => index !== -1),
    );
    assert.ok(authorityIndex !== -1 && authorityIndex < dataCallIndex, "authority must be asserted before any case data is read or written");
  }
});

test("the dialog never allows submitting a decision outside the server-provided candidate set, and states no downstream action is triggered", () => {
  const dialogSource = readFileSync("app/(default)/dashboard/backlinks/_components/ContactSelectionReviewDialog.tsx", "utf8");
  assert.ok(dialogSource.includes("selectedCase.candidates.some((candidate) => candidate.id === selectedContactId && candidate.selectable)"));
  assert.ok(dialogSource.includes("Les résolutions singleton ne sont pas éligibles"));
  assert.ok(dialogSource.includes("ne déclenche aucune validation, tâche ou prise de contact"));
  assert.ok(dialogSource.includes("aucun outreach, e-mail ou contrôle payant ne sera déclenché"));
});

test("the dialog renders the candidate's name/role instead of a bare index, so an admin can tell candidates apart", () => {
  const dialogSource = readFileSync("app/(default)/dashboard/backlinks/_components/ContactSelectionReviewDialog.tsx", "utf8");
  assert.ok(dialogSource.includes("candidate.fullName"), "the label must be driven by the candidate's name, not just its position");
  assert.ok(dialogSource.includes("candidate.roleTitle"), "the role title must be surfaced alongside the name");
  assert.equal(dialogSource.includes("E-mail présent"), true);
  for (const leak of ["candidate.email_normalized", "candidate.linkedin_url", "candidate.contact_form_url"]) {
    assert.equal(dialogSource.includes(leak), false, "the dialog must never receive or render a raw contact channel value");
  }
});

test("the dialog surfaces evidence kind/confidence and the LinkedIn person-vs-company classification, never a raw URL or 'verified' wording", () => {
  const dialogSource = readFileSync("app/(default)/dashboard/backlinks/_components/ContactSelectionReviewDialog.tsx", "utf8");
  assert.ok(dialogSource.includes("candidate.evidenceSummary"), "evidence kinds/confidence must be rendered from the safe structured summary");
  assert.ok(dialogSource.includes("candidate.linkedinProfileKind"), "the LinkedIn classification must be rendered");
  assert.ok(dialogSource.includes("Preuves de provenance (non vérifiées)"), "evidence must be labeled as unverified, never implying a mailbox/identity check");
  assert.ok(dialogSource.includes("pas une personne"), "a company LinkedIn page must be explicitly disambiguated from a person");
  for (const forbidden of ["sourceUrl", "evidence.value", "item.sourceUrl", "linkedin_url"]) {
    assert.equal(dialogSource.includes(forbidden), false, `the dialog must never reference a raw provenance URL (${forbidden})`);
  }
});

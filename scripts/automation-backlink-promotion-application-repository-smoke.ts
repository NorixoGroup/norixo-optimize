import {
  applyBacklinkPromotionProposalTransaction,
  BacklinkPromotionApplicationRepositoryError,
  type ApplyBacklinkPromotionProposalRepositoryInput,
} from "../lib/automation";

type RpcCall = {
  functionName: string;
  args: Record<string, unknown>;
};

type RpcOutcome = { data: unknown; error: unknown };

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function assertRepositoryError(error: unknown, code: string): void {
  assert(error instanceof BacklinkPromotionApplicationRepositoryError, "Expected repository error.");
  assert(error.code === code, `Expected ${code}, received ${error.code}.`);
}

function createRpcClient(outcome: RpcOutcome): {
  client: { rpc: (functionName: string, args: Record<string, unknown>) => Promise<RpcOutcome> };
  calls: RpcCall[];
} {
  const calls: RpcCall[] = [];
  return {
    client: {
      async rpc(functionName: string, args: Record<string, unknown>): Promise<RpcOutcome> {
        calls.push({ functionName, args });
        return outcome;
      },
    },
    calls,
  };
}

const input: ApplyBacklinkPromotionProposalRepositoryInput = {
  workspaceId: "00000000-0000-4000-8000-000000000001",
  actorUserId: "00000000-0000-4000-8000-000000000002",
  runId: "00000000-0000-4000-8000-000000000003",
  promotionTaskId: "00000000-0000-4000-8000-000000000004",
  proposalKey: "promotion:candidate-1",
  candidateKey: "candidate-1",
  hostname: "example.com",
  targetPageUrl: "https://example.com/resources",
  targetPageTitle: "Useful resources",
  opportunityType: "Resource Page",
  pageType: "Resource Page",
  priority: "Tier A",
  evidenceSummary: "Qualified resource page.",
  assetId: "00000000-0000-4000-8000-000000000005",
  qualificationScore: 91,
  qualificationConfidence: "medium",
  promotionPolicyVersion: "backlink-promotion-v1",
};

const createdRow = {
  application_id: "00000000-0000-4000-8000-000000000006",
  domain_id: "00000000-0000-4000-8000-000000000007",
  opportunity_id: "00000000-0000-4000-8000-000000000008",
  domain_disposition: "created",
  opportunity_disposition: "created",
  audit_written: true,
};

async function assertRejects(
  operation: () => Promise<unknown>,
  code: string,
): Promise<void> {
  try {
    await operation();
  } catch (error) {
    assertRepositoryError(error, code);
    return;
  }
  throw new Error(`Expected ${code}.`);
}

async function main(): Promise<void> {
  const originalDebugFlag = process.env.DEBUG_BACKLINK_PROMOTION_APPLY;
  delete process.env.DEBUG_BACKLINK_PROMOTION_APPLY;
  const originalInput = { ...input };
  const created = createRpcClient({ data: [createdRow], error: null });
  const createdResult = await applyBacklinkPromotionProposalTransaction(created.client, input);
  assert(created.calls.length === 1, "Expected one RPC for a created application.");
  assert(created.calls[0].functionName === "apply_backlink_promotion_proposal", "Expected exact RPC name.");
  assert(
    JSON.stringify(created.calls[0].args) ===
      JSON.stringify({
        p_workspace_id: input.workspaceId,
        p_actor_user_id: input.actorUserId,
        p_run_id: input.runId,
        p_promotion_task_id: input.promotionTaskId,
        p_proposal_key: input.proposalKey,
        p_candidate_key: input.candidateKey,
        p_hostname: input.hostname,
        p_target_page_url: input.targetPageUrl,
        p_target_page_title: input.targetPageTitle,
        p_opportunity_type: input.opportunityType,
        p_page_type: input.pageType,
        p_priority: input.priority,
        p_evidence_summary: input.evidenceSummary,
        p_asset_id: input.assetId,
        p_qualification_score: input.qualificationScore,
        p_qualification_confidence: input.qualificationConfidence,
        p_promotion_policy_version: input.promotionPolicyVersion,
      }),
    "Expected exact RPC arguments.",
  );
  assert(createdResult.domainDisposition === "created", "Expected created domain disposition.");
  assert(createdResult.opportunityDisposition === "created", "Expected created opportunity disposition.");
  assert(createdResult.auditWritten === true, "Expected auditWritten true.");
  assert(JSON.stringify(input) === JSON.stringify(originalInput), "Input must remain unchanged.");

  const existing = createRpcClient({
    data: [{ ...createdRow, domain_disposition: "existing", opportunity_disposition: "existing" }],
    error: null,
  });
  const existingResult = await applyBacklinkPromotionProposalTransaction(existing.client, input);
  assert(existing.calls.length === 1, "Existing application must use one RPC.");
  assert(existingResult.domainDisposition === "existing", "Expected existing domain disposition.");
  assert(existingResult.opportunityDisposition === "existing", "Expected existing opportunity disposition.");

  for (const outcome of [
    { data: [], error: null, code: "PROMOTION_APPLICATION_RESULT_MISSING" },
    { data: [createdRow, createdRow], error: null, code: "PROMOTION_APPLICATION_RESULT_MULTIPLE" },
    { data: [{ ...createdRow, application_id: "invalid" }], error: null, code: "PROMOTION_APPLICATION_RESULT_INVALID" },
    { data: [{ ...createdRow, domain_disposition: "unexpected" }], error: null, code: "PROMOTION_APPLICATION_RESULT_INVALID" },
    { data: [{ ...createdRow, audit_written: false }], error: null, code: "PROMOTION_APPLICATION_RESULT_INVALID" },
    { data: [{ ...createdRow, audit_written: true, opportunity_id: undefined }], error: null, code: "PROMOTION_APPLICATION_RESULT_INVALID" },
  ]) {
    const client = createRpcClient(outcome);
    await assertRejects(
      () => applyBacklinkPromotionProposalTransaction(client.client, input),
      outcome.code,
    );
    assert(client.calls.length === 1, "Invalid RPC result must still come from one RPC.");
  }

  for (const outcome of [
    { data: null, error: { code: "XX000", detail: "private", hint: "private" }, code: "PROMOTION_APPLICATION_RPC_FAILED" },
    { data: null, error: { message: "PROMOTION_DOMAIN_ARCHIVED", detail: "private" }, code: "PROMOTION_DOMAIN_ARCHIVED" },
  ]) {
    const client = createRpcClient(outcome);
    await assertRejects(
      () => applyBacklinkPromotionProposalTransaction(client.client, input),
      outcome.code,
    );
  }

  const originalConsoleError = console.error;
  const logs: unknown[][] = [];
  console.error = (...args: unknown[]): void => {
    logs.push(args);
  };
  try {
    const disabledClient = createRpcClient({
      data: null,
      error: {
        code: "XX000",
        message: "database failure",
        details: "private detail",
        hint: "private hint",
      },
    });
    await assertRejects(
      () => applyBacklinkPromotionProposalTransaction(disabledClient.client, input),
      "PROMOTION_APPLICATION_RPC_FAILED",
    );
    const disabledLogCount = logs.length;
    assert(disabledLogCount === 0, "Disabled debug flag must not log RPC failures.");
    assert(disabledClient.calls.length === 1, "Disabled debug failure must use one RPC.");

    process.env.DEBUG_BACKLINK_PROMOTION_APPLY = "true";
    const detailedClient = createRpcClient({
      data: null,
      error: {
        code: "XX000",
        message: `${"m".repeat(501)}\nignored`,
        details: `${"d".repeat(501)}\nignored`,
        hint: `${"h".repeat(301)}\nignored`,
      },
    });
    await assertRejects(
      () => applyBacklinkPromotionProposalTransaction(detailedClient.client, input),
      "PROMOTION_APPLICATION_RPC_FAILED",
    );
    assert(logs.length === 1, "Enabled debug flag must log exactly one RPC failure.");
    assert(logs[0][0] === "[automation/backlinks/promotions/apply-rpc] failed", "Expected exact diagnostic prefix.");
    const log = logs[0][1];
    assert(isRecord(log), "Expected structured diagnostic fields.");
    const fields = log;
    assert(fields.code === "XX000", "Diagnostic code must be preserved.");
    assert(typeof fields.message === "string" && fields.message.length === 500 && !fields.message.includes("\n"), "Diagnostic message must be bounded and single-line.");
    assert(typeof fields.details === "string" && fields.details.length === 500 && !fields.details.includes("\n"), "Diagnostic details must be bounded and single-line.");
    assert(typeof fields.hint === "string" && fields.hint.length === 300 && !fields.hint.includes("\n"), "Diagnostic hint must be bounded and single-line.");
    assert(detailedClient.calls.length === 1, "Enabled debug failure must use one RPC.");
    const serializedLog = JSON.stringify(log);
    for (const forbidden of [
      input.workspaceId,
      input.actorUserId,
      input.runId,
      input.promotionTaskId,
      input.proposalKey,
      input.candidateKey,
      input.assetId,
      input.hostname,
      input.targetPageUrl,
      input.targetPageTitle,
      input.evidenceSummary,
    ]) {
      assert(!serializedLog.includes(forbidden), `Diagnostic log must not include ${forbidden}.`);
    }
  } finally {
    console.error = originalConsoleError;
    if (originalDebugFlag === undefined) {
      delete process.env.DEBUG_BACKLINK_PROMOTION_APPLY;
    } else {
      process.env.DEBUG_BACKLINK_PROMOTION_APPLY = originalDebugFlag;
    }
  }

  for (const invalidInput of [
    { ...input, workspaceId: "invalid" },
    { ...input, proposalKey: "" },
    { ...input, qualificationScore: -1 },
    { ...input, qualificationScore: 101 },
  ]) {
    const client = createRpcClient({ data: [createdRow], error: null });
    await assertRejects(
      () => applyBacklinkPromotionProposalTransaction(client.client, invalidInput),
      "PROMOTION_APPLICATION_RESULT_INVALID",
    );
    assert(client.calls.length === 0, "Invalid input must not invoke the RPC.");
  }

  console.log("PASS — Automation backlink promotion application repository smoke");
}

void main();

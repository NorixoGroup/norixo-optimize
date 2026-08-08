import {
  applyBacklinkPromotionProposal,
  applyBacklinkPromotionProposalTransaction,
  BacklinkPromotionApplicationRepositoryError,
  BacklinkPromotionApplyServiceError,
  BacklinkPromotionProposalReaderError,
  BacklinkPromotionValidationError,
  readBacklinkPromotionProposal,
  type AutomationTask,
  type BacklinkAsset,
  type BacklinkPromotionPreviewOutputV1,
} from "../lib/automation";

const workspaceId = "00000000-0000-4000-8000-000000000001";
const actorUserId = "00000000-0000-4000-8000-000000000002";
const runId = "00000000-0000-4000-8000-000000000003";
const promotionTaskId = "00000000-0000-4000-8000-000000000004";
const assetId = "00000000-0000-4000-8000-000000000005";

type RpcCall = { name: string; args: Record<string, unknown> };
type RpcOutcome = { data: unknown; error: unknown };

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

function preview(): BacklinkPromotionPreviewOutputV1 {
  return {
    version: 1,
    kind: "backlinks.promotion.preview",
    dryRun: true,
    policyVersion: "backlink-promotion-v1",
    summary: { qualificationResults: 2, eligible: 1, proposed: 1, skipped: 1, duplicates: 0 },
    proposals: [
      {
        proposalKey: "promotion:candidate-one",
        candidateKey: "candidate-one",
        hostname: "example.com",
        targetPageUrl: "https://example.com:443/host-resources?utm_source=mail&gclid=abc&keep=yes",
        targetPageTitle: "Host resources",
        opportunityType: "Resource Page",
        pageType: "Resource Page",
        priority: "Tier A",
        qualificationScore: 82,
        qualificationConfidence: "medium",
        evidenceSummary: "Relevant resource page for hosts",
        suggestedAssetKey: "asset-host-guide",
        promotionDecision: "propose",
      },
    ],
    skippedItems: [
      {
        candidateKey: "candidate-two",
        promotionDecision: "skip",
        skipCode: "QUALIFICATION_REVIEW_REQUIRED",
        evidence: "Qualification requires review",
      },
    ],
  };
}

function task(output: BacklinkPromotionPreviewOutputV1, overrides: Partial<AutomationTask> = {}): AutomationTask {
  return {
    id: promotionTaskId,
    workspaceId,
    runId,
    dependsOnTaskId: null,
    system: "backlinks",
    taskKind: "backlinks.promotion.preview",
    taskKey: "promotion-preview",
    status: "completed",
    priority: 30,
    scheduledAt: "2026-08-04T09:00:00.000Z",
    availableAt: "2026-08-04T09:00:00.000Z",
    claimedAt: null,
    startedAt: null,
    heartbeatAt: null,
    leaseExpiresAt: null,
    completedAt: "2026-08-04T09:01:00.000Z",
    failedAt: null,
    cancelledAt: null,
    workerId: "worker",
    attemptCount: 1,
    maxAttempts: 3,
    backoffBaseSeconds: 60,
    input: {},
    output,
    errorCode: null,
    errorMessage: null,
    createdAt: "2026-08-04T09:00:00.000Z",
    updatedAt: "2026-08-04T09:01:00.000Z",
    ...overrides,
  };
}

function activeAsset(): BacklinkAsset {
  return { id: assetId, workspaceId, lifecycleStatus: "active" };
}

function rpcClient(outcomes: RpcOutcome[]): {
  client: { rpc: (name: string, args: Record<string, unknown>) => Promise<RpcOutcome> };
  calls: RpcCall[];
} {
  const calls: RpcCall[] = [];
  let index = 0;
  return {
    client: {
      async rpc(name: string, args: Record<string, unknown>): Promise<RpcOutcome> {
        calls.push({ name, args });
        const outcome = outcomes[index];
        index += 1;
        if (outcome === undefined) {
          throw new Error("Unexpected RPC call.");
        }
        return outcome;
      },
    },
    calls,
  };
}

function compose(
  promotionTask: AutomationTask,
  asset: BacklinkAsset | null,
  client: { rpc: (name: string, args: Record<string, unknown>) => Promise<RpcOutcome> },
  calls: string[],
  proposalKey = "promotion:candidate-one",
) {
  return {
    async apply() {
      return applyBacklinkPromotionProposal(
        {
          async readPromotionProposal(input) {
            calls.push("task");
            return readBacklinkPromotionProposal(
              {
                async getTaskByIdInRun(taskInput) {
                  assert(
                    JSON.stringify(taskInput) ===
                      JSON.stringify({ workspaceId, runId, taskId: promotionTaskId }),
                    "Reader must use the service workspace/run/task.",
                  );
                  return promotionTask;
                },
              },
              input,
            );
          },
          async getAssetById(assetInput) {
            calls.push("asset");
            assert(
              JSON.stringify(assetInput) === JSON.stringify({ workspaceId, assetId }),
              "Asset lookup must be workspace-scoped.",
            );
            return asset;
          },
          async applyPromotionTransaction(applicationInput) {
            calls.push("rpc");
            return applyBacklinkPromotionProposalTransaction(client, applicationInput);
          },
        },
        { workspaceId, actorUserId, runId, promotionTaskId, proposalKey, assetId },
      );
    },
  };
}

function createdRow(domainDisposition: "created" | "existing", opportunityDisposition: "created" | "existing") {
  return {
    application_id: "00000000-0000-4000-8000-000000000006",
    domain_id: "00000000-0000-4000-8000-000000000007",
    opportunity_id: "00000000-0000-4000-8000-000000000008",
    domain_disposition: domainDisposition,
    opportunity_disposition: opportunityDisposition,
    audit_written: true,
  };
}

async function assertReaderError(operation: () => Promise<unknown>, code: string): Promise<void> {
  try {
    await operation();
  } catch (error) {
    assert(error instanceof BacklinkPromotionProposalReaderError, "Expected reader error.");
    assert(error.code === code, `Expected ${code}, received ${error.code}.`);
    return;
  }
  throw new Error(`Expected ${code}.`);
}

async function assertApplyError(operation: () => Promise<unknown>, code: string): Promise<void> {
  try {
    await operation();
  } catch (error) {
    assert(error instanceof BacklinkPromotionApplyServiceError, "Expected apply service error.");
    assert(error.code === code, `Expected ${code}, received ${error.code}.`);
    return;
  }
  throw new Error(`Expected ${code}.`);
}

async function assertValidationError(operation: () => Promise<unknown>): Promise<void> {
  try {
    await operation();
  } catch (error) {
    assert(error instanceof BacklinkPromotionValidationError, "Expected promotion validation error.");
    assert(error.code === "INVALID_PROMOTION_OUTPUT", "Expected invalid promotion output.");
    return;
  }
  throw new Error("Expected promotion validation error.");
}

async function assertRepositoryError(operation: () => Promise<unknown>, code: string): Promise<void> {
  try {
    await operation();
  } catch (error) {
    assert(error instanceof BacklinkPromotionApplicationRepositoryError, "Expected repository error.");
    assert(error.code === code, `Expected ${code}, received ${error.code}.`);
    assert(!error.message.includes("private") && !error.message.includes("Error:"), "Repository errors must remain safe.");
    return;
  }
  throw new Error(`Expected ${code}.`);
}

async function main(): Promise<void> {
  const sourcePreview = preview();
  const sourceTask = task(sourcePreview);
  const sourceAsset = activeAsset();
  const taskBefore = JSON.stringify(sourceTask);
  const previewBefore = JSON.stringify(sourcePreview);
  const assetBefore = JSON.stringify(sourceAsset);
  const rpc = rpcClient([{ data: [createdRow("created", "created")], error: null }]);
  const order: string[] = [];
  const created = await compose(sourceTask, sourceAsset, rpc.client, order).apply();
  assert(JSON.stringify(order) === JSON.stringify(["task", "asset", "rpc"]), "Expected task, asset, RPC order.");
  assert(rpc.calls.length === 1 && rpc.calls[0]?.name === "apply_backlink_promotion_proposal", "Expected one exact RPC.");
  assert(
    JSON.stringify(rpc.calls[0]?.args) ===
      JSON.stringify({
        p_workspace_id: workspaceId,
        p_actor_user_id: actorUserId,
        p_run_id: runId,
        p_promotion_task_id: promotionTaskId,
        p_proposal_key: "promotion:candidate-one",
        p_candidate_key: "candidate-one",
        p_hostname: "example.com",
        p_target_page_url: "https://example.com/host-resources?keep=yes",
        p_target_page_title: "Host resources",
        p_opportunity_type: "Resource Page",
        p_page_type: "Resource Page",
        p_priority: "Tier A",
        p_evidence_summary: "Relevant resource page for hosts",
        p_asset_id: assetId,
        p_qualification_score: 82,
        p_qualification_confidence: "medium",
        p_promotion_policy_version: "backlink-promotion-v1",
      }),
    "Expected exact canonical RPC arguments.",
  );
  assert(created.kind === "applied" && created.disposition === "created" && created.domainDisposition === "created", "Expected created result.");
  assert(created.auditWritten === true, "Expected audit write confirmation.");
  assert(JSON.stringify(sourceTask) === taskBefore && JSON.stringify(sourcePreview) === previewBefore && JSON.stringify(sourceAsset) === assetBefore, "Fixtures must remain immutable.");

  const existingRpc = rpcClient([{ data: [createdRow("existing", "existing")], error: null }]);
  const existingOrder: string[] = [];
  const existing = await compose(task(preview()), activeAsset(), existingRpc.client, existingOrder).apply();
  assert(existing.disposition === "existing" && existing.domainDisposition === "existing", "Expected existing result.");
  assert(existingRpc.calls.length === 1 && JSON.stringify(existingOrder) === JSON.stringify(["task", "asset", "rpc"]), "Existing must perform one normal flow.");

  const idempotentRpc = rpcClient([
    { data: [createdRow("created", "created")], error: null },
    { data: [createdRow("existing", "existing")], error: null },
  ]);
  const idempotentOrder: string[] = [];
  const idempotent = compose(task(preview()), activeAsset(), idempotentRpc.client, idempotentOrder);
  const first = await idempotent.apply();
  const second = await idempotent.apply();
  assert(first.disposition === "created" && second.disposition === "existing", "Idempotent dispositions must come from RPC.");
  assert(idempotentRpc.calls.length === 2, "Service must not cache the transaction.");
  assert(idempotentRpc.calls[0]?.args.p_proposal_key === idempotentRpc.calls[1]?.args.p_proposal_key, "Proposal key must remain stable.");

  const skippedPreview = preview();
  Reflect.set(skippedPreview, "proposals", []);
  Reflect.set(skippedPreview.summary, "qualificationResults", 1);
  Reflect.set(skippedPreview.summary, "eligible", 0);
  Reflect.set(skippedPreview.summary, "proposed", 0);
  const skippedRpc = rpcClient([{ data: [createdRow("created", "created")], error: null }]);
  const skippedOrder: string[] = [];
  await assertReaderError(() => compose(task(skippedPreview), activeAsset(), skippedRpc.client, skippedOrder, "candidate-two").apply(), "PROMOTION_PROPOSAL_NOT_FOUND");
  assert(JSON.stringify(skippedOrder) === JSON.stringify(["task"]) && skippedRpc.calls.length === 0, "Skipped proposal must not reach asset or RPC.");

  const invalidOutput = preview();
  Reflect.set(invalidOutput, "dryRun", false);
  const invalidOutputRpc = rpcClient([{ data: [createdRow("created", "created")], error: null }]);
  const invalidOutputOrder: string[] = [];
  await assertValidationError(() => compose(task(invalidOutput), activeAsset(), invalidOutputRpc.client, invalidOutputOrder).apply());
  assert(JSON.stringify(invalidOutputOrder) === JSON.stringify(["task"]) && invalidOutputRpc.calls.length === 0, "Invalid output must not reach asset or RPC.");

  for (const taskValue of [
    task(preview(), { status: "queued" }),
    task(preview(), { taskKind: "backlinks.qualification.preview" }),
  ]) {
    const failureRpc = rpcClient([{ data: [createdRow("created", "created")], error: null }]);
    const failureOrder: string[] = [];
    await assertReaderError(
      () => compose(taskValue, activeAsset(), failureRpc.client, failureOrder).apply(),
      taskValue.status !== "completed" ? "PROMOTION_TASK_NOT_COMPLETED" : "PROMOTION_TASK_KIND_INVALID",
    );
    assert(JSON.stringify(failureOrder) === JSON.stringify(["task"]) && failureRpc.calls.length === 0, "Invalid task must stop before asset and RPC.");
  }

  for (const [asset, code] of [
    [null, "PROMOTION_ASSET_NOT_FOUND"],
    [{ ...activeAsset(), workspaceId: "00000000-0000-4000-8000-000000000099" }, "PROMOTION_ASSET_WORKSPACE_MISMATCH"],
    [{ ...activeAsset(), id: "00000000-0000-4000-8000-000000000099" }, "PROMOTION_ASSET_WORKSPACE_MISMATCH"],
    [{ ...activeAsset(), lifecycleStatus: "archived" }, "PROMOTION_ASSET_NOT_ACTIVE"],
  ] as const) {
    const failureRpc = rpcClient([{ data: [createdRow("created", "created")], error: null }]);
    const failureOrder: string[] = [];
    await assertApplyError(() => compose(task(preview()), asset, failureRpc.client, failureOrder).apply(), code);
    assert(JSON.stringify(failureOrder) === JSON.stringify(["task", "asset"]) && failureRpc.calls.length === 0, "Invalid asset must not reach RPC.");
  }

  const repositoryFailures: Array<{ outcome: RpcOutcome; code: string }> = [
    { outcome: { data: null, error: { code: "XX000", detail: "private", hint: "private" } }, code: "PROMOTION_APPLICATION_RPC_FAILED" },
    { outcome: { data: null, error: { message: "PROMOTION_DOMAIN_ARCHIVED", detail: "private" } }, code: "PROMOTION_DOMAIN_ARCHIVED" },
    { outcome: { data: [], error: null }, code: "PROMOTION_APPLICATION_RESULT_MISSING" },
    { outcome: { data: [createdRow("created", "created"), createdRow("created", "created")], error: null }, code: "PROMOTION_APPLICATION_RESULT_MULTIPLE" },
    { outcome: { data: [{ ...createdRow("created", "created"), application_id: "invalid" }], error: null }, code: "PROMOTION_APPLICATION_RESULT_INVALID" },
    { outcome: { data: [{ ...createdRow("created", "created"), domain_disposition: "invalid" }], error: null }, code: "PROMOTION_APPLICATION_RESULT_INVALID" },
    { outcome: { data: [{ ...createdRow("created", "created"), audit_written: false }], error: null }, code: "PROMOTION_APPLICATION_RESULT_INVALID" },
  ];
  for (const { outcome, code } of repositoryFailures) {
    const failureRpc = rpcClient([outcome]);
    const failureOrder: string[] = [];
    await assertRepositoryError(() => compose(task(preview()), activeAsset(), failureRpc.client, failureOrder).apply(), code);
    assert(failureRpc.calls.length === 1 && JSON.stringify(failureOrder) === JSON.stringify(["task", "asset", "rpc"]), "Repository errors must not retry.");
  }

  console.log("PASS — Automation backlink promotion apply integration smoke");
}

void main();

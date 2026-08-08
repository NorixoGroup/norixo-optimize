import {
  applyBacklinkPromotionProposal,
  BacklinkPromotionApplyServiceError,
  BacklinkPromotionProposalReaderError,
  type ApplyBacklinkPromotionProposalDependencies,
  type ApplyBacklinkPromotionProposalInput,
  type ApplyBacklinkPromotionProposalRepositoryResult,
  type AutomationTask,
  type BacklinkAsset,
  type BacklinkPromotionPreviewOutputV1,
  type ReadBacklinkPromotionProposalResult,
} from "../lib/automation";

const workspaceId = "00000000-0000-4000-8000-000000000001";
const actorUserId = "00000000-0000-4000-8000-000000000002";
const runId = "00000000-0000-4000-8000-000000000003";
const promotionTaskId = "00000000-0000-4000-8000-000000000004";
const assetId = "00000000-0000-4000-8000-000000000005";

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
    summary: { qualificationResults: 1, eligible: 1, proposed: 1, skipped: 0, duplicates: 0 },
    proposals: [
      {
        proposalKey: "promotion:candidate-one",
        candidateKey: "candidate-one",
        hostname: "example.com",
        targetPageUrl: "https://example.com/host-resources?utm_source=newsletter#section",
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
    skippedItems: [],
  };
}

function task(output: BacklinkPromotionPreviewOutputV1): AutomationTask {
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
  };
}

function readerResult(output = preview()): ReadBacklinkPromotionProposalResult {
  const promotionTask = task(output);
  const proposal = output.proposals[0];
  assert(proposal !== undefined, "Proposal fixture must exist.");
  return { promotionTask, promotionPreview: output, proposal };
}

function activeAsset(): BacklinkAsset {
  return { id: assetId, workspaceId, lifecycleStatus: "active" };
}

const input: ApplyBacklinkPromotionProposalInput = {
  workspaceId,
  actorUserId,
  runId,
  promotionTaskId,
  proposalKey: "promotion:candidate-one",
  assetId,
};

type Calls = {
  order: string[];
  reader: unknown[];
  asset: unknown[];
  application: unknown[];
};

function dependenciesFor(
  result: ReadBacklinkPromotionProposalResult,
  asset: BacklinkAsset | null,
  application: ApplyBacklinkPromotionProposalRepositoryResult = {
    applicationId: "00000000-0000-4000-8000-000000000006",
    domainId: "00000000-0000-4000-8000-000000000007",
    opportunityId: "00000000-0000-4000-8000-000000000008",
    domainDisposition: "created" as const,
    opportunityDisposition: "created" as const,
    auditWritten: true as const,
  },
): { dependencies: ApplyBacklinkPromotionProposalDependencies; calls: Calls } {
  const calls: Calls = { order: [], reader: [], asset: [], application: [] };
  return {
    dependencies: {
      async readPromotionProposal(readerInput) {
        calls.order.push("reader");
        calls.reader.push(readerInput);
        return result;
      },
      async getAssetById(assetInput) {
        calls.order.push("asset");
        calls.asset.push(assetInput);
        return asset;
      },
      async applyPromotionTransaction(applicationInput) {
        calls.order.push("application");
        calls.application.push(applicationInput);
        return application;
      },
    },
    calls,
  };
}

async function assertServiceError(operation: () => Promise<unknown>, code: string): Promise<void> {
  try {
    await operation();
  } catch (error) {
    assert(error instanceof BacklinkPromotionApplyServiceError, "Expected apply service error.");
    assert(error.code === code, `Expected ${code}, received ${error.code}.`);
    assert(
      !error.message.includes(workspaceId) &&
        !error.message.includes("https://example.com") &&
        !error.message.includes("example.com") &&
        !error.message.includes("Error:"),
      "Service errors must remain safe.",
    );
    return;
  }
  throw new Error(`Expected ${code}.`);
}

async function callWithUnknownInput(
  dependencies: ApplyBacklinkPromotionProposalDependencies,
  unknownInput: unknown,
): Promise<unknown> {
  return Reflect.apply(applyBacklinkPromotionProposal, undefined, [dependencies, unknownInput]);
}

async function main(): Promise<void> {
  const source = readerResult();
  const asset = activeAsset();
  const { dependencies, calls } = dependenciesFor(source, asset);
  const inputBefore = JSON.stringify(input);
  const sourceBefore = JSON.stringify(source);
  const assetBefore = JSON.stringify(asset);
  const result = await applyBacklinkPromotionProposal(dependencies, input);
  assert(JSON.stringify(calls.order) === JSON.stringify(["reader", "asset", "application"]), "Expected exact call order.");
  assert(calls.reader.length === 1 && calls.asset.length === 1 && calls.application.length === 1, "Expected one call per dependency.");
  assert(
    JSON.stringify(calls.reader[0]) === JSON.stringify({ workspaceId, runId, promotionTaskId, proposalKey: input.proposalKey }),
    "Expected exact reader input.",
  );
  assert(
    JSON.stringify(calls.asset[0]) === JSON.stringify({ workspaceId, assetId }),
    "Expected exact workspace-scoped asset lookup.",
  );
  assert(
    JSON.stringify(calls.application[0]) ===
      JSON.stringify({
        workspaceId,
        actorUserId,
        runId,
        promotionTaskId,
        proposalKey: "promotion:candidate-one",
        candidateKey: "candidate-one",
        hostname: "example.com",
        targetPageUrl: "https://example.com/host-resources",
        targetPageTitle: "Host resources",
        opportunityType: "Resource Page",
        pageType: "Resource Page",
        priority: "Tier A",
        evidenceSummary: "Relevant resource page for hosts",
        assetId,
        qualificationScore: 82,
        qualificationConfidence: "medium",
        promotionPolicyVersion: "backlink-promotion-v1",
      }),
    "Expected exact canonical transaction input.",
  );
  assert(result.kind === "applied" && result.disposition === "created", "Expected created application result.");
  assert(JSON.stringify(input) === inputBefore, "Input must remain immutable.");
  assert(JSON.stringify(source) === sourceBefore, "Reader result must remain immutable.");
  assert(JSON.stringify(asset) === assetBefore, "Asset must remain immutable.");

  const existing = dependenciesFor(source, asset, {
    applicationId: "00000000-0000-4000-8000-000000000006",
    domainId: "00000000-0000-4000-8000-000000000007",
    opportunityId: "00000000-0000-4000-8000-000000000008",
    domainDisposition: "existing",
    opportunityDisposition: "existing",
    auditWritten: true,
  });
  const existingResult = await applyBacklinkPromotionProposal(existing.dependencies, input);
  assert(existingResult.disposition === "existing" && existingResult.domainDisposition === "existing", "Existing result must be preserved.");

  for (const invalidInput of [
    null,
    [],
    { ...input, extra: true },
    { ...input, workspaceId: "invalid" },
    { ...input, proposalKey: "" },
    { ...input, proposalKey: " " },
    { ...input, proposalKey: "p".repeat(129) },
  ]) {
    const fixture = dependenciesFor(readerResult(), activeAsset());
    await assertServiceError(
      () => callWithUnknownInput(fixture.dependencies, invalidInput),
      "INVALID_PROMOTION_APPLY_INPUT",
    );
    assert(fixture.calls.order.length === 0, "Invalid input must not call dependencies.");
  }

  const readerError = new BacklinkPromotionProposalReaderError("PROMOTION_TASK_NOT_FOUND");
  const readerFailure: ApplyBacklinkPromotionProposalDependencies = {
    async readPromotionProposal() {
      throw readerError;
    },
    async getAssetById() {
      throw new Error("asset must not be read");
    },
    async applyPromotionTransaction() {
      throw new Error("application must not be written");
    },
  };
  try {
    await applyBacklinkPromotionProposal(readerFailure, input);
  } catch (error) {
    assert(error === readerError, "Reader errors must preserve identity.");
  }

  for (const [mutate, code] of [
    [(previewValue: BacklinkPromotionPreviewOutputV1) => Reflect.set(previewValue.proposals[0]!, "hostname", "EXAMPLE.COM"), "PROMOTION_HOSTNAME_INVALID"],
    [(previewValue: BacklinkPromotionPreviewOutputV1) => Reflect.set(previewValue.proposals[0]!, "hostname", "localhost"), "PROMOTION_HOSTNAME_INVALID"],
    [(previewValue: BacklinkPromotionPreviewOutputV1) => Reflect.set(previewValue.proposals[0]!, "targetPageUrl", "invalid"), "PROMOTION_TARGET_URL_INVALID"],
    [(previewValue: BacklinkPromotionPreviewOutputV1) => Reflect.set(previewValue.proposals[0]!, "targetPageUrl", "http://127.0.0.1/internal"), "PROMOTION_TARGET_URL_INVALID"],
    [(previewValue: BacklinkPromotionPreviewOutputV1) => Reflect.set(previewValue.proposals[0]!, "targetPageUrl", "https://other.example/page"), "PROMOTION_HOSTNAME_URL_MISMATCH"],
  ] as const) {
    const output = preview();
    mutate(output);
    const fixture = dependenciesFor(readerResult(output), activeAsset());
    await assertServiceError(() => applyBacklinkPromotionProposal(fixture.dependencies, input), code);
    assert(JSON.stringify(fixture.calls.order) === JSON.stringify(["reader"]), "Invalid proposal URL must stop before asset and RPC.");
  }

  for (const mutate of [
    (previewValue: BacklinkPromotionPreviewOutputV1) => Reflect.set(previewValue.proposals[0]!, "targetPageTitle", ""),
    (previewValue: BacklinkPromotionPreviewOutputV1) => Reflect.set(previewValue.proposals[0]!, "opportunityType", "Unsupported"),
    (previewValue: BacklinkPromotionPreviewOutputV1) => Reflect.set(previewValue.proposals[0]!, "pageType", "Unsupported"),
    (previewValue: BacklinkPromotionPreviewOutputV1) => Reflect.set(previewValue.proposals[0]!, "priority", "Tier D"),
    (previewValue: BacklinkPromotionPreviewOutputV1) => Reflect.set(previewValue.proposals[0]!, "qualificationScore", 101),
    (previewValue: BacklinkPromotionPreviewOutputV1) => Reflect.set(previewValue.proposals[0]!, "qualificationConfidence", "high"),
    (previewValue: BacklinkPromotionPreviewOutputV1) => Reflect.set(previewValue.proposals[0]!, "evidenceSummary", ""),
    (previewValue: BacklinkPromotionPreviewOutputV1) => Reflect.set(previewValue.proposals[0]!, "promotionDecision", "skip"),
  ]) {
    const output = preview();
    mutate(output);
    const fixture = dependenciesFor(readerResult(output), activeAsset());
    await assertServiceError(
      () => applyBacklinkPromotionProposal(fixture.dependencies, input),
      "PROMOTION_PROPOSAL_INVALID",
    );
    assert(JSON.stringify(fixture.calls.order) === JSON.stringify(["reader"]), "Invalid proposal must stop before asset and RPC.");
  }

  for (const [assetValue, code] of [
    [null, "PROMOTION_ASSET_NOT_FOUND"],
    [{ ...activeAsset(), workspaceId: "00000000-0000-4000-8000-000000000099" }, "PROMOTION_ASSET_WORKSPACE_MISMATCH"],
    [{ ...activeAsset(), id: "00000000-0000-4000-8000-000000000099" }, "PROMOTION_ASSET_WORKSPACE_MISMATCH"],
    [{ ...activeAsset(), lifecycleStatus: "archived" }, "PROMOTION_ASSET_NOT_ACTIVE"],
  ] as const) {
    const fixture = dependenciesFor(readerResult(), assetValue);
    await assertServiceError(() => applyBacklinkPromotionProposal(fixture.dependencies, input), code);
    assert(JSON.stringify(fixture.calls.order) === JSON.stringify(["reader", "asset"]), "Invalid asset must stop before RPC.");
  }

  const assetError = new Error("asset failure");
  const assetFailure = dependenciesFor(readerResult(), activeAsset()).dependencies;
  assetFailure.getAssetById = async () => {
    throw assetError;
  };
  try {
    await applyBacklinkPromotionProposal(assetFailure, input);
  } catch (error) {
    assert(error === assetError, "Asset errors must preserve identity.");
  }

  const transactionError = new Error("transaction failure");
  const transactionFailure = dependenciesFor(readerResult(), activeAsset()).dependencies;
  transactionFailure.applyPromotionTransaction = async () => {
    throw transactionError;
  };
  try {
    await applyBacklinkPromotionProposal(transactionFailure, input);
  } catch (error) {
    assert(error === transactionError, "Transaction errors must preserve identity.");
  }

  const first = dependenciesFor(readerResult(), activeAsset());
  const second = dependenciesFor(readerResult(), activeAsset(), {
    applicationId: "00000000-0000-4000-8000-000000000006",
    domainId: "00000000-0000-4000-8000-000000000007",
    opportunityId: "00000000-0000-4000-8000-000000000008",
    domainDisposition: "existing",
    opportunityDisposition: "existing",
    auditWritten: true,
  });
  await applyBacklinkPromotionProposal(first.dependencies, input);
  await applyBacklinkPromotionProposal(second.dependencies, input);
  assert(first.calls.application.length === 1 && second.calls.application.length === 1, "Service must not cache idempotence.");

  console.log("PASS — Automation backlink promotion apply service smoke");
}

void main();

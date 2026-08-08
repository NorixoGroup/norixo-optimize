import {
  BacklinkPromotionProposalReaderError,
  BacklinkPromotionValidationError,
  readBacklinkPromotionProposal,
  type AutomationTask,
  type BacklinkPromotionPreviewOutputV1,
  type ReadBacklinkPromotionProposalDependencies,
  type ReadBacklinkPromotionProposalInput,
} from "../lib/automation";

const workspaceId = "00000000-0000-4000-8000-000000000001";
const runId = "00000000-0000-4000-8000-000000000002";
const promotionTaskId = "00000000-0000-4000-8000-000000000003";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

function validPreview(): BacklinkPromotionPreviewOutputV1 {
  return {
    version: 1,
    kind: "backlinks.promotion.preview",
    dryRun: true,
    policyVersion: "backlink-promotion-v1",
    summary: {
      qualificationResults: 2,
      eligible: 1,
      proposed: 1,
      skipped: 1,
      duplicates: 0,
    },
    proposals: [
      {
        proposalKey: "promotion:candidate-one",
        candidateKey: "candidate-one",
        hostname: "example.com",
        targetPageUrl: "https://example.com/host-resources",
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

function validTask(overrides: Partial<AutomationTask> = {}): AutomationTask {
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
    claimedAt: "2026-08-04T09:01:00.000Z",
    startedAt: "2026-08-04T09:01:00.000Z",
    heartbeatAt: null,
    leaseExpiresAt: "2026-08-04T09:03:00.000Z",
    completedAt: "2026-08-04T09:01:02.000Z",
    failedAt: null,
    cancelledAt: null,
    workerId: "automation-worker",
    attemptCount: 1,
    maxAttempts: 3,
    backoffBaseSeconds: 60,
    input: {},
    output: validPreview(),
    errorCode: null,
    errorMessage: null,
    createdAt: "2026-08-04T09:00:00.000Z",
    updatedAt: "2026-08-04T09:01:02.000Z",
    ...overrides,
  };
}

function dependenciesFor(task: AutomationTask | null): {
  dependencies: ReadBacklinkPromotionProposalDependencies;
  calls: Array<{ workspaceId: string; runId: string; taskId: string }>;
} {
  const calls: Array<{ workspaceId: string; runId: string; taskId: string }> = [];
  return {
    dependencies: {
      async getTaskByIdInRun(input) {
        calls.push(input);
        return task;
      },
    },
    calls,
  };
}

const input: ReadBacklinkPromotionProposalInput = {
  workspaceId,
  runId,
  promotionTaskId,
  proposalKey: "promotion:candidate-one",
};

async function assertReaderError(operation: () => Promise<unknown>, code: string): Promise<void> {
  try {
    await operation();
  } catch (error) {
    assert(error instanceof BacklinkPromotionProposalReaderError, "Expected reader error.");
    assert(error.code === code, `Expected ${code}, received ${error.code}.`);
    assert(
      !error.message.includes(workspaceId) &&
        !error.message.includes("https://example.com") &&
        !error.message.includes("Error:"),
      "Reader errors must remain safe.",
    );
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
  throw new Error("Expected invalid promotion output.");
}

async function callWithUnknownInput(
  dependencies: ReadBacklinkPromotionProposalDependencies,
  unknownInput: unknown,
): Promise<unknown> {
  return Reflect.apply(readBacklinkPromotionProposal, undefined, [dependencies, unknownInput]);
}

async function main(): Promise<void> {
  const promotionPreview = validPreview();
  const promotionTask = validTask({ output: promotionPreview });
  const proposal = promotionPreview.proposals[0];
  assert(proposal !== undefined, "Fixture proposal must exist.");
  const inputBefore = JSON.stringify(input);
  const taskBefore = JSON.stringify(promotionTask);
  const { dependencies, calls } = dependenciesFor(promotionTask);
  const result = await readBacklinkPromotionProposal(dependencies, input);
  assert(calls.length === 1, "Expected one durable task read.");
  assert(
    JSON.stringify(calls[0]) === JSON.stringify({ workspaceId, runId, taskId: promotionTaskId }),
    "Expected exact targeted task lookup.",
  );
  assert(result.promotionTask === promotionTask, "Task reference must be preserved.");
  assert(result.promotionPreview === promotionPreview, "Preview reference must be preserved.");
  assert(result.proposal === proposal, "Proposal reference must be preserved.");
  assert(JSON.stringify(input) === inputBefore, "Input must remain immutable.");
  assert(JSON.stringify(promotionTask) === taskBefore, "Task output must remain immutable.");

  const repeated = await readBacklinkPromotionProposal(dependencies, input);
  const repeatedCallCount = Number(calls.length);
  assert(repeatedCallCount === 2, "Each read must make one targeted lookup.");
  assert(repeated.promotionTask === promotionTask, "Repeated task reference must be preserved.");
  assert(repeated.promotionPreview === promotionPreview, "Repeated preview reference must be preserved.");
  assert(repeated.proposal === proposal, "Repeated proposal reference must be preserved.");

  for (const invalidInput of [
    null,
    [],
    { ...input, extra: true },
    { ...input, workspaceId: "invalid" },
    { ...input, proposalKey: "" },
    { ...input, proposalKey: " " },
    { ...input, proposalKey: "p".repeat(129) },
  ]) {
    const fixture = dependenciesFor(validTask());
    await assertReaderError(
      () => callWithUnknownInput(fixture.dependencies, invalidInput),
      "INVALID_PROMOTION_PROPOSAL_READ_INPUT",
    );
    assert(fixture.calls.length === 0, "Invalid input must not read a task.");
  }

  const missing = dependenciesFor(null);
  await assertReaderError(
    () => readBacklinkPromotionProposal(missing.dependencies, input),
    "PROMOTION_TASK_NOT_FOUND",
  );
  assert(missing.calls.length === 1, "Missing task must make one lookup.");

  const repositoryError = new Error("repository failure");
  const failingDependencies: ReadBacklinkPromotionProposalDependencies = {
    async getTaskByIdInRun() {
      throw repositoryError;
    },
  };
  try {
    await readBacklinkPromotionProposal(failingDependencies, input);
  } catch (error) {
    assert(error === repositoryError, "Repository errors must preserve identity.");
  }

  for (const [task, code] of [
    [validTask({ id: "00000000-0000-4000-8000-000000000099" }), "PROMOTION_TASK_SCOPE_MISMATCH"],
    [validTask({ workspaceId: "00000000-0000-4000-8000-000000000099" }), "PROMOTION_TASK_SCOPE_MISMATCH"],
    [validTask({ runId: "00000000-0000-4000-8000-000000000099" }), "PROMOTION_TASK_SCOPE_MISMATCH"],
    [validTask({ taskKind: "backlinks.discovery.preview" }), "PROMOTION_TASK_KIND_INVALID"],
    [validTask({ status: "queued" }), "PROMOTION_TASK_NOT_COMPLETED"],
    [validTask({ status: "running" }), "PROMOTION_TASK_NOT_COMPLETED"],
    [validTask({ status: "failed" }), "PROMOTION_TASK_NOT_COMPLETED"],
    [validTask({ status: "cancelled" }), "PROMOTION_TASK_NOT_COMPLETED"],
    [validTask({ status: "dead_letter" }), "PROMOTION_TASK_NOT_COMPLETED"],
    [validTask({ output: null }), "PROMOTION_OUTPUT_INVALID"],
  ] as const) {
    const fixture = dependenciesFor(task);
    await assertReaderError(() => readBacklinkPromotionProposal(fixture.dependencies, input), code);
    assert(fixture.calls.length === 1, "Task invariants must follow one targeted lookup.");
  }

  for (const mutate of [
    (preview: BacklinkPromotionPreviewOutputV1) => Reflect.set(preview, "version", 2),
    (preview: BacklinkPromotionPreviewOutputV1) => Reflect.set(preview, "kind", "backlinks.other.preview"),
    (preview: BacklinkPromotionPreviewOutputV1) => Reflect.set(preview, "dryRun", false),
    (preview: BacklinkPromotionPreviewOutputV1) => Reflect.set(preview, "policyVersion", "other"),
    (preview: BacklinkPromotionPreviewOutputV1) => Reflect.set(preview.summary, "proposed", 2),
    (preview: BacklinkPromotionPreviewOutputV1) => Reflect.set(preview, "proposals", []),
    (preview: BacklinkPromotionPreviewOutputV1) => Reflect.set(preview, "skippedItems", []),
  ]) {
    const preview = validPreview();
    mutate(preview);
    await assertValidationError(() => readBacklinkPromotionProposal(dependenciesFor(validTask({ output: preview })).dependencies, input));
  }

  const absentProposal = dependenciesFor(validTask());
  await assertReaderError(
    () => readBacklinkPromotionProposal(absentProposal.dependencies, { ...input, proposalKey: "promotion:missing" }),
    "PROMOTION_PROPOSAL_NOT_FOUND",
  );

  const skippedOnlyPreview = validPreview();
  Reflect.set(skippedOnlyPreview, "proposals", []);
  Reflect.set(skippedOnlyPreview.summary, "proposed", 0);
  Reflect.set(skippedOnlyPreview.summary, "qualificationResults", 1);
  const skippedOnly = dependenciesFor(validTask({ output: skippedOnlyPreview }));
  await assertReaderError(
    () => readBacklinkPromotionProposal(skippedOnly.dependencies, { ...input, proposalKey: "candidate-two" }),
    "PROMOTION_PROPOSAL_NOT_FOUND",
  );

  console.log("PASS — Automation backlink promotion proposal reader smoke");
}

void main();

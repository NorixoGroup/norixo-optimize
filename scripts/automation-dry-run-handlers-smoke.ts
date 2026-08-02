import {
  dryRunAutomationTaskHandlers,
  type ExecuteAutomationTaskHandlerInput,
} from "../lib/automation";

function assert(condition: boolean, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isAutomationTaskHandlerInput(
  value: unknown,
): value is ExecuteAutomationTaskHandlerInput {
  return (
    isRecord(value) &&
    typeof value.workspaceId === "string" &&
    typeof value.runId === "string" &&
    typeof value.taskId === "string" &&
    typeof value.taskKind === "string" &&
    isRecord(value.input) &&
    typeof value.attemptedAt === "string"
  );
}

function outputRecord(result: { output: unknown }): Record<string, unknown> {
  assert(isRecord(result.output), "Handler output must be an object");
  return result.output;
}

function discoverySummary(output: Record<string, unknown>): Record<string, unknown> {
  assert(isRecord(output.summary), "Discovery summary must be an object");
  return output.summary;
}

const baseInput: ExecuteAutomationTaskHandlerInput = {
  workspaceId: "00000000-0000-4000-8000-000000000001",
  runId: "00000000-0000-4000-8000-000000000002",
  taskId: "00000000-0000-4000-8000-000000000003",
  taskKind: "noop",
  input: {},
  attemptedAt: "2026-08-03T10:00:00.000Z",
};

async function main(): Promise<void> {
  const original = JSON.stringify(baseInput);
  const noopFirst = await dryRunAutomationTaskHandlers.execute(baseInput);
  const noopSecond = await dryRunAutomationTaskHandlers.execute(baseInput);
  const noopOutput = outputRecord(noopFirst);
  assert(noopOutput.kind === "noop" && noopOutput.dryRun === true, "Noop must remain unchanged");
  assert(JSON.stringify(noopFirst) === JSON.stringify(noopSecond), "Noop must be deterministic");

  const discoveryInput: ExecuteAutomationTaskHandlerInput = {
    ...baseInput,
    taskKind: "backlinks.discovery.preview",
    input: {},
  };
  const discoveryBefore = JSON.stringify(discoveryInput);
  const discoveryFirst = await dryRunAutomationTaskHandlers.execute(discoveryInput);
  const discoverySecond = await dryRunAutomationTaskHandlers.execute(discoveryInput);
  const discoveryOutput = outputRecord(discoveryFirst);
  const summary = discoverySummary(discoveryOutput);
  assert(
    discoveryOutput.kind === "backlinks.discovery.preview" &&
      discoveryOutput.dryRun === true &&
      discoveryOutput.skipped === "no_searches",
    "Discovery empty input must be skipped",
  );
  assert(
    summary.searchesRequested === 0 &&
      summary.resultsReceived === 0 &&
      summary.candidatesAccepted === 0 &&
      summary.candidatesRejected === 0 &&
      summary.truncated === false,
    "Discovery skipped summary",
  );
  assert(
    Array.isArray(discoveryOutput.candidates) &&
      discoveryOutput.candidates.length === 0 &&
      Array.isArray(discoveryOutput.rejections) &&
      discoveryOutput.rejections.length === 0,
    "Discovery skipped arrays",
  );
  assert(JSON.stringify(discoveryFirst) === JSON.stringify(discoverySecond), "Discovery must be deterministic");
  assert(JSON.stringify(discoveryInput) === discoveryBefore, "Discovery input must not mutate");
  assert(discoveryFirst !== discoverySecond, "Discovery results must be independent");

  const missingProviderInput: ExecuteAutomationTaskHandlerInput = {
    ...discoveryInput,
    input: {
      version: 1,
      source: "manual_dashboard",
      provider: "mock",
      searches: [{ query: "airbnb host resources" }],
      maxResultsPerSearch: 1,
      maxCandidates: 1,
    },
  };
  try {
    await dryRunAutomationTaskHandlers.execute(missingProviderInput);
    throw new Error("Expected missing provider rejection");
  } catch (error) {
    assert(
      error instanceof Error && error.message === "BACKLINK_DISCOVERY_PROVIDER_NOT_CONFIGURED",
      "Discovery V1 must not configure a provider implicitly",
    );
  }

  const qualificationInput: ExecuteAutomationTaskHandlerInput = {
    ...baseInput,
    taskKind: "backlinks.qualification.preview",
    input: { candidates: ["b"] },
  };
  const qualificationFirst = await dryRunAutomationTaskHandlers.execute(qualificationInput);
  const qualificationSecond = await dryRunAutomationTaskHandlers.execute(qualificationInput);
  const qualificationOutput = outputRecord(qualificationFirst);
  assert(
    qualificationOutput.kind === "backlinks.qualification.preview" &&
      qualificationOutput.dryRun === true &&
      qualificationOutput.evaluatedCount === 1 &&
      qualificationOutput.qualifiedCount === 0,
    "Qualification must remain unchanged",
  );
  assert(
    JSON.stringify(qualificationFirst) === JSON.stringify(qualificationSecond),
    "Qualification must be deterministic",
  );

  const unknownTask: unknown = {
    ...baseInput,
    taskKind: "unknown",
  };
  assert(isAutomationTaskHandlerInput(unknownTask), "Unknown task must be an object");
  try {
    await dryRunAutomationTaskHandlers.execute(unknownTask);
    throw new Error("Expected unknown task rejection");
  } catch (error) {
    assert(error instanceof Error, "Unknown task must reject");
  }

  assert(JSON.stringify(baseInput) === original, "Base input must not mutate");
  console.log("PASS — Automation dry-run handlers smoke");
}

void main();

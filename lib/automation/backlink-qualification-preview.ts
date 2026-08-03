import { evaluateBacklinkQualificationCandidate } from "./backlink-qualification-engine";
import { extractBacklinkQualificationSignals } from "./backlink-qualification-signals";
import {
  BACKLINK_QUALIFICATION_MAX_INPUT_BYTES,
  type BacklinkQualificationPolicy,
  type BacklinkQualificationPreviewOutputV1,
  type LegacyBacklinkQualificationPreviewInput,
  type BacklinkQualificationResult,
} from "./backlink-qualification-types";
import {
  validateBacklinkQualificationPolicy,
  validateBacklinkQualificationPreviewInput,
} from "./backlink-qualification-validation";
import {
  BacklinkQualificationPreviewError,
  type ExecuteBacklinkQualificationPreviewInput,
} from "./backlink-qualification-preview-types";

function assertSummaryInvariant(
  results: readonly BacklinkQualificationResult[],
  summary: BacklinkQualificationPreviewOutputV1["summary"],
): void {
  if (
    summary.candidatesEvaluated !== results.length ||
    summary.qualified + summary.review + summary.rejected !== summary.candidatesEvaluated
  ) {
    throw new BacklinkQualificationPreviewError(
      "BACKLINK_QUALIFICATION_INTERNAL_INVARIANT",
      "Qualification preview summary is inconsistent",
    );
  }
}

function assertOutputSize(output: BacklinkQualificationPreviewOutputV1): void {
  const outputBytes = new TextEncoder().encode(JSON.stringify(output)).length;
  if (outputBytes > BACKLINK_QUALIFICATION_MAX_INPUT_BYTES) {
    throw new BacklinkQualificationPreviewError(
      "BACKLINK_QUALIFICATION_OUTPUT_TOO_LARGE",
      "Qualification preview output is too large",
    );
  }
}

export function executeBacklinkQualificationPreview(
  input: ExecuteBacklinkQualificationPreviewInput,
): BacklinkQualificationPreviewOutputV1;

export function executeBacklinkQualificationPreview(
  input: {
    input: LegacyBacklinkQualificationPreviewInput;
    policy: BacklinkQualificationPolicy;
  },
): never;

export function executeBacklinkQualificationPreview(
  input:
    | ExecuteBacklinkQualificationPreviewInput
    | {
        input: LegacyBacklinkQualificationPreviewInput;
        policy: BacklinkQualificationPolicy;
      },
): BacklinkQualificationPreviewOutputV1 {
  return executePreview(input);
}

function executePreview(
  input:
    | ExecuteBacklinkQualificationPreviewInput
    | {
        input: LegacyBacklinkQualificationPreviewInput;
        policy: BacklinkQualificationPolicy;
      },
): BacklinkQualificationPreviewOutputV1 {
  const policy = validateBacklinkQualificationPolicy(input.policy);
  const validation = validateBacklinkQualificationPreviewInput(input.input);
  if (validation.kind === "legacy_preview") {
    throw new BacklinkQualificationPreviewError(
      "BACKLINK_QUALIFICATION_LEGACY_INPUT_NOT_SUPPORTED",
      "Legacy qualification preview input is not supported",
    );
  }

  const results: BacklinkQualificationResult[] = [];
  for (const candidate of validation.input.candidates) {
    const query = validation.input.queries[candidate.queryIndex];
    if (query === undefined) {
      throw new BacklinkQualificationPreviewError(
        "BACKLINK_QUALIFICATION_INTERNAL_INVARIANT",
        "Qualification candidate query reference is invalid",
      );
    }
    const signals = extractBacklinkQualificationSignals({ candidate, query, policy });
    results.push(
      evaluateBacklinkQualificationCandidate({ candidate, query, signals, policy }),
    );
  }

  const summary = {
    candidatesEvaluated: results.length,
    qualified: results.filter((result) => result.decision === "qualified").length,
    review: results.filter((result) => result.decision === "review").length,
    rejected: results.filter((result) => result.decision === "rejected").length,
  };
  assertSummaryInvariant(results, summary);

  const output: BacklinkQualificationPreviewOutputV1 = {
    version: 1,
    kind: "backlinks.qualification.preview",
    dryRun: true,
    policyVersion: validation.input.policyVersion,
    summary,
    results,
  };
  assertOutputSize(output);
  return output;
}

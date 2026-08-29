import { BacklinkRepositoryError } from "../repositories/errors";
import type {
  CreateOrGetBacklinkVerificationJobDependencies,
  CreateOrGetBacklinkVerificationJobResult,
  CreateBacklinkVerificationJobInput,
} from "./job-types";

function validateInput(input: CreateBacklinkVerificationJobInput): void {
  if (!input.workspaceId.trim() || !input.linkId.trim() || !input.jobKey.trim() || input.jobKey.length > 255 || !Number.isFinite(Date.parse(input.queuedAt))) {
    throw new BacklinkRepositoryError({ code: "VALIDATION", operation: "createOrGetBacklinkVerificationJob", message: "The provided data is invalid." });
  }
  if (input.maxAttempts != null && (!Number.isInteger(input.maxAttempts) || input.maxAttempts < 1 || input.maxAttempts > 10)) {
    throw new BacklinkRepositoryError({ code: "VALIDATION", operation: "createOrGetBacklinkVerificationJob", message: "The provided data is invalid." });
  }
}

export async function createOrGetBacklinkVerificationJob(
  input: CreateBacklinkVerificationJobInput,
  dependencies: CreateOrGetBacklinkVerificationJobDependencies,
): Promise<CreateOrGetBacklinkVerificationJobResult> {
  validateInput(input);
  const existing = await dependencies.getJobByKey(input.workspaceId, input.jobKey);
  if (existing != null) return { kind: "existing", job: existing };
  try {
    return { kind: "created", job: await dependencies.createJob(input) };
  } catch (error) {
    if (!(error instanceof BacklinkRepositoryError) || error.code !== "CONFLICT") throw error;
    const concurrentJob = await dependencies.getJobByKey(input.workspaceId, input.jobKey);
    if (concurrentJob != null) return { kind: "existing", job: concurrentJob };
    throw new BacklinkRepositoryError({ code: "CONFLICT", operation: "createOrGetBacklinkVerificationJob", message: "The operation conflicts with existing data." });
  }
}

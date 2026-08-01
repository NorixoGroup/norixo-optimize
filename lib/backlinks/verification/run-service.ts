import type {
  BacklinkVerificationRunResult,
  ExecuteBacklinkVerificationRunDependencies,
  ExecuteBacklinkVerificationRunInput,
} from "./run-types";

export async function executeBacklinkVerificationRun(
  input: ExecuteBacklinkVerificationRunInput,
  dependencies: ExecuteBacklinkVerificationRunDependencies,
): Promise<BacklinkVerificationRunResult> {
  const link = await dependencies.getLink(input.workspaceId, input.linkId);
  const runtimeResult = await dependencies.executeRuntime({
    sourceUrl: link.source_url,
    targetUrl: link.target_url,
    checkedAt: input.attemptedAt,
    policy: input.policy,
    http: input.http,
  });
  const attempt = await dependencies.recordAttempt(
    {
      workspaceId: input.workspaceId,
      linkId: input.linkId,
      sourceUrl: link.source_url,
      targetUrl: link.target_url,
      attemptedAt: input.attemptedAt,
      runtimeResult,
    },
    dependencies.recordAttemptDependencies,
  );
  const persistenceResult = await dependencies.persistCurrentState(
    {
      workspaceId: input.workspaceId,
      linkId: input.linkId,
      runtimeResult,
    },
    dependencies.persistenceDependencies,
  );

  return {
    link,
    runtimeResult,
    attempt,
    persistenceResult,
  };
}

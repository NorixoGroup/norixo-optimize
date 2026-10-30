import {
  BACKLINK_DISCOVERY_TASK_KIND,
  type BacklinkDiscoveryQualificationResumeCandidate,
} from "./repositories/backlinkDiscoveryQualificationResumeCandidatesRepository";

export const BACKLINK_DISCOVERY_QUALIFICATION_RESUME_CRON_LIMIT = 5;

export type BacklinkDiscoveryQualificationResumeCronDependencies = {
  listCandidates: (input: {
    now: string;
    limit: number;
  }) => Promise<readonly BacklinkDiscoveryQualificationResumeCandidate[]>;
  /**
   * Unlike resumeRun, resumeDiscoveryTask only accepts a task already "queued": it never
   * reclaims an expired lease itself. Called before every discovery resume so a discovery
   * task stuck with an expired lease is actually revived, not rejected forever; a no-op when
   * the task is already queued.
   */
  reclaimExpiredTasks: (input: { workspaceId: string; runId: string }) => Promise<unknown>;
  /** Must reuse the existing discovery-resume.ts logic: explicit task id, no auto-targeting. */
  resumeDiscoveryTask: (input: {
    workspaceId: string;
    runId: string;
    taskId: string;
  }) => Promise<{ kind: string }>;
  /** Must reuse the existing run-resume.ts logic: qualification/promotion-preview only. */
  resumeRun: (input: { workspaceId: string; runId: string }) => Promise<{ kind: string }>;
  now: () => string;
};

export type BacklinkDiscoveryQualificationResumeCronResult = {
  disposition: "completed";
  candidatesConsidered: number;
  discoveryResumed: number;
  runsResumed: number;
  skipped: number;
  errorCount: number;
};

export async function runBacklinkDiscoveryQualificationResumeCron(
  dependencies: BacklinkDiscoveryQualificationResumeCronDependencies,
): Promise<BacklinkDiscoveryQualificationResumeCronResult> {
  const now = dependencies.now();
  const candidates = await dependencies.listCandidates({
    now,
    limit: BACKLINK_DISCOVERY_QUALIFICATION_RESUME_CRON_LIMIT,
  });

  let discoveryResumed = 0;
  let runsResumed = 0;
  let skipped = 0;
  let errorCount = 0;

  for (const candidate of candidates) {
    try {
      if (candidate.taskKind === BACKLINK_DISCOVERY_TASK_KIND) {
        await dependencies.reclaimExpiredTasks({ workspaceId: candidate.workspaceId, runId: candidate.runId });
        const result = await dependencies.resumeDiscoveryTask({
          workspaceId: candidate.workspaceId,
          runId: candidate.runId,
          taskId: candidate.taskId,
        });
        if (result.kind === "rejected") skipped += 1;
        else discoveryResumed += 1;
      } else {
        const result = await dependencies.resumeRun({
          workspaceId: candidate.workspaceId,
          runId: candidate.runId,
        });
        if (result.kind === "rejected") skipped += 1;
        else runsResumed += 1;
      }
    } catch {
      errorCount += 1;
    }
  }

  return {
    disposition: "completed",
    candidatesConsidered: candidates.length,
    discoveryResumed,
    runsResumed,
    skipped,
    errorCount,
  };
}

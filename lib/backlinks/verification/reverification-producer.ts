import { createOrGetBacklinkVerificationJob } from "./job-service";
import { buildScheduledBacklinkVerificationJobInput } from "./scheduled-job-factory";
import type {
  BacklinkVerificationJob,
  CreateOrGetBacklinkVerificationJobDependencies,
  HttpVerificationOptions,
} from "./job-types";
import type { VerificationPolicy } from "./types";

const DEFAULT_WORKSPACE_LIMIT = 25;
const DEFAULT_LINK_LIMIT_PER_WORKSPACE = 100;
const DEFAULT_POLICY: VerificationPolicy = {
  strictAnchor: false,
  strictRel: false,
  followRedirects: true,
  maxRedirects: 3,
  acceptCanonical: false,
};
const DEFAULT_HTTP: HttpVerificationOptions = {
  timeoutMs: 10_000,
  maxRedirects: 3,
  maxResponseBytes: 1_048_576,
  userAgent: "Norixo-Backlink-Reverification/1.0",
};

export type BacklinkReverificationWorkspaceControl = {
  workspaceId: string;
  backlinksEnabled: boolean;
  disabledReason: string | null;
};

export type BacklinkReverificationCandidate = {
  id: string;
  workspace_id: string;
  status: string;
  acquired_at: string;
  last_verified_at: string | null;
};

export type BacklinkReverificationProducerSummary = {
  workspacesScanned: number;
  workspacesSucceeded: number;
  workspacesFailed: number;
  candidatesScanned: number;
  jobsCreated: number;
  jobsExisting: number;
  jobsSkipped: number;
  workspaces: Array<{
    workspaceId: string;
    candidatesScanned: number;
    jobsCreated: number;
    jobsExisting: number;
    jobsSkipped: number;
  }>;
  scopedJob: BacklinkVerificationJob | null;
  issues: Array<{
    workspaceId: string;
    status: "failed";
    errorCode: string;
  }>;
};

export type BacklinkReverificationProducerDependencies = {
  listEligibleWorkspaces: (limit: number) => Promise<BacklinkReverificationWorkspaceControl[]>;
  listCandidates: (workspaceId: string, limit: number, linkId?: string) => Promise<BacklinkReverificationCandidate[]>;
  getJobByKey: CreateOrGetBacklinkVerificationJobDependencies["getJobByKey"];
  createJob: CreateOrGetBacklinkVerificationJobDependencies["createJob"];
  now?: () => string;
};

export type BacklinkReverificationProducerInput = {
  workspaceLimit?: number;
  candidateLimitPerWorkspace?: number;
  cadenceDays: number;
  now?: string;
  linkId?: string;
};

function assert(condition: boolean, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

function normalizeLimit(limit: number | undefined, fallback: number, max: number): number {
  if (limit == null) return fallback;
  if (!Number.isInteger(limit) || limit < 1) return fallback;
  return Math.min(limit, max);
}

function normalizeNow(now?: string): string {
  const value = now ?? new Date().toISOString();
  assert(Number.isFinite(Date.parse(value)), "now must be a valid date");
  return new Date(value).toISOString();
}

function isEligibleStatus(status: string): boolean {
  return status === "observed" || status === "active" || status === "lost";
}

function isDueForReverification(input: {
  acquiredAt: string;
  lastVerifiedAt: string | null;
  now: string;
  cadenceDays: number;
}): boolean {
  const anchorAt = input.lastVerifiedAt ?? input.acquiredAt;
  const anchorTime = Date.parse(anchorAt);
  const nowTime = Date.parse(input.now);
  if (!Number.isFinite(anchorTime) || !Number.isFinite(nowTime)) {
    return false;
  }

  const cadenceMs = input.cadenceDays * 24 * 60 * 60 * 1000;
  return anchorTime + cadenceMs <= nowTime;
}

export async function runBacklinkReverificationProducer(
  dependencies: BacklinkReverificationProducerDependencies,
  input: BacklinkReverificationProducerInput,
): Promise<BacklinkReverificationProducerSummary> {
  const workspaceLimit = normalizeLimit(input.workspaceLimit, DEFAULT_WORKSPACE_LIMIT, 100);
  const candidateLimitPerWorkspace = normalizeLimit(
    input.candidateLimitPerWorkspace,
    DEFAULT_LINK_LIMIT_PER_WORKSPACE,
    200,
  );
  const now = normalizeNow(input.now);

  const workspaces = await dependencies.listEligibleWorkspaces(workspaceLimit);
  const eligibleWorkspaces = workspaces
    .filter((workspace) => workspace.backlinksEnabled === true && workspace.disabledReason == null)
    .slice(0, workspaceLimit);

  const summary: BacklinkReverificationProducerSummary = {
    workspacesScanned: eligibleWorkspaces.length,
    workspacesSucceeded: 0,
    workspacesFailed: 0,
    candidatesScanned: 0,
    jobsCreated: 0,
    jobsExisting: 0,
    jobsSkipped: 0,
    workspaces: [],
    scopedJob: null,
    issues: [],
  };
  const scopedLinkId = input.linkId?.trim() ?? null;

  for (const workspace of eligibleWorkspaces) {
    let workspaceFailed = false;
    let candidatesScanned = 0;
    let jobsCreated = 0;
    let jobsExisting = 0;
    let jobsSkipped = 0;

    try {
      const candidates = (await dependencies.listCandidates(workspace.workspaceId, candidateLimitPerWorkspace, scopedLinkId ?? undefined)).filter(
        (candidate) => isEligibleStatus(candidate.status),
      );

      for (const candidate of candidates) {
        candidatesScanned += 1;
        if (!isDueForReverification({
          acquiredAt: candidate.acquired_at,
          lastVerifiedAt: candidate.last_verified_at,
          now,
          cadenceDays: input.cadenceDays,
        })) {
          jobsSkipped += 1;
          continue;
        }

        const jobInput = buildScheduledBacklinkVerificationJobInput({
          workspaceId: candidate.workspace_id,
          linkId: candidate.id,
          queuedAt: now,
          anchorAt: candidate.last_verified_at ?? candidate.acquired_at,
          cadenceDays: input.cadenceDays,
          policy: DEFAULT_POLICY,
          http: DEFAULT_HTTP,
        });

        const result = await createOrGetBacklinkVerificationJob(jobInput, {
          getJobByKey: dependencies.getJobByKey,
          createJob: dependencies.createJob,
        });

        if (scopedLinkId != null && summary.scopedJob == null) {
          summary.scopedJob = result.job;
        }

        if (result.kind === "created") {
          jobsCreated += 1;
        } else {
          jobsExisting += 1;
        }
      }

      summary.workspacesSucceeded += 1;
    } catch (error) {
      workspaceFailed = true;
      summary.issues.push({
        workspaceId: workspace.workspaceId,
        status: "failed",
        errorCode:
          error instanceof Error && error.message.trim().length > 0
            ? error.message.slice(0, 100)
            : "BACKLINK_REVERIFICATION_PRODUCER_FAILED",
      });
    }

    summary.candidatesScanned += candidatesScanned;
    summary.jobsCreated += jobsCreated;
    summary.jobsExisting += jobsExisting;
    summary.jobsSkipped += jobsSkipped;
    summary.workspaces.push({
      workspaceId: workspace.workspaceId,
      candidatesScanned,
      jobsCreated,
      jobsExisting,
      jobsSkipped,
    });
    if (workspaceFailed) {
      summary.workspacesFailed += 1;
    }
  }

  return summary;
}

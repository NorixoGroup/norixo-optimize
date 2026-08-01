import type { BacklinkLinkRow } from "../repositories/linksRepository";
import type { UpdateLinkVerificationInput } from "../services/linkService";
import type { WorkspaceId } from "../repositories/types";

import type { BacklinkVerificationRuntimeResult } from "./runtime-types";

export interface PersistBacklinkVerificationResultInput {
  workspaceId: WorkspaceId;
  linkId: string;
  runtimeResult: BacklinkVerificationRuntimeResult;
}

export interface PersistBacklinkVerificationDependencies {
  getLink: (workspaceId: WorkspaceId, linkId: string) => Promise<BacklinkLinkRow>;
  updateVerification: (
    workspaceId: WorkspaceId,
    linkId: string,
    input: UpdateLinkVerificationInput,
  ) => Promise<BacklinkLinkRow>;
}

export type PersistBacklinkVerificationResult =
  | {
      kind: "persisted";
      link: BacklinkLinkRow;
    }
  | {
      kind: "skipped";
      reason: "fetch_error" | "http_unusable" | "stale_result" | "unresolved_verification";
    };

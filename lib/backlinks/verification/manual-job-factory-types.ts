import type {
  HttpVerificationOptions,
} from "./job-types";
import type { VerificationPolicy } from "./types";

export type BuildManualBacklinkVerificationJobInput = {
  workspaceId: string;
  linkId: string;
  queuedAt: string;
  policy: VerificationPolicy;
  http: HttpVerificationOptions;
};

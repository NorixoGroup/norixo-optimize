import type {
  BacklinkQualificationCandidateInput,
  BacklinkQualificationPolicy,
  BacklinkQualificationQueryInput,
} from "./backlink-qualification-types";
import type { BacklinkQualificationSignalsResult } from "./backlink-qualification-signals-types";

export type EvaluateBacklinkQualificationCandidateInput = {
  candidate: BacklinkQualificationCandidateInput;
  query: BacklinkQualificationQueryInput;
  signals: BacklinkQualificationSignalsResult;
  policy: BacklinkQualificationPolicy;
};

export type BacklinkQualificationEngineInvariantCode =
  | "CANDIDATE_KEY_MISMATCH"
  | "DUPLICATE_SIGNAL_CODE"
  | "INCONSISTENT_PROPOSED_TYPES"
  | "INCONSISTENT_SCORE";

export class BacklinkQualificationEngineInvariantError extends Error {
  readonly code: BacklinkQualificationEngineInvariantCode;

  constructor(code: BacklinkQualificationEngineInvariantCode, message: string) {
    super(message);
    this.name = "BacklinkQualificationEngineInvariantError";
    this.code = code;
  }
}

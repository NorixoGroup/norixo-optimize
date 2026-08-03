import type {
  BacklinkQualificationPolicy,
  BacklinkQualificationPreviewInputV1,
} from "./backlink-qualification-types";

export type ExecuteBacklinkQualificationPreviewInput = {
  input: BacklinkQualificationPreviewInputV1;
  policy: BacklinkQualificationPolicy;
};

export type BacklinkQualificationPreviewErrorCode =
  | "BACKLINK_QUALIFICATION_LEGACY_INPUT_NOT_SUPPORTED"
  | "BACKLINK_QUALIFICATION_OUTPUT_TOO_LARGE"
  | "BACKLINK_QUALIFICATION_INTERNAL_INVARIANT";

export class BacklinkQualificationPreviewError extends Error {
  readonly code: BacklinkQualificationPreviewErrorCode;

  constructor(code: BacklinkQualificationPreviewErrorCode, message: string) {
    super(message);
    this.name = "BacklinkQualificationPreviewError";
    this.code = code;
  }
}

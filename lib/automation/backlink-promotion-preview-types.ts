import type {
  BacklinkPromotionPreviewInputV1,
  BacklinkPromotionPreviewOutputV1,
} from "./backlink-promotion-types";
import type { BacklinkPromotionPolicy } from "./backlink-promotion-policy-types";

export type ExecuteBacklinkPromotionPreviewInput = {
  input: BacklinkPromotionPreviewInputV1;
  policy: BacklinkPromotionPolicy;
};

export class BacklinkPromotionPreviewError extends Error {
  readonly code = "BACKLINK_PROMOTION_INTERNAL_INVARIANT";

  constructor(message = "Backlink promotion preview reached an internal invariant") {
    super(message);
    this.name = "BacklinkPromotionPreviewError";
  }
}

export type ExecuteBacklinkPromotionPreviewResult = BacklinkPromotionPreviewOutputV1;

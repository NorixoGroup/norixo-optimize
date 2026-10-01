import type {
  ApplyBacklinkOutreachUnsubscribeInput,
  ApplyBacklinkOutreachUnsubscribeResult,
} from "../repositories/outreachUnsubscribeRepository";
import type { BacklinkOutreachReplyTokenKeyring } from "./outreachReplyCorrelationIdentity";
import { BacklinkUnsubscribeTokenError, verifyBacklinkUnsubscribeToken } from "./outreachUnsubscribeToken";

export type HostedUnsubscribeDependencies = {
  getKeyring: () => BacklinkOutreachReplyTokenKeyring;
  applyUnsubscribe: (input: ApplyBacklinkOutreachUnsubscribeInput) => Promise<ApplyBacklinkOutreachUnsubscribeResult>;
};

export type HostedUnsubscribePreview = { kind: "valid" } | { kind: "invalid" };

export type HostedUnsubscribeOutcome =
  | { kind: "unsubscribed"; disposition: "applied" | "existing" }
  | { kind: "invalid" }
  | { kind: "unavailable" };

/** GET semantics: validates the signature only. No database read, no side effect. */
export function previewHostedUnsubscribe(deps: Pick<HostedUnsubscribeDependencies, "getKeyring">) {
  return (token: string): HostedUnsubscribePreview => {
    try {
      verifyBacklinkUnsubscribeToken(token, deps.getKeyring());
      return { kind: "valid" };
    } catch {
      return { kind: "invalid" };
    }
  };
}

/** POST semantics (confirmation form and RFC 8058 one-click): idempotent. */
export function confirmHostedUnsubscribe(deps: HostedUnsubscribeDependencies) {
  return async (token: string): Promise<HostedUnsubscribeOutcome> => {
    let keyring: BacklinkOutreachReplyTokenKeyring;
    try {
      keyring = deps.getKeyring();
    } catch {
      return { kind: "unavailable" };
    }
    let payload: { workspaceId: string; outreachId: string };
    try {
      payload = verifyBacklinkUnsubscribeToken(token, keyring);
    } catch (error) {
      return error instanceof BacklinkUnsubscribeTokenError && error.code === "UNSUBSCRIBE_TOKEN_UNAVAILABLE"
        ? { kind: "unavailable" }
        : { kind: "invalid" };
    }
    try {
      const result = await deps.applyUnsubscribe({
        workspaceId: payload.workspaceId,
        outreachId: payload.outreachId,
        source: "hosted_unsubscribe",
      });
      return { kind: "unsubscribed", disposition: result.disposition };
    } catch {
      return { kind: "unavailable" };
    }
  };
}

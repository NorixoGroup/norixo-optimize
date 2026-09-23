import type { Database } from "@/types/database.types";

import type { MailboxVerificationStatus } from "../services/mailboxVerificationService";
import { BacklinkRepositoryError, normalizeBacklinkRepositoryError } from "./errors";

export type MailboxVerificationResult = MailboxVerificationStatus;

type RpcName = "record_backlink_contact_mailbox_verification_and_maybe_promote";
type RpcArgs = Database["public"]["Functions"][RpcName]["Args"];
type RpcRow = Database["public"]["Functions"][RpcName]["Returns"][number];

export type RecordMailboxVerificationAndMaybePromoteRpcClient = {
  rpc(name: RpcName, args: RpcArgs): PromiseLike<{ data: RpcRow[] | null; error: unknown }>;
};

export type RecordMailboxVerificationAndMaybePromoteInput = {
  workspaceId: string;
  contactId: string;
  verificationKey: string;
  emailFingerprint: string;
  provider: string;
  result: MailboxVerificationResult;
  checkedAt: string;
  /** A bounded opaque identifier from a future trusted adapter, never provider response content. */
  providerReference?: string | null;
  safeMetadata?: MailboxVerificationSafeMetadata | null;
};

export type MailboxVerificationSafeMetadata = {
  catchAll?: boolean;
  disposable?: boolean;
  roleBased?: boolean;
};

type MailboxVerificationSafeMetadataRpc = {
  catch_all?: boolean;
  disposable?: boolean;
  role_based?: boolean;
};

export type RecordMailboxVerificationAndMaybePromoteResult = {
  verificationId: string;
  disposition: "created" | "existing";
  contactStatus: string;
  verifiedAt: string | null;
};

function required(value: string, field: string): string {
  if (value.trim() === "") throw new BacklinkRepositoryError({ code: "VALIDATION", operation: "recordMailboxVerificationAndMaybePromote", message: `${field} is required.` });
  return value;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value != null && !Array.isArray(value);
}

export function normalizeMailboxVerificationSafeMetadata(value: unknown): MailboxVerificationSafeMetadataRpc | null {
  if (value == null) return null;
  if (!isRecord(value)) {
    throw new BacklinkRepositoryError({ code: "VALIDATION", operation: "recordMailboxVerificationAndMaybePromote", message: "safeMetadata must be an object." });
  }

  const normalized: MailboxVerificationSafeMetadataRpc = {};
  for (const [key, fieldValue] of Object.entries(value)) {
    if (typeof fieldValue !== "boolean") {
      throw new BacklinkRepositoryError({ code: "VALIDATION", operation: "recordMailboxVerificationAndMaybePromote", message: "safeMetadata values must be booleans." });
    }
    switch (key) {
      case "catchAll":
        normalized.catch_all = fieldValue;
        break;
      case "disposable":
        normalized.disposable = fieldValue;
        break;
      case "roleBased":
        normalized.role_based = fieldValue;
        break;
      default:
        throw new BacklinkRepositoryError({ code: "VALIDATION", operation: "recordMailboxVerificationAndMaybePromote", message: "safeMetadata contains an unsupported field." });
    }
  }
  return normalized;
}

function normalizeProviderReference(value: string | null | undefined): string | null {
  if (value == null) return null;
  const normalized = value.trim();
  if (normalized === "" || normalized.length > 256) {
    throw new BacklinkRepositoryError({ code: "VALIDATION", operation: "recordMailboxVerificationAndMaybePromote", message: "providerReference must be a bounded opaque identifier." });
  }
  return normalized;
}

function mapRow(row: RpcRow): RecordMailboxVerificationAndMaybePromoteResult {
  if ((row.disposition !== "created" && row.disposition !== "existing") || !row.verification_id || !row.contact_status) {
    throw new BacklinkRepositoryError({ code: "DATABASE", operation: "recordMailboxVerificationAndMaybePromote", message: "The database returned an invalid mailbox verification result." });
  }
  return { verificationId: row.verification_id, disposition: row.disposition, contactStatus: row.contact_status, verifiedAt: row.verified_at };
}

export async function recordMailboxVerificationAndMaybePromote(
  client: RecordMailboxVerificationAndMaybePromoteRpcClient,
  input: RecordMailboxVerificationAndMaybePromoteInput,
): Promise<RecordMailboxVerificationAndMaybePromoteResult> {
  const { data, error } = await client.rpc("record_backlink_contact_mailbox_verification_and_maybe_promote", {
    p_workspace_id: required(input.workspaceId, "workspaceId"),
    p_contact_id: required(input.contactId, "contactId"),
    p_verification_key: required(input.verificationKey, "verificationKey"),
    p_email_fingerprint: required(input.emailFingerprint, "emailFingerprint"),
    p_provider: required(input.provider, "provider"),
    p_result: input.result,
    p_checked_at: required(input.checkedAt, "checkedAt"),
    // A future trusted provider adapter may pass only an opaque identifier, never response content.
    p_provider_reference: normalizeProviderReference(input.providerReference),
    p_safe_metadata: normalizeMailboxVerificationSafeMetadata(input.safeMetadata),
  });
  if (error != null) throw normalizeBacklinkRepositoryError("recordMailboxVerificationAndMaybePromote", error);
  if (!Array.isArray(data) || data.length !== 1) throw new BacklinkRepositoryError({ code: "DATABASE", operation: "recordMailboxVerificationAndMaybePromote", message: "The database returned an invalid mailbox verification result." });
  return mapRow(data[0]);
}

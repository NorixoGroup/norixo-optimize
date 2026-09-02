import type { MarketingCampaignBundle } from "@/lib/marketing-ai/bundle/marketingCampaignBundle";
import type { LinkedInOAuthServerConfig } from "@/lib/marketing-ai/linkedin/linkedinOAuth";

export const LINKEDIN_POSTS_ENDPOINT = "https://api.linkedin.com/rest/posts";
const LINKEDIN_ORGANIZATION_ACLS_ENDPOINT =
  "https://api.linkedin.com/rest/organizationAcls";

export type LinkedInTokenExchangeResult =
  | {
      ok: true;
      accessToken: string;
      expiresInSeconds: number | null;
      expiresAt: string | null;
      grantedScopes: string[];
    }
  | {
      ok: false;
      error:
        | "token_exchange_failed"
        | "invalid_linkedin_response";
    };

export type LinkedInOrganizationSummary = {
  organizationUrn: string;
  organizationId: string | null;
};

export type LinkedInOrganizationResolutionResult =
  | {
      ok: true;
      organization: LinkedInOrganizationSummary;
    }
  | {
      ok: false;
      error:
        | "organization_lookup_failed"
        | "organization_not_found"
        | "invalid_linkedin_response";
    };

export type LinkedInPublishTextPostResult =
  | {
      ok: true;
      postId: string;
    }
  | {
      ok: false;
      error:
        | "unauthorized"
        | "publish_failed"
        | "access_denied"
        | "invalid_linkedin_response";
    };

type LinkedInPublishFailure = Extract<
  LinkedInPublishTextPostResult,
  { ok: false }
>;

export type LinkedInPublishWithRollbackResult =
  | {
      ok: true;
      postId: string;
    }
  | {
      ok: false;
      error: LinkedInPublishFailure["error"];
      rollbackSucceeded: boolean;
    };

export type LinkedInPublishReadinessResult =
  | {
      ok: true;
      message: string;
    }
  | {
      ok: false;
      error: string;
      status: number;
    };

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function toLinkedInApiHeaders(
  accessToken: string,
  apiVersion: string,
  withJsonContentType = false,
) {
  return {
    Authorization: `Bearer ${accessToken}`,
    "X-Restli-Protocol-Version": "2.0.0",
    "Linkedin-Version": apiVersion,
    ...(withJsonContentType ? { "Content-Type": "application/json" } : {}),
  };
}

function parseGrantedScopes(value: unknown) {
  if (typeof value !== "string") {
    return [];
  }

  return value
    .split(" ")
    .map((scope) => scope.trim())
    .filter(Boolean);
}

function extractLinkedInOrganizationUrn(value: unknown) {
  if (typeof value !== "string") {
    return "";
  }

  const trimmed = value.trim();
  return trimmed.startsWith("urn:li:organization:") ? trimmed : "";
}

function extractOrganizationIdFromUrn(organizationUrn: string) {
  const parts = organizationUrn.split(":");
  const id = parts[parts.length - 1]?.trim() ?? "";
  return id || null;
}

function readLinkedInResponseJson(
  value: unknown,
): Record<string, unknown> | null {
  return isPlainObject(value) ? value : null;
}

export function buildLinkedInTextPostPayload(
  organizationUrn: string,
  commentary: string,
) {
  return {
    author: organizationUrn,
    commentary,
    visibility: "PUBLIC" as const,
    distribution: {
      feedDistribution: "MAIN_FEED" as const,
      targetEntities: [] as string[],
      thirdPartyDistributionChannels: [] as string[],
    },
    lifecycleState: "PUBLISHED" as const,
    isReshareDisabledByAuthor: false,
  };
}

export function resolveLinkedInPublishMessage(bundle: MarketingCampaignBundle) {
  const finalCaption =
    bundle.publisher?.channels.linkedin.publisherOutput?.finalCaption?.trim() ??
    "";
  if (finalCaption) {
    return finalCaption;
  }

  const caption = bundle.publisher?.channels.linkedin.caption?.trim() ?? "";
  if (caption) {
    return caption;
  }

  return bundle.publisher?.channels.linkedin.copy?.trim() ?? "";
}

export function evaluateLinkedInPublishReadiness(
  bundle: MarketingCampaignBundle,
): LinkedInPublishReadinessResult {
  if (!bundle.approval || !bundle.publisher) {
    return {
      ok: false,
      error: "Campaign bundle is invalid.",
      status: 400,
    };
  }

  if (bundle.approval.status !== "approved") {
    return {
      ok: false,
      error: "Campaign approval is not valid for publishing.",
      status: 409,
    };
  }

  const linkedInChannel = bundle.publisher.channels.linkedin;

  if (
    linkedInChannel.status === "published" ||
    (typeof linkedInChannel.platformPostId === "string" &&
      linkedInChannel.platformPostId.trim().length > 0)
  ) {
    return {
      ok: false,
      error: "LinkedIn post already published.",
      status: 409,
    };
  }

  if (
    linkedInChannel.status === "publishing" ||
    (typeof linkedInChannel.publishAttemptId === "string" &&
      linkedInChannel.publishAttemptId.trim().length > 0)
  ) {
    return {
      ok: false,
      error:
        "LinkedIn publish already in progress or requires manual verification.",
      status: 409,
    };
  }

  const message = resolveLinkedInPublishMessage(bundle);

  if (!message.trim()) {
    return {
      ok: false,
      error: "LinkedIn publish text is empty.",
      status: 400,
    };
  }

  return {
    ok: true,
    message,
  };
}

export function buildLinkedInLockedResult(
  campaignRawResult: Record<string, unknown>,
  bundle: MarketingCampaignBundle,
  publishAttemptId: string,
  now: string,
) {
  return {
    ...campaignRawResult,
    bundle: {
      ...bundle,
      publisher: {
        ...bundle.publisher!,
        mode: "draft_only" as const,
        canPublish: false as const,
        channels: {
          ...bundle.publisher!.channels,
          linkedin: {
            ...bundle.publisher!.channels.linkedin,
            status: "publishing" as const,
            publishAttemptId,
            publishAttemptStartedAt: now,
          },
        },
      },
      updatedAt: now,
    },
  };
}

export function buildLinkedInPublishedResult(
  campaignRawResult: Record<string, unknown>,
  bundle: MarketingCampaignBundle,
  postId: string,
  now: string,
) {
  return {
    ...campaignRawResult,
    bundle: {
      ...bundle,
      publisher: {
        ...bundle.publisher!,
        mode: "draft_only" as const,
        canPublish: false as const,
        channels: {
          ...bundle.publisher!.channels,
          linkedin: {
            ...bundle.publisher!.channels.linkedin,
            status: "published" as const,
            publishAttemptId: undefined,
            publishAttemptStartedAt: undefined,
            publishedAt: now,
            platformPostId: postId,
          },
        },
      },
      updatedAt: now,
    },
  };
}

export function buildLinkedInRollbackResult(
  campaignRawResult: Record<string, unknown>,
  bundle: MarketingCampaignBundle,
  now: string,
) {
  return {
    ...campaignRawResult,
    bundle: {
      ...bundle,
      publisher: {
        ...bundle.publisher!,
        mode: "draft_only" as const,
        canPublish: false as const,
        channels: {
          ...bundle.publisher!.channels,
          linkedin: {
            ...bundle.publisher!.channels.linkedin,
            publishAttemptId: undefined,
            publishAttemptStartedAt: undefined,
          },
        },
      },
      updatedAt: now,
    },
  };
}

export async function executeLinkedInPublishWithRollback(params: {
  publish: () => Promise<LinkedInPublishTextPostResult>;
  rollback: () => Promise<boolean>;
  markReconnectRequired: () => Promise<void>;
}): Promise<LinkedInPublishWithRollbackResult> {
  let publishResult: LinkedInPublishTextPostResult;

  try {
    publishResult = await params.publish();
  } catch {
    publishResult = { ok: false, error: "publish_failed" };
  }

  if (publishResult.ok) {
    return publishResult;
  }

  let rollbackSucceeded = false;
  try {
    rollbackSucceeded = await params.rollback();
  } catch {
    rollbackSucceeded = false;
  }

  if (!rollbackSucceeded) {
    return {
      ok: false,
      error: publishResult.error,
      rollbackSucceeded: false,
    };
  }

  if (publishResult.error === "unauthorized") {
    await params.markReconnectRequired();
  }

  return {
    ok: false,
    error: publishResult.error,
    rollbackSucceeded: true,
  };
}

export async function exchangeLinkedInCodeForAccessToken(
  config: LinkedInOAuthServerConfig,
  code: string,
): Promise<LinkedInTokenExchangeResult> {
  const body = new URLSearchParams();
  body.set("grant_type", "authorization_code");
  body.set("code", code);
  body.set("client_id", config.clientId);
  body.set("client_secret", config.clientSecret);
  body.set("redirect_uri", config.redirectUri);

  const response = await fetch("https://www.linkedin.com/oauth/v2/accessToken", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: body.toString(),
    cache: "no-store",
  });
  const json = readLinkedInResponseJson(await response.json().catch(() => null));

  if (!response.ok) {
    return {
      ok: false,
      error: "token_exchange_failed",
    };
  }

  const accessToken =
    json && typeof json.access_token === "string" ? json.access_token.trim() : "";

  if (!accessToken) {
    return {
      ok: false,
      error: "invalid_linkedin_response",
    };
  }

  const expiresInSeconds =
    json && typeof json.expires_in === "number" && Number.isFinite(json.expires_in)
      ? json.expires_in
      : null;
  const expiresAt =
    expiresInSeconds !== null
      ? new Date(Date.now() + expiresInSeconds * 1000).toISOString()
      : null;

  return {
    ok: true,
    accessToken,
    expiresInSeconds,
    expiresAt,
    grantedScopes: parseGrantedScopes(json?.scope),
  };
}

export async function resolveLinkedInOrganization(
  config: LinkedInOAuthServerConfig,
  accessToken: string,
): Promise<LinkedInOrganizationResolutionResult> {
  if (config.organizationUrn?.trim()) {
    return {
      ok: true,
      organization: {
        organizationUrn: config.organizationUrn.trim(),
        organizationId: extractOrganizationIdFromUrn(
          config.organizationUrn.trim(),
        ),
      },
    };
  }

  const url = new URL(LINKEDIN_ORGANIZATION_ACLS_ENDPOINT);
  url.searchParams.set("q", "roleAssignee");
  url.searchParams.set("role", "ADMINISTRATOR");
  url.searchParams.set("state", "APPROVED");
  url.searchParams.set("count", "10");
  url.searchParams.set("start", "0");

  const response = await fetch(url, {
    method: "GET",
    headers: toLinkedInApiHeaders(accessToken, config.apiVersion),
    cache: "no-store",
  });
  const json = readLinkedInResponseJson(await response.json().catch(() => null));

  if (!response.ok) {
    return {
      ok: false,
      error: "organization_lookup_failed",
    };
  }

  if (!json || !Array.isArray(json.elements)) {
    return {
      ok: false,
      error: "invalid_linkedin_response",
    };
  }

  const organizationUrn =
    json.elements
      .map((entry) => {
        if (!isPlainObject(entry)) {
          return "";
        }

        return extractLinkedInOrganizationUrn(
          entry.organization ?? entry.organizationTarget,
        );
      })
      .find(Boolean) ?? "";

  if (!organizationUrn) {
    return {
      ok: false,
      error: "organization_not_found",
    };
  }

  return {
    ok: true,
    organization: {
      organizationUrn,
      organizationId: extractOrganizationIdFromUrn(organizationUrn),
    },
  };
}

export async function publishLinkedInTextPost(
  config: LinkedInOAuthServerConfig,
  params: {
    accessToken: string;
    organizationUrn: string;
    message: string;
  },
): Promise<LinkedInPublishTextPostResult> {
  const payload = buildLinkedInTextPostPayload(
    params.organizationUrn,
    params.message,
  );
  const response = await fetch(LINKEDIN_POSTS_ENDPOINT, {
    method: "POST",
    headers: toLinkedInApiHeaders(
      params.accessToken,
      config.apiVersion,
      true,
    ),
    body: JSON.stringify(payload),
    cache: "no-store",
  });
  const json = readLinkedInResponseJson(await response.json().catch(() => null));

  if (!response.ok) {
    return {
      ok: false,
      error:
        response.status === 401
          ? "unauthorized"
          : response.status === 403
            ? "access_denied"
            : "publish_failed",
    };
  }

  const postId =
    response.headers.get("x-restli-id")?.trim() ||
    (json && typeof json.id === "string" ? json.id.trim() : "");

  if (!postId) {
    return {
      ok: false,
      error: "invalid_linkedin_response",
    };
  }

  return {
    ok: true,
    postId,
  };
}

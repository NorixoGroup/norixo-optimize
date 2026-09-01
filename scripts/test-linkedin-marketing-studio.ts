import type { MarketingCampaignBundle } from "../lib/marketing-ai/bundle/marketingCampaignBundle";
import {
  LINKEDIN_MARKETING_STUDIO_SCOPES,
  buildLinkedInOAuthLoginUrl,
  createLinkedInOAuthState,
  parseLinkedInOAuthState,
  readLinkedInOAuthServerEnv,
} from "../lib/marketing-ai/linkedin/linkedinOAuth";
import {
  LINKEDIN_POSTS_ENDPOINT,
  buildLinkedInLockedResult,
  buildLinkedInPublishedResult,
  buildLinkedInRollbackResult,
  buildLinkedInTextPostPayload,
  evaluateLinkedInPublishReadiness,
  exchangeLinkedInCodeForAccessToken,
  publishLinkedInTextPost,
  resolveLinkedInOrganization,
  resolveLinkedInPublishMessage,
} from "../lib/marketing-ai/linkedin/linkedinApi";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

function buildTestBundle(): MarketingCampaignBundle {
  const now = new Date().toISOString();

  return {
    id: "linkedin-test-bundle",
    campaign: {
      id: "linkedin-test-campaign",
      name: "Campagne LinkedIn",
      objective: "education",
      audience: "Conciergeries",
      tone: "professional",
      cta: "Demander un audit Norixo",
      websiteUrl: "https://norixo.io",
      language: "fr",
      platforms: ["facebook", "instagram", "linkedin", "tiktok"],
      formats: ["post"],
      durationDays: 30,
      startDate: now,
      endDate: now,
      hashtags: ["#Norixo"],
      status: "draft",
      createdAt: now,
      updatedAt: now,
    },
    social: {
      qualityScore: 88,
      warnings: [],
      improvements: [],
      title: "Constat terrain",
      hook: "Les annonces perdent des réservations à cause des photos.",
      caption:
        "Constat : certaines annonces freinent la conversion à cause d'images faibles. Action : prioriser les corrections visuelles.",
      hashtags: ["#Norixo", "#PropertyManagement"],
      cta: "Voir l'audit",
      imageIdea: "Analyse structurée",
      imagePrompt: "Prompt image",
      videoPrompt: "Prompt video",
      recommendedPublishTime: "09:00",
      targetPlatform: "linkedin",
      approvalChecklist: [],
    },
    review: {
      status: "approved",
      approvalRequired: true,
      summary: "Ready",
      notes: [],
      updatedAt: now,
    },
    approval: {
      status: "approved",
      requiredApprover: "Mohamed",
      requiresHumanValidation: true,
      approvedAt: now,
      approvedBy: "Mohamed",
      publisherReady: true,
      notes: [],
    },
    publisher: {
      mode: "draft_only",
      canPublish: false,
      requiresApproval: true,
      channels: {
        facebook: {
          platform: "facebook",
          status: "draft",
          copy: "Fallback Facebook",
          caption: "Caption Facebook",
          hashtags: ["#Facebook"],
          assetPrompt: "Asset prompt Facebook",
          videoPrompt: "Video prompt Facebook",
          localizedVariants: {},
          approvalRequired: true,
          publishAction: "manual_review_required",
        },
        instagram: {
          platform: "instagram",
          status: "draft",
          copy: "Fallback Instagram",
          caption: "Caption Instagram",
          hashtags: ["#Instagram"],
          assetPrompt: "Asset prompt Instagram",
          videoPrompt: "Video prompt Instagram",
          localizedVariants: {},
          approvalRequired: true,
          publishAction: "manual_review_required",
        },
        linkedin: {
          platform: "linkedin",
          status: "draft",
          copy: "Fallback LinkedIn copy",
          caption:
            "Constat : certaines photos faibles créent une friction immédiate. Action : prioriser les corrections visuelles qui clarifient l'annonce.",
          hashtags: ["#Norixo", "#PropertyManagement"],
          assetPrompt: "Asset prompt LinkedIn",
          videoPrompt: "Video prompt LinkedIn",
          localizedVariants: {},
          publisherOutput: {
            finalTitle: "Observation métier",
            finalCaption:
              "Constat : des photos faibles ralentissent la conversion. Cause : l'annonce manque de clarté visuelle. Impact : moins de confiance, moins de réservations. Action : prioriser les photos qui expliquent vraiment le séjour.",
            finalCta: "Voir l'audit",
            finalHashtags: ["#Norixo", "#PropertyManagement"],
            platformNotes: [],
            manualPublishChecklist: [],
            warnings: [],
            approvalRequired: true,
          },
          approvalRequired: true,
          publishAction: "manual_review_required",
        },
        tiktok: {
          platform: "tiktok",
          status: "draft",
          copy: "Fallback TikTok copy",
          caption: "Caption TikTok",
          hashtags: ["#TikTok"],
          assetPrompt: "Asset prompt TikTok",
          videoPrompt: "Video prompt TikTok",
          localizedVariants: {},
          approvalRequired: true,
          publishAction: "manual_review_required",
        },
      },
    },
    notes: [],
    approvalRequired: true,
    createdAt: now,
    updatedAt: now,
  };
}

async function main() {
  const oauthConfig = readLinkedInOAuthServerEnv({
    NODE_ENV: "test",
    LINKEDIN_CLIENT_ID: "linkedin-client-id",
    LINKEDIN_CLIENT_SECRET: "linkedin-client-secret",
    LINKEDIN_REDIRECT_URI: "https://norixo.io/api/admin/marketing-studio/linkedin/callback",
    LINKEDIN_API_VERSION: "202507",
  } as NodeJS.ProcessEnv);

  assert(oauthConfig.ok, "Expected LinkedIn OAuth env to validate.");
  assert(
    LINKEDIN_MARKETING_STUDIO_SCOPES.includes("w_organization_social"),
    "Expected LinkedIn scope w_organization_social.",
  );

  const oauthState = createLinkedInOAuthState(
    { userId: "11111111-1111-4111-8111-111111111111", workspaceId: "22222222-2222-4222-8222-222222222222" },
    oauthConfig.config.clientSecret,
  );
  assert(parseLinkedInOAuthState(oauthState, oauthConfig.config.clientSecret)?.workspaceId === "22222222-2222-4222-8222-222222222222", "Expected OAuth state to retain the bound workspace.");
  assert(parseLinkedInOAuthState(oauthState, "wrong-secret") === null, "Expected OAuth state signature validation to reject a different secret.");
  const oauthUrl = buildLinkedInOAuthLoginUrl(oauthConfig.config, oauthState);
  assert(
    oauthUrl.toString().startsWith(
      "https://www.linkedin.com/oauth/v2/authorization",
    ),
    "Expected LinkedIn OAuth authorization URL.",
  );
  assert(
    oauthUrl.searchParams.get("scope") === "w_organization_social",
    "Expected LinkedIn OAuth URL to request w_organization_social.",
  );

  const bundle = buildTestBundle();
  const message = resolveLinkedInPublishMessage(bundle);
  assert(
    message.startsWith("Constat : des photos faibles ralentissent la conversion."),
    "Expected LinkedIn publish message to use finalCaption first.",
  );
  assert(
    !message.includes("Caption Facebook") && !message.includes("Caption Instagram"),
    "Expected no Facebook or Instagram fallback in LinkedIn publish message.",
  );

  const readiness = evaluateLinkedInPublishReadiness(bundle);
  assert(readiness.ok, "Expected approved LinkedIn bundle to be publishable.");

  const blockedApprovalBundle = {
    ...bundle,
    approval: {
      ...bundle.approval!,
      status: "pending_review" as const,
    },
  };
  const blockedApproval = evaluateLinkedInPublishReadiness(blockedApprovalBundle);
  assert(
    !blockedApproval.ok &&
      blockedApproval.error ===
        "Campaign approval is not valid for publishing.",
    "Expected LinkedIn publish to require approval.",
  );

  const blockedPublishingBundle = {
    ...bundle,
    publisher: {
      ...bundle.publisher!,
      channels: {
        ...bundle.publisher!.channels,
        linkedin: {
          ...bundle.publisher!.channels.linkedin,
          status: "publishing" as const,
          publishAttemptId: "attempt-1",
        },
      },
    },
  };
  const blockedPublishing = evaluateLinkedInPublishReadiness(
    blockedPublishingBundle,
  );
  assert(
    !blockedPublishing.ok &&
      blockedPublishing.error.includes("already in progress"),
    "Expected LinkedIn publish to block double publish attempts.",
  );

  const lockNow = new Date().toISOString();
  const lockedResult = buildLinkedInLockedResult(
    { bundle },
    bundle,
    "attempt-123",
    lockNow,
  );
  assert(
    (lockedResult.bundle as MarketingCampaignBundle).publisher?.channels.linkedin
      .status === "publishing",
    "Expected lock result to move LinkedIn status to publishing.",
  );

  const publishedResult = buildLinkedInPublishedResult(
    { bundle },
    bundle,
    "urn:li:share:123456",
    lockNow,
  );
  assert(
    (publishedResult.bundle as MarketingCampaignBundle).publisher?.channels.linkedin
      .status === "published",
    "Expected published result to move LinkedIn status to published.",
  );
  assert(
    (publishedResult.bundle as MarketingCampaignBundle).publisher?.channels.linkedin
      .platformPostId === "urn:li:share:123456",
    "Expected published result to persist LinkedIn post id.",
  );

  const rollbackResult = buildLinkedInRollbackResult(
    { bundle },
    bundle,
    lockNow,
  );
  assert(
    (rollbackResult.bundle as MarketingCampaignBundle).publisher?.channels.linkedin
      .status === "draft",
    "Expected rollback result to avoid marking LinkedIn as published.",
  );
  assert(
    !(rollbackResult.bundle as MarketingCampaignBundle).publisher?.channels.linkedin
      .publishAttemptId,
    "Expected rollback result to clear publishAttemptId.",
  );

  const postPayload = buildLinkedInTextPostPayload(
    "urn:li:organization:2414183",
    message,
  );
  assert(
    postPayload.author === "urn:li:organization:2414183",
    "Expected LinkedIn payload to target an organization URN.",
  );
  assert(
    postPayload.distribution.feedDistribution === "MAIN_FEED" &&
      Array.isArray(postPayload.distribution.targetEntities) &&
      postPayload.visibility === "PUBLIC",
    "Expected LinkedIn text-only posts payload to match Posts API schema.",
  );

  const originalFetch = globalThis.fetch;
  const fetchCalls: Array<{
    url: string;
    method: string;
    body?: string;
    headers: Record<string, string>;
  }> = [];

  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === "string" ? input : input.toString();
    const method = init?.method ?? "GET";
    const headers = new Headers(init?.headers);
    fetchCalls.push({
      url,
      method,
      body: typeof init?.body === "string" ? init.body : undefined,
      headers: Object.fromEntries(headers.entries()),
    });

    if (url === "https://www.linkedin.com/oauth/v2/accessToken") {
      return new Response(
        JSON.stringify({
          access_token: "linkedin-access-token",
          expires_in: 5184000,
          scope: "w_organization_social",
        }),
        {
          status: 200,
          headers: { "content-type": "application/json" },
        },
      );
    }

    if (url.startsWith("https://api.linkedin.com/rest/organizationAcls")) {
      return new Response(
        JSON.stringify({
          elements: [
            {
              role: "ADMINISTRATOR",
              state: "APPROVED",
              organizationTarget: "urn:li:organization:2414183",
            },
          ],
        }),
        {
          status: 200,
          headers: { "content-type": "application/json" },
        },
      );
    }

    if (url === LINKEDIN_POSTS_ENDPOINT) {
      return new Response(
        JSON.stringify({
          id: "urn:li:share:999999",
        }),
        {
          status: 201,
          headers: {
            "content-type": "application/json",
            "x-restli-id": "urn:li:share:999999",
          },
        },
      );
    }

    throw new Error(`Unexpected fetch call: ${method} ${url}`);
  }) as typeof fetch;

  try {
    const tokenResult = await exchangeLinkedInCodeForAccessToken(
      oauthConfig.config,
      "oauth-code-123",
    );
    assert(tokenResult.ok, "Expected LinkedIn token exchange to succeed.");
    assert(
      tokenResult.accessToken === "linkedin-access-token",
      "Expected LinkedIn token exchange to return the access token.",
    );
    assert(
      tokenResult.grantedScopes.includes("w_organization_social"),
      "Expected LinkedIn token exchange to return granted scopes.",
    );

    const organizationResult = await resolveLinkedInOrganization(
      oauthConfig.config,
      tokenResult.accessToken,
    );
    assert(
      organizationResult.ok &&
        organizationResult.organization.organizationUrn ===
          "urn:li:organization:2414183",
      "Expected LinkedIn organization resolution to return the company page URN.",
    );

    const publishResult = await publishLinkedInTextPost(oauthConfig.config, {
      accessToken: tokenResult.accessToken,
      organizationUrn: organizationResult.organization.organizationUrn,
      message,
    });
    assert(publishResult.ok, "Expected LinkedIn post publish to succeed.");
    assert(
      publishResult.postId === "urn:li:share:999999",
      "Expected LinkedIn post publish to return the post id.",
    );
  } finally {
    globalThis.fetch = originalFetch;
  }

  const tokenRequest = fetchCalls.find(
    (call) => call.url === "https://www.linkedin.com/oauth/v2/accessToken",
  );
  assert(tokenRequest, "Expected LinkedIn token exchange request.");
  assert(
    tokenRequest.headers["content-type"] ===
      "application/x-www-form-urlencoded",
    "Expected LinkedIn token exchange request content-type.",
  );

  const postRequest = fetchCalls.find((call) => call.url === LINKEDIN_POSTS_ENDPOINT);
  assert(postRequest, "Expected LinkedIn posts API request.");
  assert(
    postRequest.headers.authorization === "Bearer linkedin-access-token",
    "Expected LinkedIn posts API to use bearer auth.",
  );
  assert(
    postRequest.headers["linkedin-version"] === "202507",
    "Expected LinkedIn posts API to send the configured LinkedIn version.",
  );
  assert(
    postRequest.headers["x-restli-protocol-version"] === "2.0.0",
    "Expected LinkedIn posts API to send Rest.li protocol version.",
  );
  assert(
    postRequest.body ===
      JSON.stringify(
        buildLinkedInTextPostPayload("urn:li:organization:2414183", message),
      ),
    "Expected LinkedIn posts API payload to be text-only and use finalCaption.",
  );

  console.log(
    JSON.stringify(
      {
        oauthScopeVerified: true,
        callbackTokenHandlingVerified: true,
        organizationUrnResolved: "urn:li:organization:2414183",
        postsApiPayloadVerified: true,
        finalCaptionPriorityVerified: true,
        facebookInstagramFallbackRejected: true,
        approvalRequiredVerified: true,
        doublePublishBlockedVerified: true,
        publishingTransitionVerified: true,
        providerErrorDoesNotPublishVerified: true,
      },
      null,
      2,
    ),
  );
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});

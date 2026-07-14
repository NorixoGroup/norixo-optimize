import assert from "node:assert/strict";

import { handleFreeAuditPreviewRequest } from "../app/api/free-audit/preview/route";
import type {
  FreeAuditPricingPreviewInput,
  FreeAuditPricingPreviewResult,
} from "../lib/freeAudit/publicPricingPreviewContract";

const FORBIDDEN_KEYS = new Set([
  "intendedUse",
  "marketCellKey",
  "artifactId",
  "artifact_id",
  "artifactKey",
  "artifact_key",
  "factKey",
  "fact_key",
  "supersedesArtifactId",
  "supersedes_artifact_id",
  "evidenceContractVersion",
  "diagnosticContractVersion",
  "projectionContractVersion",
  "policyVersions",
  "validFrom",
  "validUntil",
  "fallbackLevel",
  "confidenceLevel",
  "freshnessStatus",
  "permittedWording",
  "reasonCodes",
  "rawSampleSize",
  "includedSampleSize",
  "excludedOutlierCount",
  "sourceClassCount",
  "sourceDiversityBand",
  "approvalStatus",
  "approvedForInternal",
  "approvedForAudit",
  "createdAt",
  "created_at",
  "p10",
  "p90",
  "listingUrl",
]);

type PreviewStub = (
  input: FreeAuditPricingPreviewInput,
) => Promise<FreeAuditPricingPreviewResult>;

type RateLimitResultStub = Readonly<{
  allowed: boolean;
  remaining: number;
  retryAfterSeconds: number;
  resetAt: number;
}>;

type RateLimitStub = () => RateLimitResultStub;

function buildValidPayload(
  overrides: Partial<FreeAuditPricingPreviewInput> = {},
): FreeAuditPricingPreviewInput {
  return Object.freeze({
    country: "France",
    city: "Paris",
    platform: "airbnb",
    propertyType: "apartment",
    guestCapacity: 4,
    declaredNightlyPrice: 150,
    currency: "EUR",
    ...overrides,
  });
}

function buildAvailableBody() {
  return Object.freeze({
    status: "available" as const,
    market: Object.freeze({
      country: "france",
      city: "paris",
      platform: "airbnb" as const,
      propertyType: "apartment" as const,
      capacityBand: "4_6" as const,
      currency: "EUR",
    }),
    declaredNightlyPrice: 150,
    benchmark: Object.freeze({
      lowPrice: 120,
      medianPrice: 150,
      highPrice: 180,
    }),
    positioning: Object.freeze({
      band: "near_market" as const,
      deltaFromMedianPercent: 0,
    }),
    confidence: Object.freeze({
      level: "high" as const,
      sampleBand: "strong" as const,
    }),
    limitations: Object.freeze([
      "Les resultats reposent sur des donnees de marche agregees.",
    ]),
    recommendations: Object.freeze([
      "Votre prix declare est proche du niveau central observe.",
    ]),
  });
}

function buildInsufficientBody() {
  return Object.freeze({
    status: "insufficient_coverage" as const,
    market: Object.freeze({
      country: "france",
      city: "paris",
      platform: "airbnb" as const,
      propertyType: "apartment" as const,
      capacityBand: "4_6" as const,
      currency: "EUR",
    }),
    declaredNightlyPrice: 150,
    limitations: Object.freeze([
      "L'apercu gratuit repose uniquement sur des donnees de marche agregees lorsqu'elles sont disponibles.",
    ]),
    message: "Nous ne disposons pas encore d'un volume suffisant de donnees agregees pour ce marche.",
  });
}

function buildUnavailableBody() {
  return Object.freeze({
    status: "unavailable" as const,
    message: "L'apercu gratuit est temporairement indisponible.",
  });
}

function buildRequest(options: {
  body?: string;
  headers?: HeadersInit;
  method?: string;
} = {}): Request {
  return new Request("http://localhost/api/free-audit/preview", {
    method: options.method ?? "POST",
    headers: {
      "content-type": "application/json",
      ...(options.headers ?? {}),
    },
    body: options.body,
  });
}

function buildAllowedRateLimitResult(
  overrides: Partial<RateLimitResultStub> = {},
): RateLimitResultStub {
  return Object.freeze({
    allowed: true,
    remaining: 4,
    retryAfterSeconds: 0,
    resetAt: 1_752_500_000_000,
    ...overrides,
  });
}

function buildBlockedRateLimitResult(
  overrides: Partial<RateLimitResultStub> = {},
): RateLimitResultStub {
  return Object.freeze({
    allowed: false,
    remaining: 0,
    retryAfterSeconds: 120,
    resetAt: 1_752_500_120_000,
    ...overrides,
  });
}

function collectForbiddenKeys(value: unknown, found: Set<string> = new Set()): Set<string> {
  if (Array.isArray(value)) {
    for (const entry of value) {
      collectForbiddenKeys(entry, found);
    }
    return found;
  }

  if (value != null && typeof value === "object") {
    for (const [key, nested] of Object.entries(value)) {
      if (FORBIDDEN_KEYS.has(key)) {
        found.add(key);
      }
      collectForbiddenKeys(nested, found);
    }
  }

  return found;
}

async function parseJson(response: Response): Promise<unknown> {
  return response.json();
}

function assertStandardHeaders(response: Response): void {
  assert.equal(response.headers.get("Cache-Control"), "no-store, max-age=0");
  assert.equal(response.headers.get("Pragma"), "no-cache");
  assert.equal(response.headers.get("X-Content-Type-Options"), "nosniff");
  assert.equal(response.headers.get("Referrer-Policy"), "no-referrer");
}

async function main() {
  let callCount = 0;
  let lastInput: FreeAuditPricingPreviewInput | null = null;

  const callRoute = async (input: {
    request: Request;
    env?: Record<string, string | undefined>;
    buildPreview?: PreviewStub;
    checkRateLimit?: RateLimitStub;
  }) => {
    return handleFreeAuditPreviewRequest(input.request, {
      env: input.env ?? { ENABLE_FREE_AUDIT_PREVIEW: "true" },
      buildPreview: input.buildPreview,
      checkRateLimit: input.checkRateLimit,
    });
  };

  {
    const response = await callRoute({
      request: buildRequest({
        body: JSON.stringify(buildValidPayload()),
      }),
      buildPreview: async (input) => {
        callCount += 1;
        lastInput = input;
        return buildAvailableBody();
      },
      checkRateLimit: () => buildAllowedRateLimitResult(),
    });
    const body = await parseJson(response);
    assert.equal(response.status, 200);
    assertStandardHeaders(response);
    assert.deepEqual(body, buildAvailableBody());
    assert.equal(callCount, 1);
    assert.deepEqual(lastInput, buildValidPayload());
    assert.deepEqual([...collectForbiddenKeys(body)], []);
  }

  {
    const response = await callRoute({
      request: buildRequest({
        body: JSON.stringify(buildValidPayload()),
      }),
      buildPreview: async () => buildInsufficientBody(),
      checkRateLimit: () => buildAllowedRateLimitResult(),
    });
    const body = await parseJson(response);
    assert.equal(response.status, 200);
    assertStandardHeaders(response);
    assert.deepEqual(body, buildInsufficientBody());
  }

  {
    const response = await callRoute({
      request: buildRequest({
        body: JSON.stringify(buildValidPayload()),
      }),
      buildPreview: async () => buildUnavailableBody(),
      checkRateLimit: () => buildAllowedRateLimitResult(),
    });
    const body = await parseJson(response);
    assert.equal(response.status, 503);
    assertStandardHeaders(response);
    assert.deepEqual(body, buildUnavailableBody());
  }

  {
    let disabledCallCount = 0;
    let disabledRateLimitCalls = 0;
    const response = await callRoute({
      request: buildRequest({
        body: JSON.stringify(buildValidPayload()),
      }),
      env: { ENABLE_FREE_AUDIT_PREVIEW: "false" },
      buildPreview: async () => {
        disabledCallCount += 1;
        return buildAvailableBody();
      },
      checkRateLimit: () => {
        disabledRateLimitCalls += 1;
        return buildAllowedRateLimitResult();
      },
    });
    const body = await parseJson(response);
    assert.equal(response.status, 503);
    assertStandardHeaders(response);
    assert.deepEqual(body, buildUnavailableBody());
    assert.equal(disabledCallCount, 0);
    assert.equal(disabledRateLimitCalls, 0);
  }

  {
    let invalidJsonCallCount = 0;
    let invalidJsonRateLimitCalls = 0;
    const response = await callRoute({
      request: buildRequest({
        body: "{",
      }),
      buildPreview: async () => {
        invalidJsonCallCount += 1;
        return buildAvailableBody();
      },
      checkRateLimit: () => {
        invalidJsonRateLimitCalls += 1;
        return buildAllowedRateLimitResult();
      },
    });
    const body = await parseJson(response);
    assert.equal(response.status, 400);
    assertStandardHeaders(response);
    assert.deepEqual(body, {
      status: "invalid_request",
      message: "La demande d'apercu est invalide.",
    });
    assert.equal(invalidJsonCallCount, 0);
    assert.equal(invalidJsonRateLimitCalls, 1);
  }

  {
    const response = await callRoute({
      request: buildRequest({ body: "" }),
      buildPreview: async () => buildAvailableBody(),
      checkRateLimit: () => buildAllowedRateLimitResult(),
    });
    const body = await parseJson(response);
    assert.equal(response.status, 400);
    assertStandardHeaders(response);
    assert.deepEqual(body, {
      status: "invalid_request",
      message: "La demande d'apercu est invalide.",
    });
  }

  {
    const response = await callRoute({
      request: buildRequest({ body: "null" }),
      buildPreview: async () => buildAvailableBody(),
      checkRateLimit: () => buildAllowedRateLimitResult(),
    });
    const body = await parseJson(response);
    assert.equal(response.status, 400);
    assertStandardHeaders(response);
    assert.deepEqual(body, {
      status: "invalid_request",
      message: "La demande d'apercu est invalide.",
    });
  }

  {
    const response = await callRoute({
      request: buildRequest({ body: "[]" }),
      buildPreview: async () => buildAvailableBody(),
      checkRateLimit: () => buildAllowedRateLimitResult(),
    });
    const body = await parseJson(response);
    assert.equal(response.status, 400);
    assertStandardHeaders(response);
    assert.deepEqual(body, {
      status: "invalid_request",
      message: "La demande d'apercu est invalide.",
    });
  }

  {
    const missingFieldPayload = {
      country: "France",
      city: "Paris",
      platform: "airbnb",
      propertyType: "apartment",
      guestCapacity: 4,
      currency: "EUR",
    };
    const response = await callRoute({
      request: buildRequest({ body: JSON.stringify(missingFieldPayload) }),
      buildPreview: async () => buildAvailableBody(),
      checkRateLimit: () => buildAllowedRateLimitResult(),
    });
    const body = await parseJson(response);
    assert.equal(response.status, 400);
    assertStandardHeaders(response);
    assert.deepEqual(body, {
      status: "invalid_request",
      message: "La demande d'apercu est invalide.",
    });
  }

  {
    let extraKeyCallCount = 0;
    const response = await callRoute({
      request: buildRequest({
        body: JSON.stringify({
          ...buildValidPayload(),
          listingUrl: "https://example.com/private",
        }),
      }),
      buildPreview: async () => {
        extraKeyCallCount += 1;
        return buildAvailableBody();
      },
      checkRateLimit: () => buildAllowedRateLimitResult(),
    });
    const body = await parseJson(response);
    assert.equal(response.status, 400);
    assertStandardHeaders(response);
    assert.deepEqual(body, {
      status: "invalid_request",
      message: "La demande d'apercu est invalide.",
    });
    assert.equal(extraKeyCallCount, 0);
    assert.equal(JSON.stringify(body).includes("https://example.com/private"), false);
  }

  {
    const response = await callRoute({
      request: buildRequest({
        body: JSON.stringify(buildValidPayload()),
      }),
      buildPreview: async () => {
        throw new Error("sensitive_supabase_failure");
      },
      checkRateLimit: () => buildAllowedRateLimitResult(),
    });
    const body = await parseJson(response);
    assert.equal(response.status, 503);
    assertStandardHeaders(response);
    assert.deepEqual(body, buildUnavailableBody());
    assert.equal(JSON.stringify(body).includes("sensitive_supabase_failure"), false);
  }

  {
    let largeBodyCallCount = 0;
    let largeBodyRateLimitCalls = 0;
    const response = await callRoute({
      request: buildRequest({
        body: JSON.stringify(buildValidPayload()),
        headers: {
          "content-length": "9000",
        },
      }),
      buildPreview: async () => {
        largeBodyCallCount += 1;
        return buildAvailableBody();
      },
      checkRateLimit: () => {
        largeBodyRateLimitCalls += 1;
        return buildAllowedRateLimitResult();
      },
    });
    const body = await parseJson(response);
    assert.equal(response.status, 413);
    assertStandardHeaders(response);
    assert.deepEqual(body, {
      status: "invalid_request",
      message: "La demande d'apercu est invalide.",
    });
    assert.equal(largeBodyCallCount, 0);
    assert.equal(largeBodyRateLimitCalls, 1);
  }

  {
    let allowedRateLimitCalls = 0;
    let allowedBuildCalls = 0;
    const response = await callRoute({
      request: buildRequest({
        body: JSON.stringify(buildValidPayload()),
      }),
      buildPreview: async () => {
        allowedBuildCalls += 1;
        return buildAvailableBody();
      },
      checkRateLimit: () => {
        allowedRateLimitCalls += 1;
        return buildAllowedRateLimitResult({
          remaining: 3,
        });
      },
    });
    const body = await parseJson(response);
    assert.equal(response.status, 200);
    assertStandardHeaders(response);
    assert.deepEqual(body, buildAvailableBody());
    assert.equal(allowedRateLimitCalls, 1);
    assert.equal(allowedBuildCalls, 1);
  }

  {
    let blockedBuildCalls = 0;
    let blockedRateLimitCalls = 0;
    const response = await callRoute({
      request: buildRequest({
        body: JSON.stringify(buildValidPayload()),
      }),
      buildPreview: async () => {
        blockedBuildCalls += 1;
        return buildAvailableBody();
      },
      checkRateLimit: () => {
        blockedRateLimitCalls += 1;
        return buildBlockedRateLimitResult({
          retryAfterSeconds: 180,
        });
      },
    });
    const body = await parseJson(response);
    assert.equal(response.status, 429);
    assertStandardHeaders(response);
    assert.equal(response.headers.get("Retry-After"), "180");
    assert.deepEqual(body, {
      status: "rate_limited",
      message:
        "Trop de demandes ont ete effectuees. Veuillez reessayer plus tard.",
    });
    assert.equal(blockedRateLimitCalls, 1);
    assert.equal(blockedBuildCalls, 0);
    assert.deepEqual([...collectForbiddenKeys(body)], []);
  }

  console.log("PASS — Free audit preview route smoke");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

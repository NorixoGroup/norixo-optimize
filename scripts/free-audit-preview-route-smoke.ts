import assert from "node:assert/strict";

import { handleFreeAuditPreviewRequest } from "../app/api/free-audit/preview/route";
import type {
  FreeAuditMarketOverviewAvailable,
  FreeAuditMarketOverviewInput,
  FreeAuditMarketOverviewInsufficientCoverage,
  FreeAuditMarketOverviewUnavailable,
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
  "guestCapacity",
  "declaredNightlyPrice",
]);

type PreviewStub = (
  input: FreeAuditMarketOverviewInput,
) => Promise<FreeAuditPricingPreviewResult>;

type RateLimitResultStub = Readonly<{
  allowed: boolean;
  remaining: number;
  retryAfterSeconds: number;
  resetAt: number;
}>;

type RateLimitStub = () => RateLimitResultStub;

function buildValidPayload(
  overrides: Partial<FreeAuditMarketOverviewInput> = {},
): FreeAuditMarketOverviewInput {
  return Object.freeze({
    country: "France",
    city: "Paris",
    platform: "airbnb",
    propertyType: "apartment",
    ...overrides,
  });
}

function buildAvailableBody(): FreeAuditMarketOverviewAvailable {
  return Object.freeze({
    status: "available",
    market: Object.freeze({
      country: "france",
      city: "paris",
      platform: "all",
      platformScope: "all_platforms",
      propertyType: "apartment",
    }),
    benchmark: Object.freeze({
      lowPrice: 120,
      medianPrice: 150,
      highPrice: 180,
      currency: "EUR",
    }),
    confidence: Object.freeze({
      level: "high",
      sampleBand: "strong",
    }),
    limitations: Object.freeze([
      "aggregated_market_data",
      "multi_platform_scope",
    ] as const),
    recommendations: Object.freeze(["median_positions_market"] as const),
  });
}

function buildInsufficientBody(): FreeAuditMarketOverviewInsufficientCoverage {
  return Object.freeze({
    status: "insufficient_coverage",
    market: Object.freeze({
      country: "france",
      city: "paris",
      platform: "all",
      platformScope: "all_platforms",
      propertyType: "apartment",
    }),
    limitations: Object.freeze([
      "aggregated_market_data",
      "multi_platform_scope",
    ] as const),
    message:
      "Nous ne disposons pas encore d'un volume suffisant de donnees agregees pour ce marche.",
  });
}

function buildUnavailableBody(): FreeAuditMarketOverviewUnavailable {
  return Object.freeze({
    status: "unavailable",
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
  let lastInput: FreeAuditMarketOverviewInput | null = null;

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
    const response = await callRoute({
      request: buildRequest({
        body: "{",
      }),
      buildPreview: async () => {
        invalidJsonCallCount += 1;
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
    assert.equal(invalidJsonCallCount, 0);
  }

  {
    const invalidBodies = [
      "",
      "null",
      "[]",
      JSON.stringify({
        country: "France",
        city: "Paris",
        platform: "airbnb",
      }),
      JSON.stringify({
        ...buildValidPayload(),
        currency: "EUR",
      }),
      JSON.stringify({
        ...buildValidPayload(),
        guestCapacity: 4,
      }),
      JSON.stringify({
        ...buildValidPayload(),
        declaredNightlyPrice: 145,
      }),
      JSON.stringify({
        ...buildValidPayload(),
        listingUrl: "https://example.com/private",
      }),
      JSON.stringify({
        ...buildValidPayload(),
        platform: "other",
      }),
      JSON.stringify({
        ...buildValidPayload(),
        propertyType: "castle",
      }),
    ];

    for (const bodyValue of invalidBodies) {
      const response = await callRoute({
        request: buildRequest({ body: bodyValue }),
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
  }

  {
    let rateLimitCallCount = 0;
    let previewCallCount = 0;
    const response = await callRoute({
      request: buildRequest({
        body: JSON.stringify(buildValidPayload()),
      }),
      buildPreview: async () => {
        previewCallCount += 1;
        return buildAvailableBody();
      },
      checkRateLimit: () => {
        rateLimitCallCount += 1;
        return buildBlockedRateLimitResult();
      },
    });
    const body = await parseJson(response);
    assert.equal(response.status, 429);
    assertStandardHeaders(response);
    assert.equal(response.headers.get("Retry-After"), "120");
    assert.deepEqual(body, {
      status: "rate_limited",
      message: "Trop de demandes ont ete effectuees. Veuillez reessayer plus tard.",
    });
    assert.equal(rateLimitCallCount, 1);
    assert.equal(previewCallCount, 0);
  }

  {
    const oversized = "x".repeat(8 * 1024 + 1);
    const response = await callRoute({
      request: buildRequest({
        headers: { "content-length": String(oversized.length) },
        body: oversized,
      }),
      buildPreview: async () => buildAvailableBody(),
      checkRateLimit: () => buildAllowedRateLimitResult(),
    });
    const body = await parseJson(response);
    assert.equal(response.status, 413);
    assertStandardHeaders(response);
    assert.deepEqual(body, {
      status: "invalid_request",
      message: "La demande d'apercu est invalide.",
    });
  }

  console.log("PASS — Free audit preview route smoke");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

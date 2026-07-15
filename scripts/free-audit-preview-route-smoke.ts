import assert from "node:assert/strict";

import { handleFreeAuditPreviewRequest } from "../app/api/free-audit/preview/route";
import {
  getInMemoryRateLimitStateSizeForTests,
  resetInMemoryRateLimitStateForTests,
} from "../lib/http/inMemoryRateLimit";
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
  ip?: string;
} = {}): Request {
  return new Request("http://localhost/api/free-audit/preview", {
    method: options.method ?? "POST",
    headers: {
      "content-type": "application/json",
      ...(options.ip ? { "x-forwarded-for": options.ip } : {}),
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
    remaining: 9,
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

function assertNoRateLimitHeaders(response: Response): void {
  assert.equal(response.headers.get("X-RateLimit-Limit"), null);
  assert.equal(response.headers.get("X-RateLimit-Remaining"), null);
  assert.equal(response.headers.get("X-RateLimit-Reset"), null);
  assert.equal(response.headers.get("Retry-After"), null);
}

function assertRateLimitHeaders(
  response: Response,
  input: {
    remaining: number;
    resetAt: number;
    retryAfter?: number | null;
  },
): void {
  assert.equal(response.headers.get("X-RateLimit-Limit"), "10");
  assert.equal(
    response.headers.get("X-RateLimit-Remaining"),
    String(input.remaining),
  );
  assert.equal(
    response.headers.get("X-RateLimit-Reset"),
    String(Math.ceil(input.resetAt / 1000)),
  );
  if (input.retryAfter == null) {
    assert.equal(response.headers.get("Retry-After"), null);
    return;
  }
  assert.equal(response.headers.get("Retry-After"), String(input.retryAfter));
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
    assertRateLimitHeaders(response, {
      remaining: 9,
      resetAt: 1_752_500_000_000,
    });
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
      checkRateLimit: () => buildAllowedRateLimitResult({ remaining: 8 }),
    });
    const body = await parseJson(response);
    assert.equal(response.status, 200);
    assertStandardHeaders(response);
    assertRateLimitHeaders(response, {
      remaining: 8,
      resetAt: 1_752_500_000_000,
    });
    assert.deepEqual(body, buildInsufficientBody());
  }

  {
    const response = await callRoute({
      request: buildRequest({
        body: JSON.stringify(buildValidPayload()),
      }),
      buildPreview: async () => buildUnavailableBody(),
      checkRateLimit: () => buildAllowedRateLimitResult({ remaining: 7 }),
    });
    const body = await parseJson(response);
    assert.equal(response.status, 503);
    assertStandardHeaders(response);
    assertRateLimitHeaders(response, {
      remaining: 7,
      resetAt: 1_752_500_000_000,
    });
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
    assertNoRateLimitHeaders(response);
    assert.deepEqual(body, buildUnavailableBody());
    assert.equal(disabledCallCount, 0);
    assert.equal(disabledRateLimitCalls, 0);
  }

  {
    let invalidJsonCallCount = 0;
    let invalidJsonRateLimitCount = 0;
    const response = await callRoute({
      request: buildRequest({
        body: "{",
      }),
      buildPreview: async () => {
        invalidJsonCallCount += 1;
        return buildAvailableBody();
      },
      checkRateLimit: () => {
        invalidJsonRateLimitCount += 1;
        return buildAllowedRateLimitResult();
      },
    });
    const body = await parseJson(response);
    assert.equal(response.status, 400);
    assertStandardHeaders(response);
    assertNoRateLimitHeaders(response);
    assert.deepEqual(body, {
      status: "invalid_request",
      message: "La demande d'apercu est invalide.",
    });
    assert.equal(invalidJsonCallCount, 0);
    assert.equal(invalidJsonRateLimitCount, 0);
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
      let invalidBodyRateLimitCount = 0;
      const response = await callRoute({
        request: buildRequest({ body: bodyValue }),
        buildPreview: async () => buildAvailableBody(),
        checkRateLimit: () => {
          invalidBodyRateLimitCount += 1;
          return buildAllowedRateLimitResult();
        },
      });
      const body = await parseJson(response);
      assert.equal(response.status, 400);
      assertStandardHeaders(response);
      assertNoRateLimitHeaders(response);
      assert.deepEqual(body, {
        status: "invalid_request",
        message: "La demande d'apercu est invalide.",
      });
      assert.equal(invalidBodyRateLimitCount, 0);
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
    assertRateLimitHeaders(response, {
      remaining: 0,
      resetAt: 1_752_500_120_000,
      retryAfter: 120,
    });
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
    assertNoRateLimitHeaders(response);
    assert.deepEqual(body, {
      status: "invalid_request",
      message: "La demande d'apercu est invalide.",
    });
  }

  {
    resetInMemoryRateLimitStateForTests();
    const ip = "203.0.113.10";
    const allowedResponses: Response[] = [];
    let sharedResetHeader: string | null = null;
    for (let index = 0; index < 10; index += 1) {
      allowedResponses.push(
        await callRoute({
          request: buildRequest({
            ip,
            body: JSON.stringify(
              buildValidPayload({
                city: index % 2 === 0 ? "Rabat" : "Sale",
                propertyType: index % 3 === 0 ? "apartment" : "villa",
              }),
            ),
          }),
          buildPreview: async () => buildAvailableBody(),
        }),
      );
    }

    for (const [index, response] of allowedResponses.entries()) {
      assert.equal(response.status, 200);
      assertStandardHeaders(response);
      if (sharedResetHeader == null) {
        sharedResetHeader = response.headers.get("X-RateLimit-Reset");
      } else {
        assert.equal(response.headers.get("X-RateLimit-Reset"), sharedResetHeader);
      }
      assertRateLimitHeaders(response, {
        remaining: 9 - index,
        resetAt: Number(response.headers.get("X-RateLimit-Reset")) * 1000,
      });
    }

    const blockedResponse = await callRoute({
      request: buildRequest({
        ip,
        body: JSON.stringify(buildValidPayload({ city: "Fes", propertyType: "riad" })),
      }),
      buildPreview: async () => buildAvailableBody(),
    });
    const blockedBody = await parseJson(blockedResponse);
    assert.equal(blockedResponse.status, 429);
    assertStandardHeaders(blockedResponse);
    assert.ok(Number(blockedResponse.headers.get("Retry-After")) >= 1);
    assert.equal(
      blockedResponse.headers.get("X-RateLimit-Reset"),
      sharedResetHeader,
    );
    assert.equal((blockedBody as { status: string }).status, "rate_limited");
  }

  {
    resetInMemoryRateLimitStateForTests();
    const invalidIp = "203.0.113.11";
    const invalidResponses = [
      await callRoute({
        request: buildRequest({ ip: invalidIp, body: "{" }),
        buildPreview: async () => buildAvailableBody(),
      }),
      await callRoute({
        request: buildRequest({ ip: invalidIp, body: "" }),
        buildPreview: async () => buildAvailableBody(),
      }),
      await callRoute({
        request: buildRequest({
          ip: invalidIp,
          body: JSON.stringify({
            country: "Morocco",
            city: "Rabat",
            platform: "airbnb",
            propertyType: "castle",
          }),
        }),
        buildPreview: async () => buildAvailableBody(),
      }),
      await callRoute({
        request: buildRequest({
          ip: invalidIp,
          body: JSON.stringify({
            country: "",
            city: "Rabat",
            platform: "airbnb",
            propertyType: "riad",
          }),
        }),
        buildPreview: async () => buildAvailableBody(),
      }),
      await callRoute({
        request: buildRequest({
          ip: invalidIp,
          body: JSON.stringify({
            country: "Morocco",
            city: "",
            platform: "airbnb",
            propertyType: "riad",
          }),
        }),
        buildPreview: async () => buildAvailableBody(),
      }),
    ];
    for (const response of invalidResponses) {
      assert.ok(response.status === 400);
      assertNoRateLimitHeaders(response);
    }
    assert.equal(getInMemoryRateLimitStateSizeForTests(), 0);

    const firstValidAfterInvalid = await callRoute({
      request: buildRequest({
        ip: invalidIp,
        body: JSON.stringify(buildValidPayload({ city: "Rabat", propertyType: "riad" })),
      }),
      buildPreview: async () => buildAvailableBody(),
    });
    assert.equal(firstValidAfterInvalid.status, 200);
    assertRateLimitHeaders(firstValidAfterInvalid, {
      remaining: 9,
      resetAt: Number(firstValidAfterInvalid.headers.get("X-RateLimit-Reset")) * 1000,
    });
  }

  {
    resetInMemoryRateLimitStateForTests();
    const runtimeErrorIp = "203.0.113.12";
    const runtimeErrorResponse = await callRoute({
      request: buildRequest({
        ip: runtimeErrorIp,
        body: JSON.stringify(buildValidPayload()),
      }),
      buildPreview: async () => {
        throw new Error("synthetic_failure");
      },
    });
    const runtimeErrorBody = await parseJson(runtimeErrorResponse);
    assert.equal(runtimeErrorResponse.status, 503);
    assert.equal(
      (runtimeErrorBody as { status: string }).status,
      "unavailable",
    );
    assertRateLimitHeaders(runtimeErrorResponse, {
      remaining: 9,
      resetAt: Number(runtimeErrorResponse.headers.get("X-RateLimit-Reset")) * 1000,
    });

    const nextValidAfterRuntime = await callRoute({
      request: buildRequest({
        ip: runtimeErrorIp,
        body: JSON.stringify(buildValidPayload({ city: "Lyon" })),
      }),
      buildPreview: async () => buildAvailableBody(),
    });
    assert.equal(nextValidAfterRuntime.status, 200);
    assertRateLimitHeaders(nextValidAfterRuntime, {
      remaining: 8,
      resetAt: Number(nextValidAfterRuntime.headers.get("X-RateLimit-Reset")) * 1000,
    });
  }

  {
    resetInMemoryRateLimitStateForTests();
    const nonPostIp = "203.0.113.13";
    const getResponse = await callRoute({
      request: buildRequest({
        ip: nonPostIp,
        method: "GET",
      }),
      buildPreview: async () => buildAvailableBody(),
    });
    const optionsResponse = await callRoute({
      request: buildRequest({
        ip: nonPostIp,
        method: "OPTIONS",
      }),
      buildPreview: async () => buildAvailableBody(),
    });
    assert.equal(getResponse.status, 405);
    assert.equal(optionsResponse.status, 405);
    assertNoRateLimitHeaders(getResponse);
    assertNoRateLimitHeaders(optionsResponse);
    assert.equal(getInMemoryRateLimitStateSizeForTests(), 0);
  }

  {
    resetInMemoryRateLimitStateForTests();
    const ipA = "203.0.113.14";
    const ipB = "203.0.113.15";
    for (let index = 0; index < 10; index += 1) {
      await callRoute({
        request: buildRequest({
          ip: ipA,
          body: JSON.stringify(buildValidPayload()),
        }),
        buildPreview: async () => buildAvailableBody(),
      });
    }
    const ipBResponse = await callRoute({
      request: buildRequest({
        ip: ipB,
        body: JSON.stringify(buildValidPayload()),
      }),
      buildPreview: async () => buildAvailableBody(),
    });
    assert.equal(ipBResponse.status, 200);
    assertRateLimitHeaders(ipBResponse, {
      remaining: 9,
      resetAt: Number(ipBResponse.headers.get("X-RateLimit-Reset")) * 1000,
    });
  }

  {
    resetInMemoryRateLimitStateForTests();
    const sharedCityIp = "203.0.113.16";
    for (let index = 0; index < 10; index += 1) {
      const city = index < 5 ? "Rabat" : "Fes";
      const response = await callRoute({
        request: buildRequest({
          ip: sharedCityIp,
          body: JSON.stringify(buildValidPayload({ city })),
        }),
        buildPreview: async () => buildAvailableBody(),
      });
      assert.equal(response.status, 200);
    }
    const blockedAcrossCity = await callRoute({
      request: buildRequest({
        ip: sharedCityIp,
        body: JSON.stringify(buildValidPayload({ city: "Casablanca" })),
      }),
      buildPreview: async () => buildAvailableBody(),
    });
    assert.equal(blockedAcrossCity.status, 429);
  }

  {
    resetInMemoryRateLimitStateForTests();
    const sharedPropertyTypeIp = "203.0.113.17";
    for (let index = 0; index < 10; index += 1) {
      const propertyType =
        index < 4 ? "apartment" : index < 7 ? "villa" : "riad";
      const response = await callRoute({
        request: buildRequest({
          ip: sharedPropertyTypeIp,
          body: JSON.stringify(buildValidPayload({ propertyType })),
        }),
        buildPreview: async () => buildAvailableBody(),
      });
      assert.equal(response.status, 200);
    }
    const blockedAcrossPropertyType = await callRoute({
      request: buildRequest({
        ip: sharedPropertyTypeIp,
        body: JSON.stringify(buildValidPayload({ propertyType: "room" })),
      }),
      buildPreview: async () => buildAvailableBody(),
    });
    assert.equal(blockedAcrossPropertyType.status, 429);
  }

  console.log("PASS — Free audit preview route smoke");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

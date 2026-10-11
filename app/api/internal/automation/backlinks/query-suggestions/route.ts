import { NextRequest, NextResponse } from "next/server";

import { isAdminPrivateEmail } from "@/lib/auth/isAdminEmail";
import {
  BacklinkDiscoveryQuerySuggestionError,
  generateBacklinkDiscoveryQuerySuggestions,
  type BacklinkDiscoveryQuerySuggestionInput,
} from "@/lib/automation/backlink-discovery-query-generator";
import { getRequestUserAndWorkspace } from "@/lib/server/routeAuth";

const ALLOWED_KEYS = ["countryCode", "languageCode", "count", "excludeQueries"];

function parseBody(value: unknown): BacklinkDiscoveryQuerySuggestionInput | null {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;
  if (!Object.keys(record).every((key) => ALLOWED_KEYS.includes(key))) return null;
  if (typeof record.countryCode !== "string" || typeof record.languageCode !== "string") return null;
  if (record.count !== undefined && typeof record.count !== "number") return null;
  if (
    record.excludeQueries !== undefined &&
    (!Array.isArray(record.excludeQueries) || !record.excludeQueries.every((item) => typeof item === "string"))
  ) {
    return null;
  }
  return {
    countryCode: record.countryCode,
    languageCode: record.languageCode,
    ...(record.count !== undefined ? { count: record.count } : {}),
    ...(record.excludeQueries !== undefined ? { excludeQueries: record.excludeQueries as string[] } : {}),
  };
}

function error(status: number, code: string, message: string) {
  return NextResponse.json({ ok: false, error: { code, message } }, { status });
}

/**
 * Preview-only. Generates search query suggestions for the operator.
 * It does not call Brave, create tasks, or write any record.
 */
export async function POST(request: NextRequest) {
  const context = await getRequestUserAndWorkspace(request);
  if (context.status === "unauthenticated") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (context.status === "workspace_forbidden") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  if (!isAdminPrivateEmail(context.user.email)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const input = parseBody(await request.json().catch(() => null));
  if (input === null) return error(400, "INVALID_INPUT", "Invalid query suggestion input");

  try {
    const result = await generateBacklinkDiscoveryQuerySuggestions(input);
    return NextResponse.json({ ok: true, suggestions: result.suggestions, rejectedCount: result.rejected.length });
  } catch (cause) {
    if (cause instanceof BacklinkDiscoveryQuerySuggestionError) {
      if (cause.code === "INVALID_INPUT") return error(400, cause.code, "Invalid query suggestion input");
      if (cause.code === "NO_VALID_SUGGESTIONS") return error(422, cause.code, "No valid suggestion was produced. Try again.");
      return error(502, cause.code, "Query suggestions are unavailable right now.");
    }
    console.error("[automation/backlinks/query-suggestions] request failed");
    return error(500, "QUERY_SUGGESTIONS_FAILED", "Query suggestions are unavailable right now.");
  }
}

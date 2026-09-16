import { NextRequest, NextResponse } from "next/server";
import { isAdminPrivateEmail } from "@/lib/auth/isAdminEmail";
import { createDomain, listDomains, type DomainInput } from "@/lib/backlinks/services/domainService";
import { getRequestUserAndWorkspace } from "@/lib/server/routeAuth";
function isRecord(body: unknown): body is Record<string, unknown> { return typeof body === "object" && body != null && !Array.isArray(body); }
function value(body: Record<string, unknown>, key: string) { const candidate = body[key]; return typeof candidate === "string" ? candidate : undefined; }
function paginationValue(searchParams: URLSearchParams, key: "page" | "pageSize"): number | undefined | null {
  const values = searchParams.getAll(key);
  if (values.length === 0) return undefined;
  if (values.length !== 1 || !/^[1-9]\d*$/.test(values[0])) return null;
  const parsed = Number(values[0]);
  return Number.isSafeInteger(parsed) ? parsed : null;
}
export function parseDomainPagination(searchParams: URLSearchParams): { page?: number; pageSize?: number } | null {
  const page = paginationValue(searchParams, "page");
  const pageSize = paginationValue(searchParams, "pageSize");
  if (page === null || pageSize === null) return null;
  return { ...(page === undefined ? {} : { page }), ...(pageSize === undefined ? {} : { pageSize }) };
}
function errorResponse(error: unknown) { const code = typeof error === "object" && error != null && "code" in error && typeof error.code === "string" ? error.code : null; const message = error instanceof Error ? error.message : "Impossible de traiter les domaines."; return NextResponse.json({ error: message }, { status: code === "NOT_FOUND" ? 404 : code === "VALIDATION" ? 400 : code === "CONFLICT" ? 409 : code === "FORBIDDEN" ? 403 : 500 }); }
async function context(request: NextRequest) { const result = await getRequestUserAndWorkspace(request); if (result.status === "unauthenticated") return null; if (result.status === "workspace_forbidden") return "forbidden" as const; return isAdminPrivateEmail(result.user.email) ? { client: result.client, user: result.user, workspace: result.workspace } : "forbidden" as const; }
function input(body: Record<string, unknown>): DomainInput | null { const domain_key = value(body, "domain_key"); const hostname = value(body, "hostname"); return domain_key && hostname ? { domain_key, hostname, ...(value(body, "display_name") !== undefined ? { display_name: value(body, "display_name") } : {}), ...(value(body, "country_code") !== undefined ? { country_code: value(body, "country_code") } : {}), ...(value(body, "region") !== undefined ? { region: value(body, "region") } : {}), ...(value(body, "primary_language") !== undefined ? { primary_language: value(body, "primary_language") } : {}), ...(value(body, "editorial_category") !== undefined ? { editorial_category: value(body, "editorial_category") } : {}), ...(value(body, "editorial_compatibility") !== undefined ? { editorial_compatibility: value(body, "editorial_compatibility") } : {}), ...(value(body, "estimated_difficulty") !== undefined ? { estimated_difficulty: value(body, "estimated_difficulty") } : {}), ...(value(body, "lifecycle_status") !== undefined ? { lifecycle_status: value(body, "lifecycle_status") } : {}) } : null; }
export async function GET(request: NextRequest) { const requestContext = await context(request); if (requestContext == null) return NextResponse.json({ error: "Unauthorized" }, { status: 401 }); if (requestContext === "forbidden") return NextResponse.json({ error: "Forbidden" }, { status: 403 }); const requestPagination = parseDomainPagination(new URL(request.url).searchParams); if (requestPagination == null) return NextResponse.json({ error: "Invalid pagination query" }, { status: 400 }); try { return NextResponse.json(await listDomains(requestContext.client, requestContext.workspace.id, requestPagination)); } catch (error) { return errorResponse(error); } }
export async function POST(request: NextRequest) { const requestContext = await context(request); if (requestContext == null) return NextResponse.json({ error: "Unauthorized" }, { status: 401 }); if (requestContext === "forbidden") return NextResponse.json({ error: "Forbidden" }, { status: 403 }); const body: unknown = await request.json().catch(() => null); if (!isRecord(body)) return NextResponse.json({ error: "Invalid request body" }, { status: 400 }); const requestInput = input(body); if (!requestInput) return NextResponse.json({ error: "Invalid request body" }, { status: 400 }); try { return NextResponse.json(await createDomain(requestContext.client, requestContext.workspace.id, requestContext.user.id, requestInput), { status: 201 }); } catch (error) { return errorResponse(error); } }

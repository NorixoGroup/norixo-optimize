import { createHash } from "node:crypto";

import type { Metadata, MetadataRoute } from "next";

import {
  getMarketReportBySlug,
  marketReports,
  type MarketReport,
} from "@/data/marketReports";
import {
  webPublicationManifestCatalogEnvelope,
  webPublicationManifests,
} from "@/data/intelligencePublishing/webPublicationManifests";
import { buildMarketReportMetadata } from "@/lib/seo/buildMarketReportMetadata";
import {
  validateWebPublicationManifest,
  type WebPublicationManifest,
  type WebRouteAlias,
} from "@/lib/intelligencePublishing/webPublisher";

export const NEXT_PUBLICATION_SOURCES = Object.freeze([
  "static_legacy",
  "ipp_canonical",
  "ipp_alias",
] as const);

export type NextPublicationSource =
  (typeof NEXT_PUBLICATION_SOURCES)[number];

export const NEXT_PUBLICATION_DIAGNOSTIC_CODES = Object.freeze([
  "next_catalog_created",
  "next_catalog_entry_created",
  "next_catalog_conflict",
  "next_route_resolved",
  "next_route_not_found",
  "next_route_fallback_legacy",
  "next_alias_resolved",
  "next_alias_rejected",
  "next_metadata_created",
  "next_static_params_created",
  "next_sitemap_entries_created",
  "next_sitemap_duplicate_removed",
  "next_jsonld_created",
  "next_page_model_resolved",
  "next_private_field_detected",
  "next_invalid_manifest",
  "next_invalid_catalog",
  "next_legacy_route_preserved",
] as const);

export type NextPublicationDiagnosticCode =
  (typeof NEXT_PUBLICATION_DIAGNOSTIC_CODES)[number];

export type NextPublicationDiagnosticSeverity = "info" | "warning" | "error";

export type NextPublicationDiagnostic = Readonly<{
  code: NextPublicationDiagnosticCode;
  severity: NextPublicationDiagnosticSeverity;
  slug: string | null;
  pathname: string | null;
  message: string;
  metadata: Readonly<Record<string, unknown>>;
}>;

export type NextPublicationCatalogEntry = Readonly<{
  slug: string;
  pathname: string;
  source: NextPublicationSource;
  canonicalPath: string;
  manifest: WebPublicationManifest | null;
  legacyReport: MarketReport | null;
  alias: WebRouteAlias | null;
  renderable: boolean;
  indexable: boolean;
  sitemapEligible: boolean;
  diagnostics: readonly NextPublicationDiagnostic[];
  fingerprint: string;
}>;

export type NextPublicationConflict = Readonly<{
  slug: string;
  pathname: string;
  reason: string;
  keptSource: NextPublicationSource | null;
  rejectedSource: NextPublicationSource | null;
}>;

export type NextPublicationCatalog = Readonly<{
  entries: readonly NextPublicationCatalogEntry[];
  canonicalEntries: readonly NextPublicationCatalogEntry[];
  aliasEntries: readonly NextPublicationCatalogEntry[];
  legacyEntries: readonly NextPublicationCatalogEntry[];
  conflicts: readonly NextPublicationConflict[];
  diagnostics: readonly NextPublicationDiagnostic[];
  fingerprint: string;
  generatedAt: string;
}>;

export type NextPublicationResolution = Readonly<{
  found: boolean;
  entry: NextPublicationCatalogEntry | null;
  source: NextPublicationSource | null;
  canonicalPath: string | null;
  redirectCandidate: string | null;
  diagnostics: readonly NextPublicationDiagnostic[];
  fingerprint: string;
}>;

export type NextPublicationCard = Readonly<{
  key: string;
  title: string;
  description: string;
  href: string;
  source: NextPublicationSource;
}>;

type NextLocalizedStaticParam = Readonly<{
  locale: string;
  report: string;
}>;

type BuildNextPublicationCatalogInput = Readonly<{
  manifests?: readonly WebPublicationManifest[];
  legacyReports?: readonly MarketReport[];
  generatedAt?: string;
}>;

function compareStrings(left: string, right: string): number {
  return left.localeCompare(right);
}

function buildStableHash(parts: readonly string[], prefix: string): string {
  const hash = createHash("sha256")
    .update(parts.join("||"))
    .digest("hex");
  return `${prefix}${hash}`;
}

function deepFreeze<T>(value: T): T {
  if (Array.isArray(value)) {
    value.forEach((entry) => deepFreeze(entry));
    return Object.freeze(value);
  }
  if (typeof value === "object" && value != null) {
    Object.values(value as Record<string, unknown>).forEach((entry) => {
      deepFreeze(entry);
    });
    return Object.freeze(value);
  }
  return value;
}

function isJsonSafe(value: unknown, seen: WeakSet<object> = new WeakSet()): boolean {
  if (
    value == null ||
    typeof value === "string" ||
    typeof value === "boolean"
  ) {
    return true;
  }
  if (typeof value === "number") {
    return Number.isFinite(value);
  }
  if (
    typeof value === "undefined" ||
    typeof value === "function" ||
    typeof value === "symbol" ||
    typeof value === "bigint"
  ) {
    return false;
  }
  if (Array.isArray(value)) {
    return value.every((entry) => isJsonSafe(entry, seen));
  }
  if (typeof value === "object") {
    if (seen.has(value)) {
      return false;
    }
    seen.add(value);
    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) {
      return false;
    }
    return Object.values(value as Record<string, unknown>).every((entry) =>
      isJsonSafe(entry, seen),
    );
  }
  return false;
}

function canSerializeToJson(value: unknown): boolean {
  try {
    JSON.stringify(value);
    return true;
  } catch {
    return false;
  }
}

const FORBIDDEN_PRIVATE_KEYS = new Set([
  "userid",
  "workspaceid",
  "auditid",
  "listingid",
  "listingurl",
  "sourceurl",
  "comparableurl",
  "email",
  "token",
  "apikey",
  "rawpayload",
  "workspace",
  "customerdata",
]);

function assertNoForbiddenPrivateKeys(value: unknown, path: string): void {
  if (Array.isArray(value)) {
    value.forEach((entry, index) =>
      assertNoForbiddenPrivateKeys(entry, `${path}[${index}]`),
    );
    return;
  }
  if (typeof value !== "object" || value == null) {
    return;
  }
  for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
    const normalizedKey = key.replace(/[^a-z0-9]/gi, "").toLowerCase();
    if (FORBIDDEN_PRIVATE_KEYS.has(normalizedKey)) {
      throw new Error(`Forbidden private field detected at ${path}.${key}`);
    }
    assertNoForbiddenPrivateKeys(child, `${path}.${key}`);
  }
}

function buildDiagnostic(
  input: Readonly<{
    code: NextPublicationDiagnosticCode;
    severity: NextPublicationDiagnosticSeverity;
    slug?: string | null;
    pathname?: string | null;
    message: string;
    metadata?: Readonly<Record<string, unknown>>;
  }>,
): NextPublicationDiagnostic {
  const metadata = Object.freeze({ ...(input.metadata ?? {}) });
  assertNoForbiddenPrivateKeys(metadata, "diagnostic.metadata");
  if (!isJsonSafe(metadata)) {
    throw new Error("Expected JSON-safe diagnostic metadata.");
  }
  return deepFreeze({
    code: input.code,
    severity: input.severity,
    slug: input.slug ?? null,
    pathname: input.pathname ?? null,
    message: input.message,
    metadata,
  });
}

function getPublicSiteUrl(): string {
  return (process.env.NEXT_PUBLIC_SITE_URL ?? "https://norixo.io").replace(/\/$/, "");
}

function normalizeRoute(route: string): string {
  const collapsed = route.replace(/\/{2,}/g, "/");
  const trimmed =
    collapsed.length > 1 && collapsed.endsWith("/")
      ? collapsed.slice(0, -1)
      : collapsed;
  return trimmed === "" ? "/" : trimmed;
}

function pathToSlug(pathname: string): string {
  return pathname.split("/").filter(Boolean).pop() ?? "";
}

function normalizeSlugLookup(slug: string): string {
  return decodeURIComponent(slug).trim().replace(/^\/+|\/+$/g, "").toLowerCase();
}

function buildCatalogEntry(input: Readonly<{
  slug: string;
  pathname: string;
  source: NextPublicationSource;
  canonicalPath: string;
  manifest?: WebPublicationManifest | null;
  legacyReport?: MarketReport | null;
  alias?: WebRouteAlias | null;
  renderable: boolean;
  indexable: boolean;
  sitemapEligible: boolean;
  diagnostics?: readonly NextPublicationDiagnostic[];
}>): NextPublicationCatalogEntry {
  const entry = {
    slug: input.slug,
    pathname: normalizeRoute(input.pathname),
    source: input.source,
    canonicalPath: normalizeRoute(input.canonicalPath),
    manifest: input.manifest ?? null,
    legacyReport: input.legacyReport ?? null,
    alias: input.alias ?? null,
    renderable: input.renderable,
    indexable: input.indexable,
    sitemapEligible: input.sitemapEligible,
    diagnostics: Object.freeze([...(input.diagnostics ?? [])]),
    fingerprint: buildStableHash(
      [
        input.slug,
        input.pathname,
        input.source,
        input.canonicalPath,
        input.manifest?.publicationFingerprint ?? "null",
        input.legacyReport?.slug ?? "null",
        input.alias?.fingerprint ?? "null",
        String(input.renderable),
        String(input.indexable),
        String(input.sitemapEligible),
      ],
      "ipp_next_catalog_entry_",
    ),
  };
  assertNoForbiddenPrivateKeys(entry, "catalogEntry");
  if (!canSerializeToJson(entry)) {
    throw new Error("Expected a JSON-safe Next publication catalog entry.");
  }
  return deepFreeze(entry);
}

function buildLegacyPath(report: MarketReport): string {
  return `/reports/${report.slug}`;
}

function buildLegacyEntry(report: MarketReport): NextPublicationCatalogEntry {
  const path = buildLegacyPath(report);
  return buildCatalogEntry({
    slug: report.slug,
    pathname: path,
    source: "static_legacy",
    canonicalPath: path,
    legacyReport: report,
    renderable: true,
    indexable: true,
    sitemapEligible: true,
    diagnostics: [
      buildDiagnostic({
        code: "next_catalog_entry_created",
        severity: "info",
        slug: report.slug,
        pathname: path,
        message: "A legacy static market report entry was added to the Next publication catalog.",
      }),
    ],
  });
}

function buildCanonicalManifestEntry(
  manifest: WebPublicationManifest,
): NextPublicationCatalogEntry {
  return buildCatalogEntry({
    slug: manifest.route.canonical.slug,
    pathname: manifest.route.canonical.pathname,
    source: "ipp_canonical",
    canonicalPath: manifest.publication.canonicalPath,
    manifest,
    renderable: manifest.publication.renderable,
    indexable: manifest.publication.indexable,
    sitemapEligible: manifest.publication.sitemapEligible,
    diagnostics: [
      buildDiagnostic({
        code: "next_catalog_entry_created",
        severity: "info",
        slug: manifest.route.canonical.slug,
        pathname: manifest.route.canonical.pathname,
        message: "An IPP canonical report entry was added to the Next publication catalog.",
        metadata: {
          reportId: manifest.reportId,
        },
      }),
    ],
  });
}

function isRenderableAlias(alias: WebRouteAlias): boolean {
  return alias.status === "candidate" || alias.status === "legacy_static";
}

function buildAliasManifestEntry(
  manifest: WebPublicationManifest,
  alias: WebRouteAlias,
): NextPublicationCatalogEntry {
  return buildCatalogEntry({
    slug: pathToSlug(alias.fromPath),
    pathname: alias.fromPath,
    source: "ipp_alias",
    canonicalPath: alias.toPath,
    manifest,
    alias,
    renderable: manifest.publication.renderable && isRenderableAlias(alias),
    indexable: false,
    sitemapEligible: false,
    diagnostics: [
      buildDiagnostic({
        code: "next_catalog_entry_created",
        severity: "info",
        slug: pathToSlug(alias.fromPath),
        pathname: alias.fromPath,
        message: "An IPP alias report entry was added to the Next publication catalog.",
        metadata: {
          reportId: manifest.reportId,
          aliasType: alias.aliasType,
        },
      }),
    ],
  });
}

function buildLegacyMap(reports: readonly MarketReport[]): Map<string, MarketReport> {
  return new Map(
    reports.map((report) => [normalizeSlugLookup(report.slug), report]),
  );
}

function buildInitialEntries(
  legacyReports: readonly MarketReport[],
): readonly NextPublicationCatalogEntry[] {
  return deepFreeze(
    [...legacyReports]
      .sort((left, right) => compareStrings(left.slug, right.slug))
      .map((report) => buildLegacyEntry(report)),
  );
}

function dedupeSitemapEntries(
  entries: MetadataRoute.Sitemap,
): MetadataRoute.Sitemap {
  const byUrl = new Map<string, MetadataRoute.Sitemap[number]>();
  for (const entry of entries) {
    byUrl.set(entry.url, entry);
  }
  return [...byUrl.values()].sort((left, right) => compareStrings(left.url, right.url));
}

export function buildNextPublicationCatalog(
  input: BuildNextPublicationCatalogInput = {},
): NextPublicationCatalog {
  const generatedAt = input.generatedAt ?? "2026-07-21T00:00:00.000Z";
  const legacyReports = input.legacyReports ?? marketReports;
  const legacyEntries = buildInitialEntries(legacyReports);
  const entries = [...legacyEntries];
  const diagnostics: NextPublicationDiagnostic[] = [];
  const conflicts: NextPublicationConflict[] = [];
  const legacySlugs = buildLegacyMap(legacyReports);
  const occupiedPathnames = new Map<string, NextPublicationCatalogEntry>(
    legacyEntries.map((entry) => [entry.pathname, entry]),
  );

  for (const manifestInput of input.manifests ?? webPublicationManifests) {
    const validation = validateWebPublicationManifest(manifestInput);
    if (!validation.ok) {
      diagnostics.push(
        buildDiagnostic({
          code: "next_invalid_manifest",
          severity: "error",
          message: "A manifest was rejected by the Next publication catalog because it is invalid.",
          metadata: {
            issues: validation.issues.map((issue) => `${issue.path}: ${issue.message}`),
          },
        }),
      );
      continue;
    }

    const manifest = validation.manifest;
    assertNoForbiddenPrivateKeys(manifest, "manifest");
    const canonicalEntry = buildCanonicalManifestEntry(manifest);
    const conflictingCanonical = occupiedPathnames.get(canonicalEntry.pathname);
    if (conflictingCanonical != null) {
      conflicts.push(
        deepFreeze({
          slug: canonicalEntry.slug,
          pathname: canonicalEntry.pathname,
          reason: "Canonical IPP route collides with an existing route.",
          keptSource: conflictingCanonical.source,
          rejectedSource: canonicalEntry.source,
        }),
      );
      diagnostics.push(
        buildDiagnostic({
          code: "next_catalog_conflict",
          severity: "warning",
          slug: canonicalEntry.slug,
          pathname: canonicalEntry.pathname,
          message: "An IPP canonical route was excluded because it collides with an existing route.",
          metadata: {
            keptSource: conflictingCanonical.source,
            rejectedSource: canonicalEntry.source,
          },
        }),
      );
    } else if (!canonicalEntry.renderable) {
      diagnostics.push(
        buildDiagnostic({
          code: "next_invalid_manifest",
          severity: "warning",
          slug: canonicalEntry.slug,
          pathname: canonicalEntry.pathname,
          message: "A non-renderable IPP manifest was excluded from the Next publication catalog.",
          metadata: {
            decisionType: manifest.decision.decisionType,
          },
        }),
      );
    } else {
      entries.push(canonicalEntry);
      occupiedPathnames.set(canonicalEntry.pathname, canonicalEntry);
    }

    for (const alias of manifest.aliases) {
      if (!isRenderableAlias(alias)) {
        diagnostics.push(
          buildDiagnostic({
            code: "next_alias_rejected",
            severity: "warning",
            slug: pathToSlug(alias.fromPath),
            pathname: alias.fromPath,
            message: "A blocked IPP alias was excluded from the Next publication catalog.",
            metadata: {
              aliasStatus: alias.status,
            },
          }),
        );
        continue;
      }
      if (normalizeRoute(alias.fromPath) === normalizeRoute(alias.toPath)) {
        diagnostics.push(
          buildDiagnostic({
            code: "next_alias_rejected",
            severity: "warning",
            slug: pathToSlug(alias.fromPath),
            pathname: alias.fromPath,
            message: "A self-referential IPP alias was excluded from the Next publication catalog.",
          }),
        );
        continue;
      }
      const aliasSlug = normalizeSlugLookup(pathToSlug(alias.fromPath));
      if (legacySlugs.has(aliasSlug)) {
        diagnostics.push(
          buildDiagnostic({
            code: "next_legacy_route_preserved",
            severity: "info",
            slug: aliasSlug,
            pathname: alias.fromPath,
            message: "A legacy route was preserved instead of being shadowed by an IPP alias.",
            metadata: {
              reportId: manifest.reportId,
            },
          }),
        );
        continue;
      }

      const aliasEntry = buildAliasManifestEntry(manifest, alias);
      const conflictingAlias = occupiedPathnames.get(aliasEntry.pathname);
      if (conflictingAlias != null) {
        conflicts.push(
          deepFreeze({
            slug: aliasEntry.slug,
            pathname: aliasEntry.pathname,
            reason: "IPP alias route collides with an existing route.",
            keptSource: conflictingAlias.source,
            rejectedSource: aliasEntry.source,
          }),
        );
        diagnostics.push(
          buildDiagnostic({
            code: "next_alias_rejected",
            severity: "warning",
            slug: aliasEntry.slug,
            pathname: aliasEntry.pathname,
            message: "An IPP alias was excluded because its route collides with an existing route.",
            metadata: {
              keptSource: conflictingAlias.source,
            },
          }),
        );
        continue;
      }

      entries.push(aliasEntry);
      occupiedPathnames.set(aliasEntry.pathname, aliasEntry);
    }
  }

  const sortedEntries = entries.sort((left, right) => {
    const pathnameOrder = compareStrings(left.pathname, right.pathname);
    return pathnameOrder !== 0
      ? pathnameOrder
      : compareStrings(left.source, right.source);
  });
  const catalog = deepFreeze({
    entries: deepFreeze(sortedEntries),
    canonicalEntries: deepFreeze(
      sortedEntries.filter((entry) => entry.source === "ipp_canonical"),
    ),
    aliasEntries: deepFreeze(
      sortedEntries.filter((entry) => entry.source === "ipp_alias"),
    ),
    legacyEntries: deepFreeze(
      sortedEntries.filter((entry) => entry.source === "static_legacy"),
    ),
    conflicts: deepFreeze(conflicts),
    diagnostics: deepFreeze([
      buildDiagnostic({
        code: "next_catalog_created",
        severity: "info",
        message: "A deterministic Next publication catalog was created.",
        metadata: {
          entryCount: sortedEntries.length,
          conflictCount: conflicts.length,
        },
      }),
      ...diagnostics,
    ]),
    fingerprint: buildStableHash(
      [
        generatedAt,
        JSON.stringify(
          sortedEntries.map((entry) => ({
            slug: entry.slug,
            pathname: entry.pathname,
            source: entry.source,
            fingerprint: entry.fingerprint,
          })),
        ),
        JSON.stringify(conflicts),
      ],
      "ipp_next_catalog_",
    ),
    generatedAt,
  });
  assertNoForbiddenPrivateKeys(catalog, "catalog");
  return catalog;
}

export function validateNextPublicationCatalog(
  input: unknown,
): input is NextPublicationCatalog {
  if (typeof input !== "object" || input == null || Array.isArray(input)) {
    return false;
  }
  try {
    assertNoForbiddenPrivateKeys(input, "catalog");
  } catch {
    return false;
  }
  return canSerializeToJson(input);
}

export function resolveNextPublicationBySlug(
  catalog: NextPublicationCatalog,
  slug: string,
): NextPublicationResolution {
  const normalizedSlug = normalizeSlugLookup(slug);
  const entry =
    catalog.entries.find(
      (candidate) => normalizeSlugLookup(candidate.slug) === normalizedSlug,
    ) ?? null;

  if (entry == null) {
    return deepFreeze({
      found: false,
      entry: null,
      source: null,
      canonicalPath: null,
      redirectCandidate: null,
      diagnostics: deepFreeze([
        buildDiagnostic({
          code: "next_route_not_found",
          severity: "warning",
          slug: normalizedSlug,
          pathname: `/reports/${normalizedSlug}`,
          message: "No report route matched the requested slug in the Next publication catalog.",
        }),
      ]),
      fingerprint: buildStableHash(
        [catalog.fingerprint, normalizedSlug, "not_found"],
        "ipp_next_resolution_",
      ),
    });
  }

  const resolutionDiagnostics: NextPublicationDiagnostic[] = [];
  if (entry.source === "ipp_alias") {
    resolutionDiagnostics.push(
      buildDiagnostic({
        code: "next_alias_resolved",
        severity: "info",
        slug: entry.slug,
        pathname: entry.pathname,
        message: "The requested report slug resolved through a valid IPP alias.",
        metadata: {
          canonicalPath: entry.canonicalPath,
        },
      }),
    );
  } else if (entry.source === "static_legacy") {
    resolutionDiagnostics.push(
      buildDiagnostic({
        code: "next_route_fallback_legacy",
        severity: "info",
        slug: entry.slug,
        pathname: entry.pathname,
        message: "The requested report slug resolved to a preserved legacy static route.",
      }),
    );
  } else {
    resolutionDiagnostics.push(
      buildDiagnostic({
        code: "next_route_resolved",
        severity: "info",
        slug: entry.slug,
        pathname: entry.pathname,
        message: "The requested report slug resolved to an IPP canonical route.",
      }),
    );
  }

  return deepFreeze({
    found: true,
    entry,
    source: entry.source,
    canonicalPath: entry.canonicalPath,
    redirectCandidate:
      entry.source === "ipp_alias"
        ? entry.alias?.toPath ?? entry.canonicalPath
        : null,
    diagnostics: deepFreeze(resolutionDiagnostics),
    fingerprint: buildStableHash(
      [catalog.fingerprint, normalizedSlug, entry.fingerprint],
      "ipp_next_resolution_",
    ),
  });
}

export function validateNextPublicationResolution(
  input: unknown,
): input is NextPublicationResolution {
  if (typeof input !== "object" || input == null || Array.isArray(input)) {
    return false;
  }
  try {
    assertNoForbiddenPrivateKeys(input, "resolution");
  } catch {
    return false;
  }
  return canSerializeToJson(input);
}

export function buildNextStaticParams(
  catalog: NextPublicationCatalog,
): readonly Readonly<{ report: string }>[] {
  const params = catalog.entries
    .filter(
      (entry) =>
        entry.renderable &&
        normalizeRoute(entry.pathname) === normalizeRoute(`/reports/${entry.slug}`),
    )
    .map((entry) => ({ report: entry.slug }))
    .sort((left, right) => compareStrings(left.report, right.report));
  return deepFreeze(params);
}

export function buildNextLocalizedStaticParams(
  catalog: NextPublicationCatalog,
): readonly NextLocalizedStaticParam[] {
  const params = catalog.canonicalEntries
    .filter((entry) => {
      const locale = entry.manifest?.route.canonical.locale;
      if (entry.manifest == null || locale == null || !entry.renderable) {
        return false;
      }
      return (
        normalizeRoute(entry.pathname) ===
        normalizeRoute(`/${locale}/reports/${entry.slug}`)
      );
    })
    .map((entry) => ({
      locale: entry.manifest!.route.canonical.locale,
      report: entry.slug,
    }))
    .sort((left, right) => {
      const byLocale = compareStrings(left.locale, right.locale);
      return byLocale !== 0
        ? byLocale
        : compareStrings(left.report, right.report);
    });
  return deepFreeze(params);
}

export function resolveNextPublicationForLocalizedRoute(
  catalog: NextPublicationCatalog,
  locale: string,
  slug: string,
): NextPublicationResolution {
  const normalizedLocale = normalizeSlugLookup(locale);
  const normalizedSlug = normalizeSlugLookup(slug);
  const resolution = resolveNextPublicationBySlug(catalog, normalizedSlug);

  if (
    !resolution.found ||
    resolution.entry == null ||
    resolution.entry.source !== "ipp_canonical" ||
    resolution.entry.manifest == null
  ) {
    return deepFreeze({
      found: false,
      entry: null,
      source: null,
      canonicalPath: null,
      redirectCandidate: null,
      diagnostics: deepFreeze([
        buildDiagnostic({
          code: "next_route_not_found",
          severity: "warning",
          slug: normalizedSlug,
          pathname: `/${normalizedLocale}/reports/${normalizedSlug}`,
          message:
            "No localized IPP report route matched the requested slug and locale in the Next publication catalog.",
          metadata: {
            locale: normalizedLocale,
          },
        }),
      ]),
      fingerprint: buildStableHash(
        [catalog.fingerprint, normalizedLocale, normalizedSlug, "localized_not_found"],
        "ipp_next_resolution_",
      ),
    });
  }

  const expectedPath = normalizeRoute(
    `/${normalizedLocale}/reports/${normalizedSlug}`,
  );
  const manifestLocale = normalizeSlugLookup(
    resolution.entry.manifest.route.canonical.locale,
  );
  if (
    manifestLocale !== normalizedLocale ||
    normalizeRoute(resolution.entry.pathname) !== expectedPath
  ) {
    return deepFreeze({
      found: false,
      entry: null,
      source: null,
      canonicalPath: null,
      redirectCandidate: null,
      diagnostics: deepFreeze([
        buildDiagnostic({
          code: "next_route_not_found",
          severity: "warning",
          slug: normalizedSlug,
          pathname: expectedPath,
          message:
            "The requested localized IPP report exists, but not for the requested locale route.",
          metadata: {
            expectedLocale: manifestLocale,
            requestedLocale: normalizedLocale,
            canonicalPath: resolution.entry.pathname,
          },
        }),
      ]),
      fingerprint: buildStableHash(
        [
          catalog.fingerprint,
          normalizedLocale,
          normalizedSlug,
          "localized_locale_mismatch",
        ],
        "ipp_next_resolution_",
      ),
    });
  }

  return resolution;
}

export function buildNextMetadataFromWebSeoModel(
  seo: WebPublicationManifest["seo"],
): Metadata {
  const alternatesLanguages = Object.fromEntries(
    Object.entries(seo.alternates).sort((left, right) =>
      compareStrings(left[0], right[0]),
    ),
  );
  return {
    title: seo.title,
    description: seo.description,
    alternates: {
      canonical: seo.canonical ?? undefined,
      languages: alternatesLanguages,
    },
    robots:
      typeof seo.robots.index === "boolean" || typeof seo.robots.follow === "boolean"
        ? {
            index:
              typeof seo.robots.index === "boolean" ? seo.robots.index : true,
            follow:
              typeof seo.robots.follow === "boolean" ? seo.robots.follow : true,
          }
        : undefined,
    openGraph: {
      ...(seo.openGraph as Metadata["openGraph"]),
      title: seo.title,
      description: seo.description,
      url: seo.canonical ?? undefined,
    },
    twitter: {
      card: "summary_large_image",
      title: seo.title,
      description: seo.description,
    },
  };
}

export function buildNextMetadataFromPublication(
  resolution: NextPublicationResolution,
): Metadata {
  if (!resolution.found || resolution.entry == null) {
    return {};
  }

  if (resolution.entry.source === "static_legacy") {
    const report = resolution.entry.legacyReport;
    if (report == null) {
      return {};
    }
    return buildMarketReportMetadata(report);
  }

  const manifest = resolution.entry.manifest;
  if (manifest == null) {
    return {};
  }
  return buildNextMetadataFromWebSeoModel(manifest.seo);
}

export function buildNextSitemapEntries(
  catalog: NextPublicationCatalog,
): MetadataRoute.Sitemap {
  const entries: MetadataRoute.Sitemap = [];
  for (const entry of catalog.entries) {
    if (!entry.sitemapEligible) {
      continue;
    }
    if (entry.source === "static_legacy") {
      entries.push({
        url: `${getPublicSiteUrl()}${entry.pathname}`,
      });
      continue;
    }
    const manifest = entry.manifest;
    if (manifest?.sitemapEntry != null) {
      entries.push({
        url: manifest.sitemapEntry.url,
        lastModified: manifest.sitemapEntry.lastModified,
      });
    }
  }
  return dedupeSitemapEntries(entries);
}

export function getNextPublicationCards(
  catalog: NextPublicationCatalog,
): readonly NextPublicationCard[] {
  const cards = catalog.entries
    .filter(
      (entry) =>
        entry.renderable &&
        entry.indexable &&
        entry.source !== "ipp_alias",
    )
    .map((entry) => {
      if (entry.source === "static_legacy") {
        return {
          key: `legacy:${entry.slug}`,
          title: entry.legacyReport?.title ?? entry.slug,
          description: entry.legacyReport?.description ?? "",
          href: entry.pathname,
          source: entry.source,
        } satisfies NextPublicationCard;
      }

      return {
        key: `ipp:${entry.slug}`,
        title: entry.manifest?.page.heading ?? entry.slug,
        description:
          entry.manifest?.seo.description ??
          entry.manifest?.page.description ??
          "",
        href: entry.canonicalPath,
        source: entry.source,
      } satisfies NextPublicationCard;
    })
    .sort((left, right) => compareStrings(left.href, right.href));
  return deepFreeze(cards);
}

export function buildDefaultNextPublicationCatalog(): NextPublicationCatalog {
  return buildNextPublicationCatalog({
    manifests: webPublicationManifestCatalogEnvelope.manifests,
    generatedAt: webPublicationManifestCatalogEnvelope.generatedAt,
    legacyReports: marketReports,
  });
}

export function findLegacyMarketReportBySlug(slug: string): MarketReport | null {
  return getMarketReportBySlug(normalizeSlugLookup(slug)) ?? null;
}

export function getNextPublicationStructuredData(
  resolution: NextPublicationResolution,
): Readonly<Record<string, unknown>> | readonly Readonly<Record<string, unknown>>[] | null {
  if (!resolution.found || resolution.entry == null) {
    return null;
  }
  if (resolution.entry.source === "static_legacy") {
    return null;
  }
  const structuredData = resolution.entry.manifest?.seo.structuredData ?? null;
  if (structuredData == null) {
    return null;
  }
  assertNoForbiddenPrivateKeys(structuredData, "structuredData");
  return deepFreeze(structuredData as Readonly<Record<string, unknown>>);
}

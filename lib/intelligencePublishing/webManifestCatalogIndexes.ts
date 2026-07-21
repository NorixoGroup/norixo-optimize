import type {
  WebPublicationManifest,
  WebRouteAlias,
} from "./webPublisher";

export const WEB_MANIFEST_ALIAS_REDIRECT_STATUS_CODE = 308 as const;

export type WebManifestCatalogAliasIndexEntry = Readonly<{
  manifestIndex: number;
  toPath: string;
  statusCode: typeof WEB_MANIFEST_ALIAS_REDIRECT_STATUS_CODE;
  aliasType: WebRouteAlias["aliasType"];
}>;

export type WebManifestCatalogIndexes = Readonly<{
  byManifestId: Readonly<Record<string, number>>;
  byCanonicalPath: Readonly<Record<string, number>>;
  bySlug: Readonly<Record<string, number>>;
  aliases: Readonly<Record<string, WebManifestCatalogAliasIndexEntry>>;
  sitemapManifestIds: readonly string[];
  hubManifestIds: readonly string[];
}>;

function compareStrings(left: string, right: string): number {
  return left.localeCompare(right);
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

export function normalizeWebManifestCatalogPath(pathname: string): string {
  const trimmed = pathname.trim();
  if (trimmed.length === 0) {
    return "/";
  }
  const withoutQuery = trimmed.split(/[?#]/, 1)[0] ?? trimmed;
  const prefixed = withoutQuery.startsWith("/")
    ? withoutQuery
    : `/${withoutQuery}`;
  const collapsed = prefixed.replace(/\/{2,}/g, "/");
  if (collapsed.length > 1 && collapsed.endsWith("/")) {
    return collapsed.slice(0, -1);
  }
  return collapsed || "/";
}

function isRuntimeAlias(alias: WebRouteAlias): boolean {
  return alias.status === "candidate" || alias.status === "legacy_static";
}

export function buildWebManifestCatalogIndexes(
  manifests: readonly WebPublicationManifest[],
): WebManifestCatalogIndexes {
  const byManifestIdEntries: Array<[string, number]> = [];
  const byCanonicalPathEntries: Array<[string, number]> = [];
  const bySlugEntries: Array<[string, number]> = [];
  const aliasEntries: Array<[string, WebManifestCatalogAliasIndexEntry]> = [];
  const canonicalPathToIndex = new Map<string, number>();
  const manifestIdToIndex = new Map<string, number>();

  manifests.forEach((manifest, manifestIndex) => {
    const canonicalPath = normalizeWebManifestCatalogPath(
      manifest.publication.canonicalPath,
    );
    byManifestIdEntries.push([manifest.manifestId, manifestIndex]);
    byCanonicalPathEntries.push([canonicalPath, manifestIndex]);
    bySlugEntries.push([manifest.route.canonical.slug, manifestIndex]);
    manifestIdToIndex.set(manifest.manifestId, manifestIndex);
    canonicalPathToIndex.set(canonicalPath, manifestIndex);
  });

  manifests.forEach((manifest, manifestIndex) => {
    const canonicalPath = normalizeWebManifestCatalogPath(
      manifest.publication.canonicalPath,
    );
    for (const alias of manifest.aliases) {
      if (!isRuntimeAlias(alias)) {
        continue;
      }
      const fromPath = normalizeWebManifestCatalogPath(alias.fromPath);
      const toPath = normalizeWebManifestCatalogPath(alias.toPath);

      if (fromPath === toPath) {
        throw new Error(`Alias ${fromPath} cannot point to itself.`);
      }
      if (toPath !== canonicalPath) {
        throw new Error(
          `Alias ${fromPath} must target the manifest canonical path ${canonicalPath}.`,
        );
      }
      if (canonicalPathToIndex.has(fromPath)) {
        throw new Error(`Alias ${fromPath} collides with a canonical path.`);
      }
      if (aliasEntries.some(([existingPath]) => existingPath === fromPath)) {
        throw new Error(`Alias ${fromPath} is duplicated in the catalog indexes.`);
      }

      aliasEntries.push([
        fromPath,
        deepFreeze({
          manifestIndex,
          toPath,
          statusCode: WEB_MANIFEST_ALIAS_REDIRECT_STATUS_CODE,
          aliasType: alias.aliasType,
        }),
      ]);
    }
  });

  const sitemapManifestIds = manifests
    .filter((manifest) => manifest.publication.sitemapEligible)
    .map((manifest) => manifest.manifestId);
  const hubManifestIds = manifests
    .filter(
      (manifest) =>
        manifest.publication.renderable && manifest.publication.indexable,
    )
    .map((manifest) => manifest.manifestId);

  return deepFreeze({
    byManifestId: Object.freeze(
      Object.fromEntries(
        byManifestIdEntries.sort((left, right) => compareStrings(left[0], right[0])),
      ),
    ),
    byCanonicalPath: Object.freeze(
      Object.fromEntries(
        byCanonicalPathEntries.sort((left, right) =>
          compareStrings(left[0], right[0]),
        ),
      ),
    ),
    bySlug: Object.freeze(
      Object.fromEntries(
        bySlugEntries.sort((left, right) => compareStrings(left[0], right[0])),
      ),
    ),
    aliases: Object.freeze(
      Object.fromEntries(
        aliasEntries.sort((left, right) => compareStrings(left[0], right[0])),
      ),
    ),
    sitemapManifestIds: deepFreeze(
      sitemapManifestIds
        .filter((manifestId) => manifestIdToIndex.has(manifestId))
        .sort(compareStrings),
    ),
    hubManifestIds: deepFreeze(
      hubManifestIds
        .filter((manifestId) => manifestIdToIndex.has(manifestId))
        .sort(compareStrings),
    ),
  });
}

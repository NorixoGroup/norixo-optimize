import { buildEditorialContentNodes } from "./content-adapter";
import { resolveEditorialLinks } from "./link-resolver";
import { getClusterMappings, getEditorialMappings, validateEditorialMappingRegistry } from "./mapping-registry";
import { photosEditorialMappings } from "./mappings";

function assert(condition: unknown, message: string): asserts condition { if (!condition) throw new Error(message); }

export function runPhotosRelationsSmokeTest(): void {
  const all = getEditorialMappings();
  const nodes = new Set(buildEditorialContentNodes().map((node) => node.id));
  const photos = photosEditorialMappings;
  const photoArticles = buildEditorialContentNodes().filter((node) => node.contentType === "article" && node.id.startsWith("content:article:airbnb-") && photos.some((mapping) => mapping.sourceId === node.id));
  const keys = photos.map((mapping) => `${mapping.type}:${mapping.sourceId}:${mapping.targetId}`);
  assert(validateEditorialMappingRegistry(all).valid, "Registry must remain valid.");
  assert(new Set(keys).size === keys.length, "Photos mappings must not contain duplicates.");
  assert(photos.every((mapping) => nodes.has(mapping.sourceId as never) && (mapping.targetId.startsWith("content:") ? nodes.has(mapping.targetId as never) : true)), "Photos mappings must not be orphaned.");
  assert(photos.every((mapping) => mapping.sourceId !== mapping.targetId), "Photos mappings must not self-link.");
  assert(photos.some((mapping) => mapping.type === "related_to" && mapping.sourceId === "content:article:airbnb-photography" && mapping.targetId === "content:article:airbnb-photo-tips") && photos.some((mapping) => mapping.type === "related_to" && mapping.sourceId === "content:article:airbnb-photo-tips" && mapping.targetId === "content:article:airbnb-photography"), "Photography and Tips reciprocity must remain allowed.");
  assert(!photos.some((mapping) => mapping.type === "supports" && photos.some((other) => other.type === "supports" && other.sourceId === mapping.targetId && other.targetId === mapping.sourceId)), "Supports must not form reciprocal cycles.");
  assert(all.filter((mapping) => mapping.type === "pillar_for" && mapping.targetId === "topic:photos").length === 1, "Photos pillar must remain unique.");
  const links = photoArticles.map((article) => resolveEditorialLinks(article.id));
  assert(links.every((result) => result.length <= 6 && new Set(result.map((link) => link.targetId)).size === result.length), "Resolved links must be unique and capped.");
  assert(getClusterMappings("topic:pricing").length > 0 && getClusterMappings("topic:revenue").length > 0, "Pricing and Revenue must remain intact.");
  const counts = links.map((result) => result.length).sort((a, b) => a - b);
  console.log("Photos relations smoke passed.", { total: photos.length, average: counts.reduce((sum, count) => sum + count, 0) / counts.length, median: counts[Math.floor(counts.length / 2)], min: counts[0], max: counts.at(-1), zero: counts.filter((count) => count === 0).length, saturated: counts.filter((count) => count === 6).length });
}

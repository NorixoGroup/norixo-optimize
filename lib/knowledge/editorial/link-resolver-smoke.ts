import { resolveEditorialLinks } from "./link-resolver";
import { getEditorialMappings } from "./mapping-registry";

function assert(condition: unknown, message: string): asserts condition { if (!condition) throw new Error(message); }

export function runEditorialLinkResolverSmokeTest(): void {
  const before = JSON.stringify(getEditorialMappings());
  const links = resolveEditorialLinks("content:article:airbnb-photo-optimization");
  assert(links.length > 0, "A supported Photos article must resolve links.");
  assert(links.some((link) => link.targetId === "content:guide:airbnb-photo-optimization"), "The Photos pillar must resolve from supports.");
  assert(links.every((link) => link.targetId !== link.sourceId && link.path.startsWith("/")), "Links must be internal and not self-links.");
  assert(new Set(links.map((link) => link.targetId)).size === links.length, "Links must be unique.");
  assert(links.length <= 6, "The maximum link count must be respected.");
  assert(JSON.stringify(resolveEditorialLinks("content:article:airbnb-photo-optimization")) === JSON.stringify(links), "Resolution must be deterministic.");
  assert(resolveEditorialLinks("content:article:missing").length === 0, "An unknown source must resolve no links.");
  assert(JSON.stringify(getEditorialMappings()) === before, "Resolution must not mutate the graph.");
  console.log("Editorial link resolver smoke passed.", { links: links.length });
}

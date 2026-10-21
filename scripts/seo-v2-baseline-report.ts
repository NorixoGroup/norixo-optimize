/**
 * S0 — SEO V2 baseline report (diagnostic only).
 *
 * Measures the CURRENT city x topic architecture before any repair. Read-only:
 * it writes nothing, makes no network call and needs no secret. Output goes to stdout.
 *
 *   npx tsx scripts/seo-v2-baseline-report.ts
 *
 * Scope of the measurement (see also the footer of the report):
 *   - SOURCE DATA   : data/cities.ts, data/localSeo.ts, data/cityTopicContentOverrides.ts
 *   - GENERATORS    : the exported generator and eligibility functions, called directly
 *   - NOT MEASURED  : the HTML rendered by React/Next, the live index state in Google
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

import { cities } from "../data/cities";
import { getCityTopicContentOverride } from "../data/cityTopicContentOverrides";
import { localSeoTopics } from "../data/localSeo";
import { buildLocalSeoMetadata } from "../lib/seo/buildLocalSeoMetadata";
import { getCityTopicQuality } from "../lib/seo/cityTopicQuality";
import {
  getCohort25CityTopicRepairContent,
  getCohort25CityTopicRepairPaths,
} from "../lib/seo/cohort25CityTopicRepair";
import {
  getRegisteredSearchEligibilityPaths,
  getSearchEligibility,
} from "../lib/seo/searchEligibility";
import {
  getGscProtectedCityTopicPaths,
  getSitemapExperimentCityTopicPaths,
  isCityTopicSitemapEligible,
} from "../lib/seo/sitemapEligibility";
import {
  getTargetedCityTopicRepairContent,
  getTargetedCityTopicRepairPaths,
} from "../lib/seo/targetedCityTopicRepair";

type City = (typeof cities)[number];
type Topic = (typeof localSeoTopics)[number];
type RepairShape = {
  heading: string;
  introduction: string;
  sections: readonly { heading: string; body: string }[];
  actionBridge: string;
};

const consistency: { ok: boolean; label: string }[] = [];
function check(label: string, ok: boolean) {
  consistency.push({ ok, label });
}

function title(text: string) {
  console.log(`\n${"=".repeat(78)}\n${text}\n${"=".repeat(78)}`);
}
const pct = (value: number) => `${(value * 100).toFixed(2)} %`;
const cityTopicPath = (city: City, topic: Topic) => `/airbnb-optimizer/${city.slug}/${topic.slug}`;

// ---------------------------------------------------------------------------
// Text helpers
// ---------------------------------------------------------------------------

/**
 * Replaces the city name and the country by ONE fixed location token (longest string first, exact
 * match). A single token keeps the template comparable when the name equals the country
 * (Singapore, Hong Kong), which two distinct tokens would turn into a false extra template.
 */
function normalizeText(text: string, city: City): string {
  const names = [...new Set([city.name, city.country])].sort((a, b) => b.length - a.length);
  let out = text;
  for (const name of names) out = out.split(name).join("XXLOCXX");
  return out.replace(/\s+/g, " ").trim();
}

function repairText(repair: RepairShape): string {
  return [
    repair.heading,
    repair.introduction,
    ...repair.sections.flatMap((section) => [section.heading, section.body]),
    repair.actionBridge,
  ].join(" ");
}

/** Mirrors the static hero paragraph of app/(default)/airbnb-optimizer/[city]/[topic]/page.tsx. */
function heroText(city: City, topic: Topic): string {
  return `${topic.description} This local guide helps hosts understand how to improve Airbnb performance in ${city.name}, ${city.country}.`;
}

/** Word trigrams (lower case, punctuation removed). */
function trigrams(text: string): Set<string> {
  const words = text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .split(" ")
    .filter(Boolean);
  const grams = new Set<string>();
  for (let index = 0; index + 2 < words.length; index += 1) {
    grams.add(`${words[index]} ${words[index + 1]} ${words[index + 2]}`);
  }
  return grams;
}

function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 && b.size === 0) return 1;
  const [small, large] = a.size <= b.size ? [a, b] : [b, a];
  let shared = 0;
  for (const gram of small) if (large.has(gram)) shared += 1;
  return shared / (a.size + b.size - shared);
}

function describe(values: number[]) {
  const sorted = [...values].sort((x, y) => x - y);
  const n = sorted.length;
  const mean = sorted.reduce((sum, value) => sum + value, 0) / n;
  const median = n % 2 === 1 ? sorted[(n - 1) / 2]! : (sorted[n / 2 - 1]! + sorted[n / 2]!) / 2;
  return { n, mean, median, min: sorted[0]!, max: sorted[n - 1]! };
}
const fmt = (d: ReturnType<typeof describe>) =>
  `n=${d.n}  moyenne=${pct(d.mean)}  médiane=${pct(d.median)}  min=${pct(d.min)}  max=${pct(d.max)}`;

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    if (entry === "node_modules" || entry === ".next" || entry.startsWith(".")) continue;
    const full = path.join(dir, entry);
    const stats = statSync(full);
    if (stats.isDirectory()) walk(full, out);
    else if (/\.(ts|tsx)$/.test(entry)) out.push(full);
  }
  return out;
}

// ---------------------------------------------------------------------------
// Preflight: run from the repository root
// ---------------------------------------------------------------------------
const root = process.cwd();
if (!statSync(path.join(root, "data", "cities.ts"), { throwIfNoEntry: false })?.isFile()) {
  console.error("Run this script from the repository root: npx tsx scripts/seo-v2-baseline-report.ts");
  process.exit(2);
}

console.log("NORIXO — S0 baseline V2 (lecture seule, aucune écriture, aucun réseau)");
console.log("Périmètre : données sources + générateurs. Le HTML rendu et l'index Google ne sont PAS mesurés.");

// ---------------------------------------------------------------------------
// Build the 6000-page universe once
// ---------------------------------------------------------------------------
type Page = {
  city: City;
  topic: Topic;
  pathname: string;
  targeted: RepairShape | null;
  cohort25: RepairShape | null;
  hasOverride: boolean;
  renderedSource: "targeted" | "cohort25" | "legacy";
  main: string;
  mainNormalized: string;
  repairNormalized: string;
};

const pages: Page[] = [];
for (const city of cities) {
  for (const topic of localSeoTopics) {
    const targeted = getTargetedCityTopicRepairContent(city, topic) as RepairShape | null;
    const cohort25 = getCohort25CityTopicRepairContent(city, topic) as RepairShape | null;
    // Same priority as page.tsx: targetedRepairContent ?? cohort25RepairContent, else the legacy branch.
    const chosen = targeted ?? cohort25;
    const renderedSource: Page["renderedSource"] = targeted ? "targeted" : cohort25 ? "cohort25" : "legacy";
    const repair = chosen ? repairText(chosen) : "";
    const main = `${heroText(city, topic)} ${repair}`.trim();
    pages.push({
      city,
      topic,
      pathname: cityTopicPath(city, topic),
      targeted,
      cohort25,
      hasOverride: Boolean(getCityTopicContentOverride(city.slug, topic.slug)),
      renderedSource,
      main,
      mainNormalized: normalizeText(main, city),
      repairNormalized: normalizeText(repair, city),
    });
  }
}

// ---------------------------------------------------------------------------
// A — Coverage
// ---------------------------------------------------------------------------
title("A — COUVERTURE (analyse des générateurs)");
const total = pages.length;
const targetedPages = pages.filter((page) => page.targeted !== null).length;
const cohort25Computed = pages.filter((page) => page.cohort25 !== null).length;
const cohort25Rendered = pages.filter((page) => page.renderedSource === "cohort25").length;
const legacyRendered = pages.filter((page) => page.renderedSource === "legacy").length;
const overrides = pages.filter((page) => page.hasOverride).length;
const overrideCities = new Set(pages.filter((page) => page.hasOverride).map((page) => page.city.slug));

const templateGroups = new Map<string, Map<string, number>>(); // topic -> normalized repair -> count
for (const page of pages) {
  const perTopic = templateGroups.get(page.topic.slug) ?? new Map<string, number>();
  perTopic.set(page.repairNormalized, (perTopic.get(page.repairNormalized) ?? 0) + 1);
  templateGroups.set(page.topic.slug, perTopic);
}
const withoutSpecificContent = pages.filter(
  (page) => !page.hasOverride && (templateGroups.get(page.topic.slug)?.get(page.repairNormalized) ?? 0) > 1,
).length;

console.log(`Villes                                      : ${cities.length}`);
console.log(`Sujets                                      : ${localSeoTopics.length}`);
console.log(`Combinaisons ville x sujet                  : ${total}`);
console.log(`Pages dont getTargetedCityTopicRepairContent est non nul : ${targetedPages}`);
console.log(`Chemins explicites TARGETED_CITY_TOPIC_REPAIR_PATHS      : ${getTargetedCityTopicRepairPaths().length}`);
console.log(`Pages dont le contenu cohort25 existe (calculé)          : ${cohort25Computed}`);
console.log(`Chemins COHORT_25 déclarés                               : ${getCohort25CityTopicRepairPaths().length}`);
console.log(`Pages RENDUES depuis cohort25 (targeted ?? cohort25)     : ${cohort25Rendered}`);
console.log(`Pages RENDUES depuis la branche legacy (aucun repair)    : ${legacyRendered}`);
console.log(`Overrides ville x sujet (data/cityTopicContentOverrides) : ${overrides} (${overrideCities.size} villes)`);
console.log(
  `Pages sans contenu spécifique (hors override, texte identique à ≥ 1 autre ville) : ${withoutSpecificContent}`,
);
check("couverture : villes x sujets = pages", cities.length * localSeoTopics.length === total);
check("couverture : targeted + cohort25 + legacy = pages", targetedPages + cohort25Rendered + legacyRendered === total);

// ---------------------------------------------------------------------------
// B — Similarity between cities for the same topic
// ---------------------------------------------------------------------------
title("B — SIMILARITÉ ENTRE VILLES POUR UN MÊME SUJET (analyse des générateurs)");
console.log("Méthode : contenu principal = paragraphe d'introduction de page.tsx + contenu de réparation");
console.log("(titres, navigation, liens et ressources recommandées exclus). Découpage en trigrammes de mots");
console.log("(minuscules, ponctuation retirée). Similarité = indice de Jaccard entre deux ensembles de trigrammes,");
console.log("pour TOUTES les paires de villes d'un même sujet.");
console.log("  - BRUT       : texte tel que rendu (noms de ville et de pays inclus).");
console.log("  - NORMALISÉ  : nom de la ville et du pays remplacés par un jeton fixe avant le calcul.");

const allRaw: number[] = [];
const allNormalized: number[] = [];
const perTopicRows: string[] = [];
const deviating: string[] = [];
for (const topic of localSeoTopics) {
  const topicPages = pages.filter((page) => page.topic.slug === topic.slug);
  const rawGrams = topicPages.map((page) => trigrams(page.main));
  const normalizedGrams = topicPages.map((page) => trigrams(page.mainNormalized));
  const raw: number[] = [];
  const normalized: number[] = [];
  for (let i = 0; i < topicPages.length; i += 1) {
    for (let j = i + 1; j < topicPages.length; j += 1) {
      raw.push(jaccard(rawGrams[i]!, rawGrams[j]!));
      normalized.push(jaccard(normalizedGrams[i]!, normalizedGrams[j]!));
    }
  }
  allRaw.push(...raw);
  allNormalized.push(...normalized);
  const groups = templateGroups.get(topic.slug)!;
  const dominant = [...groups.entries()].sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1))[0]!;
  for (const page of topicPages) {
    if (page.repairNormalized !== dominant[0]) deviating.push(`${topic.slug}:${page.city.slug}`);
  }
  perTopicRows.push(
    `${topic.slug.padEnd(24)} gabarits distincts=${String(groups.size).padStart(2)}  ` +
      `brut moy=${pct(describe(raw).mean)} min=${pct(describe(raw).min)}  normalisé moy=${pct(describe(normalized).mean)}`,
  );
}
console.log(`\nToutes paires (même sujet, villes différentes) :`);
console.log(`  BRUT      ${fmt(describe(allRaw))}`);
console.log(`  NORMALISÉ ${fmt(describe(allNormalized))}`);
const totalTemplates = [...templateGroups.values()].reduce((sum, groups) => sum + groups.size, 0);
console.log(`\nGabarits réellement distincts après normalisation (somme sur les ${localSeoTopics.length} sujets) : ${totalTemplates}`);
console.log(`Pages dont le texte de réparation diffère du gabarit dominant de leur sujet : ${deviating.length}`);
if (deviating.length > 0) console.log(`  ${deviating.slice(0, 12).join(", ")}${deviating.length > 12 ? " …" : ""}`);
console.log("\nPar sujet :");
for (const row of perTopicRows) console.log(`  ${row}`);

// Same-city, different topics (how much the topic changes the text).
const crossTopic: number[] = [];
for (const city of cities) {
  const grams = pages.filter((page) => page.city.slug === city.slug).map((page) => trigrams(page.mainNormalized));
  for (let i = 0; i < grams.length; i += 1) for (let j = i + 1; j < grams.length; j += 1) crossTopic.push(jaccard(grams[i]!, grams[j]!));
}
console.log(`\nMême ville, sujets différents (texte normalisé, toutes villes) : ${fmt(describe(crossTopic))}`);

// Reproduction of the historical measurement (40 first cities, pricing-guide, raw text).
const pricing = pages.filter((page) => page.topic.slug === "pricing-guide").slice(0, 40).map((page) => trigrams(page.main));
const historical: number[] = [];
for (let i = 0; i < pricing.length; i += 1) for (let j = i + 1; j < pricing.length; j += 1) historical.push(jaccard(pricing[i]!, pricing[j]!));
console.log(`Reproduction de la mesure historique (pricing-guide, 40 premières villes, brut) : moyenne=${pct(describe(historical).mean)}  (référence ~88 %, non imposée)`);

console.log("\nÉchantillons (sujet, ville A, ville B) :");
const bySlug = (slug: string) => pages.filter((page) => page.city.slug === slug);
const samples: [string, string, string][] = [
  ["first-photo", "amsterdam", "casablanca"],
  ["pricing-guide", "amsterdam", "casablanca"],
  ["occupancy-guide", "amsterdam", "casablanca"],
  ["pricing-guide", "paris", "tokyo"],
  ["photo-tips", "bali", "reykjavik"],
];
for (const [topicSlug, a, b] of samples) {
  const pa = bySlug(a).find((page) => page.topic.slug === topicSlug);
  const pb = bySlug(b).find((page) => page.topic.slug === topicSlug);
  if (!pa || !pb) continue;
  console.log(
    `  ${topicSlug} | ${a} vs ${b} | brut=${pct(jaccard(trigrams(pa.main), trigrams(pb.main)))} ` +
      `normalisé=${pct(jaccard(trigrams(pa.mainNormalized), trigrams(pb.mainNormalized)))} ` +
      `texte normalisé identique=${pa.mainNormalized === pb.mainNormalized}`,
  );
}
const sampleText = bySlug("amsterdam").find((page) => page.topic.slug === "first-photo");
if (sampleText) console.log(`\n  Extrait normalisé (first-photo) : "${sampleText.mainNormalized.slice(0, 220)}…"`);

// ---------------------------------------------------------------------------
// C — Reliability: figures in data, in generator code, in generated output
// ---------------------------------------------------------------------------
title("C — FIABILITÉ : CHIFFRES ET ANCIENS INDICATEURS");
console.log("Trois niveaux, qui ne se confondent pas :");

console.log("\nC1. Chiffres PRÉSENTS DANS LES DONNÉES (analyse des données sources)");
for (const field of ["avgPrice", "avgRating", "avgPhotos"] as const) {
  const values = cities.map((city) => city[field]).filter((value): value is number => typeof value === "number");
  console.log(`  ${field.padEnd(10)} : définie pour ${values.length}/${cities.length} villes, ${new Set(values).size} valeurs distinctes`);
}
const angleFields = ["marketAngle", "competitionAngle", "pricingAngle", "guestExpectationAngle"] as const;
const digitRegex = /[€$£%]|\d+(?:[.,]\d+)?/g;
let angleDigits = 0;
for (const city of cities) for (const field of angleFields) if (digitRegex.test(city[field] ?? "")) angleDigits += 1;
digitRegex.lastIndex = 0;
console.log(`  Champs d'angle contenant un chiffre ou une devise : ${angleDigits}`);

console.log("\nC2. Références aux anciens indicateurs dans le CODE des générateurs (analyse du code source)");
const seoDirs = ["lib/seo", "app/(default)/airbnb-optimizer", "app/(default)/countries", "components/seo"];
const referencePattern = /\b(avgPrice|avgRating|avgPhotos)\b/;
const references: string[] = [];
for (const dir of seoDirs) {
  const full = path.join(root, dir);
  if (!statSync(full, { throwIfNoEntry: false })?.isDirectory()) continue;
  for (const file of walk(full)) {
    const lines = readFileSync(file, "utf8").split("\n");
    lines.forEach((line, index) => {
      if (/^\s*(\/\/|\*|\/\*)/.test(line)) return;
      if (referencePattern.test(line)) references.push(`${path.relative(root, file)}:${index + 1}`);
    });
  }
}
console.log(`  Lignes de code (hors commentaires) référençant avgPrice/avgRating/avgPhotos : ${references.length}`);
for (const reference of references.slice(0, 12)) console.log(`    ${reference}`);
const builderUsers: string[] = [];
for (const dir of ["app", "lib", "components", "scripts"]) {
  const full = path.join(root, dir);
  if (!statSync(full, { throwIfNoEntry: false })?.isDirectory()) continue;
  for (const file of walk(full)) {
    if (file.endsWith(path.join("lib", "seo", "buildCityContent.ts"))) continue;
    if (file.endsWith("seo-v2-baseline-report.ts")) continue;
    if (readFileSync(file, "utf8").includes("buildCityContent")) builderUsers.push(path.relative(root, file));
  }
}
console.log(`  Fichiers (hors lui-même) qui utilisent buildCityContent : ${builderUsers.length}${builderUsers.length ? " -> " + builderUsers.join(", ") : " (code inutilisé)"}`);

console.log("\nC3. Chiffres RÉELLEMENT PRODUITS par les générateurs (6000 pages, sortie des fonctions, pas le HTML)");
type Hit = { token: string; context: string };
const hitCounts = new Map<string, number>();
let pagesWithDigit = 0;
const scan = (text: string, city: City): boolean => {
  const normalized = normalizeText(text, city);
  let found = false;
  for (const match of normalized.matchAll(/[€$£%]|\d+(?:[.,]\d+)?/g)) {
    found = true;
    const start = Math.max(0, (match.index ?? 0) - 24);
    const hit: Hit = { token: match[0], context: normalized.slice(start, (match.index ?? 0) + match[0].length + 24) };
    const key = `${hit.token} … ${hit.context}`;
    hitCounts.set(key, (hitCounts.get(key) ?? 0) + 1);
  }
  return found;
};
for (const page of pages) {
  const metadata = buildLocalSeoMetadata(page.city, page.topic, getSearchEligibility(page.pathname));
  const meta = `${String(metadata.title ?? "")} ${String(metadata.description ?? "")}`;
  if (scan(`${page.main} ${meta}`, page.city)) pagesWithDigit += 1;
}
console.log(`  Pages dont le texte principal ou les métadonnées contiennent un chiffre/une devise : ${pagesWithDigit}`);
console.log(`  Occurrences distinctes (jeton + contexte) : ${hitCounts.size}`);
for (const [key, count] of [...hitCounts.entries()].sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1)).slice(0, 10)) {
  console.log(`    x${count}  ${key}`);
}
let overrideDigits = 0;
for (const page of pages) {
  const override = getCityTopicContentOverride(page.city.slug, page.topic.slug);
  if (override && /[€$£%]|\d/.test(JSON.stringify(override))) overrideDigits += 1;
}
console.log(`  Overrides contenant un chiffre ou une devise : ${overrideDigits}/${overrides}`);
console.log("  Remarque : un nombre n'est pas assimilé à une statistique ; la liste ci-dessus est à qualifier à la main.");

// ---------------------------------------------------------------------------
// D — Local differentiation
// ---------------------------------------------------------------------------
title("D — DIFFÉRENCIATION LOCALE (analyse des données sources)");
const counts: Record<string, Map<string, number>> = {};
for (const field of angleFields) {
  const map = new Map<string, number>();
  for (const city of cities) {
    const value = city[field];
    if (!value) continue;
    const key = normalizeText(value, city);
    map.set(key, (map.get(key) ?? 0) + 1);
  }
  counts[field] = map;
  const present = [...map.values()].reduce((sum, count) => sum + count, 0);
  const unique = [...map.values()].filter((count) => count === 1).length;
  const max = Math.max(...map.values());
  console.log(
    `${field.padEnd(22)} villes renseignées=${present}  valeurs distinctes après neutralisation=${map.size}  ` +
      `valeurs uniques (1 seule ville)=${unique}  réutilisation maximale=${max} villes`,
  );
}
const distinctiveByAngle = (city: City) =>
  angleFields.some((field) => {
    const value = city[field];
    return value ? counts[field]!.get(normalizeText(value, city)) === 1 : false;
  });
const allUnique = (city: City) =>
  angleFields.every((field) => {
    const value = city[field];
    return value ? counts[field]!.get(normalizeText(value, city)) === 1 : false;
  });
const distinctiveCities = cities.filter(distinctiveByAngle);
console.log(`\nVilles avec au moins un angle unique   : ${distinctiveCities.length}`);
console.log(`Villes avec les quatre angles uniques  : ${cities.filter(allUnique).length}`);
console.log(`Villes sans aucun angle renseigné      : ${cities.filter((city) => !angleFields.some((field) => city[field])).length}`);
console.log(`Villes avec au moins un override       : ${overrideCities.size}`);
const anyDistinctive = cities.filter((city) => distinctiveByAngle(city) || overrideCities.has(city.slug));
console.log(`Villes avec du contenu distinctif (angle unique OU override) : ${anyDistinctive.length}/${cities.length}`);
console.log(`  ${distinctiveCities.map((city) => city.slug).join(", ")}`);
check("différenciation : villes distinctives <= villes", anyDistinctive.length <= cities.length);

// ---------------------------------------------------------------------------
// E — Eligibility
// ---------------------------------------------------------------------------
title("E — ÉLIGIBILITÉ (analyse des générateurs de règles, pas l'index Google)");
const tiers = new Map<string, number>();
let indexCount = 0;
let noindexCount = 0;
let searchEligible = 0;
let sitemapRegistry = 0;
let sitemapFinal = 0;
for (const page of pages) {
  const eligibility = getSearchEligibility(page.pathname);
  tiers.set(eligibility.tier, (tiers.get(eligibility.tier) ?? 0) + 1);
  if (eligibility.indexDirective === "index") indexCount += 1;
  else noindexCount += 1;
  if (eligibility.searchEligible) searchEligible += 1;
  if (eligibility.sitemapEligible) sitemapRegistry += 1;
  if (isCityTopicSitemapEligible(page.pathname)) sitemapFinal += 1;
}
console.log(`Niveaux (tier)                       : ${[...tiers.entries()].sort().map(([tier, count]) => `${tier}=${count}`).join("  ")}`);
console.log(`Directive d'indexation               : index=${indexCount}  noindex=${noindexCount}`);
console.log(`searchEligible                       : ${searchEligible}`);
console.log(`sitemapEligible (registre brut)      : ${sitemapRegistry}`);
console.log(`Éligibles au sitemap (règle finale)  : ${sitemapFinal}`);
check("éligibilité : index + noindex = pages", indexCount + noindexCount === total);
check("éligibilité : somme des niveaux = pages", [...tiers.values()].reduce((sum, count) => sum + count, 0) === total);

const universe = new Set(pages.map((page) => page.pathname));
const registered = getRegisteredSearchEligibilityPaths().filter((candidate) => universe.has(candidate));
const protections: [string, string[]][] = [
  ["GSC_PROTECTED (sitemapEligibility)", [...getGscProtectedCityTopicPaths()]],
  ["SITEMAP_EXPERIMENT (sitemapEligibility)", [...getSitemapExperimentCityTopicPaths()]],
  ["COHORT_25 (cohort25CityTopicRepair)", getCohort25CityTopicRepairPaths()],
  ["TARGETED paths (targetedCityTopicRepair)", getTargetedCityTopicRepairPaths()],
  ["Entrées ville x sujet du registre searchEligibility", registered],
];
const union = new Set<string>();
for (const [label, list] of protections) {
  const inside = list.filter((candidate) => universe.has(candidate));
  inside.forEach((candidate) => union.add(candidate));
  console.log(`  ${label.padEnd(52)} ${String(inside.length).padStart(4)} chemins dans l'univers de ${total}`);
}
console.log(`  Union de tous les registres de protection/exception   ${String(union.size).padStart(4)} pages`);
console.log(`  Pages hors de tout registre (éligibles par défaut)    ${String(total - union.size).padStart(4)} pages`);

const quality = new Map<string, number>();
for (const page of pages) {
  const status = getCityTopicQuality(page.city, page.topic).status;
  quality.set(status, (quality.get(status) ?? 0) + 1);
}
console.log(`Statut cityTopicQuality              : ${[...quality.entries()].sort().map(([status, count]) => `${status}=${count}`).join("  ")}`);

const hubTiers = new Map<string, number>();
for (const city of cities) {
  const eligibility = getSearchEligibility(`/airbnb-optimizer/${city.slug}`);
  hubTiers.set(eligibility.tier, (hubTiers.get(eligibility.tier) ?? 0) + 1);
}
console.log(`Hubs ville (${cities.length}) par niveau        : ${[...hubTiers.entries()].sort().map(([tier, count]) => `${tier}=${count}`).join("  ")}`);

// ---------------------------------------------------------------------------
// F — Scope and consistency
// ---------------------------------------------------------------------------
title("F — PORTÉE RÉELLE DE LA MESURE");
console.log("MESURÉ    : données sources (A, C1, D), sortie directe des générateurs (A, B, C3), règles d'éligibilité (E).");
console.log("NON MESURÉ: HTML effectivement rendu par React/Next (navigation, liens, ressources recommandées,");
console.log("            JSON-LD), état d'indexation réel dans Google, contenu servi en production.");
console.log("            La similarité porte sur le texte généré, pas sur la page complète ; elle n'est pas une");
console.log("            preuve de sanction par un moteur de recherche.");

title("COHÉRENCE DES COMPTEURS");
for (const item of consistency) console.log(`  ${item.ok ? "OK  " : "FAIL"}  ${item.label}`);
if (consistency.some((item) => !item.ok)) process.exit(1);

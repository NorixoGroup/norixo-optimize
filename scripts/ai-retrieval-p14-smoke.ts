import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

import { locales } from "../data/i18n";
import { demoI18n } from "../data/marketing/demoI18n";
import { homeI18n } from "../data/marketing/homeI18n";

async function main() {
  const [about, homeContent, root, homepage, videoSitemap, demoSource] = await Promise.all([
    readFile("app/(default)/about/page.tsx", "utf8"),
    readFile("components/marketing/HomeContent.tsx", "utf8"),
    readFile("app/rootLayoutShared.tsx", "utf8"),
    readFile("app/(default)/page.tsx", "utf8"),
    readFile("app/video-sitemap.xml/route.ts", "utf8"),
    readFile("data/marketing/demoI18n.ts", "utf8"),
  ]);

  assert.ok(about.includes('import { defaultLocale } from "@/data/i18n";'));
  assert.ok(about.includes('buildHreflangAlternates("/about", { locales: [defaultLocale] })'));
  assert.ok(!about.includes('buildHreflangAlternates("/about"),'));

  assert.ok(homeContent.includes("copy.productFacts.heading"));
  assert.ok(homeContent.includes("copy.productFacts.outcomeBoundary"));
  for (const { code } of locales) {
    const facts = homeI18n[code].productFacts;
    assert.ok(facts.heading.trim() && facts.body.trim() && facts.outcomeBoundary.trim());
    assert.equal(facts.facts.length, 6, `${code} must provide six product facts`);
    assert.ok(facts.facts.every((fact) => fact.trim().length > 0));
  }

  for (const [locale, copy] of Object.entries(demoI18n)) {
    assert.ok(!/real example|exemple réel|ejemplo real|echtes beispiel|esempio reale|exemplo real|echt voorbeeld|実例|真实示例|실제 사례|مثال حقيقي/i.test(copy.sampleListing.realExampleBefore), `${locale} retains a real-example claim`);
    assert.ok(!/observed|observé|observado|beobachtet|osservato|observado|waargenomen|観測|观察|관찰|الملاحظ/i.test(copy.optimizationPriorities.resultPreviewTitle));
    assert.ok(!/observed|observé|observado|beobachtet|osservato|observado|waargenomen|観測|观察|관찰|الملاحظ/i.test(copy.photoAnalysis.observedImpact));
    assert.ok(!/measurable improvement|amélioration mesurable|mejora medible|messbare verbesserung|miglioramento misurabile|melhoria mensurável|meetbare verbetering|測定可能|可衡量|측정 가능한|تحسن ملموس/i.test(copy.afterOptimization.measurableBookingImprovement));
  }
  for (const deprecated of ["Real example, before recommendations.", "Impact observed on similar listings", "Measurable improvement in bookings"]) {
    assert.ok(!demoSource.includes(deprecated), `Deprecated demo copy remains: ${deprecated}`);
  }

  assert.ok(!videoSitemap.includes("increase bookings"));
  assert.ok(!videoSitemap.includes("augmentent les réservations"));
  assert.ok(videoSitemap.includes("identifies practical optimization priorities"));
  assert.ok(videoSitemap.includes("identifie des priorités d’optimisation concrètes"));

  for (const source of [about, homeContent, root, homepage, videoSitemap, demoSource]) {
    assert.ok(!/norixo optimize/i.test(source), "Public P14 source introduced an old-brand residual");
  }
  assert.ok(root.includes('"@id": `${siteUrl}/#organization`'));
  assert.ok(homepage.includes('"@type": "WebApplication"'));
  assert.ok(homepage.includes('"@id": `${siteUrl}/#software`'));

  console.log("PASS — AI retrieval P14 smoke");
}

void main();

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

process.env.NEXT_PUBLIC_SUPABASE_URL ??= "http://127.0.0.1:9";
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??= "placeholder-not-a-key";

import { pricingI18n } from "../data/marketing/pricingI18n";
import { getAuditEntryDestinations } from "../lib/guestAudit/entryDestination";

/**
 * /pricing commercial alignment: credits bought one-shot, added to the existing balance, no subscription wording.
 *   npx tsx scripts/pricing-alignment.test.ts
 */
const locales = Object.keys(pricingI18n) as Array<keyof typeof pricingI18n>;
const PAGE = readFileSync("app/(default)/pricing/PricingContent.tsx", "utf8");

const strings = (value: unknown, path = ""): Array<[string, string]> =>
  typeof value === "string"
    ? [[path, value]]
    : value && typeof value === "object"
      ? Object.entries(value).flatMap(([k, v]) => strings(v, `${path}.${k}`))
      : [];

test("English copy uses the required wording", () => {
  const en = pricingI18n.en;
  assert.equal(`${en.hero.titleLine1} ${en.hero.titleLine2}`, "Flexible audit credits. No subscription.");
  assert.equal(en.hero.subtitle, "Buy 1, 5 or 15 audit credits whenever you need them. Each purchase adds to your existing balance.");
  assert.ok(en.plans[0].features.includes("Listing conversion analysis"));
  assert.equal(en.cta.reassurance, "One-time payment • No subscription");
  assert.equal(en.hero.volumeFlexNote, "Buy more audit credits whenever you need them.");
});

test("French copy is localised and consistent", () => {
  const fr = pricingI18n.fr;
  assert.equal(`${fr.hero.titleLine1} ${fr.hero.titleLine2}`, "Crédits d’audit flexibles. Sans abonnement.");
  assert.match(fr.hero.subtitle, /s’ajoute à votre solde existant/);
  assert.equal(fr.cta.reassurance, "Paiement unique • Sans abonnement");
  assert.ok(!fr.plans[0].features.some((f) => /immédiate/i.test(f)));
  assert.ok(!/passer au pack|Passer au pack/.test(fr.plans[1].cta));
});

test("no locale suggests a plan switch, an upgrade obligation or an immediate result in the changed fields", () => {
  for (const l of locales) {
    const c = pricingI18n[l];
    for (const [path, text] of [
      ["subtitle", c.hero.subtitle], ["comparisonHelper", c.hero.comparisonHelper], ["volumeFlexNote", c.hero.volumeFlexNote],
      ["ctaSubtitle", c.cta.subtitle], ["reassurance", c.cta.reassurance], ["plans0", c.plans[0].features.join(" ")],
    ] as const) {
      assert.ok(!/switch to|move to a more|passez sur|passer sur un pack|wechseln Sie anschlie|pasa después|passe para um|stap daarna over|切り替え|切换到|전환하세요|انتقل إلى باقة/i.test(text), `${l} ${path}: ${text}`);
      assert.ok(!/immediate|immédiat|inmediat|sofort|immediat|imediat|direct resultaat|direct inzicht|即时|立即|すぐに結果|즉시|فورية|فورية/i.test(text), `${l} ${path}: ${text}`);
    }
  }
});

test("all locales carry the new model (one-time, no subscription) and no language is mixed into another", () => {
  const en = pricingI18n.en;
  for (const l of locales) {
    if (l === "en") continue;
    const c = pricingI18n[l];
    for (const key of ["subtitle", "comparisonHelper", "volumeFlexNote"] as const) {
      assert.notEqual(c.hero[key], en.hero[key], `${l} hero.${key} still English`);
    }
    assert.notEqual(c.hero.titleLine1, en.hero.titleLine1, l);
    assert.notEqual(c.cta.reassurance, en.cta.reassurance, l);
    assert.notEqual(c.plans[0].features[1], en.plans[0].features[1], l);
    assert.ok(!/\bsubscription\b|\bcredits\b/i.test([c.hero.titleLine1, c.hero.titleLine2, c.hero.subtitle, c.cta.reassurance].join(" ")), `${l} contains English words`);
  }
});

test("prices, credit counts and displayed savings are unchanged / arithmetically true", () => {
  for (const l of locales) {
    const c = pricingI18n[l];
    assert.match(c.plans[0].price, /9/); assert.match(c.plans[1].price, /39/); assert.match(c.plans[2].price, /99/);
    assert.match(c.plans[1].period, /5/); assert.match(c.plans[2].period, /15/);
  }
  // 5 x 9 - 39 = 6 and 15 x 9 - 99 = 36 (the former "~13" for Pro was wrong)
  assert.equal(5 * 9 - 39, 6);
  assert.equal(15 * 9 - 99, 36);
  for (const l of locales) {
    assert.match(pricingI18n[l].plans[1].savings, /6/, l);
    assert.ok(!/13/.test(pricingI18n[l].plans[1].savings), l);
    assert.match(pricingI18n[l].plans[2].savings, /36/, l);
  }
});

test("the three offers keep their destination and nothing is bought automatically", () => {
  assert.match(PAGE, /offer: "audit_test"/); assert.match(PAGE, /offer: "pack_5"/); assert.match(PAGE, /offer: "pack_15"/);
  assert.ok(!/restored=1|\/audit\/new|guest-audit/.test(PAGE), "no link back to the disabled guest journey");
  assert.ok(!/fetch\(|api\/stripe|window\.location/.test(PAGE), "the page never starts a checkout itself");
  for (const [offer, plan] of [["audit_test", "starter"], ["pack_5", "pro"], ["pack_15", "scale"]] as const) {
    assert.equal(getAuditEntryDestinations({ isAuthenticated: true, offer }).billingHref, `/dashboard/billing?offer=${offer}`, plan);
    assert.equal(getAuditEntryDestinations({ isAuthenticated: false, offer }).billingHref, `/sign-in?next=${encodeURIComponent(`/dashboard/billing?offer=${offer}`)}`, plan);
  }
  assert.match(PAGE, /getAuditEntryDestinations\(\{ isAuthenticated \}\)\.billingHref/, "bottom CTA");
  const billing = readFileSync("app/(default)/dashboard/billing/page.tsx", "utf8");
  assert.match(billing, /preselectedOffer === "audit_test" \? "starter" : preselectedOffer === "pack_5" \? "pro" : preselectedOffer === "pack_15" \? "scale"/);
});

test("sanity: every locale keeps the same structure (keys) as English", () => {
  const keys = (v: unknown, p = ""): string[] => (v && typeof v === "object" ? Object.entries(v).flatMap(([k, x]) => keys(x, `${p}.${k}`)) : [p]);
  const base = keys(pricingI18n.en).sort();
  for (const l of locales) assert.deepEqual(keys(pricingI18n[l]).sort(), base, l);
  assert.ok(strings(pricingI18n.en).length > 50);
});

// ---- /dashboard/billing copy (source text of the page dictionary; the page is a client component and is not importable) ----
const BILLING = readFileSync("app/(default)/dashboard/billing/page.tsx", "utf8");
const BILLING_COPY = BILLING.slice(BILLING.indexOf("const billingCopy = {"), BILLING.indexOf("const billingCopy = {") + 80_000);

test("billing copy: no immediate-result wording, no forced upgrade, no 'offer ceiling'", () => {
  for (const banned of [
    "Immediate conversion reading", "Lecture conversion immédiate", "Lectura inmediata de conversión", "Sofortige Conversion-Auswertung",
    "Lettura immediata della conversione", "Leitura imediata da conversão", "Onmiddellijke conversie-inzichten", "即時コンバージョン診断",
    "即时转化解读", "즉시 전환 진단", "قراءة تحويل فورية",
    "Passez à l’offre supérieure", "Move to the next offer", "Pasa a la oferta superior", "Wechsle zum nächsten Angebot", "Passa all’offerta superiore",
    "Passe para a oferta superior", "Stap over naar het hogere aanbod", "上位オファーへ切り替え", "升级到更高方案", "상위 오퍼로 전환", "انتقل إلى العرض الأعلى",
    "offer ceiling", "plafond de votre offre", "will arrive in a few seconds", "arriveront dans quelques secondes", "arrivent dans quelques secondes",
  ]) assert.ok(!BILLING_COPY.includes(banned), `still present: ${banned}`);
  assert.equal((BILLING_COPY.match(/Listing conversion analysis/g) ?? []).length, 4, "top + Starter + Pro + Scale in English");
  assert.equal((BILLING_COPY.match(/"Analyse de conversion de l’annonce"/g) ?? []).length, 4, "French");
});

test("billing and pricing use the same model sentence (EN/FR) and a neutral buy-more vocabulary", () => {
  assert.match(BILLING_COPY, /Buy 1, 5 or 15 audit credits whenever you need them\. Each purchase adds to your existing balance\./);
  assert.match(BILLING_COPY, /Achetez 1, 5 ou 15 crédits d’audit quand vous en avez besoin\. Chaque achat s’ajoute à votre solde existant\./);
  assert.ok(pricingI18n.en.hero.subtitle.startsWith("Buy 1, 5 or 15 audit credits whenever you need them. Each purchase adds to your existing balance."));
  assert.match(BILLING_COPY, /Buy more audit credits whenever you need them\./);
  assert.match(BILLING_COPY, /Achetez des crédits d’audit supplémentaires quand vous en avez besoin\./);
  // balance text no longer shows a remaining/total ratio tied to one offer
  assert.ok(!/\{remaining\}\/\{total\}/.test(BILLING_COPY));
});

test("billing: prices, quantities and checkout wiring untouched", () => {
  assert.match(BILLING, /const auditTestTotalPrice = 9;/);
  assert.match(BILLING, /proPlan\?\.monthly \?\? 39/);
  assert.match(BILLING, /scalePlan\?\.monthly \?\? 99/);
  assert.match(BILLING, /OFFER_CREDIT_TOTALS\.pro/);
  assert.ok(!/restored=1|\/audit\/new/.test(BILLING.replace(/\/\/.*$/gm, "")), "billing never links back to the entry page");
  assert.equal((BILLING.match(/\/api\/stripe\/checkout/g) ?? []).length >= 1, true);
});

test("pricing case study is labelled illustrative in every language, with no customer claim", () => {
  const expected: Record<string, string> = { en: "ILLUSTRATIVE EXAMPLE", fr: "EXEMPLE ILLUSTRATIF" };
  for (const l of locales) {
    const c = pricingI18n[l].caseStudy;
    if (expected[l]) assert.equal(c.eyebrow, expected[l]);
    assert.ok(!/REAL CASE|CAS RÉEL|CASO REAL|ECHTER FALL|CASO REALE|PRAKTIJKVOORBEELD|実例|真实案例|실제 사례|حالة واقعية/.test(c.eyebrow), `${l}: ${c.eyebrow}`);
    assert.ok(!/client case|cas client|caso de cliente|caso cliente|Kundenfall|klantcase|顧客事例|客户案例|고객 사례|حالة عميل/i.test(c.note), `${l}: ${c.note}`);
  }
  assert.equal(pricingI18n.en.caseStudy.before.length, 2);
  assert.equal(pricingI18n.en.caseStudy.after.length, 3);
});

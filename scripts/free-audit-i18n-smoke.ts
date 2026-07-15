import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { FREE_AUDIT_PLATFORM_OPTIONS, FREE_AUDIT_PROPERTY_TYPE_OPTIONS } from "../app/free-audit/freeAuditPageModel";
import { freeAuditTranslations, getFreeAuditSeoCopy } from "../app/free-audit/freeAuditTranslations";
import { defaultLocale, locales, type Locale } from "../data/i18n";
import { buildLocalizedUrl } from "../lib/seo/seoUrls";

function assertSameShape(reference: unknown, candidate: unknown, path = "root"): void {
  if (typeof reference === "string") {
    if (typeof candidate !== "string") {
      assert.fail(`Expected string at ${path}`);
    }
    assert.notEqual(candidate.trim(), "", `Expected non-empty string at ${path}`);
    return;
  }

  if (Array.isArray(reference)) {
    if (!Array.isArray(candidate)) {
      assert.fail(`Expected array at ${path}`);
    }
    assert.equal(candidate.length, reference.length, `Array length mismatch at ${path}`);
    for (let index = 0; index < reference.length; index += 1) {
      assertSameShape(reference[index], candidate[index], `${path}[${index}]`);
    }
    return;
  }

  if (reference == null || typeof reference !== "object") {
    assert.fail(`Expected object at ${path}`);
  }
  if (candidate == null || typeof candidate !== "object") {
    assert.fail(`Expected object at ${path}`);
  }

  const referenceObject = reference as Record<string, unknown>;
  const candidateObject = candidate as Record<string, unknown>;
  const referenceKeys = Object.keys(referenceObject).sort();
  const candidateKeys = Object.keys(candidateObject).sort();
  assert.deepEqual(candidateKeys, referenceKeys, `Object keys mismatch at ${path}`);

  for (const key of referenceKeys) {
    assertSameShape(
      referenceObject[key],
      candidateObject[key],
      `${path}.${key}`,
    );
  }
}

function readWorkspaceFile(relativePath: string): string {
  return readFileSync(resolve(process.cwd(), relativePath), "utf8");
}

const ENGLISH_PREMIUM_STRINGS = [
  "What your full audit will reveal",
  "The free preview shows the market. The full audit analyzes your actual listing.",
  "Your real position",
  "Compare your listing to competitors in your market and identify your exact positioning.",
  "Your pricing potential",
  "Discover price levels adapted to your property, your season and your competitive environment.",
  "Your conversion levers",
  "Analyze your title, description, photos, amenities and the elements slowing bookings down.",
  "Your priority actions",
  "Receive a clear action plan ranked by likely impact on your performance.",
  "Your journey with Norixo",
  "Free market preview",
  "Discover the observed range and the market median.",
  "Complete listing analysis",
  "Norixo analyzes your content, competitors and positioning.",
  "Personalized action plan",
  "Receive concrete prioritized recommendations.",
  "Unlock my full audit",
] as const;

const ENGLISH_REFERENCE_STRINGS = [
  "What you will discover",
  "Complete the form to display the preview currently available for this market.",
  "Preparing your market preview",
  "Norixo is assembling the aggregated market signals currently available for this category.",
  "No data extraction",
  "Free market preview",
  "Unlock my full audit",
] as const;

const FORBIDDEN_LOCALE_FRAGMENTS: Partial<Record<Locale, readonly string[]>> = {
  es: [
    "Descubre una vista tarifaria basada solo en el mercado",
    "Apercu du marche",
    "Voir mon analyse gratuite",
  ],
  it: [
    "Guadagnare un prezzo panoramico",
    "Scopri una panoramica prezzi basata solo sul mercato",
    "L'anteprima gratuita non e temporaneamente disponibile.",
  ],
  ar: [
    "scraping",
    "What your",
    "Unlock my",
    "Free market",
    "عرض تحليلي المجاني",
  ],
};

async function main() {
  process.env.NEXT_PUBLIC_SUPABASE_URL ??= "https://example.supabase.co";
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??=
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.test.payload";

  const { metadata: rootFreeAuditMetadata } = await import("../app/free-audit/page");
  const { generateMetadata: generateLocalizedFreeAuditMetadata } = await import(
    "../app/[locale]/free-audit/page"
  );

  const supportedLocales = locales.map((entry) => entry.code);
  const translationLocales = Object.keys(freeAuditTranslations).sort();

  assert.deepEqual(translationLocales, [...supportedLocales].sort());

  const english = freeAuditTranslations.en;
  assert.equal(defaultLocale, "en");

  for (const locale of supportedLocales) {
    assert.equal(locale in freeAuditTranslations, true, `Missing locale ${locale}`);
    assertSameShape(english, freeAuditTranslations[locale], locale);
    if (locale !== "en") {
      assert.notEqual(freeAuditTranslations[locale], english);
    }
  }

  assert.deepEqual(Object.keys(english.options.platform).sort(), [...FREE_AUDIT_PLATFORM_OPTIONS].sort());
  assert.deepEqual(
    Object.keys(english.options.propertyType).sort(),
    [...FREE_AUDIT_PROPERTY_TYPE_OPTIONS].sort(),
  );

  assert.equal(
    freeAuditTranslations.en.hero.title,
    "Discover a market-only pricing snapshot",
  );
  assert.equal(
    freeAuditTranslations.en.form.title,
    "Structured market preview",
  );
  assert.equal(
    freeAuditTranslations.en.result.initialTitle,
    "Your preview will appear here.",
  );
  assert.equal(
    freeAuditTranslations.en.form.platformPlaceholder,
    "Select a platform",
  );
  assert.equal(
    freeAuditTranslations.en.form.propertyTypePlaceholder,
    "Select a property type",
  );
  assert.equal(
    freeAuditTranslations.en.form.submitIdle,
    "See my free analysis",
  );
  assert.equal(
    freeAuditTranslations.en.hero.reassurance,
    "No credit card. No data extraction. No listing content or personal price is reviewed at this stage.",
  );
  assert.equal(
    freeAuditTranslations.en.result.initialGuideTitle,
    "What you will discover",
  );
  assert.equal(freeAuditTranslations.en.result.initialGuideItems.length, 3);
  assert.equal(
    freeAuditTranslations.en.result.submittingTitle,
    "Preparing your market preview",
  );
  assert.equal(
    freeAuditTranslations.en.result.initialPrompt,
    "Complete the form to display the preview currently available for this market.",
  );
  assert.equal(
    freeAuditTranslations.en.premium.revealTitle,
    "What your full audit will reveal",
  );
  assert.equal(
    freeAuditTranslations.en.premium.unlockCta,
    "Unlock my full audit",
  );
  assert.equal(freeAuditTranslations.en.premium.revealCards.length, 4);
  assert.equal(freeAuditTranslations.en.premium.journeySteps.length, 3);

  for (const locale of supportedLocales.filter((entry) => entry !== "en")) {
    const serializedLocale = JSON.stringify(freeAuditTranslations[locale]).toLowerCase();

    assert.notEqual(
      freeAuditTranslations[locale].hero.title,
      freeAuditTranslations.en.hero.title,
      `Unexpected English fallback in ${locale}.hero.title`,
    );
    assert.notEqual(
      freeAuditTranslations[locale].form.submitIdle,
      freeAuditTranslations.en.form.submitIdle,
      `Unexpected English fallback in ${locale}.form.submitIdle`,
    );
    assert.equal(
      freeAuditTranslations[locale].result.initialGuideItems.length,
      freeAuditTranslations.en.result.initialGuideItems.length,
      `Unexpected initial guide item count in ${locale}`,
    );
    assert.notEqual(
      freeAuditTranslations[locale].result.initialGuideTitle,
      freeAuditTranslations.en.result.initialGuideTitle,
      `Unexpected English fallback in ${locale}.result.initialGuideTitle`,
    );
    assert.notEqual(
      freeAuditTranslations[locale].result.submittingTitle,
      freeAuditTranslations.en.result.submittingTitle,
      `Unexpected English fallback in ${locale}.result.submittingTitle`,
    );
    assert.notEqual(
      freeAuditTranslations[locale].result.submittingText,
      freeAuditTranslations.en.result.submittingText,
      `Unexpected English fallback in ${locale}.result.submittingText`,
    );

    const premiumStrings: string[] = [
      freeAuditTranslations[locale].premium.revealTitle,
      freeAuditTranslations[locale].premium.revealSubtitle,
      ...freeAuditTranslations[locale].premium.revealCards.flatMap((card) => [
        card.title,
        card.text,
      ]),
      freeAuditTranslations[locale].premium.journeyTitle,
      ...freeAuditTranslations[locale].premium.journeySteps.flatMap((step) => [
        step.title,
        step.text,
      ]),
      freeAuditTranslations[locale].premium.unlockCta,
    ];

    for (const englishString of ENGLISH_PREMIUM_STRINGS) {
      assert.equal(
        premiumStrings.includes(englishString),
        false,
        `Unexpected English premium copy in ${locale}: ${englishString}`,
      );
    }

    for (const englishString of ENGLISH_REFERENCE_STRINGS) {
      assert.equal(
        JSON.stringify(freeAuditTranslations[locale]).includes(englishString),
        false,
        `Unexpected English reference copy in ${locale}: ${englishString}`,
      );
    }

    assert.equal(
      serializedLocale.includes("scraping"),
      false,
      `Unexpected scraping wording in ${locale}`,
    );

    for (const forbiddenFragment of FORBIDDEN_LOCALE_FRAGMENTS[locale] ?? []) {
      assert.equal(
        JSON.stringify(freeAuditTranslations[locale]).includes(forbiddenFragment),
        false,
        `Unexpected legacy fragment in ${locale}: ${forbiddenFragment}`,
      );
    }
  }

  const arabicPremiumSample = [
    freeAuditTranslations.ar.form.submitIdle,
    freeAuditTranslations.ar.premium.revealTitle,
    freeAuditTranslations.ar.premium.revealSubtitle,
    freeAuditTranslations.ar.result.initialGuideTitle,
    freeAuditTranslations.ar.premium.unlockCta,
  ].join(" ");
  assert.match(arabicPremiumSample, /[\u0600-\u06FF]/, "Arabic premium copy must contain Arabic characters");

  const i18nProviderSource = readWorkspaceFile("components/i18n/I18nProvider.tsx");
  assert.equal(i18nProviderSource.includes('firstSegment === "ar" ? "rtl" : "ltr"'), true);

  const freeAuditContentSource = readWorkspaceFile("app/free-audit/FreeAuditContent.tsx");
  for (const englishString of ENGLISH_PREMIUM_STRINGS) {
    assert.equal(
      freeAuditContentSource.includes(englishString),
      false,
      `FreeAuditContent.tsx still contains hardcoded premium copy: ${englishString}`,
    );
  }
  assert.equal(
    freeAuditContentSource.includes("const PREVIEW_UI_LABELS"),
    false,
    "FreeAuditContent.tsx should not keep preview label dictionaries",
  );
  assert.equal(
    freeAuditContentSource.includes("const FULL_AUDIT_REVEAL_COPY"),
    false,
    "FreeAuditContent.tsx should not keep reveal copy dictionaries",
  );
  assert.equal(
    freeAuditContentSource.includes('const isRtl = locale === "ar";'),
    true,
    "FreeAuditContent.tsx should derive RTL mode from locale",
  );
  assert.equal(
    freeAuditContentSource.includes("copy.result.initialGuideTitle"),
    true,
    "FreeAuditContent.tsx should render the localized initial guide state",
  );
  assert.equal(
    freeAuditContentSource.includes("copy.result.submittingTitle"),
    true,
    "FreeAuditContent.tsx should render the localized submitting state",
  );
  assert.equal(
    freeAuditContentSource.includes("copy.result.initialPrompt"),
    true,
    "FreeAuditContent.tsx should render the localized initial prompt",
  );
  assert.equal(
    freeAuditContentSource.includes("copy.result.submittingText"),
    true,
    "FreeAuditContent.tsx should render the localized submitting text",
  );
  assert.equal(
    freeAuditContentSource.includes("xl:items-start"),
    true,
    "FreeAuditContent.tsx should keep the tightened desktop alignment",
  );
  assert.equal(
    freeAuditContentSource.includes('dir="ltr"'),
    true,
    "FreeAuditContent.tsx should preserve LTR numeric gauge rendering",
  );
  assert.equal(
    freeAuditContentSource.includes('isRtl ? "right-[1.55rem]" : "left-[1.55rem]"'),
    true,
    "FreeAuditContent.tsx should keep the RTL timeline spine adjustment",
  );

  const englishSeo = getFreeAuditSeoCopy("en");
  assert.equal(rootFreeAuditMetadata.title, englishSeo.title);
  assert.equal(rootFreeAuditMetadata.description, englishSeo.description);

  for (const locale of supportedLocales.filter((entry): entry is Exclude<Locale, "en"> => entry !== "en")) {
    const localizedMetadata = await generateLocalizedFreeAuditMetadata({
      params: Promise.resolve({ locale }),
    });
    const seoCopy = getFreeAuditSeoCopy(locale);

    assert.equal(localizedMetadata.title, seoCopy.title);
    assert.equal(localizedMetadata.description, seoCopy.description);
    assert.equal(localizedMetadata.alternates?.canonical, buildLocalizedUrl("/free-audit", locale));
    assert.equal(
      localizedMetadata.alternates?.languages?.[locale],
      buildLocalizedUrl("/free-audit", locale),
    );
    assert.equal(
      localizedMetadata.alternates?.languages?.["x-default"],
      "https://norixo.io",
    );
  }

  console.log("PASS — Free audit i18n smoke");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

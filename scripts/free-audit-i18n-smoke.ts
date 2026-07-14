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

  for (const locale of supportedLocales.filter((entry) => entry !== "en")) {
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
  }

  const i18nProviderSource = readWorkspaceFile("components/i18n/I18nProvider.tsx");
  assert.equal(i18nProviderSource.includes('firstSegment === "ar" ? "rtl" : "ltr"'), true);

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

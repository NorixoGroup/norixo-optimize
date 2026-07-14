import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { metadata as rootFreeAuditMetadata } from "../app/free-audit/page";
import { generateMetadata as generateLocalizedFreeAuditMetadata } from "../app/[locale]/free-audit/page";
import { buildLocalizedPath } from "../lib/seo/seoUrls";

function readWorkspaceFile(relativePath: string): string {
  return readFileSync(resolve(process.cwd(), relativePath), "utf8");
}

async function main() {
  assert.equal(buildLocalizedPath("/free-audit", "en"), "/free-audit");
  assert.equal(buildLocalizedPath("/free-audit", "fr"), "/fr/free-audit");
  assert.equal(buildLocalizedPath("/free-audit", "es"), "/es/free-audit");
  assert.equal(buildLocalizedPath("/free-audit", "ar"), "/ar/free-audit");

  const proxySource = readWorkspaceFile("proxy.ts");
  assert.equal(proxySource.includes('"/free-audit"'), true);
  assert.equal(proxySource.includes('"free-audit"'), true);

  const sitemapSource = readWorkspaceFile("app/sitemap.ts");
  assert.equal(sitemapSource.includes('"/free-audit"'), true);

  const howItWorksSource = readWorkspaceFile("app/how-it-works/page.tsx");
  assert.equal(howItWorksSource.includes('primaryActionHref="/free-audit"'), true);
  assert.equal(howItWorksSource.includes("/api/guest-audit"), false);
  assert.equal(howItWorksSource.includes('primaryActionHref="/audit/new"'), false);

  const localizedHowItWorksSource = readWorkspaceFile("app/[locale]/how-it-works/page.tsx");
  assert.equal(
    localizedHowItWorksSource.includes('primaryActionHref={buildLocalizedPath("/free-audit", locale)}'),
    true,
  );
  assert.equal(localizedHowItWorksSource.includes("/api/guest-audit"), false);

  assert.equal(rootFreeAuditMetadata.alternates?.canonical, "https://norixo.io/free-audit");
  assert.equal(
    rootFreeAuditMetadata.alternates?.languages?.["x-default"],
    "https://norixo.io",
  );

  const localizedMetadata = await generateLocalizedFreeAuditMetadata({
    params: Promise.resolve({ locale: "fr" }),
  });
  assert.equal(localizedMetadata.alternates?.canonical, "https://norixo.io/fr/free-audit");
  assert.equal(
    localizedMetadata.alternates?.languages?.fr,
    "https://norixo.io/fr/free-audit",
  );
  assert.equal(
    localizedMetadata.alternates?.languages?.["x-default"],
    "https://norixo.io",
  );

  console.log("PASS — Free audit marketing routing smoke");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

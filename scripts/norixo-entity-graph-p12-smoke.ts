import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

function occurrences(source: string, value: string) {
  return source.split(value).length - 1;
}

async function main() {
  const [root, homepage, freeAudit, guides, llms] = await Promise.all([
    readFile("app/rootLayoutShared.tsx", "utf8"),
    readFile("app/(default)/page.tsx", "utf8"),
    readFile("app/(default)/free-audit/page.tsx", "utf8"),
    readFile("app/(default)/guides/[guide]/page.tsx", "utf8"),
    readFile("public/llms.txt", "utf8"),
  ]);

  for (const value of [
    '"@type": "Organization"',
    '"@id": `${siteUrl}/#organization`',
    'name: "Norixo"',
    "description: defaultDescription",
    "legalName: legalI18n.en.companyNameValue",
    "contactPoint: {",
    "address: {",
    "https://www.linkedin.com/company/norixo-io/",
    "https://www.instagram.com/norixo.io/",
    "https://www.facebook.com/people/Norixo/61591109797778/",
    "https://github.com/NorixoGroup",
  ]) {
    assert.ok(root.includes(value), `Missing Organization contract: ${value}`);
  }

  assert.equal(occurrences(homepage, '"@id": `${siteUrl}/#software`'), 1, "Homepage must define #software exactly once.");
  for (const value of [
    '"@type": "WebApplication"',
    '"@id": `${siteUrl}/#software`',
    'name: "Norixo"',
    "url: siteUrl",
    "description: pageDescription",
    "provider: {",
    "brand: {",
  ]) {
    assert.ok(homepage.includes(value), `Missing primary product contract: ${value}`);
  }

  for (const value of [
    'about: { "@id": `${siteUrl}/#software` }',
    'mainEntity: { "@id": `${siteUrl}/#software` }',
  ]) {
    assert.ok(freeAudit.includes(value), `Missing Free Audit reference: ${value}`);
  }
  assert.ok(guides.includes('mentions: { "@id": "https://norixo.io/#software" }'), "Missing guide #software reference.");

  for (const url of [
    "https://norixo.io/about",
    "https://norixo.io/free-audit",
    "https://norixo.io/tools",
    "https://norixo.io/reports",
  ]) {
    assert.equal(occurrences(llms, url), 1, `Expected exactly one LLM discovery link: ${url}`);
  }

  console.log("PASS — Norixo entity graph P12 smoke");
}

void main();

import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

async function main(): Promise<void> {
  const source = await readFile("app/(default)/dashboard/backlinks/page.tsx", "utf8");

  assert.match(source, /activeSection === "links" \? <button type="button" onClick=\{\(\) => openEditor\(activeSection, row\)\}/);
  assert.match(source, /className="rounded-full border border-slate-300 px-3 py-1 text-sm font-semibold text-slate-700">Modifier<\/button>/);
  assert.match(source, /\{ key: "target_url", label: "URL Norixo cible", type: "url" \}/);
  assert.match(source, /<button type="button" onClick=\{\(\) => void handleVerifyLink\(row\.id\)\}/);
  assert.doesNotMatch(source, /activeSection === "links" \? <button type="button" onClick=\{\(\) => openEditor\(activeSection, null\)\}/);

  console.info("PASS — Backlink link edit UI smoke");
}

void main();

import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

async function main(): Promise<void> {
  const source = await readFile("app/(default)/dashboard/backlinks/page.tsx", "utf8");

  assert.match(source, /activeSection === "links" \? <button type="button" onClick=\{\(\) => openEditor\(activeSection, row\)\}/);
  assert.match(source, /className="rounded-full border border-slate-300 px-3 py-1 text-sm font-semibold text-slate-700">Modifier<\/button>/);
  assert.match(source, /\{ key: "target_url", label: "URL Norixo cible", type: "url" \}/);
  assert.match(source, /<button type="button" onClick=\{\(\) => void handleVerifyLink\(row\.id\)\}/);
  assert.match(source, /const \[editorFieldValues, setEditorFieldValues\] = useState<Record<string, string>>\(\{\}\);/);
  assert.match(source, /const handleEditorFieldInteraction = \(target: EventTarget \| null\) =>/);
  assert.match(source, /onChange=\{\(event\) => handleEditorFieldInteraction\(event\.target\)\} onBlur=\{\(event\) => handleEditorFieldInteraction\(event\.target\)\}/);
  assert.match(source, /<select name="outreach_id" required disabled=\{pages\.outreach\.items\.length === 0\} value=\{editorFieldValue\(field\.key\)\}/);
  assert.match(source, /<select name="domain_id" required disabled=\{pages\.domains\.items\.length === 0\} value=\{editorFieldValue\(field\.key\)\}/);
  assert.doesNotMatch(source, /activeSection === "links" \? <button type="button" onClick=\{\(\) => openEditor\(activeSection, null\)\}/);

  console.info("PASS — Backlink link edit UI smoke");
}

void main();

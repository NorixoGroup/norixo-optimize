import { readFile } from "node:fs/promises";

function assert(condition: boolean, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

async function main(): Promise<void> {
  const pageSource = await readFile("app/(default)/dashboard/backlinks/page.tsx", "utf8");
  let componentSource = "";
  let lifecycleTypesSource = "";
  let labelsSource = "";
  try {
    componentSource = await readFile(
      "app/(default)/dashboard/backlinks/_components/AssetLifecycleStatusField.tsx",
      "utf8",
    );
    lifecycleTypesSource = await readFile(
      "app/(default)/dashboard/backlinks/_components/asset-lifecycle-types.ts",
      "utf8",
    );
    labelsSource = await readFile(
      "app/(default)/dashboard/backlinks/_utils/backlink-labels.ts",
      "utf8",
    );
  } catch (e) {
    // component may still be in page.tsx during intermediate states
  }
  const source =
    pageSource +
    "\n" +
    componentSource +
    "\n" +
    lifecycleTypesSource +
    "\n" +
    labelsSource;

  for (const required of [
    "AssetLifecycleStatusField",
    'editor?.section === "assets" && editor.row != null',
    'id="asset-lifecycle-status"',
    'name="lifecycle_status"',
    "value={value}",
    "disabled={disabled}",
    "isBacklinkAssetLifecycleStatus(value)",
    "body.lifecycle_status = assetLifecycleStatus",
    'value: "draft", label: "Brouillon"',
    'value: "eligible", label: "Éligible"',
    'value: "active", label: "Actif"',
    'value: "paused", label: "En pause"',
    'value: "archived", label: "Archivé"',
    "assetLifecycleStatusLabel(row.lifecycle_status)",
    '"Statut inconnu"',
    'asset.lifecycle_status === "active"',
  ]) {
    assert(source.includes(required), `Missing lifecycle UI contract: ${required}`);
  }

  const lifecycleOptions = [
    'value: "draft", label: "Brouillon"',
    'value: "eligible", label: "Éligible"',
    'value: "active", label: "Actif"',
    'value: "paused", label: "En pause"',
    'value: "archived", label: "Archivé"',
  ];
  assert(
    lifecycleOptions.map((option) => source.indexOf(option)).every((index, position, indexes) => index !== -1 && (position === 0 || index > indexes[position - 1])),
    "Lifecycle options must be the exact five statuses in order",
  );

  const assetUpdateFields = pageSource.slice(
    pageSource.indexOf("const updateFields"),
    pageSource.indexOf("function displayValue"),
  );
  const assetFields = assetUpdateFields.match(/assets: \[([^\]]*)\]/);
  assert(assetFields !== null, "Asset update fields not found");
  assert(
    !assetFields[1].includes('key: "lifecycle_status"'),
    "Asset lifecycle must not use the generic text input",
  );

  assert(!source.includes("lifecycleStatus:"), "Lifecycle body must remain snake_case");
  assert(!source.includes("archived_at:"), "Client must not send archived_at");
  assert(
    !assetUpdateFields.includes('assets: [{ key: "display_name" }, { key: "asset_type" }, { key: "canonical_url", type: "url" }, { key: "lifecycle_status"'),
    "Generic Asset lifecycle input must remain absent",
  );

  console.log("PASS — Backlinks asset lifecycle UI smoke");
}

void main();

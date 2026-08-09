export type BacklinkAssetLifecycleStatus = "draft" | "eligible" | "active" | "paused" | "archived";

export const backlinkAssetLifecycleOptions: readonly { value: BacklinkAssetLifecycleStatus; label: string }[] = [
  { value: "draft", label: "Brouillon" },
  { value: "eligible", label: "Éligible" },
  { value: "active", label: "Actif" },
  { value: "paused", label: "En pause" },
  { value: "archived", label: "Archivé" },
];

export function isBacklinkAssetLifecycleStatus(value: string): value is BacklinkAssetLifecycleStatus {
  return value === "draft" || value === "eligible" || value === "active" || value === "paused" || value === "archived";
}

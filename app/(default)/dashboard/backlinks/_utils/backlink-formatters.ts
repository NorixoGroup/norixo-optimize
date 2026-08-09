export function displayValue(value: string | number | boolean | null | undefined) {
  return value == null || value === "" ? "—" : String(value);
}

export function formatDate(value: string | number | boolean | null | undefined) {
  if (typeof value !== "string" || !value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString("fr-FR");
}

export function inputValue(row: Record<string, unknown> | null, key: string) {
  const value = row?.[key];
  return typeof value === "string" || typeof value === "number" ? String(value) : "";
}

export function parseAirbnbCurrency(value: string | null | undefined): number | null {
  if (!value) return null;

  const cleaned = value
    .replace(/\u00A0/g, " ")
    .replace(/[^\d,.\s]/g, "")
    .trim();

  if (!cleaned) return null;

  const normalized = cleaned
    .replace(/\s/g, "")
    .replace(",", ".");

  const num = Number(normalized);

  return Number.isFinite(num) ? num : null;
}

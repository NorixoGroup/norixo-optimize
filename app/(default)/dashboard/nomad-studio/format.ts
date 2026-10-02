export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return "—";

  const date = new Date(iso);

  return Number.isNaN(date.getTime()) ? "—" : date.toLocaleString("fr-FR", { dateStyle: "medium", timeStyle: "short" });
}

export function formatDay(iso: string | null | undefined): string {
  if (!iso) return "—";

  const date = new Date(`${iso}T00:00:00`);

  return Number.isNaN(date.getTime()) ? "—" : date.toLocaleDateString("fr-FR", { dateStyle: "medium" });
}

// Durée en minutes : « — » tant que la donnée n'existe pas.
export function formatDuration(minutes: number | null | undefined): string {
  if (typeof minutes !== "number" || !Number.isFinite(minutes) || minutes <= 0) return "—";

  const whole = Math.round(minutes);
  const h = Math.floor(whole / 60);
  const m = whole % 60;

  return h > 0 ? `${h} h ${String(m).padStart(2, "0")}` : `${m} min`;
}

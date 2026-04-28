/**
 * Villes suggérées par pays (chargement à la demande, chunk séparé par pays).
 * Pays sans module : tableau vide → saisie libre uniquement.
 */
export async function loadCitiesForCountry(iso2: string): Promise<string[]> {
  const code = iso2.toUpperCase();
  switch (code) {
    case "MA":
      return (await import("./cities/ma")).default;
    case "FR":
      return (await import("./cities/fr")).default;
    case "ES":
      return (await import("./cities/es")).default;
    case "PT":
      return (await import("./cities/pt")).default;
    case "IT":
      return (await import("./cities/it")).default;
    case "GB":
      return (await import("./cities/gb")).default;
    case "US":
      return (await import("./cities/us")).default;
    default:
      return [];
  }
}

import countries from "i18n-iso-countries";
import fr from "i18n-iso-countries/langs/fr.json";
import type { LocaleData } from "i18n-iso-countries";

countries.registerLocale(fr as LocaleData);

/** Code réservé : pays saisi manuellement (hors liste ISO). */
export const OTHER_COUNTRY_CODE = "__OTHER__";

export type CountryOption = { code: string; labelFr: string };

let cachedList: CountryOption[] | null = null;

/** Tous les pays (ISO 3166-1 alpha-2) avec libellé officiel français, triés. */
export function getAllCountriesFr(): CountryOption[] {
  if (cachedList) return cachedList;
  const names = countries.getNames("fr");
  cachedList = Object.entries(names)
    .map(([code, labelFr]) => ({ code, labelFr: labelFr as string }))
    .sort((a, b) => a.labelFr.localeCompare(b.labelFr, "fr"));
  return cachedList;
}

export function getCountryLabelFr(alpha2: string): string | undefined {
  return countries.getName(alpha2, "fr");
}

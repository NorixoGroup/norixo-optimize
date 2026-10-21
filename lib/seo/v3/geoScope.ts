/**
 * SEO generator V3 — country name → ISO 3166-1 alpha-2 (S5.2). Pure, static, reviewed.
 *
 * `data/cities.ts` stores country NAMES only, while a V3 `GeographicScope` needs a two-letter code. The table
 * below covers exactly the 62 countries that file uses. A name is matched exactly: nothing is inferred, no
 * fuzzy matching, no runtime lookup. An unknown name gives null, which the classifier reports as a human
 * decision, never as a guess. Adding the code to `data/cities.ts` is a separate change.
 */
export type CountryIsoTable = Readonly<Record<string, string>>;

export const COUNTRY_ISO: CountryIsoTable = Object.freeze({
  Argentina: "AR",
  Australia: "AU",
  Austria: "AT",
  Belgium: "BE",
  Brazil: "BR",
  Bulgaria: "BG",
  Canada: "CA",
  Chile: "CL",
  Colombia: "CO",
  "Costa Rica": "CR",
  Croatia: "HR",
  Cyprus: "CY",
  "Czech Republic": "CZ",
  Denmark: "DK",
  "Dominican Republic": "DO",
  Egypt: "EG",
  Finland: "FI",
  France: "FR",
  Germany: "DE",
  Greece: "GR",
  "Hong Kong": "HK",
  Hungary: "HU",
  Iceland: "IS",
  India: "IN",
  Indonesia: "ID",
  Ireland: "IE",
  Israel: "IL",
  Italy: "IT",
  Jamaica: "JM",
  Japan: "JP",
  Jordan: "JO",
  Malaysia: "MY",
  Mexico: "MX",
  Morocco: "MA",
  Netherlands: "NL",
  "New Zealand": "NZ",
  Norway: "NO",
  Oman: "OM",
  Panama: "PA",
  Peru: "PE",
  Philippines: "PH",
  Poland: "PL",
  Portugal: "PT",
  "Puerto Rico": "PR",
  Qatar: "QA",
  Romania: "RO",
  "Saudi Arabia": "SA",
  Singapore: "SG",
  Slovenia: "SI",
  "South Africa": "ZA",
  "South Korea": "KR",
  Spain: "ES",
  Sweden: "SE",
  Switzerland: "CH",
  Taiwan: "TW",
  Thailand: "TH",
  Tunisia: "TN",
  Turkey: "TR",
  "United Arab Emirates": "AE",
  "United Kingdom": "GB",
  "United States": "US",
  Vietnam: "VN",
});

/** The code of a country name, or null. Exact match on an own property only. */
export function resolveCountryIso(name: unknown, table: CountryIsoTable = COUNTRY_ISO): string | null {
  if (typeof name !== "string") return null;
  return Object.hasOwn(table, name) ? table[name]! : null;
}

/** Problems of a table (empty = sound): every code is two upper-case letters and no two names share a code. */
export function validateCountryIsoTable(table: CountryIsoTable): readonly string[] {
  const problems: string[] = [];
  const seen = new Map<string, string>();
  for (const [name, code] of Object.entries(table)) {
    if (!/^[A-Z]{2}$/.test(code)) problems.push(`invalid_code:${name}`);
    const other = seen.get(code);
    if (other !== undefined) problems.push(`duplicate_code:${code}:${other}:${name}`);
    seen.set(code, name);
  }
  return problems;
}

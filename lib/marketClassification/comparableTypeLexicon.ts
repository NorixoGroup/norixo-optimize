const normalizeComparableLexiconText = (value: string | null | undefined): string =>
  (value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

export const strongApartmentTerms = [
  "apartment",
  "apartments",
  "appartement",
  "appartements",
  "apartamento",
  "apartamentos",
  "appartamento",
  "appartamenti",
  "apartament",
  "apartamenty",
  "departamento",
  "departamentos",
  "wohnung",
  "ferienwohnung",
  "mieszkanie",
  "flat",
  "condo",
  "rental unit",
  "entire rental unit",
  "entire place",
  "logement entier",
] as const;

export const explicitRoomTerms = [
  "private room",
  "shared room",
  "room in",
  "guest room",
  "bedroom in shared",
  "chambre privee",
  "chambre privée",
  "habitacion privada",
  "habitación privada",
  "quarto privado",
  "privatzimmer",
  "gedeelde kamer",
  "pokój prywatny",
  "pokoj prywatny",
] as const;

export const unsafeGenericTerms = [
  "alojamiento",
  "accommodation",
  "logement",
  "stay",
  "rental",
  "vacation",
  "holiday",
  "guest",
  "home",
  "suite",
  "unit",
  "residence",
  "casa",
] as const;

function containsNormalizedPhrase(text: string, phrase: string): boolean {
  const normalizedText = ` ${normalizeComparableLexiconText(text)} `;
  const normalizedPhrase = ` ${normalizeComparableLexiconText(phrase)} `;
  return normalizedText.includes(normalizedPhrase);
}

export function findStrongApartmentTerms(text: string): string[] {
  return strongApartmentTerms.filter((term) => containsNormalizedPhrase(text, term));
}

export function hasStrongApartmentSignal(text: string): boolean {
  return findStrongApartmentTerms(text).length > 0;
}

export function findExplicitRoomTerms(text: string): string[] {
  return explicitRoomTerms.filter((term) => containsNormalizedPhrase(text, term));
}

export function hasExplicitRoomSignal(text: string): boolean {
  return findExplicitRoomTerms(text).length > 0;
}

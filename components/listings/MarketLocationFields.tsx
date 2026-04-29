"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  getAllCountriesFr,
  getCountryLabelFr,
  OTHER_COUNTRY_CODE,
} from "@/lib/geo/countries";
import { loadCitiesForCountry } from "@/lib/geo/loadCitiesForCountry";

function normalizeSearch(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

export type MarketLocationFieldsProps = {
  countryIso: string;
  onCountryIsoChange: (iso: string) => void;
  countryOtherText: string;
  onCountryOtherTextChange: (v: string) => void;
  city: string;
  onCityChange: (v: string) => void;
  cityUnlisted: boolean;
  onCityUnlistedChange: (v: boolean) => void;
  disabled?: boolean;
};

export function MarketLocationFields({
  countryIso,
  onCountryIsoChange,
  countryOtherText,
  onCountryOtherTextChange,
  city,
  onCityChange,
  cityUnlisted,
  onCityUnlistedChange,
  disabled = false,
}: MarketLocationFieldsProps) {
  const allCountries = useMemo(() => getAllCountriesFr(), []);
  const [countryOpen, setCountryOpen] = useState(false);
  const [countryQuery, setCountryQuery] = useState("");
  const [citiesPool, setCitiesPool] = useState<string[]>([]);
  const [citiesLoading, setCitiesLoading] = useState(false);
  const [cityListOpen, setCityListOpen] = useState(false);
  const countryWrapRef = useRef<HTMLDivElement>(null);
  const cityWrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    queueMicrotask(() => {
      if (countryIso === OTHER_COUNTRY_CODE) {
        setCountryQuery("");
        return;
      }
      if (countryIso) {
        setCountryQuery(getCountryLabelFr(countryIso) ?? "");
      } else {
        setCountryQuery("");
      }
    });
  }, [countryIso]);

  useEffect(() => {
    if (!countryIso || countryIso === OTHER_COUNTRY_CODE) {
      queueMicrotask(() => {
        setCitiesPool([]);
        setCitiesLoading(false);
      });
      return;
    }
    let cancelled = false;
    queueMicrotask(() => setCitiesLoading(true));
    void loadCitiesForCountry(countryIso).then((list) => {
      if (!cancelled) {
        setCitiesPool(list);
        setCitiesLoading(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [countryIso]);

  useEffect(() => {
    function onDocMouseDown(e: MouseEvent) {
      const t = e.target as Node;
      if (countryWrapRef.current && !countryWrapRef.current.contains(t)) {
        setCountryOpen(false);
      }
      if (cityWrapRef.current && !cityWrapRef.current.contains(t)) {
        setCityListOpen(false);
      }
    }
    document.addEventListener("mousedown", onDocMouseDown);
    return () => document.removeEventListener("mousedown", onDocMouseDown);
  }, []);

  const filteredCountries = useMemo(() => {
    const q = normalizeSearch(countryQuery);
    if (q.length < 1) {
      return [];
    }
    return allCountries
      .filter(
        (c) =>
          normalizeSearch(c.labelFr).includes(q) || c.code.toLowerCase().startsWith(q)
      )
      .slice(0, 40);
  }, [allCountries, countryQuery]);

  const filteredCities = useMemo(() => {
    if (cityUnlisted || citiesPool.length === 0) return [];
    const q = normalizeSearch(city);
    if (!q) return citiesPool.slice(0, 8);
    return citiesPool.filter((c) => normalizeSearch(c).includes(q)).slice(0, 8);
  }, [citiesPool, city, cityUnlisted]);

  const showCitySuggestions =
    Boolean(countryIso && countryIso !== OTHER_COUNTRY_CODE) &&
    citiesPool.length > 0 &&
    !cityUnlisted &&
    cityListOpen;

  const cityFieldDisabled =
    disabled || !countryIso || (countryIso === OTHER_COUNTRY_CODE && !countryOtherText.trim());

  return (
    <div className="space-y-5">
      <div className="space-y-2" ref={countryWrapRef}>
        <label className="mb-2 block text-sm font-medium text-slate-900">
          Pays du logement
        </label>
        <div className="relative">
          <input
            type="text"
            value={countryIso === OTHER_COUNTRY_CODE ? countryOtherText : countryQuery}
            onChange={(e) => {
              const v = e.target.value;
              if (countryIso === OTHER_COUNTRY_CODE) {
                onCountryOtherTextChange(v);
              } else {
                onCountryIsoChange("");
                setCountryQuery(v);
                setCountryOpen(true);
              }
            }}
            onFocus={() => {
              if (countryIso !== OTHER_COUNTRY_CODE) {
                setCountryOpen(true);
              }
            }}
            disabled={disabled}
            placeholder={
              countryIso === OTHER_COUNTRY_CODE
                ? "Nom du pays (saisie libre)"
                : "Rechercher un pays…"
            }
            className="nk-form-field"
            autoComplete="off"
          />
          {countryIso !== OTHER_COUNTRY_CODE && countryOpen && !disabled ? (
            <div className="absolute z-30 mt-1 max-h-56 w-full overflow-auto rounded-xl border border-slate-200 bg-white py-1 shadow-lg">
              {countryQuery.trim().length < 1 ? (
                <p className="px-3 py-2 text-xs text-slate-500">
                  Tapez le nom du pays pour afficher les suggestions.
                </p>
              ) : filteredCountries.length === 0 ? (
                <p className="px-3 py-2 text-xs text-slate-500">Aucun pays correspondant.</p>
              ) : (
                filteredCountries.map((c) => (
                  <button
                    key={c.code}
                    type="button"
                    className="flex w-full px-3 py-2 text-left text-sm text-slate-800 hover:bg-slate-50"
                    onClick={() => {
                      onCountryIsoChange(c.code);
                      setCountryQuery(c.labelFr);
                      setCountryOpen(false);
                    }}
                  >
                    {c.labelFr}{" "}
                    <span className="ml-1 text-xs text-slate-400">({c.code})</span>
                  </button>
                ))
              )}
              <button
                type="button"
                className="mt-1 w-full border-t border-slate-100 px-3 py-2 text-left text-sm font-medium text-amber-800 hover:bg-amber-50/80"
                onClick={() => {
                  onCountryIsoChange(OTHER_COUNTRY_CODE);
                  onCountryOtherTextChange("");
                  setCountryOpen(false);
                }}
              >
                Autre — saisie manuelle du pays
              </button>
            </div>
          ) : null}
        </div>
        {countryIso === OTHER_COUNTRY_CODE ? (
          <p className="text-xs text-slate-500">
            Indiquez le pays exact ; la liste des villes ne s’applique pas (saisie libre de la
            ville).
          </p>
        ) : null}
      </div>

      <div className="space-y-2" ref={cityWrapRef}>
        <label className="mb-2 block text-sm font-medium text-slate-900">
          Ville du logement
        </label>
        <div className="relative">
          <input
            type="text"
            value={city}
            onChange={(e) => {
              onCityChange(e.target.value);
              setCityListOpen(true);
            }}
            onFocus={() => setCityListOpen(true)}
            disabled={cityFieldDisabled}
            required={!cityFieldDisabled}
            placeholder={
              !countryIso
                ? "Choisissez d’abord un pays"
                : countryIso === OTHER_COUNTRY_CODE
                  ? "Saisissez la ville"
                  : citiesLoading
                    ? "Chargement des suggestions…"
                    : citiesPool.length === 0
                      ? "Saisissez la ville (aucune liste pour ce pays)"
                      : "Rechercher ou saisir la ville…"
            }
            className="nk-form-field"
            autoComplete="off"
          />
          {showCitySuggestions && filteredCities.length > 0 ? (
            <div className="absolute left-0 right-0 top-full z-20 mt-1 max-h-48 overflow-auto rounded-xl border border-slate-200 bg-white py-1 shadow-lg">
              {filteredCities.map((name) => (
                <button
                  key={name}
                  type="button"
                  className="flex w-full px-3 py-2 text-left text-sm text-slate-800 hover:bg-slate-50"
                  onClick={() => {
                    onCityChange(name);
                    setCityListOpen(false);
                  }}
                >
                  {name}
                </button>
              ))}
            </div>
          ) : null}
        </div>
        {countryIso &&
        countryIso !== OTHER_COUNTRY_CODE &&
        citiesPool.length > 0 &&
        !citiesLoading ? (
          <label className="flex cursor-pointer items-center gap-2 text-xs text-slate-600">
            <input
              type="checkbox"
              checked={cityUnlisted}
              disabled={disabled}
              onChange={(e) => {
                onCityUnlistedChange(e.target.checked);
                setCityListOpen(!e.target.checked);
              }}
              className="rounded border-slate-300"
            />
            Ville non listée — saisie libre uniquement
          </label>
        ) : null}
      </div>

      <p className="text-xs leading-relaxed text-slate-600">
        Choisissez le pays et la ville réels du logement pour obtenir des comparables proches.
      </p>
    </div>
  );
}

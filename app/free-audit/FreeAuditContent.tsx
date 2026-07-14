"use client";

import { useState } from "react";
import Link from "next/link";

import { MarketingPageShell } from "@/components/marketing/MarketingPageShell";
import { useTranslation } from "@/components/i18n/useTranslation";
import type {
  FreeAuditPricingPreviewAvailable,
  FreeAuditPricingPreviewInsufficientCoverage,
} from "@/lib/freeAudit/publicPricingPreviewContract";

import {
  FREE_AUDIT_CAPACITY_OPTIONS,
  FREE_AUDIT_CURRENCY_OPTIONS,
  FREE_AUDIT_PLATFORM_OPTIONS,
  FREE_AUDIT_PROPERTY_TYPE_OPTIONS,
  formatCurrencyValue,
  formatPercentValue,
  getConfidenceLevelLabelKey,
  getDeltaDirection,
  getPositioningLabelKey,
  getSampleBandLabelKey,
  mapPreviewErrorStatus,
  type FreeAuditFormErrorCode,
  type FreeAuditFormField,
  type FreeAuditFormValues,
  validateFreeAuditForm,
  detectSupportedPlatformFromListingUrl,
} from "./freeAuditPageModel";

const freeAuditContentI18n = {
  en: {
    hero: {
      eyebrow: "Free Audit Preview",
      title: "Discover the pricing position of your listing",
      subtitle:
        "Compare your declared nightly price with the aggregated market data available in Norixo.",
      reassurance:
        "No credit card. No scraping. No listing content is reviewed at this stage.",
    },
    form: {
      title: "Structured market preview",
      text:
        "Fill in the structured details below to receive a benchmark-only pricing preview.",
      listingUrlLabel: "Listing URL (optional)",
      listingUrlPlaceholder: "https://www.airbnb.com/rooms/123456789",
      countryLabel: "Country",
      countryPlaceholder: "France",
      cityLabel: "City",
      cityPlaceholder: "Paris",
      platformLabel: "Platform",
      platformPlaceholder: "Select a platform",
      propertyTypeLabel: "Property type",
      propertyTypePlaceholder: "Select a property type",
      guestCapacityLabel: "Guest capacity",
      guestCapacityPlaceholder: "Select capacity",
      declaredNightlyPriceLabel: "Average nightly price",
      declaredNightlyPricePlaceholder: "145",
      currencyLabel: "Currency",
      currencyPlaceholder: "Select currency",
      submitIdle: "See my free analysis",
      submitLoading: "Analyzing market...",
      helper:
        "The URL stays local to your browser and is never sent to the preview API.",
      statusLoading: "Market preview in progress.",
    },
    options: {
      platform: {
        airbnb: "Airbnb",
        booking: "Booking",
        expedia: "Expedia",
        agoda: "Agoda",
        vrbo: "Vrbo",
      },
      propertyType: {
        studio: "Studio",
        apartment: "Apartment",
        villa: "Villa",
        riad: "Riad",
        room: "Room",
        hotel: "Hotel",
      },
      capacity: {
        moreThanTen: "10 guests and more",
        singular: "guest",
        plural: "guests",
      },
    },
    errors: {
      listing_url_invalid: "Enter a valid listing URL from a supported platform.",
      country_required: "Enter your country.",
      city_required: "Enter your city.",
      platform_required: "Select a platform.",
      property_type_required: "Select a property type.",
      guest_capacity_required: "Enter the guest capacity.",
      declared_price_invalid: "Enter a valid price.",
      currency_required: "Select a currency.",
      invalid_request: "Some information must be corrected.",
      rate_limited: "You made several requests. Try again in a few minutes.",
      unavailable: "The free preview is temporarily unavailable.",
      network_error: "Unable to load the preview right now.",
      unknown_error: "Unable to load the preview right now.",
    },
    result: {
      title: "Your pricing position",
      text:
        "Result based on the aggregated market data currently available for this category.",
      initialTitle: "Your preview will appear here.",
      initialText:
        "Norixo will compare your declared price with the aggregated benchmarks available for your market.",
      declaredPrice: "Your declared price",
      benchmarkRange: "Observed range",
      medianPrice: "Median",
      positioningTitle: "Price positioning",
      confidenceTitle: "Confidence",
      recommendationsTitle: "Recommendations",
      limitationsTitle: "Good to know",
      insufficientTitle: "Coverage is still limited",
      insufficientText:
        "We do not yet have enough aggregated market data for this request.",
      unavailableTitle: "Preview unavailable",
      delta: {
        above_median: "above median",
        below_median: "below median",
        at_median: "from the median",
      },
      positioning: {
        well_below_market: "Well below market",
        below_market: "Below market",
        near_market: "Near market",
        above_market: "Above market",
        well_above_market: "Well above market",
      },
      confidenceLevel: {
        standard: "Standard confidence",
        high: "High confidence",
      },
      sampleBand: {
        sufficient: "Sufficient sample",
        strong: "Strong sample",
      },
    },
    compare: {
      title: "Free preview vs full audit",
      freeTitle: "Free audit preview",
      fullTitle: "Full audit",
      freeItems: [
        "Declared pricing position",
        "Aggregated benchmark range",
        "Public confidence level",
        "General pricing recommendations",
        "No listing content reviewed",
      ],
      fullItems: [
        "Real listing analysis",
        "Title and description review",
        "Photos, amenities and trust signals",
        "Real competitor analysis",
        "Personalized conversion recommendations",
        "Full pricing analysis and occupancy runtime when available",
      ],
    },
    cta: {
      title: "Ready to unlock the full audit?",
      text:
        "Move from a structured market preview to the complete Norixo listing audit.",
      primary: "Unlock full audit",
      secondary: "Start from your real listing",
      reassurance: "Full audit flow. No free preview URL is forwarded.",
    },
  },
  fr: {
    hero: {
      eyebrow: "Apercu gratuit",
      title: "Decouvrez le positionnement tarifaire de votre annonce",
      subtitle:
        "Comparez gratuitement votre prix declare aux donnees de marche agregees disponibles chez Norixo.",
      reassurance:
        "Aucune carte bancaire. Aucun scraping. Aucun contenu de votre annonce n'est consulte.",
    },
    form: {
      title: "Apercu du marche",
      text:
        "Renseignez les informations utiles pour recevoir un apercu pricing fonde uniquement sur les benchmarks agreges.",
      listingUrlLabel: "URL de l'annonce (facultative)",
      listingUrlPlaceholder: "https://www.airbnb.com/rooms/123456789",
      countryLabel: "Pays",
      countryPlaceholder: "France",
      cityLabel: "Ville",
      cityPlaceholder: "Paris",
      platformLabel: "Plateforme",
      platformPlaceholder: "Selectionnez une plateforme",
      propertyTypeLabel: "Type de logement",
      propertyTypePlaceholder: "Selectionnez un type de logement",
      guestCapacityLabel: "Capacite",
      guestCapacityPlaceholder: "Selectionnez une capacite",
      declaredNightlyPriceLabel: "Prix moyen par nuit",
      declaredNightlyPricePlaceholder: "145",
      currencyLabel: "Devise",
      currencyPlaceholder: "Selectionnez une devise",
      submitIdle: "Voir mon analyse gratuite",
      submitLoading: "Analyse du marche...",
      helper:
        "L'URL reste locale a votre navigateur et n'est jamais envoyee a l'API d'apercu.",
      statusLoading: "Analyse du marche en cours.",
    },
    options: {
      platform: {
        airbnb: "Airbnb",
        booking: "Booking",
        expedia: "Expedia",
        agoda: "Agoda",
        vrbo: "Vrbo",
      },
      propertyType: {
        studio: "Studio",
        apartment: "Appartement",
        villa: "Villa",
        riad: "Riad",
        room: "Chambre",
        hotel: "Hotel",
      },
      capacity: {
        moreThanTen: "10 voyageurs et plus",
        singular: "voyageur",
        plural: "voyageurs",
      },
    },
    errors: {
      listing_url_invalid: "Indiquez une URL valide sur une plateforme prise en charge.",
      country_required: "Indiquez votre pays.",
      city_required: "Indiquez votre ville.",
      platform_required: "Selectionnez une plateforme.",
      property_type_required: "Selectionnez un type de logement.",
      guest_capacity_required: "Indiquez la capacite.",
      declared_price_invalid: "Indiquez un prix valide.",
      currency_required: "Selectionnez une devise.",
      invalid_request: "Certaines informations doivent etre corrigees.",
      rate_limited:
        "Vous avez effectue plusieurs demandes. Reessayez dans quelques minutes.",
      unavailable: "L'apercu gratuit est temporairement indisponible.",
      network_error: "Impossible de charger l'apercu pour le moment.",
      unknown_error: "Impossible de charger l'apercu pour le moment.",
    },
    result: {
      title: "Votre positionnement tarifaire",
      text:
        "Resultat fonde sur les donnees de marche agregees disponibles pour cette categorie.",
      initialTitle: "Votre apercu apparaitra ici.",
      initialText:
        "Norixo comparera votre prix declare aux benchmarks agreges disponibles pour votre marche.",
      declaredPrice: "Votre prix declare",
      benchmarkRange: "Fourchette observee",
      medianPrice: "Mediane",
      positioningTitle: "Positionnement",
      confidenceTitle: "Confiance",
      recommendationsTitle: "Recommandations",
      limitationsTitle: "A savoir",
      insufficientTitle: "Couverture encore insuffisante",
      insufficientText:
        "Nous ne disposons pas encore d'un volume suffisant de donnees agregees pour cette demande.",
      unavailableTitle: "Apercu indisponible",
      delta: {
        above_median: "au-dessus de la mediane",
        below_median: "sous la mediane",
        at_median: "de la mediane",
      },
      positioning: {
        well_below_market: "Nettement sous le marche",
        below_market: "Sous le marche",
        near_market: "Proche du marche",
        above_market: "Au-dessus du marche",
        well_above_market: "Nettement au-dessus du marche",
      },
      confidenceLevel: {
        standard: "Confiance standard",
        high: "Confiance elevee",
      },
      sampleBand: {
        sufficient: "Echantillon suffisant",
        strong: "Echantillon solide",
      },
    },
    compare: {
      title: "Audit gratuit vs audit complet",
      freeTitle: "Audit gratuit",
      fullTitle: "Audit complet",
      freeItems: [
        "Positionnement tarifaire declare",
        "Benchmark agrege",
        "Niveau de confiance public",
        "Recommandations pricing generales",
        "Aucun contenu de l'annonce consulte",
      ],
      fullItems: [
        "Analyse reelle de l'annonce",
        "Titre et description",
        "Photos, equipements et signaux de confiance",
        "Concurrence reelle",
        "Recommandations de conversion personnalisees",
        "Analyse pricing complete et runtime occupancy si disponible",
      ],
    },
    cta: {
      title: "Pret a debloquer l'audit complet ?",
      text:
        "Passez d'un apercu du marche a l'audit complet de votre annonce avec Norixo.",
      primary: "Debloquer l'audit complet",
      secondary: "Partir de votre annonce reelle",
      reassurance: "Flux d'audit complet. Aucune URL du preview gratuit n'est transmise.",
    },
  },
} as const;

type FreeAuditCopy = (typeof freeAuditContentI18n)[keyof typeof freeAuditContentI18n];

type PreviewState =
  | { kind: "idle" }
  | { kind: "submitting" }
  | { kind: "available"; result: FreeAuditPricingPreviewAvailable }
  | { kind: "insufficient"; result: FreeAuditPricingPreviewInsufficientCoverage }
  | { kind: "error"; title: string; message: string };

type RouteStatusBody = {
  status?: string;
  message?: string;
};

const FULL_AUDIT_CTA_HREF = "/sign-in?next=/audit/new";

function buildCapacityOptionLabel(
  value: number,
  copy: FreeAuditCopy["options"]["capacity"],
): string {
  if (value >= 10) {
    return copy.moreThanTen;
  }

  return `${value} ${value === 1 ? copy.singular : copy.plural}`;
}

function getFieldErrorMessage(
  copy: FreeAuditCopy,
  code: FreeAuditFormErrorCode | undefined,
): string | null {
  if (code == null) {
    return null;
  }
  return copy.errors[code];
}

function getFirstErrorField(
  errors: Partial<Record<FreeAuditFormField, FreeAuditFormErrorCode>>,
): FreeAuditFormField | null {
  const orderedFields: FreeAuditFormField[] = [
    "listingUrl",
    "country",
    "city",
    "platform",
    "propertyType",
    "guestCapacity",
    "declaredNightlyPrice",
    "currency",
  ];

  return orderedFields.find((field) => errors[field] != null) ?? null;
}

function buildDeltaLabel(
  locale: string,
  deltaFromMedianPercent: number,
  copy: FreeAuditCopy["result"]["delta"],
): string {
  const direction = getDeltaDirection(deltaFromMedianPercent);
  const percentValue = formatPercentValue(deltaFromMedianPercent);
  if (direction === "at_median") {
    return `0% ${copy.at_median}`;
  }

  return `${new Intl.NumberFormat(locale).format(Number(percentValue))}% ${copy[direction]}`;
}

async function parseRouteBody(response: Response): Promise<RouteStatusBody | null> {
  try {
    return (await response.json()) as RouteStatusBody;
  } catch {
    return null;
  }
}

function resolveErrorStatus(
  responseStatus: number,
  routeStatus: string | null | undefined,
): string {
  if (routeStatus) {
    return routeStatus;
  }

  if (responseStatus === 429) {
    return "rate_limited";
  }

  if (responseStatus === 400 || responseStatus === 405 || responseStatus === 413) {
    return "invalid_request";
  }

  if (responseStatus === 503) {
    return "unavailable";
  }

  return "unknown_error";
}

function buildErrorState(
  copy: FreeAuditCopy,
  status: string | null | undefined,
): PreviewState {
  const mappedStatus = mapPreviewErrorStatus(status);
  return {
    kind: "error",
    title: copy.result.unavailableTitle,
    message: copy.errors[mappedStatus],
  };
}

export function FreeAuditContent() {
  const { locale, copy } = useTranslation(freeAuditContentI18n);
  const [formValues, setFormValues] = useState<FreeAuditFormValues>({
    listingUrl: "",
    country: "",
    city: "",
    platform: "",
    propertyType: "",
    guestCapacity: "",
    declaredNightlyPrice: "",
    currency: "",
  });
  const [fieldErrors, setFieldErrors] = useState<
    Partial<Record<FreeAuditFormField, FreeAuditFormErrorCode>>
  >({});
  const [previewState, setPreviewState] = useState<PreviewState>({ kind: "idle" });
  const [submitAnnouncement, setSubmitAnnouncement] = useState("");
  const [platformTouched, setPlatformTouched] = useState(false);

  function updateField<K extends keyof FreeAuditFormValues>(
    field: K,
    value: FreeAuditFormValues[K],
  ) {
    setFormValues((current) => ({ ...current, [field]: value }));
    setFieldErrors((current) => {
      if (current[field] == null) {
        return current;
      }

      const nextErrors = { ...current };
      delete nextErrors[field];
      return nextErrors;
    });
  }

  function handleListingUrlBlur() {
    if (platformTouched) {
      return;
    }

    const detectedPlatform = detectSupportedPlatformFromListingUrl(formValues.listingUrl);
    if (detectedPlatform != null) {
      setFormValues((current) => ({ ...current, platform: detectedPlatform }));
    }
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const validation = validateFreeAuditForm(formValues);
    if (!validation.ok) {
      setFieldErrors(validation.errors);
      setPreviewState({ kind: "idle" });
      setSubmitAnnouncement(copy.errors.invalid_request);

      const firstErrorField = getFirstErrorField(validation.errors);
      if (firstErrorField != null) {
        const candidate = document.getElementById(`free-audit-${firstErrorField}`);
        candidate?.focus();
      }
      return;
    }

    if (!platformTouched && validation.detectedPlatform != null) {
      setFormValues((current) => ({
        ...current,
        platform: validation.detectedPlatform ?? current.platform,
      }));
    }

    setFieldErrors({});
    setPreviewState({ kind: "submitting" });
    setSubmitAnnouncement(copy.form.statusLoading);

    try {
      const response = await fetch("/api/free-audit/preview", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(validation.payload),
      });

      const body = await parseRouteBody(response);

      if (response.ok && body?.status === "available") {
        setPreviewState({
          kind: "available",
          result: body as FreeAuditPricingPreviewAvailable,
        });
        setSubmitAnnouncement(copy.result.title);
        return;
      }

      if (response.ok && body?.status === "insufficient_coverage") {
        setPreviewState({
          kind: "insufficient",
          result: body as FreeAuditPricingPreviewInsufficientCoverage,
        });
        setSubmitAnnouncement(copy.result.insufficientTitle);
        return;
      }

      const resolvedErrorStatus = resolveErrorStatus(response.status, body?.status);
      setPreviewState(buildErrorState(copy, resolvedErrorStatus));
      setSubmitAnnouncement(copy.errors[mapPreviewErrorStatus(resolvedErrorStatus)]);
    } catch {
      setPreviewState({
        kind: "error",
        title: copy.result.unavailableTitle,
        message: copy.errors.network_error,
      });
      setSubmitAnnouncement(copy.errors.network_error);
    }
  }

  return (
    <MarketingPageShell>
      <main className="nk-section space-y-10 md:space-y-12">
        <section className="rounded-[28px] nk-border bg-[radial-gradient(circle_at_0_0,rgba(251,146,60,0.10),transparent_58%),radial-gradient(circle_at_100%_100%,rgba(16,185,129,0.10),transparent_56%),linear-gradient(180deg,rgba(255,255,255,0.99)_0%,rgba(248,250,252,0.98)_100%)] px-5 py-6 shadow-[0_18px_52px_rgba(15,23,42,0.12)] md:p-7">
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-orange-500">
            {copy.hero.eyebrow}
          </p>
          <h1 className="mt-2 max-w-4xl text-balance bg-gradient-to-r from-orange-500 via-amber-400 to-emerald-400 bg-clip-text text-4xl font-semibold tracking-tight text-transparent sm:text-5xl md:text-6xl">
            {copy.hero.title}
          </h1>
          <p className="mt-3 max-w-3xl text-[15px] leading-7 text-slate-600">
            {copy.hero.subtitle}
          </p>
          <div className="mt-4 inline-flex rounded-full border border-emerald-200 bg-emerald-50/90 px-3 py-1.5 text-[11px] font-medium text-emerald-800">
            {copy.hero.reassurance}
          </div>
        </section>

        <section className="grid gap-5 xl:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)]">
          <section className="nk-card rounded-[28px] border border-slate-200/90 bg-[linear-gradient(180deg,rgba(255,255,255,0.99)_0%,rgba(248,250,252,0.98)_100%)] p-5 shadow-[0_18px_48px_rgba(15,23,42,0.08)] md:p-7">
            <div className="max-w-2xl">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                {copy.form.title}
              </p>
              <p className="mt-2 text-[14px] leading-6 text-slate-600">
                {copy.form.text}
              </p>
            </div>

            <form className="mt-6 space-y-4" onSubmit={handleSubmit} noValidate>
              <div className="space-y-1.5">
                <label
                  htmlFor="free-audit-listingUrl"
                  className="text-sm font-medium text-slate-800"
                >
                  {copy.form.listingUrlLabel}
                </label>
                <input
                  id="free-audit-listingUrl"
                  type="url"
                  value={formValues.listingUrl}
                  onChange={(event) => updateField("listingUrl", event.target.value)}
                  onBlur={handleListingUrlBlur}
                  placeholder={copy.form.listingUrlPlaceholder}
                  className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 shadow-[0_1px_2px_rgba(15,23,42,0.06)] outline-none transition focus:border-orange-500 focus:ring-2 focus:ring-orange-100"
                  aria-describedby={
                    fieldErrors.listingUrl ? "free-audit-listingUrl-error" : "free-audit-listingUrl-help"
                  }
                  aria-invalid={fieldErrors.listingUrl != null}
                />
                <p
                  id={fieldErrors.listingUrl ? "free-audit-listingUrl-error" : "free-audit-listingUrl-help"}
                  className={`text-xs ${fieldErrors.listingUrl ? "text-rose-600" : "text-slate-500"}`}
                >
                  {fieldErrors.listingUrl
                    ? getFieldErrorMessage(copy, fieldErrors.listingUrl)
                    : copy.form.helper}
                </p>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-1.5">
                  <label htmlFor="free-audit-country" className="text-sm font-medium text-slate-800">
                    {copy.form.countryLabel}
                  </label>
                  <input
                    id="free-audit-country"
                    type="text"
                    value={formValues.country}
                    onChange={(event) => updateField("country", event.target.value)}
                    placeholder={copy.form.countryPlaceholder}
                    className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 shadow-[0_1px_2px_rgba(15,23,42,0.06)] outline-none transition focus:border-orange-500 focus:ring-2 focus:ring-orange-100"
                    aria-describedby={fieldErrors.country ? "free-audit-country-error" : undefined}
                    aria-invalid={fieldErrors.country != null}
                  />
                  {fieldErrors.country ? (
                    <p id="free-audit-country-error" className="text-xs text-rose-600">
                      {getFieldErrorMessage(copy, fieldErrors.country)}
                    </p>
                  ) : null}
                </div>

                <div className="space-y-1.5">
                  <label htmlFor="free-audit-city" className="text-sm font-medium text-slate-800">
                    {copy.form.cityLabel}
                  </label>
                  <input
                    id="free-audit-city"
                    type="text"
                    value={formValues.city}
                    onChange={(event) => updateField("city", event.target.value)}
                    placeholder={copy.form.cityPlaceholder}
                    className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 shadow-[0_1px_2px_rgba(15,23,42,0.06)] outline-none transition focus:border-orange-500 focus:ring-2 focus:ring-orange-100"
                    aria-describedby={fieldErrors.city ? "free-audit-city-error" : undefined}
                    aria-invalid={fieldErrors.city != null}
                  />
                  {fieldErrors.city ? (
                    <p id="free-audit-city-error" className="text-xs text-rose-600">
                      {getFieldErrorMessage(copy, fieldErrors.city)}
                    </p>
                  ) : null}
                </div>

                <div className="space-y-1.5">
                  <label
                    htmlFor="free-audit-platform"
                    className="text-sm font-medium text-slate-800"
                  >
                    {copy.form.platformLabel}
                  </label>
                  <select
                    id="free-audit-platform"
                    value={formValues.platform}
                    onChange={(event) => {
                      setPlatformTouched(true);
                      updateField(
                        "platform",
                        event.target.value as FreeAuditFormValues["platform"],
                      );
                    }}
                    className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 shadow-[0_1px_2px_rgba(15,23,42,0.06)] outline-none transition focus:border-orange-500 focus:ring-2 focus:ring-orange-100"
                    aria-describedby={fieldErrors.platform ? "free-audit-platform-error" : undefined}
                    aria-invalid={fieldErrors.platform != null}
                  >
                    <option value="">{copy.form.platformPlaceholder}</option>
                    {FREE_AUDIT_PLATFORM_OPTIONS.map((platform) => (
                      <option key={platform} value={platform}>
                        {copy.options.platform[platform]}
                      </option>
                    ))}
                  </select>
                  {fieldErrors.platform ? (
                    <p id="free-audit-platform-error" className="text-xs text-rose-600">
                      {getFieldErrorMessage(copy, fieldErrors.platform)}
                    </p>
                  ) : null}
                </div>

                <div className="space-y-1.5">
                  <label
                    htmlFor="free-audit-propertyType"
                    className="text-sm font-medium text-slate-800"
                  >
                    {copy.form.propertyTypeLabel}
                  </label>
                  <select
                    id="free-audit-propertyType"
                    value={formValues.propertyType}
                    onChange={(event) =>
                      updateField(
                        "propertyType",
                        event.target.value as FreeAuditFormValues["propertyType"],
                      )
                    }
                    className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 shadow-[0_1px_2px_rgba(15,23,42,0.06)] outline-none transition focus:border-orange-500 focus:ring-2 focus:ring-orange-100"
                    aria-describedby={
                      fieldErrors.propertyType ? "free-audit-propertyType-error" : undefined
                    }
                    aria-invalid={fieldErrors.propertyType != null}
                  >
                    <option value="">{copy.form.propertyTypePlaceholder}</option>
                    {FREE_AUDIT_PROPERTY_TYPE_OPTIONS.map((propertyType) => (
                      <option key={propertyType} value={propertyType}>
                        {copy.options.propertyType[propertyType]}
                      </option>
                    ))}
                  </select>
                  {fieldErrors.propertyType ? (
                    <p id="free-audit-propertyType-error" className="text-xs text-rose-600">
                      {getFieldErrorMessage(copy, fieldErrors.propertyType)}
                    </p>
                  ) : null}
                </div>

                <div className="space-y-1.5">
                  <label
                    htmlFor="free-audit-guestCapacity"
                    className="text-sm font-medium text-slate-800"
                  >
                    {copy.form.guestCapacityLabel}
                  </label>
                  <select
                    id="free-audit-guestCapacity"
                    value={formValues.guestCapacity}
                    onChange={(event) => updateField("guestCapacity", event.target.value)}
                    className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 shadow-[0_1px_2px_rgba(15,23,42,0.06)] outline-none transition focus:border-orange-500 focus:ring-2 focus:ring-orange-100"
                    aria-describedby={
                      fieldErrors.guestCapacity ? "free-audit-guestCapacity-error" : undefined
                    }
                    aria-invalid={fieldErrors.guestCapacity != null}
                  >
                    <option value="">{copy.form.guestCapacityPlaceholder}</option>
                    {FREE_AUDIT_CAPACITY_OPTIONS.map((capacity) => (
                      <option key={capacity} value={capacity}>
                        {buildCapacityOptionLabel(capacity, copy.options.capacity)}
                      </option>
                    ))}
                  </select>
                  {fieldErrors.guestCapacity ? (
                    <p id="free-audit-guestCapacity-error" className="text-xs text-rose-600">
                      {getFieldErrorMessage(copy, fieldErrors.guestCapacity)}
                    </p>
                  ) : null}
                </div>

                <div className="space-y-1.5">
                  <label
                    htmlFor="free-audit-currency"
                    className="text-sm font-medium text-slate-800"
                  >
                    {copy.form.currencyLabel}
                  </label>
                  <select
                    id="free-audit-currency"
                    value={formValues.currency}
                    onChange={(event) => updateField("currency", event.target.value)}
                    className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 shadow-[0_1px_2px_rgba(15,23,42,0.06)] outline-none transition focus:border-orange-500 focus:ring-2 focus:ring-orange-100"
                    aria-describedby={fieldErrors.currency ? "free-audit-currency-error" : undefined}
                    aria-invalid={fieldErrors.currency != null}
                  >
                    <option value="">{copy.form.currencyPlaceholder}</option>
                    {FREE_AUDIT_CURRENCY_OPTIONS.map((currency) => (
                      <option key={currency} value={currency}>
                        {currency}
                      </option>
                    ))}
                  </select>
                  {fieldErrors.currency ? (
                    <p id="free-audit-currency-error" className="text-xs text-rose-600">
                      {getFieldErrorMessage(copy, fieldErrors.currency)}
                    </p>
                  ) : null}
                </div>
              </div>

              <div className="space-y-1.5">
                <label
                  htmlFor="free-audit-declaredNightlyPrice"
                  className="text-sm font-medium text-slate-800"
                >
                  {copy.form.declaredNightlyPriceLabel}
                </label>
                <input
                  id="free-audit-declaredNightlyPrice"
                  type="number"
                  min="0"
                  step="0.01"
                  inputMode="decimal"
                  value={formValues.declaredNightlyPrice}
                  onChange={(event) => updateField("declaredNightlyPrice", event.target.value)}
                  placeholder={copy.form.declaredNightlyPricePlaceholder}
                  className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 shadow-[0_1px_2px_rgba(15,23,42,0.06)] outline-none transition focus:border-orange-500 focus:ring-2 focus:ring-orange-100"
                  aria-describedby={
                    fieldErrors.declaredNightlyPrice
                      ? "free-audit-declaredNightlyPrice-error"
                      : undefined
                  }
                  aria-invalid={fieldErrors.declaredNightlyPrice != null}
                />
                {fieldErrors.declaredNightlyPrice ? (
                  <p
                    id="free-audit-declaredNightlyPrice-error"
                    className="text-xs text-rose-600"
                  >
                    {getFieldErrorMessage(copy, fieldErrors.declaredNightlyPrice)}
                  </p>
                ) : null}
              </div>

              <div className="flex flex-col gap-3 pt-2 sm:flex-row sm:items-center sm:justify-between">
                <button
                  type="submit"
                  disabled={previewState.kind === "submitting"}
                  className="nk-primary-btn w-full text-xs font-semibold uppercase tracking-[0.18em] disabled:cursor-not-allowed disabled:opacity-70 sm:w-auto"
                >
                  {previewState.kind === "submitting"
                    ? copy.form.submitLoading
                    : copy.form.submitIdle}
                </button>
                <p className="text-xs text-slate-500" aria-live="polite">
                  {submitAnnouncement}
                </p>
              </div>
            </form>
          </section>

          <section className="nk-card rounded-[28px] border border-slate-200/90 bg-white/95 p-5 shadow-[0_18px_48px_rgba(15,23,42,0.08)] md:p-7">
            {previewState.kind === "idle" || previewState.kind === "submitting" ? (
              <div className="space-y-4">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                    {copy.result.title}
                  </p>
                  <h2 className="mt-2 text-[22px] font-semibold tracking-[-0.03em] text-slate-950">
                    {copy.result.initialTitle}
                  </h2>
                  <p className="mt-3 text-[14px] leading-6 text-slate-600">
                    {copy.result.initialText}
                  </p>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-slate-50/80 p-4 text-sm text-slate-600">
                  {previewState.kind === "submitting"
                    ? copy.form.statusLoading
                    : copy.result.text}
                </div>
              </div>
            ) : null}

            {previewState.kind === "available" ? (
              <div className="space-y-5">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                    {copy.result.title}
                  </p>
                  <h2 className="mt-2 text-[22px] font-semibold tracking-[-0.03em] text-slate-950">
                    {copy.result.title}
                  </h2>
                  <p className="mt-2 text-[14px] leading-6 text-slate-600">
                    {copy.result.text}
                  </p>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-[0_10px_24px_rgba(15,23,42,0.06)]">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                      {copy.result.declaredPrice}
                    </p>
                    <p className="mt-2 text-2xl font-semibold text-slate-950">
                      {formatCurrencyValue(
                        locale,
                        previewState.result.market.currency,
                        previewState.result.declaredNightlyPrice,
                      )}
                    </p>
                  </div>

                  <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-[0_10px_24px_rgba(15,23,42,0.06)]">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                      {copy.result.benchmarkRange}
                    </p>
                    <p className="mt-2 text-xl font-semibold text-slate-950">
                      {formatCurrencyValue(
                        locale,
                        previewState.result.market.currency,
                        previewState.result.benchmark.lowPrice,
                      )}{" "}
                      -{" "}
                      {formatCurrencyValue(
                        locale,
                        previewState.result.market.currency,
                        previewState.result.benchmark.highPrice,
                      )}
                    </p>
                    <p className="mt-2 text-sm text-slate-600">
                      {copy.result.medianPrice}:{" "}
                      <span className="font-medium text-slate-900">
                        {formatCurrencyValue(
                          locale,
                          previewState.result.market.currency,
                          previewState.result.benchmark.medianPrice,
                        )}
                      </span>
                    </p>
                  </div>
                </div>

                <div className="rounded-2xl border border-orange-200 bg-orange-50/70 p-4 shadow-[0_10px_24px_rgba(251,146,60,0.10)]">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-orange-700">
                    {copy.result.positioningTitle}
                  </p>
                  <p className="mt-2 text-lg font-semibold text-slate-950">
                    {
                      copy.result.positioning[
                        getPositioningLabelKey(previewState.result.positioning.band)
                      ]
                    }
                  </p>
                  <p className="mt-1 text-sm text-slate-700">
                    {buildDeltaLabel(
                      locale,
                      previewState.result.positioning.deltaFromMedianPercent,
                      copy.result.delta,
                    )}
                  </p>
                </div>

                <div className="rounded-2xl border border-sky-200 bg-sky-50/70 p-4 shadow-[0_10px_24px_rgba(56,189,248,0.10)]">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-sky-700">
                    {copy.result.confidenceTitle}
                  </p>
                  <p className="mt-2 text-sm font-semibold text-slate-950">
                    {
                      copy.result.confidenceLevel[
                        getConfidenceLevelLabelKey(previewState.result.confidence.level)
                      ]
                    }
                  </p>
                  <p className="mt-1 text-sm text-slate-700">
                    {
                      copy.result.sampleBand[
                        getSampleBandLabelKey(previewState.result.confidence.sampleBand)
                      ]
                    }
                  </p>
                </div>

                <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-[0_10px_24px_rgba(15,23,42,0.06)]">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                    {copy.result.recommendationsTitle}
                  </p>
                  <ul className="mt-3 space-y-2 text-sm leading-6 text-slate-700">
                    {previewState.result.recommendations.map((item) => (
                      <li key={item}>• {item}</li>
                    ))}
                  </ul>
                </div>

                <div className="rounded-2xl border border-slate-200 bg-slate-50/80 p-4">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                    {copy.result.limitationsTitle}
                  </p>
                  <ul className="mt-3 space-y-2 text-sm leading-6 text-slate-600">
                    {previewState.result.limitations.map((item) => (
                      <li key={item}>• {item}</li>
                    ))}
                  </ul>
                </div>
              </div>
            ) : null}

            {previewState.kind === "insufficient" ? (
              <div className="space-y-5">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                    {copy.result.title}
                  </p>
                  <h2 className="mt-2 text-[22px] font-semibold tracking-[-0.03em] text-slate-950">
                    {copy.result.insufficientTitle}
                  </h2>
                  <p className="mt-3 text-[14px] leading-6 text-slate-600">
                    {previewState.result.message || copy.result.insufficientText}
                  </p>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-[0_10px_24px_rgba(15,23,42,0.06)]">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                      {copy.result.declaredPrice}
                    </p>
                    <p className="mt-2 text-2xl font-semibold text-slate-950">
                      {formatCurrencyValue(
                        locale,
                        previewState.result.market.currency,
                        previewState.result.declaredNightlyPrice,
                      )}
                    </p>
                  </div>

                  <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-[0_10px_24px_rgba(15,23,42,0.06)]">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                      {copy.form.platformLabel}
                    </p>
                    <p className="mt-2 text-lg font-semibold text-slate-950">
                      {copy.options.platform[previewState.result.market.platform]}
                    </p>
                    <p className="mt-1 text-sm text-slate-600">
                      {previewState.result.market.city}, {previewState.result.market.country}
                    </p>
                  </div>
                </div>

                <div className="rounded-2xl border border-slate-200 bg-slate-50/80 p-4">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                    {copy.result.limitationsTitle}
                  </p>
                  <ul className="mt-3 space-y-2 text-sm leading-6 text-slate-600">
                    {previewState.result.limitations.map((item) => (
                      <li key={item}>• {item}</li>
                    ))}
                  </ul>
                </div>

                <Link
                  href={FULL_AUDIT_CTA_HREF}
                  className="nk-primary-btn inline-flex w-full items-center justify-center text-xs font-semibold uppercase tracking-[0.18em] sm:w-auto"
                >
                  {copy.cta.primary}
                </Link>
              </div>
            ) : null}

            {previewState.kind === "error" ? (
              <div className="space-y-4">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                    {copy.result.title}
                  </p>
                  <h2 className="mt-2 text-[22px] font-semibold tracking-[-0.03em] text-slate-950">
                    {previewState.title}
                  </h2>
                  <p className="mt-3 text-[14px] leading-6 text-slate-600">
                    {previewState.message}
                  </p>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-slate-50/80 p-4 text-sm text-slate-600">
                  {copy.result.text}
                </div>
              </div>
            ) : null}
          </section>
        </section>

        <section className="grid gap-4 md:grid-cols-2">
          <div className="nk-card rounded-[28px] border border-slate-200 bg-white p-5 shadow-[0_18px_44px_rgba(15,23,42,0.08)] md:p-6">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
              {copy.compare.freeTitle}
            </p>
            <h2 className="mt-2 text-[22px] font-semibold tracking-[-0.03em] text-slate-950">
              {copy.compare.title}
            </h2>
            <ul className="mt-4 space-y-2 text-sm leading-6 text-slate-700">
              {copy.compare.freeItems.map((item) => (
                <li key={item}>• {item}</li>
              ))}
            </ul>
          </div>

          <div className="nk-card rounded-[28px] border border-emerald-200 bg-[linear-gradient(180deg,rgba(255,255,255,0.99)_0%,rgba(236,253,245,0.82)_100%)] p-5 shadow-[0_18px_44px_rgba(16,185,129,0.12)] md:p-6">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-emerald-700">
              {copy.compare.fullTitle}
            </p>
            <h2 className="mt-2 text-[22px] font-semibold tracking-[-0.03em] text-slate-950">
              {copy.compare.fullTitle}
            </h2>
            <ul className="mt-4 space-y-2 text-sm leading-6 text-slate-700">
              {copy.compare.fullItems.map((item) => (
                <li key={item}>• {item}</li>
              ))}
            </ul>
          </div>
        </section>

        <section className="nk-card flex flex-col gap-4 rounded-[28px] border border-slate-200 bg-[linear-gradient(180deg,rgba(255,255,255,0.99)_0%,rgba(248,250,252,0.97)_100%)] px-5 py-6 shadow-[0_18px_48px_rgba(15,23,42,0.08)] md:flex-row md:items-center md:justify-between md:px-6">
          <div className="max-w-2xl">
            <h2 className="text-[24px] font-semibold tracking-[-0.03em] text-slate-950 md:text-[28px]">
              {copy.cta.title}
            </h2>
            <p className="mt-2 text-[14px] leading-7 text-slate-600">
              {copy.cta.text}
            </p>
            <p className="mt-2 text-xs text-slate-500">{copy.cta.reassurance}</p>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <Link
              href={FULL_AUDIT_CTA_HREF}
              className="nk-primary-btn text-center text-xs font-semibold uppercase tracking-[0.18em]"
            >
              {copy.cta.primary}
            </Link>
            <Link
              href={FULL_AUDIT_CTA_HREF}
              className="inline-flex items-center justify-center rounded-2xl border border-slate-200 bg-white px-5 py-3 text-xs font-semibold uppercase tracking-[0.18em] text-slate-700 shadow-[0_8px_24px_rgba(15,23,42,0.06)] transition hover:bg-slate-50"
            >
              {copy.cta.secondary}
            </Link>
          </div>
        </section>
      </main>
    </MarketingPageShell>
  );
}

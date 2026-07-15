"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { type MouseEvent, useState } from "react";

import { MarketingPageShell } from "@/components/marketing/MarketingPageShell";
import { useTranslation } from "@/components/i18n/useTranslation";
import type {
  FreeAuditMarketOverviewAvailable,
  FreeAuditMarketOverviewInsufficientCoverage,
} from "@/lib/freeAudit/publicPricingPreviewContract";
import { saveFreeAuditGuestDraft } from "@/lib/guestAuditDraft";
import { supabase } from "@/lib/supabase";

import {
  FREE_AUDIT_PLATFORM_OPTIONS,
  FREE_AUDIT_PROPERTY_TYPE_OPTIONS,
  buildFreeAuditHandoffDraftInput,
  formatCurrencyValue,
  mapPreviewErrorStatus,
  type FreeAuditFormErrorCode,
  type FreeAuditFormField,
  type FreeAuditFormValues,
  validateFreeAuditForm,
  detectSupportedPlatformFromListingUrl,
} from "./freeAuditPageModel";
import {
  freeAuditTranslations,
  type FreeAuditTranslationCopy,
} from "./freeAuditTranslations";

type PreviewState =
  | { kind: "idle" }
  | { kind: "submitting" }
  | { kind: "available"; result: FreeAuditMarketOverviewAvailable }
  | { kind: "insufficient"; result: FreeAuditMarketOverviewInsufficientCoverage }
  | { kind: "error"; title: string; message: string };

type RouteStatusBody = {
  status?: string;
  message?: string;
};

type PreviewUiLabels = Readonly<{
  rangeLabel: string;
  marketMedianLabel: string;
  marketNowTitle: string;
  lowPriceLabel: string;
  medianPriceLabel: string;
  highPriceLabel: string;
  compareToMarket: string;
}>;

type FullAuditRevealCopy = Readonly<{
  title: string;
  subtitle: string;
  cards: readonly Readonly<{
    icon: string;
    title: string;
    text: string;
  }>[];
  journeyTitle: string;
  steps: readonly Readonly<{
    step: string;
    title: string;
    text: string;
  }>[];
  cta: string;
}>;

const FULL_AUDIT_CTA_HREF = "/sign-in?next=/audit/new";

const PREVIEW_UI_LABELS: Record<string, PreviewUiLabels> = {
  en: {
    rangeLabel: "Observed range",
    marketMedianLabel: "Market median",
    marketNowTitle: "Current market",
    lowPriceLabel: "Low price",
    medianPriceLabel: "Median price",
    highPriceLabel: "High price",
    compareToMarket: "Compare my listing to this market",
  },
  fr: {
    rangeLabel: "Fourchette observee",
    marketMedianLabel: "Mediane marche",
    marketNowTitle: "Marche actuel",
    lowPriceLabel: "Prix bas",
    medianPriceLabel: "Prix median",
    highPriceLabel: "Prix haut",
    compareToMarket: "Comparer mon annonce a ce marche",
  },
  es: {
    rangeLabel: "Rango observado",
    marketMedianLabel: "Mediana del mercado",
    marketNowTitle: "Mercado actual",
    lowPriceLabel: "Precio bajo",
    medianPriceLabel: "Precio mediano",
    highPriceLabel: "Precio alto",
    compareToMarket: "Comparar mi anuncio con este mercado",
  },
  it: {
    rangeLabel: "Fascia osservata",
    marketMedianLabel: "Mediana di mercato",
    marketNowTitle: "Mercato attuale",
    lowPriceLabel: "Prezzo basso",
    medianPriceLabel: "Prezzo mediano",
    highPriceLabel: "Prezzo alto",
    compareToMarket: "Confronta il mio annuncio con questo mercato",
  },
  pt: {
    rangeLabel: "Faixa observada",
    marketMedianLabel: "Mediana do mercado",
    marketNowTitle: "Mercado atual",
    lowPriceLabel: "Preco baixo",
    medianPriceLabel: "Preco mediano",
    highPriceLabel: "Preco alto",
    compareToMarket: "Comparar meu anuncio com este mercado",
  },
  nl: {
    rangeLabel: "Waargenomen bereik",
    marketMedianLabel: "Marktmediaan",
    marketNowTitle: "Huidige markt",
    lowPriceLabel: "Lage prijs",
    medianPriceLabel: "Mediaanprijs",
    highPriceLabel: "Hoge prijs",
    compareToMarket: "Vergelijk mijn advertentie met deze markt",
  },
  de: {
    rangeLabel: "Beobachtete Spanne",
    marketMedianLabel: "Marktmedian",
    marketNowTitle: "Aktueller Markt",
    lowPriceLabel: "Niedriger Preis",
    medianPriceLabel: "Medianpreis",
    highPriceLabel: "Hoher Preis",
    compareToMarket: "Mein Inserat mit diesem Markt vergleichen",
  },
  ja: {
    rangeLabel: "観測レンジ",
    marketMedianLabel: "市場中央値",
    marketNowTitle: "現在の市場",
    lowPriceLabel: "低価格",
    medianPriceLabel: "中央値",
    highPriceLabel: "高価格",
    compareToMarket: "この市場と自分の掲載を比較する",
  },
  zh: {
    rangeLabel: "观察区间",
    marketMedianLabel: "市场中位数",
    marketNowTitle: "当前市场",
    lowPriceLabel: "低价",
    medianPriceLabel: "中位价",
    highPriceLabel: "高价",
    compareToMarket: "将我的房源与该市场比较",
  },
  ko: {
    rangeLabel: "관측 범위",
    marketMedianLabel: "시장 중앙값",
    marketNowTitle: "현재 시장",
    lowPriceLabel: "저가",
    medianPriceLabel: "중간 가격",
    highPriceLabel: "고가",
    compareToMarket: "내 숙소를 이 시장과 비교하기",
  },
  ar: {
    rangeLabel: "النطاق المرصود",
    marketMedianLabel: "وسيط السوق",
    marketNowTitle: "السوق الحالي",
    lowPriceLabel: "السعر المنخفض",
    medianPriceLabel: "السعر الوسيط",
    highPriceLabel: "السعر المرتفع",
    compareToMarket: "قارن اعلاني بهذا السوق",
  },
};

const FULL_AUDIT_REVEAL_COPY: Record<string, FullAuditRevealCopy> = {
  en: {
    title: "What your full audit will reveal",
    subtitle:
      "The free preview shows the market. The full audit analyzes your actual listing.",
    cards: [
      {
        icon: "POS",
        title: "Your real position",
        text:
          "Compare your listing to competitors in your market and identify your exact positioning.",
      },
      {
        icon: "ADR",
        title: "Your pricing potential",
        text:
          "Discover price levels adapted to your property, your season, and your competitive environment.",
      },
      {
        icon: "CVR",
        title: "Your conversion levers",
        text:
          "Analyze your title, description, photos, amenities, and the elements that slow bookings down.",
      },
      {
        icon: "ACT",
        title: "Your priority actions",
        text:
          "Receive a clear action plan ranked by likely impact on your performance.",
      },
    ],
    journeyTitle: "Your journey with Norixo",
    steps: [
      {
        step: "01",
        title: "Free market preview",
        text: "Discover the observed range and the market median.",
      },
      {
        step: "02",
        title: "Complete listing analysis",
        text:
          "Norixo analyzes your content, your competitors, and your positioning.",
      },
      {
        step: "03",
        title: "Personalized action plan",
        text: "You receive concrete, prioritized recommendations.",
      },
    ],
    cta: "Unlock my full audit",
  },
  fr: {
    title: "Ce que votre audit complet va reveler",
    subtitle:
      "L'apercu gratuit vous montre le marche. L'audit complet analyse reellement votre annonce.",
    cards: [
      {
        icon: "POS",
        title: "Votre position reelle",
        text:
          "Comparez votre annonce aux concurrents de votre marche et identifiez votre positionnement exact.",
      },
      {
        icon: "ADR",
        title: "Votre potentiel tarifaire",
        text:
          "Decouvrez les niveaux de prix adaptes a votre logement, a votre saison et a votre environnement concurrentiel.",
      },
      {
        icon: "CVR",
        title: "Vos leviers de conversion",
        text:
          "Analysez votre titre, votre description, vos photos, vos equipements et les elements qui freinent les reservations.",
      },
      {
        icon: "ACT",
        title: "Vos actions prioritaires",
        text:
          "Recevez un plan d'action clair, classe selon l'impact potentiel sur vos performances.",
      },
    ],
    journeyTitle: "Votre parcours avec Norixo",
    steps: [
      {
        step: "01",
        title: "Apercu marche gratuit",
        text: "Decouvrez la fourchette et la mediane du marche.",
      },
      {
        step: "02",
        title: "Analyse complete de l'annonce",
        text:
          "Norixo analyse votre contenu, vos concurrents et votre positionnement.",
      },
      {
        step: "03",
        title: "Plan d'action personnalise",
        text: "Vous obtenez des recommandations concretes et prioritaires.",
      },
    ],
    cta: "Debloquer mon audit complet",
  },
};

function getFieldErrorMessage(
  copy: FreeAuditTranslationCopy,
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
  ];

  return orderedFields.find((field) => errors[field] != null) ?? null;
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
  copy: FreeAuditTranslationCopy,
  status: string | null | undefined,
): PreviewState {
  const mappedStatus = mapPreviewErrorStatus(status);
  return {
    kind: "error",
    title: copy.result.unavailableTitle,
    message: copy.errors[mappedStatus],
  };
}

function translateLimitations(
  copy: FreeAuditTranslationCopy,
  limitations: FreeAuditMarketOverviewAvailable["limitations"],
): string[] {
  return limitations.map((code) => copy.result.limitationCodes[code]);
}

function translateRecommendations(
  copy: FreeAuditTranslationCopy,
  recommendations: FreeAuditMarketOverviewAvailable["recommendations"],
): string[] {
  return recommendations.map((code) => copy.result.recommendationCodes[code]);
}

function getMarketPlatformLabel(
  copy: FreeAuditTranslationCopy,
  platform: FreeAuditMarketOverviewAvailable["market"]["platform"],
): string {
  return platform === "all"
    ? copy.result.marketScopeAllPlatforms
    : copy.options.platform[platform];
}

function getPreviewUiLabels(locale: string): PreviewUiLabels {
  return PREVIEW_UI_LABELS[locale] ?? PREVIEW_UI_LABELS.en;
}

function getFullAuditRevealCopy(locale: string): FullAuditRevealCopy {
  return FULL_AUDIT_REVEAL_COPY[locale] ?? FULL_AUDIT_REVEAL_COPY.en;
}

function getMedianPositionPercent(input: {
  lowPrice: number;
  medianPrice: number;
  highPrice: number;
}): number {
  const spread = input.highPrice - input.lowPrice;
  if (!Number.isFinite(spread) || spread <= 0) {
    return 50;
  }

  const rawPercent = ((input.medianPrice - input.lowPrice) / spread) * 100;
  return Math.min(100, Math.max(0, rawPercent));
}

export function FreeAuditContent() {
  const router = useRouter();
  const { locale, copy } = useTranslation(freeAuditTranslations);
  const uiLabels = getPreviewUiLabels(locale);
  const revealCopy = getFullAuditRevealCopy(locale);
  const [formValues, setFormValues] = useState<FreeAuditFormValues>({
    listingUrl: "",
    country: "",
    city: "",
    platform: "",
    propertyType: "",
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
      const errorField = field as FreeAuditFormField;
      if (current[errorField] == null) {
        return current;
      }

      const nextErrors = { ...current };
      delete nextErrors[errorField];
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

  function applyValidationErrors(
    errors: Partial<Record<FreeAuditFormField, FreeAuditFormErrorCode>>,
  ) {
    setFieldErrors(errors);
    setPreviewState({ kind: "idle" });
    setSubmitAnnouncement(copy.errors.invalid_request);

    const firstErrorField = getFirstErrorField(errors);
    if (firstErrorField != null) {
      const candidate = document.getElementById(`free-audit-${firstErrorField}`);
      candidate?.focus();
    }
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const validation = validateFreeAuditForm(formValues);
    if (!validation.ok) {
      applyValidationErrors(validation.errors);
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
          result: body as FreeAuditMarketOverviewAvailable,
        });
        setSubmitAnnouncement(copy.result.title);
        return;
      }

      if (response.ok && body?.status === "insufficient_coverage") {
        setPreviewState({
          kind: "insufficient",
          result: body as FreeAuditMarketOverviewInsufficientCoverage,
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

  async function handleFullAuditCtaClick(event: MouseEvent<HTMLAnchorElement>) {
    event.preventDefault();

    const validation = validateFreeAuditForm(formValues);
    if (!validation.ok) {
      applyValidationErrors(validation.errors);
      return;
    }

    if (!platformTouched && validation.detectedPlatform != null) {
      setFormValues((current) => ({
        ...current,
        platform: validation.detectedPlatform ?? current.platform,
      }));
    }

    setFieldErrors({});

    const handoffDraft = buildFreeAuditHandoffDraftInput(validation);
    saveFreeAuditGuestDraft(handoffDraft);

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      router.push(session ? "/audit/new" : FULL_AUDIT_CTA_HREF);
    } catch {
      router.push(FULL_AUDIT_CTA_HREF);
    }
  }

  const availableResult =
    previewState.kind === "available" ? previewState.result : null;
  const translatedAvailableLimitations =
    availableResult == null
      ? []
      : translateLimitations(copy, availableResult.limitations);
  const translatedAvailableRecommendations =
    availableResult == null
      ? []
      : translateRecommendations(copy, availableResult.recommendations);
  const medianPositionPercent =
    availableResult == null
      ? 50
      : getMedianPositionPercent({
          lowPrice: availableResult.benchmark.lowPrice,
          medianPrice: availableResult.benchmark.medianPrice,
          highPrice: availableResult.benchmark.highPrice,
        });

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

            <div className="mt-8 space-y-5 rounded-[24px] border border-slate-200/90 bg-[linear-gradient(180deg,rgba(255,255,255,0.98)_0%,rgba(248,250,252,0.95)_100%)] p-5 shadow-[0_14px_34px_rgba(15,23,42,0.07)]">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                  {revealCopy.title}
                </p>
                <p className="mt-2 text-[14px] leading-6 text-slate-600">
                  {revealCopy.subtitle}
                </p>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                {revealCopy.cards.map((card) => (
                  <div
                    key={card.title}
                    className="rounded-[22px] border border-slate-200 bg-white p-4 shadow-[0_10px_24px_rgba(15,23,42,0.05)]"
                  >
                    <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[linear-gradient(135deg,rgba(249,115,22,0.12)_0%,rgba(16,185,129,0.14)_100%)] text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-800">
                      {card.icon}
                    </div>
                    <h3 className="mt-4 text-base font-semibold tracking-[-0.02em] text-slate-950">
                      {card.title}
                    </h3>
                    <p className="mt-2 text-sm leading-6 text-slate-600">
                      {card.text}
                    </p>
                  </div>
                ))}
              </div>

              <div className="rounded-[22px] border border-slate-200 bg-slate-50/80 p-4">
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                  {revealCopy.journeyTitle}
                </p>
                <div className="mt-4 space-y-4">
                  {revealCopy.steps.map((step, index) => (
                    <div
                      key={step.step}
                      className="relative flex gap-4 rounded-2xl border border-slate-200 bg-white px-4 py-4 shadow-[0_8px_20px_rgba(15,23,42,0.04)]"
                    >
                      {index < revealCopy.steps.length - 1 ? (
                        <div className="absolute left-[1.55rem] top-12 h-[calc(100%-2rem)] w-px bg-slate-200" />
                      ) : null}
                      <div className="relative z-[1] flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-900 text-xs font-semibold text-white">
                        {step.step}
                      </div>
                      <div className="min-w-0">
                        <h3 className="text-sm font-semibold text-slate-950">
                          {step.title}
                        </h3>
                        <p className="mt-1 text-sm leading-6 text-slate-600">
                          {step.text}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <Link
                href={FULL_AUDIT_CTA_HREF}
                onClick={handleFullAuditCtaClick}
                className="nk-primary-btn inline-flex w-full items-center justify-center text-center text-xs font-semibold uppercase tracking-[0.18em]"
              >
                {revealCopy.cta}
              </Link>
            </div>
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

                <div className="rounded-[24px] border border-slate-200/90 bg-[linear-gradient(180deg,rgba(255,255,255,0.98)_0%,rgba(248,250,252,0.96)_100%)] p-4 shadow-[0_12px_28px_rgba(15,23,42,0.08)] md:p-5">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                        {uiLabels.rangeLabel}
                      </p>
                      <p className="mt-2 text-lg font-semibold text-slate-950 sm:text-xl">
                        {formatCurrencyValue(
                          locale,
                          previewState.result.benchmark.currency,
                          previewState.result.benchmark.lowPrice,
                        )}{" "}
                        -{" "}
                        {formatCurrencyValue(
                          locale,
                          previewState.result.benchmark.currency,
                          previewState.result.benchmark.highPrice,
                        )}
                      </p>
                    </div>

                    <div className="rounded-2xl border border-orange-200 bg-orange-50/80 px-4 py-3 shadow-[0_8px_18px_rgba(251,146,60,0.10)]">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-orange-700">
                        {copy.result.marketTitle}
                      </p>
                      <p className="mt-1 text-base font-semibold text-slate-950">
                        {getMarketPlatformLabel(copy, previewState.result.market.platform)}
                      </p>
                      <p className="text-sm text-slate-700">
                        {previewState.result.market.city}, {previewState.result.market.country}
                      </p>
                    </div>
                  </div>

                  <div className="mt-5">
                    <div className="flex items-center justify-between text-sm font-medium text-slate-600">
                      <span>
                        {formatCurrencyValue(
                          locale,
                          previewState.result.benchmark.currency,
                          previewState.result.benchmark.lowPrice,
                        )}
                      </span>
                      <span>
                        {formatCurrencyValue(
                          locale,
                          previewState.result.benchmark.currency,
                          previewState.result.benchmark.highPrice,
                        )}
                      </span>
                    </div>

                    <div className="relative mt-4 px-1 pb-14 pt-8">
                      <div className="h-3 rounded-full bg-slate-200/90">
                        <div className="h-3 rounded-full bg-gradient-to-r from-emerald-400 via-amber-300 to-orange-400" />
                      </div>
                      <div
                        className="absolute top-0 -translate-x-1/2"
                        style={{ left: `${medianPositionPercent}%` }}
                      >
                        <div className="flex flex-col items-center">
                          <div className="rounded-full border border-orange-300 bg-white px-3 py-1 text-sm font-semibold text-slate-950 shadow-[0_8px_18px_rgba(15,23,42,0.10)]">
                            {formatCurrencyValue(
                              locale,
                              previewState.result.benchmark.currency,
                              previewState.result.benchmark.medianPrice,
                            )}
                          </div>
                          <div className="mt-2 h-4 w-4 rounded-full border-4 border-white bg-orange-500 shadow-[0_4px_12px_rgba(249,115,22,0.35)]" />
                          <p className="mt-2 text-center text-xs font-medium text-slate-600">
                            {uiLabels.marketMedianLabel}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="grid gap-3 sm:grid-cols-3">
                  <div className="rounded-[22px] border border-slate-200 bg-white p-4 shadow-[0_10px_24px_rgba(15,23,42,0.06)]">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                      {uiLabels.marketNowTitle}
                    </p>
                    <p className="mt-3 text-xs font-medium text-slate-500">
                      {uiLabels.lowPriceLabel}
                    </p>
                    <p className="mt-1 text-2xl font-semibold tracking-[-0.03em] text-slate-950">
                      {formatCurrencyValue(
                        locale,
                        previewState.result.benchmark.currency,
                        previewState.result.benchmark.lowPrice,
                      )}
                    </p>
                  </div>
                  <div className="rounded-[22px] border border-orange-200 bg-orange-50/80 p-4 shadow-[0_10px_24px_rgba(251,146,60,0.10)]">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-orange-700">
                      {uiLabels.medianPriceLabel}
                    </p>
                    <p className="mt-3 text-xs font-medium text-orange-700/80">
                      {uiLabels.marketMedianLabel}
                    </p>
                    <p className="mt-1 text-2xl font-semibold tracking-[-0.03em] text-slate-950">
                      {formatCurrencyValue(
                        locale,
                        previewState.result.benchmark.currency,
                        previewState.result.benchmark.medianPrice,
                      )}
                    </p>
                  </div>
                  <div className="rounded-[22px] border border-slate-200 bg-white p-4 shadow-[0_10px_24px_rgba(15,23,42,0.06)]">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                      {uiLabels.highPriceLabel}
                    </p>
                    <p className="mt-3 text-xs font-medium text-slate-500">
                      {uiLabels.highPriceLabel}
                    </p>
                    <p className="mt-1 text-2xl font-semibold tracking-[-0.03em] text-slate-950">
                      {formatCurrencyValue(
                        locale,
                        previewState.result.benchmark.currency,
                        previewState.result.benchmark.highPrice,
                      )}
                    </p>
                  </div>
                </div>

                <div className="rounded-[24px] border border-sky-200 bg-[linear-gradient(180deg,rgba(240,249,255,0.96)_0%,rgba(224,242,254,0.90)_100%)] p-4 shadow-[0_10px_24px_rgba(56,189,248,0.10)]">
                  <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                    <div>
                      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-sky-700">
                        {copy.result.confidenceTitle}
                      </p>
                      <div className="mt-3 flex items-center gap-3">
                        <span
                          className={`h-3.5 w-3.5 rounded-full ${
                            previewState.result.confidence.level === "high"
                              ? "bg-emerald-500"
                              : "bg-sky-500"
                          }`}
                        />
                        <p className="text-base font-semibold text-slate-950">
                          {copy.result.confidenceLevel[previewState.result.confidence.level]}
                        </p>
                      </div>
                    </div>

                    <div className="min-w-0 flex-1 md:max-w-[280px]">
                      <div className="flex gap-2">
                        {[0, 1, 2, 3].map((segment) => {
                          const filledSegments =
                            previewState.result.confidence.level === "high" ? 4 : 2;

                          return (
                            <span
                              key={segment}
                              className={`h-2.5 flex-1 rounded-full ${
                                segment < filledSegments
                                  ? "bg-gradient-to-r from-sky-500 to-emerald-400"
                                  : "bg-white/80"
                              }`}
                            />
                          );
                        })}
                      </div>
                      <p className="mt-3 text-sm text-slate-700">
                        <span className="font-medium text-slate-950">
                          {copy.result.sampleBand[previewState.result.confidence.sampleBand]}
                        </span>
                      </p>
                    </div>
                  </div>
                </div>

                <div className="rounded-[24px] border border-slate-200 bg-white p-4 shadow-[0_10px_24px_rgba(15,23,42,0.06)]">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                    {copy.result.limitationsTitle}
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {translatedAvailableLimitations.map((item) => (
                      <span
                        key={item}
                        className="inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-medium text-slate-700 shadow-[0_4px_12px_rgba(15,23,42,0.04)]"
                      >
                        {item}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="rounded-[24px] border border-slate-200 bg-white p-4 shadow-[0_10px_24px_rgba(15,23,42,0.06)]">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                    {copy.result.recommendationsTitle}
                  </p>
                  <div className="mt-3 grid gap-3">
                    {translatedAvailableRecommendations.map((item, index) => (
                      <div
                        key={item}
                        className="flex gap-3 rounded-2xl border border-slate-200 bg-[linear-gradient(180deg,rgba(255,255,255,0.99)_0%,rgba(248,250,252,0.95)_100%)] p-4 shadow-[0_6px_16px_rgba(15,23,42,0.05)]"
                      >
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-orange-400 to-emerald-400 text-sm font-semibold text-white">
                          {String(index + 1).padStart(2, "0")}
                        </div>
                        <p className="text-sm leading-6 text-slate-700">{item}</p>
                      </div>
                    ))}
                  </div>
                </div>

                <Link
                  href={FULL_AUDIT_CTA_HREF}
                  onClick={handleFullAuditCtaClick}
                  className="nk-primary-btn inline-flex w-full items-center justify-center text-center text-xs font-semibold uppercase tracking-[0.18em]"
                >
                  {uiLabels.compareToMarket}
                </Link>
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
                    {copy.result.insufficientText}
                  </p>
                </div>

                <div className="rounded-[24px] border border-slate-200 bg-white p-4 shadow-[0_10px_24px_rgba(15,23,42,0.06)]">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                    {copy.result.marketTitle}
                  </p>
                  <p className="mt-2 text-lg font-semibold text-slate-950">
                    {getMarketPlatformLabel(copy, previewState.result.market.platform)}
                  </p>
                  <p className="mt-1 text-sm text-slate-600">
                    {previewState.result.market.city}, {previewState.result.market.country}
                  </p>
                </div>

                <div className="rounded-[24px] border border-slate-200 bg-slate-50/80 p-4">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                    {copy.result.limitationsTitle}
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {translateLimitations(copy, previewState.result.limitations).map((item) => (
                      <span
                        key={item}
                        className="inline-flex items-center rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 shadow-[0_4px_12px_rgba(15,23,42,0.04)]"
                      >
                        {item}
                      </span>
                    ))}
                  </div>
                </div>

                <Link
                  href={FULL_AUDIT_CTA_HREF}
                  onClick={handleFullAuditCtaClick}
                  className="nk-primary-btn inline-flex w-full items-center justify-center text-center text-xs font-semibold uppercase tracking-[0.18em]"
                >
                  {uiLabels.compareToMarket}
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
              onClick={handleFullAuditCtaClick}
              className="nk-primary-btn text-center text-xs font-semibold uppercase tracking-[0.18em]"
            >
              {copy.cta.primary}
            </Link>
            <Link
              href={FULL_AUDIT_CTA_HREF}
              onClick={handleFullAuditCtaClick}
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

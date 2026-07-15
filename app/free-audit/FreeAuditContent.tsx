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

const FULL_AUDIT_CTA_HREF = "/sign-in?next=/audit/new";

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

export function FreeAuditContent() {
  const router = useRouter();
  const { locale, copy } = useTranslation(freeAuditTranslations);
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
                      {copy.result.benchmarkRange}
                    </p>
                    <p className="mt-2 text-xl font-semibold text-slate-950">
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
                    <p className="mt-2 text-sm text-slate-600">
                      {copy.result.medianPrice}:{" "}
                      <span className="font-medium text-slate-900">
                        {formatCurrencyValue(
                          locale,
                          previewState.result.benchmark.currency,
                          previewState.result.benchmark.medianPrice,
                        )}
                      </span>
                    </p>
                  </div>
                  <div className="rounded-2xl border border-orange-200 bg-orange-50/70 p-4 shadow-[0_10px_24px_rgba(251,146,60,0.10)]">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-orange-700">
                      {copy.result.marketTitle}
                    </p>
                    <p className="mt-2 text-lg font-semibold text-slate-950">
                      {getMarketPlatformLabel(copy, previewState.result.market.platform)}
                    </p>
                    <p className="mt-1 text-sm text-slate-700">
                      {previewState.result.market.city}, {previewState.result.market.country}
                    </p>
                  </div>
                </div>

                <div className="rounded-2xl border border-sky-200 bg-sky-50/70 p-4 shadow-[0_10px_24px_rgba(56,189,248,0.10)]">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-sky-700">
                    {copy.result.confidenceTitle}
                  </p>
                  <p className="mt-2 text-sm font-semibold text-slate-950">
                    {copy.result.confidenceLevel[previewState.result.confidence.level]}
                  </p>
                  <p className="mt-1 text-sm text-slate-700">
                    {copy.result.sampleBand[previewState.result.confidence.sampleBand]}
                  </p>
                </div>

                <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-[0_10px_24px_rgba(15,23,42,0.06)]">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                    {copy.result.recommendationsTitle}
                  </p>
                  <ul className="mt-3 space-y-2 text-sm leading-6 text-slate-700">
                    {translateRecommendations(copy, previewState.result.recommendations).map((item) => (
                      <li key={item}>• {item}</li>
                    ))}
                  </ul>
                </div>

                <div className="rounded-2xl border border-slate-200 bg-slate-50/80 p-4">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                    {copy.result.limitationsTitle}
                  </p>
                  <ul className="mt-3 space-y-2 text-sm leading-6 text-slate-600">
                    {translateLimitations(copy, previewState.result.limitations).map((item) => (
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
                    {copy.result.insufficientText}
                  </p>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-[0_10px_24px_rgba(15,23,42,0.06)]">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                      {copy.form.platformLabel}
                    </p>
                    <p className="mt-2 text-lg font-semibold text-slate-950">
                      {getMarketPlatformLabel(copy, previewState.result.market.platform)}
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
                    {translateLimitations(copy, previewState.result.limitations).map((item) => (
                      <li key={item}>• {item}</li>
                    ))}
                  </ul>
                </div>

                <Link
                  href={FULL_AUDIT_CTA_HREF}
                  onClick={handleFullAuditCtaClick}
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

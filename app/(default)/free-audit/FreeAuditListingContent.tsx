"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { type MouseEvent, useState } from "react";

import { useTranslation } from "@/components/i18n/useTranslation";
import { AuthorityTrustLayer } from "@/components/marketing/AuthorityTrustLayer";
import { MarketingPageShell } from "@/components/marketing/MarketingPageShell";
import { authorityTrustI18n } from "@/data/marketing/authorityTrustI18n";
import type { FreeListingAuditAvailable } from "@/lib/freeAudit/publicListingAuditContract";
import { saveFreeAuditGuestDraft } from "@/lib/guestAuditDraft";
import { supabase } from "@/lib/supabase";

import { FreeAuditListingResult } from "./FreeAuditListingResult";
import {
  FREE_AUDIT_PLATFORM_OPTIONS,
  FREE_AUDIT_PROPERTY_TYPE_OPTIONS,
  buildFreeAuditHandoffDraftInput,
  detectSupportedPlatformFromListingUrl,
  mapPreviewErrorStatus,
  type FreeAuditFormErrorCode,
  type FreeAuditFormField,
  type FreeAuditFormValues,
  validateFreeAuditForm,
} from "./freeAuditPageModel";
import { freeAuditListingModeCopy } from "./freeAuditListingModeCopy";
import { freeAuditTranslations } from "./freeAuditTranslations";

const FULL_AUDIT_CTA_HREF = "/sign-in?next=/audit/new";
const PREMIUM_CARD_BADGES = ["POS", "ADR", "CVR", "ACT"] as const;

type PreviewState =
  | { kind: "idle" }
  | { kind: "submitting" }
  | { kind: "available"; result: FreeListingAuditAvailable }
  | { kind: "error"; title: string; message: string };

type RouteBody = {
  status?: string;
  message?: string;
  listing?: unknown;
};

function isPublicListingAuditAvailable(value: unknown): value is FreeListingAuditAvailable {
  if (value == null || typeof value !== "object" || Array.isArray(value)) return false;
  const candidate = value as Record<string, unknown>;
  return (
    candidate.status === "available" &&
    candidate.listing != null &&
    typeof candidate.listing === "object" &&
    typeof candidate.score === "number" &&
    Array.isArray(candidate.insights) &&
    Array.isArray(candidate.recommendations) &&
    candidate.trust != null &&
    typeof candidate.trust === "object" &&
    candidate.market != null &&
    typeof candidate.market === "object" &&
    candidate.availability != null &&
    typeof candidate.availability === "object" &&
    Array.isArray(candidate.lockedSections)
  );
}

async function parseRouteBody(response: Response): Promise<RouteBody | null> {
  try {
    return (await response.json()) as RouteBody;
  } catch {
    return null;
  }
}

function getFirstErrorField(
  errors: Partial<Record<FreeAuditFormField, FreeAuditFormErrorCode>>,
): FreeAuditFormField | null {
  const ordered: FreeAuditFormField[] = [
    "listingUrl",
    "country",
    "city",
    "platform",
    "propertyType",
  ];
  return ordered.find((field) => errors[field] != null) ?? null;
}

export function FreeAuditListingContent() {
  const router = useRouter();
  const { locale, copy } = useTranslation(freeAuditTranslations);
  const listingCopy = freeAuditListingModeCopy[locale];
  const authorityCopy = authorityTrustI18n[locale].freeAudit;
  const isRtl = locale === "ar";

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
  const [announcement, setAnnouncement] = useState("");
  const [platformTouched, setPlatformTouched] = useState(false);

  function updateField<K extends keyof FreeAuditFormValues>(
    field: K,
    value: FreeAuditFormValues[K],
  ) {
    setFormValues((current) => ({ ...current, [field]: value }));
    setFieldErrors((current) => {
      if (current[field as FreeAuditFormField] == null) return current;
      const next = { ...current };
      delete next[field as FreeAuditFormField];
      return next;
    });
  }

  function handleListingUrlBlur() {
    if (platformTouched) return;
    const detected = detectSupportedPlatformFromListingUrl(formValues.listingUrl);
    if (detected != null) {
      setFormValues((current) => ({ ...current, platform: detected }));
    }
  }

  function applyValidationErrors(
    errors: Partial<Record<FreeAuditFormField, FreeAuditFormErrorCode>>,
  ) {
    setFieldErrors(errors);
    setPreviewState({ kind: "idle" });
    setAnnouncement(copy.errors.invalid_request);
    const first = getFirstErrorField(errors);
    if (first) document.getElementById(`free-audit-${first}`)?.focus();
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const validation = validateFreeAuditForm(formValues);
    if (!validation.ok) {
      applyValidationErrors(validation.errors);
      return;
    }

    if (!platformTouched) {
      setFormValues((current) => ({
        ...current,
        platform: validation.detectedPlatform,
      }));
    }

    setFieldErrors({});
    setPreviewState({ kind: "submitting" });
    setAnnouncement(listingCopy.statusLoading);

    try {
      const response = await fetch("/api/free-audit/preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(validation.payload),
      });
      const body = await parseRouteBody(response);

      if (response.ok && isPublicListingAuditAvailable(body)) {
        setPreviewState({ kind: "available", result: body });
        setAnnouncement(listingCopy.heroEyebrow);
        return;
      }

      const status = body?.status ?? (response.status === 429 ? "rate_limited" : "unavailable");
      const mapped = mapPreviewErrorStatus(status);
      setPreviewState({
        kind: "error",
        title: copy.result.unavailableTitle,
        message: copy.errors[mapped],
      });
      setAnnouncement(copy.errors[mapped]);
    } catch {
      setPreviewState({
        kind: "error",
        title: copy.result.unavailableTitle,
        message: copy.errors.network_error,
      });
      setAnnouncement(copy.errors.network_error);
    }
  }

  async function handleFullAuditCtaClick(event: MouseEvent<HTMLAnchorElement>) {
    event.preventDefault();
    const validation = validateFreeAuditForm(formValues);
    if (!validation.ok) {
      applyValidationErrors(validation.errors);
      return;
    }

    saveFreeAuditGuestDraft(buildFreeAuditHandoffDraftInput(validation));

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
      <main className="nk-section space-y-10 md:space-y-12" dir={isRtl ? "rtl" : undefined}>
        <section className="rounded-[28px] nk-border bg-[radial-gradient(circle_at_0_0,rgba(251,146,60,0.10),transparent_58%),radial-gradient(circle_at_100%_100%,rgba(16,185,129,0.10),transparent_56%),linear-gradient(180deg,rgba(255,255,255,0.99)_0%,rgba(248,250,252,0.98)_100%)] px-5 py-6 shadow-[0_18px_52px_rgba(15,23,42,0.12)] md:p-7">
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-orange-500">{listingCopy.heroEyebrow}</p>
          <h1 className="mt-2 max-w-4xl text-balance bg-gradient-to-r from-orange-500 via-amber-400 to-emerald-400 bg-clip-text text-4xl font-semibold tracking-tight text-transparent sm:text-5xl md:text-6xl">{listingCopy.heroTitle}</h1>
          <p className="mt-3 max-w-3xl text-[15px] leading-7 text-slate-600">{listingCopy.heroSubtitle}</p>
          <div className="mt-4 inline-flex rounded-full border border-emerald-200 bg-emerald-50/90 px-3 py-1.5 text-[11px] font-medium text-emerald-800">{listingCopy.reassurance}</div>
        </section>

        <section className="grid gap-5 xl:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)] xl:items-start">
          <section className="nk-card rounded-[28px] border border-slate-200/90 bg-white p-5 shadow-[0_18px_48px_rgba(15,23,42,0.08)] md:p-7">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">{listingCopy.formTitle}</p>
            <p className="mt-2 text-[14px] leading-6 text-slate-600">{listingCopy.formText}</p>

            <form className="mt-6 space-y-4" onSubmit={handleSubmit} noValidate>
              <div className="space-y-1.5">
                <label htmlFor="free-audit-listingUrl" className="text-sm font-medium text-slate-800">{listingCopy.listingUrlLabel}</label>
                <input id="free-audit-listingUrl" type="url" value={formValues.listingUrl} onChange={(event) => updateField("listingUrl", event.target.value)} onBlur={handleListingUrlBlur} placeholder={copy.form.listingUrlPlaceholder} className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-orange-500 focus:ring-2 focus:ring-orange-100" aria-invalid={fieldErrors.listingUrl != null} />
                <p className={`text-xs ${fieldErrors.listingUrl ? "text-rose-600" : "text-slate-500"}`}>{fieldErrors.listingUrl ? copy.errors.listing_url_invalid : listingCopy.helper}</p>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-1.5">
                  <label htmlFor="free-audit-country" className="text-sm font-medium text-slate-800">{copy.form.countryLabel}</label>
                  <input id="free-audit-country" value={formValues.country} onChange={(event) => updateField("country", event.target.value)} placeholder={copy.form.countryPlaceholder} className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-orange-500 focus:ring-2 focus:ring-orange-100" aria-invalid={fieldErrors.country != null} />
                  {fieldErrors.country ? <p className="text-xs text-rose-600">{copy.errors.country_required}</p> : null}
                </div>
                <div className="space-y-1.5">
                  <label htmlFor="free-audit-city" className="text-sm font-medium text-slate-800">{copy.form.cityLabel}</label>
                  <input id="free-audit-city" value={formValues.city} onChange={(event) => updateField("city", event.target.value)} placeholder={copy.form.cityPlaceholder} className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-orange-500 focus:ring-2 focus:ring-orange-100" aria-invalid={fieldErrors.city != null} />
                  {fieldErrors.city ? <p className="text-xs text-rose-600">{copy.errors.city_required}</p> : null}
                </div>
                <div className="space-y-1.5">
                  <label htmlFor="free-audit-platform" className="text-sm font-medium text-slate-800">{copy.form.platformLabel}</label>
                  <select id="free-audit-platform" value={formValues.platform} onChange={(event) => { setPlatformTouched(true); updateField("platform", event.target.value as FreeAuditFormValues["platform"]); }} className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-orange-500 focus:ring-2 focus:ring-orange-100" aria-invalid={fieldErrors.platform != null}>
                    <option value="">{copy.form.platformPlaceholder}</option>
                    {FREE_AUDIT_PLATFORM_OPTIONS.map((platform) => <option key={platform} value={platform}>{copy.options.platform[platform]}</option>)}
                  </select>
                  {fieldErrors.platform ? <p className="text-xs text-rose-600">{copy.errors.platform_required}</p> : null}
                </div>
                <div className="space-y-1.5">
                  <label htmlFor="free-audit-propertyType" className="text-sm font-medium text-slate-800">{copy.form.propertyTypeLabel}</label>
                  <select id="free-audit-propertyType" value={formValues.propertyType} onChange={(event) => updateField("propertyType", event.target.value as FreeAuditFormValues["propertyType"])} className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-orange-500 focus:ring-2 focus:ring-orange-100" aria-invalid={fieldErrors.propertyType != null}>
                    <option value="">{copy.form.propertyTypePlaceholder}</option>
                    {FREE_AUDIT_PROPERTY_TYPE_OPTIONS.map((propertyType) => <option key={propertyType} value={propertyType}>{copy.options.propertyType[propertyType]}</option>)}
                  </select>
                  {fieldErrors.propertyType ? <p className="text-xs text-rose-600">{copy.errors.property_type_required}</p> : null}
                </div>
              </div>

              <div className="flex flex-col gap-3 pt-2 sm:flex-row sm:items-center sm:justify-between">
                <button type="submit" disabled={previewState.kind === "submitting"} className="nk-primary-btn w-full text-xs font-semibold uppercase tracking-[0.18em] disabled:cursor-not-allowed disabled:opacity-70 sm:w-auto">{previewState.kind === "submitting" ? listingCopy.submitLoading : listingCopy.submitIdle}</button>
                <p className="text-xs text-slate-500" aria-live="polite">{announcement}</p>
              </div>
            </form>

            <div className="mt-8 space-y-5 rounded-[24px] border border-slate-200 bg-slate-50/70 p-5">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">{copy.premium.revealTitle}</p>
                <p className="mt-2 text-sm leading-6 text-slate-600">{locale === "fr"
                  ? "L'audit gratuit analyse déjà une partie de votre annonce. L'audit complet débloque le positionnement détaillé, l'occupation, la conversion et le plan d'action."
                  : copy.premium.revealSubtitle}</p>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                {copy.premium.revealCards.map((card, index) => (
                  <div key={card.title} className="rounded-[22px] border border-slate-200 bg-white p-4">
                    <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-slate-100 text-[10px] font-semibold text-slate-700">{PREMIUM_CARD_BADGES[index] ?? "AUD"}</div>
                    <h3 className="mt-3 text-base font-semibold text-slate-950">{card.title} 🔒</h3>
                    <p className="mt-2 text-sm leading-6 text-slate-600">{card.text}</p>
                  </div>
                ))}
              </div>
            </div>
          </section>

          <section className="nk-card rounded-[28px] border border-slate-200/90 bg-white p-5 shadow-[0_18px_48px_rgba(15,23,42,0.08)] md:p-7 xl:self-start">
            {previewState.kind === "idle" ? (
              <div className="space-y-4">
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">{listingCopy.heroEyebrow}</p>
                <h2 className="text-[22px] font-semibold tracking-[-0.03em] text-slate-950">{listingCopy.heroTitle}</h2>
                <p className="text-sm leading-6 text-slate-600">{listingCopy.formText}</p>
                <div className="rounded-[22px] border border-slate-200 bg-slate-50/80 p-4 text-sm leading-6 text-slate-600">Score global · constats clés · recommandations prioritaires · position marché · disponibilité détectée</div>
              </div>
            ) : null}

            {previewState.kind === "submitting" ? (
              <div className="space-y-5">
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-orange-600">{listingCopy.heroEyebrow}</p>
                <h2 className="text-[22px] font-semibold text-slate-950">{listingCopy.submitLoading}</h2>
                <p className="text-sm leading-6 text-slate-600">{listingCopy.statusLoading}</p>
                <div className="animate-pulse space-y-3 rounded-[24px] border border-slate-200 bg-slate-50/70 p-5">
                  <div className="h-4 w-1/3 rounded bg-slate-200" />
                  <div className="h-16 rounded bg-slate-200" />
                  <div className="grid gap-3 sm:grid-cols-3"><div className="h-20 rounded bg-slate-200" /><div className="h-20 rounded bg-slate-200" /><div className="h-20 rounded bg-slate-200" /></div>
                </div>
              </div>
            ) : null}

            {previewState.kind === "available" ? (
              <FreeAuditListingResult locale={locale} result={previewState.result} fullAuditHref={FULL_AUDIT_CTA_HREF} onFullAuditClick={handleFullAuditCtaClick} />
            ) : null}

            {previewState.kind === "error" ? (
              <div className="space-y-4">
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">{listingCopy.heroEyebrow}</p>
                <h2 className="text-[22px] font-semibold text-slate-950">{previewState.title}</h2>
                <p className="text-sm leading-6 text-slate-600">{previewState.message}</p>
              </div>
            ) : null}
          </section>
        </section>

        <AuthorityTrustLayer copy={authorityCopy} isRtl={isRtl} />

        <section className="nk-card flex flex-col gap-4 rounded-[28px] border border-slate-200 bg-white px-5 py-6 shadow-[0_18px_48px_rgba(15,23,42,0.08)] md:flex-row md:items-center md:justify-between md:px-6">
          <div className="max-w-2xl">
            <h2 className="text-[24px] font-semibold tracking-[-0.03em] text-slate-950">{copy.premium.revealTitle}</h2>
            <p className="mt-2 text-sm leading-7 text-slate-600">{copy.premium.revealSubtitle}</p>
          </div>
          <Link href={FULL_AUDIT_CTA_HREF} onClick={handleFullAuditCtaClick} className="nk-primary-btn text-center text-xs font-semibold uppercase tracking-[0.18em]">{copy.premium.unlockCta}</Link>
        </section>
      </main>
    </MarketingPageShell>
  );
}

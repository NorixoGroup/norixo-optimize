import Link from "next/link";
import type { MouseEvent } from "react";

import type { Locale } from "@/data/i18n";
import type { FreeListingAuditAvailable } from "@/lib/freeAudit/publicListingAuditContract";

const LABELS: Record<
  Locale,
  Readonly<{
    eyebrow: string;
    score: string;
    guestRating: string;
    market: string;
    availability: string;
    detected: string;
    unavailable: string;
    insights: string;
    recommendations: string;
    locked: string;
    comparables: string;
    extractionComplete: string;
    extractionPartial: string;
    extractionBlocked: string;
    unlock: string;
  }>
> = {
  en: { eyebrow: "Free listing audit", score: "Overall score", guestRating: "Guest rating", market: "Market", availability: "Availability", detected: "Detected", unavailable: "Not detected", insights: "Key findings", recommendations: "Priority recommendations", locked: "Full audit", comparables: "comparable listings", extractionComplete: "Complete extraction", extractionPartial: "Partial extraction", extractionBlocked: "Extraction blocked", unlock: "Unlock the full audit" },
  fr: { eyebrow: "Audit gratuit de l'annonce", score: "Score global", guestRating: "Note voyageurs", market: "Marché", availability: "Disponibilité", detected: "Détectée", unavailable: "Non détectée", insights: "Constats clés", recommendations: "Recommandations prioritaires", locked: "Audit complet", comparables: "annonces comparables", extractionComplete: "Extraction complète", extractionPartial: "Extraction partielle", extractionBlocked: "Extraction bloquée", unlock: "Débloquer l'audit complet" },
  es: { eyebrow: "Auditoría gratuita del anuncio", score: "Puntuación global", guestRating: "Valoración de huéspedes", market: "Mercado", availability: "Disponibilidad", detected: "Detectada", unavailable: "No detectada", insights: "Hallazgos clave", recommendations: "Recomendaciones prioritarias", locked: "Auditoría completa", comparables: "anuncios comparables", extractionComplete: "Extracción completa", extractionPartial: "Extracción parcial", extractionBlocked: "Extracción bloqueada", unlock: "Desbloquear la auditoría completa" },
  it: { eyebrow: "Audit gratuito dell'annuncio", score: "Punteggio complessivo", guestRating: "Valutazione ospiti", market: "Mercato", availability: "Disponibilità", detected: "Rilevata", unavailable: "Non rilevata", insights: "Risultati principali", recommendations: "Raccomandazioni prioritarie", locked: "Audit completo", comparables: "annunci comparabili", extractionComplete: "Estrazione completa", extractionPartial: "Estrazione parziale", extractionBlocked: "Estrazione bloccata", unlock: "Sblocca l'audit completo" },
  pt: { eyebrow: "Auditoria gratuita do anúncio", score: "Pontuação global", guestRating: "Avaliação dos hóspedes", market: "Mercado", availability: "Disponibilidade", detected: "Detetada", unavailable: "Não detetada", insights: "Principais conclusões", recommendations: "Recomendações prioritárias", locked: "Auditoria completa", comparables: "anúncios comparáveis", extractionComplete: "Extração completa", extractionPartial: "Extração parcial", extractionBlocked: "Extração bloqueada", unlock: "Desbloquear a auditoria completa" },
  nl: { eyebrow: "Gratis advertentie-audit", score: "Totaalscore", guestRating: "Gastbeoordeling", market: "Markt", availability: "Beschikbaarheid", detected: "Gedetecteerd", unavailable: "Niet gedetecteerd", insights: "Belangrijkste bevindingen", recommendations: "Prioritaire aanbevelingen", locked: "Volledige audit", comparables: "vergelijkbare advertenties", extractionComplete: "Volledige extractie", extractionPartial: "Gedeeltelijke extractie", extractionBlocked: "Extractie geblokkeerd", unlock: "Volledige audit ontgrendelen" },
  de: { eyebrow: "Kostenloser Inserat-Audit", score: "Gesamtbewertung", guestRating: "Gästebewertung", market: "Markt", availability: "Verfügbarkeit", detected: "Erkannt", unavailable: "Nicht erkannt", insights: "Wichtigste Erkenntnisse", recommendations: "Priorisierte Empfehlungen", locked: "Vollständiger Audit", comparables: "vergleichbare Inserate", extractionComplete: "Vollständige Extraktion", extractionPartial: "Teilweise Extraktion", extractionBlocked: "Extraktion blockiert", unlock: "Vollständigen Audit freischalten" },
  ja: { eyebrow: "無料リスティング監査", score: "総合スコア", guestRating: "ゲスト評価", market: "市場", availability: "空室状況", detected: "検出済み", unavailable: "未検出", insights: "主な所見", recommendations: "優先提案", locked: "完全監査", comparables: "件の比較対象", extractionComplete: "完全取得", extractionPartial: "部分取得", extractionBlocked: "取得ブロック", unlock: "完全監査を解除" },
  zh: { eyebrow: "免费房源审核", score: "总评分", guestRating: "住客评分", market: "市场", availability: "可订状态", detected: "已检测", unavailable: "未检测", insights: "关键发现", recommendations: "优先建议", locked: "完整审核", comparables: "个可比房源", extractionComplete: "完整提取", extractionPartial: "部分提取", extractionBlocked: "提取受阻", unlock: "解锁完整审核" },
  ko: { eyebrow: "무료 숙소 감사", score: "종합 점수", guestRating: "게스트 평점", market: "시장", availability: "예약 가능성", detected: "감지됨", unavailable: "감지되지 않음", insights: "핵심 진단", recommendations: "우선 권장사항", locked: "전체 감사", comparables: "개 비교 숙소", extractionComplete: "전체 추출", extractionPartial: "부분 추출", extractionBlocked: "추출 차단", unlock: "전체 감사 잠금 해제" },
  ar: { eyebrow: "تدقيق مجاني للإعلان", score: "النتيجة الإجمالية", guestRating: "تقييم الضيوف", market: "السوق", availability: "التوفر", detected: "تم الكشف", unavailable: "غير مكتشف", insights: "أهم النتائج", recommendations: "التوصيات ذات الأولوية", locked: "التدقيق الكامل", comparables: "إعلانات قابلة للمقارنة", extractionComplete: "استخراج كامل", extractionPartial: "استخراج جزئي", extractionBlocked: "الاستخراج محظور", unlock: "فتح التدقيق الكامل" },
};

const LOCKED_LABELS: Record<
  Locale,
  Record<FreeListingAuditAvailable["lockedSections"][number], string>
> = {
  en: {
    photos: "Photos",
    description: "Description",
    market_positioning: "Market positioning",
    occupancy: "Occupancy",
    conversion: "Conversion",
    action_plan: "Action plan",
  },
  fr: {
    photos: "Photos",
    description: "Description",
    market_positioning: "Positionnement marché",
    occupancy: "Occupation",
    conversion: "Conversion",
    action_plan: "Plan d'action",
  },
  es: {
    photos: "Fotos",
    description: "Descripción",
    market_positioning: "Posicionamiento de mercado",
    occupancy: "Ocupación",
    conversion: "Conversión",
    action_plan: "Plan de acción",
  },
  de: {
    photos: "Fotos",
    description: "Beschreibung",
    market_positioning: "Marktpositionierung",
    occupancy: "Auslastung",
    conversion: "Conversion",
    action_plan: "Aktionsplan",
  },
  it: {
    photos: "Foto",
    description: "Descrizione",
    market_positioning: "Posizionamento di mercato",
    occupancy: "Occupazione",
    conversion: "Conversione",
    action_plan: "Piano d'azione",
  },
  pt: {
    photos: "Fotos",
    description: "Descrição",
    market_positioning: "Posicionamento de mercado",
    occupancy: "Ocupação",
    conversion: "Conversão",
    action_plan: "Plano de ação",
  },
  nl: {
    photos: "Foto's",
    description: "Beschrijving",
    market_positioning: "Marktpositionering",
    occupancy: "Bezetting",
    conversion: "Conversie",
    action_plan: "Actieplan",
  },
  ja: {
    photos: "写真",
    description: "説明",
    market_positioning: "市場ポジション",
    occupancy: "稼働率",
    conversion: "コンバージョン",
    action_plan: "アクションプラン",
  },
  zh: {
    photos: "照片",
    description: "描述",
    market_positioning: "市场定位",
    occupancy: "入住率",
    conversion: "转化",
    action_plan: "行动计划",
  },
  ko: {
    photos: "사진",
    description: "설명",
    market_positioning: "시장 포지셔닝",
    occupancy: "점유율",
    conversion: "전환",
    action_plan: "실행 계획",
  },
  ar: {
    photos: "الصور",
    description: "الوصف",
    market_positioning: "التموضع في السوق",
    occupancy: "الإشغال",
    conversion: "التحويل",
    action_plan: "خطة العمل",
  },
};

function extractionLabel(
  labels: (typeof LABELS)[Locale],
  status: FreeListingAuditAvailable["trust"]["extractionStatus"],
): string {
  if (status === "complete") return labels.extractionComplete;
  if (status === "blocked") return labels.extractionBlocked;
  return labels.extractionPartial;
}

export function FreeAuditListingResult({
  locale,
  result,
  fullAuditHref,
  onFullAuditClick,
}: Readonly<{
  locale: Locale;
  result: FreeListingAuditAvailable;
  fullAuditHref: string;
  onFullAuditClick: (event: MouseEvent<HTMLAnchorElement>) => void;
}>) {
  const labels = LABELS[locale];
  const isRtl = locale === "ar";

  return (
    <div className="space-y-5" dir={isRtl ? "rtl" : undefined}>
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-orange-600">
          {labels.eyebrow}
        </p>
        <h2 className="mt-2 text-[22px] font-semibold tracking-[-0.03em] text-slate-950">
          {result.listing.title}
        </h2>
        <p className="mt-2 text-sm text-slate-500">
          {result.listing.platform.toUpperCase()}
          {result.listing.propertyType ? ` · ${result.listing.propertyType}` : ""}
        </p>
        {result.summary ? (
          <p className="mt-3 text-[14px] leading-6 text-slate-600">{result.summary}</p>
        ) : null}
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-[22px] border border-orange-200 bg-orange-50/80 p-4 shadow-[0_10px_24px_rgba(251,146,60,0.10)]">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-orange-700">{labels.score}</p>
          <p className="mt-2 text-3xl font-semibold tracking-[-0.04em] text-slate-950">{result.score.toFixed(1)}/10</p>
        </div>
        <div className="rounded-[22px] border border-slate-200 bg-white p-4 shadow-[0_10px_24px_rgba(15,23,42,0.06)]">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">{labels.guestRating}</p>
          <p className="mt-2 text-base font-semibold text-slate-950">
            {result.trust.rating != null ? String(result.trust.rating) : "—"}
          </p>
          <p className="mt-1 text-xs text-slate-500">
            {result.trust.reviewCount != null ? `${result.trust.reviewCount} reviews · ` : ""}
            {extractionLabel(labels, result.trust.extractionStatus)}
          </p>
        </div>
        <div className="rounded-[22px] border border-slate-200 bg-white p-4 shadow-[0_10px_24px_rgba(15,23,42,0.06)]">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">{labels.market}</p>
          <p className="mt-2 text-base font-semibold text-slate-950">{result.market.comparableCount}</p>
          <p className="mt-1 text-xs text-slate-500">{labels.comparables}</p>
        </div>
      </div>

      <div className="rounded-[24px] border border-sky-200 bg-sky-50/70 p-4">
        <div className="flex items-center justify-between gap-4">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-sky-700">{labels.availability}</p>
          <span className="rounded-full border border-sky-200 bg-white px-3 py-1 text-xs font-semibold text-sky-800">
            {result.availability.detected ? labels.detected : labels.unavailable}
          </span>
        </div>
        {result.market.summary ? <p className="mt-3 text-sm leading-6 text-slate-700">{result.market.summary}</p> : null}
      </div>

      {result.insights.length > 0 ? (
        <div className="rounded-[24px] border border-slate-200 bg-white p-4 shadow-[0_10px_24px_rgba(15,23,42,0.06)]">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">{labels.insights}</p>
          <div className="mt-3 space-y-2">
            {result.insights.map((item) => (
              <p key={item} className="rounded-2xl bg-slate-50 px-4 py-3 text-sm leading-6 text-slate-700">{item}</p>
            ))}
          </div>
        </div>
      ) : null}

      {result.recommendations.length > 0 ? (
        <div className="rounded-[24px] border border-slate-200 bg-white p-4 shadow-[0_10px_24px_rgba(15,23,42,0.06)]">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">{labels.recommendations}</p>
          <div className="mt-3 space-y-2">
            {result.recommendations.map((item, index) => (
              <div key={item} className="flex gap-3 rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-900 text-xs font-semibold text-white">{index + 1}</span>
                <p className="text-sm leading-6 text-slate-700">{item}</p>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      <div className="rounded-[24px] border border-slate-200 bg-slate-50/80 p-4">
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">{labels.locked}</p>
        <div className="mt-3 flex flex-wrap gap-2">
          {result.lockedSections.map((section) => (
            <span key={section} className="inline-flex items-center rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700">
              {LOCKED_LABELS[locale][section]} 🔒
            </span>
          ))}
        </div>
      </div>

      <Link
        href={fullAuditHref}
        onClick={onFullAuditClick}
        className="nk-primary-btn inline-flex w-full items-center justify-center text-center text-xs font-semibold uppercase tracking-[0.18em]"
      >
        {labels.unlock}
      </Link>
    </div>
  );
}

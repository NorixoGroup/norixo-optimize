"use client";

import Link from "next/link";
import { runAuditForListing } from "@/components/RunAuditForListingButton";
import { canCreateAudit } from "@/lib/billing/canCreateAudit";
import { getWorkspaceAuditCredits } from "@/lib/billing/getWorkspaceAuditCredits";
import { normalizeSourceUrl } from "@/lib/listings/normalizeSourceUrl";
import { supabase } from "@/lib/supabase";
import { getOrCreateWorkspaceForUser } from "@/lib/workspaces/ensureWorkspaceForUser";
import {
  emptyOwnerProfile,
  emptyPreferencesDraft,
  loadStoredOwnerProfile,
  loadStoredPreferences,
  type OwnerProfileDraft,
  type PreferencesDraft,
} from "@/lib/workspaces/workspaceSettings";
import { useEffect, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Eye, Loader2, Sparkles, Trash2 } from "lucide-react";
import { useI18n } from "@/components/i18n/I18nProvider";
import type { Locale } from "@/data/i18n";

function DashboardActionsTooltip({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <span className="group/act relative inline-flex shrink-0">
      {children}
      <span
        role="tooltip"
        aria-hidden="true"
        className="pointer-events-none absolute left-1/2 top-full z-50 mt-1.5 w-max max-w-[min(100vw-1rem,18rem)] -translate-x-1/2 rounded-md bg-slate-900 px-2 py-1 text-left text-xs font-medium leading-snug text-white opacity-0 shadow-md transition-opacity duration-150 ease-out group-hover/act:opacity-100 group-focus-within/act:opacity-100"
      >
        {label}
      </span>
    </span>
  );
}

/** Aligné sur app/dashboard/listings/new (reprise d’audit, pas de second POST). */
const AUDIT_BG_STALE_MS = 45 * 60 * 1000;
const AUDIT_BG_REDIRECT_MAX_MS = 10 * 60 * 1000;

function listingsActiveAuditKey(workspaceId: string) {
  return `norixo_active_audit:${workspaceId}`;
}

function listingsAuditRedirectKey(workspaceId: string) {
  return `norixo_audit_redirect:${workspaceId}`;
}

type ListingsBgAuditState =
  | { kind: "none" }
  | { kind: "running" }
  | { kind: "ready"; auditId: string };

type ListingPageRow = {
  id: string;
  workspace_id: string;
  source_url: string | null;
  source_platform: string | null;
  title: string | null;
  created_at: string;
  audits: {
    id: string;
    overall_score: number | null;
    created_at: string;
    result_payload: unknown;
  }[];
};

type WorkspaceSummary = {
  id: string;
  name: string;
  slug: string | null;
  owner_user_id: string;
};

function formatAuditDate(value?: string) {
  if (!value) return "–";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "–";

  return date.toISOString().slice(0, 16).replace("T", " ");
}

function normalizeDashboardContentLocale(locale: Locale): Locale {
  return locale;
}

function formatReportCountLabel(count: number, locale: Locale) {
  if (locale === "en") {
    if (count === 0) return "0 reports";
    if (count === 1) return "1 report";
    return `${count} reports`;
  }

  if (locale === "ja") {
    return `${count} 件のレポート`;
  }

  if (locale === "zh") {
    return `${count} 份报告`;
  }

  if (locale === "ko") {
    return `${count}개의 보고서`;
  }

  if (locale === "ar") {
    if (count === 0) return "0 تقارير";
    if (count === 1) return "1 تقرير";
    return `${count} تقارير`;
  }

  if (locale === "es") {
    if (count === 0) return "0 informes";
    if (count === 1) return "1 informe";
    return `${count} informes`;
  }

  if (locale === "de") {
    if (count === 0) return "0 Berichte";
    if (count === 1) return "1 Bericht";
    return `${count} Berichte`;
  }

  if (locale === "it") {
    if (count === 0) return "0 report";
    if (count === 1) return "1 report";
    return `${count} report`;
  }

  if (locale === "pt") {
    if (count === 0) return "0 relatórios";
    if (count === 1) return "1 relatório";
    return `${count} relatórios`;
  }

  if (locale === "nl") {
    if (count === 0) return "0 rapporten";
    if (count === 1) return "1 rapport";
    return `${count} rapporten`;
  }

  if (count === 0) return "0 rapport";
  if (count === 1) return "1 rapport";
  return `${count} rapports`;
}

function lqiBadgeClass(label?: string) {
  switch (label) {
    case "needs_work":
      return "border-red-200 bg-red-50 text-red-700";
    case "improving":
      return "border-orange-200 bg-orange-50 text-orange-700";
    case "competitive":
      return "border-amber-200 bg-amber-50 text-amber-700";
    case "strong_performer":
      return "border-emerald-200 bg-emerald-50 text-emerald-700";
    case "market_leader":
      return "border-emerald-300 bg-emerald-100 text-emerald-800";
    default:
      return "border-slate-200 bg-slate-50 text-slate-700";
  }
}

function getListingsCopy(locale: Locale) {
  const contentLocale = normalizeDashboardContentLocale(locale);

  if (contentLocale === "en") {
    return {
      kicker: "Inventory",
      heading: "Tracked listings",
      subtitle: "Manage and monitor your listing performance in real time.",
      headerDescription:
        "Manage all audited listings from one place: platform, latest score, and direct access to the detailed report.",
      identity: "Workspace identity",
      owner: "Owner profile",
      notProvided: "Not provided",
      trackedSingular: "tracked listing",
      trackedPlural: "tracked listings",
      addListing: "Analyze a new listing",
      strategicListing:
        "Start with your most strategic listing to compare it against nearby competitors.",
      activeListings: "active listings",
      listingsWithAudit: "with audit",
      listingsWithoutAudit: "without audit",
      freePlan: "Free",
      proPlan: "Pro",
      proActive: "Pro plan active",
      auditsUsedSingular: "audit used",
      auditsUsedPlural: "audits used",
      unlimitedAudits: "Unlimited audits",
      auditTestActive: "Test audit active",
      pack5Active: "5-audit pack active",
      pack15Active: "15-audit pack active",
      singleAuditOneOff: "1 one-off audit",
      auditsAvailable: "audits available",
      auditAvailableSingular: "audit available",
      auditsRemaining: "audits remaining",
      noAuditsAvailable: "No audits available",
      managePlan: "Manage plan",
      trackedList: "Tracked listings list",
      listing: "Listing",
      platform: "Platform",
      latestScore: "Latest score",
      qualityScore: "Quality score",
      latestAudit: "Latest audit",
      actions: "Actions",
      noListings: "No listings yet",
      noListingsText:
        "Add your first listing to analyze its conversion potential and get tailored recommendations.",
      addFirstListing: "Add a first listing",
      untitledListing: "Untitled listing",
      untitledListingSafe: "Untitled listing",
      viewPublicListing: "View public listing",
      urlUnavailable: "URL unavailable",
      unknownPlatform: "unknown",
      noAudit: "No audit",
      viewAudit: "View audit",
      deleteListing: "Delete listing",
      deleteListingConfirm:
        "Delete this listing from tracking? Existing audits stay available on the Audits page.",
      deleteListingError: "Could not remove this listing.",
      deleteListingInProgress: "Removing…",
      reports: "Reports",
      viewReports: "View reports",
      viewReport: "View report",
      auditInProgress: "Audit in progress",
      reportReady: "Report ready",
      showLabel: "Show:",
      creditsExhausted: "Credits exhausted",
      viewOffers: "View offers",
      workspaceOwner: "Workspace owner",
      scoreNeedsImprovement: "Needs improvement",
      scoreCompetitive: "Competitive",
      scoreHighPerforming: "High performing",
      scoreMarketLeader: "Market leader",
      creditTopupHelper: "Top up your credits to continue your analyses and launch new audits.",
      workspaceMember: "Workspace member",
      previousPage: "Previous",
      paginationLabel: "Page {page} of {total}",
      nextPage: "Next",
      processingStatus: "Processing",
      backgroundAuditRunningDescription:
        "Your analysis is continuing in the background. You can stay on this page and we will open the report as soon as it is ready.",
      backToAnalysis: "Back to analysis",
      backgroundAuditReadyDescription:
        "The audit launched from the “new listing” page is complete.",
      creditsExhaustedDescription:
        "You have no credits left to launch a new audit. Choose an offer to continue your analyses.",
      later: "Later",
      unknownError: "An unknown error occurred",
      launchAudit: "Launch an audit",
    };
  }

  if (locale === "ja") {
    return {
      kicker: "在庫",
      heading: "追跡中の掲載",
      subtitle: "掲載パフォーマンスをリアルタイムで管理・監視します。",
      headerDescription:
        "すべての監査済み掲載を一か所で管理: プラットフォーム、最新スコア、詳細レポートへの直接アクセス。",
      identity: "ワークスペース情報",
      owner: "オーナープロフィール",
      notProvided: "未入力",
      trackedSingular: "追跡中の掲載",
      trackedPlural: "追跡中の掲載",
      addListing: "新しい掲載を分析",
      strategicListing:
        "まずは最も戦略的な掲載から始め、近隣の競合と比較しましょう。",
      activeListings: "アクティブな掲載",
      listingsWithAudit: "監査あり",
      listingsWithoutAudit: "監査なし",
      freePlan: "無料",
      proPlan: "Pro",
      proActive: "Proプラン有効",
      auditsUsedSingular: "使用済み監査",
      auditsUsedPlural: "使用済み監査",
      unlimitedAudits: "無制限の監査",
      auditTestActive: "テスト監査有効",
      pack5Active: "5件監査パック有効",
      pack15Active: "15件監査パック有効",
      singleAuditOneOff: "単発監査 1件",
      auditsAvailable: "利用可能な監査",
      auditAvailableSingular: "利用可能な監査",
      auditsRemaining: "残りの監査",
      noAuditsAvailable: "利用可能な監査はありません",
      managePlan: "プランを管理",
      trackedList: "追跡中の掲載一覧",
      listing: "掲載",
      platform: "プラットフォーム",
      latestScore: "最新スコア",
      qualityScore: "品質スコア",
      latestAudit: "最新の監査",
      actions: "アクション",
      noListings: "まだ掲載がありません",
      noListingsText:
        "最初の掲載を追加して、コンバージョンの可能性を分析し、最適な提案を受け取りましょう。",
      addFirstListing: "最初の掲載を追加",
      untitledListing: "無題の掲載",
      untitledListingSafe: "無題の掲載",
      viewPublicListing: "公開掲載を見る",
      urlUnavailable: "URLは利用できません",
      unknownPlatform: "不明",
      noAudit: "監査なし",
      viewAudit: "監査を見る",
      deleteListing: "掲載を削除",
      deleteListingConfirm:
        "この掲載を追跡対象から削除しますか？既存の監査は Audits ページで引き続き利用できます。",
      deleteListingError: "この掲載を削除できませんでした。",
      deleteListingInProgress: "削除中…",
      reports: "レポート",
      viewReports: "レポートを見る",
      viewReport: "レポートを見る",
      auditInProgress: "監査中",
      reportReady: "レポート準備完了",
      showLabel: "表示:",
      creditsExhausted: "クレジット切れ",
      viewOffers: "オファーを見る",
      workspaceOwner: "ワークスペース所有者",
      scoreNeedsImprovement: "改善が必要",
      scoreCompetitive: "競争力あり",
      scoreHighPerforming: "高パフォーマンス",
      scoreMarketLeader: "市場リーダー",
      creditTopupHelper:
        "分析を続けて新しい監査を開始するには、クレジットを追加してください。",
      workspaceMember: "ワークスペースメンバー",
      previousPage: "前へ",
      paginationLabel: "{total}ページ中 {page}ページ",
      nextPage: "次へ",
      processingStatus: "処理中",
      backgroundAuditRunningDescription:
        "分析はバックグラウンドで継続中です。このページにとどまったまま、レポートの準備ができ次第開くことができます。",
      backToAnalysis: "分析に戻る",
      backgroundAuditReadyDescription:
        "「新しい掲載」ページから開始した監査が完了しました。",
      creditsExhaustedDescription:
        "新しい監査を開始するためのクレジットがありません。分析を続けるにはオファーを選択してください。",
      later: "後で",
      unknownError: "不明なエラーが発生しました",
      launchAudit: "監査を開始",
    };
  }

  if (locale === "zh") {
    return {
      kicker: "库存",
      heading: "已跟踪房源",
      subtitle: "实时管理并监控你的房源表现。",
      headerDescription:
        "在一个地方管理所有已审计房源：平台、最新分数，以及直接访问详细报告。",
      identity: "工作区信息",
      owner: "所有者资料",
      notProvided: "未提供",
      trackedSingular: "已跟踪房源",
      trackedPlural: "已跟踪房源",
      addListing: "分析新房源",
      strategicListing:
        "先从你最具战略意义的房源开始，并将其与附近竞争对手比较。",
      activeListings: "活跃房源",
      listingsWithAudit: "有审计",
      listingsWithoutAudit: "无审计",
      freePlan: "免费",
      proPlan: "Pro",
      proActive: "Pro 计划已激活",
      auditsUsedSingular: "已用审计",
      auditsUsedPlural: "已用审计",
      unlimitedAudits: "无限审计",
      auditTestActive: "测试审计已激活",
      pack5Active: "5次审计包已激活",
      pack15Active: "15次审计包已激活",
      singleAuditOneOff: "1次单次审计",
      auditsAvailable: "可用审计",
      auditAvailableSingular: "可用审计",
      auditsRemaining: "剩余审计",
      noAuditsAvailable: "没有可用审计",
      managePlan: "管理计划",
      trackedList: "已跟踪房源列表",
      listing: "房源",
      platform: "平台",
      latestScore: "最新分数",
      qualityScore: "质量分数",
      latestAudit: "最近审计",
      actions: "操作",
      noListings: "还没有房源",
      noListingsText:
        "添加你的第一个房源，分析其转化潜力并获得个性化建议。",
      addFirstListing: "添加第一个房源",
      untitledListing: "未命名房源",
      untitledListingSafe: "未命名房源",
      viewPublicListing: "查看公开房源",
      urlUnavailable: "URL 不可用",
      unknownPlatform: "未知",
      noAudit: "无审计",
      viewAudit: "查看审计",
      deleteListing: "删除房源",
      deleteListingConfirm:
        "将此房源从跟踪中删除？现有审计仍可在 Audits 页面查看。",
      deleteListingError: "无法删除此房源。",
      deleteListingInProgress: "删除中…",
      reports: "报告",
      viewReports: "查看报告",
      viewReport: "查看报告",
      auditInProgress: "审计进行中",
      reportReady: "报告已准备好",
      showLabel: "显示:",
      creditsExhausted: "额度已用尽",
      viewOffers: "查看优惠",
      workspaceOwner: "工作区所有者",
      scoreNeedsImprovement: "需要改进",
      scoreCompetitive: "有竞争力",
      scoreHighPerforming: "高表现",
      scoreMarketLeader: "市场领先",
      creditTopupHelper: "请充值额度，以继续分析并发起新的审计。",
      workspaceMember: "工作区成员",
      previousPage: "上一页",
      paginationLabel: "第 {page} 页，共 {total} 页",
      nextPage: "下一页",
      processingStatus: "处理中",
      backgroundAuditRunningDescription:
        "你的分析正在后台继续进行。你可以停留在此页面，我们会在报告准备好后立即打开它。",
      backToAnalysis: "返回分析",
      backgroundAuditReadyDescription:
        "从“新建房源”页面发起的审计已完成。",
      creditsExhaustedDescription:
        "你已没有可用额度来发起新的审计。请选择一个优惠以继续分析。",
      later: "稍后",
      unknownError: "发生了未知错误",
      launchAudit: "发起审计",
    };
  }

  if (locale === "ko") {
    return {
      kicker: "인벤토리",
      heading: "추적 중인 숙소",
      subtitle: "숙소 성과를 실시간으로 관리하고 모니터링하세요.",
      headerDescription:
        "모든 감사된 숙소를 한곳에서 관리하세요: 플랫폼, 최신 점수, 상세 보고서 바로가기.",
      identity: "워크스페이스 정보",
      owner: "소유자 프로필",
      notProvided: "제공되지 않음",
      trackedSingular: "추적 중인 숙소",
      trackedPlural: "추적 중인 숙소",
      addListing: "새 숙소 분석",
      strategicListing:
        "가장 전략적인 숙소부터 시작해 주변 경쟁 숙소와 비교하세요.",
      activeListings: "활성 숙소",
      listingsWithAudit: "감사 있음",
      listingsWithoutAudit: "감사 없음",
      freePlan: "무료",
      proPlan: "Pro",
      proActive: "Pro 플랜 활성",
      auditsUsedSingular: "사용된 감사",
      auditsUsedPlural: "사용된 감사",
      unlimitedAudits: "무제한 감사",
      auditTestActive: "테스트 감사 활성",
      pack5Active: "5회 감사 팩 활성",
      pack15Active: "15회 감사 팩 활성",
      singleAuditOneOff: "단일 감사 1회",
      auditsAvailable: "사용 가능한 감사",
      auditAvailableSingular: "사용 가능한 감사",
      auditsRemaining: "남은 감사",
      noAuditsAvailable: "사용 가능한 감사가 없습니다",
      managePlan: "플랜 관리",
      trackedList: "추적 중인 숙소 목록",
      listing: "숙소",
      platform: "플랫폼",
      latestScore: "최신 점수",
      qualityScore: "품질 점수",
      latestAudit: "최근 감사",
      actions: "작업",
      noListings: "아직 숙소가 없습니다",
      noListingsText:
        "첫 숙소를 추가해 전환 가능성을 분석하고 맞춤형 권장사항을 받아보세요.",
      addFirstListing: "첫 숙소 추가",
      untitledListing: "제목 없는 숙소",
      untitledListingSafe: "제목 없는 숙소",
      viewPublicListing: "공개 숙소 보기",
      urlUnavailable: "URL 사용 불가",
      unknownPlatform: "알 수 없음",
      noAudit: "감사 없음",
      viewAudit: "감사 보기",
      deleteListing: "숙소 삭제",
      deleteListingConfirm:
        "이 숙소를 추적 목록에서 삭제하시겠습니까? 기존 감사는 Audits 페이지에서 계속 확인할 수 있습니다.",
      deleteListingError: "이 숙소를 삭제할 수 없습니다.",
      deleteListingInProgress: "삭제 중…",
      reports: "보고서",
      viewReports: "보고서 보기",
      viewReport: "보고서 보기",
      auditInProgress: "감사 진행 중",
      reportReady: "보고서 준비 완료",
      showLabel: "표시:",
      creditsExhausted: "크레딧 소진",
      viewOffers: "오퍼 보기",
      workspaceOwner: "워크스페이스 소유자",
      scoreNeedsImprovement: "개선 필요",
      scoreCompetitive: "경쟁력 있음",
      scoreHighPerforming: "높은 성과",
      scoreMarketLeader: "시장 선도",
      creditTopupHelper:
        "분석을 계속하고 새 감사를 시작하려면 크레딧을 충전하세요.",
      workspaceMember: "워크스페이스 멤버",
      previousPage: "이전",
      paginationLabel: "{total}페이지 중 {page}페이지",
      nextPage: "다음",
      processingStatus: "처리 중",
      backgroundAuditRunningDescription:
        "분석이 백그라운드에서 계속 진행 중입니다. 이 페이지에 머물러도 되며, 보고서가 준비되는 즉시 열어드립니다.",
      backToAnalysis: "분석으로 돌아가기",
      backgroundAuditReadyDescription:
        "“새 숙소” 페이지에서 시작한 감사가 완료되었습니다.",
      creditsExhaustedDescription:
        "새 감사를 시작할 수 있는 크레딧이 더 이상 없습니다. 분석을 계속하려면 오퍼를 선택하세요.",
      later: "나중에",
      unknownError: "알 수 없는 오류가 발생했습니다",
      launchAudit: "감사 시작",
    };
  }

  if (locale === "ar") {
    return {
      kicker: "المخزون",
      heading: "الإعلانات المتابَعة",
      subtitle: "أدِر وراقب أداء إعلاناتك في الوقت الفعلي.",
      headerDescription:
        "أدِر جميع الإعلانات التي تم تدقيقها من مكان واحد: المنصة، وآخر نتيجة، والوصول المباشر إلى التقرير التفصيلي.",
      identity: "هوية مساحة العمل",
      owner: "ملف المالك",
      notProvided: "غير متوفر",
      trackedSingular: "إعلان متابَع",
      trackedPlural: "إعلانات متابَعة",
      addListing: "تحليل إعلان جديد",
      strategicListing:
        "ابدأ بإعلانك الأكثر أهمية استراتيجيًا لمقارنته بالمنافسين القريبين.",
      activeListings: "إعلانات نشطة",
      listingsWithAudit: "مع تدقيق",
      listingsWithoutAudit: "من دون تدقيق",
      freePlan: "مجاني",
      proPlan: "Pro",
      proActive: "خطة Pro نشطة",
      auditsUsedSingular: "عملية تدقيق مستخدمة",
      auditsUsedPlural: "عمليات تدقيق مستخدمة",
      unlimitedAudits: "عمليات تدقيق غير محدودة",
      auditTestActive: "تدقيق تجريبي نشط",
      pack5Active: "باقة 5 تدقيقات نشطة",
      pack15Active: "باقة 15 تدقيقًا نشطة",
      singleAuditOneOff: "عملية تدقيق واحدة",
      auditsAvailable: "عمليات تدقيق متاحة",
      auditAvailableSingular: "عملية تدقيق متاحة",
      auditsRemaining: "عمليات تدقيق متبقية",
      noAuditsAvailable: "لا توجد عمليات تدقيق متاحة",
      managePlan: "إدارة الخطة",
      trackedList: "قائمة الإعلانات المتابَعة",
      listing: "الإعلان",
      platform: "المنصة",
      latestScore: "آخر نتيجة",
      qualityScore: "نتيجة الجودة",
      latestAudit: "آخر تدقيق",
      actions: "الإجراءات",
      noListings: "لا توجد إعلانات بعد",
      noListingsText:
        "أضف إعلانك الأول لتحليل إمكانات التحويل والحصول على توصيات مخصصة.",
      addFirstListing: "إضافة أول إعلان",
      untitledListing: "إعلان بلا عنوان",
      untitledListingSafe: "إعلان بلا عنوان",
      viewPublicListing: "عرض الإعلان العام",
      urlUnavailable: "الرابط غير متاح",
      unknownPlatform: "غير معروف",
      noAudit: "لا يوجد تدقيق",
      viewAudit: "عرض التدقيق",
      deleteListing: "حذف الإعلان",
      deleteListingConfirm:
        "هل تريد حذف هذا الإعلان من التتبع؟ ستظل عمليات التدقيق الحالية متاحة في صفحة Audits.",
      deleteListingError: "تعذر إزالة هذا الإعلان.",
      deleteListingInProgress: "جارٍ الحذف…",
      reports: "التقارير",
      viewReports: "عرض التقارير",
      viewReport: "عرض التقرير",
      auditInProgress: "التدقيق قيد التنفيذ",
      reportReady: "التقرير جاهز",
      showLabel: "إظهار:",
      creditsExhausted: "تم استنفاد الأرصدة",
      viewOffers: "عرض العروض",
      workspaceOwner: "مالك مساحة العمل",
      scoreNeedsImprovement: "بحاجة إلى تحسين",
      scoreCompetitive: "تنافسي",
      scoreHighPerforming: "عالي الأداء",
      scoreMarketLeader: "رائد في السوق",
      creditTopupHelper:
        "أعد شحن أرصدتك لمتابعة تحليلاتك وإطلاق عمليات تدقيق جديدة.",
      workspaceMember: "عضو مساحة العمل",
      previousPage: "السابق",
      paginationLabel: "الصفحة {page} من {total}",
      nextPage: "التالي",
      processingStatus: "قيد المعالجة",
      backgroundAuditRunningDescription:
        "تحليلك مستمر في الخلفية. يمكنك البقاء في هذه الصفحة وسنفتح التقرير بمجرد أن يصبح جاهزًا.",
      backToAnalysis: "العودة إلى التحليل",
      backgroundAuditReadyDescription:
        "اكتمل التدقيق الذي تم إطلاقه من صفحة «إعلان جديد».",
      creditsExhaustedDescription:
        "لم يعد لديك أي أرصدة متاحة لإطلاق تدقيق جديد. اختر عرضًا لمتابعة تحليلاتك.",
      later: "لاحقًا",
      unknownError: "حدث خطأ غير معروف",
      launchAudit: "إطلاق تدقيق",
    };
  }

  if (locale === "de") {
    return {
      kicker: "Inventar",
      heading: "Verfolgte Inserate",
      subtitle: "Verwalte und überwache die Leistung deiner Inserate in Echtzeit.",
      headerDescription: "Verwalte alle geprüften Inserate an einem Ort: Plattform, letzter Score und direkter Zugriff auf den Detailbericht.",
      identity: "Workspace-Identität",
      owner: "Eigentümerprofil",
      notProvided: "Nicht angegeben",
      trackedSingular: "verfolgtes Inserat",
      trackedPlural: "verfolgte Inserate",
      addListing: "Neues Inserat analysieren",
      strategicListing: "Beginne mit deinem strategisch wichtigsten Inserat, um es mit nahen Wettbewerbern zu vergleichen.",
      activeListings: "aktive Inserate",
      listingsWithAudit: "mit Audit",
      listingsWithoutAudit: "ohne Audit",
      freePlan: "Kostenlos",
      proPlan: "Pro",
      proActive: "Pro-Plan aktiv",
      auditsUsedSingular: "Audit verwendet",
      auditsUsedPlural: "Audits verwendet",
      unlimitedAudits: "Unbegrenzte Audits",
      auditTestActive: "Test-Audit aktiv",
      pack5Active: "5-Audit-Paket aktiv",
      pack15Active: "15-Audit-Paket aktiv",
      singleAuditOneOff: "1 einmaliges Audit",
      auditsAvailable: "Audits verfügbar",
      auditAvailableSingular: "Audit verfügbar",
      auditsRemaining: "Audits verbleibend",
      noAuditsAvailable: "Keine Audits verfügbar",
      managePlan: "Plan verwalten",
      trackedList: "Liste verfolgter Inserate",
      listing: "Inserat",
      platform: "Plattform",
      latestScore: "Letzter Score",
      qualityScore: "Qualitätsscore",
      latestAudit: "Letztes Audit",
      actions: "Aktionen",
      noListings: "Noch keine Inserate",
      noListingsText: "Füge dein erstes Inserat hinzu, um sein Conversion-Potenzial zu analysieren und passende Empfehlungen zu erhalten.",
      addFirstListing: "Erstes Inserat hinzufügen",
      untitledListing: "Inserat ohne Titel",
      untitledListingSafe: "Inserat ohne Titel",
      viewPublicListing: "Öffentliches Inserat ansehen",
      urlUnavailable: "URL nicht verfügbar",
      unknownPlatform: "unbekannt",
      noAudit: "Kein Audit",
      viewAudit: "Audit ansehen",
      deleteListing: "Inserat löschen",
      deleteListingConfirm: "Dieses Inserat aus dem Tracking entfernen? Bestehende Audits bleiben auf der Audit-Seite verfügbar.",
      deleteListingError: "Dieses Inserat konnte nicht entfernt werden.",
      deleteListingInProgress: "Wird entfernt…",
      reports: "Berichte",
      viewReports: "Berichte ansehen",
      viewReport: "Bericht ansehen",
      auditInProgress: "Audit läuft",
      reportReady: "Bericht bereit",
      showLabel: "Anzeigen:",
      creditsExhausted: "Credits aufgebraucht",
      viewOffers: "Angebote ansehen",
      workspaceOwner: "Workspace-Eigentümer",
      scoreNeedsImprovement: "Verbesserungsbedarf",
      scoreCompetitive: "Wettbewerbsfähig",
      scoreHighPerforming: "Sehr leistungsstark",
      scoreMarketLeader: "Marktführer",
      creditTopupHelper: "Lade deine Credits auf, um deine Analysen fortzusetzen und neue Audits zu starten.",
      workspaceMember: "Workspace-Mitglied",
      previousPage: "Zurück",
      paginationLabel: "Seite {page} von {total}",
      nextPage: "Weiter",
      processingStatus: "In Bearbeitung",
      backgroundAuditRunningDescription:
        "Deine Analyse läuft im Hintergrund weiter. Du kannst auf dieser Seite bleiben, wir öffnen den Bericht, sobald er bereit ist.",
      backToAnalysis: "Zurück zur Analyse",
      backgroundAuditReadyDescription:
        "Das von der Seite „Neues Inserat“ gestartete Audit ist abgeschlossen.",
      creditsExhaustedDescription:
        "Du hast keine verfügbaren Credits mehr, um ein neues Audit zu starten. Wähle ein Angebot, um deine Analysen fortzusetzen.",
      later: "Später",
      unknownError: "Ein unbekannter Fehler ist aufgetreten",
      launchAudit: "Audit starten",
    };
  }

  if (locale === "it") {
    return {
      kicker: "Inventario",
      heading: "Annunci monitorati",
      subtitle: "Gestisci e monitora la performance dei tuoi annunci in tempo reale.",
      headerDescription: "Gestisci tutti gli annunci auditati da un solo posto: piattaforma, ultimo punteggio e accesso diretto al report dettagliato.",
      identity: "Identità del workspace",
      owner: "Profilo proprietario",
      notProvided: "Non indicato",
      trackedSingular: "annuncio monitorato",
      trackedPlural: "annunci monitorati",
      addListing: "Analizza un nuovo annuncio",
      strategicListing: "Inizia dall’annuncio più strategico per confrontarlo con i concorrenti vicini.",
      activeListings: "annunci attivi",
      listingsWithAudit: "con audit",
      listingsWithoutAudit: "senza audit",
      freePlan: "Gratuito",
      proPlan: "Pro",
      proActive: "Piano Pro attivo",
      auditsUsedSingular: "audit usato",
      auditsUsedPlural: "audit usati",
      unlimitedAudits: "Audit illimitati",
      auditTestActive: "Audit test attivo",
      pack5Active: "Pack 5 audit attivo",
      pack15Active: "Pack 15 audit attivo",
      singleAuditOneOff: "1 audit singolo",
      auditsAvailable: "audit disponibili",
      auditAvailableSingular: "audit disponibile",
      auditsRemaining: "audit rimanenti",
      noAuditsAvailable: "Nessun audit disponibile",
      managePlan: "Gestisci piano",
      trackedList: "Lista annunci monitorati",
      listing: "Annuncio",
      platform: "Piattaforma",
      latestScore: "Ultimo punteggio",
      qualityScore: "Punteggio qualità",
      latestAudit: "Ultimo audit",
      actions: "Azioni",
      noListings: "Nessun annuncio per ora",
      noListingsText: "Aggiungi il primo annuncio per analizzare il potenziale di conversione e ricevere raccomandazioni personalizzate.",
      addFirstListing: "Aggiungi primo annuncio",
      untitledListing: "Annuncio senza titolo",
      untitledListingSafe: "Annuncio senza titolo",
      viewPublicListing: "Vedi annuncio pubblico",
      urlUnavailable: "URL non disponibile",
      unknownPlatform: "sconosciuta",
      noAudit: "Nessun audit",
      viewAudit: "Vedi audit",
      deleteListing: "Elimina annuncio",
      deleteListingConfirm: "Rimuovere questo annuncio dal monitoraggio? Gli audit esistenti resteranno disponibili nella pagina Audit.",
      deleteListingError: "Impossibile rimuovere questo annuncio.",
      deleteListingInProgress: "Rimozione…",
      reports: "Report",
      viewReports: "Vedi report",
      viewReport: "Vedi report",
      auditInProgress: "Audit in corso",
      reportReady: "Report pronto",
      showLabel: "Mostra:",
      creditsExhausted: "Crediti esauriti",
      viewOffers: "Vedi offerte",
      workspaceOwner: "Proprietario del workspace",
      scoreNeedsImprovement: "Da migliorare",
      scoreCompetitive: "Competitivo",
      scoreHighPerforming: "Molto performante",
      scoreMarketLeader: "Leader di mercato",
      creditTopupHelper: "Ricarica i crediti per continuare le analisi e avviare nuovi audit.",
      workspaceMember: "Membro del workspace",
      previousPage: "Precedente",
      paginationLabel: "Pagina {page} di {total}",
      nextPage: "Successiva",
      processingStatus: "In elaborazione",
      backgroundAuditRunningDescription:
        "La tua analisi continua in background. Puoi restare su questa pagina: apriremo il report non appena sarà pronto.",
      backToAnalysis: "Torna all’analisi",
      backgroundAuditReadyDescription:
        "L’audit avviato dalla pagina « nuovo annuncio » è terminato.",
      creditsExhaustedDescription:
        "Non hai più crediti disponibili per avviare un nuovo audit. Scegli un’offerta per continuare le tue analisi.",
      later: "Più tardi",
      unknownError: "Si è verificato un errore sconosciuto",
      launchAudit: "Avvia un audit",
    };
  }

  if (locale === "pt") {
    return {
      kicker: "Inventário",
      heading: "Anúncios acompanhados",
      subtitle: "Gira e acompanhe o desempenho dos seus anúncios em tempo real.",
      headerDescription: "Gira todos os anúncios auditados num só lugar: plataforma, última pontuação e acesso direto ao relatório detalhado.",
      identity: "Identidade do workspace",
      owner: "Perfil do proprietário",
      notProvided: "Não indicado",
      trackedSingular: "anúncio acompanhado",
      trackedPlural: "anúncios acompanhados",
      addListing: "Analisar novo anúncio",
      strategicListing: "Comece pelo anúncio mais estratégico para o comparar com concorrentes próximos.",
      activeListings: "anúncios ativos",
      listingsWithAudit: "com auditoria",
      listingsWithoutAudit: "sem auditoria",
      freePlan: "Gratuito",
      proPlan: "Pro",
      proActive: "Plano Pro ativo",
      auditsUsedSingular: "auditoria usada",
      auditsUsedPlural: "auditorias usadas",
      unlimitedAudits: "Auditorias ilimitadas",
      auditTestActive: "Auditoria de teste ativa",
      pack5Active: "Pack de 5 auditorias ativo",
      pack15Active: "Pack de 15 auditorias ativo",
      singleAuditOneOff: "1 auditoria pontual",
      auditsAvailable: "auditorias disponíveis",
      auditAvailableSingular: "auditoria disponível",
      auditsRemaining: "auditorias restantes",
      noAuditsAvailable: "Nenhuma auditoria disponível",
      managePlan: "Gerir plano",
      trackedList: "Lista de anúncios acompanhados",
      listing: "Anúncio",
      platform: "Plataforma",
      latestScore: "Última pontuação",
      qualityScore: "Pontuação de qualidade",
      latestAudit: "Última auditoria",
      actions: "Ações",
      noListings: "Nenhum anúncio por enquanto",
      noListingsText: "Adicione o primeiro anúncio para analisar o seu potencial de conversão e receber recomendações personalizadas.",
      addFirstListing: "Adicionar primeiro anúncio",
      untitledListing: "Anúncio sem título",
      untitledListingSafe: "Anúncio sem título",
      viewPublicListing: "Ver anúncio público",
      urlUnavailable: "URL indisponível",
      unknownPlatform: "desconhecida",
      noAudit: "Sem auditoria",
      viewAudit: "Ver auditoria",
      deleteListing: "Eliminar anúncio",
      deleteListingConfirm: "Remover este anúncio do acompanhamento? As auditorias existentes continuarão disponíveis na página Auditorias.",
      deleteListingError: "Não foi possível remover este anúncio.",
      deleteListingInProgress: "A remover…",
      reports: "Relatórios",
      viewReports: "Ver relatórios",
      viewReport: "Ver relatório",
      auditInProgress: "Auditoria em curso",
      reportReady: "Relatório pronto",
      showLabel: "Mostrar:",
      creditsExhausted: "Créditos esgotados",
      viewOffers: "Ver ofertas",
      workspaceOwner: "Proprietário do workspace",
      scoreNeedsImprovement: "A melhorar",
      scoreCompetitive: "Competitivo",
      scoreHighPerforming: "Muito forte",
      scoreMarketLeader: "Líder de mercado",
      creditTopupHelper: "Recarregue os seus créditos para continuar as análises e lançar novas auditorias.",
      workspaceMember: "Membro do workspace",
      previousPage: "Anterior",
      paginationLabel: "Página {page} de {total}",
      nextPage: "Seguinte",
      processingStatus: "Em processamento",
      backgroundAuditRunningDescription:
        "A sua análise continua em segundo plano. Pode permanecer nesta página; abriremos o relatório assim que estiver pronto.",
      backToAnalysis: "Voltar à análise",
      backgroundAuditReadyDescription:
        "A auditoria lançada a partir da página « novo anúncio » está concluída.",
      creditsExhaustedDescription:
        "Já não tem créditos disponíveis para lançar uma nova auditoria. Escolha uma oferta para continuar as suas análises.",
      later: "Mais tarde",
      unknownError: "Ocorreu um erro desconhecido",
      launchAudit: "Lançar uma auditoria",
    };
  }

  if (locale === "nl") {
    return {
      kicker: "Inventaris",
      heading: "Gevolgde advertenties",
      subtitle: "Beheer en volg de prestaties van je advertenties in realtime.",
      headerDescription: "Beheer alle geaudite advertenties op één plek: platform, laatste score en directe toegang tot het detailrapport.",
      identity: "Workspace-identiteit",
      owner: "Eigenaarprofiel",
      notProvided: "Niet opgegeven",
      trackedSingular: "gevolgde advertentie",
      trackedPlural: "gevolgde advertenties",
      addListing: "Nieuwe advertentie analyseren",
      strategicListing: "Begin met je meest strategische advertentie om die te vergelijken met nabije concurrenten.",
      activeListings: "actieve advertenties",
      listingsWithAudit: "met audit",
      listingsWithoutAudit: "zonder audit",
      freePlan: "Gratis",
      proPlan: "Pro",
      proActive: "Pro-plan actief",
      auditsUsedSingular: "audit gebruikt",
      auditsUsedPlural: "audits gebruikt",
      unlimitedAudits: "Onbeperkte audits",
      auditTestActive: "Testaudit actief",
      pack5Active: "5-auditpakket actief",
      pack15Active: "15-auditpakket actief",
      singleAuditOneOff: "1 losse audit",
      auditsAvailable: "audits beschikbaar",
      auditAvailableSingular: "audit beschikbaar",
      auditsRemaining: "audits resterend",
      noAuditsAvailable: "Geen audits beschikbaar",
      managePlan: "Plan beheren",
      trackedList: "Lijst met gevolgde advertenties",
      listing: "Advertentie",
      platform: "Platform",
      latestScore: "Laatste score",
      qualityScore: "Kwaliteitsscore",
      latestAudit: "Laatste audit",
      actions: "Acties",
      noListings: "Nog geen advertenties",
      noListingsText: "Voeg je eerste advertentie toe om het conversiepotentieel te analyseren en aanbevelingen op maat te krijgen.",
      addFirstListing: "Eerste advertentie toevoegen",
      untitledListing: "Advertentie zonder titel",
      untitledListingSafe: "Advertentie zonder titel",
      viewPublicListing: "Openbare advertentie bekijken",
      urlUnavailable: "URL niet beschikbaar",
      unknownPlatform: "onbekend",
      noAudit: "Geen audit",
      viewAudit: "Audit bekijken",
      deleteListing: "Advertentie verwijderen",
      deleteListingConfirm: "Deze advertentie uit tracking verwijderen? Bestaande audits blijven beschikbaar op de Auditspagina.",
      deleteListingError: "Deze advertentie kon niet worden verwijderd.",
      deleteListingInProgress: "Verwijderen…",
      reports: "Rapporten",
      viewReports: "Rapporten bekijken",
      viewReport: "Rapport bekijken",
      auditInProgress: "Audit bezig",
      reportReady: "Rapport klaar",
      showLabel: "Tonen:",
      creditsExhausted: "Credits op",
      viewOffers: "Aanbiedingen bekijken",
      workspaceOwner: "Workspace-eigenaar",
      scoreNeedsImprovement: "Moet beter",
      scoreCompetitive: "Competitief",
      scoreHighPerforming: "Sterk presterend",
      scoreMarketLeader: "Marktleider",
      creditTopupHelper: "Laad je credits op om je analyses voort te zetten en nieuwe audits te starten.",
      workspaceMember: "Workspace-lid",
      previousPage: "Vorige",
      paginationLabel: "Pagina {page} van {total}",
      nextPage: "Volgende",
      processingStatus: "Wordt verwerkt",
      backgroundAuditRunningDescription:
        "Je analyse loopt verder op de achtergrond. Je kunt op deze pagina blijven; we openen het rapport zodra het klaar is.",
      backToAnalysis: "Terug naar analyse",
      backgroundAuditReadyDescription:
        "De audit die is gestart vanaf de pagina ‘nieuwe advertentie’ is voltooid.",
      creditsExhaustedDescription:
        "Je hebt geen beschikbare credits meer om een nieuwe audit te starten. Kies een aanbod om je analyses voort te zetten.",
      later: "Later",
      unknownError: "Er is een onbekende fout opgetreden",
      launchAudit: "Audit starten",
    };
  }

  if (locale === "es") {
    return {
      kicker: "Inventario",
      heading: "Anuncios seguidos",
      subtitle: "Gestiona y supervisa el rendimiento de tus anuncios en tiempo real.",
      headerDescription:
        "Gestiona todos los anuncios auditados desde un solo lugar: plataforma, última puntuación y acceso directo al informe detallado.",
      identity: "Identidad del espacio",
      owner: "Perfil propietario",
      notProvided: "No indicado",
      trackedSingular: "anuncio seguido",
      trackedPlural: "anuncios seguidos",
      addListing: "Analizar un nuevo anuncio",
      strategicListing:
        "Empieza por tu anuncio más estratégico para compararlo con competidores cercanos.",
      activeListings: "anuncios activos",
      listingsWithAudit: "con auditoría",
      listingsWithoutAudit: "sin auditoría",
      freePlan: "Gratis",
      proPlan: "Pro",
      proActive: "Plan Pro activo",
      auditsUsedSingular: "auditoría usada",
      auditsUsedPlural: "auditorías usadas",
      unlimitedAudits: "Auditorías ilimitadas",
      auditTestActive: "Auditoría de prueba activa",
      pack5Active: "Pack de 5 auditorías activo",
      pack15Active: "Pack de 15 auditorías activo",
      singleAuditOneOff: "1 auditoría puntual",
      auditsAvailable: "auditorías disponibles",
      auditAvailableSingular: "auditoría disponible",
      auditsRemaining: "auditorías restantes",
      noAuditsAvailable: "No hay auditorías disponibles",
      managePlan: "Gestionar plan",
      trackedList: "Lista de anuncios seguidos",
      listing: "Anuncio",
      platform: "Plataforma",
      latestScore: "Última puntuación",
      qualityScore: "Puntuación de calidad",
      latestAudit: "Última auditoría",
      actions: "Acciones",
      noListings: "Todavía no hay anuncios",
      noListingsText:
        "Añade tu primer anuncio para analizar su potencial de conversión y recibir recomendaciones personalizadas.",
      addFirstListing: "Añadir un primer anuncio",
      untitledListing: "Anuncio sin título",
      untitledListingSafe: "Anuncio sin título",
      viewPublicListing: "Ver anuncio público",
      urlUnavailable: "URL no disponible",
      unknownPlatform: "desconocida",
      noAudit: "Sin auditoría",
      viewAudit: "Ver auditoría",
      deleteListing: "Eliminar anuncio",
      deleteListingConfirm:
        "¿Eliminar este anuncio del seguimiento? Las auditorías existentes seguirán disponibles en la página Auditorías.",
      deleteListingError: "No se pudo eliminar este anuncio.",
      deleteListingInProgress: "Eliminando…",
      reports: "Informes",
      viewReports: "Ver informes",
      viewReport: "Ver informe",
      auditInProgress: "Auditoría en curso",
      reportReady: "Informe listo",
      showLabel: "Mostrar:",
      creditsExhausted: "Créditos agotados",
      viewOffers: "Ver ofertas",
      workspaceOwner: "Propietario del workspace",
      scoreNeedsImprovement: "A mejorar",
      scoreCompetitive: "Competitivo",
      scoreHighPerforming: "Muy sólido",
      scoreMarketLeader: "Líder del mercado",
      creditTopupHelper: "Recarga tus créditos para continuar los análisis y lanzar nuevas auditorías.",
      workspaceMember: "Miembro del workspace",
      previousPage: "Anterior",
      paginationLabel: "Página {page} de {total}",
      nextPage: "Siguiente",
      processingStatus: "En proceso",
      backgroundAuditRunningDescription:
        "Tu análisis continúa en segundo plano. Puedes quedarte en esta página y abriremos el informe en cuanto esté listo.",
      backToAnalysis: "Volver al análisis",
      backgroundAuditReadyDescription:
        "La auditoría lanzada desde la página « nuevo anuncio » ha finalizado.",
      creditsExhaustedDescription:
        "Ya no tienes créditos disponibles para lanzar una nueva auditoría. Elige una oferta para continuar tus análisis.",
      later: "Más tarde",
      unknownError: "Se produjo un error desconocido",
      launchAudit: "Lanzar una auditoría",
    };
  }


  return {
    kicker: "Inventaire",
    heading: "Annonces suivies",
    subtitle: "Gérez et suivez la performance de vos annonces en temps réel.",
    headerDescription:
      "Pilotez toutes les annonces auditées depuis un seul endroit: plateforme, dernier score et accès direct au rapport détaillé.",
    identity: "Identité du workspace",
    owner: "Profil propriétaire",
    notProvided: "Non renseigné",
    trackedSingular: "annonce suivie",
    trackedPlural: "annonces suivies",
    addListing: "Analyser une nouvelle annonce",
    strategicListing:
      "Commencez par votre annonce la plus stratégique pour la comparer à ses concurrents proches.",
    activeListings: "annonces actives",
    listingsWithAudit: "avec audit",
    listingsWithoutAudit: "sans audit",
    freePlan: "Gratuit",
    proPlan: "Pro",
    proActive: "Plan Pro actif",
    auditsUsedSingular: "audit utilisé",
    auditsUsedPlural: "audits utilisés",
    unlimitedAudits: "Audits illimités",
    auditTestActive: "Audit test actif",
    pack5Active: "Pack 5 audits actif",
    pack15Active: "Pack 15 audits actif",
    singleAuditOneOff: "1 audit ponctuel",
    auditsAvailable: "audits disponibles",
    auditAvailableSingular: "audit disponible",
    auditsRemaining: "audits restants",
    noAuditsAvailable: "Aucun audit disponible",
    managePlan: "Gérer le plan",
    trackedList: "Liste des annonces suivies",
    listing: "Annonce",
    platform: "Plateforme",
    latestScore: "Dernier score",
    qualityScore: "Score qualité",
    latestAudit: "Dernier audit",
    actions: "Actions",
    noListings: "Aucune annonce pour le moment",
    noListingsText:
      "Ajoutez votre première annonce pour analyser son potentiel de conversion et obtenir des recommandations adaptées.",
    addFirstListing: "Ajouter une première annonce",
    untitledListing: "Annonce sans titre",
    untitledListingSafe: "Annonce sans titre",
    viewPublicListing: "Voir l’annonce publique",
    urlUnavailable: "URL non disponible",
    unknownPlatform: "inconnue",
    noAudit: "Aucun audit",
    viewAudit: "Voir l’audit",
    deleteListing: "Supprimer l’annonce",
    deleteListingConfirm: "Supprimer cette annonce du suivi ?",
    deleteListingError: "Impossible de retirer cette annonce.",
    deleteListingInProgress: "Suppression…",
    reports: "Rapports",
    viewReports: "Voir les rapports",
    viewReport: "Voir le rapport",
    auditInProgress: "Audit en cours",
    reportReady: "Rapport prêt",
    showLabel: "Afficher :",
    creditsExhausted: "Crédits épuisés",
    viewOffers: "Voir les offres",
    workspaceOwner: "Propriétaire du workspace",
    scoreNeedsImprovement: "À améliorer",
    scoreCompetitive: "Compétitif",
    scoreHighPerforming: "Très performant",
    scoreMarketLeader: "Leader du marché",
    creditTopupHelper: "Rechargez vos crédits pour continuer vos analyses et lancer de nouveaux audits.",
    workspaceMember: "Membre du workspace",
    previousPage: "Précédent",
    paginationLabel: "Page {page} sur {total}",
    nextPage: "Suivant",
    processingStatus: "En traitement",
    backgroundAuditRunningDescription:
      "Votre analyse continue en arrière-plan. Vous pouvez rester sur cette page, nous ouvrirons le rapport dès qu’il sera prêt.",
    backToAnalysis: "Revenir à l’analyse",
    backgroundAuditReadyDescription:
      "L’audit lancé depuis la page « nouvelle annonce » est terminé.",
    creditsExhaustedDescription:
      "Vous n’avez plus de crédits disponibles pour lancer un nouvel audit. Choisissez une offre pour continuer vos analyses.",
    later: "Plus tard",
    unknownError: "Une erreur inconnue est survenue",
    launchAudit: "Lancer un audit",
  };
}

function lqiLabelText(label: string | undefined, locale: Locale) {
  const labels: Record<Locale, Record<string, string>> = {
    en: {
      needs_work: "Needs work",
      improving: "Improving",
      competitive: "Competitive",
      strong_performer: "Strong performer",
      market_leader: "Market leader",
      default: "No audit",
    },
    fr: {
      needs_work: "À améliorer",
      improving: "En progression",
      competitive: "Compétitif",
      strong_performer: "Très performant",
      market_leader: "Leader du marché",
      default: "Aucun audit",
    },
    es: {
      needs_work: "Por mejorar",
      improving: "En mejora",
      competitive: "Competitivo",
      strong_performer: "Muy sólido",
      market_leader: "Líder del mercado",
      default: "Sin auditoría",
    },
    de: {
      needs_work: "Verbesserungsbedarf",
      improving: "In Verbesserung",
      competitive: "Wettbewerbsfähig",
      strong_performer: "Sehr stark",
      market_leader: "Marktführer",
      default: "Kein Audit",
    },
    it: {
      needs_work: "Da migliorare",
      improving: "In miglioramento",
      competitive: "Competitivo",
      strong_performer: "Molto performante",
      market_leader: "Leader di mercato",
      default: "Nessun audit",
    },
    pt: {
      needs_work: "A melhorar",
      improving: "Em melhoria",
      competitive: "Competitivo",
      strong_performer: "Muito forte",
      market_leader: "Líder de mercado",
      default: "Sem auditoria",
    },
    nl: {
      needs_work: "Moet beter",
      improving: "In verbetering",
      competitive: "Competitief",
      strong_performer: "Sterk presterend",
      market_leader: "Marktleider",
      default: "Geen audit",
    },
    ja: {
      needs_work: "改善が必要",
      improving: "改善中",
      competitive: "競争力あり",
      strong_performer: "高パフォーマンス",
      market_leader: "市場リーダー",
      default: "LQIあり",
    },
    zh: {
      needs_work: "需要改进",
      improving: "正在改进",
      competitive: "有竞争力",
      strong_performer: "表现强劲",
      market_leader: "市场领先",
      default: "LQI可用",
    },
    ko: {
      needs_work: "개선 필요",
      improving: "개선 중",
      competitive: "경쟁력 있음",
      strong_performer: "우수한 성과",
      market_leader: "시장 선도",
      default: "LQI 있음",
    },
    ar: {
      needs_work: "يحتاج إلى تحسين",
      improving: "يتحسن",
      competitive: "تنافسي",
      strong_performer: "أداء قوي",
      market_leader: "رائد في السوق",
      default: "LQI متاح",
    },
  };

  return labels[locale][label ?? "default"] ?? labels[locale].default;
}

export default function ListingsPage() {
  const router = useRouter();
  const [workspace, setWorkspace] = useState<WorkspaceSummary | null>(null);
  const [ownerProfile, setOwnerProfile] = useState<OwnerProfileDraft>(emptyOwnerProfile);
  const [preferences, setPreferences] = useState<PreferencesDraft>(emptyPreferencesDraft);
  const [listings, setListings] = useState<ListingPageRow[]>([]);
  const [planLabel, setPlanLabel] = useState<string | null>(null);
  const [quotaUsed, setQuotaUsed] = useState<number | null>(null);
  const [quotaLimit, setQuotaLimit] = useState<number | null>(null);
  const [creditsGranted, setCreditsGranted] = useState<number | null>(null);
  const [creditsAvailable, setCreditsAvailable] = useState<number | null>(null);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [currentPage, setCurrentPage] = useState(1);
  const [quotaOverlayOpen, setQuotaOverlayOpen] = useState(false);
  const [loadingAuditByListingId, setLoadingAuditByListingId] = useState<Record<string, boolean>>({});
  const [deletingListingById, setDeletingListingById] = useState<Record<string, boolean>>({});
  const [actionErrorByListingId, setActionErrorByListingId] = useState<Record<string, string>>({});
  const [bgAuditBanner, setBgAuditBanner] = useState<ListingsBgAuditState>({ kind: "none" });

  const { locale } = useI18n();
  const copy = getListingsCopy(locale);

  const dedupedListings = (() => {
    const grouped = new Map<string, ListingPageRow>();

    for (const listing of listings) {
      const key = normalizeSourceUrl(listing.source_url) ?? `listing:${listing.id}`;
      const existing = grouped.get(key);

      if (!existing) {
        grouped.set(key, {
          ...listing,
          audits: Array.isArray(listing.audits) ? [...listing.audits] : [],
        });
        continue;
      }

      const mergedAudits = [...(existing.audits ?? []), ...(listing.audits ?? [])];
      const preferred =
        new Date(listing.created_at).getTime() > new Date(existing.created_at).getTime()
          ? listing
          : existing;

      grouped.set(key, {
        ...preferred,
        audits: mergedAudits,
      });
    }

    return Array.from(grouped.values()).sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );
  })();

  useEffect(() => {
    async function load() {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        setWorkspace(null);
        setOwnerProfile(emptyOwnerProfile);
        setPreferences(emptyPreferencesDraft);
        setListings([]);
        setPlanLabel(null);
        setQuotaUsed(null);
        setQuotaLimit(null);
        return;
      }

      const resolvedWorkspace = await getOrCreateWorkspaceForUser({
        userId: user.id,
        email: user.email ?? null,
        client: supabase,
      });

      if (!resolvedWorkspace) {
        setWorkspace(null);
        setOwnerProfile(emptyOwnerProfile);
        setPreferences(emptyPreferencesDraft);
        setListings([]);
        setPlanLabel(null);
        setQuotaUsed(null);
        setQuotaLimit(null);
        return;
      }

      setWorkspace({
        id: resolvedWorkspace.id,
        name: resolvedWorkspace.name,
        slug: resolvedWorkspace.slug,
        owner_user_id: resolvedWorkspace.owner_user_id,
      });

      setOwnerProfile(
        loadStoredOwnerProfile({
          accountId: user.id,
          workspaceId: resolvedWorkspace.id,
          displayName:
            typeof user.user_metadata?.full_name === "string"
              ? user.user_metadata.full_name
              : typeof user.user_metadata?.display_name === "string"
              ? user.user_metadata.display_name
              : typeof user.user_metadata?.name === "string"
              ? user.user_metadata.name
              : null,
          email: user.email ?? null,
          workspaceName: resolvedWorkspace.name,
          roleLabel:
            resolvedWorkspace.owner_user_id === user.id
              ? copy.workspaceOwner
              : copy.workspaceMember,
        })
      );

      setPreferences(
        loadStoredPreferences({
          accountId: user.id,
          workspaceId: resolvedWorkspace.id,
        })
      );

      const { data, error } = await supabase
        .from("listings")
        .select(`
          id,
          workspace_id,
          source_url,
          source_platform,
          title,
          created_at,
          audits (
            id,
            overall_score,
            created_at,
            result_payload
          )
        `)
        .eq("workspace_id", resolvedWorkspace.id)
        .is("deleted_at", null)
        .order("created_at", { ascending: false });

      if (error) {
        console.error("Failed to load listings:", error);
        setListings([]);
      } else {
        setListings((data ?? []) as ListingPageRow[]);
      }

      try {
        const quota = await canCreateAudit(resolvedWorkspace.id, supabase);
        setPlanLabel(quota.planCode === "free" ? copy.freePlan : copy.proPlan);

        if (quota.planCode === "free" && quota.limit !== null) {
          setQuotaUsed(quota.currentCount);
          setQuotaLimit(quota.limit);
        } else {
          setQuotaUsed(null);
          setQuotaLimit(null);
        }

        try {
          const credits = await getWorkspaceAuditCredits(resolvedWorkspace.id, supabase);
          setCreditsGranted(credits.granted);
          setCreditsAvailable(credits.available);
        } catch (creditsError) {
          console.warn("Failed to load workspace audit credits", creditsError);
          setCreditsGranted(null);
          setCreditsAvailable(null);
        }
      } catch (error) {
        console.warn("Failed to load audit quota info", error);
      }
    }

    void load();
  }, [copy.freePlan, copy.proPlan]);

  useEffect(() => {
    const wsId = workspace?.id;
    if (!wsId || typeof window === "undefined") {
      setBgAuditBanner({ kind: "none" });
      return;
    }
    const workspaceId = wsId;

    function readBgAuditKeys() {
      try {
        const redirectRaw = sessionStorage.getItem(listingsAuditRedirectKey(workspaceId));
        if (redirectRaw) {
          const parsed = JSON.parse(redirectRaw) as { auditId?: string; ts?: number };
          if (
            parsed.auditId &&
            typeof parsed.ts === "number" &&
            Date.now() - parsed.ts < AUDIT_BG_REDIRECT_MAX_MS
          ) {
            setBgAuditBanner({ kind: "ready", auditId: parsed.auditId });
            return;
          }
        }

        const activeRaw = sessionStorage.getItem(listingsActiveAuditKey(workspaceId));
        if (activeRaw) {
          const parsed = JSON.parse(activeRaw) as {
            workspaceId?: string;
            startedAt?: number;
          };
          if (
            parsed.workspaceId === workspaceId &&
            typeof parsed.startedAt === "number" &&
            Date.now() - parsed.startedAt < AUDIT_BG_STALE_MS
          ) {
            setBgAuditBanner({ kind: "running" });
            return;
          }
        }
      } catch {
        /* ignore */
      }
      setBgAuditBanner({ kind: "none" });
    }

    readBgAuditKeys();
    const intervalId = window.setInterval(readBgAuditKeys, 2000);
    window.addEventListener("storage", readBgAuditKeys);
    return () => {
      window.clearInterval(intervalId);
      window.removeEventListener("storage", readBgAuditKeys);
    };
  }, [workspace?.id]);

  const workspaceDisplayName =
    ownerProfile.conciergeName || workspace?.name || copy.notProvided;
  const workspaceOwnerName =
    `${ownerProfile.firstName} ${ownerProfile.lastName}`.trim() || copy.notProvided;
  const workspaceInitials = (workspaceDisplayName || "WS")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join("");
  const listingsWithAudit = dedupedListings.filter(
    (listing) => Array.isArray(listing.audits) && listing.audits.length > 0
  ).length;
  const listingsWithoutAudit = Math.max(dedupedListings.length - listingsWithAudit, 0);
  const totalPages = Math.max(1, Math.ceil(dedupedListings.length / itemsPerPage));
  const effectivePage = Math.min(currentPage, totalPages);
  const paginatedListings = dedupedListings.slice(
    (effectivePage - 1) * itemsPerPage,
    effectivePage * itemsPerPage
  );

  const hasFreePlanWithQuota =
    planLabel === copy.freePlan && quotaLimit !== null && quotaUsed !== null;
  const remainingFreeAudits = hasFreePlanWithQuota
    ? Math.max(quotaLimit! - quotaUsed!, 0)
    : null;

  let planTitle: string | null = null;
  let planDetail: string | null = null;

  if (hasFreePlanWithQuota) {
    // Cas "Audit test" gratuit, limite codee a 1 via canCreateAudit
    planTitle = copy.auditTestActive;

    if (remainingFreeAudits === 1) {
      planDetail = copy.singleAuditOneOff;
    } else if (remainingFreeAudits !== null) {
      if (remainingFreeAudits === 0) {
        planDetail = copy.noAuditsAvailable;
      } else {
        planDetail = `${remainingFreeAudits} ${copy.auditsRemaining}`;
      }
    }
  } else if (planLabel === copy.proPlan) {
    // Cas pack(s) payant(s) : on ne deduit pas la taille du pack,
    // on affiche uniquement les credits d'audit disponibles.
    const available = creditsAvailable;

    planTitle = copy.proPlan;

    if (typeof available === "number") {
      if (available === 0) {
        planDetail = copy.noAuditsAvailable;
      } else if (available === 1) {
        planDetail = copy.singleAuditOneOff;
      } else {
        planDetail = `${available} ${available === 1 ? copy.auditAvailableSingular : copy.auditsAvailable}`;
      }
    }
  }

  const isProStatusCard = planLabel === copy.proPlan;
  const proCreditsLine =
    typeof creditsAvailable === "number"
      ? creditsAvailable === 0
        ? copy.noAuditsAvailable
        : `${creditsAvailable} ${creditsAvailable === 1 ? copy.auditAvailableSingular : copy.auditsAvailable}`
      : copy.noAuditsAvailable;

  async function handleRunAuditFromRow(listingId: string) {
    if (loadingAuditByListingId[listingId]) return;

    setLoadingAuditByListingId((prev) => ({ ...prev, [listingId]: true }));
    setActionErrorByListingId((prev) => {
      const next = { ...prev };
      delete next[listingId];
      return next;
    });

    try {
      const result = await runAuditForListing(listingId);

      if (!result.success) {
        if (result.code === "quota_exceeded") {
          setQuotaOverlayOpen(true);
        } else {
          setActionErrorByListingId((prev) => ({
            ...prev,
            [listingId]: result.message,
          }));
        }
        return;
      }

      if (result.auditId) {
        window.location.href = `/dashboard/audits/${result.auditId}`;
      } else {
        window.location.reload();
      }
    } catch (error) {
      setActionErrorByListingId((prev) => ({
        ...prev,
        [listingId]:
          error instanceof Error ? error.message : copy.unknownError,
      }));
    } finally {
      setLoadingAuditByListingId((prev) => ({ ...prev, [listingId]: false }));
    }
  }

  async function handleDeleteListing(listingId: string) {
    if (!workspace?.id || deletingListingById[listingId]) return;
    if (typeof window !== "undefined" && !window.confirm(copy.deleteListingConfirm)) {
      return;
    }

    setDeletingListingById((prev) => ({ ...prev, [listingId]: true }));
    setActionErrorByListingId((prev) => {
      const next = { ...prev };
      delete next[listingId];
      return next;
    });

    try {
      const { error } = await supabase
        .from("listings")
        .update({ deleted_at: new Date().toISOString() })
        .eq("id", listingId)
        .eq("workspace_id", workspace.id);

      if (error) {
        setActionErrorByListingId((prev) => ({
          ...prev,
          [listingId]: error.message || copy.deleteListingError,
        }));
        return;
      }

      setListings((prev) => prev.filter((l) => l.id !== listingId));
    } finally {
      setDeletingListingById((prev) => ({ ...prev, [listingId]: false }));
    }
  }

  return (
    <div className="space-y-7 md:space-y-8 text-sm">
      <div className="relative overflow-hidden rounded-[32px] nk-border nk-card-lg nk-page-header-card bg-[radial-gradient(circle_at_0_0,rgba(251,146,60,0.10),transparent_60%),radial-gradient(circle_at_100%_100%,rgba(16,185,129,0.10),transparent_55%),linear-gradient(180deg,rgba(255,255,255,0.99)_0%,rgba(248,250,252,0.98)_100%)] px-5 py-6 md:flex md:items-center md:justify-between md:gap-10 md:px-8 xl:px-10 xl:py-9 backdrop-blur-[4px] transition-all duration-200 ease-out hover:-translate-y-0.5 hover:shadow-[0_22px_60px_rgba(15,23,42,0.16)]">
        <div className="max-w-3xl space-y-2.5">
          <p className="nk-kicker-muted">{copy.kicker}</p>
          <h1 className="nk-page-title nk-page-title-dashboard">
            {copy.heading}
          </h1>
          <p className="nk-page-subtitle nk-page-subtitle-dashboard text-[13px] font-medium text-slate-700 md:text-sm">{copy.subtitle}</p>
          <p className="nk-page-subtitle nk-page-subtitle-dashboard nk-body-muted text-[15px] leading-7 text-slate-600">
            {copy.headerDescription}
          </p>
          <div className="mt-3 flex flex-wrap items-start gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
            <div className="flex h-14 w-14 flex-shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-slate-200 bg-white text-sm font-semibold text-slate-700">
              {ownerProfile.logoDataUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={ownerProfile.logoDataUrl}
                  alt={workspaceDisplayName}
                  className="h-full w-full object-cover"
                />
              ) : (
                workspaceInitials
              )}
            </div>
            <div className="grid flex-1 gap-4 sm:grid-cols-2">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                  {copy.identity}
                </p>
                <p className="mt-1 text-sm font-semibold text-slate-900">{workspaceDisplayName}</p>
              </div>
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                  {copy.owner}
                </p>
                <p className="mt-1 text-sm font-medium text-slate-900">{workspaceOwnerName}</p>
              </div>
            </div>
          </div>
          <div className="mt-2 flex flex-wrap gap-2 text-xs text-slate-600">
            <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-3 py-1 font-medium text-slate-800">
              <span className="h-1.5 w-1.5 rounded-full bg-orange-400" />
              {dedupedListings.length}{" "}
              {dedupedListings.length === 1 ? copy.trackedSingular : copy.trackedPlural}
            </span>
            <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-3 py-1 font-medium text-slate-800">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
              {dedupedListings.length} {copy.activeListings}
            </span>
            <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-3 py-1 font-medium text-slate-800">
              <span className="h-1.5 w-1.5 rounded-full bg-orange-400" />
              {listingsWithAudit} {copy.listingsWithAudit}
            </span>
            <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-3 py-1 font-medium text-slate-800">
              <span className="h-1.5 w-1.5 rounded-full bg-slate-400" />
              {listingsWithoutAudit} {copy.listingsWithoutAudit}
            </span>
          </div>
        </div>

        <div className="mt-5 text-left md:mt-0 md:text-right">
          <Link
            href="/dashboard/listings/new"
            className="nk-primary-btn text-xs font-semibold uppercase tracking-[0.18em]"
          >
            {copy.addListing}
          </Link>
          <p className="mt-2 text-xs leading-5 text-slate-500">{copy.strategicListing}</p>
        </div>
      </div>

      {planTitle && (
        <div className="nk-card-accent nk-card-accent-blue flex flex-col items-start justify-between gap-3 rounded-2xl nk-border bg-gradient-to-r from-slate-50 via-white to-slate-50 px-4 py-3 text-xs text-slate-700 shadow-[0_10px_24px_rgba(15,23,42,0.07),0_1px_0_rgba(255,255,255,0.62)_inset] transition-all duration-200 ease-out hover:-translate-y-0.5 hover:border-slate-300/90 hover:shadow-[0_16px_34px_rgba(15,23,42,0.11),0_1px_0_rgba(255,255,255,0.68)_inset] sm:flex-row sm:items-center">
          <div className="flex flex-col gap-0.5">
            <span className="font-semibold text-slate-900">
              {isProStatusCard ? copy.proActive : planTitle}
            </span>
            <span className="text-slate-600">
              {isProStatusCard ? proCreditsLine : planDetail}
            </span>
            {isProStatusCard ? (
              <span className="mt-1 text-slate-600">
                {copy.creditTopupHelper}
              </span>
            ) : null}
          </div>
          <Link
            href="/dashboard/billing"
            className="inline-flex items-center justify-center rounded-lg border border-emerald-300/75 bg-emerald-50 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-emerald-700 shadow-[0_8px_18px_rgba(16,185,129,0.14)] transition-all duration-200 hover:bg-emerald-100 hover:text-emerald-800"
          >
            {isProStatusCard ? copy.viewOffers : copy.managePlan}
          </Link>
        </div>
      )}

      {bgAuditBanner.kind === "running" ? (
        <div
          className="relative overflow-hidden rounded-[28px] border border-indigo-200/80 bg-[radial-gradient(circle_at_0_0,rgba(99,102,241,0.14),transparent_45%),radial-gradient(circle_at_100%_100%,rgba(14,165,233,0.10),transparent_40%),linear-gradient(135deg,#ffffff_0%,#eef2ff_42%,#f8fafc_100%)] px-5 py-4 shadow-[0_16px_40px_rgba(79,70,229,0.12),0_1px_0_rgba(255,255,255,0.72)_inset] ring-1 ring-white/60"
          role="status"
          aria-live="polite"
        >
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-r from-indigo-500/[0.03] via-transparent to-cyan-500/[0.04]" aria-hidden />
          <div className="relative flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex min-w-0 items-start gap-3">
              <div className="relative mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center">
                <span className="absolute inset-0 rounded-full bg-indigo-400/15 motion-safe:animate-pulse" aria-hidden />
                <span className="absolute inset-0 rounded-full bg-indigo-400/10 motion-safe:animate-ping" aria-hidden />
                <span className="relative flex h-10 w-10 items-center justify-center rounded-full border border-indigo-200/90 bg-white/90 shadow-sm">
                  <span className="h-5 w-5 animate-spin rounded-full border-2 border-indigo-200 border-t-indigo-600" />
                </span>
              </div>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-sm font-semibold tracking-tight text-slate-900">{copy.auditInProgress}</p>
                  <span className="inline-flex items-center rounded-full border border-indigo-200/90 bg-indigo-50/95 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-[0.12em] text-indigo-900">
                    {copy.processingStatus}
                  </span>
                </div>
                <p className="mt-1 text-xs leading-relaxed text-slate-600">
                  {copy.backgroundAuditRunningDescription}
                </p>
              </div>
            </div>
            <Link
              href="/dashboard/listings/new"
              className="inline-flex shrink-0 items-center justify-center rounded-xl border border-indigo-300/80 bg-white/90 px-4 py-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-indigo-800 shadow-[0_8px_20px_rgba(79,70,229,0.10)] transition hover:bg-indigo-50"
            >
              {copy.backToAnalysis}
            </Link>
          </div>
        </div>
      ) : null}

      {bgAuditBanner.kind === "ready" ? (
        <div className="relative overflow-hidden rounded-[28px] border border-emerald-200/85 bg-[radial-gradient(circle_at_0_0,rgba(16,185,129,0.16),transparent_42%),linear-gradient(135deg,#ecfdf5_0%,#ffffff_50%,#f0fdfa_100%)] px-5 py-4 shadow-[0_14px_36px_rgba(16,185,129,0.12),0_1px_0_rgba(255,255,255,0.7)_inset] ring-1 ring-white/60">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-semibold text-emerald-950">{copy.reportReady}</p>
              <p className="mt-1 text-xs text-emerald-900/85">
                {copy.backgroundAuditReadyDescription}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => {
                  const id = workspace?.id;
                  if (id) sessionStorage.removeItem(listingsAuditRedirectKey(id));
                  router.push(`/dashboard/audits/${bgAuditBanner.auditId}`);
                }}
                className="inline-flex items-center justify-center rounded-xl border border-emerald-500/80 bg-emerald-600 px-4 py-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-white shadow-[0_10px_24px_rgba(16,185,129,0.25)] transition hover:bg-emerald-700"
              >
                {copy.viewReport}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <div className="nk-card nk-card-hover overflow-hidden rounded-[28px] nk-border bg-gradient-to-br from-slate-50 via-white to-slate-50/90 p-0 shadow-[0_14px_36px_rgba(15,23,42,0.08),0_1px_0_rgba(255,255,255,0.64)_inset]">
        <div className="border-b border-slate-200/80 bg-white/95 px-5 py-4 backdrop-blur-sm">
          <p className="nk-section-title">{copy.trackedList}</p>
        </div>
        <div className="nk-table-shell overflow-x-auto bg-white/95">
          <table className="min-w-full text-left text-sm text-slate-900">
            <thead className="nk-table-header border-b border-slate-200/80 bg-slate-50/80 text-[11px] uppercase tracking-[0.18em] text-slate-500">
              <tr>
                <th className="px-5 py-2.5 text-[10px] font-semibold text-slate-500">{copy.listing}</th>
                <th className="px-5 py-2.5 text-[10px] font-semibold text-slate-500">{copy.platform}</th>
                <th className="px-5 py-2.5 text-[10px] font-semibold text-slate-500">{copy.latestScore}</th>
                <th className="px-5 py-2.5 text-[10px] font-semibold text-slate-500">{copy.qualityScore}</th>
                <th className="px-5 py-2.5 text-[10px] font-semibold text-slate-500">{copy.latestAudit}</th>
                <th className="px-5 py-2.5 text-[10px] font-semibold text-slate-500">{copy.reports}</th>
                <th className="px-5 py-2.5 text-[10px] font-semibold text-slate-500">{copy.actions}</th>
              </tr>
            </thead>

            <tbody>
              {dedupedListings.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-5 py-10">
                    <div className="flex justify-center">
                      <div className="nk-empty-state nk-card nk-card-hover">
                        <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-orange-500/10 text-orange-500">
                          <span className="text-lg">＋</span>
                        </div>
                        <h3 className="mt-4 text-base font-semibold text-slate-900">
                          {copy.noListings}
                        </h3>
                        <p className="mt-2 text-sm leading-6 text-slate-700">
                          {copy.noListingsText}
                        </p>
                        <div className="mt-4 flex justify-center">
                          <Link href="/dashboard/listings/new" className="nk-primary-btn text-xs font-semibold">
                            {copy.addFirstListing}
                          </Link>
                        </div>
                      </div>
                    </div>
                  </td>
                </tr>
              ) : (
                paginatedListings.map((listing) => {
                  const latestAudit = Array.isArray(listing.audits)
                    ? [...listing.audits].sort(
                        (a, b) =>
                          new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
                      )[0]
                    : undefined;

                  const auditResult =
                    latestAudit?.result_payload &&
                    typeof latestAudit.result_payload === "object"
                      ? (latestAudit.result_payload as {
                          listingQualityIndex?: { score?: number; label?: string };
                        })
                      : {};
                  const overallScore = Number(latestAudit?.overall_score ?? 0);

                  const lqi = auditResult?.listingQualityIndex;

                  const lqiScore =
                    typeof lqi?.score === "number" && Number.isFinite(lqi.score)
                      ? lqi.score
                      : null;

                  const reportCount = Array.isArray(listing.audits) ? listing.audits.length : 0;
                  const singleAuditId =
                    reportCount === 1 ? listing.audits?.[0]?.id ?? null : null;

                  return (
                    <tr
                      key={listing.id}
                      className="border-t border-slate-100 nk-table-row-hover even:bg-slate-50/40"
                    >
                      <td className="px-5 py-2.5 align-top">
                        <div className="flex flex-col gap-0.5">
                          <span className="font-medium text-slate-900">
                            {listing.title?.trim() || copy.untitledListingSafe}
                          </span>
                          {listing.source_url ? (
                            <a
                              href={listing.source_url}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center gap-1 rounded-full border border-orange-100 bg-orange-50/80 px-2.5 py-0.5 text-[11px] font-semibold text-orange-700 transition hover:bg-orange-100 hover:text-orange-700"
                            >
                              <span>{copy.viewPublicListing}</span>
                              <span aria-hidden="true">↗</span>
                            </a>
                          ) : (
                            <span className="text-xs text-slate-500">{copy.urlUnavailable}</span>
                          )}
                        </div>
                      </td>

                      <td className="px-5 py-2.5 align-top">
                        <span className="nk-badge-neutral text-[11px] lowercase tracking-[0.08em]">
                          {listing.source_platform ?? copy.unknownPlatform}
                        </span>
                      </td>

                      <td className="px-5 py-2.5 align-top">
                        {latestAudit ? (
                          <span className="nk-badge-emerald text-[11px] font-semibold">
                            {overallScore.toFixed(1)}/10
                          </span>
                        ) : (
                          <span className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-0.5 text-[11px] font-medium text-slate-500">
                            {copy.noAudit}
                          </span>
                        )}
                      </td>

                      <td className="px-5 py-2.5 align-top text-xs">
                        {latestAudit && lqiScore !== null ? (
                          <div className="flex flex-col gap-0.5">
                            <span className="font-semibold text-slate-900">
                              {Math.round(lqiScore)}/100
                            </span>
                            <span
                              className={`inline-flex w-fit items-center rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] ${lqiBadgeClass(
                                lqi?.label
                              )}`}
                            >
                              {lqiLabelText(lqi?.label, normalizeDashboardContentLocale(locale))}
                            </span>
                          </div>
                        ) : (
                          <div className="flex flex-col gap-0.5 text-xs text-slate-500">
                            <span>—</span>
                            <span>{copy.noAudit}</span>
                          </div>
                        )}
                      </td>

                      <td className="px-5 py-2.5 align-top text-xs text-slate-500">
                        {latestAudit ? formatAuditDate(latestAudit.created_at) : "–"}
                      </td>

                      <td className="align-top px-5 py-2.5 pr-8 text-xs text-slate-600">
                        <span className="inline-block pr-3 font-medium text-slate-800">
                          {formatReportCountLabel(reportCount, locale)}
                        </span>
                      </td>

                      <td className="relative overflow-visible px-5 py-2.5 align-top text-right">
                        <div className="flex flex-col items-end gap-1.5">
                          <div className="flex flex-nowrap items-center justify-end gap-1.5">
                            {latestAudit ? (
                              <DashboardActionsTooltip label={copy.viewAudit}>
                                <Link
                                  aria-label={copy.viewAudit}
                                  href={`/dashboard/audits/${latestAudit.id}`}
                                  className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-blue-200 bg-white/70 text-blue-600 transition hover:bg-blue-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400/35"
                                >
                                  <Eye aria-hidden className="h-3.5 w-3.5 shrink-0" strokeWidth={1.75} />
                                </Link>
                              </DashboardActionsTooltip>
                            ) : (
                              <DashboardActionsTooltip
                                label={copy.launchAudit}
                              >
                                <button
                                  type="button"
                                  aria-label={
                                    loadingAuditByListingId[listing.id]
                                      ? copy.auditInProgress
                                      : copy.launchAudit
                                  }
                                  onClick={() => void handleRunAuditFromRow(listing.id)}
                                  disabled={Boolean(loadingAuditByListingId[listing.id])}
                                  className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-white/70 text-slate-600 transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400/30"
                                >
                                  {loadingAuditByListingId[listing.id] ? (
                                    <Loader2
                                      aria-hidden
                                      className="h-3.5 w-3.5 shrink-0 animate-spin"
                                      strokeWidth={1.75}
                                    />
                                  ) : (
                                    <Sparkles aria-hidden className="h-3.5 w-3.5 shrink-0" strokeWidth={1.75} />
                                  )}
                                </button>
                              </DashboardActionsTooltip>
                            )}
                            <DashboardActionsTooltip label={copy.deleteListing}>
                              <button
                                type="button"
                                aria-label={
                                  deletingListingById[listing.id]
                                    ? copy.deleteListingInProgress
                                    : copy.deleteListing
                                }
                                onClick={() => void handleDeleteListing(listing.id)}
                                disabled={Boolean(deletingListingById[listing.id])}
                                className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-red-200 bg-white/70 text-red-500 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400/30"
                              >
                                {deletingListingById[listing.id] ? (
                                  <Loader2
                                    aria-hidden
                                    className="h-3.5 w-3.5 shrink-0 animate-spin text-red-500"
                                    strokeWidth={1.75}
                                  />
                                ) : (
                                  <Trash2 aria-hidden className="h-3.5 w-3.5 shrink-0" strokeWidth={1.75} />
                                )}
                              </button>
                            </DashboardActionsTooltip>
                          </div>
                          {actionErrorByListingId[listing.id] ? (
                            <span className="max-w-[220px] text-right text-[11px] text-red-600">
                              {actionErrorByListingId[listing.id]}
                            </span>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
        {dedupedListings.length > 0 ? (
          <div className="flex flex-col gap-3 border-t border-slate-200/80 bg-white/95 px-5 py-4 text-xs text-slate-600 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-2">
              <span className="font-medium text-slate-700">{copy.showLabel}</span>
              <select
                value={itemsPerPage}
                onChange={(e) => {
                  setItemsPerPage(Number(e.target.value));
                  setCurrentPage(1);
                }}
                className="rounded-lg border border-slate-300 bg-white px-2 py-1 text-xs font-medium text-slate-700 outline-none transition-colors focus:border-slate-400"
              >
                <option value={10}>10</option>
                <option value={20}>20</option>
                <option value={50}>50</option>
              </select>
            </div>

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
                disabled={effectivePage <= 1}
                className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 font-semibold text-slate-700 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {copy.previousPage}
              </button>
              <span className="font-medium text-slate-700">
                {copy.paginationLabel
                  .replace("{page}", String(effectivePage))
                  .replace("{total}", String(totalPages))}
              </span>
              <button
                type="button"
                onClick={() =>
                  setCurrentPage((prev) => Math.min(prev + 1, totalPages))
                }
                disabled={effectivePage >= totalPages}
                className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 font-semibold text-slate-700 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {copy.nextPage}
              </button>
            </div>
          </div>
        ) : null}
      </div>

      {quotaOverlayOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/25 px-4 backdrop-blur-[2px]"
          onClick={() => setQuotaOverlayOpen(false)}
        >
          <div
            className="w-full max-w-sm rounded-2xl border border-slate-200/80 bg-white/90 p-5 shadow-[0_24px_60px_rgba(15,23,42,0.24)] backdrop-blur-md"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-start gap-3">
              <div className="shrink-0 rounded-xl bg-slate-50/80 p-1.5 animate-pulse [animation-duration:4.5s]">
                <svg
                  viewBox="0 0 40 40"
                  className="h-9 w-9"
                  aria-hidden="true"
                  fill="none"
                >
                  <defs>
                    <linearGradient id="overlayNorixoN" x1="4" y1="6" x2="22" y2="30" gradientUnits="userSpaceOnUse">
                      <stop offset="0%" stopColor="#60a5fa" />
                      <stop offset="55%" stopColor="#3b82f6" />
                      <stop offset="100%" stopColor="#2563eb" />
                    </linearGradient>
                  </defs>
                  <rect x="4" y="8" width="18" height="24" rx="5" fill="url(#overlayNorixoN)" />
                  <path d="M8.7 27V13l8.6 10.6V13" stroke="white" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round" />
                  <circle cx="30.5" cy="11.2" r="3.2" fill="#cbd5e1" />
                  <path d="M29.6 15.4l-0.2 7.4M29.5 19.4l-6.1-3.1M29.5 19.7l4.1 3.5M29.4 22.8l-2.8 5.1" stroke="#64748b" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>
              <p className="pt-1 text-base font-semibold text-slate-950">{copy.creditsExhausted}</p>
            </div>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              {copy.creditsExhaustedDescription}
            </p>
            <div className="mt-4 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setQuotaOverlayOpen(false)}
                className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 transition-colors hover:bg-slate-50"
              >
                {copy.later}
              </button>
              <Link
                href="/dashboard/billing"
                className="inline-flex items-center justify-center rounded-md border border-blue-500/80 bg-[linear-gradient(135deg,#3b82f6_0%,#06b6d4_50%,#7c3aed_100%)] px-3 py-1.5 text-xs font-semibold text-white shadow-[0_12px_28px_rgba(59,130,246,0.28)] transition-all duration-200 hover:brightness-110"
              >
                {copy.viewOffers}
              </Link>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

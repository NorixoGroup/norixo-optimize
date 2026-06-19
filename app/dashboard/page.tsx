"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { getWorkspaceAuditCredits } from "@/lib/billing/getWorkspaceAuditCredits";
import { useI18n } from "@/components/i18n/I18nProvider";
import type { Locale } from "@/data/i18n";
import { getWorkspacePlan } from "@/lib/billing/getWorkspacePlan";
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

type DashboardListingRow = {
  id: string;
  workspace_id: string;
  created_at?: string;
  audits: {
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

function getOverviewCopy(locale: Locale) {
  if (locale === "en") {
    return {
      kicker: "Overview",
      headingPrefix: "Overview of",
      fallbackWorkspaceName: "your workspace",
      headerDescription:
        "Track your listings, recent audits, and overall conversion performance from one shared workspace view.",
      identity: "Workspace identity",
      owner: "Owner profile",
      workspaceOwner: "Workspace owner",
      notProvided: "Not provided",
      freePlan: "Free plan",
      proPlan: "Pro plan",
      unlimitedAudits: "unlimited audits",
      auditsUsedSingular: "audit used",
      auditsUsedPlural: "audits used",
      trackedSingular: "tracked listing",
      trackedPlural: "tracked listings",
      availableAuditSingular: "available audit",
      availableAuditPlural: "available audits",
      launchAudit: "Launch a new audit",
      obtainCredits: "Get credits",
      manageSubscription: "Manage subscription",
      proMessage: "Use Pro mode to audit your key listings with more depth.",
      freeMessage: "Upgrade to Pro to unlock Optimized Listing and deeper insights.",
      activity: "Recent activity",
      auditsThisWeek: "audits this week",
      scoreChange: "Combined score deltas (latest vs prior, listings with 2+ audits)",
      listingsAdded: "new listings added",
      planBadgePending: "Billing • syncing plan",
      planChipProActive: "Active Pro plan",
      planChipScaleActive: "Active Scale plan",
      planChipPaidActive: "Active paid plan",
      planChipFreeActive: "Active free plan",
      portfolioAuditedChipSingular: "listing with audits",
      portfolioAuditedChipPlural: "listings with audits",
      portfolioLevelKicker: "Portfolio level",
      portfolioLevelPending: "Awaiting usable audit data",
      portfolioLevelLow: "Major upside on listing fundamentals",
      portfolioLevelMid: "Balanced profile — refine key details",
      portfolioLevelHigh: "Strong overall portfolio performance",
      trackedListings: "Tracked listings",
      auditedListings: "Audited listings",
      averageScore: "Average score",
      bestScore: "Best score",
      trackedListingsText: "Total listings tracked in this workspace.",
      auditedListingsText: "Listings with at least one audit available.",
      averageScoreText: "Average score across the latest audits.",
      bestScoreText: "Best current performance across your listings.",
      quickSummary: "Quick summary",
      currentSituation: "Current situation",
      portfolioEmptyTitle: "No listings tracked yet",
      portfolioEmptyText:
        "Add your first listing to start measuring how your portfolio performs.",
      portfolioReadyTitle: "Portfolio ready to analyze",
      portfolioReadyText:
        "Your listings are in place. Run a first audit to unlock concrete recommendations.",
      portfolioActiveTitle: "Active portfolio",
      portfolioActiveText:
        "{listings} listings tracked — {audited} already audited, {runs} reports in total.",
      scorePendingTitle: "Score still forming",
      scorePendingText:
        "Your average score will appear once enough usable audits are available.",
      scoreLowTitle: "Priority: level up the basics",
      scoreLowText:
        "Your current level points to meaningful upside on core listing fundamentals.",
      scoreMidTitle: "Solid base to refine",
      scoreMidText:
        "Your portfolio is well positioned, with accessible gains on the details that matter.",
      scoreHighTitle: "Strong momentum",
      scoreHighText:
        "Your average is already competitive. The focus now is maximizing the last conversion levers.",
      creditsReadyTitle: "Credits ready to use",
      creditsReadyText:
        "You can launch a new audit immediately with no additional purchase.",
      creditsRenewTitle: "Credits to renew",
      creditsRenewText:
        "Your balance is empty. Top up your workspace to keep analyzing.",
      creditsExtendCoverageText:
        "Several listings are still unaudited — use a credit to complete your portfolio view.",
      nextAction: "Priority action",
      nextCaseA_message:
        "Add your first listing first — tracking and your opening audit insights follow immediately.",
      nextCaseA_cta: "Add a listing",
      nextCaseB_withUnaudited:
        "You have {credits} audit credits. Priority: run a new audit on a listing not yet audited.",
      nextCaseB_portfolioComplete:
        "You have {credits} audit credits. Priority: re-run an audit on a listing you already track to refine it.",
      nextCaseB_cta: "Launch a new audit",
      nextCaseC_message:
        "Your credit balance is at zero. Top up to resume audits and keep comparing listings.",
      nextCaseC_cta: "Get credits",
      nextCaseD_message:
        "You have {credits} credits. Your baseline is strong — re-run an audit to capture the last conversion gains.",
      nextCaseD_cta: "Launch a new audit",
      addListing: "Add a listing",
      auditCreditsChip: "{count} audit credits",
    };
  }

  if (locale === "ja") {
    return {
      kicker: "概要",
      headingPrefix: "概要:",
      fallbackWorkspaceName: "あなたのワークスペース",
      headerDescription:
        "1つの共有ワークスペース画面から、掲載情報、最近の監査、全体的なコンバージョン成果を追跡できます。",
      identity: "ワークスペース情報",
      owner: "オーナープロフィール",
      workspaceOwner: "ワークスペース所有者",
      notProvided: "未入力",
      freePlan: "無料プラン",
      proPlan: "Proプラン",
      unlimitedAudits: "無制限の監査",
      auditsUsedSingular: "使用済み監査",
      auditsUsedPlural: "使用済み監査",
      trackedSingular: "追跡中の掲載",
      trackedPlural: "追跡中の掲載",
      availableAuditSingular: "利用可能な監査",
      availableAuditPlural: "利用可能な監査",
      launchAudit: "新しい監査を開始",
      obtainCredits: "クレジットを取得",
      manageSubscription: "サブスクリプションを管理",
      proMessage: "Pro モードを使って、重要な掲載をより深く監査しましょう。",
      freeMessage: "Pro にアップグレードして Optimized Listing と詳細なインサイトを解放しましょう。",
      activity: "最近のアクティビティ",
      auditsThisWeek: "今週の監査",
      scoreChange: "スコア変化の合計",
      listingsAdded: "追加された新しい掲載",
      planBadgePending: "請求 • プラン同期中",
      planChipProActive: "Proプラン有効",
      planChipScaleActive: "Scaleプラン有効",
      planChipPaidActive: "有料プラン有効",
      planChipFreeActive: "無料プラン有効",
      portfolioAuditedChipSingular: "監査済み掲載",
      portfolioAuditedChipPlural: "監査済み掲載",
      portfolioLevelKicker: "ポートフォリオ水準",
      portfolioLevelPending: "利用可能な監査データを待機中",
      portfolioLevelLow: "掲載の基礎部分に大きな改善余地",
      portfolioLevelMid: "バランスの取れたプロフィール — 重要な詳細を調整",
      portfolioLevelHigh: "ポートフォリオ全体の成果は良好",
      trackedListings: "追跡中の掲載",
      auditedListings: "監査済み掲載",
      averageScore: "平均スコア",
      bestScore: "最高スコア",
      trackedListingsText: "このワークスペースで追跡されている掲載の総数です。",
      auditedListingsText: "少なくとも1件の監査がある掲載です。",
      averageScoreText: "最新監査における平均スコアです。",
      bestScoreText: "掲載の中で現在最も高い成果です。",
      quickSummary: "クイックサマリー",
      currentSituation: "現在の状況",
      portfolioEmptyTitle: "まだ追跡中の掲載がありません",
      portfolioEmptyText:
        "最初の掲載を追加して、ポートフォリオの成果測定を始めましょう。",
      portfolioReadyTitle: "分析準備が整ったポートフォリオ",
      portfolioReadyText:
        "掲載の準備が整いました。最初の監査を実行して具体的な提案を解放しましょう。",
      portfolioActiveTitle: "アクティブなポートフォリオ",
      portfolioActiveText:
        "{listings} 件の掲載を追跡中 — {audited} 件はすでに監査済み、合計 {runs} 件のレポートがあります。",
      scorePendingTitle: "スコアはまだ形成中",
      scorePendingText:
        "十分に利用可能な監査がそろうと、平均スコアが表示されます。",
      scoreLowTitle: "優先事項: 基礎を底上げする",
      scoreLowText:
        "現在の水準は、掲載の基礎部分に大きな改善余地があることを示しています。",
      scoreMidTitle: "磨き込みに適した堅実な基盤",
      scoreMidText:
        "ポートフォリオは良い位置にあり、重要な細部にまだ手の届く改善余地があります。",
      scoreHighTitle: "強い勢い",
      scoreHighText:
        "平均値はすでに競争力があります。今は最後のコンバージョンレバーを最大化する段階です。",
      creditsReadyTitle: "すぐ使えるクレジット",
      creditsReadyText:
        "追加購入なしで、すぐに新しい監査を開始できます。",
      creditsRenewTitle: "更新が必要なクレジット",
      creditsRenewText:
        "残高がありません。分析を続けるにはワークスペースをチャージしてください。",
      creditsExtendCoverageText:
        "まだ未監査の掲載がいくつかあります — クレジットを使ってポートフォリオ全体の見通しを完成させましょう。",
      nextAction: "優先アクション",
      nextCaseA_message:
        "まず最初の掲載を追加しましょう — 追跡と最初の監査インサイトがすぐに続きます。",
      nextCaseA_cta: "掲載を追加",
      nextCaseB_withUnaudited:
        "{credits} 件の監査クレジットがあります。優先事項: まだ監査していない掲載に新しい監査を実行してください。",
      nextCaseB_portfolioComplete:
        "{credits} 件の監査クレジットがあります。優先事項: すでに追跡している掲載を再監査して精度を高めてください。",
      nextCaseB_cta: "新しい監査を開始",
      nextCaseC_message:
        "クレジット残高が 0 です。チャージして監査を再開し、掲載比較を続けましょう。",
      nextCaseC_cta: "クレジットを取得",
      nextCaseD_message:
        "{credits} 件のクレジットがあります。基盤は強固です — 最後のコンバージョン改善を捉えるために再監査しましょう。",
      nextCaseD_cta: "新しい監査を開始",
      addListing: "掲載を追加",
      auditCreditsChip: "{count} 件の監査クレジット",
    };
  }

  if (locale === "zh") {
    return {
      kicker: "概览",
      headingPrefix: "概览：",
      fallbackWorkspaceName: "你的工作区",
      headerDescription:
        "在一个共享工作区视图中跟踪你的房源、最近的审计以及整体转化表现。",
      identity: "工作区信息",
      owner: "所有者资料",
      workspaceOwner: "工作区所有者",
      notProvided: "未提供",
      freePlan: "免费计划",
      proPlan: "Pro 计划",
      unlimitedAudits: "无限审计",
      auditsUsedSingular: "已使用审计",
      auditsUsedPlural: "已使用审计",
      trackedSingular: "跟踪中的房源",
      trackedPlural: "跟踪中的房源",
      availableAuditSingular: "可用审计",
      availableAuditPlural: "可用审计",
      launchAudit: "发起新的审计",
      obtainCredits: "获取额度",
      manageSubscription: "管理订阅",
      proMessage: "使用 Pro 模式，更深入地审计你的关键房源。",
      freeMessage: "升级到 Pro 以解锁 Optimized Listing 和更深入的洞察。",
      activity: "最近活动",
      auditsThisWeek: "本周审计",
      scoreChange: "综合分数变化",
      listingsAdded: "新增房源",
      planBadgePending: "账单 • 同步计划中",
      planChipProActive: "Pro 计划已激活",
      planChipScaleActive: "Scale 计划已激活",
      planChipPaidActive: "付费计划已激活",
      planChipFreeActive: "免费计划已激活",
      portfolioAuditedChipSingular: "有审计的房源",
      portfolioAuditedChipPlural: "有审计的房源",
      portfolioLevelKicker: "资产组合水平",
      portfolioLevelPending: "等待可用审计数据",
      portfolioLevelLow: "房源基本面仍有较大提升空间",
      portfolioLevelMid: "平衡型表现 — 优化关键细节",
      portfolioLevelHigh: "整体资产组合表现强劲",
      trackedListings: "跟踪中的房源",
      auditedListings: "已审计房源",
      averageScore: "平均分",
      bestScore: "最佳分数",
      trackedListingsText: "此工作区中正在跟踪的房源总数。",
      auditedListingsText: "至少有一次审计的房源。",
      averageScoreText: "最新审计的平均分。",
      bestScoreText: "你房源中当前表现最好的分数。",
      quickSummary: "快速总结",
      currentSituation: "当前情况",
      portfolioEmptyTitle: "尚未跟踪任何房源",
      portfolioEmptyText:
        "添加第一个房源，开始衡量你的资产组合表现。",
      portfolioReadyTitle: "资产组合已准备好分析",
      portfolioReadyText:
        "你的房源已就位。运行第一次审计以解锁具体建议。",
      portfolioActiveTitle: "活跃中的资产组合",
      portfolioActiveText:
        "已跟踪 {listings} 个房源 — 其中 {audited} 个已审计，共有 {runs} 份报告。",
      scorePendingTitle: "分数仍在形成中",
      scorePendingText:
        "当可用审计足够时，你的平均分将会显示。",
      scoreLowTitle: "优先事项：先补强基础",
      scoreLowText:
        "当前水平表明，房源基础面仍有明显的提升空间。",
      scoreMidTitle: "扎实基础，适合进一步优化",
      scoreMidText:
        "你的资产组合定位良好，在关键细节上仍有可获得的提升空间。",
      scoreHighTitle: "强劲势头",
      scoreHighText:
        "你的平均水平已经具有竞争力。现在的重点是最大化最后几个转化杠杆。",
      creditsReadyTitle: "可立即使用的额度",
      creditsReadyText:
        "你可以立即发起新的审计，无需额外购买。",
      creditsRenewTitle: "需要补充的额度",
      creditsRenewText:
        "你的余额已为空。请为工作区充值以继续分析。",
      creditsExtendCoverageText:
        "仍有多个房源尚未审计 — 使用额度来补全你的资产组合视图。",
      nextAction: "优先行动",
      nextCaseA_message:
        "先添加你的第一个房源 — 跟踪和初始审计洞察会立即跟上。",
      nextCaseA_cta: "添加房源",
      nextCaseB_withUnaudited:
        "你有 {credits} 个审计额度。优先事项：对尚未审计的房源发起新的审计。",
      nextCaseB_portfolioComplete:
        "你有 {credits} 个审计额度。优先事项：重新审计你已跟踪的房源以进一步优化。",
      nextCaseB_cta: "发起新的审计",
      nextCaseC_message:
        "你的额度余额为 0。请充值以恢复审计并继续比较房源。",
      nextCaseC_cta: "获取额度",
      nextCaseD_message:
        "你有 {credits} 个额度。你的基础已经很强 — 重新运行审计以捕捉最后的转化提升。",
      nextCaseD_cta: "发起新的审计",
      addListing: "添加房源",
      auditCreditsChip: "{count} 个审计额度",
    };
  }

  if (locale === "ko") {
    return {
      kicker: "개요",
      headingPrefix: "개요:",
      fallbackWorkspaceName: "내 워크스페이스",
      headerDescription:
        "하나의 공유 워크스페이스 화면에서 숙소, 최근 감사, 전체 전환 성과를 추적하세요.",
      identity: "워크스페이스 정보",
      owner: "소유자 프로필",
      workspaceOwner: "워크스페이스 소유자",
      notProvided: "제공되지 않음",
      freePlan: "무료 플랜",
      proPlan: "Pro 플랜",
      unlimitedAudits: "무제한 감사",
      auditsUsedSingular: "사용된 감사",
      auditsUsedPlural: "사용된 감사",
      trackedSingular: "추적 중인 숙소",
      trackedPlural: "추적 중인 숙소",
      availableAuditSingular: "사용 가능한 감사",
      availableAuditPlural: "사용 가능한 감사",
      launchAudit: "새 감사 시작",
      obtainCredits: "크레딧 받기",
      manageSubscription: "구독 관리",
      proMessage: "Pro 모드를 사용해 핵심 숙소를 더 깊이 있게 감사하세요.",
      freeMessage: "Pro로 업그레이드하여 Optimized Listing과 더 깊은 인사이트를 해제하세요.",
      activity: "최근 활동",
      auditsThisWeek: "이번 주 감사",
      scoreChange: "종합 점수 변화",
      listingsAdded: "새로 추가된 숙소",
      planBadgePending: "청구 • 플랜 동기화 중",
      planChipProActive: "Pro 플랜 활성",
      planChipScaleActive: "Scale 플랜 활성",
      planChipPaidActive: "유료 플랜 활성",
      planChipFreeActive: "무료 플랜 활성",
      portfolioAuditedChipSingular: "감사가 있는 숙소",
      portfolioAuditedChipPlural: "감사가 있는 숙소",
      portfolioLevelKicker: "포트폴리오 수준",
      portfolioLevelPending: "사용 가능한 감사 데이터를 기다리는 중",
      portfolioLevelLow: "숙소 기본 요소에 큰 개선 여지",
      portfolioLevelMid: "균형 잡힌 프로필 — 핵심 디테일 다듬기",
      portfolioLevelHigh: "전체 포트폴리오 성과가 강함",
      trackedListings: "추적 중인 숙소",
      auditedListings: "감사된 숙소",
      averageScore: "평균 점수",
      bestScore: "최고 점수",
      trackedListingsText: "이 워크스페이스에서 추적 중인 숙소의 총수입니다.",
      auditedListingsText: "최소 한 번 이상의 감사가 있는 숙소입니다.",
      averageScoreText: "최신 감사 기준 평균 점수입니다.",
      bestScoreText: "현재 숙소 중 가장 높은 성과입니다.",
      quickSummary: "빠른 요약",
      currentSituation: "현재 상황",
      portfolioEmptyTitle: "아직 추적 중인 숙소가 없습니다",
      portfolioEmptyText:
        "첫 숙소를 추가해 포트폴리오 성과 측정을 시작하세요.",
      portfolioReadyTitle: "분석 준비가 된 포트폴리오",
      portfolioReadyText:
        "숙소가 준비되었습니다. 첫 감사를 실행해 구체적인 권장사항을 확인하세요.",
      portfolioActiveTitle: "활성 포트폴리오",
      portfolioActiveText:
        "{listings}개의 숙소를 추적 중 — 그중 {audited}개는 이미 감사됨, 총 {runs}개의 보고서.",
      scorePendingTitle: "점수가 아직 형성 중입니다",
      scorePendingText:
        "충분한 사용 가능한 감사가 모이면 평균 점수가 표시됩니다.",
      scoreLowTitle: "우선순위: 기본기 끌어올리기",
      scoreLowText:
        "현재 수준은 숙소 기본 요소에 의미 있는 개선 여지가 있음을 보여줍니다.",
      scoreMidTitle: "다듬기 좋은 탄탄한 기반",
      scoreMidText:
        "포트폴리오는 잘 자리 잡고 있으며, 중요한 디테일에서 접근 가능한 개선 여지가 있습니다.",
      scoreHighTitle: "강한 모멘텀",
      scoreHighText:
        "평균은 이미 경쟁력이 있습니다. 이제는 마지막 전환 레버를 극대화하는 것이 핵심입니다.",
      creditsReadyTitle: "즉시 사용 가능한 크레딧",
      creditsReadyText:
        "추가 구매 없이 바로 새로운 감사를 시작할 수 있습니다.",
      creditsRenewTitle: "보충이 필요한 크레딧",
      creditsRenewText:
        "잔액이 비어 있습니다. 계속 분석하려면 워크스페이스를 충전하세요.",
      creditsExtendCoverageText:
        "아직 감사되지 않은 숙소가 여러 개 있습니다 — 크레딧을 사용해 포트폴리오 시야를 완성하세요.",
      nextAction: "우선 액션",
      nextCaseA_message:
        "먼저 첫 숙소를 추가하세요 — 추적과 첫 감사 인사이트가 바로 이어집니다.",
      nextCaseA_cta: "숙소 추가",
      nextCaseB_withUnaudited:
        "{credits}개의 감사 크레딧이 있습니다. 우선순위: 아직 감사하지 않은 숙소에 새 감사를 실행하세요.",
      nextCaseB_portfolioComplete:
        "{credits}개의 감사 크레딧이 있습니다. 우선순위: 이미 추적 중인 숙소를 다시 감사해 더 정교하게 만드세요.",
      nextCaseB_cta: "새 감사 시작",
      nextCaseC_message:
        "크레딧 잔액이 0입니다. 충전하여 감사를 재개하고 숙소 비교를 계속하세요.",
      nextCaseC_cta: "크레딧 받기",
      nextCaseD_message:
        "{credits}개의 크레딧이 있습니다. 기반은 강합니다 — 마지막 전환 향상을 잡기 위해 감사를 다시 실행하세요.",
      nextCaseD_cta: "새 감사 시작",
      addListing: "숙소 추가",
      auditCreditsChip: "{count}개의 감사 크레딧",
    };
  }

  if (locale === "ar") {
    return {
      kicker: "نظرة عامة",
      headingPrefix: "نظرة عامة على",
      fallbackWorkspaceName: "مساحة العمل الخاصة بك",
      headerDescription:
        "تابع إعلاناتك وعمليات التدقيق الأخيرة وأداء التحويل العام من خلال عرض واحد مشترك لمساحة العمل.",
      identity: "هوية مساحة العمل",
      owner: "ملف المالك",
      workspaceOwner: "مالك مساحة العمل",
      notProvided: "غير متوفر",
      freePlan: "الخطة المجانية",
      proPlan: "خطة Pro",
      unlimitedAudits: "عمليات تدقيق غير محدودة",
      auditsUsedSingular: "عملية تدقيق مستخدمة",
      auditsUsedPlural: "عمليات تدقيق مستخدمة",
      trackedSingular: "إعلان متابع",
      trackedPlural: "إعلانات متابَعة",
      availableAuditSingular: "عملية تدقيق متاحة",
      availableAuditPlural: "عمليات تدقيق متاحة",
      launchAudit: "إطلاق تدقيق جديد",
      obtainCredits: "الحصول على أرصدة",
      manageSubscription: "إدارة الاشتراك",
      proMessage: "استخدم وضع Pro لتدقيق إعلاناتك الأساسية بعمق أكبر.",
      freeMessage: "قم بالترقية إلى Pro لفتح Optimized Listing ورؤى أعمق.",
      activity: "النشاط الأخير",
      auditsThisWeek: "عمليات التدقيق هذا الأسبوع",
      scoreChange: "التغيرات المجمعة في النقاط",
      listingsAdded: "إعلانات جديدة تمت إضافتها",
      planBadgePending: "الفوترة • تتم مزامنة الخطة",
      planChipProActive: "خطة Pro نشطة",
      planChipScaleActive: "خطة Scale نشطة",
      planChipPaidActive: "خطة مدفوعة نشطة",
      planChipFreeActive: "خطة مجانية نشطة",
      portfolioAuditedChipSingular: "إعلان مع تدقيقات",
      portfolioAuditedChipPlural: "إعلانات مع تدقيقات",
      portfolioLevelKicker: "مستوى المحفظة",
      portfolioLevelPending: "في انتظار بيانات تدقيق قابلة للاستخدام",
      portfolioLevelLow: "فرصة كبيرة لتحسين أساسيات الإعلان",
      portfolioLevelMid: "ملف متوازن — حسّن التفاصيل الرئيسية",
      portfolioLevelHigh: "أداء قوي للمحفظة بشكل عام",
      trackedListings: "الإعلانات المتابَعة",
      auditedListings: "الإعلانات المدققة",
      averageScore: "متوسط النقاط",
      bestScore: "أفضل نقطة",
      trackedListingsText: "إجمالي الإعلانات المتابَعة في مساحة العمل هذه.",
      auditedListingsText: "الإعلانات التي لديها عملية تدقيق واحدة على الأقل.",
      averageScoreText: "متوسط النقاط عبر أحدث عمليات التدقيق.",
      bestScoreText: "أفضل أداء حالي بين إعلاناتك.",
      quickSummary: "ملخص سريع",
      currentSituation: "الوضع الحالي",
      portfolioEmptyTitle: "لا توجد إعلانات متابَعة بعد",
      portfolioEmptyText:
        "أضف إعلانك الأول لبدء قياس أداء محفظتك.",
      portfolioReadyTitle: "المحفظة جاهزة للتحليل",
      portfolioReadyText:
        "إعلاناتك أصبحت جاهزة. شغّل أول تدقيق للحصول على توصيات عملية.",
      portfolioActiveTitle: "محفظة نشطة",
      portfolioActiveText:
        "تتم متابعة {listings} إعلانًا — تم تدقيق {audited} منها بالفعل، مع {runs} تقريرًا إجمالًا.",
      scorePendingTitle: "النقاط لا تزال قيد التكوين",
      scorePendingText:
        "سيظهر متوسط النقاط بمجرد توفر عدد كافٍ من عمليات التدقيق القابلة للاستخدام.",
      scoreLowTitle: "الأولوية: رفع مستوى الأساسيات",
      scoreLowText:
        "يشير مستواك الحالي إلى فرصة حقيقية لتحسين أساسيات الإعلان.",
      scoreMidTitle: "قاعدة قوية يمكن تحسينها",
      scoreMidText:
        "محفظتك في موقع جيد، مع مكاسب متاحة في التفاصيل التي تهم فعلًا.",
      scoreHighTitle: "زخم قوي",
      scoreHighText:
        "متوسطك تنافسي بالفعل. التركيز الآن على تعظيم آخر روافع التحويل.",
      creditsReadyTitle: "أرصدة جاهزة للاستخدام",
      creditsReadyText:
        "يمكنك إطلاق تدقيق جديد فورًا من دون أي شراء إضافي.",
      creditsRenewTitle: "أرصدة تحتاج إلى تجديد",
      creditsRenewText:
        "رصيدك فارغ. أعد شحن مساحة العمل لمواصلة التحليل.",
      creditsExtendCoverageText:
        "لا تزال عدة إعلانات غير مدققة — استخدم رصيدًا لإكمال رؤية محفظتك.",
      nextAction: "الإجراء ذو الأولوية",
      nextCaseA_message:
        "أضف إعلانك الأول أولًا — سيتبعه التتبع وأولى رؤى التدقيق مباشرة.",
      nextCaseA_cta: "إضافة إعلان",
      nextCaseB_withUnaudited:
        "لديك {credits} من أرصدة التدقيق. الأولوية: تشغيل تدقيق جديد على إعلان لم يتم تدقيقه بعد.",
      nextCaseB_portfolioComplete:
        "لديك {credits} من أرصدة التدقيق. الأولوية: إعادة تشغيل تدقيق على إعلان تتابعه بالفعل لتحسينه.",
      nextCaseB_cta: "إطلاق تدقيق جديد",
      nextCaseC_message:
        "رصيدك من الأرصدة يساوي صفرًا. أعد الشحن لاستئناف التدقيقات ومواصلة مقارنة الإعلانات.",
      nextCaseC_cta: "الحصول على أرصدة",
      nextCaseD_message:
        "لديك {credits} من الأرصدة. قاعدتك قوية — أعد تشغيل تدقيق لالتقاط آخر مكاسب التحويل.",
      nextCaseD_cta: "إطلاق تدقيق جديد",
      addListing: "إضافة إعلان",
      auditCreditsChip: "{count} من أرصدة التدقيق",
    };
  }

  // TODO(i18n): add dedicated DE / IT / PT / NL translations.
  // Do not silently fallback to French.

  if (locale === "de") {
    return {
      kicker: "Übersicht",
      headingPrefix: "Übersicht von",
      fallbackWorkspaceName: "deinem Workspace",
      headerDescription:
        "Verfolge deine Inserate, aktuelle Audits und die gesamte Conversion-Leistung in einer gemeinsamen Workspace-Ansicht.",
      identity: "Workspace-Identität",
      owner: "Eigentümerprofil",
      workspaceOwner: "Workspace-Eigentümer",
      notProvided: "Nicht angegeben",
      freePlan: "Kostenloser Plan",
      proPlan: "Pro-Plan",
      unlimitedAudits: "unbegrenzte Audits",
      auditsUsedSingular: "Audit verwendet",
      auditsUsedPlural: "Audits verwendet",
      trackedSingular: "verfolgtes Inserat",
      trackedPlural: "verfolgte Inserate",
      availableAuditSingular: "verfügbares Audit",
      availableAuditPlural: "verfügbare Audits",
      launchAudit: "Neues Audit starten",
      obtainCredits: "Credits erhalten",
      manageSubscription: "Abo verwalten",
      proMessage: "Nutze den Pro-Modus, um deine wichtigsten Inserate genauer zu prüfen.",
      freeMessage: "Wechsle zu Pro, um Optimized Listing und tiefere Insights freizuschalten.",
      activity: "Aktuelle Aktivität",
      auditsThisWeek: "Audits diese Woche",
      scoreChange: "Kumulierte Score-Veränderung",
      listingsAdded: "neue Inserate hinzugefügt",
      planBadgePending: "Abrechnung • Plan wird synchronisiert",
      planChipProActive: "Pro-Plan aktiv",
      planChipScaleActive: "Scale-Plan aktiv",
      planChipPaidActive: "Bezahlter Plan aktiv",
      planChipFreeActive: "Kostenloser Plan aktiv",
      portfolioAuditedChipSingular: "Inserat mit Audits",
      portfolioAuditedChipPlural: "Inserate mit Audits",
      portfolioLevelKicker: "Portfolio-Niveau",
      portfolioLevelPending: "Warten auf verwertbare Audit-Daten",
      portfolioLevelLow: "Großes Potenzial bei den Inseratsgrundlagen",
      portfolioLevelMid: "Ausgeglichenes Profil — wichtige Details verfeinern",
      portfolioLevelHigh: "Starke Gesamtleistung des Portfolios",
      trackedListings: "Verfolgte Inserate",
      auditedListings: "Geprüfte Inserate",
      averageScore: "Durchschnittsscore",
      bestScore: "Bester Score",
      trackedListingsText: "Gesamtzahl der in diesem Workspace verfolgten Inserate.",
      auditedListingsText: "Inserate mit mindestens einem verfügbaren Audit.",
      averageScoreText: "Durchschnittsscore der neuesten Audits.",
      bestScoreText: "Beste aktuelle Leistung deiner Inserate.",
      quickSummary: "Kurzüberblick",
      currentSituation: "Aktuelle Situation",
      portfolioEmptyTitle: "Noch keine Inserate verfolgt",
      portfolioEmptyText:
        "Füge dein erstes Inserat hinzu, um die Leistung deines Portfolios zu messen.",
      portfolioReadyTitle: "Portfolio bereit zur Analyse",
      portfolioReadyText:
        "Deine Inserate sind bereit. Starte ein erstes Audit, um konkrete Empfehlungen zu erhalten.",
      portfolioActiveTitle: "Aktives Portfolio",
      portfolioActiveText:
        "{listings} Inserate verfolgt — {audited} bereits geprüft, {runs} Berichte insgesamt.",
      scorePendingTitle: "Score wird noch aufgebaut",
      scorePendingText:
        "Der Durchschnittsscore erscheint, sobald genügend verwertbare Audits vorhanden sind.",
      scoreLowTitle: "Priorität: Grundlagen verbessern",
      scoreLowText:
        "Dein aktuelles Niveau zeigt deutliches Optimierungspotenzial bei den Grundlagen.",
      scoreMidTitle: "Solide Basis zum Verfeinern",
      scoreMidText:
        "Dein Portfolio ist gut positioniert, mit erreichbaren Verbesserungen bei wichtigen Details.",
      scoreHighTitle: "Starke Dynamik",
      scoreHighText:
        "Dein Durchschnitt ist bereits wettbewerbsfähig. Jetzt geht es darum, die letzten Conversion-Hebel zu maximieren.",
      creditsReadyTitle: "Credits einsatzbereit",
      creditsReadyText:
        "Du kannst sofort ein neues Audit starten, ohne zusätzlich zu kaufen.",
      creditsRenewTitle: "Credits erneuern",
      creditsRenewText:
        "Dein Guthaben ist leer. Lade deinen Workspace auf, um weiter zu analysieren.",
      creditsExtendCoverageText:
        "Mehrere Inserate sind noch nicht geprüft — nutze einen Credit, um die Portfolio-Ansicht zu vervollständigen.",
      nextAction: "Priorisierte Aktion",
      nextCaseA_message:
        "Füge zuerst dein erstes Inserat hinzu — Tracking und erste Audit-Insights folgen direkt.",
      nextCaseA_cta: "Inserat hinzufügen",
      nextCaseB_withUnaudited:
        "Du hast {credits} Audit-Credits. Priorität: ein noch nicht geprüftes Inserat auditieren.",
      nextCaseB_portfolioComplete:
        "Du hast {credits} Audit-Credits. Priorität: ein bereits verfolgtes Inserat erneut prüfen.",
      nextCaseB_cta: "Neues Audit starten",
      nextCaseC_message:
        "Dein Credit-Guthaben ist bei null. Lade auf, um Audits fortzusetzen.",
      nextCaseC_cta: "Credits erhalten",
      nextCaseD_message:
        "Du hast {credits} Credits. Deine Basis ist stark — starte ein neues Audit für die letzten Conversion-Gewinne.",
      nextCaseD_cta: "Neues Audit starten",
      addListing: "Inserat hinzufügen",
      auditCreditsChip: "{count} Audit-Credits",
    };
  }

  if (locale === "it") {
    return {
      kicker: "Panoramica",
      headingPrefix: "Panoramica di",
      fallbackWorkspaceName: "il tuo workspace",
      headerDescription:
        "Monitora annunci, audit recenti e performance di conversione da una vista condivisa del workspace.",
      identity: "Identità del workspace",
      owner: "Profilo proprietario",
      workspaceOwner: "Proprietario del workspace",
      notProvided: "Non indicato",
      freePlan: "Piano gratuito",
      proPlan: "Piano Pro",
      unlimitedAudits: "audit illimitati",
      auditsUsedSingular: "audit usato",
      auditsUsedPlural: "audit usati",
      trackedSingular: "annuncio monitorato",
      trackedPlural: "annunci monitorati",
      availableAuditSingular: "audit disponibile",
      availableAuditPlural: "audit disponibili",
      launchAudit: "Avvia un nuovo audit",
      obtainCredits: "Ottieni crediti",
      manageSubscription: "Gestisci abbonamento",
      proMessage: "Usa la modalità Pro per analizzare più a fondo i tuoi annunci chiave.",
      freeMessage: "Passa a Pro per sbloccare Optimized Listing e insight più avanzati.",
      activity: "Attività recente",
      auditsThisWeek: "audit questa settimana",
      scoreChange: "Variazione cumulata del punteggio",
      listingsAdded: "nuovi annunci aggiunti",
      planBadgePending: "Fatturazione • sincronizzazione piano",
      planChipProActive: "Piano Pro attivo",
      planChipScaleActive: "Piano Scale attivo",
      planChipPaidActive: "Piano a pagamento attivo",
      planChipFreeActive: "Piano gratuito attivo",
      portfolioAuditedChipSingular: "annuncio con audit",
      portfolioAuditedChipPlural: "annunci con audit",
      portfolioLevelKicker: "Livello portfolio",
      portfolioLevelPending: "In attesa di dati audit utilizzabili",
      portfolioLevelLow: "Grande margine sui fondamentali degli annunci",
      portfolioLevelMid: "Profilo equilibrato — affina i dettagli chiave",
      portfolioLevelHigh: "Forte performance complessiva del portfolio",
      trackedListings: "Annunci monitorati",
      auditedListings: "Annunci analizzati",
      averageScore: "Punteggio medio",
      bestScore: "Miglior punteggio",
      trackedListingsText: "Totale annunci monitorati in questo workspace.",
      auditedListingsText: "Annunci con almeno un audit disponibile.",
      averageScoreText: "Punteggio medio degli ultimi audit.",
      bestScoreText: "Migliore performance attuale tra i tuoi annunci.",
      quickSummary: "Riepilogo rapido",
      currentSituation: "Situazione attuale",
      portfolioEmptyTitle: "Nessun annuncio monitorato",
      portfolioEmptyText:
        "Aggiungi il primo annuncio per iniziare a misurare la performance.",
      portfolioReadyTitle: "Portfolio pronto da analizzare",
      portfolioReadyText:
        "I tuoi annunci sono pronti. Avvia un primo audit per ottenere raccomandazioni concrete.",
      portfolioActiveTitle: "Portfolio attivo",
      portfolioActiveText:
        "{listings} annunci monitorati — {audited} già analizzati, {runs} report totali.",
      scorePendingTitle: "Punteggio in formazione",
      scorePendingText:
        "Il punteggio medio apparirà quando saranno disponibili audit sufficienti.",
      scoreLowTitle: "Priorità: migliorare le basi",
      scoreLowText:
        "Il livello attuale indica un forte potenziale di ottimizzazione sui fondamentali.",
      scoreMidTitle: "Base solida da affinare",
      scoreMidText:
        "Il portfolio è ben posizionato, con miglioramenti accessibili sui dettagli chiave.",
      scoreHighTitle: "Forte slancio",
      scoreHighText:
        "La media è già competitiva. Ora bisogna massimizzare gli ultimi leve di conversione.",
      creditsReadyTitle: "Crediti pronti all’uso",
      creditsReadyText:
        "Puoi avviare subito un nuovo audit senza acquisti aggiuntivi.",
      creditsRenewTitle: "Crediti da rinnovare",
      creditsRenewText:
        "Il saldo è vuoto. Ricarica il workspace per continuare l’analisi.",
      creditsExtendCoverageText:
        "Diversi annunci non sono ancora analizzati — usa un credito per completare la vista del portfolio.",
      nextAction: "Azione prioritaria",
      nextCaseA_message:
        "Aggiungi prima il tuo primo annuncio: monitoraggio e primi insight arriveranno subito.",
      nextCaseA_cta: "Aggiungi un annuncio",
      nextCaseB_withUnaudited:
        "Hai {credits} crediti audit. Priorità: analizzare un annuncio non ancora auditato.",
      nextCaseB_portfolioComplete:
        "Hai {credits} crediti audit. Priorità: rieseguire un audit su un annuncio già monitorato.",
      nextCaseB_cta: "Avvia un nuovo audit",
      nextCaseC_message:
        "Il saldo crediti è a zero. Ricarica per riprendere gli audit.",
      nextCaseC_cta: "Ottieni crediti",
      nextCaseD_message:
        "Hai {credits} crediti. La tua base è solida — rilancia un audit per gli ultimi guadagni di conversione.",
      nextCaseD_cta: "Avvia un nuovo audit",
      addListing: "Aggiungi un annuncio",
      auditCreditsChip: "{count} crediti audit",
    };
  }

  if (locale === "pt") {
    return {
      kicker: "Visão geral",
      headingPrefix: "Visão geral de",
      fallbackWorkspaceName: "o seu workspace",
      headerDescription:
        "Acompanhe anúncios, auditorias recentes e desempenho de conversão numa vista partilhada do workspace.",
      identity: "Identidade do workspace",
      owner: "Perfil do proprietário",
      workspaceOwner: "Proprietário do workspace",
      notProvided: "Não indicado",
      freePlan: "Plano gratuito",
      proPlan: "Plano Pro",
      unlimitedAudits: "auditorias ilimitadas",
      auditsUsedSingular: "auditoria usada",
      auditsUsedPlural: "auditorias usadas",
      trackedSingular: "anúncio acompanhado",
      trackedPlural: "anúncios acompanhados",
      availableAuditSingular: "auditoria disponível",
      availableAuditPlural: "auditorias disponíveis",
      launchAudit: "Iniciar nova auditoria",
      obtainCredits: "Obter créditos",
      manageSubscription: "Gerir subscrição",
      proMessage: "Use o modo Pro para auditar os seus anúncios principais com mais profundidade.",
      freeMessage: "Passe para Pro para desbloquear Optimized Listing e insights avançados.",
      activity: "Atividade recente",
      auditsThisWeek: "auditorias esta semana",
      scoreChange: "Variação acumulada da pontuação",
      listingsAdded: "novos anúncios adicionados",
      planBadgePending: "Faturação • sincronização do plano",
      planChipProActive: "Plano Pro ativo",
      planChipScaleActive: "Plano Scale ativo",
      planChipPaidActive: "Plano pago ativo",
      planChipFreeActive: "Plano gratuito ativo",
      portfolioAuditedChipSingular: "anúncio com auditoria",
      portfolioAuditedChipPlural: "anúncios com auditoria",
      portfolioLevelKicker: "Nível do portefólio",
      portfolioLevelPending: "A aguardar dados de auditoria utilizáveis",
      portfolioLevelLow: "Grande margem nos fundamentos dos anúncios",
      portfolioLevelMid: "Perfil equilibrado — refine detalhes-chave",
      portfolioLevelHigh: "Forte desempenho global do portefólio",
      trackedListings: "Anúncios acompanhados",
      auditedListings: "Anúncios auditados",
      averageScore: "Pontuação média",
      bestScore: "Melhor pontuação",
      trackedListingsText: "Total de anúncios acompanhados neste workspace.",
      auditedListingsText: "Anúncios com pelo menos uma auditoria disponível.",
      averageScoreText: "Pontuação média das auditorias mais recentes.",
      bestScoreText: "Melhor desempenho atual entre os seus anúncios.",
      quickSummary: "Resumo rápido",
      currentSituation: "Situação atual",
      portfolioEmptyTitle: "Nenhum anúncio acompanhado",
      portfolioEmptyText:
        "Adicione o primeiro anúncio para começar a medir o desempenho.",
      portfolioReadyTitle: "Portefólio pronto para análise",
      portfolioReadyText:
        "Os seus anúncios estão prontos. Inicie uma primeira auditoria para obter recomendações concretas.",
      portfolioActiveTitle: "Portefólio ativo",
      portfolioActiveText:
        "{listings} anúncios acompanhados — {audited} já auditados, {runs} relatórios no total.",
      scorePendingTitle: "Pontuação em formação",
      scorePendingText:
        "A pontuação média aparecerá quando houver auditorias utilizáveis suficientes.",
      scoreLowTitle: "Prioridade: melhorar as bases",
      scoreLowText:
        "O nível atual mostra potencial significativo nos fundamentos.",
      scoreMidTitle: "Base sólida para refinar",
      scoreMidText:
        "O portefólio está bem posicionado, com ganhos acessíveis nos detalhes-chave.",
      scoreHighTitle: "Forte dinâmica",
      scoreHighText:
        "A média já é competitiva. O foco agora é maximizar os últimos fatores de conversão.",
      creditsReadyTitle: "Créditos prontos a usar",
      creditsReadyText:
        "Pode iniciar uma nova auditoria imediatamente sem compra adicional.",
      creditsRenewTitle: "Créditos a renovar",
      creditsRenewText:
        "O saldo está vazio. Recarregue o workspace para continuar a análise.",
      creditsExtendCoverageText:
        "Vários anúncios ainda não foram auditados — use um crédito para completar a visão do portefólio.",
      nextAction: "Ação prioritária",
      nextCaseA_message:
        "Adicione primeiro o seu primeiro anúncio — acompanhamento e primeiros insights chegam logo a seguir.",
      nextCaseA_cta: "Adicionar anúncio",
      nextCaseB_withUnaudited:
        "Tem {credits} créditos de auditoria. Prioridade: auditar um anúncio ainda não auditado.",
      nextCaseB_portfolioComplete:
        "Tem {credits} créditos de auditoria. Prioridade: repetir uma auditoria num anúncio já acompanhado.",
      nextCaseB_cta: "Iniciar nova auditoria",
      nextCaseC_message:
        "O saldo de créditos está a zero. Recarregue para retomar as auditorias.",
      nextCaseC_cta: "Obter créditos",
      nextCaseD_message:
        "Tem {credits} créditos. A sua base é forte — repita uma auditoria para captar os últimos ganhos de conversão.",
      nextCaseD_cta: "Iniciar nova auditoria",
      addListing: "Adicionar anúncio",
      auditCreditsChip: "{count} créditos de auditoria",
    };
  }

  if (locale === "nl") {
    return {
      kicker: "Overzicht",
      headingPrefix: "Overzicht van",
      fallbackWorkspaceName: "je workspace",
      headerDescription:
        "Volg je advertenties, recente audits en conversieprestaties vanuit één gedeelde workspace-weergave.",
      identity: "Workspace-identiteit",
      owner: "Eigenaarprofiel",
      workspaceOwner: "Workspace-eigenaar",
      notProvided: "Niet opgegeven",
      freePlan: "Gratis plan",
      proPlan: "Pro-plan",
      unlimitedAudits: "onbeperkte audits",
      auditsUsedSingular: "audit gebruikt",
      auditsUsedPlural: "audits gebruikt",
      trackedSingular: "gevolgde advertentie",
      trackedPlural: "gevolgde advertenties",
      availableAuditSingular: "beschikbare audit",
      availableAuditPlural: "beschikbare audits",
      launchAudit: "Nieuwe audit starten",
      obtainCredits: "Credits verkrijgen",
      manageSubscription: "Abonnement beheren",
      proMessage: "Gebruik Pro om je belangrijkste advertenties grondiger te auditen.",
      freeMessage: "Upgrade naar Pro om Optimized Listing en diepere inzichten te ontgrendelen.",
      activity: "Recente activiteit",
      auditsThisWeek: "audits deze week",
      scoreChange: "Gecombineerde scoreverandering",
      listingsAdded: "nieuwe advertenties toegevoegd",
      planBadgePending: "Facturatie • plan synchroniseert",
      planChipProActive: "Pro-plan actief",
      planChipScaleActive: "Scale-plan actief",
      planChipPaidActive: "Betaald plan actief",
      planChipFreeActive: "Gratis plan actief",
      portfolioAuditedChipSingular: "advertentie met audits",
      portfolioAuditedChipPlural: "advertenties met audits",
      portfolioLevelKicker: "Portfolioniveau",
      portfolioLevelPending: "Wachten op bruikbare auditgegevens",
      portfolioLevelLow: "Veel verbetering mogelijk in advertentiebasis",
      portfolioLevelMid: "Gebalanceerd profiel — verfijn belangrijke details",
      portfolioLevelHigh: "Sterke algemene portfolioprestaties",
      trackedListings: "Gevolgde advertenties",
      auditedListings: "Geaudite advertenties",
      averageScore: "Gemiddelde score",
      bestScore: "Beste score",
      trackedListingsText: "Totaal aantal gevolgde advertenties in deze workspace.",
      auditedListingsText: "Advertenties met minstens één beschikbare audit.",
      averageScoreText: "Gemiddelde score van de nieuwste audits.",
      bestScoreText: "Beste huidige prestatie van je advertenties.",
      quickSummary: "Korte samenvatting",
      currentSituation: "Huidige situatie",
      portfolioEmptyTitle: "Nog geen advertenties gevolgd",
      portfolioEmptyText:
        "Voeg je eerste advertentie toe om de prestaties te meten.",
      portfolioReadyTitle: "Portfolio klaar voor analyse",
      portfolioReadyText:
        "Je advertenties staan klaar. Start een eerste audit voor concrete aanbevelingen.",
      portfolioActiveTitle: "Actieve portfolio",
      portfolioActiveText:
        "{listings} advertenties gevolgd — {audited} al geaudit, {runs} rapporten in totaal.",
      scorePendingTitle: "Score wordt nog opgebouwd",
      scorePendingText:
        "De gemiddelde score verschijnt zodra er voldoende bruikbare audits zijn.",
      scoreLowTitle: "Prioriteit: basis verbeteren",
      scoreLowText:
        "Je huidige niveau wijst op duidelijk optimalisatiepotentieel in de basis.",
      scoreMidTitle: "Solide basis om te verfijnen",
      scoreMidText:
        "Je portfolio is goed gepositioneerd, met haalbare winst op belangrijke details.",
      scoreHighTitle: "Sterke dynamiek",
      scoreHighText:
        "Je gemiddelde is al competitief. De focus ligt nu op de laatste conversiehefbomen.",
      creditsReadyTitle: "Credits klaar voor gebruik",
      creditsReadyText:
        "Je kunt meteen een nieuwe audit starten zonder extra aankoop.",
      creditsRenewTitle: "Credits vernieuwen",
      creditsRenewText:
        "Je saldo is leeg. Laad je workspace op om verder te analyseren.",
      creditsExtendCoverageText:
        "Meerdere advertenties zijn nog niet geaudit — gebruik een credit om je portfolio-overzicht compleet te maken.",
      nextAction: "Prioritaire actie",
      nextCaseA_message:
        "Voeg eerst je eerste advertentie toe — tracking en eerste auditinzichten volgen meteen.",
      nextCaseA_cta: "Advertentie toevoegen",
      nextCaseB_withUnaudited:
        "Je hebt {credits} auditcredits. Prioriteit: audit een advertentie die nog niet is geaudit.",
      nextCaseB_portfolioComplete:
        "Je hebt {credits} auditcredits. Prioriteit: audit opnieuw een advertentie die je al volgt.",
      nextCaseB_cta: "Nieuwe audit starten",
      nextCaseC_message:
        "Je creditsaldo staat op nul. Laad op om audits te hervatten.",
      nextCaseC_cta: "Credits verkrijgen",
      nextCaseD_message:
        "Je hebt {credits} credits. Je basis is sterk — start opnieuw een audit voor de laatste conversiewinst.",
      nextCaseD_cta: "Nieuwe audit starten",
      addListing: "Advertentie toevoegen",
      auditCreditsChip: "{count} auditcredits",
    };
  }

  if (locale === "es") {
    return {
      kicker: "Resumen",
      headingPrefix: "Resumen de",
      fallbackWorkspaceName: "tu espacio de trabajo",
      headerDescription:
        "Sigue tus anuncios, auditorías recientes y rendimiento de conversión desde una vista compartida.",
      identity: "Identidad del espacio",
      owner: "Perfil propietario",
      notProvided: "No indicado",
      freePlan: "Plan gratuito",
      proPlan: "Plan Pro",
      unlimitedAudits: "auditorías ilimitadas",
      auditsUsedSingular: "auditoría usada",
      auditsUsedPlural: "auditorías usadas",
      trackedSingular: "anuncio seguido",
      trackedPlural: "anuncios seguidos",
      availableAuditSingular: "auditoría disponible",
      availableAuditPlural: "auditorías disponibles",
      launchAudit: "Lanzar una nueva auditoría",
      obtainCredits: "Obtener créditos",
      manageSubscription: "Gestionar suscripción",
      proMessage: "Usa el modo Pro para auditar tus anuncios clave con más profundidad.",
      freeMessage: "Pasa a Pro para desbloquear Optimized Listing e insights avanzados.",
      activity: "Actividad reciente",
      auditsThisWeek: "auditorías esta semana",
      scoreChange: "Variación acumulada de puntuación",
      listingsAdded: "nuevos anuncios añadidos",
      planBadgePending: "Facturación • sincronizando plan",
      planChipProActive: "Plan Pro activo",
      planChipScaleActive: "Plan Scale activo",
      planChipPaidActive: "Plan de pago activo",
      planChipFreeActive: "Plan gratuito activo",
      portfolioAuditedChipSingular: "anuncio auditado",
      portfolioAuditedChipPlural: "anuncios auditados",
      portfolioLevelKicker: "Nivel del portafolio",
      portfolioLevelPending: "Esperando datos de auditoría útiles",
      portfolioLevelLow: "Gran margen de mejora en los fundamentos",
      portfolioLevelMid: "Perfil equilibrado — mejora los detalles clave",
      portfolioLevelHigh: "Rendimiento global sólido",
      trackedListings: "Anuncios seguidos",
      auditedListings: "Anuncios auditados",
      averageScore: "Puntuación media",
      bestScore: "Mejor puntuación",
      trackedListingsText: "Total de anuncios seguidos en este espacio.",
      auditedListingsText: "Anuncios con al menos una auditoría disponible.",
      averageScoreText: "Puntuación media de las últimas auditorías.",
      bestScoreText: "Mejor rendimiento actual de tus anuncios.",
      quickSummary: "Resumen rápido",
      currentSituation: "Situación actual",
      portfolioEmptyTitle: "Todavía no hay anuncios",
      portfolioEmptyText:
        "Añade tu primer anuncio para empezar a medir el rendimiento.",
      portfolioReadyTitle: "Portafolio listo para analizar",
      portfolioReadyText:
        "Tus anuncios están listos. Lanza una primera auditoría para obtener recomendaciones concretas.",
      portfolioActiveTitle: "Portafolio activo",
      portfolioActiveText:
        "{listings} anuncios seguidos — {audited} ya auditados, {runs} informes en total.",
      scorePendingTitle: "Puntuación en preparación",
      scorePendingText:
        "La puntuación media aparecerá cuando haya suficientes auditorías útiles.",
      scoreLowTitle: "Prioridad: mejorar la base",
      scoreLowText:
        "Tu nivel actual muestra un potencial importante de optimización.",
      scoreMidTitle: "Base sólida para mejorar",
      scoreMidText:
        "Tu portafolio está bien posicionado, con mejoras accesibles en detalles clave.",
      scoreHighTitle: "Buena dinámica",
      scoreHighText:
        "Tu media ya es competitiva. Ahora toca maximizar los últimos factores de conversión.",
      creditsReadyTitle: "Créditos listos para usar",
      creditsReadyText:
        "Puedes lanzar una nueva auditoría inmediatamente sin compra adicional.",
      creditsRenewTitle: "Créditos por renovar",
      creditsRenewText:
        "Tu saldo está vacío. Recarga tu espacio para seguir analizando.",
      creditsExtendCoverageText:
        "Varios anuncios aún no están auditados — usa un crédito para completar la visión del portafolio.",
      nextAction: "Acción prioritaria",
      nextCaseA_message:
        "Añade primero tu primer anuncio: el seguimiento y los primeros insights llegarán enseguida.",
      nextCaseA_cta: "Añadir un anuncio",
      nextCaseB_withUnaudited:
        "Tienes {credits} créditos de auditoría. Prioridad: auditar un anuncio todavía no auditado.",
      nextCaseB_portfolioComplete:
        "Tienes {credits} créditos de auditoría. Prioridad: relanzar una auditoría sobre un anuncio ya seguido.",
      nextCaseB_cta: "Lanzar una nueva auditoría",
      nextCaseC_message:
        "Tu saldo de créditos está a cero. Recarga para reanudar las auditorías.",
      nextCaseC_cta: "Obtener créditos",
      nextCaseD_message:
        "Tienes {credits} créditos. Tu base es sólida — relanza una auditoría para captar los últimos ganhos de conversión.",
      nextCaseD_cta: "Lanzar una nueva auditoría",
      addListing: "Añadir un anuncio",
      workspaceOwner: "Propietario del workspace",
      auditCreditsChip: "{count} créditos de auditoría",
    };
  }

  return {
    kicker: "Vue d’ensemble",
    headingPrefix: "Aperçu de",
    fallbackWorkspaceName: "votre workspace",
    headerDescription:
      "Suivez vos annonces, vos audits récents et votre performance de conversion depuis une vue workspace partagée.",
    identity: "Identité du workspace",
    owner: "Profil propriétaire",
    notProvided: "Non renseigné",
    freePlan: "Plan Gratuit",
    proPlan: "Plan Pro",
    unlimitedAudits: "audits illimités",
    auditsUsedSingular: "audit utilisé",
    auditsUsedPlural: "audits utilisés",
    trackedSingular: "annonce suivie",
    trackedPlural: "annonces suivies",
    availableAuditSingular: "audit disponible",
    availableAuditPlural: "audits disponibles",
    launchAudit: "Lancer un nouvel audit",
    obtainCredits: "Obtenir des crédits",
    manageSubscription: "Gérer l’abonnement",
    proMessage: "Profitez du mode Pro pour auditer vos annonces clés avec plus de profondeur.",
    freeMessage: "Passez en Pro pour débloquer l’Optimized Listing et des insights avancés.",
    activity: "Activité récente",
    auditsThisWeek: "audits cette semaine",
    scoreChange:
      "Écarts cumulés de score (dernier vs précédent, annonces avec 2+ audits)",
    listingsAdded: "nouvelles annonces ajoutées",
    planBadgePending: "Facturation • synchronisation du plan",
    planChipProActive: "Plan Pro actif",
    planChipScaleActive: "Plan Scale actif",
    planChipPaidActive: "Offre payante active",
    planChipFreeActive: "Plan gratuit actif",
    portfolioAuditedChipSingular: "annonce auditée",
    portfolioAuditedChipPlural: "annonces auditées",
    portfolioLevelKicker: "Niveau portefeuille",
    portfolioLevelPending: "En attente de données d’audit exploitables",
    portfolioLevelLow: "Marge importante sur les fondamentaux des annonces",
    portfolioLevelMid: "Profil équilibré — affinez les détails clés",
    portfolioLevelHigh: "Performance globale du portefeuille déjà solide",
    trackedListings: "Annonces suivies",
    auditedListings: "Annonces auditées",
    averageScore: "Score moyen",
    bestScore: "Meilleur score",
    trackedListingsText: "Nombre total d’annonces suivies dans cet espace.",
    auditedListingsText: "Annonces ayant au moins un audit disponible.",
    averageScoreText: "Moyenne des scores sur les derniers audits.",
    bestScoreText: "Meilleure performance actuelle parmi vos annonces.",
    quickSummary: "Résumé rapide",
    currentSituation: "Situation actuelle",
    portfolioEmptyTitle: "Aucune annonce suivie",
    portfolioEmptyText:
      "Ajoutez votre première annonce pour commencer à mesurer votre performance.",
    portfolioReadyTitle: "Portefeuille prêt à analyser",
    portfolioReadyText:
      "Vos annonces sont en place. Lancez un premier audit pour obtenir des recommandations concrètes.",
    portfolioActiveTitle: "Portefeuille actif",
    portfolioActiveText:
      "{listings} annonces suivies — {audited} déjà auditées, {runs} rapports au total.",
    scorePendingTitle: "Score à consolider",
    scorePendingText:
      "Le score moyen apparaîtra dès que plusieurs audits exploitables seront disponibles.",
    scoreLowTitle: "Priorité à la remise à niveau",
    scoreLowText:
      "Votre niveau moyen indique un potentiel d’optimisation important sur les fondamentaux.",
    scoreMidTitle: "Base solide à renforcer",
    scoreMidText:
      "Votre portefeuille est bien positionné, avec encore des gains accessibles sur les détails clés.",
    scoreHighTitle: "Bonne dynamique",
    scoreHighText:
      "Votre niveau moyen est déjà compétitif. L’enjeu est maintenant de maximiser les derniers leviers.",
    creditsReadyTitle: "Crédits prêts à l’emploi",
    creditsReadyText:
      "Vous pouvez lancer immédiatement un nouvel audit sans achat supplémentaire.",
    creditsRenewTitle: "Crédits à renouveler",
    creditsRenewText:
      "Votre solde est épuisé. Rechargez votre workspace pour poursuivre vos analyses.",
    creditsExtendCoverageText:
      "Plusieurs annonces ne sont pas encore auditées — utilisez un crédit pour compléter la vision du portefeuille.",
    nextAction: "Action prioritaire",
    nextCaseA_message:
      "Ajoutez d’abord votre première annonce : le suivi et vos premiers insights d’audit suivront tout de suite.",
    nextCaseA_cta: "Ajouter une annonce",
    nextCaseB_withUnaudited:
      "Vous disposez de {credits} crédits d’audit. Priorité : lancer un nouvel audit sur une annonce pas encore auditée.",
    nextCaseB_portfolioComplete:
      "Vous disposez de {credits} crédits d’audit. Priorité : relancer un audit sur une annonce déjà suivie pour l’affiner.",
    nextCaseB_cta: "Lancer un nouvel audit",
    nextCaseC_message:
      "Votre solde de crédits est à zéro. Rechargez pour relancer des audits et continuer à comparer vos annonces.",
    nextCaseC_cta: "Obtenir des crédits",
    nextCaseD_message:
      "Vous disposez de {credits} crédits. Votre base est solide — relancez un audit pour viser les derniers gains de conversion.",
    nextCaseD_cta: "Lancer un nouvel audit",
    addListing: "Ajouter une annonce",
    workspaceOwner: "Propriétaire du workspace",
    auditCreditsChip: "{count} crédits d’audit",
  };
}

/** Accent gauche + halo léger pour les 3 cartes « Résumé rapide » (ordre fixe). */
const QUICK_INSIGHT_ACCENT_CLASS = [
  "border-l-[3px] border-indigo-400/65 bg-[linear-gradient(135deg,rgba(99,102,241,0.07)_0%,rgba(255,255,255,0.97)_48%,rgba(248,250,252,0.98)_100%)]",
  "border-l-[3px] border-amber-400/55 bg-[linear-gradient(135deg,rgba(245,158,11,0.075)_0%,rgba(255,255,255,0.97)_50%,rgba(255,251,235,0.42)_100%)]",
  "border-l-[3px] border-emerald-500/55 bg-[linear-gradient(135deg,rgba(16,185,129,0.07)_0%,rgba(255,255,255,0.97)_48%,rgba(236,253,245,0.5)_100%)]",
] as const;

type QuickInsightCard = { title: string; text: string };

function buildQuickInsightCards(
  copy: ReturnType<typeof getOverviewCopy>,
  listingCount: number,
  totalAuditedListings: number,
  totalAuditRuns: number,
  avgScoreNumeric: number | null,
  availableAuditCredits: number
): QuickInsightCard[] {
  const card1: QuickInsightCard =
    listingCount === 0
      ? { title: copy.portfolioEmptyTitle, text: copy.portfolioEmptyText }
      : totalAuditedListings === 0
        ? { title: copy.portfolioReadyTitle, text: copy.portfolioReadyText }
        : {
            title: copy.portfolioActiveTitle,
            text: copy.portfolioActiveText
              .replace("{listings}", String(listingCount))
              .replace("{audited}", String(totalAuditedListings))
              .replace("{runs}", String(totalAuditRuns)),
          };

  const card2: QuickInsightCard = (() => {
    if (avgScoreNumeric === null) {
      return { title: copy.scorePendingTitle, text: copy.scorePendingText };
    }
    if (avgScoreNumeric < 6) {
      return { title: copy.scoreLowTitle, text: copy.scoreLowText };
    }
    if (avgScoreNumeric < 7.5) {
      return { title: copy.scoreMidTitle, text: copy.scoreMidText };
    }
    return { title: copy.scoreHighTitle, text: copy.scoreHighText };
  })();

  const card3: QuickInsightCard = (() => {
    const title =
      availableAuditCredits > 0 ? copy.creditsReadyTitle : copy.creditsRenewTitle;
    const text =
      availableAuditCredits > 0
        ? totalAuditRuns >= 3 && listingCount > totalAuditedListings
          ? copy.creditsExtendCoverageText
          : copy.creditsReadyText
        : copy.creditsRenewText;
    return { title, text };
  })();

  return [card1, card2, card3];
}

type NextActionResolved = { message: string; ctaLabel: string; href: string };

function resolveNextAction(
  copy: ReturnType<typeof getOverviewCopy>,
  listingCount: number,
  availableAuditCredits: number,
  totalAuditedListings: number,
  avgScoreNumeric: number | null
): NextActionResolved {
  if (listingCount === 0) {
    return {
      message: copy.nextCaseA_message,
      ctaLabel: copy.nextCaseA_cta,
      href: "/dashboard/listings/new",
    };
  }

  if (availableAuditCredits === 0) {
    return {
      message: copy.nextCaseC_message,
      ctaLabel: copy.nextCaseC_cta,
      href: "/dashboard/billing",
    };
  }

  if (
    totalAuditedListings > 0 &&
    avgScoreNumeric !== null &&
    avgScoreNumeric >= 7.5
  ) {
    return {
      message: copy.nextCaseD_message.replace(
        "{credits}",
        String(availableAuditCredits)
      ),
      ctaLabel: copy.nextCaseD_cta,
      href: "/dashboard/listings/new",
    };
  }

  const caseBMessage =
    listingCount > totalAuditedListings
      ? copy.nextCaseB_withUnaudited
      : copy.nextCaseB_portfolioComplete;

  return {
    message: caseBMessage.replace("{credits}", String(availableAuditCredits)),
    ctaLabel: copy.nextCaseB_cta,
    href: "/dashboard/listings/new",
  };
}

export default function DashboardPage() {
  const { locale } = useI18n();
  const [workspace, setWorkspace] = useState<WorkspaceSummary | null>(null);
  const [ownerProfile, setOwnerProfile] = useState<OwnerProfileDraft>(emptyOwnerProfile);
  const [preferences, setPreferences] = useState<PreferencesDraft>(emptyPreferencesDraft);
  const [planCode, setPlanCode] = useState<string | null>(null);
  const [availableAuditCredits, setAvailableAuditCredits] = useState(0);
  const [quotaUsed, setQuotaUsed] = useState<number | null>(null);
  const [quotaLimit, setQuotaLimit] = useState<number | null>(null);
  const [listings, setListings] = useState<DashboardListingRow[]>([]);
  const [referenceNow] = useState(() => Date.now());

  const isPro = planCode === "pro";

  useEffect(() => {
    async function loadOverview() {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        setWorkspace(null);
        setOwnerProfile(emptyOwnerProfile);
        setPreferences(emptyPreferencesDraft);
        setListings([]);
        setPlanCode("free");
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
        setPlanCode("free");
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
              : "Membre du workspace",
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
        .select(
          `id,
           workspace_id,
           created_at,
           audits (
             overall_score,
             created_at,
             result_payload
           )`
        )
        .eq("workspace_id", resolvedWorkspace.id)
        .is("deleted_at", null)
        .order("created_at", { ascending: false });

      if (error) {
        console.error("Failed to load listings for dashboard", error);
        setListings([]);
      } else if (Array.isArray(data)) {
        setListings(data as DashboardListingRow[]);
      }

      try {
        const plan = await getWorkspacePlan(resolvedWorkspace.id, supabase);
        setPlanCode(plan.planCode);

        const credits = await getWorkspaceAuditCredits(resolvedWorkspace.id, supabase);
        setAvailableAuditCredits(credits.available);
        console.info("[dashboard][workspace_plan] resolved", {
          workspaceId: resolvedWorkspace.id,
          planCode: plan.planCode,
          status: plan.status,
        });
        console.info("[dashboard][audit_credits] balance", {
          workspaceId: resolvedWorkspace.id,
          granted: credits.granted,
          consumed: credits.consumed,
          available: credits.available,
        });

        if (plan.planCode === "free") {
          const { count, error: countError } = await supabase
            .from("audits")
            .select("id", { count: "exact", head: true })
            .eq("workspace_id", resolvedWorkspace.id);

          if (countError) {
            console.warn("Failed to load audit count on dashboard", countError);
            setQuotaUsed(null);
            setQuotaLimit(1);
            return;
          }

          setQuotaUsed(count ?? 0);
          setQuotaLimit(1);
        } else {
          setQuotaUsed(null);
          setQuotaLimit(null);
        }
      } catch (planError) {
        console.warn("Failed to load workspace plan on dashboard", planError);
        setPlanCode(null);
        setQuotaUsed(null);
        setQuotaLimit(null);
      }
    }

    void loadOverview();
  }, []);

  const copy = getOverviewCopy(locale);

  const totalAudits = listings.filter(
    (listing) => Array.isArray(listing.audits) && listing.audits.length > 0
  ).length;

  const totalAuditRuns = listings.reduce(
    (sum, listing) => sum + (Array.isArray(listing.audits) ? listing.audits.length : 0),
    0
  );

  const avgScoreNumeric: number | null = (() => {
    if (listings.length === 0 || totalAudits === 0) return null;
    const sum = listings.reduce((acc, listing) => {
      const latestAudit = Array.isArray(listing.audits)
        ? [...listing.audits].sort(
            (a, b) =>
              new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
          )[0]
        : undefined;
      return acc + Number(latestAudit?.overall_score ?? 0);
    }, 0);
    return sum / listings.length;
  })();

  const quickInsights = buildQuickInsightCards(
    copy,
    listings.length,
    totalAudits,
    totalAuditRuns,
    avgScoreNumeric,
    availableAuditCredits
  );

  const nextActionResolved = resolveNextAction(
    copy,
    listings.length,
    availableAuditCredits,
    totalAudits,
    avgScoreNumeric
  );

  const averageScore = listings.length
    ? (
        listings.reduce((sum, listing) => {
          const latestAudit = Array.isArray(listing.audits)
            ? [...listing.audits].sort(
                (a, b) =>
                  new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
              )[0]
            : undefined;

          return sum + Number(latestAudit?.overall_score ?? 0);
        }, 0) / listings.length
      ).toFixed(1)
    : "–";

  const bestScore =
    listings.length > 0
      ? Math.max(
          ...listings.map((listing) => {
            const latestAudit = Array.isArray(listing.audits)
              ? [...listing.audits].sort(
                  (a, b) =>
                    new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
                )[0]
              : undefined;

            return Number(latestAudit?.overall_score ?? 0);
          })
        ).toFixed(1)
      : "–";

  const scoreValueClass =
    "text-4xl font-bold tracking-tight text-slate-900 md:text-[2.6rem]";
  const scoreSuffixClass = "ml-1 text-base font-medium text-slate-400 md:text-lg";
  const oneWeekAgo = referenceNow - 7 * 24 * 60 * 60 * 1000;

  const recentAudits = listings.flatMap((listing) =>
    Array.isArray(listing.audits)
      ? listing.audits.filter(
          (audit) => new Date(audit.created_at).getTime() >= oneWeekAgo
        )
      : []
  );

  const newListingsThisWeek = listings.filter((listing) =>
    listing.created_at ? new Date(listing.created_at).getTime() >= oneWeekAgo : false
  ).length;

  const scoreDelta = listings.reduce((sum, listing) => {
    if (!Array.isArray(listing.audits) || listing.audits.length < 2) {
      return sum;
    }

    const sorted = [...listing.audits].sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );

    return sum + (Number(sorted[0]?.overall_score ?? 0) - Number(sorted[1]?.overall_score ?? 0));
  }, 0);

  const formattedScoreDelta =
    scoreDelta === 0 ? "0.0" : `${scoreDelta > 0 ? "+" : ""}${scoreDelta.toFixed(1)}`;

  const showScoreTrend =
    Number.isFinite(scoreDelta) && Math.abs(scoreDelta) > Number.EPSILON;

  const portfolioLevelLabel = (() => {
    if (avgScoreNumeric === null) return copy.portfolioLevelPending;
    if (avgScoreNumeric < 6) return copy.portfolioLevelLow;
    if (avgScoreNumeric < 7.5) return copy.portfolioLevelMid;
    return copy.portfolioLevelHigh;
  })();

  const workspaceDisplayName =
    ownerProfile.conciergeName || workspace?.name || copy.fallbackWorkspaceName;
  const workspaceBio = ownerProfile.bio || copy.headerDescription;
  const workspaceOwnerName =
    `${ownerProfile.firstName} ${ownerProfile.lastName}`.trim() || copy.notProvided;
  const workspaceInitials = (workspaceDisplayName || "WS")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join("");

  const hasFreePlanWithQuota =
    planCode === "free" && quotaLimit !== null && quotaUsed !== null;

  /** Pastille « plan » uniquement (crédits sur puce orange séparée). */
  let portfolioPlanChipText: string;

  if (hasFreePlanWithQuota) {
    portfolioPlanChipText = `${copy.freePlan} • ${quotaUsed}/${quotaLimit} ` +
      (quotaLimit! > 1 ? copy.auditsUsedPlural : copy.auditsUsedSingular);
  } else if (planCode === "pro") {
    portfolioPlanChipText = copy.planChipProActive;
  } else if (planCode === "scale") {
    portfolioPlanChipText = copy.planChipScaleActive;
  } else if (planCode && planCode !== "free") {
    portfolioPlanChipText = copy.planChipPaidActive;
  } else if (planCode === null) {
    portfolioPlanChipText = copy.planBadgePending;
  } else {
    portfolioPlanChipText = copy.planChipFreeActive;
  }

  return (
    <div className="space-y-7 md:space-y-8 text-sm">
      <div className="relative overflow-hidden rounded-[32px] nk-border nk-card-lg nk-page-header-card bg-[radial-gradient(circle_at_0_0,rgba(251,146,60,0.10),transparent_60%),radial-gradient(circle_at_100%_100%,rgba(16,185,129,0.10),transparent_55%),linear-gradient(180deg,rgba(255,255,255,0.99)_0%,rgba(248,250,252,0.98)_100%)] px-5 py-6 md:flex md:items-center md:justify-between md:gap-10 md:px-8 xl:px-10 xl:py-9 backdrop-blur-[4px] transition-all duration-200 ease-out hover:-translate-y-0.5 hover:shadow-[0_22px_60px_rgba(15,23,42,0.16)]">
        <div className="max-w-3xl space-y-2.5">
          <p className="nk-kicker-muted">{copy.kicker}</p>
          <h1 className="nk-page-title nk-page-title-dashboard">
            {copy.headingPrefix} {workspaceDisplayName}
          </h1>
          <p className="nk-page-subtitle nk-page-subtitle-dashboard nk-body-muted text-[15px] leading-7 text-slate-600">
            {workspaceBio}
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
        </div>

        <div className="mt-5 text-left md:mt-0 md:text-right">
          {isPro ? (
            <>
              <Link
                href="/dashboard/listings/new"
                className="nk-primary-btn px-6 py-3 text-base font-semibold uppercase tracking-[0.18em] shadow-[0_18px_40px_rgba(15,23,42,0.24)] transition-all duration-200 hover:scale-[1.02] hover:brightness-105 hover:shadow-[0_22px_48px_rgba(15,23,42,0.28)]"
              >
                {copy.launchAudit}
              </Link>
              <p className="mt-2 text-xs leading-5 text-slate-500">{copy.proMessage}</p>
              <p className="mt-1 text-xs leading-5 text-slate-500">
                <Link
                  href="/dashboard/billing"
                  className="font-semibold underline underline-offset-2"
                >
                  {copy.manageSubscription}
                </Link>
              </p>
            </>
          ) : (
            <>
              <Link
                href="/dashboard/billing"
                className="nk-primary-btn px-6 py-3 text-base font-semibold uppercase tracking-[0.18em] shadow-[0_18px_40px_rgba(15,23,42,0.24)] transition-all duration-200 hover:scale-[1.02] hover:brightness-105 hover:shadow-[0_22px_48px_rgba(15,23,42,0.28)]"
              >
                {copy.obtainCredits}
              </Link>
              <p className="mt-2 text-xs leading-5 text-slate-500">{copy.freeMessage}</p>
            </>
          )}

          <div className="nk-card-accent nk-card-accent-blue mt-4 rounded-2xl border border-slate-200/85 bg-white/95 px-4 py-3 text-left shadow-[0_10px_24px_rgba(15,23,42,0.07),0_1px_0_rgba(255,255,255,0.62)_inset]">
            <p className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-blue-700">
              {copy.activity}
            </p>
            <div className="mt-3 space-y-2 text-[13px] text-slate-700">
              <p>
                <span className="font-semibold text-slate-900">+{recentAudits.length}</span>{" "}
                {copy.auditsThisWeek}
              </p>
              {showScoreTrend ? (
                <p>
                  {copy.scoreChange}{" "}
                  <span className="font-semibold text-emerald-600">{formattedScoreDelta}</span>
                </p>
              ) : null}
              <p>
                <span className="font-semibold text-slate-900">{newListingsThisWeek}</span>{" "}
                {copy.listingsAdded}
              </p>
            </div>
          </div>

          <div className="nk-card-accent nk-card-accent-emerald mt-4 rounded-[22px] border border-emerald-200/85 bg-emerald-50/90 px-4 py-4 shadow-[0_10px_22px_rgba(5,150,105,0.12),0_1px_0_rgba(255,255,255,0.62)_inset]">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-emerald-700">
              {copy.portfolioLevelKicker}
            </p>
            <p className="mt-2 text-lg font-semibold leading-snug tracking-tight text-slate-900 md:text-xl">
              {portfolioLevelLabel}
            </p>
          </div>
        </div>
      </div>

      <div className="mt-8 grid nk-grid-gap md:grid-cols-4">
        <div className="nk-card-accent nk-card-accent-blue nk-card-hover rounded-2xl border border-slate-200/85 bg-white/95 p-5 shadow-[0_12px_30px_rgba(15,23,42,0.08),0_1px_0_rgba(255,255,255,0.62)_inset] transition-all duration-200 ease-out hover:-translate-y-0.5 hover:border-slate-300/90 hover:shadow-[0_18px_42px_rgba(15,23,42,0.12),0_1px_0_rgba(255,255,255,0.68)_inset]">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-blue-700">
            {copy.trackedListings}
          </p>
          <p className={`${scoreValueClass} mt-3`}>{listings.length}</p>
          <p className="mt-2 text-sm leading-6 text-slate-600">{copy.trackedListingsText}</p>
        </div>

        <div className="nk-card-accent nk-card-accent-blue nk-card-hover rounded-2xl border border-slate-200/85 bg-white/95 p-5 shadow-[0_12px_30px_rgba(15,23,42,0.08),0_1px_0_rgba(255,255,255,0.62)_inset] transition-all duration-200 ease-out hover:-translate-y-0.5 hover:border-slate-300/90 hover:shadow-[0_18px_42px_rgba(15,23,42,0.12),0_1px_0_rgba(255,255,255,0.68)_inset]">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-blue-700">
            {copy.auditedListings}
          </p>
          <p className={`${scoreValueClass} mt-3`}>{totalAudits}</p>
          <p className="mt-2 text-sm leading-6 text-slate-600">{copy.auditedListingsText}</p>
        </div>

        <div className="nk-card-accent nk-card-hover rounded-2xl border border-amber-200/85 bg-[linear-gradient(180deg,rgba(255,255,255,0.98)_0%,rgba(255,251,235,0.95)_100%)] p-5 shadow-[0_12px_30px_rgba(180,83,9,0.1),0_1px_0_rgba(255,255,255,0.62)_inset] transition-all duration-200 ease-out hover:-translate-y-0.5 hover:border-amber-300/90 hover:shadow-[0_18px_42px_rgba(180,83,9,0.15),0_1px_0_rgba(255,255,255,0.68)_inset]">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-amber-700">
            {copy.averageScore}
          </p>
          <p className={`${scoreValueClass} mt-3 text-amber-600`}>
            {averageScore}
            {averageScore !== "–" && <span className={scoreSuffixClass}>/10</span>}
          </p>
          <p className="mt-2 text-sm leading-6 text-slate-600">{copy.averageScoreText}</p>
        </div>

        <div className="nk-card-accent nk-card-accent-emerald nk-card-hover rounded-2xl border border-emerald-200/85 bg-emerald-50/90 p-5 shadow-[0_12px_30px_rgba(5,150,105,0.11),0_1px_0_rgba(255,255,255,0.64)_inset] transition-all duration-200 ease-out hover:-translate-y-0.5 hover:border-emerald-300/90 hover:shadow-[0_18px_42px_rgba(5,150,105,0.16),0_1px_0_rgba(255,255,255,0.7)_inset]">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-emerald-700">
            {copy.bestScore}
          </p>
          <p className={`${scoreValueClass} mt-3 text-emerald-600`}>
            {bestScore}
            {bestScore !== "–" && <span className={scoreSuffixClass}>/10</span>}
          </p>
          <p className="mt-2 text-sm leading-6 text-slate-600">{copy.bestScoreText}</p>
        </div>
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-[minmax(0,1.4fr)_380px]">
        <div className="nk-card-accent nk-card-accent-blue relative overflow-hidden rounded-[32px] nk-border nk-card-lg bg-[linear-gradient(180deg,rgba(255,255,255,0.99)_0%,rgba(248,250,252,0.98)_100%)] p-5 md:p-6 shadow-[0_16px_38px_rgba(15,23,42,0.1),0_1px_0_rgba(255,255,255,0.66)_inset]">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-blue-700">{copy.quickSummary}</p>
              <h2 className="mt-2 text-base font-semibold text-slate-900">
                {copy.currentSituation}
              </h2>
            </div>
          </div>

          <div className="mt-5 grid nk-grid-gap md:grid-cols-3">
            {quickInsights.map((insight, insightIndex) => (
              <div
                key={`quick-insight-${insightIndex}`}
                className={`relative overflow-hidden rounded-2xl border border-slate-200/85 p-4 pl-[1.05rem] shadow-[0_10px_24px_rgba(15,23,42,0.05),0_1px_0_rgba(255,255,255,0.62)_inset] transition-all duration-200 ease-out hover:-translate-y-0.5 hover:border-slate-300/90 hover:shadow-[0_16px_34px_rgba(15,23,42,0.1),0_1px_0_rgba(255,255,255,0.68)_inset] ${QUICK_INSIGHT_ACCENT_CLASS[insightIndex]}`}
              >
                <p className="text-[11px] font-semibold text-slate-900">{insight.title}</p>
                {insightIndex !== 0 ? (
                  <p className="mt-2 text-xs leading-6 text-slate-700">{insight.text}</p>
                ) : null}
                {insightIndex === 0 ? (
                  <div className="mt-3 flex flex-wrap gap-2 text-[11px] font-medium">
                    <span className="inline-flex max-w-full items-center gap-1 rounded-full bg-slate-900 px-2.5 py-1 text-slate-50 shadow-[0_2px_8px_rgba(15,23,42,0.12)]">
                      <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-400" />
                      <span className="truncate">{portfolioPlanChipText}</span>
                    </span>
                    {availableAuditCredits > 0 ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-orange-100 px-2.5 py-1 font-semibold text-orange-950 ring-1 ring-orange-300/60 shadow-[0_1px_4px_rgba(234,88,12,0.12)]">
                        <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-orange-500" />
                        {copy.auditCreditsChip.replace(
                          "{count}",
                          String(availableAuditCredits)
                        )}
                      </span>
                    ) : null}
                    <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-1 text-slate-800 ring-1 ring-slate-200/80">
                      <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-slate-400" />
                      {listings.length}{" "}
                      {listings.length === 1 ? copy.trackedSingular : copy.trackedPlural}
                    </span>
                    <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-1 text-slate-800 ring-1 ring-slate-200/80">
                      <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-slate-400" />
                      {totalAudits}{" "}
                      {totalAudits === 1
                        ? copy.portfolioAuditedChipSingular
                        : copy.portfolioAuditedChipPlural}
                    </span>
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        </div>

        <div className="nk-card-accent nk-card-accent-purple relative overflow-hidden rounded-[32px] nk-border nk-card-lg bg-[linear-gradient(180deg,rgba(255,255,255,0.99)_0%,rgba(248,250,252,0.98)_100%)] p-5 md:p-6 shadow-[0_16px_38px_rgba(15,23,42,0.1),0_1px_0_rgba(255,255,255,0.66)_inset]">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-purple-700">
            {copy.nextAction}
          </p>
          <h2 className="mt-2 text-base font-semibold leading-snug text-slate-900">
            {nextActionResolved.message}
          </h2>

          <div className="mt-5">
            <Link
              href={nextActionResolved.href}
              className="nk-primary-btn w-full justify-center text-xs font-semibold uppercase tracking-[0.18em] sm:w-auto"
            >
              {nextActionResolved.ctaLabel}
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

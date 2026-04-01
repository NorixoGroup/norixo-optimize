"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AuditLaunchOverlay } from "@/components/AuditLaunchOverlay";
import { OnboardingDiscoveryIntro } from "@/components/marketing/OnboardingDiscoveryIntro";
import { runAuditForListing } from "@/components/RunAuditForListingButton";
import { HowItWorksSections } from "@/components/marketing/HowItWorksSections";
import { normalizeSourceUrl } from "@/lib/listings/normalizeSourceUrl";
import { supabase } from "@/lib/supabase";
import {
  canAccessOnboardingInDev,
  hasCompletedOnboarding,
} from "@/lib/onboarding";
import { getOrCreateWorkspaceForUser } from "@/lib/workspaces/ensureWorkspaceForUser";
import { MarketingPageShell } from "@/components/marketing/MarketingPageShell";

type Step = 1 | 2 | 3;

const HOW_IT_WORKS = [
  "Choisissez le logement que vous voulez mieux faire performer.",
  "LCO lit les signaux visibles de l’annonce et les compare au marche local.",
  "Vous obtenez une lecture structuree et des priorites claires.",
];

const USEFUL_OUTCOMES = [
  "Comprendre rapidement ce qui freine la conversion d’une annonce.",
  "Identifier les 2 ou 3 leviers les plus importants a traiter.",
  "Positionner l’annonce par rapport a des logements comparables.",
];

const OFFER_CARDS = [
  {
    name: "Audit test",
    price: "9 €",
    badge: "Premier pas",
    description: "Pour mesurer la valeur du rapport sur une annonce precise, sans abonnement.",
    detail: "1 audit ponctuel",
    note: "Paiement unique • Ideal pour valider la methode",
    cta: "Debloquer 1 audit test",
  },
  {
    name: "Pack 5 audits",
    price: "39 €",
    badge: "Recommande",
    description: "Pour comparer plusieurs annonces et structurer vos optimisations sur un petit portefeuille.",
    detail: "5 audits, soit 7,80 € / audit",
    note: "Format le plus utilise par les hotes et conciergeries qui pilotent quelques biens.",
    highlighted: true,
    cta: "Choisir le pack 5 audits",
  },
  {
    name: "Pack 15 audits",
    price: "99 €",
    badge: "Meilleure rentabilite",
    description: "Pense pour les conciergeries, portefeuilles multi-logements et usages reguliers.",
    detail: "15 audits, soit 6,60 € / audit",
    note: "Ideal pour les usages reguliers • Option annuelle : -10 %",
    cta: "Voir l'offre 15 audits",
  },
] as const;

const VALUE_STRIP = [
  {
    label: "Etape 1",
    value: "Choisir le logement",
  },
  {
    label: "Etape 2",
    value: "Lancer l’analyse",
  },
  {
    label: "Etape 3",
    value: "Explorer le rapport",
  },
] as const;

function StepPill({
  active,
  label,
  onClick,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      className={`inline-flex min-w-0 items-center justify-center cursor-pointer rounded-full border px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.16em] transition duration-150 ${
        active
          ? "border-orange-300 bg-[linear-gradient(135deg,#f97316,#fb923c)] text-white shadow-[0_12px_24px_rgba(249,115,22,0.24)]"
          : "border-slate-200 bg-white/80 text-slate-500 hover:border-slate-300 hover:bg-slate-50 hover:text-slate-700"
      }`}
      onClick={onClick}
    >
      {label}
    </button>
  );
}

function OfferSummaryRow({
  name,
  price,
  badge,
  description,
  detail,
  note,
  cta,
  highlighted,
  onSelect,
}: ((typeof OFFER_CARDS)[number] & {
  highlighted?: boolean;
  onSelect: () => void;
})) {
  return (
    <div
      className={`rounded-[22px] border px-4 py-4 transition duration-150 ${
        highlighted
          ? "border-orange-300 bg-[linear-gradient(180deg,rgba(255,247,237,1)_0%,rgba(255,255,255,0.96)_100%)] shadow-[0_16px_36px_rgba(249,115,22,0.14)]"
          : "border-slate-200 bg-white hover:border-slate-300 hover:shadow-sm"
      }`}
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-semibold text-slate-900">{name}</p>
          <p className="mt-1 text-[12px] leading-5 text-slate-600">{detail}</p>
          <p className="mt-2 text-[12px] leading-5 text-slate-600">{description}</p>
          {highlighted ? (
            <p className="mt-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-orange-700">
              Choisi par la majorite des utilisateurs pour progresser rapidement
            </p>
          ) : null}
        </div>
        <div className="text-right">
          <p className="text-xl font-semibold tracking-tight text-slate-950">{price}</p>
          <span
            className={`mt-1 inline-flex rounded-full px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] ${
              highlighted ? "bg-orange-500 text-white" : "bg-slate-100 text-slate-600"
            }`}
          >
            {badge}
          </span>
        </div>
      </div>
      <p className="mt-2 text-[12px] leading-5 text-slate-700">{note}</p>
      <button
        type="button"
        onClick={onSelect}
        className={`mt-3 inline-flex w-full items-center justify-center rounded-xl px-3 py-2.5 text-sm font-semibold transition duration-150 ${
          highlighted
            ? "bg-[linear-gradient(135deg,#f97316,#fb923c)] text-white shadow-[0_14px_28px_rgba(249,115,22,0.22)] hover:brightness-[0.98]"
            : "border border-slate-200 bg-slate-50 text-slate-700 hover:border-slate-300 hover:bg-white"
        }`}
      >
        {cta}
      </button>
    </div>
  );
}

function SectionTitle({
  kicker,
  title,
  copy,
}: {
  kicker: string;
  title: string;
  copy?: string;
}) {
  return (
    <div className="space-y-2.5">
      <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">
        {kicker}
      </p>
      <h2 className="max-w-3xl text-xl font-semibold tracking-tight text-slate-950 sm:text-[1.75rem]">
        {title}
      </h2>
      {copy ? <p className="max-w-3xl text-sm leading-6 text-slate-600 sm:text-[15px]">{copy}</p> : null}
    </div>
  );
}

function getPreviewSnapshot(propertyName: string) {
  const hasSpecificName = propertyName.trim().length > 0;

  return {
    score: 7.8,
    status: hasSpecificName ? "Potentiel visible" : "Premiere lecture",
    insight:
      "Les visuels et la promesse ne donnent pas encore toute leur force a l'annonce.",
    recommendation:
      "Commencez par renforcer la galerie et clarifier le benefice principal dans le titre.",
  };
}

const LOADING_STEPS = [
  "Extraction du logement...",
  "Recherche des concurrents comparables...",
  "Analyse IA de l’annonce...",
  "Préparation du rapport final...",
];

export default function OnboardingPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [saving, setSaving] = useState(false);
  const [step, setStep] = useState<Step>(1);
  const [propertyName, setPropertyName] = useState("");
  const [city] = useState("");
  const [link, setLink] = useState("");
  const [listingId, setListingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [launchingAudit, setLaunchingAudit] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);
  const [progress, setProgress] = useState(8);
  const previewSnapshot = getPreviewSnapshot(propertyName);

  useEffect(() => {
    let mounted = true;

    async function loadUser() {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!mounted) return;

      setIsAuthenticated(Boolean(user));

      if (user && hasCompletedOnboarding(user) && !canAccessOnboardingInDev()) {
        setLoading(false);
        return;
      }

      setLoading(false);
    }

    loadUser();

    return () => {
      mounted = false;
    };
  }, [router]);

  useEffect(() => {
    if (!launchingAudit) {
      setStepIndex(0);
      setProgress(8);
      return;
    }

    const stepTimer = window.setInterval(() => {
      setStepIndex((prev) => Math.min(prev + 1, LOADING_STEPS.length - 1));
    }, 2200);

    const progressTimer = window.setInterval(() => {
      setProgress((prev) => {
        if (prev >= 92) return prev;
        return prev + 6;
      });
    }, 500);

    return () => {
      window.clearInterval(stepTimer);
      window.clearInterval(progressTimer);
    };
  }, [launchingAudit]);

  async function handleAddProperty(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    if (!propertyName.trim()) {
      setError("Veuillez renseigner le nom du logement.");
      return;
    }

    try {
      setSaving(true);
      const normalizedUrl = normalizeSourceUrl(link);

      if (!normalizedUrl) {
        setError("Ajoutez le lien de votre annonce pour lancer l’audit.");
        return;
      }

      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user) {
        const searchParams = new URLSearchParams({
          url: normalizedUrl,
          title: propertyName.trim(),
        });
        router.push(`/audit/new?${searchParams.toString()}`);
        return;
      }

      const workspace = await getOrCreateWorkspaceForUser({
        userId: user.id,
        email: user.email ?? null,
        client: supabase,
      });

      if (!workspace?.id) {
        throw new Error("Impossible d'initialiser votre workspace.");
      }

      let listingRow: { id: string } | null = null;

      if (normalizedUrl) {
        const { data: existingListings, error: existingListingsError } = await supabase
          .from("listings")
          .select("id, source_url")
          .eq("workspace_id", workspace.id);

        if (existingListingsError) {
          throw new Error(
            existingListingsError.message ||
              "Impossible de vérifier les annonces existantes."
          );
        }

        const existingListing = (existingListings ?? []).find(
          (listing) => normalizeSourceUrl(listing.source_url) === normalizedUrl
        );

        if (existingListing?.id) {
          listingRow = { id: existingListing.id as string };
        }
      }

      if (!listingRow) {
        const { data: createdListing, error: listingError } = await supabase
          .from("listings")
          .insert({
            workspace_id: workspace.id,
            created_by: user.id,
            source_platform: "other",
            source_url: link.trim() || null,
            title: propertyName.trim(),
            city: city.trim() || null,
          })
          .select("id")
          .single();

        if (listingError || !createdListing?.id) {
          throw new Error(listingError?.message || "Impossible de créer votre annonce.");
        }

        listingRow = { id: createdListing.id as string };
      }

      setListingId(listingRow.id);
      setStep(3);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Impossible de créer votre annonce."
      );
    } finally {
      setSaving(false);
    }
  }

  async function completeOnboarding() {
    try {
      setSaving(true);
      setError(null);

      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.replace("/sign-in");
        return;
      }

      const { error: updateError } = await supabase.auth.updateUser({
        data: {
          ...user.user_metadata,
          onboarding_completed: true,
          onboarding_property_name: propertyName.trim() || null,
          onboarding_city: city.trim() || null,
          onboarding_link: link.trim() || null,
        },
      });

      if (updateError) {
        throw updateError;
      }

      return true;
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Impossible de finaliser l’onboarding."
      );
      return false;
    } finally {
      setSaving(false);
    }
  }

  async function handleFinish() {
    if (!listingId) {
      setError("Annonce introuvable. Veuillez revenir à l’étape précédente.");
      return;
    }

    setError(null);
    setLaunchingAudit(true);
    setProgress(10);

    try {
      const { data: currentListing, error: currentListingError } = await supabase
        .from("listings")
        .select("id, source_url")
        .eq("id", listingId)
        .maybeSingle();

      if (currentListingError) {
        throw new Error(
          currentListingError.message || "Impossible de vérifier votre annonce."
        );
      }

      if (!currentListing?.id) {
        setError("Annonce introuvable. Veuillez revenir à l’étape précédente.");
        return;
      }

      if (!currentListing.source_url) {
        setError(
          "Ajoutez le lien de votre annonce pour pouvoir lancer l’audit."
        );
        return;
      }

      const auditResult = await runAuditForListing(listingId);

      if (!auditResult.success) {
        setError(auditResult.message);
        return;
      }

      if (!auditResult.auditId) {
        setError("L’audit a été lancé, mais son identifiant est introuvable.");
        return;
      }

      const completed = await completeOnboarding();

      if (!completed) {
        return;
      }

      router.push(`/dashboard/audits/${auditResult.auditId}`);
      router.refresh();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Impossible de lancer l’audit."
      );
    } finally {
      setLaunchingAudit(false);
    }
  }

  async function handleSkip() {
    const completed = await completeOnboarding();

    if (!completed) {
      return;
    }

    router.push("/dashboard");
    router.refresh();
  }

  if (loading) {
    return (
      <MarketingPageShell>
        <main className="relative flex min-h-screen items-center justify-center px-4">
          <div className="nk-dashboard-bg" />
          <div className="relative z-10 rounded-3xl border border-slate-200/70 bg-white/95 px-6 py-5 text-sm text-slate-700 shadow-[0_24px_80px_rgba(15,23,42,0.18)]">
            Chargement...
          </div>
        </main>
      </MarketingPageShell>
    );
  }

  return (
    <MarketingPageShell>
      <main className="relative flex min-h-screen items-start justify-center px-4 py-7 lg:px-6 lg:py-10">
        <div className="nk-dashboard-bg" />
      {launchingAudit && (
        <div className="absolute inset-0 z-20 flex items-center justify-center px-4 py-10">
          <div className="w-full max-w-2xl">
            <AuditLaunchOverlay
              currentStep={LOADING_STEPS[stepIndex] ?? LOADING_STEPS[0]}
              progress={progress}
              steps={LOADING_STEPS}
              stepIndex={stepIndex}
            />
          </div>
        </div>
      )}

      <div className="relative z-10 w-full max-w-[1480px]">
        <div className="grid gap-6 lg:grid-cols-[minmax(0,2.05fr)_340px] xl:gap-7">
          <div className="space-y-5 lg:space-y-6">
            <div className="rounded-[28px] border border-slate-200/80 bg-[linear-gradient(180deg,rgba(255,255,255,0.98)_0%,rgba(248,250,252,0.94)_100%)] px-6 py-4 shadow-[0_20px_48px_rgba(15,23,42,0.08)]">
              <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
                <div className="space-y-1.5">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">
                    Parcours d’onboarding
                  </p>
                  <p className="text-sm leading-6 text-slate-600">
                    Trois etapes pour voir comment un audit LCO vous aide a comprendre une annonce,
                    prioriser les corrections et choisir la formule adaptee a votre rythme.
                  </p>
                </div>
                <div className="grid grid-cols-3 gap-2 sm:inline-grid sm:min-w-[360px]">
                  <StepPill active={step === 1} label="Decouverte" onClick={() => setStep(1)} />
                  <StepPill active={step === 2} label="Annonce" onClick={() => setStep(2)} />
                  <StepPill active={step === 3} label="Activation" onClick={() => setStep(3)} />
                </div>
              </div>
            </div>

            <div className="space-y-6 bg-transparent transition-all duration-200">
              <section className="rounded-2xl border border-slate-200/80 bg-white/90 p-6 shadow-sm">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                    Progression
                  </p>
                  <p className="text-xs font-medium text-slate-500">3 etapes pour obtenir un premier audit exploitable</p>
                </div>
                <div className="grid items-stretch gap-6 sm:grid-cols-3">
                {VALUE_STRIP.map((item) => (
                  <div
                    key={item.label}
                    className="flex h-full flex-col rounded-2xl border border-slate-200/80 bg-white/90 p-6 shadow-sm"
                  >
                    <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                      {item.label}
                    </p>
                    <p className="mt-1 text-sm font-semibold text-slate-900">{item.value}</p>
                  </div>
                ))}
                </div>
              </section>

              <div className="space-y-6">

              {step === 1 && (
                <>
                  <OnboardingDiscoveryIntro onStartAudit={() => setStep(2)} />
                  <HowItWorksSections
                    primaryActionLabel="Passer a l'etape Annonce"
                    onPrimaryAction={() => setStep(2)}
                  />
                </>
              )}

              {step === 2 && (
                <>
                  <section className="relative overflow-hidden grid gap-6 rounded-2xl border border-slate-200/80 bg-[linear-gradient(135deg,rgba(255,255,255,0.99),rgba(255,247,237,0.58))] p-6 shadow-sm lg:grid-cols-[minmax(0,1.25fr)_320px]">
                    <div className="space-y-4">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">
                        Etape 2 sur 3
                      </p>
                      <div className="flex flex-wrap gap-2">
                        <span className="rounded-full border border-orange-200 bg-orange-50 px-3 py-1 text-[11px] font-medium text-orange-700">
                          Premiere analyse rapide
                        </span>
                        <span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-[11px] font-medium text-slate-600">
                          Nom du logement + lien de l&apos;annonce
                        </span>
                      </div>
                      <h1 className="max-w-3xl text-3xl font-semibold tracking-tight text-slate-950 sm:text-[2.6rem]">
                        Ajoutez votre annonce et passez rapidement a un premier audit utile.
                      </h1>
                      <p className="max-w-3xl text-sm leading-6 text-slate-600 sm:text-[15px]">
                        Un nom de logement et un lien de l&apos;annonce suffisent pour lancer un premier audit utile.
                        Vous obtenez ensuite un rapport clair, des priorites d&apos;optimisation et un
                        point de comparaison local.
                      </p>
                    </div>
                    <div className="rounded-2xl border border-orange-200/80 bg-white/95 p-6 shadow-sm">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-orange-700">
                        A retenir
                      </p>
                      <p className="mt-3 text-2xl font-semibold tracking-tight text-slate-950">
                        Moins d&apos;une minute
                      </p>
                      <div className="mt-4 space-y-2 text-sm leading-6 text-slate-700">
                        <p>• Un nom</p>
                        <p>• Lien de l&apos;annonce</p>
                        <p className="pt-1 text-xs leading-5 text-slate-600">
                          Le lien permet une analyse plus precise et un benchmark fiable.
                        </p>
                      </div>
                    </div>
                  </section>

                  <section className="grid items-stretch gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
                    <div className="flex h-full flex-col rounded-2xl border border-orange-200 bg-[linear-gradient(180deg,rgba(255,247,237,1)_0%,rgba(255,255,255,0.96)_100%)] p-6 shadow-sm transition-all duration-150 hover:border-orange-300 hover:shadow-md">
                      <SectionTitle
                        kicker="Ce que vous allez voir"
                        title="Le premier audit vous donne une lecture immediate du niveau de l'annonce"
                        copy="Avant meme d&apos;optimiser la fiche, vous voyez ce qui semble faible, ce qui rassure deja et ce qu&apos;il faut traiter en premier."
                      />
                      <div className="mt-4 space-y-2 text-sm leading-6 text-slate-700">
                        <p>• Un score global pour situer rapidement le niveau de l&apos;annonce.</p>
                        <p>• Des points forts et points faibles identifies sans ambiguite.</p>
                        <p>• Un benchmark local pour replacer l&apos;annonce dans son marche visible.</p>
                      </div>
                    </div>
                    <div className="flex h-full flex-col rounded-2xl border border-slate-200/80 bg-white/90 p-6 shadow-sm transition-all duration-150 hover:border-slate-300 hover:shadow-md">
                      <SectionTitle
                        kicker="Ce qu'il faut preparer"
                        title="Le strict minimum pour commencer"
                        copy="Vous pouvez commencer avec le nom du logement et le lien de l&apos;annonce."
                      />
                      <div className="mt-4 space-y-2 text-sm leading-6 text-slate-700">
                        <p>• Nom de l&apos;annonce ou du logement</p>
                        <p>• Lien de l&apos;annonce (Airbnb, Booking, Agoda, Abritel ou autre)</p>
                      </div>
                    </div>
                  </section>

                  <section className="flex flex-col gap-6">
                    <div className="relative overflow-hidden rounded-2xl border border-slate-200/80 bg-white/90 p-6 shadow-sm transition-all duration-150 hover:border-slate-300 hover:shadow-md">
                      <SectionTitle
                        kicker="Ce que vous allez decouvrir"
                        title="Ce que vous allez decouvrir sur votre annonce"
                        copy="En quelques secondes, identifiez les points qui limitent vos reservations et decouvrez quoi ameliorer en priorite."
                      />
                      <div className="mt-4 space-y-2 text-sm leading-6 text-slate-700">
                        <p>• Vos points faibles les plus visibles</p>
                        <p>• Votre position face aux annonces similaires</p>
                        <p>• Ce qui freine vos performances</p>
                        <p>• Les actions prioritaires a corriger</p>
                      </div>
                      <p className="mt-4 text-xs leading-5 text-slate-500">
                        Base sur des annonces similaires visibles sur Airbnb, Booking, etc.
                      </p>
                    </div>
                    <div className="flex flex-col gap-6">
                      <div className="relative overflow-hidden rounded-2xl border border-slate-200/80 bg-white/90 p-6 shadow-sm transition-all duration-150 hover:border-slate-300 hover:shadow-md">
                        <SectionTitle
                          kicker="Benefices immediats"
                          title="Vous gagnez du temps des le premier audit"
                          copy="L&apos;outil evite les corrections au hasard et vous aide a prioriser les vrais leviers visibles."
                        />
                        <div className="mt-4 space-y-2 text-sm leading-6 text-slate-700">
                          {USEFUL_OUTCOMES.map((item) => (
                            <p key={item}>• {item}</p>
                          ))}
                        </div>
                      </div>
                      <div className="relative overflow-hidden rounded-2xl border border-slate-200/80 bg-white/90 p-6 shadow-sm transition-all duration-150 hover:border-slate-300 hover:bg-white hover:shadow-md">
                        <SectionTitle
                          kicker="Avant de lancer"
                          title="Une saisie volontairement simple"
                          copy="L&apos;objectif est de vous amener vite a un premier resultat utile, pas de vous faire remplir une longue configuration."
                        />
                      </div>
                    </div>
                  </section>
                </>
              )}

              {step === 3 && (
                <>
                  <section className="relative overflow-hidden grid gap-6 rounded-2xl border border-slate-200/80 bg-[linear-gradient(135deg,rgba(255,255,255,0.99),rgba(236,253,245,0.58))] p-6 shadow-sm lg:grid-cols-[minmax(0,1.25fr)_320px]">
                    <div className="space-y-4">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">
                        Etape 3 sur 3
                      </p>
                      <div className="flex flex-wrap gap-2">
                        <span className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-[11px] font-medium text-emerald-700">
                          Debloquer le rapport complet
                        </span>
                        <span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-[11px] font-medium text-slate-600">
                          Formats simples
                        </span>
                      </div>
                      <h1 className="max-w-3xl text-3xl font-semibold tracking-tight text-slate-950 sm:text-[2.6rem]">
                        Creez votre compte pour conserver vos audits et debloquer le rapport complet.
                      </h1>
                      <p className="max-w-3xl text-sm leading-6 text-slate-600 sm:text-[15px]">
                        Vous pouvez commencer simplement avec un audit test a 9 €, puis passer a un pack
                        si vous comparez plusieurs annonces ou si vous optimisez regulierement.
                      </p>
                    </div>
                    <div className="rounded-2xl border border-emerald-200/80 bg-white/95 p-6 shadow-sm">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-emerald-700">
                        Choix recommande
                      </p>
                      <p className="mt-3 text-2xl font-semibold tracking-tight text-slate-950">
                        Pack 5 audits
                      </p>
                      <div className="mt-4 space-y-2 text-sm leading-6 text-slate-700">
                        <p>• Le meilleur equilibre pour progresser vite</p>
                        <p>• Suffisant pour comparer et iterer</p>
                        <p>• Sans surdimensionner votre usage</p>
                      </div>
                    </div>
                  </section>

                  <section className="grid items-stretch gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
                    <div className="flex h-full flex-col rounded-2xl border border-slate-200/80 bg-white/90 p-6 shadow-sm transition-all duration-150 hover:border-slate-300 hover:shadow-md">
                      <SectionTitle
                        kicker="Pourquoi creer un compte"
                        title="Gardez vos analyses, vos comparaisons et vos optimisations au meme endroit"
                        copy="Le compte permet de retrouver vos rapports, suivre plusieurs annonces et relancer des audits sans repartir de zero."
                      />
                      <div className="mt-4 space-y-2 text-sm leading-6 text-slate-700">
                        <p>• Vous conservez l&apos;historique des audits et des recommandations.</p>
                        <p>• Vous pouvez comparer plusieurs annonces au meme endroit.</p>
                        <p>• Vous debloquez un usage plus simple si vous travaillez en portefeuille.</p>
                      </div>
                    </div>
                    <div className="flex h-full flex-col rounded-2xl border border-emerald-200 bg-[linear-gradient(180deg,rgba(236,253,245,1)_0%,rgba(255,255,255,0.96)_100%)] p-6 shadow-sm transition-all duration-150 hover:border-emerald-300 hover:shadow-md">
                      <SectionTitle
                        kicker="Formules"
                        title="Choisissez le format le plus coherent avec votre rythme"
                        copy="Test ponctuel, suivi de quelques annonces ou usage regulier : les trois formats couvrent les cas les plus courants sans complexite inutile."
                      />
                      <div className="mt-4 space-y-2 text-sm leading-6 text-emerald-900">
                        <p>• 1 audit a 9 € pour verifier rapidement la valeur du rapport.</p>
                        <p>• 5 audits a 39 € pour comparer plusieurs annonces ou suivre vos optimisations de facon rentable.</p>
                        <p>• 15 audits a 99 € pour les usages reguliers, avec -10 % en annuel.</p>
                      </div>
                    </div>
                  </section>

                  <section className="grid items-stretch gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(300px,0.92fr)]">
                    <div className="flex h-full flex-col rounded-2xl border border-slate-200/80 bg-white/90 p-6 shadow-sm transition-all duration-150 hover:border-slate-300 hover:bg-white hover:shadow-md">
                      <SectionTitle
                        kicker="Ce que vous debloquez"
                        title="Un usage plus simple, plus suivi et plus rentable"
                        copy="Le rapport complet n&apos;est pas seulement un score. C&apos;est un outil de decision pour savoir quoi corriger ensuite et pourquoi."
                      />
                      <div className="mt-4 space-y-2 text-sm leading-6 text-slate-700">
                        <p>• Des recommandations actionnables, pas seulement une note.</p>
                        <p>• Un benchmark local pour replacer votre annonce dans son contexte.</p>
                        <p>• Une base de travail utile si vous gerez plusieurs biens ou clients.</p>
                      </div>
                    </div>
                    <div className="flex h-full flex-col rounded-2xl border border-slate-200/80 bg-white/90 p-6 shadow-sm transition-all duration-150 hover:border-slate-300 hover:shadow-md">
                      <SectionTitle
                        kicker="Reassurance"
                        title="Une activation simple, sans engagement lourd"
                        copy="Vous pouvez commencer avec un premier audit ponctuel pour verifier immediatement la valeur de l&apos;outil, puis adapter le format si besoin."
                      />
                      <div className="mt-4 space-y-2 text-sm leading-6 text-slate-700">
                        <p>• Resultat en quelques secondes.</p>
                        <p>• Aucune configuration complexe avant le premier audit.</p>
                        <p>• Offre evolutive si vous avez ensuite besoin de plus de volume.</p>
                      </div>
                    </div>
                  </section>
                </>
              )}
              </div>

              <section className="relative overflow-hidden rounded-2xl border border-slate-200/80 bg-white/90 p-6 shadow-sm">
                {step === 1 && (
                  <div className="space-y-4">
                    <SectionTitle
                      kicker="Passer a l'action"
                      title="Passez rapidement d’une annonce brute a une lecture exploitable"
                      copy="Choisissez le logement que vous voulez mieux faire performer, puis laissez LCO vous montrer ce qui freine la conversion et dans quel ordre intervenir."
                    />
                    <div className="rounded-2xl border border-slate-200 bg-white px-4 py-4 text-sm leading-6 text-slate-700 transition duration-150 hover:border-slate-300">
                      <p>• Premiere lecture claire de votre annonce</p>
                      <p>• Aucun engagement pour tester la qualite du rapport</p>
                      <p>• Creation de compte pour conserver l’historique et les optimisations</p>
                    </div>
                    <div className="space-y-3">
                      <button
                        type="button"
                        onClick={() => setStep(2)}
                        className="flex w-full items-center justify-center rounded-2xl bg-[linear-gradient(135deg,#f97316,#fb923c)] px-5 py-4 text-sm font-semibold text-white shadow-[0_16px_32px_rgba(249,115,22,0.26)] transition duration-150 hover:brightness-[0.98] hover:shadow-[0_18px_36px_rgba(249,115,22,0.3)]"
                      >
                        Voir l&apos;etape annonce
                      </button>
                      <button
                        type="button"
                        onClick={isAuthenticated ? handleSkip : () => router.push("/sign-in")}
                        disabled={saving}
                        className="w-full text-sm font-medium text-slate-500 transition hover:text-slate-700 disabled:cursor-not-allowed disabled:opacity-70"
                      >
                        {isAuthenticated ? "Passer et acceder au dashboard" : "J'ai deja un compte"
                        }
                      </button>
                    </div>
                  </div>
                )}

                {step === 2 && (
                  <div className="space-y-4">
                    <SectionTitle
                      kicker="Votre annonce"
                      title="Ajoutez le logement que vous voulez analyser"
                      copy="Un nom et un lien public suffisent pour lancer l’analyse. LCO produit ensuite une premiere lecture structuree, avec niveau d’annonce, faiblesses visibles et positionnement dans le marche local."
                    />
                    <form onSubmit={handleAddProperty} className="space-y-4 text-sm">
                      <div className="rounded-[24px] border border-slate-200 bg-white px-4 py-4 shadow-sm transition duration-150 hover:border-slate-300">
                        <p className="text-sm font-semibold text-slate-900">Aucune annonce encore ajoutee</p>
                        <p className="mt-1 text-sm leading-6 text-slate-600">
                          Votre compte vous permettra ensuite de conserver vos audits, comparer plusieurs
                          annonces et suivre vos optimisations dans le temps, sur un ou plusieurs biens.
                        </p>
                        <p className="mt-2 text-xs font-medium uppercase tracking-[0.16em] text-slate-500">
                          Moins d&apos;une minute pour commencer
                        </p>
                      </div>

                      <div className="space-y-1.5">
                        <label
                          htmlFor="property-name"
                          className="block text-xs font-semibold uppercase tracking-[0.16em] text-slate-500"
                        >
                          Nom du logement
                        </label>
                        <input
                          id="property-name"
                          type="text"
                          value={propertyName}
                          onChange={(event) => setPropertyName(event.target.value)}
                          className="block w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none placeholder:text-slate-400 focus:border-orange-400"
                          placeholder="Ex : Appartement 2 chambres avec piscine a Gueliz"
                        />
                      </div>

                      <div className="space-y-1.5">
                        <label
                          htmlFor="property-link"
                          className="block text-xs font-semibold uppercase tracking-[0.16em] text-slate-500"
                        >
                          Lien de l&apos;annonce
                        </label>
                        <input
                          id="property-link"
                          type="url"
                          value={link}
                          onChange={(event) => setLink(event.target.value)}
                          className="block w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none placeholder:text-slate-400 focus:border-orange-400"
                          placeholder="Collez ici le lien de l&apos;annonce"
                        />
                      </div>

                      {error && (
                        <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                          {error}
                        </div>
                      )}

                      <div className="rounded-2xl border border-orange-100 bg-orange-50/70 px-4 py-3 text-sm leading-6 text-slate-700">
                        <p className="font-semibold text-slate-900">Ce que ce premier audit va vous montrer</p>
                        <p className="mt-1">
                          Un rapport complet avec benchmark local, points faibles visibles et
                          recommandations prioritaires pour savoir sur quoi concentrer vos efforts.
                        </p>
                      </div>

                      <button
                        type="submit"
                        disabled={saving}
                        className="flex w-full items-center justify-center rounded-2xl bg-[linear-gradient(135deg,#f97316,#fb923c)] px-5 py-4 text-sm font-semibold text-white shadow-[0_16px_32px_rgba(249,115,22,0.26)] transition duration-150 hover:brightness-[0.98] hover:shadow-[0_18px_36px_rgba(249,115,22,0.3)]"
                      >
                        {saving
                          ? "Creation de l'annonce..."
                          : "Analyser mon annonce"}
                      </button>
                      <p className="text-center text-xs font-medium text-slate-500">
                        Aucun engagement • Resultat en quelques secondes
                      </p>

                      <button
                        type="button"
                        onClick={isAuthenticated ? handleSkip : () => router.push("/sign-in")}
                        disabled={saving}
                        className="w-full text-sm font-medium text-slate-500 transition hover:text-slate-700 disabled:cursor-not-allowed disabled:opacity-70"
                      >
                        {isAuthenticated ? "Passer et acceder au dashboard" : "J'ai deja un compte"}
                      </button>
                    </form>
                  </div>
                )}

                {step === 3 && (
                  <div className="space-y-4">
                    <SectionTitle
                      kicker="Activation"
                      title="Vous avez deja une premiere lecture exploitable de l’annonce"
                      copy="L’aperçu montre comment l’annonce se positionne a premiere vue. Le rapport complet ajoute les comparables, l’analyse detaillee des faiblesses et un plan d’action structure, pour pouvoir arbitrer vos corrections."
                    />

                    <div className="rounded-[26px] border border-emerald-200 bg-[linear-gradient(180deg,rgba(236,253,245,1)_0%,rgba(255,255,255,0.98)_100%)] px-5 py-5 shadow-[0_18px_44px_rgba(16,185,129,0.10)] transition duration-150 hover:border-emerald-300">
                      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
                        <div>
                          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-emerald-700">
                            Apercu d&apos;audit
                          </p>
                          <p className="mt-2 text-lg font-semibold text-slate-950">
                            {propertyName.trim() || "Votre annonce"}
                          </p>
                          <p className="mt-1 text-sm text-emerald-900/80">
                            {previewSnapshot.status}
                          </p>
                        </div>
                        <div className="rounded-[22px] border border-emerald-200 bg-white px-5 py-4 text-right shadow-[0_14px_30px_rgba(16,185,129,0.12)]">
                          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-emerald-700">
                            Score estime
                          </p>
                          <p className="mt-1 text-5xl font-semibold tracking-tight text-emerald-700 sm:text-[3.5rem]">
                            {previewSnapshot.score.toFixed(1)}
                          </p>
                          <p className="mt-1 text-xs font-medium uppercase tracking-[0.14em] text-emerald-600">
                            Lecture immediate
                          </p>
                        </div>
                      </div>

                      <div className="mt-4 rounded-[22px] border border-emerald-100 bg-white px-4 py-4 text-sm leading-6 text-slate-700 shadow-sm">
                        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-emerald-700">
                          Insight visible
                        </p>
                        <p className="mt-2 text-[15px] leading-7 text-slate-800">{previewSnapshot.insight}</p>
                      </div>

                      <div className="mt-4 rounded-[22px] border border-orange-200 bg-[linear-gradient(180deg,rgba(255,247,237,1)_0%,rgba(255,255,255,0.92)_100%)] px-4 py-4 text-sm leading-6 text-slate-700 shadow-sm">
                        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-orange-700">
                          Recommandation prioritaire
                        </p>
                        <p className="mt-2 text-[15px] font-semibold leading-7 text-slate-900">
                          {previewSnapshot.recommendation}
                        </p>
                      </div>
                    </div>

                    <div className="relative overflow-hidden rounded-[26px] border border-slate-200 bg-white p-5 shadow-[0_24px_56px_rgba(15,23,42,0.12)]">
                      <div className="grid gap-3 md:grid-cols-3">
                        <div className="relative overflow-hidden rounded-2xl border border-slate-200 bg-[linear-gradient(180deg,rgba(248,250,252,1)_0%,rgba(255,255,255,0.92)_100%)] px-4 py-4">
                          <div className="space-y-3 blur-[3px] opacity-75">
                            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                              Comparables locaux selectionnes
                            </p>
                            <div className="space-y-2">
                              <div className="h-2.5 w-20 rounded-full bg-slate-200" />
                              <div className="h-8 rounded-xl bg-slate-100" />
                              <div className="h-8 rounded-xl bg-slate-100" />
                            </div>
                          </div>
                          <div className="absolute inset-0 flex items-center justify-center bg-white/30">
                            <span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-700 shadow-sm">
                              🔒 Verrouille
                            </span>
                          </div>
                        </div>
                        <div className="relative overflow-hidden rounded-2xl border border-slate-200 bg-[linear-gradient(180deg,rgba(248,250,252,1)_0%,rgba(255,255,255,0.92)_100%)] px-4 py-4">
                          <div className="space-y-3 blur-[3px] opacity-75">
                            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                              Analyse detaillee des points faibles
                            </p>
                            <div className="space-y-2">
                              <div className="h-2.5 w-20 rounded-full bg-slate-200" />
                              <div className="h-2.5 w-full rounded-full bg-slate-100" />
                              <div className="h-2.5 w-4/5 rounded-full bg-slate-100" />
                            </div>
                          </div>
                          <div className="absolute inset-0 flex items-center justify-center bg-white/30">
                            <span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-700 shadow-sm">
                              🔒 Verrouille
                            </span>
                          </div>
                        </div>
                        <div className="relative overflow-hidden rounded-2xl border border-slate-200 bg-[linear-gradient(180deg,rgba(248,250,252,1)_0%,rgba(255,255,255,0.92)_100%)] px-4 py-4">
                          <div className="space-y-3 blur-[3px] opacity-75">
                            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                              Plan d&apos;action priorise
                            </p>
                            <div className="space-y-2">
                              <div className="h-10 rounded-xl bg-slate-100" />
                              <div className="h-10 rounded-xl bg-slate-100" />
                            </div>
                          </div>
                          <div className="absolute inset-0 flex items-center justify-center bg-white/30">
                            <span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-700 shadow-sm">
                              🔒 Verrouille
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="mt-5 rounded-[24px] border border-orange-200 bg-[linear-gradient(180deg,rgba(255,247,237,1)_0%,rgba(255,255,255,0.99)_100%)] px-5 py-5 shadow-[0_18px_40px_rgba(249,115,22,0.10)]">
                        <div className="flex items-center justify-between gap-3">
                          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-orange-700">
                            Debloquez le rapport complet
                          </p>
                          <span className="rounded-full border border-orange-200 bg-white px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-orange-700">
                            Le plus choisi
                          </span>
                        </div>
                        <h3 className="mt-3 text-2xl font-semibold tracking-tight text-slate-950">
                          Transformez l’aperçu en rapport de decision
                        </h3>
                        <p className="mt-2 text-sm leading-6 text-slate-600">
                          Nous avons deja une premiere lecture de votre annonce. Le rapport complet vous
                          montre ce qui freine vraiment la conversion, comment vous situez face aux
                          comparables et quelles actions traiter dans quel ordre.
                        </p>
                        <div className="mt-4 grid gap-3 sm:grid-cols-2">
                          {[
                            "Analyse complete",
                            "Benchmark marche",
                            "Recommandations prioritaires",
                            "Plan d'action concret",
                          ].map((item) => (
                            <div
                              key={item}
                              className="rounded-2xl border border-white/80 bg-white/95 px-4 py-3 text-sm font-medium text-slate-700 shadow-sm"
                            >
                              {item}
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>

                    <div className="space-y-3 rounded-[22px] border border-slate-200 bg-slate-50/90 px-5 py-4">
                      <p className="text-sm font-semibold leading-6 text-slate-900">
                        Accedez au rapport complet pour savoir quoi ameliorer en priorite.
                      </p>
                      <div className="flex flex-wrap gap-2 text-[11px] font-medium text-slate-600">
                        <span className="rounded-full border border-slate-200 bg-white px-3 py-1.5">
                          Apercu immediat deja visible
                        </span>
                        <span className="rounded-full border border-slate-200 bg-white px-3 py-1.5">
                          Paiement unique
                        </span>
                        <span className="rounded-full border border-slate-200 bg-white px-3 py-1.5">
                          Acces complet juste apres le paiement
                        </span>
                      </div>
                    </div>

                    {error && (
                      <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                        {error}
                      </div>
                    )}

                    <button
                      type="button"
                      onClick={isAuthenticated ? handleFinish : () => router.push("/sign-in")}
                      disabled={isAuthenticated ? saving || launchingAudit || !listingId : false}
                      className="flex w-full items-center justify-center rounded-[20px] bg-[linear-gradient(135deg,#ea580c,#fb923c)] px-6 py-4.5 text-base font-semibold text-white shadow-[0_20px_40px_rgba(249,115,22,0.26)] transition duration-150 hover:brightness-[0.99] hover:shadow-[0_22px_42px_rgba(249,115,22,0.30)] disabled:cursor-not-allowed disabled:opacity-70"
                    >
                      {isAuthenticated
                        ? "Debloquer le rapport complet - 9€"
                        : "Creer mon compte et debloquer le rapport complet - 9€"}
                    </button>
                    <p className="text-center text-xs font-medium uppercase tracking-[0.14em] text-slate-500">
                      Paiement unique • Acces immediat • Aucun abonnement
                    </p>

                    <button
                      type="button"
                      onClick={isAuthenticated ? handleSkip : () => router.push("/sign-in")}
                      disabled={saving}
                      className="w-full text-sm font-medium text-slate-500 transition hover:text-slate-700 disabled:cursor-not-allowed disabled:opacity-70"
                    >
                      {isAuthenticated ? "Passer et acceder au dashboard" : "J'ai deja un compte"}
                    </button>
                  </div>
                )}
              </section>
            </div>
          </div>
          <aside className="lg:self-start">
            <div className="space-y-5 lg:sticky lg:top-8">
              <div className="rounded-[30px] border border-slate-200/70 bg-white/95 p-6 shadow-[0_22px_56px_rgba(15,23,42,0.11)] backdrop-blur-xl">
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                  Comment ca marche
                </p>
                <p className="mt-2 text-sm leading-6 text-slate-600">
                  En quelques etapes, vous passez d’une annonce brute a une lecture structuree et a un plan de priorites.
                </p>
                <div className="mt-4 space-y-3 text-sm leading-6 text-slate-700">
                  {HOW_IT_WORKS.map((item, index) => (
                    <div key={item} className="flex gap-3">
                      <span className="mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-slate-900 text-[11px] font-semibold text-white">
                        {index + 1}
                      </span>
                      <p>{item}</p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-[30px] border border-slate-200/70 bg-[linear-gradient(180deg,rgba(255,255,255,0.98)_0%,rgba(248,250,252,0.96)_100%)] p-6 shadow-[0_22px_56px_rgba(15,23,42,0.11)] backdrop-blur-xl">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                      Offres
                    </p>
                    <p className="mt-2 text-base font-semibold text-slate-900">
                      Des formats simples, lisibles et adaptes a votre rythme d&apos;analyse.
                    </p>
                    <p className="mt-2 text-sm leading-6 text-slate-600">
                      Commencez avec un audit test pour mesurer la valeur du rapport, puis passez a un pack si vous comparez plusieurs annonces ou travaillez en portefeuille.
                    </p>
                  </div>
                  <span className="rounded-full bg-emerald-100 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-emerald-700">
                    Annuel -10 %
                  </span>
                </div>
                <div className="mt-4 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm leading-6 text-slate-700">
                  <p className="font-semibold text-slate-900">Logique de progression</p>
                  <p className="mt-1">
                    Commencez avec 1 audit pour valider la valeur du rapport. Le pack 5 est ensuite le
                    choix naturel pour comparer plusieurs annonces ou suivre vos optimisations sur la duree.
                  </p>
                </div>
                <div className="mt-4 space-y-3">
                  {OFFER_CARDS.map((offer) => (
                    <OfferSummaryRow key={offer.name} {...offer} onSelect={() => setStep(3)} />
                  ))}
                </div>
                <div className="mt-4 rounded-[22px] border border-slate-200 bg-slate-50 px-4 py-4">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                    A retenir
                  </p>
                  <div className="mt-3 space-y-2 text-sm leading-6 text-slate-700">
                    <p>• Apercu immediat, puis creation de compte pour acceder au rapport complet.</p>
                    <p>• Audit test a 9 € pour verifier la qualite du rapport sur une annonce.</p>
                    <p>• Pack 5 a 39 € pour comparer plusieurs annonces ou suivre vos optimisations.</p>
                    <p>• Pack 15 a 99 € pour les usages reguliers, avec -10 % en annuel.</p>
                  </div>
                </div>
              </div>
            </div>
          </aside>
        </div>
      </div>
      </main>
    </MarketingPageShell>
  );
}

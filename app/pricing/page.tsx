"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { MarketingPageShell } from "@/components/marketing/MarketingPageShell";
import { supabase } from "@/lib/supabase";
import { SectionDescription, SectionLabel, SectionTitle } from "@/components/ui";

const plans = [
  {
    name: "Starter",
    subtitle: "Idéal pour tester la valeur du rapport",
    price: "9 €",
    priceNote: "Un point d’entrée simple pour tester la valeur du rapport",
    period: "audit unique",
    accent: "slate",
    highlighted: false,
    cta: "Tester un audit (9 €)",
    href: "/audit/new?restored=1&offer=audit_test",
    features: [
      "1 audit sur l’annonce de votre choix",
      "Lecture conversion immédiate",
      "Recommandations prioritaires",
      "Sans engagement",
    ],
  },
  {
    name: "Pro",
    subtitle: "Le meilleur équilibre pour comparer plusieurs annonces",
    price: "39 €",
    priceNote: "Soit ~7,80 € par audit",
    period: "5 audits · 7,80 €/audit",
    accent: "orange",
    highlighted: true,
    cta: "Passer au pack le plus rentable",
    href: "/audit/new?restored=1&offer=pack_5",
    features: [
      "5 audits utilisables librement",
      "Comparaison entre plusieurs annonces",
      "Priorisation claire des actions",
      "Meilleur ratio valeur / volume",
    ],
  },
  {
    name: "Scale",
    subtitle: "Pensé pour les portefeuilles plus larges",
    price: "99 €",
    priceNote: "Soit ~6,60 € par audit",
    period: "15 audits · 6,60 €/audit",
    accent: "sky",
    highlighted: false,
    cta: "Optimiser à grande échelle",
    href: "/audit/new?restored=1&offer=pack_15",
    features: [
      "15 audits à utiliser selon vos besoins",
      "Coût unitaire optimisé",
      "Suivi multi-annonces simplifié",
      "Adapté aux équipes et conciergeries",
    ],
  },
] as const;

export default function PricingPage() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    let mounted = true;

    async function hydrateSession() {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (mounted) {
        setIsAuthenticated(Boolean(session));
      }
    }

    hydrateSession();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setIsAuthenticated(Boolean(session));
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const authGateHref = `/sign-in?next=${encodeURIComponent("/pricing")}`;

  return (
    <MarketingPageShell>
      <main className="nk-section space-y-10 md:space-y-12">
        <section className="rounded-[28px] nk-border bg-[radial-gradient(circle_at_0_0,rgba(251,146,60,0.10),transparent_58%),radial-gradient(circle_at_100%_100%,rgba(16,185,129,0.08),transparent_56%),linear-gradient(180deg,rgba(255,255,255,0.99)_0%,rgba(248,250,252,0.97)_100%)] px-5 py-6 md:p-7 nk-card-lg">
          <SectionLabel className="text-orange-500">TARIFICATION</SectionLabel>
          <h1 className="mt-1 text-balance text-[2rem] font-extrabold leading-[0.95] tracking-tight bg-gradient-to-r from-orange-500 via-amber-400 to-emerald-400 bg-clip-text text-transparent md:text-[2.8rem]">
            Choisissez l’offre
            <span className="block">
              adaptée à votre volume d’annonces
            </span>
          </h1>
          <SectionDescription className="mt-2 max-w-2xl text-[14px] leading-7 text-slate-600 md:text-[15px]">
            Démarrez avec un audit test, puis passez sur un pack plus rentable quand vous
            voulez industrialiser vos optimisations.
          </SectionDescription>
          <div className="mt-4 flex flex-wrap items-center gap-2 text-[11px]">
            <span className="inline-flex items-center rounded-full border border-orange-200 bg-orange-50 px-2.5 py-1 font-medium text-orange-700">
              Orange = action rapide
            </span>
            <span className="inline-flex items-center rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 font-medium text-emerald-700">
              Vert = impact estimé
            </span>
            <span className="inline-flex items-center rounded-full border border-sky-200 bg-sky-50 px-2.5 py-1 font-medium text-sky-700">
              Bleu = benchmark / structure
            </span>
            <span className="inline-flex items-center rounded-full border border-violet-200 bg-violet-50 px-2.5 py-1 font-medium text-violet-700">
              Violet = priorisation IA
            </span>
          </div>
        </section>

        <section className="rounded-[28px] nk-border bg-[linear-gradient(180deg,rgba(255,255,255,0.99)_0%,rgba(248,250,252,0.97)_100%)] p-5 md:p-7 nk-card-lg">
          <div className="mb-5 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
            <div>
              <SectionLabel className="text-slate-600">OFFRES</SectionLabel>
              <SectionTitle className="mt-1 text-[20px] md:text-[24px] text-slate-950">
                Trois offres simples à comparer
              </SectionTitle>
              <SectionDescription className="mt-1 max-w-2xl text-[13px] leading-6 text-slate-600">
                Même niveau de rapport sur chaque offre. Seul le volume d’audits évolue.
              </SectionDescription>
              <div className="mt-2 text-sm text-gray-600">
                Commencez par un audit, puis passez sur un pack plus rentable si besoin
              </div>
            </div>
            <p className="text-[11px] font-medium text-slate-500">
              Ajustez votre volume quand vous le souhaitez.
            </p>
          </div>
          <p className="mb-4 text-[12px] leading-6 text-slate-500">
            Déjà pensé pour les hôtes, investisseurs et conciergeries qui veulent prioriser leurs optimisations.
          </p>

          <div className="grid gap-4 md:grid-cols-3">
            {plans.map((plan) => (
              <div
                key={plan.name}
                className={
                  "flex h-full flex-col rounded-2xl border p-4 shadow-[0_12px_28px_rgba(15,23,42,0.08)] transition-all duration-200 hover:-translate-y-[3px] hover:shadow-[0_18px_50px_rgba(15,23,42,0.15)] " +
                  (plan.highlighted
                    ? "relative z-10 scale-[1.04] border-orange-300 bg-gradient-to-b from-orange-50/80 via-white to-white ring-2 ring-blue-300 shadow-[0_25px_70px_rgba(59,130,246,0.25)]"
                    : plan.accent === "sky"
                      ? "border-sky-200 bg-gradient-to-b from-sky-50/70 to-white"
                      : "border-slate-200 bg-white")
                }
              >
                <div className="flex items-start justify-between gap-2">
                  <p
                    className={
                      "text-[11px] font-semibold uppercase tracking-[0.18em] " +
                      (plan.highlighted
                        ? "text-orange-700"
                        : plan.accent === "sky"
                          ? "text-sky-700"
                          : "text-slate-600")
                    }
                  >
                    {plan.name}
                  </p>
                  {plan.highlighted ? (
                    <span className="inline-flex items-center rounded-full border border-orange-300/40 bg-orange-500/10 px-2 py-[3px] text-[10px] font-semibold uppercase tracking-[0.2em] text-orange-500">
                      Le choix le plus rentable
                    </span>
                  ) : null}
                </div>

                <p className="mt-2 text-[15px] font-medium text-slate-900">{plan.subtitle}</p>
                <p className="mt-3 text-5xl font-semibold leading-none tracking-[-0.03em] text-slate-950 md:text-6xl">{plan.price}</p>
                <p
                  className={
                    "mt-1 text-[15px] font-medium " +
                    (plan.highlighted
                      ? "text-orange-700"
                      : plan.accent === "sky"
                        ? "text-sky-700"
                        : "text-slate-600")
                  }
                >
                  {plan.period}
                </p>
                <p className="mt-1 text-xs text-gray-500">
                  {plan.name === "Starter"
                    ? "Idéal pour tester sans engagement"
                    : plan.name === "Pro"
                      ? "Le meilleur rapport impact / prix"
                      : "Pensé pour les portefeuilles actifs"}
                </p>
                <p className="mt-1 text-[15px] font-medium leading-6 text-slate-500">{plan.priceNote}</p>
                {plan.name === "Pro" ? (
                  <div className="mt-2 text-xs font-medium text-emerald-600">
                    Économisez ~13€ vs audits unitaires
                  </div>
                ) : null}
                {plan.name === "Scale" ? (
                  <div className="mt-2 text-xs font-medium text-emerald-600">
                    Économisez ~36€ vs audits unitaires
                  </div>
                ) : null}

                <ul className="mt-4 space-y-1 text-[15px] leading-6 text-slate-700/85">
                  {plan.features.map((feature) => (
                    <li key={feature}>• {feature}</li>
                  ))}
                </ul>

                <div className="mt-5 flex-1" />

                <Link
                  href={isAuthenticated ? plan.href : authGateHref}
                  className={
                    "inline-flex h-10 w-full items-center justify-center rounded-xl text-[11px] font-semibold uppercase tracking-[0.18em] transition-all duration-200 " +
                    (plan.highlighted
                      ? "bg-[linear-gradient(135deg,#3b82f6_0%,#06b6d4_50%,#7c3aed_100%)] text-white shadow-[0_12px_30px_rgba(59,130,246,0.35)] hover:scale-[1.03]"
                      : "border border-slate-300 bg-white text-slate-800 hover:bg-slate-50 shadow-[0_8px_20px_rgba(15,23,42,0.06)]")
                  }
                >
                  {plan.cta}
                </Link>
              </div>
            ))}
          </div>
        </section>

        <section className="mt-12 rounded-[28px] nk-border bg-[linear-gradient(180deg,rgba(255,255,255,0.99)_0%,rgba(248,250,252,0.97)_100%)] p-5 md:p-7 nk-card-lg">
          <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div>
              <SectionLabel className="text-emerald-700">CAS RÉEL</SectionLabel>
              <SectionTitle className="mt-1 text-[20px] text-slate-950 md:text-[24px]">
                Avant / Après sur une annonce comparable
              </SectionTitle>
              <SectionDescription className="mt-1 max-w-2xl text-[13px] leading-6 text-slate-600">
                Appartement 2 chambres à Lisbonne, même positionnement prix, même saisonnalité.
              </SectionDescription>
            </div>
            <span className="inline-flex w-fit items-center rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-emerald-700">
              Résultat observé en 14 jours
            </span>
          </div>

          <div className="mt-5 grid gap-3 md:grid-cols-2">
            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-[0_10px_24px_rgba(15,23,42,0.07)]">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                Avant audit
              </p>
              <ul className="mt-2 space-y-1.5 text-[13px] leading-6 text-slate-700">
                <li>• Score de conversion: 5.8 / 10</li>
                <li>• Texte peu différenciant sur les premières lignes</li>
                <li>• Photos clés placées trop bas dans la galerie</li>
              </ul>
            </div>

            <div className="rounded-2xl border border-emerald-200 bg-[linear-gradient(180deg,rgba(236,253,245,0.8)_0%,rgba(255,255,255,1)_100%)] p-4 shadow-[0_12px_28px_rgba(16,185,129,0.12)]">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-emerald-700">
                Après recommandations
              </p>
              <ul className="mt-2 space-y-1.5 text-[13px] leading-6 text-emerald-900">
                <li>• Score estimé: 7.1 / 10</li>
                <li>• +22% de conversions sur la période test</li>
                <li>• Priorités exécutées en moins de 48h</li>
              </ul>
            </div>
          </div>

          <p className="mt-4 text-xs text-slate-500">
            Exemple anonymisé issu d’un cas client comparable, utilisé à titre illustratif.
          </p>
        </section>

        <section className="flex flex-col gap-4 rounded-[28px] nk-border bg-[linear-gradient(180deg,rgba(255,255,255,0.99)_0%,rgba(248,250,252,0.97)_100%)] p-5 md:flex-row md:items-center md:justify-between md:p-7 nk-card-lg">
          <div className="max-w-xl">
            <SectionTitle className="text-[22px] md:text-[26px] leading-tight text-slate-900">
              Prêt à lancer votre premier audit ?
            </SectionTitle>
            <SectionDescription className="mt-2 text-[14px] leading-7 text-slate-600">
              Choisissez votre pack et transformez vos annonces en actifs plus performants.
            </SectionDescription>
          </div>
          <div className="flex flex-wrap items-center gap-3 md:justify-end">
            <div className="flex flex-col items-start gap-2 md:items-end">
              <Link
                href="/audit/new"
                className="rounded-2xl bg-[linear-gradient(135deg,#3b82f6_0%,#06b6d4_50%,#7c3aed_100%)] px-5 py-2.5 text-xs font-semibold uppercase tracking-[0.18em] text-white shadow-[0_12px_30px_rgba(59,130,246,0.30)] transition-all duration-200 hover:-translate-y-[1px] hover:brightness-105"
              >
                Lancer mon premier audit
              </Link>
              <p className="text-xs text-gray-500">
                Résultat immédiat • Aucun engagement
              </p>
            </div>
            <Link
              href="/demo"
              className="rounded-2xl border border-slate-200 bg-white px-5 py-2.5 text-xs font-semibold uppercase tracking-[0.18em] text-slate-700 shadow-[0_8px_24px_rgba(15,23,42,0.06)] transition-all duration-200 hover:-translate-y-[1px] hover:bg-slate-50"
            >
              Voir la démo
            </Link>
          </div>
        </section>
      </main>
    </MarketingPageShell>
  );
}

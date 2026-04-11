import Link from "next/link";
import { MarketingPageShell } from "@/components/marketing/MarketingPageShell";
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
    cta: "Payer 9 €",
    href: "/dashboard/listings/new",
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
    cta: "Choisir Pro",
    href: "/dashboard/listings/new",
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
    price: "79 €",
    priceNote: "Soit ~5,27 € par audit",
    period: "15 audits · 5,27 €/audit",
    accent: "sky",
    highlighted: false,
    cta: "Passer à Scale",
    href: "/dashboard/listings/new",
    features: [
      "15 audits à utiliser selon vos besoins",
      "Coût unitaire optimisé",
      "Suivi multi-annonces simplifié",
      "Adapté aux équipes et conciergeries",
    ],
  },
] as const;

export default function PricingPage() {
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
                  "flex h-full flex-col rounded-2xl border p-4 shadow-[0_12px_28px_rgba(15,23,42,0.08)] transition-all duration-200 hover:-translate-y-0.5 " +
                  (plan.highlighted
                    ? "relative z-10 scale-[1.03] md:scale-[1.04] border-orange-300 bg-gradient-to-b from-orange-50/80 via-white to-white ring-1 ring-orange-200/70 shadow-[0_20px_50px_rgba(249,115,22,0.25)] hover:shadow-[0_20px_50px_rgba(249,115,22,0.25)]"
                    : plan.accent === "sky"
                      ? "border-sky-200 bg-gradient-to-b from-sky-50/70 to-white hover:shadow-[0_16px_34px_rgba(56,189,248,0.14)]"
                      : "border-slate-200 bg-white hover:shadow-[0_16px_34px_rgba(15,23,42,0.12)]")
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
                    <span className="inline-flex items-center rounded-full border border-orange-300 bg-orange-100 px-2 py-[3px] text-[10px] font-semibold uppercase tracking-[0.18em] text-orange-700">
                      LE PLUS POPULAIRE
                    </span>
                  ) : null}
                </div>

                <p className="mt-2 text-sm font-semibold text-slate-900">{plan.subtitle}</p>
                <p className="mt-3 text-[42px] font-bold leading-none tracking-[-0.03em] text-slate-950 md:text-[48px]">{plan.price}</p>
                <p
                  className={
                    "mt-1 text-[12px] font-medium " +
                    (plan.highlighted
                      ? "text-orange-700"
                      : plan.accent === "sky"
                        ? "text-sky-700"
                        : "text-slate-600")
                  }
                >
                  {plan.period}
                </p>
                <p className="mt-1 text-[11px] leading-5 text-slate-500">{plan.priceNote}</p>

                <ul className="mt-4 space-y-1.5 text-[12px] leading-5 text-slate-700">
                  {plan.features.map((feature) => (
                    <li key={feature}>• {feature}</li>
                  ))}
                </ul>

                <div className="mt-5 flex-1" />

                <Link
                  href={plan.href}
                  className={
                    "inline-flex h-10 w-full items-center justify-center rounded-xl text-[11px] font-semibold uppercase tracking-[0.18em] transition-all duration-200 " +
                    (plan.highlighted
                      ? "bg-orange-500 text-slate-950 shadow-[0_12px_26px_rgba(249,115,22,0.24)] hover:bg-orange-400"
                      : "border border-slate-200 bg-white text-slate-800 hover:bg-slate-50")
                  }
                >
                  {plan.cta}
                </Link>
              </div>
            ))}
          </div>
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
            <Link
              href="/audit/new"
              className="rounded-2xl bg-orange-500 px-5 py-2.5 text-xs font-semibold uppercase tracking-[0.18em] text-slate-950 shadow-[0_12px_30px_rgba(249,115,22,0.22)] transition-all duration-200 hover:-translate-y-[1px] hover:bg-orange-400"
            >
              Commencer maintenant
            </Link>
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

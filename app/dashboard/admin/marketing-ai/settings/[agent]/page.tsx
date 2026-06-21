import Link from "next/link";
import { notFound } from "next/navigation";
import {
  getMarketingAiAgentBySlug,
  getMarketingAiDashboard,
  MARKETING_AI_AGENTS,
} from "@/lib/admin/marketingAiDashboard";

type MarketingAiAgentSettingsPageProps = {
  params: Promise<{
    agent: string;
  }>;
};

export function generateStaticParams() {
  return MARKETING_AI_AGENTS.map((agent) => ({ agent: agent.slug }));
}

export default async function MarketingAiAgentSettingsPage({
  params,
}: MarketingAiAgentSettingsPageProps) {
  const { agent: agentSlug } = await params;
  const agent = getMarketingAiAgentBySlug(agentSlug);
  const dashboard = await getMarketingAiDashboard();

  if (!agent) {
    notFound();
  }

  const statusLabel = dashboard.available ? "Prêt" : "Indisponible";
  const currentAgentIndex = MARKETING_AI_AGENTS.findIndex(
    (listedAgent) => listedAgent.slug === agent.slug
  );
  const previousAgent =
    currentAgentIndex > 0 ? MARKETING_AI_AGENTS[currentAgentIndex - 1] : null;
  const nextAgent =
    currentAgentIndex < MARKETING_AI_AGENTS.length - 1
      ? MARKETING_AI_AGENTS[currentAgentIndex + 1]
      : null;
  const futureFlow = [
    "Configuration",
    "Validation",
    "Exécution",
    "Contrôle qualité",
    "Publication",
    "Analytics",
    "Learning",
  ];
  const activityEntries = [
    {
      title: "Configuration préparée",
      description: `Les paramètres initiaux de ${agent.name} sont prêts pour une future activation.`,
      date: "21 juin 2026 · 09:00",
      status: "Information",
      tone:
        "border-sky-200 bg-sky-50 text-sky-700",
    },
    {
      title: "Provider non connecté",
      description: `Aucun fournisseur actif n'est actuellement relié à cet agent. Référence prévue : ${agent.provider}.`,
      date: "21 juin 2026 · 09:12",
      status: "En attente",
      tone:
        "border-amber-200 bg-amber-50 text-amber-700",
    },
    {
      title: "Validation humaine requise",
      description:
        "Les futures exécutions devront être validées avant publication ou activation opérationnelle.",
      date: "21 juin 2026 · 09:24",
      status: "Prévu",
      tone:
        "border-emerald-200 bg-emerald-50 text-emerald-700",
    },
    {
      title: "Exécution désactivée",
      description:
        "Les traitements automatiques restent volontairement inactifs dans cette version du centre de pilotage.",
      date: "21 juin 2026 · 09:36",
      status: "Non actif",
      tone:
        "border-slate-200 bg-slate-100 text-slate-700",
    },
    {
      title: "Dernière simulation UI",
      description:
        "Cette page affiche uniquement une prévisualisation de l'interface de configuration et du suivi futur.",
      date: "21 juin 2026 · 09:48",
      status: "Simulation",
      tone:
        "border-violet-200 bg-violet-50 text-violet-700",
    },
  ];
  const securityState = [
    {
      label: "Exécution automatique",
      value: "Désactivée",
      tone: "border-slate-200 bg-slate-100 text-slate-700",
    },
    {
      label: "Validation humaine",
      value: "Requise",
      tone: "border-amber-200 bg-amber-50 text-amber-700",
    },
    {
      label: "Providers IA",
      value: "Non connectés",
      tone: "border-sky-200 bg-sky-50 text-sky-700",
    },
    {
      label: "Publications automatiques",
      value: "Désactivées",
      tone: "border-slate-200 bg-slate-100 text-slate-700",
    },
    {
      label: "Modifications système",
      value: "Interdites",
      tone: "border-rose-200 bg-rose-50 text-rose-700",
    },
    {
      label: "Accès aux données sensibles",
      value: "Bloqué",
      tone: "border-rose-200 bg-rose-50 text-rose-700",
    },
  ];
  const plannedGuardrails = [
    "Validation avant chaque exécution",
    "Contrôle des quotas",
    "Vérification des prompts",
    "Limitation des actions automatiques",
    "Vérification des permissions",
    "Confirmation avant publication",
    "Journalisation complète",
    "Contrôle qualité des résultats",
  ];
  const protectionMatrix = [
    {
      domain: "Configuration",
      protection: "Validation administrateur",
      status: "Prévu",
      tone: "border-emerald-200 bg-emerald-50 text-emerald-700",
    },
    {
      domain: "Contenu",
      protection: "Vérification qualité",
      status: "Prévu",
      tone: "border-emerald-200 bg-emerald-50 text-emerald-700",
    },
    {
      domain: "Publication",
      protection: "Confirmation obligatoire",
      status: "Prévu",
      tone: "border-emerald-200 bg-emerald-50 text-emerald-700",
    },
    {
      domain: "Providers",
      protection: "Autorisation requise",
      status: "Prévu",
      tone: "border-emerald-200 bg-emerald-50 text-emerald-700",
    },
    {
      domain: "Analytics",
      protection: "Lecture seule",
      status: "Actif (UI)",
      tone: "border-sky-200 bg-sky-50 text-sky-700",
    },
    {
      domain: "Learning",
      protection: "Désactivé",
      status: "Non actif",
      tone: "border-slate-200 bg-slate-100 text-slate-700",
    },
  ];
  const futureRoles = [
    {
      role: "Owner",
      description: "Contrôle complet de l'agent",
      status: "Prévu",
    },
    {
      role: "Admin",
      description: "Configuration et supervision",
      status: "Prévu",
    },
    {
      role: "Reviewer",
      description: "Validation humaine",
      status: "Prévu",
    },
    {
      role: "Operator",
      description: "Exécution supervisée",
      status: "Prévu",
    },
    {
      role: "Viewer",
      description: "Consultation uniquement",
      status: "Prévu",
    },
  ];
  const permissionMatrix = [
    {
      action: "Consulter",
      owner: "✓",
      admin: "✓",
      reviewer: "✓",
      operator: "✓",
      viewer: "✓",
    },
    {
      action: "Modifier la configuration",
      owner: "✓",
      admin: "✓",
      reviewer: "—",
      operator: "—",
      viewer: "—",
    },
    {
      action: "Valider",
      owner: "✓",
      admin: "✓",
      reviewer: "✓",
      operator: "—",
      viewer: "—",
    },
    {
      action: "Exécuter",
      owner: "✓",
      admin: "✓",
      reviewer: "—",
      operator: "Prévu",
      viewer: "—",
    },
    {
      action: "Publier",
      owner: "✓",
      admin: "✓",
      reviewer: "✓",
      operator: "—",
      viewer: "—",
    },
    {
      action: "Consulter les journaux",
      owner: "✓",
      admin: "✓",
      reviewer: "✓",
      operator: "✓",
      viewer: "✓",
    },
  ];
  const authorizationFlow = [
    "Owner",
    "Admin",
    "Reviewer",
    "Validation",
    "Exécution",
    "Publication",
  ];
  const activationOverview = [
    {
      label: "Statut global",
      value: "Non activé",
      tone: "border-slate-200 bg-slate-100 text-slate-700",
    },
    {
      label: "Niveau de préparation",
      value: "En préparation",
      tone: "border-amber-200 bg-amber-50 text-amber-700",
    },
    {
      label: "Activation réelle",
      value: "Désactivée",
      tone: "border-slate-200 bg-slate-100 text-slate-700",
    },
    {
      label: "Version cible",
      value: "Future version",
      tone: "border-sky-200 bg-sky-50 text-sky-700",
    },
    {
      label: "Dernière validation",
      value: "Non disponible",
      tone: "border-rose-200 bg-rose-50 text-rose-700",
    },
  ];
  const activationRoadmap = [
    {
      title: "Configuration de l'agent",
      description: "Préparer les paramètres de base et le mode de fonctionnement attendu.",
      status: "Prévu",
    },
    {
      title: "Validation de la configuration",
      description: "Contrôler la cohérence des réglages avant toute étape suivante.",
      status: "À venir",
    },
    {
      title: "Connexion des providers",
      description: "Relier les futurs fournisseurs IA et services externes approuvés.",
      status: "À venir",
    },
    {
      title: "Vérification des permissions",
      description: "Valider les rôles, autorisations et garde-fous de gouvernance.",
      status: "Prévu",
    },
    {
      title: "Tests en environnement Sandbox",
      description: "Exécuter des essais contrôlés dans un environnement sécurisé.",
      status: "À venir",
    },
    {
      title: "Validation qualité",
      description: "Confirmer que les résultats respectent les attentes Norixo.",
      status: "Prévu",
    },
    {
      title: "Validation administrateur",
      description: "Obtenir l'accord humain avant tout passage à une phase supérieure.",
      status: "Prévu",
    },
    {
      title: "Déploiement contrôlé",
      description: "Démarrer sous supervision étroite avec périmètre limité.",
      status: "À venir",
    },
    {
      title: "Activation progressive",
      description: "Étendre l'usage par étapes avec seuils et vérifications.",
      status: "À venir",
    },
    {
      title: "Monitoring continu",
      description: "Surveiller les performances, alertes et validations dans la durée.",
      status: "Prévu",
    },
  ];
  const activationPrerequisites = [
    "Provider configuré",
    "Clés API validées",
    "Permissions administrateur",
    "Validation humaine",
    "Journalisation disponible",
    "Monitoring actif",
    "Contrôle qualité",
    "Sandbox validée",
  ];
  const activationConditions = [
    "Validation obligatoire avant toute activation",
    "Tests Sandbox réussis",
    "Contrôles qualité validés",
    "Providers disponibles",
    "Permissions vérifiées",
    "Monitoring opérationnel",
    "Journalisation active",
  ];

  return (
    <div className="space-y-6 text-sm md:space-y-7">
      <section className="nk-card overflow-hidden rounded-3xl border border-slate-200/80 bg-[radial-gradient(circle_at_top_left,rgba(14,116,144,0.10),transparent_34%),radial-gradient(circle_at_90%_10%,rgba(2,132,199,0.10),transparent_28%),linear-gradient(135deg,#ffffff_0%,#f8fafc_52%,#ecfeff_100%)] p-6 shadow-[0_24px_70px_rgba(15,23,42,0.08),0_1px_0_rgba(255,255,255,0.75)_inset]">
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div className="max-w-3xl space-y-3">
            <p className="inline-flex rounded-full border border-sky-200/80 bg-white/85 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-sky-700 shadow-sm">
              Norixo AI
            </p>
            <h1 className="text-2xl font-semibold tracking-tight text-slate-950 md:text-3xl">
              Paramètres — {agent.name}
            </h1>
            <p className="text-sm leading-6 text-slate-600">
              {agent.description} Cette page pose uniquement la fondation UI du
              futur centre de configuration et reste entièrement en lecture
              seule.
            </p>
          </div>

          <div className="flex flex-col items-start gap-3 md:items-end">
            <div className="flex flex-wrap items-center gap-3 md:justify-end">
              <span className="inline-flex rounded-full border border-sky-200 bg-sky-50 px-4 py-2 text-xs font-semibold uppercase tracking-[0.16em] text-sky-700">
                Agent actif
              </span>
              <span className="inline-flex rounded-full border border-violet-200 bg-violet-50 px-4 py-2 text-xs font-semibold uppercase tracking-[0.16em] text-violet-700">
                Bientôt configurable
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-3 md:justify-end">
              <Link
                href="/dashboard/admin/marketing-ai"
                className="inline-flex items-center rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-slate-300 hover:bg-slate-50 hover:text-slate-950"
              >
                Tous les agents
              </Link>
              {previousAgent ? (
                <Link
                  href={`/dashboard/admin/marketing-ai/settings/${previousAgent.slug}`}
                  className="inline-flex items-center rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-slate-300 hover:bg-slate-50 hover:text-slate-950"
                >
                  Agent précédent
                </Link>
              ) : (
                <span className="inline-flex items-center rounded-full border border-slate-200 bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-400">
                  Agent précédent
                </span>
              )}
              {nextAgent ? (
                <Link
                  href={`/dashboard/admin/marketing-ai/settings/${nextAgent.slug}`}
                  className="inline-flex items-center rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-slate-300 hover:bg-slate-50 hover:text-slate-950"
                >
                  Agent suivant
                </Link>
              ) : (
                <span className="inline-flex items-center rounded-full border border-slate-200 bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-400">
                  Agent suivant
                </span>
              )}
            </div>
          </div>
        </div>
      </section>

      <section className="nk-card rounded-3xl border border-slate-200/80 bg-white p-5 shadow-[0_18px_48px_rgba(15,23,42,0.07),0_1px_0_rgba(255,255,255,0.75)_inset]">
        <div className="mb-5 flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <div className="space-y-2">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
              Vue synthèse agent
            </p>
            <h2 className="text-xl font-semibold tracking-tight text-slate-950">
              {agent.name}
            </h2>
            <p className="max-w-3xl text-sm leading-6 text-slate-600">
              {agent.role}
            </p>
          </div>
          <span className="inline-flex w-fit rounded-full border border-slate-200 bg-slate-100 px-4 py-2 text-xs font-semibold uppercase tracking-[0.16em] text-slate-700">
            Non actif
          </span>
        </div>

        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {[
            ["Statut global", "Non actif"],
            ["Score de préparation", "35 %"],
            ["Sécurité", "Protégé"],
            ["Permissions", "Simulation UI"],
            ["Activation", "Non activée"],
            ["Provider", "Non connecté"],
          ].map(([label, value]) => (
            <div
              key={label}
              className="rounded-2xl border border-slate-200/80 bg-slate-50/80 p-4"
            >
              <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                {label}
              </p>
              <p className="mt-2 text-sm font-semibold text-slate-950">
                {value}
              </p>
            </div>
          ))}
        </div>

        <div className="mt-5 flex flex-wrap gap-3">
          {[
            ["Configuration", "Prévu"],
            ["Provider", "Non connecté"],
            ["Sécurité", "Protégé"],
            ["Permissions", "Lecture seule"],
            ["Activation", "Non activée"],
            ["Exécution", "Bloquée"],
          ].map(([label, value]) => (
            <span
              key={label}
              className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700 shadow-sm"
            >
              <span className="text-slate-500">{label}</span>
              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] uppercase tracking-[0.14em] text-slate-700">
                {value}
              </span>
            </span>
          ))}
        </div>

        <div className="mt-5 rounded-2xl border border-sky-100 bg-sky-50/70 p-4">
          <p className="text-sm leading-6 text-slate-700">
            Cet agent est actuellement présenté en mode préconfiguration. Les
            paramètres, permissions, providers et workflows d'activation sont
            visibles uniquement à titre de préparation. Aucune exécution réelle
            n'est disponible.
          </p>
        </div>
      </section>

      <section className="nk-card rounded-3xl border border-slate-200/80 bg-white p-5 shadow-[0_18px_48px_rgba(15,23,42,0.07),0_1px_0_rgba(255,255,255,0.75)_inset]">
        <div className="mb-4 flex flex-col gap-2">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
            Navigation agents
          </p>
          <p className="text-sm leading-6 text-slate-600">
            Parcourez rapidement les espaces de configuration UI des 9 agents
            Norixo AI sans activer de logique opérationnelle.
          </p>
        </div>

        <div className="flex flex-wrap gap-3">
          {MARKETING_AI_AGENTS.map((listedAgent) => {
            const isActive = listedAgent.slug === agent.slug;

            return (
              <Link
                key={listedAgent.slug}
                href={`/dashboard/admin/marketing-ai/settings/${listedAgent.slug}`}
                aria-current={isActive ? "page" : undefined}
                className={[
                  "inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-semibold transition",
                  isActive
                    ? "border-sky-200 bg-sky-50 text-sky-800 shadow-sm"
                    : "border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50 hover:text-slate-950",
                ].join(" ")}
              >
                <span>{listedAgent.name}</span>
                {isActive ? (
                  <span className="rounded-full bg-white/90 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-sky-700">
                    Actif
                  </span>
                ) : null}
              </Link>
            );
          })}
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {[
          { label: "Agent", value: agent.name },
          { label: "Statut", value: statusLabel },
          { label: "Provider actuel ou prévu", value: agent.provider },
          { label: "Rôle", value: agent.role },
          { label: "Prochaine étape", value: agent.nextStep },
        ].map((card) => (
          <article
            key={card.label}
            className="nk-card rounded-3xl border border-slate-200/80 bg-[linear-gradient(180deg,#ffffff_0%,#f8fafc_100%)] p-5 shadow-[0_16px_42px_rgba(15,23,42,0.06),0_1px_0_rgba(255,255,255,0.72)_inset]"
          >
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
              {card.label}
            </p>
            <p className="mt-3 text-sm font-semibold leading-6 text-slate-950">
              {card.value}
            </p>
          </article>
        ))}
      </section>

      <section className="nk-card rounded-3xl border border-slate-200/80 bg-white p-6 shadow-[0_18px_48px_rgba(15,23,42,0.07),0_1px_0_rgba(255,255,255,0.75)_inset]">
        <div className="mb-5 flex flex-col gap-3 border-b border-slate-200/70 pb-4 md:flex-row md:items-start md:justify-between">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
              Mode de configuration prévu
            </p>
            <h2 className="mt-2 text-lg font-semibold tracking-tight text-slate-950">
              Prévisualisation du futur panneau
            </h2>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              Cette section est une maquette UI crédible du futur centre de
              configuration. Tous les contrôles sont volontairement désactivés
              et aucune logique réelle n’est active.
            </p>
          </div>

          <span className="inline-flex rounded-full border border-amber-200 bg-amber-50 px-4 py-2 text-xs font-semibold uppercase tracking-[0.16em] text-amber-700">
            {agent.configurationMode}
          </span>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          {agent.configurationPreview.map((field) => (
            <label
              key={field.label}
              className="block rounded-3xl border border-slate-200/80 bg-slate-50/70 p-4 shadow-[0_10px_24px_rgba(15,23,42,0.04)]"
            >
              <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-400">
                {field.label}
              </span>

              {field.type === "toggle" ? (
                <div className="mt-3 flex items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-white px-4 py-3">
                  <span className="text-sm font-semibold text-slate-700">
                    {field.value}
                  </span>
                  <span className="relative inline-flex h-7 w-12 items-center rounded-full bg-slate-200">
                    <input
                      type="checkbox"
                      checked={field.value === "Activée" || field.value === "Activés"}
                      disabled
                      readOnly
                      className="sr-only"
                    />
                    <span
                      className={[
                        "inline-block h-5 w-5 rounded-full bg-white shadow-sm transition",
                        field.value === "Activée" || field.value === "Activés"
                          ? "translate-x-6"
                          : "translate-x-1",
                      ].join(" ")}
                    />
                  </span>
                </div>
              ) : (
                <input
                  type="text"
                  value={field.value}
                  disabled
                  readOnly
                  className="mt-3 h-12 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm font-medium text-slate-700 shadow-sm disabled:cursor-not-allowed disabled:bg-white disabled:text-slate-700 disabled:opacity-100"
                />
              )}
            </label>
          ))}
        </div>
      </section>

      <section className="nk-card rounded-3xl border border-slate-200/80 bg-white p-6 shadow-[0_18px_48px_rgba(15,23,42,0.07),0_1px_0_rgba(255,255,255,0.75)_inset]">
        <div className="mb-5 border-b border-slate-200/70 pb-4">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
            Capacités opérationnelles prévues
          </p>
          <h2 className="mt-2 text-lg font-semibold tracking-tight text-slate-950">
            Vision de l'agent une fois activé
          </h2>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            Cette section présente les capacités, dépendances et étapes futures
            de l'agent, sans activer la moindre exécution réelle.
          </p>
        </div>

        <div className="grid gap-5 xl:grid-cols-[1.1fr_0.9fr]">
          <div className="space-y-5">
            <article className="rounded-3xl border border-slate-200/80 bg-slate-50/70 p-5 shadow-[0_10px_24px_rgba(15,23,42,0.04)]">
              <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-400">
                Capacités futures
              </p>
              <div className="mt-4 space-y-3">
                {agent.operationalCapabilities.map((capability) => (
                  <div
                    key={capability.label}
                    className="flex flex-col gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="flex items-center gap-3">
                      <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-emerald-50 text-emerald-700 shadow-sm">
                        <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
                      </span>
                      <span className="text-sm font-semibold text-slate-800">
                        {capability.label}
                      </span>
                    </div>
                    <span className="inline-flex rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-emerald-700">
                      {capability.status}
                    </span>
                  </div>
                ))}
              </div>
            </article>

            <article className="rounded-3xl border border-slate-200/80 bg-slate-50/70 p-5 shadow-[0_10px_24px_rgba(15,23,42,0.04)]">
              <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-400">
                Dépendances
              </p>
              <div className="mt-4 flex flex-wrap gap-3">
                {agent.futureDependencies.map((dependency) => (
                  <div
                    key={dependency}
                    className="flex min-w-[220px] flex-1 items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3"
                  >
                    <span className="text-sm font-semibold text-slate-800">
                      {dependency}
                    </span>
                    <span className="inline-flex rounded-full border border-slate-200 bg-slate-100 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-600">
                      Non actif
                    </span>
                  </div>
                ))}
              </div>
            </article>
          </div>

          <div className="space-y-5">
            <article className="rounded-3xl border border-slate-200/80 bg-slate-50/70 p-5 shadow-[0_10px_24px_rgba(15,23,42,0.04)]">
              <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-400">
                Flux futur
              </p>
              <div className="mt-4 space-y-3">
                {futureFlow.map((step, index) => (
                  <div key={step} className="flex gap-4">
                    <div className="flex w-8 flex-col items-center">
                      <span className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-sky-200 bg-sky-50 text-[11px] font-semibold text-sky-700">
                        {index + 1}
                      </span>
                      {index < futureFlow.length - 1 ? (
                        <span className="mt-2 h-8 w-px bg-slate-200" />
                      ) : null}
                    </div>
                    <div className="flex flex-1 items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3">
                      <span className="text-sm font-semibold text-slate-800">
                        {step}
                      </span>
                      <span className="inline-flex rounded-full border border-sky-200 bg-sky-50 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-sky-700">
                        À venir
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </article>

            <article className="rounded-3xl border border-amber-200/80 bg-[linear-gradient(135deg,#fffdf5_0%,#fff7ed_100%)] p-5 shadow-[0_12px_30px_rgba(15,23,42,0.05)]">
              <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-amber-700">
                Activation future
              </p>
              <p className="mt-3 text-sm leading-6 text-slate-700">
                Cette interface présente les capacités qui seront
                progressivement activées dans les prochaines versions de Norixo
                AI. Aucun traitement réel n'est actuellement exécuté depuis
                cette page.
              </p>
            </article>
          </div>
        </div>
      </section>

      <section className="nk-card rounded-3xl border border-slate-200/80 bg-white p-6 shadow-[0_18px_48px_rgba(15,23,42,0.07),0_1px_0_rgba(255,255,255,0.75)_inset]">
        <div className="mb-5 border-b border-slate-200/70 pb-4">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
            Journal d'activité prévu
          </p>
          <h2 className="mt-2 text-lg font-semibold tracking-tight text-slate-950">
            Prévisualisation de l'historique agent
          </h2>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            Cette chronologie présente le futur historique détaillé des actions
            de l’agent, tout en restant entièrement statique et en lecture
            seule.
          </p>
        </div>

        <div className="grid gap-5 xl:grid-cols-[1.15fr_0.85fr]">
          <div className="space-y-5">
            <article className="rounded-3xl border border-slate-200/80 bg-slate-50/70 p-5 shadow-[0_10px_24px_rgba(15,23,42,0.04)]">
              <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-400">
                Résumé du journal
              </p>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                {[
                  { label: "Événements affichés", value: "5" },
                  { label: "Dernière activité", value: "Simulation UI" },
                  { label: "Exécution réelle", value: "Désactivée" },
                  { label: "Historique réel", value: "Indisponible" },
                ].map((item) => (
                  <div
                    key={item.label}
                    className="rounded-2xl border border-slate-200 bg-white px-4 py-3"
                  >
                    <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-400">
                      {item.label}
                    </p>
                    <p className="mt-2 text-sm font-semibold text-slate-900">
                      {item.value}
                    </p>
                  </div>
                ))}
              </div>
            </article>

            <article className="rounded-3xl border border-slate-200/80 bg-slate-50/70 p-5 shadow-[0_10px_24px_rgba(15,23,42,0.04)]">
              <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-400">
                Chronologie simulée
              </p>
              <div className="mt-4 space-y-4">
                {activityEntries.map((entry, index) => (
                  <div key={entry.title} className="flex gap-4">
                    <div className="flex w-8 flex-col items-center">
                      <span className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-slate-200 bg-white shadow-sm">
                        <span className="h-2.5 w-2.5 rounded-full bg-slate-500" />
                      </span>
                      {index < activityEntries.length - 1 ? (
                        <span className="mt-2 h-full min-h-10 w-px bg-slate-200" />
                      ) : null}
                    </div>

                    <article className="flex-1 rounded-3xl border border-slate-200 bg-white p-4 shadow-[0_12px_30px_rgba(15,23,42,0.05)]">
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                        <div>
                          <h3 className="text-sm font-semibold text-slate-950">
                            {entry.title}
                          </h3>
                          <p className="mt-2 text-sm leading-6 text-slate-600">
                            {entry.description}
                          </p>
                        </div>
                        <span
                          className={`inline-flex rounded-full border px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] ${entry.tone}`}
                        >
                          {entry.status}
                        </span>
                      </div>
                      <p className="mt-3 text-xs font-medium text-slate-400">
                        {entry.date}
                      </p>
                    </article>
                  </div>
                ))}
              </div>
            </article>
          </div>

          <div className="space-y-5">
            <article className="rounded-3xl border border-amber-200/80 bg-[linear-gradient(135deg,#fffdf5_0%,#fff7ed_100%)] p-5 shadow-[0_12px_30px_rgba(15,23,42,0.05)]">
              <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-amber-700">
                Historique futur
              </p>
              <p className="mt-3 text-sm leading-6 text-slate-700">
                Les futures versions de Norixo AI enregistreront les événements
                importants des agents configuration, exécution, validation,
                publication et apprentissage. Cette interface est actuellement
                une prévisualisation en lecture seule.
              </p>
            </article>

            <article className="rounded-3xl border border-slate-200/80 bg-slate-50/70 p-5 shadow-[0_10px_24px_rgba(15,23,42,0.04)]">
              <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-400">
                États visibles
              </p>
              <div className="mt-4 flex flex-wrap gap-3">
                {[
                  "Information",
                  "En attente",
                  "Prévu",
                  "Non actif",
                  "Simulation",
                ].map((status) => (
                  <span
                    key={status}
                    className="inline-flex rounded-full border border-slate-200 bg-white px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-700"
                  >
                    {status}
                  </span>
                ))}
              </div>
            </article>
          </div>
        </div>
      </section>

      <section className="nk-card rounded-3xl border border-slate-200/80 bg-white p-6 shadow-[0_18px_48px_rgba(15,23,42,0.07),0_1px_0_rgba(255,255,255,0.75)_inset]">
        <div className="mb-5 border-b border-slate-200/70 pb-4">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
            Sécurité & garde-fous
          </p>
          <h2 className="mt-2 text-lg font-semibold tracking-tight text-slate-950">
            Architecture de protection prévue
          </h2>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            Cette section décrit les protections qui encadreront l’agent une
            fois activé, tout en restant aujourd’hui une présentation purement
            visuelle et passive.
          </p>
        </div>

        <div className="grid gap-5 xl:grid-cols-[1.05fr_0.95fr]">
          <div className="space-y-5">
            <article className="rounded-3xl border border-slate-200/80 bg-slate-50/70 p-5 shadow-[0_10px_24px_rgba(15,23,42,0.04)]">
              <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-400">
                État de sécurité
              </p>
              <div className="mt-4 space-y-3">
                {securityState.map((item) => (
                  <div
                    key={item.label}
                    className="flex flex-col gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <span className="text-sm font-semibold text-slate-800">
                      {item.label}
                    </span>
                    <span
                      className={`inline-flex rounded-full border px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] ${item.tone}`}
                    >
                      {item.value}
                    </span>
                  </div>
                ))}
              </div>
            </article>

            <article className="rounded-3xl border border-slate-200/80 bg-slate-50/70 p-5 shadow-[0_10px_24px_rgba(15,23,42,0.04)]">
              <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-400">
                Garde-fous prévus
              </p>
              <div className="mt-4 space-y-3">
                {plannedGuardrails.map((guardrail) => (
                  <div
                    key={guardrail}
                    className="flex flex-col gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="flex items-center gap-3">
                      <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-emerald-50 text-emerald-700 shadow-sm">
                        <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
                      </span>
                      <span className="text-sm font-semibold text-slate-800">
                        {guardrail}
                      </span>
                    </div>
                    <span className="inline-flex rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-emerald-700">
                      Prévu
                    </span>
                  </div>
                ))}
              </div>
            </article>
          </div>

          <div className="space-y-5">
            <article className="rounded-3xl border border-slate-200/80 bg-slate-50/70 p-5 shadow-[0_10px_24px_rgba(15,23,42,0.04)]">
              <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-400">
                Matrice de protection
              </p>
              <div className="mt-4 overflow-hidden rounded-3xl border border-slate-200 bg-white">
                <div className="grid grid-cols-[0.9fr_1.2fr_0.9fr] border-b border-slate-200 bg-slate-50 px-4 py-3 text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                  <span>Domaine</span>
                  <span>Protection prévue</span>
                  <span>État</span>
                </div>
                {protectionMatrix.map((row) => (
                  <div
                    key={row.domain}
                    className="grid grid-cols-[0.9fr_1.2fr_0.9fr] items-center gap-3 border-b border-slate-100 px-4 py-3 last:border-b-0"
                  >
                    <span className="text-sm font-semibold text-slate-900">
                      {row.domain}
                    </span>
                    <span className="text-sm text-slate-600">
                      {row.protection}
                    </span>
                    <span
                      className={`inline-flex w-fit rounded-full border px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] ${row.tone}`}
                    >
                      {row.status}
                    </span>
                  </div>
                ))}
              </div>
            </article>

            <article className="rounded-3xl border border-amber-200/80 bg-[linear-gradient(135deg,#fffdf5_0%,#fff7ed_100%)] p-5 shadow-[0_12px_30px_rgba(15,23,42,0.05)]">
              <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-amber-700">
                Architecture sécurisée
              </p>
              <p className="mt-3 text-sm leading-6 text-slate-700">
                Les futurs agents Norixo AI fonctionneront dans un environnement
                contrôlé. Les validations humaines, les permissions, les quotas
                et les contrôles qualité seront appliqués avant toute
                exécution. Cette page présente uniquement la future
                architecture de sécurité et n'active actuellement aucune
                fonctionnalité.
              </p>
            </article>
          </div>
        </div>
      </section>

      <section className="nk-card rounded-3xl border border-slate-200/80 bg-white p-6 shadow-[0_18px_48px_rgba(15,23,42,0.07),0_1px_0_rgba(255,255,255,0.75)_inset]">
        <div className="mb-5 border-b border-slate-200/70 pb-4">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
            Permissions & accès futur
          </p>
          <h2 className="mt-2 text-lg font-semibold tracking-tight text-slate-950">
            Gouvernance prévue de l'agent
          </h2>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            Cette section présente le futur modèle de rôles, d'autorisations et
            de validation de l’agent, sans implémenter le moindre contrôle
            réel.
          </p>
        </div>

        <div className="grid gap-5 xl:grid-cols-[1.1fr_0.9fr]">
          <div className="space-y-5">
            <article className="rounded-3xl border border-slate-200/80 bg-slate-50/70 p-5 shadow-[0_10px_24px_rgba(15,23,42,0.04)]">
              <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-400">
                Rôles futurs
              </p>
              <div className="mt-4 overflow-hidden rounded-3xl border border-slate-200 bg-white">
                <div className="grid grid-cols-[0.8fr_1.4fr_0.7fr] border-b border-slate-200 bg-slate-50 px-4 py-3 text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                  <span>Rôle</span>
                  <span>Description</span>
                  <span>État</span>
                </div>
                {futureRoles.map((item) => (
                  <div
                    key={item.role}
                    className="grid grid-cols-[0.8fr_1.4fr_0.7fr] items-center gap-3 border-b border-slate-100 px-4 py-3 last:border-b-0"
                  >
                    <span className="text-sm font-semibold text-slate-900">
                      {item.role}
                    </span>
                    <span className="text-sm text-slate-600">
                      {item.description}
                    </span>
                    <span className="inline-flex w-fit rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-emerald-700">
                      {item.status}
                    </span>
                  </div>
                ))}
              </div>
            </article>

            <article className="rounded-3xl border border-slate-200/80 bg-slate-50/70 p-5 shadow-[0_10px_24px_rgba(15,23,42,0.04)]">
              <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-400">
                Matrice des permissions
              </p>
              <div className="mt-4 overflow-x-auto rounded-3xl border border-slate-200 bg-white">
                <div className="min-w-[760px]">
                  <div className="grid grid-cols-[1.5fr_repeat(5,0.7fr)] border-b border-slate-200 bg-slate-50 px-4 py-3 text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                    <span>Action</span>
                    <span>Owner</span>
                    <span>Admin</span>
                    <span>Reviewer</span>
                    <span>Operator</span>
                    <span>Viewer</span>
                  </div>
                  {permissionMatrix.map((row) => (
                    <div
                      key={row.action}
                      className="grid grid-cols-[1.5fr_repeat(5,0.7fr)] items-center gap-3 border-b border-slate-100 px-4 py-3 last:border-b-0"
                    >
                      <span className="text-sm font-semibold text-slate-900">
                        {row.action}
                      </span>
                      <span className="text-center text-sm font-semibold text-slate-700">
                        {row.owner}
                      </span>
                      <span className="text-center text-sm font-semibold text-slate-700">
                        {row.admin}
                      </span>
                      <span className="text-center text-sm font-semibold text-slate-700">
                        {row.reviewer}
                      </span>
                      <span className="text-center text-sm font-semibold text-slate-700">
                        {row.operator}
                      </span>
                      <span className="text-center text-sm font-semibold text-slate-700">
                        {row.viewer}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </article>
          </div>

          <div className="space-y-5">
            <article className="rounded-3xl border border-slate-200/80 bg-slate-50/70 p-5 shadow-[0_10px_24px_rgba(15,23,42,0.04)]">
              <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-400">
                Workflow d'autorisation
              </p>
              <div className="mt-4 space-y-3">
                {authorizationFlow.map((step, index) => (
                  <div key={step} className="flex gap-4">
                    <div className="flex w-8 flex-col items-center">
                      <span className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-sky-200 bg-sky-50 text-[11px] font-semibold text-sky-700">
                        {index + 1}
                      </span>
                      {index < authorizationFlow.length - 1 ? (
                        <span className="mt-2 h-8 w-px bg-slate-200" />
                      ) : null}
                    </div>
                    <div className="flex flex-1 items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3">
                      <span className="text-sm font-semibold text-slate-800">
                        {step}
                      </span>
                      <span className="inline-flex rounded-full border border-sky-200 bg-sky-50 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-sky-700">
                        {index < 3 ? "Prévu" : "À venir"}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </article>

            <article className="rounded-3xl border border-slate-200/80 bg-slate-50/70 p-5 shadow-[0_10px_24px_rgba(15,23,42,0.04)]">
              <div className="mb-4 flex items-center justify-between gap-3">
                <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-400">
                  Restrictions actuelles
                </p>
                <span className="inline-flex rounded-full border border-slate-200 bg-white px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-700">
                  Lecture seule
                </span>
              </div>
              <div className="space-y-3">
                {[
                  "Toutes les permissions sont simulées.",
                  "Aucun rôle n'est réellement appliqué.",
                  "Aucun contrôle d'accès n'est actif.",
                  "Aucune exécution n'est autorisée.",
                  "Aucun changement n'est enregistré.",
                ].map((item) => (
                  <div
                    key={item}
                    className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-700"
                  >
                    {item}
                  </div>
                ))}
              </div>
            </article>

            <article className="rounded-3xl border border-amber-200/80 bg-[linear-gradient(135deg,#fffdf5_0%,#fff7ed_100%)] p-5 shadow-[0_12px_30px_rgba(15,23,42,0.05)]">
              <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-amber-700">
                Gouvernance future
              </p>
              <p className="mt-3 text-sm leading-6 text-slate-700">
                Les futures versions de Norixo AI intégreront un système
                complet de rôles, d'autorisations et de validations afin de
                sécuriser les actions réalisées par les agents. Cette interface
                présente uniquement la future organisation des accès et ne met
                actuellement en œuvre aucun contrôle réel.
              </p>
            </article>
          </div>
        </div>
      </section>

      <section className="nk-card rounded-3xl border border-slate-200/80 bg-white p-6 shadow-[0_18px_48px_rgba(15,23,42,0.07),0_1px_0_rgba(255,255,255,0.75)_inset]">
        <div className="mb-5 border-b border-slate-200/70 pb-4">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
            Plan d'activation futur
          </p>
          <h2 className="mt-2 text-lg font-semibold tracking-tight text-slate-950">
            Feuille de route avant activation réelle
          </h2>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            Cette section présente le parcours complet qui sera requis avant
            toute activation réelle de l’agent, tout en restant aujourd’hui
            une simple visualisation statique.
          </p>
        </div>

        <div className="grid gap-5 xl:grid-cols-[1.05fr_0.95fr]">
          <div className="space-y-5">
            <article className="rounded-3xl border border-slate-200/80 bg-slate-50/70 p-5 shadow-[0_10px_24px_rgba(15,23,42,0.04)]">
              <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-400">
                État global
              </p>
              <div className="mt-4 space-y-3">
                {activationOverview.map((item) => (
                  <div
                    key={item.label}
                    className="flex flex-col gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <span className="text-sm font-semibold text-slate-800">
                      {item.label}
                    </span>
                    <span
                      className={`inline-flex rounded-full border px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] ${item.tone}`}
                    >
                      {item.value}
                    </span>
                  </div>
                ))}
              </div>
            </article>

            <article className="rounded-3xl border border-slate-200/80 bg-slate-50/70 p-5 shadow-[0_10px_24px_rgba(15,23,42,0.04)]">
              <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-400">
                Feuille de route d'activation
              </p>
              <div className="mt-4 space-y-4">
                {activationRoadmap.map((step, index) => (
                  <div key={step.title} className="flex gap-4">
                    <div className="flex w-8 flex-col items-center">
                      <span className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-sky-200 bg-sky-50 text-[11px] font-semibold text-sky-700">
                        {index + 1}
                      </span>
                      {index < activationRoadmap.length - 1 ? (
                        <span className="mt-2 h-full min-h-10 w-px bg-slate-200" />
                      ) : null}
                    </div>
                    <article className="flex-1 rounded-3xl border border-slate-200 bg-white p-4 shadow-[0_12px_30px_rgba(15,23,42,0.05)]">
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                        <div>
                          <h3 className="text-sm font-semibold text-slate-950">
                            {step.title}
                          </h3>
                          <p className="mt-2 text-sm leading-6 text-slate-600">
                            {step.description}
                          </p>
                        </div>
                        <span className="inline-flex rounded-full border border-sky-200 bg-sky-50 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-sky-700">
                          {step.status}
                        </span>
                      </div>
                    </article>
                  </div>
                ))}
              </div>
            </article>
          </div>

          <div className="space-y-5">
            <article className="rounded-3xl border border-slate-200/80 bg-slate-50/70 p-5 shadow-[0_10px_24px_rgba(15,23,42,0.04)]">
              <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-400">
                Prérequis
              </p>
              <div className="mt-4 space-y-3">
                {activationPrerequisites.map((item) => (
                  <div
                    key={item}
                    className="flex flex-col gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="flex items-center gap-3">
                      <span className="inline-flex h-6 w-6 items-center justify-center rounded border border-slate-300 bg-slate-50 text-slate-400">
                        ☐
                      </span>
                      <span className="text-sm font-semibold text-slate-800">
                        {item}
                      </span>
                    </div>
                    <span className="inline-flex rounded-full border border-slate-200 bg-slate-100 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-700">
                      Non configuré
                    </span>
                  </div>
                ))}
              </div>
            </article>

            <article className="rounded-3xl border border-slate-200/80 bg-slate-50/70 p-5 shadow-[0_10px_24px_rgba(15,23,42,0.04)]">
              <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-400">
                Conditions d'activation
              </p>
              <div className="mt-4 space-y-3">
                {activationConditions.map((item) => (
                  <div
                    key={item}
                    className="flex flex-col gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <span className="text-sm font-semibold text-slate-800">
                      {item}
                    </span>
                    <span className="inline-flex rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-emerald-700">
                      Prévu
                    </span>
                  </div>
                ))}
              </div>
            </article>

            <article className="rounded-3xl border border-amber-200/80 bg-[linear-gradient(135deg,#fffdf5_0%,#fff7ed_100%)] p-5 shadow-[0_12px_30px_rgba(15,23,42,0.05)]">
              <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-amber-700">
                Activation progressive
              </p>
              <p className="mt-3 text-sm leading-6 text-slate-700">
                Les agents Norixo AI ne seront jamais activés directement en
                production. Chaque agent passera par une phase de configuration,
                de validation, de tests en environnement sécurisé, puis
                d'activation progressive sous supervision. Cette page présente
                uniquement la feuille de route de cette future activation.
              </p>
            </article>
          </div>
        </div>
      </section>

      <section className="nk-card rounded-3xl border border-slate-200/80 bg-white p-6 shadow-[0_18px_48px_rgba(15,23,42,0.07),0_1px_0_rgba(255,255,255,0.75)_inset]">
        <div className="mb-5 border-b border-slate-200/70 pb-4">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
            Paramètres futurs
          </p>
          <h2 className="mt-2 text-lg font-semibold tracking-tight text-slate-950">
            Configuration prévue
          </h2>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            Ces réglages seront activés dans une prochaine étape, sans logique
            opérationnelle pour l’instant.
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          {agent.futureSettings.map((setting) => (
            <article
              key={setting}
              className="rounded-3xl border border-slate-200/80 bg-slate-50/70 p-4 shadow-[0_10px_24px_rgba(15,23,42,0.04)]"
            >
              <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-400">
                Paramètre futur
              </p>
              <p className="mt-2 text-sm font-semibold text-slate-950">{setting}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="nk-card rounded-3xl border border-slate-200/80 bg-white p-6 shadow-[0_18px_48px_rgba(15,23,42,0.07),0_1px_0_rgba(255,255,255,0.75)_inset]">
        <div className="mb-5 border-b border-slate-200/70 pb-4">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
            Fonctionnalités prévues
          </p>
          <h2 className="mt-2 text-lg font-semibold tracking-tight text-slate-950">
            Capacités à venir
          </h2>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            Vue purement informative des évolutions prévues pour cet agent.
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {agent.plannedFeatures.map((feature) => (
            <article
              key={feature}
              className="rounded-3xl border border-slate-200/80 bg-[linear-gradient(180deg,#ffffff_0%,#f8fafc_100%)] p-4 shadow-[0_12px_30px_rgba(15,23,42,0.05)]"
            >
              <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-400">
                Fonctionnalité prévue
              </p>
              <p className="mt-2 text-sm leading-6 text-slate-700">{feature}</p>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}

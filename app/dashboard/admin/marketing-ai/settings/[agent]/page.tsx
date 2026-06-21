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

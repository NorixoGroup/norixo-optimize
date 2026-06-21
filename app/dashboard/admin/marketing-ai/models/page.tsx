import Link from "next/link";

const AI_MODELS = [
  { name: "GPT-5.5", category: "LLM", provider: "OpenAI", usage: "Stratégie, contenu, analyse", status: "Non connecté" },
  { name: "GPT-5.5 mini", category: "LLM", provider: "OpenAI", usage: "Tâches rapides et brouillons", status: "Non connecté" },
  { name: "Claude Sonnet", category: "LLM", provider: "Anthropic", usage: "Rédaction longue et QA", status: "Non connecté" },
  { name: "Claude Opus", category: "LLM", provider: "Anthropic", usage: "Raisonnement avancé", status: "Non connecté" },
  { name: "Gemini 2.5 Pro", category: "LLM", provider: "Google", usage: "Analyse multimodale future", status: "Non connecté" },
  { name: "Gemini Flash", category: "LLM", provider: "Google", usage: "Réponses rapides", status: "Non connecté" },
  { name: "Grok", category: "LLM", provider: "xAI", usage: "Veille et analyse temps réel future", status: "Non connecté" },
  { name: "GPT Image", category: "Image", provider: "OpenAI", usage: "Création visuelle marketing", status: "Simulation UI" },
  { name: "Stable Diffusion", category: "Image", provider: "Stability AI", usage: "Variantes visuelles", status: "Non connecté" },
  { name: "Flux", category: "Image", provider: "Black Forest Labs", usage: "Visuels haute qualité", status: "Non connecté" },
  { name: "Ideogram", category: "Image", provider: "Ideogram", usage: "Images avec texte", status: "Non connecté" },
  { name: "Veo", category: "Vidéo", provider: "Google", usage: "Vidéos génératives futures", status: "Non connecté" },
  { name: "Runway", category: "Vidéo", provider: "Runway", usage: "Montage et génération vidéo", status: "Non connecté" },
  { name: "Kling", category: "Vidéo", provider: "Kling AI", usage: "Clips promotionnels", status: "Non connecté" },
  { name: "Pika", category: "Vidéo", provider: "Pika", usage: "Vidéos courtes", status: "Non connecté" },
  { name: "Luma", category: "Vidéo", provider: "Luma AI", usage: "Séquences vidéo réalistes", status: "Non connecté" },
  { name: "OpenAI TTS", category: "Voix", provider: "OpenAI", usage: "Voix off multilingue", status: "Non connecté" },
  { name: "ElevenLabs", category: "Voix", provider: "ElevenLabs", usage: "Voix naturelles et narration", status: "Non connecté" },
];

const MODEL_SUMMARY = [
  { label: "LLM", value: String(AI_MODELS.filter((model) => model.category === "LLM").length) },
  { label: "Image", value: String(AI_MODELS.filter((model) => model.category === "Image").length) },
  { label: "Vidéo", value: String(AI_MODELS.filter((model) => model.category === "Vidéo").length) },
  { label: "Voix", value: String(AI_MODELS.filter((model) => model.category === "Voix").length) },
];

export default function MarketingAiModelsPage() {
  return (
    <div className="space-y-6 text-sm md:space-y-7">
      <section className="nk-card overflow-hidden rounded-3xl border border-slate-200/80 bg-[radial-gradient(circle_at_top_left,rgba(14,116,144,0.10),transparent_34%),radial-gradient(circle_at_90%_10%,rgba(2,132,199,0.10),transparent_28%),linear-gradient(135deg,#ffffff_0%,#f8fafc_52%,#ecfeff_100%)] p-6 shadow-[0_24px_70px_rgba(15,23,42,0.08),0_1px_0_rgba(255,255,255,0.75)_inset]">
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div className="max-w-3xl space-y-3">
            <p className="inline-flex rounded-full border border-sky-200/80 bg-white/85 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-sky-700 shadow-sm">
              Norixo AI
            </p>
            <h1 className="text-2xl font-semibold tracking-tight text-slate-950 md:text-3xl">
              Modèles IA
            </h1>
            <p className="text-sm leading-6 text-slate-600">
              Catalogue préparatoire des futurs modèles IA utilisables par les
              agents Norixo. Aucun modèle n'est actuellement appelé depuis cette
              interface.
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <Link
              href="/dashboard/admin/marketing-ai/providers"
              className="inline-flex w-fit items-center rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-slate-300 hover:bg-slate-50 hover:text-slate-950"
            >
              Connexions IA
            </Link>
            <Link
              href="/dashboard/admin/marketing-ai"
              className="inline-flex w-fit items-center rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-slate-300 hover:bg-slate-50 hover:text-slate-950"
            >
              Retour Norixo AI
            </Link>
          </div>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {MODEL_SUMMARY.map((item) => (
          <article
            key={item.label}
            className="nk-card rounded-3xl border border-slate-200/80 bg-white p-5 shadow-[0_16px_42px_rgba(15,23,42,0.06),0_1px_0_rgba(255,255,255,0.72)_inset]"
          >
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
              {item.label}
            </p>
            <p className="mt-3 text-lg font-semibold tracking-tight text-slate-950">
              {item.value}
            </p>
          </article>
        ))}
      </section>

      <section className="nk-card rounded-3xl border border-slate-200/80 bg-white p-6 shadow-[0_18px_48px_rgba(15,23,42,0.07),0_1px_0_rgba(255,255,255,0.75)_inset]">
        <div className="mb-5 border-b border-slate-200/70 pb-4">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
            Catalogue modèles
          </p>
          <h2 className="mt-2 text-lg font-semibold tracking-tight text-slate-950">
            Modèles prévus par catégorie
          </h2>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            Cette liste prépare les futurs choix de modèles pour les agents
            contenu, image, vidéo, voix, analytics et learning. Toutes les
            valeurs sont statiques.
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {AI_MODELS.map((model) => (
            <article
              key={`${model.provider}-${model.name}`}
              className="rounded-3xl border border-slate-200/80 bg-[linear-gradient(180deg,#ffffff_0%,#f8fafc_100%)] p-5 shadow-sm"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-base font-semibold text-slate-950">
                    {model.name}
                  </p>
                  <p className="mt-1 text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                    {model.category}
                  </p>
                </div>
                <span className="inline-flex rounded-full border border-slate-200 bg-slate-100 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-700">
                  {model.status}
                </span>
              </div>

              <div className="mt-4 space-y-3">
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">
                    Provider
                  </p>
                  <p className="mt-1 text-sm font-semibold text-slate-800">
                    {model.provider}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">
                    Usage prévu
                  </p>
                  <p className="mt-1 text-sm leading-6 text-slate-600">
                    {model.usage}
                  </p>
                </div>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="rounded-3xl border border-sky-100 bg-sky-50/70 p-5">
        <p className="text-sm font-semibold text-slate-950">
          Catalogue passif
        </p>
        <p className="mt-2 text-sm leading-6 text-slate-700">
          Les modèles affichés constituent le futur catalogue IA de Norixo.
          Aucun modèle n'est actuellement utilisé, aucune requête IA n'est
          exécutée et aucune clé provider n'est lue depuis cette page.
        </p>
      </section>
    </div>
  );
}

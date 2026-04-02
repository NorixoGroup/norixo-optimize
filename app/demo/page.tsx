import Link from "next/link";
import { MarketingPageShell } from "@/components/marketing/MarketingPageShell";

export default function DemoPage() {
  return (
    <MarketingPageShell>
      <main className="nk-section space-y-16 md:space-y-20">
      {/* Demo hero */}
      <section className="relative overflow-hidden rounded-[32px] border border-white/50 bg-[linear-gradient(180deg,rgba(255,255,255,0.98)_0%,rgba(248,250,252,0.96)_100%)] p-8 md:p-10 xl:p-12 shadow-[0_24px_80px_rgba(15,23,42,0.10)] backdrop-blur-[4px] md:grid md:grid-cols-2 md:items-center md:gap-10">
        <div className="space-y-6">
          <p className="text-[12px] font-semibold uppercase tracking-[0.22em] text-orange-500">Démo produit</p>
          <h1 className="max-w-4xl text-5xl font-semibold tracking-[-0.045em] leading-[0.92] text-slate-950 drop-shadow-[0_1px_0_rgba(255,255,255,0.4)] [text-wrap:balance] sm:text-6xl xl:text-7xl">
            Découvrez comment fonctionne un
            {" "}
            <span className="bg-gradient-to-r from-orange-500 via-amber-400 to-lime-400 bg-clip-text text-transparent">
              audit d’annonce.
            </span>
          </h1>
          <p className="max-w-3xl text-[18px] leading-8 text-slate-600">
            Découvrez comment Listing Conversion Optimizer analyse une annonce de location courte durée et
            identifie des leviers concrets pour améliorer la conversion et les réservations.
          </p>
          <div className="mt-6 flex flex-wrap items-center gap-4">
            <Link
              href="/dashboard/listings/new"
              className="rounded-2xl bg-orange-500 px-5 py-2.5 text-xs font-semibold uppercase tracking-[0.18em] text-slate-950 shadow-[0_12px_30px_rgba(249,115,22,0.22)] transition-all duration-200 hover:-translate-y-[1px] hover:bg-orange-400"
            >
              Lancer votre premier audit
            </Link>
            <Link
              href="/dashboard"
              className="rounded-2xl border border-slate-200 bg-white px-5 py-2.5 text-xs font-semibold uppercase tracking-[0.18em] text-slate-700 shadow-[0_8px_24px_rgba(15,23,42,0.06)] transition-all duration-200 hover:-translate-y-[1px] hover:bg-slate-50"
            >
              Accéder au tableau de bord
            </Link>
          </div>
        </div>

        <div className="mt-8 md:mt-0">
          <div className="rounded-3xl border border-slate-100 bg-white/80 p-5 md:p-6 shadow-[0_18px_60px_rgba(15,23,42,0.10)]">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
              Aperçu du rapport
            </p>
            <div className="mt-4 flex items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-[0_10px_30px_rgba(15,23,42,0.05)] ring-1 ring-emerald-200/60">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-emerald-600">
                  Score global
                </p>
                <p className="mt-1 text-[44px] font-semibold tracking-[-0.04em] text-slate-950">
                  8.4<span className="text-base text-emerald-500"> / 10</span>
                </p>
              </div>
              <div className="rounded-full border border-emerald-100 bg-emerald-50 px-3 py-1 text-[11px] font-medium text-emerald-700">
                +18% potentiel
              </div>
            </div>
            <p className="mt-1 text-xs text-slate-500">
              Influencé par vos visuels, texte et positionnement
            </p>

            <div className="mt-5 grid gap-3 text-xs text-slate-700 sm:grid-cols-3">
              <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-[0_10px_30px_rgba(15,23,42,0.05)]">
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                  Position marché
                </p>
                <p className="mt-1 text-sm font-semibold leading-6 text-slate-800">Compétitif</p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-[0_10px_30px_rgba(15,23,42,0.05)]">
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                  Potentiel estimé
                </p>
                <p className="mt-1 text-sm font-semibold leading-6 text-emerald-700">+12% à +18%</p>
              </div>
              <div className="rounded-2xl border border-emerald-200 bg-[linear-gradient(180deg,rgba(236,253,245,1)_0%,rgba(220,252,231,0.9)_100%)] p-4 shadow-[0_12px_30px_rgba(16,185,129,0.08)]">
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-600">
                  Revenu mensuel
                </p>
                <p className="mt-1 text-sm font-semibold leading-6 text-slate-900">+320&nbsp;€/mois</p>
              </div>
            </div>

            <div className="mt-4 rounded-2xl border border-slate-100 bg-white/80 p-3.5">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                Actions prioritaires
              </p>
              <ul className="mt-2 space-y-1.5 text-[11px] leading-5 text-slate-600">
                <li>• Améliorer la première photo pour mettre en avant l’atout clé.</li>
                <li>• Clarifier le titre pour cibler l’audience principale.</li>
                <li>• Renforcer les équipements mis en avant dans l’annonce.</li>
              </ul>
            </div>

            <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-emerald-50">
              <div className="h-full w-2/3 rounded-full bg-gradient-to-r from-emerald-400 via-sky-400 to-amber-300" />
            </div>
            <p className="mt-3 text-[11px] text-slate-400">
              Exemple de restitution produit.
            </p>
          </div>
        </div>
      </section>

      {/* Example listing analyzed + report preview */}
      <section className="space-y-6">
        <div className="flex flex-col justify-between rounded-[32px] border border-white/50 bg-[linear-gradient(180deg,rgba(255,255,255,0.98)_0%,rgba(248,250,252,0.96)_100%)] p-6 md:p-8 shadow-[0_24px_80px_rgba(15,23,42,0.10)] transition-all duration-200 hover:-translate-y-[1px] hover:shadow-[0_28px_90px_rgba(15,23,42,0.12)]">
          <div className="mb-6 flex items-start justify-between gap-4">
            <div className="space-y-2 max-w-[700px]">
              <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-400">
                Exemple d’annonce analysée
              </p>
              <h2 className="mt-2 text-[30px] md:text-[32px] font-semibold tracking-[-0.04em] leading-[1.02] text-slate-950">
                Riad avec rooftop et bassin plongé
              </h2>
              <p className="text-sm leading-6 text-slate-500">Marrakech · Médina · 2 chambres · 4 voyageurs</p>
              <p className="text-sm leading-6 text-slate-500">110&nbsp;€ / nuit · Annulation flexible</p>
              <div className="mt-3 flex flex-wrap gap-2 text-[11px]">
                <span className="inline-flex items-center rounded-full border border-amber-100 bg-amber-50 px-2.5 py-1 font-medium text-amber-700">
                  Photo principale faible
                </span>
                <span className="inline-flex items-center rounded-full border border-sky-100 bg-sky-50 px-2.5 py-1 font-medium text-sky-700">
                  Titre trop générique
                </span>
                <span className="inline-flex items-center rounded-full border border-emerald-100 bg-emerald-50 px-2.5 py-1 font-medium text-emerald-700">
                  Potentiel d’optimisation élevé
                </span>
              </div>
            </div>
            <div className="flex flex-col items-end gap-2">
              <span className="inline-flex items-center rounded-full border border-red-100 bg-red-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-red-500">
                Airbnb
              </span>
              <div className="flex items-center gap-1 text-sm font-medium text-amber-500">
                <span>4.7</span>
                <span className="text-xs text-slate-500">(128 avis)</span>
              </div>
              <p className="mt-1 text-[11px] text-slate-500">Annonce réelle type avant optimisation.</p>
            </div>
          </div>

          <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_10px_30px_rgba(15,23,42,0.06)]">
            
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
              Priorités d’optimisation
            </p>

            <h3 className="mt-1 text-lg font-semibold text-slate-900">
              Top 3 actions pour augmenter vos réservations
            </h3>

            <div className="mt-4 grid gap-3 md:grid-cols-3">
              
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                <p className="text-xs font-semibold text-amber-600">
                  1. Photo principale
                </p>
                <p className="mt-1 text-sm text-slate-700">
                  Mettre en avant la terrasse dès la première image
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  +12 à +18% de clics
                </p>
              </div>

              <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                <p className="text-xs font-semibold text-emerald-600">
                  2. Description
                </p>
                <p className="mt-1 text-sm text-slate-700">
                  Clarifier la promesse dès les premières lignes
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  +5 à +12% de conversion
                </p>
              </div>

              <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                <p className="text-xs font-semibold text-sky-600">
                  3. Réassurance
                </p>
                <p className="mt-1 text-sm text-slate-700">
                  Ajouter des éléments de confiance visibles
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  +3 à +8% de réservations
                </p>
              </div>

            </div>
            <div className="mt-4 rounded-2xl border border-emerald-300 bg-gradient-to-r from-emerald-50 to-emerald-100 p-5 shadow-[0_12px_40px_rgba(16,185,129,0.15)]">
              
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-emerald-700">
                Gain estimé après optimisation
              </p>

              <div className="mt-1 flex items-end justify-between">
                <p className="text-3xl md:text-4xl font-semibold tracking-[-0.02em] text-emerald-900">
                  +18% à +32% de réservations
                </p>
                <span className="ml-2 rounded-full bg-emerald-600/10 px-2 py-0.5 text-xs font-medium text-emerald-700">
                  estimé
                </span>
              </div>

              <p className="mt-1 text-sm leading-6 text-emerald-900/80">
                Basé sur des annonces similaires optimisées dans votre marché.
              </p>

            </div>
          </div>

          <div className="mt-5">
            <div className="relative w-full p-2 md:p-3">
              <div className="flex flex-col gap-4 md:grid md:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)] md:gap-5 md:items-start">
                {/* Colonne gauche : photo principale */}
                <div className="relative flex flex-col gap-5">
                  <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_8px_24px_rgba(15,23,42,0.05)]">
                  <div className="flex items-center justify-between gap-3 border-b border-slate-200/70 bg-white/80 px-3 py-2">
                    <div className="flex items-center gap-2">
                      <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                        Photo principale analysée
                      </p>
                      <span className="hidden rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[9px] font-medium uppercase tracking-[0.18em] text-slate-500 sm:inline-flex">
                        Avant optimisation
                      </span>
                    </div>
                    <span className="inline-flex items-center rounded-full border border-amber-100 bg-amber-50 px-2 py-0.5 text-[10px] font-medium text-amber-700">
                      Première impression faible
                    </span>
                  </div>
                  <div className="relative h-36 w-full bg-[radial-gradient(circle_at_0_0,rgba(148,163,184,0.18),transparent_55%),radial-gradient(circle_at_100%_100%,rgba(59,130,246,0.20),transparent_55%)] sm:h-48">
                    {/* Mock de photo analysée */}
                    <div className="absolute inset-3 overflow-hidden rounded-xl border border-white/35 bg-[radial-gradient(circle_at_18%_0,rgba(248,250,252,0.96),transparent_55%),radial-gradient(circle_at_85%_100%,rgba(15,23,42,0.9),transparent_60%)] shadow-[0_18px_45px_rgba(15,23,42,0.32)]">
                      <div className="absolute inset-0 bg-[linear-gradient(135deg,rgba(15,23,42,0.33),rgba(15,23,42,0.14))] mix-blend-multiply opacity-70" />
                      <div className="absolute inset-0 bg-[radial-gradient(circle_at_0_100%,rgba(15,23,42,0.26),transparent_60%)] opacity-85" />
                      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_0,rgba(15,23,42,0.15),transparent_55%)] opacity-60" />

                      {/* Volumes principaux de la pièce (mock visuel) */}
                      <div className="absolute left-6 top-6 h-14 w-28 rounded-2xl bg-white/14 shadow-[0_20px_36px_rgba(15,23,42,0.55)] backdrop-blur-[1.5px]" />
                      <div className="absolute left-6 bottom-6 h-10 w-24 rounded-xl bg-white/10 shadow-[0_18px_30px_rgba(15,23,42,0.5)] backdrop-blur-[1.5px]" />
                      <div className="absolute right-10 bottom-7 h-12 w-28 rounded-2xl bg-emerald-200/20 shadow-[0_20px_36px_rgba(15,23,42,0.55)] backdrop-blur-[1.5px]" />

                      {/* Heatmap / focus discret sur la zone basse */}
                      <div className="pointer-events-none absolute bottom-[-8px] left-1/2 h-14 w-40 -translate-x-1/2 rounded-full bg-[radial-gradient(circle_at_50%_100%,rgba(251,191,36,0.45),transparent_68%)] opacity-55 mix-blend-screen" />
                      <div className="pointer-events-none absolute inset-x-10 bottom-7 h-px bg-gradient-to-r from-transparent via-white/45 to-transparent opacity-70" />

                      {/* Voile d'analyse "avant" */}
                      <div className="absolute inset-0 bg-gradient-to-t from-slate-900/26 via-slate-900/8 to-slate-900/0" />
                    </div>

                    {/* Badge flottant Avant optimisation */}
                    <div className="absolute left-6 top-4 inline-flex items-center gap-1 rounded-full bg-slate-900/70 px-2 py-0.5 text-[9px] font-medium uppercase tracking-[0.18em] text-slate-50 shadow-[0_10px_28px_rgba(15,23,42,0.65)]">
                      <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />
                      Avant optimisation
                    </div>

                    {/* Markers visuels sur la photo */}
                    <div className="absolute left-10 top-10 flex items-center gap-2">
                      <span className="h-2 w-2 rounded-full bg-amber-500 shadow-[0_0_0_4px_rgba(251,191,36,0.45)]" />
                      <div className="rounded-full border border-amber-100 bg-amber-50/95 px-2 py-0.5 text-[10px] font-medium text-amber-800 shadow-[0_10px_26px_rgba(15,23,42,0.25)]">
                        Terrasse peu visible
                      </div>
                    </div>
                    <div className="absolute right-8 top-1/2 flex -translate-y-1/2 items-center gap-2">
                      <div className="rounded-full border border-slate-200 bg-white/92 px-2 py-0.5 text-[10px] text-slate-700 shadow-[0_10px_26px_rgba(15,23,42,0.22)]">
                        Atout clé absent du premier écran
                      </div>
                      <span className="h-2 w-2 rounded-full bg-slate-500 shadow-[0_0_0_4px_rgba(148,163,184,0.45)]" />
                    </div>
                    <div className="absolute left-12 bottom-9 flex items-center gap-2">
                      <span className="h-2 w-2 rounded-full bg-sky-500 shadow-[0_0_0_4px_rgba(56,189,248,0.40)]" />
                      <div className="rounded-full border border-sky-100 bg-sky-50/95 px-2 py-0.5 text-[10px] text-sky-800 shadow-[0_10px_26px_rgba(15,23,42,0.22)]">
                        Cadrage peu différenciant
                      </div>
                    </div>

                    {/* Bandeau d’analyse compact en bas */}
                    <div className="absolute bottom-3 left-3 right-3 rounded-2xl border border-white/70 bg-white/92 px-3 py-2 text-[10px] text-slate-700 shadow-[0_10px_26px_rgba(15,23,42,0.22)] backdrop-blur-md md:left-1/2 md:right-auto md:w-[82%] md:-translate-x-1/2 md:items-start md:justify-between md:gap-3 md:px-4 md:py-2.5 md:flex">
                      <div className="md:flex-[0.9]">
                        <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                          Lecture de la première impression
                        </p>
                        <div className="mt-1 grid grid-cols-1 gap-1.5 sm:grid-cols-2">
                          <div>
                            <p className="text-[10px] font-medium text-slate-600">
                              Ce qui capte l’attention
                            </p>
                            <div className="mt-0.5 flex flex-wrap gap-1.5">
                              <span className="inline-flex items-center rounded-full bg-slate-100 px-2 py-[2px] text-xs text-slate-600">
                                Salon
                              </span>
                              <span className="inline-flex items-center rounded-full bg-slate-100 px-2 py-[2px] text-xs text-slate-600">
                                Lit
                              </span>
                              <span className="inline-flex items-center rounded-full bg-slate-100 px-2 py-[2px] text-xs text-slate-600">
                                Lumière
                              </span>
                            </div>
                          </div>
                          <div>
                            <p className="text-[10px] font-medium text-amber-700">
                              Ce qui manque
                            </p>
                            <div className="mt-0.5 flex flex-wrap gap-1.5">
                              <span className="inline-flex items-center rounded-full bg-slate-100 px-2 py-[2px] text-xs text-slate-600">
                                Terrasse
                              </span>
                              <span className="inline-flex items-center rounded-full bg-slate-100 px-2 py-[2px] text-xs text-slate-600">
                                Rooftop
                              </span>
                              <span className="inline-flex items-center rounded-full bg-slate-100 px-2 py-[2px] text-xs text-slate-600">
                                Bassin
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="mt-1.5 md:mt-0 md:flex-1 md:max-w-[42%]">
                        <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                          Impact sur la conversion
                        </p>
                        <p className="mt-0.5 text-[10px] leading-4 text-slate-600">
                          La promesse reste peu lisible&nbsp;: le visuel rassure sur l’ambiance, mais ne fait pas ressortir l’atout clé dès le premier écran.
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between gap-3 border-t border-slate-100/70 bg-gradient-to-r from-white/95 via-white/85 to-white/0 px-3.5 py-1.5 text-[10px] text-slate-600 backdrop-blur-sm">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                        Éléments visibles en premier
                      </span>
                      <span className="inline-flex items-center rounded-full bg-slate-100 px-2 py-[2px] text-xs text-slate-600">
                        Salon
                      </span>
                      <span className="inline-flex items-center rounded-full bg-slate-100 px-2 py-[2px] text-xs text-slate-600">
                        Lit
                      </span>
                      <span className="inline-flex items-center rounded-full bg-slate-100 px-2 py-[2px] text-xs text-slate-600">
                        Lumière
                      </span>
                    </div>
                    <span className="hidden text-[10px] text-slate-400 sm:inline">
                      La terrasse n’apparaît qu’en second plan.
                    </span>
                  </div>
                  </div>
                  <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-[0_8px_24px_rgba(15,23,42,0.05)]">
                    <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                      Pourquoi ça bloque
                    </p>
                    <p className="text-sm leading-6 text-slate-700">
                      Les utilisateurs prennent une décision en quelques secondes. Ici, l’image met en avant un espace neutre au lieu de l’atout principal (terrasse / rooftop).
                    </p>
                    <p className="mt-3 inline-flex items-center gap-2 text-sm font-medium text-amber-700">
                      <span className="h-4 w-1 rounded bg-amber-500" />
                      <span>→ Résultat : moins de clics, moins de réservations.</span>
                    </p>
                  </div>
                  <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-[0_8px_24px_rgba(15,23,42,0.05)]">
                    <div className="flex items-center justify-between">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                        Impact visuel
                      </p>
                      <span className="text-sm font-semibold text-amber-600">
                        Faible
                      </span>
                    </div>

                    <div className="mt-3 h-2 w-full rounded-full bg-slate-100 overflow-hidden">
                      <div className="h-full w-[35%] rounded-full bg-gradient-to-r from-amber-400 to-orange-500" />
                    </div>

                    <p className="mt-3 text-sm leading-6 text-slate-700">
                      Le visuel ne met pas en avant votre atout principal dès les premières secondes.
                    </p>
                    <p className="mt-2 text-xs text-slate-500">
                      Impact direct sur votre score global
                    </p>
                    <p className="mt-2 text-xs text-slate-500">
                      ↳ Estimation : -12 à -18% de clics
                    </p>
                  </div>
                </div>

                {/* Colonne droite : cartes d’analyse */}
                <div className="space-y-3 text-xs text-slate-700">
                  <div className="rounded-2xl border border-slate-200 bg-white p-3 shadow-[0_10px_26px_rgba(15,23,42,0.04)]">
                    <div className="flex items-center justify-between">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                        Titre (impact direct)
                      </p>
                      <span className="text-[11px] font-semibold text-slate-400">
                        Priorité élevée
                      </span>
                    </div>
                    <p className="mt-1 text-[15px] leading-7 text-slate-800">
                      Charmant riad à Marrakech avec rooftop et bassin.
                    </p>
                    <p className="mt-3 inline-flex items-start gap-2 text-[13px] font-medium text-amber-700">
                      <span className="h-4 w-1 rounded bg-amber-500" />
                      <span>Ne précise ni pour qui le lieu est idéal ni l’atout principal.</span>
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      ↳ Impact estimé : +5 à +12% de clics
                    </p>
                    <p className="mt-2 text-xs font-medium text-slate-400">
                      Action recommandée
                    </p>
                  </div>

                  <div className="rounded-2xl border border-slate-200 bg-white p-3 shadow-[0_10px_26px_rgba(15,23,42,0.04)]">
                    <div className="flex items-center justify-between">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                        Description (conversion)
                      </p>
                      <span className="text-[11px] font-semibold text-slate-400">
                        Priorité élevée
                      </span>
                    </div>
                    <p className="mt-1 text-[15px] leading-7 text-slate-800 line-clamp-2">
                      Texte chaleureux mais générique qui ne met pas assez rapidement en avant les bénéfices concrets pour les voyageurs.
                    </p>
                    <p className="mt-3 inline-flex items-start gap-2 text-[13px] font-medium text-emerald-700">
                      <span className="h-4 w-1 rounded bg-emerald-500" />
                      <span>Gros levier pour clarifier la promesse et accélérer la décision.</span>
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      ↳ Impact estimé : +5 à +12% de clics
                    </p>
                    <p className="mt-2 text-xs font-medium text-slate-400">
                      Action recommandée
                    </p>
                  </div>

                  <div className="rounded-2xl border border-slate-200 bg-white p-3 shadow-[0_10px_26px_rgba(15,23,42,0.04)]">
                    <div className="flex items-center justify-between">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                        Équipements (différenciation)
                      </p>
                      <span className="text-[11px] font-semibold text-slate-400">
                        Priorité moyenne
                      </span>
                    </div>
                    <p className="mt-1 text-[15px] leading-7 text-slate-800">
                      Plusieurs équipements différenciants n’apparaissent pas dans les premiers éléments consultés.
                    </p>
                    <p className="mt-3 inline-flex items-start gap-2 text-[13px] font-medium text-slate-700">
                      <span className="h-4 w-1 rounded bg-slate-400" />
                      <span>Impacte la perception de valeur face aux annonces concurrentes.</span>
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      ↳ Impact estimé : +5 à +12% de clics
                    </p>
                    <p className="mt-2 text-xs font-medium text-slate-400">
                      Action recommandée
                    </p>
                  </div>

                  <div className="rounded-2xl border border-slate-200 bg-white p-3 shadow-[0_10px_26px_rgba(15,23,42,0.04)]">
                    <div className="flex items-center justify-between">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                        Réassurance (confiance client)
                      </p>
                      <span className="text-[11px] font-semibold text-slate-400">
                        Priorité moyenne
                      </span>
                    </div>
                    <p className="mt-1 text-[15px] leading-7 text-slate-800">
                      Peu de signaux clairs sur le niveau de service, la propreté ou la facilité d’arrivée.
                    </p>
                    <p className="mt-3 inline-flex items-start gap-2 text-[13px] font-medium text-sky-700">
                      <span className="h-4 w-1 rounded bg-sky-500" />
                      <span>À renforcer pour réduire l’hésitation avant réservation.</span>
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      ↳ Impact estimé : +5 à +12% de clics
                    </p>
                    <p className="mt-2 text-xs font-medium text-slate-400">
                      Action recommandée
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* After optimization projection */}
        <section className="rounded-[32px] border border-white/50 bg-[linear-gradient(180deg,rgba(255,255,255,0.98)_0%,rgba(248,250,252,0.96)_100%)] p-6 md:p-8 shadow-[0_24px_80px_rgba(15,23,42,0.10)]">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
            APRÈS OPTIMISATION
          </p>
          <h3 className="mt-2 max-w-3xl text-lg font-semibold leading-7 text-slate-900 md:text-xl">
            Voici à quoi votre annonce peut ressembler après ajustements
          </h3>

          <div className="mt-6 grid gap-6 md:grid-cols-2 md:items-start">
            {/* Colonne gauche : visuel amélioré */}
            <div className="rounded-2xl border border-slate-200 bg-white p-4 md:p-5 shadow-[0_12px_30px_rgba(15,23,42,0.06)]">
              <div className="flex items-center justify-between gap-3">
                <span className="inline-flex items-center rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-emerald-700">
                  APRÈS OPTIMISATION
                </span>
                <span className="inline-flex items-center rounded-full border border-emerald-100 bg-emerald-50 px-2.5 py-1 text-[11px] font-medium text-emerald-700">
                  Terrasse visible dès le premier écran
                </span>
              </div>

              <div className="mt-4 relative h-40 w-full overflow-hidden rounded-2xl border border-slate-100 bg-[radial-gradient(circle_at_0_0,rgba(16,185,129,0.12),transparent_55%),radial-gradient(circle_at_100%_100%,rgba(56,189,248,0.18),transparent_55%)] sm:h-48">
                <div className="absolute inset-3 rounded-2xl bg-[linear-gradient(135deg,rgba(15,23,42,0.06),rgba(15,23,42,0.22))] shadow-[0_18px_45px_rgba(15,23,42,0.25)]" />
                <div className="absolute inset-x-6 bottom-6 h-16 rounded-2xl border border-white/70 bg-white/95 px-3 py-2 text-[11px] text-slate-700 shadow-[0_12px_30px_rgba(15,23,42,0.18)] backdrop-blur-md flex items-center justify-between gap-3">
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                      Première impression
                    </p>
                    <p className="mt-0.5 text-[12px] font-medium text-slate-900">
                      Terrasse et bassin mis en avant dès la première image.
                    </p>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <span className="inline-flex items-center rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-medium text-emerald-700">
                      Atout principal visible
                    </span>
                    <span className="text-[10px] text-slate-500">
                      ↑ Taux de clics attendu
                    </span>
                  </div>
                </div>
              </div>

              <p className="mt-3 text-sm leading-6 text-slate-700">
                Le visuel met maintenant en avant l’atout principal dès les premières secondes.
              </p>
            </div>

            {/* Colonne droite : KPIs après optimisation */}
            <div className="space-y-4 text-sm text-slate-700">
              <div className="grid gap-3 sm:grid-cols-3">
                <div className="rounded-2xl border border-slate-200 bg-white p-3.5 shadow-[0_10px_26px_rgba(15,23,42,0.05)]">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                    Score global
                  </p>
                  <p className="mt-1 text-xl font-semibold tracking-[-0.04em] text-slate-900">
                    8.4<span className="text-sm text-emerald-500"> / 10</span>
                  </p>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-white p-3.5 shadow-[0_10px_26px_rgba(15,23,42,0.05)]">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                    Potentiel de conversion
                  </p>
                  <p className="mt-1 text-sm font-semibold leading-6 text-emerald-700">
                    Fort
                  </p>
                </div>
                <div className="rounded-2xl border border-emerald-200 bg-[linear-gradient(180deg,rgba(236,253,245,1)_0%,rgba(220,252,231,0.9)_100%)] p-3.5 shadow-[0_12px_30px_rgba(16,185,129,0.08)]">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-emerald-700">
                    Impact estimé
                  </p>
                  <p className="mt-1 text-sm font-semibold leading-6 text-slate-900">
                    +18% à +32%
                  </p>
                </div>
              </div>

              <div className="rounded-2xl border border-slate-100 bg-slate-50/80 p-4 text-[13px] leading-6 text-slate-600">
                Les principaux freins ont été corrigés&nbsp;: meilleure première impression, promesse plus claire,
                signaux de confiance plus visibles.
              </div>
            </div>
          </div>
        </section>

        {/* Audit report preview */}
        <div className="rounded-[32px] border border-white/50 bg-[linear-gradient(180deg,rgba(255,255,255,0.98)_0%,rgba(248,250,252,0.96)_100%)] p-6 md:p-8 shadow-[0_24px_80px_rgba(15,23,42,0.10)]">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Leviers d’optimisation détectés</p>
          <p className="mt-2 max-w-2xl text-sm text-slate-600">
            Synthèse structurée des leviers les plus impactants détectés sur cette annonce&nbsp;: ce qui freine la conversion aujourd’hui et où se situe le potentiel.
          </p>

          <div className="mt-6 grid gap-4 text-xs text-slate-600 sm:grid-cols-2 lg:grid-cols-4">
            <div className="flex h-full flex-col justify-between rounded-2xl border border-amber-100 bg-gradient-to-b from-amber-50/80 to-white p-4 shadow-[0_10px_30px_rgba(15,23,42,0.06)]">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                  Photos
                </p>
                <p className="mt-1 text-[13px] leading-5 text-slate-700">
                  La photo principale ne montre pas l’atout le plus différenciant du riad.
                </p>
              </div>
              <div className="mt-2 flex items-center justify-between gap-2">
                <span className="inline-flex items-center rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-amber-700">
                  Priorité élevée
                </span>
                <span className="text-[11px] text-slate-500">Impact direct sur la conversion</span>
              </div>
            </div>

            <div className="flex h-full flex-col justify-between rounded-2xl border border-sky-100 bg-gradient-to-b from-sky-50/70 to-white p-4 shadow-[0_10px_30px_rgba(15,23,42,0.06)]">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                  Texte
                </p>
                <p className="mt-1 text-[13px] leading-5 text-slate-700">
                  Le titre et le premier paragraphe n’expliquent pas assez vite pourquoi réserver ce logement.
                </p>
              </div>
              <div className="mt-2 flex items-center justify-between gap-2">
                <span className="inline-flex items-center rounded-full bg-sky-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-sky-700">
                  À renforcer
                </span>
                <span className="text-[11px] text-slate-500">Améliore la clarté de l’annonce</span>
              </div>
            </div>

            <div className="flex h-full flex-col justify-between rounded-2xl border border-emerald-100 bg-gradient-to-b from-emerald-50/70 to-white p-4 shadow-[0_10px_30px_rgba(15,23,42,0.06)]">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                  Équipements
                </p>
                <p className="mt-1 text-[13px] leading-5 text-slate-700">
                  Des équipements à forte valeur perçue ne sont pas suffisamment mis en avant dans les premiers éléments.
                </p>
              </div>
              <div className="mt-2 flex items-center justify-between gap-2">
                <span className="inline-flex items-center rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-emerald-700">
                  Bon levier
                </span>
                <span className="text-[11px] text-slate-500">Renforce la valeur perçue</span>
              </div>
            </div>

            <div className="flex h-full flex-col justify-between rounded-2xl border border-indigo-100 bg-gradient-to-b from-indigo-50/70 to-white p-4 shadow-[0_10px_30px_rgba(15,23,42,0.06)]">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                  Tarification
                </p>
                <p className="mt-1 text-[13px] leading-5 text-slate-700">
                  Le prix affiché peut être mieux aligné avec la valeur perçue et les comparables locaux.
                </p>
              </div>
              <div className="mt-2 flex items-center justify-between gap-2">
                <span className="inline-flex items-center rounded-full bg-indigo-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-indigo-700">
                  À ajuster
                </span>
                <span className="text-[11px] text-slate-500">Aide à mieux se positionner marché</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Key insights */}
      <section className="rounded-[32px] border border-white/50 bg-[linear-gradient(180deg,rgba(255,255,255,0.98)_0%,rgba(248,250,252,0.96)_100%)] p-8 md:p-10 shadow-[0_24px_80px_rgba(15,23,42,0.10)]">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Points clés détectés</p>
        <p className="mt-2 max-w-2xl text-sm text-slate-600">
          L’audit décompose votre annonce en leviers qui influencent réellement
          la conversion et la décision de réservation.
        </p>
        <div className="mt-8 grid gap-6 text-sm text-slate-700 md:grid-cols-2">
          <div className="flex h-full flex-col justify-between rounded-2xl border border-slate-100 bg-slate-50/80 p-5 shadow-[0_10px_30px_rgba(15,23,42,0.04)]">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
              Titre de l’annonce
            </p>
            <p className="mt-2 text-sm font-semibold text-slate-900">
              Le titre pourrait mieux mettre en avant les atouts clés et l’audience cible.
            </p>
            <p className="mt-1 text-[13px] leading-6 text-slate-600">
              Le titre actuel ne mentionne ni le rooftop ni le bassin et ne précise pas
              pour qui le lieu est idéal.
            </p>
          </div>
          <div className="flex h-full flex-col justify-between rounded-2xl border border-slate-100 bg-slate-50/80 p-5 shadow-[0_10px_30px_rgba(15,23,42,0.04)]">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
              Ordre des photos
            </p>
            <p className="mt-2 text-sm font-semibold text-slate-900">
              La première photo ne met pas en avant les pièces les plus fortes.
            </p>
            <p className="mt-1 text-[13px] leading-6 text-slate-600">
              Les premières images montrent des couloirs et des pièces secondaires
              au lieu de la terrasse et du bassin qui déclenchent les clics.
            </p>
          </div>
          <div className="flex h-full flex-col justify-between rounded-2xl border border-slate-100 bg-slate-50/80 p-5 shadow-[0_10px_30px_rgba(15,23,42,0.04)]">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
              Équipements vs. concurrents
            </p>
            <p className="mt-2 text-sm font-semibold text-slate-900">
              Équipements manquants par rapport aux concurrents locaux.
            </p>
            <p className="mt-1 text-[13px] leading-6 text-slate-600">
              Les annonces voisines à prix similaire mettent en avant Wi-Fi rapide,
              espace de travail et départ tardif, qui sont absents ici.
            </p>
          </div>
          <div className="flex h-full flex-col justify-between rounded-2xl border border-slate-100 bg-slate-50/80 p-5 shadow-[0_10px_30px_rgba(15,23,42,0.04)]">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
              Introduction de la description
            </p>
            <p className="mt-2 text-sm font-semibold text-slate-900">
              La description manque d’une accroche forte centrée sur le voyageur.
            </p>
            <p className="mt-1 text-[13px] leading-6 text-slate-600">
              Les premières lignes ne disent pas clairement pour qui est l’annonce,
              ce qui la rend unique ni pourquoi réserver maintenant.
            </p>
          </div>
        </div>
      </section>

      {/* Optimization recommendations */}
      <section className="rounded-[32px] border border-white/50 bg-[linear-gradient(180deg,rgba(255,255,255,0.98)_0%,rgba(248,250,252,0.96)_100%)] p-8 md:p-10 shadow-[0_24px_80px_rgba(15,23,42,0.10)]">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Recommandations d’optimisation</p>
        <p className="mt-2 max-w-2xl text-sm text-slate-600">
          Chaque audit s’accompagne d’une checklist priorisée d’actions concrètes
          à mettre en œuvre en une seule session.
        </p>
        <div className="mt-8 grid gap-6 text-sm text-slate-700 md:grid-cols-2">
          <div className="space-y-4 rounded-2xl border border-slate-100 bg-slate-50/80 p-5 shadow-[0_10px_30px_rgba(15,23,42,0.04)]">
            <div className="flex items-start gap-3">
              <span className="mt-0.5 inline-flex h-4 w-4 flex-shrink-0 items-center justify-center rounded border border-slate-300 text-[10px] text-slate-400">
                
              </span>
              <div>
                <p className="font-semibold text-slate-900">Améliorer la structure du titre</p>
                <p className="mt-1 text-[13px] leading-6 text-slate-600">
                  Inclure ville, atout principal et audience&nbsp;: par ex. «&nbsp;Riad à Marrakech avec
                  rooftop et bassin · idéal pour les couples&nbsp;».
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <span className="mt-0.5 inline-flex h-4 w-4 flex-shrink-0 items-center justify-center rounded border border-slate-300 text-[10px] text-slate-400">
                
              </span>
              <div>
                <p className="font-semibold text-slate-900">Réordonner les photos pour une meilleure première impression</p>
                <p className="mt-1 text-[13px] leading-6 text-slate-600">
                  Placer terrasse, bassin et pièce de vie principale dans les 3 premières photos,
                  en phase avec ce qui compte le plus pour les voyageurs.
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <span className="mt-0.5 inline-flex h-4 w-4 flex-shrink-0 items-center justify-center rounded border border-slate-300 text-[10px] text-slate-400">
                
              </span>
              <div>
                <p className="font-semibold text-slate-900">Ajouter les équipements manquants</p>
                <p className="mt-1 text-[13px] leading-6 text-slate-600">
                  Mettre en avant Wi-Fi rapide, espace de travail dédié et départ flexible si
                  disponibles, pour aligner avec les attentes locales.
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <span className="mt-0.5 inline-flex h-4 w-4 flex-shrink-0 items-center justify-center rounded border border-slate-300 text-[10px] text-slate-400">
                
              </span>
              <div>
                <p className="font-semibold text-slate-900">Renforcer le premier paragraphe de la description</p>
                <p className="mt-1 text-[13px] leading-6 text-slate-600">
                  Commencer par pour qui est le lieu, le bénéfice principal et ce qui
                  différencie ce riad des autres.
                </p>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-100 bg-slate-50/80 p-5 text-sm text-slate-700 shadow-[0_10px_30px_rgba(15,23,42,0.04)]">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
              Comment utiliser cette checklist
            </p>
            <p className="mt-2 text-[13px] leading-6 text-slate-600">
              La plupart des hôtes peuvent appliquer les 3 recommandations principales en
              moins d’une heure. L’objectif est d’expédier rapidement des améliorations
              significatives, pas de réécrire toute votre annonce.
            </p>
            <p className="mt-3 text-[13px] leading-6 text-slate-600">
              Vous gardez le contrôle&nbsp;: rien n’est modifié automatiquement. LCO vous
              donne le plan d’action&nbsp;; vous décidez quoi appliquer sur Airbnb,
              Booking.com ou VRBO.
            </p>
          </div>
        </div>
      </section>

      {/* Estimated performance improvement */}
      <section className="rounded-[32px] border border-white/50 bg-[linear-gradient(180deg,rgba(255,255,255,0.98)_0%,rgba(248,250,252,0.96)_100%)] p-8 md:p-10 shadow-[0_24px_80px_rgba(15,23,42,0.10)]">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Amélioration estimée des performances</p>
        <div className="mt-8 grid gap-6 text-sm text-slate-700 md:grid-cols-3">
          <div className="flex h-full flex-col justify-between rounded-2xl border border-emerald-100 bg-[linear-gradient(180deg,#f0fdf4_0%,#ecfdf5_100%)] p-5 shadow-[0_16px_40px_rgba(15,23,42,0.08)]">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-700">
              Hausse de conversion
            </p>
            <p className="mt-2 text-xl font-semibold text-emerald-800">Réservations +15–25&nbsp;%</p>
            <p className="mt-1 text-[13px] leading-6 text-emerald-700">
              Fourchette d’amélioration typique observée après application des
              recommandations à fort impact sur des annonces similaires.
            </p>
          </div>
          <div className="flex h-full flex-col justify-between rounded-2xl border border-slate-100 bg-white/90 p-5 shadow-[0_16px_40px_rgba(15,23,42,0.08)]">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
              Compétitivité de l’annonce
            </p>
            <p className="mt-2 text-sm font-semibold text-slate-900">Passer d’un niveau moyen à un niveau supérieur.</p>
            <p className="mt-1 text-[13px] leading-6 text-slate-600">
              En comblant l’écart sur les photos, les équipements et le message,
              votre annonce devient un choix plus sûr dans les résultats de recherche.
            </p>
          </div>
          <div className="flex h-full flex-col justify-between rounded-2xl border border-slate-100 bg-white/90 p-5 shadow-[0_16px_40px_rgba(15,23,42,0.08)]">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
              Vitesse de décision
            </p>
            <p className="mt-2 text-sm font-semibold text-slate-900">Savoir exactement quoi corriger en premier.</p>
            <p className="mt-1 text-[13px] leading-6 text-slate-600">
              Au lieu de deviner, vous obtenez une liste claire et classée
              des opportunités par impact.
            </p>
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="flex flex-col gap-6 rounded-[32px] border border-white/50 bg-[linear-gradient(180deg,rgba(255,255,255,0.98)_0%,rgba(248,250,252,0.96)_100%)] p-8 md:flex-row md:items-center md:justify-between md:p-10 shadow-[0_24px_80px_rgba(15,23,42,0.10)]">
        <div className="max-w-xl">
          <h2 className="text-2xl font-semibold leading-tight text-slate-900 md:text-3xl lg:text-4xl">
            Prêt à analyser votre propre annonce ?
          </h2>
          <p className="mt-3 text-[15px] leading-7 text-slate-600">
            Collez une URL, lancez votre premier audit propulsé par l’IA et transformez
            des visiteurs hésitants en réservations confirmées.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-4 md:justify-end">
          <Link
            href="/dashboard/listings/new"
            className="rounded-2xl bg-orange-500 px-5 py-2.5 text-xs font-semibold uppercase tracking-[0.18em] text-slate-950 shadow-[0_12px_30px_rgba(249,115,22,0.22)] transition-all duration-200 hover:-translate-y-[1px] hover:bg-orange-400"
          >
            Lancer votre premier audit
          </Link>
          <Link
            href="/sign-up"
            className="rounded-2xl border border-slate-200 bg-white px-5 py-2.5 text-xs font-semibold uppercase tracking-[0.18em] text-slate-700 shadow-[0_8px_24px_rgba(15,23,42,0.06)] transition-all duration-200 hover:-translate-y-[1px] hover:bg-slate-50"
          >
            Créer un compte
          </Link>
        </div>
      </section>
      </main>
    </MarketingPageShell>
  );
}

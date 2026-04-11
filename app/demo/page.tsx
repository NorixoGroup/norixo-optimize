import Link from "next/link";
import { MarketingPageShell } from "@/components/marketing/MarketingPageShell";
import { HeroTitle, SectionLabel, SectionTitle, SectionDescription, KpiGrid, MobileCenteredBlock } from "@/components/ui";

export default function DemoPage() {
  return (
    <MarketingPageShell>
      <main className="nk-section space-y-10 md:space-y-12">
      {/* Demo hero */}
      <section className="relative overflow-hidden rounded-[28px] nk-border bg-[radial-gradient(circle_at_0_0,rgba(251,146,60,0.10),transparent_60%),radial-gradient(circle_at_100%_100%,rgba(16,185,129,0.10),transparent_55%),linear-gradient(180deg,rgba(255,255,255,0.99)_0%,rgba(248,250,252,0.98)_100%)] px-5 py-6 md:p-7 xl:p-8 nk-card-lg backdrop-blur-[4px] md:grid md:grid-cols-2 md:items-center md:gap-10">
        <div className="max-w-xl space-y-4 md:space-y-5">
          <SectionLabel className="text-orange-500">DÉMO PRODUIT</SectionLabel>
          <HeroTitle className="mt-1 text-left [text-wrap:balance] drop-shadow-[0_1px_0_rgba(255,255,255,0.5)]">
            Découvrez comment Norixo Optimize révèle ce qui bloque une annonce.
          </HeroTitle>
          <SectionDescription className="mt-2 max-w-xl text-[14px] leading-7 text-slate-600 md:text-[15px]">
            Explorez un exemple de rapport, visualisez les priorités détectées et voyez comment une annonce peut évoluer
            après recommandations.
          </SectionDescription>
          <div className="mt-5 flex flex-wrap items-center gap-4">
            <Link
              href="/audit/new"
              className="rounded-2xl bg-orange-500 px-5 py-2.5 text-xs font-semibold uppercase tracking-[0.18em] text-slate-950 shadow-[0_12px_30px_rgba(249,115,22,0.22)] transition-all duration-200 hover:-translate-y-[1px] hover:bg-orange-400"
            >
              Lancer votre premier audit
            </Link>
            <Link
              href="/how-it-works"
              className="rounded-2xl border border-slate-200 bg-white px-5 py-2.5 text-xs font-semibold uppercase tracking-[0.18em] text-slate-700 shadow-[0_8px_24px_rgba(15,23,42,0.06)] transition-all duration-200 hover:-translate-y-[1px] hover:bg-slate-50"
            >
              Voir la solution
            </Link>
          </div>
        </div>

        <div className="mt-6 md:mt-0 md:pl-4">
          <div className="rounded-[28px] border border-slate-100/80 bg-white/95 p-5 md:p-7 shadow-[0_12px_32px_rgba(15,23,42,0.08)]">
            <SectionLabel className="nk-text-secondary">APERÇU DU RAPPORT</SectionLabel>
            <div className="mt-4 flex items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-[0_8px_24px_rgba(15,23,42,0.06)] ring-1 ring-emerald-200/60">
              <div>
                <SectionLabel className="text-emerald-600">Score global</SectionLabel>
                <p className="mt-1 text-[44px] font-semibold tracking-[-0.04em] text-slate-950">
                  8.4<span className="text-base text-emerald-500"> / 10</span>
                </p>
              </div>
              <div className="rounded-full border border-emerald-100 bg-emerald-50 px-3 py-1 text-[11px] font-medium text-emerald-700">
                +18% à +32% potentiel
              </div>
            </div>
            <p className="mt-1 text-xs nk-text-secondary">
              Lecture issue des signaux visibles de l’annonce
            </p>

            <KpiGrid className="mt-5 text-xs text-slate-700">
              <div className="rounded-2xl border border-slate-200 bg-white p-4 nk-card-sm">
                <SectionLabel>Position marché</SectionLabel>
                <p className="mt-1 text-sm font-semibold leading-6 text-slate-800">Compétitif</p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-white p-4 nk-card-sm">
                <SectionLabel>Potentiel estimé</SectionLabel>
                <p className="mt-1 text-sm font-semibold leading-6 text-emerald-700">+18% à +32%</p>
              </div>
              <div className="rounded-2xl border border-emerald-200 bg-[linear-gradient(180deg,rgba(236,253,245,1)_0%,rgba(220,252,231,0.9)_100%)] p-4 nk-card-highlight">
                <SectionLabel className="text-slate-600">Revenu mensuel</SectionLabel>
                <p className="mt-1 text-sm font-semibold leading-6 text-slate-900">+320&nbsp;€/mois</p>
              </div>
            </KpiGrid>

            <div className="mt-4 rounded-2xl border border-slate-100 bg-white/80 p-3.5">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] nk-text-secondary">
                RECOMMANDATIONS PRIORITAIRES
              </p>
              <ul className="mt-2 space-y-1.5 text-[11px] leading-5 text-slate-600">
                <li>• Photo principale&nbsp;: afficher rooftop et bassin dès l’ouverture.</li>
                <li>• Titre&nbsp;: préciser l’audience visée et le bénéfice principal.</li>
                <li>• Réassurance&nbsp;: mettre en avant les signaux de confiance clés.</li>
              </ul>
            </div>

            <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-emerald-50">
              <div className="h-full w-2/3 rounded-full bg-gradient-to-r from-emerald-400 via-sky-400 to-amber-300" />
            </div>
            <p className="mt-3 text-[11px] nk-text-secondary">
              Exemple de restitution Norixo Optimize.
            </p>
          </div>
        </div>
      </section>

      {/* Example listing analyzed + report preview */}
      <section className="space-y-10 md:space-y-12">
        <div className="flex flex-col justify-between rounded-[28px] nk-border bg-[linear-gradient(180deg,rgba(255,255,255,0.99)_0%,rgba(248,250,252,0.97)_100%)] px-5 py-6 md:p-7 nk-card-lg transition-all duration-200 hover:-translate-y-[1px] hover:shadow-[0_18px_56px_rgba(15,23,42,0.10)]">
          <div className="mb-6 flex items-start justify-between gap-4">
            <div className="space-y-2 max-w-[700px]">
              <SectionLabel className="nk-text-secondary">
                EXEMPLE D’ANNONCE ANALYSÉE
              </SectionLabel>
              <SectionTitle className="mt-1 text-[22px] md:text-[26px] leading-[1.15] tracking-[-0.03em] text-slate-950">
                Riad avec rooftop et bassin plongé
              </SectionTitle>
              <SectionDescription className="text-[13px] leading-6 nk-text-secondary">
                Marrakech · Médina · 2 chambres · 4 voyageurs
              </SectionDescription>
              <SectionDescription className="text-[13px] leading-6 nk-text-secondary">
                110&nbsp;€ / nuit · Annulation flexible
              </SectionDescription>
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
                <span className="text-xs nk-text-secondary">(128 avis)</span>
              </div>
              <p className="mt-1 text-[11px] nk-text-secondary">Exemple réel, avant recommandations.</p>
            </div>
          </div>

          <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-5 nk-card-sm">
            <SectionLabel>
              PRIORITÉS D’OPTIMISATION
            </SectionLabel>

            <SectionTitle className="mt-1 text-[17px] leading-7 text-slate-900">
              3 actions prioritaires pour relancer la conversion
            </SectionTitle>

            <div className="mt-4 grid gap-3 md:grid-cols-3">
              
              <div className="rounded-xl border border-slate-200 bg-slate-50/90 p-3.5">
                <div className="relative pl-4">
                  <div className="absolute bottom-0 left-0 top-0 w-[3px] rounded-full bg-amber-400/70" />
                  <p className="text-[13px] font-semibold text-amber-600">
                    1. Photo principale
                  </p>
                  <p className="mt-1 text-[13px] leading-6 text-slate-700">
                    Mettre rooftop et bassin dès la première image
                  </p>
                  <p className="mt-1 text-[11px] nk-text-secondary">
                    +12 à +18% de clics
                  </p>
                </div>
              </div>

              <div className="rounded-xl border border-slate-200 bg-slate-50/90 p-3.5">
                <div className="relative pl-4">
                  <div className="absolute bottom-0 left-0 top-0 w-[3px] rounded-full bg-emerald-400/70" />
                  <p className="text-[13px] font-semibold text-emerald-600">
                    2. Description
                  </p>
                  <p className="mt-1 text-[13px] leading-6 text-slate-700">
                    Clarifier la promesse dès l’ouverture de la description
                  </p>
                  <p className="mt-1 text-[11px] nk-text-secondary">
                    +5 à +12% de conversion
                  </p>
                </div>
              </div>

              <div className="rounded-xl border border-slate-200 bg-slate-50/90 p-3.5">
                <div className="relative pl-4">
                  <div className="absolute bottom-0 left-0 top-0 w-[3px] rounded-full bg-sky-400/70" />
                  <p className="text-[13px] font-semibold text-sky-600">
                    3. Réassurance
                  </p>
                  <p className="mt-1 text-[13px] leading-6 text-slate-700">
                    Ajouter des repères de confiance immédiatement lisibles
                  </p>
                  <p className="mt-1 text-[11px] nk-text-secondary">
                    +3 à +8% de réservations
                  </p>
                </div>
              </div>

            </div>
            <div className="mt-4 rounded-2xl border border-emerald-300 bg-gradient-to-r from-emerald-50 to-emerald-100 p-5 nk-card-highlight">
              <div className="relative pl-4">
                <div className="absolute bottom-0 left-0 top-0 w-[3px] rounded-full bg-emerald-400/70" />
                <SectionLabel className="text-emerald-700">
                  GAIN ESTIMÉ APRÈS OPTIMISATION
                </SectionLabel>

                <div className="mt-1 flex items-end justify-between">
                  <p className="text-3xl md:text-4xl font-semibold tracking-[-0.02em] text-emerald-900">
                    +18% à +32% de réservations
                  </p>
                  <span className="ml-2 rounded-full bg-emerald-600/10 px-2 py-0.5 text-xs font-medium text-emerald-700">
                    estimé
                  </span>
                </div>

                <p className="mt-1 text-[13px] leading-6 text-emerald-900/80">
                  Projection basée sur des annonces comparables de votre marché.
                </p>
              </div>
            </div>
          </div>

          <div className="mt-5">
            <div className="relative w-full p-2 md:p-3">
              <div className="flex flex-col gap-4 md:grid md:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)] md:gap-5 md:items-start">
                {/* Colonne gauche : photo principale */}
                <div className="relative flex flex-col gap-5">
                  <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white nk-card-sm">
                  <div className="flex items-center justify-between gap-3 border-b border-slate-200/70 bg-white/80 px-3 py-2">
                    <div className="flex items-center gap-2">
                      <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                        PHOTO PRINCIPALE ANALYSÉE
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
                  <div className="rounded-2xl border border-slate-200 bg-white p-4 nk-card-sm">
                    <div className="relative pl-4">
                      <div className="absolute bottom-0 left-0 top-0 w-[3px] rounded-full bg-amber-400/70" />
                      <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                        Pourquoi ça bloque
                      </p>
                      <p className="text-sm leading-6 text-slate-700">
                        Les voyageurs décident vite. Ici, l’image d’ouverture met en avant un espace neutre au lieu de l’atout principal.
                      </p>
                      <p className="mt-3 inline-flex items-center gap-2 text-sm font-medium text-amber-700">
                        <span className="h-4 w-1 rounded bg-amber-500" />
                        <span>→ Conséquence&nbsp;: baisse des clics et des réservations.</span>
                      </p>
                    </div>
                  </div>
                  <div className="rounded-2xl border border-slate-200 bg-white p-4 nk-card-sm">
                    <div className="relative pl-4">
                      <div className="absolute bottom-0 left-0 top-0 w-[3px] rounded-full bg-amber-400/70" />
                      <div className="flex items-center justify-between">
                        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                          Impact visuel
                        </p>
                        <span className="text-sm font-semibold text-amber-600">
                          Faible
                        </span>
                      </div>

                      <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-slate-100">
                        <div className="h-full w-[35%] rounded-full bg-gradient-to-r from-amber-400 to-orange-500" />
                      </div>

                      <p className="mt-3 text-sm leading-6 text-slate-700">
                        Le visuel n’expose pas l’atout clé dès les premières secondes.
                      </p>
                      <p className="mt-2 text-xs text-slate-500">
                        Impact direct sur votre score global
                      </p>
                      <p className="mt-2 text-xs text-slate-500">
                        ↳ Estimation : -12 à -18% de clics
                      </p>
                    </div>
                  </div>
                </div>

                {/* Colonne droite : cartes d’analyse */}
                <div className="space-y-3 text-xs text-slate-700">
                  <div className="rounded-2xl border border-slate-200 bg-white p-3 nk-card-sm">
                    <div className="relative pl-4">
                      <div className="absolute bottom-0 left-0 top-0 w-[3px] rounded-full bg-amber-400/70" />
                      <div className="flex items-center justify-between">
                        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                          Titre (impact direct)
                        </p>
                        <span className="text-[11px] font-semibold nk-text-muted">
                          Priorité élevée
                        </span>
                      </div>
                      <p className="mt-1 text-[15px] leading-7 text-slate-800">
                        Charmant riad à Marrakech avec rooftop et bassin.
                      </p>
                      <p className="mt-3 inline-flex items-start gap-2 text-[13px] font-medium text-amber-700">
                        <span className="h-4 w-1 rounded bg-amber-500" />
                        <span>Ne précise ni l’audience idéale ni la promesse principale.</span>
                      </p>
                      <p className="mt-1 text-xs nk-text-secondary">
                        ↳ Impact estimé : +5 à +12% de clics
                      </p>
                      <p className="mt-2 text-xs font-medium nk-text-muted">
                        Action recommandée
                      </p>
                    </div>
                  </div>

                  <div className="rounded-2xl border border-slate-200 bg-white p-3 nk-card-sm">
                    <div className="relative pl-4">
                      <div className="absolute bottom-0 left-0 top-0 w-[3px] rounded-full bg-emerald-400/70" />
                      <div className="flex items-center justify-between">
                        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                          Description (conversion)
                        </p>
                        <span className="text-[11px] font-semibold nk-text-muted">
                          Priorité élevée
                        </span>
                      </div>
                      <p className="mt-1 text-[15px] leading-7 text-slate-800 line-clamp-2">
                        Texte chaleureux mais générique, qui retarde la promesse utile pour le voyageur.
                      </p>
                      <p className="mt-3 inline-flex items-start gap-2 text-[13px] font-medium text-emerald-700">
                        <span className="h-4 w-1 rounded bg-emerald-500" />
                        <span>Levier clé pour clarifier la promesse et accélérer la décision.</span>
                      </p>
                      <p className="mt-1 text-xs nk-text-secondary">
                        ↳ Impact estimé : +5 à +12% de clics
                      </p>
                      <p className="mt-2 text-xs font-medium nk-text-muted">
                        Action recommandée
                      </p>
                    </div>
                  </div>

                  <div className="rounded-2xl border border-slate-200 bg-white p-3 nk-card-sm">
                    <div className="relative pl-4">
                      <div className="absolute bottom-0 left-0 top-0 w-[3px] rounded-full bg-sky-400/70" />
                      <div className="flex items-center justify-between">
                        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                          Équipements (différenciation)
                        </p>
                        <span className="text-[11px] font-semibold nk-text-muted">
                          Priorité moyenne
                        </span>
                      </div>
                      <p className="mt-1 text-[15px] leading-7 text-slate-800">
                        Les équipements différenciants apparaissent trop tard dans le parcours de lecture.
                      </p>
                      <p className="mt-3 inline-flex items-start gap-2 text-[13px] font-medium text-slate-700">
                        <span className="h-4 w-1 rounded bg-slate-400" />
                        <span>Réduit la perception de valeur face aux annonces concurrentes.</span>
                      </p>
                      <p className="mt-1 text-xs nk-text-secondary">
                        ↳ Impact estimé : +5 à +12% de clics
                      </p>
                      <p className="mt-2 text-xs font-medium nk-text-muted">
                        Action recommandée
                      </p>
                    </div>
                  </div>

                  <div className="rounded-2xl border border-slate-200 bg-white p-3 nk-card-sm">
                    <div className="relative pl-4">
                      <div className="absolute bottom-0 left-0 top-0 w-[3px] rounded-full bg-violet-400/70" />
                      <div className="flex items-center justify-between">
                        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                          Réassurance (confiance client)
                        </p>
                        <span className="text-[11px] font-semibold nk-text-muted">
                          Priorité moyenne
                        </span>
                      </div>
                      <p className="mt-1 text-[15px] leading-7 text-slate-800">
                        Les signaux de service, de propreté et d’arrivée restent peu visibles.
                      </p>
                      <p className="mt-3 inline-flex items-start gap-2 text-[13px] font-medium text-sky-700">
                        <span className="h-4 w-1 rounded bg-sky-500" />
                        <span>À renforcer pour réduire l’hésitation avant réservation.</span>
                      </p>
                      <p className="mt-1 text-xs nk-text-secondary">
                        ↳ Impact estimé : +5 à +12% de clics
                      </p>
                      <p className="mt-2 text-xs font-medium nk-text-muted">
                        Action recommandée
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* After optimization projection */}
        <MobileCenteredBlock>
        <section className="relative rounded-[28px] nk-border bg-[radial-gradient(circle_at_0_0,rgba(16,185,129,0.10),transparent_55%),radial-gradient(circle_at_100%_100%,rgba(56,189,248,0.08),transparent_55%),linear-gradient(180deg,rgba(255,255,255,0.99)_0%,rgba(241,245,249,0.99)_100%)] p-5 md:p-7 nk-card-lg ring-1 ring-emerald-50/80">
          <SectionLabel className="text-slate-600">
            APRÈS OPTIMISATION
          </SectionLabel>
          <SectionTitle className="mt-1 text-[22px] md:text-[24px] leading-[1.15] tracking-[-0.03em] text-slate-950">
            Après optimisation, l’annonce devient plus claire et plus convaincante
          </SectionTitle>

          <div className="mt-6 grid gap-6 md:grid-cols-2 md:items-start">
            {/* Colonne gauche : visuel amélioré */}
            <div className="rounded-2xl border border-emerald-200 bg-[linear-gradient(180deg,rgba(255,255,255,1)_0%,rgba(240,253,250,0.96)_100%)] p-4 md:p-5 shadow-[0_12px_32px_rgba(15,23,42,0.08)]">
              <div className="flex items-center justify-between gap-3">
                <span className="inline-flex items-center rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-emerald-700">
                  APRÈS OPTIMISATION
                </span>
                <span className="inline-flex items-center rounded-full border border-emerald-100 bg-emerald-50 px-2.5 py-1 text-[11px] font-medium text-emerald-700">
                  Terrasse visible dès le premier écran
                </span>
              </div>

              <div className="mt-4 relative h-40 w-full overflow-hidden rounded-2xl border border-emerald-200 bg-[radial-gradient(circle_at_0_0,rgba(16,185,129,0.16),transparent_55%),radial-gradient(circle_at_100%_100%,rgba(56,189,248,0.22),transparent_55%)] sm:h-48">
                <div className="absolute inset-3 rounded-2xl border border-white/40 bg-[radial-gradient(circle_at_20%_0,rgba(248,250,252,0.98),transparent_52%),radial-gradient(circle_at_85%_100%,rgba(16,185,129,0.18),transparent_60%)] shadow-[0_18px_56px_rgba(15,23,42,0.10)]" />
                <div className="absolute inset-x-6 bottom-6 h-16 rounded-2xl border border-emerald-50 bg-white/98 px-3 py-2 text-[11px] text-slate-700 shadow-[0_12px_32px_rgba(15,23,42,0.08)] backdrop-blur-md flex items-center justify-between gap-3">
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                      Première impression
                    </p>
                    <p className="mt-0.5 text-[12px] font-semibold leading-5 tracking-[-0.01em] text-emerald-900">
                      Terrasse et bassin mis en avant dès la première image.
                    </p>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <span className="inline-flex items-center rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">
                      Atout principal visible
                    </span>
                    <span className="text-[10px] text-slate-500">
                      ↑ Taux de clics attendu
                    </span>
                  </div>
                </div>
              </div>

              <p className="mt-3 text-[13px] leading-6 text-slate-800">
                Le visuel met maintenant en avant l’atout principal dès les premières secondes.
              </p>
            </div>

            {/* Colonne droite : KPIs après optimisation */}
            <div className="space-y-3 text-sm text-slate-700">
              <KpiGrid density="compact">
                <div className="rounded-2xl border border-slate-200 bg-white p-3 nk-card-sm">
                  <div className="relative pl-4">
                    <div className="absolute bottom-0 left-0 top-0 w-[3px] rounded-full bg-sky-400/70" />
                    <SectionLabel>
                      Score global
                    </SectionLabel>
                    <p className="mt-1 text-[20px] font-semibold tracking-[-0.04em] text-slate-950">
                      8.4<span className="text-base text-emerald-500"> / 10</span>
                    </p>
                  </div>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-white p-3 nk-card-sm">
                  <div className="relative pl-4">
                    <div className="absolute bottom-0 left-0 top-0 w-[3px] rounded-full bg-blue-400/70" />
                    <SectionLabel>
                      Potentiel de conversion
                    </SectionLabel>
                    <p className="mt-1 text-[13px] font-medium leading-6 text-slate-800">
                      Fort
                    </p>
                  </div>
                </div>
                <div className="rounded-2xl border border-emerald-300 bg-[linear-gradient(135deg,rgba(16,185,129,0.06),rgba(16,185,129,0.18))] p-3 nk-card-highlight ring-1 ring-emerald-300/70">
                  <div className="relative pl-4">
                    <div className="absolute bottom-0 left-0 top-0 w-[3px] rounded-full bg-emerald-400/70" />
                    <SectionLabel className="text-emerald-700">
                      Impact estimé
                    </SectionLabel>
                    <p className="mt-1 text-[26px] md:text-[28px] font-semibold leading-8 tracking-[-0.03em] text-emerald-950">
                      +18% à +32%
                    </p>
                  </div>
                </div>
              </KpiGrid>

              <div className="rounded-2xl border border-slate-100/90 bg-white/98 p-4 text-[13px] leading-6 text-slate-600 nk-card-sm ring-1 ring-emerald-50/80">
                <div className="relative pl-4">
                  <div className="absolute bottom-0 left-0 top-0 w-[3px] rounded-full bg-violet-400/70" />
                  <SectionLabel className="text-slate-600">
                    Synthèse après optimisation
                  </SectionLabel>
                  <p className="mt-1">
                    <span className="font-medium text-slate-700">
                      Les principaux freins ont été traités&nbsp;:
                    </span>{" "}
                    <span className="text-slate-700">
                      première impression renforcée, promesse plus claire et signaux de confiance mieux visibles.
                    </span>
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>
        </MobileCenteredBlock>

      </section>

      {/* Key insights */}
      <section className="rounded-[28px] nk-border bg-gradient-to-br from-white via-slate-50/80 to-white px-5 py-7 md:p-7 nk-card-lg ring-1 ring-white/60">
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500 mb-2">
          PRINCIPAUX LEVIERS IMPACTANT VOTRE CONVERSION
        </p>
        <p className="mt-2 max-w-2xl text-[14px] leading-7 text-slate-600 md:text-[15px]">
          Les leviers qui freinent aujourd’hui la conversion et les actions à traiter en priorité.
        </p>
        <div className="relative mt-8 grid gap-6 text-sm text-slate-700 md:grid-cols-2">
          <div className="hidden lg:block absolute top-10 bottom-10 left-1/2 w-[1px] bg-gradient-to-b from-transparent via-slate-300/60 to-transparent" />
          <div className="group relative flex h-full flex-col justify-between overflow-hidden rounded-2xl border border-sky-200/70 bg-sky-50/35 p-5 shadow-[0_12px_32px_rgba(15,23,42,0.08)] ring-1 ring-sky-50/70 transition-all duration-200 hover:-translate-y-[1px] hover:shadow-md">
            <div className="relative flex h-full flex-col justify-between pl-4">
              <div className="absolute bottom-0 left-0 top-0 w-[3px] rounded-full bg-sky-400/70" />
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                  Titre de l’annonce
                </p>
                <p className="mt-2 text-[15px] leading-7 font-semibold text-slate-900 transition-colors group-hover:text-slate-900">
                  Le titre n’expose pas assez vite l’atout principal et l’audience visée.
                </p>
                <p className="mt-1 text-[13px] leading-6 text-slate-600">
                  Rooftop et bassin restent absents des premiers mots clés.
                </p>
              </div>
              <div className="mt-3 flex items-center justify-between text-[11px] text-slate-500">
                <span className="inline-flex items-center rounded-full bg-sky-100 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-sky-700">
                  À renforcer
                </span>
                <span>Impact direct sur le positionnement</span>
              </div>
            </div>
          </div>
          <div className="group relative flex h-full flex-col justify-between overflow-hidden rounded-2xl border border-amber-200/80 bg-amber-50/35 bg-gradient-to-r from-amber-50/50 via-amber-50/20 to-transparent p-5 shadow-[0_12px_32px_rgba(15,23,42,0.08)] ring-1 ring-amber-50/80 transition-all duration-200 hover:-translate-y-[1px] hover:shadow-lg">
            <div className="relative flex h-full flex-col justify-between pl-4">
              <div className="absolute bottom-0 left-0 top-0 w-[3px] rounded-full bg-amber-400/70" />
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                  Ordre des photos
                </p>
                <p className="mt-2 text-[15px] leading-7 font-semibold text-slate-900 transition-colors group-hover:text-slate-900">
                  La photo d’ouverture ne montre pas les éléments qui déclenchent les clics.
                </p>
                <p className="mt-1 text-[13px] leading-6 text-slate-600">
                  Terrasse et bassin apparaissent trop tard dans la galerie.
                </p>
              </div>
              <div className="mt-3 flex items-center justify-between text-[11px] text-slate-500">
                <span className="inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-amber-700">
                  Priorité élevée
                </span>
                <span>Impact immédiat sur les clics</span>
              </div>
            </div>
          </div>
          <div className="group relative flex h-full flex-col justify-between overflow-hidden rounded-2xl border border-emerald-200/75 bg-emerald-50/35 p-5 shadow-[0_12px_32px_rgba(15,23,42,0.08)] ring-1 ring-emerald-50/70 transition-all duration-200 hover:-translate-y-[1px] hover:shadow-md">
            <div className="relative flex h-full flex-col justify-between pl-4">
              <div className="absolute bottom-0 left-0 top-0 w-[3px] rounded-full bg-emerald-400/70" />
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                  Équipements vs. concurrents
                </p>
                <p className="mt-2 text-[15px] leading-7 font-semibold text-slate-900 transition-colors group-hover:text-slate-900">
                  Des équipements clés restent peu visibles face aux annonces voisines.
                </p>
                <p className="mt-1 text-[13px] leading-6 text-slate-600">
                  Wi-Fi rapide, espace de travail et départ tardif sont mieux valorisés ailleurs.
                </p>
              </div>
              <div className="mt-3 flex items-center justify-between text-[11px] text-slate-500">
                <span className="inline-flex items-center rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-emerald-700">
                  Signal marché
                </span>
                <span>Influence la valeur perçue</span>
              </div>
            </div>
          </div>
          <div className="group relative flex h-full flex-col justify-between overflow-hidden rounded-2xl border border-slate-200/80 bg-slate-50/55 p-5 shadow-[0_12px_32px_rgba(15,23,42,0.08)] ring-1 ring-amber-50/75 transition-all duration-200 hover:-translate-y-[1px] hover:shadow-md">
            <div className="relative flex h-full flex-col justify-between pl-4">
              <div className="absolute bottom-0 left-0 top-0 w-[3px] rounded-full bg-slate-400/55" />
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                  Introduction de la description
                </p>
                <p className="mt-2 text-[15px] leading-7 font-semibold text-slate-900 transition-colors group-hover:text-slate-900">
                  L’introduction manque d’une promesse claire centrée voyageur.
                </p>
                <p className="mt-1 text-[13px] leading-6 text-slate-600">
                  Les premières lignes n’indiquent pas assez vite pourquoi réserver.
                </p>
              </div>
              <div className="mt-3 flex items-center justify-between text-[11px] text-slate-500">
                <span className="inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-slate-600">
                  À corriger
                </span>
                <span>Impact sur la décision finale</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="flex flex-col gap-4 rounded-[28px] nk-border bg-[linear-gradient(180deg,rgba(255,255,255,0.98)_0%,rgba(248,250,252,0.96)_100%)] p-5 md:flex-row md:items-center md:justify-between md:p-7 nk-card-lg">
        <div className="max-w-xl">
          <SectionTitle className="text-[22px] md:text-[26px] leading-tight text-slate-900">
            Prêt à analyser votre propre annonce ?
          </SectionTitle>
          <SectionDescription className="mt-3 text-[14px] leading-7 text-slate-600 md:text-[15px]">
            Collez une URL, lancez votre premier audit propulsé par Norixo Optimize et transformez vos visiteurs hésitants en réservations plus solides.
          </SectionDescription>
        </div>
        <div className="flex flex-wrap items-center gap-4 md:justify-end">
          <Link
            href="/audit/new"
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

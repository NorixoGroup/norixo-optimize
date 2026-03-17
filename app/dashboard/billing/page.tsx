import Link from "next/link";

export default function BillingPage() {
  return (
    <div className="space-y-8 text-sm">
      <div className="nk-card nk-card-hover nk-page-header-card py-7 md:flex md:items-center md:justify-between md:gap-10">
        <div className="max-w-3xl space-y-3">
          <p className="nk-kicker-muted">Facturation</p>
          <h1 className="nk-heading-xl text-2xl font-semibold text-slate-900 md:text-3xl lg:text-4xl">
            Plan & abonnement
          </h1>
          <p className="nk-body-muted text-[15px] leading-relaxed text-slate-700">
            Gérez ici votre plan, votre abonnement et vos futurs paiements. Dans ce MVP, cette page
            reste une maquette visuelle avant le branchement complet de Stripe.
          </p>
        </div>

        <div className="mt-5 text-right md:mt-0">
          <span className="inline-flex items-center justify-center rounded-full bg-emerald-50 px-4 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-emerald-700">
            Plan Concierge actif
          </span>
          <p className="mt-2 text-xs leading-5 text-slate-500">
            Le portail client Stripe viendra remplacer cette maquette.
          </p>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="nk-card nk-card-hover p-6">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
            Plan actuel
          </p>
          <p className="mt-3 text-2xl font-semibold text-slate-900">Concierge</p>
          <p className="mt-1 text-sm font-medium text-slate-900">39 €/mois</p>
          <p className="mt-4 text-sm leading-6 text-slate-700">
            Inclut jusqu’à 5 annonces. Chaque annonce supplémentaire est facturée 4 €.
          </p>
        </div>

        <div className="nk-card nk-card-hover p-6">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
            Ce qui est inclus
          </p>
          <ul className="mt-4 space-y-3 text-sm text-slate-800">
            <li className="flex gap-3">
              <span className="mt-1 h-2 w-2 rounded-full bg-emerald-500" />
              <span>Audits de conversion d’annonces</span>
            </li>
            <li className="flex gap-3">
              <span className="mt-1 h-2 w-2 rounded-full bg-emerald-500" />
              <span>Analyse des concurrents comparables</span>
            </li>
            <li className="flex gap-3">
              <span className="mt-1 h-2 w-2 rounded-full bg-emerald-500" />
              <span>Rapport détaillé avec recommandations</span>
            </li>
            <li className="flex gap-3">
              <span className="mt-1 h-2 w-2 rounded-full bg-emerald-500" />
              <span>Suivi des audits dans le tableau de bord</span>
            </li>
          </ul>
        </div>

        <div className="nk-card nk-card-hover p-6">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
            Gestion de l’abonnement
          </p>
          <p className="mt-4 text-sm leading-6 text-slate-700">
            Dans la version finale, ce bouton ouvrira le portail client Stripe pour modifier le
            mode de paiement, changer de plan ou résilier l’abonnement.
          </p>

          <div className="mt-5">
            <Link
              href="#"
              className="inline-flex cursor-not-allowed items-center justify-center rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-400"
            >
              Ouvrir le portail client (futur)
            </Link>
          </div>
        </div>
      </div>

      <div className="nk-card nk-card-hover p-6">
        <p className="nk-section-title">Prochaine étape</p>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-700">
          Quand Stripe sera branché, cette page affichera les vraies données d’abonnement, les
          prochaines échéances, l’historique de paiement et les options de changement de formule.
        </p>
      </div>
    </div>
  );
}
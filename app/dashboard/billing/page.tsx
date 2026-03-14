import Link from "next/link";

export default function BillingPage() {
  return (
    <div className="space-y-8 text-sm text-neutral-200">
      <div className="flex flex-col justify-between gap-5 md:flex-row md:items-end">
        <div className="max-w-3xl space-y-2">
          <p className="nk-kicker-muted">Abonnement</p>
          <h1 className="nk-heading-xl">Facturation</h1>
          <p className="nk-body-muted">
            Gérez ici votre plan, votre abonnement et vos futurs paiements. Dans
            ce MVP, cette page reste une maquette visuelle avant le branchement
            complet de Stripe.
          </p>
        </div>

        <span className="inline-flex items-center justify-center rounded-2xl border border-emerald-500/30 bg-emerald-500/10 px-5 py-3 text-sm font-semibold text-emerald-300">
          Plan Concierge actif
        </span>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="nk-card nk-card-hover p-5">
          <p className="nk-table-header">
            Plan actuel
          </p>
          <p className="mt-3 text-2xl font-semibold text-slate-50">
            Concierge
          </p>
          <p className="mt-1 text-sm text-slate-400">
            39 €/mois
          </p>
          <p className="mt-4 text-sm leading-6 text-slate-400">
            Inclut jusqu’à 5 annonces. Chaque annonce supplémentaire est
            facturée 4 €.
          </p>
        </div>

        <div className="nk-card nk-card-hover p-5">
          <p className="nk-table-header">
            Ce qui est inclus
          </p>
          <ul className="mt-4 space-y-3 text-sm text-slate-200">
            <li className="flex gap-3">
              <span className="mt-1 h-2 w-2 rounded-full bg-orange-400" />
              <span>Audits de conversion d’annonces</span>
            </li>
            <li className="flex gap-3">
              <span className="mt-1 h-2 w-2 rounded-full bg-orange-400" />
              <span>Analyse des concurrents comparables</span>
            </li>
            <li className="flex gap-3">
              <span className="mt-1 h-2 w-2 rounded-full bg-orange-400" />
              <span>Rapport détaillé avec recommandations</span>
            </li>
            <li className="flex gap-3">
              <span className="mt-1 h-2 w-2 rounded-full bg-orange-400" />
              <span>Suivi des audits dans le tableau de bord</span>
            </li>
          </ul>
        </div>

        <div className="nk-card nk-card-hover p-5">
          <p className="nk-table-header">
            Gestion de l’abonnement
          </p>
          <p className="mt-4 text-sm leading-6 text-slate-400">
            Dans la version finale, ce bouton ouvrira le portail client Stripe
            pour modifier le mode de paiement, changer de plan ou résilier
            l’abonnement.
          </p>

          <div className="mt-5">
            <Link
              href="#"
              className="nk-ghost-btn opacity-70"
            >
              Ouvrir le portail client
            </Link>
          </div>
        </div>
      </div>

      <div className="nk-card nk-card-hover p-5">
        <p className="nk-table-header">
          Prochaine étape
        </p>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-400">
          Quand Stripe sera branché, cette page affichera les vraies données
          d’abonnement, les prochaines échéances, l’historique de paiement et
          les options de changement de formule.
        </p>
      </div>
    </div>
  );
}
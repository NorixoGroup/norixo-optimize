export default function SettingsPage() {
  return (
    <div className="space-y-8 text-sm text-neutral-200">
      <div className="max-w-3xl space-y-2">
        <p className="nk-kicker-muted">Espace de travail</p>
        <h1 className="nk-heading-xl">Paramètres</h1>
        <p className="nk-body-muted">
          Gérez ici votre profil, votre espace de travail et les intégrations
          techniques. Dans ce MVP, ces blocs servent encore de placeholders
          avant le branchement complet des services.
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="nk-card nk-card-hover p-5">
          <p className="nk-table-header">
            Profil
          </p>

          <div className="mt-4 space-y-4 text-sm">
            <div className="nk-card-soft p-4">
              <p className="text-xs text-slate-500">Nom</p>
              <p className="mt-1 font-medium text-slate-50">Demo Host</p>
            </div>

            <div className="nk-card-soft p-4">
              <p className="text-xs text-slate-500">Email</p>
              <p className="mt-1 font-medium text-slate-50">
                demo@listing-optimizer.app
              </p>
            </div>
          </div>
        </div>

        <div className="nk-card nk-card-hover p-5">
          <p className="nk-table-header">
            Intégrations
          </p>

          <ul className="mt-4 space-y-3 text-sm text-slate-200">
            <li className="flex gap-3">
              <span className="mt-1 h-2 w-2 rounded-full bg-orange-400" />
              <span>Supabase : URL du projet et clé anon</span>
            </li>
            <li className="flex gap-3">
              <span className="mt-1 h-2 w-2 rounded-full bg-orange-400" />
              <span>Stripe : clés publique et secrète</span>
            </li>
            <li className="flex gap-3">
              <span className="mt-1 h-2 w-2 rounded-full bg-orange-400" />
              <span>OpenAI : clé API</span>
            </li>
            <li className="flex gap-3">
              <span className="mt-1 h-2 w-2 rounded-full bg-orange-400" />
              <span>Bright Data : accès scraping / browser API</span>
            </li>
          </ul>

          <p className="mt-5 text-sm leading-6 text-slate-400">
            Remplace les placeholders du fichier{" "}
            <code className="rounded bg-neutral-950 px-1.5 py-0.5 text-xs text-neutral-300">
              .env.local
            </code>{" "}
            puis branche les vrais clients dans les dossiers{" "}
            <code className="rounded bg-neutral-950 px-1.5 py-0.5 text-xs text-neutral-300">
              auth
            </code>
            ,{" "}
            <code className="rounded bg-neutral-950 px-1.5 py-0.5 text-xs text-neutral-300">
              stripe
            </code>{" "}
            et{" "}
            <code className="rounded bg-neutral-950 px-1.5 py-0.5 text-xs text-neutral-300">
              ai
            </code>
            .
          </p>
        </div>
      </div>

      <div className="nk-card nk-card-hover p-5">
        <p className="nk-table-header">
          État actuel
        </p>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-400">
          L’interface est prête pour accueillir les vraies préférences utilisateur,
          les paramètres d’espace de travail, la gestion d’équipe et les
          intégrations API. Cette page deviendra ensuite le centre de contrôle
          technique du SaaS.
        </p>
      </div>
    </div>
  );
}
"use client";

import Link from "next/link";

export function TermsContent() {
  return (
    <div className="mx-auto max-w-2xl px-4 py-16 sm:px-6 sm:py-20">
      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
        Conditions d’utilisation
      </p>
      <h1 className="mt-3 text-2xl font-semibold tracking-tight text-white sm:text-3xl">
        Conditions de service Norixo
      </h1>
      <div className="mt-8 space-y-4 text-sm leading-7 text-slate-300">
        <p>
          Norixo Optimize est un service d’analyse et d’aide à l’amélioration des annonces de location courte durée.
          Les recommandations fournies sont indicatives et doivent être vérifiées par l’utilisateur avant toute décision.
        </p>
        <p>
          L’accès au service peut nécessiter un compte utilisateur. L’utilisateur est responsable de l’exactitude des
          informations transmises et de l’usage qu’il fait des résultats générés par Norixo.
        </p>
        <p>
          Les contenus, rapports, interfaces et éléments de marque Norixo restent la propriété de Norixo ou de ses ayants droit.
          Toute reproduction non autorisée est interdite.
        </p>
        <p>
          Pour toute question relative aux conditions de service, vous pouvez nous contacter via la page contact.
        </p>
      </div>
      <p className="mt-10">
        <Link
          href="/"
          className="text-sm font-medium text-slate-400 underline-offset-4 transition-colors hover:text-white hover:underline"
        >
          Retour à l’accueil
        </Link>
      </p>
    </div>
  );
}

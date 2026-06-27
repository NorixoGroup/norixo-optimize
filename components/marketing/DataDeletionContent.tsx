"use client";

import Link from "next/link";

export function DataDeletionContent() {
  return (
    <div className="mx-auto max-w-2xl px-4 py-16 sm:px-6 sm:py-20">
      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
        Suppression des données
      </p>
      <h1 className="mt-3 text-2xl font-semibold tracking-tight text-white sm:text-3xl">
        Instructions de suppression des données
      </h1>
      <div className="mt-8 space-y-4 text-sm leading-7 text-slate-300">
        <p>
          Si vous souhaitez demander la suppression des données associées à Norixo, vous pouvez nous contacter
          depuis la page contact en indiquant l’adresse e-mail liée à votre compte.
        </p>
        <p>
          Pour les connexions Meta utilisées par le Marketing Studio Norixo, les données sont utilisées uniquement
          pour identifier les Pages Facebook et comptes Instagram Business associés à l’administrateur autorisé.
        </p>
        <p>
          Norixo ne vend pas les données personnelles et ne publie aucun contenu automatiquement sans validation humaine.
        </p>
        <p>
          Après réception d’une demande valide, nous supprimerons ou anonymiserons les données concernées dans un délai raisonnable,
          sauf obligation légale de conservation.
        </p>
        <p>
          Contact :{" "}
          <Link href="/contact" className="font-medium text-orange-300 underline-offset-4 hover:underline">
            page contact
          </Link>
          .
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

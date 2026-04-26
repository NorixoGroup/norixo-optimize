import type { Metadata } from "next";
import Link from "next/link";

import { MarketingPageShell } from "@/components/marketing/MarketingPageShell";

export const metadata: Metadata = {
  title: "Mentions légales | Norixo",
  description: "Mentions légales et informations éditeur pour les services Norixo.",
};

export default function LegalPage() {
  return (
    <MarketingPageShell>
      <div className="mx-auto max-w-2xl px-4 py-16 sm:px-6 sm:py-20">
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
          Légal
        </p>
        <h1 className="mt-3 text-2xl font-semibold tracking-tight text-white sm:text-3xl">
          Mentions légales
        </h1>
        <div className="mt-8 space-y-4 text-sm leading-7 text-slate-300">
          <p>
            <strong className="text-slate-200">Éditeur du site :</strong> Norixo — société ou
            entrepreneur individuel responsable du service « Norixo Optimize » (informations
            détaillées complétées selon votre statut juridique et votre siège réel).
          </p>
          <p>
            <strong className="text-slate-200">Hébergement :</strong> le site est hébergé sur une
            infrastructure cloud conforme aux usages courants des applications web (par ex.
            Vercel ou équivalent — à préciser en interne).
          </p>
          <p>
            <strong className="text-slate-200">Propriété intellectuelle :</strong> les contenus,
            marques et éléments graphiques du site sont la propriété de Norixo ou de ses
            partenaires, sauf mention contraire.
          </p>
          <p>
            Pour toute réclamation ou demande liée au site, voir la page{" "}
            <Link href="/contact" className="font-medium text-orange-300 underline-offset-4 hover:underline">
              Contact
            </Link>
            .
          </p>
        </div>
        <p className="mt-10">
          <Link
            href="/"
            className="text-sm font-medium text-slate-400 underline-offset-4 transition-colors hover:text-white hover:underline"
          >
            ← Retour à l’accueil
          </Link>
        </p>
      </div>
    </MarketingPageShell>
  );
}

import type { Metadata } from "next";
import Link from "next/link";

import { MarketingPageShell } from "@/components/marketing/MarketingPageShell";

export const metadata: Metadata = {
  title: "Contact | Norixo",
  description: "Contactez l’équipe Norixo pour toute question sur Norixo Optimize.",
};

export default function ContactPage() {
  return (
    <MarketingPageShell>
      <div className="mx-auto max-w-2xl px-4 py-16 sm:px-6 sm:py-20">
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
          Contact
        </p>
        <h1 className="mt-3 text-2xl font-semibold tracking-tight text-white sm:text-3xl">
          Contactez-nous
        </h1>
        <div className="mt-8 space-y-4 text-sm leading-7 text-slate-300">
          <p>
            Pour toute question sur le produit, la facturation ou vos données personnelles,
            écrivez-nous à l’adresse e-mail utilisée pour le support client (à configurer en
            production, par ex. <span className="text-slate-200">support@votredomaine.com</span>
            ).
          </p>
          <p>
            Nous répondons dans les meilleurs délais ouvrés. Pour les demandes liées au RGPD,
            précisez l’objet « Données personnelles » dans le sujet du message.
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

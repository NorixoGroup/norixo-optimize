import type { Metadata } from "next";
import Link from "next/link";

import { MarketingPageShell } from "@/components/marketing/MarketingPageShell";

export const metadata: Metadata = {
  title: "Politique de confidentialité | Norixo",
  description:
    "Informations sur le traitement des données personnelles dans le cadre du service Norixo Optimize.",
};

export default function PrivacyPage() {
  return (
    <MarketingPageShell>
      <div className="mx-auto max-w-2xl px-4 py-16 sm:px-6 sm:py-20">
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
          Légal
        </p>
        <h1 className="mt-3 text-2xl font-semibold tracking-tight text-white sm:text-3xl">
          Politique de confidentialité
        </h1>
        <div className="mt-8 space-y-4 text-sm leading-7 text-slate-300">
          <p>
            Cette page décrit, à titre informatif, l’approche générale de Norixo concernant les
            données personnelles liées à l’utilisation de ses services en ligne. Pour toute
            question précise, utilisez la page{" "}
            <Link href="/contact" className="font-medium text-orange-300 underline-offset-4 hover:underline">
              Contact
            </Link>
            .
          </p>
          <p>
            Les traitements détaillés (hébergeur, outils d’analyse, prestataires de paiement,
            etc.) sont communiqués dans le cadre de votre relation contractuelle ou sur demande.
          </p>
          <p>
            Conformément au RGPD, vous pouvez exercer vos droits d’accès, de rectification, de
            suppression et d’opposition en nous contactant via les coordonnées indiquées sur la page
            contact.
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

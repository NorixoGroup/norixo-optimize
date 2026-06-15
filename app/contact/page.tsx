import type { Metadata } from "next";

import { MarketingPageShell } from "@/components/marketing/MarketingPageShell";
import { ContactContent } from "@/components/marketing/ContactContent";

export const metadata: Metadata = {
  title: "Contact | Norixo",
  description: "Contactez l’équipe Norixo pour toute question sur Norixo Optimize.",
  alternates: {
    canonical: "/contact",
  },
  openGraph: {
    title: "Contact | Norixo",
    description: "Contactez l’équipe Norixo pour toute question sur Norixo Optimize.",
    url: "/contact",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Contact | Norixo",
    description: "Contactez l’équipe Norixo pour toute question sur Norixo Optimize.",
  },
};

export default function ContactPage() {
  return (
    <MarketingPageShell>
      <ContactContent />
    </MarketingPageShell>
  );
}

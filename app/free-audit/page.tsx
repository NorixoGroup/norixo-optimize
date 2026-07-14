import type { Metadata } from "next";

import { FreeAuditContent } from "@/app/free-audit/FreeAuditContent";
import { getFreeAuditSeoCopy } from "@/app/free-audit/freeAuditTranslations";
import { buildHreflangAlternates } from "@/lib/seo/hreflang";

const seoCopy = getFreeAuditSeoCopy("en");
const alternates = buildHreflangAlternates("/free-audit");

export const metadata: Metadata = {
  title: seoCopy.title,
  description: seoCopy.description,
  alternates: {
    ...alternates,
    languages: {
      ...alternates.languages,
      "x-default": "https://norixo.io",
    },
  },
  openGraph: {
    title: seoCopy.title,
    description: seoCopy.description,
    url: "/free-audit",
    type: "website",
    locale: "en_US",
  },
  twitter: {
    card: "summary_large_image",
    title: seoCopy.title,
    description: seoCopy.description,
  },
};

export default function FreeAuditPage() {
  return <FreeAuditContent />;
}

import type { Metadata } from "next";

import { FreeAuditListingContent } from "@/app/(default)/free-audit/FreeAuditListingContent";
import { getFreeAuditListingSeoCopy } from "@/app/(default)/free-audit/freeAuditListingSeoCopy";
import { buildHreflangAlternates } from "@/lib/seo/hreflang";

const siteUrl = (
  process.env.NEXT_PUBLIC_SITE_URL ?? "https://norixo.io"
).replace(/\/$/, "");
const seoCopy = getFreeAuditListingSeoCopy("en");
const alternates = buildHreflangAlternates("/free-audit");
const socialImage = "/og/free-listing-audit.png";

export const metadata: Metadata = {
  title: seoCopy.title,
  description: seoCopy.description,
  alternates,
  openGraph: {
    title: seoCopy.title,
    description: seoCopy.description,
    url: "/free-audit",
    siteName: "Norixo",
    type: "website",
    locale: "en_US",
    images: [
      {
        url: socialImage,
        width: 1200,
        height: 630,
        alt: seoCopy.title,
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: seoCopy.title,
    description: seoCopy.description,
    images: [socialImage],
  },
};

const freeAuditJsonLd = [
  {
    "@context": "https://schema.org",
    "@type": "WebPage",
    "@id": `${siteUrl}/free-audit#webpage`,
    url: `${siteUrl}/free-audit`,
    name: seoCopy.title,
    description: seoCopy.description,
    isPartOf: { "@id": `${siteUrl}/#website` },
    about: { "@id": `${siteUrl}/#software` },
    mainEntity: { "@id": `${siteUrl}/#software` },
  },
  {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      {
        "@type": "ListItem",
        position: 1,
        name: "Home",
        item: siteUrl,
      },
      {
        "@type": "ListItem",
        position: 2,
        name: "Free audit",
        item: `${siteUrl}/free-audit`,
      },
    ],
  },
];

export default function FreeAuditPage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(freeAuditJsonLd).replace(/</g, "\\u003c"),
        }}
      />
      <FreeAuditListingContent />
    </>
  );
}

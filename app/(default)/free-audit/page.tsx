import type { Metadata } from "next";

import { FreeAuditContent } from "@/app/(default)/free-audit/FreeAuditContent";
import { buildHreflangAlternates } from "@/lib/seo/hreflang";

const siteUrl = (
  process.env.NEXT_PUBLIC_SITE_URL ?? "https://norixo.io"
).replace(/\/$/, "");
const pageTitle = "Free Airbnb listing audit preview & market analyzer | Norixo";
const pageDescription =
  "Use Norixo's free Airbnb and Booking market analyzer to see price range, median and confidence, then continue to a full listing audit.";
const alternates = buildHreflangAlternates("/free-audit");
const socialImage = "/og/free-airbnb-market-snapshot.png";

export const metadata: Metadata = {
  title: pageTitle,
  description: pageDescription,
  alternates,
  openGraph: {
    title: pageTitle,
    description: pageDescription,
    url: "/free-audit",
    siteName: "Norixo",
    type: "website",
    locale: "en_US",
    images: [
      {
        url: socialImage,
        width: 1200,
        height: 630,
        alt: pageTitle,
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: pageTitle,
    description: pageDescription,
    images: [socialImage],
  },
};

const freeAuditJsonLd = [
  {
    "@context": "https://schema.org",
    "@type": "WebPage",
    "@id": `${siteUrl}/free-audit#webpage`,
    url: `${siteUrl}/free-audit`,
    name: pageTitle,
    description: pageDescription,
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
      <FreeAuditContent />
    </>
  );
}

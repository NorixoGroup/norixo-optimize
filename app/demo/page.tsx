import type { Metadata } from "next";
import { DemoContent } from "@/components/marketing/DemoContent";
import { VideoObjectJsonLd } from "@/components/seo/VideoObjectJsonLd";
import { buildHreflangAlternates } from "@/lib/seo/hreflang";

const siteUrl = (
  process.env.NEXT_PUBLIC_SITE_URL ?? "https://norixo.io"
).replace(/\/$/, "");
const pageTitle = "Norixo Optimize Demo – Airbnb & Booking listing audit";
const pageDescription =
  "See how Norixo Optimize analyzes your Airbnb and Booking listings, highlights optimization priorities, and turns insights into practical actions.";
const alternates = buildHreflangAlternates("/demo");
const socialImage = "/marketing/norixo-demo-thumbnail.jpg";

export const metadata: Metadata = {
  title: pageTitle,
  description: pageDescription,
  alternates,
  openGraph: {
    title: pageTitle,
    description: pageDescription,
    url: "/demo",
    siteName: "Norixo",
    type: "website",
    locale: "en_US",
    images: [
      {
        url: socialImage,
        width: 1200,
        height: 675,
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

const demoJsonLd = {
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
      name: "Demo",
      item: `${siteUrl}/demo`,
    },
  ],
};

export default function DemoPage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(demoJsonLd).replace(/</g, "\\u003c"),
        }}
      />
      <VideoObjectJsonLd
        name={pageTitle}
        description={pageDescription}
        contentUrl="/marketing/norixo-demo-en.mp4"
        pageUrl="/demo"
        language="en"
      />
      <DemoContent />
    </>
  );
}

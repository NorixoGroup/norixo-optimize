import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { I18nProvider } from "@/components/i18n/I18nProvider";
import Footer from "@/components/Footer";
import type { Locale } from "@/data/i18n";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const siteUrl = (
  process.env.NEXT_PUBLIC_SITE_URL ?? "https://norixo.io"
).replace(/\/$/, "");
const defaultTitle = "Norixo";
const defaultDescription =
  "Audit and optimize your short-term rental listings for higher conversion.";
const organizationJsonLd = {
  "@context": "https://schema.org",
  "@type": "Organization",
  "@id": `${siteUrl}/#organization`,
  name: "Norixo",
  legalName: "CONCIERGERIE SHORT RENTAL",
  url: siteUrl,
  logo: `${siteUrl}/favicon.png`,
  email: "support@norixo.io",
  address: {
    "@type": "PostalAddress",
    streetAddress: "201 BD MUSTAPHA EL MAANI, 2nd Floor, Apartment 9",
    addressLocality: "Casablanca",
    addressRegion: "Casablanca-Settat",
    addressCountry: "MA",
  },
  contactPoint: {
    "@type": "ContactPoint",
    contactType: "customer support",
    email: "support@norixo.io",
    availableLanguage: ["en", "fr"],
  },
};
const websiteJsonLd = {
  "@context": "https://schema.org",
  "@type": "WebSite",
  "@id": `${siteUrl}/#website`,
  name: "Norixo",
  url: siteUrl,
  publisher: {
    "@id": `${siteUrl}/#organization`,
  },
};

export const rootMetadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: defaultTitle,
  description: defaultDescription,
  icons: {
    icon: "/favicon.png",
    shortcut: "/favicon.png",
    apple: "/favicon.png",
  },
  openGraph: {
    title: defaultTitle,
    description: defaultDescription,
    url: `${siteUrl}/`,
    siteName: "Norixo",
    type: "website",
    locale: "en_US",
    images: [
      {
        url: "/og-cover.png",
        width: 1200,
        height: 630,
        alt: defaultTitle,
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: defaultTitle,
    description: defaultDescription,
    images: ["/og-cover.png"],
  },
};

type RootDocumentShellProps = Readonly<{
  children: React.ReactNode;
  locale: Locale;
  lang: string;
  dir: "ltr" | "rtl";
}>;

export function RootDocumentShell({
  children,
  locale,
  lang,
  dir,
}: RootDocumentShellProps) {
  return (
    <html lang={lang} dir={dir} suppressHydrationWarning>
      <head />
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify([organizationJsonLd, websiteJsonLd]).replace(
              /</g,
              "\\u003c",
            ),
          }}
        />
        <I18nProvider initialLocale={locale}>
          <div className="min-h-screen flex flex-col">
            <div className="flex-1">{children}</div>
            <Footer />
          </div>
        </I18nProvider>
      </body>
    </html>
  );
}

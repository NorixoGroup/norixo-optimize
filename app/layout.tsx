import type { Metadata } from "next";
import { headers } from "next/headers";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { I18nProvider } from "@/components/i18n/I18nProvider";
import Footer from "@/components/Footer";
import { defaultLocale, isLocale, type Locale } from "@/data/i18n";
import { getSeoLocaleConfig } from "@/lib/seo/seoLocales";

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
const defaultTitle = "Listing Conversion Optimizer";
const defaultDescription =
  "Audit and optimize your short-term rental listings for higher conversion.";

export const metadata: Metadata = {
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
    siteName: defaultTitle,
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

function resolveDocumentLocale(locale: string | undefined): Locale {
  if (locale && isLocale(locale)) {
    return locale;
  }

  return defaultLocale;
}

function getDocumentDirection(locale: Locale) {
  return locale === "ar" ? "rtl" : "ltr";
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const requestHeaders = await headers();
  const locale = resolveDocumentLocale(
    requestHeaders.get("x-norixo-locale") ?? undefined,
  );
  const htmlLang = getSeoLocaleConfig(locale).htmlLang;
  const dir = getDocumentDirection(locale);
  const defaultHtmlLang = getSeoLocaleConfig(defaultLocale).htmlLang;
  const defaultDir = getDocumentDirection(defaultLocale);
  const earlyHtmlLangDirSync = `(function(){var seg=window.location.pathname.split("/").filter(Boolean)[0];var map={fr:"fr",es:"es",de:"de",it:"it",pt:"pt",nl:"nl",ja:"ja",zh:"zh-CN",ko:"ko",ar:"ar"};var lang=map[seg]||"${defaultHtmlLang}";var dir=seg==="ar"?"rtl":"ltr";if(!seg){dir="${defaultDir}";}document.documentElement.lang=lang;document.documentElement.dir=dir;})();`;

  return (
    <html lang={htmlLang} dir={dir} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: earlyHtmlLangDirSync }} />
      </head>
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
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

import type { Metadata } from "next";
import Link from "next/link";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const siteUrl = (
  process.env.NEXT_PUBLIC_SITE_URL ?? "https://norixo-optimize.vercel.app"
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

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        <div className="min-h-screen flex flex-col">
          <div className="flex-1">{children}</div>
          <footer className="border-t border-white/15 bg-slate-100/60 text-blue-800 backdrop-blur-md">
            <div className="mx-auto w-full max-w-[1600px] px-4 py-5 sm:px-6">
              <div className="flex flex-col items-center gap-3 text-xs">
                <nav className="flex flex-wrap items-center justify-center gap-4 sm:gap-6">
                  <Link href="/privacy" className="font-semibold text-blue-700 transition-colors hover:text-blue-800 hover:underline underline-offset-4">
                    Politique de confidentialité
                  </Link>
                  <Link href="/legal" className="font-semibold text-blue-700 transition-colors hover:text-blue-800 hover:underline underline-offset-4">
                    Mentions légales
                  </Link>
                  <Link href="/contact" className="font-semibold text-blue-700 transition-colors hover:text-blue-800 hover:underline underline-offset-4">
                    Contactez-nous
                  </Link>
                </nav>
                <p className="text-[11px] text-blue-700/75">© 2026 Norixo. Tous droits réservés.</p>
              </div>
            </div>
          </footer>
        </div>
      </body>
    </html>
  );
}

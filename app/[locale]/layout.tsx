import "../globals.css";
import { notFound } from "next/navigation";
import { defaultLocale, isLocale, locales, type Locale } from "@/data/i18n";
import { RootDocumentShell, rootMetadata } from "@/app/rootLayoutShared";

type Props = Readonly<{
  children: React.ReactNode;
  params: Promise<{
    locale: string;
  }>;
}>;

export function generateStaticParams() {
  return locales
    .filter((locale) => locale.code !== defaultLocale)
    .map((locale) => ({
      locale: locale.code,
    }));
}

export const metadata = rootMetadata;

export default async function LocaleLayout({ children, params }: Props) {
  const { locale } = await params;

  if (!isLocale(locale) || locale === defaultLocale) {
    notFound();
  }

  const resolvedLocale = locale as Locale;
  const dir = resolvedLocale === "ar" ? "rtl" : "ltr";

  return (
    <RootDocumentShell locale={resolvedLocale} lang={resolvedLocale} dir={dir}>
      {children}
    </RootDocumentShell>
  );
}

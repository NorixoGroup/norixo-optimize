import { notFound } from "next/navigation";
import { I18nProvider } from "@/components/i18n/I18nProvider";
import { defaultLocale, isLocale, locales, type Locale } from "@/data/i18n";

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

export default async function LocaleLayout({ children, params }: Props) {
  const { locale } = await params;

  if (!isLocale(locale) || locale === defaultLocale) {
    notFound();
  }

  return <I18nProvider initialLocale={locale as Locale}>{children}</I18nProvider>;
}

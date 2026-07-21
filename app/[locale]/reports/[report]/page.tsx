import type { Metadata } from "next";
import { notFound } from "next/navigation";

import {
  IPP_REPORT_VIEW_LOCALES,
  type IppMarketReportViewLocale,
  default as IppMarketReportView,
} from "@/components/reports/IppMarketReportView";
import { defaultLocale, isLocale } from "@/data/i18n";
import {
  buildDefaultNextPublicationCatalog,
  buildNextLocalizedStaticParams,
  buildNextMetadataFromPublication,
  getNextPublicationCards,
  resolveNextPublicationForLocalizedRoute,
} from "@/lib/intelligencePublishing/nextWebPublicationAdapter";

const reportsCatalog = buildDefaultNextPublicationCatalog();
const reportCards = getNextPublicationCards(reportsCatalog);

type Props = Readonly<{
  params: Promise<{
    locale: string;
    report: string;
  }>;
}>;

export function generateStaticParams() {
  return [...buildNextLocalizedStaticParams(reportsCatalog)];
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, report } = await params;
  if (!isLocale(locale) || locale === defaultLocale) {
    return {};
  }
  const resolution = resolveNextPublicationForLocalizedRoute(
    reportsCatalog,
    locale,
    report,
  );
  if (!resolution.found) {
    return {};
  }
  return buildNextMetadataFromPublication(resolution);
}

export default async function LocalizedMarketReportPage({ params }: Props) {
  const { locale, report } = await params;
  if (!isLocale(locale) || locale === defaultLocale) {
    notFound();
  }

  const resolution = resolveNextPublicationForLocalizedRoute(
    reportsCatalog,
    locale,
    report,
  );
  if (!resolution.found || resolution.entry == null) {
    notFound();
  }

  const manifestLocale =
    resolution.entry.manifest?.route.canonical.locale.toLowerCase() ?? null;
  if (
    manifestLocale == null ||
    manifestLocale !== locale ||
    !IPP_REPORT_VIEW_LOCALES.includes(
      manifestLocale as IppMarketReportViewLocale,
    )
  ) {
    notFound();
  }

  const relatedCards = reportCards.filter(
    (card) => card.href !== resolution.canonicalPath,
  );
  return (
    <IppMarketReportView
      locale={manifestLocale as IppMarketReportViewLocale}
      resolution={resolution}
      relatedCards={relatedCards}
    />
  );
}

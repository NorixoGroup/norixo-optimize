import { notFound } from "next/navigation";
import type { Metadata } from "next";

import IppMarketReportView from "@/components/reports/IppMarketReportView";
import {
  buildDefaultNextPublicationCatalog,
  buildNextMetadataFromPublication,
  getNextPublicationCards,
  resolveNextPublicationBySlug,
} from "@/lib/intelligencePublishing/nextWebPublicationAdapter";

const PILOT_SLUG = "airbnb-market-report-barcelona-apartment";
const reportsCatalog = buildDefaultNextPublicationCatalog();
const reportCards = getNextPublicationCards(reportsCatalog);

export function generateMetadata(): Metadata {
  const resolution = resolveNextPublicationBySlug(reportsCatalog, PILOT_SLUG);
  if (!resolution.found) {
    return {};
  }
  return buildNextMetadataFromPublication(resolution);
}

export default function BarcelonaApartmentPilotPage() {
  const resolution = resolveNextPublicationBySlug(reportsCatalog, PILOT_SLUG);
  if (!resolution.found || resolution.entry == null) {
    notFound();
  }

  const relatedCards = reportCards.filter(
    (card) => card.href !== resolution.canonicalPath,
  );

  return (
    <IppMarketReportView
      resolution={resolution}
      relatedCards={relatedCards}
    />
  );
}

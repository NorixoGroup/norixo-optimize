import type { Metadata } from "next";
import type { MarketReport } from "@/data/marketReports";

export function buildMarketReportMetadata(report: MarketReport): Metadata {
  const title = `${report.title} | Norixo`;
  const description = report.description;
  const url = `https://norixo.io/reports/${report.slug}`;

  return {
    title,
    description,
    keywords: [
      report.title,
      "Airbnb market report",
      "Airbnb pricing report",
      "Airbnb market analysis",
      "Airbnb optimization",
      "short-term rental market report",
      "Norixo",
    ],
    alternates: {
      canonical: url,
    },
    openGraph: {
      title,
      description,
      url,
      siteName: "Norixo",
      type: "article",
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
    },
  };
}

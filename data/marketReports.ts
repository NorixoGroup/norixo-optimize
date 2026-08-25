import { cities } from "@/data/cities";

export type MarketReport = {
  slug: string;
  citySlug: string;
  title: string;
  description: string;
};

export const marketReports: MarketReport[] = [
  {
    slug: "airbnb-market-report-paris",
    citySlug: "paris",
    title: "Airbnb Market Report Paris",
    description:
      "City-specific Airbnb listing optimization guidance and resources for Paris hosts.",
  },
  {
    slug: "airbnb-market-report-marrakech",
    citySlug: "marrakech",
    title: "Airbnb Market Report Marrakech",
    description:
      "City-specific Airbnb listing optimization guidance and resources for Marrakech hosts.",
  },
  {
    slug: "airbnb-market-report-dubai",
    citySlug: "dubai",
    title: "Airbnb Market Report Dubai",
    description:
      "City-specific Airbnb listing optimization guidance and resources for Dubai hosts.",
  },
  {
    slug: "airbnb-market-report-tokyo",
    citySlug: "tokyo",
    title: "Airbnb Market Report Tokyo",
    description:
      "City-specific Airbnb listing optimization guidance and resources for Tokyo hosts.",
  },
  {
    slug: "airbnb-market-report-barcelona",
    citySlug: "barcelona",
    title: "Airbnb Market Report Barcelona",
    description:
      "City-specific Airbnb listing optimization guidance and resources for Barcelona hosts.",
  },
  {
    slug: "airbnb-market-report-new-york",
    citySlug: "new-york",
    title: "Airbnb Market Report New York",
    description:
      "City-specific Airbnb listing optimization guidance and resources for New York hosts.",
  },
];

export function getMarketReportBySlug(slug: string) {
  return marketReports.find((report) => report.slug === slug);
}

export function getMarketReportCity(report: MarketReport) {
  return cities.find((city) => city.slug === report.citySlug);
}

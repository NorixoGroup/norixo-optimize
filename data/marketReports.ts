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
      "Airbnb market report for Paris with pricing, competition, guest expectations and listing optimization insights.",
  },
  {
    slug: "airbnb-market-report-marrakech",
    citySlug: "marrakech",
    title: "Airbnb Market Report Marrakech",
    description:
      "Airbnb market report for Marrakech with pricing, competition, guest expectations and listing optimization insights.",
  },
  {
    slug: "airbnb-market-report-dubai",
    citySlug: "dubai",
    title: "Airbnb Market Report Dubai",
    description:
      "Airbnb market report for Dubai with pricing, competition, guest expectations and listing optimization insights.",
  },
  {
    slug: "airbnb-market-report-tokyo",
    citySlug: "tokyo",
    title: "Airbnb Market Report Tokyo",
    description:
      "Airbnb market report for Tokyo with pricing, competition, guest expectations and listing optimization insights.",
  },
  {
    slug: "airbnb-market-report-barcelona",
    citySlug: "barcelona",
    title: "Airbnb Market Report Barcelona",
    description:
      "Airbnb market report for Barcelona with pricing, competition, guest expectations and listing optimization insights.",
  },
  {
    slug: "airbnb-market-report-new-york",
    citySlug: "new-york",
    title: "Airbnb Market Report New York",
    description:
      "Airbnb market report for New York with pricing, competition, guest expectations and listing optimization insights.",
  },
];

export function getMarketReportBySlug(slug: string) {
  return marketReports.find((report) => report.slug === slug);
}

export function getMarketReportCity(report: MarketReport) {
  return cities.find((city) => city.slug === report.citySlug);
}

export type LocalSeoTopic = {
  slug: string;
  label: string;
  titleSuffix: string;
  description: string;
  guideSlug: string;
};

export const localSeoTopics: LocalSeoTopic[] = [
  {
    slug: "pricing-guide",
    label: "Pricing guide",
    titleSuffix: "Airbnb Pricing Guide",
    description:
      "Understand local Airbnb pricing, competition, seasonality, and perceived value.",
    guideSlug: "airbnb-pricing-optimization",
  },
  {
    slug: "seo-guide",
    label: "SEO guide",
    titleSuffix: "Airbnb SEO Guide",
    description:
      "Improve local Airbnb visibility, ranking signals, title clarity, and guest trust.",
    guideSlug: "airbnb-seo",
  },
  {
    slug: "photo-tips",
    label: "Photo tips",
    titleSuffix: "Airbnb Photo Tips",
    description:
      "Improve Airbnb photos to increase clicks, perceived value, and booking confidence.",
    guideSlug: "airbnb-photo-optimization",
  },
  {
    slug: "title-optimization",
    label: "Title optimization",
    titleSuffix: "Airbnb Title Optimization Guide",
    description:
      "Improve Airbnb titles with clearer positioning, stronger intent, and better guest relevance.",
    guideSlug: "airbnb-listing-optimization",
  },
  {
    slug: "description-optimization",
    label: "Description optimization",
    titleSuffix: "Airbnb Description Optimization Guide",
    description:
      "Write clearer Airbnb descriptions that improve trust, reduce uncertainty, and support bookings.",
    guideSlug: "airbnb-listing-optimization",
  },
  {
    slug: "amenities-guide",
    label: "Amenities guide",
    titleSuffix: "Airbnb Amenities Guide",
    description:
      "Understand which amenities matter most locally and how to present them clearly to guests.",
    guideSlug: "airbnb-listing-optimization",
  },
  {
    slug: "guest-trust-guide",
    label: "Guest trust guide",
    titleSuffix: "Airbnb Guest Trust Guide",
    description:
      "Strengthen guest trust with better reassurance, clearer rules, reviews, and listing signals.",
    guideSlug: "airbnb-conversion-optimization",
  },
  {
    slug: "booking-conversion",
    label: "Booking conversion",
    titleSuffix: "Airbnb Booking Conversion Guide",
    description:
      "Improve the path from listing view to booking with stronger clarity, pricing, photos, and trust.",
    guideSlug: "airbnb-conversion-optimization",
  },
  {
    slug: "ranking-factors",
    label: "Ranking factors",
    titleSuffix: "Airbnb Ranking Factors Guide",
    description:
      "Understand local ranking signals that influence Airbnb visibility, clicks, and booking decisions.",
    guideSlug: "airbnb-seo",
  },
  {
    slug: "search-visibility",
    label: "Search visibility",
    titleSuffix: "Airbnb Search Visibility Guide",
    description:
      "Improve Airbnb search visibility with clearer relevance, stronger listing signals, and better performance.",
    guideSlug: "airbnb-seo",
  },
  {
    slug: "occupancy-guide",
    label: "Occupancy guide",
    titleSuffix: "Airbnb Occupancy Guide",
    description:
      "Understand how local demand, pricing, presentation, and competition influence occupancy.",
    guideSlug: "airbnb-pricing-optimization",
  },
  {
    slug: "revenue-optimization",
    label: "Revenue optimization",
    titleSuffix: "Airbnb Revenue Optimization Guide",
    description:
      "Improve Airbnb revenue by aligning pricing, conversion quality, guest trust, and market positioning.",
    guideSlug: "airbnb-pricing-optimization",
  },
  {
    slug: "competitor-analysis",
    label: "Competitor analysis",
    titleSuffix: "Airbnb Competitor Analysis Guide",
    description:
      "Compare your listing against local competitors to identify gaps in price, photos, trust, and positioning.",
    guideSlug: "airbnb-listing-audit",
  },
  {
    slug: "listing-audit",
    label: "Listing audit",
    titleSuffix: "Airbnb Listing Audit Guide",
    description:
      "Audit an Airbnb listing locally to identify the most important blockers and optimization priorities.",
    guideSlug: "airbnb-listing-audit",
  },
  {
    slug: "photo-order",
    label: "Photo order",
    titleSuffix: "Airbnb Photo Order Guide",
    description:
      "Improve Airbnb photo order to show the strongest value first and increase guest confidence.",
    guideSlug: "airbnb-photo-optimization",
  },
  {
    slug: "first-photo",
    label: "First photo",
    titleSuffix: "Airbnb First Photo Guide",
    description:
      "Choose a stronger first photo to improve clicks, perceived value, and listing performance.",
    guideSlug: "airbnb-photo-optimization",
  },
  {
    slug: "review-strategy",
    label: "Review strategy",
    titleSuffix: "Airbnb Review Strategy Guide",
    description:
      "Use reviews and guest feedback to improve trust, clarity, and booking confidence.",
    guideSlug: "airbnb-conversion-optimization",
  },
  {
    slug: "pricing-positioning",
    label: "Pricing positioning",
    titleSuffix: "Airbnb Pricing Positioning Guide",
    description:
      "Position Airbnb pricing against local competition while keeping value clear to guests.",
    guideSlug: "airbnb-pricing-optimization",
  },
  {
    slug: "seasonality-guide",
    label: "Seasonality guide",
    titleSuffix: "Airbnb Seasonality Guide",
    description:
      "Adapt Airbnb pricing, presentation, and positioning to local seasonal demand patterns.",
    guideSlug: "airbnb-pricing-optimization",
  },
  {
    slug: "family-travel-guide",
    label: "Family travel guide",
    titleSuffix: "Airbnb Family Travel Guide",
    description:
      "Optimize listings for families with clearer layouts, practical amenities, reassurance, and photos.",
    guideSlug: "airbnb-listing-optimization",
  },
  {
    slug: "business-travel-guide",
    label: "Business travel guide",
    titleSuffix: "Airbnb Business Travel Guide",
    description:
      "Improve listings for business travelers with clearer work-friendly amenities, access details, and trust signals.",
    guideSlug: "airbnb-listing-optimization",
  },
  {
    slug: "long-stay-guide",
    label: "Long stay guide",
    titleSuffix: "Airbnb Long Stay Guide",
    description:
      "Optimize Airbnb listings for longer stays with better amenities, pricing, workspace, and practical details.",
    guideSlug: "airbnb-listing-optimization",
  },
  {
    slug: "local-demand-guide",
    label: "Local demand guide",
    titleSuffix: "Airbnb Local Demand Guide",
    description:
      "Understand local guest demand and align your Airbnb listing with the trips guests are actually planning.",
    guideSlug: "airbnb-listing-audit",
  },
  {
    slug: "market-analysis",
    label: "Market analysis",
    titleSuffix: "Airbnb Market Analysis",
    description:
      "Analyze local Airbnb demand, competition, guest expectations, and listing positioning.",
    guideSlug: "airbnb-listing-audit",
  },
  {
    slug: "conversion-guide",
    label: "Conversion guide",
    titleSuffix: "Airbnb Conversion Guide",
    description:
      "Turn more listing views into bookings with stronger trust, pricing, photos, and copy.",
    guideSlug: "airbnb-conversion-optimization",
  },
];

export function getLocalSeoTopicBySlug(slug: string) {
  return localSeoTopics.find((topic) => topic.slug === slug);
}

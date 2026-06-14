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

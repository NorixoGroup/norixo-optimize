import { cities } from "./cities";

export type Country = {
  slug: string;
  name: string;
  continent: string;
  marketSummary: string;
  pricingSummary: string;
  competitionSummary: string;
  featuredCities: string[];
};

const countrySeeds: Omit<Country, "featuredCities">[] = [
  {
    slug: "france",
    name: "France",
    continent: "Europe",
    marketSummary: "France is one of the strongest short-term rental markets in the world, combining major city demand, coastal destinations, ski resorts, wine regions, and cultural tourism.",
    pricingSummary: "Pricing in France varies strongly by season, city, neighborhood, events, and guest expectations around design, comfort, and location.",
    competitionSummary: "French Airbnb listings compete on photography, trust signals, location clarity, amenities, reviews, and how well the listing matches guest intent.",
  },
  {
    slug: "morocco",
    name: "Morocco",
    continent: "Africa",
    marketSummary: "Morocco is a high-potential Airbnb market combining cultural cities, beach destinations, desert stays, riads, apartments, villas, and fast-growing domestic and international demand.",
    pricingSummary: "Pricing in Morocco depends heavily on city, property type, seasonality, neighborhood, guest profile, and the perceived quality of the listing presentation.",
    competitionSummary: "Moroccan listings compete on authenticity, photos, trust, location explanation, amenities, cleanliness, and the ability to reassure international travelers.",
  },
  {
    slug: "spain",
    name: "Spain",
    continent: "Europe",
    marketSummary: "Spain is a major European short-term rental market with strong demand across city breaks, islands, beaches, cultural tourism, and long-stay remote work.",
    pricingSummary: "Pricing in Spain is highly seasonal and depends on coastal demand, city events, neighborhood quality, and competition density.",
    competitionSummary: "Spanish Airbnb listings compete through design, photos, reviews, location, amenities, and how clearly they communicate value.",
  },
  {
    slug: "italy",
    name: "Italy",
    continent: "Europe",
    marketSummary: "Italy combines world-class tourism cities, coastal destinations, historic towns, and luxury leisure markets, making it a powerful Airbnb country page opportunity.",
    pricingSummary: "Pricing in Italy changes significantly by destination, season, property charm, location, and visual appeal.",
    competitionSummary: "Italian listings compete on authenticity, design, views, walkability, reviews, and how strongly the listing tells a credible stay story.",
  },
  {
    slug: "united-states",
    name: "United States",
    continent: "North America",
    marketSummary: "The United States is one of the largest short-term rental markets globally, covering urban apartments, beach homes, cabins, villas, event destinations, and business travel markets.",
    pricingSummary: "Pricing in the United States depends on local demand, events, seasonality, regulation, amenities, and competitive positioning.",
    competitionSummary: "US listings compete on professional presentation, strong amenities, review quality, location clarity, and conversion-focused listing copy.",
  },
  {
    slug: "canada",
    name: "Canada",
    continent: "North America",
    marketSummary: "Canada offers strong short-term rental demand across major cities, ski destinations, nature stays, business travel, and cultural tourism.",
    pricingSummary: "Pricing in Canada varies by province, season, city, events, and proximity to nature or urban centers.",
    competitionSummary: "Canadian listings compete on cleanliness, amenities, comfort, location, guest trust, and winter or nature-related positioning.",
  },
  {
    slug: "portugal",
    name: "Portugal",
    continent: "Europe",
    marketSummary: "Portugal is a strong Airbnb market driven by city breaks, coastal demand, digital nomads, wine tourism, and long-stay international guests.",
    pricingSummary: "Pricing in Portugal depends on seasonality, coastal proximity, city demand, property design, and guest expectations.",
    competitionSummary: "Portuguese listings compete on brightness, design, outdoor space, location, reviews, and value clarity.",
  },
  {
    slug: "greece",
    name: "Greece",
    continent: "Europe",
    marketSummary: "Greece is a highly seasonal Airbnb market with strong demand for islands, beaches, historic cities, villas, and scenic stays.",
    pricingSummary: "Pricing in Greece is driven by season, island demand, views, outdoor space, and proximity to beaches or landmarks.",
    competitionSummary: "Greek listings compete on photography, views, terraces, location, authenticity, and guest confidence.",
  },
  {
    slug: "japan",
    name: "Japan",
    continent: "Asia",
    marketSummary: "Japan combines global tourism demand, city stays, cultural travel, business trips, and strong interest in unique local experiences.",
    pricingSummary: "Pricing in Japan depends on city, station access, seasonality, local events, and listing efficiency.",
    competitionSummary: "Japanese listings compete on cleanliness, transport access, clarity, compact-space presentation, and trust.",
  },
  {
    slug: "thailand",
    name: "Thailand",
    continent: "Asia",
    marketSummary: "Thailand is a major Airbnb destination combining city stays, islands, beach markets, digital nomads, and long-stay leisure demand.",
    pricingSummary: "Pricing in Thailand depends on beach access, seasonality, property amenities, views, and long-stay appeal.",
    competitionSummary: "Thai listings compete on pools, design, location, service quality, photos, and perceived value.",
  },
];

export const countries: Country[] = countrySeeds.map((country) => ({
  ...country,
  featuredCities: cities
    .filter((city) => city.country === country.name)
    .map((city) => city.slug),
}));

export function getCountryBySlug(slug: string) {
  return countries.find((country) => country.slug === slug);
}

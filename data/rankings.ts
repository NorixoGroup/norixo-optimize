export type RankingItem = {
  citySlug?: string;
  countrySlug?: string;
  name: string;
  description: string;
  reason: string;
};

export type RankingScope =
  | { kind: "global" }
  | { kind: "country"; countrySlug: string }
  | { kind: "region"; slug: string }
  | { kind: "audience"; slug: string };

export type Ranking = {
  slug: string;
  scope: RankingScope;
  title: string;
  description: string;
  heroTitle: string;
  heroSubtitle: string;
  intro: string;
  items: RankingItem[];
  faq: {
    question: string;
    answer: string;
  }[];
};

export const rankings: Ranking[] = [
  {
    slug: "best-airbnb-cities",
    scope: { kind: "global" },
    title: "Best Airbnb Cities",
    description:
      "Explore some of the best Airbnb cities for listing optimization, pricing strategy, guest demand, and short-term rental competition.",
    heroTitle: "Best Airbnb cities for hosts and property managers",
    heroSubtitle:
      "Explore high-demand Airbnb markets where listing quality, pricing, SEO, and conversion can make a major difference.",
    intro:
      "The best Airbnb cities are not only the biggest tourist destinations. They are markets where demand, competition, pricing, guest expectations, and listing quality create strong opportunities for hosts who optimize properly.",
    items: [
      {
        citySlug: "paris",
        name: "Paris",
        description: "A global tourism and business travel market with intense short-term rental competition.",
        reason: "Paris rewards strong photos, precise positioning, trust signals, and pricing discipline.",
      },
      {
        citySlug: "marrakech",
        name: "Marrakech",
        description: "A high-potential cultural destination with demand for riads, apartments, villas, and authentic stays.",
        reason: "Marrakech listings benefit from strong visual storytelling, clear rules, and guest reassurance.",
      },
      {
        citySlug: "barcelona",
        name: "Barcelona",
        description: "A major European city-break market with strong competition and high guest expectations.",
        reason: "Barcelona requires excellent positioning, pricing clarity, and strong conversion signals.",
      },
      {
        citySlug: "dubai",
        name: "Dubai",
        description: "A premium short-term rental market driven by business travel, tourism, luxury, and events.",
        reason: "Dubai listings compete heavily on design, views, amenities, and perceived value.",
      },
      {
        citySlug: "tokyo",
        name: "Tokyo",
        description: "A dense global travel market where location clarity and guest confidence are critical.",
        reason: "Tokyo rewards clean presentation, transport access, and highly specific listing information.",
      },
    ],
    faq: [
      {
        question: "What makes a city good for Airbnb?",
        answer:
          "A strong Airbnb city usually has guest demand, clear travel reasons, competitive pricing opportunities, and enough market depth for optimized listings to stand out.",
      },
      {
        question: "Are the best Airbnb cities always expensive?",
        answer:
          "No. Some strong Airbnb markets are premium, while others perform well because of affordability, tourism growth, or unique guest demand.",
      },
    ],
  },
  {
    slug: "best-airbnb-markets",
    scope: { kind: "global" },
    title: "Best Airbnb Markets",
    description:
      "Discover strong Airbnb markets where pricing, listing quality, demand, and competition create optimization opportunities.",
    heroTitle: "Best Airbnb markets for listing optimization",
    heroSubtitle:
      "Compare short-term rental markets where smart pricing, better photos, and stronger listing copy can improve performance.",
    intro:
      "The best Airbnb markets are places where guest demand exists but competition is strong enough that listing optimization matters. In these markets, better presentation and pricing can directly influence booking performance.",
    items: [
      {
        citySlug: "nice",
        name: "Nice",
        description: "A French Riviera market with beach demand, events, and seasonal pricing peaks.",
        reason: "Strong photos, air conditioning, location clarity, and seasonal pricing are essential.",
      },
      {
        citySlug: "miami",
        name: "Miami",
        description: "A competitive leisure and urban travel market with strong visual expectations.",
        reason: "Listings must communicate style, location, amenities, and value quickly.",
      },
      {
        citySlug: "cancun",
        name: "Cancun",
        description: "A leisure market driven by beach stays, resorts, and international tourism.",
        reason: "Visual proof, amenities, trust, and pricing alignment are major conversion factors.",
      },
      {
        citySlug: "phuket",
        name: "Phuket",
        description: "A major Thai island market for villas, apartments, beaches, and long-stay demand.",
        reason: "Outdoor space, pools, views, and clear location context can strongly influence bookings.",
      },
      {
        citySlug: "cape-town",
        name: "Cape Town",
        description: "A scenic market with tourism, business travel, and premium neighborhood demand.",
        reason: "Photos, views, safety context, and neighborhood positioning are key.",
      },
    ],
    faq: [
      {
        question: "What is an Airbnb market?",
        answer:
          "An Airbnb market is a destination or local area where short-term rental listings compete for guest demand.",
      },
      {
        question: "Why does market choice matter?",
        answer:
          "Market choice affects demand, pricing, seasonality, competition, regulation, and the type of guests a listing attracts.",
      },
    ],
  },
  {
    slug: "best-airbnb-countries",
    scope: { kind: "global" },
    title: "Best Airbnb Countries",
    description:
      "Explore strong Airbnb countries for short-term rental demand, listing optimization, pricing, and city-level opportunities.",
    heroTitle: "Best Airbnb countries for short-term rental growth",
    heroSubtitle:
      "Explore country-level Airbnb markets with strong city coverage, tourism demand, and listing optimization potential.",
    intro:
      "Some countries offer broad Airbnb opportunities because they combine major cities, leisure destinations, seasonal demand, cultural tourism, and diverse property types.",
    items: [
      {
        countrySlug: "france",
        name: "France",
        description: "A major global tourism country with cities, coastlines, ski resorts, and cultural destinations.",
        reason: "France offers many high-value city and leisure markets for optimized listings.",
      },
      {
        countrySlug: "morocco",
        name: "Morocco",
        description: "A growing market with cultural cities, beach destinations, riads, villas, and apartments.",
        reason: "Morocco is especially strong for authentic stays and visually distinctive listings.",
      },
      {
        countrySlug: "spain",
        name: "Spain",
        description: "A powerful European market with cities, islands, beaches, and long-stay demand.",
        reason: "Spain combines tourism scale with strong seasonal pricing opportunities.",
      },
      {
        countrySlug: "italy",
        name: "Italy",
        description: "A global travel country with historic cities, coastlines, villages, and premium leisure destinations.",
        reason: "Italy rewards strong storytelling, authentic presentation, and location clarity.",
      },
      {
        countrySlug: "united-states",
        name: "United States",
        description: "One of the largest short-term rental markets with diverse urban, leisure, and event-driven demand.",
        reason: "The US offers strong opportunities across cities, beaches, cabins, and event destinations.",
      },
    ],
    faq: [
      {
        question: "Which country is best for Airbnb?",
        answer:
          "There is no single best country. Strong Airbnb countries usually combine demand, market depth, guest variety, and attractive destinations.",
      },
      {
        question: "Should hosts compare countries or cities?",
        answer:
          "Hosts should compare both. Countries show macro demand, while cities reveal the real competitive and pricing context.",
      },
    ],
  },
  {
    slug: "best-airbnb-cities-in-europe",
    scope: { kind: "region", slug: "europe" },
    title: "Best Airbnb Cities in Europe",
    description:
      "Explore top Airbnb cities in Europe for short-term rental demand, pricing strategy, competition, and listing optimization.",
    heroTitle: "Best Airbnb cities in Europe",
    heroSubtitle:
      "Compare major European Airbnb markets where listing quality, pricing, and conversion strategy matter.",
    intro:
      "Europe contains many of the world's strongest Airbnb cities, from cultural capitals to coastal markets. Competition is high, so optimization can make a major difference.",
    items: [
      {
        citySlug: "paris",
        name: "Paris",
        description: "A global tourism and business destination with strong year-round demand.",
        reason: "Paris requires excellent trust signals, strong pricing, and clear guest positioning.",
      },
      {
        citySlug: "barcelona",
        name: "Barcelona",
        description: "A powerful city-break market with strong competition and high guest expectations.",
        reason: "Barcelona listings must stand out through photos, location, and pricing clarity.",
      },
      {
        citySlug: "rome",
        name: "Rome",
        description: "A major cultural tourism market with historic stays and international demand.",
        reason: "Rome rewards authentic presentation, walkability, and strong listing storytelling.",
      },
      {
        citySlug: "lisbon",
        name: "Lisbon",
        description: "A popular city-break and remote-work market with strong international demand.",
        reason: "Lisbon listings benefit from brightness, design, views, and neighborhood clarity.",
      },
      {
        citySlug: "amsterdam",
        name: "Amsterdam",
        description: "A premium European market with high guest expectations and limited supply dynamics.",
        reason: "Amsterdam requires clear value, strong reviews, and accurate location positioning.",
      },
    ],
    faq: [
      {
        question: "What are the best Airbnb cities in Europe?",
        answer:
          "Strong European Airbnb cities include Paris, Barcelona, Rome, Lisbon, Amsterdam, London, Madrid, and many coastal or cultural destinations.",
      },
      {
        question: "Is Europe competitive for Airbnb hosts?",
        answer:
          "Yes. Many European markets are highly competitive, which makes photos, pricing, reviews, and listing clarity especially important.",
      },
    ],
  },
  {
    slug: "best-airbnb-cities-in-france",
    scope: { kind: "country", countrySlug: "france" },
    title: "Best Airbnb Cities in France",
    description:
      "Explore the best Airbnb cities in France for short-term rental demand, pricing, tourism, competition, and listing optimization.",
    heroTitle: "Best Airbnb cities in France",
    heroSubtitle:
      "Compare French Airbnb markets from Paris and Nice to Bordeaux, Lyon, Marseille, Annecy, and Biarritz.",
    intro:
      "France is one of the strongest short-term rental countries in the world. Its Airbnb opportunities range from global cities to beaches, ski resorts, wine regions, and historic towns.",
    items: [
      {
        citySlug: "paris",
        name: "Paris",
        description: "The largest French tourism and business market with high competition.",
        reason: "Paris listings need strong positioning, trust, reviews, and pricing discipline.",
      },
      {
        citySlug: "nice",
        name: "Nice",
        description: "A French Riviera market with beach demand and seasonal pricing peaks.",
        reason: "Nice rewards bright photos, location clarity, and summer pricing strategy.",
      },
      {
        citySlug: "lyon",
        name: "Lyon",
        description: "A balanced business and leisure market with year-round demand.",
        reason: "Lyon listings benefit from comfort, transport access, and workspace signals.",
      },
      {
        citySlug: "bordeaux",
        name: "Bordeaux",
        description: "A wine tourism and weekend market with strong leisure appeal.",
        reason: "Bordeaux rewards elegant presentation and clear neighborhood positioning.",
      },
      {
        citySlug: "annecy",
        name: "Annecy",
        description: "A scenic leisure market driven by lake, mountain, and weekend demand.",
        reason: "Annecy listings benefit from views, outdoor access, and strong visual storytelling.",
      },
    ],
    faq: [
      {
        question: "What are the best Airbnb cities in France?",
        answer:
          "Strong Airbnb cities in France include Paris, Nice, Lyon, Marseille, Bordeaux, Toulouse, Annecy, Biarritz, Cannes, and Chamonix.",
      },
      {
        question: "Is France a strong Airbnb market?",
        answer:
          "Yes. France combines global tourism, business travel, coastal demand, ski destinations, and cultural travel.",
      },
    ],
  },
  {
    slug: "best-airbnb-destinations-for-families",
    scope: { kind: "audience", slug: "families" },
    title: "Best Airbnb Destinations for Families",
    description:
      "Explore family-friendly Airbnb destinations where space, safety, amenities, location clarity, and trust signals matter most.",
    heroTitle: "Best Airbnb destinations for families",
    heroSubtitle:
      "Discover markets where family-friendly listings can stand out with better amenities, photos, safety, and guest communication.",
    intro:
      "Family travelers often look for more than location. They care about space, sleeping setup, kitchen equipment, parking, safety, laundry, quiet areas, and clear expectations.",
    items: [
      {
        citySlug: "orlando",
        name: "Orlando",
        description: "A major family travel market driven by theme parks and group stays.",
        reason: "Family-friendly amenities, sleeping setup, parking, and value clarity are essential.",
      },
      {
        citySlug: "marrakech",
        name: "Marrakech",
        description: "A cultural destination with villas, apartments, and family leisure demand.",
        reason: "Clear rules, sleeping setup, pool access, and guest reassurance matter strongly.",
      },
      {
        citySlug: "barcelona",
        name: "Barcelona",
        description: "A city-break destination with family demand around attractions and beach access.",
        reason: "Families compare space, location, kitchen, air conditioning, and transport access.",
      },
      {
        citySlug: "dubai",
        name: "Dubai",
        description: "A family-friendly luxury and leisure market with strong amenity expectations.",
        reason: "Pools, parking, building facilities, and location clarity can influence bookings.",
      },
      {
        citySlug: "phuket",
        name: "Phuket",
        description: "A beach and villa market with strong family travel demand.",
        reason: "Pools, space, safety, kitchen, and transport context are key family signals.",
      },
    ],
    faq: [
      {
        question: "What makes an Airbnb family-friendly?",
        answer:
          "Family-friendly Airbnb listings usually offer enough space, clear sleeping setup, kitchen access, laundry, safety details, parking, and reliable amenities.",
      },
      {
        question: "Do family travelers compare listings differently?",
        answer:
          "Yes. Families often care more about space, practical amenities, safety, location clarity, and house rules.",
      },
    ],
  },
];

export function getRankingBySlug(slug: string) {
  return rankings.find((ranking) => ranking.slug === slug);
}

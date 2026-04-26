export type City = {
  slug: string;
  name: string;
  country: string;
  avgPrice: number;
  avgRating: number;
  avgPhotos: number;
  /** One line: what shapes demand in this market */
  marketAngle: string;
  /** One line: how guests compare listings locally */
  competitionAngle: string;
  /** One line: pricing / positioning nuance (no invented stats) */
  pricingAngle: string;
  /** One line: what guests look for before they book */
  guestExpectationAngle: string;
};

export const cities: City[] = [
  {
    slug: "paris",
    name: "Paris",
    country: "France",
    avgPrice: 165,
    avgRating: 4.7,
    avgPhotos: 23,
    marketAngle:
      "City breaks, business trips, and longer cultural stays keep search interest steady across the year.",
    competitionAngle:
      "Guests compare many similar apartments across arrondissements—standing out is rarely about the lowest price alone.",
    pricingAngle:
      "Rates move with events and seasons; your presentation should match where you sit versus nearby comps.",
    guestExpectationAngle:
      "International guests expect precise check-in detail, honest neighborhood context, and photos that match the space.",
  },
  {
    slug: "london",
    name: "London",
    country: "United Kingdom",
    avgPrice: 190,
    avgRating: 4.6,
    avgPhotos: 21,
    marketAngle:
      "Corporate midweeks, weekend visitors, and longer bleisure stays all influence how listings get discovered.",
    competitionAngle:
      "Tube zones and borough character matter—many listings compete on the same corridors and price bands.",
    pricingAngle:
      "Premium pockets and budget-friendly pockets sit side by side; vague “central” claims hurt more than a precise map pin helps.",
    guestExpectationAngle:
      "Guests prioritize reliable Wi‑Fi, clear house rules, and honest room sizing, especially in shared homes.",
  },
  {
    slug: "barcelona",
    name: "Barcelona",
    country: "Spain",
    avgPrice: 150,
    avgRating: 4.8,
    avgPhotos: 25,
    marketAngle:
      "Coastal leisure, city culture, and seasonality drive how guests filter dates and neighborhoods.",
    competitionAngle:
      "Beach proximity versus calmer inner-city options splits the competitive set before guests read your description.",
    pricingAngle:
      "Weekends and peak periods move the market; your gallery and calendar story should reflect what you actually offer.",
    guestExpectationAngle:
      "Outdoor space, cooling, and noise context are common filters before guests shortlist a place.",
  },
  {
    slug: "lisbon",
    name: "Lisbon",
    country: "Portugal",
    avgPrice: 135,
    avgRating: 4.8,
    avgPhotos: 22,
    marketAngle:
      "Remote workers, long weekends, and hill-and-tram exploring define much of the demand profile.",
    competitionAngle:
      "A compact center means many listings compete on walkability and light, not only on nightly rate.",
    pricingAngle:
      "Value positioning is common; small upgrades in gallery order and copy still shift who wins the booking.",
    guestExpectationAngle:
      "Guests look for honest hill and stair context, smooth check-in, and a tone that feels locally grounded.",
  },
  {
    slug: "rome",
    name: "Rome",
    country: "Italy",
    avgPrice: 155,
    avgRating: 4.7,
    avgPhotos: 20,
    marketAngle:
      "History-led trips and food-focused itineraries mean many guests plan on foot from a central base.",
    competitionAngle:
      "Historic center versus outer districts splits expectations—guests compare walk times, not marketing tags.",
    pricingAngle:
      "Tourism seasons matter; shoulder periods reward listings that still look sharp and complete.",
    guestExpectationAngle:
      "Families want sleeping layout clarity; every guest wants realistic noise and building-age context.",
  },
  {
    slug: "marrakech",
    name: "Marrakech",
    country: "Morocco",
    avgPrice: 105,
    avgRating: 4.65,
    avgPhotos: 23,
    marketAngle:
      "Medina riads, resort-style stays, and planned excursions create distinct guest journeys in the same city.",
    competitionAngle:
      "Guests weigh old-town atmosphere against modern comfort—your gallery should show which experience you deliver.",
    pricingAngle:
      "The market spans budget riads to high-end pools; your positioning should match amenities and what photos promise.",
    guestExpectationAngle:
      "International guests value climate comfort notes, transfer clarity, and honest context on medina access.",
  },
  {
    slug: "dubai",
    name: "Dubai",
    country: "United Arab Emirates",
    avgPrice: 155,
    avgRating: 4.65,
    avgPhotos: 24,
    marketAngle:
      "Business travel, luxury leisure, and stopovers create year-round demand with clear peak seasons around events and holidays.",
    competitionAngle:
      "Guests weigh tower views, resort amenities, and precise location—listings blur together when photos and maps do not tell a sharp story.",
    pricingAngle:
      "Wide spread from compact stays to high-end towers; your gallery and amenity list should match the tier you are asking for.",
    guestExpectationAngle:
      "Pool, gym, and parking clarity matters, plus honest detail on building access and summer heat comfort.",
  },
  {
    slug: "new-york",
    name: "New York",
    country: "United States",
    avgPrice: 245,
    avgRating: 4.55,
    avgPhotos: 22,
    marketAngle:
      "Weekend visitors, extended work trips, and event-driven spikes keep search active across boroughs and neighborhoods.",
    competitionAngle:
      "Guests compare subway access, building type, and noise context block by block—generic “NYC” copy rarely wins the click.",
    pricingAngle:
      "Rates swing sharply by season and neighborhood; transparency on space and sleeping layout justifies where you price.",
    guestExpectationAngle:
      "Expectations run high on Wi‑Fi, check-in precision, and realistic photos for smaller urban layouts.",
  },
  {
    slug: "miami",
    name: "Miami",
    country: "United States",
    avgPrice: 175,
    avgRating: 4.6,
    avgPhotos: 24,
    marketAngle:
      "Beach leisure, winter escapes, and event weekends shape how guests filter by waterfront, neighborhood, and dates.",
    competitionAngle:
      "Ocean proximity versus quieter inland options splits the map early; guests shortlist on light, outdoor space, and parking truth.",
    pricingAngle:
      "Holiday and festival windows move rates fast; your calendar and hero image should reflect the stay you actually deliver.",
    guestExpectationAngle:
      "Pool hours, AC, parking, and hurricane-season clarity are common decision points before guests commit.",
  },
  {
    slug: "los-angeles",
    name: "Los Angeles",
    country: "United States",
    avgPrice: 185,
    avgRating: 4.55,
    avgPhotos: 23,
    marketAngle:
      "Film and creative travel, coastal getaways, and road-trip hubs mean guests often plan around cars and neighborhood character.",
    competitionAngle:
      "Listings compete across scattered neighborhoods—drive times and parking honesty matter more than a catchy area label.",
    pricingAngle:
      "Back-to-back seasons and events shift demand; positioning should match whether you are a design stay, family base, or budget crash pad.",
    guestExpectationAngle:
      "Guests want parking truth, realistic commute context, and outdoor space photos that match the season.",
  },
  {
    slug: "istanbul",
    name: "Istanbul",
    country: "Turkey",
    avgPrice: 88,
    avgRating: 4.7,
    avgPhotos: 22,
    marketAngle:
      "City-break culture, Bosphorus scenery, and longer stays mix—bridging Europe and Asia shapes how people search.",
    competitionAngle:
      "Old-city charm versus newer districts splits expectations; guests compare views, walkability, and transfer ease early.",
    pricingAngle:
      "Value tiers vary by district and view; your photos should show which side of that spectrum you occupy.",
    guestExpectationAngle:
      "International guests appreciate lift or stair clarity, honest old-building context, and smooth arrival instructions.",
  },
  {
    slug: "bangkok",
    name: "Bangkok",
    country: "Thailand",
    avgPrice: 72,
    avgRating: 4.75,
    avgPhotos: 23,
    marketAngle:
      "Food tourism, long layovers, and digital-nomad stays keep demand broad across Sukhumvit-style corridors and riverside pockets.",
    competitionAngle:
      "High-rise pool gyms versus quieter low-rise pockets—guests decide fast based on photos, floor, and BTS or MRT context.",
    pricingAngle:
      "Strong value market; polish and clarity still decide which listing feels “safe and easy” at a similar rate.",
    guestExpectationAngle:
      "Check-in after hours, pool rules, and realistic noise notes from streets or bars are frequent filters.",
  },
  {
    slug: "bali",
    name: "Bali",
    country: "Indonesia",
    avgPrice: 85,
    avgRating: 4.8,
    avgPhotos: 26,
    marketAngle:
      "Villa weeks, surf and wellness trips, and multi-stop Indonesia routes make length of stay and vibe central to search.",
    competitionAngle:
      "Guests choose between rice-field quiet, beach towns, and design villas—your cover image signals which world you are in.",
    pricingAngle:
      "Wide range from guesthouses to private pools; mismatched photos and amenities erode trust faster than a modest rate.",
    guestExpectationAngle:
      "Private pool truth, insect and climate notes, scooter or driver context, and honest distance to the beach or hub.",
  },
  {
    slug: "amsterdam",
    name: "Amsterdam",
    country: "Netherlands",
    avgPrice: 170,
    avgRating: 4.65,
    avgPhotos: 21,
    marketAngle:
      "Weekend breaks, museum trips, and conference spillover keep canals and inner rings competitive year-round.",
    competitionAngle:
      "Canal ring versus outer districts changes price and noise; guests compare stairs, bike storage, and window views.",
    pricingAngle:
      "Event weekends and holidays move rates; clarity on space and stairs supports a premium without surprise reviews.",
    guestExpectationAngle:
      "Steep stairs, bike parking, and neighbor noise are common expectations to address upfront in photos and copy.",
  },
  {
    slug: "berlin",
    name: "Berlin",
    country: "Germany",
    avgPrice: 118,
    avgRating: 4.55,
    avgPhotos: 20,
    marketAngle:
      "Creative tourism, nightlife, and longer budget-aware stays make neighborhood identity a core search filter.",
    competitionAngle:
      "Kreuzberg-style energy versus calmer family pockets—guests skim for the vibe match before they read amenities.",
    pricingAngle:
      "Value-conscious market with design-led exceptions; presentation explains whether you are essentials-first or experience-led.",
    guestExpectationAngle:
      "Quiet hours, courtyard versus street side, and honest public transport walks still drive shortlisting.",
  },
];

export function getCityBySlug(slug: string): City | undefined {
  return cities.find((city) => city.slug === slug);
}

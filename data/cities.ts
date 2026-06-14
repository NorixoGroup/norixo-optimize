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
  {
    slug: "nice",
    name: "Nice",
    country: "France",
    avgPrice: 145,
    avgRating: 4.7,
    avgPhotos: 22,
    marketAngle:
      "Short-term rental demand in Nice is shaped by leisure stays, work trips, events, and neighborhood-specific search behavior.",
    competitionAngle:
      "Guests compare location, photos, amenities, and perceived trust quickly, so the listing needs to explain why it fits this market.",
    pricingAngle:
      "Pricing should reflect local competition, seasonality, and the experience promised by the photos and amenities.",
    guestExpectationAngle:
      "Guests expect clear arrival details, honest location context, reliable amenities, and a gallery that matches the stay.",
  },
  {
    slug: "cannes",
    name: "Cannes",
    country: "France",
    avgPrice: 180,
    avgRating: 4.65,
    avgPhotos: 24,
    marketAngle:
      "Short-term rental demand in Cannes is shaped by leisure stays, work trips, events, and neighborhood-specific search behavior.",
    competitionAngle:
      "Guests compare location, photos, amenities, and perceived trust quickly, so the listing needs to explain why it fits this market.",
    pricingAngle:
      "Pricing should reflect local competition, seasonality, and the experience promised by the photos and amenities.",
    guestExpectationAngle:
      "Guests expect clear arrival details, honest location context, reliable amenities, and a gallery that matches the stay.",
  },
  {
    slug: "marseille",
    name: "Marseille",
    country: "France",
    avgPrice: 120,
    avgRating: 4.7,
    avgPhotos: 22,
    marketAngle:
      "Short-term rental demand in Marseille is shaped by leisure stays, work trips, events, and neighborhood-specific search behavior.",
    competitionAngle:
      "Guests compare location, photos, amenities, and perceived trust quickly, so the listing needs to explain why it fits this market.",
    pricingAngle:
      "Pricing should reflect local competition, seasonality, and the experience promised by the photos and amenities.",
    guestExpectationAngle:
      "Guests expect clear arrival details, honest location context, reliable amenities, and a gallery that matches the stay.",
  },
  {
    slug: "lyon",
    name: "Lyon",
    country: "France",
    avgPrice: 115,
    avgRating: 4.7,
    avgPhotos: 22,
    marketAngle:
      "Short-term rental demand in Lyon is shaped by leisure stays, work trips, events, and neighborhood-specific search behavior.",
    competitionAngle:
      "Guests compare location, photos, amenities, and perceived trust quickly, so the listing needs to explain why it fits this market.",
    pricingAngle:
      "Pricing should reflect local competition, seasonality, and the experience promised by the photos and amenities.",
    guestExpectationAngle:
      "Guests expect clear arrival details, honest location context, reliable amenities, and a gallery that matches the stay.",
  },
  {
    slug: "bordeaux",
    name: "Bordeaux",
    country: "France",
    avgPrice: 125,
    avgRating: 4.7,
    avgPhotos: 22,
    marketAngle:
      "Short-term rental demand in Bordeaux is shaped by leisure stays, work trips, events, and neighborhood-specific search behavior.",
    competitionAngle:
      "Guests compare location, photos, amenities, and perceived trust quickly, so the listing needs to explain why it fits this market.",
    pricingAngle:
      "Pricing should reflect local competition, seasonality, and the experience promised by the photos and amenities.",
    guestExpectationAngle:
      "Guests expect clear arrival details, honest location context, reliable amenities, and a gallery that matches the stay.",
  },
  {
    slug: "toulouse",
    name: "Toulouse",
    country: "France",
    avgPrice: 105,
    avgRating: 4.7,
    avgPhotos: 22,
    marketAngle:
      "Short-term rental demand in Toulouse is shaped by leisure stays, work trips, events, and neighborhood-specific search behavior.",
    competitionAngle:
      "Guests compare location, photos, amenities, and perceived trust quickly, so the listing needs to explain why it fits this market.",
    pricingAngle:
      "Pricing should reflect local competition, seasonality, and the experience promised by the photos and amenities.",
    guestExpectationAngle:
      "Guests expect clear arrival details, honest location context, reliable amenities, and a gallery that matches the stay.",
  },
  {
    slug: "madrid",
    name: "Madrid",
    country: "Spain",
    avgPrice: 135,
    avgRating: 4.7,
    avgPhotos: 22,
    marketAngle:
      "Short-term rental demand in Madrid is shaped by leisure stays, work trips, events, and neighborhood-specific search behavior.",
    competitionAngle:
      "Guests compare location, photos, amenities, and perceived trust quickly, so the listing needs to explain why it fits this market.",
    pricingAngle:
      "Pricing should reflect local competition, seasonality, and the experience promised by the photos and amenities.",
    guestExpectationAngle:
      "Guests expect clear arrival details, honest location context, reliable amenities, and a gallery that matches the stay.",
  },
  {
    slug: "valencia",
    name: "Valencia",
    country: "Spain",
    avgPrice: 115,
    avgRating: 4.7,
    avgPhotos: 22,
    marketAngle:
      "Short-term rental demand in Valencia is shaped by leisure stays, work trips, events, and neighborhood-specific search behavior.",
    competitionAngle:
      "Guests compare location, photos, amenities, and perceived trust quickly, so the listing needs to explain why it fits this market.",
    pricingAngle:
      "Pricing should reflect local competition, seasonality, and the experience promised by the photos and amenities.",
    guestExpectationAngle:
      "Guests expect clear arrival details, honest location context, reliable amenities, and a gallery that matches the stay.",
  },
  {
    slug: "malaga",
    name: "Malaga",
    country: "Spain",
    avgPrice: 125,
    avgRating: 4.7,
    avgPhotos: 22,
    marketAngle:
      "Short-term rental demand in Malaga is shaped by leisure stays, work trips, events, and neighborhood-specific search behavior.",
    competitionAngle:
      "Guests compare location, photos, amenities, and perceived trust quickly, so the listing needs to explain why it fits this market.",
    pricingAngle:
      "Pricing should reflect local competition, seasonality, and the experience promised by the photos and amenities.",
    guestExpectationAngle:
      "Guests expect clear arrival details, honest location context, reliable amenities, and a gallery that matches the stay.",
  },
  {
    slug: "seville",
    name: "Seville",
    country: "Spain",
    avgPrice: 110,
    avgRating: 4.7,
    avgPhotos: 22,
    marketAngle:
      "Short-term rental demand in Seville is shaped by leisure stays, work trips, events, and neighborhood-specific search behavior.",
    competitionAngle:
      "Guests compare location, photos, amenities, and perceived trust quickly, so the listing needs to explain why it fits this market.",
    pricingAngle:
      "Pricing should reflect local competition, seasonality, and the experience promised by the photos and amenities.",
    guestExpectationAngle:
      "Guests expect clear arrival details, honest location context, reliable amenities, and a gallery that matches the stay.",
  },
  {
    slug: "ibiza",
    name: "Ibiza",
    country: "Spain",
    avgPrice: 240,
    avgRating: 4.65,
    avgPhotos: 24,
    marketAngle:
      "Short-term rental demand in Ibiza is shaped by leisure stays, work trips, events, and neighborhood-specific search behavior.",
    competitionAngle:
      "Guests compare location, photos, amenities, and perceived trust quickly, so the listing needs to explain why it fits this market.",
    pricingAngle:
      "Pricing should reflect local competition, seasonality, and the experience promised by the photos and amenities.",
    guestExpectationAngle:
      "Guests expect clear arrival details, honest location context, reliable amenities, and a gallery that matches the stay.",
  },
  {
    slug: "porto",
    name: "Porto",
    country: "Portugal",
    avgPrice: 115,
    avgRating: 4.7,
    avgPhotos: 22,
    marketAngle:
      "Short-term rental demand in Porto is shaped by leisure stays, work trips, events, and neighborhood-specific search behavior.",
    competitionAngle:
      "Guests compare location, photos, amenities, and perceived trust quickly, so the listing needs to explain why it fits this market.",
    pricingAngle:
      "Pricing should reflect local competition, seasonality, and the experience promised by the photos and amenities.",
    guestExpectationAngle:
      "Guests expect clear arrival details, honest location context, reliable amenities, and a gallery that matches the stay.",
  },
  {
    slug: "faro",
    name: "Faro",
    country: "Portugal",
    avgPrice: 120,
    avgRating: 4.7,
    avgPhotos: 22,
    marketAngle:
      "Short-term rental demand in Faro is shaped by leisure stays, work trips, events, and neighborhood-specific search behavior.",
    competitionAngle:
      "Guests compare location, photos, amenities, and perceived trust quickly, so the listing needs to explain why it fits this market.",
    pricingAngle:
      "Pricing should reflect local competition, seasonality, and the experience promised by the photos and amenities.",
    guestExpectationAngle:
      "Guests expect clear arrival details, honest location context, reliable amenities, and a gallery that matches the stay.",
  },
  {
    slug: "florence",
    name: "Florence",
    country: "Italy",
    avgPrice: 145,
    avgRating: 4.7,
    avgPhotos: 22,
    marketAngle:
      "Short-term rental demand in Florence is shaped by leisure stays, work trips, events, and neighborhood-specific search behavior.",
    competitionAngle:
      "Guests compare location, photos, amenities, and perceived trust quickly, so the listing needs to explain why it fits this market.",
    pricingAngle:
      "Pricing should reflect local competition, seasonality, and the experience promised by the photos and amenities.",
    guestExpectationAngle:
      "Guests expect clear arrival details, honest location context, reliable amenities, and a gallery that matches the stay.",
  },
  {
    slug: "venice",
    name: "Venice",
    country: "Italy",
    avgPrice: 170,
    avgRating: 4.7,
    avgPhotos: 24,
    marketAngle:
      "Short-term rental demand in Venice is shaped by leisure stays, work trips, events, and neighborhood-specific search behavior.",
    competitionAngle:
      "Guests compare location, photos, amenities, and perceived trust quickly, so the listing needs to explain why it fits this market.",
    pricingAngle:
      "Pricing should reflect local competition, seasonality, and the experience promised by the photos and amenities.",
    guestExpectationAngle:
      "Guests expect clear arrival details, honest location context, reliable amenities, and a gallery that matches the stay.",
  },
  {
    slug: "milan",
    name: "Milan",
    country: "Italy",
    avgPrice: 155,
    avgRating: 4.7,
    avgPhotos: 24,
    marketAngle:
      "Short-term rental demand in Milan is shaped by leisure stays, work trips, events, and neighborhood-specific search behavior.",
    competitionAngle:
      "Guests compare location, photos, amenities, and perceived trust quickly, so the listing needs to explain why it fits this market.",
    pricingAngle:
      "Pricing should reflect local competition, seasonality, and the experience promised by the photos and amenities.",
    guestExpectationAngle:
      "Guests expect clear arrival details, honest location context, reliable amenities, and a gallery that matches the stay.",
  },
  {
    slug: "naples",
    name: "Naples",
    country: "Italy",
    avgPrice: 115,
    avgRating: 4.7,
    avgPhotos: 22,
    marketAngle:
      "Short-term rental demand in Naples is shaped by leisure stays, work trips, events, and neighborhood-specific search behavior.",
    competitionAngle:
      "Guests compare location, photos, amenities, and perceived trust quickly, so the listing needs to explain why it fits this market.",
    pricingAngle:
      "Pricing should reflect local competition, seasonality, and the experience promised by the photos and amenities.",
    guestExpectationAngle:
      "Guests expect clear arrival details, honest location context, reliable amenities, and a gallery that matches the stay.",
  },
  {
    slug: "athens",
    name: "Athens",
    country: "Greece",
    avgPrice: 105,
    avgRating: 4.7,
    avgPhotos: 22,
    marketAngle:
      "Short-term rental demand in Athens is shaped by leisure stays, work trips, events, and neighborhood-specific search behavior.",
    competitionAngle:
      "Guests compare location, photos, amenities, and perceived trust quickly, so the listing needs to explain why it fits this market.",
    pricingAngle:
      "Pricing should reflect local competition, seasonality, and the experience promised by the photos and amenities.",
    guestExpectationAngle:
      "Guests expect clear arrival details, honest location context, reliable amenities, and a gallery that matches the stay.",
  },
  {
    slug: "santorini",
    name: "Santorini",
    country: "Greece",
    avgPrice: 230,
    avgRating: 4.65,
    avgPhotos: 24,
    marketAngle:
      "Short-term rental demand in Santorini is shaped by leisure stays, work trips, events, and neighborhood-specific search behavior.",
    competitionAngle:
      "Guests compare location, photos, amenities, and perceived trust quickly, so the listing needs to explain why it fits this market.",
    pricingAngle:
      "Pricing should reflect local competition, seasonality, and the experience promised by the photos and amenities.",
    guestExpectationAngle:
      "Guests expect clear arrival details, honest location context, reliable amenities, and a gallery that matches the stay.",
  },
  {
    slug: "mykonos",
    name: "Mykonos",
    country: "Greece",
    avgPrice: 260,
    avgRating: 4.65,
    avgPhotos: 24,
    marketAngle:
      "Short-term rental demand in Mykonos is shaped by leisure stays, work trips, events, and neighborhood-specific search behavior.",
    competitionAngle:
      "Guests compare location, photos, amenities, and perceived trust quickly, so the listing needs to explain why it fits this market.",
    pricingAngle:
      "Pricing should reflect local competition, seasonality, and the experience promised by the photos and amenities.",
    guestExpectationAngle:
      "Guests expect clear arrival details, honest location context, reliable amenities, and a gallery that matches the stay.",
  },
  {
    slug: "vienna",
    name: "Vienna",
    country: "Austria",
    avgPrice: 125,
    avgRating: 4.7,
    avgPhotos: 22,
    marketAngle:
      "Short-term rental demand in Vienna is shaped by leisure stays, work trips, events, and neighborhood-specific search behavior.",
    competitionAngle:
      "Guests compare location, photos, amenities, and perceived trust quickly, so the listing needs to explain why it fits this market.",
    pricingAngle:
      "Pricing should reflect local competition, seasonality, and the experience promised by the photos and amenities.",
    guestExpectationAngle:
      "Guests expect clear arrival details, honest location context, reliable amenities, and a gallery that matches the stay.",
  },
  {
    slug: "prague",
    name: "Prague",
    country: "Czech Republic",
    avgPrice: 105,
    avgRating: 4.7,
    avgPhotos: 22,
    marketAngle:
      "Short-term rental demand in Prague is shaped by leisure stays, work trips, events, and neighborhood-specific search behavior.",
    competitionAngle:
      "Guests compare location, photos, amenities, and perceived trust quickly, so the listing needs to explain why it fits this market.",
    pricingAngle:
      "Pricing should reflect local competition, seasonality, and the experience promised by the photos and amenities.",
    guestExpectationAngle:
      "Guests expect clear arrival details, honest location context, reliable amenities, and a gallery that matches the stay.",
  },
  {
    slug: "budapest",
    name: "Budapest",
    country: "Hungary",
    avgPrice: 90,
    avgRating: 4.7,
    avgPhotos: 22,
    marketAngle:
      "Short-term rental demand in Budapest is shaped by leisure stays, work trips, events, and neighborhood-specific search behavior.",
    competitionAngle:
      "Guests compare location, photos, amenities, and perceived trust quickly, so the listing needs to explain why it fits this market.",
    pricingAngle:
      "Pricing should reflect local competition, seasonality, and the experience promised by the photos and amenities.",
    guestExpectationAngle:
      "Guests expect clear arrival details, honest location context, reliable amenities, and a gallery that matches the stay.",
  },
  {
    slug: "dublin",
    name: "Dublin",
    country: "Ireland",
    avgPrice: 170,
    avgRating: 4.7,
    avgPhotos: 24,
    marketAngle:
      "Short-term rental demand in Dublin is shaped by leisure stays, work trips, events, and neighborhood-specific search behavior.",
    competitionAngle:
      "Guests compare location, photos, amenities, and perceived trust quickly, so the listing needs to explain why it fits this market.",
    pricingAngle:
      "Pricing should reflect local competition, seasonality, and the experience promised by the photos and amenities.",
    guestExpectationAngle:
      "Guests expect clear arrival details, honest location context, reliable amenities, and a gallery that matches the stay.",
  },
  {
    slug: "edinburgh",
    name: "Edinburgh",
    country: "United Kingdom",
    avgPrice: 150,
    avgRating: 4.7,
    avgPhotos: 24,
    marketAngle:
      "Short-term rental demand in Edinburgh is shaped by leisure stays, work trips, events, and neighborhood-specific search behavior.",
    competitionAngle:
      "Guests compare location, photos, amenities, and perceived trust quickly, so the listing needs to explain why it fits this market.",
    pricingAngle:
      "Pricing should reflect local competition, seasonality, and the experience promised by the photos and amenities.",
    guestExpectationAngle:
      "Guests expect clear arrival details, honest location context, reliable amenities, and a gallery that matches the stay.",
  },
  {
    slug: "zurich",
    name: "Zurich",
    country: "Switzerland",
    avgPrice: 210,
    avgRating: 4.65,
    avgPhotos: 24,
    marketAngle:
      "Short-term rental demand in Zurich is shaped by leisure stays, work trips, events, and neighborhood-specific search behavior.",
    competitionAngle:
      "Guests compare location, photos, amenities, and perceived trust quickly, so the listing needs to explain why it fits this market.",
    pricingAngle:
      "Pricing should reflect local competition, seasonality, and the experience promised by the photos and amenities.",
    guestExpectationAngle:
      "Guests expect clear arrival details, honest location context, reliable amenities, and a gallery that matches the stay.",
  },
  {
    slug: "geneva",
    name: "Geneva",
    country: "Switzerland",
    avgPrice: 200,
    avgRating: 4.65,
    avgPhotos: 24,
    marketAngle:
      "Short-term rental demand in Geneva is shaped by leisure stays, work trips, events, and neighborhood-specific search behavior.",
    competitionAngle:
      "Guests compare location, photos, amenities, and perceived trust quickly, so the listing needs to explain why it fits this market.",
    pricingAngle:
      "Pricing should reflect local competition, seasonality, and the experience promised by the photos and amenities.",
    guestExpectationAngle:
      "Guests expect clear arrival details, honest location context, reliable amenities, and a gallery that matches the stay.",
  },
  {
    slug: "cancun",
    name: "Cancun",
    country: "Mexico",
    avgPrice: 155,
    avgRating: 4.7,
    avgPhotos: 24,
    marketAngle:
      "Short-term rental demand in Cancun is shaped by leisure stays, work trips, events, and neighborhood-specific search behavior.",
    competitionAngle:
      "Guests compare location, photos, amenities, and perceived trust quickly, so the listing needs to explain why it fits this market.",
    pricingAngle:
      "Pricing should reflect local competition, seasonality, and the experience promised by the photos and amenities.",
    guestExpectationAngle:
      "Guests expect clear arrival details, honest location context, reliable amenities, and a gallery that matches the stay.",
  },
  {
    slug: "tulum",
    name: "Tulum",
    country: "Mexico",
    avgPrice: 185,
    avgRating: 4.65,
    avgPhotos: 24,
    marketAngle:
      "Short-term rental demand in Tulum is shaped by leisure stays, work trips, events, and neighborhood-specific search behavior.",
    competitionAngle:
      "Guests compare location, photos, amenities, and perceived trust quickly, so the listing needs to explain why it fits this market.",
    pricingAngle:
      "Pricing should reflect local competition, seasonality, and the experience promised by the photos and amenities.",
    guestExpectationAngle:
      "Guests expect clear arrival details, honest location context, reliable amenities, and a gallery that matches the stay.",
  },
  {
    slug: "playa-del-carmen",
    name: "Playa del Carmen",
    country: "Mexico",
    avgPrice: 145,
    avgRating: 4.7,
    avgPhotos: 22,
    marketAngle:
      "Short-term rental demand in Playa del Carmen is shaped by leisure stays, work trips, events, and neighborhood-specific search behavior.",
    competitionAngle:
      "Guests compare location, photos, amenities, and perceived trust quickly, so the listing needs to explain why it fits this market.",
    pricingAngle:
      "Pricing should reflect local competition, seasonality, and the experience promised by the photos and amenities.",
    guestExpectationAngle:
      "Guests expect clear arrival details, honest location context, reliable amenities, and a gallery that matches the stay.",
  },
  {
    slug: "toronto",
    name: "Toronto",
    country: "Canada",
    avgPrice: 145,
    avgRating: 4.7,
    avgPhotos: 22,
    marketAngle:
      "Short-term rental demand in Toronto is shaped by leisure stays, work trips, events, and neighborhood-specific search behavior.",
    competitionAngle:
      "Guests compare location, photos, amenities, and perceived trust quickly, so the listing needs to explain why it fits this market.",
    pricingAngle:
      "Pricing should reflect local competition, seasonality, and the experience promised by the photos and amenities.",
    guestExpectationAngle:
      "Guests expect clear arrival details, honest location context, reliable amenities, and a gallery that matches the stay.",
  },
  {
    slug: "vancouver",
    name: "Vancouver",
    country: "Canada",
    avgPrice: 170,
    avgRating: 4.7,
    avgPhotos: 24,
    marketAngle:
      "Short-term rental demand in Vancouver is shaped by leisure stays, work trips, events, and neighborhood-specific search behavior.",
    competitionAngle:
      "Guests compare location, photos, amenities, and perceived trust quickly, so the listing needs to explain why it fits this market.",
    pricingAngle:
      "Pricing should reflect local competition, seasonality, and the experience promised by the photos and amenities.",
    guestExpectationAngle:
      "Guests expect clear arrival details, honest location context, reliable amenities, and a gallery that matches the stay.",
  },
  {
    slug: "san-francisco",
    name: "San Francisco",
    country: "United States",
    avgPrice: 220,
    avgRating: 4.65,
    avgPhotos: 24,
    marketAngle:
      "Short-term rental demand in San Francisco is shaped by leisure stays, work trips, events, and neighborhood-specific search behavior.",
    competitionAngle:
      "Guests compare location, photos, amenities, and perceived trust quickly, so the listing needs to explain why it fits this market.",
    pricingAngle:
      "Pricing should reflect local competition, seasonality, and the experience promised by the photos and amenities.",
    guestExpectationAngle:
      "Guests expect clear arrival details, honest location context, reliable amenities, and a gallery that matches the stay.",
  },
  {
    slug: "las-vegas",
    name: "Las Vegas",
    country: "United States",
    avgPrice: 160,
    avgRating: 4.7,
    avgPhotos: 24,
    marketAngle:
      "Short-term rental demand in Las Vegas is shaped by leisure stays, work trips, events, and neighborhood-specific search behavior.",
    competitionAngle:
      "Guests compare location, photos, amenities, and perceived trust quickly, so the listing needs to explain why it fits this market.",
    pricingAngle:
      "Pricing should reflect local competition, seasonality, and the experience promised by the photos and amenities.",
    guestExpectationAngle:
      "Guests expect clear arrival details, honest location context, reliable amenities, and a gallery that matches the stay.",
  },
  {
    slug: "orlando",
    name: "Orlando",
    country: "United States",
    avgPrice: 145,
    avgRating: 4.7,
    avgPhotos: 22,
    marketAngle:
      "Short-term rental demand in Orlando is shaped by leisure stays, work trips, events, and neighborhood-specific search behavior.",
    competitionAngle:
      "Guests compare location, photos, amenities, and perceived trust quickly, so the listing needs to explain why it fits this market.",
    pricingAngle:
      "Pricing should reflect local competition, seasonality, and the experience promised by the photos and amenities.",
    guestExpectationAngle:
      "Guests expect clear arrival details, honest location context, reliable amenities, and a gallery that matches the stay.",
  },
  {
    slug: "chicago",
    name: "Chicago",
    country: "United States",
    avgPrice: 150,
    avgRating: 4.7,
    avgPhotos: 24,
    marketAngle:
      "Short-term rental demand in Chicago is shaped by leisure stays, work trips, events, and neighborhood-specific search behavior.",
    competitionAngle:
      "Guests compare location, photos, amenities, and perceived trust quickly, so the listing needs to explain why it fits this market.",
    pricingAngle:
      "Pricing should reflect local competition, seasonality, and the experience promised by the photos and amenities.",
    guestExpectationAngle:
      "Guests expect clear arrival details, honest location context, reliable amenities, and a gallery that matches the stay.",
  },
  {
    slug: "boston",
    name: "Boston",
    country: "United States",
    avgPrice: 175,
    avgRating: 4.7,
    avgPhotos: 24,
    marketAngle:
      "Short-term rental demand in Boston is shaped by leisure stays, work trips, events, and neighborhood-specific search behavior.",
    competitionAngle:
      "Guests compare location, photos, amenities, and perceived trust quickly, so the listing needs to explain why it fits this market.",
    pricingAngle:
      "Pricing should reflect local competition, seasonality, and the experience promised by the photos and amenities.",
    guestExpectationAngle:
      "Guests expect clear arrival details, honest location context, reliable amenities, and a gallery that matches the stay.",
  },
  {
    slug: "rio-de-janeiro",
    name: "Rio de Janeiro",
    country: "Brazil",
    avgPrice: 110,
    avgRating: 4.7,
    avgPhotos: 22,
    marketAngle:
      "Short-term rental demand in Rio de Janeiro is shaped by leisure stays, work trips, events, and neighborhood-specific search behavior.",
    competitionAngle:
      "Guests compare location, photos, amenities, and perceived trust quickly, so the listing needs to explain why it fits this market.",
    pricingAngle:
      "Pricing should reflect local competition, seasonality, and the experience promised by the photos and amenities.",
    guestExpectationAngle:
      "Guests expect clear arrival details, honest location context, reliable amenities, and a gallery that matches the stay.",
  },
  {
    slug: "buenos-aires",
    name: "Buenos Aires",
    country: "Argentina",
    avgPrice: 90,
    avgRating: 4.7,
    avgPhotos: 22,
    marketAngle:
      "Short-term rental demand in Buenos Aires is shaped by leisure stays, work trips, events, and neighborhood-specific search behavior.",
    competitionAngle:
      "Guests compare location, photos, amenities, and perceived trust quickly, so the listing needs to explain why it fits this market.",
    pricingAngle:
      "Pricing should reflect local competition, seasonality, and the experience promised by the photos and amenities.",
    guestExpectationAngle:
      "Guests expect clear arrival details, honest location context, reliable amenities, and a gallery that matches the stay.",
  },
  {
    slug: "tokyo",
    name: "Tokyo",
    country: "Japan",
    avgPrice: 155,
    avgRating: 4.7,
    avgPhotos: 24,
    marketAngle:
      "Short-term rental demand in Tokyo is shaped by leisure stays, work trips, events, and neighborhood-specific search behavior.",
    competitionAngle:
      "Guests compare location, photos, amenities, and perceived trust quickly, so the listing needs to explain why it fits this market.",
    pricingAngle:
      "Pricing should reflect local competition, seasonality, and the experience promised by the photos and amenities.",
    guestExpectationAngle:
      "Guests expect clear arrival details, honest location context, reliable amenities, and a gallery that matches the stay.",
  },
  {
    slug: "kyoto",
    name: "Kyoto",
    country: "Japan",
    avgPrice: 145,
    avgRating: 4.7,
    avgPhotos: 22,
    marketAngle:
      "Short-term rental demand in Kyoto is shaped by leisure stays, work trips, events, and neighborhood-specific search behavior.",
    competitionAngle:
      "Guests compare location, photos, amenities, and perceived trust quickly, so the listing needs to explain why it fits this market.",
    pricingAngle:
      "Pricing should reflect local competition, seasonality, and the experience promised by the photos and amenities.",
    guestExpectationAngle:
      "Guests expect clear arrival details, honest location context, reliable amenities, and a gallery that matches the stay.",
  },
  {
    slug: "seoul",
    name: "Seoul",
    country: "South Korea",
    avgPrice: 120,
    avgRating: 4.7,
    avgPhotos: 22,
    marketAngle:
      "Short-term rental demand in Seoul is shaped by leisure stays, work trips, events, and neighborhood-specific search behavior.",
    competitionAngle:
      "Guests compare location, photos, amenities, and perceived trust quickly, so the listing needs to explain why it fits this market.",
    pricingAngle:
      "Pricing should reflect local competition, seasonality, and the experience promised by the photos and amenities.",
    guestExpectationAngle:
      "Guests expect clear arrival details, honest location context, reliable amenities, and a gallery that matches the stay.",
  },
  {
    slug: "singapore",
    name: "Singapore",
    country: "Singapore",
    avgPrice: 185,
    avgRating: 4.65,
    avgPhotos: 24,
    marketAngle:
      "Short-term rental demand in Singapore is shaped by leisure stays, work trips, events, and neighborhood-specific search behavior.",
    competitionAngle:
      "Guests compare location, photos, amenities, and perceived trust quickly, so the listing needs to explain why it fits this market.",
    pricingAngle:
      "Pricing should reflect local competition, seasonality, and the experience promised by the photos and amenities.",
    guestExpectationAngle:
      "Guests expect clear arrival details, honest location context, reliable amenities, and a gallery that matches the stay.",
  },
  {
    slug: "phuket",
    name: "Phuket",
    country: "Thailand",
    avgPrice: 105,
    avgRating: 4.7,
    avgPhotos: 22,
    marketAngle:
      "Short-term rental demand in Phuket is shaped by leisure stays, work trips, events, and neighborhood-specific search behavior.",
    competitionAngle:
      "Guests compare location, photos, amenities, and perceived trust quickly, so the listing needs to explain why it fits this market.",
    pricingAngle:
      "Pricing should reflect local competition, seasonality, and the experience promised by the photos and amenities.",
    guestExpectationAngle:
      "Guests expect clear arrival details, honest location context, reliable amenities, and a gallery that matches the stay.",
  },
  {
    slug: "chiang-mai",
    name: "Chiang Mai",
    country: "Thailand",
    avgPrice: 60,
    avgRating: 4.7,
    avgPhotos: 22,
    marketAngle:
      "Short-term rental demand in Chiang Mai is shaped by leisure stays, work trips, events, and neighborhood-specific search behavior.",
    competitionAngle:
      "Guests compare location, photos, amenities, and perceived trust quickly, so the listing needs to explain why it fits this market.",
    pricingAngle:
      "Pricing should reflect local competition, seasonality, and the experience promised by the photos and amenities.",
    guestExpectationAngle:
      "Guests expect clear arrival details, honest location context, reliable amenities, and a gallery that matches the stay.",
  },
  {
    slug: "sydney",
    name: "Sydney",
    country: "Australia",
    avgPrice: 190,
    avgRating: 4.65,
    avgPhotos: 24,
    marketAngle:
      "Short-term rental demand in Sydney is shaped by leisure stays, work trips, events, and neighborhood-specific search behavior.",
    competitionAngle:
      "Guests compare location, photos, amenities, and perceived trust quickly, so the listing needs to explain why it fits this market.",
    pricingAngle:
      "Pricing should reflect local competition, seasonality, and the experience promised by the photos and amenities.",
    guestExpectationAngle:
      "Guests expect clear arrival details, honest location context, reliable amenities, and a gallery that matches the stay.",
  },
  {
    slug: "melbourne",
    name: "Melbourne",
    country: "Australia",
    avgPrice: 160,
    avgRating: 4.7,
    avgPhotos: 24,
    marketAngle:
      "Short-term rental demand in Melbourne is shaped by leisure stays, work trips, events, and neighborhood-specific search behavior.",
    competitionAngle:
      "Guests compare location, photos, amenities, and perceived trust quickly, so the listing needs to explain why it fits this market.",
    pricingAngle:
      "Pricing should reflect local competition, seasonality, and the experience promised by the photos and amenities.",
    guestExpectationAngle:
      "Guests expect clear arrival details, honest location context, reliable amenities, and a gallery that matches the stay.",
  },
  {
    slug: "cape-town",
    name: "Cape Town",
    country: "South Africa",
    avgPrice: 120,
    avgRating: 4.7,
    avgPhotos: 22,
    marketAngle:
      "Short-term rental demand in Cape Town is shaped by leisure stays, work trips, events, and neighborhood-specific search behavior.",
    competitionAngle:
      "Guests compare location, photos, amenities, and perceived trust quickly, so the listing needs to explain why it fits this market.",
    pricingAngle:
      "Pricing should reflect local competition, seasonality, and the experience promised by the photos and amenities.",
    guestExpectationAngle:
      "Guests expect clear arrival details, honest location context, reliable amenities, and a gallery that matches the stay.",
  },
  {
    slug: "casablanca",
    name: "Casablanca",
    country: "Morocco",
    avgPrice: 85,
    avgRating: 4.7,
    avgPhotos: 22,
    marketAngle:
      "Short-term rental demand in Casablanca is shaped by leisure stays, work trips, events, and neighborhood-specific search behavior.",
    competitionAngle:
      "Guests compare location, photos, amenities, and perceived trust quickly, so the listing needs to explain why it fits this market.",
    pricingAngle:
      "Pricing should reflect local competition, seasonality, and the experience promised by the photos and amenities.",
    guestExpectationAngle:
      "Guests expect clear arrival details, honest location context, reliable amenities, and a gallery that matches the stay.",
  },
  {
    slug: "agadir",
    name: "Agadir",
    country: "Morocco",
    avgPrice: 90,
    avgRating: 4.7,
    avgPhotos: 22,
    marketAngle:
      "Short-term rental demand in Agadir is shaped by leisure stays, work trips, events, and neighborhood-specific search behavior.",
    competitionAngle:
      "Guests compare location, photos, amenities, and perceived trust quickly, so the listing needs to explain why it fits this market.",
    pricingAngle:
      "Pricing should reflect local competition, seasonality, and the experience promised by the photos and amenities.",
    guestExpectationAngle:
      "Guests expect clear arrival details, honest location context, reliable amenities, and a gallery that matches the stay.",
  }
,
  {
    slug: "brussels",
    name: "Brussels",
    country: "Belgium",
    avgPrice: 120,
    avgRating: 4.68,
    avgPhotos: 23,
    marketAngle:
      "Short-term rental demand in Brussels is influenced by tourism, local events, business travel, and seasonal booking patterns.",
    competitionAngle:
      "Listings compete on location quality, photo presentation, amenities, reviews, and how clearly the stay matches guest intent.",
    pricingAngle:
      "Pricing should be aligned with local demand, seasonality, nearby alternatives, and the strength of the listing presentation.",
    guestExpectationAngle:
      "Guests expect transparent location details, reliable amenities, strong photos, and a listing that quickly builds trust.",
  },
  {
    slug: "antwerp",
    name: "Antwerp",
    country: "Belgium",
    avgPrice: 110,
    avgRating: 4.72,
    avgPhotos: 23,
    marketAngle:
      "Short-term rental demand in Antwerp is influenced by tourism, local events, business travel, and seasonal booking patterns.",
    competitionAngle:
      "Listings compete on location quality, photo presentation, amenities, reviews, and how clearly the stay matches guest intent.",
    pricingAngle:
      "Pricing should be aligned with local demand, seasonality, nearby alternatives, and the strength of the listing presentation.",
    guestExpectationAngle:
      "Guests expect transparent location details, reliable amenities, strong photos, and a listing that quickly builds trust.",
  },
  {
    slug: "rotterdam",
    name: "Rotterdam",
    country: "Netherlands",
    avgPrice: 125,
    avgRating: 4.68,
    avgPhotos: 23,
    marketAngle:
      "Short-term rental demand in Rotterdam is influenced by tourism, local events, business travel, and seasonal booking patterns.",
    competitionAngle:
      "Listings compete on location quality, photo presentation, amenities, reviews, and how clearly the stay matches guest intent.",
    pricingAngle:
      "Pricing should be aligned with local demand, seasonality, nearby alternatives, and the strength of the listing presentation.",
    guestExpectationAngle:
      "Guests expect transparent location details, reliable amenities, strong photos, and a listing that quickly builds trust.",
  },
  {
    slug: "the-hague",
    name: "The Hague",
    country: "Netherlands",
    avgPrice: 130,
    avgRating: 4.68,
    avgPhotos: 26,
    marketAngle:
      "Short-term rental demand in The Hague is influenced by tourism, local events, business travel, and seasonal booking patterns.",
    competitionAngle:
      "Listings compete on location quality, photo presentation, amenities, reviews, and how clearly the stay matches guest intent.",
    pricingAngle:
      "Pricing should be aligned with local demand, seasonality, nearby alternatives, and the strength of the listing presentation.",
    guestExpectationAngle:
      "Guests expect transparent location details, reliable amenities, strong photos, and a listing that quickly builds trust.",
  },
  {
    slug: "stockholm",
    name: "Stockholm",
    country: "Sweden",
    avgPrice: 145,
    avgRating: 4.68,
    avgPhotos: 26,
    marketAngle:
      "Short-term rental demand in Stockholm is influenced by tourism, local events, business travel, and seasonal booking patterns.",
    competitionAngle:
      "Listings compete on location quality, photo presentation, amenities, reviews, and how clearly the stay matches guest intent.",
    pricingAngle:
      "Pricing should be aligned with local demand, seasonality, nearby alternatives, and the strength of the listing presentation.",
    guestExpectationAngle:
      "Guests expect transparent location details, reliable amenities, strong photos, and a listing that quickly builds trust.",
  },
  {
    slug: "copenhagen",
    name: "Copenhagen",
    country: "Denmark",
    avgPrice: 155,
    avgRating: 4.68,
    avgPhotos: 26,
    marketAngle:
      "Short-term rental demand in Copenhagen is influenced by tourism, local events, business travel, and seasonal booking patterns.",
    competitionAngle:
      "Listings compete on location quality, photo presentation, amenities, reviews, and how clearly the stay matches guest intent.",
    pricingAngle:
      "Pricing should be aligned with local demand, seasonality, nearby alternatives, and the strength of the listing presentation.",
    guestExpectationAngle:
      "Guests expect transparent location details, reliable amenities, strong photos, and a listing that quickly builds trust.",
  },
  {
    slug: "oslo",
    name: "Oslo",
    country: "Norway",
    avgPrice: 150,
    avgRating: 4.68,
    avgPhotos: 26,
    marketAngle:
      "Short-term rental demand in Oslo is influenced by tourism, local events, business travel, and seasonal booking patterns.",
    competitionAngle:
      "Listings compete on location quality, photo presentation, amenities, reviews, and how clearly the stay matches guest intent.",
    pricingAngle:
      "Pricing should be aligned with local demand, seasonality, nearby alternatives, and the strength of the listing presentation.",
    guestExpectationAngle:
      "Guests expect transparent location details, reliable amenities, strong photos, and a listing that quickly builds trust.",
  },
  {
    slug: "helsinki",
    name: "Helsinki",
    country: "Finland",
    avgPrice: 120,
    avgRating: 4.68,
    avgPhotos: 23,
    marketAngle:
      "Short-term rental demand in Helsinki is influenced by tourism, local events, business travel, and seasonal booking patterns.",
    competitionAngle:
      "Listings compete on location quality, photo presentation, amenities, reviews, and how clearly the stay matches guest intent.",
    pricingAngle:
      "Pricing should be aligned with local demand, seasonality, nearby alternatives, and the strength of the listing presentation.",
    guestExpectationAngle:
      "Guests expect transparent location details, reliable amenities, strong photos, and a listing that quickly builds trust.",
  },
  {
    slug: "warsaw",
    name: "Warsaw",
    country: "Poland",
    avgPrice: 85,
    avgRating: 4.72,
    avgPhotos: 23,
    marketAngle:
      "Short-term rental demand in Warsaw is influenced by tourism, local events, business travel, and seasonal booking patterns.",
    competitionAngle:
      "Listings compete on location quality, photo presentation, amenities, reviews, and how clearly the stay matches guest intent.",
    pricingAngle:
      "Pricing should be aligned with local demand, seasonality, nearby alternatives, and the strength of the listing presentation.",
    guestExpectationAngle:
      "Guests expect transparent location details, reliable amenities, strong photos, and a listing that quickly builds trust.",
  },
  {
    slug: "krakow",
    name: "Krakow",
    country: "Poland",
    avgPrice: 80,
    avgRating: 4.72,
    avgPhotos: 23,
    marketAngle:
      "Short-term rental demand in Krakow is influenced by tourism, local events, business travel, and seasonal booking patterns.",
    competitionAngle:
      "Listings compete on location quality, photo presentation, amenities, reviews, and how clearly the stay matches guest intent.",
    pricingAngle:
      "Pricing should be aligned with local demand, seasonality, nearby alternatives, and the strength of the listing presentation.",
    guestExpectationAngle:
      "Guests expect transparent location details, reliable amenities, strong photos, and a listing that quickly builds trust.",
  },
  {
    slug: "bucharest",
    name: "Bucharest",
    country: "Romania",
    avgPrice: 70,
    avgRating: 4.72,
    avgPhotos: 23,
    marketAngle:
      "Short-term rental demand in Bucharest is influenced by tourism, local events, business travel, and seasonal booking patterns.",
    competitionAngle:
      "Listings compete on location quality, photo presentation, amenities, reviews, and how clearly the stay matches guest intent.",
    pricingAngle:
      "Pricing should be aligned with local demand, seasonality, nearby alternatives, and the strength of the listing presentation.",
    guestExpectationAngle:
      "Guests expect transparent location details, reliable amenities, strong photos, and a listing that quickly builds trust.",
  },
  {
    slug: "sofia",
    name: "Sofia",
    country: "Bulgaria",
    avgPrice: 65,
    avgRating: 4.72,
    avgPhotos: 23,
    marketAngle:
      "Short-term rental demand in Sofia is influenced by tourism, local events, business travel, and seasonal booking patterns.",
    competitionAngle:
      "Listings compete on location quality, photo presentation, amenities, reviews, and how clearly the stay matches guest intent.",
    pricingAngle:
      "Pricing should be aligned with local demand, seasonality, nearby alternatives, and the strength of the listing presentation.",
    guestExpectationAngle:
      "Guests expect transparent location details, reliable amenities, strong photos, and a listing that quickly builds trust.",
  },
  {
    slug: "zagreb",
    name: "Zagreb",
    country: "Croatia",
    avgPrice: 85,
    avgRating: 4.72,
    avgPhotos: 23,
    marketAngle:
      "Short-term rental demand in Zagreb is influenced by tourism, local events, business travel, and seasonal booking patterns.",
    competitionAngle:
      "Listings compete on location quality, photo presentation, amenities, reviews, and how clearly the stay matches guest intent.",
    pricingAngle:
      "Pricing should be aligned with local demand, seasonality, nearby alternatives, and the strength of the listing presentation.",
    guestExpectationAngle:
      "Guests expect transparent location details, reliable amenities, strong photos, and a listing that quickly builds trust.",
  },
  {
    slug: "split",
    name: "Split",
    country: "Croatia",
    avgPrice: 135,
    avgRating: 4.68,
    avgPhotos: 26,
    marketAngle:
      "Short-term rental demand in Split is influenced by tourism, local events, business travel, and seasonal booking patterns.",
    competitionAngle:
      "Listings compete on location quality, photo presentation, amenities, reviews, and how clearly the stay matches guest intent.",
    pricingAngle:
      "Pricing should be aligned with local demand, seasonality, nearby alternatives, and the strength of the listing presentation.",
    guestExpectationAngle:
      "Guests expect transparent location details, reliable amenities, strong photos, and a listing that quickly builds trust.",
  },
  {
    slug: "dubrovnik",
    name: "Dubrovnik",
    country: "Croatia",
    avgPrice: 170,
    avgRating: 4.68,
    avgPhotos: 26,
    marketAngle:
      "Short-term rental demand in Dubrovnik is influenced by tourism, local events, business travel, and seasonal booking patterns.",
    competitionAngle:
      "Listings compete on location quality, photo presentation, amenities, reviews, and how clearly the stay matches guest intent.",
    pricingAngle:
      "Pricing should be aligned with local demand, seasonality, nearby alternatives, and the strength of the listing presentation.",
    guestExpectationAngle:
      "Guests expect transparent location details, reliable amenities, strong photos, and a listing that quickly builds trust.",
  },
  {
    slug: "ljubljana",
    name: "Ljubljana",
    country: "Slovenia",
    avgPrice: 95,
    avgRating: 4.72,
    avgPhotos: 23,
    marketAngle:
      "Short-term rental demand in Ljubljana is influenced by tourism, local events, business travel, and seasonal booking patterns.",
    competitionAngle:
      "Listings compete on location quality, photo presentation, amenities, reviews, and how clearly the stay matches guest intent.",
    pricingAngle:
      "Pricing should be aligned with local demand, seasonality, nearby alternatives, and the strength of the listing presentation.",
    guestExpectationAngle:
      "Guests expect transparent location details, reliable amenities, strong photos, and a listing that quickly builds trust.",
  },
  {
    slug: "reykjavik",
    name: "Reykjavik",
    country: "Iceland",
    avgPrice: 190,
    avgRating: 4.68,
    avgPhotos: 26,
    marketAngle:
      "Short-term rental demand in Reykjavik is influenced by tourism, local events, business travel, and seasonal booking patterns.",
    competitionAngle:
      "Listings compete on location quality, photo presentation, amenities, reviews, and how clearly the stay matches guest intent.",
    pricingAngle:
      "Pricing should be aligned with local demand, seasonality, nearby alternatives, and the strength of the listing presentation.",
    guestExpectationAngle:
      "Guests expect transparent location details, reliable amenities, strong photos, and a listing that quickly builds trust.",
  },
  {
    slug: "palma-de-mallorca",
    name: "Palma de Mallorca",
    country: "Spain",
    avgPrice: 175,
    avgRating: 4.68,
    avgPhotos: 26,
    marketAngle:
      "Short-term rental demand in Palma de Mallorca is influenced by tourism, local events, business travel, and seasonal booking patterns.",
    competitionAngle:
      "Listings compete on location quality, photo presentation, amenities, reviews, and how clearly the stay matches guest intent.",
    pricingAngle:
      "Pricing should be aligned with local demand, seasonality, nearby alternatives, and the strength of the listing presentation.",
    guestExpectationAngle:
      "Guests expect transparent location details, reliable amenities, strong photos, and a listing that quickly builds trust.",
  },
  {
    slug: "granada",
    name: "Granada",
    country: "Spain",
    avgPrice: 95,
    avgRating: 4.72,
    avgPhotos: 23,
    marketAngle:
      "Short-term rental demand in Granada is influenced by tourism, local events, business travel, and seasonal booking patterns.",
    competitionAngle:
      "Listings compete on location quality, photo presentation, amenities, reviews, and how clearly the stay matches guest intent.",
    pricingAngle:
      "Pricing should be aligned with local demand, seasonality, nearby alternatives, and the strength of the listing presentation.",
    guestExpectationAngle:
      "Guests expect transparent location details, reliable amenities, strong photos, and a listing that quickly builds trust.",
  },
  {
    slug: "alicante",
    name: "Alicante",
    country: "Spain",
    avgPrice: 115,
    avgRating: 4.72,
    avgPhotos: 23,
    marketAngle:
      "Short-term rental demand in Alicante is influenced by tourism, local events, business travel, and seasonal booking patterns.",
    competitionAngle:
      "Listings compete on location quality, photo presentation, amenities, reviews, and how clearly the stay matches guest intent.",
    pricingAngle:
      "Pricing should be aligned with local demand, seasonality, nearby alternatives, and the strength of the listing presentation.",
    guestExpectationAngle:
      "Guests expect transparent location details, reliable amenities, strong photos, and a listing that quickly builds trust.",
  },
  {
    slug: "bilbao",
    name: "Bilbao",
    country: "Spain",
    avgPrice: 120,
    avgRating: 4.68,
    avgPhotos: 23,
    marketAngle:
      "Short-term rental demand in Bilbao is influenced by tourism, local events, business travel, and seasonal booking patterns.",
    competitionAngle:
      "Listings compete on location quality, photo presentation, amenities, reviews, and how clearly the stay matches guest intent.",
    pricingAngle:
      "Pricing should be aligned with local demand, seasonality, nearby alternatives, and the strength of the listing presentation.",
    guestExpectationAngle:
      "Guests expect transparent location details, reliable amenities, strong photos, and a listing that quickly builds trust.",
  },
  {
    slug: "san-sebastian",
    name: "San Sebastian",
    country: "Spain",
    avgPrice: 155,
    avgRating: 4.68,
    avgPhotos: 26,
    marketAngle:
      "Short-term rental demand in San Sebastian is influenced by tourism, local events, business travel, and seasonal booking patterns.",
    competitionAngle:
      "Listings compete on location quality, photo presentation, amenities, reviews, and how clearly the stay matches guest intent.",
    pricingAngle:
      "Pricing should be aligned with local demand, seasonality, nearby alternatives, and the strength of the listing presentation.",
    guestExpectationAngle:
      "Guests expect transparent location details, reliable amenities, strong photos, and a listing that quickly builds trust.",
  },
  {
    slug: "madeira",
    name: "Madeira",
    country: "Portugal",
    avgPrice: 125,
    avgRating: 4.68,
    avgPhotos: 23,
    marketAngle:
      "Short-term rental demand in Madeira is influenced by tourism, local events, business travel, and seasonal booking patterns.",
    competitionAngle:
      "Listings compete on location quality, photo presentation, amenities, reviews, and how clearly the stay matches guest intent.",
    pricingAngle:
      "Pricing should be aligned with local demand, seasonality, nearby alternatives, and the strength of the listing presentation.",
    guestExpectationAngle:
      "Guests expect transparent location details, reliable amenities, strong photos, and a listing that quickly builds trust.",
  },
  {
    slug: "coimbra",
    name: "Coimbra",
    country: "Portugal",
    avgPrice: 75,
    avgRating: 4.72,
    avgPhotos: 23,
    marketAngle:
      "Short-term rental demand in Coimbra is influenced by tourism, local events, business travel, and seasonal booking patterns.",
    competitionAngle:
      "Listings compete on location quality, photo presentation, amenities, reviews, and how clearly the stay matches guest intent.",
    pricingAngle:
      "Pricing should be aligned with local demand, seasonality, nearby alternatives, and the strength of the listing presentation.",
    guestExpectationAngle:
      "Guests expect transparent location details, reliable amenities, strong photos, and a listing that quickly builds trust.",
  },
  {
    slug: "palermo",
    name: "Palermo",
    country: "Italy",
    avgPrice: 105,
    avgRating: 4.72,
    avgPhotos: 23,
    marketAngle:
      "Short-term rental demand in Palermo is influenced by tourism, local events, business travel, and seasonal booking patterns.",
    competitionAngle:
      "Listings compete on location quality, photo presentation, amenities, reviews, and how clearly the stay matches guest intent.",
    pricingAngle:
      "Pricing should be aligned with local demand, seasonality, nearby alternatives, and the strength of the listing presentation.",
    guestExpectationAngle:
      "Guests expect transparent location details, reliable amenities, strong photos, and a listing that quickly builds trust.",
  },
  {
    slug: "bologna",
    name: "Bologna",
    country: "Italy",
    avgPrice: 115,
    avgRating: 4.72,
    avgPhotos: 23,
    marketAngle:
      "Short-term rental demand in Bologna is influenced by tourism, local events, business travel, and seasonal booking patterns.",
    competitionAngle:
      "Listings compete on location quality, photo presentation, amenities, reviews, and how clearly the stay matches guest intent.",
    pricingAngle:
      "Pricing should be aligned with local demand, seasonality, nearby alternatives, and the strength of the listing presentation.",
    guestExpectationAngle:
      "Guests expect transparent location details, reliable amenities, strong photos, and a listing that quickly builds trust.",
  },
  {
    slug: "turin",
    name: "Turin",
    country: "Italy",
    avgPrice: 110,
    avgRating: 4.72,
    avgPhotos: 23,
    marketAngle:
      "Short-term rental demand in Turin is influenced by tourism, local events, business travel, and seasonal booking patterns.",
    competitionAngle:
      "Listings compete on location quality, photo presentation, amenities, reviews, and how clearly the stay matches guest intent.",
    pricingAngle:
      "Pricing should be aligned with local demand, seasonality, nearby alternatives, and the strength of the listing presentation.",
    guestExpectationAngle:
      "Guests expect transparent location details, reliable amenities, strong photos, and a listing that quickly builds trust.",
  },
  {
    slug: "verona",
    name: "Verona",
    country: "Italy",
    avgPrice: 120,
    avgRating: 4.68,
    avgPhotos: 23,
    marketAngle:
      "Short-term rental demand in Verona is influenced by tourism, local events, business travel, and seasonal booking patterns.",
    competitionAngle:
      "Listings compete on location quality, photo presentation, amenities, reviews, and how clearly the stay matches guest intent.",
    pricingAngle:
      "Pricing should be aligned with local demand, seasonality, nearby alternatives, and the strength of the listing presentation.",
    guestExpectationAngle:
      "Guests expect transparent location details, reliable amenities, strong photos, and a listing that quickly builds trust.",
  },
  {
    slug: "pisa",
    name: "Pisa",
    country: "Italy",
    avgPrice: 105,
    avgRating: 4.72,
    avgPhotos: 23,
    marketAngle:
      "Short-term rental demand in Pisa is influenced by tourism, local events, business travel, and seasonal booking patterns.",
    competitionAngle:
      "Listings compete on location quality, photo presentation, amenities, reviews, and how clearly the stay matches guest intent.",
    pricingAngle:
      "Pricing should be aligned with local demand, seasonality, nearby alternatives, and the strength of the listing presentation.",
    guestExpectationAngle:
      "Guests expect transparent location details, reliable amenities, strong photos, and a listing that quickly builds trust.",
  },
  {
    slug: "amalfi",
    name: "Amalfi",
    country: "Italy",
    avgPrice: 240,
    avgRating: 4.68,
    avgPhotos: 26,
    marketAngle:
      "Short-term rental demand in Amalfi is influenced by tourism, local events, business travel, and seasonal booking patterns.",
    competitionAngle:
      "Listings compete on location quality, photo presentation, amenities, reviews, and how clearly the stay matches guest intent.",
    pricingAngle:
      "Pricing should be aligned with local demand, seasonality, nearby alternatives, and the strength of the listing presentation.",
    guestExpectationAngle:
      "Guests expect transparent location details, reliable amenities, strong photos, and a listing that quickly builds trust.",
  },
  {
    slug: "crete",
    name: "Crete",
    country: "Greece",
    avgPrice: 125,
    avgRating: 4.68,
    avgPhotos: 23,
    marketAngle:
      "Short-term rental demand in Crete is influenced by tourism, local events, business travel, and seasonal booking patterns.",
    competitionAngle:
      "Listings compete on location quality, photo presentation, amenities, reviews, and how clearly the stay matches guest intent.",
    pricingAngle:
      "Pricing should be aligned with local demand, seasonality, nearby alternatives, and the strength of the listing presentation.",
    guestExpectationAngle:
      "Guests expect transparent location details, reliable amenities, strong photos, and a listing that quickly builds trust.",
  },
  {
    slug: "rhodes",
    name: "Rhodes",
    country: "Greece",
    avgPrice: 130,
    avgRating: 4.68,
    avgPhotos: 26,
    marketAngle:
      "Short-term rental demand in Rhodes is influenced by tourism, local events, business travel, and seasonal booking patterns.",
    competitionAngle:
      "Listings compete on location quality, photo presentation, amenities, reviews, and how clearly the stay matches guest intent.",
    pricingAngle:
      "Pricing should be aligned with local demand, seasonality, nearby alternatives, and the strength of the listing presentation.",
    guestExpectationAngle:
      "Guests expect transparent location details, reliable amenities, strong photos, and a listing that quickly builds trust.",
  },
  {
    slug: "corfu",
    name: "Corfu",
    country: "Greece",
    avgPrice: 135,
    avgRating: 4.68,
    avgPhotos: 26,
    marketAngle:
      "Short-term rental demand in Corfu is influenced by tourism, local events, business travel, and seasonal booking patterns.",
    competitionAngle:
      "Listings compete on location quality, photo presentation, amenities, reviews, and how clearly the stay matches guest intent.",
    pricingAngle:
      "Pricing should be aligned with local demand, seasonality, nearby alternatives, and the strength of the listing presentation.",
    guestExpectationAngle:
      "Guests expect transparent location details, reliable amenities, strong photos, and a listing that quickly builds trust.",
  },
  {
    slug: "larnaca",
    name: "Larnaca",
    country: "Cyprus",
    avgPrice: 100,
    avgRating: 4.72,
    avgPhotos: 23,
    marketAngle:
      "Short-term rental demand in Larnaca is influenced by tourism, local events, business travel, and seasonal booking patterns.",
    competitionAngle:
      "Listings compete on location quality, photo presentation, amenities, reviews, and how clearly the stay matches guest intent.",
    pricingAngle:
      "Pricing should be aligned with local demand, seasonality, nearby alternatives, and the strength of the listing presentation.",
    guestExpectationAngle:
      "Guests expect transparent location details, reliable amenities, strong photos, and a listing that quickly builds trust.",
  },
  {
    slug: "tel-aviv",
    name: "Tel Aviv",
    country: "Israel",
    avgPrice: 190,
    avgRating: 4.68,
    avgPhotos: 26,
    marketAngle:
      "Short-term rental demand in Tel Aviv is influenced by tourism, local events, business travel, and seasonal booking patterns.",
    competitionAngle:
      "Listings compete on location quality, photo presentation, amenities, reviews, and how clearly the stay matches guest intent.",
    pricingAngle:
      "Pricing should be aligned with local demand, seasonality, nearby alternatives, and the strength of the listing presentation.",
    guestExpectationAngle:
      "Guests expect transparent location details, reliable amenities, strong photos, and a listing that quickly builds trust.",
  },
  {
    slug: "jerusalem",
    name: "Jerusalem",
    country: "Israel",
    avgPrice: 150,
    avgRating: 4.68,
    avgPhotos: 26,
    marketAngle:
      "Short-term rental demand in Jerusalem is influenced by tourism, local events, business travel, and seasonal booking patterns.",
    competitionAngle:
      "Listings compete on location quality, photo presentation, amenities, reviews, and how clearly the stay matches guest intent.",
    pricingAngle:
      "Pricing should be aligned with local demand, seasonality, nearby alternatives, and the strength of the listing presentation.",
    guestExpectationAngle:
      "Guests expect transparent location details, reliable amenities, strong photos, and a listing that quickly builds trust.",
  },
  {
    slug: "doha",
    name: "Doha",
    country: "Qatar",
    avgPrice: 160,
    avgRating: 4.68,
    avgPhotos: 26,
    marketAngle:
      "Short-term rental demand in Doha is influenced by tourism, local events, business travel, and seasonal booking patterns.",
    competitionAngle:
      "Listings compete on location quality, photo presentation, amenities, reviews, and how clearly the stay matches guest intent.",
    pricingAngle:
      "Pricing should be aligned with local demand, seasonality, nearby alternatives, and the strength of the listing presentation.",
    guestExpectationAngle:
      "Guests expect transparent location details, reliable amenities, strong photos, and a listing that quickly builds trust.",
  },
  {
    slug: "abu-dhabi",
    name: "Abu Dhabi",
    country: "United Arab Emirates",
    avgPrice: 170,
    avgRating: 4.68,
    avgPhotos: 26,
    marketAngle:
      "Short-term rental demand in Abu Dhabi is influenced by tourism, local events, business travel, and seasonal booking patterns.",
    competitionAngle:
      "Listings compete on location quality, photo presentation, amenities, reviews, and how clearly the stay matches guest intent.",
    pricingAngle:
      "Pricing should be aligned with local demand, seasonality, nearby alternatives, and the strength of the listing presentation.",
    guestExpectationAngle:
      "Guests expect transparent location details, reliable amenities, strong photos, and a listing that quickly builds trust.",
  },
  {
    slug: "riyadh",
    name: "Riyadh",
    country: "Saudi Arabia",
    avgPrice: 135,
    avgRating: 4.68,
    avgPhotos: 26,
    marketAngle:
      "Short-term rental demand in Riyadh is influenced by tourism, local events, business travel, and seasonal booking patterns.",
    competitionAngle:
      "Listings compete on location quality, photo presentation, amenities, reviews, and how clearly the stay matches guest intent.",
    pricingAngle:
      "Pricing should be aligned with local demand, seasonality, nearby alternatives, and the strength of the listing presentation.",
    guestExpectationAngle:
      "Guests expect transparent location details, reliable amenities, strong photos, and a listing that quickly builds trust.",
  },
  {
    slug: "jeddah",
    name: "Jeddah",
    country: "Saudi Arabia",
    avgPrice: 140,
    avgRating: 4.68,
    avgPhotos: 26,
    marketAngle:
      "Short-term rental demand in Jeddah is influenced by tourism, local events, business travel, and seasonal booking patterns.",
    competitionAngle:
      "Listings compete on location quality, photo presentation, amenities, reviews, and how clearly the stay matches guest intent.",
    pricingAngle:
      "Pricing should be aligned with local demand, seasonality, nearby alternatives, and the strength of the listing presentation.",
    guestExpectationAngle:
      "Guests expect transparent location details, reliable amenities, strong photos, and a listing that quickly builds trust.",
  },
  {
    slug: "muscat",
    name: "Muscat",
    country: "Oman",
    avgPrice: 115,
    avgRating: 4.72,
    avgPhotos: 23,
    marketAngle:
      "Short-term rental demand in Muscat is influenced by tourism, local events, business travel, and seasonal booking patterns.",
    competitionAngle:
      "Listings compete on location quality, photo presentation, amenities, reviews, and how clearly the stay matches guest intent.",
    pricingAngle:
      "Pricing should be aligned with local demand, seasonality, nearby alternatives, and the strength of the listing presentation.",
    guestExpectationAngle:
      "Guests expect transparent location details, reliable amenities, strong photos, and a listing that quickly builds trust.",
  },
  {
    slug: "amman",
    name: "Amman",
    country: "Jordan",
    avgPrice: 80,
    avgRating: 4.72,
    avgPhotos: 23,
    marketAngle:
      "Short-term rental demand in Amman is influenced by tourism, local events, business travel, and seasonal booking patterns.",
    competitionAngle:
      "Listings compete on location quality, photo presentation, amenities, reviews, and how clearly the stay matches guest intent.",
    pricingAngle:
      "Pricing should be aligned with local demand, seasonality, nearby alternatives, and the strength of the listing presentation.",
    guestExpectationAngle:
      "Guests expect transparent location details, reliable amenities, strong photos, and a listing that quickly builds trust.",
  },
  {
    slug: "cairo",
    name: "Cairo",
    country: "Egypt",
    avgPrice: 70,
    avgRating: 4.72,
    avgPhotos: 23,
    marketAngle:
      "Short-term rental demand in Cairo is influenced by tourism, local events, business travel, and seasonal booking patterns.",
    competitionAngle:
      "Listings compete on location quality, photo presentation, amenities, reviews, and how clearly the stay matches guest intent.",
    pricingAngle:
      "Pricing should be aligned with local demand, seasonality, nearby alternatives, and the strength of the listing presentation.",
    guestExpectationAngle:
      "Guests expect transparent location details, reliable amenities, strong photos, and a listing that quickly builds trust.",
  },
  {
    slug: "sharm-el-sheikh",
    name: "Sharm El Sheikh",
    country: "Egypt",
    avgPrice: 100,
    avgRating: 4.72,
    avgPhotos: 23,
    marketAngle:
      "Short-term rental demand in Sharm El Sheikh is influenced by tourism, local events, business travel, and seasonal booking patterns.",
    competitionAngle:
      "Listings compete on location quality, photo presentation, amenities, reviews, and how clearly the stay matches guest intent.",
    pricingAngle:
      "Pricing should be aligned with local demand, seasonality, nearby alternatives, and the strength of the listing presentation.",
    guestExpectationAngle:
      "Guests expect transparent location details, reliable amenities, strong photos, and a listing that quickly builds trust.",
  },
  {
    slug: "hurghada",
    name: "Hurghada",
    country: "Egypt",
    avgPrice: 90,
    avgRating: 4.72,
    avgPhotos: 23,
    marketAngle:
      "Short-term rental demand in Hurghada is influenced by tourism, local events, business travel, and seasonal booking patterns.",
    competitionAngle:
      "Listings compete on location quality, photo presentation, amenities, reviews, and how clearly the stay matches guest intent.",
    pricingAngle:
      "Pricing should be aligned with local demand, seasonality, nearby alternatives, and the strength of the listing presentation.",
    guestExpectationAngle:
      "Guests expect transparent location details, reliable amenities, strong photos, and a listing that quickly builds trust.",
  },
  {
    slug: "tunis",
    name: "Tunis",
    country: "Tunisia",
    avgPrice: 65,
    avgRating: 4.72,
    avgPhotos: 23,
    marketAngle:
      "Short-term rental demand in Tunis is influenced by tourism, local events, business travel, and seasonal booking patterns.",
    competitionAngle:
      "Listings compete on location quality, photo presentation, amenities, reviews, and how clearly the stay matches guest intent.",
    pricingAngle:
      "Pricing should be aligned with local demand, seasonality, nearby alternatives, and the strength of the listing presentation.",
    guestExpectationAngle:
      "Guests expect transparent location details, reliable amenities, strong photos, and a listing that quickly builds trust.",
  },
  {
    slug: "djerba",
    name: "Djerba",
    country: "Tunisia",
    avgPrice: 75,
    avgRating: 4.72,
    avgPhotos: 23,
    marketAngle:
      "Short-term rental demand in Djerba is influenced by tourism, local events, business travel, and seasonal booking patterns.",
    competitionAngle:
      "Listings compete on location quality, photo presentation, amenities, reviews, and how clearly the stay matches guest intent.",
    pricingAngle:
      "Pricing should be aligned with local demand, seasonality, nearby alternatives, and the strength of the listing presentation.",
    guestExpectationAngle:
      "Guests expect transparent location details, reliable amenities, strong photos, and a listing that quickly builds trust.",
  },
  {
    slug: "rabat",
    name: "Rabat",
    country: "Morocco",
    avgPrice: 80,
    avgRating: 4.72,
    avgPhotos: 23,
    marketAngle:
      "Short-term rental demand in Rabat is influenced by tourism, local events, business travel, and seasonal booking patterns.",
    competitionAngle:
      "Listings compete on location quality, photo presentation, amenities, reviews, and how clearly the stay matches guest intent.",
    pricingAngle:
      "Pricing should be aligned with local demand, seasonality, nearby alternatives, and the strength of the listing presentation.",
    guestExpectationAngle:
      "Guests expect transparent location details, reliable amenities, strong photos, and a listing that quickly builds trust.",
  },
  {
    slug: "tangier",
    name: "Tangier",
    country: "Morocco",
    avgPrice: 85,
    avgRating: 4.72,
    avgPhotos: 23,
    marketAngle:
      "Short-term rental demand in Tangier is influenced by tourism, local events, business travel, and seasonal booking patterns.",
    competitionAngle:
      "Listings compete on location quality, photo presentation, amenities, reviews, and how clearly the stay matches guest intent.",
    pricingAngle:
      "Pricing should be aligned with local demand, seasonality, nearby alternatives, and the strength of the listing presentation.",
    guestExpectationAngle:
      "Guests expect transparent location details, reliable amenities, strong photos, and a listing that quickly builds trust.",
  },
  {
    slug: "fes",
    name: "Fes",
    country: "Morocco",
    avgPrice: 75,
    avgRating: 4.72,
    avgPhotos: 23,
    marketAngle:
      "Short-term rental demand in Fes is influenced by tourism, local events, business travel, and seasonal booking patterns.",
    competitionAngle:
      "Listings compete on location quality, photo presentation, amenities, reviews, and how clearly the stay matches guest intent.",
    pricingAngle:
      "Pricing should be aligned with local demand, seasonality, nearby alternatives, and the strength of the listing presentation.",
    guestExpectationAngle:
      "Guests expect transparent location details, reliable amenities, strong photos, and a listing that quickly builds trust.",
  }
,
  {
    slug: "new-orleans",
    name: "New Orleans",
    country: "United States",
    avgPrice: 165,
    avgRating: 4.68,
    avgPhotos: 27,
    marketAngle:
      "Short-term rental demand in New Orleans is shaped by tourism flows, event calendars, business travel, and neighborhood-level search behavior.",
    competitionAngle:
      "Listings need to stand out through location clarity, strong photos, amenity positioning, review quality, and a clear guest promise.",
    pricingAngle:
      "Pricing should account for local seasonality, nearby comparable listings, booking windows, and the quality signals shown on the listing.",
    guestExpectationAngle:
      "Guests expect transparent location context, reliable amenities, easy check-in information, and photos that accurately represent the stay.",
  },
  {
    slug: "nashville",
    name: "Nashville",
    country: "United States",
    avgPrice: 175,
    avgRating: 4.68,
    avgPhotos: 27,
    marketAngle:
      "Short-term rental demand in Nashville is shaped by tourism flows, event calendars, business travel, and neighborhood-level search behavior.",
    competitionAngle:
      "Listings need to stand out through location clarity, strong photos, amenity positioning, review quality, and a clear guest promise.",
    pricingAngle:
      "Pricing should account for local seasonality, nearby comparable listings, booking windows, and the quality signals shown on the listing.",
    guestExpectationAngle:
      "Guests expect transparent location context, reliable amenities, easy check-in information, and photos that accurately represent the stay.",
  },
  {
    slug: "austin",
    name: "Austin",
    country: "United States",
    avgPrice: 170,
    avgRating: 4.68,
    avgPhotos: 27,
    marketAngle:
      "Short-term rental demand in Austin is shaped by tourism flows, event calendars, business travel, and neighborhood-level search behavior.",
    competitionAngle:
      "Listings need to stand out through location clarity, strong photos, amenity positioning, review quality, and a clear guest promise.",
    pricingAngle:
      "Pricing should account for local seasonality, nearby comparable listings, booking windows, and the quality signals shown on the listing.",
    guestExpectationAngle:
      "Guests expect transparent location context, reliable amenities, easy check-in information, and photos that accurately represent the stay.",
  },
  {
    slug: "seattle",
    name: "Seattle",
    country: "United States",
    avgPrice: 180,
    avgRating: 4.68,
    avgPhotos: 27,
    marketAngle:
      "Short-term rental demand in Seattle is shaped by tourism flows, event calendars, business travel, and neighborhood-level search behavior.",
    competitionAngle:
      "Listings need to stand out through location clarity, strong photos, amenity positioning, review quality, and a clear guest promise.",
    pricingAngle:
      "Pricing should account for local seasonality, nearby comparable listings, booking windows, and the quality signals shown on the listing.",
    guestExpectationAngle:
      "Guests expect transparent location context, reliable amenities, easy check-in information, and photos that accurately represent the stay.",
  },
  {
    slug: "washington-dc",
    name: "Washington DC",
    country: "United States",
    avgPrice: 185,
    avgRating: 4.68,
    avgPhotos: 27,
    marketAngle:
      "Short-term rental demand in Washington DC is shaped by tourism flows, event calendars, business travel, and neighborhood-level search behavior.",
    competitionAngle:
      "Listings need to stand out through location clarity, strong photos, amenity positioning, review quality, and a clear guest promise.",
    pricingAngle:
      "Pricing should account for local seasonality, nearby comparable listings, booking windows, and the quality signals shown on the listing.",
    guestExpectationAngle:
      "Guests expect transparent location context, reliable amenities, easy check-in information, and photos that accurately represent the stay.",
  },
  {
    slug: "philadelphia",
    name: "Philadelphia",
    country: "United States",
    avgPrice: 145,
    avgRating: 4.68,
    avgPhotos: 23,
    marketAngle:
      "Short-term rental demand in Philadelphia is shaped by tourism flows, event calendars, business travel, and neighborhood-level search behavior.",
    competitionAngle:
      "Listings need to stand out through location clarity, strong photos, amenity positioning, review quality, and a clear guest promise.",
    pricingAngle:
      "Pricing should account for local seasonality, nearby comparable listings, booking windows, and the quality signals shown on the listing.",
    guestExpectationAngle:
      "Guests expect transparent location context, reliable amenities, easy check-in information, and photos that accurately represent the stay.",
  },
  {
    slug: "san-diego",
    name: "San Diego",
    country: "United States",
    avgPrice: 200,
    avgRating: 4.68,
    avgPhotos: 27,
    marketAngle:
      "Short-term rental demand in San Diego is shaped by tourism flows, event calendars, business travel, and neighborhood-level search behavior.",
    competitionAngle:
      "Listings need to stand out through location clarity, strong photos, amenity positioning, review quality, and a clear guest promise.",
    pricingAngle:
      "Pricing should account for local seasonality, nearby comparable listings, booking windows, and the quality signals shown on the listing.",
    guestExpectationAngle:
      "Guests expect transparent location context, reliable amenities, easy check-in information, and photos that accurately represent the stay.",
  },
  {
    slug: "fort-lauderdale",
    name: "Fort Lauderdale",
    country: "United States",
    avgPrice: 180,
    avgRating: 4.68,
    avgPhotos: 27,
    marketAngle:
      "Short-term rental demand in Fort Lauderdale is shaped by tourism flows, event calendars, business travel, and neighborhood-level search behavior.",
    competitionAngle:
      "Listings need to stand out through location clarity, strong photos, amenity positioning, review quality, and a clear guest promise.",
    pricingAngle:
      "Pricing should account for local seasonality, nearby comparable listings, booking windows, and the quality signals shown on the listing.",
    guestExpectationAngle:
      "Guests expect transparent location context, reliable amenities, easy check-in information, and photos that accurately represent the stay.",
  },
  {
    slug: "tampa",
    name: "Tampa",
    country: "United States",
    avgPrice: 150,
    avgRating: 4.68,
    avgPhotos: 27,
    marketAngle:
      "Short-term rental demand in Tampa is shaped by tourism flows, event calendars, business travel, and neighborhood-level search behavior.",
    competitionAngle:
      "Listings need to stand out through location clarity, strong photos, amenity positioning, review quality, and a clear guest promise.",
    pricingAngle:
      "Pricing should account for local seasonality, nearby comparable listings, booking windows, and the quality signals shown on the listing.",
    guestExpectationAngle:
      "Guests expect transparent location context, reliable amenities, easy check-in information, and photos that accurately represent the stay.",
  },
  {
    slug: "honolulu",
    name: "Honolulu",
    country: "United States",
    avgPrice: 260,
    avgRating: 4.68,
    avgPhotos: 27,
    marketAngle:
      "Short-term rental demand in Honolulu is shaped by tourism flows, event calendars, business travel, and neighborhood-level search behavior.",
    competitionAngle:
      "Listings need to stand out through location clarity, strong photos, amenity positioning, review quality, and a clear guest promise.",
    pricingAngle:
      "Pricing should account for local seasonality, nearby comparable listings, booking windows, and the quality signals shown on the listing.",
    guestExpectationAngle:
      "Guests expect transparent location context, reliable amenities, easy check-in information, and photos that accurately represent the stay.",
  },
  {
    slug: "montreal",
    name: "Montreal",
    country: "Canada",
    avgPrice: 125,
    avgRating: 4.68,
    avgPhotos: 23,
    marketAngle:
      "Short-term rental demand in Montreal is shaped by tourism flows, event calendars, business travel, and neighborhood-level search behavior.",
    competitionAngle:
      "Listings need to stand out through location clarity, strong photos, amenity positioning, review quality, and a clear guest promise.",
    pricingAngle:
      "Pricing should account for local seasonality, nearby comparable listings, booking windows, and the quality signals shown on the listing.",
    guestExpectationAngle:
      "Guests expect transparent location context, reliable amenities, easy check-in information, and photos that accurately represent the stay.",
  },
  {
    slug: "quebec-city",
    name: "Quebec City",
    country: "Canada",
    avgPrice: 120,
    avgRating: 4.68,
    avgPhotos: 23,
    marketAngle:
      "Short-term rental demand in Quebec City is shaped by tourism flows, event calendars, business travel, and neighborhood-level search behavior.",
    competitionAngle:
      "Listings need to stand out through location clarity, strong photos, amenity positioning, review quality, and a clear guest promise.",
    pricingAngle:
      "Pricing should account for local seasonality, nearby comparable listings, booking windows, and the quality signals shown on the listing.",
    guestExpectationAngle:
      "Guests expect transparent location context, reliable amenities, easy check-in information, and photos that accurately represent the stay.",
  },
  {
    slug: "ottawa",
    name: "Ottawa",
    country: "Canada",
    avgPrice: 115,
    avgRating: 4.72,
    avgPhotos: 23,
    marketAngle:
      "Short-term rental demand in Ottawa is shaped by tourism flows, event calendars, business travel, and neighborhood-level search behavior.",
    competitionAngle:
      "Listings need to stand out through location clarity, strong photos, amenity positioning, review quality, and a clear guest promise.",
    pricingAngle:
      "Pricing should account for local seasonality, nearby comparable listings, booking windows, and the quality signals shown on the listing.",
    guestExpectationAngle:
      "Guests expect transparent location context, reliable amenities, easy check-in information, and photos that accurately represent the stay.",
  },
  {
    slug: "calgary",
    name: "Calgary",
    country: "Canada",
    avgPrice: 120,
    avgRating: 4.68,
    avgPhotos: 23,
    marketAngle:
      "Short-term rental demand in Calgary is shaped by tourism flows, event calendars, business travel, and neighborhood-level search behavior.",
    competitionAngle:
      "Listings need to stand out through location clarity, strong photos, amenity positioning, review quality, and a clear guest promise.",
    pricingAngle:
      "Pricing should account for local seasonality, nearby comparable listings, booking windows, and the quality signals shown on the listing.",
    guestExpectationAngle:
      "Guests expect transparent location context, reliable amenities, easy check-in information, and photos that accurately represent the stay.",
  },
  {
    slug: "mexico-city",
    name: "Mexico City",
    country: "Mexico",
    avgPrice: 95,
    avgRating: 4.72,
    avgPhotos: 23,
    marketAngle:
      "Short-term rental demand in Mexico City is shaped by tourism flows, event calendars, business travel, and neighborhood-level search behavior.",
    competitionAngle:
      "Listings need to stand out through location clarity, strong photos, amenity positioning, review quality, and a clear guest promise.",
    pricingAngle:
      "Pricing should account for local seasonality, nearby comparable listings, booking windows, and the quality signals shown on the listing.",
    guestExpectationAngle:
      "Guests expect transparent location context, reliable amenities, easy check-in information, and photos that accurately represent the stay.",
  },
  {
    slug: "puerto-vallarta",
    name: "Puerto Vallarta",
    country: "Mexico",
    avgPrice: 145,
    avgRating: 4.68,
    avgPhotos: 23,
    marketAngle:
      "Short-term rental demand in Puerto Vallarta is shaped by tourism flows, event calendars, business travel, and neighborhood-level search behavior.",
    competitionAngle:
      "Listings need to stand out through location clarity, strong photos, amenity positioning, review quality, and a clear guest promise.",
    pricingAngle:
      "Pricing should account for local seasonality, nearby comparable listings, booking windows, and the quality signals shown on the listing.",
    guestExpectationAngle:
      "Guests expect transparent location context, reliable amenities, easy check-in information, and photos that accurately represent the stay.",
  },
  {
    slug: "los-cabos",
    name: "Los Cabos",
    country: "Mexico",
    avgPrice: 230,
    avgRating: 4.68,
    avgPhotos: 27,
    marketAngle:
      "Short-term rental demand in Los Cabos is shaped by tourism flows, event calendars, business travel, and neighborhood-level search behavior.",
    competitionAngle:
      "Listings need to stand out through location clarity, strong photos, amenity positioning, review quality, and a clear guest promise.",
    pricingAngle:
      "Pricing should account for local seasonality, nearby comparable listings, booking windows, and the quality signals shown on the listing.",
    guestExpectationAngle:
      "Guests expect transparent location context, reliable amenities, easy check-in information, and photos that accurately represent the stay.",
  },
  {
    slug: "guadalajara",
    name: "Guadalajara",
    country: "Mexico",
    avgPrice: 80,
    avgRating: 4.72,
    avgPhotos: 23,
    marketAngle:
      "Short-term rental demand in Guadalajara is shaped by tourism flows, event calendars, business travel, and neighborhood-level search behavior.",
    competitionAngle:
      "Listings need to stand out through location clarity, strong photos, amenity positioning, review quality, and a clear guest promise.",
    pricingAngle:
      "Pricing should account for local seasonality, nearby comparable listings, booking windows, and the quality signals shown on the listing.",
    guestExpectationAngle:
      "Guests expect transparent location context, reliable amenities, easy check-in information, and photos that accurately represent the stay.",
  },
  {
    slug: "medellin",
    name: "Medellin",
    country: "Colombia",
    avgPrice: 75,
    avgRating: 4.72,
    avgPhotos: 23,
    marketAngle:
      "Short-term rental demand in Medellin is shaped by tourism flows, event calendars, business travel, and neighborhood-level search behavior.",
    competitionAngle:
      "Listings need to stand out through location clarity, strong photos, amenity positioning, review quality, and a clear guest promise.",
    pricingAngle:
      "Pricing should account for local seasonality, nearby comparable listings, booking windows, and the quality signals shown on the listing.",
    guestExpectationAngle:
      "Guests expect transparent location context, reliable amenities, easy check-in information, and photos that accurately represent the stay.",
  },
  {
    slug: "bogota",
    name: "Bogota",
    country: "Colombia",
    avgPrice: 70,
    avgRating: 4.72,
    avgPhotos: 23,
    marketAngle:
      "Short-term rental demand in Bogota is shaped by tourism flows, event calendars, business travel, and neighborhood-level search behavior.",
    competitionAngle:
      "Listings need to stand out through location clarity, strong photos, amenity positioning, review quality, and a clear guest promise.",
    pricingAngle:
      "Pricing should account for local seasonality, nearby comparable listings, booking windows, and the quality signals shown on the listing.",
    guestExpectationAngle:
      "Guests expect transparent location context, reliable amenities, easy check-in information, and photos that accurately represent the stay.",
  },
  {
    slug: "cartagena",
    name: "Cartagena",
    country: "Colombia",
    avgPrice: 120,
    avgRating: 4.68,
    avgPhotos: 23,
    marketAngle:
      "Short-term rental demand in Cartagena is shaped by tourism flows, event calendars, business travel, and neighborhood-level search behavior.",
    competitionAngle:
      "Listings need to stand out through location clarity, strong photos, amenity positioning, review quality, and a clear guest promise.",
    pricingAngle:
      "Pricing should account for local seasonality, nearby comparable listings, booking windows, and the quality signals shown on the listing.",
    guestExpectationAngle:
      "Guests expect transparent location context, reliable amenities, easy check-in information, and photos that accurately represent the stay.",
  },
  {
    slug: "lima",
    name: "Lima",
    country: "Peru",
    avgPrice: 75,
    avgRating: 4.72,
    avgPhotos: 23,
    marketAngle:
      "Short-term rental demand in Lima is shaped by tourism flows, event calendars, business travel, and neighborhood-level search behavior.",
    competitionAngle:
      "Listings need to stand out through location clarity, strong photos, amenity positioning, review quality, and a clear guest promise.",
    pricingAngle:
      "Pricing should account for local seasonality, nearby comparable listings, booking windows, and the quality signals shown on the listing.",
    guestExpectationAngle:
      "Guests expect transparent location context, reliable amenities, easy check-in information, and photos that accurately represent the stay.",
  },
  {
    slug: "cusco",
    name: "Cusco",
    country: "Peru",
    avgPrice: 80,
    avgRating: 4.72,
    avgPhotos: 23,
    marketAngle:
      "Short-term rental demand in Cusco is shaped by tourism flows, event calendars, business travel, and neighborhood-level search behavior.",
    competitionAngle:
      "Listings need to stand out through location clarity, strong photos, amenity positioning, review quality, and a clear guest promise.",
    pricingAngle:
      "Pricing should account for local seasonality, nearby comparable listings, booking windows, and the quality signals shown on the listing.",
    guestExpectationAngle:
      "Guests expect transparent location context, reliable amenities, easy check-in information, and photos that accurately represent the stay.",
  },
  {
    slug: "santiago",
    name: "Santiago",
    country: "Chile",
    avgPrice: 90,
    avgRating: 4.72,
    avgPhotos: 23,
    marketAngle:
      "Short-term rental demand in Santiago is shaped by tourism flows, event calendars, business travel, and neighborhood-level search behavior.",
    competitionAngle:
      "Listings need to stand out through location clarity, strong photos, amenity positioning, review quality, and a clear guest promise.",
    pricingAngle:
      "Pricing should account for local seasonality, nearby comparable listings, booking windows, and the quality signals shown on the listing.",
    guestExpectationAngle:
      "Guests expect transparent location context, reliable amenities, easy check-in information, and photos that accurately represent the stay.",
  },
  {
    slug: "punta-cana",
    name: "Punta Cana",
    country: "Dominican Republic",
    avgPrice: 150,
    avgRating: 4.68,
    avgPhotos: 27,
    marketAngle:
      "Short-term rental demand in Punta Cana is shaped by tourism flows, event calendars, business travel, and neighborhood-level search behavior.",
    competitionAngle:
      "Listings need to stand out through location clarity, strong photos, amenity positioning, review quality, and a clear guest promise.",
    pricingAngle:
      "Pricing should account for local seasonality, nearby comparable listings, booking windows, and the quality signals shown on the listing.",
    guestExpectationAngle:
      "Guests expect transparent location context, reliable amenities, easy check-in information, and photos that accurately represent the stay.",
  },
  {
    slug: "santo-domingo",
    name: "Santo Domingo",
    country: "Dominican Republic",
    avgPrice: 85,
    avgRating: 4.72,
    avgPhotos: 23,
    marketAngle:
      "Short-term rental demand in Santo Domingo is shaped by tourism flows, event calendars, business travel, and neighborhood-level search behavior.",
    competitionAngle:
      "Listings need to stand out through location clarity, strong photos, amenity positioning, review quality, and a clear guest promise.",
    pricingAngle:
      "Pricing should account for local seasonality, nearby comparable listings, booking windows, and the quality signals shown on the listing.",
    guestExpectationAngle:
      "Guests expect transparent location context, reliable amenities, easy check-in information, and photos that accurately represent the stay.",
  },
  {
    slug: "san-juan",
    name: "San Juan",
    country: "Puerto Rico",
    avgPrice: 160,
    avgRating: 4.68,
    avgPhotos: 27,
    marketAngle:
      "Short-term rental demand in San Juan is shaped by tourism flows, event calendars, business travel, and neighborhood-level search behavior.",
    competitionAngle:
      "Listings need to stand out through location clarity, strong photos, amenity positioning, review quality, and a clear guest promise.",
    pricingAngle:
      "Pricing should account for local seasonality, nearby comparable listings, booking windows, and the quality signals shown on the listing.",
    guestExpectationAngle:
      "Guests expect transparent location context, reliable amenities, easy check-in information, and photos that accurately represent the stay.",
  },
  {
    slug: "kingston",
    name: "Kingston",
    country: "Jamaica",
    avgPrice: 90,
    avgRating: 4.72,
    avgPhotos: 23,
    marketAngle:
      "Short-term rental demand in Kingston is shaped by tourism flows, event calendars, business travel, and neighborhood-level search behavior.",
    competitionAngle:
      "Listings need to stand out through location clarity, strong photos, amenity positioning, review quality, and a clear guest promise.",
    pricingAngle:
      "Pricing should account for local seasonality, nearby comparable listings, booking windows, and the quality signals shown on the listing.",
    guestExpectationAngle:
      "Guests expect transparent location context, reliable amenities, easy check-in information, and photos that accurately represent the stay.",
  },
  {
    slug: "montego-bay",
    name: "Montego Bay",
    country: "Jamaica",
    avgPrice: 150,
    avgRating: 4.68,
    avgPhotos: 27,
    marketAngle:
      "Short-term rental demand in Montego Bay is shaped by tourism flows, event calendars, business travel, and neighborhood-level search behavior.",
    competitionAngle:
      "Listings need to stand out through location clarity, strong photos, amenity positioning, review quality, and a clear guest promise.",
    pricingAngle:
      "Pricing should account for local seasonality, nearby comparable listings, booking windows, and the quality signals shown on the listing.",
    guestExpectationAngle:
      "Guests expect transparent location context, reliable amenities, easy check-in information, and photos that accurately represent the stay.",
  },
  {
    slug: "panama-city",
    name: "Panama City",
    country: "Panama",
    avgPrice: 100,
    avgRating: 4.72,
    avgPhotos: 23,
    marketAngle:
      "Short-term rental demand in Panama City is shaped by tourism flows, event calendars, business travel, and neighborhood-level search behavior.",
    competitionAngle:
      "Listings need to stand out through location clarity, strong photos, amenity positioning, review quality, and a clear guest promise.",
    pricingAngle:
      "Pricing should account for local seasonality, nearby comparable listings, booking windows, and the quality signals shown on the listing.",
    guestExpectationAngle:
      "Guests expect transparent location context, reliable amenities, easy check-in information, and photos that accurately represent the stay.",
  },
  {
    slug: "san-jose-costa-rica",
    name: "San Jose",
    country: "Costa Rica",
    avgPrice: 85,
    avgRating: 4.72,
    avgPhotos: 23,
    marketAngle:
      "Short-term rental demand in San Jose is shaped by tourism flows, event calendars, business travel, and neighborhood-level search behavior.",
    competitionAngle:
      "Listings need to stand out through location clarity, strong photos, amenity positioning, review quality, and a clear guest promise.",
    pricingAngle:
      "Pricing should account for local seasonality, nearby comparable listings, booking windows, and the quality signals shown on the listing.",
    guestExpectationAngle:
      "Guests expect transparent location context, reliable amenities, easy check-in information, and photos that accurately represent the stay.",
  },
  {
    slug: "tamarindo",
    name: "Tamarindo",
    country: "Costa Rica",
    avgPrice: 145,
    avgRating: 4.68,
    avgPhotos: 23,
    marketAngle:
      "Short-term rental demand in Tamarindo is shaped by tourism flows, event calendars, business travel, and neighborhood-level search behavior.",
    competitionAngle:
      "Listings need to stand out through location clarity, strong photos, amenity positioning, review quality, and a clear guest promise.",
    pricingAngle:
      "Pricing should account for local seasonality, nearby comparable listings, booking windows, and the quality signals shown on the listing.",
    guestExpectationAngle:
      "Guests expect transparent location context, reliable amenities, easy check-in information, and photos that accurately represent the stay.",
  },
  {
    slug: "manuel-antonio",
    name: "Manuel Antonio",
    country: "Costa Rica",
    avgPrice: 160,
    avgRating: 4.68,
    avgPhotos: 27,
    marketAngle:
      "Short-term rental demand in Manuel Antonio is shaped by tourism flows, event calendars, business travel, and neighborhood-level search behavior.",
    competitionAngle:
      "Listings need to stand out through location clarity, strong photos, amenity positioning, review quality, and a clear guest promise.",
    pricingAngle:
      "Pricing should account for local seasonality, nearby comparable listings, booking windows, and the quality signals shown on the listing.",
    guestExpectationAngle:
      "Guests expect transparent location context, reliable amenities, easy check-in information, and photos that accurately represent the stay.",
  },
  {
    slug: "bali-canggu",
    name: "Canggu",
    country: "Indonesia",
    avgPrice: 110,
    avgRating: 4.72,
    avgPhotos: 23,
    marketAngle:
      "Short-term rental demand in Canggu is shaped by tourism flows, event calendars, business travel, and neighborhood-level search behavior.",
    competitionAngle:
      "Listings need to stand out through location clarity, strong photos, amenity positioning, review quality, and a clear guest promise.",
    pricingAngle:
      "Pricing should account for local seasonality, nearby comparable listings, booking windows, and the quality signals shown on the listing.",
    guestExpectationAngle:
      "Guests expect transparent location context, reliable amenities, easy check-in information, and photos that accurately represent the stay.",
  },
  {
    slug: "ubud",
    name: "Ubud",
    country: "Indonesia",
    avgPrice: 95,
    avgRating: 4.72,
    avgPhotos: 23,
    marketAngle:
      "Short-term rental demand in Ubud is shaped by tourism flows, event calendars, business travel, and neighborhood-level search behavior.",
    competitionAngle:
      "Listings need to stand out through location clarity, strong photos, amenity positioning, review quality, and a clear guest promise.",
    pricingAngle:
      "Pricing should account for local seasonality, nearby comparable listings, booking windows, and the quality signals shown on the listing.",
    guestExpectationAngle:
      "Guests expect transparent location context, reliable amenities, easy check-in information, and photos that accurately represent the stay.",
  },
  {
    slug: "jakarta",
    name: "Jakarta",
    country: "Indonesia",
    avgPrice: 75,
    avgRating: 4.72,
    avgPhotos: 23,
    marketAngle:
      "Short-term rental demand in Jakarta is shaped by tourism flows, event calendars, business travel, and neighborhood-level search behavior.",
    competitionAngle:
      "Listings need to stand out through location clarity, strong photos, amenity positioning, review quality, and a clear guest promise.",
    pricingAngle:
      "Pricing should account for local seasonality, nearby comparable listings, booking windows, and the quality signals shown on the listing.",
    guestExpectationAngle:
      "Guests expect transparent location context, reliable amenities, easy check-in information, and photos that accurately represent the stay.",
  },
  {
    slug: "kuala-lumpur",
    name: "Kuala Lumpur",
    country: "Malaysia",
    avgPrice: 85,
    avgRating: 4.72,
    avgPhotos: 23,
    marketAngle:
      "Short-term rental demand in Kuala Lumpur is shaped by tourism flows, event calendars, business travel, and neighborhood-level search behavior.",
    competitionAngle:
      "Listings need to stand out through location clarity, strong photos, amenity positioning, review quality, and a clear guest promise.",
    pricingAngle:
      "Pricing should account for local seasonality, nearby comparable listings, booking windows, and the quality signals shown on the listing.",
    guestExpectationAngle:
      "Guests expect transparent location context, reliable amenities, easy check-in information, and photos that accurately represent the stay.",
  },
  {
    slug: "penang",
    name: "Penang",
    country: "Malaysia",
    avgPrice: 75,
    avgRating: 4.72,
    avgPhotos: 23,
    marketAngle:
      "Short-term rental demand in Penang is shaped by tourism flows, event calendars, business travel, and neighborhood-level search behavior.",
    competitionAngle:
      "Listings need to stand out through location clarity, strong photos, amenity positioning, review quality, and a clear guest promise.",
    pricingAngle:
      "Pricing should account for local seasonality, nearby comparable listings, booking windows, and the quality signals shown on the listing.",
    guestExpectationAngle:
      "Guests expect transparent location context, reliable amenities, easy check-in information, and photos that accurately represent the stay.",
  },
  {
    slug: "hanoi",
    name: "Hanoi",
    country: "Vietnam",
    avgPrice: 65,
    avgRating: 4.72,
    avgPhotos: 23,
    marketAngle:
      "Short-term rental demand in Hanoi is shaped by tourism flows, event calendars, business travel, and neighborhood-level search behavior.",
    competitionAngle:
      "Listings need to stand out through location clarity, strong photos, amenity positioning, review quality, and a clear guest promise.",
    pricingAngle:
      "Pricing should account for local seasonality, nearby comparable listings, booking windows, and the quality signals shown on the listing.",
    guestExpectationAngle:
      "Guests expect transparent location context, reliable amenities, easy check-in information, and photos that accurately represent the stay.",
  },
  {
    slug: "ho-chi-minh-city",
    name: "Ho Chi Minh City",
    country: "Vietnam",
    avgPrice: 70,
    avgRating: 4.72,
    avgPhotos: 23,
    marketAngle:
      "Short-term rental demand in Ho Chi Minh City is shaped by tourism flows, event calendars, business travel, and neighborhood-level search behavior.",
    competitionAngle:
      "Listings need to stand out through location clarity, strong photos, amenity positioning, review quality, and a clear guest promise.",
    pricingAngle:
      "Pricing should account for local seasonality, nearby comparable listings, booking windows, and the quality signals shown on the listing.",
    guestExpectationAngle:
      "Guests expect transparent location context, reliable amenities, easy check-in information, and photos that accurately represent the stay.",
  },
  {
    slug: "da-nang",
    name: "Da Nang",
    country: "Vietnam",
    avgPrice: 80,
    avgRating: 4.72,
    avgPhotos: 23,
    marketAngle:
      "Short-term rental demand in Da Nang is shaped by tourism flows, event calendars, business travel, and neighborhood-level search behavior.",
    competitionAngle:
      "Listings need to stand out through location clarity, strong photos, amenity positioning, review quality, and a clear guest promise.",
    pricingAngle:
      "Pricing should account for local seasonality, nearby comparable listings, booking windows, and the quality signals shown on the listing.",
    guestExpectationAngle:
      "Guests expect transparent location context, reliable amenities, easy check-in information, and photos that accurately represent the stay.",
  },
  {
    slug: "manila",
    name: "Manila",
    country: "Philippines",
    avgPrice: 70,
    avgRating: 4.72,
    avgPhotos: 23,
    marketAngle:
      "Short-term rental demand in Manila is shaped by tourism flows, event calendars, business travel, and neighborhood-level search behavior.",
    competitionAngle:
      "Listings need to stand out through location clarity, strong photos, amenity positioning, review quality, and a clear guest promise.",
    pricingAngle:
      "Pricing should account for local seasonality, nearby comparable listings, booking windows, and the quality signals shown on the listing.",
    guestExpectationAngle:
      "Guests expect transparent location context, reliable amenities, easy check-in information, and photos that accurately represent the stay.",
  },
  {
    slug: "cebu",
    name: "Cebu",
    country: "Philippines",
    avgPrice: 75,
    avgRating: 4.72,
    avgPhotos: 23,
    marketAngle:
      "Short-term rental demand in Cebu is shaped by tourism flows, event calendars, business travel, and neighborhood-level search behavior.",
    competitionAngle:
      "Listings need to stand out through location clarity, strong photos, amenity positioning, review quality, and a clear guest promise.",
    pricingAngle:
      "Pricing should account for local seasonality, nearby comparable listings, booking windows, and the quality signals shown on the listing.",
    guestExpectationAngle:
      "Guests expect transparent location context, reliable amenities, easy check-in information, and photos that accurately represent the stay.",
  },
  {
    slug: "hong-kong",
    name: "Hong Kong",
    country: "Hong Kong",
    avgPrice: 175,
    avgRating: 4.68,
    avgPhotos: 27,
    marketAngle:
      "Short-term rental demand in Hong Kong is shaped by tourism flows, event calendars, business travel, and neighborhood-level search behavior.",
    competitionAngle:
      "Listings need to stand out through location clarity, strong photos, amenity positioning, review quality, and a clear guest promise.",
    pricingAngle:
      "Pricing should account for local seasonality, nearby comparable listings, booking windows, and the quality signals shown on the listing.",
    guestExpectationAngle:
      "Guests expect transparent location context, reliable amenities, easy check-in information, and photos that accurately represent the stay.",
  },
  {
    slug: "taipei",
    name: "Taipei",
    country: "Taiwan",
    avgPrice: 110,
    avgRating: 4.72,
    avgPhotos: 23,
    marketAngle:
      "Short-term rental demand in Taipei is shaped by tourism flows, event calendars, business travel, and neighborhood-level search behavior.",
    competitionAngle:
      "Listings need to stand out through location clarity, strong photos, amenity positioning, review quality, and a clear guest promise.",
    pricingAngle:
      "Pricing should account for local seasonality, nearby comparable listings, booking windows, and the quality signals shown on the listing.",
    guestExpectationAngle:
      "Guests expect transparent location context, reliable amenities, easy check-in information, and photos that accurately represent the stay.",
  },
  {
    slug: "osaka",
    name: "Osaka",
    country: "Japan",
    avgPrice: 130,
    avgRating: 4.68,
    avgPhotos: 23,
    marketAngle:
      "Short-term rental demand in Osaka is shaped by tourism flows, event calendars, business travel, and neighborhood-level search behavior.",
    competitionAngle:
      "Listings need to stand out through location clarity, strong photos, amenity positioning, review quality, and a clear guest promise.",
    pricingAngle:
      "Pricing should account for local seasonality, nearby comparable listings, booking windows, and the quality signals shown on the listing.",
    guestExpectationAngle:
      "Guests expect transparent location context, reliable amenities, easy check-in information, and photos that accurately represent the stay.",
  },
  {
    slug: "sapporo",
    name: "Sapporo",
    country: "Japan",
    avgPrice: 115,
    avgRating: 4.72,
    avgPhotos: 23,
    marketAngle:
      "Short-term rental demand in Sapporo is shaped by tourism flows, event calendars, business travel, and neighborhood-level search behavior.",
    competitionAngle:
      "Listings need to stand out through location clarity, strong photos, amenity positioning, review quality, and a clear guest promise.",
    pricingAngle:
      "Pricing should account for local seasonality, nearby comparable listings, booking windows, and the quality signals shown on the listing.",
    guestExpectationAngle:
      "Guests expect transparent location context, reliable amenities, easy check-in information, and photos that accurately represent the stay.",
  },
  {
    slug: "fukuoka",
    name: "Fukuoka",
    country: "Japan",
    avgPrice: 110,
    avgRating: 4.72,
    avgPhotos: 23,
    marketAngle:
      "Short-term rental demand in Fukuoka is shaped by tourism flows, event calendars, business travel, and neighborhood-level search behavior.",
    competitionAngle:
      "Listings need to stand out through location clarity, strong photos, amenity positioning, review quality, and a clear guest promise.",
    pricingAngle:
      "Pricing should account for local seasonality, nearby comparable listings, booking windows, and the quality signals shown on the listing.",
    guestExpectationAngle:
      "Guests expect transparent location context, reliable amenities, easy check-in information, and photos that accurately represent the stay.",
  },
  {
    slug: "auckland",
    name: "Auckland",
    country: "New Zealand",
    avgPrice: 150,
    avgRating: 4.68,
    avgPhotos: 27,
    marketAngle:
      "Short-term rental demand in Auckland is shaped by tourism flows, event calendars, business travel, and neighborhood-level search behavior.",
    competitionAngle:
      "Listings need to stand out through location clarity, strong photos, amenity positioning, review quality, and a clear guest promise.",
    pricingAngle:
      "Pricing should account for local seasonality, nearby comparable listings, booking windows, and the quality signals shown on the listing.",
    guestExpectationAngle:
      "Guests expect transparent location context, reliable amenities, easy check-in information, and photos that accurately represent the stay.",
  },
  {
    slug: "queenstown",
    name: "Queenstown",
    country: "New Zealand",
    avgPrice: 190,
    avgRating: 4.68,
    avgPhotos: 27,
    marketAngle:
      "Short-term rental demand in Queenstown is shaped by tourism flows, event calendars, business travel, and neighborhood-level search behavior.",
    competitionAngle:
      "Listings need to stand out through location clarity, strong photos, amenity positioning, review quality, and a clear guest promise.",
    pricingAngle:
      "Pricing should account for local seasonality, nearby comparable listings, booking windows, and the quality signals shown on the listing.",
    guestExpectationAngle:
      "Guests expect transparent location context, reliable amenities, easy check-in information, and photos that accurately represent the stay.",
  }
];

export function getCityBySlug(slug: string): City | undefined {
  return cities.find((city) => city.slug === slug);
}

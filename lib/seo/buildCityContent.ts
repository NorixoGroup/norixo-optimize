export type CitySeoInput = {
  name: string;
  country: string;
  avgPrice?: number;
  avgRating?: number;
  avgPhotos?: number;
};

export type CitySeoContent = {
  intro: string;
  marketSummary: string;
  optimizationTips: string[];
  exampleAuditIntro: string;
  closingCTA: string;
};

function formatPrice(avgPrice?: number) {
  if (typeof avgPrice !== "number" || Number.isNaN(avgPrice)) return "";
  const rounded = Math.round(avgPrice);
  return `around €${rounded} per night`;
}

function formatRating(avgRating?: number) {
  if (typeof avgRating !== "number" || Number.isNaN(avgRating)) return "";
  return `${avgRating.toFixed(1)} / 5`;
}

function formatPhotos(avgPhotos?: number) {
  if (typeof avgPhotos !== "number" || Number.isNaN(avgPhotos)) return "";
  return `${avgPhotos} photos on average`;
}

export function buildCityContent(city: CitySeoInput): CitySeoContent {
  const { name, country, avgPrice, avgRating, avgPhotos } = city;

  const priceFragment = formatPrice(avgPrice);
  const ratingFragment = formatRating(avgRating);
  const photosFragment = formatPhotos(avgPhotos);

  const intro = `Airbnb listings in ${name}, ${country} compete for attention in a crowded marketplace. Guests scroll quickly, comparing photos, description and price before deciding which places are worth opening in a new tab.`;

  const marketSummaryParts: string[] = [];

  if (priceFragment) {
    marketSummaryParts.push(`Well-positioned listings in ${name} typically charge ${priceFragment}, so your nightly rate needs to feel justified by the experience you promise.`);
  }

  if (ratingFragment) {
    marketSummaryParts.push(`Highly rated stays in ${name} sit around ${ratingFragment}, which means new guests now expect strong reviews and clear trust signals by default.`);
  }

  if (photosFragment) {
    marketSummaryParts.push(`Most hosts use ${photosFragment}, but only a handful of images actually drive clicks — especially the first five that appear in search results.`);
  }

  if (marketSummaryParts.length === 0) {
    marketSummaryParts.push(
      `The local short‑term rental market in ${name} has matured: guests quickly compare similar homes and expect a professional presentation before they commit to a stay.`,
    );
  }

  const marketSummary = marketSummaryParts.join(" ");

  const optimizationTips: string[] = [
    `Lead with your strongest image — choose a cover photo that instantly communicates why staying in ${name} at your place is special (view, light, outdoor space or design).`,
    `Expand the opening lines of your description to clearly explain who the listing is for and why it is a great base for visiting ${name}, rather than relying on generic travel clichés.`,
    `Highlight the amenities guests filter for most often in ${name}, such as fast Wi‑Fi, workspace, climate control and comfortable bedding, so they can quickly confirm that your place fits their needs.`,
    `Align your pricing strategy with similar properties in ${name}: if you sit above the market, your photos and copy must clearly justify the premium; if you are below, emphasize the value guests receive.`,
  ];

  const exampleAuditIntro = `An example audit for a listing in ${name} will show how your photos, copy, amenities and positioning compare to other homes in the area, and where small changes can unlock more bookings.`;

  const closingCTA = `Paste your listing URL and see how it compares to other Airbnb listings in ${name}. You will get a clear conversion score and a prioritized list of improvements.`;

  return {
    intro,
    marketSummary,
    optimizationTips,
    exampleAuditIntro,
    closingCTA,
  };
}

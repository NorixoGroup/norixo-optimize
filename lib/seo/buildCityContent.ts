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

/**
 * Public city copy deliberately does not publish avgPrice, avgRating or avgPhotos.
 * Those legacy fields may still be used by internal/private workflows, but a public
 * numeric market claim should only be rendered when claim-level provenance (source,
 * sample, period, freshness and limitations) is available alongside it.
 */
export function buildCityContent(city: CitySeoInput): CitySeoContent {
  const { name, country } = city;

  const intro = `Airbnb listings in ${name}, ${country} compete for attention in a crowded marketplace. Guests compare photos, description, amenities, location context and price before deciding which places deserve a closer look.`;

  const marketSummary = `The short-term rental market in ${name} should be evaluated through comparable listings rather than an unsupported city-wide average. Price, rating and photo-count benchmarks vary by property type, location, platform, date and sample. Norixo therefore keeps this public summary qualitative unless the supporting evidence is published with the claim.`;

  const optimizationTips: string[] = [
    `Lead with your strongest image — choose a cover photo that immediately explains the space and its strongest differentiator in ${name}.`,
    `Use the opening lines of your description to explain who the listing is for and why its location and setup make sense for a stay in ${name}.`,
    `Check that your amenity list accurately covers the essentials expected for your property type and positioning.`,
    `Compare pricing with genuinely similar properties in ${name} and judge price together with presentation, trust signals and perceived value.`,
  ];

  const exampleAuditIntro = `A listing-specific audit for a property in ${name} reviews photos, copy, amenities, positioning and relevant market context. Public city pages do not reuse a fixed score as if an audit had already been run.`;

  const closingCTA = `Start with your listing and move from general ${name} market context to listing-specific findings and prioritized improvements.`;

  return {
    intro,
    marketSummary,
    optimizationTips,
    exampleAuditIntro,
    closingCTA,
  };
}

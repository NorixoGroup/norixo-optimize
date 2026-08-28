const exactReplacements: Array<[string, string]> = [
  [
    "Airbnb SEO: the complete guide to ranking, clicks, and bookings",
    "Airbnb SEO: the complete guide to relevance, trust, and listing signals",
  ],
  [
    "Airbnb listing optimization: the complete guide to more bookings",
    "Airbnb listing optimization: the complete guide to clearer guest decisions",
  ],
  [
    "Airbnb SEO is not only about adding keywords to a title. It is the full process of making your listing easier to understand, more relevant to guest searches, more trustworthy than nearby competitors, and more likely to convert views into bookings.",
    "Airbnb SEO is not only about adding keywords to a title. It is the process of making a listing easier to understand, more relevant to guest searches, more trustworthy than nearby alternatives, and easier for guests to compare.",
  ],
  [
    "Photos influence click-through rate, perceived value, trust, and conversion. If the first image is weak, guests may never open the listing. If the gallery is incomplete, guests may not feel confident enough to book. A good Airbnb SEO strategy starts with visual clarity because photos shape the first decision.",
    "Photos shape first impressions, perceived value, trust, and how guests compare a listing. A weak first image or incomplete gallery can make the stay harder to understand. A useful Airbnb SEO review therefore includes visual clarity because photos shape an early guest decision.",
  ],
  [
    "Pricing affects guest behavior. A listing that looks expensive compared with similar nearby options may receive fewer clicks and bookings. A listing that looks underpriced but low quality may create doubt. Airbnb SEO requires price alignment with the market, property quality, photos, reviews, and guest expectations.",
    "Pricing is part of the guest comparison context. A listing that looks expensive relative to similar nearby options may appear less competitive, while an unusually low price can create questions when the presentation is weak. Review price together with market context, property quality, photos, reviews, and guest expectations.",
  ],
  [
    "The listing description should help guests make a decision. It should explain the space, sleeping setup, location, amenities, check-in process, house rules, ideal guest type, and what makes the stay valuable. A vague description creates uncertainty, and uncertainty reduces conversion.",
    "The listing description should help guests make a decision. It should explain the space, sleeping setup, location, amenities, check-in process, house rules, ideal guest type, and what makes the stay valuable. A vague description creates uncertainty and avoidable booking friction.",
  ],
  [
    "Better Airbnb SEO can improve visibility, click-through rate, guest confidence, and conversion, which can lead to more bookings when there is market demand.",
    "Airbnb SEO can help a host review relevance, presentation, trust, pricing context, and guest-facing friction. Ranking, clicks, conversion, and bookings still depend on platform, market, listing, and demand factors beyond the guide.",
  ],
  [
    "Airbnb listing optimization is the process of improving a listing's photos, title, description, pricing, amenities, trust signals, and positioning to increase clicks and bookings.",
    "Airbnb listing optimization is the process of reviewing a listing's photos, title, description, pricing, amenities, trust signals, and positioning so the stay is clearer and easier for guests to compare.",
  ],
  [
    "Start with the first photo, gallery, title, pricing, description clarity, amenities, and guest trust signals. These usually have the biggest impact on conversion.",
    "Start with the first photo, gallery, title, pricing, description clarity, amenities, and guest trust signals. These are useful high-priority areas to review because they shape how guests understand and compare the listing.",
  ],
  [
    "Better photos can improve click-through rate, perceived value, trust, and conversion because guests rely heavily on visuals when comparing listings.",
    "Better photos can improve visual clarity, perceived value, and trust because guests rely heavily on visuals when comparing listings. They do not guarantee clicks, conversion, or bookings.",
  ],
  [
    "Yes. A clearer description can reduce uncertainty, answer guest objections, and help guests feel confident enough to book.",
    "A clearer description can reduce uncertainty, answer guest questions, and improve expectation-setting. It does not guarantee a booking outcome.",
  ],
  [
    "Norixo audits your Airbnb listing to identify weak photos, unclear titles, pricing issues, missing amenities, description gaps, trust problems, and market positioning weaknesses. It helps hosts prioritize the improvements that can have the biggest impact.",
    "Norixo audits an Airbnb listing to identify weak photos, unclear titles, pricing issues, missing amenities, description gaps, trust problems, and market-positioning weaknesses. It helps hosts prioritize the issues that appear most important to review first.",
  ],
];

export function makeGuideClaimSafe(value: string): string {
  let output = value;

  for (const [unsafe, safe] of exactReplacements) {
    if (output === unsafe) {
      return safe;
    }
  }

  return output
    .replace(/turn more listing views into bookings/gi, "reduce friction between listing views and booking decisions")
    .replace(/increase clicks and bookings/gi, "improve clarity and competitive positioning")
    .replace(/increase bookings/gi, "support better-informed booking decisions")
    .replace(/increase click-through rate/gi, "improve first-impression clarity")
    .replace(/significantly improve conversion/gi, "reduce conversion friction")
    .replace(/biggest impact/gi, "highest review priority");
}

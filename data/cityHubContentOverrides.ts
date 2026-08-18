export type CityHubContentOverride = {
  heading: string;
  introduction: string;
  priorities: Array<{
    topicSlug: string;
    heading: string;
    body: string;
  }>;
  auditBridge: string;
};

const cityHubContentOverrides: Record<string, CityHubContentOverride> = {
  paris: {
    heading: "How to prioritize a Paris listing diagnosis",
    introduction:
      "For a Paris listing, begin by separating a pricing question from a presentation or trust question. Guests compare many similar apartments across arrondissements, so the useful next step is to identify which part of the listing makes its value easier—or harder—to understand.",
    priorities: [
      {
        topicSlug: "pricing-guide",
        heading: "Check price against the visible offer",
        body:
          "The current Norixo reference price for well-positioned Paris listings is €165 per night. Review price alongside nearby comparable listings, seasonality, and whether the photos, amenities, and location context make that value legible to a guest.",
      },
      {
        topicSlug: "review-strategy",
        heading: "Make trust easy to verify",
        body:
          "Paris listings in the current data average 4.7/5. Inspect whether review reassurance, precise check-in information, and honest neighborhood context remove the uncertainty that can keep an otherwise relevant listing from converting.",
      },
      {
        topicSlug: "booking-conversion",
        heading: "Use the booking path to find the next constraint",
        body:
          "With about 23 photos in the current Paris reference data, test whether the first images and listing framing explain the stay quickly enough for international guests comparing several apartments at once.",
      },
    ],
    auditBridge:
      "Use these three checks to choose the most relevant Paris topic before changing several listing elements at once; a Norixo audit can then help prioritize the evidence behind that choice.",
  },
};

export function getCityHubContentOverride(citySlug: string) {
  return cityHubContentOverrides[citySlug];
}

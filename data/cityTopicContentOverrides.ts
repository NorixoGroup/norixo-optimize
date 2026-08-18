export type CityTopicContentOverride = {
  heading: string;
  introduction: string;
  sections: Array<{
    heading: string;
    body: string;
  }>;
  auditBridge: string;
};

const cityTopicContentOverrides: Record<
  string,
  Record<string, CityTopicContentOverride>
> = {
  sapporo: {
    "occupancy-guide": {
      heading: "A practical occupancy diagnostic for a Sapporo listing",
      introduction:
        "Occupancy is most useful as a diagnostic signal, not a target to chase in isolation. For a Sapporo listing, start by identifying whether the main constraint is the offer guests see, the value it communicates, or the booking path after they open the listing.",
      sections: [
        {
          heading: "Start with the listing guests can compare",
          body:
            "Sapporo demand is shaped by tourism flows, event calendars, business travel, and neighborhood-level search behavior. Check that the listing makes its location context, amenities, check-in process, and the stay itself easy to understand before treating price as the only explanation for weak occupancy.",
        },
        {
          heading: "Read price alongside the value signal",
          body:
            "The local reference price in the current Norixo data is around €115 per night. Use that as context for reviewing the price against nearby comparable listings, booking windows, seasonality, and the quality signals visible on the page—not as a target rate or an occupancy forecast.",
        },
        {
          heading: "Test trust and presentation before discounting",
          body:
            "Sapporo listings in the current data average 4.72/5 and about 23 photos. A host should check whether the first images, review reassurance, and amenity positioning make the listing feel competitive at its chosen price before using a discount to compensate for unclear value.",
        },
      ],
      auditBridge:
        "Once those checks identify a likely weak point, a Norixo audit can help turn the comparison into a prioritized listing diagnosis rather than changing price, photos, and copy all at once.",
    },
  },
};

export function getCityTopicContentOverride(citySlug: string, topicSlug: string) {
  return cityTopicContentOverrides[citySlug]?.[topicSlug];
}

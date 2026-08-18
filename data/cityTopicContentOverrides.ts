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
  marrakech: {
    "revenue-optimization": {
      heading: "Diagnose a Marrakech revenue gap before changing the nightly rate",
      introduction:
        "Revenue is not a price setting in isolation. In Marrakech, a listing can underperform because its rate does not match the experience guests can verify, because it is missing available booking demand, or because guests do not see enough value and reassurance to choose it once they compare options.",
      sections: [
        {
          heading: "First, test whether the price matches the visible offer",
          body:
            "The current Norixo reference price for Marrakech is around €105 per night, but that is context rather than a target. The market ranges from budget riads to higher-end stays with pools, so compare the chosen rate with the amenities, photos, access details, and stay experience a guest can actually see before treating price as the problem.",
        },
        {
          heading: "Separate a demand-capture problem from a pricing problem",
          body:
            "A lower rate does not fix every revenue gap. If the listing is not capturing the bookings that are available for its dates, first check whether the listing is easy to understand and fits the trip a guest is planning. Medina access, transfer clarity, and climate-comfort details can affect whether an international guest considers the stay at all.",
        },
        {
          heading: "Check conversion before discounting",
          body:
            "Guests in Marrakech may be comparing old-town atmosphere with modern comfort. When the gallery, amenities, location context, or reassurance do not make that promise clear, guests can view a listing without choosing it. Review presentation and trust signals before using a discount to compensate for unclear perceived value.",
        },
        {
          heading: "Choose the trade-off deliberately",
          body:
            "More occupied nights do not automatically mean stronger revenue. A price reduction can increase booking frequency while weakening the return from each stay; holding a higher rate can also fail if the listing does not make its value credible. Diagnose rate, booking capture, and conversion in that order so one change tests one likely constraint.",
        },
      ],
      auditBridge:
        "Use the revenue calculator to compare the consequence of a rate or booking-performance change, then use the revenue and pricing resources to investigate the likely constraint. A Norixo listing audit can turn that comparison into a focused next action rather than changing price, photos, and copy together.",
    },
  },
};

export function getCityTopicContentOverride(citySlug: string, topicSlug: string) {
  return cityTopicContentOverrides[citySlug]?.[topicSlug];
}

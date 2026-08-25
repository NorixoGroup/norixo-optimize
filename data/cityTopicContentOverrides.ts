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
  helsinki: {
    "title-optimization": {
      heading: "Diagnose what a Helsinki listing title needs to communicate first",
      introduction:
        "A title is a compact comparison signal, not a place to describe everything about a stay. In Helsinki, listings compete on location quality, presentation, amenities, reviews, and fit with guest intent, so begin by identifying the strongest truthful reason a traveler should understand the listing quickly.",
      sections: [
        {
          heading: "Choose one decision signal the listing can support",
          body:
            "Start with the most concrete strength a guest can verify: the location context, a relevant amenity, the way the stay fits a trip, or a clear presentation advantage. Avoid generic adjectives when the photos, amenities, and actual stay cannot demonstrate the promise. Specificity helps the right traveler recognize relevance without overstating the offer.",
        },
        {
          heading: "Make the title useful at comparison speed",
          body:
            "When guests compare Helsinki alternatives, the title should make the listing easier to place in a few words. Put the clearest truthful distinction forward, use plain language, and avoid trying to include every feature or repeated keyword. The aim is not to chase clicks indiscriminately, but to help a suitable guest understand why the listing merits a closer look.",
        },
        {
          heading: "Match the title promise to the visible listing",
          body:
            "A title works only when the rest of the listing confirms it. Check that the first photos, amenities, description, rules, and price context support the same expectation. The current Helsinki reference price of about €120 per night is context rather than a target: at any rate, a title should not promise a level of value the visible listing does not make credible.",
        },
        {
          heading: "Separate a title problem from a broader listing problem",
          body:
            "Repeated title rewrites will not resolve weak presentation, unclear amenities, missing reassurance, or a poor match with guest intent. Helsinki guests still need transparent location details, reliable amenities, strong photos, and reasons to trust the stay after the click. Use the title to set the first accurate expectation; use the description to explain the stay and reduce uncertainty once a guest is reading further.",
        },
      ],
      auditBridge:
        "After identifying whether the constraint is an unclear title promise, weak differentiation, a mismatch with the listing, or broader presentation and trust, a Norixo audit can help prioritize the next change without rewriting every part of the listing at once.",
    },
  },
  guadalajara: {
    "guest-trust-guide": {
      heading: "Diagnose what a Guadalajara listing needs to make guests trust it",
      introduction:
        "Trust is not a claim a listing can make for itself; it is the confidence a guest can build from what is clear and consistent before booking. In Guadalajara, start by checking whether the location context, arrival expectations, amenities, photos, and listing promise make the stay easy to assess without asking a guest to fill in the gaps.",
      sections: [
        {
          heading: "Make the arrival and stay expectations easy to verify",
          body:
            "Use the listing to make location context and easy check-in information clear enough for a guest to understand what the stay involves. If those basics are vague, a guest may hesitate even when the rest of the offer looks relevant. The goal is not to add more claims, but to remove uncertainty about what the guest can expect.",
        },
        {
          heading: "Check whether listed amenities are visibly convincing",
          body:
            "Reliable amenities help only when a guest can see how they fit the stay. Review whether the photos and supporting details make the important amenities understandable rather than leaving them as a bare list. With the current Norixo reference of about 23 photos in Guadalajara, use the gallery as evidence of the promise, not as a substitute for clarity.",
        },
        {
          heading: "Look for a gap between the visible promise and the likely stay",
          body:
            "Guests compare review quality, presentation, and the consistency of the listing details before they decide whether a stay feels dependable. The current Norixo reference rating is 4.72/5, which is context rather than a threshold. Check whether the photos, amenities, arrival information, and written description tell the same accurate story instead of creating a reason to doubt it.",
        },
        {
          heading: "Decide whether trust is really the constraint",
          body:
            "A trust review should not become a catch-all explanation for weak performance. If the listing is clear and credible but still feels less competitive, the constraint may instead be presentation, price/value, or fit with the guest's trip. The current Guadalajara reference price of about €80 per night can provide context for that comparison, but it is not a target rate or proof that price is the problem.",
        },
      ],
      auditBridge:
        "Once the likely constraint is clearer—arrival expectations, amenity proof, a mismatch in the visible promise, or a broader value and presentation issue—a Norixo audit can help prioritize one next action instead of changing the entire listing at once.",
    },
  },
  bali: {
    "photo-tips": {
      heading: "Diagnose which Bali listing photos need to prove the stay first",
      introduction:
        "Bali guests may be comparing rice-field quiet, beach-town access, and design-led villa stays before they know the details of any one property. A useful photo review starts by deciding which truthful version of the stay the listing needs to make clear, then checking whether the gallery provides enough evidence for that promise.",
      sections: [
        {
          heading: "Choose the stay context the gallery can genuinely prove",
          body:
            "Do not ask one set of images to imply every type of Bali trip. Identify the most relevant supported context—such as the setting, the design of the stay, or the way guests will use the space—and make sure the first images help a guest recognize that fit. The cover image should clarify the experience, not substitute a vague sense of luxury for it.",
        },
        {
          heading: "Use photos as evidence, not decoration",
          body:
            "With about 26 photos in the current Norixo reference data, the question is not simply whether the gallery is long enough. Check whether it visibly supports the amenities, layout, and value the listing presents. A private pool, for example, should be represented accurately if it is central to the promise; the same principle applies to every feature a guest needs to judge before booking.",
        },
        {
          heading: "Make practical expectations visible before guests have to ask",
          body:
            "Photos and their surrounding listing details should not leave guests guessing about climate context, insects, transport options, or distance to a beach or hub when those factors affect the stay. The aim is not to turn the gallery into a travel guide, but to make the visible offer consistent with the practical experience a guest can reasonably expect.",
        },
        {
          heading: "Separate a photo problem from a broader value problem",
          body:
            "A stronger gallery cannot compensate for an unclear amenity list, a price that the visible offer does not justify, or a mismatch with the trip a guest is planning. Before replacing images repeatedly, check whether the real constraint is the evidence in the photos, the promise in the listing, or the fit between the stay and the guest's intent. That distinction keeps photo changes focused and credible.",
        },
      ],
      auditBridge:
        "Once the likely gap is clear—uncertain stay context, weak visual evidence, missing practical expectations, or a broader value issue—a Norixo audit can help prioritize the next listing change without treating every photo as the problem.",
    },
  },
  singapore: {
    "competitor-analysis": {
      heading: "Compare Singapore listing alternatives without copying the wrong signal",
      introduction:
        "Competitor analysis is useful only when it compares the alternatives a guest could genuinely see as similar. In Singapore, listings compete on location, photos, amenities, and perceived trust, so begin by separating meaningful differences in the offer from superficial differences in a search result.",
      sections: [
        {
          heading: "Build a comparable set before judging a gap",
          body:
            "Start with listings that appear comparable in the experience they offer, not simply listings with a similar nightly price. Compare location context, visible presentation, amenities, review context, and the clarity of the guest promise. If two listings serve different needs or present different levels of proof, their prices alone do not show which one is better positioned.",
        },
        {
          heading: "Separate structural differences from fixable listing gaps",
          body:
            "Some differences are part of the stay itself; others are differences in how clearly the stay is presented. A competitor may look stronger because its photos explain the space, its amenities are easier to verify, or its listing makes the guest fit obvious. Review those visible signals before assuming that an unchangeable feature is the reason guests would choose another option.",
        },
        {
          heading: "Read price alongside the evidence of value",
          body:
            "The current Norixo reference price for Singapore is around €185 per night, but it is context rather than a target or market rule. A lower-priced alternative may be less comparable, while a higher-priced one may make its value more legible through presentation, amenities, or trust signals. Ask whether the visible offer supports the price before reacting to a single rate.",
        },
        {
          heading: "Act only on a pattern you can test",
          body:
            "Use competitor observations to identify one testable listing gap, not a reason to copy every nearby choice. At the current Norixo reference of about 24 photos and 4.65/5 in Singapore, check whether the listing gives guests enough clear evidence to compare confidently. If the observed gap is presentation or reassurance, address that first; if the offers are not truly comparable, do not treat the comparison as a pricing instruction.",
        },
      ],
      auditBridge:
        "Once a comparison identifies a credible and testable gap, a Norixo audit can help distinguish a fixable listing signal from a structural difference before several changes are made at once.",
    },
  },
};

export function getCityTopicContentOverride(citySlug: string, topicSlug: string) {
  return cityTopicContentOverrides[citySlug]?.[topicSlug];
}

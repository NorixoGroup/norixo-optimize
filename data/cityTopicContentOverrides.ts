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
    "occupancy-guide": {
      heading: "Diagnose Marrakech occupancy through guest fit, value, and conversion",
      introduction:
        "Occupancy in Marrakech should be treated as a diagnostic outcome rather than a target to maximize by itself. Medina riads, resort-style stays, and excursion-led trips create different guest journeys, so first determine whether the listing is attracting the right demand, communicating the stay clearly, and converting interest at a credible price.",
      sections: [
        {
          heading: "Clarify which Marrakech stay the listing actually offers",
          body:
            "Guests may be comparing old-town atmosphere, modern comfort, pools, resort-style amenities, or a base for planned excursions. Make that positioning visible early through the gallery, location context, amenities, and description. When the type of stay is unclear, a listing can struggle to capture suitable bookings even when the nightly rate looks competitive.",
        },
        {
          heading: "Check whether comfort and access expectations are reducing confidence",
          body:
            "International guests may care about climate comfort, transfer clarity, and how easy the property is to reach from or within the medina. Review whether those practical expectations are explained accurately. Uncertainty around access or comfort can create booking friction that a discount will not necessarily solve.",
        },
        {
          heading: "Read price alongside the experience guests can verify",
          body:
            "The current Norixo reference price for Marrakech is around €105 per night. Use it as context rather than a target. The market spans budget riads through higher-end stays with pools, so compare the chosen rate with the visible amenities, photos, arrival information, and stay experience before concluding that price is limiting occupancy.",
        },
        {
          heading: "Protect revenue while testing an occupancy hypothesis",
          body:
            "If the listing already communicates its stay type, practical expectations, and value clearly, test one pricing or availability change at a time. More occupied nights are not automatically better when they require unnecessary discounting. The aim is to identify whether demand fit, conversion, or price is the real constraint.",
        },
      ],
      auditBridge:
        "A Norixo audit can help separate a Marrakech occupancy question into guest fit, practical expectations, visible value, and pricing so the next change addresses one likely constraint instead of simply reducing the rate.",
    },

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
    "occupancy-guide": {
      heading: "Diagnose Bali occupancy by matching the listing to the trip guests are choosing",
      introduction:
        "Occupancy in Bali depends on more than filling available nights. Villa weeks, surf and wellness trips, and multi-stop itineraries can create different booking patterns, so begin by checking whether the listing makes its setting, length-of-stay fit, practical expectations, and value clear enough for the guests it is trying to attract.",
      sections: [
        {
          heading: "Make the stay context obvious before comparing occupancy",
          body:
            "Guests may be deciding between rice-field quiet, beach-town access, and design-led villa stays. The first images and listing framing should make that context easy to recognize. If the page does not clearly signal what kind of Bali stay it offers, weak booking capture may reflect guest-fit confusion rather than a pure pricing problem.",
        },
        {
          heading: "Remove practical uncertainty that can block a booking",
          body:
            "Private-pool accuracy, insect and climate expectations, scooter or driver context, and honest distance to a beach or local hub can materially affect how a guest evaluates the stay. Make these points clear enough that a suitable guest can decide confidently instead of discovering an important trade-off after opening the listing.",
        },
        {
          heading: "Use rate and gallery quality together",
          body:
            "The current Norixo reference price for Bali is around €85 per night, with about 26 photos and an average rating near 4.8/5. These are context, not targets. Check whether the gallery and amenity evidence make the chosen rate credible for the exact version of the Bali stay the listing promises.",
        },
        {
          heading: "Do not use discounts to compensate for a mismatched promise",
          body:
            "If the listing attracts the wrong guest intent or does not prove its amenities clearly, lowering price may create more attention without resolving the booking hesitation. Strengthen the visible promise first; if guest fit and presentation are already strong, test a focused pricing or availability change and observe the response.",
        },
      ],
      auditBridge:
        "Use a Norixo audit to determine whether a Bali occupancy gap is more likely tied to trip fit, practical expectations, visible proof, or price before changing several parts of the listing together.",
    },

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
  "mexico-city": {
    "pricing-guide": {
      heading: "Diagnose a Mexico City pricing gap before changing the nightly rate",
      introduction:
        "Pricing is only useful when it reflects the offer a guest can actually compare. For a Mexico City listing, start by checking whether the current rate makes sense alongside the visible location context, amenities, photos, reviews, and booking conditions before assuming that price alone is limiting performance.",
      sections: [
        {
          heading: "Compare the rate with the visible offer first",
          body:
            "Use the current Norixo reference price of about €95 per night only as context, not as a target or a claim about the whole Mexico City market. Compare the chosen rate with nearby listings that appear genuinely similar in location context, stay type, amenities, presentation, and guest reassurance. A price comparison is more useful when the alternatives are comparable in what a guest can actually verify.",
        },
        {
          heading: "Separate a price problem from a value problem",
          body:
            "A listing can look expensive because the rate is high, but it can also look expensive because the visible offer does not explain its value clearly enough. Before discounting, review whether the first photos, amenity positioning, location explanation, check-in expectations, and overall listing promise make the stay easy to understand. If those signals are weak, a lower price may hide the presentation problem instead of solving it.",
        },
        {
          heading: "Use booking windows and comparable listings as diagnostic inputs",
          body:
            "Pricing decisions should account for how far ahead guests are booking and how comparable alternatives are positioned, but those signals should be treated as inputs rather than fixed rules. Avoid assuming a seasonal pattern or demand level without evidence. The useful question is whether the current rate remains credible for the dates, visible quality, and alternatives a guest is likely to compare at that moment.",
        },
        {
          heading: "Change one pricing variable at a time",
          body:
            "If the listing appears competitive and the value is clear, test a focused pricing adjustment instead of changing the rate, photos, title, and description together. A single-variable change makes it easier to judge whether price was actually the constraint. If performance remains weak, reassess the visible offer and guest fit before continuing to reduce the nightly rate.",
        },
      ],
      auditBridge:
        "Use the pricing calculator and related pricing resources to test the consequence of a focused rate change, then use a Norixo listing audit to check whether pricing is the real constraint or whether presentation, trust, or perceived value should be addressed first.",
    },
  },


  madrid: {
    "guest-trust-guide": {
      heading: "Diagnose what a Madrid listing needs to make the stay easier to trust",
      introduction:
        "Guest trust is built from consistency rather than reassurance language alone. For a Madrid listing, review whether the arrival details, location context, amenities, photos, reviews, and written promise give a guest enough evidence to understand the stay without having to resolve important uncertainty before booking.",
      sections: [
        {
          heading: "Start with the expectations that affect the stay",
          body:
            "Madrid demand includes leisure stays, work trips, events, and neighborhood-specific searches. Check whether the listing explains the practical details that help those guests decide: where the stay fits, how arrival works, which amenities can be relied on, and whether the photos accurately support the written description. Trust weakens when important expectations are left implicit.",
        },
        {
          heading: "Use reviews and presentation as supporting evidence",
          body:
            "The current Norixo reference rating for Madrid is about 4.7/5. Treat that as market context rather than a threshold. A rating alone does not make a listing persuasive if the gallery, amenity information, rules, or arrival instructions create uncertainty. Review whether those elements reinforce the same credible version of the stay.",
        },
        {
          heading: "Check whether price changes the level of proof guests expect",
          body:
            "The current Norixo reference price for Madrid is around €135 per night. This is not a target rate. Use it only as context when asking whether the visible quality, amenities, location explanation, and guest reassurance make the chosen price understandable. A pricing change should not be used to hide a trust or presentation problem.",
        },
        {
          heading: "Separate a trust gap from a guest-fit problem",
          body:
            "A clear and credible listing can still underperform if it is not framed for the trip a guest is planning. If arrival, amenities, photos, and expectations are already easy to verify, investigate whether the listing promise, price position, or guest fit is the more likely constraint instead of adding more reassurance language.",
        },
      ],
      auditBridge:
        "Once the likely gap is identified—unclear expectations, weak supporting evidence, price/value tension, or guest fit—a Norixo audit can help prioritize the next change without rewriting the entire listing at once.",
    },
  },

  auckland: {
    "pricing-positioning": {
      heading: "Position an Auckland listing price against the value guests can actually see",
      introduction:
        "Pricing positioning is not about matching one market average. For an Auckland listing, the useful question is whether the chosen rate, visible quality, amenities, location context, and booking conditions create a coherent value position when a guest compares nearby alternatives.",
      sections: [
        {
          heading: "Define the comparison before judging the price",
          body:
            "Auckland demand is shaped by tourism flows, event calendars, business travel, and neighborhood-level search behavior. Compare the listing with alternatives that appear relevant to the same type of trip rather than treating every nearby nightly rate as equivalent. Location context, amenities, presentation, and guest reassurance all affect whether two prices are meaningfully comparable.",
        },
        {
          heading: "Use the reference rate as context, not a target",
          body:
            "The current Norixo reference price for Auckland is around €150 per night. It is a diagnostic reference, not a recommended rate or forecast. Review whether the listing's photos, amenity positioning, review quality, and practical information make its chosen price credible relative to the offer a guest can verify.",
        },
        {
          heading: "Look for a value-communication problem before discounting",
          body:
            "If the listing appears expensive, determine whether the rate itself is the problem or whether the visible offer does not explain its value clearly enough. Weak photo sequencing, unclear amenities, vague location context, or missing arrival information can make a reasonable price feel harder to justify.",
        },
        {
          heading: "Change one pricing assumption at a time",
          body:
            "When the visible offer is coherent, test pricing deliberately rather than changing price, photos, copy, and amenities together. A focused change makes it easier to learn whether price positioning was actually limiting performance or whether the listing needs a different presentation or guest-fit adjustment.",
        },
      ],
      auditBridge:
        "Use the Auckland comparison to identify whether the likely constraint is rate, visible value, comparison quality, or guest fit; a Norixo audit can then help prioritize a focused next action.",
    },
  },

  bucharest: {
    "occupancy-guide": {
      heading: "Diagnose a Bucharest occupancy gap before trying to fill more nights",
      introduction:
        "Occupancy is an outcome, not a diagnosis. For a Bucharest listing, first determine whether weaker booking capture is more likely connected to demand fit, price/value, listing presentation, or guest confidence before treating a higher occupied-night count as the objective by itself.",
      sections: [
        {
          heading: "Check whether the listing fits the demand it can realistically capture",
          body:
            "Bucharest demand is influenced by tourism, local events, business travel, and seasonal booking patterns. Review whether the listing makes its location, amenities, stay type, and practical advantages clear enough for the guest segment it is most likely to serve.",
        },
        {
          heading: "Read occupancy together with price and perceived value",
          body:
            "The current Norixo reference price for Bucharest is around €70 per night. Use it as context rather than a target. Lowering the rate may increase booking interest, but it does not resolve weak presentation or unclear value. Compare price with the photos, amenities, reviews, and location information guests can actually assess.",
        },
        {
          heading: "Test presentation and trust before assuming demand is missing",
          body:
            "The current Norixo data references about 23 photos and a 4.72/5 average rating for Bucharest listings. Those figures do not guarantee performance. Use them as prompts to check whether the gallery is complete enough, the listing builds confidence quickly, and the written promise matches what guests can verify.",
        },
        {
          heading: "Protect revenue while investigating occupancy",
          body:
            "More occupied nights are not automatically better if they require unnecessary discounting. If the listing is clear and competitive, test one availability or pricing hypothesis at a time. If it is not, strengthen the visible offer before using price to compensate for a conversion problem.",
        },
      ],
      auditBridge:
        "A Norixo audit can help separate a Bucharest occupancy question into demand fit, price/value, presentation, and trust so the next test addresses one likely constraint instead of chasing occupancy alone.",
    },
  },

  copenhagen: {
    "occupancy-guide": {
      heading: "Diagnose Copenhagen occupancy through demand fit, value, and conversion",
      introduction:
        "A Copenhagen occupancy problem can come from several different constraints that should not be treated as one. Review whether guests can find the right fit, understand the value, trust the stay, and justify the price before assuming that the solution is simply to reduce the nightly rate.",
      sections: [
        {
          heading: "Start with the trip the listing is positioned to serve",
          body:
            "Copenhagen demand is influenced by tourism, local events, business travel, and seasonal booking patterns. Check whether the listing makes its location context, practical amenities, arrival expectations, and intended guest fit easy to understand for the stays it is trying to capture.",
        },
        {
          heading: "Compare the rate with the visible quality of the offer",
          body:
            "The current Norixo reference price for Copenhagen is around €155 per night. Treat that as comparison context rather than a target. Ask whether the gallery, amenities, reviews, location explanation, and overall presentation make the chosen price understandable next to comparable alternatives.",
        },
        {
          heading: "Look for conversion friction before increasing discounts",
          body:
            "A listing may receive interest without converting if important information remains unclear. Review whether photos provide enough evidence of the stay, amenities are easy to verify, and the listing removes practical uncertainty instead of expecting the guest to infer the experience.",
        },
        {
          heading: "Use occupancy as feedback, not as the only objective",
          body:
            "If the listing is already credible and clearly positioned, a focused rate or availability test may be useful. If the value is not yet obvious, filling more nights through discounts can hide the underlying issue. Protect the relationship between occupied nights and nightly value while diagnosing the constraint.",
        },
      ],
      auditBridge:
        "Use these checks to decide whether Copenhagen occupancy is primarily a demand-fit, value, conversion, or pricing question; a Norixo audit can then prioritize the most defensible next change.",
    },
  },

  "kuala-lumpur": {
    "occupancy-guide": {
      heading: "Diagnose Kuala Lumpur occupancy before treating price as the default lever",
      introduction:
        "Occupancy becomes useful when it helps identify where booking capture is breaking down. For a Kuala Lumpur listing, review demand fit, comparison quality, presentation, guest confidence, and price together before assuming that a lower rate is the fastest route to better performance.",
      sections: [
        {
          heading: "Match the listing to the demand it is trying to capture",
          body:
            "Kuala Lumpur demand is shaped by tourism flows, event calendars, business travel, and neighborhood-level search behavior. Check whether the listing explains the location context, relevant amenities, check-in expectations, and stay experience clearly enough for guests comparing different trip types.",
        },
        {
          heading: "Use price as one signal inside the value comparison",
          body:
            "The current Norixo reference price for Kuala Lumpur is around €85 per night. It is context rather than a recommended rate. Compare the chosen price with nearby alternatives only after checking whether the visible offer, amenities, gallery, and guest reassurance make those alternatives genuinely comparable.",
        },
        {
          heading: "Check whether the listing proves its value quickly enough",
          body:
            "The current Norixo reference data shows about 23 photos and a 4.72/5 average rating. Those figures should not be treated as targets. Instead, inspect whether the first images, amenity evidence, location explanation, and review context help a guest understand the value without needing to resolve basic questions first.",
        },
        {
          heading: "Avoid buying occupancy with unnecessary discounting",
          body:
            "If presentation and guest fit are weak, a lower price can increase attention without fixing the reason guests hesitate. Strengthen the visible offer first. If those signals are already strong, test one pricing or availability change at a time so the result provides useful evidence.",
        },
      ],
      auditBridge:
        "A Norixo audit can help determine whether Kuala Lumpur occupancy is being constrained by demand fit, visible value, trust, or price and turn that diagnosis into one prioritized experiment.",
    },
  },

  boston: {
    "occupancy-guide": {
      heading: "Diagnose a Boston occupancy problem without reducing it to nightly rate",
      introduction:
        "Occupancy reflects whether available nights turn into bookings, but it does not explain why. For a Boston listing, separate guest fit, price/value, presentation, and trust before making a rate change that could improve booked nights while weakening the value captured from each stay.",
      sections: [
        {
          heading: "Check whether the listing speaks to the trip guests are planning",
          body:
            "Boston demand includes leisure stays, work trips, events, and neighborhood-specific searches. Review whether location context, amenities, arrival information, and the listing promise help the right guest understand quickly how the stay fits their trip.",
        },
        {
          heading: "Compare price with the evidence of value",
          body:
            "The current Norixo reference price for Boston is around €175 per night. Use that only as diagnostic context. A guest judges price alongside photos, amenities, location clarity, reviews, rules, and the overall credibility of the stay, so the rate should not be assessed separately from those signals.",
        },
        {
          heading: "Use trust and gallery quality to test conversion friction",
          body:
            "The current Norixo reference data shows about 24 photos and an average rating near 4.7/5. These are not performance thresholds. Check whether the gallery provides enough useful evidence, whether expectations are consistent across the listing, and whether practical uncertainties could be reducing booking confidence.",
        },
        {
          heading: "Decide whether occupancy or revenue is actually the priority",
          body:
            "Increasing occupied nights can be useful, but not when unnecessary discounting weakens total revenue or attracts demand that does not fit the stay. Once presentation and guest fit are credible, test a focused price or availability adjustment and observe whether the booking response changes.",
        },
      ],
      auditBridge:
        "Use the Boston occupancy diagnosis to identify the most likely constraint before changing several variables; a Norixo audit can help prioritize whether the next action belongs to pricing, presentation, trust, or guest fit.",
    },
  },


  istanbul: {
    "occupancy-guide": {
      heading: "Diagnose Istanbul occupancy through district fit, access, and perceived value",
      introduction:
        "Occupancy in Istanbul can be influenced by how well a listing fits the district experience a guest expects. Old-city charm, newer districts, Bosphorus views, walkability, and transfer convenience can lead guests to compare very different stays, so identify whether the listing's positioning, access information, and value are clear before treating rate as the default explanation.",
      sections: [
        {
          heading: "Define the district experience the guest is comparing",
          body:
            "A listing in Istanbul should make its location context useful rather than relying on the city name alone. Guests may compare historic-area character with newer districts and different levels of walkability or transfer convenience. Explain the stay accurately enough that the right guest can understand where it fits among those alternatives.",
        },
        {
          heading: "Make building and arrival expectations visible",
          body:
            "Lift or stair access, older-building context, and smooth arrival instructions can affect booking confidence. If those details matter to the stay, surface them clearly rather than leaving the guest to infer them. Reducing practical uncertainty can improve the quality of booking interest without changing the nightly rate.",
        },
        {
          heading: "Compare price with district and view positioning",
          body:
            "The current Norixo reference price for Istanbul is around €88 per night. Treat it as context rather than a target. Value tiers can differ by district and view, so judge the chosen rate alongside location context, presentation, amenities, and what the gallery actually proves.",
        },
        {
          heading: "Separate occupancy pressure from a positioning mismatch",
          body:
            "If the listing is credible but framed for the wrong comparison set, discounting may not fix the problem. First check district fit, access expectations, visible quality, and guest reassurance. Once those signals are coherent, test one pricing or availability adjustment at a time.",
        },
      ],
      auditBridge:
        "A Norixo audit can help distinguish whether Istanbul occupancy is constrained by district fit, access expectations, visible value, or pricing and turn that diagnosis into one focused next action.",
    },
  },


  paris: {
    "occupancy-guide": {
      heading: "Diagnose Paris occupancy without treating price as the only lever",
      introduction:
        "Occupancy in Paris should be read alongside neighborhood fit, presentation, guest confidence, and price positioning. Guests compare many similar apartments across arrondissements, so a listing can lose bookings because its value is harder to understand even when the nightly rate itself is not the main problem.",
      sections: [
        {
          heading: "Make the arrondissement and stay context useful to the guest",
          body:
            "Paris guests often compare several apartments quickly. Explain the neighborhood context honestly and make the practical fit of the stay easy to understand rather than relying on broad claims such as central or convenient. Clear positioning helps the right guest decide whether the listing belongs in their shortlist.",
        },
        {
          heading: "Use arrival clarity and photos to remove uncertainty",
          body:
            "International guests benefit from precise check-in information and photos that accurately match the space. Review whether the first images, access expectations, amenities, and written description reinforce the same version of the stay. In a dense comparison market, small inconsistencies can weaken booking confidence.",
        },
        {
          heading: "Read the nightly rate together with visible differentiation",
          body:
            "The current Norixo reference price for Paris is around €165 per night. This is context rather than a target. Compare the chosen rate with genuinely similar alternatives and ask whether the listing's photos, amenities, neighborhood explanation, and review reassurance make its value clear enough.",
        },
        {
          heading: "Test occupancy only after the value proposition is coherent",
          body:
            "If the listing already presents a clear neighborhood fit and credible stay experience, a focused pricing or availability test may be useful. If not, discounting can mask a presentation or trust problem. Change one variable at a time so the booking response gives interpretable evidence.",
        },
      ],
      auditBridge:
        "A Norixo audit can help determine whether a Paris occupancy gap is primarily a neighborhood-fit, presentation, trust, or pricing issue before several listing elements are changed together.",
    },
  },


  barcelona: {
    "occupancy-guide": {
      heading: "Diagnose Barcelona occupancy through seasonality, location fit, and guest expectations",
      introduction:
        "Barcelona occupancy can reflect a mix of seasonal demand, neighborhood choice, and how clearly the listing explains the stay. Coastal leisure and city culture lead guests to compare different location trade-offs, so first identify whether the listing makes its positioning, comfort, and value easy to understand before changing price.",
      sections: [
        {
          heading: "Clarify the location trade-off guests are actually choosing",
          body:
            "Beach proximity and calmer inner-city options can belong to different competitive sets. Make the listing's location context explicit enough that guests understand the trade-off they are accepting. A vague position can reduce booking capture even when the property itself is attractive.",
        },
        {
          heading: "Surface comfort and noise expectations early",
          body:
            "Outdoor space, cooling, and noise context can matter when guests shortlist Barcelona stays. If these factors are relevant, make them easy to assess through photos and written details. Clear expectations help suitable guests move forward and reduce hesitation caused by missing practical information.",
        },
        {
          heading: "Interpret price in the context of seasonality and presentation",
          body:
            "The current Norixo reference price for Barcelona is around €150 per night. Use it as context rather than a target. Weekends and peak periods can move the market, but the chosen rate still needs to be supported by the gallery, amenities, location fit, and visible quality of the stay.",
        },
        {
          heading: "Avoid solving a conversion issue with rate alone",
          body:
            "If the listing does not clearly communicate location trade-offs or practical comfort, a discount may increase attention without improving the underlying fit. Strengthen those signals first; once they are credible, test a focused pricing or availability change to see whether occupancy responds.",
        },
      ],
      auditBridge:
        "A Norixo audit can help separate Barcelona occupancy into location fit, seasonal pricing context, practical guest expectations, and conversion so the next test addresses the strongest likely constraint.",
    },
  },


  london: {
    "occupancy-guide": {
      heading: "Diagnose London occupancy through transport fit, stay clarity, and value",
      introduction:
        "Occupancy in London can depend on whether a listing clearly fits the trip a guest is planning. Corporate midweeks, weekend visitors, and longer bleisure stays may compare different Tube zones, boroughs, room types, and price bands, so review guest fit and visible value before assuming that the rate is the main constraint.",
      sections: [
        {
          heading: "Use transport and borough context to define the comparison set",
          body:
            "London listings can compete along the same transport corridors while offering very different neighborhood experiences. Give guests precise location context rather than leaning on vague central claims. The clearer the transport and borough fit, the easier it is for the right guest to compare the stay fairly.",
        },
        {
          heading: "Make practical stay expectations credible",
          body:
            "Reliable Wi-Fi, clear house rules, and honest room sizing can be especially important for work trips, longer stays, and shared-home bookings. Check whether these expectations are supported by the photos and description so guests do not need to resolve basic uncertainty before booking.",
        },
        {
          heading: "Compare price with the exact offer, not London as a whole",
          body:
            "The current Norixo reference price for London is around €190 per night. Treat it as context rather than a target. Premium and budget-friendly pockets can sit close together, so compare the listing with alternatives that are genuinely similar in transport access, room type, amenities, presentation, and guest reassurance.",
        },
        {
          heading: "Test occupancy after the guest fit is clear",
          body:
            "If the listing already communicates transport access, room expectations, amenities, and value accurately, test one pricing or availability change at a time. If those signals remain vague, discounting may attract attention without resolving why suitable guests hesitate.",
        },
      ],
      auditBridge:
        "A Norixo audit can help identify whether London occupancy is constrained by transport fit, stay expectations, visible value, or price and prioritize one defensible change rather than adjusting the whole listing at once.",
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

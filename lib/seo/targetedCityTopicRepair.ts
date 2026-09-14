import type { City } from "@/data/cities";
import type { LocalSeoTopic } from "@/data/localSeo";

const TARGETED_CITY_TOPIC_REPAIR_PATHS = new Set([
  "/airbnb-optimizer/aix-en-provence/long-stay-guide",
  "/airbnb-optimizer/athens/business-travel-guide",
  "/airbnb-optimizer/budapest/revenue-optimization",
  "/airbnb-optimizer/chicago/business-travel-guide",
  "/airbnb-optimizer/chicago/market-analysis",
  "/airbnb-optimizer/dublin/pricing-positioning",
  "/airbnb-optimizer/istanbul/pricing-positioning",
  "/airbnb-optimizer/kuala-lumpur/local-demand-guide",
  "/airbnb-optimizer/lagos-portugal/guest-trust-guide",
  "/airbnb-optimizer/lagos-portugal/revenue-optimization",
  "/airbnb-optimizer/madrid/business-travel-guide",
  "/airbnb-optimizer/melbourne/business-travel-guide",
  "/airbnb-optimizer/melbourne/seasonality-guide",
  "/airbnb-optimizer/mexico-city/business-travel-guide",
  "/airbnb-optimizer/mexico-city/guest-trust-guide",
  "/airbnb-optimizer/nice/occupancy-guide",
  "/airbnb-optimizer/philadelphia/business-travel-guide",
  "/airbnb-optimizer/queenstown/revenue-optimization",
  "/airbnb-optimizer/queenstown/review-strategy",
  "/airbnb-optimizer/san-francisco/seasonality-guide",
  "/airbnb-optimizer/seoul/review-strategy",
  "/airbnb-optimizer/vancouver/occupancy-guide",
  "/airbnb-optimizer/zaragoza/local-demand-guide",
]);

export type TargetedCityTopicRepairSection = {
  heading: string;
  body: string;
};

export type TargetedCityTopicRepairContent = {
  heading: string;
  introduction: string;
  sections: [
    TargetedCityTopicRepairSection,
    TargetedCityTopicRepairSection,
    TargetedCityTopicRepairSection,
  ];
  actionBridge: string;
};

type TopicRepairBuilder = (
  city: Pick<City, "name" | "country">,
) => TargetedCityTopicRepairContent;

const TARGETED_TOPIC_REPAIR_BUILDERS: Record<string, TopicRepairBuilder> = {
  "business-travel-guide": (city) => ({
    heading: `Evaluate business-travel readiness in ${city.name}`,
    introduction:
      `Use ${city.name}, ${city.country}, only as the location context. Assess whether the listing clearly supports a work-focused stay from evidence visible in the listing rather than assuming how local business travelers behave.`,
    sections: [
      {
        heading: "Check work-stay essentials",
        body:
          "Verify whether the listing clearly explains workspace suitability, Wi-Fi or connectivity information, check-in practicalities, access details and the amenities a guest may need while working from the property.",
      },
      {
        heading: "Test practical trip clarity",
        body:
          "Review whether arrival, house rules, sleeping arrangements, workspace details and access information are precise enough for a guest planning a structured work trip to judge the stay without guessing.",
      },
      {
        heading: "Compare equivalent stay propositions",
        body:
          "When comparing available listings, use similar property type, capacity, location context and work-stay proposition. Compare what each listing actually communicates rather than inferring local traveler preferences.",
      },
    ],
    actionBridge:
      "Prioritize the clearest missing work-stay signal, improve that element, then measure changes in listing engagement or booking outcomes before combining several changes.",
  }),

  "revenue-optimization": (city) => ({
    heading: `Diagnose revenue performance in ${city.name}`,
    introduction:
      `Treat ${city.name}, ${city.country}, as the location context, but diagnose revenue from the listing's own rate, availability, presentation and conversion evidence. Do not assume a city revenue benchmark without a validated source.`,
    sections: [
      {
        heading: "Separate rate from conversion",
        body:
          "Review whether weak revenue could come from price, limited availability, low visibility, unclear value, weak presentation or booking friction instead of treating nightly rate as the only lever.",
      },
      {
        heading: "Check value communication",
        body:
          "Assess whether the title, photos, amenities, description and stay conditions make the offered value understandable at the price shown. A pricing decision should be interpreted together with the guest-facing proposition.",
      },
      {
        heading: "Measure revenue changes cleanly",
        body:
          "Change one major variable at a time where possible, record the date and monitor listing-level outcomes such as views, inquiries, bookings, booked nights or realized revenue when those first-party signals are available.",
      },
    ],
    actionBridge:
      "Use the listing's own evidence to identify whether rate, availability, visibility or conversion is the most plausible constraint before changing multiple revenue levers together.",
  }),

  "guest-trust-guide": (city) => ({
    heading: `Audit guest trust signals in ${city.name}`,
    introduction:
      `Use ${city.name}, ${city.country}, as location context while evaluating trust from what the guest can actually verify in the listing. Avoid treating an unsupported local rating benchmark as evidence.`,
    sections: [
      {
        heading: "Remove avoidable uncertainty",
        body:
          "Check whether photos, room descriptions, amenities, sleeping arrangements, rules, fees and access information agree with each other and leave as little room as possible for conflicting interpretations.",
      },
      {
        heading: "Review reassurance signals",
        body:
          "Inspect how clearly the listing explains arrival, property condition, host expectations and practical stay details. Trust improves when important information is specific, consistent and easy to find.",
      },
      {
        heading: "Use review evidence carefully",
        body:
          "Classify recurring comments from the listing's own reviews when available and distinguish isolated preferences from repeated issues that point to a real expectation or operational gap.",
      },
    ],
    actionBridge:
      "Fix the highest-confidence source of guest uncertainty first, then watch whether questions, complaints, review themes or booking conversion change after the correction.",
  }),

  "local-demand-guide": (city) => ({
    heading: `Evaluate demand signals for ${city.name}`,
    introduction:
      `Do not infer the composition or strength of demand in ${city.name}, ${city.country}, from generic city text alone. Use first-party booking, search and calendar evidence or separately validated public data when it is available.`,
    sections: [
      {
        heading: "Start with observed listing signals",
        body:
          "Review the property's own booking dates, inquiry patterns, search visibility, lead times and availability history when those signals are available. Separate observed evidence from assumptions about the wider city.",
      },
      {
        heading: "Segment only when evidence supports it",
        body:
          "Look for repeated patterns in stay length, party size, booking window or guest questions before describing a demand segment. Do not invent a dominant traveler type from the city name alone.",
      },
      {
        heading: "Validate external comparisons",
        body:
          "When using public or third-party market evidence, confirm the geography, property type, date range and methodology are comparable before applying the signal to this listing.",
      },
    ],
    actionBridge:
      "Use the strongest observed demand signal to form one listing hypothesis, test the corresponding positioning or availability change and reassess with new evidence.",
  }),

  "occupancy-guide": (city) => ({
    heading: `Diagnose occupancy constraints in ${city.name}`,
    introduction:
      `Treat ${city.name}, ${city.country}, as the location context. Diagnose occupancy from availability, visibility, price and conversion evidence without asserting an unsupported city occupancy rate or seasonal pattern.`,
    sections: [
      {
        heading: "Check whether nights were actually sellable",
        body:
          "Review blocked dates, minimum stays, booking windows, stay restrictions and operational availability before interpreting unbooked nights as a demand or conversion problem.",
      },
      {
        heading: "Separate visibility from conversion",
        body:
          "If first-party data is available, distinguish whether the listing is receiving too little exposure or receiving attention without enough bookings. The corrective action differs between a discovery problem and a conversion problem.",
      },
      {
        heading: "Test price as a hypothesis",
        body:
          "When comparing available listings, use similar property type, capacity, location context and stay conditions. Treat price as one possible constraint rather than assuming it explains occupancy by itself.",
      },
    ],
    actionBridge:
      "Identify whether availability, visibility, conversion or pricing is the best-supported occupancy hypothesis, change one major factor and measure the next comparable period.",
  }),

  "pricing-positioning": (city) => ({
    heading: `Evaluate pricing position in ${city.name}`,
    introduction:
      `Use ${city.name}, ${city.country}, as location context without relying on an unsupported average nightly price. Evaluate position by comparing the listing with genuinely similar available stay propositions.`,
    sections: [
      {
        heading: "Build a like-for-like comparison set",
        body:
          "Compare similar property type, guest capacity, location context, stay conditions, major amenities and presentation quality before drawing conclusions from another listing's displayed price.",
      },
      {
        heading: "Compare price with perceived value",
        body:
          "Review whether photos, title, amenities, rules, cancellation terms and property details justify the listing's relative price position from the guest's point of view.",
      },
      {
        heading: "Account for date-specific conditions",
        body:
          "Compare prices for equivalent stay dates and booking conditions when possible. A displayed rate without matching dates or restrictions is weak evidence for a pricing decision.",
      },
    ],
    actionBridge:
      "Adjust positioning only after identifying a clear mismatch between price and the communicated stay proposition, then measure the effect on listing-level booking signals.",
  }),

  "review-strategy": (city) => ({
    heading: `Build a review improvement strategy in ${city.name}`,
    introduction:
      `Use ${city.name}, ${city.country}, only as location context. Base the review strategy on the listing's own guest feedback rather than an unsupported local average rating.`,
    sections: [
      {
        heading: "Classify recurring feedback",
        body:
          "Group review comments into recurring themes such as cleanliness, accuracy, arrival, communication, comfort, noise, amenities or value, and distinguish repeated issues from isolated preferences.",
      },
      {
        heading: "Trace feedback to a root cause",
        body:
          "For each repeated negative theme, determine whether the cause is operational, physical or informational. A listing-copy fix cannot solve an operational problem, and an operational fix should also be reflected accurately in the listing.",
      },
      {
        heading: "Close the expectation gap",
        body:
          "Compare what the listing promises with what reviews say guests experienced. Correct contradictions, missing context and unclear expectations before trying to improve review outcomes through messaging alone.",
      },
    ],
    actionBridge:
      "Prioritize the most repeated and actionable review theme, correct its root cause and monitor subsequent reviews for evidence that the issue is declining.",
  }),

  "seasonality-guide": (city) => ({
    heading: `Evaluate seasonal patterns in ${city.name}`,
    introduction:
      `Do not assert a seasonal pattern for ${city.name}, ${city.country}, without evidence. Use the property's own booking, search, pricing and availability history or validated external data tied to explicit dates.`,
    sections: [
      {
        heading: "Compare equivalent date windows",
        body:
          "Review comparable weeks or months using the same listing where possible, while accounting for changes in availability, minimum stays, pricing and listing presentation that could distort the comparison.",
      },
      {
        heading: "Separate seasonality from operations",
        body:
          "Check whether blocked dates, altered stay rules, changed pricing or temporary listing issues could explain a performance shift before attributing it to seasonal demand.",
      },
      {
        heading: "Use external events cautiously",
        body:
          "Only incorporate event or calendar effects when the date, location and source are verifiable. Avoid turning a plausible local event story into an assumed recurring demand pattern.",
      },
    ],
    actionBridge:
      "Form a seasonal hypothesis only from dated evidence, test the corresponding pricing, availability or positioning change and compare it with a genuinely comparable period.",
  }),

  "long-stay-guide": (city) => ({
    heading: `Evaluate long-stay readiness in ${city.name}`,
    introduction:
      `Use ${city.name}, ${city.country}, as location context without assuming a specific level of local long-stay demand. Evaluate whether the property and listing clearly support a longer booking.`,
    sections: [
      {
        heading: "Check practical long-stay suitability",
        body:
          "Review workspace, storage, laundry, kitchen facilities, connectivity information, sleeping comfort and other amenities that become more important as the stay length increases.",
      },
      {
        heading: "Clarify rules and living conditions",
        body:
          "Make longer-stay expectations explicit, including access, utilities where relevant, cleaning arrangements, house rules and any limitations that a guest should understand before committing.",
      },
      {
        heading: "Test the economics at listing level",
        body:
          "Evaluate discounts and minimum-stay rules against the property's own costs, availability goals and booking evidence rather than assuming a city-wide long-stay discount or demand benchmark.",
      },
    ],
    actionBridge:
      "Fix the strongest mismatch between the long-stay proposition and the actual property experience, then measure whether longer inquiries or bookings improve.",
  }),

  "market-analysis": (city) => ({
    heading: `Build a defensible market analysis for ${city.name}`,
    introduction:
      `Use ${city.name}, ${city.country}, to define the geographic context, but do not treat legacy city copy or unverified numbers as market evidence. Separate listing observations from validated external market data.`,
    sections: [
      {
        heading: "Define the comparison set first",
        body:
          "Specify property type, capacity, location context, stay proposition and relevant dates before comparing listings. A market comparison is only useful when the compared supply is meaningfully similar.",
      },
      {
        heading: "Separate evidence categories",
        body:
          "Keep listing-level evidence, first-party performance data and externally sourced market data distinct. Record what each signal actually measures instead of combining them into an unsupported market conclusion.",
      },
      {
        heading: "Look for decision-relevant gaps",
        body:
          "Use the comparison set to identify differences in pricing position, presentation, amenities, rules, availability or value communication that can be verified directly and translated into a listing-level hypothesis.",
      },
    ],
    actionBridge:
      "Turn the strongest verified market difference into one testable listing decision, then reassess it with comparable evidence rather than treating the first comparison as a permanent benchmark.",
  }),
};

export function isTargetedCityTopicRepairPath(
  path: string,
): boolean {
  return TARGETED_CITY_TOPIC_REPAIR_PATHS.has(path);
}

export function getTargetedCityTopicRepairPaths(): string[] {
  return [...TARGETED_CITY_TOPIC_REPAIR_PATHS];
}

export function getTargetedCityTopicRepairContent(
  city: City,
  topic: LocalSeoTopic,
): TargetedCityTopicRepairContent | null {
  const path = `/airbnb-optimizer/${city.slug}/${topic.slug}`;

  if (!TARGETED_CITY_TOPIC_REPAIR_PATHS.has(path)) {
    return null;
  }

  const builder = TARGETED_TOPIC_REPAIR_BUILDERS[topic.slug];

  if (!builder) {
    throw new Error(
      `Missing targeted city-topic repair content for topic: ${topic.slug}`,
    );
  }

  return builder({
    name: city.name,
    country: city.country,
  });
}

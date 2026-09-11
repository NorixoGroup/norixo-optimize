import type { City } from "@/data/cities";
import type { LocalSeoTopic } from "@/data/localSeo";

const COHORT_25_CITIES = [
  "paris",
  "barcelona",
  "marrakech",
  "dubai",
  "new-york",
] as const;

const COHORT_25_TOPICS = [
  "title-optimization",
  "description-optimization",
  "photo-tips",
  "guest-trust-guide",
  "listing-audit",
] as const;

const COHORT_25_CITY_TOPIC_PATHS = new Set(
  COHORT_25_CITIES.flatMap((city) =>
    COHORT_25_TOPICS.map(
      (topic) => `/airbnb-optimizer/${city}/${topic}`,
    ),
  ),
);

export type Cohort25CityTopicRepairSection = {
  heading: string;
  body: string;
};

export type Cohort25CityTopicRepairContent = {
  heading: string;
  introduction: string;
  sections: [
    Cohort25CityTopicRepairSection,
    Cohort25CityTopicRepairSection,
    Cohort25CityTopicRepairSection,
  ];
  actionBridge: string;
};

type Cohort25TopicBuilder = (
  city: Pick<City, "name" | "country">,
) => Cohort25CityTopicRepairContent;

const COHORT_25_TOPIC_BUILDERS: Record<string, Cohort25TopicBuilder> = {
  "title-optimization": (city) => ({
    heading: `Audit title clarity for a listing in ${city.name}`,
    introduction:
      `Use ${city.name}, ${city.country}, as location context, but judge the title from the stay the listing can actually prove. The goal is to make the first promise clearer without inventing local demand, guest preferences or performance claims.`,
    sections: [
      {
        heading: "Identify the primary stay promise",
        body:
          "Check whether the title communicates one useful reason to inspect the listing further, such as property type, a verifiable feature or a clear stay proposition. Remove wording that sounds attractive but cannot be confirmed elsewhere in the listing.",
      },
      {
        heading: "Test title-to-listing consistency",
        body:
          "Compare every important title claim with the photos, amenities, description and property details. A stronger title should reduce ambiguity rather than create expectations that the rest of the listing cannot support.",
      },
      {
        heading: "Improve differentiation without speculation",
        body:
          "Prefer specific, verifiable characteristics of the property over generic superlatives or assumptions about what guests in the city want. Keep the wording readable and focused on evidence visible to the guest.",
      },
    ],
    actionBridge:
      "Rewrite the weakest title element first, keep the underlying stay proposition unchanged and compare listing-level engagement after the change when reliable first-party signals are available.",
  }),

  "description-optimization": (city) => ({
    heading: `Audit description clarity for a listing in ${city.name}`,
    introduction:
      `Treat ${city.name}, ${city.country}, as location context while evaluating the description from information the listing can substantiate. Improve clarity and decision support without turning generic city assumptions into local market facts.`,
    sections: [
      {
        heading: "Lead with the actual stay proposition",
        body:
          "Check whether the opening explains what the property is, who it can accommodate and which verifiable characteristics matter most. Avoid spending the strongest opening space on generic destination language.",
      },
      {
        heading: "Remove information gaps",
        body:
          "Review sleeping arrangements, amenities, access, rules, practical limitations and other decision-critical details. Important information should be precise enough that a guest does not need to infer what the property provides.",
      },
      {
        heading: "Keep promises consistent",
        body:
          "Compare the description with the title, photos, amenities and house information. Correct contradictions, vague claims and duplicated filler so that each section helps the guest understand the stay more accurately.",
      },
    ],
    actionBridge:
      "Prioritize the description gap most likely to create uncertainty, correct it, then review guest questions or listing-level conversion evidence before making several additional changes together.",
  }),

  "photo-tips": (city) => ({
    heading: `Audit visual proof for a listing in ${city.name}`,
    introduction:
      `Use ${city.name}, ${city.country}, only as location context. Evaluate the photo set from what it proves about this property rather than relying on an unsupported local photo-count benchmark or assumptions about city-wide guest behavior.`,
    sections: [
      {
        heading: "Make the first images informative",
        body:
          "Check whether the opening images quickly establish the property type, strongest verifiable feature and overall stay proposition. The first sequence should help a guest understand the listing rather than repeat similar views.",
      },
      {
        heading: "Prove the complete stay",
        body:
          "Verify that important rooms, sleeping spaces, bathrooms, useful amenities, access features and any material limitations are represented clearly where photographs can reasonably show them.",
      },
      {
        heading: "Match photos with written claims",
        body:
          "Compare visual evidence with the title, description and amenities. Remove or clarify claims that the photo set does not support, and order images so the guest can build an accurate mental model of the property.",
      },
    ],
    actionBridge:
      "Fix the largest visual information gap first, then assess whether guest questions, listing engagement or booking outcomes change before treating photo quantity itself as the problem.",
  }),

  "guest-trust-guide": (city) => ({
    heading: `Audit guest confidence signals in ${city.name}`,
    introduction:
      `Use ${city.name}, ${city.country}, as location context while judging trust from information a guest can verify in the listing and, when available, the listing's own review evidence. Do not infer a local rating benchmark or city-wide guest expectation.`,
    sections: [
      {
        heading: "Remove contradictions",
        body:
          "Check whether the title, photos, description, amenities, sleeping arrangements, rules and fees tell the same story. Conflicting information creates uncertainty even when each individual section looks complete.",
      },
      {
        heading: "Clarify practical expectations",
        body:
          "Review arrival, access, property conditions, important rules and material limitations. Put decision-critical information where a guest can find it before booking instead of relying on assumptions or later explanations.",
      },
      {
        heading: "Use review evidence at listing level",
        body:
          "When reviews are available, group repeated comments by theme and distinguish recurring issues from isolated preferences. Use that evidence to identify expectation gaps without generalizing the findings to the whole city.",
      },
    ],
    actionBridge:
      "Correct the highest-confidence source of uncertainty first and monitor subsequent guest questions, review themes or booking outcomes for evidence that the trust gap is shrinking.",
  }),

  "listing-audit": (city) => ({
    heading: `Run a listing-level audit in ${city.name}`,
    introduction:
      `Treat ${city.name}, ${city.country}, as the geographic context, not as evidence of a specific market benchmark. Audit the listing from its own presentation, availability and performance signals, and keep externally validated market data separate when it exists.`,
    sections: [
      {
        heading: "Check the guest-facing proposition",
        body:
          "Review the title, first photos, description, amenities, capacity, rules and stay conditions as one proposition. Identify contradictions or missing information that could make the property harder to understand or compare.",
      },
      {
        heading: "Separate possible constraints",
        body:
          "Distinguish visibility, presentation, pricing, availability and conversion hypotheses instead of treating every weak outcome as the same problem. Use first-party listing evidence where available to decide which constraint is best supported.",
      },
      {
        heading: "Prioritize one defensible action",
        body:
          "Rank findings by evidence strength and likely decision impact. Prefer a change tied to a clearly observed listing problem over a broad optimization based on an unsupported city average or generic market assumption.",
      },
    ],
    actionBridge:
      "Implement the highest-confidence listing improvement first, record the change and reassess comparable first-party signals before combining several interventions.",
  }),
};

export function isCohort25CityTopicRepairPath(path: string): boolean {
  return COHORT_25_CITY_TOPIC_PATHS.has(path);
}

export function getCohort25CityTopicRepairPaths(): string[] {
  return [...COHORT_25_CITY_TOPIC_PATHS];
}

export function getCohort25CityTopicRepairContent(
  city: City,
  topic: LocalSeoTopic,
): Cohort25CityTopicRepairContent | null {
  const path = `/airbnb-optimizer/${city.slug}/${topic.slug}`;

  if (!COHORT_25_CITY_TOPIC_PATHS.has(path)) {
    return null;
  }

  const builder = COHORT_25_TOPIC_BUILDERS[topic.slug];

  if (!builder) {
    throw new Error(
      `Missing cohort-25 city-topic repair content for topic: ${topic.slug}`,
    );
  }

  return builder({
    name: city.name,
    country: city.country,
  });
}

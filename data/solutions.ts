export type Solution = {
  slug: string;
  title: string;
  description: string;
  heroTitle: string;
  heroSubtitle: string;
  intro: string;
  cta: string;

  sections?: {
    title: string;
    body: string;
  }[];

  faq?: {
    question: string;
    answer: string;
  }[];
};

export const solutions: Solution[] = [
  {
    slug: "airbnb-seo",
    title: "Airbnb SEO",
    description:
      "Review Airbnb visibility signals, listing relevance, content clarity and market positioning.",
    heroTitle: "Airbnb SEO",
    heroSubtitle:
      "Strengthen listing relevance, clarity and trust without relying on ranking guarantees.",
    intro:
      "Norixo analyzes listing and market signals that can affect how clearly an Airbnb is understood and positioned, then helps hosts identify practical optimization opportunities.",
    cta: "Start a free audit",

    sections: [
      {
        title: "How Airbnb SEO works",
        body: "Airbnb visibility can reflect many signals, including listing relevance, pricing, guest behavior, reviews, photos, amenities and booking activity. Norixo focuses on the listing elements hosts can review without claiming control over Airbnb's ranking system."
      },
      {
        title: "Optimize titles",
        body: "Titles should communicate the property's value and strongest differentiators clearly within the space Airbnb provides."
      },
      {
        title: "Improve photos",
        body: "Clear, well-ordered photos can make the listing easier to understand and strengthen the first impression before guests read the full description."
      },
      {
        title: "Strengthen descriptions",
        body: "Descriptions should answer relevant guest questions, reduce uncertainty and explain what makes the stay a good fit."
      },
      {
        title: "Price strategically",
        body: "Pricing should be reviewed alongside market demand, competitor positioning and perceived value rather than relying on fixed rules."
      },
      {
        title: "Increase trust",
        body: "Reviews, cleanliness, communication and accurate information can reduce avoidable booking hesitation."
      },
      {
        title: "Measure performance",
        body: "Regular reviews help hosts identify which listing elements deserve attention and compare changes over time."
      },
      {
        title: "Use Norixo",
        body: "Norixo analyzes pricing context, competition, photos, positioning and conversion friction in a structured audit."
      }
    ],

    faq: [
      {
        question: "What is Airbnb SEO?",
        answer: "Airbnb SEO is the practice of improving listing relevance, clarity and positioning for guests searching on Airbnb. Airbnb controls its ranking system, so no optimization tool can guarantee a ranking outcome."
      },
      {
        question: "Does Airbnb SEO guarantee more bookings?",
        answer: "No. Better listing clarity, positioning and trust can support guest decision-making, but rankings and bookings depend on many factors outside an optimization tool's control."
      },
      {
        question: "How does Norixo help?",
        answer: "Norixo audits pricing context, photos, descriptions, positioning and market competition to identify optimization opportunities and potential friction."
      }
    ],
  },
  {
    slug: "airbnb-listing-optimization",
    title: "Airbnb Listing Optimization",
    description:
      "Analyze and improve Airbnb titles, descriptions, photos, amenities, pricing, trust signals and competitive positioning.",
    heroTitle: "Airbnb Listing Optimization",
    heroSubtitle:
      "See which parts of your listing create friction, how you compare with the market, and what to improve first.",
    intro:
      "Norixo turns listing and market signals into a structured optimization review instead of a generic checklist. It examines the elements guests compare before booking and organizes the findings into clear priorities.",
    cta: "Analyze my listing",

    sections: [
      {
        title: "Listing structure",
        body: "Norixo reviews the listing as a complete booking page: title, description, photos, amenities, pricing context, trust signals and positioning are assessed together rather than in isolation."
      },
      {
        title: "Photo presentation",
        body: "The audit reviews gallery quality and presentation signals, including whether the strongest visual proof appears early enough to support the listing's promise."
      },
      {
        title: "Title and positioning",
        body: "Titles are reviewed for clarity, relevance and differentiation so the listing's main value proposition is understandable quickly."
      },
      {
        title: "Description and objections",
        body: "Descriptions are checked for clarity, missing decision information and avoidable uncertainty that can weaken guest confidence before booking."
      },
      {
        title: "Amenities and trust",
        body: "Norixo looks for missing or weakly presented amenities and trust signals that can make comparable listings easier to choose."
      },
      {
        title: "Pricing context",
        body: "Pricing is interpreted together with perceived listing quality and local market context instead of being judged as a standalone number."
      },
      {
        title: "Competitive positioning",
        body: "The audit compares how the listing is positioned against relevant market alternatives so hosts can see where their presentation is stronger, weaker or unclear."
      },
      {
        title: "Prioritized actions",
        body: "Norixo returns structured findings and an ordered set of improvement priorities so hosts can focus on the most important issues first."
      }
    ],

    faq: [
      {
        question: "What is Airbnb listing optimization?",
        answer: "It is the process of improving the listing elements guests compare before booking, including photos, title, description, amenities, pricing context, trust and positioning."
      },
      {
        question: "What does Norixo analyze?",
        answer: "Norixo reviews listing content, photos, amenities, pricing context, guest trust signals, market positioning and conversion friction, then organizes the findings into priorities."
      },
      {
        question: "Does Norixo automatically edit my Airbnb listing?",
        answer: "No. Norixo analyzes the listing and provides recommendations; the host remains in control of any changes."
      }
    ],
  },
  {
    slug: "airbnb-pricing-optimization",
    title: "Airbnb Pricing Optimization",
    description:
      "Review pricing decisions using competition, positioning and market context.",
    heroTitle: "Airbnb Pricing Optimization",
    heroSubtitle:
      "Review your price position with better market context.",
    intro:
      "Pricing decisions should consider market demand, guest expectations, property characteristics and perceived value.",
    cta: "Audit pricing",

    sections: [
      {
        title: "Local market pricing signals",
        body: "Airbnb pricing can be reviewed against nearby competitors, property type, seasonality, location strength, amenities and perceived value."
      },
      {
        title: "Competitor price comparison",
        body: "Norixo helps hosts compare their listing against relevant market alternatives instead of guessing or copying unrelated listings."
      },
      {
        title: "Price and perceived value",
        body: "Guests do not judge price alone. They can compare price with photos, reviews, amenities, description quality, location and trust signals."
      },
      {
        title: "Seasonality and demand",
        body: "Pricing reviews should account for weekends, events, seasonal periods, holidays and changes in booking pace where reliable market evidence is available."
      },
      {
        title: "Occupancy and revenue balance",
        body: "Occupancy and nightly rate should be considered together because optimizing one metric in isolation can distort the broader revenue picture."
      },
      {
        title: "Identify pricing friction",
        body: "If a listing appears weaker than comparable alternatives at a similar price, that mismatch may create additional booking friction."
      },
      {
        title: "Review under-positioning",
        body: "A listing may also be positioned below relevant alternatives. Norixo helps hosts review whether the price is consistent with the listing's presentation, amenities and market context."
      },
      {
        title: "Pricing recommendations",
        body: "Norixo connects pricing context with listing quality so hosts can decide whether presentation, price position or both deserve review."
      }
    ],

    faq: [
      {
        question: "What is Airbnb pricing optimization?",
        answer: "Airbnb pricing optimization is the process of reviewing nightly rates alongside demand, competition, seasonality, listing quality and guest expectations."
      },
      {
        question: "Should I always lower my Airbnb price?",
        answer: "No. Price should be reviewed together with listing quality, positioning, amenities, seasonality and relevant market alternatives."
      },
      {
        question: "How does Norixo help with Airbnb pricing?",
        answer: "Norixo compares price with available market context, listing quality and competitor positioning to identify pricing questions, opportunities and risks to review."
      }
    ],
  },
  {
    slug: "airbnb-listing-audit",
    title: "Airbnb Listing Audit",
    description:
      "Audit Airbnb listing content, photos, amenities, pricing context, trust signals, competition and conversion blockers in one structured review.",
    heroTitle: "Airbnb Listing Audit",
    heroSubtitle:
      "Diagnose what is clear, what creates friction, how the listing compares with the market, and what to review first.",
    intro:
      "Norixo combines listing-level signals with market context to produce a structured audit. The goal is to identify concrete strengths, weaknesses and decision friction without pretending to guarantee ranking or bookings.",
    cta: "Run an audit",

    sections: [
      {
        title: "What the audit covers",
        body: "The audit reviews title, description, photos, amenities, pricing context, trust signals, competitive positioning and conversion friction as connected parts of the same listing."
      },
      {
        title: "Pricing and market context",
        body: "Norixo compares the listing's pricing context with available market evidence and considers whether the presentation supports the position being asked of guests."
      },
      {
        title: "Photo analysis",
        body: "The gallery is reviewed for presentation quality, sequencing and whether the first images provide enough visual proof of the property's main selling points."
      },
      {
        title: "Title and description review",
        body: "Norixo checks whether the title and description communicate the property clearly, surface meaningful differentiators and answer important guest questions."
      },
      {
        title: "Amenities and guest trust",
        body: "The audit identifies missing, unclear or weakly presented amenities and trust signals that may create avoidable hesitation."
      },
      {
        title: "Competitive positioning",
        body: "Relevant alternatives provide context for how the listing is presented, where it appears weaker or stronger, and which differences guests can actually notice."
      },
      {
        title: "Scores and findings",
        body: "Norixo organizes the analysis into structured findings and category-level signals so the host can understand where attention is needed instead of receiving an unranked list of tips."
      },
      {
        title: "Prioritized recommendations",
        body: "The final report orders recommended actions by importance and explains what each recommendation is intended to clarify or improve."
      }
    ],

    faq: [
      {
        question: "What is an Airbnb listing audit?",
        answer: "An Airbnb listing audit is a structured review of the listing elements that shape guest understanding and booking confidence, including content, photos, amenities, pricing context, trust and competitive positioning."
      },
      {
        question: "What does Norixo return after an audit?",
        answer: "Norixo returns structured findings, category-level signals and prioritized recommendations covering the main listing and market factors reviewed."
      },
      {
        question: "Does a Norixo audit guarantee more bookings or a higher ranking?",
        answer: "No. The audit identifies evidence-based improvement opportunities and priorities, but it does not guarantee marketplace ranking, bookings or revenue."
      }
    ],
  },
  {
    slug: "airbnb-revenue-optimization",
    title: "Airbnb Revenue Optimization",
    description:
      "Review revenue opportunities through pricing, positioning, occupancy and conversion context.",
    heroTitle: "Airbnb Revenue Optimization",
    heroSubtitle:
      "Understand the listing and market factors connected to revenue performance.",
    intro:
      "Revenue reflects multiple factors, including occupancy, nightly rate, seasonality, guest demand, listing presentation and market positioning.",
    cta: "Review revenue",

    sections: [
      {
        title: "Revenue drivers",
        body: "Revenue should be reviewed through connected measures such as occupancy, ADR, booking pace and conversion context rather than a single metric."
      },
      {
        title: "Pricing strategy",
        body: "Pricing decisions can support or weaken revenue performance depending on demand, positioning and listing quality."
      },
      {
        title: "Occupancy balance",
        body: "Higher occupancy is not automatically better if the price position or operating economics are weakened."
      },
      {
        title: "Market positioning",
        body: "Comparing perceived value with relevant alternatives can help hosts understand whether the listing's position is coherent."
      },
      {
        title: "Seasonality",
        body: "Demand patterns can change over time, so revenue reviews should consider seasonality and available market evidence."
      },
      {
        title: "Guest confidence",
        body: "Trust and listing clarity can influence booking decisions, alongside price, availability and other marketplace factors."
      },
      {
        title: "Performance tracking",
        body: "Track revenue and supporting metrics over time before attributing a change to any single optimization."
      },
      {
        title: "Optimization cycle",
        body: "Review, change selectively, measure and compare before drawing conclusions about impact."
      }
    ],

    faq: [
      {
        question: "What factors influence Airbnb revenue?",
        answer: "Revenue can reflect nightly rate, occupancy, seasonality, demand, listing quality, availability, market positioning and other operational factors."
      },
      {
        question: "Should I lower prices to improve revenue?",
        answer: "Not necessarily. Price should be reviewed alongside occupancy, demand, listing quality, positioning and operating economics."
      },
      {
        question: "How does Norixo help with revenue optimization?",
        answer: "Norixo identifies pricing, positioning, listing-quality and conversion signals that hosts can review when assessing revenue opportunities."
      }
    ],
  },
  {
    slug: "airbnb-conversion-optimization",
    title: "Airbnb Conversion Optimization",
    description:
      "Identify listing friction that can affect how guests move from viewing a listing to considering a booking.",
    heroTitle: "Airbnb Conversion Optimization",
    heroSubtitle:
      "Reduce avoidable friction and strengthen booking confidence.",
    intro:
      "Listing changes can reduce uncertainty and improve clarity, but conversion depends on many factors beyond content alone.",
    cta: "Review conversion",

    sections: [
      {
        title: "Conversion basics",
        body: "Conversion describes the relationship between listing traffic and completed bookings, but platforms may define and expose these metrics differently."
      },
      {
        title: "First impressions",
        body: "Photos, titles and pricing shape the information guests see when they first evaluate a listing."
      },
      {
        title: "Guest trust",
        body: "Reviews, accurate information and clear expectations can reduce avoidable uncertainty."
      },
      {
        title: "Listing clarity",
        body: "Complete, relevant information can make the listing easier to evaluate before a guest decides whether to book."
      },
      {
        title: "Amenities",
        body: "Amenities contribute to perceived fit and value when guests compare alternatives."
      },
      {
        title: "Competitive positioning",
        body: "Clear differentiation helps guests understand how the listing compares with relevant alternatives."
      },
      {
        title: "Booking friction",
        body: "Norixo looks for uncertainty, missing information and presentation issues that may make the booking decision harder."
      },
      {
        title: "Continuous testing",
        body: "When possible, change selectively and compare performance over time rather than assuming a single edit caused a conversion change."
      }
    ],

    faq: [
      {
        question: "What is Airbnb conversion?",
        answer: "Conversion generally describes how listing traffic relates to completed bookings, although the exact metric depends on the platform data available."
      },
      {
        question: "Can better photos improve conversion?",
        answer: "Better photos can improve clarity and guest confidence, but they do not guarantee a conversion increase because price, demand, reviews, availability and other factors also matter."
      },
      {
        question: "How does Norixo help with conversion optimization?",
        answer: "Norixo identifies trust, pricing, content and positioning issues that may create booking friction and organizes them into priorities for review."
      }
    ],
  },
];

export function getSolutionBySlug(slug: string) {
  return solutions.find((s) => s.slug === slug);
}

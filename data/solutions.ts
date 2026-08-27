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
      "Improve Airbnb visibility, ranking signals and booking performance.",
    heroTitle: "Airbnb SEO",
    heroSubtitle:
      "Optimize your listing for visibility, trust and booking conversion.",
    intro:
      "Norixo analyzes the signals that influence Airbnb listing performance and helps hosts identify practical optimization opportunities.",
    cta: "Start a free audit",

    sections: [
      {
        title: "How Airbnb SEO works",
        body: "Airbnb SEO combines listing relevance, pricing, guest behavior, reviews, photos, amenities and conversion signals. Listings that satisfy guest intent tend to perform better over time."
      },
      {
        title: "Optimize titles",
        body: "Titles should immediately communicate value, location and the strongest differentiator of the property."
      },
      {
        title: "Improve photos",
        body: "Professional, well-ordered photos increase click-through rate and reinforce trust before guests read the description."
      },
      {
        title: "Strengthen descriptions",
        body: "Descriptions should answer guest questions, reduce uncertainty and clearly explain why the stay is worth booking."
      },
      {
        title: "Price strategically",
        body: "Pricing should reflect market demand, competitor positioning and perceived value rather than relying on fixed rules."
      },
      {
        title: "Increase trust",
        body: "Reviews, cleanliness, communication and accurate information help reduce booking hesitation."
      },
      {
        title: "Measure performance",
        body: "Regular audits reveal what changes have the greatest impact on visibility and bookings."
      },
      {
        title: "Use Norixo",
        body: "Norixo analyzes pricing, competition, photos, positioning and conversion opportunities in a single audit."
      }
    ],

    faq: [
      {
        question: "What is Airbnb SEO?",
        answer: "Airbnb SEO refers to optimizing a listing so it better matches guest searches and improves booking performance."
      },
      {
        question: "Does Airbnb SEO improve bookings?",
        answer: "Better optimization can improve visibility, guest confidence and conversion, which may increase bookings."
      },
      {
        question: "How does Norixo help?",
        answer: "Norixo audits pricing, photos, descriptions, positioning and market competition to identify optimization opportunities."
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
      "Improve pricing decisions using competition and market context.",
    heroTitle: "Airbnb Pricing Optimization",
    heroSubtitle:
      "Price your listing with confidence.",
    intro:
      "Pricing should reflect market demand, guest expectations and perceived value.",
    cta: "Audit pricing",

    sections: [
      {
        title: "Local market pricing signals",
        body: "Airbnb pricing should reflect the real local market, including nearby competitors, guest demand, property type, seasonality, location strength and perceived value."
      },
      {
        title: "Competitor price comparison",
        body: "Norixo helps hosts compare their listing against relevant market alternatives instead of guessing or copying unrelated listings."
      },
      {
        title: "Price and perceived value",
        body: "Guests do not judge price alone. They compare the price with photos, reviews, amenities, description quality, location and trust signals."
      },
      {
        title: "Seasonality and demand",
        body: "A strong pricing strategy adapts to weekends, events, high season, low season, holidays and changes in booking pace."
      },
      {
        title: "Occupancy and revenue balance",
        body: "The goal is not only to increase occupancy or nightly rate. The best strategy balances both to protect total revenue."
      },
      {
        title: "Detect overpriced listings",
        body: "If a listing looks weaker than nearby competitors at the same price, conversion can drop. Norixo helps identify this mismatch."
      },
      {
        title: "Detect underpriced listings",
        body: "Some listings leave revenue on the table because their photos, reviews or amenities support a stronger price than they currently charge."
      },
      {
        title: "Pricing recommendations",
        body: "Norixo connects pricing insights with listing quality so hosts can understand whether they should improve presentation, adjust price, or both."
      }
    ],

    faq: [
      {
        question: "What is Airbnb pricing optimization?",
        answer: "Airbnb pricing optimization is the process of aligning nightly rates with demand, competition, seasonality, listing quality and guest expectations."
      },
      {
        question: "Should I always lower my Airbnb price?",
        answer: "No. Sometimes the listing needs better photos, clearer positioning, stronger amenities or more trust signals before changing price."
      },
      {
        question: "How does Norixo help with Airbnb pricing?",
        answer: "Norixo compares price with market context, listing quality and competitor positioning to identify pricing opportunities and risks."
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
      "Increase revenue through pricing, positioning and conversion improvements.",
    heroTitle: "Airbnb Revenue Optimization",
    heroSubtitle:
      "Grow revenue without guessing.",
    intro:
      "Revenue is driven by occupancy, pricing, guest confidence and market positioning.",
    cta: "Increase revenue",

    sections: [
      {
        title: "Revenue drivers",
        body: "Revenue depends on occupancy, ADR and conversion."
      },
      {
        title: "Pricing strategy",
        body: "Better pricing supports sustainable revenue growth."
      },
      {
        title: "Occupancy balance",
        body: "Higher occupancy is valuable only if pricing remains profitable."
      },
      {
        title: "Market positioning",
        body: "Competing on value is often better than competing only on price."
      },
      {
        title: "Seasonality",
        body: "Demand changes require pricing adjustments."
      },
      {
        title: "Guest confidence",
        body: "Trust influences booking decisions."
      },
      {
        title: "Performance tracking",
        body: "Measure revenue trends over time."
      },
      {
        title: "Optimization cycle",
        body: "Review, improve, measure and repeat."
      }
    ],

    faq: [
      {
        question: "What improves Airbnb revenue?",
        answer: "Pricing, positioning, trust and conversion improvements all contribute."
      },
      {
        question: "Should I lower prices?",
        answer: "Not always. Listing quality may need improvement first."
      },
      {
        question: "How does Norixo increase revenue?",
        answer: "It identifies the changes most likely to improve booking performance."
      }
    ],
  },
  {
    slug: "airbnb-conversion-optimization",
    title: "Airbnb Conversion Optimization",
    description:
      "Turn more listing views into confirmed bookings.",
    heroTitle: "Airbnb Conversion Optimization",
    heroSubtitle:
      "Reduce friction and improve booking confidence.",
    intro:
      "Small improvements across your listing can significantly improve conversion.",
    cta: "Improve conversion",

    sections: [
      {
        title: "Conversion basics",
        body: "Conversion measures how many visitors become guests."
      },
      {
        title: "First impressions",
        body: "Photos, titles and pricing shape initial interest."
      },
      {
        title: "Guest trust",
        body: "Reviews and accurate information reduce hesitation."
      },
      {
        title: "Listing clarity",
        body: "Guests book faster when information is complete."
      },
      {
        title: "Amenities",
        body: "Amenities reinforce perceived value."
      },
      {
        title: "Competitive positioning",
        body: "Stand out by communicating unique strengths."
      },
      {
        title: "Booking friction",
        body: "Reduce uncertainty throughout the booking journey."
      },
      {
        title: "Continuous testing",
        body: "Regular improvements help maintain strong conversion."
      }
    ],

    faq: [
      {
        question: "What is Airbnb conversion?",
        answer: "It is the percentage of visitors who complete a booking."
      },
      {
        question: "Can better photos improve conversion?",
        answer: "Yes. Strong visuals increase confidence and engagement."
      },
      {
        question: "How does Norixo improve conversion?",
        answer: "It identifies trust, pricing and content issues that reduce bookings."
      }
    ],
  },
];

export function getSolutionBySlug(slug: string) {
  return solutions.find((s) => s.slug === slug);
}

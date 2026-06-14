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
      "Optimize titles, descriptions, pricing, photos and guest trust signals.",
    heroTitle: "Airbnb Listing Optimization",
    heroSubtitle:
      "Improve every part of your Airbnb listing with data-driven recommendations.",
    intro:
      "High-performing listings combine strong pricing, compelling visuals and clear communication.",
    cta: "Analyze my listing",

    sections: [
      {
        title: "Listing quality",
        body: "High-performing listings combine strong photos, pricing, titles, descriptions, amenities and guest trust signals."
      },
      {
        title: "Photos first",
        body: "Photos create the first impression and strongly influence click-through rate."
      },
      {
        title: "Title optimization",
        body: "Titles should clearly communicate the property's strongest selling points."
      },
      {
        title: "Descriptions",
        body: "Descriptions should answer guest questions before they are asked."
      },
      {
        title: "Amenities",
        body: "The right amenities improve both search relevance and conversion."
      },
      {
        title: "Trust",
        body: "Reviews, cleanliness and communication reduce booking hesitation."
      },
      {
        title: "Competition",
        body: "Successful hosts monitor nearby listings continuously."
      },
      {
        title: "Continuous improvement",
        body: "Optimization is an ongoing process, not a one-time task."
      }
    ],

    faq: [
      {
        question: "What is Airbnb listing optimization?",
        answer: "It is the process of improving every element of a listing to increase visibility and bookings."
      },
      {
        question: "Does listing quality affect bookings?",
        answer: "Yes. Better listings generally create more trust and improve conversion."
      },
      {
        question: "How does Norixo help?",
        answer: "Norixo identifies opportunities across pricing, photos, descriptions and market positioning."
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
      "Identify the issues reducing visibility and bookings.",
    heroTitle: "Airbnb Listing Audit",
    heroSubtitle:
      "Find what limits your listing performance.",
    intro:
      "Norixo audits pricing, photos, positioning, trust signals and conversion factors.",
    cta: "Run an audit",

    sections: [
      {
        title: "Audit overview",
        body: "A complete audit highlights strengths, weaknesses and optimization opportunities."
      },
      {
        title: "Pricing review",
        body: "Pricing is evaluated against market context."
      },
      {
        title: "Photo review",
        body: "Images are assessed for quality and presentation."
      },
      {
        title: "Content review",
        body: "Titles and descriptions are reviewed for clarity and persuasion."
      },
      {
        title: "Competition",
        body: "Nearby listings provide important benchmarks."
      },
      {
        title: "Guest trust",
        body: "Reviews and trust signals influence booking decisions."
      },
      {
        title: "Priorities",
        body: "Focus first on improvements with the greatest potential impact."
      },
      {
        title: "Continuous monitoring",
        body: "Regular audits help maintain competitiveness."
      }
    ],

    faq: [
      {
        question: "Why audit an Airbnb listing?",
        answer: "Audits identify issues that reduce visibility and conversion."
      },
      {
        question: "How often should I audit?",
        answer: "Reviewing a listing regularly helps adapt to market changes."
      },
      {
        question: "What does Norixo audit?",
        answer: "Pricing, photos, positioning, trust, competition and conversion signals."
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

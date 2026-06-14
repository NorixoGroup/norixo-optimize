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
  },
];

export function getSolutionBySlug(slug: string) {
  return solutions.find((s) => s.slug === slug);
}

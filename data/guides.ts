export type GuideSection = {
  title: string;
  body: string;
};

export type GuideFaq = {
  question: string;
  answer: string;
};

export type Guide = {
  slug: string;
  title: string;
  description: string;
  heroTitle: string;
  heroSubtitle: string;
  intro: string;
  sections: GuideSection[];
  faq: GuideFaq[];
};

export const guides: Guide[] = [
  {
    slug: "airbnb-seo",
    title: "Airbnb SEO Guide",
    description:
      "Learn how Airbnb SEO works and how to improve your listing visibility, ranking signals, click-through rate, and booking conversion.",
    heroTitle: "Airbnb SEO: improve your listing visibility",
    heroSubtitle:
      "A practical guide to Airbnb ranking signals, listing optimization, keywords, photos, pricing, and guest trust.",
    intro:
      "Airbnb SEO is not only about keywords. It is about helping guests quickly understand why your listing is relevant, trustworthy, and worth booking.",
    sections: [
      {
        title: "What Airbnb SEO means",
        body: "Airbnb SEO is the process of improving how your listing appears, performs, and converts in Airbnb search results. It includes title clarity, photo quality, pricing, reviews, location relevance, amenities, and guest behavior signals.",
      },
      {
        title: "The signals that influence performance",
        body: "A strong Airbnb listing usually performs better when it has clear photos, competitive pricing, strong reviews, fast guest confidence, complete amenities, and a description that answers booking objections.",
      },
      {
        title: "How Norixo helps",
        body: "Norixo audits listing quality, pricing signals, photo presentation, description strength, and conversion blockers so hosts can understand what to improve first.",
      },
    ],
    faq: [
      {
        question: "What is Airbnb SEO?",
        answer:
          "Airbnb SEO is the practice of improving a listing so it can perform better in Airbnb search results and convert more guests into bookings.",
      },
      {
        question: "Do keywords matter on Airbnb?",
        answer:
          "Yes, but keywords are only one part of the system. Photos, price, reviews, availability, amenities, and guest behavior also matter.",
      },
      {
        question: "Can Norixo improve Airbnb SEO?",
        answer:
          "Norixo helps identify SEO and conversion blockers in the listing, including weak titles, unclear descriptions, pricing issues, and missing trust signals.",
      },
    ],
  },
  {
    slug: "airbnb-listing-optimization",
    title: "Airbnb Listing Optimization Guide",
    description:
      "Optimize your Airbnb listing title, photos, description, pricing, amenities, and guest trust signals to increase conversions.",
    heroTitle: "Airbnb listing optimization that converts",
    heroSubtitle:
      "Improve the elements that make guests click, trust, compare, and book your property.",
    intro:
      "Airbnb listing optimization is about making every part of your listing work together: title, photos, pricing, description, amenities, reviews, and guest expectations.",
    sections: [
      {
        title: "Start with guest intent",
        body: "Guests compare listings quickly. Your listing must explain who it is for, why it is valuable, what makes it trustworthy, and why it is better than similar alternatives.",
      },
      {
        title: "Fix the highest-impact areas first",
        body: "The most important improvements usually involve the first photo, title clarity, price positioning, description structure, amenities, review signals, and booking confidence.",
      },
      {
        title: "Use an audit before changing everything",
        body: "A structured listing audit helps identify the real blockers instead of guessing. Norixo highlights what affects conversion and where the listing is weaker than the market.",
      },
    ],
    faq: [
      {
        question: "What is Airbnb listing optimization?",
        answer:
          "It is the process of improving a listing so more guests click, trust, and book it.",
      },
      {
        question: "What should I optimize first?",
        answer:
          "Start with photos, title, pricing, description clarity, amenities, and guest trust signals.",
      },
      {
        question: "Does optimization increase revenue?",
        answer:
          "Better presentation and pricing can improve conversion, which may help revenue when demand exists.",
      },
    ],
  },
  {
    slug: "airbnb-pricing-optimization",
    title: "Airbnb Pricing Optimization Guide",
    description:
      "Learn how to optimize Airbnb pricing using market comparison, seasonality, positioning, and listing quality signals.",
    heroTitle: "Airbnb pricing optimization for better bookings",
    heroSubtitle:
      "Understand when your price is too high, too low, or poorly aligned with your local market.",
    intro:
      "Airbnb pricing optimization is not just about lowering the price. It is about matching the price to demand, competition, seasonality, and perceived listing quality.",
    sections: [
      {
        title: "Price must match perceived value",
        body: "Guests compare price against photos, location, reviews, amenities, and alternatives. If the listing looks weaker than similar options, the price will feel expensive even if it is technically average.",
      },
      {
        title: "Local competition matters",
        body: "A good pricing strategy needs comparable listings in the same market, with similar property type, capacity, amenities, and booking context.",
      },
      {
        title: "Norixo pricing signals",
        body: "Norixo compares pricing signals with listing quality and market context to show whether the listing appears aligned with local competition.",
      },
    ],
    faq: [
      {
        question: "What is Airbnb pricing optimization?",
        answer:
          "It is the process of adjusting price based on demand, seasonality, local competition, and listing quality.",
      },
      {
        question: "Should I always lower my Airbnb price?",
        answer:
          "No. Sometimes the issue is not the price itself but weak photos, unclear positioning, missing amenities, or poor conversion signals.",
      },
      {
        question: "Can Norixo help with pricing?",
        answer:
          "Norixo helps compare price positioning with local market signals and listing quality.",
      },
    ],
  },
  {
    slug: "airbnb-listing-audit",
    title: "Airbnb Listing Audit Guide",
    description:
      "Run an Airbnb listing audit to identify weak photos, unclear descriptions, pricing problems, missing amenities, and conversion blockers.",
    heroTitle: "Airbnb listing audit: find what blocks bookings",
    heroSubtitle:
      "A structured way to understand why guests may skip your listing and what to improve first.",
    intro:
      "An Airbnb listing audit helps hosts move from guessing to diagnosing. It looks at the listing through the eyes of a guest comparing multiple options.",
    sections: [
      {
        title: "What an audit should review",
        body: "A strong audit reviews title, photos, description, pricing, amenities, reviews, trust signals, location clarity, and competitor positioning.",
      },
      {
        title: "Why listings underperform",
        body: "Listings often underperform because the first impression is weak, the price feels misaligned, the description does not answer objections, or the guest does not trust the stay enough.",
      },
      {
        title: "How Norixo audits listings",
        body: "Norixo analyzes the listing and market signals to highlight the most important blockers and improvement opportunities.",
      },
    ],
    faq: [
      {
        question: "What is an Airbnb listing audit?",
        answer:
          "It is a structured review of a listing to identify issues that may reduce clicks, trust, bookings, or revenue.",
      },
      {
        question: "When should I audit my listing?",
        answer:
          "Audit your listing when bookings slow down, conversion drops, pricing feels uncertain, or before a high-demand season.",
      },
      {
        question: "What does Norixo check?",
        answer:
          "Norixo checks listing quality, pricing signals, photo presentation, description clarity, market positioning, and conversion blockers.",
      },
    ],
  },
  {
    slug: "airbnb-revenue-optimization",
    title: "Airbnb Revenue Optimization Guide",
    description:
      "Improve Airbnb revenue by aligning listing quality, pricing, conversion, positioning, and guest expectations.",
    heroTitle: "Airbnb revenue optimization starts with conversion",
    heroSubtitle:
      "Revenue is not only price. It depends on visibility, trust, conversion, market fit, and guest demand.",
    intro:
      "Airbnb revenue optimization means improving the full booking path: search visibility, clicks, guest trust, pricing, conversion, and repeat performance.",
    sections: [
      {
        title: "Revenue depends on more than nightly rate",
        body: "A higher nightly rate does not always produce higher revenue. Occupancy, conversion rate, seasonality, guest fit, and listing strength all affect performance.",
      },
      {
        title: "Improve conversion before increasing price",
        body: "If a listing has weak photos, unclear positioning, or poor trust signals, raising the price can make performance worse. Improve the listing foundation first.",
      },
      {
        title: "Use Norixo to find revenue blockers",
        body: "Norixo helps identify whether the main issue is pricing, presentation, competition, guest expectations, or listing quality.",
      },
    ],
    faq: [
      {
        question: "How do I increase Airbnb revenue?",
        answer:
          "Improve pricing, photos, listing clarity, amenities, guest trust, and conversion against local competition.",
      },
      {
        question: "Is revenue optimization the same as pricing?",
        answer:
          "No. Pricing is one part. Revenue also depends on occupancy, conversion, reviews, demand, and listing quality.",
      },
      {
        question: "Can Norixo help increase revenue?",
        answer:
          "Norixo helps identify the listing and market issues that may limit bookings and revenue.",
      },
    ],
  },
  {
    slug: "airbnb-conversion-optimization",
    title: "Airbnb Conversion Optimization Guide",
    description:
      "Improve Airbnb conversion by fixing photos, pricing, trust, description clarity, amenities, and booking objections.",
    heroTitle: "Airbnb conversion optimization for more bookings",
    heroSubtitle:
      "Turn more listing views into bookings by reducing friction and increasing guest confidence.",
    intro:
      "Airbnb conversion optimization is about understanding why guests view a listing but decide not to book.",
    sections: [
      {
        title: "Conversion starts with trust",
        body: "Guests need to feel confident quickly. Photos, reviews, host clarity, amenities, cancellation context, and location information all shape trust.",
      },
      {
        title: "Reduce booking objections",
        body: "A listing should answer common objections: where it is, what is included, how check-in works, who the property fits, and why the price makes sense.",
      },
      {
        title: "Norixo identifies conversion gaps",
        body: "Norixo reviews listing presentation and market positioning to show where guests may hesitate before booking.",
      },
    ],
    faq: [
      {
        question: "What is Airbnb conversion optimization?",
        answer:
          "It is the process of improving a listing so a higher percentage of visitors become bookings.",
      },
      {
        question: "Why do guests view but not book?",
        answer:
          "Common reasons include weak photos, unclear pricing, missing trust signals, poor location explanation, or unclear amenities.",
      },
      {
        question: "How does Norixo help conversion?",
        answer:
          "Norixo identifies listing weaknesses that may reduce guest confidence and booking intent.",
      },
    ],
  },
  {
    slug: "airbnb-ranking",
    title: "Airbnb Ranking Guide",
    description:
      "Understand Airbnb ranking factors and how listing quality, pricing, availability, reviews, guest behavior, and conversion affect visibility.",
    heroTitle: "Airbnb ranking: what affects visibility",
    heroSubtitle:
      "Learn the listing signals that can influence how guests discover and compare your property.",
    intro:
      "Airbnb ranking is influenced by many signals. Hosts cannot control everything, but they can improve the parts of the listing that affect trust, relevance, and conversion.",
    sections: [
      {
        title: "Ranking is connected to guest behavior",
        body: "When guests click, save, message, and book a listing, those behaviors can indicate relevance. A stronger listing presentation can support better engagement.",
      },
      {
        title: "Quality signals matter",
        body: "Photos, reviews, price, amenities, availability, response quality, location relevance, and listing completeness can all influence performance.",
      },
      {
        title: "Norixo helps improve controllable signals",
        body: "Norixo focuses on the parts hosts can improve: presentation, pricing, description, photos, and market positioning.",
      },
    ],
    faq: [
      {
        question: "What affects Airbnb ranking?",
        answer:
          "Ranking can be influenced by relevance, price, quality, reviews, availability, guest behavior, and listing completeness.",
      },
      {
        question: "Can I guarantee first position on Airbnb?",
        answer:
          "No. No tool can guarantee ranking. But improving listing quality and conversion signals can improve performance.",
      },
      {
        question: "Does pricing affect ranking?",
        answer:
          "Pricing can affect guest behavior and competitiveness, which can influence overall listing performance.",
      },
    ],
  },
  {
    slug: "airbnb-description-generator",
    title: "Airbnb Description Generator Guide",
    description:
      "Learn how to create Airbnb descriptions that explain value, reduce guest objections, and improve booking confidence.",
    heroTitle: "Airbnb description generator: write listings that sell",
    heroSubtitle:
      "Create clearer descriptions that explain the stay, highlight value, and answer guest questions.",
    intro:
      "A good Airbnb description does not just describe a property. It helps guests decide whether the stay is right for them.",
    sections: [
      {
        title: "Descriptions should reduce uncertainty",
        body: "Guests want to understand the space, location, amenities, check-in, sleeping setup, rules, and what makes the stay worth booking.",
      },
      {
        title: "Structure matters",
        body: "A strong description is easy to scan. It separates the space, guest access, location, amenities, house rules, and reasons to book.",
      },
      {
        title: "Norixo can reveal weak copy",
        body: "Norixo helps identify whether the description is too vague, too generic, or missing key conversion information.",
      },
    ],
    faq: [
      {
        question: "What should an Airbnb description include?",
        answer:
          "It should include the space, sleeping setup, amenities, location, access, rules, and the main reasons guests should book.",
      },
      {
        question: "Should Airbnb descriptions be long?",
        answer:
          "They should be complete but easy to scan. Clarity matters more than length.",
      },
      {
        question: "Can Norixo improve descriptions?",
        answer:
          "Norixo helps identify missing information and weak positioning in the listing copy.",
      },
    ],
  },
  {
    slug: "airbnb-title-generator",
    title: "Airbnb Title Generator Guide",
    description:
      "Write better Airbnb titles that highlight location, property strengths, amenities, and guest intent.",
    heroTitle: "Airbnb title generator: improve your first impression",
    heroSubtitle:
      "Create titles that communicate value quickly and help guests understand why your listing is relevant.",
    intro:
      "The Airbnb title is one of the first signals guests see. It should be clear, specific, and aligned with what guests are searching for.",
    sections: [
      {
        title: "A good title is specific",
        body: "Strong titles usually mention the strongest selling point: location, view, pool, parking, beach access, workspace, design, or family suitability.",
      },
      {
        title: "Avoid vague titles",
        body: "Titles like 'beautiful apartment' or 'nice place' are weak because they do not explain why the listing is better or who it is for.",
      },
      {
        title: "Norixo checks title clarity",
        body: "Norixo helps identify whether the title communicates the right value for the market and guest intent.",
      },
    ],
    faq: [
      {
        question: "What makes a good Airbnb title?",
        answer:
          "A good title is clear, specific, benefit-driven, and aligned with guest search intent.",
      },
      {
        question: "Should I include the city in my Airbnb title?",
        answer:
          "Sometimes, but it depends on what guests value most. Location, amenities, or a unique benefit may be stronger.",
      },
      {
        question: "Can Norixo help improve titles?",
        answer:
          "Norixo helps evaluate whether the title is clear, specific, and competitive for the local market.",
      },
    ],
  },
  {
    slug: "airbnb-photo-optimization",
    title: "Airbnb Photo Optimization Guide",
    description:
      "Improve Airbnb photos to increase trust, clicks, perceived value, and booking conversion.",
    heroTitle: "Airbnb photo optimization for stronger bookings",
    heroSubtitle:
      "Your photos shape the first impression, perceived value, and guest confidence before they read anything.",
    intro:
      "Photos are one of the most important Airbnb conversion levers. They define perceived quality, trust, and price justification.",
    sections: [
      {
        title: "The first photo matters most",
        body: "The first photo must immediately communicate the strongest reason to click: view, design, pool, location, bedroom quality, living space, or unique experience.",
      },
      {
        title: "Photos must tell the full stay story",
        body: "Guests want to see every important room, sleeping setup, bathroom, kitchen, amenities, exterior, access, and special feature before booking.",
      },
      {
        title: "Norixo detects photo weaknesses",
        body: "Norixo helps identify whether the gallery lacks clarity, trust, variety, or enough visual proof to justify the price.",
      },
    ],
    faq: [
      {
        question: "How many photos should an Airbnb listing have?",
        answer:
          "Most listings need enough photos to clearly show the full stay, including bedrooms, bathroom, kitchen, living area, amenities, and exterior context.",
      },
      {
        question: "What should the first Airbnb photo show?",
        answer:
          "It should show the strongest reason to click, such as the best room, view, pool, design, or unique feature.",
      },
      {
        question: "Can better photos increase bookings?",
        answer:
          "Better photos can improve click-through, trust, perceived value, and booking conversion.",
      },
    ],
  },
];

export function getGuideBySlug(slug: string) {
  return guides.find((guide) => guide.slug === slug);
}

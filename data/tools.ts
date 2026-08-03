export type ToolField = {
  key: string;
  label: string;
  placeholder: string;
};

export type Tool = {
  slug: string;
  title: string;
  description: string;
  heroTitle: string;
  heroSubtitle: string;
  formulaLabel: string;
  formulaDescription: string;
  fields: ToolField[];
  relatedGuides: string[];
  faq: {
    question: string;
    answer: string;
  }[];
};

export const tools: Tool[] = [
  {
    slug: "airbnb-adr-calculator",
    title: "Airbnb ADR Calculator",
    description:
      "Calculate Airbnb average daily rate from revenue and booked nights to understand your listing’s nightly performance and guide better short-term rental pricing.",
    heroTitle: "Airbnb ADR Calculator",
    heroSubtitle:
      "Estimate your average daily rate from total accommodation revenue and booked nights.",
    formulaLabel: "ADR formula",
    formulaDescription:
      "ADR = accommodation revenue ÷ booked nights. This helps hosts understand average revenue per booked night.",
    fields: [
      {
        key: "revenue",
        label: "Accommodation revenue",
        placeholder: "3000",
      },
      {
        key: "nights",
        label: "Booked nights",
        placeholder: "20",
      },
    ],
    relatedGuides: ["airbnb-pricing-optimization", "airbnb-revenue-optimization"],
    faq: [
      {
        question: "What is Airbnb ADR?",
        answer:
          "ADR means average daily rate. It measures average accommodation revenue per booked night.",
      },
      {
        question: "Why is ADR useful?",
        answer:
          "ADR helps hosts evaluate pricing performance, especially when compared with occupancy and revenue.",
      },
    ],
  },
  {
    slug: "airbnb-occupancy-calculator",
    title: "Airbnb Occupancy Calculator",
    description:
      "Use this Airbnb occupancy calculator to compare booked and available nights, track listing performance, and plan practical improvements to your rental calendar.",
    heroTitle: "Airbnb Occupancy Calculator",
    heroSubtitle:
      "Estimate how much of your available calendar is booked.",
    formulaLabel: "Occupancy formula",
    formulaDescription:
      "Occupancy rate = booked nights ÷ available nights × 100.",
    fields: [
      {
        key: "bookedNights",
        label: "Booked nights",
        placeholder: "20",
      },
      {
        key: "availableNights",
        label: "Available nights",
        placeholder: "30",
      },
    ],
    relatedGuides: ["airbnb-revenue-optimization", "airbnb-pricing-optimization"],
    faq: [
      {
        question: "What is Airbnb occupancy rate?",
        answer:
          "Occupancy rate is the percentage of available nights that were booked.",
      },
      {
        question: "Is high occupancy always good?",
        answer:
          "Not always. High occupancy is valuable only if pricing remains profitable.",
      },
    ],
  },
  {
    slug: "airbnb-revpar-calculator",
    title: "Airbnb RevPAR Calculator",
    description:
      "Calculate Airbnb revenue per available rental night using revenue and available nights.",
    heroTitle: "Airbnb RevPAR Calculator",
    heroSubtitle:
      "Measure revenue efficiency across your full available calendar.",
    formulaLabel: "RevPAR formula",
    formulaDescription:
      "RevPAR = accommodation revenue ÷ available nights.",
    fields: [
      {
        key: "revenue",
        label: "Accommodation revenue",
        placeholder: "3000",
      },
      {
        key: "availableNights",
        label: "Available nights",
        placeholder: "30",
      },
    ],
    relatedGuides: ["airbnb-revenue-optimization", "airbnb-pricing-optimization"],
    faq: [
      {
        question: "What is Airbnb RevPAR?",
        answer:
          "RevPAR means revenue per available rental night. It combines pricing and occupancy into one performance metric.",
      },
      {
        question: "Why use RevPAR?",
        answer:
          "RevPAR helps compare revenue efficiency even when occupancy or pricing changes.",
      },
    ],
  },
  {
    slug: "airbnb-revenue-calculator",
    title: "Airbnb Revenue Calculator",
    description:
      "Use this Airbnb revenue calculator to estimate income from nightly rates and booked nights, compare scenarios, and plan realistic short-term rental revenue goals.",
    heroTitle: "Airbnb Revenue Calculator",
    heroSubtitle:
      "Estimate monthly or period revenue from price and booked nights.",
    formulaLabel: "Revenue formula",
    formulaDescription:
      "Estimated revenue = nightly rate × booked nights.",
    fields: [
      {
        key: "nightlyRate",
        label: "Nightly rate",
        placeholder: "150",
      },
      {
        key: "bookedNights",
        label: "Booked nights",
        placeholder: "20",
      },
    ],
    relatedGuides: ["airbnb-revenue-optimization", "airbnb-pricing-optimization"],
    faq: [
      {
        question: "How do I estimate Airbnb revenue?",
        answer:
          "Multiply nightly rate by booked nights, then adjust for fees, seasonality, and operating costs.",
      },
      {
        question: "Is revenue the same as profit?",
        answer:
          "No. Revenue is before expenses. Profit depends on costs such as cleaning, utilities, platform fees, rent, mortgage, and maintenance.",
      },
    ],
  },
  {
    slug: "airbnb-pricing-calculator",
    title: "Airbnb Pricing Calculator",
    description:
      "Use this Airbnb pricing calculator to estimate a starting nightly rate from target revenue and expected booked nights, then refine your short-term rental strategy.",
    heroTitle: "Airbnb Pricing Calculator",
    heroSubtitle:
      "Calculate a simple target nightly rate based on your revenue goal.",
    formulaLabel: "Pricing formula",
    formulaDescription:
      "Target nightly rate = target revenue ÷ expected booked nights.",
    fields: [
      {
        key: "targetRevenue",
        label: "Target revenue",
        placeholder: "3000",
      },
      {
        key: "bookedNights",
        label: "Expected booked nights",
        placeholder: "20",
      },
    ],
    relatedGuides: ["airbnb-pricing-optimization", "airbnb-revenue-optimization"],
    faq: [
      {
        question: "Can a calculator set the perfect Airbnb price?",
        answer:
          "No. A calculator gives a starting point. Real pricing should consider demand, competition, seasonality, and listing quality.",
      },
      {
        question: "What should I compare before changing price?",
        answer:
          "Compare similar nearby listings, your photos, reviews, amenities, seasonality, and booking pace.",
      },
    ],
  },
  {
    slug: "airbnb-profit-calculator",
    title: "Airbnb Profit Calculator",
    description:
      "Estimate Airbnb profit by comparing revenue with operating expenses, then use a clear view of your short-term rental margins to support pricing decisions.",
    heroTitle: "Airbnb Profit Calculator",
    heroSubtitle:
      "Estimate net profit from revenue and expenses.",
    formulaLabel: "Profit formula",
    formulaDescription:
      "Profit = revenue − operating expenses.",
    fields: [
      {
        key: "revenue",
        label: "Revenue",
        placeholder: "3000",
      },
      {
        key: "expenses",
        label: "Operating expenses",
        placeholder: "1200",
      },
    ],
    relatedGuides: ["airbnb-revenue-optimization", "airbnb-pricing-optimization"],
    faq: [
      {
        question: "What expenses should Airbnb hosts include?",
        answer:
          "Common expenses include cleaning, utilities, platform fees, supplies, maintenance, rent, mortgage, taxes, insurance, and management fees.",
      },
      {
        question: "Is profit more important than occupancy?",
        answer:
          "Yes. A property can have high occupancy but weak profit if pricing is too low or expenses are too high.",
      },
    ],
  },
];

export function getToolBySlug(slug: string) {
  return tools.find((tool) => tool.slug === slug);
}

const EXACT_ARTICLE_CLAIM_REPLACEMENTS: Record<string, string> = {
  "Understand the signals that can influence Airbnb visibility, clicks, trust, and booking conversion.":
    "Understand public listing signals and guest-facing factors that may be relevant to Airbnb visibility, trust, and listing performance, without treating them as a disclosed ranking formula.",
  "Airbnb SEO is not the same as traditional Google SEO. Airbnb is a marketplace where guests search, compare, filter, click, save, message, and book. The listings that perform well are usually the ones that match guest intent, build trust quickly, and convert attention into bookings.":
    "Airbnb SEO is not the same as traditional Google SEO. Airbnb is a marketplace where guests search, compare, filter, click, save, message, and book. Hosts can review listing relevance, clarity, trust, pricing, availability, and guest-facing presentation, while Airbnb's complete ranking logic and signal weights remain private.",
  "Photos, titles, descriptions, reviews, amenities, and pricing all shape how guests react to a listing. Better quality can improve trust and conversion.":
    "Photos, titles, descriptions, reviews, amenities, and pricing all shape how guests evaluate a listing. These elements can affect clarity and perceived trust, but they do not guarantee ranking, clicks, conversion, or bookings.",
  "Explore Airbnb search ranking factors such as relevance, price, photos, reviews, availability, amenities, guest behavior, and conversion.":
    "Review public and observable factors relevant to Airbnb search and listing performance, while keeping Airbnb's complete ranking formula and signal weights explicitly unknown.",
  "Photos influence click-through rate, perceived quality, and trust. Strong photos can improve engagement before guests read the description.":
    "Photos shape first impressions, perceived quality, and trust. A clear gallery can help guests evaluate a stay before reading the full description, without guaranteeing clicks, CTR, ranking, or bookings.",
  "Airbnb ranking factors can include relevance, price, availability, reviews, photos, amenities, guest behavior, and conversion performance.":
    "Airbnb publicly discusses relevance and listing-quality considerations, but its complete ranking formula, signal set, and individual weights are not public.",
  "Hosts cannot control every ranking factor, but they can improve listing quality, pricing, photos, availability, and trust signals.":
    "Hosts cannot control Airbnb's ranking system. They can improve listing accuracy, pricing context, photos, availability, amenities, and guest-facing trust signals, then observe outcomes without assuming a direct ranking effect.",
  "Understand how to improve Airbnb listing visibility through relevance, photos, pricing, availability, reviews, and conversion signals.":
    "Understand the listing and market factors worth reviewing when diagnosing Airbnb visibility, without assuming a direct or guaranteed ranking effect.",
  "Airbnb listing visibility depends on whether a listing is eligible, relevant, competitive, trustworthy, and attractive to guests. Improving visibility means improving the signals that affect both search appearance and guest engagement.":
    "Airbnb listing visibility varies with search context, eligibility, availability, competition, listing presentation, and platform systems. Hosts can improve controllable listing inputs, but Airbnb does not publish a complete visibility or ranking formula.",
  "Visibility alone is not enough. A listing must turn views into clicks and bookings. Weak conversion can indicate poor presentation or pricing.":
    "Visibility alone does not explain performance. Guest response should be reviewed alongside presentation, pricing, availability, trust, and market context without assuming one factor caused the outcome.",
  "A practical explanation of the Airbnb search algorithm and the listing signals hosts can improve.":
    "A practical explanation of public Airbnb search principles, observable listing inputs, and the limits of what hosts can know about the private ranking system.",
  "The Airbnb search algorithm is designed to match guests with listings they are likely to book. While the exact system is not public, hosts can still improve the core signals that make listings more relevant and trustworthy.":
    "Airbnb search aims to surface listings relevant to a guest's search context. The exact ranking system and signal weights are not public, so hosts should focus on accurate, relevant, trustworthy listing inputs rather than treating any factor as a disclosed formula.",
  "Search results can change based on guest behavior, location, availability, demand, competition, and listing performance.":
    "Search results can vary with guest search context, location, availability, demand, competition, and platform systems; Airbnb does not publish the complete weight of each factor.",
  "If guests click, save, message, and book a listing, those actions can indicate relevance and attractiveness.":
    "Clicks, saves, messages, and bookings are observable guest outcomes, but Airbnb does not publicly disclose whether or how each action is weighted in its ranking system.",
  "The exact system is not public, but Airbnb search is designed to match guests with relevant, available, competitive, and trustworthy listings.":
    "The exact system is not public. Airbnb describes search as matching guest needs with relevant available listings, but the complete ranking formula and signal weights remain private.",
};

export function normalizeArticleClaimText(value: string): string {
  return EXACT_ARTICLE_CLAIM_REPLACEMENTS[value] ?? value;
}

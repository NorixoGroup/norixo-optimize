import {
  BACKLINK_QUALIFICATION_POLICY_VERSION,
  type BacklinkQualificationPolicy,
} from "./backlink-qualification-types";

function frozenList(values: readonly string[]): readonly string[] {
  return Object.freeze([...values]);
}

export const DEFAULT_BACKLINK_QUALIFICATION_POLICY_V1: BacklinkQualificationPolicy =
  Object.freeze({
    version: BACKLINK_QUALIFICATION_POLICY_VERSION,
    selfHostnames: frozenList(["norixo.io"]),
    blockedHostnames: frozenList([]),
    platformOwnerHostnames: frozenList(["airbnb.com", "booking.com"]),
    directCompetitorHostnames: frozenList([]),
    socialHostnames: frozenList([
      "facebook.com",
      "instagram.com",
      "linkedin.com",
      "x.com",
      "twitter.com",
      "reddit.com",
      "tiktok.com",
    ]),
    searchEngineHostnames: frozenList([
      "google.com",
      "bing.com",
      "brave.com",
      "duckduckgo.com",
      "yahoo.com",
    ]),
    videoHostnames: frozenList(["youtube.com", "youtu.be", "vimeo.com"]),
    unsafeTerms: frozenList([
      "adult",
      "porn",
      "casino",
      "gambling",
      "pharmacy",
      "pills",
      "crypto giveaway",
    ]),
    relevantTerms: frozenList([
      "airbnb",
      "booking",
      "vacation rental",
      "short term rental",
      "property management",
      "hospitality",
      "host",
      "hosting",
      "concierge",
      "rental software",
      "listing optimization",
      "pricing",
      "revenue management",
    ]),
    editorialSignals: frozenList([
      "resource",
      "resources",
      "guide",
      "tools",
      "software",
      "best",
      "comparison",
      "compare",
      "alternatives",
      "directory",
      "partners",
      "guest post",
      "write for us",
    ]),
  });

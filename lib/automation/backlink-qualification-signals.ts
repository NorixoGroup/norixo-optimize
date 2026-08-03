import type {
  BacklinkQualificationOpportunityType,
  BacklinkQualificationPageType,
} from "./backlink-qualification-types";
import type {
  BacklinkQualificationSignal,
  BacklinkQualificationSignalCode,
  BacklinkQualificationSignalsResult,
  ExtractBacklinkQualificationSignalsInput,
} from "./backlink-qualification-signals-types";

const MAX_EVIDENCE_LENGTH = 200;
const specificRelevantTerms = new Set([
  "airbnb",
  "booking",
  "vacation rental",
  "short term rental",
  "listing optimization",
  "revenue management",
]);

function boundedEvidence(value: string): string {
  return value.slice(0, MAX_EVIDENCE_LENGTH);
}

function normalizeAnalysisText(value: string): string {
  return value
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[-_/.?&=]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function sourceUrlParts(sourceUrl: string): { pathAndQuery: string; pageText: string } {
  try {
    const url = new URL(sourceUrl);
    return {
      pathAndQuery: `${url.pathname}${url.search}`,
      pageText: url.pathname,
    };
  } catch {
    return { pathAndQuery: "", pageText: "" };
  }
}

function containsTerm(text: string, term: string): boolean {
  const normalizedTerm = normalizeAnalysisText(term);
  return normalizedTerm.length > 0 && ` ${text} `.includes(` ${normalizedTerm} `);
}

function matchesHostname(hostname: string, rule: string): boolean {
  const candidate = hostname.toLowerCase().replace(/^www\./, "");
  const normalizedRule = rule.toLowerCase().replace(/^www\./, "");
  return candidate === normalizedRule || candidate.endsWith(`.${normalizedRule}`);
}

function hasAnyTerm(text: string, terms: readonly string[]): boolean {
  return terms.some((term) => containsTerm(text, term));
}

function signalCodes(signals: readonly BacklinkQualificationSignal[]): Set<BacklinkQualificationSignalCode> {
  return new Set(signals.map((signal) => signal.code));
}

export function inferBacklinkQualificationOpportunityType(
  signals: readonly BacklinkQualificationSignal[],
): BacklinkQualificationOpportunityType | null {
  const codes = signalCodes(signals);
  if (codes.has("GUEST_POST_SIGNAL")) return "Guest Post";
  if (codes.has("TOOLS_LIST_SIGNAL")) return "Tools List";
  if (codes.has("COMPARISON_SIGNAL")) return "Comparison";
  if (codes.has("DIRECTORY_SIGNAL")) return "Directory";
  if (codes.has("RESOURCE_PAGE_SIGNAL")) return "Resource Page";
  if (codes.has("PARTNERSHIP_SIGNAL")) return "Partnership";
  if (codes.has("GUIDE_SIGNAL")) return "Editorial Mention";
  if (
    codes.has("TOPICAL_RELEVANCE_STRONG") ||
    codes.has("TOPICAL_RELEVANCE_PARTIAL")
  ) {
    return "Other";
  }
  return null;
}

export function inferBacklinkQualificationPageType(
  signals: readonly BacklinkQualificationSignal[],
): BacklinkQualificationPageType {
  const codes = signalCodes(signals);
  if (codes.has("LOGIN_PAGE") || codes.has("LEGAL_PAGE")) return "unknown";
  if (codes.has("SUPPORT_PAGE_SIGNAL")) return "support_page";
  if (codes.has("TOOLS_LIST_SIGNAL")) return "tools_list";
  if (codes.has("COMPARISON_SIGNAL")) return "comparison";
  if (codes.has("DIRECTORY_SIGNAL")) return "directory";
  if (codes.has("RESOURCE_PAGE_SIGNAL")) return "resource_page";
  if (codes.has("GUIDE_SIGNAL")) return "guide";
  if (codes.has("GUEST_POST_SIGNAL")) return "blog_post";
  return "unknown";
}

export function extractBacklinkQualificationSignals(
  input: ExtractBacklinkQualificationSignalsInput,
): BacklinkQualificationSignalsResult {
  const { candidate, query, policy } = input;
  const urlParts = sourceUrlParts(candidate.sourceUrl);
  const analysisText = normalizeAnalysisText(
    [
      candidate.hostname,
      urlParts.pathAndQuery,
      candidate.pageTitle ?? "",
      candidate.snippet ?? "",
      query.query,
    ].join(" "),
  );
  const pageText = normalizeAnalysisText(
    [urlParts.pageText, candidate.pageTitle ?? ""].join(" "),
  );
  const signals: BacklinkQualificationSignal[] = [];
  const seen = new Set<BacklinkQualificationSignalCode>();
  const add = (
    code: BacklinkQualificationSignalCode,
    category: BacklinkQualificationSignal["category"],
    evidence: string,
  ): void => {
    if (seen.has(code)) return;
    seen.add(code);
    signals.push({ code, category, evidence: boundedEvidence(evidence) });
  };
  const addHostnameSignal = (
    rules: readonly string[],
    code: BacklinkQualificationSignalCode,
    category: BacklinkQualificationSignal["category"],
  ): void => {
    const match = rules.find((rule) => matchesHostname(candidate.hostname, rule));
    if (match !== undefined) {
      add(code, category, `Hostname matches policy rule ${match}`);
    }
  };

  addHostnameSignal(policy.selfHostnames, "SELF_DOMAIN", "blocking");
  addHostnameSignal(policy.blockedHostnames, "BLOCKED_HOSTNAME", "blocking");
  addHostnameSignal(policy.platformOwnerHostnames, "PLATFORM_OWNER_DOMAIN", "blocking");
  addHostnameSignal(policy.directCompetitorHostnames, "DIRECT_COMPETITOR", "risk");
  addHostnameSignal(policy.socialHostnames, "SOCIAL_NETWORK", "blocking");
  addHostnameSignal(policy.searchEngineHostnames, "SEARCH_ENGINE", "blocking");
  addHostnameSignal(policy.videoHostnames, "VIDEO_PLATFORM", "blocking");

  const unsafeTerm = policy.unsafeTerms.find((term) => containsTerm(analysisText, term));
  if (unsafeTerm !== undefined) {
    add("UNSAFE_TOPIC", "risk", `Unsafe policy term detected: ${unsafeTerm}`);
  }

  const relevantTerms = policy.relevantTerms.filter((term) => containsTerm(analysisText, term));
  const hasSpecificTerm = relevantTerms.some((term) => specificRelevantTerms.has(term));
  let topicalSignal: BacklinkQualificationSignalsResult["topicalSignal"] = "none";
  if (hasSpecificTerm || relevantTerms.length >= 2) {
    topicalSignal = "strong";
    add(
      "TOPICAL_RELEVANCE_STRONG",
      "topical",
      `Relevant terms detected: ${relevantTerms.slice(0, 3).join(", ")}`,
    );
  } else if (relevantTerms.length === 1) {
    topicalSignal = "partial";
    add(
      "TOPICAL_RELEVANCE_PARTIAL",
      "topical",
      `Relevant term detected: ${relevantTerms[0]}`,
    );
  }

  const editorialRules: readonly [
    BacklinkQualificationSignalCode,
    readonly string[],
  ][] = [
    ["RESOURCE_PAGE_SIGNAL", ["resource", "resources", "links"]],
    ["TOOLS_LIST_SIGNAL", ["tools", "software", "best"]],
    ["GUIDE_SIGNAL", ["guide", "how to", "how-to", "tips"]],
    ["GUEST_POST_SIGNAL", ["guest post", "write for us", "contribute"]],
    ["COMPARISON_SIGNAL", ["vs", "compare", "comparison", "alternatives"]],
    ["DIRECTORY_SIGNAL", ["directory", "listings", "catalogue", "catalog"]],
    ["PARTNERSHIP_SIGNAL", ["partner", "partners", "partnership", "association"]],
  ];
  for (const [code, terms] of editorialRules) {
    const match = terms.find((term) => containsTerm(analysisText, term));
    if (match !== undefined) {
      add(code, "editorial", `Editorial term detected: ${match}`);
    }
  }

  if (hasAnyTerm(pageText, ["login", "sign-in", "signin", "account", "auth"])) {
    add("LOGIN_PAGE", "blocking", "Login page term detected in URL path or title");
  }
  if (hasAnyTerm(pageText, ["privacy", "terms", "legal", "cookies", "gdpr", "impressum"])) {
    add("LEGAL_PAGE", "blocking", "Legal page term detected in URL path or title");
  }
  if (hasAnyTerm(pageText, ["help", "support", "knowledge-base", "faq"])) {
    add("SUPPORT_PAGE_SIGNAL", "risk", "Support page term detected in URL path or title");
  }

  if (candidate.languageCode !== null && candidate.languageCode === query.languageCode) {
    add("LANGUAGE_MATCH", "context", "Candidate language matches query language");
  }
  if (candidate.countryCode !== null && candidate.countryCode === query.countryCode) {
    add("COUNTRY_MATCH", "context", "Candidate country matches query country");
  }
  if (candidate.rank <= 3) {
    add("HIGH_SERP_POSITION", "quality", "Candidate rank is within the first three results");
  }
  if (candidate.pageTitle !== null) {
    add("TITLE_PRESENT", "quality", "Candidate includes a page title");
  }
  if (candidate.snippet !== null) {
    add("SNIPPET_PRESENT", "quality", "Candidate includes a snippet");
  }

  const editorialSignalCodes = signals
    .filter((signal) => signal.category === "editorial")
    .map((signal) => signal.code);
  if (
    candidate.pageTitle === null &&
    candidate.snippet === null &&
    topicalSignal === "none" &&
    editorialSignalCodes.length === 0
  ) {
    add(
      "INSUFFICIENT_EVIDENCE",
      "quality",
      "Candidate has no title, snippet, topical, or editorial evidence",
    );
  }

  return {
    candidateKey: candidate.candidateKey,
    signals,
    blockingSignalCodes: signals
      .filter((signal) => signal.category === "blocking")
      .map((signal) => signal.code),
    riskSignalCodes: signals
      .filter((signal) => signal.category === "risk")
      .map((signal) => signal.code),
    topicalSignal,
    editorialSignalCodes,
    proposedOpportunityType: inferBacklinkQualificationOpportunityType(signals),
    proposedPageType: inferBacklinkQualificationPageType(signals),
  };
}

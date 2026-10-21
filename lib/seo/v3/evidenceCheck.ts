/**
 * SEO generator V3 — evidence check (S5.3-A). Pure: bytes in, verdict out. No file system, no network.
 *
 * A citation ties a short verbatim quote to an archived artifact identified by its SHA-256. The check proves two
 * mechanical things only: the artifact is the one that was cited (hash), and the quote really occurs in it
 * (exact match after Unicode NFC, nothing else: no case folding, no whitespace folding).
 *
 * It does NOT prove that the quote supports the claim, that it applies to the place, or that it is still in force.
 * Each citation therefore carries the collector's stated applicability (geographic, temporal, semantic), and a
 * human validation decision must confirm all three explicitly (see factStore.ts). A quote found in a document is
 * never, by itself, sufficient evidence.
 */
import { createHash } from "node:crypto";

/** Short on purpose: a quote is evidence, not a copy of the source. */
export const QUOTE_MIN_CHARS = 12;
export const QUOTE_MAX_CHARS = 400;

export type CitationApplicability = Readonly<{
  /** Why the quoted text applies to THIS place (city, not just country). */
  geographic: string;
  /** Period during which the quoted text holds, or why it is current. */
  temporal: string;
  /** Why the quoted wording supports the stated fact. */
  semantic: string;
}>;

export type Citation = Readonly<{
  /** SHA-256 (lower-case hex) of the archived artifact the quote comes from. */
  artifactSha256: string;
  quote: string;
  /** Page, section or article inside the artifact, for a human reader. */
  locator: string | null;
  applicability: CitationApplicability;
}>;

/** Returns the bytes of the archived artifact with this hash, or null when it is not available. Must not do network I/O. */
export type ArtifactProvider = (sha256: string) => Uint8Array | null;

export type CitationStatus =
  | "verified"
  | "artifact_unavailable"
  | "artifact_not_text"
  | "hash_mismatch"
  | "quote_not_found"
  | "quote_length_invalid"
  | "malformed";

export type CitationCheck = Readonly<{ artifactSha256: string; status: CitationStatus }>;

export const SHA256_HEX = /^[0-9a-f]{64}$/;

export function sha256OfBytes(bytes: Uint8Array): string {
  return createHash("sha256").update(bytes).digest("hex");
}

const isText = (value: unknown): value is string => typeof value === "string" && value.trim() !== "";

/** Shape problems of a citation (empty = well formed). Never echoes the offending content. */
export function citationShapeIssues(value: unknown): readonly string[] {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return ["citation_not_an_object"];
  const c = value as Record<string, unknown>;
  const issues: string[] = [];
  const allowed = new Set(["artifactSha256", "quote", "locator", "applicability"]);
  for (const key of Object.keys(c)) if (!allowed.has(key)) issues.push("citation_unknown_key");
  if (typeof c.artifactSha256 !== "string" || !SHA256_HEX.test(c.artifactSha256)) issues.push("citation_artifact_hash_invalid");
  if (typeof c.quote !== "string" || c.quote !== c.quote.trim() || c.quote === "") issues.push("citation_quote_invalid");
  if (c.locator !== null && !isText(c.locator)) issues.push("citation_locator_invalid");
  const a = c.applicability as Record<string, unknown> | null | undefined;
  if (typeof a !== "object" || a === null || Array.isArray(a)) issues.push("citation_applicability_missing");
  else {
    for (const key of Object.keys(a)) if (key !== "geographic" && key !== "temporal" && key !== "semantic") issues.push("citation_applicability_unknown_key");
    for (const key of ["geographic", "temporal", "semantic"]) if (!isText(a[key])) issues.push(`citation_applicability_${key}_missing`);
  }
  return [...new Set(issues)].sort();
}

/** Mechanical check of one citation against the archived artifact. */
export function checkCitation(citation: Citation, provider: ArtifactProvider): CitationCheck {
  const artifactSha256 = typeof citation?.artifactSha256 === "string" ? citation.artifactSha256 : "";
  const result = (status: CitationStatus): CitationCheck => Object.freeze({ artifactSha256, status });
  if (citationShapeIssues(citation).length > 0) return result("malformed");
  const length = [...citation.quote.normalize("NFC")].length;
  if (length < QUOTE_MIN_CHARS || length > QUOTE_MAX_CHARS) return result("quote_length_invalid");
  let bytes: Uint8Array | null;
  try {
    bytes = provider(citation.artifactSha256);
  } catch {
    bytes = null;
  }
  if (bytes === null) return result("artifact_unavailable");
  // the hash is recomputed from the bytes: a provider that returns the wrong file is caught here
  if (sha256OfBytes(bytes) !== citation.artifactSha256) return result("hash_mismatch");
  let text: string;
  try {
    text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    return result("artifact_not_text");
  }
  return result(text.normalize("NFC").includes(citation.quote.normalize("NFC")) ? "verified" : "quote_not_found");
}

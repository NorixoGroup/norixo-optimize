import { executeBacklinkDiscoveryPreview } from "../lib/automation";
import { readBacklinkDiscoveryCandidate } from "../lib/automation/backlink-discovery-candidate-reader";
import { buildBacklinkPromotionInputFromDependencies } from "../lib/automation/backlink-promotion-input-builder";
import { validateBacklinkPromotionPreviewInput } from "../lib/automation/backlink-promotion-validation";
import { buildBacklinkQualificationInputFromDependency } from "../lib/automation/backlink-qualification-input-builder";
import { validateBacklinkQualificationPreviewInput } from "../lib/automation/backlink-qualification-validation";
import { normalizeDiscoveryCandidateText, truncateCleanText } from "../lib/automation/backlink-text-normalization";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

const QUERY = "vacation rental resource directory";
const UUID = (n: number) => `${String(n).repeat(8)}-${String(n).repeat(4)}-4${String(n).repeat(3)}-8${String(n).repeat(3)}-${String(n).repeat(12)}`;
const WORKSPACE = UUID(1);
const RUN = UUID(3);
const DISCOVERY_TASK = UUID(2);
const DISCOVERY_INPUT = { version: 1, source: "manual_dashboard", provider: "brave_search", searches: [{ query: QUERY, countryCode: "US", languageCode: "en" }], maxResultsPerSearch: 5, maxCandidates: 5 };

type Item = { url: string; title: string | null; snippet: string | null; rank: number };
const LONE_SURROGATE = /[\ud800-\udbff](?![\udc00-\udfff])|(?<![\ud800-\udbff])[\udc00-\udfff]/;
const isClean = (value: string, max: number) => value.length > 0 && value === value.trim() && value.length <= max && !LONE_SURROGATE.test(value);

async function discover(items: Item[]) {
  const provider = { name: "brave_search" as const, async search() { return { query: QUERY, queryIndex: 0, countryCode: "US", languageCode: "en", items }; } };
  const result = await executeBacklinkDiscoveryPreview(
    { providers: { brave_search: provider } },
    { workspaceId: WORKSPACE, runId: RUN, taskId: DISCOVERY_TASK, taskKind: "backlinks.discovery.preview", attemptedAt: new Date().toISOString(), input: DISCOVERY_INPUT } as never,
  );
  return result.output as { candidates: { evidenceSummary: string; pageTitle: string | null; snippet: string | null; [key: string]: unknown }[]; [key: string]: unknown };
}

/** An item whose evidenceSummary is cut by the 500-character limit exactly after a space (the production defect). */
function itemWithEvidenceCutAfterSpace(): Item {
  const title = "Complete Hospitality Management";
  const head = `SERP rank 1 for query "${QUERY}": ${title} — `;
  const keep = 500 - head.length;
  const snippet = `${"word ".repeat(Math.ceil(keep / 5)).slice(0, keep - 1)} tail of the snippet that is cut away`;
  return { url: "https://example.com/complete-hospitality", title, snippet, rank: 1 };
}

const discoveryTaskFor = (output: unknown) => ({
  id: DISCOVERY_TASK, workspaceId: WORKSPACE, runId: RUN, taskKind: "backlinks.discovery.preview", status: "completed", output, input: DISCOVERY_INPUT,
});
async function qualifyInput(output: unknown) {
  const qualificationTask = { id: UUID(4), workspaceId: WORKSPACE, runId: RUN, taskKind: "backlinks.qualification.preview", status: "running", dependsOnTaskId: DISCOVERY_TASK };
  return buildBacklinkQualificationInputFromDependency({ qualificationTask } as never, { getTaskByIdInRun: async () => discoveryTaskFor(output) } as never);
}
async function promotionInput(output: unknown) {
  const promotionTask = { id: UUID(5), workspaceId: WORKSPACE, runId: RUN, taskKind: "backlinks.promotion.preview", status: "running", dependsOnTaskId: UUID(4) };
  const qualification = {
    id: UUID(4), workspaceId: WORKSPACE, runId: RUN, taskKind: "backlinks.qualification.preview", status: "completed", dependsOnTaskId: DISCOVERY_TASK,
    output: { version: 1, kind: "backlinks.qualification.preview", dryRun: true, policyVersion: "backlink-qualification-v1", summary: {}, results: [] },
  };
  return buildBacklinkPromotionInputFromDependencies(
    { promotionTask } as never,
    { getTaskByIdInRun: async (input: { taskId: string }) => (input.taskId === UUID(4) ? qualification : discoveryTaskFor(output)) } as never,
  );
}
async function rejects(operation: () => Promise<unknown>): Promise<boolean> {
  try { await operation(); } catch { return true; }
  return false;
}

async function main(): Promise<void> {
  // 1. Helper: truncate then trim, within limits, no lone surrogates, valid text preserved, idempotent.
  assert(truncateCleanText(`${"a".repeat(499)} ${"b".repeat(5)}`, 500) === "a".repeat(499), "cut right after a space must be trimmed");
  assert(truncateCleanText(`${"a".repeat(498)}   tail`, 500) === "a".repeat(498), "several trailing spaces are trimmed");
  const emoji = `${"e".repeat(499)}😀tail`;
  assert(emoji.slice(0, 500).length === 500 && LONE_SURROGATE.test(emoji.slice(0, 500)), "fixture: naive slice splits the surrogate pair");
  assert(!LONE_SURROGATE.test(truncateCleanText(emoji, 500)) && truncateCleanText(emoji, 500) === "e".repeat(499), "a pair straddling the limit is dropped whole");
  assert(truncateCleanText(`${"e".repeat(498)}😀`, 500) === `${"e".repeat(498)}😀`, "a pair that fits is kept");
  const valid = "A perfectly valid title";
  assert(truncateCleanText(valid, 300) === valid, "valid text is unchanged");
  const exact = "x".repeat(500);
  assert(truncateCleanText(exact, 500) === exact, "exactly 500 clean characters are preserved");
  assert(truncateCleanText("   \n ", 10) === "" && truncateCleanText("", 10) === "", "blank text becomes empty");
  assert(truncateCleanText("abc", 0) === "", "limit 0");
  for (const sample of [emoji, `${"a".repeat(499)} b`, valid, "  padded  "]) {
    const once = truncateCleanText(sample, 500);
    assert(truncateCleanText(once, 500) === once, "truncateCleanText must be idempotent");
  }

  // 2. Producer: boundary cases through the REAL discovery handler.
  const cutEvidence = await discover([itemWithEvidenceCutAfterSpace()]);
  const evidence = cutEvidence.candidates[0]!.evidenceSummary;
  assert(isClean(evidence, 500) && evidence.length < 500, `evidenceSummary cut on whitespace must be trimmed (length ${evidence.length})`);

  const boundary = await discover([
    { url: "https://example.com/title", title: `${"t".repeat(299)} ${"u".repeat(40)}`, snippet: null, rank: 1 },
    { url: "https://example.com/snippet", title: "Snippet boundary", snippet: `${"s".repeat(499)} ${"z".repeat(40)}`, rank: 2 },
    { url: "https://example.com/emoji", title: `${"m".repeat(299)}😀 tail`, snippet: `${"n".repeat(499)}😀 tail`, rank: 3 },
    { url: "https://example.com/exact", title: "x".repeat(300), snippet: "y".repeat(500), rank: 4 },
    { url: "https://example.com/blank", title: "   ", snippet: "  ", rank: 5 },
  ]);
  for (const candidate of boundary.candidates) {
    assert(isClean(candidate.evidenceSummary, 500), `evidence clean for ${candidate.evidenceSummary.slice(0, 30)}`);
    assert(candidate.pageTitle === null || isClean(candidate.pageTitle, 300), "pageTitle clean");
    assert(candidate.snippet === null || isClean(candidate.snippet, 500), "snippet clean");
  }
  assert(boundary.candidates[0]!.pageTitle === "t".repeat(299), "title boundary: trailing space dropped");
  assert(boundary.candidates[1]!.snippet === "s".repeat(499), "snippet boundary: trailing space dropped");
  assert(boundary.candidates[3]!.pageTitle === "x".repeat(300) && boundary.candidates[3]!.snippet === "y".repeat(500), "exact-limit text is preserved");
  assert(boundary.candidates[4]!.pageTitle === null && boundary.candidates[4]!.snippet === null, "blank title/snippet become null");

  // 3. Fresh output now passes both downstream stages without any read-side repair.
  const fresh = await discover([itemWithEvidenceCutAfterSpace(), ...boundary.candidates.slice(0, 0).map(() => ({}) as Item)]);
  assert((await qualifyInput(fresh)).qualificationInput.candidates.length === 1, "fresh output accepted by qualification");
  assert((await promotionInput(fresh)).promotionInput.candidates.length === 1, "fresh output accepted by promotion");

  // 4. Already persisted malformed text (written before the fix) is repaired on read, never rewritten.
  const persisted = await discover([
    { url: "https://example.com/a", title: "Alpha", snippet: "Alpha snippet", rank: 1 },
    { url: "https://example.com/b", title: "Beta", snippet: "Beta snippet", rank: 2 },
  ]);
  persisted.candidates[0]!.evidenceSummary = `${"E".repeat(499)} `;
  persisted.candidates[0]!.pageTitle = `${"T".repeat(299)} `;
  persisted.candidates[0]!.snippet = `${"S".repeat(499)} `;
  const before = JSON.stringify(persisted);
  const strictQualification = () => validateBacklinkQualificationPreviewInput({
    version: 1, source: "automation_discovery", policyVersion: "backlink-qualification-v1",
    queries: [{ query: QUERY, countryCode: "US", languageCode: "en" }],
    candidates: persisted.candidates.map((c) => ({ candidateKey: c.candidateKey, hostname: c.hostname, sourceUrl: c.sourceUrl, pageTitle: c.pageTitle, snippet: c.snippet, queryIndex: c.queryIndex, rank: c.rank, countryCode: c.countryCode, languageCode: c.languageCode, suggestedAssetKey: c.suggestedAssetKey, evidenceSummary: c.evidenceSummary, discoveryScore: c.discoveryScore })),
    maxCandidates: 2,
  });
  // The validators themselves stay strict about the raw malformed data.
  let strictRejected = false;
  try { strictQualification(); } catch { strictRejected = true; }
  assert(strictRejected, "qualification validator must still reject untrimmed text");
  let promotionRejected = false;
  try { validateBacklinkPromotionPreviewInput({ version: 1, source: "automation_qualification", policyVersion: "backlink-promotion-v1", candidates: persisted.candidates, qualificationResults: [], includeDecisions: ["qualified"], maxProposals: 1 }); } catch { promotionRejected = true; }
  assert(promotionRejected, "promotion validator must still reject untrimmed text");

  const qualification = await qualifyInput(persisted);
  assert(qualification.qualificationInput.candidates.length === 2, "persisted malformed output is accepted by qualification");
  assert(qualification.qualificationInput.candidates.every((c) => isClean(c.evidenceSummary, 500) && (c.pageTitle === null || isClean(c.pageTitle, 300)) && (c.snippet === null || isClean(c.snippet, 500))), "qualification input is normalized");
  assert(qualification.qualificationInput.candidates[1]!.evidenceSummary === persisted.candidates[1]!.evidenceSummary, "already-valid candidate is untouched");
  const promotion = await promotionInput(persisted);
  assert(promotion.promotionInput.candidates.length === 2 && promotion.promotionInput.candidates.every((c) => isClean(c.evidenceSummary, 500)), "persisted malformed output is accepted by promotion");
  assert(JSON.stringify(persisted) === before, "the persisted discovery output must not be modified");

  // 5. Candidate reader used by intake returns repaired text and still does not mutate the stored output.
  const run = { id: RUN, workspaceId: WORKSPACE };
  const read = await readBacklinkDiscoveryCandidate(
    { getRunById: async () => run, getTaskByIdInRun: async () => discoveryTaskFor(persisted) } as never,
    { workspaceId: WORKSPACE, runId: RUN, taskId: DISCOVERY_TASK, candidateKey: String(persisted.candidates[0]!.candidateKey) },
  );
  assert(isClean(read.candidate.evidenceSummary, 500) && read.candidate.pageTitle !== null && isClean(read.candidate.pageTitle, 300), "intake reader returns normalized text");
  assert(read.candidate.sourceUrl === persisted.candidates[0]!.sourceUrl && read.candidate.candidateKey === persisted.candidates[0]!.candidateKey && read.candidate.discoveryScore === persisted.candidates[0]!.discoveryScore, "identity and scoring fields are untouched");
  assert(JSON.stringify(persisted) === before, "the reader must not modify the stored output");

  // 6. Normalization is idempotent and leaves valid candidates deep-equal.
  for (const candidate of persisted.candidates) {
    const once = normalizeDiscoveryCandidateText(candidate as never);
    assert(JSON.stringify(normalizeDiscoveryCandidateText(once)) === JSON.stringify(once), "normalizeDiscoveryCandidateText must be idempotent");
  }
  assert(JSON.stringify(normalizeDiscoveryCandidateText(persisted.candidates[1]! as never)) === JSON.stringify(persisted.candidates[1]), "a valid candidate is returned deep-equal");

  // 7. Genuinely invalid data is still rejected (the repair does not mask other defects).
  const brokenHost = await discover([{ url: "https://example.com/ok", title: "OK", snippet: "ok", rank: 1 }]);
  brokenHost.candidates[0]!.hostname = "other.example";
  assert(await rejects(() => qualifyInput(brokenHost)), "a hostname that does not match the URL is still rejected");
  const emptyEvidence = await discover([{ url: "https://example.com/ok2", title: "OK", snippet: "ok", rank: 1 }]);
  emptyEvidence.candidates[0]!.evidenceSummary = "   ";
  assert(await rejects(() => qualifyInput(emptyEvidence)), "blank evidence is still rejected");

  console.log("PASS — Automation backlink discovery text normalization smoke");
}

void main().catch((error) => {
  console.error(error);
  process.exit(1);
});

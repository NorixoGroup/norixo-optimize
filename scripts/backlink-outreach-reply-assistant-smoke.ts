import assert from "node:assert/strict";

import {
  BacklinkOutreachReplyAssistantError,
  buildBacklinkOutreachReplyAssistantPrompt,
  normalizeBacklinkOutreachReplyAssistantContext,
  parseBacklinkOutreachReplyAssistantProposal,
  type BacklinkOutreachReplyAssistantContext,
} from "../lib/backlinks/services/outreachReplyAssistant";

function fixture(
  channel: BacklinkOutreachReplyAssistantContext["channel"],
): BacklinkOutreachReplyAssistantContext {
  return {
    channel,
    campaign: {
      name: "Norixo backlink outreach",
      objective: "Earn relevant editorial backlinks",
    },
    contact: {
      fullName: "Jane Example",
      roleTitle: "Editor",
    },
    domain: {
      hostname: "example.com",
    },
    opportunity: {
      targetPageTitle: "Vacation rental optimization guide",
      targetPageUrl: "https://example.com/guide",
      opportunityType: "editorial_reference",
      pageType: "guide",
      evidenceSummary: "The page covers vacation rental optimization.",
    },
    asset: {
      displayName: "Norixo",
      canonicalUrl: "https://norixo.io",
    },
    inbound: {
      sender: "Jane Example",
      subject: "Re: Norixo",
      textBody: "Thanks. Can you send me more information?",
    },
  };
}

function expectError(
  fn: () => unknown,
  code: BacklinkOutreachReplyAssistantError["code"],
): void {
  assert.throws(fn, (error: unknown) => {
    return (
      error instanceof BacklinkOutreachReplyAssistantError &&
      error.code === code
    );
  });
}

const email = normalizeBacklinkOutreachReplyAssistantContext(
  fixture("email"),
);
assert.equal(email.channel, "email");

const linkedin = normalizeBacklinkOutreachReplyAssistantContext(
  fixture("linkedin"),
);
assert.equal(linkedin.channel, "linkedin");

const prompt = buildBacklinkOutreachReplyAssistantPrompt(
  fixture("linkedin"),
);

assert.match(prompt, /Channel: linkedin/);
assert.match(prompt, /Norixo backlink outreach/);
assert.match(prompt, /example\.com/);
assert.match(prompt, /Vacation rental optimization guide/);
assert.match(prompt, /Thanks\. Can you send me more information\?/);
assert.match(prompt, /Human approval is mandatory/);
assert.match(prompt, /approvalRequired MUST be true/);
assert.match(prompt, /Never invent prior conversation facts/);
assert.match(prompt, /Never promise payment or reciprocal linking/);
assert.match(prompt, /Return JSON only/);

const parsed = parseBacklinkOutreachReplyAssistantProposal(
  JSON.stringify({
    reply: "Thanks for getting back to me. I’d be happy to share more details.",
    tone: "professional",
    language: "en",
    approvalRequired: true,
    warnings: [],
  }),
);

assert.equal(parsed.approvalRequired, true);
assert.equal(parsed.language, "en");
assert.equal(parsed.warnings.length, 0);

expectError(
  () => parseBacklinkOutreachReplyAssistantProposal("not-json"),
  "PROPOSAL_INVALID",
);

expectError(
  () =>
    parseBacklinkOutreachReplyAssistantProposal(
      JSON.stringify({
        reply: "Draft",
        tone: "professional",
        language: "en",
        approvalRequired: false,
        warnings: [],
      }),
    ),
  "PROPOSAL_INVALID",
);

expectError(
  () =>
    parseBacklinkOutreachReplyAssistantProposal(
      JSON.stringify({
        reply: "",
        tone: "professional",
        language: "en",
        approvalRequired: true,
        warnings: [],
      }),
    ),
  "PROPOSAL_INVALID",
);

const missingReply = fixture("linkedin");
missingReply.inbound.textBody = " ";

expectError(
  () => normalizeBacklinkOutreachReplyAssistantContext(missingReply),
  "INBOUND_REPLY_REQUIRED",
);

console.log("PASS — backlink outreach AI reply contract smoke");

async function executionSmoke(): Promise<void> {
  const calls: unknown[] = [];

  const success = await import(
    "../lib/backlinks/services/outreachReplyAssistant"
  ).then(({ generateBacklinkOutreachReplyAssistantProposal }) =>
    generateBacklinkOutreachReplyAssistantProposal(
      fixture("linkedin"),
      {
        executeAiRequest: async (request) => {
          calls.push(request);

          return {
            providerId: "openai",
            model: "fake-model",
            status: "success",
            output: JSON.stringify({
              reply: "Thanks for your reply. I’d be happy to share more information.",
              tone: "professional",
              language: "en",
              approvalRequired: true,
              warnings: [],
            }),
            error: null,
            costEur: 0,
            durationMs: 1,
          };
        },
      },
    ),
  );

  assert.equal(calls.length, 1);
  assert.equal(success.status, "success");
  assert.equal(success.providerId, "openai");
  assert.equal(success.model, "fake-model");
  assert.equal(success.proposal.approvalRequired, true);
  assert.match(success.proposal.reply, /happy to share more information/);

  const request = calls[0] as {
    agentId: string;
    providerId: string;
    capabilities: string[];
    input: string;
    metadata?: Record<string, unknown>;
  };

  assert.equal(request.agentId, "marketing-manager");
  assert.equal(request.providerId, "openai");
  assert.deepEqual(request.capabilities, ["chat"]);
  assert.match(request.input, /Channel: linkedin/);
  assert.match(request.input, /Thanks\. Can you send me more information\?/);
  assert.equal(
    request.metadata?.feature,
    "backlink-outreach-reply-assistant",
  );
  assert.equal(request.metadata?.approvalRequired, true);

  await assert.rejects(
    () =>
      import("../lib/backlinks/services/outreachReplyAssistant").then(
        ({ generateBacklinkOutreachReplyAssistantProposal }) =>
          generateBacklinkOutreachReplyAssistantProposal(
            fixture("email"),
            {
              executeAiRequest: async () => ({
                providerId: "openai",
                model: "fake-model",
                status: "error",
                output: null,
                error: "fake failure",
                costEur: 0,
                durationMs: 1,
              }),
            },
          ),
      ),
    (error: unknown) =>
      error instanceof BacklinkOutreachReplyAssistantError &&
      error.code === "AI_EXECUTION_FAILED",
  );

  await assert.rejects(
    () =>
      import("../lib/backlinks/services/outreachReplyAssistant").then(
        ({ generateBacklinkOutreachReplyAssistantProposal }) =>
          generateBacklinkOutreachReplyAssistantProposal(
            fixture("linkedin"),
            {
              executeAiRequest: async () => ({
                providerId: "openai",
                model: "fake-model",
                status: "success",
                output: '{"reply":"unsafe","approvalRequired":false}',
                error: null,
                costEur: 0,
                durationMs: 1,
              }),
            },
          ),
      ),
    (error: unknown) =>
      error instanceof BacklinkOutreachReplyAssistantError &&
      error.code === "PROPOSAL_INVALID",
  );

  console.log(
    "PASS — backlink outreach AI reply execution smoke (offline)",
  );
}

executionSmoke().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

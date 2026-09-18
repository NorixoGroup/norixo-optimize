import assert from "node:assert/strict";

import {
  BacklinkOutreachFollowUpDraftError,
  prepareBacklinkOutreachFollowUpDraft,
} from "../lib/backlinks/services/outreachFollowUpDraftService";

const workspaceId = "workspace-1";
const outreachId = "outreach-1";
const attemptId = "attempt-1";
const actorUserId = "user-1";

const attempt = {
  id: attemptId,
  outreach_id: outreachId,
  attempt_kind: "follow_up",
  status: "prepared",
  created_at: "2026-09-18T10:00:00.000Z",
};

const outreach = {
  id: outreachId,
  campaign_id: "campaign-1",
  contact_id: "contact-1",
  opportunity_id: "opportunity-1",
  subject: "Research methodology for vacation-rental market analysis",
  body:
    "Hi Skift Research team,\n\n" +
    "I’m reaching out regarding your research methodology page. " +
    "Norixo has published a research methodology for vacation-rental market analysis.\n\n" +
    "Best,\nMohamed",
};

const templateData = {
  campaign: {
    name: "INTERNAL CAMPAIGN NAME — MUST NOT LEAK",
    objective: "Earn relevant editorial backlinks",
  },
  contact: {
    fullName: "Skift Research team",
    roleTitle: "Research",
  },
  domain: {
    hostname: "research.skift.com",
  },
  opportunity: {
    targetPageTitle: "Focus and Methodology",
    targetPageUrl: "https://research.skift.com/focus-and-methodology/",
    opportunityType: "resource",
    pageType: "research",
    evidenceSummary:
      "The supplied target page is a methodology-focused research page.",
  },
  asset: {
    displayName: "Research Methodology",
    canonicalUrl: "https://norixo.io/research/methodology",
  },
};

function canonicalDraft() {
  return {
    id: "draft-1",
    outreachId,
    attemptId,
    followUpNumber: 1,
    subject: "Canonical existing subject",
    body: "Canonical existing body",
    preparedAt: "2026-09-18T10:01:00.000Z",
    updatedAt: "2026-09-18T10:01:00.000Z",
    updatedBy: actorUserId,
  };
}

async function main() {
  let aiCalls = 0;
  let prepareCalls = 0;
  let capturedAiInput: any = null;
  let capturedPrepareInput: any = null;

  const baseDeps = {
    getAttempt: async () => attempt,

    getOutreach: async () => outreach,

    listAttempts: async () => [
      {
        id: "initial-attempt",
        outreach_id: outreachId,
        attempt_kind: "initial",
        status: "accepted",
        created_at: "2026-08-27T09:00:00.000Z",
      },
      attempt,
    ],

    getTemplateData: async () => templateData,

    getDraft: async () => null,

    generateAiDraft: async (input: any) => {
      aiCalls += 1;
      capturedAiInput = input;

      return {
        proposal: {
          subject:
            "Re: Research methodology for vacation-rental market analysis",
          body:
            "Hi Skift Research team,\n\n" +
            "Just following up on my previous note about research methodology for vacation-rental market analysis. " +
            "Would it be worth taking a look at Norixo’s methodology resource?\n\n" +
            "Best,\nMohamed",
          tone: "professional",
          language: "en",
          approvalRequired: true as const,
          warnings: [],
        },
        providerId: "openai",
        model: "test-model",
        status: "success" as const,
      };
    },

    prepare: async (input: any) => {
      prepareCalls += 1;
      capturedPrepareInput = input;

      return {
        ...canonicalDraft(),
        subject: input.subject,
        body: input.body,
        disposition: "created" as const,
      };
    },

    now: () => "2026-09-18T10:01:00.000Z",
  };

  // --------------------------------------------------------
  // 1. NEW DRAFT:
  // actual previous outbound subject/body MUST reach AI.
  // --------------------------------------------------------

  const prepare = prepareBacklinkOutreachFollowUpDraft(
    baseDeps,
  );

  const result = await prepare({
    workspaceId,
    outreachId,
    attemptId,
    actorUserId,
  });

  assert.equal(aiCalls, 1);
  assert.equal(prepareCalls, 1);

  assert.equal(
    capturedAiInput.previousOutbound.subject,
    outreach.subject,
  );

  assert.equal(
    capturedAiInput.previousOutbound.body,
    outreach.body,
  );

  assert.equal(capturedAiInput.followUpNumber, 1);

  assert.equal(
    capturedAiInput.opportunity.targetPageTitle,
    "Focus and Methodology",
  );

  assert.equal(
    capturedAiInput.asset.canonicalUrl,
    "https://norixo.io/research/methodology",
  );

  assert.equal(
    capturedPrepareInput.subject,
    "Re: Research methodology for vacation-rental market analysis",
  );

  assert.match(
    capturedPrepareInput.body,
    /previous note/i,
  );

  assert.equal(result.disposition, "created");

  // --------------------------------------------------------
  // 2. EXISTING CANONICAL DRAFT:
  // MUST return before outreach load / AI generation.
  // --------------------------------------------------------

  let existingAiCalls = 0;
  let existingOutreachCalls = 0;
  let existingPrepareCalls = 0;

  const prepareExisting =
    prepareBacklinkOutreachFollowUpDraft({
      ...baseDeps,

      getDraft: async () => canonicalDraft(),

      getOutreach: async () => {
        existingOutreachCalls += 1;
        return outreach;
      },

      generateAiDraft: async () => {
        existingAiCalls += 1;
        throw new Error(
          "AI MUST NOT RUN FOR EXISTING DRAFT",
        );
      },

      prepare: async () => {
        existingPrepareCalls += 1;
        throw new Error(
          "PREPARE MUST NOT RUN FOR EXISTING DRAFT",
        );
      },
    });

  const existing = await prepareExisting({
    workspaceId,
    outreachId,
    attemptId,
    actorUserId,
  });

  assert.equal(existing.disposition, "existing");
  assert.equal(
    existing.subject,
    "Canonical existing subject",
  );
  assert.equal(existingAiCalls, 0);
  assert.equal(existingOutreachCalls, 0);
  assert.equal(existingPrepareCalls, 0);

  // --------------------------------------------------------
  // 3. MISSING PREVIOUS SUBJECT:
  // fail closed BEFORE AI.
  // --------------------------------------------------------

  let missingSubjectAiCalls = 0;

  const missingSubject =
    prepareBacklinkOutreachFollowUpDraft({
      ...baseDeps,

      getOutreach: async () => ({
        ...outreach,
        subject: null,
      }),

      generateAiDraft: async () => {
        missingSubjectAiCalls += 1;
        throw new Error("AI MUST NOT RUN");
      },
    });

  await assert.rejects(
    () =>
      missingSubject({
        workspaceId,
        outreachId,
        attemptId,
        actorUserId,
      }),
    (error: unknown) =>
      error instanceof BacklinkOutreachFollowUpDraftError &&
      error.code === "FOLLOW_UP_DRAFT_INVALID",
  );

  assert.equal(missingSubjectAiCalls, 0);

  // --------------------------------------------------------
  // 4. MISSING PREVIOUS BODY:
  // fail closed BEFORE AI.
  // --------------------------------------------------------

  let missingBodyAiCalls = 0;

  const missingBody =
    prepareBacklinkOutreachFollowUpDraft({
      ...baseDeps,

      getOutreach: async () => ({
        ...outreach,
        body: "",
      }),

      generateAiDraft: async () => {
        missingBodyAiCalls += 1;
        throw new Error("AI MUST NOT RUN");
      },
    });

  await assert.rejects(
    () =>
      missingBody({
        workspaceId,
        outreachId,
        attemptId,
        actorUserId,
      }),
    (error: unknown) =>
      error instanceof BacklinkOutreachFollowUpDraftError &&
      error.code === "FOLLOW_UP_DRAFT_INVALID",
  );

  assert.equal(missingBodyAiCalls, 0);

  // --------------------------------------------------------
  // 5. AI FAILURE:
  // fail closed, never persist a draft.
  // --------------------------------------------------------

  let failedPrepareCalls = 0;

  const aiFailure =
    prepareBacklinkOutreachFollowUpDraft({
      ...baseDeps,

      generateAiDraft: async () => {
        throw new Error("SIMULATED_AI_FAILURE");
      },

      prepare: async () => {
        failedPrepareCalls += 1;
        throw new Error("MUST NOT PREPARE");
      },
    });

  await assert.rejects(
    () =>
      aiFailure({
        workspaceId,
        outreachId,
        attemptId,
        actorUserId,
      }),
    /SIMULATED_AI_FAILURE/,
  );

  assert.equal(failedPrepareCalls, 0);

  // --------------------------------------------------------
  // 6. FINAL/LATER FOLLOW-UP CONTEXT:
  // distinguish follow-up #2 from #1.
  // --------------------------------------------------------

  let finalContext: any = null;

  const laterAttempt = {
    ...attempt,
    id: "attempt-2",
    created_at: "2026-09-25T10:00:00.000Z",
  };

  const finalFollowUp =
    prepareBacklinkOutreachFollowUpDraft({
      ...baseDeps,

      getAttempt: async () => laterAttempt,

      listAttempts: async () => [
        {
          id: "initial-attempt",
          outreach_id: outreachId,
          attempt_kind: "initial",
          status: "accepted",
          created_at: "2026-08-27T09:00:00.000Z",
        },
        {
          id: "attempt-1",
          outreach_id: outreachId,
          attempt_kind: "follow_up",
          status: "accepted",
          created_at: "2026-09-18T10:00:00.000Z",
        },
        laterAttempt,
      ],

      generateAiDraft: async (input: any) => {
        finalContext = input;

        return {
          proposal: {
            subject: "Re: Research methodology",
            body:
              "Hi Skift Research team,\n\n" +
              "One final follow-up on my previous note. " +
              "No problem if it is not relevant for your team.\n\n" +
              "Best,\nMohamed",
            tone: "professional",
            language: "en",
            approvalRequired: true as const,
            warnings: [],
          },
          providerId: "openai",
          model: "test-model",
          status: "success" as const,
        };
      },
    });

  await finalFollowUp({
    workspaceId,
    outreachId,
    attemptId: laterAttempt.id,
    actorUserId,
  });

  assert.equal(finalContext.followUpNumber, 2);

  // --------------------------------------------------------
  // 7. LATER FOLLOW-UP:
  // latest ACCEPTED follow-up draft becomes previous outbound.
  // --------------------------------------------------------

  const acceptedPriorDraft = {
    id: "accepted-draft-1",
    outreachId,
    attemptId: "attempt-1",
    followUpNumber: 1,
    subject:
      "Re: Research methodology for vacation-rental market analysis",
    body:
      "Hi Skift Research team,\\n\\n" +
      "Just following up on my previous note about the methodology resource.\\n\\n" +
      "Best,\\nMohamed",
    preparedAt: "2026-09-18T10:01:00.000Z",
    updatedAt: "2026-09-18T10:01:00.000Z",
    updatedBy: actorUserId,
  };

  let chainedContext: any = null;

  const chainedFollowUp =
    prepareBacklinkOutreachFollowUpDraft({
      ...baseDeps,

      getAttempt: async () => laterAttempt,

      listAttempts: async () => [
        {
          id: "initial-attempt",
          outreach_id: outreachId,
          attempt_kind: "initial",
          status: "accepted",
          created_at: "2026-08-27T09:00:00.000Z",
        },
        {
          id: "attempt-1",
          outreach_id: outreachId,
          attempt_kind: "follow_up",
          status: "accepted",
          created_at: "2026-09-18T10:00:00.000Z",
        },
        laterAttempt,
      ],

      getDraft: async (_workspaceId, requestedAttemptId) => {
        if (requestedAttemptId === laterAttempt.id) {
          return null;
        }

        if (requestedAttemptId === "attempt-1") {
          return acceptedPriorDraft;
        }

        return null;
      },

      generateAiDraft: async (input: any) => {
        chainedContext = input;

        return {
          proposal: {
            subject: "Re: Research methodology",
            body:
              "Hi Skift Research team,\\n\\n" +
              "One final follow-up on my last note.\\n\\n" +
              "Best,\\nMohamed",
            tone: "professional",
            language: "en",
            approvalRequired: true as const,
            warnings: [],
          },
          providerId: "openai",
          model: "test-model",
          status: "success" as const,
        };
      },
    });

  await chainedFollowUp({
    workspaceId,
    outreachId,
    attemptId: laterAttempt.id,
    actorUserId,
  });

  assert.equal(chainedContext.followUpNumber, 2);

  assert.equal(
    chainedContext.previousOutbound.subject,
    acceptedPriorDraft.subject,
  );

  assert.equal(
    chainedContext.previousOutbound.body,
    acceptedPriorDraft.body,
  );

  assert.notEqual(
    chainedContext.previousOutbound.body,
    outreach.body,
  );

  // --------------------------------------------------------
  // 8. ACCEPTED attempt without usable stored draft:
  // safe fallback to actual initial outbound.
  // --------------------------------------------------------

  let fallbackContext: any = null;

  const fallbackFollowUp =
    prepareBacklinkOutreachFollowUpDraft({
      ...baseDeps,

      getAttempt: async () => laterAttempt,

      listAttempts: async () => [
        {
          id: "initial-attempt",
          outreach_id: outreachId,
          attempt_kind: "initial",
          status: "accepted",
          created_at: "2026-08-27T09:00:00.000Z",
        },
        {
          id: "attempt-1",
          outreach_id: outreachId,
          attempt_kind: "follow_up",
          status: "accepted",
          created_at: "2026-09-18T10:00:00.000Z",
        },
        laterAttempt,
      ],

      getDraft: async () => null,

      generateAiDraft: async (input: any) => {
        fallbackContext = input;

        return {
          proposal: {
            subject: "Re: Research methodology",
            body:
              "Hi Skift Research team,\\n\\n" +
              "One final follow-up.\\n\\n" +
              "Best,\\nMohamed",
            tone: "professional",
            language: "en",
            approvalRequired: true as const,
            warnings: [],
          },
          providerId: "openai",
          model: "test-model",
          status: "success" as const,
        };
      },
    });

  await fallbackFollowUp({
    workspaceId,
    outreachId,
    attemptId: laterAttempt.id,
    actorUserId,
  });

  assert.equal(
    fallbackContext.previousOutbound.subject,
    outreach.subject,
  );

  assert.equal(
    fallbackContext.previousOutbound.body,
    outreach.body,
  );

  console.log(
    "PASS — contextual follow-up AI draft service smoke",
  );
  console.log(
    "PASS — actual previous outbound subject/body supplied to AI",
  );
  console.log(
    "PASS — existing canonical draft bypasses AI",
  );
  console.log(
    "PASS — missing previous message fails closed",
  );
  console.log(
    "PASS — AI failure does not persist draft",
  );
  console.log(
    "PASS — follow-up #1 and #2 contexts are distinct",
  );
  console.log(
    "PASS — latest accepted follow-up becomes previous outbound",
  );
  console.log(
    "PASS — missing accepted draft safely falls back to initial outbound",
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

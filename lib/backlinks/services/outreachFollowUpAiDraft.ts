import { executeMarketingAiRequest } from "../../marketing-ai/execution/executionEngine";

export type BacklinkOutreachFollowUpAiContext = {
  followUpNumber: number;
  campaign: {
    name: string;
    objective: string;
  };
  contact: {
    fullName: string | null;
    roleTitle: string | null;
  };
  domain: {
    hostname: string;
  };
  opportunity: {
    targetPageTitle: string;
    targetPageUrl: string;
    opportunityType: string;
    pageType: string;
    evidenceSummary: string;
  };
  asset: {
    displayName: string;
    canonicalUrl: string | null;
  };
  previousOutbound: {
    subject: string;
    body: string;
  };
};

export type BacklinkOutreachFollowUpAiProposal = {
  subject: string;
  body: string;
  tone: string;
  language: string;
  approvalRequired: true;
  warnings: string[];
};

export type BacklinkOutreachFollowUpAiExecutionResult = {
  proposal: BacklinkOutreachFollowUpAiProposal;
  providerId: string;
  model: string | null;
  status: "success";
};

export class BacklinkOutreachFollowUpAiError extends Error {
  constructor(
    public readonly code:
      | "CONTEXT_INVALID"
      | "PROPOSAL_INVALID"
      | "AI_EXECUTION_FAILED",
  ) {
    super(code);
    this.name = "BacklinkOutreachFollowUpAiError";
  }
}

function required(value: string): string {
  const normalized = value.trim();

  if (!normalized) {
    throw new BacklinkOutreachFollowUpAiError("CONTEXT_INVALID");
  }

  return normalized;
}

function optional(value: string | null): string | null {
  return value?.trim() || null;
}

export function normalizeBacklinkOutreachFollowUpAiContext(
  input: BacklinkOutreachFollowUpAiContext,
): BacklinkOutreachFollowUpAiContext {
  if (
    !Number.isInteger(input.followUpNumber) ||
    input.followUpNumber < 1
  ) {
    throw new BacklinkOutreachFollowUpAiError("CONTEXT_INVALID");
  }

  return {
    followUpNumber: input.followUpNumber,

    campaign: {
      name: required(input.campaign.name),
      objective: required(input.campaign.objective),
    },

    contact: {
      fullName: optional(input.contact.fullName),
      roleTitle: optional(input.contact.roleTitle),
    },

    domain: {
      hostname: required(input.domain.hostname),
    },

    opportunity: {
      targetPageTitle: required(input.opportunity.targetPageTitle),
      targetPageUrl: required(input.opportunity.targetPageUrl),
      opportunityType: required(input.opportunity.opportunityType),
      pageType: required(input.opportunity.pageType),
      evidenceSummary: required(input.opportunity.evidenceSummary),
    },

    asset: {
      displayName: required(input.asset.displayName),
      canonicalUrl: optional(input.asset.canonicalUrl),
    },

    previousOutbound: {
      subject: required(input.previousOutbound.subject),
      body: required(input.previousOutbound.body),
    },
  };
}

export function buildBacklinkOutreachFollowUpAiPrompt(
  input: BacklinkOutreachFollowUpAiContext,
): string {
  const context =
    normalizeBacklinkOutreachFollowUpAiContext(input);

  const followUpGuidance =
    context.followUpNumber >= 2
      ? "This is a later/final follow-up. Keep it shorter, respectful, and non-pushy."
      : "This is the first follow-up. Write a polite contextual reminder.";

  return [
    "You are drafting a follow-up email for Norixo backlink outreach.",
    "",
    "SAFETY AND ACCURACY RULES:",
    "- This is a draft only. Human approval is mandatory before sending.",
    "- Continue the ACTUAL previous outbound email supplied below.",
    "- Do not pretend that the recipient replied.",
    "- Do not invent any inbound message.",
    "- Never invent prior conversation facts.",
    "- Never invent facts about the recipient, organization, website, or Norixo.",
    "- Never claim that a backlink, placement, partnership, publication, payment, reciprocal link, agreement, acceptance, or interest exists unless explicitly present in the supplied context.",
    "- Use only the supplied context.",
    "- Do not repeat the entire original pitch.",
    "- Keep the follow-up concise, professional, natural, and human.",
    "- Avoid generic or mechanical outreach language.",
    "- Never expose internal campaign names, opportunity types, evidence summaries, database terminology, or automation terminology to the recipient.",
    "- Preserve the language of the previous outbound email unless the supplied context clearly requires otherwise.",
    "- Do not create fake personalization.",
    `- ${followUpGuidance}`,
    "",
    "OUTPUT CONTRACT:",
    "- Return JSON only.",
    '- Exact shape: {"subject":"...","body":"...","tone":"...","language":"...","approvalRequired":true,"warnings":[]}',
    "- subject MUST be non-empty and at most 300 characters.",
    "- body MUST be non-empty and at most 10000 characters.",
    "- approvalRequired MUST be true.",
    "- warnings MUST be an array of strings.",
    "- Do not wrap the JSON in markdown fences.",
    "",
    `Follow-up number: ${context.followUpNumber}`,
    "",
    "RECIPIENT CONTEXT:",
    `Contact name: ${context.contact.fullName ?? "unknown"}`,
    `Contact role: ${context.contact.roleTitle ?? "unknown"}`,
    `Domain: ${context.domain.hostname}`,
    "",
    "TARGET CONTEXT:",
    `Target page: ${context.opportunity.targetPageTitle}`,
    `Target URL: ${context.opportunity.targetPageUrl}`,
    `Page type: ${context.opportunity.pageType}`,
    `Evidence: ${context.opportunity.evidenceSummary}`,
    "",
    "NORIXO RESOURCE:",
    `Asset: ${context.asset.displayName}`,
    `Asset URL: ${context.asset.canonicalUrl ?? "none"}`,
    "",
    "ACTUAL PREVIOUS OUTBOUND EMAIL:",
    `Previous subject: ${context.previousOutbound.subject}`,
    "",
    "Previous body:",
    context.previousOutbound.body,
  ].join("\n");
}

export function parseBacklinkOutreachFollowUpAiProposal(
  output: string,
): BacklinkOutreachFollowUpAiProposal {
  let parsed: unknown;

  try {
    parsed = JSON.parse(output);
  } catch {
    throw new BacklinkOutreachFollowUpAiError(
      "PROPOSAL_INVALID",
    );
  }

  if (
    !parsed ||
    typeof parsed !== "object" ||
    Array.isArray(parsed)
  ) {
    throw new BacklinkOutreachFollowUpAiError(
      "PROPOSAL_INVALID",
    );
  }

  const candidate = parsed as Record<string, unknown>;

  if (
    typeof candidate.subject !== "string" ||
    !candidate.subject.trim() ||
    candidate.subject.trim().length > 300 ||
    typeof candidate.body !== "string" ||
    !candidate.body.trim() ||
    candidate.body.trim().length > 10000 ||
    typeof candidate.tone !== "string" ||
    !candidate.tone.trim() ||
    typeof candidate.language !== "string" ||
    !candidate.language.trim() ||
    candidate.approvalRequired !== true ||
    !Array.isArray(candidate.warnings) ||
    !candidate.warnings.every(
      (warning) => typeof warning === "string",
    )
  ) {
    throw new BacklinkOutreachFollowUpAiError(
      "PROPOSAL_INVALID",
    );
  }

  return {
    subject: candidate.subject.trim(),
    body: candidate.body.trim(),
    tone: candidate.tone.trim(),
    language: candidate.language.trim(),
    approvalRequired: true,
    warnings: candidate.warnings.map((warning) =>
      warning.trim(),
    ),
  };
}

export type BacklinkOutreachFollowUpAiDependencies = {
  executeAiRequest: typeof executeMarketingAiRequest;
};

const defaultDependencies: BacklinkOutreachFollowUpAiDependencies =
  {
    executeAiRequest: executeMarketingAiRequest,
  };

export async function generateBacklinkOutreachFollowUpAiDraft(
  input: BacklinkOutreachFollowUpAiContext,
  dependencies: BacklinkOutreachFollowUpAiDependencies =
    defaultDependencies,
): Promise<BacklinkOutreachFollowUpAiExecutionResult> {
  const prompt = buildBacklinkOutreachFollowUpAiPrompt(input);

  const result = await dependencies.executeAiRequest({
    agentId: "marketing-manager",
    providerId: "openai",
    model:
      process.env.OPENAI_MARKETING_AI_MODEL ??
      "gpt-4o-mini",
    input: prompt,
    capabilities: ["chat"],
    metadata: {
      feature: "backlink-outreach-follow-up-draft",
      followUpNumber: input.followUpNumber,
      approvalRequired: true,
    },
  });

  if (result.status !== "success" || !result.output) {
    throw new BacklinkOutreachFollowUpAiError(
      "AI_EXECUTION_FAILED",
    );
  }

  return {
    proposal: parseBacklinkOutreachFollowUpAiProposal(
      result.output,
    ),
    providerId: result.providerId,
    model: result.model,
    status: "success",
  };
}

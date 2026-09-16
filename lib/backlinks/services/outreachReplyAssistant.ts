import { executeMarketingAiRequest } from "../../marketing-ai/execution/executionEngine";

export type BacklinkOutreachReplyAssistantChannel =
  | "email"
  | "linkedin";

export type BacklinkOutreachReplyAssistantContext = {
  channel: BacklinkOutreachReplyAssistantChannel;

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

  inbound: {
    sender: string | null;
    subject: string | null;
    textBody: string;
  };
};

export type BacklinkOutreachReplyAssistantProposal = {
  reply: string;
  tone: string;
  language: string;
  approvalRequired: true;
  warnings: string[];
};

export type BacklinkOutreachReplyAssistantExecutionResult = {
  proposal: BacklinkOutreachReplyAssistantProposal;
  providerId: string;
  model: string | null;
  status: "success";
};

export class BacklinkOutreachReplyAssistantError extends Error {
  constructor(
    public readonly code:
      | "INBOUND_REPLY_REQUIRED"
      | "CONTEXT_INVALID"
      | "PROPOSAL_INVALID"
      | "AI_EXECUTION_FAILED",
  ) {
    super(code);
    this.name = "BacklinkOutreachReplyAssistantError";
  }
}

function required(
  value: string,
  code: "INBOUND_REPLY_REQUIRED" | "CONTEXT_INVALID",
): string {
  const normalized = value.trim();

  if (!normalized) {
    throw new BacklinkOutreachReplyAssistantError(code);
  }

  return normalized;
}

export function normalizeBacklinkOutreachReplyAssistantContext(
  input: BacklinkOutreachReplyAssistantContext,
): BacklinkOutreachReplyAssistantContext {
  return {
    ...input,

    campaign: {
      name: required(input.campaign.name, "CONTEXT_INVALID"),
      objective: required(input.campaign.objective, "CONTEXT_INVALID"),
    },

    contact: {
      fullName: input.contact.fullName?.trim() || null,
      roleTitle: input.contact.roleTitle?.trim() || null,
    },

    domain: {
      hostname: required(input.domain.hostname, "CONTEXT_INVALID"),
    },

    opportunity: {
      targetPageTitle: required(
        input.opportunity.targetPageTitle,
        "CONTEXT_INVALID",
      ),
      targetPageUrl: required(
        input.opportunity.targetPageUrl,
        "CONTEXT_INVALID",
      ),
      opportunityType: required(
        input.opportunity.opportunityType,
        "CONTEXT_INVALID",
      ),
      pageType: required(
        input.opportunity.pageType,
        "CONTEXT_INVALID",
      ),
      evidenceSummary: required(
        input.opportunity.evidenceSummary,
        "CONTEXT_INVALID",
      ),
    },

    asset: {
      displayName: required(input.asset.displayName, "CONTEXT_INVALID"),
      canonicalUrl: input.asset.canonicalUrl?.trim() || null,
    },

    inbound: {
      sender: input.inbound.sender?.trim() || null,
      subject: input.inbound.subject?.trim() || null,
      textBody: required(
        input.inbound.textBody,
        "INBOUND_REPLY_REQUIRED",
      ),
    },
  };
}

export function buildBacklinkOutreachReplyAssistantPrompt(
  input: BacklinkOutreachReplyAssistantContext,
): string {
  const context = normalizeBacklinkOutreachReplyAssistantContext(input);

  return [
    "You are drafting a proposed reply for Norixo backlink outreach.",
    "",
    "SAFETY AND ACCURACY RULES:",
    "- This is a draft only. Human approval is mandatory before sending.",
    "- Never claim that this reply has been sent.",
    "- Never claim that a backlink, partnership, publication, payment, reciprocal link, placement, or agreement has been accepted unless that fact is explicitly present in the supplied context.",
    "- Never invent prior conversation facts.",
    "- Never invent facts about the recipient, organization, website, or Norixo.",
    "- Never promise payment or reciprocal linking unless explicitly present in the supplied context.",
    "- Use only the supplied context.",
    "- Respond to the actual inbound message rather than repeating the initial outreach pitch.",
    "- Respect rejection or lack of interest without pressure.",
    "- Preserve the language used by the inbound message unless the supplied context clearly requires another language.",
    "- Keep the reply concise, professional, natural, and human.",
    "",
    "OUTPUT CONTRACT:",
    "- Return JSON only.",
    '- Exact shape: {"reply":"...","tone":"...","language":"...","approvalRequired":true,"warnings":[]}',
    "- approvalRequired MUST be true.",
    "- warnings MUST be an array of strings.",
    "- Do not wrap the JSON in markdown fences.",
    "",
    `Channel: ${context.channel}`,
    "",
    `Campaign: ${context.campaign.name}`,
    `Campaign objective: ${context.campaign.objective}`,
    "",
    `Contact name: ${context.contact.fullName ?? "unknown"}`,
    `Contact role: ${context.contact.roleTitle ?? "unknown"}`,
    `Domain: ${context.domain.hostname}`,
    "",
    `Target page: ${context.opportunity.targetPageTitle}`,
    `Target URL: ${context.opportunity.targetPageUrl}`,
    `Opportunity type: ${context.opportunity.opportunityType}`,
    `Page type: ${context.opportunity.pageType}`,
    `Evidence: ${context.opportunity.evidenceSummary}`,
    "",
    `Asset: ${context.asset.displayName}`,
    `Asset URL: ${context.asset.canonicalUrl ?? "none"}`,
    "",
    `Inbound sender: ${context.inbound.sender ?? "unknown"}`,
    `Inbound subject: ${context.inbound.subject ?? "none"}`,
    "",
    "Inbound message:",
    context.inbound.textBody,
  ].join("\n");
}

export function parseBacklinkOutreachReplyAssistantProposal(
  output: string,
): BacklinkOutreachReplyAssistantProposal {
  let parsed: unknown;

  try {
    parsed = JSON.parse(output);
  } catch {
    throw new BacklinkOutreachReplyAssistantError("PROPOSAL_INVALID");
  }

  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new BacklinkOutreachReplyAssistantError("PROPOSAL_INVALID");
  }

  const candidate = parsed as Record<string, unknown>;

  if (
    typeof candidate.reply !== "string" ||
    !candidate.reply.trim() ||
    typeof candidate.tone !== "string" ||
    !candidate.tone.trim() ||
    typeof candidate.language !== "string" ||
    !candidate.language.trim() ||
    candidate.approvalRequired !== true ||
    !Array.isArray(candidate.warnings) ||
    !candidate.warnings.every((warning) => typeof warning === "string")
  ) {
    throw new BacklinkOutreachReplyAssistantError("PROPOSAL_INVALID");
  }

  return {
    reply: candidate.reply.trim(),
    tone: candidate.tone.trim(),
    language: candidate.language.trim(),
    approvalRequired: true,
    warnings: candidate.warnings.map((warning) => warning.trim()),
  };
}

export type BacklinkOutreachReplyAssistantDependencies = {
  executeAiRequest: typeof executeMarketingAiRequest;
};

const defaultBacklinkOutreachReplyAssistantDependencies: BacklinkOutreachReplyAssistantDependencies = {
  executeAiRequest: executeMarketingAiRequest,
};

export async function generateBacklinkOutreachReplyAssistantProposal(
  input: BacklinkOutreachReplyAssistantContext,
  dependencies: BacklinkOutreachReplyAssistantDependencies =
    defaultBacklinkOutreachReplyAssistantDependencies,
): Promise<BacklinkOutreachReplyAssistantExecutionResult> {
  const prompt = buildBacklinkOutreachReplyAssistantPrompt(input);

  const result = await dependencies.executeAiRequest({
    agentId: "marketing-manager",
    providerId: "openai",
    model: process.env.OPENAI_MARKETING_AI_MODEL ?? "gpt-4o-mini",
    input: prompt,
    capabilities: ["chat"],
    metadata: {
      feature: "backlink-outreach-reply-assistant",
      channel: input.channel,
      approvalRequired: true,
    },
  });

  if (result.status !== "success" || !result.output) {
    throw new BacklinkOutreachReplyAssistantError("AI_EXECUTION_FAILED");
  }

  return {
    proposal: parseBacklinkOutreachReplyAssistantProposal(result.output),
    providerId: result.providerId,
    model: result.model,
    status: "success",
  };
}

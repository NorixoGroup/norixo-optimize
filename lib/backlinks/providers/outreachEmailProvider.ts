import { Resend } from "resend";

export type OutreachEmailSendInput = {
  to: string;
  subject: string;
  body: string;
  idempotencyKey: string;
};

export type OutreachEmailSendResult = {
  status: "accepted" | "failed" | "unknown";
  provider: "resend";
  providerMessageId: string | null;
  errorCode: string | null;
  errorMessage: string | null;
};

type ResendEmailResponse = {
  data: { id: string } | null;
  error: { name: string; statusCode: number | null; message: string } | null;
};

export type OutreachEmailProviderDependencies = {
  apiKey: string | undefined;
  from: string | undefined;
  replyTo: string | undefined;
  send?: (
    payload: { from: string; replyTo: string; to: string; subject: string; text: string },
    options: { idempotencyKey: string },
  ) => Promise<ResendEmailResponse>;
};

function result(
  status: OutreachEmailSendResult["status"],
  errorCode: string | null = null,
  errorMessage: string | null = null,
  providerMessageId: string | null = null,
): OutreachEmailSendResult {
  return {
    status,
    provider: "resend",
    providerMessageId,
    errorCode,
    errorMessage,
  };
}

function normalizeRequired(value: string): string | null {
  const normalized = value.trim();
  return normalized || null;
}

function normalizeProviderError(error: NonNullable<ResendEmailResponse["error"]>): OutreachEmailSendResult {
  if (error.statusCode === 429 || error.name === "rate_limit_exceeded") {
    return result("failed", "OUTREACH_EMAIL_RATE_LIMITED", "The email provider rate limit was reached.");
  }
  if (error.statusCode != null && error.statusCode >= 400 && error.statusCode < 500) {
    return result("failed", "OUTREACH_EMAIL_PROVIDER_REJECTED", "The email provider rejected the message.");
  }
  return result("unknown", "OUTREACH_EMAIL_PROVIDER_AMBIGUOUS", "The email provider result is ambiguous.");
}

export function createOutreachEmailProvider(
  dependencies: OutreachEmailProviderDependencies,
) {
  return async (input: OutreachEmailSendInput): Promise<OutreachEmailSendResult> => {
    const apiKey = normalizeRequired(dependencies.apiKey ?? "");
    const from = normalizeRequired(dependencies.from ?? "");
    const replyTo = normalizeRequired(dependencies.replyTo ?? "");
    if (!apiKey || !from || !replyTo) {
      return result(
        "failed",
        "OUTREACH_EMAIL_CONFIGURATION_MISSING",
        "Outreach email configuration is incomplete.",
      );
    }

    const to = normalizeRequired(input.to);
    const subject = normalizeRequired(input.subject);
    const body = normalizeRequired(input.body);
    const idempotencyKey = normalizeRequired(input.idempotencyKey);
    if (!to || !subject || !body || !idempotencyKey) {
      return result(
        "failed",
        "OUTREACH_EMAIL_INPUT_INVALID",
        "Outreach email input is invalid.",
      );
    }

    const send =
      dependencies.send ??
      ((payload, options) => new Resend(apiKey).emails.send(payload, options));

    try {
      const response = await send(
        { from, replyTo, to, subject, text: body },
        { idempotencyKey },
      );
      if (response.error != null) {
        return normalizeProviderError(response.error);
      }
      if (!response.data?.id) {
        return result(
          "unknown",
          "OUTREACH_EMAIL_PROVIDER_MESSAGE_ID_MISSING",
          "The email provider accepted an ambiguous result.",
        );
      }
      return result("accepted", null, null, response.data.id);
    } catch {
      return result(
        "unknown",
        "OUTREACH_EMAIL_PROVIDER_UNREACHABLE",
        "The email provider could not be reached.",
      );
    }
  };
}

export function createEnvironmentOutreachEmailProvider() {
  return createOutreachEmailProvider({
    apiKey: process.env.RESEND_API_KEY,
    from: process.env.OUTREACH_EMAIL_FROM,
    replyTo: process.env.OUTREACH_EMAIL_REPLY_TO,
  });
}

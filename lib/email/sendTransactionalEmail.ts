import { Resend } from "resend";

const resendApiKey = process.env.RESEND_API_KEY;
const fromEmail = process.env.RESEND_FROM_EMAIL ?? "Norixo <support@norixo.io>";

const resend = resendApiKey ? new Resend(resendApiKey) : null;

export async function sendTransactionalEmail(params: {
  to: string | null | undefined;
  subject: string;
  html: string;
  text?: string;
}) {
  if (!params.to) {
    console.warn("[email] skipped_missing_recipient", { subject: params.subject });
    return { ok: false, skipped: true as const };
  }

  if (!resend) {
    console.warn("[email] skipped_missing_resend_api_key", { to: params.to, subject: params.subject });
    return { ok: false, skipped: true as const };
  }

  try {
    const result = await resend.emails.send({
      from: fromEmail,
      to: params.to,
      subject: params.subject,
      html: params.html,
      text: params.text,
    });

    if (result.error) {
      console.error("[email] send_failed", {
        to: params.to,
        subject: params.subject,
        error: result.error,
      });
      return { ok: false, error: result.error };
    }

    console.info("[email] sent", {
      to: params.to,
      subject: params.subject,
      id: result.data?.id ?? null,
    });

    return { ok: true, id: result.data?.id ?? null };
  } catch (error) {
    console.error("[email] send_exception", {
      to: params.to,
      subject: params.subject,
      error,
    });
    return { ok: false, error };
  }
}

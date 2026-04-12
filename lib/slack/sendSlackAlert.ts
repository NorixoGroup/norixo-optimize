type SlackAlertPayload = {
  title: string;
  workspaceName?: string | null;
  workspaceId?: string | null;
  planCode?: string | null;
  subscriptionStatus?: string | null;
  paymentsCount?: number | null;
  totalRevenue?: number | null;
  billingStatus?: string | null;
  lastPaymentAt?: string | null;
  lastActivityAt?: string | null;
};

function formatEuro(value?: number | null): string {
  if (typeof value !== "number" || Number.isNaN(value)) return "—";
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
  }).format(value);
}

export async function sendSlackAlert(payload: SlackAlertPayload) {
  const webhookUrl = process.env.SLACK_ALERT_WEBHOOK_URL;

  if (!webhookUrl) {
    console.warn("[slack-alert] Missing SLACK_ALERT_WEBHOOK_URL");
    return;
  }

  const body = {
    text: `${payload.title} — ${payload.workspaceName ?? "Workspace inconnu"}`,
    blocks: [
      {
        type: "header",
        text: {
          type: "plain_text",
          text: payload.title,
        },
      },
      {
        type: "section",
        fields: [
          {
            type: "mrkdwn",
            text: `*Workspace*\n${payload.workspaceName ?? "—"}`,
          },
          {
            type: "mrkdwn",
            text: `*Plan*\n${payload.planCode ?? "—"}`,
          },
          {
            type: "mrkdwn",
            text: `*Subscription status*\n${payload.subscriptionStatus ?? "—"}`,
          },
          {
            type: "mrkdwn",
            text: `*Billing status*\n${payload.billingStatus ?? "—"}`,
          },
          {
            type: "mrkdwn",
            text: `*Payments count*\n${payload.paymentsCount ?? 0}`,
          },
          {
            type: "mrkdwn",
            text: `*Total revenue*\n${formatEuro(payload.totalRevenue)}`,
          },
        ],
      },
      {
        type: "context",
        elements: [
          {
            type: "mrkdwn",
            text: `workspace_id: ${payload.workspaceId ?? "—"}`,
          },
          {
            type: "mrkdwn",
            text: `last_payment_at: ${payload.lastPaymentAt ?? "—"}`,
          },
          {
            type: "mrkdwn",
            text: `last_activity_at: ${payload.lastActivityAt ?? "—"}`,
          },
        ],
      },
    ],
  };

  const res = await fetch(webhookUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
    cache: "no-store",
  });

  if (!res.ok) {
    const retryAfter = res.headers.get("retry-after");
    const text = await res.text().catch(() => "");

    throw new Error(
      `[slack-alert] Failed: ${res.status} ${res.statusText} ${
        retryAfter ? `(Retry-After: ${retryAfter})` : ""
      } ${text}`
    );
  }
}
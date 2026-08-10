import { readFile } from "node:fs/promises";
function assert(value: unknown, message: string): asserts value { if (!value) throw new Error(message); }
async function main() {
  const [page, dialog] = await Promise.all([readFile("app/(default)/dashboard/backlinks/page.tsx", "utf8"), readFile("app/(default)/dashboard/backlinks/_components/OutreachSendDialog.tsx", "utf8")]);
  const actionStart = page.indexOf("function outreachSendAction");
  const action = page.slice(actionStart, page.indexOf("type VerifyLinkResponse", actionStart));
  const sendStart = page.indexOf("const handleSendOutreachEmail");
  const send = page.slice(sendStart, page.indexOf("const reloadOutreachAttemptHistory", sendStart));
  const payloadStart = send.indexOf("JSON.stringify({");
  const payload = send.slice(payloadStart, send.indexOf("})", payloadStart) + 2);
  for (const value of ['row.status !== "ready" || row.channel !== "email"', "summary == null", "summary.hasOpenAttempt", '"resolution_required"', '"send_in_progress"', 'summary.latestStatus === null', 'summary.latestStatus === "failed"']) assert(action.includes(value), `Missing retry state: ${value}`);
  for (const value of ["action === \"failed_retry\" ? \"Nouvelle tentative\" : \"Envoyer\"", "Nouvelle tentative", "Envoi en cours", "Résolution requise", "setOutreachSendMode(action)", "setOutreachSendIdempotencyKey(crypto.randomUUID())"]) assert(page.includes(value), `Missing action wiring: ${value}`);
  for (const value of ["OutreachSendDialog", 'mode={outreachSendMode}', "Nouvelle tentative d’envoi", "L’envoi précédent a échoué. Cette action déclenchera un nouvel email."]) assert(page.includes(value) || dialog.includes(value), `Missing dialog retry content: ${value}`);
  for (const value of ["outreachSendSubmitting", "JSON.stringify({ confirm: true, idempotencyKey: outreachSendIdempotencyKey })", "response.result.disposition === \"failed\"", "response.result.attemptStatus === \"unknown\"", "await loadDashboard()", "An outreach send attempt is already in progress.", "Resolve the uncertain outreach attempt before sending again.", "setOutreachSendIdempotencyKey(null)", 'setOutreachSendMode("initial_send")']) assert(send.includes(value) || page.includes(value), `Missing send lifecycle: ${value}`);
  for (const forbidden of ["sendMode", "previousAttemptId", "failedAttemptId", "workspaceId", "actorUserId", "provider", "recipient", "subject", "body", "status"]) assert(!payload.includes(forbidden), `Forbidden Send payload field: ${forbidden}`);
  for (const forbidden of ["/resolve", "crypto.randomUUID", "Retry", "Resend", "outreachEmailProvider", "follow-up", "scheduler"]) assert(!send.includes(forbidden), `Forbidden retry behavior: ${forbidden}`);
  console.log("PASS — Backlink outreach failed retry UI smoke");
}
void main();

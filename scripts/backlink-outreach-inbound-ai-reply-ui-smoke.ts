import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

async function main() {
  const [page, dialog] = await Promise.all([
    readFile("app/(default)/dashboard/backlinks/page.tsx", "utf8"),
    readFile(
      "app/(default)/dashboard/backlinks/_components/OutreachInboundRepliesDialog.tsx",
      "utf8",
    ),
  ]);

  for (const value of [
    "handleGenerateInboundReplyAiProposal",
    "inboundReplyAiSubmittingMessageId",
    "inboundReplyAiProposalMessageId",
    "inboundReplyAiProposal",
    "inboundReplyAiError",
    "/inbound/${messageId}/reply-assistant",
    'method: "POST"',
    "setInboundReplyAiProposal",
    "onRequestAiProposal",
  ]) {
    assert(page.includes(value), `Missing page invariant: ${value}`);
  }

  for (const value of [
    "Proposer une réponse avec l’IA",
    "Génération…",
    "aiProposal.reply",
    "aiProposal.language",
    "aiProposal.tone",
    "aiProposal.warnings",
    "Proposition uniquement — vérifiez-la avant de répondre.",
  ]) {
    assert(dialog.includes(value), `Missing dialog invariant: ${value}`);
  }

  const start = page.indexOf("const handleGenerateInboundReplyAiProposal");
  const end = page.indexOf(
    "const handleConfirmInboundReplyClassification",
    start,
  );

  assert(start >= 0 && end > start, "AI reply handler missing");

  const handler = page.slice(start, end);

  for (const forbidden of [
    "/send",
    "sendEmail",
    "sendMessage",
    "resend",
    "linkedin",
    ".insert(",
    ".update(",
    ".delete(",
    "classification:",
    "loadDashboard()",
  ]) {
    assert(
      !handler.includes(forbidden),
      `Forbidden AI reply side effect: ${forbidden}`,
    );
  }

  for (const forbidden of [
    "fetch(",
    "apiRequest",
    "/api/",
    "sendEmail",
    "sendMessage",
    "dangerouslySetInnerHTML",
  ]) {
    assert(
      !dialog.includes(forbidden),
      `Dialog must remain presentational: ${forbidden}`,
    );
  }

  console.log("PASS — Backlink inbound AI reply proposal UI smoke");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

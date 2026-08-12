import { readFile } from "node:fs/promises";

function assert(value: unknown, message: string): asserts value { if (!value) throw new Error(message); }

async function main() {
  const [service, page] = await Promise.all([
    readFile("lib/backlinks/services/outreachService.ts", "utf8"),
    readFile("app/(default)/dashboard/backlinks/page.tsx", "utf8"),
  ]);
  const pageFollowUpBlockStart = page.indexOf("function outreachFollowUpSummary");
  const pageFollowUpBlock = page.slice(pageFollowUpBlockStart, page.indexOf("function outreachSendAction", pageFollowUpBlockStart));
  const outreachRowStart = page.indexOf('if (section === "outreach")');
  const outreachRowBlock = page.slice(outreachRowStart, page.indexOf('if (section === "links")', outreachRowStart));

  for (const value of [
    "type BacklinkOutreachFollowUpSummary",
    "followUpSummary: BacklinkOutreachFollowUpSummary",
    "buildFollowUpSummary",
    "state: \"scheduled\"",
    "state: \"due\"",
    "state: \"prepared\"",
    "state: \"requested\"",
    "state: \"unknown\"",
    "state: \"final_response\"",
    "nextFollowUpAt",
    "responseDeadlineAt",
    "attemptId",
    "Promise.all",
  ]) assert(service.includes(value), `Missing follow-up summary service invariant: ${value}`);

  for (const value of [
    "type OutreachFollowUpSummary",
    "function outreachFollowUpSummary",
    "followUpSummary",
  ]) assert(page.includes(value), `Missing follow-up summary UI invariant: ${value}`);

  for (const value of [
    "Relance",
    "Relance prévue",
    "Relance due",
    "Relance préparée",
    "Envoi en cours",
    "Résultat d’envoi à vérifier",
    "En attente de réponse",
    "Délai de réponse expiré",
  ]) assert(pageFollowUpBlock.includes(value) || outreachRowBlock.includes(value), `Missing follow-up summary UI invariant: ${value}`);

  console.log("PASS — Backlink outreach follow-up summary smoke");
}

void main();

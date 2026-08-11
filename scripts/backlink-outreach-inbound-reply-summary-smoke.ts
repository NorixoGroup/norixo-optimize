import { readFile } from "node:fs/promises";
async function main() { const source = await readFile("lib/backlinks/repositories/outreachInboundReplyClassificationsRepository.ts", "utf8"); for (const value of ["listBacklinkOutreachInboundReplySummariesForOutreachIds", '.in("outreach_id", outreachIds)', "correlatedCount", "unclassifiedCount", "latestReceivedAt", "classified.has(message.id) ? 0 : 1"]) if (!source.includes(value)) throw new Error(`Missing ${value}`); console.log("PASS — Backlink inbound reply summary smoke"); }
void main();

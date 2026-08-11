import { readFile } from "node:fs/promises";
async function main() { const source = await readFile("lib/backlinks/services/outreachService.ts", "utf8"); for (const value of ["attemptSummary", "inboundReplySummary", "Promise.all", "listBacklinkOutreachAttemptSummariesForOutreachIds", "listBacklinkOutreachInboundReplySummariesForOutreachIds", "correlatedCount: 0", "unclassifiedCount: 0"]) if (!source.includes(value)) throw new Error(`Missing ${value}`); console.log("PASS — Backlink Outreach list inbound reply summary smoke"); }
void main();

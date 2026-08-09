import { readFile } from "node:fs/promises";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

async function main(): Promise<void> {
  const migration = await readFile("supabase/migrations/20260810091000_add_backlink_outreach_draft_content.sql", "utf8");
  const databaseTypes = await readFile("types/database.types.ts", "utf8");
  const repository = await readFile("lib/backlinks/repositories/outreachRepository.ts", "utf8");
  const service = await readFile("lib/backlinks/services/outreachService.ts", "utf8");
  for (const value of ["add column if not exists subject text", "add column if not exists body text"]) assert(migration.includes(value), `Missing ${value}.`);
  assert(!migration.includes("not null"), "Draft content must remain nullable for historical outreach.");
  for (const value of ["body: string | null", "subject: string | null", "body?: string | null", "subject?: string | null"]) assert(databaseTypes.includes(value), `Missing ${value}.`);
  assert(repository.includes('BacklinkInsert<"backlink_outreach">'), "Repository must derive create fields from database types.");
  assert(service.includes("createOutreach") && service.includes("updateOutreach"), "CRUD service must continue to forward outreach fields.");
  for (const forbidden of ["template", "openai", "send", "fetch(", "email provider"]) assert(!migration.toLowerCase().includes(forbidden), `Forbidden ${forbidden}.`);
  console.log("PASS — Backlink outreach draft content smoke");
}

void main();

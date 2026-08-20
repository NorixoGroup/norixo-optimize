import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

async function main(): Promise<void> {
  const [migration, types, repository, service] = await Promise.all([
    readFile("supabase/migrations/20260817010000_add_backlink_outreach_acquisition_snapshot.sql", "utf8"),
    readFile("types/database.types.ts", "utf8"),
    readFile("lib/backlinks/repositories/outreachRepository.ts", "utf8"),
    readFile("lib/backlinks/services/outreachLifecycleService.ts", "utf8"),
  ]);

  for (const value of [
    "add column if not exists success_link_id uuid references public.backlink_links(id) on delete restrict",
    "add column if not exists success_link_status text",
    "add column if not exists success_verified_at timestamptz",
    "add column if not exists success_source_url text",
    "add column if not exists success_target_url text",
    "constraint backlink_outreach_success_acquisition_snapshot_check",
    "success_link_status = 'active'",
    "success_verified_at is not null",
    "char_length(trim(coalesce(success_source_url, ''))) > 0",
    "char_length(trim(coalesce(success_target_url, ''))) > 0",
    "success_link_id = v_active_link.id",
    "success_link_status = v_active_link.status",
    "success_verified_at = v_active_link.last_verified_at",
    "success_source_url = v_active_link.source_url",
    "success_target_url = v_active_link.target_url",
  ]) {
    assert(migration.includes(value), `Missing acquisition snapshot invariant: ${value}`);
  }

  for (const forbidden of ["success_verification_evidence", "verification_evidence =", "legacy snapshot backfill", "update public.backlink_links"]) {
    assert(!migration.toLowerCase().includes(forbidden.toLowerCase()), `Forbidden acquisition snapshot behavior: ${forbidden}`);
  }

  for (const value of [
    "success_link_id: string | null",
    "success_link_status: string | null",
    "success_verified_at: string | null",
    "success_source_url: string | null",
    "success_target_url: string | null",
    "backlink_outreach_success_link_id_fkey",
    "referencedRelation: \"backlink_links\"",
  ]) {
    assert(types.includes(value), `Missing acquisition snapshot type: ${value}`);
  }

  for (const value of [
    "ApplyBacklinkOutreachBacklinkObtainedRpcRow",
    "previous_status",
    "outreach_status: \"closed\"",
    "last_response_type: \"positive\"",
    "closed_at: string",
    "stop_reason: \"backlink_obtained\"",
    "next_follow_up_at: string | null",
    "response_deadline_at: string | null",
  ]) {
    assert(repository.includes(value), `Missing repository contract invariant: ${value}`);
  }

  for (const value of [
    "mark_backlink_obtained",
  ]) {
    assert(service.includes(value), `Missing service invariant: ${value}`);
  }

  for (const value of [
    "select *\n  into v_active_link\n  from public.backlink_links as link_source",
    "order by link_source.acquired_at desc, link_source.id asc",
    "success_link_id = v_active_link.id",
  ]) {
    assert(migration.includes(value), `Missing migration invariant: ${value}`);
  }

  console.info("PASS — Backlink outreach acquisition snapshot smoke");
}

void main();

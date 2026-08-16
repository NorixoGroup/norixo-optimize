import { readFile } from "node:fs/promises";
function assert(v: unknown,m:string):asserts v{if(!v)throw new Error(m)}
async function main(){const s=await readFile("app/api/backlinks/outreach/[id]/lifecycle/route.ts","utf8");for(const v of["export async function POST","getRequestUserAndWorkspace(request)",'auth.status === "unauthenticated"','auth.status === "workspace_forbidden"',"isAdminPrivateEmail(auth.user.email)","body.confirm !== true","body.action","Object.keys(body)","mark_replied","open_conversation","mark_backlink_obtained","decline","mark_no_response","pause","close","positive","negative","neutral","bounced","unsubscribed","workspaceId: auth.workspace.id","actorUserId: auth.user.id","outreachId: id","transitionBacklinkOutreachLifecycle","createSupabaseAdminClient","applyBacklinkOutreachBacklinkObtained","{ ok: true, result }"])assert(s.includes(v),`Missing ${v}`);for(const v of["outreachEmailProvider","outreachEmailSendService","sendTransactionalEmail","Resend","outreachAttemptsRepository","outreachAttemptService","body.workspaceId","body.actorUserId","body.status","body.idempotencyKey"])assert(!s.includes(v),`Forbidden ${v}`);
  const migration = await readFile("supabase/migrations/20260816050000_fix_backlink_outreach_backlink_obtained_ambiguous_references.sql","utf8");
  for (const v of [
    "from public.backlink_outreach as outreach_source",
    "where outreach_source.id = p_outreach_id",
    "and outreach_source.workspace_id = p_workspace_id",
    "from public.backlink_links as link_source",
    "and link_source.outreach_id = p_outreach_id",
    "order by link_source.acquired_at desc, link_source.id asc",
    "update public.backlink_outreach as outreach_update",
    "where outreach_update.id = v_outreach.id",
  ]) assert(migration.includes(v), `Missing migration guard: ${v}`);
  for (const forbidden of ["where outreach_id = p_outreach_id", "and outreach_id = p_outreach_id", "order by acquired_at desc, id asc"]) assert(!migration.includes(forbidden), `Ambiguous reference still present: ${forbidden}`);
  console.log("PASS — Backlink outreach manual lifecycle route smoke")};void main();

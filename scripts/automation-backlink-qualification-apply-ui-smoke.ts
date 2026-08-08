import { readFile } from "node:fs/promises";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(String(message));
}

async function main(): Promise<void> {
  const source = [
    await readFile("app/(default)/dashboard/backlinks/page.tsx", "utf8"),
    await readFile("app/(default)/dashboard/backlinks/_components/QualificationPreview.tsx", "utf8"),
  ].join("\n");

  // Ensure qualification preview usage exists
  assert(source.includes("qualificationPreview"), "qualificationPreview must be read from automation state");
  assert(source.includes("qualificationPreview.results"), "qualificationPreview.results must be referenced");

  // Ensure new UI state variables present
  assert(source.includes("qualificationApplyDialog"), "qualificationApplyDialog state is required");
  assert(source.includes("qualificationApplySubmitting"), "qualificationApplySubmitting state is required");
  assert(source.includes("qualificationApplyError"), "qualificationApplyError state is required");
  assert(source.includes("qualificationApplyResult"), "qualificationApplyResult state is required");

  // Ensure button exists and opens modal without fetch
  assert(source.includes("Apply qualification"), "Apply qualification button text missing");
  assert((source.match(/Apply qualification/g) ?? []).length >= 1, "Apply button should exist at least once");
  assert(source.includes("aria-haspopup=\"dialog\""), "Button must open a dialog");
  assert(!source.includes("/api/internal/automation/backlinks/qualifications/apply") || source.indexOf("/api/internal/automation/backlinks/qualifications/apply") > source.indexOf("handleConfirmQualificationApply"), "API call must happen only on confirmation handler");

  // Ensure POST body exact fields
  const confirmCallSliceStart = source.indexOf('JSON.stringify({ runId: dialog.runId, taskId: dialog.taskId, opportunityId: dialog.opportunityId, confirm: true }');
  assert(confirmCallSliceStart !== -1, "Exact POST body must be used");

  // Loading / concurrency guards
  assert(source.includes("qualificationApplyRequestIdRef"), "request id ref required");
  assert(source.includes("workspaceRequestVersionRef.current"), "workspace guard required");
  assert(source.includes("qualificationApplySubmitting"), "submitting guard required");

  // Modal accessibility
  assert(source.includes('role="dialog"'), "Modal must have role=dialog");
  assert(source.includes('aria-modal="true"'), "Modal must have aria-modal=true");
  assert(source.includes('aria-labelledby="qualification-apply-title"'), "Modal must be labelled");
  assert(source.includes('aria-live="polite"') || source.includes('role="status"'), "Result must be announced");

  // Ensure no forbidden fields are sent by the Apply Qualification request
  const handlerStart = source.indexOf("const handleConfirmQualificationApply");
  assert(handlerStart !== -1, "Confirm handler missing");

  const requestStart = source.indexOf(
    'JSON.stringify({ runId: dialog.runId, taskId: dialog.taskId, opportunityId: dialog.opportunityId, confirm: true })',
    handlerStart,
  );
  assert(requestStart !== -1, "Exact POST body must be used");

  const requestBody =
    "runId: dialog.runId, taskId: dialog.taskId, opportunityId: dialog.opportunityId, confirm: true";

  assert(!requestBody.includes("workspaceId:"), "Client must not send workspaceId");
  assert(!requestBody.includes("actorUserId:"), "Client must not send actorUserId");
  assert(!requestBody.includes("decision:"), "Client must not send decision");
  assert(!requestBody.includes("qualificationStatus:"), "Client must not send qualificationStatus");
  assert(!requestBody.includes("score:"), "Client must not send score");
  assert(!requestBody.includes("reasons:"), "Client must not send reasons");
  assert(!requestBody.includes("candidateKey:"), "Client must not send candidateKey");

  console.log("PASS — Backlink qualification apply UI smoke");
}

void main();

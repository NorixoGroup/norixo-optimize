import {
  applyBacklinkOutreachScheduleReconciliationAutomation,
  BacklinkOutreachScheduleApplyError,
  type ApplyBacklinkOutreachScheduleReconciliationAutomationDependencies,
} from "../lib/backlinks/services/outreachScheduleApplyService";

function assert(condition: boolean, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

async function main(): Promise<void> {
  const workspaceId = "00000000-0000-4000-8000-000000000001";
  const requestedContact = "00000000-0000-4000-8000-000000000010";
  const selectedCandidates = [
    {
      id: "00000000-0000-4000-8000-000000000101",
      workspace_id: workspaceId,
      contact_id: requestedContact,
      status: "active",
      channel: "email",
      current_attempt: 1,
      max_attempts: 3,
      last_attempt_at: "2026-08-05T10:00:00.000Z",
      next_follow_up_at: null,
      response_deadline_at: null,
    },
    {
      id: "00000000-0000-4000-8000-000000000102",
      workspace_id: workspaceId,
      contact_id: requestedContact,
      status: "active",
      channel: "email",
      current_attempt: 2,
      max_attempts: 4,
      last_attempt_at: "2026-08-05T10:00:00.000Z",
      next_follow_up_at: "2026-08-12T10:00:00.000Z",
      response_deadline_at: null,
    },
    {
      id: "00000000-0000-4000-8000-000000000103",
      workspace_id: workspaceId,
      contact_id: requestedContact,
      status: "active",
      channel: "email",
      current_attempt: 2,
      max_attempts: 4,
      last_attempt_at: "2026-08-05T10:00:00.000Z",
      next_follow_up_at: "2026-08-10T10:00:00.000Z",
      response_deadline_at: null,
    },
    {
      id: "00000000-0000-4000-8000-000000000104",
      workspace_id: workspaceId,
      contact_id: requestedContact,
      status: "draft",
      channel: "email",
      current_attempt: 1,
      max_attempts: 3,
      last_attempt_at: "2026-08-05T10:00:00.000Z",
      next_follow_up_at: null,
      response_deadline_at: null,
    },
    {
      id: "00000000-0000-4000-8000-000000000105",
      workspace_id: workspaceId,
      contact_id: "00000000-0000-4000-8000-000000000020",
      status: "active",
      channel: "email",
      current_attempt: 1,
      max_attempts: 3,
      last_attempt_at: "2026-08-05T10:00:00.000Z",
      next_follow_up_at: null,
      response_deadline_at: null,
    },
    {
      id: "00000000-0000-4000-8000-000000000106",
      workspace_id: workspaceId,
      contact_id: requestedContact,
      status: "active",
      channel: "email",
      current_attempt: 1,
      max_attempts: 3,
      last_attempt_at: "2026-08-05T10:00:00.000Z",
      next_follow_up_at: null,
      response_deadline_at: null,
    },
    {
      id: "00000000-0000-4000-8000-000000000107",
      workspace_id: workspaceId,
      contact_id: requestedContact,
      status: "active",
      channel: "email",
      current_attempt: 1,
      max_attempts: 3,
      last_attempt_at: "2026-08-05T10:00:00.000Z",
      next_follow_up_at: null,
      response_deadline_at: null,
    },
    {
      id: "00000000-0000-4000-8000-000000000108",
      workspace_id: workspaceId,
      contact_id: requestedContact,
      status: "active",
      channel: "email",
      current_attempt: 1,
      max_attempts: 3,
      last_attempt_at: "2026-08-05T10:00:00.000Z",
      next_follow_up_at: null,
      response_deadline_at: null,
    },
  ] as const;

  let reconcileCalls = 0;
  const dependencies: ApplyBacklinkOutreachScheduleReconciliationAutomationDependencies = {
    getWorkspaceControl: async (workspace) => ({
      workspaceId: workspace,
      backlinksEnabled: true,
      backlinkOutreachScheduleApplyEnabled: workspace === workspaceId,
      dryRunOnly: true,
      disabledReason: null,
      createdAt: "2026-08-05T10:00:00.000Z",
      updatedAt: "2026-08-05T10:00:00.000Z",
    }),
    listCandidates: async (_workspace, limit) => {
      assert(limit === 100, "Default apply limit must be 100.");
      return selectedCandidates.map((candidate) => ({ ...candidate }));
    },
    getLatestAttempt: async (_workspace, outreachId) => {
      if (outreachId === "00000000-0000-4000-8000-000000000105") {
        return { status: "accepted" };
      }
      if (outreachId === "00000000-0000-4000-8000-000000000106") {
        return { status: "accepted" };
      }
      if (outreachId === "00000000-0000-4000-8000-000000000107") {
        return { status: "accepted" };
      }
      if (outreachId === "00000000-0000-4000-8000-000000000108") {
        return { status: "accepted" };
      }
      return { status: "accepted" };
    },
    getOpenAttempt: async (_workspace, outreachId) => {
      if (outreachId === "00000000-0000-4000-8000-000000000106") {
        return { status: "requested" };
      }
      return null;
    },
    getContact: async (_workspace, contactId) => {
      if (contactId === "00000000-0000-4000-8000-000000000020") {
        return { contact_status: "do_not_contact", email_normalized: "guest@example.com" };
      }
      return { contact_status: "verified", email_normalized: "guest@example.com" };
    },
    hasInboundReplyStopEffect: async (_workspace, outreachId) =>
      outreachId === "00000000-0000-4000-8000-000000000107",
    reconcileSchedule: async (_workspace, outreachId, input) => {
      reconcileCalls += 1;
      if (outreachId === "00000000-0000-4000-8000-000000000108") {
        throw new Error("rpc failure");
      }
      if (outreachId === "00000000-0000-4000-8000-000000000101") {
        return {
          disposition: reconcileCalls === 1 ? "scheduled" : "existing",
          kind: input.scheduleKind,
          scheduledAt: input.scheduledAt,
          nextFollowUpAt: input.scheduleKind === "follow_up" ? input.scheduledAt : null,
          responseDeadlineAt: input.scheduleKind === "final_response" ? input.scheduledAt : null,
        };
      }
      return {
        disposition: "existing",
        kind: input.scheduleKind,
        scheduledAt: input.scheduledAt,
        nextFollowUpAt: input.scheduleKind === "follow_up" ? input.scheduledAt : null,
        responseDeadlineAt: input.scheduleKind === "final_response" ? input.scheduledAt : null,
      };
    },
  };

  const service = applyBacklinkOutreachScheduleReconciliationAutomation(dependencies, {
    workspaceId,
    limit: 100,
  });

  const first = await service;
  assert(first.scanned === 7, "Apply must scan the selectable outreach batch.");
  assert(first.scheduled === 1, "Apply must schedule one candidate.");
  assert(first.existing === 1, "Apply must keep one existing candidate.");
  assert(first.notApplicable === 3, "Apply must skip ineligible candidates.");
  assert(first.conflicts === 1, "Apply must count schedule conflicts.");
  assert(first.failed === 1, "Apply must isolate one failed candidate.");
  assert(first.items.some((item) => item.outreachId === "00000000-0000-4000-8000-000000000101" && item.disposition === "scheduled"), "Scheduled item missing.");
  assert(first.items.some((item) => item.outreachId === "00000000-0000-4000-8000-000000000102" && item.disposition === "existing"), "Existing item missing.");
  assert(first.items.some((item) => item.outreachId === "00000000-0000-4000-8000-000000000103" && item.disposition === "conflict"), "Conflict item missing.");
  assert(first.items.some((item) => item.outreachId === "00000000-0000-4000-8000-000000000105" && item.disposition === "not_applicable"), "Contact DNC item missing.");
  assert(first.items.some((item) => item.outreachId === "00000000-0000-4000-8000-000000000106" && item.disposition === "not_applicable"), "Open attempt item missing.");
  assert(first.items.some((item) => item.outreachId === "00000000-0000-4000-8000-000000000107" && item.disposition === "not_applicable"), "Inbound stop item missing.");
  assert(first.items.some((item) => item.outreachId === "00000000-0000-4000-8000-000000000108" && item.disposition === "failed"), "Failed item missing.");
  assert(!first.items.some((item) => item.outreachId === "00000000-0000-4000-8000-000000000104"), "Draft outreach must not be selected.");

  const repeat = await applyBacklinkOutreachScheduleReconciliationAutomation(dependencies, {
    workspaceId,
    limit: 100,
  });
  assert(
    repeat.items.some((item) => item.outreachId === "00000000-0000-4000-8000-000000000101" && item.disposition === "existing"),
    "Repeat apply must be existing for a previously scheduled item.",
  );

  await (async () => {
    try {
      await applyBacklinkOutreachScheduleReconciliationAutomation(
        {
          ...dependencies,
          getWorkspaceControl: async () => ({
            workspaceId,
            backlinksEnabled: true,
            backlinkOutreachScheduleApplyEnabled: false,
            dryRunOnly: true,
            disabledReason: null,
            createdAt: "2026-08-05T10:00:00.000Z",
            updatedAt: "2026-08-05T10:00:00.000Z",
          }),
        },
        { workspaceId, limit: 100 },
      );
      throw new Error("expected capability rejection");
    } catch (error) {
      assert(error instanceof BacklinkOutreachScheduleApplyError && error.code === "APPLY_NOT_ENABLED", "Capability disabled must reject.");
    }
  })();

  console.log("PASS — Backlink outreach schedule apply service smoke");
}

void main();

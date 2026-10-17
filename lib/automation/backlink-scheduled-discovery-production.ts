import { createSupabaseAdminClient } from "@/lib/supabase-admin";

import { generateBacklinkDiscoveryQuerySuggestions } from "./backlink-discovery-query-generator";
import {
  SCHEDULED_DISCOVERY_WORKER_ID,
  isScheduledDiscoveryEnabled,
  type ScheduledDiscoveryDependencies,
} from "./backlink-scheduled-discovery";
import { readBraveBacklinkDiscoveryRuntimeConfig } from "./brave-backlink-discovery-config";
import { createAutomationProductionComposition } from "./production-composition";
import { getAutomationRunByKey } from "./repositories/automationRunsRepository";
import {
  listBacklinksEnabledWorkspaceIds,
  listRecentBacklinkDiscoveryQueries,
} from "./repositories/scheduledDiscoveryRepository";

const LEASE_DURATION_SECONDS = 120;
const MAX_WORKER_INVOCATIONS = 10;

/**
 * Production adapters. Every Brave request still passes through the database
 * reservation inside the production composition; nothing here searches directly.
 */
export function createScheduledDiscoveryProductionDependencies(): ScheduledDiscoveryDependencies {
  const client = createSupabaseAdminClient();
  const composition = createAutomationProductionComposition();

  return {
    isEnabled: () => isScheduledDiscoveryEnabled(),
    getBraveLimits: () => {
      const config = readBraveBacklinkDiscoveryRuntimeConfig();
      return config.enabled
        ? { maxSearchesPerRun: config.maxSearchesPerRun, maxResultsPerSearch: config.maxResultsPerSearch }
        : null;
    },
    listEligibleWorkspaceIds: (limit) => listBacklinksEnabledWorkspaceIds(client, limit),
    getRunByKey: (input) =>
      getAutomationRunByKey(client, {
        workspaceId: input.workspaceId,
        system: "backlinks",
        runKind: input.runKind,
        idempotencyKey: input.idempotencyKey,
      }),
    listRecentQueries: (input) => listRecentBacklinkDiscoveryQueries(client, input),
    generateQueries: generateBacklinkDiscoveryQuerySuggestions,
    runTick: (input) => {
      const at = new Date().toISOString();
      return composition.runBacklinksSchedulerTick({
        workspaceId: input.workspaceId,
        requestedBy: null,
        workerId: SCHEDULED_DISCOVERY_WORKER_ID,
        idempotencyKey: input.idempotencyKey,
        triggerSource: "scheduled",
        scheduledAt: input.scheduledAt,
        startedAt: at,
        attemptedAt: at,
        completedAt: at,
        failedAt: at,
        leaseDurationSeconds: LEASE_DURATION_SECONDS,
        maxWorkerInvocations: MAX_WORKER_INVOCATIONS,
        discoveryInput: input.discoveryInput,
        qualificationInput: { source: "scheduled", requestedScope: "preview" },
        promotionInput: { source: "automation_qualification", requestedScope: "preview" },
      });
    },
  };
}

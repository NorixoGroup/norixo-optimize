import { createSupabaseAdminClient } from "@/lib/supabase-admin";

import { cancelAutomationTask, claimNextAutomationTask, completeAutomationTask, createOrGetAutomationTask, failAutomationTask, heartbeatAutomationTask, reclaimExpiredAutomationTasks } from "./repositories/automationTasksRepository";
import { dryRunAutomationTaskHandlers } from "./dry-run-handlers";
import type { AutomationTaskDependencies } from "./types";
import { executeAutomationWorkerOnce } from "./worker";
import type { ExecuteAutomationWorkerOnceInput, ExecuteAutomationWorkerOnceResult } from "./worker-types";

export function createAutomationProductionComposition(): {
  executeWorkerOnce: (
    input: ExecuteAutomationWorkerOnceInput,
  ) => Promise<ExecuteAutomationWorkerOnceResult>;
} {
  const client = createSupabaseAdminClient();
  const taskDependencies: AutomationTaskDependencies = {
    createOrGetTask: (input) => createOrGetAutomationTask(client, input),
    claimNextTask: (input) => claimNextAutomationTask(client, input),
    heartbeatTask: (input) => heartbeatAutomationTask(client, input),
    completeTask: (input) => completeAutomationTask(client, input),
    failTask: (input) => failAutomationTask(client, input),
    reclaimExpiredTasks: (input) => reclaimExpiredAutomationTasks(client, input),
    cancelTask: (input) => cancelAutomationTask(client, input),
  };

  return {
    executeWorkerOnce: (input) =>
      executeAutomationWorkerOnce(
        { ...taskDependencies, executeHandler: dryRunAutomationTaskHandlers.execute },
        input,
      ),
  };
}

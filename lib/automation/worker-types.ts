import type { AutomationTask, AutomationTaskDependencies, DeadLetterAutomationTaskDependencies } from "./types";
import type { AutomationTaskHandlerRegistry } from "./handler-registry";
export type ExecuteAutomationWorkerOnceInput={workspaceId:string;runId:string;workerId:string;claimedAt:string;attemptedAt:string;leaseDurationSeconds:number};
export type ExecuteClaimedDiscoveryTaskInput=ExecuteAutomationWorkerOnceInput&{task:AutomationTask};
export type ExecuteAutomationWorkerOnceDependencies=AutomationTaskDependencies&DeadLetterAutomationTaskDependencies&{executeHandler:AutomationTaskHandlerRegistry["execute"]};
export type ExecuteAutomationWorkerOnceResult={kind:"empty"}|{kind:"completed";task:AutomationTask;output:AutomationTask["output"]}|{kind:"retried";task:AutomationTask}|{kind:"dead_letter";task:AutomationTask};
export type ExecuteClaimedDiscoveryTaskResult=Exclude<ExecuteAutomationWorkerOnceResult,{kind:"empty"}>|{kind:"rejected";reason:"claimed_task_invariant"};

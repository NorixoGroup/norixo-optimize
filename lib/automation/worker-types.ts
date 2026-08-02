import type { AutomationTask, AutomationTaskDependencies } from "./types";
import type { AutomationTaskHandlerRegistry } from "./handler-registry";
export type ExecuteAutomationWorkerOnceInput={workspaceId:string;runId:string;workerId:string;claimedAt:string;attemptedAt:string;leaseDurationSeconds:number};
export type ExecuteAutomationWorkerOnceDependencies=AutomationTaskDependencies&{executeHandler:AutomationTaskHandlerRegistry["execute"]};
export type ExecuteAutomationWorkerOnceResult={kind:"empty"}|{kind:"completed";task:AutomationTask;output:AutomationTask["output"]}|{kind:"retried";task:AutomationTask}|{kind:"dead_letter";task:AutomationTask};

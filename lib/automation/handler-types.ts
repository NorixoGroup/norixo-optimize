import type { Json } from "@/types/database.types";
import type { AutomationTask } from "./types";
export type AutomationDryRunTaskKind = "noop" | "backlinks.discovery.preview" | "backlinks.qualification.preview" | "backlinks.promotion.preview" | "backlinks.campaign.preview";
export type ExecuteAutomationTaskHandlerInput = { workspaceId:string; runId:string; taskId:string; taskKind:AutomationDryRunTaskKind; input:Record<string,Json|undefined>; attemptedAt:string; task?:AutomationTask };
export type ExecuteAutomationTaskHandlerResult = { output:Record<string,Json> };
export type AutomationTaskHandler = (input:ExecuteAutomationTaskHandlerInput)=>Promise<ExecuteAutomationTaskHandlerResult>;

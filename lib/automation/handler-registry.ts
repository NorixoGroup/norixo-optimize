import type { AutomationTaskHandler, AutomationDryRunTaskKind, ExecuteAutomationTaskHandlerInput, ExecuteAutomationTaskHandlerResult } from "./handler-types";
export type AutomationTaskHandlerRegistry={execute:(input:ExecuteAutomationTaskHandlerInput)=>Promise<ExecuteAutomationTaskHandlerResult>};
export function createAutomationTaskHandlerRegistry(handlers:Record<AutomationDryRunTaskKind,AutomationTaskHandler>):AutomationTaskHandlerRegistry{return{execute:input=>handlers[input.taskKind](input)}}

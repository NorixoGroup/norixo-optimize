import { createAutomationTaskHandlerRegistry } from "./handler-registry";
export const dryRunAutomationTaskHandlers=createAutomationTaskHandlerRegistry({
  noop:async()=>({output:{kind:"noop",dryRun:true}}),
  "backlinks.discovery.preview":async i=>({output:{kind:"backlinks.discovery.preview",dryRun:true,candidateCount:0,sourceCount:Array.isArray(i.input.sources)?i.input.sources.length:Object.keys(i.input).length}}),
  "backlinks.qualification.preview":async i=>({output:{kind:"backlinks.qualification.preview",dryRun:true,evaluatedCount:Array.isArray(i.input.candidates)?i.input.candidates.length:Object.keys(i.input).length,qualifiedCount:0}}),
});

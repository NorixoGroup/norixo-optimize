import { readFile } from "node:fs/promises";
function assert(c:boolean,m:string):asserts c{if(!c)throw new Error(m)}
async function main(){const s=await readFile("lib/automation/production-composition.ts","utf8");for(const x of ["export function createAutomationProductionComposition", "const client = createSupabaseAdminClient()", "executeWorkerOnce:", "executeAutomationWorkerOnce", "claimNextAutomationTask", "completeAutomationTask", "failAutomationTask", "dryRunAutomationTaskHandlers.execute"])assert(s.includes(x),x);assert(!s.includes("setInterval")&&!s.includes("setTimeout")&&!s.includes("fetch("),"no runtime side effects");console.log("PASS — Automation production composition smoke")}
void main();

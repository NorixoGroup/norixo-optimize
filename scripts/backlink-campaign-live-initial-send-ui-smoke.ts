import { readFile } from "node:fs/promises";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

async function main(): Promise<void> {
  const componentPath = "app/(default)/dashboard/backlinks/_components/CampaignLiveInitialSendGate.tsx";
  const pagePath = "app/(default)/dashboard/backlinks/page.tsx";
  const [component, page] = await Promise.all([readFile(componentPath, "utf8"), readFile(pagePath, "utf8")]);

  for (const value of ["campaignId", "campaignKey", "campaignName", "enabled", "request", "onChanged", 'type="checkbox"', "checked={enabled}"]) {
    assert(component.includes(value), `Missing gate control contract: ${value}`);
  }
  assert(component.includes("setEnableConfirmationOpen(true)"), "U3: enabling must open confirmation");
  const enableHandlerStart = component.indexOf("const handleChange");
  const enableHandlerEnd = component.indexOf("return (", enableHandlerStart);
  const enableHandler = component.slice(enableHandlerStart, enableHandlerEnd);
  assert(!enableHandler.includes("request<"), "U4: opening confirmation must make zero PATCH calls");
  assert(enableHandler.includes("void persist(false);"), "U8: disabling must call persist(false)");
  assert(enableHandler.indexOf("void persist(false);") > enableHandler.indexOf("if (nextEnabled)"), "U8: persist(false) must be outside the enable-confirmation branch");
  const cancelButtonStart = component.indexOf('<button type="button" onClick={() => setEnableConfirmationOpen(false)}');
  const cancelButtonEnd = component.indexOf("</button>", cancelButtonStart);
  assert(cancelButtonStart >= 0 && cancelButtonEnd > cancelButtonStart, "U5: Cancel button handler missing");
  const cancelButton = component.slice(cancelButtonStart, cancelButtonEnd);
  assert(cancelButton.includes("Annuler"), "U5: Cancel button label missing");
  assert(!cancelButton.includes("persist("), "U5: Cancel must not persist");
  assert(!cancelButton.includes("request"), "U5: Cancel must not request");
  assert(!cancelButton.includes("onChanged"), "U5: Cancel must not notify parent");
  const confirmLabelIndex = component.indexOf("Activer les envois live");
  const confirmButtonStart = component.lastIndexOf("<button", confirmLabelIndex);
  const confirmButton = component.slice(confirmButtonStart, confirmLabelIndex);
  assert(confirmButton.includes("onClick={() => void persist(true)}"), "U6/U7: Confirm must call persist(true)");
  assert(component.includes("if (submitting) return;"), "U12: duplicate submissions must be guarded");
  assert(component.includes("disabled={submitting}"), "U12: controls must be disabled while submitting");

  const persistStart = component.indexOf("const persist");
  const persistEnd = component.indexOf("const handleChange", persistStart);
  const persist = component.slice(persistStart, persistEnd);
  assert(persist.includes("/api/backlinks/campaigns/${campaignId}/live-initial-send"), "U6/U8: dedicated gate endpoint missing");
  assert(persist.includes('method: "PATCH"'), "U6/U8: dedicated request must use PATCH");
  assert(persist.includes("JSON.stringify({ liveInitialSendEnabled: nextEnabled })"), "U7/U9: request body must contain only liveInitialSendEnabled");
  const requestIndex = persist.indexOf("await request<GateResponse>");
  const onChangedIndex = persist.indexOf("await onChanged(campaignId, nextEnabled)");
  assert(requestIndex >= 0 && onChangedIndex > requestIndex, "U16: onChanged must occur only after request success");
  assert(persist.includes("setError("), "U10/U11: failures must set gate-specific error");
  const catchStart = persist.indexOf("} catch (requestError)");
  const finallyStart = persist.indexOf("} finally", catchStart);
  assert(catchStart >= 0 && finallyStart > catchStart, "U10/U11: bounded failure branch missing");
  const failureBranch = persist.slice(catchStart, finallyStart);
  assert(!failureBranch.includes("onChanged"), "U10/U11: failure must not notify parent");
  assert(!/set(?:Enabled|GateEnabled|LiveInitialSendEnabled)\s*\(/.test(component), "U10/U11: component must not own persisted gate state");
  assert(!/useState(?:<[^>]+>)?\(\s*enabled\s*\)/.test(component), "U10/U11: component must not initialize local persisted enabled state");
  assert(!/set(?:Enabled|GateEnabled|LiveInitialSendEnabled)\s*\(/.test(failureBranch), "U10/U11: failure must not mutate persisted gate state");
  assert(component.includes('role="alert"'), "U10/U11: error must be announced");

  for (const forbidden of ["/api/backlinks/campaigns/${campaignId}`", "/api/backlinks/outreach/", "handleSendOutreach", "handleReapprove", "reserve_", "provider", "scheduler"]) {
    assert(!component.includes(forbidden), `U13–U15: forbidden gate dependency: ${forbidden}`);
  }

  assert(page.includes('import CampaignLiveInitialSendGate from "./_components/CampaignLiveInitialSendGate";'), "Parent must import the gate component");
  const gateIndex = page.indexOf("<CampaignLiveInitialSendGate");
  const membershipsIndex = page.indexOf("Opportunités associées");
  assert(gateIndex >= 0 && gateIndex < membershipsIndex, "Gate must render in the campaign editor before associated opportunities");
  const parentSlice = page.slice(gateIndex, membershipsIndex);
  for (const value of ["campaignId={String(editor.row.id)}", "campaignKey={String(editor.row.campaign_key ?? editor.row.id)}", "campaignName={String(editor.row.name ?? editor.row.id)}", "enabled={editor.row.live_initial_send_enabled === true}", "request={apiRequest}"]) {
    assert(parentSlice.includes(value), `Parent gate wiring missing: ${value}`);
  }
  for (const forbidden of ["handleSendOutreach", "handleReapproveOutreach"]) {
    assert(!parentSlice.includes(forbidden), `Parent must not pass ${forbidden}`);
  }

  console.log("PASS — Campaign live initial send gate UI smoke");
}

void main();

import {
  recordBacklinkManualLinkedInInitialContact,
  type RecordBacklinkManualLinkedInInitialContactInput,
  type RecordBacklinkManualLinkedInInitialContactResult,
  type RecordBacklinkManualLinkedInInitialContactRpcClient,
} from "@/lib/backlinks/repositories/outreachAttemptsRepository";

export type RecordManualLinkedInInitialContactContext = RecordBacklinkManualLinkedInInitialContactInput;

export async function recordManualLinkedInInitialContact(
  client: RecordBacklinkManualLinkedInInitialContactRpcClient,
  context: RecordManualLinkedInInitialContactContext,
): Promise<RecordBacklinkManualLinkedInInitialContactResult> {
  return recordBacklinkManualLinkedInInitialContact(client, context);
}

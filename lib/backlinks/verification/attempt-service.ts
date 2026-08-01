import { buildBacklinkVerificationAttempt } from "./attempt-mapper";
import type {
  BacklinkVerificationAttempt,
  RecordBacklinkVerificationAttemptDependencies,
  RecordBacklinkVerificationAttemptInput,
} from "./attempt-types";

export async function recordBacklinkVerificationAttempt(
  input: RecordBacklinkVerificationAttemptInput,
  dependencies: RecordBacklinkVerificationAttemptDependencies,
): Promise<BacklinkVerificationAttempt> {
  return dependencies.createAttempt(buildBacklinkVerificationAttempt(input));
}

import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { readFileSync } from "node:fs";
import {
  LinkedInTokenCryptoError,
  decryptLinkedInAccessToken,
  encryptLinkedInAccessToken,
  readLinkedInTokenEncryptionConfig,
} from "../lib/marketing-ai/linkedin/linkedinTokenCrypto";
import {
  buildLinkedInConnectionCredentialPatch,
  decryptStoredLinkedInAccessToken,
} from "../lib/marketing-ai/linkedin/linkedinConnectionStore";

const testEnv = {
  LINKEDIN_TOKEN_ENCRYPTION_KEY: randomBytes(32).toString("base64"),
  LINKEDIN_TOKEN_ENCRYPTION_KEY_VERSION: "test-v1",
};
const config = readLinkedInTokenEncryptionConfig(testEnv);
const syntheticToken = "synthetic-linkedin-token";

function expectCryptoFailure(action: () => unknown) {
  assert.throws(action, LinkedInTokenCryptoError);
}

const first = encryptLinkedInAccessToken(syntheticToken, config);
const second = encryptLinkedInAccessToken(syntheticToken, config);
assert.equal(decryptLinkedInAccessToken(first, config), syntheticToken);
assert.notEqual(first.ciphertext, second.ciphertext);
assert.notEqual(first.iv, second.iv);
expectCryptoFailure(() => readLinkedInTokenEncryptionConfig({}));
expectCryptoFailure(() => readLinkedInTokenEncryptionConfig({
  LINKEDIN_TOKEN_ENCRYPTION_KEY: Buffer.alloc(31).toString("base64"),
  LINKEDIN_TOKEN_ENCRYPTION_KEY_VERSION: "test-v1",
}));
expectCryptoFailure(() => decryptLinkedInAccessToken(first, readLinkedInTokenEncryptionConfig({
  LINKEDIN_TOKEN_ENCRYPTION_KEY: randomBytes(32).toString("base64"),
  LINKEDIN_TOKEN_ENCRYPTION_KEY_VERSION: "test-v1",
})));
expectCryptoFailure(() => decryptLinkedInAccessToken({ ...first, ciphertext: second.ciphertext }, config));
expectCryptoFailure(() => decryptLinkedInAccessToken({ ...first, authTag: second.authTag }, config));
expectCryptoFailure(() => decryptLinkedInAccessToken({ ...first, keyVersion: "unknown" }, config));

const previousEnv = {
  key: process.env.LINKEDIN_TOKEN_ENCRYPTION_KEY,
  keyVersion: process.env.LINKEDIN_TOKEN_ENCRYPTION_KEY_VERSION,
};
process.env.LINKEDIN_TOKEN_ENCRYPTION_KEY = testEnv.LINKEDIN_TOKEN_ENCRYPTION_KEY;
process.env.LINKEDIN_TOKEN_ENCRYPTION_KEY_VERSION = testEnv.LINKEDIN_TOKEN_ENCRYPTION_KEY_VERSION;
const patch = buildLinkedInConnectionCredentialPatch(syntheticToken);
assert.equal(patch.access_token, null);
assert.notEqual(patch.access_token_ciphertext, syntheticToken);
assert.equal(decryptStoredLinkedInAccessToken(patch), syntheticToken);
assert.equal(decryptStoredLinkedInAccessToken({
  access_token_ciphertext: null,
  access_token_iv: null,
  access_token_auth_tag: null,
  access_token_key_version: null,
}), null);
assert.equal(decryptStoredLinkedInAccessToken({ ...patch, access_token_auth_tag: null }), null);
if (previousEnv.key === undefined) delete process.env.LINKEDIN_TOKEN_ENCRYPTION_KEY;
else process.env.LINKEDIN_TOKEN_ENCRYPTION_KEY = previousEnv.key;
if (previousEnv.keyVersion === undefined) delete process.env.LINKEDIN_TOKEN_ENCRYPTION_KEY_VERSION;
else process.env.LINKEDIN_TOKEN_ENCRYPTION_KEY_VERSION = previousEnv.keyVersion;

const storeSource = readFileSync("lib/marketing-ai/linkedin/linkedinConnectionStore.ts", "utf8");
const statusSource = readFileSync("app/api/admin/marketing-studio/linkedin/status/route.ts", "utf8");
const publishSource = readFileSync("app/api/admin/marketing-studio/linkedin/publish-post/route.ts", "utf8");
const callbackSource = readFileSync("app/api/admin/marketing-studio/linkedin/callback/route.ts", "utf8");
assert(!storeSource.includes('"provider,status,access_token,'));
assert.equal((storeSource.match(/\.eq\("workspace_id", scopedWorkspaceId\)/g) ?? []).length, 2);
assert(statusSource.includes("readLinkedInConnectionStatus"));
assert(!statusSource.includes("access_token_ciphertext"));
assert(publishSource.lastIndexOf("readLinkedInConnectionForPublish") < publishSource.indexOf("publishLinkedInTextPost("));
assert(publishSource.includes("if (!linkedInConnection || linkedInConnection.status !== \"connected\")"));
assert(callbackSource.includes("workspaceId: callbackBinding.workspaceId"));

console.log("PASS — LinkedIn token encryption focused tests");

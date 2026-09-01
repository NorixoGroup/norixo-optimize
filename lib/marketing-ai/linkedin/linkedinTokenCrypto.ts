import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

const KEY_ENV_NAME = "LINKEDIN_TOKEN_ENCRYPTION_KEY";
const KEY_VERSION_ENV_NAME = "LINKEDIN_TOKEN_ENCRYPTION_KEY_VERSION";
const IV_BYTES = 12;
const AUTH_TAG_BYTES = 16;

export type LinkedInTokenEncryptionConfig = {
  key: Buffer;
  keyVersion: string;
};

type TokenEncryptionEnvironment = Record<string, string | undefined>;

export type EncryptedLinkedInAccessToken = {
  ciphertext: string;
  iv: string;
  authTag: string;
  keyVersion: string;
};

export class LinkedInTokenCryptoError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "LinkedInTokenCryptoError";
  }
}

function decodeBase64(value: string, field: string): Buffer {
  if (!value || value.length % 4 !== 0 || !/^[A-Za-z0-9+/]+={0,2}$/.test(value)) {
    throw new LinkedInTokenCryptoError(`Invalid ${field}.`);
  }

  const decoded = Buffer.from(value, "base64");
  if (!decoded.length || decoded.toString("base64") !== value) {
    throw new LinkedInTokenCryptoError(`Invalid ${field}.`);
  }

  return decoded;
}

export function readLinkedInTokenEncryptionConfig(
  env: TokenEncryptionEnvironment = process.env,
): LinkedInTokenEncryptionConfig {
  const encodedKey = env[KEY_ENV_NAME]?.trim() ?? "";
  const keyVersion = env[KEY_VERSION_ENV_NAME]?.trim() ?? "";

  if (!encodedKey || !keyVersion) {
    throw new LinkedInTokenCryptoError("LinkedIn token encryption is not configured.");
  }

  const key = decodeBase64(encodedKey, "LinkedIn token encryption key");
  if (key.length !== 32) {
    throw new LinkedInTokenCryptoError("Invalid LinkedIn token encryption key.");
  }

  return { key, keyVersion };
}

export function encryptLinkedInAccessToken(
  accessToken: string,
  config: LinkedInTokenEncryptionConfig = readLinkedInTokenEncryptionConfig(),
): EncryptedLinkedInAccessToken {
  if (!accessToken) {
    throw new LinkedInTokenCryptoError("LinkedIn access token is required.");
  }

  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv("aes-256-gcm", config.key, iv);
  const ciphertext = Buffer.concat([cipher.update(accessToken, "utf8"), cipher.final()]);

  return {
    ciphertext: ciphertext.toString("base64"),
    iv: iv.toString("base64"),
    authTag: cipher.getAuthTag().toString("base64"),
    keyVersion: config.keyVersion,
  };
}

export function decryptLinkedInAccessToken(
  encrypted: EncryptedLinkedInAccessToken,
  config: LinkedInTokenEncryptionConfig = readLinkedInTokenEncryptionConfig(),
): string {
  if (!encrypted.keyVersion || encrypted.keyVersion !== config.keyVersion) {
    throw new LinkedInTokenCryptoError("Unsupported LinkedIn token encryption key version.");
  }

  const ciphertext = decodeBase64(encrypted.ciphertext, "LinkedIn token ciphertext");
  const iv = decodeBase64(encrypted.iv, "LinkedIn token IV");
  const authTag = decodeBase64(encrypted.authTag, "LinkedIn token authentication tag");
  if (iv.length !== IV_BYTES || authTag.length !== AUTH_TAG_BYTES) {
    throw new LinkedInTokenCryptoError("Invalid LinkedIn encrypted credential.");
  }

  try {
    const decipher = createDecipheriv("aes-256-gcm", config.key, iv);
    decipher.setAuthTag(authTag);
    const plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString("utf8");
    if (!plaintext) {
      throw new LinkedInTokenCryptoError("Invalid LinkedIn encrypted credential.");
    }
    return plaintext;
  } catch (error) {
    if (error instanceof LinkedInTokenCryptoError) {
      throw error;
    }
    throw new LinkedInTokenCryptoError("LinkedIn encrypted credential authentication failed.");
  }
}

export function isLinkedInEncryptedCredentialUsable(
  encrypted: EncryptedLinkedInAccessToken | null,
  config: LinkedInTokenEncryptionConfig = readLinkedInTokenEncryptionConfig(),
): boolean {
  if (!encrypted) {
    return false;
  }

  try {
    if (encrypted.keyVersion !== config.keyVersion) {
      return false;
    }
    const iv = decodeBase64(encrypted.iv, "LinkedIn token IV");
    const authTag = decodeBase64(encrypted.authTag, "LinkedIn token authentication tag");
    return Boolean(decodeBase64(encrypted.ciphertext, "LinkedIn token ciphertext").length) && iv.length === IV_BYTES && authTag.length === AUTH_TAG_BYTES;
  } catch {
    return false;
  }
}

import { secretByteLength } from "@/features/access/domain/access-policy";
import {
  randomValueSchema,
  secretHashSchema,
  secretTokenSchema,
  type SecretHash,
  type SecretToken,
} from "@/features/access/domain/secret";
import { decodeBase64Url, encodeBase64Url } from "@/shared/domain/base64url";

import type { Secrets } from "./secrets";

export function newRandomValue(secrets: Secrets): string {
  return randomValueSchema.parse(encodeBase64Url(secrets.randomBytes(secretByteLength)));
}

export function newSecretToken(secrets: Secrets): SecretToken {
  return secretTokenSchema.parse(newRandomValue(secrets));
}

export async function hashSecretToken(secrets: Secrets, token: SecretToken): Promise<SecretHash> {
  return secretHashSchema.parse(encodeBase64Url(await secrets.sha256(decodeBase64Url(token))));
}

// Hashes the presented token and compares the hashes in constant time
export async function secretTokenMatches(
  secrets: Secrets,
  token: SecretToken,
  hash: SecretHash,
): Promise<boolean> {
  const presented = await secrets.sha256(decodeBase64Url(token));

  return secrets.equalInConstantTime(presented, decodeBase64Url(hash));
}

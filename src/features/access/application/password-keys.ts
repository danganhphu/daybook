import { digestByteLength, passwordSaltByteLength } from "@/features/access/domain/access-policy";
import {
  passwordSaltSchema,
  passwordVerifierSchema,
  type DerivedKey,
  type PasswordSalt,
  type PasswordVerifier,
} from "@/features/access/domain/password";
import { base64UrlLength, decodeBase64Url, encodeBase64Url } from "@/shared/domain/base64url";

import type { Pepper } from "./peppers";
import type { Secrets } from "./secrets";

const utf8 = new TextEncoder();

// The browser runs Argon2id; the server keeps only HMAC-SHA256(pepper, key). Fast, because the slow part is already
// done, and the pepper is what a database thief lacks.
export async function verifierFor(
  secrets: Secrets,
  pepper: Pepper,
  key: DerivedKey,
): Promise<PasswordVerifier> {
  return passwordVerifierSchema.parse(
    encodeBase64Url(await secrets.hmacSha256(pepper.key, decodeBase64Url(key))),
  );
}

export async function keyMatches(
  secrets: Secrets,
  pepper: Pepper,
  key: DerivedKey,
  verifier: PasswordVerifier,
): Promise<boolean> {
  const presented = await secrets.hmacSha256(pepper.key, decodeBase64Url(key));

  return secrets.equalInConstantTime(presented, decodeBase64Url(verifier));
}

// The salt an unknown username gets: derived from the pepper and the name, so asking twice gives the same answer,
// as it would for a real account, and nothing reveals that no account is behind it
export async function decoySaltFor(
  secrets: Secrets,
  pepper: Pepper,
  username: string,
): Promise<PasswordSalt> {
  const digest = await secrets.hmacSha256(pepper.key, utf8.encode(`decoy-salt:${username}`));

  return passwordSaltSchema.parse(encodeBase64Url(digest.slice(0, passwordSaltByteLength)));
}

// What the per-username rate limit counts under: the typed name, keyed, so a password typed into the username box
// never sits in D1 (ASVS 16.2.5). 128 bits keep two names apart.
export async function usernameLimitKey(
  secrets: Secrets,
  pepper: Pepper,
  username: string,
): Promise<string> {
  const digest = await secrets.hmacSha256(pepper.key, utf8.encode(`rate-limit:${username}`));

  return encodeBase64Url(digest.slice(0, 16));
}

export function newPasswordSalt(secrets: Secrets): PasswordSalt {
  return passwordSaltSchema.parse(encodeBase64Url(secrets.randomBytes(passwordSaltByteLength)));
}

// A verifier no key can match, compared against when there is no password, so that path does the same work
export const unmatchableVerifier = passwordVerifierSchema.parse(
  "A".repeat(base64UrlLength(digestByteLength)),
);

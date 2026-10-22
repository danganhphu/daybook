import { deriveKey, normalizePassword } from "@/features/access/web/browser-password";
import type { Result } from "@/shared/domain/result";
import { attempt } from "@/shared/web/attempt";

import { completePasswordSignIn, preparePasswordSignIn } from "./actions";

// The salt first, then Argon2id here, then the key; the password itself never leaves the page. Used to sign in and,
// for an account with no passkey, to confirm again before a security setting.
export async function signInWithPassword(
  username: string,
  password: string,
): Promise<Result<null, string>> {
  const prompt = await attempt(() => preparePasswordSignIn(username));
  if (!prompt.ok) {
    return prompt;
  }

  const key = await deriveKey(
    normalizePassword(password),
    prompt.value.salt,
    prompt.value.parameters,
  );

  return attempt(() => completePasswordSignIn(key));
}

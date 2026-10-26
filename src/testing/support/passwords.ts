import { derivedKeyByteLength } from "@/features/access/domain/access-policy";
import type { Account } from "@/features/access/domain/account";
import type { PasskeyId } from "@/features/access/domain/passkey";
import { derivedKeySchema, type DerivedKey } from "@/features/access/domain/password";
import { webCryptoSecrets } from "@/features/access/infrastructure/web-crypto-secrets";
import { encodeBase64Url } from "@/shared/domain/base64url";

import { origin, rows, seedSession } from "./access";
import { testApp, type testClock } from "./app";
import { expectOk } from "./result";

// What the browser would send after Argon2id: the server cannot tell a random key from a derived one, and does not
// need to, so tests skip the slow part
export function aDerivedKey(): DerivedKey {
  return derivedKeySchema.parse(
    encodeBase64Url(webCryptoSecrets.randomBytes(derivedKeyByteLength)),
  );
}

// The account sets a fallback password through the app's own steps, as it would from its settings: signed in with its
// passkey when it has one, since a password sign-in would not count as a step-up there
export async function seedPassword(time: ReturnType<typeof testClock>, account: Account) {
  const app = testApp(time.clock);
  const [passkey] = await rows<{ id: PasskeyId }>(
    "select id from passkey where account_id = ? limit 1",
    account.id,
  );
  const { session } = await seedSession(
    time.clock,
    account,
    passkey === undefined ? {} : { passkey: passkey.id },
  );
  const prompt = expectOk(await app.beginPasswordChange(session));
  const key = aDerivedKey();
  expectOk(
    await app.finishPasswordChange(session, {
      ceremonyCookie: prompt.ceremonyCookie,
      key,
      origin: origin(),
    }),
  );

  return { key, salt: prompt.salt };
}

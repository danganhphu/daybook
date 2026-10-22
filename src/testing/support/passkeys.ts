import { parseCeremonyCookie } from "@/features/access/application/ceremony-cookie";

import { origin, seedAccount, seedSetupLink } from "./access";
import { relyingParty, testApp, type testClock } from "./app";
import { softwareAuthenticator } from "./authenticator";
import { expectOk } from "./result";

// Someone who went through setup: an account, the passkey on their phone, and the session setup opened
export async function seedPasskeyAccount(time: ReturnType<typeof testClock>, username = "lan") {
  const account = await seedAccount(time.clock, username);
  const { token } = await seedSetupLink(time.clock, {
    purpose: "first_setup",
    accountId: account.id,
  });
  const app = testApp(time.clock);
  const grant = expectOk(await app.redeemSetupLink(token, origin()));
  const options = expectOk(await app.startPasskeySetup(grant.cookie));
  const { response, passkey } = await anAuthenticator().create(options);
  const finished = expectOk(
    await app.finishPasskeySetup({
      ceremonyCookie: grant.cookie,
      response,
      origin: origin(),
      replacing: undefined,
    }),
  );

  return { account, passkey, stored: finished.passkey, session: finished.session };
}

// The ceremony a cookie names, for tests that forge the binding next to it
export function ceremonyIdIn(cookie: string) {
  const parsed = parseCeremonyCookie(cookie);
  if (parsed === undefined) {
    throw new Error(`Not a ceremony cookie: ${cookie}`);
  }

  return parsed.ceremonyId;
}

// A phone that answers for the test app's relying party
export function anAuthenticator() {
  return softwareAuthenticator({ origin: relyingParty.origin, rpId: relyingParty.id });
}

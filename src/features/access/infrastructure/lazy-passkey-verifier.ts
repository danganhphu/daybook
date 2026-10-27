import type { PasskeyVerifier } from "@/features/access/application/passkey-verifier";

import type { RelyingParty } from "./relying-party";
import { readAssertion } from "./webauthn-responses";

// The WebAuthn library and its ASN.1 stack load the first time a passkey is used, not with every cold start of the
// Worker, most of which only show a screen
export function createLazyPasskeyVerifier(relyingParty: RelyingParty): PasskeyVerifier {
  let loading: Promise<PasskeyVerifier> | undefined;
  const verifier = () =>
    (loading ??= import("./simple-webauthn-verifier").then((module) =>
      module.createSimpleWebAuthnVerifier(relyingParty),
    ));

  return {
    creationOptions: async (prompt) => (await verifier()).creationOptions(prompt),
    requestOptions: async (prompt) => (await verifier()).requestOptions(prompt),
    verifyRegistration: async (response, challenge) =>
      (await verifier()).verifyRegistration(response, challenge),
    readAssertion,
    verifyAssertion: async (response, challenge, passkey) =>
      (await verifier()).verifyAssertion(response, challenge, passkey),
  };
}

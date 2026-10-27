import type { Page } from "@playwright/test";

// A passkey made by the seed, as WebAuthn.addCredential takes it: binary as standard base64
export type SeededPasskey = {
  readonly credentialId: string;
  readonly privateKey: string;
  readonly userHandle: string;
};

// Chrome's virtual authenticator over the DevTools protocol: a platform passkey with user verification, which
// answers every prompt as if the person had looked at the phone
export async function giveFaceId(page: Page, passkey?: SeededPasskey) {
  const devtools = await page.context().newCDPSession(page);
  await devtools.send("WebAuthn.enable");
  const { authenticatorId } = await devtools.send("WebAuthn.addVirtualAuthenticator", {
    options: {
      protocol: "ctap2",
      transport: "internal",
      hasResidentKey: true,
      hasUserVerification: true,
      isUserVerified: true,
      automaticPresenceSimulation: true,
    },
  });
  if (passkey !== undefined) {
    await devtools.send("WebAuthn.addCredential", {
      authenticatorId,
      credential: {
        credentialId: passkey.credentialId,
        isResidentCredential: true,
        rpId: "localhost",
        privateKey: passkey.privateKey,
        userHandle: passkey.userHandle,
        signCount: 0,
        // As seed.ts stored it: not backed up
        backupEligibility: false,
        backupState: false,
      },
    });
  }
}

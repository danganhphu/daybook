import type { Page } from "@playwright/test";

// Chrome's virtual authenticator over the DevTools protocol: a platform passkey with user verification, which
// answers every prompt as if the person had looked at the phone
export async function giveFaceId(page: Page) {
  const devtools = await page.context().newCDPSession(page);
  await devtools.send("WebAuthn.enable");
  await devtools.send("WebAuthn.addVirtualAuthenticator", {
    options: {
      protocol: "ctap2",
      transport: "internal",
      hasResidentKey: true,
      hasUserVerification: true,
      isUserVerified: true,
      automaticPresenceSimulation: true,
    },
  });
}

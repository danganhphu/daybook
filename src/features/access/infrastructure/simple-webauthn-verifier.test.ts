import { Temporal } from "temporal-polyfill/implementation";
import { describe, expect, it } from "vitest";

import { newRandomValue } from "@/features/access/application/secret-tokens";
import {
  displayNameSchema,
  userHandleSchema,
  usernameSchema,
} from "@/features/access/domain/account";
import { challengeSchema, type Challenge } from "@/features/access/domain/ceremony";
import * as Passkeys from "@/features/access/domain/passkey";
import { deviceLabelSchema } from "@/features/access/domain/session";
import { webCryptoSecrets } from "@/features/access/infrastructure/web-crypto-secrets";
import { accountIdSchema } from "@/shared/domain/account-id";
import { relyingParty } from "@/testing/support/app";
import { generateKeys, type KeyAlgorithm, type Tampering } from "@/testing/support/authenticator";
import { anAuthenticator } from "@/testing/support/passkeys";
import { expectOk } from "@/testing/support/result";

import { createSimpleWebAuthnVerifier } from "./simple-webauthn-verifier";

const verifier = createSimpleWebAuthnVerifier(relyingParty);
const authenticator = anAuthenticator();

const user = {
  handle: userHandleSchema.parse(newRandomValue(webCryptoSecrets)),
  name: usernameSchema.parse("lan"),
  displayName: displayNameSchema.parse("Lan"),
};

function aChallenge(): Challenge {
  return challengeSchema.parse(newRandomValue(webCryptoSecrets));
}

async function aRegistration(tampering: Tampering & { readonly algorithm?: KeyAlgorithm } = {}) {
  const challenge = aChallenge();
  const options = await verifier.creationOptions({ challenge, user, exclude: [] });
  const created = await authenticator.create(options, tampering);

  return { challenge, options, ...created };
}

// A registration verified and stored the way the setup use case would store it
async function aStoredPasskey(algorithm: KeyAlgorithm = "ES256") {
  const { challenge, response, passkey } = await aRegistration({ algorithm });
  const registered = expectOk(await verifier.verifyRegistration(response, challenge));
  const stored = Passkeys.register(
    {
      ...registered,
      accountId: accountIdSchema.parse("019a0000-0000-7000-8000-000000000001"),
      name: deviceLabelSchema.parse("Chrome trên Android"),
    },
    Temporal.Instant.from("2026-10-22T01:00:00Z"),
  );

  return { stored, passkey };
}

async function anAssertion(tampering: Tampering = {}, algorithm: KeyAlgorithm = "ES256") {
  const { stored, passkey } = await aStoredPasskey(algorithm);
  const challenge = aChallenge();
  const options = await verifier.requestOptions({ challenge, allow: [] });
  const response = await authenticator.get(options, passkey, tampering);

  return { stored, passkey, challenge, options, response };
}

describe("creation options", () => {
  it("given a prompt, when options are made, then they ask for a discoverable, user-verified passkey with no attestation", async () => {
    const challenge = aChallenge();

    const options = await verifier.creationOptions({
      challenge,
      user,
      exclude: [{ id: Passkeys.credentialIdSchema.parse("AAAA"), transports: ["internal"] }],
    });

    expect(options).toMatchObject({
      challenge,
      rp: { id: relyingParty.id, name: "daybook" },
      user: { id: user.handle, name: "lan", displayName: "Lan" },
      attestation: "none",
      authenticatorSelection: {
        residentKey: "required",
        requireResidentKey: true,
        userVerification: "required",
      },
      excludeCredentials: [{ id: "AAAA", type: "public-key", transports: ["internal"] }],
      timeout: 300_000,
    });
    expect(options.pubKeyCredParams.map(({ alg }) => alg)).toEqual([-7, -8]);
  });
});

describe("request options", () => {
  it("given a prompt, when options are made, then they name this RP ID and require user verification", async () => {
    const challenge = aChallenge();

    expect(await verifier.requestOptions({ challenge, allow: [] })).toMatchObject({
      challenge,
      rpId: relyingParty.id,
      userVerification: "required",
      allowCredentials: [],
      timeout: 300_000,
    });
  });
});

describe("verifyRegistration", () => {
  it.each([
    ["ES256", -7],
    ["Ed25519", -8],
  ] as const)(
    "given a %s passkey, when its registration is verified, then the key and what the authenticator said about it come back",
    async (algorithm, cose) => {
      const { challenge, response, passkey } = await aRegistration({ algorithm });

      const registered = expectOk(await verifier.verifyRegistration(response, challenge));

      expect(registered).toMatchObject({
        credentialId: passkey.credentialId,
        algorithm: cose,
        signCount: 0,
        transports: ["internal", "hybrid"],
        aaguid: "01020304-0506-0708-090a-0b0c0d0e0f10",
        backupEligible: true,
        backedUp: true,
      });
    },
  );

  it("given an RS256 passkey, when its registration is verified, then it is refused for its algorithm", async () => {
    const { challenge, response } = await aRegistration({ algorithm: "RS256" });

    expect(await verifier.verifyRegistration(response, challenge)).toEqual({
      ok: false,
      error: "algorithm",
    });
  });

  it.each<[string, Tampering, string]>([
    ["another origin", { origin: "https://daybook.example.workers.dev.evil.example" }, "origin"],
    ["another RP ID", { rpId: "evil.example" }, "rp_id"],
    ["another challenge", { challenge: "x".repeat(43) }, "challenge"],
    ["a sign-in instead of a creation", { type: "webauthn.get" }, "type"],
    ["no user verification", { flags: { userVerified: false } }, "user_verification"],
    ["no user presence", { flags: { userPresent: false } }, "user_presence"],
  ])(
    "given a registration with %s, when verified, then it is refused for that reason",
    async (_, tampering, reason) => {
      const { challenge, response } = await aRegistration(tampering);

      expect(await verifier.verifyRegistration(response, challenge)).toEqual({
        ok: false,
        error: reason,
      });
    },
  );

  it.each([[null], ["not an object"], [{ id: "x" }]])(
    "given %j instead of a registration, when verified, then it is refused as malformed",
    async (response) => {
      expect(await verifier.verifyRegistration(response, aChallenge())).toEqual({
        ok: false,
        error: "malformed",
      });
    },
  );
});

describe("readAssertion", () => {
  it("given a sign-in response, when read, then it names the credential and the user handle", async () => {
    const { response, stored } = await anAssertion();

    expect(verifier.readAssertion(response)).toEqual({
      credentialId: stored.credentialId,
      userHandle: user.handle,
    });
  });

  it("given a response without a user handle, when read, then the handle is left out", async () => {
    const { response } = await anAssertion({ userHandle: null });

    expect(verifier.readAssertion(response)?.userHandle).toBeUndefined();
  });

  it("given an id that differs from the raw id, when read, then nothing is read", async () => {
    const { response } = await anAssertion();

    expect(verifier.readAssertion({ ...response, id: "AAAA" })).toBeUndefined();
  });
});

describe("verifyAssertion", () => {
  it.each([["ES256"], ["Ed25519"]] as const)(
    "given a %s passkey's answer, when verified, then the counter and backup state come back",
    async (algorithm) => {
      const { stored, challenge, response } = await anAssertion({ counter: 7 }, algorithm);

      expect(await verifier.verifyAssertion(response, challenge, stored)).toEqual({
        ok: true,
        value: { signCount: 7, backedUp: true },
      });
    },
  );

  it("given a counter lower than the stored one, when verified, then the library does not refuse it", async () => {
    const { stored, challenge, response } = await anAssertion({ counter: 1 });

    const verified = await verifier.verifyAssertion(response, challenge, {
      ...stored,
      signCount: 9,
    });

    expect(verified).toEqual({ ok: true, value: { signCount: 1, backedUp: true } });
  });

  it("given a signature by another key, when verified, then it is refused as a bad signature", async () => {
    const { stored, passkey, challenge, options } = await anAssertion();
    const forged = await authenticator.get(options, passkey, {
      signWith: (await generateKeys("ES256")).privateKey,
    });

    expect(await verifier.verifyAssertion(forged, challenge, stored)).toEqual({
      ok: false,
      error: "signature",
    });
  });

  it.each<[string, Tampering, string]>([
    ["another origin", { origin: "https://evil.example" }, "origin"],
    ["another RP ID", { rpId: "evil.example" }, "rp_id"],
    ["another challenge", { challenge: "x".repeat(43) }, "challenge"],
    ["a creation instead of a sign-in", { type: "webauthn.create" }, "type"],
    ["no user verification", { flags: { userVerified: false } }, "user_verification"],
    ["no user presence", { flags: { userPresent: false } }, "user_presence"],
  ])(
    "given an answer with %s, when verified, then it is refused for that reason",
    async (_, tampering, reason) => {
      const { stored, challenge, response } = await anAssertion(tampering);

      expect(await verifier.verifyAssertion(response, challenge, stored)).toEqual({
        ok: false,
        error: reason,
      });
    },
  );
});

import {
  generateAuthenticationOptions,
  generateRegistrationOptions,
  verifyAuthenticationResponse,
  verifyRegistrationResponse,
} from "@simplewebauthn/server";
import { cose, decodeCredentialPublicKey } from "@simplewebauthn/server/helpers";

import type {
  PasskeyRejection,
  PasskeyVerifier,
} from "@/features/access/application/passkey-verifier";
import { ceremonyLifetime } from "@/features/access/domain/access-policy";
import {
  credentialIdSchema,
  isPasskeyAlgorithm,
  passkeyAlgorithms,
} from "@/features/access/domain/passkey";
import { decodeBase64Url, encodeBase64Url } from "@/shared/domain/base64url";
import { err, ok } from "@/shared/domain/result";

import type { RelyingParty } from "./relying-party";
import { authenticationResponse, readAssertion, registrationResponse } from "./webauthn-responses";

const timeout = ceremonyLifetime.total("milliseconds");

// The library throws an Error naming the check that failed. Its messages can quote the challenge, so only the kind
// of failure leaves this file. The adapter tests pin each mapping, so a reworded message shows up on upgrade.
function rejectionFor(error: unknown): PasskeyRejection {
  const message = error instanceof Error ? error.message : "";
  if (/response type|credential type/i.test(message)) {
    return "type";
  }
  if (/challenge/i.test(message)) {
    return "challenge";
  }
  if (/RP ID/.test(message)) {
    return "rp_id";
  }
  if (/origin/i.test(message)) {
    return "origin";
  }
  if (/verif(y|ied|ication)/i.test(message)) {
    return "user_verification";
  }
  if (/present/i.test(message)) {
    return "user_presence";
  }
  if (/\balg\b/.test(message)) {
    return "algorithm";
  }

  return "other";
}

// The library types extensions loosely, with buffers where the JSON form has strings. The only one it sends is
// credProps, so the options are passed on in the standard's JSON types with that one written out.
function asCreationJSON({
  extensions,
  ...options
}: Awaited<
  ReturnType<typeof generateRegistrationOptions>
>): PublicKeyCredentialCreationOptionsJSON {
  return { ...options, extensions: { credProps: extensions?.credProps ?? false } };
}

function asRequestJSON({
  extensions: _noneRequested,
  ...options
}: Awaited<
  ReturnType<typeof generateAuthenticationOptions>
>): PublicKeyCredentialRequestOptionsJSON {
  return options;
}

export function createSimpleWebAuthnVerifier(relyingParty: RelyingParty): PasskeyVerifier {
  const expected = { expectedOrigin: relyingParty.origin, expectedRPID: relyingParty.id };

  return {
    async creationOptions(prompt) {
      const options = await generateRegistrationOptions({
        rpName: relyingParty.name,
        rpID: relyingParty.id,
        userID: decodeBase64Url(prompt.user.handle),
        userName: prompt.user.name,
        userDisplayName: prompt.user.displayName,
        // Bytes, not text: a string here would be UTF-8 encoded and base64url-encoded a second time
        challenge: decodeBase64Url(prompt.challenge),
        timeout,
        attestationType: "none",
        excludeCredentials: prompt.exclude.map(({ id, transports }) => ({
          id,
          transports: [...transports],
        })),
        authenticatorSelection: { residentKey: "required", userVerification: "required" },
        supportedAlgorithmIDs: [...passkeyAlgorithms],
      });

      return asCreationJSON(options);
    },

    async requestOptions(prompt) {
      const options = await generateAuthenticationOptions({
        rpID: relyingParty.id,
        challenge: decodeBase64Url(prompt.challenge),
        timeout,
        userVerification: "required",
        allowCredentials: prompt.allow.map(({ id, transports }) => ({
          id,
          transports: [...transports],
        })),
      });

      return asRequestJSON(options);
    },

    async verifyRegistration(response, challenge) {
      const parsed = registrationResponse.safeParse(response);
      if (!parsed.success) {
        return err("malformed");
      }

      try {
        const result = await verifyRegistrationResponse({
          response: parsed.data,
          expectedChallenge: challenge,
          ...expected,
          requireUserVerification: true,
          supportedAlgorithmIDs: [...passkeyAlgorithms],
        });
        if (!result.verified) {
          return err("other");
        }

        const info = result.registrationInfo;
        const algorithm = decodeCredentialPublicKey(info.credential.publicKey).get(
          cose.COSEKEYS.alg,
        );
        if (algorithm === undefined || !isPasskeyAlgorithm(algorithm)) {
          return err("algorithm");
        }

        return ok({
          credentialId: credentialIdSchema.parse(info.credential.id),
          publicKey: encodeBase64Url(info.credential.publicKey),
          algorithm,
          signCount: info.credential.counter,
          transports: info.credential.transports ?? [],
          aaguid: info.aaguid,
          backupEligible: info.credentialDeviceType === "multiDevice",
          backedUp: info.credentialBackedUp,
        });
      } catch (error) {
        return err(rejectionFor(error));
      }
    },

    readAssertion,

    async verifyAssertion(response, challenge, passkey) {
      const parsed = authenticationResponse.safeParse(response);
      if (!parsed.success) {
        return err("malformed");
      }

      try {
        const result = await verifyAuthenticationResponse({
          response: parsed.data,
          expectedChallenge: challenge,
          ...expected,
          credential: {
            id: passkey.credentialId,
            publicKey: decodeBase64Url(passkey.publicKey),
            // The library refuses a counter that did not grow; here that is a signal, not a refusal, so it is
            // compared in the domain instead (Passkeys.recordUse)
            counter: 0,
          },
          requireUserVerification: true,
        });
        if (!result.verified) {
          return err("signature");
        }

        return ok({
          signCount: result.authenticationInfo.newCounter,
          backedUp: result.authenticationInfo.credentialBackedUp,
        });
      } catch (error) {
        return err(rejectionFor(error));
      }
    },
  };
}

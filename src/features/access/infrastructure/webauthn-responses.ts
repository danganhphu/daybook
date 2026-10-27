import type { AuthenticationResponseJSON, RegistrationResponseJSON } from "@simplewebauthn/server";
import { z } from "zod";

import type { PresentedAssertion } from "@/features/access/application/passkey-verifier";
import { userHandleSchema } from "@/features/access/domain/account";
import { credentialIdSchema } from "@/features/access/domain/passkey";

// The shape navigator.credentials.create() and .get() answer with, checked before the library sees it. The library
// validates every field's content; this only refuses what is not even the right kind of object.
const base64Url = z.string().regex(/^[A-Za-z0-9_-]+$/);
const clientFields = {
  id: base64Url,
  rawId: base64Url,
  type: z.literal("public-key"),
  clientExtensionResults: z.record(z.string(), z.unknown()),
  authenticatorAttachment: z.enum(["platform", "cross-platform"]).optional(),
};
const sameId = (value: { readonly id: string; readonly rawId: string }) => value.id === value.rawId;
const registrationShape = z
  .looseObject({
    ...clientFields,
    response: z.looseObject({
      clientDataJSON: base64Url,
      attestationObject: base64Url,
      transports: z.array(z.string()).optional(),
    }),
  })
  .refine(sameId);
const authenticationShape = z
  .looseObject({
    ...clientFields,
    response: z.looseObject({
      clientDataJSON: base64Url,
      authenticatorData: base64Url,
      signature: base64Url,
      userHandle: base64Url.optional(),
    }),
  })
  .refine(sameId);
// Typed as the library's own response types once the shape holds
export const registrationResponse = z.custom<RegistrationResponseJSON>(
  (value) => registrationShape.safeParse(value).success,
);
export const authenticationResponse = z.custom<AuthenticationResponseJSON>(
  (value) => authenticationShape.safeParse(value).success,
);

// Which passkey an assertion names, before anything is verified. Needs no WebAuthn library, so sign-in can look the
// passkey up while the library loads.
export function readAssertion(response: unknown): PresentedAssertion | undefined {
  const parsed = authenticationResponse.safeParse(response);
  if (!parsed.success) {
    return undefined;
  }

  const credentialId = credentialIdSchema.safeParse(parsed.data.id);
  const { userHandle } = parsed.data.response;
  const handle = userHandle === undefined ? undefined : userHandleSchema.safeParse(userHandle);
  if (!credentialId.success || handle?.success === false) {
    return undefined;
  }

  return { credentialId: credentialId.data, userHandle: handle?.data };
}

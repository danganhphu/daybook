import type { Peppers } from "@/features/access/application/peppers";
import { pepperByteLength } from "@/features/access/domain/access-policy";
import { decodeBase64Url } from "@/shared/domain/base64url";
import { base64UrlSchema } from "@/shared/domain/base64url-schema";

// Random bytes, base64url: `node -e "console.log(crypto.randomBytes(32).toString('base64url'))"`
export const pepperSchema = base64UrlSchema(
  pepperByteLength,
  `PASSWORD_PEPPER must be ${pepperByteLength} random bytes, base64url`,
);

// Version 1 is the only pepper so far. Rotating adds a second secret and a version here; verifiers made with the
// old one keep checking until their owners set the password again.
export function peppersFrom(current: string): Peppers {
  const pepper = { version: 1, key: decodeBase64Url(pepperSchema.parse(current)) };

  return {
    current: pepper,
    byVersion: (version) => (version === pepper.version ? pepper : undefined),
  };
}

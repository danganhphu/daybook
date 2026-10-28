import { encodeBase64Url } from "@/shared/domain/base64url";
import { base64UrlSchema } from "@/shared/domain/base64url-schema";

// The application server's key pair (RFC 8292): an ECDSA P-256 key, the public half as an uncompressed point, the
// private half as its JWK `d`, both base64url
export const vapidPublicKeySchema = base64UrlSchema(65);
export const vapidPrivateKeySchema = base64UrlSchema(32);

// The pair `pnpm dev` runs with, as cloudflare.config.ts gives it (its own copy; the test holds them together). It is
// in a public repository, so the Worker refuses it on any origin but localhost, as it does the development pepper.
export const developmentVapidKeys = {
  publicKey:
    "BBfpfm6Q_MlmP3iZV9GcX9Np8giJ1NPwNflJ__LCUQIpgd0TXaatflD3BTL0qlJbNwu8nsidSpHXMPsEzwCdm_w",
  privateKey: "2T5flB504mroN0xVqiLi725B_dULBJnD6sxFG0BEzb4",
} as const;

export function vapidKeysFitOrigin(publicKey: string, appOrigin: string): boolean {
  return (
    publicKey !== developmentVapidKeys.publicKey || new URL(appOrigin).hostname === "localhost"
  );
}

// A new pair for a deploy, made with Web Crypto
export async function newVapidKeys(): Promise<{ publicKey: string; privateKey: string }> {
  const pair = await crypto.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, true, [
    "sign",
  ]);
  const raw = new Uint8Array(await crypto.subtle.exportKey("raw", pair.publicKey));
  const { d } = await crypto.subtle.exportKey("jwk", pair.privateKey);
  if (d === undefined) {
    throw new Error("The private key exported without its d");
  }

  return { publicKey: encodeBase64Url(raw), privateKey: d };
}

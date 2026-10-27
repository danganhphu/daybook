import type {
  PublicKeyCredentialCreationOptionsJSON as BrowserCreationOptions,
  PublicKeyCredentialRequestOptionsJSON as BrowserRequestOptions,
} from "@simplewebauthn/browser";
import { z } from "zod";

// The one place the browser runs Zod. The CSP has no 'unsafe-eval', so its compiled parsers could never run here, and
// the `new Function` probe would be blocked and reported. The Worker turns them off by itself.
z.config({ jitless: true });

// The server sends prompt options in the standard's JSON types, where every enumerated value is a plain string; the
// browser library wants the enumerations themselves. Parsed, not cast: what the page hands to navigator.credentials
// is exactly what the server meant, and anything else fails here. exactOptional keeps an absent field absent.

const transport = z.enum(["ble", "cable", "hybrid", "internal", "nfc", "smart-card", "usb"]);
const userVerification = z.enum(["required", "preferred", "discouraged"]);
const hint = z.enum(["hybrid", "security-key", "client-device"]);
const descriptor = z.object({
  id: z.string(),
  type: z.literal("public-key"),
  transports: z.array(transport).exactOptional(),
});

const creationOptions = z.object({
  rp: z.object({ id: z.string().exactOptional(), name: z.string() }),
  user: z.object({ id: z.string(), name: z.string(), displayName: z.string() }),
  challenge: z.string(),
  pubKeyCredParams: z.array(z.object({ alg: z.number(), type: z.literal("public-key") })),
  timeout: z.number().exactOptional(),
  excludeCredentials: z.array(descriptor).exactOptional(),
  authenticatorSelection: z
    .object({
      authenticatorAttachment: z.enum(["platform", "cross-platform"]).exactOptional(),
      residentKey: z.enum(["required", "preferred", "discouraged"]).exactOptional(),
      requireResidentKey: z.boolean().exactOptional(),
      userVerification: userVerification.exactOptional(),
    })
    .exactOptional(),
  hints: z.array(hint).exactOptional(),
  attestation: z.enum(["none", "indirect", "direct", "enterprise"]).exactOptional(),
  extensions: z.object({ credProps: z.boolean().exactOptional() }).exactOptional(),
});

const requestOptions = z.object({
  challenge: z.string(),
  timeout: z.number().exactOptional(),
  rpId: z.string().exactOptional(),
  allowCredentials: z.array(descriptor).exactOptional(),
  userVerification: userVerification.exactOptional(),
  hints: z.array(hint).exactOptional(),
});

export function forBrowserCreation(
  options: PublicKeyCredentialCreationOptionsJSON,
): BrowserCreationOptions {
  return creationOptions.parse(options) satisfies BrowserCreationOptions;
}

export function forBrowserRequest(
  options: PublicKeyCredentialRequestOptionsJSON,
): BrowserRequestOptions {
  return requestOptions.parse(options) satisfies BrowserRequestOptions;
}

"use client";

import { browserSupportsWebAuthn } from "@simplewebauthn/browser";

import { useBrowserCapability } from "@/shared/web/use-browser-capability";

// Whether this browser can make and use passkeys. Rendered first as if it could: nearly every phone can.
export function useWebAuthnSupport(): boolean {
  return useBrowserCapability(browserSupportsWebAuthn, true);
}

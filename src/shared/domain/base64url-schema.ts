import { z } from "zod";

import { base64UrlLength } from "./base64url";

// Exactly byteLength bytes, base64url-encoded without padding
export function base64UrlSchema(byteLength: number, error?: string) {
  return z
    .string()
    .regex(
      new RegExp(`^[A-Za-z0-9_-]{${base64UrlLength(byteLength)}}$`),
      error === undefined ? undefined : { error },
    );
}

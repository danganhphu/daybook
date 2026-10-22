import type { z } from "zod";

import { base64UrlSchema } from "@/shared/domain/base64url-schema";

import { digestByteLength, secretByteLength } from "./access-policy";

// secretByteLength random bytes, base64url-encoded
export const randomValueSchema = base64UrlSchema(secretByteLength);

// A secret a browser holds - a session secret, a setup token, a ceremony binding. Never stored, never logged.
export const secretTokenSchema = randomValueSchema.brand<"SecretToken">();

export type SecretToken = z.infer<typeof secretTokenSchema>;

// The SHA-256 of a secret token: the only form the database keeps. A fast hash is enough for 256 random bits
// (OWASP Session Management cheat sheet; ASVS 6.5.2).
export const secretHashSchema = base64UrlSchema(digestByteLength).brand<"SecretHash">();

export type SecretHash = z.infer<typeof secretHashSchema>;

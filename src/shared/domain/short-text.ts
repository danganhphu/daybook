import { z } from "zod";

// Text fields of a form. NFC, so a word typed with Telex and with VNI is one string; trimmed, since a space at either
// end is never meant.

export function requiredTextSchema(maxLength: number, errors: { empty: string; tooLong: string }) {
  return z
    .string({ error: errors.empty })
    .normalize("NFC")
    .trim()
    .min(1, { error: errors.empty })
    .max(maxLength, { error: errors.tooLong });
}

// Left out or left empty means not given, which is undefined rather than ""
export function optionalTextSchema(maxLength: number, tooLong: string) {
  return z
    .string({ error: tooLong })
    .normalize("NFC")
    .trim()
    .max(maxLength, { error: tooLong })
    .optional()
    .transform((text) => (text === "" ? undefined : text));
}

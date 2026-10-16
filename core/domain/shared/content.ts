import { z } from "zod";

// Generous for a note, far below D1's 100 KB statement limit
export const contentMaxLength = 4000;

// What she typed. Blank is not input, so it is the only thing refused; everything else is kept verbatim.
export const contentSchema = z
  .string()
  .max(contentMaxLength, { error: `Tối đa ${contentMaxLength} ký tự` })
  .refine((value) => value.trim().length > 0, { error: "Chưa có nội dung" })
  .brand<"Content">();

// Only obtainable by parsing, so nothing downstream can receive unchecked text
export type Content = z.infer<typeof contentSchema>;

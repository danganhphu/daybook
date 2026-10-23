import { z } from "zod";

// The longest search worth running; anything longer is a paste, not a search
export const searchTermMaxLength = 100;

// Text as it is matched: without diacritics, đ as d, lower case, one space between words. People type with and
// without accents, on Telex, VNI and phone keyboards; all of them should find "Nha khoa Minh Tâm" with "minh tam".
export function searchText(text: string): string {
  return text
    .normalize("NFD")
    .replace(/\p{Mn}/gu, "")
    .replaceAll("đ", "d")
    .replaceAll("Đ", "D")
    .toLocaleLowerCase("vi")
    .replace(/\s+/g, " ")
    .trim();
}

// A search as typed, made comparable with stored search text
export const searchTermSchema = z
  .string()
  .transform(searchText)
  .pipe(z.string().min(1).max(searchTermMaxLength))
  .brand<"SearchTerm">();

export type SearchTerm = z.infer<typeof searchTermSchema>;

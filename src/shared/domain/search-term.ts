import { z } from "zod";

import { searchTermMaxLength, searchText } from "./search-text";

// A search as typed, made comparable with stored search text
export const searchTermSchema = z
  .string()
  .transform(searchText)
  .pipe(z.string().min(1).max(searchTermMaxLength))
  .brand<"SearchTerm">();

export type SearchTerm = z.infer<typeof searchTermSchema>;

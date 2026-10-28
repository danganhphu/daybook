import type { BookSetting } from "./book-setting";

// Reads only. The defaults until someone changes a setting, when the book gets its one stored row.
export type BookSettingRepository = {
  get(): Promise<BookSetting>;
};

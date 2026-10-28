import type { BookSetting } from "@/features/book-settings/domain/book-setting";

// Queue changes on the current unit of work; nothing is stored until it commits

export type BookSettingWrites = {
  add(setting: BookSetting): void;
  update(setting: BookSetting): void;
};

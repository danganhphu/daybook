import * as BookSettings from "@/features/book-settings/domain/book-setting";
import type { BookSettingRepository } from "@/features/book-settings/domain/book-setting-repository";
import type { Database } from "@/shared/infrastructure/d1/database";

import { toBookSetting } from "./book-setting-mapping";
import { bookSettingTable } from "./book-setting.table";

export function createBookSettingRepository(db: Database): BookSettingRepository {
  return {
    async get() {
      const [row] = await db.select().from(bookSettingTable).limit(1);

      return row === undefined ? BookSettings.defaults() : toBookSetting(row);
    },
  };
}

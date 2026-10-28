import { eq } from "drizzle-orm";

import type { BookSettingWrites } from "@/features/book-settings/application/book-setting-writes";
import type { Batch } from "@/shared/infrastructure/d1/batch";
import type { Database } from "@/shared/infrastructure/d1/database";

import { toBookSettingRow } from "./book-setting-mapping";
import { bookSettingId, bookSettingTable } from "./book-setting.table";

// Updates set everything but the creation, which the database refuses to change; the version trigger refuses a stale
// write
export function createBookSettingWrites(db: Database, batch: Batch): BookSettingWrites {
  return {
    add(setting) {
      batch.enlist(db.insert(bookSettingTable).values(toBookSettingRow(setting)));
    },

    update(setting) {
      const {
        id: _id,
        createdAt: _createdAt,
        createdBy: _createdBy,
        ...changes
      } = toBookSettingRow(setting);
      batch.enlist(
        db.update(bookSettingTable).set(changes).where(eq(bookSettingTable.id, bookSettingId)),
      );
    },
  };
}

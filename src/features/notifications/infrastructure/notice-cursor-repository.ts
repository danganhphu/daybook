import { eq } from "drizzle-orm";
import { Temporal } from "temporal-polyfill/implementation";

import { accessEventIdSchema } from "@/features/access/domain/access-event";
import type { NoticeCursorRepository } from "@/features/notifications/domain/notice-cursor-repository";
import type { Database } from "@/shared/infrastructure/d1/database";

import { noticeCursorName, noticeCursorTable } from "./notice-cursor.table";

export function createNoticeCursorRepository(db: Database): NoticeCursorRepository {
  return {
    async get() {
      const [row] = await db
        .select()
        .from(noticeCursorTable)
        .where(eq(noticeCursorTable.name, noticeCursorName))
        .limit(1);

      return row === undefined
        ? undefined
        : {
            occurredAt: Temporal.Instant.fromEpochMilliseconds(row.occurredAt),
            id: accessEventIdSchema.parse(row.eventId),
          };
    },
  };
}

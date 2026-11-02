import { and, eq } from "drizzle-orm";
import { Temporal } from "temporal-polyfill/implementation";

import { captureIdSchema, sourceRefSchema, type Capture } from "@/features/capture/domain/capture";
import type { CaptureRepository } from "@/features/capture/domain/capture-repository";
import { accountIdSchema } from "@/shared/domain/account-id";
import { contentSchema } from "@/shared/domain/content-schema";
import type { Database } from "@/shared/infrastructure/d1/database";

import { captureTable } from "./capture.table";

function toCapture(row: typeof captureTable.$inferSelect): Capture {
  return {
    id: captureIdSchema.parse(row.id),
    content: contentSchema.parse(row.content),
    source: row.source,
    sourceRef: row.sourceRef === null ? undefined : sourceRefSchema.parse(row.sourceRef),
    authorId: accountIdSchema.parse(row.authorId),
    receivedAt: Temporal.Instant.fromEpochMilliseconds(row.receivedAt),
  };
}

export function createCaptureRepository(db: Database): CaptureRepository {
  return {
    async get(id) {
      const [row] = await db.select().from(captureTable).where(eq(captureTable.id, id));

      return row === undefined ? undefined : toCapture(row);
    },

    async findBySourceRef(source, sourceRef) {
      const [row] = await db
        .select()
        .from(captureTable)
        .where(and(eq(captureTable.source, source), eq(captureTable.sourceRef, sourceRef)))
        .limit(1);

      return row === undefined ? undefined : toCapture(row);
    },
  };
}

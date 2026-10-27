import { eq } from "drizzle-orm";
import { Temporal } from "temporal-polyfill/implementation";

import { captureIdSchema } from "@/features/capture/domain/capture";
import type { CaptureRepository } from "@/features/capture/domain/capture-repository";
import { accountIdSchema } from "@/shared/domain/account-id";
import { contentSchema } from "@/shared/domain/content-schema";
import type { Database } from "@/shared/infrastructure/d1/database";

import { captureTable } from "./capture.table";

export function createCaptureRepository(db: Database): CaptureRepository {
  return {
    async get(id) {
      const [row] = await db.select().from(captureTable).where(eq(captureTable.id, id));
      if (row === undefined) {
        return undefined;
      }

      return {
        id: captureIdSchema.parse(row.id),
        content: contentSchema.parse(row.content),
        source: row.source,
        authorId: accountIdSchema.parse(row.authorId),
        receivedAt: Temporal.Instant.fromEpochMilliseconds(row.receivedAt),
      };
    },
  };
}

import type { CaptureWrites } from "@/features/capture/application/capture-writes";
import type { Batch } from "@/shared/infrastructure/d1/batch";
import type { Database } from "@/shared/infrastructure/d1/database";

import { captureTable } from "./capture.table";

export function createCaptureWrites(db: Database, batch: Batch): CaptureWrites {
  return {
    add(capture) {
      batch.enlist(
        db.insert(captureTable).values({
          id: capture.id,
          content: capture.content,
          source: capture.source,
          receivedAt: capture.receivedAt.epochMilliseconds,
        }),
      );
    },
  };
}

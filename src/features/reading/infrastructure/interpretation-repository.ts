import { inArray, max } from "drizzle-orm";

import type { CaptureId } from "@/features/capture/domain/capture";
import type { Interpretation } from "@/features/reading/domain/interpretation";
import type { InterpretationRepository } from "@/features/reading/domain/interpretation-repository";
import type { Database } from "@/shared/infrastructure/d1/database";

import { fromInterpretationRow } from "./interpretation-mapping";
import { interpretationTable } from "./interpretation.table";

export function createInterpretationRepository(db: Database): InterpretationRepository {
  return {
    async latestFor(captureIds) {
      if (captureIds.length === 0) {
        return new Map();
      }
      // Ids are UUIDv7, so the greatest is the newest
      const newest = db
        .select({ id: max(interpretationTable.id) })
        .from(interpretationTable)
        .where(inArray(interpretationTable.captureId, [...captureIds]))
        .groupBy(interpretationTable.captureId);
      const rows = await db
        .select()
        .from(interpretationTable)
        .where(inArray(interpretationTable.id, newest));

      return new Map<CaptureId, Interpretation>(
        rows.map((row) => {
          const interpretation = fromInterpretationRow(row);
          return [interpretation.captureId, interpretation];
        }),
      );
    },
  };
}

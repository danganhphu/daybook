import { inArray, max } from "drizzle-orm";

import type { CaptureId } from "@/features/capture/domain/capture";
import type { Interpretation } from "@/features/reading/domain/interpretation";
import type { InterpretationRepository } from "@/features/reading/domain/interpretation-repository";
import type { Database } from "@/shared/infrastructure/d1/database";
import { readInChunks } from "@/shared/infrastructure/d1/limits";

import { fromInterpretationRow } from "./interpretation-mapping";
import { interpretationTable } from "./interpretation.table";

export function createInterpretationRepository(db: Database): InterpretationRepository {
  return {
    async latestFor(captureIds) {
      // Ids are UUIDv7, so the greatest is the newest
      const rows = await readInChunks(captureIds, (chunk) =>
        db
          .select()
          .from(interpretationTable)
          .where(
            inArray(
              interpretationTable.id,
              db
                .select({ id: max(interpretationTable.id) })
                .from(interpretationTable)
                .where(inArray(interpretationTable.captureId, [...chunk]))
                .groupBy(interpretationTable.captureId),
            ),
          ),
      );

      return new Map<CaptureId, Interpretation>(
        rows.map((row) => {
          const interpretation = fromInterpretationRow(row);
          return [interpretation.captureId, interpretation];
        }),
      );
    },
  };
}

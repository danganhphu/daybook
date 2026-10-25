import type { InterpretationWrites } from "@/features/reading/application/interpretation-writes";
import type { Batch } from "@/shared/infrastructure/d1/batch";
import type { Database } from "@/shared/infrastructure/d1/database";

import { toInterpretationRow } from "./interpretation-mapping";
import { interpretationTable } from "./interpretation.table";

export function createInterpretationWrites(db: Database, batch: Batch): InterpretationWrites {
  return {
    add(interpretation) {
      batch.enlist(db.insert(interpretationTable).values(toInterpretationRow(interpretation)));
    },
  };
}

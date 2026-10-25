import { sql } from "drizzle-orm";
import { check, index, integer, real, sqliteTable, text } from "drizzle-orm/sqlite-core";

import { accountTable } from "@/features/access/infrastructure/account.table";
import { captureTable } from "@/features/capture/infrastructure/capture.table";
import { interpretationOutcomes, readFailures } from "@/features/reading/domain/interpretation";
import { sqlTextList } from "@/shared/infrastructure/d1/sql-literals";

// Append-only, as `capture` is: two triggers refuse any update or delete. result is the reading as JSON, with the
// question and candidates of an unsure one; a failed reading has a failure instead.
export const interpretationTable = sqliteTable(
  "interpretation",
  {
    id: text("id").primaryKey(),
    captureId: text("capture_id")
      .notNull()
      .references(() => captureTable.id),
    model: text("model").notNull(),
    promptVersion: integer("prompt_version").notNull(),
    outcome: text("outcome").notNull(),
    result: text("result"),
    failure: text("failure"),
    neurons: real("neurons"),
    readAt: integer("read_at").notNull(),
    readBy: text("read_by")
      .notNull()
      .references(() => accountTable.id),
  },
  (table) => [
    check(
      "interpretation_outcome_known",
      sql`${table.outcome} in (${sqlTextList(interpretationOutcomes)})`,
    ),
    check(
      "interpretation_failure_known",
      sql`${table.failure} is null or ${table.failure} in (${sqlTextList(readFailures)})`,
    ),
    check(
      "interpretation_result_or_failure",
      sql`((${table.outcome} = 'failed') = (${table.failure} is not null))
        and ((${table.outcome} = 'failed') = (${table.result} is null))
        and (${table.result} is null or json_valid(${table.result}))`,
    ),
    check("interpretation_model_present", sql`length(${table.model}) between 1 and 100`),
    check(
      "interpretation_counts",
      sql`${table.promptVersion} >= 0 and (${table.neurons} is null or ${table.neurons} >= 0)`,
    ),
    index("interpretation_by_capture").on(table.captureId, table.id),
  ],
);

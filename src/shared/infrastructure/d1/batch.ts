import type { Query } from "drizzle-orm";
import type { BatchItem } from "drizzle-orm/batch";

import type { Database } from "./database";

// A statement that can also show its SQL, which lets the operator's command record a batch instead of running it
export type BatchStatement = BatchItem<"sqlite"> & { toSQL(): Query };

// D1 has no interactive transactions; a batch is its transaction. Statements wait here and go as one on commit.
export type Batch = {
  enlist(statement: BatchStatement): void;
  commit(): Promise<void>;
};

export function createBatch(db: Database): Batch {
  const pending: BatchStatement[] = [];

  return {
    enlist(statement) {
      pending.push(statement);
    },

    async commit() {
      const [first, ...rest] = pending.splice(0);
      if (first === undefined) {
        return;
      }

      await db.batch([first, ...rest]);
    },
  };
}

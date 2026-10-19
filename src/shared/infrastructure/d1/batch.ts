import type { BatchItem } from "drizzle-orm/batch";

import type { Database } from "./database";

// D1 has no interactive transactions; a batch is its transaction. Statements wait here and go as one on commit.
export type Batch = {
  enlist(statement: BatchItem<"sqlite">): void;
  commit(): Promise<void>;
};

export function createBatch(db: Database): Batch {
  const pending: BatchItem<"sqlite">[] = [];

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

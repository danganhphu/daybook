import type { Query } from "drizzle-orm";
import type { BatchItem } from "drizzle-orm/batch";

import { StaleWriteError } from "@/shared/application/stale-write";

import { staleVersionMessage } from "./audit-columns";
import type { Database } from "./database";

// A statement that can also show its SQL, which lets the operator's command record a batch instead of running it
export type BatchStatement = BatchItem<"sqlite"> & { toSQL(): Query };

// D1 has no interactive transactions; a batch is its transaction. Statements wait here and go as one on commit.
export type Batch = {
  enlist(statement: BatchStatement): void;
  commit(): Promise<void>;
};

// D1 wraps the trigger's message in its own; look through the causes for it
function raisedStaleVersion(error: unknown): boolean {
  for (let current = error; current instanceof Error; current = current.cause) {
    if (current.message.includes(staleVersionMessage)) {
      return true;
    }
  }

  return false;
}

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

      try {
        await db.batch([first, ...rest]);
      } catch (error) {
        // The whole batch was refused, as D1 batches are; nothing of it was stored
        if (raisedStaleVersion(error)) {
          throw new StaleWriteError({ cause: error });
        }
        throw error;
      }
    },
  };
}

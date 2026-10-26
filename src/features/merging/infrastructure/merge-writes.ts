import type { MergeWrites } from "@/features/merging/application/merge-writes";
import type { Batch } from "@/shared/infrastructure/d1/batch";
import type { Database } from "@/shared/infrastructure/d1/database";

import { customerMergeTable } from "./customer-merge.table";
import { productMergeTable } from "./product-merge.table";

export function createMergeWrites(db: Database, batch: Batch): MergeWrites {
  return {
    addCustomerMerge(merge) {
      batch.enlist(
        db.insert(customerMergeTable).values({
          id: merge.id,
          fromId: merge.fromId,
          intoId: merge.intoId,
          moved: JSON.stringify({ orders: merge.orderIds, reminders: merge.reminderIds }),
          mergedAt: merge.at.epochMilliseconds,
          mergedBy: merge.by,
        }),
      );
    },

    addProductMerge(merge) {
      batch.enlist(
        db.insert(productMergeTable).values({
          id: merge.id,
          fromId: merge.fromId,
          intoId: merge.intoId,
          moved: JSON.stringify({ orders: merge.orderIds }),
          mergedAt: merge.at.epochMilliseconds,
          mergedBy: merge.by,
        }),
      );
    },
  };
}

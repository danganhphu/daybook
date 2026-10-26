import type { Temporal } from "temporal-polyfill/implementation";
import { v7 as uuidv7 } from "uuid";
import { z } from "zod";

import type { CustomerId } from "@/features/customers/domain/customer";
import type { OrderId } from "@/features/orders/domain/order";
import type { ProductId } from "@/features/products/domain/product";
import type { ReminderId } from "@/features/reminders/domain/reminder";
import type { AccountId } from "@/shared/domain/account-id";

// Read as a module: `import * as Merges`. The record a merge leaves: which two, who, when, and what moved. Never
// changed; it is how a merge is traced afterwards, since a merge has no Undo.

export const mergeIdSchema = z.uuid().brand<"MergeId">();

export type MergeId = z.infer<typeof mergeIdSchema>;

type MergeFields<Id> = {
  readonly id: MergeId;
  readonly fromId: Id;
  readonly intoId: Id;
  readonly at: Temporal.Instant;
  readonly by: AccountId;
};

export type CustomerMerge = MergeFields<CustomerId> & {
  readonly orderIds: ReadonlyArray<OrderId>;
  readonly reminderIds: ReadonlyArray<ReminderId>;
};

export type ProductMerge = MergeFields<ProductId> & {
  readonly orderIds: ReadonlyArray<OrderId>;
};

export function customerMerge(
  from: CustomerId,
  into: CustomerId,
  moved: Pick<CustomerMerge, "orderIds" | "reminderIds">,
  by: AccountId,
  at: Temporal.Instant,
): CustomerMerge {
  return { id: mergeIdSchema.parse(uuidv7()), fromId: from, intoId: into, ...moved, at, by };
}

export function productMerge(
  from: ProductId,
  into: ProductId,
  orderIds: ReadonlyArray<OrderId>,
  by: AccountId,
  at: Temporal.Instant,
): ProductMerge {
  return { id: mergeIdSchema.parse(uuidv7()), fromId: from, intoId: into, orderIds, at, by };
}

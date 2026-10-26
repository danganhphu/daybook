import type { CustomerMerge, ProductMerge } from "@/features/merging/domain/merge";

// Queues a merge's record on the same unit of work as everything it moved
export type MergeWrites = {
  addCustomerMerge(merge: CustomerMerge): void;
  addProductMerge(merge: ProductMerge): void;
};

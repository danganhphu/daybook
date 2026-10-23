import type { ActiveProduct } from "@/features/products/domain/product";

// Queues new products on the current unit of work, beside the order that names them, in as few statements as D1
// allows: an order of fifty new things must not cost fifty queries
export type ProductWrites = {
  add(products: ReadonlyArray<ActiveProduct>): void;
};
